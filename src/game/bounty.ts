import {
  BountyContract,
  BountyHudState,
  BountyTargetKind,
  BountyTier,
  PirateTier,
  VesselClass,
} from './types';
import { normalizeAngle } from './waveMath';

export interface BountyTierSpec {
  tier: BountyTier;
  tierLabel: string;
  pirateTier: PirateTier;
  crownClass: VesselClass;
  rewardRange: [number, number];
  repMagnitude: number;
  rivalCount: number;
}

const BOUNTY_SPECS: Record<BountyTier, BountyTierSpec> = {
  petty: {
    tier: 'petty',
    tierLabel: 'Skirmisher Warrant',
    pirateTier: 'sloop',
    crownClass: 'crown_sloop',
    rewardRange: [180, 290],
    repMagnitude: 8,
    rivalCount: 2,
  },
  dangerous: {
    tier: 'dangerous',
    tierLabel: 'Privateer Writ',
    pirateTier: 'brigantine',
    crownClass: 'crown_corvette',
    rewardRange: [340, 520],
    repMagnitude: 12,
    rivalCount: 2,
  },
  notorious: {
    tier: 'notorious',
    tierLabel: 'High-Seas Bounty',
    pirateTier: 'galleon',
    crownClass: 'crown_frigate',
    rewardRange: [620, 880],
    repMagnitude: 16,
    rivalCount: 3,
  },
  legendary: {
    tier: 'legendary',
    tierLabel: 'Grand Admiralty Decree',
    pirateTier: 'dreadnought',
    crownClass: 'crown_ship_of_line',
    rewardRange: [950, 1380],
    repMagnitude: 22,
    rivalCount: 3,
  },
};

export function chooseBountyTargetKind(reputation: number): BountyTargetKind {
  return reputation >= 0 ? 'pirate' : 'crown';
}

export function pickBountyTier(
  reputation: number,
  playerHullTier: number,
  rand: () => number
): BountyTierSpec {
  const absRep = Math.abs(reputation);
  const score = playerHullTier + (absRep >= 50 ? 2 : absRep >= 25 ? 1 : 0);
  const r = rand();

  let tier: BountyTier = 'petty';
  if (score >= 6) {
    tier = r < 0.15 ? 'dangerous' : r < 0.55 ? 'notorious' : 'legendary';
  } else if (score >= 4) {
    tier = r < 0.2 ? 'petty' : r < 0.55 ? 'dangerous' : r < 0.88 ? 'notorious' : 'legendary';
  } else if (score >= 2) {
    tier = r < 0.35 ? 'petty' : r < 0.78 ? 'dangerous' : 'notorious';
  } else {
    tier = r < 0.65 ? 'petty' : 'dangerous';
  }
  return BOUNTY_SPECS[tier];
}

export function getBountyRewardAndRep(
  targetKind: BountyTargetKind,
  tier: BountyTier,
  rand: () => number
): { rewardGold: number; reputationDelta: number; spec: BountyTierSpec } {
  const spec = BOUNTY_SPECS[tier];
  const rawGold = spec.rewardRange[0] + rand() * (spec.rewardRange[1] - spec.rewardRange[0]);
  const rewardGold = Math.round(rawGold / 10) * 10;
  // Hunting pirates earns positive Crown/public reputation; hunting Crown warships lowers reputation.
  const reputationDelta = targetKind === 'pirate' ? spec.repMagnitude : -spec.repMagnitude;
  return { rewardGold, reputationDelta, spec };
}

