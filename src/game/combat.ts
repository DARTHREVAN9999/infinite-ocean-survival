import {
  CombatCommand,
  CombatTarget,
  CrewMember,
  FireMode,
  GhostSizeTier,
  Inventory,
  PirateDemand,
  PirateFactionId,
  PirateRank,
  PirateShipData,
  PirateTier,
  RepairPriority,
  ShipCondition,
  ShipUpgrades,
  VesselClass,
  WreckSurvivor,
} from './types';
import { getEffectiveWeaponStats } from './economy';
import { clamp, normalizeAngle } from './waveMath';
import { createRandomCrewMember } from './survival';
import { PIRATE_FACTIONS, PIRATE_FACTION_IDS, PIRATE_RANK_TITLES } from './factions';

const PIRATE_NAMES: Record<PirateTier, string[]> = {
  sloop: ['The Sea Viper', 'Black Gull', 'Ragged Crow', 'Salt Fang', 'Cutthroat Kestrel'],
  brigantine: ['Blood Meridian', 'Red Cutlass', 'The Iron Corsair', 'Banshee Wake', 'Black Brigand'],
  galleon: ['Sovereign Scourge', 'The Black Armada', 'Dread Leviathan', 'Gilded Reaper', 'Sea Tyrant'],
  dreadnought: ['The Abyssal Crown', 'Kraken’s Wrath', 'Emperor of Ash', 'Black Sovereign'],
};

const CAPTAIN_NAMES = [
  'Capt. Blackthorne',
  'Capt. Vane',
  'Capt. Morgana Red',
  'Capt. Silas Flint',
  'Capt. Ironjaw Rook',
  'Capt. Marlowe',
  'Capt. Calico Briggs',
  'Capt. Corvus',
  'Capt. Graves',
  'Capt. Aurelia',
];

const ARCHETYPE_BY_TIER: Record<PirateTier, VesselClass[]> = {
  sloop: ['small_merchant', 'fishing_trawler', 'crown_patrol'],
  brigantine: ['medium_merchant', 'supply_ship', 'crown_corvette'],
  galleon: ['large_cargo', 'passenger_ship', 'crown_frigate'],
  dreadnought: ['wealthy_trader', 'treasure_ship', 'crown_warship'],
};

export const PIRATE_CLASS_BY_TIER: Record<PirateTier, string[]> = {
  sloop: ['Pirate Raider Boat', 'Corsair Sloop'],
  brigantine: ['Pirate Brigantine', 'Pirate Supply Ship'],
  galleon: ['Pirate Frigate', 'Pirate Galleon'],
  dreadnought: ['Pirate Flagship', 'Pirate War Galleon'],
};

export interface PirateGenOptions {
  factionId?: PirateFactionId;
  rank?: PirateRank;
  isBoss?: boolean;
  isFlagship?: boolean;
  fleetId?: string;
  escortTargetId?: string;
  hullArchetype?: VesselClass;
  shipClassLabel?: string;
  customName?: string;
  customCaptain?: string;
}

