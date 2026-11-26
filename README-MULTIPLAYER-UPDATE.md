# Multiplayer world and collision update

This version improves the shared ocean multiplayer layer:

- Player ships now collide through server-resolved hull separation. The server sends position corrections to both affected captains.
- Nearby connected-player regions are streamed from the same server-provided world seed, so islands and standard chunk-based NPC pirate encounters appear in matching locations for nearby players.
- The server elects one world authority. That client publishes the shared weather and tornado state, and its dynamic pirate hunter spawns are sent to the server and replicated to everyone.
- Each client's local NPC simulation keeps the game responsive and makes hostile pirates engage the local player's ship; the common world seed and shared region streaming ensure nearby captains encounter those same standard NPC locations.

Render deployment remains one Node web service with:

- Build command: `npm install && npm run build`
- Start command: `npm start`
- Node.js: 22
- Exactly one service instance, because the live multiplayer world authority and presence state are held in that process.

The server is authoritative for player-to-player ship collision and global weather / dynamic hunter ownership. NPC combat calculations and visual rendering are still performed by each connected game client, so this is not yet a fully authoritative MMO simulation for every NPC attack, loot drop, and damage outcome.
