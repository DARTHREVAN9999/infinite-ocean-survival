import * as THREE from 'three';
import { FLAG_DYES } from '../game/economy';
import { PIRATE_FACTIONS } from '../game/factions';
import { FLEET_CLASS_SPECS } from '../game/fleet';
import {
  CrewMember,
  CustomFlagConfig,
  FleetShipData,
  FloatingCrateData,
  GhostSizeTier,
  PirateFactionId,
  ShipUpgrades,
  VesselClass,
  WreckArchetype,
} from '../game/types';
import {
  createCrownFlagConfig,
  createCustomFlagTexture,
  createCustomSailTexture,
  createFactionFlagConfig,
  createMerchantFlagConfig,
  ProceduralTextureSet,
} from './textures';

export interface BuiltPlayerShip {
  root: THREE.Group;
  sails: THREE.Mesh[];
  helmWheel: THREE.Object3D;
  flagMesh: THREE.Mesh | null;
  flagTexture: THREE.CanvasTexture;
  sailTexture?: THREE.CanvasTexture;
  crewActors: Array<{
    group: THREE.Group;
    role: CrewMember['role'];
    baseX: number;
    baseZ: number;
    phase: number;
    patrolAmp: number;
  }>;
  cannonMuzzles: THREE.Vector3[];
  cannonGroups: THREE.Group[];
  damagePatches: THREE.Group[];
  halfLength: number;
  halfBeam: number;
  lanternLight: THREE.PointLight;
}

export interface BuiltNpcShip {
  root: THREE.Group;
  sails: THREE.Mesh[];
  flagMesh: THREE.Mesh | null;
  flagTexture?: THREE.CanvasTexture;
  sailTexture?: THREE.CanvasTexture;
  ghostFog?: THREE.Group;
  fadeMaterials?: THREE.Material[];
  cannonGroups: THREE.Group[];
  damagePatches: THREE.Group[];
  halfLength: number;
  halfBeam: number;
}

function createHullDamagePatches(len: number, beam: number, deckY: number): THREE.Group[] {
  const patches: THREE.Group[] = [];
  const breachMat = new THREE.MeshStandardMaterial({
    color: 0x16110e,
    roughness: 0.96,
  });
  const splinterMat = new THREE.MeshStandardMaterial({
    color: 0x6e4f32,
    roughness: 0.9,
  });

  const spots = [
    { side: 1, z: -len * 0.16, y: deckY - 0.35, rot: 0.25 },
    { side: -1, z: len * 0.08, y: deckY - 0.28, rot: -0.3 },
    { side: 1, z: len * 0.2, y: deckY - 0.18, rot: 0.42 },
    { side: -1, z: -len * 0.22, y: deckY - 0.32, rot: -0.2 },
  ];

  for (const sp of spots) {
    const g = new THREE.Group();
    g.position.set(sp.side * (beam * 0.46), sp.y, sp.z);

    const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.22, 8), breachMat);
    hole.rotation.z = Math.PI / 2;
    g.add(hole);

    for (let k = 0; k < 3; k++) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.85), splinterMat);
      plank.position.set(sp.side * 0.08, (k - 1) * 0.24, (k % 2 === 0 ? 1 : -1) * 0.22);
      plank.rotation.x = sp.rot + (k - 1) * 0.45;
      g.add(plank);
    }

    g.visible = false;
    patches.push(g);
  }
  return patches;
}

function createTaperedHullGeometry(length: number, beam: number, depth: number): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  const hl = length * 0.5;
  const hb = beam * 0.5;

  shape.moveTo(0, -hl);
  shape.bezierCurveTo(hb * 0.85, -hl * 0.62, hb * 1.05, -hl * 0.05, hb * 0.94, hl * 0.55);
  shape.lineTo(hb * 0.72, hl);
  shape.lineTo(-hb * 0.72, hl);
  shape.lineTo(-hb * 0.94, hl * 0.55);
  shape.bezierCurveTo(-hb * 1.05, -hl * 0.05, -hb * 0.85, -hl * 0.62, 0, -hl);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.25,
    bevelSize: 0.22,
    bevelSegments: 2,
    curveSegments: 14,
  });

  geo.rotateX(Math.PI / 2);

  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const t = THREE.MathUtils.clamp((y + depth) / depth, 0, 1);
    const flare = 0.64 + 0.36 * Math.pow(t, 0.7);
    const sheer = Math.pow(Math.abs(z) / hl, 2) * 0.42 * (z < 0 ? 1.15 : 0.85);
    pos.setX(i, x * flare);
    pos.setY(i, y + depth * 0.55 + sheer);
  }
  geo.computeVertexNormals();
  return geo;
}

function createBillowingSailGeometry(width: number, height: number): THREE.PlaneGeometry {
  const geo = new THREE.PlaneGeometry(width, height, 10, 8);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const nx = x / (width * 0.5);
    const ny = y / (height * 0.5);
    const belly = (1 - nx * nx * 0.45) * (1 - ny * ny * 0.72) * (width * 0.19);
    pos.setZ(i, -belly);
  }
  geo.computeVertexNormals();
  return geo;
}

function createWavingFlagMeshFromTexture(
  tex: THREE.CanvasTexture,
  width: number,
  height: number
): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(width, height, 8, 2);
  // Shift geometry so X=0 is attached to masthead and flag streams out along +X (then rotated along ship Z)
  geo.translate(width * 0.5, 0, 0);
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.65,
    side: THREE.DoubleSide,
    transparent: true,
    alphaTest: 0.08,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.y = -Math.PI / 2;
  mesh.userData.baseWidth = width;
  return mesh;
}

function createWavingFlagMesh(
  cfg: CustomFlagConfig,
  width: number,
  height: number
): { mesh: THREE.Mesh; texture: THREE.CanvasTexture } {
  const tex = createCustomFlagTexture(cfg, 4);
  return { mesh: createWavingFlagMeshFromTexture(tex, width, height), texture: tex };
}

export function animateWavingFlag(flagMesh: THREE.Mesh | null, time: number, windFactor = 1): void {
  if (!flagMesh) return;
  const pos = flagMesh.geometry.attributes.position;
  const w = (flagMesh.userData.baseWidth as number) || 1.8;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const distNorm = THREE.MathUtils.clamp(x / w, 0, 1);
    const ripple = Math.sin(time * (4.2 + windFactor * 1.8) - distNorm * 4.5 + y * 1.2) * 0.26 * distNorm;
    pos.setZ(i, ripple);
  }
  pos.needsUpdate = true;
}

function createSailorFigure(member: CrewMember): THREE.Group {
  const g = new THREE.Group();

  const legsMat = new THREE.MeshStandardMaterial({ color: 0x262930, roughness: 0.85 });
  const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.19, 0.58, 7), legsMat);
  legs.position.y = 0.29;
  g.add(legs);

  const coatMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(member.coatColor),
    roughness: 0.78,
  });
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.17, 0.58, 8), coatMat);
  torso.position.y = 0.84;
  g.add(torso);

  const skinMat = new THREE.MeshStandardMaterial({ color: 0xd9b08c, roughness: 0.7 });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), skinMat);
  head.position.y = 1.28;
  g.add(head);

  if (member.hatStyle === 'tricorne') {
    const hatMat = new THREE.MeshStandardMaterial({ color: 0x1e1a18, roughness: 0.82 });
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.28, 0.06, 3), hatMat);
    brim.position.y = 1.42;
    g.add(brim);
  } else if (member.hatStyle === 'bandana') {
    const bandMat = new THREE.MeshStandardMaterial({ color: 0x8f2d27, roughness: 0.75 });
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.1, 8), bandMat);
    band.position.y = 1.38;
    g.add(band);
  } else if (member.hatStyle === 'beanie') {
    const capMat = new THREE.MeshStandardMaterial({ color: 0x4b565e, roughness: 0.9 });
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.165, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.6),
      capMat
    );
    cap.position.y = 1.32;
    g.add(cap);
  }

  return g;
}

function createCannonMesh(
  ironMat: THREE.Material,
  woodMat: THREE.Material,
  brassMat: THREE.Material,
  scale = 1
): THREE.Group {
  const g = new THREE.Group();
  const carriage = new THREE.Mesh(new THREE.BoxGeometry(0.55 * scale, 0.36 * scale, 0.92 * scale), woodMat);
  carriage.position.y = 0.24 * scale;
  g.add(carriage);

  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12 * scale, 0.18 * scale, 1.45 * scale, 10),
    ironMat
  );
  barrel.rotation.z = -Math.PI / 2;
  barrel.position.set(0.28 * scale, 0.48 * scale, 0);
  g.add(barrel);

  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.16 * scale, 0.03 * scale, 6, 12), brassMat);
  ring.rotation.y = Math.PI / 2;
  ring.position.set(-0.08 * scale, 0.48 * scale, 0);
  g.add(ring);

  return g;
}

