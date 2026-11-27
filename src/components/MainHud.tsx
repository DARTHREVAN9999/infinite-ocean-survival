import React from 'react';
import {
  AlertTriangle,
  Anchor,
  BookOpen,
  Compass,
  Crosshair,
  Fish,
  HeartPulse,
  Map as MapIcon,
  Pause,
  ScrollText,
  Shield,
  Skull,
  Volume2,
  VolumeX,
  Wrench,
  X,
} from 'lucide-react';
import { HudSnapshot } from '../game/types';
import { WEATHER_PRESETS } from '../game/waveMath';

interface MainHudProps {
  hud: HudSnapshot;
  muted: boolean;
  onOpenShip: () => void;
  onOpenJournal: () => void;
  onOpenMap: () => void;
  onOpenFishing: () => void;
  onOpenTreasureMaps: () => void;
  onOpenWeather: () => void;
  onOpenPause: () => void;
  onToggleMute: () => void;
  onToggleStop: () => void;
  onInteract: () => void;
  onAcceptBounty: () => void;
  onDeclineBounty: () => void;
  onDismissTutorial: (disableAll?: boolean) => void;
  onDismissSupplyWarning: (key: string) => void;
}

function compassLabel(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(deg / 45) % 8];
}

const SUPPLY_WARNING_COPY: Record<string, { label: string; urgent: boolean }> = {
  food_low: { label: 'Provisions Running Low — Restock or fish trade soon', urgent: false },
  food_empty: { label: 'PROVISIONS EXHAUSTED — Crew losing morale & health!', urgent: true },
  water_low: { label: 'Fresh Water Running Low — Hail a merchant or trawler', urgent: false },
  water_empty: { label: 'FRESH WATER EXHAUSTED — Crew dehydrating rapidly!', urgent: true },
  salt_low: { label: 'Sea Salt Running Low — Buy salt from a trawler or merchant', urgent: false },
  salt_empty: { label: 'OUT OF SEA SALT — Provisions spoiling 85% faster!', urgent: true },
};

