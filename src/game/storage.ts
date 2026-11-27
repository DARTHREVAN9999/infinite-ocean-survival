import { GameSettings, JournalEntry, SaveData } from './types';
import {
  createStartingInventory,
  DEFAULT_CUSTOM_FLAG,
  DEFAULT_PLAYER_SHIP_NAME,
  isValidPreChosenShipName,
} from './economy';
import { createStartingCrew } from './survival';
import { createInitialWeather, generateWeatherForecast, normalizeLegacyWeatherType, buildWeatherStateFromType } from './waveMath';
import { mulberry32 } from './worldGen';
import { createInitialFactions, normalizeFactionsMap } from './factions';

export const SAVE_KEY = 'oceanbound_save_v2';
export const LEGACY_SAVE_KEY = 'oceanbound_save_v1';

export const DEFAULT_SETTINGS: GameSettings = {
  graphicsQuality: 'high',
  masterVolume: 0.65,
  musicVolume: 0.55,
  sfxVolume: 0.72,
  musicEnabled: true,
  mouseSensitivity: 1.0,
  invertY: false,
  autoSaveEnabled: true,
  autoJournalEnabled: true,
  tutorialsEnabled: true,
  uiScale: 'large',
};

export function formatTimeOfDay(hours: number): string {
  const normalized = ((hours % 24) + 24) % 24;
  const h = Math.floor(normalized);
  const m = Math.floor((normalized - h) * 60);
  const hh = String(h).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function getDayPhaseLabel(hours: number): string {
  const h = ((hours % 24) + 24) % 24;
  if (h >= 5 && h < 7.5) return 'Sunrise';
  if (h >= 7.5 && h < 11.5) return 'Morning';
  if (h >= 11.5 && h < 16.5) return 'Midday';
  if (h >= 16.5 && h < 19.5) return 'Sunset';
  return 'Night';
}

export function createNewVoyage(
  seed = Math.floor(Date.now() % 1000000),
  shipName?: string
): SaveData {
  const rand = mulberry32(seed);
  const chosenShipName = isValidPreChosenShipName(shipName) ? shipName : DEFAULT_PLAYER_SHIP_NAME;
  const startTime = 6.2;
  const initialWeather = createInitialWeather(rand);
  const initialForecast = generateWeatherForecast(initialWeather.type, initialWeather.timeUntilChange, rand, 3);
  const initialJournal: JournalEntry[] = [
    {
      id: 'entry_launch',
      day: 1,
      timeStr: formatTimeOfDay(startTime),
      title: `${chosenShipName} Sets Sail Under Golden Skies`,
      body: `Cast off from the sheltered shoals at dawn aboard the ${chosenShipName} with a sound timber boat, 10 loyal hands, a swivel gun, and 85 gold coin. Fishing trawlers and merchant lanterns dot the near lanes, while ten rival pirate factions contest the open seas.`,
      author: 'log',
      createdAt: Date.now(),
    },
  ];

  return {
    version: 3,
    seed,
    day: 1,
    timeOfDay: startTime,
    reputation: 0,
    player: {
      shipName: chosenShipName,
      x: 0,
      z: 0,
      heading: 0,
      speed: 0,
      throttle: 0,
      rudder: 0,
      isStopping: false,
      gold: 85,
      inventory: createStartingInventory(),
      upgrades: {
        hullTier: 1,
        hullLengthBonus: 0,
        hullWidthBonus: 0,
        deckLevel: 0,
        reinforcementTier: 0,
        armorPlating: 0,
        sailTier: 1,
        extraMast: false,
        steeringTier: 1,
        storageTier: 1,
        crowsNest: false,
        medicalBay: false,
        repairStation: false,
        fishingGear: 'none',
        weaponType: 'swivel',
        cannonCount: 1,
        cannonUpgrades: {
          damageLvl: 1,
          accuracyLvl: 1,
          reloadLvl: 1,
          durabilityLvl: 1,
        },
      },
      condition: {
        hull: 100,
        sails: 100,
        mast: 100,
        steering: 100,
        cannons: 100,
        deck: 100,
        flooding: 0,
      },
      repairPriority: 'hull',
      crew: createStartingCrew(rand),
      damageMarks: [],
    },
    fleet: [],
    weather: initialWeather,
    weatherForecast: initialForecast,
    factions: createInitialFactions(),
    customFlag: { ...DEFAULT_CUSTOM_FLAG },
    unlockedDyes: ['weathered_gray', 'crimson', 'navy', 'emerald', 'gold', 'obsidian', 'ivory'],
    unlockedEmblems: ['none', 'anchor', 'skull'],
    unlockedPatterns: ['solid', 'horizontal_bicolor', 'vertical_bicolor', 'saltire', 'chevron', 'bordered'],
    ghostCollectibles: [],
    treasureFragments: 0,
    treasureMaps: [],
    discoveredIslandIds: ['island_starter_coral_haven'],
    collectedDiscoveryIds: [],
    tribeStanding: {},
    islandProvoked: [],
    treasureSharesTaken: [],
    completedErrandIds: [],
    journal: initialJournal,
    exploredCells: ['0,0'],
    markers: [],
    lootedWreckIds: [],
    searchedWreckSections: {},
    collectedCrateIds: [],
    defeatedPirateIds: [],
    defeatedBossIds: [],
    defeatedMonsterIds: [],
    tamedMonsters: [],
    activeRepairJob: null,
    dismissedWarnings: [],
    seenTutorials: [],
    stats: {
      daysSurvived: 1,
      distanceSailed: 0,
      wrecksExplored: 0,
      piratesDefeated: 0,
      bossesDefeated: 0,
      monstersDefeated: 0,
      tradesCompleted: 0,
      shipsRobbed: 0,
      survivorsRescued: 0,
      peakGold: 85,
      causeOfDeath: '',
    },
    settings: { ...DEFAULT_SETTINGS },
  };
}

export function saveVoyageToStorage(data: SaveData): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadVoyageFromStorage(): SaveData | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(SAVE_KEY) || window.localStorage.getItem(LEGACY_SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SaveData;
    if (!parsed || !parsed.player || !Array.isArray(parsed.player.crew)) {
      return null;
    }

    const base = createNewVoyage(parsed.seed || 101);
    const cleanedInventory = { ...base.player.inventory, ...(parsed.player.inventory || {}) } as Record<string, number>;
    delete cleanedInventory.weaponComponents;

    const legacyType = normalizeLegacyWeatherType((parsed.weather as { type?: string } | undefined)?.type);
    const normalizedWeather = parsed.weather
      ? {
          ...buildWeatherStateFromType(legacyType, parsed.weather.windDir ?? 0, parsed.weather.timeUntilChange ?? 90),
          ...parsed.weather,
          type: legacyType,
          snowIntensity: parsed.weather.snowIntensity ?? 0,
          hailIntensity: parsed.weather.hailIntensity ?? 0,
          waterDrainMult: parsed.weather.waterDrainMult ?? 1.0,
          visibilityLabel: parsed.weather.visibilityLabel ?? 'Good',
          seaConditionLabel: parsed.weather.seaConditionLabel ?? 'Moderate Swell',
          warningText: parsed.weather.warningText ?? null,
        }
      : base.weather;

    const merged: SaveData = {
      ...base,
      ...parsed,
      version: 4,
      reputation: typeof parsed.reputation === 'number' ? parsed.reputation : 0,
      player: {
        ...base.player,
        ...parsed.player,
        shipName: isValidPreChosenShipName(parsed.player.shipName)
          ? parsed.player.shipName
          : DEFAULT_PLAYER_SHIP_NAME,
        isStopping: Boolean(parsed.player.isStopping),
        inventory: cleanedInventory as SaveData['player']['inventory'],
        upgrades: {
          ...base.player.upgrades,
          ...(parsed.player.upgrades || {}),
          fishingGear: parsed.player.upgrades?.fishingGear || 'none',
          cannonUpgrades: {
            ...base.player.upgrades.cannonUpgrades,
            ...(parsed.player.upgrades?.cannonUpgrades || {}),
          },
        },
        crew: parsed.player.crew.map((c) => ({
          ...c,
          loyalty: typeof c.loyalty === 'number' ? c.loyalty : 78,
          forced: Boolean(c.forced),
          xp: typeof c.xp === 'number' ? c.xp : 0,
          level: typeof c.level === 'number' ? c.level : 1,
          skills: {
            ...c.skills,
            fishing: typeof c.skills?.fishing === 'number' ? c.skills.fishing : Math.max(2, Math.floor((c.skills?.sailing ?? 3) * 0.85)),
          },
        })),
        damageMarks: Array.isArray(parsed.player.damageMarks) ? parsed.player.damageMarks : [],
      },
      fleet: Array.isArray(parsed.fleet) ? parsed.fleet.filter((f) => !f.sunk && f.hull > 0) : [],
      weather: normalizedWeather,
      weatherForecast:
        Array.isArray(parsed.weatherForecast) && parsed.weatherForecast.length > 0
          ? parsed.weatherForecast
          : base.weatherForecast,
      searchedWreckSections:
        parsed.searchedWreckSections && typeof parsed.searchedWreckSections === 'object'
          ? parsed.searchedWreckSections
          : {},
      factions: normalizeFactionsMap(parsed.factions),
      customFlag: parsed.customFlag || base.customFlag,
      unlockedDyes: Array.from(new Set(['weathered_gray', ...(parsed.unlockedDyes || base.unlockedDyes)])),
      unlockedEmblems: parsed.unlockedEmblems || base.unlockedEmblems,
      unlockedPatterns: parsed.unlockedPatterns || base.unlockedPatterns,
      ghostCollectibles: Array.isArray(parsed.ghostCollectibles) ? parsed.ghostCollectibles : [],
      treasureFragments: typeof parsed.treasureFragments === 'number' ? parsed.treasureFragments : 0,
      treasureMaps: Array.isArray(parsed.treasureMaps) ? parsed.treasureMaps : [],
      discoveredIslandIds: Array.isArray(parsed.discoveredIslandIds)
        ? parsed.discoveredIslandIds
        : base.discoveredIslandIds,
      collectedDiscoveryIds: Array.isArray(parsed.collectedDiscoveryIds) ? parsed.collectedDiscoveryIds : [],
      tribeStanding: parsed.tribeStanding && typeof parsed.tribeStanding === 'object' ? parsed.tribeStanding : {},
      islandProvoked: Array.isArray(parsed.islandProvoked) ? parsed.islandProvoked : [],
      treasureSharesTaken: Array.isArray(parsed.treasureSharesTaken) ? parsed.treasureSharesTaken : [],
      completedErrandIds: Array.isArray(parsed.completedErrandIds) ? parsed.completedErrandIds : [],
      defeatedBossIds: parsed.defeatedBossIds || [],
      defeatedMonsterIds: parsed.defeatedMonsterIds || [],
      tamedMonsters: parsed.tamedMonsters || [],
      activeRepairJob: parsed.activeRepairJob || null,
      dismissedWarnings: parsed.dismissedWarnings || [],
      seenTutorials: Array.isArray(parsed.seenTutorials) ? parsed.seenTutorials : [],
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
      stats: { ...base.stats, ...(parsed.stats || {}) },
    };
    return merged;
  } catch {
    return null;
  }
}

export function clearVoyageStorage(): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(SAVE_KEY);
      window.localStorage.removeItem(LEGACY_SAVE_KEY);
    }
  } catch {
    // ignore storage restrictions
  }
}

export function addJournalEntry(
  entries: JournalEntry[],
  day: number,
  timeOfDay: number,
  title: string,
  body: string,
  author: 'player' | 'log'
): JournalEntry[] {
  const entry: JournalEntry = {
    id: `j_${Date.now()}_${Math.floor(Math.random() * 100000)}`,
    day,
    timeStr: formatTimeOfDay(timeOfDay),
    title: title.trim() || 'Ship Log Entry',
    body: body.trim(),
    author,
    createdAt: Date.now(),
  };
  return [entry, ...entries];
}

export function updateJournalEntry(
  entries: JournalEntry[],
  id: string,
  title: string,
  body: string
): JournalEntry[] {
  return entries.map((e) =>
    e.id === id ? { ...e, title: title.trim() || e.title, body: body.trim() } : e
  );
}

export function deleteJournalEntry(entries: JournalEntry[], id: string): JournalEntry[] {
  return entries.filter((e) => e.id !== id);
}
