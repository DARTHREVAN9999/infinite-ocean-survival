import {
  BreakableIceSheetData,
  FloatingCrateData,
  IceChunkData,
  IcebergData,
  IslandData,
  MerchantShipData,
  OceanBiomeId,
  PirateFactionId,
  PirateFactionState,
  PirateShipData,
  PirateTier,
  RockHazardData,
  SeaMonsterData,
  ShipwreckData,
  VesselClass,
  WildlifeActorData,
  WildlifeSpecies,
  WreckArchetype,
} from './types';
import { generateMerchantShip, generateShipwreck } from './economy';
import { generateGhostShip, generatePirateShip } from './combat';
import { createRandomCrewMember } from './survival';
import { createInitialFactions, getDominantFactionForPosition } from './factions';
import { generateSeaMonster } from './monsters';
import { getOceanBiome } from './biomes';
import { buildProceduralIsland, sampleIslandTerrainHeight } from './islands';
import { createWildlifeActor, pickIslandWildlifePool } from './fpsCombat';

export const CHUNK_SIZE = 520;

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashCoords(seed: number, cx: number, cz: number): number {
  let h = seed ^ 0x9e3779b9;
  h = Math.imul(h ^ (cx * 374761393), 668265263);
  h = Math.imul(h ^ (cz * 1274126177), 2246822519);
  return (h ^ (h >>> 13)) >>> 0;
}

export function chunkKey(cx: number, cz: number): string {
  return `${cx},${cz}`;
}

export function worldToChunk(x: number, z: number): { cx: number; cz: number } {
  return {
    cx: Math.floor(x / CHUNK_SIZE),
    cz: Math.floor(z / CHUNK_SIZE),
  };
}

export interface WorldChunkData {
  key: string;
  cx: number;
  cz: number;
  biome: OceanBiomeId;
  wrecks: ShipwreckData[];
  crates: FloatingCrateData[];
  merchants: MerchantShipData[];
  pirates: PirateShipData[];
  monsters: SeaMonsterData[];
  rocks: RockHazardData[];
  islands: IslandData[];
  icebergs: IcebergData[];
  iceChunks: IceChunkData[];
  iceSheets: BreakableIceSheetData[];
  wildlife: WildlifeActorData[];
}

function pickWreckArchetype(distFromOrigin: number, rand: () => number): WreckArchetype {
  const r = rand();
  if (distFromOrigin < 480) {
    if (r < 0.34) return 'fishing_boat';
    if (r < 0.64) return 'abandoned_sloop';
    if (r < 0.84) return 'merchant_vessel';
    if (r < 0.94) return 'cargo_hulk';
    return 'storm_sunken';
  }
  if (distFromOrigin < 1150) {
    if (r < 0.14) return 'abandoned_sloop';
    if (r < 0.32) return 'merchant_vessel';
    if (r < 0.48) return 'cargo_hulk';
    if (r < 0.63) return 'pirate_wreck';
    if (r < 0.77) return 'trading_galleon';
    if (r < 0.88) return 'military_frigate';
    if (r < 0.95) return 'enormous_merchant';
    return 'storm_sunken';
  }
  if (r < 0.11) return 'treasure_galleon';
  if (r < 0.25) return 'trading_galleon';
  if (r < 0.40) return 'military_frigate';
  if (r < 0.54) return 'pirate_wreck';
  if (r < 0.68) return 'enormous_merchant';
  if (r < 0.80) return 'massive_warship';
  if (r < 0.89) return 'gigantic_wreck';
  if (r < 0.95) return 'merchant_vessel';
  return 'storm_sunken';
}

function pickPirateTier(distFromOrigin: number, rand: () => number): PirateTier {
  const r = rand();
  if (distFromOrigin < 600) {
    return r < 0.78 ? 'sloop' : 'brigantine';
  }
  if (distFromOrigin < 1300) {
    if (r < 0.36) return 'sloop';
    if (r < 0.78) return 'brigantine';
    return 'galleon';
  }
  if (r < 0.26) return 'sloop';
  if (r < 0.54) return 'brigantine';
  if (r < 0.84) return 'galleon';
  return 'dreadnought';
}

function pickVesselClass(distFromOrigin: number, rand: () => number): VesselClass {
  const r = rand();
  if (distFromOrigin < 520) {
    if (r < 0.22) return 'fishing_boat';
    if (r < 0.42) return 'fishing_trawler';
    if (r < 0.62) return 'small_merchant';
    if (r < 0.78) return 'medium_merchant';
    if (r < 0.88) return 'supply_ship';
    if (r < 0.94) return 'crown_patrol';
    return 'crown_sloop';
  }
  if (distFromOrigin < 1200) {
    if (r < 0.1) return 'fishing_boat';
    if (r < 0.22) return 'fishing_trawler';
    if (r < 0.32) return 'small_merchant';
    if (r < 0.46) return 'medium_merchant';
    if (r < 0.58) return 'large_cargo';
    if (r < 0.68) return 'passenger_ship';
    if (r < 0.76) return 'supply_ship';
    if (r < 0.82) return 'crown_patrol';
    if (r < 0.88) return 'crown_sloop';
    if (r < 0.94) return 'crown_corvette';
    return 'crown_supply';
  }
  if (r < 0.08) return 'fishing_trawler';
  if (r < 0.19) return 'medium_merchant';
  if (r < 0.31) return 'large_cargo';
  if (r < 0.42) return 'passenger_ship';
  if (r < 0.51) return 'supply_ship';
  if (r < 0.63) return 'wealthy_trader';
  if (r < 0.69) return 'treasure_ship';
  if (r < 0.76) return 'crown_corvette';
  if (r < 0.83) return 'crown_frigate';
  if (r < 0.9) return 'crown_warship';
  if (r < 0.94) return 'crown_ship_of_line';
  if (r < 0.97) return 'crown_supply';
  return 'crown_flagship';
}