export function generatePirateShip(
  id: string,
  x: number,
  z: number,
  tier: PirateTier,
  rand: () => number,
  options: PirateGenOptions = {}
): PirateShipData {
  const specs = {
    sloop: {
      maxHull: 88,
      cannons: 2,
      crew: [5, 10],
      gold: [12, 52],
      speed: 7.4,
      turn: 0.92,
      range: 108,
      reload: 4.8,
      dmg: 8,
      defaultRank: 1 as PirateRank,
    },
    brigantine: {
      maxHull: 180,
      cannons: 6,
      crew: [14, 26],
      gold: [55, 210],
      speed: 6.7,
      turn: 0.72,
      range: 138,
      reload: 5.2,
      dmg: 12,
      defaultRank: 2 as PirateRank,
    },
    galleon: {
      maxHull: 330,
      cannons: 10,
      crew: [28, 46],
      gold: [160, 590],
      speed: 5.8,
      turn: 0.54,
      range: 158,
      reload: 5.8,
      dmg: 16,
      defaultRank: 4 as PirateRank,
    },
    dreadnought: {
      maxHull: 560,
      cannons: 18,
      crew: [50, 78],
      gold: [620, 2400],
      speed: 5.2,
      turn: 0.42,
      range: 192,
      reload: 6.0,
      dmg: 22,
      defaultRank: 5 as PirateRank,
    },
  }[tier];

  const factionId =
    options.factionId ?? PIRATE_FACTION_IDS[Math.floor(rand() * PIRATE_FACTION_IDS.length)];
  const factionMeta = PIRATE_FACTIONS[factionId] || PIRATE_FACTIONS.crimson_corsairs;
  const isBoss = Boolean(options.isBoss);
  const isFlagship = Boolean(options.isFlagship || isBoss);
  const rank: PirateRank =
    options.rank ?? (isBoss ? (rand() < 0.45 ? 6 : 5) : tier === 'brigantine' && rand() < 0.35 ? 3 : specs.defaultRank);

  const rankMult = 1 + (rank - 1) * 0.14 + (isBoss ? 0.32 : 0);
  const maxHull = Math.round(specs.maxHull * rankMult);
  const crewCount = Math.round((specs.crew[0] + rand() * (specs.crew[1] - specs.crew[0])) * (isBoss ? 1.35 : 1));
  const cannons = Math.min(28, Math.round(specs.cannons * (isBoss ? 1.35 : 1)));
  const gold =
    rand() < 0.08 && tier === 'sloop' && !isBoss
      ? 0
      : Math.round((specs.gold[0] + rand() * (specs.gold[1] - specs.gold[0])) * rankMult);

  const loot: Partial<Inventory> = {
    wood: 4 + Math.floor(rand() * 12),
    food: 4 + Math.floor(rand() * 10),
    water: 4 + Math.floor(rand() * 10),
    gunpowder: 4 + Math.floor(rand() * (tier === 'sloop' ? 6 : 16)),
    cannonballs: 5 + Math.floor(rand() * (tier === 'sloop' ? 8 : 20)),
  };
  if (tier !== 'sloop') {
    loot.iron = 4 + Math.floor(rand() * 10);
    loot.cargo = 1 + Math.floor(rand() * 3);
    if (rand() < 0.45) loot.rareSpices = 1 + Math.floor(rand() * 2);
    if (rand() < 0.35) loot.silk = 1 + Math.floor(rand() * 2);
  }
  if (tier === 'galleon' || tier === 'dreadnought' || isBoss) {
    loot.rareMaterials = 2 + Math.floor(rand() * 5);
    loot.advancedTimber = 2 + Math.floor(rand() * 5);
    loot.reinforcedMetals = 2 + Math.floor(rand() * 4);
    loot.medicine = 2 + Math.floor(rand() * 4);
    loot.jewellery = 1 + Math.floor(rand() * 3);
    if (rand() < 0.5) loot.paintings = 1 + Math.floor(rand() * 2);
    if (isBoss) {
      loot.decorativeMaterials = 2 + Math.floor(rand() * 4);
      loot.antiques = 1 + Math.floor(rand() * 2);
    }
  }

  const names = PIRATE_NAMES[tier];
  const archetypes = ARCHETYPE_BY_TIER[tier];
  const hullArchetype =
    options.hullArchetype ?? archetypes[Math.floor(rand() * archetypes.length)];
  const classList = PIRATE_CLASS_BY_TIER[tier];
  const shipClassLabel =
    options.shipClassLabel ??
    (isBoss ? 'Faction Flagship' : classList[Math.floor(rand() * classList.length)]);

  const demandRoll = rand();
  let demand: PirateDemand;
  if (demandRoll < 0.42) {
    const amt = Math.round((tier === 'sloop' ? 28 : tier === 'brigantine' ? 75 : tier === 'galleon' ? 160 : 320) * (isBoss ? 1.5 : 1));
    demand = {
      demandType: 'gold',
      amount: amt,
      message: `Heave to under the colors of ${factionMeta.shortName}! Pay ${amt} gold coin or taste iron!`,
    };
  } else if (demandRoll < 0.7) {
    const amt = tier === 'sloop' ? 8 : 18;
    demand = {
      demandType: 'food',
      amount: amt,
      message: `${factionMeta.shortName} claim sea toll! Toss ${amt} crates of Provisions overside now!`,
    };
  } else if (demandRoll < 0.86) {
    const amt = tier === 'sloop' ? 8 : 18;
    demand = {
      demandType: 'water',
      amount: amt,
      message: `Drop ${amt} casks of Fresh Water overside for ${factionMeta.shortName} and sail on.`,
    };
  } else {
    const amt = tier === 'sloop' ? 1 : 2;
    demand = {
      demandType: 'cargo',
      amount: amt,
      message: `We smell rich cargo aboard! Yield ${amt} Valuable Cargo crate(s) or prepare for broadsides!`,
    };
  }

  let survivor: WreckSurvivor | undefined;
  if (rand() < 0.74) {
    const s = createRandomCrewMember(`pir_surv_${id}`, rand);
    survivor = {
      id: s.id,
      name: s.name,
      skills: s.skills,
      disposition: 'eager',
      demandAmount: 0,
      resolved: false,
      infoText: `“Spare me from the deep, Captain! I served beneath ${factionMeta.shortName} and know the great guns.”`,
    };
  }

  const shipName =
    options.customName ??
    (rank === 6 ? factionMeta.flagshipName : names[Math.floor(rand() * names.length)]);
  const captainName =
    options.customCaptain ??
    (rank === 6 ? factionMeta.leaderName : CAPTAIN_NAMES[Math.floor(rand() * CAPTAIN_NAMES.length)]);

  return {
    id,
    name: shipName,
    captainName,
    factionId,
    rank,
    rankTitle: PIRATE_RANK_TITLES[rank],
    shipClassLabel,
    isBoss,
    isFlagship,
    fleetId: options.fleetId,
    escortTargetId: options.escortTargetId,
    hullArchetype,
    personality: factionMeta.personality,
    tier,
    x,
    z,
    heading: rand() * Math.PI * 2,
    speed: specs.speed * 0.65,
    maxSpeed: specs.speed,
    turnRate: specs.turn,
    patrolCenterX: x,
    patrolCenterZ: z,
    patrolAngle: rand() * Math.PI * 2,
    behavior: options.escortTargetId ? 'escort' : 'patrol',
    hull: maxHull,
    maxHull,
    sails: 100,
    steering: 100,
    cannons,
    maxCannons: cannons,
    crewCount,
    maxCrew: crewCount,
    gold,
    loot,
    reloadTimer: specs.reload * 0.5,
    reloadTime: Math.max(3.6, specs.reload - (rank - 1) * 0.2),
    fireRange: specs.range,
    damagePerCannon: Math.round(specs.dmg * (1 + (rank - 1) * 0.12)),
    hailCooldown: 0,
    hailed: false,
    defeated: false,
    salvageable: false,
    captured: false,
    looted: false,
    discovered: false,
    sinkProgress: 0,
    targetShipId: null,
    survivor,
    demand,
  };
}

