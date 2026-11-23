import {
  FleetShipClass,
  FleetShipData,
  Inventory,
  MerchantShipData,
  PirateShipData,
  ShipUpgrades,
} from './types';
import { clamp, normalizeAngle } from './waveMath';

export const MAX_FLEET_SIZE = 5;

export interface FleetClassSpec {
  id: FleetShipClass;
  label: string;
  shortRole: string;
  description: string;
  goldCost: number;
  resourceCost: Partial<Inventory>;
  baseHull: number;
  baseCannons: number;
  maxCannons: number;
  baseCrew: number;
  maxCrewCap: number;
  baseCargo: number;
  baseSpeed: number;
  turnRate: number;
  gatherRates: { wood: number; iron: number; cloth: number; gold: number };
}

export const FLEET_CLASS_SPECS: Record<FleetShipClass, FleetClassSpec> = {
  fast_scout: {
    id: 'fast_scout',
    label: 'Fast Scout Sloop',
    shortRole: 'Fast Interceptor',
    description: 'Nimble single-masted cutter that chases fleeing raiders and screens the flank.',
    goldCost: 260,
    resourceCost: { wood: 16, iron: 6, cloth: 10 },
    baseHull: 120,
    baseCannons: 2,
    maxCannons: 6,
    baseCrew: 6,
    maxCrewCap: 14,
    baseCargo: 36,
    baseSpeed: 10.8,
    turnRate: 0.92,
    gatherRates: { wood: 0.7, iron: 0.25, cloth: 0.4, gold: 4.5 },
  },
  medium_armed: {
    id: 'medium_armed',
    label: 'Medium Armed Brigantine',
    shortRole: 'Line Escort',
    description: 'Balanced twin-masted warship built for broadside exchanges and convoy patrol.',
    goldCost: 440,
    resourceCost: { wood: 26, iron: 12, cloth: 12 },
    baseHull: 210,
    baseCannons: 6,
    maxCannons: 14,
    baseCrew: 12,
    maxCrewCap: 26,
    baseCargo: 68,
    baseSpeed: 9.2,
    turnRate: 0.72,
    gatherRates: { wood: 0.9, iron: 0.45, cloth: 0.45, gold: 6.2 },
  },
  large_merchant: {
    id: 'large_merchant',
    label: 'Large Merchant Indiaman',
    shortRole: 'Autonomous Trader',
    description: 'Deep-hulled trading ship generating steady gold and rare freight while defending itself.',
    goldCost: 620,
    resourceCost: { wood: 34, iron: 14, cloth: 18, tools: 2 },
    baseHull: 265,
    baseCannons: 6,
    maxCannons: 12,
    baseCrew: 14,
    maxCrewCap: 28,
    baseCargo: 165,
    baseSpeed: 7.9,
    turnRate: 0.56,
    gatherRates: { wood: 1.0, iron: 0.4, cloth: 0.85, gold: 11.5 },
  },
  heavy_warship: {
    id: 'heavy_warship',
    label: 'Heavy Line Warship',
    shortRole: 'Heavy Broadside',
    description: 'Heavily timbered multi-deck frigate carrying devastating broadsides and iron plating.',
    goldCost: 880,
    resourceCost: { wood: 44, iron: 24, cloth: 16, reinforcedMetals: 3, rareMaterials: 2 },
    baseHull: 390,
    baseCannons: 12,
    maxCannons: 24,
    baseCrew: 22,
    maxCrewCap: 46,
    baseCargo: 85,
    baseSpeed: 7.5,
    turnRate: 0.48,
    gatherRates: { wood: 1.1, iron: 0.85, cloth: 0.5, gold: 7.5 },
  },
  supply_vessel: {
    id: 'supply_vessel',
    label: 'Specialised Supply Vessel',
    shortRole: 'Fleet Tender',
    description: 'Armored support ship that gathers repair timber, stores, and keeps damaged allies afloat.',
    goldCost: 500,
    resourceCost: { wood: 26, iron: 10, cloth: 16, tools: 1 },
    baseHull: 240,
    baseCannons: 4,
    maxCannons: 10,
    baseCrew: 11,
    maxCrewCap: 22,
    baseCargo: 130,
    baseSpeed: 8.5,
    turnRate: 0.64,
    gatherRates: { wood: 1.55, iron: 0.65, cloth: 0.75, gold: 5.5 },
  },
};