function createFloatingCrate(id: string, x: number, z: number, rand: () => number): FloatingCrateData {
  const roll = rand();
  const kind: FloatingCrateData['kind'] =
    roll < 0.32
      ? 'crate'
      : roll < 0.56
        ? 'barrel'
        : roll < 0.72
          ? 'timber_debris'
          : roll < 0.86
            ? 'supply_bundle'
            : roll < 0.93
              ? 'raft'
              : 'treasure_buoy';

  const loot: FloatingCrateData['loot'] = {};
  let gold = 0;
  let survivor: FloatingCrateData['survivor'] = undefined;

  if (kind === 'crate') {
    loot.wood = 4 + Math.floor(rand() * 7);
    loot.rope = 2 + Math.floor(rand() * 5);
    loot.food = 3 + Math.floor(rand() * 6);
    gold = Math.floor(rand() * 16);
  } else if (kind === 'barrel') {
    loot.water = 6 + Math.floor(rand() * 10);
    loot.food = 4 + Math.floor(rand() * 8);
    if (rand() < 0.35) loot.cloth = 3 + Math.floor(rand() * 4);
  } else if (kind === 'timber_debris') {
    loot.wood = 8 + Math.floor(rand() * 9);
    loot.rope = 2 + Math.floor(rand() * 3);
    if (rand() < 0.25) loot.tools = 1;
  } else if (kind === 'supply_bundle') {
    loot.food = 5 + Math.floor(rand() * 6);
    loot.water = 5 + Math.floor(rand() * 6);
    loot.gunpowder = 2 + Math.floor(rand() * 4);
    loot.leadShot = 6 + Math.floor(rand() * 8);
    gold = 8 + Math.floor(rand() * 18);
  } else if (kind === 'raft') {
    loot.water = 3 + Math.floor(rand() * 4);
    loot.medicine = 1;
    const s = createRandomCrewMember(`raft_surv_${id}`, rand);
    survivor = {
      id: `raft_surv_${id}`,
      name: s.name,
      skills: s.skills,
      disposition: rand() < 0.65 ? 'eager' : 'needs_food',
      demandAmount: 4,
      resolved: false,
      infoText: '“Thank heaven for a friendly sail! I can pull ropes or tend the bilge.”',
    };
  } else {
    gold = 45 + Math.floor(rand() * 110);
    loot.rareSpices = 1;
    loot.iron = 3 + Math.floor(rand() * 5);
    if (rand() < 0.35) loot.jewellery = 1;
  }

  return {
    id,
    kind,
    x,
    z,
    collected: false,
    gold,
    loot,
    survivor,
  };
}

function populateIslandWildlife(
  island: IslandData,
  rand: () => number,
  out: WildlifeActorData[]
): void {
  const pool = pickIslandWildlifePool(island.archetype);
  const count = island.archetype === 'tiny_islet' ? 2 : 3 + Math.floor(rand() * 3);
  for (let i = 0; i < count; i++) {
    const species = pool[Math.floor(rand() * pool.length)];
    const ang = rand() * Math.PI * 2;
    const dist = island.radius * (0.18 + rand() * 0.56);
    const wx = island.x + Math.cos(ang) * dist;
    const wz = island.z + Math.sin(ang) * dist;
    const wy = Math.max(0.4, sampleIslandTerrainHeight(island, wx, wz));
    out.push(createWildlifeActor(`wild_isl_${island.id}_${i}`, species, wx, wy, wz, rand, island.id));
  }
}

/**
 * Rings cold/frozen islands with mixed thin-to-medium breakable ice sheets
 * across the entire coastline (including pier approach) so vessels must crack through ice to land.
 */
export function populateColdIslandIceCollar(
  island: IslandData,
  rand: () => number,
  iceSheets: BreakableIceSheetData[]
): void {
  if (island.biome !== 'cold' && island.archetype !== 'frozen') return;
  const count = Math.max(8, Math.min(12, Math.round(island.radius * 0.11)));
  for (let i = 0; i < count; i++) {
    const ang = (i / count) * Math.PI * 2 + (rand() - 0.5) * 0.16;
    const ringDist = island.radius + 18 + rand() * 10;
    const sx = island.x + Math.cos(ang) * ringDist;
    const sz = island.z + Math.sin(ang) * ringDist;
    const thickness: 1 | 2 = (i + Math.floor(rand() * 2)) % 2 === 0 ? 1 : 2;
    const maxHp = thickness === 1 ? 35 : 75;
    iceSheets.push({
      id: `icesheet_collar_${island.id}_${i}`,
      x: sx,
      z: sz,
      radius: 17 + rand() * 6,
      thickness,
      hp: maxHp,
      maxHp,
      crackStage: 0,
      broken: false,
      rotation: rand() * Math.PI * 2,
    });
  }
}

