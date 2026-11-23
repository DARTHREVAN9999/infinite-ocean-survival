import { WeatherForecastEntry, WeatherState, WeatherType } from './types';

export interface WaveParams {
  amp: number;
  steepness: number;
  windDirX: number;
  windDirZ: number;
  roguePhase: number;
  rogueAmp: number;
}

export interface WeatherPreset {
  type: WeatherType;
  label: string;
  windSpeed: number;
  waveIntensity: number;
  fogDensity: number;
  rainIntensity: number;
  snowIntensity: number;
  hailIntensity: number;
  skyDarkness: number;
  waterDrainMult: number;
  visibilityLabel: string;
  seaConditionLabel: string;
  severity: WeatherForecastEntry['severity'];
  warningText: string | null;
  forecastSummary: string;
}

export const WEATHER_PRESETS: Record<WeatherType, WeatherPreset> = {
  calm: {
    type: 'calm',
    label: 'Calm Seas',
    windSpeed: 5,
    waveIntensity: 0.42,
    fogDensity: 0.0008,
    rainIntensity: 0,
    snowIntensity: 0,
    hailIntensity: 0,
    skyDarkness: 0.0,
    waterDrainMult: 1.0,
    visibilityLabel: 'Crystal Clear',
    seaConditionLabel: 'Glassy Swell',
    severity: 'Calm',
    warningText: null,
    forecastSummary: 'Light airs and flat tranquil water across the horizon.',
  },
  clear: {
    type: 'clear',
    label: 'Clear Skies',
    windSpeed: 11,
    waveIntensity: 0.65,
    fogDensity: 0.00065,
    rainIntensity: 0,
    snowIntensity: 0,
    hailIntensity: 0,
    skyDarkness: 0.0,
    waterDrainMult: 1.0,
    visibilityLabel: 'Sharp Horizon',
    seaConditionLabel: 'Gentle Roll',
    severity: 'Fair',
    warningText: null,
    forecastSummary: 'Bright open skies with steady sailing breezes.',
  },
  light_winds: {
    type: 'light_winds',
    label: 'Light Winds',
    windSpeed: 15,
    waveIntensity: 0.85,
    fogDensity: 0.0011,
    rainIntensity: 0,
    snowIntensity: 0,
    hailIntensity: 0,
    skyDarkness: 0.06,
    waterDrainMult: 1.0,
    visibilityLabel: 'Good',
    seaConditionLabel: 'Moderate Chop',
    severity: 'Fair',
    warningText: null,
    forecastSummary: 'Brisk trade winds ideal for swift long-distance sailing.',
  },
  strong_winds: {
    type: 'strong_winds',
    label: 'Strong Winds',
    windSpeed: 26,
    waveIntensity: 1.48,
    fogDensity: 0.0021,
    rainIntensity: 0.06,
    snowIntensity: 0,
    hailIntensity: 0,
    skyDarkness: 0.24,
    waterDrainMult: 1.0,
    visibilityLabel: 'Hazy Spray',
    seaConditionLabel: 'High Whitecaps',
    severity: 'Rough',
    warningText: null,
    forecastSummary: 'Heavy gusts and steep whitecaps straining yards and rigging.',
  },
  light_rain: {
    type: 'light_rain',
    label: 'Light Rain',
    windSpeed: 17,
    waveIntensity: 1.05,
    fogDensity: 0.0028,
    rainIntensity: 0.42,
    snowIntensity: 0,
    hailIntensity: 0,
    skyDarkness: 0.34,
    waterDrainMult: 0.94,
    visibilityLabel: 'Mist Veil',
    seaConditionLabel: 'Rolling Rain Swell',
    severity: 'Fair',
    warningText: null,
    forecastSummary: 'Passing rain showers dampening decks and softening horizon sight.',
  },
  heavy_rain: {
    type: 'heavy_rain',
    label: 'Heavy Rain',
    windSpeed: 27,
    waveIntensity: 1.72,
    fogDensity: 0.0046,
    rainIntensity: 0.92,
    snowIntensity: 0,
    hailIntensity: 0,
    skyDarkness: 0.56,
    waterDrainMult: 0.9,
    visibilityLabel: 'Poor Downpour',
    seaConditionLabel: 'Turbulent Swell',
    severity: 'Rough',
    warningText: 'HEAVY RAIN SQUALL — REDUCED VISIBILITY',
    forecastSummary: 'Dense sheets of rain and steep cross-swells limiting lookout range.',
  },
  hail: {
    type: 'hail',
    label: 'Hail',
    windSpeed: 29,
    waveIntensity: 1.82,
    fogDensity: 0.0042,
    rainIntensity: 0.25,
    snowIntensity: 0,
    hailIntensity: 0.55,
    skyDarkness: 0.52,
    waterDrainMult: 1.0,
    visibilityLabel: 'Icy Squall',
    seaConditionLabel: 'Churned Seas',
    severity: 'Rough',
    warningText: 'HAIL SQUALL — DECK & SAIL IMPACT RISK',
    forecastSummary: 'Sharp ice pellets battering canvas sails and exposed planks.',
  },
  severe_hail: {
    type: 'severe_hail',
    label: 'Severe Hailstorm',
    windSpeed: 38,
    waveIntensity: 2.25,
    fogDensity: 0.0056,
    rainIntensity: 0.35,
    snowIntensity: 0,
    hailIntensity: 1.0,
    skyDarkness: 0.68,
    waterDrainMult: 1.0,
    visibilityLabel: 'Blinding Sleets',
    seaConditionLabel: 'Violent Chop',
    severity: 'Dangerous',
    warningText: 'SEVERE HAILSTORM — DECK & RIGGING DAMAGE!',
    forecastSummary: 'Dangerous heavy hailstones tearing rigging and bruising exposed crew.',
  },
  snow: {
    type: 'snow',
    label: 'Snowfall',
    windSpeed: 18,
    waveIntensity: 1.15,
    fogDensity: 0.0044,
    rainIntensity: 0,
    snowIntensity: 0.68,
    hailIntensity: 0,
    skyDarkness: 0.38,
    waterDrainMult: 1.0,
    visibilityLabel: 'Pale Drift',
    seaConditionLabel: 'Cold Dark Swell',
    severity: 'Rough',
    warningText: null,
    forecastSummary: 'Steady arctic snowfall drifting across pale slate waters.',
  },
  blizzard: {
    type: 'blizzard',
    label: 'Blizzard',
    windSpeed: 42,
    waveIntensity: 2.35,
    fogDensity: 0.0085,
    rainIntensity: 0,
    snowIntensity: 1.0,
    hailIntensity: 0.25,
    skyDarkness: 0.64,
    waterDrainMult: 1.05,
    visibilityLabel: 'Whiteout Gale',
    seaConditionLabel: 'Freezing Mountain Waves',
    severity: 'Dangerous',
    warningText: 'BLIZZARD WHITEOUT — SEVERE COLD & LOW VISIBILITY!',
    forecastSummary: 'Howling freezing gales blinding lookouts and wearing down sails.',
  },
  thunderstorm: {
    type: 'thunderstorm',
    label: 'Thunderstorm',
    windSpeed: 36,
    waveIntensity: 2.2,
    fogDensity: 0.0052,
    rainIntensity: 0.9,
    snowIntensity: 0,
    hailIntensity: 0,
    skyDarkness: 0.72,
    waterDrainMult: 0.95,
    visibilityLabel: 'Storm Darkness',
    seaConditionLabel: 'Surging Breakers',
    severity: 'Dangerous',
    warningText: 'THUNDERSTORM — LIGHTNING & ROUGH SEAS!',
    forecastSummary: 'Rolling thunderheads, steep breakers, and frequent lightning flashes.',
  },
  lightning_storm: {
    type: 'lightning_storm',
    label: 'Lightning Storm',
    windSpeed: 40,
    waveIntensity: 2.42,
    fogDensity: 0.0058,
    rainIntensity: 0.88,
    snowIntensity: 0,
    hailIntensity: 0,
    skyDarkness: 0.8,
    waterDrainMult: 1.0,
    visibilityLabel: 'Flickering Gloom',
    seaConditionLabel: 'Violent Swell',
    severity: 'Dangerous',
    warningText: 'LIGHTNING STORM — DIRECT STRIKE HAZARD!',
    forecastSummary: 'Violent electrical storm with sky-splitting bolts capable of striking masts.',
  },
  hurricane: {
    type: 'hurricane',
    label: 'Hurricane',
    windSpeed: 56,
    waveIntensity: 2.9,
    fogDensity: 0.0076,
    rainIntensity: 1.0,
    snowIntensity: 0,
    hailIntensity: 0.15,
    skyDarkness: 0.86,
    waterDrainMult: 1.0,
    visibilityLabel: 'Storm Wall',
    seaConditionLabel: 'Mountainous Tempest',
    severity: 'Extreme',
    warningText: 'HURRICANE WARNING — EXTREME HULL & SAIL STRESS!',
    forecastSummary: 'Catastrophic spiral tempest pushing mountainous waves across all sea lanes.',
  },
  tornado: {
    type: 'tornado',
    label: 'Tornado / Waterspout',
    windSpeed: 58,
    waveIntensity: 2.75,
    fogDensity: 0.0064,
    rainIntensity: 0.82,
    snowIntensity: 0,
    hailIntensity: 0.25,
    skyDarkness: 0.84,
    waterDrainMult: 1.0,
    visibilityLabel: 'Spinning Squall',
    seaConditionLabel: 'Whirling Surge',
    severity: 'Extreme',
    warningText: 'WATERSPOUT TORNADO NEARBY — EVADE FUNNEL!',
    forecastSummary: 'Raging cyclonic waterspout twisting across the waves — steer clear of the funnel.',
  },
  dense_fog: {
    type: 'dense_fog',
    label: 'Dense Fog',
    windSpeed: 9,
    waveIntensity: 0.68,
    fogDensity: 0.0135,
    rainIntensity: 0,
    snowIntensity: 0,
    hailIntensity: 0,
    skyDarkness: 0.34,
    waterDrainMult: 1.0,
    visibilityLabel: 'Near Zero',
    seaConditionLabel: 'Eerie Still Swell',
    severity: 'Rough',
    warningText: 'DENSE FOG BANK — REDUCED SIGHTLINES!',
    forecastSummary: 'Pea-soup sea fog swallowing distant sails and masking ghostly threats.',
  },
  heatwave: {
    type: 'heatwave',
    label: 'Heatwave',
    windSpeed: 7,
    waveIntensity: 0.48,
    fogDensity: 0.0007,
    rainIntensity: 0,
    snowIntensity: 0,
    hailIntensity: 0,
    skyDarkness: 0.0,
    waterDrainMult: 1.55,
    visibilityLabel: 'Sun-Glare',
    seaConditionLabel: 'Blistering Calm',
    severity: 'Fair',
    warningText: 'HEATWAVE — CREW WATER CONSUMPTION +55%',
    forecastSummary: 'Relentless equatorial sun baking decks and spiking crew thirst.',
  },
};

