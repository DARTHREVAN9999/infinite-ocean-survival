import {
  CannonUpgrades,
  CustomFlagConfig,
  FlagDyeId,
  FlagEmblemId,
  FlagPatternId,
  FlagShape,
  GhostSizeTier,
  Inventory,
  ManualRepairJob,
  MerchantShipData,
  MerchantTier,
  PirateShipData,
  RepairPriority,
  ResourceDef,
  ResourceId,
  ShipCondition,
  ShipUpgrades,
  ShipwreckData,
  ValuableCargoId,
  VesselClass,
  WeaponType,
  WreckArchetype,
  WreckSection,
  WreckSurvivor,
} from './types';
import { createRandomCrewMember } from './survival';
import { getMerchantReputationBehavior } from './factions';

export const RESOURCE_DEFS: Record<ResourceId, ResourceDef> = {
  wood: {
    id: 'wood',
    name: 'Timber',
    weight: 1.2,
    basePrice: 6,
    rarity: 'Common',
    description: 'Seasoned oak planks for basic hull construction, decks, and manual repairs.',
  },
  iron: {
    id: 'iron',
    name: 'Iron Ingots',
    weight: 1.8,
    basePrice: 14,
    rarity: 'Common',
    description: 'Forged iron fittings, bolts, brackets, and early cannon barrels.',
  },
  rope: {
    id: 'rope',
    name: 'Hemp Rope',
    weight: 0.7,
    basePrice: 8,
    rarity: 'Common',
    description: 'Tarred rigging lines for masts, stays, and yardarms.',
  },
  cloth: {
    id: 'cloth',
    name: 'Sailcloth',
    weight: 0.8,
    basePrice: 10,
    rarity: 'Common',
    description: 'Heavy woven canvas used to stitch larger sails and patch storm tears.',
  },
  food: {
    id: 'food',
    name: 'Provisions',
    weight: 0.6,
    basePrice: 5,
    rarity: 'Common',
    description: 'Salted beef, ship biscuit, and dried citrus automatically rationed to your crew.',
  },
  water: {
    id: 'water',
    name: 'Fresh Water',
    weight: 0.8,
    basePrice: 4,
    rarity: 'Common',
    description: 'Casks of potable water vital for long open-ocean crossings.',
  },
  tools: {
    id: 'tools',
    name: 'Shipwright Tools',
    weight: 1.0,
    basePrice: 22,
    rarity: 'Uncommon',
    description: 'Caulking irons, augers, and adzes needed for mid-tier ship construction.',
  },
  gunpowder: {
    id: 'gunpowder',
    name: 'Gunpowder',
    weight: 1.0,
    basePrice: 18,
    rarity: 'Military',
    description: 'Dry black powder kegs burned in naval broadsides.',
  },
  cannonballs: {
    id: 'cannonballs',
    name: 'Cannonballs',
    weight: 1.4,
    basePrice: 12,
    rarity: 'Military',
    description: 'Cast-iron roundshot and chain-shot for naval battles.',
  },
  medicine: {
    id: 'medicine',
    name: 'Medical Supplies',
    weight: 0.5,
    basePrice: 24,
    rarity: 'Uncommon',
    description: 'Bandages, splints, and tonics to treat injured sailors below 25 HP.',
  },
  cargo: {
    id: 'cargo',
    name: 'Merchant Crates',
    weight: 1.4,
    basePrice: 44,
    rarity: 'Valuable',
    isValuableCargo: true,
    description: 'Assorted port trade goods valued by regional merchants.',
  },
  jewellery: {
    id: 'jewellery',
    name: 'Jewellery & Gems',
    weight: 0.4,
    basePrice: 125,
    rarity: 'Valuable',
    isValuableCargo: true,
    description: 'Gold rings, emerald brooches, and polished gems prized by wealthy captains.',
  },
  preciousDecor: {
    id: 'preciousDecor',
    name: 'Precious Decorations',
    weight: 0.8,
    basePrice: 98,
    rarity: 'Valuable',
    isValuableCargo: true,
    description: 'Silver candelabras, gilded chalices, and ivory cabin ornaments.',
  },
  silk: {
    id: 'silk',
    name: 'Silk & Fine Fabrics',
    weight: 0.6,
    basePrice: 82,
    rarity: 'Valuable',
    isValuableCargo: true,
    description: 'Bolts of dyed eastern silk and velvet bolts sought in distant ports.',
  },
  rareSpices: {
    id: 'rareSpices',
    name: 'Rare Spices',
    weight: 0.5,
    basePrice: 74,
    rarity: 'Valuable',
    isValuableCargo: true,
    description: 'Sealed jars of saffron, cloves, cinnamon, and nutmeg.',
  },
  fineFurniture: {
    id: 'fineFurniture',
    name: 'Fine Furniture',
    weight: 2.2,
    basePrice: 112,
    rarity: 'Valuable',
    isValuableCargo: true,
    description: 'Carved mahogany tables, inlaid chests, and admiral writing desks.',
  },
  paintings: {
    id: 'paintings',
    name: 'Paintings & Artwork',
    weight: 0.9,
    basePrice: 138,
    rarity: 'Valuable',
    isValuableCargo: true,
    description: 'Oil seascapes and gilt-framed portraits rescued from noble cabins.',
  },
  antiques: {
    id: 'antiques',
    name: 'Antiques & Relics',
    weight: 1.0,
    basePrice: 155,
    rarity: 'Valuable',
    isValuableCargo: true,
    description: 'Ancient brass astrolabes, porcelain vases, and heirloom curiosities.',
  },
  luxuryGoods: {
    id: 'luxuryGoods',
    name: 'Luxury Goods',
    weight: 0.8,
    basePrice: 118,
    rarity: 'Valuable',
    isValuableCargo: true,
    description: 'Perfumed oils, crystal decanters, and fine pocket watches.',
  },
  rareImports: {
    id: 'rareImports',
    name: 'Rare Imported Goods',
    weight: 1.1,
    basePrice: 104,
    rarity: 'Valuable',
    isValuableCargo: true,
    description: 'Exotic teas, lacquered boxes, and curios from distant archipelagos.',
  },
  rareMaterials: {
    id: 'rareMaterials',
    name: 'Rare Materials',
    weight: 1.6,
    basePrice: 72,
    rarity: 'Rare',
    description: 'Exotic bronze fittings and heartwood reserved for grand ships.',
  },
  advancedTimber: {
    id: 'advancedTimber',
    name: 'Advanced Timber',
    weight: 1.5,
    basePrice: 54,
    rarity: 'Specialised',
    description: 'Kiln-cured teak and copper-sheathed framing for multi-deck galleons.',
  },
  reinforcedMetals: {
    id: 'reinforcedMetals',
    name: 'Reinforced Metals',
    weight: 2.2,
    basePrice: 82,
    rarity: 'Specialised',
    description: 'Tempered steel plates and bronze strakes for late-game armor and ribs.',
  },
  specializedSailcloth: {
    id: 'specializedSailcloth',
    name: 'Specialised Sailcloth',
    weight: 0.7,
    basePrice: 64,
    rarity: 'Specialised',
    description: 'High-tensile woven linen able to withstand hurricane gusts.',
  },
  decorativeMaterials: {
    id: 'decorativeMaterials',
    name: 'Decorative Materials',
    weight: 0.9,
    basePrice: 95,
    rarity: 'Specialised',
    description: 'Gilt leaf, carved figurehead oak, and rare pigments for flagship regalia.',
  },
};

export const RESOURCE_LIST: ResourceDef[] = Object.values(RESOURCE_DEFS);
export const VALUABLE_CARGO_IDS: ValuableCargoId[] = [
  'jewellery',
  'preciousDecor',
  'silk',
  'rareSpices',
  'fineFurniture',
  'paintings',
  'antiques',
  'luxuryGoods',
  'rareImports',
  'cargo',
];

export const FLAG_DYES: Record<
  FlagDyeId,
  { id: FlagDyeId; name: string; hex: string; rare: boolean; price: number }
> = {
  weathered_gray: { id: 'weathered_gray', name: 'Weathered Gray', hex: '#8b939c', rare: false, price: 0 },
  crimson: { id: 'crimson', name: 'Crimson Red', hex: '#b91c1c', rare: false, price: 0 },
  navy: { id: 'navy', name: 'Admiralty Blue', hex: '#1d4ed8', rare: false, price: 0 },
  emerald: { id: 'emerald', name: 'Sea Emerald', hex: '#15803d', rare: false, price: 0 },
  gold: { id: 'gold', name: 'Sunburst Yellow', hex: '#eab308', rare: false, price: 0 },
  obsidian: { id: 'obsidian', name: 'Pitch Black', hex: '#111827', rare: false, price: 0 },
  ivory: { id: 'ivory', name: 'Sail White', hex: '#f8fafc', rare: false, price: 0 },
  violet: { id: 'violet', name: 'Tyrian Violet', hex: '#7e22ce', rare: false, price: 45 },
  amber: { id: 'amber', name: 'Signal Orange', hex: '#ea580c', rare: false, price: 45 },
  teal_abyss: { id: 'teal_abyss', name: 'Abyssal Teal', hex: '#0f766e', rare: true, price: 140 },
  royal_purple: { id: 'royal_purple', name: 'Imperial Purple', hex: '#581c87', rare: true, price: 175 },
  burnished_bronze: { id: 'burnished_bronze', name: 'Gilded Bronze', hex: '#d97706', rare: true, price: 210 },
  bone_silver: { id: 'bone_silver', name: 'Moonlit Silver', hex: '#cbd5e1', rare: true, price: 190 },
};

export const FLAG_PATTERNS: { id: FlagPatternId; name: string; rare: boolean }[] = [
  { id: 'solid', name: 'Solid Standard', rare: false },
  { id: 'horizontal_bicolor', name: 'Horizontal Split', rare: false },
  { id: 'vertical_bicolor', name: 'Vertical Split', rare: false },
  { id: 'saltire', name: 'Naval Saltire', rare: false },
  { id: 'chevron', name: 'Corsair Chevron', rare: false },
  { id: 'bordered', name: 'Regal Border', rare: false },
  { id: 'quartered', name: 'Quartered Arms', rare: true },
  { id: 'striped', name: 'Deck Stripes', rare: true },
];

export const FLAG_EMBLEMS: Record<
  FlagEmblemId,
  { id: FlagEmblemId; name: string; rare: boolean; price: number }
> = {
  none: { id: 'none', name: 'Plain Banner', rare: false, price: 0 },
  anchor: { id: 'anchor', name: 'Mariner Anchor', rare: false, price: 0 },
  skull: { id: 'skull', name: 'Skull & Crossbones', rare: false, price: 0 },
  crossed_swords: { id: 'crossed_swords', name: 'Crossed Cutlasses', rare: false, price: 65 },
  crown: { id: 'crown', name: 'Sovereign Crown', rare: true, price: 180 },
  kraken: { id: 'kraken', name: 'Abyssal Kraken', rare: true, price: 240 },
  sunburst: { id: 'sunburst', name: 'Solar Compass', rare: false, price: 85 },
  trident: { id: 'trident', name: 'Sea Trident', rare: true, price: 160 },
  serpent: { id: 'serpent', name: 'Coiled Serpent', rare: true, price: 210 },
  dragon_crest: { id: 'dragon_crest', name: 'Legendary Leviathan Crest', rare: true, price: 320 },
};

export const FLAG_SHAPES: { id: FlagShape; name: string }[] = [
  { id: 'rectangle', name: 'Ensign Rectangle' },
  { id: 'swallowtail', name: 'Swallowtail Burgee' },
  { id: 'pennant', name: 'Tapered Pennant' },
  { id: 'burgee', name: 'Broad Admiral Jack' },
];

export const DEFAULT_CUSTOM_FLAG: CustomFlagConfig = {
  primaryDye: 'weathered_gray',
  secondaryDye: 'weathered_gray',
  accentDye: 'weathered_gray',
  pattern: 'solid',
  emblem: 'none',
  shape: 'rectangle',
  decorativeBorder: false,
};

