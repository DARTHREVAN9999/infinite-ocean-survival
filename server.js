import express from 'express';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocket, WebSocketServer } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 10000);
const WORLD_SEED = Number(process.env.WORLD_SEED || 731296);
const MAX_PLAYERS = Math.max(2, Math.min(200, Number(process.env.MAX_PLAYERS || 32)));
const SERVER_STARTED_AT = Date.now();
const WEATHER_TYPES = new Set([
  'calm', 'clear', 'light_winds', 'strong_winds', 'light_rain', 'heavy_rain', 'hail',
  'severe_hail', 'snow', 'blizzard', 'thunderstorm', 'lightning_storm', 'hurricane',
  'tornado', 'dense_fog', 'heatwave',
]);

const players = new Map();
let worldLeaderId = null;
let sharedWeather = null;
let sharedWorldPirates = [];

const app = express();
app.disable('x-powered-by');
app.get('/healthz', (_req, res) => {
  res.json({
    ok: true,
    service: 'infinite-ocean-survival',
    onlinePlayers: players.size,
    worldLeader: worldLeaderId,
    uptimeSeconds: Math.floor((Date.now() - SERVER_STARTED_AT) / 1000),
  });
});
app.use(express.static(path.join(__dirname, 'dist'), { extensions: ['html'] }));
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer, path: '/multiplayer', maxPayload: 256 * 1024 });

function clamp(value, min, max, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
}

function cleanName(value, fallback) {
  const name = String(value ?? '').replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, 22);
  return name || fallback;
}

function publicPlayer(player) {
  return {
    id: player.id,
    name: player.name,
    shipName: player.shipName,
    x: player.x,
    z: player.z,
    heading: player.heading,
    speed: player.speed,
    landed: player.landed,
    hullTier: player.hullTier,
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
  const candidates = [...players.values()].filter((p) => p.id !== exceptId);
  if (candidates.length === 0) return { x: 0, z: 0, heading: 0 };
  const anchor = candidates[Math.floor(Math.random() * candidates.length)];
  const angle = Math.random() * Math.PI * 2;
  const distance = 95 + Math.random() * 55;
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
  };
}

// Server-authoritative circular hull collision. Clients receive corrected
// positions, so two locally controlled ships cannot simply pass through each other.
function resolveShipCollisions(changedPlayer) {
  const affected = new Set();
  for (let pass = 0; pass < 3; pass++) {
    for (const other of players.values()) {
      if (other.id === changedPlayer.id) continue;
      const dx = changedPlayer.x - other.x;
      const dz = changedPlayer.z - other.z;
      const distance = Math.hypot(dx, dz);
      const radiusA = 18 + changedPlayer.hullTier * 1.5;
      const radiusB = 18 + other.hullTier * 1.5;
      const minimum = radiusA + radiusB;
      if (distance >= minimum) continue;
      const nx = distance > 0.001 ? dx / distance : (changedPlayer.id < other.id ? 1 : -1);
      const nz = distance > 0.001 ? dz / distance : 0;
      const overlap = minimum - distance + 0.35;
      affected.add(changedPlayer);
      if (changedPlayer.landed && !other.landed) {
        other.x -= nx * overlap;
        other.z -= nz * overlap;
        other.speed = Math.min(other.speed, -Math.abs(other.speed) * 0.45);
        affected.add(other);
      } else if (other.landed && !changedPlayer.landed) {
        changedPlayer.x += nx * overlap;
        changedPlayer.z += nz * overlap;
        changedPlayer.speed = Math.min(changedPlayer.speed, -Math.abs(changedPlayer.speed) * 0.45);
      } else {
        changedPlayer.x += nx * overlap * 0.5;
        changedPlayer.z += nz * overlap * 0.5;
        other.x -= nx * overlap * 0.5;
        other.z -= nz * overlap * 0.5;
        changedPlayer.speed *= 0.72;
        other.speed *= 0.72;
        affected.add(other);
      }
      affected.add(changedPlayer);
    }
  }
  return [...affected];
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
      visibilityLabel: cleanName(w.visibilityLabel, 'Normal visibility'),
      seaConditionLabel: cleanName(w.seaConditionLabel, 'Moderate seas'),
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
  broadcast({ type: 'world-leader', leaderId: worldLeaderId, weather: sharedWeather, pirates: sharedWorldPirates });
}

