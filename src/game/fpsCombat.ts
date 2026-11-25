import {
  FpsWeaponId,
  FpsWeaponRuntimeState,
  Inventory,
  IslandArchetype,
  IslandDiscoveryData,
  IslandPirateGuardData,
  IslandPirateGuardRole,
  SaveData,
  WildlifeActorData,
  WildlifeBehaviorState,
  WildlifeDomain,
  WildlifeSpecies,
} from './types';

export interface FpsWeaponSpec {
  id: FpsWeaponId;
  name: string;
  slot: 1 | 2 | 3;
  isRanged: boolean;
  damage: number;
  range: number;
  cooldown: number;
  reloadDuration: number;
  gunpowderCost: number;
  leadShotCost: number;
  description: string;
}

export const FPS_WEAPON_SPECS: Record<FpsWeaponId, FpsWeaponSpec> = {
  cutlass: {
    id: 'cutlass',
    name: 'Sailor Cutlass',
    slot: 1,
    isRanged: false,
    damage: 28,
    range: 3.4,
    cooldown: 0.48,
    reloadDuration: 0,
    gunpowderCost: 0,
    leadShotCost: 0,
    description: 'Curved iron boarding blade. Fast strikes and RMB / F parrying.',
  },
  pistol: {
    id: 'pistol',
    name: 'Flintlock Pistol',
    slot: 2,
    isRanged: true,
    damage: 48,
    range: 28,
    cooldown: 0.45,
    reloadDuration: 1.55,
    gunpowderCost: 1,
    leadShotCost: 1,
    description: 'One-handed flintlock for close-to-mid range. Moderate reload.',
  },
  musket: {
    id: 'musket',
    name: 'Sea-Service Musket',
    slot: 3,
    isRanged: true,
    damage: 86,
    range: 64,
    cooldown: 0.6,
    reloadDuration: 2.85,
    gunpowderCost: 2,
    leadShotCost: 1,
    description: 'Two-handed smoothbore longarm. Heavy damage and range; slow reload.',
  },
};

export function createInitialFpsWeaponState(): FpsWeaponRuntimeState {
  return {
    activeWeapon: 'cutlass',
    pistolLoaded: true,
    musketLoaded: true,
    pistolReloadRemaining: 0,
    musketReloadRemaining: 0,
    isReloading: false,
    isBlocking: false,
    cooldown: 0,
  };
}

/**
 * Switches active weapon while STRICTLY preserving independent loaded/unloaded & paused reload progress.
 * Switching away never finishes or cancels an unloaded state.
 */
export function selectFpsWeapon(
  state: FpsWeaponRuntimeState,
  nextWeapon: FpsWeaponId
): FpsWeaponRuntimeState {
  if (state.activeWeapon === nextWeapon) return state;
  return {
    ...state,
    activeWeapon: nextWeapon,
    isReloading: false,
    isBlocking: false,
  };
}

export function canStartFpsReload(
  state: FpsWeaponRuntimeState,
  inventory: Pick<Inventory, 'gunpowder' | 'leadShot'>
): { ok: boolean; reason?: string } {
  const spec = FPS_WEAPON_SPECS[state.activeWeapon];
  if (!spec.isRanged) return { ok: false, reason: 'Cutlass needs no powder or shot.' };
  const loaded = state.activeWeapon === 'pistol' ? state.pistolLoaded : state.musketLoaded;
  if (loaded) return { ok: false, reason: `${spec.name} is already loaded.` };
  if (state.isReloading) return { ok: false, reason: 'Already reloading.' };
  if ((inventory.gunpowder || 0) < spec.gunpowderCost) {
    return { ok: false, reason: `Need ${spec.gunpowderCost} Gunpowder to reload.` };
  }
  if ((inventory.leadShot || 0) < spec.leadShotCost) {
    return { ok: false, reason: `Need ${spec.leadShotCost} Lead Shot to reload.` };
  }
  return { ok: true };
}

export function startFpsReload(
  state: FpsWeaponRuntimeState,
  inventory: Pick<Inventory, 'gunpowder' | 'leadShot'>
): { state: FpsWeaponRuntimeState; started: boolean; reason?: string } {
  const check = canStartFpsReload(state, inventory);
  if (!check.ok) {
    return { state, started: false, reason: check.reason };
  }
  const spec = FPS_WEAPON_SPECS[state.activeWeapon];
  if (state.activeWeapon === 'pistol') {
    const rem = state.pistolReloadRemaining > 0 ? state.pistolReloadRemaining : spec.reloadDuration;
    return {
      state: { ...state, isReloading: true, pistolReloadRemaining: rem, isBlocking: false },
      started: true,
    };
  }
  const rem = state.musketReloadRemaining > 0 ? state.musketReloadRemaining : spec.reloadDuration;
  return {
    state: { ...state, isReloading: true, musketReloadRemaining: rem, isBlocking: false },
    started: true,
  };
}

