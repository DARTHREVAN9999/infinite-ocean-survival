import {
  CrewAutoAssignMode,
  CrewHealthWarning,
  CrewMember,
  CrewRole,
  Inventory,
  ManualRepairJob,
  RepairPriority,
  ShipCondition,
  ShipUpgrades,
  WeatherState,
} from './types';
import { clamp } from './waveMath';

export const CREW_ROLES: CrewRole[] = [
  'sailor',
  'helmsman',
  'cannoneer',
  'repair',
  'lookout',
  'navigator',
  'medical',
  'fisherman',
  'general',
  'resting',
];

export const CREW_ROLE_LABELS: Record<CrewRole, string> = {
  sailor: 'Sailors',
  helmsman: 'Helmsmen',
  cannoneer: 'Cannoneers',
  repair: 'Repair Crew',
  lookout: 'Lookouts',
  navigator: 'Navigation Crew',
  medical: 'Medical Crew',
  fisherman: 'Fishermen',
  general: 'General Crew',
  resting: 'Resting',
};

const FIRST_NAMES = [
  'Callum', 'Rowan', 'Maeve', 'Arthur', 'Declan', 'Nora', 'Silas', 'Clara',
  'Ewan', 'Tamsin', 'Gideon', 'Beatrice', 'Jonas', 'Freya', 'Henrik', 'Maren',
  'Caleb', 'Isolde', 'Tomas', 'Alistair', 'Sabine', 'Owen', 'Fletcher', 'Bram',
  'Jack', 'morgan', 'Barnaby', 'wren', 'harlan', 'cora',
].map((n) => n.charAt(0).toUpperCase() + n.slice(1));

const LAST_NAMES = [
  'Vance', 'Hargrave', 'Morrow', 'Kestrel', 'Mercer', 'Thorne', 'Waverly', 'Sterling',
  'Crowe', 'Barrow', 'Dunstan', 'Blackwell', 'Oakhurst', 'Finch', 'Redmayne', 'Hollis',
  'Aldridge', 'Cromwell', 'Hawke', 'Larkin', 'Sutton', 'Whitmore', 'Pembrook', 'Drake',
];

const ORIGINS = [
  'Bristol Shipwright', 'Cornish Fisherman', 'Portsmouth Gunner', 'Orkney Navigator',
  'Cork Rigger', 'Plymouth Boatswain', 'Dover Deckhand', 'Galway Carpenter',
  'Falmouth Lookout', 'Jersey Quartermaster', 'Wexford Helmsman', 'Hull Surgeon',
];

const COAT_COLORS = ['#3b4f66', '#6b3e2e', '#2f5241', '#5a4a38', '#4a3d52', '#7d5a34', '#2c3d4a'];
const HAT_STYLES: CrewMember['hatStyle'][] = ['none', 'bandana', 'beanie', 'tricorne'];

export function createRandomCrewMember(
  id: string,
  rand: () => number,
  role: CrewRole = 'sailor',
  forced = false
): CrewMember {
  const first = FIRST_NAMES[Math.floor(rand() * FIRST_NAMES.length)];
  const last = LAST_NAMES[Math.floor(rand() * LAST_NAMES.length)];
  const origin = ORIGINS[Math.floor(rand() * ORIGINS.length)];
  const rollSkill = () => 3 + Math.floor(rand() * 7);

  return {
    id,
    name: `${first} ${last}`,
    origin,
    role,
    health: 88 + Math.floor(rand() * 13),
    morale: forced ? 34 + Math.floor(rand() * 16) : 72 + Math.floor(rand() * 18),
    loyalty: forced ? 22 + Math.floor(rand() * 18) : 76 + Math.floor(rand() * 18),
    forced,
    xp: 0,
    level: 1,
    condition: 'healthy',
    skills: {
      sailing: rollSkill(),
      combat: rollSkill(),
      repair: rollSkill(),
      navigation: rollSkill(),
      strength: rollSkill(),
      fishing: rollSkill(),
    },
    coatColor: COAT_COLORS[Math.floor(rand() * COAT_COLORS.length)],
    hatStyle: HAT_STYLES[Math.floor(rand() * HAT_STYLES.length)],
  };
}

