import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Inventory, ResourceId, ShipwreckData, WreckSection } from '../game/types';
import { RESOURCE_DEFS } from '../game/economy';

interface WreckModalProps {
  wreck: ShipwreckData;
  onClose: () => void;
  onCompleteSearch: (
    wreckId: string,
    sectionId: string
  ) => {
    ok: boolean;
    gold: number;
    loot: Partial<Inventory>;
    hazardMsg: string | null;
  };
  onResolveSurvivor: (
    wreckId: string,
    sectionId: string,
    choice: 'accept' | 'force' | 'decline'
  ) => { ok: boolean; message: string };
}

export const WreckModal: React.FC<WreckModalProps> = ({
  wreck,
  onClose,
  onCompleteSearch,
  onResolveSurvivor,
}) => {
  const [searchingId, setSearchingId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [report, setReport] = useState<string | null>(null);

  const wreckRef = useRef(wreck);
  const onCompleteSearchRef = useRef(onCompleteSearch);
  wreckRef.current = wreck;
  onCompleteSearchRef.current = onCompleteSearch;

  useEffect(() => {
    if (!searchingId) return;
    const sec = wreckRef.current.sections.find((s) => s.id === searchingId);
    if (!sec) return;
    const durationMs = Math.max(900, sec.searchDuration * 650);
    const start = performance.now();

    const timer = window.setInterval(() => {
      const pct = Math.min(1, (performance.now() - start) / durationMs);
      setProgress(pct);
      if (pct >= 1) {
        window.clearInterval(timer);
        const res = onCompleteSearchRef.current(wreckRef.current.id, searchingId);
        setSearchingId(null);
        setProgress(0);
        if (res.ok) {
          const items = (Object.entries(res.loot) as [ResourceId, number][])
            .filter(([id, q]) => q > 0 && RESOURCE_DEFS[id])
            .map(([id, q]) => `${q} ${RESOURCE_DEFS[id].name}`);
          let text =
            res.gold === 0 && items.length === 0 && !sec.collectible
              ? `Searched ${sec.name}: stripped clean by sea & salvagers.`
              : `Recovered ${res.gold} gold${items.length ? ` and ${items.join(', ')}` : ''}${sec.collectible ? ` + Relic: ${sec.collectible}` : ''}.`;
          if (res.hazardMsg) text += ` ${res.hazardMsg}`;
          setReport(text);
        }
      }
    }, 50);

    return () => window.clearInterval(timer);
  }, [searchingId]);

  const handleSurvivor = (sec: WreckSection, choice: 'accept' | 'force' | 'decline') => {
    const res = onResolveSurvivor(wreck.id, sec.id, choice);
    setReport(res.message);
  };

  const searchedCount = wreck.sections.filter((s) => s.searched).length;
  const totalCount = wreck.sections.length;
  const allSearched = searchedCount >= totalCount && totalCount > 0;
  const searchPct = Math.round((searchedCount / Math.max(1, totalCount)) * 100);
  const isGhost = Boolean(wreck.isGhostWreck);

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/72 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Explore ${wreck.name}`}
    >
      <div className="nautical-panel rounded-lg w-full max-w-3xl max-h-[88vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-[#c99d4e]/25 space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              {isGhost && (
                <p className="text-xs uppercase tracking-widest text-[#5eead4] font-bold">
                  Ghost Ship Exploration {wreck.ghostSize ? `· ${wreck.ghostSize}` : ''}
                </p>
              )}
              {wreck.isCharred && !isGhost && (
                <p className="text-xs uppercase tracking-widest text-[#f59e0b] font-bold">
                  Exploded &amp; Charred Hull · Active Fire · Reduced Surviving Loot
                </p>
              )}
              <h2 className="font-display text-2xl font-bold text-[#f7efe0]">{wreck.name}</h2>
              <p className="text-sm text-[#c4b79e] capitalize mt-0.5">
                {wreck.archetype.replace(/_/g, ' ')} ·{' '}
                <span className={`font-mono-num font-semibold ${isGhost ? 'text-[#5eead4]' : 'text-[#efc570]'}`}>
                  {searchedCount} / {totalCount} Areas Searched
                </span>
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Leave Shipwreck"
              className="p-2 text-[#cbbda4] hover:text-white hover:bg-[#1e2c3a] rounded cursor-pointer"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="space-y-1.5">
            <div className="h-2.5 bg-[#101922] rounded-sm overflow-hidden border border-[#c99d4e]/25">
              <div
                className={`h-full transition-all duration-300 ${
                  allSearched ? (isGhost ? 'bg-[#5eead4]' : 'bg-[#4e9f76]') : 'bg-[#c99d4e]'
                }`}
                style={{ width: `${searchPct}%` }}
              />
            </div>
            {allSearched && (
              <div
                className={`px-3 py-1.5 rounded border text-xs font-bold tracking-wider uppercase text-center ${
                  isGhost
                    ? 'bg-[#0f292c] border-[#5eead4]/55 text-[#9bf7e9]'
                    : 'bg-[#183126] border-[#4e9f76]/50 text-[#8ce0b3]'
                }`}
              >
                {isGhost
                  ? `GHOST SHIP FULLY EXPLORED — ALL ${totalCount} AREAS SEARCHED`
                  : `Shipwreck Fully Searched — All ${totalCount} Areas Explored`}
              </div>
            )}
          </div>
        </div>

        {report && (
          <div className="mx-6 mt-4 px-4 py-2.5 rounded bg-[#182836] border border-[#c99d4e]/45 text-sm text-[#f4ead5]">
            {report}
          </div>
        )}

        <div className="p-6 space-y-4 overflow-y-auto nautical-scroll">
          {wreck.sections.map((sec) => {
            const isSearching = searchingId === sec.id;
            const pctDisplay = Math.round(progress * 100);
            return (
              <div
                key={sec.id}
                className="p-4 rounded bg-[#111b25] border border-[#c99d4e]/25 space-y-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-[#f7efe0]">{sec.name}</h3>
                    <p className="text-xs text-[#c4b79e] mt-1">{sec.description}</p>
                    <p className="text-xs text-[#d6a273] mt-1">
                      Risk: {sec.dangerLevel} · {sec.dangerNote}
                    </p>
                  </div>

                  {!sec.searched ? (
                    <button
                      type="button"
                      disabled={searchingId !== null}
                      onClick={() => {
                        setReport(null);
                        setSearchingId(sec.id);
                        setProgress(0);
                      }}
                      className="px-4 py-2 bg-[#c99d4e] hover:bg-[#dfb261] disabled:bg-[#232f3a] disabled:text-[#869099] text-[#14100b] text-sm font-bold rounded cursor-pointer transition-colors whitespace-nowrap"
                    >
                      {isSearching ? `Searching... ${pctDisplay}%` : `Search Section (${sec.searchDuration.toFixed(1)}s)`}
                    </button>
                  ) : (
                    <span className="text-sm font-mono-num font-semibold text-[#7ac59b]">Searched</span>
                  )}
                </div>

                {isSearching && (
                  <div className="h-3 bg-[#1c2936] rounded-sm overflow-hidden border border-[#c99d4e]/30">
                    <div className="h-full bg-[#c99d4e]" style={{ width: `${pctDisplay}%` }} />
                  </div>
                )}

                {sec.searched && (
                  <div className="pt-2 border-t border-[#c99d4e]/15 text-sm text-[#d6cbb6] space-y-2.5">
                    {sec.collectible && (
                      <div className="px-3 py-1.5 rounded bg-[#0f2829] border border-[#5eead4]/50 text-xs font-bold text-[#9bf7e9]">
                        Spectral Relic Recovered: {sec.collectible}
                      </div>
                    )}
                    {sec.emptyRoom || (sec.gold <= 0 && Object.values(sec.loot).every((q) => !q)) ? (
                      !sec.collectible && (
                        <div className="text-xs italic text-[#9ea8b2]">
                          Compartment stripped clean — nothing usable left behind.
                        </div>
                      )
                    ) : (
                      <div>
                        Found:{' '}
                        <strong className="font-mono-num text-[#efc570]">{sec.gold} gold</strong>
                        {(Object.entries(sec.loot) as [ResourceId, number][]).map(([rId, q]) =>
                          q > 0 && RESOURCE_DEFS[rId] ? ` · ${q} ${RESOURCE_DEFS[rId].name}` : ''
                        )}
                      </div>
                    )}

                    {sec.survivor && !sec.survivor.resolved && (
                      <div className="p-3.5 rounded bg-[#182633] border border-[#c99d4e]/40 space-y-2.5">
                        <div className="text-sm font-bold text-[#f7efe0]">
                          Survivor Found: {sec.survivor.name}
                        </div>
                        <div className="text-xs font-mono-num text-[#9ec4d1]">
                          Sail {sec.survivor.skills.sailing} · Rep {sec.survivor.skills.repair} · Gun{' '}
                          {sec.survivor.skills.combat} · Nav {sec.survivor.skills.navigation}
                        </div>
                        <p className="text-xs text-[#cfc3ae]">
                          {sec.survivor.offerRefused
                            ? 'Turned down your offer to join voluntarily — you can still force them aboard or leave them.'
                            : sec.survivor.disposition === 'gives_info'
                              ? 'Prefers to sail solo on a skiff, but offers valuable chart intelligence.'
                              : sec.survivor.disposition === 'needs_food'
                                ? `Asks for ${sec.survivor.demandAmount} provisions if they agree to join (50% chance to refuse).`
                                : sec.survivor.disposition === 'needs_medicine'
                                  ? `Needs ${sec.survivor.demandAmount} medical supply if they agree to join (50% chance to refuse).`
                                  : 'Will consider joining your crew voluntarily (50% chance they turn down the offer unless forced).'}
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            disabled={Boolean(sec.survivor.offerRefused)}
                            onClick={() => handleSurvivor(sec, 'accept')}
                            className="px-3.5 py-1.5 bg-[#3d8b68] hover:bg-[#49a37b] disabled:bg-[#1f2933] disabled:text-[#7c858e] text-white text-xs font-bold rounded cursor-pointer"
                          >
                            {sec.survivor.offerRefused
                              ? 'Offer Turned Down'
                              : sec.survivor.disposition === 'gives_info'
                                ? 'Hear Information'
                                : sec.survivor.disposition === 'needs_food'
                                  ? `Offer ${sec.survivor.demandAmount} Food & Recruit (50%)`
                                  : sec.survivor.disposition === 'needs_medicine'
                                    ? 'Offer Medicine & Recruit (50%)'
                                    : 'Ask to Join Crew (+4 Rep · 50%)'}
                          </button>
                          {sec.survivor.disposition !== 'gives_info' && (
                            <button
                              type="button"
                              onClick={() => handleSurvivor(sec, 'force')}
                              className="px-3.5 py-1.5 bg-[#8e332c] hover:bg-[#a63d35] text-white text-xs font-bold rounded cursor-pointer"
                            >
                              Force Into Crew (-6 Rep · Always)
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleSurvivor(sec, 'decline')}
                            className="px-3 py-1.5 bg-[#1e2c3a] hover:bg-[#2a3b4d] text-[#cbbda4] text-xs font-semibold rounded cursor-pointer"
                          >
                            Leave
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
