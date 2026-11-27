import type { WeatherState } from '../game/types';

export interface RemotePlayerState {
  id: string;
  /** Same as shipName: the vessel name is the only name shown above a ship. */
  name: string;
  shipName: string;
  x: number;
  z: number;
  heading: number;
  speed: number;
  landed: boolean;
  hullTier: number;
  reputation: number;
  hullPct: number;
  cannons: number;
}

export interface LocalShipState {
  shipName: string;
  x: number;
  z: number;
  heading: number;
  speed: number;
  landed: boolean;
  hullTier: number;
  reputation: number;
  hullPct: number;
  cannons: number;
}

export type NpcKind = 'merchant' | 'pirate' | 'monster' | 'wildlife';

/** Position/behavior of a shared bot ship or sea creature, simulated by exactly one owner client. */
export interface NpcWireState {
  id: string;
  kind: NpcKind;
  x: number;
  z: number;
  heading: number;
  speed: number;
  behavior?: string;
  hullPct?: number;
  ownerId?: string;
}

/** A persistent change to the shared world (bot ship gold/stock, looted wreck, defeated pirate...). */
export interface WorldPatch {
  kind: string;
  id: string;
  data: Record<string, unknown>;
  rev?: number;
}

export type WeatherSnapshot = {
  weather: WeatherState;
  tornadoPos: { x: number; z: number; vx: number; vz: number; active: boolean } | null;
};

export type RelayType =
  | 'trade-offer' | 'trade-response' | 'trade-commit' | 'trade-cancel'
  | 'pvp-attack' | 'pvp-volley' | 'pvp-down' | 'pvp-end';

export type MultiplayerStatus = 'connecting' | 'online' | 'reconnecting' | 'offline' | 'full';

interface MultiplayerCallbacks {
  onStatus: (status: MultiplayerStatus, message?: string) => void;
  onWelcome: (data: {
    playerId: string;
    worldSeed: number;
    spawn: { x: number; z: number; heading: number } | null;
    isWorldLeader: boolean;
    weather: WeatherSnapshot | null;
    patches: WorldPatch[];
    npcs: NpcWireState[];
  }) => void;
  onWorldAuthority: (isAuthority: boolean) => void;
  onWorldWeather: (state: WeatherSnapshot) => void;
  onPatches: (patches: WorldPatch[]) => void;
  onNpcStates: (npcs: NpcWireState[]) => void;
  onPlayers: (players: RemotePlayerState[]) => void;
  onRespawn: (spawn: { x: number; z: number; heading: number }) => void;
  onRelay: (type: RelayType, from: string, fromName: string, payload: any) => void;
  onRelayFailed: (reason: string) => void;
  getLocalState: () => LocalShipState | null;
  getLocalWeatherState: () => WeatherSnapshot | null;
  getOwnedNpcStates: () => NpcWireState[];
}

const PLAYER_ID_KEY = 'oceanbound_mp_player_id_v1';
const HAS_SPAWNED_KEY = 'oceanbound_mp_has_spawned_v1';

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

export class MultiplayerClient {
  private socket: WebSocket | null = null;
  public readonly playerId = getOrCreatePlayerId();
  private callbacks: MultiplayerCallbacks;
  private remotePlayers = new Map<string, RemotePlayerState>();
  private reconnectTimer: number | null = null;
  private heartbeatTimer: number | null = null;
  private stateTimer: number | null = null;
  private npcTimer: number | null = null;
  private respawnTimer: number | null = null;
  private weatherTimer: number | null = null;
  private isWorldLeader = false;
  private shouldReconnect = true;
  private hasSpawned = false;
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

