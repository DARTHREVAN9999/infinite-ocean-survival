export type ValuableCargoId =
  | 'cargo'
  | 'jewellery'
  | 'preciousDecor'
  | 'silk'
  | 'rareSpices'
  | 'fineFurniture'
  | 'paintings'
  | 'antiques'
  | 'luxuryGoods'
  | 'rareImports';

export type ResourceId =
  | 'wood'
  | 'iron'
  | 'rope'
  | 'cloth'
  | 'food'
  | 'water'
  | 'tools'
  | 'gunpowder'
  | 'cannonballs'
  | 'medicine'
  | 'rareMaterials'
  | 'advancedTimber'
  | 'reinforcedMetals'
  | 'specializedSailcloth'
  | 'decorativeMaterials'
  | ValuableCargoId;

export type Inventory = Record<ResourceId, number>;

export interface ResourceDef {
  id: ResourceId;
  name: string;
  weight: number;
  basePrice: number;
  rarity: 'Common' | 'Uncommon' | 'Rare' | 'Specialised' | 'Military' | 'Valuable';
  description: string;
  isValuableCargo?: boolean;
}

export type CrewRole =
  | 'sailor'
  | 'helmsman'
  | 'cannoneer'
  | 'repair'
  | 'lookout'
  | 'navigator'
  | 'medical'
  | 'general'
  | 'resting';

export type CrewAutoAssignMode = 'best' | 'sailing' | 'combat';

export type CrewCondition = 'healthy' | 'injured' | 'sick' | 'exhausted';

export interface CrewSkills {
  sailing: number; // 1-12
  combat: number;
  repair: number;
  navigation: number;
  strength: number;
}

export interface CrewMember {
  id: string;
  name: string;
  origin: string;
  role: CrewRole;
  health: number; // 0-100
  morale: number; // 0-100
  loyalty: number; // 0-100
  forced: boolean;
  xp: number;
  level?: number;
  condition: CrewCondition;
  skills: CrewSkills;
  coatColor: string;
  hatStyle: 'none' | 'tricorne' | 'bandana' | 'beanie';
}

export type WeaponType =
  | 'none'
  | 'swivel'
  | 'light'
  | 'medium'
  | 'carronade'
  | 'heavy'
  | 'longGun'
  | 'advancedHeavy'
  | 'specialised';

export interface CannonUpgrades {
  damageLvl: number; // 1..4
  accuracyLvl: number; // 1..4
  reloadLvl: number; // 1..4
  durabilityLvl: number; // 1..4
}

export interface ShipUpgrades {
  hullTier: number; // 1 (Starter Skiff) -> 7 (Grand Sovereign Flagship)
  hullLengthBonus: number; // 0..3
  hullWidthBonus: number; // 0..3
  deckLevel: number; // 0..3 (adds elevated aft & full multi-decks)
  reinforcementTier: number; // 0..3
  armorPlating: number; // 0..4
  sailTier: number; // 1..4
  extraMast: boolean;
  steeringTier: number; // 1..4
  storageTier: number; // 1..4
  crowsNest: boolean;
  medicalBay: boolean;
  repairStation: boolean;
  weaponType: WeaponType;
  cannonCount: number;
  cannonUpgrades: CannonUpgrades;
}

export interface ShipCondition {
  hull: number; // 0-100
  sails: number; // 0-100
  mast: number; // 0-100
  steering: number; // 0-100
  cannons: number; // 0-100
  deck: number; // 0-100
  flooding: number; // 0-100 (100 = sinks)
}

export type RepairPriority = 'hull' | 'sails' | 'mast' | 'steering' | 'cannons' | 'deck';

export interface ManualRepairJob {
  section: RepairPriority;
  remainingTime: number;
  totalTime: number;
  restoreAmount: number;
}

export interface DamageNotification {
  id: string;
  text: string;
  critical: boolean;
  location: RepairPriority;
  damage: number;
}

export type WeatherType =
  | 'calm'
  | 'clear'
  | 'light_winds'
  | 'strong_winds'
  | 'light_rain'
  | 'heavy_rain'
  | 'hail'
  | 'severe_hail'
  | 'snow'
  | 'blizzard'
  | 'thunderstorm'
  | 'lightning_storm'
  | 'hurricane'
  | 'tornado'
  | 'dense_fog'
  | 'heatwave';

export interface WeatherForecastEntry {
  type: WeatherType;
  label: string;
  etaSeconds: number;
  severity: 'Calm' | 'Fair' | 'Rough' | 'Dangerous' | 'Extreme';
  summary: string;
  uncertain: boolean;
}

