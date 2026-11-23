import React, { useState } from 'react';
import { X } from 'lucide-react';
import {
  FlagDyeId,
  FlagEmblemId,
  MerchantShipData,
  ResourceDef,
  ResourceId,
  SaveData,
} from '../game/types';
import {
  FLAG_DYES,
  FLAG_EMBLEMS,
  getCargoCapacity,
  getCargoWeight,
  getMaxCrewCapacity,
  getMerchantBuyPrice,
  getMerchantSellPrice,
  isItemAllowedForMerchant,
  RESOURCE_DEFS,
  RESOURCE_LIST,
  VESSEL_CLASS_LABELS,
} from '../game/economy';
import { getMerchantReputationBehavior } from '../game/factions';

interface TradeModalProps {
  merchant: MerchantShipData;
  save: SaveData;
  onClose: () => void;
  onTrade: (
    merchantId: string,
    mode: 'buy' | 'sell',
    resourceId: ResourceId,
    quantity: number
  ) => { ok: boolean; message: string };
  onHireCrew: (merchantId: string, crewId: string) => { ok: boolean; message: string };
  onBuyFlagCosmetic: (
    kind: 'dye' | 'emblem',
    id: string,
    price: number
  ) => { ok: boolean; message: string };
}

function priceTrendLabel(price: number, basePrice: number, mode: 'buy' | 'sell'): { text: string; tone: string } {
  const ratio = price / Math.max(1, basePrice);
  if (mode === 'buy') {
    if (ratio <= 0.88) return { text: 'Bargain', tone: 'text-[#7ac59b]' };
    if (ratio >= 1.15) return { text: 'Steep', tone: 'text-[#e38679]' };
    return { text: 'Standard', tone: 'text-[#9b8f7a]' };
  }
  if (ratio >= 0.85) return { text: 'High Offer', tone: 'text-[#7ac59b]' };
  if (ratio <= 0.56) return { text: 'Low Offer', tone: 'text-[#e38679]' };
  return { text: 'Fair Offer', tone: 'text-[#9b8f7a]' };
}

