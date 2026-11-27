# Shared world: architecture & known limitations

## Architecture
- **server.js** (Express + ws): serves `dist/`, `/healthz`, and `/multiplayer`.
  - Players: position, vessel name, reputation, hull %, cannons.
  - **NPC ownership**: clients report the bot ships/pirates/monsters they simulate (`npc-batch`). The server gives each NPC to the nearest player (with hysteresis) and relays its state to everyone else. If an owner leaves or goes quiet for 6s, the next player takes over.
  - **Patches**: persistent world changes (`kind:id` → data). Merged on the server, broadcast, sent to late joiners and saved to `DATA_DIR/world.json`.
  - **Relay**: validated player-to-player messages (trade offers/responses/commits, PvP).
  - Weather: the first connected player is the "world leader"; if they leave, the next one takes over.
- **Client** (`src/network/MultiplayerClient.ts`, `OceanEngine` shared-world block):
  - Every client generates the same chunks from the same seed; the engine also streams chunks around other players.
  - A remotely-owned NPC is driven by its owner's position, but damage aimed at *you* is resolved on *your* client (pirate return fire, monster strikes, PvP volleys).
  - Local changes are diffed twice a second and published as patches; incoming patches are applied to loaded entities and to entities loaded later.
  - PvP: attacking creates an invisible stand-in "pirate" glued to the other player's ship so the normal combat UI works. When you fire at it your client tells the victim, whose client resolves the hit against their own armor. If the victim sinks, they tell the attacker, who plunders 50% of the gold they lost (max 400).

## Known limitations (honest list)
- The server trusts clients (no anti-cheat). Fine for friends, not for strangers.
- Two players harvesting/looting the same thing in the same second can both get the loot.
- Sea monsters chase the player who owns them; they can still strike any player who is near them.
- Ambient wildlife (non-monster sea animals) is not position-synced; only their harvested state is shared.
- A server restart without a persistent disk resets the shared world changes.
- Free Render instances sleep when idle.
- I could not run `npm install`/`vite build`/a browser in the environment I built this in. The code was type-checked with `tsc` (no errors in the changed code apart from missing-dependency noise) and the server logic was exercised with a simulated socket harness, but **please run `npm install && npm run build && npm start` and test with two windows** before deploying.
