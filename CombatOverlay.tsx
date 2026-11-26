import React, { useState } from 'react';
import {
  CombatCommand,
  HudSnapshot,
  MerchantShipData,
  PirateShipData,
  ResourceId,
  WreckSurvivor,
} from '../game/types';
import { RESOURCE_DEFS, VESSEL_CLASS_LABELS, WEAPON_SPECS } from '../game/economy';
import { PIRATE_FACTIONS } from '../game/factions';
import { computeFleetRecruitCost, MAX_FLEET_SIZE } from '../game/fleet';

interface PirateHailModalProps {
  pirate: PirateShipData;
  playerGold: number;
  onRespond: (choice: 'pay' | 'fight' | 'evade') => void;
  errorMsg: string | null;
}

export const PirateHailModal: React.FC<PirateHailModalProps> = ({
  pirate,
  playerGold,
  onRespond,
  errorMsg,
}) => {
  const factionName = PIRATE_FACTIONS[pirate.factionId]?.name ?? 'Pirate Fleet';
  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/72 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Pirate Ship Hail"
    >
      <div className="nautical-panel rounded-lg w-full max-w-lg p-6 space-y-4">
        <div className="border-b border-[#c99d4e]/25 pb-3">
          <p className="text-xs uppercase tracking-widest text-[#e67064] font-bold">
            {factionName} · Rank {pirate.rank} {pirate.rankTitle}
            {pirate.isBoss ? ' · BOSS' : ''}
          </p>
          <h2 className="font-display text-2xl font-bold text-[#f7efe0] mt-1">{pirate.name}</h2>
          <p className="text-sm text-[#c4b79e] mt-0.5">
            {pirate.captainName} · {pirate.crewCount} Pirates · {pirate.cannons} Cannons
          </p>
        </div>

        <blockquote className="p-4 rounded bg-[#101820] border border-[#c99d4e]/20 text-sm text-[#e8decb] italic leading-relaxed">
          “{pirate.demand.message}”
        </blockquote>

        {errorMsg && (
          <div className="px-3.5 py-2 rounded bg-[#3b1c1c] border border-[#c4463c]/60 text-sm text-[#f6c5c0]">
            {errorMsg}
          </div>
        )}

        <div className="text-sm text-[#b8ac95]">
          Demand: <strong className="text-[#efc570]">{pirate.demand.amount} {pirate.demand.demandType}</strong> · Your Gold:{' '}
          <strong className="font-mono-num text-[#f7efe0]">{playerGold}g</strong>
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
          <button
            type="button"
            onClick={() => onRespond('fight')}
            className="flex-1 py-2.5 px-4 bg-[#a93b33] hover:bg-[#c0473e] text-white text-sm font-bold rounded cursor-pointer transition-colors"
          >
            Refuse &amp; Battle
          </button>
          <button
            type="button"
            onClick={() => onRespond('evade')}
            className="flex-1 py-2.5 px-4 bg-[#203244] hover:bg-[#2b4258] text-[#f3ead6] text-sm font-bold rounded cursor-pointer transition-colors"
          >
            Escape Battle
          </button>
          <button
            type="button"
            onClick={() => onRespond('pay')}
            className="flex-1 py-2.5 px-4 bg-[#c99d4e] hover:bg-[#dbaf60] text-[#14100b] text-sm font-bold rounded cursor-pointer transition-colors"
          >
            Surrender Tribute
          </button>
        </div>
      </div>
    </div>
  );
};

interface CombatCommandBarProps {
  hud: HudSnapshot;
  onSetCommand: (cmd: CombatCommand) => void;
  onSelectTarget?: (enemyId: string) => void;
}

