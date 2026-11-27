import * as THREE from 'three';
import {
  BreakableIceSheetData,
  IceChunkData,
  IcebergData,
  IslandData,
  IslandPirateGuardData,
  WildlifeActorData,
} from '../game/types';
import { isPointInRiver, sampleIslandTerrainHeight, smoothValueNoise } from '../game/islands';
import { ProceduralTextureSet } from './textures';
import { buildShipwreckMesh } from './shipBuilder';

export interface BuiltIsland {
  root: THREE.Group;
  discoveryMeshes: Map<string, THREE.Object3D>;
  beachedWreckMeshes: Map<string, THREE.Object3D>;
  campfireLight?: THREE.PointLight;
}

export interface BuiltBreakableIceSheet {
  root: THREE.Group;
  sheetMesh: THREE.Mesh;
  crackLines: THREE.Group;
  material: THREE.MeshStandardMaterial;
}

export interface BuiltWildlife {
  root: THREE.Group;
  body: THREE.Object3D;
  limbs: THREE.Object3D[];
  tail: THREE.Object3D | null;
  wings: THREE.Object3D[];
}

export function buildIslandMesh(
  island: IslandData,
  textures: ProceduralTextureSet,
  isSoftwareGl: boolean
): BuiltIsland {
  const root = new THREE.Group();
  root.position.set(island.x, 0, island.z);

  const discoveryMeshes = new Map<string, THREE.Object3D>();
  const beachedWreckMeshes = new Map<string, THREE.Object3D>();

  const size = island.radius * 2.5;
  const segs = isSoftwareGl ? 42 : 64;
  const geo = new THREE.PlaneGeometry(size, size, segs, segs);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  const cAlt = new THREE.Color();

  const isFrozen = island.biome === 'cold' || island.archetype === 'frozen';
  const isTrop = island.biome === 'tropical' || island.archetype === 'tropical';

  for (let i = 0; i < pos.count; i++) {
    const lx = pos.getX(i);
    const lz = pos.getZ(i);
    const wx = island.x + lx;
    const wz = island.z + lz;
    const h = sampleIslandTerrainHeight(island, wx, wz);
    pos.setY(i, h);

    const patch = smoothValueNoise(lx * 0.14 + 13, lz * 0.14 + 29, island.seed + 5);
    const inRiver = isPointInRiver(island, wx, wz);
    if (h < -0.1) {
      c.setHex(isTrop ? 0x3ad6c8 : isFrozen ? 0x355c72 : 0x2b5e66);
    } else if (inRiver && h < 2.2) {
      c.setHex(0x287b88);
    } else if (h < 1.1) {
      c.setHex(isFrozen ? 0x8d9ea7 : isTrop ? 0xead8a9 : 0xcbb789);
      cAlt.setHex(isFrozen ? 0x768690 : isTrop ? 0xd9c28c : 0xb39f72);
      c.lerp(cAlt, patch * 0.55);
    } else if (h > island.maxHeight * 0.72) {
      c.setHex(isFrozen ? 0xf2f8fd : 0x626b6e);
    } else if (isFrozen) {
      c.setHex(h > 2.6 ? 0xe1ecf4 : 0x6c7f87);
      cAlt.setHex(0x9fb2bd);
      c.lerp(cAlt, patch * 0.35);
    } else if (island.archetype === 'rocky') {
      c.setHex(h > 3.2 ? 0x666b6e : 0x4b5f42);
    } else {
      c.setHex(isTrop ? 0x45863d : 0x4b703b);
      cAlt.setHex(isTrop ? 0x5c9c4a : 0x608546);
      c.lerp(cAlt, patch * 0.5);
    }

    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const terrainMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.91,
    metalness: 0.02,
    flatShading: false,
  });
  const terrain = new THREE.Mesh(geo, terrainMat);
  terrain.receiveShadow = !isSoftwareGl;
  root.add(terrain);

  // Instanced ground detail layers: coastal pebbles/boulders, grass/fern tufts, driftwood logs, flowers/shells
  {
    const detailScale = isSoftwareGl ? 0.65 : 1.0;
    const pebbleCount = Math.min(70, Math.round(island.radius * 0.55 * detailScale));
    const tuftCount = Math.min(95, Math.round(island.radius * 0.85 * detailScale));
    const driftCount = Math.min(18, Math.round(island.radius * 0.16 * detailScale));
    const bloomCount = Math.min(48, Math.round(island.radius * 0.42 * detailScale));
    const dummy = new THREE.Object3D();

    if (pebbleCount > 0) {
      const pebbleGeo = new THREE.DodecahedronGeometry(0.45, 0);
      const pebbleMat = new THREE.MeshStandardMaterial({
        color: isFrozen ? 0x74848f : 0x7a766d,
        roughness: 0.92,
      });
      const pebbles = new THREE.InstancedMesh(pebbleGeo, pebbleMat, pebbleCount);
      let placed = 0;
      for (let i = 0; i < pebbleCount * 3 && placed < pebbleCount; i++) {
        const ang = (i * 1.913 + island.seed * 0.17) % (Math.PI * 2);
        const rRatio = 0.25 + (((i * 29 + island.seed) % 100) / 100) * 0.69;
        const lx = Math.cos(ang) * island.radius * rRatio;
        const lz = Math.sin(ang) * island.radius * rRatio;
        const wx = island.x + lx;
        const wz = island.z + lz;
        if (isPointInRiver(island, wx, wz)) continue;
        const h = sampleIslandTerrainHeight(island, wx, wz);
        if (h < 0.22) continue;
        const sc = 0.55 + ((i % 7) * 0.18);
        dummy.position.set(lx, h + 0.14 * sc, lz);
        dummy.rotation.set((i % 5) * 0.3, ang, (i % 3) * 0.4);
        dummy.scale.set(sc * 1.25, sc * 0.65, sc);
        dummy.updateMatrix();
        pebbles.setMatrixAt(placed++, dummy.matrix);
      }
      pebbles.count = placed;
      pebbles.instanceMatrix.needsUpdate = true;
      root.add(pebbles);
    }

    if (tuftCount > 0) {
      const tuftGeo = new THREE.ConeGeometry(0.42, 0.72, 5);
      const tuftMat = new THREE.MeshStandardMaterial({
        color: isFrozen ? 0x627c75 : isTrop ? 0x4ca142 : 0x4f7c3c,
        roughness: 0.88,
      });
      const tufts = new THREE.InstancedMesh(tuftGeo, tuftMat, tuftCount);
      let placed = 0;
      for (let i = 0; i < tuftCount * 3 && placed < tuftCount; i++) {
        const ang = (i * 2.579 + island.seed * 0.31) % (Math.PI * 2);
        const rRatio = 0.12 + (((i * 43 + island.seed) % 100) / 100) * 0.68;
        const lx = Math.cos(ang) * island.radius * rRatio;
        const lz = Math.sin(ang) * island.radius * rRatio;
        const wx = island.x + lx;
        const wz = island.z + lz;
        if (isPointInRiver(island, wx, wz)) continue;
        if (island.settlement && Math.hypot(wx - island.settlement.worldX, wz - island.settlement.worldZ) < 12) continue;
        const h = sampleIslandTerrainHeight(island, wx, wz);
        if (h < 1.1) continue;
        const sc = 0.65 + ((i % 6) * 0.16);
        dummy.position.set(lx, h + 0.3 * sc, lz);
        dummy.rotation.set(0, ang, ((i % 3) - 1) * 0.12);
        dummy.scale.set(sc * 1.3, sc, sc * 1.3);
        dummy.updateMatrix();
        tufts.setMatrixAt(placed++, dummy.matrix);
      }
      tufts.count = placed;
      tufts.instanceMatrix.needsUpdate = true;
      root.add(tufts);
    }

    if (driftCount > 0) {
      const driftGeo = new THREE.CylinderGeometry(0.16, 0.22, 2.3, 6);
      driftGeo.rotateZ(Math.PI / 2);
      const driftMat = new THREE.MeshStandardMaterial({ color: 0x7c654c, roughness: 0.94 });
      const drifts = new THREE.InstancedMesh(driftGeo, driftMat, driftCount);
      let placed = 0;
      for (let i = 0; i < driftCount * 3 && placed < driftCount; i++) {
        const ang = (i * 1.43 + island.seed * 0.41) % (Math.PI * 2);
        const rRatio = 0.78 + (((i * 19 + island.seed) % 100) / 100) * 0.15;
        const lx = Math.cos(ang) * island.radius * rRatio;
        const lz = Math.sin(ang) * island.radius * rRatio;
        const wx = island.x + lx;
        const wz = island.z + lz;
        const h = sampleIslandTerrainHeight(island, wx, wz);
        if (h < 0.28 || h > 1.8) continue;
        const sc = 0.75 + (i % 4) * 0.18;
        dummy.position.set(lx, h + 0.14 * sc, lz);
        dummy.rotation.set(0, ang + Math.PI * 0.45, 0.05);
        dummy.scale.setScalar(sc);
        dummy.updateMatrix();
        drifts.setMatrixAt(placed++, dummy.matrix);
      }
      drifts.count = placed;
      drifts.instanceMatrix.needsUpdate = true;
      root.add(drifts);
    }

    if (bloomCount > 0) {
      const bloomGeo = new THREE.OctahedronGeometry(0.18, 0);
      const bloomMat = new THREE.MeshStandardMaterial({
        color: isFrozen ? 0xcce2ec : isTrop ? 0xf2b552 : 0xdfd38d,
        roughness: 0.8,
      });
      const blooms = new THREE.InstancedMesh(bloomGeo, bloomMat, bloomCount);
      let placed = 0;
      for (let i = 0; i < bloomCount * 3 && placed < bloomCount; i++) {
        const ang = (i * 3.11 + island.seed * 0.07) % (Math.PI * 2);
        const rRatio = 0.18 + (((i * 53 + island.seed) % 100) / 100) * 0.72;
        const lx = Math.cos(ang) * island.radius * rRatio;
        const lz = Math.sin(ang) * island.radius * rRatio;
        const wx = island.x + lx;
        const wz = island.z + lz;
        if (isPointInRiver(island, wx, wz)) continue;
        const h = sampleIslandTerrainHeight(island, wx, wz);
        if (h < 0.35) continue;
        const sc = 0.7 + (i % 5) * 0.14;
        dummy.position.set(lx, h + 0.16 * sc, lz);
        dummy.rotation.set(0, ang, 0);
        dummy.scale.set(sc * 1.2, sc * 0.85, sc * 1.2);
        dummy.updateMatrix();
        blooms.setMatrixAt(placed++, dummy.matrix);
      }
      blooms.count = placed;
      blooms.instanceMatrix.needsUpdate = true;
      root.add(blooms);
    }
  }

  // Freshwater river surface ribbon if present
  if (island.hasRiver) {
    const rLen = island.radius * 1.1;
    const riverMat = new THREE.MeshStandardMaterial({
      color: 0x1d8a9c,
      roughness: 0.24,
      metalness: 0.1,
      transparent: true,
      opacity: 0.85,
    });
    const riverStrip = new THREE.Mesh(new THREE.PlaneGeometry(4.2, rLen), riverMat);
    riverStrip.rotation.x = -Math.PI / 2;
    riverStrip.rotation.z = -island.riverAngle + Math.PI / 2;
    riverStrip.position.set(
      Math.cos(island.riverAngle) * rLen * 0.38,
      0.32,
      Math.sin(island.riverAngle) * rLen * 0.38
    );
    root.add(riverStrip);
  }

  // Timber Landing Pier & Anchor Lantern
  const dockMat = new THREE.MeshStandardMaterial({ color: 0x6a492b, roughness: 0.88 });
  const dRelX = island.dockX - island.x;
  const dRelZ = island.dockZ - island.z;
  const dockAngle = Math.atan2(dRelZ, dRelX);
  const pierGroup = new THREE.Group();
  pierGroup.position.set(dRelX * 0.88, 0.9, dRelZ * 0.88);
  pierGroup.rotation.y = -dockAngle + Math.PI / 2;
  const deck = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.26, 12.5), dockMat);
  pierGroup.add(deck);
  for (let p = -1; p <= 1; p++) {
    for (const s of [-1.6, 1.6]) {
      const piling = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 2.6, 6), dockMat);
      piling.position.set(s, -0.6, p * 4.2);
      pierGroup.add(piling);
    }
  }
  const dockPost = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.2, 6), dockMat);
  dockPost.position.set(1.5, 1.1, 5.2);
  pierGroup.add(dockPost);
  const dockLamp = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.24, 0),
    new THREE.MeshBasicMaterial({ color: 0xffd27a })
  );
  dockLamp.position.set(1.5, 2.3, 5.2);
  pierGroup.add(dockLamp);
  root.add(pierGroup);

  // Enterable Cave Grotto Arch & Tunnel Mouth
  if (island.hasCave) {
    const caveGroup = new THREE.Group();
    const cx = island.caveEntranceX - island.x;
    const cz = island.caveEntranceZ - island.z;
    const ch = Math.max(0.85, sampleIslandTerrainHeight(island, island.caveEntranceX, island.caveEntranceZ));
    caveGroup.position.set(cx, ch, cz);
    caveGroup.lookAt(island.x, ch, island.z);

    const rockMat = new THREE.MeshStandardMaterial({ color: 0x3b4046, roughness: 0.94, flatShading: true });
    const darkInteriorMat = new THREE.MeshBasicMaterial({ color: 0x0b0e13 });

    const leftWall = new THREE.Mesh(new THREE.DodecahedronGeometry(2.8, 0), rockMat);
    leftWall.scale.set(0.9, 1.6, 1.4);
    leftWall.position.set(-2.9, 1.8, 0);
    caveGroup.add(leftWall);

    const rightWall = new THREE.Mesh(new THREE.DodecahedronGeometry(2.8, 0), rockMat);
    rightWall.scale.set(0.9, 1.6, 1.4);
    rightWall.position.set(2.9, 1.8, 0);
    caveGroup.add(rightWall);

    const roof = new THREE.Mesh(new THREE.DodecahedronGeometry(3.9, 0), rockMat);
    roof.scale.set(1.4, 0.72, 1.7);
    roof.position.set(0, 4.1, 0.4);
    caveGroup.add(roof);

    const hollow = new THREE.Mesh(new THREE.BoxGeometry(3.8, 3.6, 3.6), darkInteriorMat);
    hollow.position.set(0, 1.7, 0.9);
    caveGroup.add(hollow);

    const torchPost = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 6, 6),
      new THREE.MeshBasicMaterial({ color: 0xff9f3b })
    );
    torchPost.position.set(-1.9, 2.2, -1.6);
    caveGroup.add(torchPost);

    root.add(caveGroup);
  }

  // Ancient Coastal Ruins if present
  if (island.hasRuins) {
    const ruinMat = new THREE.MeshStandardMaterial({ color: 0x87897e, roughness: 0.94, flatShading: true });
    const rx = island.x + island.radius * 0.24;
    const rz = island.z - island.radius * 0.22;
    const ry = Math.max(1.2, sampleIslandTerrainHeight(island, rx, rz));
    const ruinGroup = new THREE.Group();
    ruinGroup.position.set(rx - island.x, ry, rz - island.z);

    for (let col = -1; col <= 1; col += 2) {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 4.4, 7), ruinMat);
      pillar.position.set(col * 2.2, 2.2, 0);
      ruinGroup.add(pillar);
    }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.75, 1.1), ruinMat);
    lintel.position.set(0, 4.5, 0);
    ruinGroup.add(lintel);
    root.add(ruinGroup);
  }

  // Instanced Trees (Palms / Pines) across island dry interior
  if (island.forestDensity > 0.1) {
    const maxTrees = Math.min(isSoftwareGl ? 18 : 34, Math.round(island.radius * 0.45 * island.forestDensity));
    if (maxTrees > 0) {
      const trunkGeo = new THREE.CylinderGeometry(0.18, 0.34, 4.4, 6);
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c4128, roughness: 0.9 });
      const crownGeo = isTrop
        ? new THREE.ConeGeometry(2.3, 1.6, 6)
        : new THREE.ConeGeometry(1.85, 4.2, 6);
      const crownMat = new THREE.MeshStandardMaterial({
        color: isFrozen ? 0x2c4b41 : isTrop ? 0x3b8c32 : 0x2f682f,
        roughness: 0.85,
      });

      const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, maxTrees);
      const crowns = new THREE.InstancedMesh(crownGeo, crownMat, maxTrees);
      const dummy = new THREE.Object3D();
      let placed = 0;

      for (let i = 0; i < maxTrees * 2 && placed < maxTrees; i++) {
        const ang = (i * 2.39996 + island.seed * 0.1) % (Math.PI * 2);
        const rRatio = 0.16 + (((i * 37 + island.seed) % 100) / 100) * 0.62;
        const lx = Math.cos(ang) * island.radius * rRatio;
        const lz = Math.sin(ang) * island.radius * rRatio;
        const wx = island.x + lx;
        const wz = island.z + lz;
        if (isPointInRiver(island, wx, wz)) continue;
        if (island.settlement && Math.hypot(wx - island.settlement.worldX, wz - island.settlement.worldZ) < 16) continue;
        const h = sampleIslandTerrainHeight(island, wx, wz);
        if (h < 1.35 || h > island.maxHeight * 0.85) continue;

        const scale = 0.85 + ((i % 5) * 0.12);
        dummy.position.set(lx, h + 2.0 * scale, lz);
        dummy.rotation.set(((i % 3) - 1) * 0.08, ang, ((i % 2) - 0.5) * 0.08);
        dummy.scale.setScalar(scale);
        dummy.updateMatrix();
        trunks.setMatrixAt(placed, dummy.matrix);

        dummy.position.set(lx, h + (isTrop ? 4.3 : 4.6) * scale, lz);
        dummy.scale.set(scale * (isTrop ? 1.15 : 1.0), scale, scale * (isTrop ? 1.15 : 1.0));
        dummy.updateMatrix();
        crowns.setMatrixAt(placed, dummy.matrix);
        placed++;
      }

      trunks.count = placed;
      crowns.count = placed;
      trunks.instanceMatrix.needsUpdate = true;
      crowns.instanceMatrix.needsUpdate = true;
      root.add(trunks);
      root.add(crowns);
    }
  }

  // Coastal Settlement (composite timber houses, docks, stalls, fort watchtower)
  if (island.settlement) {
    const st = island.settlement;
    const sg = new THREE.Group();
    const sh = Math.max(1.2, sampleIslandTerrainHeight(island, st.worldX, st.worldZ));
    sg.position.set(st.worldX - island.x, sh, st.worldZ - island.z);
    sg.rotation.y = -st.rotation;

    const wallMat = new THREE.MeshStandardMaterial({
      color: st.kind === 'coastal_fort' ? 0x797973 : 0xa5845d,
      roughness: 0.88,
    });
    const roofMat = new THREE.MeshStandardMaterial({
      color: st.kind === 'abandoned_outpost' ? 0x453d36 : st.kind === 'coastal_fort' ? 0x5e2824 : 0x733a27,
      roughness: 0.84,
    });
    const timberMat = new THREE.MeshStandardMaterial({ color: 0x523722, roughness: 0.9 });

    const hutCount = st.kind === 'abandoned_outpost' ? 2 : st.kind === 'coastal_fort' ? 4 : 3;
    for (let i = 0; i < hutCount; i++) {
      const hg = new THREE.Group();
      hg.position.set((i - (hutCount - 1) * 0.5) * 6.5, 0, (i % 2 === 0 ? -1 : 1) * 3.8);
      const body = new THREE.Mesh(new THREE.BoxGeometry(4.4, 3.0, 3.8), wallMat);
      body.position.y = 1.5;
      hg.add(body);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(3.6, 2.1, 4), roofMat);
      roof.rotation.y = Math.PI / 4;
      roof.position.y = 4.0;
      hg.add(roof);
      const door = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.9, 0.18), timberMat);
      door.position.set(0, 0.95, 1.92);
      hg.add(door);
      sg.add(hg);
    }

    if (st.kind === 'coastal_fort') {
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.0, 7.2, 8), wallMat);
      tower.position.set(0, 3.6, -4.5);
      sg.add(tower);
    } else if (st.kind === 'trading_post' || st.kind === 'fishing_village') {
      // Market awning stall
      const canopy = new THREE.Mesh(
        new THREE.BoxGeometry(4.2, 0.18, 2.6),
        new THREE.MeshStandardMaterial({ color: 0xb54434, roughness: 0.85 })
      );
      canopy.position.set(0, 2.5, 4.5);
      sg.add(canopy);
      for (const sx of [-1.8, 1.8]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.5, 6), timberMat);
        post.position.set(sx, 1.25, 4.5);
        sg.add(post);
      }
    }

    const lantern = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffcc66 })
    );
    lantern.position.set(0, 3.3, 4.5);
    sg.add(lantern);

    root.add(sg);
  }

  // Interior Discoveries (buried mounds, camps, huts, cave stashes, bottles)
  for (const disc of island.discoveries) {
    if (disc.collected) continue;
    const dg = new THREE.Group();
    const dh = Math.max(0.6, sampleIslandTerrainHeight(island, disc.worldX, disc.worldZ));
    dg.position.set(disc.localX, dh, disc.localZ);

    const woodMat = new THREE.MeshStandardMaterial({ color: 0x6f4f30, roughness: 0.88 });
    const brassMat = new THREE.MeshStandardMaterial({ color: 0xd9ad4d, roughness: 0.3, metalness: 0.82 });

    if (disc.kind === 'buried_chest') {
      const mound = new THREE.Mesh(
        new THREE.SphereGeometry(1.1, 8, 5),
        new THREE.MeshStandardMaterial({ color: 0x8a6d43, roughness: 0.96 })
      );
      mound.scale.set(1.2, 0.38, 1.2);
      dg.add(mound);
      // Crossed driftwood stakes marking dig spot
      for (const ang of [-0.55, 0.55]) {
        const stake = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 1.6, 5), woodMat);
        stake.rotation.z = ang;
        stake.position.y = 0.65;
        dg.add(stake);
      }
    } else if (disc.kind === 'abandoned_camp') {
      const tent = new THREE.Mesh(
        new THREE.ConeGeometry(1.85, 2.1, 4),
        new THREE.MeshStandardMaterial({ color: 0xc2b08d, roughness: 0.92 })
      );
      tent.rotation.y = Math.PI / 4;
      tent.position.set(-1.1, 1.0, 0);
      dg.add(tent);
      const fire = new THREE.Mesh(
        new THREE.ConeGeometry(0.35, 0.85, 6),
        new THREE.MeshBasicMaterial({ color: 0xff8a2b })
      );
      fire.position.set(1.2, 0.4, 0.5);
      dg.add(fire);
    } else if (disc.kind === 'old_hut') {
      const hut = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.4, 2.8), woodMat);
      hut.position.y = 1.2;
      dg.add(hut);
      const roof = new THREE.Mesh(
        new THREE.ConeGeometry(2.6, 1.6, 4),
        new THREE.MeshStandardMaterial({ color: 0x4c3a28, roughness: 0.9 })
      );
      roof.rotation.y = Math.PI / 4;
      roof.position.y = 3.1;
      dg.add(roof);
    } else if (disc.kind === 'map_fragment_bottle') {
      const bottle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.22, 0.78, 8),
        new THREE.MeshStandardMaterial({ color: 0x2d8a68, roughness: 0.22 })
      );
      bottle.position.y = 0.38;
      bottle.rotation.z = 0.35;
      dg.add(bottle);
      const glow = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 6, 6),
        new THREE.MeshBasicMaterial({ color: 0xfde047 })
      );
      glow.position.y = 0.85;
      dg.add(glow);
    } else if (disc.kind === 'pirate_chest') {
      // Rich Corsair Plunder Chest + crimson pirate banner stake
      const base = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.85, 0.98), woodMat);
      base.position.y = 0.44;
      dg.add(base);
      const lid = new THREE.Mesh(
        new THREE.CylinderGeometry(0.49, 0.49, 1.45, 8, 1, false, 0, Math.PI),
        woodMat
      );
      lid.rotation.z = Math.PI / 2;
      lid.position.y = 0.84;
      dg.add(lid);
      const lock = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.28, 0.14), brassMat);
      lock.position.set(0, 0.72, 0.52);
      dg.add(lock);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 2.3, 6), woodMat);
      pole.position.set(-1.1, 1.15, -0.5);
      dg.add(pole);
      const pennant = new THREE.Mesh(
        new THREE.BoxGeometry(0.85, 0.48, 0.05),
        new THREE.MeshStandardMaterial({ color: 0x9b2226, roughness: 0.75 })
      );
      pennant.position.set(-0.68, 2.02, -0.5);
      dg.add(pennant);
    } else {
      const chest = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.78, 0.85), woodMat);
      chest.position.y = 0.42;
      dg.add(chest);
      const band = new THREE.Mesh(new THREE.BoxGeometry(1.26, 0.16, 0.9), brassMat);
      band.position.y = 0.65;
      dg.add(band);
    }

    root.add(dg);
    discoveryMeshes.set(disc.id, dg);
  }

  // Beached Shipwrecks tilted on shore
  for (const bw of island.beachedWrecks) {
    if (bw.searched) continue;
    const bwMesh = buildShipwreckMesh('abandoned_sloop', bw.scale * 0.88, textures, false);
    const bh = Math.max(0.25, sampleIslandTerrainHeight(island, bw.worldX, bw.worldZ));
    bwMesh.position.set(bw.localX, bh + 0.15, bw.localZ);
    bwMesh.rotation.set(0.18, bw.rotation, 0.32);
    root.add(bwMesh);
    beachedWreckMeshes.set(bw.id, bwMesh);
  }

  return { root, discoveryMeshes, beachedWreckMeshes };
}