function createHelmWheel(woodMat: THREE.Material, brassMat: THREE.Material): THREE.Group {
  const stand = new THREE.Group();
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.95, 0.28), woodMat);
  post.position.y = 0.48;
  stand.add(post);

  const wheel = new THREE.Group();
  wheel.position.set(0, 0.92, -0.18);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.045, 7, 16), woodMat);
  wheel.add(rim);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.14, 10), brassMat);
  hub.rotation.x = Math.PI / 2;
  wheel.add(hub);

  for (let i = 0; i < 6; i++) {
    const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.04, 6), woodMat);
    spoke.rotation.z = (i * Math.PI) / 3;
    wheel.add(spoke);
  }
  stand.add(wheel);
  stand.userData.wheel = wheel;
  return stand;
}

export function buildPlayerShip(
  upgrades: ShipUpgrades,
  crew: CrewMember[],
  customFlag: CustomFlagConfig,
  textures: ProceduralTextureSet
): BuiltPlayerShip {
  const root = new THREE.Group();

  const HULL_DIMS: Record<number, { baseLength: number; baseWidth: number; baseDepth: number }> = {
    1: { baseLength: 10.6, baseWidth: 3.3, baseDepth: 2.0 },
    2: { baseLength: 12.4, baseWidth: 3.8, baseDepth: 2.25 },
    3: { baseLength: 14.8, baseWidth: 4.4, baseDepth: 2.55 },
    4: { baseLength: 17.6, baseWidth: 5.1, baseDepth: 2.9 },
    5: { baseLength: 20.6, baseWidth: 5.8, baseDepth: 3.3 },
    6: { baseLength: 23.8, baseWidth: 6.5, baseDepth: 3.7 },
    7: { baseLength: 27.4, baseWidth: 7.4, baseDepth: 4.15 },
  };
  const tierDef = HULL_DIMS[upgrades.hullTier] ?? HULL_DIMS[1];
  const len = tierDef.baseLength + upgrades.hullLengthBonus * 2.1;
  const beam = tierDef.baseWidth + upgrades.hullWidthBonus * 0.65;
  const depth = tierDef.baseDepth + upgrades.deckLevel * 0.28;
  const deckY = depth * 0.56;

  const hullMat = new THREE.MeshStandardMaterial({
    map: textures.woodHullMap,
    bumpMap: textures.woodHullBump,
    bumpScale: 0.08,
    color: upgrades.hullTier >= 6 ? 0xd9c2a3 : 0xffffff,
    roughness: 0.78,
    metalness: 0.05,
  });

  const darkTrimMat = new THREE.MeshStandardMaterial({
    color: upgrades.reinforcementTier >= 2 ? 0x26180f : 0x352214,
    roughness: 0.82,
    metalness: 0.08,
  });

  const deckMat = new THREE.MeshStandardMaterial({
    map: textures.woodDeckMap,
    bumpMap: textures.woodHullBump,
    bumpScale: 0.04,
    color: 0xffffff,
    roughness: 0.86,
    metalness: 0.02,
  });

  const customSailTex = createCustomSailTexture(customFlag, 4);
  const sailMat = new THREE.MeshStandardMaterial({
    map: customSailTex,
    color: 0xffffff,
    roughness: 0.88,
    metalness: 0.0,
    side: THREE.DoubleSide,
  });

  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xd4a44d,
    roughness: 0.24,
    metalness: 0.88,
  });

  const ironMat = new THREE.MeshStandardMaterial({
    map: textures.ironPlateMap,
    bumpMap: textures.ironBump,
    bumpScale: 0.06,
    color: 0xffffff,
    roughness: 0.42,
    metalness: 0.78,
  });

  const ropeMat = new THREE.MeshStandardMaterial({
    color: 0x8c7758,
    roughness: 0.92,
  });

  // 1. Primary Tapered Hull (scales physically with Hull Tiers 1..7 + Length/Width extensions!)
  const hullGeo = createTaperedHullGeometry(len, beam, depth);
  const hullMesh = new THREE.Mesh(hullGeo, hullMat);
  hullMesh.castShadow = true;
  hullMesh.receiveShadow = true;
  root.add(hullMesh);

  // 2. Deck planking
  const deckMesh = new THREE.Mesh(new THREE.BoxGeometry(beam * 0.82, 0.14, len * 0.82), deckMat);
  deckMesh.position.set(0, deckY + 0.04, len * 0.03);
  deckMesh.receiveShadow = true;
  root.add(deckMesh);

  // 3. Gunwale railings
  for (const side of [-1, 1]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.55, len * 0.76), darkTrimMat);
    rail.position.set(side * (beam * 0.44), deckY + 0.34, len * 0.05);
    rail.castShadow = true;
    root.add(rail);
  }
  const sternRail = new THREE.Mesh(new THREE.BoxGeometry(beam * 0.72, 0.65, 0.24), darkTrimMat);
  sternRail.position.set(0, deckY + 0.4, len * 0.47);
  root.add(sternRail);

  // 4. Bowsprit (+ gilded figurehead on higher tiers)
  const bowspritLen = len * 0.34;
  const bowsprit = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.16, bowspritLen, 8),
    darkTrimMat
  );
  bowsprit.rotation.x = Math.PI * 0.42;
  bowsprit.position.set(0, deckY + 0.72, -len * 0.52);
  root.add(bowsprit);

  if (upgrades.hullTier >= 5) {
    const figurehead = new THREE.Mesh(new THREE.ConeGeometry(0.32, 1.1, 6), brassMat);
    figurehead.rotation.x = -Math.PI * 0.32;
    figurehead.position.set(0, deckY + 0.15, -len * 0.51);
    root.add(figurehead);
  }

  // 5. External Reinforcement Wales & Armor Plating (tiers 0..4)
  if (upgrades.reinforcementTier >= 1) {
    for (const side of [-1, 1]) {
      const wale = new THREE.Mesh(
        new THREE.BoxGeometry(0.14 + upgrades.reinforcementTier * 0.05, 0.28, len * 0.78),
        upgrades.reinforcementTier >= 3 ? brassMat : darkTrimMat
      );
      wale.position.set(side * (beam * 0.465), deckY + 0.08, len * 0.02);
      root.add(wale);
    }
  }

  if (upgrades.armorPlating >= 1) {
    for (const side of [-1, 1]) {
      const plateH = depth * Math.min(0.85, 0.22 + upgrades.armorPlating * 0.16);
      const plate = new THREE.Mesh(
        new THREE.BoxGeometry(0.16 + upgrades.armorPlating * 0.03, plateH, len * 0.74),
        ironMat
      );
      plate.position.set(side * (beam * 0.485), deckY - 0.14, len * 0.04);
      root.add(plate);
    }
  }

  // 6. Multi-Tier Deck Superstructure (deckLevel 1..3 or hullTier >= 4)
  let helmY = deckY + 0.1;
  let helmZ = len * 0.33;
  const effectiveDeckLvl = Math.max(upgrades.deckLevel, upgrades.hullTier >= 5 ? 2 : upgrades.hullTier >= 3 ? 1 : 0);
  if (effectiveDeckLvl >= 1) {
    const qLen = len * (0.28 + effectiveDeckLvl * 0.03);
    const qHeight = 1.2 + effectiveDeckLvl * 0.35;
    const qDeck = new THREE.Mesh(new THREE.BoxGeometry(beam * 0.84, qHeight, qLen), hullMat);
    qDeck.position.set(0, deckY + qHeight * 0.5, len * 0.31);
    qDeck.castShadow = true;
    root.add(qDeck);

    const qTop = new THREE.Mesh(new THREE.BoxGeometry(beam * 0.82, 0.12, qLen * 0.96), deckMat);
    qTop.position.set(0, deckY + qHeight + 0.06, len * 0.31);
    root.add(qTop);

    const winMat = new THREE.MeshStandardMaterial({
      color: 0xffd180,
      emissive: 0xffa73b,
      emissiveIntensity: 0.75,
      roughness: 0.2,
    });
    for (let w = -1; w <= 1; w++) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.42, 0.08), winMat);
      win.position.set(w * (beam * 0.22), deckY + qHeight * 0.52, len * 0.46);
      root.add(win);
    }
    helmY = deckY + qHeight + 0.12;
    helmZ = len * 0.25;

    // Forecastle on deckLevel >= 2
    if (effectiveDeckLvl >= 2) {
      const fLen = len * 0.22;
      const fDeck = new THREE.Mesh(new THREE.BoxGeometry(beam * 0.7, 0.9, fLen), hullMat);
      fDeck.position.set(0, deckY + 0.45, -len * 0.29);
      root.add(fDeck);
    }

    // Admiral's upper poop castle on deckLevel >= 3
    if (effectiveDeckLvl >= 3) {
      const pDeck = new THREE.Mesh(
        new THREE.BoxGeometry(beam * 0.68, 0.95, len * 0.18),
        hullMat
      );
      pDeck.position.set(0, deckY + qHeight + 0.5, len * 0.38);
      root.add(pDeck);
      helmY = deckY + qHeight + 0.98;
    }
  }

  // 7. Helm wheel
  const helmStand = createHelmWheel(darkTrimMat, brassMat);
  helmStand.position.set(0, helmY, helmZ);
  root.add(helmStand);
  const helmWheel = helmStand.userData.wheel as THREE.Object3D;

  // 8. Masts, sails & Waving Custom Masthead Flag
  const sails: THREE.Mesh[] = [];
  const sailScale = 1 + (upgrades.sailTier - 1) * 0.14;
  const mastConfigs: Array<{ z: number; h: number; sailW: number; sailH: number }> = [];
  const mastCount = upgrades.hullTier >= 5 ? 3 : upgrades.extraMast || upgrades.hullTier >= 3 ? 2 : 1;

  if (mastCount === 3) {
    mastConfigs.push(
      { z: -len * 0.24, h: 10.5 + upgrades.hullTier * 0.85, sailW: beam * 1.05 * sailScale, sailH: 4.9 * sailScale },
      { z: len * 0.02, h: 12.6 + upgrades.hullTier * 0.95, sailW: beam * 1.28 * sailScale, sailH: 5.8 * sailScale },
      { z: len * 0.27, h: 9.8 + upgrades.hullTier * 0.75, sailW: beam * 0.92 * sailScale, sailH: 4.3 * sailScale }
    );
  } else if (mastCount === 2) {
    mastConfigs.push(
      { z: -len * 0.18, h: (7.5 + upgrades.hullTier * 1.15) * 0.9, sailW: beam * 1.12 * sailScale, sailH: (3.8 + upgrades.hullTier * 0.45) * sailScale },
      { z: len * 0.12, h: 8.6 + upgrades.hullTier * 1.25, sailW: beam * 1.28 * sailScale, sailH: (4.4 + upgrades.hullTier * 0.52) * sailScale }
    );
  } else {
    mastConfigs.push({
      z: -len * 0.04,
      h: 7.4 + upgrades.hullTier * 1.25,
      sailW: beam * 1.22 * sailScale,
      sailH: (4.0 + upgrades.hullTier * 0.5) * sailScale,
    });
  }

  let flagMesh: THREE.Mesh | null = null;
  let flagTexture: THREE.CanvasTexture | null = null;
  const mainMastIdx = mastCount === 3 ? 1 : mastConfigs.length - 1;

  mastConfigs.forEach((mc, idx) => {
    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.21, mc.h, 10),
      darkTrimMat
    );
    mast.position.set(0, deckY + mc.h * 0.5, mc.z);
    mast.castShadow = true;
    root.add(mast);

    const yardY = deckY + mc.h * 0.72;
    const yard = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.08, mc.sailW * 1.08, 8),
      darkTrimMat
    );
    yard.rotation.z = Math.PI / 2;
    yard.position.set(0, yardY, mc.z - 0.16);
    root.add(yard);

    const sailGeo = createBillowingSailGeometry(mc.sailW, mc.sailH);
    const sail = new THREE.Mesh(sailGeo, sailMat);
    sail.position.set(0, yardY - mc.sailH * 0.48, mc.z - 0.22);
    sail.castShadow = true;
    root.add(sail);
    sails.push(sail);

    if (upgrades.sailTier >= 2 || upgrades.hullTier >= 3) {
      const topGeo = createBillowingSailGeometry(mc.sailW * 0.72, mc.sailH * 0.52);
      const topSail = new THREE.Mesh(topGeo, sailMat);
      topSail.position.set(0, deckY + mc.h * 0.87, mc.z - 0.18);
      root.add(topSail);
      sails.push(topSail);
    }

    for (const side of [-1, 1]) {
      const shroudLen = Math.hypot(mc.h * 0.8, beam * 0.44);
      const shroud = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, shroudLen, 5), ropeMat);
      shroud.position.set(side * beam * 0.22, deckY + mc.h * 0.4, mc.z + 0.1);
      shroud.rotation.z = side * Math.atan2(beam * 0.44, mc.h * 0.8);
      root.add(shroud);
    }

    if (upgrades.crowsNest && idx === mainMastIdx) {
      const nest = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.52, 0.72, 10), darkTrimMat);
      nest.position.set(0, deckY + mc.h * 0.82, mc.z);
      root.add(nest);
    }

    if (idx === mainMastIdx) {
      const flagBuilt = createWavingFlagMesh(customFlag, 2.2 + upgrades.hullTier * 0.18, 1.35 + upgrades.hullTier * 0.1);
      flagBuilt.mesh.position.set(0, deckY + mc.h - 0.15, mc.z);
      root.add(flagBuilt.mesh);
      flagMesh = flagBuilt.mesh;
      flagTexture = flagBuilt.texture;
    }
  });

  if (!flagTexture) {
    flagTexture = createCustomFlagTexture(customFlag, 4);
  }

  // 9. Cargo crates & barrels + Facilities
  const crateMat = new THREE.MeshStandardMaterial({ color: 0x7c5a37, roughness: 0.88 });
  const barrelMat = new THREE.MeshStandardMaterial({ color: 0x5c3e24, roughness: 0.84 });

  const cargoCount = 2 + upgrades.storageTier * 2;
  for (let i = 0; i < cargoCount; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const isBarrel = i % 3 === 0;
    const prop = isBarrel
      ? new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.65, 9), barrelMat)
      : new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.54, 0.62), crateMat);
    prop.position.set(
      side * (beam * 0.28),
      deckY + 0.36,
      -len * 0.18 + Math.floor(i / 2) * 1.15
    );
    root.add(prop);
  }

  // 10. Stern Brass Lantern
  const lanternPost = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.35, 6), brassMat);
  lanternPost.position.set(0, helmY + 0.65, len * 0.47);
  root.add(lanternPost);
  const lanternBulb = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.22, 0),
    new THREE.MeshStandardMaterial({
      color: 0xffe4a1,
      emissive: 0xffa834,
      emissiveIntensity: 1.6,
      roughness: 0.15,
    })
  );
  lanternBulb.position.set(0, helmY + 1.35, len * 0.47);
  root.add(lanternBulb);

  const lanternLight = new THREE.PointLight(0xffb554, 2.2, 26, 1.6);
  lanternLight.position.set(0, helmY + 1.5, len * 0.42);
  root.add(lanternLight);

  // 11. Mounted Cannons (8 weapon classes visually scaled)
  const cannonMuzzles: THREE.Vector3[] = [];
  const cannonGroups: THREE.Group[] = [];
  if (upgrades.cannonCount > 0 && upgrades.weaponType !== 'none') {
    const scaleMap: Record<string, number> = {
      swivel: 0.68,
      light: 0.85,
      medium: 0.96,
      carronade: 1.06,
      heavy: 1.14,
      longGun: 1.22,
      advancedHeavy: 1.28,
      specialised: 1.34,
    };
    const scale = scaleMap[upgrades.weaponType] ?? 0.95;
    const perSide = Math.ceil(upgrades.cannonCount / 2);
    for (let i = 0; i < upgrades.cannonCount; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const slotIdx = Math.floor(i / 2);
      const t = perSide === 1 ? 0 : (slotIdx / (perSide - 1)) * 2 - 1;
      const cz = t * (len * 0.28);
      const cx = side * (beam * 0.37);

      const cannon = createCannonMesh(ironMat, darkTrimMat, brassMat, scale);
      cannon.position.set(cx, deckY + 0.16, cz);
      cannon.userData.baseX = cx;
      cannon.userData.side = side;
      if (side === -1) cannon.rotation.y = Math.PI;
      root.add(cannon);
      cannonGroups.push(cannon);

      cannonMuzzles.push(new THREE.Vector3(cx + side * 0.9, deckY + 0.65, cz));
    }
  }

  // 11b. Dynamic hull damage breach patches
  const damagePatches = createHullDamagePatches(len, beam, deckY);
  for (const patch of damagePatches) {
    root.add(patch);
  }

  // 12. Visible animated crew members stationed across all 8+1 roles
  const crewActors: BuiltPlayerShip['crewActors'] = [];
  const visibleCrew = crew.slice(0, Math.min(crew.length, 20));
  visibleCrew.forEach((member, idx) => {
    const actor = createSailorFigure(member);
    let bx = 0;
    let bz = 0;
    let by = deckY + 0.1;

    if (member.role === 'sailor') {
      bx = (idx % 2 === 0 ? -1 : 1) * (beam * 0.22);
      bz = -len * 0.12 + ((idx % 3) - 1) * 1.25;
    } else if (member.role === 'cannoneer') {
      bx = (idx % 2 === 0 ? 1 : -1) * (beam * 0.28);
      bz = ((idx % 4) - 1.5) * 1.3;
    } else if (member.role === 'repair') {
      bx = (idx % 2 === 0 ? -1 : 1) * (beam * 0.15);
      bz = len * 0.08 + (idx % 2) * 1.1;
    } else if (member.role === 'lookout' || member.role === 'navigator') {
      bx = member.role === 'navigator' ? beam * 0.15 : 0;
      bz = member.role === 'lookout' ? -len * 0.34 : helmZ - 0.6;
      if (member.role === 'navigator') by = helmY;
    } else if (member.role === 'helmsman') {
      bx = -0.35;
      bz = helmZ + 0.45;
      by = helmY;
    } else if (member.role === 'medical') {
      bx = beam * 0.18;
      bz = len * 0.18;
    } else {
      bx = (idx % 2 === 0 ? -1 : 1) * (beam * 0.2);
      bz = len * 0.22;
      by = effectiveDeckLvl >= 1 ? helmY : deckY + 0.1;
    }

    actor.position.set(bx, by, bz);
    root.add(actor);
    crewActors.push({
      group: actor,
      role: member.role,
      baseX: bx,
      baseZ: bz,
      phase: idx * 1.37,
      patrolAmp: member.role === 'resting' ? 0.08 : 0.45,
    });
  });

  return {
    root,
    sails,
    helmWheel,
    flagMesh,
    flagTexture,
    sailTexture: customSailTex,
    crewActors,
    cannonMuzzles,
    cannonGroups,
    damagePatches,
    halfLength: len * 0.5,
    halfBeam: beam * 0.5,
    lanternLight,
  };
}