export function stepFpsReload(
  state: FpsWeaponRuntimeState,
  dt: number,
  inventory: Inventory
): { state: FpsWeaponRuntimeState; finishedWeapon: FpsWeaponId | null } {
  const nextCooldown = Math.max(0, state.cooldown - dt);
  if (!state.isReloading) {
    return { state: { ...state, cooldown: nextCooldown }, finishedWeapon: null };
  }

  const w = state.activeWeapon;
  if (w === 'cutlass') {
    return { state: { ...state, isReloading: false, cooldown: nextCooldown }, finishedWeapon: null };
  }

  const spec = FPS_WEAPON_SPECS[w];
  const prevRem = w === 'pistol' ? state.pistolReloadRemaining : state.musketReloadRemaining;
  const rem = Math.max(0, prevRem - dt);

  if (rem <= 0) {
    // Deduct powder + lead shot upon completing priming & ramming
    if ((inventory.gunpowder || 0) >= spec.gunpowderCost && (inventory.leadShot || 0) >= spec.leadShotCost) {
      inventory.gunpowder -= spec.gunpowderCost;
      inventory.leadShot -= spec.leadShotCost;
      if (w === 'pistol') {
        return {
          state: {
            ...state,
            cooldown: nextCooldown,
            isReloading: false,
            pistolLoaded: true,
            pistolReloadRemaining: 0,
          },
          finishedWeapon: 'pistol',
        };
      }
      return {
        state: {
          ...state,
          cooldown: nextCooldown,
          isReloading: false,
          musketLoaded: true,
          musketReloadRemaining: 0,
        },
        finishedWeapon: 'musket',
      };
    }
    return {
      state: { ...state, cooldown: nextCooldown, isReloading: false },
      finishedWeapon: null,
    };
  }

  if (w === 'pistol') {
    return {
      state: { ...state, cooldown: nextCooldown, pistolReloadRemaining: rem },
      finishedWeapon: null,
    };
  }
  return {
    state: { ...state, cooldown: nextCooldown, musketReloadRemaining: rem },
    finishedWeapon: null,
  };
}

export function fireFpsWeapon(
  state: FpsWeaponRuntimeState
): {
  state: FpsWeaponRuntimeState;
  fired: boolean;
  needsReload: boolean;
  weapon: FpsWeaponId;
  damage: number;
  range: number;
} {
  const w = state.activeWeapon;
  const spec = FPS_WEAPON_SPECS[w];

  if (state.isReloading) {
    return { state, fired: false, needsReload: false, weapon: w, damage: 0, range: spec.range };
  }

  if (w !== 'cutlass') {
    const isLoaded = w === 'pistol' ? state.pistolLoaded : state.musketLoaded;
    if (!isLoaded) {
      return { state, fired: false, needsReload: true, weapon: w, damage: 0, range: spec.range };
    }
  }

  if (state.cooldown > 0) {
    return { state, fired: false, needsReload: false, weapon: w, damage: 0, range: spec.range };
  }

  if (w === 'cutlass') {
    return {
      state: { ...state, cooldown: spec.cooldown, isBlocking: false },
      fired: true,
      needsReload: false,
      weapon: 'cutlass',
      damage: spec.damage,
      range: spec.range,
    };
  }

  if (w === 'pistol') {
    return {
      state: {
        ...state,
        cooldown: spec.cooldown,
        pistolLoaded: false,
        pistolReloadRemaining: spec.reloadDuration,
      },
      fired: true,
      needsReload: false,
      weapon: 'pistol',
      damage: spec.damage,
      range: spec.range,
    };
  }

  return {
    state: {
      ...state,
      cooldown: spec.cooldown,
      musketLoaded: false,
      musketReloadRemaining: spec.reloadDuration,
    },
    fired: true,
    needsReload: false,
    weapon: 'musket',
    damage: spec.damage,
    range: spec.range,
  };
}

// =========================================================================
// WILDLIFE ECOSYSTEM (Ocean + Island + Coastal Air)
// =========================================================================

export interface WildlifeSpec {
  species: WildlifeSpecies;
  label: string;
  domain: WildlifeDomain;
  killable?: boolean;
  maxHp: number;
  maxSpeed: number;
  damage: number;
  aggression: 'passive' | 'territorial' | 'hostile';
  pursuitLimit: number;
  foodMin: number;
  foodMax: number;
  hidesMin: number;
  hidesMax: number;
  clothMin: number;
  clothMax: number;
  saltMin: number;
  saltMax: number;
}

