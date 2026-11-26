# Infinite Ocean Survival

A browser-based ocean survival game built with React, Three.js and Vite.

## Run locally

```bash
npm install
npm run dev
```

## Run the production multiplayer server locally

```bash
npm install
npm run build
npm start
```

Then open `http://localhost:10000`. The Node server serves the built game and the WebSocket endpoint at `/multiplayer`.

## Deploy to Render

See [RENDER-MULTIPLAYER-SETUP.md](./RENDER-MULTIPLAYER-SETUP.md) for the exact GitHub and Render Web Service settings, plus the always-on plan notes.

## Multiplayer notes

This build synchronizes player ship positions and captain name tags in one shared ocean. Each player's voyage and ship save stays in that browser's local storage; the server currently stores active player presence in memory. It is a shared-player foundation, not a fully server-authoritative MMO. Player-versus-player weapon combat is not included.
