import * as THREE from 'three';
import { HouseMaterialPalette } from './materials';

function createRoundedRectShape(w: number, h: number, r: number): THREE.Shape {
  const s = new THREE.Shape();
  const hw = w / 2;
  const hh = h / 2;
  const rad = Math.min(r, hw * 0.45, hh * 0.45);
  s.moveTo(-hw + rad, -hh);
  s.lineTo(hw - rad, -hh);
  s.quadraticCurveTo(hw, -hh, hw, -hh + rad);
  s.lineTo(hw, hh - rad);
  s.quadraticCurveTo(hw, hh, hw - rad, hh);
  s.lineTo(-hw + rad, hh);
  s.quadraticCurveTo(-hw, hh, -hw, hh - rad);
  s.lineTo(-hw, -hh + rad);
  s.quadraticCurveTo(-hw, -hh, -hw + rad, -hh);
  return s;
}

export function createRoundedBoxGeometry(
  w: number,
  h: number,
  d: number,
  radius = 0.03,
  bevel = 0.012
): THREE.ExtrudeGeometry {
  const shape = createRoundedRectShape(w - bevel * 2, d - bevel * 2, radius);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.005, h - bevel * 2),
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments: 8,
  });
  geo.rotateX(-Math.PI / 2);
  geo.center();
  return geo;
}

function createSineCurtainGeometry(
  width: number,
  height: number,
  folds = 14,
  depth = 0.045
): THREE.BufferGeometry {
  const segX = 48;
  const segY = 12;
  const geo = new THREE.PlaneGeometry(width, height, segX, segY);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const normX = (x + width / 2) / width;
    const normY = (height / 2 - y) / height;
    const wave = Math.sin(normX * Math.PI * 2 * folds) * depth * (0.45 + 0.55 * normY);
    pos.setZ(i, wave);
  }
  geo.computeVertexNormals();
  return geo;
}

function addShadowMesh(
  parent: THREE.Group,
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  x: number,
  y: number,
  z: number,
  cast = true,
  receive = true
): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = cast;
  m.receiveShadow = receive;
  parent.add(m);
  return m;
}

export function addContactShadow(
  parent: THREE.Group,
  w: number,
  d: number,
  mats: HouseMaterialPalette,
  x = 0,
  z = 0,
  y = 0.003
): void {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mats.contactShadow);
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, y, z);
  m.renderOrder = 1;
  parent.add(m);
}

// 1. ZON 1: Sinki Berkembar Berlekuk Dalam + Kepala Paip Melengkung
export function buildDoubleSink(mats: HouseMaterialPalette): THREE.Group {
  const g = new THREE.Group();
  const darkInner = new THREE.MeshStandardMaterial({ color: 0x262b30, roughness: 0.35, metalness: 0.78 });

  // Outer stainless flange
  addShadowMesh(g, new THREE.BoxGeometry(1.18, 0.028, 0.50), mats.chromeSteel, 0, 0.014, 0, true, true);
  // Left & Right raised rims + center divider
  addShadowMesh(g, new THREE.BoxGeometry(0.06, 0.04, 0.50), mats.chromeSteel, -0.56, 0.02, 0);
  addShadowMesh(g, new THREE.BoxGeometry(0.06, 0.04, 0.50), mats.chromeSteel, 0.56, 0.02, 0);
  addShadowMesh(g, new THREE.BoxGeometry(0.07, 0.036, 0.44), mats.chromeSteel, 0, 0.018, 0);

  // Two recessed basin interiors (dark metallic depth illusion + drain rings)
  for (const sx of [-0.27, 0.27]) {
    addShadowMesh(g, new THREE.BoxGeometry(0.46, 0.17, 0.38), mats.chromeSteel, sx, -0.07, 0, false, true);
    addShadowMesh(g, new THREE.BoxGeometry(0.43, 0.01, 0.35), darkInner, sx, -0.02, 0, false, true);
    const drain = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.012, 16), mats.blackIron);
    drain.position.set(sx, -0.012, 0);
    g.add(drain);
  }

  // Curved Gooseneck Faucet (TubeGeometry) + base + lever handle
  addShadowMesh(g, new THREE.CylinderGeometry(0.028, 0.034, 0.04, 16), mats.chromeSteel, 0, 0.04, 0.19);
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.04, 0.19),
    new THREE.Vector3(0, 0.24, 0.18),
    new THREE.Vector3(0, 0.32, 0.09),
    new THREE.Vector3(0, 0.26, 0.01),
    new THREE.Vector3(0, 0.21, -0.01),
  ]);
  addShadowMesh(g, new THREE.TubeGeometry(curve, 24, 0.013, 12, false), mats.chromeSteel, 0, 0, 0);
  // Aerator nozzle
  addShadowMesh(g, new THREE.CylinderGeometry(0.017, 0.015, 0.025, 14), mats.blackIron, 0, 0.20, -0.01);
  // Lever handle
  const lever = addShadowMesh(g, new THREE.CylinderGeometry(0.008, 0.008, 0.09, 10), mats.chromeSteel, 0.045, 0.075, 0.19);
  lever.rotation.z = -Math.PI / 3;

  return g;
}

// 2. ZON 1: Dapur Gas 2 Tungku Lengkap Jeriji & Tombol + Tong Gas Hijau Bersalur Paip
export function buildGasStoveAndTank(mats: HouseMaterialPalette): THREE.Group {
  const g = new THREE.Group();
  const potMat = new THREE.MeshStandardMaterial({ color: 0x383d42, roughness: 0.35, metalness: 0.72 });
  const burnerMat = new THREE.MeshStandardMaterial({ color: 0xb28a52, roughness: 0.4, metalness: 0.75 });

  // Stove body (sits on counter top y = 0.90)
  addShadowMesh(g, createRoundedBoxGeometry(0.46, 0.09, 0.76, 0.02, 0.008), mats.chromeSteel, 0, 0.945, 0);
  addShadowMesh(g, new THREE.BoxGeometry(0.44, 0.015, 0.74), mats.blackIron, 0, 0.992, 0);

  // 2 Burners + 4-prong grates + 2 front rotary knobs
  for (const bz of [-0.19, 0.19]) {
    addShadowMesh(g, new THREE.CylinderGeometry(0.072, 0.082, 0.016, 20), burnerMat, 0, 1.005, bz);
    addShadowMesh(g, new THREE.TorusGeometry(0.095, 0.009, 8, 20), mats.blackIron, 0, 1.012, bz).rotation.x = Math.PI / 2;
    for (let k = 0; k < 4; k++) {
      const ang = (k * Math.PI) / 2 + Math.PI / 4;
      const prong = addShadowMesh(g, new THREE.BoxGeometry(0.085, 0.016, 0.012), mats.blackIron, Math.cos(ang) * 0.075, 1.022, bz + Math.sin(ang) * 0.075);
      prong.rotation.y = -ang;
    }
    // Control knob on front face (+X side facing kitchen interior)
    addShadowMesh(g, new THREE.CylinderGeometry(0.022, 0.024, 0.024, 16), mats.blackIron, 0.238, 0.945, bz).rotation.z = Math.PI / 2;
    addShadowMesh(g, new THREE.BoxGeometry(0.01, 0.032, 0.008), mats.chromeSteel, 0.252, 0.945, bz);
  }

  // Wok pan sitting on left burner
  const wokPts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.08, 0.008),
    new THREE.Vector2(0.145, 0.045),
    new THREE.Vector2(0.17, 0.085),
    new THREE.Vector2(0.165, 0.088),
    new THREE.Vector2(0.14, 0.048),
    new THREE.Vector2(0.0, 0.012),
  ];
  addShadowMesh(g, new THREE.LatheGeometry(wokPts, 24), potMat, 0, 1.028, -0.19);
  addShadowMesh(g, new THREE.CylinderGeometry(0.011, 0.013, 0.16, 10), mats.blackIron, 0.21, 1.11, -0.19).rotation.z = Math.PI / 2.6;

  // Green LPG Gas Cylinder underneath counter (y = 0)
  const tankPts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.145, 0.0),
    new THREE.Vector2(0.145, 0.04),
    new THREE.Vector2(0.165, 0.07),
    new THREE.Vector2(0.165, 0.38),
    new THREE.Vector2(0.13, 0.45),
    new THREE.Vector2(0.045, 0.48),
    new THREE.Vector2(0.045, 0.51),
    new THREE.Vector2(0.0, 0.51),
  ];
  addShadowMesh(g, new THREE.LatheGeometry(tankPts, 24), mats.lpgGreen, 0.02, 0, 0.42);
  // Protective top collar ring
  addShadowMesh(g, new THREE.CylinderGeometry(0.09, 0.10, 0.09, 18, 1, true), mats.lpgGreen, 0.02, 0.515, 0.42);
  // Brass regulator
  addShadowMesh(g, new THREE.CylinderGeometry(0.024, 0.024, 0.055, 14), mats.brassGold, 0.02, 0.535, 0.42);
  // Curved rubber gas hose from regulator up to stove
  const hoseCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.02, 0.54, 0.42),
    new THREE.Vector3(-0.14, 0.65, 0.44),
    new THREE.Vector3(-0.18, 0.80, 0.28),
    new THREE.Vector3(-0.16, 0.92, 0.16),
  ]);
  addShadowMesh(g, new THREE.TubeGeometry(hoseCurve, 24, 0.011, 10, false), mats.blackIron, 0, 0, 0);

  return g;
}