export const PRE_CHOSEN_SHIP_NAMES: readonly string[] = [
  'Dawnbreaker',
  'Sea Sovereign',
  'Crimson Horizon',
  'Storm Petrel',
  'Golden Albatross',
  'Iron Trident',
  'Azure Voyager',
  'Black Corsair',
  'Starlight Brig',
  'Emerald Siren',
  'Tempest Crest',
  'Silver Leviathan',
  'Wandering Gull',
  'Sapphire Wake',
  'Sunfire Galleon',
  'Obsidian Tide',
  'Northward Star',
  'Windrunner',
  'Coral Vanguard',
  'Midnight Mariner',
  'Amber Osprey',
  'Highland Wave',
  'Crown Halcyon',
  'Saltborne Crest',
  'Thunderbird',
  'Jade Compass',
  'Mistral Cutter',
  'Harbor Valkyrie',
];

export const DEFAULT_PLAYER_SHIP_NAME = PRE_CHOSEN_SHIP_NAMES[0];

export function isValidPreChosenShipName(name: string | undefined | null): name is string {
  return typeof name === 'string' && PRE_CHOSEN_SHIP_NAMES.includes(name);
}

export function pickRandomShipName(
  exclude?: string | null,
  rand: () => number = Math.random
): string {
  const pool = exclude
    ? PRE_CHOSEN_SHIP_NAMES.filter((n) => n !== exclude)
    : [...PRE_CHOSEN_SHIP_NAMES];
  if (pool.length === 0) return DEFAULT_PLAYER_SHIP_NAME;
  return pool[Math.floor(rand() * pool.length)];
}

export function createEmptyInventory(): Inventory {
  return {
    wood: 0,
    iron: 0,
    rope: 0,
    cloth: 0,
    food: 0,
    water: 0,
    tools: 0,
    gunpowder: 0,
    cannonballs: 0,
    medicine: 0,
    rareMaterials: 0,
    advancedTimber: 0,
    reinforcedMetals: 0,
    specializedSailcloth: 0,
    decorativeMaterials: 0,
    cargo: 0,
    jewellery: 0,
    preciousDecor: 0,
    silk: 0,
    rareSpices: 0,
    fineFurniture: 0,
    paintings: 0,
    antiques: 0,
    luxuryGoods: 0,
    rareImports: 0,
  };
}

export function createStartingInventory(): Inventory {
  return {
    ...createEmptyInventory(),
    wood: 16,
    iron: 6,
    rope: 10,
    cloth: 8,
    food: 40,
    water: 42,
    tools: 2,
    gunpowder: 10,
    cannonballs: 12,
    medicine: 4,
    cargo: 1,
  };
}

export function getCargoWeight(inv: Inventory): number {
  let total = 0;
  for (const id of Object.keys(RESOURCE_DEFS) as ResourceId[]) {
    total += Math.max(0, inv[id] || 0) * RESOURCE_DEFS[id].weight;
  }
  return Math.round(total * 10) / 10;
}

export function getCargoCapacity(upgrades: ShipUpgrades): number {
  const hullBase = [0, 160, 270, 420, 620, 880, 1220, 1650][upgrades.hullTier] ?? 160;
  const storageBonus = (upgrades.storageTier - 1) * 110;
  const sizeBonus = upgrades.hullLengthBonus * 45 + upgrades.hullWidthBonus * 55;
  const deckBonus = upgrades.deckLevel * 75;
  return hullBase + storageBonus + sizeBonus + deckBonus;
}

export function getMaxCrewCapacity(upgrades: ShipUpgrades): number {
  const hullBase = [0, 12, 18, 28, 42, 60, 84, 115][upgrades.hullTier] ?? 12;
  const deckBonus = upgrades.deckLevel * 8;
  const lengthBonus = upgrades.hullLengthBonus * 3;
  return hullBase + deckBonus + lengthBonus;
}

export function getMaxCannonSlots(upgrades: ShipUpgrades): number {
  const hullSlots = [0, 2, 4, 8, 12, 18, 24, 32][upgrades.hullTier] ?? 2;
  const deckBonus = upgrades.deckLevel * 2;
  const lengthBonus = upgrades.hullLengthBonus * 2;
  return hullSlots + deckBonus + lengthBonus;
}

export interface WeaponSpec {
  id: WeaponType;
  name: string;
  damage: number;
  range: number;
  reloadTime: number;
  accuracy: number;
  weight: number;
  crewPerGun: number;
  minHullTier: number;
  goldCost: number;
  materialCost: Partial<Inventory>;
  description: string;
}

export const WEAPON_SPECS: Record<WeaponType, WeaponSpec> = {
  none: {
    id: 'none',
    name: 'Unarmed',
    damage: 0,
    range: 0,
    reloadTime: 6,
    accuracy: 0,
    weight: 0,
    crewPerGun: 0,
    minHullTier: 1,
    goldCost: 0,
    materialCost: {},
    description: 'No mounted ordnance.',
  },
  swivel: {
    id: 'swivel',
    name: 'Swivel Guns',
    damage: 11,
    range: 95,
    reloadTime: 3.1,
    accuracy: 0.8,
    weight: 4,
    crewPerGun: 1,
    minHullTier: 1,
    goldCost: 65,
    materialCost: { iron: 4, wood: 3 },
    description: 'Nimble rail-mounted defensive guns with rapid reload against nearby raiders.',
  },
  light: {
    id: 'light',
    name: 'Light 6-Pounder Cannons',
    damage: 19,
    range: 122,
    reloadTime: 4.1,
    accuracy: 0.74,
    weight: 7,
    crewPerGun: 2,
    minHullTier: 1,
    goldCost: 130,
    materialCost: { iron: 8, wood: 6 },
    description: 'Affordable broadside ordnance suited for sloops and early coastal cutters.',
  },
  medium: {
    id: 'medium',
    name: 'Medium 12-Pounder Cannons',
    damage: 31,
    range: 148,
    reloadTime: 5.0,
    accuracy: 0.72,
    weight: 11,
    crewPerGun: 2,
    minHullTier: 2,
    goldCost: 240,
    materialCost: { iron: 14, wood: 10, tools: 2 },
    description: 'Dependable workhorse artillery balancing reach, reload pace, and hull-cracking punch.',
  },
  carronade: {
    id: 'carronade',
    name: 'Short-Range Carronades',
    damage: 44,
    range: 106,
    reloadTime: 4.6,
    accuracy: 0.76,
    weight: 9,
    crewPerGun: 2,
    minHullTier: 2,
    goldCost: 295,
    materialCost: { iron: 18, wood: 8, tools: 2 },
    description: 'Devastating close-quarters smashers that shred enemy timbers at tight range.',
  },
  heavy: {
    id: 'heavy',
    name: 'Heavy 24-Pounder Cannons',
    damage: 49,
    range: 164,
    reloadTime: 6.2,
    accuracy: 0.68,
    weight: 16,
    crewPerGun: 3,
    minHullTier: 3,
    goldCost: 460,
    materialCost: { iron: 24, wood: 14, reinforcedMetals: 3 },
    description: 'Thundering heavy guns built to batter frigates and armored corsairs.',
  },
  longGun: {
    id: 'longGun',
    name: 'Long-Barrel Culverins',
    damage: 39,
    range: 215,
    reloadTime: 5.5,
    accuracy: 0.86,
    weight: 14,
    crewPerGun: 3,
    minHullTier: 3,
    goldCost: 580,
    materialCost: { iron: 20, wood: 12, rareMaterials: 4 },
    description: 'High-precision bronze culverins able to strike hostile ships before they close.',
  },
  advancedHeavy: {
    id: 'advancedHeavy',
    name: 'Advanced 36-Pounder Siege Guns',
    damage: 68,
    range: 185,
    reloadTime: 6.6,
    accuracy: 0.74,
    weight: 22,
    crewPerGun: 4,
    minHullTier: 5,
    goldCost: 1150,
    materialCost: { reinforcedMetals: 9, iron: 26, rareMaterials: 5 },
    description: 'Late-game capital ship batteries capable of shattering rival flagships.',
  },
  specialised: {
    id: 'specialised',
    name: 'Sovereign Abyssal Lance Cannons',
    damage: 82,
    range: 230,
    reloadTime: 5.4,
    accuracy: 0.88,
    weight: 20,
    crewPerGun: 4,
    minHullTier: 6,
    goldCost: 2200,
    materialCost: { reinforcedMetals: 14, rareMaterials: 8, decorativeMaterials: 4 },
    description: 'Masterwork rifled naval ordnance forged from rare alloys for supreme broadside supremacy.',
  },
};

export const WEAPON_LIST: WeaponSpec[] = (
  ['swivel', 'light', 'medium', 'carronade', 'heavy', 'longGun', 'advancedHeavy', 'specialised'] as WeaponType[]
).map((k) => WEAPON_SPECS[k]);

export function getEffectiveWeaponStats(upgrades: ShipUpgrades): {
  damage: number;
  range: number;
  reloadTime: number;
  accuracy: number;
} {
  const base = WEAPON_SPECS[upgrades.weaponType];
  const cu = upgrades.cannonUpgrades || { damageLvl: 1, accuracyLvl: 1, reloadLvl: 1, durabilityLvl: 1 };
  return {
    damage: Math.round(base.damage * (1 + (cu.damageLvl - 1) * 0.16)),
    range: Math.round(base.range * (1 + (cu.accuracyLvl - 1) * 0.06)),
    reloadTime: Math.max(1.8, Number((base.reloadTime * (1 - (cu.reloadLvl - 1) * 0.1)).toFixed(2))),
    accuracy: Math.min(0.96, Number((base.accuracy + (cu.accuracyLvl - 1) * 0.045).toFixed(3))),
  };
}

export function getCannonStatUpgradeCost(
  stat: keyof CannonUpgrades,
  currentLvl: number
): { goldCost: number; materialCost: Partial<Inventory>; maxReached: boolean } {
  if (currentLvl >= 4) return { goldCost: 0, materialCost: {}, maxReached: true };
  const mult = currentLvl === 1 ? 1 : currentLvl === 2 ? 2.4 : 5.2;
  const goldCost = Math.round((stat === 'damageLvl' ? 140 : stat === 'reloadLvl' ? 130 : 115) * mult);
  const materialCost: Partial<Inventory> =
    currentLvl === 1
      ? { iron: 6, tools: 1 }
      : currentLvl === 2
        ? { iron: 14, wood: 6, tools: 3 }
        : { reinforcedMetals: 7, iron: 18, rareMaterials: 4 };
  return { goldCost, materialCost, maxReached: false };
}

export function getInstallCannonCost(weaponType: WeaponType): { goldCost: number; materialCost: Partial<Inventory> } {
  const spec = WEAPON_SPECS[weaponType];
  return {
    goldCost: Math.max(45, Math.round(spec.goldCost * 0.55)),
    materialCost: Object.fromEntries(
      Object.entries(spec.materialCost).map(([k, v]) => [k, Math.max(1, Math.ceil((v || 0) * 0.6))])
    ) as Partial<Inventory>,
  };
}

export interface HullUpgradeOption {
  id: string;
  name: string;
  sectionLabel: 'Hull Tiers' | 'Dimensions & Decks' | 'Armor & Reinforcement' | 'Rigging, Helm & Facilities';
  description: string;
  unlockRequirementText: string;
  goldCost: number;
  resourceCost: Partial<Inventory>;
  isUnlocked: (u: ShipUpgrades) => boolean;
  isPurchased: (u: ShipUpgrades) => boolean;
  apply: (u: ShipUpgrades) => ShipUpgrades;
}

