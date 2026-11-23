import React, { useState } from 'react';
import { GameSettings, UIScale } from '../game/types';

interface PauseSettingsModalProps {
  settings: GameSettings;
  onResume: () => void;
  onSaveNow: () => boolean;
  onUpdateSettings: (s: GameSettings) => void;
  onReturnTitle: () => void;
}

const UI_SCALE_OPTIONS: { id: UIScale; label: string }[] = [
  { id: 'small', label: 'Small (14px)' },
  { id: 'normal', label: 'Normal (16px)' },
  { id: 'large', label: 'Large (18px · Default)' },
  { id: 'extra_large', label: 'Extra Large (20px)' },
];

export const PauseSettingsModal: React.FC<PauseSettingsModalProps> = ({
  settings,
  onResume,
  onSaveNow,
  onUpdateSettings,
  onReturnTitle,
}) => {
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const handleSave = () => {
    const ok = onSaveNow();
    setSavedMsg(ok ? 'Voyage saved successfully.' : 'Unable to access browser storage.');
  };

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Pause and Settings"
    >
      <div className="nautical-panel rounded-lg w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-[#c99d4e]/25">
          <h2 className="font-display text-2xl font-bold text-[#f7efe0]">Voyage Paused &amp; Settings</h2>
          <p className="text-sm text-[#b8ac95] mt-0.5">
            Adjust audio, interface scale, journal automation, or save your progress.
          </p>
        </div>

        <div className="p-6 overflow-y-auto nautical-scroll space-y-5">
          {savedMsg && (
            <div className="px-4 py-2.5 rounded bg-[#182d25] border border-[#4e9f76]/50 text-sm text-[#a9e2c4]">
              {savedMsg}
            </div>
          )}

          {/* Audio Section */}
          <div className="p-4 rounded bg-[#101922] border border-[#c99d4e]/20 space-y-3 text-sm text-[#e0d5c0]">
            <h3 className="font-display text-xs uppercase tracking-widest text-[#efc570] font-bold">
              Sound &amp; Orchestral Music
            </h3>

            <label className="flex items-center justify-between gap-4 cursor-pointer">
              <span>Background Music Enabled</span>
              <input
                type="checkbox"
                checked={settings.musicEnabled}
                onChange={(e) =>
                  onUpdateSettings({ ...settings, musicEnabled: e.target.checked })
                }
                className="accent-[#c99d4e] w-4 h-4"
              />
            </label>

            <label className="flex items-center justify-between gap-4">
              <span>Master Volume ({Math.round(settings.masterVolume * 100)}%)</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={settings.masterVolume}
                onChange={(e) =>
                  onUpdateSettings({ ...settings, masterVolume: parseFloat(e.target.value) })
                }
                className="w-44 accent-[#c99d4e]"
              />
            </label>

            <label className="flex items-center justify-between gap-4">
              <span>Music Volume ({Math.round(settings.musicVolume * 100)}%)</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={settings.musicVolume}
                onChange={(e) =>
                  onUpdateSettings({ ...settings, musicVolume: parseFloat(e.target.value) })
                }
                className="w-44 accent-[#c99d4e]"
              />
            </label>

            <label className="flex items-center justify-between gap-4">
              <span>Sound Effects Volume ({Math.round(settings.sfxVolume * 100)}%)</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={settings.sfxVolume}
                onChange={(e) =>
                  onUpdateSettings({ ...settings, sfxVolume: parseFloat(e.target.value) })
                }
                className="w-44 accent-[#c99d4e]"
              />
            </label>
          </div>

          {/* Display, Interface & Gameplay Toggles */}
          <div className="p-4 rounded bg-[#101922] border border-[#c99d4e]/20 space-y-3 text-sm text-[#e0d5c0]">
            <h3 className="font-display text-xs uppercase tracking-widest text-[#efc570] font-bold">
              Interface, Logbook &amp; Graphics
            </h3>

            <label className="flex items-center justify-between gap-4">
              <span>GUI &amp; Text Size</span>
              <select
                value={settings.uiScale}
                onChange={(e) =>
                  onUpdateSettings({ ...settings, uiScale: e.target.value as UIScale })
                }
                className="bg-[#182430] border border-[#c99d4e]/40 rounded px-3 py-1.5 text-sm text-[#f7efe0]"
              >
                {UI_SCALE_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-center justify-between gap-4">
              <span>Graphics Detail</span>
              <select
                value={settings.graphicsQuality}
                onChange={(e) =>
                  onUpdateSettings({
                    ...settings,
                    graphicsQuality: e.target.value as GameSettings['graphicsQuality'],
                  })
                }
                className="bg-[#182430] border border-[#c99d4e]/40 rounded px-3 py-1.5 text-sm text-[#f7efe0]"
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Performance</option>
              </select>
            </label>

            <label className="flex items-center justify-between gap-4">
              <span>Mouse Orbit Sensitivity ({settings.mouseSensitivity.toFixed(1)}x)</span>
              <input
                type="range"
                min={0.3}
                max={2.0}
                step={0.1}
                value={settings.mouseSensitivity}
                onChange={(e) =>
                  onUpdateSettings({ ...settings, mouseSensitivity: parseFloat(e.target.value) })
                }
                className="w-44 accent-[#c99d4e]"
              />
            </label>

            <label className="flex items-center justify-between gap-4 cursor-pointer">
              <span>Auto-Record Important Events in Journal</span>
              <input
                type="checkbox"
                checked={settings.autoJournalEnabled}
                onChange={(e) =>
                  onUpdateSettings({ ...settings, autoJournalEnabled: e.target.checked })
                }
                className="accent-[#c99d4e] w-4 h-4"
              />
            </label>

            <label className="flex items-center justify-between gap-4 cursor-pointer">
              <span>Discovery Tutorial Tips</span>
              <input
                type="checkbox"
                checked={settings.tutorialsEnabled}
                onChange={(e) =>
                  onUpdateSettings({ ...settings, tutorialsEnabled: e.target.checked })
                }
                className="accent-[#c99d4e] w-4 h-4"
              />
            </label>

            <label className="flex items-center justify-between gap-4 cursor-pointer">
              <span>Autosave Every 30 Seconds</span>
              <input
                type="checkbox"
                checked={settings.autoSaveEnabled}
                onChange={(e) =>
                  onUpdateSettings({ ...settings, autoSaveEnabled: e.target.checked })
                }
                className="accent-[#c99d4e] w-4 h-4"
              />
            </label>
          </div>

          <div className="p-3.5 rounded bg-[#101821] border border-[#c99d4e]/20 text-xs text-[#b8ac95] leading-relaxed">
            <strong className="text-[#efc570]">Controls:</strong> W/S Throttle · A/D Steer ·{' '}
            <strong>Space</strong> Gradual Stop (Heave To) · Mouse Drag Orbit Camera · Wheel Zoom · E Interact · Tab Ship, Ordnance, Repairs &amp; Flag · J Journal · M Sea Chart · Esc Pause
          </div>
        </div>

        <div className="px-6 py-4 border-t border-[#c99d4e]/25 bg-[#0d151e] flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={onResume}
            className="flex-1 py-2.5 bg-[#c99d4e] hover:bg-[#dfb261] text-[#14100b] text-sm font-bold rounded cursor-pointer transition-colors"
          >
            Resume Sailing
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 py-2.5 bg-[#203344] hover:bg-[#2a4359] text-[#f7efe0] text-sm font-bold rounded cursor-pointer transition-colors"
          >
            Save Voyage
          </button>
          <button
            type="button"
            onClick={onReturnTitle}
            className="py-2.5 px-5 bg-[#1a222b] hover:bg-[#25303d] text-[#cbbda4] text-sm font-semibold rounded cursor-pointer transition-colors"
          >
            Title
          </button>
        </div>
      </div>
    </div>
  );
};
