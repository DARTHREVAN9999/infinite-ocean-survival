import React from 'react';
import { WorldFloatingDamage } from '../game/types';

interface FloatingDamageLayerProps {
  damages: WorldFloatingDamage[];
}

export const FloatingDamageLayer: React.FC<FloatingDamageLayerProps> = ({ damages }) => {
  if (!damages || damages.length === 0) return null;

  return (
    <div
      data-testid="floating-damage-layer"
      aria-live="off"
      className="fixed inset-0 z-20 pointer-events-none overflow-hidden"
    >
      {damages.map((d) => {
        const isTaken = d.direction === 'taken';
        const isAlly = d.direction === 'ally';
        const amountRounded = Math.max(1, Math.round(d.amount));

        const primaryColor = isTaken
          ? d.critical
            ? 'text-[#ff7066]'
            : 'text-[#ff9c8f]'
          : isAlly
            ? 'text-[#6ee7b7]'
            : d.critical
              ? 'text-[#fbbf24]'
              : 'text-[#f8dfa4]';

        const subColor = isTaken
          ? 'text-[#ffd0ca]'
          : isAlly
            ? 'text-[#bbf7d0]'
            : 'text-[#e5d8bc]';

        const sourceBadge =
          d.source === 'ram'
            ? 'RAM'
            : d.source === 'monster'
              ? 'BEAST'
              : d.source === 'hazard'
                ? 'REEF/ICE'
                : null;

        return (
          <div
            key={d.id}
            data-testid="floating-damage-popup"
            style={{
              left: `${d.screenX}px`,
              top: `${d.screenY}px`,
              opacity: d.opacity,
              transform: `translate(-50%, -50%) scale(${d.critical ? 1.14 : 1})`,
            }}
            className="absolute flex flex-col items-center text-center whitespace-nowrap select-none hud-text-shadow"
          >
            <div className={`font-mono-num font-extrabold leading-none ${d.critical ? 'text-xl' : 'text-base'} ${primaryColor}`}>
              -{amountRounded}
              {d.critical ? '!' : ''}
              <span className="ml-1.5 text-xs uppercase tracking-wider font-bold">
                {d.partLabel}
              </span>
            </div>
            <div className={`text-[11px] font-semibold tracking-wide leading-tight mt-0.5 ${subColor}`}>
              {d.targetName}
              {sourceBadge ? ` · ${sourceBadge}` : ''}
            </div>
          </div>
        );
      })}
    </div>
  );
};