export const HULL_UPGRADE_CATALOG: HullUpgradeOption[] = [
  // HULL TIERS 2..7
  {
    id: 'hull_2',
    name: 'Tier 2: Coastal Cutter Hull',
    sectionLabel: 'Hull Tiers',
    description: 'Re-keel into a nimble cutter (270 cargo, 18 crew, 4 cannon ports).',
    unlockRequirementText: 'Requires Starter Skiff (Tier 1)',
    goldCost: 160,
    resourceCost: { wood: 26, iron: 8, cloth: 6 },
    isUnlocked: (u) => u.hullTier === 1,
    isPurchased: (u) => u.hullTier >= 2,
    apply: (u) => ({ ...u, hullTier: 2 }),
  },
  {
    id: 'hull_3',
    name: 'Tier 3: Brigantine Frame',
    sectionLabel: 'Hull Tiers',
    description: 'Full twin-masted brigantine hull (420 cargo, 28 crew, 8 cannon ports).',
    unlockRequirementText: 'Requires Tier 2 Hull',
    goldCost: 440,
    resourceCost: { wood: 48, iron: 20, rope: 18, tools: 3 },
    isUnlocked: (u) => u.hullTier === 2,
    isPurchased: (u) => u.hullTier >= 3,
    apply: (u) => ({ ...u, hullTier: 3 }),
  },
  {
    id: 'hull_4',
    name: 'Tier 4: Ocean Frigate',
    sectionLabel: 'Hull Tiers',
    description: 'Commanding war frigate (620 cargo, 42 crew, 12 cannon ports, strong wave poise).',
    unlockRequirementText: 'Requires Tier 3 Hull',
    goldCost: 980,
    resourceCost: { wood: 80, iron: 36, advancedTimber: 8, tools: 6, rareMaterials: 4 },
    isUnlocked: (u) => u.hullTier === 3,
    isPurchased: (u) => u.hullTier >= 4,
    apply: (u) => ({ ...u, hullTier: 4 }),
  },
  {
    id: 'hull_5',
    name: 'Tier 5: Heavy East Indiaman Galleon',
    sectionLabel: 'Hull Tiers',
    description: 'Deep-bellied ocean galleon (880 cargo, 60 crew, 18 cannon ports).',
    unlockRequirementText: 'Requires Tier 4 Hull',
    goldCost: 2250,
    resourceCost: { wood: 110, advancedTimber: 18, reinforcedMetals: 10, rareMaterials: 8 },
    isUnlocked: (u) => u.hullTier === 4,
    isPurchased: (u) => u.hullTier >= 5,
    apply: (u) => ({ ...u, hullTier: 5 }),
  },
  {
    id: 'hull_6',
    name: 'Tier 6: Ship of the Line',
    sectionLabel: 'Hull Tiers',
    description: 'Towering multi-tier warship (1,220 cargo, 84 crew, 24 cannon ports).',
    unlockRequirementText: 'Requires Tier 5 Hull',
    goldCost: 4800,
    resourceCost: { advancedTimber: 34, reinforcedMetals: 22, specializedSailcloth: 14, rareMaterials: 14 },
    isUnlocked: (u) => u.hullTier === 5,
    isPurchased: (u) => u.hullTier >= 6,
    apply: (u) => ({ ...u, hullTier: 6 }),
  },
  {
    id: 'hull_7',
    name: 'Tier 7: Grand Sovereign Flagship',
    sectionLabel: 'Hull Tiers',
    description: 'Colossal flagship ruling every sea (1,650+ cargo, 115+ crew, 32+ cannon ports).',
    unlockRequirementText: 'Requires Tier 6 Hull',
    goldCost: 9600,
    resourceCost: { advancedTimber: 55, reinforcedMetals: 38, rareMaterials: 24, decorativeMaterials: 16 },
    isUnlocked: (u) => u.hullTier === 6,
    isPurchased: (u) => u.hullTier >= 7,
    apply: (u) => ({ ...u, hullTier: 7 }),
  },

  // DIMENSIONS & DECKS
  {
    id: 'len_1',
    name: 'Lengthen Keel I (+14% Length)',
    sectionLabel: 'Dimensions & Decks',
    description: 'Extends hull length visually and adds +2 gun ports and +45 cargo.',
    unlockRequirementText: 'Available from Tier 1',
    goldCost: 140,
    resourceCost: { wood: 22, iron: 6 },
    isUnlocked: (u) => u.hullLengthBonus === 0,
    isPurchased: (u) => u.hullLengthBonus >= 1,
    apply: (u) => ({ ...u, hullLengthBonus: 1 }),
  },
  {
    id: 'len_2',
    name: 'Lengthen Keel II (+28% Length)',
    sectionLabel: 'Dimensions & Decks',
    description: 'Major keel extension with additional broadside length (+2 more gun ports).',
    unlockRequirementText: 'Requires Lengthen Keel I & Hull Tier 3+',
    goldCost: 620,
    resourceCost: { wood: 44, advancedTimber: 8, reinforcedMetals: 4 },
    isUnlocked: (u) => u.hullLengthBonus === 1 && u.hullTier >= 3,
    isPurchased: (u) => u.hullLengthBonus >= 2,
    apply: (u) => ({ ...u, hullLengthBonus: 2 }),
  },
  {
    id: 'len_3',
    name: 'Sovereign Keel III (+42% Length)',
    sectionLabel: 'Dimensions & Decks',
    description: 'Flagship-length spar deck extension (+2 gun ports, superior ocean poise).',
    unlockRequirementText: 'Requires Lengthen Keel II & Hull Tier 5+',
    goldCost: 1950,
    resourceCost: { advancedTimber: 24, reinforcedMetals: 12, rareMaterials: 8 },
    isUnlocked: (u) => u.hullLengthBonus === 2 && u.hullTier >= 5,
    isPurchased: (u) => u.hullLengthBonus >= 3,
    apply: (u) => ({ ...u, hullLengthBonus: 3 }),
  },
  {
    id: 'wid_1',
    name: 'Widen Beam I (+12% Width)',
    sectionLabel: 'Dimensions & Decks',
    description: 'Widens vessel beam visually, raising wave stability and +55 cargo.',
    unlockRequirementText: 'Available from Tier 1',
    goldCost: 135,
    resourceCost: { wood: 20, iron: 6 },
    isUnlocked: (u) => u.hullWidthBonus === 0,
    isPurchased: (u) => u.hullWidthBonus >= 1,
    apply: (u) => ({ ...u, hullWidthBonus: 1 }),
  },
  {
    id: 'wid_2',
    name: 'Widen Beam II (+24% Width)',
    sectionLabel: 'Dimensions & Decks',
    description: 'Heavy broad-beamed cargo and gun carriage profile (+55 cargo).',
    unlockRequirementText: 'Requires Widen Beam I & Hull Tier 3+',
    goldCost: 590,
    resourceCost: { wood: 38, advancedTimber: 6, reinforcedMetals: 4 },
    isUnlocked: (u) => u.hullWidthBonus === 1 && u.hullTier >= 3,
    isPurchased: (u) => u.hullWidthBonus >= 2,
    apply: (u) => ({ ...u, hullWidthBonus: 2 }),
  },
  {
    id: 'wid_3',
    name: 'Bastion Beam III (+36% Width)',
    sectionLabel: 'Dimensions & Decks',
    description: 'Immense multi-gun-deck stability across extreme storm swells.',
    unlockRequirementText: 'Requires Widen Beam II & Hull Tier 5+',
    goldCost: 1850,
    resourceCost: { advancedTimber: 20, reinforcedMetals: 12, rareMaterials: 6 },
    isUnlocked: (u) => u.hullWidthBonus === 2 && u.hullTier >= 5,
    isPurchased: (u) => u.hullWidthBonus >= 3,
    apply: (u) => ({ ...u, hullWidthBonus: 3 }),
  },
  {
    id: 'deck_1',
    name: 'Raised Quarterdeck (Deck I)',
    sectionLabel: 'Dimensions & Decks',
    description: 'Adds an elevated aft quarterdeck with helm house (+75 cargo, +8 crew, +2 ports).',
    unlockRequirementText: 'Available from Tier 1',
    goldCost: 230,
    resourceCost: { wood: 28, rope: 10, iron: 8 },
    isUnlocked: (u) => u.deckLevel === 0,
    isPurchased: (u) => u.deckLevel >= 1,
    apply: (u) => ({ ...u, deckLevel: 1 }),
  },
  {
    id: 'deck_2',
    name: 'Forecastle & Upper Gun Deck (Deck II)',
    sectionLabel: 'Dimensions & Decks',
    description: 'Constructs a full upper gun deck and raised bow forecastle (+75 cargo, +8 crew, +2 ports).',
    unlockRequirementText: 'Requires Deck I & Hull Tier 3+',
    goldCost: 780,
    resourceCost: { wood: 48, advancedTimber: 10, iron: 18, tools: 4 },
    isUnlocked: (u) => u.deckLevel === 1 && u.hullTier >= 3,
    isPurchased: (u) => u.deckLevel >= 2,
    apply: (u) => ({ ...u, deckLevel: 2 }),
  },
  {
    id: 'deck_3',
    name: 'Triple-Tier Admiral Poop Deck (Deck III)',
    sectionLabel: 'Dimensions & Decks',
    description: 'Towering gilded stern castle and upper captain’s walk (+75 cargo, +8 crew, +2 ports).',
    unlockRequirementText: 'Requires Deck II & Hull Tier 5+',
    goldCost: 2600,
    resourceCost: { advancedTimber: 28, reinforcedMetals: 14, decorativeMaterials: 10 },
    isUnlocked: (u) => u.deckLevel === 2 && u.hullTier >= 5,
    isPurchased: (u) => u.deckLevel >= 3,
    apply: (u) => ({ ...u, deckLevel: 3 }),
  },

  // ARMOR & REINFORCEMENT
  {
    id: 'reinf_1',
    name: 'Oak Rib Reinforcement I',
    sectionLabel: 'Armor & Reinforcement',
    description: 'External oak wales reducing ramming & storm hull wear by 12%.',
    unlockRequirementText: 'Available from Tier 1',
    goldCost: 115,
    resourceCost: { wood: 18, iron: 6 },
    isUnlocked: (u) => u.reinforcementTier === 0,
    isPurchased: (u) => u.reinforcementTier >= 1,
    apply: (u) => ({ ...u, reinforcementTier: 1 }),
  },
  {
    id: 'reinf_2',
    name: 'Copper-Clad Bulkheads II',
    sectionLabel: 'Armor & Reinforcement',
    description: 'Double-planked knees & iron braces cutting structural hits by 24%.',
    unlockRequirementText: 'Requires Reinforcement I & Tier 3+',
    goldCost: 480,
    resourceCost: { wood: 30, iron: 18, advancedTimber: 6 },
    isUnlocked: (u) => u.reinforcementTier === 1 && u.hullTier >= 3,
    isPurchased: (u) => u.reinforcementTier >= 2,
    apply: (u) => ({ ...u, reinforcementTier: 2 }),
  },
  {
    id: 'reinf_3',
    name: 'Sovereign Multi-Layer Timber III',
    sectionLabel: 'Armor & Reinforcement',
    description: 'Triple-layered seasoned teak ribs built to survive flagship broadsides.',
    unlockRequirementText: 'Requires Reinforcement II & Tier 5+',
    goldCost: 1700,
    resourceCost: { advancedTimber: 26, reinforcedMetals: 14, rareMaterials: 8 },
    isUnlocked: (u) => u.reinforcementTier === 2 && u.hullTier >= 5,
    isPurchased: (u) => u.reinforcementTier >= 3,
    apply: (u) => ({ ...u, reinforcementTier: 3 }),
  },
  {
    id: 'armor_1',
    name: 'Iron Hull Strakes I',
    sectionLabel: 'Armor & Reinforcement',
    description: 'Riveted iron hull bands reducing incoming cannon damage by 16%.',
    unlockRequirementText: 'Available from Tier 2+',
    goldCost: 240,
    resourceCost: { iron: 20, wood: 12, tools: 2 },
    isUnlocked: (u) => u.armorPlating === 0 && u.hullTier >= 2,
    isPurchased: (u) => u.armorPlating >= 1,
    apply: (u) => ({ ...u, armorPlating: 1 }),
  },
  {
    id: 'armor_2',
    name: 'Ironclad Bulwarks II',
    sectionLabel: 'Armor & Reinforcement',
    description: 'Heavy iron side plating reducing incoming cannon damage by 30%.',
    unlockRequirementText: 'Requires Armor I & Tier 3+',
    goldCost: 620,
    resourceCost: { iron: 36, reinforcedMetals: 6, tools: 4 },
    isUnlocked: (u) => u.armorPlating === 1 && u.hullTier >= 3,
    isPurchased: (u) => u.armorPlating >= 2,
    apply: (u) => ({ ...u, armorPlating: 2 }),
  },
  {
    id: 'armor_3',
    name: 'Steel Bastion Plating III',
    sectionLabel: 'Armor & Reinforcement',
    description: 'Interlocking steel plates reducing incoming damage by 44%.',
    unlockRequirementText: 'Requires Armor II & Tier 5+',
    goldCost: 1850,
    resourceCost: { reinforcedMetals: 18, iron: 40, rareMaterials: 8 },
    isUnlocked: (u) => u.armorPlating === 2 && u.hullTier >= 5,
    isPurchased: (u) => u.armorPlating >= 3,
    apply: (u) => ({ ...u, armorPlating: 3 }),
  },
  {
    id: 'armor_4',
    name: 'Dreadnought Citadel Armor IV',
    sectionLabel: 'Armor & Reinforcement',
    description: 'Impervious forged citadel belts cutting incoming damage by 58%.',
    unlockRequirementText: 'Requires Armor III & Tier 6+',
    goldCost: 4200,
    resourceCost: { reinforcedMetals: 32, rareMaterials: 16, decorativeMaterials: 6 },
    isUnlocked: (u) => u.armorPlating === 3 && u.hullTier >= 6,
    isPurchased: (u) => u.armorPlating >= 4,
    apply: (u) => ({ ...u, armorPlating: 4 }),
  },

  // RIGGING, HELM & FACILITIES
  {
    id: 'extra_mast',
    name: 'Second Mast & Fore-Rigging',
    sectionLabel: 'Rigging, Helm & Facilities',
    description: 'Steps an additional mast with full yardarms (+26% top speed).',
    unlockRequirementText: 'Available from Tier 1',
    goldCost: 210,
    resourceCost: { wood: 22, cloth: 16, rope: 16 },
    isUnlocked: (u) => !u.extraMast,
    isPurchased: (u) => u.extraMast,
    apply: (u) => ({ ...u, extraMast: true }),
  },
  {
    id: 'sail_2',
    name: 'Reinforced Storm Sails II',
    sectionLabel: 'Rigging, Helm & Facilities',
    description: 'Double-stitched canvas sails (+18% speed and stronger gale durability).',
    unlockRequirementText: 'Available from Tier 1',
    goldCost: 125,
    resourceCost: { cloth: 16, rope: 12 },
    isUnlocked: (u) => u.sailTier === 1,
    isPurchased: (u) => u.sailTier >= 2,
    apply: (u) => ({ ...u, sailTier: 2 }),
  },
  {
    id: 'sail_3',
    name: 'Clipper Silk-Weave Sails III',
    sectionLabel: 'Rigging, Helm & Facilities',
    description: 'Sleek ocean-racing canvas (+36% total sail bonus).',
    unlockRequirementText: 'Requires Storm Sails II',
    goldCost: 420,
    resourceCost: { cloth: 26, rope: 18, specializedSailcloth: 6 },
    isUnlocked: (u) => u.sailTier === 2,
    isPurchased: (u) => u.sailTier >= 3,
    apply: (u) => ({ ...u, sailTier: 3 }),
  },
  {
    id: 'sail_4',
    name: 'Tempest-Grade Silk Sails IV',
    sectionLabel: 'Rigging, Helm & Facilities',
    description: 'Specialised storm-weave canvas delivering peak flagship velocity.',
    unlockRequirementText: 'Requires Sail Tier III & Hull Tier 5+',
    goldCost: 1350,
    resourceCost: { specializedSailcloth: 20, rope: 28, rareMaterials: 6 },
    isUnlocked: (u) => u.sailTier === 3 && u.hullTier >= 5,
    isPurchased: (u) => u.sailTier >= 4,
    apply: (u) => ({ ...u, sailTier: 4 }),
  },
  {
    id: 'steer_2',
    name: 'Geared Helm & Rudder II',
    sectionLabel: 'Rigging, Helm & Facilities',
    description: 'Precision brass helm assembly (+24% turn authority).',
    unlockRequirementText: 'Available from Tier 1',
    goldCost: 115,
    resourceCost: { wood: 10, iron: 8, tools: 2 },
    isUnlocked: (u) => u.steeringTier === 1,
    isPurchased: (u) => u.steeringTier >= 2,
    apply: (u) => ({ ...u, steeringTier: 2 }),
  },
  {
    id: 'steer_3',
    name: 'Twin-Wheel Admiral Rudder III',
    sectionLabel: 'Rigging, Helm & Facilities',
    description: 'Balanced twin-wheel tackle for heavy frigates & galleons.',
    unlockRequirementText: 'Requires Helm II & Tier 3+',
    goldCost: 420,
    resourceCost: { wood: 18, iron: 16, reinforcedMetals: 4 },
    isUnlocked: (u) => u.steeringTier === 2 && u.hullTier >= 3,
    isPurchased: (u) => u.steeringTier >= 3,
    apply: (u) => ({ ...u, steeringTier: 3 }),
  },
  {
    id: 'store_2',
    name: 'Expanded Cargo Hold II',
    sectionLabel: 'Rigging, Helm & Facilities',
    description: 'Sub-deck cargo racks and casks (+110 cargo capacity).',
    unlockRequirementText: 'Available from Tier 1',
    goldCost: 105,
    resourceCost: { wood: 20, iron: 4 },
    isUnlocked: (u) => u.storageTier === 1,
    isPurchased: (u) => u.storageTier >= 2,
    apply: (u) => ({ ...u, storageTier: 2 }),
  },
  {
    id: 'store_3',
    name: 'Deep Merchant Hold III',
    sectionLabel: 'Rigging, Helm & Facilities',
    description: 'Partitioned dry-bulkhead racks (+110 additional cargo capacity).',
    unlockRequirementText: 'Requires Hold II',
    goldCost: 310,
    resourceCost: { wood: 36, iron: 12, tools: 3 },
    isUnlocked: (u) => u.storageTier === 2,
    isPurchased: (u) => u.storageTier >= 3,
    apply: (u) => ({ ...u, storageTier: 3 }),
  },
  {
    id: 'store_4',
    name: 'Grand Treasure Vault IV',
    sectionLabel: 'Rigging, Helm & Facilities',
    description: 'Copper-lined bullion hold (+110 more cargo capacity).',
    unlockRequirementText: 'Requires Hold III & Tier 4+',
    goldCost: 890,
    resourceCost: { advancedTimber: 14, reinforcedMetals: 8 },
    isUnlocked: (u) => u.storageTier === 3 && u.hullTier >= 4,
    isPurchased: (u) => u.storageTier >= 4,
    apply: (u) => ({ ...u, storageTier: 4 }),
  },
  {
    id: 'crows_nest',
    name: "Crow's Nest & Brass Spyglass",
    sectionLabel: 'Rigging, Helm & Facilities',
    description: 'Elevated lookout post boosting spotting & chart range by +45%.',
    unlockRequirementText: 'Available from Tier 1',
    goldCost: 135,
    resourceCost: { wood: 12, rope: 10, iron: 4 },
    isUnlocked: (u) => !u.crowsNest,
    isPurchased: (u) => u.crowsNest,
    apply: (u) => ({ ...u, crowsNest: true }),
  },
  {
    id: 'medical_bay',
    name: 'Surgeon Cabin & Sickbay',
    sectionLabel: 'Rigging, Helm & Facilities',
    description: 'Treats wounded sailors below deck and doubles resting recovery speed.',
    unlockRequirementText: 'Available from Tier 1',
    goldCost: 185,
    resourceCost: { wood: 18, cloth: 10, medicine: 4 },
    isUnlocked: (u) => !u.medicalBay,
    isPurchased: (u) => u.medicalBay,
    apply: (u) => ({ ...u, medicalBay: true }),
  },
  {
    id: 'repair_station',
    name: 'Carpenter Workshop',
    sectionLabel: 'Rigging, Helm & Facilities',
    description: 'Equipped bench speeding manual ship repairs by +40%.',
    unlockRequirementText: 'Available from Tier 1',
    goldCost: 170,
    resourceCost: { wood: 18, iron: 8, tools: 4 },
    isUnlocked: (u) => !u.repairStation,
    isPurchased: (u) => u.repairStation,
    apply: (u) => ({ ...u, repairStation: true }),
  },
];