export interface WeatherState {
  type: WeatherType;
  windSpeed: number; // knots 2..65
  windDir: number; // radians
  waveIntensity: number; // 0.35..3.1
  fogDensity: number; // 0.0006..0.015
  rainIntensity: number; // 0..1
  snowIntensity: number; // 0..1
  hailIntensity: number; // 0..1
  lightningFlash: number; // 0..1
  waterDrainMult: number; // 1.0..1.55 (higher in heatwave)
  visibilityLabel: string;
  seaConditionLabel: string;
  warningText: string | null;
  timeUntilChange: number; // seconds
}

export type WreckArchetype =
  | 'fishing_boat'
  | 'abandoned_sloop'
  | 'merchant_vessel'
  | 'trading_galleon'
  | 'military_frigate'
  | 'pirate_wreck'
  | 'cargo_hulk'
  | 'storm_sunken'
  | 'treasure_galleon'
  | 'enormous_merchant'
  | 'massive_warship'
  | 'gigantic_wreck'
  | 'ghost_wreck';

export interface WreckSurvivor {
  id: string;
  name: string;
  skills: CrewSkills;
  disposition: 'eager' | 'needs_food' | 'needs_medicine' | 'reluctant' | 'gives_info';
  demandAmount: number;
  resolved: boolean;
  offerRefused?: boolean;
  infoText: string;
}

export interface WreckSection {
  id: string;
  name: string;
  description: string;
  searchDuration: number; // seconds
  dangerLevel: 'Low' | 'Moderate' | 'High';
  dangerNote: string;
  searched: boolean;
  emptyRoom?: boolean;
  gold: number;
  loot: Partial<Inventory>;
  collectible?: string;
  survivor?: WreckSurvivor;
}

export type GhostSizeTier = 'small' | 'medium' | 'large' | 'enormous' | 'colossal';

export interface ShipwreckData {
  id: string;
  name: string;
  archetype: WreckArchetype;
  isGhostWreck?: boolean;
  isCharred?: boolean;
  ghostSize?: GhostSizeTier;
  spawnedFromShipId?: string;
  x: number;
  z: number;
  rotation: number;
  sinkDepth: number;
  scale: number;
  discovered: boolean;
  fullyLooted: boolean;
  sections: WreckSection[];
}

export interface FloatingCrateData {
  id: string;
  kind: 'crate' | 'barrel' | 'raft' | 'treasure_buoy';
  x: number;
  z: number;
  discovered?: boolean;
  collected: boolean;
  gold: number;
  loot: Partial<Inventory>;
  survivor?: WreckSurvivor;
}

export type VesselClass =
  | 'fishing_boat'
  | 'fishing_trawler'
  | 'small_merchant'
  | 'medium_merchant'
  | 'large_cargo'
  | 'passenger_ship'
  | 'supply_ship'
  | 'wealthy_trader'
  | 'treasure_ship'
  | 'crown_patrol'
  | 'crown_sloop'
  | 'crown_corvette'
  | 'crown_frigate'
  | 'crown_warship'
  | 'crown_ship_of_line'
  | 'crown_flagship'
  | 'crown_supply';

export type MerchantTier = 'small_trader' | 'medium_merchant' | 'large_cargo' | 'wealthy_galleon';

export interface MerchantShipData {
  id: string;
  name: string;
  captainName: string;
  vesselClass: VesselClass;
  classLabel?: string;
  tier: MerchantTier;
  specialty: 'fishing' | 'provisions' | 'shipwright' | 'armory' | 'luxury' | 'crown';
  isCrown: boolean;
  isFishingTrawler: boolean;
  x: number;
  z: number;
  heading: number;
  speed: number;
  maxSpeed: number;
  waypointX: number;
  waypointZ: number;
  gold: number;
  stock: Inventory;
  priceMultipliers: Partial<Record<ResourceId, number>>;
  hull: number;
  maxHull: number;
  cannons: number;
  crewCount: number;
  maxCrew: number;
  hireableCrew: CrewMember[];
  unlockedDyesForSale: FlagDyeId[];
  unlockedEmblemsForSale: FlagEmblemId[];
  reloadTimer: number;
  hostileToPlayer: boolean;
  surrenderedToPlayer: boolean;
  fleeingFromPlayer: boolean;
  fleeTimer: number;
  robbed: boolean;
  attackTargetId: string | null;
  discovered: boolean;
  sunk: boolean;
  salvageable?: boolean;
  recruited?: boolean;
  sinkProgress?: number;
  survivor?: WreckSurvivor;
  convoyId?: string;
  convoyRole?: 'lead' | 'merchant' | 'escort';
  convoySlot?: number;
  battleId?: string;
  stormRepairTimer?: number;
}

