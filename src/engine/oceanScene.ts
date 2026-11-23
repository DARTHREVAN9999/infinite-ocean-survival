import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  AdminTeleportTarget,
  CannonUpgrades,
  CombatCommand,
  CombatState,
  CrewAutoAssignMode,
  CrewMember,
  CrewRole,
  CustomFlagConfig,
  DamageNotification,
  DiscoveredMarker,
  FlagDyeId,
  FlagEmblemId,
  FlagPatternId,
  FleetCommand,
  FleetDistressAlert,
  FleetShipClass,
  FleetShipData,
  FloatingCrateData,
  GameSettings,
  GhostSizeTier,
  HudSnapshot,
  Inventory,
  MerchantShipData,
  MusicThemeId,
  PirateFactionId,
  PirateShipData,
  RepairPriority,
  ResourceId,
  SaveData,
  SeaMonsterData,
  ShipwreckData,
  TutorialToast,
  WeaponType,
  WeatherType,
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
  createRepairJob,
  deductCosts,
  DEFAULT_PLAYER_SHIP_NAME,
  executeTrade,
  generateGhostShipWreck,
  generateSunkenVesselWreck,
  getCannonStatUpgradeCost,
  getCargoCapacity,
  getCargoWeight,
  getInstallCannonCost,
  getMaxCannonSlots,
  getMaxCrewCapacity,
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
  shouldMonsterAttackPlayer,
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
  generateGhostShip,
  generatePirateShip,
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
import { createProceduralTextures, ProceduralTextureSet } from './textures';
import {
  animateWavingFlag,
  buildFleetShipMesh,
  buildFloatingCrateMesh,
  buildNpcShip,
  buildPlayerShip,
  buildShipwreckMesh,
  buildTornadoMesh,
  BuiltNpcShip,
  BuiltPlayerShip,
} from './shipBuilder';
import {
  animateSeaMonsterMesh,
  buildSeaMonsterMesh,
  BuiltSeaMonster,
} from './monsterBuilder';
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

  vec3 col = mix(waterBase, uSkyColor, clamp(fresnel * 0.85, 0.06, 0.82));

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

  float totalFoam = clamp(crestFoam * 0.68 + ringFoam + wakeFoam, 0.0, 0.88);
  vec3 foamColor = mix(vec3(0.84, 0.90, 0.95), uSunColor * 0.32 + vec3(0.76), 0.35);
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
}

