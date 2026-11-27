import * as THREE from 'three';
import {
  FpsWeaponId,
  FpsWeaponRuntimeState,
  IslandData,
  IslandPirateGuardData,
  SaveData,
  TreasureMapItem,
  WildlifeActorData,
} from '../game/types';
import {
  isPointInCave,
  isPointInRiver,
  sampleIslandTerrainHeight,
} from '../game/islands';
import {
  createInitialFpsWeaponState,
  FPS_WEAPON_SPECS,
  selectFpsWeapon,
  startFpsReload,
  stepFpsReload,
  fireFpsWeapon,
  isDiscoveryChestGuarded,
  WILDLIFE_SPECS,
  getGuardAttitude,
} from '../game/fpsCombat';
import { checkTreasureDigProximity } from '../game/treasure';

export interface FpsPromptCandidate {
  kind:
    | 'board_ship'
    | 'discovery'
    | 'dig_treasure'
    | 'beached_wreck'
    | 'settlement'
    | 'cave'
    | 'harvest_animal'
    | 'loot_pirate'
    | 'parley_guard';
  id: string;
  label: string;
}

/**
 * First-person camera viewmodel & ground controller for island / cave exploration and combat.
 * Renders TWO visible arms/hands holding Cutlass (1), Flintlock Pistol (2), or Musket (3).
 */
export class FirstPersonIslandController {
  public active = false;
  public island: IslandData | null = null;
  public pos = new THREE.Vector3();
  public velY = 0;
  public grounded = true;
  public yaw = 0;
  public pitch = 0;
  public playerHp = 100;
  public maxPlayerHp = 100;
  public stamina = 100;
  public inWater = false;
  public insideCave = false;
  public pointerLocked = false;
  public statusBanner: string | null = null;
  public statusTimer = 0;
  public weapons: FpsWeaponRuntimeState = createInitialFpsWeaponState();

  public viewRoot = new THREE.Group();
  private leftArm!: THREE.Group;
  private rightArm!: THREE.Group;
  private cutlassMesh!: THREE.Group;
  private pistolMesh!: THREE.Group;
  private musketMesh!: THREE.Group;

  private swingAnim = 0;
  private recoilAnim = 0;
  private walkBobPhase = 0;
  private footstepAccum = 0;

  constructor() {
    this.buildFirstPersonRig();
    this.viewRoot.visible = false;
  }