export type PirateFactionId =
  | 'crimson_corsairs'
  | 'iron_brotherhood'
  | 'gilded_vultures'
  | 'abyssal_fleet'
  | 'tempest_reavers'
  | 'scarlet_sisterhood'
  | 'ashen_raiders'
  | 'emerald_marauders'
  | 'obsidian_armada'
  | 'siren_cutthroats';

export type FactionRelation = 'war' | 'neutral' | 'allied';

export type PirateRank = 1 | 2 | 3 | 4 | 5 | 6;

export interface PirateFactionState {
  id: PirateFactionId;
  name: string;
  playerStanding: number; // -100 .. +100
  alliedUntilDay: number;
  strength: number; // 20 .. 100
  leaderDefeated: boolean;
  territoryRadius: number;
  centerX: number;
  centerZ: number;
  relations: Record<PirateFactionId, FactionRelation>;
}

export type PirateTier = 'sloop' | 'brigantine' | 'galleon' | 'dreadnought';

export type PirateBehavior =
  | 'patrol'
  | 'pursue'
  | 'broadside'
  | 'flank'
  | 'retreat'
  | 'hailing'
  | 'escort'
  | 'hunt_npc'
  | 'defeated';

export interface PirateDemand {
  message: string;
  demandType: 'gold' | 'food' | 'water' | 'cargo';
  amount: number;
}

export interface PirateShipData {
  id: string;
  name: string;
  captainName: string;
  factionId: PirateFactionId;
  rank: PirateRank;
  rankTitle: string;
  shipClassLabel?: string;
  isBoss: boolean;
  isFlagship: boolean;
  fleetId?: string;
  escortTargetId?: string;
  hullArchetype: VesselClass;
  personality: 'greedy' | 'ruthless' | 'honorable' | 'fanatic';
  tier: PirateTier;
  x: number;
  z: number;
  heading: number;
  speed: number;
  maxSpeed: number;
  turnRate: number;
  patrolCenterX: number;
  patrolCenterZ: number;
  patrolAngle: number;
  behavior: PirateBehavior;
  hull: number;
  maxHull: number;
  sails: number;
  steering: number;
  cannons: number;
  maxCannons: number;
  crewCount: number;
  maxCrew: number;
  gold: number;
  loot: Partial<Inventory>;
  reloadTimer: number;
  reloadTime: number;
  fireRange: number;
  damagePerCannon: number;
  hailCooldown: number;
  hailed: boolean;
  defeated: boolean;
  salvageable?: boolean;
  captured: boolean;
  looted: boolean;
  discovered: boolean;
  sinkProgress?: number;
  targetShipId?: string | null;
  survivor?: WreckSurvivor;
  demand: PirateDemand;
  isGhost?: boolean;
  ghostSize?: GhostSizeTier;
  ghostAbilityTimer?: number;
  ghostStealthTimer?: number;
  ghostCollectible?: string;
  battleId?: string;
}

export type FleetShipClass =
  | 'fast_scout'
  | 'medium_armed'
  | 'large_merchant'
  | 'heavy_warship'
  | 'supply_vessel';

export type FleetCommand = 'follow' | 'defend' | 'hold';

export interface FleetShipData {
  id: string;
  name: string;
  shipClass: FleetShipClass;
  hullTier: number;
  deckLevel: number;
  hull: number;
  maxHull: number;
  cannons: number;
  maxCannons: number;
  cannonTier: number;
  crewCount: number;
  maxCrew: number;
  cargoCapacity: number;
  speed: number;
  maxSpeed: number;
  turnRate: number;
  command: FleetCommand;
  slotIndex: number;
  x: number;
  z: number;
  heading: number;
  autonomousResources: {
    wood: number;
    iron: number;
    cloth: number;
    gold: number;
    food?: number;
    water?: number;
  };
  upgradeProgress: number; // 0..1
  upgradeStage: number;
  targetEnemyId: string | null;
  reloadTimer: number;
  sunk?: boolean;
  sinkProgress?: number;
}