export const FLEET_CLASS_ORDER: FleetShipClass[] = [
  'fast_scout',
  'medium_armed',
  'large_merchant',
  'heavy_warship',
  'supply_vessel',
];

const FLEET_PREFIXES = ['HMS', 'SS', 'Swift', 'Noble', 'Golden', 'Iron', 'Sovereign', 'Storm'];
const FLEET_NOUNS = [
  'Vanguard',
  'Horizon',
  'Mariner',
  'Corsair',
  'Defiance',
  'Albatross',
  'Trident',
  'Endeavour',
  'Tempest',
  'Centurion',
];

export interface FleetUnlockStatus {
  unlocked: boolean;
  hullMet: boolean;
  crewMet: boolean;
  minGoldRequired: number;
  goldMet: boolean;
  reason: string;
}

export function getFleetUnlockStatus(
  upgrades: ShipUpgrades,
  crewCount: number,
  gold: number
): FleetUnlockStatus {
  const hullMet = upgrades.hullTier >= 3;
  const crewMet = crewCount >= 12;
  const minGoldRequired = 260;
  const goldMet = gold >= minGoldRequired;
  const unlocked = hullMet && crewMet;

  let reason = 'Fleet Admiralty unlocked! You may purchase ships or claim salvageable vessels.';
  if (!hullMet && !crewMet) {
    reason = `Requires Hull Tier 3 (current Tier ${upgrades.hullTier}) & 12 crew (current ${crewCount}).`;
  } else if (!hullMet) {
    reason = `Requires Hull Tier 3 or higher (current Tier ${upgrades.hullTier}).`;
  } else if (!crewMet) {
    reason = `Requires at least 12 loyal crew aboard your flagship (current ${crewCount}/12).`;
  }

  return { unlocked, hullMet, crewMet, minGoldRequired, goldMet, reason };
}

/**
 * High recruitment cost for pressing a salvageable defeated enemy vessel into service,
 * reflecting heavy prize-crew pay, refitting, and hull salvage repairs.
 */
export function computeFleetRecruitCost(ship: {
  tier?: PirateShipData['tier'] | MerchantShipData['tier'];
  vesselClass?: MerchantShipData['vesselClass'];
  isFlagship?: boolean;
  cannons: number;
  crewCount: number;
  maxHull: number;
  hull: number;
}): number {
  let tierBase = 680;
  if (ship.tier === 'sloop') tierBase = 580;
  else if (ship.tier === 'brigantine') tierBase = 1350;
  else if (ship.tier === 'galleon') tierBase = 2650;
  else if (ship.tier === 'dreadnought') tierBase = 4800;
  else if (ship.vesselClass) {
    if (ship.vesselClass.includes('flagship') || ship.vesselClass.includes('ship_of_line')) tierBase = 5200;
    else if (ship.vesselClass.includes('warship') || ship.vesselClass.includes('treasure')) tierBase = 3600;
    else if (ship.vesselClass.includes('frigate') || ship.vesselClass.includes('large') || ship.vesselClass.includes('wealthy')) tierBase = 2450;
    else if (ship.vesselClass.includes('corvette') || ship.vesselClass.includes('medium')) tierBase = 1400;
    else tierBase = 650;
  }

  const cannonValue = Math.max(0, ship.cannons) * 65;
  const crewValue = Math.max(0, ship.crewCount) * 24;
  const flagshipBonus = ship.isFlagship ? 950 : 0;
  const damagePct = 1 - clamp(ship.hull / Math.max(1, ship.maxHull), 0, 1);
  const repairSurcharge = Math.round(damagePct * tierBase * 0.35);

  return Math.round(tierBase + cannonValue + crewValue + flagshipBonus + repairSurcharge);
}