// 3. ZON 1: Tingkap Gelangsar Kaca Gelap + Rak Pinggan Besi Hitam 2 Tingkat
export function buildWindowAndDishRack(mats: HouseMaterialPalette): THREE.Group {
  const g = new THREE.Group();
  const plateMat = new THREE.MeshStandardMaterial({ color: 0xf7f8f6, roughness: 0.18, metalness: 0.04 });
  const bowlMat = new THREE.MeshStandardMaterial({ color: 0x8e56b5, roughness: 0.3, metalness: 0.05 });

  // Sliding dark-glass window frame (1.9m wide x 1.15m tall)
  addShadowMesh(g, new THREE.BoxGeometry(1.94, 0.05, 0.09), mats.blackIron, 0, 1.15, 0);
  addShadowMesh(g, new THREE.BoxGeometry(1.94, 0.05, 0.09), mats.blackIron, 0, 0.025, 0);
  addShadowMesh(g, new THREE.BoxGeometry(0.05, 1.15, 0.09), mats.blackIron, -0.945, 0.59, 0);
  addShadowMesh(g, new THREE.BoxGeometry(0.05, 1.15, 0.09), mats.blackIron, 0.945, 0.59, 0);
  // Dual sliding glass panes + vertical mullion stiles
  addShadowMesh(g, new THREE.BoxGeometry(0.92, 1.06, 0.016), mats.darkGlass, -0.45, 0.59, 0.015, false, true);
  addShadowMesh(g, new THREE.BoxGeometry(0.92, 1.06, 0.016), mats.darkGlass, 0.45, 0.59, -0.015, false, true);
  addShadowMesh(g, new THREE.BoxGeometry(0.035, 1.08, 0.04), mats.chromeSteel, 0.0, 0.59, 0);

  // 2-Tier Black Metal Dish Rack mounted in front of window (-Z inside kitchen)
  const rackZ = -0.18;
  for (const rx of [-0.84, 0.84]) {
    for (const rz of [rackZ - 0.13, rackZ + 0.13]) {
      addShadowMesh(g, new THREE.CylinderGeometry(0.014, 0.014, 0.88, 10), mats.blackIron, rx, 0.24, rz);
    }
  }
  // 2 slatted tiers
  for (const ty of [-0.08, 0.34]) {
    addShadowMesh(g, new THREE.BoxGeometry(1.72, 0.02, 0.28), mats.blackIron, 0, ty, rackZ);
    for (let sx = -0.76; sx <= 0.76; sx += 0.14) {
      addShadowMesh(g, new THREE.BoxGeometry(0.01, 0.012, 0.26), mats.blackIron, sx, ty + 0.012, rackZ);
    }
  }
  // Upright plates on upper tier
  for (let i = 0; i < 8; i++) {
    const px = -0.62 + i * 0.075;
    const plate = addShadowMesh(g, new THREE.CylinderGeometry(0.11, 0.11, 0.014, 20), plateMat, px, 0.46, rackZ);
    plate.rotation.z = Math.PI / 2 - 0.14;
  }
  // Stacked bowls & pot lid on lower/right tier
  for (let i = 0; i < 4; i++) {
    const px = 0.25 + i * 0.15;
    addShadowMesh(g, new THREE.CylinderGeometry(0.07, 0.04, 0.06, 16), i % 2 === 0 ? bowlMat : plateMat, px, 0.38, rackZ);
    addShadowMesh(g, new THREE.CylinderGeometry(0.08, 0.05, 0.07, 16), plateMat, px - 0.55, -0.03, rackZ);
  }

  return g;
}

// 4. ZON 1: Kabinet Gantung Berbingkai Putih & Pintu Kaca Gelap + Rak Rempah Terbuka
export function buildHangingCabinet(mats: HouseMaterialPalette, width = 2.4, withOpenSpiceRack = true): THREE.Group {
  const g = new THREE.Group();
  const h = 0.88;
  const d = 0.36;
  const closedW = withOpenSpiceRack ? width * 0.68 : width;
  const openW = width - closedW;

  // Main white carcass
  const cx = withOpenSpiceRack ? openW / 2 : 0;
  addShadowMesh(g, new THREE.BoxGeometry(closedW, h, d), mats.matteWhite, cx, 0, 0);
  // Divider & 2 dark reflective glass doors
  const doorW = (closedW - 0.06) / 2;
  for (const side of [-1, 1]) {
    const dx = cx + side * (doorW / 2 + 0.012);
    // White frame around glass
    addShadowMesh(g, new THREE.BoxGeometry(doorW, h - 0.04, 0.022), mats.matteWhite, dx, 0, d / 2 + 0.008);
    // Dark glass panel
    addShadowMesh(g, new THREE.BoxGeometry(doorW - 0.07, h - 0.12, 0.016), mats.darkGlass, dx, 0, d / 2 + 0.018);
    // Vertical silver handle
    addShadowMesh(g, new THREE.CylinderGeometry(0.007, 0.007, 0.16, 10), mats.chromeSteel, dx - side * (doorW / 2 - 0.045), -0.14, d / 2 + 0.035);
    // Hinges
    addShadowMesh(g, new THREE.BoxGeometry(0.018, 0.045, 0.012), mats.chromeSteel, dx + side * (doorW / 2 - 0.01), 0.28, d / 2 + 0.022);
    addShadowMesh(g, new THREE.BoxGeometry(0.018, 0.045, 0.012), mats.chromeSteel, dx + side * (doorW / 2 - 0.01), -0.28, d / 2 + 0.022);
  }

  // Open side shelf with spice jars & sauce bottles
  if (withOpenSpiceRack && openW > 0.25) {
    const ox = -width / 2 + openW / 2;
    addShadowMesh(g, new THREE.BoxGeometry(openW, 0.024, d), mats.matteWhite, ox, -h / 2 + 0.012, 0);
    addShadowMesh(g, new THREE.BoxGeometry(openW, 0.024, d), mats.matteWhite, ox, 0.0, 0);
    addShadowMesh(g, new THREE.BoxGeometry(openW, 0.024, d), mats.matteWhite, ox, h / 2 - 0.012, 0);
    addShadowMesh(g, new THREE.BoxGeometry(0.024, h, d), mats.matteWhite, ox - openW / 2 + 0.012, 0, 0);

    const jarColors = [0xd97b29, 0x3b8c52, 0xc93b3b, 0x7b4ca8, 0xe2b73b];
    for (let row = 0; row < 2; row++) {
      const baseY = row === 0 ? -h / 2 + 0.024 : 0.012;
      for (let j = 0; j < 5; j++) {
        const jx = ox - openW / 2 + 0.09 + j * ((openW - 0.16) / 4.5);
        const jMat = new THREE.MeshStandardMaterial({ color: jarColors[(j + row) % jarColors.length], roughness: 0.25 });
        const jh = 0.14 + (j % 3) * 0.04;
        addShadowMesh(g, new THREE.CylinderGeometry(0.032, 0.034, jh, 12), jMat, jx, baseY + jh / 2, 0.04);
        addShadowMesh(g, new THREE.CylinderGeometry(0.024, 0.024, 0.02, 12), mats.matteWhite, jx, baseY + jh + 0.01, 0.04);
      }
    }
  }

  return g;
}

// 5. ZON 1 & 2: Almari Putih 2-Tingkat Berpintu & Pemegang Aluminium
export function buildDoubleWhiteCabinet(mats: HouseMaterialPalette): THREE.Group {
  const g = new THREE.Group();
  const w = 0.90;
  const h = 1.94;
  const d = 0.52;

  addContactShadow(g, w + 0.24, d + 0.24, mats);
  // Plinth base
  addShadowMesh(g, new THREE.BoxGeometry(w - 0.04, 0.08, d - 0.04), mats.matteWhite, 0, 0.04, 0);
  // Main cabinet body
  addShadowMesh(g, new THREE.BoxGeometry(w, h - 0.08, d), mats.matteWhite, 0, 0.08 + (h - 0.08) / 2, 0);

  // 4 Doors (2 upper + 2 lower) with recessed gap seams & vertical bar handles
  for (const tierY of [0.54, 1.46]) {
    const tierH = 0.86;
    for (const side of [-1, 1]) {
      const dx = side * 0.22;
      addShadowMesh(g, new THREE.BoxGeometry(0.425, tierH, 0.02), mats.matteWhite, dx, tierY, d / 2 + 0.012);
      // Aluminum bar handle near center seam
      addShadowMesh(g, new THREE.BoxGeometry(0.018, 0.16, 0.026), mats.chromeSteel, side * 0.045, tierY, d / 2 + 0.032);
    }
  }

  // Storage box & thermos resting on top of cupboard
  const boxMat = new THREE.MeshStandardMaterial({ color: 0x3a4a5e, roughness: 0.65 });
  addShadowMesh(g, new THREE.BoxGeometry(0.36, 0.24, 0.34), boxMat, -0.18, h + 0.12, 0);
  addShadowMesh(g, new THREE.CylinderGeometry(0.09, 0.09, 0.26, 16), mats.chromeSteel, 0.22, h + 0.13, 0.04);

  return g;
}

