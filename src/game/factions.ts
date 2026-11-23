import {
  FactionRelation,
  FlagEmblemId,
  MerchantShipData,
  PirateFactionId,
  PirateFactionState,
  PirateRank,
  PirateShipData,
} from './types';
import { clamp } from './waveMath';

export interface PirateFactionMeta {
  id: PirateFactionId;
  name: string;
  shortName: string;
  motto: string;
  emblem: FlagEmblemId;
  sailColor: string;
  hullTint: string;
  flagPrimary: string;
  flagSecondary: string;
  coatColor: string;
  personality: PirateShipData['personality'];
  leaderName: string;
  flagshipName: string;
  territoryDesc: string;
  centerX: number;
  centerZ: number;
  radius: number;
}

export const PIRATE_FACTIONS: Record<PirateFactionId, PirateFactionMeta> = {
  crimson_corsairs: {
    id: 'crimson_corsairs',
    name: 'The Crimson Corsairs',
    shortName: 'Crimson Corsairs',
    motto: 'No Quarter Beneath the Red Pennant',
    emblem: 'crossed_swords',
    sailColor: '#6d1d1d',
    hullTint: '#361c18',
    flagPrimary: '#991b1b',
    flagSecondary: '#111827',
    coatColor: '#7f1d1d',
    personality: 'ruthless',
    leaderName: 'Dread Admiral Red-Blade Vance',
    flagshipName: 'Blood Sovereign',
    territoryDesc: 'Eastern Trade Lanes',
    centerX: 1650,
    centerZ: -350,
    radius: 1050,
  },
  iron_brotherhood: {
    id: 'iron_brotherhood',
    name: 'The Iron Brotherhood',
    shortName: 'Iron Brotherhood',
    motto: 'Forged in Salt, Bound by Cannon',
    emblem: 'anchor',
    sailColor: '#374151',
    hullTint: '#262930',
    flagPrimary: '#334155',
    flagSecondary: '#b45309',
    coatColor: '#334155',
    personality: 'honorable',
    leaderName: 'Lord Admiral Ironjaw Rook',
    flagshipName: 'The Anvil Bastion',
    territoryDesc: 'Northern Mist Currents',
    centerX: -150,
    centerZ: -1750,
    radius: 1050,
  },
  gilded_vultures: {
    id: 'gilded_vultures',
    name: 'The Gilded Vultures',
    shortName: 'Gilded Vultures',
    motto: 'Every Hold Pays Toll',
    emblem: 'crown',
    sailColor: '#6b4f1d',
    hullTint: '#3a2b14',
    flagPrimary: '#92400e',
    flagSecondary: '#facc15',
    coatColor: '#78350f',
    personality: 'greedy',
    leaderName: 'Grand Corsair Aurelia Vane',
    flagshipName: 'Sovereign Avarice',
    territoryDesc: 'Southern Bullion Waters',
    centerX: 350,
    centerZ: 1700,
    radius: 1050,
  },
  abyssal_fleet: {
    id: 'abyssal_fleet',
    name: 'The Abyssal Fleet',
    shortName: 'Abyssal Fleet',
    motto: 'What Sinks Is Ours',
    emblem: 'kraken',
    sailColor: '#13383b',
    hullTint: '#132428',
    flagPrimary: '#0f766e',
    flagSecondary: '#090d16',
    coatColor: '#115e59',
    personality: 'fanatic',
    leaderName: 'High Captain Corvus of the Deep',
    flagshipName: 'Leviathan’s Wake',
    territoryDesc: 'Western Abyssal Trench',
    centerX: -1700,
    centerZ: 220,
    radius: 1100,
  },
  tempest_reavers: {
    id: 'tempest_reavers',
    name: 'The Tempest Reavers',
    shortName: 'Tempest Reavers',
    motto: 'Ride the Squall, Claim the Wreck',
    emblem: 'sunburst',
    sailColor: '#1e3a5f',
    hullTint: '#1e293b',
    flagPrimary: '#1d4ed8',
    flagSecondary: '#e2e8f0',
    coatColor: '#1e40af',
    personality: 'ruthless',
    leaderName: 'Storm-King Haldor Vex',
    flagshipName: 'Galebreaker Rex',
    territoryDesc: 'Northeastern Storm Strait',
    centerX: 1650,
    centerZ: -1650,
    radius: 1000,
  },
  scarlet_sisterhood: {
    id: 'scarlet_sisterhood',
    name: 'The Scarlet Sisterhood',
    shortName: 'Scarlet Sisterhood',
    motto: 'Velvet Sails, Merciless Steel',
    emblem: 'serpent',
    sailColor: '#6b1d45',
    hullTint: '#36192b',
    flagPrimary: '#9d174d',
    flagSecondary: '#fde047',
    coatColor: '#831843',
    personality: 'honorable',
    leaderName: 'Queen Corsair Morgana Red',
    flagshipName: 'Rose of Ruin',
    territoryDesc: 'Southeastern Spice Passage',
    centerX: 1750,
    centerZ: 1550,
    radius: 1000,
  },
  ashen_raiders: {
    id: 'ashen_raiders',
    name: 'The Ashen Raiders',
    shortName: 'Ashen Raiders',
    motto: 'Burn the Colors, Take the Gold',
    emblem: 'skull',
    sailColor: '#3f2e26',
    hullTint: '#292524',
    flagPrimary: '#44403c',
    flagSecondary: '#ea580c',
    coatColor: '#57534e',
    personality: 'fanatic',
    leaderName: 'Warchief Calder Ash',
    flagshipName: 'Cinder Sovereign',
    territoryDesc: 'Northwestern Cold Reach',
    centerX: -1650,
    centerZ: -1580,
    radius: 1000,
  },
  emerald_marauders: {
    id: 'emerald_marauders',
    name: 'The Emerald Marauders',
    shortName: 'Emerald Marauders',
    motto: 'Swift Hulls, Full Vaults',
    emblem: 'trident',
    sailColor: '#194d33',
    hullTint: '#1a2e22',
    flagPrimary: '#15803d',
    flagSecondary: '#facc15',
    coatColor: '#166534',
    personality: 'greedy',
    leaderName: 'Commodore Veridian Locke',
    flagshipName: 'Jade Brigand',
    territoryDesc: 'Southwestern Trade Belt',
    centerX: -1600,
    centerZ: 1620,
    radius: 1000,
  },
  obsidian_armada: {
    id: 'obsidian_armada',
    name: 'The Obsidian Armada',
    shortName: 'Obsidian Armada',
    motto: 'Night Swallows Every Mast',
    emblem: 'dragon_crest',
    sailColor: '#18181b',
    hullTint: '#111116',
    flagPrimary: '#09090b',
    flagSecondary: '#a855f7',
    coatColor: '#27272a',
    personality: 'ruthless',
    leaderName: 'Grand Admiral Malakor',
    flagshipName: 'Black Eclipse',
    territoryDesc: 'Far Outer Abyss',
    centerX: 2550,
    centerZ: -200,
    radius: 1200,
  },
  siren_cutthroats: {
    id: 'siren_cutthroats',
    name: 'The Siren Cutthroats',
    shortName: 'Siren Cutthroats',
    motto: 'Heed the Mist, Surrender All',
    emblem: 'kraken',
    sailColor: '#3b245e',
    hullTint: '#25193a',
    flagPrimary: '#6d28d9',
    flagSecondary: '#22d3ee',
    coatColor: '#5b21b6',
    personality: 'greedy',
    leaderName: 'Mistress Veyra Graves',
    flagshipName: 'Siren’s Toll',
    territoryDesc: 'Far Western Mist Banks',
    centerX: -2550,
    centerZ: -450,
    radius: 1200,
  },
};

