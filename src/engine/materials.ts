import * as THREE from 'three';

export type FloorSurface = 'tile' | 'terracotta' | 'wood' | 'cement';

export interface HouseMaterialPalette {
  whiteTile: THREE.MeshStandardMaterial;
  livingTile: THREE.MeshStandardMaterial;
  terracottaGeo: THREE.MeshStandardMaterial;
  subwayTile: THREE.MeshStandardMaterial;
  leafWallpaper: THREE.MeshStandardMaterial;
  marble: THREE.MeshStandardMaterial;
  flutedSlat: THREE.MeshStandardMaterial;
  woodDark: THREE.MeshStandardMaterial;
  woodMedium: THREE.MeshStandardMaterial;
  woodTeak: THREE.MeshStandardMaterial;
  greyWood: THREE.MeshStandardMaterial;
  limePlaster: THREE.MeshStandardMaterial;
  creamPlaster: THREE.MeshStandardMaterial;
  roughCement: THREE.MeshStandardMaterial;
  counterConcrete: THREE.MeshStandardMaterial;
  wovenCushion: THREE.MeshStandardMaterial;
  brownCushion: THREE.MeshStandardMaterial;
  curtainSheer: THREE.MeshPhysicalMaterial;
  curtainBrown: THREE.MeshStandardMaterial;
  darkGlass: THREE.MeshPhysicalMaterial;
  chromeSteel: THREE.MeshStandardMaterial;
  blackIron: THREE.MeshStandardMaterial;
  matteWhite: THREE.MeshStandardMaterial;
  fridgeGrey: THREE.MeshStandardMaterial;
  redFrame: THREE.MeshStandardMaterial;
  brassGold: THREE.MeshStandardMaterial;
  lpgGreen: THREE.MeshStandardMaterial;
  ricePurple: THREE.MeshStandardMaterial;
  bucketRed: THREE.MeshStandardMaterial;
  bucketBlue: THREE.MeshStandardMaterial;
  greyDoor: THREE.MeshStandardMaterial;
  plantLeaf: THREE.MeshStandardMaterial;
  contactShadow: THREE.MeshBasicMaterial;
  dispose: () => void;
}

interface ProceduralSpec {
  size?: number;
  repeatX?: number;
  repeatY?: number;
  roughness?: number;
  metalness?: number;
  normalScale?: number;
  draw: (
    albedo: CanvasRenderingContext2D,
    height: CanvasRenderingContext2D,
    rough: CanvasRenderingContext2D,
    w: number,
    h: number
  ) => void;
}

function heightCanvasToNormalCanvas(heightCanvas: HTMLCanvasElement, strength: number): HTMLCanvasElement {
  const w = heightCanvas.width;
  const h = heightCanvas.height;
  const srcCtx = heightCanvas.getContext('2d')!;
  const src = srcCtx.getImageData(0, 0, w, h).data;

  const outCanvas = document.createElement('canvas');
  outCanvas.width = w;
  outCanvas.height = h;
  const outCtx = outCanvas.getContext('2d')!;
  const outImg = outCtx.createImageData(w, h);
  const dst = outImg.data;

  const sample = (x: number, y: number): number => {
    const wx = (x + w) % w;
    const wy = (y + h) % h;
    return src[(wy * w + wx) * 4] / 255.0;
  };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const hL = sample(x - 1, y);
      const hR = sample(x + 1, y);
      const hU = sample(x, y - 1);
      const hD = sample(x, y + 1);

      const nx = (hL - hR) * strength;
      const ny = (hU - hD) * strength;
      const nz = 1.0;
      const invLen = 1.0 / Math.sqrt(nx * nx + ny * ny + nz * nz);

      const idx = (y * w + x) * 4;
      dst[idx] = Math.round((nx * invLen * 0.5 + 0.5) * 255);
      dst[idx + 1] = Math.round((ny * invLen * 0.5 + 0.5) * 255);
      dst[idx + 2] = Math.round((nz * invLen * 0.5 + 0.5) * 255);
      dst[idx + 3] = 255;
    }
  }

  outCtx.putImageData(outImg, 0, 0);
  return outCanvas;
}

