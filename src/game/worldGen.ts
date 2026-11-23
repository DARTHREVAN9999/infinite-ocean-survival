import {
  FloatingCrateData,
  MerchantShipData,
  PirateFactionId,
  PirateFactionState,
  PirateShipData,
  PirateTier,
  SeaMonsterData,
  ShipwreckData,
  VesselClass,
  WreckArchetype,
} from './types';
import { generateMerchantShip, generateShipwreck } from './economy';
import { generateGhostShip, generatePirateShip } from './combat';
import { createRandomCrewMember } from './survival';
import { createInitialFactions, getDominantFactionForPosition } from './factions';
import { generateSeaMonster } from './monsters';

export const CHUNK_SIZE = 520;

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashCoords(seed: number, cx: number, cz: number): number {
  let h = seed ^ 0x9e3779b9;
  h = Math.imul(h ^ (cx * 374761393), 668265263);
  h = Math.imul(h ^ (cz * 1274126177), 2246822519);
  return (h ^ (h >>> 13)) >>> 0;
}

export function chunkKey(cx: number, cz: number): string {
  return `${cx},${cz}`;
}

export function worldToChunk(x: number, z: number): { cx: number; cz: number } {
  return {
    cx: Math.floor(x / CHUNK_SIZE),
    cz: Math.floor(z / CHUNK_SIZE),
  };
}

export interface WorldChunkData {
  key: string;
  cx: number;
  cz: number;
  wrecks: ShipwreckData[];
  crates: FloatingCrateData[];
  merchants: MerchantShipData[];
  pirates: PirateShipData[];
  monsters: SeaMonsterData[];
}

function pickWreckArchetype(distFromOrigin: number, rand: () => number): WreckArchetype {
  const r = rand();
  if (distFromOrigin < 480) {
    if (r < 0.34) return 'fishing_boat';
    if (r < 0.64) return 'abandoned_sloop';
    if (r < 0.84) return 'merchant_vessel';
    if (r < 0.94) return 'cargo_hulk';
    return 'storm_sunken';
  }
  if (distFromOrigin < 1150) {
    if (r < 0.14) return 'abandoned_sloop';
    if (r < 0.32) return 'merchant_vessel';
    if (r < 0.48) return 'cargo_hulk';
    if (r < 0.63) return 'pirate_wreck';
    if (r < 0.77) return 'trading_galleon';
    if (r < 0.88) return 'military_frigate';
    if (r < 0.95) return 'enormous_merchant';
    return 'storm_sunken';
  }
  if (r < 0.11) return 'treasure_galleon';
  if (r < 0.25) return 'trading_galleon';
  if (r < 0.40) return 'military_frigate';
  if (r < 0.54) return 'pirate_wreck';
  if (r < 0.68) return 'enormous_merchant';
  if (r < 0.80) return 'massive_warship';
  if (r < 0.89) return 'gigantic_wreck';
  if (r < 0.95) return 'merchant_vessel';
  return 'storm_sunken';
}

function pickPirateTier(distFromOrigin: number, rand: () => number): PirateTier {
  const r = rand();
  if (distFromOrigin < 600) {
    return r < 0.78 ? 'sloop' : 'brigantine';
  }
  if (distFromOrigin < 1300) {
    if (r < 0.36) return 'sloop';
    if (r < 0.78) return 'brigantine';
    return 'galleon';
  }
  // Keep smaller weak pirate sloops spawning steadily in deep waters too
  if (r < 0.26) return 'sloop';
  if (r < 0.54) return 'brigantine';
  if (r < 0.84) return 'galleon';
  return 'dreadnought';
}