// 6. ZON 1 & 2: Peti Sejuk 2 Pintu (Kelabu Metalik / Hitam Berkilat)
export function buildFridge(mats: HouseMaterialPalette, variant: 'grey' | 'black'): THREE.Group {
  const g = new THREE.Group();
  const bodyMat = variant === 'grey' ? mats.fridgeGrey : mats.blackIron;
  const w = 0.72;
  const h = 1.74;
  const d = 0.68;

  addContactShadow(g, w + 0.26, d + 0.26, mats);
  // 4 leveling feet
  for (const fx of [-w / 2 + 0.06, w / 2 - 0.06]) {
    for (const fz of [-d / 2 + 0.06, d / 2 - 0.06]) {
      addShadowMesh(g, new THREE.CylinderGeometry(0.028, 0.024, 0.04, 10), mats.blackIron, fx, 0.02, fz);
    }
  }

  // Main rounded body
  addShadowMesh(g, createRoundedBoxGeometry(w, h - 0.04, d, 0.025, 0.01), bodyMat, 0, 0.04 + (h - 0.04) / 2, 0);
  // Upper freezer door & lower fridge door
  addShadowMesh(g, createRoundedBoxGeometry(w - 0.02, 0.52, 0.045, 0.015, 0.006), bodyMat, 0, 1.44, d / 2 + 0.02);
  addShadowMesh(g, createRoundedBoxGeometry(w - 0.02, 1.10, 0.045, 0.015, 0.006), bodyMat, 0, 0.61, d / 2 + 0.02);

  // Recessed chrome pocket handles + top hinge cap + energy sticker
  addShadowMesh(g, new THREE.BoxGeometry(0.026, 0.22, 0.018), mats.chromeSteel, w / 2 - 0.06, 1.32, d / 2 + 0.045);
  addShadowMesh(g, new THREE.BoxGeometry(0.026, 0.36, 0.018), mats.chromeSteel, w / 2 - 0.06, 0.94, d / 2 + 0.045);
  addShadowMesh(g, new THREE.BoxGeometry(0.07, 0.03, 0.06), mats.blackIron, -w / 2 + 0.05, h + 0.015, d / 2 - 0.02);

  // Energy label badge
  const badgeMat = new THREE.MeshStandardMaterial({ color: 0xe68a2e, roughness: 0.4 });
  addShadowMesh(g, new THREE.BoxGeometry(0.08, 0.11, 0.005), badgeMat, -0.18, 1.50, d / 2 + 0.046);

  // Patterned cloth cover on black fridge in Zone 2
  if (variant === 'black') {
    addShadowMesh(g, new THREE.BoxGeometry(w + 0.04, 0.014, d + 0.04), mats.matteWhite, 0, h + 0.007, 0);
  }

  return g;
}

// 7. Pintu Kayu / Pintu Bilik Air + Kusen + Engsel + Tombol + Kuali Tergantung
export function buildDoorUnit(
  mats: HouseMaterialPalette,
  type: 'wood_rear' | 'main_front' | 'grey_bath'
): THREE.Group {
  const g = new THREE.Group();
  const w = 0.94;
  const h = 2.12;
  const doorMat =
    type === 'wood_rear'
      ? mats.woodMedium
      : type === 'main_front'
      ? mats.woodDark
      : mats.greyDoor;

  // Outer door frame (jambs + header)
  addShadowMesh(g, new THREE.BoxGeometry(0.06, h, 0.14), doorMat, -w / 2, h / 2, 0);
  addShadowMesh(g, new THREE.BoxGeometry(0.06, h, 0.14), doorMat, w / 2, h / 2, 0);
  addShadowMesh(g, new THREE.BoxGeometry(w + 0.06, 0.06, 0.14), doorMat, 0, h + 0.02, 0);

  // Door leaf
  addShadowMesh(g, new THREE.BoxGeometry(w - 0.04, h - 0.02, 0.048), doorMat, 0, h / 2, 0);

  // 6 Recessed/raised panels
  for (const py of [0.46, 1.08, 1.68]) {
    for (const px of [-0.21, 0.21]) {
      addShadowMesh(g, new THREE.BoxGeometry(0.28, 0.42, 0.064), doorMat, px, py, 0);
    }
  }

  // Hinges + Brass/Steel doorknob
  for (const hy of [0.35, 1.05, 1.75]) {
    addShadowMesh(g, new THREE.CylinderGeometry(0.009, 0.009, 0.08, 10), mats.chromeSteel, -w / 2 + 0.03, hy, 0.03);
  }
  addShadowMesh(g, new THREE.CylinderGeometry(0.028, 0.028, 0.02, 16), mats.brassGold, w / 2 - 0.11, 1.02, 0.032).rotation.x = Math.PI / 2;
  addShadowMesh(g, new THREE.SphereGeometry(0.028, 14, 14), mats.brassGold, w / 2 - 0.11, 1.02, 0.065);
  addShadowMesh(g, new THREE.SphereGeometry(0.028, 14, 14), mats.brassGold, w / 2 - 0.11, 1.02, -0.065);

  // Kitchen rear door extras: zig-zag wooden hanger + hanging wok & towel
  if (type === 'wood_rear') {
    addShadowMesh(g, new THREE.BoxGeometry(0.76, 0.04, 0.025), mats.woodTeak, 0, 1.88, 0.04);
    const wokPts = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.11, 0.015),
      new THREE.Vector2(0.20, 0.06),
      new THREE.Vector2(0.23, 0.10),
    ];
    const wok = addShadowMesh(g, new THREE.LatheGeometry(wokPts, 24), mats.chromeSteel, 0.04, 1.55, 0.08);
    wok.rotation.x = Math.PI / 2;
    addShadowMesh(g, new THREE.CylinderGeometry(0.012, 0.014, 0.20, 10), mats.blackIron, 0.04, 1.84, 0.06);
    // Hanging kitchen towel
    const towelMat = new THREE.MeshStandardMaterial({ color: 0xe8e2b8, roughness: 0.85 });
    addShadowMesh(g, new THREE.BoxGeometry(0.16, 0.44, 0.016), towelMat, -0.26, 1.58, 0.048);
  }

  return g;
}

// 8. ZON 1: Lubang Ekzos Bulat Dinding Kiri
export function buildExhaustFan(mats: HouseMaterialPalette): THREE.Group {
  const g = new THREE.Group();
  addShadowMesh(g, new THREE.CylinderGeometry(0.24, 0.24, 0.05, 28), mats.matteWhite, 0, 0, 0).rotation.x = Math.PI / 2;
  addShadowMesh(g, new THREE.CylinderGeometry(0.19, 0.19, 0.06, 24), mats.blackIron, 0, 0, 0.005).rotation.x = Math.PI / 2;
  addShadowMesh(g, new THREE.CylinderGeometry(0.045, 0.045, 0.07, 16), mats.chromeSteel, 0, 0, 0.01).rotation.x = Math.PI / 2;
  for (let i = 0; i < 5; i++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.15, 0.008), mats.fridgeGrey);
    const a = (i * Math.PI * 2) / 5;
    blade.position.set(Math.cos(a) * 0.10, Math.sin(a) * 0.10, 0.015);
    blade.rotation.z = a;
    blade.rotation.y = 0.35;
    g.add(blade);
  }
  for (let y = -0.15; y <= 0.15; y += 0.05) {
    addShadowMesh(g, new THREE.BoxGeometry(0.36, 0.008, 0.01), mats.matteWhite, 0, y, 0.035);
  }
  return g;
}

// 9. ZON 1: Periuk Nasi Ungu
export function buildRiceCooker(mats: HouseMaterialPalette): THREE.Group {
  const g = new THREE.Group();
  addShadowMesh(g, new THREE.CylinderGeometry(0.145, 0.135, 0.19, 24), mats.ricePurple, 0, 0.095, 0);
  addShadowMesh(g, new THREE.CylinderGeometry(0.135, 0.145, 0.04, 24), mats.matteWhite, 0, 0.21, 0);
  addShadowMesh(g, new THREE.CylinderGeometry(0.032, 0.032, 0.02, 14), mats.chromeSteel, 0.04, 0.235, 0);
  // Front control panel + handles
  addShadowMesh(g, new THREE.BoxGeometry(0.07, 0.08, 0.015), mats.matteWhite, 0, 0.09, 0.14);
  for (const sx of [-0.155, 0.155]) {
    addShadowMesh(g, new THREE.BoxGeometry(0.035, 0.02, 0.05), mats.blackIron, sx, 0.15, 0);
  }
  return g;
}

// 10. ZON 2: Meja Lipat Marmar Berkaki Besi Silang
export function buildFoldingMarbleTable(mats: HouseMaterialPalette): THREE.Group {
  const g = new THREE.Group();
  addContactShadow(g, 1.15, 0.82, mats);
  // Beveled marble top
  addShadowMesh(g, createRoundedBoxGeometry(0.96, 0.042, 0.62, 0.02, 0.006), mats.marble, 0, 0.76, 0);
  addShadowMesh(g, new THREE.BoxGeometry(0.88, 0.025, 0.54), mats.blackIron, 0, 0.728, 0);

  // X-cross tubular steel legs on left & right
  for (const sx of [-0.36, 0.36]) {
    const leg1 = addShadowMesh(g, new THREE.CylinderGeometry(0.015, 0.015, 0.86, 12), mats.chromeSteel, sx, 0.37, 0);
    leg1.rotation.x = 0.55;
    const leg2 = addShadowMesh(g, new THREE.CylinderGeometry(0.015, 0.015, 0.86, 12), mats.chromeSteel, sx, 0.37, 0);
    leg2.rotation.x = -0.55;
    // Pivot bolt
    addShadowMesh(g, new THREE.CylinderGeometry(0.018, 0.018, 0.04, 10), mats.blackIron, sx, 0.37, 0).rotation.z = Math.PI / 2;
  }
  // Bottom crossbar & steel bowl on top
  addShadowMesh(g, new THREE.CylinderGeometry(0.012, 0.012, 0.74, 10), mats.chromeSteel, 0, 0.02, 0.22).rotation.z = Math.PI / 2;
  addShadowMesh(g, new THREE.CylinderGeometry(0.012, 0.012, 0.74, 10), mats.chromeSteel, 0, 0.02, -0.22).rotation.z = Math.PI / 2;
  addShadowMesh(g, new THREE.CylinderGeometry(0.11, 0.06, 0.08, 18), mats.chromeSteel, 0.16, 0.82, 0.05);

  return g;
}

