import type { PirateShipData, WeatherState } from '../game/types';

export interface RemotePlayerState {
  id: string;
  name: string;
  shipName: string;
  x: number;
  z: number;
  heading: number;
  speed: number;
  landed: boolean;
  hullTier: number;
}

export interface LocalShipState {
  name: string;
  shipName: string;
  x: number;
  z: number;
  heading: number;
  speed: number;
  landed: boolean;
  hullTier: number;
}

export type MultiplayerStatus = 'connecting' | 'online' | 'reconnecting' | 'offline' | 'full';

interface MultiplayerCallbacks {
  onStatus: (status: MultiplayerStatus, message?: string) => void;
  onWelcome: (data: { worldSeed: number; spawn: { x: number; z: number; heading: number } | null; isWorldLeader: boolean; weather: { weather: WeatherState; tornadoPos: { x: number; z: number; vx: number; vz: number; active: boolean } | null } | null; pirates: PirateShipData[] }) => void;
  onWorldAuthority: (isAuthority: boolean) => void;
  onWorldWeather: (state: { weather: WeatherState; tornadoPos: { x: number; z: number; vx: number; vz: number; active: boolean } | null }) => void;
  onWorldPirates: (pirates: PirateShipData[]) => void;
  onStateCorrection: (state: LocalShipState) => void;
  onPlayers: (players: RemotePlayerState[]) => void;
  onRespawn: (spawn: { x: number; z: number; heading: number }) => void;
  getLocalState: () => LocalShipState | null;
  getLocalWeatherState: () => { weather: WeatherState; tornadoPos: { x: number; z: number; vx: number; vz: number; active: boolean } | null } | null;
  getLocalPirateStates: () => PirateShipData[];
}

const PLAYER_ID_KEY = 'oceanbound_mp_player_id_v1';
const HAS_SPAWNED_KEY = 'oceanbound_mp_has_spawned_v1';
const PLAYER_NAME_KEY = 'oceanbound_mp_player_name_v1';

function getOrCreatePlayerId(): string {
  try {
    const existing = localStorage.getItem(PLAYER_ID_KEY);
    if (existing) return existing;
    const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `captain_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
    localStorage.setItem(PLAYER_ID_KEY, id);
    return id;
  } catch {
    return `captain_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
  }
}

export function loadMultiplayerName(): string {
  try {
    return localStorage.getItem(PLAYER_NAME_KEY) || 'Captain';
  } catch {
    return 'Captain';
  }
}

export function saveMultiplayerName(name: string): void {
  try {
    localStorage.setItem(PLAYER_NAME_KEY, name.trim().slice(0, 22) || 'Captain');
  } catch {
    // Private browsing or storage restrictions should not prevent joining.
  }
}

export class MultiplayerClient {
  private socket: WebSocket | null = null;
  private readonly playerId = getOrCreatePlayerId();
  private callbacks: MultiplayerCallbacks;
  private remotePlayers = new Map<string, RemotePlayerState>();
  private reconnectTimer: number | null = null;
  private heartbeatTimer: number | null = null;
  private stateTimer: number | null = null;
  private respawnTimer: number | null = null;
  private worldSyncTimer: number | null = null;
  private isWorldLeader = false;
  private shouldReconnect = true;
  private hasSpawned = false;
  private name = loadMultiplayerName();
  private shipName = 'Unnamed Vessel';
  private connectAttempt = 0;

  constructor(callbacks: MultiplayerCallbacks) {
    this.callbacks = callbacks;
    try {
      this.hasSpawned = localStorage.getItem(HAS_SPAWNED_KEY) === '1';
    } catch {
      this.hasSpawned = false;
    }
  }

  public connect(name: string, shipName: string): void {
    this.name = name.trim().slice(0, 22) || 'Captain';
    this.shipName = shipName.trim().slice(0, 22) || 'Unnamed Vessel';
    saveMultiplayerName(this.name);
    this.shouldReconnect = true;
    this.openSocket();
  }

