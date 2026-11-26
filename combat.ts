import {
  AiIntelligenceTier,
  CombatCommand,
  CombatTarget,
  CrewMember,
  FireMode,
  GhostSizeTier,
  Inventory,
  MerchantShipData,
  PirateDemand,
  PirateFactionId,
  PirateFactionState,
  PirateRank,
  PirateShipData,
  PirateTier,
  RepairPriority,
  ShipCondition,
  ShipUpgrades,
  VesselClass,
  VesselTemperament,
  WreckSurvivor,
} from './types';
import { getEffectiveWeaponStats } from './economy';
import { clamp, normalizeAngle } from './waveMath';
import { createRandomCrewMember } from './survival';
import {
  isPirateAlliedWithPlayer,
  isPlayerPirateAligned,
  PIRATE_FACTIONS,
  PIRATE_FACTION_IDS,
  PIRATE_RANK_TITLES,
} from './factions';

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

  const aiIntelligence: AiIntelligenceTier = isBoss || rank >= 5
    ? 'veteran'
    : tier === 'galleon' || tier === 'dreadnought' || rank >= 3
      ? rand() < 0.35
        ? 'veteran'
        : 'tactical'
      : tier === 'brigantine'
        ? rand() < 0.32
          ? 'basic'
          : 'tactical'
        : rand() < 0.68
          ? 'basic'
          : 'tactical';

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
    aiIntelligence,
    ramCooldown: 6 + rand() * 8,
    ramCommitTimer: 0,
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
    aiIntelligence: ghostSize === 'small' ? 'tactical' : 'veteran',
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
  angleFactor: number;
  isLightScrape: boolean;
  hitSectionA: RepairPriority;
  hitSectionB: RepairPriority;
  damageA: number;
  damageB: number;
  knockbackSpeedA: number;
  knockbackSpeedB: number;
}

export interface CollisionOptions {
  aHeading?: number;
  bHeading?: number;
}