// 11. ZON 2: Rak Buku Kayu Bertingkat Penuh Buku 3D (InstancedMesh)
export function buildBookshelfWithBooks(mats: HouseMaterialPalette): THREE.Group {
  const g = new THREE.Group();
  const w = 1.18;
  const h = 1.84;
  const d = 0.36;

  addContactShadow(g, w + 0.22, d + 0.22, mats);
  // Outer carcass + 2 vertical dividers + 3 inner horizontal shelves
  addShadowMesh(g, new THREE.BoxGeometry(0.03, h, d), mats.woodMedium, -w / 2 + 0.015, h / 2, 0);
  addShadowMesh(g, new THREE.BoxGeometry(0.03, h, d), mats.woodMedium, w / 2 - 0.015, h / 2, 0);
  addShadowMesh(g, new THREE.BoxGeometry(w, h, 0.018), mats.woodDark, 0, h / 2, -d / 2 + 0.009);
  for (const vx of [-w / 6, w / 6]) {
    addShadowMesh(g, new THREE.BoxGeometry(0.024, h, d - 0.02), mats.woodMedium, vx, h / 2, 0.01);
  }
  for (let s = 0; s <= 4; s++) {
    const sy = 0.04 + s * ((h - 0.06) / 4);
    addShadowMesh(g, new THREE.BoxGeometry(w - 0.02, 0.026, d), mats.woodMedium, 0, sy, 0);
  }

  // InstancedMesh 3D colorful books across compartments
  const bookGeo = new THREE.BoxGeometry(0.036, 0.26, 0.20);
  const bookMat = new THREE.MeshStandardMaterial({ roughness: 0.65, metalness: 0.04 });
  const count = 64;
  const inst = new THREE.InstancedMesh(bookGeo, bookMat, count);
  inst.castShadow = true;
  inst.receiveShadow = true;
  const dummy = new THREE.Object3D();
  const palette = [0xb73e3e, 0x2f6a87, 0xd4a43a, 0x3b7a57, 0x454a54, 0x8b4c7a, 0xd9d2c5];
  const color = new THREE.Color();

  let idx = 0;
  for (let shelf = 0; shelf < 4 && idx < count; shelf++) {
    const sy = 0.053 + shelf * ((h - 0.06) / 4);
    for (let cell = 0; cell < 3 && idx < count; cell++) {
      const cx = -w / 3 + cell * (w / 3);
      for (let b = 0; b < 5 && idx < count; b++) {
        const scaleH = 0.78 + ((idx * 17) % 10) * 0.032;
        dummy.position.set(cx - 0.11 + b * 0.045, sy + (0.26 * scaleH) / 2, 0.04);
        dummy.rotation.set(0, 0, b === 4 && shelf % 2 === 0 ? -0.18 : 0);
        dummy.scale.set(0.85 + (b % 3) * 0.12, scaleH, 0.9 + (b % 2) * 0.1);
        dummy.updateMatrix();
        inst.setMatrixAt(idx, dummy.matrix);
        color.setHex(palette[(idx * 3 + cell) % palette.length]);
        inst.setColorAt(idx, color);
        idx++;
      }
    }
  }
  inst.instanceMatrix.needsUpdate = true;
  if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  inst.computeBoundingSphere();
  g.add(inst);

  return g;
}

// 12. Kerusi Pejabat Beroda (5-Jejari, Hidraulik, Kusyen & Sandaran Melengkung)
export function buildOfficeChair(mats: HouseMaterialPalette): THREE.Group {
  const g = new THREE.Group();
  // 5-star caster base
  addShadowMesh(g, new THREE.CylinderGeometry(0.035, 0.035, 0.34, 14), mats.chromeSteel, 0, 0.24, 0);
  for (let i = 0; i < 5; i++) {
    const ang = (i * Math.PI * 2) / 5;
    const arm = addShadowMesh(g, new THREE.BoxGeometry(0.28, 0.025, 0.036), mats.blackIron, Math.cos(ang) * 0.14, 0.08, Math.sin(ang) * 0.14);
    arm.rotation.y = -ang;
    addShadowMesh(g, new THREE.CylinderGeometry(0.024, 0.024, 0.025, 12), mats.blackIron, Math.cos(ang) * 0.26, 0.03, Math.sin(ang) * 0.26).rotation.y = -ang;
  }
  // Rounded seat cushion
  addShadowMesh(g, createRoundedBoxGeometry(0.50, 0.08, 0.48, 0.06, 0.018), mats.blackIron, 0, 0.44, 0);
  // Spine + curved backrest
  addShadowMesh(g, new THREE.BoxGeometry(0.06, 0.42, 0.04), mats.blackIron, 0, 0.64, -0.22);
  addShadowMesh(g, createRoundedBoxGeometry(0.46, 0.48, 0.07, 0.06, 0.018), mats.blackIron, 0, 0.82, -0.20);
  // Armrests
  for (const sx of [-0.26, 0.26]) {
    addShadowMesh(g, new THREE.BoxGeometry(0.03, 0.20, 0.04), mats.blackIron, sx, 0.54, -0.02);
    addShadowMesh(g, createRoundedBoxGeometry(0.06, 0.03, 0.28, 0.015, 0.005), mats.blackIron, sx, 0.65, 0.0);
  }
  return g;
}

// 13. ZON 2: Meja Kerja Lengkap (Monitor/Laptop, Papan Kekunci, Printer, Fail)
export function buildWorkDeskSet(mats: HouseMaterialPalette): THREE.Group {
  const g = new THREE.Group();
  const w = 1.52;
  const h = 0.76;
  const d = 0.72;

  addContactShadow(g, w + 0.25, d + 0.28, mats);
  addShadowMesh(g, createRoundedBoxGeometry(w, 0.036, d, 0.015, 0.005), mats.matteWhite, 0, h, 0);
  addShadowMesh(g, new THREE.BoxGeometry(0.04, h - 0.02, d - 0.06), mats.greyDoor, -w / 2 + 0.04, (h - 0.02) / 2, 0);
  addShadowMesh(g, new THREE.BoxGeometry(0.04, h - 0.02, d - 0.06), mats.greyDoor, w / 2 - 0.04, (h - 0.02) / 2, 0);
  addShadowMesh(g, new THREE.BoxGeometry(w - 0.1, 0.36, 0.02), mats.greyDoor, 0, h - 0.20, -d / 2 + 0.06);

  // Laptop / Monitor + Keyboard
  addShadowMesh(g, new THREE.BoxGeometry(0.38, 0.016, 0.26), mats.blackIron, -0.15, h + 0.026, 0.05);
  const screen = addShadowMesh(g, new THREE.BoxGeometry(0.38, 0.24, 0.012), mats.blackIron, -0.15, h + 0.145, -0.08);
  screen.rotation.x = -0.18;
  const glow = new THREE.MeshBasicMaterial({ color: 0x1a2838 });
  const disp = addShadowMesh(g, new THREE.PlaneGeometry(0.35, 0.21), glow, -0.15, h + 0.145, -0.072, false, false);
  disp.rotation.x = -0.18;

  // Printer on right side
  addShadowMesh(g, createRoundedBoxGeometry(0.38, 0.16, 0.32, 0.02, 0.006), mats.blackIron, 0.42, h + 0.10, -0.08);
  addShadowMesh(g, new THREE.BoxGeometry(0.22, 0.14, 0.015), mats.matteWhite, 0.42, h + 0.22, -0.20);

  // Vertical document holders
  const fileColors = [0x2a5c8a, 0x383c42, 0x9b3636];
  for (let i = 0; i < 3; i++) {
    const fMat = new THREE.MeshStandardMaterial({ color: fileColors[i], roughness: 0.6 });
    addShadowMesh(g, new THREE.BoxGeometry(0.07, 0.30, 0.23), fMat, -0.62 + i * 0.08, h + 0.17, -0.15);
  }

  // Office chair tucked in front
  const chair = buildOfficeChair(mats);
  chair.position.set(-0.1, 0, 0.56);
  chair.rotation.y = Math.PI;
  g.add(chair);

  return g;
}

// 14. ZON 2: Unit Aircond Berbilah 3D
export function buildAirConditioner(mats: HouseMaterialPalette): THREE.Group {
  const g = new THREE.Group();
  addShadowMesh(g, createRoundedBoxGeometry(0.96, 0.28, 0.23, 0.04, 0.012), mats.matteWhite, 0, 0, 0);
  // Recessed air outlet slot + louver blade
  addShadowMesh(g, new THREE.BoxGeometry(0.84, 0.045, 0.03), mats.blackIron, 0, -0.085, 0.102);
  const louver = addShadowMesh(g, new THREE.BoxGeometry(0.82, 0.012, 0.042), mats.matteWhite, 0, -0.092, 0.118);
  louver.rotation.x = 0.45;
  // Top intake vents
  for (let x = -0.38; x <= 0.38; x += 0.05) {
    addShadowMesh(g, new THREE.BoxGeometry(0.02, 0.01, 0.12), mats.greyDoor, x, 0.142, 0);
  }
  // Small green power indicator
  const led = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.008, 0.005), new THREE.MeshBasicMaterial({ color: 0x38d989 }));
  led.position.set(0.36, -0.02, 0.118);
  g.add(led);
  return g;
}

