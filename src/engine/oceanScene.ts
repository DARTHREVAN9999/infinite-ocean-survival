import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { RemotePlayerState, NpcWireState, WorldPatch, RelayType } from '../network/MultiplayerClient';
import {
  ActiveEnemyStatus,
  BattleDamageMark,
  BountyContract,
  BountyHudState,
  BreakableIceSheetData,
  CannonUpgrades,
  CombatCommand,
  CombatEnemyRef,
  CombatState,
  CrewAutoAssignMode,
  CrewMember,
  CrewRole,
  CustomFlagConfig,
  DamageNotification,
  DiscoveredMarker,
  FishingCatchSpec,
  FishingGearId,
  FlagDyeId,
  FlagEmblemId,
  FlagPatternId,
  FleetCommand,
  FleetDistressAlert,
  FleetShipClass,
  FleetShipData,
  FloatingCrateData,
  FpsWeaponId,
  GameSettings,
  GhostSizeTier,
  HudSnapshot,
  IceChunkData,
  IcebergData,
  Inventory,
  IslandData,
  IslandPirateGuardData,
  IslandSettlementData,
  MerchantShipData,
  MusicThemeId,
  OceanBiomeId,
  PirateFactionId,
  PirateShipData,
  RepairPriority,
  ResourceId,
  RockHazardData,
  SaveData,
  SeaMonsterData,
  ShipwreckData,
  TutorialToast,
  WeaponType,
  WeatherType,
  WeatherState,
  WildlifeActorData,
  WorldFloatingDamage,
  WreckSurvivor,
} from '../game/types';
import {
  ALL_WEATHER_TYPES,
  buildWeatherStateFromType,
  clamp,
  computeBoatBuoyancy,
  generateWeatherForecast,
  normalizeAngle,
  pickNextWeather,
  sampleWaveHeight,
  WEATHER_PRESETS,
} from '../game/waveMath';
import {
  canAffordCosts,
  computeManualRepairPlan,
  createEmptyInventory,
  createRepairJob,
  deductCosts,
  DEFAULT_PLAYER_SHIP_NAME,
  executeTrade,
  generateGhostShipWreck,
  generateMerchantShip,
  generateSunkenVesselWreck,
  getCannonStatUpgradeCost,
  getCargoCapacity,
  getCargoWeight,
  getInstallCannonCost,
  getMaxCannonSlots,
  getMaxCrewCapacity,
  getMerchantBuyPrice,
  getMerchantSellPrice,
  HULL_UPGRADE_CATALOG,
  isValidPreChosenShipName,
  RESOURCE_DEFS,
  rollCrewOfferAccepted,
  WEAPON_SPECS,
} from '../game/economy';
import {
  applyLeaderDefeatConsequences,
  canTradeWithPirate,
  decideInnocentReaction,
  evolveFactionDiplomacy,
  formTemporaryPirateAlliance,
  getMerchantReputationBehavior,
  getReputationTitle,
  isPirateAlliedWithPlayer,
  isPlayerPirateAligned,
  PIRATE_FACTION_IDS,
  PIRATE_FACTIONS,
  shiftFactionStanding,
} from '../game/factions';
import {
  feedSeaMonsterToTame,
  generateSeaMonster,
  getMonsterAttackStyle,
  getMonsterProvisionDrop,
  getMonsterSaltDrop,
  shouldMonsterAttackPlayer,
  stepMonsterChaseBehavior,
} from '../game/monsters';
import {
  computeAutoAssignRoles,
  computeCrewPerformance,
  computeShipHandling,
  computeSupplyDaysRemaining,
  createRandomCrewMember,
  CREW_ROLE_LABELS,
  GAME_DAY_SECONDS,
  getLowHealthWarnings,
  getRoleCounts,
  grantCrewRoleXp,
  stepSurvivalAndRepairs,
  treatCrewMember,
} from '../game/survival';
import {
  computeExactFleetMotion,
  computeFleetRecruitCost,
  computeWedgeFormationTarget,
  createFleetShip,
  createFleetShipFromDefeated,
  createFleetShipFromMerchant,
  FLEET_CLASS_SPECS,
  getFleetUnlockStatus,
  MAX_FLEET_SIZE,
  steerFleetShipHeading,
  stepFleetAutonomy,
} from '../game/fleet';
import {
  computeAutoCombatStats,
  computePirateAI,
  decideFriendlyAssistance,
  decideUnarmedOrTrawlerBehavior,
  FriendlyAssistanceResult,
  generateGhostShip,
  generatePirateShip,
  PirateAIContext,
  resolveBreakableIceSheetCollision,
  resolveEnemyVolley,
  resolveNpcVsNpcVolley,
  resolvePlayerVolley,
  resolveShipCollision,
  rollEnemySalvageable,
} from '../game/combat';
import {
  CHUNK_SIZE,
  chunkKey,
  generateWorldChunk,
  mulberry32,
  worldToChunk,
} from '../game/worldGen';
import {
  addJournalEntry,
  clearVoyageStorage,
  createNewVoyage,
  deleteJournalEntry,
  formatTimeOfDay,
  getDayPhaseLabel,
  saveVoyageToStorage,
  updateJournalEntry,
} from '../game/storage';
import { getBiomeConfig, getOceanBiome } from '../game/biomes';
import { resolveShipIslandCoastCollision, sampleIslandTerrainHeight } from '../game/islands';
import { addTreasureFragments, digTreasureSpot } from '../game/treasure';
import {
  convertFishToProvisions,
  FISHING_GEAR_SPECS,
  fishNearMarineWildlife,
  fishNearMonsterCarcass,
  stepCrewFishing,
  WILDLIFE_FISH_TIER,
  MONSTER_FISH_TIER,
  getFishingCastCost,
} from '../game/fishing';
import {
  damageIslandPirateGuard,
  getGuardAttitude,
  damageWildlifeActor,
  FPS_WEAPON_SPECS,
  FpsMouseInputState,
  harvestWildlifeActor,
  isDiscoveryChestGuarded,
  lootIslandPirateGuard,
  stepFpsMouseDelta,
  stepIslandPirateGuard,
  stepWildlifeActor,
  WILDLIFE_SPECS,
} from '../game/fpsCombat';
import {
  buildBountyHudState,
  createBountyContract,
  resolveBountyHunterClaim,
  resolveBountyKillByPlayer,
} from '../game/bounty';
import { createProceduralTextures, ProceduralTextureSet } from './textures';
import {
  animateDeckCrewActors,
  animateWavingFlag,
  buildFleetShipMesh,
  buildFloatingCrateMesh,
  buildNpcShip,
  buildPlayerShip,
  buildSeaRockClusterMesh,
  buildShipwreckMesh,
  buildTornadoMesh,
  BuiltNpcShip,
  BuiltPlayerShip,
  createBattleDamageMarkMesh,
  DeckCrewActor,
} from './shipBuilder';
import {
  animateSeaMonsterMesh,
  buildSeaMonsterMesh,
  BuiltSeaMonster,
} from './monsterBuilder';
import {
  animateIslandPirateGuardMesh,
  animateWildlifeMesh,
  buildBreakableIceSheetMesh,
  buildIcebergMesh,
  buildIceChunkMesh,
  buildIslandMesh,
  buildIslandPirateGuardMesh,
  buildWildlifeMesh,
  BuiltBreakableIceSheet,
  BuiltIsland,
  BuiltIslandPirateGuard,
  BuiltWildlife,
  updateBreakableIceSheetVisuals,
} from './islandBuilder';
import { FirstPersonIslandController, getTreasureHintForIsland } from './fpsController';
import { NauticalSoundEngine } from '../audio/soundEngine';

const OCEAN_VERTEX_SHADER = `
uniform float uTime;
uniform float uWaveIntensity;
uniform float uRogueBoost;
uniform vec2 uOffset;

varying vec3 vWorldPos;
varying vec3 vNormal;
varying float vCrest;

float waveHeight(vec2 p) {
  float amp = max(0.15, uWaveIntensity) * 1.45;
  float y = 0.0;

  float p0 = dot(p, vec2(0.86, 0.51)) * 0.048 + uTime * 1.15;
  float s0 = sin(p0);
  y += (s0 + 0.22 * (s0 * s0 - 0.5)) * 0.52 * amp;

  float p1 = dot(p, vec2(-0.42, 0.91)) * 0.078 + uTime * 1.48;
  float s1 = sin(p1);
  y += (s1 + 0.22 * (s1 * s1 - 0.5)) * 0.27 * amp;

  float p2 = dot(p, vec2(0.24, -0.97)) * 0.135 + uTime * 1.92;
  float s2 = sin(p2);
  y += (s2 + 0.22 * (s2 * s2 - 0.5)) * 0.14 * amp;

  float p3 = dot(p, vec2(-0.92, -0.39)) * 0.215 + uTime * 2.45;
  float s3 = sin(p3);
  y += (s3 + 0.22 * (s3 * s3 - 0.5)) * 0.07 * amp;

  if (uRogueBoost > 0.01) {
    float rp = dot(p, vec2(0.70, 0.71)) * 0.028 + uTime * 0.78;
    float re = max(0.0, sin(rp));
    y += re * re * uRogueBoost * 3.2;
  }

  return y;
}

void main() {
  vec3 pos = position;
  vec2 worldXZ = pos.xz + uOffset;
  float h = waveHeight(worldXZ);
  pos.y = h;

  float eps = 0.75;
  float hR = waveHeight(worldXZ + vec2(eps, 0.0));
  float hU = waveHeight(worldXZ + vec2(0.0, eps));
  vec3 n = normalize(vec3(h - hR, eps, h - hU));

  vNormal = n;
  vCrest = smoothstep(0.35 * uWaveIntensity, 1.35 * uWaveIntensity, h);
  vec4 wp = modelMatrix * vec4(pos, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const OCEAN_FRAGMENT_SHADER = `
uniform vec3 uDeepColor;
uniform vec3 uShallowColor;
uniform vec3 uSkyColor;
uniform vec3 uHorizonColor;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uFogDensity;
uniform float uTime;
uniform vec3 uBoatPos;
uniform vec2 uBoatFwd;
uniform float uBoatSpeed;
uniform vec3 uIslandCenters[4];
uniform vec4 uIslandMeta[4];

varying vec3 vWorldPos;
varying vec3 vNormal;
varying float vCrest;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
    mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

void main() {
  vec3 V = normalize(cameraPosition - vWorldPos);
  float n1 = noise(vWorldPos.xz * 0.28 + vec2(uTime * 0.55, uTime * 0.35));
  float n2 = noise(vWorldPos.xz * 0.72 - vec2(uTime * 0.42, uTime * 0.68));
  vec3 microN = normalize(vec3((n1 - 0.5) * 0.22, 1.0, (n2 - 0.5) * 0.22));
  vec3 N = normalize(vNormal + microN * 0.32);

  float NdotV = max(dot(N, V), 0.0);
  float fresnel = pow(1.0 - NdotV, 4.0);

  float scatter = clamp(vCrest * 0.75 + (1.0 - NdotV) * 0.25, 0.0, 1.0);
  vec3 waterBase = mix(uDeepColor, uShallowColor, scatter);

  float tropSurfGlow = 0.0;
  float tropLagoonMix = 0.0;
  for (int i = 0; i < 4; i++) {
    if (uIslandMeta[i].z > 0.5) {
      vec2 idelta = vWorldPos.xz - uIslandCenters[i].xy;
      float idist = length(idelta);
      float baseR = uIslandCenters[i].z;
      if (idist < baseR + 95.0) {
        float ang = atan(idelta.y, idelta.x);
        float seedVal = uIslandMeta[i].x;
        float warp = sin(ang * 3.0 + seedVal * 0.11) * 0.045 + cos(ang * 5.0 - seedVal * 0.23) * 0.025;
        float coastR = baseR * (1.0 + warp);
        float shoreDist = idist - coastR;
        float isTrop = uIslandMeta[i].y;

        if (isTrop > 0.5) {
          float reefLagoon = 1.0 - smoothstep(0.0, 48.0, max(0.0, shoreDist));
          float deepShelf = 1.0 - smoothstep(18.0, 82.0, max(0.0, shoreDist));
          float caustic1 = noise(vWorldPos.xz * 0.42 + vec2(uTime * 0.25, -uTime * 0.18));
          float caustic2 = noise(vWorldPos.xz * 0.95 - vec2(uTime * 0.35, uTime * 0.28));
          float caustics = smoothstep(0.45, 0.88, caustic1 * 0.6 + caustic2 * 0.5) * reefLagoon;
          vec3 reefTurquoise = vec3(0.08, 0.64, 0.68);
          vec3 shallowAqua = vec3(0.24, 0.88, 0.86);
          vec3 sandyGlow = vec3(0.60, 0.94, 0.86);
          vec3 tropColor = mix(reefTurquoise, shallowAqua, reefLagoon) + sandyGlow * caustics * 0.28;
          waterBase = mix(waterBase, tropColor, clamp(deepShelf * 0.55 + reefLagoon * 0.55, 0.0, 0.94));
          tropLagoonMix = max(tropLagoonMix, reefLagoon);
        } else {
          float shoreShallow = (1.0 - smoothstep(0.0, 22.0, max(0.0, shoreDist))) * 0.35;
          waterBase = mix(waterBase, uShallowColor * 1.18, shoreShallow);
        }

        float waveRoll1 = sin(shoreDist * 0.45 - uTime * 2.1 + noise(vWorldPos.xz * 0.16) * 2.4);
        float waveRoll2 = sin(shoreDist * 0.85 - uTime * 2.8 + 1.4);
        float shoreBand = (1.0 - smoothstep(0.0, isTrop > 0.5 ? 24.0 : 12.0, max(0.0, shoreDist))) * smoothstep(-3.5, 0.8, shoreDist);
        float innerFoamLine = 1.0 - smoothstep(0.0, isTrop > 0.5 ? 5.2 : 3.0, abs(shoreDist - 1.2));
        float ringGlow = max(innerFoamLine * 0.88, shoreBand * smoothstep(0.25, 0.92, waveRoll1 * 0.6 + waveRoll2 * 0.4) * (isTrop > 0.5 ? 0.92 : 0.42));
        tropSurfGlow = max(tropSurfGlow, ringGlow * (isTrop > 0.5 ? 1.0 : 0.45));
      }
    }
  }

  vec3 col = mix(waterBase, uSkyColor, clamp(fresnel * (0.85 - tropLagoonMix * 0.42), 0.06, 0.82));

  vec3 H = normalize(uSunDir + V);
  float spec = pow(max(dot(N, H), 0.0), 140.0);
  float broadSpec = pow(max(dot(N, H), 0.0), 18.0) * 0.16;
  col += uSunColor * (spec * 1.45 + broadSpec);

  float foamNoise = noise(vWorldPos.xz * 0.65 + uTime * 0.45);
  float fineFoam = noise(vWorldPos.xz * 1.85 - uTime * 0.6);
  float crestFoam = smoothstep(0.58, 0.92, vCrest * (0.55 + foamNoise * 0.6 + fineFoam * 0.35));

  vec2 rel = vWorldPos.xz - uBoatPos.xz;
  float alongBack = dot(rel, -uBoatFwd);
  float perp = abs(rel.x * uBoatFwd.y - rel.y * uBoatFwd.x);

  float hullDist = length(vec2(perp * 1.45, alongBack * 0.62));
  float ringFoam = smoothstep(4.6, 2.3, hullDist) * smoothstep(0.38, 0.82, fineFoam * 0.65 + foamNoise * 0.45) * 0.68;

  float wakeArmDist = abs(perp - (1.4 + max(0.0, alongBack) * 0.23));
  float wakeArm = smoothstep(1.35 + max(0.0, alongBack) * 0.035, 0.15, wakeArmDist);
  float wakeCenter = smoothstep(1.5, 0.0, perp) * 0.45;
  float wakeLen = smoothstep(1.5, 5.5, alongBack) * smoothstep(46.0, 9.0, alongBack);
  float wakeFoam = wakeLen * max(wakeArm, wakeCenter) * clamp(uBoatSpeed / 4.2, 0.0, 1.0)
    * smoothstep(0.32, 0.85, fineFoam * 0.6 + foamNoise * 0.5) * 0.72;

  float totalFoam = clamp(crestFoam * 0.68 + ringFoam + wakeFoam + tropSurfGlow, 0.0, 0.95);
  vec3 foamColor = mix(vec3(0.84, 0.90, 0.95), uSunColor * 0.32 + vec3(0.76), 0.35);
  foamColor = mix(foamColor, vec3(0.96, 0.99, 1.0), clamp(tropSurfGlow * 1.15, 0.0, 1.0));
  col = mix(col, foamColor, totalFoam);

  float camDist = length(cameraPosition - vWorldPos);
  float fogFactor = 1.0 - exp(-pow(camDist * uFogDensity, 1.65));
  col = mix(col, uHorizonColor, clamp(fogFactor, 0.0, 1.0));

  gl_FragColor = vec4(col, 1.0);
}
`;

const SKY_VERTEX_SHADER = `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const SKY_FRAGMENT_SHADER = `
uniform vec3 uZenithColor;
uniform vec3 uHorizonColor;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uSunVisibility;
uniform float uMoonVisibility;
varying vec3 vDir;

void main() {
  vec3 d = normalize(vDir);
  float h = clamp(d.y, 0.0, 1.0);
  vec3 sky = mix(uHorizonColor, uZenithColor, pow(h, 0.55));

  float sunDot = max(dot(d, normalize(uSunDir)), 0.0);
  float sunHalo = pow(sunDot, 10.0) * 0.38 * uSunVisibility;
  float sunDisc = smoothstep(0.9965, 0.9992, sunDot) * 1.9 * uSunVisibility;
  sky += uSunColor * (sunHalo + sunDisc);

  float moonDot = max(dot(d, normalize(-uSunDir)), 0.0);
  float moonDisc = smoothstep(0.9975, 0.9994, moonDot) * 0.95 * uMoonVisibility;
  float moonHalo = pow(moonDot, 22.0) * 0.18 * uMoonVisibility;
  sky += vec3(0.76, 0.84, 0.96) * (moonDisc + moonHalo);

  gl_FragColor = vec4(sky, 1.0);
}
`;

interface ActiveCannonball {
  mesh: THREE.Mesh;
  start: THREE.Vector3;
  end: THREE.Vector3;
  t: number;
  duration: number;
  arcHeight: number;
  fromPlayer: boolean;
  isHit: boolean;
  onArrive?: () => void;
}

interface MuzzleFlash {
  mesh: THREE.Mesh;
  life: number;
  maxLife: number;
}

interface RemotePlayerShipView {
  id: string;
  name: string;
  shipName: string;
  hullTier: number;
  reputation: number;
  hullPct: number;
  cannons: number;
  x: number;
  z: number;
  heading: number;
  targetX: number;
  targetZ: number;
  targetHeading: number;
  speed: number;
  landed: boolean;
  built: BuiltPlayerShip;
  nameTag: THREE.Sprite;
  nameTexture: THREE.CanvasTexture;
}

interface ActiveParticle {
  alive: boolean;
  life: number;
  maxLife: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  r: number;
  g: number;
  b: number;
}

export interface PlayerTradeOffer {
  giveGold: number;
  giveRes: ResourceId | null;
  giveQty: number;
  askGold: number;
  askRes: ResourceId | null;
  askQty: number;
}

export interface IncomingTradeOffer {
  offerId: string;
  from: string;
  fromName: string;
  offer: PlayerTradeOffer;
}

/** What the engine needs from the network layer. */
export interface NetBridge {
  sendPatch: (kind: string, id: string, data: Record<string, unknown>) => void;
  sendRelay: (type: RelayType, to: string, payload?: Record<string, unknown>) => boolean;
}

export interface EngineCallbacks {
  onHudUpdate: (snap: HudSnapshot) => void;
  onPirateHail: (pirate: PirateShipData) => void;
  onCrownHail: (crownShip: MerchantShipData) => void;
  onVictoryLoot: (pirate: PirateShipData) => void;
  onMerchantVictory?: (merchant: MerchantShipData) => void;
  onSettlementOpen?: (settlement: IslandSettlementData) => void;
  onStateChange: (phase: 'title' | 'playing' | 'paused' | 'gameover') => void;
  onSaveUpdate: (save: SaveData) => void;
  onHotkeyMenu: (menu: 'ship' | 'journal' | 'map' | 'pause' | 'interact' | 'fishing') => void;
  onPlayerDeath?: (details: { cause: string; lostGold: number }) => void;
  onIncomingTradeOffer?: (offer: IncomingTradeOffer) => void;
}

export class OceanEngine {
  private container: HTMLElement;
  private callbacks: EngineCallbacks;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private isSoftwareGl: boolean;
  private textures: ProceduralTextureSet;
  private sound = new NauticalSoundEngine();

  private oceanMesh!: THREE.Mesh;
  private oceanUniforms!: Record<string, THREE.IUniform>;
  private skyMesh!: THREE.Mesh;
  private skyUniforms!: Record<string, THREE.IUniform>;
  private starsPoints!: THREE.Points;
  private cloudsGroup!: THREE.Group;
  private rainPoints!: THREE.Points;
  private sunLight!: THREE.DirectionalLight;
  private hemiLight!: THREE.HemisphereLight;
  private fog!: THREE.FogExp2;

  private playerShip!: BuiltPlayerShip;
  private saveData: SaveData;
  private remotePlayers = new Map<string, RemotePlayerShipView>();
  private remoteChunkStreams = new Map<string, string>();
  private isMultiplayerWorldAuthority = true;
  private net: NetBridge | null = null;
  private myPlayerId = '';
  private npcRemote = new Map<string, { ownerId: string; x: number; z: number; heading: number; speed: number; behavior?: string; hullPct?: number; ts: number }>();
  private sharedStore = new Map<string, Record<string, unknown>>();
  private sharedTracked = new Map<string, { obj: object; get: () => Record<string, unknown>; fp: string }>();
  private sharedPublishedIds: Record<'wreck' | 'crate' | 'pirate' | 'monster' | 'discovery', Set<string>> = {
    wreck: new Set(), crate: new Set(), pirate: new Set(), monster: new Set(), discovery: new Set(),
  };
  private sharedReady = false;
  private sharedAccum = 0;
  private pvpOpponents = new Set<string>();
  private pendingOutgoingTrades = new Map<string, { to: string; offer: PlayerTradeOffer }>();
  private pendingIncomingTrades = new Map<string, { from: string; fromName: string; offer: PlayerTradeOffer }>();
  private lastKnownCrew: CrewMember[] = [];
  private multiplayerWorldSeed: number | null = null;
  private phase: 'title' | 'playing' | 'paused' | 'gameover' = 'title';
  private modalOpen = false;
  private activeModalKind: string | null = null;
  private simTime = 0;
  private frameId = 0;
  private lastTimestamp = 0;
  private hudEmitAccum = 0;
  private survivalAccum = 0;
  private autosaveAccum = 0;
  private autosaveTick = 0;

  private notificationText: string | null = null;
  private notificationTimer = 0;
  private damageBanner: DamageNotification | null = null;
  private damageBannerTimer = 0;
  private damageBannerSeq = 0;
  private damageNotifications: DamageNotification[] = [];
  private markSeq = 0;
  private assistDecisions = new Map<string, FriendlyAssistanceResult>();
  private assistingAllies = new Set<string>();
  private playerDamageMarkMeshes: Array<{ section: RepairPriority; mesh: THREE.Group }> = [];
  private npcDamageMarks = new Map<string, Array<{ section: RepairPriority; mesh: THREE.Group }>>();
  private journalToastText: string | null = null;
  private journalToastTimer = 0;
  private victoryThemeTimer = 0;
  private fleetBattleTimer = 0;

  private tutorialQueue: TutorialToast[] = [];
  private activeTutorial: TutorialToast | null = null;
  private tutorialTimer = 0;
  private trauma = 0;
  private rogueWaveBoost = 0;
  private rogueWaveTimer = 45;
  private lightningTimer = 12;
  private hunterSpawnTimer = 80;
  private hunterSeq = 0;
  private hunterIds = new Set<string>();
  private bountyOfferTimer = 42;
  private bountySeq = 0;
  private collisionCooldowns = new Map<string, number>();
  private npcFireCooldowns = new Map<string, number>();
  private crownHailCooldown = 0;

  private playerCannonRecoil = 0;
  private playerImpactRoll = 0;
  private playerImpactPitch = 0;
  private playerSmokeAccum = 0;
  private playerSinkingTimer = 0;
  private playerSinkingCause = '';
  private muzzleFlashes: MuzzleFlash[] = [];
  private muzzleFlashGeo = new THREE.SphereGeometry(0.48, 6, 6);
  private muzzleFlashMat = new THREE.MeshBasicMaterial({ color: 0xffc75c });
  private shipExplosions: Array<{ mesh: THREE.Mesh; life: number; maxLife: number; maxScale: number }> = [];
  private shipExplosionGeo = new THREE.SphereGeometry(1.4, 10, 8);
  private shipExplosionMat = new THREE.MeshBasicMaterial({
    color: 0xff6b1a,
    transparent: true,
    opacity: 0.92,
  });

  // World entity registries
  private loadedChunks = new Set<string>();
  private wrecks = new Map<string, { data: ShipwreckData; mesh: THREE.Group; graceUntil?: number }>();
  private sunkenWreckByShipId = new Map<string, string>();
  private crates = new Map<string, { data: FloatingCrateData; mesh: THREE.Group }>();
  private rocks = new Map<string, { data: RockHazardData; mesh: THREE.Group }>();
  private islands = new Map<string, { data: IslandData; built: BuiltIsland }>();
  private icebergs = new Map<string, { data: IcebergData; mesh: THREE.Group }>();
  private iceChunks = new Map<string, { data: IceChunkData; mesh: THREE.Group }>();
  private iceSheets = new Map<string, { data: BreakableIceSheetData; built: BuiltBreakableIceSheet }>();
  private wildlife = new Map<string, { data: WildlifeActorData; built: BuiltWildlife }>();
  private islandPirateGuards = new Map<string, { data: IslandPirateGuardData; built: BuiltIslandPirateGuard }>();
  private fps = new FirstPersonIslandController();
  private crewFishingTimer = 0;
  private currentBiome: OceanBiomeId = 'temperate';
  private biomeDeepColor = new THREE.Color(0x052842);
  private biomeShallowColor = new THREE.Color(0x105b7a);
  private worldDamagePopups: Array<{
    id: string;
    worldX: number;
    worldY: number;
    worldZ: number;
    amount: number;
    partLabel: string;
    targetName: string;
    source: 'cannon' | 'ram' | 'hazard' | 'monster';
    direction: 'dealt' | 'taken' | 'ally';
    critical: boolean;
    life: number;
    maxLife: number;
  }> = [];
  private merchants = new Map<
    string,
    {
      data: MerchantShipData;
      mesh: THREE.Group;
      sails: THREE.Mesh[];
      flagMesh: THREE.Mesh | null;
      cannonGroups: THREE.Group[];
      damagePatches: THREE.Group[];
      crewActors?: DeckCrewActor[];
      halfLength: number;
      halfBeam: number;
      impactRoll: number;
      cannonRecoil: number;
    }
  >();
  private pirates = new Map<
    string,
    {
      data: PirateShipData;
      mesh: THREE.Group;
      sails: THREE.Mesh[];
      flagMesh: THREE.Mesh | null;
      ghostFog?: THREE.Group;
      fadeMaterials?: THREE.Material[];
      ghostStealthActive?: boolean;
      cannonGroups: THREE.Group[];
      damagePatches: THREE.Group[];
      crewActors?: DeckCrewActor[];
      halfLength: number;
      halfBeam: number;
      cannonRecoil: number;
      impactRoll: number;
      impactPitch: number;
      smokeAccum: number;
    }
  >();
  private monsters = new Map<
    string,
    {
      data: SeaMonsterData;
      built: BuiltSeaMonster;
      impactRoll: number;
    }
  >();
  private companionMeshes = new Map<string, BuiltSeaMonster>();
  private fleetShips = new Map<
    string,
    {
      data: FleetShipData;
      built: BuiltNpcShip;
      impactRoll: number;
      cannonRecoil: number;
      smokeAccum: number;
    }
  >();
  private ghostWhisperCooldown = 0;
  private nearbyGhostActive = false;
  private nearbyGhostFactor = 0;
  private wreckSmokeAccum = 0;
  private nearbyMajorBattleActive = false;
  private fleetAutonomyAccum = 0;
  private tornadoGroup: THREE.Group | null = null;
  private tornadoPos = { x: 0, z: 0, vx: 6, vz: 3, active: false };
  private lightningBolts: Array<{ mesh: THREE.Mesh; life: number }> = [];
  private hailImpactTimer = 0;
  private steeringHexTimer = 0;
  private fleetDistressAlerts: FleetDistressAlert[] = [];
  private lastSunkHostileMerchant: MerchantShipData | null = null;

  private lootedWreckIds = new Set<string>();
  private collectedCrateIds = new Set<string>();
  private defeatedPirateIds = new Set<string>();
  private defeatedMonsterIds = new Set<string>();
  private exploredCells = new Set<string>();

  // Combat & projectiles
  private combat: CombatState = {
    active: false,
    pirateId: null,
    monsterId: null,
    hostileMerchantId: null,
    command: 'attack',
    playerReload: 1,
    playerReloadTime: 3.5,
    retreating: false,
    combatLog: [],
  };
  private cannonballs: ActiveCannonball[] = [];
  private cannonballGeo = new THREE.SphereGeometry(0.28, 7, 7);
  private cannonballMat = new THREE.MeshStandardMaterial({ color: 0x1b1d20, roughness: 0.4, metalness: 0.8 });

  // Zero-GC Particle pool
  private readonly MAX_PARTICLES = 240;
  private particles: ActiveParticle[] = [];
  private particleCursor = 0;
  private particlePositions!: Float32Array;
  private particleColors!: Float32Array;
  private particleGeo!: THREE.BufferGeometry;
  private particleMesh!: THREE.Points;

  // Camera orbit & input state
  private keys = new Set<string>();
  private camYaw = 0.25;
  private camPitch = 0.34;
  private camDist = 24;
  private isDragging = false;
  private lastMouseX = 0;
  private lastMouseY = 0;
  private fpsMouseState: FpsMouseInputState = { lastX: -1, lastY: -1, skipEvents: 0 };
  private currentCamPos = new THREE.Vector3(12, 10, 22);
  private currentLookAt = new THREE.Vector3(0, 2, 0);
  private rand: () => number;

  private readonly _v1 = new THREE.Vector3();
  private readonly _v2 = new THREE.Vector3();
  private readonly _projVec = new THREE.Vector3();
  private disposed = false;

  constructor(container: HTMLElement, initialSave: SaveData, callbacks: EngineCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.saveData = initialSave;
    this.rand = mulberry32(initialSave.seed + 19);

    this.isSoftwareGl = (() => {
      try {
        const gl = document.createElement('canvas').getContext('webgl2');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(
      container.clientWidth || window.innerWidth,
      container.clientHeight || window.innerHeight
    );
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      56,
      (container.clientWidth || window.innerWidth) /
        Math.max(1, container.clientHeight || window.innerHeight),
      0.5,
      1400
    );

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    this.textures = createProceduralTextures(this.renderer);

    this.setupAtmosphere();
    this.setupOcean();
    this.setupParticles();
    this.scene.add(this.fps.viewRoot);
    this.hydrateFromSave(initialSave);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.bindEvents();
    this.lastTimestamp = performance.now();
    this.update(0.016);
    this.renderer.render(this.scene, this.camera);
    this.startLoop();
  }

  private setupAtmosphere(): void {
    this.fog = new THREE.FogExp2(0x88aec4, 0.0012);
    this.scene.fog = this.fog;

    this.skyUniforms = {
      uZenithColor: { value: new THREE.Color(0x1f558c) },
      uHorizonColor: { value: new THREE.Color(0x9bc4d8) },
      uSunDir: { value: new THREE.Vector3(0.5, 0.45, -0.7).normalize() },
      uSunColor: { value: new THREE.Color(0xfff1d0) },
      uSunVisibility: { value: 1.0 },
      uMoonVisibility: { value: 0.0 },
    };

    const skyGeo = new THREE.SphereGeometry(950, 24, 16);
    const skyMat = new THREE.ShaderMaterial({
      uniforms: this.skyUniforms,
      vertexShader: SKY_VERTEX_SHADER,
      fragmentShader: SKY_FRAGMENT_SHADER,
      side: THREE.BackSide,
      depthWrite: false,
    });
    this.skyMesh = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(this.skyMesh);

    const starCount = 420;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(0.15 + Math.random() * 0.85);
      const r = 820;
      starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPos[i * 3 + 1] = r * Math.cos(phi);
      starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xe6eefc,
      size: 2.2,
      transparent: true,
      opacity: 0,
      fog: false,
      depthWrite: false,
    });
    this.starsPoints = new THREE.Points(starGeo, starMat);
    this.scene.add(this.starsPoints);

    this.cloudsGroup = new THREE.Group();
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xf4f7fa,
      roughness: 0.98,
      metalness: 0,
      transparent: true,
      opacity: 0.62,
      fog: true,
    });
    const puffGeo = new THREE.DodecahedronGeometry(1, 1);
    for (let i = 0; i < 28; i++) {
      const cluster = new THREE.Group();
      const angle = (i / 28) * Math.PI * 2 + Math.random() * 0.25;
      const dist = 240 + Math.random() * 520;
      cluster.position.set(Math.cos(angle) * dist, 95 + Math.random() * 65, Math.sin(angle) * dist);
      const puffs = 3 + (i % 3);
      for (let p = 0; p < puffs; p++) {
        const m = new THREE.Mesh(puffGeo, cloudMat);
        m.scale.set(22 + Math.random() * 18, 5.0 + Math.random() * 4.5, 14 + Math.random() * 10);
        m.position.set((p - 1.5) * 18, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 10);
        cluster.add(m);
      }
      this.cloudsGroup.add(cluster);
    }
    this.scene.add(this.cloudsGroup);

    const rainCount = 520;
    const rainPos = new Float32Array(rainCount * 3);
    for (let i = 0; i < rainCount; i++) {
      rainPos[i * 3] = (Math.random() - 0.5) * 90;
      rainPos[i * 3 + 1] = Math.random() * 45;
      rainPos[i * 3 + 2] = (Math.random() - 0.5) * 90;
    }
    const rainGeo = new THREE.BufferGeometry();
    rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
    const rainMat = new THREE.PointsMaterial({
      color: 0xbdd1e0,
      size: 0.35,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    this.rainPoints = new THREE.Points(rainGeo, rainMat);
    this.scene.add(this.rainPoints);

    this.sunLight = new THREE.DirectionalLight(0xfff0d4, 2.3);
    this.sunLight.position.set(80, 95, -90);
    if (!this.isSoftwareGl) {
      this.sunLight.castShadow = true;
      this.sunLight.shadow.mapSize.set(1024, 1024);
      this.sunLight.shadow.camera.left = -45;
      this.sunLight.shadow.camera.right = 45;
      this.sunLight.shadow.camera.top = 45;
      this.sunLight.shadow.camera.bottom = -45;
      this.sunLight.shadow.camera.near = 10;
      this.sunLight.shadow.camera.far = 260;
      this.sunLight.shadow.bias = -0.0005;
      this.sunLight.shadow.normalBias = 0.02;
    }
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    this.hemiLight = new THREE.HemisphereLight(0x98c4e4, 0x163347, 0.95);
    this.scene.add(this.hemiLight);
  }

  private setupOcean(): void {
    const segs = this.isSoftwareGl ? 68 : 108;
    const geo = new THREE.PlaneGeometry(1100, 1100, segs, segs);
    geo.rotateX(-Math.PI / 2);

    this.oceanUniforms = {
      uTime: { value: 0 },
      uWaveIntensity: { value: 0.8 },
      uRogueBoost: { value: 0 },
      uOffset: { value: new THREE.Vector2(0, 0) },
      uDeepColor: { value: new THREE.Color(0x09243b) },
      uShallowColor: { value: new THREE.Color(0x14536e) },
      uSkyColor: { value: new THREE.Color(0x8bbad4) },
      uHorizonColor: { value: new THREE.Color(0x9bc4d8) },
      uSunDir: { value: new THREE.Vector3(0.5, 0.45, -0.7).normalize() },
      uSunColor: { value: new THREE.Color(0xfff1d0) },
      uFogDensity: { value: 0.0012 },
      uBoatPos: { value: new THREE.Vector3(0, 0, 0) },
      uBoatFwd: { value: new THREE.Vector2(0, -1) },
      uBoatSpeed: { value: 0 },
      uIslandCenters: {
        value: [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()],
      },
      uIslandMeta: {
        value: [new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4()],
      },
    };

    const mat = new THREE.ShaderMaterial({
      uniforms: this.oceanUniforms,
      vertexShader: OCEAN_VERTEX_SHADER,
      fragmentShader: OCEAN_FRAGMENT_SHADER,
    });

    this.oceanMesh = new THREE.Mesh(geo, mat);
    this.oceanMesh.frustumCulled = false;
    this.scene.add(this.oceanMesh);
  }

  private setupParticles(): void {
    this.particlePositions = new Float32Array(this.MAX_PARTICLES * 3);
    this.particleColors = new Float32Array(this.MAX_PARTICLES * 3);
    for (let i = 0; i < this.MAX_PARTICLES; i++) {
      this.particles.push({
        alive: false,
        life: 0,
        maxLife: 1,
        x: 0,
        y: -999,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        r: 1,
        g: 1,
        b: 1,
      });
      this.particlePositions[i * 3 + 1] = -999;
    }

    this.particleGeo = new THREE.BufferGeometry();
    this.particleGeo.setAttribute('position', new THREE.BufferAttribute(this.particlePositions, 3));
    this.particleGeo.setAttribute('color', new THREE.BufferAttribute(this.particleColors, 3));

    const pMat = new THREE.PointsMaterial({
      size: 1.55,
      map: this.textures.sprayTexture,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    this.particleMesh = new THREE.Points(this.particleGeo, pMat);
    this.particleMesh.frustumCulled = false;
    this.scene.add(this.particleMesh);
  }

  private spawnParticle(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    maxLife: number,
    r: number,
    g: number,
    b: number
  ): void {
    const p = this.particles[this.particleCursor];
    this.particleCursor = (this.particleCursor + 1) % this.MAX_PARTICLES;
    p.alive = true;
    p.life = 0;
    p.maxLife = maxLife;
    p.x = x;
    p.y = y;
    p.z = z;
    p.vx = vx;
    p.vy = vy;
    p.vz = vz;
    p.r = r;
    p.g = g;
    p.b = b;
  }

  public hydrateFromSave(save: SaveData): void {
    for (const w of this.wrecks.values()) this.scene.remove(w.mesh);
    for (const c of this.crates.values()) this.scene.remove(c.mesh);
    for (const r of this.rocks.values()) this.scene.remove(r.mesh);
    for (const m of this.merchants.values()) {
      this.scene.remove(m.mesh);
    }
    for (const p of this.pirates.values()) {
      this.scene.remove(p.mesh);
    }
    for (const mon of this.monsters.values()) this.scene.remove(mon.built.root);
    for (const cm of this.companionMeshes.values()) this.scene.remove(cm.root);
    for (const fs of this.fleetShips.values()) {
      this.scene.remove(fs.built.root);
      fs.built.flagTexture?.dispose();
      fs.built.sailTexture?.dispose();
    }
    for (const cb of this.cannonballs) this.scene.remove(cb.mesh);
    for (const mf of this.muzzleFlashes) this.scene.remove(mf.mesh);
    for (const lb of this.lightningBolts) this.scene.remove(lb.mesh);
    if (this.tornadoGroup) {
      this.scene.remove(this.tornadoGroup);
      this.tornadoGroup = null;
    }

    for (const isl of this.islands.values()) this.scene.remove(isl.built.root);
    for (const ib of this.icebergs.values()) this.scene.remove(ib.mesh);
    for (const ic of this.iceChunks.values()) this.scene.remove(ic.mesh);
    for (const sh of this.iceSheets.values()) this.scene.remove(sh.built.root);
    for (const wa of this.wildlife.values()) this.scene.remove(wa.built.root);
    for (const pg of this.islandPirateGuards.values()) this.scene.remove(pg.built.root);

    this.fps.exitIsland();
    this.islands.clear();
    this.icebergs.clear();
    this.iceChunks.clear();
    this.iceSheets.clear();
    this.wildlife.clear();
    this.islandPirateGuards.clear();
    this.worldDamagePopups = [];
    this.crewFishingTimer = 0;

    this.wrecks.clear();
    this.sunkenWreckByShipId.clear();
    this.crates.clear();
    this.rocks.clear();
    this.merchants.clear();
    this.pirates.clear();
    this.monsters.clear();
    this.companionMeshes.clear();
    this.fleetShips.clear();
    this.npcDamageMarks.clear();
    this.playerDamageMarkMeshes = [];
    this.assistDecisions.clear();
    this.assistingAllies.clear();
    this.damageNotifications = [];
    this.cannonballs = [];
    this.muzzleFlashes = [];
    this.lightningBolts = [];
    this.loadedChunks.clear();
    this.hunterIds.clear();
    this.collisionCooldowns.clear();
    this.npcFireCooldowns.clear();
    this.tutorialQueue = [];
    this.activeTutorial = null;
    this.tutorialTimer = 0;
    this.damageBanner = null;
    this.damageBannerTimer = 0;
    this.journalToastText = null;
    this.journalToastTimer = 0;
    this.victoryThemeTimer = 0;
    this.fleetBattleTimer = 0;
    this.crownHailCooldown = 0;
    this.ghostWhisperCooldown = 0;
    this.nearbyGhostActive = false;
    this.nearbyGhostFactor = 0;
    this.wreckSmokeAccum = 0;
    for (const exp of this.shipExplosions) this.scene.remove(exp.mesh);
    this.shipExplosions = [];
    this.nearbyMajorBattleActive = false;
    this.fleetAutonomyAccum = 0;
    this.steeringHexTimer = 0;
    this.hailImpactTimer = 0;
    this.fleetDistressAlerts = [];
    this.lastSunkHostileMerchant = null;
    this.hunterSpawnTimer = 80;
    this.bountyOfferTimer = 42;
    this.playerCannonRecoil = 0;
    this.playerImpactRoll = 0;
    this.playerImpactPitch = 0;
    this.playerSmokeAccum = 0;
    this.playerSinkingTimer = 0;
    this.playerSinkingCause = '';

    this.saveData = JSON.parse(JSON.stringify(save));
    if (this.saveData.player.crew.length > 0) this.lastKnownCrew = JSON.parse(JSON.stringify(this.saveData.player.crew));
    if (!Array.isArray(this.saveData.player.damageMarks)) this.saveData.player.damageMarks = [];
    if (!Array.isArray(this.saveData.seenTutorials)) this.saveData.seenTutorials = [];
    if (!Array.isArray(this.saveData.dismissedWarnings)) this.saveData.dismissedWarnings = [];
    if (!Array.isArray(this.saveData.defeatedMonsterIds)) this.saveData.defeatedMonsterIds = [];
    if (!Array.isArray(this.saveData.tamedMonsters)) this.saveData.tamedMonsters = [];
    if (!Array.isArray(this.saveData.fleet)) this.saveData.fleet = [];
    if (!Array.isArray(this.saveData.ghostCollectibles)) this.saveData.ghostCollectibles = [];
    if (!this.saveData.searchedWreckSections) this.saveData.searchedWreckSections = {};
    if (typeof this.saveData.treasureFragments !== 'number') this.saveData.treasureFragments = 0;
    if (!Array.isArray(this.saveData.treasureMaps)) this.saveData.treasureMaps = [];
    if (!Array.isArray(this.saveData.discoveredIslandIds)) this.saveData.discoveredIslandIds = [];
    if (!Array.isArray(this.saveData.collectedDiscoveryIds)) this.saveData.collectedDiscoveryIds = [];
    if (!Array.isArray(this.saveData.completedErrandIds)) this.saveData.completedErrandIds = [];
    if (!this.saveData.player.upgrades.fishingGear) this.saveData.player.upgrades.fishingGear = 'none';
    if (typeof this.saveData.player.inventory.fishCatch !== 'number') this.saveData.player.inventory.fishCatch = 0;
    if (typeof this.saveData.player.inventory.rareFish !== 'number') this.saveData.player.inventory.rareFish = 0;
    if (typeof this.saveData.player.inventory.animalHides !== 'number') this.saveData.player.inventory.animalHides = 0;
    if (typeof this.saveData.player.inventory.leadShot !== 'number') this.saveData.player.inventory.leadShot = 24;
    if (typeof this.saveData.player.inventory.salt !== 'number') this.saveData.player.inventory.salt = 12;
    if (this.saveData.bounty === undefined || this.saveData.bounty?.status === 'active') {
      this.saveData.bounty = null;
    }
    if (!Array.isArray(this.saveData.weatherForecast) || this.saveData.weatherForecast.length === 0) {
      this.saveData.weatherForecast = generateWeatherForecast(
        this.saveData.weather.type,
        this.saveData.weather.timeUntilChange,
        mulberry32(this.saveData.seed + 91),
        3
      );
    }
    this.tornadoPos = {
      x: this.saveData.player.x + 120,
      z: this.saveData.player.z - 110,
      vx: 6,
      vz: 3.5,
      active: this.saveData.weather.type === 'tornado',
    };

    this.lootedWreckIds = new Set(this.saveData.lootedWreckIds);
    this.collectedCrateIds = new Set(this.saveData.collectedCrateIds);
    this.defeatedPirateIds = new Set(this.saveData.defeatedPirateIds);
    this.defeatedMonsterIds = new Set(this.saveData.defeatedMonsterIds);
    this.exploredCells = new Set(this.saveData.exploredCells);
    this.rand = mulberry32(this.saveData.seed + 31);

    this.combat = {
      active: false,
      pirateId: null,
      monsterId: null,
      hostileMerchantId: null,
      enemies: [],
      primaryTargetId: null,
      command: 'attack',
      playerReload: 1,
      playerReloadTime: 3.5,
      retreating: false,
      combatLog: [],
    };

    this.rebuildPlayerShipMesh();
    this.syncTamedCompanions();
    this.syncFleetMeshes(true);
    this.streamWorldAroundPlayer();
    this.sound.setAudioSettings(this.saveData.settings);

    this.camYaw = 0.45;
    this.camPitch = 0.28;
    this.camDist = 23;
    this.emitHud();
  }

  public setMultiplayerWorldAuthority(isAuthority: boolean): void {
    this.isMultiplayerWorldAuthority = Boolean(isAuthority);
  }

  public getMultiplayerWeatherState(): { weather: WeatherState; tornadoPos: { x: number; z: number; vx: number; vz: number; active: boolean } } {
    return { weather: { ...this.saveData.weather }, tornadoPos: { ...this.tornadoPos } };
  }

  public applyMultiplayerWeatherState(snapshot: { weather: WeatherState; tornadoPos?: { x: number; z: number; vx: number; vz: number; active: boolean } | null }): void {
    if (!snapshot?.weather || !ALL_WEATHER_TYPES.includes(snapshot.weather.type)) return;
    this.saveData.weather = { ...this.saveData.weather, ...snapshot.weather };
    if (snapshot.tornadoPos && Number.isFinite(snapshot.tornadoPos.x) && Number.isFinite(snapshot.tornadoPos.z)) {
      this.tornadoPos = { ...snapshot.tornadoPos };
    }
  }

  // ===========================================================================
  // One shared world: bot ships / sea monsters are simulated by one owner (the nearest player)
  // and rendered by everyone else; persistent changes travel as patches stored on the server.
  // ===========================================================================

  public setNetBridge(net: NetBridge | null): void {
    this.net = net;
  }

  public setMyPlayerId(id: string): void {
    this.myPlayerId = id;
  }

  /** Nearest distance from a point to the local player or any connected remote player. */
  private distToNearestPlayer(x: number, z: number): number {
    let best = Math.hypot(x - this.saveData.player.x, z - this.saveData.player.z);
    for (const remote of this.remotePlayers.values()) {
      best = Math.min(best, Math.hypot(x - remote.targetX, z - remote.targetZ));
    }
    return best;
  }

  /** The owner's latest state for an NPC if another player currently simulates it. */
  private getRemoteNpc(id: string): { ownerId: string; x: number; z: number; heading: number; speed: number; behavior?: string; hullPct?: number; ts: number } | null {
    const r = this.npcRemote.get(id);
    if (!r) return null;
    if (r.ownerId === this.myPlayerId) return null;
    if (performance.now() - r.ts > 5000) return null;
    return r;
  }

  public applyNpcStates(list: NpcWireState[]): void {
    const now = performance.now();
    for (const s of list) {
      if (!s?.id || !s.ownerId || s.ownerId === this.myPlayerId) continue;
      if (!Number.isFinite(s.x) || !Number.isFinite(s.z)) continue;
      this.npcRemote.set(s.id, {
        ownerId: s.ownerId,
        x: s.x,
        z: s.z,
        heading: s.heading,
        speed: s.speed,
        behavior: s.behavior,
        hullPct: s.hullPct,
        ts: now,
      });
    }
  }

  /** Smoothly move a locally-loaded NPC to where its owner says it is. */
  private driveRemoteNpc(
    data: { x: number; z: number; heading: number; speed: number },
    remote: { x: number; z: number; heading: number; speed: number },
    dt: number
  ): void {
    if (Math.hypot(remote.x - data.x, remote.z - data.z) > 60) {
      data.x = remote.x;
      data.z = remote.z;
      data.heading = remote.heading;
    } else {
      const blend = 1 - Math.exp(-Math.max(0.001, dt) * 8);
      data.x += (remote.x - data.x) * blend;
      data.z += (remote.z - data.z) * blend;
      data.heading = normalizeAngle(data.heading + normalizeAngle(remote.heading - data.heading) * blend);
    }
    data.speed = remote.speed;
  }

  /** NPCs this client simulates (and therefore reports) = those near this player that nobody else owns. */
  public getOwnedNpcStates(): NpcWireState[] {
    const px = this.saveData.player.x;
    const pz = this.saveData.player.z;
    const out: NpcWireState[] = [];
    const consider = (kind: NpcWireState['kind'], id: string, d: { x: number; z: number; heading: number; speed: number }, hullPct?: number, behavior?: string) => {
      if (Math.hypot(d.x - px, d.z - pz) > 900) return;
      if (this.getRemoteNpc(id)) return;
      out.push({ id, kind, x: d.x, z: d.z, heading: d.heading, speed: d.speed, hullPct, behavior });
    };
    for (const e of this.merchants.values()) {
      if (e.data.sunk) continue;
      consider('merchant', e.data.id, e.data, e.data.maxHull > 0 ? (e.data.hull / e.data.maxHull) * 100 : 100);
    }
    for (const e of this.pirates.values()) {
      if (e.data.defeated || e.data.playerId) continue;
      consider('pirate', e.data.id, e.data, e.data.maxHull > 0 ? (e.data.hull / e.data.maxHull) * 100 : 100, e.data.behavior);
    }
    for (const e of this.monsters.values()) {
      if (e.data.defeated) continue;
      consider('monster', e.data.id, e.data);
    }
    return out.slice(0, 100);
  }

  // --- Persistent shared patches --------------------------------------------------------------

  private sharedKey(kind: string, id: string): string {
    return `${kind}:${id}`;
  }

  /** Apply the server's full set of patches on join and make the local world match the shared one. */
  public applyInitialWorldPatches(patches: WorldPatch[]): void {
    // The shared world is the single source of truth: forget purely local progress for shared things.
    this.lootedWreckIds = new Set();
    this.collectedCrateIds = new Set();
    this.defeatedPirateIds = new Set();
    this.defeatedMonsterIds = new Set();
    this.sharedPublishedIds = { wreck: new Set(), crate: new Set(), pirate: new Set(), monster: new Set(), discovery: new Set() };
    this.sharedStore.clear();
    this.sharedTracked.clear();
    this.applyWorldPatches(patches);
    this.sharedReady = true;
    // Reload the surrounding chunks so they are generated from the shared state.
    this.hydrateFromSave(JSON.parse(JSON.stringify(this.getSaveSnapshot())) as SaveData);
  }

  public applyWorldPatches(patches: WorldPatch[]): void {
    for (const patch of patches) {
      if (!patch?.kind || !patch?.id || !patch.data) continue;
      const key = this.sharedKey(patch.kind, patch.id);
      this.sharedStore.set(key, { ...(this.sharedStore.get(key) ?? {}), ...patch.data });
      const data = patch.data as Record<string, any>;
      switch (patch.kind) {
        case 'wreck': {
          if (data.looted) {
            this.lootedWreckIds.add(patch.id);
            this.sharedPublishedIds.wreck.add(patch.id);
          }
          const live = this.wrecks.get(patch.id);
          if (live) this.applyWreckPatch(live.data, data);
          if (Array.isArray(data.sections)) {
            this.saveData.searchedWreckSections[patch.id] = Array.from(new Set([...(this.saveData.searchedWreckSections[patch.id] ?? []), ...data.sections]));
          }
          break;
        }
        case 'crate': {
          this.collectedCrateIds.add(patch.id);
          this.sharedPublishedIds.crate.add(patch.id);
          const live = this.crates.get(patch.id);
          if (live) { this.scene.remove(live.mesh); this.crates.delete(patch.id); }
          break;
        }
        case 'pirate': {
          if (data.defeated) {
            this.defeatedPirateIds.add(patch.id);
            this.sharedPublishedIds.pirate.add(patch.id);
            this.removePirateLocally(patch.id);
          } else {
            const live = this.pirates.get(patch.id);
            if (live) this.applyPiratePatch(live.data, data);
          }
          break;
        }
        case 'monster': {
          if (data.defeated) this.defeatedMonsterIds.add(patch.id);
          const live = this.monsters.get(patch.id);
          if (live) this.applyMonsterPatch(live.data, data);
          break;
        }
        case 'discovery': {
          if (!this.saveData.collectedDiscoveryIds) this.saveData.collectedDiscoveryIds = [];
          if (!this.saveData.collectedDiscoveryIds.includes(patch.id)) this.saveData.collectedDiscoveryIds.push(patch.id);
          this.sharedPublishedIds.discovery.add(patch.id);
          for (const isl of this.islands.values()) {
            for (const d of isl.data.discoveries) if (d.id === patch.id) d.collected = true;
            for (const b of isl.data.beachedWrecks) if (b.id === patch.id) b.searched = true;
          }
          break;
        }
        case 'merchant': {
          const live = this.merchants.get(patch.id);
          if (live) this.applyMerchantPatch(live.data, data);
          break;
        }
        case 'settlement': {
          const st = this.getSettlementById(patch.id);
          if (st) this.applySettlementPatch(st, data);
          break;
        }
        case 'guard': {
          const live = this.islandPirateGuards.get(patch.id);
          if (live) this.applyGuardPatch(live, data);
          break;
        }
        case 'wildlife': {
          const live = this.wildlife.get(patch.id);
          if (live) this.applyWildlifePatch(live, data);
          break;
        }
        default:
          break;
      }
      // Entities that are loaded now already match; refresh their fingerprint so we don't echo it back.
      const tracked = this.sharedTracked.get(key);
      if (tracked) tracked.fp = JSON.stringify(tracked.get());
    }
  }

  private applyWreckPatch(w: ShipwreckData, d: Record<string, any>): void {
    if (d.looted !== undefined) w.fullyLooted = Boolean(d.looted) || w.fullyLooted;
  }

  private applyPiratePatch(p: PirateShipData, d: Record<string, any>): void {
    if (d.hull !== undefined) p.hull = Math.min(p.hull, Number(d.hull));
    if (d.crewCount !== undefined) p.crewCount = Math.min(p.crewCount, Number(d.crewCount));
    if (d.cannons !== undefined) p.cannons = Math.min(p.cannons, Number(d.cannons));
  }

  private applyMonsterPatch(m: SeaMonsterData, d: Record<string, any>): void {
    if (d.hp !== undefined) m.hp = Math.min(m.hp, Number(d.hp));
    if (d.defeated && !m.defeated) {
      m.defeated = true;
      m.hp = 0;
      if (d.carcassRemainingFood !== undefined) m.carcassRemainingFood = Number(d.carcassRemainingFood);
      if (d.carcassRemainingSalt !== undefined) m.carcassRemainingSalt = Number(d.carcassRemainingSalt);
      if ((m.carcassTimer ?? 0) <= 0) m.carcassTimer = 240;
      this.combat.enemies = this.getCombatEnemies().filter((e) => e.id !== m.id);
      this.syncCombatPrimaryFields();
    }
    if (d.carcassHarvested) {
      m.carcassHarvested = true;
      m.carcassRemainingFood = 0;
      m.carcassRemainingSalt = 0;
    }
  }

  private applyMerchantPatch(m: MerchantShipData, d: Record<string, any>): void {
    if (d.gold !== undefined) m.gold = Number(d.gold);
    if (d.stock && typeof d.stock === 'object') m.stock = { ...m.stock, ...d.stock };
    if (d.hull !== undefined) m.hull = Math.min(m.hull, Number(d.hull));
    if (d.crewCount !== undefined) m.crewCount = Number(d.crewCount);
    if (d.cannons !== undefined) m.cannons = Number(d.cannons);
    if (d.robbed !== undefined) m.robbed = m.robbed || Boolean(d.robbed);
    if (d.hostileToPlayer !== undefined) m.hostileToPlayer = Boolean(d.hostileToPlayer);
    if (d.surrenderedToPlayer !== undefined) m.surrenderedToPlayer = Boolean(d.surrenderedToPlayer);
    if (d.recruited !== undefined) m.recruited = m.recruited || Boolean(d.recruited);
    if (Array.isArray(d.hireableCrewIds)) m.hireableCrew = m.hireableCrew.filter((c) => d.hireableCrewIds.includes(c.id));
    if (d.sunk && !m.sunk) {
      m.sunk = true;
      m.hull = 0;
      m.sinkProgress = m.sinkProgress ?? 0;
      this.combat.enemies = this.getCombatEnemies().filter((e) => e.id !== m.id);
      this.syncCombatPrimaryFields();
    }
  }

  private applySettlementPatch(st: IslandSettlementData, d: Record<string, any>): void {
    if (d.gold !== undefined) st.gold = Number(d.gold);
    if (d.stock && typeof d.stock === 'object') st.stock = { ...st.stock, ...d.stock };
  }

  private applyGuardPatch(entry: { data: IslandPirateGuardData; built: BuiltIslandPirateGuard }, d: Record<string, any>): void {
    const g = entry.data;
    if (d.hp !== undefined) g.hp = Math.min(g.hp, Number(d.hp));
    if (d.dead) g.dead = true;
    if (d.looted) {
      g.looted = true;
      entry.built.root.visible = false;
    }
  }

  private applyWildlifePatch(entry: { data: WildlifeActorData; built: BuiltWildlife }, d: Record<string, any>): void {
    if (d.harvested) {
      entry.data.harvested = true;
      entry.data.dead = true;
      entry.built.root.visible = false;
    }
    if (d.dead) entry.data.dead = true;
  }

  /** Remove a pirate that another player defeated (or that is otherwise gone from the shared world). */
  private removePirateLocally(id: string): void {
    const entry = this.pirates.get(id);
    if (!entry) return;
    this.spawnShipExplosion(entry.data.x, entry.data.z, 1.2);
    this.scene.remove(entry.mesh);
    this.pirates.delete(id);
    this.hunterIds.delete(id);
    this.npcDamageMarks.delete(id);
    this.assistDecisions.delete(id);
    this.assistingAllies.delete(id);
    if (this.isEnemyInCombat(id)) {
      this.combat.enemies = this.getCombatEnemies().filter((e) => e.id !== id);
      this.syncCombatPrimaryFields();
      this.pushNotification('Another captain sank your target!');
    }
  }

  /**
   * Called a couple of times per second: publishes every change the local player made to the shared
   * world (bot ship gold/stock, defeated pirates, looted wrecks, settlement stock, ...) and applies stored
   * state to entities the first time they are seen.
   */
  private syncSharedWorld(dt: number): void {
    if (!this.net || !this.sharedReady) return;
    this.sharedAccum += dt;
    if (this.sharedAccum < 0.5) return;
    this.sharedAccum = 0;
    const seen = new Set<string>();

    const track = <T extends object>(
      kind: string,
      id: string,
      entity: T,
      get: () => Record<string, unknown>,
      apply: (data: Record<string, any>) => void
    ) => {
      const key = this.sharedKey(kind, id);
      seen.add(key);
      const tracked = this.sharedTracked.get(key);
      if (!tracked || tracked.obj !== entity) {
        const stored = this.sharedStore.get(key);
        if (stored) apply(stored);
        this.sharedTracked.set(key, { obj: entity, get, fp: JSON.stringify(get()) });
        return;
      }
      tracked.get = get;
      const data = get();
      const fp = JSON.stringify(data);
      if (fp !== tracked.fp) {
        tracked.fp = fp;
        this.sharedStore.set(key, { ...(this.sharedStore.get(key) ?? {}), ...data });
        this.net!.sendPatch(kind, id, data);
      }
    };

    for (const e of this.merchants.values()) {
      const m = e.data;
      track('merchant', m.id, m, () => ({
        gold: m.gold, stock: m.stock, hull: Math.round(m.hull), crewCount: m.crewCount, cannons: m.cannons,
        robbed: m.robbed, hostileToPlayer: m.hostileToPlayer, surrenderedToPlayer: m.surrenderedToPlayer,
        recruited: Boolean(m.recruited), sunk: m.sunk, hireableCrewIds: m.hireableCrew.map((c) => c.id),
      }), (d) => this.applyMerchantPatch(m, d));
    }
    for (const e of this.pirates.values()) {
      const p = e.data;
      if (p.playerId || p.defeated || p.id.startsWith('hunter_') || p.isBountyTarget) continue;
      track('pirate', p.id, p, () => ({ hull: Math.round(p.hull), crewCount: p.crewCount, cannons: p.cannons }), (d) => this.applyPiratePatch(p, d));
    }
    for (const e of this.monsters.values()) {
      const m = e.data;
      track('monster', m.id, m, () => ({
        hp: Math.round(m.hp), defeated: m.defeated, carcassHarvested: Boolean(m.carcassHarvested),
        carcassRemainingFood: m.carcassRemainingFood ?? 0, carcassRemainingSalt: m.carcassRemainingSalt ?? 0,
      }), (d) => this.applyMonsterPatch(m, d));
    }
    for (const e of this.wildlife.values()) {
      const w = e.data;
      if (w.domain !== 'ocean' && !w.islandId) continue;
      track('wildlife', w.id, w, () => ({ dead: w.dead, harvested: Boolean(w.harvested) }), (d) => this.applyWildlifePatch(e, d));
    }
    for (const e of this.islandPirateGuards.values()) {
      const g = e.data;
      track('guard', g.id, g, () => ({ hp: Math.round(g.hp), dead: g.dead, looted: g.looted }), (d) => this.applyGuardPatch(e, d));
    }
    for (const isl of this.islands.values()) {
      const st = isl.data.settlement;
      if (!st) continue;
      track('settlement', st.id, st, () => ({ gold: st.gold, stock: st.stock }), (d) => this.applySettlementPatch(st, d));
    }
    for (const e of this.wrecks.values()) {
      const w = e.data;
      if (w.id.startsWith('sunk_wreck_') || w.id.startsWith('ghost_wreck_')) continue;
      track('wreck', w.id, w, () => ({ looted: w.fullyLooted, sections: this.saveData.searchedWreckSections[w.id] ?? [] }), (d) => this.applyWreckPatch(w, d));
    }

    // One-way id sets: once looted/defeated/collected, it is that way for everyone.
    const publishNewIds = (kind: 'wreck' | 'crate' | 'pirate' | 'monster' | 'discovery', ids: Iterable<string>, data: Record<string, unknown>) => {
      const published = this.sharedPublishedIds[kind];
      for (const id of ids) {
        if (published.has(id)) continue;
        published.add(id);
        const patchKind = kind === 'wreck' ? 'wreck' : kind;
        this.sharedStore.set(this.sharedKey(patchKind, id), data);
        this.net!.sendPatch(patchKind, id, data);
      }
    };
    publishNewIds('wreck', this.lootedWreckIds, { looted: true });
    publishNewIds('crate', this.collectedCrateIds, { collected: true });
    publishNewIds('pirate', Array.from(this.defeatedPirateIds).filter((id) => !id.startsWith('pvp_')), { defeated: true });
    publishNewIds('discovery', this.saveData.collectedDiscoveryIds ?? [], { collected: true });
    // (defeated monsters are shared through the 'monster' state tracker above)

    for (const key of Array.from(this.sharedTracked.keys())) {
      if (!seen.has(key)) this.sharedTracked.delete(key);
    }
  }

  public setMultiplayerWorldSeed(seed: number): void {
    if (!Number.isFinite(seed)) return;
    const normalized = Math.max(1, Math.floor(seed));
    this.multiplayerWorldSeed = normalized;
    if (this.saveData.seed === normalized) return;
    const snapshot = JSON.parse(JSON.stringify(this.getSaveSnapshot())) as SaveData;
    snapshot.seed = normalized;
    this.hydrateFromSave(snapshot);
    this.callbacks.onSaveUpdate(this.getSaveSnapshot());
    saveVoyageToStorage(this.getSaveSnapshot());
  }

  public applyMultiplayerSpawn(spawn: { x: number; z: number; heading?: number }): void {
    const p = this.saveData.player;
    p.x = Number.isFinite(spawn.x) ? spawn.x : 0;
    p.z = Number.isFinite(spawn.z) ? spawn.z : 0;
    p.heading = Number.isFinite(spawn.heading) ? spawn.heading! : 0;
    p.speed = 0;
    p.throttle = 0;
    p.rudder = 0;
    p.isStopping = true;
    this.playerSinkingTimer = 0;
    this.playerSinkingCause = '';
    if (this.fps.active) this.fps.exitIsland();
    this.rebuildPlayerShipMesh();
    this.streamWorldAroundPlayer();
    this.updateCamera(0.2);
    this.callbacks.onSaveUpdate(this.getSaveSnapshot());
    saveVoyageToStorage(this.getSaveSnapshot());
  }

  public getMultiplayerShipState(): Omit<RemotePlayerState, 'id' | 'name'> {
    const p = this.saveData.player;
    const combatStats = computeAutoCombatStats(p.upgrades, p.crew, this.combat.command);
    return {
      shipName: p.shipName,
      reputation: this.saveData.reputation,
      hullPct: Math.round(clamp(p.condition.hull, 0, 100)),
      cannons: Math.max(1, Math.round(combatStats.effectiveCannons || 4)),
      x: p.x,
      z: p.z,
      heading: p.heading,
      speed: this.fps.active ? 0 : p.speed,
      landed: this.fps.active,
      hullTier: p.upgrades.hullTier,
    };
  }

  // --- Other players: name tags, collisions, trade and PvP ---------------------------------------

  private reputationStyle(reputation: number): { label: string; color: string } {
    const rep = Math.round(reputation);
    const color = rep >= 25 ? '#8fe3a8' : rep <= -25 ? '#ff8b7a' : '#ecd9a6';
    return { label: `${getReputationTitle(rep)} (${rep > 0 ? '+' : ''}${rep})`, color };
  }

  private createRemotePlayerNameTag(shipName: string, reputation: number): { sprite: THREE.Sprite; texture: THREE.CanvasTexture } {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 150;
    const ctx = canvas.getContext('2d');
    const style = this.reputationStyle(reputation);
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'rgba(5, 15, 24, 0.88)';
      ctx.strokeStyle = 'rgba(229, 190, 115, 0.95)';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.roundRect(8, 8, 496, 134, 18);
      ctx.fill();
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff5df';
      ctx.font = 'bold 46px Arial';
      ctx.fillText(shipName, 256, 54, 470);
      ctx.fillStyle = style.color;
      ctx.font = 'bold 30px Arial';
      ctx.fillText(`Reputation: ${style.label}`, 256, 108, 480);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(25, 7.3, 1);
    return { sprite, texture };
  }

  private disposeRemoteView(view: RemotePlayerShipView): void {
    this.scene.remove(view.built.root);
    view.built.flagTexture.dispose();
    view.built.sailTexture?.dispose();
    view.nameTexture.dispose();
    (view.nameTag.material as THREE.SpriteMaterial).dispose();
  }

  public syncRemotePlayers(players: RemotePlayerState[]): void {
    const activeIds = new Set(players.map((player) => player.id));
    for (const [id, remote] of this.remotePlayers) {
      if (!activeIds.has(id)) {
        this.disposeRemoteView(remote);
        this.remotePlayers.delete(id);
        this.remoteChunkStreams.delete(id);
        this.removePvpStandIn(id);
      }
    }

    for (const player of players) {
      if (!player?.id || !Number.isFinite(player.x) || !Number.isFinite(player.z)) continue;
      const safeShipName = String(player.shipName || player.name || 'Unnamed Vessel').replace(/[<>]/g, '').slice(0, 22);
      const hullTier = clamp(Math.round(Number(player.hullTier) || 1), 1, 7);
      const reputation = Math.round(clamp(Number(player.reputation) || 0, -100, 100));
      let view = this.remotePlayers.get(player.id);

      if (!view || view.hullTier !== hullTier) {
        if (view) this.disposeRemoteView(view);
        const upgrades = { ...this.saveData.player.upgrades, hullTier };
        const built = buildPlayerShip(upgrades, [], this.saveData.customFlag, this.textures);
        const tag = this.createRemotePlayerNameTag(safeShipName, reputation);
        built.root.add(tag.sprite);
        tag.sprite.position.set(0, Math.max(13, built.halfLength * 0.78), 0);
        this.scene.add(built.root);
        view = {
          id: player.id,
          name: safeShipName,
          shipName: safeShipName,
          hullTier,
          reputation,
          hullPct: Number(player.hullPct ?? 100),
          cannons: Number(player.cannons ?? 4),
          x: player.x,
          z: player.z,
          heading: player.heading || 0,
          targetX: player.x,
          targetZ: player.z,
          targetHeading: player.heading || 0,
          speed: player.speed || 0,
          landed: Boolean(player.landed),
          built,
          nameTag: tag.sprite,
          nameTexture: tag.texture,
        };
        this.remotePlayers.set(player.id, view);
      } else {
        view.targetX = player.x;
        view.targetZ = player.z;
        view.targetHeading = player.heading || 0;
        view.speed = player.speed || 0;
        view.landed = Boolean(player.landed);
        view.hullPct = Number(player.hullPct ?? view.hullPct);
        view.cannons = Number(player.cannons ?? view.cannons);
        if (view.shipName !== safeShipName || view.reputation !== reputation) {
          const replacement = this.createRemotePlayerNameTag(safeShipName, reputation);
          (view.nameTag.material as THREE.SpriteMaterial).dispose();
          view.nameTag.material = replacement.sprite.material;
          view.nameTexture.dispose();
          view.nameTexture = replacement.texture;
          view.name = safeShipName;
          view.shipName = safeShipName;
          view.reputation = reputation;
        }
      }
    }

    // Every client loads the same seeded chunks around every connected ship, so islands, rocks,
    // wrecks and bot ships exist in the same places for everyone.
    for (const remote of this.remotePlayers.values()) {
      if (Math.hypot(remote.targetX - this.saveData.player.x, remote.targetZ - this.saveData.player.z) > 1750) continue;
      const { cx, cz } = worldToChunk(remote.targetX, remote.targetZ);
      const chunkKeyForRemote = `${cx},${cz}`;
      if (this.remoteChunkStreams.get(remote.id) === chunkKeyForRemote) continue;
      const p = this.saveData.player;
      const oldX = p.x;
      const oldZ = p.z;
      p.x = remote.targetX;
      p.z = remote.targetZ;
      this.streamWorldAroundPlayer(true);
      p.x = oldX;
      p.z = oldZ;
      this.remoteChunkStreams.set(remote.id, chunkKeyForRemote);
    }
  }

  /** Crashing into another player's ship pushes you back and stops you (like SPACE); only fast hits hurt. */
  private resolvePredictedMultiplayerShipCollisions(): void {
    if (this.fps.active || this.remotePlayers.size === 0) return;
    const p = this.saveData.player;
    const localRadius = 18 + p.upgrades.hullTier * 1.5;
    for (const remote of this.remotePlayers.values()) {
      const dx = p.x - remote.targetX;
      const dz = p.z - remote.targetZ;
      const distance = Math.hypot(dx, dz);
      const minimum = localRadius + 18 + remote.hullTier * 1.5;
      if (distance >= minimum) continue;
      const nx = distance > 0.001 ? dx / distance : 1;
      const nz = distance > 0.001 ? dz / distance : 0;
      // Closing speed along the collision normal (our speed toward them + their speed toward us).
      const myVx = -Math.sin(p.heading) * p.speed;
      const myVz = -Math.cos(p.heading) * p.speed;
      const thVx = -Math.sin(remote.targetHeading) * remote.speed;
      const thVz = -Math.cos(remote.targetHeading) * remote.speed;
      const closing = Math.max(0, -((myVx - thVx) * nx + (myVz - thVz) * nz));
      const overlap = minimum - distance;
      const push = overlap + 2.5 + Math.min(6, closing * 0.5);
      p.x += nx * push;
      p.z += nz * push;
      p.speed = 0;
      p.throttle = 0;
      p.isStopping = true;
      const cooldownKey = `player_${remote.id}`;
      if (closing > 0.5 && !this.collisionCooldowns.has(cooldownKey)) {
        this.collisionCooldowns.set(cooldownKey, 0.9);
        const FAST = 9;
        const damage = closing > FAST ? Math.round((closing - FAST) * 1.6 + 2) : 0;
        this.sound.playImpactSplinter();
        this.trauma = Math.min(1, this.trauma + (closing > FAST ? 0.35 : 0.12));
        this.playerImpactRoll += (Math.random() < 0.5 ? -1 : 1) * (closing > FAST ? 0.2 : 0.07);
        if (damage > 0) {
          p.condition.hull = Math.max(0, p.condition.hull - damage);
          p.condition.flooding = clamp(p.condition.flooding + damage * 0.2, 0, 100);
          this.emitDamageNotification({
            targetName: p.shipName || 'Your Ship',
            attackerName: remote.shipName,
            location: 'hull',
            damage,
            source: 'ram',
            direction: 'taken',
            critical: damage >= 12,
            worldPos: { x: (p.x + remote.targetX) * 0.5, y: 2.2, z: (p.z + remote.targetZ) * 0.5 },
          });
          this.checkPermadeath(remote.shipName);
        }
      }
    }
  }

  private updateRemotePlayers(dt: number): void {
    const wave = this.saveData.weather.waveIntensity;
    for (const remote of this.remotePlayers.values()) {
      const blend = 1 - Math.exp(-Math.max(0.001, dt) * 9);
      remote.x += (remote.targetX - remote.x) * blend;
      remote.z += (remote.targetZ - remote.z) * blend;
      const angleDelta = normalizeAngle(remote.targetHeading - remote.heading);
      remote.heading = normalizeAngle(remote.heading + angleDelta * blend);
      const pose = computeBoatBuoyancy(
        remote.x,
        remote.z,
        remote.heading,
        remote.built.halfLength,
        remote.built.halfBeam,
        1.5,
        0,
        remote.landed ? 0 : remote.speed,
        this.simTime,
        wave,
        this.rogueWaveBoost
      );
      remote.built.root.position.set(remote.x, pose.y, remote.z);
      remote.built.root.rotation.order = 'YXZ';
      remote.built.root.rotation.set(pose.pitch, remote.heading, pose.roll);
      remote.nameTag.visible = true;
      animateWavingFlag(remote.built.flagMesh, this.simTime, this.saveData.weather.windSpeed / 12);
      for (const actor of remote.built.crewActors) {
        const t = this.simTime * 1.4 + actor.phase;
        actor.group.position.x = actor.baseX + Math.sin(t) * actor.patrolAmp;
        actor.group.position.z = actor.baseZ + Math.cos(t * 0.85) * actor.patrolAmp;
      }
    }
  }

  public getRemotePlayerList(): Array<{ id: string; shipName: string; x: number; z: number; heading: number; reputation: number; landed: boolean }> {
    return [...this.remotePlayers.values()].map((r) => ({
      id: r.id, shipName: r.shipName, x: r.targetX, z: r.targetZ, heading: r.targetHeading, reputation: r.reputation, landed: r.landed,
    }));
  }

  public findNearbyPlayer(): { id: string; name: string; reputation: number; distance: number } | null {
    if (this.fps.active) return null;
    const p = this.saveData.player;
    let best: { id: string; name: string; reputation: number; distance: number } | null = null;
    for (const r of this.remotePlayers.values()) {
      if (r.landed) continue;
      const d = Math.hypot(r.targetX - p.x, r.targetZ - p.z);
      if (d < 110 && (!best || d < best.distance)) {
        best = { id: r.id, name: r.shipName, reputation: r.reputation, distance: Math.round(d) };
      }
    }
    return best;
  }

  // --- Player-to-player trade (the other player must accept) -------------------------------------

  private tradeSideCheck(giveGold: number, giveRes: ResourceId | null, giveQty: number, getRes: ResourceId | null, getQty: number): string | null {
    const p = this.saveData.player;
    if (giveGold > p.gold) return `Not enough gold (${giveGold}g needed).`;
    if (giveRes && (p.inventory[giveRes] || 0) < giveQty) return `Not enough ${RESOURCE_DEFS[giveRes]?.name ?? giveRes} in your hold.`;
    if (getRes) {
      const freed = giveRes ? (RESOURCE_DEFS[giveRes]?.weight ?? 1) * giveQty : 0;
      const cap = getCargoCapacity(p.upgrades);
      if (getCargoWeight(p.inventory) - freed + (RESOURCE_DEFS[getRes]?.weight ?? 1) * getQty > cap + 0.01) return 'Your cargo hold is too full for that trade.';
    }
    return null;
  }

  private applyTradeSide(giveGold: number, giveRes: ResourceId | null, giveQty: number, getGold: number, getRes: ResourceId | null, getQty: number): void {
    const p = this.saveData.player;
    p.gold = Math.max(0, p.gold - giveGold + getGold);
    if (giveRes) p.inventory[giveRes] = Math.max(0, (p.inventory[giveRes] || 0) - giveQty);
    if (getRes) p.inventory[getRes] = (p.inventory[getRes] || 0) + getQty;
    this.saveData.stats.peakGold = Math.max(this.saveData.stats.peakGold, p.gold);
    this.saveData.stats.tradesCompleted++;
    this.sound.playCoinChime();
    this.flushImmediateSave();
    this.emitHud();
  }

  private cleanOffer(o: PlayerTradeOffer): PlayerTradeOffer {
    const num = (v: unknown, max: number) => Math.max(0, Math.min(max, Math.floor(Number(v) || 0)));
    const res = (v: unknown): ResourceId | null => (typeof v === 'string' && RESOURCE_DEFS[v as ResourceId] ? (v as ResourceId) : null);
    const giveRes = res(o.giveRes);
    const askRes = res(o.askRes);
    return {
      giveGold: num(o.giveGold, 1_000_000), giveRes, giveQty: giveRes ? num(o.giveQty, 10_000) : 0,
      askGold: num(o.askGold, 1_000_000), askRes, askQty: askRes ? num(o.askQty, 10_000) : 0,
    };
  }

  public proposeTrade(toId: string, offerIn: PlayerTradeOffer): { ok: boolean; message: string } {
    if (!this.net) return { ok: false, message: 'Not connected to the shared ocean.' };
    const offer = this.cleanOffer(offerIn);
    if (offer.giveGold + offer.giveQty + offer.askGold + offer.askQty <= 0) return { ok: false, message: 'Offer something first.' };
    const err = this.tradeSideCheck(offer.giveGold, offer.giveRes, offer.giveQty, offer.askRes, offer.askQty);
    if (err) return { ok: false, message: err };
    const offerId = `${this.myPlayerId.slice(0, 6)}_${Date.now()}`;
    this.pendingOutgoingTrades.set(offerId, { to: toId, offer });
    const sent = this.net.sendRelay('trade-offer', toId, { offerId, offer });
    if (!sent) return { ok: false, message: 'Could not reach the server.' };
    const name = this.remotePlayers.get(toId)?.shipName ?? 'the other captain';
    this.pushNotification(`Trade offer sent to ${name}. Waiting for them to accept…`);
    window.setTimeout(() => this.pendingOutgoingTrades.delete(offerId), 60_000);
    return { ok: true, message: 'Offer sent.' };
  }

  public respondToTrade(offerId: string, accept: boolean): { ok: boolean; message: string } {
    const inc = this.pendingIncomingTrades.get(offerId);
    if (!inc || !this.net) return { ok: false, message: 'That offer expired.' };
    if (!accept) {
      this.net.sendRelay('trade-response', inc.from, { offerId, accept: false });
      this.pendingIncomingTrades.delete(offerId);
      return { ok: true, message: 'Offer declined.' };
    }
    // I give what they ask for, and receive what they give.
    const o = inc.offer;
    const err = this.tradeSideCheck(o.askGold, o.askRes, o.askQty, o.giveRes, o.giveQty);
    if (err) {
      this.net.sendRelay('trade-response', inc.from, { offerId, accept: false, reason: err });
      this.pendingIncomingTrades.delete(offerId);
      return { ok: false, message: err };
    }
    this.net.sendRelay('trade-response', inc.from, { offerId, accept: true });
    this.pushNotification('Offer accepted — waiting for the other captain to complete the trade…');
    return { ok: true, message: 'Accepted.' };
  }

  // --- PvP: fight another player like any pirate, but they steer the other ship ------------------

  private ensurePvpStandIn(playerId: string): { data: PirateShipData; mesh: THREE.Group; cannonRecoil: number } | null {
    const id = `pvp_${playerId}`;
    const existing = this.pirates.get(id);
    if (existing) return existing;
    const view = this.remotePlayers.get(playerId);
    if (!view) return null;
    const base = generatePirateShip(id, view.targetX, view.targetZ, 'sloop', this.rand);
    base.playerId = playerId;
    base.name = view.shipName;
    base.captainName = view.shipName;
    base.cannons = Math.max(2, Math.round(view.cannons || 4));
    base.maxHull = 100;
    base.hull = Math.max(1, view.hullPct || 100);
    base.crewCount = Math.max(6, base.crewCount);
    base.behavior = 'broadside';
    base.hailCooldown = 99999;
    base.defeated = false;
    base.heading = view.targetHeading;
    const built = buildNpcShip(base.hullArchetype, 'pirate', this.textures, base.factionId, Math.min(14, base.cannons));
    built.root.position.set(base.x, 0, base.z);
    built.root.visible = false; // the real player ship is drawn by the remote-player view
    this.scene.add(built.root);
    const entry = {
      data: base, mesh: built.root, sails: built.sails, flagMesh: built.flagMesh,
      ghostFog: built.ghostFog, fadeMaterials: built.fadeMaterials, cannonGroups: built.cannonGroups,
      damagePatches: built.damagePatches, crewActors: built.crewActors, halfLength: built.halfLength,
      halfBeam: built.halfBeam, cannonRecoil: 0, impactRoll: 0, impactPitch: 0, smokeAccum: 0,
    };
    this.pirates.set(id, entry);
    return entry;
  }

  private removePvpStandIn(playerId: string): void {
    const id = `pvp_${playerId}`;
    const entry = this.pirates.get(id);
    this.pvpOpponents.delete(playerId);
    if (!entry) return;
    this.scene.remove(entry.mesh);
    this.pirates.delete(id);
    this.npcDamageMarks.delete(id);
    if (this.isEnemyInCombat(id)) {
      this.combat.enemies = this.getCombatEnemies().filter((e) => e.id !== id);
      this.syncCombatPrimaryFields();
    }
  }

  /** Keeps a PvP stand-in glued to the real player's ship. Returns false if the fight is over. */
  private stepPvpStandIn(entry: { data: PirateShipData }, dt: number): void {
    const pir = entry.data;
    const view = pir.playerId ? this.remotePlayers.get(pir.playerId) : undefined;
    if (!view || view.landed) {
      if (pir.playerId) {
        this.pushNotification(`${pir.name} slipped away.`);
        this.removePvpStandIn(pir.playerId);
      }
      return;
    }
    const blend = 1 - Math.exp(-Math.max(0.001, dt) * 9);
    pir.x += (view.targetX - pir.x) * blend;
    pir.z += (view.targetZ - pir.z) * blend;
    pir.heading = normalizeAngle(pir.heading + normalizeAngle(view.targetHeading - pir.heading) * blend);
    pir.speed = view.speed;
    pir.hull = Math.max(1, view.hullPct);
    pir.cannons = Math.max(2, Math.round(view.cannons || pir.cannons));
    pir.behavior = 'broadside';
    const dist = Math.hypot(pir.x - this.saveData.player.x, pir.z - this.saveData.player.z);
    if (dist > 330) {
      const id = pir.playerId!;
      this.net?.sendRelay('pvp-end', id, {});
      this.pushNotification(`You broke away from ${pir.name}.`);
      this.removePvpStandIn(id);
    }
  }

  public attackPlayer(playerId: string): { ok: boolean; message: string } {
    const view = this.remotePlayers.get(playerId);
    if (!view || !this.net) return { ok: false, message: 'That ship is gone.' };
    if (view.landed) return { ok: false, message: 'That captain is ashore.' };
    if (Math.hypot(view.targetX - this.saveData.player.x, view.targetZ - this.saveData.player.z) > 330) {
      return { ok: false, message: 'Too far away to attack.' };
    }
    const entry = this.ensurePvpStandIn(playerId);
    if (!entry) return { ok: false, message: 'Could not engage that ship.' };
    this.pvpOpponents.add(playerId);
    this.net.sendRelay('pvp-attack', playerId, { cannons: this.saveData.player.upgrades.cannonCount ?? 4 });
    this.startNavalBattle(entry.data);
    return { ok: true, message: `You attacked ${view.shipName}! Fight!` };
  }

  private notifyPvpDown(lostGold: number): void {
    for (const id of Array.from(this.pvpOpponents)) {
      this.net?.sendRelay('pvp-down', id, { goldLost: lostGold });
      this.removePvpStandIn(id);
    }
  }

  /** Messages from other players (relayed by the server). */
  public handleRelay(type: RelayType, from: string, fromName: string, payload: any): void {
    switch (type) {
      case 'trade-offer': {
        const offer = this.cleanOffer(payload?.offer ?? {});
        const offerId = String(payload?.offerId ?? '');
        if (!offerId) return;
        this.pendingIncomingTrades.set(offerId, { from, fromName, offer });
        window.setTimeout(() => this.pendingIncomingTrades.delete(offerId), 60_000);
        this.sound.playShipBell();
        this.callbacks.onIncomingTradeOffer?.({ offerId, from, fromName, offer });
        return;
      }
      case 'trade-response': {
        const out = this.pendingOutgoingTrades.get(String(payload?.offerId ?? ''));
        if (!out || out.to !== from) return;
        if (!payload.accept) {
          this.pendingOutgoingTrades.delete(String(payload.offerId));
          this.pushNotification(payload.reason ? `${fromName} could not trade: ${payload.reason}` : `${fromName} declined your trade offer.`);
          return;
        }
        const o = out.offer;
        const err = this.tradeSideCheck(o.giveGold, o.giveRes, o.giveQty, o.askRes, o.askQty);
        this.pendingOutgoingTrades.delete(String(payload.offerId));
        if (err) {
          this.net?.sendRelay('trade-commit', from, { offerId: payload.offerId, ok: false });
          this.pushNotification(`Trade with ${fromName} failed: ${err}`);
          return;
        }
        this.applyTradeSide(o.giveGold, o.giveRes, o.giveQty, o.askGold, o.askRes, o.askQty);
        this.net?.sendRelay('trade-commit', from, { offerId: payload.offerId, ok: true });
        this.addLog('Player Trade', `Traded with ${fromName}.`);
        this.pushNotification(`Trade with ${fromName} completed!`);
        return;
      }
      case 'trade-commit': {
        const offerId = String(payload?.offerId ?? '');
        const inc = this.pendingIncomingTrades.get(offerId);
        if (!inc || inc.from !== from) return;
        this.pendingIncomingTrades.delete(offerId);
        if (!payload.ok) {
          this.pushNotification(`${fromName} could not complete the trade.`);
          return;
        }
        const o = inc.offer;
        const err = this.tradeSideCheck(o.askGold, o.askRes, o.askQty, o.giveRes, o.giveQty);
        if (err) {
          this.pushNotification(`Trade with ${fromName} failed: ${err}`);
          return;
        }
        this.applyTradeSide(o.askGold, o.askRes, o.askQty, o.giveGold, o.giveRes, o.giveQty);
        this.addLog('Player Trade', `Traded with ${fromName}.`);
        this.pushNotification(`Trade with ${fromName} completed!`);
        return;
      }
      case 'trade-cancel': {
        this.pendingIncomingTrades.delete(String(payload?.offerId ?? ''));
        return;
      }
      case 'pvp-attack': {
        const entry = this.ensurePvpStandIn(from);
        if (!entry) return;
        this.pvpOpponents.add(from);
        this.startNavalBattle(entry.data);
        this.pushNotification(`${fromName} is attacking you!`);
        return;
      }
      case 'pvp-volley': {
        if (!this.pvpOpponents.has(from) || this.playerSinkingTimer > 0) return;
        const entry = this.ensurePvpStandIn(from);
        if (!entry) return;
        const pirate = entry.data;
        const dist = Math.hypot(pirate.x - this.saveData.player.x, pirate.z - this.saveData.player.z);
        if (dist > 420) return;
        const stats = computeAutoCombatStats(this.saveData.player.upgrades, this.saveData.player.crew, this.combat.command);
        const res = resolveEnemyVolley(
          pirate, dist, this.saveData.player.condition, this.saveData.player.upgrades,
          this.saveData.player.crew, this.rand, stats.damageTakenMult
        );
        this.applyIncomingVolleyEffects(pirate.name, pirate.x, entry.mesh.position.y, pirate.z, pirate.cannons, res);
        entry.cannonRecoil = 1.0;
        return;
      }
      case 'pvp-down': {
        if (!this.pvpOpponents.has(from)) return;
        const loot = Math.min(400, Math.round((Number(payload?.goldLost) || 0) * 0.5));
        this.saveData.player.gold += loot;
        this.saveData.stats.peakGold = Math.max(this.saveData.stats.peakGold, this.saveData.player.gold);
        this.removePvpStandIn(from);
        this.sound.playCoinChime();
        this.addLog('Player Vessel Sunk', `You sank ${fromName} and plundered ${loot} gold.`);
        this.pushNotification(`You sank ${fromName}! Plundered ${loot} gold.`);
        this.flushImmediateSave();
        this.emitHud();
        return;
      }
      case 'pvp-end': {
        if (this.pvpOpponents.has(from)) {
          this.removePvpStandIn(from);
          this.pushNotification(`${fromName} broke off the fight.`);
        }
        return;
      }
      default:
        return;
    }
  }

  public respawnAfterDeath(spawn: { x: number; z: number; heading?: number }): void {
    const p = this.saveData.player;
    p.x = Number.isFinite(spawn.x) ? spawn.x : 0;
    p.z = Number.isFinite(spawn.z) ? spawn.z : 0;
    p.heading = Number.isFinite(spawn.heading) ? spawn.heading! : p.heading;
    p.speed = 0;
    p.throttle = 0;
    p.rudder = 0;
    p.isStopping = true;
    this.playerSinkingTimer = 0;
    this.playerSinkingCause = '';
    if (this.fps.active) this.fps.exitIsland();
    this.rebuildPlayerShipMesh();
    this.streamWorldAroundPlayer();
    this.setPhase('playing');
    this.pushNotification('You returned to sea near another captain. Your ship, crew and upgrades were kept, but all carried resources and gold were lost. Emergency supplies provided: 40 provisions and 42 fresh water.');
    this.flushImmediateSave();
  }

  public rebuildPlayerShipMesh(): void {
    if (this.playerShip) {
      this.scene.remove(this.playerShip.root);
      this.playerShip.flagTexture.dispose();
      this.playerShip.sailTexture?.dispose();
    }
    this.playerDamageMarkMeshes = [];
    this.playerShip = buildPlayerShip(
      this.saveData.player.upgrades,
      this.saveData.player.crew,
      this.saveData.customFlag,
      this.textures
    );
    for (const mark of this.saveData.player.damageMarks ?? []) {
      const mMesh = createBattleDamageMarkMesh(mark.section, mark.kind, mark.severity, mark.hasFire);
      mMesh.position.set(mark.localX, mark.localY, mark.localZ);
      this.playerShip.root.add(mMesh);
      this.playerDamageMarkMeshes.push({ section: mark.section, mesh: mMesh });
    }
    this.playerShip.root.position.set(this.saveData.player.x, 0, this.saveData.player.z);
    this.playerShip.root.rotation.y = this.saveData.player.heading;
    this.scene.add(this.playerShip.root);
  }

  private syncTamedCompanions(): void {
    const activeIds = new Set(this.saveData.tamedMonsters.map((m) => m.id));
    for (const [id, mesh] of Array.from(this.companionMeshes.entries())) {
      if (!activeIds.has(id)) {
        this.scene.remove(mesh.root);
        this.companionMeshes.delete(id);
      }
    }
    for (const tm of this.saveData.tamedMonsters) {
      if (!this.companionMeshes.has(tm.id)) {
        const built = buildSeaMonsterMesh(tm.species, tm.size ?? 'small', 'good');
        built.root.position.set(tm.x, 0, tm.z);
        this.scene.add(built.root);
        this.companionMeshes.set(tm.id, built);
      }
    }
  }

  private syncFleetMeshes(rebuildAll = false): void {
    const activeIds = new Set(this.saveData.fleet.filter((f) => !f.sunk).map((f) => f.id));
    for (const [id, entry] of Array.from(this.fleetShips.entries())) {
      if (!activeIds.has(id) || rebuildAll) {
        this.scene.remove(entry.built.root);
        entry.built.flagTexture?.dispose();
        entry.built.sailTexture?.dispose();
        this.fleetShips.delete(id);
      }
    }
    for (const fs of this.saveData.fleet) {
      if (fs.sunk) continue;
      if (!this.fleetShips.has(fs.id)) {
        const built = buildFleetShipMesh(fs, this.saveData.customFlag, this.textures);
        built.root.position.set(fs.x, 0, fs.z);
        built.root.rotation.y = fs.heading;
        this.scene.add(built.root);
        this.fleetShips.set(fs.id, {
          data: fs,
          built,
          impactRoll: 0,
          cannonRecoil: 0,
          smokeAccum: 0,
        });
      } else {
        const existing = this.fleetShips.get(fs.id)!;
        existing.data = fs;
      }
    }
  }

  private streamWorldAroundPlayer(skipPrune = false): void {
    const { cx, cz } = worldToChunk(this.saveData.player.x, this.saveData.player.z);
    const keep = new Set<string>();

    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const key = chunkKey(cx + dx, cz + dz);
        keep.add(key);
        if (!this.loadedChunks.has(key)) {
          this.loadedChunks.add(key);
          const chunk = generateWorldChunk(
            this.saveData.seed,
            cx + dx,
            cz + dz,
            this.lootedWreckIds,
            this.collectedCrateIds,
            this.defeatedPirateIds,
            this.defeatedMonsterIds,
            this.saveData.factions,
            this.saveData.searchedWreckSections,
            new Set(this.saveData.discoveredIslandIds ?? []),
            new Set(this.saveData.collectedDiscoveryIds ?? []),
            new Set(this.saveData.completedErrandIds ?? [])
          );

          for (const w of chunk.wrecks) {
            if (this.wrecks.has(w.id)) continue;
            const mesh = buildShipwreckMesh(w.archetype, w.scale, this.textures, Boolean(w.isCharred));
            mesh.position.set(w.x, -w.sinkDepth, w.z);
            mesh.rotation.y = w.rotation;
            this.scene.add(mesh);
            this.wrecks.set(w.id, { data: w, mesh });
          }

          for (const c of chunk.crates) {
            if (this.crates.has(c.id)) continue;
            const mesh = buildFloatingCrateMesh(c.kind);
            mesh.position.set(c.x, 0, c.z);
            this.scene.add(mesh);
            this.crates.set(c.id, { data: c, mesh });
          }

          for (const rk of chunk.rocks ?? []) {
            if (this.rocks.has(rk.id)) continue;
            const mesh = buildSeaRockClusterMesh(rk.radius, rk.height, rk.variant, {
              submerged: rk.submerged,
              isReef: rk.isReef,
            });
            mesh.position.set(rk.x, 0, rk.z);
            mesh.rotation.y = rk.rotation;
            this.scene.add(mesh);
            this.rocks.set(rk.id, { data: rk, mesh });
          }

          for (const isl of chunk.islands ?? []) {
            if (this.islands.has(isl.id)) continue;
            const built = buildIslandMesh(isl, this.textures, this.isSoftwareGl);
            this.scene.add(built.root);
            this.islands.set(isl.id, { data: isl, built });
            for (const pg of isl.pirateGuards ?? []) {
              if (pg.dead || this.islandPirateGuards.has(pg.id)) continue;
              const pgBuilt = buildIslandPirateGuardMesh(pg);
              pgBuilt.root.position.set(pg.x, pg.y, pg.z);
              this.scene.add(pgBuilt.root);
              this.islandPirateGuards.set(pg.id, { data: pg, built: pgBuilt });
            }
            if (isl.discovered) {
              this.recordMarker({
                id: isl.id,
                kind: 'island',
                name: isl.name,
                x: isl.x,
                z: isl.z,
                status: `${isl.archetype.replace('_', ' ')} Island`,
              });
              if (isl.settlement) {
                this.recordMarker({
                  id: isl.settlement.id,
                  kind: 'settlement',
                  name: isl.settlement.name,
                  x: isl.settlement.worldX,
                  z: isl.settlement.worldZ,
                  status: isl.settlement.kind.replace('_', ' '),
                });
              }
            }
          }

          for (const ib of chunk.icebergs ?? []) {
            if (this.icebergs.has(ib.id)) continue;
            const mesh = buildIcebergMesh(ib);
            this.scene.add(mesh);
            this.icebergs.set(ib.id, { data: ib, mesh });
          }

          for (const ic of chunk.iceChunks ?? []) {
            if (this.iceChunks.has(ic.id)) continue;
            const mesh = buildIceChunkMesh(ic);
            this.scene.add(mesh);
            this.iceChunks.set(ic.id, { data: ic, mesh });
          }

          for (const sh of chunk.iceSheets ?? []) {
            if (this.iceSheets.has(sh.id)) continue;
            const built = buildBreakableIceSheetMesh(sh);
            updateBreakableIceSheetVisuals(built, sh);
            this.scene.add(built.root);
            this.iceSheets.set(sh.id, { data: sh, built });
          }

          for (const wa of chunk.wildlife ?? []) {
            if (this.wildlife.has(wa.id)) continue;
            const built = buildWildlifeMesh(wa);
            built.root.position.set(wa.x, wa.y, wa.z);
            this.scene.add(built.root);
            this.wildlife.set(wa.id, { data: wa, built });
          }

          for (const m of chunk.merchants) {
            if (this.merchants.has(m.id)) continue;
            const built = buildNpcShip(
              m.vesselClass,
              m.isCrown ? 'crown' : 'merchant',
              this.textures,
              undefined,
              m.cannons
            );
            built.root.position.set(m.x, 0, m.z);
            built.root.rotation.y = m.heading;
            this.scene.add(built.root);
            this.merchants.set(m.id, {
              data: m,
              mesh: built.root,
              sails: built.sails,
              flagMesh: built.flagMesh,
              cannonGroups: built.cannonGroups,
              damagePatches: built.damagePatches,
              crewActors: built.crewActors,
              halfLength: built.halfLength,
              halfBeam: built.halfBeam,
              impactRoll: 0,
              cannonRecoil: 0,
            });
          }

          for (const p of chunk.pirates) {
            if (this.pirates.has(p.id)) continue;
            const built = buildNpcShip(
              p.hullArchetype,
              'pirate',
              this.textures,
              p.factionId,
              Math.min(14, p.cannons),
              Boolean(p.isGhost),
              p.ghostSize
            );
            built.root.position.set(p.x, 0, p.z);
            built.root.rotation.y = p.heading;
            this.scene.add(built.root);
            this.pirates.set(p.id, {
              data: p,
              mesh: built.root,
              sails: built.sails,
              flagMesh: built.flagMesh,
              ghostFog: built.ghostFog,
              fadeMaterials: built.fadeMaterials,
              cannonGroups: built.cannonGroups,
              damagePatches: built.damagePatches,
              crewActors: built.crewActors,
              halfLength: built.halfLength,
              halfBeam: built.halfBeam,
              cannonRecoil: 0,
              impactRoll: 0,
              impactPitch: 0,
              smokeAccum: 0,
            });
          }

          for (const mon of chunk.monsters) {
            if (this.monsters.has(mon.id)) continue;
            const built = buildSeaMonsterMesh(mon.species, mon.size, mon.alignment);
            built.root.position.set(mon.x, 0, mon.z);
            built.root.rotation.y = mon.heading;
            this.scene.add(built.root);
            this.monsters.set(mon.id, {
              data: mon,
              built,
              impactRoll: 0,
            });
          }
        }
      }
    }

    if (!skipPrune) {
    const px = this.saveData.player.x;
    const pz = this.saveData.player.z;

    for (const [id, entry] of this.wrecks) {
      const isDynamic = id.startsWith('sunk_wreck_') || id.startsWith('ghost_wreck_');
      const pruneDist = isDynamic && !entry.data.fullyLooted ? 2200 : 960;
      if (this.distToNearestPlayer(entry.data.x, entry.data.z) > pruneDist) {
        this.scene.remove(entry.mesh);
        this.wrecks.delete(id);
        if (entry.data.spawnedFromShipId) {
          this.sunkenWreckByShipId.delete(entry.data.spawnedFromShipId);
        }
      }
    }
    for (const [id, entry] of this.crates) {
      if (this.distToNearestPlayer(entry.data.x, entry.data.z) > 960) {
        this.scene.remove(entry.mesh);
        this.crates.delete(id);
      }
    }
    for (const [id, entry] of this.rocks) {
      if (this.distToNearestPlayer(entry.data.x, entry.data.z) > 960) {
        this.scene.remove(entry.mesh);
        this.rocks.delete(id);
      }
    }
    for (const [id, entry] of this.islands) {
      if (this.fps.active && this.fps.island?.id === id) continue;
      if (this.distToNearestPlayer(entry.data.x, entry.data.z) > 1080) {
        this.scene.remove(entry.built.root);
        this.islands.delete(id);
      }
    }
    for (const [id, entry] of this.icebergs) {
      if (this.distToNearestPlayer(entry.data.x, entry.data.z) > 1020) {
        this.scene.remove(entry.mesh);
        this.icebergs.delete(id);
      }
    }
    for (const [id, entry] of this.iceChunks) {
      if (this.distToNearestPlayer(entry.data.x, entry.data.z) > 980) {
        this.scene.remove(entry.mesh);
        this.iceChunks.delete(id);
      }
    }
    for (const [id, entry] of this.iceSheets) {
      if (this.distToNearestPlayer(entry.data.x, entry.data.z) > 980) {
        this.scene.remove(entry.built.root);
        this.iceSheets.delete(id);
      }
    }
    for (const [id, entry] of this.wildlife) {
      if (entry.data.islandId && this.fps.active && this.fps.island?.id === entry.data.islandId) continue;
      if (this.distToNearestPlayer(entry.data.x, entry.data.z) > 1020) {
        this.scene.remove(entry.built.root);
        this.wildlife.delete(id);
      }
    }
    for (const [id, entry] of this.islandPirateGuards) {
      if (this.fps.active && this.fps.island?.id === entry.data.islandId) continue;
      if (!this.islands.has(entry.data.islandId) || this.distToNearestPlayer(entry.data.x, entry.data.z) > 1060) {
        this.scene.remove(entry.built.root);
        this.islandPirateGuards.delete(id);
      }
    }
    for (const [id, entry] of this.merchants) {
      const keepBounty =
        entry.data.isBountyTarget ||
        (this.saveData.bounty?.status === 'active' && entry.data.huntingBountyId === this.saveData.bounty.id);
      const maxD = keepBounty ? 2400 : 1060;
      if (
        id !== this.combat.hostileMerchantId &&
        !this.isEnemyInCombat(id) &&
        this.distToNearestPlayer(entry.data.x, entry.data.z) > maxD
      ) {
        this.scene.remove(entry.mesh);
        this.merchants.delete(id);
        this.npcDamageMarks.delete(id);
        this.assistDecisions.delete(id);
        this.assistingAllies.delete(id);
      }
    }
    for (const [id, entry] of this.pirates) {
      const keepBounty =
        entry.data.isBountyTarget ||
        (this.saveData.bounty?.status === 'active' && entry.data.huntingBountyId === this.saveData.bounty.id);
      const maxD = keepBounty ? 2400 : 1060;
      if (
        id !== this.combat.pirateId &&
        !this.isEnemyInCombat(id) &&
        this.distToNearestPlayer(entry.data.x, entry.data.z) > maxD
      ) {
        this.scene.remove(entry.mesh);
        this.pirates.delete(id);
        this.hunterIds.delete(id);
        this.npcDamageMarks.delete(id);
        this.assistDecisions.delete(id);
        this.assistingAllies.delete(id);
      }
    }
    for (const [id, entry] of this.monsters) {
      if (
        id !== this.combat.monsterId &&
        !this.isEnemyInCombat(id) &&
        this.distToNearestPlayer(entry.data.x, entry.data.z) > 1060
      ) {
        this.scene.remove(entry.built.root);
        this.monsters.delete(id);
      }
    }
    for (const k of Array.from(this.loadedChunks)) {
      if (!keep.has(k)) this.loadedChunks.delete(k);
    }
    }
  }

  public setPhase(phase: 'title' | 'playing' | 'paused' | 'gameover'): void {
    this.phase = phase;
    document.body.dataset.state = phase;
    if (phase === 'playing') {
      this.sound.unlock();
      this.keys.clear();
      this.isDragging = false;
      this.fpsMouseState = { lastX: -1, lastY: -1, skipEvents: 2 };
      if (!this.fps.active) {
        this.camYaw = this.saveData.player.heading;
        this.camPitch = 0.28;
      }
    } else if (document.pointerLockElement === this.renderer.domElement) {
      try {
        document.exitPointerLock?.();
      } catch {
        // Ignore pointer lock exit errors
      }
    }
    this.callbacks.onStateChange(phase);
    this.emitHud();
  }

  public setModalOpen(open: boolean, kind: string | null = null): void {
    this.modalOpen = open;
    this.activeModalKind = open ? kind : null;
    if (open) {
      this.keys.clear();
      this.isDragging = false;
      if (document.pointerLockElement === this.renderer.domElement) {
        try {
          document.exitPointerLock?.();
        } catch {
          // Ignore pointer lock exit errors
        }
      }
    } else if (this.fps.active) {
      this.lastMouseX = -1;
      this.lastMouseY = -1;
      this.fpsMouseState = { lastX: -1, lastY: -1, skipEvents: 2 };
    }
  }

  public startNewVoyage(shipName?: string): void {
    clearVoyageStorage();
    const fresh = createNewVoyage(this.multiplayerWorldSeed ?? undefined, shipName);
    this.hydrateFromSave(fresh);
    this.setPhase('playing');
    this.pushNotification(`${fresh.player.shipName} casts off at dawn! Explore trading lanes, wrecks, and distant pirate seas.`);
    this.triggerTutorial(
      'first_sail',
      'Helm & Sail Controls',
      'W/S sets sail throttle, A/D steers, and SPACE toggles gradual coasting stop. Press Tab for Ship Management.'
    );
    this.callbacks.onSaveUpdate(this.getSaveSnapshot());
  }

  public continueVoyage(saved: SaveData): void {
    this.hydrateFromSave(saved);
    this.setPhase('playing');
    this.pushNotification(`Resumed Day ${saved.day} voyage (${getDayPhaseLabel(saved.timeOfDay)}).`);
    this.triggerTutorial(
      'first_sail',
      'Helm & Sail Controls',
      'W/S sets sail throttle, A/D steers, and SPACE toggles gradual coasting stop.'
    );
  }

  public toggleStop(): void {
    this.saveData.player.isStopping = !this.saveData.player.isStopping;
    this.pushNotification(
      this.saveData.player.isStopping
        ? 'Heaving to — vessel coasting gradually to a stop (press SPACE or W/S to sail).'
        : 'Full helm control resumed.'
    );
    this.emitHud();
  }

  public pushNotification(msg: string): void {
    this.notificationText = msg;
    this.notificationTimer = 5.2;
    this.emitHud();
  }

  private emitDamageBanner(
    _text: string,
    location: RepairPriority,
    damage: number,
    critical: boolean,
    worldPos?: { x: number; y: number; z: number }
  ): void {
    const px = worldPos?.x ?? this.saveData.player.x;
    const py = worldPos?.y ?? 3.6;
    const pz = worldPos?.z ?? this.saveData.player.z;
    this.worldDamagePopups.push({
      id: `wdmg_${++this.damageBannerSeq}`,
      worldX: px + (Math.random() - 0.5) * 1.6,
      worldY: py,
      worldZ: pz + (Math.random() - 0.5) * 1.6,
      amount: damage,
      partLabel: location.toUpperCase(),
      targetName: this.saveData.player.shipName || 'Your Ship',
      source: 'hazard',
      direction: 'taken',
      critical,
      life: 1.9,
      maxLife: 1.9,
    });
    if (this.worldDamagePopups.length > 16) this.worldDamagePopups.shift();
    this.emitHud();
  }

  private emitDamageNotification(opts: {
    targetName: string;
    attackerName: string;
    location: RepairPriority;
    damage: number;
    source: 'cannon' | 'ram' | 'hazard' | 'monster';
    direction: 'dealt' | 'taken' | 'ally';
    critical?: boolean;
    worldPos?: { x: number; y: number; z: number };
  }): void {
    const crit = Boolean(opts.critical);
    const partLabel = opts.location.toUpperCase();
    const srcLabel =
      opts.source === 'ram'
        ? 'Ram'
        : opts.source === 'monster'
          ? 'Monster Strike'
          : opts.source === 'hazard'
            ? 'Impact'
            : 'Cannon';
    const text =
      opts.direction === 'taken'
        ? `${crit ? 'CRITICAL ' : ''}${opts.targetName} ${partLabel} hit for ${opts.damage} dmg by ${opts.attackerName} (${srcLabel})`
        : `${crit ? 'CRITICAL ' : ''}${opts.attackerName} hit ${opts.targetName}'s ${partLabel} for ${opts.damage} dmg (${srcLabel})`;

    const notif: DamageNotification = {
      id: `dmg_${++this.damageBannerSeq}`,
      text,
      critical: crit,
      location: opts.location,
      damage: opts.damage,
      targetName: opts.targetName,
      attackerName: opts.attackerName,
      source: opts.source === 'monster' ? 'hazard' : opts.source,
      direction: opts.direction,
      ttl: 4.5,
      maxTtl: 4.5,
    };
    this.damageNotifications = [notif, ...this.damageNotifications].slice(0, 4);

    // Spawn 3D world-space floating damage number at exact impact coordinate
    const wx = opts.worldPos?.x ?? this.saveData.player.x;
    const wy = opts.worldPos?.y ?? 3.4;
    const wz = opts.worldPos?.z ?? this.saveData.player.z;
    this.worldDamagePopups.push({
      id: notif.id,
      worldX: wx + (Math.random() - 0.5) * 2.2,
      worldY: wy + 1.0 + Math.random() * 0.9,
      worldZ: wz + (Math.random() - 0.5) * 2.2,
      amount: opts.damage,
      partLabel,
      targetName: opts.targetName,
      source: opts.source,
      direction: opts.direction,
      critical: crit,
      life: 1.85,
      maxLife: 1.85,
    });
    if (this.worldDamagePopups.length > 16) this.worldDamagePopups.shift();
    this.emitHud();
  }

  private attachBattleDamageMark(opts: {
    targetKind: 'player' | 'pirate' | 'merchant';
    shipId: string;
    root: THREE.Group;
    shipX: number;
    shipZ: number;
    heading: number;
    halfLength: number;
    halfBeam: number;
    attackerX: number;
    attackerZ: number;
    section: RepairPriority;
    kind: 'cannon' | 'ram';
    damage: number;
  }): void {
    const dx = opts.attackerX - opts.shipX;
    const dz = opts.attackerZ - opts.shipZ;
    const rightX = Math.cos(opts.heading);
    const rightZ = -Math.sin(opts.heading);
    const fwdX = -Math.sin(opts.heading);
    const fwdZ = -Math.cos(opts.heading);

    const localRight = dx * rightX + dz * rightZ;
    const localFwd = dx * fwdX + dz * fwdZ;
    const sideSign = localRight >= 0 ? 1 : -1;
    const zPos = clamp(-localFwd / Math.max(4, opts.halfLength * 1.15), -0.78, 0.78) * opts.halfLength * 0.8;

    let localX = sideSign * opts.halfBeam * 0.92;
    let localY = 0.9 + (this.rand() - 0.5) * 0.35;
    let localZ = zPos;

    if (opts.section === 'sails') {
      localX = sideSign * 0.35;
      localY = 4.2 + this.rand() * 1.9;
      localZ = (this.rand() - 0.5) * opts.halfLength * 0.55;
    } else if (opts.section === 'mast') {
      localX = 0;
      localY = 3.5 + this.rand() * 1.6;
      localZ = (this.rand() - 0.5) * 0.8;
    } else if (opts.section === 'steering') {
      localX = sideSign * opts.halfBeam * 0.35;
      localY = 1.2;
      localZ = opts.halfLength * 0.84;
    } else if (opts.section === 'cannons') {
      localX = sideSign * opts.halfBeam * 0.88;
      localY = 1.38;
      localZ = clamp(zPos, -opts.halfLength * 0.45, opts.halfLength * 0.45);
    } else if (opts.section === 'deck') {
      localX = (this.rand() - 0.5) * opts.halfBeam * 0.85;
      localY = 1.55;
      localZ = zPos * 0.65;
    }

    const severity = clamp(0.68 + opts.damage / 20, 0.68, 1.45);
    const hasFire =
      opts.damage >= 10 ||
      (opts.section === 'sails' && opts.damage >= 7) ||
      (opts.kind === 'ram' && opts.damage >= 9);

    const mMesh = createBattleDamageMarkMesh(opts.section, opts.kind, severity, hasFire);
    mMesh.position.set(localX, localY, localZ);
    opts.root.add(mMesh);

    if (opts.targetKind === 'player') {
      if (!Array.isArray(this.saveData.player.damageMarks)) this.saveData.player.damageMarks = [];
      const markData: BattleDamageMark = {
        id: `pmark_${++this.markSeq}`,
        localX,
        localY,
        localZ,
        section: opts.section,
        kind: opts.kind,
        severity,
        hasFire,
      };
      this.saveData.player.damageMarks.push(markData);
      this.playerDamageMarkMeshes.push({ section: opts.section, mesh: mMesh });
      while (this.saveData.player.damageMarks.length > 16) {
        this.saveData.player.damageMarks.shift();
        const old = this.playerDamageMarkMeshes.shift();
        if (old) opts.root.remove(old.mesh);
      }
    } else {
      let arr = this.npcDamageMarks.get(opts.shipId);
      if (!arr) {
        arr = [];
        this.npcDamageMarks.set(opts.shipId, arr);
      }
      arr.push({ section: opts.section, mesh: mMesh });
      while (arr.length > 10) {
        const old = arr.shift();
        if (old) opts.root.remove(old.mesh);
      }
    }
  }

  private clearPlayerDamageMarks(section?: RepairPriority): void {
    const marks = this.saveData.player.damageMarks ?? [];
    if (!section) {
      this.saveData.player.damageMarks = [];
      for (const m of this.playerDamageMarkMeshes) this.playerShip.root.remove(m.mesh);
      this.playerDamageMarkMeshes = [];
      return;
    }
    this.saveData.player.damageMarks = marks.filter((m) => m.section !== section);
    const kept: Array<{ section: RepairPriority; mesh: THREE.Group }> = [];
    for (const m of this.playerDamageMarkMeshes) {
      if (m.section === section) this.playerShip.root.remove(m.mesh);
      else kept.push(m);
    }
    this.playerDamageMarkMeshes = kept;
  }

  private animateDamageMarksOnRoot(
    list: Array<{ section: RepairPriority; mesh: THREE.Group }>,
    worldX: number,
    worldZ: number,
    emitSmoke: boolean
  ): void {
    for (let i = 0; i < list.length; i++) {
      const m = list[i].mesh;
      const flame = m.userData.flameMesh as THREE.Mesh | undefined;
      if (flame) {
        const phase = (m.userData.firePhase as number) || i;
        flame.scale.y = 0.78 + Math.sin(this.simTime * 13 + phase) * 0.28;
        flame.scale.x = 0.85 + Math.cos(this.simTime * 9 + phase) * 0.14;
      }
      if (emitSmoke && (flame || i % 2 === 0)) {
        const isFire = Boolean(flame) && Math.random() < 0.35;
        this.spawnParticle(
          worldX + m.position.x * 0.45 + (Math.random() - 0.5) * 0.6,
          Math.max(1.2, m.position.y + 0.5),
          worldZ + m.position.z * 0.45 + (Math.random() - 0.5) * 0.6,
          (Math.random() - 0.5) * 0.7,
          1.7 + Math.random() * 1.1,
          (Math.random() - 0.5) * 0.7,
          isFire ? 0.65 : 1.1,
          isFire ? 0.96 : 0.24,
          isFire ? 0.45 : 0.24,
          isFire ? 0.1 : 0.25
        );
      }
    }
  }

  public triggerTutorial(id: string, title: string, message: string): void {
    if (!this.saveData.settings.tutorialsEnabled) return;
    if (this.saveData.seenTutorials.includes(id)) return;
    this.saveData.seenTutorials.push(id);
    const toast: TutorialToast = { id, title, message };
    if (!this.activeTutorial) {
      this.activeTutorial = toast;
      this.tutorialTimer = 8.5;
    } else {
      this.tutorialQueue.push(toast);
    }
    this.callbacks.onSaveUpdate(this.getSaveSnapshot());
    this.emitHud();
  }

  public dismissTutorialToast(disableAll = false): void {
    if (disableAll) {
      this.saveData.settings.tutorialsEnabled = false;
      this.tutorialQueue = [];
      this.activeTutorial = null;
      this.tutorialTimer = 0;
      this.callbacks.onSaveUpdate(this.getSaveSnapshot());
      this.emitHud();
      return;
    }
    if (this.tutorialQueue.length > 0) {
      this.activeTutorial = this.tutorialQueue.shift() ?? null;
      this.tutorialTimer = 8.5;
    } else {
      this.activeTutorial = null;
      this.tutorialTimer = 0;
    }
    this.emitHud();
  }

  public dismissSupplyWarning(key: string): void {
    if (!this.saveData.dismissedWarnings.includes(key)) {
      this.saveData.dismissedWarnings.push(key);
      this.callbacks.onSaveUpdate(this.getSaveSnapshot());
      this.emitHud();
    }
  }

  private addLog(title: string, body: string): void {
    if (!this.saveData.settings.autoJournalEnabled) return;
    this.saveData.journal = addJournalEntry(
      this.saveData.journal,
      this.saveData.day,
      this.saveData.timeOfDay,
      title,
      body,
      'log'
    );
    this.journalToastText = 'Journal Entry Added';
    this.journalToastTimer = 3.2;
    this.callbacks.onSaveUpdate(this.getSaveSnapshot());
  }

  private recordMarker(marker: DiscoveredMarker): void {
    const existingIdx = this.saveData.markers.findIndex((m) => m.id === marker.id);
    if (existingIdx >= 0) {
      this.saveData.markers[existingIdx] = marker;
    } else {
      this.saveData.markers.push(marker);
    }
  }

  private shiftReputation(delta: number): void {
    this.saveData.reputation = clamp(Math.round(this.saveData.reputation + delta), -100, 100);
  }

  private flushImmediateSave(): void {
    const snap = this.getSaveSnapshot();
    this.callbacks.onSaveUpdate(snap);
    if (this.phase !== 'gameover' && this.phase !== 'title') {
      if (saveVoyageToStorage(snap)) {
        this.autosaveTick++;
      }
    }
  }

  public getSaveSnapshot(): SaveData {
    if (this.saveData.player.crew.length > 0) this.lastKnownCrew = JSON.parse(JSON.stringify(this.saveData.player.crew));
    this.saveData.exploredCells = Array.from(this.exploredCells);
    this.saveData.lootedWreckIds = Array.from(this.lootedWreckIds);
    this.saveData.collectedCrateIds = Array.from(this.collectedCrateIds);
    this.saveData.defeatedPirateIds = Array.from(this.defeatedPirateIds);
    this.saveData.defeatedMonsterIds = Array.from(this.defeatedMonsterIds);
    return this.saveData;
  }

  public manualSave(): boolean {
    if (this.phase === 'gameover') return false;
    const ok = saveVoyageToStorage(this.getSaveSnapshot());
    if (ok) {
      this.autosaveTick++;
      this.pushNotification('Voyage saved to ship log.');
      this.emitHud();
    }
    return ok;
  }

  public getWreckById(id: string): ShipwreckData | null {
    return this.wrecks.get(id)?.data ?? null;
  }

  public getMerchantById(id: string): MerchantShipData | null {
    return this.merchants.get(id)?.data ?? null;
  }

  public getPirateById(id: string): PirateShipData | null {
    return this.pirates.get(id)?.data ?? null;
  }

  public getMonsterById(id: string): SeaMonsterData | null {
    return this.monsters.get(id)?.data ?? null;
  }

  // --- Salvage & Wrecks ---

  public collectFloatingCrate(id: string): {
    gold: number;
    loot: Partial<Inventory>;
    survivor?: WreckSurvivor;
    message: string;
  } | null {
    const entry = this.crates.get(id);
    if (!entry || entry.data.collected) return null;

    const c = entry.data;
    c.collected = true;
    this.collectedCrateIds.add(id);
    this.scene.remove(entry.mesh);
    this.crates.delete(id);

    const added = this.grantLoot(c.gold, c.loot);
    this.sound.playCoinChime();

    let msg = `Salvaged ${c.kind === 'raft' ? 'castaway raft' : 'floating supplies'}`;
    if (c.gold > 0) msg += ` (+${c.gold} gold)`;
    if (added.length > 0) msg += `: ${added.join(', ')}`;

    if (c.survivor && !c.survivor.resolved) {
      const cap = getMaxCrewCapacity(this.saveData.player.upgrades);
      if (this.saveData.player.crew.length < cap) {
        const recruited = this.survivorToCrew(c.survivor, false);
        this.saveData.player.crew.push(recruited);
        this.saveData.stats.survivorsRescued++;
        this.shiftReputation(3);
        this.rebuildPlayerShipMesh();
        msg += `. Rescued ${recruited.name}! (+3 Rep)`;
        this.addLog('Survivor Rescued at Sea', `Pulled ${recruited.name} aboard from a drifting raft.`);
      } else {
        msg += `. Crew quarters full for ${c.survivor.name}.`;
      }
      c.survivor.resolved = true;
    }

    this.pushNotification(msg);
    this.callbacks.onSaveUpdate(this.getSaveSnapshot());
    this.emitHud();
    return { gold: c.gold, loot: c.loot, survivor: c.survivor, message: msg };
  }

  public searchWreckSection(
    wreckId: string,
    sectionId: string
  ): {
    ok: boolean;
    gold: number;
    loot: Partial<Inventory>;
    hazardMsg: string | null;
    survivor?: WreckSurvivor;
  } {
    const entry = this.wrecks.get(wreckId);
    if (!entry) return { ok: false, gold: 0, loot: {}, hazardMsg: null };
    const wreck = entry.data;
    const sec = wreck.sections.find((s) => s.id === sectionId);
    if (!sec || sec.searched) return { ok: false, gold: 0, loot: {}, hazardMsg: null };

    sec.searched = true;
    if (!this.saveData.searchedWreckSections[wreck.id]) {
      this.saveData.searchedWreckSections[wreck.id] = [];
    }
    if (!this.saveData.searchedWreckSections[wreck.id].includes(sectionId)) {
      this.saveData.searchedWreckSections[wreck.id].push(sectionId);
    }

    if (!sec.emptyRoom) {
      this.grantLoot(sec.gold, sec.loot);
    }
    if (sec.collectible) {
      if (!this.saveData.ghostCollectibles.includes(sec.collectible)) {
        this.saveData.ghostCollectibles.push(sec.collectible);
      }
      this.pushNotification(`Spectral Relic Recovered: ${sec.collectible}!`);
      this.addLog(
        `Recovered ${sec.collectible}`,
        `Found the spectral relic "${sec.collectible}" inside ${wreck.name}.`
      );
    }
    this.sound.playCoinChime();

    // Award salvage & scouting experience to active crew
    const xpRes = grantCrewRoleXp(
      this.saveData.player.crew,
      ['lookout', 'navigator', 'sailor', 'general'],
      9
    );
    this.saveData.player.crew = xpRes.crew;

    let hazardMsg: string | null = null;
    const hazardChance = sec.dangerLevel === 'High' ? 0.36 : sec.dangerLevel === 'Moderate' ? 0.15 : 0.04;
    if (this.rand() < hazardChance && this.saveData.player.crew.length > 0) {
      const victim =
        this.saveData.player.crew[Math.floor(this.rand() * this.saveData.player.crew.length)];
      victim.health = Math.max(12, victim.health - 22);
      victim.condition = 'injured';
      hazardMsg = `Shifting wreckage injured ${victim.name} (Health now ${Math.round(victim.health)}).`;
    }

    if (sec.gold >= 50) {
      this.saveData.player.crew.forEach((c) => (c.morale = Math.min(100, c.morale + 5)));
    }

    const searchedCount = wreck.sections.filter((s) => s.searched).length;
    const totalCount = wreck.sections.length;

    if (searchedCount >= totalCount) {
      wreck.fullyLooted = true;
      this.lootedWreckIds.add(wreck.id);
      this.saveData.stats.wrecksExplored++;
      this.recordMarker({
        id: wreck.id,
        kind: wreck.isGhostWreck ? 'ghost' : 'wreck',
        name: wreck.name,
        x: wreck.x,
        z: wreck.z,
        status: 'Fully Searched',
      });
    } else {
      this.recordMarker({
        id: wreck.id,
        kind: wreck.isGhostWreck ? 'ghost' : 'wreck',
        name: wreck.name,
        x: wreck.x,
        z: wreck.z,
        status: `${searchedCount}/${totalCount} Searched`,
      });
    }

    if (sec.gold > 0) {
      this.addLog(
        `Salvaged ${wreck.name}`,
        `Searched ${sec.name} (${searchedCount}/${totalCount}) and recovered ${sec.gold} gold with salvaged materials.`
      );
    }

    if (xpRes.levelUps.length > 0) {
      this.pushNotification(`${xpRes.levelUps[0]}!`);
    }

    this.flushImmediateSave();
    this.emitHud();
    return {
      ok: true,
      gold: sec.gold,
      loot: sec.loot,
      hazardMsg,
      survivor: sec.survivor,
    };
  }

  public resolveWreckSurvivor(
    wreckId: string,
    sectionId: string,
    choice: 'accept' | 'force' | 'decline' | boolean
  ): { ok: boolean; message: string } {
    const mode = typeof choice === 'boolean' ? (choice ? 'accept' : 'decline') : choice;
    const entry = this.wrecks.get(wreckId);
    if (!entry) return { ok: false, message: 'Wreck not found.' };
    const sec = entry.data.sections.find((s) => s.id === sectionId);
    if (!sec || !sec.survivor || sec.survivor.resolved) {
      return { ok: false, message: 'Survivor already addressed.' };
    }
    const surv = sec.survivor;

    if (mode === 'decline') {
      surv.resolved = true;
      return { ok: true, message: `${surv.name} stayed aboard the wreckage.` };
    }

    if (mode === 'accept' && surv.disposition === 'gives_info') {
      surv.resolved = true;
      this.shiftReputation(3);
      this.addLog('Castaway Intelligence', `${surv.name} shared sea lore: ${surv.infoText}`);
      this.callbacks.onSaveUpdate(this.getSaveSnapshot());
      this.emitHud();
      return { ok: true, message: `${surv.name} shared sea lore (+3 Rep): ${surv.infoText}` };
    }

    const cap = getMaxCrewCapacity(this.saveData.player.upgrades);
    if (this.saveData.player.crew.length >= cap) {
      return { ok: false, message: `Crew quarters full (${cap} max). Expand your hull or add decks.` };
    }

    if (mode === 'accept') {
      if (surv.offerRefused) {
        return {
          ok: false,
          message: `${surv.name} already turned down your offer. Force them aboard or leave them.`,
        };
      }
      if (surv.disposition === 'needs_food' && this.saveData.player.inventory.food < surv.demandAmount) {
        return { ok: false, message: `Need ${surv.demandAmount} Provisions to feed ${surv.name}.` };
      }
      if (surv.disposition === 'needs_medicine' && this.saveData.player.inventory.medicine < surv.demandAmount) {
        return { ok: false, message: `Need ${surv.demandAmount} Medical Supplies for ${surv.name}.` };
      }

      // 50% chance the survivor turns down a voluntary offer to join your crew
      if (!rollCrewOfferAccepted('accept', this.rand)) {
        surv.offerRefused = true;
        this.callbacks.onSaveUpdate(this.getSaveSnapshot());
        this.emitHud();
        return {
          ok: false,
          message: `${surv.name} turned down your offer to join your crew! You can force them aboard instead or leave them.`,
        };
      }

      if (surv.disposition === 'needs_food') {
        this.saveData.player.inventory.food -= surv.demandAmount;
      } else if (surv.disposition === 'needs_medicine') {
        this.saveData.player.inventory.medicine -= surv.demandAmount;
      }
    }

    const forced = mode === 'force';
    surv.resolved = true;
    const newCrew = this.survivorToCrew(surv, forced);
    this.saveData.player.crew.push(newCrew);
    if (forced) {
      this.shiftReputation(-6);
    } else {
      this.saveData.stats.survivorsRescued++;
      this.shiftReputation(4);
      this.saveData.player.crew.forEach((c) => (c.morale = Math.min(100, c.morale + 4)));
    }
    this.rebuildPlayerShipMesh();
    this.addLog(
      forced ? 'Castaway Impressed' : 'Survivor Recruited',
      `${newCrew.name} was ${forced ? 'forced into service' : 'rescued and signed aboard'} from ${entry.data.name}.`
    );
    this.callbacks.onSaveUpdate(this.getSaveSnapshot());
    this.emitHud();
    return {
      ok: true,
      message: forced
        ? `${newCrew.name} was forced aboard under protest — cannot refuse (-6 Rep).`
        : `${newCrew.name} agreed to join your crew! (+4 Rep)`,
    };
  }

  private survivorToCrew(s: WreckSurvivor, forced = false): CrewMember {
    return {
      id: s.id,
      name: s.name,
      origin: forced ? 'Impressed Captive' : 'Rescued Castaway',
      role: 'sailor',
      health: 82,
      morale: forced ? 34 : 84,
      loyalty: forced ? 24 : 82,
      forced,
      xp: 0,
      condition: 'healthy',
      skills: { ...s.skills },
      coatColor: forced ? '#4b3634' : '#3c5468',
      hatStyle: 'bandana',
    };
  }

  // --- Trading, Merchant Interactions, Crown Fleet & Piracy ---

  public tradeWithMerchant(
    merchantId: string,
    mode: 'buy' | 'sell',
    resourceId: ResourceId,
    quantity: number
  ): { ok: boolean; message: string } {
    const entry = this.merchants.get(merchantId);
    if (!entry) return { ok: false, message: 'Vessel is no longer alongside.' };

    const res = executeTrade(
      mode,
      resourceId,
      quantity,
      this.saveData.player.gold,
      this.saveData.player.inventory,
      this.saveData.player.upgrades,
      entry.data,
      this.saveData.reputation
    );

    if (!res.ok) {
      return { ok: false, message: res.error || 'Trade could not be completed.' };
    }

    this.saveData.player.gold = res.playerGold;
    this.saveData.player.inventory = res.playerInventory;
    entry.data.gold = res.merchantGold;
    entry.data.stock = res.merchantStock;
    this.saveData.stats.tradesCompleted++;
    this.saveData.stats.peakGold = Math.max(this.saveData.stats.peakGold, this.saveData.player.gold);
    this.sound.playCoinChime();

    this.addLog(
      `Traded with ${entry.data.name}`,
      `${mode === 'buy' ? 'Purchased' : 'Sold'} ${quantity} ${RESOURCE_DEFS[resourceId].name} for ${res.totalPrice} gold.`
    );
    this.flushImmediateSave();
    this.emitHud();
    return {
      ok: true,
      message: `${mode === 'buy' ? 'Bought' : 'Sold'} ${quantity} ${RESOURCE_DEFS[resourceId].name} for ${res.totalPrice} gold.`,
    };
  }

  public hireMerchantCrew(merchantId: string, crewId: string): { ok: boolean; message: string } {
    const entry = this.merchants.get(merchantId);
    if (!entry) return { ok: false, message: 'Vessel unavailable.' };
    const policy = getMerchantReputationBehavior(this.saveData.reputation, entry.data.isCrown, entry.data);
    if (!policy.willTrade) {
      return { ok: false, message: policy.refusalReason || 'Refuses to sign crew with you.' };
    }

    const idx = entry.data.hireableCrew.findIndex((c) => c.id === crewId);
    if (idx === -1) return { ok: false, message: 'Sailor is no longer available.' };

    const cap = getMaxCrewCapacity(this.saveData.player.upgrades);
    if (this.saveData.player.crew.length >= cap) {
      return { ok: false, message: `Crew capacity full (${cap} max).` };
    }

    const hireCost = 45;
    if (this.saveData.player.gold < hireCost) {
      return { ok: false, message: `Hiring a trained sailor costs ${hireCost} gold.` };
    }

    const hired = entry.data.hireableCrew.splice(idx, 1)[0];
    this.saveData.player.gold -= hireCost;
    entry.data.gold += hireCost;
    this.saveData.player.crew.push(hired);
    this.rebuildPlayerShipMesh();
    this.sound.playShipBell();
    this.addLog('Crew Hired', `Signed ${hired.name} (${hired.origin}) aboard from ${entry.data.name}.`);
    this.flushImmediateSave();
    this.emitHud();
    return { ok: true, message: `Hired ${hired.name} for ${hireCost} gold.` };
  }

  public interactWithInnocentVessel(
    merchantId: string,
    action: 'demand'
  ): { ok: boolean; message: string; triggeredCombat?: boolean } {
    const entry = this.merchants.get(merchantId);
    if (!entry) return { ok: false, message: 'Vessel is no longer within hailing range.' };
    const m = entry.data;
    void action;

    // Demand Tribute
    if (m.robbed) {
      return { ok: false, message: `${m.name} has already been stripped of valuables.` };
    }
    const playerPower =
      this.saveData.player.upgrades.cannonCount * 24 +
      this.saveData.player.crew.length * 4 +
      this.saveData.player.upgrades.hullTier * 20;
    const reaction = decideInnocentReaction(m, playerPower, this.rand);
    this.shiftReputation(-12);

    if (reaction === 'surrender') {
      const tribute = Math.max(15, Math.round(m.gold * 0.25));
      m.gold -= tribute;
      m.robbed = true;
      m.surrenderedToPlayer = true;
      this.grantLoot(tribute, { food: 4, water: 4 });
      this.sound.playCoinChime();
      this.addLog('Extorted Tribute', `Forced ${m.name} to yield ${tribute} gold tribute (-12 Reputation).`);
      this.callbacks.onSaveUpdate(this.getSaveSnapshot());
      this.emitHud();
      return { ok: true, message: `${m.captainName} struck colors and yielded ${tribute} gold! (-12 Rep)` };
    } else if (reaction === 'flee') {
      m.fleeingFromPlayer = true;
      m.fleeTimer = 45;
      this.callbacks.onSaveUpdate(this.getSaveSnapshot());
      this.emitHud();
      return { ok: true, message: `${m.name} refused your demand and crowded all canvas to flee! (-12 Rep)` };
    } else {
      this.attackInnocentVessel(merchantId);
      return { ok: false, message: `${m.name} ran out their guns to defend themselves!`, triggeredCombat: true };
    }
  }

  public attemptRobbery(merchantId: string): {
    outcome: 'surrender' | 'fight';
    message: string;
  } {
    const entry = this.merchants.get(merchantId);
    if (!entry) return { outcome: 'fight', message: 'Vessel out of reach.' };
    const m = entry.data;
    const playerPower =
      this.saveData.player.upgrades.cannonCount * 24 +
      this.saveData.player.crew.length * 4 +
      this.saveData.player.upgrades.hullTier * 20;
    const reaction = m.surrenderedToPlayer
      ? 'surrender'
      : decideInnocentReaction(m, playerPower * 1.15, this.rand);

    if (reaction === 'surrender') {
      m.surrenderedToPlayer = true;
      return {
        outcome: 'surrender',
        message: `${m.captainName} surrendered the hold! Choose exactly what gold and cargo to seize.`,
      };
    }

    this.attackInnocentVessel(merchantId);
    return {
      outcome: 'fight',
      message: `${m.name} refused to yield and opened fire! Defeat or cripple them to seize their cargo.`,
    };
  }

  public commitRobberySteal(
    merchantId: string,
    goldTaken: number,
    stolenItems: Partial<Inventory>
  ): { ok: boolean; message: string } {
    const entry = this.merchants.get(merchantId);
    if (!entry) return { ok: false, message: 'Target ship is gone.' };
    const m = entry.data;

    const cleanGold = Math.max(0, Math.min(m.gold, Math.floor(goldTaken)));
    const takenMap: Partial<Inventory> = {};
    for (const [k, qty] of Object.entries(stolenItems) as [ResourceId, number][]) {
      const avail = m.stock[k] || 0;
      const take = Math.max(0, Math.min(avail, Math.floor(qty || 0)));
      if (take > 0) {
        m.stock[k] = avail - take;
        takenMap[k] = take;
      }
    }

    m.gold -= cleanGold;
    m.robbed = true;
    m.fleeingFromPlayer = true;
    m.fleeTimer = 60;
    const added = this.grantLoot(cleanGold, takenMap);
    this.shiftReputation(-18);
    this.saveData.stats.shipsRobbed++;
    this.sound.playCoinChime();

    this.addLog(
      `Plundered ${m.name}`,
      `Committed piracy against ${m.name}, taking ${cleanGold} gold${added.length ? ` and ${added.join(', ')}` : ''}. (-18 Reputation)`
    );
    this.callbacks.onSaveUpdate(this.getSaveSnapshot());
    this.emitHud();
    return {
      ok: true,
      message: `Plundered ${cleanGold} gold${added.length ? ` & ${added.join(', ')}` : ''}! (-18 Reputation)`,
    };
  }

  public attackInnocentVessel(merchantId: string): void {
    const entry = this.merchants.get(merchantId);
    if (!entry || entry.data.sunk) return;
    const m = entry.data;
    m.hostileToPlayer = true;
    this.shiftReputation(-16);

    this.engageCombatEnemy({ kind: 'merchant', id: m.id }, `Engaging ${m.name} in naval combat!`, true);
    this.sound.playAlertBell();
    this.pushNotification(`Opened fire on ${m.name}! (-16 Reputation)`);
    this.callbacks.onSaveUpdate(this.getSaveSnapshot());
    this.emitHud();
  }

  public resolveCrownHail(
    merchantId: string,
    choice: 'surrender' | 'bribe' | 'fight'
  ): { ok: boolean; message: string } {
    const entry = this.merchants.get(merchantId);
    if (!entry) return { ok: false, message: 'Crown patrol is gone.' };
    const m = entry.data;

    if (choice === 'surrender') {
      const fine = Math.round(this.saveData.player.gold * 0.45);
      this.saveData.player.gold = Math.max(0, this.saveData.player.gold - fine);
      this.shiftReputation(14);
      this.crownHailCooldown = 90;
      this.addLog('Paid Crown Pardon', `Submitted to ${m.name}, paying ${fine} gold prize fine (+14 Reputation).`);
      this.pushNotification(`Paid ${fine} gold Crown fine (+14 Reputation).`);
      this.callbacks.onSaveUpdate(this.getSaveSnapshot());
      this.emitHud();
      return { ok: true, message: `Paid ${fine} gold Crown fine (+14 Reputation).` };
    }

    if (choice === 'bribe') {
      const bribe = 140;
      if (this.saveData.player.gold < bribe) {
        return { ok: false, message: `Need ${bribe} gold to bribe a Crown captain.` };
      }
      this.saveData.player.gold -= bribe;
      this.crownHailCooldown = 80;
      this.pushNotification(`Bribed ${m.captainName} to look the other way (-${bribe} gold).`);
      this.callbacks.onSaveUpdate(this.getSaveSnapshot());
      this.emitHud();
      return { ok: true, message: `Paid ${bribe} gold hush coin.` };
    }

    this.attackInnocentVessel(merchantId);
    return { ok: true, message: `Refused Crown arrest — engaging ${m.name}!` };
  }

  // --- Pirate Faction Diplomacy & Contraband Trading ---

  public tradeWithPirate(
    pirateId: string,
    mode: 'buy' | 'sell',
    resourceId: ResourceId,
    quantity: number
  ): { ok: boolean; message: string } {
    const entry = this.pirates.get(pirateId);
    if (!entry) return { ok: false, message: 'Pirate ship is no longer nearby.' };
    const pir = entry.data;
    const faction = this.saveData.factions[pir.factionId];

    if (!canTradeWithPirate(faction, pir, this.saveData.day, this.saveData.reputation)) {
      return { ok: false, message: `${PIRATE_FACTIONS[pir.factionId].shortName} distrust you too much to trade.` };
    }

    const qty = Math.max(1, Math.floor(quantity));
    const unitPrice = Math.max(
      2,
      Math.round(RESOURCE_DEFS[resourceId].basePrice * (mode === 'buy' ? 0.92 : 0.78))
    );
    const totalPrice = unitPrice * qty;

    if (mode === 'buy') {
      const avail = pir.loot[resourceId] || 0;
      if (avail < qty) return { ok: false, message: 'Pirate hold lacks enough stock.' };
      if (this.saveData.player.gold < totalPrice) return { ok: false, message: 'Insufficient gold.' };
      const cap = getCargoCapacity(this.saveData.player.upgrades);
      if (getCargoWeight(this.saveData.player.inventory) + RESOURCE_DEFS[resourceId].weight * qty > cap + 0.01) {
        return { ok: false, message: 'Cargo hold full.' };
      }
      this.saveData.player.gold -= totalPrice;
      this.saveData.player.inventory[resourceId] = (this.saveData.player.inventory[resourceId] || 0) + qty;
      pir.loot[resourceId] = avail - qty;
      pir.gold += totalPrice;
    } else {
      const pAvail = this.saveData.player.inventory[resourceId] || 0;
      if (pAvail < qty) return { ok: false, message: 'You do not carry that quantity.' };
      if (pir.gold < totalPrice) return { ok: false, message: 'Pirate lacks coin to buy more.' };
      this.saveData.player.gold += totalPrice;
      this.saveData.player.inventory[resourceId] = pAvail - qty;
      pir.loot[resourceId] = (pir.loot[resourceId] || 0) + qty;
      pir.gold -= totalPrice;
    }

    this.saveData.factions = shiftFactionStanding(this.saveData.factions, pir.factionId, 2);
    this.sound.playCoinChime();
    this.callbacks.onSaveUpdate(this.getSaveSnapshot());
    this.emitHud();
    return { ok: true, message: `${mode === 'buy' ? 'Bought' : 'Sold'} ${qty} ${RESOURCE_DEFS[resourceId].name} for ${totalPrice} gold.` };
  }

  public forgePirateAlliance(pirateId: string): { ok: boolean; message: string } {
    const entry = this.pirates.get(pirateId);
    if (!entry) return { ok: false, message: 'Pirate ship unavailable.' };
    const pir = entry.data;
    const tribute = 160;
    if (this.saveData.player.gold < tribute) {
      return { ok: false, message: `Forging a 4-day Corsair Pact requires ${tribute} gold tribute.` };
    }
    this.saveData.player.gold -= tribute;
    pir.gold += tribute;
    this.saveData.factions = formTemporaryPirateAlliance(
      this.saveData.factions,
      pir.factionId,
      this.saveData.day,
      4
    );
    this.sound.playShipBell();
    this.addLog(
      `Allied with ${PIRATE_FACTIONS[pir.factionId].shortName}`,
      `Paid ${tribute} gold tribute to seal a 4-day pact with ${PIRATE_FACTIONS[pir.factionId].name}.`
    );
    this.pushNotification(`Allied with ${PIRATE_FACTIONS[pir.factionId].shortName} for 4 days!`);
    this.callbacks.onSaveUpdate(this.getSaveSnapshot());
    this.emitHud();
    return { ok: true, message: `Sealed a 4-day pact with ${PIRATE_FACTIONS[pir.factionId].shortName}!` };
  }

  // --- Ship Upgrades (Separated Hull vs Cannons), Flag & Manual Repairs ---

  public purchaseHullUpgrade(upgradeId: string): { ok: boolean; message: string } {
    const opt = HULL_UPGRADE_CATALOG.find((u) => u.id === upgradeId);
    if (!opt) return { ok: false, message: 'Upgrade not found.' };
    if (opt.isPurchased(this.saveData.player.upgrades)) {
      return { ok: false, message: 'Already installed.' };
    }
    if (!opt.isUnlocked(this.saveData.player.upgrades)) {
      return { ok: false, message: `Locked — ${opt.unlockRequirementText}.` };
    }
    if (!canAffordCosts(this.saveData.player.gold, this.saveData.player.inventory, opt.goldCost, opt.resourceCost)) {
      return { ok: false, message: 'Insufficient gold or construction materials.' };
    }

    const next = deductCosts(
      this.saveData.player.gold,
      this.saveData.player.inventory,
      opt.goldCost,
      opt.resourceCost
    );
    this.saveData.player.gold = next.gold;
    this.saveData.player.inventory = next.inventory;
    this.saveData.player.upgrades = opt.apply(this.saveData.player.upgrades);
    this.saveData.player.crew.forEach((c) => (c.morale = Math.min(100, c.morale + 5)));

    this.rebuildPlayerShipMesh();
    this.sound.playShipBell();
    this.addLog('Ship Refit Completed', `Constructed ${opt.name}.`);
    this.pushNotification(`Completed refit: ${opt.name}`);
    this.flushImmediateSave();
    this.emitHud();
    return { ok: true, message: `Installed ${opt.name}!` };
  }

  public installOrSwitchWeapon(weaponType: WeaponType): { ok: boolean; message: string } {
    const spec = WEAPON_SPECS[weaponType];
    if (!spec || weaponType === 'none') return { ok: false, message: 'Invalid cannon class.' };

    const u = this.saveData.player.upgrades;
    if (u.hullTier < spec.minHullTier) {
      return { ok: false, message: `Requires Hull Tier ${spec.minHullTier} or higher.` };
    }

    const maxSlots = getMaxCannonSlots(u);
    const switchingType = u.weaponType !== 'none' && u.weaponType !== weaponType;

    if (!switchingType && u.cannonCount >= maxSlots) {
      return { ok: false, message: `All ${maxSlots} gun ports filled! Expand hull or add decks.` };
    }

    const cost = switchingType
      ? { goldCost: spec.goldCost, materialCost: spec.materialCost }
      : getInstallCannonCost(weaponType);

    if (!canAffordCosts(this.saveData.player.gold, this.saveData.player.inventory, cost.goldCost, cost.materialCost)) {
      return { ok: false, message: `Insufficient gold or ordnance materials for ${spec.name}.` };
    }

    const next = deductCosts(
      this.saveData.player.gold,
      this.saveData.player.inventory,
      cost.goldCost,
      cost.materialCost
    );
    this.saveData.player.gold = next.gold;
    this.saveData.player.inventory = next.inventory;
    this.saveData.player.upgrades = {
      ...u,
      weaponType,
      cannonCount: switchingType ? Math.max(1, Math.min(maxSlots, u.cannonCount)) : u.cannonCount + 1,
    };

    this.rebuildPlayerShipMesh();
    this.sound.playCannonFire();
    this.addLog(
      'Ordnance Mounted',
      `Fitted ${spec.name} (${this.saveData.player.upgrades.cannonCount}/${maxSlots} ports).`
    );
    this.pushNotification(`Mounted ${spec.name}!`);
    this.flushImmediateSave();
    this.emitHud();
    return { ok: true, message: `Mounted ${spec.name}!` };
  }

  public upgradeCannonStat(stat: keyof CannonUpgrades): { ok: boolean; message: string } {
    const cu = this.saveData.player.upgrades.cannonUpgrades;
    const currentLvl = cu[stat] || 1;
    const cost = getCannonStatUpgradeCost(stat, currentLvl);
    if (cost.maxReached) return { ok: false, message: 'Maximum level reached.' };

    if (!canAffordCosts(this.saveData.player.gold, this.saveData.player.inventory, cost.goldCost, cost.materialCost)) {
      return { ok: false, message: 'Insufficient gold or ordnance materials.' };
    }

    const next = deductCosts(
      this.saveData.player.gold,
      this.saveData.player.inventory,
      cost.goldCost,
      cost.materialCost
    );
    this.saveData.player.gold = next.gold;
    this.saveData.player.inventory = next.inventory;
    this.saveData.player.upgrades = {
      ...this.saveData.player.upgrades,
      cannonUpgrades: {
        ...cu,
        [stat]: currentLvl + 1,
      },
    };
    this.sound.playShipBell();
    this.flushImmediateSave();
    this.emitHud();
    return { ok: true, message: `Upgraded cannon ${stat.replace('Lvl', '')} to Level ${currentLvl + 1}!` };
  }

  public startManualRepair(section: RepairPriority): { ok: boolean; message: string } {
    if (this.saveData.activeRepairJob) {
      return {
        ok: false,
        message: `Already repairing ${this.saveData.activeRepairJob.section.toUpperCase()} (${Math.ceil(this.saveData.activeRepairJob.remainingTime)}s left).`,
      };
    }

    const perf = computeCrewPerformance(this.saveData.player.crew, this.saveData.player.upgrades);
    const plan = computeManualRepairPlan(
      section,
      this.saveData.player.condition,
      this.saveData.player.upgrades,
      perf.repairSpeedFactor
    );

    if (plan.damageMissing <= 0) {
      return { ok: false, message: `${section.toUpperCase()} is already at 100%.` };
    }

    if (!canAffordCosts(this.saveData.player.gold, this.saveData.player.inventory, 0, plan.materials)) {
      return { ok: false, message: 'Insufficient repair materials in your cargo hold.' };
    }

    const next = deductCosts(this.saveData.player.gold, this.saveData.player.inventory, 0, plan.materials);
    this.saveData.player.inventory = next.inventory;
    this.saveData.activeRepairJob = createRepairJob(plan);
    this.saveData.player.repairPriority = section;
    this.sound.playShipBell();
    this.pushNotification(`Manual repair started: ${section.toUpperCase()} (${plan.durationSec}s).`);
    this.flushImmediateSave();
    this.emitHud();
    return { ok: true, message: `Started manual repair on ${section.toUpperCase()} (${plan.durationSec}s).` };
  }

  public updateCustomFlag(cfg: CustomFlagConfig): { ok: boolean; message: string } {
    this.saveData.customFlag = { ...cfg };
    this.rebuildPlayerShipMesh();
    this.syncFleetMeshes(true);
    this.sound.playPageTurn();
    this.flushImmediateSave();
    this.emitHud();
    return {
      ok: true,
      message:
        this.saveData.fleet.length > 0
          ? 'Masthead flag & sails updated across your flagship & fleet!'
          : 'Masthead flag & sails updated!',
    };
  }

  public setPlayerShipName(name: string): { ok: boolean; message: string } {
    if (!isValidPreChosenShipName(name)) {
      return { ok: false, message: 'Choose a valid ship name from the maritime registry.' };
    }
    this.saveData.player.shipName = name;
    this.sound.playPageTurn();
    this.flushImmediateSave();
    this.emitHud();
    return { ok: true, message: `Vessel officially registered as "${name}".` };
  }

  // --- Fishing System, Islands, Settlements, Treasure Maps & First-Person Exploration ---

  public buyFishingGear(gearId: FishingGearId): { ok: boolean; message: string } {
    if (gearId === 'none') return { ok: false, message: 'No fishing rig selected.' };
    const spec = FISHING_GEAR_SPECS[gearId];
    if (!spec) return { ok: false, message: 'Unknown fishing rig.' };
    if (this.saveData.player.upgrades.hullTier < spec.minHullTier) {
      return { ok: false, message: `Requires Hull Tier ${spec.minHullTier} or higher.` };
    }
    if (this.saveData.player.upgrades.fishingGear === gearId) {
      return { ok: false, message: `${spec.name} is already rigged on your vessel.` };
    }
    if (this.saveData.player.gold < spec.cost) {
      return { ok: false, message: `Insufficient gold (${spec.cost}g required).` };
    }
    this.saveData.player.gold -= spec.cost;
    this.saveData.player.upgrades = {
      ...this.saveData.player.upgrades,
      fishingGear: gearId,
    };
    this.rebuildPlayerShipMesh();
    this.sound.playShipBell();
    this.addLog('Rigged Fishing Gear', `Fitted ${spec.name} aboard ${this.saveData.player.shipName}.`);
    this.pushNotification(`${spec.name} rigged on your vessel!`);
    this.flushImmediateSave();
    this.emitHud();
    return { ok: true, message: `Rigged ${spec.name}!` };
  }

  public convertFishToFood(kind: 'fishCatch' | 'rareFish', qty: number): { ok: boolean; message: string } {
    const res = convertFishToProvisions(
      this.saveData.player.inventory,
      kind === 'fishCatch' ? qty : 0,
      kind === 'rareFish' ? qty : 0
    );
    if (res.foodAdded <= 0) {
      return { ok: false, message: 'No caught fish of that kind in hold to salt & preserve.' };
    }
    this.sound.playCoinChime();
    const msg = `Salted ${res.convertedRegular + res.convertedRare} fish into +${res.foodAdded} Provisions!`;
    this.pushNotification(msg);
    this.flushImmediateSave();
    this.emitHud();
    return { ok: true, message: msg };
  }

  /** Charges the gold fee for casting the rod. Called before every cast. */
  public payFishingCastFee(target: { kind: 'sea_wildlife' | 'monster_carcass'; id: string } | null): { ok: boolean; cost: number; message: string } {
    let tier: number | null = null;
    if (target?.kind === 'monster_carcass') {
      const m = this.monsters.get(target.id);
      tier = MONSTER_FISH_TIER[m?.data.size ?? 'medium'] ?? 5;
    } else if (target?.kind === 'sea_wildlife') {
      const w = this.wildlife.get(target.id);
      tier = WILDLIFE_FISH_TIER[w?.data.species ?? ''] ?? 2;
    }
    const cost = getFishingCastCost(tier);
    if (this.saveData.player.gold < cost) {
      return { ok: false, cost, message: `You need ${cost} gold to bait and cast the rod.` };
    }
    this.saveData.player.gold -= cost;
    this.emitHud();
    return { ok: true, cost, message: `Paid ${cost}g to cast.` };
  }

  public completeManualFishingCatch(spec: FishingCatchSpec): { ok: boolean; message: string } {
    if (this.currentBiome === 'deep') {
      return {
        ok: false,
        message: 'Abyssal Deep waters hold no ordinary fish—hunt sea monsters or sail toward shallower seas.',
      };
    }
    this.sound.playCatchFish();
    const gotSalt = this.currentBiome === 'tropical' || this.rand() < 0.45 ? 1 : 0;
    if (spec.isRare) {
      this.grantLoot(0, { rareFish: 1, salt: gotSalt });
    } else {
      this.grantLoot(0, { fishCatch: 1, salt: gotSalt });
    }
    const xpRes = grantCrewRoleXp(this.saveData.player.crew, ['fisherman', 'sailor'], 6);
    this.saveData.player.crew = xpRes.crew;
    const msg = gotSalt
      ? `Landed ${spec.species} (${spec.rarity}) & +1 Sea Salt!`
      : `Landed ${spec.species} (${spec.rarity})!`;
    this.pushNotification(msg);
    this.addLog('Fishing Catch', `Hooked a ${spec.rarity.toLowerCase()} ${spec.species} in ${this.currentBiome} waters.`);
    this.flushImmediateSave();
    this.emitHud();
    return { ok: true, message: msg };
  }

  public harvestNearbyFishingTarget(
    kind: 'monster_carcass' | 'sea_wildlife',
    id: string
  ): { ok: boolean; message: string; foodAdded: number; saltAdded: number } {
    if (kind === 'monster_carcass') {
      const mEntry = this.monsters.get(id);
      if (!mEntry) {
        return { ok: false, message: 'The sea monster carcass has sunk beneath the waves.', foodAdded: 0, saltAdded: 0 };
      }
      const res = fishNearMonsterCarcass(mEntry.data, this.saveData.player.inventory);
      if (!res.harvested) {
        return { ok: false, message: 'No harvestable carcass remains.', foodAdded: 0, saltAdded: 0 };
      }
      this.sound.playCatchFish();
      this.sound.playCoinChime();
      const xpRes = grantCrewRoleXp(this.saveData.player.crew, ['fisherman', 'sailor'], 14);
      this.saveData.player.crew = xpRes.crew;
      const msg = `Hauled ${mEntry.data.name} carcass: +${res.foodAdded} Provisions & +${res.saltAdded} Sea Salt!`;
      this.pushNotification(msg);
      this.addLog('Monster Carcass Harvested', msg);
      this.flushImmediateSave();
      this.emitHud();
      return { ok: true, message: msg, foodAdded: res.foodAdded, saltAdded: res.saltAdded };
    }

    const wEntry = this.wildlife.get(id);
    if (!wEntry) {
      return { ok: false, message: 'The marine shoal swam out of reach.', foodAdded: 0, saltAdded: 0 };
    }
    const res = fishNearMarineWildlife(wEntry.data, this.saveData.player.inventory);
    if (!res.harvested) {
      return { ok: false, message: 'Nothing left to haul from this creature.', foodAdded: 0, saltAdded: 0 };
    }
    if (wEntry.data.harvested) {
      wEntry.built.root.visible = false;
    }
    this.sound.playCatchFish();
    const xpRes = grantCrewRoleXp(this.saveData.player.crew, ['fisherman', 'sailor'], 8);
    this.saveData.player.crew = xpRes.crew;
    const label = WILDLIFE_SPECS[wEntry.data.species]?.label || 'Sea Catch';
    const msg = `Fished ${label}: +${res.foodAdded} Provisions & +${res.saltAdded} Sea Salt!`;
    this.pushNotification(msg);
    this.addLog('Marine Catch', msg);
    this.flushImmediateSave();
    this.emitHud();
    return { ok: true, message: msg, foodAdded: res.foodAdded, saltAdded: res.saltAdded };
  }

  private grantTreasureFragments(count: number, sourceLabel: string): void {
    const candidateIslands = Array.from(this.islands.values()).map((e) => e.data);
    const res = addTreasureFragments(this.saveData, count, candidateIslands, this.rand);
    if (res.assembledMaps.length > 0) {
      for (const tm of res.assembledMaps) {
        this.recordMarker({
          id: tm.id,
          kind: 'treasure',
          name: tm.title,
          x: tm.targetX,
          z: tm.targetZ,
          status: `X Marks the Spot (${tm.islandName})`,
        });
        this.pushNotification(`Assembled Treasure Map: ${tm.title} on ${tm.islandName}!`);
        this.addLog('Treasure Map Assembled', `Completed "${tm.title}" from fragments found at ${sourceLabel}. Marked X on ${tm.islandName}!`);
      }
    } else {
      this.pushNotification(`Found Treasure Map Fragment (${res.newFragmentsCount}/3) at ${sourceLabel}!`);
    }
  }

  public getKnownIslands(): IslandData[] {
    return Array.from(this.islands.values()).map((e) => e.data);
  }

  public getSettlementById(settlementId: string): IslandSettlementData | null {
    for (const isl of this.islands.values()) {
      if (isl.data.settlement && isl.data.settlement.id === settlementId) {
        return isl.data.settlement;
      }
    }
    return null;
  }

  public tradeWithSettlement(
    settlementId: string,
    mode: 'buy' | 'sell',
    resourceId: ResourceId,
    quantity: number
  ): { ok: boolean; message: string } {
    const st = this.getSettlementById(settlementId);
    if (!st) return { ok: false, message: 'Settlement unreachable.' };
    if (st.faction === 'abandoned') {
      return { ok: false, message: 'No merchants remain in this abandoned outpost.' };
    }
    const qty = Math.max(1, Math.floor(quantity));
    const unitPrice =
      mode === 'buy'
        ? Math.max(2, Math.round((RESOURCE_DEFS[resourceId]?.basePrice ?? 12) * 1.08))
        : Math.max(2, Math.round((RESOURCE_DEFS[resourceId]?.basePrice ?? 12) * 0.68));
    const total = unitPrice * qty;

    if (mode === 'buy') {
      const avail = st.stock[resourceId] || 0;
      if (avail < qty) return { ok: false, message: 'Settlement lacks enough stock.' };
      if (this.saveData.player.gold < total) return { ok: false, message: 'Insufficient gold.' };
      const cap = getCargoCapacity(this.saveData.player.upgrades);
      if (getCargoWeight(this.saveData.player.inventory) + (RESOURCE_DEFS[resourceId]?.weight ?? 1) * qty > cap + 0.01) {
        return { ok: false, message: 'Cargo hold full.' };
      }
      this.saveData.player.gold -= total;
      this.saveData.player.inventory[resourceId] = (this.saveData.player.inventory[resourceId] || 0) + qty;
      st.stock[resourceId] = avail - qty;
      st.gold += total;
    } else {
      const have = this.saveData.player.inventory[resourceId] || 0;
      if (have < qty) return { ok: false, message: 'Not enough cargo in hold.' };
      if (st.gold < total) return { ok: false, message: 'Settlement treasury cannot cover that sum.' };
      this.saveData.player.gold += total;
      this.saveData.player.inventory[resourceId] = have - qty;
      st.stock[resourceId] = (st.stock[resourceId] || 0) + qty;
      st.gold -= total;
    }

    this.saveData.stats.tradesCompleted++;
    this.saveData.stats.peakGold = Math.max(this.saveData.stats.peakGold, this.saveData.player.gold);
    this.sound.playCoinChime();
    this.flushImmediateSave();
    this.emitHud();
    return {
      ok: true,
      message: `${mode === 'buy' ? 'Purchased' : 'Sold'} ${qty} ${RESOURCE_DEFS[resourceId].name} for ${total} gold.`,
    };
  }

  public hireSettlementCrew(settlementId: string, crewId: string): { ok: boolean; message: string } {
    const st = this.getSettlementById(settlementId);
    if (!st) return { ok: false, message: 'Settlement unavailable.' };
    const idx = st.hireableCrew.findIndex((c) => c.id === crewId);
    if (idx === -1) return { ok: false, message: 'Sailor already signed elsewhere.' };
    const cap = getMaxCrewCapacity(this.saveData.player.upgrades);
    if (this.saveData.player.crew.length >= cap) {
      return { ok: false, message: `Crew quarters full (${cap} max).` };
    }
    const cost = 48;
    if (this.saveData.player.gold < cost) {
      return { ok: false, message: `Signing a sailor costs ${cost} gold.` };
    }
    const hired = st.hireableCrew.splice(idx, 1)[0];
    this.saveData.player.gold -= cost;
    st.gold += cost;
    this.saveData.player.crew.push(hired);
    this.rebuildPlayerShipMesh();
    this.sound.playShipBell();
    this.addLog('Crew Hired Ashore', `Signed ${hired.name} at ${st.name}.`);
    this.flushImmediateSave();
    this.emitHud();
    return { ok: true, message: `Hired ${hired.name} for ${cost} gold!` };
  }

  public hearSettlementRumor(settlementId: string): { ok: boolean; message: string } {
    const st = this.getSettlementById(settlementId);
    if (!st) return { ok: false, message: 'Settlement unavailable.' };
    if (st.rumorHeard) return { ok: true, message: st.rumorText };
    if (this.saveData.player.gold < st.rumorCost) {
      return { ok: false, message: `Need ${st.rumorCost} gold for tavern rumors.` };
    }
    this.saveData.player.gold -= st.rumorCost;
    st.rumorHeard = true;
    // Reveal nearest undiscovered island or grant 1 treasure map fragment
    this.grantTreasureFragments(1, `${st.name} Tavern`);
    this.sound.playPageTurn();
    this.addLog(`Tavern Rumor (${st.name})`, st.rumorText);
    this.flushImmediateSave();
    this.emitHud();
    return { ok: true, message: st.rumorText };
  }

  public completeSettlementErrand(settlementId: string): { ok: boolean; message: string } {
    const st = this.getSettlementById(settlementId);
    if (!st || !st.errand) return { ok: false, message: 'No errand posted here.' };
    if (st.errand.completed) return { ok: false, message: 'Errand already fulfilled.' };
    const req = st.errand;
    const have = Math.floor(this.saveData.player.inventory[req.resourceId] || 0);
    if (have < req.requiredQty) {
      return {
        ok: false,
        message: `Need ${req.requiredQty} ${RESOURCE_DEFS[req.resourceId]?.name || req.resourceId} (have ${have}).`,
      };
    }
    this.saveData.player.inventory[req.resourceId] = have - req.requiredQty;
    req.completed = true;
    if (!this.saveData.completedErrandIds) this.saveData.completedErrandIds = [];
    if (!this.saveData.completedErrandIds.includes(req.id)) {
      this.saveData.completedErrandIds.push(req.id);
    }
    this.saveData.player.gold += req.rewardGold;
    this.shiftReputation(req.rewardReputation);
    this.sound.playCoinChime();
    this.addLog(`Errand Completed (${st.name})`, `Delivered ${req.requiredQty} ${RESOURCE_DEFS[req.resourceId].name} for +${req.rewardGold} gold.`);
    this.flushImmediateSave();
    this.emitHud();
    return { ok: true, message: `Delivered cargo! Earned +${req.rewardGold} gold & +${req.rewardReputation} Rep.` };
  }

  public landOnIsland(islandId: string): { ok: boolean; message: string } {
    const entry = this.islands.get(islandId);
    if (!entry) return { ok: false, message: 'Island out of range.' };
    if (this.combat.active) {
      return { ok: false, message: 'Cannot disembark while engaged in naval combat!' };
    }
    const isl = entry.data;
    this.saveData.player.speed = 0;
    this.saveData.player.throttle = 0;
    this.saveData.player.isStopping = true;

    // Step player safely ashore near the dock / beach
    const dirX = isl.x - isl.dockX;
    const dirZ = isl.z - isl.dockZ;
    const dLen = Math.hypot(dirX, dirZ) || 1;
    const landX = isl.dockX + (dirX / dLen) * 6;
    const landZ = isl.dockZ + (dirZ / dLen) * 6;
    this.fps.enterIsland(isl, landX, landZ, this.saveData.player.heading);
    this.lastMouseX = -1;
    this.lastMouseY = -1;
    this.fpsMouseState = { lastX: -1, lastY: -1, skipEvents: 2 };
    this.requestFpsPointerLock();
    this.camera.near = 0.08;
    this.camera.updateProjectionMatrix();
    this.fps.update(0.016, this.keys, this.saveData, true, () => {}, () => {});
    this.fps.syncCameraTransform(this.camera);
    this.renderer.render(this.scene, this.camera);

    if (!this.saveData.discoveredIslandIds) this.saveData.discoveredIslandIds = [];
    if (!this.saveData.discoveredIslandIds.includes(isl.id)) {
      this.saveData.discoveredIslandIds.push(isl.id);
    }
    isl.discovered = true;
    if (isl.controller === 'tribe' && (isl.pirateGuards?.length ?? 0) > 0) {
      const st = this.saveData.tribeStanding?.[isl.id];
      this.pushNotification(
        st === 'allied'
          ? `The ${isl.tribeName ?? 'tribe'} of ${isl.name} greet you as friends.`
          : st === 'hostile'
            ? `The ${isl.tribeName ?? 'tribe'} of ${isl.name} remember you and are hostile!`
            : `The ${isl.tribeName ?? 'tribe'} hold ${isl.name} and guard their sacred cache. Approach and press [E] to ally, or attack.`
      );
    }
    this.recordMarker({
      id: isl.id,
      kind: 'island',
      name: isl.name,
      x: isl.x,
      z: isl.z,
      status: `${isl.archetype.replace('_', ' ')} Island`,
    });
    if (isl.settlement) {
      this.recordMarker({
        id: isl.settlement.id,
        kind: 'settlement',
        name: isl.settlement.name,
        x: isl.settlement.worldX,
        z: isl.settlement.worldZ,
        status: isl.settlement.kind.replace('_', ' '),
      });
    }
    this.sound.playShipBell();
    this.pushNotification(`Disembarked onto ${isl.name}! [1/2/3] Weapons · Move Mouse to Look · [E] Interact`);
    this.flushImmediateSave();
    this.emitHud();
    return { ok: true, message: `Landed on ${isl.name}.` };
  }

  public boardShipFromIsland(): void {
    if (!this.fps.active) return;
    const islandName = this.fps.island?.name || 'the island';
    this.fps.exitIsland();
    this.lastMouseX = -1;
    this.lastMouseY = -1;
    this.camera.near = 0.5;
    this.camera.updateProjectionMatrix();
    this.camYaw = this.saveData.player.heading;
    this.camPitch = 0.28;
    this.updateCamera(1.0);
    this.renderer.render(this.scene, this.camera);
    this.sound.playShipBell();
    this.pushNotification(`Returned aboard ${this.saveData.player.shipName} from ${islandName}.`);
    this.emitHud();
  }

  public switchFpsWeapon(weapon: FpsWeaponId): void {
    if (!this.fps.active) return;
    this.fps.switchWeapon(weapon);
    this.fps.update(0.001, this.keys, this.saveData, true, () => {}, () => {});
    this.fps.syncCameraTransform(this.camera);
    this.renderer.render(this.scene, this.camera);
    this.emitHud();
  }

  public triggerFpsReload(): void {
    if (!this.fps.active) return;
    if (this.fps.triggerReload(this.saveData)) {
      this.sound.playFlintlockReload();
    }
    this.fps.update(0.001, this.keys, this.saveData, true, () => {}, () => {});
    this.fps.syncCameraTransform(this.camera);
    this.renderer.render(this.scene, this.camera);
    this.emitHud();
  }

  public handleFpsPrimaryAction(): void {
    if (!this.fps.active || this.modalOpen) return;
    const islandWildlife = Array.from(this.wildlife.values())
      .map((e) => e.data)
      .filter((a) => !a.dead && Math.hypot(a.x - this.fps.pos.x, a.z - this.fps.pos.z) < 95);
    const islandGuards = Array.from(this.islandPirateGuards.values())
      .map((e) => e.data)
      .filter((g) => g.islandId === this.fps.island?.id && !g.dead);

    const res = this.fps.triggerAttack(islandWildlife, islandGuards);
    if (!res.fired) {
      this.emitHud();
      return;
    }

    if (res.weapon === 'cutlass') {
      this.sound.playCutlassSwing();
    } else if (res.weapon === 'pistol') {
      this.sound.playPistolShot();
    } else {
      this.sound.playMusketShot();
    }

    if (res.hitActor) {
      if (res.hitActor.killable === false) {
        this.fps.setStatus(`${WILDLIFE_SPECS[res.hitActor.species].label} flies clear out of reach.`);
        this.emitHud();
        return;
      }
      if (res.weapon === 'cutlass') this.sound.playCutlassHit();
      const dmgRes = damageWildlifeActor(res.hitActor, res.damage);
      this.worldDamagePopups.push({
        id: `wdmg_${++this.damageBannerSeq}`,
        worldX: res.hitActor.x,
        worldY: res.hitActor.y + 1.4,
        worldZ: res.hitActor.z,
        amount: res.damage,
        partLabel: WILDLIFE_SPECS[res.hitActor.species].label.toUpperCase(),
        targetName: WILDLIFE_SPECS[res.hitActor.species].label,
        source: 'cannon',
        direction: 'dealt',
        critical: res.weapon === 'musket',
        life: 1.5,
        maxLife: 1.5,
      });
      if (dmgRes.killed) {
        this.fps.setStatus(
          res.hitActor.domain === 'air'
            ? `Shot down ${WILDLIFE_SPECS[res.hitActor.species].label}! Watch where it falls to harvest.`
            : `Slain ${WILDLIFE_SPECS[res.hitActor.species].label}! Press [E] to harvest.`
        );
      }
    } else if (res.hitGuard) {
      if (res.weapon === 'cutlass') this.sound.playCutlassHit();
      this.provokeIslandGuards(res.hitGuard);
      const gRes = damageIslandPirateGuard(res.hitGuard, res.damage);
      this.worldDamagePopups.push({
        id: `wdmg_${++this.damageBannerSeq}`,
        worldX: res.hitGuard.x,
        worldY: res.hitGuard.y + 1.6,
        worldZ: res.hitGuard.z,
        amount: res.damage,
        partLabel: res.hitGuard.tribal ? (res.hitGuard.role === 'pistol' ? 'BOWMAN' : 'SPEARMAN') : res.hitGuard.role === 'pistol' ? 'CORSAIR' : 'BUCCANEER',
        targetName: res.hitGuard.name,
        source: 'cannon',
        direction: 'dealt',
        critical: res.weapon === 'musket',
        life: 1.5,
        maxLife: 1.5,
      });
      if (gRes.killed) {
        const remaining = islandGuards.filter(
          (g) => g.chestId === res.hitGuard!.chestId && !g.dead
        ).length;
        if (remaining <= 0) {
          this.fps.setStatus(`Defeated ${res.hitGuard.name}! ${res.hitGuard.tribal ? 'Sacred cache' : 'Pirate chest'} unlocked — press [E] to loot.`);
        } else {
          this.fps.setStatus(`Defeated ${res.hitGuard.name}! ${remaining} guard(s) remain.`);
        }
      }
    }
    this.emitHud();
  }

  /** Attacking a guard turns the whole island's guards hostile toward this player. */
  private provokeIslandGuards(guard: IslandPirateGuardData): void {
    const attitude = getGuardAttitude(guard, this.saveData);
    if (attitude === 'hostile') return;
    if (guard.tribal) {
      if (!this.saveData.tribeStanding) this.saveData.tribeStanding = {};
      const wasAllied = this.saveData.tribeStanding[guard.islandId] === 'allied';
      this.saveData.tribeStanding[guard.islandId] = 'hostile';
      this.shiftReputation(wasAllied ? -14 : -6);
      const tribe = this.fps.island?.tribeName ?? 'tribe';
      this.pushNotification(wasAllied ? `You betrayed the ${tribe}! They attack!` : `The ${tribe} rally against you!`);
    } else {
      if (!this.saveData.islandProvoked) this.saveData.islandProvoked = [];
      if (!this.saveData.islandProvoked.includes(guard.islandId)) this.saveData.islandProvoked.push(guard.islandId);
      this.pushNotification('You betrayed the pirates guarding this island — they attack!');
    }
    this.flushImmediateSave();
  }

  /** [E] on a non-hostile guard: ally with a wary tribe, or take a friendly share of the treasure. */
  private parleyWithGuard(guard: IslandPirateGuardData): void {
    const isl = this.fps.island;
    if (!isl) return;
    const attitude = getGuardAttitude(guard, this.saveData);
    if (attitude === 'hostile') return;

    if (guard.tribal && attitude === 'wary') {
      const giftCost = 20;
      if (this.saveData.player.gold < giftCost) {
        this.fps.setStatus(`The ${isl.tribeName ?? 'tribe'} expect a gift of ${giftCost} gold.`);
        this.pushNotification(`You need ${giftCost} gold as a gift to ally with the ${isl.tribeName ?? 'tribe'}.`);
        this.emitHud();
        return;
      }
      this.saveData.player.gold -= giftCost;
      if (!this.saveData.tribeStanding) this.saveData.tribeStanding = {};
      this.saveData.tribeStanding[isl.id] = 'allied';
      this.shiftReputation(10);
      this.grantLoot(0, { food: 14, salt: 2 });
      this.sound.playCoinChime();
      this.pushNotification(`The ${isl.tribeName ?? 'tribe'} welcome you as an ally! +10 Reputation, and they share provisions.`);
      this.addLog('Tribal Alliance', `Allied with the ${isl.tribeName ?? 'tribe'} of ${isl.name} with a gift of ${giftCost} gold.`);
      this.fps.setStatus(`Allied with the ${isl.tribeName ?? 'tribe'}.`);
      this.flushImmediateSave();
      this.emitHud();
      return;
    }

    // Friendly guards (allied tribe, or pirates that favour you) share part of the cache once per island.
    if (!this.saveData.treasureSharesTaken) this.saveData.treasureSharesTaken = [];
    const chest = isl.discoveries.find((d) => d.id === guard.chestId);
    if (!chest || chest.collected || this.saveData.treasureSharesTaken.includes(isl.id)) {
      this.fps.setStatus(guard.tribal ? 'The tribe nods in respect.' : `${guard.name} grins and tips his hat.`);
      this.emitHud();
      return;
    }
    const share = Math.max(10, Math.round(chest.gold * 0.4));
    this.saveData.treasureSharesTaken.push(isl.id);
    this.saveData.player.gold += share;
    this.saveData.stats.peakGold = Math.max(this.saveData.stats.peakGold, this.saveData.player.gold);
    if (!guard.tribal) this.shiftReputation(-1);
    this.sound.playCoinChime();
    this.pushNotification(guard.tribal ? `The ${isl.tribeName ?? 'tribe'} share ${share} gold of treasure with you.` : `The pirates split the loot with you: +${share} gold.`);
    this.fps.setStatus(`Received a ${share}-gold share of the treasure.`);
    this.flushImmediateSave();
    this.emitHud();
  }

  public handleFpsInteract(): void {
    if (!this.fps.active || !this.fps.island || this.modalOpen) return;
    const islandGuards = Array.from(this.islandPirateGuards.values())
      .map((e) => e.data)
      .filter((g) => g.islandId === this.fps.island?.id);
    const cand = this.fps.findPromptCandidate(
      this.saveData,
      { x: this.saveData.player.x, z: this.saveData.player.z },
      Array.from(this.wildlife.values()).map((w) => w.data),
      islandGuards
    );
    if (!cand) return;

    if (cand.kind === 'board_ship') {
      this.boardShipFromIsland();
      return;
    }
    if (cand.kind === 'settlement') {
      const st = this.getSettlementById(cand.id);
      if (st) {
        this.callbacks.onSettlementOpen?.({ ...st });
      }
      return;
    }
    if (cand.kind === 'dig_treasure') {
      const digRes = digTreasureSpot(this.saveData, cand.id);
      if (digRes.success && digRes.map) {
        this.recordMarker({
          id: digRes.map.id,
          kind: 'treasure',
          name: digRes.map.title,
          x: digRes.map.targetX,
          z: digRes.map.targetZ,
          status: 'Excavated',
        });
        this.sound.playDigChest();
        this.sound.playCoinChime();
        this.pushNotification(`Uncovered ${digRes.map.title}! +${digRes.map.rewardGold} gold & treasure loot!`);
        this.addLog('Buried Treasure Unearthed', `Dug up "${digRes.map.title}" on ${this.fps.island.name} for +${digRes.map.rewardGold} gold.`);
        this.flushImmediateSave();
        this.emitHud();
      }
      return;
    }
    if (cand.kind === 'discovery') {
      const disc = this.fps.island.discoveries.find((d) => d.id === cand.id);
      if (disc && !disc.collected) {
        const guardCheck = isDiscoveryChestGuarded(disc, islandGuards);
        if (guardCheck.guarded) {
          this.fps.setStatus(
            `Guarded Chest — defeat ${guardCheck.remainingCount} pirate guard(s) first!`
          );
          this.pushNotification(`Defeat the ${guardCheck.remainingCount} pirate guards before opening ${disc.name}!`);
          this.emitHud();
          return;
        }
        disc.collected = true;
        if (!this.saveData.collectedDiscoveryIds) this.saveData.collectedDiscoveryIds = [];
        if (!this.saveData.collectedDiscoveryIds.includes(disc.id)) {
          this.saveData.collectedDiscoveryIds.push(disc.id);
        }
        this.grantLoot(disc.gold, disc.loot);
        if (disc.requiresDig || disc.kind === 'pirate_chest') this.sound.playDigChest();
        else this.sound.playCoinChime();
        if (disc.grantsMapFragment) {
          this.grantTreasureFragments(1, disc.name);
        }
        this.pushNotification(`Searched ${disc.name}: +${disc.gold} gold & supplies!`);
        this.addLog(`Island Discovery: ${disc.name}`, `Recovered ${disc.gold} gold and supplies on ${this.fps.island.name}.`);
        this.flushImmediateSave();
        this.emitHud();
      }
      return;
    }
    if (cand.kind === 'beached_wreck') {
      const bw = this.fps.island.beachedWrecks.find((b) => b.id === cand.id);
      if (bw && !bw.searched) {
        bw.searched = true;
        if (!this.saveData.collectedDiscoveryIds) this.saveData.collectedDiscoveryIds = [];
        if (!this.saveData.collectedDiscoveryIds.includes(bw.id)) {
          this.saveData.collectedDiscoveryIds.push(bw.id);
        }
        this.grantLoot(bw.gold, bw.loot);
        if (bw.grantsMapFragment) {
          this.grantTreasureFragments(1, bw.name);
        }
        this.sound.playCoinChime();
        this.pushNotification(`Salvaged beached wreck ${bw.name} (+${bw.gold} gold)!`);
        this.flushImmediateSave();
        this.emitHud();
      }
      return;
    }
    if (cand.kind === 'parley_guard') {
      const gEntry = this.islandPirateGuards.get(cand.id);
      if (gEntry) this.parleyWithGuard(gEntry.data);
      return;
    }
    if (cand.kind === 'loot_pirate') {
      const gEntry = this.islandPirateGuards.get(cand.id);
      if (gEntry && gEntry.data.dead && !gEntry.data.looted) {
        const lRes = lootIslandPirateGuard(gEntry.data, this.saveData);
        if (lRes.looted) {
          gEntry.built.root.visible = false;
          this.sound.playCoinChime();
          this.pushNotification(
            gEntry.data.tribal ? `Looted ${gEntry.data.name}: +${lRes.goldAdded} gold in tribal tokens.` : `Looted ${gEntry.data.name}: +${lRes.goldAdded} gold, +${lRes.gunpowderAdded} powder & +${lRes.leadShotAdded} shot!`
          );
          this.flushImmediateSave();
          this.emitHud();
        }
      }
      return;
    }
    if (cand.kind === 'harvest_animal') {
      const entry = this.wildlife.get(cand.id);
      if (entry) {
        const hv = harvestWildlifeActor(entry.data, this.saveData.player.inventory);
        if (hv.harvested) {
          entry.built.root.visible = false;
          this.sound.playCoinChime();
          this.pushNotification(
            `Harvested +${hv.foodAdded} Provisions, +${hv.clothAdded} Sail Cloth, +${hv.saltAdded} Salt & +${hv.hidesAdded} Hides!`
          );
          this.flushImmediateSave();
          this.emitHud();
        }
      }
    }
  }

  // --- Player-Owned Autonomous Fleet Management ---

  public buyFleetShip(
    shipClass: FleetShipClass,
    customName?: string
  ): { ok: boolean; message: string } {
    const unlock = getFleetUnlockStatus(
      this.saveData.player.upgrades,
      this.saveData.player.crew.length,
      this.saveData.player.gold
    );
    if (!unlock.unlocked) {
      return { ok: false, message: unlock.reason || 'Fleet commissioning is locked.' };
    }
    const livingFleetCount = this.saveData.fleet.filter((f) => !f.sunk).length;
    if (livingFleetCount >= MAX_FLEET_SIZE) {
      return { ok: false, message: `Maximum fleet size (${MAX_FLEET_SIZE} escorts) reached.` };
    }

    const spec = FLEET_CLASS_SPECS[shipClass];
    if (!canAffordCosts(this.saveData.player.gold, this.saveData.player.inventory, spec.goldCost, spec.resourceCost)) {
      return { ok: false, message: `Insufficient gold or construction materials for ${spec.label}.` };
    }

    const next = deductCosts(
      this.saveData.player.gold,
      this.saveData.player.inventory,
      spec.goldCost,
      spec.resourceCost
    );
    this.saveData.player.gold = next.gold;
    this.saveData.player.inventory = next.inventory;

    const slot = livingFleetCount;
    const ship = createFleetShip(
      `fleet_${Date.now()}_${Math.floor(this.rand() * 1000)}`,
      shipClass,
      slot,
      this.saveData.player.x,
      this.saveData.player.z,
      this.saveData.player.heading,
      this.rand,
      customName
    );
    this.saveData.fleet.push(ship);
    this.syncFleetMeshes(false);
    this.sound.playShipBell();
    this.addLog('Fleet Ship Commissioned', `Added ${ship.name} (${spec.label}) to your fleet under your flag.`);
    this.pushNotification(`${ship.name} joined your fleet in wedge formation!`);
    this.triggerTutorial(
      'first_fleet',
      'Fleet Command',
      'Escort vessels fly your flag, fight beside you, and gather resources to upgrade themselves autonomously.'
    );
    this.flushImmediateSave();
    this.emitHud();
    return { ok: true, message: `${ship.name} (${spec.label}) commissioned and sailing astern!` };
  }

  public captureEnemyForFleet(pirateId: string): { ok: boolean; message: string } {
    const unlock = getFleetUnlockStatus(
      this.saveData.player.upgrades,
      this.saveData.player.crew.length,
      this.saveData.player.gold
    );
    if (!unlock.unlocked) {
      return { ok: false, message: unlock.reason || 'Fleet capture requires Hull Tier 3 + 12 crew.' };
    }
    const livingFleetCount = this.saveData.fleet.filter((f) => !f.sunk).length;
    if (livingFleetCount >= MAX_FLEET_SIZE) {
      return { ok: false, message: `Fleet full (${MAX_FLEET_SIZE}/${MAX_FLEET_SIZE} ships).` };
    }

    const entry = this.pirates.get(pirateId);
    if (!entry || entry.data.looted) {
      return { ok: false, message: 'Prize vessel is already sinking or claimed.' };
    }
    const pir = entry.data;
    if (pir.isGhost || pir.salvageable === false) {
      return { ok: false, message: 'Hull is shattered beyond salvage — cannot recruit.' };
    }
    const captureCost = computeFleetRecruitCost(pir);
    if (this.saveData.player.gold < captureCost) {
      return { ok: false, message: `Recruiting & refitting vessel requires ${captureCost} gold.` };
    }

    this.saveData.player.gold -= captureCost;
    pir.looted = true;
    pir.captured = true;

    const captured = createFleetShipFromDefeated(
      `fleet_${Date.now()}_${Math.floor(this.rand() * 1000)}`,
      pir,
      livingFleetCount,
      pir.x,
      pir.z,
      pir.heading,
      this.rand
    );
    this.saveData.fleet.push(captured);

    // Remove the defeated hull & pending wreck since prize crew took command
    this.removeSpawnedWreckForShip(pirateId);
    this.scene.remove(entry.mesh);
    this.pirates.delete(pirateId);
    this.hunterIds.delete(pirateId);

    this.syncFleetMeshes(false);
    this.sound.playShipBell();
    this.addLog(
      `Recruited ${pir.name}`,
      `Recruited defeated ${pir.rankTitle} "${pir.name}" into your fleet under your colors (-${captureCost} gold refit).`
    );
    this.pushNotification(`${captured.name} recruited & hoisting your colors!`);
    this.flushImmediateSave();
    this.emitHud();
    return { ok: true, message: `Recruited ${captured.name} into your fleet under your flag!` };
  }

  public recruitDefeatedMerchantForFleet(merchantId: string): { ok: boolean; message: string } {
    const unlock = getFleetUnlockStatus(
      this.saveData.player.upgrades,
      this.saveData.player.crew.length,
      this.saveData.player.gold
    );
    if (!unlock.unlocked) {
      return { ok: false, message: unlock.reason || 'Fleet recruiting requires Hull Tier 3 + 12 crew.' };
    }
    const livingFleetCount = this.saveData.fleet.filter((f) => !f.sunk).length;
    if (livingFleetCount >= MAX_FLEET_SIZE) {
      return { ok: false, message: `Fleet full (${MAX_FLEET_SIZE}/${MAX_FLEET_SIZE} ships).` };
    }

    const mEntry = this.merchants.get(merchantId);
    const ves = mEntry?.data ?? (this.lastSunkHostileMerchant?.id === merchantId ? this.lastSunkHostileMerchant : null);
    if (!ves || ves.salvageable === false) {
      return { ok: false, message: 'This vessel broke apart completely and cannot be recruited.' };
    }

    const recruitCost = computeFleetRecruitCost(ves);
    if (this.saveData.player.gold < recruitCost) {
      return { ok: false, message: `Refitting & hiring prize crew costs ${recruitCost} gold.` };
    }

    this.saveData.player.gold -= recruitCost;
    ves.salvageable = false;
    const recruited = createFleetShipFromMerchant(
      `fleet_${Date.now()}_${Math.floor(this.rand() * 1000)}`,
      ves,
      livingFleetCount,
      ves.x,
      ves.z,
      ves.heading,
      this.rand
    );
    this.saveData.fleet.push(recruited);

    this.removeSpawnedWreckForShip(merchantId);
    if (mEntry) {
      this.scene.remove(mEntry.mesh);
      this.merchants.delete(merchantId);
    }

    this.syncFleetMeshes(false);
    this.sound.playShipBell();
    this.addLog(
      `Recruited ${recruited.name}`,
      `Salvaged & recruited ${ves.name} into your fleet under your flag (-${recruitCost} gold).`
    );
    this.pushNotification(`${recruited.name} salvaged & joined your fleet!`);
    this.flushImmediateSave();
    this.emitHud();
    return { ok: true, message: `${recruited.name} joined your fleet under your flag!` };
  }

  public resolveDefeatedShipCrew(
    vesselKind: 'pirate' | 'merchant',
    vesselId: string,
    choice: 'accept' | 'force'
  ): {
    ok: boolean;
    status: 'joined' | 'refused' | 'error';
    message: string;
    survivor?: WreckSurvivor;
  } {
    const vesselName =
      vesselKind === 'pirate'
        ? this.pirates.get(vesselId)?.data.name ?? 'Defeated Vessel'
        : this.merchants.get(vesselId)?.data.name ?? this.lastSunkHostileMerchant?.name ?? 'Defeated Vessel';
    const shipSurv =
      vesselKind === 'pirate'
        ? this.pirates.get(vesselId)?.data.survivor
        : this.merchants.get(vesselId)?.data.survivor ??
          (this.lastSunkHostileMerchant?.id === vesselId ? this.lastSunkHostileMerchant.survivor : undefined);

    const spawnedWreckId = this.sunkenWreckByShipId.get(vesselId);
    const wreckEntry = spawnedWreckId ? this.wrecks.get(spawnedWreckId) : undefined;
    const wreckSurv = wreckEntry?.data.sections.find((s) => s.survivor)?.survivor;
    const surv = shipSurv ?? wreckSurv;

    if (!surv || surv.resolved) {
      return { ok: false, status: 'error', message: 'Surviving crew already addressed.' };
    }

    const syncFlags = () => {
      if (shipSurv) {
        shipSurv.resolved = surv.resolved;
        shipSurv.offerRefused = surv.offerRefused;
      }
      if (wreckSurv) {
        wreckSurv.resolved = surv.resolved;
        wreckSurv.offerRefused = surv.offerRefused;
      }
    };

    const cap = getMaxCrewCapacity(this.saveData.player.upgrades);
    if (this.saveData.player.crew.length >= cap) {
      return {
        ok: false,
        status: 'error',
        message: `Crew quarters full (${cap} max). Expand your hull or add decks.`,
        survivor: { ...surv },
      };
    }

    if (choice === 'accept') {
      if (surv.offerRefused) {
        return {
          ok: false,
          status: 'refused',
          message: `${surv.name} already turned down your offer. You can force them aboard or leave them.`,
          survivor: { ...surv },
        };
      }
      // 50% chance defeated ship survivor turns down your offer to join
      if (!rollCrewOfferAccepted('accept', this.rand)) {
        surv.offerRefused = true;
        syncFlags();
        this.callbacks.onSaveUpdate(this.getSaveSnapshot());
        this.emitHud();
        return {
          ok: false,
          status: 'refused',
          message: `${surv.name} turned down your offer to join your crew! Force them aboard if you demand their service.`,
          survivor: { ...surv },
        };
      }
    }

    const forced = choice === 'force';
    surv.resolved = true;
    syncFlags();

    const newCrew = this.survivorToCrew(surv, forced);
    this.saveData.player.crew.push(newCrew);
    if (forced) {
      this.shiftReputation(-6);
    } else {
      this.saveData.stats.survivorsRescued++;
      this.shiftReputation(3);
      this.saveData.player.crew.forEach((c) => (c.morale = Math.min(100, c.morale + 4)));
    }
    this.rebuildPlayerShipMesh();
    this.addLog(
      forced ? 'Defeated Sailor Impressed' : 'Defeated Sailor Recruited',
      `${newCrew.name} from ${vesselName} was ${forced ? 'forced into your crew' : 'recruited voluntarily'}.`
    );
    this.pushNotification(
      forced
        ? `${newCrew.name} forced into your crew (-6 Rep)`
        : `${newCrew.name} agreed to join your crew (+3 Rep)!`
    );
    this.flushImmediateSave();
    this.emitHud();
    return {
      ok: true,
      status: 'joined',
      message: forced
        ? `${newCrew.name} was forced into your crew under protest (-6 Rep).`
        : `${newCrew.name} accepted your offer and joined your crew! (+3 Rep)`,
      survivor: { ...surv },
    };
  }

  public setFleetShipCommand(shipId: string, command: FleetCommand): void {
    const ship = this.saveData.fleet.find((f) => f.id === shipId);
    if (!ship) return;
    ship.command = command;
    this.sound.playShipBell();
    this.pushNotification(`${ship.name} ordered to ${command === 'hold' ? 'HOLD POSITION' : command.toUpperCase()}.`);
    this.callbacks.onSaveUpdate(this.getSaveSnapshot());
    this.emitHud();
  }

  public renameFleetShip(shipId: string, name: string): void {
    const clean = name.trim().slice(0, 28);
    if (!clean) return;
    const ship = this.saveData.fleet.find((f) => f.id === shipId);
    if (!ship) return;
    ship.name = clean;
    this.callbacks.onSaveUpdate(this.getSaveSnapshot());
    this.emitHud();
  }

  public buyFlagCosmetic(
    kind: 'dye' | 'emblem' | 'pattern',
    id: string,
    price: number
  ): { ok: boolean; message: string } {
    if (this.saveData.player.gold < price) {
      return { ok: false, message: `Need ${price} gold to unlock this heraldic design.` };
    }
    this.saveData.player.gold -= price;
    if (kind === 'dye' && !this.saveData.unlockedDyes.includes(id as FlagDyeId)) {
      this.saveData.unlockedDyes.push(id as FlagDyeId);
    } else if (kind === 'emblem' && !this.saveData.unlockedEmblems.includes(id as FlagEmblemId)) {
      this.saveData.unlockedEmblems.push(id as FlagEmblemId);
    } else if (kind === 'pattern' && !this.saveData.unlockedPatterns.includes(id as FlagPatternId)) {
      this.saveData.unlockedPatterns.push(id as FlagPatternId);
    }
    this.sound.playCoinChime();
    this.callbacks.onSaveUpdate(this.getSaveSnapshot());
    this.emitHud();
    return { ok: true, message: 'Unlocked new flag heraldry!' };
  }

  // --- Crew Roles & Medical ---

  public assignCrewRole(crewId: string, role: CrewRole): void {
    const member = this.saveData.player.crew.find((c) => c.id === crewId);
    if (!member) return;
    member.role = role;
    this.rebuildPlayerShipMesh();
    this.callbacks.onSaveUpdate(this.getSaveSnapshot());
    this.emitHud();
  }

  public autoAssignCrewRoles(mode: CrewAutoAssignMode): { message: string } {
    const nextCrew = computeAutoAssignRoles(this.saveData.player.crew, mode);
    this.saveData.player.crew = nextCrew;
    const counts = getRoleCounts(nextCrew);
    const summary = (Object.entries(counts) as [CrewRole, number][])
      .filter(([, n]) => n > 0)
      .map(([r, n]) => `${n} ${CREW_ROLE_LABELS[r]}`)
      .join(', ');
    this.rebuildPlayerShipMesh();
    this.sound.playShipBell();
    const label =
      mode === 'best' ? 'Best Roles' : mode === 'sailing' ? 'Sailing Priority' : 'Combat Priority';
    const message = `${label} assigned: ${summary}`;
    this.pushNotification(message);
    this.callbacks.onSaveUpdate(this.getSaveSnapshot());
    this.emitHud();
    return { message };
  }

  public treatCrew(crewId: string): { ok: boolean; message: string } {
    const res = treatCrewMember(this.saveData.player.crew, crewId, this.saveData.player.inventory);
    if (res.ok) {
      this.saveData.player.crew = res.crew;
      this.saveData.player.inventory = res.inventory;
      this.sound.playPageTurn();
      this.callbacks.onSaveUpdate(this.getSaveSnapshot());
      this.emitHud();
    }
    return { ok: res.ok, message: res.message };
  }

  // --- Sea Monsters ---

  public feedMonsterToTame(monsterId: string): { ok: boolean; message: string } {
    const entry = this.monsters.get(monsterId);
    if (!entry) return { ok: false, message: 'Sea beast has dived out of range.' };

    const res = feedSeaMonsterToTame(entry.data, this.saveData.player.inventory, 8);
    entry.data = res.monster;
    this.saveData.player.inventory = res.inventory;

    if (res.ok && res.companion) {
      this.scene.remove(entry.built.root);
      this.monsters.delete(monsterId);
      this.defeatedMonsterIds.add(monsterId);
      this.saveData.tamedMonsters.push(res.companion);
      this.syncTamedCompanions();
      this.shiftReputation(5);
      this.addLog('Sea Beast Tamed', `Befriended ${res.companion.name} with Provisions — it now swims beside our hull!`);
    }

    if (res.ok) this.sound.playCoinChime();
    this.pushNotification(res.message);
    this.callbacks.onSaveUpdate(this.getSaveSnapshot());
    this.emitHud();
    return { ok: res.ok, message: res.message };
  }

  public attackMonster(monsterId: string): void {
    const entry = this.monsters.get(monsterId);
    if (!entry || entry.data.defeated || entry.data.tamed) return;
    entry.data.provokedByPlayer = true;
    this.engageCombatEnemy({ kind: 'monster', id: entry.data.id }, `Engaging sea beast: ${entry.data.name}!`, true);
    this.sound.playMonsterRoar();
    this.pushNotification(`Engaging ${entry.data.name} with ship cannons!`);
    this.emitHud();
  }

  // --- Journal CRUD & Settings ---

  public writeJournal(title: string, body: string): void {
    this.saveData.journal = addJournalEntry(
      this.saveData.journal,
      this.saveData.day,
      this.saveData.timeOfDay,
      title,
      body,
      'player'
    );
    this.sound.playPageTurn();
    this.callbacks.onSaveUpdate(this.getSaveSnapshot());
  }

  public editJournal(id: string, title: string, body: string): void {
    this.saveData.journal = updateJournalEntry(this.saveData.journal, id, title, body);
    this.callbacks.onSaveUpdate(this.getSaveSnapshot());
  }

  public removeJournal(id: string): void {
    this.saveData.journal = deleteJournalEntry(this.saveData.journal, id);
    this.callbacks.onSaveUpdate(this.getSaveSnapshot());
  }

  public updateSettings(next: GameSettings): void {
    this.saveData.settings = { ...next };
    this.sound.setAudioSettings(next);
    this.callbacks.onSaveUpdate(this.getSaveSnapshot());
  }

  public toggleMute(): boolean {
    const next = !this.sound.isMuted();
    this.sound.setMuted(next);
    return next;
  }

  // --- Automatic Multi-Enemy Naval Combat ---

  private getCombatEnemies(): CombatEnemyRef[] {
    if (!Array.isArray(this.combat.enemies)) this.combat.enemies = [];
    return this.combat.enemies;
  }

  private isEnemyInCombat(id: string): boolean {
    return this.getCombatEnemies().some((e) => e.id === id);
  }

  private getEnemyWorldPos(ref: CombatEnemyRef): { x: number; y: number; z: number; name: string } | null {
    if (ref.kind === 'pirate') {
      const e = this.pirates.get(ref.id);
      if (!e || e.data.defeated) return null;
      return { x: e.data.x, y: e.mesh.position.y + 1.8, z: e.data.z, name: e.data.name };
    }
    if (ref.kind === 'monster') {
      const m = this.monsters.get(ref.id);
      if (!m || m.data.defeated || m.data.tamed) return null;
      return { x: m.data.x, y: 1.5, z: m.data.z, name: m.data.name };
    }
    const v = this.merchants.get(ref.id);
    if (!v || v.data.sunk) return null;
    return { x: v.data.x, y: v.mesh.position.y + 1.8, z: v.data.z, name: v.data.name };
  }

  private syncCombatPrimaryFields(): void {
    const px = this.saveData.player.x;
    const pz = this.saveData.player.z;
    const living = this.getCombatEnemies().filter((ref) => this.getEnemyWorldPos(ref) !== null);
    this.combat.enemies = living;

    if (living.length === 0) {
      this.combat.active = false;
      this.combat.pirateId = null;
      this.combat.monsterId = null;
      this.combat.hostileMerchantId = null;
      this.combat.primaryTargetId = null;
      this.combat.command = 'attack';
      this.combat.retreating = false;
      this.assistDecisions.clear();
      this.assistingAllies.clear();
      return;
    }

    let primary = living.find((e) => e.id === this.combat.primaryTargetId);
    if (!primary) {
      let bestDist = Infinity;
      for (const ref of living) {
        const pos = this.getEnemyWorldPos(ref);
        if (!pos) continue;
        const d = Math.hypot(pos.x - px, pos.z - pz);
        if (d < bestDist) {
          bestDist = d;
          primary = ref;
        }
      }
      primary = primary ?? living[0];
    }

    this.combat.active = true;
    this.combat.primaryTargetId = primary.id;
    this.combat.pirateId = primary.kind === 'pirate' ? primary.id : null;
    this.combat.monsterId = primary.kind === 'monster' ? primary.id : null;
    this.combat.hostileMerchantId = primary.kind === 'merchant' ? primary.id : null;
  }

  public setPrimaryCombatTarget(enemyId: string): void {
    if (!this.combat.active) return;
    if (!this.getCombatEnemies().some((e) => e.id === enemyId)) return;
    this.combat.primaryTargetId = enemyId;
    this.syncCombatPrimaryFields();
    this.emitHud();
  }

  public engageCombatEnemy(ref: CombatEnemyRef, logMsg?: string, makePrimary = false): void {
    const enemies = this.getCombatEnemies();
    const alreadyActive = this.combat.active && enemies.length > 0;
    const exists = enemies.some((e) => e.id === ref.id);
    if (!exists) {
      enemies.push(ref);
    }
    if (!alreadyActive) {
      const stats = computeAutoCombatStats(this.saveData.player.upgrades, this.saveData.player.crew, 'attack');
      this.combat.active = true;
      this.combat.command = 'attack';
      this.combat.playerReload = 0.78;
      this.combat.playerReloadTime = stats.reloadTime;
      this.combat.retreating = false;
      this.combat.primaryTargetId = ref.id;
      this.assistDecisions.clear();
      this.assistingAllies.clear();
    } else if (makePrimary || !this.combat.primaryTargetId) {
      this.combat.primaryTargetId = ref.id;
    }
    if (logMsg) {
      this.combat.combatLog = [logMsg, ...this.combat.combatLog].slice(0, 6);
    }
    this.syncCombatPrimaryFields();
  }

  public startNavalBattle(pirate: PirateShipData): void {
    if (pirate.defeated) return;
    const wasActive = this.combat.active;
    const alreadyEngaged = this.isEnemyInCombat(pirate.id);
    if (alreadyEngaged) return;

    this.engageCombatEnemy(
      { kind: 'pirate', id: pirate.id },
      `${wasActive ? 'Additional foe engaged: ' : 'Engaging '}${pirate.name} (${PIRATE_FACTIONS[pirate.factionId].shortName}).`,
      !wasActive
    );
    this.sound.playShipBell();
    this.pushNotification(
      wasActive
        ? `${pirate.name} joined the battle against you!`
        : `Battle joined! Engaging ${pirate.name}!`
    );
    if (!wasActive) {
      this.triggerTutorial(
        'first_combat',
        'Naval Combat',
        'Steer manually with WASD while your gunners fire automatically. Sail past 265m to break off or use Surrender below.'
      );
    }
    this.emitHud();
  }

  public setCombatCommand(command: CombatCommand): void {
    if (!this.combat.active) return;
    if (command === 'surrender') {
      this.surrenderInCombat();
      return;
    }
    this.combat.command = command;
    this.combat.retreating = false;
    const stats = computeAutoCombatStats(this.saveData.player.upgrades, this.saveData.player.crew, command);
    this.combat.playerReloadTime = stats.reloadTime;
    const note = 'All hands to the guns! Steer manually or sail past 265m to break off.';
    this.combat.combatLog = [note, ...this.combat.combatLog].slice(0, 6);
    this.emitHud();
  }

  public respondToPirateHail(
    pirateId: string,
    choice: 'pay' | 'fight' | 'evade'
  ): { ok: boolean; message: string } {
    const entry = this.pirates.get(pirateId);
    if (!entry) return { ok: false, message: 'Pirate vessel is gone.' };
    const pirate = entry.data;
    pirate.hailed = true;

    if (choice === 'pay') {
      this.startNavalBattle(pirate);
      this.surrenderInCombat();
      return { ok: true, message: 'Tribute paid.' };
    }

    this.startNavalBattle(pirate);
    if (choice === 'evade') {
      this.pushNotification('Crowding canvas! Steer past 265m to escape battle.');
    }
    return { ok: true, message: 'Engaged in naval battle!' };
  }

  public triggerPlayerFire(): void {
    if (!this.combat.active || this.combat.playerReload < 0.99) return;
    this.syncCombatPrimaryFields();
    if (!this.combat.active) return;

    const stats = computeAutoCombatStats(
      this.saveData.player.upgrades,
      this.saveData.player.crew,
      this.combat.command
    );
    const px = this.saveData.player.x;
    const pz = this.saveData.player.z;
    const playerShipLabel = this.saveData.player.shipName || 'Your Ship';

    // Pick primary target if in range, otherwise fallback to any engaged enemy in range
    const enemies = this.getCombatEnemies();
    let activeRef: CombatEnemyRef | null =
      enemies.find((e) => e.id === this.combat.primaryTargetId) ?? enemies[0] ?? null;

    if (activeRef) {
      const pPos = this.getEnemyWorldPos(activeRef);
      if (!pPos || Math.hypot(pPos.x - px, pPos.z - pz) > stats.fireRange) {
        const alt = enemies.find((e) => {
          const ep = this.getEnemyWorldPos(e);
          return ep && Math.hypot(ep.x - px, ep.z - pz) <= stats.fireRange;
        });
        if (alt) activeRef = alt;
      }
    }
    if (!activeRef) return;

    // 1. Pirate target
    if (activeRef.kind === 'pirate') {
      const entry = this.pirates.get(activeRef.id);
      if (!entry || entry.data.defeated) return;
      const pirate = entry.data;
      const dist = Math.hypot(pirate.x - px, pirate.z - pz);

      const res = resolvePlayerVolley(
        this.saveData.player.upgrades,
        this.saveData.player.condition,
        this.saveData.player.inventory,
        stats.accuracyBonus,
        'hull',
        'broadside',
        dist,
        pirate,
        this.rand,
        stats.effectiveCannons
      );
      if (!res.fired) return;
      if (pirate.playerId) this.net?.sendRelay('pvp-volley', pirate.playerId, {});

      this.consumeAmmoAndSpawnSalvo(
        res,
        stats.reloadTime,
        pirate.x,
        entry.mesh.position.y + 1.8,
        pirate.z,
        res.hits > 0
          ? () => {
              if (!pirate.defeated) {
                this.attachBattleDamageMark({
                  targetKind: 'pirate',
                  shipId: pirate.id,
                  root: entry.mesh,
                  shipX: pirate.x,
                  shipZ: pirate.z,
                  heading: pirate.heading,
                  halfLength: entry.halfLength,
                  halfBeam: entry.halfBeam,
                  attackerX: px,
                  attackerZ: pz,
                  section: res.hitLocation,
                  kind: 'cannon',
                  damage: res.hullDamage,
                });
              }
            }
          : undefined
      );
      pirate.hull = Math.max(0, pirate.hull - res.hullDamage);
      pirate.crewCount = Math.max(0, pirate.crewCount - res.crewCasualties);
      if (res.sailDamage > 0) pirate.sails = Math.max(15, pirate.sails - Math.round(res.sailDamage * 0.5));
      if (res.cannonDestroyed > 0) pirate.cannons = Math.max(0, pirate.cannons - res.cannonDestroyed);
      if (res.hits > 0) {
        entry.impactRoll += (Math.random() < 0.5 ? -1 : 1) * 0.16;
        entry.impactPitch += (Math.random() - 0.5) * 0.1;
        this.emitDamageNotification({
          targetName: pirate.name,
          attackerName: playerShipLabel,
          location: res.hitLocation,
          damage: res.hullDamage,
          source: 'cannon',
          direction: 'dealt',
          critical: res.isCritical,
          worldPos: { x: pirate.x, y: entry.mesh.position.y + 2.4, z: pirate.z },
        });
      }
      if (pirate.playerId) {
        // The other captain's real hull is theirs to lose; their client resolves the volley.
        pirate.hull = Math.max(1, pirate.hull);
      } else if (res.enemyDefeated) {
        this.handlePirateDefeated(pirate);
      }
    }
    // 2. Monster target
    else if (activeRef.kind === 'monster') {
      const mEntry = this.monsters.get(activeRef.id);
      if (!mEntry || mEntry.data.defeated) return;
      const mon = mEntry.data;
      const dist = Math.hypot(mon.x - px, mon.z - pz);

      const res = resolvePlayerVolley(
        this.saveData.player.upgrades,
        this.saveData.player.condition,
        this.saveData.player.inventory,
        stats.accuracyBonus,
        'hull',
        'broadside',
        dist,
        { name: mon.name, hull: mon.hp, crewCount: 1 },
        this.rand,
        stats.effectiveCannons
      );
      if (!res.fired) return;

      this.consumeAmmoAndSpawnSalvo(res, stats.reloadTime, mon.x, 1.5, mon.z);
      mon.hp = Math.max(0, mon.hp - res.hullDamage);
      if (res.hits > 0) {
        mEntry.impactRoll += 0.25;
        this.emitDamageNotification({
          targetName: mon.name,
          attackerName: playerShipLabel,
          location: res.hitLocation,
          damage: res.hullDamage,
          source: 'cannon',
          direction: 'dealt',
          critical: res.isCritical,
          worldPos: { x: mon.x, y: 2.2, z: mon.z },
        });
      }
      if (mon.hp <= 0) {
        this.handleMonsterDefeated(mon);
      }
    }
    // 3. Hostile merchant / Crown vessel target
    else if (activeRef.kind === 'merchant') {
      const vEntry = this.merchants.get(activeRef.id);
      if (!vEntry || vEntry.data.sunk) return;
      const ves = vEntry.data;
      const dist = Math.hypot(ves.x - px, ves.z - pz);

      const res = resolvePlayerVolley(
        this.saveData.player.upgrades,
        this.saveData.player.condition,
        this.saveData.player.inventory,
        stats.accuracyBonus,
        'hull',
        'broadside',
        dist,
        ves,
        this.rand,
        stats.effectiveCannons
      );
      if (!res.fired) return;

      this.consumeAmmoAndSpawnSalvo(
        res,
        stats.reloadTime,
        ves.x,
        vEntry.mesh.position.y + 1.8,
        ves.z,
        res.hits > 0
          ? () => {
              if (!ves.sunk) {
                this.attachBattleDamageMark({
                  targetKind: 'merchant',
                  shipId: ves.id,
                  root: vEntry.mesh,
                  shipX: ves.x,
                  shipZ: ves.z,
                  heading: ves.heading,
                  halfLength: vEntry.halfLength,
                  halfBeam: vEntry.halfBeam,
                  attackerX: px,
                  attackerZ: pz,
                  section: res.hitLocation,
                  kind: 'cannon',
                  damage: res.hullDamage,
                });
              }
            }
          : undefined
      );
      ves.hull = Math.max(0, ves.hull - res.hullDamage);
      ves.crewCount = Math.max(0, ves.crewCount - res.crewCasualties);
      if (res.cannonDestroyed > 0) ves.cannons = Math.max(0, ves.cannons - res.cannonDestroyed);
      if (res.hits > 0) {
        vEntry.impactRoll += 0.16;
        this.emitDamageNotification({
          targetName: ves.name,
          attackerName: playerShipLabel,
          location: res.hitLocation,
          damage: res.hullDamage,
          source: 'cannon',
          direction: 'dealt',
          critical: res.isCritical,
          worldPos: { x: ves.x, y: vEntry.mesh.position.y + 2.4, z: ves.z },
        });
      }

      if (ves.hull <= 0) {
        this.handleMerchantSunkByPlayer(ves);
      }
    }

    this.callbacks.onSaveUpdate(this.getSaveSnapshot());
    this.emitHud();
  }

  private consumeAmmoAndSpawnSalvo(
    res: ReturnType<typeof resolvePlayerVolley>,
    reloadTime: number,
    targetX: number,
    targetY: number,
    targetZ: number,
    onFirstHitArrive?: () => void
  ): void {
    this.combat.combatLog = [res.summary, ...this.combat.combatLog].slice(0, 6);
    this.saveData.player.inventory.gunpowder = Math.max(
      0,
      this.saveData.player.inventory.gunpowder - res.powderUsed
    );
    this.saveData.player.inventory.cannonballs = Math.max(
      0,
      this.saveData.player.inventory.cannonballs - res.ballsUsed
    );

    this.combat.playerReloadTime = reloadTime;
    this.combat.playerReload = 0;

    // Award gunnery experience to crew
    const xpRes = grantCrewRoleXp(this.saveData.player.crew, ['cannoneer', 'general'], 7);
    this.saveData.player.crew = xpRes.crew;
    if (xpRes.levelUps.length > 0) {
      this.pushNotification(`${xpRes.levelUps[0]}!`);
    }

    this.sound.playCannonFire();
    this.trauma = Math.min(1, this.trauma + 0.32);
    this.playerCannonRecoil = 1.0;

    const angleToEnemy = Math.atan2(-(targetX - this.saveData.player.x), -(targetZ - this.saveData.player.z));
    const relSide = Math.sin(normalizeAngle(angleToEnemy - this.saveData.player.heading)) >= 0 ? 1 : -1;
    this.playerImpactRoll += relSide * 0.08;

    const visualShots = Math.max(1, Math.min(6, res.shotsFired));
    for (let i = 0; i < visualShots; i++) {
      const m = this.playerShip.cannonMuzzles[i % Math.max(1, this.playerShip.cannonMuzzles.length)];
      const start = m
        ? m
            .clone()
            .applyAxisAngle(new THREE.Vector3(0, 1, 0), this.saveData.player.heading)
            .add(this.playerShip.root.position)
        : new THREE.Vector3(
            this.saveData.player.x + (Math.random() - 0.5) * 3,
            this.playerShip.root.position.y + 2.2,
            this.saveData.player.z + (Math.random() - 0.5) * 3
          );
      const isHit = i < res.hits;
      const spread = isHit ? 2.2 : 13.0;
      const end = new THREE.Vector3(
        targetX + (Math.random() - 0.5) * spread,
        isHit ? targetY : 0.1,
        targetZ + (Math.random() - 0.5) * spread
      );
      this.launchCannonball(start, end, true, isHit, isHit && i === 0 ? onFirstHitArrive : undefined);
      this.spawnMuzzleEffects(start);
    }
  }

  public surrenderInCombat(): void {
    if (!this.combat.active) return;
    if (this.combat.pirateId) {
      const entry = this.pirates.get(this.combat.pirateId);
      if (entry) {
        const goldLost = Math.round(this.saveData.player.gold * 0.35);
        const foodLost = Math.round(this.saveData.player.inventory.food * 0.25);
        this.saveData.player.gold = Math.max(0, this.saveData.player.gold - goldLost);
        this.saveData.player.inventory.food = Math.max(0, this.saveData.player.inventory.food - foodLost);
        for (const ref of this.getCombatEnemies()) {
          if (ref.kind === 'pirate') {
            const p = this.pirates.get(ref.id)?.data;
            if (p) {
              p.hailCooldown = 120;
              p.behavior = 'patrol';
            }
          }
        }
        this.saveData.player.crew.forEach((c) => (c.morale = Math.max(10, c.morale - 12)));
        this.addLog(
          'Struck Colors to Pirates',
          `Surrendered ${goldLost} gold and ${foodLost} Provisions to ${entry.data.name} to spare the crew.`
        );
        this.pushNotification(`Surrendered to pirates! (-${goldLost} gold, -${foodLost} Provisions)`);
      }
    } else if (this.combat.hostileMerchantId) {
      const mEntry = this.merchants.get(this.combat.hostileMerchantId);
      if (mEntry) {
        const fine = Math.round(this.saveData.player.gold * 0.4);
        this.saveData.player.gold = Math.max(0, this.saveData.player.gold - fine);
        for (const ref of this.getCombatEnemies()) {
          if (ref.kind === 'merchant') {
            const m = this.merchants.get(ref.id)?.data;
            if (m) m.hostileToPlayer = false;
          }
        }
        this.pushNotification(`Ceased fire and paid ${fine} gold restitution.`);
      }
    }
    this.combat.enemies = [];
    this.combat.primaryTargetId = null;
    this.syncCombatPrimaryFields();
    this.flushImmediateSave();
    this.emitHud();
  }

  private spawnShipExplosion(x: number, z: number, scale = 1): void {
    const blast = new THREE.Mesh(this.shipExplosionGeo, this.shipExplosionMat);
    blast.position.set(x, 2.2 * scale, z);
    blast.scale.setScalar(0.8);
    this.scene.add(blast);
    this.shipExplosions.push({ mesh: blast, life: 0, maxLife: 0.58, maxScale: 5.4 * scale });

    for (let i = 0; i < 48; i++) {
      const a = this.rand() * Math.PI * 2;
      const spd = (5 + this.rand() * 14) * scale;
      const isSmoke = i % 3 === 0;
      this.spawnParticle(
        x + (this.rand() - 0.5) * 4 * scale,
        1.5 + this.rand() * 3.5 * scale,
        z + (this.rand() - 0.5) * 4 * scale,
        Math.cos(a) * spd,
        6 + this.rand() * 11 * scale,
        Math.sin(a) * spd,
        isSmoke ? 1.65 : 1.05,
        isSmoke ? 0.16 : 1.0,
        isSmoke ? 0.14 : 0.35 + this.rand() * 0.45,
        isSmoke ? 0.13 : 0.06
      );
    }

    const d = Math.hypot(x - this.saveData.player.x, z - this.saveData.player.z);
    if (d < 220) {
      this.trauma = Math.min(1, this.trauma + 0.55 * (1 - d / 240));
      this.sound.playCannonFire();
      this.sound.playImpactSplinter();
    }
  }

  private spawnSunkenShipwreckForVessel(
    source: { kind: 'pirate'; ship: PirateShipData } | { kind: 'merchant'; ship: MerchantShipData },
    discoveredByPlayer: boolean,
    graceSec = 3.0
  ): ShipwreckData | null {
    if (this.sunkenWreckByShipId.has(source.ship.id)) return null;

    const wreck = generateSunkenVesselWreck(source, this.rand);
    wreck.discovered = discoveredByPlayer;

    const wMesh = buildShipwreckMesh(wreck.archetype, wreck.scale, this.textures, Boolean(wreck.isCharred));
    wMesh.position.set(wreck.x, -wreck.sinkDepth, wreck.z);
    wMesh.rotation.y = wreck.rotation;
    this.scene.add(wMesh);

    this.wrecks.set(wreck.id, {
      data: wreck,
      mesh: wMesh,
      graceUntil: this.simTime + graceSec,
    });
    this.sunkenWreckByShipId.set(source.ship.id, wreck.id);

    if (discoveredByPlayer) {
      this.recordMarker({
        id: wreck.id,
        kind: wreck.isGhostWreck ? 'ghost' : 'wreck',
        name: wreck.name,
        x: wreck.x,
        z: wreck.z,
        status: wreck.isGhostWreck
          ? `Ghost Wreck (0/${wreck.sections.length})`
          : wreck.isCharred
            ? `Charred Wreck (0/${wreck.sections.length})`
            : `0/${wreck.sections.length} Searched`,
      });
    }
    return wreck;
  }

  private removeSpawnedWreckForShip(shipId: string): void {
    const wreckId = this.sunkenWreckByShipId.get(shipId);
    if (!wreckId) return;
    const wEntry = this.wrecks.get(wreckId);
    if (wEntry) {
      this.scene.remove(wEntry.mesh);
      this.wrecks.delete(wreckId);
    }
    this.sunkenWreckByShipId.delete(shipId);
    this.saveData.markers = this.saveData.markers.filter((m) => m.id !== wreckId);
  }

  public markPirateVictoryHandled(pirateId: string): void {
    const entry = this.pirates.get(pirateId);
    if (entry) {
      entry.data.looted = true;
    }
    this.flushImmediateSave();
    this.emitHud();
  }

  private handlePirateDefeated(pirate: PirateShipData): void {
    if (pirate.defeated) return;
    pirate.defeated = true;
    pirate.behavior = 'defeated';
    pirate.sinkProgress = 0;
    pirate.salvageable = rollEnemySalvageable(pirate.isGhost, this.rand);
    this.defeatedPirateIds.add(pirate.id);
    this.saveData.stats.piratesDefeated++;
    this.victoryThemeTimer = 7.5;
    this.combat.enemies = this.getCombatEnemies().filter((e) => e.id !== pirate.id);
    this.syncCombatPrimaryFields();

    if (!pirate.isBountyTarget) {
      this.shiftReputation(pirate.isGhost ? 12 : pirate.isBoss ? 14 : 6);
    }
    this.saveData.player.crew.forEach((c) => (c.morale = Math.min(100, c.morale + 14)));
    this.sound.playShipBell();
    if (pirate.isBountyTarget && pirate.bountyId) {
      this.handleBountyTargetKilled(pirate.bountyId, true);
    }

    if (pirate.isGhost) {
      pirate.looted = true;
      this.spawnSunkenShipwreckForVessel({ kind: 'pirate', ship: pirate }, true, 3.5);
      this.addLog(
        `Banished ${pirate.name}`,
        `Destroyed the haunted ghost ship "${pirate.name}"! Its spectral wreck drifted onto the waves ready for exploration.`
      );
      this.pushNotification(`Banished ${pirate.name}! Sail close & press E to explore the Ghost Wreck!`);
      this.flushImmediateSave();
      this.emitHud();
      return;
    }

    if (!pirate.salvageable) {
      this.spawnShipExplosion(
        pirate.x,
        pirate.z,
        pirate.tier === 'dreadnought' ? 1.6 : pirate.tier === 'galleon' ? 1.35 : 1.05
      );
    }

    if (!pirate.survivor && pirate.crewCount > 0) {
      const sample = createRandomCrewMember(`pir_surv_${pirate.id}`, this.rand);
      pirate.survivor = {
        id: sample.id,
        name: sample.name,
        skills: sample.skills,
        disposition: 'reluctant',
        demandAmount: 0,
        resolved: false,
        infoText: `Served aboard ${pirate.name} before it went down.`,
      };
    }

    this.saveData.factions = shiftFactionStanding(this.saveData.factions, pirate.factionId, -18);

    if (pirate.isBoss || pirate.rank === 6) {
      this.saveData.stats.bossesDefeated++;
      if (!this.saveData.defeatedBossIds.includes(pirate.id)) {
        this.saveData.defeatedBossIds.push(pirate.id);
      }
      if (pirate.rank === 6) {
        const res = applyLeaderDefeatConsequences(this.saveData.factions, pirate.factionId);
        this.saveData.factions = res.factions;
        this.addLog('Faction Leader Slain!', res.summary);
        this.pushNotification(res.summary);
      }
    }

    this.spawnSunkenShipwreckForVessel({ kind: 'pirate', ship: pirate }, true, 3.5);

    this.pushNotification(
      pirate.salvageable
        ? `${pirate.name} defeated! Search its wreck with E (+${pirate.isBoss ? 14 : 6} Rep)`
        : `${pirate.name} exploded in flames! Charred wreck holds reduced loot (+${pirate.isBoss ? 14 : 6} Rep)`
    );
    this.addLog(
      `Victory Over ${pirate.name}`,
      pirate.salvageable
        ? `Sank ${pirate.captainName} (${pirate.rankTitle}, ${PIRATE_FACTIONS[pirate.factionId].shortName}). Its wreckage floats nearby.`
        : `${pirate.name} suffered a powder magazine explosion and burned down to a charred wreck with reduced cargo.`
    );
    this.callbacks.onVictoryLoot({ ...pirate });
    this.flushImmediateSave();
    this.emitHud();
  }

  private handleMonsterDefeated(mon: SeaMonsterData): void {
    if (mon.defeated) return;
    mon.defeated = true;
    mon.sinkProgress = 0;
    this.defeatedMonsterIds.add(mon.id);
    this.saveData.stats.monstersDefeated++;
    this.victoryThemeTimer = 7.5;
    this.combat.enemies = this.getCombatEnemies().filter((e) => e.id !== mon.id);
    this.syncCombatPrimaryFields();

    const bonusGold = mon.size === 'legendary' ? 420 : mon.size === 'large' ? 180 : 75;
    const provisionDrop = getMonsterProvisionDrop(mon.size);
    const saltDrop = getMonsterSaltDrop(mon.size);
    mon.carcassRemainingFood = provisionDrop;
    mon.carcassRemainingSalt = saltDrop;
    mon.carcassHarvested = false;
    mon.carcassTimer = 180;

    const bonusLoot: Partial<Inventory> = {
      rareMaterials: mon.size === 'legendary' ? 6 : mon.size === 'large' ? 3 : 1,
      decorativeMaterials: mon.size === 'legendary' ? 4 : 1,
    };
    this.grantLoot(bonusGold, bonusLoot);
    this.shiftReputation(mon.alignment === 'evil' ? 10 : mon.alignment === 'good' ? -8 : 2);
    this.sound.playSplashHuge();
    this.pushNotification(
      `Slain ${mon.name}! Its body floats at the surface — press [F] near the carcass to fish it for +${provisionDrop} Provisions & +${saltDrop} Salt!`
    );
    this.addLog(
      `Slain ${mon.name}`,
      `Vanquished ${mon.size} ${mon.species}. Its floating carcass holds ${provisionDrop} Provisions and ${saltDrop} Sea Salt for fishing.`
    );
    this.flushImmediateSave();
    this.emitHud();
  }

  private handleMerchantSunkByPlayer(ves: MerchantShipData): void {
    if (ves.sunk) return;
    ves.sunk = true;
    ves.sinkProgress = 0;
    ves.salvageable = rollEnemySalvageable(false, this.rand);
    if (!ves.salvageable) {
      this.spawnShipExplosion(ves.x, ves.z, ves.tier === 'wealthy_galleon' ? 1.35 : 1.05);
    }
    if (!ves.survivor && ves.crewCount > 0) {
      const sample = createRandomCrewMember(`merch_surv_${ves.id}`, this.rand);
      ves.survivor = {
        id: sample.id,
        name: sample.name,
        skills: sample.skills,
        disposition: 'reluctant',
        demandAmount: 0,
        resolved: false,
        infoText: `Crewman rescued from the sinking hull of ${ves.name}.`,
      };
    }
    this.lastSunkHostileMerchant = { ...ves };
    this.combat.enemies = this.getCombatEnemies().filter((e) => e.id !== ves.id);
    this.syncCombatPrimaryFields();

    this.spawnSunkenShipwreckForVessel({ kind: 'merchant', ship: ves }, true, 3.5);
    if (ves.isBountyTarget && ves.bountyId) {
      this.handleBountyTargetKilled(ves.bountyId, true);
    } else {
      this.shiftReputation(-22);
    }
    this.saveData.stats.shipsRobbed++;
    this.sound.playShipBell();
    this.addLog(
      `Sank ${ves.name}`,
      ves.salvageable
        ? `Sank ${ves.name}! Its drifting wreckage can be searched or salvaged.`
        : `${ves.name} exploded and burned down to a charred wreck with reduced surviving cargo.`
    );
    this.pushNotification(
      ves.salvageable
        ? `Sank ${ves.name}! Search its wreck with E or recruit hull.`
        : `Sank ${ves.name}! It exploded — charred wreck holds less loot.`
    );
    this.callbacks.onMerchantVictory?.({ ...ves });
    this.flushImmediateSave();
    this.emitHud();
  }

  private grantLoot(gold: number, loot: Partial<Inventory>): string[] {
    if (gold > 0) {
      this.saveData.player.gold += gold;
      this.saveData.stats.peakGold = Math.max(this.saveData.stats.peakGold, this.saveData.player.gold);
    }

    const cap = getCargoCapacity(this.saveData.player.upgrades);
    const added: string[] = [];
    for (const [k, qty] of Object.entries(loot) as [ResourceId, number][]) {
      if (!qty || qty <= 0 || !RESOURCE_DEFS[k]) continue;
      let canAdd = qty;
      const curW = getCargoWeight(this.saveData.player.inventory);
      const unitW = RESOURCE_DEFS[k].weight || 1.0;
      if (curW + canAdd * unitW > cap + 18) {
        canAdd = Math.max(0, Math.floor((cap + 18 - curW) / unitW));
      }
      if (canAdd > 0) {
        this.saveData.player.inventory[k] = (this.saveData.player.inventory[k] || 0) + canAdd;
        added.push(`${canAdd} ${RESOURCE_DEFS[k].name}`);
      }
    }
    return added;
  }

  private spawnMuzzleEffects(pos: THREE.Vector3): void {
    const flash = new THREE.Mesh(this.muzzleFlashGeo, this.muzzleFlashMat);
    flash.position.copy(pos);
    this.scene.add(flash);
    this.muzzleFlashes.push({ mesh: flash, life: 0, maxLife: 0.14 });

    for (let s = 0; s < 6; s++) {
      this.spawnParticle(
        pos.x,
        pos.y,
        pos.z,
        (Math.random() - 0.5) * 4.2,
        1.4 + Math.random() * 2.5,
        (Math.random() - 0.5) * 4.2,
        1.1,
        0.82,
        0.8,
        0.74
      );
    }
  }

  private spawnImpactExplosion(x: number, y: number, z: number, scale = 0.85): void {
    const blast = new THREE.Mesh(this.shipExplosionGeo, this.shipExplosionMat);
    blast.position.set(x, y, z);
    blast.scale.setScalar(0.35 * scale);
    this.scene.add(blast);
    this.shipExplosions.push({ mesh: blast, life: 0, maxLife: 0.28, maxScale: 1.45 * scale });
  }

  private launchCannonball(
    start: THREE.Vector3,
    end: THREE.Vector3,
    fromPlayer: boolean,
    isHit: boolean,
    onArrive?: () => void
  ): void {
    const mesh = new THREE.Mesh(this.cannonballGeo, this.cannonballMat);
    mesh.position.copy(start);
    this.scene.add(mesh);
    const dist = start.distanceTo(end);
    this.cannonballs.push({
      mesh,
      start,
      end,
      t: 0,
      duration: clamp(dist / 68, 0.45, 1.5),
      arcHeight: clamp(dist * 0.14, 3.5, 14),
      fromPlayer,
      isHit,
      onArrive,
    });
  }

  // --- Core Simulation Loop ---

  private startLoop(): void {
    const tick = (now: number) => {
      if (this.disposed) return;
      const rawDt = (now - this.lastTimestamp) / 1000;
      this.lastTimestamp = now;
      const dt = Math.min(Math.max(rawDt, 0.001), 0.05);

      this.update(dt);
      this.renderer.render(this.scene, this.camera);

      if (this.isSoftwareGl) {
        this.afterDraw(() => tick(performance.now()));
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };

    if (this.isSoftwareGl) {
      this.frameId = window.setTimeout(() => tick(performance.now()), 16);
    } else {
      this.frameId = requestAnimationFrame(tick);
    }
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (!gl || typeof gl.fenceSync !== 'function') {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) {
        if (sync) gl.deleteSync(sync);
        return;
      }
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private selectCurrentMusicTheme(): MusicThemeId {
    if (this.phase === 'title') return 'title';
    if (this.phase === 'gameover' || this.playerSinkingTimer > 0) return 'defeat';
    if (this.victoryThemeTimer > 0) return 'victory';

    if (this.combat.active) {
      if (this.combat.pirateId) {
        const p = this.pirates.get(this.combat.pirateId)?.data;
        if (p?.isBoss) return 'boss';
      }
      if (this.combat.monsterId) {
        const m = this.monsters.get(this.combat.monsterId)?.data;
        return m?.size === 'legendary' ? 'boss' : 'monster';
      }
      if (this.fleetBattleTimer > 0) return 'fleet_battle';
      return 'combat';
    }

    if (this.fleetBattleTimer > 0) return 'fleet_battle';
    if (this.activeModalKind === 'settlement') return 'settlement';
    if (this.fps.active) return 'island';
    if (this.activeModalKind === 'merchant' || this.activeModalKind === 'pirate_trade') return 'trading';
    if (this.activeModalKind === 'wreck') return 'wreck';
    if (this.activeModalKind === 'pirate_rob') return 'piracy';

    const px = this.saveData.player.x;
    const pz = this.saveData.player.z;

    for (const mEntry of this.monsters.values()) {
      if (!mEntry.data.defeated && !mEntry.data.tamed) {
        const d = Math.hypot(mEntry.data.x - px, mEntry.data.z - pz);
        if (d < 165 && shouldMonsterAttackPlayer(mEntry.data, this.saveData.reputation)) {
          return 'monster';
        }
      }
    }

    for (const pEntry of this.pirates.values()) {
      if (!pEntry.data.defeated && Math.hypot(pEntry.data.x - px, pEntry.data.z - pz) < 185) {
        if (pEntry.data.behavior === 'pursue' || pEntry.data.behavior === 'hailing') {
          return 'pirate_encounter';
        }
      }
    }

    const wType = this.saveData.weather.type;
    if (
      wType === 'thunderstorm' ||
      wType === 'lightning_storm' ||
      wType === 'hurricane' ||
      wType === 'tornado' ||
      wType === 'severe_hail' ||
      wType === 'blizzard' ||
      wType === 'heavy_rain' ||
      wType === 'strong_winds'
    ) {
      return 'storm';
    }

    if (this.saveData.reputation <= -30) return 'piracy';

    const hr = this.saveData.timeOfDay;
    if (hr < 5.5 || hr >= 19.5) return 'night';

    if (Math.abs(this.saveData.player.speed) > 4.5) return 'exploration';
    return 'peaceful';
  }

  private update(dt: number): void {
    if (this.saveData.player.crew.length > 0) this.lastKnownCrew = JSON.parse(JSON.stringify(this.saveData.player.crew));
    const activeSim = this.phase === 'playing' && !this.modalOpen;
    if (this.phase !== 'paused') {
      this.simTime += dt;
    }

    if (this.notificationTimer > 0) {
      this.notificationTimer -= dt;
      if (this.notificationTimer <= 0) this.notificationText = null;
    }
    if (this.damageBannerTimer > 0) {
      this.damageBannerTimer -= dt;
      if (this.damageBannerTimer <= 0) this.damageBanner = null;
    }
    if (this.damageNotifications.length > 0) {
      this.damageNotifications = this.damageNotifications
        .map((n) => ({ ...n, ttl: (n.ttl ?? 5.5) - dt }))
        .filter((n) => (n.ttl ?? 0) > 0);
    }
    if (this.worldDamagePopups.length > 0) {
      for (const wp of this.worldDamagePopups) {
        wp.life -= dt;
        wp.worldY += dt * 1.45;
      }
      this.worldDamagePopups = this.worldDamagePopups.filter((wp) => wp.life > 0);
    }
    if (this.journalToastTimer > 0) {
      this.journalToastTimer -= dt;
      if (this.journalToastTimer <= 0) this.journalToastText = null;
    }
    if (this.victoryThemeTimer > 0) this.victoryThemeTimer -= dt;
    if (this.fleetBattleTimer > 0) this.fleetBattleTimer -= dt;
    if (this.crownHailCooldown > 0) this.crownHailCooldown -= dt;

    if (this.activeTutorial) {
      this.tutorialTimer -= dt;
      if (this.tutorialTimer <= 0) {
        this.dismissTutorialToast(false);
      }
    }

    if (this.trauma > 0) {
      this.trauma = Math.max(0, this.trauma - dt * 1.45);
    }

    if (this.playerSinkingTimer > 0) {
      this.playerSinkingTimer -= dt;
      if (this.playerSinkingTimer <= 0) {
        this.triggerPermadeath(this.playerSinkingCause || 'Your vessel sank beneath the waves.');
        return;
      }
    }

    // Gradual 24-hour cycle (Sunrise -> Morning -> Midday -> Sunset -> Night) — paused while ashore in FPS
    const oceanActive = activeSim && this.playerSinkingTimer <= 0 && !this.fps.active;
    if (oceanActive) {
      this.saveData.timeOfDay += dt * (24 / GAME_DAY_SECONDS);
      if (this.saveData.timeOfDay >= 24) {
        this.saveData.timeOfDay -= 24;
        this.saveData.day++;
        this.saveData.stats.daysSurvived = this.saveData.day;

        // Daily faction diplomacy evolution
        const dip = evolveFactionDiplomacy(this.saveData.factions, this.rand);
        this.saveData.factions = dip.factions;
        if (dip.headline) {
          this.pushNotification(dip.headline);
          this.addLog('Sea Lanes Dispatch', dip.headline);
        }
      }

      this.updateWeather(dt);

      // Periodic pirate hunter patrol
      this.hunterSpawnTimer -= dt;
      if (this.hunterSpawnTimer <= 0) {
        this.hunterSpawnTimer = 95 + this.rand() * 50;
        this.maybeSpawnPirateHunter();
      }

      // Bounty notice projection & expiry updates
      this.updateBountySystem(dt);
    }

    this.updateAtmosphereVisuals(dt);
    if (this.fps.active) {
      this.fps.update(
        dt,
        this.keys,
        this.saveData,
        activeSim,
        () => this.sound.playFootstep(),
        () => this.sound.playFlintlockReload()
      );
      if (activeSim && this.fps.island) {
        for (const gEntry of this.islandPirateGuards.values()) {
          const guard = gEntry.data;
          if (guard.islandId !== this.fps.island.id) continue;
          if (!guard.dead) {
            const gStep = stepIslandPirateGuard(
              guard,
              this.fps.pos.x,
              this.fps.pos.z,
              this.fps.weapons.isBlocking,
              dt,
              getGuardAttitude(guard, this.saveData) === 'hostile'
            );
            guard.y = Math.max(0.25, sampleIslandTerrainHeight(this.fps.island, guard.x, guard.z));
            const totalGuardDmg = gStep.meleeDamage + gStep.rangedShotDamage;
            if (gStep.rangedFired) {
              this.sound.playPistolShot();
              this.spawnMuzzleEffects(new THREE.Vector3(guard.x, guard.y + 1.35, guard.z));
            } else if (gStep.meleeDamage > 0) {
              this.sound.playCutlassSwing();
              this.sound.playCutlassHit();
            }
            if (totalGuardDmg > 0) {
              this.fps.playerHp = Math.max(0, this.fps.playerHp - totalGuardDmg);
              this.fps.setStatus(
                this.fps.weapons.isBlocking
                  ? `Parried ${guard.name} (-${totalGuardDmg} HP)!`
                  : `${guard.name} hit you (-${totalGuardDmg} HP)!`
              );
            }
          }
          gEntry.built.root.position.set(guard.x, guard.y, guard.z);
          gEntry.built.root.rotation.y = Math.atan2(Math.sin(guard.heading), Math.cos(guard.heading));
          animateIslandPirateGuardMesh(gEntry.built, guard);
        }
      }
      if (this.fps.playerHp <= 0) {
        this.fps.playerHp = 100;
        this.addLog('Explorer Lost Ashore', 'Your explorer was lost during the island expedition. The ship and crew will be retained.');
        this.boardShipFromIsland();
        this.triggerPermadeath('Your explorer was lost during the island expedition.');
      }
    }
    this.updatePlayerPhysics(dt, oceanActive);
    this.updateEntities(dt, activeSim && this.playerSinkingTimer <= 0);
    this.syncSharedWorld(dt);
    if (oceanActive) {
      this.updateUnifiedPlayerCombat(dt);
      this.resolveAllCollisions(dt);
    }
    if (!this.fps.active) {
      this.updateCannonballs(dt);
    }
    this.updateParticles(dt);
    this.updateRemotePlayers(dt);
    this.updateCamera(dt);

    if (activeSim) {
      if (!this.fps.active) {
        this.survivalAccum += dt;
        if (this.survivalAccum >= 1.0) {
          const step = this.survivalAccum;
          this.survivalAccum = 0;
          this.runSurvivalTick(step);
        }
      }

      if (this.saveData.settings.autoSaveEnabled) {
        this.autosaveAccum += dt;
        if (this.autosaveAccum >= 30) {
          this.autosaveAccum = 0;
          saveVoyageToStorage(this.getSaveSnapshot());
          this.autosaveTick++;
        }
      }
    }

    this.sound.setMusicTheme(this.selectCurrentMusicTheme());
    this.sound.updateAmbience(
      dt,
      this.simTime,
      this.saveData.weather.waveIntensity,
      this.saveData.weather.windSpeed,
      this.saveData.weather.rainIntensity,
      Math.abs(this.saveData.player.speed),
      this.phase === 'paused' || this.phase === 'title',
      this.saveData.weather.hailIntensity ?? 0
    );

    this.hudEmitAccum += dt;
    if (this.hudEmitAccum >= 0.125) {
      this.hudEmitAccum = 0;
      this.emitHud();
    }
  }

  private updateUnifiedPlayerCombat(dt: number): void {
    if (!this.combat.active) return;

    const px = this.saveData.player.x;
    const pz = this.saveData.player.z;
    const stats = computeAutoCombatStats(
      this.saveData.player.upgrades,
      this.saveData.player.crew,
      this.combat.command
    );
    this.combat.playerReloadTime = stats.reloadTime;
    this.combat.playerReload = Math.min(1, this.combat.playerReload + dt / Math.max(1.1, stats.reloadTime));

    const keptEnemies: CombatEnemyRef[] = [];
    for (const ref of this.getCombatEnemies()) {
      const pos = this.getEnemyWorldPos(ref);
      if (!pos) continue;
      const d = Math.hypot(pos.x - px, pos.z - pz);
      if (d > 265) {
        if (ref.kind === 'pirate') {
          const pir = this.pirates.get(ref.id)?.data;
          if (pir) {
            pir.hailCooldown = 55;
            pir.behavior = 'patrol';
          }
        }
        this.pushNotification(`Disengaged from ${pos.name} beyond 265m.`);
        continue;
      }
      keptEnemies.push(ref);
    }

    this.combat.enemies = keptEnemies;
    this.syncCombatPrimaryFields();
    if (!this.combat.active) return;

    let anyInRange = false;
    for (const ref of keptEnemies) {
      const pos = this.getEnemyWorldPos(ref);
      if (pos && Math.hypot(pos.x - px, pos.z - pz) <= stats.fireRange) {
        anyInRange = true;
        break;
      }
    }

    if (
      this.combat.playerReload >= 0.99 &&
      this.combat.command !== 'surrender' &&
      stats.effectiveCannons > 0 &&
      anyInRange
    ) {
      this.triggerPlayerFire();
    }
  }

  private updateWeather(dt: number): void {
    if (!this.isMultiplayerWorldAuthority) return;
    const w = this.saveData.weather;
    w.timeUntilChange -= dt;
    if (w.timeUntilChange <= 0) {
      const prevType = w.type;
      const nextType = pickNextWeather(w.type, this.rand);
      const nextDur = 80 + this.rand() * 80;
      const built = buildWeatherStateFromType(
        nextType,
        normalizeAngle(w.windDir + (this.rand() - 0.5) * 1.15),
        nextDur
      );
      w.type = built.type;
      w.timeUntilChange = built.timeUntilChange;
      w.windDir = built.windDir;
      this.saveData.weatherForecast = generateWeatherForecast(nextType, nextDur, this.rand, 3);

      const prevPreset = WEATHER_PRESETS[prevType];
      const nextPreset = WEATHER_PRESETS[nextType];

      if (nextType === 'tornado') {
        this.tornadoPos = {
          x: this.saveData.player.x + (this.rand() - 0.5) * 180,
          z: this.saveData.player.z + (this.rand() - 0.5) * 180,
          vx: (this.rand() - 0.5) * 14,
          vz: (this.rand() - 0.5) * 14,
          active: true,
        };
        this.pushNotification('WATERSPOUT TORNADO SPOTTED! Steer clear of the funnel!');
        this.addLog('Ocean Tornado Sighted', 'A violent waterspout tornado formed across the shipping lane!');
      } else if (prevType === 'tornado') {
        this.tornadoPos.active = false;
      }

      const prevHeavy =
        prevPreset.severity === 'Dangerous' || prevPreset.severity === 'Extreme' || prevPreset.severity === 'Rough';
      const nextCalm = nextPreset.severity === 'Calm' || nextPreset.severity === 'Fair';
      const nextHeavy = nextPreset.severity === 'Dangerous' || nextPreset.severity === 'Extreme';

      if (prevHeavy && nextCalm) {
        this.addLog('Weathered the Storm', `The skies cleared to ${nextPreset.label}.`);
        this.pushNotification(`Weather eased — ${nextPreset.label}.`);
      } else if (nextHeavy && nextType !== 'tornado') {
        this.pushNotification(`Barometer falling! ${nextPreset.label} rolling in!`);
        this.triggerTutorial(
          'first_storm',
          'Heavy Weather',
          'Keep your bow into heavy swells. Open Ship Management [Tab] to start manual repairs if hull planks crack.'
        );
      }
    }

    const target = WEATHER_PRESETS[w.type];
    const k = 1 - Math.exp(-0.22 * dt);
    w.windSpeed += (target.windSpeed - w.windSpeed) * k;
    w.waveIntensity += (target.waveIntensity - w.waveIntensity) * k;
    w.fogDensity += (target.fogDensity - w.fogDensity) * k;
    w.rainIntensity += (target.rainIntensity - w.rainIntensity) * k;
    w.snowIntensity = (w.snowIntensity ?? 0) + ((target.snowIntensity ?? 0) - (w.snowIntensity ?? 0)) * k;
    w.hailIntensity = (w.hailIntensity ?? 0) + ((target.hailIntensity ?? 0) - (w.hailIntensity ?? 0)) * k;
    w.waterDrainMult = target.waterDrainMult;
    w.visibilityLabel = target.visibilityLabel;
    w.seaConditionLabel = target.seaConditionLabel;
    w.warningText = target.warningText;

    this.rogueWaveTimer -= dt;
    if (this.rogueWaveTimer <= 0 && w.waveIntensity > 1.5) {
      this.rogueWaveTimer = 38 + this.rand() * 45;
      this.rogueWaveBoost = 1.0;
      this.pushNotification('Rogue wave swell ahead! Keep the bow into the seas!');
    }
    this.rogueWaveBoost = Math.max(0, this.rogueWaveBoost - dt * 0.08);

    // Lightning bolts in Thunderstorm, Lightning Storm, Hurricane & Tornado
    if (
      w.type === 'thunderstorm' ||
      w.type === 'lightning_storm' ||
      w.type === 'hurricane' ||
      w.type === 'tornado'
    ) {
      this.lightningTimer -= dt;
      if (this.lightningTimer <= 0) {
        this.lightningTimer = w.type === 'lightning_storm' ? 3.5 + this.rand() * 5.5 : 7 + this.rand() * 12;
        w.lightningFlash = 1.0;
        this.spawnLightningBolt(w.type === 'lightning_storm');
      }
    }
    w.lightningFlash = Math.max(0, w.lightningFlash - dt * 2.8);

    for (let i = this.lightningBolts.length - 1; i >= 0; i--) {
      const lb = this.lightningBolts[i];
      lb.life -= dt;
      if (lb.life <= 0) {
        this.scene.remove(lb.mesh);
        lb.mesh.geometry.dispose();
        (lb.mesh.material as THREE.Material).dispose();
        this.lightningBolts.splice(i, 1);
      }
    }

    // Active 3D Tornado Waterspout physics
    if (w.type === 'tornado') {
      if (!this.tornadoGroup) {
        this.tornadoGroup = buildTornadoMesh();
        this.scene.add(this.tornadoGroup);
      }
      this.tornadoGroup.visible = true;
      this.tornadoPos.active = true;
      if (this.isMultiplayerWorldAuthority) {
        this.tornadoPos.x += this.tornadoPos.vx * dt;
        this.tornadoPos.z += this.tornadoPos.vz * dt;
        const authorityDistance = Math.hypot(this.tornadoPos.x - this.saveData.player.x, this.tornadoPos.z - this.saveData.player.z);
        if (authorityDistance > 260) {
          // The elected world authority owns the shared tornado's movement.
          const ang = Math.atan2(this.saveData.player.z - this.tornadoPos.z, this.saveData.player.x - this.tornadoPos.x);
          this.tornadoPos.vx = Math.cos(ang) * 9;
          this.tornadoPos.vz = Math.sin(ang) * 9;
        }
      }
      const distPlayerTorn = Math.hypot(this.tornadoPos.x - this.saveData.player.x, this.tornadoPos.z - this.saveData.player.z);
      this.tornadoGroup.position.set(this.tornadoPos.x, 0, this.tornadoPos.z);
      for (const child of this.tornadoGroup.children) {
        const sr = (child.userData.spinRate as number) || 1.8;
        child.rotation.y += sr * dt;
      }
      if (distPlayerTorn < 54 && this.playerSinkingTimer <= 0) {
        const pullAng = Math.atan2(this.tornadoPos.z - this.saveData.player.z, this.tornadoPos.x - this.saveData.player.x);
        this.saveData.player.x += Math.cos(pullAng) * 5.2 * dt;
        this.saveData.player.z += Math.sin(pullAng) * 5.2 * dt;
        this.saveData.player.condition.hull = Math.max(0, this.saveData.player.condition.hull - 3.6 * dt);
        this.saveData.player.condition.sails = Math.max(10, this.saveData.player.condition.sails - 4.4 * dt);
        this.trauma = Math.min(1, this.trauma + 0.25 * dt);
        this.checkPermadeath('Waterspout Tornado');
      }
    } else if (this.tornadoGroup) {
      this.tornadoGroup.visible = false;
      this.tornadoPos.active = false;
    }

    // Hail impact sound effects during hail / severe_hail
    if ((w.hailIntensity ?? 0) > 0.25) {
      this.hailImpactTimer -= dt;
      if (this.hailImpactTimer <= 0) {
        this.hailImpactTimer = 0.28 + this.rand() * 0.35;
        this.sound.playHailImpact();
      }
    }
  }

  private spawnLightningBolt(canStrikeShip: boolean): void {
    const px = this.saveData.player.x;
    const pz = this.saveData.player.z;
    const directStrike = canStrikeShip && this.rand() < 0.16;
    const bx = directStrike ? px + (this.rand() - 0.5) * 14 : px + (this.rand() - 0.5) * 260;
    const bz = directStrike ? pz + (this.rand() - 0.5) * 14 : pz + (this.rand() - 0.5) * 260;

    const mat = new THREE.MeshBasicMaterial({ color: 0xe0f2fe });
    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.85, 130, 6), mat);
    bolt.position.set(bx, 62, bz);
    bolt.rotation.z = (this.rand() - 0.5) * 0.18;
    bolt.rotation.x = (this.rand() - 0.5) * 0.18;
    this.scene.add(bolt);
    this.lightningBolts.push({ mesh: bolt, life: 0.22 });
    this.sound.playLightningCrack();

    if (directStrike && this.playerSinkingTimer <= 0) {
      const dmg = 6 + Math.floor(this.rand() * 5);
      this.saveData.player.condition.mast = Math.max(10, this.saveData.player.condition.mast - dmg);
      this.saveData.player.condition.sails = Math.max(10, this.saveData.player.condition.sails - dmg);
      this.trauma = Math.min(1, this.trauma + 0.55);
      this.emitDamageBanner(`LIGHTNING STRIKE — MAST & SAILS — ${dmg} DAMAGE`, 'mast', dmg, true);
    }
  }

  private updateAtmosphereVisuals(dt: number): void {
    const h = this.saveData.timeOfDay;
    const w = this.saveData.weather;
    const preset = WEATHER_PRESETS[w.type];
    const stormDark = preset.skyDarkness;
    const isHeatwave = w.type === 'heatwave';
    const isCold = (w.snowIntensity ?? 0) > 0.2 || (w.hailIntensity ?? 0) > 0.2;

    const sunAngle = ((h - 6) / 24) * Math.PI * 2;
    const sunY = Math.sin(sunAngle);
    const sunX = Math.cos(sunAngle) * 0.72;
    const sunZ = -0.68;
    const sunDir = this._v1.set(sunX, sunY, sunZ).normalize();

    const dayFactor = clamp((sunY + 0.14) / 0.42, 0, 1);
    const dawnDuskFactor = clamp(1 - Math.abs(sunY - 0.08) / 0.28, 0, 1) * (1 - stormDark * 0.75);
    const nightFactor = clamp((-sunY + 0.05) / 0.3, 0, 1);

    const zenith = new THREE.Color(0x091529)
      .lerp(new THREE.Color(isHeatwave ? 0x2b6cb0 : 0x1f568c), dayFactor)
      .lerp(new THREE.Color(0x47304d), dawnDuskFactor * 0.55)
      .lerp(new THREE.Color(isCold ? 0x3b4856 : 0x18212c), stormDark * 0.72);

    const horizon = new THREE.Color(0x152b47)
      .lerp(new THREE.Color(isHeatwave ? 0xf6d594 : 0x9dc7db), dayFactor * (isHeatwave ? 0.45 : 1))
      .lerp(new THREE.Color(0xe38a52), dawnDuskFactor * 0.76)
      .lerp(new THREE.Color(isCold ? 0x8091a1 : 0x2d3a47), stormDark * 0.75);

    const sunCol = new THREE.Color(0xa6c7f0)
      .lerp(new THREE.Color(isHeatwave ? 0xffdf91 : 0xfff1cf), dayFactor)
      .lerp(new THREE.Color(0xff9e54), dawnDuskFactor * 0.85);

    if (w.lightningFlash > 0.01) {
      zenith.lerp(new THREE.Color(0xdbe8f8), w.lightningFlash * 0.65);
      horizon.lerp(new THREE.Color(0xeef5ff), w.lightningFlash * 0.65);
    }

    this.skyUniforms.uZenithColor.value.copy(zenith);
    this.skyUniforms.uHorizonColor.value.copy(horizon);
    this.skyUniforms.uSunDir.value.copy(sunDir);
    this.skyUniforms.uSunColor.value.copy(sunCol);
    this.skyUniforms.uSunVisibility.value = clamp((dayFactor + dawnDuskFactor * 0.6) * (1 - stormDark * 0.8), 0, 1);
    this.skyUniforms.uMoonVisibility.value = clamp(nightFactor * (1 - stormDark * 0.8), 0, 1);

    (this.starsPoints.material as THREE.PointsMaterial).opacity = clamp(
      nightFactor * (1 - stormDark) * 0.96,
      0,
      0.96
    );

    const activeKeyDir = sunY >= -0.05 ? sunDir : this._v2.copy(sunDir).negate();
    this.sunLight.position.set(
      this.saveData.player.x + activeKeyDir.x * 110,
      Math.max(24, activeKeyDir.y * 110),
      this.saveData.player.z + activeKeyDir.z * 110
    );
    this.sunLight.target.position.set(this.saveData.player.x, 0, this.saveData.player.z);
    this.sunLight.color.copy(sunY >= -0.05 ? sunCol : new THREE.Color(0xa6c7f0));
    this.sunLight.intensity =
      (sunY >= -0.05 ? 2.4 * dayFactor + 0.65 : 1.05 * nightFactor + 0.35) * (1 - stormDark * 0.42) +
      (isHeatwave ? 0.55 : 0) +
      w.lightningFlash * 2.8;

    this.hemiLight.color.copy(sunY >= -0.05 ? horizon : new THREE.Color(0x2a4a70));
    if (this.nearbyGhostFactor > 0.02) {
      this.hemiLight.color.lerp(new THREE.Color(0x30cc78), this.nearbyGhostFactor * 0.42);
    }
    this.hemiLight.groundColor.setHex(0x0f2536);
    this.hemiLight.intensity = 0.68 + dayFactor * 0.45 - stormDark * 0.16;

    this.playerShip.lanternLight.intensity = 0.9 + (1 - dayFactor) * 3.8 + stormDark * 1.6;

    this.fog.color.copy(horizon);
    if (this.nearbyGhostFactor > 0.01) {
      this.fog.color.lerp(new THREE.Color(0x104628), Math.min(0.84, 0.25 + this.nearbyGhostFactor * 0.62));
    }
    const ghostFogBoost = this.nearbyGhostFactor * 0.0042;
    this.fog.density = w.fogDensity + ghostFogBoost;

    const nextBiome = getOceanBiome(this.saveData.player.x, this.saveData.player.z, this.saveData.seed);
    this.currentBiome = nextBiome;
    const bCfg = getBiomeConfig(nextBiome);
    const biomeBlendK = 1 - Math.exp(-1.5 * dt);
    this.biomeDeepColor.lerp(new THREE.Color(bCfg.deepColorHex), biomeBlendK);
    this.biomeShallowColor.lerp(new THREE.Color(bCfg.shallowColorHex), biomeBlendK);

    const deepOcean = this.biomeDeepColor
      .clone()
      .lerp(new THREE.Color(0x0d1b26), stormDark * 0.58)
      .multiplyScalar(0.35 + dayFactor * 0.65);
    const shallowOcean = this.biomeShallowColor
      .clone()
      .lerp(new THREE.Color(0x28434f), stormDark * 0.52)
      .multiplyScalar(0.38 + dayFactor * 0.62);

    const waterSkyHorizon = horizon.clone();
    if (nextBiome === 'cold') {
      waterSkyHorizon.lerp(new THREE.Color(0x76a8c7), 0.62);
    } else if (nextBiome === 'tropical') {
      waterSkyHorizon.lerp(new THREE.Color(0x45a3a8), 0.44);
    } else if (nextBiome === 'deep') {
      waterSkyHorizon.lerp(new THREE.Color(0x091627), 0.72);
    }

    this.oceanUniforms.uTime.value = this.simTime;
    this.oceanUniforms.uWaveIntensity.value = w.waveIntensity;
    this.oceanUniforms.uRogueBoost.value = this.rogueWaveBoost;
    this.oceanUniforms.uDeepColor.value.copy(deepOcean);
    this.oceanUniforms.uShallowColor.value.copy(shallowOcean);
    this.oceanUniforms.uSkyColor.value.copy(waterSkyHorizon);
    this.oceanUniforms.uHorizonColor.value.copy(this.fog.color);
    this.oceanUniforms.uSunDir.value.copy(activeKeyDir);
    this.oceanUniforms.uSunColor.value.copy(sunY >= -0.05 ? sunCol : new THREE.Color(0xb4d2f4));
    this.oceanUniforms.uFogDensity.value = this.fog.density;

    // Pass up to 4 nearest islands into ocean shader for tropical reef clarity & glowing white surf rings
    const refX = this.fps.active ? this.fps.pos.x : this.saveData.player.x;
    const refZ = this.fps.active ? this.fps.pos.z : this.saveData.player.z;
    const nearestIslands = Array.from(this.islands.values())
      .map((e) => ({ data: e.data, dist: Math.hypot(e.data.x - refX, e.data.z - refZ) }))
      .filter((it) => it.dist < 620)
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 4);
    const centersUniform = this.oceanUniforms.uIslandCenters.value as THREE.Vector3[];
    const metaUniform = this.oceanUniforms.uIslandMeta.value as THREE.Vector4[];
    for (let i = 0; i < 4; i++) {
      const slot = nearestIslands[i];
      if (slot) {
        centersUniform[i].set(slot.data.x, slot.data.z, slot.data.radius);
        metaUniform[i].set(
          slot.data.seed,
          slot.data.biome === 'tropical' ? 1.0 : 0.0,
          1.0,
          slot.data.reefRingRadius
        );
      } else {
        centersUniform[i].set(0, 0, 0);
        metaUniform[i].set(0, 0, 0, 0);
      }
    }

    this.skyMesh.position.set(this.saveData.player.x, 0, this.saveData.player.z);
    this.starsPoints.position.set(this.saveData.player.x, 0, this.saveData.player.z);
    this.cloudsGroup.position.set(this.saveData.player.x, 0, this.saveData.player.z);
    if (!this.fps.active) {
      this.cloudsGroup.rotation.y += dt * 0.004 * (w.windSpeed / 12);
    }

    const snowI = w.snowIntensity ?? 0;
    const hailI = w.hailIntensity ?? 0;
    const precipIntensity = Math.max(w.rainIntensity, snowI, hailI);
    const rainMat = this.rainPoints.material as THREE.PointsMaterial;
    rainMat.opacity = precipIntensity * 0.72;
    if (snowI > hailI && snowI > w.rainIntensity) {
      rainMat.color.setHex(0xf1f5f9);
      rainMat.size = 0.62;
    } else if (hailI > w.rainIntensity) {
      rainMat.color.setHex(0xe0f2fe);
      rainMat.size = 0.52;
    } else {
      rainMat.color.setHex(0xbdd1e0);
      rainMat.size = 0.35;
    }

    if (precipIntensity > 0.02 && !this.fps.active) {
      this.rainPoints.position.set(this.saveData.player.x, 0, this.saveData.player.z);
      const rPos = this.rainPoints.geometry.attributes.position as THREE.BufferAttribute;
      const fallSpeed = snowI > hailI && snowI > w.rainIntensity ? 8 + snowI * 5 : hailI > 0.2 ? 42 + hailI * 22 : 34 + w.rainIntensity * 16;
      const driftX = snowI > 0.15 ? Math.sin(this.simTime * 1.4) * 4.5 : w.windSpeed * 0.18;
      for (let i = 0; i < rPos.count; i++) {
        let rx = rPos.getX(i) + dt * driftX;
        let ry = rPos.getY(i) - dt * fallSpeed;
        if (ry < 0) ry = 45;
        if (rx > 45) rx = -45;
        if (rx < -45) rx = 45;
        rPos.setX(i, rx);
        rPos.setY(i, ry);
      }
      rPos.needsUpdate = true;
    }
  }

  private updatePlayerPhysics(dt: number, activeSim: boolean): void {
    const p = this.saveData.player;
    const w = this.saveData.weather;
    const perf = computeCrewPerformance(p.crew, p.upgrades);
    const handling = computeShipHandling(p.upgrades, p.condition, perf, w);

    let turnInput = 0;
    if (activeSim) {
      if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) {
        p.isStopping = false;
        p.throttle = clamp(p.throttle + dt * 0.65, -0.35, 1.0);
      } else if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) {
        p.isStopping = false;
        p.throttle = clamp(p.throttle - dt * 0.85, -0.35, 1.0);
      }

      if (p.isStopping) {
        p.throttle = THREE.MathUtils.damp(p.throttle, 0, 2.5, dt);
        if (Math.abs(p.throttle) < 0.01) p.throttle = 0;
      }

      if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) turnInput += 1;
      if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) turnInput -= 1;

      if (this.steeringHexTimer > 0) {
        this.steeringHexTimer = Math.max(0, this.steeringHexTimer - dt);
        turnInput += Math.sin(this.simTime * 5.2) * 0.55;
      }

      p.rudder = THREE.MathUtils.damp(p.rudder, turnInput, 4.5, dt);

      const steerAuth = 0.42 + 0.58 * clamp(Math.abs(p.speed) / 4.5, 0, 1);
      const turnDelta = p.rudder * handling.turnRate * steerAuth * dt;
      p.heading = normalizeAngle(p.heading + turnDelta);

      const windAlign = Math.cos(normalizeAngle(p.heading - w.windDir));
      const windFactor = 0.86 + windAlign * 0.16;
      const combatSpeedMult = this.combat.active
        ? computeAutoCombatStats(p.upgrades, p.crew, this.combat.command).speedBonusMult
        : 1.0;

      if (p.isStopping) {
        p.speed = THREE.MathUtils.damp(p.speed, 0, handling.stopDragLambda, dt);
        if (Math.abs(p.speed) < 0.04) p.speed = 0;
      } else {
        const targetSpeed = p.throttle * handling.maxSpeed * windFactor * combatSpeedMult;
        const accelLambda = p.throttle > 0.05 ? handling.acceleration * 0.35 : 0.62;
        p.speed = THREE.MathUtils.damp(p.speed, targetSpeed, accelLambda, dt);
      }

      const windPush = !p.isStopping && w.windSpeed > 22 ? (w.windSpeed - 22) * 0.045 : 0;
      const fwdX = -Math.sin(p.heading);
      const fwdZ = -Math.cos(p.heading);

      const moveX = (fwdX * p.speed + Math.cos(w.windDir) * windPush) * dt;
      const moveZ = (fwdZ * p.speed + Math.sin(w.windDir) * windPush) * dt;
      p.x += moveX;
      p.z += moveZ;
      this.resolvePredictedMultiplayerShipCollisions();
      this.saveData.stats.distanceSailed += Math.hypot(moveX, moveZ);

      const mapCx = Math.floor(p.x / 60);
      const mapCz = Math.floor(p.z / 60);
      const sightRadius = p.upgrades.crowsNest ? 2 : 1;
      for (let gx = -sightRadius; gx <= sightRadius; gx++) {
        for (let gz = -sightRadius; gz <= sightRadius; gz++) {
          this.exploredCells.add(`${mapCx + gx},${mapCz + gz}`);
        }
      }

      this.streamWorldAroundPlayer();
    }

    const snap = 12;
    const ox = Math.floor(p.x / snap) * snap;
    const oz = Math.floor(p.z / snap) * snap;
    this.oceanMesh.position.set(ox, 0, oz);
    this.oceanUniforms.uOffset.value.set(ox, oz);
    this.oceanUniforms.uBoatPos.value.set(p.x, 0, p.z);
    this.oceanUniforms.uBoatFwd.value.set(-Math.sin(p.heading), -Math.cos(p.heading));
    this.oceanUniforms.uBoatSpeed.value = Math.abs(p.speed);

    // Buoyancy always keeps the vessel naturally bobbing on waves even when stopped
    const pose = computeBoatBuoyancy(
      p.x,
      p.z,
      p.heading,
      this.playerShip.halfLength,
      this.playerShip.halfBeam,
      handling.stability,
      p.rudder * handling.turnRate,
      p.speed,
      this.simTime,
      w.waveIntensity,
      this.rogueWaveBoost
    );

    this.playerImpactRoll = THREE.MathUtils.damp(this.playerImpactRoll, 0, 5.2, dt);
    this.playerImpactPitch = THREE.MathUtils.damp(this.playerImpactPitch, 0, 5.2, dt);
    this.playerCannonRecoil = Math.max(0, this.playerCannonRecoil - dt * 3.8);

    const sinkDepth = this.playerSinkingTimer > 0 ? (1 - this.playerSinkingTimer / 1.8) * 4.5 : 0;
    const sinkTilt = this.playerSinkingTimer > 0 ? (1 - this.playerSinkingTimer / 1.8) * 0.68 : 0;

    this.playerShip.root.position.set(p.x, pose.y - sinkDepth, p.z);
    this.playerShip.root.rotation.order = 'YXZ';
    this.playerShip.root.rotation.y = p.heading;
    this.playerShip.root.rotation.x = THREE.MathUtils.damp(
      this.playerShip.root.rotation.x,
      pose.pitch + this.playerImpactPitch + sinkTilt * 0.45,
      6.5,
      dt
    );
    this.playerShip.root.rotation.z = THREE.MathUtils.damp(
      this.playerShip.root.rotation.z,
      pose.roll + this.playerImpactRoll + sinkTilt,
      6.5,
      dt
    );

    // Flag animation
    animateWavingFlag(this.playerShip.flagMesh, this.simTime, w.windSpeed / 12);

    // Cannon aim & recoil
    let aimTarget: { x: number; z: number } | null = null;
    if (this.combat.active) {
      const enemies = this.getCombatEnemies();
      const primRef = enemies.find((e) => e.id === this.combat.primaryTargetId) ?? enemies[0];
      if (primRef) aimTarget = this.getEnemyWorldPos(primRef);
    }

    for (const cg of this.playerShip.cannonGroups) {
      const baseX = (cg.userData.baseX as number) ?? cg.position.x;
      const side = (cg.userData.side as number) ?? 1;
      cg.position.x = baseX - side * this.playerCannonRecoil * 0.36;
      if (aimTarget) {
        const worldBearing = Math.atan2(-(aimTarget.x - p.x), -(aimTarget.z - p.z));
        const rel = normalizeAngle(worldBearing - p.heading);
        const baseRot = side === -1 ? Math.PI : 0;
        const aimBias = clamp(Math.cos(rel) * 0.35, -0.35, 0.35) * side;
        cg.rotation.y = baseRot + aimBias;
      }
    }

    const hullPct = p.condition.hull;
    this.playerShip.damagePatches.forEach((patch, idx) => {
      patch.visible = hullPct < 82 - idx * 18;
    });
    this.playerSmokeAccum += dt;
    const emitMarkSmoke = this.playerSmokeAccum >= 0.24;
    if (this.playerDamageMarkMeshes.length > 0) {
      this.animateDamageMarksOnRoot(this.playerDamageMarkMeshes, p.x, p.z, emitMarkSmoke);
    }
    if (hullPct < 65) {
      if (this.playerSmokeAccum > (hullPct < 30 ? 0.12 : 0.25)) {
        this.playerSmokeAccum = 0;
        this.spawnParticle(
          p.x + (Math.random() - 0.5) * 2.4,
          pose.y + 1.5,
          p.z + (Math.random() - 0.5) * 3.0,
          (Math.random() - 0.5) * 0.8,
          2.2 + Math.random() * 1.4,
          (Math.random() - 0.5) * 0.8,
          1.4,
          hullPct < 30 && Math.random() < 0.35 ? 0.92 : 0.28,
          hullPct < 30 && Math.random() < 0.35 ? 0.42 : 0.28,
          hullPct < 30 && Math.random() < 0.35 ? 0.15 : 0.3
        );
      }
    } else if (emitMarkSmoke) {
      this.playerSmokeAccum = 0;
    }

    this.playerShip.helmWheel.rotation.z = -p.rudder * 1.4;
    const billow = p.isStopping
      ? 0.56
      : 0.72 + clamp(Math.abs(p.throttle) * 0.55 + w.windSpeed * 0.012, 0, 0.78);
    for (const s of this.playerShip.sails) {
      s.scale.z = THREE.MathUtils.damp(s.scale.z, billow + Math.sin(this.simTime * 3.1) * 0.05, 5, dt);
    }

    for (const actor of this.playerShip.crewActors) {
      const t = this.simTime * (actor.role === 'resting' ? 0.6 : 1.5) + actor.phase;
      actor.group.position.x = actor.baseX + Math.sin(t) * actor.patrolAmp;
      actor.group.position.z = actor.baseZ + Math.cos(t * 0.85) * actor.patrolAmp;
      actor.group.rotation.y = Math.atan2(Math.cos(t), -Math.sin(t * 0.85));
    }

    if (Math.abs(p.speed) > 1.4 || pose.splashIntensity > 0.45) {
      const fwdX = -Math.sin(p.heading);
      const fwdZ = -Math.cos(p.heading);
      const rightX = Math.cos(p.heading);
      const rightZ = -Math.sin(p.heading);

      if (Math.random() < clamp(Math.abs(p.speed) * 0.14 + pose.splashIntensity * 0.6, 0.08, 0.9)) {
        const side = Math.random() < 0.5 ? -1 : 1;
        const bx = p.x + fwdX * this.playerShip.halfLength * 0.88 + rightX * side * 1.2;
        const bz = p.z + fwdZ * this.playerShip.halfLength * 0.88 + rightZ * side * 1.2;
        this.spawnParticle(
          bx,
          pose.y + 0.5,
          bz,
          rightX * side * (1.5 + Math.random() * 2.2) - fwdX * 0.8,
          1.4 + pose.splashIntensity * 2.8,
          rightZ * side * (1.5 + Math.random() * 2.2) - fwdZ * 0.8,
          0.95,
          0.9,
          0.95,
          0.98
        );
      }
    }
  }

  private updateEntities(dt: number, activeSim: boolean): void {
    const oceanSim = activeSim && !this.fps.active;
    const pirateSim = activeSim;
    const px = this.saveData.player.x;
    const pz = this.saveData.player.z;
    const w = this.saveData.weather;
    const perf = computeCrewPerformance(this.saveData.player.crew, this.saveData.player.upgrades);
    const discoverRange = 140 * perf.watchSightBonus;

    // 1. Shipwrecks (plus roaring flames & smoke particles on exploded/charred wrecks)
    this.wreckSmokeAccum += dt;
    const emitWreckFireNow = this.wreckSmokeAccum >= 0.095;
    if (emitWreckFireNow) this.wreckSmokeAccum = 0;

    for (const entry of this.wrecks.values()) {
      const wr = entry.data;
      const wh = sampleWaveHeight(wr.x, wr.z, this.simTime, w.waveIntensity, this.rogueWaveBoost);
      entry.mesh.position.y = wh - wr.sinkDepth + Math.sin(this.simTime * 0.9 + wr.x) * 0.14;

      const dist = Math.hypot(wr.x - px, wr.z - pz);
      if (wr.isCharred && dist < 340) {
        const fireMeshes = entry.mesh.userData.fireMeshes as THREE.Mesh[] | undefined;
        if (fireMeshes) {
          for (let f = 0; f < fireMeshes.length; f++) {
            const fm = fireMeshes[f];
            const phase = (fm.userData.phase as number) || f;
            const flick = 0.78 + Math.sin(this.simTime * 11.5 + phase) * 0.28;
            fm.scale.set(0.92 + Math.cos(this.simTime * 8 + phase) * 0.14, flick, 0.92);
          }
        }
        if (emitWreckFireNow) {
          const flameCount = wr.fullyLooted ? 1 : 2;
          for (let k = 0; k < flameCount; k++) {
            const ox = (Math.random() - 0.5) * 4.5 * wr.scale;
            const oz = (Math.random() - 0.5) * 8.5 * wr.scale;
            const isFire = !wr.fullyLooted && Math.random() < 0.58;
            this.spawnParticle(
              wr.x + ox,
              wh + 0.9 * wr.scale,
              wr.z + oz,
              (Math.random() - 0.5) * 1.1,
              isFire ? 2.8 + Math.random() * 2.4 : 2.1 + Math.random() * 1.6,
              (Math.random() - 0.5) * 1.1,
              isFire ? 0.68 : 1.55,
              isFire ? 0.98 : 0.17,
              isFire ? 0.42 + Math.random() * 0.3 : 0.16,
              isFire ? 0.08 : 0.15
            );
          }
        }
      }

      if (oceanSim && !wr.discovered && dist < discoverRange) {
        wr.discovered = true;
        this.recordMarker({
          id: wr.id,
          kind: 'wreck',
          name: wr.name,
          x: wr.x,
          z: wr.z,
          status: wr.fullyLooted ? 'Looted' : wr.isCharred ? 'Charred Wreck' : 'Unsearched',
        });
        this.addLog(`Discovered ${wr.name}`, `Lookouts spotted a wrecked hull (${wr.archetype.replace('_', ' ')}).`);
        this.pushNotification(`Discovered shipwreck: ${wr.name}`);
        this.triggerTutorial(
          'discover_wreck',
          'Shipwreck Spotted',
          'Sail close to a wreck and press E to search compartments for timber, gold, and castaways.'
        );
      }
    }

    // 2. Floating crates & rafts
    for (const entry of this.crates.values()) {
      const c = entry.data;
      const ch = sampleWaveHeight(c.x, c.z, this.simTime, w.waveIntensity, this.rogueWaveBoost);
      entry.mesh.position.y = ch + 0.05;
      if (!this.fps.active) {
        entry.mesh.rotation.y += dt * 0.35;
      }
      entry.mesh.rotation.z = Math.sin(this.simTime * 1.8 + c.x) * 0.18;

      if (oceanSim && !c.discovered && Math.hypot(c.x - px, c.z - pz) < discoverRange * 0.85) {
        c.discovered = true;
        this.triggerTutorial(
          'discover_crate',
          'Flotsam & Castaways',
          'Drifting crates, barrels, and rafts hold vital stores. Sail alongside and press E to salvage.'
        );
      }
    }

    this.nearbyGhostActive = false;
    this.nearbyGhostFactor = 0;
    this.nearbyMajorBattleActive = false;
    if (this.ghostWhisperCooldown > 0 && !this.fps.active) this.ghostWhisperCooldown -= dt;

    const threatIsCrown = this.getCombatEnemies().some(
      (ref) => ref.kind === 'merchant' && Boolean(this.merchants.get(ref.id)?.data.isCrown)
    );

    // 3. Civilian, Merchant Convoy & Crown Navy Ships
    for (const [mId, entry] of Array.from(this.merchants.entries())) {
      const m = entry.data;
      const remoteMerchant = this.getRemoteNpc(mId);
      if (remoteMerchant && !m.sunk) this.driveRemoteNpc(m, remoteMerchant, dt);
      animateWavingFlag(entry.flagMesh, this.simTime, w.windSpeed / 12);
      const distPlayer = Math.hypot(m.x - px, m.z - pz);
      if (!m.sunk && distPlayer < 460) {
        animateDeckCrewActors(entry.crewActors, this.simTime);
      }

      const mMarks = this.npcDamageMarks.get(m.id);
      if (mMarks && mMarks.length > 0 && !m.sunk) {
        this.animateDamageMarksOnRoot(mMarks, m.x, m.z, emitWreckFireNow && distPlayer < 260);
      }

      if (oceanSim && !m.sunk && !remoteMerchant) {
        if (m.fleeTimer > 0) {
          m.fleeTimer -= dt;
          if (m.fleeTimer <= 0) m.fleeingFromPlayer = false;
        }
        if ((m.desperateRamCooldown ?? 0) > 0) {
          m.desperateRamCooldown = Math.max(0, (m.desperateRamCooldown ?? 0) - dt);
        }

        const inCombatWithPlayer = this.isEnemyInCombat(m.id);

        if (m.battleId && distPlayer < 340) {
          this.nearbyMajorBattleActive = true;
          this.recordMarker({
            id: m.battleId,
            kind: 'battle',
            name: 'Major Naval Engagement',
            x: m.x,
            z: m.z,
            status: 'Active Fleet Clash',
          });
        }

        // Crown outlaw check (-25 Rep or below)
        if (
          m.isCrown &&
          !m.hostileToPlayer &&
          this.saveData.reputation <= -25 &&
          distPlayer < 110 &&
          this.crownHailCooldown <= 0 &&
          !this.combat.active &&
          !this.modalOpen
        ) {
          this.crownHailCooldown = 70;
          this.sound.playAlertBell();
          this.callbacks.onCrownHail({ ...m });
        }

        const distWp = Math.hypot(m.waypointX - m.x, m.waypointZ - m.z);
        if (distWp < 35) {
          const a = this.rand() * Math.PI * 2;
          const r = 240 + this.rand() * 340;
          m.waypointX = m.x + Math.cos(a) * r;
          m.waypointZ = m.z + Math.sin(a) * r;
        }

        let targetH = Math.atan2(-(m.waypointX - m.x), -(m.waypointZ - m.z));
        let desiredSpd = m.maxSpeed * 0.78;

        // Convoy formation steering: cargo ships & escorts keep formation with convoy lead
        if (m.convoyId && m.convoyRole !== 'lead' && !inCombatWithPlayer) {
          for (const other of this.merchants.values()) {
            if (!other.data.sunk && other.data.convoyId === m.convoyId && other.data.convoyRole === 'lead') {
              const slot = m.convoySlot ?? 1;
              const side = slot % 2 === 0 ? 1 : -1;
              const back = m.convoyRole === 'escort' ? 16 : 32 + Math.floor(slot / 2) * 28;
              const offX = side * (m.convoyRole === 'escort' ? 26 : 16);
              const fwdX = -Math.sin(other.data.heading);
              const fwdZ = -Math.cos(other.data.heading);
              const rgtX = Math.cos(other.data.heading);
              const rgtZ = -Math.sin(other.data.heading);
              const goalX = other.data.x - fwdX * back + rgtX * offX;
              const goalZ = other.data.z - fwdZ * back + rgtZ * offX;
              targetH = Math.atan2(-(goalX - m.x), -(goalZ - m.z));
              desiredSpd = clamp(other.data.speed * 1.06, 2.5, m.maxSpeed);
              break;
            }
          }
        }

        // Friendly AI assistance evaluation when player is in combat nearby
        let assistEnemyRef: CombatEnemyRef | null = null;
        let fleeActiveCombat = false;
        if (
          this.combat.active &&
          !inCombatWithPlayer &&
          !m.hostileToPlayer &&
          !m.surrenderedToPlayer &&
          distPlayer < 320
        ) {
          let dec = this.assistDecisions.get(m.id);
          if (!dec) {
            dec = decideFriendlyAssistance(
              { kind: 'merchant', ship: m },
              threatIsCrown,
              this.saveData.reputation,
              this.saveData.day,
              this.rand
            );
            this.assistDecisions.set(m.id, dec);
            if (dec.assists && !this.assistingAllies.has(m.id)) {
              this.assistingAllies.add(m.id);
              this.pushNotification(`${m.name} (${m.isCrown ? 'Crown Navy' : 'Allied Vessel'}) moved in to assist you!`);
            }
          }
          if (dec.assists && m.cannons > 0) {
            let bestEnemyD = 340;
            for (const ref of this.getCombatEnemies()) {
              if (ref.id === m.id) continue;
              const ep = this.getEnemyWorldPos(ref);
              if (!ep) continue;
              const ed = Math.hypot(ep.x - m.x, ep.z - m.z);
              if (ed < bestEnemyD) {
                bestEnemyD = ed;
                assistEnemyRef = ref;
              }
            }
          } else if (dec.shouldFlee && distPlayer < 220) {
            fleeActiveCombat = true;
          }
        }

        // Crown warships & battle vessels (or assisting merchants) hunt & fire on threats
        let crownTargetPirate: PirateShipData | null = null;
        if (!inCombatWithPlayer && assistEnemyRef) {
          const ep = this.getEnemyWorldPos(assistEnemyRef);
          if (ep) {
            const realD = Math.hypot(ep.x - m.x, ep.z - m.z);
            targetH = Math.atan2(-(ep.x - m.x), -(ep.z - m.z));
            desiredSpd = realD > 90 ? m.maxSpeed : m.maxSpeed * 0.85;
            if (realD < 175 && m.cannons > 0) {
              this.fleetBattleTimer = 6;
              m.reloadTimer -= dt;
              if (m.reloadTimer <= 0) {
                m.reloadTimer = 4.2 + this.rand() * 1.4;
                if (assistEnemyRef.kind === 'pirate') {
                  const foEntry = this.pirates.get(assistEnemyRef.id);
                  if (foEntry && !foEntry.data.defeated) {
                    const foe = foEntry.data;
                    const vol = resolveNpcVsNpcVolley(m.cannons, m.isCrown ? 14 : 11, foe.hull, this.rand);
                    foe.hull = vol.nextHull;
                    this.spawnNpcBroadside(
                      m.x,
                      m.z,
                      foe.x,
                      foe.z,
                      vol.hits > 0,
                      vol.hits > 0
                        ? () => {
                            if (!foe.defeated) {
                              this.attachBattleDamageMark({
                                targetKind: 'pirate',
                                shipId: foe.id,
                                root: foEntry.mesh,
                                shipX: foe.x,
                                shipZ: foe.z,
                                heading: foe.heading,
                                halfLength: foEntry.halfLength,
                                halfBeam: foEntry.halfBeam,
                                attackerX: m.x,
                                attackerZ: m.z,
                                section: 'hull',
                                kind: 'cannon',
                                damage: vol.damage,
                              });
                            }
                          }
                        : undefined
                    );
                    if (vol.hits > 0) {
                      foEntry.impactRoll += 0.14;
                      this.emitDamageNotification({
                        targetName: foe.name,
                        attackerName: m.name,
                        location: 'hull',
                        damage: vol.damage,
                        source: 'cannon',
                        direction: 'ally',
                      });
                    }
                    if (vol.sunk) this.handlePirateDefeated(foe);
                  }
                } else if (assistEnemyRef.kind === 'monster') {
                  const mon = this.monsters.get(assistEnemyRef.id)?.data;
                  if (mon && !mon.defeated) {
                    const vol = resolveNpcVsNpcVolley(m.cannons, m.isCrown ? 14 : 11, mon.hp, this.rand);
                    mon.hp = vol.nextHull;
                    this.spawnNpcBroadside(m.x, m.z, mon.x, mon.z, vol.hits > 0);
                    if (vol.hits > 0) {
                      this.emitDamageNotification({
                        targetName: mon.name,
                        attackerName: m.name,
                        location: 'hull',
                        damage: vol.damage,
                        source: 'cannon',
                        direction: 'ally',
                      });
                    }
                    if (vol.sunk) this.handleMonsterDefeated(mon);
                  }
                } else if (assistEnemyRef.kind === 'merchant') {
                  const foeM = this.merchants.get(assistEnemyRef.id);
                  if (foeM && !foeM.data.sunk) {
                    const vol = resolveNpcVsNpcVolley(m.cannons, 12, foeM.data.hull, this.rand);
                    foeM.data.hull = vol.nextHull;
                    this.spawnNpcBroadside(m.x, m.z, foeM.data.x, foeM.data.z, vol.hits > 0);
                    if (vol.hits > 0) {
                      this.emitDamageNotification({
                        targetName: foeM.data.name,
                        attackerName: m.name,
                        location: 'hull',
                        damage: vol.damage,
                        source: 'cannon',
                        direction: 'ally',
                      });
                    }
                    if (vol.sunk) this.handleMerchantSunkByPlayer(foeM.data);
                  }
                }
              }
            }
          }
        } else if (
          m.huntingBountyId &&
          this.saveData.bounty?.status === 'active' &&
          this.saveData.bounty.id === m.huntingBountyId &&
          !inCombatWithPlayer
        ) {
          const bTargetPos = this.getActiveBountyTargetPos();
          if (bTargetPos) {
            const realD = Math.hypot(bTargetPos.x - m.x, bTargetPos.z - m.z);
            targetH = Math.atan2(-(bTargetPos.x - m.x), -(bTargetPos.z - m.z));
            desiredSpd = m.maxSpeed * 1.12;
            if (realD < 185 && m.cannons > 0) {
              m.reloadTimer -= dt;
              if (m.reloadTimer <= 0) {
                m.reloadTimer = 4.0 + this.rand() * 1.2;
                this.fireHunterAtBountyTarget(m.name, m.x, m.z, m.cannons, 13, bTargetPos);
              }
            }
          }
        } else if (m.isCrown && !inCombatWithPlayer) {
          let bestD = m.battleId ? 320 : 260;
          for (const pEntry of this.pirates.values()) {
            if (pEntry.data.defeated) continue;
            const sameBattle = m.battleId && pEntry.data.battleId === m.battleId;
            const d = Math.hypot(pEntry.data.x - m.x, pEntry.data.z - m.z);
            const effD = sameBattle ? d * 0.55 : d;
            if (effD < bestD) {
              bestD = effD;
              crownTargetPirate = pEntry.data;
            }
          }
          if (crownTargetPirate) {
            const realD = Math.hypot(crownTargetPirate.x - m.x, crownTargetPirate.z - m.z);
            targetH = Math.atan2(-(crownTargetPirate.x - m.x), -(crownTargetPirate.z - m.z));
            desiredSpd = m.maxSpeed;
            if (realD < 165) {
              this.fleetBattleTimer = 8;
              m.reloadTimer -= dt;
              if (m.reloadTimer <= 0) {
                m.reloadTimer = 4.2 + this.rand() * 1.4;
                const volley = resolveNpcVsNpcVolley(
                  m.cannons,
                  14,
                  crownTargetPirate.hull,
                  this.rand
                );
                crownTargetPirate.hull = volley.nextHull;
                const cPirEntry = this.pirates.get(crownTargetPirate.id);
                const cTarget = crownTargetPirate;
                this.spawnNpcBroadside(
                  m.x,
                  m.z,
                  cTarget.x,
                  cTarget.z,
                  volley.hits > 0,
                  volley.hits > 0 && cPirEntry
                    ? () => {
                        if (!cTarget.defeated) {
                          this.attachBattleDamageMark({
                            targetKind: 'pirate',
                            shipId: cTarget.id,
                            root: cPirEntry.mesh,
                            shipX: cTarget.x,
                            shipZ: cTarget.z,
                            heading: cTarget.heading,
                            halfLength: cPirEntry.halfLength,
                            halfBeam: cPirEntry.halfBeam,
                            attackerX: m.x,
                            attackerZ: m.z,
                            section: 'hull',
                            kind: 'cannon',
                            damage: volley.damage,
                          });
                        }
                      }
                    : undefined
                );
                if (volley.hits > 0 && distPlayer < 260) {
                  if (cPirEntry) cPirEntry.impactRoll += 0.12;
                  this.emitDamageNotification({
                    targetName: cTarget.name,
                    attackerName: m.name,
                    location: 'hull',
                    damage: volley.damage,
                    source: 'cannon',
                    direction: 'ally',
                  });
                }
                if (volley.sunk) {
                  cTarget.defeated = true;
                  cTarget.looted = true;
                  cTarget.behavior = 'defeated';
                  cTarget.sinkProgress = 0;
                  cTarget.salvageable = rollEnemySalvageable(cTarget.isGhost, this.rand);
                  if (!cTarget.isGhost && !cTarget.salvageable && Math.hypot(cTarget.x - px, cTarget.z - pz) < 380) {
                    this.spawnShipExplosion(cTarget.x, cTarget.z, 1.15);
                  }
                  this.spawnSunkenShipwreckForVessel(
                    { kind: 'pirate', ship: cTarget },
                    Math.hypot(cTarget.x - px, cTarget.z - pz) < discoverRange * 1.6,
                    2.0
                  );
                  if (cTarget.isBountyTarget && cTarget.bountyId) {
                    this.handleBountyTargetKilled(cTarget.bountyId, false, m.name);
                  } else {
                    this.pushNotification(`Crown Navy sank pirate vessel ${cTarget.name}!`);
                  }
                }
              }
            }
          }
        }

        if (inCombatWithPlayer) {
          if (m.cannons <= 0) {
            const react = decideUnarmedOrTrawlerBehavior(
              m,
              distPlayer,
              Math.abs(this.saveData.player.speed),
              this.simTime
            );
            if (react === 'desperate_ram') {
              targetH = Math.atan2(-(px - m.x), -(pz - m.z));
              desiredSpd = m.maxSpeed * 1.14;
              if (distPlayer < 24) m.desperateRamCooldown = 14;
            } else {
              targetH = Math.atan2(-(m.x - px), -(m.z - pz));
              desiredSpd = m.maxSpeed * 1.12;
            }
          } else {
            const ang = Math.atan2(-(px - m.x), -(pz - m.z));
            targetH = distPlayer < 95 ? normalizeAngle(ang + Math.PI * 0.45) : ang;
            desiredSpd = m.maxSpeed;
            if (distPlayer < 165) {
              m.reloadTimer -= dt;
              if (m.reloadTimer <= 0) {
                m.reloadTimer = 4.8 + this.rand();
                this.executeMerchantVolley(m, entry, distPlayer);
              }
            }
          }
        } else if (m.fleeingFromPlayer || fleeActiveCombat) {
          targetH = Math.atan2(-(m.x - px), -(m.z - pz));
          desiredSpd = m.maxSpeed * 1.12;
        } else if (!assistEnemyRef && !crownTargetPirate) {
          // Non-combat traders & trawlers evaluate threats with distinct temperaments
          let nearestThreat: { x: number; z: number; speed: number; dist: number } | null = null;
          for (const pEntry of this.pirates.values()) {
            if (pEntry.data.defeated) continue;
            const d = Math.hypot(pEntry.data.x - m.x, pEntry.data.z - m.z);
            if (d < 220 && (!nearestThreat || d < nearestThreat.dist)) {
              nearestThreat = { x: pEntry.data.x, z: pEntry.data.z, speed: pEntry.data.speed, dist: d };
            }
          }
          if (nearestThreat) {
            if (!m.isCrown && (m.cannons <= 0 || m.isFishingTrawler)) {
              const react = decideUnarmedOrTrawlerBehavior(m, nearestThreat.dist, nearestThreat.speed, this.simTime);
              if (react === 'desperate_ram') {
                targetH = Math.atan2(-(nearestThreat.x - m.x), -(nearestThreat.z - m.z));
                desiredSpd = m.maxSpeed * 1.14;
                if (nearestThreat.dist < 24) m.desperateRamCooldown = 14;
              } else if (react === 'flee') {
                targetH = Math.atan2(-(m.x - nearestThreat.x), -(m.z - nearestThreat.z));
                desiredSpd = m.maxSpeed * 1.1;
              }
            } else if (nearestThreat.dist < 120) {
              targetH = Math.atan2(-(m.x - nearestThreat.x), -(m.z - nearestThreat.z));
              desiredSpd = m.maxSpeed;
            }
          }
          if (distPlayer < 42 && !m.hostileToPlayer) desiredSpd *= 0.18;
        }

        const diff = normalizeAngle(targetH - m.heading);
        m.heading = normalizeAngle(m.heading + clamp(diff, -0.5 * dt, 0.5 * dt));
        m.speed = THREE.MathUtils.damp(m.speed, desiredSpd, 1.5, dt);
        m.x += -Math.sin(m.heading) * m.speed * dt;
        m.z += -Math.cos(m.heading) * m.speed * dt;

        if (!m.discovered && distPlayer < discoverRange) {
          m.discovered = true;
          this.recordMarker({
            id: m.id,
            kind: m.convoyId ? 'convoy' : m.isCrown ? 'crown' : 'merchant',
            name: m.name,
            x: m.x,
            z: m.z,
            status: m.convoyId
              ? m.convoyRole === 'escort'
                ? 'Convoy Escort'
                : 'Convoy Freighter'
              : m.isCrown
                ? 'Crown Fleet'
                : m.isFishingTrawler
                  ? 'Fishing Vessel'
                  : m.specialty,
          });
          this.pushNotification(
            m.convoyId
              ? `Merchant convoy sighted: ${m.name}`
              : `${m.isCrown ? 'Crown vessel' : 'Vessel'} sighted: ${m.name}`
          );
          this.triggerTutorial(
            'discover_merchant',
            'Ships of the Sea',
            'Press E near passing merchant, fishing, convoy, or Crown ships to trade, hail, or turn pirate.'
          );
        } else if (m.discovered) {
          this.recordMarker({
            id: m.id,
            kind: m.convoyId ? 'convoy' : m.isCrown ? 'crown' : 'merchant',
            name: m.name,
            x: m.x,
            z: m.z,
            status: m.convoyId
              ? m.convoyRole === 'escort'
                ? 'Convoy Escort'
                : 'Convoy Freighter'
              : m.isCrown
                ? 'Crown Fleet'
                : m.isFishingTrawler
                  ? 'Fishing Vessel'
                  : m.specialty,
          });
        }
      }

      if (m.sunk) {
        m.sinkProgress = Math.min(1, (m.sinkProgress ?? 0) + dt * 0.25);
      }
      const sp = m.sinkProgress ?? 0;

      const pose = computeBoatBuoyancy(
        m.x,
        m.z,
        m.heading,
        entry.halfLength,
        entry.halfBeam,
        1.5,
        0,
        m.speed,
        this.simTime,
        w.waveIntensity,
        this.rogueWaveBoost
      );
      entry.impactRoll = THREE.MathUtils.damp(entry.impactRoll, 0, 5.2, dt);
      entry.mesh.position.set(m.x, pose.y - sp * 7.5, m.z);
      entry.mesh.rotation.order = 'YXZ';
      entry.mesh.rotation.set(pose.pitch + sp * 0.4, m.heading, pose.roll + entry.impactRoll + sp * 0.7);

      if (m.sunk && sp >= 1) {
        this.scene.remove(entry.mesh);
        this.merchants.delete(mId);
        this.npcDamageMarks.delete(mId);
        this.assistDecisions.delete(mId);
        this.assistingAllies.delete(mId);
      }
    }

    // 4. Pirates, Faction Wars, Escort Formations & Naval Battles
    const playerVx = -Math.sin(this.saveData.player.heading) * this.saveData.player.speed;
    const playerVz = -Math.cos(this.saveData.player.heading) * this.saveData.player.speed;
    const engagedPirateIds = this.getCombatEnemies()
      .filter((e) => e.kind === 'pirate')
      .map((e) => e.id);

    for (const [pirId, entry] of Array.from(this.pirates.entries())) {
      const pir = entry.data;
      if (pir.playerId) {
        // Another human's ship: never AI-driven; this stand-in just follows them for PvP combat.
        this.stepPvpStandIn(entry, dt);
        if (!this.pirates.has(pirId)) continue;
      }
      const remotePirate = pir.playerId ? null : this.getRemoteNpc(pirId);
      if (remotePirate && !pir.defeated) {
        this.driveRemoteNpc(pir, remotePirate, dt);
        if (remotePirate.behavior) pir.behavior = remotePirate.behavior as typeof pir.behavior;
      }
      const inCombatWithThis = this.isEnemyInCombat(pir.id);
      animateWavingFlag(entry.flagMesh, this.simTime, w.windSpeed / 12);
      const dist = Math.hypot(pir.x - px, pir.z - pz);
      if (!pir.defeated && dist < 460) {
        animateDeckCrewActors(entry.crewActors, this.simTime);
      }

      const pMarks = this.npcDamageMarks.get(pir.id);
      if (pMarks && pMarks.length > 0 && !pir.defeated) {
        this.animateDamageMarksOnRoot(pMarks, pir.x, pir.z, emitWreckFireNow && dist < 260);
      }

      if (remotePirate && pirateSim && !pir.defeated) {
        // Another player simulates this pirate's movement. Whoever it is hunting still has to be able to
        // fight it: hail/engage and return fire are resolved here, on the targeted player's own client.
        if (pir.hailCooldown > 0) pir.hailCooldown = Math.max(0, pir.hailCooldown - dt);
        if (pir.behavior === 'hailing' && pir.hailCooldown <= 0 && !this.modalOpen && !inCombatWithThis && dist < 200 && !this.fps.active) {
          pir.hailCooldown = 14;
          this.startNavalBattle(pir);
        }
        if (inCombatWithThis && pir.cannons > 0 && pir.behavior !== 'retreat') {
          pir.reloadTimer -= dt;
          if (pir.reloadTimer <= 0) {
            pir.reloadTimer = pir.reloadTime * (0.9 + this.rand() * 0.25);
            this.executePirateVolley(pir, entry, dist);
          }
        }
        if (inCombatWithThis && dist > 300) {
          this.combat.enemies = this.getCombatEnemies().filter((e) => e.id !== pir.id);
          this.syncCombatPrimaryFields();
          pir.hailCooldown = 65;
        }
      }

      if (pirateSim && !pir.defeated && !pir.playerId && !remotePirate) {
        if (pir.hailCooldown > 0) pir.hailCooldown = Math.max(0, pir.hailCooldown - dt);
        if ((pir.ramCooldown ?? 0) > 0) pir.ramCooldown = Math.max(0, (pir.ramCooldown ?? 0) - dt);
        if ((pir.ramCommitTimer ?? 0) > 0) {
          pir.ramCommitTimer = Math.max(0, (pir.ramCommitTimer ?? 0) - dt);
          if (pir.ramCommitTimer <= 0) pir.ramCooldown = 12 + this.rand() * 8;
        }
        pir.patrolAngle += dt * 0.14;

        const faction = this.saveData.factions[pir.factionId];
        const alliedToPlayer =
          isPlayerPirateAligned(this.saveData.reputation) ||
          (faction ? isPirateAlliedWithPlayer(faction, this.saveData.day, this.saveData.reputation) : false);

        let escortAnchor: { x: number; z: number } | null = null;
        if (pir.escortTargetId) {
          const leader = this.pirates.get(pir.escortTargetId)?.data;
          if (leader && !leader.defeated) {
            escortAnchor = { x: leader.x, z: leader.z };
          }
        }

        const prevBehavior = pir.behavior;
        const isHunter = this.hunterIds.has(pir.id);
        const squadIdx = Math.max(0, engagedPirateIds.indexOf(pir.id));
        let pirateTargetX = px + 20_000;
        let pirateTargetZ = pz + 20_000;
        let targetHullTier = this.saveData.player.upgrades.hullTier;
        let targetVx = 0;
        let targetVz = 0;
        let targetSpeed = 0;
        let hasEligiblePlayerTarget = false;
        let nearestPlayerDistance = Number.POSITIVE_INFINITY;
        if (!this.fps.active) {
          nearestPlayerDistance = Math.hypot(pir.x - px, pir.z - pz);
          pirateTargetX = px;
          pirateTargetZ = pz;
          targetVx = playerVx;
          targetVz = playerVz;
          targetSpeed = Math.abs(this.saveData.player.speed);
          hasEligiblePlayerTarget = true;
        }
        for (const remote of this.remotePlayers.values()) {
          if (remote.landed) continue;
          const remoteX = remote.targetX;
          const remoteZ = remote.targetZ;
          const remoteDistance = Math.hypot(pir.x - remoteX, pir.z - remoteZ);
          if (remoteDistance < nearestPlayerDistance) {
            nearestPlayerDistance = remoteDistance;
            pirateTargetX = remoteX;
            pirateTargetZ = remoteZ;
            targetHullTier = remote.hullTier;
            targetVx = -Math.sin(remote.targetHeading) * remote.speed;
            targetVz = -Math.cos(remote.targetHeading) * remote.speed;
            targetSpeed = Math.abs(remote.speed);
            hasEligiblePlayerTarget = true;
          }
        }
        const ai = computePirateAI(
          pir,
          pirateTargetX,
          pirateTargetZ,
          targetHullTier,
          inCombatWithThis,
          dt,
          targetVx,
          targetVz,
          isHunter,
          alliedToPlayer,
          escortAnchor,
          {
            squadIndex: squadIdx,
            squadCount: Math.max(1, engagedPirateIds.length),
            playerCannons: this.saveData.player.upgrades.cannonCount,
            playerHullPct: this.saveData.player.condition.hull,
            playerSpeed: targetSpeed,
            simTime: this.simTime,
          }
        );
        if (this.fps.active && !hasEligiblePlayerTarget) {
          ai.nextBehavior = 'patrol';
          ai.wantsToFire = false;
        }
        pir.behavior = ai.nextBehavior;
        if (pir.behavior === 'ram' && (pir.ramCommitTimer ?? 0) <= 0) {
          pir.ramCommitTimer = 4.5;
          if (prevBehavior !== 'ram') {
            this.pushNotification(`${pir.name} is turning her bow to RAM!`);
          }
        }

        // Multi-enemy auto-join: nearby aggressive pirates / squadron ships join active combat
        if (
          this.combat.active &&
          !inCombatWithThis &&
          engagedPirateIds.length < 4 &&
          (!alliedToPlayer || pir.isGhost) &&
          pir.hailCooldown <= 0 &&
          dist < 210 &&
          (isHunter || pir.isGhost || pir.behavior === 'pursue' || pir.behavior === 'hailing' || pir.fleetId || pir.battleId)
        ) {
          this.startNavalBattle(pir);
          engagedPirateIds.push(pir.id);
        }

        // Friendly pirate AI assistance when player is in combat nearby
        let assistingTargetRef: CombatEnemyRef | null = null;
        if (
          this.combat.active &&
          !inCombatWithThis &&
          !pir.isGhost &&
          pir.cannons > 0 &&
          (alliedToPlayer || (faction && faction.playerStanding >= 12)) &&
          dist < 340
        ) {
          let dec = this.assistDecisions.get(pir.id);
          if (!dec) {
            dec = decideFriendlyAssistance(
              { kind: 'pirate', ship: pir, faction },
              threatIsCrown,
              this.saveData.reputation,
              this.saveData.day,
              this.rand
            );
            this.assistDecisions.set(pir.id, dec);
            if (dec.assists && !this.assistingAllies.has(pir.id)) {
              this.assistingAllies.add(pir.id);
              this.pushNotification(`${pir.name} (${PIRATE_FACTIONS[pir.factionId].shortName}) joined on your side!`);
            }
          }
          if (dec.assists) {
            let bestEd = 340;
            for (const ref of this.getCombatEnemies()) {
              if (ref.id === pir.id) continue;
              const ep = this.getEnemyWorldPos(ref);
              if (!ep) continue;
              const ed = Math.hypot(ep.x - pir.x, ep.z - pir.z);
              if (ed < bestEd) {
                bestEd = ed;
                assistingTargetRef = ref;
              }
            }
          }
        }

        if (assistingTargetRef) {
          const ep = this.getEnemyWorldPos(assistingTargetRef);
          if (ep) {
            pir.behavior = 'assist';
            const dEnemy = Math.hypot(ep.x - pir.x, ep.z - pir.z);
            ai.targetHeading = Math.atan2(-(ep.x - pir.x), -(ep.z - pir.z));
            ai.desiredSpeed = dEnemy > 85 ? pir.maxSpeed : pir.maxSpeed * 0.86;
            if (dEnemy < pir.fireRange) {
              pir.reloadTimer -= dt;
              if (pir.reloadTimer <= 0) {
                pir.reloadTimer = pir.reloadTime * 1.05;
                this.fleetBattleTimer = 7;
                if (assistingTargetRef.kind === 'pirate') {
                  const foeEntry = this.pirates.get(assistingTargetRef.id);
                  if (foeEntry && !foeEntry.data.defeated) {
                    const foe = foeEntry.data;
                    const vol = resolveNpcVsNpcVolley(pir.cannons, pir.damagePerCannon, foe.hull, this.rand);
                    foe.hull = vol.nextHull;
                    this.spawnNpcBroadside(
                      pir.x,
                      pir.z,
                      foe.x,
                      foe.z,
                      vol.hits > 0,
                      vol.hits > 0
                        ? () => {
                            if (!foe.defeated) {
                              this.attachBattleDamageMark({
                                targetKind: 'pirate',
                                shipId: foe.id,
                                root: foeEntry.mesh,
                                shipX: foe.x,
                                shipZ: foe.z,
                                heading: foe.heading,
                                halfLength: foeEntry.halfLength,
                                halfBeam: foeEntry.halfBeam,
                                attackerX: pir.x,
                                attackerZ: pir.z,
                                section: 'hull',
                                kind: 'cannon',
                                damage: vol.damage,
                              });
                            }
                          }
                        : undefined
                    );
                    if (vol.hits > 0) {
                      foeEntry.impactRoll += 0.14;
                      this.emitDamageNotification({
                        targetName: foe.name,
                        attackerName: pir.name,
                        location: 'hull',
                        damage: vol.damage,
                        source: 'cannon',
                        direction: 'ally',
                      });
                    }
                    if (vol.sunk) this.handlePirateDefeated(foe);
                  }
                } else if (assistingTargetRef.kind === 'merchant') {
                  const foeM = this.merchants.get(assistingTargetRef.id);
                  if (foeM && !foeM.data.sunk) {
                    const vol = resolveNpcVsNpcVolley(pir.cannons, pir.damagePerCannon, foeM.data.hull, this.rand);
                    foeM.data.hull = vol.nextHull;
                    this.spawnNpcBroadside(pir.x, pir.z, foeM.data.x, foeM.data.z, vol.hits > 0);
                    if (vol.hits > 0) {
                      this.emitDamageNotification({
                        targetName: foeM.data.name,
                        attackerName: pir.name,
                        location: 'hull',
                        damage: vol.damage,
                        source: 'cannon',
                        direction: 'ally',
                      });
                    }
                    if (vol.sunk) this.handleMerchantSunkByPlayer(foeM.data);
                  }
                } else if (assistingTargetRef.kind === 'monster') {
                  const mon = this.monsters.get(assistingTargetRef.id)?.data;
                  if (mon && !mon.defeated) {
                    const vol = resolveNpcVsNpcVolley(pir.cannons, pir.damagePerCannon, mon.hp, this.rand);
                    mon.hp = vol.nextHull;
                    this.spawnNpcBroadside(pir.x, pir.z, mon.x, mon.z, vol.hits > 0);
                    if (vol.hits > 0) {
                      this.emitDamageNotification({
                        targetName: mon.name,
                        attackerName: pir.name,
                        location: 'hull',
                        damage: vol.damage,
                        source: 'cannon',
                        direction: 'ally',
                      });
                    }
                    if (vol.sunk) this.handleMonsterDefeated(mon);
                  }
                }
              }
            }
          }
        } else if (
          !inCombatWithThis &&
          pir.huntingBountyId &&
          this.saveData.bounty?.status === 'active' &&
          this.saveData.bounty.id === pir.huntingBountyId
        ) {
          const bTargetPos = this.getActiveBountyTargetPos();
          if (bTargetPos) {
            const realD = Math.hypot(bTargetPos.x - pir.x, bTargetPos.z - pir.z);
            pir.behavior = 'hunt_npc';
            ai.targetHeading = Math.atan2(-(bTargetPos.x - pir.x), -(bTargetPos.z - pir.z));
            ai.desiredSpeed = pir.maxSpeed * 1.12;
            if (realD < pir.fireRange * 1.15 && pir.cannons > 0) {
              pir.reloadTimer -= dt;
              if (pir.reloadTimer <= 0) {
                pir.reloadTimer = pir.reloadTime * 0.95;
                this.fireHunterAtBountyTarget(pir.name, pir.x, pir.z, pir.cannons, pir.damagePerCannon, bTargetPos);
              }
            }
          }
        }
        // NPC-vs-NPC Faction War or Merchant Raiding when not fighting player
        else if (!inCombatWithThis && pir.behavior === 'patrol' && !pir.isGhost) {
          let npcTarget: { x: number; z: number; kind: 'pirate' | 'merchant'; id: string } | null = null;
          let bestDist = 240;

          // Check warring rival pirate ships
          for (const [otherId, otherEntry] of this.pirates.entries()) {
            const other = otherEntry.data;
            if (otherId === pir.id || other.defeated || other.isGhost) continue;
            if (faction && faction.relations[other.factionId] === 'war') {
              const d = Math.hypot(other.x - pir.x, other.z - pir.z);
              if (d < bestDist) {
                bestDist = d;
                npcTarget = { x: other.x, z: other.z, kind: 'pirate', id: otherId };
              }
            }
          }

          // Otherwise hunt innocent civilian traders
          if (!npcTarget) {
            for (const [mId, mEntry] of this.merchants.entries()) {
              if (mEntry.data.sunk || mEntry.data.isCrown) continue;
              const d = Math.hypot(mEntry.data.x - pir.x, mEntry.data.z - pir.z);
              if (d < bestDist) {
                bestDist = d;
                npcTarget = { x: mEntry.data.x, z: mEntry.data.z, kind: 'merchant', id: mId };
              }
            }
          }

          if (npcTarget) {
            pir.behavior = 'hunt_npc';
            ai.targetHeading = Math.atan2(-(npcTarget.x - pir.x), -(npcTarget.z - pir.z));
            ai.desiredSpeed = pir.maxSpeed * 0.92;
            if (bestDist < pir.fireRange * 0.95) {
              pir.reloadTimer -= dt;
              if (pir.reloadTimer <= 0) {
                pir.reloadTimer = pir.reloadTime * 1.1;
                this.fleetBattleTimer = 7.5;
                if (npcTarget.kind === 'pirate') {
                  const foeEntry = this.pirates.get(npcTarget.id);
                  const foe = foeEntry?.data;
                  if (foe && !foe.defeated) {
                    const vol = resolveNpcVsNpcVolley(pir.cannons, pir.damagePerCannon, foe.hull, this.rand);
                    foe.hull = vol.nextHull;
                    this.spawnNpcBroadside(
                      pir.x,
                      pir.z,
                      foe.x,
                      foe.z,
                      vol.hits > 0,
                      vol.hits > 0 && foeEntry
                        ? () => {
                            if (!foe.defeated) {
                              this.attachBattleDamageMark({
                                targetKind: 'pirate',
                                shipId: foe.id,
                                root: foeEntry.mesh,
                                shipX: foe.x,
                                shipZ: foe.z,
                                heading: foe.heading,
                                halfLength: foeEntry.halfLength,
                                halfBeam: foeEntry.halfBeam,
                                attackerX: pir.x,
                                attackerZ: pir.z,
                                section: 'hull',
                                kind: 'cannon',
                                damage: vol.damage,
                              });
                            }
                          }
                        : undefined
                    );
                    if (vol.sunk) {
                      foe.defeated = true;
                      foe.looted = true;
                      foe.behavior = 'defeated';
                      foe.sinkProgress = 0;
                      foe.salvageable = rollEnemySalvageable(foe.isGhost, this.rand);
                      if (!foe.isGhost && !foe.salvageable && Math.hypot(foe.x - px, foe.z - pz) < 380) {
                        this.spawnShipExplosion(foe.x, foe.z, 1.15);
                      }
                      this.spawnSunkenShipwreckForVessel(
                        { kind: 'pirate', ship: foe },
                        Math.hypot(foe.x - px, foe.z - pz) < discoverRange * 1.6,
                        2.0
                      );
                      if (foe.isBountyTarget && foe.bountyId) {
                        this.handleBountyTargetKilled(foe.bountyId, false, pir.name);
                      }
                    }
                  }
                } else {
                  const vesEntry = this.merchants.get(npcTarget.id);
                  const ves = vesEntry?.data;
                  if (ves && !ves.sunk) {
                    const vol = resolveNpcVsNpcVolley(pir.cannons, pir.damagePerCannon, ves.hull, this.rand);
                    ves.hull = vol.nextHull;
                    this.spawnNpcBroadside(
                      pir.x,
                      pir.z,
                      ves.x,
                      ves.z,
                      vol.hits > 0,
                      vol.hits > 0 && vesEntry
                        ? () => {
                            if (!ves.sunk) {
                              this.attachBattleDamageMark({
                                targetKind: 'merchant',
                                shipId: ves.id,
                                root: vesEntry.mesh,
                                shipX: ves.x,
                                shipZ: ves.z,
                                heading: ves.heading,
                                halfLength: vesEntry.halfLength,
                                halfBeam: vesEntry.halfBeam,
                                attackerX: pir.x,
                                attackerZ: pir.z,
                                section: 'hull',
                                kind: 'cannon',
                                damage: vol.damage,
                              });
                            }
                          }
                        : undefined
                    );
                    if (vol.sunk) {
                      ves.sunk = true;
                      ves.sinkProgress = 0;
                      ves.salvageable = rollEnemySalvageable(false, this.rand);
                      if (!ves.salvageable && Math.hypot(ves.x - px, ves.z - pz) < 380) {
                        this.spawnShipExplosion(ves.x, ves.z, 1.05);
                      }
                      this.spawnSunkenShipwreckForVessel(
                        { kind: 'merchant', ship: ves },
                        Math.hypot(ves.x - px, ves.z - pz) < discoverRange * 1.6,
                        2.0
                      );
                      if (ves.isBountyTarget && ves.bountyId) {
                        this.handleBountyTargetKilled(ves.bountyId, false, pir.name);
                      }
                    }
                  }
                }
              }
            }
          }
        }

        if (pir.behavior === 'pursue') {
          pir.patrolCenterX = px;
          pir.patrolCenterZ = pz;
          if (prevBehavior === 'patrol') {
            this.pushNotification(
              pir.isGhost
                ? `Pale fog engulfs the sea — ${pir.name} is hunting you!`
                : `${PIRATE_FACTIONS[pir.factionId].shortName} "${pir.name}" is closing in!`
            );
            this.triggerTutorial(
              'discover_pirate',
              'Pirate Sighting',
              'Crimson-flagged raiders hunt the sea lanes. Press E near allied/neutral pirates to trade or forge pacts.'
            );
          }
        }

        const turnScale = 0.4 + (pir.steering / 100) * 0.6;
        const hDiff = normalizeAngle(ai.targetHeading - pir.heading);
        pir.heading = normalizeAngle(
          pir.heading + clamp(hDiff, -pir.turnRate * turnScale * dt, pir.turnRate * turnScale * dt)
        );
        pir.speed = THREE.MathUtils.damp(pir.speed, ai.desiredSpeed, 1.5, dt);

        pir.x += -Math.sin(pir.heading) * pir.speed * dt;
        pir.z += -Math.cos(pir.heading) * pir.speed * dt;

        if (!pir.discovered && dist < discoverRange) {
          pir.discovered = true;
          this.recordMarker({
            id: pir.id,
            kind: pir.isGhost ? 'ghost' : 'pirate',
            name: pir.name,
            x: pir.x,
            z: pir.z,
            status: pir.isGhost
              ? `${(pir.ghostSize ?? 'medium').toUpperCase()} Ghost Ship`
              : `${PIRATE_FACTIONS[pir.factionId].shortName} (${pir.rankTitle})`,
          });
          this.pushNotification(
            pir.isGhost
              ? `An unnatural mist chills the air... ${pir.name} emerges!`
              : `Pirate sighted: "${pir.name}" (${PIRATE_FACTIONS[pir.factionId].shortName})`
          );
          if (pir.isGhost) {
            this.addLog('Ghost Ship in the Mist', `Encountered the cursed spectral warship ${pir.name} in thick ocean fog.`);
            this.triggerTutorial(
              'discover_ghost',
              'Ghost Ship Encounter',
              'Rare haunted warships sail inside eerie fog banks. Defeat them in combat to search their Ghost Wreck for relics.'
            );
          }
        } else if (pir.discovered) {
          this.recordMarker({
            id: pir.id,
            kind: pir.isGhost ? 'ghost' : 'pirate',
            name: pir.name,
            x: pir.x,
            z: pir.z,
            status: pir.isGhost
              ? `${(pir.ghostSize ?? 'medium').toUpperCase()} Ghost Ship`
              : `${PIRATE_FACTIONS[pir.factionId].shortName} (${pir.rankTitle})`,
          });
        }

        if (pir.isGhost) {
          const ghostWeatherRadius =
            pir.ghostSize === 'colossal'
              ? 360
              : pir.ghostSize === 'enormous'
                ? 300
                : pir.ghostSize === 'large'
                  ? 250
                  : pir.ghostSize === 'medium'
                    ? 200
                    : 165;

          if (entry.ghostFog && dist < 560) {
            entry.ghostFog.rotation.y += dt * 0.14;
          }

          if (dist < ghostWeatherRadius) {
            this.nearbyGhostActive = true;
            const prox = clamp(1 - dist / ghostWeatherRadius, 0.08, 1);
            if (prox > this.nearbyGhostFactor) this.nearbyGhostFactor = prox;

            if (this.ghostWhisperCooldown <= 0) {
              this.ghostWhisperCooldown = 16;
              this.sound.playGhostWhisper();
            }
          }

          const inStealth = Boolean(pir.ghostStealthTimer && pir.ghostStealthTimer > 0);
          if (pir.ghostStealthTimer && pir.ghostStealthTimer > 0) {
            pir.ghostStealthTimer = Math.max(0, pir.ghostStealthTimer - dt);
          }
          if (entry.fadeMaterials && entry.ghostStealthActive !== inStealth) {
            entry.ghostStealthActive = inStealth;
            const lenMats = entry.fadeMaterials.length;
            for (let mIdx = 0; mIdx < lenMats; mIdx++) {
              const mat = entry.fadeMaterials[mIdx] as THREE.Material & { opacity: number };
              if (mIdx < 2) {
                mat.transparent = inStealth;
                mat.opacity = inStealth ? 0.28 : 0.92;
                mat.needsUpdate = true;
              } else if (mIdx === 2) {
                mat.opacity = inStealth ? 0.25 : 0.86;
              } else if (mIdx === 5) {
                mat.opacity = inStealth ? 0.22 : 0.14;
              } else if (mIdx === 6) {
                mat.opacity = inStealth ? 0.56 : 0.42;
              }
            }
          }

          if (dist < 180 && Math.random() < 0.22) {
            this.spawnParticle(
              pir.x + (Math.random() - 0.5) * 26,
              0.8 + Math.random() * 4.2,
              pir.z + (Math.random() - 0.5) * 26,
              (Math.random() - 0.5) * 1.1,
              0.9 + Math.random() * 1.2,
              (Math.random() - 0.5) * 1.1,
              1.6,
              0.24,
              0.96,
              0.52
            );
          }

          // Spectral ghost abilities in combat or close range
          if (inCombatWithThis || (!this.fps.active && dist < 195)) {
            pir.ghostAbilityTimer = (pir.ghostAbilityTimer ?? 7) - dt;
            if (pir.ghostAbilityTimer <= 0) {
              pir.ghostAbilityTimer = 9 + this.rand() * 5;
              const abil = Math.floor(this.rand() * 4);
              if (abil === 0) {
                pir.ghostStealthTimer = 4.0;
                this.pushNotification(`${pir.name} vanished into eerie green storm fog!`);
              } else if (abil === 1) {
                this.steeringHexTimer = 3.6;
                this.sound.playGhostWhisper();
                this.pushNotification(`${pir.name} cast a Helm Hex — your wheel fights the rudder!`);
              } else if (abil === 2) {
                pir.speed = pir.maxSpeed * 1.45;
                this.pushNotification(`${pir.name} surged forward on phantom winds!`);
              } else if (inCombatWithThis) {
                this.sound.playGhostWhisper();
                this.executePirateVolley(pir, entry, dist);
                this.combat.combatLog = [`${pir.name} unleashed a spectral wisp volley!`, ...this.combat.combatLog].slice(0, 6);
              }
            }
          }
        }

        if (pir.battleId && dist < 340) {
          this.nearbyMajorBattleActive = true;
          this.recordMarker({
            id: pir.battleId,
            kind: 'battle',
            name: 'Major Naval Engagement',
            x: pir.x,
            z: pir.z,
            status: 'Active Fleet Clash',
          });
        }

        if (pir.behavior === 'hailing' && pir.hailCooldown <= 0 && !this.modalOpen && !inCombatWithThis) {
          pir.hailCooldown = 14;
          if (this.combat.active) {
            if (engagedPirateIds.length < 4) {
              this.startNavalBattle(pir);
              engagedPirateIds.push(pir.id);
            }
          } else if (pir.isGhost) {
            this.startNavalBattle(pir);
          } else if (pir.tier === 'sloop' && !isHunter && this.rand() < 0.35) {
            this.callbacks.onPirateHail({ ...pir });
          } else {
            this.startNavalBattle(pir);
          }
        }

        if (inCombatWithThis) {
          if (pir.behavior === 'retreat' && dist > 235) {
            this.combat.enemies = this.getCombatEnemies().filter((e) => e.id !== pir.id);
            this.syncCombatPrimaryFields();
            pir.hailCooldown = 65;
            pir.behavior = 'patrol';
            this.pushNotification(`${pir.name} broke off and fled!`);
          } else if (ai.wantsToFire && !pir.defeated && pir.cannons > 0) {
            pir.reloadTimer -= dt;
            if (pir.reloadTimer <= 0) {
              pir.reloadTimer = pir.reloadTime * (0.9 + this.rand() * 0.25);
              this.executePirateVolley(pir, entry, dist);
            }
          }
        }
      }

      entry.cannonRecoil = Math.max(0, entry.cannonRecoil - dt * 3.8);
      entry.impactRoll = THREE.MathUtils.damp(entry.impactRoll, 0, 5.0, dt);
      entry.impactPitch = THREE.MathUtils.damp(entry.impactPitch, 0, 5.0, dt);

      for (const cg of entry.cannonGroups) {
        const bx = (cg.userData.baseX as number) ?? cg.position.x;
        const side = (cg.userData.side as number) ?? 1;
        cg.position.x = bx - side * entry.cannonRecoil * 0.34;
      }

      const pirHpPct = (pir.hull / Math.max(1, pir.maxHull)) * 100;
      entry.damagePatches.forEach((patch, idx) => {
        patch.visible = pirHpPct < 82 - idx * 18;
      });

      if (pirHpPct < 65 && (pir.sinkProgress ?? 0) < 0.85) {
        entry.smokeAccum += dt;
        if (entry.smokeAccum > (pirHpPct < 30 ? 0.14 : 0.28)) {
          entry.smokeAccum = 0;
          this.spawnParticle(
            pir.x + (Math.random() - 0.5) * 3.0,
            entry.mesh.position.y + 1.8,
            pir.z + (Math.random() - 0.5) * 4.0,
            (Math.random() - 0.5) * 0.9,
            2.1 + Math.random() * 1.4,
            (Math.random() - 0.5) * 0.9,
            1.4,
            pirHpPct < 30 && Math.random() < 0.35 ? 0.92 : 0.26,
            pirHpPct < 30 && Math.random() < 0.35 ? 0.4 : 0.26,
            pirHpPct < 30 && Math.random() < 0.35 ? 0.12 : 0.28
          );
        }
      }

      if (pir.defeated) {
        pir.sinkProgress = Math.min(1, (pir.sinkProgress ?? 0) + dt * 0.28);
      }

      const pose = computeBoatBuoyancy(
        pir.x,
        pir.z,
        pir.heading,
        entry.halfLength,
        entry.halfBeam,
        1.45,
        0,
        pir.speed,
        this.simTime,
        w.waveIntensity,
        this.rogueWaveBoost
      );
      const sp = pir.sinkProgress ?? 0;
      entry.mesh.position.set(pir.x, pose.y - sp * 7.5, pir.z);
      entry.mesh.rotation.order = 'YXZ';
      entry.mesh.rotation.set(
        pose.pitch + entry.impactPitch + sp * 0.42,
        pir.heading,
        pose.roll + entry.impactRoll + sp * 0.72
      );

      if (pir.defeated && pir.looted && sp >= 1) {
        this.scene.remove(entry.mesh);
        this.pirates.delete(pirId);
        this.hunterIds.delete(pirId);
        this.npcDamageMarks.delete(pirId);
        this.assistDecisions.delete(pirId);
        this.assistingAllies.delete(pirId);
      }
    }

    // 5. Sea Monsters
    for (const [mId, mEntry] of Array.from(this.monsters.entries())) {
      const mon = mEntry.data;
      const remoteMonster = this.getRemoteNpc(mId);
      if (remoteMonster && !mon.defeated) this.driveRemoteNpc(mon, remoteMonster, dt);
      const inCombatWithMon = this.isEnemyInCombat(mon.id);
      const attackStyle = mon.attackStyle ?? getMonsterAttackStyle(mon.species);
      if (oceanSim) {
        mon.attackAnimTimer = Math.max(0, (mon.attackAnimTimer ?? 0) - dt);
      }
      if (!mon.defeated) {
        mon.animPhase += dt * (mon.size === 'small' ? 2.8 : 2.1);
      }

      if (oceanSim && !mon.defeated && remoteMonster) {
        // Movement comes from the owning player; a creature near US still attacks US.
        const distPlayer = Math.hypot(mon.x - px, mon.z - pz);
        if (mon.attackCooldown > 0) mon.attackCooldown -= dt;
        if (
          distPlayer <= mon.attackRange &&
          mon.attackCooldown <= 0 &&
          (inCombatWithMon || shouldMonsterAttackPlayer(mon, this.saveData.reputation))
        ) {
          mon.attackCooldown = 4.6 + this.rand() * 1.4;
          this.executeMonsterStrike(mon, 1.0);
        }
      }

      if (oceanSim && !mon.defeated && !remoteMonster) {
        const distPlayer = Math.hypot(mon.x - px, mon.z - pz);
        if (!mon.discovered && distPlayer < discoverRange * 1.25) {
          mon.discovered = true;
          this.recordMarker({
            id: mon.id,
            kind: 'monster',
            name: mon.name,
            x: mon.x,
            z: mon.z,
            status: `${mon.size} (${mon.alignment})`,
          });
          this.sound.playMonsterRoar();
          this.pushNotification(`Sea Creature Sighted: ${mon.name} (${mon.size} ${mon.species})!`);
          this.addLog(
            `Sighted ${mon.name}`,
            `Spotted a ${mon.size} ${mon.species} (${mon.alignment} temperament) breaking the surface.`
          );
        }

        const aggroOnPlayer =
          inCombatWithMon ||
          (distPlayer < mon.aggroRange && shouldMonsterAttackPlayer(mon, this.saveData.reputation));

        if (aggroOnPlayer) {
          const chase = stepMonsterChaseBehavior(
            mon,
            px,
            pz,
            -Math.sin(this.saveData.player.heading) * this.saveData.player.speed,
            -Math.cos(this.saveData.player.heading) * this.saveData.player.speed,
            distPlayer,
            this.simTime
          );
          const diff = normalizeAngle(chase.targetHeading - mon.heading);
          mon.heading = normalizeAngle(mon.heading + clamp(diff, -1.35 * dt, 1.35 * dt));
          mon.x += -Math.sin(mon.heading) * chase.moveSpeed * dt;
          mon.z += -Math.cos(mon.heading) * chase.moveSpeed * dt;

          if (mon.attackCooldown > 0) mon.attackCooldown -= dt;
          if (distPlayer <= mon.attackRange && mon.attackCooldown <= 0) {
            mon.attackCooldown = chase.isLunging ? 3.8 + this.rand() * 1.1 : 4.6 + this.rand() * 1.4;
            this.executeMonsterStrike(mon, chase.ramDamageMultiplier);
          }
        } else {
          // Patrol circle calmly
          const circleAng = mon.animPhase * 0.14;
          const tx = mon.patrolCenterX + Math.cos(circleAng) * 85;
          const tz = mon.patrolCenterZ + Math.sin(circleAng) * 85;
          const targetH = Math.atan2(-(tx - mon.x), -(tz - mon.z));
          const diff = normalizeAngle(targetH - mon.heading);
          mon.heading = normalizeAngle(mon.heading + clamp(diff, -0.75 * dt, 0.75 * dt));
          mon.x += -Math.sin(mon.heading) * (mon.speed * 0.55) * dt;
          mon.z += -Math.cos(mon.heading) * (mon.speed * 0.55) * dt;
        }
      }

      if (mon.defeated) {
        if (!mon.carcassHarvested && (mon.carcassTimer ?? 0) > 0) {
          if (oceanSim) {
            mon.carcassTimer = Math.max(0, (mon.carcassTimer ?? 0) - dt);
          }
          mon.sinkProgress = 0;
        } else {
          mon.sinkProgress = Math.min(1, mon.sinkProgress + dt * 0.25);
        }
      }

      const wh = sampleWaveHeight(mon.x, mon.z, this.simTime, w.waveIntensity, this.rogueWaveBoost);
      const atkProgress = clamp((mon.attackAnimTimer ?? 0) / 0.95, 0, 1);
      animateSeaMonsterMesh(
        mEntry.built,
        mon.animPhase,
        mon.provokedByPlayer || inCombatWithMon,
        atkProgress,
        attackStyle,
        mon.defeated
      );
      const carcassFloatLift = mon.defeated && !mon.carcassHarvested ? 0.55 : 0;
      mEntry.built.root.position.set(
        mon.x,
        wh + mEntry.built.baseDepthOffset + carcassFloatLift - mon.sinkProgress * 8,
        mon.z
      );
      mEntry.built.root.rotation.y = mon.heading;

      if (mon.defeated && mon.sinkProgress >= 1) {
        this.scene.remove(mEntry.built.root);
        this.monsters.delete(mId);
      }
    }

    // 6. Tamed Sea Companions swimming alongside & helping in combat!
    this.saveData.tamedMonsters.forEach((tm, idx) => {
      const built = this.companionMeshes.get(tm.id);
      if (!built) return;
      if (oceanSim) {
        const offsetAng = this.saveData.player.heading + (idx % 2 === 0 ? 2.1 : -2.1);
        const goalX = px + Math.sin(offsetAng) * 18;
        const goalZ = pz + Math.cos(offsetAng) * 18;
        const dx = goalX - tm.x;
        const dz = goalZ - tm.z;
        const d = Math.hypot(dx, dz) || 1;
        tm.heading = Math.atan2(-dx, -dz);
        tm.x += (dx / d) * Math.min(d, 13 * dt);
        tm.z += (dz / d) * Math.min(d, 13 * dt);
      }

      const wh = sampleWaveHeight(tm.x, tm.z, this.simTime, w.waveIntensity, this.rogueWaveBoost);
      animateSeaMonsterMesh(built, this.simTime * 2.5 + idx, this.combat.active, 0, getMonsterAttackStyle(tm.species), false);
      built.root.position.set(tm.x, wh + built.baseDepthOffset, tm.z);
      built.root.rotation.y = tm.heading;
    });

    // 6b. Drifting Icebergs & Ice Chunks
    for (const entry of this.icebergs.values()) {
      const ib = entry.data;
      if (oceanSim) {
        ib.x += ib.driftVx * dt;
        ib.z += ib.driftVz * dt;
      }
      entry.mesh.position.set(ib.x, Math.sin(this.simTime * 0.45 + ib.x * 0.04) * 0.16, ib.z);
    }
    for (const entry of this.iceChunks.values()) {
      const ic = entry.data;
      if (oceanSim) {
        ic.x += ic.vx * dt;
        ic.z += ic.vz * dt;
        ic.vx *= Math.exp(-1.1 * dt);
        ic.vz *= Math.exp(-1.1 * dt);
      }
      const wh = sampleWaveHeight(ic.x, ic.z, this.simTime, w.waveIntensity, this.rogueWaveBoost);
      entry.mesh.position.set(ic.x, wh + 0.08, ic.z);
    }

    // 6c. Ocean & Island Wildlife Ecosystem (world pauses ocean/other-island wildlife while player is ashore)
    const actorRefX = this.fps.active ? this.fps.pos.x : px;
    const actorRefZ = this.fps.active ? this.fps.pos.z : pz;
    for (const wEntry of this.wildlife.values()) {
      const wa = wEntry.data;
      const isLocalFpsActor = this.fps.active && wa.domain === 'island' && wa.islandId === this.fps.island?.id;
      const shouldStepWildlife = activeSim && !wa.dead && (!this.fps.active || isLocalFpsActor);
      if (shouldStepWildlife) {
        const stepRes = stepWildlifeActor(wa, actorRefX, actorRefZ, this.fps.active, dt);
        if (wa.domain === 'island' && wa.islandId) {
          const isl = this.islands.get(wa.islandId)?.data;
          if (isl) {
            wa.y = Math.max(0.15, sampleIslandTerrainHeight(isl, wa.x, wa.z));
          }
        } else if (wa.species === 'ocean_flock_bird') {
          wa.y = 14.5 + Math.sin(this.simTime * 1.15 + (wa.flockOffsetIndex ?? 0) * 0.75 + wa.x * 0.03) * 1.7;
        } else if (wa.domain === 'air') {
          wa.y = 8.5 + Math.sin(this.simTime * 1.4 + wa.x * 0.05) * 2.2;
        } else {
          wa.y = sampleWaveHeight(wa.x, wa.z, this.simTime, w.waveIntensity, this.rogueWaveBoost) + 0.08;
        }
        if (stepRes.attackedPlayerDamage > 0 && this.fps.active) {
          const reduced = this.fps.weapons.isBlocking
            ? Math.max(2, Math.round(stepRes.attackedPlayerDamage * 0.42))
            : stepRes.attackedPlayerDamage;
          this.fps.playerHp = Math.max(0, this.fps.playerHp - reduced);
          this.sound.playAnimalGrowl();
          this.fps.setStatus(
            this.fps.weapons.isBlocking
              ? `Parried ${WILDLIFE_SPECS[wa.species].label} bite (-${reduced} HP)!`
              : `${WILDLIFE_SPECS[wa.species].label} struck you (-${reduced} HP)!`
          );
        }
      } else if (wa.dead && wa.domain === 'air' && (!this.fps.active || isLocalFpsActor || wa.islandId === this.fps.island?.id)) {
        // Gravity fall for slain birds so they land on the island ground or water surface
        const isl = wa.islandId ? this.islands.get(wa.islandId)?.data : undefined;
        const groundY = isl
          ? Math.max(0.12, sampleIslandTerrainHeight(isl, wa.x, wa.z))
          : sampleWaveHeight(wa.x, wa.z, this.simTime, w.waveIntensity, this.rogueWaveBoost) + 0.05;
        if (wa.y > groundY + 0.14) {
          wa.vy = (wa.vy ?? -1.5) - 24 * dt;
          wa.y = Math.max(groundY + 0.12, wa.y + wa.vy * dt);
          wa.animPhase += dt * 4.5;
        } else {
          wa.y = groundY + 0.12;
          wa.vy = 0;
        }
      }
      wEntry.built.root.position.set(wa.x, wa.y, wa.z);
      wEntry.built.root.rotation.y = Math.atan2(Math.sin(wa.heading), Math.cos(wa.heading)) + Math.PI;
      if (!this.fps.active || isLocalFpsActor || wa.islandId === this.fps.island?.id) {
        animateWildlifeMesh(wEntry.built, wa);
      }
    }

    // 7. Player-Owned Autonomous Fleet Ships (Formation, Combat Assist, Defense & Evolution)
    this.updateFleetShips(dt, oceanSim);
  }

  private updateFleetShips(dt: number, activeSim: boolean): void {
    this.fleetDistressAlerts = [];
    if (this.saveData.fleet.length === 0) return;

    const p = this.saveData.player;
    const w = this.saveData.weather;
    const stepAutonomyNow = activeSim ? ((this.fleetAutonomyAccum += dt) >= 0.5) : false;
    const autoDt = stepAutonomyNow ? this.fleetAutonomyAccum : 0;
    if (stepAutonomyNow) this.fleetAutonomyAccum = 0;

    // Find lowest-HP fleet vessel so comrades can screen it when defending
    let weakestFleet: FleetShipData | null = null;
    for (const fs of this.saveData.fleet) {
      if (fs.sunk) continue;
      if (fs.hull / Math.max(1, fs.maxHull) < 0.55) {
        if (!weakestFleet || fs.hull < weakestFleet.hull) weakestFleet = fs;
      }
    }

    for (let idx = 0; idx < this.saveData.fleet.length; idx++) {
      const fs = this.saveData.fleet[idx];
      if (fs.sunk) continue;
      const entry = this.fleetShips.get(fs.id);
      if (!entry) continue;
      entry.data = fs;

      animateWavingFlag(entry.built.flagMesh, this.simTime, w.windSpeed / 12);
      animateDeckCrewActors(entry.built.crewActors, this.simTime);
      entry.cannonRecoil = Math.max(0, entry.cannonRecoil - dt * 3.8);
      entry.impactRoll = THREE.MathUtils.damp(entry.impactRoll, 0, 5.0, dt);

      for (const cg of entry.built.cannonGroups) {
        const bx = (cg.userData.baseX as number) ?? cg.position.x;
        const side = (cg.userData.side as number) ?? 1;
        cg.position.x = bx - side * entry.cannonRecoil * 0.34;
      }

      if (activeSim) {
        // Tornado & heavy storm hazard damage to fleet ships
        if (this.tornadoPos.active && Math.hypot(fs.x - this.tornadoPos.x, fs.z - this.tornadoPos.z) < 58) {
          fs.hull = Math.max(0, fs.hull - 4.2 * dt);
        }

        const hpRatio = fs.hull / Math.max(1, fs.maxHull);
        const injuredRetreat = hpRatio < 0.38;

        // Pick combat target: prioritize player's active enemy, or nearby threats near flagship / weakest fleetmate
        let targetPirate: PirateShipData | null = null;
        let targetMonster: SeaMonsterData | null = null;
        let targetMerchant: MerchantShipData | null = null;

        if (!injuredRetreat && this.combat.active) {
          const enemies = this.getCombatEnemies();
          const pref = enemies.find((e) => e.id === this.combat.primaryTargetId) ?? enemies[0];
          if (pref) {
            if (pref.kind === 'pirate') targetPirate = this.pirates.get(pref.id)?.data ?? null;
            else if (pref.kind === 'monster') targetMonster = this.monsters.get(pref.id)?.data ?? null;
            else if (pref.kind === 'merchant') targetMerchant = this.merchants.get(pref.id)?.data ?? null;
          }
        }

        const threatRadius = fs.command === 'hold' ? 140 : 230;
        if (!injuredRetreat && !targetPirate && !targetMonster && !targetMerchant && fs.command !== 'hold') {
          let bestDist = threatRadius;
          const anchorX = weakestFleet && fs.command === 'defend' ? weakestFleet.x : p.x;
          const anchorZ = weakestFleet && fs.command === 'defend' ? weakestFleet.z : p.z;
          for (const pEntry of this.pirates.values()) {
            const pir = pEntry.data;
            if (pir.defeated) continue;
            const faction = this.saveData.factions[pir.factionId];
            if (
              (isPlayerPirateAligned(this.saveData.reputation) || (faction && isPirateAlliedWithPlayer(faction, this.saveData.day))) &&
              !pir.isGhost &&
              pir.behavior !== 'hailing'
            ) {
              continue;
            }
            const dAnchor = Math.hypot(pir.x - anchorX, pir.z - anchorZ);
            if ((pir.behavior === 'pursue' || pir.behavior === 'hailing' || pir.isGhost) && dAnchor < bestDist) {
              bestDist = dAnchor;
              targetPirate = pir;
            }
          }
        }

        const engagedTarget = targetPirate ?? targetMonster ?? targetMerchant;
        let goalX = p.x;
        let goalZ = p.z;
        let desiredSpd = Math.abs(p.speed);

        if (fs.command === 'hold' && !injuredRetreat) {
          goalX = fs.x;
          goalZ = fs.z;
          desiredSpd = 0;
        } else if (engagedTarget && !injuredRetreat) {
          const tx = engagedTarget.x;
          const tz = engagedTarget.z;
          const distT = Math.hypot(tx - fs.x, tz - fs.z);
          if (fs.command === 'defend') {
            const guardX = weakestFleet && weakestFleet.id !== fs.id ? weakestFleet.x : p.x;
            const guardZ = weakestFleet && weakestFleet.id !== fs.id ? weakestFleet.z : p.z;
            goalX = guardX * 0.55 + tx * 0.45;
            goalZ = guardZ * 0.55 + tz * 0.45;
            desiredSpd = distT > 40 ? fs.maxSpeed : fs.maxSpeed * 0.4;
          } else {
            const ang = Math.atan2(fs.z - tz, fs.x - tx) + 0.55;
            goalX = tx + Math.cos(ang) * 75;
            goalZ = tz + Math.sin(ang) * 75;
            desiredSpd = fs.maxSpeed;
          }
        } else {
          const form = computeWedgeFormationTarget(
            p.x,
            p.z,
            p.heading,
            injuredRetreat ? Math.max(4, idx) : idx
          );
          goalX = form.x;
          goalZ = form.z;
          const distGoal = Math.hypot(goalX - fs.x, goalZ - fs.z);
          desiredSpd = computeExactFleetMotion(fs, p.speed, p.throttle, distGoal, Boolean(engagedTarget));
        }

        const dPlayer = Math.hypot(fs.x - p.x, fs.z - p.z);
        if (dPlayer < 22 && fs.command !== 'hold') {
          const pushAng = Math.atan2(fs.z - p.z, fs.x - p.x);
          goalX += Math.cos(pushAng) * (24 - dPlayer) * 1.4;
          goalZ += Math.sin(pushAng) * (24 - dPlayer) * 1.4;
        }

        const targetHdg = Math.atan2(-(goalX - fs.x), -(goalZ - fs.z));
        const steered = steerFleetShipHeading(fs, targetHdg, desiredSpd, dt);
        fs.heading = steered.heading;
        fs.speed = steered.speed;
        fs.x = steered.x;
        fs.z = steered.z;

        // Fleet autonomous broadside combat & enemy counter-fire
        if (engagedTarget) {
          this.fleetBattleTimer = 5;
          const distTarget = Math.hypot(engagedTarget.x - fs.x, engagedTarget.z - fs.z);
          fs.reloadTimer -= dt;
          if (fs.reloadTimer <= 0 && distTarget < 195 && fs.cannons > 0) {
            fs.reloadTimer = Math.max(2.6, 5.2 - fs.cannonTier * 0.4);
            entry.cannonRecoil = 1.0;
            this.sound.playCannonFire();
            const dmgPerGun = 7 + fs.cannonTier * 3;
            if (targetPirate && !targetPirate.defeated) {
              const pirEnt = this.pirates.get(targetPirate.id);
              const vol = resolveNpcVsNpcVolley(fs.cannons, dmgPerGun, targetPirate.hull, this.rand);
              targetPirate.hull = vol.nextHull;
              const tPir = targetPirate;
              this.spawnNpcBroadside(
                fs.x,
                fs.z,
                tPir.x,
                tPir.z,
                vol.hits > 0,
                vol.hits > 0 && pirEnt
                  ? () => {
                      if (!tPir.defeated) {
                        this.attachBattleDamageMark({
                          targetKind: 'pirate',
                          shipId: tPir.id,
                          root: pirEnt.mesh,
                          shipX: tPir.x,
                          shipZ: tPir.z,
                          heading: tPir.heading,
                          halfLength: pirEnt.halfLength,
                          halfBeam: pirEnt.halfBeam,
                          attackerX: fs.x,
                          attackerZ: fs.z,
                          section: 'hull',
                          kind: 'cannon',
                          damage: vol.damage,
                        });
                      }
                    }
                  : undefined
              );
              if (vol.hits > 0) {
                if (pirEnt) pirEnt.impactRoll += 0.14;
                this.emitDamageNotification({
                  targetName: tPir.name,
                  attackerName: fs.name,
                  location: 'hull',
                  damage: vol.damage,
                  source: 'cannon',
                  direction: 'ally',
                  worldPos: { x: tPir.x, y: 2.6, z: tPir.z },
                });
              }
              if (vol.sunk) {
                this.handlePirateDefeated(tPir);
              } else if (distTarget < tPir.fireRange && tPir.cannons > 0 && this.rand() < 0.38) {
                const ret = resolveNpcVsNpcVolley(tPir.cannons, tPir.damagePerCannon * 0.65, fs.hull, this.rand);
                fs.hull = ret.nextHull;
                entry.impactRoll += 0.14;
                this.spawnNpcBroadside(tPir.x, tPir.z, fs.x, fs.z, ret.hits > 0);
              }
            } else if (targetMonster && !targetMonster.defeated) {
              const vol = resolveNpcVsNpcVolley(fs.cannons, dmgPerGun, targetMonster.hp, this.rand);
              targetMonster.hp = vol.nextHull;
              this.spawnNpcBroadside(fs.x, fs.z, targetMonster.x, targetMonster.z, vol.hits > 0);
              if (vol.hits > 0) {
                this.emitDamageNotification({
                  targetName: targetMonster.name,
                  attackerName: fs.name,
                  location: 'hull',
                  damage: vol.damage,
                  source: 'cannon',
                  direction: 'ally',
                  worldPos: { x: targetMonster.x, y: 2.2, z: targetMonster.z },
                });
              }
              if (vol.sunk) this.handleMonsterDefeated(targetMonster);
              else if (distTarget < targetMonster.attackRange * 1.4 && this.rand() < 0.35) {
                fs.hull = Math.max(0, fs.hull - Math.round(targetMonster.damage * 0.85));
                entry.impactRoll += 0.2;
              }
            } else if (targetMerchant && !targetMerchant.sunk) {
              const mEnt = this.merchants.get(targetMerchant.id);
              const vol = resolveNpcVsNpcVolley(fs.cannons, dmgPerGun, targetMerchant.hull, this.rand);
              targetMerchant.hull = vol.nextHull;
              const tMerch = targetMerchant;
              this.spawnNpcBroadside(
                fs.x,
                fs.z,
                tMerch.x,
                tMerch.z,
                vol.hits > 0,
                vol.hits > 0 && mEnt
                  ? () => {
                      if (!tMerch.sunk) {
                        this.attachBattleDamageMark({
                          targetKind: 'merchant',
                          shipId: tMerch.id,
                          root: mEnt.mesh,
                          shipX: tMerch.x,
                          shipZ: tMerch.z,
                          heading: tMerch.heading,
                          halfLength: mEnt.halfLength,
                          halfBeam: mEnt.halfBeam,
                          attackerX: fs.x,
                          attackerZ: fs.z,
                          section: 'hull',
                          kind: 'cannon',
                          damage: vol.damage,
                        });
                      }
                    }
                  : undefined
              );
              if (vol.hits > 0) {
                if (mEnt) mEnt.impactRoll += 0.14;
                this.emitDamageNotification({
                  targetName: tMerch.name,
                  attackerName: fs.name,
                  location: 'hull',
                  damage: vol.damage,
                  source: 'cannon',
                  direction: 'ally',
                  worldPos: { x: tMerch.x, y: 2.6, z: tMerch.z },
                });
              }
              if (vol.sunk) this.handleMerchantSunkByPlayer(tMerch);
              else if (tMerch.cannons > 0 && this.rand() < 0.32) {
                const ret = resolveNpcVsNpcVolley(tMerch.cannons, 10, fs.hull, this.rand);
                fs.hull = ret.nextHull;
                entry.impactRoll += 0.14;
              }
            }
          }
        }

        // Permanent sinking if fleet ship reaches 0 HP!
        if (fs.hull <= 0) {
          fs.hull = 0;
          fs.sunk = true;
          this.sound.playSplashHuge();
          this.pushNotification(`FLEET LOSS: ${fs.name} has sunk!`);
          this.addLog('Fleet Ship Sunk', `${fs.name} (${FLEET_CLASS_SPECS[fs.shipClass].label}) was destroyed and sank beneath the waves.`);
          this.scene.remove(entry.built.root);
          entry.built.flagTexture?.dispose();
          entry.built.sailTexture?.dispose();
          this.fleetShips.delete(fs.id);
          this.saveData.fleet = this.saveData.fleet.filter((f) => f.id !== fs.id);
          this.flushImmediateSave();
          idx--;
          continue;
        }

        if (stepAutonomyNow) {
          const autoRes = stepFleetAutonomy(fs, autoDt, Boolean(engagedTarget), this.rand);
          this.saveData.fleet[idx] = autoRes.ship;
          entry.data = autoRes.ship;
          if (autoRes.upgraded) {
            this.scene.remove(entry.built.root);
            entry.built.flagTexture?.dispose();
            entry.built.sailTexture?.dispose();
            entry.built = buildFleetShipMesh(autoRes.ship, this.saveData.customFlag, this.textures);
            entry.built.root.position.set(autoRes.ship.x, 0, autoRes.ship.z);
            entry.built.root.rotation.y = autoRes.ship.heading;
            this.scene.add(entry.built.root);
            if (autoRes.upgradeSummary) {
              this.pushNotification(autoRes.upgradeSummary);
              this.addLog('Fleet Ship Upgraded', autoRes.upgradeSummary);
            }
          }
          if (autoRes.supplyGift) {
            this.grantLoot(0, {
              wood: autoRes.supplyGift.wood,
              food: autoRes.supplyGift.food,
              water: autoRes.supplyGift.water,
              cannonballs: autoRes.supplyGift.cannonballs,
            });
            this.pushNotification(`${autoRes.ship.name} resupplied flagship stores (+wood/food/water).`);
          }
        }
      }

      const hpPct = (fs.hull / Math.max(1, fs.maxHull)) * 100;
      if (hpPct < 45) {
        this.fleetDistressAlerts.push({
          id: fs.id,
          name: fs.name,
          hullPct: Math.round(hpPct),
          inDanger: hpPct < 28,
        });
      }
      entry.built.damagePatches.forEach((patch, pIdx) => {
        patch.visible = hpPct < 82 - pIdx * 18;
      });
      if (hpPct < 65) {
        entry.smokeAccum += dt;
        if (entry.smokeAccum > 0.3) {
          entry.smokeAccum = 0;
          this.spawnParticle(
            fs.x + (Math.random() - 0.5) * 2.5,
            entry.built.root.position.y + 1.6,
            fs.z + (Math.random() - 0.5) * 3.0,
            (Math.random() - 0.5) * 0.8,
            2.0,
            (Math.random() - 0.5) * 0.8,
            1.3,
            0.28,
            0.28,
            0.3
          );
        }
      }

      const pose = computeBoatBuoyancy(
        fs.x,
        fs.z,
        fs.heading,
        entry.built.halfLength,
        entry.built.halfBeam,
        1.5,
        0,
        fs.speed,
        this.simTime,
        w.waveIntensity,
        this.rogueWaveBoost
      );
      entry.built.root.position.set(fs.x, pose.y, fs.z);
      entry.built.root.rotation.order = 'YXZ';
      entry.built.root.rotation.set(pose.pitch, fs.heading, pose.roll + entry.impactRoll);
    }
  }

  private spawnNpcBroadside(
    ax: number,
    az: number,
    bx: number,
    bz: number,
    isHit: boolean,
    onArrive?: () => void
  ): void {
    const start = new THREE.Vector3(ax, 2.5, az);
    const end = new THREE.Vector3(bx + (Math.random() - 0.5) * 4, isHit ? 2.0 : 0.1, bz + (Math.random() - 0.5) * 4);
    this.launchCannonball(start, end, false, isHit, isHit ? onArrive : undefined);
    this.spawnMuzzleEffects(start);
  }

  private executeMonsterStrike(mon: SeaMonsterData, ramMult = 1.0): void {
    const p = this.saveData.player;
    const attackStyle = mon.attackStyle ?? getMonsterAttackStyle(mon.species);
    const armorMit = 1 - computeShipHandling(p.upgrades, p.condition, computeCrewPerformance(p.crew, p.upgrades), this.saveData.weather).damageReduction;
    const dmg = Math.max(4, Math.round(mon.damage * ramMult * armorMit));
    mon.attackAnimTimer = attackStyle === 'tentacles' ? 0.95 : 0.85;

    if (attackStyle === 'tentacles') {
      // Tentacled sea monsters lash across deck & rigging with crushing tentacles
      p.condition.hull = Math.max(0, p.condition.hull - Math.round(dmg * 0.85));
      p.condition.deck = Math.max(10, p.condition.deck - Math.round(dmg * 0.65));
      p.condition.sails = Math.max(15, p.condition.sails - Math.round(dmg * 0.45));
      p.condition.flooding = clamp(p.condition.flooding + dmg * 0.18, 0, 100);
      p.speed *= 0.62;
    } else {
      // Ram & Jaw-Bite predators physically ram the hull and snap with toothed jaws
      p.condition.hull = Math.max(0, p.condition.hull - dmg);
      p.condition.deck = Math.max(10, p.condition.deck - Math.round(dmg * 0.5));
      p.condition.flooding = clamp(p.condition.flooding + dmg * 0.28, 0, 100);

      const rx = p.x - mon.x;
      const rz = p.z - mon.z;
      const rLen = Math.hypot(rx, rz) || 1;
      const nx = rx / rLen;
      const nz = rz / rLen;
      const shove = mon.size === 'legendary' ? 9.0 : mon.size === 'large' ? 6.5 : 4.4;
      p.x += nx * shove;
      p.z += nz * shove;
      p.speed *= 0.5;
      mon.x -= nx * 3.5;
      mon.z -= nz * 3.5;
    }

    this.sound.playMonsterRoar();
    this.sound.playSplashHuge();
    this.trauma = Math.min(1, this.trauma + (attackStyle === 'tentacles' ? 0.62 : 0.55));
    this.playerImpactRoll += (Math.random() < 0.5 ? -1 : 1) * (attackStyle === 'tentacles' ? 0.34 : 0.28);
    this.playerImpactPitch += attackStyle === 'tentacles' ? 0.14 : 0.2;

    for (let k = 0; k < 18; k++) {
      this.spawnParticle(
        (p.x + mon.x) * 0.5 + (Math.random() - 0.5) * 4,
        attackStyle === 'tentacles' ? 1.8 : 0.5,
        (p.z + mon.z) * 0.5 + (Math.random() - 0.5) * 4,
        (Math.random() - 0.5) * 8,
        3.5 + Math.random() * 5.5,
        (Math.random() - 0.5) * 8,
        1.1,
        0.85,
        0.95,
        1.0
      );
    }

    this.attachBattleDamageMark({
      targetKind: 'player',
      shipId: 'player',
      root: this.playerShip.root,
      shipX: p.x,
      shipZ: p.z,
      heading: p.heading,
      halfLength: this.playerShip.halfLength,
      halfBeam: this.playerShip.halfBeam,
      attackerX: mon.x,
      attackerZ: mon.z,
      section: attackStyle === 'tentacles' ? 'deck' : 'hull',
      kind: 'ram',
      damage: dmg,
    });
    this.emitDamageNotification({
      targetName: p.shipName || 'Your Ship',
      attackerName: mon.name,
      location: attackStyle === 'tentacles' ? 'sails' : 'hull',
      damage: dmg,
      source: 'monster',
      direction: 'taken',
      critical: mon.size === 'large' || mon.size === 'legendary' || ramMult >= 1.35,
      worldPos: { x: p.x, y: this.playerShip.root.position.y + 3.2, z: p.z },
    });
    this.checkPermadeath(mon.name);
  }

  private executeMerchantVolley(
    ves: MerchantShipData,
    entry: { mesh: THREE.Group; cannonRecoil: number },
    dist: number
  ): void {
    const stats = computeAutoCombatStats(
      this.saveData.player.upgrades,
      this.saveData.player.crew,
      this.combat.command
    );
    const res = resolveEnemyVolley(
      {
        name: ves.name,
        cannons: ves.cannons,
        maxCannons: ves.cannons,
        crewCount: ves.crewCount,
        maxCrew: ves.maxCrew,
        fireRange: 165,
        damagePerCannon: ves.isCrown ? 16 : 11,
      },
      dist,
      this.saveData.player.condition,
      this.saveData.player.upgrades,
      this.saveData.player.crew,
      this.rand,
      stats.damageTakenMult
    );
    this.applyIncomingVolleyEffects(ves.name, ves.x, entry.mesh.position.y, ves.z, ves.cannons, res);
    entry.cannonRecoil = 1.0;
  }

  private executePirateVolley(
    pirate: PirateShipData,
    entry: { mesh: THREE.Group; cannonRecoil: number },
    dist: number
  ): void {
    const stats = computeAutoCombatStats(
      this.saveData.player.upgrades,
      this.saveData.player.crew,
      this.combat.command
    );
    const res = resolveEnemyVolley(
      pirate,
      dist,
      this.saveData.player.condition,
      this.saveData.player.upgrades,
      this.saveData.player.crew,
      this.rand,
      stats.damageTakenMult
    );
    this.applyIncomingVolleyEffects(pirate.name, pirate.x, entry.mesh.position.y, pirate.z, pirate.cannons, res);
    entry.cannonRecoil = 1.0;
  }

  private applyIncomingVolleyEffects(
    attackerName: string,
    ax: number,
    ay: number,
    az: number,
    cannons: number,
    res: ReturnType<typeof resolveEnemyVolley>
  ): void {
    const p = this.saveData.player;
    p.condition = res.condition;
    if (res.crew.length !== p.crew.length) {
      p.crew = res.crew;
      this.rebuildPlayerShipMesh();
      this.addLog('Crew Lost in Battle', `Lost sailor(s) under fire from ${attackerName}.`);
    } else {
      p.crew = res.crew;
    }

    this.sound.playCannonFire();
    if (res.hits > 0) {
      this.sound.playImpactSplinter();
      this.trauma = Math.min(1, this.trauma + 0.45);
      this.playerImpactRoll += (Math.random() < 0.5 ? -1 : 1) * 0.16;
      this.playerImpactPitch += (Math.random() - 0.5) * 0.1;
      this.emitDamageNotification({
        targetName: p.shipName || 'Your Ship',
        attackerName,
        location: res.hitLocation,
        damage: res.damageTaken,
        source: 'cannon',
        direction: 'taken',
        critical: res.isCritical,
        worldPos: { x: p.x, y: this.playerShip.root.position.y + 3.0, z: p.z },
      });
    }

    const shots = Math.max(2, Math.min(4, cannons));
    for (let i = 0; i < shots; i++) {
      const start = new THREE.Vector3(ax, ay + 2.5, az);
      const isHit = i < res.hits;
      const spread = isHit ? 2.0 : 12.0;
      const end = new THREE.Vector3(
        p.x + (Math.random() - 0.5) * spread,
        isHit ? this.playerShip.root.position.y + 1.8 : 0.1,
        p.z + (Math.random() - 0.5) * spread
      );
      const onFirstHit =
        isHit && i === 0
          ? () => {
              this.attachBattleDamageMark({
                targetKind: 'player',
                shipId: 'player',
                root: this.playerShip.root,
                shipX: p.x,
                shipZ: p.z,
                heading: p.heading,
                halfLength: this.playerShip.halfLength,
                halfBeam: this.playerShip.halfBeam,
                attackerX: ax,
                attackerZ: az,
                section: res.hitLocation,
                kind: 'cannon',
                damage: res.damageTaken,
              });
            }
          : undefined;
      this.launchCannonball(start, end, false, isHit, onFirstHit);
      this.spawnMuzzleEffects(start);
    }

    this.combat.combatLog = [res.summary, ...this.combat.combatLog].slice(0, 6);
    this.checkPermadeath(attackerName);
    this.emitHud();
  }

  /**
   * Crashes push the ship back off the obstacle and bring it to a halt (same effect as pressing SPACE),
   * so slow bumps cost almost nothing; only hitting something at real speed does real damage.
   */
  private softenPlayerCollision(res: { impactSpeed: number; damageA: number }, otherX: number, otherZ: number): void {
    const p = this.saveData.player;
    const dx = p.x - otherX;
    const dz = p.z - otherZ;
    const d = Math.hypot(dx, dz) || 1;
    const back = 2.5 + Math.min(7, res.impactSpeed * 0.55);
    p.x += (dx / d) * back;
    p.z += (dz / d) * back;
    p.speed = 0;
    p.throttle = 0;
    p.isStopping = true;
    const FAST = 9;
    res.damageA = res.impactSpeed > FAST
      ? res.damageA * Math.min(1, 0.4 + (res.impactSpeed - FAST) / 12)
      : res.damageA * 0.12;
  }

  private resolveAllCollisions(dt: number): void {
    for (const [k, t] of Array.from(this.collisionCooldowns.entries())) {
      if (t - dt <= 0) this.collisionCooldowns.delete(k);
      else this.collisionCooldowns.set(k, t - dt);
    }

    const p = this.saveData.player;
    const pShipName = p.shipName || 'Your Ship';
    const pVx = -Math.sin(p.heading) * p.speed;
    const pVz = -Math.cos(p.heading) * p.speed;
    const pRadius = Math.max(this.playerShip.halfBeam * 1.15, this.playerShip.halfLength * 0.52);
    const pMass = 1.0 + (p.upgrades.hullTier - 1) * 0.85;
    const pArmor = Math.max(0.4, 1 - p.upgrades.armorPlating * 0.14);

    // 1. Player vs Sea Rocks & Reefs
    for (const entry of this.rocks.values()) {
      const rk = entry.data;
      const res = resolveShipCollision(
        p.x,
        p.z,
        pVx,
        pVz,
        pRadius,
        pMass,
        pArmor,
        rk.x,
        rk.z,
        0,
        0,
        rk.radius * 0.88,
        999,
        1.0,
        { aHeading: p.heading }
      );
      if (res.collided) {
        this.softenPlayerCollision(res, rk.x, rk.z);
        p.x += res.pushAx;
        p.z += res.pushAz;
        if (res.impactSpeed > 0.5) p.speed = 0;
        if (res.damageA > 0 && !this.collisionCooldowns.has(rk.id)) {
          this.collisionCooldowns.set(rk.id, 0.75);
          p.condition.hull = Math.max(0, p.condition.hull - res.damageA);
          if (res.hitSectionA !== 'hull') {
            p.condition[res.hitSectionA] = Math.max(10, p.condition[res.hitSectionA] - Math.round(res.damageA * 0.65));
          }
          p.condition.flooding = clamp(p.condition.flooding + res.damageA * 0.28, 0, 100);
          this.sound.playImpactSplinter();
          this.trauma = Math.min(1, this.trauma + (res.isLightScrape ? 0.14 : 0.42));
          this.playerImpactRoll += (Math.random() < 0.5 ? -1 : 1) * (res.isLightScrape ? 0.08 : 0.24);
          this.playerImpactPitch += res.isLightScrape ? 0.05 : 0.16;
          this.spawnCollisionSplinters((p.x + rk.x) * 0.5, 1.4, (p.z + rk.z) * 0.5);
          if (!res.isLightScrape || res.damageA >= 2) {
            this.attachBattleDamageMark({
              targetKind: 'player',
              shipId: 'player',
              root: this.playerShip.root,
              shipX: p.x,
              shipZ: p.z,
              heading: p.heading,
              halfLength: this.playerShip.halfLength,
              halfBeam: this.playerShip.halfBeam,
              attackerX: rk.x,
              attackerZ: rk.z,
              section: res.hitSectionA,
              kind: 'ram',
              damage: res.damageA,
            });
          }
          this.emitDamageNotification({
            targetName: pShipName,
            attackerName: 'Sea Rocks',
            location: res.hitSectionA,
            damage: res.damageA,
            source: 'ram',
            direction: 'taken',
            critical: res.damageA >= 12,
            worldPos: { x: (p.x + rk.x) * 0.5, y: 2.2, z: (p.z + rk.z) * 0.5 },
          });
          this.checkPermadeath('Jagged Sea Rocks');
        }
      }
    }

    // 2. Player vs Shipwrecks
    for (const entry of this.wrecks.values()) {
      if (entry.graceUntil && this.simTime < entry.graceUntil) continue;
      const wr = entry.data;
      const wRadius = 4.6 * wr.scale;
      const res = resolveShipCollision(
        p.x,
        p.z,
        pVx,
        pVz,
        pRadius,
        pMass,
        pArmor,
        wr.x,
        wr.z,
        0,
        0,
        wRadius,
        999,
        1.0,
        { aHeading: p.heading }
      );
      if (res.collided) {
        this.softenPlayerCollision(res, wr.x, wr.z);
        p.x += res.pushAx;
        p.z += res.pushAz;
        if (res.impactSpeed > 0.5) p.speed = 0;
        if (res.damageA > 0 && !this.collisionCooldowns.has(wr.id)) {
          this.collisionCooldowns.set(wr.id, 0.75);
          p.condition.hull = Math.max(0, p.condition.hull - res.damageA);
          if (res.hitSectionA !== 'hull') {
            p.condition[res.hitSectionA] = Math.max(10, p.condition[res.hitSectionA] - Math.round(res.damageA * 0.6));
          }
          p.condition.flooding = clamp(p.condition.flooding + res.damageA * 0.25, 0, 100);
          this.sound.playImpactSplinter();
          this.trauma = Math.min(1, this.trauma + (res.isLightScrape ? 0.14 : 0.38));
          this.playerImpactRoll += (Math.random() < 0.5 ? -1 : 1) * (res.isLightScrape ? 0.08 : 0.22);
          this.playerImpactPitch += res.isLightScrape ? 0.04 : 0.14;
          this.spawnCollisionSplinters((p.x + wr.x) * 0.5, 1.4, (p.z + wr.z) * 0.5);
          if (!res.isLightScrape || res.damageA >= 2) {
            this.attachBattleDamageMark({
              targetKind: 'player',
              shipId: 'player',
              root: this.playerShip.root,
              shipX: p.x,
              shipZ: p.z,
              heading: p.heading,
              halfLength: this.playerShip.halfLength,
              halfBeam: this.playerShip.halfBeam,
              attackerX: wr.x,
              attackerZ: wr.z,
              section: res.hitSectionA,
              kind: 'ram',
              damage: res.damageA,
            });
          }
          this.emitDamageNotification({
            targetName: pShipName,
            attackerName: wr.name,
            location: res.hitSectionA,
            damage: res.damageA,
            source: 'ram',
            direction: 'taken',
            critical: res.damageA >= 12,
            worldPos: { x: (p.x + wr.x) * 0.5, y: 2.2, z: (p.z + wr.z) * 0.5 },
          });
          this.checkPermadeath(wr.name);
        }
      }
    }

    // 3. Player vs Merchants, Trawlers & Crown Ships
    for (const entry of this.merchants.values()) {
      const m = entry.data;
      if (m.sunk) continue;
      const mVx = -Math.sin(m.heading) * m.speed;
      const mVz = -Math.cos(m.heading) * m.speed;
      const mRadius = Math.max(entry.halfBeam * 1.15, entry.halfLength * 0.54);
      const mMass = 1.4 + (entry.halfLength - 5) * 0.25;
      const res = resolveShipCollision(
        p.x,
        p.z,
        pVx,
        pVz,
        pRadius,
        pMass,
        pArmor,
        m.x,
        m.z,
        mVx,
        mVz,
        mRadius,
        mMass,
        1.0,
        { aHeading: p.heading, bHeading: m.heading }
      );
      if (res.collided) {
        this.softenPlayerCollision(res, m.x, m.z);
        p.x += res.pushAx;
        p.z += res.pushAz;
        m.x += res.pushBx;
        m.z += res.pushBz;
        if (res.impactSpeed > 0.5) {
          p.speed = 0;
          m.speed = res.knockbackSpeedB;
        }
        if ((res.damageA > 0 || res.damageB > 0) && !this.collisionCooldowns.has(m.id)) {
          this.collisionCooldowns.set(m.id, 0.75);
          p.condition.hull = Math.max(0, p.condition.hull - res.damageA);
          if (res.hitSectionA !== 'hull' && res.damageA > 0) {
            p.condition[res.hitSectionA] = Math.max(10, p.condition[res.hitSectionA] - Math.round(res.damageA * 0.55));
          }
          p.condition.flooding = clamp(p.condition.flooding + res.damageA * 0.2, 0, 100);
          m.hull = Math.max(0, m.hull - res.damageB);

          this.sound.playImpactSplinter();
          this.trauma = Math.min(1, this.trauma + (res.isLightScrape ? 0.12 : 0.38));
          this.playerImpactRoll += res.isLightScrape ? 0.08 : 0.22;
          entry.impactRoll -= res.isLightScrape ? 0.08 : 0.22;
          this.spawnCollisionSplinters((p.x + m.x) * 0.5, 1.5, (p.z + m.z) * 0.5);

          if (!res.isLightScrape || res.damageA >= 2) {
            this.attachBattleDamageMark({
              targetKind: 'player',
              shipId: 'player',
              root: this.playerShip.root,
              shipX: p.x,
              shipZ: p.z,
              heading: p.heading,
              halfLength: this.playerShip.halfLength,
              halfBeam: this.playerShip.halfBeam,
              attackerX: m.x,
              attackerZ: m.z,
              section: res.hitSectionA,
              kind: 'ram',
              damage: res.damageA,
            });
          }
          if (!res.isLightScrape || res.damageB >= 2) {
            this.attachBattleDamageMark({
              targetKind: 'merchant',
              shipId: m.id,
              root: entry.mesh,
              shipX: m.x,
              shipZ: m.z,
              heading: m.heading,
              halfLength: entry.halfLength,
              halfBeam: entry.halfBeam,
              attackerX: p.x,
              attackerZ: p.z,
              section: res.hitSectionB,
              kind: 'ram',
              damage: res.damageB,
            });
          }
          if (res.damageA > 0) {
            this.emitDamageNotification({
              targetName: pShipName,
              attackerName: m.name,
              location: res.hitSectionA,
              damage: res.damageA,
              source: 'ram',
              direction: 'taken',
              critical: res.damageA >= 12,
              worldPos: { x: p.x, y: 3.0, z: p.z },
            });
          }
          if (res.damageB > 0) {
            this.emitDamageNotification({
              targetName: m.name,
              attackerName: pShipName,
              location: res.hitSectionB,
              damage: res.damageB,
              source: 'ram',
              direction: 'dealt',
              critical: res.damageB >= 14,
              worldPos: { x: m.x, y: 2.6, z: m.z },
            });
          }

          // Light scrape does NOT turn friendly/neutral ships hostile!
          if (!res.isLightScrape && res.damageB >= 5 && m.hull > 0 && !m.hostileToPlayer) {
            if (m.cannons > 0) {
              m.hostileToPlayer = true;
              this.engageCombatEnemy(
                { kind: 'merchant', id: m.id },
                `${m.name} returned hostility after a heavy ramming collision!`,
                false
              );
              this.pushNotification(`${m.name} turned hostile after heavy ramming!`);
            } else {
              m.fleeingFromPlayer = true;
              m.fleeTimer = 20;
              m.desperateRamCooldown = 14;
              this.pushNotification(`${m.name} panicked and fled after the heavy impact!`);
            }
          }
          if (m.hull <= 0) this.handleMerchantSunkByPlayer(m);
          this.checkPermadeath(m.name);
        }
      }
    }

    // 4. Player vs Pirates & Ghost Ships
    for (const entry of this.pirates.values()) {
      const pir = entry.data;
      if (pir.defeated || pir.playerId) continue;
      const pirVx = -Math.sin(pir.heading) * pir.speed;
      const pirVz = -Math.cos(pir.heading) * pir.speed;
      const pirRadius = Math.max(entry.halfBeam * 1.15, entry.halfLength * 0.54);
      const pirMass = Math.max(1.0, pir.maxHull / 85);

      const res = resolveShipCollision(
        p.x,
        p.z,
        pVx,
        pVz,
        pRadius,
        pMass,
        pArmor,
        pir.x,
        pir.z,
        pirVx,
        pirVz,
        pirRadius,
        pirMass,
        1.0,
        { aHeading: p.heading, bHeading: pir.heading }
      );
      if (res.collided) {
        this.softenPlayerCollision(res, pir.x, pir.z);
        p.x += res.pushAx;
        p.z += res.pushAz;
        pir.x += res.pushBx;
        pir.z += res.pushBz;
        if (res.impactSpeed > 0.5) {
          p.speed = 0;
          pir.speed = res.knockbackSpeedB;
        }
        if ((pir.ramCommitTimer ?? 0) > 0) {
          pir.ramCommitTimer = 0;
          pir.ramCooldown = 14;
        }
        if ((res.damageA > 0 || res.damageB > 0) && !this.collisionCooldowns.has(pir.id)) {
          this.collisionCooldowns.set(pir.id, 0.75);
          p.condition.hull = Math.max(0, p.condition.hull - res.damageA);
          if (res.hitSectionA !== 'hull' && res.damageA > 0) {
            p.condition[res.hitSectionA] = Math.max(10, p.condition[res.hitSectionA] - Math.round(res.damageA * 0.6));
          }
          p.condition.flooding = clamp(p.condition.flooding + res.damageA * 0.22, 0, 100);
          pir.hull = Math.max(0, pir.hull - res.damageB);
          if (res.hitSectionB === 'sails') pir.sails = Math.max(20, pir.sails - Math.round(res.damageB * 0.4));
          if (res.hitSectionB === 'steering') pir.steering = Math.max(25, pir.steering - Math.round(res.damageB * 0.5));

          this.sound.playImpactSplinter();
          this.trauma = Math.min(1, this.trauma + (res.isLightScrape ? 0.14 : 0.48));
          this.playerImpactRoll += res.isLightScrape ? 0.08 : 0.24;
          this.playerImpactPitch += res.isLightScrape ? 0.05 : 0.14;
          entry.impactRoll -= res.isLightScrape ? 0.08 : 0.24;
          entry.impactPitch -= res.isLightScrape ? 0.04 : 0.12;
          this.spawnCollisionSplinters((p.x + pir.x) * 0.5, 1.6, (p.z + pir.z) * 0.5);

          if (!res.isLightScrape || res.damageA >= 2) {
            this.attachBattleDamageMark({
              targetKind: 'player',
              shipId: 'player',
              root: this.playerShip.root,
              shipX: p.x,
              shipZ: p.z,
              heading: p.heading,
              halfLength: this.playerShip.halfLength,
              halfBeam: this.playerShip.halfBeam,
              attackerX: pir.x,
              attackerZ: pir.z,
              section: res.hitSectionA,
              kind: 'ram',
              damage: res.damageA,
            });
          }
          if (!res.isLightScrape || res.damageB >= 2) {
            this.attachBattleDamageMark({
              targetKind: 'pirate',
              shipId: pir.id,
              root: entry.mesh,
              shipX: pir.x,
              shipZ: pir.z,
              heading: pir.heading,
              halfLength: entry.halfLength,
              halfBeam: entry.halfBeam,
              attackerX: p.x,
              attackerZ: p.z,
              section: res.hitSectionB,
              kind: 'ram',
              damage: res.damageB,
            });
          }
          if (res.damageA > 0) {
            this.emitDamageNotification({
              targetName: pShipName,
              attackerName: pir.name,
              location: res.hitSectionA,
              damage: res.damageA,
              source: 'ram',
              direction: 'taken',
              critical: res.damageA >= 14,
              worldPos: { x: p.x, y: 3.0, z: p.z },
            });
          }
          if (res.damageB > 0) {
            this.emitDamageNotification({
              targetName: pir.name,
              attackerName: pShipName,
              location: res.hitSectionB,
              damage: res.damageB,
              source: 'ram',
              direction: 'dealt',
              critical: res.damageB >= 16,
              worldPos: { x: pir.x, y: 2.6, z: pir.z },
            });
          }

          if (
            !this.isEnemyInCombat(pir.id) &&
            pir.hull > 0 &&
            (!res.isLightScrape || pir.behavior === 'pursue' || pir.behavior === 'hailing' || pir.isGhost)
          ) {
            this.startNavalBattle(pir);
          }
          if (pir.hull <= 0) this.handlePirateDefeated(pir);
          this.checkPermadeath(pir.name);
        }
      }
    }

    // 5. AI Ship Collisions (Pirates vs Rocks/Pirates/Merchants, Fleet vs Rocks/Pirates)
    const nearbyPirates = Array.from(this.pirates.values()).filter(
      (e) => !e.data.defeated && Math.hypot(e.data.x - p.x, e.data.z - p.z) < 380
    );
    const nearbyMerchants = Array.from(this.merchants.values()).filter(
      (e) => !e.data.sunk && Math.hypot(e.data.x - p.x, e.data.z - p.z) < 380
    );

    for (const pEnt of nearbyPirates) {
      const pir = pEnt.data;
      const pRad = Math.max(pEnt.halfBeam * 1.1, pEnt.halfLength * 0.5);
      const pM = Math.max(1.0, pir.maxHull / 85);
      const vx = -Math.sin(pir.heading) * pir.speed;
      const vz = -Math.cos(pir.heading) * pir.speed;

      for (const rk of this.rocks.values()) {
        if (Math.hypot(rk.data.x - pir.x, rk.data.z - pir.z) > 36) continue;
        const rRes = resolveShipCollision(
          pir.x,
          pir.z,
          vx,
          vz,
          pRad,
          pM,
          1.0,
          rk.data.x,
          rk.data.z,
          0,
          0,
          rk.data.radius * 0.88,
          999,
          1.0,
          { aHeading: pir.heading }
        );
        if (rRes.collided) {
          pir.x += rRes.pushAx;
          pir.z += rRes.pushAz;
          if (rRes.impactSpeed > 0.5) pir.speed = rRes.knockbackSpeedA;
          const ck = `ai_rk_${pir.id}_${rk.data.id}`;
          if (rRes.damageA > 0 && !this.collisionCooldowns.has(ck)) {
            this.collisionCooldowns.set(ck, 1.0);
            pir.hull = Math.max(0, pir.hull - rRes.damageA);
            pEnt.impactRoll += 0.16;
            if (!rRes.isLightScrape) {
              this.attachBattleDamageMark({
                targetKind: 'pirate',
                shipId: pir.id,
                root: pEnt.mesh,
                shipX: pir.x,
                shipZ: pir.z,
                heading: pir.heading,
                halfLength: pEnt.halfLength,
                halfBeam: pEnt.halfBeam,
                attackerX: rk.data.x,
                attackerZ: rk.data.z,
                section: rRes.hitSectionA,
                kind: 'ram',
                damage: rRes.damageA,
              });
            }
            if (pir.hull <= 0) this.handlePirateDefeated(pir);
          }
        }
      }

      for (const mEnt of nearbyMerchants) {
        const m = mEnt.data;
        if (m.sunk) continue;
        const mRad = Math.max(mEnt.halfBeam * 1.1, mEnt.halfLength * 0.5);
        const mM = 1.4 + (mEnt.halfLength - 5) * 0.25;
        const rRes = resolveShipCollision(
          pir.x,
          pir.z,
          vx,
          vz,
          pRad,
          pM,
          1.0,
          m.x,
          m.z,
          -Math.sin(m.heading) * m.speed,
          -Math.cos(m.heading) * m.speed,
          mRad,
          mM,
          1.0,
          { aHeading: pir.heading, bHeading: m.heading }
        );
        if (rRes.collided) {
          pir.x += rRes.pushAx;
          pir.z += rRes.pushAz;
          m.x += rRes.pushBx;
          m.z += rRes.pushBz;
          if (rRes.impactSpeed > 0.5) {
            pir.speed = rRes.knockbackSpeedA;
            m.speed = rRes.knockbackSpeedB;
          }
          const ck = `ai_pm_${pir.id}_${m.id}`;
          if (!rRes.isLightScrape && (rRes.damageA > 0 || rRes.damageB > 0) && !this.collisionCooldowns.has(ck)) {
            this.collisionCooldowns.set(ck, 1.0);
            pir.hull = Math.max(0, pir.hull - rRes.damageA);
            m.hull = Math.max(0, m.hull - rRes.damageB);
            pEnt.impactRoll += 0.16;
            mEnt.impactRoll -= 0.16;
            this.spawnCollisionSplinters((pir.x + m.x) * 0.5, 1.4, (pir.z + m.z) * 0.5);
            if (rRes.damageA > 0) {
              this.attachBattleDamageMark({
                targetKind: 'pirate',
                shipId: pir.id,
                root: pEnt.mesh,
                shipX: pir.x,
                shipZ: pir.z,
                heading: pir.heading,
                halfLength: pEnt.halfLength,
                halfBeam: pEnt.halfBeam,
                attackerX: m.x,
                attackerZ: m.z,
                section: rRes.hitSectionA,
                kind: 'ram',
                damage: rRes.damageA,
              });
            }
            if (rRes.damageB > 0) {
              this.attachBattleDamageMark({
                targetKind: 'merchant',
                shipId: m.id,
                root: mEnt.mesh,
                shipX: m.x,
                shipZ: m.z,
                heading: m.heading,
                halfLength: mEnt.halfLength,
                halfBeam: mEnt.halfBeam,
                attackerX: pir.x,
                attackerZ: pir.z,
                section: rRes.hitSectionB,
                kind: 'ram',
                damage: rRes.damageB,
              });
            }
            if (m.hull <= 0) {
              m.sunk = true;
              m.sinkProgress = 0;
              m.salvageable = rollEnemySalvageable(false, this.rand);
              if (!m.salvageable) this.spawnShipExplosion(m.x, m.z, 1.0);
              this.spawnSunkenShipwreckForVessel({ kind: 'merchant', ship: m }, true, 2.0);
            }
            if (pir.hull <= 0) this.handlePirateDefeated(pir);
          }
        }
      }
    }

    for (let i = 0; i < nearbyPirates.length; i++) {
      for (let j = i + 1; j < nearbyPirates.length; j++) {
        const aEnt = nearbyPirates[i];
        const bEnt = nearbyPirates[j];
        const a = aEnt.data;
        const b = bEnt.data;
        if (a.defeated || b.defeated) continue;
        const rRes = resolveShipCollision(
          a.x,
          a.z,
          -Math.sin(a.heading) * a.speed,
          -Math.cos(a.heading) * a.speed,
          Math.max(aEnt.halfBeam * 1.1, aEnt.halfLength * 0.5),
          Math.max(1.0, a.maxHull / 85),
          1.0,
          b.x,
          b.z,
          -Math.sin(b.heading) * b.speed,
          -Math.cos(b.heading) * b.speed,
          Math.max(bEnt.halfBeam * 1.1, bEnt.halfLength * 0.5),
          Math.max(1.0, b.maxHull / 85),
          1.0,
          { aHeading: a.heading, bHeading: b.heading }
        );
        if (rRes.collided) {
          a.x += rRes.pushAx;
          a.z += rRes.pushAz;
          b.x += rRes.pushBx;
          b.z += rRes.pushBz;
          if (rRes.impactSpeed > 0.5) {
            a.speed = rRes.knockbackSpeedA;
            b.speed = rRes.knockbackSpeedB;
          }
        }
      }
    }

    // 6. Solid Island Coastline Collisions (Player, Merchants, Pirates, Fleet cannot clip inside island sides)
    for (const islEntry of this.islands.values()) {
      const isl = islEntry.data;
      const cRes = resolveShipIslandCoastCollision(isl, p.x, p.z, pRadius);
      if (cRes.collided) {
        p.x = cRes.nextX;
        p.z = cRes.nextZ;
        const absSpd = Math.abs(p.speed);
        if (absSpd > 3.6 && !this.collisionCooldowns.has(isl.id)) {
          this.collisionCooldowns.set(isl.id, 1.0);
          const dmg = Math.max(2, Math.round((absSpd - 3.0) * 1.45));
          p.condition.hull = Math.max(0, p.condition.hull - dmg);
          this.sound.playImpactSplinter();
          this.trauma = Math.min(1, this.trauma + 0.36);
          this.emitDamageNotification({
            targetName: pShipName,
            attackerName: `${isl.name} Coast`,
            location: 'hull',
            damage: dmg,
            source: 'ram',
            direction: 'taken',
            worldPos: { x: p.x, y: 2.6, z: p.z },
          });
          this.checkPermadeath(`${isl.name} Coast`);
        }
        p.speed = Math.min(0, -Math.abs(p.speed) * 0.25);
      }

      for (const pEnt of nearbyPirates) {
        const pir = pEnt.data;
        const pRad = Math.max(pEnt.halfBeam * 1.1, pEnt.halfLength * 0.5);
        const pc = resolveShipIslandCoastCollision(isl, pir.x, pir.z, pRad);
        if (pc.collided) {
          pir.x = pc.nextX;
          pir.z = pc.nextZ;
          pir.heading = Math.atan2(-pc.nx, -pc.nz);
          pir.speed *= 0.4;
        }
      }

      for (const mEnt of nearbyMerchants) {
        const m = mEnt.data;
        const mRad = Math.max(mEnt.halfBeam * 1.1, mEnt.halfLength * 0.5);
        const mc = resolveShipIslandCoastCollision(isl, m.x, m.z, mRad);
        if (mc.collided) {
          m.x = mc.nextX;
          m.z = mc.nextZ;
          m.heading = Math.atan2(-mc.nx, -mc.nz);
          m.speed *= 0.4;
        }
      }

      for (const fEnt of this.fleetShips.values()) {
        const fs = fEnt.data;
        if (fs.sunk) continue;
        const fRad = Math.max(fEnt.built.halfBeam * 1.1, fEnt.built.halfLength * 0.5);
        const fc = resolveShipIslandCoastCollision(isl, fs.x, fs.z, fRad);
        if (fc.collided) {
          fs.x = fc.nextX;
          fs.z = fc.nextZ;
          fs.speed *= 0.5;
        }
      }
    }

    // 7. Player vs Icebergs (giant immovable vs pushable smaller icebergs)
    for (const ibEntry of this.icebergs.values()) {
      const ib = ibEntry.data;
      const res = resolveShipCollision(
        p.x,
        p.z,
        pVx,
        pVz,
        pRadius,
        pMass,
        pArmor,
        ib.x,
        ib.z,
        ib.driftVx,
        ib.driftVz,
        ib.radius * 0.85,
        ib.isGiant ? 999 : ib.radius * 0.55,
        1.0,
        { aHeading: p.heading }
      );
      if (res.collided) {
        p.x += res.pushAx;
        p.z += res.pushAz;
        if (!ib.isGiant) {
          ib.x += res.pushBx;
          ib.z += res.pushBz;
        }
        if (res.impactSpeed > 0.5) p.speed = res.knockbackSpeedA;
        if (res.damageA > 0 && !this.collisionCooldowns.has(ib.id)) {
          this.collisionCooldowns.set(ib.id, 0.85);
          p.condition.hull = Math.max(0, p.condition.hull - res.damageA);
          p.condition.flooding = clamp(p.condition.flooding + res.damageA * 0.26, 0, 100);
          this.sound.playIceCrack();
          this.trauma = Math.min(1, this.trauma + (res.isLightScrape ? 0.14 : 0.42));
          this.spawnCollisionSplinters((p.x + ib.x) * 0.5, 1.5, (p.z + ib.z) * 0.5);
          this.emitDamageNotification({
            targetName: pShipName,
            attackerName: ib.isGiant ? 'Colossal Iceberg' : 'Drifting Iceberg',
            location: res.hitSectionA,
            damage: res.damageA,
            source: 'ram',
            direction: 'taken',
            critical: res.damageA >= 12,
            worldPos: { x: (p.x + ib.x) * 0.5, y: 2.5, z: (p.z + ib.z) * 0.5 },
          });
          this.checkPermadeath('Iceberg Collision');
        }
      }
    }

    // 8. Player vs Pushable Ice Chunks
    for (const icEntry of this.iceChunks.values()) {
      const ic = icEntry.data;
      const dx = ic.x - p.x;
      const dz = ic.z - p.z;
      const d = Math.hypot(dx, dz) || 1;
      const minD = pRadius + ic.radius;
      if (d < minD) {
        const nx = dx / d;
        const nz = dz / d;
        const push = minD - d + 0.35;
        ic.x += nx * push;
        ic.z += nz * push;
        ic.vx = clamp(ic.vx + nx * Math.max(2.0, Math.abs(p.speed) * 0.85), -14, 14);
        ic.vz = clamp(ic.vz + nz * Math.max(2.0, Math.abs(p.speed) * 0.85), -14, 14);
        if (!this.collisionCooldowns.has(ic.id)) {
          this.collisionCooldowns.set(ic.id, 0.7);
          this.sound.playIceCrack();
        }
      }
    }

    // 9. Player vs Breakable Ice Sheets (crack -> shatter or rebound)
    for (const shEntry of this.iceSheets.values()) {
      const sh = shEntry.data;
      if (sh.broken) continue;
      const dx = p.x - sh.x;
      const dz = p.z - sh.z;
      const d = Math.hypot(dx, dz) || 1;
      if (d < sh.radius + pRadius * 0.85 && !this.collisionCooldowns.has(sh.id)) {
        this.collisionCooldowns.set(sh.id, 0.5);
        const iceRes = resolveBreakableIceSheetCollision(
          p.speed,
          pMass,
          p.upgrades.hullTier,
          sh.hp,
          sh.maxHp,
          sh.thickness
        );
        sh.hp = iceRes.newHp;
        sh.crackStage = iceRes.newCrackStage;
        sh.broken = iceRes.shattered;
        updateBreakableIceSheetVisuals(shEntry.built, sh);

        if (iceRes.shattered) {
          this.sound.playIceShatter();
          p.speed *= iceRes.speedRetainedMult;
          for (let k = 0; k < 20; k++) {
            this.spawnParticle(
              sh.x + (Math.random() - 0.5) * sh.radius * 0.9,
              0.7,
              sh.z + (Math.random() - 0.5) * sh.radius * 0.9,
              (Math.random() - 0.5) * 9,
              3 + Math.random() * 5,
              (Math.random() - 0.5) * 9,
              1.1,
              0.84,
              0.94,
              0.99
            );
          }
          this.pushNotification(`Shattered pack ice sheet (${sh.thickness === 1 ? 'thin' : sh.thickness === 2 ? 'medium' : 'thick'})!`);
        } else {
          this.sound.playIceCrack();
          p.speed = iceRes.reboundSpeed !== 0 ? iceRes.reboundSpeed : p.speed * iceRes.speedRetainedMult;
          const nx = dx / d;
          const nz = dz / d;
          p.x = sh.x + nx * (sh.radius + pRadius * 0.95);
          p.z = sh.z + nz * (sh.radius + pRadius * 0.95);
        }

        if (iceRes.shipHullDamage > 0) {
          p.condition.hull = Math.max(0, p.condition.hull - iceRes.shipHullDamage);
          this.emitDamageNotification({
            targetName: pShipName,
            attackerName: 'Sea Ice Shelf',
            location: 'hull',
            damage: iceRes.shipHullDamage,
            source: 'ram',
            direction: 'taken',
            worldPos: { x: p.x, y: 2.3, z: p.z },
          });
          this.checkPermadeath('Pack Ice Shelf');
        }
      }
    }
  }

  private spawnCollisionSplinters(x: number, y: number, z: number): void {
    for (let k = 0; k < 14; k++) {
      this.spawnParticle(
        x,
        y,
        z,
        (Math.random() - 0.5) * 7,
        2.5 + Math.random() * 4.5,
        (Math.random() - 0.5) * 7,
        0.95,
        k % 3 === 0 ? 0.9 : 0.68,
        k % 3 === 0 ? 0.85 : 0.48,
        k % 3 === 0 ? 0.8 : 0.28
      );
    }
  }

  private runSurvivalTick(dt: number): void {
    const p = this.saveData.player;
    const prevCrewCount = p.crew.length;

    const res = stepSurvivalAndRepairs(
      dt,
      p.inventory,
      p.crew,
      p.condition,
      p.upgrades,
      this.saveData.activeRepairJob,
      this.saveData.weather,
      this.rand
    );

    p.inventory = res.inventory;
    p.crew = res.crew;
    p.condition = res.condition;
    this.saveData.activeRepairJob = res.activeRepairJob;

    // Passive crew / fishing gear trawling
    const fishRes = stepCrewFishing(
      this.saveData,
      this.currentBiome,
      dt,
      this.crewFishingTimer,
      this.rand
    );
    this.crewFishingTimer = fishRes.newTimer;
    if (fishRes.caughtRegular > 0 || fishRes.caughtRare > 0) {
      const saltTxt = fishRes.saltAdded > 0 ? ` (+${fishRes.saltAdded} Salt)` : '';
      const msg =
        fishRes.caughtRare > 0
          ? `Fishermen hauled in rare ${fishRes.lastSpecies || 'catch'}${saltTxt}!`
          : `Fishing rig caught +${fishRes.caughtRegular} ${fishRes.lastSpecies || 'Fish'}${saltTxt}!`;
      this.pushNotification(msg);
    }

    if (res.completedRepairSection) {
      this.clearPlayerDamageMarks(res.completedRepairSection);
      this.sound.playShipBell();
      this.pushNotification(`Manual repair finished: ${res.completedRepairSection.toUpperCase()} at 100%!`);
      const repXp = grantCrewRoleXp(p.crew, ['repair'], 12);
      p.crew = repXp.crew;
      if (repXp.levelUps.length > 0) {
        this.pushNotification(`${repXp.levelUps[0]}!`);
      }
    }

    if (res.levelUps && res.levelUps.length > 0) {
      this.pushNotification(`${res.levelUps[0]}!`);
    }

    if (res.casualties.length > 0 || res.escapedNames.length > 0) {
      this.rebuildPlayerShipMesh();
      this.addLog('Crew Event', res.events.join(' '));
      this.pushNotification(res.events[0]);
    } else if (p.crew.length !== prevCrewCount) {
      this.rebuildPlayerShipMesh();
    }

    if (p.condition.hull < 82) {
      this.triggerTutorial(
        'hull_damage',
        'Manual Ship Repairs',
        'Damage remains permanent until you open Ship Management [Tab] -> Repairs and start a manual repair job.'
      );
    }

    if (res.sunk || res.allCrewDead) {
      const cause = res.allCrewDead
        ? 'Your entire crew perished at sea.'
        : p.condition.flooding >= 100
          ? 'Your vessel flooded and sank beneath the waves.'
          : 'Your hull broke apart in open waters.';
      this.triggerPermadeath(cause);
    }
  }

  private maybeSpawnPirateHunter(): void {
    if (!this.isMultiplayerWorldAuthority || this.combat.active || this.modalOpen) return;
    const px = this.saveData.player.x;
    const pz = this.saveData.player.z;

    let nearbyActive = 0;
    for (const entry of this.pirates.values()) {
      if (entry.data.defeated) continue;
      if (Math.hypot(entry.data.x - px, entry.data.z - pz) < 460) {
        nearbyActive++;
      }
    }
    if (nearbyActive >= 2) return;

    const angle = this.rand() * Math.PI * 2;
    const spawnDist = 330 + this.rand() * 80;
    const sx = px + Math.cos(angle) * spawnDist;
    const sz = pz + Math.sin(angle) * spawnDist;

    const tier =
      this.saveData.player.upgrades.hullTier >= 4 || this.saveData.day >= 5
        ? this.rand() < 0.45
          ? 'brigantine'
          : 'galleon'
        : this.saveData.day >= 2 || this.saveData.player.gold >= 220
          ? this.rand() < 0.55
            ? 'sloop'
            : 'brigantine'
          : 'sloop';

    const id = `hunter_${++this.hunterSeq}_${Math.floor(this.simTime)}`;
    const pirate = generatePirateShip(id, sx, sz, tier, this.rand);
    pirate.heading = Math.atan2(-(px - sx), -(pz - sz));
    pirate.patrolCenterX = px;
    pirate.patrolCenterZ = pz;
    pirate.behavior = 'pursue';

    const built = buildNpcShip(
      pirate.hullArchetype,
      'pirate',
      this.textures,
      pirate.factionId,
      Math.min(14, pirate.cannons)
    );
    built.root.position.set(pirate.x, 0, pirate.z);
    built.root.rotation.y = pirate.heading;
    this.scene.add(built.root);

    this.hunterIds.add(id);
    this.pirates.set(id, {
      data: pirate,
      mesh: built.root,
      sails: built.sails,
      flagMesh: built.flagMesh,
      cannonGroups: built.cannonGroups,
      damagePatches: built.damagePatches,
      crewActors: built.crewActors,
      halfLength: built.halfLength,
      halfBeam: built.halfBeam,
      cannonRecoil: 0,
      impactRoll: 0,
      impactPitch: 0,
      smokeAccum: 0,
    });

    this.pushNotification(`Pirate hunter spotted! "${pirate.name}" (${PIRATE_FACTIONS[pirate.factionId].shortName})`);
  }

  private checkPermadeath(enemyName: string): void {
    const p = this.saveData.player;
    if (this.playerSinkingTimer > 0) return;
    if (p.crew.length === 0) {
      this.playerSinkingCause = `Your crew fell against ${enemyName}.`;
      this.playerSinkingTimer = 1.8;
      this.combat.active = false;
      this.combat.pirateId = null;
      this.combat.monsterId = null;
      this.combat.hostileMerchantId = null;
      this.combat.enemies = [];
      this.combat.primaryTargetId = null;
    } else if (p.condition.hull <= 0 || p.condition.flooding >= 100) {
      this.playerSinkingCause = `Your vessel was sunk by ${enemyName}.`;
      this.playerSinkingTimer = 1.8;
      this.combat.active = false;
      this.combat.pirateId = null;
      this.combat.monsterId = null;
      this.combat.hostileMerchantId = null;
      this.combat.enemies = [];
      this.combat.primaryTargetId = null;
      this.pushNotification('Hull breached! Your vessel is sinking!');
    }
  }

  private triggerPermadeath(cause: string): void {
    if (this.phase === 'gameover') return;
    this.saveData.stats.causeOfDeath = cause;
    const player = this.saveData.player;
    const lostGold = Math.max(0, Math.floor(player.gold || 0));
    // Death strips all carried wealth, materials, cargo, equipment supplies and loot.
    // The captain keeps their actual ship, its upgrades, condition, and crew.
    // A small survival bundle is the only inventory granted after death.
    player.gold = 0;
    player.inventory = { ...createEmptyInventory(), food: 40, water: 42 };
    // Empty supplies stored aboard support vessels as well; the emergency bundle
    // is issued only to the captain's main ship after death.
    for (const fleetShip of this.saveData.fleet ?? []) {
      fleetShip.autonomousResources = {
        ...fleetShip.autonomousResources,
        wood: 0, iron: 0, cloth: 0, gold: 0, food: 0, water: 0,
      };
    }
    // Restore enough hull integrity to let the same ship sail again after respawning.
    player.condition.hull = Math.max(48, player.condition.hull);
    player.condition.flooding = 0;
    player.speed = 0;
    player.throttle = 0;
    player.rudder = 0;
    player.isStopping = true;
    if (player.crew.length === 0 && this.lastKnownCrew.length > 0) {
      player.crew = JSON.parse(JSON.stringify(this.lastKnownCrew));
    }
    this.playerSinkingTimer = 0;
    this.playerSinkingCause = '';
    this.combat.active = false;
    this.combat.pirateId = null;
    this.combat.monsterId = null;
    this.combat.hostileMerchantId = null;
    this.combat.enemies = [];
    this.combat.primaryTargetId = null;
    const snapshot = this.getSaveSnapshot();
    this.callbacks.onSaveUpdate(snapshot);
    saveVoyageToStorage(snapshot);
    this.notifyPvpDown(lostGold);
    this.callbacks.onPlayerDeath?.({ cause, lostGold });
    this.pushNotification('You lost all carried resources and gold. Your ship, upgrades and crew remain. Emergency supplies: 40 provisions and 42 fresh water. Respawning near another captain…');
    if (!this.callbacks.onPlayerDeath) this.respawnAfterDeath({ x: 0, z: 0, heading: 0 });
  }

  private updateCannonballs(dt: number): void {
    for (let i = this.shipExplosions.length - 1; i >= 0; i--) {
      const exp = this.shipExplosions[i];
      exp.life += dt;
      const t = exp.life / exp.maxLife;
      if (t >= 1) {
        this.scene.remove(exp.mesh);
        this.shipExplosions.splice(i, 1);
      } else {
        exp.mesh.scale.setScalar(0.8 + Math.sin(t * Math.PI) * exp.maxScale);
      }
    }

    for (let i = this.muzzleFlashes.length - 1; i >= 0; i--) {
      const mf = this.muzzleFlashes[i];
      mf.life += dt;
      if (mf.life >= mf.maxLife) {
        this.scene.remove(mf.mesh);
        this.muzzleFlashes.splice(i, 1);
      } else {
        mf.mesh.scale.setScalar(1.4 - (mf.life / mf.maxLife) * 0.9);
      }
    }

    for (let i = this.cannonballs.length - 1; i >= 0; i--) {
      const cb = this.cannonballs[i];
      cb.t += dt / cb.duration;
      if (cb.t >= 1) {
        if (cb.isHit) {
          this.spawnImpactExplosion(cb.end.x, cb.end.y, cb.end.z, 0.95);
          for (let k = 0; k < 14; k++) {
            const isFire = k % 2 === 0;
            this.spawnParticle(
              cb.end.x,
              cb.end.y,
              cb.end.z,
              (Math.random() - 0.5) * 8,
              2.4 + Math.random() * 5.2,
              (Math.random() - 0.5) * 8,
              0.75,
              isFire ? 0.98 : 0.65,
              isFire ? 0.56 : 0.44,
              isFire ? 0.16 : 0.22
            );
          }
          cb.onArrive?.();
        } else {
          for (let k = 0; k < 10; k++) {
            this.spawnParticle(
              cb.end.x,
              0.15,
              cb.end.z,
              (Math.random() - 0.5) * 5.5,
              3.2 + Math.random() * 5.5,
              (Math.random() - 0.5) * 5.5,
              0.85,
              0.86,
              0.93,
              0.98
            );
          }
        }
        this.scene.remove(cb.mesh);
        this.cannonballs.splice(i, 1);
      } else {
        cb.mesh.position.lerpVectors(cb.start, cb.end, cb.t);
        cb.mesh.position.y += Math.sin(cb.t * Math.PI) * cb.arcHeight;
        if (Math.random() < 0.6) {
          this.spawnParticle(
            cb.mesh.position.x,
            cb.mesh.position.y,
            cb.mesh.position.z,
            (Math.random() - 0.5) * 0.6,
            0.35,
            (Math.random() - 0.5) * 0.6,
            0.45,
            0.76,
            0.76,
            0.78
          );
        }
      }
    }
  }

  private updateParticles(dt: number): void {
    for (let i = 0; i < this.MAX_PARTICLES; i++) {
      const p = this.particles[i];
      if (!p.alive) continue;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.alive = false;
        this.particlePositions[i * 3 + 1] = -999;
        continue;
      }
      p.vy -= 5.2 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      this.particlePositions[i * 3] = p.x;
      this.particlePositions[i * 3 + 1] = p.y;
      this.particlePositions[i * 3 + 2] = p.z;
      const fade = 1 - p.life / p.maxLife;
      this.particleColors[i * 3] = p.r * fade;
      this.particleColors[i * 3 + 1] = p.g * fade;
      this.particleColors[i * 3 + 2] = p.b * fade;
    }
    this.particleGeo.attributes.position.needsUpdate = true;
    this.particleGeo.attributes.color.needsUpdate = true;
  }

  private updateCamera(dt: number): void {
    if (this.fps.active) {
      this.fps.syncCameraTransform(this.camera);
      return;
    }

    const boatPos = this.playerShip.root.position;

    if (this.phase === 'title') {
      const angle = 0.55 + Math.sin(this.simTime * 0.12) * 0.35;
      const radius = 21;
      const desiredX = boatPos.x + Math.sin(angle) * radius;
      const desiredY = boatPos.y + 7.2 + Math.sin(this.simTime * 0.35) * 0.6;
      const desiredZ = boatPos.z + Math.cos(angle) * radius;
      this.camera.position.set(desiredX, desiredY, desiredZ);
      this.camera.lookAt(boatPos.x - 4.5, boatPos.y + 3.2, boatPos.z - 6);
      return;
    }

    let targetLookX = boatPos.x;
    let targetLookY = boatPos.y + 2.6 + (this.saveData.player.upgrades.hullTier - 1) * 0.65;
    let targetLookZ = boatPos.z;
    let desiredDist = this.camDist + (this.saveData.player.upgrades.hullTier - 1) * 3.8;

    if (this.combat.active) {
      const enemies = this.getCombatEnemies();
      const primRef = enemies.find((e) => e.id === this.combat.primaryTargetId) ?? enemies[0];
      const targetPos = primRef ? this.getEnemyWorldPos(primRef) : null;
      if (targetPos) {
        targetLookX = boatPos.x * 0.78 + targetPos.x * 0.22;
        targetLookZ = boatPos.z * 0.78 + targetPos.z * 0.22;
        desiredDist += 8;
      }
    }

    const horiz = Math.cos(this.camPitch) * desiredDist;
    const desX = boatPos.x + Math.sin(this.camYaw) * horiz;
    const desY = Math.max(
      sampleWaveHeight(boatPos.x, boatPos.z, this.simTime, this.saveData.weather.waveIntensity) + 2.2,
      boatPos.y + 2.6 + Math.sin(this.camPitch) * desiredDist
    );
    const desZ = boatPos.z + Math.cos(this.camYaw) * horiz;

    const k = 1 - Math.exp(-6.5 * dt);
    this.currentCamPos.x += (desX - this.currentCamPos.x) * k;
    this.currentCamPos.y += (desY - this.currentCamPos.y) * k;
    this.currentCamPos.z += (desZ - this.currentCamPos.z) * k;

    this.currentLookAt.x += (targetLookX - this.currentLookAt.x) * k;
    this.currentLookAt.y += (targetLookY - this.currentLookAt.y) * k;
    this.currentLookAt.z += (targetLookZ - this.currentLookAt.z) * k;

    const shake = this.trauma * this.trauma * 0.55;
    this.camera.position.set(
      this.currentCamPos.x + (Math.random() - 0.5) * shake,
      this.currentCamPos.y + (Math.random() - 0.5) * shake,
      this.currentCamPos.z + (Math.random() - 0.5) * shake
    );
    this.camera.lookAt(this.currentLookAt);
  }

  public getNearbyFishTarget(): HudSnapshot['nearbyFishTarget'] {
    const px = this.saveData.player.x;
    const pz = this.saveData.player.z;
    let best: HudSnapshot['nearbyFishTarget'] = null;
    let bestDist = Infinity;

    for (const entry of this.monsters.values()) {
      const mon = entry.data;
      if (!mon.defeated || mon.carcassHarvested || (mon.carcassRemainingFood ?? 0) <= 0) continue;
      const d = Math.hypot(mon.x - px, mon.z - pz);
      if (d < 56 && d < bestDist) {
        bestDist = d;
        best = {
          kind: 'monster_carcass',
          id: mon.id,
          label: `${mon.name} Carcass (+${mon.carcassRemainingFood} Food, +${mon.carcassRemainingSalt ?? 0} Salt)`,
          speciesLabel: mon.name,
          food: mon.carcassRemainingFood ?? 0,
          salt: mon.carcassRemainingSalt ?? 0,
          distance: Math.round(d),
          sizeTier: MONSTER_FISH_TIER[mon.size] ?? 5,
          castCost: getFishingCastCost(MONSTER_FISH_TIER[mon.size] ?? 5),
        };
      }
    }

    if (!best) {
      for (const entry of this.wildlife.values()) {
        const wa = entry.data;
        if (wa.domain !== 'ocean' || wa.dead || wa.harvested) continue;
        const d = Math.hypot(wa.x - px, wa.z - pz);
        if (d < 44 && d < bestDist) {
          bestDist = d;
          const spec = WILDLIFE_SPECS[wa.species];
          best = {
            kind: 'sea_wildlife',
            id: wa.id,
            label: `${spec.label} (+${wa.lootFood} Food, +${wa.lootSalt ?? 1} Salt)`,
            speciesLabel: spec.label,
            food: wa.lootFood,
            salt: wa.lootSalt ?? 1,
            distance: Math.round(d),
            sizeTier: WILDLIFE_FISH_TIER[wa.species] ?? 2,
            castCost: getFishingCastCost(WILDLIFE_FISH_TIER[wa.species] ?? 2),
          };
        }
      }
    }

    return best;
  }

  public findNearbyInteractable(): HudSnapshot['nearbyPrompt'] {
    const px = this.saveData.player.x;
    const pz = this.saveData.player.z;
    let best: HudSnapshot['nearbyPrompt'] = null;

    for (const entry of this.wrecks.values()) {
      const d = Math.hypot(entry.data.x - px, entry.data.z - pz);
      if (d < 36 && (!best || d < best.distance)) {
        best = {
          kind: entry.data.isGhostWreck ? 'ghost_wreck' : 'wreck',
          id: entry.data.id,
          label: entry.data.fullyLooted
            ? `Inspect ${entry.data.name} (Explored)`
            : entry.data.isGhostWreck
              ? `Board Ghost Shipwreck: ${entry.data.name}`
              : `Explore ${entry.data.name}`,
          distance: Math.round(d),
        };
      }
    }

    const nearPlayer = this.findNearbyPlayer();
    if (nearPlayer) {
      best = {
        kind: 'player',
        id: nearPlayer.id,
        label: `Hail Captain of ${nearPlayer.name} — trade or attack`,
        distance: nearPlayer.distance,
      };
    }

    for (const entry of this.merchants.values()) {
      if (entry.data.sunk) continue;
      const d = Math.hypot(entry.data.x - px, entry.data.z - pz);
      if (d < 46 && (!best || d < best.distance)) {
        best = {
          kind: 'merchant',
          id: entry.data.id,
          label: `Hail ${entry.data.name}`,
          distance: Math.round(d),
        };
      }
    }

    for (const entry of this.crates.values()) {
      const d = Math.hypot(entry.data.x - px, entry.data.z - pz);
      if (d < 28 && (!best || d < best.distance)) {
        best = {
          kind: 'crate',
          id: entry.data.id,
          label: entry.data.kind === 'raft' ? 'Rescue Survivor Raft' : 'Salvage Floating Supplies',
          distance: Math.round(d),
        };
      }
    }

    for (const entry of this.monsters.values()) {
      const mon = entry.data;
      const d = Math.hypot(mon.x - px, mon.z - pz);
      if (mon.defeated && !mon.carcassHarvested && (mon.carcassRemainingFood ?? 0) > 0) {
        // Carcasses are fished with [F], not [E].
        continue;
      }
      if (mon.defeated || mon.tamed) continue;
      if (d < 52 && (!best || d < best.distance)) {
        best = {
          kind: 'monster',
          id: mon.id,
          label: `Inspect ${mon.name}`,
          distance: Math.round(d),
        };
      }
    }

    for (const _entry of this.wildlife.values()) {
      // Sea creatures are fished with [F], not [E] (see getNearbyFishTarget).
    }

    for (const entry of this.pirates.values()) {
      if (entry.data.defeated) continue;
      const d = Math.hypot(entry.data.x - px, entry.data.z - pz);
      if (d < 48 && (!best || d < best.distance)) {
        best = {
          kind: 'pirate_hail',
          id: entry.data.id,
          label: `Parley / Engage ${entry.data.name}`,
          distance: Math.round(d),
        };
      }
    }

    for (const isl of this.islands.values()) {
      const data = isl.data;
      const dDock = Math.hypot(data.dockX - px, data.dockZ - pz);
      const dCenter = Math.hypot(data.x - px, data.z - pz);
      if (data.settlement) {
        const dSettle = Math.hypot(data.settlement.dockX - px, data.settlement.dockZ - pz);
        if (dSettle < 14 && (!best || dSettle < best.distance)) {
          best = {
            kind: 'settlement',
            id: data.settlement.id,
            label: `Dock at ${data.settlement.name} (${data.name})`,
            distance: Math.round(dSettle),
          };
          continue;
        }
      }
      const shoreDist = Math.max(0, Math.round(dCenter - data.radius));
      if ((dDock < 42 || dCenter < data.radius + 24) && (!best || shoreDist < best.distance)) {
        best = {
          kind: 'island',
          id: data.id,
          label: `Land Ashore on ${data.name}`,
          distance: shoreDist,
        };
      }
    }

    return best;
  }


  private spawnPirateInstance(pir: PirateShipData): void {
    const built = buildNpcShip(
      pir.hullArchetype,
      'pirate',
      this.textures,
      pir.factionId,
      Math.min(14, pir.cannons),
      Boolean(pir.isGhost),
      pir.ghostSize
    );
    built.root.position.set(pir.x, 0, pir.z);
    built.root.rotation.y = pir.heading;
    this.scene.add(built.root);
    this.pirates.set(pir.id, {
      data: pir,
      mesh: built.root,
      sails: built.sails,
      flagMesh: built.flagMesh,
      ghostFog: built.ghostFog,
      fadeMaterials: built.fadeMaterials,
      cannonGroups: built.cannonGroups,
      damagePatches: built.damagePatches,
      crewActors: built.crewActors,
      halfLength: built.halfLength,
      halfBeam: built.halfBeam,
      cannonRecoil: 0,
      impactRoll: 0,
      impactPitch: 0,
      smokeAccum: 0,
    });
  }

  private spawnMerchantInstance(m: MerchantShipData): void {
    const built = buildNpcShip(
      m.vesselClass,
      m.isCrown ? 'crown' : 'merchant',
      this.textures,
      undefined,
      m.cannons
    );
    built.root.position.set(m.x, 0, m.z);
    built.root.rotation.y = m.heading;
    this.scene.add(built.root);
    this.merchants.set(m.id, {
      data: m,
      mesh: built.root,
      sails: built.sails,
      flagMesh: built.flagMesh,
      cannonGroups: built.cannonGroups,
      damagePatches: built.damagePatches,
      crewActors: built.crewActors,
      halfLength: built.halfLength,
      halfBeam: built.halfBeam,
      impactRoll: 0,
      cannonRecoil: 0,
    });
  }

  private updateBountySystem(dt: number): void {
    const b = this.saveData.bounty;
    if (b) {
      if (b.status === 'offered' && this.saveData.day >= b.expiresAtDay) {
        this.saveData.bounty = null;
        this.emitHud();
      }
      return;
    }
    this.bountyOfferTimer -= dt;
    if (this.bountyOfferTimer <= 0 && !this.modalOpen && !this.combat.active) {
      this.bountyOfferTimer = 95 + this.rand() * 55;
      this.projectBountyOffer(false);
    }
  }

  public projectBountyOffer(force = false): { ok: boolean; message: string } {
    if (this.saveData.bounty?.status === 'active' && !force) {
      return { ok: false, message: 'A bounty hunt is already underway.' };
    }
    const id = `bty_${++this.bountySeq}_${Math.floor(this.simTime)}`;
    const { contract } = createBountyContract(
      id,
      this.saveData.reputation,
      this.saveData.player.upgrades.hullTier,
      this.saveData.day,
      this.rand
    );
    this.saveData.bounty = contract;
    this.sound.playAlertBell();
    this.pushNotification(
      `${contract.issuerLabel}: ${contract.targetName} (${contract.rewardGold}g) — Press B or Accept!`
    );
    this.emitHud();
    return { ok: true, message: `Projected ${contract.tierLabel}: ${contract.targetName} (${contract.rewardGold}g).` };
  }

  public acceptBounty(): void {
    const b = this.saveData.bounty;
    if (!b || b.status !== 'offered') return;
    b.status = 'active';

    const p = this.saveData.player;
    const baseAng = p.heading + (this.rand() - 0.5) * 0.9;
    const spawnDist = 370 + this.rand() * 90;
    const tx = p.x - Math.sin(baseAng) * spawnDist;
    const tz = p.z - Math.cos(baseAng) * spawnDist;

    const specTier = b.tier;
    const pirateTier =
      specTier === 'petty'
        ? 'sloop'
        : specTier === 'dangerous'
          ? 'brigantine'
          : specTier === 'notorious'
            ? 'galleon'
            : 'dreadnought';
    const crownClass =
      specTier === 'petty'
        ? 'crown_sloop'
        : specTier === 'dangerous'
          ? 'crown_corvette'
          : specTier === 'notorious'
            ? 'crown_frigate'
            : 'crown_ship_of_line';

    if (b.targetKind === 'pirate') {
      const pir = generatePirateShip(b.targetShipId, tx, tz, pirateTier, this.rand, {
        customName: b.targetName,
        customCaptain: b.targetCaptain,
        shipClassLabel: b.targetShipClass,
        isBoss: specTier === 'legendary',
      });
      pir.maxHull = b.maxHull;
      pir.hull = b.maxHull;
      pir.gold = Math.max(pir.gold, Math.round(b.rewardGold * 0.45));
      pir.isBountyTarget = true;
      pir.bountyId = b.id;
      pir.discovered = true;
      pir.behavior = 'patrol';
      pir.patrolCenterX = tx;
      pir.patrolCenterZ = tz;
      this.spawnPirateInstance(pir);
    } else {
      const ves = generateMerchantShip(b.targetShipId, tx, tz, crownClass, this.rand);
      ves.name = b.targetName;
      ves.captainName = b.targetCaptain;
      ves.classLabel = b.targetShipClass;
      ves.maxHull = b.maxHull;
      ves.hull = b.maxHull;
      ves.canTrade = false;
      ves.isBountyTarget = true;
      ves.bountyId = b.id;
      ves.discovered = true;
      this.spawnMerchantInstance(ves);
    }

    const rivalCount = specTier === 'notorious' || specTier === 'legendary' ? 3 : 2;
    const rivalIds: string[] = [];
    const rivalNames: string[] = [];
    const hunterTitles = [
      'Bounty Brig Hound',
      'Sovereign Tracker',
      'Corsair Hunter Kestrel',
      'Admiralty Hound',
    ];
    for (let i = 0; i < rivalCount; i++) {
      const hAng = baseAng + (i - (rivalCount - 1) * 0.5) * 0.72 + Math.PI * 0.12;
      const hDist = 230 + i * 55 + this.rand() * 40;
      const hx = p.x - Math.sin(hAng) * hDist;
      const hz = p.z - Math.cos(hAng) * hDist;
      const hid = `bounty_hunter_${b.id}_${i}`;
      const hName = `${hunterTitles[i % hunterTitles.length]} #${i + 1}`;
      rivalIds.push(hid);
      rivalNames.push(hName);

      if (b.targetKind === 'pirate' && i === 0) {
        const hunterVes = generateMerchantShip(hid, hx, hz, 'crown_corvette', this.rand);
        hunterVes.name = hName;
        hunterVes.canTrade = false;
        hunterVes.huntingBountyId = b.id;
        hunterVes.discovered = true;
        hunterVes.heading = Math.atan2(-(tx - hx), -(tz - hz));
        this.spawnMerchantInstance(hunterVes);
      } else {
        const hunterPir = generatePirateShip(
          hid,
          hx,
          hz,
          specTier === 'legendary' || specTier === 'notorious' ? 'brigantine' : 'sloop',
          this.rand,
          { customName: hName, shipClassLabel: 'Bounty Hunter' }
        );
        hunterPir.huntingBountyId = b.id;
        hunterPir.discovered = true;
        hunterPir.heading = Math.atan2(-(tx - hx), -(tz - hz));
        hunterPir.behavior = 'hunt_npc';
        this.spawnPirateInstance(hunterPir);
      }
    }
    b.rivalHunterIds = rivalIds;
    b.rivalHunterNames = rivalNames;

    this.sound.playShipBell();
    this.addLog(
      `Accepted Bounty: ${b.targetName}`,
      `Tracking ${b.targetName} (${b.targetShipClass}) for ${b.rewardGold}g. ${rivalNames.length} rival bounty hunters are converging on the target!`
    );
    this.pushNotification(`Bounty Active: Track ${b.targetName} (${b.rewardGold}g) — ${rivalNames.length} rival hunters racing you!`);
    this.flushImmediateSave();
    this.emitHud();
  }

  public declineBounty(): void {
    if (!this.saveData.bounty || this.saveData.bounty.status !== 'offered') return;
    this.saveData.bounty = null;
    this.bountyOfferTimer = 85;
    this.pushNotification('Bounty notice declined.');
    this.emitHud();
  }

  private getActiveBountyTargetPos():
    | { kind: 'pirate'; id: string; x: number; z: number }
    | { kind: 'merchant'; id: string; x: number; z: number }
    | null {
    const b = this.saveData.bounty;
    if (!b || b.status !== 'active') return null;
    if (b.targetKind === 'pirate') {
      const pEntry = this.pirates.get(b.targetShipId);
      if (pEntry && !pEntry.data.defeated) {
        return { kind: 'pirate', id: pEntry.data.id, x: pEntry.data.x, z: pEntry.data.z };
      }
    } else {
      const mEntry = this.merchants.get(b.targetShipId);
      if (mEntry && !mEntry.data.sunk) {
        return { kind: 'merchant', id: mEntry.data.id, x: mEntry.data.x, z: mEntry.data.z };
      }
    }
    return null;
  }

  private fireHunterAtBountyTarget(
    hunterName: string,
    hx: number,
    hz: number,
    cannons: number,
    dmgPerGun: number,
    target: { kind: 'pirate' | 'merchant'; id: string; x: number; z: number }
  ): void {
    const px = this.saveData.player.x;
    const pz = this.saveData.player.z;
    if (target.kind === 'pirate') {
      const tEntry = this.pirates.get(target.id);
      const foe = tEntry?.data;
      if (!foe || foe.defeated) return;
      const vol = resolveNpcVsNpcVolley(cannons, dmgPerGun, foe.hull, this.rand);
      foe.hull = vol.nextHull;
      this.spawnNpcBroadside(
        hx,
        hz,
        foe.x,
        foe.z,
        vol.hits > 0,
        vol.hits > 0 && tEntry
          ? () => {
              if (!foe.defeated) {
                this.attachBattleDamageMark({
                  targetKind: 'pirate',
                  shipId: foe.id,
                  root: tEntry.mesh,
                  shipX: foe.x,
                  shipZ: foe.z,
                  heading: foe.heading,
                  halfLength: tEntry.halfLength,
                  halfBeam: tEntry.halfBeam,
                  attackerX: hx,
                  attackerZ: hz,
                  section: 'hull',
                  kind: 'cannon',
                  damage: vol.damage,
                });
              }
            }
          : undefined
      );
      if (vol.hits > 0 && tEntry) tEntry.impactRoll += 0.12;
      if (vol.sunk) {
        foe.defeated = true;
        foe.looted = true;
        foe.behavior = 'defeated';
        foe.sinkProgress = 0;
        foe.salvageable = rollEnemySalvageable(false, this.rand);
        if (!foe.salvageable && Math.hypot(foe.x - px, foe.z - pz) < 420) {
          this.spawnShipExplosion(foe.x, foe.z, 1.15);
        }
        this.spawnSunkenShipwreckForVessel({ kind: 'pirate', ship: foe }, true, 2.5);
        if (foe.bountyId) {
          this.handleBountyTargetKilled(foe.bountyId, false, hunterName);
        }
      }
    } else {
      const mEntry = this.merchants.get(target.id);
      const ves = mEntry?.data;
      if (!ves || ves.sunk) return;
      const vol = resolveNpcVsNpcVolley(cannons, dmgPerGun, ves.hull, this.rand);
      ves.hull = vol.nextHull;
      this.spawnNpcBroadside(
        hx,
        hz,
        ves.x,
        ves.z,
        vol.hits > 0,
        vol.hits > 0 && mEntry
          ? () => {
              if (!ves.sunk) {
                this.attachBattleDamageMark({
                  targetKind: 'merchant',
                  shipId: ves.id,
                  root: mEntry.mesh,
                  shipX: ves.x,
                  shipZ: ves.z,
                  heading: ves.heading,
                  halfLength: mEntry.halfLength,
                  halfBeam: mEntry.halfBeam,
                  attackerX: hx,
                  attackerZ: hz,
                  section: 'hull',
                  kind: 'cannon',
                  damage: vol.damage,
                });
              }
            }
          : undefined
      );
      if (vol.hits > 0 && mEntry) mEntry.impactRoll += 0.12;
      if (vol.sunk) {
        ves.sunk = true;
        ves.sinkProgress = 0;
        ves.salvageable = rollEnemySalvageable(false, this.rand);
        if (!ves.salvageable && Math.hypot(ves.x - px, ves.z - pz) < 420) {
          this.spawnShipExplosion(ves.x, ves.z, 1.15);
        }
        this.spawnSunkenShipwreckForVessel({ kind: 'merchant', ship: ves }, true, 2.5);
        if (ves.bountyId) {
          this.handleBountyTargetKilled(ves.bountyId, false, hunterName);
        }
      }
    }
  }

  private handleBountyTargetKilled(
    bountyId: string,
    killedByPlayer: boolean,
    rivalKillerName?: string
  ): void {
    const b = this.saveData.bounty;
    if (!b || b.id !== bountyId || b.status !== 'active') return;

    if (killedByPlayer) {
      const res = resolveBountyKillByPlayer(b, this.saveData.player.gold, this.saveData.reputation);
      this.saveData.player.gold = res.gold;
      this.saveData.stats.peakGold = Math.max(this.saveData.stats.peakGold, this.saveData.player.gold);
      this.shiftReputation(b.reputationDelta);
      this.saveData.bounty = null;
      this.sound.playCoinChime();
      this.pushNotification(res.message);
      this.addLog('Bounty Claimed!', res.message);
    } else {
      const res = resolveBountyHunterClaim(b, rivalKillerName || 'A rival hunter', this.saveData.player.gold);
      this.saveData.bounty = null;
      this.sound.playAlertBell();
      this.pushNotification(res.message);
      this.addLog('Bounty Lost to Rival Hunter', res.message);
    }

    // Clear hunting tag on any surviving rival hunters so they resume normal patrol
    for (const mEntry of this.merchants.values()) {
      if (mEntry.data.huntingBountyId === bountyId) {
        delete mEntry.data.huntingBountyId;
      }
    }
    for (const pEntry of this.pirates.values()) {
      if (pEntry.data.huntingBountyId === bountyId) {
        delete pEntry.data.huntingBountyId;
        if (pEntry.data.behavior === 'hunt_npc') pEntry.data.behavior = 'patrol';
      }
    }
    this.flushImmediateSave();
    this.emitHud();
  }

  private emitHud(): void {
    const p = this.saveData.player;
    const perf = computeCrewPerformance(p.crew, p.upgrades);
    const activePirate =
      this.combat.active && this.combat.pirateId
        ? this.pirates.get(this.combat.pirateId)?.data ?? null
        : null;
    const activeMonster =
      this.combat.active && this.combat.monsterId
        ? this.monsters.get(this.combat.monsterId)?.data ?? null
        : null;
    const activeHostileMerchant =
      this.combat.active && this.combat.hostileMerchantId
        ? this.merchants.get(this.combat.hostileMerchantId)?.data ?? null
        : null;

    const activeEnemy: HudSnapshot['activeEnemy'] = activePirate
      ? {
          kind: 'pirate',
          name: activePirate.name,
          subtitle: activePirate.isGhost
            ? `${(activePirate.ghostSize ?? 'medium').toUpperCase()} Ghost Vessel`
            : `${PIRATE_FACTIONS[activePirate.factionId].shortName} • ${activePirate.rankTitle}`,
          hull: activePirate.hull,
          maxHull: activePirate.maxHull,
          crewCount: activePirate.crewCount,
          distance: Math.round(Math.hypot(activePirate.x - p.x, activePirate.z - p.z)),
        }
      : activeMonster
        ? {
            kind: 'monster',
            name: activeMonster.name,
            subtitle: `${activeMonster.size.toUpperCase()} ${activeMonster.species.toUpperCase()}`,
            hull: activeMonster.hp,
            maxHull: activeMonster.maxHp,
            crewCount: 1,
            distance: Math.round(Math.hypot(activeMonster.x - p.x, activeMonster.z - p.z)),
          }
        : activeHostileMerchant
          ? {
              kind: 'merchant',
              name: activeHostileMerchant.name,
              subtitle: activeHostileMerchant.isCrown ? 'Crown Navy' : 'Armed Vessel',
              hull: activeHostileMerchant.hull,
              maxHull: activeHostileMerchant.maxHull,
              crewCount: activeHostileMerchant.crewCount,
              distance: Math.round(Math.hypot(activeHostileMerchant.x - p.x, activeHostileMerchant.z - p.z)),
            }
          : null;

    const { foodDays, waterDays, saltDays } = computeSupplyDaysRemaining(
      p.inventory,
      p.crew.length,
      this.saveData.weather
    );
    const supplyWarnings: string[] = [];
    if (p.inventory.food <= 0 && !this.saveData.dismissedWarnings.includes('food_empty')) {
      supplyWarnings.push('food_empty');
    } else if (foodDays < 1.5 && p.inventory.food > 0 && !this.saveData.dismissedWarnings.includes('food_low')) {
      supplyWarnings.push('food_low');
    }
    if (p.inventory.water <= 0 && !this.saveData.dismissedWarnings.includes('water_empty')) {
      supplyWarnings.push('water_empty');
    } else if (waterDays < 1.5 && p.inventory.water > 0 && !this.saveData.dismissedWarnings.includes('water_low')) {
      supplyWarnings.push('water_low');
    }
    if ((p.inventory.salt || 0) <= 0 && !this.saveData.dismissedWarnings.includes('salt_empty')) {
      supplyWarnings.push('salt_empty');
    } else if (saltDays < 1.0 && (p.inventory.salt || 0) > 0 && !this.saveData.dismissedWarnings.includes('salt_low')) {
      supplyWarnings.push('salt_low');
    }

    const headingDeg = ((Math.round((-p.heading * 180) / Math.PI) % 360) + 360) % 360;
    const livingFleetCount = this.saveData.fleet.filter((f) => !f.sunk).length;
    const tornadoNearby =
      this.tornadoPos.active && Math.hypot(this.tornadoPos.x - p.x, this.tornadoPos.z - p.z) < 260;

    const activeEnemies: ActiveEnemyStatus[] = [];
    if (this.combat.active) {
      for (const ref of this.getCombatEnemies()) {
        if (ref.kind === 'pirate') {
          const pir = this.pirates.get(ref.id)?.data;
          if (!pir || pir.defeated) continue;
          activeEnemies.push({
            kind: 'pirate',
            id: pir.id,
            name: pir.name,
            subtitle: pir.isGhost
              ? `${(pir.ghostSize ?? 'medium').toUpperCase()} Ghost`
              : `${PIRATE_FACTIONS[pir.factionId].shortName} · ${pir.rankTitle}`,
            hull: pir.hull,
            maxHull: pir.maxHull,
            crewCount: pir.crewCount,
            distance: Math.round(Math.hypot(pir.x - p.x, pir.z - p.z)),
            behaviorLabel: pir.behavior === 'ram' ? 'RAMMING' : pir.behavior === 'retreat' ? 'RETREATING' : pir.behavior === 'flank' ? 'FLANKING' : 'BROADSIDE',
            intelligenceLabel: (pir.aiIntelligence ?? 'tactical').toUpperCase(),
            isPrimary: ref.id === this.combat.primaryTargetId,
          });
        } else if (ref.kind === 'monster') {
          const mon = this.monsters.get(ref.id)?.data;
          if (!mon || mon.defeated || mon.tamed) continue;
          activeEnemies.push({
            kind: 'monster',
            id: mon.id,
            name: mon.name,
            subtitle: `${mon.size.toUpperCase()} ${mon.species.toUpperCase()}`,
            hull: mon.hp,
            maxHull: mon.maxHp,
            crewCount: 1,
            distance: Math.round(Math.hypot(mon.x - p.x, mon.z - p.z)),
            isPrimary: ref.id === this.combat.primaryTargetId,
          });
        } else {
          const m = this.merchants.get(ref.id)?.data;
          if (!m || m.sunk) continue;
          activeEnemies.push({
            kind: 'merchant',
            id: m.id,
            name: m.name,
            subtitle: m.isCrown ? 'Crown Navy' : m.cannons <= 0 ? 'Unarmed Vessel' : 'Armed Vessel',
            hull: m.hull,
            maxHull: m.maxHull,
            crewCount: m.crewCount,
            distance: Math.round(Math.hypot(m.x - p.x, m.z - p.z)),
            isPrimary: ref.id === this.combat.primaryTargetId,
          });
        }
      }
    }

    const assistNames: string[] = [];
    for (const allyId of this.assistingAllies) {
      const pirAlly = this.pirates.get(allyId)?.data;
      if (pirAlly && !pirAlly.defeated) {
        assistNames.push(pirAlly.name);
        continue;
      }
      const mAlly = this.merchants.get(allyId)?.data;
      if (mAlly && !mAlly.sunk) assistNames.push(mAlly.name);
    }

    const vpW = this.container.clientWidth || window.innerWidth;
    const vpH = Math.max(1, this.container.clientHeight || window.innerHeight);
    const floatingDamages: WorldFloatingDamage[] = [];
    for (const wp of this.worldDamagePopups) {
      this._projVec.set(wp.worldX, wp.worldY, wp.worldZ).project(this.camera);
      if (this._projVec.z >= -1 && this._projVec.z <= 1) {
        const sx = (this._projVec.x * 0.5 + 0.5) * vpW;
        const sy = (-this._projVec.y * 0.5 + 0.5) * vpH;
        if (sx >= -80 && sx <= vpW + 80 && sy >= -60 && sy <= vpH + 60) {
          floatingDamages.push({
            id: wp.id,
            screenX: Math.round(sx),
            screenY: Math.round(sy),
            amount: wp.amount,
            partLabel: wp.partLabel,
            targetName: wp.targetName,
            source: wp.source,
            direction: wp.direction,
            critical: wp.critical,
            opacity: clamp(wp.life / (wp.maxLife * 0.55), 0, 1),
          });
        }
      }
    }

    const fishermanCount = p.crew.filter((c) => c.role === 'fisherman').length;
    const fpsGuards =
      this.fps.active && this.fps.island
        ? Array.from(this.islandPirateGuards.values())
            .map((e) => e.data)
            .filter((g) => g.islandId === this.fps.island?.id)
        : [];
    const fpsPrompt =
      this.fps.active && this.fps.island
        ? this.fps.findPromptCandidate(
            this.saveData,
            { x: p.x, z: p.z },
            Array.from(this.wildlife.values()).map((w) => w.data),
            fpsGuards
          )
        : null;

    this.callbacks.onHudUpdate({
      phase: this.phase,
      shipName: p.shipName || DEFAULT_PLAYER_SHIP_NAME,
      day: this.saveData.day,
      timeOfDay: this.saveData.timeOfDay,
      timeStr: formatTimeOfDay(this.saveData.timeOfDay),
      dayPhaseLabel: getDayPhaseLabel(this.saveData.timeOfDay),
      biome: this.currentBiome,
      biomeLabel: getBiomeConfig(this.currentBiome).label,
      weather: { ...this.saveData.weather },
      weatherForecast: [...this.saveData.weatherForecast],
      steeringHexActive: this.steeringHexTimer > 0,
      speedKnots: Math.round(Math.abs(p.speed) * 1.85),
      headingDeg,
      throttle: p.throttle,
      isStopping: p.isStopping,
      x: Math.round(p.x),
      z: Math.round(p.z),
      gold: Math.round(p.gold),
      reputation: this.saveData.reputation,
      reputationTitle: getReputationTitle(this.saveData.reputation),
      cargoUsed: Math.round(getCargoWeight(p.inventory)),
      cargoCapacity: getCargoCapacity(p.upgrades),
      crewCount: p.crew.length,
      maxCrew: getMaxCrewCapacity(p.upgrades),
      avgMorale: perf.avgMorale,
      food: Math.floor(p.inventory.food),
      water: Math.floor(p.inventory.water),
      salt: Math.floor(p.inventory.salt || 0),
      foodDaysRemaining: foodDays,
      waterDaysRemaining: waterDays,
      saltDaysRemaining: saltDays,
      fishermanCount,
      fishingGear: p.upgrades.fishingGear ?? 'none',
      treasureMapsCount: (this.saveData.treasureMaps ?? []).filter((m) => !m.found).length,
      treasureFragments: this.saveData.treasureFragments ?? 0,
      supplyWarnings,
      crewHealthWarnings: getLowHealthWarnings(p.crew),
      fleetDistress: [...this.fleetDistressAlerts],
      condition: { ...p.condition },
      upgrades: { ...p.upgrades },
      activeRepairJob: this.saveData.activeRepairJob ? { ...this.saveData.activeRepairJob } : null,
      nearbyPrompt: this.fps.active ? null : this.findNearbyInteractable(),
      nearbyFishTarget: this.fps.active ? null : this.getNearbyFishTarget(),
      combat: { ...this.combat, enemies: [...(this.combat.enemies ?? [])], combatLog: [...this.combat.combatLog] },
      activePirate: activePirate ? { ...activePirate } : null,
      activeMonster: activeMonster ? { ...activeMonster } : null,
      activeEnemy,
      activeEnemies,
      assistingAllies: assistNames,
      tamedMonstersCount: this.saveData.tamedMonsters.length,
      fleetCount: livingFleetCount,
      fleetUnlocked: getFleetUnlockStatus(p.upgrades, p.crew.length, p.gold).unlocked,
      nearbyGhostWarning: this.nearbyGhostActive,
      nearbyMajorBattle: this.nearbyMajorBattleActive ? 'Major Fleet Battle' : null,
      activeTornadoWarning: tornadoNearby,
      notification: this.notificationText,
      damageBanner: null,
      damageNotifications: this.damageNotifications.map((n) => ({ ...n })),
      floatingDamages,
      firstPerson: this.fps.active && this.fps.island
        ? {
            active: true,
            islandId: this.fps.island.id,
            islandName: this.fps.island.name,
            islandArchetype: this.fps.island.archetype,
            playerHp: Math.round(this.fps.playerHp),
            maxPlayerHp: this.fps.maxPlayerHp,
            stamina: Math.round(this.fps.stamina),
            inWater: this.fps.inWater,
            insideCave: this.fps.insideCave,
            pointerLocked: this.fps.pointerLocked,
            weapons: { ...this.fps.weapons },
            gunpowder: Math.floor(p.inventory.gunpowder || 0),
            leadShot: Math.floor(p.inventory.leadShot || 0),
            promptText: fpsPrompt?.label ?? null,
            promptActionKind: fpsPrompt?.kind ?? null,
            treasureHint: getTreasureHintForIsland(this.saveData.treasureMaps, this.fps.island.id, this.fps.pos.x, this.fps.pos.z),
            statusBanner: this.fps.statusBanner,
          }
        : undefined,
      journalToast: this.journalToastText,
      tutorialToast: this.activeTutorial ? { ...this.activeTutorial } : null,
      bounty: this.computeActiveBountyHud(),
      autosaveTick: this.autosaveTick,
    });
  }

  private computeActiveBountyHud(): BountyHudState | null {
    const b = this.saveData.bounty;
    if (!b || (b.status !== 'offered' && b.status !== 'active')) return null;
    const p = this.saveData.player;
    let tx = p.x;
    let tz = p.z;
    let tHull = b.maxHull;
    let tMaxHull = b.maxHull;
    if (b.status === 'active') {
      if (b.targetKind === 'pirate') {
        const pe = this.pirates.get(b.targetShipId)?.data;
        if (pe && !pe.defeated) {
          tx = pe.x;
          tz = pe.z;
          tHull = pe.hull;
          tMaxHull = pe.maxHull;
        }
      } else {
        const me = this.merchants.get(b.targetShipId)?.data;
        if (me && !me.sunk) {
          tx = me.x;
          tz = me.z;
          tHull = me.hull;
          tMaxHull = me.maxHull;
        }
      }
    }
    let aliveHunters = 0;
    for (const hid of b.rivalHunterIds) {
      const mp = this.merchants.get(hid)?.data;
      if (mp && !mp.sunk) aliveHunters++;
      const pp = this.pirates.get(hid)?.data;
      if (pp && !pp.defeated) aliveHunters++;
    }
    return buildBountyHudState(b, p.x, p.z, p.heading, tx, tz, tHull, tMaxHull, aliveHunters);
  }

  // --- Input & Resize Listeners ---

  private onKeyDown = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement | null;
    const isTyping =
      target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable);

    if (this.phase === 'title') {
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        this.startNewVoyage();
      }
      return;
    }

    if (isTyping) {
      if (e.code === 'Escape') this.callbacks.onHotkeyMenu('pause');
      return;
    }

    if (e.code === 'Tab') {
      e.preventDefault();
      if (this.phase === 'playing') this.callbacks.onHotkeyMenu('ship');
      return;
    }
    if (e.code === 'KeyJ') {
      e.preventDefault();
      if (this.phase === 'playing') this.callbacks.onHotkeyMenu('journal');
      return;
    }
    if (e.code === 'KeyM') {
      e.preventDefault();
      if (this.phase === 'playing') this.callbacks.onHotkeyMenu('map');
      return;
    }
    if (e.code === 'Escape') {
      e.preventDefault();
      this.callbacks.onHotkeyMenu('pause');
      return;
    }
    if (e.code === 'KeyE') {
      e.preventDefault();
      if (this.phase === 'playing' && !this.modalOpen) {
        if (this.fps.active) this.handleFpsInteract();
        else this.callbacks.onHotkeyMenu('interact');
      }
      return;
    }
    if (e.code === 'KeyB') {
      if (this.phase === 'playing' && !this.modalOpen && this.saveData.bounty?.status === 'offered') {
        e.preventDefault();
        this.acceptBounty();
        return;
      }
    }

    if (this.fps.active && this.phase === 'playing' && !this.modalOpen) {
      if (e.code === 'Digit1') {
        this.switchFpsWeapon('cutlass');
        return;
      }
      if (e.code === 'Digit2') {
        this.switchFpsWeapon('pistol');
        return;
      }
      if (e.code === 'Digit3') {
        this.switchFpsWeapon('musket');
        return;
      }
      if (e.code === 'KeyR') {
        this.triggerFpsReload();
        return;
      }
      if (e.code === 'KeyF') {
        this.fps.setBlocking(true);
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        this.keys.add('Space');
        return;
      }
    } else if (e.code === 'KeyF' && this.phase === 'playing' && !this.modalOpen) {
      e.preventDefault();
      this.callbacks.onHotkeyMenu('fishing');
      return;
    } else if (e.code === 'Space' && this.phase === 'playing' && !this.modalOpen) {
      e.preventDefault();
      if (!e.repeat) this.toggleStop();
      return;
    }

    this.keys.add(e.code);
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
    if (this.fps.active && e.code === 'KeyF') {
      this.fps.setBlocking(false);
    }
  };

  private requestFpsPointerLock(): void {
    if (!this.fps.active || this.phase !== 'playing' || this.modalOpen) return;
    const el = this.renderer.domElement;
    if (document.pointerLockElement === el || typeof el.requestPointerLock !== 'function') return;
    try {
      this.fpsMouseState = { lastX: -1, lastY: -1, skipEvents: 2 };
      const maybePromise = el.requestPointerLock() as unknown as Promise<void> | undefined;
      if (maybePromise && typeof maybePromise.catch === 'function') {
        maybePromise.catch(() => {});
      }
    } catch {
      // Ignore sandboxed iframe or headless browser pointer lock rejection
    }
  }

  private onPointerLockChange = () => {
    const locked = document.pointerLockElement === this.renderer.domElement;
    this.fps.pointerLocked = locked;
    this.fpsMouseState = { lastX: -1, lastY: -1, skipEvents: 2 };
    if (this.fps.active) {
      this.emitHud();
    }
  };

  private onPointerLockError = () => {
    this.fps.pointerLocked = false;
    this.fpsMouseState = { lastX: -1, lastY: -1, skipEvents: 1 };
  };

  private onMouseLeave = () => {
    this.fpsMouseState.lastX = -1;
    this.fpsMouseState.lastY = -1;
    this.lastMouseX = -1;
    this.lastMouseY = -1;
  };

  private onContextMenu = (e: MouseEvent) => {
    if (this.phase === 'playing' && !this.modalOpen) {
      e.preventDefault();
    }
  };

  private onBlur = () => {
    this.keys.clear();
    this.isDragging = false;
    this.fps.setBlocking(false);
    this.fpsMouseState = { lastX: -1, lastY: -1, skipEvents: 1 };
  };

  private onMouseDown = (e: MouseEvent) => {
    if (this.phase !== 'playing' || this.modalOpen) return;
    if (this.fps.active) {
      this.sound.unlock();
      // Strictly never rotate FPS camera on mouse button clicks — lock cursor inside viewport cleanly.
      this.isDragging = false;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
      this.fpsMouseState.lastX = e.clientX;
      this.fpsMouseState.lastY = e.clientY;
      if (document.pointerLockElement !== this.renderer.domElement) {
        this.requestFpsPointerLock();
      }
      if (e.button === 0) {
        this.handleFpsPrimaryAction();
      } else if (e.button === 2) {
        this.fps.setBlocking(true);
      }
      return;
    }
    if (e.button === 0 || e.button === 2) {
      this.isDragging = true;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
      this.sound.unlock();
    }
  };

  private onMouseMove = (e: MouseEvent) => {
    if (this.phase !== 'playing' || this.modalOpen) return;
    if (this.fps.active) {
      const locked = document.pointerLockElement === this.renderer.domElement;
      this.fps.pointerLocked = locked;
      const step = stepFpsMouseDelta(this.fpsMouseState, {
        locked,
        clientX: e.clientX,
        clientY: e.clientY,
        movementX: e.movementX,
        movementY: e.movementY,
      });
      this.fpsMouseState = step.nextState;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
      if (step.dx === 0 && step.dy === 0) return;
      const sens = 0.0042 * this.saveData.settings.mouseSensitivity;
      this.fps.yaw -= step.dx * sens;
      const yMult = this.saveData.settings.invertY ? 1 : -1;
      this.fps.pitch = clamp(this.fps.pitch + step.dy * sens * yMult, -1.25, 1.25);
      return;
    }
    if (!this.isDragging) return;
    const dx = e.clientX - this.lastMouseX;
    const dy = e.clientY - this.lastMouseY;
    this.lastMouseX = e.clientX;
    this.lastMouseY = e.clientY;

    const sens = 0.0055 * this.saveData.settings.mouseSensitivity;
    this.camYaw -= dx * sens;
    const yMult = this.saveData.settings.invertY ? -1 : 1;
    this.camPitch = clamp(this.camPitch + dy * sens * yMult, 0.08, 1.12);
  };

  private onMouseUp = (e: MouseEvent) => {
    this.isDragging = false;
    if (this.fps.active && e.button === 2) {
      this.fps.setBlocking(false);
    }
  };

  private onWheel = (e: WheelEvent) => {
    if (this.phase !== 'playing' || this.modalOpen || this.fps.active) return;
    this.camDist = clamp(this.camDist + e.deltaY * 0.015, 13, 46);
  };

  private onResize = () => {
    const w = this.container.clientWidth || window.innerWidth;
    const h = Math.max(1, this.container.clientHeight || window.innerHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.renderer.render(this.scene, this.camera);
  };

  private bindEvents(): void {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    window.addEventListener('resize', this.onResize);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
    document.addEventListener('pointerlockerror', this.onPointerLockError);
    document.documentElement.addEventListener('mouseleave', this.onMouseLeave);
    this.renderer.domElement.addEventListener('mousedown', this.onMouseDown);
    this.renderer.domElement.addEventListener('contextmenu', this.onContextMenu);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mouseup', this.onMouseUp);
    this.renderer.domElement.addEventListener('wheel', this.onWheel, { passive: true });
  }

  public dispose(): void {
    this.disposed = true;
    this.fps.exitIsland();
    for (const remote of this.remotePlayers.values()) {
      this.scene.remove(remote.built.root);
      remote.built.flagTexture.dispose();
      remote.built.sailTexture?.dispose();
      remote.nameTexture.dispose();
      (remote.nameTag.material as THREE.SpriteMaterial).dispose();
    }
    this.remotePlayers.clear();
    this.remoteChunkStreams.clear();
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    window.removeEventListener('resize', this.onResize);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    document.removeEventListener('pointerlockerror', this.onPointerLockError);
    document.documentElement.removeEventListener('mouseleave', this.onMouseLeave);
    this.renderer.domElement.removeEventListener('mousedown', this.onMouseDown);
    this.renderer.domElement.removeEventListener('contextmenu', this.onContextMenu);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mouseup', this.onMouseUp);
    this.renderer.domElement.removeEventListener('wheel', this.onWheel);
    this.sound.dispose();
    this.textures.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}