/**
 * Generates the starting crew of 10 sailors distributed cleanly across roles.
 */
export function createStartingCrew(rand: () => number): CrewMember[] {
  const roles: CrewRole[] = [
    'sailor', 'sailor', 'sailor',
    'helmsman',
    'cannoneer', 'cannoneer',
    'repair', 'repair',
    'lookout',
    'navigator',
  ];
  return roles.map((role, idx) => createRandomCrewMember(`crew_init_${idx}`, rand, role, false));
}

export function getRoleCounts(crew: CrewMember[]): Record<CrewRole, number> {
  const counts: Record<CrewRole, number> = {
    sailor: 0,
    helmsman: 0,
    cannoneer: 0,
    repair: 0,
    lookout: 0,
    navigator: 0,
    medical: 0,
    fisherman: 0,
    general: 0,
    resting: 0,
  };
  for (const c of crew) {
    if (c.health > 0) {
      counts[c.role] = (counts[c.role] || 0) + 1;
    }
  }
  return counts;
}

export function getLowHealthWarnings(crew: CrewMember[]): CrewHealthWarning[] {
  return crew
    .filter((c) => c.health > 0 && c.health < 25)
    .map((c) => ({
      crewId: c.id,
      name: c.name,
      health: Math.max(1, Math.round(c.health)),
    }));
}

function scoreMemberForRole(m: CrewMember, role: CrewRole): number {
  const s = m.skills;
  switch (role) {
    case 'sailor':
      return s.sailing * 1.4 + s.strength * 0.4;
    case 'helmsman':
      return s.sailing * 0.9 + s.navigation * 1.0;
    case 'cannoneer':
      return s.combat * 1.5 + s.strength * 0.35;
    case 'repair':
      return s.repair * 1.5 + s.strength * 0.3;
    case 'lookout':
      return s.navigation * 1.3 + s.sailing * 0.3;
    case 'navigator':
      return s.navigation * 1.5;
    case 'medical':
      return s.repair * 0.9 + s.navigation * 0.7;
    case 'fisherman':
      return (s.fishing ?? s.sailing) * 1.35 + s.strength * 0.4;
    case 'general':
      return (s.strength + s.sailing + s.repair + s.combat) * 0.4;
    case 'resting':
      return 0;
  }
}

/**
 * Pure one-click crew role auto-assignment preserving all crew identities, skills, and stats.
 */
