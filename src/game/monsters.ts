import {
  Inventory,
  OceanBiomeId,
  SeaMonsterAlignment,
  SeaMonsterAttackStyle,
  SeaMonsterData,
  SeaMonsterSize,
  SeaMonsterSpecies,
  TamedMonsterCompanion,
} from './types';
import { clamp } from './waveMath';

export interface SeaMonsterSpeciesMeta {
  species: SeaMonsterSpecies;
  label: string;
  attackStyle: SeaMonsterAttackStyle;
  preferredBiomes: OceanBiomeId[];
  baseHp: number;
  baseDamage: number;
  baseSpeed: number;
  attackRange: number;
  primaryColor: string;
  eyeColor: string;
  behaviorSummary: string;
  tameAbility: string;
  names: string[];
}

export const SEA_MONSTER_SPECS: Record<SeaMonsterSpecies, SeaMonsterSpeciesMeta> = {
  serpent: {
    species: 'serpent',
    label: 'Abyssal Sea Serpent',
    attackStyle: 'ram_bite',
    preferredBiomes: ['temperate', 'tropical', 'cold'],
    baseHp: 380,
    baseDamage: 24,
    baseSpeed: 10.4,
    attackRange: 32,
    primaryColor: '#1b4d3e',
    eyeColor: '#4ade80',
    behaviorSummary: 'Weaves swiftly in sinusoidal coils before lunging to ram and bite your hull.',
    tameAbility: 'Agile coil-flanker that weaves around enemy ships and bites exposed hulls.',
    names: ['Jormun-Drake', 'Emerald Wyrm', 'Siren-Spine Serpent', 'Trench Coil'],
  },
  kraken: {
    species: 'kraken',
    label: 'Colossal Kraken',
    attackStyle: 'tentacles',
    preferredBiomes: ['temperate', 'deep', 'cold'],
    baseHp: 540,
    baseDamage: 32,
    baseSpeed: 7.8,
    attackRange: 40,
    primaryColor: '#4c1d4b',
    eyeColor: '#facc15',
    behaviorSummary: 'Stalks steadily and lashes ships from afar with eight crushing tentacles.',
    tameAbility: 'Tentacle guardian that sweeps enemy decks and slows hostile raiders.',
    names: ['Deep Kraken', 'Eight-Arm Scourge', 'Ink-Crown Horror', 'Void Tentacle'],
  },
  giant_kraken: {
    species: 'giant_kraken',
    label: 'Giant Abyssal Kraken',
    attackStyle: 'tentacles',
    preferredBiomes: ['deep', 'temperate'],
    baseHp: 820,
    baseDamage: 42,
    baseSpeed: 7.2,
    attackRange: 54,
    primaryColor: '#361139',
    eyeColor: '#fbbf24',
    behaviorSummary: 'Towers above the waves with ten colossal tentacles that reach and smash ships from long range.',
    tameAbility: 'Colossal Kraken hatchling that delivers devastating long-reach tentacle slams in battle.',
    names: ['Dread Leviathan Kraken', 'Abyss-Lord Kraken', 'Ten-Arm Sovereign', 'Maelstrom Titan'],
  },
  leviathan_squid: {
    species: 'leviathan_squid',
    label: 'Crimson Architeuthis',
    attackStyle: 'tentacles',
    preferredBiomes: ['deep', 'tropical', 'temperate'],
    baseHp: 460,
    baseDamage: 30,
    baseSpeed: 11.4,
    attackRange: 44,
    primaryColor: '#7f1d1d',
    eyeColor: '#fde047',
    behaviorSummary: 'Surges forward with jet-propelled bursts and snaps twin long whip tentacles across decks.',
    tameAbility: 'Jet-darting squid escort that whips enemy sails and rigging with twin tentacles.',
    names: ['Crimson Architeuthis', 'Scarlet Whip-Squid', 'Abyss Dart', 'Bloodfin Squid'],
  },
  shark: {
    species: 'shark',
    label: 'Megalodon Leviathan',
    attackStyle: 'ram_bite',
    preferredBiomes: ['tropical', 'temperate'],
    baseHp: 320,
    baseDamage: 28,
    baseSpeed: 12.2,
    attackRange: 28,
    primaryColor: '#334155',
    eyeColor: '#ef4444',
    behaviorSummary: 'Intercepts targets at blistering speed, tearing into planking with massive serrated jaws.',
    tameAbility: 'Relentless hunter escort that charges straight into hostile broadsides.',
    names: ['Ironjaw Megalodon', 'GreyFin Maw', 'Crimson-Tooth Titan', 'Reef Reaper'],
  },
  whale: {
    species: 'whale',
    label: 'Ancient Guardian Whale',
    attackStyle: 'ram_bite',
    preferredBiomes: ['cold', 'temperate'],
    baseHp: 480,
    baseDamage: 22,
    baseSpeed: 8.6,
    attackRange: 30,
    primaryColor: '#1e3a5f',
    eyeColor: '#38bdf8',
    behaviorSummary: 'Sweeps in wide ocean arcs before delivering heavy broadside rams and jaw slams.',
    tameAbility: 'Noble sea guardian that shields your flagship and rams hostile pirates aside.',
    names: ['Elder Tide-Singer', 'Azure Baleen', 'Sanctuary Leviathan', 'Star-Backed Giant'],
  },
  deep_horror: {
    species: 'deep_horror',
    label: 'Luminous Deep Terror',
    attackStyle: 'ram_bite',
    preferredBiomes: ['deep'],
    baseHp: 620,
    baseDamage: 36,
    baseSpeed: 9.4,
    attackRange: 34,
    primaryColor: '#0f172a',
    eyeColor: '#22d3ee',
    behaviorSummary: 'Rises from trench waters in relentless glowing charges, crushing hulls in armored jaws.',
    tameAbility: 'Bioluminescent trench beast that intimidates foes and crushes enemy prows.',
    names: ['Lantern Abyssal', 'Nightmare Maw', 'Trench Watcher', 'Nether Fin'],
  },
  mosasaur: {
    species: 'mosasaur',
    label: 'Apex Mosasaur',
    attackStyle: 'ram_bite',
    preferredBiomes: ['tropical', 'temperate'],
    baseHp: 440,
    baseDamage: 33,
    baseSpeed: 11.1,
    attackRange: 31,
    primaryColor: '#1f4e5f',
    eyeColor: '#f97316',
    behaviorSummary: 'Circles tightly around ships before exploding inward with snapping crocodilian jaws.',
    tameAbility: 'Armored marine reptile that ambushes pursuing corsairs with vicious jaw bites.',
    names: ['Crested Mosasaur', 'Lagoon Jaw-King', 'Sunscale Terror', 'Tide-Fang'],
  },
  frost_leviathan: {
    species: 'frost_leviathan',
    label: 'Glacial Spineback',
    attackStyle: 'ram_bite',
    preferredBiomes: ['cold'],
    baseHp: 560,
    baseDamage: 34,
    baseSpeed: 9.1,
    attackRange: 33,
    primaryColor: '#4a6e82',
    eyeColor: '#7dd3fc',
    behaviorSummary: 'Plows through frigid swells and ice sheets to gore hulls with ivory tusks and jaws.',
    tameAbility: 'Ice-armored tusked guardian that delivers heavy armor-cracking hull rams.',
    names: ['Rime-Tusk Titan', 'Glacier Spineback', 'Frostbite Maw', 'Boreal Behemoth'],
  },
};