const GHOST_SHIP_NAMES: Record<GhostSizeTier, string[]> = {
  small: ['Pale Drift', 'Wisp Sloop', 'Mist Skiff', 'Hollow Gull'],
  medium: ['The Pale Dutchman', 'HMS Wraithborne', 'Cursed Albatross', 'Spectral Finch'],
  large: ['Sorrow of the Abyss', 'Phantom Mourner', 'Spectral Sovereign', 'Black Rime'],
  enormous: ['Dread Specter', 'Abyssal Gargantua', 'Emperor of Mist', 'Cathedral of Salt'],
  colossal: ['The Eternal Leviathan', 'Sovereign of Sunken Souls', 'Colossal Dutchman Rex'],
};

const GHOST_CAPTAIN_NAMES = [
  'Spectral Capt. Vaelen',
  'The Hollow Helmsman',
  'Drowned Admiral Thane',
  'Wraith Captain Vey',
  'Lord of the Pale Fog',
];

const GHOST_RELIC_NAMES = [
  'Spectral Lantern',
  'Whispering Compass',
  'Phantom Figurehead',
  'Ancient Ghost Relic',
];

export function pickGhostSizeForDistance(distFromOrigin: number, rand: () => number): GhostSizeTier {
  const r = rand();
  if (distFromOrigin < 1500) {
    // Mostly small & medium; occasional large/enormous, NEVER colossal near inner ocean
    if (r < 0.44) return 'small';
    if (r < 0.80) return 'medium';
    if (r < 0.94) return 'large';
    return 'enormous';
  }
  // Deep sea allows rare Colossal Legendary Ghost Ships alongside smaller phantoms
  if (r < 0.34) return 'small';
  if (r < 0.68) return 'medium';
  if (r < 0.84) return 'large';
  if (r < 0.94) return 'enormous';
  return 'colossal';
}

