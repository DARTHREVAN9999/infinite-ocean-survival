import React, { useEffect, useRef, useState } from 'react';
import { Compass, Crosshair, Flag, Hammer, RefreshCw, ShieldAlert, Ship, Users, Wrench, X } from 'lucide-react';
import {
  CannonUpgrades,
  CrewAutoAssignMode,
  CrewRole,
  CustomFlagConfig,
  FishingGearId,
  FlagDyeId,
  FlagEmblemId,
  FlagPatternId,
  FleetCommand,
  FleetShipClass,
  RepairPriority,
  ResourceId,
  SaveData,
  WeaponType,
} from '../game/types';
import {
  canAffordCosts,
  computeManualRepairPlan,
  FLAG_DYES,
  FLAG_EMBLEMS,
  FLAG_PATTERNS,
  FLAG_SHAPES,
  getCannonStatUpgradeCost,
  getCargoCapacity,
  getCargoWeight,
  getEffectiveWeaponStats,
  getInstallCannonCost,
  getMaxCannonSlots,
  getMaxCrewCapacity,
  HULL_UPGRADE_CATALOG,
  pickRandomShipName,
  PRE_CHOSEN_SHIP_NAMES,
  RESOURCE_DEFS,
  RESOURCE_LIST,
  WEAPON_LIST,
  WEAPON_SPECS,
} from '../game/economy';
import { PIRATE_FACTIONS, PIRATE_FACTION_IDS } from '../game/factions';
import {
  computeCrewPerformance,
  CREW_ROLE_LABELS,
  CREW_ROLES,
  getRoleCounts,
  xpThresholdForLevel,
} from '../game/survival';
import {
  FLEET_CLASS_ORDER,
  FLEET_CLASS_SPECS,
  getFleetUnlockStatus,
  MAX_FLEET_SIZE,
} from '../game/fleet';
import { FISHING_GEAR_ORDER, FISHING_GEAR_SPECS } from '../game/fishing';
import { drawFlagToCanvas } from '../engine/textures';

interface ShipManagementModalProps {
  save: SaveData;
  onClose: () => void;
  onAssignRole: (crewId: string, role: CrewRole) => void;
  onAutoAssignRoles: (mode: CrewAutoAssignMode) => { message: string };
  onTreatCrew: (crewId: string) => { ok: boolean; message: string };
  onStartManualRepair: (section: RepairPriority) => { ok: boolean; message: string };
  onPurchaseHullUpgrade: (id: string) => { ok: boolean; message: string };
  onInstallWeapon: (type: WeaponType) => { ok: boolean; message: string };
  onUpgradeCannonStat: (stat: keyof CannonUpgrades) => { ok: boolean; message: string };
  onUpdateCustomFlag: (cfg: CustomFlagConfig) => { ok: boolean; message: string };
  onSetShipName: (name: string) => { ok: boolean; message: string };
  onBuyFlagCosmetic: (
    kind: 'dye' | 'emblem' | 'pattern',
    id: string,
    price: number
  ) => { ok: boolean; message: string };
  onBuyFleetShip: (shipClass: FleetShipClass, customName?: string) => { ok: boolean; message: string };
  onSetFleetCommand: (shipId: string, command: FleetCommand) => void;
  onRenameFleetShip: (shipId: string, name: string) => void;
  onBuyFishingGear: (gearId: FishingGearId) => { ok: boolean; message: string };
  onConvertFishToFood: (kind: 'fishCatch' | 'rareFish', qty: number) => { ok: boolean; message: string };
}

type TabId = 'weapons' | 'hull' | 'repairs' | 'crew' | 'flag' | 'fleet' | 'cargo';

const HULL_NAMES = [
  '',
  'Tier 1 · Starter Timber Skiff',
  'Tier 2 · Coastal Cutter',
  'Tier 3 · Twin-Masted Brigantine',
  'Tier 4 · Naval Frigate',
  'Tier 5 · Heavy War Galleon',
  'Tier 6 · Man-of-War',
  'Tier 7 · Grand Sovereign Flagship',
];

const HULL_GROUPS: (
  | 'Hull Tiers'
  | 'Dimensions & Decks'
  | 'Armor & Reinforcement'
  | 'Rigging, Helm & Facilities'
)[] = [
  'Hull Tiers',
  'Dimensions & Decks',
  'Armor & Reinforcement',
  'Rigging, Helm & Facilities',
];

const STAT_META: { key: keyof CannonUpgrades; label: string; effect: string }[] = [
  { key: 'damageLvl', label: 'Powder Charge & Shot', effect: '+16% damage per level' },
  { key: 'accuracyLvl', label: 'Rifled Barrels & Sights', effect: '+4.5% accuracy & +6% range per level' },
  { key: 'reloadLvl', label: 'Quick-Load Tackles', effect: '-10% reload time per level' },
  { key: 'durabilityLvl', label: 'Cast-Iron Trunnions', effect: 'Reduces cannon wear & battle damage' },
];