// 15. ZON 2 & 3: Tingkap + Langsir Beralun Gelombang Sine-Wave (1 atau 2 Lapis)
export function buildCurtainWindowSet(
  mats: HouseMaterialPalette,
  width: number,
  height: number,
  twoLayer = true
): THREE.Group {
  const g = new THREE.Group();

  // Window frame + dark glass
  addShadowMesh(g, new THREE.BoxGeometry(width + 0.08, 0.05, 0.06), mats.blackIron, 0, height / 2, -0.03);
  addShadowMesh(g, new THREE.BoxGeometry(width + 0.08, 0.05, 0.06), mats.blackIron, 0, -height / 2, -0.03);
  addShadowMesh(g, new THREE.BoxGeometry(0.05, height, 0.06), mats.blackIron, -width / 2, 0, -0.03);
  addShadowMesh(g, new THREE.BoxGeometry(0.05, height, 0.06), mats.blackIron, width / 2, 0, -0.03);
  addShadowMesh(g, new THREE.BoxGeometry(0.04, height, 0.05), mats.blackIron, 0, 0, -0.03);
  addShadowMesh(g, new THREE.BoxGeometry(width - 0.04, height - 0.04, 0.015), mats.darkGlass, 0, 0, -0.04, false, true);

  // Curtain rod + finials + brackets
  const rodY = height / 2 + 0.14;
  addShadowMesh(g, new THREE.CylinderGeometry(0.014, 0.014, width + 0.36, 12), mats.blackIron, 0, rodY, 0.06).rotation.z = Math.PI / 2;
  for (const sx of [-width / 2 - 0.18, width / 2 + 0.18]) {
    addShadowMesh(g, new THREE.SphereGeometry(0.026, 12, 12), mats.brassGold, sx, rodY, 0.06);
    addShadowMesh(g, new THREE.BoxGeometry(0.02, 0.03, 0.09), mats.blackIron, sx * 0.86, rodY, 0.015);
  }

  // Sheer inner sine-wave curtain
  const sheerH = height + 0.32;
  const sheer = addShadowMesh(g, createSineCurtainGeometry(width + 0.12, sheerH, 16, 0.036), mats.curtainSheer, 0, rodY - sheerH / 2, 0.045, false, true);
  sheer.name = 'curtainSheer';

  // Outer heavy brown drapes on left & right with tie-back bands
  if (twoLayer) {
    const panelW = width * 0.24;
    for (const side of [-1, 1]) {
      const px = side * (width / 2 - panelW / 2 + 0.08);
      addShadowMesh(g, createSineCurtainGeometry(panelW, sheerH + 0.04, 5, 0.045), mats.curtainBrown, px, rodY - sheerH / 2, 0.095);
      // Tie-back ribbon ring
      addShadowMesh(g, new THREE.TorusGeometry(0.075, 0.012, 8, 16), mats.curtainBrown, px, rodY - sheerH * 0.56, 0.095).rotation.x = Math.PI / 2;
    }
  }

  return g;
}

// 16. ZON 3: Plaster Siling Bertingkat (Tray Ceiling) + Downlight + Chandelier Tengah
export function buildTrayCeilingAndChandelier(mats: HouseMaterialPalette): THREE.Group {
  const g = new THREE.Group();
  const H = 2.95;

  // Recessed stepped tray cove frame (4 perimeter dropped ceiling beams around center 3.6 x 3.8 tray)
  const dropMat = mats.creamPlaster;
  addShadowMesh(g, new THREE.BoxGeometry(5.2, 0.14, 0.9), dropMat, -4.2, H - 0.07, -6.15, false, true);
  addShadowMesh(g, new THREE.BoxGeometry(5.2, 0.14, 0.9), dropMat, -4.2, H - 0.07, -1.45, false, true);
  addShadowMesh(g, new THREE.BoxGeometry(0.9, 0.14, 3.8), dropMat, -6.35, H - 0.07, -3.8, false, true);
  addShadowMesh(g, new THREE.BoxGeometry(0.9, 0.14, 3.8), dropMat, -2.05, H - 0.07, -3.8, false, true);

  // Recessed circular LED downlights along tray perimeter
  const ledGlow = new THREE.MeshBasicMaterial({ color: 0xfff8ea });
  const downlightCoords = [
    [-6.1, -5.8], [-4.2, -5.9], [-2.3, -5.8],
    [-6.1, -1.8], [-4.2, -1.7], [-2.3, -1.8],
  ];
  for (const [dx, dz] of downlightCoords) {
    addShadowMesh(g, new THREE.CylinderGeometry(0.085, 0.085, 0.018, 18), mats.matteWhite, dx, H - 0.142, dz, false, false);
    const bulb = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.022, 16), ledGlow);
    bulb.position.set(dx, H - 0.145, dz);
    g.add(bulb);
  }

  // Central Chandelier (canopy + rod + hub + 4 curved TubeGeometry arms + 4 flared glass shades)
  const cx = -4.2;
  const cz = -3.8;
  addShadowMesh(g, new THREE.CylinderGeometry(0.11, 0.14, 0.04, 18), mats.brassGold, cx, H - 0.02, cz);
  addShadowMesh(g, new THREE.CylinderGeometry(0.018, 0.018, 0.34, 12), mats.brassGold, cx, H - 0.19, cz);
  addShadowMesh(g, new THREE.SphereGeometry(0.06, 16, 16), mats.brassGold, cx, H - 0.36, cz);

  const shadePts = [
    new THREE.Vector2(0.03, 0.0),
    new THREE.Vector2(0.055, 0.04),
    new THREE.Vector2(0.11, 0.12),
    new THREE.Vector2(0.10, 0.125),
    new THREE.Vector2(0.045, 0.045),
    new THREE.Vector2(0.022, 0.005),
  ];
  const shadeGeo = new THREE.LatheGeometry(shadePts, 18);
  const shadeMat = new THREE.MeshPhysicalMaterial({
    color: 0xfff3dc,
    emissive: 0xffd28a,
    emissiveIntensity: 0.45,
    roughness: 0.2,
    transmission: 0.4,
    transparent: true,
    opacity: 0.9,
  });

  for (let i = 0; i < 4; i++) {
    const ang = (i * Math.PI) / 2 + Math.PI / 4;
    const ox = Math.cos(ang) * 0.28;
    const oz = Math.sin(ang) * 0.28;
    const armCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(cx, H - 0.36, cz),
      new THREE.Vector3(cx + ox * 0.55, H - 0.44, cz + oz * 0.55),
      new THREE.Vector3(cx + ox, H - 0.32, cz + oz),
    ]);
    addShadowMesh(g, new THREE.TubeGeometry(armCurve, 14, 0.01, 8, false), mats.brassGold, 0, 0, 0);
    addShadowMesh(g, shadeGeo, shadeMat, cx + ox, H - 0.32, cz + oz, false, false);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 10), ledGlow);
    bulb.position.set(cx + ox, H - 0.26, cz + oz);
    g.add(bulb);
  }

  return g;
}

// 17. ZON 3: Jalur Panel Kayu Menegak 3D (InstancedMesh Bilah Geometri Timbul Sebenar)
export function buildFlutedWallPanel(
  mats: HouseMaterialPalette,
  panelWidth: number,
  panelHeight: number,
  slatPitch = 0.042
): THREE.Group {
  const g = new THREE.Group();
  const count = Math.max(4, Math.floor(panelWidth / slatPitch));
  const slatW = slatPitch * 0.58;
  const slatD = 0.026;

  // Backing dark board
  addShadowMesh(g, new THREE.BoxGeometry(panelWidth, panelHeight, 0.01), mats.blackIron, 0, panelHeight / 2, 0.005);

  const slatGeo = new THREE.BoxGeometry(slatW, panelHeight, slatD);
  const inst = new THREE.InstancedMesh(slatGeo, mats.flutedSlat, count);
  inst.castShadow = true;
  inst.receiveShadow = true;

  const dummy = new THREE.Object3D();
  const startX = -panelWidth / 2 + slatPitch / 2;
  for (let i = 0; i < count; i++) {
    dummy.position.set(startX + i * slatPitch, panelHeight / 2, 0.022);
    dummy.updateMatrix();
    inst.setMatrixAt(i, dummy.matrix);
  }
  inst.instanceMatrix.needsUpdate = true;
  inst.computeBoundingSphere();
  g.add(inst);

  return g;
}