export function generateGhostShip(
  id: string,
  x: number,
  z: number,
  rand: () => number,
  forcedSize?: GhostSizeTier
): PirateShipData {
  const distFromOrigin = Math.hypot(x, z);
  const ghostSize: GhostSizeTier = forcedSize ?? pickGhostSizeForDistance(distFromOrigin, rand);

  const tierMap: Record<GhostSizeTier, PirateTier> = {
    small: 'sloop',
    medium: 'brigantine',
    large: 'galleon',
    enormous: 'dreadnought',
    colossal: 'dreadnought',
  };
  const tier = tierMap[ghostSize];

  const cfg = {
    small: { hull: 210, cannons: 5, crew: 12, dmg: 13, range: 135, reload: 4.5, gold: [120, 260], speed: 6.8, rankLabel: 'Small Spectral Vessel' },
    medium: { hull: 410, cannons: 9, crew: 24, dmg: 17, range: 158, reload: 4.6, gold: [280, 680], speed: 6.2, rankLabel: 'Medium Ghost Vessel' },
    large: { hull: 760, cannons: 14, crew: 42, dmg: 22, range: 185, reload: 4.9, gold: [720, 1750], speed: 5.5, rankLabel: 'Large Phantom Warship' },
    enormous: { hull: 1380, cannons: 22, crew: 68, dmg: 28, range: 215, reload: 5.0, gold: [1500, 3400], speed: 5.0, rankLabel: 'Enormous Spectral Citadel' },
    colossal: { hull: 2350, cannons: 30, crew: 96, dmg: 35, range: 245, reload: 4.7, gold: [2200, 5200], speed: 4.7, rankLabel: 'Colossal Legendary Ghost Ship' },
  }[ghostSize];

  const base = generatePirateShip(id, x, z, tier, rand, {
    factionId: 'abyssal_fleet',
    rank: ghostSize === 'colossal' || ghostSize === 'enormous' ? 6 : 5,
    isBoss: false,
    isFlagship: ghostSize !== 'small',
    hullArchetype:
      ghostSize === 'small'
        ? 'small_merchant'
        : ghostSize === 'medium'
          ? 'crown_corvette'
          : ghostSize === 'large'
            ? 'crown_frigate'
            : 'crown_ship_of_line',
    shipClassLabel: cfg.rankLabel,
    customName: GHOST_SHIP_NAMES[ghostSize][Math.floor(rand() * GHOST_SHIP_NAMES[ghostSize].length)],
    customCaptain: GHOST_CAPTAIN_NAMES[Math.floor(rand() * GHOST_CAPTAIN_NAMES.length)],
  });

  return {
    ...base,
    isGhost: true,
    ghostSize,
    ghostAbilityTimer: 4 + rand() * 5,
    ghostStealthTimer: 0,
    ghostCollectible: GHOST_RELIC_NAMES[Math.floor(rand() * GHOST_RELIC_NAMES.length)],
    rankTitle: cfg.rankLabel,
    hull: cfg.hull,
    maxHull: cfg.hull,
    cannons: cfg.cannons,
    maxCannons: cfg.cannons,
    crewCount: cfg.crew,
    maxCrew: cfg.crew,
    maxSpeed: cfg.speed,
    fireRange: cfg.range,
    reloadTime: cfg.reload,
    damagePerCannon: cfg.dmg,
    gold: Math.round(cfg.gold[0] + rand() * (cfg.gold[1] - cfg.gold[0])),
    loot: {
      rareMaterials: ghostSize === 'small' ? 2 : ghostSize === 'medium' ? 4 : ghostSize === 'large' ? 7 : 11,
      decorativeMaterials: ghostSize === 'small' ? 1 : ghostSize === 'medium' ? 3 : 6,
      advancedTimber: ghostSize === 'small' ? 2 : 5,
      reinforcedMetals: ghostSize === 'small' ? 2 : 6,
      jewellery: ghostSize === 'colossal' || ghostSize === 'enormous' ? 4 : 2,
      antiques: ghostSize === 'colossal' ? 4 : 2,
      medicine: 3,
    },
    survivor: undefined,
    demand: {
      demandType: 'gold',
      amount: 9999,
      message: 'Freezing pale mist swallows your bow... the cursed ghost vessel opens every spectral port!',
    },
  };
}

export function rollEnemySalvageable(isGhost: boolean | undefined, rand: () => number): boolean {
  if (isGhost) return false;
  return rand() < 0.5;
}

export interface AutoCombatStats {
  effectiveCannons: number;
  reloadTime: number;
  accuracyBonus: number;
  damageTakenMult: number;
  speedBonusMult: number;
  fireRange: number;
}

