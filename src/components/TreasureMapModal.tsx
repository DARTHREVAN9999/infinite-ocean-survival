import React from 'react';
import { Compass, MapPin, ScrollText, X } from 'lucide-react';
import { SaveData } from '../game/types';
import { RESOURCE_DEFS } from '../game/economy';

interface TreasureMapModalProps {
  save: SaveData;
  onClose: () => void;
}

export const TreasureMapModal: React.FC<TreasureMapModalProps> = ({ save, onClose }) => {
  const fragments = save.treasureFragments ?? 0;
  const maps = save.treasureMaps ?? [];
  const activeCount = maps.filter((m) => !m.found).length;

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Treasure Charts and Fragments"
    >
      <div className="parchment-sheet rounded-lg w-full max-w-3xl max-h-[88vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-[#7a5a32]/30 flex items-center justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold text-[#2b1d11] flex items-center gap-2">
              <ScrollText className="w-6 h-6 text-[#8b4513]" />
              <span>Treasure Charts &amp; Map Fragments</span>
            </h2>
            <p className="text-xs text-[#61482c] mt-0.5">
              Every 3 salvaged map fragments assemble a full X-marked parchment bearing hidden island treasure.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Treasure Ledger"
            className="p-2 text-[#5c4226] hover:text-[#1f1309] hover:bg-[#d8c39b] rounded cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5">
          {/* Fragment Progress */}
          <div className="p-4 rounded bg-[#efe3c8] border border-[#8c6b42]/45 space-y-2">
            <div className="flex items-center justify-between text-sm font-bold text-[#2b1d11]">
              <span>Loose Map Fragments</span>
              <span data-testid="treasure-fragments-count" className="font-mono-num">
                {fragments} / 3 Fragments
              </span>
            </div>
            <div className="h-2.5 bg-[#d6c29d] rounded-sm overflow-hidden border border-[#8c6b42]/40">
              <div
                className="h-full bg-[#9b4d1b] transition-all duration-200"
                style={{ width: `${Math.min(100, Math.round((fragments / 3) * 100))}%` }}
              />
            </div>
            <p className="text-xs text-[#61482c]">
              Find fragments in drifting bottles, coastal caves, beached wrecks, and settlement tavern rumors.
            </p>
          </div>

          {/* Assembled Treasure Maps */}
          <div className="space-y-3">
            <h3 className="font-display text-sm font-bold uppercase tracking-wider text-[#5b3f20]">
              Assembled X-Charts ({activeCount} Active · {maps.length} Total)
            </h3>

            {maps.length === 0 ? (
              <div className="p-5 rounded bg-[#efe3c8] border border-[#8c6b42]/35 text-sm text-[#61482c] italic">
                No complete treasure charts bound yet. Sail ashore on Coral Haven or speak with tavern sailors to gather 3 fragments.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {maps.map((tm) => {
                  const lootSummary = Object.entries(tm.rewardLoot)
                    .filter(([, q]) => typeof q === 'number' && q > 0)
                    .map(([k, q]) => `${q} ${RESOURCE_DEFS[k as keyof typeof RESOURCE_DEFS]?.name || k}`)
                    .join(', ');

                  return (
                    <div
                      key={tm.id}
                      className={`p-4 rounded border space-y-1.5 ${
                        tm.found
                          ? 'bg-[#e3d5b8] border-[#7a5a32]/30 opacity-80'
                          : 'bg-[#f6ebd4] border-[#8b4513]/55'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="font-display text-base font-bold text-[#2b1d11] flex items-center gap-1.5">
                            <MapPin className={`w-4 h-4 ${tm.found ? 'text-[#4e9f76]' : 'text-[#a82c24]'}`} />
                            <span>{tm.title}</span>
                          </h4>
                          <div className="text-xs font-semibold text-[#61482c] flex items-center gap-1.5 mt-0.5">
                            <Compass className="w-3.5 h-3.5" />
                            <span>Island: {tm.islandName}</span>
                            <span className="font-mono-num">
                              ({Math.round(tm.targetX)}E, {Math.round(-tm.targetZ)}N)
                            </span>
                          </div>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-bold ${
                            tm.found ? 'bg-[#3d8b68] text-white' : 'bg-[#a82c24] text-white'
                          }`}
                        >
                          {tm.found ? 'Excavated' : 'X Marks Spot'}
                        </span>
                      </div>
                      <p className="text-xs text-[#4a341c] italic">{tm.clueText}</p>
                      <div className="text-xs font-mono-num text-[#5b3f20]">
                        Hoard: ~{tm.rewardGold} gold{lootSummary ? ` · ${lootSummary}` : ''}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