export const ShipManagementModal: React.FC<ShipManagementModalProps> = ({
  save,
  onClose,
  onAssignRole,
  onAutoAssignRoles,
  onTreatCrew,
  onStartManualRepair,
  onPurchaseHullUpgrade,
  onInstallWeapon,
  onUpgradeCannonStat,
  onUpdateCustomFlag,
  onSetShipName,
  onBuyFlagCosmetic,
  onBuyFleetShip,
  onSetFleetCommand,
  onRenameFleetShip,
  onBuyFishingGear,
  onConvertFishToFood,
}) => {
  const [tab, setTab] = useState<TabId>('weapons');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [renameDrafts, setRenameDrafts] = useState<Record<string, string>>({});
  const flagCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const p = save.player;
  const cargoUsed = getCargoWeight(p.inventory);
  const cargoCap = getCargoCapacity(p.upgrades);
  const maxCrew = getMaxCrewCapacity(p.upgrades);
  const maxGuns = getMaxCannonSlots(p.upgrades);
  const perf = computeCrewPerformance(p.crew, p.upgrades);
  const roleCounts = getRoleCounts(p.crew);
  const effWeapon = getEffectiveWeaponStats(p.upgrades);
  const fleetUnlock = getFleetUnlockStatus(p.upgrades, p.crew.length, p.gold);
  const fleetList = save.fleet ?? [];

  useEffect(() => {
    if (tab !== 'flag') return;
    const canvas = flagCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawFlagToCanvas(ctx, canvas.width, canvas.height, save.customFlag);
  }, [tab, save.customFlag]);

  const setFlagField = (patch: Partial<CustomFlagConfig>) => {
    const res = onUpdateCustomFlag({ ...save.customFlag, ...patch });
    setFeedback(res.message);
  };

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/72 p-3 md:p-5"
      role="dialog"
      aria-modal="true"
      aria-label="Ship and Crew Management"
    >
      <div className="nautical-panel rounded-lg w-full max-w-[min(1240px,97vw)] max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#c99d4e]/30 flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-bold text-[#f7efe0] tracking-wide">
              {p.shipName} — Shipyard, Ordnance &amp; Crew Ledger
            </h2>
            <p className="text-sm text-[#c4b79e] mt-0.5">
              {HULL_NAMES[p.upgrades.hullTier] || `Tier ${p.upgrades.hullTier} Vessel`} · Gold{' '}
              <span className="font-mono-num text-[#efc570] font-bold">{Math.round(p.gold)}g</span> · Crew{' '}
              <span className="font-mono-num text-[#f7efe0] font-semibold">{p.crew.length}/{maxCrew}</span> · Gun Ports{' '}
              <span className="font-mono-num text-[#f7efe0] font-semibold">{p.upgrades.cannonCount}/{maxGuns}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Ship Management"
            className="p-2 text-[#cbbda4] hover:text-white hover:bg-[#1e2c3a] rounded cursor-pointer transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div
          role="tablist"
          aria-label="Ship Management Sections"
          className="px-6 pt-2.5 border-b border-[#c99d4e]/25 flex items-center gap-1 overflow-x-auto"
        >
          {(
            [
              ['weapons', 'Cannons', Crosshair],
              ['hull', 'Hull & Ship', Hammer],
              ['repairs', 'Repairs', Wrench],
              ['crew', `Crew (${p.crew.length})`, Users],
              ['flag', 'Flag', Flag],
              ['fleet', `Fleet (${fleetList.length}/${MAX_FLEET_SIZE})`, Compass],
              ['cargo', 'Cargo & Factions', ShieldAlert],
            ] as [TabId, string, React.ComponentType<{ className?: string }>][]
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => {
                setTab(id);
                setFeedback(null);
              }}
              className={`px-3 py-2.5 text-xs md:text-sm font-semibold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                tab === id
                  ? 'border-[#c99d4e] text-[#f7efe0]'
                  : 'border-transparent text-[#9d917c] hover:text-[#e2d6bf]'
              }`}
            >
              <Icon className="w-4 h-4 text-[#d8ae5e]" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {feedback && (
          <div className="mx-6 mt-3 px-4 py-2.5 rounded bg-[#182836] border border-[#c99d4e]/45 text-sm font-medium text-[#f4ead5]">
            {feedback}
          </div>
        )}

        {/* Body */}
        <div className="p-6 overflow-y-auto nautical-scroll flex-1 space-y-6">
          {/* TAB 1: CANNONS & WEAPONS */}
          {tab === 'weapons' && (
            <div className="space-y-6">
              <div className="p-4 rounded bg-[#101a24] border border-[#c99d4e]/25 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="text-xs uppercase tracking-wider text-[#efc570] font-bold">
                    Mounted Armament
                  </div>
                  <div className="text-base font-semibold text-[#f7efe0] mt-0.5">
                    {p.upgrades.cannonCount}x {WEAPON_SPECS[p.upgrades.weaponType].name}{' '}
                    <span className="text-sm font-normal text-[#b7aa92]">
                      ({p.upgrades.cannonCount}/{maxGuns} ports occupied)
                    </span>
                  </div>
                </div>
                <div className="font-mono-num text-sm text-[#9ec4d1] flex flex-wrap gap-4">
                  <span>DMG {effWeapon.damage}</span>
                  <span>RNG {effWeapon.range}m</span>
                  <span>RLD {effWeapon.reloadTime}s</span>
                  <span>ACC {Math.round(effWeapon.accuracy * 100)}%</span>
                </div>
              </div>

              <div>
                <h3 className="font-display text-base uppercase tracking-wider text-[#d8ae5e] mb-3">
                  Ordnance Classes (8 Tiers)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {WEAPON_LIST.map((spec) => {
                    const isCurrent = p.upgrades.weaponType === spec.id;
                    const switching = p.upgrades.weaponType !== 'none' && !isCurrent;
                    const cost = switching
                      ? { goldCost: spec.goldCost, materialCost: spec.materialCost }
                      : getInstallCannonCost(spec.id);
                    const tierOk = p.upgrades.hullTier >= spec.minHullTier;
                    const portsFull = isCurrent && p.upgrades.cannonCount >= maxGuns;
                    const affordable =
                      tierOk &&
                      !portsFull &&
                      canAffordCosts(p.gold, p.inventory, cost.goldCost, cost.materialCost);

                    return (
                      <div
                        key={spec.id}
                        className={`p-4 rounded bg-[#101a24] border flex flex-col justify-between gap-3 ${
                          isCurrent ? 'border-[#c99d4e]' : 'border-[#c99d4e]/25'
                        }`}
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-baseline justify-between gap-2">
                            <h4 className="text-base font-bold text-[#f7efe0]">{spec.name}</h4>
                            <span className="font-mono-num text-sm font-bold text-[#efc570]">
                              {cost.goldCost}g
                            </span>
                          </div>
                          <p className="text-xs text-[#b7aa92] leading-relaxed">{spec.description}</p>
                          <div className="text-xs font-mono-num text-[#9ec4d1] pt-1">
                            DMG {spec.damage} · RNG {spec.range}m · RLD {spec.reloadTime}s · Hull T{spec.minHullTier}+
                          </div>
                          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs font-mono-num pt-1">
                            {(Object.entries(cost.materialCost) as [ResourceId, number][]).map(([rId, qty]) => {
                              const have = Math.floor(p.inventory[rId] || 0);
                              return (
                                <span
                                  key={rId}
                                  className={have >= qty ? 'text-[#7ac59b]' : 'text-[#e38679]'}
                                >
                                  {RESOURCE_DEFS[rId].name}: {have}/{qty}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={!affordable || portsFull}
                          onClick={() => setFeedback(onInstallWeapon(spec.id).message)}
                          className={`w-full py-2.5 text-sm font-bold rounded transition-colors ${
                            portsFull || !tierOk
                              ? 'bg-[#1a2530] text-[#7c858e] cursor-not-allowed'
                              : affordable
                                ? 'bg-[#c99d4e] hover:bg-[#dfB261] text-[#14100b] cursor-pointer'
                                : 'bg-[#1a2530] text-[#837b6d] cursor-not-allowed'
                          }`}
                        >
                          {!tierOk
                            ? `Requires Hull Tier ${spec.minHullTier}`
                            : portsFull
                              ? 'All Gun Ports Full'
                              : switching
                                ? `Refit All Ports to ${spec.name}`
                                : `Mount +1 ${spec.name}`}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 4 Cannon Stat Upgrades */}
              <div>
                <h3 className="font-display text-base uppercase tracking-wider text-[#d8ae5e] mb-3">
                  Ordnance Engineering Upgrades
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {STAT_META.map(({ key, label, effect }) => {
                    const lvl = p.upgrades.cannonUpgrades?.[key] ?? 1;
                    const cost = getCannonStatUpgradeCost(key, lvl);
                    const affordable =
                      !cost.maxReached &&
                      canAffordCosts(p.gold, p.inventory, cost.goldCost, cost.materialCost);
                    return (
                      <div
                        key={key}
                        className="p-4 rounded bg-[#101a24] border border-[#c99d4e]/25 flex flex-col justify-between gap-3"
                      >
                        <div>
                          <div className="flex items-baseline justify-between gap-2">
                            <h4 className="text-base font-bold text-[#f7efe0]">
                              {label} <span className="text-[#efc570]">Lv.{lvl}/4</span>
                            </h4>
                            {!cost.maxReached && (
                              <span className="font-mono-num text-sm font-bold text-[#efc570]">
                                {cost.goldCost}g
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[#b7aa92] mt-1">{effect}</p>
                          {!cost.maxReached && (
                            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs font-mono-num mt-2">
                              {(Object.entries(cost.materialCost) as [ResourceId, number][]).map(([rId, qty]) => {
                                const have = Math.floor(p.inventory[rId] || 0);
                                return (
                                  <span key={rId} className={have >= qty ? 'text-[#7ac59b]' : 'text-[#e38679]'}>
                                    {RESOURCE_DEFS[rId].name}: {have}/{qty}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          disabled={cost.maxReached || !affordable}
                          onClick={() => setFeedback(onUpgradeCannonStat(key).message)}
                          className={`w-full py-2 text-sm font-bold rounded transition-colors ${
                            cost.maxReached
                              ? 'bg-[#1d332a] text-[#83cca5] cursor-default'
                              : affordable
                                ? 'bg-[#c99d4e] hover:bg-[#dfb261] text-[#14100b] cursor-pointer'
                                : 'bg-[#1a2530] text-[#837b6d] cursor-not-allowed'
                          }`}
                        >
                          {cost.maxReached ? 'Max Level' : `Upgrade to Level ${lvl + 1}`}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: HULL & STRUCTURE */}
          {tab === 'hull' && (
            <div className="space-y-7">
              {HULL_GROUPS.map((groupName) => {
                const items = HULL_UPGRADE_CATALOG.filter((u) => u.sectionLabel === groupName);
                return (
                  <div key={groupName}>
                    <h3 className="font-display text-base uppercase tracking-wider text-[#d8ae5e] mb-3">
                      {groupName}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {items.map((u) => {
                        const bought = u.isPurchased(p.upgrades);
                        const unlocked = u.isUnlocked(p.upgrades);
                        const affordable =
                          !bought &&
                          unlocked &&
                          canAffordCosts(p.gold, p.inventory, u.goldCost, u.resourceCost);
                        return (
                          <div
                            key={u.id}
                            className="p-4 rounded bg-[#101a24] border border-[#c99d4e]/25 flex flex-col justify-between gap-3"
                          >
                            <div>
                              <div className="flex items-baseline justify-between gap-2">
                                <h4 className="text-base font-bold text-[#f7efe0]">{u.name}</h4>
                                <span className="font-mono-num text-sm font-bold text-[#efc570]">
                                  {u.goldCost}g
                                </span>
                              </div>
                              <p className="text-xs text-[#cfc3ae] mt-1.5 leading-relaxed">{u.description}</p>
                              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs font-mono-num">
                                {(Object.entries(u.resourceCost) as [ResourceId, number][]).map(([rId, qty]) => {
                                  const have = Math.floor(p.inventory[rId] || 0);
                                  return (
                                    <span key={rId} className={have >= qty ? 'text-[#7ac59b]' : 'text-[#e38679]'}>
                                      {RESOURCE_DEFS[rId].name}: {have}/{qty}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                            <button
                              type="button"
                              disabled={bought || !unlocked || !affordable}
                              onClick={() => setFeedback(onPurchaseHullUpgrade(u.id).message)}
                              className={`w-full py-2.5 text-sm font-bold rounded transition-colors ${
                                bought
                                  ? 'bg-[#1d332a] text-[#83cca5] cursor-default'
                                  : !unlocked
                                    ? 'bg-[#19222c] text-[#889098] cursor-not-allowed'
                                    : affordable
                                      ? 'bg-[#c99d4e] hover:bg-[#dfb261] text-[#14100b] cursor-pointer'
                                      : 'bg-[#1b2530] text-[#837b6d] cursor-not-allowed'
                              }`}
                            >
                              {bought ? 'Installed on Vessel' : !unlocked ? u.unlockRequirementText : 'Construct Refit'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Fishing Rigging Equipment */}
              <div>
                <h3 className="font-display text-base uppercase tracking-wider text-[#d8ae5e] mb-3">
                  Shipboard Fishing Gear
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {FISHING_GEAR_ORDER.filter((g) => g !== 'none').map((gId) => {
                    const spec = FISHING_GEAR_SPECS[gId];
                    const equipped = (p.upgrades.fishingGear ?? 'none') === gId;
                    const tierOk = p.upgrades.hullTier >= spec.minHullTier;
                    const affordable = tierOk && p.gold >= spec.cost;
                    return (
                      <div
                        key={gId}
                        className={`p-4 rounded bg-[#101a24] border flex flex-col justify-between gap-3 ${
                          equipped ? 'border-[#4e9f76]' : 'border-[#c99d4e]/25'
                        }`}
                      >
                        <div>
                          <div className="flex items-baseline justify-between gap-2">
                            <h4 className="text-base font-bold text-[#f7efe0]">{spec.name}</h4>
                            <span className="font-mono-num text-sm font-bold text-[#efc570]">{spec.cost}g</span>
                          </div>
                          <p className="text-xs text-[#cfc3ae] mt-1">{spec.description}</p>
                          <div className="mt-2 text-xs font-mono-num text-[#9ec4d1]">
                            Cycle {spec.catchIntervalSec}s · Haul +{spec.haulBonus} · Hull T{spec.minHullTier}+
                          </div>
                        </div>
                        <button
                          type="button"
                          data-testid={`buy-fishing-gear-${gId}`}
                          disabled={equipped || !affordable}
                          onClick={() => setFeedback(onBuyFishingGear(gId).message)}
                          className={`w-full py-2 text-xs font-bold rounded transition-colors ${
                            equipped
                              ? 'bg-[#1d332a] text-[#83cca5] cursor-default'
                              : affordable
                                ? 'bg-[#c99d4e] hover:bg-[#dfb261] text-[#14100b] cursor-pointer'
                                : 'bg-[#1b2530] text-[#837b6d] cursor-not-allowed'
                          }`}
                        >
                          {equipped
                            ? 'Mounted on Vessel'
                            : !tierOk
                              ? `Requires Hull Tier ${spec.minHullTier}`
                              : `Rig Gear (${spec.cost}g)`}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: MANUAL REPAIRS ONLY */}
          {tab === 'repairs' && (
            <div className="space-y-5">
              <div className="p-4 rounded bg-[#101a24] border border-[#c99d4e]/30 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-display text-base font-bold text-[#f7efe0]">
                    Manual Shipwright Repairs (Zero Automatic Healing)
                  </h3>
                  <p className="text-xs text-[#b7aa92] mt-0.5">
                    Damage to ship sections persists until you assign a manual repair job using cargo materials.
                  </p>
                </div>
                <div className="text-right font-mono-num text-sm">
                  <div className="text-[#9ec4d1]">
                    Repair Crew Speed: <strong className="text-[#f7efe0]">{Math.round(perf.repairSpeedFactor * 100)}%</strong>
                  </div>
                  <div className={p.condition.flooding > 25 ? 'text-[#f19488]' : 'text-[#b7aa92]'}>
                    Bilge Flooding: <strong>{Math.round(p.condition.flooding)}%</strong>
                  </div>
                </div>
              </div>

              {save.activeRepairJob && (
                <div className="p-4 rounded bg-[#172836] border border-[#c99d4e]/55 space-y-2">
                  <div className="flex items-center justify-between text-sm font-bold text-[#f7efe0]">
                    <span>Repairing {save.activeRepairJob.section.toUpperCase()}...</span>
                    <span className="font-mono-num text-[#efc570]">
                      {Math.ceil(save.activeRepairJob.remainingTime)}s remaining
                    </span>
                  </div>
                  <div className="h-2.5 bg-[#0f1720] rounded overflow-hidden">
                    <div
                      className="h-full bg-[#4e9f76] transition-all duration-200"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.round(
                            ((save.activeRepairJob.totalTime - save.activeRepairJob.remainingTime) /
                              Math.max(0.1, save.activeRepairJob.totalTime)) *
                              100
                          )
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(
                  [
                    ['hull', 'Hull Planking', 'Below 65% leaks seawater into the bilge.'],
                    ['sails', 'Canvas Sails', 'Torn canvas reduces top speed under wind.'],
                    ['mast', 'Masts & Spars', 'Controls rigging stability and sail power.'],
                    ['steering', 'Helm & Rudder', 'Damaged steering reduces turn rate.'],
                    ['cannons', 'Mounted Ordnance', 'Damaged carriages fire slower or jam.'],
                    ['deck', 'Main Deck', 'Damaged decking slows crew coordination.'],
                  ] as [RepairPriority, string, string][]
                ).map(([sec, name, desc]) => {
                  const val = Math.round(p.condition[sec]);
                  const plan = computeManualRepairPlan(sec, p.condition, p.upgrades, perf.repairSpeedFactor);
                  const affordable =
                    plan.damageMissing > 0 &&
                    canAffordCosts(p.gold, p.inventory, 0, plan.materials);
                  const busy = Boolean(save.activeRepairJob);

                  return (
                    <div
                      key={sec}
                      className="p-4 rounded bg-[#101a24] border border-[#c99d4e]/25 flex flex-col justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-baseline justify-between">
                          <h4 className="text-base font-bold text-[#f7efe0]">{name}</h4>
                          <span className="font-mono-num text-base font-bold text-[#efc570]">{val}%</span>
                        </div>
                        <div className="mt-1.5 h-2 bg-[#1a2633] rounded-sm overflow-hidden">
                          <div
                            className="h-full"
                            style={{
                              width: `${val}%`,
                              backgroundColor: val > 65 ? '#4e9f76' : val > 35 ? '#d89b3c' : '#c4463c',
                            }}
                          />
                        </div>
                        <p className="mt-1.5 text-xs text-[#a89c86]">{desc}</p>
                        {plan.damageMissing > 0 && (
                          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs font-mono-num">
                            <span className="text-[#9ec4d1]">Time: {plan.durationSec}s</span>
                            {(Object.entries(plan.materials) as [ResourceId, number][]).map(([rId, qty]) => {
                              const have = Math.floor(p.inventory[rId] || 0);
                              return (
                                <span key={rId} className={have >= qty ? 'text-[#7ac59b]' : 'text-[#e38679]'}>
                                  {RESOURCE_DEFS[rId].name}: {have}/{qty}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        disabled={plan.damageMissing <= 0 || !affordable || busy}
                        onClick={() => setFeedback(onStartManualRepair(sec).message)}
                        className={`w-full py-2.5 text-sm font-bold rounded transition-colors ${
                          plan.damageMissing <= 0
                            ? 'bg-[#1d332a] text-[#83cca5] cursor-default'
                            : !busy && affordable
                              ? 'bg-[#c99d4e] hover:bg-[#dfb261] text-[#14100b] cursor-pointer'
                              : 'bg-[#1b2530] text-[#837b6d] cursor-not-allowed'
                        }`}
                      >
                        {plan.damageMissing <= 0
                          ? 'Section Intact (100%)'
                          : busy
                            ? 'Repair Crew Busy'
                            : 'Start Manual Repair'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: CREW ROSTER (8+1 ROLES + 3 ONE-CLICK AUTO-ASSIGN BUTTONS) */}
          {tab === 'crew' && (
            <div className="space-y-4">
              {/* 3 One-Click Auto Assign Buttons + Med count */}
              <div className="p-4 rounded bg-[#101a24] border border-[#c99d4e]/25 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setFeedback(onAutoAssignRoles('best').message)}
                    className="px-3.5 py-2 bg-[#c99d4e] hover:bg-[#dfb261] text-[#14100b] text-xs font-bold rounded cursor-pointer"
                  >
                    Auto Assign — Best Roles
                  </button>
                  <button
                    type="button"
                    onClick={() => setFeedback(onAutoAssignRoles('sailing').message)}
                    className="px-3.5 py-2 bg-[#21364a] hover:bg-[#2c4760] text-[#f7efe0] text-xs font-bold rounded cursor-pointer"
                  >
                    Sailing Priority
                  </button>
                  <button
                    type="button"
                    onClick={() => setFeedback(onAutoAssignRoles('combat').message)}
                    className="px-3.5 py-2 bg-[#4a2222] hover:bg-[#612c2c] text-[#ffe1dc] text-xs font-bold rounded cursor-pointer"
                  >
                    Combat Priority
                  </button>
                </div>
                <span className="font-mono-num text-sm text-[#9ec4d1] font-semibold">
                  Medical Supplies: {Math.floor(p.inventory.medicine)}
                </span>
              </div>

              {/* Active Role Counts */}
              <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-2">
                {CREW_ROLES.map((r) => (
                  <div
                    key={r}
                    className="px-2 py-1.5 rounded bg-[#0e1620] border border-[#c99d4e]/20 text-center"
                  >
                    <div className="font-mono-num text-sm font-bold text-[#efc570]">
                      {roleCounts[r]}
                    </div>
                    <div className="text-[11px] text-[#c4b79e] truncate">{CREW_ROLE_LABELS[r]}</div>
                  </div>
                ))}
              </div>

              {/* Crew Member Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {p.crew.map((m) => {
                  const lowHp = m.health < 25;
                  return (
                    <div
                      key={m.id}
                      className={`p-4 rounded bg-[#101a24] border flex flex-col gap-2.5 ${
                        lowHp ? 'border-[#e05a4d]' : 'border-[#c99d4e]/20'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-base font-bold text-[#f7efe0]">{m.name}</span>
                            <span className="px-2 py-0.5 rounded bg-[#1b2e3d] border border-[#c99d4e]/35 text-[#efc570] text-[11px] font-bold">
                              Rank {m.level ?? 1}
                            </span>
                            {m.forced && (
                              <span className="px-2 py-0.5 rounded bg-[#421f1f] text-[#f5b4ad] text-[11px] font-semibold">
                                Forced Captive
                              </span>
                            )}
                            {lowHp && (
                              <span className="px-2 py-0.5 rounded bg-[#701d1d] text-white text-[11px] font-bold">
                                CRITICAL &lt;25 HP
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-[#b7aa92]">
                            {m.origin} ·{' '}
                            <span className={m.condition === 'healthy' ? 'text-[#7ac59b]' : 'text-[#f19488]'}>
                              {m.condition}
                            </span>
                          </div>
                        </div>
                        <div className="text-right font-mono-num text-xs">
                          <div className={lowHp ? 'text-[#ff8b7e] font-bold' : 'text-[#f7efe0]'}>
                            HP {Math.round(m.health)}%
                          </div>
                          <div className="text-[#efc570]">Morale {Math.round(m.morale)}%</div>
                          <div className="text-[#9ec4d1]">Loyalty {Math.round(m.loyalty ?? 80)}%</div>
                        </div>
                      </div>

                      {/* Experience Progress Bar */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px] font-mono-num text-[#9ec4d1]">
                          <span>Experience</span>
                          <span>
                            {(m.level ?? 1) >= 15
                              ? 'MAX RANK'
                              : `${Math.floor(m.xp)} / ${xpThresholdForLevel(m.level ?? 1)} XP`}
                          </span>
                        </div>
                        <div className="h-1.5 bg-[#18232f] rounded-sm overflow-hidden">
                          <div
                            className="h-full bg-[#4e9f76] transition-all duration-200"
                            style={{
                              width: `${
                                (m.level ?? 1) >= 15
                                  ? 100
                                  : Math.min(100, Math.round((m.xp / Math.max(1, xpThresholdForLevel(m.level ?? 1))) * 100))
                              }%`,
                            }}
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono-num text-[#b8c4ce]">
                        <span>Sail {m.skills.sailing}</span>
                        <span>Rep {m.skills.repair}</span>
                        <span>Gun {m.skills.combat}</span>
                        <span>Nav {m.skills.navigation}</span>
                        <span>Str {m.skills.strength}</span>
                        <span>Fish {m.skills.fishing ?? 3}</span>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1">
                        <label className="flex items-center gap-2 text-xs text-[#cbbda4]">
                          <span>Role</span>
                          <select
                            aria-label={`Assign role for ${m.name}`}
                            value={m.role}
                            onChange={(e) => onAssignRole(m.id, e.target.value as CrewRole)}
                            className="bg-[#1b2735] border border-[#c99d4e]/35 rounded px-2.5 py-1.5 text-xs text-[#f7efe0] cursor-pointer"
                          >
                            {CREW_ROLES.map((r) => (
                              <option key={r} value={r}>
                                {CREW_ROLE_LABELS[r]}
                              </option>
                            ))}
                          </select>
                        </label>

                        {(m.health < 95 || m.condition !== 'healthy') && (
                          <button
                            type="button"
                            onClick={() => setFeedback(onTreatCrew(m.id).message)}
                            disabled={p.inventory.medicine < 1}
                            className="px-3 py-1.5 text-xs font-bold bg-[#2a5c4a] hover:bg-[#34725c] disabled:bg-[#1a242e] disabled:text-[#6f7880] text-[#f7efe0] rounded cursor-pointer transition-colors"
                          >
                            Treat (-1 Med)
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 5: CUSTOM SHIP FLAG */}
          {tab === 'flag' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              {/* Live Flag Preview */}
              <div className="p-5 rounded bg-[#101a24] border border-[#c99d4e]/25 flex flex-col items-center gap-4 lg:sticky lg:top-0 self-start">
                <h3 className="font-display text-sm uppercase tracking-wider text-[#d8ae5e] text-center">
                  Masthead Flag &amp; Sail Colors Preview (Syncs to Flagship &amp; Fleet)
                </h3>
                <canvas
                  ref={flagCanvasRef}
                  data-testid="custom-flag-preview"
                  width={320}
                  height={200}
                  className="w-full max-w-[320px] h-auto rounded border border-[#c99d4e]/45 bg-[#091119]"
                />
                <label className="flex items-center gap-2.5 text-sm text-[#dfd4be] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={save.customFlag.decorativeBorder}
                    onChange={(e) => setFlagField({ decorativeBorder: e.target.checked })}
                    className="w-4 h-4 accent-[#c99d4e]"
                  />
                  <span>Gilded Decorative Border Trim</span>
                </label>
              </div>

              {/* Flag & Vessel Name Controls */}
              <div className="space-y-4">
                {/* Pre-Chosen Ship Name Registry */}
                <div className="p-3.5 rounded bg-[#101a24] border border-[#c99d4e]/35 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-[#d8ae5e] font-bold">
                      <Ship className="w-3.5 h-3.5" />
                      <span>Vessel Name (Pre-Chosen Registry)</span>
                    </span>
                    <span className="text-[11px] text-[#9ec4d1] font-semibold">
                      {p.shipName}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      aria-label="Select Ship Name"
                      data-testid="flag-ship-name-select"
                      value={p.shipName}
                      onChange={(e) => setFeedback(onSetShipName(e.target.value).message)}
                      className="flex-1 bg-[#162330] border border-[#c99d4e]/40 rounded px-3 py-2 text-sm font-semibold text-[#f7efe0] focus:outline-none focus:border-[#efc570] cursor-pointer"
                    >
                      {PRE_CHOSEN_SHIP_NAMES.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      data-testid="flag-reroll-ship-name"
                      onClick={() => setFeedback(onSetShipName(pickRandomShipName(p.shipName)).message)}
                      className="px-3.5 py-2 rounded bg-[#1b2d3f] hover:bg-[#243c54] border border-[#c99d4e]/45 text-xs font-bold text-[#efc570] flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Reroll Name</span>
                    </button>
                  </div>
                </div>

                {/* Shape */}
                <div>
                  <div className="text-xs uppercase tracking-wider text-[#d8ae5e] font-bold mb-2">
                    Pennant Shape
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {FLAG_SHAPES.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setFlagField({ shape: s.id })}
                        className={`px-3 py-2 rounded text-xs font-semibold border cursor-pointer ${
                          save.customFlag.shape === s.id
                            ? 'bg-[#c99d4e] border-[#efc570] text-[#14100b]'
                            : 'bg-[#101a24] border-[#c99d4e]/25 text-[#e2d6bf]'
                        }`}
                      >
                        {s.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Pattern */}
                <div>
                  <div className="text-xs uppercase tracking-wider text-[#d8ae5e] font-bold mb-2">
                    Field Pattern
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {FLAG_PATTERNS.map((pat) => {
                      const unlocked = save.unlockedPatterns.includes(pat.id);
                      const active = save.customFlag.pattern === pat.id;
                      return (
                        <button
                          key={pat.id}
                          type="button"
                          onClick={() =>
                            unlocked
                              ? setFlagField({ pattern: pat.id })
                              : setFeedback(onBuyFlagCosmetic('pattern', pat.id, 95).message)
                          }
                          className={`px-3 py-2 rounded text-xs font-semibold border cursor-pointer ${
                            active
                              ? 'bg-[#c99d4e] border-[#efc570] text-[#14100b]'
                              : unlocked
                                ? 'bg-[#101a24] border-[#c99d4e]/25 text-[#e2d6bf]'
                                : 'bg-[#1b222a] border-[#c99d4e]/20 text-[#efc570]'
                          }`}
                        >
                          {pat.name} {!unlocked && '· Buy 95g'}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Primary / Secondary / Accent Dyes */}
                {(['primaryDye', 'secondaryDye', 'accentDye'] as const).map((slot) => (
                  <div key={slot}>
                    <div className="text-xs uppercase tracking-wider text-[#d8ae5e] font-bold mb-1.5">
                      {slot === 'primaryDye'
                        ? 'Primary Cloth Dye'
                        : slot === 'secondaryDye'
                          ? 'Secondary Cloth Dye'
                          : 'Emblem & Trim Dye'}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(Object.keys(FLAG_DYES) as FlagDyeId[]).map((dId) => {
                        const dye = FLAG_DYES[dId];
                        const unlocked = save.unlockedDyes.includes(dId);
                        const active = save.customFlag[slot] === dId;
                        return (
                          <button
                            key={`${slot}_${dId}`}
                            type="button"
                            title={unlocked ? dye.name : `Unlock ${dye.name} (${dye.price}g)`}
                            onClick={() =>
                              unlocked
                                ? setFlagField({ [slot]: dId })
                                : setFeedback(onBuyFlagCosmetic('dye', dId, dye.price).message)
                            }
                            className={`px-2.5 py-1.5 rounded text-xs font-semibold border flex items-center gap-1.5 cursor-pointer ${
                              active
                                ? 'border-[#efc570] ring-2 ring-[#efc570] bg-[#1e2c3a] text-white'
                                : 'border-[#c99d4e]/25 bg-[#101a24] text-[#dfd4be]'
                            }`}
                          >
                            <span
                              className="w-3.5 h-3.5 rounded-full border border-white/40 inline-block"
                              style={{ backgroundColor: dye.hex }}
                            />
                            <span>{dye.name}</span>
                            {!unlocked && <span className="text-[#efc570]">({dye.price}g)</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {/* Emblem */}
                <div>
                  <div className="text-xs uppercase tracking-wider text-[#d8ae5e] font-bold mb-2">
                    Heraldic Emblem
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {(Object.keys(FLAG_EMBLEMS) as FlagEmblemId[]).map((eId) => {
                      const em = FLAG_EMBLEMS[eId];
                      const unlocked = save.unlockedEmblems.includes(eId);
                      const active = save.customFlag.emblem === eId;
                      return (
                        <button
                          key={eId}
                          type="button"
                          onClick={() =>
                            unlocked
                              ? setFlagField({ emblem: eId })
                              : setFeedback(onBuyFlagCosmetic('emblem', eId, em.price).message)
                          }
                          className={`px-3 py-2 rounded text-xs font-semibold border cursor-pointer ${
                            active
                              ? 'bg-[#c99d4e] border-[#efc570] text-[#14100b]'
                              : unlocked
                                ? 'bg-[#101a24] border-[#c99d4e]/25 text-[#e2d6bf]'
                                : 'bg-[#1b222a] border-[#c99d4e]/20 text-[#efc570]'
                          }`}
                        >
                          {em.name} {!unlocked && `· Buy ${em.price}g`}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: LATE-GAME AUTONOMOUS FLEET */}
          {tab === 'fleet' && (
            <div className="space-y-6">
              {!fleetUnlock.unlocked && fleetList.length === 0 ? (
                <div className="p-6 rounded bg-[#101a24] border border-[#c99d4e]/40 space-y-4">
                  <h3 className="font-display text-xl font-bold text-[#efc570]">
                    Late-Game Fleet Command Locked
                  </h3>
                  <p className="text-sm text-[#d9ccb4] leading-relaxed">
                    Commanding escort vessels alongside your flagship requires a proven capital hull and a seasoned crew. Once unlocked, you may commission up to {MAX_FLEET_SIZE} vessels or capture defeated enemy warships—every ship automatically flies your custom flag, fights alongside you, and gathers supplies to upgrade itself.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div className="p-3.5 rounded bg-[#152230] border border-[#c99d4e]/25 flex items-center justify-between">
                      <span className="text-[#c4b79e]">Flagship Hull Tier</span>
                      <span className={`font-mono-num font-bold ${p.upgrades.hullTier >= 3 ? 'text-[#7ac59b]' : 'text-[#f19488]'}`}>
                        Tier {p.upgrades.hullTier} / 3
                      </span>
                    </div>
                    <div className="p-3.5 rounded bg-[#152230] border border-[#c99d4e]/25 flex items-center justify-between">
                      <span className="text-[#c4b79e]">Signed Crew</span>
                      <span className={`font-mono-num font-bold ${p.crew.length >= 12 ? 'text-[#7ac59b]' : 'text-[#f19488]'}`}>
                        {p.crew.length} / 12
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* Active Fleet Squadron */}
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-display text-base uppercase tracking-wider text-[#d8ae5e]">
                        Active Escort Squadron ({fleetList.length} / {MAX_FLEET_SIZE} Vessels)
                      </h3>
                      <span className="text-xs text-[#9ec4d1]">
                        All ships share your custom flag and evolve autonomously from their own salvage &amp; trade.
                      </span>
                    </div>

                    {fleetList.length === 0 ? (
                      <div className="p-5 rounded bg-[#101a24] border border-[#c99d4e]/25 text-sm text-[#c4b79e]">
                        No escort vessels commissioned yet. Purchase a vessel below or claim defeated pirate ships after naval victories!
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {fleetList.map((fs) => {
                          const spec = FLEET_CLASS_SPECS[fs.shipClass];
                          const hpPct = Math.max(0, Math.round((fs.hull / Math.max(1, fs.maxHull)) * 100));
                          const isSunk = Boolean(fs.sunk || fs.hull <= 0);
                          const inDanger = !isSunk && hpPct < 28;
                          const atRisk = !isSunk && !inDanger && hpPct < 45;
                          const draft = renameDrafts[fs.id] ?? fs.name;
                          return (
                            <div
                              key={fs.id}
                              className={`p-4 rounded bg-[#101a24] border space-y-3 ${
                                isSunk
                                  ? 'border-[#6b2424] opacity-75'
                                  : inDanger
                                    ? 'border-[#e05a4d]'
                                    : atRisk
                                      ? 'border-[#d89b3c]'
                                      : 'border-[#c99d4e]/35'
                              }`}
                            >
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div className="flex items-center gap-2 flex-1 min-w-[180px]">
                                  <input
                                    type="text"
                                    value={draft}
                                    disabled={isSunk}
                                    aria-label={`Rename ${fs.name}`}
                                    onChange={(e) =>
                                      setRenameDrafts((prev) => ({ ...prev, [fs.id]: e.target.value }))
                                    }
                                    onBlur={() => {
                                      if (!isSunk && draft.trim() && draft.trim() !== fs.name) {
                                        onRenameFleetShip(fs.id, draft);
                                        setFeedback(`Renamed escort vessel to ${draft.trim()}.`);
                                      }
                                    }}
                                    className="bg-[#182634] border border-[#c99d4e]/30 rounded px-2.5 py-1 text-sm font-bold text-[#f7efe0] w-full max-w-[210px]"
                                  />
                                  {!isSunk && draft.trim() !== fs.name && draft.trim().length > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        onRenameFleetShip(fs.id, draft);
                                        setFeedback(`Renamed escort vessel to ${draft.trim()}.`);
                                      }}
                                      className="px-2 py-1 text-xs font-bold bg-[#c99d4e] text-[#14100b] rounded cursor-pointer"
                                    >
                                      Save
                                    </button>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {isSunk ? (
                                    <span className="px-2 py-0.5 rounded bg-[#5c1919] text-[#ffd4cf] text-[11px] font-bold">
                                      SUNK AT SEA
                                    </span>
                                  ) : inDanger ? (
                                    <span className="px-2 py-0.5 rounded bg-[#6b1d1d] text-white text-[11px] font-bold">
                                      IN DANGER ({hpPct}% HP)
                                    </span>
                                  ) : atRisk ? (
                                    <span className="px-2 py-0.5 rounded bg-[#4a3216] text-[#ffd894] text-[11px] font-bold">
                                      AT RISK
                                    </span>
                                  ) : null}
                                  <span className="px-2 py-0.5 rounded bg-[#192b3a] text-[#efc570] text-xs font-semibold">
                                    {spec.label}
                                  </span>
                                </div>
                              </div>

                              <div className="grid grid-cols-3 gap-2 text-xs font-mono-num text-[#d6cbb6]">
                                <span>Hull Tier {fs.hullTier}/5</span>
                                <span>Decks +{fs.deckLevel}</span>
                                <span>{fs.cannons} Guns (T{fs.cannonTier})</span>
                                <span>Crew {fs.crewCount}/{fs.maxCrew}</span>
                                <span>Stage {fs.upgradeStage}</span>
                                <span>{hpPct}% HP</span>
                              </div>

                              <div className="h-2 bg-[#1a2633] rounded-sm overflow-hidden">
                                <div
                                  className="h-full"
                                  style={{
                                    width: `${hpPct}%`,
                                    backgroundColor: hpPct > 60 ? '#4e9f76' : hpPct > 30 ? '#d89b3c' : '#c4463c',
                                  }}
                                />
                              </div>

                              {!isSunk && (
                                <>
                                  <div className="space-y-1">
                                    <div className="flex items-center justify-between text-[11px] font-mono-num text-[#9ec4d1]">
                                      <span>Autonomous Refit Progress</span>
                                      <span>{Math.round(fs.upgradeProgress * 100)}%</span>
                                    </div>
                                    <div className="h-1.5 bg-[#18232f] rounded-sm overflow-hidden">
                                      <div
                                        className="h-full bg-[#c99d4e]"
                                        style={{ width: `${Math.min(100, Math.round(fs.upgradeProgress * 100))}%` }}
                                      />
                                    </div>
                                    <div className="text-[11px] font-mono-num text-[#a89c86]">
                                      Stores: Wood {Math.floor(fs.autonomousResources.wood)} · Iron {Math.floor(fs.autonomousResources.iron)} · Cloth {Math.floor(fs.autonomousResources.cloth)} · Food {Math.floor(fs.autonomousResources.food ?? 0)} · Water {Math.floor(fs.autonomousResources.water ?? 0)} · {Math.floor(fs.autonomousResources.gold)}g
                                    </div>
                                  </div>

                                  {/* 3 Simple Fleet Commands */}
                                  <div className="grid grid-cols-3 gap-2 pt-1">
                                    {(
                                      [
                                        ['follow', 'Follow'],
                                        ['defend', 'Defend'],
                                        ['hold', 'Hold Position'],
                                      ] as [FleetCommand, string][]
                                    ).map(([cmd, label]) => (
                                      <button
                                        key={cmd}
                                        type="button"
                                        onClick={() => onSetFleetCommand(fs.id, cmd)}
                                        className={`py-1.5 px-2 rounded text-xs font-bold border cursor-pointer transition-colors ${
                                          fs.command === cmd
                                            ? 'bg-[#c99d4e] border-[#efc570] text-[#14100b]'
                                            : 'bg-[#162330] hover:bg-[#1e3042] border-[#c99d4e]/25 text-[#e2d6bf]'
                                        }`}
                                      >
                                        {label}
                                      </button>
                                    ))}
                                  </div>
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Commission New Fleet Ships */}
                  <div className="space-y-3">
                    <h3 className="font-display text-base uppercase tracking-wider text-[#d8ae5e]">
                      Commission Fleet Escort Vessels
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {FLEET_CLASS_ORDER.map((cls) => {
                        const spec = FLEET_CLASS_SPECS[cls];
                        const full = fleetList.length >= MAX_FLEET_SIZE;
                        const affordable =
                          !full &&
                          canAffordCosts(p.gold, p.inventory, spec.goldCost, spec.resourceCost);
                        return (
                          <div
                            key={cls}
                            className="p-4 rounded bg-[#101a24] border border-[#c99d4e]/25 flex flex-col justify-between gap-3"
                          >
                            <div className="space-y-1.5">
                              <div className="flex items-baseline justify-between gap-2">
                                <h4 className="text-base font-bold text-[#f7efe0]">{spec.label}</h4>
                                <span className="font-mono-num text-sm font-bold text-[#efc570]">
                                  {spec.goldCost}g
                                </span>
                              </div>
                              <p className="text-xs text-[#b7aa92] leading-snug">{spec.description}</p>
                              <div className="text-xs font-mono-num text-[#9ec4d1]">
                                Hull {spec.baseHull} · {spec.baseCannons} Guns · {spec.baseCrew} Crew · {spec.baseSpeed} kt
                              </div>
                              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs font-mono-num pt-1">
                                {(Object.entries(spec.resourceCost) as [ResourceId, number][]).map(([rId, qty]) => {
                                  const have = Math.floor(p.inventory[rId] || 0);
                                  return (
                                    <span key={rId} className={have >= qty ? 'text-[#7ac59b]' : 'text-[#e38679]'}>
                                      {RESOURCE_DEFS[rId].name}: {have}/{qty}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                            <button
                              type="button"
                              disabled={!affordable}
                              onClick={() => setFeedback(onBuyFleetShip(cls).message)}
                              className={`w-full py-2 text-sm font-bold rounded transition-colors ${
                                affordable
                                  ? 'bg-[#c99d4e] hover:bg-[#dfb261] text-[#14100b] cursor-pointer'
                                  : 'bg-[#1a2530] text-[#837b6d] cursor-not-allowed'
                              }`}
                            >
                              {full ? 'Fleet At Max Capacity (5/5)' : `Commission ${spec.shortRole}`}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB 7: CARGO, FACTIONS & TAMED BEASTS */}
          {tab === 'cargo' && (
            <div className="space-y-6">
              {/* 10 Pirate Faction Standings */}
              <div>
                <h3 className="font-display text-base uppercase tracking-wider text-[#d8ae5e] mb-3">
                  10 Pirate Factions — Diplomacy &amp; World Balance
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {PIRATE_FACTION_IDS.map((fid) => {
                    const fState = save.factions[fid];
                    const meta = PIRATE_FACTIONS[fid];
                    if (!fState || !meta) return null;
                    const allied = fState.alliedUntilDay >= save.day;
                    return (
                      <div
                        key={fid}
                        className="p-4 rounded bg-[#101a24] border border-[#c99d4e]/25 space-y-1.5"
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <h4 className="text-sm font-bold text-[#f7efe0]">{meta.name}</h4>
                          <span className="font-mono-num text-xs font-bold text-[#efc570]">
                            Standing {fState.playerStanding > 0 ? `+${fState.playerStanding}` : fState.playerStanding}
                          </span>
                        </div>
                        <div className="text-xs text-[#9ec4d1]">
                          Fleet Strength {Math.round(fState.strength)}%
                          {allied ? ` · Allied until Day ${fState.alliedUntilDay}` : ''}
                          {fState.leaderDefeated ? ' · Leader Defeated' : ''}
                        </div>
                        <div className="text-[11px] text-[#b7aa92]">
                          At War With:{' '}
                          {PIRATE_FACTION_IDS.filter((other) => other !== fid && fState.relations?.[other] === 'war')
                            .map((other) => PIRATE_FACTIONS[other].shortName)
                            .join(', ') || 'None'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Ghost Ship Spectral Relics */}
              {(save.ghostCollectibles?.length ?? 0) > 0 && (
                <div>
                  <h3 className="font-display text-base uppercase tracking-wider text-[#5eead4] mb-2">
                    Ghost Ship Spectral Relics ({save.ghostCollectibles.length})
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {save.ghostCollectibles.map((relic, idx) => (
                      <span
                        key={`${relic}_${idx}`}
                        className="px-3 py-1.5 rounded bg-[#0f2628] border border-[#5eead4]/45 text-xs font-bold text-[#9bf7e9]"
                      >
                        {relic}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Tamed Sea Monsters */}
              {save.tamedMonsters.length > 0 && (
                <div>
                  <h3 className="font-display text-base uppercase tracking-wider text-[#d8ae5e] mb-2">
                    Tamed Sea Companions ({save.tamedMonsters.length})
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {save.tamedMonsters.map((tm) => (
                      <div
                        key={tm.id}
                        className="p-3.5 rounded bg-[#122624] border border-[#4e9f76]/45 flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-bold text-[#f7efe0]">{tm.name}</div>
                          <div className="text-[#9ec4d1] capitalize">{tm.species.replace('_', ' ')}</div>
                        </div>
                        <span className="font-mono-num text-[#7ac59b] font-bold">
                          HP {Math.round(tm.hp)}/{tm.maxHp}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Cargo Hold */}
              <div className="space-y-4">
                <div className="flex items-center justify-between text-sm text-[#cbbda4]">
                  <span>Cargo Hold Weight</span>
                  <span className="font-mono-num font-bold text-[#f7efe0]">
                    {cargoUsed.toFixed(1)} / {cargoCap} tons
                  </span>
                </div>
                <div className="h-2.5 bg-[#1a2633] rounded-sm overflow-hidden">
                  <div
                    className="h-full bg-[#c99d4e]"
                    style={{ width: `${Math.min(100, (cargoUsed / Math.max(1, cargoCap)) * 100)}%` }}
                  />
                </div>

                {/* Galley Fish-to-Provisions Converter */}
                <div className="p-4 rounded bg-[#101a24] border border-[#c99d4e]/35 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-wider font-bold text-[#efc570]">
                      Ship Galley · Salt &amp; Preserve Catch
                    </div>
                    <p className="text-xs text-[#cbbda4] mt-0.5">
                      Convert caught fish into preserved food rations (1 Fish Catch = +3 Food · 1 Rare Trophy Fish = +6 Food).
                    </p>
                    <div className="text-xs font-mono-num text-[#9ec4d1] mt-1">
                      Fresh Catch: <strong>{Math.floor(p.inventory.fishCatch || 0)}</strong> · Rare Trophy:{' '}
                      <strong>{Math.floor(p.inventory.rareFish || 0)}</strong> · Provisions:{' '}
                      <strong>{Math.floor(p.inventory.food || 0)}</strong>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      data-testid="convert-fish-btn"
                      disabled={(p.inventory.fishCatch || 0) < 1}
                      onClick={() => setFeedback(onConvertFishToFood('fishCatch', 1).message)}
                      className="px-3 py-1.5 rounded bg-[#2a5c4a] hover:bg-[#34725c] disabled:bg-[#1a242e] disabled:text-[#6f7880] text-xs font-bold text-white cursor-pointer"
                    >
                      Salt 1 Fish (+3 Food)
                    </button>
                    <button
                      type="button"
                      disabled={(p.inventory.fishCatch || 0) < 1}
                      onClick={() => setFeedback(onConvertFishToFood('fishCatch', Math.floor(p.inventory.fishCatch || 0)).message)}
                      className="px-3 py-1.5 rounded bg-[#3d8b68] hover:bg-[#49a37b] disabled:bg-[#1a242e] disabled:text-[#6f7880] text-xs font-bold text-white cursor-pointer"
                    >
                      Salt All Regular
                    </button>
                    <button
                      type="button"
                      data-testid="convert-rare-fish-btn"
                      disabled={(p.inventory.rareFish || 0) < 1}
                      onClick={() => setFeedback(onConvertFishToFood('rareFish', 1).message)}
                      className="px-3 py-1.5 rounded bg-[#c99d4e] hover:bg-[#dfb261] disabled:bg-[#1a242e] disabled:text-[#6f7880] text-xs font-bold text-[#14100b] cursor-pointer"
                    >
                      Salt 1 Rare (+6 Food)
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs uppercase tracking-wider font-bold text-[#efc570]">
                    Valuable Trade Cargo
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {RESOURCE_LIST.filter((r) => r.isValuableCargo).map((r) => {
                      const qty = Math.floor(p.inventory[r.id] || 0);
                      return (
                        <div
                          key={r.id}
                          className="p-3.5 rounded bg-[#121c27] border border-[#c99d4e]/35 flex flex-col justify-between gap-1.5"
                        >
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-sm font-bold text-[#f7efe0]">{r.name}</span>
                            <span className="font-mono-num text-base font-bold text-[#efc570]">{qty}</span>
                          </div>
                          <p className="text-xs text-[#a99c85] leading-snug">{r.description}</p>
                          <div className="text-[11px] font-mono-num text-[#879aa8]">
                            Valuable · {r.weight}t/unit · Est. {r.basePrice}g
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs uppercase tracking-wider font-bold text-[#9ec4d1]">
                    Ship Supplies &amp; Construction Materials
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {RESOURCE_LIST.filter((r) => !r.isValuableCargo).map((r) => {
                      const qty = Math.floor(p.inventory[r.id] || 0);
                      return (
                        <div
                          key={r.id}
                          className="p-3.5 rounded bg-[#101a24] border border-[#c99d4e]/20 flex flex-col justify-between gap-1.5"
                        >
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-sm font-bold text-[#f7efe0]">{r.name}</span>
                            <span className="font-mono-num text-base font-bold text-[#efc570]">{qty}</span>
                          </div>
                          <p className="text-xs text-[#a99c85] leading-snug">{r.description}</p>
                          <div className="text-[11px] font-mono-num text-[#879aa8]">
                            {r.rarity} · {r.weight}t/unit · Est. {r.basePrice}g
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