export interface RepairPlan {
  section: RepairPriority;
  damageMissing: number;
  materials: Partial<Inventory>;
  durationSec: number;
}

export function computeManualRepairPlan(
  section: RepairPriority,
  condition: ShipCondition,
  upgrades: ShipUpgrades,
  repairCrewRating = 1.0
): RepairPlan {
  const currentVal = condition[section];
  const missing = Math.max(0, 100 - currentVal);
  if (missing < 0.5) {
    return { section, damageMissing: 0, materials: {}, durationSec: 0 };
  }

  const tierScale = 1 + (upgrades.hullTier - 1) * 0.22;
  const severity = Math.ceil((missing / 25) * tierScale);
  const materials: Partial<Inventory> = {};

  if (section === 'hull') {
    materials.wood = Math.max(2, severity * 2);
    materials.iron = Math.max(1, Math.ceil(severity * 0.7));
    if (upgrades.hullTier >= 5) materials.advancedTimber = Math.max(1, Math.floor(severity * 0.5));
  } else if (section === 'deck') {
    materials.wood = Math.max(2, severity * 2);
  } else if (section === 'mast') {
    materials.wood = Math.max(2, Math.ceil(severity * 1.5));
    materials.rope = Math.max(1, severity);
  } else if (section === 'sails') {
    materials.cloth = Math.max(2, severity * 2);
    if (upgrades.sailTier >= 3) materials.rope = Math.max(1, severity);
  } else if (section === 'cannons' || section === 'steering') {
    materials.iron = Math.max(2, Math.ceil(severity * 1.5));
    materials.wood = Math.max(1, Math.floor(severity * 0.6));
  }

  const workshopBonus = upgrades.repairStation ? 0.7 : 1.0;
  const durationSec = Math.max(
    2.5,
    Math.min(18, Number(((1.8 + missing * 0.11) * workshopBonus / Math.max(0.6, repairCrewRating)).toFixed(1)))
  );

  return {
    section,
    damageMissing: Math.round(missing),
    materials,
    durationSec,
  };
}

export function createRepairJob(plan: RepairPlan): ManualRepairJob {
  return {
    section: plan.section,
    remainingTime: plan.durationSec,
    totalTime: plan.durationSec,
    restoreAmount: 100,
  };
}

export function canAffordCosts(
  gold: number,
  inventory: Inventory,
  goldCost: number,
  resourceCost: Partial<Inventory>
): boolean {
  if (gold < goldCost) return false;
  for (const [key, qty] of Object.entries(resourceCost) as [ResourceId, number][]) {
    if ((inventory[key] || 0) < (qty || 0)) return false;
  }
  return true;
}

export function deductCosts(
  gold: number,
  inventory: Inventory,
  goldCost: number,
  resourceCost: Partial<Inventory>
): { gold: number; inventory: Inventory } {
  const nextInv: Inventory = { ...inventory };
  for (const [key, qty] of Object.entries(resourceCost) as [ResourceId, number][]) {
    nextInv[key] = Math.max(0, (nextInv[key] || 0) - (qty || 0));
  }
  return { gold: gold - goldCost, inventory: nextInv };
}

export function getMerchantBuyPrice(
  merchant: MerchantShipData,
  id: ResourceId,
  playerReputation = 0
): number {
  const def = RESOURCE_DEFS[id];
  const base = def.basePrice;
  const mult = merchant.priceMultipliers[id] ?? 1.0;
  const stock = merchant.stock[id] || 0;
  const scarcity = stock <= 3 ? 1.18 : stock >= 25 ? 0.9 : 1.0;
  const repPolicy = getMerchantReputationBehavior(playerReputation, merchant.isCrown, merchant);
  return Math.max(2, Math.round(base * mult * scarcity * repPolicy.priceMultiplier));
}

export function getMerchantSellPrice(
  merchant: MerchantShipData,
  id: ResourceId,
  playerReputation = 0
): number {
  const def = RESOURCE_DEFS[id];
  const base = def.basePrice;
  const mult = merchant.priceMultipliers[id] ?? 1.0;
  const ratio = def.isValuableCargo || id === 'rareMaterials' || id === 'decorativeMaterials' ? 0.84 : 0.64;
  const repMult = playerReputation >= 35 ? 1.08 : playerReputation <= -20 ? 0.78 : 1.0;
  const buyAtSameMerchant = getMerchantBuyPrice(merchant, id, playerReputation);
  // Strict anti-arbitrage guarantee: selling back to the same captain never yields more than buying from them
  return Math.min(Math.max(1, buyAtSameMerchant - 1), Math.max(1, Math.round(base * mult * ratio * repMult)));
}

