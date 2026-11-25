import { createEmptyInventory } from './economy';
import { IslandData, SaveData, TreasureMapItem } from './types';

export interface FragmentGrantResult {
  addedFragments: number;
  newFragmentsCount: number;
  assembledMaps: TreasureMapItem[];
}

const TREASURE_TITLES = [
  'Chart of the Sunken Crowns',
  'Captain Vance’s Shore Stash',
  'Gilded Reef Bearings',
  'Saltwind Smuggler Ledger',
  'Crimson Reef X-Chart',
  'Old Mariner’s Secret Cove',
];

export function assembleTreasureMapForIslands(
  islands: IslandData[],
  seedOffset: number,
  rand: () => number,
  existingMapCount = 0
): TreasureMapItem {
  const pool = islands.length > 0 ? islands : [];
  const pickedIsland =
    pool.length > 0 ? pool[Math.floor(rand() * pool.length)] : null;

  const angle = rand() * Math.PI * 2;
  const dist = pickedIsland ? pickedIsland.radius * (0.28 + rand() * 0.42) : 45;
  const tx = pickedIsland ? pickedIsland.x + Math.cos(angle) * dist : 300 + Math.cos(angle) * 25;
  const tz = pickedIsland ? pickedIsland.z + Math.sin(angle) * dist : 140 + Math.sin(angle) * 25;

  const rewardLoot = createEmptyInventory();
  rewardLoot.jewellery = 1 + Math.floor(rand() * 2);
  rewardLoot.rareMaterials = 1 + Math.floor(rand() * 2);
  rewardLoot.antiques = rand() < 0.55 ? 1 : 0;
  rewardLoot.gunpowder = 8;
  rewardLoot.leadShot = 18;
  rewardLoot.medicine = 3;

  const title = TREASURE_TITLES[(existingMapCount + Math.floor(rand() * TREASURE_TITLES.length)) % TREASURE_TITLES.length];
  const bearing =
    Math.abs(Math.cos(angle)) > Math.abs(Math.sin(angle))
      ? Math.cos(angle) > 0
        ? 'eastward ridge'
        : 'western bluff'
      : Math.sin(angle) > 0
        ? 'southern cove'
        : 'northern palm shelf';

  return {
    id: `tmap_${Date.now()}_${seedOffset}_${Math.floor(rand() * 99999)}`,
    title,
    islandId: pickedIsland ? pickedIsland.id : 'island_starter_coral_haven',
    islandName: pickedIsland ? pickedIsland.name : 'Coral Haven',
    clueText: `Dig beside the ${bearing} on ${pickedIsland ? pickedIsland.name : 'Coral Haven'} where weathered stones cross.`,
    targetX: tx,
    targetZ: tz,
    rewardGold: 165 + Math.floor(rand() * 145),
    rewardLoot,
    found: false,
  };
}

/**
 * Adds treasure map fragments; every 3 fragments automatically binds a complete TreasureMapItem.
 */
export function addTreasureFragments(
  save: SaveData,
  count: number,
  islands: IslandData[],
  rand: () => number
): FragmentGrantResult {
  const currentFrags = (save.treasureFragments ?? 0) + Math.max(0, Math.floor(count));
  const maps = [...(save.treasureMaps ?? [])];
  const assembledMaps: TreasureMapItem[] = [];

  let remaining = currentFrags;
  let seq = 0;
  while (remaining >= 3) {
    remaining -= 3;
    seq += 1;
    const newMap = assembleTreasureMapForIslands(islands, seq, rand, maps.length);
    maps.push(newMap);
    assembledMaps.push(newMap);
  }

  save.treasureFragments = remaining;
  save.treasureMaps = maps;

  return {
    addedFragments: count,
    newFragmentsCount: remaining,
    assembledMaps,
  };
}

export function getActiveTreasureOnIsland(
  maps: TreasureMapItem[] | undefined,
  islandId: string
): TreasureMapItem | null {
  if (!maps || maps.length === 0) return null;
  return maps.find((m) => !m.found && m.islandId === islandId) ?? null;
}

export function checkTreasureDigProximity(
  maps: TreasureMapItem[] | undefined,
  islandId: string,
  worldX: number,
  worldZ: number,
  maxDist = 8.5
): TreasureMapItem | null {
  if (!maps || maps.length === 0) return null;
  for (const m of maps) {
    if (m.found || m.islandId !== islandId) continue;
    if (Math.hypot(m.targetX - worldX, m.targetZ - worldZ) <= maxDist) {
      return m;
    }
  }
  return null;
}

export function digTreasureSpot(
  save: SaveData,
  mapId: string
): { success: boolean; map: TreasureMapItem | null } {
  const maps = save.treasureMaps ?? [];
  const target = maps.find((m) => m.id === mapId && !m.found);
  if (!target) return { success: false, map: null };

  target.found = true;
  save.player.gold += target.rewardGold;
  save.stats.peakGold = Math.max(save.stats.peakGold, save.player.gold);
  for (const [k, qty] of Object.entries(target.rewardLoot)) {
    const key = k as keyof SaveData['player']['inventory'];
    if (typeof qty === 'number' && qty > 0) {
      save.player.inventory[key] = (save.player.inventory[key] || 0) + qty;
    }
  }
  return { success: true, map: target };
}