export const MainHud: React.FC<MainHudProps> = ({
  hud,
  muted,
  onOpenShip,
  onOpenJournal,
  onOpenMap,
  onOpenFishing,
  onOpenTreasureMaps,
  onOpenWeather,
  onOpenPause,
  onToggleMute,
  onToggleStop,
  onInteract,
  onAcceptBounty,
  onDeclineBounty,
  onDismissTutorial,
  onDismissSupplyWarning,
}) => {
  const hullPct = Math.round(hud.condition.hull);
  const floodPct = Math.round(hud.condition.flooding);
  const weatherLabel = WEATHER_PRESETS[hud.weather.type]?.label ?? 'At Sea';
  const repPct = Math.round(((hud.reputation + 100) / 200) * 100);
  const repColor =
    hud.reputation >= 20 ? '#4e9f76' : hud.reputation <= -20 ? '#c4463c' : '#d89b3c';
  const isFps = Boolean(hud.firstPerson?.active);

  return (
    <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-3 md:p-4">
      {/* Top Row: Left Ship Status & Reputation · Center Alerts · Right Day/Weather & Menu Buttons */}
      <div className="flex items-start justify-between gap-3">
        {/* Top-Left: Ship Name, Hull, Gold, Reputation, Crew & Supplies */}
        {!isFps ? (
        <div className="nautical-hud-card rounded-md px-4 py-3 min-w-[300px] max-w-[360px] pointer-events-auto space-y-2">
          <div className="flex items-center justify-between gap-3 border-b border-[#c99d4e]/20 pb-1">
            <span className="font-display text-xs uppercase tracking-widest text-[#efc570] font-bold truncate">
              {hud.shipName}
            </span>
            {hud.biomeLabel && (
              <span
                data-testid="hud-biome-label"
                className="text-[11px] font-semibold text-[#9ec4d1] shrink-0"
              >
                {hud.biomeLabel}
              </span>
            )}
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <div>
              <span className="text-xs uppercase tracking-wider text-[#c4b79e] font-semibold">Hull</span>
              <span className="ml-2 font-mono-num text-lg font-bold text-[#f7efe0]">
                {hullPct}%
              </span>
            </div>
            <div className="text-right">
              <span className="text-xs uppercase tracking-wider text-[#c4b79e] font-semibold">Gold</span>
              <span className="ml-2 font-mono-num text-lg font-bold text-[#efc570]">
                {hud.gold}g
              </span>
            </div>
          </div>

          <div className="h-2 w-full bg-[#1e2c3a] rounded-sm overflow-hidden">
            <div
              className="h-full transition-all duration-200"
              style={{
                width: `${hullPct}%`,
                backgroundColor: hullPct > 60 ? '#4e9f76' : hullPct > 30 ? '#d89b3c' : '#c4463c',
              }}
            />
          </div>

          {/* Permanent Reputation Meter */}
          <div className="pt-1">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-[#d9ccb4] font-medium">
                <Shield className="w-3.5 h-3.5 text-[#d8ae5e]" />
                <span>{hud.reputationTitle}</span>
              </span>
              <span className="font-mono-num font-bold text-[#f7efe0]">
                {hud.reputation > 0 ? `+${hud.reputation}` : hud.reputation}
              </span>
            </div>
            <div className="mt-1 h-1.5 w-full bg-[#18232f] rounded-sm overflow-hidden relative">
              <div
                className="h-full transition-all duration-200"
                style={{ width: `${repPct}%`, backgroundColor: repColor }}
              />
            </div>
          </div>

          {floodPct > 3 && (
            <div className="flex items-center justify-between text-xs font-semibold text-[#f19488] bg-[#361717] px-2.5 py-1 rounded">
              <span>Flooding — Start Manual Hull Repair</span>
              <span className="font-mono-num">{floodPct}%</span>
            </div>
          )}

          {/* Crew, Food, Fresh Water & Sea Salt */}
          <div className="pt-1.5 border-t border-[#c99d4e]/20 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-[#dfd4be]">
            <div>
              <div className="text-[11px] text-[#a99c85]">Crew ({hud.avgMorale}%)</div>
              <div className="font-mono-num font-bold text-[#f7efe0]">
                {hud.crewCount}/{hud.maxCrew}
              </div>
            </div>
            <div className={hud.foodDaysRemaining <= 1.2 ? 'text-[#f19488]' : ''}>
              <div className="text-[11px] text-[#a99c85]">Provisions</div>
              <div className="font-mono-num font-bold">
                {hud.food} <span className="text-[11px] font-normal">({hud.foodDaysRemaining}d)</span>
              </div>
            </div>
            <div className={hud.waterDaysRemaining <= 1.2 ? 'text-[#f19488]' : ''}>
              <div className="text-[11px] text-[#a99c85]">Fresh Water</div>
              <div className="font-mono-num font-bold">
                {hud.water} <span className="text-[11px] font-normal">({hud.waterDaysRemaining}d)</span>
              </div>
            </div>
            <div
              data-testid="hud-salt-stat"
              className={hud.salt <= 0 ? 'text-[#f19488]' : hud.saltDaysRemaining <= 0.9 ? 'text-[#f2be6b]' : ''}
            >
              <div className="text-[11px] text-[#a99c85]">Sea Salt</div>
              <div className="font-mono-num font-bold">
                {hud.salt}{' '}
                <span className="text-[11px] font-normal">
                  {hud.salt <= 0 ? '(Spoiling!)' : `(${hud.saltDaysRemaining}d)`}
                </span>
              </div>
            </div>
          </div>

          {hud.activeRepairJob && (
            <div className="pt-1.5 border-t border-[#c99d4e]/20 flex items-center justify-between gap-2 text-xs text-[#9ec4d1]">
              <span className="flex items-center gap-1.5 font-medium">
                <Wrench className="w-3.5 h-3.5 text-[#d8ae5e]" />
                Repairing {hud.activeRepairJob.section.toUpperCase()}
              </span>
              <span className="font-mono-num font-semibold text-[#efc570]">
                {Math.ceil(hud.activeRepairJob.remainingTime)}s
              </span>
            </div>
          )}
        </div>
        ) : <div />}

        {/* Top-Center Alerts & Bounty Locator/Offer Stack (positioned cleanly clear of Left Card & Top-Right Buttons) */}
        <div className="fixed z-10 pointer-events-none flex flex-col items-center gap-2 top-[112px] right-4 w-[min(430px,calc(100vw-22.5rem))] max-md:left-4 max-md:right-4 max-md:w-auto max-md:top-auto max-md:bottom-28 xl:left-1/2 xl:-translate-x-1/2 xl:right-auto xl:top-[108px] xl:w-[460px]">
          {hud.bounty?.status === 'active' && !isFps && (() => {
            const b = hud.bounty;
            const hullRatio = Math.max(0, Math.min(100, Math.round((b.targetHull / Math.max(1, b.targetMaxHull)) * 100)));
            const markerLeftPct = Math.max(6, Math.min(94, 50 + (b.relBearingDeg / 180) * 44));
            return (
              <div
                data-testid="bounty-locator-bar"
                className="pointer-events-auto w-full nautical-hud-card rounded-md px-4 py-2.5 border border-[#efc570]/70 shadow-xl space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Crosshair className="w-3.5 h-3.5 text-[#efc570] shrink-0" />
                    <span className="font-display font-bold text-[#f7efe0] truncate">
                      {b.targetName}
                    </span>
                    <span className="text-[11px] text-[#cbbda4] shrink-0">
                      · {b.targetShipClass}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 font-mono-num">
                    <span className="font-bold text-[#efc570]">{b.rewardGold}g</span>
                    <span className="text-[#9ec4d1] font-semibold">{b.distance}m</span>
                  </div>
                </div>

                {/* Directional Bearing Indicator Bar (-180 Port .. 0 Ahead .. +180 Starboard) */}
                <div className="relative h-5 bg-[#0e1722] border border-[#c99d4e]/35 rounded overflow-hidden flex items-center justify-between px-2 text-[10px] font-mono-num text-[#8b98a6]">
                  <span>PORT</span>
                  <span className="text-[#c99d4e]/70">|</span>
                  <span className="text-[#efc570] font-bold">BOW</span>
                  <span className="text-[#c99d4e]/70">|</span>
                  <span>STBD</span>
                  <div
                    data-testid="bounty-locator-pointer"
                    style={{ left: `${markerLeftPct}%` }}
                    className="absolute top-0.5 bottom-0.5 -translate-x-1/2 px-1.5 rounded bg-[#c99d4e] text-[#14100b] font-bold text-[10px] flex items-center gap-0.5 shadow"
                  >
                    <span>▲</span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 text-[11px]">
                  <span className="text-[#e7dcc7] font-semibold">
                    {b.directionLabel} · <span className="font-mono-num text-[#9ec4d1]">{b.compassDeg}°</span>
                  </span>
                  <div className="flex items-center gap-2.5">
                    {b.rivalHuntersAlive > 0 && (
                      <span className="text-[#f19488] font-semibold">
                        {b.rivalHuntersAlive} Rival {b.rivalHuntersAlive === 1 ? 'Hunter' : 'Hunters'}
                      </span>
                    )}
                    <div className="flex items-center gap-1.5">
                      <span className="text-[#b8ac95]">Hull</span>
                      <div className="w-16 h-1.5 bg-[#1b2735] rounded overflow-hidden">
                        <div className="h-full bg-[#d8564b]" style={{ width: `${hullRatio}%` }} />
                      </div>
                      <span className="font-mono-num font-bold text-[#f7efe0]">{hullRatio}%</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {hud.bounty?.status === 'offered' && !isFps && (
            <div
              data-testid="bounty-offer-card"
              className="pointer-events-auto w-full nautical-hud-card rounded-md px-4 py-2.5 border border-[#efc570]/75 shadow-xl space-y-2"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-bold text-[#efc570]">
                    <Skull className="w-3.5 h-3.5 shrink-0" />
                    <span>{hud.bounty.issuerLabel} · {hud.bounty.tierLabel}</span>
                  </div>
                  <div className="text-sm font-display font-bold text-[#f7efe0] truncate mt-0.5">
                    Target: {hud.bounty.targetName} ({hud.bounty.targetShipClass})
                  </div>
                  <div className="text-xs text-[#cfc3ae]">
                    {hud.bounty.targetCaptain} ·{' '}
                    <span className="font-mono-num font-bold text-[#efc570]">+{hud.bounty.rewardGold}g</span> ·{' '}
                    <span className={hud.bounty.reputationDelta >= 0 ? 'text-[#7ac59b] font-semibold' : 'text-[#f19488] font-semibold'}>
                      {hud.bounty.reputationDelta >= 0 ? `+${hud.bounty.reputationDelta}` : hud.bounty.reputationDelta} Rep
                    </span>
                    {' '}· Rival hunters closing in
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  tabIndex={-1}
                  data-testid="bounty-decline-btn"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onDeclineBounty();
                  }}
                  className="px-3 py-1 rounded bg-[#1b2735] hover:bg-[#25364a] text-[#cbbda4] text-xs font-semibold cursor-pointer"
                >
                  Decline
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  data-testid="bounty-accept-btn"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onAcceptBounty();
                  }}
                  className="px-3.5 py-1 rounded bg-[#c99d4e] hover:bg-[#dfb261] text-[#14100b] text-xs font-bold cursor-pointer"
                >
                  Accept Bounty [B]
                </button>
              </div>
            </div>
          )}

          {hud.activeTornadoWarning && (
            <div
              data-testid="tornado-warning-banner"
              role="alert"
              className="pointer-events-auto px-4 py-1.5 rounded-md bg-[#4c1919] border border-[#e05a4d] text-xs font-bold tracking-wide text-[#ffe0db] text-center shadow-lg"
            >
              WATERSPOUT NEARBY — STEER CLEAR OF VORTEX!
            </div>
          )}

          {hud.steeringHexActive && (
            <div
              data-testid="helm-hex-banner"
              role="alert"
              className="pointer-events-auto px-4 py-1.5 rounded-md bg-[#113135] border border-[#5eead4]/75 text-xs font-bold tracking-wide text-[#bff9ee] text-center shadow-lg"
            >
              GHOST SHIP HELM HEX — STEERING TEMPORARILY REVERSED!
            </div>
          )}

          {hud.nearbyGhostWarning && (
            <div
              data-testid="ghost-warning-banner"
              className="pointer-events-auto px-4 py-1.5 rounded-md bg-[#0f2930] border border-[#5eead4]/60 text-xs font-bold tracking-wide text-[#bff9ee] text-center shadow-lg"
            >
              Unnatural Fog &amp; Cold Mist — Ghost Ship Lurking Nearby
            </div>
          )}

          {hud.nearbyMajorBattle && (
            <div
              data-testid="major-battle-banner"
              className="pointer-events-auto px-4 py-1.5 rounded-md bg-[#3c1b14] border border-[#e05a4d]/70 text-xs font-bold tracking-wide text-[#ffd8c4] text-center shadow-lg"
            >
              {hud.nearbyMajorBattle}
            </div>
          )}

          {/* Fleet Vessel Distress Alerts */}
          {hud.fleetDistress.map((fd) => (
            <div
              key={fd.id}
              data-testid="fleet-distress-alert"
              role="alert"
              className={`pointer-events-auto w-full px-4 py-2 rounded-md border flex items-center justify-between gap-3 text-xs font-bold shadow-lg ${
                fd.inDanger
                  ? 'bg-[#4f1616] border-[#e05a4d] text-[#ffe1dd]'
                  : 'bg-[#362412] border-[#d89b3c] text-[#fae5be]'
              }`}
            >
              <span>
                {fd.inDanger ? 'FLEET SHIP IN DANGER' : 'FLEET SHIP AT RISK'}: {fd.name.toUpperCase()} ({fd.hullPct}% HULL)
              </span>
              <button
                type="button"
                onClick={onOpenShip}
                className="px-2.5 py-1 bg-[#c99d4e] hover:bg-[#dfb261] text-[#14100b] text-xs font-bold rounded cursor-pointer whitespace-nowrap"
              >
                Fleet
              </button>
            </div>
          ))}

          {/* Persistent Crew < 25 HP Injury Alerts */}
          {hud.crewHealthWarnings.map((w) => (
            <div
              key={w.crewId}
              data-testid="crew-injury-alert"
              role="alert"
              className="pointer-events-auto w-full px-4 py-2 rounded-md bg-[#481616] border border-[#e05a4d] text-[#ffe3df] flex items-center justify-between gap-3 shadow-lg"
            >
              <div className="flex items-center gap-2 text-xs md:text-sm font-bold tracking-wide">
                <HeartPulse className="w-4 h-4 text-[#ff8b7e] shrink-0" />
                <span>
                  CREW MEMBER INJURED — {w.name.toUpperCase()} — {w.health} HEALTH
                </span>
              </div>
              <button
                type="button"
                onClick={onOpenShip}
                className="px-2.5 py-1 bg-[#e05a4d] hover:bg-[#eb6e62] text-[#1a0908] text-xs font-bold rounded cursor-pointer whitespace-nowrap"
              >
                Treat
              </button>
            </div>
          ))}

          {/* Dismissible Supply Warnings */}
          {hud.supplyWarnings.map((wKey) => {
            const info = SUPPLY_WARNING_COPY[wKey];
            if (!info) return null;
            return (
              <div
                key={wKey}
                className={`pointer-events-auto w-full px-3.5 py-2 rounded-md border flex items-center justify-between gap-3 text-xs font-semibold shadow ${
                  info.urgent
                    ? 'bg-[#431818] border-[#db5b4e] text-[#ffdcd8]'
                    : 'bg-[#2b2214] border-[#d89b3c]/70 text-[#fae5be]'
                }`}
              >
                <span className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {info.label}
                </span>
                <button
                  type="button"
                  onClick={() => onDismissSupplyWarning(wKey)}
                  aria-label={`Dismiss ${wKey} warning`}
                  className="p-1 rounded hover:bg-black/25 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}

          {hud.journalToast && !hud.firstPerson?.active && (
            <div
              data-testid="journal-toast"
              className="pointer-events-auto px-4 py-1.5 rounded bg-[#182736] border border-[#c99d4e]/60 text-xs font-semibold text-[#f3e6ca] shadow"
            >
              {hud.journalToast}
            </div>
          )}

        </div>

        {hud.tutorialToast && !hud.firstPerson?.active && (
          <div
            data-testid="tutorial-toast"
            role="status"
            className="fixed bottom-24 right-4 z-10 pointer-events-auto nautical-panel rounded-md px-4 py-3 w-80 max-w-[calc(100vw-2rem)] border border-[#c99d4e]/60 shadow-xl flex flex-col gap-2"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <div className="text-xs uppercase tracking-widest text-[#efc570] font-bold">
                  Voyage Tip · {hud.tutorialToast.title}
                </div>
                <p className="text-sm text-[#f4ead5] leading-snug">{hud.tutorialToast.message}</p>
              </div>
              <button
                type="button"
                onClick={() => onDismissTutorial(false)}
                aria-label="Dismiss Tutorial Tip"
                className="p-1 text-[#c4b79e] hover:text-white hover:bg-[#1e2c3a] rounded cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => onDismissTutorial(true)}
                className="px-2.5 py-1 text-xs text-[#b7aa92] hover:text-white cursor-pointer whitespace-nowrap"
              >
                Disable Tutorials
              </button>
              <button
                type="button"
                onClick={() => onDismissTutorial(false)}
                className="px-3 py-1 bg-[#c99d4e] hover:bg-[#dbaf60] text-[#14100b] text-xs font-bold rounded cursor-pointer whitespace-nowrap"
              >
                Got It
              </button>
            </div>
          </div>
        )}

        {/* Top-Right: Day, Phase, Clickable Weather Forecast & Menu Action Buttons */}
        <div className="flex flex-col items-end gap-2 pointer-events-auto shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              tabIndex={-1}
              data-testid="hud-weather-button"
              onClick={(e) => {
                e.currentTarget.blur();
                onOpenWeather();
              }}
              aria-label="Open Barometer and Weather Forecast"
              className="nautical-hud-card hover:bg-[#1a2837] rounded-md px-4 py-2 flex items-center gap-3 text-sm text-[#e8decb] cursor-pointer transition-colors"
            >
              <span className="font-mono-num font-bold text-[#f7efe0]">
                Day {hud.day} · {hud.timeStr}
              </span>
              <span className="text-xs uppercase tracking-wider text-[#efc570] font-semibold">
                {hud.dayPhaseLabel}
              </span>
              <span aria-hidden="true" className="text-[#786f60]">|</span>
              <span className="text-xs md:text-sm underline decoration-[#c99d4e]/45 underline-offset-4">
                {weatherLabel}
              </span>
              <span className="font-mono-num text-xs md:text-sm text-[#9ec4d1] font-semibold">
                {Math.round(hud.weather.windSpeed)} kt
              </span>
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onOpenShip();
              }}
              aria-label="Ship and Crew Management"
              className="nautical-hud-card hover:bg-[#1a2837] text-[#f4ead5] px-3.5 py-2 rounded text-sm font-semibold flex items-center gap-2 cursor-pointer transition-colors whitespace-nowrap"
            >
              <Anchor className="w-4 h-4 text-[#efc570]" />
              <span>Ship [Tab]</span>
            </button>
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onOpenJournal();
              }}
              aria-label="Open Captain Journal"
              className="nautical-hud-card hover:bg-[#1a2837] text-[#f4ead5] px-3.5 py-2 rounded text-sm font-semibold flex items-center gap-2 cursor-pointer transition-colors whitespace-nowrap"
            >
              <BookOpen className="w-4 h-4 text-[#efc570]" />
              <span>Journal [J]</span>
            </button>
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onOpenMap();
              }}
              aria-label="Open Sea Chart Map"
              className="nautical-hud-card hover:bg-[#1a2837] text-[#f4ead5] px-3.5 py-2 rounded text-sm font-semibold flex items-center gap-2 cursor-pointer transition-colors whitespace-nowrap"
            >
              <MapIcon className="w-4 h-4 text-[#efc570]" />
              <span>Map [M]</span>
            </button>
            {!isFps && (
              <button
                type="button"
                tabIndex={-1}
                data-testid="hud-fish-btn"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onOpenFishing();
                }}
                aria-label="Cast Fishing Line"
                className={`nautical-hud-card px-3 py-2 rounded text-sm font-semibold flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap ${
                  hud.nearbyFishTarget
                    ? 'border border-[#efc570] bg-[#2a2315] hover:bg-[#3a301c] text-[#efc570]'
                    : 'hover:bg-[#1a2837] text-[#f4ead5]'
                }`}
              >
                <Fish className="w-4 h-4 text-[#9ec4d1]" />
                <span>
                  {hud.nearbyFishTarget?.kind === 'monster_carcass'
                    ? 'Fish Carcass [F]'
                    : hud.nearbyFishTarget?.kind === 'sea_wildlife'
                      ? 'Fish Pod [F]'
                      : 'Fish [F]'}
                </span>
              </button>
            )}
            <button
              type="button"
              tabIndex={-1}
              data-testid="hud-treasure-btn"
              onClick={(e) => {
                e.currentTarget.blur();
                onOpenTreasureMaps();
              }}
              aria-label="Open Treasure Maps and Fragments"
              className="nautical-hud-card hover:bg-[#1a2837] text-[#f4ead5] px-3 py-2 rounded text-sm font-semibold flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
            >
              <ScrollText className="w-4 h-4 text-[#efc570]" />
              <span>Charts ({hud.treasureFragments ?? 0}/3)</span>
            </button>
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleMute();
              }}
              aria-label={muted ? 'Unmute Audio' : 'Mute Audio'}
              className="nautical-hud-card hover:bg-[#1a2837] text-[#f4ead5] p-2.5 rounded cursor-pointer transition-colors"
            >
              {muted ? <VolumeX className="w-4 h-4 text-[#e06d60]" /> : <Volume2 className="w-4 h-4 text-[#efc570]" />}
            </button>
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onOpenPause();
              }}
              aria-label="Pause Game"
              className="nautical-hud-card hover:bg-[#1a2837] text-[#f4ead5] px-3 py-2 rounded text-sm font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Pause className="w-4 h-4 text-[#efc570]" />
              <span className="hidden sm:inline">[Esc]</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Center: Event Log Toast, Nearby Interaction Prompt & Helm Dock */}
      <div className="flex flex-col items-center gap-2.5 mt-auto">
        {hud.notification && !isFps && (
          <div className="nautical-hud-card rounded px-4 py-2 text-sm text-[#f7efe0] max-w-2xl text-center font-medium">
            {hud.notification}
          </div>
        )}

        {!isFps && hud.nearbyPrompt && !hud.combat.active && (
          <button
            type="button"
            data-testid="hud-interact-prompt"
            onClick={onInteract}
            className="pointer-events-auto px-6 py-3 bg-[#c99d4e] hover:bg-[#e0b261] text-[#14100b] font-bold text-base rounded-md shadow-xl cursor-pointer transition-colors whitespace-nowrap"
          >
            Press [E] · {hud.nearbyPrompt.label} ({hud.nearbyPrompt.distance}m)
          </button>
        )}

        {!isFps && hud.nearbyFishTarget && !hud.combat.active && (
          <button
            type="button"
            data-testid="hud-fish-prompt"
            onClick={onOpenFishing}
            className="pointer-events-auto px-6 py-3 bg-[#2f6f8f] hover:bg-[#3a86ab] text-white font-bold text-base rounded-md shadow-xl cursor-pointer transition-colors whitespace-nowrap"
          >
            Press [F] · Fish {hud.nearbyFishTarget.speciesLabel} ({hud.nearbyFishTarget.distance}m · {hud.nearbyFishTarget.castCost}g per cast)
          </button>
        )}

        {!isFps && !hud.combat.active && (
          <div className="nautical-hud-card rounded-md px-5 py-2.5 flex flex-wrap items-center justify-center gap-4 text-sm text-[#dfd4be] pointer-events-auto">
            <div className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-[#efc570]" />
              <span className="font-mono-num font-bold text-[#f7efe0]">
                {hud.headingDeg}° {compassLabel(hud.headingDeg)}
              </span>
            </div>

            <span aria-hidden="true" className="text-[#5e564a]">|</span>

            <div className="flex items-center gap-2">
              <span className="text-[#b8ac95]">Speed</span>
              <span className="font-mono-num font-bold text-[#f7efe0]">
                {hud.speedKnots} kt
              </span>
              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onToggleStop();
                }}
                data-testid="helm-stop-toggle"
                className={`px-2.5 py-0.5 rounded text-xs font-bold cursor-pointer transition-colors ${
                  hud.isStopping
                    ? 'bg-[#c99d4e] text-[#14100b]'
                    : 'bg-[#1a2736] hover:bg-[#24364a] text-[#cfc3ae]'
                }`}
              >
                {hud.isStopping ? 'STOPPING [Space]' : 'HEAVE TO [Space]'}
              </button>
            </div>

            <span aria-hidden="true" className="text-[#5e564a]">|</span>

            <div className="flex items-center gap-2">
              <span className="text-[#b8ac95]">Sails</span>
              <div className="w-20 h-2 bg-[#1e2c3a] rounded-sm overflow-hidden">
                <div
                  className="h-full bg-[#c99d4e]"
                  style={{ width: `${Math.max(0, Math.round(hud.throttle * 100))}%` }}
                />
              </div>
              <span className="font-mono-num text-[#efc570] font-semibold w-10">
                {hud.throttle < -0.05 ? 'REV' : `${Math.round(Math.max(0, hud.throttle) * 100)}%`}
              </span>
            </div>

            <span aria-hidden="true" className="hidden lg:inline text-[#5e564a]">|</span>

            {/* Ship Section Mini Readout */}
            <div className="hidden lg:flex items-center gap-3 text-xs font-mono-num">
              <span>Sails <strong className={hud.condition.sails < 50 ? 'text-[#f19488]' : 'text-[#9ec4d1]'}>{Math.round(hud.condition.sails)}%</strong></span>
              <span>Mast <strong className={hud.condition.mast < 50 ? 'text-[#f19488]' : 'text-[#9ec4d1]'}>{Math.round(hud.condition.mast)}%</strong></span>
              <span>Helm <strong className={hud.condition.steering < 50 ? 'text-[#f19488]' : 'text-[#9ec4d1]'}>{Math.round(hud.condition.steering)}%</strong></span>
              <span>Guns <strong className={hud.condition.cannons < 50 ? 'text-[#f19488]' : 'text-[#9ec4d1]'}>{Math.round(hud.condition.cannons)}%</strong></span>
            </div>

            <span aria-hidden="true" className="hidden md:inline text-[#5e564a]">|</span>

            <span className="hidden md:inline font-mono-num text-[#9ec4d1] font-semibold">
              Hold {hud.cargoUsed}/{hud.cargoCapacity}t
              {hud.fleetCount > 0 ? ` · Fleet ${hud.fleetCount}/5` : ''}
              {hud.tamedMonstersCount > 0 ? ` · ${hud.tamedMonstersCount} Escort` : ''}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