export function computeFleetCaptureCost(pirate: PirateShipData): number {
  return computeFleetRecruitCost(pirate);
}

export function mapPirateToFleetClass(pirate: PirateShipData): FleetShipClass {
  if (pirate.tier === 'sloop') return 'fast_scout';
  if (pirate.tier === 'brigantine') return 'medium_armed';
  if (pirate.tier === 'galleon') return pirate.isFlagship ? 'heavy_warship' : 'large_merchant';
  return 'heavy_warship';
}

export function mapMerchantToFleetClass(vessel: MerchantShipData): FleetShipClass {
  if (vessel.vesselClass === 'fishing_boat' || vessel.vesselClass === 'small_merchant' || vessel.vesselClass === 'crown_patrol' || vessel.vesselClass === 'crown_sloop') {
    return 'fast_scout';
  }
  if (vessel.vesselClass === 'supply_ship' || vessel.vesselClass === 'crown_supply') {
    return 'supply_vessel';
  }
  if (vessel.vesselClass === 'medium_merchant' || vessel.vesselClass === 'crown_corvette') {
    return 'medium_armed';
  }
  if (vessel.vesselClass === 'large_cargo' || vessel.vesselClass === 'passenger_ship' || vessel.vesselClass === 'wealthy_trader') {
    return 'large_merchant';
  }
  return 'heavy_warship';
}

export function createFleetShip(
  id: string,
  shipClass: FleetShipClass,
  slotIndex: number,
  x: number,
  z: number,
  heading: number,
  rand: () => number,
  customName?: string
): FleetShipData {
  const spec = FLEET_CLASS_SPECS[shipClass];
  const autoName =
    customName?.trim() ||
    `${FLEET_PREFIXES[Math.floor(rand() * FLEET_PREFIXES.length)]} ${
      FLEET_NOUNS[Math.floor(rand() * FLEET_NOUNS.length)]
    }`;

  return {
    id,
    name: autoName,
    shipClass,
    hullTier: shipClass === 'heavy_warship' ? 2 : 1,
    deckLevel: shipClass === 'heavy_warship' ? 1 : 0,
    hull: spec.baseHull,
    maxHull: spec.baseHull,
    cannons: spec.baseCannons,
    maxCannons: spec.maxCannons,
    cannonTier: 1,
    crewCount: spec.baseCrew,
    maxCrew: spec.maxCrewCap,
    cargoCapacity: spec.baseCargo,
    speed: 0,
    maxSpeed: spec.baseSpeed,
    turnRate: spec.turnRate,
    command: 'follow',
    slotIndex,
    x,
    z,
    heading,
    autonomousResources: { wood: 8, iron: 4, cloth: 4, gold: 40, food: 35, water: 35 },
    upgradeProgress: 0,
    upgradeStage: 1,
    targetEnemyId: null,
    reloadTimer: 1.5,
    sunk: false,
    sinkProgress: 0,
  };
}

export function createFleetShipFromDefeated(
  id: string,
  pirate: PirateShipData,
  slotIndex: number,
  x: number,
  z: number,
  heading: number,
  rand: () => number
): FleetShipData {
  const shipClass = mapPirateToFleetClass(pirate);
  const base = createFleetShip(id, shipClass, slotIndex, x, z, heading, rand, pirate.name);
  return {
    ...base,
    hull: Math.round(base.maxHull * 0.78),
    cannons: Math.min(base.maxCannons, Math.max(base.cannons, Math.round(pirate.cannons * 0.8))),
    crewCount: Math.min(base.maxCrew, Math.max(base.crewCount, Math.round(pirate.maxCrew * 0.55))),
  };
}

export function createFleetShipFromMerchant(
  id: string,
  merchant: MerchantShipData,
  slotIndex: number,
  x: number,
  z: number,
  heading: number,
  rand: () => number
): FleetShipData {
  const shipClass = mapMerchantToFleetClass(merchant);
  const base = createFleetShip(id, shipClass, slotIndex, x, z, heading, rand, merchant.name);
  return {
    ...base,
    hull: Math.round(base.maxHull * 0.78),
    cannons: Math.min(base.maxCannons, Math.max(base.cannons, merchant.cannons)),
    crewCount: Math.min(base.maxCrew, Math.max(base.crewCount, Math.round(merchant.maxCrew * 0.55))),
  };
}

