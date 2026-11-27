import {
  FishingCatchSpec,
  FishingGearId,
  Inventory,
  OceanBiomeId,
  SaveData,
  SeaMonsterData,
  WildlifeActorData,
} from './types';

export interface FishingGearSpec {
  id: FishingGearId;
  name: string;
  cost: number;
  minHullTier: number;
  catchIntervalSec: number;
  haulBonus: number;
  rareChanceBonus: number;
  description: string;
}

export const FISHING_GEAR_SPECS: Record<FishingGearId, FishingGearSpec> = {
  none: {
    id: 'none',
    name: 'No Ship Fishing Gear',
    cost: 0,
    minHullTier: 1,
    catchIntervalSec: 36,
    haulBonus: 0,
    rareChanceBonus: 0,
    description: 'Manual hand-line only until ship fishing gear is mounted.',
  },
  basic_lines: {
    id: 'basic_lines',
    name: 'Stern Handlines',
    cost: 45,
    minHullTier: 1,
    catchIntervalSec: 22,
    haulBonus: 1,
    rareChanceBonus: 0.04,
    description: 'Weighted hemp lines rigged over the stern rail for steady catches.',
  },
  hand_rods: {
    id: 'hand_rods',
    name: 'Quarterdeck Cane Rods',
    cost: 95,
    minHullTier: 1,
    catchIntervalSec: 17,
    haulBonus: 1.35,
    rareChanceBonus: 0.08,
    description: 'Bracketed oak-and-ash poles fitted along both gunwales.',
  },
  small_net: {
    id: 'small_net',
    name: 'Weighted Cast Net',
    cost: 165,
    minHullTier: 2,
    catchIntervalSec: 13.5,
    haulBonus: 1.85,
    rareChanceBonus: 0.12,
    description: 'A wide tarred-hemp dip net hauled over the side davit.',
  },
  trawling_net: {
    id: 'trawling_net',
    name: 'Stern Trawling Boom',
    cost: 270,
    minHullTier: 3,
    catchIntervalSec: 10.5,
    haulBonus: 2.4,
    rareChanceBonus: 0.16,
    description: 'Twin oak outriggers dragging a deep mesh net beneath the wake.',
  },
  deep_longline: {
    id: 'deep_longline',
    name: 'Deep-Sea Longline Rig',
    cost: 390,
    minHullTier: 4,
    catchIntervalSec: 8.5,
    haulBonus: 3.0,
    rareChanceBonus: 0.24,
    description: 'Multi-hook buoyed deepwater line built for prize trophy fish.',
  },
};

export const FISHING_GEAR_ORDER: FishingGearId[] = [
  'none',
  'basic_lines',
  'hand_rods',
  'small_net',
  'trawling_net',
  'deep_longline',
];

export const FISH_SPECIES: FishingCatchSpec[] = [
  { species: 'Atlantic Mackerel', rarity: 'Common', biome: 'temperate', foodValue: 3, goldValue: 10, difficulty: 1, isRare: false },
  { species: 'Silver Herring', rarity: 'Common', biome: 'temperate', foodValue: 3, goldValue: 9, difficulty: 1, isRare: false },
  { species: 'North Sea Cod', rarity: 'Common', biome: 'temperate', foodValue: 4, goldValue: 13, difficulty: 2, isRare: false },
  { species: 'Red Snapper', rarity: 'Common', biome: 'tropical', foodValue: 4, goldValue: 14, difficulty: 2, isRare: false },
  { species: 'Coral Parrotfish', rarity: 'Common', biome: 'tropical', foodValue: 4, goldValue: 16, difficulty: 2, isRare: false },
  { species: 'Coral Dorado', rarity: 'Uncommon', biome: 'tropical', foodValue: 5, goldValue: 22, difficulty: 2, isRare: false },
  { species: 'Arctic Cod', rarity: 'Common', biome: 'cold', foodValue: 4, goldValue: 15, difficulty: 2, isRare: false },
  { species: 'Arctic Char', rarity: 'Uncommon', biome: 'cold', foodValue: 5, goldValue: 21, difficulty: 2, isRare: false },
  { species: 'Glacier Halibut', rarity: 'Rare', biome: 'cold', foodValue: 7, goldValue: 38, difficulty: 3, isRare: true },
  { species: 'Atlantic Sailfish', rarity: 'Rare', biome: 'temperate', foodValue: 7, goldValue: 42, difficulty: 3, isRare: true },
  { species: 'Royal Tarpon', rarity: 'Rare', biome: 'tropical', foodValue: 6, goldValue: 40, difficulty: 3, isRare: true },
  { species: 'Gilded Sturgeon', rarity: 'Prize', biome: 'temperate', foodValue: 9, goldValue: 68, difficulty: 4, isRare: true },
];

