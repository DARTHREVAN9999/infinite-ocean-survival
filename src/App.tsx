import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MultiplayerClient, loadMultiplayerName, saveMultiplayerName, type MultiplayerStatus } from './network/MultiplayerClient';
import {
  HudSnapshot,
  MerchantShipData,
  PirateShipData,
  SaveData,
  SeaMonsterData,
  ShipwreckData,
} from './game/types';
import {
  createNewVoyage,
  loadVoyageFromStorage,
  saveVoyageToStorage,
} from './game/storage';
import { OceanEngine } from './engine/oceanScene';
import { TitleScreen } from './components/TitleScreen';
import { MainHud } from './components/MainHud';
import { ShipManagementModal } from './components/ShipManagementModal';
import { WreckModal } from './components/WreckModal';
import { TradeModal } from './components/TradeModal';
import {
  CombatCommandBar,
  PirateHailModal,
  VictoryLootModal,
} from './components/CombatOverlay';
import {
  CrownHailModal,
  InnocentVesselModal,
  PirateEncounterModal,
  SeaMonsterModal,
} from './components/EncounterModals';
import { JournalModal } from './components/JournalModal';
import { MapModal } from './components/MapModal';
import { PauseSettingsModal } from './components/PauseSettingsModal';
import { GameOverModal } from './components/GameOverModal';
import { WeatherModal } from './components/WeatherModal';
import { AdminModal } from './components/AdminModal';
import { FloatingDamageLayer } from './components/FloatingDamageLayer';
import { FirstPersonHud } from './components/FirstPersonHud';
import { FishingMinigameModal } from './components/FishingMinigameModal';
import { SettlementModal } from './components/SettlementModal';
import { TreasureMapModal } from './components/TreasureMapModal';

type ActiveModal =
  | null
  | { type: 'ship' }
  | { type: 'journal' }
  | { type: 'map' }
  | { type: 'weather' }
  | { type: 'admin' }
  | { type: 'fishing' }
  | { type: 'treasure' }
  | { type: 'settlement'; id: string }
  | { type: 'wreck'; id: string }
  | { type: 'vessel_menu'; id: string }
  | { type: 'merchant_trade'; id: string }
  | { type: 'pirate_parley'; id: string }
  | { type: 'monster'; id: string }
  | { type: 'pirate_hail'; pirate: PirateShipData }
  | { type: 'crown_hail'; crown: MerchantShipData }
  | { type: 'victory_loot'; pirate: PirateShipData }
  | { type: 'merchant_victory'; merchant: MerchantShipData };

function modalMusicKind(m: ActiveModal): string | null {
  if (!m) return null;
  if (m.type === 'merchant_trade' || m.type === 'vessel_menu') return 'merchant';
  if (m.type === 'settlement') return 'settlement';
  if (m.type === 'wreck') return 'wreck';
  if (m.type === 'pirate_parley') return 'pirate_trade';
  return null;
}