export function computeAutoAssignRoles(
  crew: CrewMember[],
  mode: CrewAutoAssignMode
): CrewMember[] {
  if (crew.length === 0) return [];

  const n = crew.length;
  const assigned = new Map<string, CrewRole>();
  const available = crew.map((c) => ({ ...c }));
  const taken = new Set<string>();

  const pickBestFor = (role: CrewRole) => {
    let best: CrewMember | null = null;
    let bestScore = -Infinity;
    for (const c of available) {
      if (taken.has(c.id)) continue;
      // Keep critically wounded sailors off dangerous roles when possible in non-emergency
      const injuryBias = c.health < 25 && role !== 'resting' ? -8 : 0;
      const sc = scoreMemberForRole(c, role) + injuryBias;
      if (sc > bestScore) {
        bestScore = sc;
        best = c;
      }
    }
    if (best) {
      taken.add(best.id);
      assigned.set(best.id, role);
    }
  };

  if (mode === 'sailing') {
    const helmsCount = Math.max(1, Math.round(n * 0.14));
    const repairCount = n >= 4 ? Math.max(1, Math.floor(n * 0.12)) : 0;
    const medCount = n >= 6 ? 1 : 0;
    const navCount = n >= 3 ? Math.max(1, Math.floor(n * 0.1)) : 0;
    const lookoutCount = n >= 5 ? Math.max(1, Math.floor(n * 0.1)) : 0;
    const cannonCount = n >= 8 ? Math.max(1, Math.floor(n * 0.1)) : 0;

    for (let i = 0; i < helmsCount; i++) pickBestFor('helmsman');
    for (let i = 0; i < repairCount; i++) pickBestFor('repair');
    for (let i = 0; i < medCount; i++) pickBestFor('medical');
    for (let i = 0; i < navCount; i++) pickBestFor('navigator');
    for (let i = 0; i < lookoutCount; i++) pickBestFor('lookout');
    for (let i = 0; i < cannonCount; i++) pickBestFor('cannoneer');
    while (taken.size < n) pickBestFor('sailor');
  } else if (mode === 'combat') {
    const helmsCount = 1;
    const sailorCount = n >= 3 ? Math.max(1, Math.floor(n * 0.18)) : n >= 2 ? 1 : 0;
    const repairCount = n >= 5 ? Math.max(1, Math.floor(n * 0.12)) : 0;
    const lookoutCount = n >= 6 ? 1 : 0;
    const generalCount = n >= 7 ? Math.max(1, Math.floor(n * 0.1)) : 0;

    for (let i = 0; i < helmsCount; i++) pickBestFor('helmsman');
    for (let i = 0; i < sailorCount; i++) pickBestFor('sailor');
    for (let i = 0; i < repairCount; i++) pickBestFor('repair');
    for (let i = 0; i < lookoutCount; i++) pickBestFor('lookout');
    for (let i = 0; i < generalCount; i++) pickBestFor('general');
    while (taken.size < n) pickBestFor('cannoneer');
  } else {
    // 'best' — balanced skill-matched roles covering essentials first
    if (n >= 1) pickBestFor('helmsman');
    if (n >= 2) pickBestFor('sailor');
    if (n >= 3) pickBestFor('cannoneer');
    if (n >= 4) pickBestFor('repair');
    if (n >= 5) pickBestFor('lookout');
    if (n >= 7) pickBestFor('navigator');
    if (n >= 9) pickBestFor('medical');

    const activeRoles: CrewRole[] = [
      'sailor',
      'cannoneer',
      'repair',
      'lookout',
      'navigator',
      'helmsman',
      'general',
    ];
    for (const c of available) {
      if (taken.has(c.id)) continue;
      let bestRole: CrewRole = 'general';
      let bestScore = -Infinity;
      for (const r of activeRoles) {
        const sc = scoreMemberForRole(c, r);
        if (sc > bestScore) {
          bestScore = sc;
          bestRole = r;
        }
      }
      taken.add(c.id);
      assigned.set(c.id, bestRole);
    }
  }

  return crew.map((c) => ({
    ...c,
    role: assigned.get(c.id) ?? c.role,
  }));
}

export interface CrewPerformance {
  sailingBonus: number;
  helmTurnBonus: number;
  repairSpeedFactor: number;
  cannonEfficiency: number;
  watchSightBonus: number;
  navigationSpeedBonus: number;
  medicalPower: number;
  avgMorale: number;
  avgLoyalty: number;
  activeCount: number;
}