function createProceduralPBR(
  maxAnisotropy: number,
  texturesToDispose: THREE.Texture[],
  spec: ProceduralSpec
): THREE.MeshStandardMaterial {
  const size = spec.size ?? 512;
  const cAlbedo = document.createElement('canvas');
  const cHeight = document.createElement('canvas');
  const cRough = document.createElement('canvas');
  cAlbedo.width = cHeight.width = cRough.width = size;
  cAlbedo.height = cHeight.height = cRough.height = size;

  const ctxA = cAlbedo.getContext('2d')!;
  const ctxH = cHeight.getContext('2d')!;
  const ctxR = cRough.getContext('2d')!;

  spec.draw(ctxA, ctxH, ctxR, size, size);
  const cNormal = heightCanvasToNormalCanvas(cHeight, spec.normalScale ?? 3.2);

  const map = new THREE.CanvasTexture(cAlbedo);
  map.colorSpace = THREE.SRGBColorSpace;
  const normalMap = new THREE.CanvasTexture(cNormal);
  const roughnessMap = new THREE.CanvasTexture(cRough);

  const rx = spec.repeatX ?? 1;
  const ry = spec.repeatY ?? 1;
  for (const t of [map, normalMap, roughnessMap]) {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(rx, ry);
    t.anisotropy = maxAnisotropy;
    texturesToDispose.push(t);
  }

  return new THREE.MeshStandardMaterial({
    map,
    normalMap,
    normalScale: new THREE.Vector2(1.15, 1.15),
    roughnessMap,
    roughness: spec.roughness ?? 1.0,
    metalness: spec.metalness ?? 0.02,
  });
}

function seededRand(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function createContactShadowTexture(texturesToDispose: THREE.Texture[]): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 6, 64, 64, 62);
  grad.addColorStop(0, 'rgba(10, 12, 16, 0.55)');
  grad.addColorStop(0.65, 'rgba(10, 12, 16, 0.22)');
  grad.addColorStop(1, 'rgba(10, 12, 16, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  texturesToDispose.push(tex);
  return tex;
}