interface MuzzleFlash {
  mesh: THREE.Mesh;
  life: number;
  maxLife: number;
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

export interface EngineCallbacks {
  onHudUpdate: (snap: HudSnapshot) => void;
  onPirateHail: (pirate: PirateShipData) => void;
  onCrownHail: (crownShip: MerchantShipData) => void;
  onVictoryLoot: (pirate: PirateShipData) => void;
  onMerchantVictory?: (merchant: MerchantShipData) => void;
  onStateChange: (phase: 'title' | 'playing' | 'paused' | 'gameover') => void;
  onSaveUpdate: (save: SaveData) => void;
  onHotkeyMenu: (menu: 'ship' | 'journal' | 'map' | 'pause' | 'interact') => void;
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
  private merchants = new Map<
    string,
    {
      data: MerchantShipData;
      mesh: THREE.Group;
      sails: THREE.Mesh[];
      flagMesh: THREE.Mesh | null;
      cannonGroups: THREE.Group[];
      damagePatches: THREE.Group[];
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
  private adminUnlocked = false;
  private adminEnabled = false;
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
  private currentCamPos = new THREE.Vector3(12, 10, 22);
  private currentLookAt = new THREE.Vector3(0, 2, 0);
  private rand: () => number;

  private readonly _v1 = new THREE.Vector3();
  private readonly _v2 = new THREE.Vector3();
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

    this.wrecks.clear();
    this.sunkenWreckByShipId.clear();
    this.crates.clear();
    this.merchants.clear();
    this.pirates.clear();
    this.monsters.clear();
    this.companionMeshes.clear();
    this.fleetShips.clear();
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
    this.playerCannonRecoil = 0;
    this.playerImpactRoll = 0;
    this.playerImpactPitch = 0;
    this.playerSmokeAccum = 0;
    this.playerSinkingTimer = 0;
    this.playerSinkingCause = '';

    this.saveData = JSON.parse(JSON.stringify(save));
    if (!Array.isArray(this.saveData.seenTutorials)) this.saveData.seenTutorials = [];
    if (!Array.isArray(this.saveData.dismissedWarnings)) this.saveData.dismissedWarnings = [];
    if (!Array.isArray(this.saveData.defeatedMonsterIds)) this.saveData.defeatedMonsterIds = [];
    if (!Array.isArray(this.saveData.tamedMonsters)) this.saveData.tamedMonsters = [];
    if (!Array.isArray(this.saveData.fleet)) this.saveData.fleet = [];
    if (!Array.isArray(this.saveData.ghostCollectibles)) this.saveData.ghostCollectibles = [];
    if (!this.saveData.searchedWreckSections) this.saveData.searchedWreckSections = {};
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

  public rebuildPlayerShipMesh(): void {
    if (this.playerShip) {
      this.scene.remove(this.playerShip.root);
      this.playerShip.flagTexture.dispose();
      this.playerShip.sailTexture?.dispose();
    }
    this.playerShip = buildPlayerShip(
      this.saveData.player.upgrades,
      this.saveData.player.crew,
      this.saveData.customFlag,
      this.textures
    );
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

  private streamWorldAroundPlayer(): void {
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
            this.saveData.searchedWreckSections
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

    const px = this.saveData.player.x;
    const pz = this.saveData.player.z;

    for (const [id, entry] of this.wrecks) {
      const isDynamic = id.startsWith('sunk_wreck_') || id.startsWith('ghost_wreck_');
      const pruneDist = isDynamic && !entry.data.fullyLooted ? 2200 : 960;
      if (Math.hypot(entry.data.x - px, entry.data.z - pz) > pruneDist) {
        this.scene.remove(entry.mesh);
        this.wrecks.delete(id);
        if (entry.data.spawnedFromShipId) {
          this.sunkenWreckByShipId.delete(entry.data.spawnedFromShipId);
        }
      }
    }
    for (const [id, entry] of this.crates) {
      if (Math.hypot(entry.data.x - px, entry.data.z - pz) > 960) {
        this.scene.remove(entry.mesh);
        this.crates.delete(id);
      }
    }
    for (const [id, entry] of this.merchants) {
      if (
        id !== this.combat.hostileMerchantId &&
        Math.hypot(entry.data.x - px, entry.data.z - pz) > 1060
      ) {
        this.scene.remove(entry.mesh);
        this.merchants.delete(id);
      }
    }
    for (const [id, entry] of this.pirates) {
      if (id !== this.combat.pirateId && Math.hypot(entry.data.x - px, entry.data.z - pz) > 1060) {
        this.scene.remove(entry.mesh);
        this.pirates.delete(id);
        this.hunterIds.delete(id);
      }
    }
    for (const [id, entry] of this.monsters) {
      if (id !== this.combat.monsterId && Math.hypot(entry.data.x - px, entry.data.z - pz) > 1060) {
        this.scene.remove(entry.built.root);
        this.monsters.delete(id);
      }
    }
    for (const k of Array.from(this.loadedChunks)) {
      if (!keep.has(k)) this.loadedChunks.delete(k);
    }
  }

  public setPhase(phase: 'title' | 'playing' | 'paused' | 'gameover'): void {
    this.phase = phase;
    document.body.dataset.state = phase;
    if (phase === 'playing') {
      this.sound.unlock();
      this.keys.clear();
      this.isDragging = false;
      this.camYaw = this.saveData.player.heading;
      this.camPitch = 0.28;
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
    }
  }

  public startNewVoyage(shipName?: string): void {
    clearVoyageStorage();
    const fresh = createNewVoyage(undefined, shipName);
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
    text: string,
    location: RepairPriority,
    damage: number,
    critical: boolean
  ): void {
    this.damageBanner = {
      id: `dmg_${++this.damageBannerSeq}`,
      text,
      location,
      damage,
      critical,
    };
    this.damageBannerTimer = 4.5;
    this.emitHud();
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

    const stats = computeAutoCombatStats(this.saveData.player.upgrades, this.saveData.player.crew, 'attack');
    this.combat = {
      active: true,
      pirateId: null,
      monsterId: null,
      hostileMerchantId: m.id,
      command: 'attack',
      playerReload: 0.85,
      playerReloadTime: stats.reloadTime,
      retreating: false,
      combatLog: [`Engaging ${m.name} in naval combat!`],
    };
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
    const stats = computeAutoCombatStats(this.saveData.player.upgrades, this.saveData.player.crew, 'attack');
    this.combat = {
      active: true,
      pirateId: null,
      monsterId: entry.data.id,
      hostileMerchantId: null,
      command: 'attack',
      playerReload: 0.8,
      playerReloadTime: stats.reloadTime,
      retreating: false,
      combatLog: [`Engaging sea beast: ${entry.data.name}!`],
    };
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

  // --- Automatic Naval Combat ---

  public startNavalBattle(pirate: PirateShipData): void {
    if (this.combat.active || pirate.defeated) return;
    const stats = computeAutoCombatStats(this.saveData.player.upgrades, this.saveData.player.crew, 'attack');
    this.combat = {
      active: true,
      pirateId: pirate.id,
      monsterId: null,
      hostileMerchantId: null,
      command: 'attack',
      playerReload: 0.75,
      playerReloadTime: stats.reloadTime,
      retreating: false,
      combatLog: [`Engaging ${pirate.name} (${PIRATE_FACTIONS[pirate.factionId].shortName}).`],
    };
    this.sound.playShipBell();
    this.pushNotification(`Battle joined! Engaging ${pirate.name}!`);
    this.triggerTutorial(
      'first_combat',
      'Naval Combat',
      'Steer manually with WASD while your gunners fire automatically. Sail past 265m to break off or use Surrender below.'
    );
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
    const stats = computeAutoCombatStats(
      this.saveData.player.upgrades,
      this.saveData.player.crew,
      this.combat.command
    );

    // 1. Pirate target
    if (this.combat.pirateId) {
      const entry = this.pirates.get(this.combat.pirateId);
      if (!entry || entry.data.defeated) return;
      const pirate = entry.data;
      const dist = Math.hypot(pirate.x - this.saveData.player.x, pirate.z - this.saveData.player.z);

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

      this.consumeAmmoAndSpawnSalvo(res, stats.reloadTime, pirate.x, entry.mesh.position.y + 1.8, pirate.z);
      pirate.hull = Math.max(0, pirate.hull - res.hullDamage);
      pirate.crewCount = Math.max(0, pirate.crewCount - res.crewCasualties);
      if (res.hits > 0) {
        entry.impactRoll += (Math.random() < 0.5 ? -1 : 1) * 0.16;
        entry.impactPitch += (Math.random() - 0.5) * 0.1;
      }
      if (res.enemyDefeated) {
        this.handlePirateDefeated(pirate);
      }
    }
    // 2. Monster target
    else if (this.combat.monsterId) {
      const mEntry = this.monsters.get(this.combat.monsterId);
      if (!mEntry || mEntry.data.defeated) return;
      const mon = mEntry.data;
      const dist = Math.hypot(mon.x - this.saveData.player.x, mon.z - this.saveData.player.z);

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
      }
      if (mon.hp <= 0) {
        this.handleMonsterDefeated(mon);
      }
    }
    // 3. Hostile merchant / Crown vessel target
    else if (this.combat.hostileMerchantId) {
      const vEntry = this.merchants.get(this.combat.hostileMerchantId);
      if (!vEntry || vEntry.data.sunk) return;
      const ves = vEntry.data;
      const dist = Math.hypot(ves.x - this.saveData.player.x, ves.z - this.saveData.player.z);

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

      this.consumeAmmoAndSpawnSalvo(res, stats.reloadTime, ves.x, vEntry.mesh.position.y + 1.8, ves.z);
      ves.hull = Math.max(0, ves.hull - res.hullDamage);
      ves.crewCount = Math.max(0, ves.crewCount - res.crewCasualties);
      if (res.hits > 0) vEntry.impactRoll += 0.16;

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
    targetZ: number
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
      this.launchCannonball(start, end, true, isHit);
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
        entry.data.hailCooldown = 120;
        entry.data.behavior = 'patrol';
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
        mEntry.data.hostileToPlayer = false;
        this.pushNotification(`Ceased fire and paid ${fine} gold restitution.`);
      }
    }
    this.combat.active = false;
    this.combat.pirateId = null;
    this.combat.monsterId = null;
    this.combat.hostileMerchantId = null;
    this.combat.command = 'attack';
    this.combat.retreating = false;
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
    this.combat.active = false;
    this.combat.pirateId = null;
    this.combat.command = 'attack';
    this.combat.retreating = false;

    this.shiftReputation(pirate.isGhost ? 12 : pirate.isBoss ? 14 : 6);
    this.saveData.player.crew.forEach((c) => (c.morale = Math.min(100, c.morale + 14)));
    this.sound.playShipBell();

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
    this.combat.active = false;
    this.combat.monsterId = null;
    this.combat.command = 'attack';
    this.combat.retreating = false;

    const bonusGold = mon.size === 'legendary' ? 420 : mon.size === 'large' ? 180 : 75;
    const bonusLoot: Partial<Inventory> = {
      rareMaterials: mon.size === 'legendary' ? 6 : mon.size === 'large' ? 3 : 1,
      food: mon.size === 'small' ? 8 : 16,
      decorativeMaterials: mon.size === 'legendary' ? 4 : 1,
    };
    this.grantLoot(bonusGold, bonusLoot);
    this.shiftReputation(mon.alignment === 'evil' ? 10 : mon.alignment === 'good' ? -8 : 2);
    this.sound.playSplashHuge();
    this.pushNotification(`Slain ${mon.name}! Harvested +${bonusGold} gold & rare sea materials.`);
    this.addLog(`Slain ${mon.name}`, `Vanquished ${mon.size} ${mon.species} and harvested rare materials.`);
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
    this.combat.active = false;
    this.combat.hostileMerchantId = null;
    this.combat.command = 'attack';
    this.combat.retreating = false;

    this.spawnSunkenShipwreckForVessel({ kind: 'merchant', ship: ves }, true, 3.5);
    this.shiftReputation(-22);
    this.saveData.stats.shipsRobbed++;
    this.sound.playShipBell();
    this.addLog(
      `Sank ${ves.name}`,
      ves.salvageable
        ? `Sank ${ves.name}! Its drifting wreckage can be searched or salvaged (-22 Rep).`
        : `${ves.name} exploded and burned down to a charred wreck with reduced surviving cargo (-22 Rep).`
    );
    this.pushNotification(
      ves.salvageable
        ? `Sank ${ves.name}! Search its wreck with E or recruit hull (-22 Rep).`
        : `Sank ${ves.name}! It exploded — charred wreck holds less loot (-22 Rep).`
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

  private launchCannonball(start: THREE.Vector3, end: THREE.Vector3, fromPlayer: boolean, isHit: boolean): void {
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

    // Gradual 24-hour cycle (Sunrise -> Morning -> Midday -> Sunset -> Night)
    if (activeSim && this.playerSinkingTimer <= 0) {
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
    }

    this.updateAtmosphereVisuals(dt);
    this.updatePlayerPhysics(dt, activeSim && this.playerSinkingTimer <= 0);
    this.updateEntities(dt, activeSim && this.playerSinkingTimer <= 0);
    if (activeSim && this.playerSinkingTimer <= 0) {
      this.updateUnifiedPlayerCombat(dt);
      this.resolveAllCollisions(dt);
    }
    this.updateCannonballs(dt);
    this.updateParticles(dt);
    this.updateCamera(dt);

    if (activeSim) {
      this.survivalAccum += dt;
      if (this.survivalAccum >= 1.0) {
        const step = this.survivalAccum;
        this.survivalAccum = 0;
        this.runSurvivalTick(step);
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

    let targetX: number | null = null;
    let targetZ: number | null = null;
    let targetName = 'Enemy';
    let targetAlive = false;

    if (this.combat.pirateId) {
      const pEntry = this.pirates.get(this.combat.pirateId);
      if (pEntry && !pEntry.data.defeated) {
        targetAlive = true;
        targetX = pEntry.data.x;
        targetZ = pEntry.data.z;
        targetName = pEntry.data.name;
      }
    } else if (this.combat.monsterId) {
      const mEntry = this.monsters.get(this.combat.monsterId);
      if (mEntry && !mEntry.data.defeated && !mEntry.data.tamed) {
        targetAlive = true;
        targetX = mEntry.data.x;
        targetZ = mEntry.data.z;
        targetName = mEntry.data.name;
      }
    } else if (this.combat.hostileMerchantId) {
      const vEntry = this.merchants.get(this.combat.hostileMerchantId);
      if (vEntry && !vEntry.data.sunk) {
        targetAlive = true;
        targetX = vEntry.data.x;
        targetZ = vEntry.data.z;
        targetName = vEntry.data.name;
      }
    }

    if (!targetAlive || targetX === null || targetZ === null) {
      this.combat.active = false;
      this.combat.pirateId = null;
      this.combat.monsterId = null;
      this.combat.hostileMerchantId = null;
      return;
    }

    const dist = Math.hypot(targetX - px, targetZ - pz);
    if (dist > 265) {
      if (this.combat.pirateId) {
        const pir = this.pirates.get(this.combat.pirateId)?.data;
        if (pir) {
          pir.hailCooldown = 55;
          pir.behavior = 'patrol';
        }
      }
      this.combat.active = false;
      this.combat.pirateId = null;
      this.combat.monsterId = null;
      this.combat.hostileMerchantId = null;
      this.combat.command = 'attack';
      this.combat.retreating = false;
      this.pushNotification(`Disengaged from ${targetName} beyond 265m.`);
      return;
    }

    if (
      this.combat.playerReload >= 0.99 &&
      this.combat.command !== 'surrender' &&
      stats.effectiveCannons > 0 &&
      dist <= stats.fireRange
    ) {
      this.triggerPlayerFire();
    }
  }

  private updateWeather(dt: number): void {
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
      this.tornadoPos.x += this.tornadoPos.vx * dt;
      this.tornadoPos.z += this.tornadoPos.vz * dt;
      const distPlayerTorn = Math.hypot(this.tornadoPos.x - this.saveData.player.x, this.tornadoPos.z - this.saveData.player.z);
      if (distPlayerTorn > 260) {
        // Steer tornado gently back toward active sea lane near player
        const ang = Math.atan2(this.saveData.player.z - this.tornadoPos.z, this.saveData.player.x - this.tornadoPos.x);
        this.tornadoPos.vx = Math.cos(ang) * 9;
        this.tornadoPos.vz = Math.sin(ang) * 9;
      }
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

    const deepOcean = new THREE.Color(0x05192b)
      .lerp(new THREE.Color(0x082a44), dayFactor)
      .lerp(new THREE.Color(0x0d1b26), stormDark * 0.6);
    const shallowOcean = new THREE.Color(0x103d59)
      .lerp(new THREE.Color(0x165e79), dayFactor)
      .lerp(new THREE.Color(0x28434f), stormDark * 0.55);

    this.oceanUniforms.uTime.value = this.simTime;
    this.oceanUniforms.uWaveIntensity.value = w.waveIntensity;
    this.oceanUniforms.uRogueBoost.value = this.rogueWaveBoost;
    this.oceanUniforms.uDeepColor.value.copy(deepOcean);
    this.oceanUniforms.uShallowColor.value.copy(shallowOcean);
    this.oceanUniforms.uSkyColor.value.copy(horizon);
    this.oceanUniforms.uHorizonColor.value.copy(this.fog.color);
    this.oceanUniforms.uSunDir.value.copy(activeKeyDir);
    this.oceanUniforms.uSunColor.value.copy(sunY >= -0.05 ? sunCol : new THREE.Color(0xb4d2f4));
    this.oceanUniforms.uFogDensity.value = this.fog.density;

    this.skyMesh.position.set(this.saveData.player.x, 0, this.saveData.player.z);
    this.starsPoints.position.set(this.saveData.player.x, 0, this.saveData.player.z);
    this.cloudsGroup.position.set(this.saveData.player.x, 0, this.saveData.player.z);
    this.cloudsGroup.rotation.y += dt * 0.004 * (w.windSpeed / 12);

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

    if (precipIntensity > 0.02) {
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
      if (this.combat.pirateId) aimTarget = this.pirates.get(this.combat.pirateId)?.data ?? null;
      else if (this.combat.monsterId) aimTarget = this.monsters.get(this.combat.monsterId)?.data ?? null;
      else if (this.combat.hostileMerchantId)
        aimTarget = this.merchants.get(this.combat.hostileMerchantId)?.data ?? null;
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
    if (hullPct < 65) {
      this.playerSmokeAccum += dt;
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

      if (activeSim && !wr.discovered && dist < discoverRange) {
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
      entry.mesh.rotation.y += dt * 0.35;
      entry.mesh.rotation.z = Math.sin(this.simTime * 1.8 + c.x) * 0.18;

      if (activeSim && !c.discovered && Math.hypot(c.x - px, c.z - pz) < discoverRange * 0.85) {
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
    if (this.ghostWhisperCooldown > 0) this.ghostWhisperCooldown -= dt;

    // 3. Civilian, Merchant Convoy & Crown Navy Ships
    for (const [mId, entry] of Array.from(this.merchants.entries())) {
      const m = entry.data;
      animateWavingFlag(entry.flagMesh, this.simTime, w.windSpeed / 12);

      if (activeSim && !m.sunk) {
        if (m.fleeTimer > 0) {
          m.fleeTimer -= dt;
          if (m.fleeTimer <= 0) m.fleeingFromPlayer = false;
        }

        const distPlayer = Math.hypot(m.x - px, m.z - pz);
        const inCombatWithPlayer = this.combat.active && this.combat.hostileMerchantId === m.id;

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

        // Crown warships & battle vessels hunt & fire on nearby pirates!
        let crownTargetPirate: PirateShipData | null = null;
        if (m.isCrown && !inCombatWithPlayer) {
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
                this.spawnNpcBroadside(m.x, m.z, crownTargetPirate.x, crownTargetPirate.z, volley.hits > 0);
                if (volley.sunk) {
                  crownTargetPirate.defeated = true;
                  crownTargetPirate.looted = true;
                  crownTargetPirate.behavior = 'defeated';
                  crownTargetPirate.sinkProgress = 0;
                  crownTargetPirate.salvageable = rollEnemySalvageable(crownTargetPirate.isGhost, this.rand);
                  if (!crownTargetPirate.isGhost && !crownTargetPirate.salvageable && Math.hypot(crownTargetPirate.x - px, crownTargetPirate.z - pz) < 380) {
                    this.spawnShipExplosion(crownTargetPirate.x, crownTargetPirate.z, 1.15);
                  }
                  this.spawnSunkenShipwreckForVessel(
                    { kind: 'pirate', ship: crownTargetPirate },
                    Math.hypot(crownTargetPirate.x - px, crownTargetPirate.z - pz) < discoverRange * 1.6,
                    2.0
                  );
                  this.pushNotification(`Crown Navy sank pirate vessel ${crownTargetPirate.name}!`);
                }
              }
            }
          }
        }

        if (inCombatWithPlayer) {
          const ang = Math.atan2(-(px - m.x), -(pz - m.z));
          targetH = distPlayer < 95 ? normalizeAngle(ang + Math.PI * 0.45) : ang;
          desiredSpd = m.maxSpeed;
          if (distPlayer < 165 && m.cannons > 0) {
            m.reloadTimer -= dt;
            if (m.reloadTimer <= 0) {
              m.reloadTimer = 4.8 + this.rand();
              this.executeMerchantVolley(m, entry, distPlayer);
            }
          }
        } else if (m.fleeingFromPlayer) {
          targetH = Math.atan2(-(m.x - px), -(m.z - pz));
          desiredSpd = m.maxSpeed * 1.1;
        } else if (!crownTargetPirate) {
          for (const pEntry of this.pirates.values()) {
            if (!pEntry.data.defeated && Math.hypot(pEntry.data.x - m.x, pEntry.data.z - m.z) < 120) {
              targetH = Math.atan2(-(m.x - pEntry.data.x), -(m.z - pEntry.data.z));
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
      }
    }

    // 4. Pirates, Faction Wars, Escort Formations & Naval Battles
    const playerVx = -Math.sin(this.saveData.player.heading) * this.saveData.player.speed;
    const playerVz = -Math.cos(this.saveData.player.heading) * this.saveData.player.speed;

    for (const [pirId, entry] of Array.from(this.pirates.entries())) {
      const pir = entry.data;
      const inCombatWithThis = this.combat.active && this.combat.pirateId === pir.id;
      animateWavingFlag(entry.flagMesh, this.simTime, w.windSpeed / 12);

      if (activeSim && !pir.defeated) {
        if (pir.hailCooldown > 0) pir.hailCooldown = Math.max(0, pir.hailCooldown - dt);
        pir.patrolAngle += dt * 0.14;

        const faction = this.saveData.factions[pir.factionId];
        const alliedToPlayer =
          isPlayerPirateAligned(this.saveData.reputation) ||
          (faction ? isPirateAlliedWithPlayer(faction, this.saveData.day) : false);

        let escortAnchor: { x: number; z: number } | null = null;
        if (pir.escortTargetId) {
          const leader = this.pirates.get(pir.escortTargetId)?.data;
          if (leader && !leader.defeated) {
            escortAnchor = { x: leader.x, z: leader.z };
          }
        }

        const prevBehavior = pir.behavior;
        const isHunter = this.hunterIds.has(pir.id);
        const ai = computePirateAI(
          pir,
          px,
          pz,
          this.saveData.player.upgrades.hullTier,
          inCombatWithThis,
          dt,
          playerVx,
          playerVz,
          isHunter,
          alliedToPlayer,
          escortAnchor
        );
        pir.behavior = ai.nextBehavior;

        // NPC-vs-NPC Faction War or Merchant Raiding when not fighting player
        if (!inCombatWithThis && pir.behavior === 'patrol' && !pir.isGhost) {
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
                  const foe = this.pirates.get(npcTarget.id)?.data;
                  if (foe && !foe.defeated) {
                    const vol = resolveNpcVsNpcVolley(pir.cannons, pir.damagePerCannon, foe.hull, this.rand);
                    foe.hull = vol.nextHull;
                    this.spawnNpcBroadside(pir.x, pir.z, foe.x, foe.z, vol.hits > 0);
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
                    }
                  }
                } else {
                  const ves = this.merchants.get(npcTarget.id)?.data;
                  if (ves && !ves.sunk) {
                    const vol = resolveNpcVsNpcVolley(pir.cannons, pir.damagePerCannon, ves.hull, this.rand);
                    ves.hull = vol.nextHull;
                    this.spawnNpcBroadside(pir.x, pir.z, ves.x, ves.z, vol.hits > 0);
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

        const dist = Math.hypot(pir.x - px, pir.z - pz);

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
          if (inCombatWithThis || dist < 195) {
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

        if (!this.combat.active && pir.behavior === 'hailing' && pir.hailCooldown <= 0 && !this.modalOpen) {
          pir.hailCooldown = 14;
          if (pir.isGhost) {
            this.startNavalBattle(pir);
          } else if (pir.tier === 'sloop' && !isHunter && this.rand() < 0.35) {
            this.callbacks.onPirateHail({ ...pir });
          } else {
            this.startNavalBattle(pir);
          }
        }

        if (inCombatWithThis) {
          if (pir.behavior === 'retreat' && dist > 235) {
            this.combat.active = false;
            this.combat.pirateId = null;
            this.combat.command = 'attack';
            this.combat.retreating = false;
            pir.hailCooldown = 65;
            pir.behavior = 'patrol';
            this.pushNotification(`${pir.name} broke off and fled!`);
          } else if (ai.wantsToFire && !pir.defeated) {
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
      }
    }

    // 5. Sea Monsters
    for (const [mId, mEntry] of Array.from(this.monsters.entries())) {
      const mon = mEntry.data;
      const inCombatWithMon = this.combat.active && this.combat.monsterId === mon.id;
      mon.animPhase += dt * (mon.size === 'small' ? 2.8 : 2.1);

      if (activeSim && !mon.defeated) {
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
          const targetH = Math.atan2(-(px - mon.x), -(pz - mon.z));
          const diff = normalizeAngle(targetH - mon.heading);
          mon.heading = normalizeAngle(mon.heading + clamp(diff, -1.2 * dt, 1.2 * dt));
          mon.x += -Math.sin(mon.heading) * mon.speed * dt;
          mon.z += -Math.cos(mon.heading) * mon.speed * dt;

          if (mon.attackCooldown > 0) mon.attackCooldown -= dt;
          if (distPlayer <= mon.attackRange && mon.attackCooldown <= 0) {
            mon.attackCooldown = 4.6 + this.rand() * 1.5;
            this.executeMonsterStrike(mon);
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
        mon.sinkProgress = Math.min(1, mon.sinkProgress + dt * 0.3);
      }

      const wh = sampleWaveHeight(mon.x, mon.z, this.simTime, w.waveIntensity, this.rogueWaveBoost);
      animateSeaMonsterMesh(mEntry.built, mon.animPhase, mon.provokedByPlayer || inCombatWithMon);
      mEntry.built.root.position.set(
        mon.x,
        wh + mEntry.built.baseDepthOffset - mon.sinkProgress * 8,
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
      const offsetAng = this.saveData.player.heading + (idx % 2 === 0 ? 2.1 : -2.1);
      const goalX = px + Math.sin(offsetAng) * 18;
      const goalZ = pz + Math.cos(offsetAng) * 18;
      const dx = goalX - tm.x;
      const dz = goalZ - tm.z;
      const d = Math.hypot(dx, dz) || 1;
      tm.heading = Math.atan2(-dx, -dz);
      tm.x += (dx / d) * Math.min(d, 13 * dt);
      tm.z += (dz / d) * Math.min(d, 13 * dt);

      const wh = sampleWaveHeight(tm.x, tm.z, this.simTime, w.waveIntensity, this.rogueWaveBoost);
      animateSeaMonsterMesh(built, this.simTime * 2.5 + idx, this.combat.active);
      built.root.position.set(tm.x, wh + built.baseDepthOffset, tm.z);
      built.root.rotation.y = tm.heading;
    });

    // 7. Player-Owned Autonomous Fleet Ships (Formation, Combat Assist, Defense & Evolution)
    this.updateFleetShips(dt, activeSim);
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
          if (this.combat.pirateId) targetPirate = this.pirates.get(this.combat.pirateId)?.data ?? null;
          else if (this.combat.monsterId) targetMonster = this.monsters.get(this.combat.monsterId)?.data ?? null;
          else if (this.combat.hostileMerchantId) targetMerchant = this.merchants.get(this.combat.hostileMerchantId)?.data ?? null;
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
          desiredSpd =
            distGoal < 8
              ? Math.max(0, Math.abs(p.speed) * 0.92)
              : distGoal > 45
                ? fs.maxSpeed
                : clamp(distGoal * 0.28 + Math.abs(p.speed) * 0.7, 1.5, fs.maxSpeed);
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
              const vol = resolveNpcVsNpcVolley(fs.cannons, dmgPerGun, targetPirate.hull, this.rand);
              targetPirate.hull = vol.nextHull;
              this.spawnNpcBroadside(fs.x, fs.z, targetPirate.x, targetPirate.z, vol.hits > 0);
              if (vol.sunk) {
                this.handlePirateDefeated(targetPirate);
              } else if (distTarget < targetPirate.fireRange && this.rand() < 0.38) {
                // Enemy returns fire against the attacking fleet vessel
                const ret = resolveNpcVsNpcVolley(targetPirate.cannons, targetPirate.damagePerCannon * 0.65, fs.hull, this.rand);
                fs.hull = ret.nextHull;
                entry.impactRoll += 0.14;
                this.spawnNpcBroadside(targetPirate.x, targetPirate.z, fs.x, fs.z, ret.hits > 0);
              }
            } else if (targetMonster && !targetMonster.defeated) {
              const vol = resolveNpcVsNpcVolley(fs.cannons, dmgPerGun, targetMonster.hp, this.rand);
              targetMonster.hp = vol.nextHull;
              this.spawnNpcBroadside(fs.x, fs.z, targetMonster.x, targetMonster.z, vol.hits > 0);
              if (vol.sunk) this.handleMonsterDefeated(targetMonster);
              else if (distTarget < targetMonster.attackRange * 1.4 && this.rand() < 0.35) {
                fs.hull = Math.max(0, fs.hull - Math.round(targetMonster.damage * 0.85));
                entry.impactRoll += 0.2;
              }
            } else if (targetMerchant && !targetMerchant.sunk) {
              const vol = resolveNpcVsNpcVolley(fs.cannons, dmgPerGun, targetMerchant.hull, this.rand);
              targetMerchant.hull = vol.nextHull;
              this.spawnNpcBroadside(fs.x, fs.z, targetMerchant.x, targetMerchant.z, vol.hits > 0);
              if (vol.sunk) this.handleMerchantSunkByPlayer(targetMerchant);
              else if (targetMerchant.cannons > 0 && this.rand() < 0.32) {
                const ret = resolveNpcVsNpcVolley(targetMerchant.cannons, 10, fs.hull, this.rand);
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

  private spawnNpcBroadside(ax: number, az: number, bx: number, bz: number, isHit: boolean): void {
    const start = new THREE.Vector3(ax, 2.5, az);
    const end = new THREE.Vector3(bx + (Math.random() - 0.5) * 4, isHit ? 2.0 : 0.1, bz + (Math.random() - 0.5) * 4);
    this.launchCannonball(start, end, false, isHit);
    this.spawnMuzzleEffects(start);
  }

  private executeMonsterStrike(mon: SeaMonsterData): void {
    const p = this.saveData.player;
    const armorMit = 1 - computeShipHandling(p.upgrades, p.condition, computeCrewPerformance(p.crew, p.upgrades), this.saveData.weather).damageReduction;
    const dmg = Math.max(3, Math.round(mon.damage * armorMit));
    p.condition.hull = Math.max(0, p.condition.hull - dmg);
    p.condition.deck = Math.max(10, p.condition.deck - Math.round(dmg * 0.5));
    p.condition.flooding = clamp(p.condition.flooding + dmg * 0.25, 0, 100);

    this.sound.playMonsterRoar();
    this.sound.playSplashHuge();
    this.trauma = Math.min(1, this.trauma + 0.55);
    this.playerImpactRoll += (Math.random() < 0.5 ? -1 : 1) * 0.28;
    this.playerImpactPitch += 0.18;

    for (let k = 0; k < 18; k++) {
      this.spawnParticle(
        (p.x + mon.x) * 0.5 + (Math.random() - 0.5) * 4,
        0.5,
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

    this.emitDamageBanner(
      `MONSTER STRIKE — HULL & DECK — ${dmg} DAMAGE (${mon.name})`,
      'hull',
      dmg,
      mon.size === 'large' || mon.size === 'legendary'
    );
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
    this.saveData.player.condition = res.condition;
    if (res.crew.length !== this.saveData.player.crew.length) {
      this.saveData.player.crew = res.crew;
      this.rebuildPlayerShipMesh();
      this.addLog('Crew Lost in Battle', `Lost sailor(s) under fire from ${attackerName}.`);
    } else {
      this.saveData.player.crew = res.crew;
    }

    this.sound.playCannonFire();
    if (res.hits > 0) {
      this.sound.playImpactSplinter();
      this.trauma = Math.min(1, this.trauma + 0.45);
      this.playerImpactRoll += (Math.random() < 0.5 ? -1 : 1) * 0.16;
      this.playerImpactPitch += (Math.random() - 0.5) * 0.1;
      this.emitDamageBanner(res.summary, res.hitLocation, res.damageTaken, res.isCritical);
    }

    const shots = Math.max(2, Math.min(4, cannons));
    for (let i = 0; i < shots; i++) {
      const start = new THREE.Vector3(ax, ay + 2.5, az);
      const isHit = i < res.hits;
      const spread = isHit ? 2.0 : 12.0;
      const end = new THREE.Vector3(
        this.saveData.player.x + (Math.random() - 0.5) * spread,
        isHit ? this.playerShip.root.position.y + 1.8 : 0.1,
        this.saveData.player.z + (Math.random() - 0.5) * spread
      );
      this.launchCannonball(start, end, false, isHit);
      this.spawnMuzzleEffects(start);
    }

    this.combat.combatLog = [res.summary, ...this.combat.combatLog].slice(0, 6);
    this.checkPermadeath(attackerName);
    this.emitHud();
  }

  private resolveAllCollisions(dt: number): void {
    for (const [k, t] of Array.from(this.collisionCooldowns.entries())) {
      if (t - dt <= 0) this.collisionCooldowns.delete(k);
      else this.collisionCooldowns.set(k, t - dt);
    }

    const p = this.saveData.player;
    const pVx = -Math.sin(p.heading) * p.speed;
    const pVz = -Math.cos(p.heading) * p.speed;
    const pRadius = Math.max(this.playerShip.halfBeam * 1.15, this.playerShip.halfLength * 0.52);
    const pMass = 1.0 + (p.upgrades.hullTier - 1) * 0.85;
    const pArmor = Math.max(0.4, 1 - p.upgrades.armorPlating * 0.14);
    const defendMult = 1.0;

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
        pArmor * defendMult,
        wr.x,
        wr.z,
        0,
        0,
        wRadius,
        999,
        1.0
      );
      if (res.collided) {
        p.x += res.pushAx;
        p.z += res.pushAz;
        if (res.impactSpeed > 0.6) p.speed = -Math.abs(p.speed) * 0.3;
        if (res.damageA > 0 && !this.collisionCooldowns.has(wr.id)) {
          this.collisionCooldowns.set(wr.id, 0.7);
          p.condition.hull = Math.max(0, p.condition.hull - res.damageA);
          p.condition.flooding = clamp(p.condition.flooding + res.damageA * 0.25, 0, 100);
          this.sound.playImpactSplinter();
          this.trauma = Math.min(1, this.trauma + 0.38);
          this.playerImpactRoll += (Math.random() < 0.5 ? -1 : 1) * 0.22;
          this.playerImpactPitch += 0.14;
          this.spawnCollisionSplinters((p.x + wr.x) * 0.5, 1.4, (p.z + wr.z) * 0.5);
          this.emitDamageBanner(
            `COLLISION — HULL — ${res.damageA} DAMAGE (${wr.name})`,
            'hull',
            res.damageA,
            res.damageA >= 12
          );
          this.checkPermadeath(wr.name);
        }
      }
    }

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
        pArmor * defendMult,
        m.x,
        m.z,
        mVx,
        mVz,
        mRadius,
        mMass,
        1.0
      );
      if (res.collided) {
        p.x += res.pushAx;
        p.z += res.pushAz;
        m.x += res.pushBx;
        m.z += res.pushBz;
        if (res.impactSpeed > 0.6) p.speed = -Math.abs(p.speed) * 0.25;
        if (res.damageA > 0 && !this.collisionCooldowns.has(m.id)) {
          this.collisionCooldowns.set(m.id, 0.7);
          p.condition.hull = Math.max(0, p.condition.hull - res.damageA);
          p.condition.flooding = clamp(p.condition.flooding + res.damageA * 0.2, 0, 100);
          this.sound.playImpactSplinter();
          this.trauma = Math.min(1, this.trauma + 0.35);
          this.playerImpactRoll += 0.2;
          entry.impactRoll -= 0.2;
          this.spawnCollisionSplinters((p.x + m.x) * 0.5, 1.5, (p.z + m.z) * 0.5);
          this.emitDamageBanner(
            `COLLISION — HULL — ${res.damageA} DAMAGE (${m.name})`,
            'hull',
            res.damageA,
            res.damageA >= 12
          );
          this.checkPermadeath(m.name);
        }
      }
    }

    for (const entry of this.pirates.values()) {
      const pir = entry.data;
      if (pir.defeated) continue;
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
        pArmor * defendMult,
        pir.x,
        pir.z,
        pirVx,
        pirVz,
        pirRadius,
        pirMass,
        1.0
      );
      if (res.collided) {
        p.x += res.pushAx;
        p.z += res.pushAz;
        pir.x += res.pushBx;
        pir.z += res.pushBz;
        if (res.impactSpeed > 0.6) {
          p.speed = -Math.abs(p.speed) * 0.25;
          pir.speed *= 0.35;
        }
        if ((res.damageA > 0 || res.damageB > 0) && !this.collisionCooldowns.has(pir.id)) {
          this.collisionCooldowns.set(pir.id, 0.7);
          p.condition.hull = Math.max(0, p.condition.hull - res.damageA);
          p.condition.flooding = clamp(p.condition.flooding + res.damageA * 0.22, 0, 100);
          pir.hull = Math.max(0, pir.hull - res.damageB);

          this.sound.playImpactSplinter();
          this.trauma = Math.min(1, this.trauma + 0.48);
          this.playerImpactRoll += 0.24;
          this.playerImpactPitch += 0.14;
          entry.impactRoll -= 0.24;
          entry.impactPitch -= 0.12;
          this.spawnCollisionSplinters((p.x + pir.x) * 0.5, 1.6, (p.z + pir.z) * 0.5);

          this.emitDamageBanner(
            `RAMMING IMPACT — HULL — ${res.damageA} DAMAGE (Enemy took ${res.damageB})`,
            'hull',
            res.damageA,
            res.damageA >= 14
          );
          if (!this.combat.active && pir.hull > 0) this.startNavalBattle(pir);
          if (pir.hull <= 0) this.handlePirateDefeated(pir);
          this.checkPermadeath(pir.name);
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

    if (res.completedRepairSection) {
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
    if (this.combat.active || this.modalOpen) return;
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
    } else if (p.condition.hull <= 0 || p.condition.flooding >= 100) {
      this.playerSinkingCause = `Your vessel was sunk by ${enemyName}.`;
      this.playerSinkingTimer = 1.8;
      this.combat.active = false;
      this.combat.pirateId = null;
      this.combat.monsterId = null;
      this.combat.hostileMerchantId = null;
      this.pushNotification('Hull breached! Your vessel is sinking!');
    }
  }

  private triggerPermadeath(cause: string): void {
    if (this.phase === 'gameover') return;
    this.saveData.stats.causeOfDeath = cause;
    this.combat.active = false;
    this.combat.pirateId = null;
    this.combat.monsterId = null;
    this.combat.hostileMerchantId = null;
    clearVoyageStorage();
    this.callbacks.onSaveUpdate(this.getSaveSnapshot());
    this.setPhase('gameover');
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
      const targetPos = this.combat.pirateId
        ? this.pirates.get(this.combat.pirateId)?.data
        : this.combat.monsterId
          ? this.monsters.get(this.combat.monsterId)?.data
          : this.combat.hostileMerchantId
            ? this.merchants.get(this.combat.hostileMerchantId)?.data
            : null;
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
      if (entry.data.defeated || entry.data.tamed) continue;
      const d = Math.hypot(entry.data.x - px, entry.data.z - pz);
      if (d < 52 && (!best || d < best.distance)) {
        best = {
          kind: 'monster',
          id: entry.data.id,
          label: `Inspect ${entry.data.name}`,
          distance: Math.round(d),
        };
      }
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

    return best;
  }

  // --- Hidden Admin Mode (Session-Only Testing & Event Console) ---

  public unlockAdminMode(password: string): boolean {
    if (password.trim() !== 'rgb') return false;
    this.adminUnlocked = true;
    this.adminEnabled = true;
    this.sound.playShipBell();
    this.pushNotification('Admin Mode Unlocked (Session Active).');
    this.emitHud();
    return true;
  }

  public toggleAdminMode(enabled?: boolean): boolean {
    if (!this.adminUnlocked) return false;
    this.adminEnabled = enabled !== undefined ? enabled : !this.adminEnabled;
    this.pushNotification(this.adminEnabled ? 'Admin Mode Enabled.' : 'Admin Mode Disabled.');
    this.emitHud();
    return this.adminEnabled;
  }

  public getAdminTeleportTargets(): AdminTeleportTarget[] {
    const px = this.saveData.player.x;
    const pz = this.saveData.player.z;
    const out: AdminTeleportTarget[] = [];

    for (const m of this.merchants.values()) {
      if (m.data.sunk) continue;
      if (m.data.battleId) {
        out.push({
          id: `battle_${m.data.id}`,
          kind: 'major_battle',
          label: `Major Battle (${m.data.name})`,
          x: m.data.x,
          z: m.data.z,
          distance: Math.round(Math.hypot(m.data.x - px, m.data.z - pz)),
        });
      } else if (m.data.isCrown) {
        out.push({
          id: `crown_${m.data.id}`,
          kind: 'crown_armada',
          label: `Crown Ship: ${m.data.name}`,
          x: m.data.x,
          z: m.data.z,
          distance: Math.round(Math.hypot(m.data.x - px, m.data.z - pz)),
        });
      }
    }
    for (const p of this.pirates.values()) {
      if (p.data.defeated) continue;
      if (p.data.isGhost) {
        out.push({
          id: `ghost_${p.data.id}`,
          kind: 'ghost_ship',
          label: `Ghost (${(p.data.ghostSize ?? 'medium').toUpperCase()}): ${p.data.name}`,
          x: p.data.x,
          z: p.data.z,
          distance: Math.round(Math.hypot(p.data.x - px, p.data.z - pz)),
        });
      } else if (p.data.isBoss) {
        out.push({
          id: `boss_${p.data.id}`,
          kind: 'pirate_boss',
          label: `Pirate Boss: ${p.data.name}`,
          x: p.data.x,
          z: p.data.z,
          distance: Math.round(Math.hypot(p.data.x - px, p.data.z - pz)),
        });
      } else if (p.data.fleetId || p.data.isFlagship) {
        out.push({
          id: `pir_${p.data.id}`,
          kind: 'pirate_armada',
          label: `Pirate Armada: ${p.data.name}`,
          x: p.data.x,
          z: p.data.z,
          distance: Math.round(Math.hypot(p.data.x - px, p.data.z - pz)),
        });
      }
    }

    // Always include direct synthetic warp presets so every category is one click away
    const presets: AdminTeleportTarget[] = [
      { id: 'preset_crown', kind: 'crown_armada', label: 'Crown Royal Armada (Warp / Spawn)', x: px + 1400, z: pz - 1200, distance: 1844 },
      { id: 'preset_pirate', kind: 'pirate_armada', label: 'Pirate Armada Squadron (Warp / Spawn)', x: px - 1400, z: pz - 1100, distance: 1780 },
      { id: 'preset_boss', kind: 'pirate_boss', label: 'Pirate Faction Boss (Warp / Spawn)', x: px + 2200, z: pz + 1600, distance: 2720 },
      { id: 'preset_battle', kind: 'major_battle', label: 'Major Naval Battle (Warp / Spawn)', x: px - 1900, z: pz + 1800, distance: 2617 },
      { id: 'preset_ghost', kind: 'ghost_ship', label: 'Ghost Ship Encounter (Warp / Spawn)', x: px + 2800, z: pz - 2400, distance: 3687 },
    ];
    return [...out.slice(0, 10), ...presets];
  }

  public adminTeleportNear(targetId: string): { ok: boolean; message: string } {
    if (!this.adminEnabled) return { ok: false, message: 'Enable Admin Mode first.' };
    const targets = this.getAdminTeleportTargets();
    const target = targets.find((t) => t.id === targetId);
    if (!target) return { ok: false, message: 'Teleport target not found.' };

    const safeX = target.x - 105;
    const safeZ = target.z + 45;
    this.saveData.player.x = safeX;
    this.saveData.player.z = safeZ;
    this.saveData.player.speed = 0;
    this.saveData.player.throttle = 0;
    this.streamWorldAroundPlayer();

    if (target.id === 'preset_ghost') {
      this.adminSpawnGhostShip('colossal');
    } else if (target.id === 'preset_boss') {
      const fid = PIRATE_FACTION_IDS[Math.floor(this.rand() * PIRATE_FACTION_IDS.length)];
      const boss = generatePirateShip(`admin_boss_${Math.floor(this.simTime)}`, target.x, target.z, 'dreadnought', this.rand, {
        factionId: fid,
        isBoss: true,
        isFlagship: true,
        rank: 6,
      });
      this.spawnAdminPirate(boss);
    } else if (target.id === 'preset_pirate' || target.id === 'preset_battle') {
      const fid = PIRATE_FACTION_IDS[Math.floor(this.rand() * PIRATE_FACTION_IDS.length)];
      for (let i = 0; i < 3; i++) {
        const pir = generatePirateShip(
          `admin_arm_${Math.floor(this.simTime)}_${i}`,
          target.x + i * 38,
          target.z + (i % 2) * 36,
          i === 0 ? 'galleon' : 'brigantine',
          this.rand,
          { factionId: fid, isFlagship: i === 0 }
        );
        if (target.id === 'preset_battle') pir.battleId = `admin_battle_${Math.floor(this.simTime)}`;
        this.spawnAdminPirate(pir);
      }
    }

    this.pushNotification(`Admin Warped near ${target.label}.`);
    this.emitHud();
    return { ok: true, message: `Teleported near ${target.label}.` };
  }

  private spawnAdminPirate(pir: PirateShipData): void {
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
      halfLength: built.halfLength,
      halfBeam: built.halfBeam,
      cannonRecoil: 0,
      impactRoll: 0,
      impactPitch: 0,
      smokeAccum: 0,
    });
  }

  public adminRestoreMaxResources(): { ok: boolean; message: string } {
    if (!this.adminEnabled) return { ok: false, message: 'Admin Mode is disabled.' };
    const p = this.saveData.player;
    p.gold = 99999;
    p.condition = { hull: 100, sails: 100, mast: 100, steering: 100, cannons: 100, deck: 100, flooding: 0 };
    p.upgrades = {
      ...p.upgrades,
      hullTier: 7,
      hullLengthBonus: 3,
      hullWidthBonus: 3,
      deckLevel: 3,
      reinforcementTier: 3,
      armorPlating: 4,
      sailTier: 4,
      extraMast: true,
      steeringTier: 4,
      storageTier: 4,
      crowsNest: true,
      medicalBay: true,
      repairStation: true,
      weaponType: 'specialised',
      cannonCount: 24,
      cannonUpgrades: { damageLvl: 4, accuracyLvl: 4, reloadLvl: 4, durabilityLvl: 4 },
    };
    (Object.keys(RESOURCE_DEFS) as ResourceId[]).forEach((rid) => {
      const def = RESOURCE_DEFS[rid];
      p.inventory[rid] = def.rarity === 'Common' ? 95 : 45;
    });
    const bonusRoles: CrewRole[] = ['sailor', 'cannoneer', 'repair', 'lookout', 'navigator'];
    let crewIdx = 0;
    while (p.crew.length < 16) {
      const role = bonusRoles[crewIdx % bonusRoles.length];
      p.crew.push(createRandomCrewMember(`admin_crew_${Date.now()}_${crewIdx}`, this.rand, role, false));
      crewIdx++;
    }
    p.crew.forEach((c) => {
      c.health = 100;
      c.morale = 100;
      c.loyalty = 100;
      c.condition = 'healthy';
    });
    this.rebuildPlayerShipMesh();
    this.sound.playCoinChime();
    this.pushNotification('Admin: Max Sovereign Flagship, 99,999 Gold & Full Stores!');
    this.emitHud();
    return { ok: true, message: 'Restored Sovereign Flagship, max cannons, 99,999 gold & full stores.' };
  }

  public adminSpawnMaxFleet(): { ok: boolean; message: string } {
    if (!this.adminEnabled) return { ok: false, message: 'Admin Mode is disabled.' };
    const p = this.saveData.player;
    if (p.upgrades.hullTier < 3) {
      p.upgrades.hullTier = 3;
      this.rebuildPlayerShipMesh();
    }
    const bonusRoles: CrewRole[] = ['sailor', 'cannoneer', 'repair', 'lookout', 'navigator'];
    let cIdx = 0;
    while (p.crew.length < 12) {
      p.crew.push(createRandomCrewMember(`admin_fleet_crew_${Date.now()}_${cIdx}`, this.rand, bonusRoles[cIdx % bonusRoles.length], false));
      cIdx++;
    }
    const classes: FleetShipClass[] = ['heavy_warship', 'heavy_warship', 'large_merchant', 'medium_armed', 'fast_scout'];
    let added = 0;
    while (this.saveData.fleet.filter((f) => !f.sunk).length < MAX_FLEET_SIZE) {
      const slot = this.saveData.fleet.filter((f) => !f.sunk).length;
      const cls = classes[slot % classes.length];
      const ship = createFleetShip(
        `admin_fleet_${Date.now()}_${slot}`,
        cls,
        slot,
        this.saveData.player.x,
        this.saveData.player.z,
        this.saveData.player.heading,
        this.rand
      );
      ship.hullTier = 5;
      ship.deckLevel = 2;
      ship.cannonTier = 4;
      ship.cannons = ship.maxCannons;
      ship.maxHull = Math.round(ship.maxHull * 1.45);
      ship.hull = ship.maxHull;
      ship.crewCount = ship.maxCrew;
      this.saveData.fleet.push(ship);
      added++;
    }
    this.syncFleetMeshes(true);
    this.sound.playShipBell();
    this.pushNotification(`Admin: ${added > 0 ? 'Spawned max 5-ship Armada Fleet!' : 'Fleet upgraded to 5 max warships!'}`);
    this.emitHud();
    return { ok: true, message: '5-ship max Fleet ready in wedge formation!' };
  }

  public adminSpawnColossalCompanion(): { ok: boolean; message: string } {
    if (!this.adminEnabled) return { ok: false, message: 'Admin Mode is disabled.' };
    const monster = generateSeaMonster(
      `admin_colossal_${Date.now()}`,
      this.saveData.player.x + 24,
      this.saveData.player.z - 24,
      this.rand,
      true
    );
    const companion = {
      id: monster.id,
      name: `Sovereign ${monster.name}`,
      species: monster.species,
      size: 'legendary' as const,
      hp: Math.max(1250, monster.maxHp),
      maxHp: Math.max(1250, monster.maxHp),
      damage: Math.max(68, monster.damage),
      x: this.saveData.player.x + 24,
      z: this.saveData.player.z - 24,
      heading: this.saveData.player.heading,
    };
    this.saveData.tamedMonsters.push(companion);
    this.syncTamedCompanions();
    this.sound.playMonsterRoar();
    this.pushNotification(`Admin: Summoned Colossal Sea Companion (${companion.name})!`);
    this.emitHud();
    return { ok: true, message: `Summoned ${companion.name}!` };
  }

  public adminSpawnGhostShip(size: GhostSizeTier = 'medium'): { ok: boolean; message: string } {
    if (!this.adminEnabled) return { ok: false, message: 'Admin Mode is disabled.' };
    const ang = this.saveData.player.heading;
    const gx = this.saveData.player.x - Math.sin(ang) * 105;
    const gz = this.saveData.player.z - Math.cos(ang) * 105;
    const ghost = generateGhostShip(`admin_ghost_${size}_${Math.floor(this.simTime)}`, gx, gz, this.rand, size);
    ghost.discovered = true;
    ghost.behavior = 'pursue';
    this.spawnAdminPirate(ghost);
    this.sound.playGhostWhisper();
    this.pushNotification(`Admin: Summoned ${size.toUpperCase()} Ghost Ship "${ghost.name}" ahead!`);
    this.emitHud();
    return { ok: true, message: `Spawned ${size} Ghost Ship "${ghost.name}" 105m ahead.` };
  }

  public adminSetWeather(type: WeatherType): { ok: boolean; message: string } {
    if (!this.adminEnabled) return { ok: false, message: 'Admin Mode is disabled.' };
    if (!ALL_WEATHER_TYPES.includes(type)) return { ok: false, message: 'Unknown weather type.' };
    const built = buildWeatherStateFromType(type, this.saveData.weather.windDir, 120);
    this.saveData.weather = built;
    this.saveData.weatherForecast = generateWeatherForecast(type, 120, this.rand, 3);
    if (type === 'tornado') {
      this.tornadoPos = {
        x: this.saveData.player.x - Math.sin(this.saveData.player.heading) * 95,
        z: this.saveData.player.z - Math.cos(this.saveData.player.heading) * 95,
        vx: 6,
        vz: 4,
        active: true,
      };
    } else {
      this.tornadoPos.active = false;
    }
    this.pushNotification(`Admin Weather Forced: ${WEATHER_PRESETS[type].label}`);
    this.emitHud();
    return { ok: true, message: `Weather set to ${WEATHER_PRESETS[type].label}.` };
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

    const { foodDays, waterDays } = computeSupplyDaysRemaining(p.inventory, p.crew.length, this.saveData.weather);
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

    const headingDeg = ((Math.round((-p.heading * 180) / Math.PI) % 360) + 360) % 360;
    const livingFleetCount = this.saveData.fleet.filter((f) => !f.sunk).length;
    const tornadoNearby =
      this.tornadoPos.active && Math.hypot(this.tornadoPos.x - p.x, this.tornadoPos.z - p.z) < 260;

    this.callbacks.onHudUpdate({
      phase: this.phase,
      shipName: p.shipName || DEFAULT_PLAYER_SHIP_NAME,
      day: this.saveData.day,
      timeOfDay: this.saveData.timeOfDay,
      timeStr: formatTimeOfDay(this.saveData.timeOfDay),
      dayPhaseLabel: getDayPhaseLabel(this.saveData.timeOfDay),
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
      foodDaysRemaining: foodDays,
      waterDaysRemaining: waterDays,
      supplyWarnings,
      crewHealthWarnings: getLowHealthWarnings(p.crew),
      fleetDistress: [...this.fleetDistressAlerts],
      condition: { ...p.condition },
      upgrades: { ...p.upgrades },
      activeRepairJob: this.saveData.activeRepairJob ? { ...this.saveData.activeRepairJob } : null,
      nearbyPrompt: this.findNearbyInteractable(),
      combat: { ...this.combat, combatLog: [...this.combat.combatLog] },
      activePirate: activePirate ? { ...activePirate } : null,
      activeMonster: activeMonster ? { ...activeMonster } : null,
      activeEnemy,
      tamedMonstersCount: this.saveData.tamedMonsters.length,
      fleetCount: livingFleetCount,
      fleetUnlocked: getFleetUnlockStatus(p.upgrades, p.crew.length, p.gold).unlocked,
      nearbyGhostWarning: this.nearbyGhostActive,
      nearbyMajorBattle: this.nearbyMajorBattleActive ? 'Major Fleet Battle' : null,
      activeTornadoWarning: tornadoNearby,
      adminUnlocked: this.adminUnlocked,
      adminEnabled: this.adminEnabled,
      notification: this.notificationText,
      damageBanner: this.damageBanner ? { ...this.damageBanner } : null,
      journalToast: this.journalToastText,
      tutorialToast: this.activeTutorial ? { ...this.activeTutorial } : null,
      autosaveTick: this.autosaveTick,
    });
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
        this.callbacks.onHotkeyMenu('interact');
      }
      return;
    }
    if (e.code === 'Space' && this.phase === 'playing' && !this.modalOpen) {
      e.preventDefault();
      if (!e.repeat) this.toggleStop();
      return;
    }

    this.keys.add(e.code);
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  private onBlur = () => {
    this.keys.clear();
    this.isDragging = false;
  };

  private onMouseDown = (e: MouseEvent) => {
    if (this.phase !== 'playing' || this.modalOpen) return;
    if (e.button === 0 || e.button === 2) {
      this.isDragging = true;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
      this.sound.unlock();
    }
  };

  private onMouseMove = (e: MouseEvent) => {
    if (!this.isDragging || this.phase !== 'playing' || this.modalOpen) return;
    const dx = e.clientX - this.lastMouseX;
    const dy = e.clientY - this.lastMouseY;
    this.lastMouseX = e.clientX;
    this.lastMouseY = e.clientY;

    const sens = 0.0055 * this.saveData.settings.mouseSensitivity;
    this.camYaw -= dx * sens;
    const yMult = this.saveData.settings.invertY ? -1 : 1;
    this.camPitch = clamp(this.camPitch + dy * sens * yMult, 0.08, 1.12);
  };

  private onMouseUp = () => {
    this.isDragging = false;
  };

  private onWheel = (e: WheelEvent) => {
    if (this.phase !== 'playing' || this.modalOpen) return;
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
    this.renderer.domElement.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mouseup', this.onMouseUp);
    this.renderer.domElement.addEventListener('wheel', this.onWheel, { passive: true });
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    window.removeEventListener('resize', this.onResize);
    this.renderer.domElement.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mouseup', this.onMouseUp);
    this.renderer.domElement.removeEventListener('wheel', this.onWheel);
    this.textures.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}
