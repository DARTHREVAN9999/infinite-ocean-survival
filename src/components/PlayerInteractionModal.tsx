import React, { useMemo, useState } from 'react';
import { Handshake, Swords, X } from 'lucide-react';
import { Inventory, ResourceId } from '../game/types';
import { RESOURCE_DEFS } from '../game/economy';
import type { PlayerTradeOffer, IncomingTradeOffer } from '../engine/oceanScene';

interface PlayerInteractionModalProps {
  target: { id: string; name: string; reputation: number; distance: number } | null;
  gold: number;
  inventory: Inventory;
  onClose: () => void;
  onProposeTrade: (offer: PlayerTradeOffer) => { ok: boolean; message: string };
  onAttack: () => { ok: boolean; message: string };
}

const resourceOptions = (Object.keys(RESOURCE_DEFS) as ResourceId[]).sort((a, b) =>
  RESOURCE_DEFS[a].name.localeCompare(RESOURCE_DEFS[b].name)
);

function describeSide(gold: number, res: ResourceId | null, qty: number): string {
  const parts: string[] = [];
  if (gold > 0) parts.push(`${gold} gold`);
  if (res && qty > 0) parts.push(`${qty} ${RESOURCE_DEFS[res]?.name ?? res}`);
  return parts.length > 0 ? parts.join(' + ') : 'nothing';
}

const inputClass =
  'bg-[#142230] border border-[#c99d4e]/40 rounded px-2 py-1.5 text-sm font-semibold text-[#f7efe0] focus:outline-none focus:border-[#efc570]';

/** E near another player's ship: choose to offer a trade or attack. */
export const PlayerInteractionModal: React.FC<PlayerInteractionModalProps> = ({
  target,
  gold,
  inventory,
  onClose,
  onProposeTrade,
  onAttack,
}) => {
  const [view, setView] = useState<'menu' | 'trade'>('menu');
  const [message, setMessage] = useState<string | null>(null);
  const [giveGold, setGiveGold] = useState(0);
  const [giveRes, setGiveRes] = useState<ResourceId | ''>('');
  const [giveQty, setGiveQty] = useState(0);
  const [askGold, setAskGold] = useState(0);
  const [askRes, setAskRes] = useState<ResourceId | ''>('');
  const [askQty, setAskQty] = useState(0);

  const owned = useMemo(
    () => resourceOptions.filter((id) => (inventory[id] || 0) > 0),
    [inventory]
  );

  if (!target) {
    return (
      <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/75 p-4" role="dialog" aria-modal="true">
        <div className="nautical-panel rounded-lg w-full max-w-md p-6 space-y-4 text-center">
          <p className="text-[#dfd4be]">That ship has sailed out of hailing range.</p>
          <button type="button" onClick={onClose} className="px-4 py-2 bg-[#1c2a38] hover:bg-[#273a4d] text-[#f7efe0] text-sm font-semibold rounded cursor-pointer">
            Close
          </button>
        </div>
      </div>
    );
  }

  const repText = `${target.reputation > 0 ? '+' : ''}${target.reputation}`;

  const sendOffer = () => {
    const res = onProposeTrade({
      giveGold,
      giveRes: giveRes || null,
      giveQty: giveRes ? giveQty : 0,
      askGold,
      askRes: askRes || null,
      askQty: askRes ? askQty : 0,
    });
    if (res.ok) {
      onClose();
    } else {
      setMessage(res.message);
    }
  };

  return (
    <div
      data-testid="player-interaction-modal"
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Hail another captain"
    >
      <div className="nautical-panel rounded-lg w-full max-w-lg p-6 space-y-5">
        <div className="flex items-start justify-between gap-4 border-b border-[#c99d4e]/25 pb-3">
          <div>
            <h2 className="font-display text-2xl font-bold text-[#f7efe0]">{target.name}</h2>
            <p className="text-xs text-[#9ec4d1] mt-0.5">
              Another captain · Reputation <strong className="text-[#efc570]">{repText}</strong> · {target.distance}m away
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-2 text-[#cbbda4] hover:text-white hover:bg-[#1e2c3a] rounded cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {view === 'menu' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              data-testid="player-offer-trade"
              onClick={() => { setView('trade'); setMessage(null); }}
              className="p-4 rounded bg-[#132920] hover:bg-[#19382b] border border-[#4e9f76]/60 text-left cursor-pointer"
            >
              <div className="flex items-center gap-2 text-[#bbf7d0] font-bold"><Handshake className="w-5 h-5" /> Offer Trade</div>
              <p className="text-xs text-[#cfe9db] mt-1.5">They must accept your offer before anything changes hands.</p>
            </button>
            <button
              type="button"
              data-testid="player-attack"
              onClick={() => {
                const res = onAttack();
                if (res.ok) onClose();
                else setMessage(res.message);
              }}
              className="p-4 rounded bg-[#361a1a] hover:bg-[#4a2121] border border-[#e05a4d]/60 text-left cursor-pointer"
            >
              <div className="flex items-center gap-2 text-[#ffd5d0] font-bold"><Swords className="w-5 h-5" /> Attack</div>
              <p className="text-xs text-[#f3c7c2] mt-1.5">Naval combat, just like fighting a pirate — except another captain steers the other ship.</p>
            </button>
          </div>
        )}

        {view === 'trade' && (
          <div className="space-y-4 text-sm text-[#dfd4be]">
            <div className="space-y-2">
              <div className="text-[#efc570] font-bold">You give</div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-1.5">Gold
                  <input type="number" min={0} max={gold} value={giveGold} onChange={(e) => setGiveGold(Math.max(0, Math.floor(Number(e.target.value) || 0)))} className={`${inputClass} w-24`} />
                </label>
                <select value={giveRes} onChange={(e) => setGiveRes(e.target.value as ResourceId | '')} className={inputClass} aria-label="Resource you give">
                  <option value="">No cargo</option>
                  {owned.map((id) => (
                    <option key={id} value={id}>{RESOURCE_DEFS[id].name} (have {inventory[id]})</option>
                  ))}
                </select>
                {giveRes && (
                  <input type="number" min={1} max={inventory[giveRes] || 0} value={giveQty} onChange={(e) => setGiveQty(Math.max(0, Math.floor(Number(e.target.value) || 0)))} className={`${inputClass} w-20`} aria-label="Quantity you give" />
                )}
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-[#efc570] font-bold">You ask for</div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-1.5">Gold
                  <input type="number" min={0} value={askGold} onChange={(e) => setAskGold(Math.max(0, Math.floor(Number(e.target.value) || 0)))} className={`${inputClass} w-24`} />
                </label>
                <select value={askRes} onChange={(e) => setAskRes(e.target.value as ResourceId | '')} className={inputClass} aria-label="Resource you ask for">
                  <option value="">No cargo</option>
                  {resourceOptions.map((id) => (
                    <option key={id} value={id}>{RESOURCE_DEFS[id].name}</option>
                  ))}
                </select>
                {askRes && (
                  <input type="number" min={1} value={askQty} onChange={(e) => setAskQty(Math.max(0, Math.floor(Number(e.target.value) || 0)))} className={`${inputClass} w-20`} aria-label="Quantity you ask for" />
                )}
              </div>
            </div>
            <p className="text-xs text-[#9ec4d1]">
              Offer: you give <strong>{describeSide(giveGold, giveRes || null, giveQty)}</strong> for{' '}
              <strong>{describeSide(askGold, askRes || null, askQty)}</strong>.
            </p>
            <div className="flex items-center gap-3">
              <button type="button" data-testid="player-send-offer" onClick={sendOffer} className="px-5 py-2 bg-[#c99d4e] hover:bg-[#dfb261] text-[#14100b] text-sm font-bold rounded cursor-pointer">
                Send Offer
              </button>
              <button type="button" onClick={() => { setView('menu'); setMessage(null); }} className="px-4 py-2 bg-[#1c2a38] hover:bg-[#273a4d] text-[#f7efe0] text-sm font-semibold rounded cursor-pointer">
                Back
              </button>
            </div>
          </div>
        )}

        {message && (
          <div className="p-3 rounded border text-sm font-semibold bg-[#361a1a] border-[#e05a4d]/60 text-[#ffd5d0]">{message}</div>
        )}
      </div>
    </div>
  );
};