export function pickFishingCatchForBiome(
  biome: OceanBiomeId,
  gearId: FishingGearId,
  rand: () => number
): FishingCatchSpec {
  const gear = FISHING_GEAR_SPECS[gearId] ?? FISHING_GEAR_SPECS.none;
  const effectiveBiome: OceanBiomeId = biome === 'deep' ? 'temperate' : biome;
  const biomePool = FISH_SPECIES.filter((s) => s.biome === effectiveBiome || s.biome === 'any');
  const rareRoll = rand();
  const rareThreshold = 0.14 + gear.rareChanceBonus;

  if (rareRoll < rareThreshold) {
    const rarePool = biomePool.filter((s) => s.isRare);
    if (rarePool.length > 0) {
      return rarePool[Math.floor(rand() * rarePool.length)];
    }
  }
  const commonPool = biomePool.filter((s) => !s.isRare);
  return commonPool[Math.floor(rand() * commonPool.length)] ?? FISH_SPECIES[0];
}

export interface CrewFishingResult {
  caughtRegular: number;
  caughtRare: number;
  saltAdded: number;
  lastSpecies: string | null;
  newTimer: number;
}

/**
 * Passive crew fishing when at least 1 crew member is assigned `'fisherman'` or fishing gear is mounted.
 * Barren Abyssal Deep waters ('deep') contain no schools of fish—only sea monsters.
 */
export function stepCrewFishing(
  save: SaveData,
  biome: OceanBiomeId,
  dt: number,
  timer: number,
  rand: () => number
): CrewFishingResult {
  if (biome === 'deep') {
    return { caughtRegular: 0, caughtRare: 0, saltAdded: 0, lastSpecies: null, newTimer: 0 };
  }

  const fishermen = save.player.crew.filter((c) => c.role === 'fisherman' && c.health > 15);
  const gearId = save.player.upgrades.fishingGear ?? 'none';

  // Requires either a fisherman crew member OR ship fishing gear mounted (both together multiply yield)
  if (fishermen.length === 0 && gearId === 'none') {
    return { caughtRegular: 0, caughtRare: 0, saltAdded: 0, lastSpecies: null, newTimer: timer };
  }

  const gear = FISHING_GEAR_SPECS[gearId];
  const avgFishingSkill =
    fishermen.length > 0
      ? fishermen.reduce((acc, m) => acc + (m.skills.fishing ?? Math.max(2, m.skills.sailing)), 0) /
        fishermen.length
      : 2;

  const speedKnots = Math.abs(save.player.speed);
  const speedBonus = speedKnots < 0.8 ? 0.95 : speedKnots <= 7.5 ? 1.25 : 0.85;
  const crewFactor = fishermen.length > 0 ? 1 + (fishermen.length - 1) * 0.45 + avgFishingSkill * 0.05 : 0.55;
  const biomeMult = biome === 'tropical' ? 1.25 : 1.0;

  const effectiveRate = speedBonus * crewFactor * biomeMult;
  let nextTimer = timer + dt * effectiveRate;
  const interval = gear.catchIntervalSec;

  let caughtRegular = 0;
  let caughtRare = 0;
  let saltAdded = 0;
  let lastSpecies: string | null = null;

  while (nextTimer >= interval) {
    nextTimer -= interval;
    const spec = pickFishingCatchForBiome(biome, gearId, rand);
    const qty = Math.max(1, Math.round((gear.haulBonus > 0 ? gear.haulBonus : 1) * (0.7 + rand() * 0.5)));
    if (spec.isRare) {
      caughtRare += 1;
      save.player.inventory.rareFish = (save.player.inventory.rareFish || 0) + 1;
    } else {
      caughtRegular += qty;
      save.player.inventory.fishCatch = (save.player.inventory.fishCatch || 0) + qty;
    }
    if (rand() < 0.35) {
      saltAdded += 1;
      save.player.inventory.salt = (save.player.inventory.salt || 0) + 1;
    }
    lastSpecies = spec.species;
  }

  return { caughtRegular, caughtRare, saltAdded, lastSpecies, newTimer: nextTimer };
}

/**
 * Harvest food + sea salt by fishing near a living non-monster ocean creature or reef school.
 */