export interface TradeResult {
  ok: boolean;
  error?: string;
  playerGold: number;
  playerInventory: Inventory;
  merchantGold: number;
  merchantStock: Inventory;
  totalPrice: number;
}

export function isItemAllowedForMerchant(merchant: MerchantShipData, id: ResourceId): boolean {
  if (merchant.isFishingTrawler) {
    return id === 'food' || id === 'water';
  }
  return true;
}

export function executeTrade(
  mode: 'buy' | 'sell',
  resourceId: ResourceId,
  quantity: number,
  playerGold: number,
  playerInventory: Inventory,
  playerUpgrades: ShipUpgrades,
  merchant: MerchantShipData,
  playerReputation = 0
): TradeResult {
  const qty = Math.floor(quantity);
  if (qty <= 0) {
    return {
      ok: false,
      error: 'Select a quantity greater than zero.',
      playerGold,
      playerInventory,
      merchantGold: merchant.gold,
      merchantStock: merchant.stock,
      totalPrice: 0,
    };
  }

  if (!isItemAllowedForMerchant(merchant, resourceId)) {
    return {
      ok: false,
      error: 'Fishing trawlers only carry and trade Provisions and Fresh Water.',
      playerGold,
      playerInventory,
      merchantGold: merchant.gold,
      merchantStock: merchant.stock,
      totalPrice: 0,
    };
  }

  const repPolicy = getMerchantReputationBehavior(playerReputation, merchant.isCrown, merchant);
  if (!repPolicy.willTrade) {
    return {
      ok: false,
      error: repPolicy.refusalReason || 'This vessel refuses to trade with you.',
      playerGold,
      playerInventory,
      merchantGold: merchant.gold,
      merchantStock: merchant.stock,
      totalPrice: 0,
    };
  }

  if (mode === 'buy') {
    const unitPrice = getMerchantBuyPrice(merchant, resourceId, playerReputation);
    const totalPrice = unitPrice * qty;
    if ((merchant.stock[resourceId] || 0) < qty) {
      return {
        ok: false,
        error: 'Merchant does not have enough stock.',
        playerGold,
        playerInventory,
        merchantGold: merchant.gold,
        merchantStock: merchant.stock,
        totalPrice,
      };
    }
    if (playerGold < totalPrice) {
      return {
        ok: false,
        error: 'Not enough gold for this purchase.',
        playerGold,
        playerInventory,
        merchantGold: merchant.gold,
        merchantStock: merchant.stock,
        totalPrice,
      };
    }
    const addedWeight = RESOURCE_DEFS[resourceId].weight * qty;
    const cap = getCargoCapacity(playerUpgrades);
    if (getCargoWeight(playerInventory) + addedWeight > cap + 0.01) {
      return {
        ok: false,
        error: 'Not enough space in your cargo hold.',
        playerGold,
        playerInventory,
        merchantGold: merchant.gold,
        merchantStock: merchant.stock,
        totalPrice,
      };
    }

    const nextPlayerInv = { ...playerInventory, [resourceId]: (playerInventory[resourceId] || 0) + qty };
    const nextMerchStock = { ...merchant.stock, [resourceId]: (merchant.stock[resourceId] || 0) - qty };
    return {
      ok: true,
      playerGold: playerGold - totalPrice,
      playerInventory: nextPlayerInv,
      merchantGold: merchant.gold + totalPrice,
      merchantStock: nextMerchStock,
      totalPrice,
    };
  } else {
    const unitPrice = getMerchantSellPrice(merchant, resourceId, playerReputation);
    const totalPrice = unitPrice * qty;
    if ((playerInventory[resourceId] || 0) < qty) {
      return {
        ok: false,
        error: 'You do not carry that many units.',
        playerGold,
        playerInventory,
        merchantGold: merchant.gold,
        merchantStock: merchant.stock,
        totalPrice,
      };
    }
    if (merchant.gold < totalPrice) {
      return {
        ok: false,
        error: 'Vessel lacks enough gold coin to buy this lot.',
        playerGold,
        playerInventory,
        merchantGold: merchant.gold,
        merchantStock: merchant.stock,
        totalPrice,
      };
    }

    const nextPlayerInv = { ...playerInventory, [resourceId]: (playerInventory[resourceId] || 0) - qty };
    const nextMerchStock = { ...merchant.stock, [resourceId]: (merchant.stock[resourceId] || 0) + qty };
    return {
      ok: true,
      playerGold: playerGold + totalPrice,
      playerInventory: nextPlayerInv,
      merchantGold: merchant.gold - totalPrice,
      merchantStock: nextMerchStock,
      totalPrice,
    };
  }
}

const WRECK_CONFIG: Record<
  WreckArchetype,
  {
    titles: string[];
    goldRange: [number, number];
    scale: number;
    sinkDepth: number;
    sectionCount: number;
    survivorChance: number;
    emptyRoomChance: number;
    lootBias: ResourceId[];
  }
> = {
  fishing_boat: {
    titles: ['Sunken Skiff', 'Drifting Trawler', 'Broken Fishing Dory'],
    goldRange: [0, 26],
    scale: 0.72,
    sinkDepth: 0.35,
    sectionCount: 2,
    survivorChance: 0.25,
    emptyRoomChance: 0.28,
    lootBias: ['wood', 'rope', 'food', 'water'],
  },
  abandoned_sloop: {
    titles: ['Abandoned Sloop', 'Derelict Cutter', 'Capsized Mail Boat'],
    goldRange: [12, 68],
    scale: 0.92,
    sinkDepth: 0.45,
    sectionCount: 3,
    survivorChance: 0.38,
    emptyRoomChance: 0.22,
    lootBias: ['wood', 'cloth', 'rope', 'food', 'water', 'medicine'],
  },
  merchant_vessel: {
    titles: ['Wrecked Merchantman', 'Stranded Spice Bark', 'Shattered Barque'],
    goldRange: [65, 320],
    scale: 1.28,
    sinkDepth: 0.6,
    sectionCount: 4,
    survivorChance: 0.45,
    emptyRoomChance: 0.2,
    lootBias: ['wood', 'cloth', 'cargo', 'food', 'water', 'iron', 'tools'],
  },
  trading_galleon: {
    titles: ['East Indiaman Wreck', 'Great Trading Galleon', 'Foundered Carrack'],
    goldRange: [240, 860],
    scale: 1.65,
    sinkDepth: 0.75,
    sectionCount: 6,
    survivorChance: 0.52,
    emptyRoomChance: 0.18,
    lootBias: ['cargo', 'rareMaterials', 'advancedTimber', 'wood', 'iron', 'specializedSailcloth', 'tools'],
  },
  military_frigate: {
    titles: ['Shattered Naval Frigate', 'Burned Man-of-War', 'Broadside Wreck'],
    goldRange: [140, 560],
    scale: 1.6,
    sinkDepth: 0.7,
    sectionCount: 6,
    survivorChance: 0.42,
    emptyRoomChance: 0.2,
    lootBias: ['reinforcedMetals', 'gunpowder', 'cannonballs', 'iron', 'medicine', 'rareImports'],
  },
  pirate_wreck: {
    titles: ['Scuttled Corsair', 'Black-Flagged Hulk', 'Raider Wreckage'],
    goldRange: [95, 450],
    scale: 1.35,
    sinkDepth: 0.55,
    sectionCount: 5,
    survivorChance: 0.3,
    emptyRoomChance: 0.22,
    lootBias: ['gunpowder', 'cannonballs', 'cargo', 'jewellery', 'rareSpices', 'rope', 'food'],
  },
  cargo_hulk: {
    titles: ['Waterlogged Freighter', 'Split Timber Barge', 'Supply Hulk'],
    goldRange: [45, 220],
    scale: 1.42,
    sinkDepth: 0.85,
    sectionCount: 4,
    survivorChance: 0.35,
    emptyRoomChance: 0.24,
    lootBias: ['wood', 'iron', 'rope', 'cloth', 'food', 'water', 'tools'],
  },
  storm_sunken: {
    titles: ['Tempest-Torn Hull', 'Submerged Schooner', 'Half-Sunk Brig'],
    goldRange: [30, 180],
    scale: 1.18,
    sinkDepth: 1.25,
    sectionCount: 4,
    survivorChance: 0.48,
    emptyRoomChance: 0.25,
    lootBias: ['wood', 'rope', 'water', 'medicine', 'iron', 'specializedSailcloth'],
  },
  treasure_galleon: {
    titles: ['Gilded Bullion Galleon', 'Sovereign Treasure Wreck', 'Crown Specie Ship'],
    goldRange: [950, 2600],
    scale: 1.85,
    sinkDepth: 0.9,
    sectionCount: 8,
    survivorChance: 0.4,
    emptyRoomChance: 0.14,
    lootBias: ['jewellery', 'antiques', 'paintings', 'rareMaterials', 'decorativeMaterials', 'reinforcedMetals'],
  },
  enormous_merchant: {
    titles: ['Enormous East Indiaman', 'Colossal Trade Carrack', 'Levant Grand Merchant'],
    goldRange: [420, 1850],
    scale: 2.15,
    sinkDepth: 0.92,
    sectionCount: 9,
    survivorChance: 0.58,
    emptyRoomChance: 0.22,
    lootBias: ['silk', 'rareSpices', 'fineFurniture', 'luxuryGoods', 'advancedTimber', 'specializedSailcloth'],
  },
  massive_warship: {
    titles: ['Massive First-Rate Warship', 'Sunken Dread Man-of-War', 'Colossal Royal Bastion'],
    goldRange: [340, 1650],
    scale: 2.38,
    sinkDepth: 1.02,
    sectionCount: 10,
    survivorChance: 0.54,
    emptyRoomChance: 0.2,
    lootBias: ['reinforcedMetals', 'gunpowder', 'cannonballs', 'iron', 'preciousDecor', 'medicine'],
  },
  gigantic_wreck: {
    titles: ['Gigantic Armada Hulk', 'Leviathan Sovereign Derelict', 'Titan Fleet Flagship Wreck'],
    goldRange: [650, 3200],
    scale: 2.68,
    sinkDepth: 1.12,
    sectionCount: 12,
    survivorChance: 0.65,
    emptyRoomChance: 0.22,
    lootBias: ['antiques', 'paintings', 'jewellery', 'rareMaterials', 'decorativeMaterials', 'advancedTimber', 'reinforcedMetals'],
  },
  ghost_wreck: {
    titles: ['Shattered Spectral Hulk', 'Haunted Phantom Derelict', 'Abyssal Wraith Wreck'],
    goldRange: [250, 1400],
    scale: 1.5,
    sinkDepth: 0.55,
    sectionCount: 5,
    survivorChance: 0.15,
    emptyRoomChance: 0.16,
    lootBias: ['rareMaterials', 'decorativeMaterials', 'antiques', 'jewellery', 'reinforcedMetals'],
  },
};

