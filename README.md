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

## Player interactions (multiplayer)

- Nearby captains appear in the right-hand player panel.
- Offer a 100-gold player-to-player trade when within 90 metres. The recipient must accept; the server updates both saved profiles in PostgreSQL.
- Open broadsides against a nearby ship (within 320 metres). Active broadsides exchange recurring hull damage while both ships remain at sea and in range. Use Cease fire to stop.
- Ships travelling at speed can automatically collide and damage one another at close range. The Ram button also attempts a close-range ram.
- When both captains are ashore and close enough, use Shoot to damage the other player's ship condition as a simplified island skirmish interaction.

Player-to-player combat is handled by the multiplayer server. Ensure DATABASE_URL is configured for persistent profile saves and gold trades.

## Shared-world additions
- Wreck section loot is broadcast to all connected clients, so a section searched by one player is marked searched for the others in that running server session.
- The server holds a shared weather type; the first connected player's weather seeds it, and admin weather changes are broadcast to everyone.
- Important limitation: wreck claims and shared weather currently live in server memory, so they reset if the server restarts. NPC ship AI/positions and their combat state are not yet authoritative server entities; only player ships are synchronized. The existing game simulates NPC traffic locally, so this build does not yet guarantee every player sees identical NPC ships or NPC movements.
