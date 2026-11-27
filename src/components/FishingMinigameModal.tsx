import React, { useEffect, useRef, useState } from 'react';
import { Anchor, Fish, Skull, X } from 'lucide-react';
import { FishingCatchSpec, FishingGearId, HudSnapshot, OceanBiomeId } from '../game/types';
import {
  FISHING_GEAR_SPECS,
  getManualFishingGaugeConfig,
  getTargetGaugeConfig,
  getFishingCastCost,
  pickFishingCatchForBiome,
} from '../game/fishing';

interface FishingMinigameModalProps {
  biome: OceanBiomeId;
  biomeLabel: string;
  fishingGear: FishingGearId;
  nearbyTarget?: HudSnapshot['nearbyFishTarget'];
  onClose: () => void;
  onPayCast: (target: { kind: 'sea_wildlife' | 'monster_carcass'; id: string } | null) => { ok: boolean; cost: number; message: string };
  onCatchSuccess: (spec: FishingCatchSpec) => { ok: boolean; message: string };
  onHarvestNearbyTarget?: (
    kind: 'monster_carcass' | 'sea_wildlife',
    id: string
  ) => { ok: boolean; message: string; foodAdded: number; saltAdded: number };
}

type FishingPhase = 'ready' | 'waiting' | 'reeling' | 'result';

