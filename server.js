import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import pg from 'pg';

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const WORLD_SEED = 20261126;
const MAX_NAME_LENGTH = 32;
const MAX_PLAYERS = 40;

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '5mb' }));

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    })
  : null;

const memoryProfiles = new Map();
const players = new Map();
const lootedWreckSections = new Set();
let sharedWeatherType = null;

let databaseReady = Promise.resolve();
if (pool) {
  databaseReady = pool.query(`
    CREATE TABLE IF NOT EXISTS ocean_player_profiles (
      player_id TEXT PRIMARY KEY,
      save_data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `).then(() => undefined).catch((error) => {
    console.error('Could not initialise the player-profile table:', error.message);
    throw error;
  });
} else {
  console.warn('DATABASE_URL is not set. Player saves will only survive while this server process is running.');
}

function validPlayerId(value) {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{8,80}$/.test(value);
}

function cleanName(value) {
  const name = String(value || 'Unknown Captain')
    .replace(/[<>\u0000-\u001f]/g, '')
    .trim()
    .slice(0, MAX_NAME_LENGTH);
  return name || 'Unknown Captain';
}

function publicPlayer(player) {
  if (!player?.state) return null;
  return {
    id: player.id,
    name: player.name,
    x: player.state.x,
    z: player.state.z,
    heading: player.state.heading,
    speed: player.state.speed,
    landed: Boolean(player.state.landed),
    ship: player.state.ship,
  };
}

function send(socket, payload) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload));
  }
}

function broadcast(payload, exceptId = null) {
  const encoded = JSON.stringify(payload);
  for (const [id, player] of players) {
    if (id === exceptId || player.socket.readyState !== WebSocket.OPEN) continue;
    player.socket.send(encoded);
  }
}

function findSpawn() {
  const online = [...players.values()]
    .filter((player) => player.state && Date.now() - player.lastUpdate < 15_000);
  if (online.length === 0) return { x: 0, z: 0 };
  const anchor = online[Math.floor(Math.random() * online.length)].state;
  const angle = Math.random() * Math.PI * 2;
  const distance = 65 + Math.random() * 35;
  return {
    x: Math.round((anchor.x + Math.cos(angle) * distance) * 10) / 10,
    z: Math.round((anchor.z + Math.sin(angle) * distance) * 10) / 10,
  };
}

async function readProfile(id) {
  if (pool) {
    await databaseReady;
    const result = await pool.query(
      'SELECT save_data FROM ocean_player_profiles WHERE player_id = $1',
      [id]
    );
    return result.rows[0]?.save_data ?? null;
  }
  return memoryProfiles.get(id) ?? null;
}

async function writeProfile(id, save) {
  const safeSave = structuredClone(save);
  safeSave.seed = WORLD_SEED;
  if (pool) {
    await databaseReady;
    await pool.query(
      `INSERT INTO ocean_player_profiles (player_id, save_data, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (player_id) DO UPDATE
       SET save_data = EXCLUDED.save_data, updated_at = NOW()`,
      [id, JSON.stringify(safeSave)]
    );
  } else {
    memoryProfiles.set(id, safeSave);
  }
}

app.get('/health', async (_req, res) => {
  try {
    if (pool) {
      await databaseReady;
      await pool.query('SELECT 1');
    }
    res.json({ ok: true, multiplayer: true, persistence: Boolean(pool) });
  } catch (error) {
    console.error('Health check failed:', error.message);
    res.status(503).json({ ok: false, multiplayer: true, persistence: false });
  }
});

app.get('/api/profile/:id', async (req, res) => {
  const id = req.params.id;
  if (!validPlayerId(id)) return res.status(400).json({ error: 'Invalid player id.' });
  try {
    const save = await readProfile(id);
    if (save) save.seed = WORLD_SEED;
    return res.json({ save, worldSeed: WORLD_SEED });
  } catch (error) {
    console.error('Profile read failed:', error.message);
    return res.status(503).json({ error: 'Player storage is unavailable.' });
  }
});

app.post('/api/profile/:id', async (req, res) => {
  const id = req.params.id;
  const save = req.body?.save;
  if (!validPlayerId(id)) return res.status(400).json({ error: 'Invalid player id.' });
  if (!save || typeof save !== 'object' || !save.player || !save.player.upgrades) {
    return res.status(400).json({ error: 'A valid voyage save is required.' });
  }
  try {
    await writeProfile(id, save);
    return res.json({ ok: true, worldSeed: WORLD_SEED });
  } catch (error) {
    console.error('Profile write failed:', error.message);
    return res.status(503).json({ error: 'Could not save this voyage.' });
  }
});

app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found.' });
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 256 * 1024 });

