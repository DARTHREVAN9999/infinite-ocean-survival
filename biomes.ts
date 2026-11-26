import { OceanBiomeId } from './types';

export interface BiomeVisualConfig {
  id: OceanBiomeId;
  label: string;
  deepColorHex: number;
  shallowColorHex: number;
  foamTintHex: number;
  fogTintHex: number;
  temperatureC: number;
  iceChance: number;
  reefChance: number;
}

export const BIOME_CONFIGS: Record<OceanBiomeId, BiomeVisualConfig> = {
  temperate: {
    id: 'temperate',
    label: 'Normal Ocean',
    deepColorHex: 0x052842,
    shallowColorHex: 0x105b7a,
    foamTintHex: 0xdff4ff,
    fogTintHex: 0x7da4bd,
    temperatureC: 16,
    iceChance: 0,
    reefChance: 0.28,
  },
  tropical: {
    id: 'tropical',
    label: 'Tropical Shoals',
    deepColorHex: 0x065c78,
    shallowColorHex: 0x1fc7bc,
    foamTintHex: 0xeafffc,
    fogTintHex: 0x8cc7cf,
    temperatureC: 28,
    iceChance: 0,
    reefChance: 0.65,
  },
  cold: {
    id: 'cold',
    label: 'Frozen Reach',
    deepColorHex: 0x081e30,
    shallowColorHex: 0x336982,
    foamTintHex: 0xebf6ff,
    fogTintHex: 0x99b3c4,
    temperatureC: -3,
    iceChance: 0.78,
    reefChance: 0.14,
  },
  deep: {
    id: 'deep',
    label: 'Abyssal Deep',
    deepColorHex: 0x020b16,
    shallowColorHex: 0x06192c,
    foamTintHex: 0x8ea9c4,
    fogTintHex: 0x203144,
    temperatureC: 7,
    iceChance: 0,
    reefChance: 0,
  },
};

/**
 * Deterministic spatial biome resolver across the infinite ocean:
 * - Normal Ocean ('temperate') is the most common expanse (~50%).
 * - Tropical Shoals ('tropical') surround grass & sand island bays (including Coral Haven near 285,130).
 * - Frozen Reach ('cold') surrounds northern icefields & regional polar pockets (z < -620).
 * - Abyssal Deep ('deep') forms dark monster-only ocean trenches away from starter waters.
 */
export function getOceanBiome(x: number, z: number, seed: number): OceanBiomeId {
  const originDist = Math.hypot(x, z);
  if (originDist < 195) return 'temperate';

  // Guaranteed nearby Tropical bay around the starter island Coral Haven (285, 130)
  if (Math.hypot(x - 285, z - 130) < 230) return 'tropical';

  // Northern Arctic polar pocket around (0, -1000) & northern cold seas
  const arcticDist = Math.hypot(x, z + 1000);
  if (arcticDist < 340) return 'cold';

  // Abyssal Deep Ocean pockets (outside starter waters)
  if (originDist >= 560 && Math.hypot(x - 285, z - 130) > 310) {
    const deepWave =
      Math.sin(x * 0.00175 - z * 0.00135 + seed * 0.053) * 0.56 +
      Math.cos(x * 0.00105 + z * 0.00185 - seed * 0.029) * 0.44;
    if (deepWave > 0.54) return 'deep';
  }

  // Regional climate waves across infinite sea (~52% Normal Ocean, ~22% Tropical, ~18% Cold, ~8% Deep)
  const climate =
    Math.sin(x * 0.0014 + z * 0.0011 + seed * 0.017) * 0.55 +
    Math.cos(x * 0.00075 - z * 0.0016 + seed * 0.031) * 0.45;
  const latWarp = Math.sin(x * 0.0021 + seed * 0.13) * 140;

  if (z + latWarp < -760 && climate < 0.25) return 'cold';
  if (climate < -0.45 && z < 260) return 'cold';
  if (climate > 0.42 && z > -320) return 'tropical';
  if (z + latWarp > 780 && climate > 0.08) return 'tropical';
  return 'temperate';
}

export function getBiomeConfig(biome: OceanBiomeId): BiomeVisualConfig {
  return BIOME_CONFIGS[biome];
}