function pickVesselClass(distFromOrigin: number, rand: () => number): VesselClass {
  const r = rand();
  if (distFromOrigin < 520) {
    if (r < 0.22) return 'fishing_boat';
    if (r < 0.42) return 'fishing_trawler';
    if (r < 0.62) return 'small_merchant';
    if (r < 0.78) return 'medium_merchant';
    if (r < 0.88) return 'supply_ship';
    if (r < 0.94) return 'crown_patrol';
    return 'crown_sloop';
  }
  if (distFromOrigin < 1200) {
    if (r < 0.1) return 'fishing_boat';
    if (r < 0.22) return 'fishing_trawler';
    if (r < 0.32) return 'small_merchant';
    if (r < 0.46) return 'medium_merchant';
    if (r < 0.58) return 'large_cargo';
    if (r < 0.68) return 'passenger_ship';
    if (r < 0.76) return 'supply_ship';
    if (r < 0.82) return 'crown_patrol';
    if (r < 0.88) return 'crown_sloop';
    if (r < 0.94) return 'crown_corvette';
    return 'crown_supply';
  }
  if (r < 0.08) return 'fishing_trawler';
  if (r < 0.19) return 'medium_merchant';
  if (r < 0.31) return 'large_cargo';
  if (r < 0.42) return 'passenger_ship';
  if (r < 0.51) return 'supply_ship';
  if (r < 0.63) return 'wealthy_trader';
  if (r < 0.69) return 'treasure_ship';
  if (r < 0.76) return 'crown_corvette';
  if (r < 0.83) return 'crown_frigate';
  if (r < 0.9) return 'crown_warship';
  if (r < 0.94) return 'crown_ship_of_line';
  if (r < 0.97) return 'crown_supply';
  return 'crown_flagship';
}

function createFloatingCrate(id: string, x: number, z: number, rand: () => number): FloatingCrateData {
  const roll = rand();
  const kind: FloatingCrateData['kind'] =
    roll < 0.45 ? 'crate' : roll < 0.78 ? 'barrel' : roll < 0.92 ? 'raft' : 'treasure_buoy';

  const loot: FloatingCrateData['loot'] = {};
  let gold = 0;
  let survivor: FloatingCrateData['survivor'] = undefined;

  if (kind === 'crate') {
    loot.wood = 4 + Math.floor(rand() * 7);
    loot.rope = 2 + Math.floor(rand() * 5);
    loot.food = 3 + Math.floor(rand() * 6);
    gold = Math.floor(rand() * 16);
  } else if (kind === 'barrel') {
    loot.water = 6 + Math.floor(rand() * 10);
    loot.food = 4 + Math.floor(rand() * 8);
    if (rand() < 0.35) loot.cloth = 3 + Math.floor(rand() * 4);
  } else if (kind === 'raft') {
    loot.water = 3 + Math.floor(rand() * 4);
    loot.medicine = 1;
    const s = createRandomCrewMember(`raft_surv_${id}`, rand);
    survivor = {
      id: `raft_surv_${id}`,
      name: s.name,
      skills: s.skills,
      disposition: rand() < 0.65 ? 'eager' : 'needs_food',
      demandAmount: 4,
      resolved: false,
      infoText: '“Thank heaven for a friendly sail! I can pull ropes or tend the bilge.”',
    };
  } else {
    gold = 45 + Math.floor(rand() * 110);
    loot.rareSpices = 1;
    loot.iron = 3 + Math.floor(rand() * 5);
    if (rand() < 0.35) loot.jewellery = 1;
  }

  return {
    id,
    kind,
    x,
    z,
    collected: false,
    gold,
    loot,
    survivor,
  };
}