const SECTION_TEMPLATES = [
  {
    name: 'Main Deck',
    description: 'Splintered upper planks, tangled ratlines, and lashed deck chests awash in spray.',
    duration: 2.0,
    danger: 'Low' as const,
    note: 'Slick wet timber and swinging boom spars.',
  },
  {
    name: 'Lower Deck',
    description: 'Half-submerged gun deck smelling of brine, soaked oak, and shifted ballast.',
    duration: 2.6,
    danger: 'Moderate' as const,
    note: 'Creaking hull ribs swell overhead.',
  },
  {
    name: "Captain's Cabin",
    description: 'Shattered stern gallery windows, mahogany map table, and a brass-locked strongbox.',
    duration: 3.4,
    danger: 'Moderate' as const,
    note: 'Listing stern groans heavily in the swell.',
  },
  {
    name: 'Officer Quarters',
    description: 'Cramped berth lockers with brass instruments, navigation ledgers, and personal trunks.',
    duration: 2.8,
    danger: 'Low' as const,
    note: 'Loose bulkhead doors swing with every wave.',
  },
  {
    name: 'Cargo Hold A',
    description: 'Forward freight bay stacked with strapped trade crates and tarpaulin bundles.',
    duration: 3.1,
    danger: 'Moderate' as const,
    note: 'Waterlogged pallets may slide unexpectedly.',
  },
  {
    name: 'Cargo Hold B',
    description: 'Deep aft freight hold containing iron-banded barrels and heavy timber stores.',
    duration: 3.3,
    danger: 'Moderate' as const,
    note: 'Narrow passageways risk falling cargo.',
  },
  {
    name: 'Galley / Kitchen',
    description: 'Copper kettles, salted provision casks, and fresh water breakers near the cold hearth.',
    duration: 2.2,
    danger: 'Low' as const,
    note: 'Rusted cleavers and broken crockery underfoot.',
  },
  {
    name: 'Crew Quarters',
    description: 'Rows of damp hammocks, sea bags, and modest sailor keepsakes along the ribs.',
    duration: 2.4,
    danger: 'Low' as const,
    note: 'Often picked clean before abandonment.',
  },
  {
    name: 'Armory / Weapon Storage',
    description: 'Barred oak racks holding shot boxes, dry powder kegs, and forged weapon fittings.',
    duration: 3.6,
    danger: 'High' as const,
    note: 'Volatile powder residue and heavy iron shot chests.',
  },
  {
    name: 'Navigation Room',
    description: 'Brass sextants, storm charts, spyglasses, and waterproofed log canisters.',
    duration: 2.9,
    danger: 'Low' as const,
    note: 'Shattered compass glass across the floor.',
  },
  {
    name: 'Treasure Vault',
    description: 'Iron-studded strongroom bolted beneath the keel beams for specie and bullion.',
    duration: 4.1,
    danger: 'High' as const,
    note: 'Jammed iron hatchway and rising surge pressure.',
  },
  {
    name: 'Hidden Smuggler Compartment',
    description: 'A false bulkhead behind the ballast stones hiding sealed contraband boxes.',
    duration: 4.4,
    danger: 'High' as const,
    note: 'Collapsing false ribs risk severe crew injury.',
  },
];

const SURVIVOR_INFO_TIPS = [
  '“A wealthy East Indiaman convoy was sighted sailing with heavy Crown escorts.”',
  '“Beware thick fog banks in the deep sea — sailors whisper of a Ghost Ship drifting there.”',
  '“Crown warships and Pirate Flagships have been clashing in pitched battles out past the trench.”',
  '“Word along the trade lanes travels fast. Defending innocent vessels earns Crown favors.”',
];

export function generateShipwreck(
  id: string,
  x: number,
  z: number,
  archetype: WreckArchetype,
  rand: () => number
): ShipwreckData {
  const cfg = WRECK_CONFIG[archetype];
  const name = cfg.titles[Math.floor(rand() * cfg.titles.length)];
  // Not every wreck (even larger ones) is richly stocked — occasional barren derelicts keep exploration honest
  const sparseWreck = rand() < (archetype === 'treasure_galleon' ? 0.05 : 0.14);
  const totalGold =
    (rand() < 0.14 && archetype === 'fishing_boat') || sparseWreck
      ? Math.round(cfg.goldRange[0] * 0.25)
      : Math.round(cfg.goldRange[0] + rand() * (cfg.goldRange[1] - cfg.goldRange[0]));

  const sections: WreckSection[] = [];
  let remainingGold = totalGold;
  const hasSurvivor = rand() < cfg.survivorChance;
  const survivorSectionIdx = hasSurvivor ? Math.floor(rand() * cfg.sectionCount) : -1;

  for (let i = 0; i < cfg.sectionCount; i++) {
    const tmpl = SECTION_TEMPLATES[i % SECTION_TEMPLATES.length];
    const isLast = i === cfg.sectionCount - 1;
    const isEmpty =
      i !== survivorSectionIdx &&
      !(isLast && totalGold > 0 && remainingGold > 0) &&
      rand() < cfg.emptyRoomChance;

    const secGold = isEmpty
      ? 0
      : isLast
        ? remainingGold
        : Math.round(remainingGold * (0.12 + rand() * 0.28));
    remainingGold = Math.max(0, remainingGold - secGold);

    const loot: Partial<Inventory> = {};
    if (!isEmpty) {
      const numResourceTypes = 1 + Math.floor(rand() * 3);
      for (let r = 0; r < numResourceTypes; r++) {
        const resId = cfg.lootBias[Math.floor(rand() * cfg.lootBias.length)];
        const isSpecial =
          Boolean(RESOURCE_DEFS[resId].isValuableCargo) ||
          resId === 'rareMaterials' ||
          resId === 'tools' ||
          resId === 'advancedTimber' ||
          resId === 'reinforcedMetals' ||
          resId === 'specializedSailcloth' ||
          resId === 'decorativeMaterials';
        const baseQty = isSpecial ? 1 + Math.floor(rand() * 3) : 3 + Math.floor(rand() * 9);
        loot[resId] = (loot[resId] || 0) + baseQty;
      }
    }

    let survivor: WreckSurvivor | undefined;
    if (i === survivorSectionIdx) {
      const sample = createRandomCrewMember(`surv_${id}_${i}`, rand);
      const dispRoll = rand();
      const disposition: WreckSurvivor['disposition'] =
        dispRoll < 0.34
          ? 'eager'
          : dispRoll < 0.56
            ? 'needs_food'
            : dispRoll < 0.74
              ? 'needs_medicine'
              : dispRoll < 0.88
                ? 'gives_info'
                : 'reluctant';
      survivor = {
        id: `surv_${id}_${i}`,
        name: sample.name,
        skills: sample.skills,
        disposition,
        demandAmount: disposition === 'needs_food' ? 6 : disposition === 'needs_medicine' ? 1 : 0,
        resolved: false,
        infoText: SURVIVOR_INFO_TIPS[Math.floor(rand() * SURVIVOR_INFO_TIPS.length)],
      };
    }

    sections.push({
      id: `${id}_sec_${i}`,
      name: tmpl.name,
      description: tmpl.description,
      searchDuration: tmpl.duration,
      dangerLevel: tmpl.danger,
      dangerNote: tmpl.note,
      searched: false,
      emptyRoom: isEmpty && secGold === 0 && Object.keys(loot).length === 0,
      gold: secGold,
      loot,
      survivor,
    });
  }

  return {
    id,
    name,
    archetype,
    x,
    z,
    rotation: rand() * Math.PI * 2,
    sinkDepth: cfg.sinkDepth + (rand() - 0.5) * 0.25,
    scale: cfg.scale * (0.94 + rand() * 0.16),
    discovered: false,
    fullyLooted: false,
    sections,
  };
}

const GHOST_SECTIONS = [
  { name: 'Spectral Quarterdeck', desc: 'Rime-frosted helm wheel glowing with cold turquoise lantern light.', danger: 'Moderate' as const },
  { name: 'Cursed Gun Deck', desc: 'Barnacle-encrusted phantom cannons surrounded by drifting sea mist.', danger: 'High' as const },
  { name: 'Ghost Captain’s Stateroom', desc: 'A suspended astrolabe and salt-warped map chest humming with echoes.', danger: 'High' as const },
  { name: 'Wraith Crew Berths', desc: 'Torn hammocks swaying without wind beside locked sea trunks.', danger: 'Moderate' as const },
  { name: 'Abyssal Cargo Hold', desc: 'Sunken chests dripping pale brine stacked with silk and gilt antiquities.', danger: 'Moderate' as const },
  { name: 'Spectral Vault', desc: 'Iron-bound strongroom sealed in translucent sea-ice and ancient runes.', danger: 'High' as const },
  { name: 'Submerged Galley', desc: 'Silent copper cauldrons and sealed casks floating along tilted beams.', danger: 'Low' as const },
  { name: 'Phantom Observatory', desc: 'Cracked stained-glass ports revealing ghostly compass needles.', danger: 'High' as const },
  { name: 'Lower Ballast Crypt', desc: 'Deep ribbed hull holding bullion bars and forgotten warship relics.', danger: 'High' as const },
  { name: 'Drowned Signal Locker', desc: 'Ether-lit lanterns, rare pigments, and carved phantom woodwork.', danger: 'Moderate' as const },
  { name: 'Sovereign Abyssal Sanctum', desc: 'Towering inner stern gallery brimming with cursed gold and spectral artifacts.', danger: 'High' as const },
  { name: 'Hidden Smuggler Bilge', desc: 'Concealed panel packed with jewels, paintings, and gilded treasures.', danger: 'High' as const },
  { name: 'Forecastle Look-Post', desc: 'Shattered bowsprit locker catching wisps of unnatural fog.', danger: 'Low' as const },
  { name: 'Sunken Armory', desc: 'Temper-forged bronze strakes and reinforced naval fittings.', danger: 'Moderate' as const },
];

const GHOST_RELICS = [
  'Spectral Lantern',
  'Whispering Compass',
  'Phantom Figurehead',
  'Ancient Ghost Relic',
];

export function generateGhostShipWreck(
  ghost: PirateShipData,
  rand: () => number
): ShipwreckData {
  const size: GhostSizeTier = ghost.ghostSize ?? 'medium';
  const spec = {
    small: { minSec: 2, maxSec: 4, minGold: 100, maxGold: 250, scale: 1.05, relicChance: 0.35 },
    medium: { minSec: 4, maxSec: 6, minGold: 250, maxGold: 700, scale: 1.45, relicChance: 0.55 },
    large: { minSec: 7, maxSec: 10, minGold: 700, maxGold: 1800, scale: 2.05, relicChance: 0.78 },
    enormous: { minSec: 9, maxSec: 12, minGold: 1500, maxGold: 3500, scale: 2.75, relicChance: 0.92 },
    colossal: { minSec: 10, maxSec: 14, minGold: 1800, maxGold: 5200, scale: 3.65, relicChance: 1.0 },
  }[size];

  const sectionCount =
    spec.minSec + Math.floor(rand() * (spec.maxSec - spec.minSec + 1));
  const totalGold = Math.round(
    spec.minGold + rand() * (spec.maxGold - spec.minGold)
  );
  let remainingGold = totalGold;

  const relicRoomIdx = rand() < spec.relicChance ? Math.min(sectionCount - 1, Math.floor(rand() * sectionCount)) : -1;
  const relicName =
    ghost.ghostCollectible || GHOST_RELICS[Math.floor(rand() * GHOST_RELICS.length)];

  const ghostPool: ResourceId[] = [
    'rareMaterials',
    'decorativeMaterials',
    'advancedTimber',
    'reinforcedMetals',
    'specializedSailcloth',
    'jewellery',
    'antiques',
    'paintings',
    'preciousDecor',
    'silk',
    'luxuryGoods',
  ];

  const sections: WreckSection[] = [];
  for (let i = 0; i < sectionCount; i++) {
    const tmpl = GHOST_SECTIONS[i % GHOST_SECTIONS.length];
    const isLast = i === sectionCount - 1;
    const isEmpty = i !== relicRoomIdx && !isLast && rand() < 0.14;
    const secGold = isEmpty
      ? 0
      : isLast
        ? remainingGold
        : Math.round(remainingGold * (0.12 + rand() * 0.25));
    remainingGold = Math.max(0, remainingGold - secGold);

    const loot: Partial<Inventory> = {};
    if (!isEmpty) {
      const typesCount = size === 'colossal' || size === 'enormous' ? 3 : 2;
      for (let t = 0; t < typesCount; t++) {
        const res = ghostPool[Math.floor(rand() * ghostPool.length)];
        const qty =
          size === 'small'
            ? 1 + Math.floor(rand() * 2)
            : size === 'medium'
              ? 1 + Math.floor(rand() * 3)
              : 2 + Math.floor(rand() * 4);
        loot[res] = (loot[res] || 0) + qty;
      }
    }

    sections.push({
      id: `${ghost.id}_gsec_${i}`,
      name: sectionCount > GHOST_SECTIONS.length && i >= GHOST_SECTIONS.length ? `${tmpl.name} II` : tmpl.name,
      description: tmpl.desc,
      searchDuration: 2.4 + (i % 3) * 0.7,
      dangerLevel: tmpl.danger,
      dangerNote: 'Unnatural freezing mist and shifting ghostly timbers.',
      searched: false,
      emptyRoom: isEmpty && secGold === 0 && Object.keys(loot).length === 0,
      gold: secGold,
      loot,
      collectible: i === relicRoomIdx ? relicName : undefined,
    });
  }

  return {
    id: `ghost_wreck_${ghost.id}`,
    name: `${ghost.name} (Shattered Phantom)`,
    archetype: 'ghost_wreck',
    isGhostWreck: true,
    ghostSize: size,
    spawnedFromShipId: ghost.id,
    x: ghost.x,
    z: ghost.z,
    rotation: ghost.heading,
    sinkDepth: 0.48,
    scale: spec.scale,
    discovered: true,
    fullyLooted: false,
    sections,
  };
}