export function computeAutoCombatStats(
  upgrades: ShipUpgrades,
  crew: CrewMember[],
  _command: CombatCommand = 'attack'
): AutoCombatStats {
  const effSpec = getEffectiveWeaponStats(upgrades);
  const aliveCrew = crew.filter((c) => c.health > 0);
  const effectiveSailors = aliveCrew.reduce(
    (sum, c) => sum + (c.condition === 'injured' || c.health < 25 ? 0.45 : 1.0),
    0
  );

  const crewGunCap = Math.max(1, Math.floor(effectiveSailors * 0.9));
  const effectiveCannons =
    upgrades.cannonCount > 0 && upgrades.weaponType !== 'none'
      ? Math.min(upgrades.cannonCount, crewGunCap)
      : 0;

  const cannoneers = aliveCrew.filter((c) => c.role === 'cannoneer');
  const gunCohort = cannoneers.length > 0 ? cannoneers : aliveCrew;
  const avgCombat =
    gunCohort.length > 0
      ? gunCohort.reduce((s, c) => s + c.skills.combat, 0) / gunCohort.length
      : 3;

  const skillSpeedMult = clamp(0.86 + avgCombat * 0.045, 0.85, 1.35);
  const accuracyBonus = clamp(0.92 + avgCombat * 0.025, 0.9, 1.24);
  const reloadTime = effSpec.reloadTime / skillSpeedMult;

  return {
    effectiveCannons,
    reloadTime,
    accuracyBonus,
    damageTakenMult: 1.0,
    speedBonusMult: 1.0,
    fireRange: effSpec.range,
  };
}

export interface PlayerVolleyResult {
  fired: boolean;
  reason?: string;
  shotsFired: number;
  hits: number;
  powderUsed: number;
  ballsUsed: number;
  hullDamage: number;
  sailDamage: number;
  cannonDestroyed: number;
  steeringDamage: number;
  crewCasualties: number;
  hitLocation: RepairPriority;
  isCritical: boolean;
  enemyDefeated: boolean;
  summary: string;
}

const HIT_LOCATIONS: RepairPriority[] = ['hull', 'hull', 'deck', 'sails', 'cannons', 'mast', 'steering'];

export function resolvePlayerVolley(
  upgrades: ShipUpgrades,
  condition: ShipCondition,
  inventory: Inventory,
  cannonCrewEfficiency: number,
  targetMode: CombatTarget,
  fireMode: FireMode,
  distance: number,
  targetShip: { name: string; hull: number; crewCount: number },
  rand: () => number,
  effectiveCannonsOverride?: number
): PlayerVolleyResult {
  void targetMode;
  if (fireMode === 'hold') {
    return emptyVolley('Holding fire.');
  }
  if (upgrades.cannonCount <= 0 || upgrades.weaponType === 'none') {
    return emptyVolley('No cannons mounted on your vessel!');
  }
  const effSpec = getEffectiveWeaponStats(upgrades);
  if (distance > effSpec.range) {
    return emptyVolley(`Closing to firing range (${Math.round(distance)}m / ${effSpec.range}m).`);
  }

  const cannonHealthFactor = clamp(0.45 + (condition.cannons / 100) * 0.55, 0.45, 1.0);
  const workingCannons = Math.max(1, effectiveCannonsOverride ?? upgrades.cannonCount);
  const shotsFired = fireMode === 'focused' ? Math.max(1, Math.ceil(workingCannons * 0.6)) : workingCannons;

  const ammoAvailable = Math.min(inventory.gunpowder || 0, inventory.cannonballs || 0);
  const ammoUsed = Math.min(shotsFired, ammoAvailable);
  const outOfAmmoPenalty = ammoAvailable <= 0 ? 0.55 : 1.0;

  const rangeFactor = clamp(1.12 - (distance / effSpec.range) * 0.36, 0.42, 1.0);
  const hitChance = clamp(
    effSpec.accuracy * rangeFactor * clamp(cannonCrewEfficiency, 0.7, 1.38),
    0.26,
    0.95
  );

  let hits = 0;
  for (let i = 0; i < shotsFired; i++) {
    if (rand() < hitChance) hits++;
  }

  const hitLocation = HIT_LOCATIONS[Math.floor(rand() * HIT_LOCATIONS.length)];
  const isCritical = hits > 0 && rand() < 0.22;

  let hullDamage = 0;
  let crewCasualties = 0;
  let sailDamage = 0;
  let cannonDestroyed = 0;
  if (hits > 0) {
    const critMult = isCritical ? 1.55 : 1.0;
    const baseDmg = hits * effSpec.damage * outOfAmmoPenalty * cannonHealthFactor * critMult * (0.9 + rand() * 0.24);
    hullDamage = Math.max(1, Math.round(baseDmg * 1.1));
    crewCasualties = hits >= 2 && rand() < 0.48 ? Math.max(1, Math.floor(hits * 0.45)) : 0;
    if (hitLocation === 'sails') sailDamage = Math.round(hullDamage * 0.35);
    if (hitLocation === 'cannons' && rand() < 0.35) cannonDestroyed = 1;
  }

  const nextHull = Math.max(0, targetShip.hull - hullDamage);
  const enemyDefeated = nextHull <= 0;

  const summary =
    hits === 0
      ? `Your cannons fired ${shotsFired} shot(s) at ${targetShip.name} — water splashes wide!`
      : `${isCritical ? 'CRITICAL HIT — ' : ''}${targetShip.name} ${hitLocation.toUpperCase()} — ${hullDamage} damage!`;

  return {
    fired: true,
    shotsFired,
    hits,
    powderUsed: ammoUsed,
    ballsUsed: ammoUsed,
    hullDamage,
    sailDamage,
    cannonDestroyed,
    steeringDamage: 0,
    crewCasualties,
    hitLocation,
    isCritical,
    enemyDefeated,
    summary,
  };
}

