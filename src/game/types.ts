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
  | 'salt'
  | 'tools'
  | 'gunpowder'
  | 'cannonballs'
  | 'medicine'
  | 'rareMaterials'
  | 'advancedTimber'
  | 'reinforcedMetals'
  | 'specializedSailcloth'
  | 'decorativeMaterials'
  | 'fishCatch'
  | 'rareFish'
  | 'animalHides'
  | 'leadShot'
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
  | 'fisherman'
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
  fishing?: number;
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

export type FishingGearId =
  | 'none'
  | 'basic_lines'
  | 'hand_rods'
  | 'small_net'
  | 'trawling_net'
  | 'deep_longline';

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
  fishingGear?: FishingGearId;
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

export type AiIntelligenceTier = 'basic' | 'tactical' | 'veteran';
export type VesselTemperament = 'timid' | 'cautious' | 'bold';

export interface BattleDamageMark {
  id: string;
  localX: number;
  localY: number;
  localZ: number;
  section: RepairPriority;
  kind: 'cannon' | 'ram';
  severity: number; // 0.3 .. 1.5
  hasFire: boolean;
}

export interface DamageNotification {
  id: string;
  text: string;
  critical: boolean;
  location: RepairPriority;
  damage: number;
  targetName?: string;
  attackerName?: string;
  source?: 'cannon' | 'ram' | 'hazard';
  direction?: 'dealt' | 'taken' | 'ally';
  ttl?: number;
  maxTtl?: number;
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
  kind: 'crate' | 'barrel' | 'raft' | 'treasure_buoy' | 'timber_debris' | 'supply_bundle';
  x: number;
  z: number;
  discovered?: boolean;
  collected: boolean;
  gold: number;
  loot: Partial<Inventory>;
  survivor?: WreckSurvivor;
}

export interface RockHazardData {
  id: string;
  x: number;
  z: number;
  radius: number;
  height: number;
  rotation: number;
  variant: number;
  submerged?: boolean;
  isReef?: boolean;
}

export type OceanBiomeId = 'temperate' | 'tropical' | 'cold' | 'deep';

export interface IcebergData {
  id: string;
  x: number;
  z: number;
  radius: number;
  height: number;
  rotation: number;
  driftVx: number;
  driftVz: number;
  isGiant: boolean;
  pushable: boolean;
  mass: number;
  variant: number;
}

export interface IceChunkData {
  id: string;
  x: number;
  z: number;
  radius: number;
  height: number;
  vx: number;
  vz: number;
  rotation: number;
}

export interface BreakableIceSheetData {
  id: string;
  x: number;
  z: number;
  radius: number;
  thickness: 1 | 2 | 3; // 1 thin slush sheet, 2 medium pack ice, 3 thick shelf ice
  hp: number;
  maxHp: number;
  crackStage: 0 | 1 | 2 | 3; // 3 = shattered
  broken: boolean;
  rotation: number;
}

export type IslandArchetype =
  | 'tropical'
  | 'rocky'
  | 'forest'
  | 'frozen'
  | 'deserted'
  | 'mysterious'
  | 'tiny_islet'
  | 'large_island';

export type IslandDiscoveryKind =
  | 'buried_chest'
  | 'pirate_chest'
  | 'abandoned_camp'
  | 'old_hut'
  | 'ancient_ruin'
  | 'cave_stash'
  | 'supply_crate'
  | 'map_fragment_bottle'
  | 'rare_curio';

export interface IslandDiscoveryData {
  id: string;
  kind: IslandDiscoveryKind;
  name: string;
  description: string;
  localX: number;
  localZ: number;
  worldX: number;
  worldZ: number;
  insideCave?: boolean;
  requiresDig?: boolean;
  guardedByPirateIds?: string[];
  collected: boolean;
  gold: number;
  loot: Partial<Inventory>;
  grantsMapFragment?: boolean;
  grantsTreasureMap?: boolean;
}

export type IslandPirateGuardRole = 'cutlass' | 'pistol';

export interface IslandPirateGuardData {
  id: string;
  name: string;
  islandId: string;
  chestId: string;
  role: IslandPirateGuardRole;
  x: number;
  y: number;
  z: number;
  homeX: number;
  homeZ: number;
  heading: number;
  speed: number;
  maxSpeed: number;
  hp: number;
  maxHp: number;
  damage: number;
  range: number;
  attackCooldown: number;
  reloadTimer: number;
  hitFlashTimer: number;
  dead: boolean;
  looted: boolean;
  /** True for members of an indigenous tribe that controls the island instead of pirates. */
  tribal?: boolean;
  animPhase: number;
  lootGold: number;
  lootGunpowder: number;
  lootLeadShot: number;
}