// 18. ZON 3: Dinding TV Marmar + Kabinet Gantung Berlaci + TV Skrin Rata + Meja PC
export function buildTVFeatureWallSet(mats: HouseMaterialPalette): THREE.Group {
  const g = new THREE.Group();
  const H = 2.95;

  // Raised marble center slab + wooden perimeter molding
  addShadowMesh(g, new THREE.BoxGeometry(1.92, 2.38, 0.045), mats.marble, 0, 1.38, 0);
  addShadowMesh(g, new THREE.BoxGeometry(0.055, 2.42, 0.065), mats.woodMedium, -0.96, 1.38, 0.01);
  addShadowMesh(g, new THREE.BoxGeometry(0.055, 2.42, 0.065), mats.woodMedium, 0.96, 1.38, 0.01);
  addShadowMesh(g, new THREE.BoxGeometry(1.98, 0.055, 0.065), mats.woodMedium, 0, 2.57, 0.01);

  // Floating dark-wood TV cabinet with 3 cubbies/drawers
  const cabY = 0.64;
  addShadowMesh(g, new THREE.BoxGeometry(1.80, 0.36, 0.36), mats.woodDark, 0, cabY, 0.19);
  for (const dx of [-0.58, 0, 0.58]) {
    addShadowMesh(g, new THREE.BoxGeometry(0.54, 0.28, 0.02), mats.woodMedium, dx, cabY, 0.372);
    addShadowMesh(g, new THREE.BoxGeometry(0.12, 0.014, 0.025), mats.chromeSteel, dx, cabY + 0.06, 0.388);
  }
  // Small potted plant & decor vase on TV console
  addShadowMesh(g, new THREE.CylinderGeometry(0.06, 0.045, 0.11, 14), mats.matteWhite, 0.68, cabY + 0.23, 0.22);
  addShadowMesh(g, new THREE.SphereGeometry(0.09, 12, 10), mats.plantLeaf, 0.68, cabY + 0.33, 0.22);

  // Thin-bezel Flat-screen TV + red standby LED + power cable
  addShadowMesh(g, new THREE.BoxGeometry(1.42, 0.84, 0.036), mats.blackIron, 0, 1.56, 0.045);
  addShadowMesh(g, new THREE.BoxGeometry(1.36, 0.78, 0.012), mats.darkGlass, 0, 1.56, 0.065);
  const standby = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
  standby.position.set(0.62, 1.15, 0.068);
  g.add(standby);
  const cord = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.2, 1.18, 0.03),
    new THREE.Vector3(-0.24, 0.95, 0.06),
    new THREE.Vector3(-0.18, 0.82, 0.12),
  ]);
  addShadowMesh(g, new THREE.TubeGeometry(cord, 12, 0.006, 6, false), mats.blackIron, 0, 0, 0);

  // Fluted panels flanking marble TV wall
  const flutedLeft = buildFlutedWallPanel(mats, 0.68, H);
  flutedLeft.position.set(-1.35, 0, -0.02);
  g.add(flutedLeft);
  const flutedRight = buildFlutedWallPanel(mats, 0.68, H);
  flutedRight.position.set(1.35, 0, -0.02);
  g.add(flutedRight);

  // Adjacent PC Desk to the right (+X in local coords = towards middle room arch)
  const deskX = 1.92;
  addShadowMesh(g, createRoundedBoxGeometry(1.10, 0.032, 0.56, 0.015, 0.005), mats.matteWhite, deskX, 0.75, 0.28);
  addShadowMesh(g, new THREE.BoxGeometry(0.035, 0.74, 0.50), mats.matteWhite, deskX - 0.50, 0.37, 0.28);
  addShadowMesh(g, new THREE.BoxGeometry(0.035, 0.74, 0.50), mats.matteWhite, deskX + 0.50, 0.37, 0.28);
  // PC Monitor + Keyboard
  addShadowMesh(g, new THREE.BoxGeometry(0.54, 0.32, 0.02), mats.blackIron, deskX, 1.00, 0.12);
  addShadowMesh(g, new THREE.BoxGeometry(0.06, 0.14, 0.04), mats.blackIron, deskX, 0.82, 0.12);
  addShadowMesh(g, new THREE.BoxGeometry(0.38, 0.015, 0.14), mats.blackIron, deskX, 0.775, 0.32);

  // Wheeled office chair at PC desk
  const pcChair = buildOfficeChair(mats);
  pcChair.position.set(deskX, 0, 0.86);
  pcChair.rotation.y = Math.PI;
  g.add(pcChair);

  // Floor subwoofer speaker & corner plant
  addShadowMesh(g, createRoundedBoxGeometry(0.28, 0.40, 0.32, 0.02, 0.008), mats.blackIron, 1.24, 0.20, 0.26);
  addShadowMesh(g, new THREE.CylinderGeometry(0.11, 0.08, 0.22, 16), mats.matteWhite, 2.65, 0.11, 0.28);
  for (let i = 0; i < 6; i++) {
    const leaf = addShadowMesh(g, new THREE.SphereGeometry(0.12, 10, 8), mats.plantLeaf, 2.65 + Math.cos(i) * 0.08, 0.36 + (i % 3) * 0.08, 0.28 + Math.sin(i) * 0.08);
    leaf.scale.set(1.4, 0.25, 0.9);
  }

  return g;
}

// 19. ZON 3: Sofa Panjang Berkusyen Bulat & Bantal Sandar Berasingan
export function buildLongSofa(mats: HouseMaterialPalette): THREE.Group {
  const g = new THREE.Group();
  const w = 2.24;
  const d = 0.86;

  addContactShadow(g, w + 0.30, d + 0.30, mats);
  // Wooden base plinth + 4 tapered legs
  addShadowMesh(g, new THREE.BoxGeometry(w, 0.12, d), mats.woodDark, 0, 0.14, 0);
  for (const lx of [-w / 2 + 0.10, w / 2 - 0.10]) {
    for (const lz of [-d / 2 + 0.10, d / 2 - 0.10]) {
      addShadowMesh(g, new THREE.CylinderGeometry(0.032, 0.02, 0.08, 12), mats.woodDark, lx, 0.04, lz);
    }
  }

  // 3 rounded-bevel seat cushions (ExtrudeGeometry)
  const seatGeo = createRoundedBoxGeometry(0.68, 0.18, 0.72, 0.07, 0.028);
  for (const sx of [-0.70, 0, 0.70]) {
    addShadowMesh(g, seatGeo, mats.wovenCushion, sx, 0.29, 0.04);
  }

  // Rear frame + 3 plush angled backrest cushions
  addShadowMesh(g, createRoundedBoxGeometry(w, 0.62, 0.18, 0.04, 0.015), mats.wovenCushion, 0, 0.49, -d / 2 + 0.09);
  const backGeo = createRoundedBoxGeometry(0.66, 0.42, 0.17, 0.06, 0.025);
  for (const sx of [-0.69, 0, 0.69]) {
    const b = addShadowMesh(g, backGeo, mats.wovenCushion, sx, 0.56, -0.22);
    b.rotation.x = 0.14;
  }

  // 2 Rounded armrests + 2 decorative throw pillows
  const armGeo = createRoundedBoxGeometry(0.16, 0.42, d - 0.06, 0.05, 0.02);
  addShadowMesh(g, armGeo, mats.wovenCushion, -w / 2 + 0.08, 0.38, 0.02);
  addShadowMesh(g, armGeo, mats.wovenCushion, w / 2 - 0.08, 0.38, 0.02);

  const pillowMat = new THREE.MeshStandardMaterial({ color: 0x6b4832, roughness: 0.75 });
  const pillowGeo = createRoundedBoxGeometry(0.32, 0.30, 0.11, 0.06, 0.025);
  for (const px of [-0.88, 0.88]) {
    const p = addShadowMesh(g, pillowGeo, pillowMat, px, 0.50, -0.05);
    p.rotation.y = px < 0 ? 0.5 : -0.5;
    p.rotation.z = px < 0 ? -0.15 : 0.15;
  }

  return g;
}

// 20. ZON 3: Kerusi Kayu Berukir Berkusyen Coklat
export function buildCarvedWoodChair(mats: HouseMaterialPalette): THREE.Group {
  const g = new THREE.Group();
  addContactShadow(g, 0.80, 0.76, mats);
  // 4 sculpted legs + stretchers
  for (const lx of [-0.27, 0.27]) {
    addShadowMesh(g, new THREE.CylinderGeometry(0.024, 0.018, 0.42, 10), mats.woodTeak, lx, 0.21, 0.24);
    addShadowMesh(g, new THREE.CylinderGeometry(0.024, 0.018, 0.86, 10), mats.woodTeak, lx, 0.43, -0.24);
    // Side stretcher + curved armrest
    addShadowMesh(g, new THREE.BoxGeometry(0.032, 0.032, 0.48), mats.woodTeak, lx, 0.16, 0);
    addShadowMesh(g, new THREE.CylinderGeometry(0.02, 0.02, 0.24, 10), mats.woodTeak, lx, 0.48, 0.20);
    addShadowMesh(g, createRoundedBoxGeometry(0.06, 0.036, 0.52, 0.015, 0.008), mats.woodTeak, lx, 0.60, 0);
  }
  // Wooden seat base & slatted carved top rail
  addShadowMesh(g, new THREE.BoxGeometry(0.54, 0.04, 0.50), mats.woodTeak, 0, 0.36, 0);
  addShadowMesh(g, createRoundedBoxGeometry(0.58, 0.06, 0.05, 0.02, 0.008), mats.woodTeak, 0, 0.86, -0.24);

  // Thick beveled brown seat & back cushions
  addShadowMesh(g, createRoundedBoxGeometry(0.50, 0.11, 0.48, 0.05, 0.02), mats.brownCushion, 0, 0.435, 0.02);
  const backCush = addShadowMesh(g, createRoundedBoxGeometry(0.48, 0.38, 0.11, 0.05, 0.02), mats.brownCushion, 0, 0.65, -0.17);
  backCush.rotation.x = 0.12;

  return g;
}