function emptyVolley(reason: string): PlayerVolleyResult {
  return {
    fired: false,
    reason,
    shotsFired: 0,
    hits: 0,
    powderUsed: 0,
    ballsUsed: 0,
    hullDamage: 0,
    sailDamage: 0,
    cannonDestroyed: 0,
    steeringDamage: 0,
    crewCasualties: 0,
    hitLocation: 'hull',
    isCritical: false,
    enemyDefeated: false,
    summary: reason,
  };
}

export interface EnemyVolleyResult {
  hits: number;
  condition: ShipCondition;
  crew: CrewMember[];
  hitLocation: RepairPriority;
  damageTaken: number;
  isCritical: boolean;
  summary: string;
}

export function resolveEnemyVolley(
  attacker: { name: string; cannons: number; maxCannons: number; crewCount: number; maxCrew: number; fireRange: number; damagePerCannon: number },
  distance: number,
  playerCondition: ShipCondition,
  playerUpgrades: ShipUpgrades,
  playerCrew: CrewMember[],
  rand: () => number,
  damageTakenMult = 1.0
): EnemyVolleyResult {
  const crewCap = Math.max(1, Math.floor(attacker.crewCount * 0.65));
  const activeGuns = Math.max(1, Math.min(attacker.cannons, crewCap, Math.ceil(attacker.maxCannons * 0.55)));
  const rangeFactor = clamp(1.05 - distance / Math.max(60, attacker.fireRange * 1.15), 0.28, 0.9);
  const crewFactor = clamp(attacker.crewCount / Math.max(1, attacker.maxCrew), 0.35, 1.0);
  const hitChance = clamp(0.54 * rangeFactor * crewFactor, 0.16, 0.72);

  let hits = 0;
  for (let i = 0; i < activeGuns; i++) {
    if (rand() < hitChance) hits++;
  }

  const nextCond: ShipCondition = { ...playerCondition };
  const nextCrew: CrewMember[] = playerCrew.map((c) => ({ ...c }));

  if (hits === 0) {
    return {
      hits: 0,
      condition: nextCond,
      crew: nextCrew,
      hitLocation: 'hull',
      damageTaken: 0,
      isCritical: false,
      summary: `${attacker.name} fired a broadside — cannonballs splashed astern!`,
    };
  }

  const armorMit = [1.0, 0.84, 0.7, 0.56, 0.42][playerUpgrades.armorPlating] ?? 1.0;
  const reinfMit = [1.0, 0.94, 0.88, 0.82][playerUpgrades.reinforcementTier] ?? 1.0;
  const hullTierScale = [1, 1.0, 0.82, 0.66, 0.52, 0.42, 0.34, 0.28][playerUpgrades.hullTier] ?? 1.0;
  const hitLocation = HIT_LOCATIONS[Math.floor(rand() * HIT_LOCATIONS.length)];
  const isCritical = rand() < 0.18;
  const critMult = isCritical ? 1.45 : 1.0;

  const rawDmg =
    hits * attacker.damagePerCannon * armorMit * reinfMit * hullTierScale * damageTakenMult * critMult;

  const mainDmg = Math.max(1, Math.round(rawDmg * 0.7));
  nextCond.hull = Math.max(0, nextCond.hull - mainDmg);

  if (hitLocation !== 'hull') {
    const durMit = 1 - ((playerUpgrades.cannonUpgrades?.durabilityLvl || 1) - 1) * 0.12;
    const secDmg = Math.max(2, Math.round(mainDmg * 0.85 * (hitLocation === 'cannons' ? durMit : 1)));
    nextCond[hitLocation] = Math.max(10, nextCond[hitLocation] - secDmg);
  }
  nextCond.flooding = clamp(nextCond.flooding + mainDmg * 0.16, 0, 100);

  let injuredName = '';
  if (nextCrew.length > 0 && rand() < (0.24 + hits * 0.06) * damageTakenMult) {
    const victimIdx = Math.floor(rand() * nextCrew.length);
    const victim = nextCrew[victimIdx];
    const injuryDmg = Math.round((16 + rand() * 24) * damageTakenMult);
    victim.health = Math.max(0, victim.health - injuryDmg);
    victim.morale = Math.max(5, victim.morale - 10);
    victim.condition = 'injured';
    injuredName = victim.name;
  }

  const aliveCrew = nextCrew.filter((c) => c.health > 0);
  const banner = `${isCritical ? 'CRITICAL HIT' : 'PLAYER SHIP HIT'} — ${hitLocation.toUpperCase()} — ${mainDmg} DAMAGE${
    injuredName ? ` (${injuredName} WOUNDED)` : ''
  }`;

  return {
    hits,
    condition: nextCond,
    crew: aliveCrew,
    hitLocation,
    damageTaken: mainDmg,
    isCritical,
    summary: banner,
  };
}