export function computeCrewPerformance(crew: CrewMember[], upgrades: ShipUpgrades): CrewPerformance {
  if (crew.length === 0) {
    return {
      sailingBonus: 0.35,
      helmTurnBonus: 0.55,
      repairSpeedFactor: 0.5,
      cannonEfficiency: 0.15,
      watchSightBonus: 0.85,
      navigationSpeedBonus: 0.9,
      medicalPower: 0,
      avgMorale: 0,
      avgLoyalty: 0,
      activeCount: 0,
    };
  }

  let sailPower = 0;
  let helmPower = 0;
  let repairPower = 0;
  let cannonPower = 0;
  let lookoutPower = 0;
  let navPower = 0;
  let medPower = 0;
  let generalPower = 0;
  let moraleSum = 0;
  let loyaltySum = 0;
  let activeCount = 0;

  for (const c of crew) {
    moraleSum += c.morale;
    loyaltySum += c.loyalty;
    const moraleMult = 0.55 + (c.morale / 100) * 0.55;
    const loyaltyMult = c.forced ? 0.5 + (c.loyalty / 100) * 0.5 : 0.85 + (c.loyalty / 100) * 0.2;
    const condMult =
      c.health < 25 ? 0.35 : c.condition === 'healthy' ? 1.0 : c.condition === 'exhausted' ? 0.72 : 0.5;
    const eff = moraleMult * loyaltyMult * condMult;

    if (c.role !== 'resting') activeCount++;

    if (c.role === 'sailor') sailPower += c.skills.sailing * eff;
    else if (c.role === 'helmsman') helmPower += (c.skills.sailing * 0.6 + c.skills.navigation * 0.5) * eff;
    else if (c.role === 'cannoneer') cannonPower += c.skills.combat * eff;
    else if (c.role === 'repair') repairPower += c.skills.repair * eff;
    else if (c.role === 'lookout') lookoutPower += c.skills.navigation * eff;
    else if (c.role === 'navigator') navPower += c.skills.navigation * eff;
    else if (c.role === 'medical') medPower += (c.skills.repair * 0.7 + 3) * eff;
    else if (c.role === 'general') generalPower += ((c.skills.strength + c.skills.sailing) * 0.5) * eff;
  }

  const avgMorale = moraleSum / crew.length;
  const avgLoyalty = loyaltySum / crew.length;
  const generalBoost = generalPower * 0.012;
  const workshopBonus = upgrades.repairStation ? 1.35 : 1.0;

  return {
    sailingBonus: clamp(0.66 + sailPower * 0.025 + generalBoost, 0.52, 1.72),
    helmTurnBonus: clamp(0.75 + helmPower * 0.04 + generalBoost, 0.65, 1.45),
    repairSpeedFactor: clamp((0.65 + repairPower * 0.04 + generalBoost) * workshopBonus, 0.6, 2.5),
    cannonEfficiency: clamp(0.45 + cannonPower * 0.036 + generalBoost * 0.8, 0.35, 1.9),
    watchSightBonus: clamp(1.0 + lookoutPower * 0.03 + (upgrades.crowsNest ? 0.42 : 0), 0.9, 1.95),
    navigationSpeedBonus: clamp(1.0 + navPower * 0.018, 1.0, 1.35),
    medicalPower: medPower,
    avgMorale: Math.round(avgMorale),
    avgLoyalty: Math.round(avgLoyalty),
    activeCount,
  };
}

export interface ShipHandlingStats {
  maxSpeed: number;
  acceleration: number;
  turnRate: number;
  stability: number;
  damageReduction: number;
  massFactor: number;
  stopDragLambda: number;
}