export type SeaMonsterSpecies = 'serpent' | 'kraken' | 'shark' | 'whale' | 'deep_horror';
export type SeaMonsterSize = 'small' | 'medium' | 'large' | 'legendary';
export type SeaMonsterAlignment = 'good' | 'evil' | 'neutral';

export interface SeaMonsterData {
  id: string;
  name: string;
  species: SeaMonsterSpecies;
  size: SeaMonsterSize;
  alignment: SeaMonsterAlignment;
  x: number;
  z: number;
  heading: number;
  speed: number;
  hp: number;
  maxHp: number;
  damage: number;
  attackRange: number;
  aggroRange: number;
  patrolCenterX: number;
  patrolCenterZ: number;
  targetId: string | null;
  targetKind: 'player' | 'pirate' | 'merchant' | 'monster' | null;
  attackCooldown: number;
  tameProgress: number;
  tameRequiredFood: number;
  tamed: boolean;
  provokedByPlayer: boolean;
  discovered: boolean;
  defeated: boolean;
  sinkProgress: number;
  animPhase: number;
  escortFactionId?: PirateFactionId;
  escortCrownConvoyId?: string;
}

export interface TamedMonsterCompanion {
  id: string;
  name: string;
  species: SeaMonsterSpecies;
  size?: SeaMonsterSize;
  hp: number;
  maxHp: number;
  damage: number;
  x: number;
  z: number;
  heading: number;
}

export type FlagDyeId =
  | 'weathered_gray'
  | 'crimson'
  | 'navy'
  | 'emerald'
  | 'gold'
  | 'obsidian'
  | 'ivory'
  | 'violet'
  | 'amber'
  | 'teal_abyss'
  | 'royal_purple'
  | 'burnished_bronze'
  | 'bone_silver';

export type FlagPatternId =
  | 'solid'
  | 'horizontal_bicolor'
  | 'vertical_bicolor'
  | 'saltire'
  | 'chevron'
  | 'bordered'
  | 'quartered'
  | 'striped';

export type FlagEmblemId =
  | 'none'
  | 'anchor'
  | 'skull'
  | 'crossed_swords'
  | 'crown'
  | 'kraken'
  | 'sunburst'
  | 'trident'
  | 'serpent'
  | 'dragon_crest';

export type FlagShape = 'rectangle' | 'swallowtail' | 'pennant' | 'burgee';

export interface CustomFlagConfig {
  primaryDye: FlagDyeId;
  secondaryDye: FlagDyeId;
  accentDye: FlagDyeId;
  pattern: FlagPatternId;
  emblem: FlagEmblemId;
  shape: FlagShape;
  decorativeBorder: boolean;
}

export type CombatCommand = 'attack' | 'surrender';
export type CombatTarget = 'hull' | 'sails' | 'cannons' | 'steering' | 'crew';
export type FireMode = 'broadside' | 'focused' | 'hold';

export interface CombatState {
  active: boolean;
  pirateId: string | null;
  monsterId: string | null;
  hostileMerchantId: string | null;
  command: CombatCommand;
  playerReload: number; // 0..1 progress
  playerReloadTime: number;
  retreating: boolean;
  combatLog: string[];
}

export interface JournalEntry {
  id: string;
  day: number;
  timeStr: string;
  title: string;
  body: string;
  author: 'player' | 'log';
  createdAt: number;
}

export type MusicThemeId =
  | 'title'
  | 'peaceful'
  | 'exploration'
  | 'wreck'
  | 'storm'
  | 'pirate_encounter'
  | 'combat'
  | 'victory'
  | 'defeat'
  | 'trading'
  | 'night'
  | 'piracy'
  | 'monster'
  | 'boss'
  | 'fleet_battle';

export type UIScale = 'small' | 'normal' | 'large' | 'extra_large';

export interface GameSettings {
  graphicsQuality: 'high' | 'medium' | 'low';
  masterVolume: number; // 0..1
  musicVolume: number; // 0..1
  sfxVolume: number; // 0..1
  musicEnabled: boolean;
  mouseSensitivity: number; // 0.3..2.0
  invertY: boolean;
  autoSaveEnabled: boolean;
  autoJournalEnabled: boolean;
  tutorialsEnabled: boolean;
  uiScale: UIScale;
}

export interface VoyageStats {
  daysSurvived: number;
  distanceSailed: number;
  wrecksExplored: number;
  piratesDefeated: number;
  bossesDefeated: number;
  monstersDefeated: number;
  tradesCompleted: number;
  shipsRobbed: number;
  survivorsRescued: number;
  peakGold: number;
  causeOfDeath: string;
}