export const TradeModal: React.FC<TradeModalProps> = ({
  merchant,
  save,
  onClose,
  onTrade,
  onHireCrew,
  onBuyFlagCosmetic,
}) => {
  const [selected, setSelected] = useState<{ mode: 'buy' | 'sell'; id: ResourceId } | null>(null);
  const [qty, setQty] = useState(1);
  const [feedback, setFeedback] = useState<string | null>(null);

  const p = save.player;
  const cargoUsed = getCargoWeight(p.inventory);
  const cargoCap = getCargoCapacity(p.upgrades);
  const maxCrew = getMaxCrewCapacity(p.upgrades);
  const policy = getMerchantReputationBehavior(save.reputation, merchant.isCrown, merchant);

  const buyList = RESOURCE_LIST.filter(
    (r) => (merchant.stock[r.id] || 0) > 0 && isItemAllowedForMerchant(merchant, r.id)
  );
  const sellList = RESOURCE_LIST.filter(
    (r) => Math.floor(p.inventory[r.id] || 0) > 0 && isItemAllowedForMerchant(merchant, r.id)
  );

  const buyValuables = buyList.filter((r) => r.isValuableCargo);
  const buySupplies = buyList.filter((r) => !r.isValuableCargo);
  const sellValuables = sellList.filter((r) => r.isValuableCargo);
  const sellSupplies = sellList.filter((r) => !r.isValuableCargo);

  const unitPrice = selected
    ? selected.mode === 'buy'
      ? getMerchantBuyPrice(merchant, selected.id, save.reputation)
      : getMerchantSellPrice(merchant, selected.id, save.reputation)
    : 0;
  const totalPrice = unitPrice * qty;
  const goldAfter = selected
    ? selected.mode === 'buy'
      ? Math.round(p.gold - totalPrice)
      : Math.round(p.gold + totalPrice)
    : Math.round(p.gold);

  const handleConfirm = () => {
    if (!selected) return;
    const res = onTrade(merchant.id, selected.mode, selected.id, qty);
    setFeedback(res.message);
    if (res.ok) setQty(1);
  };

  const renderBuyRow = (r: ResourceDef) => {
    const stock = merchant.stock[r.id] || 0;
    const price = getMerchantBuyPrice(merchant, r.id, save.reputation);
    const trend = priceTrendLabel(price, r.basePrice, 'buy');
    const isSel = selected?.mode === 'buy' && selected.id === r.id;
    return (
      <button
        key={r.id}
        type="button"
        disabled={!policy.willTrade}
        onClick={() => {
          setSelected({ mode: 'buy', id: r.id });
          setQty(1);
          setFeedback(null);
        }}
        className={`w-full px-4 py-2.5 text-left flex items-center justify-between gap-2 transition-colors ${
          !policy.willTrade
            ? 'opacity-50 cursor-not-allowed'
            : isSel
              ? 'bg-[#223242] cursor-pointer'
              : 'hover:bg-[#172330] cursor-pointer'
        }`}
      >
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-[#f7efe0]">{r.name}</span>
            {r.isValuableCargo && (
              <span className="px-1.5 py-0.5 rounded bg-[#2e2414] text-[#efc570] text-[10px] font-bold uppercase">
                Valuable
              </span>
            )}
          </div>
          <div className="text-xs text-[#9b8f7a]">
            Stock <span className="font-mono-num text-[#d6cbb6]">{stock}</span> · {r.weight}t ·{' '}
            <span className={trend.tone}>{trend.text}</span>
          </div>
        </div>
        <div className="font-mono-num text-sm font-bold text-[#efc570]">{price}g / ea</div>
      </button>
    );
  };

  const renderSellRow = (r: ResourceDef) => {
    const have = Math.floor(p.inventory[r.id] || 0);
    const sellPrice = getMerchantSellPrice(merchant, r.id, save.reputation);
    const trend = priceTrendLabel(sellPrice, r.basePrice, 'sell');
    const isSel = selected?.mode === 'sell' && selected.id === r.id;
    return (
      <button
        key={r.id}
        type="button"
        disabled={!policy.willTrade}
        onClick={() => {
          setSelected({ mode: 'sell', id: r.id });
          setQty(1);
          setFeedback(null);
        }}
        className={`w-full px-4 py-2.5 text-left flex items-center justify-between gap-2 transition-colors ${
          !policy.willTrade
            ? 'opacity-50 cursor-not-allowed'
            : isSel
              ? 'bg-[#223242] cursor-pointer'
              : 'hover:bg-[#172330] cursor-pointer'
        }`}
      >
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-[#f7efe0]">{r.name}</span>
            {r.isValuableCargo && (
              <span className="px-1.5 py-0.5 rounded bg-[#2e2414] text-[#efc570] text-[10px] font-bold uppercase">
                Valuable
              </span>
            )}
          </div>
          <div className="text-xs text-[#9b8f7a]">
            Owned <span className="font-mono-num text-[#d6cbb6]">{have}</span> ·{' '}
            <span className={trend.tone}>{trend.text}</span>
          </div>
        </div>
        <div className="font-mono-num text-sm font-bold text-[#7ac59b]">+{sellPrice}g / ea</div>
      </button>
    );
  };

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/72 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Trade with ${merchant.name}`}
    >
      <div className="nautical-panel rounded-lg w-full max-w-[min(1080px,96vw)] max-h-[89vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#c99d4e]/30 flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-bold text-[#f7efe0]">{merchant.name}</h2>
            <p className="text-sm text-[#c4b79e] capitalize mt-0.5">
              {merchant.classLabel || VESSEL_CLASS_LABELS[merchant.vesselClass] || merchant.vesselClass.replace(/_/g, ' ')} · Capt. {merchant.captainName} · Merchant Gold Budget{' '}
              <span className="font-mono-num text-[#efc570] font-bold">{merchant.gold}g</span>
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right text-sm">
              <div className="text-[#c4b79e]">
                Your Gold <strong className="font-mono-num text-[#efc570] text-base">{Math.round(p.gold)}g</strong>
              </div>
              <div className="text-[#9ec4d1] font-mono-num text-xs">
                Hold {cargoUsed.toFixed(1)} / {cargoCap}t
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Trading Menu"
              className="p-2 text-[#cbbda4] hover:text-white hover:bg-[#1e2c3a] rounded cursor-pointer"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Fishing Trawler & Reputation Notices */}
        {merchant.isFishingTrawler && (
          <div
            data-testid="fishing-trawler-notice"
            className="mx-6 mt-3 px-4 py-2.5 rounded bg-[#142733] border border-[#5ba3b8]/45 text-sm text-[#c9ecf7] font-medium"
          >
            Fishing Vessel Provisioning: Fishing boats and trawlers strictly trade only Provisions (Food) and Fresh Water.
          </div>
        )}

        {!policy.willTrade && (
          <div className="mx-6 mt-3 px-4 py-2.5 rounded bg-[#3d1919] border border-[#e05a4d]/60 text-sm text-[#ffd6d2] font-semibold">
            {policy.refusalReason || 'Captain refuses to trade due to your reputation.'}
          </div>
        )}

        {policy.willTrade && policy.priceMultiplier !== 1 && (
          <div className="mx-6 mt-3 px-4 py-2 rounded bg-[#14212e] border border-[#c99d4e]/35 text-xs text-[#dcd0ba]">
            Reputation Trade Modifier:{' '}
            <strong className="text-[#efc570] font-mono-num">
              {Math.round(policy.priceMultiplier * 100)}% market rate
            </strong>
          </div>
        )}

        {feedback && (
          <div className="mx-6 mt-3 px-4 py-2.5 rounded bg-[#182836] border border-[#c99d4e]/45 text-sm text-[#f4ead5]">
            {feedback}
          </div>
        )}

        {/* Two-Column Inventory Grid */}
        <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-y-auto nautical-scroll flex-1">
          {/* Merchant Stock */}
          <div className="space-y-4">
            <h3 className="font-display text-base uppercase tracking-wider text-[#d8ae5e]">
              Vessel Stock (Buy)
            </h3>
            {buyList.length === 0 ? (
              <div className="p-4 border border-[#c99d4e]/25 rounded bg-[#101922] text-sm text-[#9b8f7a]">
                No available stores for sale.
              </div>
            ) : (
              <>
                {buyValuables.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-xs uppercase tracking-wider font-bold text-[#efc570]">
                      Valuable Trade Goods
                    </div>
                    <div className="divide-y divide-[#c99d4e]/15 border border-[#c99d4e]/35 rounded bg-[#121c27]">
                      {buyValuables.map(renderBuyRow)}
                    </div>
                  </div>
                )}
                {buySupplies.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-xs uppercase tracking-wider font-bold text-[#9ec4d1]">
                      Supplies &amp; Ship Materials
                    </div>
                    <div className="divide-y divide-[#c99d4e]/15 border border-[#c99d4e]/25 rounded bg-[#101922]">
                      {buySupplies.map(renderBuyRow)}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Player Hold (Sell) + Crew + Rare Flag Dyes */}
          <div className="space-y-5">
            <div className="space-y-4">
              <h3 className="font-display text-base uppercase tracking-wider text-[#d8ae5e]">
                Your Cargo Hold (Sell)
              </h3>
              {sellList.length === 0 ? (
                <div className="p-4 border border-[#c99d4e]/25 rounded bg-[#101922] text-sm text-[#9b8f7a]">
                  {merchant.isFishingTrawler
                    ? 'Fishing trawlers only purchase Provisions or Fresh Water.'
                    : 'No eligible goods in your cargo hold.'}
                </div>
              ) : (
                <>
                  {sellValuables.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-xs uppercase tracking-wider font-bold text-[#efc570]">
                        Valuable Cargo to Sell
                      </div>
                      <div className="divide-y divide-[#c99d4e]/15 border border-[#c99d4e]/35 rounded bg-[#121c27]">
                        {sellValuables.map(renderSellRow)}
                      </div>
                    </div>
                  )}
                  {sellSupplies.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-xs uppercase tracking-wider font-bold text-[#9ec4d1]">
                        Supplies &amp; Materials to Sell
                      </div>
                      <div className="divide-y divide-[#c99d4e]/15 border border-[#c99d4e]/25 rounded bg-[#101922]">
                        {sellSupplies.map(renderSellRow)}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Sailors for Hire */}
            {merchant.hireableCrew.length > 0 && policy.willTrade && (
              <div className="p-4 rounded bg-[#101922] border border-[#c99d4e]/25 space-y-2.5">
                <div className="text-sm font-bold text-[#f7efe0]">
                  Sailors Looking for Berth (45g · Crew {p.crew.length}/{maxCrew})
                </div>
                {merchant.hireableCrew.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-2 text-xs">
                    <div>
                      <span className="text-[#f4ead5] font-semibold">{c.name}</span>
                      <span className="text-[#9b8f7a] ml-2">
                        {c.origin} · Sail {c.skills.sailing} / Gun {c.skills.combat} / Rep {c.skills.repair}
                      </span>
                    </div>
                    <button
                      type="button"
                      disabled={p.gold < 45 || p.crew.length >= maxCrew}
                      onClick={() => setFeedback(onHireCrew(merchant.id, c.id).message)}
                      className="px-3 py-1.5 bg-[#2a5c4a] hover:bg-[#34725c] disabled:bg-[#1b2530] disabled:text-[#757c82] text-white text-xs font-bold rounded cursor-pointer whitespace-nowrap"
                    >
                      Hire (45g)
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Rare Dyes & Emblems */}
            {(merchant.unlockedDyesForSale.length > 0 || merchant.unlockedEmblemsForSale.length > 0) &&
              policy.willTrade && (
                <div className="p-4 rounded bg-[#101922] border border-[#c99d4e]/25 space-y-2.5">
                  <div className="text-sm font-bold text-[#efc570]">
                    Rare Flag Dyes &amp; Emblems
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {merchant.unlockedDyesForSale.map((dId: FlagDyeId) => {
                      const dye = FLAG_DYES[dId];
                      const owned = save.unlockedDyes.includes(dId);
                      return (
                        <button
                          key={dId}
                          type="button"
                          disabled={owned || p.gold < dye.price}
                          onClick={() => setFeedback(onBuyFlagCosmetic('dye', dId, dye.price).message)}
                          className="px-3 py-1.5 rounded bg-[#192634] hover:bg-[#233447] disabled:opacity-50 text-xs font-semibold text-[#f4ead5] flex items-center gap-1.5 cursor-pointer"
                        >
                          <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: dye.hex }} />
                          {dye.name} {owned ? '(Owned)' : `(${dye.price}g)`}
                        </button>
                      );
                    })}
                    {merchant.unlockedEmblemsForSale.map((eId: FlagEmblemId) => {
                      const em = FLAG_EMBLEMS[eId];
                      const owned = save.unlockedEmblems.includes(eId);
                      return (
                        <button
                          key={eId}
                          type="button"
                          disabled={owned || p.gold < em.price}
                          onClick={() => setFeedback(onBuyFlagCosmetic('emblem', eId, em.price).message)}
                          className="px-3 py-1.5 rounded bg-[#192634] hover:bg-[#233447] disabled:opacity-50 text-xs font-semibold text-[#f4ead5] cursor-pointer"
                        >
                          {em.name} {owned ? '(Owned)' : `(${em.price}g)`}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
          </div>
        </div>

        {/* Transaction Confirmation Bar */}
        <div className="px-6 py-4 border-t border-[#c99d4e]/25 bg-[#0d151e] flex flex-wrap items-center justify-between gap-4">
          {selected && policy.willTrade ? (
            <>
              <div className="text-sm text-[#d6cbb6]">
                <span className="uppercase tracking-wider text-[#d8ae5e] font-bold mr-2">
                  {selected.mode === 'buy' ? 'Buying' : 'Selling'}
                </span>
                <strong className="text-[#f7efe0]">{RESOURCE_DEFS[selected.id].name}</strong> · Total{' '}
                <strong className="font-mono-num text-[#efc570]">{totalPrice}g</strong> · Balance After{' '}
                <strong className="font-mono-num text-[#f7efe0]">{goldAfter}g</strong>
                {selected.mode === 'sell' && totalPrice > merchant.gold && (
                  <span className="ml-2 text-xs text-[#f19488] font-semibold">
                    (Exceeds merchant gold budget of {merchant.gold}g)
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {[1, 5, 10].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setQty(n)}
                    className={`px-2.5 py-1.5 text-xs font-bold rounded cursor-pointer ${
                      qty === n ? 'bg-[#c99d4e] text-[#14100b]' : 'bg-[#1a2736] text-[#d6cbb6]'
                    }`}
                  >
                    x{n}
                  </button>
                ))}
                <input
                  type="number"
                  aria-label="Trade quantity"
                  min={1}
                  max={
                    selected.mode === 'buy'
                      ? Math.max(1, merchant.stock[selected.id] || 1)
                      : Math.max(1, Math.floor(p.inventory[selected.id] || 1))
                  }
                  value={qty}
                  onChange={(e) => setQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-16 bg-[#182430] border border-[#c99d4e]/35 rounded px-2 py-1.5 font-mono-num text-sm text-[#f7efe0]"
                />
                <button
                  type="button"
                  onClick={handleConfirm}
                  className="px-5 py-2 bg-[#c99d4e] hover:bg-[#dfb261] text-[#14100b] text-sm font-bold rounded cursor-pointer transition-colors whitespace-nowrap"
                >
                  Confirm {selected.mode === 'buy' ? 'Purchase' : 'Sale'}
                </button>
              </div>
            </>
          ) : (
            <div className="text-sm text-[#9b8f7a]">
              {policy.willTrade
                ? 'Select any resource from the vessel or your hold to trade.'
                : 'Trading is blocked with this vessel.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