export const WILDLIFE_SPECS: Record<WildlifeSpecies, WildlifeSpec> = {
  dolphin: {
    species: 'dolphin',
    label: 'Spinner Dolphin',
    domain: 'ocean',
    maxHp: 45,
    maxSpeed: 8.5,
    damage: 0,
    aggression: 'passive',
    pursuitLimit: 0,
    foodMin: 8,
    foodMax: 14,
    hidesMin: 0,
    hidesMax: 0,
    clothMin: 1,
    clothMax: 2,
    saltMin: 1,
    saltMax: 2,
  },
  whale_pod: {
    species: 'whale_pod',
    label: 'Right Whale',
    domain: 'ocean',
    maxHp: 180,
    maxSpeed: 5.2,
    damage: 0,
    aggression: 'passive',
    pursuitLimit: 0,
    foodMin: 28,
    foodMax: 42,
    hidesMin: 0,
    hidesMax: 0,
    clothMin: 4,
    clothMax: 7,
    saltMin: 2,
    saltMax: 4,
  },
  ocean_shark: {
    species: 'ocean_shark',
    label: 'Reef Shark',
    domain: 'ocean',
    maxHp: 68,
    maxSpeed: 8.2,
    damage: 14,
    aggression: 'territorial',
    pursuitLimit: 38,
    foodMin: 14,
    foodMax: 22,
    hidesMin: 1,
    hidesMax: 2,
    clothMin: 2,
    clothMax: 4,
    saltMin: 1,
    saltMax: 3,
  },
  sea_turtle: {
    species: 'sea_turtle',
    label: 'Green Sea Turtle',
    domain: 'ocean',
    maxHp: 40,
    maxSpeed: 3.4,
    damage: 0,
    aggression: 'passive',
    pursuitLimit: 0,
    foodMin: 10,
    foodMax: 15,
    hidesMin: 1,
    hidesMax: 1,
    clothMin: 1,
    clothMax: 3,
    saltMin: 1,
    saltMax: 2,
  },
  seal: {
    species: 'seal',
    label: 'Harbor Seal',
    domain: 'ocean',
    maxHp: 48,
    maxSpeed: 5.8,
    damage: 5,
    aggression: 'passive',
    pursuitLimit: 0,
    foodMin: 11,
    foodMax: 17,
    hidesMin: 1,
    hidesMax: 2,
    clothMin: 2,
    clothMax: 4,
    saltMin: 1,
    saltMax: 3,
  },
  fish_school: {
    species: 'fish_school',
    label: 'Schooling Shoal',
    domain: 'ocean',
    maxHp: 20,
    maxSpeed: 4.5,
    damage: 0,
    aggression: 'passive',
    pursuitLimit: 0,
    foodMin: 10,
    foodMax: 16,
    hidesMin: 0,
    hidesMax: 0,
    clothMin: 1,
    clothMax: 2,
    saltMin: 1,
    saltMax: 3,
  },
  manta_ray: {
    species: 'manta_ray',
    label: 'Reef Manta Ray',
    domain: 'ocean',
    maxHp: 52,
    maxSpeed: 6.2,
    damage: 0,
    aggression: 'passive',
    pursuitLimit: 0,
    foodMin: 14,
    foodMax: 22,
    hidesMin: 0,
    hidesMax: 1,
    clothMin: 1,
    clothMax: 2,
    saltMin: 1,
    saltMax: 3,
  },
  parrotfish: {
    species: 'parrotfish',
    label: 'Coral Reef Shoal',
    domain: 'ocean',
    maxHp: 24,
    maxSpeed: 4.2,
    damage: 0,
    aggression: 'passive',
    pursuitLimit: 0,
    foodMin: 12,
    foodMax: 19,
    hidesMin: 0,
    hidesMax: 0,
    clothMin: 1,
    clothMax: 2,
    saltMin: 1,
    saltMax: 3,
  },
  swordfish: {
    species: 'swordfish',
    label: 'Atlantic Sailfish',
    domain: 'ocean',
    maxHp: 56,
    maxSpeed: 9.4,
    damage: 0,
    aggression: 'passive',
    pursuitLimit: 0,
    foodMin: 16,
    foodMax: 25,
    hidesMin: 0,
    hidesMax: 0,
    clothMin: 1,
    clothMax: 2,
    saltMin: 1,
    saltMax: 3,
  },
  arctic_cod_shoal: {
    species: 'arctic_cod_shoal',
    label: 'Arctic Cod Shoal',
    domain: 'ocean',
    maxHp: 26,
    maxSpeed: 4.4,
    damage: 0,
    aggression: 'passive',
    pursuitLimit: 0,
    foodMin: 14,
    foodMax: 22,
    hidesMin: 0,
    hidesMax: 0,
    clothMin: 1,
    clothMax: 2,
    saltMin: 2,
    saltMax: 4,
  },
  ocean_flock_bird: {
    species: 'ocean_flock_bird',
    label: 'Pelagic Shearwater',
    domain: 'air',
    killable: false,
    maxHp: 20,
    maxSpeed: 10.6,
    damage: 0,
    aggression: 'passive',
    pursuitLimit: 0,
    foodMin: 0,
    foodMax: 0,
    hidesMin: 0,
    hidesMax: 0,
    clothMin: 0,
    clothMax: 0,
    saltMin: 0,
    saltMax: 0,
  },
  seabird: {
    species: 'seabird',
    label: 'Coastal Gull',
    domain: 'air',
    killable: true,
    maxHp: 16,
    maxSpeed: 9.2,
    damage: 0,
    aggression: 'passive',
    pursuitLimit: 0,
    foodMin: 3,
    foodMax: 5,
    hidesMin: 0,
    hidesMax: 0,
    clothMin: 1,
    clothMax: 2,
    saltMin: 1,
    saltMax: 1,
  },
  boar: {
    species: 'boar',
    label: 'Wild Island Boar',
    domain: 'island',
    maxHp: 65,
    maxSpeed: 6.4,
    damage: 14,
    aggression: 'territorial',
    pursuitLimit: 32,
    foodMin: 14,
    foodMax: 22,
    hidesMin: 1,
    hidesMax: 3,
    clothMin: 2,
    clothMax: 5,
    saltMin: 1,
    saltMax: 2,
  },
  wolf: {
    species: 'wolf',
    label: 'Timber Wolf',
    domain: 'island',
    maxHp: 58,
    maxSpeed: 7.5,
    damage: 13,
    aggression: 'hostile',
    pursuitLimit: 36,
    foodMin: 10,
    foodMax: 16,
    hidesMin: 2,
    hidesMax: 3,
    clothMin: 3,
    clothMax: 5,
    saltMin: 1,
    saltMax: 2,
  },
  snake: {
    species: 'snake',
    label: 'Pit Viper',
    domain: 'island',
    maxHp: 30,
    maxSpeed: 4.6,
    damage: 11,
    aggression: 'territorial',
    pursuitLimit: 18,
    foodMin: 5,
    foodMax: 8,
    hidesMin: 1,
    hidesMax: 1,
    clothMin: 1,
    clothMax: 3,
    saltMin: 1,
    saltMax: 1,
  },
  crocodile: {
    species: 'crocodile',
    label: 'Saltwater Crocodile',
    domain: 'island',
    maxHp: 96,
    maxSpeed: 5.5,
    damage: 20,
    aggression: 'hostile',
    pursuitLimit: 30,
    foodMin: 18,
    foodMax: 26,
    hidesMin: 2,
    hidesMax: 4,
    clothMin: 4,
    clothMax: 7,
    saltMin: 1,
    saltMax: 3,
  },
  bear: {
    species: 'bear',
    label: 'Frost Bear',
    domain: 'island',
    maxHp: 135,
    maxSpeed: 6.1,
    damage: 24,
    aggression: 'territorial',
    pursuitLimit: 38,
    foodMin: 24,
    foodMax: 34,
    hidesMin: 3,
    hidesMax: 5,
    clothMin: 5,
    clothMax: 8,
    saltMin: 2,
    saltMax: 3,
  },
};

