import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALL_WEATHER_TYPES,
  computeBoatBuoyancy,
  generateWeatherForecast,
  sampleWaveHeight,
  WEATHER_PRESETS,
  buildWeatherStateFromType,
} from './waveMath';
import {
  canAffordCosts,
  computeManualRepairPlan,
  createEmptyInventory,
  createRepairJob,
  createStartingInventory,
  deductCosts,
  DEFAULT_CUSTOM_FLAG,
  executeTrade,
  generateGhostShipWreck,
  generateMerchantShip,
  generateShipwreck,
  generateSunkenVesselWreck,
  getCargoCapacity,
  getCargoWeight,
  getMerchantBuyPrice,
  getMerchantSellPrice,
  HULL_UPGRADE_CATALOG,
  isValidPreChosenShipName,
  pickRandomShipName,
  PRE_CHOSEN_SHIP_NAMES,
  RESOURCE_DEFS,
  rollCrewOfferAccepted,
  VALUABLE_CARGO_IDS,
  WEAPON_LIST,
} from './economy';
import {
  computeAutoAssignRoles,
  computeCrewPerformance,
  computeShipHandling,
  computeSupplyDaysRemaining,
  getLowHealthWarnings,
  getRoleCounts,
  stepSurvivalAndRepairs,
  treatCrewMember,
} from './survival';
import {
  computePirateAI,
  computeAutoCombatStats,
  generateGhostShip,
  generatePirateShip,
  resolveEnemyVolley,
  resolveNpcVsNpcVolley,
  resolvePlayerVolley,
  resolveShipCollision,
  rollEnemySalvageable,
} from './combat';
import { generateWorldChunk, mulberry32 } from './worldGen';
import { addJournalEntry, createNewVoyage, deleteJournalEntry, loadVoyageFromStorage, updateJournalEntry } from './storage';
import {
  applyLeaderDefeatConsequences,
  createInitialFactions,
  decideInnocentReaction,
  getMerchantReputationBehavior,
  getReputationTitle,
  isPlayerPirateAligned,
  PIRATE_FACTION_IDS,
} from './factions';
import { feedSeaMonsterToTame, generateSeaMonster, shouldMonsterAttackPlayer } from './monsters';
import {
  computeFleetRecruitCost,
  computeWedgeFormationTarget,
  createFleetShip,
  createFleetShipFromDefeated,
  FLEET_CLASS_SPECS,
  getFleetUnlockStatus,
  stepFleetAutonomy,
} from './fleet';
import { applyXpToCrewMember, grantCrewRoleXp } from './survival';
import {
  createCrownFlagConfig,
  createFactionFlagConfig,
  createMerchantFlagConfig,
} from '../engine/textures';

test('wave height and buoyancy keep boat stable without flipping', () => {
  const h1 = sampleWaveHeight(0, 0, 1.5, 1.0);
  const h2 = sampleWaveHeight(12, -8, 1.5, 1.0);
  assert.equal(Number.isFinite(h1), true);
  assert.equal(Number.isFinite(h2), true);

  const stormPose = computeBoatBuoyancy(10, -25, 0.4, 5, 2, 1.0, 0.5, 6, 3.2, 2.6, 0.8);
  assert.ok(Math.abs(stormPose.pitch) <= 0.35, 'pitch clamped safely');
  assert.ok(Math.abs(stormPose.roll) <= 0.39, 'roll clamped safely');
  assert.ok(stormPose.splashIntensity >= 0 && stormPose.splashIntensity <= 1);
});