const SIZE_MULT: Record<SeaMonsterSize, { hp: number; dmg: number; tameFood: number }> = {
  small: { hp: 0.42, dmg: 0.55, tameFood: 20 },
  medium: { hp: 0.9, dmg: 0.95, tameFood: 0 },
  large: { hp: 1.55, dmg: 1.35, tameFood: 0 },
  legendary: { hp: 2.5, dmg: 1.75, tameFood: 0 },
};

export function getMonsterAttackStyle(species: SeaMonsterSpecies): SeaMonsterAttackStyle {
  return SEA_MONSTER_SPECS[species]?.attackStyle ?? 'ram_bite';
}

export function pickSeaMonsterSpeciesForBiome(
  biome: OceanBiomeId | undefined,
  rand: () => number
): SeaMonsterSpecies {
  if (biome === 'deep') {
    const deepPool: SeaMonsterSpecies[] = [
      'giant_kraken',
      'giant_kraken',
      'deep_horror',
      'leviathan_squid',
      'kraken',
      'serpent',
    ];
    return deepPool[Math.floor(rand() * deepPool.length)];
  }
  if (biome === 'cold') {
    const coldPool: SeaMonsterSpecies[] = ['frost_leviathan', 'frost_leviathan', 'whale', 'kraken', 'serpent'];
    return coldPool[Math.floor(rand() * coldPool.length)];
  }
  if (biome === 'tropical') {
    const tropPool: SeaMonsterSpecies[] = ['mosasaur', 'shark', 'leviathan_squid', 'serpent', 'kraken'];
    return tropPool[Math.floor(rand() * tropPool.length)];
  }
  const allPool: SeaMonsterSpecies[] = [
    'serpent',
    'kraken',
    'giant_kraken',
    'leviathan_squid',
    'shark',
    'whale',
    'mosasaur',
    'deep_horror',
  ];
  return allPool[Math.floor(rand() * allPool.length)];
}