export function createWildlifeActor(
  id: string,
  species: WildlifeSpecies,
  x: number,
  y: number,
  z: number,
  rand: () => number,
  islandId?: string
): WildlifeActorData {
  const spec = WILDLIFE_SPECS[species];
  return {
    id,
    species,
    domain: spec.domain,
    islandId,
    killable: spec.killable !== false,
    vy: 0,
    x,
    y,
    z,
    homeX: x,
    homeZ: z,
    heading: rand() * Math.PI * 2,
    speed: spec.maxSpeed * 0.45,
    maxSpeed: spec.maxSpeed,
    hp: spec.maxHp,
    maxHp: spec.maxHp,
    damage: spec.damage,
    aggression: spec.aggression,
    state: 'patrol',
    attackCooldown: 0,
    hitFlashTimer: 0,
    koTimer: 0,
    dead: false,
    harvested: false,
    animPhase: rand() * Math.PI * 2,
    lootFood: spec.foodMin + Math.floor(rand() * (spec.foodMax - spec.foodMin + 1)),
    lootHides: spec.hidesMin + Math.floor(rand() * (spec.hidesMax - spec.hidesMin + 1)),
    lootCloth: spec.clothMin + Math.floor(rand() * (spec.clothMax - spec.clothMin + 1)),
    lootSalt: spec.saltMin + Math.floor(rand() * (spec.saltMax - spec.saltMin + 1)),
  };
}