test('shipwrecks generate varying randomized gold amounts and never drop free cannon items', () => {
  const rand = mulberry32(12345);
  assert.equal('cannons' in RESOURCE_DEFS, false, 'no free cannon resource item exists');
  assert.equal('weaponComponents' in RESOURCE_DEFS, false, 'weaponComponents removed completely');
  const empty = createEmptyInventory();
  assert.equal('weaponComponents' in empty, false);
  const fishing = generateShipwreck('w1', 0, 0, 'fishing_boat', rand);
  const treasure = generateShipwreck('w2', 500, 500, 'treasure_galleon', rand);

  const fishGold = fishing.sections.reduce((s, sec) => s + sec.gold, 0);
  const treasGold = treasure.sections.reduce((s, sec) => s + sec.gold, 0);

  assert.ok(fishGold <= 26, `fishing wreck gold ${fishGold} within range`);
  assert.ok(treasGold >= 950, `treasure wreck gold ${treasGold} high`);
});

test('fishing trawlers strictly only sell food and water while blocking materials & ordnance', () => {
  const rand = mulberry32(314);
  const trawler = generateMerchantShip('fish_1', 100, 100, 'fishing_trawler', rand);
  assert.equal(trawler.isFishingTrawler, true);
  assert.ok(trawler.stock.food > 0);
  assert.ok(trawler.stock.water > 0);
  assert.equal(trawler.stock.wood, 0);
  assert.equal(trawler.stock.iron, 0);
  assert.equal(trawler.stock.gunpowder, 0);

  const inv = createStartingInventory();
  const upgrades = createNewVoyage(42).player.upgrades;

  const foodBuy = executeTrade('buy', 'food', 5, 500, inv, upgrades, trawler, 0);
  assert.equal(foodBuy.ok, true);

  const woodSellAttempt = executeTrade('sell', 'wood', 2, 500, inv, upgrades, trawler, 0);
  assert.equal(woodSellAttempt.ok, false);
});

test('merchant trading validates gold, stock, cargo space, valuable cargo anti-arbitrage, and reputation refusal', () => {
  const rand = mulberry32(99);
  const merchant = generateMerchantShip('m1', 100, 100, 'medium_merchant', rand);
  const inv = createStartingInventory();
  const upgrades = createNewVoyage(42).player.upgrades;

  assert.ok(VALUABLE_CARGO_IDS.includes('jewellery'));
  assert.ok(VALUABLE_CARGO_IDS.includes('antiques'));
  for (const vc of VALUABLE_CARGO_IDS) {
    const buyP = getMerchantBuyPrice(merchant, vc, 50);
    const sellP = getMerchantSellPrice(merchant, vc, 50);
    assert.ok(sellP < buyP, `anti-arbitrage enforced for ${vc}: sell ${sellP} < buy ${buyP}`);
  }

  const unitWood = getMerchantBuyPrice(merchant, 'wood', 0);
  const startStock = merchant.stock.wood;
  const buyRes = executeTrade('buy', 'wood', 5, 400, inv, upgrades, merchant, 0);

  assert.equal(buyRes.ok, true);
  assert.equal(buyRes.playerGold, 400 - unitWood * 5);
  assert.equal(buyRes.playerInventory.wood, inv.wood + 5);
  assert.equal(buyRes.merchantStock.wood, startStock - 5);
  assert.equal(buyRes.merchantGold, merchant.gold + unitWood * 5);

  const baseTools = getMerchantBuyPrice(merchant, 'tools', 0);
  const heroTools = getMerchantBuyPrice(merchant, 'tools', 65);
  assert.ok(heroTools < baseTools, 'positive reputation lowers merchant price');
  const outlawTrade = executeTrade('buy', 'wood', 2, 500, inv, upgrades, merchant, -75);
  assert.equal(outlawTrade.ok, false);
  assert.equal(getReputationTitle(-75), 'Feared Outlaw');
  assert.equal(getMerchantReputationBehavior(-30, true).crownHuntsPlayer, true);
  assert.equal(getMerchantReputationBehavior(85, true).canOfferCrownRepair, false, 'Crown never offers free repairs');

  const cap = getCargoCapacity(upgrades);
  assert.ok(getCargoWeight(inv) < cap);
  const tooHeavy = executeTrade('buy', 'wood', 500, 99999, inv, upgrades, {
    ...merchant,
    stock: { ...merchant.stock, wood: 500 },
  });
  assert.equal(tooHeavy.ok, false);
});