// 21. ZON 4: Kerusi Besi Lipat + Baldi Merah + Paip Air Bilik Air Belakang
export function buildFoldingSteelChair(mats: HouseMaterialPalette): THREE.Group {
  const g = new THREE.Group();
  addContactShadow(g, 0.62, 0.60, mats);
  for (const sx of [-0.21, 0.21]) {
    const fLeg = addShadowMesh(g, new THREE.CylinderGeometry(0.012, 0.012, 0.52, 10), mats.chromeSteel, sx, 0.23, 0.02);
    fLeg.rotation.x = 0.36;
    const rLeg = addShadowMesh(g, new THREE.CylinderGeometry(0.012, 0.012, 0.86, 10), mats.chromeSteel, sx, 0.41, -0.06);
    rLeg.rotation.x = -0.28;
  }
  addShadowMesh(g, createRoundedBoxGeometry(0.40, 0.024, 0.38, 0.03, 0.006), mats.woodTeak, 0, 0.44, 0.03);
  const back = addShadowMesh(g, createRoundedBoxGeometry(0.40, 0.18, 0.024, 0.025, 0.006), mats.woodTeak, 0, 0.76, -0.17);
  back.rotation.x = -0.24;
  return g;
}

export function buildRedBucketAndTap(mats: HouseMaterialPalette): THREE.Group {
  const g = new THREE.Group();
  addContactShadow(g, 0.56, 0.56, mats);
  addContactShadow(g, 0.44, 0.44, mats, -0.42, 0.16);
  // Red tapered bucket (LatheGeometry)
  const bPts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.14, 0.0),
    new THREE.Vector2(0.185, 0.32),
    new THREE.Vector2(0.20, 0.335),
    new THREE.Vector2(0.18, 0.34),
    new THREE.Vector2(0.165, 0.31),
    new THREE.Vector2(0.13, 0.02),
    new THREE.Vector2(0.0, 0.02),
  ];
  addShadowMesh(g, new THREE.LatheGeometry(bPts, 24), mats.bucketRed, 0, 0, 0);
  // Bent steel bail handle
  const handleCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.185, 0.32, 0),
    new THREE.Vector3(-0.14, 0.44, 0.11),
    new THREE.Vector3(0, 0.47, 0.14),
    new THREE.Vector3(0.14, 0.44, 0.11),
    new THREE.Vector3(0.185, 0.32, 0),
  ]);
  addShadowMesh(g, new THREE.TubeGeometry(handleCurve, 16, 0.005, 6, false), mats.chromeSteel, 0, 0, 0);

  // Adjacent small blue basin
  addShadowMesh(g, new THREE.CylinderGeometry(0.15, 0.11, 0.14, 20), mats.bucketBlue, -0.42, 0.07, 0.16);

  // Wall water pipe + brass faucet tap
  const pipeCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.32, 0, -0.22),
    new THREE.Vector3(0.32, 0.68, -0.22),
    new THREE.Vector3(0.32, 0.68, -0.06),
    new THREE.Vector3(0.32, 0.62, -0.04),
  ]);
  addShadowMesh(g, new THREE.TubeGeometry(pipeCurve, 18, 0.015, 10, false), mats.chromeSteel, 0, 0, 0);
  addShadowMesh(g, new THREE.BoxGeometry(0.08, 0.018, 0.018), mats.brassGold, 0.32, 0.72, -0.10);

  return g;
}

// 22. Kabinet Kayu Gelap + Microwave Berpanel Kaca + Mangkuk Tingkat
export function buildMicrowaveCabinet(mats: HouseMaterialPalette): THREE.Group {
  const g = new THREE.Group();
  const w = 0.96;
  const h = 0.90;
  const d = 0.48;

  addContactShadow(g, w + 0.22, d + 0.22, mats);
  addShadowMesh(g, new THREE.BoxGeometry(w, h, d), mats.woodDark, 0, h / 2, 0);
  for (const sx of [-0.23, 0.23]) {
    addShadowMesh(g, new THREE.BoxGeometry(0.44, h - 0.08, 0.022), mats.woodMedium, sx, h / 2, d / 2 + 0.01);
    addShadowMesh(g, new THREE.CylinderGeometry(0.008, 0.008, 0.12, 10), mats.chromeSteel, sx - Math.sign(sx) * 0.14, h / 2 + 0.12, d / 2 + 0.028);
  }

  // Microwave / Toaster oven on top
  addShadowMesh(g, createRoundedBoxGeometry(0.48, 0.29, 0.36, 0.02, 0.008), mats.blackIron, -0.16, h + 0.145, 0);
  addShadowMesh(g, new THREE.BoxGeometry(0.31, 0.21, 0.016), mats.darkGlass, -0.22, h + 0.15, 0.182);
  addShadowMesh(g, new THREE.BoxGeometry(0.016, 0.18, 0.024), mats.chromeSteel, -0.09, h + 0.15, 0.192);
  for (const ky of [h + 0.21, h + 0.13]) {
    addShadowMesh(g, new THREE.CylinderGeometry(0.018, 0.018, 0.016, 12), mats.chromeSteel, 0.02, ky, 0.185).rotation.x = Math.PI / 2;
  }

  // Pink/Red stacked tiffin carrier on right
  for (let tier = 0; tier < 3; tier++) {
    addShadowMesh(g, new THREE.CylinderGeometry(0.09, 0.09, 0.065, 18), tier % 2 === 0 ? mats.bucketRed : mats.matteWhite, 0.28, h + 0.035 + tier * 0.068, 0.04);
  }

  return g;
}

// 23. Suis Elektrik & Bingkai Gambar 2x2
export function buildWallSwitch(mats: HouseMaterialPalette): THREE.Group {
  const g = new THREE.Group();
  addShadowMesh(g, new THREE.BoxGeometry(0.14, 0.09, 0.014), mats.matteWhite, 0, 0, 0);
  addShadowMesh(g, new THREE.BoxGeometry(0.028, 0.04, 0.02), mats.greyDoor, -0.03, 0, 0.006);
  addShadowMesh(g, new THREE.BoxGeometry(0.028, 0.04, 0.02), mats.greyDoor, 0.03, 0, 0.006);
  return g;
}

export function buildFramedPictureGrid(mats: HouseMaterialPalette): THREE.Group {
  const g = new THREE.Group();
  const artColors = [0x9e7448, 0x5c7c66, 0x7c5848, 0xc29b5a];
  let idx = 0;
  for (const py of [-0.18, 0.18]) {
    for (const px of [-0.22, 0.22]) {
      addShadowMesh(g, new THREE.BoxGeometry(0.32, 0.26, 0.022), mats.woodDark, px, py, 0);
      const artMat = new THREE.MeshStandardMaterial({ color: artColors[idx++], roughness: 0.7 });
      addShadowMesh(g, new THREE.BoxGeometry(0.26, 0.20, 0.026), artMat, px, py, 0.004);
    }
  }
  return g;
}

// 24. ZON 1 -> ZON 4: Pintu Merah Berbingkai Profil + Ambang + Daun Pintu Terbuka di Koridor
export function buildRedCorridorDoorway(mats: HouseMaterialPalette): THREE.Group {
  const g = new THREE.Group();
  const openW = 1.05;
  const openH = 2.18;

  // Main stepped red structural jambs (left, right, top)
  addShadowMesh(g, new THREE.BoxGeometry(0.22, openH, 0.07), mats.redFrame, 0, openH / 2, -openW / 2);
  addShadowMesh(g, new THREE.BoxGeometry(0.22, openH, 0.07), mats.redFrame, 0, openH / 2, openW / 2);
  addShadowMesh(g, new THREE.BoxGeometry(0.22, 0.08, openW + 0.08), mats.redFrame, 0, openH + 0.02, 0);

  // Inner recessed door-stop rebate strip
  addShadowMesh(g, new THREE.BoxGeometry(0.05, openH - 0.04, 0.025), mats.redFrame, -0.03, openH / 2, -openW / 2 + 0.04);
  addShadowMesh(g, new THREE.BoxGeometry(0.05, openH - 0.04, 0.025), mats.redFrame, -0.03, openH / 2, openW / 2 - 0.04);
  addShadowMesh(g, new THREE.BoxGeometry(0.05, 0.025, openW - 0.02), mats.redFrame, -0.03, openH - 0.02, 0);

  // Outer stepped red architrave casing trim on both Kitchen (+X) and Corridor (-X) faces
  for (const sx of [-0.115, 0.115]) {
    addShadowMesh(g, new THREE.BoxGeometry(0.025, openH + 0.07, 0.075), mats.redFrame, sx, (openH + 0.07) / 2, -openW / 2 - 0.03);
    addShadowMesh(g, new THREE.BoxGeometry(0.025, openH + 0.07, 0.075), mats.redFrame, sx, (openH + 0.07) / 2, openW / 2 + 0.03);
    addShadowMesh(g, new THREE.BoxGeometry(0.025, 0.075, openW + 0.14), mats.redFrame, sx, openH + 0.055, 0);
  }

  // Floor threshold transition strip (wood & brushed steel)
  addShadowMesh(g, new THREE.BoxGeometry(0.23, 0.016, openW + 0.04), mats.woodDark, 0, 0.008, 0, false, true);
  addShadowMesh(g, new THREE.BoxGeometry(0.04, 0.018, openW), mats.chromeSteel, 0.09, 0.009, 0, false, true);

  // Open/ajar 6-panel dark wooden door leaf swung into the corridor (-X side, hinged at z = -openW/2)
  const leafPivot = new THREE.Group();
  leafPivot.position.set(-0.08, 0, -openW / 2 + 0.05);
  leafPivot.rotation.y = Math.PI * 0.42; // Swung almost flat against corridor side
  const leafW = 0.92;
  const leafH = 2.08;
  addShadowMesh(leafPivot, new THREE.BoxGeometry(0.045, leafH, leafW), mats.woodDark, 0, leafH / 2 + 0.01, leafW / 2);
  for (const py of [0.46, 1.06, 1.66]) {
    for (const pz of [0.25, 0.67]) {
      addShadowMesh(leafPivot, new THREE.BoxGeometry(0.062, 0.40, 0.27), mats.woodMedium, 0, py, pz);
    }
  }
  for (const hy of [0.35, 1.05, 1.75]) {
    addShadowMesh(leafPivot, new THREE.CylinderGeometry(0.008, 0.008, 0.07, 10), mats.chromeSteel, 0.02, hy, 0.01);
  }
  addShadowMesh(leafPivot, new THREE.SphereGeometry(0.026, 12, 12), mats.brassGold, 0.05, 1.00, leafW - 0.09);
  addShadowMesh(leafPivot, new THREE.SphereGeometry(0.026, 12, 12), mats.brassGold, -0.05, 1.00, leafW - 0.09);
  g.add(leafPivot);

  return g;
}