export function generateSeaMonster(
  id: string,
  x: number,
  z: number,
  rand: () => number,
  allowLegendary = true,
  biome?: OceanBiomeId
): SeaMonsterData {
  const species = pickSeaMonsterSpeciesForBiome(biome, rand);
  const meta = SEA_MONSTER_SPECS[species];

  const sizeRoll = rand();
  const isGiantKraken = species === 'giant_kraken';
  const size: SeaMonsterSize =
    sizeRoll < (isGiantKraken ? 0.16 : 0.28)
      ? 'small'
      : sizeRoll < (isGiantKraken ? 0.45 : 0.68)
        ? 'medium'
        : sizeRoll < (allowLegendary ? (isGiantKraken ? 0.78 : 0.9) : 1.0)
          ? 'large'
          : 'legendary';

  let alignment: SeaMonsterAlignment = 'neutral';
  if (species === 'whale') {
    alignment = rand() < 0.8 ? 'good' : 'neutral';
  } else if (species === 'deep_horror' || species === 'giant_kraken') {
    alignment = rand() < 0.72 ? 'evil' : 'neutral';
  } else {
    const ar = rand();
    alignment = ar < 0.28 ? 'good' : ar < 0.64 ? 'evil' : 'neutral';
  }

  const mult = SIZE_MULT[size];
  const maxHp = Math.round(meta.baseHp * mult.hp);
  const damage = Math.round(meta.baseDamage * mult.dmg);
  const prefix =
    size === 'small' ? 'Young ' : size === 'legendary' ? 'Ancient ' : size === 'large' ? 'Giant ' : '';
  const name = prefix + meta.names[Math.floor(rand() * meta.names.length)];

  return {
    id,
    name,
    species,
    size,
    alignment,
    attackStyle: meta.attackStyle,
    x,
    z,
    heading: rand() * Math.PI * 2,
    speed: meta.baseSpeed * (size === 'small' ? 1.15 : size === 'legendary' ? 0.85 : 1),
    hp: maxHp,
    maxHp,
    damage,
    attackRange: meta.attackRange * (size === 'small' ? 0.78 : size === 'large' || size === 'legendary' ? 1.25 : 1),
    aggroRange: size === 'legendary' || species === 'giant_kraken' ? 360 : 260,
    patrolCenterX: x,
    patrolCenterZ: z,
    targetId: null,
    targetKind: null,
    attackCooldown: 1.5,
    attackAnimTimer: 0,
    tameProgress: 0,
    tameRequiredFood: size === 'small' ? mult.tameFood : 0,
    tamed: false,
    provokedByPlayer: false,
    discovered: false,
    defeated: false,
    sinkProgress: 0,
    animPhase: rand() * Math.PI * 2,
    carcassRemainingFood: 0,
    carcassRemainingSalt: 0,
    carcassHarvested: false,
    carcassTimer: 0,
  };
}

export function shouldMonsterAttackPlayer(
  monster: SeaMonsterData,
  playerReputation: number
): boolean {
  if (monster.tamed || monster.defeated) return false;
  if (monster.provokedByPlayer) return true;
  if (monster.alignment === 'good') {
    return playerReputation <= -30;
  }
  if (monster.alignment === 'evil') {
    return playerReputation >= 20;
  }
  return monster.size !== 'small'; // small neutral beasts are curious rather than instantly aggressive
}