test('manual repairs only: damaged ship NEVER auto-repairs unless player starts manual repair job; heatwave drains extra water', () => {
  const voyage = createNewVoyage(777);
  assert.equal(voyage.version, 3);
  assert.equal(voyage.settings.autoJournalEnabled, true);
  assert.equal(voyage.settings.uiScale, 'large');
  assert.equal(voyage.player.crew.length, 10);

  const damagedCond = { ...voyage.player.condition, hull: 55, sails: 70, flooding: 20 };
  const startFood = voyage.player.inventory.food;
  const startWater = voyage.player.inventory.water;

  const noRepairTick = stepSurvivalAndRepairs(
    5,
    voyage.player.inventory,
    voyage.player.crew,
    damagedCond,
    voyage.player.upgrades,
    null,
    voyage.weather,
    mulberry32(88)
  );

  assert.ok(noRepairTick.inventory.food < startFood, 'food consumed');
  assert.ok(noRepairTick.inventory.water < startWater, 'water consumed');
  assert.ok(noRepairTick.condition.hull <= damagedCond.hull, 'hull must NEVER auto-repair');
  assert.equal(noRepairTick.condition.sails, 70, 'sails must NEVER auto-repair');

  // Heatwave increases water drain compared to clear skies
  const heatWeather = buildWeatherStateFromType('heatwave', 0, 60);
  const heatTick = stepSurvivalAndRepairs(
    5,
    voyage.player.inventory,
    voyage.player.crew,
    damagedCond,
    voyage.player.upgrades,
    null,
    heatWeather,
    mulberry32(88)
  );
  assert.ok(heatTick.inventory.water < noRepairTick.inventory.water, 'heatwave increases fresh water consumption');

  const plan = computeManualRepairPlan('hull', damagedCond, voyage.player.upgrades);
  assert.ok((plan.materials.wood || 0) > 0);
  const job = createRepairJob(plan);

  const manualDone = stepSurvivalAndRepairs(
    job.totalTime + 0.2,
    voyage.player.inventory,
    voyage.player.crew,
    damagedCond,
    voyage.player.upgrades,
    job,
    voyage.weather,
    mulberry32(88)
  );
  assert.equal(manualDone.condition.hull, 100, 'manual repair restores hull on completion');
  assert.equal(manualDone.activeRepairJob, null);

  const supplyDays = computeSupplyDaysRemaining(voyage.player.inventory, voyage.player.crew.length);
  assert.ok(supplyDays.foodDays > 1 && supplyDays.waterDays > 1);
});

test('crew health warnings trigger below 25 HP and clear after medical treatment; auto-assign works cleanly', () => {
  const voyage = createNewVoyage(911);
  const injuredCrew = voyage.player.crew.map((c, idx) =>
    idx === 0 ? { ...c, health: 18, condition: 'injured' as const } : c
  );
  const warnings = getLowHealthWarnings(injuredCrew);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].health, 18);

  const heal = treatCrewMember(injuredCrew, injuredCrew[0].id, voyage.player.inventory);
  assert.equal(heal.ok, true);
  assert.equal(getLowHealthWarnings(heal.crew).length, 0, 'warning clears when >= 25 HP');

  for (const mode of ['best', 'sailing', 'combat'] as const) {
    const reassigned = computeAutoAssignRoles(voyage.player.crew, mode);
    assert.equal(reassigned.length, voyage.player.crew.length);
    const counts = getRoleCounts(reassigned);
    assert.ok(counts.helmsman >= 1, `${mode} mode retains helmsman`);
    assert.ok(counts.sailor >= 1, `${mode} mode retains sailor`);
    if (mode === 'combat') assert.ok(counts.cannoneer >= 4, 'combat prioritizes cannoneers');
    if (mode === 'sailing') assert.ok(counts.sailor >= 4, 'sailing prioritizes sailors');
  }
});

