import React, { useState } from 'react';
import { CloudLightning, Compass, Crown, Ghost, MapPin, ShieldAlert, Ship, Skull, Snowflake, X } from 'lucide-react';
import { AdminTeleportTarget, GhostSizeTier, HudSnapshot, WeatherType } from '../game/types';
import { ALL_WEATHER_TYPES, WEATHER_PRESETS } from '../game/waveMath';

interface AdminModalProps {
  hud: HudSnapshot;
  targets: AdminTeleportTarget[];
  onClose: () => void;
  onUnlock: (password: string) => boolean;
  onToggleAdmin: (enabled: boolean) => void;
  onTeleportNear: (targetId: string) => { ok: boolean; message: string };
  onRestoreMaxResources: () => { ok: boolean; message: string };
  onSpawnMaxFleet: () => { ok: boolean; message: string };
  onSpawnColossalCompanion: () => { ok: boolean; message: string };
  onSpawnGhostShip: (size: GhostSizeTier) => { ok: boolean; message: string };
  onProjectBounty: () => { ok: boolean; message: string };
  onSetWeather: (type: WeatherType) => { ok: boolean; message: string };
}

const GHOST_TIERS: { size: GhostSizeTier; label: string }[] = [
  { size: 'small', label: 'Small' },
  { size: 'medium', label: 'Medium' },
  { size: 'large', label: 'Large' },
  { size: 'enormous', label: 'Enormous' },
  { size: 'colossal', label: 'Colossal (Legendary)' },
];