function populateOceanWildlife(
  cx: number,
  cz: number,
  biome: OceanBiomeId,
  baseX: number,
  baseZ: number,
  islands: IslandData[],
  rocks: RockHazardData[],
  rand: () => number,
  out: WildlifeActorData[]
): void {
  if (biome === 'deep') return;

  const oceanPool: WildlifeSpecies[] =
    biome === 'cold'
      ? ['arctic_cod_shoal', 'arctic_cod_shoal', 'seal', 'whale_pod']
      : biome === 'tropical'
        ? ['fish_school', 'parrotfish', 'parrotfish', 'manta_ray', 'sea_turtle', 'dolphin', 'ocean_shark', 'swordfish']
        : ['fish_school', 'dolphin', 'whale_pod', 'swordfish', 'ocean_shark', 'sea_turtle'];

  const count =
    biome === 'tropical'
      ? 4 + Math.floor(rand() * 3) // 4-6 vibrant schools & creatures in tropical waters
      : biome === 'cold'
        ? 2 + (rand() < 0.55 ? 1 : 0) // 2-3 cold fish & cold sea creatures
        : 2 + (rand() < 0.45 ? 1 : 0); // 2-3 normal ocean creatures

  for (let i = 0; i < count; i++) {
    const wx = baseX + 65 + rand() * (CHUNK_SIZE - 130);
    const wz = baseZ + 65 + rand() * (CHUNK_SIZE - 130);
    if (Math.hypot(wx, wz) < 85) continue;
    if (islands.some((isl) => Math.hypot(isl.x - wx, isl.z - wz) < isl.radius + 22)) continue;
    const species = oceanPool[Math.floor(rand() * oceanPool.length)];
    out.push(createWildlifeActor(`wild_sea_${cx}_${cz}_${i}`, species, wx, 0.15, wz, rand));
  }

  // Spawn reef-dwelling fishable sea creatures right around coastal & open coral/rock reefs
  const reefPool: WildlifeSpecies[] =
    biome === 'cold'
      ? ['arctic_cod_shoal', 'seal']
      : biome === 'tropical'
        ? ['parrotfish', 'manta_ray', 'sea_turtle', 'fish_school']
        : ['fish_school', 'swordfish', 'sea_turtle'];
  let reefCreatureIdx = 0;
  for (const rk of rocks) {
    if (!rk.isReef) continue;
    const reefSpawnCount = biome === 'tropical' ? 2 : rand() < 0.72 ? 1 : 0;
    for (let j = 0; j < reefSpawnCount; j++) {
      const ang = rand() * Math.PI * 2;
      const offset = rk.radius + 9 + rand() * 8;
      const rx = rk.x + Math.cos(ang) * offset;
      const rz = rk.z + Math.sin(ang) * offset;
      if (islands.some((isl) => Math.hypot(isl.x - rx, isl.z - rz) < isl.radius + 5)) continue;
      const species = reefPool[Math.floor(rand() * reefPool.length)];
      out.push(createWildlifeActor(`wild_reef_${cx}_${cz}_${reefCreatureIdx++}`, species, rx, 0.15, rz, rand));
    }
  }
}

function populateOceanBirdFlocks(
  cx: number,
  cz: number,
  biome: OceanBiomeId,
  baseX: number,
  baseZ: number,
  rand: () => number,
  out: WildlifeActorData[]
): void {
  if (biome === 'deep') return;
  if (rand() > 0.62) return;
  const flockCenterX = baseX + 95 + rand() * (CHUNK_SIZE - 190);
  const flockCenterZ = baseZ + 95 + rand() * (CHUNK_SIZE - 190);
  const flockSize = 3 + Math.floor(rand() * 3); // 3-5 seabirds in V-formation
  const flockHeading = rand() * Math.PI * 2;
  const flockId = `flock_${cx}_${cz}`;
  const baseAltitude = 14.5 + rand() * 5.5;
  const rightX = Math.cos(flockHeading);
  const rightZ = -Math.sin(flockHeading);
  const backX = -Math.sin(flockHeading);
  const backZ = -Math.cos(flockHeading);

  for (let i = 0; i < flockSize; i++) {
    const rank = Math.ceil(i / 2);
    const side = i === 0 ? 0 : i % 2 === 1 ? -1 : 1;
    const bx = flockCenterX + rightX * side * rank * 3.4 + backX * rank * 2.8;
    const bz = flockCenterZ + rightZ * side * rank * 3.4 + backZ * rank * 2.8;
    const bird = createWildlifeActor(
      `wild_flock_${cx}_${cz}_${i}`,
      'ocean_flock_bird',
      bx,
      baseAltitude + (i % 2) * 0.65,
      bz,
      rand
    );
    bird.heading = flockHeading;
    bird.flockId = flockId;
    bird.flockOffsetIndex = i;
    bird.killable = false;
    out.push(bird);
  }
}

