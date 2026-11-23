import {
  Inventory,
  SeaMonsterAlignment,
  SeaMonsterData,
  SeaMonsterSize,
  SeaMonsterSpecies,
  TamedMonsterCompanion,
} from './types';
import { clamp } from './waveMath';

export interface SeaMonsterSpeciesMeta {
  species: SeaMonsterSpecies;
  label: string;
  baseHp: number;
  baseDamage: number;
  baseSpeed: number;
  attackRange: number;
  primaryColor: string;
  eyeColor: string;
  names: string[];
}

export const SEA_MONSTER_SPECS: Record<SeaMonsterSpecies, SeaMonsterSpeciesMeta> = {
  serpent: {
    species: 'serpent',
    label: 'Abyssal Sea Serpent',
    baseHp: 380,
    baseDamage: 24,
    baseSpeed: 10.2,
    attackRange: 32,
    primaryColor: '#1b4d3e',
    eyeColor: '#4ade80',
    names: ['Jormun-Drake', 'Emerald Wyrm', 'Siren-Spine Serpent', 'Trench Coil'],
  },
  kraken: {
    species: 'kraken',
    label: 'Colossal Kraken',
    baseHp: 540,
    baseDamage: 32,
    baseSpeed: 7.8,
    attackRange: 36,
    primaryColor: '#4c1d4b',
    eyeColor: '#facc15',
    names: ['Deep Kraken', 'Eight-Arm Scourge', 'Ink-Crown Horror', 'Void Tentacle'],
  },
  shark: {
    species: 'shark',
    label: 'Megalodon Leviathan',
    baseHp: 320,
    baseDamage: 28,
    baseSpeed: 12.2,
    attackRange: 28,
    primaryColor: '#334155',
    eyeColor: '#ef4444',
    names: ['Ironjaw Megalodon', 'GreyFin Maw', 'Crimson-Tooth Titan', 'Reef Reaper'],
  },
  whale: {
    species: 'whale',
    label: 'Ancient Guardian Whale',
    baseHp: 480,
    baseDamage: 22,
    baseSpeed: 8.6,
    attackRange: 30,
    primaryColor: '#1e3a5f',
    eyeColor: '#38bdf8',
    names: ['Elder Tide-Singer', 'Azure Baleen', 'Sanctuary Leviathan', 'Star-Backed Giant'],
  },
  deep_horror: {
    species: 'deep_horror',
    label: 'Luminous Deep Terror',
    baseHp: 620,
    baseDamage: 36,
    baseSpeed: 9.4,
    attackRange: 34,
    primaryColor: '#0f172a',
    eyeColor: '#22d3ee',
    names: ['Lantern Abyssal', 'Nightmare Maw', 'Trench Watcher', 'Nether Fin'],
  },
};

const SIZE_MULT: Record<SeaMonsterSize, { hp: number; dmg: number; tameFood: number }> = {
  small: { hp: 0.42, dmg: 0.55, tameFood: 20 },
  medium: { hp: 0.9, dmg: 0.95, tameFood: 0 },
  large: { hp: 1.55, dmg: 1.35, tameFood: 0 },
  legendary: { hp: 2.5, dmg: 1.75, tameFood: 0 },
};

export function generateSeaMonster(
  id: string,
  x: number,
  z: number,
  rand: () => number,
  allowLegendary = true
): SeaMonsterData {
  const speciesList: SeaMonsterSpecies[] = ['serpent', 'kraken', 'shark', 'whale', 'deep_horror'];
  const species = speciesList[Math.floor(rand() * speciesList.length)];
  const meta = SEA_MONSTER_SPECS[species];

  const sizeRoll = rand();
  const size: SeaMonsterSize =
    sizeRoll < 0.28
      ? 'small'
      : sizeRoll < 0.68
        ? 'medium'
        : sizeRoll < (allowLegendary ? 0.9 : 1.0)
          ? 'large'
          : 'legendary';

  let alignment: SeaMonsterAlignment = 'neutral';
  if (species === 'whale') {
    alignment = rand() < 0.8 ? 'good' : 'neutral';
  } else if (species === 'deep_horror') {
    alignment = rand() < 0.65 ? 'evil' : 'neutral';
  } else {
    const ar = rand();
    alignment = ar < 0.3 ? 'good' : ar < 0.62 ? 'evil' : 'neutral';
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
    x,
    z,
    heading: rand() * Math.PI * 2,
    speed: meta.baseSpeed * (size === 'small' ? 1.15 : size === 'legendary' ? 0.85 : 1),
    hp: maxHp,
    maxHp,
    damage,
    attackRange: meta.attackRange * (size === 'small' ? 0.78 : size === 'large' || size === 'legendary' ? 1.25 : 1),
    aggroRange: size === 'legendary' ? 340 : 250,
    patrolCenterX: x,
    patrolCenterZ: z,
    targetId: null,
    targetKind: null,
    attackCooldown: 1.5,
    tameProgress: 0,
    tameRequiredFood: size === 'small' ? mult.tameFood : 0,
    tamed: false,
    provokedByPlayer: false,
    discovered: false,
    defeated: false,
    sinkProgress: 0,
    animPhase: rand() * Math.PI * 2,
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
    return { ok: false, message: `${monster.name} has already sunk into the abyss.`, monster, inventory };
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
      message: `${monster.name} devoured the provisions and now swims loyally beside your hull!`,
      monster: updated,
      inventory: nextInv,
      companion: {
        id: monster.id,
        name: monster.name,
        species: monster.species,
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