export const ALL_WEATHER_TYPES: WeatherType[] = Object.keys(WEATHER_PRESETS) as WeatherType[];

// Fixed 4-wave spectrum shared verbatim between JS buoyancy math and GLSL ocean shader
export const WAVE_COMPONENTS = [
  { dx: 0.86, dz: 0.51, freq: 0.048, speed: 1.15, weight: 0.52 },
  { dx: -0.42, dz: 0.91, freq: 0.078, speed: 1.48, weight: 0.27 },
  { dx: 0.24, dz: -0.97, freq: 0.135, speed: 1.92, weight: 0.14 },
  { dx: -0.92, dz: -0.39, freq: 0.215, speed: 2.45, weight: 0.07 },
] as const;

export function sampleWaveHeight(
  x: number,
  z: number,
  time: number,
  waveIntensity: number,
  rogueBoost = 0
): number {
  const amp = Math.max(0.15, waveIntensity) * 1.45;
  let y = 0;

  for (let i = 0; i < WAVE_COMPONENTS.length; i++) {
    const w = WAVE_COMPONENTS[i];
    const phase = (x * w.dx + z * w.dz) * w.freq + time * w.speed;
    const s = Math.sin(phase);
    const sharpened = s + 0.22 * (s * s - 0.5);
    y += sharpened * w.weight * amp;
  }

  if (rogueBoost > 0.01) {
    const roguePhase = (x * 0.7 + z * 0.71) * 0.028 + time * 0.78;
    const rogueEnv = Math.max(0, Math.sin(roguePhase));
    y += rogueEnv * rogueEnv * rogueBoost * 3.2;
  }

  return y;
}