interface IncomingTradeModalProps {
  incoming: IncomingTradeOffer;
  onRespond: (accept: boolean) => { ok: boolean; message: string };
  onClose: () => void;
}

/** Shown to the other captain: they must accept for the trade to actually happen. */
export const IncomingTradeModal: React.FC<IncomingTradeModalProps> = ({ incoming, onRespond, onClose }) => {
  const [error, setError] = useState<string | null>(null);
  const o = incoming.offer;
  return (
    <div
      data-testid="incoming-trade-modal"
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Trade offer"
    >
      <div className="nautical-panel rounded-lg w-full max-w-md p-6 space-y-4">
        <h2 className="font-display text-xl font-bold text-[#f7efe0] flex items-center gap-2">
          <Handshake className="w-5 h-5 text-[#efc570]" /> Trade offer from {incoming.fromName}
        </h2>
        <div className="text-sm text-[#dfd4be] space-y-1.5">
          <p>They give you: <strong className="text-[#bbf7d0]">{describeSide(o.giveGold, o.giveRes, o.giveQty)}</strong></p>
          <p>They want from you: <strong className="text-[#ffd5d0]">{describeSide(o.askGold, o.askRes, o.askQty)}</strong></p>
        </div>
        {error && <div className="p-2.5 rounded border text-sm bg-[#361a1a] border-[#e05a4d]/60 text-[#ffd5d0]">{error}</div>}
        <div className="flex items-center gap-3">
          <button
            type="button"
            data-testid="trade-accept"
            onClick={() => {
              const res = onRespond(true);
              if (res.ok) onClose();
              else setError(res.message);
            }}
            className="px-5 py-2 bg-[#3d8b68] hover:bg-[#49a37b] text-white text-sm font-bold rounded cursor-pointer"
          >
            Accept
          </button>
          <button
            type="button"
            data-testid="trade-decline"
            onClick={() => { onRespond(false); onClose(); }}
            className="px-5 py-2 bg-[#1c2a38] hover:bg-[#273a4d] text-[#f7efe0] text-sm font-semibold rounded cursor-pointer"
          >
            Decline
          </button>
        </div>
      </div>
    </div>
  );
};