export function computeWedgeFormationTarget(
  playerX: number,
  playerZ: number,
  playerHeading: number,
  slotIndex: number,
  flagshipHalfLength = 8
): { x: number; z: number } {
  const rank = Math.floor(slotIndex / 2) + 1;
  const side = slotIndex % 2 === 0 ? 1 : -1;
  const localRight = slotIndex === 4 ? 0 : side * (24 + rank * 18);
  const localBack = flagshipHalfLength + (slotIndex === 4 ? 72 : 24 + rank * 25);

  const cos = Math.cos(playerHeading);
  const sin = Math.sin(playerHeading);
  const worldX = playerX + localRight * cos + localBack * sin;
  const worldZ = playerZ - localRight * sin + localBack * cos;
  return { x: worldX, z: worldZ };
}

export interface FleetAutonomyTickResult {
  ship: FleetShipData;
  upgraded: boolean;
  upgradeSummary: string | null;
  supplyGift: Partial<Inventory> | null;
}

export function stepFleetAutonomy(
  ship: FleetShipData,
  dt: number,
  inCombat: boolean,
  rand: () => number
): FleetAutonomyTickResult {
  const spec = FLEET_CLASS_SPECS[ship.shipClass];
  const next: FleetShipData = {
    ...ship,
    autonomousResources: {
      food: 35,
      water: 35,
      ...ship.autonomousResources,
    },
  };

  if (next.sunk || next.hull <= 0) {
    return { ship: next, upgraded: false, upgradeSummary: null, supplyGift: null };
  }

  // 1. Gather wood, iron, cloth, gold, and autonomous provisions/water
  const mult = inCombat ? 0.45 : 1.0;
  next.autonomousResources.wood += spec.gatherRates.wood * mult * dt * 0.25;
  next.autonomousResources.iron += spec.gatherRates.iron * mult * dt * 0.25;
  next.autonomousResources.cloth += spec.gatherRates.cloth * mult * dt * 0.25;
  next.autonomousResources.gold += spec.gatherRates.gold * mult * dt * 0.22;

  // Autonomous provisions & water restocking cycle without player micromanagement
  next.autonomousResources.food = clamp((next.autonomousResources.food ?? 35) - dt * 0.04, 0, 120);
  next.autonomousResources.water = clamp((next.autonomousResources.water ?? 35) - dt * 0.05, 0, 120);
  if ((next.autonomousResources.food ?? 0) < 18 && next.autonomousResources.gold >= 20) {
    next.autonomousResources.gold -= 16;
    next.autonomousResources.food = Math.min(100, (next.autonomousResources.food ?? 0) + 40);
  }
  if ((next.autonomousResources.water ?? 0) < 18 && next.autonomousResources.gold >= 15) {
    next.autonomousResources.gold -= 12;
    next.autonomousResources.water = Math.min(100, (next.autonomousResources.water ?? 0) + 42);
  }

  // 2. Self-repair damage automatically using gathered timber when safely out of active fire
  if (next.hull < next.maxHull && next.autonomousResources.wood >= 1.5 && !inCombat) {
    const repairAmt = Math.min(next.maxHull - next.hull, 3.8 * dt);
    next.hull += repairAmt;
    next.autonomousResources.wood = Math.max(0, next.autonomousResources.wood - repairAmt * 0.14);
  }

  // 3. Recruit replacement crew up to vessel capacity
  if (next.crewCount < next.maxCrew && next.autonomousResources.gold >= 38 && rand() < 0.08 * dt) {
    next.autonomousResources.gold -= 32;
    next.crewCount = Math.min(next.maxCrew, next.crewCount + 1);
  }

  // 4. Gradual autonomous upgrades
  const woodReq = 14 + next.hullTier * 10;
  const ironReq = 6 + next.hullTier * 6;
  const clothReq = 6 + next.hullTier * 5;
  const goldReq = 90 + next.hullTier * 85;

  const canUpgradeMore =
    next.hullTier < 5 || next.cannons < next.maxCannons || next.cannonTier < 4 || next.deckLevel < 2;

  let upgraded = false;
  let upgradeSummary: string | null = null;

  if (canUpgradeMore) {
    const readiness = Math.min(
      1,
      (next.autonomousResources.wood / woodReq +
        next.autonomousResources.iron / ironReq +
        next.autonomousResources.cloth / clothReq +
        next.autonomousResources.gold / goldReq) /
        4
    );
    next.upgradeProgress = clamp(next.upgradeProgress + dt * (0.014 + readiness * 0.018), 0, 1);

    if (
      next.upgradeProgress >= 1 &&
      next.autonomousResources.wood >= woodReq * 0.7 &&
      next.autonomousResources.gold >= goldReq * 0.7
    ) {
      next.autonomousResources.wood = Math.max(0, next.autonomousResources.wood - woodReq * 0.7);
      next.autonomousResources.iron = Math.max(0, next.autonomousResources.iron - ironReq * 0.65);
      next.autonomousResources.cloth = Math.max(0, next.autonomousResources.cloth - clothReq * 0.65);
      next.autonomousResources.gold = Math.max(0, next.autonomousResources.gold - goldReq * 0.7);
      next.upgradeProgress = 0;
      next.upgradeStage += 1;
      upgraded = true;

      if (next.hullTier < 5 && (next.upgradeStage % 2 === 0 || next.hullTier < 2)) {
        next.hullTier += 1;
        next.maxHull = Math.round(next.maxHull * 1.24);
        next.hull = next.maxHull;
        next.cargoCapacity = Math.round(next.cargoCapacity * 1.18);
        if (next.hullTier >= 3 && next.deckLevel < 2) {
          next.deckLevel += 1;
        }
        upgradeSummary = `${next.name} reinforced & expanded to Hull Tier ${next.hullTier} (${next.maxHull} HP)!`;
      } else if (next.cannons < next.maxCannons) {
        const addedGuns = Math.min(2, next.maxCannons - next.cannons);
        next.cannons += addedGuns;
        next.cannonTier = Math.min(4, next.cannonTier + (next.upgradeStage % 3 === 0 ? 1 : 0));
        upgradeSummary = `${next.name} mounted +${addedGuns} cannons (${next.cannons} guns total)!`;
      } else {
        next.cannonTier = Math.min(4, next.cannonTier + 1);
        next.maxHull += 35;
        next.hull = next.maxHull;
        upgradeSummary = `${next.name} upgraded heavy ordnance to Grade ${next.cannonTier}!`;
      }
    }
  } else {
    next.upgradeProgress = 1;
  }

  // 5. Supply vessel tenders share spare provisions & timber with player flagship
  let supplyGift: Partial<Inventory> | null = null;
  if (
    ship.shipClass === 'supply_vessel' &&
    !inCombat &&
    next.autonomousResources.wood >= 12 &&
    rand() < 0.045 * dt
  ) {
    next.autonomousResources.wood -= 4;
    supplyGift = {
      wood: 3,
      food: 4,
      water: 4,
      cannonballs: 2,
    };
  }

  return { ship: next, upgraded, upgradeSummary, supplyGift };
}

export function steerFleetShipHeading(
  ship: FleetShipData,
  targetHeading: number,
  desiredSpeed: number,
  dt: number
): { heading: number; speed: number; x: number; z: number } {
  const diff = normalizeAngle(targetHeading - ship.heading);
  const maxTurn = ship.turnRate * dt;
  const heading = normalizeAngle(ship.heading + clamp(diff, -maxTurn, maxTurn));
  const speed = ship.speed + (desiredSpeed - ship.speed) * clamp(dt * 1.8, 0, 1);
  const x = ship.x - Math.sin(heading) * speed * dt;
  const z = ship.z - Math.cos(heading) * speed * dt;
  return { heading, speed, x, z };
}