export const FishingMinigameModal: React.FC<FishingMinigameModalProps> = ({
  biome,
  biomeLabel,
  fishingGear,
  nearbyTarget,
  onClose,
  onPayCast,
  onCatchSuccess,
  onHarvestNearbyTarget,
}) => {
  const [phase, setPhase] = useState<FishingPhase>('ready');
  const [targetSpec, setTargetSpec] = useState<FishingCatchSpec | null>(null);
  const [lockedNearbyTarget, setLockedNearbyTarget] = useState<HudSnapshot['nearbyFishTarget']>(null);
  const [needlePos, setNeedlePos] = useState(0.5);
  const [resultMsg, setResultMsg] = useState<string | null>(null);
  const [caught, setCaught] = useState(false);

  const needleRef = useRef(0.5);
  const dirRef = useRef(1);
  const animRef = useRef<number>(0);

  const gearSpec = FISHING_GEAR_SPECS[fishingGear] ?? FISHING_GEAR_SPECS.none;
  const activeSpecial = lockedNearbyTarget ?? nearbyTarget ?? null;
  const isDeepBarren = biome === 'deep' && !activeSpecial;

  const gaugeCfg = lockedNearbyTarget
    ? getTargetGaugeConfig(lockedNearbyTarget.sizeTier)
    : targetSpec
      ? getManualFishingGaugeConfig(targetSpec, fishingGear)
      : { sweetWidth: 0.28, needleSpeed: 0.85, sweetCenter: 0.5 };

  const startCast = () => {
    if (biome === 'deep' && !nearbyTarget) return;
    const paid = onPayCast(nearbyTarget ? { kind: nearbyTarget.kind, id: nearbyTarget.id } : null);
    if (!paid.ok) {
      setCaught(false);
      setResultMsg(paid.message);
      setPhase('result');
      return;
    }
    if (nearbyTarget) {
      setLockedNearbyTarget(nearbyTarget);
      setTargetSpec(null);
    } else {
      setLockedNearbyTarget(null);
      const rolled = pickFishingCatchForBiome(biome, fishingGear, Math.random);
      setTargetSpec(rolled);
    }
    setResultMsg(null);
    setCaught(false);
    setPhase('waiting');
    window.setTimeout(() => {
      needleRef.current = 0.12;
      dirRef.current = 1;
      setNeedlePos(0.12);
      setPhase('reeling');
    }, 420);
  };

  useEffect(() => {
    if (phase !== 'reeling') return;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      let next = needleRef.current + dirRef.current * gaugeCfg.needleSpeed * dt;
      if (next >= 0.98) {
        next = 0.98;
        dirRef.current = -1;
      } else if (next <= 0.02) {
        next = 0.02;
        dirRef.current = 1;
      }
      needleRef.current = next;
      setNeedlePos(next);
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [phase, gaugeCfg.needleSpeed]);

  const attemptHook = () => {
    if (phase !== 'reeling') return;
    if (!lockedNearbyTarget && !targetSpec) return;
    cancelAnimationFrame(animRef.current);
    const halfSweet = gaugeCfg.sweetWidth * 0.5;
    const hit = Math.abs(needleRef.current - gaugeCfg.sweetCenter) <= halfSweet;

    if (hit) {
      if (lockedNearbyTarget && onHarvestNearbyTarget) {
        const res = onHarvestNearbyTarget(lockedNearbyTarget.kind, lockedNearbyTarget.id);
        setCaught(res.ok);
        setResultMsg(res.message);
        setLockedNearbyTarget(null);
      } else if (targetSpec) {
        const res = onCatchSuccess(targetSpec);
        setCaught(res.ok);
        setResultMsg(
          res.ok
            ? `${res.message} (+${targetSpec.foodValue} food value if salted)`
            : res.message
        );
      }
    } else {
      setCaught(false);
      setResultMsg(
        lockedNearbyTarget
          ? 'The heavy haul slipped the grappling hook! Cast again.'
          : `The ${targetSpec?.species ?? 'fish'} snapped off the hook! Cast again.`
      );
    }
    setPhase('result');
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' && phase === 'reeling') {
        e.preventDefault();
        attemptHook();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const sweetLeftPct = Math.round((gaugeCfg.sweetCenter - gaugeCfg.sweetWidth * 0.5) * 100);
  const sweetWidthPct = Math.round(gaugeCfg.sweetWidth * 100);

  return (
    <div
      data-testid="fishing-modal"
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Shipboard Fishing"
    >
      <div className="nautical-panel rounded-lg w-full max-w-lg p-6 space-y-5">
        <div className="flex items-start justify-between gap-4 border-b border-[#c99d4e]/25 pb-3">
          <div>
            <h2 className="font-display text-2xl font-bold text-[#f7efe0] flex items-center gap-2">
              {activeSpecial?.kind === 'monster_carcass' ? (
                <Skull className="w-6 h-6 text-[#efc570]" />
              ) : (
                <Fish className="w-6 h-6 text-[#efc570]" />
              )}
              <span>
                {activeSpecial?.kind === 'monster_carcass'
                  ? 'Monster Carcass Salvage Line'
                  : activeSpecial?.kind === 'sea_wildlife'
                    ? 'Marine Creature Fishing'
                    : 'Deck Fishing Line'}
              </span>
            </h2>
            <p className="text-xs text-[#9ec4d1] mt-0.5">
              Waters: <strong className="text-[#f7efe0]">{biomeLabel}</strong> · Rig:{' '}
              <strong className="text-[#efc570]">{gearSpec.name}</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Fishing"
            className="p-2 text-[#cbbda4] hover:text-white hover:bg-[#1e2c3a] rounded cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {activeSpecial && (
          <div
            data-testid="fishing-special-target"
            className="p-3 rounded bg-[#142733] border border-[#efc570]/50 text-xs text-[#e8f4f8]"
          >
            <strong className="text-[#efc570]">Nearby Target ({activeSpecial.distance}m):</strong>{' '}
            {activeSpecial.label}
          </div>
        )}

        <div className="p-4 rounded bg-[#0e1722] border border-[#c99d4e]/25 space-y-4">
          {phase === 'ready' && (
            <div className="space-y-3 text-center">
              {isDeepBarren ? (
                <p
                  data-testid="fishing-deep-warning"
                  className="text-sm text-[#f19488] leading-relaxed"
                >
                  The Abyssal Deep holds no ordinary fish schools—only sea monsters lurk here. Sail to Tropical, Normal, or Frozen waters, or slay a monster to fish its floating carcass!
                </p>
              ) : (
                <>
                  <p className="text-sm text-[#dfd4be]">
                    {nearbyTarget?.kind === 'monster_carcass'
                      ? 'Set heavy grappling lines into the floating monster carcass and time your pull inside the amber zone to haul its vast Provisions & Sea Salt aboard!'
                      : nearbyTarget?.kind === 'sea_wildlife'
                        ? 'Lower nets and lines beside the nearby marine pod! Time your strike inside the amber zone to harvest fresh Provisions & Sea Salt.'
                        : 'Lower a baited hemp line over the rail. Time your strike inside the amber zone to haul the catch aboard!'}
                  </p>
                  <button
                    type="button"
                    data-testid="fishing-cast-btn"
                    onClick={startCast}
                    className="px-6 py-2.5 bg-[#c99d4e] hover:bg-[#dfb261] text-[#14100b] text-sm font-bold rounded cursor-pointer"
                  >
                    {nearbyTarget ? `Haul Target Line (${nearbyTarget.castCost}g)` : `Cast Line Over Side (${getFishingCastCost(null)}g)`}
                  </button>
                </>
              )}
            </div>
          )}

          {phase === 'waiting' && (
            <div className="py-6 text-center text-sm text-[#9ec4d1] font-semibold">
              {lockedNearbyTarget
                ? `Lowering heavy lines onto ${lockedNearbyTarget.label}...`
                : `Line drifting in ${biomeLabel}... waiting for a tug...`}
            </div>
          )}

          {phase === 'reeling' && (lockedNearbyTarget || targetSpec) && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#efc570] font-bold">
                  {lockedNearbyTarget
                    ? lockedNearbyTarget.kind === 'monster_carcass'
                      ? 'Carcass hooked! Haul steady!'
                      : 'Pod on the line! Haul aboard!'
                    : `Bite on the line! (${targetSpec?.rarity})`}
                </span>
                <span className="text-[#9ec4d1]">Press [Space] or Click Hook!</span>
              </div>

              <div className="relative h-7 bg-[#152230] rounded border border-[#c99d4e]/40 overflow-hidden">
                <div
                  className="absolute top-0 bottom-0 bg-[#c99d4e]/45 border-x border-[#efc570]"
                  style={{ left: `${sweetLeftPct}%`, width: `${sweetWidthPct}%` }}
                />
                <div
                  data-testid="fishing-needle"
                  className="absolute top-0 bottom-0 w-1.5 bg-[#f7efe0] shadow"
                  style={{ left: `calc(${Math.round(needlePos * 100)}% - 3px)` }}
                />
              </div>

              <button
                type="button"
                data-testid="fishing-hook-btn"
                onClick={attemptHook}
                className="w-full py-2.5 bg-[#3d8b68] hover:bg-[#49a37b] text-white text-sm font-bold rounded cursor-pointer"
              >
                {lockedNearbyTarget ? 'Haul Provisions & Salt! [Space]' : 'Hook & Haul Aboard! [Space]'}
              </button>
            </div>
          )}

          {phase === 'result' && (
            <div className="space-y-3 text-center">
              <div
                data-testid="fishing-result-msg"
                className={`p-3 rounded border text-sm font-semibold ${
                  caught
                    ? 'bg-[#132920] border-[#4e9f76]/60 text-[#bbf7d0]'
                    : 'bg-[#361a1a] border-[#e05a4d]/60 text-[#ffd5d0]'
                }`}
              >
                {resultMsg}
              </div>
              <div className="flex items-center justify-center gap-3">
                {(!caught || !isDeepBarren) && !caught && nearbyTarget && (
                  <button
                    type="button"
                    data-testid="fishing-again-btn"
                    onClick={startCast}
                    className="px-5 py-2 bg-[#c99d4e] hover:bg-[#dfb261] text-[#14100b] text-sm font-bold rounded cursor-pointer"
                  >
                    Try Haul Again ({nearbyTarget.castCost}g)
                  </button>
                )}
                {!isDeepBarren && !nearbyTarget && (
                  <button
                    type="button"
                    data-testid="fishing-again-btn"
                    onClick={startCast}
                    className="px-5 py-2 bg-[#c99d4e] hover:bg-[#dfb261] text-[#14100b] text-sm font-bold rounded cursor-pointer"
                  >
                    Cast Again ({getFishingCastCost(null)}g)
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-[#1c2a38] hover:bg-[#273a4d] text-[#f7efe0] text-sm font-semibold rounded cursor-pointer flex items-center gap-1.5"
                >
                  <Anchor className="w-4 h-4" />
                  <span>Return to Helm</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