export function pickIslandWildlifePool(archetype: IslandArchetype): WildlifeSpecies[] {
  if (archetype === 'frozen') return ['bear', 'wolf', 'seal'];
  if (archetype === 'tropical') return ['boar', 'snake', 'crocodile', 'seabird'];
  if (archetype === 'rocky') return ['wolf', 'boar', 'seabird'];
  if (archetype === 'forest' || archetype === 'large_island') return ['boar', 'wolf', 'bear', 'snake', 'seabird'];
  return ['boar', 'snake', 'seabird'];
}

export function stepWildlifeActor(
  actor: WildlifeActorData,
  playerX: number,
  playerZ: number,
  playerInIslandMode: boolean,
  dt: number
): { attackedPlayerDamage: number } {
  if (actor.dead) return { attackedPlayerDamage: 0 };

  const spec = WILDLIFE_SPECS[actor.species];
  actor.animPhase += dt * (actor.state === 'chase' || actor.state === 'flee' ? 6.5 : 3.2);
  actor.attackCooldown = Math.max(0, actor.attackCooldown - dt);
  actor.hitFlashTimer = Math.max(0, actor.hitFlashTimer - dt);

  const dx = playerX - actor.x;
  const dz = playerZ - actor.z;
  const distToPlayer = Math.hypot(dx, dz);
  const distFromHome = Math.hypot(actor.x - actor.homeX, actor.z - actor.homeZ);

  let nextState: WildlifeBehaviorState = actor.state;

  // Injured flee threshold when below 25% HP (except crocodiles/bears which stand ground longer)
  if (actor.hp < actor.maxHp * 0.24 && actor.species !== 'bear' && actor.species !== 'crocodile') {
    nextState = 'injured_flee';
  } else if (actor.domain === 'island' && playerInIslandMode) {
    if (actor.aggression === 'passive') {
      nextState = distToPlayer < 13 ? 'flee' : 'patrol';
    } else if (distFromHome > spec.pursuitLimit && nextState === 'chase') {
      nextState = 'patrol';
    } else if (distToPlayer < 2.2) {
      nextState = 'attack';
    } else if (distToPlayer < (actor.aggression === 'hostile' ? 16 : 11)) {
      nextState = 'chase';
    } else if (distToPlayer < 20 && actor.aggression === 'territorial') {
      nextState = 'cautious';
    } else {
      nextState = 'patrol';
    }
  } else if (actor.domain === 'ocean') {
    // Fishable sea creatures stay calmly circling near their shoal/reef so captains can sail up and fish them!
    if (actor.aggression !== 'passive' && playerInIslandMode && distToPlayer < 18) {
      nextState = distToPlayer < 2.6 ? 'attack' : 'chase';
    } else {
      nextState = 'patrol';
    }
  } else {
    nextState = 'patrol';
  }

  actor.state = nextState;
  let attackedPlayerDamage = 0;

  if (nextState === 'flee' || nextState === 'injured_flee') {
    const away = Math.atan2(-dx, -dz);
    actor.heading = away;
    actor.speed = spec.maxSpeed;
  } else if (nextState === 'chase') {
    actor.heading = Math.atan2(dx, dz);
    actor.speed = spec.maxSpeed;
  } else if (nextState === 'attack') {
    actor.heading = Math.atan2(dx, dz);
    actor.speed = spec.maxSpeed * 0.25;
    if (actor.attackCooldown <= 0 && distToPlayer < 2.75) {
      attackedPlayerDamage = spec.damage;
      actor.attackCooldown = 1.25;
    }
  } else if (nextState === 'cautious') {
    actor.heading = Math.atan2(dx, dz) + Math.PI * 0.42;
    actor.speed = spec.maxSpeed * 0.4;
  } else if (actor.species === 'ocean_flock_bird') {
    // Wheeling V-flock patrol over open water
    if (distFromHome > 135) {
      actor.heading = Math.atan2(actor.homeX - actor.x, actor.homeZ - actor.z);
    } else {
      actor.heading += 0.16 * dt;
    }
    actor.speed = spec.maxSpeed * 0.72;
  } else {
    // Gentle patrol loop around home coordinate (tighter for reef & shoal marine wildlife)
    const roamRadius = actor.domain === 'ocean' ? 24 : 18;
    if (distFromHome > roamRadius) {
      actor.heading = Math.atan2(actor.homeX - actor.x, actor.homeZ - actor.z);
    } else {
      actor.heading += Math.sin(actor.animPhase * 0.35) * 0.9 * dt;
    }
    actor.speed = spec.maxSpeed * 0.42;
  }

  actor.x += Math.sin(actor.heading) * actor.speed * dt;
  actor.z += Math.cos(actor.heading) * actor.speed * dt;

  return { attackedPlayerDamage };
}