test('tiers 1-7 hulls and 8 cannon classes use valid resources (zero weaponComponents)', () => {
  const voyage = createNewVoyage(321);
  assert.equal(WEAPON_LIST.length, 8);
  for (const w of WEAPON_LIST) {
    assert.equal('weaponComponents' in w.materialCost, false);
  }
  for (const fc of Object.values(FLEET_CLASS_SPECS)) {
    assert.equal('weaponComponents' in fc.resourceCost, false);
  }

  const hull2 = HULL_UPGRADE_CATALOG.find((u) => u.id === 'hull_2')!;
  assert.equal(canAffordCosts(voyage.player.gold, voyage.player.inventory, hull2.goldCost, hull2.resourceCost), false);

  const richInv = { ...voyage.player.inventory, wood: 40, iron: 20, cloth: 12 };
  assert.equal(canAffordCosts(300, richInv, hull2.goldCost, hull2.resourceCost), true);
  const deducted = deductCosts(300, richInv, hull2.goldCost, hull2.resourceCost);
  assert.equal(deducted.gold, 300 - hull2.goldCost);

  const upgraded = { ...hull2.apply(voyage.player.upgrades), hullTier: 6 };
  const perf = computeCrewPerformance(voyage.player.crew, upgraded);
  const handlingSmall = computeShipHandling(voyage.player.upgrades, voyage.player.condition, perf, voyage.weather);
  const handlingLarge = computeShipHandling(upgraded, voyage.player.condition, perf, voyage.weather);

  assert.ok(handlingLarge.stability > handlingSmall.stability, 'larger hull is more stable');
  assert.ok(handlingLarge.turnRate < handlingSmall.turnRate, 'larger hull turns slower');
  assert.ok(handlingLarge.stopDragLambda < handlingSmall.stopDragLambda, 'heavier ship takes longer to glide to stop');
});

test('10 pirate factions, simplified surrender-only combat, NPC battles, and collision physics work cleanly', () => {
  assert.equal(PIRATE_FACTION_IDS.length, 10, '10 distinct pirate factions exist');
  assert.equal(isPlayerPirateAligned(-45), true);
  assert.equal(isPlayerPirateAligned(-10), false);

  const rand = mulberry32(555);
  const pirate = generatePirateShip('p1', 0, -60, 'brigantine', rand, {
    factionId: 'obsidian_armada',
    rank: 6,
    isBoss: true,
    isFlagship: true,
  });
  assert.equal(pirate.factionId, 'obsidian_armada');
  assert.equal(pirate.rank, 6);
  assert.equal(pirate.isBoss, true);

  const voyage = createNewVoyage(555);
  voyage.player.upgrades.weaponType = 'medium';
  voyage.player.upgrades.cannonCount = 4;
  voyage.player.inventory.gunpowder = 20;
  voyage.player.inventory.cannonballs = 20;

  const atkStats = computeAutoCombatStats(voyage.player.upgrades, voyage.player.crew, 'attack');
  const volley = resolvePlayerVolley(
    voyage.player.upgrades,
    voyage.player.condition,
    voyage.player.inventory,
    atkStats.accuracyBonus,
    'hull',
    'broadside',
    60,
    pirate,
    rand,
    atkStats.effectiveCannons
  );
  assert.equal(volley.fired, true);
  assert.ok(!volley.summary.toLowerCase().includes('gold'), 'hit notification never mentions gold');

  const enemyHit = resolveEnemyVolley(
    pirate,
    60,
    voyage.player.condition,
    voyage.player.upgrades,
    voyage.player.crew,
    mulberry32(77),
    1.0
  );
  assert.ok(!enemyHit.summary.toLowerCase().includes('gold'));

  const trawler = generateMerchantShip('m_npc', 200, 200, 'fishing_trawler', mulberry32(12));
  const npcReact = decideInnocentReaction(trawler, 200, mulberry32(12));
  assert.ok(npcReact === 'surrender' || npcReact === 'flee');
  const npcShot = resolveNpcVsNpcVolley(6, 12, trawler.hull, mulberry32(12));
  assert.ok(npcShot.nextHull <= trawler.hull);

  const factions = createInitialFactions();
  const cons = applyLeaderDefeatConsequences(factions, 'crimson_corsairs');
  assert.equal(cons.factions.crimson_corsairs.leaderDefeated, true);
  assert.ok(cons.factions.crimson_corsairs.strength < factions.crimson_corsairs.strength);

  const hit = resolveShipCollision(0, 0, 0, -9, 7, 1.5, 1.0, 0, -10, 0, 4, 8, 2.0, 1.0);
  assert.equal(hit.collided, true);
  const ai = computePirateAI({ ...pirate, hull: 10 }, 0, 0, 1, true, 0.1);
  assert.equal(ai.nextBehavior, 'retreat');
});