const VESSEL_SIZE_SPECS: Record<
  VesselClass,
  { len: number; beam: number; depth: number; masts: number; guns: number; raisedCastle: boolean; hullTint: number }
> = {
  fishing_boat: { len: 10.5, beam: 4.1, depth: 1.75, masts: 1, guns: 0, raisedCastle: false, hullTint: 0x624933 },
  fishing_trawler: { len: 14.5, beam: 5.2, depth: 2.15, masts: 2, guns: 0, raisedCastle: false, hullTint: 0x54402f },
  small_merchant: { len: 12.2, beam: 4.6, depth: 2.0, masts: 1, guns: 1, raisedCastle: false, hullTint: 0x664328 },
  medium_merchant: { len: 17.0, beam: 6.2, depth: 2.55, masts: 2, guns: 2, raisedCastle: true, hullTint: 0x5c3e26 },
  large_cargo: { len: 22.8, beam: 8.1, depth: 3.15, masts: 3, guns: 4, raisedCastle: true, hullTint: 0x523620 },
  passenger_ship: { len: 20.5, beam: 6.9, depth: 2.9, masts: 2, guns: 2, raisedCastle: true, hullTint: 0x6f4a2b },
  supply_ship: { len: 18.8, beam: 6.8, depth: 2.8, masts: 2, guns: 2, raisedCastle: true, hullTint: 0x5e4933 },
  wealthy_trader: { len: 24.5, beam: 8.4, depth: 3.35, masts: 3, guns: 6, raisedCastle: true, hullTint: 0x764c24 },
  treasure_ship: { len: 27.5, beam: 9.2, depth: 3.7, masts: 3, guns: 8, raisedCastle: true, hullTint: 0x825523 },
  crown_patrol: { len: 14.2, beam: 5.0, depth: 2.2, masts: 2, guns: 4, raisedCastle: true, hullTint: 0x3b485b },
  crown_sloop: { len: 16.5, beam: 5.7, depth: 2.45, masts: 2, guns: 6, raisedCastle: true, hullTint: 0x37475e },
  crown_corvette: { len: 19.5, beam: 6.7, depth: 2.8, masts: 2, guns: 6, raisedCastle: true, hullTint: 0x334155 },
  crown_frigate: { len: 23.2, beam: 7.8, depth: 3.2, masts: 3, guns: 8, raisedCastle: true, hullTint: 0x2c3b4f },
  crown_warship: { len: 26.0, beam: 8.5, depth: 3.5, masts: 3, guns: 10, raisedCastle: true, hullTint: 0x293548 },
  crown_ship_of_line: { len: 29.2, beam: 9.2, depth: 3.8, masts: 3, guns: 12, raisedCastle: true, hullTint: 0x222e42 },
  crown_flagship: { len: 31.5, beam: 9.8, depth: 4.0, masts: 3, guns: 14, raisedCastle: true, hullTint: 0x1e293b },
  crown_supply: { len: 18.5, beam: 6.4, depth: 2.65, masts: 2, guns: 4, raisedCastle: true, hullTint: 0x425166 },
};

