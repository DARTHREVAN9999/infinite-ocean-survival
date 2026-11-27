import express from 'express';
import { createServer } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocket, WebSocketServer } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 10000);
const WORLD_SEED = Number(process.env.WORLD_SEED || 731296);
const MAX_PLAYERS = Math.max(2, Math.min(200, Number(process.env.MAX_PLAYERS || 32)));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const WORLD_FILE = path.join(DATA_DIR, 'world.json');
const SERVER_STARTED_AT = Date.now();
const MAX_PATCHES = 30_000;
const MAX_PATCH_BYTES = 12_000;
const NPC_STALE_MS = 6_000;
const NPC_TICK_MS = 200;
const INTERACT_RANGE = 420;

const WEATHER_TYPES = new Set([
  'calm', 'clear', 'light_winds', 'strong_winds', 'light_rain', 'heavy_rain', 'hail',
  'severe_hail', 'snow', 'blizzard', 'thunderstorm', 'lightning_storm', 'hurricane',
  'tornado', 'dense_fog', 'heatwave',
]);

// Message types one player may relay to another (validated for range and shape below).
const RELAY_TYPES = new Set([
  'trade-offer', 'trade-response', 'trade-commit', 'trade-cancel',
  'pvp-attack', 'pvp-volley', 'pvp-down', 'pvp-end',
]);

// ---------------------------------------------------------------------------
// World state
// ---------------------------------------------------------------------------
/** @type {Map<string, any>} */
const players = new Map();
/** Shared NPC ships / sea creatures. Each is simulated by exactly one owner client (the nearest player). */
/** @type {Map<string, any>} */
const npcs = new Map();
/** Persistent shared world mutations (bot-ship gold/stock, looted wrecks, defeated pirates, settlement stock...). */
/** @type {Map<string, {kind:string,id:string,data:any,rev:number,ts:number}>} */
const patches = new Map();
let worldLeaderId = null;
let sharedWeather = null;
let patchRev = 0;
let worldDirty = false;

function loadWorld() {
  try {
    if (!fs.existsSync(WORLD_FILE)) return;
    const saved = JSON.parse(fs.readFileSync(WORLD_FILE, 'utf8'));
    if (saved && saved.seed === WORLD_SEED && Array.isArray(saved.patches)) {
      for (const p of saved.patches) {
        if (p && typeof p.kind === 'string' && typeof p.id === 'string') {
          patches.set(`${p.kind}:${p.id}`, p);
          patchRev = Math.max(patchRev, Number(p.rev) || 0);
        }
      }
      console.log(`Loaded ${patches.size} shared world patches from disk.`);
    }
  } catch (error) {
    console.warn('Could not load saved world:', error?.message || error);
  }
}