export function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<OceanEngine | null>(null);
  const multiplayerRef = useRef<MultiplayerClient | null>(null);
  const [playerName, setPlayerName] = useState<string>(() => loadMultiplayerName());
  const playerNameRef = useRef(playerName);
  playerNameRef.current = playerName;
  const [multiplayerStatus, setMultiplayerStatus] = useState<MultiplayerStatus>('connecting');
  const [onlinePlayers, setOnlinePlayers] = useState(1);

  const [savedOnDisk, setSavedOnDisk] = useState<SaveData | null>(() => loadVoyageFromStorage());
  const [saveState, setSaveState] = useState<SaveData>(() => loadVoyageFromStorage() ?? createNewVoyage());
  const [phase, setPhase] = useState<'title' | 'playing' | 'paused' | 'gameover'>('title');
  const [hud, setHud] = useState<HudSnapshot | null>(null);
  const [modal, setModal] = useState<ActiveModal>(null);
  const [hailError, setHailError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [modalTick, setModalTick] = useState(0);

  const modalRef = useRef<ActiveModal>(null);
  const phaseRef = useRef(phase);
  modalRef.current = modal;
  phaseRef.current = phase;

  useEffect(() => {
    document.documentElement.dataset.uiScale = saveState.settings.uiScale || 'large';
  }, [saveState.settings.uiScale]);

  useEffect(() => {
    document.body.dataset.state = phase;
  }, [phase]);

  const openModal = useCallback((next: ActiveModal) => {
    setModal(next);
    setHailError(null);
    engineRef.current?.setModalOpen(next !== null, modalMusicKind(next));
  }, []);

  const handleInteract = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const prompt = engine.findNearbyInteractable();
    if (!prompt) return;

    if (prompt.kind === 'crate') {
      engine.collectFloatingCrate(prompt.id);
    } else if (prompt.kind === 'wreck' || prompt.kind === 'ghost_wreck') {
      openModal({ type: 'wreck', id: prompt.id });
    } else if (prompt.kind === 'merchant') {
      openModal({ type: 'vessel_menu', id: prompt.id });
    } else if (prompt.kind === 'pirate_hail') {
      openModal({ type: 'pirate_parley', id: prompt.id });
    } else if (prompt.kind === 'monster') {
      openModal({ type: 'monster', id: prompt.id });
    } else if (prompt.kind === 'monster_carcass' || prompt.kind === 'sea_wildlife') {
      openModal({ type: 'fishing' });
    } else if (prompt.kind === 'island') {
      engine.landOnIsland(prompt.id);
    } else if (prompt.kind === 'settlement') {
      openModal({ type: 'settlement', id: prompt.id });
    }
  }, [openModal]);

  const handleHotkeyRef = useRef<(menu: 'ship' | 'journal' | 'map' | 'pause' | 'interact' | 'fishing') => void>(() => {});
  handleHotkeyRef.current = (menu) => {
    const engine = engineRef.current;
    if (!engine) return;

    if (menu === 'interact') {
      handleInteract();
      return;
    }

    if (menu === 'pause') {
      if (modalRef.current) {
        if (
          modalRef.current.type === 'pirate_hail' ||
          modalRef.current.type === 'crown_hail' ||
          modalRef.current.type === 'victory_loot' ||
          modalRef.current.type === 'merchant_victory'
        ) {
          return;
        }
        openModal(null);
        return;
      }
      if (phaseRef.current === 'playing') {
        engine.setPhase('paused');
      } else if (phaseRef.current === 'paused') {
        engine.setPhase('playing');
      }
      return;
    }

    if (phaseRef.current !== 'playing') return;
    if (modalRef.current?.type === menu) {
      openModal(null);
    } else if (
      !modalRef.current ||
      (modalRef.current.type !== 'pirate_hail' &&
        modalRef.current.type !== 'crown_hail' &&
        modalRef.current.type !== 'victory_loot' &&
        modalRef.current.type !== 'merchant_victory')
    ) {
      openModal({ type: menu });
    }
  };

  // Hidden Admin Console hotkey: P opens/toggles password & console (only while playing & not typing)
  useEffect(() => {
    const onGlobalKeyDown = (e: KeyboardEvent) => {
      if (phaseRef.current !== 'playing') return;
      const active = document.activeElement as HTMLElement | null;
      if (
        active &&
        (active.tagName === 'INPUT' ||
          active.tagName === 'TEXTAREA' ||
          active.tagName === 'SELECT' ||
          active.isContentEditable)
      ) {
        return;
      }
      if (e.code === 'KeyP' || e.key.toLowerCase() === 'p') {
        e.preventDefault();
        if (modalRef.current?.type === 'admin') {
          openModal(null);
        } else if (
          !modalRef.current ||
          (modalRef.current.type !== 'pirate_hail' &&
            modalRef.current.type !== 'crown_hail' &&
            modalRef.current.type !== 'victory_loot' &&
            modalRef.current.type !== 'merchant_victory')
        ) {
          openModal({ type: 'admin' });
        }
      }
    };
    window.addEventListener('keydown', onGlobalKeyDown);
    return () => window.removeEventListener('keydown', onGlobalKeyDown);
  }, [openModal]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const initialData = loadVoyageFromStorage() ?? createNewVoyage();
    const engine = new OceanEngine(mount, initialData, {
      onHudUpdate: (snap) => setHud(snap),
      onPirateHail: (pirate) => {
        setHailError(null);
        setModal({ type: 'pirate_hail', pirate: { ...pirate } });
      },
      onCrownHail: (crownShip) => {
        setHailError(null);
        engine.setModalOpen(true, 'merchant');
        setModal({ type: 'crown_hail', crown: { ...crownShip } });
      },
      onVictoryLoot: (pirate) => {
        engine.setModalOpen(true);
        setModal({ type: 'victory_loot', pirate: { ...pirate } });
      },
      onMerchantVictory: (merchant) => {
        engine.setModalOpen(true);
        setModal({ type: 'merchant_victory', merchant: { ...merchant } });
      },
      onSettlementOpen: (settlement) => {
        engine.setModalOpen(true, 'settlement');
        setModal({ type: 'settlement', id: settlement.id });
      },
      onStateChange: (nextPhase) => {
        setPhase(nextPhase);
        if (nextPhase !== 'playing') {
          setModal(null);
          engine.setModalOpen(false);
        }
        if (nextPhase === 'title') {
          setSavedOnDisk(loadVoyageFromStorage());
        }
      },
      onSaveUpdate: (snap) => {
        setSaveState({ ...snap });
        if (phaseRef.current === 'title') setSavedOnDisk({ ...snap });
        setModalTick((t) => t + 1);
      },
      onHotkeyMenu: (menu) => handleHotkeyRef.current(menu),
      onPlayerDeath: () => {
        const client = multiplayerRef.current;
        if (!client?.requestRespawn()) {
          engine.respawnAfterDeath({ x: 0, z: 0, heading: 0 });
        }
      },
    });

    engineRef.current = engine;

    const client = new MultiplayerClient({
      onStatus: (status) => {
        setMultiplayerStatus(status);
        if (status !== 'online') setOnlinePlayers(0);
      },
      onWelcome: ({ worldSeed, spawn }) => {
        engine.setMultiplayerWorldSeed(worldSeed);
        if (spawn) engine.applyMultiplayerSpawn(spawn);
      },
      onPlayers: (players) => {
        engine.syncRemotePlayers(players);
        setOnlinePlayers(players.length + 1);
      },
      onRespawn: (spawn) => engine.respawnAfterDeath(spawn),
      getLocalState: () => ({
        name: playerNameRef.current,
        ...engine.getMultiplayerShipState(),
      }),
    });
    multiplayerRef.current = client;
    client.connect(playerNameRef.current, initialData.player.shipName);

    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      engine.setPhase('playing');
    }

    return () => {
      client.destroy();
      multiplayerRef.current = null;
      engine.dispose();
      engineRef.current = null;
    };
  }, []);


  useEffect(() => {
    saveMultiplayerName(playerName);
    multiplayerRef.current?.updateProfile(playerName, saveState.player.shipName);
  }, [playerName, saveState.player.shipName]);

  const handleStartNew = (shipName?: string) => {
    engineRef.current?.startNewVoyage(shipName);
  };

  const handleContinue = () => {
    if (savedOnDisk) {
      engineRef.current?.continueVoyage(savedOnDisk);
    } else {
      engineRef.current?.startNewVoyage();
    }
  };

  const handleCompleteSearch = useCallback((wId: string, sId: string) => {
    return (
      engineRef.current?.searchWreckSection(wId, sId) ?? {
        ok: false,
        gold: 0,
        loot: {},
        hazardMsg: null,
      }
    );
  }, []);

  const handleResolveSurvivor = useCallback(
    (wId: string, sId: string, choice: 'accept' | 'force' | 'decline') => {
      return (
        engineRef.current?.resolveWreckSurvivor(wId, sId, choice) ?? {
          ok: false,
          message: 'Unavailable.',
        }
      );
    },
    []
  );

  const activeWreck: ShipwreckData | null =
    modal?.type === 'wreck' ? engineRef.current?.getWreckById(modal.id) ?? null : null;

  const activeMerchant: MerchantShipData | null =
    modal?.type === 'vessel_menu' || modal?.type === 'merchant_trade'
      ? engineRef.current?.getMerchantById(modal.id) ?? null
      : null;

  const activePirateEncounter: PirateShipData | null =
    modal?.type === 'pirate_parley' ? engineRef.current?.getPirateById(modal.id) ?? null : null;

  const activeMonsterEncounter: SeaMonsterData | null =
    modal?.type === 'monster' ? engineRef.current?.getMonsterById(modal.id) ?? null : null;

  const activeSettlement =
    modal?.type === 'settlement' ? engineRef.current?.getSettlementById(modal.id) ?? null : null;

  const adminTargets =
    modal?.type === 'admin' && hud?.adminUnlocked
      ? engineRef.current?.getAdminTeleportTargets() ?? []
      : [];

  void modalTick;

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#08131e]">
      <div
        ref={mountRef}
        data-testid="ocean-canvas"
        className={`fixed inset-0 w-full h-full ${
          hud?.firstPerson?.active && !modal ? 'cursor-none' : 'cursor-grab active:cursor-grabbing'
        }`}
      />

      <div
        className="fixed top-3 right-3 z-30 rounded border border-[#c99d4e]/50 bg-[#0b1722]/90 px-3 py-2 text-[11px] uppercase tracking-wider text-[#efe4cc] shadow-lg pointer-events-none"
        aria-live="polite"
      >
        <span className={`inline-block w-2 h-2 rounded-full mr-2 ${multiplayerStatus === 'online' ? 'bg-emerald-400' : multiplayerStatus === 'full' ? 'bg-red-400' : 'bg-amber-400'}`} />
        {multiplayerStatus === 'online'
          ? `Shared ocean · ${onlinePlayers} online`
          : multiplayerStatus === 'full'
            ? 'Server full'
            : multiplayerStatus === 'offline'
              ? 'Multiplayer offline'
              : 'Connecting to shared ocean…'}
      </div>

      {phase === 'title' && (
        <TitleScreen
          savedVoyage={savedOnDisk}
          onStartNew={handleStartNew}
          onContinue={handleContinue}
          playerName={playerName}
          onPlayerNameChange={setPlayerName}
        />
      )}

      {phase === 'playing' && hud && (
        <>
          <FloatingDamageLayer damages={hud.floatingDamages ?? []} />

          <MainHud
            hud={hud}
            muted={muted}
            onOpenShip={() => openModal({ type: 'ship' })}
            onOpenJournal={() => openModal({ type: 'journal' })}
            onOpenMap={() => openModal({ type: 'map' })}
            onOpenFishing={() => openModal({ type: 'fishing' })}
            onOpenTreasureMaps={() => openModal({ type: 'treasure' })}
            onOpenWeather={() => openModal({ type: 'weather' })}
            onOpenAdmin={() => openModal({ type: 'admin' })}
            onOpenPause={() => engineRef.current?.setPhase('paused')}
            onToggleMute={() => {
              const next = engineRef.current?.toggleMute() ?? false;
              setMuted(next);
            }}
            onToggleStop={() => engineRef.current?.toggleStop()}
            onInteract={handleInteract}
            onAcceptBounty={() => engineRef.current?.acceptBounty()}
            onDeclineBounty={() => engineRef.current?.declineBounty()}
            onDismissTutorial={(disableAll) => engineRef.current?.dismissTutorialToast(disableAll)}
            onDismissSupplyWarning={(key) => engineRef.current?.dismissSupplyWarning(key)}
          />

          {hud.firstPerson?.active && !modal && (
            <FirstPersonHud
              fps={hud.firstPerson}
              onSwitchWeapon={(w) => engineRef.current?.switchFpsWeapon(w)}
              onReload={() => engineRef.current?.triggerFpsReload()}
              onInteract={() => engineRef.current?.handleFpsInteract()}
              onBoardShip={() => engineRef.current?.boardShipFromIsland()}
            />
          )}

          {hud.combat.active && !modal && !hud.firstPerson?.active && (
            <CombatCommandBar
              hud={hud}
              onSetCommand={(cmd) => engineRef.current?.setCombatCommand(cmd)}
              onSelectTarget={(enemyId) => engineRef.current?.setPrimaryCombatTarget(enemyId)}
            />
          )}
        </>
      )}

      {phase === 'playing' && modal?.type === 'weather' && hud && (
        <WeatherModal hud={hud} onClose={() => openModal(null)} />
      )}

      {phase === 'playing' && modal?.type === 'admin' && hud && (
        <AdminModal
          hud={hud}
          targets={adminTargets}
          onClose={() => openModal(null)}
          onUnlock={(pw) => engineRef.current?.unlockAdminMode(pw) ?? false}
          onToggleAdmin={(en) => engineRef.current?.toggleAdminMode(en)}
          onTeleportNear={(id) =>
            engineRef.current?.adminTeleportNear(id) ?? { ok: false, message: 'Unavailable.' }
          }
          onRestoreMaxResources={() =>
            engineRef.current?.adminRestoreMaxResources() ?? { ok: false, message: 'Unavailable.' }
          }
          onSpawnMaxFleet={() =>
            engineRef.current?.adminSpawnMaxFleet() ?? { ok: false, message: 'Unavailable.' }
          }
          onSpawnColossalCompanion={() =>
            engineRef.current?.adminSpawnColossalCompanion() ?? { ok: false, message: 'Unavailable.' }
          }
          onSpawnGhostShip={(sz) =>
            engineRef.current?.adminSpawnGhostShip(sz) ?? { ok: false, message: 'Unavailable.' }
          }
          onProjectBounty={() =>
            engineRef.current?.adminProjectBounty() ?? { ok: false, message: 'Unavailable.' }
          }
          onSetWeather={(wt) =>
            engineRef.current?.adminSetWeather(wt) ?? { ok: false, message: 'Unavailable.' }
          }
        />
      )}

      {phase === 'playing' && modal?.type === 'ship' && (
        <ShipManagementModal
          save={saveState}
          onClose={() => openModal(null)}
          onAssignRole={(id, role) => engineRef.current?.assignCrewRole(id, role)}
          onAutoAssignRoles={(mode) =>
            engineRef.current?.autoAssignCrewRoles(mode) ?? { message: 'Unavailable.' }
          }
          onTreatCrew={(id) =>
            engineRef.current?.treatCrew(id) ?? { ok: false, message: 'Unavailable.' }
          }
          onStartManualRepair={(sec) =>
            engineRef.current?.startManualRepair(sec) ?? { ok: false, message: 'Unavailable.' }
          }
          onPurchaseHullUpgrade={(id) =>
            engineRef.current?.purchaseHullUpgrade(id) ?? { ok: false, message: 'Unavailable.' }
          }
          onInstallWeapon={(w) =>
            engineRef.current?.installOrSwitchWeapon(w) ?? { ok: false, message: 'Unavailable.' }
          }
          onUpgradeCannonStat={(stat) =>
            engineRef.current?.upgradeCannonStat(stat) ?? { ok: false, message: 'Unavailable.' }
          }
          onUpdateCustomFlag={(cfg) =>
            engineRef.current?.updateCustomFlag(cfg) ?? { ok: false, message: 'Unavailable.' }
          }
          onSetShipName={(name) =>
            engineRef.current?.setPlayerShipName(name) ?? { ok: false, message: 'Unavailable.' }
          }
          onBuyFlagCosmetic={(kind, id, price) =>
            engineRef.current?.buyFlagCosmetic(kind, id, price) ?? {
              ok: false,
              message: 'Unavailable.',
            }
          }
          onBuyFleetShip={(cls, name) =>
            engineRef.current?.buyFleetShip(cls, name) ?? {
              ok: false,
              message: 'Unavailable.',
            }
          }
          onSetFleetCommand={(id, cmd) => engineRef.current?.setFleetShipCommand(id, cmd)}
          onRenameFleetShip={(id, name) => engineRef.current?.renameFleetShip(id, name)}
          onBuyFishingGear={(gearId) =>
            engineRef.current?.buyFishingGear(gearId) ?? {
              ok: false,
              message: 'Unavailable.',
            }
          }
          onConvertFishToFood={(kind, qty) =>
            engineRef.current?.convertFishToFood(kind, qty) ?? {
              ok: false,
              message: 'Unavailable.',
            }
          }
        />
      )}

      {phase === 'playing' && modal?.type === 'fishing' && hud && (
        <FishingMinigameModal
          biome={hud.biome ?? 'temperate'}
          biomeLabel={hud.biomeLabel ?? 'Normal Ocean'}
          fishingGear={hud.fishingGear ?? 'none'}
          nearbyTarget={hud.nearbyFishTarget}
          onClose={() => openModal(null)}
          onCatchSuccess={(spec) =>
            engineRef.current?.completeManualFishingCatch(spec) ?? {
              ok: false,
              message: 'Unavailable.',
            }
          }
          onHarvestNearbyTarget={(kind, id) =>
            engineRef.current?.harvestNearbyFishingTarget(kind, id) ?? {
              ok: false,
              message: 'Unavailable.',
              foodAdded: 0,
              saltAdded: 0,
            }
          }
        />
      )}

      {phase === 'playing' && modal?.type === 'treasure' && (
        <TreasureMapModal save={saveState} onClose={() => openModal(null)} />
      )}

      {phase === 'playing' && modal?.type === 'settlement' && activeSettlement && (
        <SettlementModal
          settlement={activeSettlement}
          save={saveState}
          onClose={() => openModal(null)}
          onStepAshore={(islandId) => {
            openModal(null);
            engineRef.current?.landOnIsland(islandId);
          }}
          onTrade={(sId, mode, resId, qty) =>
            engineRef.current?.tradeWithSettlement(sId, mode, resId, qty) ?? {
              ok: false,
              message: 'Unavailable.',
            }
          }
          onHireCrew={(sId, crewId) =>
            engineRef.current?.hireSettlementCrew(sId, crewId) ?? {
              ok: false,
              message: 'Unavailable.',
            }
          }
          onHearRumor={(sId) =>
            engineRef.current?.hearSettlementRumor(sId) ?? {
              ok: false,
              message: 'Unavailable.',
            }
          }
          onCompleteErrand={(sId) =>
            engineRef.current?.completeSettlementErrand(sId) ?? {
              ok: false,
              message: 'Unavailable.',
            }
          }
          onBuyFishingGear={(gearId) =>
            engineRef.current?.buyFishingGear(gearId) ?? {
              ok: false,
              message: 'Unavailable.',
            }
          }
        />
      )}

      {phase === 'playing' && modal?.type === 'wreck' && activeWreck && (
        <WreckModal
          wreck={activeWreck}
          onClose={() => openModal(null)}
          onCompleteSearch={handleCompleteSearch}
          onResolveSurvivor={handleResolveSurvivor}
        />
      )}

      {phase === 'playing' && modal?.type === 'vessel_menu' && activeMerchant && (
        <InnocentVesselModal
          merchant={activeMerchant}
          save={saveState}
          onClose={() => openModal(null)}
          onOpenTrade={() => openModal({ type: 'merchant_trade', id: activeMerchant.id })}
          onAction={(action) =>
            engineRef.current?.interactWithInnocentVessel(activeMerchant.id, action) ?? {
              ok: false,
              message: 'Unavailable.',
            }
          }
          onAttemptRobbery={() =>
            engineRef.current?.attemptRobbery(activeMerchant.id) ?? {
              outcome: 'fight',
              message: 'Unavailable.',
            }
          }
          onCommitRobbery={(gold, items) =>
            engineRef.current?.commitRobberySteal(activeMerchant.id, gold, items) ?? {
              ok: false,
              message: 'Unavailable.',
            }
          }
          onAttack={() => engineRef.current?.attackInnocentVessel(activeMerchant.id)}
        />
      )}

      {phase === 'playing' && modal?.type === 'merchant_trade' && activeMerchant && (
        <TradeModal
          merchant={activeMerchant}
          save={saveState}
          onClose={() => openModal(null)}
          onTrade={(mId, mode, resId, qty) =>
            engineRef.current?.tradeWithMerchant(mId, mode, resId, qty) ?? {
              ok: false,
              message: 'Unavailable.',
            }
          }
          onHireCrew={(mId, cId) =>
            engineRef.current?.hireMerchantCrew(mId, cId) ?? {
              ok: false,
              message: 'Unavailable.',
            }
          }
          onBuyFlagCosmetic={(kind, id, price) =>
            engineRef.current?.buyFlagCosmetic(kind, id, price) ?? {
              ok: false,
              message: 'Unavailable.',
            }
          }
        />
      )}

      {phase === 'playing' && modal?.type === 'pirate_parley' && activePirateEncounter && (
        <PirateEncounterModal
          pirate={activePirateEncounter}
          save={saveState}
          onClose={() => openModal(null)}
          onTrade={(mode, resId, qty) =>
            engineRef.current?.tradeWithPirate(activePirateEncounter.id, mode, resId, qty) ?? {
              ok: false,
              message: 'Unavailable.',
            }
          }
          onForgeAlliance={() =>
            engineRef.current?.forgePirateAlliance(activePirateEncounter.id) ?? {
              ok: false,
              message: 'Unavailable.',
            }
          }
          onAttack={() => engineRef.current?.startNavalBattle(activePirateEncounter)}
        />
      )}

      {phase === 'playing' && modal?.type === 'monster' && activeMonsterEncounter && (
        <SeaMonsterModal
          monster={activeMonsterEncounter}
          playerFood={saveState.player.inventory.food}
          onClose={() => openModal(null)}
          onFeedToTame={() =>
            engineRef.current?.feedMonsterToTame(activeMonsterEncounter.id) ?? {
              ok: false,
              message: 'Unavailable.',
            }
          }
          onAttack={() => engineRef.current?.attackMonster(activeMonsterEncounter.id)}
        />
      )}

      {phase === 'playing' && modal?.type === 'pirate_hail' && (
        <PirateHailModal
          pirate={modal.pirate}
          playerGold={Math.round(saveState.player.gold)}
          errorMsg={hailError}
          onRespond={(choice) => {
            const res = engineRef.current?.respondToPirateHail(modal.pirate.id, choice);
            if (res?.ok) {
              openModal(null);
            } else if (res) {
              setHailError(res.message);
            }
          }}
        />
      )}

      {phase === 'playing' && modal?.type === 'crown_hail' && (
        <CrownHailModal
          crownShip={modal.crown}
          playerGold={Math.round(saveState.player.gold)}
          errorMsg={hailError}
          onRespond={(choice) => {
            const res = engineRef.current?.resolveCrownHail(modal.crown.id, choice);
            if (res?.ok) {
              openModal(null);
            } else if (res) {
              setHailError(res.message);
            }
          }}
        />
      )}

      {phase === 'playing' && modal?.type === 'victory_loot' && (
        <VictoryLootModal
          vesselKind="pirate"
          pirate={modal.pirate}
          fleetUnlocked={hud?.fleetUnlocked ?? false}
          fleetCount={hud?.fleetCount ?? 0}
          playerGold={Math.round(saveState.player.gold)}
          onClose={() => {
            engineRef.current?.markPirateVictoryHandled(modal.pirate.id);
            openModal(null);
          }}
          onResolveCrewOffer={(choice) =>
            engineRef.current?.resolveDefeatedShipCrew('pirate', modal.pirate.id, choice) ?? {
              ok: false,
              status: 'error' as const,
              message: 'Unavailable.',
            }
          }
          onCaptureForFleet={() => {
            const res = engineRef.current?.captureEnemyForFleet(modal.pirate.id) ?? {
              ok: false,
              message: 'Unavailable.',
            };
            if (res.ok) openModal(null);
            return res;
          }}
        />
      )}

      {phase === 'playing' && modal?.type === 'merchant_victory' && (
        <VictoryLootModal
          vesselKind="merchant"
          merchant={modal.merchant}
          fleetUnlocked={hud?.fleetUnlocked ?? false}
          fleetCount={hud?.fleetCount ?? 0}
          playerGold={Math.round(saveState.player.gold)}
          onClose={() => {
            openModal(null);
          }}
          onResolveCrewOffer={(choice) =>
            engineRef.current?.resolveDefeatedShipCrew('merchant', modal.merchant.id, choice) ?? {
              ok: false,
              status: 'error' as const,
              message: 'Unavailable.',
            }
          }
          onCaptureForFleet={() => {
            const res = engineRef.current?.recruitDefeatedMerchantForFleet(modal.merchant.id) ?? {
              ok: false,
              message: 'Unavailable.',
            };
            if (res.ok) openModal(null);
            return res;
          }}
        />
      )}

      {phase === 'playing' && modal?.type === 'journal' && (
        <JournalModal
          entries={saveState.journal}
          day={saveState.day}
          timeStr={hud?.timeStr ?? '06:20'}
          onClose={() => openModal(null)}
          onWrite={(title, body) => engineRef.current?.writeJournal(title, body)}
          onEdit={(id, title, body) => engineRef.current?.editJournal(id, title, body)}
          onDelete={(id) => engineRef.current?.removeJournal(id)}
        />
      )}

      {phase === 'playing' && modal?.type === 'map' && (
        <MapModal save={saveState} onClose={() => openModal(null)} />
      )}

      {phase === 'paused' && (
        <PauseSettingsModal
          settings={saveState.settings}
          onResume={() => engineRef.current?.setPhase('playing')}
          onSaveNow={() => engineRef.current?.manualSave() ?? false}
          onUpdateSettings={(s) => engineRef.current?.updateSettings(s)}
          onReturnTitle={() => {
            if (engineRef.current) {
              saveVoyageToStorage(engineRef.current.getSaveSnapshot());
              engineRef.current.setPhase('title');
            }
          }}
        />
      )}

      {phase === 'gameover' && (
        <GameOverModal stats={saveState.stats} onStartNew={handleStartNew} />
      )}
    </div>
  );
}

export default App;