const GHOST_SIZE_MULT: Record<GhostSizeTier, number> = {
  small: 0.82,
  medium: 1.05,
  large: 1.42,
  enormous: 1.95,
  colossal: 2.85,
};

/**
 * Builds any of the ship classes as Civilian, Crown Navy, Pirate Faction, or Ghost vessels.
 */
export function buildNpcShip(
  vesselClass: VesselClass,
  factionKind: 'merchant' | 'crown' | 'pirate',
  textures: ProceduralTextureSet,
  pirateFactionId?: PirateFactionId,
  cannonOverride?: number,
  isGhost = false,
  ghostSize?: GhostSizeTier
): BuiltNpcShip {
  const root = new THREE.Group();
  const baseCfg = VESSEL_SIZE_SPECS[vesselClass] ?? VESSEL_SIZE_SPECS.medium_merchant;
  const gMult = isGhost ? GHOST_SIZE_MULT[ghostSize ?? 'medium'] : 1;
  const cfg = {
    ...baseCfg,
    len: baseCfg.len * gMult,
    beam: baseCfg.beam * (1 + (gMult - 1) * 0.82),
    depth: baseCfg.depth * (1 + (gMult - 1) * 0.72),
  };
  const deckY = cfg.depth * 0.56;

  const factionMeta = pirateFactionId ? PIRATE_FACTIONS[pirateFactionId] : null;
  const hullColor = isGhost
    ? 0x172427
    : factionKind === 'pirate' && factionMeta
      ? new THREE.Color(factionMeta.hullTint).getHex()
      : cfg.hullTint;

  const hullMat = new THREE.MeshStandardMaterial({
    map: textures.woodHullMap,
    bumpMap: textures.woodHullBump,
    bumpScale: 0.08,
    color: isGhost ? 0x11251d : hullColor,
    emissive: isGhost ? 0x0a3826 : 0x000000,
    emissiveIntensity: isGhost ? 0.45 : 0,
    roughness: isGhost ? 0.92 : 0.78,
    transparent: false,
    opacity: isGhost ? 0.92 : 1,
  });

  const trimMat = new THREE.MeshStandardMaterial({
    color: isGhost
      ? 0x0e1d17
      : factionKind === 'pirate'
        ? 0x1b1412
        : factionKind === 'crown'
          ? 0xd4a44d
          : 0x8f6b36,
    emissive: isGhost ? 0x082e20 : 0x000000,
    emissiveIntensity: isGhost ? 0.38 : 0,
    roughness: 0.55,
    metalness: factionKind === 'pirate' || isGhost ? 0.12 : 0.42,
    transparent: false,
    opacity: isGhost ? 0.92 : 1,
  });

  const npcTextureKey = isGhost
    ? 'ghost_vessel'
    : factionKind === 'pirate' && pirateFactionId
      ? `pirate_${pirateFactionId}`
      : factionKind === 'crown'
        ? 'crown_navy'
        : vesselClass === 'fishing_boat' || vesselClass === 'fishing_trawler'
          ? 'merchant_fishing'
          : vesselClass === 'treasure_ship' || vesselClass === 'wealthy_trader'
            ? 'merchant_wealthy'
            : 'merchant_standard';

  const flagCfg: CustomFlagConfig =
    isGhost
      ? {
          primaryDye: 'obsidian',
          secondaryDye: 'teal_abyss',
          accentDye: 'bone_silver',
          pattern: 'saltire',
          emblem: 'skull',
          shape: 'swallowtail',
          decorativeBorder: false,
        }
      : factionKind === 'pirate' && pirateFactionId
        ? createFactionFlagConfig(pirateFactionId)
        : factionKind === 'crown'
          ? createCrownFlagConfig()
          : createMerchantFlagConfig(vesselClass);

  const cachedFlagTex = textures.getCachedFlagTexture(npcTextureKey, flagCfg);
  const sailMap = isGhost
    ? textures.sailGhostMap
    : textures.getCachedSailTexture(npcTextureKey, flagCfg);

  const sailMat = new THREE.MeshStandardMaterial({
    map: sailMap,
    color: isGhost ? 0x80ffc2 : 0xffffff,
    emissive: isGhost ? 0x147a4c : 0x000000,
    emissiveIntensity: isGhost ? 0.62 : 0,
    transparent: isGhost,
    opacity: isGhost ? 0.86 : 1,
    roughness: 0.88,
    side: THREE.DoubleSide,
  });

  const ironMat = new THREE.MeshStandardMaterial({ color: 0x2d3138, roughness: 0.45, metalness: 0.75 });
  const brassMat = new THREE.MeshStandardMaterial({
    color: isGhost ? 0x458068 : 0xd4a44d,
    roughness: 0.28,
    metalness: 0.85,
  });

  const hull = new THREE.Mesh(createTaperedHullGeometry(cfg.len, cfg.beam, cfg.depth), hullMat);
  hull.castShadow = !isGhost;
  root.add(hull);

  if (cfg.raisedCastle) {
    const castle = new THREE.Mesh(
      new THREE.BoxGeometry(cfg.beam * 0.82, 1.85, cfg.len * 0.28),
      hullMat
    );
    castle.position.set(0, deckY + 0.92, cfg.len * 0.33);
    root.add(castle);
  }

  // Fishing boats carry nets/crates; passenger ships carry extra cabin lanterns
  if (vesselClass === 'fishing_boat' || vesselClass === 'fishing_trawler') {
    const netMat = new THREE.MeshStandardMaterial({ color: 0x9ca3af, roughness: 0.95 });
    const rack = new THREE.Mesh(new THREE.BoxGeometry(cfg.beam * 0.65, 0.75, 1.6), netMat);
    rack.position.set(0, deckY + 0.45, cfg.len * 0.12);
    root.add(rack);
  }

  const sprit = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.18, cfg.len * 0.32, 7), trimMat);
  sprit.rotation.x = Math.PI * 0.42;
  sprit.position.set(0, deckY + 0.8, -cfg.len * 0.52);
  root.add(sprit);

  const sails: THREE.Mesh[] = [];
  let flagMesh: THREE.Mesh | null = null;

  for (let m = 0; m < cfg.masts; m++) {
    const t = cfg.masts === 1 ? 0 : (m / (cfg.masts - 1)) * 2 - 1;
    const mz = t * cfg.len * 0.24;
    const mh = 8.4 + cfg.depth * 2.15 - Math.abs(t) * 1.4;
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.22, mh, 8), trimMat);
    mast.position.set(0, deckY + mh * 0.5, mz);
    if (isGhost) mast.rotation.z = (m % 2 === 0 ? 1 : -1) * 0.05;
    root.add(mast);

    const sw = cfg.beam * 1.24 * (1 - Math.abs(t) * 0.16);
    const sh = mh * 0.46;
    const yard = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, sw * 1.08, 7), trimMat);
    yard.rotation.z = Math.PI / 2;
    yard.position.set(0, deckY + mh * 0.72, mz - 0.16);
    root.add(yard);

    const sail = new THREE.Mesh(createBillowingSailGeometry(sw, sh), sailMat);
    sail.position.set(0, deckY + mh * 0.72 - sh * 0.48, mz - 0.22);
    root.add(sail);
    sails.push(sail);

    if (m === cfg.masts - 1) {
      const builtFlagMesh = createWavingFlagMeshFromTexture(cachedFlagTex, 2.3, 1.35);
      builtFlagMesh.position.set(0, deckY + mh - 0.15, mz);
      root.add(builtFlagMesh);
      flagMesh = builtFlagMesh;
    }
  }

  const guns = isGhost ? Math.min(6, cannonOverride ?? cfg.guns) : cannonOverride ?? cfg.guns;
  const cannonGroups: THREE.Group[] = [];
  const perSide = Math.max(1, Math.ceil(guns / 2));
  for (let i = 0; i < guns; i++) {
    const side = i % 2 === 0 ? 1 : -1;
    const sIdx = Math.floor(i / 2);
    const t = perSide <= 1 ? 0 : (sIdx / (perSide - 1)) * 2 - 1;
    const cannon = createCannonMesh(ironMat, trimMat, brassMat, 0.88);
    const cx = side * (cfg.beam * 0.38);
    cannon.position.set(cx, deckY + 0.15, t * cfg.len * 0.24);
    cannon.userData.baseX = cx;
    cannon.userData.side = side;
    if (side === -1) cannon.rotation.y = Math.PI;
    root.add(cannon);
    cannonGroups.push(cannon);
  }

  const damagePatches = isGhost ? [] : createHullDamagePatches(cfg.len, cfg.beam, deckY);
  for (const patch of damagePatches) {
    root.add(patch);
  }

  const figureColor =
    factionKind === 'pirate' && factionMeta
      ? factionMeta.coatColor
      : factionKind === 'crown'
        ? '#1d4ed8'
        : '#3b5972';
  if (!isGhost) {
    const figureMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(figureColor),
      roughness: 0.82,
    });
    for (let c = 0; c < 4; c++) {
      const crewMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 1.35, 7), figureMat);
      crewMesh.position.set(((c % 2) * 2 - 1) * cfg.beam * 0.2, deckY + 0.7, (c - 1.5) * 1.7);
      root.add(crewMesh);
    }
  }

  const npcLanternPost = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 1.6, 6), brassMat);
  npcLanternPost.position.set(0, deckY + (cfg.raisedCastle ? 2.4 : 0.8), cfg.len * 0.46);
  root.add(npcLanternPost);

  const npcLanternMat = new THREE.MeshStandardMaterial({
    color: isGhost ? 0x4dff9e : factionKind === 'pirate' ? 0xff7b66 : factionKind === 'crown' ? 0x93c5fd : 0xffe49c,
    emissive: isGhost ? 0x22e87a : factionKind === 'pirate' ? 0xe03220 : factionKind === 'crown' ? 0x3b82f6 : 0xffa62b,
    emissiveIntensity: isGhost ? 2.8 : 2.0,
    roughness: 0.2,
  });
  const npcLanternBulb = new THREE.Mesh(new THREE.OctahedronGeometry(0.34, 0), npcLanternMat);
  npcLanternBulb.position.set(0, deckY + (cfg.raisedCastle ? 3.25 : 1.65), cfg.len * 0.46);
  root.add(npcLanternBulb);

  let ghostFog: THREE.Group | undefined;
  const fadeMaterials: THREE.Material[] = [];

  if (isGhost) {
    fadeMaterials.push(hullMat, trimMat, sailMat, npcLanternMat);

    // Spectral glowing stern cabin windows (self-emissive, zero PointLight overhead)
    const ghostWinMat = new THREE.MeshStandardMaterial({
      color: 0x5effa8,
      emissive: 0x22d976,
      emissiveIntensity: 2.3,
      roughness: 0.15,
    });
    fadeMaterials.push(ghostWinMat);
    for (let w = -1; w <= 1; w++) {
      const win = new THREE.Mesh(
        new THREE.BoxGeometry(0.55 * gMult, 0.5 * gMult, 0.12 * gMult),
        ghostWinMat
      );
      win.position.set(w * cfg.beam * 0.22, deckY + 0.9 * gMult, cfg.len * 0.47);
      root.add(win);
    }

    // Giant weather-event eerie green storm cloud around Ghost Ship (1 InstancedMesh + soft Sprites)
    ghostFog = new THREE.Group();
    const scaleFactor = Math.max(0.85, gMult);
    const canopyGeo = new THREE.IcosahedronGeometry(1, 1);
    const canopyMat = new THREE.MeshBasicMaterial({
      color: 0x20df73,
      transparent: true,
      opacity: 0.14,
      depthWrite: false,
    });
    fadeMaterials.push(canopyMat);

    const lobeCount = gMult >= 1.8 ? 28 : 22;
    const canopyInst = new THREE.InstancedMesh(canopyGeo, canopyMat, lobeCount);
    canopyInst.frustumCulled = false;
    const dummy = new THREE.Object3D();
    for (let p = 0; p < lobeCount; p++) {
      const ring = p < 8 ? 0 : p < 18 ? 1 : 2;
      const ang = (p / lobeCount) * Math.PI * 2 + ring * 0.45;
      const distR =
        ring === 0
          ? (18 + (p % 3) * 10) * scaleFactor
          : ring === 1
            ? (55 + (p % 4) * 18) * scaleFactor
            : (25 + (p % 4) * 20) * scaleFactor;
      const py =
        ring === 0
          ? (4 + (p % 3) * 3.5) * scaleFactor
          : ring === 1
            ? (3 + (p % 3) * 3.0) * scaleFactor
            : (22 + (p % 3) * 7.0) * scaleFactor;
      const sx = (ring === 2 ? 40 : ring === 1 ? 34 : 20) * scaleFactor;
      const sy = (ring === 2 ? 9.5 : 8.5) * scaleFactor;
      dummy.position.set(Math.cos(ang) * distR, py, Math.sin(ang) * distR);
      dummy.scale.set(sx, sy, sx * 0.92);
      dummy.rotation.y = ang;
      dummy.updateMatrix();
      canopyInst.setMatrixAt(p, dummy.matrix);
    }
    canopyInst.instanceMatrix.needsUpdate = true;
    canopyInst.computeBoundingSphere();
    ghostFog.add(canopyInst);

    const spriteMat = new THREE.SpriteMaterial({
      map: textures.ghostCloudMap,
      color: 0x58ff9c,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    });
    fadeMaterials.push(spriteMat);
    const spriteCount = 10;
    for (let s = 0; s < spriteCount; s++) {
      const ang = (s / spriteCount) * Math.PI * 2;
      const distR = s < 3 ? 12 * scaleFactor : (42 + (s % 3) * 24) * scaleFactor;
      const sp = new THREE.Sprite(spriteMat);
      const wScale = (s < 3 ? 44 : 68 + (s % 3) * 14) * scaleFactor;
      sp.scale.set(wScale, wScale * 0.52, 1);
      sp.position.set(Math.cos(ang) * distR, (9 + (s % 4) * 5.5) * scaleFactor, Math.sin(ang) * distR);
      ghostFog.add(sp);
    }
    root.add(ghostFog);
  }

  return {
    root,
    sails,
    flagMesh,
    ghostFog,
    fadeMaterials: isGhost ? fadeMaterials : undefined,
    cannonGroups,
    damagePatches,
    halfLength: cfg.len * 0.5,
    halfBeam: cfg.beam * 0.5,
  };
}