function saveWorld() {
  if (!worldDirty) return;
  worldDirty = false;
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = `${WORLD_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify({ seed: WORLD_SEED, savedAt: Date.now(), patches: [...patches.values()] }));
    fs.renameSync(tmp, WORLD_FILE);
  } catch (error) {
    console.warn('Could not save world:', error?.message || error);
  }
}

loadWorld();

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------
const app = express();
app.disable('x-powered-by');
app.get('/healthz', (_req, res) => {
  res.json({
    ok: true,
    service: 'infinite-ocean-survival',
    onlinePlayers: players.size,
    sharedNpcs: npcs.size,
    worldPatches: patches.size,
    worldLeader: worldLeaderId,
    uptimeSeconds: Math.floor((Date.now() - SERVER_STARTED_AT) / 1000),
  });
});
app.use(express.static(path.join(__dirname, 'dist'), { extensions: ['html'] }));
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer, path: '/multiplayer', maxPayload: 512 * 1024 });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function clamp(value, min, max, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
}

function cleanText(value, fallback, max = 22) {
  const text = String(value ?? '').replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, max);
  return text || fallback;
}

function cleanId(value, max = 100) {
  return String(value ?? '').replace(/[^a-zA-Z0-9_:.\-]/g, '').slice(0, max);
}

function publicPlayer(player) {
  return {
    id: player.id,
    name: player.shipName, // The vessel name is the only name players have.
    shipName: player.shipName,
    x: player.x,
    z: player.z,
    heading: player.heading,
    speed: player.speed,
    landed: player.landed,
    hullTier: player.hullTier,
    reputation: player.reputation,
    hullPct: player.hullPct,
    cannons: player.cannons,
    lastSeen: player.lastSeen,
  };
}

function send(ws, payload) {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
}

function broadcast(payload, exceptId = null) {
  const encoded = JSON.stringify(payload);
  for (const player of players.values()) {
    if (player.id !== exceptId && player.ws.readyState === WebSocket.OPEN) player.ws.send(encoded);
  }
}

function chooseNearbySpawn(exceptId = null) {
  const candidates = [...players.values()].filter((p) => p.id !== exceptId && !p.landed);
  if (candidates.length === 0) return { x: 0, z: 0, heading: 0 };
  const anchor = candidates[Math.floor(Math.random() * candidates.length)];
  const angle = Math.random() * Math.PI * 2;
  const distance = 120 + Math.random() * 70;
  const x = anchor.x + Math.cos(angle) * distance;
  const z = anchor.z + Math.sin(angle) * distance;
  return { x, z, heading: Math.atan2(anchor.x - x, anchor.z - z) };
}

function normalizeState(input, previous = {}) {
  const state = input && typeof input === 'object' ? input : {};
  return {
    x: clamp(state.x, -5_000_000, 5_000_000, previous.x ?? 0),
    z: clamp(state.z, -5_000_000, 5_000_000, previous.z ?? 0),
    heading: clamp(state.heading, -Math.PI * 100, Math.PI * 100, previous.heading ?? 0),
    speed: clamp(state.speed, -80, 80, previous.speed ?? 0),
    landed: Boolean(state.landed),
    hullTier: Math.round(clamp(state.hullTier, 1, 7, previous.hullTier ?? 1)),
    reputation: Math.round(clamp(state.reputation, -100, 100, previous.reputation ?? 0)),
    hullPct: Math.round(clamp(state.hullPct, 0, 100, previous.hullPct ?? 100)),
    cannons: Math.round(clamp(state.cannons, 0, 60, previous.cannons ?? 4)),
  };
}

function sanitizeWeather(input) {
  if (!input || typeof input !== 'object' || !input.weather || !WEATHER_TYPES.has(input.weather.type)) return null;
  const w = input.weather;
  return {
    weather: {
      type: w.type,
      windSpeed: clamp(w.windSpeed, 0, 100, 12),
      windDir: clamp(w.windDir, -Math.PI * 8, Math.PI * 8, 0),
      waveIntensity: clamp(w.waveIntensity, 0.1, 5, 1),
      fogDensity: clamp(w.fogDensity, 0, 0.03, 0.001),
      rainIntensity: clamp(w.rainIntensity, 0, 1, 0),
      snowIntensity: clamp(w.snowIntensity, 0, 1, 0),
      hailIntensity: clamp(w.hailIntensity, 0, 1, 0),
      lightningFlash: clamp(w.lightningFlash, 0, 1, 0),
      waterDrainMult: clamp(w.waterDrainMult, 0.5, 3, 1),
      visibilityLabel: cleanText(w.visibilityLabel, 'Normal visibility', 40),
      seaConditionLabel: cleanText(w.seaConditionLabel, 'Moderate seas', 40),
      warningText: w.warningText == null ? null : String(w.warningText).slice(0, 160),
      timeUntilChange: clamp(w.timeUntilChange, 0, 3600, 120),
    },
    tornadoPos: input.tornadoPos && typeof input.tornadoPos === 'object' ? {
      x: clamp(input.tornadoPos.x, -5_000_000, 5_000_000),
      z: clamp(input.tornadoPos.z, -5_000_000, 5_000_000),
      vx: clamp(input.tornadoPos.vx, -100, 100),
      vz: clamp(input.tornadoPos.vz, -100, 100),
      active: Boolean(input.tornadoPos.active),
    } : null,
    updatedAt: Date.now(),
  };
}

function promoteWorldLeader() {
  if (worldLeaderId && players.has(worldLeaderId)) return;
  worldLeaderId = players.keys().next().value ?? null;
  broadcast({ type: 'world-leader', leaderId: worldLeaderId, weather: sharedWeather });
}

function removePlayer(id, ws = null) {
  const player = players.get(id);
  if (!player || (ws && player.ws !== ws)) return;
  players.delete(id);
  // Release NPCs owned by that player so the next-nearest player takes them over.
  for (const npc of npcs.values()) {
    if (npc.ownerId === id) npc.ts = 0;
  }
  broadcast({ type: 'player-left', id, onlineCount: players.size });
  if (worldLeaderId === id) {
    worldLeaderId = null;
    promoteWorldLeader();
  }
}

// ---------------------------------------------------------------------------
// Shared NPC ownership (nearest player simulates; everyone else renders)
// ---------------------------------------------------------------------------
const pendingNpcBroadcast = new Map();

function handleNpcBatch(player, list) {
  if (!Array.isArray(list)) return;
  const now = Date.now();
  for (const raw of list.slice(0, 120)) {
    if (!raw || typeof raw !== 'object') continue;
    const id = cleanId(raw.id);
    if (!id || id.startsWith('pvp_')) continue;
    const kind = raw.kind === 'merchant' || raw.kind === 'pirate' || raw.kind === 'monster' || raw.kind === 'wildlife' ? raw.kind : null;
    if (!kind) continue;
    const x = clamp(raw.x, -5_000_000, 5_000_000, NaN);
    const z = clamp(raw.z, -5_000_000, 5_000_000, NaN);
    if (!Number.isFinite(x) || !Number.isFinite(z)) continue;

    const existing = npcs.get(id);
    const claimDist = Math.hypot(x - player.x, z - player.z);
    let accept = !existing || existing.ownerId === player.id || now - existing.ts > NPC_STALE_MS;
    if (!accept && existing) {
      const owner = players.get(existing.ownerId);
      if (!owner) accept = true;
      else {
        const ownerDist = Math.hypot(existing.x - owner.x, existing.z - owner.z);
        // Take over only when clearly closer (hysteresis avoids ownership flapping).
        if (claimDist + 220 < ownerDist) accept = true;
      }
    }
    if (!accept) continue;

    const next = {
      id,
      kind,
      ownerId: player.id,
      x,
      z,
      heading: clamp(raw.heading, -Math.PI * 100, Math.PI * 100, 0),
      speed: clamp(raw.speed, -80, 80, 0),
      behavior: typeof raw.behavior === 'string' ? raw.behavior.slice(0, 24) : undefined,
      hullPct: raw.hullPct == null ? undefined : Math.round(clamp(raw.hullPct, 0, 100, 100)),
      ts: now,
    };
    npcs.set(id, next);
    pendingNpcBroadcast.set(id, next);
  }
}

const npcTimer = setInterval(() => {
  const now = Date.now();
  for (const [id, npc] of npcs) {
    if (now - npc.ts > 60_000) npcs.delete(id);
  }
  if (pendingNpcBroadcast.size === 0) return;
  const batch = [...pendingNpcBroadcast.values()];
  pendingNpcBroadcast.clear();
  for (const player of players.values()) {
    if (player.ws.readyState !== WebSocket.OPEN) continue;
    const forPlayer = batch.filter((npc) => npc.ownerId !== player.id);
    if (forPlayer.length > 0) player.ws.send(JSON.stringify({ type: 'npc-states', npcs: forPlayer }));
  }
}, NPC_TICK_MS);

// ---------------------------------------------------------------------------
// Persistent shared patches
// ---------------------------------------------------------------------------
function handlePatch(player, message) {
  const kind = cleanId(message.kind, 24);
  const id = cleanId(message.id);
  if (!kind || !id) return;
  if (!message.data || typeof message.data !== 'object') return;
  let encoded;
  try { encoded = JSON.stringify(message.data); } catch { return; }
  if (encoded.length > MAX_PATCH_BYTES) return;
  const key = `${kind}:${id}`;
  if (!patches.has(key) && patches.size >= MAX_PATCHES) return;
  const previous = patches.get(key);
  const merged = { kind, id, data: { ...(previous?.data ?? {}), ...message.data }, rev: ++patchRev, ts: Date.now() };
  patches.set(key, merged);
  worldDirty = true;
  broadcast({ type: 'world-patch', patch: merged }, player.id);
}

const saveTimer = setInterval(saveWorld, 20_000);

// ---------------------------------------------------------------------------
// WebSocket handling
// ---------------------------------------------------------------------------
wss.on('connection', (ws) => {
  let joinedId = null;
  let windowStart = Date.now();
  let windowCount = 0;

  ws.on('message', (raw) => {
    // Simple flood protection: 120 messages / second per socket.
    const now = Date.now();
    if (now - windowStart > 1000) { windowStart = now; windowCount = 0; }
    if (++windowCount > 120) return;

    let message;
    try { message = JSON.parse(raw.toString()); }
    catch { send(ws, { type: 'error', message: 'Invalid message format.' }); return; }
    if (!message || typeof message.type !== 'string') return;

    if (message.type === 'join') {
      if (joinedId) return;
      const id = cleanId(message.id, 80);
      if (!id) { send(ws, { type: 'error', message: 'A player ID is required.' }); ws.close(1008, 'Missing player ID'); return; }
      const previousConnection = players.get(id);
      if (players.size >= MAX_PLAYERS && !previousConnection) {
        send(ws, { type: 'full', message: 'The ocean server is currently full. Try again later.' });
        ws.close(1013, 'Server full'); return;
      }
      if (previousConnection && previousConnection.ws !== ws) {
        previousConnection.ws.close(4001, 'Player reconnected in another tab');
        players.delete(id);
      }
      const previousState = normalizeState(message.state, previousConnection || {});
      const shipName = cleanText(message.shipName, 'Unnamed Vessel');
      const player = { id, shipName, ...previousState, ws, lastSeen: Date.now() };
      if (!message.hasSpawned) Object.assign(player, chooseNearbySpawn(id));
      players.set(id, player);
      joinedId = id;
      if (!worldLeaderId || !players.has(worldLeaderId)) worldLeaderId = id;
      send(ws, {
        type: 'welcome',
        playerId: id,
        worldSeed: WORLD_SEED,
        spawn: !message.hasSpawned ? { x: player.x, z: player.z, heading: player.heading } : null,
        players: [...players.values()].filter((p) => p.id !== id).map(publicPlayer),
        onlineCount: players.size,
        worldLeaderId,
        weather: sharedWeather,
        patches: [...patches.values()],
        npcs: [...npcs.values()].filter((n) => now - n.ts < NPC_STALE_MS),
      });
      broadcast({ type: 'player-joined', player: publicPlayer(player), onlineCount: players.size }, id);
      return;
    }

    if (message.type === 'heartbeat') {
      if (joinedId) {
        const activePlayer = players.get(joinedId);
        if (activePlayer?.ws === ws) activePlayer.lastSeen = Date.now();
      }
      send(ws, { type: 'heartbeat-ack', now: Date.now() });
      return;
    }

    if (!joinedId) return;
    const player = players.get(joinedId);
    if (!player || player.ws !== ws) return;
    player.lastSeen = Date.now();

    if (message.type === 'name') {
      player.shipName = cleanText(message.shipName, player.shipName);
      broadcast({ type: 'player-update', player: publicPlayer(player) });
      return;
    }

    if (message.type === 'state') {
      Object.assign(player, normalizeState(message.state, player));
      broadcast({ type: 'player-update', player: publicPlayer(player) }, joinedId);
      return;
    }

    if (message.type === 'npc-batch') {
      handleNpcBatch(player, message.npcs);
      return;
    }

    if (message.type === 'patch') {
      handlePatch(player, message);
      return;
    }

    if (message.type === 'world-weather' && joinedId === worldLeaderId) {
      const weather = sanitizeWeather(message.state);
      if (weather) {
        sharedWeather = weather;
        broadcast({ type: 'world-weather', state: sharedWeather }, joinedId);
      }
      return;
    }

    if (message.type === 'respawn-request') {
      const spawn = chooseNearbySpawn(joinedId);
      player.x = spawn.x;
      player.z = spawn.z;
      player.heading = spawn.heading;
      player.speed = 0;
      player.landed = false;
      player.hullPct = 100;
      player.lastSeen = Date.now();
      send(ws, { type: 'respawn', spawn });
      broadcast({ type: 'player-update', player: publicPlayer(player) }, joinedId);
      return;
    }

    // Player-to-player messages (trade offers, PvP). The server only validates and forwards.
    if (RELAY_TYPES.has(message.type)) {
      const targetId = cleanId(message.to, 80);
      const target = players.get(targetId);
      if (!target || target.id === player.id) return;
      const needsRange = message.type === 'trade-offer' || message.type === 'pvp-attack';
      if (needsRange && Math.hypot(player.x - target.x, player.z - target.z) > INTERACT_RANGE) {
        send(ws, { type: 'relay-failed', relay: message.type, to: targetId, reason: 'That ship is too far away.' });
        return;
      }
      const payload = message.payload && typeof message.payload === 'object' ? message.payload : {};
      let encoded;
      try { encoded = JSON.stringify(payload); } catch { return; }
      if (encoded.length > 6_000) return;
      send(target.ws, { type: message.type, from: player.id, fromName: player.shipName, payload });
    }
  });

  ws.on('close', () => {
    if (joinedId) removePlayer(joinedId, ws);
  });

  ws.on('error', () => {});
});

const heartbeatTimer = setInterval(() => {
  for (const player of [...players.values()]) {
    if (player.ws.readyState !== WebSocket.OPEN || Date.now() - player.lastSeen > 45_000) {
      if (player.ws.readyState === WebSocket.OPEN) player.ws.terminate();
      removePlayer(player.id);
    }
  }
}, 15_000);

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Infinite Ocean Survival multiplayer server listening on ${PORT}`);
});

function shutdown() {
  clearInterval(heartbeatTimer);
  clearInterval(npcTimer);
  clearInterval(saveTimer);
  worldDirty = true;
  saveWorld();
  for (const player of players.values()) {
    send(player.ws, { type: 'server-shutdown' });
    player.ws.close(1001, 'Server shutting down');
  }
  wss.close();
  httpServer.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 25_000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
