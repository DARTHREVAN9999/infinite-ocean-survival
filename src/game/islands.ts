import { createRandomCrewMember } from './survival';
import { createEmptyInventory } from './economy';
import {
  IslandArchetype,
  IslandBeachedWreckData,
  IslandData,
  IslandDiscoveryData,
  IslandDiscoveryKind,
  IslandPirateGuardData,
  IslandPirateGuardRole,
  IslandSettlementData,
  IslandSettlementKind,
  OceanBiomeId,
  ResourceId,
  SettlementErrand,
  SettlementFactionId,
} from './types';
import { getOceanBiome } from './biomes';
import { createIslandPirateGuard, TRIBE_NAMES } from './fpsCombat';

const ISLAND_PREFIXES = [
  'Port',
  'Cape',
  'Isle of',
  'Coral',
  'Blackstone',
  'Driftwood',
  'Storm',
  'Emerald',
  'Frost',
  'Gilded',
  'Whispering',
  'Cursed',
  'Harbor',
  'Siren',
];

const ISLAND_SUFFIXES = [
  'Haven',
  'Key',
  'Crag',
  'Atoll',
  'Reach',
  'Point',
  'Bay',
  'Cove',
  'Spire',
  'Shallows',
  'Anchorage',
  'Hollow',
];

const SETTLEMENT_NAMES: Record<IslandSettlementKind, string[]> = {
  fishing_village: ['Saltwater Landing', 'Pelican Wharf', 'Netmaker Cove', 'Herring Quay'],
  trading_post: ['Eastwind Exchange', 'Copperlantern Pier', 'Barterers Haven', 'Gilded Wharf'],
  frontier_settlement: ['Timberfall Outpost', 'New Anchorage', 'Pinehurst Landing', 'Oakridge Haven'],
  coastal_fort: ['Fort Sovereign', 'Bastion Point', 'Ironwatch Keep', 'Redoubt Quay'],
  abandoned_outpost: ['Rusted Berth', 'Sunken Bell Landing', 'Ashwood Quay', 'Ghostlight Pier'],
};

const ERRAND_TEMPLATES: Array<{
  title: string;
  description: string;
  resourceId: ResourceId;
  qty: number;
  gold: number;
  rep: number;
}> = [
  {
    title: 'Timber for the Pier',
    description: 'Deliver seasoned wood planks to brace the storm-damaged jetty.',
    resourceId: 'wood',
    qty: 12,
    gold: 75,
    rep: 6,
  },
  {
    title: 'Provisions for the Garrison',
    description: 'Bring preserved food rations to feed the coastal watch.',
    resourceId: 'food',
    qty: 16,
    gold: 88,
    rep: 7,
  },
  {
    title: 'Fresh Water Casks',
    description: 'Deliver clean drinking water barrels before the dry tide.',
    resourceId: 'water',
    qty: 14,
    gold: 72,
    rep: 6,
  },
  {
    title: 'Powder & Shot Supply',
    description: 'Supply coastal watchmen with dry gunpowder.',
    resourceId: 'gunpowder',
    qty: 8,
    gold: 105,
    rep: 8,
  },
  {
    title: 'Smoked Catch Delivery',
    description: 'Deliver fresh fish catch to the island smokehouses.',
    resourceId: 'fishCatch',
    qty: 8,
    gold: 85,
    rep: 5,
  },
  {
    title: 'Hunter Hides',
    description: 'Bring cured animal hides to the settlement sail-and-leatherwright.',
    resourceId: 'animalHides',
    qty: 4,
    gold: 96,
    rep: 5,
  },
];