export function buildIcebergMesh(iceberg: IcebergData): THREE.Group {
  const g = new THREE.Group();
  const iceMat = new THREE.MeshStandardMaterial({
    color: 0xdff2fc,
    roughness: 0.42,
    metalness: 0.08,
    flatShading: true,
  });
  const blueIceMat = new THREE.MeshStandardMaterial({
    color: 0x8ac4e2,
    roughness: 0.35,
    metalness: 0.12,
    flatShading: true,
  });

  const mainPeak = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 0), iceMat);
  mainPeak.scale.set(iceberg.radius * 0.78, iceberg.height * 0.85, iceberg.radius * 0.72);
  mainPeak.position.set(0, iceberg.height * 0.3, 0);
  mainPeak.rotation.set(0.15, iceberg.rotation, -0.1);
  g.add(mainPeak);

  const subCount = iceberg.isGiant ? 4 : 2;
  for (let i = 0; i < subCount; i++) {
    const ang = (i / subCount) * Math.PI * 2 + iceberg.variant * 0.8;
    const sub = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 0), i % 2 === 0 ? blueIceMat : iceMat);
    const sr = iceberg.radius * (0.42 + (i % 2) * 0.16);
    const sh = iceberg.height * (0.42 + ((i + 1) % 2) * 0.18);
    sub.scale.set(sr, sh, sr * 0.85);
    sub.position.set(Math.cos(ang) * iceberg.radius * 0.45, sh * 0.18, Math.sin(ang) * iceberg.radius * 0.45);
    sub.rotation.set(0.2, ang, 0.18);
    g.add(sub);
  }

  const submergedBase = new THREE.Mesh(new THREE.CylinderGeometry(iceberg.radius * 0.92, iceberg.radius * 0.72, 2.2, 8), blueIceMat);
  submergedBase.position.y = -0.8;
  g.add(submergedBase);

  return g;
}

