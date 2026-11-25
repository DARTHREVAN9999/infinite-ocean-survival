# Infinite Ocean Survival — Render multiplayer setup

This project now serves the Vite game and its WebSocket multiplayer service from one Node web service.

## Render service settings

Create **New → Web Service**, connect the GitHub repository, and use:

| Setting | Value |
|---|---|
| Name | `infinite-ocean-survival` |
| Language | `Node` |
| Branch | `main` |
| Region | `Singapore` (keep it with your other Singapore services) |
| Root Directory | Leave blank |
| Build Command | `npm install && npm run build` |
| Start Command | `npm start` |
| Environment Variable | `NODE_ENV` = `production` |
| Health Check Path (if shown) | `/healthz` |

Do not deploy this as a Static Site: the same service must keep the WebSocket server running.

## Compute plan

- **Free** is okay for a quick test, but it is not always-on. Render may spin a free service down after 15 minutes without an incoming HTTP request or WebSocket message, and it takes time to wake up.
- To keep the server running continuously, choose a **paid web-service instance**. The $7/month 0.5 CPU / 512 MB option in the dashboard screenshot is the smallest paid option shown there. Check the current price in Render before creating it, and get permission from the account owner before selecting a paid plan.
- Keep the service at **one instance**. Do not enable multiple instances or autoscaling for this in-memory presence server. The default connection limit is 32 players; raise `MAX_PLAYERS` only after testing the service under load.

## GitHub

1. Extract this updated project ZIP.
2. Replace the files in your GitHub repository with the extracted project files.
3. Commit and push them to the `main` branch.
4. In Render, connect the `DARTHREVAN9999/infinite-ocean-survival` repository and deploy.
5. When the deploy succeeds, open the Render URL. The game and `/multiplayer` WebSocket endpoint use that same URL.

## What is shared and what is saved

- Connected players see one another's ships moving in the same ocean coordinates, with a `PLAYER` name tag above each ship.
- A first-time browser join and a respawn are placed near another currently connected player. When nobody else is online, the spawn is the world start point.
- The server provides one shared world-generation seed so new and returning clients generate the same island layout.
- Your voyage save, ship, upgrades, crew, cargo, and discoveries remain saved in that browser. The server currently stores live player presence in memory only; it does not provide cross-device accounts or permanent cloud backups.
- If Render restarts or redeploys the service, players reconnect. Browser saves remain on their own devices.

## Current multiplayer scope

This build includes shared player ships and identity/name tags, nearby spawning, and the gold-only death penalty while retaining the ship and other voyage items. Other players are visible in the shared world; player-versus-player weapon combat is not part of this build.

## Health check

After deployment, visit `https://YOUR-SERVICE.onrender.com/healthz`. A healthy response includes `"ok":true` and the current online-player count.
