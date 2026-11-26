import React from 'react';
import { CloudRain, Compass, Thermometer, Wind, X } from 'lucide-react';
import { HudSnapshot } from '../game/types';
import { WEATHER_PRESETS } from '../game/waveMath';

interface WeatherModalProps {
  hud: HudSnapshot;
  onClose: () => void;
}

function compassLabel(rad: number): string {
  const deg = ((rad * 180) / Math.PI + 360) % 360;
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(deg / 45) % 8];
}

function formatEta(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const mins = Math.floor(s / 60);
  const rem = s % 60;
  if (mins === 0) return `~${rem}s`;
  return `~${mins}m ${rem}s`;
}

const SEVERITY_BADGE: Record<string, string> = {
  Calm: 'bg-[#1b3634] text-[#8be3c7] border-[#4e9f76]/40',
  Fair: 'bg-[#1b2d3c] text-[#9ec4d1] border-[#5ba3b8]/40',
  Rough: 'bg-[#362815] text-[#f2c672] border-[#d89b3c]/50',
  Dangerous: 'bg-[#422017] text-[#ffb085] border-[#e06d4d]/60',
  Extreme: 'bg-[#541717] text-[#ffd4cf] border-[#e05a4d]/75',
};

export const WeatherModal: React.FC<WeatherModalProps> = ({ hud, onClose }) => {
  const w = hud.weather;
  const preset = WEATHER_PRESETS[w.type] ?? WEATHER_PRESETS.light_winds;
  const windBearing = compassLabel(w.windDir);

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Barometer and Weather Forecast"
    >
      <div className="nautical-panel rounded-lg w-full max-w-2xl max-h-[89vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-[#c99d4e]/30 flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-[#efc570] font-bold">
              <Compass className="w-4 h-4" />
              <span>Ship’s Barometer &amp; Sky Watch</span>
            </div>
            <h2 className="font-display text-2xl font-bold text-[#f7efe0] mt-0.5">
              {preset.label}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Weather Forecast"
            className="p-2 text-[#cbbda4] hover:text-white hover:bg-[#1e2c3a] rounded cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto nautical-scroll space-y-5">
          {/* Active Hazard Warning */}
          {(w.warningText || hud.activeTornadoWarning) && (
            <div className="p-3.5 rounded bg-[#4a1a1a] border border-[#e05a4d]/70 text-sm text-[#ffd8d4] font-semibold">
              {hud.activeTornadoWarning
                ? 'WATERSPOUT ACTIVE NEARBY — Steer clear of the swirling vortex to avoid massive hull & mast damage!'
                : w.warningText}
            </div>
          )}

          {/* Current Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded bg-[#101922] border border-[#c99d4e]/25 space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-[#a89c86]">
                <Wind className="w-3.5 h-3.5 text-[#9ec4d1]" />
                <span>Wind &amp; Bearing</span>
              </div>
              <div className="font-mono-num text-lg font-bold text-[#f7efe0]">
                {Math.round(w.windSpeed)} kt · {windBearing}
              </div>
            </div>

            <div className="p-3.5 rounded bg-[#101922] border border-[#c99d4e]/25 space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-[#a89c86]">
                <CloudRain className="w-3.5 h-3.5 text-[#9ec4d1]" />
                <span>Sea &amp; Visibility</span>
              </div>
              <div className="text-sm font-bold text-[#f7efe0]">{w.seaConditionLabel}</div>
              <div className="text-xs text-[#9ec4d1]">{w.visibilityLabel}</div>
            </div>

            <div className="p-3.5 rounded bg-[#101922] border border-[#c99d4e]/25 space-y-1 col-span-2 sm:col-span-1">
              <div className="flex items-center gap-1.5 text-xs text-[#a89c86]">
                <Thermometer className="w-3.5 h-3.5 text-[#efc570]" />
                <span>Severity &amp; Hydration</span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-0.5 rounded border text-xs font-bold ${
                    SEVERITY_BADGE[preset.severity] ?? SEVERITY_BADGE.Fair
                  }`}
                >
                  {preset.severity}
                </span>
                <span className="font-mono-num text-xs text-[#d6cbb6]">
                  Water {Math.round(w.waterDrainMult * 100)}%
                </span>
              </div>
            </div>
          </div>

          <p className="text-sm text-[#d6cbb6] leading-relaxed bg-[#101922] p-3.5 rounded border border-[#c99d4e]/20">
            {preset.forecastSummary}
          </p>

          {/* 3-Step Barometer Forecast */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm uppercase tracking-wider text-[#d8ae5e] font-bold">
                Upcoming Barometer Forecast
              </h3>
              <span className="text-xs text-[#9b8f7a] font-mono-num">
                Next shift in {formatEta(w.timeUntilChange)}
              </span>
            </div>

            <div className="space-y-2.5">
              {hud.weatherForecast.map((entry, idx) => (
                <div
                  key={`${entry.type}_${idx}`}
                  className="p-3.5 rounded bg-[#101922] border border-[#c99d4e]/25 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono-num text-[#9ec4d1] font-semibold">
                        #{idx + 1} · {formatEta(entry.etaSeconds)}
                      </span>
                      <span className="font-bold text-sm text-[#f7efe0]">{entry.label}</span>
                      <span
                        className={`px-2 py-0.5 rounded border text-[11px] font-bold ${
                          SEVERITY_BADGE[entry.severity] ?? SEVERITY_BADGE.Fair
                        }`}
                      >
                        {entry.severity}
                      </span>
                      {entry.uncertain && (
                        <span className="px-2 py-0.5 rounded bg-[#2d2415] border border-[#c99d4e]/40 text-[#efc570] text-[11px] font-semibold">
                          Unsteady Pressure
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#b7aa92]">{entry.summary}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-3.5 rounded bg-[#0e161f] border border-[#c99d4e]/20 text-xs text-[#a89c86] leading-relaxed">
            <strong className="text-[#efc570]">Navigator Note:</strong> Hurricanes, hailstorms, lightning storms, and blizzards strain hull planking and sails. Heatwaves raise crew fresh water consumption by up to 55%. Sudden squalls can defy barometer forecasts.
          </div>
        </div>
      </div>
    </div>
  );
};