export function buildIceChunkMesh(chunk: IceChunkData): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xe6f6ff, roughness: 0.45, flatShading: true });
  const slab = new THREE.Mesh(new THREE.CylinderGeometry(chunk.radius * 0.9, chunk.radius, chunk.height, 7), mat);
  slab.position.y = chunk.height * 0.25;
  g.add(slab);
  return g;
}

export function buildBreakableIceSheetMesh(sheet: BreakableIceSheetData): BuiltBreakableIceSheet {
  const root = new THREE.Group();
  root.position.set(sheet.x, 0.14, sheet.z);
  root.rotation.y = sheet.rotation;

  const baseColor = sheet.thickness === 1 ? 0xd9f2fc : sheet.thickness === 2 ? 0xc0e4f6 : 0xa3d4ee;
  const material = new THREE.MeshStandardMaterial({
    color: baseColor,
    roughness: 0.38,
    metalness: 0.08,
    transparent: true,
    opacity: sheet.thickness === 1 ? 0.78 : 0.9,
    flatShading: true,
  });

  const slabH = sheet.thickness === 1 ? 0.34 : sheet.thickness === 2 ? 0.52 : 0.75;
  const sheetMesh = new THREE.Mesh(new THREE.CylinderGeometry(sheet.radius * 0.95, sheet.radius, slabH, 9), material);
  sheetMesh.position.y = 0.05;
  root.add(sheetMesh);

  // Visible dark fracture lines revealed progressively per crackStage
  const crackLines = new THREE.Group();
  const crackMat = new THREE.MeshBasicMaterial({ color: 0x1e3a4c });
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2 + 0.25;
    const line = new THREE.Mesh(new THREE.BoxGeometry(sheet.radius * 1.4, 0.1, 0.32), crackMat);
    line.rotation.y = ang;
    line.position.y = slabH * 0.5 + 0.04;
    line.visible = false;
    crackLines.add(line);
  }
  root.add(crackLines);

  return { root, sheetMesh, crackLines, material };
}