  private buildFirstPersonRig(): void {
    const coatMat = new THREE.MeshStandardMaterial({ color: 0x3b4d5e, roughness: 0.78 });
    const cuffMat = new THREE.MeshStandardMaterial({ color: 0xc2b28a, roughness: 0.85 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xd9ae87, roughness: 0.72 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x5c3a21, roughness: 0.8 });
    const brassMat = new THREE.MeshStandardMaterial({ color: 0xd4a44d, roughness: 0.25, metalness: 0.85 });
    const ironMat = new THREE.MeshStandardMaterial({ color: 0x2c3038, roughness: 0.42, metalness: 0.82 });

    // Left arm (off-hand / steadying hand)
    this.leftArm = new THREE.Group();
    const lSleeve = new THREE.Mesh(new THREE.BoxGeometry(0.105, 0.105, 0.28), coatMat);
    lSleeve.position.set(0, 0, 0.08);
    this.leftArm.add(lSleeve);
    const lCuff = new THREE.Mesh(new THREE.BoxGeometry(0.118, 0.118, 0.06), cuffMat);
    lCuff.position.set(0, 0, -0.05);
    this.leftArm.add(lCuff);
    const lHand = new THREE.Mesh(new THREE.SphereGeometry(0.062, 8, 8), skinMat);
    lHand.position.set(0, 0, -0.11);
    this.leftArm.add(lHand);
    this.leftArm.position.set(-0.28, -0.25, -0.56);
    this.viewRoot.add(this.leftArm);

    // Right arm (weapon hand)
    this.rightArm = new THREE.Group();
    const rSleeve = new THREE.Mesh(new THREE.BoxGeometry(0.105, 0.105, 0.28), coatMat);
    rSleeve.position.set(0, 0, 0.08);
    this.rightArm.add(rSleeve);
    const rCuff = new THREE.Mesh(new THREE.BoxGeometry(0.118, 0.118, 0.06), cuffMat);
    rCuff.position.set(0, 0, -0.05);
    this.rightArm.add(rCuff);
    const rHand = new THREE.Mesh(new THREE.SphereGeometry(0.062, 8, 8), skinMat);
    rHand.position.set(0, 0, -0.11);
    this.rightArm.add(rHand);
    this.rightArm.position.set(0.28, -0.24, -0.55);
    this.viewRoot.add(this.rightArm);

    // Weapon 1: Sailor Cutlass
    this.cutlassMesh = new THREE.Group();
    const cGrip = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.028, 0.16, 8), woodMat);
    this.cutlassMesh.add(cGrip);
    const cGuard = new THREE.Mesh(new THREE.TorusGeometry(0.065, 0.015, 6, 12, Math.PI), brassMat);
    cGuard.position.set(0, 0.02, -0.03);
    cGuard.rotation.y = Math.PI / 2;
    this.cutlassMesh.add(cGuard);
    const cBlade = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.56, 0.065), ironMat);
    cBlade.position.set(0, 0.32, -0.02);
    cBlade.rotation.x = 0.08;
    this.cutlassMesh.add(cBlade);
    this.cutlassMesh.position.set(0, 0.03, -0.16);
    this.cutlassMesh.rotation.set(-0.55, 0.12, -0.08);
    this.rightArm.add(this.cutlassMesh);

    // Weapon 2: Flintlock Pistol
    this.pistolMesh = new THREE.Group();
    const pGrip = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.15, 0.065), woodMat);
    pGrip.rotation.x = 0.42;
    pGrip.position.set(0, -0.04, 0.02);
    this.pistolMesh.add(pGrip);
    const pStock = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.06, 0.28), woodMat);
    pStock.position.set(0, 0.02, -0.12);
    this.pistolMesh.add(pStock);
    const pBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.024, 0.34, 8), ironMat);
    pBarrel.rotation.x = Math.PI / 2;
    pBarrel.position.set(0, 0.052, -0.16);
    this.pistolMesh.add(pBarrel);
    const pLock = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.09), brassMat);
    pLock.position.set(0.01, 0.04, -0.05);
    this.pistolMesh.add(pLock);
    this.pistolMesh.position.set(0, 0.03, -0.15);
    this.rightArm.add(this.pistolMesh);

    // Weapon 3: Sea-Service Musket (two-handed silhouette)
    this.musketMesh = new THREE.Group();
    const mStock = new THREE.Mesh(new THREE.BoxGeometry(0.056, 0.075, 0.72), woodMat);
    mStock.position.set(-0.04, 0.01, -0.28);
    this.musketMesh.add(mStock);
    const mBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.026, 0.78, 8), ironMat);
    mBarrel.rotation.x = Math.PI / 2;
    mBarrel.position.set(-0.04, 0.055, -0.34);
    this.musketMesh.add(mBarrel);
    const mLock = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.045, 0.11), brassMat);
    mLock.position.set(-0.02, 0.04, -0.08);
    this.musketMesh.add(mLock);
    this.musketMesh.position.set(-0.04, 0.02, -0.12);
    this.rightArm.add(this.musketMesh);

    this.syncWeaponMeshes();
  }

  public syncWeaponMeshes(): void {
    const w = this.weapons.activeWeapon;
    this.cutlassMesh.visible = w === 'cutlass';
    this.pistolMesh.visible = w === 'pistol';
    this.musketMesh.visible = w === 'musket';
  }

  public enterIsland(island: IslandData, spawnX: number, spawnZ: number, shipHeading: number): void {
    this.active = true;
    this.island = island;
    const gy = Math.max(0.5, sampleIslandTerrainHeight(island, spawnX, spawnZ));
    this.pos.set(spawnX, gy, spawnZ);
    this.velY = 0;
    this.grounded = true;
    this.yaw = Math.atan2(island.x - spawnX, island.z - spawnZ) + Math.PI;
    if (!Number.isFinite(this.yaw)) this.yaw = shipHeading;
    this.pitch = -0.05;
    this.playerHp = 100;
    this.stamina = 100;
    this.statusBanner = `Landed on ${island.name} — Explore with WASD · Weapons [1/2/3] · [E] Interact`;
    this.statusTimer = 5.0;
    this.viewRoot.visible = true;
    this.syncWeaponMeshes();
  }

  public exitIsland(): void {
    this.active = false;
    this.island = null;
    this.viewRoot.visible = false;
    this.weapons.isReloading = false;
    this.weapons.isBlocking = false;
    if (document.pointerLockElement) {
      document.exitPointerLock?.();
    }
    this.pointerLocked = false;
  }

  public switchWeapon(w: FpsWeaponId): void {
    this.weapons = selectFpsWeapon(this.weapons, w);
    this.syncWeaponMeshes();
    const spec = FPS_WEAPON_SPECS[w];
    const loadedNote =
      w === 'pistol'
        ? this.weapons.pistolLoaded
          ? 'Loaded'
          : 'Unloaded (Press R)'
        : w === 'musket'
          ? this.weapons.musketLoaded
            ? 'Loaded'
            : 'Unloaded (Press R)'
          : 'Ready';
    this.setStatus(`${spec.name} — ${loadedNote}`);
  }

  public triggerReload(save: SaveData): boolean {
    const res = startFpsReload(this.weapons, save.player.inventory);
    this.weapons = res.state;
    if (!res.started && res.reason) {
      this.setStatus(res.reason);
      return false;
    }
    if (res.started) {
      this.setStatus(`Reloading ${FPS_WEAPON_SPECS[this.weapons.activeWeapon].name}...`);
      return true;
    }
    return false;
  }

  public triggerAttack(
    wildlife: Iterable<WildlifeActorData>,
    pirateGuards: Iterable<IslandPirateGuardData> = []
  ): {
    fired: boolean;
    needsReload: boolean;
    weapon: FpsWeaponId;
    hitActor: WildlifeActorData | null;
    hitGuard: IslandPirateGuardData | null;
    damage: number;
  } {
    const shot = fireFpsWeapon(this.weapons);
    this.weapons = shot.state;
    if (!shot.fired) {
      if (shot.needsReload) {
        this.setStatus(`${FPS_WEAPON_SPECS[shot.weapon].name} empty — Press [R] to reload`);
      }
      return {
        fired: false,
        needsReload: shot.needsReload,
        weapon: shot.weapon,
        hitActor: null,
        hitGuard: null,
        damage: 0,
      };
    }

    if (shot.weapon === 'cutlass') {
      this.swingAnim = 1.0;
    } else {
      this.recoilAnim = 1.0;
    }

    // Cone/Ray hit check from eye direction against island wildlife & pirate guards
    const eyeY = this.pos.y + 1.68;
    const fwdX = -Math.sin(this.yaw) * Math.cos(this.pitch);
    const fwdY = Math.sin(this.pitch);
    const fwdZ = -Math.cos(this.yaw) * Math.cos(this.pitch);

    let bestHit: WildlifeActorData | null = null;
    let bestGuard: IslandPirateGuardData | null = null;
    let bestDist = shot.range;
    const minDot = shot.weapon === 'cutlass' ? 0.52 : 0.92;

    for (const actor of wildlife) {
      if (actor.dead) continue;
      const dx = actor.x - this.pos.x;
      const dy = actor.y + 0.65 - eyeY;
      const dz = actor.z - this.pos.z;
      const dist = Math.hypot(dx, dy, dz);
      if (dist > bestDist || dist < 0.05) continue;
      const dot = (dx * fwdX + dy * fwdY + dz * fwdZ) / dist;
      if (dot >= minDot) {
        bestDist = dist;
        bestHit = actor;
        bestGuard = null;
      }
    }

    for (const guard of pirateGuards) {
      if (guard.dead) continue;
      const dx = guard.x - this.pos.x;
      const dy = guard.y + 1.05 - eyeY;
      const dz = guard.z - this.pos.z;
      const dist = Math.hypot(dx, dy, dz);
      if (dist > bestDist || dist < 0.05) continue;
      const dot = (dx * fwdX + dy * fwdY + dz * fwdZ) / dist;
      if (dot >= minDot) {
        bestDist = dist;
        bestGuard = guard;
        bestHit = null;
      }
    }

    return {
      fired: true,
      needsReload: false,
      weapon: shot.weapon,
      hitActor: bestHit,
      hitGuard: bestGuard,
      damage: shot.damage,
    };
  }

  public setBlocking(blocking: boolean): void {
    this.weapons.isBlocking = this.weapons.activeWeapon === 'cutlass' && blocking;
  }

  public setStatus(msg: string): void {
    this.statusBanner = msg;
    this.statusTimer = 2.8;
  }

  public update(
    dt: number,
    keys: Set<string>,
    save: SaveData,
    activeSim: boolean,
    onFootstep: () => void,
    onReloadComplete: () => void
  ): void {
    if (!this.active || !this.island) return;

    if (this.statusTimer > 0) {
      this.statusTimer -= dt;
      if (this.statusTimer <= 0) this.statusBanner = null;
    }

    this.swingAnim = Math.max(0, this.swingAnim - dt * 4.2);
    this.recoilAnim = Math.max(0, this.recoilAnim - dt * 5.2);

    const relStep = stepFpsReload(this.weapons, dt, save.player.inventory);
    this.weapons = relStep.state;
    if (relStep.finishedWeapon) {
      onReloadComplete();
      this.setStatus(`${FPS_WEAPON_SPECS[relStep.finishedWeapon].name} loaded and primed!`);
    }

    if (activeSim) {
      const forward = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
      const strafe = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);

      const sprinting = (keys.has('ShiftLeft') || keys.has('ShiftRight')) && this.stamina > 5 && forward > 0;
      const moveSpeed = this.inWater ? 4.4 : sprinting ? 9.6 : 6.2;

      if (sprinting && (forward !== 0 || strafe !== 0)) {
        this.stamina = Math.max(0, this.stamina - dt * 22);
      } else {
        this.stamina = Math.min(100, this.stamina + dt * 16);
      }

      const fwdX = -Math.sin(this.yaw);
      const fwdZ = -Math.cos(this.yaw);
      const rightX = Math.cos(this.yaw);
      const rightZ = -Math.sin(this.yaw);

      let mx = fwdX * forward + rightX * strafe;
      let mz = fwdZ * forward + rightZ * strafe;
      const mLen = Math.hypot(mx, mz);
      if (mLen > 0.001) {
        mx = (mx / mLen) * moveSpeed;
        mz = (mz / mLen) * moveSpeed;
        this.walkBobPhase += dt * (sprinting ? 13 : 9);
        this.footstepAccum += dt * (sprinting ? 2.4 : 1.7);
        if (this.footstepAccum >= 1 && this.grounded && !this.inWater) {
          this.footstepAccum = 0;
          onFootstep();
        }
      }

      const nextX = this.pos.x + mx * dt;
      const nextZ = this.pos.z + mz * dt;
      const maxExploreRadius = this.island.radius * 1.18;
      if (Math.hypot(nextX - this.island.x, nextZ - this.island.z) <= maxExploreRadius) {
        this.pos.x = nextX;
        this.pos.z = nextZ;
      }

      const groundY = sampleIslandTerrainHeight(this.island, this.pos.x, this.pos.z);
      this.insideCave = isPointInCave(this.island, this.pos.x, this.pos.z);
      this.inWater = groundY < 0.08 || isPointInRiver(this.island, this.pos.x, this.pos.z);

      if (keys.has('Space') && this.grounded) {
        this.velY = 6.2;
        this.grounded = false;
      }

      this.velY -= 16.5 * dt;
      this.pos.y += this.velY * dt;
      const floorY = Math.max(-0.45, groundY);
      if (this.pos.y <= floorY) {
        this.pos.y = floorY;
        this.velY = 0;
        this.grounded = true;
      }
    }

    // Animate dual first-person arms & active historical weapon
    const bobY = Math.sin(this.walkBobPhase) * 0.016;
    const bobX = Math.cos(this.walkBobPhase * 0.5) * 0.014;
    const reloadDip = this.weapons.isReloading ? -0.04 : 0;
    const blockRaise = this.weapons.isBlocking ? 0.14 : 0;

    this.rightArm.position.set(
      0.27 + bobX - (this.weapons.isBlocking ? 0.12 : 0) - (this.weapons.isReloading ? 0.06 : 0),
      -0.23 + bobY + reloadDip + blockRaise + this.recoilAnim * 0.04,
      -0.55 + this.recoilAnim * 0.07
    );
    this.rightArm.rotation.set(
      this.swingAnim * -1.15 + this.recoilAnim * 0.35 + (this.weapons.isReloading ? 0.25 : 0),
      this.swingAnim * 0.6 + (this.weapons.isBlocking ? 0.45 : 0) + (this.weapons.isReloading ? 0.38 : 0),
      this.swingAnim * 0.5 + (this.weapons.isBlocking ? 0.55 : 0) + (this.weapons.isReloading ? 0.24 : 0)
    );

    const isTwoHanded = this.weapons.activeWeapon === 'musket';
    this.leftArm.position.set(
      (isTwoHanded ? -0.06 : -0.27) + bobX * 0.8 + (this.weapons.isReloading ? 0.1 : 0),
      (isTwoHanded ? -0.23 : -0.25) + bobY + (this.weapons.isReloading ? 0.02 : 0),
      isTwoHanded ? -0.66 : -0.56
    );
    this.leftArm.rotation.set(
      isTwoHanded ? 0.2 : 0,
      (isTwoHanded ? -0.45 : 0.1) + (this.weapons.isReloading ? -0.35 : 0),
      0
    );
  }

  public syncCameraTransform(camera: THREE.PerspectiveCamera): void {
    camera.position.set(this.pos.x, this.pos.y + 1.72, this.pos.z);
    camera.rotation.order = 'YXZ';
    camera.rotation.y = this.yaw;
    camera.rotation.x = this.pitch;
    camera.rotation.z = 0;

    // Place viewmodel in front of camera
    this.viewRoot.position.copy(camera.position);
    this.viewRoot.rotation.copy(camera.rotation);
  }

  public findPromptCandidate(
    save: SaveData,
    shipPos: { x: number; z: number },
    wildlife: Iterable<WildlifeActorData>,
    pirateGuards: Iterable<IslandPirateGuardData> = []
  ): FpsPromptCandidate | null {
    if (!this.island) return null;

    // 1. Dig treasure X spot if close
    const digSpot = checkTreasureDigProximity(save.treasureMaps, this.island.id, this.pos.x, this.pos.z, 9.0);
    if (digSpot) {
      return {
        kind: 'dig_treasure',
        id: digSpot.id,
        label: `[E] Dig Buried Treasure (${digSpot.title})`,
      };
    }

    // 2. Island discoveries (including guarded pirate chests)
    for (const disc of this.island.discoveries) {
      if (disc.collected) continue;
      if (Math.hypot(disc.worldX - this.pos.x, disc.worldZ - this.pos.z) < 5.5) {
        const guardCheck = isDiscoveryChestGuarded(disc, pirateGuards);
        return {
          kind: 'discovery',
          id: disc.id,
          label: guardCheck.guarded
            ? `Guarded Chest — Defeat ${guardCheck.remainingCount} Guard${guardCheck.remainingCount > 1 ? 's' : ''} First`
            : disc.requiresDig
              ? `[E] Dig ${disc.name}`
              : `[E] Open ${disc.name}`,
        };
      }
    }

    // 3. Beached coastal wrecks
    for (const bw of this.island.beachedWrecks) {
      if (bw.searched) continue;
      if (Math.hypot(bw.worldX - this.pos.x, bw.worldZ - this.pos.z) < 7.5) {
        return {
          kind: 'beached_wreck',
          id: bw.id,
          label: `[E] Salvage ${bw.name}`,
        };
      }
    }

    // 4. Settlement trading plaza
    if (this.island.settlement) {
      const st = this.island.settlement;
      if (Math.hypot(st.worldX - this.pos.x, st.worldZ - this.pos.z) < 11) {
        return {
          kind: 'settlement',
          id: st.id,
          label: `[E] Enter ${st.name} (${st.kind.replace('_', ' ')})`,
        };
      }
    }

    // 4b. Parley with living, non-hostile guards (ally with a tribe / ask friendly pirates for a share)
    for (const g of pirateGuards) {
      if (g.dead) continue;
      if (Math.hypot(g.x - this.pos.x, g.z - this.pos.z) > 5.5) continue;
      const attitude = getGuardAttitude(g, save);
      if (attitude === 'hostile') continue;
      const tribeLabel = this.island.tribeName ?? 'tribe';
      let label: string;
      if (g.tribal) {
        label = attitude === 'wary'
          ? `[E] Offer a Gift & Ally with the ${tribeLabel} (+Reputation) — or attack them`
          : `[E] Ask the ${tribeLabel} to share their treasure`;
      } else {
        label = `[E] Parley with ${g.name} — ask for a share of the treasure`;
      }
      return { kind: 'parley_guard', id: g.id, label };
    }

    // 5. Loot defeated pirate guards
    for (const g of pirateGuards) {
      if (!g.dead || g.looted) continue;
      if (Math.hypot(g.x - this.pos.x, g.z - this.pos.z) < 4.5) {
        return {
          kind: 'loot_pirate',
          id: g.id,
          label: `[E] Loot ${g.name}`,
        };
      }
    }

    // 6. Harvest downed wildlife
    for (const w of wildlife) {
      if (!w.dead || w.harvested) continue;
      if (Math.hypot(w.x - this.pos.x, w.z - this.pos.z) < 4.5) {
        return {
          kind: 'harvest_animal',
          id: w.id,
          label: `[E] Harvest ${WILDLIFE_SPECS[w.species].label}`,
        };
      }
    }

    // 7. Return to anchored ship / pier
    const dDock = Math.hypot(this.island.dockX - this.pos.x, this.island.dockZ - this.pos.z);
    const dShip = Math.hypot(shipPos.x - this.pos.x, shipPos.z - this.pos.z);
    if (dDock < 14 || dShip < 20) {
      return {
        kind: 'board_ship',
        id: 'board_ship',
        label: `[E] Board ${save.player.shipName}`,
      };
    }

    return null;
  }
}

export function getTreasureHintForIsland(
  maps: TreasureMapItem[] | undefined,
  islandId: string,
  playerX: number,
  playerZ: number
): string | null {
  if (!maps) return null;
  const active = maps.find((m) => !m.found && m.islandId === islandId);
  if (!active) return null;
  const dist = Math.round(Math.hypot(active.targetX - playerX, active.targetZ - playerZ));
  return `${active.title}: ${dist}m away (${active.clueText})`;
}