function classifyHitSectionOnShip(
  shipHeading: number,
  dirToOtherX: number,
  dirToOtherZ: number,
  impactSeverity: number
): RepairPriority {
  const fwdX = -Math.sin(shipHeading);
  const fwdZ = -Math.cos(shipHeading);
  const bowAlign = fwdX * dirToOtherX + fwdZ * dirToOtherZ; // +1 bow, -1 stern, ~0 broadside
  if (bowAlign < -0.55) return 'steering';
  if (bowAlign > 0.58) return 'hull';
  if (impactSeverity >= 1.25) return 'cannons';
  return 'hull';
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
  bMitigation = 1.0,
  options?: CollisionOptions
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
      angleFactor: 0,
      isLightScrape: false,
      hitSectionA: 'hull',
      hitSectionB: 'hull',
      damageA: 0,
      damageB: 0,
      knockbackSpeedA: 0,
      knockbackSpeedB: 0,
    };
  }

  // Normal pointing from B toward A
  const nx = dist > 0.001 ? dx / dist : 0;
  const nz = dist > 0.001 ? dz / dist : 1;
  const overlap = minDist - dist + 0.42;

  const totalMass = Math.max(0.01, aMass + bMass);
  const shareA = bMass >= 999 ? 1 : bMass / totalMass;
  const shareB = bMass >= 999 ? 0 : aMass / totalMass;

  const rvx = aVx - bVx;
  const rvz = aVz - bVz;
  const relNormal = rvx * nx + rvz * nz;
  const impactSpeed = Math.max(0, -relNormal);

  const spdA = Math.hypot(aVx, aVz);
  const spdB = Math.hypot(bVx, bVz);
  const relTotal = Math.hypot(rvx, rvz);

  // Directness factor: 1.0 head-on along contact normal vs ~0.15 oblique grazing scrape
  const directness = relTotal > 0.25 ? clamp(impactSpeed / relTotal, 0.15, 1.0) : 0.3;

  const aHead =
    options?.aHeading !== undefined
      ? options.aHeading
      : spdA > 0.25
        ? Math.atan2(-aVx, -aVz)
        : Math.atan2(nx, nz);
  const bHead =
    options?.bHeading !== undefined
      ? options.bHeading
      : spdB > 0.25
        ? Math.atan2(-bVx, -bVz)
        : Math.atan2(-nx, -nz);

  // Check if A or B struck bow-first vs glancing side-by-side
  const aBowHit = clamp((-Math.sin(aHead) * -nx + -Math.cos(aHead) * -nz), 0, 1);
  const bBowHit = clamp((-Math.sin(bHead) * nx + -Math.cos(bHead) * nz), 0, 1);
  const angleFactor = clamp(directness * (0.65 + Math.max(aBowHit, bBowHit) * 0.68), 0.18, 1.45);

  const isLightScrape =
    impactSpeed < 1.85 || (impactSpeed <= 3.15 && directness < 0.56);

  const hitSectionA = classifyHitSectionOnShip(aHead, -nx, -nz, angleFactor);
  const hitSectionB = classifyHitSectionOnShip(bHead, nx, nz, angleFactor);

  // Speed advantage asymmetry: much faster rammer deals extra damage & receives less
  const speedAdvantageA = clamp(spdA - spdB, -10, 10);
  let damageA = 0;
  let damageB = 0;

  if (impactSpeed > 1.05) {
    if (isLightScrape) {
      damageA = impactSpeed > 1.7 ? Math.max(1, Math.round((impactSpeed - 1.2) * 0.7 * aMitigation)) : 0;
      damageB =
        bMass >= 999 || impactSpeed <= 1.7
          ? 0
          : Math.max(1, Math.round((impactSpeed - 1.2) * 0.85 * bMitigation));
    } else {
      const baseImpact = (impactSpeed - 1.0) * 2.55 * angleFactor;
      const massRatioA = bMass >= 999 ? 1.2 : clamp(bMass / Math.max(0.5, aMass), 0.45, 1.85);
      const massRatioB = bMass >= 999 ? 0 : clamp(aMass / Math.max(0.5, bMass), 0.5, 2.25);

      const fasterBonusToB = speedAdvantageA > 1.8 ? clamp(1 + (speedAdvantageA - 1.5) * 0.14, 1.0, 1.85) : 1.0;
      const fasterShieldA = speedAdvantageA > 1.8 ? clamp(1 - (speedAdvantageA - 1.5) * 0.11, 0.42, 1.0) : 1.0;

      const fasterBonusToA = -speedAdvantageA > 1.8 ? clamp(1 + (-speedAdvantageA - 1.5) * 0.14, 1.0, 1.85) : 1.0;
      const fasterShieldB = -speedAdvantageA > 1.8 ? clamp(1 - (-speedAdvantageA - 1.5) * 0.11, 0.42, 1.0) : 1.0;

      const bowRamMultB = aBowHit > 0.65 ? 1.22 : 1.0;
      const bowRamMultA = bBowHit > 0.65 ? 1.22 : 1.0;

      damageA = Math.max(
        2,
        Math.round(baseImpact * massRatioA * aMitigation * fasterShieldA * fasterBonusToA * bowRamMultA)
      );
      damageB =
        bMass >= 999
          ? 0
          : Math.max(
              3,
              Math.round(baseImpact * 2.1 * massRatioB * bMitigation * fasterBonusToB * fasterShieldB * bowRamMultB)
            );
    }
  }

  // Post-ramming knockback recoil & momentum reduction
  const knockbackSpeedA =
    impactSpeed > 0.6
      ? -clamp(spdA * (isLightScrape ? 0.12 : 0.34) + impactSpeed * (isLightScrape ? 0.08 : 0.22), 0.3, 4.8)
      : -spdA * 0.25;
  const knockbackSpeedB =
    bMass >= 999
      ? 0
      : impactSpeed > 0.6
        ? -clamp(spdB * (isLightScrape ? 0.1 : 0.28) + impactSpeed * (isLightScrape ? 0.06 : 0.18), 0.2, 4.2)
        : spdB * 0.6;

  return {
    collided: true,
    nx,
    nz,
    pushAx: nx * overlap * shareA || 0,
    pushAz: nz * overlap * shareA || 0,
    pushBx: -nx * overlap * shareB || 0,
    pushBz: -nz * overlap * shareB || 0,
    impactSpeed,
    angleFactor,
    isLightScrape,
    hitSectionA,
    hitSectionB,
    damageA,
    damageB,
    knockbackSpeedA,
    knockbackSpeedB,
  };
}

export interface PirateAIContext {
  squadIndex?: number;
  squadCount?: number;
  playerCannons?: number;
  playerHullPct?: number;
  playerSpeed?: number;
  simTime?: number;
}

export interface PirateAISteering {
  targetHeading: number;
  desiredSpeed: number;
  nextBehavior: PirateShipData['behavior'];
  wantsToFire: boolean;
}