export function updateBreakableIceSheetVisuals(
  built: BuiltBreakableIceSheet,
  sheet: BreakableIceSheetData
): void {
  if (sheet.broken) {
    built.root.visible = false;
    return;
  }
  const activeLines = sheet.crackStage === 0 ? 0 : sheet.crackStage === 1 ? 2 : 6;
  built.crackLines.children.forEach((child, idx) => {
    child.visible = idx < activeLines;
  });
  built.material.opacity = sheet.crackStage >= 2 ? 0.65 : sheet.thickness === 1 ? 0.78 : 0.9;
}

export function buildWildlifeMesh(actor: WildlifeActorData): BuiltWildlife {
  const root = new THREE.Group();
  const limbs: THREE.Object3D[] = [];
  const wings: THREE.Object3D[] = [];
  let tail: THREE.Object3D | null = null;
  const body = new THREE.Group();
  root.add(body);

  const s = actor.species;
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x11151c, roughness: 0.2 });

  if (s === 'dolphin' || s === 'ocean_shark' || s === 'whale_pod' || s === 'seal') {
    const isWhale = s === 'whale_pod';
    const isShark = s === 'ocean_shark';
    const isSeal = s === 'seal';
    const scale = isWhale ? 2.45 : isShark ? 1.18 : isSeal ? 0.82 : 0.96;
    const topMat = new THREE.MeshStandardMaterial({
      color: isWhale ? 0x263847 : isShark ? 0x4c5d6b : isSeal ? 0x655e54 : 0x467491,
      roughness: 0.38,
    });
    const bellyMat = new THREE.MeshStandardMaterial({
      color: isWhale ? 0x7b909e : isShark ? 0xd5dfe6 : isSeal ? 0xa39a8e : 0xc6dce9,
      roughness: 0.5,
    });

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.42 * scale, 1.7 * scale, 5, 10), topMat);
    torso.rotation.x = Math.PI / 2;
    body.add(torso);

    const belly = new THREE.Mesh(new THREE.CapsuleGeometry(0.32 * scale, 1.35 * scale, 4, 8), bellyMat);
    belly.rotation.x = Math.PI / 2;
    belly.position.y = -0.14 * scale;
    body.add(belly);

    const snout = new THREE.Mesh(
      new THREE.ConeGeometry(isWhale ? 0.36 * scale : 0.2 * scale, (isSeal ? 0.45 : 0.72) * scale, 7),
      topMat
    );
    snout.rotation.x = -Math.PI / 2;
    snout.position.set(0, -0.02 * scale, -1.16 * scale);
    body.add(snout);

    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.055 * scale, 6, 6), eyeMat);
      eye.position.set(sx * 0.28 * scale, 0.1 * scale, -0.78 * scale);
      body.add(eye);

      const pec = new THREE.Mesh(new THREE.BoxGeometry(0.55 * scale, 0.07 * scale, 0.28 * scale), topMat);
      pec.position.set(sx * 0.46 * scale, -0.1 * scale, -0.25 * scale);
      pec.rotation.y = sx * 0.35;
      pec.rotation.z = sx * -0.22;
      body.add(pec);
      wings.push(pec);
    }

    if (isShark || s === 'dolphin') {
      const dorsal = new THREE.Mesh(new THREE.ConeGeometry(0.22 * scale, 0.78 * scale, 5), topMat);
      dorsal.position.set(0, 0.55 * scale, 0.08 * scale);
      dorsal.rotation.x = 0.36;
      body.add(dorsal);
    }

    const tailGroup = new THREE.Group();
    tailGroup.position.set(0, 0, 1.15 * scale);
    const fluke = new THREE.Mesh(
      new THREE.BoxGeometry(isShark ? 0.12 * scale : 0.95 * scale, isShark ? 0.85 * scale : 0.12 * scale, 0.55 * scale),
      topMat
    );
    fluke.position.z = 0.25 * scale;
    tailGroup.add(fluke);
    body.add(tailGroup);
    tail = tailGroup;
  } else if (s === 'sea_turtle') {
    const shellMat = new THREE.MeshStandardMaterial({ color: 0x396635, roughness: 0.65 });
    const scuteMat = new THREE.MeshStandardMaterial({ color: 0x528044, roughness: 0.7 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0x6f9154, roughness: 0.74 });

    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.75, 10, 7), shellMat);
    shell.scale.set(0.95, 0.4, 1.18);
    body.add(shell);

    const ridge = new THREE.Mesh(new THREE.SphereGeometry(0.54, 8, 6), scuteMat);
    ridge.scale.set(0.82, 0.45, 1.02);
    ridge.position.y = 0.09;
    body.add(ridge);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 7, 7), skinMat);
    head.scale.set(0.9, 0.82, 1.2);
    head.position.set(0, 0.08, -0.96);
    body.add(head);

    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 5, 5), eyeMat);
      eye.position.set(sx * 0.16, 0.16, -1.1);
      body.add(eye);

      const frontFlipper = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.08, 0.3), skinMat);
      frontFlipper.position.set(sx * 0.74, -0.02, -0.35);
      frontFlipper.rotation.y = sx * 0.3;
      body.add(frontFlipper);
      wings.push(frontFlipper);

      const rearFlipper = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.07, 0.24), skinMat);
      rearFlipper.position.set(sx * 0.52, -0.05, 0.66);
      rearFlipper.rotation.y = sx * -0.45;
      body.add(rearFlipper);
    }
  } else if (s === 'manta_ray') {
    const mantleMat = new THREE.MeshStandardMaterial({ color: 0x243b4f, roughness: 0.44 });
    const underMat = new THREE.MeshStandardMaterial({ color: 0xcfe2ec, roughness: 0.56 });
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.88, 0.22, 8), mantleMat);
    disc.scale.set(1.25, 0.72, 1.05);
    body.add(disc);
    const belly = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.7, 0.14, 8), underMat);
    belly.position.y = -0.05;
    belly.scale.set(1.18, 0.7, 0.96);
    body.add(belly);

    for (const sx of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.ConeGeometry(0.65, 1.48, 4), mantleMat);
      wing.rotation.z = sx * -Math.PI / 2;
      wing.scale.set(0.32, 1.0, 0.9);
      wing.position.set(sx * 1.12, 0.02, -0.05);
      body.add(wing);
      wings.push(wing);

      const lobe = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.42), underMat);
      lobe.position.set(sx * 0.36, -0.02, -1.06);
      body.add(lobe);
    }

    const whip = new THREE.Mesh(new THREE.ConeGeometry(0.06, 1.85, 5), mantleMat);
    whip.rotation.x = Math.PI / 2;
    whip.position.set(0, 0.01, 1.72);
    body.add(whip);
    tail = whip;
  } else if (s === 'swordfish') {
    const dorsalMat = new THREE.MeshStandardMaterial({ color: 0x244c7a, roughness: 0.32, metalness: 0.35 });
    const flankMat = new THREE.MeshStandardMaterial({ color: 0xb7cadc, roughness: 0.36, metalness: 0.45 });
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 1.65, 5, 8), dorsalMat);
    torso.rotation.x = Math.PI / 2;
    body.add(torso);
    const belly = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 1.35, 4, 8), flankMat);
    belly.rotation.x = Math.PI / 2;
    belly.position.y = -0.09;
    body.add(belly);
    const sword = new THREE.Mesh(new THREE.ConeGeometry(0.055, 1.35, 6), dorsalMat);
    sword.rotation.x = -Math.PI / 2;
    sword.position.set(0, 0.02, -1.58);
    body.add(sword);
    const dorsal = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.92, 4), dorsalMat);
    dorsal.position.set(0, 0.56, -0.15);
    dorsal.rotation.x = 0.35;
    body.add(dorsal);
    const tailGroup = new THREE.Group();
    tailGroup.position.set(0, 0, 1.05);
    const forkTop = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.92, 0.34), dorsalMat);
    forkTop.position.z = 0.22;
    tailGroup.add(forkTop);
    body.add(tailGroup);
    tail = tailGroup;
  } else if (s === 'fish_school' || s === 'parrotfish' || s === 'arctic_cod_shoal') {
    const isParrot = s === 'parrotfish';
    const isCod = s === 'arctic_cod_shoal';
    const fishColor = isParrot ? 0x2ec7a8 : isCod ? 0x9ec0d4 : 0x7cb8cc;
    const finColor = isParrot ? 0xf29f4b : isCod ? 0xd9e8f2 : 0x528ea4;
    const fishMat = new THREE.MeshStandardMaterial({ color: fishColor, roughness: 0.32, metalness: 0.35 });
    const finMat = new THREE.MeshStandardMaterial({ color: finColor, roughness: 0.42 });
    const count = isParrot ? 9 : 7;
    for (let i = 0; i < count; i++) {
      const fg = new THREE.Group();
      const fBody = new THREE.Mesh(new THREE.ConeGeometry(isParrot ? 0.15 : 0.13, isParrot ? 0.5 : 0.48, 6), fishMat);
      fBody.rotation.x = -Math.PI / 2;
      fg.add(fBody);
      const fTail = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.2, 0.2), finMat);
      fTail.position.z = 0.26;
      fg.add(fTail);
      if (isParrot) {
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.14), finMat);
        stripe.position.z = -0.04;
        fg.add(stripe);
      }
      fg.position.set(((i % 3) - 1) * 0.72, (i % 2) * 0.22, (Math.floor(i / 3) - 0.9) * 0.78);
      body.add(fg);
    }
  } else if (s === 'seabird' || s === 'ocean_flock_bird') {
    const isPelagic = s === 'ocean_flock_bird';
    const gullMat = new THREE.MeshStandardMaterial({ color: isPelagic ? 0xf7fafc : 0xf4f7fa, roughness: 0.74 });
    const tipMat = new THREE.MeshStandardMaterial({ color: isPelagic ? 0x263240 : 0x3b4552, roughness: 0.8 });
    const beakMat = new THREE.MeshStandardMaterial({ color: isPelagic ? 0xd88b28 : 0xe6a135, roughness: 0.5 });
    const sc = isPelagic ? 1.28 : 1.0;

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.16 * sc, 0.48 * sc, 4, 8), gullMat);
    torso.rotation.x = Math.PI / 2;
    body.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.14 * sc, 6, 6), gullMat);
    head.position.set(0, 0.08 * sc, -0.36 * sc);
    body.add(head);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.055 * sc, 0.26 * sc, 5), beakMat);
    beak.rotation.x = -Math.PI / 2;
    beak.position.set(0, 0.06 * sc, -0.58 * sc);
    body.add(beak);
    const tailFan = new THREE.Mesh(new THREE.BoxGeometry(0.34 * sc, 0.04 * sc, 0.28 * sc), tipMat);
    tailFan.position.set(0, 0.02 * sc, 0.36 * sc);
    body.add(tailFan);
    tail = tailFan;

    for (const side of [-1, 1]) {
      const wingGrp = new THREE.Group();
      const inner = new THREE.Mesh(new THREE.BoxGeometry(0.62 * sc, 0.045 * sc, 0.26 * sc), isPelagic ? tipMat : gullMat);
      inner.position.set(side * 0.31 * sc, 0, 0);
      wingGrp.add(inner);
      const outer = new THREE.Mesh(new THREE.BoxGeometry(0.52 * sc, 0.04 * sc, 0.2 * sc), tipMat);
      outer.position.set(side * 0.82 * sc, 0, 0.07 * sc);
      wingGrp.add(outer);
      wingGrp.position.set(side * 0.1 * sc, 0.05 * sc, -0.04 * sc);
      body.add(wingGrp);
      wings.push(wingGrp);
    }
  } else if (s === 'snake') {
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x4b5c2c, roughness: 0.6 });
    const bandMat = new THREE.MeshStandardMaterial({ color: 0x998845, roughness: 0.65 });
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.16, 0.34), baseMat);
    head.position.set(0, 0.18, -0.26);
    body.add(head);
    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 5, 5), new THREE.MeshBasicMaterial({ color: 0xffc83d }));
      eye.position.set(sx * 0.1, 0.23, -0.34);
      body.add(eye);
    }
    for (let seg = 0; seg < 6; seg++) {
      const sMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.16 - seg * 0.017, 7, 7),
        seg % 2 === 0 ? bandMat : baseMat
      );
      sMesh.scale.set(1.0, 0.78, 1.35);
      sMesh.position.set(Math.sin(seg * 1.1) * 0.16, 0.13, seg * 0.34);
      body.add(sMesh);
      limbs.push(sMesh);
    }
  } else if (s === 'crocodile') {
    const crocMat = new THREE.MeshStandardMaterial({ color: 0x384d28, roughness: 0.84 });
    const ridgeMat = new THREE.MeshStandardMaterial({ color: 0x26351a, roughness: 0.9 });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.34, 1.98), crocMat);
    torso.position.y = 0.28;
    body.add(torso);
    for (let r = -2; r <= 2; r++) {
      const scute = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.18, 4), ridgeMat);
      scute.position.set(0, 0.49, r * 0.34);
      body.add(scute);
    }
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.28, 0.56), crocMat);
    head.position.set(0, 0.32, -1.16);
    body.add(head);
    const snout = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.18, 0.78), crocMat);
    snout.position.set(0, 0.24, -1.68);
    body.add(snout);
    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 5, 5), new THREE.MeshBasicMaterial({ color: 0xe8b938 }));
      eye.position.set(sx * 0.18, 0.44, -1.25);
      body.add(eye);
      for (const sz of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.22, 0.26), crocMat);
        leg.position.set(sx * 0.46, 0.14, sz * 0.62);
        body.add(leg);
        limbs.push(leg);
      }
    }
    const tailMesh = new THREE.Mesh(new THREE.ConeGeometry(0.25, 1.45, 5), crocMat);
    tailMesh.rotation.x = Math.PI / 2;
    tailMesh.position.set(0, 0.24, 1.56);
    body.add(tailMesh);
    tail = tailMesh;
  } else {
    // Detailed Boar, Wolf, Bear (multi-part head, ears, snout, dorsal/shoulders, paws & tail)
    const isBear = s === 'bear';
    const isWolf = s === 'wolf';
    const sc = isBear ? 1.42 : isWolf ? 0.94 : 0.9;
    const furColor = isBear ? 0xdfe7ed : isWolf ? 0x6c727a : 0x4b382a;
    const accentColor = isBear ? 0xc2cdd6 : isWolf ? 0x8f97a0 : 0x35261b;
    const mat = new THREE.MeshStandardMaterial({ color: furColor, roughness: 0.88 });
    const accentMat = new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.9 });
    const noseMat = new THREE.MeshStandardMaterial({ color: 0x1b1a1d, roughness: 0.4 });

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.38 * sc, 0.86 * sc, 5, 9), mat);
    torso.rotation.x = Math.PI / 2;
    torso.position.y = 0.74 * sc;
    body.add(torso);

    const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.41 * sc, 8, 7), accentMat);
    shoulder.scale.set(0.92, 0.95, 0.88);
    shoulder.position.set(0, 0.8 * sc, -0.34 * sc);
    body.add(shoulder);

    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.9 * sc, -0.78 * sc);
    const skull = new THREE.Mesh(new THREE.BoxGeometry(0.44 * sc, 0.4 * sc, 0.46 * sc), mat);
    headGroup.add(skull);

    const snout = new THREE.Mesh(
      new THREE.BoxGeometry(0.24 * sc, 0.22 * sc, (isWolf ? 0.36 : 0.28) * sc),
      accentMat
    );
    snout.position.set(0, -0.06 * sc, -0.32 * sc);
    headGroup.add(snout);

    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.065 * sc, 6, 6), noseMat);
    nose.position.set(0, -0.03 * sc, -0.47 * sc);
    headGroup.add(nose);

    for (const sx of [-1, 1]) {
      const ear = new THREE.Mesh(
        isWolf ? new THREE.ConeGeometry(0.09 * sc, 0.22 * sc, 4) : new THREE.SphereGeometry(0.095 * sc, 6, 6),
        accentMat
      );
      ear.position.set(sx * 0.17 * sc, 0.24 * sc, 0.06 * sc);
      headGroup.add(ear);

      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045 * sc, 5, 5), eyeMat);
      eye.position.set(sx * 0.14 * sc, 0.07 * sc, -0.22 * sc);
      headGroup.add(eye);
    }

    if (s === 'boar') {
      const tuskMat = new THREE.MeshStandardMaterial({ color: 0xeee6d2, roughness: 0.4 });
      for (const sx of [-1, 1]) {
        const tusk = new THREE.Mesh(new THREE.ConeGeometry(0.048, 0.26, 5), tuskMat);
        tusk.rotation.x = -Math.PI * 0.28;
        tusk.rotation.z = sx * -0.22;
        tusk.position.set(sx * 0.14 * sc, -0.08 * sc, -0.38 * sc);
        headGroup.add(tusk);
      }
    }
    body.add(headGroup);

    const tailMesh = new THREE.Mesh(
      isWolf ? new THREE.ConeGeometry(0.11 * sc, 0.56 * sc, 6) : new THREE.SphereGeometry(0.12 * sc, 6, 6),
      accentMat
    );
    if (isWolf) {
      tailMesh.rotation.x = Math.PI * 0.72;
      tailMesh.position.set(0, 0.72 * sc, 0.85 * sc);
    } else {
      tailMesh.position.set(0, 0.78 * sc, 0.74 * sc);
    }
    body.add(tailMesh);
    tail = tailMesh;

    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const legGrp = new THREE.Group();
        legGrp.position.set(sx * 0.27 * sc, 0.54 * sc, sz * 0.45 * sc);
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.105 * sc, 0.085 * sc, 0.52 * sc, 7), mat);
        leg.position.y = -0.25 * sc;
        legGrp.add(leg);
        const paw = new THREE.Mesh(new THREE.BoxGeometry(0.18 * sc, 0.1 * sc, 0.22 * sc), accentMat);
        paw.position.set(0, -0.49 * sc, -0.03 * sc);
        legGrp.add(paw);
        body.add(legGrp);
        limbs.push(legGrp);
      }
    }
  }

  return { root, body, limbs, tail, wings };
}

