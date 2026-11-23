import React, { useState } from 'react';
import { Coins, Crown, Fish, Shield, Skull, Swords, X } from 'lucide-react';
import {
  Inventory,
  MerchantShipData,
  PirateShipData,
  ResourceId,
  SaveData,
  SeaMonsterData,
} from '../game/types';
import { getCargoCapacity, getCargoWeight, RESOURCE_LIST } from '../game/economy';
import {
  canTradeWithPirate,
  isPirateAlliedWithPlayer,
  PIRATE_FACTIONS,
} from '../game/factions';
import { SEA_MONSTER_SPECS } from '../game/monsters';

interface InnocentVesselModalProps {
  merchant: MerchantShipData;
  save: SaveData;
  onClose: () => void;
  onOpenTrade: () => void;
  onAction: (action: 'demand') => {
    ok: boolean;
    message: string;
    triggeredCombat?: boolean;
  };
  onAttemptRobbery: () => { outcome: 'surrender' | 'fight'; message: string };
  onCommitRobbery: (gold: number, items: Partial<Inventory>) => { ok: boolean; message: string };
  onAttack: () => void;
}

export const InnocentVesselModal: React.FC<InnocentVesselModalProps> = ({
  merchant,
  save,
  onClose,
  onOpenTrade,
  onAction,
  onAttemptRobbery,
  onCommitRobbery,
  onAttack,
}) => {
  const [feedback, setFeedback] = useState<string | null>(null);
  const [robbing, setRobbing] = useState(false);
  const [stealGold, setStealGold] = useState(Math.round(merchant.gold * 0.5));
  const [stealCargo, setStealCargo] = useState<Partial<Inventory>>({});

  const cargoUsed = getCargoWeight(save.player.inventory);
  const cargoCap = getCargoCapacity(save.player.upgrades);

  const handleRobClick = () => {
    const res = onAttemptRobbery();
    if (res.outcome === 'surrender') {
      setRobbing(true);
      setStealGold(merchant.gold);
      setFeedback(res.message);
    } else {
      onClose();
    }
  };

  const handleConfirmSteal = () => {
    const res = onCommitRobbery(stealGold, stealCargo);
    setFeedback(res.message);
    setRobbing(false);
  };

  const shipResources = RESOURCE_LIST.filter((r) => (merchant.stock[r.id] || 0) > 0);

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/72 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Hail ${merchant.name}`}
    >
      <div className="nautical-panel rounded-lg w-full max-w-2xl max-h-[88vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-[#c99d4e]/30 flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              {merchant.isCrown && <Crown className="w-5 h-5 text-[#efc570]" />}
              <h2 className="font-display text-2xl font-bold text-[#f7efe0]">{merchant.name}</h2>
            </div>
            <p className="text-sm text-[#c4b79e] capitalize mt-0.5">
              {merchant.classLabel || merchant.vesselClass.replace(/_/g, ' ')} · Capt. {merchant.captainName} ·{' '}
              {merchant.crewCount} Crew · {merchant.cannons} Cannons
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Vessel Encounter"
            className="p-2 text-[#cbbda4] hover:text-white hover:bg-[#1e2c3a] rounded cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto nautical-scroll space-y-4">
          {merchant.isFishingTrawler && (
            <div className="p-3 rounded bg-[#142733] border border-[#5ba3b8]/45 text-xs text-[#c9ecf7]">
              Fishing Vessel: Only stocks &amp; trades Provisions (Food) and Fresh Water.
            </div>
          )}

          {feedback && (
            <div className="p-3.5 rounded bg-[#182836] border border-[#c99d4e]/45 text-sm text-[#f4ead5]">
              {feedback}
            </div>
          )}

          {!robbing ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={onOpenTrade}
                className="sm:col-span-2 p-3.5 rounded bg-[#c99d4e] hover:bg-[#dfb261] text-[#14100b] text-sm font-bold flex items-center justify-center gap-2 cursor-pointer"
              >
                <Coins className="w-4 h-4" />
                <span>Trade Cargo &amp; Crew</span>
              </button>

              <button
                type="button"
                disabled={merchant.robbed}
                onClick={() => {
                  const res = onAction('demand');
                  if (res.triggeredCombat) {
                    onClose();
                  } else {
                    setFeedback(res.message);
                  }
                }}
                className="p-3.5 rounded bg-[#3b261c] hover:bg-[#4e3225] disabled:opacity-45 text-[#fbd6ba] text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer"
              >
                <Shield className="w-4 h-4" />
                <span>Demand Tribute (-12 Rep)</span>
              </button>

              <button
                type="button"
                disabled={merchant.robbed}
                onClick={handleRobClick}
                className="p-3.5 rounded bg-[#4a1e1e] hover:bg-[#612727] disabled:opacity-45 text-[#ffd8d4] text-sm font-bold flex items-center justify-center gap-2 cursor-pointer"
              >
                <Skull className="w-4 h-4" />
                <span>Attempt Robbery (-18 Rep)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onAttack();
                  onClose();
                }}
                className="sm:col-span-2 p-3 rounded bg-[#6b1d1d] hover:bg-[#842424] text-white text-sm font-bold flex items-center justify-center gap-2 cursor-pointer"
              >
                <Swords className="w-4 h-4" />
                <span>Open Broadsides &amp; Sink (-16 Rep)</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4 p-4 rounded bg-[#101922] border border-[#c99d4e]/35">
              <div className="flex items-center justify-between text-sm">
                <span className="font-bold text-[#efc570]">
                  Plunder Hold — Choose Gold &amp; Cargo to Seize
                </span>
                <span className="font-mono-num text-xs text-[#9ec4d1]">
                  Hold {cargoUsed.toFixed(1)}/{cargoCap}t
                </span>
              </div>

              <label className="flex items-center justify-between gap-4 text-sm text-[#e8decb]">
                <span>Seize Strongbox Gold (Max {merchant.gold}g)</span>
                <input
                  type="number"
                  min={0}
                  max={merchant.gold}
                  value={stealGold}
                  onChange={(e) =>
                    setStealGold(Math.max(0, Math.min(merchant.gold, parseInt(e.target.value, 10) || 0)))
                  }
                  className="w-24 bg-[#192533] border border-[#c99d4e]/40 rounded px-2.5 py-1.5 font-mono-num text-sm text-[#efc570]"
                />
              </label>

              <div className="space-y-2 max-h-56 overflow-y-auto nautical-scroll pr-1">
                {shipResources.map((r) => {
                  const avail = merchant.stock[r.id] || 0;
                  const val = stealCargo[r.id] || 0;
                  return (
                    <div key={r.id} className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-[#f4ead5]">
                        {r.name} <span className="text-[#9b8f7a]">(Has {avail})</span>
                      </span>
                      <input
                        type="number"
                        min={0}
                        max={avail}
                        value={val}
                        onChange={(e) =>
                          setStealCargo((prev) => ({
                            ...prev,
                            [r.id]: Math.max(0, Math.min(avail, parseInt(e.target.value, 10) || 0)),
                          }))
                        }
                        className="w-20 bg-[#192533] border border-[#c99d4e]/35 rounded px-2 py-1 font-mono-num text-xs text-[#f7efe0]"
                      />
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setRobbing(false)}
                  className="px-4 py-2 bg-[#1c2a38] text-[#cbbda4] text-sm rounded cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSteal}
                  className="flex-1 py-2 bg-[#a93b33] hover:bg-[#c0473e] text-white text-sm font-bold rounded cursor-pointer"
                >
                  Seize Selected Plunder
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface PirateEncounterModalProps {
  pirate: PirateShipData;
  save: SaveData;
  onClose: () => void;
  onTrade: (mode: 'buy' | 'sell', id: ResourceId, qty: number) => { ok: boolean; message: string };
  onForgeAlliance: () => { ok: boolean; message: string };
  onAttack: () => void;
}

export const PirateEncounterModal: React.FC<PirateEncounterModalProps> = ({
  pirate,
  save,
  onClose,
  onTrade,
  onForgeAlliance,
  onAttack,
}) => {
  const [feedback, setFeedback] = useState<string | null>(null);
  const factionMeta = PIRATE_FACTIONS[pirate.factionId];
  const factionState = save.factions[pirate.factionId];
  const allied = isPirateAlliedWithPlayer(factionState, save.day);
  const canTrade = canTradeWithPirate(factionState, pirate, save.day, save.reputation);

  const pirateLootList = RESOURCE_LIST.filter((r) => (pirate.loot[r.id] || 0) > 0);
  const playerSellList = RESOURCE_LIST.filter((r) => Math.floor(save.player.inventory[r.id] || 0) > 0);

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/72 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Parley with ${pirate.name}`}
    >
      <div className="nautical-panel rounded-lg w-full max-w-3xl max-h-[89vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-[#c99d4e]/30 flex items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-widest text-[#f1887c] font-bold">
              {factionMeta.name} · Rank {pirate.rank} {pirate.rankTitle}
              {pirate.isBoss ? ' · FACTION BOSS FLAGSHIP' : ''}
            </div>
            <h2 className="font-display text-2xl font-bold text-[#f7efe0] mt-0.5">{pirate.name}</h2>
            <p className="text-sm text-[#c4b79e]">
              Capt. {pirate.captainName} · Standing{' '}
              <strong className="font-mono-num text-[#efc570]">
                {factionState.playerStanding > 0 ? `+${factionState.playerStanding}` : factionState.playerStanding}
              </strong>
              {allied ? ` · Allied until Day ${factionState.alliedUntilDay}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Pirate Parley"
            className="p-2 text-[#cbbda4] hover:text-white hover:bg-[#1e2c3a] rounded cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto nautical-scroll space-y-5">
          {feedback && (
            <div className="p-3.5 rounded bg-[#182836] border border-[#c99d4e]/45 text-sm text-[#f4ead5]">
              {feedback}
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            {!allied && (
              <button
                type="button"
                onClick={() => setFeedback(onForgeAlliance().message)}
                className="px-4 py-2.5 bg-[#c99d4e] hover:bg-[#dfb261] text-[#14100b] text-sm font-bold rounded cursor-pointer"
              >
                Forge 4-Day Corsair Pact (160g)
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                onAttack();
                onClose();
              }}
              className="px-5 py-2.5 bg-[#a93b33] hover:bg-[#c0473e] text-white text-sm font-bold rounded cursor-pointer"
            >
              Open Broadsides
            </button>
          </div>

          {canTrade ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded bg-[#101922] border border-[#c99d4e]/25 space-y-2">
                <h3 className="text-sm font-bold text-[#efc570]">Buy Contraband (1x)</h3>
                {pirateLootList.length === 0 ? (
                  <p className="text-xs text-[#9b8f7a]">Pirate hold empty.</p>
                ) : (
                  pirateLootList.map((r) => {
                    const price = Math.max(2, Math.round(r.basePrice * 0.92));
                    return (
                      <div key={r.id} className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-[#f4ead5]">
                          {r.name} ({pirate.loot[r.id]})
                        </span>
                        <button
                          type="button"
                          onClick={() => setFeedback(onTrade('buy', r.id, 1).message)}
                          className="px-2.5 py-1 bg-[#21364a] hover:bg-[#2c4760] text-[#efc570] font-bold rounded cursor-pointer"
                        >
                          Buy {price}g
                        </button>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="p-4 rounded bg-[#101922] border border-[#c99d4e]/25 space-y-2">
                <h3 className="text-sm font-bold text-[#7ac59b]">Fence Cargo (1x)</h3>
                {playerSellList.slice(0, 8).map((r) => {
                  const price = Math.max(2, Math.round(r.basePrice * 0.78));
                  return (
                    <div key={r.id} className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-[#f4ead5]">
                        {r.name} ({Math.floor(save.player.inventory[r.id] || 0)})
                      </span>
                      <button
                        type="button"
                        onClick={() => setFeedback(onTrade('sell', r.id, 1).message)}
                        className="px-2.5 py-1 bg-[#1e3d33] hover:bg-[#285244] text-[#9de6bc] font-bold rounded cursor-pointer"
                      >
                        Sell +{price}g
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="p-4 rounded bg-[#2b1a1a] border border-[#c4463c]/45 text-sm text-[#f7cbc6]">
              This crew distrusts you. Lower your Reputation into outlaw standing (&le; -15), raise standing with {factionMeta.shortName}, or pay for a 4-day Corsair Pact to trade contraband.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface SeaMonsterModalProps {
  monster: SeaMonsterData;
  playerFood: number;
  onClose: () => void;
  onFeedToTame: () => { ok: boolean; message: string };
  onAttack: () => void;
}

export const SeaMonsterModal: React.FC<SeaMonsterModalProps> = ({
  monster,
  playerFood,
  onClose,
  onFeedToTame,
  onAttack,
}) => {
  const [feedback, setFeedback] = useState<string | null>(null);
  const spec = SEA_MONSTER_SPECS[monster.species];
  const tamePct = Math.round((monster.tameProgress / Math.max(1, monster.tameRequiredFood)) * 100);
  const canTame = monster.size === 'small' && !monster.provokedByPlayer && !monster.tamed;

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/72 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Sea Creature: ${monster.name}`}
    >
      <div className="nautical-panel rounded-lg w-full max-w-lg p-6 space-y-4">
        <div className="flex items-start justify-between gap-3 border-b border-[#c99d4e]/25 pb-3">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-[#7cd6c0] font-bold">
              <Fish className="w-4 h-4" />
              <span>
                {monster.size} {spec.label} · {monster.alignment} alignment
              </span>
            </div>
            <h2 className="font-display text-2xl font-bold text-[#f7efe0] mt-1">{monster.name}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Sea Creature Encounter"
            className="p-1.5 text-[#cbbda4] hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-[#d6cbb6] leading-relaxed">
          {monster.alignment === 'good'
            ? 'A noble guardian of open waters — only attacks captains stained by severe piracy.'
            : monster.alignment === 'evil'
              ? 'An aggressive predator of the deep that hunts honorable vessels and ships nearby.'
              : 'A curious abyssal creature patrolling these waters.'}{' '}
          {monster.size === 'small'
            ? 'Small enough to be fed Provisions and tamed as a loyal escort!'
            : 'Far too massive to tame.'}
        </p>

        <div className="p-3.5 rounded bg-[#101922] border border-[#c99d4e]/20 space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-[#a89c86]">Vitality</span>
            <span className="font-mono-num font-bold text-[#f7efe0]">
              {Math.round(monster.hp)} / {monster.maxHp}
            </span>
          </div>
          {monster.size === 'small' && (
            <div>
              <div className="flex justify-between text-[#9ec4d1] mb-1">
                <span>Taming Trust</span>
                <span className="font-mono-num font-bold">
                  {monster.tameProgress}/{monster.tameRequiredFood} Provisions ({tamePct}%)
                </span>
              </div>
              <div className="h-2 bg-[#1a2633] rounded overflow-hidden">
                <div className="h-full bg-[#4e9f76]" style={{ width: `${tamePct}%` }} />
              </div>
            </div>
          )}
        </div>

        {feedback && (
          <div className="p-3 rounded bg-[#182836] border border-[#c99d4e]/45 text-sm text-[#f4ead5]">
            {feedback}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2.5">
          {canTame && (
            <button
              type="button"
              disabled={playerFood < 1}
              onClick={() => {
                const res = onFeedToTame();
                setFeedback(res.message);
              }}
              className="flex-1 py-2.5 px-4 bg-[#2c6b53] hover:bg-[#378567] disabled:opacity-45 text-white text-sm font-bold rounded cursor-pointer"
            >
              Feed Provisions ({Math.floor(playerFood)} avail)
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              onAttack();
              onClose();
            }}
            className="flex-1 py-2.5 px-4 bg-[#a93b33] hover:bg-[#c0473e] text-white text-sm font-bold rounded cursor-pointer"
          >
            Engage with Cannons
          </button>
          <button
            type="button"
            onClick={onClose}
            className="py-2.5 px-4 bg-[#1c2a38] hover:bg-[#26384b] text-[#e2d6bf] text-sm font-semibold rounded cursor-pointer"
          >
            Sail Clear
          </button>
        </div>
      </div>
    </div>
  );
};

interface CrownHailModalProps {
  crownShip: MerchantShipData;
  playerGold: number;
  errorMsg: string | null;
  onRespond: (choice: 'surrender' | 'bribe' | 'fight') => void;
}

export const CrownHailModal: React.FC<CrownHailModalProps> = ({
  crownShip,
  playerGold,
  errorMsg,
  onRespond,
}) => {
  const fine = Math.round(playerGold * 0.45);
  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Crown Navy Intercept"
    >
      <div className="nautical-panel rounded-lg w-full max-w-lg p-6 space-y-4">
        <div className="border-b border-[#c99d4e]/25 pb-3">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-[#efc570] font-bold">
            <Crown className="w-4 h-4" />
            <span>Royal Crown Navy Intercept</span>
          </div>
          <h2 className="font-display text-2xl font-bold text-[#f7efe0] mt-1">{crownShip.name}</h2>
          <p className="text-sm text-[#c4b79e]">
            Capt. {crownShip.captainName} · {crownShip.cannons} Naval Guns · {crownShip.crewCount} Marines
          </p>
        </div>

        <blockquote className="p-4 rounded bg-[#101820] border border-[#c99d4e]/25 text-sm text-[#ede2cf] italic">
          “Heave to, outlaw! Strike your false colors and answer for your acts of piracy before the Admiralty!”
        </blockquote>

        {errorMsg && (
          <div className="px-3.5 py-2 rounded bg-[#3b1c1c] border border-[#c4463c]/60 text-sm text-[#f6c5c0]">
            {errorMsg}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
          <button
            type="button"
            onClick={() => onRespond('surrender')}
            className="flex-1 py-2.5 px-3 bg-[#c99d4e] hover:bg-[#dfb261] text-[#14100b] text-sm font-bold rounded cursor-pointer"
          >
            Pay Fine ({fine}g, +14 Rep)
          </button>
          <button
            type="button"
            onClick={() => onRespond('bribe')}
            className="flex-1 py-2.5 px-3 bg-[#21364a] hover:bg-[#2c4760] text-[#f4ead5] text-sm font-semibold rounded cursor-pointer"
          >
            Bribe (140g)
          </button>
          <button
            type="button"
            onClick={() => onRespond('fight')}
            className="flex-1 py-2.5 px-3 bg-[#a93b33] hover:bg-[#c0473e] text-white text-sm font-bold rounded cursor-pointer"
          >
            Fight Crown Navy
          </button>
        </div>
      </div>
    </div>
  );
};