export const PIRATE_FACTION_IDS: PirateFactionId[] = [
  'crimson_corsairs',
  'iron_brotherhood',
  'gilded_vultures',
  'abyssal_fleet',
  'tempest_reavers',
  'scarlet_sisterhood',
  'ashen_raiders',
  'emerald_marauders',
  'obsidian_armada',
  'siren_cutthroats',
];

export const PIRATE_RANK_TITLES: Record<PirateRank, string> = {
  1: 'Pirate Sailor',
  2: 'Experienced Raider',
  3: 'Pirate Officer',
  4: 'Fleet Captain',
  5: 'Pirate Admiral',
  6: 'Faction Leader',
};

function buildDefaultRelations(ownerIdx: number): Record<PirateFactionId, FactionRelation> {
  const rels = {} as Record<PirateFactionId, FactionRelation>;
  for (let i = 0; i < PIRATE_FACTION_IDS.length; i++) {
    const id = PIRATE_FACTION_IDS[i];
    if (i === ownerIdx) {
      rels[id] = 'allied';
    } else if ((ownerIdx + i) % 3 === 0) {
      rels[id] = 'allied';
    } else if ((ownerIdx + i) % 2 === 1) {
      rels[id] = 'war';
    } else {
      rels[id] = 'neutral';
    }
  }
  return rels;
}