const PIRATE_BOUNTY_TARGETS: Record<BountyTier, Array<{ ship: string; captain: string; cls: string }>> = {
  petty: [
    { ship: 'The Salt Rat', captain: 'Capt. Jasper Hooke', cls: 'Corsair Sloop' },
    { ship: 'Red Gull', captain: 'Capt. Bess Maddock', cls: 'Pirate Raider' },
  ],
  dangerous: [
    { ship: 'The Iron Cutlass', captain: 'Capt. Thorne Vance', cls: 'Pirate Brigantine' },
    { ship: 'Gallows Wake', captain: 'Capt. Ronan Pike', cls: 'Armed Corsair Brig' },
  ],
  notorious: [
    { ship: 'Sovereign Bane', captain: 'Capt. Valeria Rook', cls: 'Pirate War Galleon' },
    { ship: 'Ashen Marauder', captain: 'Capt. Gideon Cross', cls: 'Heavy Raider Frigate' },
  ],
  legendary: [
    { ship: 'Empress of Blackwater', captain: 'Dread Admiral Cain', cls: 'Corsair Dreadnought' },
    { ship: 'The Crimson Leviathan', captain: 'Admiral Blackwood', cls: 'Pirate Flagship' },
  ],
};

const CROWN_BOUNTY_TARGETS: Record<BountyTier, Array<{ ship: string; captain: string; cls: string }>> = {
  petty: [
    { ship: 'HMS Watchful', captain: 'Lt. Arthur Penn', cls: 'Crown Sloop' },
    { ship: 'HMS Badger', captain: 'Lt. Giles Mercer', cls: 'Crown Sloop' },
  ],
  dangerous: [
    { ship: 'HMS Vindicator', captain: 'Cmdr. Nigel Locke', cls: 'Crown Corvette' },
    { ship: 'HMS Relentless', captain: 'Cmdr. Hugh Sterling', cls: 'Crown Corvette' },
  ],
  notorious: [
    { ship: 'HMS Iron Duke', captain: 'Capt. Edward Fairfax', cls: 'Crown Frigate' },
    { ship: 'HMS Stormshield', captain: 'Capt. Lawrence Drake', cls: 'Crown Frigate' },
  ],
  legendary: [
    { ship: 'HMS Royal Sovereign', captain: 'Rear Adm. Horatio Crane', cls: 'Crown Ship of the Line' },
    { ship: 'HMS Sovereign Dreadnought', captain: 'Adm. Alistair Wolfe', cls: 'Crown Flagship' },
  ],
};

export function createBountyContract(
  id: string,
  reputation: number,
  playerHullTier: number,
  currentDay: number,
  rand: () => number
): { contract: BountyContract; spec: BountyTierSpec } {
  const targetKind = chooseBountyTargetKind(reputation);
  const spec = pickBountyTier(reputation, playerHullTier, rand);
  const { rewardGold, reputationDelta } = getBountyRewardAndRep(targetKind, spec.tier, rand);
  const pool =
    targetKind === 'pirate' ? PIRATE_BOUNTY_TARGETS[spec.tier] : CROWN_BOUNTY_TARGETS[spec.tier];
  const pick = pool[Math.floor(rand() * pool.length)];

  const contract: BountyContract = {
    id,
    targetKind,
    tier: spec.tier,
    tierLabel: spec.tierLabel,
    issuerLabel: targetKind === 'pirate' ? 'Admiralty Bounty Notice' : 'Black-Flag Syndicate Writ',
    targetShipId: `bounty_ship_${id}`,
    targetName: pick.ship,
    targetCaptain: pick.captain,
    targetShipClass: pick.cls,
    rewardGold,
    reputationDelta,
    maxHull:
      spec.tier === 'petty' ? 110 : spec.tier === 'dangerous' ? 210 : spec.tier === 'notorious' ? 370 : 620,
    rivalHunterIds: [],
    rivalHunterNames: [],
    status: 'offered',
    offeredDay: currentDay,
    expiresAtDay: currentDay + 2.5,
  };

  return { contract, spec };
}