/**
 * Builds a player-owned autonomous Fleet Vessel that physically grows with hullTier & deckLevel
 * and automatically displays the player's customized flag.
 */
export function buildFleetShipMesh(
  fleetShip: FleetShipData,
  customFlag: CustomFlagConfig,
  textures: ProceduralTextureSet
): BuiltNpcShip {
  const root = new THREE.Group();
  const spec = FLEET_CLASS_SPECS[fleetShip.shipClass];
  const baseMap: Record<FleetShipData['shipClass'], { len: number; beam: number; depth: number; masts: number; tint: number }> = {
    fast_scout: { len: 11.8, beam: 4.1, depth: 2.0, masts: 1, tint: 0x6d4b2d },
    medium_armed: { len: 15.6, beam: 5.3, depth: 2.45, masts: 2, tint: 0x573b24 },
    large_merchant: { len: 20.8, beam: 7.4, depth: 3.05, masts: 3, tint: 0x704927 },
    heavy_warship: { len: 24.4, beam: 8.0, depth: 3.45, masts: 3, tint: 0x3e2d22 },
    supply_vessel: { len: 17.4, beam: 6.4, depth: 2.75, masts: 2, tint: 0x5b4e38 },
  };
  const b = baseMap[fleetShip.shipClass];
  const tierScale = 1 + (fleetShip.hullTier - 1) * 0.11;
  const len = b.len * tierScale;
  const beam = b.beam * (1 + (fleetShip.hullTier - 1) * 0.085);
  const depth = b.depth + fleetShip.deckLevel * 0.34;
  const deckY = depth * 0.56;

  const hullMat = new THREE.MeshStandardMaterial({
    map: textures.woodHullMap,
    bumpMap: textures.woodHullBump,
    bumpScale: 0.08,
    color: b.tint,
    roughness: 0.78,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: fleetShip.hullTier >= 4 ? 0xd4a44d : 0x2d1d12,
    roughness: 0.45,
    metalness: fleetShip.hullTier >= 4 ? 0.65 : 0.12,
  });
  const deckMat = new THREE.MeshStandardMaterial({
    map: textures.woodDeckMap,
    color: 0xffffff,
    roughness: 0.86,
  });
  const customSailTex = createCustomSailTexture(customFlag, 4);
  const sailMat = new THREE.MeshStandardMaterial({
    map: customSailTex,
    color:
      fleetShip.shipClass === 'heavy_warship'
        ? 0xf5e5d0
        : fleetShip.shipClass === 'supply_vessel'
          ? 0xe8f7f1
          : 0xffffff,
    roughness: 0.88,
    side: THREE.DoubleSide,
  });
  const ironMat = new THREE.MeshStandardMaterial({
    map: textures.ironPlateMap,
    color: 0xffffff,
    roughness: 0.42,
    metalness: 0.78,
  });
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xd4a44d, roughness: 0.25, metalness: 0.88 });

  const hull = new THREE.Mesh(createTaperedHullGeometry(len, beam, depth), hullMat);
  hull.castShadow = true;
  root.add(hull);

  const deck = new THREE.Mesh(new THREE.BoxGeometry(beam * 0.8, 0.12, len * 0.8), deckMat);
  deck.position.set(0, deckY + 0.04, len * 0.03);
  root.add(deck);

  // Visible multi-deck quarterdeck & forecastle as deckLevel grows (0..2)
  if (fleetShip.deckLevel >= 1 || fleetShip.shipClass === 'heavy_warship' || fleetShip.shipClass === 'large_merchant') {
    const qH = 1.2 + fleetShip.deckLevel * 0.45;
    const qDeck = new THREE.Mesh(new THREE.BoxGeometry(beam * 0.82, qH, len * 0.28), hullMat);
    qDeck.position.set(0, deckY + qH * 0.5, len * 0.31);
    root.add(qDeck);
  }
  if (fleetShip.deckLevel >= 2) {
    const fDeck = new THREE.Mesh(new THREE.BoxGeometry(beam * 0.68, 0.95, len * 0.2), hullMat);
    fDeck.position.set(0, deckY + 0.48, -len * 0.29);
    root.add(fDeck);
  }

  // Supply & Merchant cargo props
  if (fleetShip.shipClass === 'supply_vessel' || fleetShip.shipClass === 'large_merchant') {
    const crateMat = new THREE.MeshStandardMaterial({ color: 0x82603c, roughness: 0.88 });
    for (let i = 0; i < 4; i++) {
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.58, 0.7), crateMat);
      box.position.set(((i % 2) * 2 - 1) * beam * 0.22, deckY + 0.35, (Math.floor(i / 2) - 0.5) * 1.4);
      root.add(box);
    }
  }

  const sprit = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.16, len * 0.3, 7), trimMat);
  sprit.rotation.x = Math.PI * 0.42;
  sprit.position.set(0, deckY + 0.75, -len * 0.52);
  root.add(sprit);

  const mastCount = Math.min(3, Math.max(b.masts, fleetShip.hullTier >= 4 ? 3 : fleetShip.hullTier >= 2 ? 2 : 1));
  const sails: THREE.Mesh[] = [];
  let flagMesh: THREE.Mesh | null = null;
  let flagTexture: THREE.CanvasTexture | null = null;

  for (let m = 0; m < mastCount; m++) {
    const t = mastCount === 1 ? 0 : (m / (mastCount - 1)) * 2 - 1;
    const mz = t * len * 0.24;
    const mh = 8.0 + depth * 2.1 - Math.abs(t) * 1.2;
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.2, mh, 8), trimMat);
    mast.position.set(0, deckY + mh * 0.5, mz);
    root.add(mast);

    const sw = beam * 1.2 * (1 - Math.abs(t) * 0.14);
    const sh = mh * 0.46;
    const sail = new THREE.Mesh(createBillowingSailGeometry(sw, sh), sailMat);
    sail.position.set(0, deckY + mh * 0.72 - sh * 0.48, mz - 0.2);
    root.add(sail);
    sails.push(sail);

    if (m === mastCount - 1) {
      const builtFlag = createWavingFlagMesh(customFlag, 2.2 + fleetShip.hullTier * 0.12, 1.3 + fleetShip.hullTier * 0.08);
      builtFlag.mesh.position.set(0, deckY + mh - 0.14, mz);
      root.add(builtFlag.mesh);
      flagMesh = builtFlag.mesh;
      flagTexture = builtFlag.texture;
    }
  }

  if (!flagTexture) {
    flagTexture = createCustomFlagTexture(customFlag, 4);
  }

  const cannonGroups: THREE.Group[] = [];
  const guns = fleetShip.cannons;
  const perSide = Math.max(1, Math.ceil(guns / 2));
  const cannonScale = 0.82 + fleetShip.cannonTier * 0.08;
  for (let i = 0; i < guns; i++) {
    const side = i % 2 === 0 ? 1 : -1;
    const sIdx = Math.floor(i / 2);
    const t = perSide <= 1 ? 0 : (sIdx / (perSide - 1)) * 2 - 1;
    const cannon = createCannonMesh(ironMat, trimMat, brassMat, cannonScale);
    const cx = side * (beam * 0.37);
    cannon.position.set(cx, deckY + 0.16, t * len * 0.25);
    cannon.userData.baseX = cx;
    cannon.userData.side = side;
    if (side === -1) cannon.rotation.y = Math.PI;
    root.add(cannon);
    cannonGroups.push(cannon);
  }

  const damagePatches = createHullDamagePatches(len, beam, deckY);
  for (const patch of damagePatches) {
    root.add(patch);
  }

  // Fleet crew figures tinted with player's primary flag dye
  const crewCoatHex = FLAG_DYES[customFlag.primaryDye]?.hex ?? '#1d4ed8';
  const fleetCrewMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(crewCoatHex),
    roughness: 0.8,
  });
  for (let c = 0; c < Math.min(4, Math.max(2, Math.floor(fleetShip.crewCount / 4))); c++) {
    const sailor = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 1.32, 7), fleetCrewMat);
    sailor.position.set(((c % 2) * 2 - 1) * beam * 0.2, deckY + 0.68, (c - 1.5) * 1.6);
    root.add(sailor);
  }

  // Allied teal-gold stern lantern so player instantly distinguishes fleet escorts at night
  const lanternBulb = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.32, 0),
    new THREE.MeshStandardMaterial({
      color: 0xbfffea,
      emissive: 0x34d399,
      emissiveIntensity: 1.9,
      roughness: 0.2,
    })
  );
  lanternBulb.position.set(0, deckY + 2.2, len * 0.47);
  root.add(lanternBulb);

  return {
    root,
    sails,
    flagMesh,
    flagTexture,
    sailTexture: customSailTex,
    cannonGroups,
    damagePatches,
    halfLength: len * 0.5,
    halfBeam: beam * 0.5,
  };
}