export function computeShipHandling(
  upgrades: ShipUpgrades,
  condition: ShipCondition,
  crewPerf: CrewPerformance,
  weather: WeatherState
): ShipHandlingStats {
  const hullSpeedBase = [0, 8.2, 9.2, 10.1, 11.0, 11.6, 12.1, 12.6][upgrades.hullTier] ?? 8.2;
  const sailMult =
    1 + (upgrades.sailTier - 1) * 0.17 + (upgrades.extraMast ? 0.24 : 0) + upgrades.deckLevel * 0.04;
  const sailHealthFactor = 0.35 + (condition.sails / 100) * 0.65;
  const mastHealthFactor = 0.4 + (condition.mast / 100) * 0.6;
  const floodDrag = 1 - (condition.flooding / 100) * 0.45;
  const windBoost = 0.82 + clamp(weather.windSpeed / 24, 0, 0.55);

  const maxSpeed =
    hullSpeedBase *
    sailMult *
    sailHealthFactor *
    mastHealthFactor *
    floodDrag *
    crewPerf.sailingBonus *
    crewPerf.navigationSpeedBonus *
    windBoost;

  const hullTurnBase = [0, 0.94, 0.82, 0.70, 0.58, 0.48, 0.41, 0.35][upgrades.hullTier] ?? 0.82;
  const sizeTurnPenalty = 1 - (upgrades.hullLengthBonus * 0.045 + upgrades.hullWidthBonus * 0.03);
  const steeringMult = 1 + (upgrades.steeringTier - 1) * 0.22;
  const steeringHealthFactor = 0.34 + (condition.steering / 100) * 0.66;
  const stormTurnPenalty = weather.waveIntensity > 1.8 ? 0.76 : 1.0;

  const turnRate =
    hullTurnBase *
    sizeTurnPenalty *
    steeringMult *
    steeringHealthFactor *
    stormTurnPenalty *
    crewPerf.helmTurnBonus;

  const hullAccel = [0, 4.4, 3.7, 3.0, 2.4, 2.0, 1.65, 1.4][upgrades.hullTier] ?? 4.0;
  const massFactor =
    1.0 +
    (upgrades.hullTier - 1) * 0.55 +
    upgrades.hullLengthBonus * 0.2 +
    upgrades.hullWidthBonus * 0.22 +
    upgrades.deckLevel * 0.25 +
    upgrades.armorPlating * 0.18;

  // Larger, heavier hulls carry more forward momentum when Spacebar stop is pressed
  const stopDragLambda = clamp(1.18 / Math.sqrt(massFactor), 0.38, 1.25);

  const stability =
    ([0, 1.0, 1.32, 1.65, 2.0, 2.35, 2.7, 3.1][upgrades.hullTier] ?? 1.0) +
    upgrades.hullWidthBonus * 0.16 +
    upgrades.deckLevel * 0.08;

  const armorMit = [0, 0.16, 0.3, 0.44, 0.58][upgrades.armorPlating] ?? 0;
  const reinfMit = [0, 0.06, 0.12, 0.18][upgrades.reinforcementTier] ?? 0;
  const damageReduction = clamp(armorMit + reinfMit, 0, 0.72);

  return {
    maxSpeed,
    acceleration: hullAccel,
    turnRate,
    stability,
    damageReduction,
    massFactor,
    stopDragLambda,
  };
}

// 180 real seconds = 1 full 24h game day (0.1333 hours/sec)
export const GAME_DAY_SECONDS = 180;
export const SALT_RATE_PER_CREW = 0.0028;
export const SALT_SPOILAGE_MULT = 1.85;

export function computeSupplyDaysRemaining(
  inventory: Inventory,
  crewCount: number,
  weather?: WeatherState
): { foodDays: number; waterDays: number; saltDays: number } {
  const n = Math.max(1, crewCount);
  const waterMult = weather?.waterDrainMult ?? 1.0;
  const hasSalt = (inventory.salt || 0) > 0;
  const foodPerDay = n * 0.011 * (hasSalt ? 1 : SALT_SPOILAGE_MULT) * GAME_DAY_SECONDS;
  const waterPerDay = n * 0.013 * waterMult * GAME_DAY_SECONDS;
  const saltPerDay = n * SALT_RATE_PER_CREW * GAME_DAY_SECONDS;
  return {
    foodDays: Math.round(((inventory.food || 0) / foodPerDay) * 10) / 10,
    waterDays: Math.round(((inventory.water || 0) / waterPerDay) * 10) / 10,
    saltDays: Math.round(((inventory.salt || 0) / saltPerDay) * 10) / 10,
  };
}

export function xpThresholdForLevel(level: number): number {
  return Math.round(45 * Math.pow(1.35, Math.max(0, level - 1)));
}

function getPrimarySkillForRole(
  role: CrewRole
): keyof CrewMember['skills'] {
  switch (role) {
    case 'sailor':
    case 'helmsman':
      return 'sailing';
    case 'cannoneer':
      return 'combat';
    case 'repair':
    case 'medical':
      return 'repair';
    case 'lookout':
    case 'navigator':
      return 'navigation';
    case 'fisherman':
      return 'fishing';
    case 'general':
    default:
      return 'strength';
  }
}