test('sea monsters respect alignment rules and small monsters can be fed/tamed', () => {
  const smallMonster = {
    ...generateSeaMonster('sm1', 400, 400, mulberry32(101)),
    size: 'small' as const,
    tameRequiredFood: 16,
    tameProgress: 0,
    tamed: false,
    provokedByPlayer: false,
  };
  const inv = { ...createStartingInventory(), food: 30 };
  const feed1 = feedSeaMonsterToTame(smallMonster, inv, 8);
  assert.equal(feed1.ok, true);
  assert.equal(feed1.monster.tamed, false);
  const feed2 = feedSeaMonsterToTame(feed1.monster, feed1.inventory, 8);
  assert.equal(feed2.ok, true);
  assert.equal(feed2.monster.tamed, true);
  assert.ok(feed2.companion, 'tamed small beast creates loyal companion');
  assert.equal(shouldMonsterAttackPlayer(feed2.monster, -80), false);

  const goodMonster = {
    ...generateSeaMonster('gm1', 900, 900, mulberry32(202)),
    alignment: 'good' as const,
    size: 'large' as const,
    tamed: false,
    provokedByPlayer: false,
  };
  assert.equal(shouldMonsterAttackPlayer(goodMonster, 50), false, 'good monster leaves heroes alone');
  assert.equal(shouldMonsterAttackPlayer(goodMonster, -60), true, 'good monster attacks notorious pirates');
});

test('world generation creates calm beginner zone with trawler, Crown patrol, and keeps sloops spawning in deep sea', () => {
  const chunk0 = generateWorldChunk(42, 0, 0, new Set(), new Set(), new Set());
  assert.ok(chunk0.merchants.some((m) => m.isFishingTrawler));
  assert.ok(chunk0.merchants.some((m) => m.isCrown));
  assert.equal(chunk0.monsters.length, 0, 'no sea monster at starter (0,0)');

  let deepSloops = 0;
  for (let i = 3; i <= 25; i++) {
    const c = generateWorldChunk(42, i, i, new Set(), new Set(), new Set());
    if (c.pirates.some((p) => p.tier === 'sloop')) deepSloops++;
  }
  assert.ok(deepSloops >= 1, 'small weak pirate sloops continue spawning in deeper waters');
});

test('journal entries can be created, edited, and deleted', () => {
  const v = createNewVoyage(101);
  const added = addJournalEntry(v.journal, 1, 10.5, 'Spotted Sails', 'A merchantman passed east.', 'player');
  assert.equal(added.length, v.journal.length + 1);
  const newId = added[0].id;
  const edited = updateJournalEntry(added, newId, 'Spotted Merchant', 'Updated note.');
  assert.equal(edited[0].title, 'Spotted Merchant');
  const deleted = deleteJournalEntry(edited, newId);
  assert.equal(deleted.length, v.journal.length);
});

