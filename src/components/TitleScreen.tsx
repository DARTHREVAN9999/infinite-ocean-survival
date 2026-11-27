import React, { useState } from 'react';
import { RefreshCw, Ship } from 'lucide-react';
import { SaveData } from '../game/types';
import { pickRandomShipName, PRE_CHOSEN_SHIP_NAMES } from '../game/economy';

interface TitleScreenProps {
  savedVoyage: SaveData | null;
  onStartNew: (shipName: string) => void;
  onContinue: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  savedVoyage,
  onStartNew,
  onContinue,
}) => {
  const [selectedShipName, setSelectedShipName] = useState<string>(() => PRE_CHOSEN_SHIP_NAMES[0]);

  return (
    <div className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between p-8 md:p-14">
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(95deg, rgba(6,14,22,0.82) 0%, rgba(6,14,22,0.44) 36%, rgba(6,14,22,0.02) 64%, rgba(6,14,22,0.05) 100%)',
        }}
      />

      <div className="relative z-10 max-w-xl my-auto pointer-events-auto">
        <svg
          viewBox="0 0 120 44"
          className="w-28 h-11 mb-4 text-[#d8ae5e]"
          aria-hidden="true"
        >
          <line x1="0" y1="22" x2="36" y2="22" stroke="currentColor" strokeWidth="1.2" opacity="0.65" />
          <line x1="84" y1="22" x2="120" y2="22" stroke="currentColor" strokeWidth="1.2" opacity="0.65" />
          <circle cx="60" cy="22" r="16" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <circle cx="60" cy="22" r="11" fill="none" stroke="currentColor" strokeWidth="0.8" opacity="0.55" />
          <polygon points="60,2 64,18 60,15 56,18" fill="currentColor" />
          <polygon points="60,42 64,26 60,29 56,26" fill="currentColor" opacity="0.6" />
          <polygon points="40,22 56,18 53,22 56,26" fill="currentColor" opacity="0.6" />
          <polygon points="80,22 64,18 67,22 64,26" fill="currentColor" opacity="0.6" />
          <circle cx="60" cy="22" r="2.6" fill="#efe4cc" />
        </svg>

        <h1
          className="font-display text-4xl sm:text-5xl md:text-6xl font-bold tracking-[0.1em] text-[#f4ead5] hud-text-shadow leading-[1.08]"
          style={{ textWrap: 'balance' }}
        >
          INFINITE OCEAN SURVIVAL
        </h1>

        <p className="mt-4 text-base leading-relaxed text-[#e6decb] max-w-md hud-text-shadow">
          Sail an endless open sea. Salvage wrecks, trade or raid across factions, upgrade your ship, and survive the deep.
        </p>

        {/* Vessel name — this is the name other players see above your ship */}
        <div className="mt-6 max-w-md p-3.5 rounded-md bg-[#0e1924]/92 border border-[#c99d4e]/40 space-y-2">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-[#d8ae5e] font-bold pt-1">
            <Ship className="w-3.5 h-3.5" />
            <span>{savedVoyage ? 'New Voyage Vessel Name — shown above your ship' : 'Choose Vessel Name — shown above your ship'}</span>
          </div>
          <div className="flex items-center gap-2">
            <select
              aria-label="Choose Starting Ship Name"
              data-testid="title-ship-name-select"
              value={selectedShipName}
              onChange={(e) => setSelectedShipName(e.target.value)}
              className="flex-1 bg-[#142230] border border-[#c99d4e]/40 rounded px-3 py-2 text-sm font-semibold text-[#f7efe0] focus:outline-none focus:border-[#efc570] cursor-pointer"
            >
              {PRE_CHOSEN_SHIP_NAMES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <button
              type="button"
              data-testid="title-reroll-ship-name"
              onClick={() => setSelectedShipName((prev) => pickRandomShipName(prev))}
              className="px-3.5 py-2 rounded bg-[#1b2d3f] hover:bg-[#243c54] border border-[#c99d4e]/45 text-xs font-bold text-[#efc570] flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reroll</span>
            </button>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3.5">
          {savedVoyage ? (
            <>
              <button
                type="button"
                data-start="true"
                onClick={onContinue}
                className="px-7 py-3.5 bg-[#c99d4e] hover:bg-[#dfb261] text-[#14100b] font-bold text-base tracking-wide rounded transition-colors cursor-pointer whitespace-nowrap shadow-lg"
              >
                Continue {savedVoyage.player.shipName} (Day {savedVoyage.day})
              </button>
              <button
                type="button"
                data-new-voyage="true"
                onClick={() => onStartNew(selectedShipName)}
                className="px-6 py-3.5 bg-[#121d28]/95 hover:bg-[#1a2938] text-[#efe4cc] border border-[#c99d4e]/55 font-semibold text-base tracking-wide rounded transition-colors cursor-pointer whitespace-nowrap"
              >
                New Voyage
              </button>
            </>
          ) : (
            <button
              type="button"
              data-start="true"
              onClick={() => onStartNew(selectedShipName)}
              className="px-8 py-4 bg-[#c99d4e] hover:bg-[#dfb261] text-[#14100b] font-bold text-base tracking-wide rounded transition-colors cursor-pointer whitespace-nowrap shadow-lg"
            >
              Set Sail
            </button>
          )}
        </div>
      </div>

      <div className="relative z-10 text-xs md:text-sm text-[#ddd2bc]/90 tracking-wide hud-text-shadow">
        WASD Sail · Space Stop Ship · Mouse Drag Orbit Camera · E Interact · Tab Ship/Weapons/Repairs/Flag · J Journal · M Sea Chart · Esc Pause
      </div>
    </div>
  );
};