const SKILL_DISPLAY_NAME: Record<keyof CrewMember['skills'], string> = {
  sailing: 'Sailing',
  combat: 'Combat',
  repair: 'Repair',
  navigation: 'Navigation',
  strength: 'Strength',
  fishing: 'Fishing',
};

export function applyXpToCrewMember(
  member: CrewMember,
  xpGain: number
): { member: CrewMember; leveledUpMessage: string | null } {
  if (xpGain <= 0 || member.role === 'resting' || member.health <= 0) {
    return { member, leveledUpMessage: null };
  }
  let level = Math.max(1, member.level ?? 1);
  let xp = (member.xp || 0) + xpGain;
  const nextSkills = { ...member.skills };
  let leveledUp = false;
  let raisedSkillLabel = '';

  let threshold = xpThresholdForLevel(level);
  while (xp >= threshold && level < 15) {
    xp -= threshold;
    level += 1;
    leveledUp = true;
    const primary = getPrimarySkillForRole(member.role);
    const curVal = nextSkills[primary] ?? 3;
    if (curVal < 12) {
      nextSkills[primary] = curVal + 1;
      raisedSkillLabel = SKILL_DISPLAY_NAME[primary];
    } else if (nextSkills.strength < 12) {
      nextSkills.strength += 1;
      raisedSkillLabel = 'Strength';
    }
    threshold = xpThresholdForLevel(level);
  }

  const nextMember: CrewMember = {
    ...member,
    xp,
    level,
    skills: nextSkills,
  };

  return {
    member: nextMember,
    leveledUpMessage: leveledUp
      ? `${member.name} reached Rank ${level}${raisedSkillLabel ? ` (+1 ${raisedSkillLabel})` : ''}!`
      : null,
  };
}

export function grantCrewRoleXp(
  crew: CrewMember[],
  roles: CrewRole[] | 'all_working',
  xpAmount: number
): { crew: CrewMember[]; levelUps: string[] } {
  const levelUps: string[] = [];
  const nextCrew = crew.map((c) => {
    if (c.role === 'resting' || c.health <= 0) return c;
    if (roles !== 'all_working' && !roles.includes(c.role)) return c;
    const res = applyXpToCrewMember(c, xpAmount);
    if (res.leveledUpMessage) levelUps.push(res.leveledUpMessage);
    return res.member;
  });
  return { crew: nextCrew, levelUps };
}

export interface SurvivalTickResult {
  inventory: Inventory;
  crew: CrewMember[];
  condition: ShipCondition;
  activeRepairJob: ManualRepairJob | null;
  completedRepairSection: RepairPriority | null;
  events: string[];
  levelUps: string[];
  casualties: string[];
  escapedNames: string[];
  sunk: boolean;
  allCrewDead: boolean;
}

/**
 * Advances crew provisioning, water consumption, loyalty, medical healing, storm damage,
 * and ONLY explicit player-started manual repairs (NEVER auto-repairs damaged ship parts).
 */