export function animateWildlifeMesh(built: BuiltWildlife, actor: WildlifeActorData): void {
  if (actor.dead) {
    if (actor.domain === 'air' && (actor.vy ?? 0) < -0.1) {
      built.root.rotation.x = 0.85;
      built.root.rotation.z = Math.sin(actor.animPhase * 3.5) * 0.65;
    } else {
      built.root.rotation.x = 0;
      built.root.rotation.z = Math.PI * 0.48;
    }
    if (built.wings.length > 0) {
      built.wings.forEach((w, idx) => {
        const sign = idx % 2 === 0 ? -1 : 1;
        w.rotation.z = sign * 0.36;
      });
    }
    built.root.visible = !actor.harvested;
    return;
  }
  built.root.rotation.x = 0;
  built.root.rotation.z = 0;

  if (built.tail) {
    built.tail.rotation.y = Math.sin(actor.animPhase) * 0.35;
  }
  if (built.wings.length > 0) {
    built.wings.forEach((w, idx) => {
      const sign = idx % 2 === 0 ? -1 : 1;
      w.rotation.z = sign * Math.sin(actor.animPhase * 1.4) * 0.48;
    });
  }
  if (actor.species === 'snake' && built.limbs.length > 0) {
    built.limbs.forEach((seg, idx) => {
      seg.position.x = Math.sin(actor.animPhase * 1.3 + idx * 0.9) * 0.18;
    });
  } else if (built.limbs.length >= 4) {
    built.limbs.forEach((leg, idx) => {
      const phase = idx % 2 === 0 ? 0 : Math.PI;
      leg.rotation.x = Math.sin(actor.animPhase * 1.5 + phase) * 0.45 * Math.min(1, actor.speed / 3.5);
    });
  }
}