export function damageWildlifeActor(
  actor: WildlifeActorData,
  damage: number
): { killed: boolean; remainingHp: number } {
  if (actor.killable === false) return { killed: false, remainingHp: actor.hp };
  if (actor.dead) return { killed: false, remainingHp: 0 };
  actor.hp = Math.max(0, actor.hp - Math.max(0, damage));
  actor.hitFlashTimer = 0.25;
  if (actor.hp <= 0) {
    actor.dead = true;
    actor.speed = 0;
    actor.vy = actor.domain === 'air' ? -1.5 : 0;
    return { killed: true, remainingHp: 0 };
  }
  return { killed: false, remainingHp: actor.hp };
}

export function harvestWildlifeActor(
  actor: WildlifeActorData,
  inventory: Inventory
): { harvested: boolean; foodAdded: number; hidesAdded: number; clothAdded: number; saltAdded: number } {
  if (!actor.dead || actor.harvested) {
    return { harvested: false, foodAdded: 0, hidesAdded: 0, clothAdded: 0, saltAdded: 0 };
  }
  actor.harvested = true;
  const clothDrop = Math.max(1, actor.lootCloth || 1);
  const saltDrop = Math.max(1, actor.lootSalt ?? WILDLIFE_SPECS[actor.species]?.saltMin ?? 1);
  inventory.food = (inventory.food || 0) + actor.lootFood;
  inventory.animalHides = (inventory.animalHides || 0) + actor.lootHides;
  inventory.cloth = (inventory.cloth || 0) + clothDrop;
  inventory.salt = (inventory.salt || 0) + saltDrop;
  return {
    harvested: true,
    foodAdded: actor.lootFood,
    hidesAdded: actor.lootHides,
    clothAdded: clothDrop,
    saltAdded: saltDrop,
  };
}

// =========================================================================
// ISLAND PIRATE CHEST GUARDS & EXPLORER DEATH RESOLUTION
// =========================================================================

const PIRATE_GUARD_NAMES = [
  'Red-Sash Barnaby',
  'Cutlass Mateo',
  'Flintlock Jago',
  'One-Ear Bram',
  'Salt-Tooth Vigo',
  'Black-Hat Corvin',
  'Powder-Keg Silas',
  'Reef-Blade Tamsin',
];

export function createIslandPirateGuard(
  id: string,
  islandId: string,
  chestId: string,
  role: IslandPirateGuardRole,
  x: number,
  y: number,
  z: number,
  rand: () => number
): IslandPirateGuardData {
  const isPistol = role === 'pistol';
  const name = PIRATE_GUARD_NAMES[Math.floor(rand() * PIRATE_GUARD_NAMES.length)];
  const maxHp = isPistol ? 62 : 84;
  return {
    id,
    name: `${name} (${isPistol ? 'Corsair Pistolier' : 'Buccaneer'})`,
    islandId,
    chestId,
    role,
    x,
    y,
    z,
    homeX: x,
    homeZ: z,
    heading: rand() * Math.PI * 2,
    speed: 0,
    maxSpeed: isPistol ? 4.6 : 5.4,
    hp: maxHp,
    maxHp,
    damage: isPistol ? 18 : 14,
    range: isPistol ? 22 : 2.6,
    attackCooldown: 0.4 + rand() * 0.6,
    reloadTimer: isPistol ? 0.5 : 0,
    hitFlashTimer: 0,
    dead: false,
    looted: false,
    animPhase: rand() * Math.PI * 2,
    lootGold: 16 + Math.floor(rand() * 24),
    lootGunpowder: isPistol ? 2 + Math.floor(rand() * 3) : 1,
    lootLeadShot: isPistol ? 4 + Math.floor(rand() * 5) : 1 + Math.floor(rand() * 2),
  };
}