export function rollCrewOfferAccepted(choice: 'accept' | 'force', rand: () => number): boolean {
  if (choice === 'force') return true;
  return rand() >= 0.5;
}

export function generateSunkenVesselWreck(
  source: { kind: 'pirate'; ship: PirateShipData } | { kind: 'merchant'; ship: MerchantShipData },
  rand: () => number
): ShipwreckData {
  if (source.kind === 'pirate' && source.ship.isGhost) {
    return generateGhostShipWreck(source.ship, rand);
  }

  const isCharred =
    source.kind === 'pirate'
      ? !source.ship.isGhost && source.ship.salvageable === false
      : source.ship.salvageable === false;

  let archetype: WreckArchetype = 'merchant_vessel';
  let sectionCount = 4;
  let scale = 1.25;
  let totalGold = 0;
  const cargoPool: Array<{ id: ResourceId; qty: number }> = [];
  let survivor: WreckSurvivor | undefined;

  if (source.kind === 'pirate') {
    const p = source.ship;
    if (p.tier === 'sloop') {
      archetype = 'pirate_wreck';
      sectionCount = 3;
      scale = 1.02;
    } else if (p.tier === 'brigantine') {
      archetype = 'pirate_wreck';
      sectionCount = 5;
      scale = 1.32;
    } else if (p.tier === 'galleon') {
      archetype = 'massive_warship';
      sectionCount = 7;
      scale = 1.75;
    } else {
      archetype = 'massive_warship';
      sectionCount = 10;
      scale = 2.15;
    }

    totalGold = Math.max(20, Math.round(p.gold));
    for (const [rId, qty] of Object.entries(p.loot) as [ResourceId, number][]) {
      if (qty > 0 && RESOURCE_DEFS[rId]) {
        cargoPool.push({ id: rId, qty });
      }
    }
    cargoPool.push({ id: 'wood', qty: 4 + Math.floor(rand() * 6) });
    if (p.survivor) {
      if (!p.survivor.resolved) {
        survivor = { ...p.survivor };
      }
    } else if (p.crewCount > 0 && rand() < 0.42) {
      const sample = createRandomCrewMember(`sunk_surv_${p.id}`, rand);
      survivor = {
        id: `sunk_surv_${p.id}`,
        name: sample.name,
        skills: sample.skills,
        disposition: rand() < 0.5 ? 'reluctant' : 'eager',
        demandAmount: 0,
        resolved: false,
        infoText: SURVIVOR_INFO_TIPS[Math.floor(rand() * SURVIVOR_INFO_TIPS.length)],
      };
    }
  } else {
    const m = source.ship;
    const vc = m.vesselClass;
    if (vc === 'fishing_boat' || vc === 'fishing_trawler') {
      archetype = 'fishing_boat';
      sectionCount = vc === 'fishing_trawler' ? 3 : 2;
      scale = vc === 'fishing_trawler' ? 1.15 : 0.92;
    } else if (vc === 'small_merchant' || vc === 'crown_patrol' || vc === 'crown_sloop') {
      archetype = m.isCrown ? 'military_frigate' : 'abandoned_sloop';
      sectionCount = 3;
      scale = 1.12;
    } else if (
      vc === 'medium_merchant' ||
      vc === 'supply_ship' ||
      vc === 'passenger_ship' ||
      vc === 'crown_corvette' ||
      vc === 'crown_supply'
    ) {
      archetype = m.isCrown ? 'military_frigate' : 'merchant_vessel';
      sectionCount = 5;
      scale = 1.38;
    } else if (vc === 'large_cargo' || vc === 'crown_frigate' || vc === 'crown_warship') {
      archetype = m.isCrown ? 'massive_warship' : 'cargo_hulk';
      sectionCount = 7;
      scale = 1.75;
    } else if (vc === 'wealthy_trader' || vc === 'treasure_ship') {
      archetype = 'treasure_galleon';
      sectionCount = 9;
      scale = 2.05;
    } else {
      archetype = 'massive_warship';
      sectionCount = 10;
      scale = 2.28;
    }

    totalGold = Math.max(18, Math.round(m.gold * 0.55));
    const stockEntries = (Object.entries(m.stock) as [ResourceId, number][])
      .filter(([id, qty]) => qty > 0 && RESOURCE_DEFS[id])
      .filter(([id]) => (!m.isFishingTrawler ? true : id === 'food' || id === 'water'));

    const maxTypes = Math.min(stockEntries.length, m.isFishingTrawler ? 2 : Math.max(3, sectionCount));
    for (let k = 0; k < maxTypes; k++) {
      const idx = (k * 3 + Math.floor(rand() * stockEntries.length)) % stockEntries.length;
      const [id, qty] = stockEntries[idx];
      if (!cargoPool.some((item) => item.id === id)) {
        const salvagedQty = RESOURCE_DEFS[id].isValuableCargo || RESOURCE_DEFS[id].rarity === 'Specialised' || RESOURCE_DEFS[id].rarity === 'Rare'
          ? Math.max(1, Math.min(qty, 1 + Math.floor(rand() * 3)))
          : Math.max(2, Math.min(qty, Math.round(qty * 0.32)));
        cargoPool.push({ id, qty: salvagedQty });
      }
    }
    cargoPool.push({ id: 'wood', qty: 4 + Math.floor(rand() * 7) });

    if (m.survivor) {
      if (!m.survivor.resolved) {
        survivor = { ...m.survivor };
      }
    } else if (m.crewCount > 0 && rand() < 0.5) {
      const sample = createRandomCrewMember(`sunk_surv_${m.id}`, rand);
      const disp: WreckSurvivor['disposition'] =
        rand() < 0.45 ? 'eager' : rand() < 0.75 ? 'needs_food' : 'needs_medicine';
      survivor = {
        id: `sunk_surv_${m.id}`,
        name: sample.name,
        skills: sample.skills,
        disposition: disp,
        demandAmount: disp === 'needs_food' ? 6 : disp === 'needs_medicine' ? 1 : 0,
        resolved: false,
        infoText: SURVIVOR_INFO_TIPS[Math.floor(rand() * SURVIVOR_INFO_TIPS.length)],
      };
    }
  }

  // Non-salvageable exploded ships burn fiercely, leaving a charred hull with much less surviving loot
  if (isCharred) {
    totalGold = Math.max(6, Math.round(totalGold * 0.38));
    for (let c = cargoPool.length - 1; c >= 0; c--) {
      if (cargoPool.length > 1 && rand() < 0.42 && cargoPool[c].id !== 'wood') {
        cargoPool.splice(c, 1);
      } else {
        cargoPool[c].qty = Math.max(1, Math.floor(cargoPool[c].qty * 0.42));
      }
    }
  }

  const ship = source.ship;
  const wreckId = `sunk_wreck_${ship.id}`;
  const survivorIdx = survivor ? Math.min(sectionCount - 1, Math.floor(rand() * sectionCount)) : -1;
  let remainingGold = totalGold;
  const sections: WreckSection[] = [];

  for (let i = 0; i < sectionCount; i++) {
    const tmpl = SECTION_TEMPLATES[i % SECTION_TEMPLATES.length];
    const isLast = i === sectionCount - 1;
    const burntOutRoom = isCharred && !isLast && i !== survivorIdx && rand() < 0.38;
    const secGold = burntOutRoom
      ? 0
      : isLast
        ? remainingGold
        : Math.round(remainingGold * (0.18 + rand() * 0.26));
    remainingGold = Math.max(0, remainingGold - secGold);

    const loot: Partial<Inventory> = {};
    if (!burntOutRoom && cargoPool.length > 0) {
      for (let cIdx = i; cIdx < cargoPool.length; cIdx += sectionCount) {
        const entry = cargoPool[cIdx];
        loot[entry.id] = (loot[entry.id] || 0) + entry.qty;
      }
    }

    const secSurvivor = i === survivorIdx ? survivor : undefined;
    const isEmpty = secGold === 0 && Object.keys(loot).length === 0 && !secSurvivor;

    sections.push({
      id: `${wreckId}_sec_${i}`,
      name: tmpl.name,
      description: isCharred
        ? `${tmpl.description} Much of this deck is blackened and hollowed by the powder explosion.`
        : tmpl.description,
      searchDuration: tmpl.duration,
      dangerLevel: isCharred ? 'High' : tmpl.danger,
      dangerNote: isCharred
        ? 'Smoldering charred beams, active embers, and warped scorched strongboxes.'
        : tmpl.note,
      searched: false,
      emptyRoom: isEmpty,
      gold: secGold,
      loot,
      survivor: secSurvivor,
    });
  }

  return {
    id: wreckId,
    name: isCharred ? `${ship.name} (Charred Wreck)` : `${ship.name} (Sunken Wreck)`,
    archetype,
    isCharred,
    spawnedFromShipId: ship.id,
    x: ship.x,
    z: ship.z,
    rotation: ship.heading,
    sinkDepth: isCharred ? 0.72 : 0.62,
    scale,
    discovered: false,
    fullyLooted: false,
    sections,
  };
}

export const VESSEL_CLASS_LABELS: Record<VesselClass, string> = {
  fishing_boat: 'Fishing Boat',
  fishing_trawler: 'Fishing Trawler',
  small_merchant: 'Small Trader',
  medium_merchant: 'Medium Merchant Vessel',
  large_cargo: 'Large Cargo Ship',
  passenger_ship: 'Passenger Packet',
  supply_ship: 'Supply Vessel',
  wealthy_trader: 'Wealthy Trader',
  treasure_ship: 'Treasure Ship',
  crown_patrol: 'Crown Patrol Vessel',
  crown_sloop: 'Crown Sloop',
  crown_corvette: 'Crown Corvette',
  crown_frigate: 'Crown Frigate',
  crown_warship: 'Crown Heavy Warship',
  crown_ship_of_line: 'Crown Ship of the Line',
  crown_flagship: 'Crown Flagship',
  crown_supply: 'Crown Supply Vessel',
};

const VESSEL_NAMES: Record<VesselClass, string[]> = {
  fishing_boat: ['Herring Skiff', 'Mackerel Dory', 'Harbor Tern', 'Salt Net'],
  fishing_trawler: ['Sea Harvester', 'North Star Trawler', 'Bountiful Catch', 'Gannet Drifter'],
  small_merchant: ['Coastal Penny', 'Little Lark', 'Swift Barque', 'Bristol Finch'],
  medium_merchant: ['SS Meridian', 'Caledonia Star', 'Copper Compass', 'Amber Astrolabe'],
  large_cargo: ['Great Eastwind', 'Indiaman Vanguard', 'Ironbound Freight', 'Ocean Sovereign'],
  passenger_ship: ['Queen’s Packet', 'Albion Traveller', 'Whitehaven Clipper', 'Grand Passage'],
  supply_ship: ['Provisioner Kate', 'Timber Carrier', 'Dockyard Tender', 'Orkney Victualler'],
  wealthy_trader: ['Golden Cormorant', 'Duke’s Venture', 'Velvet Silk-Bark', 'Gilded Phoenix'],
  treasure_ship: ['Crown Specie Galleon', 'Sovereign Bullion', 'Imperial Treasury', 'Golden Armada'],
  crown_patrol: ['HMS Swift', 'HMS Hawk', 'HMS Sentinel', 'HMS Merlin'],
  crown_sloop: ['HMS Kestrel', 'HMS Hound', 'HMS Cygnet', 'HMS Falcon'],
  crown_corvette: ['HMS Valiant', 'HMS Audacious', 'HMS Vanguard', 'HMS Defiance'],
  crown_frigate: ['HMS Indefatigable', 'HMS Surprise', 'HMS Arethusa', 'HMS Emerald'],
  crown_warship: ['HMS Lion', 'HMS Thunderer', 'HMS Victory Crown', 'HMS Dreadshield'],
  crown_ship_of_line: ['HMS Colossus', 'HMS Temeraire', 'HMS Bellerophon', 'HMS Ocean Rex'],
  crown_flagship: ['HMS Sovereign Royal', 'HMS Britannia Rex', 'HMS Imperial Star'],
  crown_supply: ['HMS Victualler', 'HMS Dockyard Aid', 'HMS Quartermaster'],
};

