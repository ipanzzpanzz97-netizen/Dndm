import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { HouseAudioEngine } from './audio';
import { buildHouseWorld, BuiltHouseScene, getZoneAt, ZoneId, ZONES } from './houseScene';
import { createHouseMaterials, HouseMaterialPalette } from './materials';

export type GameMode = 'title' | 'playing' | 'paused';

export interface WalkthroughCallbacks {
  onZoneChange?: (zoneLabel: string, zoneId: ZoneId, surface: string) => void;
  onPlayerMove?: (x: number, z: number, yaw: number) => void;
  onPointerLockChange?: (locked: boolean) => void;
}

// Pre-allocated scratch math helpers (zero GC inside render loop)
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _moveDelta = new THREE.Vector3();
const _playerBox = new THREE.Box3();
const _boxSize = new THREE.Vector3(0.56, 1.52, 0.56);
const _boxCenter = new THREE.Vector3();

function detectSoftwareWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export class WalkthroughEngine {
  private container: HTMLElement;
  private callbacks: WalkthroughCallbacks;
  private isSoftwareGl: boolean;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private composer: EffectComposer | null = null;
  private ssaoPass: SSAOPass | null = null;
  private bloomPass: UnrealBloomPass | null = null;
  private mats: HouseMaterialPalette;
  private builtHouse: BuiltHouseScene;
  private audio: HouseAudioEngine;
  private envRT: THREE.WebGLRenderTarget;

  private clock = new THREE.Clock();
  private frameId = 0;
  private timerId = 0;
  private disposed = false;

  private mode: GameMode = 'title';
  private playerPos = new THREE.Vector3(0.15, 1.62, 3.65);
  private targetYaw = Math.PI * 0.96;
  private currentYaw = Math.PI * 0.96;
  private targetPitch = -0.04;
  private currentPitch = -0.04;
  private walkPhase = 0;
  private stepAccum = 0;
  private lastZoneLabel = '';
  private moveSpeed = 3.0;

  private keys: Record<string, boolean> = {};
  private joyVec = { x: 0, y: 0 };
  private titleTime = 0;

  constructor(container: HTMLElement, callbacks: WalkthroughCallbacks = {}) {
    this.container = container;
    this.callbacks = callbacks;
    this.isSoftwareGl = detectSoftwareWebGL();
    this.audio = new HouseAudioEngine();

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0b0f17);
    this.scene.fog = new THREE.FogExp2(0x0b0f17, 0.018);

    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(62, w / h, 0.08, 45);
    this.camera.rotation.order = 'YXZ';

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.82;
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    container.appendChild(this.renderer.domElement);

    // Subtle Studio Environment Reflection via RoomEnvironment (calibrated to avoid whiteout wash)
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = this.envRT.texture;
    this.scene.environmentIntensity = 0.16;
    pmrem.dispose();

    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.mats = createHouseMaterials(maxAniso);
    this.builtHouse = buildHouseWorld(this.scene, this.mats);
    this.setupLighting();

    if (!this.isSoftwareGl) {
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(new RenderPass(this.scene, this.camera));

      this.ssaoPass = new SSAOPass(this.scene, this.camera, w, h);
      this.ssaoPass.kernelRadius = 0.45;
      this.ssaoPass.minDistance = 0.0015;
      this.ssaoPass.maxDistance = 0.14;
      this.composer.addPass(this.ssaoPass);

      this.bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), 0.10, 0.25, 1.02);
      this.composer.addPass(this.bloomPass);

      this.renderer.compile(this.scene, this.camera);
    }

    this.bindEvents();
    this.syncZone();
    this.tick();
  }

  private setupLighting(): void {
    // Grounded natural ambient gradient so wall corners retain realistic shading
    const hemi = new THREE.HemisphereLight(0xdde6f5, 0x1e1914, 0.24);
    this.scene.add(hemi);

    // Subtle indirect bounce key
    const sunKey = new THREE.DirectionalLight(0xfff1dc, 0.15);
    sunKey.position.set(-4, 6.5, -3);
    this.scene.add(sunKey);

    const addRoomLight = (
      x: number,
      z: number,
      color: number,
      intensity: number,
      distance: number,
      castShadow: boolean,
      yPos = 2.66
    ) => {
      const pt = new THREE.PointLight(color, intensity, distance, 2.0);
      pt.position.set(x, yPos, z);
      if (castShadow && !this.isSoftwareGl) {
        pt.castShadow = true;
        pt.shadow.mapSize.set(2048, 2048);
        pt.shadow.bias = -0.0005;
        pt.shadow.normalBias = 0.025;
        pt.shadow.camera.near = 0.22;
        pt.shadow.camera.far = distance;
      }
      this.scene.add(pt);
    };

    // Physically plausible indoor fixtures (max 2 shadow-casting lights for tight GPU budget)
    addRoomLight(0.0, 4.5, 0xf2f6fc, 4.0, 10.5, true);
    addRoomLight(0.65, -2.2, 0xfff0d6, 3.8, 10.5, false);
    addRoomLight(-4.2, -3.8, 0xfff1d8, 4.4, 11.0, true, 2.52);
    addRoomLight(-4.5, 4.1, 0xffe8c2, 2.6, 7.8, false, 2.60);
  }

  private onKeyDown = (e: KeyboardEvent) => {
    this.keys[e.code] = true;
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys[e.code] = false;
  };

  private onBlur = () => {
    this.keys = {};
    this.joyVec.x = 0;
    this.joyVec.y = 0;
  };

  private onMouseMove = (e: MouseEvent) => {
    if (this.mode !== 'playing') return;
    if (document.pointerLockElement === this.renderer.domElement) {
      this.targetYaw -= e.movementX * 0.0022;
      this.targetPitch = THREE.MathUtils.clamp(
        this.targetPitch - e.movementY * 0.0022,
        -1.32,
        1.32
      );
    }
  };

  private onPointerLockChange = () => {
    const locked = document.pointerLockElement === this.renderer.domElement;
    this.callbacks.onPointerLockChange?.(locked);
  };

  private onResize = () => {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    if (this.composer) {
      this.composer.setSize(w, h);
    }
    if (this.ssaoPass) {
      this.ssaoPass.setSize(w, h);
    }
    if (this.bloomPass) {
      this.bloomPass.resolution.set(w, h);
    }
  };

  private bindEvents(): void {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    window.addEventListener('resize', this.onResize);
    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
  }

  public requestPointerLock(): void {
    this.audio.unlock();
    if (window.innerWidth > 768 && document.pointerLockElement !== this.renderer.domElement) {
      this.renderer.domElement.requestPointerLock?.();
    }
  }

  public releasePointerLock(): void {
    if (document.pointerLockElement === this.renderer.domElement) {
      document.exitPointerLock?.();
    }
  }

  public setMode(mode: GameMode): void {
    this.mode = mode;
    if (mode === 'playing') {
      this.audio.unlock();
    } else {
      this.keys = {};
      this.joyVec.x = 0;
      this.joyVec.y = 0;
      this.releasePointerLock();
    }
  }

  public teleportToZone(zoneId: ZoneId): void {
    const z = ZONES[zoneId];
    this.playerPos.set(z.teleport.x, z.teleport.y, z.teleport.z);
    this.targetYaw = z.teleport.yaw;
    this.currentYaw = z.teleport.yaw;
    this.targetPitch = 0;
    this.currentPitch = 0;
    this.audio.unlock();
    this.audio.playUiClick();
    this.syncZone();
  }

  public setJoystickVector(x: number, y: number): void {
    this.joyVec.x = x;
    this.joyVec.y = y;
  }

  public addLookDelta(dx: number, dy: number): void {
    if (this.mode !== 'playing') return;
    this.targetYaw -= dx * 0.0048;
    this.targetPitch = THREE.MathUtils.clamp(this.targetPitch - dy * 0.0048, -1.32, 1.32);
  }

  public setMoveSpeed(speed: number): void {
    this.moveSpeed = speed;
  }

  public setMuted(muted: boolean): void {
    this.audio.setMuted(muted);
  }

  public playClick(): void {
    this.audio.unlock();
    this.audio.playUiClick();
  }

  private collidesAt(x: number, z: number): boolean {
    _boxCenter.set(x, 0.9, z);
    _playerBox.setFromCenterAndSize(_boxCenter, _boxSize);
    const list = this.builtHouse.colliders;
    for (let i = 0; i < list.length; i++) {
      if (_playerBox.intersectsBox(list[i])) {
        return true;
      }
    }
    return false;
  }

  private syncZone(): void {
    const info = getZoneAt(this.playerPos.x, this.playerPos.z);
    if (info.label !== this.lastZoneLabel) {
      this.lastZoneLabel = info.label;
      this.callbacks.onZoneChange?.(info.label, info.id, info.surface);
    }
    this.callbacks.onPlayerMove?.(this.playerPos.x, this.playerPos.z, this.currentYaw);
  }

  private updateSimulation(dt: number): void {
    // Gentle breeze motion on sheer curtains
    const t = this.clock.elapsedTime;
    const curtains = this.builtHouse.curtainMeshes;
    for (let i = 0; i < curtains.length; i++) {
      curtains[i].rotation.x = Math.sin(t * 1.1 + i) * 0.012;
    }

    if (this.mode === 'title') {
      this.titleTime += dt;
      // Atmospheric slow camera pan inside the living room & kitchen vista
      const panAngle = Math.sin(this.titleTime * 0.22) * 0.45;
      this.camera.position.set(
        -3.5 + Math.cos(this.titleTime * 0.18) * 0.6,
        1.64,
        -3.6 + Math.sin(this.titleTime * 0.18) * 0.5
      );
      this.camera.rotation.set(-0.04, Math.PI * 0.55 + panAngle, 0, 'YXZ');
      return;
    }

    if (this.mode === 'paused') {
      return;
    }

    // Smooth exponential camera damping
    const dampLambda = 18;
    this.currentYaw = THREE.MathUtils.damp(this.currentYaw, this.targetYaw, dampLambda, dt);
    this.currentPitch = THREE.MathUtils.damp(this.currentPitch, this.targetPitch, dampLambda, dt);

    let moveZ = 0;
    let moveX = 0;
    if (this.keys['KeyW'] || this.keys['ArrowUp']) moveZ -= 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) moveZ += 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) moveX -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) moveX += 1;

    moveX += this.joyVec.x;
    moveZ += this.joyVec.y;

    const len = Math.hypot(moveX, moveZ);
    if (len > 0.05) {
      const normScale = len > 1 ? 1 / len : 1;
      const sx = moveX * normScale;
      const sz = moveZ * normScale;

      _forward.set(-Math.sin(this.currentYaw), 0, -Math.cos(this.currentYaw));
      _right.set(Math.cos(this.currentYaw), 0, -Math.sin(this.currentYaw));
      _moveDelta
        .set(0, 0, 0)
        .addScaledVector(_forward, -sz)
        .addScaledVector(_right, sx)
        .multiplyScalar(this.moveSpeed * dt);

      const nx = this.playerPos.x + _moveDelta.x;
      if (!this.collidesAt(nx, this.playerPos.z)) {
        this.playerPos.x = nx;
      }
      const nz = this.playerPos.z + _moveDelta.z;
      if (!this.collidesAt(this.playerPos.x, nz)) {
        this.playerPos.z = nz;
      }

      this.walkPhase += dt * (this.moveSpeed * 3.1);
      this.stepAccum += _moveDelta.length();
      if (this.stepAccum >= 0.62) {
        this.stepAccum = 0;
        const zone = getZoneAt(this.playerPos.x, this.playerPos.z);
        this.audio.playFootstep(zone.surface);
      }
      this.syncZone();
    } else {
      this.walkPhase = THREE.MathUtils.damp(this.walkPhase, Math.round(this.walkPhase / Math.PI) * Math.PI, 8, dt);
    }

    const headBob = len > 0.05 ? Math.sin(this.walkPhase) * 0.032 : 0;
    this.camera.position.set(this.playerPos.x, this.playerPos.y + headBob, this.playerPos.z);
    this.camera.rotation.set(this.currentPitch, this.currentYaw, 0, 'YXZ');
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (typeof gl.fenceSync === 'function') {
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (this.disposed) return;
        const state = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
        if (state === gl.UNSIGNALED) {
          this.timerId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          this.timerId = window.setTimeout(cb, 80);
        }
      };
      this.timerId = window.setTimeout(poll, 5);
    } else {
      this.timerId = window.setTimeout(cb, 80);
    }
  }

  private tick = (): void => {
    if (this.disposed) return;
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.updateSimulation(dt);

    if (this.isSoftwareGl || !this.composer) {
      this.renderer.render(this.scene, this.camera);
    } else {
      this.composer.render();
    }

    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.timerId);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    window.removeEventListener('resize', this.onResize);
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    this.releasePointerLock();

    this.builtHouse.disposeGeometries();
    this.mats.dispose();
    this.envRT.dispose();
    this.composer?.dispose();
    this.audio.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