export function buildShipwreckMesh(
  archetype: WreckArchetype,
  scale: number,
  textures: ProceduralTextureSet,
  isCharred = false
): THREE.Group {
  const root = new THREE.Group();

  const isGhostWreck = archetype === 'ghost_wreck';
  const charred = isCharred && !isGhostWreck;
  const hullMat = new THREE.MeshStandardMaterial({
    map: textures.woodHullMap,
    bumpMap: textures.woodHullBump,
    bumpScale: 0.1,
    color: isGhostWreck
      ? 0x132722
      : charred
        ? 0x15110f
        : archetype === 'treasure_galleon'
          ? 0x6b4b2a
          : 0x3f3328,
    roughness: charred ? 0.96 : 0.9,
  });
  const tornSailMat = new THREE.MeshStandardMaterial({
    map: isGhostWreck ? textures.sailGhostMap : textures.sailTornMap,
    color: isGhostWreck ? 0x80ffc2 : charred ? 0x382e2a : 0xffffff,
    emissive: isGhostWreck ? 0x116644 : 0x000000,
    emissiveIntensity: isGhostWreck ? 0.52 : 0,
    transparent: isGhostWreck,
    opacity: isGhostWreck ? 0.82 : 1,
    roughness: 0.94,
    side: THREE.DoubleSide,
  });
  const goldMat = new THREE.MeshStandardMaterial({
    color: isGhostWreck ? 0x5eead4 : charred ? 0x7c6230 : 0xe3b84c,
    emissive: isGhostWreck ? 0x14b8a6 : 0x000000,
    emissiveIntensity: isGhostWreck ? 0.65 : 0,
    roughness: charred ? 0.55 : 0.28,
    metalness: 0.88,
  });

  const isHugeWreck =
    archetype === 'enormous_merchant' ||
    archetype === 'massive_warship' ||
    archetype === 'gigantic_wreck' ||
    isGhostWreck;

  const len = 11.5 * scale;
  const beam = 4.4 * scale;
  const depth = 2.0 * scale;

  const wreckHull = new THREE.Group();
  wreckHull.rotation.z = charred
    ? 0.39
    : archetype === 'storm_sunken'
      ? 0.42
      : isHugeWreck
        ? 0.2
        : 0.24;
  wreckHull.rotation.x = charred
    ? 0.24
    : archetype === 'fishing_boat'
      ? -0.14
      : isHugeWreck
        ? 0.12
        : 0.18;

  const hull = new THREE.Mesh(createTaperedHullGeometry(len, beam, depth), hullMat);
  if (charred) {
    hull.scale.set(0.95, 0.86, 0.92);
  }
  wreckHull.add(hull);

  if (charred) {
    // Blasted-open charred midship breach & uneven splintered ribs — much less put together than salvageable wrecks
    const breachMat = new THREE.MeshStandardMaterial({ color: 0x0b0908, roughness: 0.98 });
    const breach = new THREE.Mesh(
      new THREE.BoxGeometry(beam * 0.72, depth * 0.68, len * 0.36),
      breachMat
    );
    breach.position.set(0.08 * beam, depth * 0.52, -len * 0.04);
    breach.rotation.z = 0.09;
    wreckHull.add(breach);

    for (let j = 0; j < 7; j++) {
      const side = j % 2 === 0 ? 1 : -1;
      const rib = new THREE.Mesh(
        new THREE.BoxGeometry(0.16 * scale, (1.1 + (j % 3) * 0.5) * scale, 0.24 * scale),
        hullMat
      );
      rib.position.set(
        side * beam * (0.34 + (j % 2) * 0.08),
        depth * 0.65,
        (-0.34 + j * 0.11) * len
      );
      rib.rotation.set((j % 3 - 1) * 0.28, 0, side * (0.32 + (j % 2) * 0.25));
      wreckHull.add(rib);
    }
  } else if (isHugeWreck) {
    const aftCastle = new THREE.Mesh(new THREE.BoxGeometry(beam * 0.84, depth * 0.85, len * 0.28), hullMat);
    aftCastle.position.set(0, depth * 0.9, len * 0.3);
    wreckHull.add(aftCastle);

    const bowCastle = new THREE.Mesh(new THREE.BoxGeometry(beam * 0.7, depth * 0.6, len * 0.2), hullMat);
    bowCastle.position.set(0, depth * 0.78, -len * 0.3);
    wreckHull.add(bowCastle);
  }

  const mastCount = charred
    ? isHugeWreck
      ? 2
      : 1
    : archetype === 'gigantic_wreck' || (isGhostWreck && scale >= 1.5)
      ? 3
      : isHugeWreck
        ? 2
        : 1;
  const mastH = 5.5 * scale;
  for (let m = 0; m < mastCount; m++) {
    const mz = mastCount === 1 ? -len * 0.08 : (m / (mastCount - 1) - 0.5) * len * 0.5;
    const hFactor = charred ? 0.38 + (m % 2) * 0.14 : m === 1 ? 1.15 : 0.9;
    const lowerMast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11 * scale, 0.21 * scale, mastH * hFactor, 7),
      hullMat
    );
    lowerMast.position.set(0, depth * 0.5 + mastH * hFactor * 0.45, mz);
    lowerMast.rotation.z = charred ? (m % 2 === 0 ? -0.42 : 0.48) : m % 2 === 0 ? -0.16 : 0.22;
    wreckHull.add(lowerMast);
  }

  const brokenSpar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08 * scale, 0.12 * scale, mastH * (charred ? 0.58 : 0.72), 6),
    hullMat
  );
  brokenSpar.position.set(beam * (charred ? 0.22 : 0.35), depth * 0.85, len * 0.05);
  brokenSpar.rotation.z = charred ? 1.38 : 1.15;
  brokenSpar.rotation.x = 0.28;
  wreckHull.add(brokenSpar);

  const tornSail = new THREE.Mesh(
    createBillowingSailGeometry(beam * (charred ? 0.58 : 0.95), (charred ? 1.45 : 2.6) * scale),
    tornSailMat
  );
  tornSail.position.set(beam * 0.22, depth * (charred ? 0.72 : 0.95), -len * 0.04);
  tornSail.rotation.z = charred ? 0.82 : 0.52;
  wreckHull.add(tornSail);

  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.65, 0.68), hullMat);
  chest.position.set(-beam * 0.16, depth * 0.65, len * 0.18);
  wreckHull.add(chest);
  const chestTrim = new THREE.Mesh(new THREE.BoxGeometry(0.99, 0.14, 0.72), goldMat);
  chestTrim.position.set(-beam * 0.16, depth * 0.82, len * 0.18);
  wreckHull.add(chestTrim);

  if (charred) {
    // Multiple active fire & ember clusters across the charred broken hull (zero PointLights for fast performance)
    const fireMeshes: THREE.Mesh[] = [];
    const fireCoreMat = new THREE.MeshBasicMaterial({ color: 0xffd166 });
    const fireOuterMat = new THREE.MeshBasicMaterial({ color: 0xff5400, transparent: true, opacity: 0.9 });
    const fireRedMat = new THREE.MeshBasicMaterial({ color: 0xd92b04, transparent: true, opacity: 0.82 });
    const fireSpots = [
      { x: 0, y: depth * 0.78, z: -len * 0.16, s: 1.15 },
      { x: -beam * 0.22, y: depth * 0.82, z: len * 0.02, s: 1.3 },
      { x: beam * 0.2, y: depth * 0.72, z: -len * 0.05, s: 1.05 },
      { x: 0.06 * beam, y: depth * 0.86, z: len * 0.24, s: 1.2 },
      { x: -beam * 0.12, y: depth * 0.68, z: -len * 0.31, s: 0.95 },
      { x: beam * 0.14, y: depth * 0.75, z: len * 0.34, s: 1.0 },
      { x: 0, y: depth * 1.12, z: -len * 0.08, s: 1.1 },
    ];
    for (let f = 0; f < fireSpots.length; f++) {
      const sp = fireSpots[f];
      const ember = new THREE.Mesh(new THREE.OctahedronGeometry(0.42 * scale * sp.s, 0), fireCoreMat);
      ember.position.set(sp.x, sp.y, sp.z);
      wreckHull.add(ember);

      const flameA = new THREE.Mesh(
        new THREE.ConeGeometry(0.55 * scale * sp.s, 1.85 * scale * sp.s, 6),
        fireOuterMat
      );
      flameA.position.set(sp.x, sp.y + 0.78 * scale * sp.s, sp.z);
      flameA.userData.baseY = flameA.position.y;
      flameA.userData.phase = f * 1.3;
      wreckHull.add(flameA);
      fireMeshes.push(flameA);

      const flameB = new THREE.Mesh(
        new THREE.ConeGeometry(0.42 * scale * sp.s, 1.35 * scale * sp.s, 5),
        fireRedMat
      );
      flameB.position.set(sp.x + 0.2 * scale, sp.y + 0.6 * scale * sp.s, sp.z - 0.15 * scale);
      flameB.rotation.z = 0.18;
      flameB.userData.baseY = flameB.position.y;
      flameB.userData.phase = f * 1.9 + 0.7;
      wreckHull.add(flameB);
      fireMeshes.push(flameB);
    }
    root.userData.fireMeshes = fireMeshes;
  } else {
    const wreckLantern = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.24 * scale, 0),
      new THREE.MeshStandardMaterial({
        color: isGhostWreck ? 0x5effa8 : 0xffd78a,
        emissive: isGhostWreck ? 0x22d976 : 0xd88824,
        emissiveIntensity: isGhostWreck ? 2.4 : 1.45,
        roughness: 0.25,
      })
    );
    wreckLantern.position.set(0.35 * scale, depth * 0.5 + mastH * 0.62, -len * 0.08);
    wreckHull.add(wreckLantern);
  }

  if (isGhostWreck) {
    const wispMat = new THREE.SpriteMaterial({
      map: textures.ghostCloudMap,
      color: 0x58ff9c,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });
    for (let w = 0; w < 3; w++) {
      const sp = new THREE.Sprite(wispMat);
      sp.scale.set(18 * scale, 10 * scale, 1);
      sp.position.set((w - 1) * beam * 0.8, depth * 1.6 + w * 1.2, (w % 2 - 0.5) * len * 0.35);
      wreckHull.add(sp);
    }
  }

  if (
    !charred &&
    (archetype === 'military_frigate' ||
      archetype === 'pirate_wreck' ||
      archetype === 'massive_warship' ||
      archetype === 'gigantic_wreck' ||
      isGhostWreck)
  ) {
    const ironMat = new THREE.MeshStandardMaterial({ color: 0x2e3136, roughness: 0.55, metalness: 0.7 });
    const gunCount = archetype === 'massive_warship' || archetype === 'gigantic_wreck' || isGhostWreck ? 4 : 1;
    for (let g = 0; g < gunCount; g++) {
      const side = g % 2 === 0 ? 1 : -1;
      const gun = createCannonMesh(ironMat, hullMat, goldMat, 0.95);
      gun.position.set(side * beam * 0.28, depth * 0.6, (-0.2 + g * 0.18) * len);
      gun.rotation.y = side === 1 ? 0.35 : Math.PI - 0.35;
      wreckHull.add(gun);
    }
  }

  root.add(wreckHull);

  const barrelMat = new THREE.MeshStandardMaterial({
    color: isGhostWreck ? 0x1d3b31 : charred ? 0x1e1815 : 0x5c4028,
    roughness: 0.88,
  });
  const debrisCount = charred ? (isHugeWreck ? 16 : 11) : isHugeWreck ? 12 : 6;
  for (let i = 0; i < debrisCount; i++) {
    const a = (i / debrisCount) * Math.PI * 2 + 0.4;
    const r = beam * (charred ? 0.82 : 0.95) + (i % 4) * 2.2;
    const debris =
      i % 2 === 0
        ? new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.76, 7), barrelMat)
        : new THREE.Mesh(new THREE.BoxGeometry(charred ? 2.2 : 1.8, 0.12, 0.34), hullMat);
    debris.position.set(Math.cos(a) * r, 0.05, Math.sin(a) * r);
    debris.rotation.set(i % 2 === 0 ? Math.PI * 0.45 : (charred ? 0.18 : 0), a, 0.15);
    root.add(debris);
  }

  return root;
}