export interface IslandBeachedWreckData {
  id: string;
  name: string;
  localX: number;
  localZ: number;
  worldX: number;
  worldZ: number;
  rotation: number;
  scale: number;
  searched: boolean;
  gold: number;
  loot: Partial<Inventory>;
  grantsMapFragment?: boolean;
}

export type IslandSettlementKind =
  | 'fishing_village'
  | 'trading_post'
  | 'frontier_settlement'
  | 'coastal_fort'
  | 'abandoned_outpost';

export type SettlementFactionId = 'crown' | 'independent' | 'pirate_haven' | 'abandoned';

export interface SettlementErrand {
  id: string;
  title: string;
  description: string;
  resourceId: ResourceId;
  requiredQty: number;
  rewardGold: number;
  rewardReputation: number;
  completed: boolean;
}

export interface IslandSettlementData {
  id: string;
  islandId: string;
  name: string;
  kind: IslandSettlementKind;
  faction: SettlementFactionId;
  worldX: number;
  worldZ: number;
  dockX: number;
  dockZ: number;
  rotation: number;
  gold: number;
  stock: Inventory;
  hireableCrew: CrewMember[];
  errand: SettlementErrand | null;
  rumorCost: number;
  rumorHeard: boolean;
  rumorText: string;
  discovered: boolean;
}

export interface IslandData {
  id: string;
  name: string;
  archetype: IslandArchetype;
  biome: OceanBiomeId;
  x: number;
  z: number;
  radius: number;
  maxHeight: number;
  seed: number;
  hasRiver: boolean;
  riverAngle: number;
  hasCave: boolean;
  caveEntranceX: number;
  caveEntranceZ: number;
  caveRadius: number;
  hasRuins: boolean;
  forestDensity: number;
  reefRingRadius: number;
  dockX: number;
  dockZ: number;
  discovered: boolean;
  discoveries: IslandDiscoveryData[];
  beachedWrecks: IslandBeachedWreckData[];
  settlement: IslandSettlementData | null;
  pirateGuards?: IslandPirateGuardData[];
  /** Who holds the island's treasure: pirates (default) or a local indigenous tribe. */
  controller?: 'pirates' | 'tribe';
  tribeName?: string;
}

export type WildlifeSpecies =
  | 'dolphin'
  | 'whale_pod'
  | 'ocean_shark'
  | 'sea_turtle'
  | 'seal'
  | 'fish_school'
  | 'manta_ray'
  | 'parrotfish'
  | 'swordfish'
  | 'arctic_cod_shoal'
  | 'ocean_flock_bird'
  | 'seabird'
  | 'boar'
  | 'wolf'
  | 'snake'
  | 'crocodile'
  | 'bear';

export type WildlifeDomain = 'ocean' | 'island' | 'air';
export type WildlifeBehaviorState =
  | 'idle'
  | 'patrol'
  | 'flee'
  | 'cautious'
  | 'chase'
  | 'attack'
  | 'injured_flee';

export interface WildlifeActorData {
  id: string;
  species: WildlifeSpecies;
  domain: WildlifeDomain;
  islandId?: string;
  killable?: boolean;
  flockId?: string;
  flockOffsetIndex?: number;
  vy?: number;
  x: number;
  y: number;
  z: number;
  homeX: number;
  homeZ: number;
  heading: number;
  speed: number;
  maxSpeed: number;
  hp: number;
  maxHp: number;
  damage: number;
  aggression: 'passive' | 'territorial' | 'hostile';
  state: WildlifeBehaviorState;
  attackCooldown: number;
  hitFlashTimer: number;
  koTimer: number;
  dead: boolean;
  harvested: boolean;
  animPhase: number;
  lootFood: number;
  lootHides: number;
  lootCloth: number;
  lootSalt?: number;
}

export interface TreasureMapItem {
  id: string;
  title: string;
  clueText: string;
  islandId: string;
  islandName: string;
  targetX: number;
  targetZ: number;
  rewardGold: number;
  rewardLoot: Partial<Inventory>;
  found: boolean;
}

export type FpsWeaponId = 'cutlass' | 'pistol' | 'musket';

export interface FpsWeaponRuntimeState {
  activeWeapon: FpsWeaponId;
  pistolLoaded: boolean;
  musketLoaded: boolean;
  pistolReloadRemaining: number; // >0 if paused mid-reload or reloading
  musketReloadRemaining: number;
  isReloading: boolean;
  isBlocking: boolean;
  cooldown: number;
}