test('late-game fleets unlock at Hull Tier 3 + 12 crew, sail in wedge formation, self-upgrade, and charge steep recruit fees', () => {
  const voyage = createNewVoyage(404);
  const earlyUnlock = getFleetUnlockStatus(voyage.player.upgrades, voyage.player.crew.length, 100);
  assert.equal(earlyUnlock.unlocked, false);

  const lateUpgrades = { ...voyage.player.upgrades, hullTier: 3 };
  const twelveCrew = [...voyage.player.crew, { ...voyage.player.crew[0], id: 'c11' }, { ...voyage.player.crew[1], id: 'c12' }];
  const lateUnlock = getFleetUnlockStatus(lateUpgrades, twelveCrew.length, 500);
  assert.equal(lateUnlock.unlocked, true);

  for (let slot = 0; slot < 5; slot++) {
    const pos = computeWedgeFormationTarget(100, 200, 0.5, slot, 9);
    const dist = Math.hypot(pos.x - 100, pos.z - 200);
    assert.ok(dist >= 24, `wedge slot ${slot} maintains clear spacing (${dist.toFixed(1)}m)`);
  }

  let fleetShip = createFleetShip('fl_1', 'medium_armed', 0, 0, 50, 0, mulberry32(101), 'HMS Avenger');
  fleetShip.hull = 150;
  fleetShip.autonomousResources.wood = 40;
  fleetShip.autonomousResources.iron = 25;
  fleetShip.autonomousResources.cloth = 25;
  fleetShip.autonomousResources.gold = 350;

  let evolved = false;
  for (let step = 0; step < 30; step++) {
    const res = stepFleetAutonomy(fleetShip, 2.5, false, mulberry32(step + 1));
    fleetShip = res.ship;
    if (res.upgraded) evolved = true;
  }
  assert.ok(fleetShip.hull > 150, 'damaged fleet ship self-repairs autonomously');
  assert.equal(evolved, true, 'fleet ship autonomously upgrades hull tier or ordnance');

  const defeatedPirate = generatePirateShip('pir_cap', 10, 10, 'galleon', mulberry32(77));
  const recruitCost = computeFleetRecruitCost(defeatedPirate);
  assert.ok(recruitCost >= 2000, `recruiting galleon is suitably expensive (${recruitCost}g)`);
  const captured = createFleetShipFromDefeated('cap_1', defeatedPirate, 1, 10, 40, 0, mulberry32(77));
  assert.equal(captured.name, defeatedPirate.name);
  assert.ok(captured.hull > 0 && captured.cannons >= 6);
});

test('crew members earn role XP, level up skills, and boost ship combat/sailing performance', () => {
  const voyage = createNewVoyage(515);
  const gunner = { ...voyage.player.crew.find((c) => c.role === 'cannoneer')!, level: 1, xp: 0 };
  const initialCombat = gunner.skills.combat;

  const xpResult = applyXpToCrewMember(gunner, 60);
  assert.ok((xpResult.member.level ?? 1) >= 2, 'gunner leveled up');
  assert.equal(xpResult.member.skills.combat, Math.min(12, initialCombat + 1));
  assert.ok(xpResult.leveledUpMessage);

  const boostedCrew = grantCrewRoleXp(voyage.player.crew, 'all_working', 55);
  const perfBefore = computeCrewPerformance(voyage.player.crew, voyage.player.upgrades);
  const perfAfter = computeCrewPerformance(boostedCrew.crew, voyage.player.upgrades);
  assert.ok(perfAfter.cannonEfficiency >= perfBefore.cannonEfficiency);
  assert.ok(perfAfter.sailingBonus >= perfBefore.sailingBonus);
});

