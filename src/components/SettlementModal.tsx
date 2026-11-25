import React, { useState } from 'react';
import { Anchor, Compass, Fish, ScrollText, Users, X } from 'lucide-react';
import {
  FishingGearId,
  IslandSettlementData,
  ResourceId,
  SaveData,
} from '../game/types';
import { RESOURCE_DEFS, RESOURCE_LIST } from '../game/economy';
import { FISHING_GEAR_ORDER, FISHING_GEAR_SPECS } from '../game/fishing';

interface SettlementModalProps {
  settlement: IslandSettlementData;
  save: SaveData;
  onClose: () => void;
  onStepAshore?: (islandId: string) => void;
  onTrade: (
    settlementId: string,
    mode: 'buy' | 'sell',
    resId: ResourceId,
    qty: number
  ) => { ok: boolean; message: string };
  onHireCrew: (settlementId: string, crewId: string) => { ok: boolean; message: string };
  onHearRumor: (settlementId: string) => { ok: boolean; message: string };
  onCompleteErrand: (settlementId: string) => { ok: boolean; message: string };
  onBuyFishingGear: (gearId: FishingGearId) => { ok: boolean; message: string };
}

type SettlementTab = 'market' | 'fishing' | 'tavern' | 'errand';

export const SettlementModal: React.FC<SettlementModalProps> = ({
  settlement,
  save,
  onClose,
  onStepAshore,
  onTrade,
  onHireCrew,
  onHearRumor,
  onCompleteErrand,
  onBuyFishingGear,
}) => {
  const [tab, setTab] = useState<SettlementTab>('market');
  const [feedback, setFeedback] = useState<string | null>(null);

  const p = save.player;
  const isAbandoned = settlement.faction === 'abandoned';
  const tradeableItems = RESOURCE_LIST.filter(
    (r) => (settlement.stock[r.id] || 0) > 0 || (p.inventory[r.id] || 0) > 0
  );

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`${settlement.name} Settlement`}
    >
      <div className="nautical-panel rounded-lg w-full max-w-4xl max-h-[84vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-[#c99d4e]/30 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-[#9ec4d1] font-bold">
              {settlement.kind.replace(/_/g, ' ')} · {settlement.faction.replace(/_/g, ' ')}
            </p>
            <h2 className="font-display text-2xl font-bold text-[#f7efe0]">{settlement.name}</h2>
            <p className="text-xs text-[#c4b79e] mt-0.5">
              Your Gold: <strong className="font-mono-num text-[#efc570]">{Math.round(p.gold)}g</strong> · Settlement Treasury:{' '}
              <strong className="font-mono-num text-[#f7efe0]">{Math.round(settlement.gold)}g</strong>
            </p>
          </div>
          <div className="flex items-center gap-2">
            {onStepAshore && (
              <button
                type="button"
                data-testid="settlement-step-ashore-btn"
                onClick={() => onStepAshore(settlement.islandId)}
                className="px-3.5 py-2 rounded bg-[#1d3e34] hover:bg-[#275245] border border-[#4ade80]/45 text-xs font-bold text-[#c9f7dc] flex items-center gap-1.5 cursor-pointer"
              >
                <Compass className="w-4 h-4" />
                <span>Go Ashore &amp; Explore</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Leave Settlement"
              className="p-2 text-[#cbbda4] hover:text-white hover:bg-[#1e2c3a] rounded cursor-pointer"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div
          role="tablist"
          aria-label="Settlement Districts"
          className="px-6 pt-2 border-b border-[#c99d4e]/25 flex items-center gap-2 overflow-x-auto"
        >
          {(
            [
              ['market', 'Quayside Market', Anchor],
              ['fishing', 'Fishing Rigging', Fish],
              ['tavern', `Tavern & Sailors (${settlement.hireableCrew.length})`, Users],
              ['errand', 'Harbor Errand', ScrollText],
            ] as [SettlementTab, string, React.ComponentType<{ className?: string }>][]
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => {
                setTab(id);
                setFeedback(null);
              }}
              className={`px-3 py-2 text-xs md:text-sm font-semibold border-b-2 flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                tab === id
                  ? 'border-[#c99d4e] text-[#f7efe0]'
                  : 'border-transparent text-[#9d917c] hover:text-[#e2d6bf]'
              }`}
            >
              <Icon className="w-4 h-4 text-[#d8ae5e]" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {feedback && (
          <div
            data-testid="settlement-feedback"
            className="mx-6 mt-3 px-4 py-2 rounded bg-[#182836] border border-[#c99d4e]/45 text-sm text-[#f4ead5]"
          >
            {feedback}
          </div>
        )}

        <div className="p-5 overflow-y-auto nautical-scroll flex-1 space-y-4">
          {tab === 'market' && (
            <div className="space-y-3">
              {isAbandoned ? (
                <div className="p-5 rounded bg-[#101a24] border border-[#c99d4e]/25 text-sm text-[#cbbda4]">
                  No harbor merchants remain at this abandoned landing. Search the tavern logbook or harbor errand board instead.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {tradeableItems.map((item) => {
                    const stStock = Math.floor(settlement.stock[item.id] || 0);
                    const held = Math.floor(p.inventory[item.id] || 0);
                    const buyPrice = Math.max(2, Math.round(item.basePrice * 1.08));
                    const sellPrice = Math.max(2, Math.round(item.basePrice * 0.68));
                    return (
                      <div
                        key={item.id}
                        className="p-3 rounded bg-[#101a24] border border-[#c99d4e]/25 flex flex-col justify-between gap-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-sm font-bold text-[#f7efe0]">{item.name}</div>
                            <div className="text-xs text-[#9ec4d1] font-mono-num">
                              Dock Stock: {stStock} · In Hold: {held}
                            </div>
                          </div>
                          <div className="text-right text-xs font-mono-num">
                            <div className="text-[#efc570]">Buy {buyPrice}g</div>
                            <div className="text-[#7ac59b]">Sell {sellPrice}g</div>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            disabled={stStock < 1 || p.gold < buyPrice}
                            onClick={() => setFeedback(onTrade(settlement.id, 'buy', item.id, 1).message)}
                            className="px-2.5 py-1 rounded bg-[#21364a] hover:bg-[#2c4760] disabled:opacity-40 text-xs font-bold text-[#f7efe0] cursor-pointer"
                          >
                            Buy 1
                          </button>
                          <button
                            type="button"
                            disabled={stStock < 5 || p.gold < buyPrice * 5}
                            onClick={() => setFeedback(onTrade(settlement.id, 'buy', item.id, 5).message)}
                            className="px-2.5 py-1 rounded bg-[#21364a] hover:bg-[#2c4760] disabled:opacity-40 text-xs font-bold text-[#f7efe0] cursor-pointer"
                          >
                            Buy 5
                          </button>
                          <button
                            type="button"
                            disabled={held < 1 || settlement.gold < sellPrice}
                            onClick={() => setFeedback(onTrade(settlement.id, 'sell', item.id, 1).message)}
                            className="px-2.5 py-1 rounded bg-[#294c3e] hover:bg-[#34614f] disabled:opacity-40 text-xs font-bold text-[#f7efe0] cursor-pointer"
                          >
                            Sell 1
                          </button>
                          <button
                            type="button"
                            disabled={held < 5 || settlement.gold < sellPrice * 5}
                            onClick={() => setFeedback(onTrade(settlement.id, 'sell', item.id, 5).message)}
                            className="px-2.5 py-1 rounded bg-[#294c3e] hover:bg-[#34614f] disabled:opacity-40 text-xs font-bold text-[#f7efe0] cursor-pointer"
                          >
                            Sell 5
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {tab === 'fishing' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {FISHING_GEAR_ORDER.filter((g) => g !== 'none').map((gId) => {
                const spec = FISHING_GEAR_SPECS[gId];
                const equipped = p.upgrades.fishingGear === gId;
                const tierOk = p.upgrades.hullTier >= spec.minHullTier;
                const affordable = p.gold >= spec.cost;
                return (
                  <div
                    key={gId}
                    className={`p-4 rounded bg-[#101a24] border flex flex-col justify-between gap-3 ${
                      equipped ? 'border-[#4e9f76]' : 'border-[#c99d4e]/25'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <h3 className="text-base font-bold text-[#f7efe0]">{spec.name}</h3>
                        <span className="font-mono-num text-sm font-bold text-[#efc570]">{spec.cost}g</span>
                      </div>
                      <p className="text-xs text-[#b7aa92]">{spec.description}</p>
                      <div className="text-xs font-mono-num text-[#9ec4d1]">
                        Cycle {spec.catchIntervalSec}s · Haul +{spec.haulBonus} · Hull Tier {spec.minHullTier}+
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={equipped || !tierOk || !affordable}
                      onClick={() => setFeedback(onBuyFishingGear(gId).message)}
                      className={`w-full py-2 text-xs font-bold rounded ${
                        equipped
                          ? 'bg-[#1d332a] text-[#83cca5]'
                          : tierOk && affordable
                            ? 'bg-[#c99d4e] hover:bg-[#dfb261] text-[#14100b] cursor-pointer'
                            : 'bg-[#1a2530] text-[#837b6d] cursor-not-allowed'
                      }`}
                    >
                      {equipped
                        ? 'Mounted on Flagship'
                        : !tierOk
                          ? `Requires Hull Tier ${spec.minHullTier}`
                          : `Rig Fishing Gear (${spec.cost}g)`}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'tavern' && (
            <div className="space-y-5">
              <div className="p-4 rounded bg-[#101a24] border border-[#c99d4e]/35 flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1 max-w-xl">
                  <div className="text-sm font-bold text-[#efc570] flex items-center gap-1.5">
                    <Compass className="w-4 h-4" />
                    <span>Harbor Tavern Rumors &amp; Chart Fragments</span>
                  </div>
                  <p className="text-xs text-[#cfc3ae]">
                    {settlement.rumorHeard
                      ? settlement.rumorText
                      : 'Buy a round for local mariners to hear chart rumors and claim a Treasure Map Fragment.'}
                  </p>
                </div>
                <button
                  type="button"
                  data-testid="settlement-rumor-btn"
                  disabled={settlement.rumorHeard || p.gold < settlement.rumorCost}
                  onClick={() => setFeedback(onHearRumor(settlement.id).message)}
                  className="px-4 py-2 bg-[#c99d4e] hover:bg-[#dfb261] disabled:bg-[#1a2530] disabled:text-[#837b6d] text-[#14100b] text-xs font-bold rounded cursor-pointer whitespace-nowrap"
                >
                  {settlement.rumorHeard
                    ? 'Rumor Recorded'
                    : `Hear Rumor (${settlement.rumorCost}g)`}
                </button>
              </div>

              <div className="space-y-2.5">
                <h3 className="font-display text-sm uppercase tracking-wider text-[#d8ae5e]">
                  Available Sailors Ashore ({settlement.hireableCrew.length})
                </h3>
                {settlement.hireableCrew.length === 0 ? (
                  <div className="p-4 rounded bg-[#101a24] border border-[#c99d4e]/20 text-xs text-[#a89c86]">
                    No sailors seeking berths at this quay right now.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {settlement.hireableCrew.map((c) => (
                      <div
                        key={c.id}
                        className="p-3.5 rounded bg-[#101a24] border border-[#c99d4e]/25 flex items-center justify-between gap-3"
                      >
                        <div>
                          <div className="text-sm font-bold text-[#f7efe0]">{c.name}</div>
                          <div className="text-xs text-[#9ec4d1]">
                            {c.origin} · Preferred Role: {c.role}
                          </div>
                          <div className="text-[11px] font-mono-num text-[#b7aa92] mt-0.5">
                            Sail {c.skills.sailing} · Gun {c.skills.combat} · Fish {c.skills.fishing ?? 3}
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={p.gold < 48}
                          onClick={() => setFeedback(onHireCrew(settlement.id, c.id).message)}
                          className="px-3.5 py-2 bg-[#c99d4e] hover:bg-[#dfb261] disabled:bg-[#1a2530] disabled:text-[#837b6d] text-[#14100b] text-xs font-bold rounded cursor-pointer shrink-0"
                        >
                          Sign On (48g)
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'errand' && (
            <div>
              {!settlement.errand ? (
                <div className="p-5 rounded bg-[#101a24] border border-[#c99d4e]/25 text-sm text-[#cbbda4]">
                  No active harbor errands posted at {settlement.name}.
                </div>
              ) : (
                <div className="p-5 rounded bg-[#101a24] border border-[#c99d4e]/35 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-display text-lg font-bold text-[#f7efe0]">
                        {settlement.errand.title}
                      </h3>
                      <p className="text-xs text-[#cfc3ae] mt-1">{settlement.errand.description}</p>
                    </div>
                    <span className="font-mono-num text-sm font-bold text-[#efc570]">
                      +{settlement.errand.rewardGold}g · +{settlement.errand.rewardReputation} Rep
                    </span>
                  </div>
                  <div className="text-xs font-mono-num text-[#9ec4d1]">
                    Required:{' '}
                    {Math.floor(p.inventory[settlement.errand.resourceId] || 0)} / {settlement.errand.requiredQty}{' '}
                    {RESOURCE_DEFS[settlement.errand.resourceId]?.name || settlement.errand.resourceId}
                  </div>
                  <button
                    type="button"
                    data-testid="settlement-errand-btn"
                    disabled={
                      settlement.errand.completed ||
                      (p.inventory[settlement.errand.resourceId] || 0) < settlement.errand.requiredQty
                    }
                    onClick={() => setFeedback(onCompleteErrand(settlement.id).message)}
                    className="px-5 py-2 bg-[#c99d4e] hover:bg-[#dfb261] disabled:bg-[#1a2530] disabled:text-[#837b6d] text-[#14100b] text-sm font-bold rounded cursor-pointer"
                  >
                    {settlement.errand.completed ? 'Contract Fulfilled' : 'Deliver Cargo & Collect Pay'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
