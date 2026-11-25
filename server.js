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

const app = express();
app.disable('x-powered-by');
app.get('/healthz', (_req, res) => {
  res.json({
    ok: true,
    service: 'infinite-ocean-survival',
    onlinePlayers: players.size,
    uptimeSeconds: Math.floor((Date.now() - SERVER_STARTED_AT) / 1000),
  });
});
app.use(express.static(path.join(__dirname, 'dist'), { extensions: ['html'] }));
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer, path: '/multiplayer', maxPayload: 16 * 1024 });

// Active connections live here. Player identity and voyage saves are kept in each
// player's browser; the server only holds live presence/position data.
const players = new Map();

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
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function broadcast(payload, exceptId = null) {
  const encoded = JSON.stringify(payload);
  for (const player of players.values()) {
    if (player.id !== exceptId && player.ws.readyState === WebSocket.OPEN) {
      player.ws.send(encoded);
    }
  }
}

function chooseNearbySpawn(exceptId = null) {
  const candidates = [...players.values()].filter((p) => p.id !== exceptId);
  if (candidates.length === 0) return { x: 0, z: 0, heading: 0 };

  const anchor = candidates[Math.floor(Math.random() * candidates.length)];
  const angle = Math.random() * Math.PI * 2;
  const distance = 95 + Math.random() * 55;
  return {
    x: anchor.x + Math.cos(angle) * distance,
    z: anchor.z + Math.sin(angle) * distance,
    heading: Math.atan2(anchor.x - (anchor.x + Math.cos(angle) * distance), anchor.z - (anchor.z + Math.sin(angle) * distance)),
  };
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

wss.on('connection', (ws) => {
  let joinedId = null;

  ws.on('message', (raw) => {
    let message;
    try {
      message = JSON.parse(raw.toString());
    } catch {
      send(ws, { type: 'error', message: 'Invalid message format.' });
      return;
    }

    if (!message || typeof message.type !== 'string') return;

    if (message.type === 'join') {
      if (joinedId) return;
      const id = String(message.id || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);
      if (!id) {
        send(ws, { type: 'error', message: 'A player ID is required.' });
        ws.close(1008, 'Missing player ID');
        return;
      }

      const previousConnection = players.get(id);
      if (players.size >= MAX_PLAYERS && !previousConnection) {
        send(ws, { type: 'full', message: 'The ocean server is currently full. Try again later.' });
        ws.close(1013, 'Server full');
        return;
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

      const needsFirstSpawn = !Boolean(message.hasSpawned);
      if (needsFirstSpawn) {
        const spawn = chooseNearbySpawn(id);
        player.x = spawn.x;
        player.z = spawn.z;
        player.heading = spawn.heading;
      }

      players.set(id, player);
      joinedId = id;

      send(ws, {
        type: 'welcome',
        playerId: id,
        worldSeed: WORLD_SEED,
        spawn: needsFirstSpawn ? { x: player.x, z: player.z, heading: player.heading } : null,
        players: [...players.values()].filter((p) => p.id !== id).map(publicPlayer),
        onlineCount: players.size,
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
      player.name = cleanName(message.name, 'Captain');
      player.shipName = cleanName(message.shipName, player.shipName);
      broadcast({ type: 'player-update', player: publicPlayer(player) });
      return;
    }

    if (message.type === 'state') {
      const next = normalizeState(message.state, player);
      Object.assign(player, next);
      broadcast({ type: 'player-update', player: publicPlayer(player) }, joinedId);
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
    }
  });

  ws.on('error', () => {
    // The close handler owns cleanup. Avoid crashing the shared server on a bad client.
  });
});

// Light server heartbeat: remove dead sockets and keep the online count honest.
const heartbeatTimer = setInterval(() => {
  for (const player of players.values()) {
    if (player.ws.readyState !== WebSocket.OPEN) {
      players.delete(player.id);
      broadcast({ type: 'player-left', id: player.id, onlineCount: players.size });
      continue;
    }
    if (Date.now() - player.lastSeen > 45_000) {
      player.ws.terminate();
      players.delete(player.id);
      broadcast({ type: 'player-left', id: player.id, onlineCount: players.size });
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
