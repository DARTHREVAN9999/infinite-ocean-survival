import React from 'react';
import { VoyageStats } from '../game/types';

interface GameOverModalProps {
  stats: VoyageStats;
  onStartNew: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({ stats, onStartNew }) => {
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Voyage Lost"
    >
      <div className="nautical-panel rounded-lg w-full max-w-lg p-7 space-y-5 text-center">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-[#e67064] font-bold">
            Lost At Sea
          </p>
          <h2 className="font-display text-3xl font-bold text-[#f7efe0] mt-1">
            Voyage Ended
          </h2>
          <p className="text-sm text-[#d6cbb6] mt-2 leading-relaxed">
            {stats.causeOfDeath || 'The deep ocean claimed your vessel and crew.'}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 py-3 border-y border-[#c99d4e]/25">
          <div>
            <div className="font-mono-num text-xl font-bold text-[#f7efe0]">{stats.daysSurvived}</div>
            <div className="text-xs text-[#a89c86]">Days Survived</div>
          </div>
          <div>
            <div className="font-mono-num text-xl font-bold text-[#efc570]">{stats.peakGold}</div>
            <div className="text-xs text-[#a89c86]">Peak Gold</div>
          </div>
          <div>
            <div className="font-mono-num text-xl font-bold text-[#f7efe0]">{stats.wrecksExplored}</div>
            <div className="text-xs text-[#a89c86]">Wrecks Searched</div>
          </div>
          <div>
            <div className="font-mono-num text-xl font-bold text-[#f7efe0]">
              {stats.piratesDefeated} ({stats.bossesDefeated} Boss)
            </div>
            <div className="text-xs text-[#a89c86]">Pirates Sunk</div>
          </div>
          <div>
            <div className="font-mono-num text-xl font-bold text-[#f7efe0]">{stats.monstersDefeated}</div>
            <div className="text-xs text-[#a89c86]">Beasts Slain</div>
          </div>
          <div>
            <div className="font-mono-num text-xl font-bold text-[#f7efe0]">
              {Math.round(stats.distanceSailed)}m
            </div>
            <div className="text-xs text-[#a89c86]">Distance Sailed</div>
          </div>
        </div>

        <button
          type="button"
          data-start="true"
          onClick={onStartNew}
          className="w-full py-3 bg-[#c99d4e] hover:bg-[#dfb261] text-[#14100b] font-bold text-base rounded cursor-pointer transition-colors"
        >
          Begin New Survival Run
        </button>
      </div>
    </div>
  );
};