test('50/50 salvage rules, 5-tier Ghost Ships with 2-14 room wrecks, and 16-state weather forecasts behave accurately', () => {
  const rand = mulberry32(2026);
  const gigantic = generateShipwreck('gig_1', 1500, 1500, 'gigantic_wreck', rand);
  assert.ok(gigantic.sections.length >= 10 && gigantic.sections.length <= 12, 'gigantic wreck has 10-12 rooms');
  assert.ok(gigantic.scale >= 2.3, 'gigantic wreck is visually massive');

  // Ghost ship sizes & Ghost wreck rooms/gold
  const smallGhost = generateGhostShip('gh_s', 900, 900, mulberry32(10), 'small');
  const smallWreck = generateGhostShipWreck(smallGhost, mulberry32(10));
  assert.ok(smallWreck.sections.length >= 2 && smallWreck.sections.length <= 4, 'small ghost wreck has 2-4 rooms');
  const smallGold = smallWreck.sections.reduce((s, r) => s + r.gold, 0);
  assert.ok(smallGold >= 100 && smallGold <= 250, `small ghost wreck gold ${smallGold} in [100,250]`);

  const colossalGhost = generateGhostShip('gh_c', 2200, 2200, mulberry32(20), 'colossal');
  const colossalWreck = generateGhostShipWreck(colossalGhost, mulberry32(20));
  assert.ok(colossalWreck.sections.length >= 10 && colossalWreck.sections.length <= 14, 'colossal ghost wreck has 10-14 rooms');
  const colossalGold = colossalWreck.sections.reduce((s, r) => s + r.gold, 0);
  assert.ok(colossalGold >= 1800, `colossal ghost wreck gold ${colossalGold} >= 1800`);
  assert.equal(rollEnemySalvageable(true, () => 0.1), false, 'Ghost ships are never recruitable');

  // 50/50 salvage roll distribution check
  let salv = 0;
  const r2 = mulberry32(42);
  for (let i = 0; i < 200; i++) {
    if (rollEnemySalvageable(false, r2)) salv++;
  }
  assert.ok(salv > 70 && salv < 130, `50/50 salvage ratio healthy: ${salv}/200`);

  // 16 Weather states & Forecast
  assert.equal(ALL_WEATHER_TYPES.length, 16);
  assert.ok(WEATHER_PRESETS.tornado.warningText);
  assert.ok(WEATHER_PRESETS.blizzard.snowIntensity === 1);
  const forecast = generateWeatherForecast('clear', 65, mulberry32(99), 3);
  assert.equal(forecast.length, 3);
  assert.equal(typeof loadVoyageFromStorage, 'function');
});

test('player ship names strictly use pre-chosen registry with reroll and goodwill aid is removed', () => {
  assert.ok(PRE_CHOSEN_SHIP_NAMES.length >= 20);
  const chosen = PRE_CHOSEN_SHIP_NAMES[3];
  const v = createNewVoyage(777, chosen);
  assert.equal(v.player.shipName, chosen);

  const rejected = createNewVoyage(778, 'Arbitrary Custom Name');
  assert.equal(isValidPreChosenShipName(rejected.player.shipName), true);
  assert.notEqual(rejected.player.shipName, 'Arbitrary Custom Name');

  const rerolled = pickRandomShipName(chosen, mulberry32(12));
  assert.equal(isValidPreChosenShipName(rerolled), true);
  assert.notEqual(rerolled, chosen);

  const policy = getMerchantReputationBehavior(90, false);
  assert.equal('canOfferAid' in policy, false);
});