export const AdminModal: React.FC<AdminModalProps> = ({
  hud,
  targets,
  onClose,
  onUnlock,
  onToggleAdmin,
  onTeleportNear,
  onRestoreMaxResources,
  onSpawnMaxFleet,
  onSpawnColossalCompanion,
  onSpawnGhostShip,
  onProjectBounty,
  onSetWeather,
}) => {
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const ok = onUnlock(password);
    if (!ok) {
      setAuthError('Invalid password.');
    } else {
      setAuthError(null);
      setPassword('');
      setFeedback('Admin Console active for this session.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/78 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Session Console"
    >
      <div className="nautical-panel rounded-lg w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-[#c99d4e]/30 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-5 h-5 text-[#efc570]" />
            <div>
              <h2 className="font-display text-xl font-bold text-[#f7efe0]">
                {hud.adminUnlocked ? 'Admiralty Test & World Event Console' : 'Authorized Access'}
              </h2>
              <p className="text-xs text-[#9ec4d1]">
                {hud.adminUnlocked
                  ? `Session-only Admin Mode (${hud.adminEnabled ? 'ACTIVE' : 'PAUSED'})`
                  : 'Enter session password to unlock testing controls'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hud.adminUnlocked && (
              <button
                type="button"
                onClick={() => {
                  onToggleAdmin(!hud.adminEnabled);
                  if (hud.adminEnabled) onClose();
                }}
                className={`px-3 py-1.5 rounded text-xs font-bold cursor-pointer ${
                  hud.adminEnabled
                    ? 'bg-[#6b1d1d] hover:bg-[#842424] text-white'
                    : 'bg-[#2a5c4a] hover:bg-[#34725c] text-white'
                }`}
              >
                {hud.adminEnabled ? 'Toggle Admin Off' : 'Re-Enable Admin'}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Admin Console"
              className="p-2 text-[#cbbda4] hover:text-white hover:bg-[#1e2c3a] rounded cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {!hud.adminUnlocked ? (
          <form onSubmit={handlePasswordSubmit} className="p-6 space-y-4 max-w-md mx-auto w-full">
            <label className="block space-y-1.5">
              <span className="text-xs uppercase tracking-wider text-[#d8ae5e] font-bold">
                Console Password
              </span>
              <input
                type="password"
                autoFocus
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setAuthError(null);
                }}
                placeholder="Enter password..."
                className="w-full bg-[#101922] border border-[#c99d4e]/45 rounded px-3.5 py-2.5 text-sm text-[#f7efe0] focus:outline-none focus:border-[#efc570]"
              />
            </label>
            {authError && (
              <div className="px-3 py-2 rounded bg-[#3b1c1c] border border-[#c4463c]/60 text-xs text-[#f6c5c0]">
                {authError}
              </div>
            )}
            <div className="flex gap-2.5">
              <button
                type="submit"
                className="flex-1 py-2.5 bg-[#c99d4e] hover:bg-[#dfb261] text-[#14100b] text-sm font-bold rounded cursor-pointer"
              >
                Unlock Console
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 bg-[#1c2a38] text-[#cbbda4] text-sm font-semibold rounded cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="p-6 overflow-y-auto nautical-scroll space-y-6">
            {!hud.adminEnabled && (
              <div className="p-3.5 rounded bg-[#362815] border border-[#d89b3c]/55 text-xs text-[#fae5be]">
                Admin Mode is currently toggled OFF. Click &ldquo;Re-Enable Admin&rdquo; above to use test commands.
              </div>
            )}

            {feedback && (
              <div className="px-4 py-2.5 rounded bg-[#182836] border border-[#c99d4e]/45 text-sm text-[#f4ead5]">
                {feedback}
              </div>
            )}

            {/* Quick Fleet & Companion Upgrades */}
            <div className="space-y-2.5">
              <h3 className="font-display text-sm uppercase tracking-wider text-[#d8ae5e] font-bold flex items-center gap-2">
                <Crown className="w-4 h-4" />
                <span>Flagship, Fleet &amp; Leviathan Controls</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  disabled={!hud.adminEnabled}
                  onClick={() => setFeedback(onRestoreMaxResources().message)}
                  className="p-3 rounded bg-[#1a2c3d] hover:bg-[#233b52] disabled:opacity-45 border border-[#c99d4e]/35 text-left cursor-pointer"
                >
                  <div className="text-sm font-bold text-[#efc570]">Max Ship &amp; Resources</div>
                  <div className="text-xs text-[#b7aa92] mt-0.5">
                    Sovereign Tier 7, 24 guns, 99,999g &amp; full cargo
                  </div>
                </button>

                <button
                  type="button"
                  disabled={!hud.adminEnabled}
                  onClick={() => setFeedback(onSpawnMaxFleet().message)}
                  className="p-3 rounded bg-[#1a2c3d] hover:bg-[#233b52] disabled:opacity-45 border border-[#c99d4e]/35 text-left cursor-pointer"
                >
                  <div className="text-sm font-bold text-[#7ac59b]">Spawn Max 5-Ship Fleet</div>
                  <div className="text-xs text-[#b7aa92] mt-0.5">
                    Full upgraded wedge squadron flying your colors
                  </div>
                </button>

                <button
                  type="button"
                  disabled={!hud.adminEnabled}
                  onClick={() => setFeedback(onSpawnColossalCompanion().message)}
                  className="p-3 rounded bg-[#142e2d] hover:bg-[#1a3d3b] disabled:opacity-45 border border-[#5eead4]/40 text-left cursor-pointer"
                >
                  <div className="text-sm font-bold text-[#5eead4]">Colossal Sea Companion</div>
                  <div className="text-xs text-[#b7aa92] mt-0.5">
                    Summon a loyal legendary sea beast escort
                  </div>
                </button>

                <button
                  type="button"
                  data-testid="admin-project-bounty-btn"
                  disabled={!hud.adminEnabled}
                  onClick={() => setFeedback(onProjectBounty().message)}
                  className="p-3 rounded bg-[#2a1d14] hover:bg-[#3a281b] disabled:opacity-45 border border-[#efc570]/50 text-left cursor-pointer"
                >
                  <div className="text-sm font-bold text-[#efc570]">Project Bounty Contract</div>
                  <div className="text-xs text-[#b7aa92] mt-0.5">
                    Broadcast a Pirate or Crown bounty warrant immediately
                  </div>
                </button>
              </div>
            </div>

            {/* Spawn Ghost Ships by Size */}
            <div className="space-y-2.5">
              <h3 className="font-display text-sm uppercase tracking-wider text-[#5eead4] font-bold flex items-center gap-2">
                <Ghost className="w-4 h-4" />
                <span>Spawn Ghost Ship Ahead</span>
              </h3>
              <div className="flex flex-wrap gap-2">
                {GHOST_TIERS.map((g) => (
                  <button
                    key={g.size}
                    type="button"
                    disabled={!hud.adminEnabled}
                    onClick={() => setFeedback(onSpawnGhostShip(g.size).message)}
                    className="px-3.5 py-2 rounded bg-[#0f262a] hover:bg-[#16383e] disabled:opacity-45 border border-[#5eead4]/45 text-xs font-bold text-[#bff9ee] cursor-pointer"
                  >
                    Spawn {g.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Force Weather (16 Conditions) */}
            <div className="space-y-2.5">
              <h3 className="font-display text-sm uppercase tracking-wider text-[#9ec4d1] font-bold flex items-center gap-2">
                <CloudLightning className="w-4 h-4" />
                <span>Force Weather State ({ALL_WEATHER_TYPES.length} Conditions)</span>
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {ALL_WEATHER_TYPES.map((wt) => {
                  const active = hud.weather.type === wt;
                  return (
                    <button
                      key={wt}
                      type="button"
                      disabled={!hud.adminEnabled}
                      onClick={() => setFeedback(onSetWeather(wt).message)}
                      className={`px-3 py-2 rounded text-xs font-semibold border text-left cursor-pointer disabled:opacity-45 ${
                        active
                          ? 'bg-[#c99d4e] border-[#efc570] text-[#14100b] font-bold'
                          : 'bg-[#101922] hover:bg-[#192735] border-[#c99d4e]/25 text-[#e2d6bf]'
                      }`}
                    >
                      {WEATHER_PRESETS[wt].label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Teleport Near Targets */}
            <div className="space-y-2.5">
              <h3 className="font-display text-sm uppercase tracking-wider text-[#d8ae5e] font-bold flex items-center gap-2">
                <Compass className="w-4 h-4" />
                <span>Teleport Near World Encounters &amp; Armadas</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {targets.map((t) => (
                  <div
                    key={t.id}
                    className="p-3 rounded bg-[#101922] border border-[#c99d4e]/25 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-[#f7efe0] truncate">
                        {t.kind === 'pirate_boss' || t.kind === 'pirate_armada' ? (
                          <Skull className="w-3.5 h-3.5 text-[#f1887c] shrink-0" />
                        ) : t.kind === 'ghost_ship' ? (
                          <Ghost className="w-3.5 h-3.5 text-[#5eead4] shrink-0" />
                        ) : t.kind === 'icefield' ? (
                          <Snowflake className="w-3.5 h-3.5 text-[#93c5fd] shrink-0" />
                        ) : t.kind === 'island_shore' || t.kind === 'settlement' ? (
                          <MapPin className="w-3.5 h-3.5 text-[#4ade80] shrink-0" />
                        ) : (
                          <Ship className="w-3.5 h-3.5 text-[#efc570] shrink-0" />
                        )}
                        <span className="truncate">{t.label}</span>
                      </div>
                      <div className="text-[11px] font-mono-num text-[#9b8f7a]">
                        {t.distance}m away ({Math.round(t.x)}E, {Math.round(-t.z)}N)
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={!hud.adminEnabled}
                      onClick={() => {
                        const res = onTeleportNear(t.id);
                        setFeedback(res.message);
                      }}
                      className="px-3 py-1.5 rounded bg-[#c99d4e] hover:bg-[#dfb261] disabled:opacity-45 text-[#14100b] text-xs font-bold cursor-pointer shrink-0"
                    >
                      Teleport
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