export function computeBountyLocatorMetrics(
  playerX: number,
  playerZ: number,
  playerHeading: number,
  targetX: number,
  targetZ: number
): {
  distance: number;
  relBearingDeg: number;
  compassDeg: number;
  directionLabel: string;
} {
  const dx = targetX - playerX;
  const dz = targetZ - playerZ;
  const distance = Math.round(Math.hypot(dx, dz));
  // Heading 0 points along (0, -1); fwd = (-sin(h), -cos(h))
  const targetHeading = Math.atan2(-dx, -dz);
  const diff = normalizeAngle(targetHeading - playerHeading);
  // +relBearingDeg = starboard (right), -relBearingDeg = port (left)
  const relBearingDeg = Math.round((-diff * 180) / Math.PI);
  const compassDeg = ((Math.round((-targetHeading * 180) / Math.PI) % 360) + 360) % 360;

  const absRel = Math.abs(relBearingDeg);
  let directionLabel = 'Dead Ahead';
  if (absRel <= 15) directionLabel = 'Dead Ahead';
  else if (absRel >= 165) directionLabel = 'Astern';
  else if (relBearingDeg > 15 && relBearingDeg < 60) directionLabel = 'Bow Starboard';
  else if (relBearingDeg >= 60 && relBearingDeg <= 120) directionLabel = 'Starboard Beam';
  else if (relBearingDeg > 120) directionLabel = 'Quarter Starboard';
  else if (relBearingDeg < -15 && relBearingDeg > -60) directionLabel = 'Bow Port';
  else if (relBearingDeg <= -60 && relBearingDeg >= -120) directionLabel = 'Port Beam';
  else directionLabel = 'Quarter Port';

  return { distance, relBearingDeg, compassDeg, directionLabel };
}

export function buildBountyHudState(
  contract: BountyContract,
  playerX: number,
  playerZ: number,
  playerHeading: number,
  targetX: number,
  targetZ: number,
  targetHull: number,
  targetMaxHull: number,
  rivalHuntersAlive: number
): BountyHudState | null {
  if (contract.status !== 'offered' && contract.status !== 'active') {
    return null;
  }
  const metrics =
    contract.status === 'active'
      ? computeBountyLocatorMetrics(playerX, playerZ, playerHeading, targetX, targetZ)
      : { distance: 0, relBearingDeg: 0, compassDeg: 0, directionLabel: 'Accept Contract' };

  return {
    id: contract.id,
    status: contract.status,
    targetKind: contract.targetKind,
    tier: contract.tier,
    tierLabel: contract.tierLabel,
    issuerLabel: contract.issuerLabel,
    targetName: contract.targetName,
    targetCaptain: contract.targetCaptain,
    targetShipClass: contract.targetShipClass,
    rewardGold: contract.rewardGold,
    reputationDelta: contract.reputationDelta,
    targetHull: Math.max(0, Math.round(targetHull)),
    targetMaxHull: Math.max(1, Math.round(targetMaxHull)),
    distance: metrics.distance,
    relBearingDeg: metrics.relBearingDeg,
    compassDeg: metrics.compassDeg,
    directionLabel: metrics.directionLabel,
    rivalHuntersAlive,
    rivalHunterNames: contract.rivalHunterNames,
  };
}

export function resolveBountyKillByPlayer(
  contract: BountyContract,
  playerGold: number,
  playerReputation: number
): {
  contract: BountyContract;
  gold: number;
  reputation: number;
  message: string;
} {
  const nextRep = Math.max(-100, Math.min(100, playerReputation + contract.reputationDelta));
  const repWord = contract.reputationDelta >= 0 ? `+${contract.reputationDelta}` : `${contract.reputationDelta}`;
  return {
    contract: {
      ...contract,
      status: 'claimed_player',
      claimedByName: 'Your Ship',
    },
    gold: playerGold + contract.rewardGold,
    reputation: nextRep,
    message: `Bounty Claimed! Sank ${contract.targetName} for +${contract.rewardGold}g (${repWord} Reputation).`,
  };
}

export function resolveBountyHunterClaim(
  contract: BountyContract,
  hunterName: string,
  playerGold: number
): {
  contract: BountyContract;
  gold: number;
  message: string;
} {
  return {
    contract: {
      ...contract,
      status: 'claimed_rival',
      claimedByName: hunterName,
    },
    gold: playerGold,
    message: `${hunterName} sank ${contract.targetName} first and claimed the ${contract.rewardGold}g bounty!`,
  };
}