export function fishNearMarineWildlife(
  actor: WildlifeActorData,
  inventory: Inventory
): { harvested: boolean; foodAdded: number; saltAdded: number; clothAdded: number } {
  if (actor.domain !== 'ocean' || actor.dead || actor.harvested) {
    return { harvested: false, foodAdded: 0, saltAdded: 0, clothAdded: 0 };
  }
  actor.harvested = true;
  actor.dead = true;
  actor.speed = 0;
  const foodAdded = Math.max(6, actor.lootFood || 10);
  const saltAdded = Math.max(1, actor.lootSalt || 1);
  const clothAdded = Math.max(0, actor.lootCloth || 0);
  inventory.food = (inventory.food || 0) + foodAdded;
  inventory.salt = (inventory.salt || 0) + saltAdded;
  if (clothAdded > 0) {
    inventory.cloth = (inventory.cloth || 0) + clothAdded;
  }
  return { harvested: true, foodAdded, saltAdded, clothAdded };
}

/**
 * Harvest the huge floating provisions + sea salt from a slain sea monster carcass by fishing near it.
 */
export function fishNearMonsterCarcass(
  monster: SeaMonsterData,
  inventory: Inventory
): { harvested: boolean; foodAdded: number; saltAdded: number } {
  if (!monster.defeated || monster.carcassHarvested) {
    return { harvested: false, foodAdded: 0, saltAdded: 0 };
  }
  const foodAdded = Math.max(0, monster.carcassRemainingFood || 0);
  const saltAdded = Math.max(1, monster.carcassRemainingSalt || 0);
  monster.carcassHarvested = true;
  monster.carcassRemainingFood = 0;
  monster.carcassRemainingSalt = 0;
  inventory.food = (inventory.food || 0) + foodAdded;
  inventory.salt = (inventory.salt || 0) + saltAdded;
  return { harvested: true, foodAdded, saltAdded };
}

/**
 * Converts caught fish into preserved galley rations (`food`).
 * 1 fishCatch -> 3 food, 1 rareFish -> 6 food.
 */
export function convertFishToProvisions(
  inventory: Inventory,
  regularCount: number,
  rareCount: number
): { convertedRegular: number; convertedRare: number; foodAdded: number } {
  const regAvail = Math.max(0, Math.floor(inventory.fishCatch || 0));
  const rareAvail = Math.max(0, Math.floor(inventory.rareFish || 0));
  const convertedRegular = Math.min(regAvail, Math.max(0, Math.floor(regularCount)));
  const convertedRare = Math.min(rareAvail, Math.max(0, Math.floor(rareCount)));

  const foodAdded = convertedRegular * 3 + convertedRare * 6;
  inventory.fishCatch = regAvail - convertedRegular;
  inventory.rareFish = rareAvail - convertedRare;
  inventory.food = (inventory.food || 0) + foodAdded;

  return { convertedRegular, convertedRare, foodAdded };
}

export function getManualFishingGaugeConfig(spec: FishingCatchSpec, gearId: FishingGearId) {
  const gear = FISHING_GEAR_SPECS[gearId] ?? FISHING_GEAR_SPECS.none;
  const gearBonus = gear.id === 'none' ? 0 : 0.04;
  const sweetWidth = Math.max(0.14, 0.34 - (spec.difficulty - 1) * 0.055 + gearBonus);
  const needleSpeed = 0.72 + (spec.difficulty - 1) * 0.28;
  return {
    sweetWidth,
    needleSpeed,
    sweetCenter: 0.5,
  };
}


/** Size tier of a fishable target: 1 = small shoal ... 7 = legendary sea monster. Bigger = smaller hit bar. */
export const WILDLIFE_FISH_TIER: Record<string, number> = {
  fish_school: 1,
  parrotfish: 1,
  arctic_cod_shoal: 1,
  seal: 2,
  sea_turtle: 2,
  swordfish: 3,
  dolphin: 3,
  manta_ray: 3,
  ocean_shark: 4,
  whale_pod: 5,
};

export const MONSTER_FISH_TIER: Record<string, number> = {
  small: 4,
  medium: 5,
  large: 6,
  legendary: 7,
};

/** Gold charged every time the rod is cast. Bigger catches cost more to attempt. */
export function getFishingCastCost(tier: number | null): number {
  if (tier == null) return 3;
  return 4 + Math.round(tier) * 2;
}

/** Hit-bar config for a creature of the given size tier: bigger catch => narrower bar and faster needle. */
export function getTargetGaugeConfig(tier: number) {
  const t = Math.max(1, Math.min(7, tier));
  return {
    sweetWidth: Math.max(0.07, 0.36 - t * 0.042),
    needleSpeed: 0.78 + t * 0.12,
    sweetCenter: 0.5,
  };
}