export function buildTornadoMesh(): THREE.Group {
  const root = new THREE.Group();
  const funnelMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    emissive: 0x0f172a,
    emissiveIntensity: 0.35,
    transparent: true,
    opacity: 0.48,
    roughness: 0.9,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const sprayMat = new THREE.MeshBasicMaterial({
    color: 0xcbd5e1,
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
  });

  // Tall swirling funnel rings ascending from ocean surface to storm clouds
  const ringCount = 10;
  for (let i = 0; i < ringCount; i++) {
    const t = i / (ringCount - 1);
    const radius = 3.2 + Math.pow(t, 1.5) * 26;
    const h = 8.5;
    const seg = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 1.14, radius * 0.9, h, 16, 1, true),
      funnelMat
    );
    seg.position.set(Math.sin(i * 0.8) * 1.4, 4 + i * 7.2, Math.cos(i * 0.8) * 1.4);
    seg.userData.spinRate = (2.8 - t * 1.4) * (i % 2 === 0 ? 1 : -0.8);
    root.add(seg);
  }

  // Churning sea-foam skirt at waterline
  const skirt = new THREE.Mesh(new THREE.TorusGeometry(9.5, 2.2, 8, 22), sprayMat);
  skirt.rotation.x = Math.PI / 2;
  skirt.position.y = 0.8;
  root.add(skirt);

  return root;
}

