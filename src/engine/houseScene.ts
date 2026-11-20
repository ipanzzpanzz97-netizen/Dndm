import * as THREE from 'three';
import {
  buildAirConditioner,
  buildBookshelfWithBooks,
  buildBroomAndMop,
  buildCarvedWoodChair,
  buildConduitRun,
  buildCurtainWindowSet,
  buildDoorUnit,
  buildDoubleSink,
  buildDoubleWhiteCabinet,
  buildExhaustFan,
  buildFlutedWallPanel,
  buildFoldingMarbleTable,
  buildFoldingSteelChair,
  buildFramedPictureGrid,
  buildFridge,
  buildGasStoveAndTank,
  buildHangingCabinet,
  buildKitchenCounterClutter,
  buildKitchenRollingCart,
  buildLongSofa,
  buildMicrowaveCabinet,
  buildRedBucketAndTap,
  buildRedCorridorDoorway,
  buildRiceCooker,
  buildStructuralBeam,
  buildTrayCeilingAndChandelier,
  buildTubeLightFixture,
  buildTVFeatureWallSet,
  buildWallSwitch,
  buildWindowAndDishRack,
  buildWorkDeskSet,
} from './furniture';
import { FloorSurface, HouseMaterialPalette } from './materials';

export type ZoneId = 'dapur' | 'tengah' | 'tamu' | 'koridor';

export interface ZoneInfo {
  id: ZoneId;
  label: string;
  surface: FloorSurface;
  teleport: { x: number; y: number; z: number; yaw: number };
}

export const ZONES: Record<ZoneId, ZoneInfo> = {
  dapur: {
    id: 'dapur',
    label: 'Zon 1 · Dapur',
    surface: 'tile',
    teleport: { x: 0.15, y: 1.62, z: 3.65, yaw: Math.PI * 0.96 },
  },
  tengah: {
    id: 'tengah',
    label: 'Zon 2 · Ruang Tengah & Kerja',
    surface: 'terracotta',
    teleport: { x: 0.65, y: 1.62, z: -1.45, yaw: 0.15 },
  },
  tamu: {
    id: 'tamu',
    label: 'Zon 3 · Ruang Tamu Utama',
    surface: 'tile',
    teleport: { x: -3.2, y: 1.62, z: -4.15, yaw: Math.PI / 2 },
  },
  koridor: {
    id: 'koridor',
    label: 'Zon 4 · Koridor & Bilik Air',
    surface: 'wood',
    teleport: { x: -4.2, y: 1.62, z: 2.55, yaw: Math.PI },
  },
};

export function getZoneAt(x: number, z: number): ZoneInfo {
  if (x < -3.2 && z >= 1.5) {
    if (z > 5.45) {
      return { ...ZONES.koridor, label: 'Zon 4 · Bilik Air Belakang', surface: 'cement' };
    }
    return ZONES.koridor;
  }
  if (z >= 1.5) return ZONES.dapur;
  if (x < -1.6) return ZONES.tamu;
  return ZONES.tengah;
}

export interface BuiltHouseScene {
  colliders: THREE.Box3[];
  curtainMeshes: THREE.Mesh[];
  disposeGeometries: () => void;
}