export function createInitialFactions(): Record<PirateFactionId, PirateFactionState> {
  const out = {} as Record<PirateFactionId, PirateFactionState>;
  PIRATE_FACTION_IDS.forEach((id, idx) => {
    const meta = PIRATE_FACTIONS[id];
    out[id] = {
      id,
      name: meta.name,
      playerStanding: idx % 3 === 0 ? -8 : 0,
      alliedUntilDay: 0,
      strength: 76 + ((idx * 7) % 18),
      leaderDefeated: false,
      territoryRadius: meta.radius,
      centerX: meta.centerX,
      centerZ: meta.centerZ,
      relations: buildDefaultRelations(idx),
    };
  });
  return out;
}

export function normalizeFactionsMap(
  raw: Partial<Record<PirateFactionId, PirateFactionState>> | undefined
): Record<PirateFactionId, PirateFactionState> {
  const defaults = createInitialFactions();
  if (!raw) return defaults;
  const out = {} as Record<PirateFactionId, PirateFactionState>;
  for (const id of PIRATE_FACTION_IDS) {
    const base = defaults[id];
    const saved = raw[id];
    out[id] = saved
      ? {
          ...base,
          ...saved,
          relations: { ...base.relations, ...(saved.relations || {}) },
        }
      : base;
  }
  return out;
}

export function getDominantFactionForPosition(
  x: number,
  z: number,
  factions: Record<PirateFactionId, PirateFactionState>,
  rand: () => number
): PirateFactionId {
  let bestId: PirateFactionId = PIRATE_FACTION_IDS[Math.floor(rand() * PIRATE_FACTION_IDS.length)];
  let bestScore = -Infinity;

  for (const id of PIRATE_FACTION_IDS) {
    const f = factions[id];
    if (!f) continue;
    const d = Math.hypot(x - f.centerX, z - f.centerZ);
    const score = (f.territoryRadius - d) * 0.01 + f.strength * 0.04 + rand() * 4;
    if (score > bestScore) {
      bestScore = score;
      bestId = id;
    }
  }
  return bestId;
}

export function getReputationTitle(reputation: number): string {
  if (reputation >= 70) return 'Honored Sea Guardian';
  if (reputation >= 35) return 'Respected Captain';
  if (reputation >= 12) return 'Trusted Mariner';
  if (reputation > -15) return 'Neutral Sailor';
  if (reputation > -40) return 'Suspect Privateer';
  if (reputation > -70) return 'Notorious Pirate';
  return 'Feared Outlaw';
}

export function isPlayerPirateAligned(reputation: number): boolean {
  return reputation <= -40;
}

export interface ReputationMerchantPolicy {
  willTrade: boolean;
  priceMultiplier: number;
  refusalReason?: string;
  crownHuntsPlayer: boolean;
  canOfferCrownRepair: boolean;
}