function hash2D(seed: number, ix: number, iz: number): number {
  let h = seed ^ (ix * 374761393) ^ (iz * 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function smoothValueNoise(x: number, z: number, seed: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);

  const a = hash2D(seed, ix, iz);
  const b = hash2D(seed, ix + 1, iz);
  const c = hash2D(seed, ix, iz + 1);
  const d = hash2D(seed, ix + 1, iz + 1);

  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}

export function getIslandCoastRadius(island: IslandData, worldX: number, worldZ: number): number {
  const dx = worldX - island.x;
  const dz = worldZ - island.z;
  const angle = Math.atan2(dz, dx);
  const coastWarp =
    Math.sin(angle * 3 + island.seed * 0.11) * 0.045 +
    Math.cos(angle * 5 - island.seed * 0.23) * 0.025;
  return island.radius * (1 + coastWarp);
}

/**
 * Exact angle-matched solid coastline collision so ships cannot clip inside island beaches or cliffs.
 * Preserves a narrow navigable docking channel directly in front of the landing pier.
 */
export function resolveShipIslandCoastCollision(
  island: IslandData,
  shipX: number,
  shipZ: number,
  shipRadius: number
): { collided: boolean; nextX: number; nextZ: number; nx: number; nz: number } {
  const dx = shipX - island.x;
  const dz = shipZ - island.z;
  const dist = Math.hypot(dx, dz);
  const effectiveR = getIslandCoastRadius(island, shipX, shipZ);
  const dDock = Math.hypot(shipX - island.dockX, shipZ - island.dockZ);
  const minClear = dDock < 14 ? effectiveR * 0.94 + shipRadius * 0.5 : effectiveR * 0.99 + shipRadius;

  if (dist >= minClear) {
    return { collided: false, nextX: shipX, nextZ: shipZ, nx: 0, nz: 0 };
  }
  const safeDist = Math.max(0.01, dist);
  const nx = dx / safeDist;
  const nz = dz / safeDist;
  return {
    collided: true,
    nextX: island.x + nx * minClear,
    nextZ: island.z + nz * minClear,
    nx,
    nz,
  };
}

/**
 * Computes exact island elevation in world units at (worldX, worldZ).
 * Negative values are underwater seabed/shoals; >= 0 is dry ground / gentle plateau.
 * Shared identically by the 3D island heightfield mesh and the FPS walking/collision controller.
 */
export function sampleIslandTerrainHeight(island: IslandData, worldX: number, worldZ: number): number {
  const dx = worldX - island.x;
  const dz = worldZ - island.z;
  const dist = Math.hypot(dx, dz);
  const maxExt = island.radius * 1.25;
  if (dist >= maxExt) return -3.2;

  const effectiveR = getIslandCoastRadius(island, worldX, worldZ);
  const norm = dist / effectiveR;

  if (norm >= 1.15) return -3.0;

  const n1 = smoothValueNoise(dx * 0.036 + 40, dz * 0.036 + 40, island.seed);
  const n2 = smoothValueNoise(dx * 0.078 + 90, dz * 0.078 + 90, island.seed + 17);

  let h: number;
  if (norm > 0.95) {
    // Gentle sandy shelf dropping into clear shoals
    const shelfT = (norm - 0.95) / 0.2;
    const smoothShelf = shelfT * shelfT * (3 - 2 * shelfT);
    h = 0.28 - smoothShelf * 3.25;
  } else {
    const rimT = Math.max(0, Math.min(1, (0.95 - norm) / 0.48));
    const smoothShore = rimT * rimT * (3 - 2 * rimT);
    const dome = Math.pow(Math.max(0, 1 - norm * norm), 0.56);
    const cliffBoost =
      island.archetype === 'rocky' || island.archetype === 'frozen'
        ? 1.16
        : island.archetype === 'tiny_islet'
          ? 0.65
          : 1.0;
    const rollingHills = (n1 * 0.72 + n2 * 0.28 - 0.25) * island.maxHeight * 0.36;
    h = 0.32 + smoothShore * dome * island.maxHeight * 0.68 * cliffBoost + dome * rollingHills;
  }

  // Carve freshwater river valley from highland spring toward the coast
  if (island.hasRiver && norm < 0.98) {
    const dirX = Math.cos(island.riverAngle);
    const dirZ = Math.sin(island.riverAngle);
    const along = dx * dirX + dz * dirZ;
    const perp = Math.abs(-dx * dirZ + dz * dirX + Math.sin(along * 0.09 + island.seed) * 4.5);
    const springStart = island.radius * 0.16;
    if (along > springStart && perp < 4.6) {
      const springFade = Math.min(1, (along - springStart) / (island.radius * 0.14));
      const riverFactor = (1 - perp / 4.6) * springFade;
      h = Math.min(h, Math.max(-0.25, h * (1 - riverFactor * 0.85) - riverFactor * 1.1));
    }
  }

  // Flatten coastal settlement plaza gently
  if (island.settlement) {
    const sDist = Math.hypot(worldX - island.settlement.worldX, worldZ - island.settlement.worldZ);
    if (sDist < 18) {
      const flatBlend = 1 - Math.min(1, sDist / 18);
      const targetPlazaH = 1.65;
      h = h * (1 - flatBlend * 0.85) + targetPlazaH * (flatBlend * 0.85);
    }
  }

  // Cave mouth grotto indentation near cave entrance
  if (island.hasCave) {
    const cDist = Math.hypot(worldX - island.caveEntranceX, worldZ - island.caveEntranceZ);
    if (cDist < island.caveRadius) {
      const caveFloor = 0.85;
      const t = 1 - cDist / island.caveRadius;
      h = h * (1 - t * 0.7) + caveFloor * (t * 0.7);
    }
  }

  return h;
}

export function isPointInRiver(island: IslandData, worldX: number, worldZ: number): boolean {
  if (!island.hasRiver) return false;
  const dx = worldX - island.x;
  const dz = worldZ - island.z;
  const dirX = Math.cos(island.riverAngle);
  const dirZ = Math.sin(island.riverAngle);
  const along = dx * dirX + dz * dirZ;
  const perp = Math.abs(-dx * dirZ + dz * dirX + Math.sin(along * 0.09 + island.seed) * 4.5);
  return along > island.radius * 0.18 && along < island.radius * 0.98 && perp < 2.8;
}

export function isPointInCave(island: IslandData, worldX: number, worldZ: number): boolean {
  if (!island.hasCave) return false;
  return Math.hypot(worldX - island.caveEntranceX, worldZ - island.caveEntranceZ) <= island.caveRadius * 0.78;
}

function pickArchetype(biome: OceanBiomeId, rand: () => number): IslandArchetype {
  if (biome === 'cold') {
    const r = rand();
    if (r < 0.56) return 'frozen';
    if (r < 0.78) return 'rocky';
    if (r < 0.9) return 'tiny_islet';
    return 'deserted';
  }
  if (biome === 'tropical') {
    const r = rand();
    if (r < 0.45) return 'tropical';
    if (r < 0.65) return 'large_island';
    if (r < 0.82) return 'forest';
    if (r < 0.92) return 'mysterious';
    return 'tiny_islet';
  }
  const r = rand();
  if (r < 0.28) return 'forest';
  if (r < 0.48) return 'rocky';
  if (r < 0.64) return 'large_island';
  if (r < 0.78) return 'deserted';
  if (r < 0.9) return 'mysterious';
  return 'tiny_islet';
}

function buildSettlementStock(kind: IslandSettlementKind, rand: () => number) {
  const stock = createEmptyInventory();
  stock.food = 18 + Math.floor(rand() * 20);
  stock.water = 18 + Math.floor(rand() * 20);
  stock.salt = 8 + Math.floor(rand() * 10);
  stock.wood = 16 + Math.floor(rand() * 20);
  stock.rope = 10 + Math.floor(rand() * 14);
  stock.cloth = 10 + Math.floor(rand() * 14);
  stock.tools = 4 + Math.floor(rand() * 6);
  stock.gunpowder = 8 + Math.floor(rand() * 12);
  stock.leadShot = 18 + Math.floor(rand() * 20);
  stock.cannonballs = 10 + Math.floor(rand() * 14);
  stock.fishCatch = 10 + Math.floor(rand() * 12);

  if (kind === 'fishing_village') {
    stock.fishCatch += 18;
    stock.rareFish = 2 + Math.floor(rand() * 4);
    stock.food += 14;
    stock.salt += 14;
  } else if (kind === 'trading_post') {
    stock.iron = 14 + Math.floor(rand() * 12);
    stock.silk = 2 + Math.floor(rand() * 3);
    stock.rareSpices = 2 + Math.floor(rand() * 3);
    stock.medicine = 4 + Math.floor(rand() * 5);
    stock.cargo = 4 + Math.floor(rand() * 5);
    stock.salt += 10;
  } else if (kind === 'coastal_fort') {
    stock.cannonballs += 22;
    stock.gunpowder += 16;
    stock.leadShot += 24;
    stock.reinforcedMetals = 2 + Math.floor(rand() * 3);
    stock.medicine = 5 + Math.floor(rand() * 4);
  } else if (kind === 'frontier_settlement') {
    stock.wood += 22;
    stock.advancedTimber = 2 + Math.floor(rand() * 4);
    stock.animalHides = 4 + Math.floor(rand() * 5);
  } else {
    // abandoned_outpost: sparse forgotten cache
    stock.food = 4;
    stock.water = 5;
    stock.wood = 10;
    stock.gunpowder = 3;
    stock.leadShot = 8;
  }
  return stock;
}

function createIslandDiscovery(
  id: string,
  kind: IslandDiscoveryKind,
  island: IslandData,
  localX: number,
  localZ: number,
  insideCave: boolean,
  rand: () => number
): IslandDiscoveryData {
  const worldX = island.x + localX;
  const worldZ = island.z + localZ;
  const loot = createEmptyInventory();
  let gold = 0;
  let name = 'Supply Cache';
  let description = 'Weathered maritime stores tucked inland.';
  let requiresDig = false;
  let grantsMapFragment = false;
  let grantsTreasureMap = false;

  if (kind === 'pirate_chest') {
    name = 'Corsair Plunder Chest';
    description = 'An iron-strapped sea chest guarded ashore by armed pirates.';
    requiresDig = false;
    gold = 115 + Math.floor(rand() * 120);
    loot.jewellery = 1;
    loot.rareSpices = 1 + Math.floor(rand() * 2);
    loot.gunpowder = 4 + Math.floor(rand() * 4);
    loot.leadShot = 8 + Math.floor(rand() * 8);
    loot.cloth = 4 + Math.floor(rand() * 5);
    grantsMapFragment = rand() < 0.75;
    grantsTreasureMap = rand() < 0.25;
  } else if (kind === 'buried_chest') {
    name = 'Disturbed Earth Mound';
    description = 'Crossed driftwood sticks mark a freshly turned burial mound.';
    requiresDig = true;
    gold = 55 + Math.floor(rand() * 75);
    loot.jewellery = rand() < 0.45 ? 1 : 0;
    loot.cargo = 1 + Math.floor(rand() * 2);
    grantsMapFragment = rand() < 0.45;
  } else if (kind === 'abandoned_camp') {
    name = 'Abandoned Castaway Camp';
    description = 'Cold embers, torn canvas, and stacked ration tins.';
    gold = 18 + Math.floor(rand() * 24);
    loot.food = 10 + Math.floor(rand() * 12);
    loot.water = 10 + Math.floor(rand() * 12);
    loot.gunpowder = 3 + Math.floor(rand() * 4);
    loot.leadShot = 8 + Math.floor(rand() * 10);
  } else if (kind === 'old_hut') {
    name = 'Hermit Driftwood Hut';
    description = 'A crooked timber shelter packed with dried fish and salvage.';
    gold = 22 + Math.floor(rand() * 35);
    loot.wood = 8 + Math.floor(rand() * 8);
    loot.tools = 2 + Math.floor(rand() * 3);
    loot.medicine = 2 + Math.floor(rand() * 2);
    grantsMapFragment = rand() < 0.55;
  } else if (kind === 'ancient_ruin') {
    name = 'Moss-Grown Stone Altar';
    description = 'Carved coastal stonework from an older sea-going kingdom.';
    gold = 65 + Math.floor(rand() * 85);
    loot.antiques = 1;
    loot.decorativeMaterials = 1 + Math.floor(rand() * 2);
    grantsTreasureMap = rand() < 0.3;
    grantsMapFragment = !grantsTreasureMap && rand() < 0.7;
  } else if (kind === 'cave_stash') {
    name = 'Smuggler Cave Stash';
    description = 'Wax-sealed casks hidden deep beneath the sea grotto arch.';
    gold = 70 + Math.floor(rand() * 95);
    loot.gunpowder = 6 + Math.floor(rand() * 6);
    loot.leadShot = 14 + Math.floor(rand() * 14);
    loot.rareSpices = 1 + Math.floor(rand() * 2);
    grantsMapFragment = true;
  } else if (kind === 'map_fragment_bottle') {
    name = 'Wax-Sealed Drift Bottle';
    description = 'A barnacle-crusted green glass bottle wedged in the tide line.';
    gold = 12;
    grantsMapFragment = true;
  } else if (kind === 'rare_curio') {
    name = 'Gilded Brass Astrolabe Case';
    description = 'An ornate navigator chest left high above the surf.';
    gold = 45 + Math.floor(rand() * 55);
    loot.rareMaterials = 1 + Math.floor(rand() * 2);
  } else {
    name = 'Washed-Up Crate';
    description = 'Bound oak crate holding shipwright stock.';
    gold = 15 + Math.floor(rand() * 20);
    loot.wood = 6 + Math.floor(rand() * 6);
    loot.rope = 4 + Math.floor(rand() * 5);
    loot.cloth = 4 + Math.floor(rand() * 5);
  }

  return {
    id,
    kind,
    name,
    description,
    localX,
    localZ,
    worldX,
    worldZ,
    insideCave,
    requiresDig,
    collected: false,
    gold,
    loot,
    grantsMapFragment,
    grantsTreasureMap,
  };
}

export function buildProceduralIsland(
  id: string,
  x: number,
  z: number,
  seed: number,
  rand: () => number,
  opts: {
    forceStarter?: boolean;
    discovered?: boolean;
    collectedDiscoveryIds?: Set<string>;
    completedErrandIds?: Set<string>;
  } = {}
): IslandData {
  const biome = opts.forceStarter ? 'tropical' : getOceanBiome(x, z, seed);
  const archetype: IslandArchetype = opts.forceStarter ? 'tropical' : pickArchetype(biome, rand);

  const radius = opts.forceStarter
    ? 94
    : archetype === 'tiny_islet'
      ? 38 + rand() * 16
      : archetype === 'large_island'
        ? 104 + rand() * 28
        : 68 + rand() * 28;

  const maxHeight = opts.forceStarter
    ? 7.2
    : archetype === 'tiny_islet'
      ? 2.8 + rand() * 1.7
      : archetype === 'rocky' || archetype === 'frozen'
        ? 6.2 + rand() * 3.3
        : 5.2 + rand() * 3.0;

  const hasRiver = opts.forceStarter || (archetype !== 'tiny_islet' && archetype !== 'frozen' && rand() < 0.52);
  const riverAngle = opts.forceStarter ? 0.45 : rand() * Math.PI * 2;

  const hasCave = opts.forceStarter || (archetype !== 'tiny_islet' && rand() < 0.62);
  const caveAngle = opts.forceStarter ? -2.25 : riverAngle + Math.PI * 0.75 + (rand() - 0.5) * 0.6;
  const caveDist = radius * 0.54;
  const caveEntranceX = x + Math.cos(caveAngle) * caveDist;
  const caveEntranceZ = z + Math.sin(caveAngle) * caveDist;
  const caveRadius = Math.min(12, radius * 0.22);

  const hasRuins = archetype === 'mysterious' || (archetype !== 'tiny_islet' && rand() < 0.38);
  const forestDensity =
    archetype === 'forest' || archetype === 'tropical' || archetype === 'large_island'
      ? 0.85
      : archetype === 'frozen' || archetype === 'rocky'
        ? 0.22
        : 0.42;

  const dockAngle = opts.forceStarter ? Math.PI : rand() * Math.PI * 2;
  const dockX = x + Math.cos(dockAngle) * (radius + 6);
  const dockZ = z + Math.sin(dockAngle) * (radius + 6);

  const prefix = ISLAND_PREFIXES[Math.floor(rand() * ISLAND_PREFIXES.length)];
  const suffix = ISLAND_SUFFIXES[Math.floor(rand() * ISLAND_SUFFIXES.length)];
  const name = opts.forceStarter ? 'Coral Haven' : `${prefix} ${suffix}`;

  const island: IslandData = {
    id,
    name,
    archetype,
    biome,
    x,
    z,
    radius,
    maxHeight,
    seed: Math.floor(rand() * 999999) + 17,
    hasRiver,
    riverAngle,
    hasCave,
    caveEntranceX,
    caveEntranceZ,
    caveRadius,
    hasRuins,
    forestDensity,
    reefRingRadius: radius + (biome === 'tropical' ? 32 : 18),
    dockX,
    dockZ,
    discovered: Boolean(opts.discovered || opts.forceStarter),
    discoveries: [],
    beachedWrecks: [],
    settlement: null,
    pirateGuards: [],
  };

  // Optional coastal settlement on medium/large islands (guaranteed on starter Coral Haven)
  const hasSettlement =
    opts.forceStarter || (archetype !== 'tiny_islet' && archetype !== 'deserted' && rand() < 0.42);
  if (hasSettlement) {
    const kindPool: IslandSettlementKind[] = opts.forceStarter
      ? ['fishing_village']
      : archetype === 'frozen'
        ? ['frontier_settlement', 'abandoned_outpost']
        : ['fishing_village', 'trading_post', 'frontier_settlement', 'coastal_fort', 'abandoned_outpost'];
    const sKind = kindPool[Math.floor(rand() * kindPool.length)];
    const faction: SettlementFactionId =
      sKind === 'coastal_fort'
        ? 'crown'
        : sKind === 'abandoned_outpost'
          ? 'abandoned'
          : rand() < 0.25
            ? 'pirate_haven'
            : 'independent';
    const names = SETTLEMENT_NAMES[sKind];
    const sName = opts.forceStarter ? 'Coral Haven Village' : names[Math.floor(rand() * names.length)];
    const sDist = radius * 0.66;
    const swx = x + Math.cos(dockAngle) * sDist;
    const swz = z + Math.sin(dockAngle) * sDist;

    const hireableCrew =
      sKind === 'abandoned_outpost'
        ? []
        : Array.from({ length: 2 + Math.floor(rand() * 2) }, (_, idx) =>
            createRandomCrewMember(`settle_crew_${id}_${idx}`, rand)
          );

    const errandTmpl = ERRAND_TEMPLATES[Math.floor(rand() * ERRAND_TEMPLATES.length)];
    const errandId = `errand_${id}`;
    const errand: SettlementErrand | null =
      sKind === 'abandoned_outpost'
        ? null
        : {
            id: errandId,
            title: errandTmpl.title,
            description: errandTmpl.description,
            resourceId: errandTmpl.resourceId,
            requiredQty: errandTmpl.qty,
            rewardGold: errandTmpl.gold,
            rewardReputation: errandTmpl.rep,
            completed: Boolean(opts.completedErrandIds?.has(errandId)),
          };

    island.settlement = {
      id: `settlement_${id}`,
      islandId: id,
      name: sName,
      kind: sKind,
      faction,
      worldX: swx,
      worldZ: swz,
      dockX,
      dockZ,
      rotation: dockAngle,
      gold: sKind === 'abandoned_outpost' ? 40 : 280 + Math.floor(rand() * 320),
      stock: buildSettlementStock(sKind, rand),
      hireableCrew,
      errand,
      rumorCost: 18 + Math.floor(rand() * 14),
      rumorHeard: false,
      rumorText:
        '“Sailors spoke of drifted chests and charting reefs two leagues beyond the shoals.”',
      discovered: Boolean(opts.discovered),
    };
  }

  // Interior discoveries (2..5 landmarks)
  const discCount = opts.forceStarter ? 4 : archetype === 'tiny_islet' ? 1 : 2 + Math.floor(rand() * 3);
  const kindsPool: IslandDiscoveryKind[] = [
    'buried_chest',
    'abandoned_camp',
    'old_hut',
    'supply_crate',
    'map_fragment_bottle',
    'rare_curio',
  ];
  if (hasRuins) kindsPool.push('ancient_ruin');

  for (let i = 0; i < discCount; i++) {
    const dId = `disc_${id}_${i}`;
    let kind = kindsPool[Math.floor(rand() * kindsPool.length)];
    let insideCave = false;
    let lx: number;
    let lz: number;

    if (i === 0 && opts.forceStarter) {
      kind = 'abandoned_camp';
      lx = -14;
      lz = 12;
    } else if (hasCave && i === discCount - 1) {
      kind = 'cave_stash';
      insideCave = true;
      lx = caveEntranceX - x;
      lz = caveEntranceZ - z;
    } else {
      const ang = (i / discCount) * Math.PI * 2 + rand() * 0.9;
      const distRatio = kind === 'map_fragment_bottle' ? 0.88 : 0.25 + rand() * 0.55;
      lx = Math.cos(ang) * radius * distRatio;
      lz = Math.sin(ang) * radius * distRatio;
    }

    const disc = createIslandDiscovery(dId, kind, island, lx, lz, insideCave, rand);
    if (opts.collectedDiscoveryIds?.has(dId)) {
      disc.collected = true;
    }
    island.discoveries.push(disc);
  }

  // Beached wreck on shore (~45% chance or starter guaranteed)
  if (opts.forceStarter || (archetype !== 'tiny_islet' && rand() < 0.45)) {
    const bwAngle = opts.forceStarter ? -0.9 : dockAngle + Math.PI * 0.62 + (rand() - 0.5) * 0.5;
    const bwDist = radius * 0.94;
    const bwId = `beached_${id}_0`;
    const bwLoot = createEmptyInventory();
    bwLoot.wood = 10 + Math.floor(rand() * 8);
    bwLoot.iron = 4 + Math.floor(rand() * 5);
    bwLoot.rope = 5 + Math.floor(rand() * 5);
    bwLoot.gunpowder = 4 + Math.floor(rand() * 4);
    bwLoot.leadShot = 8 + Math.floor(rand() * 10);

    const bw: IslandBeachedWreckData = {
      id: bwId,
      name: opts.forceStarter ? 'Beached Brigantine “Wave-Tossed”' : 'Beached Hull Wreck',
      localX: Math.cos(bwAngle) * bwDist,
      localZ: Math.sin(bwAngle) * bwDist,
      worldX: x + Math.cos(bwAngle) * bwDist,
      worldZ: z + Math.sin(bwAngle) * bwDist,
      rotation: bwAngle + Math.PI * 0.4,
      scale: 0.95 + rand() * 0.28,
      searched: Boolean(opts.collectedDiscoveryIds?.has(bwId)),
      gold: 36 + Math.floor(rand() * 48),
      loot: bwLoot,
      grantsMapFragment: opts.forceStarter || rand() < 0.55,
    };
    island.beachedWrecks.push(bw);
  }

  // Pirate-guarded Treasure Chest & mixed Cutlass/Flintlock Corsair guards
  const hasPirateCamp = opts.forceStarter || (archetype !== 'tiny_islet' && rand() < 0.58);
  if (hasPirateCamp) {
    const chestId = `disc_${id}_pirate_chest`;
    const chestAngle = opts.forceStarter ? -0.45 : dockAngle + Math.PI * 0.85 + (rand() - 0.5) * 0.8;
    const chestDist = opts.forceStarter ? radius * 0.36 : radius * (0.28 + rand() * 0.26);
    const clx = Math.cos(chestAngle) * chestDist;
    const clz = Math.sin(chestAngle) * chestDist;
    const chestDisc = createIslandDiscovery(chestId, 'pirate_chest', island, clx, clz, false, rand);
    // Sometimes a local indigenous tribe holds the island instead of pirates. Uses a seed hash (not rand())
    // so it never shifts the rest of the deterministic world generation. Same result for every player.
    const tribeRoll = Math.abs(Math.sin(island.seed * 12.9898 + 78.233) * 43758.5453) % 1;
    const tribal = !opts.forceStarter && tribeRoll < 0.42;
    if (tribal) {
      island.controller = 'tribe';
      island.tribeName = TRIBE_NAMES[Math.floor(((Math.abs(Math.sin(island.seed * 3.1337) * 9973)) % 1) * TRIBE_NAMES.length)];
      chestDisc.name = `${island.tribeName} Sacred Cache`;
    } else {
      island.controller = 'pirates';
    }
    if (opts.collectedDiscoveryIds?.has(chestId)) {
      chestDisc.collected = true;
    }

    const guards: IslandPirateGuardData[] = [];
    if (!chestDisc.collected) {
      const guardCount = opts.forceStarter ? 2 : rand() < 0.45 ? 3 : 2;
      const guardIds: string[] = [];
      for (let g = 0; g < guardCount; g++) {
        const gid = `pir_guard_${id}_${g}`;
        const gAng = (g / guardCount) * Math.PI * 2 + 0.55;
        const gx = chestDisc.worldX + Math.cos(gAng) * 4.5;
        const gz = chestDisc.worldZ + Math.sin(gAng) * 4.5;
        const gy = Math.max(0.4, sampleIslandTerrainHeight(island, gx, gz));
        const role: IslandPirateGuardRole = g % 2 === 0 ? 'cutlass' : 'pistol';
        guards.push(createIslandPirateGuard(gid, id, chestId, role, gx, gy, gz, rand, tribal));
        guardIds.push(gid);
      }
      chestDisc.guardedByPirateIds = guardIds;
    }

    island.discoveries.push(chestDisc);
    island.pirateGuards = guards;
  }

  return island;
}