wss.on('connection', (socket, request) => {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  const id = url.searchParams.get('id');
  if (!validPlayerId(id) || players.size >= MAX_PLAYERS || players.has(id)) {
    send(socket, { type: 'error', message: 'Could not join the ocean. Refresh and try again.' });
    socket.close(1008, 'Invalid or duplicate player session');
    return;
  }

  const spawn = findSpawn();
  const player = {
    id,
    name: 'Unknown Captain',
    socket,
    state: null,
    lastUpdate: Date.now(),
    isAlive: true,
    broadside: false,
    lastCombatAt: 0,
  };
  players.set(id, player);

  send(socket, {
    type: 'welcome',
    playerId: id,
    spawn,
    players: [...players.values()].filter((other) => other.id !== id).map(publicPlayer).filter(Boolean),
    worldSeed: WORLD_SEED,
    weatherType: sharedWeatherType,
  });

  socket.on('pong', () => {
    player.isAlive = true;
  });

  socket.on('message', (raw) => {
    let message;
    try {
      message = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (!message || typeof message !== 'object') return;

    if (message.type === 'leave') {
      player.state = null;
      player.name = 'Unknown Captain';
      broadcast({ type: 'player_left', playerId: id }, id);
      return;
    }

    if (message.type === 'state') {
      const incoming = message.state;
      if (!incoming || !Number.isFinite(incoming.x) || !Number.isFinite(incoming.z)) return;
      if (!Number.isFinite(incoming.heading) || !Number.isFinite(incoming.speed)) return;

      player.name = cleanName(incoming.name);
      player.state = {
        x: Math.max(-10_000_000, Math.min(10_000_000, incoming.x)),
        z: Math.max(-10_000_000, Math.min(10_000_000, incoming.z)),
        heading: incoming.heading,
        speed: Math.max(-100, Math.min(100, incoming.speed)),
        landed: Boolean(incoming.landed),
        ship: incoming.ship && typeof incoming.ship === 'object' ? incoming.ship : null,
      };
      player.lastUpdate = Date.now();
      if (!sharedWeatherType && typeof incoming.weatherType === 'string') sharedWeatherType = incoming.weatherType;
      if (sharedWeatherType) send(socket, { type: 'world_weather', weatherType: sharedWeatherType });
      broadcast({ type: 'player_update', player: publicPlayer(player) }, id);
      return;
    }

    if (message.type === 'action') {
      const action = message.action || {};
      const targetId = String(action.targetId || '');
      const target = players.get(targetId);
      if (!target || !target.state || !player.state || targetId === id) return;
      const distance = Math.hypot(target.state.x - player.state.x, target.state.z - player.state.z);
      const now = Date.now();
      if (action.kind === 'wreck_section_looted') {
        const wreckId = String(action.wreckId || '').slice(0, 160);
        const sectionId = String(action.sectionId || '').slice(0, 160);
        if (!wreckId || !sectionId) return;
        const key = `${WORLD_SEED}:${wreckId}:${sectionId}`;
        if (lootedWreckSections.has(key)) {
          send(socket, { type: 'wreck_section_looted', wreckId, sectionId, alreadyLooted: true });
          return;
        }
        lootedWreckSections.add(key);
        broadcast({ type: 'wreck_section_looted', wreckId, sectionId, looterId: id, looterName: player.name }, null);
        return;
      }
      if (action.kind === 'set_shared_weather') {
        const allowed = new Set(['calm','clear','light_winds','strong_winds','light_rain','heavy_rain','hail','severe_hail','snow','blizzard','thunderstorm','lightning_storm','hurricane','tornado','dense_fog','heatwave']);
        const weatherType = String(action.weatherType || '');
        if (!allowed.has(weatherType)) return;
        sharedWeatherType = weatherType;
        broadcast({ type: 'world_weather', weatherType, changedBy: player.name });
        return;
      }
      if (action.kind === 'broadside') {
        if (distance > 320 || player.state.landed || target.state.landed) return;
        player.broadside = Boolean(action.enabled);
        send(socket, { type: 'pvp_event', event: 'broadside', targetId, enabled: player.broadside });
      } else if (action.kind === 'island_shot') {
        if (distance > 115 || !player.state.landed || !target.state.landed || now - player.lastCombatAt < 1200) return;
        player.lastCombatAt = now;
        send(target.socket, { type: 'pvp_event', event: 'island_shot', attackerId: id, attackerName: player.name, damage: 7 + Math.floor(Math.random() * 7) });
        send(socket, { type: 'pvp_event', event: 'shot_fired', targetId });
      } else if (action.kind === 'trade_offer') {
        if (distance > 90 || player.state.landed !== target.state.landed) return;
        const offer = { fromId: id, fromName: player.name, toId: targetId, gold: Math.max(0, Math.min(100000, Math.floor(Number(action.gold) || 0))), item: String(action.item || '').slice(0, 40) };
        send(target.socket, { type: 'trade_offer', offer });
        send(socket, { type: 'trade_result', status: 'sent', message: `Trade offer sent to ${target.name}.` });
      } else if (action.kind === 'trade_response') {
        const offer = action.offer;
        if (!offer || offer.toId !== id || offer.fromId !== targetId || distance > 90) return;
        if (action.accept) {
          void (async () => {
            try {
              const [fromSave, toSave] = await Promise.all([readProfile(targetId), readProfile(id)]);
              if (!fromSave?.player || !toSave?.player || Number(fromSave.player.gold || 0) < offer.gold) {
                send(socket, { type: 'trade_result', status: 'failed', message: 'Trade failed: the other captain no longer has enough saved gold.' });
                send(target.socket, { type: 'trade_result', status: 'failed', message: 'Trade failed: insufficient gold.' });
                return;
              }
              fromSave.player.gold = Math.max(0, Number(fromSave.player.gold || 0) - offer.gold);
              toSave.player.gold = Math.max(0, Number(toSave.player.gold || 0) + offer.gold);
              await Promise.all([writeProfile(targetId, fromSave), writeProfile(id, toSave)]);
              send(socket, { type: 'trade_result', status: 'accepted', message: `Trade complete: ${offer.gold} gold received from ${target.name}.`, goldDelta: offer.gold });
              send(target.socket, { type: 'trade_result', status: 'accepted', message: `Trade complete: ${offer.gold} gold sent to ${player.name}.`, goldDelta: -offer.gold });
            } catch (error) {
              console.error('Player trade failed:', error.message);
              send(socket, { type: 'trade_result', status: 'failed', message: 'Trade could not be completed. Try again.' });
            }
          })();
        } else {
          send(target.socket, { type: 'trade_result', status: 'declined', message: `${player.name} declined your trade offer.` });
          send(socket, { type: 'trade_result', status: 'declined', message: `You declined the trade with ${target.name}.` });
        }
      } else if (action.kind === 'ram') {
        if (distance > 24 || player.state.landed || target.state.landed || now - player.lastCombatAt < 1800) return;
        player.lastCombatAt = now;
        const damage = Math.max(4, Math.min(18, Math.round(Math.abs(player.state.speed) * 1.4)));
        send(target.socket, { type: 'pvp_event', event: 'rammed', attackerId: id, attackerName: player.name, damage });
        send(socket, { type: 'pvp_event', event: 'ram_hit', targetId });
      }
      return;
    }

    if (message.type === 'ping') {
      send(socket, { type: 'pong', at: Date.now() });
    }
  });

  socket.on('close', () => {
    const wasPresent = players.delete(id);
    if (wasPresent) broadcast({ type: 'player_left', playerId: id });
  });

  socket.on('error', (error) => {
    console.error(`WebSocket error for ${id}:`, error.message);
  });
});

const stalePlayerCheck = setInterval(() => {
  const now = Date.now();
  const activePlayers = [...players.values()].filter((p) => p.state && !p.state.landed);
  for (let i = 0; i < activePlayers.length; i++) {
    for (let j = i + 1; j < activePlayers.length; j++) {
      const a = activePlayers[i], b = activePlayers[j];
      const distance = Math.hypot(a.state.x - b.state.x, a.state.z - b.state.z);
      if (distance < 16 && Math.abs(a.state.speed) > 3 && Math.abs(b.state.speed) > 3 && now - Math.max(a.lastCombatAt, b.lastCombatAt) > 2200) {
        a.lastCombatAt = b.lastCombatAt = now;
        const da = Math.max(5, Math.min(16, Math.round(Math.abs(b.state.speed) * 1.1)));
        const db = Math.max(5, Math.min(16, Math.round(Math.abs(a.state.speed) * 1.1)));
        send(a.socket, { type: 'pvp_event', event: 'rammed', attackerName: b.name, damage: da });
        send(b.socket, { type: 'pvp_event', event: 'rammed', attackerName: a.name, damage: db });
      }
    }
  }
  for (const [id, attacker] of players) {
    if (!attacker.broadside || !attacker.state || now - attacker.lastCombatAt < 1100) continue;
    const target = [...players.values()].find((p) => p.id !== id && p.state && !p.state.landed && !attacker.state.landed && Math.hypot(p.state.x - attacker.state.x, p.state.z - attacker.state.z) <= 320);
    if (!target) continue;
    attacker.lastCombatAt = now;
    const damage = 3 + Math.floor(Math.random() * 5);
    send(target.socket, { type: 'pvp_event', event: 'broadside_hit', attackerId: id, attackerName: attacker.name, damage });
    send(attacker.socket, { type: 'pvp_event', event: 'broadside_hit', attackerId: target.id, attackerName: target.name, damage: 2 + Math.floor(Math.random() * 4) });
  }
  for (const [id, player] of players) {
    if (!player.isAlive) {
      player.socket.terminate();
      players.delete(id);
      broadcast({ type: 'player_left', playerId: id });
      continue;
    }
    if (player.socket.readyState === WebSocket.OPEN) {
      player.isAlive = false;
      player.socket.ping();
    } else if (player.socket.readyState !== WebSocket.CONNECTING) {
      const wasPresent = players.delete(id);
      if (wasPresent) broadcast({ type: 'player_left', playerId: id });
    }
  }
}, 30_000);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Infinite Ocean multiplayer server listening on ${PORT}`);
});

function shutdown() {
  clearInterval(stalePlayerCheck);
  for (const player of players.values()) player.socket.close(1001, 'Server restarting');
  server.close(() => {
    if (pool) pool.end().finally(() => process.exit(0));
    else process.exit(0);
  });
  setTimeout(() => process.exit(1), 8_000).unref();
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