export interface BuiltIslandPirateGuard {
  root: THREE.Group;
  weaponArm: THREE.Object3D;
  leftLeg: THREE.Object3D;
  rightLeg: THREE.Object3D;
  torsoMat: THREE.MeshStandardMaterial;
}

export function buildIslandPirateGuardMesh(guard: IslandPirateGuardData): BuiltIslandPirateGuard {
  const root = new THREE.Group();
  const isPistol = guard.role === 'pistol';
  const isTribal = Boolean(guard.tribal);

  const torsoMat = new THREE.MeshStandardMaterial({
    color: isTribal ? 0x8a5a38 : isPistol ? 0x2a3b4c : 0x7c2824,
    roughness: 0.78,
  });
  const trouserMat = new THREE.MeshStandardMaterial({ color: isTribal ? 0x6b4a2e : 0x2b2723, roughness: 0.88 });
  const skinMat = new THREE.MeshStandardMaterial({ color: isTribal ? 0x9a6a46 : 0xd5a77f, roughness: 0.72 });
  const sashMat = new THREE.MeshStandardMaterial({
    color: isTribal ? (isPistol ? 0x2f8f6a : 0x2b6fa8) : isPistol ? 0xc99d4e : 0xa82e29,
    roughness: 0.7,
  });
  const hatMat = new THREE.MeshStandardMaterial({ color: 0x1e1d22, roughness: 0.85 });
  const ironMat = new THREE.MeshStandardMaterial({ color: 0x424852, roughness: 0.35, metalness: 0.82 });
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xd6a648, roughness: 0.3, metalness: 0.84 });

  // Boots & legs
  const leftLeg = new THREE.Group();
  leftLeg.position.set(-0.18, 0.72, 0);
  const lLegMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.095, 0.72, 7), trouserMat);
  lLegMesh.position.y = -0.36;
  leftLeg.add(lLegMesh);
  root.add(leftLeg);

  const rightLeg = new THREE.Group();
  rightLeg.position.set(0.18, 0.72, 0);
  const rLegMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.095, 0.72, 7), trouserMat);
  rLegMesh.position.y = -0.36;
  rightLeg.add(rLegMesh);
  root.add(rightLeg);

  // Coat torso + waist sash
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.74, 0.34), torsoMat);
  torso.position.y = 1.09;
  root.add(torso);

  const sash = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.14, 0.38), sashMat);
  sash.position.y = 0.8;
  root.add(sash);

  // Head & bandana or tricorn hat
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), skinMat);
  head.position.y = 1.65;
  root.add(head);

  if (isTribal) {
    // Feathered headdress
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.215, 0.215, 0.07, 10), sashMat);
    band.position.y = 1.75;
    root.add(band);
    const featherColors = [0xd8452f, 0xefc570, 0x2f8f6a];
    for (let i = 0; i < 3; i++) {
      const feather = new THREE.Mesh(
        new THREE.ConeGeometry(0.045, 0.42, 5),
        new THREE.MeshStandardMaterial({ color: featherColors[i], roughness: 0.6 })
      );
      feather.position.set((i - 1) * 0.11, 2.0, -0.04);
      feather.rotation.z = (i - 1) * -0.28;
      root.add(feather);
    }
  } else if (isPistol) {
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.4, 0.08, 3), hatMat);
    brim.position.y = 1.82;
    root.add(brim);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.21, 0.16, 8), hatMat);
    crown.position.y = 1.88;
    root.add(crown);
  } else {
    const bandana = new THREE.Mesh(new THREE.SphereGeometry(0.215, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.55), sashMat);
    bandana.position.y = 1.67;
    root.add(bandana);
  }

  // Left arm
  const leftArm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.075, 0.58, 6), torsoMat);
  leftArm.position.set(-0.37, 1.12, 0.06);
  leftArm.rotation.z = 0.16;
  root.add(leftArm);

  // Right weapon arm + Cutlass or Flintlock Pistol
  const weaponArm = new THREE.Group();
  weaponArm.position.set(0.37, 1.35, 0);
  const rArmMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.075, 0.54, 6), torsoMat);
  rArmMesh.position.y = -0.24;
  weaponArm.add(rArmMesh);

  if (isTribal && isPistol) {
    // Hunting bow
    const bow = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.017, 6, 14, Math.PI), trouserMat);
    bow.position.set(0, -0.45, 0.22);
    bow.rotation.set(0, Math.PI / 2, Math.PI / 2);
    weaponArm.add(bow);
    weaponArm.rotation.x = -1.2;
  } else if (isTribal) {
    // Stone-tipped spear
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.5, 6), trouserMat);
    shaft.position.set(0, -0.3, 0.3);
    shaft.rotation.x = Math.PI * 0.42;
    weaponArm.add(shaft);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.2, 6), ironMat);
    tip.position.set(0, -0.12, 1.0);
    tip.rotation.x = Math.PI * 0.42;
    weaponArm.add(tip);
    weaponArm.rotation.x = -0.6;
  } else if (isPistol) {
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.34), trouserMat);
    stock.position.set(0, -0.46, 0.16);
    weaponArm.add(stock);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.03, 0.4, 7), ironMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, -0.42, 0.26);
    weaponArm.add(barrel);
    const lock = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.1), brassMat);
    lock.position.set(0.01, -0.43, 0.12);
    weaponArm.add(lock);
    weaponArm.rotation.x = -1.2;
  } else {
    const guardHilt = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.016, 6, 10, Math.PI), brassMat);
    guardHilt.position.set(0, -0.48, 0.1);
    weaponArm.add(guardHilt);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.68, 0.08), ironMat);
    blade.position.set(0, -0.48, 0.38);
    blade.rotation.x = Math.PI * 0.42;
    weaponArm.add(blade);
    weaponArm.rotation.x = -0.6;
  }
  root.add(weaponArm);

  return { root, weaponArm, leftLeg, rightLeg, torsoMat };
}

export function animateIslandPirateGuardMesh(
  built: BuiltIslandPirateGuard,
  guard: IslandPirateGuardData
): void {
  if (guard.dead) {
    built.root.rotation.x = -Math.PI * 0.48;
    built.root.position.y = guard.y + 0.18;
    built.root.visible = !guard.looted;
    return;
  }
  built.root.rotation.x = 0;
  built.root.visible = true;
  built.torsoMat.emissive.setHex(guard.hitFlashTimer > 0 ? 0x6b1410 : 0x000000);

  const stride = Math.min(1, guard.speed / 3.5);
  built.leftLeg.rotation.x = Math.sin(guard.animPhase) * 0.5 * stride;
  built.rightLeg.rotation.x = -Math.sin(guard.animPhase) * 0.5 * stride;

  if (guard.role === 'cutlass') {
    const slash = guard.attackCooldown > 0.75 ? -1.3 : -0.55 + Math.sin(guard.animPhase * 0.5) * 0.14;
    built.weaponArm.rotation.x = slash;
  } else {
    built.weaponArm.rotation.x = guard.reloadTimer > 1.8 ? -0.4 : -1.35;
  }
}