export interface FeedMonsterResult {
  ok: boolean;
  message: string;
  monster: SeaMonsterData;
  inventory: Inventory;
  companion?: TamedMonsterCompanion;
}

export function feedSeaMonsterToTame(
  monster: SeaMonsterData,
  inventory: Inventory,
  foodAmount = 8
): FeedMonsterResult {
  if (monster.defeated) {
    return { ok: false, message: `${monster.name} has already been slain.`, monster, inventory };
  }
  if (monster.tamed) {
    return { ok: false, message: `${monster.name} already follows your ship loyally.`, monster, inventory };
  }
  if (monster.size !== 'small') {
    return {
      ok: false,
      message: `${monster.name} is far too colossal and wild to tame! Only small beasts can be befriended.`,
      monster,
      inventory,
    };
  }
  if (monster.provokedByPlayer) {
    return {
      ok: false,
      message: `${monster.name} has already tasted cannon fire and refuses your offerings.`,
      monster,
      inventory,
    };
  }
  const available = Math.floor(inventory.food || 0);
  const feedQty = Math.min(foodAmount, Math.max(0, monster.tameRequiredFood - monster.tameProgress));
  if (available < feedQty || feedQty <= 0) {
    return {
      ok: false,
      message: `Need ${Math.max(1, feedQty)} crates of Provisions to feed ${monster.name}.`,
      monster,
      inventory,
    };
  }

  const nextFood = available - feedQty;
  const nextProgress = clamp(monster.tameProgress + feedQty, 0, monster.tameRequiredFood);
  const nowTamed = nextProgress >= monster.tameRequiredFood;

  const updated: SeaMonsterData = {
    ...monster,
    tameProgress: nextProgress,
    tamed: nowTamed,
    alignment: nowTamed ? 'good' : monster.alignment,
  };

  const nextInv: Inventory = { ...inventory, food: nextFood };

  if (nowTamed) {
    return {
      ok: true,
      message: `${monster.name} devoured the provisions and now swims loyally beside your hull! (${SEA_MONSTER_SPECS[monster.species].tameAbility})`,
      monster: updated,
      inventory: nextInv,
      companion: {
        id: monster.id,
        name: monster.name,
        species: monster.species,
        size: monster.size,
        hp: monster.hp,
        maxHp: monster.maxHp,
        damage: monster.damage,
        x: monster.x,
        z: monster.z,
        heading: monster.heading,
      },
    };
  }

  return {
    ok: true,
    message: `Fed ${feedQty} Provisions to ${monster.name} (${nextProgress}/${monster.tameRequiredFood} trust).`,
    monster: updated,
    inventory: nextInv,
  };
}

export const MONSTER_PROVISIONS_BY_SIZE: Record<SeaMonsterSize, number> = {
  small: 90,
  medium: 170,
  large: 265,
  legendary: 380,
};

export const MONSTER_SALT_BY_SIZE: Record<SeaMonsterSize, number> = {
  small: 4,
  medium: 7,
  large: 10,
  legendary: 14,
};

export function getMonsterProvisionDrop(size: SeaMonsterSize): number {
  return MONSTER_PROVISIONS_BY_SIZE[size] ?? 170;
}

export function getMonsterSaltDrop(size: SeaMonsterSize): number {
  return MONSTER_SALT_BY_SIZE[size] ?? 7;
}

export interface MonsterChaseOutput {
  targetHeading: number;
  moveSpeed: number;
  isLunging: boolean;
  ramDamageMultiplier: number;
}