export function generateWorldChunk(
  seed: number,
  cx: number,
  cz: number,
  lootedWreckIds: Set<string>,
  collectedCrateIds: Set<string>,
  defeatedPirateIds: Set<string>,
  defeatedMonsterIds: Set<string> = new Set(),
  factions: Record<PirateFactionId, PirateFactionState> = createInitialFactions(),
  searchedWreckSections: Record<string, string[]> = {}
): WorldChunkData {
  const key = chunkKey(cx, cz);
  const rand = mulberry32(hashCoords(seed, cx, cz));

  const baseX = cx * CHUNK_SIZE;
  const baseZ = cz * CHUNK_SIZE;

  const wrecks: ShipwreckData[] = [];
  const crates: FloatingCrateData[] = [];
  const merchants: MerchantShipData[] = [];
  const pirates: PirateShipData[] = [];
  const monsters: SeaMonsterData[] = [];

  if (cx === 0 && cz === 0) {
    const w1Id = 'wreck_starter_north';
    const w1 = generateShipwreck(w1Id, -56, -135, 'abandoned_sloop', rand);
    const savedSec1 = searchedWreckSections[w1Id] || [];
    if (savedSec1.length > 0) {
      w1.sections.forEach((s) => {
        if (savedSec1.includes(s.id)) s.searched = true;
      });
    }
    w1.fullyLooted = lootedWreckIds.has(w1Id) || w1.sections.every((s) => s.searched);
    if (w1.fullyLooted) w1.sections.forEach((s) => (s.searched = true));
    wrecks.push(w1);

    const c1Id = 'crate_starter_bow';
    if (!collectedCrateIds.has(c1Id)) {
      const c1 = createFloatingCrate(c1Id, 95, -175, rand);
      c1.kind = 'crate';
      c1.gold = 28;
      c1.loot = { wood: 10, food: 12, water: 12, rope: 6 };
      crates.push(c1);
    }

    const f1 = generateMerchantShip('merchant_starter_trawler', 140, -145, 'fishing_trawler', rand);
    merchants.push(f1);

    const m1 = generateMerchantShip('merchant_starter_0', 225, -245, 'medium_merchant', rand);
    m1.specialty = 'shipwright';
    merchants.push(m1);

    const cPatrol = generateMerchantShip('crown_starter_patrol', -175, -190, 'crown_patrol', rand);
    merchants.push(cPatrol);

    const p1Id = 'pirate_starter_nw';
    if (!defeatedPirateIds.has(p1Id)) {
      pirates.push(
        generatePirateShip(p1Id, -320, -340, 'sloop', rand, {
          factionId: 'crimson_corsairs',
          rank: 1,
        })
      );
    }

    return { key, cx, cz, wrecks, crates, merchants, pirates, monsters };
  }

  const centerX = baseX + CHUNK_SIZE * 0.5;
  const centerZ = baseZ + CHUNK_SIZE * 0.5;
  const distFromOrigin = Math.hypot(centerX, centerZ);

  const wreckRoll = rand();
  const wreckCount = wreckRoll < 0.08 ? 2 : wreckRoll < 0.44 ? 1 : 0;
  for (let i = 0; i < wreckCount; i++) {
    const wx = baseX + 65 + rand() * (CHUNK_SIZE - 130);
    const wz = baseZ + 65 + rand() * (CHUNK_SIZE - 130);
    if (Math.hypot(wx, wz) < 110) continue;
    const id = `wreck_${cx}_${cz}_${i}`;
    const archetype = pickWreckArchetype(distFromOrigin, rand);
    const w = generateShipwreck(id, wx, wz, archetype, rand);
    const savedSecs = searchedWreckSections[id] || [];
    if (savedSecs.length > 0) {
      w.sections.forEach((s) => {
        if (savedSecs.includes(s.id)) s.searched = true;
      });
    }
    if (lootedWreckIds.has(id) || w.sections.every((s) => s.searched)) {
      w.fullyLooted = true;
      w.sections.forEach((s) => (s.searched = true));
    }
    wrecks.push(w);
  }

  const crateRoll = rand();
  const crateCount = crateRoll < 0.09 ? 2 : crateRoll < 0.52 ? 1 : 0;
  for (let i = 0; i < crateCount; i++) {
    const fx = baseX + 55 + rand() * (CHUNK_SIZE - 110);
    const fz = baseZ + 55 + rand() * (CHUNK_SIZE - 110);
    if (Math.hypot(fx, fz) < 95) continue;
    const id = `crate_${cx}_${cz}_${i}`;
    if (collectedCrateIds.has(id)) continue;
    crates.push(createFloatingCrate(id, fx, fz, rand));
  }

  // Major NPC Naval Battle (Crown Squadron / Armada vs Pirate Armada, rarely allied sea monsters)
  const isMajorBattleChunk = distFromOrigin >= 860 && rand() < 0.07;
  if (isMajorBattleChunk) {
    const bx = baseX + CHUNK_SIZE * 0.5;
    const bz = baseZ + CHUNK_SIZE * 0.5;
    const battleId = `battle_${cx}_${cz}`;
    const factionId = getDominantFactionForPosition(bx, bz, factions, rand);

    const crownLeadClass: VesselClass =
      distFromOrigin > 1500 ? 'crown_flagship' : rand() < 0.5 ? 'crown_warship' : 'crown_frigate';
    const crown1 = generateMerchantShip(`battle_crown_${cx}_${cz}_0`, bx - 55, bz - 35, crownLeadClass, rand);
    crown1.battleId = battleId;
    crown1.heading = -Math.PI * 0.45;
    merchants.push(crown1);

    const crown2 = generateMerchantShip(`battle_crown_${cx}_${cz}_1`, bx - 88, bz + 28, 'crown_corvette', rand);
    crown2.battleId = battleId;
    crown2.heading = -Math.PI * 0.4;
    merchants.push(crown2);

    const pirLeadId = `battle_pir_${cx}_${cz}_lead`;
    if (!defeatedPirateIds.has(pirLeadId)) {
      const pLead = generatePirateShip(pirLeadId, bx + 55, bz - 20, distFromOrigin > 1400 ? 'dreadnought' : 'galleon', rand, {
        factionId,
        rank: 5,
        isFlagship: true,
        fleetId: battleId,
      });
      pLead.battleId = battleId;
      pLead.heading = Math.PI * 0.5;
      pirates.push(pLead);
    }
    for (let e = 0; e < 2; e++) {
      const peId = `battle_pir_${cx}_${cz}_esc_${e}`;
      if (!defeatedPirateIds.has(peId)) {
        const pEsc = generatePirateShip(
          peId,
          bx + 88,
          bz + (e === 0 ? -55 : 48),
          e === 0 ? 'brigantine' : 'sloop',
          rand,
          { factionId, rank: 3, fleetId: battleId, escortTargetId: pirLeadId }
        );
        pEsc.battleId = battleId;
        pEsc.heading = Math.PI * 0.5;
        pirates.push(pEsc);
      }
    }

    // Rare Sea Monster Armada Ally (~22% of major clashes)
    const armadaMonsterId = `armada_mon_${cx}_${cz}`;
    if (!defeatedMonsterIds.has(armadaMonsterId) && rand() < 0.22) {
      const allySidePirate = rand() < 0.5;
      const mon = generateSeaMonster(
        armadaMonsterId,
        bx + (allySidePirate ? 105 : -110),
        bz - 40,
        rand,
        distFromOrigin >= 1400
      );
      mon.alignment = allySidePirate ? 'evil' : 'good';
      if (allySidePirate) mon.escortFactionId = factionId;
      else mon.escortCrownConvoyId = battleId;
      monsters.push(mon);
    }
  } else {
    // Merchant Convoys OR solo ships / Crown Fleet squadrons
    const isConvoyChunk = distFromOrigin >= 540 && rand() < 0.14;
    if (isConvoyChunk) {
      const cx0 = baseX + 120 + rand() * (CHUNK_SIZE - 240);
      const cz0 = baseZ + 120 + rand() * (CHUNK_SIZE - 240);
      const convoyId = `convoy_${cx}_${cz}`;
      const convoyHeading = rand() * Math.PI * 2;
      const merchCount = rand() < 0.45 ? 3 : 2;
      const escortCount = rand() < 0.55 ? 2 : 1;

      for (let m = 0; m < merchCount; m++) {
        const cls: VesselClass =
          m === 0
            ? rand() < 0.4
              ? 'wealthy_trader'
              : 'large_cargo'
            : rand() < 0.5
              ? 'medium_merchant'
              : 'supply_ship';
        const offsetBack = m * 38;
        const mx = cx0 + Math.sin(convoyHeading) * offsetBack;
        const mz = cz0 + Math.cos(convoyHeading) * offsetBack;
        const merch = generateMerchantShip(`convoy_${cx}_${cz}_m_${m}`, mx, mz, cls, rand);
        merch.heading = convoyHeading;
        merch.convoyId = convoyId;
        merch.convoyRole = m === 0 ? 'lead' : 'merchant';
        merch.convoySlot = m;
        merch.maxSpeed = 6.4;
        merchants.push(merch);
      }

      for (let e = 0; e < escortCount; e++) {
        const side = e === 0 ? 1 : -1;
        const ex = cx0 + Math.cos(convoyHeading) * side * 34 + Math.sin(convoyHeading) * 18;
        const ez = cz0 - Math.sin(convoyHeading) * side * 34 + Math.cos(convoyHeading) * 18;
        const escCls: VesselClass =
          distFromOrigin > 1400
            ? e === 0
              ? 'crown_frigate'
              : 'crown_corvette'
            : distFromOrigin > 950
              ? 'crown_corvette'
              : 'crown_patrol';
        const esc = generateMerchantShip(`convoy_${cx}_${cz}_esc_${e}`, ex, ez, escCls, rand);
        esc.heading = convoyHeading;
        esc.convoyId = convoyId;
        esc.convoyRole = 'escort';
        esc.convoySlot = e;
        merchants.push(esc);
      }
    } else {
      const vesselChance = distFromOrigin < 700 ? 0.36 : 0.3;
      if (rand() < vesselChance) {
        const mx = baseX + 80 + rand() * (CHUNK_SIZE - 160);
        const mz = baseZ + 80 + rand() * (CHUNK_SIZE - 160);
        const vesselClass = pickVesselClass(distFromOrigin, rand);
        merchants.push(generateMerchantShip(`merchant_${cx}_${cz}`, mx, mz, vesselClass, rand));
      }
    }

    // Pirates, armadas, ranks 1-6, and occasional faction bosses
    const pirateChance = distFromOrigin < 650 ? 0.25 : 0.36;
    if (rand() < pirateChance) {
      const px = baseX + 80 + rand() * (CHUNK_SIZE - 160);
      const pz = baseZ + 80 + rand() * (CHUNK_SIZE - 160);
      if (Math.hypot(px, pz) >= 210) {
        const factionId = getDominantFactionForPosition(px, pz, factions, rand);
        const isFleetChunk = distFromOrigin > 920 && rand() < 0.24;
        const isBossChunk = distFromOrigin > 1300 && rand() < 0.16;

        if (isFleetChunk) {
          const fleetId = `fleet_${cx}_${cz}`;
          const leadId = `pirate_${cx}_${cz}_lead`;
          const leadTier: PirateTier = isBossChunk ? 'dreadnought' : rand() < 0.55 ? 'galleon' : 'dreadnought';
          if (!defeatedPirateIds.has(leadId)) {
            pirates.push(
              generatePirateShip(leadId, px, pz, leadTier, rand, {
                factionId,
                rank: isBossChunk ? 6 : 5,
                isBoss: isBossChunk,
                isFlagship: true,
                fleetId,
              })
            );
          }
          const escortCount = rand() < 0.35 ? 3 : 2;
          for (let e = 0; e < escortCount; e++) {
            const eid = `pirate_${cx}_${cz}_esc_${e}`;
            if (!defeatedPirateIds.has(eid)) {
              const offsetAng = (e === 0 ? 1 : e === 1 ? -1 : 0) * 1.1;
              const ex = px + Math.cos(offsetAng) * (50 + e * 14);
              const ez = pz + Math.sin(offsetAng) * (50 + e * 14);
              pirates.push(
                generatePirateShip(eid, ex, ez, e === 0 ? 'brigantine' : 'sloop', rand, {
                  factionId,
                  rank: e === 0 ? 3 : 2,
                  fleetId,
                  escortTargetId: leadId,
                  shipClassLabel: e === 2 ? 'Pirate Supply Ship' : undefined,
                })
              );
            }
          }
          if (rand() < 0.12 && !defeatedMonsterIds.has(`pir_ally_mon_${cx}_${cz}`)) {
            const allyMon = generateSeaMonster(
              `pir_ally_mon_${cx}_${cz}`,
              px - 68,
              pz - 68,
              rand,
              distFromOrigin >= 1450
            );
            allyMon.alignment = 'evil';
            allyMon.escortFactionId = factionId;
            monsters.push(allyMon);
          }
        } else {
          const id = `pirate_${cx}_${cz}`;
          if (!defeatedPirateIds.has(id)) {
            const tier = pickPirateTier(distFromOrigin, rand);
            const rank =
              tier === 'sloop'
                ? 1
                : tier === 'brigantine'
                  ? rand() < 0.45
                    ? 3
                    : 2
                  : tier === 'galleon'
                    ? 4
                    : 5;
            pirates.push(
              generatePirateShip(id, px, pz, tier, rand, {
                factionId,
                rank,
                isBoss: isBossChunk && tier === 'dreadnought',
                isFlagship: tier === 'dreadnought',
              })
            );
          }
        }
      }
    }
  }

  // Ghost Ships shrouded in thick unnatural fog (Small/Medium common among sightings, Colossal deep sea only)
  if (distFromOrigin >= 760 && rand() < 0.042) {
    const gx = baseX + 120 + rand() * (CHUNK_SIZE - 240);
    const gz = baseZ + 120 + rand() * (CHUNK_SIZE - 240);
    const ghostId = `ghost_${cx}_${cz}`;
    if (!defeatedPirateIds.has(ghostId)) {
      pirates.push(generateGhostShip(ghostId, gx, gz, rand));
    }
  }

  // Sea monsters outside starter waters
  if (distFromOrigin >= 700 && rand() < 0.065) {
    const sx = baseX + 100 + rand() * (CHUNK_SIZE - 200);
    const sz = baseZ + 100 + rand() * (CHUNK_SIZE - 200);
    const mid = `monster_${cx}_${cz}`;
    if (!defeatedMonsterIds.has(mid)) {
      monsters.push(generateSeaMonster(mid, sx, sz, rand, distFromOrigin >= 1300));
    }
  }

  return { key, cx, cz, wrecks, crates, merchants, pirates, monsters };
}