export function stepSurvivalAndRepairs(
  dt: number,
  inventory: Inventory,
  crew: CrewMember[],
  condition: ShipCondition,
  upgrades: ShipUpgrades,
  activeRepairJob: ManualRepairJob | null,
  weather: WeatherState,
  rand: () => number
): SurvivalTickResult {
  const nextInv: Inventory = { ...inventory };
  const nextCond: ShipCondition = { ...condition };
  const events: string[] = [];
  const levelUps: string[] = [];
  const casualties: string[] = [];
  const escapedNames: string[] = [];

  const prevSalt = nextInv.salt || 0;
  const saltNeed = nextInv.food > 0 ? crew.length * SALT_RATE_PER_CREW * dt : 0;
  nextInv.salt = Math.max(0, prevSalt - saltNeed);
  const noSaltSpoilage = prevSalt <= 0 && nextInv.food > 0;
  if (prevSalt > 0 && nextInv.salt <= 0 && nextInv.food > 0) {
    events.push('Sea Salt exhausted! Without curing salt, provisions are spoiling nearly twice as fast.');
  }

  const foodNeed = crew.length * 0.011 * (noSaltSpoilage ? SALT_SPOILAGE_MULT : 1.0) * dt;
  const waterNeed = crew.length * 0.013 * (weather.waterDrainMult || 1.0) * dt;

  const starving = nextInv.food <= 0;
  const dehydrated = nextInv.water <= 0;

  nextInv.food = Math.max(0, nextInv.food - foodNeed);
  nextInv.water = Math.max(0, nextInv.water - waterNeed);

  // Severe storm / blizzard / severe hail wear
  const isStorm =
    weather.type === 'thunderstorm' ||
    weather.type === 'lightning_storm' ||
    weather.type === 'hurricane' ||
    weather.type === 'tornado' ||
    weather.type === 'blizzard' ||
    weather.type === 'severe_hail';
  const isExtreme = weather.type === 'hurricane' || weather.type === 'tornado' || weather.type === 'severe_hail';
  if (isExtreme && rand() < 0.14 * dt) {
    const stormMit = 1 - upgrades.armorPlating * 0.14 - upgrades.reinforcementTier * 0.08;
    const stormDmg = (1.5 + rand() * 2.2) * Math.max(0.35, stormMit);
    nextCond.hull = Math.max(0, nextCond.hull - stormDmg);
    nextCond.sails = Math.max(0, nextCond.sails - stormDmg * 1.15);
    if (weather.type === 'severe_hail') {
      nextCond.deck = Math.max(10, nextCond.deck - stormDmg * 0.9);
    }
  } else if (weather.type === 'blizzard' && rand() < 0.08 * dt) {
    nextCond.sails = Math.max(15, nextCond.sails - (0.8 + rand() * 1.1));
  }

  // Hull leaks drive flooding
  if (nextCond.hull < 65) {
    const leakRate = ((65 - nextCond.hull) / 65) * (isStorm ? 1.8 : 0.9);
    nextCond.flooding = clamp(nextCond.flooding + leakRate * dt, 0, 100);
  } else if (nextCond.flooding > 0) {
    nextCond.flooding = Math.max(0, nextCond.flooding - (1.8 + crew.length * 0.14) * dt);
  }

  // STRICT MANUAL REPAIRS ONLY: advance activeRepairJob if player initiated one
  let nextRepairJob: ManualRepairJob | null = activeRepairJob ? { ...activeRepairJob } : null;
  let completedRepairSection: RepairPriority | null = null;
  if (nextRepairJob) {
    nextRepairJob.remainingTime -= dt;
    if (nextRepairJob.remainingTime <= 0) {
      const sec = nextRepairJob.section;
      nextCond[sec] = 100;
      if (sec === 'hull') {
        nextCond.flooding = Math.max(0, nextCond.flooding - 65);
      }
      completedRepairSection = sec;
      events.push(`Manual repair completed: ${sec.toUpperCase()} restored to 100%.`);
      nextRepairJob = null;
    }
  }

  const perf = computeCrewPerformance(crew, upgrades);
  const medicalHealRate = perf.medicalPower * 0.055;

  const survivingCrew: CrewMember[] = [];
  for (const member of crew) {
    const c: CrewMember = { ...member };
    let moraleDelta = 0;
    let healthDelta = 0;
    let loyaltyDelta = 0;

    if (starving) {
      moraleDelta -= 0.78 * dt;
      healthDelta -= 0.45 * dt;
      loyaltyDelta -= 0.45 * dt;
    } else {
      moraleDelta += 0.14 * dt;
      loyaltyDelta += (c.forced ? 0.11 : 0.06) * dt;
    }

    if (dehydrated) {
      moraleDelta -= 1.05 * dt;
      healthDelta -= 0.75 * dt;
      loyaltyDelta -= 0.65 * dt;
    } else {
      moraleDelta += 0.14 * dt;
      loyaltyDelta += (c.forced ? 0.11 : 0.06) * dt;
    }

    if (nextCond.hull < 40 || nextCond.flooding > 45) {
      moraleDelta -= 0.55 * dt;
    }
    if (isStorm) {
      moraleDelta -= 0.3 * dt;
    }

    if (c.role === 'resting') {
      healthDelta += (upgrades.medicalBay ? 1.55 : 0.8) * dt + medicalHealRate * 0.5 * dt;
      moraleDelta += 0.25 * dt;
      if (c.condition === 'exhausted' && c.health > 75) {
        c.condition = 'healthy';
      }
    } else if (!starving && !dehydrated && c.health < 100) {
      if (upgrades.medicalBay || medicalHealRate > 0) {
        healthDelta += ((upgrades.medicalBay ? 0.32 : 0) + medicalHealRate) * dt;
      }
    }

    if (c.condition === 'injured' || c.condition === 'sick') {
      // Without medical care or rest, severe wounds worsen slowly
      if (c.role !== 'resting' && medicalHealRate <= 0.1) {
        healthDelta -= 0.14 * dt;
      }
    }

    c.health = clamp(c.health + healthDelta, 0, 100);
    c.morale = clamp(c.morale + moraleDelta, 5, 100);
    c.loyalty = clamp(c.loyalty + loyaltyDelta, 5, 100);

    // Forced sailors who warm above 72 loyalty drop resentment
    if (c.forced && c.loyalty >= 72) {
      c.forced = false;
      events.push(`${c.name} has warmed to your captaincy and now serves loyally.`);
    }

    // Forced / mistreated crew escape risk when loyalty & morale plunge
    if (c.forced && c.loyalty < 22 && c.morale < 28 && rand() < 0.015 * dt) {
      escapedNames.push(c.name);
      events.push(`${c.name} slipped overboard onto driftwood and escaped during the watch!`);
      continue;
    }

    if (c.health <= 0) {
      casualties.push(c.name);
      events.push(`${c.name} succumbed to the harsh sea.`);
    } else {
      if (c.health >= 85 && (c.condition === 'injured' || c.condition === 'sick')) {
        c.condition = 'healthy';
      }
      // Working crew accrue experience from performing their assigned watch duties
      let updatedMember = c;
      if (!starving && !dehydrated && c.role !== 'resting') {
        const xpRes = applyXpToCrewMember(c, 0.85 * dt);
        updatedMember = xpRes.member;
        if (xpRes.leveledUpMessage) {
          levelUps.push(xpRes.leveledUpMessage);
        }
      }
      survivingCrew.push(updatedMember);
    }
  }

  const sunk = nextCond.hull <= 0 || nextCond.flooding >= 100;
  const allCrewDead = survivingCrew.length === 0;

  return {
    inventory: nextInv,
    crew: survivingCrew,
    condition: nextCond,
    activeRepairJob: nextRepairJob,
    completedRepairSection,
    events,
    levelUps,
    casualties,
    escapedNames,
    sunk,
    allCrewDead,
  };
}

export function treatCrewMember(
  crew: CrewMember[],
  memberId: string,
  inventory: Inventory
): { ok: boolean; crew: CrewMember[]; inventory: Inventory; message: string } {
  if ((inventory.medicine || 0) < 1) {
    return { ok: false, crew, inventory, message: 'No medical supplies available.' };
  }
  const idx = crew.findIndex((c) => c.id === memberId);
  if (idx === -1) {
    return { ok: false, crew, inventory, message: 'Crew member not found.' };
  }
  const target = crew[idx];
  if (target.health >= 98 && target.condition === 'healthy') {
    return { ok: false, crew, inventory, message: `${target.name} is already in good health.` };
  }

  const nextCrew = crew.map((c) =>
    c.id === memberId
      ? {
          ...c,
          health: Math.min(100, c.health + 48),
          morale: Math.min(100, c.morale + 12),
          loyalty: Math.min(100, c.loyalty + 8),
          condition: 'healthy' as const,
        }
      : c
  );

  return {
    ok: true,
    crew: nextCrew,
    inventory: { ...inventory, medicine: inventory.medicine - 1 },
    message: `Treated ${target.name} with medical supplies.`,
  };
}