export const CombatCommandBar: React.FC<CombatCommandBarProps> = ({
  hud,
  onSetCommand,
  onSelectTarget,
}) => {
  const [confirmSurrender, setConfirmSurrender] = useState(false);

  const enemies =
    hud.activeEnemies && hud.activeEnemies.length > 0
      ? hud.activeEnemies
      : hud.activeEnemy
        ? [
            {
              ...hud.activeEnemy,
              id: hud.combat.primaryTargetId || 'primary',
              isPrimary: true,
              behaviorLabel: undefined,
              intelligenceLabel: undefined,
            },
          ]
        : [];

  const primaryEnemy = enemies.find((e) => e.isPrimary) ?? enemies[0];
  if (!hud.combat.active || !primaryEnemy) return null;

  const spec = WEAPON_SPECS[hud.upgrades.weaponType];
  const primaryDist = Math.round(primaryEnemy.distance ?? 0);
  const inRange = hud.upgrades.cannonCount > 0 && primaryDist <= spec.range;
  const playerHullPct = Math.max(0, Math.min(100, Math.round(hud.condition.hull)));
  const reloadPct = Math.max(0, Math.min(100, Math.round(hud.combat.playerReload * 100)));

  const canSurrender = primaryEnemy.kind !== 'monster' && !hud.activePirate?.isGhost;
  const pirateGoldTribute = Math.round(hud.gold * 0.35);
  const pirateFoodTribute = Math.round(hud.food * 0.25);
  const restitutionCost = Math.round(hud.gold * 0.4);
  const allies = hud.assistingAllies ?? [];

  return (
    <div
      data-testid="combat-command-bar"
      className="fixed bottom-3 left-1/2 -translate-x-1/2 z-20 w-[min(880px,96vw)] nautical-panel rounded-lg p-3.5 sm:p-4 pointer-events-auto space-y-2.5"
    >
      {/* Top Bar: Your Vessel + Optional Assisting Allies */}
      <div className="space-y-1.5 pb-2 border-b border-[#c99d4e]/25">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <div className="flex items-center gap-3">
            <span className="font-bold text-[#f7efe0]">Your Vessel</span>
            <span className="font-mono-num text-xs text-[#d6cbb6]">
              Hull <strong className="text-[#f7efe0]">{playerHullPct}%</strong> · Crew{' '}
              <strong className="text-[#f7efe0]">{hud.crewCount}</strong>
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs text-[#b8ac95]">
            {allies.length > 0 && (
              <span
                data-testid="assisting-allies-label"
                className="font-semibold text-[#7ac59b]"
              >
                Allies Assisting: {allies.slice(0, 2).join(', ')}
                {allies.length > 2 ? ` +${allies.length - 2}` : ''}
              </span>
            )}
            <span>
              {hud.upgrades.cannonCount === 0
                ? 'No Cannons Mounted'
                : !inRange
                  ? `Closing Range (${primaryDist}m / ${spec.range}m)`
                  : `Auto-Cannons (${hud.upgrades.cannonCount})`}
            </span>
            <div className="flex items-center gap-1.5 min-w-[105px]">
              <div className="flex-1 h-2 bg-[#1a2633] rounded-sm overflow-hidden">
                <div className="h-full bg-[#c99d4e]" style={{ width: `${reloadPct}%` }} />
              </div>
              <span className="font-mono-num text-[#efc570] w-9 text-right font-bold">
                {reloadPct}%
              </span>
            </div>
          </div>
        </div>
        <div className="h-2 w-full bg-[#1a2633] rounded-sm overflow-hidden">
          <div
            className="h-full transition-all duration-150"
            style={{
              width: `${playerHullPct}%`,
              backgroundColor:
                playerHullPct > 60 ? '#4e9f76' : playerHullPct > 30 ? '#d89b3c' : '#c4463c',
            }}
          />
        </div>
      </div>

      {/* Hostile Vessels Health Bars (1..4 simultaneously, clickable to switch focus) */}
      <div
        data-testid="enemy-health-grid"
        className={`grid gap-2 max-h-[168px] overflow-y-auto nautical-scroll pr-0.5 ${
          enemies.length > 1 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'
        }`}
      >
        {enemies.map((en) => {
          const enemyHullPct = Math.max(
            0,
            Math.min(100, Math.round((en.hull / Math.max(1, en.maxHull)) * 100))
          );
          const dist = Math.round(en.distance ?? 0);
          return (
            <button
              key={en.id}
              type="button"
              data-testid="enemy-health-card"
              aria-pressed={en.isPrimary}
              onClick={() => onSelectTarget?.(en.id)}
              className={`text-left rounded px-3 py-2 border transition-colors cursor-pointer space-y-1 ${
                en.isPrimary
                  ? 'bg-[#1a1618] border-[#e05a4d]/80'
                  : 'bg-[#101822] hover:bg-[#172330] border-[#c99d4e]/25'
              }`}
            >
              <div className="flex items-center justify-between gap-2 text-xs">
                <div className="min-w-0 truncate">
                  <strong className="font-display text-sm text-[#f7efe0]">{en.name}</strong>
                  <span className="ml-2 uppercase tracking-wide text-[11px] text-[#f1887c] font-semibold">
                    {en.subtitle}
                  </span>
                </div>
                <span className="font-mono-num text-[#d6cbb6] shrink-0 font-bold">
                  {Math.round(en.hull)}/{en.maxHull}
                </span>
              </div>

              <div className="h-2 w-full bg-[#1a2633] rounded-sm overflow-hidden">
                <div
                  className="h-full transition-all duration-150"
                  style={{
                    width: `${enemyHullPct}%`,
                    backgroundColor: en.isPrimary ? '#d6453a' : '#a83c34',
                  }}
                />
              </div>

              <div className="flex items-center justify-between gap-2 text-[11px] text-[#b8ac95] font-mono-num">
                <span className="truncate">
                  {dist}m{en.crewCount > 0 ? ` · Crew ${en.crewCount}` : ''}
                  {en.behaviorLabel ? ` · ${en.behaviorLabel}` : ''}
                </span>
                <span className="uppercase shrink-0 text-[#d8ae5e]">
                  {en.isPrimary && enemies.length > 1
                    ? 'TARGET'
                    : en.intelligenceLabel || en.kind}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Confirm Surrender Inline Bar */}
      {confirmSurrender && canSurrender ? (
        <div className="p-3 rounded bg-[#341a1a] border border-[#e05a4d]/60 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-[#f7d8d4]">
            {primaryEnemy.kind === 'pirate' ? (
              <>
                Strike colors and yield{' '}
                <strong className="text-[#efc570] font-mono-num">{pirateGoldTribute}g</strong> +{' '}
                <strong className="text-[#efc570] font-mono-num">{pirateFoodTribute} Provisions</strong> (-12 Crew Morale)?
              </>
            ) : (
              <>
                Cease fire and pay{' '}
                <strong className="text-[#efc570] font-mono-num">{restitutionCost}g</strong> restitution?
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setConfirmSurrender(false)}
              className="px-3 py-1.5 bg-[#1b2735] hover:bg-[#243446] text-[#d6cbb6] text-xs font-semibold rounded cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmSurrender(false);
                onSetCommand('surrender');
              }}
              className="px-4 py-1.5 bg-[#b83d33] hover:bg-[#cf483d] text-white text-xs font-bold rounded cursor-pointer"
            >
              Confirm Surrender
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => {
              setConfirmSurrender(false);
              onSetCommand('attack');
            }}
            className="px-4 py-2 rounded text-left cursor-pointer transition-colors border bg-[#c99d4e] border-[#efc570] text-[#14100b]"
          >
            <div className="text-sm font-bold leading-tight">Attack — Broadside Engaged</div>
            <div className="text-xs mt-0.5 leading-tight text-[#2b2011]">
              {enemies.length > 1
                ? `Focusing ${primaryEnemy.name} · Click another enemy bar to switch`
                : 'Auto-fire at foe · Steer manually with WASD'}
            </div>
          </button>

          <button
            type="button"
            disabled={!canSurrender}
            onClick={() => setConfirmSurrender(true)}
            className={`px-4 py-2 rounded text-left border transition-colors ${
              canSurrender
                ? 'bg-[#361b1b] hover:bg-[#492525] border-[#c4463c]/55 text-[#f5c7c2] cursor-pointer'
                : 'bg-[#1a222b] border-[#c99d4e]/20 text-[#7d868f] cursor-not-allowed'
            }`}
          >
            <div className="text-sm font-bold leading-tight">
              {canSurrender ? 'Surrender' : 'No Surrender Available'}
            </div>
            <div className={`text-xs mt-0.5 leading-tight ${canSurrender ? 'text-[#cfa09a]' : 'text-[#6c757e]'}`}>
              {canSurrender
                ? 'Strike colors & pay tribute to cease fire'
                : 'Sail past 265m to break off from beasts or spirits'}
            </div>
          </button>
        </div>
      )}

      <div className="text-xs text-[#ded3be] truncate text-center">
        {hud.combat.combatLog[0] ||
          'Steer manually with WASD · Space slows ship · Gunners fire automatically in range.'}
      </div>
    </div>
  );
};

interface VictoryLootModalProps {
  vesselKind: 'pirate' | 'merchant';
  pirate?: PirateShipData;
  merchant?: MerchantShipData;
  fleetUnlocked: boolean;
  fleetCount: number;
  playerGold: number;
  onClose: () => void;
  onCaptureForFleet: () => { ok: boolean; message: string };
  onResolveCrewOffer?: (choice: 'accept' | 'force') => {
    ok: boolean;
    status: 'joined' | 'refused' | 'error';
    message: string;
    survivor?: WreckSurvivor;
  };
}

export const VictoryLootModal: React.FC<VictoryLootModalProps> = ({
  vesselKind,
  pirate,
  merchant,
  fleetUnlocked,
  fleetCount,
  playerGold,
  onClose,
  onCaptureForFleet,
  onResolveCrewOffer,
}) => {
  const [confirmRecruit, setConfirmRecruit] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);

  const isPirate = vesselKind === 'pirate' && pirate;
  const isMerchant = vesselKind === 'merchant' && merchant;

  const initialSurvivor = isPirate ? pirate.survivor : isMerchant ? merchant.survivor : undefined;
  const [crewState, setCrewState] = useState<WreckSurvivor | undefined>(initialSurvivor);
  const [crewFeedback, setCrewFeedback] = useState<string | null>(null);

  const isGhost = Boolean(isPirate && pirate.isGhost);
  const salvageable = isPirate
    ? pirate.salvageable === true
    : isMerchant
      ? merchant.salvageable === true
      : false;
  const lootMult = !isGhost && !salvageable ? 0.38 : 1;

  const recruitCost = isPirate
    ? computeFleetRecruitCost(pirate)
    : isMerchant
      ? computeFleetRecruitCost(merchant)
      : 0;

  const canAffordRecruit =
    !isGhost &&
    salvageable &&
    fleetUnlocked &&
    fleetCount < MAX_FLEET_SIZE &&
    playerGold >= recruitCost;

  const titleName = isPirate ? pirate.name : isMerchant ? merchant.name : 'Defeated Vessel';
  const captainLabel = isPirate
    ? `${pirate.captainName} (${pirate.rankTitle})`
    : isMerchant
      ? `Capt. ${merchant.captainName} (${VESSEL_CLASS_LABELS[merchant.vesselClass] ?? merchant.vesselClass})`
      : '';
  const classSummary = isPirate
    ? pirate.shipClassLabel || pirate.tier.toUpperCase()
    : isMerchant
      ? merchant.classLabel || VESSEL_CLASS_LABELS[merchant.vesselClass]
      : '';
  const cannonsCount = isPirate ? pirate.cannons : isMerchant ? merchant.cannons : 0;
  const crewRemaining = isPirate ? pirate.crewCount : isMerchant ? merchant.crewCount : 0;

  const factionName = isPirate
    ? pirate.isGhost
      ? 'Spectral Armada'
      : PIRATE_FACTIONS[pirate.factionId]?.name ?? 'Corsair Fleet'
    : isMerchant && merchant.isCrown
      ? 'Royal Crown Navy'
      : 'Merchant Waters';

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Naval Battle Victory"
    >
      <div className="nautical-panel rounded-lg w-full max-w-lg p-6 space-y-4">
        <div className="border-b border-[#c99d4e]/25 pb-3">
          <p
            className={`text-xs uppercase tracking-widest font-bold ${
              isGhost ? 'text-[#5eead4]' : 'text-[#7ac59b]'
            }`}
          >
            {isGhost ? 'Spectral Encounter Banished' : `Naval Victory · ${factionName}`}
          </p>
          <h2 className="font-display text-2xl font-bold text-[#f7efe0] mt-1">
            {titleName} {isGhost ? 'Dispersed' : 'Defeated'}
          </h2>
          <p className="text-sm text-[#c4b79e] mt-0.5">
            {captainLabel}{' '}
            {isGhost
              ? 'dissolved into eerie mist, leaving a drifting ghost shipwreck nearby.'
              : salvageable
                ? 'broke beneath your broadsides and became an explorable shipwreck drifting nearby.'
                : 'exploded in a powder magazine blast, leaving a burning charred wreck with reduced cargo.'}
          </p>
        </div>

        {/* Spoils Waiting Inside the Drifting Shipwreck */}
        {isPirate ? (
          <div className="p-4 rounded bg-[#101922] border border-[#c99d4e]/25 space-y-2 text-sm text-[#d6cbb6]">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-[#efc570]">
                {!salvageable && !isGhost
                  ? 'Spoils Aboard Charred Wreck (Reduced by Fire)'
                  : 'Spoils Aboard Drifting Wreck'}
              </span>
              <strong className="font-mono-num text-[#efc570]">
                ~{Math.max(6, Math.round(pirate.gold * lootMult))} gold
              </strong>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
              {(Object.entries(pirate.loot) as [ResourceId, number][]).map(([id, qty]) => {
                const est = Math.max(1, Math.floor(qty * lootMult));
                return qty > 0 && RESOURCE_DEFS[id] ? (
                  <span key={id} className="font-mono-num text-[#9ec4d1]">
                    ~{est} {RESOURCE_DEFS[id].name}
                  </span>
                ) : null;
              })}
            </div>
            <p className="text-xs text-[#b7aa92] pt-0.5">
              Sail close to the sunken hull and press <strong className="text-[#f7efe0]">[E]</strong> to search each compartment room by room.
            </p>
          </div>
        ) : isMerchant ? (
          <div className="p-4 rounded bg-[#101922] border border-[#c99d4e]/25 space-y-1.5 text-sm text-[#d6cbb6]">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-[#efc570]">
                {!salvageable ? 'Spoils Aboard Charred Wreck (Reduced by Fire)' : 'Spoils Aboard Sunken Wreck'}
              </span>
              <strong className="font-mono-num text-[#efc570]">
                ~{Math.max(6, Math.round(merchant.gold * 0.5 * lootMult))} gold
              </strong>
            </div>
            <p className="text-xs text-[#9ec4d1]">
              {salvageable
                ? 'Shipwright timber, provisions, water casks, and hold cargo remain inside the drifting wreckage.'
                : 'Powder explosion & fire consumed much of the cargo hold — less loot remains aboard the burning hull.'}
            </p>
            <p className="text-xs text-[#b7aa92]">
              Sail close to the wreckage and press <strong className="text-[#f7efe0]">[E]</strong> to search rooms and salvage cargo.
            </p>
          </div>
        ) : null}

        {/* Defeated Ship Crew Recruitment (50% Refusal vs Forced) */}
        {!isGhost && crewState && onResolveCrewOffer && (
          <div
            data-testid="defeated-crew-offer-panel"
            className="p-3.5 rounded bg-[#13222e] border border-[#c99d4e]/35 space-y-2"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-[#f7efe0]">
                Defeated Crew Survivor: {crewState.name}
              </span>
              <span className="text-[11px] font-mono-num text-[#9ec4d1]">
                Sail {crewState.skills.sailing} · Rep {crewState.skills.repair} · Gun {crewState.skills.combat}
              </span>
            </div>

            {crewFeedback && (
              <div
                className={`px-2.5 py-1.5 rounded text-xs ${
                  crewState.resolved
                    ? 'bg-[#173127] text-[#9be3be]'
                    : 'bg-[#362417] text-[#f5cfa8]'
                }`}
              >
                {crewFeedback}
              </div>
            )}

            {!crewState.resolved && (
              <>
                <p className="text-xs text-[#b7aa92]">
                  {crewState.offerRefused
                    ? `${crewState.name} turned down your voluntary offer to join. You can still force them aboard.`
                    : 'Ask them to sign aboard (50% chance they turn down your offer) or force them into your crew.'}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    data-testid="victory-ask-crew"
                    disabled={Boolean(crewState.offerRefused)}
                    onClick={() => {
                      const res = onResolveCrewOffer('accept');
                      setCrewFeedback(res.message);
                      if (res.survivor) setCrewState(res.survivor);
                    }}
                    className="px-3 py-1.5 bg-[#3d8b68] hover:bg-[#49a37b] disabled:bg-[#1f2933] disabled:text-[#7c858e] text-white text-xs font-bold rounded cursor-pointer"
                  >
                    {crewState.offerRefused ? 'Offer Turned Down' : 'Ask to Join Crew (+3 Rep · 50%)'}
                  </button>
                  <button
                    type="button"
                    data-testid="victory-force-crew"
                    onClick={() => {
                      const res = onResolveCrewOffer('force');
                      setCrewFeedback(res.message);
                      if (res.survivor) setCrewState(res.survivor);
                    }}
                    className="px-3 py-1.5 bg-[#8e332c] hover:bg-[#a63d35] text-white text-xs font-bold rounded cursor-pointer"
                  >
                    Force Into Crew (-6 Rep · Always)
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* 50/50 Salvage & Recruit Ship Outcome */}
        {!isGhost && (
          <div
            data-testid="salvage-outcome-panel"
            className={`p-3.5 rounded border space-y-2.5 ${
              salvageable
                ? 'bg-[#10232b] border-[#c99d4e]/45'
                : 'bg-[#261a19] border-[#c4463c]/40'
            }`}
          >
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span
                className={`text-xs font-bold uppercase tracking-wider ${
                  salvageable ? 'text-[#7ac59b]' : 'text-[#f19488]'
                }`}
              >
                {salvageable
                  ? '50/50 Salvage Roll: Hull Salvageable'
                  : '50/50 Salvage Roll: Exploded & Charred — Wreck Only'}
              </span>
              <span className="text-xs font-mono-num text-[#b7aa92]">
                {classSummary} · {cannonsCount} Guns
              </span>
            </div>

            {!salvageable ? (
              <p className="text-xs text-[#cbbda4]">
                Its powder magazine detonated — leaving a heavily burned, fire-damaged wreck with fewer intact supplies for [E] salvage only.
              </p>
            ) : !confirmRecruit ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-[#d6cbb6]">
                  Fleet Capacity: <strong className="font-mono-num">{fleetCount}/{MAX_FLEET_SIZE}</strong> · Refit Fee:{' '}
                  <strong className="font-mono-num text-[#efc570]">{recruitCost}g</strong>
                </span>
                <button
                  type="button"
                  disabled={!fleetUnlocked || fleetCount >= MAX_FLEET_SIZE}
                  onClick={() => {
                    setCaptureError(null);
                    setConfirmRecruit(true);
                  }}
                  className="px-3.5 py-2 bg-[#c99d4e] hover:bg-[#dfb261] disabled:bg-[#1b2733] disabled:text-[#7c858e] text-[#14100b] text-xs font-bold rounded cursor-pointer transition-colors"
                >
                  {!fleetUnlocked
                    ? 'Requires Hull T3 + 12 Crew'
                    : fleetCount >= MAX_FLEET_SIZE
                      ? 'Fleet Full (5/5)'
                      : `Recruit Ship (${recruitCost}g)`}
                </button>
              </div>
            ) : (
              <div className="p-3 rounded bg-[#0c161d] border border-[#c99d4e]/55 space-y-2.5">
                <div className="text-xs font-bold text-[#efc570]">
                  Confirm Ship Recruitment &amp; Refit
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-xs text-[#d6cbb6] font-mono-num">
                  <span>Class: {classSummary}</span>
                  <span>Cannons: {cannonsCount}</span>
                  <span>Surviving Crew: {crewRemaining}</span>
                  <span>Refit Cost: {recruitCost}g</span>
                </div>
                <p className="text-[11px] text-[#9ec4d1]">
                  Recruiting the vessel puts your prize crew aboard its repaired hull instead of leaving a shipwreck behind.
                </p>
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmRecruit(false)}
                    className="px-3 py-1.5 bg-[#1b2735] hover:bg-[#243446] text-[#d6cbb6] text-xs font-semibold rounded cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!canAffordRecruit}
                    onClick={() => {
                      const res = onCaptureForFleet();
                      if (!res.ok) setCaptureError(res.message);
                    }}
                    className="px-3.5 py-1.5 bg-[#3d8b68] hover:bg-[#49a37b] disabled:bg-[#1b2733] disabled:text-[#7c858e] text-white text-xs font-bold rounded cursor-pointer"
                  >
                    {playerGold < recruitCost
                      ? `Need ${recruitCost}g`
                      : `Confirm Recruit (-${recruitCost}g)`}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {captureError && (
          <div className="px-3 py-2 rounded bg-[#3b1c1c] border border-[#c4463c]/55 text-xs text-[#f6c5c0]">
            {captureError}
          </div>
        )}

        <div className="flex pt-1">
          <button
            type="button"
            data-testid="victory-leave-wreck"
            onClick={onClose}
            className="w-full py-2.5 px-4 bg-[#1c2b3a] hover:bg-[#263a4d] border border-[#c99d4e]/35 text-[#f3ead6] text-xs font-bold rounded cursor-pointer transition-colors"
          >
            {isGhost ? 'Close & Search Ghost Wreck' : 'Leave to Sink & Search Wreck'}
          </button>
        </div>
      </div>
    </div>
  );
};