function populateIslandReefs(
  island: IslandData,
  rand: () => number,
  rocks: RockHazardData[]
): void {
  const reefCount = island.biome === 'tropical' ? 4 : 2;
  for (let i = 0; i < reefCount; i++) {
    const ang = (i / reefCount) * Math.PI * 2 + rand() * 0.8;
    // Leave dock approach corridor unobstructed!
    if (Math.hypot(island.x + Math.cos(ang) * island.reefRingRadius - island.dockX, island.z + Math.sin(ang) * island.reefRingRadius - island.dockZ) < 28) {
      continue;
    }
    const rDist = island.reefRingRadius * (0.94 + rand() * 0.24);
    const rx = island.x + Math.cos(ang) * rDist;
    const rz = island.z + Math.sin(ang) * rDist;
    const submerged = rand() < 0.65;
    rocks.push({
      id: `reef_${island.id}_${i}`,
      x: rx,
      z: rz,
      radius: 4.8 + rand() * 4.2,
      height: submerged ? 1.4 : 2.8 + rand() * 3.0,
      rotation: rand() * Math.PI * 2,
      variant: Math.floor(rand() * 3),
      submerged,
      isReef: true,
    });
  }
}

function populateColdIceFeatures(
  cx: number,
  cz: number,
  baseX: number,
  baseZ: number,
  islands: IslandData[],
  wrecks: ShipwreckData[],
  rand: () => number,
  icebergs: IcebergData[],
  iceChunks: IceChunkData[],
  iceSheets: BreakableIceSheetData[]
): void {
  // Huge drifting icebergs + pushable ice chunks
  const bergCount = rand() < 0.45 ? 2 : 1;
  for (let i = 0; i < bergCount; i++) {
    const bx = baseX + 80 + rand() * (CHUNK_SIZE - 160);
    const bz = baseZ + 80 + rand() * (CHUNK_SIZE - 160);
    if (islands.some((isl) => Math.hypot(isl.x - bx, isl.z - bz) < isl.radius + 55)) continue;
    if (wrecks.some((w) => Math.hypot(w.x - bx, w.z - bz) < 48)) continue;

    const isGiant = rand() < 0.48;
    const radius = isGiant ? 20 + rand() * 14 : 9 + rand() * 7;
    const height = isGiant ? 12 + rand() * 9 : 5 + rand() * 5;
    icebergs.push({
      id: `iceberg_${cx}_${cz}_${i}`,
      x: bx,
      z: bz,
      radius,
      height,
      rotation: rand() * Math.PI * 2,
      driftVx: (rand() - 0.5) * 0.42,
      driftVz: (rand() - 0.5) * 0.42,
      isGiant,
      pushable: !isGiant,
      mass: isGiant ? 999 : 25 + radius * 2,
      variant: Math.floor(rand() * 3),
    });

    // Smaller ice chunks broken off near the iceberg
    const chunkCount = 2 + Math.floor(rand() * 3);
    for (let k = 0; k < chunkCount; k++) {
      const cAng = rand() * Math.PI * 2;
      const cDist = radius + 8 + rand() * 18;
      iceChunks.push({
        id: `icechunk_${cx}_${cz}_${i}_${k}`,
        x: bx + Math.cos(cAng) * cDist,
        z: bz + Math.sin(cAng) * cDist,
        radius: 2.2 + rand() * 2.4,
        height: 1.0 + rand() * 1.1,
        vx: (rand() - 0.5) * 0.35,
        vz: (rand() - 0.5) * 0.35,
        rotation: rand() * Math.PI * 2,
      });
    }
  }

  // Breakable frozen ice sheets (thin=1, medium=2, thick=3)
  const sheetCount = 1 + (rand() < 0.7 ? 1 : 0);
  for (let s = 0; s < sheetCount; s++) {
    const sx = baseX + 75 + rand() * (CHUNK_SIZE - 150);
    const sz = baseZ + 75 + rand() * (CHUNK_SIZE - 150);
    if (islands.some((isl) => Math.hypot(isl.x - sx, isl.z - sz) < isl.radius + 40)) continue;
    if (icebergs.some((ib) => Math.hypot(ib.x - sx, ib.z - sz) < ib.radius + 24)) continue;
    const thicknessRoll = rand();
    const thickness: 1 | 2 | 3 = thicknessRoll < 0.45 ? 1 : thicknessRoll < 0.8 ? 2 : 3;
    const maxHp = thickness === 1 ? 35 : thickness === 2 ? 75 : 135;
    iceSheets.push({
      id: `icesheet_${cx}_${cz}_${s}`,
      x: sx,
      z: sz,
      radius: 15 + rand() * 13,
      thickness,
      hp: maxHp,
      maxHp,
      crackStage: 0,
      broken: false,
      rotation: rand() * Math.PI * 2,
    });
  }
}