test('plain weathered gray starter flag, sunken ship wrecks, and consistent faction/class flag configs', () => {
  const fresh = createNewVoyage(808);
  assert.equal(DEFAULT_CUSTOM_FLAG.primaryDye, 'weathered_gray');
  assert.equal(DEFAULT_CUSTOM_FLAG.pattern, 'solid');
  assert.equal(DEFAULT_CUSTOM_FLAG.emblem, 'none');
  assert.equal(DEFAULT_CUSTOM_FLAG.decorativeBorder, false);
  assert.equal(fresh.customFlag.primaryDye, 'weathered_gray');
  assert.equal(fresh.unlockedDyes.includes('weathered_gray'), true);

  // Sinking a pirate galleon creates a multi-room explorable shipwreck carrying its gold, cargo, and survivor
  const rand = mulberry32(909);
  const pir = {
    ...generatePirateShip('pir_sunk_1', 320, -410, 'galleon', rand, { factionId: 'crimson_corsairs' }),
    salvageable: true,
  };
  const pirWreck = generateSunkenVesselWreck({ kind: 'pirate', ship: pir }, mulberry32(909));
  assert.equal(pirWreck.spawnedFromShipId, pir.id);
  assert.ok(pirWreck.sections.length >= 6, 'galleon spawns multi-room wreck');
  const totalWreckGold = pirWreck.sections.reduce((s, r) => s + r.gold, 0);
  assert.ok(totalWreckGold >= pir.gold, 'pirate gold transferred into sunken wreck');

  // Sinking a merchant / Crown vessel creates an explorable wreck
  const crown = generateMerchantShip('crown_sunk_1', 150, 220, 'crown_frigate', mulberry32(77));
  const crownWreck = generateSunkenVesselWreck({ kind: 'merchant', ship: crown }, mulberry32(77));
  assert.equal(crownWreck.spawnedFromShipId, crown.id);
  assert.ok(crownWreck.sections.length >= 5);
  assert.ok(crownWreck.sections.reduce((s, r) => s + r.gold, 0) > 0);

  // Same faction & merchant class configs remain deterministic
  assert.deepEqual(createFactionFlagConfig('crimson_corsairs'), createFactionFlagConfig('crimson_corsairs'));
  assert.notDeepEqual(createFactionFlagConfig('crimson_corsairs'), createFactionFlagConfig('tempest_reavers'));
  assert.deepEqual(createCrownFlagConfig(), createCrownFlagConfig());
  assert.deepEqual(createMerchantFlagConfig('fishing_trawler'), createMerchantFlagConfig('fishing_boat'));
  assert.deepEqual(createMerchantFlagConfig('wealthy_trader'), createMerchantFlagConfig('treasure_ship'));
});

test('crew recruitment offer has 50% refusal when asked vs 100% guarantee when forced, and non-salvageable sunken ships become charred reduced-loot wrecks', () => {
  // Ask vs Force recruitment rolls
  let accepted = 0;
  const askRand = mulberry32(1337);
  for (let i = 0; i < 400; i++) {
    if (rollCrewOfferAccepted('accept', askRand)) accepted++;
  }
  assert.ok(accepted > 150 && accepted < 250, `asked crew acceptance ~50%: ${accepted}/400`);

  const forceRand = mulberry32(9999);
  for (let i = 0; i < 100; i++) {
    assert.equal(rollCrewOfferAccepted('force', forceRand), true, 'forced recruitment never refuses');
  }

  // Salvageable vs non-salvageable charred wreck comparison
  const pir = generatePirateShip('pir_char_cmp', 600, -400, 'galleon', mulberry32(404));
  const salvageableShip = { ...pir, salvageable: true };
  const charredShip = { ...pir, salvageable: false };

  const intactWreck = generateSunkenVesselWreck({ kind: 'pirate', ship: salvageableShip }, mulberry32(404));
  const charredWreck = generateSunkenVesselWreck({ kind: 'pirate', ship: charredShip }, mulberry32(404));

  assert.equal(Boolean(intactWreck.isCharred), false);
  assert.equal(charredWreck.isCharred, true);
  assert.ok(charredWreck.name.includes('Charred'));

  const intactGold = intactWreck.sections.reduce((sum, s) => sum + s.gold, 0);
  const charredGold = charredWreck.sections.reduce((sum, s) => sum + s.gold, 0);
  assert.ok(charredGold < intactGold * 0.65, `charred gold ${charredGold} much less than intact ${intactGold}`);

  const totalCargo = (wreck: typeof intactWreck) =>
    wreck.sections.reduce(
      (sum, sec) => sum + Object.values(sec.loot).reduce((rSum, n) => rSum + (n ?? 0), 0),
      0
    );
  const intactCargo = totalCargo(intactWreck);
  const charredCargo = totalCargo(charredWreck);
  assert.ok(charredCargo < intactCargo * 0.75, `charred cargo ${charredCargo} less than intact ${intactCargo}`);
});