export interface WorldFloatingDamage {
  id: string;
  screenX: number;
  screenY: number;
  amount: number;
  partLabel: string;
  targetName: string;
  source: 'cannon' | 'ram' | 'hazard' | 'monster';
  direction: 'dealt' | 'taken' | 'ally';
  critical: boolean;
  opacity: number;
}

export interface FishingCatchSpec {
  species: string;
  rarity: 'Common' | 'Uncommon' | 'Rare' | 'Prize';
  biome: OceanBiomeId | 'any';
  foodValue: number;
  goldValue: number;
  difficulty: number; // 1..4
  isRare: boolean;
}

export interface FirstPersonHudState {
  active: boolean;
  islandId: string | null;
  islandName: string;
  islandArchetype: IslandArchetype;
  playerHp: number;
  maxPlayerHp: number;
  stamina: number;
  inWater: boolean;
  insideCave: boolean;
  pointerLocked: boolean;
  weapons: FpsWeaponRuntimeState;
  gunpowder: number;
  leadShot: number;
  promptText: string | null;
  promptActionKind: 'board_ship' | 'discovery' | 'dig_treasure' | 'beached_wreck' | 'settlement' | 'cave' | 'harvest_animal' | 'loot_pirate' | 'parley_guard' | null;
  treasureHint: string | null;
  statusBanner: string | null;
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
  temperament?: VesselTemperament;
  aiIntelligence?: AiIntelligenceTier;
  desperateRamCooldown?: number;
  canTrade?: boolean;
  isBountyTarget?: boolean;
  bountyId?: string;
  huntingBountyId?: string;
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
  | 'ram'
  | 'retreat'
  | 'hailing'
  | 'escort'
  | 'hunt_npc'
  | 'assist'
  | 'defeated';

export interface PirateDemand {
  message: string;
  demandType: 'gold' | 'food' | 'water' | 'cargo';
  amount: number;
}

export interface PirateShipData {
  id: string;
  /** Set when this ship is another human player's vessel (PvP stand-in); never AI-driven. */
  playerId?: string;
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
  aiIntelligence?: AiIntelligenceTier;
  ramCooldown?: number;
  ramCommitTimer?: number;
  isBountyTarget?: boolean;
  bountyId?: string;
  huntingBountyId?: string;
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

export type SeaMonsterSpecies =
  | 'serpent'
  | 'kraken'
  | 'giant_kraken'
  | 'leviathan_squid'
  | 'shark'
  | 'whale'
  | 'deep_horror'
  | 'mosasaur'
  | 'frost_leviathan';
export type SeaMonsterSize = 'small' | 'medium' | 'large' | 'legendary';
export type SeaMonsterAlignment = 'good' | 'evil' | 'neutral';
export type SeaMonsterAttackStyle = 'tentacles' | 'ram_bite';

export interface SeaMonsterData {
  id: string;
  name: string;
  species: SeaMonsterSpecies;
  size: SeaMonsterSize;
  alignment: SeaMonsterAlignment;
  attackStyle?: SeaMonsterAttackStyle;
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
  attackAnimTimer?: number;
  tameProgress: number;
  tameRequiredFood: number;
  tamed: boolean;
  provokedByPlayer: boolean;
  discovered: boolean;
  defeated: boolean;
  sinkProgress: number;
  animPhase: number;
  carcassRemainingFood?: number;
  carcassRemainingSalt?: number;
  carcassHarvested?: boolean;
  carcassTimer?: number;
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

export interface CombatEnemyRef {
  kind: 'pirate' | 'merchant' | 'monster';
  id: string;
}

export interface ActiveEnemyStatus {
  kind: 'pirate' | 'monster' | 'merchant';
  id: string;
  name: string;
  subtitle: string;
  hull: number;
  maxHull: number;
  crewCount: number;
  distance: number;
  behaviorLabel?: string;
  intelligenceLabel?: string;
  isPrimary: boolean;
}

export interface CombatState {
  active: boolean;
  pirateId: string | null;
  monsterId: string | null;
  hostileMerchantId: string | null;
  enemies?: CombatEnemyRef[];
  primaryTargetId?: string | null;
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
  | 'fleet_battle'
  | 'island'
  | 'settlement';

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
  damageMarks?: BattleDamageMark[];
}

export interface DiscoveredMarker {
  id: string;
  kind:
    | 'wreck'
    | 'merchant'
    | 'pirate'
    | 'crate'
    | 'monster'
    | 'crown'
    | 'ghost'
    | 'convoy'
    | 'battle'
    | 'island'
    | 'settlement'
    | 'treasure';
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
  treasureFragments?: number;
  treasureMaps?: TreasureMapItem[];
  discoveredIslandIds?: string[];
  collectedDiscoveryIds?: string[];
  /** Per-island standing with a controlling tribe. Missing = neutral/wary. */
  tribeStanding?: Record<string, 'allied' | 'hostile'>;
  /** Islands whose guards were provoked (attacked) by this player. */
  islandProvoked?: string[];
  /** Islands where this player already took a friendly share of the treasure. */
  treasureSharesTaken?: string[];
  completedErrandIds?: string[];
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
  bounty?: BountyContract | null;
  stats: VoyageStats;
  settings: GameSettings;
}

export type BountyTargetKind = 'pirate' | 'crown';
export type BountyTier = 'petty' | 'dangerous' | 'notorious' | 'legendary';
export type BountyStatus = 'offered' | 'active' | 'claimed_player' | 'claimed_rival' | 'declined';

export interface BountyContract {
  id: string;
  targetKind: BountyTargetKind;
  tier: BountyTier;
  tierLabel: string;
  issuerLabel: string;
  targetShipId: string;
  targetName: string;
  targetCaptain: string;
  targetShipClass: string;
  rewardGold: number;
  reputationDelta: number;
  maxHull: number;
  rivalHunterIds: string[];
  rivalHunterNames: string[];
  status: BountyStatus;
  offeredDay: number;
  expiresAtDay: number;
  claimedByName?: string;
}

export interface BountyHudState {
  id: string;
  status: 'offered' | 'active';
  targetKind: BountyTargetKind;
  tier: BountyTier;
  tierLabel: string;
  issuerLabel: string;
  targetName: string;
  targetCaptain: string;
  targetShipClass: string;
  rewardGold: number;
  reputationDelta: number;
  targetHull: number;
  targetMaxHull: number;
  distance: number;
  relBearingDeg: number; // -180..180 where 0 = ahead, +90 = starboard, -90 = port
  compassDeg: number; // 0..359 world heading to target
  directionLabel: string;
  rivalHuntersAlive: number;
  rivalHunterNames: string[];
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


export interface HudSnapshot {
  phase: 'title' | 'playing' | 'paused' | 'gameover';
  shipName: string;
  day: number;
  timeOfDay: number;
  timeStr: string;
  dayPhaseLabel: string;
  biome?: OceanBiomeId;
  biomeLabel?: string;
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
  salt: number;
  foodDaysRemaining: number;
  waterDaysRemaining: number;
  saltDaysRemaining: number;
  fishermanCount?: number;
  fishingGear?: FishingGearId;
  treasureMapsCount?: number;
  treasureFragments?: number;
  supplyWarnings: string[];
  crewHealthWarnings: CrewHealthWarning[];
  fleetDistress: FleetDistressAlert[];
  condition: ShipCondition;
  upgrades: ShipUpgrades;
  activeRepairJob: ManualRepairJob | null;
  nearbyPrompt: {
    kind:
      | 'wreck'
      | 'merchant'
      | 'crate'
      | 'pirate_loot'
      | 'pirate_hail'
      | 'monster'
      | 'monster_carcass'
      | 'sea_wildlife'
      | 'ghost_wreck'
      | 'island'
      | 'settlement'
      | 'player';
    id: string;
    label: string;
    distance: number;
  } | null;
  nearbyFishTarget?: {
    kind: 'sea_wildlife' | 'monster_carcass';
    id: string;
    label: string;
    speciesLabel: string;
    food: number;
    salt: number;
    distance: number;
    sizeTier: number;
    castCost: number;
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
  activeEnemies?: ActiveEnemyStatus[];
  assistingAllies?: string[];
  tamedMonstersCount: number;
  fleetCount: number;
  fleetUnlocked: boolean;
  nearbyGhostWarning: boolean;
  nearbyMajorBattle: string | null;
  activeTornadoWarning: boolean;
  notification: string | null;
  damageBanner: DamageNotification | null;
  damageNotifications?: DamageNotification[];
  floatingDamages?: WorldFloatingDamage[];
  firstPerson?: FirstPersonHudState;
  journalToast: string | null;
  tutorialToast: TutorialToast | null;
  bounty?: BountyHudState | null;
  autosaveTick: number;
}