export interface PlayerShipState {
  shipName: string;
  x: number;
  z: number;
  heading: number;
  speed: number;
  throttle: number;
  rudder: number;
  isStopping: boolean;
  gold: number;
  inventory: Inventory;
  upgrades: ShipUpgrades;
  condition: ShipCondition;
  repairPriority: RepairPriority;
  crew: CrewMember[];
}

export interface DiscoveredMarker {
  id: string;
  kind: 'wreck' | 'merchant' | 'pirate' | 'crate' | 'monster' | 'crown' | 'ghost' | 'convoy' | 'battle';
  name: string;
  x: number;
  z: number;
  status: string;
}

export interface TutorialToast {
  id: string;
  title: string;
  message: string;
}

export interface SaveData {
  version: number;
  seed: number;
  day: number;
  timeOfDay: number; // 0..24 hours
  reputation: number; // -100 .. +100
  player: PlayerShipState;
  fleet: FleetShipData[];
  weather: WeatherState;
  weatherForecast: WeatherForecastEntry[];
  factions: Record<PirateFactionId, PirateFactionState>;
  customFlag: CustomFlagConfig;
  unlockedDyes: FlagDyeId[];
  unlockedEmblems: FlagEmblemId[];
  unlockedPatterns: FlagPatternId[];
  ghostCollectibles: string[];
  journal: JournalEntry[];
  exploredCells: string[];
  markers: DiscoveredMarker[];
  lootedWreckIds: string[];
  searchedWreckSections: Record<string, string[]>;
  collectedCrateIds: string[];
  defeatedPirateIds: string[];
  defeatedBossIds: string[];
  defeatedMonsterIds: string[];
  tamedMonsters: TamedMonsterCompanion[];
  activeRepairJob: ManualRepairJob | null;
  dismissedWarnings: string[];
  seenTutorials: string[];
  stats: VoyageStats;
  settings: GameSettings;
}

export interface CrewHealthWarning {
  crewId: string;
  name: string;
  health: number;
}

export interface FleetDistressAlert {
  id: string;
  name: string;
  hullPct: number;
  inDanger: boolean;
}

export interface AdminTeleportTarget {
  id: string;
  kind: 'crown_armada' | 'pirate_armada' | 'pirate_boss' | 'major_battle' | 'ghost_ship';
  label: string;
  x: number;
  z: number;
  distance: number;
}

export interface HudSnapshot {
  phase: 'title' | 'playing' | 'paused' | 'gameover';
  shipName: string;
  day: number;
  timeOfDay: number;
  timeStr: string;
  dayPhaseLabel: string;
  weather: WeatherState;
  weatherForecast: WeatherForecastEntry[];
  steeringHexActive: boolean;
  speedKnots: number;
  headingDeg: number;
  throttle: number;
  isStopping: boolean;
  x: number;
  z: number;
  gold: number;
  reputation: number;
  reputationTitle: string;
  cargoUsed: number;
  cargoCapacity: number;
  crewCount: number;
  maxCrew: number;
  avgMorale: number;
  food: number;
  water: number;
  foodDaysRemaining: number;
  waterDaysRemaining: number;
  supplyWarnings: string[];
  crewHealthWarnings: CrewHealthWarning[];
  fleetDistress: FleetDistressAlert[];
  condition: ShipCondition;
  upgrades: ShipUpgrades;
  activeRepairJob: ManualRepairJob | null;
  nearbyPrompt: {
    kind: 'wreck' | 'merchant' | 'crate' | 'pirate_loot' | 'pirate_hail' | 'monster' | 'ghost_wreck';
    id: string;
    label: string;
    distance: number;
  } | null;
  combat: CombatState;
  activePirate: PirateShipData | null;
  activeMonster: SeaMonsterData | null;
  activeEnemy: {
    kind: 'pirate' | 'monster' | 'merchant';
    name: string;
    subtitle: string;
    hull: number;
    maxHull: number;
    crewCount: number;
    distance: number;
  } | null;
  tamedMonstersCount: number;
  fleetCount: number;
  fleetUnlocked: boolean;
  nearbyGhostWarning: boolean;
  nearbyMajorBattle: string | null;
  activeTornadoWarning: boolean;
  adminUnlocked: boolean;
  adminEnabled: boolean;
  notification: string | null;
  damageBanner: DamageNotification | null;
  journalToast: string | null;
  tutorialToast: TutorialToast | null;
  autosaveTick: number;
}
