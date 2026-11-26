import type { CustomFlagConfig, CrewMember, SaveData, ShipUpgrades } from './types';

export const MULTIPLAYER_WORLD_SEED = 20261126;
const PLAYER_ID_KEY = 'infinite_ocean_player_id';

export interface RemotePlayerState {
  id: string;
  name: string;
  x: number;
  z: number;
  heading: number;
  speed: number;
  landed: boolean;
  weatherType?: string;
  ship: {
    upgrades: ShipUpgrades;
    crew: CrewMember[];
    customFlag: CustomFlagConfig;
  } | null;
}

export interface LocalMultiplayerState {
  name: string;
  x: number;
  z: number;
  heading: number;
  speed: number;
  landed: boolean;
  ship: {
    upgrades: ShipUpgrades;
    crew: CrewMember[];
    customFlag: CustomFlagConfig;
  };
}

export interface MultiplayerWelcome {
  spawn: { x: number; z: number };
  players: RemotePlayerState[];
  worldSeed: number;
}

interface MultiplayerHandlers {
  onProfileLoaded: (save: SaveData | null) => void;
  onWelcome: (welcome: MultiplayerWelcome) => void;
  onPlayersChanged: (players: RemotePlayerState[]) => void;
  onConnectionChanged: (connected: boolean, message?: string) => void;
  onAction: (action: Record<string, unknown>) => void;
}

export function getMultiplayerPlayerId(): string {
  const existing = localStorage.getItem(PLAYER_ID_KEY);
  if (existing && /^[a-zA-Z0-9_-]{8,80}$/.test(existing)) return existing;
  const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID().replace(/-/g, '')
    : `captain_${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;
  localStorage.setItem(PLAYER_ID_KEY, id);
  return id;
}

export class MultiplayerSession {
  private socket: WebSocket | null = null;
  private playerId = '';
  private handlers: MultiplayerHandlers | null = null;
  private remotePlayers = new Map<string, RemotePlayerState>();
  private pendingSave: SaveData | null = null;
  private saveTimer: number | null = null;
  private reconnectTimer: number | null = null;
  private disposed = false;

  public async connect(playerId: string, handlers: MultiplayerHandlers): Promise<void> {
    this.playerId = playerId;
    this.handlers = handlers;
    this.disposed = false;

    let loadedSave: SaveData | null = null;
    try {
      const response = await fetch(`/api/profile/${encodeURIComponent(playerId)}`);
      if (response.ok) {
        const data = await response.json() as { save?: SaveData | null };
        loadedSave = data.save ?? null;
      } else {
        handlers.onConnectionChanged(false, 'Could not load your saved voyage from the server.');
      }
    } catch {
      handlers.onConnectionChanged(false, 'The multiplayer server is not reachable yet.');
    }
    if (this.disposed) return;
    handlers.onProfileLoaded(loadedSave);
    this.openSocket();
  }

  private openSocket(): void {
    if (this.disposed || !this.handlers) return;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${window.location.host}/ws?id=${encodeURIComponent(this.playerId)}`);
    this.socket = socket;

    socket.onopen = () => {
      this.handlers?.onConnectionChanged(true);
    };

    socket.onmessage = (event) => {
      let message: Record<string, unknown>;
      try {
        message = JSON.parse(String(event.data)) as Record<string, unknown>;
      } catch {
        return;
      }

      if (message.type === 'welcome') {
        const welcome = message as unknown as MultiplayerWelcome & { type: string };
        this.remotePlayers.clear();
        for (const player of welcome.players ?? []) {
          if (player.id !== this.playerId) this.remotePlayers.set(player.id, player);
        }
        this.handlers?.onWelcome(welcome);
        if (typeof (message as any).weatherType === 'string') this.handlers?.onAction({ type: 'world_weather', weatherType: (message as any).weatherType });
        this.emitPlayers();
      } else if (message.type === 'player_update') {
        const player = message.player as RemotePlayerState | undefined;
        if (player?.id && player.id !== this.playerId) {
          this.remotePlayers.set(player.id, player);
          this.emitPlayers();
        }
      } else if (message.type === 'player_left') {
        const id = String(message.playerId || '');
        this.remotePlayers.delete(id);
        this.emitPlayers();
      } else if (message.type === 'world_weather' || message.type === 'wreck_section_looted' || message.type === 'pvp_event' || message.type === 'trade_offer' || message.type === 'trade_result') {
        this.handlers?.onAction(message);
      } else if (message.type === 'error') {
        this.handlers?.onConnectionChanged(false, String(message.message || 'Multiplayer connection error.'));
      }
    };

    socket.onclose = () => {
      if (this.disposed) return;
      this.handlers?.onConnectionChanged(false, 'Connection lost. Reconnecting…');
      this.reconnectTimer = window.setTimeout(() => this.openSocket(), 2500);
    };

    socket.onerror = () => {
      this.handlers?.onConnectionChanged(false, 'Could not connect to the multiplayer server.');
    };
  }

  private emitPlayers(): void {
    this.handlers?.onPlayersChanged([...this.remotePlayers.values()]);
  }

  public sendState(state: LocalMultiplayerState): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify({ type: 'state', state }));
  }

  public sendAction(action: Record<string, unknown>): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify({ type: 'action', action }));
  }

  public leaveWorld(): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify({ type: 'leave' }));
  }

  public saveProfile(save: SaveData): void {
    this.pendingSave = save;
    if (this.saveTimer !== null) return;
    this.saveTimer = window.setTimeout(() => {
      this.saveTimer = null;
      void this.flushSave();
    }, 1600);
  }

  private async flushSave(): Promise<void> {
    const save = this.pendingSave;
    this.pendingSave = null;
    if (!save || !this.playerId) return;
    try {
      await fetch(`/api/profile/${encodeURIComponent(this.playerId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ save }),
        keepalive: true,
      });
    } catch {
      // The local autosave remains available if the server is temporarily offline.
    }
  }

  public disconnect(): void {
    this.disposed = true;
    if (this.reconnectTimer !== null) window.clearTimeout(this.reconnectTimer);
    if (this.saveTimer !== null) window.clearTimeout(this.saveTimer);
    this.reconnectTimer = null;
    this.saveTimer = null;
    void this.flushSave();
    this.socket?.close();
    this.socket = null;
  }
}
