# Death and respawn rules

On any player death handled by the voyage engine (ship sinking or explorer death ashore):

- The captain's gold is set to 0.
- All carried inventory and cargo are cleared.
- Resource stores aboard support-fleet ships are also cleared.
- The player keeps their main ship, name, upgrades, crew, and other ship configuration. The hull is restored enough to allow the ship to sail again.
- On the main ship, the only emergency inventory granted is 40 Provisions and 42 Fresh Water. No other resources are granted.
- The multiplayer respawn location is still selected by the shared server near another connected captain.

The update is implemented in `src/engine/oceanScene.ts` inside `triggerPermadeath()` and `respawnAfterDeath()`.
