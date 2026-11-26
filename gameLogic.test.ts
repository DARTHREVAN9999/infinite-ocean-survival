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
  decideFriendlyAssistance,
  decideUnarmedOrTrawlerBehavior,
  generateGhostShip,
  generatePirateShip,
  resolveEnemyVolley,
  resolveNpcVsNpcVolley,
  resolvePlayerVolley,
  resolveShipCollision,
  rollEnemySalvageable,
  shouldPirateAttemptRam,
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

test('fishing trawlers strictly only sell food, water, and sea salt while blocking materials & ordnance', () => {
  const rand = mulberry32(314);
  const trawler = generateMerchantShip('fish_1', 100, 100, 'fishing_trawler', rand);
  assert.equal(trawler.isFishingTrawler, true);
  assert.ok(trawler.stock.food > 0);
  assert.ok(trawler.stock.water > 0);
  assert.ok(trawler.stock.salt > 0);
  assert.equal(trawler.stock.wood, 0);
  assert.equal(trawler.stock.iron, 0);
  assert.equal(trawler.stock.gunpowder, 0);

  const inv = createStartingInventory();
  const upgrades = createNewVoyage(42).player.upgrades;

  const foodBuy = executeTrade('buy', 'food', 5, 500, inv, upgrades, trawler, 0);
  assert.equal(foodBuy.ok, true);

  const saltBuy = executeTrade('buy', 'salt', 2, 500, inv, upgrades, trawler, 0);
  assert.equal(saltBuy.ok, true);

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

test('ramming physics reward speed advantage, protect light scrapes, recoil faster hulls, and damage sterns cleanly', () => {
  // Fast rammer hits slower stationary ship bow-on
  const fastRam = resolveShipCollision(
    0,
    0,
    0,
    -11,
    6,
    2.5,
    1.0,
    0,
    -9,
    0,
    0,
    6,
    2.5,
    1.0,
    { aHeading: 0, bHeading: 0 }
  );
  assert.equal(fastRam.collided, true);
  assert.equal(fastRam.isLightScrape, false);
  assert.ok(fastRam.damageB > fastRam.damageA, `faster rammer deals ${fastRam.damageB} > takes ${fastRam.damageA}`);
  assert.ok(fastRam.knockbackSpeedA < 0, 'ship A recoils backward after ramming');
  assert.equal(fastRam.hitSectionB, 'steering', 'striking ship B from behind damages steering');

  // Light oblique grazing scrape deals minimal damage and marks isLightScrape
  const lightScrape = resolveShipCollision(
    0,
    0,
    -1.2,
    -4.0,
    6,
    2.0,
    1.0,
    -10.5,
    0,
    0,
    -3.8,
    6,
    2.0,
    1.0,
    { aHeading: 0, bHeading: 0 }
  );
  assert.equal(lightScrape.collided, true);
  assert.equal(lightScrape.isLightScrape, true);
  assert.ok(lightScrape.damageA <= 2 && lightScrape.damageB <= 2, 'light scrape deals very little damage');

  // Solid rock reef hazard collision (mass 999 takes 0 damage)
  const rockHit = resolveShipCollision(0, 0, 0, -9, 6, 2.0, 1.0, 0, -10, 0, 0, 7, 999, 1.0);
  assert.equal(rockHit.collided, true);
  assert.equal(rockHit.damageB, 0);
  assert.ok(rockHit.damageA >= 4);
});

test('AI intelligence tiers, multi-enemy surrounding, situational ramming, unarmed traders/trawlers, and friendly assistance work as designed', () => {
  const rand = mulberry32(8080);

  // Heavier tactical/veteran ship situationally attempts ram when player is smaller or injured
  const veteranGalleon = {
    ...generatePirateShip('vet_gal', 0, -65, 'galleon', rand, { rank: 5 }),
    aiIntelligence: 'veteran' as const,
    ramCooldown: 0,
    ramCommitTimer: 0,
  };
  assert.equal(shouldPirateAttemptRam(veteranGalleon, 2, 65, { playerHullPct: 60, simTime: 10 }), true);

  // Unarmed / zero-cannon pirate tries desperate ram in close range
  const disarmedSloop = {
    ...generatePirateShip('dis_sloop', 0, -45, 'sloop', rand),
    cannons: 0,
  };
  assert.equal(shouldPirateAttemptRam(disarmedSloop, 3, 45), true);

  // Basic AI chases directly vs Tactical/Veteran AI spreads across squad slots to surround player
  const basicSloop = { ...generatePirateShip('basic_p', 0, 120, 'sloop', rand), aiIntelligence: 'basic' as const };
  const basicMove = computePirateAI(basicSloop, 0, 0, 2, true, 0.1, 0, 0, false, false, null, { squadIndex: 0, squadCount: 2 });
  assert.ok(basicMove.nextBehavior === 'pursue' || basicMove.nextBehavior === 'broadside');

  const tacA = computePirateAI(
    { ...veteranGalleon, x: 110, z: 0, ramCooldown: 20 },
    0,
    0,
    4,
    true,
    0.1,
    0,
    0,
    false,
    false,
    null,
    { squadIndex: 0, squadCount: 2, playerHullPct: 100 }
  );
  const tacB = computePirateAI(
    { ...veteranGalleon, x: 110, z: 0, ramCooldown: 20 },
    0,
    0,
    4,
    true,
    0.1,
    0,
    0,
    false,
    false,
    null,
    { squadIndex: 1, squadCount: 2, playerHullPct: 100 }
  );
  assert.notEqual(tacA.targetHeading, tacB.targetHeading, 'multi-enemy squad ships spread headings to surround');

  // Unarmed traders & trawlers exist with varied temperaments and desperate ram fallback
  let sawUnarmedMerchant = false;
  for (let i = 0; i < 40; i++) {
    const m = generateMerchantShip(`tr_${i}`, 300, 300, 'small_merchant', mulberry32(i + 50));
    if (m.cannons === 0) sawUnarmedMerchant = true;
  }
  assert.equal(sawUnarmedMerchant, true, 'some civilian traders spawn with no cannons');

  const corneredBoldTrader = {
    ...generateMerchantShip('bold_tr', 100, 100, 'fishing_boat', mulberry32(7)),
    cannons: 0,
    temperament: 'bold' as const,
    desperateRamCooldown: 0,
    hull: 22,
    maxHull: 55,
  };
  assert.equal(decideUnarmedOrTrawlerBehavior(corneredBoldTrader, 52, 8, 5), 'desperate_ram');
  const timidTrawler = {
    ...generateMerchantShip('timid_tr', 100, 100, 'fishing_trawler', mulberry32(8)),
    cannons: 0,
    temperament: 'timid' as const,
  };
  assert.equal(decideUnarmedOrTrawlerBehavior(timidTrawler, 150, 5, 5), 'flee');

  // Friendly AI assistance obeys reputation & faction ties
  const crown = generateMerchantShip('crown_help', 0, 0, 'crown_frigate', mulberry32(11));
  const outlawCrownAssist = decideFriendlyAssistance({ kind: 'merchant', ship: crown }, false, -60, 1, () => 0.01);
  assert.equal(outlawCrownAssist.assists, false, 'Crown refuses to assist feared outlaws');

  const heroCrownAssist = decideFriendlyAssistance({ kind: 'merchant', ship: crown }, false, 75, 1, () => 0.2);
  assert.equal(heroCrownAssist.assists, true, 'Crown assists honored captains probabilistically');

  const pirAlly = generatePirateShip('pir_help', 0, 0, 'brigantine', mulberry32(12), { factionId: 'crimson_corsairs' });
  const evilPirateAssist = decideFriendlyAssistance({ kind: 'pirate', ship: pirAlly }, true, -65, 1, () => 0.25);
  assert.equal(evilPirateAssist.assists, true, 'friendly pirates readily assist evil-rep players');
});

test('world chunks spawn solid rock/reef hazards safely away from origin', () => {
  let rockCount = 0;
  for (let cx = -3; cx <= 3; cx++) {
    for (let cz = -3; cz <= 3; cz++) {
      const chunk = generateWorldChunk(42, cx, cz, new Set(), new Set(), new Set());
      for (const rk of chunk.rocks) {
        rockCount++;
        assert.ok(Math.hypot(rk.x, rk.z) >= 150, 'rocks stay clear of starter spawn');
      }
    }
  }
  assert.ok(rockCount >= 4, `world generates solid sea rock hazards (${rockCount})`);
});

import { getOceanBiome } from './biomes';
import {
  buildProceduralIsland,
  resolveShipIslandCoastCollision,
  sampleIslandTerrainHeight,
} from './islands';
import { populateColdIslandIceCollar } from './worldGen';
import { resolveBreakableIceSheetCollision } from './combat';
import { convertFishToProvisions, stepCrewFishing } from './fishing';
import { addTreasureFragments, digTreasureSpot } from './treasure';
import { getMonsterProvisionDrop, stepMonsterChaseBehavior } from './monsters';
import { computeExactFleetMotion } from './fleet';
import {
  createInitialFpsWeaponState,
  createWildlifeActor,
  damageIslandPirateGuard,
  fireFpsWeapon,
  harvestWildlifeActor,
  isDiscoveryChestGuarded,
  lootIslandPirateGuard,
  resolveExplorerDeath,
  selectFpsWeapon,
  startFpsReload,
  stepFpsMouseDelta,
  stepFpsReload,
  stepIslandPirateGuard,
} from './fpsCombat';

test('valuable cargo ~40% price cut, exact fleet speed sync, and extreme sea monster provisions & species chases', () => {
  // ~40% price reduction while preserving anti-arbitrage
  assert.ok(RESOURCE_DEFS.cargo.basePrice <= 28, 'base cargo price cut ~40%');
  assert.ok(RESOURCE_DEFS.jewellery.basePrice <= 76, 'jewellery price cut ~40%');
  assert.ok(RESOURCE_DEFS.rareImports.basePrice <= 75, 'rare imports price cut ~40%');
  const merch = generateMerchantShip('m_price_chk', 100, 100, 'wealthy_trader', mulberry32(41));
  for (const vc of VALUABLE_CARGO_IDS) {
    assert.ok(
      getMerchantSellPrice(merch, vc, 25) < getMerchantBuyPrice(merch, vc, 25),
      `anti-arbitrage preserved for ${vc}`
    );
  }

  // Exact fleet speed & throttle match
  const fl = createFleetShip('fl_sync', 'medium_armed', 0, 0, 0, 0, mulberry32(12));
  assert.equal(computeExactFleetMotion(fl, 8.4, 0.75, 5, false), 8.4, 'escort matches flagship speed exactly');
  assert.equal(computeExactFleetMotion(fl, 0.1, 0, 4, false), 0, 'escort stops when flagship is stopped');
  assert.ok(computeExactFleetMotion(fl, 8.4, 0.75, 45, false) > 8.4, 'lagging escort catches up smoothly');
  assert.equal(computeExactFleetMotion({ ...fl, command: 'hold' }, 10, 1, 50, false), 0, 'hold stays anchored');

  // Extreme monster provisions & species-varied chase behavior
  assert.equal(getMonsterProvisionDrop('small'), 90);
  assert.equal(getMonsterProvisionDrop('medium'), 170);
  assert.equal(getMonsterProvisionDrop('large'), 265);
  assert.equal(getMonsterProvisionDrop('legendary'), 380);

  const shark = { ...generateSeaMonster('shk', 0, 0, mulberry32(5)), species: 'shark' as const };
  const serpent = { ...generateSeaMonster('srp', 0, 0, mulberry32(6)), species: 'serpent' as const };
  const kraken = { ...generateSeaMonster('krk', 0, 0, mulberry32(7)), species: 'kraken' as const };
  const sMove = stepMonsterChaseBehavior(shark, 0, -40, 0, -4, 40, 2.0);
  const wMove = stepMonsterChaseBehavior(serpent, 0, -80, 0, -4, 80, 2.0);
  const kAmbush = stepMonsterChaseBehavior(kraken, 0, -45, 0, -2, 45, 2.0);
  assert.notEqual(wMove.targetHeading, sMove.targetHeading, 'serpent weaves while shark intercepts');
  assert.ok(kAmbush.isLunging && kAmbush.ramDamageMultiplier > 1.4, 'kraken surges at ambush distance');
});

test('ocean biomes, starter island Coral Haven, breakable ice sheets, fishing converter, treasure fragments, and FPS reload state', () => {
  // Biomes & islands
  assert.equal(getOceanBiome(0, 0, 42), 'temperate');
  assert.equal(getOceanBiome(285, 130, 42), 'tropical');
  assert.equal(getOceanBiome(0, -1000, 42), 'cold');

  const starterChunk = generateWorldChunk(42, 0, 0, new Set(), new Set(), new Set());
  const coralHaven = starterChunk.islands.find((i) => i.name === 'Coral Haven');
  assert.ok(coralHaven, 'starter Coral Haven island spawns near origin');
  assert.ok(sampleIslandTerrainHeight(coralHaven!, coralHaven!.x, coralHaven!.z) > 1.5, 'island center above sea level');
  assert.ok(sampleIslandTerrainHeight(coralHaven!, coralHaven!.x + 250, coralHaven!.z) < 0, 'open ocean below sea level');

  // Breakable ice sheet: Tier 5 heavy ship breaks thin sheet while slow Tier 1 only cracks it
  const sheet = {
    id: 'ice_1',
    x: 0,
    z: -900,
    radius: 16,
    thickness: 1 as const,
    hp: 40,
    maxHp: 40,
    crackStage: 0 as const,
    broken: false,
    rotation: 0,
  };
  const weakBump = resolveBreakableIceSheetCollision(2.2, 1.0, 1, sheet.hp, sheet.maxHp, sheet.thickness);
  assert.equal(weakBump.shattered, false);
  assert.ok(weakBump.newCrackStage >= 1, 'light hit visibly cracks ice sheet');
  const heavyRam = resolveBreakableIceSheetCollision(11.5, 3.2, 5, sheet.hp, sheet.maxHp, sheet.thickness);
  assert.equal(heavyRam.shattered, true, 'heavy fast ship shatters thin ice sheet');

  // Fishing crew + converter
  const voyage = createNewVoyage(55);
  voyage.player.crew[0].role = 'fisherman';
  voyage.player.upgrades.fishingGear = 'basic_lines';
  voyage.player.speed = 4.5;
  const fishRes = stepCrewFishing(voyage, 'tropical', 30, 0, mulberry32(9));
  assert.ok(fishRes.caughtRegular + fishRes.caughtRare >= 1, 'fisherman + gear catch fish');
  const invBeforeFood = voyage.player.inventory.food;
  voyage.player.inventory.fishCatch = 2;
  voyage.player.inventory.rareFish = 1;
  const conv = convertFishToProvisions(voyage.player.inventory, 2, 1);
  assert.equal(conv.foodAdded, 12, '2 regular (6) + 1 rare (6) = 12 food');
  assert.equal(voyage.player.inventory.food, invBeforeFood + 12);

  // Treasure fragments -> 3 bind a complete map -> dig completes
  const fragAdd1 = addTreasureFragments(voyage, 2, [coralHaven!], mulberry32(10));
  assert.equal(fragAdd1.newFragmentsCount, 2);
  assert.equal(fragAdd1.assembledMaps.length, 0);
  const fragAdd2 = addTreasureFragments(voyage, 2, [coralHaven!], mulberry32(11));
  assert.equal(fragAdd2.assembledMaps.length, 1);
  assert.equal(fragAdd2.newFragmentsCount, 1);
  const map = fragAdd2.assembledMaps[0];
  const goldBefore = voyage.player.gold;
  const dug = digTreasureSpot(voyage, map.id);
  assert.equal(dug.success, true);
  assert.equal(map.found, true);
  assert.ok(voyage.player.gold > goldBefore);

  // FPS weapons: unloaded state & paused reload strictly persist across weapon swaps
  let fpsState = createInitialFpsWeaponState();
  fpsState = selectFpsWeapon(fpsState, 'pistol');
  const shot = fireFpsWeapon(fpsState);
  assert.equal(shot.fired, true);
  assert.equal(shot.state.pistolLoaded, false);
  // Attempting to fire again without reloading does NOT auto-reload
  const dryFire = fireFpsWeapon(shot.state);
  assert.equal(dryFire.fired, false);
  assert.equal(dryFire.needsReload, true);

  // Start reload, advance 0.5s, swap away to cutlass, then back to pistol -> still unloaded with paused remaining time
  const reloadStart = startFpsReload(shot.state, { gunpowder: 10, leadShot: 10 });
  assert.equal(reloadStart.started, true);
  const midReload = stepFpsReload(reloadStart.state, 0.5, voyage.player.inventory);
  assert.equal(midReload.finishedWeapon, null);
  const swappedCutlass = selectFpsWeapon(midReload.state, 'cutlass');
  assert.equal(swappedCutlass.pistolLoaded, false);
  assert.equal(swappedCutlass.isReloading, false);
  const swappedBackPistol = selectFpsWeapon(swappedCutlass, 'pistol');
  assert.equal(swappedBackPistol.pistolLoaded, false);
  assert.ok(swappedBackPistol.pistolReloadRemaining > 0.9 && swappedBackPistol.pistolReloadRemaining < 1.2);

  // Complete reload -> consumes 1 gunpowder + 1 leadShot
  const pwBefore = voyage.player.inventory.gunpowder;
  const lsBefore = voyage.player.inventory.leadShot;
  const resumed = startFpsReload(swappedBackPistol, voyage.player.inventory);
  const finished = stepFpsReload(resumed.state, 1.5, voyage.player.inventory);
  assert.equal(finished.finishedWeapon, 'pistol');
  assert.equal(finished.state.pistolLoaded, true);
  assert.equal(voyage.player.inventory.gunpowder, pwBefore - 1);
  assert.equal(voyage.player.inventory.leadShot, lsBefore - 1);
});

test('larger flatter islands, solid coastline collisions, cold island ice collars, wildlife sail cloth + provisions, pirate chest guards, and explorer death', () => {
  // 1. Coral Haven is enlarged (>= 88 radius), flatter (<= 8.0 maxHeight), and blocks side entry while allowing pier approach
  const starterChunk = generateWorldChunk(42, 0, 0, new Set(), new Set(), new Set());
  const coralHaven = starterChunk.islands.find((i) => i.name === 'Coral Haven')!;
  assert.ok(coralHaven.radius >= 88, 'Coral Haven radius enlarged');
  assert.ok(coralHaven.maxHeight <= 8.0, 'Coral Haven maxHeight flattened');

  // Side impact pushes ship safely outside solid coastline
  const sideImpact = resolveShipIslandCoastCollision(coralHaven, coralHaven.x + 25, coralHaven.z + 25, 7);
  assert.equal(sideImpact.collided, true);
  assert.ok(Math.hypot(sideImpact.nextX - coralHaven.x, sideImpact.nextZ - coralHaven.z) >= coralHaven.radius * 0.9);

  // Far offshore is clear
  const clearSea = resolveShipIslandCoastCollision(coralHaven, coralHaven.x - 140, coralHaven.z, 7);
  assert.equal(clearSea.collided, false);

  // 2. Cold islands generate a full collar of mixed thin & medium breakable ice sheets; tropical do not
  const tropCollar: ReturnType<typeof generateWorldChunk>['iceSheets'] = [];
  populateColdIslandIceCollar(coralHaven, mulberry32(19), tropCollar);
  assert.equal(tropCollar.length, 0);

  const coldIsland = buildProceduralIsland('cold_test', 365, -835, 42, mulberry32(23));
  assert.equal(coldIsland.biome, 'cold');
  const coldCollar: ReturnType<typeof generateWorldChunk>['iceSheets'] = [];
  populateColdIslandIceCollar(coldIsland, mulberry32(29), coldCollar);
  assert.ok(coldCollar.length >= 8, 'cold island ringed by breakable ice sheets');
  assert.ok(coldCollar.some((s) => s.thickness === 1), 'collar includes thin ice sheets');
  assert.ok(coldCollar.some((s) => s.thickness === 2), 'collar includes medium ice sheets');

  // 3. Harvesting animals yields BOTH Sail Cloth (cloth) & Provisions (food)
  const boar = createWildlifeActor('boar_test', 'boar', 10, 1, 10, mulberry32(31), coralHaven.id);
  boar.dead = true;
  const invVoyage = createNewVoyage(77);
  const clothBefore = invVoyage.player.inventory.cloth;
  const foodBefore = invVoyage.player.inventory.food;
  const hv = harvestWildlifeActor(boar, invVoyage.player.inventory);
  assert.equal(hv.harvested, true);
  assert.ok(hv.clothAdded >= 1, 'harvesting animal yields Sail Cloth');
  assert.ok(hv.foodAdded >= 4, 'harvesting animal yields Provisions');
  assert.equal(invVoyage.player.inventory.cloth, clothBefore + hv.clothAdded);
  assert.equal(invVoyage.player.inventory.food, foodBefore + hv.foodAdded);

  // 4. Guarded pirate chest & mixed cutlass/pistol pirate guards
  const guards = coralHaven.pirateGuards ?? [];
  const pirateChest = coralHaven.discoveries.find((d) => d.kind === 'pirate_chest');
  assert.ok(pirateChest, 'Coral Haven spawns a pirate treasure chest');
  assert.ok(guards.length >= 2, 'pirate chest is defended by multiple pirate guards');
  assert.ok(guards.some((g) => g.role === 'cutlass'), 'has cutlass buccaneer guard');
  assert.ok(guards.some((g) => g.role === 'pistol'), 'has flintlock pistol corsair guard');

  // Locked while guards live
  assert.equal(isDiscoveryChestGuarded(pirateChest!, guards).guarded, true);

  // Pistol guard can fire from medium distance; cutlass guard closes into melee
  const pistolGuard = guards.find((g) => g.role === 'pistol')!;
  pistolGuard.reloadTimer = 0;
  pistolGuard.attackCooldown = 0;
  const pistolStep = stepIslandPirateGuard(pistolGuard, pistolGuard.x + 12, pistolGuard.z, false, 0.2);
  assert.ok(pistolStep.rangedShotDamage > 0 && pistolStep.rangedFired, 'pistol guard fires flintlock from range');

  // Defeat all guards -> chest unlocks & defeated guards can be looted
  for (const g of guards) {
    damageIslandPirateGuard(g, 500);
    assert.equal(g.dead, true);
  }
  assert.equal(isDiscoveryChestGuarded(pirateChest!, guards).guarded, false);
  const goldPreLoot = invVoyage.player.gold;
  const lootG = lootIslandPirateGuard(guards[0], invVoyage);
  assert.equal(lootG.looted, true);
  assert.ok(invVoyage.player.gold > goldPreLoot);

  // 5. Explorer death keeps the crew; the multiplayer engine removes only gold.
  const crewPreDeath = invVoyage.player.crew.length;
  const death = resolveExplorerDeath(invVoyage);
  assert.equal(invVoyage.player.crew.length, crewPreDeath);
  assert.ok(death.message.includes('Your explorer died'));
  assert.ok(death.message.includes('gold was lost'));
});

import { SALT_SPOILAGE_MULT } from './survival';
import {
  chooseBountyTargetKind,
  computeBountyLocatorMetrics,
  createBountyContract,
  getBountyRewardAndRep,
  resolveBountyHunterClaim,
  resolveBountyKillByPlayer,
} from './bounty';
import { PIRATE_MUSIC_TRACKS, pickNextRandomTrackIndex } from '../audio/soundEngine';

test('salt starts scarce, drains gradually, accelerates food spoilage at 0, and is stocked by trawlers/merchants', () => {
  const startInv = createStartingInventory();
  assert.equal(startInv.salt, 12, 'player starts with limited salt');

  const voyage = createNewVoyage(606);
  const supplyDays = computeSupplyDaysRemaining(voyage.player.inventory, voyage.player.crew.length);
  assert.ok(supplyDays.saltDays > 0.5 && supplyDays.saltDays < 5, `initial saltDays reasonable (${supplyDays.saltDays})`);

  const saltedStep = stepSurvivalAndRepairs(
    10,
    { ...voyage.player.inventory, food: 80, salt: 12 },
    voyage.player.crew,
    voyage.player.condition,
    voyage.player.upgrades,
    null,
    voyage.weather,
    mulberry32(1)
  );
  assert.ok(saltedStep.inventory.salt < 12, 'salt depletes while preserving food');

  const unsaltedStep = stepSurvivalAndRepairs(
    10,
    { ...voyage.player.inventory, food: 80, salt: 0 },
    voyage.player.crew,
    voyage.player.condition,
    voyage.player.upgrades,
    null,
    voyage.weather,
    mulberry32(1)
  );
  const saltedLoss = 80 - saltedStep.inventory.food;
  const unsaltedLoss = 80 - unsaltedStep.inventory.food;
  assert.ok(
    Math.abs(unsaltedLoss / saltedLoss - SALT_SPOILAGE_MULT) < 0.05,
    `unsalted food spoils at ~${SALT_SPOILAGE_MULT}x rate (${unsaltedLoss.toFixed(3)} vs ${saltedLoss.toFixed(3)})`
  );
});

test('most Crown fighting warships refuse trade while crown_supply trades and rare exceptions exist', () => {
  let crownNonTrading = 0;
  for (let i = 0; i < 60; i++) {
    const crownFrigate = generateMerchantShip(`cr_${i}`, 200, 200, 'crown_frigate', mulberry32(i + 1000));
    if (crownFrigate.canTrade === false) crownNonTrading++;
  }
  assert.ok(crownNonTrading >= 38, `most Crown warships refuse trade (${crownNonTrading}/60)`);

  const crownSupply = generateMerchantShip('cr_sup', 200, 200, 'crown_supply', mulberry32(55));
  assert.equal(crownSupply.canTrade, true, 'Crown supply ships always trade');

  const combatOnlyCrown = {
    ...generateMerchantShip('cr_fight', 200, 200, 'crown_warship', mulberry32(7)),
    canTrade: false,
  };
  const policy = getMerchantReputationBehavior(80, true, combatOnlyCrown);
  assert.equal(policy.willTrade, false, 'non-trading Crown fighting ship blocks trade even at +80 rep');
});

test('reputation-driven bounty contracts, locator bearing math, scaled rewards, and rival hunter claims work accurately', () => {
  assert.equal(chooseBountyTargetKind(25), 'pirate');
  assert.equal(chooseBountyTargetKind(0), 'pirate');
  assert.equal(chooseBountyTargetKind(-1), 'crown');
  assert.equal(chooseBountyTargetKind(-60), 'crown');

  const goodContract = createBountyContract('b1', 40, 4, 2, mulberry32(11)).contract;
  assert.equal(goodContract.targetKind, 'pirate');
  assert.ok(goodContract.reputationDelta > 0, 'pirate bounty grants positive reputation');

  const evilContract = createBountyContract('b2', -45, 5, 3, mulberry32(22)).contract;
  assert.equal(evilContract.targetKind, 'crown');
  assert.ok(evilContract.reputationDelta < 0, 'Crown bounty lowers reputation further');

  const petty = getBountyRewardAndRep('pirate', 'petty', mulberry32(5));
  const legendary = getBountyRewardAndRep('pirate', 'legendary', mulberry32(5));
  assert.ok(legendary.rewardGold > petty.rewardGold * 2.5, 'stronger bounties pay much higher gold');

  const killWin = resolveBountyKillByPlayer(goodContract, 100, 40);
  assert.equal(killWin.contract.status, 'claimed_player');
  assert.equal(killWin.gold, 100 + goodContract.rewardGold);
  assert.equal(killWin.reputation, 40 + goodContract.reputationDelta);

  const rivalWin = resolveBountyHunterClaim(goodContract, 'HMS Pursuit', 100);
  assert.equal(rivalWin.contract.status, 'claimed_rival');
  assert.equal(rivalWin.gold, 100, 'rival hunter kill awards player 0 bounty gold');

  // Locator math: heading 0 faces North (-Z)
  const ahead = computeBountyLocatorMetrics(0, 0, 0, 0, -250);
  assert.equal(ahead.distance, 250);
  assert.equal(ahead.relBearingDeg, 0);
  assert.equal(ahead.directionLabel, 'Dead Ahead');

  const starboard = computeBountyLocatorMetrics(0, 0, 0, 300, 0);
  assert.equal(starboard.relBearingDeg, 90);
  assert.equal(starboard.directionLabel, 'Starboard Beam');

  const port = computeBountyLocatorMetrics(0, 0, 0, -300, 0);
  assert.equal(port.relBearingDeg, -90);
  assert.equal(port.directionLabel, 'Port Beam');
});

test('pirate MP3 soundtrack playlist shuffles all 6 tracks and never plays the same song twice in a row', () => {
  assert.equal(PIRATE_MUSIC_TRACKS.length, 6);
  const rand = mulberry32(2027);
  let prev = -1;
  const seen = new Set<number>();
  for (let i = 0; i < 240; i++) {
    const next = pickNextRandomTrackIndex(PIRATE_MUSIC_TRACKS.length, prev, rand);
    assert.ok(next >= 0 && next < PIRATE_MUSIC_TRACKS.length);
    if (prev !== -1) {
      assert.notEqual(next, prev, `track ${next} must differ from immediately preceding track ${prev}`);
    }
    seen.add(next);
    prev = next;
  }
  assert.equal(seen.size, PIRATE_MUSIC_TRACKS.length, 'all 6 pirate tracks are reachable');
});

test('FPS mouse delta handler skips post-lock spikes and off-screen cursor jumps', () => {
  // Initial 2 events after pointer lock transition are discarded cleanly
  let st = { lastX: -1, lastY: -1, skipEvents: 2 };
  const skip1 = stepFpsMouseDelta(st, { locked: true, clientX: 640, clientY: 400, movementX: 450, movementY: -220 });
  assert.equal(skip1.dx, 0);
  assert.equal(skip1.dy, 0);
  st = skip1.nextState;

  const skip2 = stepFpsMouseDelta(st, { locked: true, clientX: 640, clientY: 400, movementX: -300, movementY: 180 });
  assert.equal(skip2.dx, 0);
  assert.equal(skip2.dy, 0);
  st = skip2.nextState;

  // Normal locked mouse look passes through smoothly
  const normal = stepFpsMouseDelta(st, { locked: true, clientX: 640, clientY: 400, movementX: 24, movementY: -12 });
  assert.equal(normal.dx, 24);
  assert.equal(normal.dy, -12);
  st = normal.nextState;

  // Bogus Chromium warp spike while locked is rejected cleanly
  const spike = stepFpsMouseDelta(st, { locked: true, clientX: 640, clientY: 400, movementX: 390, movementY: 0 });
  assert.equal(spike.dx, 0);
  assert.equal(spike.dy, 0);

  // Unlocked mode: leaving screen and re-entering across viewport is ignored
  let uState = { lastX: 15, lastY: 400, skipEvents: 0 };
  const edgeJump = stepFpsMouseDelta(uState, { locked: false, clientX: 1260, clientY: 400, movementX: 0, movementY: 0 });
  assert.equal(edgeJump.dx, 0);
  uState = edgeJump.nextState;
  const unlockedMove = stepFpsMouseDelta(uState, { locked: false, clientX: 1240, clientY: 392, movementX: 0, movementY: 0 });
  assert.equal(unlockedMove.dx, -20);
  assert.equal(unlockedMove.dy, -8);
});

import { CHUNK_SIZE } from './worldGen';
import { getMonsterAttackStyle, getMonsterSaltDrop, SEA_MONSTER_SPECS } from './monsters';
import { fishNearMarineWildlife, fishNearMonsterCarcass } from './fishing';
import { damageWildlifeActor } from './fpsCombat';

test('ocean biomes cover temperate/tropical/cold/deep with normal most common and deep monster-only', () => {
  const counts = { temperate: 0, tropical: 0, cold: 0, deep: 0 };
  for (let gx = -5; gx <= 5; gx++) {
    for (let gz = -5; gz <= 5; gz++) {
      const b = getOceanBiome(gx * 320, gz * 320, 42);
      counts[b]++;
    }
  }
  assert.ok(counts.temperate > counts.tropical && counts.temperate > counts.cold && counts.temperate > counts.deep, 'Normal Ocean is most common');
  assert.ok(counts.deep >= 1 && counts.tropical >= 1 && counts.cold >= 1, 'all 4 biomes spawn across world grid');

  // Find a deep-ocean chunk and verify ONLY sea monsters spawn there
  let deepChunkCoords: [number, number] | null = null;
  for (let cx = -12; cx <= 12 && !deepChunkCoords; cx++) {
    for (let cz = -12; cz <= 12; cz++) {
      const midX = (cx + 0.5) * CHUNK_SIZE;
      const midZ = (cz + 0.5) * CHUNK_SIZE;
      if (getOceanBiome(midX, midZ, 42) === 'deep') {
        deepChunkCoords = [cx, cz];
        break;
      }
    }
  }
  assert.ok(deepChunkCoords, 'located a deep ocean chunk');
  const dChunk = generateWorldChunk(42, deepChunkCoords![0], deepChunkCoords![1], new Set(), new Set(), new Set());
  assert.equal(dChunk.biome, 'deep');
  assert.equal(dChunk.islands.length, 0);
  assert.equal(dChunk.merchants.length, 0);
  assert.equal(dChunk.pirates.length, 0);
  assert.equal(dChunk.wrecks.length, 0);
  assert.equal(dChunk.rocks.length, 0);
  assert.equal(dChunk.wildlife.length, 0);
  assert.ok(dChunk.monsters.length >= 1, 'deep ocean spawns sea monsters only');

  // Crew fishing yields nothing in Abyssal Deep
  const voyage = createNewVoyage(91);
  voyage.player.crew[0].role = 'fisherman';
  voyage.player.upgrades.fishingGear = 'trawling_net';
  voyage.player.speed = 6;
  const deepFish = stepCrewFishing(voyage, 'deep', 60, 0, mulberry32(4));
  assert.equal(deepFish.caughtRegular + deepFish.caughtRare, 0);
});

test('fishing near sea creatures & floating monster carcasses harvests provisions and salt; tentacle vs ram-bite & falling birds work', () => {
  const voyage = createNewVoyage(104);
  const foodBefore = voyage.player.inventory.food;
  const saltBefore = voyage.player.inventory.salt;

  // 1. Living sea wildlife fishing awards Food + Salt
  const parrot = createWildlifeActor('pf_1', 'parrotfish', 20, 0, 20, mulberry32(12));
  const pfRes = fishNearMarineWildlife(parrot, voyage.player.inventory);
  assert.equal(pfRes.harvested, true);
  assert.ok(pfRes.foodAdded > 0 && pfRes.saltAdded >= 1);
  assert.equal(voyage.player.inventory.food, foodBefore + pfRes.foodAdded);
  assert.equal(voyage.player.inventory.salt, saltBefore + pfRes.saltAdded);

  // 2. Sea monster carcass floating harvest
  const gk = generateSeaMonster('gk_1', 30, 30, mulberry32(88), true, 'deep');
  gk.species = 'giant_kraken';
  gk.defeated = true;
  gk.carcassRemainingFood = getMonsterProvisionDrop('legendary');
  gk.carcassRemainingSalt = getMonsterSaltDrop('legendary');
  gk.carcassHarvested = false;
  const monRes = fishNearMonsterCarcass(gk, voyage.player.inventory);
  assert.equal(monRes.harvested, true);
  assert.equal(monRes.foodAdded, 380);
  assert.equal(monRes.saltAdded, 14);
  assert.equal(gk.carcassHarvested, true);

  // 3. Tentacle vs ram_bite styles and small-tier taming across all 9 species
  assert.equal(getMonsterAttackStyle('giant_kraken'), 'tentacles');
  assert.equal(getMonsterAttackStyle('leviathan_squid'), 'tentacles');
  assert.equal(getMonsterAttackStyle('kraken'), 'tentacles');
  assert.equal(getMonsterAttackStyle('mosasaur'), 'ram_bite');
  assert.equal(getMonsterAttackStyle('frost_leviathan'), 'ram_bite');
  assert.equal(getMonsterAttackStyle('shark'), 'ram_bite');
  assert.ok(SEA_MONSTER_SPECS.giant_kraken.tameAbility.length > 0);

  const smallMosa = {
    ...generateSeaMonster('sm_mosa', 0, 0, mulberry32(33), false, 'tropical'),
    species: 'mosasaur' as const,
    size: 'small' as const,
    provokedByPlayer: false,
    tameRequiredFood: 4,
    tameProgress: 0,
  };
  const tameStep = feedSeaMonsterToTame(smallMosa, voyage.player.inventory, 4);
  assert.equal(tameStep.ok, true);
  assert.equal(tameStep.monster.tamed, true);

  // 4. Dead island seabird gets downward fall velocity; ocean flock bird cannot be killed
  const islandGull = createWildlifeActor('gull_isl', 'seabird', 10, 8.5, 10, mulberry32(19), 'isl_1');
  const gullHit = damageWildlifeActor(islandGull, 99);
  assert.equal(gullHit.killed, true);
  assert.ok((islandGull.vy ?? 0) < 0, 'killed seabird starts falling toward the ground');

  const flockBird = createWildlifeActor('flock_1', 'ocean_flock_bird', 50, 15, 50, mulberry32(21));
  assert.equal(flockBird.killable, false);
  const flockHit = damageWildlifeActor(flockBird, 999);
  assert.equal(flockHit.killed, false);
  assert.equal(flockBird.dead, false);
});