export function sampleWaveNormal(
  x: number,
  z: number,
  time: number,
  waveIntensity: number,
  rogueBoost = 0
): { nx: number; ny: number; nz: number } {
  const eps = 0.6;
  const hL = sampleWaveHeight(x - eps, z, time, waveIntensity, rogueBoost);
  const hR = sampleWaveHeight(x + eps, z, time, waveIntensity, rogueBoost);
  const hD = sampleWaveHeight(x, z - eps, time, waveIntensity, rogueBoost);
  const hU = sampleWaveHeight(x, z + eps, time, waveIntensity, rogueBoost);

  const dx = (hR - hL) / (2 * eps);
  const dz = (hU - hD) / (2 * eps);

  const len = Math.hypot(-dx, 1, -dz) || 1;
  return {
    nx: -dx / len,
    ny: 1 / len,
    nz: -dz / len,
  };
}

export interface BuoyancyPose {
  y: number;
  pitch: number;
  roll: number;
  splashIntensity: number;
}

export function computeBoatBuoyancy(
  x: number,
  z: number,
  heading: number,
  halfLength: number,
  halfBeam: number,
  stabilityFactor: number,
  turnRate: number,
  speed: number,
  time: number,
  waveIntensity: number,
  rogueBoost = 0
): BuoyancyPose {
  const sinH = Math.sin(heading);
  const cosH = Math.cos(heading);
  const fwdX = -sinH;
  const fwdZ = -cosH;
  const rightX = cosH;
  const rightZ = -sinH;

  const hBow = sampleWaveHeight(x + fwdX * halfLength, z + fwdZ * halfLength, time, waveIntensity, rogueBoost);
  const hStern = sampleWaveHeight(x - fwdX * halfLength, z - fwdZ * halfLength, time, waveIntensity, rogueBoost);
  const hStarboard = sampleWaveHeight(x + rightX * halfBeam, z + rightZ * halfBeam, time, waveIntensity, rogueBoost);
  const hPort = sampleWaveHeight(x - rightX * halfBeam, z - rightZ * halfBeam, time, waveIntensity, rogueBoost);
  const hCenter = sampleWaveHeight(x, z, time, waveIntensity, rogueBoost);

  const avgY = hCenter * 0.4 + (hBow + hStern + hPort + hStarboard) * 0.15;

  const rawPitch = Math.atan2(hBow - hStern, Math.max(2, halfLength * 2));
  const rawRoll = Math.atan2(hPort - hStarboard, Math.max(1.5, halfBeam * 2));

  const rockScale = 1 / Math.max(0.85, stabilityFactor * 0.72);
  const turnHeel = -turnRate * Math.min(1, Math.abs(speed) / 8) * (0.24 / Math.max(1, stabilityFactor * 0.7));

  const maxPitch = 0.34;
  const maxRoll = 0.38;

  const pitch = clamp(rawPitch * rockScale, -maxPitch, maxPitch);
  const roll = clamp(rawRoll * rockScale + turnHeel, -maxRoll, maxRoll);

  const waveSlope = Math.abs(hBow - hStern) / Math.max(2, halfLength * 2);
  const splashIntensity = clamp(
    (waveSlope * 1.8 + Math.max(0, waveIntensity - 1.0) * 0.35) * (0.35 + Math.abs(speed) * 0.08),
    0,
    1
  );

  return {
    y: avgY + 0.12,
    pitch,
    roll,
    splashIntensity,
  };
}

