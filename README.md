# Infinite Ocean Survival — Multiplayer build

This version runs the game and its multiplayer WebSocket endpoint from one Node.js web service.

## Multiplayer behaviour

- Online captains' ships are shown in the same generated ocean, with a `PLAYER` label and the captain's ship name above each ship.
- New players are placed near an online captain when one is already connected. After a death, the captain keeps their ship, upgrades, crew, cargo, supplies and fleet, loses their gold, and respawns near the closest connected player.
- While the player is exploring an island, sea traffic and pirates continue moving, but pirate AI is prevented from targeting the landed ship.
- Each browser keeps its own game simulation. The multiplayer server shares live player-ship positions and saves individual profiles; it does not yet run one authoritative simulation for all NPC ships, weather, treasure or island events.
- Other captains' ships are currently visible multiplayer ships. Player-to-player ship weapon combat is not included in this build.

## Run locally

Requires Node.js 22 or later.

```bash
npm install
npm run build
npm start
```

Open `http://localhost:3000`. For persistent profiles, set `DATABASE_URL` to a PostgreSQL connection string before starting the server. Without it, profiles are kept in server memory only and are lost when the server restarts.

## Deploy on Render

Create **one Web Service**, not a Static Site:

| Render setting | Value |
| --- | --- |
| Name | `infinite-ocean-survival` |
| Language | `Node` |
| Branch | `main` |
| Region | `Singapore` |
| Root Directory | Leave blank |
| Build Command | `npm install && npm run build` |
| Start Command | `npm start` |
| Instance | Paid `0.5 CPU / 512 MB` plan for an always-on service |

Create a Render PostgreSQL database in **Singapore** as well, and choose the smallest **paid 256 MB** database plan (currently US$6/month). Create the database first, then copy its **Internal Database URL** into the web service's Environment Variables as:

- Key: `DATABASE_URL`
- Value: the database's Internal Database URL

Keep the web service and database in the same region. Do not commit the database URL or any other secret to GitHub. No persistent disk is needed because player profiles are stored in PostgreSQL.

The free web-service plan sleeps after 15 minutes without inbound traffic, and its local filesystem is temporary. It therefore does not meet the always-running requirement. The free PostgreSQL database is also not suitable for permanent game saves. A paid web instance and paid PostgreSQL database are needed for the requested always-on server and persistent player profiles.

## GitHub updates

Connect the repository's `main` branch to the Render Web Service. Once auto-deploy is enabled, each push to `main` triggers a new build and deploy.