export function resolveNpcVsNpcVolley(
  attackerCannons: number,
  attackerDamagePerCannon: number,
  targetHull: number,
  rand: () => number
): { hits: number; damage: number; nextHull: number; sunk: boolean } {
  const active = Math.max(1, Math.min(8, Math.ceil(attackerCannons * 0.5)));
  let hits = 0;
  for (let i = 0; i < active; i++) {
    if (rand() < 0.45) hits++;
  }
  const damage = hits > 0 ? Math.max(2, Math.round(hits * attackerDamagePerCannon * 0.65)) : 0;
  const nextHull = Math.max(0, targetHull - damage);
  return { hits, damage, nextHull, sunk: nextHull <= 0 };
}

export interface CollisionResolution {
  collided: boolean;
  nx: number;
  nz: number;
  pushAx: number;
  pushAz: number;
  pushBx: number;
  pushBz: number;
  impactSpeed: number;
  damageA: number;
  damageB: number;
}

export function resolveShipCollision(
  ax: number,
  az: number,
  aVx: number,
  aVz: number,
  aRadius: number,
  aMass: number,
  aMitigation: number,
  bx: number,
  bz: number,
  bVx: number,
  bVz: number,
  bRadius: number,
  bMass: number,
  bMitigation = 1.0
): CollisionResolution {
  const dx = ax - bx;
  const dz = az - bz;
  const dist = Math.hypot(dx, dz);
  const minDist = aRadius + bRadius;

  if (dist >= minDist) {
    return {
      collided: false,
      nx: 0,
      nz: 0,
      pushAx: 0,
      pushAz: 0,
      pushBx: 0,
      pushBz: 0,
      impactSpeed: 0,
      damageA: 0,
      damageB: 0,
    };
  }

  const nx = dist > 0.001 ? dx / dist : 0;
  const nz = dist > 0.001 ? dz / dist : 1;
  const overlap = minDist - dist + 0.35;

  const totalMass = Math.max(0.01, aMass + bMass);
  const shareA = bMass >= 999 ? 1 : bMass / totalMass;
  const shareB = bMass >= 999 ? 0 : aMass / totalMass;

  const rvx = aVx - bVx;
  const rvz = aVz - bVz;
  const relNormal = rvx * nx + rvz * nz;
  const impactSpeed = Math.max(0, -relNormal);

  let damageA = 0;
  let damageB = 0;
  if (impactSpeed > 1.6) {
    const baseImpact = (impactSpeed - 1.2) * 2.15;
    const massRatioA = bMass >= 999 ? 1.15 : clamp(bMass / Math.max(0.5, aMass), 0.45, 1.8);
    const massRatioB = bMass >= 999 ? 0 : clamp(aMass / Math.max(0.5, bMass), 0.55, 2.2);
    damageA = Math.max(2, Math.round(baseImpact * massRatioA * aMitigation));
    damageB = bMass >= 999 ? 0 : Math.max(3, Math.round(baseImpact * 2.4 * massRatioB * bMitigation));
  }

  return {
    collided: true,
    nx,
    nz,
    pushAx: nx * overlap * shareA || 0,
    pushAz: nz * overlap * shareA || 0,
    pushBx: -nx * overlap * shareB || 0,
    pushBz: -nz * overlap * shareB || 0,
    impactSpeed,
    damageA,
    damageB,
  };
}

export interface PirateAISteering {
  targetHeading: number;
  desiredSpeed: number;
  nextBehavior: PirateShipData['behavior'];
  wantsToFire: boolean;
}