export function getMerchantReputationBehavior(
  reputation: number,
  isCrown: boolean,
  merchant?: MerchantShipData
): ReputationMerchantPolicy {
  if (merchant?.hostileToPlayer || merchant?.fleeingFromPlayer) {
    return {
      willTrade: false,
      priceMultiplier: 1.5,
      refusalReason: `${merchant.name} refuses to trade peacefully after hostilities.`,
      crownHuntsPlayer: isCrown && reputation <= -25,
      canOfferCrownRepair: false,
    };
  }

  if (isCrown) {
    if (reputation <= -25) {
      return {
        willTrade: false,
        priceMultiplier: 1.5,
        refusalReason: 'The Crown Navy recognizes your black flag and opens gunports!',
        crownHuntsPlayer: true,
        canOfferCrownRepair: false,
      };
    }
    return {
      willTrade: reputation >= 0,
      priceMultiplier: reputation >= 40 ? 0.88 : 1.05,
      refusalReason:
        reputation < 0
          ? 'Crown quartermasters reserve stores for Captains of fair standing.'
          : undefined,
      crownHuntsPlayer: false,
      // Strict rule: NO free repairs from Crown or traders; manual player repairs only.
      canOfferCrownRepair: false,
    };
  }

  if (reputation <= -50) {
    return {
      willTrade: false,
      priceMultiplier: 1.45,
      refusalReason: 'Merchant crews bar their hatches and refuse trade with a Feared Outlaw!',
      crownHuntsPlayer: false,
      canOfferCrownRepair: false,
    };
  }

  if (reputation <= -20) {
    return {
      willTrade: true,
      priceMultiplier: 1.28,
      crownHuntsPlayer: false,
      canOfferCrownRepair: false,
    };
  }

  if (reputation >= 50) {
    return {
      willTrade: true,
      priceMultiplier: 0.84,
      crownHuntsPlayer: false,
      canOfferCrownRepair: false,
    };
  }

  if (reputation >= 20) {
    return {
      willTrade: true,
      priceMultiplier: 0.92,
      crownHuntsPlayer: false,
      canOfferCrownRepair: false,
    };
  }

  return {
    willTrade: true,
    priceMultiplier: 1.0,
    crownHuntsPlayer: false,
    canOfferCrownRepair: false,
  };
}

export function decideInnocentReaction(
  vessel: MerchantShipData,
  attackerStrength: number,
  rand: () => number
): 'surrender' | 'flee' | 'fight' {
  if (vessel.surrenderedToPlayer) return 'surrender';

  const hullRatio = vessel.hull / Math.max(1, vessel.maxHull);
  const vesselPower = vessel.cannons * 18 + vessel.crewCount * 3 + hullRatio * 35;

  if (vessel.isCrown && hullRatio > 0.24) {
    return 'fight';
  }
  if (vessel.isFishingTrawler || vessel.cannons <= 0) {
    return attackerStrength > vesselPower * 0.9 && rand() < 0.72 ? 'surrender' : 'flee';
  }
  if (hullRatio < 0.32 || attackerStrength > vesselPower * 2.1) {
    return rand() < 0.68 ? 'surrender' : 'flee';
  }
  if (vesselPower >= attackerStrength * 0.95) {
    return rand() < 0.72 ? 'fight' : 'flee';
  }
  return rand() < 0.45 ? 'flee' : 'surrender';
}

export function shiftFactionStanding(
  factions: Record<PirateFactionId, PirateFactionState>,
  factionId: PirateFactionId,
  delta: number
): Record<PirateFactionId, PirateFactionState> {
  const next = { ...factions };
  if (!next[factionId]) return next;
  const target = { ...next[factionId] };
  target.playerStanding = clamp(Math.round(target.playerStanding + delta), -100, 100);
  next[factionId] = target;

  for (const otherId of PIRATE_FACTION_IDS) {
    if (otherId === factionId || !next[otherId]) continue;
    const rel = target.relations[otherId];
    const other = { ...next[otherId] };
    if (rel === 'allied') {
      other.playerStanding = clamp(Math.round(other.playerStanding + delta * 0.35), -100, 100);
    } else if (rel === 'war' && delta < 0) {
      other.playerStanding = clamp(Math.round(other.playerStanding + Math.abs(delta) * 0.25), -100, 100);
    }
    next[otherId] = other;
  }

  return next;
}