wss.on('connection', (ws) => {
  let joinedId = null;

  ws.on('message', (raw) => {
    let message;
    try { message = JSON.parse(raw.toString()); }
    catch { send(ws, { type: 'error', message: 'Invalid message format.' }); return; }
    if (!message || typeof message.type !== 'string') return;

    if (message.type === 'join') {
      if (joinedId) return;
      const id = String(message.id || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);
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
      const player = {
        id,
        name: cleanName(message.name, 'Captain'),
        shipName: cleanName(message.shipName, 'Unnamed Vessel'),
        ...previousState,
        ws,
        lastSeen: Date.now(),
      };
      if (!Boolean(message.hasSpawned)) Object.assign(player, chooseNearbySpawn(id));
      players.set(id, player);
      joinedId = id;
      if (!worldLeaderId || !players.has(worldLeaderId)) worldLeaderId = id;
      send(ws, {
        type: 'welcome',
        playerId: id,
        worldSeed: WORLD_SEED,
        spawn: !Boolean(message.hasSpawned) ? { x: player.x, z: player.z, heading: player.heading } : null,
        players: [...players.values()].filter((p) => p.id !== id).map(publicPlayer),
        onlineCount: players.size,
        worldLeaderId,
        weather: sharedWeather,
        pirates: sharedWorldPirates,
      });
      broadcast({ type: 'player-joined', player: publicPlayer(player), onlineCount: players.size }, id);
      const corrected = resolveShipCollisions(player);
      for (const affected of corrected) {
        send(affected.ws, { type: 'state-correction', state: publicPlayer(affected) });
        broadcast({ type: 'player-update', player: publicPlayer(affected) });
      }
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
      player.name = cleanName(message.name, 'Captain');
      player.shipName = cleanName(message.shipName, player.shipName);
      broadcast({ type: 'player-update', player: publicPlayer(player) });
      return;
    }

    if (message.type === 'state') {
      Object.assign(player, normalizeState(message.state, player));
      const affected = resolveShipCollisions(player);
      if (affected.length === 0) {
        broadcast({ type: 'player-update', player: publicPlayer(player) }, joinedId);
      } else {
        for (const p of affected) {
          send(p.ws, { type: 'state-correction', state: publicPlayer(p) });
          broadcast({ type: 'player-update', player: publicPlayer(p) });
        }
      }
      return;
    }

    if (message.type === 'world-weather' && joinedId === worldLeaderId) {
      const weather = sanitizeWeather(message.state);
      if (weather) {
        sharedWeather = weather;
        broadcast({ type: 'world-weather', state: sharedWeather });
      }
      return;
    }

    if (message.type === 'world-pirates' && joinedId === worldLeaderId) {
      const list = Array.isArray(message.pirates) ? message.pirates.slice(0, 32) : [];
      sharedWorldPirates = list.filter((pirate) => pirate && typeof pirate.id === 'string' && pirate.id.length <= 100 && Number.isFinite(pirate.x) && Number.isFinite(pirate.z));
      broadcast({ type: 'world-pirates', pirates: sharedWorldPirates });
      return;
    }

    if (message.type === 'respawn-request') {
      const spawn = chooseNearbySpawn(joinedId);
      player.x = spawn.x;
      player.z = spawn.z;
      player.heading = spawn.heading;
      player.speed = 0;
      player.landed = false;
      player.lastSeen = Date.now();
      send(ws, { type: 'respawn', spawn });
      broadcast({ type: 'player-update', player: publicPlayer(player) }, joinedId);
    }
  });

  ws.on('close', () => {
    if (!joinedId) return;
    const player = players.get(joinedId);
    if (player?.ws === ws) {
      players.delete(joinedId);
      broadcast({ type: 'player-left', id: joinedId, onlineCount: players.size });
      if (worldLeaderId === joinedId) {
        worldLeaderId = null;
        promoteWorldLeader();
      }
    }
  });

  ws.on('error', () => {});
});

const heartbeatTimer = setInterval(() => {
  for (const player of players.values()) {
    if (player.ws.readyState !== WebSocket.OPEN || Date.now() - player.lastSeen > 45_000) {
      if (player.ws.readyState === WebSocket.OPEN) player.ws.terminate();
      players.delete(player.id);
      broadcast({ type: 'player-left', id: player.id, onlineCount: players.size });
      if (worldLeaderId === player.id) {
        worldLeaderId = null;
        promoteWorldLeader();
      }
    }
  }
}, 15_000);

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Infinite Ocean Survival multiplayer server listening on ${PORT}`);
});

function shutdown() {
  clearInterval(heartbeatTimer);
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