export function stepIslandPirateGuard(
  guard: IslandPirateGuardData,
  playerX: number,
  playerZ: number,
  playerBlocking: boolean,
  dt: number
): { meleeDamage: number; rangedShotDamage: number; rangedFired: boolean } {
  if (guard.dead) {
    return { meleeDamage: 0, rangedShotDamage: 0, rangedFired: false };
  }

  guard.animPhase += dt * (guard.speed > 1 ? 6.2 : 2.4);
  guard.attackCooldown = Math.max(0, guard.attackCooldown - dt);
  guard.reloadTimer = Math.max(0, guard.reloadTimer - dt);
  guard.hitFlashTimer = Math.max(0, guard.hitFlashTimer - dt);

  const dx = playerX - guard.x;
  const dz = playerZ - guard.z;
  const distToPlayer = Math.hypot(dx, dz);
  const distFromHome = Math.hypot(guard.x - guard.homeX, guard.z - guard.homeZ);

  let meleeDamage = 0;
  let rangedShotDamage = 0;
  let rangedFired = false;

  const aggroRadius = 26;
  const leashRadius = 38;

  if (distFromHome > leashRadius && distToPlayer > 8) {
    // Return to guard chest post
    guard.heading = Math.atan2(guard.homeX - guard.x, guard.homeZ - guard.z);
    guard.speed = guard.maxSpeed * 0.85;
    guard.x += Math.sin(guard.heading) * guard.speed * dt;
    guard.z += Math.cos(guard.heading) * guard.speed * dt;
    return { meleeDamage: 0, rangedShotDamage: 0, rangedFired: false };
  }

  if (distToPlayer <= aggroRadius) {
    guard.heading = Math.atan2(dx, dz);

    if (guard.role === 'cutlass') {
      if (distToPlayer > 2.15) {
        guard.speed = guard.maxSpeed;
        guard.x += Math.sin(guard.heading) * guard.speed * dt;
        guard.z += Math.cos(guard.heading) * guard.speed * dt;
      } else {
        guard.speed = 0;
        if (guard.attackCooldown <= 0) {
          guard.attackCooldown = 1.15;
          meleeDamage = playerBlocking ? Math.max(3, Math.round(guard.damage * 0.35)) : guard.damage;
        }
      }
    } else {
      // Flintlock Corsair: hold 9..17m firing stance, backpedal if rushed, fire flintlock on reload
      if (distToPlayer > 17) {
        guard.speed = guard.maxSpeed;
        guard.x += Math.sin(guard.heading) * guard.speed * dt;
        guard.z += Math.cos(guard.heading) * guard.speed * dt;
      } else if (distToPlayer < 7.5 && distFromHome < leashRadius * 0.8) {
        guard.speed = guard.maxSpeed * 0.72;
        guard.x -= Math.sin(guard.heading) * guard.speed * dt;
        guard.z -= Math.cos(guard.heading) * guard.speed * dt;
      } else {
        guard.speed = 0;
      }

      if (distToPlayer <= guard.range && guard.reloadTimer <= 0 && guard.attackCooldown <= 0) {
        rangedFired = true;
        guard.reloadTimer = 2.6;
        guard.attackCooldown = 0.8;
        rangedShotDamage = playerBlocking ? Math.max(5, Math.round(guard.damage * 0.5)) : guard.damage;
      }
    }
  } else {
    // Sentry pace around the chest
    if (distFromHome > 7.5) {
      guard.heading = Math.atan2(guard.homeX - guard.x, guard.homeZ - guard.z);
      guard.speed = guard.maxSpeed * 0.45;
    } else {
      guard.heading += Math.sin(guard.animPhase * 0.4) * 0.7 * dt;
      guard.speed = guard.maxSpeed * 0.25;
    }
    guard.x += Math.sin(guard.heading) * guard.speed * dt;
    guard.z += Math.cos(guard.heading) * guard.speed * dt;
  }

  return { meleeDamage, rangedShotDamage, rangedFired };
}

export function damageIslandPirateGuard(
  guard: IslandPirateGuardData,
  damage: number
): { killed: boolean; remainingHp: number } {
  if (guard.dead) return { killed: false, remainingHp: 0 };
  guard.hp = Math.max(0, guard.hp - Math.max(0, damage));
  guard.hitFlashTimer = 0.28;
  if (guard.hp <= 0) {
    guard.dead = true;
    guard.speed = 0;
    return { killed: true, remainingHp: 0 };
  }
  return { killed: false, remainingHp: guard.hp };
}