  public connect(shipName: string): void {
    this.shipName = shipName.trim().slice(0, 22) || 'Unnamed Vessel';
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
      this.send({
        type: 'join',
        id: this.playerId,
        shipName: this.shipName,
        hasSpawned: this.hasSpawned,
        state: this.callbacks.getLocalState(),
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

    switch (message.type) {
      case 'welcome': {
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
        this.callbacks.onWelcome({
          playerId: this.playerId,
          worldSeed: Number(message.worldSeed) || 731296,
          spawn: message.spawn ?? null,
          isWorldLeader: this.isWorldLeader,
          weather: message.weather?.weather ? (message.weather as WeatherSnapshot) : null,
          patches: Array.isArray(message.patches) ? (message.patches as WorldPatch[]) : [],
          npcs: Array.isArray(message.npcs) ? (message.npcs as NpcWireState[]) : [],
        });
        this.emitPlayers();
        return;
      }
      case 'player-joined':
      case 'player-update': {
        const player = message.player as RemotePlayerState | undefined;
        if (player?.id && player.id !== this.playerId) {
          this.remotePlayers.set(player.id, player);
          this.emitPlayers();
        }
        return;
      }
      case 'player-left':
        if (message.id) this.remotePlayers.delete(String(message.id));
        this.emitPlayers();
        return;
      case 'world-leader':
        this.isWorldLeader = String(message.leaderId || '') === this.playerId;
        this.callbacks.onWorldAuthority(this.isWorldLeader);
        if (message.weather?.weather) this.callbacks.onWorldWeather(message.weather);
        return;
      case 'world-weather':
        if (message.state?.weather) this.callbacks.onWorldWeather(message.state);
        return;
      case 'world-patch':
        if (message.patch?.kind && message.patch?.id) this.callbacks.onPatches([message.patch as WorldPatch]);
        return;
      case 'npc-states':
        if (Array.isArray(message.npcs)) this.callbacks.onNpcStates(message.npcs as NpcWireState[]);
        return;
      case 'respawn': {
        const spawn = message.spawn;
        if (this.respawnTimer !== null) window.clearTimeout(this.respawnTimer);
        this.respawnTimer = null;
        if (spawn && Number.isFinite(spawn.x) && Number.isFinite(spawn.z)) {
          this.callbacks.onRespawn(spawn);
        }
        return;
      }
      case 'trade-offer':
      case 'trade-response':
      case 'trade-commit':
      case 'trade-cancel':
      case 'pvp-attack':
      case 'pvp-volley':
      case 'pvp-down':
      case 'pvp-end':
        this.callbacks.onRelay(message.type as RelayType, String(message.from || ''), String(message.fromName || 'Unknown Vessel'), message.payload ?? {});
        return;
      case 'relay-failed':
        this.callbacks.onRelayFailed(String(message.reason || 'That could not be delivered.'));
        return;
      case 'full':
        this.callbacks.onStatus('full', message.message || 'The ocean server is full.');
        this.shouldReconnect = false;
        this.stopTimers();
        return;
      case 'error':
        this.callbacks.onStatus('reconnecting', message.message || 'Multiplayer connection error.');
        return;
      default:
        return;
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
    }, 200);
    this.npcTimer = window.setInterval(() => {
      const npcs = this.callbacks.getOwnedNpcStates();
      if (npcs.length > 0) this.send({ type: 'npc-batch', npcs });
    }, 250);
    this.heartbeatTimer = window.setInterval(() => {
      this.send({ type: 'heartbeat' });
    }, 15_000);
    this.weatherTimer = window.setInterval(() => {
      if (!this.isWorldLeader) return;
      const weather = this.callbacks.getLocalWeatherState();
      if (weather) this.send({ type: 'world-weather', state: weather });
    }, 1000);
  }

  private stopTimers(): void {
    if (this.stateTimer !== null) window.clearInterval(this.stateTimer);
    if (this.npcTimer !== null) window.clearInterval(this.npcTimer);
    if (this.heartbeatTimer !== null) window.clearInterval(this.heartbeatTimer);
    if (this.weatherTimer !== null) window.clearInterval(this.weatherTimer);
    this.stateTimer = null;
    this.npcTimer = null;
    this.heartbeatTimer = null;
    this.weatherTimer = null;
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

  /** The vessel name is the only public name. */
  public updateProfile(shipName: string): void {
    this.shipName = shipName.trim().slice(0, 22) || 'Unnamed Vessel';
    this.send({ type: 'name', shipName: this.shipName });
  }

  /** Persist a change to the one shared world (gold/stock on a bot ship, looted wreck...). */
  public sendPatch(kind: string, id: string, data: Record<string, unknown>): void {
    this.send({ type: 'patch', kind, id, data });
  }

  /** Send a message to one other player (trade offers, PvP). */
  public sendRelay(type: RelayType, to: string, payload: Record<string, unknown> = {}): boolean {
    return this.send({ type, to, payload });
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