export function buildHouseWorld(
  scene: THREE.Scene,
  mats: HouseMaterialPalette
): BuiltHouseScene {
  const colliders: THREE.Box3[] = [];
  const curtainMeshes: THREE.Mesh[] = [];
  const H = 2.95;

  const addBox = (
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    mat: THREE.Material,
    collide = true,
    cast = true
  ): THREE.Mesh => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = cast;
    mesh.receiveShadow = true;
    scene.add(mesh);
    if (collide) {
      colliders.push(
        new THREE.Box3().setFromCenterAndSize(
          new THREE.Vector3(x, y, z),
          new THREE.Vector3(w, h, d)
        )
      );
    }
    return mesh;
  };

  const addSkirtingAndCornice = (
    len: number,
    x: number,
    z: number,
    rotY: number,
    skirtingMat: THREE.Material = mats.woodDark
  ) => {
    const g = new THREE.Group();
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(len, 0.095, 0.024), skirtingMat);
    skirt.position.set(0, 0.0475, 0);
    skirt.receiveShadow = true;
    g.add(skirt);

    const skirtCap = new THREE.Mesh(new THREE.BoxGeometry(len, 0.014, 0.030), skirtingMat);
    skirtCap.position.set(0, 0.096, 0.002);
    skirtCap.receiveShadow = true;
    g.add(skirtCap);

    const cornice = new THREE.Mesh(new THREE.BoxGeometry(len, 0.085, 0.05), mats.creamPlaster);
    cornice.position.set(0, H - 0.042, 0.012);
    cornice.receiveShadow = true;
    g.add(cornice);

    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    scene.add(g);
  };

  const placeProp = (
    group: THREE.Group,
    x: number,
    y: number,
    z: number,
    rotY = 0,
    colliderSize?: [number, number, number]
  ) => {
    group.position.set(x, y, z);
    group.rotation.y = rotY;
    scene.add(group);
    group.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh && obj.name === 'curtainSheer') {
        curtainMeshes.push(obj as THREE.Mesh);
      }
    });
    if (colliderSize) {
      colliders.push(
        new THREE.Box3().setFromCenterAndSize(
          new THREE.Vector3(x, y + colliderSize[1] / 2, z),
          new THREE.Vector3(colliderSize[0], colliderSize[1], colliderSize[2])
        )
      );
    }
  };

  // =========================================================================
  // ZON 1: DAPUR (x: -3.2 .. 3.2, z: 1.5 .. 7.2)
  // =========================================================================
  addBox(6.4, 0.1, 5.7, 0, -0.05, 4.35, mats.whiteTile, false, false);
  addBox(6.4, 0.1, 5.7, 0, H + 0.05, 4.35, mats.creamPlaster, false, false);

  // Back wall (z = 7.2) + raised subway tile backsplash
  addBox(6.4, H, 0.18, 0, H / 2, 7.2, mats.creamPlaster);
  addBox(6.18, 1.48, 0.03, 0, 1.38, 7.09, mats.subwayTile, false, false);

  // Left wall (x = -3.2): split around red-framed corridor doorway (z = 1.9 .. 2.95)
  addBox(0.18, H, 4.25, -3.2, H / 2, 5.075, mats.creamPlaster);
  addBox(0.18, H, 0.40, -3.2, H / 2, 1.70, mats.creamPlaster);
  addBox(0.18, 0.75, 1.05, -3.2, 2.575, 2.425, mats.creamPlaster, false);
  // Multi-stepped red corridor doorway + architrave + threshold + ajar wooden door leaf
  placeProp(buildRedCorridorDoorway(mats), -3.2, 0, 2.425, 0);
  // Subway tile backsplash on left cooking wall
  addBox(0.03, 1.45, 2.35, -3.09, 1.38, 5.95, mats.subwayTile, false, false);

  // Right wall (x = 3.2) + backsplash
  addBox(0.18, H, 5.7, 3.2, H / 2, 4.35, mats.creamPlaster);
  addBox(0.03, 1.45, 3.7, 3.09, 1.38, 5.2, mats.subwayTile, false, false);

  // Partition wall separating Kitchen & Middle Room (z = 1.5), doorway x = -0.35 .. 0.95
  addBox(2.85, H, 0.18, -1.775, H / 2, 1.5, mats.creamPlaster);
  addBox(2.25, H, 0.18, 2.075, H / 2, 1.5, mats.creamPlaster);
  addBox(1.30, 0.75, 0.18, 0.30, 2.575, 1.5, mats.creamPlaster, false);
  // Partition doorway casing jambs
  addBox(0.05, 2.22, 0.21, -0.35, 1.11, 1.5, mats.woodMedium, false);
  addBox(0.05, 2.22, 0.21, 0.95, 1.11, 1.5, mats.woodMedium, false);
  addBox(1.36, 0.06, 0.21, 0.30, 2.21, 1.5, mats.woodMedium, false);

  // Complete Skirting & Cornices across ALL Kitchen wall segments (eliminating raw wall-floor seams)
  addSkirtingAndCornice(6.1, 0, 7.09, 0, mats.woodDark);
  addSkirtingAndCornice(5.5, 3.09, 4.35, -Math.PI / 2, mats.woodDark);
  addSkirtingAndCornice(2.35, -3.09, 4.20, Math.PI / 2, mats.woodDark);
  addSkirtingAndCornice(0.32, -3.09, 1.72, Math.PI / 2, mats.woodDark);
  addSkirtingAndCornice(2.75, -1.75, 1.60, 0, mats.woodDark);
  addSkirtingAndCornice(2.15, 2.05, 1.60, 0, mats.woodDark);

  // Ceiling structural beams + T8 fluorescent batten light in Kitchen
  const kBeam1 = buildStructuralBeam(mats, 6.24);
  kBeam1.position.set(0, H - 0.10, 4.35);
  scene.add(kBeam1);
  const kBeam2 = buildStructuralBeam(mats, 6.24);
  kBeam2.position.set(0, H - 0.10, 1.62);
  scene.add(kBeam2);
  const kLight = buildTubeLightFixture(mats, false);
  kLight.position.set(0.0, H - 0.22, 4.45);
  scene.add(kLight);

  // Exposed PVC electrical conduit + 2-gang wall switch near red doorway
  const kConduit = buildConduitRun(mats, 1.58, true);
  kConduit.position.set(-3.09, 1.32, 3.22);
  kConduit.rotation.y = Math.PI / 2;
  scene.add(kConduit);
  const kSwitch = buildWallSwitch(mats);
  kSwitch.position.set(-3.09, 1.32, 3.22);
  kSwitch.rotation.y = Math.PI / 2;
  scene.add(kSwitch);

  // U-Shaped Concrete Countertop + Open Under-Counter Shelves + Corner Base Support
  addBox(0.68, 0.08, 1.75, -2.76, 0.86, 6.22, mats.counterConcrete);
  addBox(0.68, 0.84, 0.07, -2.76, 0.42, 5.38, mats.counterConcrete);
  addBox(5.15, 0.08, 0.68, 0, 0.86, 6.76, mats.counterConcrete);
  addBox(0.07, 0.84, 0.64, -1.35, 0.42, 6.76, mats.counterConcrete);
  addBox(0.07, 0.84, 0.64, 1.35, 0.42, 6.76, mats.counterConcrete);
  addBox(0.68, 0.08, 3.55, 2.76, 0.86, 5.22, mats.counterConcrete);
  addBox(0.68, 0.84, 0.08, 2.76, 0.42, 3.48, mats.counterConcrete);
  // Concrete plinth toe-kick under counters
  addBox(0.60, 0.06, 1.68, -2.76, 0.03, 6.22, mats.roughCement, false);
  addBox(5.05, 0.06, 0.60, 0, 0.03, 6.76, mats.roughCement, false);
  addBox(0.60, 0.06, 3.48, 2.76, 0.03, 5.22, mats.roughCement, false);
  // Under-counter steel rack shelves on right
  addBox(0.54, 0.02, 2.8, 2.76, 0.32, 5.0, mats.chromeSteel, false);
  // Jerrycan & pink flip-flops on kitchen floor
  addBox(0.24, 0.36, 0.18, 2.15, 0.18, 5.85, mats.matteWhite, false);
  const slipperMat = new THREE.MeshStandardMaterial({ color: 0xe64980, roughness: 0.7 });
  addBox(0.10, 0.02, 0.24, -0.45, 0.01, 3.3, slipperMat, false);
  addBox(0.10, 0.02, 0.24, -0.22, 0.01, 3.42, slipperMat, false);

  // Modular Furniture & Lived-In Props in Zone 1
  placeProp(buildDoubleSink(mats), -0.30, 0.90, 6.76, Math.PI);
  placeProp(buildWindowAndDishRack(mats), -0.30, 1.32, 7.06, 0);
  placeProp(buildGasStoveAndTank(mats), -2.76, 0, 6.18, 0);
  placeProp(buildKitchenRollingCart(mats), -2.52, 0, 5.02, 0.08, [0.46, 0.85, 0.36]);
  placeProp(buildBroomAndMop(mats), -2.96, 0, 3.38, Math.PI / 2);
  placeProp(buildKitchenCounterClutter(mats), 2.68, 0.90, 5.25, -Math.PI / 2);

  const exhaust = buildExhaustFan(mats);
  exhaust.position.set(-3.08, 2.12, 5.95);
  exhaust.rotation.y = Math.PI / 2;
  scene.add(exhaust);

  // Rear wooden door + hanging wok
  placeProp(buildDoorUnit(mats, 'wood_rear'), -3.09, 0, 4.10, Math.PI / 2);

  // Hanging glass-door cabinets + open spice rack on right & back-right
  const rightHang = buildHangingCabinet(mats, 2.55, true);
  rightHang.position.set(2.90, 2.02, 5.15);
  rightHang.rotation.y = -Math.PI / 2;
  scene.add(rightHang);

  const backHang = buildHangingCabinet(mats, 1.35, false);
  backHang.position.set(1.75, 2.02, 6.90);
  backHang.rotation.y = Math.PI;
  scene.add(backHang);

  // Purple rice cooker on right prep counter
  placeProp(buildRiceCooker(mats), 2.74, 0.90, 3.92, -Math.PI / 2);

  // Twin 2-tier white 2-door cabinets & Metallic grey 2-door fridge
  placeProp(buildDoubleWhiteCabinet(mats), 1.44, 0, 1.88, 0, [0.92, 1.95, 0.56]);
  placeProp(buildDoubleWhiteCabinet(mats), 2.38, 0, 1.88, 0, [0.92, 1.95, 0.56]);
  placeProp(buildFridge(mats, 'grey'), 2.72, 0, 2.72, -Math.PI / 2, [0.74, 1.76, 0.74]);

  // =========================================================================
  // ZON 2: RUANG TENGAH & KERJA (x: -1.6 .. 3.2, z: -5.8 .. 1.5)
  // =========================================================================
  addBox(4.8, 0.1, 7.3, 0.8, -0.05, -2.15, mats.terracottaGeo, false, false);
  addBox(4.8, 0.1, 7.3, 0.8, H + 0.05, -2.15, mats.creamPlaster, false, false);
  addBox(0.18, H, 7.3, 3.2, H / 2, -2.15, mats.creamPlaster);
  addBox(4.8, H, 0.18, 0.8, H / 2, -5.8, mats.creamPlaster);

  addSkirtingAndCornice(7.1, 3.09, -2.15, -Math.PI / 2);
  addSkirtingAndCornice(4.6, 0.8, -5.69, 0);
  addSkirtingAndCornice(2.75, -1.75, 1.40, Math.PI);
  addSkirtingAndCornice(2.15, 2.05, 1.40, Math.PI);

  // Structural ceiling beams + T8 light fixture in Middle Room
  const mBeam1 = buildStructuralBeam(mats, 4.65);
  mBeam1.position.set(0.8, H - 0.10, -2.2);
  scene.add(mBeam1);
  const mLight = buildTubeLightFixture(mats, true);
  mLight.position.set(0.65, H - 0.22, -2.2);
  mLight.rotation.y = Math.PI / 2;
  scene.add(mLight);

  // Lime-yellow textured pillar wall + 3D vertical wood slats + electrical switch & conduit
  addBox(1.15, H, 0.22, -0.95, H / 2, -1.15, mats.limePlaster);
  addSkirtingAndCornice(1.15, -0.95, -1.03, 0);
  const pillarFluted = buildFlutedWallPanel(mats, 0.42, H, 0.038);
  pillarFluted.position.set(-1.32, 0, -1.03);
  scene.add(pillarFluted);
  const mConduit = buildConduitRun(mats, 1.58, true);
  mConduit.position.set(-0.62, 1.32, -1.03);
  scene.add(mConduit);
  const sw = buildWallSwitch(mats);
  sw.position.set(-0.62, 1.32, -1.02);
  scene.add(sw);

  // Glossy black fridge & Folding marble table with cross steel legs
  placeProp(buildFridge(mats, 'black'), -0.95, 0, -1.72, Math.PI, [0.74, 1.76, 0.74]);
  placeProp(buildFoldingMarbleTable(mats), -0.95, 0, -0.60, 0, [0.98, 0.80, 0.64]);

  // 3x3 Wooden Bookshelf filled with 3D books + White storage cupboard
  placeProp(buildBookshelfWithBooks(mats), 0.35, 0, -5.50, 0, [1.20, 1.85, 0.40]);
  placeProp(buildDoubleWhiteCabinet(mats), -0.78, 0, -5.42, 0, [0.92, 1.95, 0.54]);

  // Work Desk with Laptop, Printer, Files, Office Chair
  placeProp(buildWorkDeskSet(mats), 2.02, 0, -4.65, 0, [1.54, 1.0, 0.74]);

  // Back window with sine-wave white curtain + 3D Air Conditioner above
  const middleCurtain = buildCurtainWindowSet(mats, 1.55, 1.48, false);
  middleCurtain.position.set(2.05, 1.42, -5.65);
  scene.add(middleCurtain);
  if (middleCurtain.getObjectByName('curtainSheer')) {
    curtainMeshes.push(middleCurtain.getObjectByName('curtainSheer') as THREE.Mesh);
  }
  const ac = buildAirConditioner(mats);
  ac.position.set(2.05, 2.52, -5.56);
  scene.add(ac);

  // Dark wood cabinet + glass-panel microwave + tiffin carrier + 2x2 wall pictures + Grey bathroom door
  placeProp(buildMicrowaveCabinet(mats), 2.82, 0, 0.62, -Math.PI / 2, [0.52, 1.25, 0.98]);
  const pics = buildFramedPictureGrid(mats);
  pics.position.set(3.09, 1.72, -1.68);
  pics.rotation.y = -Math.PI / 2;
  scene.add(pics);
  placeProp(buildDoorUnit(mats, 'grey_bath'), 3.09, 0, -0.58, -Math.PI / 2);

  // =========================================================================
  // ZON 3: RUANG TAMU UTAMA (x: -6.8 .. -1.6, z: -6.6 .. -1.0)
  // =========================================================================
  addBox(5.2, 0.1, 5.6, -4.2, -0.05, -3.8, mats.livingTile, false, false);
  addBox(5.2, 0.1, 5.6, -4.2, H + 0.05, -3.8, mats.creamPlaster, false, false);

  // Stepped Tray Ceiling + Downlights + Central Chandelier
  scene.add(buildTrayCeilingAndChandelier(mats));

  // Marble archway separating Zone 2 & Zone 3 (x = -1.6)
  addBox(0.22, H, 1.4, -1.6, H / 2, -5.9, mats.marble);
  addBox(0.22, H, 0.6, -1.6, H / 2, -1.3, mats.marble);
  addBox(0.22, 0.52, 3.6, -1.6, H - 0.26, -3.4, mats.marble, false);

  // Front Wall (x = -6.8): Woven Tropical Leaf Wallpaper + 3D Fluted Panels + Main Dark Door + 2-Layer Curtains
  addBox(0.18, H, 5.6, -6.8, H / 2, -3.8, mats.leafWallpaper);
  // Lime accent section around main front door
  addBox(0.04, H, 1.40, -6.69, H / 2, -1.72, mats.limePlaster, false);
  placeProp(buildDoorUnit(mats, 'main_front'), -6.66, 0, -1.72, Math.PI / 2);

  // True 3D Fluted Wall Panels flanking window
  const frontFluted1 = buildFlutedWallPanel(mats, 0.56, H);
  frontFluted1.position.set(-6.70, 0, -2.72);
  frontFluted1.rotation.y = Math.PI / 2;
  scene.add(frontFluted1);

  const frontFluted2 = buildFlutedWallPanel(mats, 0.56, H);
  frontFluted2.position.set(-6.70, 0, -5.12);
  frontFluted2.rotation.y = Math.PI / 2;
  scene.add(frontFluted2);

  // Two-layer sine-wave curtain window on front wall
  const frontCurtain = buildCurtainWindowSet(mats, 1.85, 1.72, true);
  frontCurtain.position.set(-6.64, 1.48, -3.92);
  frontCurtain.rotation.y = Math.PI / 2;
  scene.add(frontCurtain);
  if (frontCurtain.getObjectByName('curtainSheer')) {
    curtainMeshes.push(frontCurtain.getObjectByName('curtainSheer') as THREE.Mesh);
  }

  // Left Wall (z = -6.6): Leaf wallpaper + 2nd two-layer curtain window
  addBox(5.2, H, 0.18, -4.2, H / 2, -6.6, mats.leafWallpaper);
  const sideCurtain = buildCurtainWindowSet(mats, 1.70, 1.60, true);
  sideCurtain.position.set(-5.30, 1.50, -6.45);
  scene.add(sideCurtain);
  if (sideCurtain.getObjectByName('curtainSheer')) {
    curtainMeshes.push(sideCurtain.getObjectByName('curtainSheer') as THREE.Mesh);
  }

  // TV Wall (z = -1.0): Marble TV feature wall + Floating cabinet + Flat TV + PC Desk + Chair + Subwoofer + Plant
  addBox(5.2, H, 0.18, -4.2, H / 2, -1.0, mats.creamPlaster);
  placeProp(buildTVFeatureWallSet(mats), -4.55, 0, -1.09, 0);
  colliders.push(new THREE.Box3(new THREE.Vector3(-5.5, 0, -1.52), new THREE.Vector3(-3.6, 1.0, -1.05)));
  colliders.push(new THREE.Box3(new THREE.Vector3(-3.2, 0, -1.92), new THREE.Vector3(-2.05, 0.9, -1.05)));

  // Skirting & Cornices in Living Room
  addSkirtingAndCornice(5.4, -6.69, -3.8, Math.PI / 2);
  addSkirtingAndCornice(5.0, -4.2, -6.49, 0);
  addSkirtingAndCornice(5.0, -4.2, -1.11, Math.PI);

  // Long Sofa facing TV + 2 Carved Wooden Armchairs with Brown Cushions
  placeProp(buildLongSofa(mats), -3.55, 0, -5.85, 0, [2.26, 0.92, 0.90]);
  placeProp(buildCarvedWoodChair(mats), -6.10, 0, -5.85, Math.PI / 2, [0.64, 0.92, 0.64]);
  placeProp(buildCarvedWoodChair(mats), -6.10, 0, -4.85, Math.PI / 2, [0.64, 0.92, 0.64]);

  // =========================================================================
  // ZON 4: KORIDOR TEPI & BILIK AIR BELAKANG (x: -5.8 .. -3.2, z: 1.6 .. 7.2)
  // =========================================================================
  addBox(2.6, 0.1, 5.6, -4.5, -0.05, 4.4, mats.greyWood, false, false);
  addBox(2.6, 0.1, 5.6, -4.5, H + 0.05, 4.4, mats.creamPlaster, false, false);
  addBox(0.18, H, 5.6, -5.8, H / 2, 4.4, mats.roughCement);
  addBox(2.6, H, 0.18, -4.5, H / 2, 1.6, mats.roughCement);
  addBox(2.6, H, 0.18, -4.5, H / 2, 7.2, mats.roughCement);

  // Skirting, ceiling structural beams & T8 batten light in Corridor
  addSkirtingAndCornice(5.4, -5.69, 4.4, Math.PI / 2, mats.woodDark);
  addSkirtingAndCornice(2.4, -4.5, 1.70, 0, mats.woodDark);
  addSkirtingAndCornice(2.4, -4.5, 7.10, Math.PI, mats.woodDark);
  const cBeam1 = buildStructuralBeam(mats, 2.5);
  cBeam1.position.set(-4.5, H - 0.10, 3.2);
  scene.add(cBeam1);
  const cBeam2 = buildStructuralBeam(mats, 2.5);
  cBeam2.position.set(-4.5, H - 0.10, 5.45);
  scene.add(cBeam2);
  const cLight = buildTubeLightFixture(mats, true);
  cLight.position.set(-4.5, H - 0.22, 4.1);
  cLight.rotation.y = Math.PI / 2;
  scene.add(cLight);

  // Exposed PVC water pipe + saddle clips along rough cement corridor wall
  const pipeMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 4.8, 12), mats.matteWhite);
  pipeMesh.rotation.x = Math.PI / 2;
  pipeMesh.position.set(-5.68, 0.55, 4.4);
  scene.add(pipeMesh);
  for (let pz = 2.2; pz <= 6.6; pz += 0.9) {
    addBox(0.04, 0.03, 0.02, -5.69, 0.55, pz, mats.chromeSteel, false, false);
  }

  // Tubular steel folding chair in corridor
  placeProp(buildFoldingSteelChair(mats), -4.95, 0, 3.25, Math.PI / 3, [0.46, 0.9, 0.48]);

  // Half-height concrete wash-area partition wall (z = 5.45) with entry opening x = -4.25 .. -3.2 + top cap
  addBox(1.55, 1.88, 0.14, -5.02, 0.94, 5.45, mats.roughCement);
  addBox(1.58, 0.04, 0.18, -5.02, 1.90, 5.45, mats.counterConcrete, false);
  // Concrete floor curb inside back wash area
  addBox(2.4, 0.04, 1.65, -4.5, 0.02, 6.32, mats.roughCement, false, false);
  // Red plastic bucket, blue basin & wall water tap
  placeProp(buildRedBucketAndTap(mats), -4.65, 0.04, 6.72, 0, [0.45, 0.55, 0.45]);

  // Ensure uv2 exists across meshes for aoMap compatibility
  scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh && mesh.geometry) {
      const uv = mesh.geometry.attributes.uv;
      if (uv && !mesh.geometry.attributes.uv2) {
        mesh.geometry.setAttribute('uv2', uv);
      }
    }
  });

  return {
    colliders,
    curtainMeshes,
    disposeGeometries: () => {
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.isMesh && mesh.geometry) {
          mesh.geometry.dispose();
        }
      });
    },
  };
}