export function stepMonsterChaseBehavior(
  monster: SeaMonsterData,
  targetX: number,
  targetZ: number,
  targetVx: number,
  targetVz: number,
  dist: number,
  time: number
): MonsterChaseOutput {
  const leadTime = clamp(dist / 26, 0, 2.2);
  const aimX = targetX + targetVx * leadTime;
  const aimZ = targetZ + targetVz * leadTime;
  const dx = aimX - monster.x;
  const dz = aimZ - monster.z;
  const directHeading = Math.atan2(-dx, -dz);

  const sizeMult =
    monster.size === 'small' ? 1.05 : monster.size === 'large' ? 1.08 : monster.size === 'legendary' ? 1.15 : 1.0;

  if (monster.species === 'shark') {
    const lungePulse = Math.sin(time * 1.45 + monster.animPhase) > 0.32 && dist < 115;
    return {
      targetHeading: directHeading,
      moveSpeed: monster.speed * sizeMult * (lungePulse ? 1.48 : 1.12),
      isLunging: lungePulse,
      ramDamageMultiplier: lungePulse ? 1.38 : 1.12,
    };
  }

  if (monster.species === 'serpent') {
    const weave = dist < 45 ? 0 : Math.sin(time * 2.2 + monster.animPhase) * 0.52;
    const isStrike = dist < 54;
    return {
      targetHeading: directHeading + weave,
      moveSpeed: monster.speed * sizeMult * (isStrike ? 1.36 : 1.08),
      isLunging: isStrike,
      ramDamageMultiplier: isStrike ? 1.3 : 1.05,
    };
  }

  if (monster.species === 'kraken') {
    const surge = dist < 62;
    return {
      targetHeading: directHeading,
      moveSpeed: monster.speed * sizeMult * (surge ? 1.42 : 0.94),
      isLunging: surge,
      ramDamageMultiplier: surge ? 1.52 : 1.25,
    };
  }

  if (monster.species === 'giant_kraken') {
    // Colossal tentacled dreadnought: steady ominous approach, halts right inside tentacle sweep arc
    const sweepRange = monster.attackRange * 0.92;
    const surging = dist < 85 && dist > sweepRange * 0.72;
    return {
      targetHeading: directHeading + (dist <= sweepRange ? Math.sin(time * 0.7 + monster.animPhase) * 0.25 : 0),
      moveSpeed: dist <= sweepRange * 0.65 ? monster.speed * 0.35 : monster.speed * sizeMult * (surging ? 1.32 : 1.0),
      isLunging: dist <= sweepRange + 14,
      ramDamageMultiplier: 1.62,
    };
  }

  if (monster.species === 'leviathan_squid') {
    // Jet-propulsion darting surges + lateral whip angle
    const jetPulse = Math.sin(time * 1.9 + monster.animPhase) > 0.25;
    const flankOffset = dist < 52 && dist > 26 ? 0.34 : 0;
    return {
      targetHeading: directHeading + flankOffset,
      moveSpeed: monster.speed * sizeMult * (jetPulse ? 1.52 : 0.78),
      isLunging: jetPulse && dist < 82,
      ramDamageMultiplier: jetPulse ? 1.42 : 1.1,
    };
  }

  if (monster.species === 'whale') {
    const arcBias = dist > 78 ? Math.sin(time * 0.8 + monster.animPhase) * 0.42 : 0;
    const ramCharge = dist < 78;
    return {
      targetHeading: directHeading + arcBias,
      moveSpeed: monster.speed * sizeMult * (ramCharge ? 1.38 : 1.0),
      isLunging: ramCharge,
      ramDamageMultiplier: ramCharge ? 1.45 : 1.18,
    };
  }

  if (monster.species === 'mosasaur') {
    // Tight predatory flanking arc then explosive bite-ram
    const circleBias = dist > 56 ? Math.sin(time * 1.35 + monster.animPhase) * 0.58 : 0;
    const snapCharge = dist < 64;
    return {
      targetHeading: directHeading + circleBias,
      moveSpeed: monster.speed * sizeMult * (snapCharge ? 1.48 : 1.1),
      isLunging: snapCharge,
      ramDamageMultiplier: snapCharge ? 1.44 : 1.14,
    };
  }

  if (monster.species === 'frost_leviathan') {
    // Heavy straight armored icebreaker charge
    const boreCharge = dist < 88;
    return {
      targetHeading: directHeading,
      moveSpeed: monster.speed * sizeMult * (boreCharge ? 1.38 : 1.02),
      isLunging: boreCharge,
      ramDamageMultiplier: boreCharge ? 1.54 : 1.24,
    };
  }

  // deep_horror: relentless abyssal charge
  const abyssCharge = Math.sin(time * 1.1 + monster.animPhase) > 0.05 || dist < 90;
  return {
    targetHeading: directHeading,
    moveSpeed: monster.speed * sizeMult * (abyssCharge ? 1.34 : 1.08),
    isLunging: abyssCharge,
    ramDamageMultiplier: 1.44,
  };
}