export function buildWeatherStateFromType(
  type: WeatherType,
  windDir: number,
  durationSec = 100
): WeatherState {
  const preset = WEATHER_PRESETS[type] || WEATHER_PRESETS.light_winds;
  return {
    type: preset.type,
    windSpeed: preset.windSpeed,
    windDir,
    waveIntensity: preset.waveIntensity,
    fogDensity: preset.fogDensity,
    rainIntensity: preset.rainIntensity,
    snowIntensity: preset.snowIntensity,
    hailIntensity: preset.hailIntensity,
    lightningFlash: 0,
    waterDrainMult: preset.waterDrainMult,
    visibilityLabel: preset.visibilityLabel,
    seaConditionLabel: preset.seaConditionLabel,
    warningText: preset.warningText,
    timeUntilChange: durationSec,
  };
}

export function createInitialWeather(seedRand: () => number): WeatherState {
  return buildWeatherStateFromType('clear', seedRand() * Math.PI * 2, 105 + seedRand() * 65);
}

const TRANSITION_POOL: Record<WeatherType, [WeatherType, number][]> = {
  calm: [
    ['clear', 0.36],
    ['light_winds', 0.28],
    ['dense_fog', 0.14],
    ['heatwave', 0.14],
    ['light_rain', 0.08],
  ],
  clear: [
    ['light_winds', 0.38],
    ['calm', 0.22],
    ['heatwave', 0.14],
    ['light_rain', 0.16],
    ['dense_fog', 0.1],
  ],
  light_winds: [
    ['clear', 0.28],
    ['strong_winds', 0.24],
    ['light_rain', 0.22],
    ['dense_fog', 0.1],
    ['snow', 0.08],
    ['hail', 0.08],
  ],
  strong_winds: [
    ['light_winds', 0.22],
    ['heavy_rain', 0.22],
    ['thunderstorm', 0.22],
    ['hail', 0.16],
    ['snow', 0.1],
    ['lightning_storm', 0.08],
  ],
  light_rain: [
    ['light_winds', 0.3],
    ['heavy_rain', 0.24],
    ['dense_fog', 0.16],
    ['thunderstorm', 0.16],
    ['clear', 0.14],
  ],
  heavy_rain: [
    ['light_rain', 0.24],
    ['thunderstorm', 0.28],
    ['lightning_storm', 0.18],
    ['hail', 0.14],
    ['hurricane', 0.08],
    ['strong_winds', 0.08],
  ],
  hail: [
    ['strong_winds', 0.25],
    ['heavy_rain', 0.22],
    ['severe_hail', 0.2],
    ['snow', 0.18],
    ['thunderstorm', 0.15],
  ],
  severe_hail: [
    ['hail', 0.34],
    ['thunderstorm', 0.24],
    ['blizzard', 0.2],
    ['hurricane', 0.12],
    ['strong_winds', 0.1],
  ],
  snow: [
    ['blizzard', 0.26],
    ['dense_fog', 0.22],
    ['clear', 0.22],
    ['light_winds', 0.18],
    ['hail', 0.12],
  ],
  blizzard: [
    ['snow', 0.42],
    ['dense_fog', 0.22],
    ['strong_winds', 0.22],
    ['severe_hail', 0.14],
  ],
  thunderstorm: [
    ['heavy_rain', 0.24],
    ['lightning_storm', 0.28],
    ['strong_winds', 0.2],
    ['hurricane', 0.12],
    ['tornado', 0.06],
    ['light_rain', 0.1],
  ],
  lightning_storm: [
    ['thunderstorm', 0.35],
    ['heavy_rain', 0.24],
    ['hurricane', 0.18],
    ['tornado', 0.1],
    ['strong_winds', 0.13],
  ],
  hurricane: [
    ['thunderstorm', 0.34],
    ['lightning_storm', 0.24],
    ['heavy_rain', 0.24],
    ['tornado', 0.1],
    ['strong_winds', 0.08],
  ],
  tornado: [
    ['lightning_storm', 0.32],
    ['thunderstorm', 0.32],
    ['heavy_rain', 0.22],
    ['strong_winds', 0.14],
  ],
  dense_fog: [
    ['calm', 0.26],
    ['light_winds', 0.28],
    ['light_rain', 0.22],
    ['snow', 0.12],
    ['clear', 0.12],
  ],
  heatwave: [
    ['calm', 0.32],
    ['clear', 0.36],
    ['light_winds', 0.2],
    ['thunderstorm', 0.12],
  ],
};