export function generateWorldChunk(
  seed: number,
  cx: number,
  cz: number,
  lootedWreckIds: Set<string>,
  collectedCrateIds: Set<string>,
  defeatedPirateIds: Set<string>,
  defeatedMonsterIds: Set<string> = new Set(),
  factions: Record<PirateFactionId, PirateFactionState> = createInitialFactions(),
  searchedWreckSections: Record<string, string[]> = {},
  discoveredIslandIds: Set<string> = new Set(),
  collectedDiscoveryIds: Set<string> = new Set(),
  completedErrandIds: Set<string> = new Set()
): WorldChunkData {
  const key = chunkKey(cx, cz);
  const rand = mulberry32(hashCoords(seed, cx, cz));

  const baseX = cx * CHUNK_SIZE;
  const baseZ = cz * CHUNK_SIZE;
  const centerX = baseX + CHUNK_SIZE * 0.5;
  const centerZ = baseZ + CHUNK_SIZE * 0.5;
  const biome = getOceanBiome(centerX, centerZ, seed);

  const wrecks: ShipwreckData[] = [];
  const crates: FloatingCrateData[] = [];
  const merchants: MerchantShipData[] = [];
  const pirates: PirateShipData[] = [];
  const monsters: SeaMonsterData[] = [];
  const rocks: RockHazardData[] = [];
  const islands: IslandData[] = [];
  const icebergs: IcebergData[] = [];
  const iceChunks: IceChunkData[] = [];
  const iceSheets: BreakableIceSheetData[] = [];
  const wildlife: WildlifeActorData[] = [];

  if (cx === 0 && cz === 0) {
    const w1Id = 'wreck_starter_north';
    const w1 = generateShipwreck(w1Id, -56, -135, 'abandoned_sloop', rand);
    const savedSec1 = searchedWreckSections[w1Id] || [];
    if (savedSec1.length > 0) {
      w1.sections.forEach((s) => {
        if (savedSec1.includes(s.id)) s.searched = true;
      });
    }
    w1.fullyLooted = lootedWreckIds.has(w1Id) || w1.sections.every((s) => s.searched);
    if (w1.fullyLooted) w1.sections.forEach((s) => (s.searched = true));
    wrecks.push(w1);

    const c1Id = 'crate_starter_bow';
    if (!collectedCrateIds.has(c1Id)) {
      const c1 = createFloatingCrate(c1Id, 95, -175, rand);
      c1.kind = 'crate';
      c1.gold = 28;
      c1.loot = { wood: 10, food: 12, water: 12, rope: 6 };
      crates.push(c1);
    }

    const f1 = generateMerchantShip('merchant_starter_trawler', 140, -145, 'fishing_trawler', rand);
    merchants.push(f1);

    const m1 = generateMerchantShip('merchant_starter_0', 225, -245, 'medium_merchant', rand);
    m1.specialty = 'shipwright';
    merchants.push(m1);

    const cPatrol = generateMerchantShip('crown_starter_patrol', -175, -190, 'crown_patrol', rand);
    merchants.push(cPatrol);

    const p1Id = 'pirate_starter_nw';
    if (!defeatedPirateIds.has(p1Id)) {
      pirates.push(
        generatePirateShip(p1Id, -320, -340, 'sloop', rand, {
          factionId: 'crimson_corsairs',
          rank: 1,
        })
      );
    }

    // Guaranteed starter Tropical Island "Coral Haven" at (285, 130) — reachable quickly southeast!
    const starterIslandId = 'island_starter_coral_haven';
    const starterIsland = buildProceduralIsland(starterIslandId, 285, 130, seed, rand, {
      forceStarter: true,
      discovered: true,
      collectedDiscoveryIds,
      completedErrandIds,
    });
    islands.push(starterIsland);
    populateIslandReefs(starterIsland, rand, rocks);
    populateIslandWildlife(starterIsland, rand, wildlife);

    // Friendly pod of dolphins, reef fishable creatures, & wheeling ocean bird flock near starter Coral Haven
    wildlife.push(createWildlifeActor('wild_starter_dolphin_0', 'dolphin', 132, 0.15, 68, rand));
    wildlife.push(createWildlifeActor('wild_starter_turtle_0', 'sea_turtle', 158, 0.15, 108, rand));
    wildlife.push(createWildlifeActor('wild_starter_parrotfish_0', 'parrotfish', 176, 0.15, 152, rand));
    wildlife.push(createWildlifeActor('wild_starter_manta_0', 'manta_ray', 202, 0.15, 36, rand));
    for (let f = 0; f < 4; f++) {
      const rank = Math.ceil(f / 2);
      const side = f === 0 ? 0 : f % 2 === 1 ? -1 : 1;
      const flockBird = createWildlifeActor(
        `wild_starter_flock_${f}`,
        'ocean_flock_bird',
        125 + side * rank * 3.4,
        15.5 + (f % 2) * 0.6,
        -60 + rank * 2.8,
        rand
      );
      flockBird.flockId = 'flock_starter';
      flockBird.flockOffsetIndex = f;
      flockBird.killable = false;
      wildlife.push(flockBird);
    }

    return {
      key,
      cx,
      cz,
      biome,
      wrecks,
      crates,
      merchants,
      pirates,
      monsters,
      rocks,
      islands,
      icebergs,
      iceChunks,
      iceSheets,
      wildlife,
    };
  }

  const distFromOrigin = Math.hypot(centerX, centerZ);

  // Abyssal Deep Ocean ('deep'): strictly spawns ONLY sea monsters (no islands, wrecks, ships, reefs, ice, fish, or birds)
  if (biome === 'deep') {
    const monsterRoll = rand();
    const deepMonsterCount = monsterRoll < 0.38 ? 2 : 1;
    for (let m = 0; m < deepMonsterCount; m++) {
      const sx = baseX + 105 + rand() * (CHUNK_SIZE - 210);
      const sz = baseZ + 105 + rand() * (CHUNK_SIZE - 210);
      const mid = `monster_deep_${cx}_${cz}_${m}`;
      if (!defeatedMonsterIds.has(mid)) {
        monsters.push(generateSeaMonster(mid, sx, sz, rand, distFromOrigin >= 850, 'deep'));
      }
    }
    return {
      key,
      cx,
      cz,
      biome,
      wrecks,
      crates,
      merchants,
      pirates,
      monsters,
      rocks,
      islands,
      icebergs,
      iceChunks,
      iceSheets,
      wildlife,
    };
  }

  // Guaranteed northern icefield chunk at (0, -2) around (260, -780) so northern voyages & Admin warp find dense ice quickly!
  const isGuaranteedIceChunk = cx === 0 && cz === -2;

  // Procedural Islands (~34% per chunk outside origin spawn; guaranteed frozen island near northern ice warp)
  const islandChance = isGuaranteedIceChunk ? 1.0 : 0.34;
  if (rand() < islandChance) {
    const ix = isGuaranteedIceChunk ? 365 : baseX + 125 + rand() * (CHUNK_SIZE - 250);
    const iz = isGuaranteedIceChunk ? -835 : baseZ + 125 + rand() * (CHUNK_SIZE - 250);
    if (Math.hypot(ix, iz) >= 245) {
      const iid = `island_${cx}_${cz}`;
      const isl = buildProceduralIsland(iid, ix, iz, seed, rand, {
        discovered: discoveredIslandIds.has(iid),
        collectedDiscoveryIds,
        completedErrandIds,
      });
      islands.push(isl);
      populateIslandReefs(isl, rand, rocks);
      populateColdIslandIceCollar(isl, rand, iceSheets);
      populateIslandWildlife(isl, rand, wildlife);
    }
  }

  const isInsideAnyIsland = (wx: number, wz: number, pad = 32) =>
    islands.some((isl) => Math.hypot(isl.x - wx, isl.z - wz) < isl.radius + pad);

  const wreckRoll = rand();
  const wreckCount = wreckRoll < 0.08 ? 2 : wreckRoll < 0.44 ? 1 : 0;
  for (let i = 0; i < wreckCount; i++) {
    const wx = baseX + 65 + rand() * (CHUNK_SIZE - 130);
    const wz = baseZ + 65 + rand() * (CHUNK_SIZE - 130);
    if (Math.hypot(wx, wz) < 110 || isInsideAnyIsland(wx, wz, 22)) continue;
    const id = `wreck_${cx}_${cz}_${i}`;
    const archetype = pickWreckArchetype(distFromOrigin, rand);
    const w = generateShipwreck(id, wx, wz, archetype, rand);
    const savedSecs = searchedWreckSections[id] || [];
    if (savedSecs.length > 0) {
      w.sections.forEach((s) => {
        if (savedSecs.includes(s.id)) s.searched = true;
      });
    }
    if (lootedWreckIds.has(id) || w.sections.every((s) => s.searched)) {
      w.fullyLooted = true;
      w.sections.forEach((s) => (s.searched = true));
    }
    wrecks.push(w);
  }

  const crateRoll = rand();
  const crateCount = crateRoll < 0.14 ? 2 : crateRoll < 0.58 ? 1 : 0;
  for (let i = 0; i < crateCount; i++) {
    const fx = baseX + 55 + rand() * (CHUNK_SIZE - 110);
    const fz = baseZ + 55 + rand() * (CHUNK_SIZE - 110);
    if (Math.hypot(fx, fz) < 95 || isInsideAnyIsland(fx, fz, 18)) continue;
    const id = `crate_${cx}_${cz}_${i}`;
    if (collectedCrateIds.has(id)) continue;
    crates.push(createFloatingCrate(id, fx, fz, rand));
  }

  // Major NPC Naval Battle
  const isMajorBattleChunk = distFromOrigin >= 860 && islands.length === 0 && rand() < 0.07;
  if (isMajorBattleChunk) {
    const bx = baseX + CHUNK_SIZE * 0.5;
    const bz = baseZ + CHUNK_SIZE * 0.5;
    const battleId = `battle_${cx}_${cz}`;
    const factionId = getDominantFactionForPosition(bx, bz, factions, rand);

    const crownLeadClass: VesselClass =
      distFromOrigin > 1500 ? 'crown_flagship' : rand() < 0.5 ? 'crown_warship' : 'crown_frigate';
    const crown1 = generateMerchantShip(`battle_crown_${cx}_${cz}_0`, bx - 55, bz - 35, crownLeadClass, rand);
    crown1.battleId = battleId;
    crown1.heading = -Math.PI * 0.45;
    merchants.push(crown1);

    const crown2 = generateMerchantShip(`battle_crown_${cx}_${cz}_1`, bx - 88, bz + 28, 'crown_corvette', rand);
    crown2.battleId = battleId;
    crown2.heading = -Math.PI * 0.4;
    merchants.push(crown2);

    const pirLeadId = `battle_pir_${cx}_${cz}_lead`;
    if (!defeatedPirateIds.has(pirLeadId)) {
      const pLead = generatePirateShip(pirLeadId, bx + 55, bz - 20, distFromOrigin > 1400 ? 'dreadnought' : 'galleon', rand, {
        factionId,
        rank: 5,
        isFlagship: true,
        fleetId: battleId,
      });
      pLead.battleId = battleId;
      pLead.heading = Math.PI * 0.5;
      pirates.push(pLead);
    }
    for (let e = 0; e < 2; e++) {
      const peId = `battle_pir_${cx}_${cz}_esc_${e}`;
      if (!defeatedPirateIds.has(peId)) {
        const pEsc = generatePirateShip(
          peId,
          bx + 88,
          bz + (e === 0 ? -55 : 48),
          e === 0 ? 'brigantine' : 'sloop',
          rand,
          { factionId, rank: 3, fleetId: battleId, escortTargetId: pirLeadId }
        );
        pEsc.battleId = battleId;
        pEsc.heading = Math.PI * 0.5;
        pirates.push(pEsc);
      }
    }

    const armadaMonsterId = `armada_mon_${cx}_${cz}`;
    if (!defeatedMonsterIds.has(armadaMonsterId) && rand() < 0.22) {
      const allySidePirate = rand() < 0.5;
      const mon = generateSeaMonster(
        armadaMonsterId,
        bx + (allySidePirate ? 105 : -110),
        bz - 40,
        rand,
        distFromOrigin >= 1400
      );
      mon.alignment = allySidePirate ? 'evil' : 'good';
      if (allySidePirate) mon.escortFactionId = factionId;
      else mon.escortCrownConvoyId = battleId;
      monsters.push(mon);
    }
  } else {
    const isConvoyChunk = distFromOrigin >= 540 && islands.length === 0 && rand() < 0.14;
    if (isConvoyChunk) {
      const cx0 = baseX + 120 + rand() * (CHUNK_SIZE - 240);
      const cz0 = baseZ + 120 + rand() * (CHUNK_SIZE - 240);
      const convoyId = `convoy_${cx}_${cz}`;
      const convoyHeading = rand() * Math.PI * 2;
      const merchCount = rand() < 0.45 ? 3 : 2;
      const escortCount = rand() < 0.55 ? 2 : 1;

      for (let m = 0; m < merchCount; m++) {
        const cls: VesselClass =
          m === 0
            ? rand() < 0.4
              ? 'wealthy_trader'
              : 'large_cargo'
            : rand() < 0.5
              ? 'medium_merchant'
              : 'supply_ship';
        const offsetBack = m * 38;
        const mx = cx0 + Math.sin(convoyHeading) * offsetBack;
        const mz = cz0 + Math.cos(convoyHeading) * offsetBack;
        const merch = generateMerchantShip(`convoy_${cx}_${cz}_m_${m}`, mx, mz, cls, rand);
        merch.heading = convoyHeading;
        merch.convoyId = convoyId;
        merch.convoyRole = m === 0 ? 'lead' : 'merchant';
        merch.convoySlot = m;
        merch.maxSpeed = 6.4;
        merchants.push(merch);
      }

      for (let e = 0; e < escortCount; e++) {
        const side = e === 0 ? 1 : -1;
        const ex = cx0 + Math.cos(convoyHeading) * side * 34 + Math.sin(convoyHeading) * 18;
        const ez = cz0 - Math.sin(convoyHeading) * side * 34 + Math.cos(convoyHeading) * 18;
        const escCls: VesselClass =
          distFromOrigin > 1400
            ? e === 0
              ? 'crown_frigate'
              : 'crown_corvette'
            : distFromOrigin > 950
              ? 'crown_corvette'
              : 'crown_patrol';
        const esc = generateMerchantShip(`convoy_${cx}_${cz}_esc_${e}`, ex, ez, escCls, rand);
        esc.heading = convoyHeading;
        esc.convoyId = convoyId;
        esc.convoyRole = 'escort';
        esc.convoySlot = e;
        merchants.push(esc);
      }
    } else {
      const vesselChance = distFromOrigin < 700 ? 0.36 : 0.3;
      if (rand() < vesselChance) {
        const mx = baseX + 80 + rand() * (CHUNK_SIZE - 160);
        const mz = baseZ + 80 + rand() * (CHUNK_SIZE - 160);
        if (!isInsideAnyIsland(mx, mz, 36)) {
          const vesselClass = pickVesselClass(distFromOrigin, rand);
          merchants.push(generateMerchantShip(`merchant_${cx}_${cz}`, mx, mz, vesselClass, rand));
        }
      }
    }

    const pirateChance = distFromOrigin < 650 ? 0.25 : 0.36;
    if (rand() < pirateChance) {
      const px = baseX + 80 + rand() * (CHUNK_SIZE - 160);
      const pz = baseZ + 80 + rand() * (CHUNK_SIZE - 160);
      if (Math.hypot(px, pz) >= 210 && !isInsideAnyIsland(px, pz, 40)) {
        const factionId = getDominantFactionForPosition(px, pz, factions, rand);
        const isFleetChunk = distFromOrigin > 920 && rand() < 0.24;
        const isBossChunk = distFromOrigin > 1300 && rand() < 0.16;

        if (isFleetChunk) {
          const fleetId = `fleet_${cx}_${cz}`;
          const leadId = `pirate_${cx}_${cz}_lead`;
          const leadTier: PirateTier = isBossChunk ? 'dreadnought' : rand() < 0.55 ? 'galleon' : 'dreadnought';
          if (!defeatedPirateIds.has(leadId)) {
            pirates.push(
              generatePirateShip(leadId, px, pz, leadTier, rand, {
                factionId,
                rank: isBossChunk ? 6 : 5,
                isBoss: isBossChunk,
                isFlagship: true,
                fleetId,
              })
            );
          }
          const escortCount = rand() < 0.35 ? 3 : 2;
          for (let e = 0; e < escortCount; e++) {
            const eid = `pirate_${cx}_${cz}_esc_${e}`;
            if (!defeatedPirateIds.has(eid)) {
              const offsetAng = (e === 0 ? 1 : e === 1 ? -1 : 0) * 1.1;
              const ex = px + Math.cos(offsetAng) * (50 + e * 14);
              const ez = pz + Math.sin(offsetAng) * (50 + e * 14);
              pirates.push(
                generatePirateShip(eid, ex, ez, e === 0 ? 'brigantine' : 'sloop', rand, {
                  factionId,
                  rank: e === 0 ? 3 : 2,
                  fleetId,
                  escortTargetId: leadId,
                  shipClassLabel: e === 2 ? 'Pirate Supply Ship' : undefined,
                })
              );
            }
          }
          if (rand() < 0.12 && !defeatedMonsterIds.has(`pir_ally_mon_${cx}_${cz}`)) {
            const allyMon = generateSeaMonster(
              `pir_ally_mon_${cx}_${cz}`,
              px - 68,
              pz - 68,
              rand,
              distFromOrigin >= 1450
            );
            allyMon.alignment = 'evil';
            allyMon.escortFactionId = factionId;
            monsters.push(allyMon);
          }
        } else {
          const id = `pirate_${cx}_${cz}`;
          if (!defeatedPirateIds.has(id)) {
            const tier = pickPirateTier(distFromOrigin, rand);
            const rank =
              tier === 'sloop'
                ? 1
                : tier === 'brigantine'
                  ? rand() < 0.45
                    ? 3
                    : 2
                  : tier === 'galleon'
                    ? 4
                    : 5;
            pirates.push(
              generatePirateShip(id, px, pz, tier, rand, {
                factionId,
                rank,
                isBoss: isBossChunk && tier === 'dreadnought',
                isFlagship: tier === 'dreadnought',
              })
            );
          }
        }
      }
    }
  }

  // Ghost Ships
  if (distFromOrigin >= 760 && rand() < 0.042) {
    const gx = baseX + 120 + rand() * (CHUNK_SIZE - 240);
    const gz = baseZ + 120 + rand() * (CHUNK_SIZE - 240);
    const ghostId = `ghost_${cx}_${cz}`;
    if (!defeatedPirateIds.has(ghostId) && !isInsideAnyIsland(gx, gz, 38)) {
      pirates.push(generateGhostShip(ghostId, gx, gz, rand));
    }
  }

  // Sea monsters outside starter waters
  if (distFromOrigin >= 640 && rand() < 0.088) {
    const sx = baseX + 100 + rand() * (CHUNK_SIZE - 200);
    const sz = baseZ + 100 + rand() * (CHUNK_SIZE - 200);
    const mid = `monster_${cx}_${cz}`;
    if (!defeatedMonsterIds.has(mid) && !isInsideAnyIsland(sx, sz, 40)) {
      monsters.push(generateSeaMonster(mid, sx, sz, rand, distFromOrigin >= 1200, biome));
    }
  }

  // Solid sea rock & submerged reef hazard clusters outside immediate spawn
  if (distFromOrigin >= 240 && rand() < 0.52) {
    const rockCount = rand() < 0.42 ? 2 : 1;
    for (let rIdx = 0; rIdx < rockCount; rIdx++) {
      const rx = baseX + 70 + rand() * (CHUNK_SIZE - 140);
      const rz = baseZ + 70 + rand() * (CHUNK_SIZE - 140);
      if (Math.hypot(rx, rz) < 155 || isInsideAnyIsland(rx, rz, 26)) continue;
      const tooClose =
        wrecks.some((w) => Math.hypot(w.x - rx, w.z - rz) < 34) ||
        merchants.some((m) => Math.hypot(m.x - rx, m.z - rz) < 34) ||
        pirates.some((p) => Math.hypot(p.x - rx, p.z - rz) < 34) ||
        rocks.some((rk) => Math.hypot(rk.x - rx, rk.z - rz) < 38);
      if (tooClose) continue;
      const isReef = biome === 'tropical' ? rand() < 0.55 : rand() < 0.25;
      const submerged = isReef && rand() < 0.55;
      rocks.push({
        id: `rock_${cx}_${cz}_${rIdx}`,
        x: rx,
        z: rz,
        radius: 6.2 + rand() * 6.5,
        height: submerged ? 1.5 : 4.2 + rand() * 7.5,
        rotation: rand() * Math.PI * 2,
        variant: Math.floor(rand() * 3),
        submerged,
        isReef,
      });
    }
  }

  // Cold region icebergs, chunks, and breakable ice sheets
  if (biome === 'cold' || isGuaranteedIceChunk) {
    populateColdIceFeatures(cx, cz, baseX, baseZ, islands, wrecks, rand, icebergs, iceChunks, iceSheets);
  }

  // Living ocean wildlife (biome-tuned schools + reef sea creatures) & natural unkillable ocean bird flocks
  populateOceanWildlife(cx, cz, biome, baseX, baseZ, islands, rocks, rand, wildlife);
  populateOceanBirdFlocks(cx, cz, biome, baseX, baseZ, rand, wildlife);

  return {
    key,
    cx,
    cz,
    biome,
    wrecks,
    crates,
    merchants,
    pirates,
    monsters,
    rocks,
    islands,
    icebergs,
    iceChunks,
    iceSheets,
    wildlife,
  };
}