export function lootIslandPirateGuard(
  guard: IslandPirateGuardData,
  save: SaveData
): { looted: boolean; goldAdded: number; gunpowderAdded: number; leadShotAdded: number } {
  if (!guard.dead || guard.looted) {
    return { looted: false, goldAdded: 0, gunpowderAdded: 0, leadShotAdded: 0 };
  }
  guard.looted = true;
  save.player.gold += guard.lootGold;
  save.stats.peakGold = Math.max(save.stats.peakGold, save.player.gold);
  save.player.inventory.gunpowder = (save.player.inventory.gunpowder || 0) + guard.lootGunpowder;
  save.player.inventory.leadShot = (save.player.inventory.leadShot || 0) + guard.lootLeadShot;
  return {
    looted: true,
    goldAdded: guard.lootGold,
    gunpowderAdded: guard.lootGunpowder,
    leadShotAdded: guard.lootLeadShot,
  };
}

export function isDiscoveryChestGuarded(
  disc: IslandDiscoveryData,
  pirateGuards: Iterable<IslandPirateGuardData>
): { guarded: boolean; remainingCount: number } {
  if (!disc.guardedByPirateIds || disc.guardedByPirateIds.length === 0) {
    return { guarded: false, remainingCount: 0 };
  }
  const idSet = new Set(disc.guardedByPirateIds);
  let alive = 0;
  for (const g of pirateGuards) {
    if (!g.dead && (idSet.has(g.id) || g.chestId === disc.id)) {
      alive++;
    }
  }
  return { guarded: alive > 0, remainingCount: alive };
}

/**
 * Resolves explorer death during first-person island exploration:
 * loses one crew member (lowest-XP sailor first), returns control to the ship,
 * and reports "Your explorer died" clearly.
 */
export function resolveExplorerDeath(save: SaveData): {
  lostCrewName: string | null;
  remainingCrew: number;
  message: string;
} {
  let lostCrewName: string | null = null;
  if (save.player.crew.length > 0) {
    let victimIdx = 0;
    let lowestScore = Infinity;
    for (let i = 0; i < save.player.crew.length; i++) {
      const c = save.player.crew[i];
      const score = (c.xp || 0) + (c.role === 'helmsman' || c.role === 'repair' ? 200 : 0);
      if (score < lowestScore) {
        lowestScore = score;
        victimIdx = i;
      }
    }
    const [fallen] = save.player.crew.splice(victimIdx, 1);
    lostCrewName = fallen?.name ?? null;
    for (const c of save.player.crew) {
      c.morale = Math.max(15, c.morale - 6);
    }
  }

  const remainingCrew = save.player.crew.length;
  const message = lostCrewName
    ? `Your explorer died ashore! ${lostCrewName} fell in the expedition (${remainingCrew} crew remaining). Control returned to ${save.player.shipName}.`
    : `Your explorer died ashore! Control returned to ${save.player.shipName}.`;

  return { lostCrewName, remainingCrew, message };
}

export interface FpsMouseInputState {
  lastX: number;
  lastY: number;
  skipEvents: number;
}

/**
 * Pure FPS mouse delta processor:
 * - Drops initial events immediately following pointer-lock transitions or window re-entry.
 * - Filters synthetic browser pointer-warp spikes (>140px locked / >160px unlocked) so clicks,
 *   pointer-lock engages, and cursor edge crossings never snap the FPS camera.
 */
export function stepFpsMouseDelta(
  state: FpsMouseInputState,
  params: {
    locked: boolean;
    clientX: number;
    clientY: number;
    movementX: number;
    movementY: number;
  }
): { dx: number; dy: number; nextState: FpsMouseInputState } {
  const nextBase: FpsMouseInputState = {
    lastX: params.clientX,
    lastY: params.clientY,
    skipEvents: state.skipEvents,
  };
  if (state.skipEvents > 0) {
    return {
      dx: 0,
      dy: 0,
      nextState: { ...nextBase, skipEvents: state.skipEvents - 1 },
    };
  }

  let rawDx = 0;
  let rawDy = 0;
  if (params.locked) {
    rawDx = params.movementX;
    rawDy = params.movementY;
    if (Math.abs(rawDx) > 140 || Math.abs(rawDy) > 140) {
      return { dx: 0, dy: 0, nextState: nextBase };
    }
  } else {
    if (state.lastX < 0 || state.lastY < 0) {
      return { dx: 0, dy: 0, nextState: nextBase };
    }
    rawDx = params.clientX - state.lastX;
    rawDy = params.clientY - state.lastY;
    if (Math.abs(rawDx) > 160 || Math.abs(rawDy) > 160) {
      return { dx: 0, dy: 0, nextState: nextBase };
    }
  }

  const dx = Math.max(-80, Math.min(80, rawDx));
  const dy = Math.max(-80, Math.min(80, rawDy));
  return { dx, dy, nextState: nextBase };
}