const CAPTAIN_TITLES = [
  'Capt. Sterling', 'Capt. Hargrave', 'Master Mercer', 'Capt. Blackwell',
  'Cmdr. Aldridge', 'Lt. Redmayne', 'Skipper Sutton', 'Capt. Pembrook',
];

export function generateMerchantShip(
  id: string,
  x: number,
  z: number,
  vesselClass: VesselClass,
  rand: () => number
): MerchantShipData {
  const isCrown = vesselClass.startsWith('crown_');
  const isFishingTrawler = vesselClass === 'fishing_boat' || vesselClass === 'fishing_trawler';

  const tier: MerchantTier =
    vesselClass === 'fishing_boat' || vesselClass === 'small_merchant' || vesselClass === 'crown_patrol'
      ? 'small_trader'
      : vesselClass === 'fishing_trawler' ||
          vesselClass === 'medium_merchant' ||
          vesselClass === 'supply_ship' ||
          vesselClass === 'crown_corvette' ||
          vesselClass === 'crown_supply'
        ? 'medium_merchant'
        : vesselClass === 'large_cargo' || vesselClass === 'passenger_ship' || vesselClass === 'crown_warship'
          ? 'large_cargo'
          : 'wealthy_galleon';

  const specialty: MerchantShipData['specialty'] = isCrown
    ? 'crown'
    : isFishingTrawler
      ? 'fishing'
      : vesselClass === 'wealthy_trader' || vesselClass === 'treasure_ship'
        ? 'luxury'
        : vesselClass === 'supply_ship'
          ? 'provisions'
          : vesselClass === 'large_cargo'
            ? rand() < 0.55
              ? 'shipwright'
              : 'armory'
            : rand() < 0.5
              ? 'shipwright'
              : 'provisions';

  const stock = createEmptyInventory();
  const mults: Partial<Record<ResourceId, number>> = {};
  for (const r of Object.keys(RESOURCE_DEFS) as ResourceId[]) {
    // Valuable cargo varies sharply across regions/captains (0.58x .. 2.15x) for genuine trading decisions
    mults[r] = RESOURCE_DEFS[r].isValuableCargo
      ? 0.58 + rand() * 1.57
      : 0.86 + rand() * 0.34;
  }

  const tierScale =
    tier === 'small_trader' ? 1 : tier === 'medium_merchant' ? 1.85 : tier === 'large_cargo' ? 3.0 : 4.2;

  if (isFishingTrawler) {
    // STRICT RULE: Fishing boats & trawlers ONLY carry/trade provisions (food) and fresh water!
    const fishMult = vesselClass === 'fishing_trawler' ? 2.6 : 1.3;
    stock.food = Math.round((24 + rand() * 34) * fishMult);
    stock.water = Math.round((22 + rand() * 32) * fishMult);
    mults.food = 0.72 + rand() * 0.25;
    mults.water = 0.7 + rand() * 0.25;
  } else {
    stock.wood = Math.round((12 + rand() * 20) * tierScale);
    stock.food = Math.round((14 + rand() * 22) * tierScale);
    stock.water = Math.round((16 + rand() * 24) * tierScale);
    stock.rope = Math.round((8 + rand() * 14) * tierScale);
    stock.cloth = Math.round((6 + rand() * 14) * tierScale);
    stock.iron = Math.round((4 + rand() * 10) * tierScale);
    stock.medicine = Math.round((2 + rand() * 5) * tierScale);
    stock.tools = Math.round((1 + rand() * 4) * tierScale);

    // Pick 2-4 valuable cargo varieties carried/traded by each merchant
    const cargoCount = tier === 'small_trader' ? 2 : tier === 'medium_merchant' ? 3 : 4;
    for (let vc = 0; vc < cargoCount; vc++) {
      const vcId = VALUABLE_CARGO_IDS[Math.floor(rand() * VALUABLE_CARGO_IDS.length)];
      stock[vcId] = (stock[vcId] || 0) + Math.max(1, Math.round((1 + rand() * 3) * (tierScale * 0.7)));
    }

    if (tier !== 'small_trader') {
      stock.gunpowder = Math.round((4 + rand() * 12) * tierScale);
      stock.cannonballs = Math.round((6 + rand() * 16) * tierScale);
    }
    if (tier === 'large_cargo' || tier === 'wealthy_galleon' || isCrown) {
      stock.advancedTimber = Math.round((2 + rand() * 6) * (tier === 'wealthy_galleon' ? 2 : 1));
      stock.reinforcedMetals = Math.round((1 + rand() * 5) * (tier === 'wealthy_galleon' ? 2 : 1));
      stock.specializedSailcloth = Math.round((2 + rand() * 6) * (tier === 'wealthy_galleon' ? 1.8 : 1));
      stock.rareMaterials = Math.round((1 + rand() * 4) * (tier === 'wealthy_galleon' ? 2 : 1));
    }
    if (vesselClass === 'wealthy_trader' || vesselClass === 'treasure_ship') {
      stock.decorativeMaterials = 3 + Math.floor(rand() * 6);
      stock.jewellery += 3 + Math.floor(rand() * 4);
      stock.paintings += 2 + Math.floor(rand() * 3);
      stock.antiques += 2 + Math.floor(rand() * 3);
      stock.rareMaterials += 5;
    }
    if (specialty === 'shipwright') {
      stock.wood += 26;
      stock.iron += 14;
      stock.cloth += 16;
      stock.tools += 4;
      mults.wood = 0.8;
      mults.iron = 0.82;
    } else if (specialty === 'armory' || isCrown) {
      stock.gunpowder += 18;
      stock.cannonballs += 26;
      stock.reinforcedMetals += 3;
      mults.gunpowder = 0.84;
      mults.cannonballs = 0.82;
    }
  }

  const goldBase =
    vesselClass === 'treasure_ship'
      ? 4200
      : vesselClass === 'wealthy_trader'
        ? 2600
        : vesselClass === 'crown_flagship' || vesselClass === 'crown_ship_of_line'
          ? 2400
          : vesselClass === 'large_cargo' ||
              vesselClass === 'passenger_ship' ||
              vesselClass === 'crown_warship' ||
              vesselClass === 'crown_frigate'
            ? 1250
            : isFishingTrawler
              ? 180
              : tier === 'small_trader'
                ? 260
                : 620;

  const hullTable: Record<VesselClass, number> = {
    fishing_boat: 70,
    fishing_trawler: 120,
    small_merchant: 95,
    medium_merchant: 165,
    large_cargo: 260,
    passenger_ship: 210,
    supply_ship: 190,
    wealthy_trader: 295,
    treasure_ship: 340,
    crown_patrol: 135,
    crown_sloop: 155,
    crown_corvette: 225,
    crown_frigate: 310,
    crown_warship: 390,
    crown_ship_of_line: 460,
    crown_flagship: 540,
    crown_supply: 210,
  };

  const cannonTable: Record<VesselClass, number> = {
    fishing_boat: 0,
    fishing_trawler: 0,
    small_merchant: 2,
    medium_merchant: 4,
    large_cargo: 6,
    passenger_ship: 4,
    supply_ship: 4,
    wealthy_trader: 8,
    treasure_ship: 10,
    crown_patrol: 4,
    crown_sloop: 6,
    crown_corvette: 10,
    crown_frigate: 14,
    crown_warship: 18,
    crown_ship_of_line: 24,
    crown_flagship: 28,
    crown_supply: 4,
  };

  const crewTable: Record<VesselClass, number> = {
    fishing_boat: 4,
    fishing_trawler: 9,
    small_merchant: 8,
    medium_merchant: 16,
    large_cargo: 26,
    passenger_ship: 32,
    supply_ship: 18,
    wealthy_trader: 30,
    treasure_ship: 38,
    crown_patrol: 14,
    crown_sloop: 18,
    crown_corvette: 26,
    crown_frigate: 36,
    crown_warship: 46,
    crown_ship_of_line: 58,
    crown_flagship: 68,
    crown_supply: 18,
  };

  const speedTable: Record<VesselClass, number> = {
    fishing_boat: 5.5,
    fishing_trawler: 4.5,
    small_merchant: 5.8,
    medium_merchant: 4.9,
    large_cargo: 3.9,
    passenger_ship: 5.3,
    supply_ship: 4.2,
    wealthy_trader: 4.6,
    treasure_ship: 4.0,
    crown_patrol: 6.4,
    crown_sloop: 6.2,
    crown_corvette: 5.7,
    crown_frigate: 5.2,
    crown_warship: 4.8,
    crown_ship_of_line: 4.4,
    crown_flagship: 4.5,
    crown_supply: 4.8,
  };

  const maxHull = hullTable[vesselClass];
  const hireableCount = isFishingTrawler ? 1 : tier === 'small_trader' ? 1 : 2 + Math.floor(rand() * 2);
  const hireableCrew = [];
  for (let i = 0; i < hireableCount; i++) {
    hireableCrew.push(createRandomCrewMember(`hire_${id}_${i}`, rand));
  }

  const rareDyes: FlagDyeId[] = ['teal_abyss', 'royal_purple', 'burnished_bronze', 'bone_silver', 'violet', 'amber'];
  const rareEmblems: FlagEmblemId[] = ['crossed_swords', 'crown', 'kraken', 'sunburst', 'trident', 'serpent', 'dragon_crest'];

  const unlockedDyesForSale: FlagDyeId[] =
    vesselClass === 'wealthy_trader' || vesselClass === 'treasure_ship'
      ? [rareDyes[Math.floor(rand() * rareDyes.length)], rareDyes[Math.floor(rand() * rareDyes.length)]]
      : tier === 'large_cargo'
        ? [rareDyes[Math.floor(rand() * 2) + 4]]
        : [];
  const unlockedEmblemsForSale: FlagEmblemId[] =
    vesselClass === 'wealthy_trader' || vesselClass === 'treasure_ship'
      ? [rareEmblems[Math.floor(rand() * rareEmblems.length)]]
      : isCrown
        ? ['crown', 'trident']
        : [];

  const angle = rand() * Math.PI * 2;
  const dist = 280 + rand() * 380;
  const names = VESSEL_NAMES[vesselClass];

  return {
    id,
    name: names[Math.floor(rand() * names.length)],
    captainName: CAPTAIN_TITLES[Math.floor(rand() * CAPTAIN_TITLES.length)],
    vesselClass,
    classLabel: VESSEL_CLASS_LABELS[vesselClass],
    tier,
    specialty,
    isCrown,
    isFishingTrawler,
    x,
    z,
    heading: angle,
    speed: speedTable[vesselClass] * 0.78,
    maxSpeed: speedTable[vesselClass],
    waypointX: x + Math.cos(angle) * dist,
    waypointZ: z + Math.sin(angle) * dist,
    gold: Math.round(goldBase * (0.85 + rand() * 0.4)),
    stock,
    priceMultipliers: mults,
    hull: maxHull,
    maxHull,
    cannons: cannonTable[vesselClass],
    crewCount: crewTable[vesselClass],
    maxCrew: crewTable[vesselClass],
    hireableCrew,
    unlockedDyesForSale: Array.from(new Set(unlockedDyesForSale)),
    unlockedEmblemsForSale: Array.from(new Set(unlockedEmblemsForSale)),
    reloadTimer: 2,
    hostileToPlayer: false,
    surrenderedToPlayer: false,
    fleeingFromPlayer: false,
    fleeTimer: 0,
    robbed: false,
    attackTargetId: null,
    discovered: false,
    sunk: false,
    sinkProgress: 0,
  };
}