export function computePirateAI(
  pirate: PirateShipData,
  playerX: number,
  playerZ: number,
  playerHullTier: number,
  inCombatWithPlayer: boolean,
  dt: number,
  playerVx = 0,
  playerVz = 0,
  isHunter = false,
  playerAlliedToFaction = false,
  escortAnchor?: { x: number; z: number } | null
): PirateAISteering {
  const dx = playerX - pirate.x;
  const dz = playerZ - pirate.z;
  const dist = Math.hypot(dx, dz) || 0.001;
  const angleToPlayer = Math.atan2(-dx, -dz);

  const leadTime = clamp(dist / 24, 0, 5.5);
  const aimX = playerX + playerVx * leadTime;
  const aimZ = playerZ + playerVz * leadTime;
  const interceptHeading = Math.atan2(-(aimX - pirate.x), -(aimZ - pirate.z));

  const sailMult = 0.35 + (pirate.sails / 100) * 0.65;
  const maxSpd = pirate.maxSpeed * sailMult;

  if (pirate.defeated) {
    return { targetHeading: pirate.heading, desiredSpeed: 0, nextBehavior: 'defeated', wantsToFire: false };
  }

  const hullRatio = pirate.hull / pirate.maxHull;
  if (inCombatWithPlayer && !pirate.isGhost && (hullRatio < 0.22 || pirate.cannons <= 0)) {
    const fleeHeading = normalizeAngle(angleToPlayer + Math.PI);
    return {
      targetHeading: fleeHeading,
      desiredSpeed: maxSpd,
      nextBehavior: 'retreat',
      wantsToFire: false,
    };
  }

  if (!inCombatWithPlayer) {
    if (!playerAlliedToFaction || pirate.isGhost) {
      const baseAggro = pirate.isGhost
        ? 440
        : pirate.tier === 'sloop'
          ? 340
          : pirate.tier === 'brigantine'
            ? 430
            : pirate.tier === 'galleon'
              ? 510
              : 580;
      const aggroRange = isHunter ? Math.max(baseAggro, 780) : baseAggro;
      const intimidated = !pirate.isGhost && pirate.tier === 'sloop' && playerHullTier >= 4 && !isHunter;
      if (dist < aggroRange && !intimidated && pirate.hailCooldown <= 0) {
        return {
          targetHeading: dist < 110 ? angleToPlayer : interceptHeading,
          desiredSpeed: maxSpd,
          nextBehavior: dist < 72 ? 'hailing' : 'pursue',
          wantsToFire: false,
        };
      }
    }

    if (escortAnchor) {
      const edx = escortAnchor.x - pirate.x;
      const edz = escortAnchor.z - pirate.z;
      const edist = Math.hypot(edx, edz);
      if (edist > 75) {
        return {
          targetHeading: Math.atan2(-edx, -edz),
          desiredSpeed: maxSpd * 0.85,
          nextBehavior: 'escort',
          wantsToFire: false,
        };
      }
    }

    const nextAngle = pirate.patrolAngle + dt * 0.14;
    const radius = 95;
    const tx = pirate.patrolCenterX + Math.cos(nextAngle) * radius;
    const tz = pirate.patrolCenterZ + Math.sin(nextAngle) * radius;
    const patrolHeading = Math.atan2(-(tx - pirate.x), -(tz - pirate.z));
    return {
      targetHeading: patrolHeading,
      desiredSpeed: maxSpd * 0.65,
      nextBehavior: 'patrol',
      wantsToFire: false,
    };
  }

  const optimalDist = pirate.fireRange * 0.66;
  const minSafeDist = pirate.isGhost && (pirate.ghostSize === 'colossal' || pirate.ghostSize === 'enormous') ? 54 : 36;

  if (dist < minSafeDist) {
    const veerHeading = normalizeAngle(angleToPlayer + Math.PI * 0.72);
    return {
      targetHeading: veerHeading,
      desiredSpeed: maxSpd * 0.9,
      nextBehavior: 'flank',
      wantsToFire: dist < pirate.fireRange,
    };
  }

  if (dist > optimalDist * 1.25) {
    const flankOffset = pirate.tier === 'sloop' || pirate.tier === 'brigantine' ? 0.32 : 0.12;
    return {
      targetHeading: normalizeAngle(angleToPlayer + flankOffset),
      desiredSpeed: maxSpd,
      nextBehavior: 'pursue',
      wantsToFire: dist <= pirate.fireRange,
    };
  }

  const broadsideHeading = normalizeAngle(angleToPlayer + Math.PI * 0.48);
  return {
    targetHeading: broadsideHeading,
    desiredSpeed: maxSpd * 0.78,
    nextBehavior: 'broadside',
    wantsToFire: dist <= pirate.fireRange,
  };
}