export function buildFloatingCrateMesh(kind: FloatingCrateData['kind']): THREE.Group {
  const g = new THREE.Group();
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x7c5936, roughness: 0.86 });
  const bandMat = new THREE.MeshStandardMaterial({ color: 0x3a3d42, roughness: 0.48, metalness: 0.7 });

  if (kind === 'crate') {
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.35, 1.05, 1.35), woodMat);
    box.position.y = 0.15;
    g.add(box);
    const strap = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.16, 1.4), bandMat);
    strap.position.y = 0.22;
    g.add(strap);
  } else if (kind === 'barrel') {
    for (let i = -1; i <= 1; i += 2) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.05, 10), woodMat);
      b.rotation.z = Math.PI * 0.42;
      b.position.set(i * 0.55, 0.1, i * 0.25);
      g.add(b);
    }
  } else if (kind === 'raft') {
    for (let i = -2; i <= 2; i++) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 2.8, 8), woodMat);
      log.rotation.x = Math.PI / 2;
      log.position.set(i * 0.38, 0.05, 0);
      g.add(log);
    }
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 2.2, 6), woodMat);
    pole.position.set(0.3, 1.1, 0);
    g.add(pole);
    const cloth = new THREE.Mesh(
      new THREE.PlaneGeometry(0.95, 0.65),
      new THREE.MeshStandardMaterial({ color: 0xe6843c, side: THREE.DoubleSide })
    );
    cloth.position.set(0.75, 1.85, 0);
    g.add(cloth);
    const raftLantern = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 6, 6),
      new THREE.MeshStandardMaterial({ color: 0xffe29c, emissive: 0xff9b28, emissiveIntensity: 1.6 })
    );
    raftLantern.position.set(0.3, 2.25, 0);
    g.add(raftLantern);
  } else {
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xe3b84c, roughness: 0.28, metalness: 0.85 });
    const chest = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.95, 1.0), woodMat);
    chest.position.y = 0.2;
    g.add(chest);
    const trim = new THREE.Mesh(new THREE.BoxGeometry(1.46, 0.22, 1.06), goldMat);
    trim.position.y = 0.42;
    g.add(trim);
    const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 6), goldMat);
    beacon.position.y = 1.2;
    g.add(beacon);
    const buoyLight = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.2, 0),
      new THREE.MeshStandardMaterial({ color: 0xffe49e, emissive: 0xffad38, emissiveIntensity: 1.8 })
    );
    buoyLight.position.y = 2.35;
    g.add(buoyLight);
  }

  return g;
}