export function pickNextWeather(current: WeatherType, rand: () => number): WeatherType {
  const pool = TRANSITION_POOL[current] || TRANSITION_POOL.light_winds;
  const totalWeight = pool.reduce((s, [, w]) => s + w, 0);
  let r = rand() * totalWeight;
  for (const [type, weight] of pool) {
    r -= weight;
    if (r <= 0) return type;
  }
  return pool[0][0];
}

export function generateWeatherForecast(
  current: WeatherType,
  initialEtaSeconds: number,
  rand: () => number,
  steps = 3
): WeatherForecastEntry[] {
  const out: WeatherForecastEntry[] = [];
  let cursor = current;
  let cumulativeEta = Math.max(15, Math.round(initialEtaSeconds));

  for (let i = 0; i < steps; i++) {
    cursor = pickNextWeather(cursor, rand);
    // Occasional imperfect barometer forecast (25% chance reported prediction diverges slightly)
    const uncertain = rand() < 0.25;
    const shownType =
      uncertain && rand() < 0.55 ? pickNextWeather(cursor, rand) : cursor;
    const preset = WEATHER_PRESETS[shownType];
    out.push({
      type: shownType,
      label: preset.label,
      etaSeconds: cumulativeEta,
      severity: preset.severity,
      summary: preset.forecastSummary,
      uncertain,
    });
    cumulativeEta += Math.round(90 + rand() * 55);
  }
  return out;
}

export function normalizeLegacyWeatherType(raw: string | undefined): WeatherType {
  if (!raw) return 'clear';
  if (raw === 'rain') return 'light_rain';
  if (raw === 'rough_seas') return 'strong_winds';
  if (raw === 'extreme_storm') return 'hurricane';
  if (raw in WEATHER_PRESETS) return raw as WeatherType;
  return 'light_winds';
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function normalizeAngle(a: number): number {
  let out = a % (Math.PI * 2);
  if (out > Math.PI) out -= Math.PI * 2;
  if (out < -Math.PI) out += Math.PI * 2;
  return out;
}
