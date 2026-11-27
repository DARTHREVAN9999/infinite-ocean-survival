# Infinite Ocean Survival — shared-world multiplayer

A browser ocean survival game (React + Three.js + Vite) with one shared world for every connected player.

## Run locally

```bash
npm install
npm run build
npm start          # http://localhost:10000  (game + /multiplayer WebSocket)
```
Open it in two browser windows to see two ships in the same ocean. (`npm run dev` runs the game alone, without the multiplayer server.)

## Deploy: GitHub → Render

1. Push this folder to a GitHub repo (`server.js` is now tracked — an old `.gitignore` entry used to exclude it).
2. Render → **New → Blueprint** (uses `render.yaml`), or **New → Web Service** with:
   - Build: `npm install && npm run build`
   - Start: `npm start`
   - Health check path: `/healthz`
   - Env: `NODE_ENV=production`
   - **One instance only** (do not autoscale).
3. Optional: add a persistent disk mounted at `/var/data` and set `DATA_DIR=/var/data` so the shared world survives restarts.

Free instances sleep after ~15 minutes without traffic, which disconnects everyone — use a paid instance for an always-on world.

## What is shared (one world)

| Shared by everyone | How |
|---|---|
| Islands, rocks, reefs, shipwrecks, floating crates, sea creatures, bot ships, pirates, island guards/tribes | Same world seed on every client |
| Other players, with vessel name + reputation above each ship, and on the chart (M) | Live player sync |
| Weather and tornado | One player (the "world leader") simulates it, everyone follows |
| Bot ship / pirate / monster movement | The nearest player simulates each one, the others see it move; if that player leaves, the next-nearest takes over |
| Changes: bot-ship gold & stock, hired crew, robbed/sunk ships, looted wrecks and chests, defeated pirates & monsters, harvested carcasses, settlement stock & gold, dead island guards | Saved on the server as patches, applied for everyone and for late joiners (and persisted to `DATA_DIR`) |

Still per-player (saved in each browser): your ship, gold, cargo, crew, reputation, tribe/pirate standing, treasure maps.

## Gameplay changes in this version

- Admin mode removed.
- Fishing is **F** (not E). Near a sea creature or carcass press **F**. Bigger catches (sea monsters) have a **smaller hit bar**, and every cast **costs gold** (more for big catches).
- Islands are held by pirates **or** a local tribe. Tribe: wary at first — press **E** on a tribesman to give a gift and ally (+reputation, provisions, a share of their treasure), or attack them (reputation loss, they fight back). Pirate guards are friendly if you are allied with a pirate faction or your reputation is low (they'll share the treasure); otherwise hostile.
- Press **E** near another player: **Offer Trade** (they must accept) or **Attack** (naval combat against the other player's ship).
- The captain-name option is gone: the **vessel name** is shown above your ship, with your **reputation** under it.
- Crashing into wrecks, bot ships, rocks or other players pushes you back and halts your ship (like SPACE); only fast impacts hurt.
- Enemy pirates hunt every player, not only the one that spawned them.

See `SHARED-WORLD-NOTES.md` for architecture and known limitations.