export function applyLeaderDefeatConsequences(
  factions: Record<PirateFactionId, PirateFactionState>,
  defeatedFactionId: PirateFactionId
): {
  factions: Record<PirateFactionId, PirateFactionState>;
  summary: string;
} {
  const next: Record<PirateFactionId, PirateFactionState> = { ...factions };
  if (!next[defeatedFactionId]) {
    return { factions: next, summary: 'Rival faction commander defeated.' };
  }
  const defeated = { ...next[defeatedFactionId] };
  defeated.leaderDefeated = true;
  defeated.strength = Math.max(20, defeated.strength - 42);
  defeated.territoryRadius = Math.max(550, defeated.territoryRadius - 320);
  next[defeatedFactionId] = defeated;

  let rivalId: PirateFactionId | null = null;
  let bestStr = -1;
  for (const id of PIRATE_FACTION_IDS) {
    if (id === defeatedFactionId || !next[id]) continue;
    if (defeated.relations[id] === 'war' && next[id].strength > bestStr) {
      bestStr = next[id].strength;
      rivalId = id;
    }
  }
  if (rivalId) {
    const rival = { ...next[rivalId] };
    rival.strength = Math.min(100, rival.strength + 14);
    rival.territoryRadius = Math.min(1750, rival.territoryRadius + 240);
    next[rivalId] = rival;
    return {
      factions: next,
      summary: `${defeated.name} lost their Faction Leader! ${rival.name} are seizing their abandoned sea lanes.`,
    };
  }

  return {
    factions: next,
    summary: `${defeated.name} lost their Faction Leader, throwing their remaining raiders into disarray.`,
  };
}

export function evolveFactionDiplomacy(
  factions: Record<PirateFactionId, PirateFactionState>,
  rand: () => number
): { factions: Record<PirateFactionId, PirateFactionState>; headline: string | null } {
  const aIdx = Math.floor(rand() * PIRATE_FACTION_IDS.length);
  let bIdx = Math.floor(rand() * PIRATE_FACTION_IDS.length);
  if (bIdx === aIdx) bIdx = (aIdx + 1) % PIRATE_FACTION_IDS.length;

  const idA = PIRATE_FACTION_IDS[aIdx];
  const idB = PIRATE_FACTION_IDS[bIdx];
  const fa = { ...factions[idA], relations: { ...factions[idA].relations } };
  const fb = { ...factions[idB], relations: { ...factions[idB].relations } };
  const current = fa.relations[idB];

  let nextRel: FactionRelation = current;
  let headline: string | null = null;

  if (current === 'war' && rand() < 0.45) {
    nextRel = 'neutral';
    headline = `Truce Declared: ${fa.name} and ${fb.name} halted open fleet hostilities.`;
  } else if (current === 'neutral') {
    if (rand() < 0.55) {
      nextRel = 'war';
      headline = `Pirate War: ${fa.name} declared blood feud against ${fb.name}!`;
    } else {
      nextRel = 'allied';
      headline = `Black Pact: ${fa.name} and ${fb.name} formed a temporary corsair alliance.`;
    }
  } else if (current === 'allied' && rand() < 0.5) {
    nextRel = 'war';
    headline = `Betrayal at Sea: ${fa.name} broke pact and ambushed ${fb.name}!`;
  }

  if (nextRel === current) return { factions, headline: null };

  fa.relations[idB] = nextRel;
  fb.relations[idA] = nextRel;
  return {
    factions: { ...factions, [idA]: fa, [idB]: fb },
    headline,
  };
}

export function isPirateAlliedWithPlayer(
  faction: PirateFactionState | undefined,
  currentDay: number,
  playerReputation = 0
): boolean {
  if (isPlayerPirateAligned(playerReputation)) return true;
  if (!faction) return false;
  return faction.alliedUntilDay >= currentDay || faction.playerStanding >= 35;
}

export function canTradeWithPirate(
  faction: PirateFactionState | undefined,
  pirate: PirateShipData,
  currentDay: number,
  playerReputation: number
): boolean {
  if (pirate.defeated || pirate.isGhost || pirate.isBoss) return false;
  if (isPirateAlliedWithPlayer(faction, currentDay, playerReputation)) return true;
  return (faction?.playerStanding ?? 0) >= 5 || playerReputation <= -25;
}

export function formTemporaryPirateAlliance(
  factions: Record<PirateFactionId, PirateFactionState>,
  factionId: PirateFactionId,
  currentDay: number,
  durationDays = 5
): Record<PirateFactionId, PirateFactionState> {
  const f = factions[factionId];
  if (!f) return factions;
  return {
    ...factions,
    [factionId]: {
      ...f,
      alliedUntilDay: Math.max(f.alliedUntilDay, currentDay + durationDays),
      playerStanding: Math.max(f.playerStanding, 35),
    },
  };
}