  private getSocketUrl(): string {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/multiplayer`;
  }

  private openSocket(): void {
    if (!this.shouldReconnect) return;
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.callbacks.onStatus(this.connectAttempt === 0 ? 'connecting' : 'reconnecting');
    let socket: WebSocket;
    try {
      socket = new WebSocket(this.getSocketUrl());
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.socket = socket;

    socket.addEventListener('open', () => {
      this.connectAttempt = 0;
      const state = this.callbacks.getLocalState();
      this.send({
        type: 'join',
        id: this.playerId,
        name: this.name,
        shipName: this.shipName,
        hasSpawned: this.hasSpawned,
        state,
      });
      this.callbacks.onStatus('connecting', 'Joining the shared ocean…');
      this.startTimers();
    });

    socket.addEventListener('message', (event) => {
      this.handleMessage(event.data);
    });

    socket.addEventListener('close', () => {
      this.stopTimers();
      if (this.shouldReconnect) this.scheduleReconnect();
    });

    socket.addEventListener('error', () => {
      this.callbacks.onStatus('reconnecting', 'The server connection was interrupted.');
      socket.close();
    });
  }

  private handleMessage(raw: unknown): void {
    let message: any;
    try {
      message = JSON.parse(String(raw));
    } catch {
      return;
    }

    if (message.type === 'welcome') {
      this.callbacks.onStatus('online');
      this.remotePlayers.clear();
      for (const player of Array.isArray(message.players) ? message.players : []) {
        if (player?.id && player.id !== this.playerId) {
          this.remotePlayers.set(player.id, player as RemotePlayerState);
        }
      }
      if (message.spawn && Number.isFinite(message.spawn.x) && Number.isFinite(message.spawn.z)) {
        this.hasSpawned = true;
        try { localStorage.setItem(HAS_SPAWNED_KEY, '1'); } catch { /* ignore */ }
      }
      this.isWorldLeader = String(message.worldLeaderId || '') === this.playerId;
      this.callbacks.onWorldAuthority(this.isWorldLeader);
      if (message.weather?.weather) this.callbacks.onWorldWeather(message.weather);
      if (Array.isArray(message.pirates)) this.callbacks.onWorldPirates(message.pirates as PirateShipData[]);
      this.callbacks.onWelcome({
        worldSeed: Number(message.worldSeed) || 731296,
        spawn: message.spawn ?? null,
        isWorldLeader: this.isWorldLeader,
        weather: message.weather?.weather ? message.weather : null,
        pirates: Array.isArray(message.pirates) ? message.pirates as PirateShipData[] : [],
      });
      this.emitPlayers();
      return;
    }

    if (message.type === 'player-joined' || message.type === 'player-update') {
      const player = message.player as RemotePlayerState | undefined;
      if (player?.id && player.id !== this.playerId) {
        this.remotePlayers.set(player.id, player);
        this.emitPlayers();
      }
      return;
    }

    if (message.type === 'player-left') {
      if (message.id) this.remotePlayers.delete(String(message.id));
      this.emitPlayers();
      return;
    }

    if (message.type === 'state-correction' && message.state) {
      this.callbacks.onStateCorrection(message.state as LocalShipState);
      return;
    }

    if (message.type === 'world-leader') {
      this.isWorldLeader = String(message.leaderId || '') === this.playerId;
      this.callbacks.onWorldAuthority(this.isWorldLeader);
      if (message.weather?.weather) this.callbacks.onWorldWeather(message.weather);
      if (Array.isArray(message.pirates)) this.callbacks.onWorldPirates(message.pirates as PirateShipData[]);
      return;
    }

    if (message.type === 'world-weather' && message.state?.weather) {
      this.callbacks.onWorldWeather(message.state);
      return;
    }

    if (message.type === 'world-pirates' && Array.isArray(message.pirates)) {
      this.callbacks.onWorldPirates(message.pirates as PirateShipData[]);
      return;
    }

    if (message.type === 'respawn') {
      const spawn = message.spawn;
      if (this.respawnTimer !== null) window.clearTimeout(this.respawnTimer);
      this.respawnTimer = null;
      if (spawn && Number.isFinite(spawn.x) && Number.isFinite(spawn.z)) {
        this.callbacks.onRespawn(spawn);
      }
      return;
    }

    if (message.type === 'full') {
      this.callbacks.onStatus('full', message.message || 'The ocean server is full.');
      this.shouldReconnect = false;
      this.stopTimers();
      return;
    }

    if (message.type === 'error') {
      this.callbacks.onStatus('reconnecting', message.message || 'Multiplayer connection error.');
    }
  }

  private emitPlayers(): void {
    this.callbacks.onPlayers([...this.remotePlayers.values()]);
  }

  private send(payload: unknown): boolean {
    if (this.socket?.readyState !== WebSocket.OPEN) return false;
    try {
      this.socket.send(JSON.stringify(payload));
      return true;
    } catch {
      // The close handler will reconnect if the transport has failed.
      return false;
    }
  }

  private startTimers(): void {
    this.stopTimers();
    this.stateTimer = window.setInterval(() => {
      const state = this.callbacks.getLocalState();
      if (state) this.send({ type: 'state', state });
    }, 250);
    this.heartbeatTimer = window.setInterval(() => {
      this.send({ type: 'heartbeat' });
    }, 15_000);
    this.worldSyncTimer = window.setInterval(() => {
      if (!this.isWorldLeader) return;
      const weather = this.callbacks.getLocalWeatherState();
      if (weather) this.send({ type: 'world-weather', state: weather });
      this.send({ type: 'world-pirates', pirates: this.callbacks.getLocalPirateStates() });
    }, 1000);
  }

  private stopTimers(): void {
    if (this.stateTimer !== null) window.clearInterval(this.stateTimer);
    if (this.heartbeatTimer !== null) window.clearInterval(this.heartbeatTimer);
    if (this.worldSyncTimer !== null) window.clearInterval(this.worldSyncTimer);
    this.stateTimer = null;
    this.heartbeatTimer = null;
    this.worldSyncTimer = null;
  }

  private scheduleReconnect(): void {
    if (!this.shouldReconnect || this.reconnectTimer !== null) return;
    this.connectAttempt += 1;
    this.callbacks.onStatus('reconnecting');
    const delay = Math.min(12_000, 900 + this.connectAttempt * 700);
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.openSocket();
    }, delay);
  }

  public updateProfile(name: string, shipName: string): void {
    this.name = name.trim().slice(0, 22) || 'Captain';
    this.shipName = shipName.trim().slice(0, 22) || 'Unnamed Vessel';
    saveMultiplayerName(this.name);
    this.send({ type: 'name', name: this.name, shipName: this.shipName });
  }

  public requestRespawn(): boolean {
    const sent = this.send({ type: 'respawn-request' });
    if (!sent) return false;
    if (this.respawnTimer !== null) window.clearTimeout(this.respawnTimer);
    this.respawnTimer = window.setTimeout(() => {
      this.respawnTimer = null;
      this.callbacks.onRespawn({ x: 0, z: 0, heading: 0 });
    }, 6_000);
    return true;
  }

  public destroy(): void {
    this.shouldReconnect = false;
    this.stopTimers();
    if (this.respawnTimer !== null) window.clearTimeout(this.respawnTimer);
    this.respawnTimer = null;
    if (this.reconnectTimer !== null) window.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.socket?.close(1000, 'Client closed');
    this.socket = null;
    this.remotePlayers.clear();
    this.isWorldLeader = false;
  }
}