export function shouldPirateAttemptRam(
  pirate: PirateShipData,
  playerHullTier: number,
  dist: number,
  ctx?: PirateAIContext
): boolean {
  if (pirate.defeated) return false;
  if (dist > 145 || dist < 14) return false;

  const intel: AiIntelligenceTier = pirate.aiIntelligence ?? 'tactical';
  const hullRatio = pirate.hull / Math.max(1, pirate.maxHull);
  const pirSizeScore = pirate.tier === 'dreadnought' ? 6 : pirate.tier === 'galleon' ? 4.5 : pirate.tier === 'brigantine' ? 2.8 : 1.4;
  const playerSizeScore = Math.max(1.2, playerHullTier * 0.95);
  const massAdvantage = pirSizeScore / playerSizeScore;

  // Out of cannons -> desperate ram if close enough
  if (pirate.cannons <= 0 && dist < 110) return true;

  // Currently committed to a ramming pass
  if ((pirate.ramCommitTimer ?? 0) > 0) return true;
  if ((pirate.ramCooldown ?? 0) > 0) return false;

  const desperate = hullRatio < 0.42 || (ctx?.playerCannons !== undefined && pirate.cannons < ctx.playerCannons * 0.55);

  if (intel === 'basic') {
    // Basic AI only sporadically charges if severely desperate
    return hullRatio < 0.34 && dist < 82 && ((ctx?.simTime ?? 1) % 14) < 4.5;
  }

  if (intel === 'tactical') {
    if (massAdvantage >= 1.25 && dist < 96 && (ctx?.playerHullPct ?? 100) < 75) return true;
    if (desperate && massAdvantage >= 0.72 && dist < 88) return true;
    return false;
  }

  // Veteran AI makes shrewd situational rams: heavy bully rams OR desperate last-stand rams
  if (massAdvantage >= 1.15 && dist < 105 && hullRatio > 0.35) return true;
  if (desperate && hullRatio > 0.14 && dist < 95 && ((ctx?.playerSpeed ?? 0) < pirate.maxSpeed * 1.15)) {
    return true;
  }
  return false;
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
  escortAnchor?: { x: number; z: number } | null,
  ctx?: PirateAIContext
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
  const intel: AiIntelligenceTier = pirate.aiIntelligence ?? (pirate.tier === 'sloop' ? 'basic' : 'tactical');

  if (pirate.defeated) {
    return { targetHeading: pirate.heading, desiredSpeed: 0, nextBehavior: 'defeated', wantsToFire: false };
  }

  const hullRatio = pirate.hull / Math.max(1, pirate.maxHull);
  const retreatThreshold = intel === 'basic' ? 0.16 : intel === 'tactical' ? 0.24 : 0.29;
  if (
    inCombatWithPlayer &&
    !pirate.isGhost &&
    ((hullRatio < retreatThreshold && (pirate.ramCommitTimer ?? 0) <= 0) ||
      (pirate.cannons <= 0 && dist > 110))
  ) {
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
        const engageDist = pirate.isGhost ? 95 : 85;
        return {
          targetHeading: dist < 115 ? angleToPlayer : interceptHeading,
          desiredSpeed: maxSpd,
          nextBehavior: dist < engageDist ? 'hailing' : 'pursue',
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

  // Situational AI Ramming pass
  if (shouldPirateAttemptRam(pirate, playerHullTier, dist, ctx)) {
    return {
      targetHeading: dist < 60 ? angleToPlayer : interceptHeading,
      desiredSpeed: maxSpd * 1.16,
      nextBehavior: 'ram',
      wantsToFire: dist <= pirate.fireRange * 0.75 && pirate.cannons > 0,
    };
  }

  // Basic AI: simple chase and broadside when close
  if (intel === 'basic') {
    const closeDist = pirate.fireRange * 0.45;
    if (dist < closeDist * 0.75) {
      return {
        targetHeading: normalizeAngle(angleToPlayer + Math.PI * 0.55),
        desiredSpeed: maxSpd * 0.85,
        nextBehavior: 'broadside',
        wantsToFire: dist <= pirate.fireRange,
      };
    }
    return {
      targetHeading: angleToPlayer,
      desiredSpeed: maxSpd,
      nextBehavior: dist <= pirate.fireRange * 0.8 ? 'broadside' : 'pursue',
      wantsToFire: dist <= pirate.fireRange,
    };
  }

  // Tactical & Veteran AI: coordinate surrounding angles across multiple attackers
  const squadCount = Math.max(1, ctx?.squadCount ?? 1);
  const squadIndex = ctx?.squadIndex ?? 0;
  const sectorBias =
    squadCount > 1
      ? ((squadIndex / squadCount) * 2 - 1) * Math.PI * (intel === 'veteran' ? 0.82 : 0.62)
      : 0;

  const optimalDist = pirate.fireRange * (intel === 'veteran' ? 0.72 : 0.66);
  const minSafeDist =
    pirate.isGhost && (pirate.ghostSize === 'colossal' || pirate.ghostSize === 'enormous')
      ? 56
      : intel === 'veteran'
        ? 44
        : 36;

  if (dist < minSafeDist) {
    const veerHeading = normalizeAngle(angleToPlayer + (squadIndex % 2 === 0 ? 1 : -1) * Math.PI * 0.72);
    return {
      targetHeading: veerHeading,
      desiredSpeed: maxSpd * 0.92,
      nextBehavior: 'flank',
      wantsToFire: dist <= pirate.fireRange,
    };
  }

  if (squadCount > 1 && dist > minSafeDist && dist < pirate.fireRange * 1.35) {
    // Move toward assigned flanking/surrounding ring point around the player
    const baseBearing = Math.atan2(pirate.z - playerZ, pirate.x - playerX);
    const desiredBearing = baseBearing + sectorBias * 0.42;
    const goalX = playerX + Math.cos(desiredBearing) * optimalDist;
    const goalZ = playerZ + Math.sin(desiredBearing) * optimalDist;
    const toSlotHeading = Math.atan2(-(goalX - pirate.x), -(goalZ - pirate.z));
    if (dist > optimalDist * 1.25) {
      return {
        targetHeading: toSlotHeading,
        desiredSpeed: maxSpd,
        nextBehavior: 'flank',
        wantsToFire: dist <= pirate.fireRange,
      };
    }
  }

  if (dist > optimalDist * 1.25) {
    const flankOffset =
      (squadIndex % 2 === 0 ? 1 : -1) *
      (pirate.tier === 'sloop' || pirate.tier === 'brigantine' ? 0.34 : 0.16);
    return {
      targetHeading: normalizeAngle(interceptHeading + flankOffset),
      desiredSpeed: maxSpd,
      nextBehavior: squadCount > 1 ? 'flank' : 'pursue',
      wantsToFire: dist <= pirate.fireRange,
    };
  }

  const sideSign = squadIndex % 2 === 0 ? 1 : -1;
  const broadsideHeading = normalizeAngle(angleToPlayer + sideSign * Math.PI * 0.48);
  return {
    targetHeading: broadsideHeading,
    desiredSpeed: maxSpd * (intel === 'veteran' ? 0.82 : 0.78),
    nextBehavior: 'broadside',
    wantsToFire: dist <= pirate.fireRange,
  };
}

export interface FriendlyAssistanceResult {
  assists: boolean;
  shouldFlee: boolean;
  reason: string;
}

export function decideFriendlyAssistance(
  candidate:
    | {
        kind: 'merchant';
        ship: MerchantShipData;
      }
    | {
        kind: 'pirate';
        ship: PirateShipData;
        faction?: PirateFactionState;
      },
  threatIsCrown: boolean,
  playerReputation: number,
  currentDay: number,
  rand: () => number
): FriendlyAssistanceResult {
  if (candidate.kind === 'merchant') {
    const m = candidate.ship;
    if (m.sunk || m.hostileToPlayer || m.fleeingFromPlayer || m.surrenderedToPlayer) {
      return { assists: false, shouldFlee: false, reason: 'unavailable' };
    }
    if (m.cannons <= 0 || m.isFishingTrawler) {
      return { assists: false, shouldFlee: true, reason: 'unarmed civilian flees combat' };
    }
    if (m.isCrown) {
      if (playerReputation <= -25) {
        return { assists: false, shouldFlee: false, reason: 'Crown distrusts outlaws' };
      }
      // Crown assists lawful captains probabilistically, higher reputation = much more likely, not guaranteed
      const chance =
        playerReputation >= 45 ? 0.78 : playerReputation >= 12 ? 0.54 : playerReputation >= 0 ? 0.3 : 0.12;
      return {
        assists: rand() < chance,
        shouldFlee: false,
        reason: 'Crown patrol assessment',
      };
    }

    // Armed civilian traders mostly flee unless bold + player has solid reputation
    const temp: VesselTemperament = m.temperament ?? 'cautious';
    if (temp === 'timid') {
      return { assists: false, shouldFlee: true, reason: 'timid merchant flees' };
    }
    if (temp === 'bold' && playerReputation >= 25) {
      const assists = rand() < 0.28;
      return {
        assists,
        shouldFlee: !assists,
        reason: assists ? 'bold merchant aids respected captain' : 'merchant avoids naval clash',
      };
    }
    return { assists: false, shouldFlee: true, reason: 'merchant avoids danger' };
  }

  // Pirate ship assistance evaluation
  const pir = candidate.ship;
  if (pir.defeated || pir.isGhost || pir.cannons <= 0) {
    return { assists: false, shouldFlee: false, reason: 'unavailable' };
  }
  const allied = isPirateAlliedWithPlayer(candidate.faction, currentDay, playerReputation);
  const standing = candidate.faction?.playerStanding ?? 0;
  const evilRep = isPlayerPirateAligned(playerReputation);

  if (!allied && standing < 12 && !evilRep) {
    return { assists: false, shouldFlee: false, reason: 'not friendly' };
  }

  // Friendly pirates are especially eager to back up evil/outlaw players or allied pacts
  let chance = 0.26;
  if (evilRep) chance += 0.36;
  if (allied) chance += 0.22;
  if (threatIsCrown && evilRep) chance += 0.14;
  if (pir.personality === 'honorable') chance += 0.08;
  chance = clamp(chance, 0.15, 0.86);

  return {
    assists: rand() < chance,
    shouldFlee: false,
    reason: evilRep ? 'corsair solidarity with outlaw captain' : 'allied pirate pact',
  };
}

export function decideUnarmedOrTrawlerBehavior(
  vessel: MerchantShipData,
  distToThreat: number,
  threatSpeed: number,
  simTime: number
): 'ignore' | 'flee' | 'desperate_ram' {
  const hullRatio = vessel.hull / Math.max(1, vessel.maxHull);
  const temp: VesselTemperament = vessel.temperament ?? (vessel.isFishingTrawler ? 'timid' : 'cautious');
  const panicRange = temp === 'timid' ? 210 : temp === 'cautious' ? 135 : 88;

  if (!vessel.fleeingFromPlayer && !vessel.hostileToPlayer && distToThreat > panicRange) {
    return 'ignore';
  }

  const cornered =
    distToThreat < 84 &&
    (threatSpeed >= vessel.maxSpeed * 0.9 || hullRatio < 0.45);

  if (
    cornered &&
    vessel.cannons <= 0 &&
    (vessel.desperateRamCooldown ?? 0) <= 0 &&
    (temp === 'bold' || (temp === 'cautious' && hullRatio < 0.35 && ((simTime % 12) < 4)))
  ) {
    return 'desperate_ram';
  }

  return 'flee';
}

export interface IceSheetImpactResult {
  shattered: boolean;
  newHp: number;
  newCrackStage: 0 | 1 | 2 | 3;
  shipHullDamage: number;
  speedRetainedMult: number;
  reboundSpeed: number;
}

export function resolveBreakableIceSheetCollision(
  shipSpeed: number,
  shipMass: number,
  hullTier: number,
  sheetHp: number,
  sheetMaxHp: number,
  thickness: 1 | 2 | 3
): IceSheetImpactResult {
  const absSpd = Math.abs(shipSpeed);
  // Larger, heavier ships (hullTier & mass) break ice far more effortlessly
  const breakingPower = absSpd * (1 + hullTier * 0.42 + shipMass * 0.35);
  const armorNeed = thickness === 1 ? 7 : thickness === 2 ? 17 : 31;

  if (absSpd < 1.2) {
    return {
      shattered: false,
      newHp: sheetHp,
      newCrackStage: sheetHp <= sheetMaxHp * 0.35 ? 2 : sheetHp < sheetMaxHp * 0.78 ? 1 : 0,
      shipHullDamage: 0,
      speedRetainedMult: 0.72,
      reboundSpeed: 0,
    };
  }

  const iceDmg = Math.max(4, breakingPower * (thickness === 1 ? 2.4 : thickness === 2 ? 1.25 : 0.72));
  const nextHp = Math.max(0, sheetHp - iceDmg);
  const shattered = nextHp <= 0 || breakingPower >= armorNeed * 1.45;
  const newCrackStage: 0 | 1 | 2 | 3 = shattered
    ? 3
    : nextHp <= sheetMaxHp * 0.36
      ? 2
      : nextHp < sheetMaxHp * 0.85
        ? 1
        : 0;

  // Hull damage scales down sharply for thick heavy hulls, up when slamming thick shelf ice fast in a small boat
  const hullShield = clamp(1.08 - hullTier * 0.12, 0.28, 1.0);
  const rawHullDmg =
    thickness === 1
      ? absSpd > 6 ? 1 : 0
      : Math.max(1, Math.round((absSpd * 0.75 + thickness * 2.1) * hullShield * (shattered ? 0.65 : 1.05)));

  return {
    shattered,
    newHp: shattered ? 0 : nextHp,
    newCrackStage,
    shipHullDamage: rawHullDmg,
    speedRetainedMult: shattered ? clamp(0.68 + hullTier * 0.04, 0.65, 0.92) : 0.25,
    reboundSpeed: shattered ? 0 : -Math.max(1.2, absSpd * 0.32),
  };
}