// 25. Balok Struktur Siling & Lampu Pendaflour T8 Sebenar
export function buildStructuralBeam(mats: HouseMaterialPalette, length: number, width = 0.22, height = 0.22): THREE.Group {
  const g = new THREE.Group();
  addShadowMesh(g, new THREE.BoxGeometry(length, height, width), mats.creamPlaster, 0, 0, 0, true, true);
  // Subtle lower chamfer/trim strip for crisp architectural edge
  addShadowMesh(g, new THREE.BoxGeometry(length, 0.018, width + 0.024), mats.creamPlaster, 0, -height / 2 + 0.009, 0, false, true);
  return g;
}

export function buildTubeLightFixture(mats: HouseMaterialPalette, warm = false): THREE.Group {
  const g = new THREE.Group();
  // Metal batten housing
  addShadowMesh(g, new THREE.BoxGeometry(1.18, 0.042, 0.082), mats.matteWhite, 0, 0, 0, false, true);
  // End tombstones
  for (const sx of [-0.57, 0.57]) {
    addShadowMesh(g, new THREE.BoxGeometry(0.04, 0.052, 0.076), mats.matteWhite, sx, -0.028, 0, false, false);
  }
  // Glowing T8 fluorescent tube
  const tubeMat = new THREE.MeshStandardMaterial({
    color: warm ? 0xfff5e0 : 0xf4f8ff,
    emissive: warm ? 0xffe4b2 : 0xeaf4ff,
    emissiveIntensity: 1.35,
    roughness: 0.15,
  });
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 1.12, 14), tubeMat);
  tube.rotation.z = Math.PI / 2;
  tube.position.set(0, -0.04, 0);
  g.add(tube);
  return g;
}

// 26. Paip Konduit Elektrik PVC & Kotak Agihan
export function buildConduitRun(mats: HouseMaterialPalette, length: number, withJunctionBox = true): THREE.Group {
  const g = new THREE.Group();
  addShadowMesh(g, new THREE.CylinderGeometry(0.011, 0.011, length, 10), mats.matteWhite, 0, length / 2, 0, true, true);
  // Mounting saddle clips every ~0.65m
  for (let y = 0.25; y < length - 0.15; y += 0.65) {
    addShadowMesh(g, new THREE.BoxGeometry(0.036, 0.018, 0.022), mats.chromeSteel, 0, y, -0.004, false, true);
  }
  if (withJunctionBox) {
    addShadowMesh(g, createRoundedBoxGeometry(0.11, 0.11, 0.042, 0.012, 0.005), mats.matteWhite, 0, length, 0.01, true, true);
  }
  return g;
}

// 27. Troli Dapur Beroda 3 Tingkat + Penyapu & Mop Bersandar
export function buildKitchenRollingCart(mats: HouseMaterialPalette): THREE.Group {
  const g = new THREE.Group();
  const w = 0.44;
  const d = 0.34;
  const h = 0.78;
  addContactShadow(g, w + 0.18, d + 0.18, mats);

  // 4 Caster wheels + vertical steel posts
  for (const px of [-w / 2 + 0.02, w / 2 - 0.02]) {
    for (const pz of [-d / 2 + 0.02, d / 2 - 0.02]) {
      addShadowMesh(g, new THREE.CylinderGeometry(0.022, 0.022, 0.018, 12), mats.blackIron, px, 0.022, pz).rotation.z = Math.PI / 2;
      addShadowMesh(g, new THREE.CylinderGeometry(0.011, 0.011, h - 0.04, 10), mats.blackIron, px, 0.04 + (h - 0.04) / 2, pz);
    }
  }
  // Curved top handle loops
  for (const px of [-w / 2 + 0.02, w / 2 - 0.02]) {
    addShadowMesh(g, new THREE.CylinderGeometry(0.011, 0.011, d - 0.04, 10), mats.blackIron, px, h + 0.02, 0).rotation.x = Math.PI / 2;
  }
  // 3 Tray baskets with raised rims + kitchen supplies
  for (const ty of [0.16, 0.44, 0.72]) {
    addShadowMesh(g, new THREE.BoxGeometry(w, 0.018, d), mats.blackIron, 0, ty, 0);
    addShadowMesh(g, new THREE.BoxGeometry(w, 0.055, 0.014), mats.blackIron, 0, ty + 0.032, d / 2);
    addShadowMesh(g, new THREE.BoxGeometry(w, 0.055, 0.014), mats.blackIron, 0, ty + 0.032, -d / 2);
    addShadowMesh(g, new THREE.BoxGeometry(0.014, 0.055, d), mats.blackIron, -w / 2, ty + 0.032, 0);
    addShadowMesh(g, new THREE.BoxGeometry(0.014, 0.055, d), mats.blackIron, w / 2, ty + 0.032, 0);
  }
  // Bottles & bowls in trays
  addShadowMesh(g, new THREE.CylinderGeometry(0.038, 0.042, 0.19, 14), mats.lpgGreen, -0.10, 0.82, -0.04);
  addShadowMesh(g, new THREE.CylinderGeometry(0.032, 0.032, 0.16, 14), mats.bucketRed, 0.06, 0.80, 0.04);
  addShadowMesh(g, new THREE.CylinderGeometry(0.075, 0.045, 0.08, 16), mats.matteWhite, -0.05, 0.49, 0.0);
  addShadowMesh(g, new THREE.BoxGeometry(0.14, 0.11, 0.18), mats.woodTeak, 0.09, 0.22, 0.0);

  return g;
}

export function buildBroomAndMop(mats: HouseMaterialPalette): THREE.Group {
  const g = new THREE.Group();
  addContactShadow(g, 0.45, 0.32, mats);

  // Broom tilted slightly against wall
  const broom = new THREE.Group();
  broom.rotation.x = 0.09;
  broom.rotation.z = -0.06;
  addShadowMesh(broom, new THREE.CylinderGeometry(0.012, 0.012, 1.24, 10), mats.woodTeak, 0, 0.68, 0);
  addShadowMesh(broom, new THREE.BoxGeometry(0.24, 0.05, 0.045), mats.bucketRed, 0, 0.10, 0);
  const bristleMat = new THREE.MeshStandardMaterial({ color: 0x383c40, roughness: 0.92 });
  addShadowMesh(broom, new THREE.BoxGeometry(0.26, 0.10, 0.04), bristleMat, 0, 0.05, 0);
  broom.position.set(-0.08, 0, 0);
  g.add(broom);

  // Green microfiber mop next to broom
  const mop = new THREE.Group();
  mop.rotation.x = 0.08;
  mop.rotation.z = 0.07;
  addShadowMesh(mop, new THREE.CylinderGeometry(0.012, 0.012, 1.28, 10), mats.chromeSteel, 0, 0.70, 0);
  addShadowMesh(mop, new THREE.CylinderGeometry(0.05, 0.09, 0.11, 14), mats.lpgGreen, 0, 0.06, 0);
  mop.position.set(0.10, 0, 0.02);
  g.add(mop);

  return g;
}

export function buildKitchenCounterClutter(mats: HouseMaterialPalette): THREE.Group {
  const g = new THREE.Group();
  // Electric stainless kettle + black handle
  addShadowMesh(g, new THREE.CylinderGeometry(0.075, 0.095, 0.21, 18), mats.chromeSteel, 0, 0.105, 0);
  addShadowMesh(g, new THREE.CylinderGeometry(0.078, 0.078, 0.025, 18), mats.blackIron, 0, 0.215, 0);
  addShadowMesh(g, new THREE.BoxGeometry(0.024, 0.13, 0.045), mats.blackIron, 0.095, 0.12, 0);
  // Orange-wood cutting board leaning & oil bottle
  const board = addShadowMesh(g, createRoundedBoxGeometry(0.26, 0.018, 0.34, 0.02, 0.005), mats.woodTeak, -0.32, 0.14, -0.10);
  board.rotation.x = -0.32;
  const oilMat = new THREE.MeshPhysicalMaterial({ color: 0xd9a738, roughness: 0.15, transmission: 0.3, transparent: true, opacity: 0.9 });
  addShadowMesh(g, new THREE.CylinderGeometry(0.036, 0.038, 0.24, 14), oilMat, 0.22, 0.12, -0.05);
  return g;
}
