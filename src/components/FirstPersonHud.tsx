import React from 'react';
import { Anchor, Compass, Crosshair, RotateCcw, Shield, Sword } from 'lucide-react';
import { FirstPersonHudState, FpsWeaponId } from '../game/types';
import { FPS_WEAPON_SPECS } from '../game/fpsCombat';

interface FirstPersonHudProps {
  fps: FirstPersonHudState;
  onSwitchWeapon: (weapon: FpsWeaponId) => void;
  onReload: () => void;
  onInteract: () => void;
  onBoardShip: () => void;
}

export const FirstPersonHud: React.FC<FirstPersonHudProps> = ({
  fps,
  onSwitchWeapon,
  onReload,
  onInteract,
  onBoardShip,
}) => {
  const hpPct = Math.max(0, Math.min(100, Math.round((fps.playerHp / Math.max(1, fps.maxPlayerHp)) * 100)));
  const stamPct = Math.max(0, Math.min(100, Math.round(fps.stamina)));
  const w = fps.weapons;

  const activeLoaded =
    w.activeWeapon === 'cutlass'
      ? true
      : w.activeWeapon === 'pistol'
        ? w.pistolLoaded
        : w.musketLoaded;

  const weaponSlots: Array<{
    id: FpsWeaponId;
    keyNum: string;
    label: string;
    status: string;
    ready: boolean;
  }> = [
    {
      id: 'cutlass',
      keyNum: '1',
      label: FPS_WEAPON_SPECS.cutlass.name,
      status: w.isBlocking ? 'Parrying' : 'Melee Ready',
      ready: true,
    },
    {
      id: 'pistol',
      keyNum: '2',
      label: FPS_WEAPON_SPECS.pistol.name,
      status:
        w.activeWeapon === 'pistol' && w.isReloading
          ? `Reloading ${w.pistolReloadRemaining.toFixed(1)}s`
          : w.pistolLoaded
            ? 'Loaded'
            : w.pistolReloadRemaining > 0 && w.pistolReloadRemaining < FPS_WEAPON_SPECS.pistol.reloadDuration
              ? `Unloaded (${w.pistolReloadRemaining.toFixed(1)}s) [R]`
              : 'Unloaded [R]',
      ready: w.pistolLoaded,
    },
    {
      id: 'musket',
      keyNum: '3',
      label: FPS_WEAPON_SPECS.musket.name,
      status:
        w.activeWeapon === 'musket' && w.isReloading
          ? `Reloading ${w.musketReloadRemaining.toFixed(1)}s`
          : w.musketLoaded
            ? 'Loaded'
            : w.musketReloadRemaining > 0 && w.musketReloadRemaining < FPS_WEAPON_SPECS.musket.reloadDuration
              ? `Unloaded (${w.musketReloadRemaining.toFixed(1)}s) [R]`
              : 'Unloaded [R]',
      ready: w.musketLoaded,
    },
  ];

  return (
    <div
      data-testid="first-person-hud"
      className="fixed inset-0 z-20 pointer-events-none cursor-none flex flex-col justify-between p-4"
    >
      {/* Center Crosshair */}
      <div className="fixed inset-0 flex items-center justify-center pointer-events-none">
        <div
          className={`w-6 h-6 rounded-full border flex items-center justify-center transition-transform ${
            w.isBlocking
              ? 'border-[#efc570] scale-125'
              : w.isReloading
                ? 'border-[#9ec4d1]/65 scale-90'
                : 'border-[#f7efe0]/70'
          }`}
        >
          <div className="w-1.5 h-1.5 rounded-full bg-[#efc570]" />
        </div>
      </div>

      {/* Top Row: Location Info + Treasure Hint | Return to Ship (positioned cleanly below MainHud top bar) */}
      <div className="flex items-start justify-between gap-4 pt-24">
        <div className="nautical-hud-card rounded-md px-4 py-2.5 space-y-1 max-w-sm pointer-events-auto">
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-[#efc570] shrink-0" />
            <span className="font-display text-sm font-bold text-[#f7efe0]">
              {fps.islandName}
            </span>
            <span className="text-[11px] uppercase tracking-wider text-[#9ec4d1]">
              {fps.insideCave ? 'Cavern' : fps.inWater ? 'Shallows' : fps.islandArchetype.replace('_', ' ')}
            </span>
          </div>
          {fps.treasureHint && (
            <div
              data-testid="fps-treasure-hint"
              className="text-xs font-semibold text-[#efc570] border-t border-[#c99d4e]/25 pt-1"
            >
              Treasure Map: {fps.treasureHint}
            </div>
          )}
          {fps.statusBanner && (
            <div
              data-testid="fps-status-banner"
              className="text-xs font-semibold text-[#bde4d2]"
            >
              {fps.statusBanner}
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-2 pointer-events-auto">
          <button
            type="button"
            tabIndex={-1}
            data-testid="fps-board-ship-btn"
            onClick={(e) => {
              e.currentTarget.blur();
              onBoardShip();
            }}
            className="px-4 py-2 rounded bg-[#c99d4e] hover:bg-[#dfb261] text-[#14100b] text-xs font-bold flex items-center gap-1.5 shadow-lg cursor-pointer"
          >
            <Anchor className="w-4 h-4" />
            <span>Return to Ship</span>
          </button>
          <div className="nautical-hud-card rounded px-3 py-1.5 text-[11px] text-[#cfc3ae]">
            {fps.pointerLocked
              ? 'Cursor Locked (Esc to Release) · WASD Move · Shift Sprint · Click Attack · R Reload · F/RMB Parry'
              : 'Click Game View to Lock Cursor · WASD Move · Shift Sprint · R Reload · F/RMB Parry'}
          </div>
        </div>
      </div>

      {/* Bottom Row: HP/Stamina/Ammo | Interact Prompt + Weapons */}
      <div className="flex flex-col items-center gap-3 mt-auto">
        {fps.promptText && (
          <button
            type="button"
            tabIndex={-1}
            data-testid="fps-interact-prompt"
            onClick={(e) => {
              e.currentTarget.blur();
              onInteract();
            }}
            className="pointer-events-auto px-5 py-2.5 bg-[#c99d4e] hover:bg-[#e0b261] text-[#14100b] font-bold text-sm rounded-md shadow-xl cursor-pointer transition-colors"
          >
            {fps.promptText}
          </button>
        )}

        <div className="w-full flex flex-wrap items-end justify-between gap-3">
          {/* Player Survival Vitals & Powder Pouch */}
          <div className="nautical-hud-card rounded-md px-4 py-2.5 min-w-[230px] pointer-events-auto space-y-2">
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#c4b79e] font-semibold">Health</span>
                <span className="font-mono-num font-bold text-[#f7efe0]">
                  {fps.playerHp}/{fps.maxPlayerHp}
                </span>
              </div>
              <div className="h-2 bg-[#1a2531] rounded-sm overflow-hidden">
                <div
                  className="h-full transition-all duration-150"
                  style={{
                    width: `${hpPct}%`,
                    backgroundColor: hpPct > 55 ? '#4e9f76' : hpPct > 25 ? '#d89b3c' : '#c4463c',
                  }}
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#c4b79e] font-semibold">Stamina</span>
                <span className="font-mono-num font-bold text-[#9ec4d1]">{stamPct}%</span>
              </div>
              <div className="h-1.5 bg-[#1a2531] rounded-sm overflow-hidden">
                <div className="h-full bg-[#68a9c4] transition-all duration-150" style={{ width: `${stamPct}%` }} />
              </div>
            </div>

            <div className="pt-1 border-t border-[#c99d4e]/20 flex items-center justify-between text-xs font-mono-num text-[#dfd4be]">
              <span>Powder: <strong className="text-[#efc570]">{fps.gunpowder}</strong></span>
              <span>Lead Shot: <strong className="text-[#efc570]">{fps.leadShot}</strong></span>
            </div>
          </div>

          {/* 3 Historical Weapon Slots */}
          <div className="flex flex-wrap items-center gap-2 pointer-events-auto">
            {w.activeWeapon !== 'cutlass' && !activeLoaded && !w.isReloading && (
              <button
                type="button"
                tabIndex={-1}
                data-testid="fps-reload-btn"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onReload();
                }}
                className="px-3.5 py-2.5 rounded bg-[#274c5e] hover:bg-[#316077] border border-[#9ec4d1]/60 text-[#f7efe0] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4 text-[#efc570]" />
                <span>Reload [R]</span>
              </button>
            )}

            {weaponSlots.map((slot) => {
              const selected = w.activeWeapon === slot.id;
              return (
                <button
                  key={slot.id}
                  type="button"
                  tabIndex={-1}
                  data-testid={`fps-weapon-${slot.id}`}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onSwitchWeapon(slot.id);
                  }}
                  className={`px-3.5 py-2 rounded border text-left transition-colors cursor-pointer min-w-[148px] ${
                    selected
                      ? 'bg-[#282015] border-[#efc570] text-[#f7efe0]'
                      : 'bg-[#0e1722] hover:bg-[#162434] border-[#c99d4e]/30 text-[#cbbda4]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-xs font-bold">
                    <span className="flex items-center gap-1.5">
                      {slot.id === 'cutlass' ? (
                        w.isBlocking ? <Shield className="w-3.5 h-3.5 text-[#efc570]" /> : <Sword className="w-3.5 h-3.5 text-[#efc570]" />
                      ) : (
                        <Crosshair className="w-3.5 h-3.5 text-[#efc570]" />
                      )}
                      <span>[{slot.keyNum}] {slot.label}</span>
                    </span>
                  </div>
                  <div
                    className={`text-[11px] font-mono-num mt-0.5 ${
                      slot.ready ? 'text-[#7ac59b]' : 'text-[#f19488]'
                    }`}
                  >
                    {slot.status}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