export function createHouseMaterials(maxAnisotropy: number): HouseMaterialPalette {
  const textures: THREE.Texture[] = [];
  const materials: THREE.Material[] = [];
  const track = <T extends THREE.Material>(m: T): T => {
    materials.push(m);
    return m;
  };

  const makeTileMat = (rx: number, ry: number, baseRough: number) =>
    track(
      createProceduralPBR(maxAnisotropy, textures, {
        size: 512,
        repeatX: rx,
        repeatY: ry,
        roughness: 1.0,
        metalness: 0.02,
        normalScale: 4.5,
        draw: (a, h, r, w, hg) => {
          const rand = seededRand(101);
          // Realistic warm indoor off-white ceramic (never clipped white)
          a.fillStyle = '#c8cdc7';
          a.fillRect(0, 0, w, hg);
          h.fillStyle = '#ebebeb';
          h.fillRect(0, 0, w, hg);
          const rv = Math.round(baseRough * 255);
          r.fillStyle = `rgb(${rv},${rv},${rv})`;
          r.fillRect(0, 0, w, hg);

          // Subtle ceramic speckle & slight glaze variation
          for (let i = 0; i < 2400; i++) {
            const x = rand() * w;
            const y = rand() * hg;
            const s = 2 + rand() * 5;
            a.fillStyle = rand() > 0.5 ? 'rgba(165,172,166,0.14)' : 'rgba(220,224,218,0.10)';
            a.fillRect(x, y, s, s);
          }

          // Deep recessed cement grout lines + beveled tile rim
          const step = w / 2;
          for (let gx = 0; gx < 2; gx++) {
            for (let gy = 0; gy < 2; gy++) {
              const x0 = gx * step;
              const y0 = gy * step;
              const grad = a.createLinearGradient(x0, y0, x0 + step, y0 + step);
              grad.addColorStop(0, 'rgba(255,255,255,0.06)');
              grad.addColorStop(0.5, 'rgba(0,0,0,0.0)');
              grad.addColorStop(1, 'rgba(0,0,0,0.06)');
              a.fillStyle = grad;
              a.fillRect(x0 + 6, y0 + 6, step - 12, step - 12);
            }
          }

          a.strokeStyle = '#6f756f';
          a.lineWidth = 8;
          h.strokeStyle = '#181818';
          h.lineWidth = 10;
          r.strokeStyle = '#ececec';
          r.lineWidth = 10;
          for (let i = 0; i <= w; i += step) {
            for (const ctx of [a, h, r]) {
              ctx.beginPath();
              ctx.moveTo(i, 0);
              ctx.lineTo(i, hg);
              ctx.stroke();
              ctx.beginPath();
              ctx.moveTo(0, i);
              ctx.lineTo(w, i);
              ctx.stroke();
            }
          }
        },
      })
    );

  const whiteTile = makeTileMat(6.5, 5.8, 0.34);
  const livingTile = makeTileMat(5.5, 5.8, 0.26);

  const terracottaGeo = track(
    createProceduralPBR(maxAnisotropy, textures, {
      size: 512,
      repeatX: 4,
      repeatY: 6,
      roughness: 1.0,
      metalness: 0.02,
      normalScale: 4.8,
      draw: (a, h, r, w, hg) => {
        const rand = seededRand(202);
        a.fillStyle = '#c27456';
        a.fillRect(0, 0, w, hg);
        h.fillStyle = '#b4b4b4';
        h.fillRect(0, 0, w, hg);
        r.fillStyle = '#828282';
        r.fillRect(0, 0, w, hg);

        const grid = w / 2;
        for (let gx = 0; gx < 2; gx++) {
          for (let gy = 0; gy < 2; gy++) {
            const cx = gx * grid + grid / 2;
            const cy = gy * grid + grid / 2;
            a.strokeStyle = '#8d432b';
            a.lineWidth = 8;
            a.strokeRect(gx * grid + 6, gy * grid + 6, grid - 12, grid - 12);
            h.strokeStyle = '#323232';
            h.lineWidth = 8;
            h.strokeRect(gx * grid + 6, gy * grid + 6, grid - 12, grid - 12);
            r.strokeStyle = '#d4d4d4';
            r.lineWidth = 8;
            r.strokeRect(gx * grid + 6, gy * grid + 6, grid - 12, grid - 12);

            a.fillStyle = '#d48d6f';
            a.beginPath();
            h.fillStyle = '#e8e8e8';
            h.beginPath();
            for (let k = 0; k < 8; k++) {
              const ang = (k / 8) * Math.PI * 2 + Math.PI / 8;
              const px = cx + Math.cos(ang) * (grid * 0.31);
              const py = cy + Math.sin(ang) * (grid * 0.31);
              if (k === 0) {
                a.moveTo(px, py);
                h.moveTo(px, py);
              } else {
                a.lineTo(px, py);
                h.lineTo(px, py);
              }
            }
            a.closePath();
            a.fill();
            a.stroke();
            h.closePath();
            h.fill();
            h.stroke();
          }
        }
        for (let i = 0; i < 1800; i++) {
          a.fillStyle = `rgba(90,40,25,${rand() * 0.1})`;
          a.fillRect(rand() * w, rand() * hg, 3, 3);
        }
      },
    })
  );

  const subwayTile = track(
    createProceduralPBR(maxAnisotropy, textures, {
      size: 512,
      repeatX: 4,
      repeatY: 2,
      roughness: 1.0,
      metalness: 0.02,
      normalScale: 5.5,
      draw: (a, h, r, w, hg) => {
        a.fillStyle = '#c8cdc7';
        a.fillRect(0, 0, w, hg);
        h.fillStyle = '#e8e8e8';
        h.fillRect(0, 0, w, hg);
        r.fillStyle = '#484848';
        r.fillRect(0, 0, w, hg);

        const rows = 8;
        const cols = 4;
        const rh = hg / rows;
        const cw = w / cols;

        for (let row = 0; row < rows; row++) {
          const y = row * rh;
          const offset = (row % 2) * (cw / 2);
          for (let col = -1; col <= cols; col++) {
            const x = col * cw + offset;
            const grad = a.createLinearGradient(x, y, x, y + rh);
            grad.addColorStop(0, '#d5dad4');
            grad.addColorStop(0.5, '#c6ccc5');
            grad.addColorStop(1, '#b6bcb5');
            a.fillStyle = grad;
            a.fillRect(x + 3, y + 3, cw - 6, rh - 6);

            h.fillStyle = '#ffffff';
            h.fillRect(x + 4, y + 4, cw - 8, rh - 8);
          }
          a.strokeStyle = '#6c726c';
          a.lineWidth = 5;
          h.strokeStyle = '#181818';
          h.lineWidth = 6;
          r.strokeStyle = '#e2e2e2';
          r.lineWidth = 6;

          for (const ctx of [a, h, r]) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
          }

          for (let col = 0; col <= cols; col++) {
            const x = (col * cw + offset) % w;
            for (const ctx of [a, h, r]) {
              ctx.beginPath();
              ctx.moveTo(x, y);
              ctx.lineTo(x, y + rh);
              ctx.stroke();
            }
          }
        }
      },
    })
  );

  const leafWallpaper = track(
    createProceduralPBR(maxAnisotropy, textures, {
      size: 512,
      repeatX: 3.5,
      repeatY: 2.2,
      roughness: 1.0,
      metalness: 0.01,
      normalScale: 2.6,
      draw: (a, h, r, w, hg) => {
        const rand = seededRand(303);
        a.fillStyle = '#cfd2c6';
        a.fillRect(0, 0, w, hg);
        h.fillStyle = '#808080';
        h.fillRect(0, 0, w, hg);
        r.fillStyle = '#c8c8c8';
        r.fillRect(0, 0, w, hg);

        a.strokeStyle = 'rgba(155,160,146,0.28)';
        a.lineWidth = 1;
        h.strokeStyle = 'rgba(205,205,205,0.35)';
        h.lineWidth = 1;
        for (let i = 0; i < w; i += 4) {
          a.beginPath();
          a.moveTo(i, 0);
          a.lineTo(i, hg);
          a.stroke();
          a.beginPath();
          a.moveTo(0, i);
          a.lineTo(w, i);
          a.stroke();
          h.beginPath();
          h.moveTo(i, 0);
          h.lineTo(i, hg);
          h.stroke();
        }

        for (let row = 0; row < 5; row++) {
          for (let col = 0; col < 5; col++) {
            const x = col * 102 + 48 + (rand() - 0.5) * 16;
            const y = row * 102 + 48 + (rand() - 0.5) * 16;
            const ang = (row + col) % 2 === 0 ? 0.52 : -0.46;
            const colLeaf = (row + col) % 3 === 0 ? '#5b6b56' : '#3d473b';
            for (const isH of [false, true]) {
              const ctx = isH ? h : a;
              ctx.save();
              ctx.translate(x, y);
              ctx.rotate(ang);
              ctx.strokeStyle = isH ? '#dcdcdc' : colLeaf;
              ctx.lineWidth = 2.4;
              ctx.beginPath();
              ctx.moveTo(0, -28);
              ctx.lineTo(0, 28);
              ctx.stroke();
              ctx.lineWidth = 1.8;
              for (let s = -22; s <= 22; s += 5.5) {
                const span = 14 * (1 - Math.abs(s) / 36);
                ctx.beginPath();
                ctx.moveTo(0, s);
                ctx.lineTo(-span, s - 6);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(0, s);
                ctx.lineTo(span, s - 6);
                ctx.stroke();
              }
              ctx.restore();
            }
          }
        }
      },
    })
  );

  const marble = track(
    createProceduralPBR(maxAnisotropy, textures, {
      size: 512,
      repeatX: 2,
      repeatY: 2,
      roughness: 1.0,
      metalness: 0.03,
      normalScale: 1.5,
      draw: (a, h, r, w, hg) => {
        const rand = seededRand(404);
        a.fillStyle = '#d3d7d1';
        a.fillRect(0, 0, w, hg);
        h.fillStyle = '#d4d4d4';
        h.fillRect(0, 0, w, hg);
        r.fillStyle = '#383838';
        r.fillRect(0, 0, w, hg);

        for (let v = 0; v < 20; v++) {
          const alpha = 0.18 + rand() * 0.25;
          a.strokeStyle = `rgba(88,98,106,${alpha})`;
          a.lineWidth = 1.5 + rand() * 6;
          h.strokeStyle = 'rgba(155,155,155,0.45)';
          h.lineWidth = a.lineWidth;
          r.strokeStyle = '#686868';
          r.lineWidth = a.lineWidth;

          let x = rand() * w;
          let y = 0;
          for (const ctx of [a, h, r]) {
            ctx.beginPath();
            ctx.moveTo(x, y);
          }
          while (y < hg) {
            y += 22;
            x += (rand() - 0.5) * 44;
            a.lineTo(x, y);
            h.lineTo(x, y);
            r.lineTo(x, y);
          }
          a.stroke();
          h.stroke();
          r.stroke();
        }
      },
    })
  );

  const makeWoodMat = (hexBase: string, hexDark: string, seed: number, plank = false, rough = 0.48) =>
    track(
      createProceduralPBR(maxAnisotropy, textures, {
        size: 512,
        repeatX: plank ? 2 : 1,
        repeatY: plank ? 3 : 1,
        roughness: 1.0,
        metalness: 0.02,
        normalScale: plank ? 4.4 : 2.8,
        draw: (a, h, r, w, hg) => {
          const rand = seededRand(seed);
          a.fillStyle = hexBase;
          a.fillRect(0, 0, w, hg);
          h.fillStyle = '#929292';
          h.fillRect(0, 0, w, hg);
          const rv = Math.round(rough * 255);
          r.fillStyle = `rgb(${rv},${rv},${rv})`;
          r.fillRect(0, 0, w, hg);

          for (let i = 0; i < 140; i++) {
            const y = rand() * hg;
            const lw = 1 + rand() * 3.5;
            a.strokeStyle = hexDark;
            a.globalAlpha = 0.24 + rand() * 0.18;
            a.lineWidth = lw;
            a.beginPath();
            a.moveTo(0, y);
            a.bezierCurveTo(w * 0.3, y + (rand() - 0.5) * 16, w * 0.7, y + (rand() - 0.5) * 16, w, y);
            a.stroke();

            h.strokeStyle = '#505050';
            h.globalAlpha = 0.38;
            h.lineWidth = lw;
            h.beginPath();
            h.moveTo(0, y);
            h.lineTo(w, y);
            h.stroke();
          }
          a.globalAlpha = 1;
          h.globalAlpha = 1;

          if (plank) {
            const ph = hg / 6;
            a.strokeStyle = '#1b1d1f';
            a.lineWidth = 4;
            h.strokeStyle = '#141414';
            h.lineWidth = 5;
            r.strokeStyle = '#dedede';
            r.lineWidth = 5;
            for (let row = 0; row < 6; row++) {
              const py = row * ph;
              for (const ctx of [a, h, r]) {
                ctx.beginPath();
                ctx.moveTo(0, py);
                ctx.lineTo(w, py);
                ctx.stroke();
              }
              const sx = ((row % 2) * w) / 2 + w * 0.25;
              for (const ctx of [a, h, r]) {
                ctx.beginPath();
                ctx.moveTo(sx, py);
                ctx.lineTo(sx, py + ph);
                ctx.stroke();
              }
            }
          }
        },
      })
    );

  const woodDark = makeWoodMat('#4f2e18', '#261307', 501, false, 0.44);
  const woodMedium = makeWoodMat('#814e26', '#4a290f', 502, false, 0.48);
  const woodTeak = makeWoodMat('#a96930', '#6d3e15', 503, false, 0.46);
  const greyWood = makeWoodMat('#44484b', '#1e2022', 504, true, 0.52);
  const flutedSlat = makeWoodMat('#58544b', '#2f2c27', 505, false, 0.56);

  const makePlasterMat = (hex: string, rough: number, rx: number, ry: number, seed: number, aged = false) =>
    track(
      createProceduralPBR(maxAnisotropy, textures, {
        size: 512,
        repeatX: rx,
        repeatY: ry,
        roughness: 1.0,
        metalness: 0.01,
        normalScale: aged ? 3.8 : 1.8,
        draw: (a, h, r, w, hg) => {
          const rand = seededRand(seed);
          a.fillStyle = hex;
          a.fillRect(0, 0, w, hg);
          h.fillStyle = '#808080';
          h.fillRect(0, 0, w, hg);
          const rv = Math.round(rough * 255);
          r.fillStyle = `rgb(${rv},${rv},${rv})`;
          r.fillRect(0, 0, w, hg);

          const specks = aged ? 5000 : 2800;
          for (let i = 0; i < specks; i++) {
            const x = rand() * w;
            const y = rand() * hg;
            const v = Math.floor(95 + rand() * 70);
            h.fillStyle = `rgb(${v},${v},${v})`;
            h.fillRect(x, y, 3, 3);
            if (aged) {
              a.fillStyle = rand() > 0.5 ? 'rgba(55,48,38,0.16)' : 'rgba(205,198,185,0.12)';
              a.fillRect(x, y, 4 + rand() * 10, 4 + rand() * 10);
            } else {
              a.fillStyle = rand() > 0.5 ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.03)';
              a.fillRect(x, y, 3, 3);
            }
          }
        },
      })
    );

  const limePlaster = makePlasterMat('#b4c934', 0.72, 2, 2, 601);
  const creamPlaster = makePlasterMat('#d2d0c8', 0.84, 2, 2, 602);
  const roughCement = makePlasterMat('#8c8474', 0.92, 2, 2, 603, true);
  const counterConcrete = makePlasterMat('#b7bbb6', 0.54, 2, 2, 604);

  const makeFabricMat = (baseHex: string, threadHex: string, seed: number) =>
    track(
      createProceduralPBR(maxAnisotropy, textures, {
        size: 512,
        repeatX: 4,
        repeatY: 4,
        roughness: 1.0,
        metalness: 0.01,
        normalScale: 3.0,
        draw: (a, h, r, w, hg) => {
          const rand = seededRand(seed);
          a.fillStyle = baseHex;
          a.fillRect(0, 0, w, hg);
          h.fillStyle = '#787878';
          h.fillRect(0, 0, w, hg);
          r.fillStyle = '#dcdcdc';
          r.fillRect(0, 0, w, hg);

          a.strokeStyle = threadHex;
          a.lineWidth = 2;
          h.strokeStyle = '#c8c8c8';
          h.lineWidth = 2;
          for (let i = 0; i < w; i += 6) {
            a.globalAlpha = 0.25 + rand() * 0.15;
            a.beginPath();
            a.moveTo(i, 0);
            a.lineTo(i, hg);
            a.stroke();
            a.beginPath();
            a.moveTo(0, i);
            a.lineTo(w, i);
            a.stroke();
            h.beginPath();
            h.moveTo(i, 0);
            h.lineTo(i, hg);
            h.stroke();
          }
          a.globalAlpha = 1;
        },
      })
    );

  const wovenCushion = makeFabricMat('#a98660', '#6d5033', 701);
  const brownCushion = makeFabricMat('#8a5d32', '#523214', 702);
  const curtainBrown = makeFabricMat('#4d3629', '#2b1c13', 703);

  const curtainSheer = track(
    new THREE.MeshPhysicalMaterial({
      color: 0xdcdfe2,
      roughness: 0.78,
      metalness: 0.0,
      transparent: true,
      opacity: 0.86,
      side: THREE.DoubleSide,
      sheen: 0.5,
      sheenRoughness: 0.6,
    })
  );

  const darkGlass = track(
    new THREE.MeshPhysicalMaterial({
      color: 0x0b0f14,
      roughness: 0.09,
      metalness: 0.14,
      reflectivity: 0.8,
      clearcoat: 0.9,
      clearcoatRoughness: 0.08,
      transparent: true,
      opacity: 0.9,
    })
  );

  const chromeSteel = track(
    new THREE.MeshStandardMaterial({
      color: 0xaab2ba,
      roughness: 0.26,
      metalness: 0.86,
    })
  );

  const blackIron = track(
    new THREE.MeshStandardMaterial({
      color: 0x1a1e22,
      roughness: 0.42,
      metalness: 0.58,
    })
  );

  const matteWhite = track(
    new THREE.MeshStandardMaterial({
      color: 0xd6d8d4,
      roughness: 0.52,
      metalness: 0.02,
    })
  );

  const fridgeGrey = track(
    new THREE.MeshStandardMaterial({
      color: 0x5c6268,
      roughness: 0.30,
      metalness: 0.62,
    })
  );

  const redFrame = track(
    new THREE.MeshStandardMaterial({
      color: 0x821e1e,
      roughness: 0.56,
      metalness: 0.04,
    })
  );

  const brassGold = track(
    new THREE.MeshStandardMaterial({
      color: 0xc29e3b,
      roughness: 0.28,
      metalness: 0.82,
    })
  );

  const lpgGreen = track(
    new THREE.MeshStandardMaterial({
      color: 0x1a946f,
      roughness: 0.44,
      metalness: 0.18,
    })
  );

  const ricePurple = track(
    new THREE.MeshStandardMaterial({
      color: 0x9b72cf,
      roughness: 0.34,
      metalness: 0.1,
    })
  );

  const bucketRed = track(
    new THREE.MeshStandardMaterial({
      color: 0xc41856,
      roughness: 0.38,
      metalness: 0.04,
    })
  );

  const bucketBlue = track(
    new THREE.MeshStandardMaterial({
      color: 0x1a6cb3,
      roughness: 0.42,
      metalness: 0.04,
    })
  );

  const greyDoor = track(
    new THREE.MeshStandardMaterial({
      color: 0xa0a6ac,
      roughness: 0.46,
      metalness: 0.22,
    })
  );

  const plantLeaf = track(
    new THREE.MeshStandardMaterial({
      color: 0x285e2e,
      roughness: 0.52,
      metalness: 0.02,
      side: THREE.DoubleSide,
    })
  );

  const contactShadow = track(
    new THREE.MeshBasicMaterial({
      map: createContactShadowTexture(textures),
      transparent: true,
      depthWrite: false,
      opacity: 0.52,
    })
  );

  return {
    whiteTile,
    livingTile,
    terracottaGeo,
    subwayTile,
    leafWallpaper,
    marble,
    flutedSlat,
    woodDark,
    woodMedium,
    woodTeak,
    greyWood,
    limePlaster,
    creamPlaster,
    roughCement,
    counterConcrete,
    wovenCushion,
    brownCushion,
    curtainSheer,
    curtainBrown,
    darkGlass,
    chromeSteel,
    blackIron,
    matteWhite,
    fridgeGrey,
    redFrame,
    brassGold,
    lpgGreen,
    ricePurple,
    bucketRed,
    bucketBlue,
    greyDoor,
    plantLeaf,
    contactShadow,
    dispose: () => {
      textures.forEach((t) => t.dispose());
      materials.forEach((m) => m.dispose());
    },
  };
}
