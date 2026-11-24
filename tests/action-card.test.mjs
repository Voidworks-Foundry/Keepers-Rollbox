import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import { castSpell, grantAutoHit, startAttack } from "../scripts/roll-requests/index.js";
import { keeperTicks } from "../scripts/roll-requests/attack.js";
import { CLICK_DELAY_MS } from "../scripts/roll-requests/card-buttons.js";
import { makeCoC7, makeDom, makeEnv, makeRollActor } from "./mocks.mjs";

beforeEach(() => mock.timers.enable({ apis: ["setTimeout"] }));
afterEach(() => mock.timers.reset());

/**
 * Keeper's client with CoC7; Harvey (an investigator) with a revolver and CoC7's weaponCheck recorded. His attacks
 * aren't rolled at once (rollboxAutoRollAttacks off) unless a test turns it on.
 */
function setup() {
  const env = makeEnv({ values: { rollboxAutoRollAttacks: false } });
  const calls = makeCoC7();
  makeDom();
  const harvey = makeRollActor({ name: "Harvey", weapons: [{ id: "gun", name: ".38 Revolver", main: "Firearms (Handgun)" }] });
  const gun = harvey.items.find((i) => i.id === "gun");
  gun.system.properties = { rngd: true };
  calls.weaponChecks = [];
  harvey.weaponCheck = async (data) => { calls.weaponChecks.push(data); };
  return { env, calls, harvey, gun };
}

/**
 * CoC7's ranged card as rendered, with the toggles Rollbox sets: Aiming, Reloading on the active target, and the
 * target's dice slider. Each click or change is recorded, and turns the toggle on as CoC7's redraw would.
 */
function rangedCard({ aiming = false, reloading = false, dice = 0 } = {}) {
  const html = document.createElement("div");
  html.innerHTML = `<button data-action="toggleValue" data-set="aiming" class="${aiming ? "switched-on" : ""}"></button>
    <div class="ranged-targets-option active" data-offset="0">
      <button data-action="toggleTargetKey" data-set="reloading" class="${reloading ? "switched-on" : ""}"></button>
      <input type="range" data-set="poolModifier" min="-2" max="2" value="${dice}">
    </div>`;
  const used = [];
  html.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => used.push(b.dataset.set)));
  html.querySelector("input").addEventListener("change", (e) => used.push(`dice ${e.target.value}`));
  return { html, used };
}

const rangedMessage = (harvey, gun) => ({ flags: { CoC7: { load: { as: "CoC7ChatCombatRanged", actorUuid: harvey.uuid,
  itemUuid: gun.uuid, weaponRolled: false, shots: [] } } } });

test("startAttack: CoC7's weaponCheck with the weapon; then one toggle per render of its card", async () => {
  const { env, calls, harvey, gun } = setup();
  const result = await startAttack({ actor: harvey, weapon: gun, ticks: { aiming: true, reloading: true, dice: -1 } });
  assert.deepEqual(result, { started: true, rolled: false });
  assert.deepEqual(calls.weaponChecks, [{ uuid: gun.uuid }]);
  const message = rangedMessage(harvey, gun);
  const first = rangedCard();
  env.hooks.renderChatMessageHTML[0](message, first.html);
  mock.timers.tick(CLICK_DELAY_MS);
  assert.deepEqual(first.used, ["aiming"]);
  const second = rangedCard({ aiming: true });
  env.hooks.renderChatMessageHTML[0](message, second.html);
  mock.timers.tick(CLICK_DELAY_MS);
  assert.deepEqual(second.used, ["reloading"]);
  const third = rangedCard({ aiming: true, reloading: true, dice: 1 });
  env.hooks.renderChatMessageHTML[0](message, third.html);
  mock.timers.tick(CLICK_DELAY_MS);
  assert.deepEqual(third.used, ["dice 0"]); // the weapon's own bonus die, then Rollbox's penalty die on top
  env.hooks.renderChatMessageHTML[0](message, rangedCard({ aiming: true, reloading: true, dice: 0 }).html);
  mock.timers.tick(CLICK_DELAY_MS);
  assert.equal(env.hooks.renderChatMessageHTML.length, 0);
});

test("startAttack: another weapon's card, or a card already rolled, is left alone", async () => {
  const { env, harvey, gun } = setup();
  await startAttack({ actor: harvey, weapon: gun, ticks: { aiming: true } });
  const other = rangedMessage(harvey, { uuid: "Actor.Harvey.Item.rifle" });
  const rolled = rangedMessage(harvey, gun);
  rolled.flags.CoC7.load.weaponRolled = true;
  for (const message of [other, rolled]) {
    const card = rangedCard();
    env.hooks.renderChatMessageHTML[0](message, card.html);
    mock.timers.tick(CLICK_DELAY_MS);
    assert.deepEqual(card.used, []);
  }
});

test("startAttack: no card in time tells the Keeper what to set; no toggles asked sets no watch", async () => {
  const { env, calls, harvey, gun } = setup();
  await startAttack({ actor: harvey, weapon: gun });
  assert.equal(env.hooks.renderChatMessageHTML, undefined);
  await startAttack({ actor: harvey, weapon: gun, ticks: { aiming: true } });
  mock.timers.tick(15000);
  assert.deepEqual(calls.notices, ["Rollbox: set Aiming on CoC7's attack card before Roll."]);
});

test("startAttack: no weapon makes nothing (the Action flyout adds an unarmed weapon only after the Keeper's yes)", async () => {
  const { calls, harvey } = setup();
  assert.deepEqual(await startAttack({ actor: harvey, weapon: null }), { started: false, reason: "no weapon" });
  assert.deepEqual(calls.weaponChecks, []);
});

test("startAttack: Point blank and In melee ticked on the active target; mace spray's point blank taken off", async () => {
  const { env, harvey, gun } = setup();
  const card = (pb) => {
    const html = document.createElement("div");
    html.innerHTML = `<div class="ranged-targets-option active">
      <button data-action="toggleTargetKey" data-set="pointBlankRange" class="${pb ? "switched-on" : ""}"></button>
      <button data-action="toggleTargetKey" data-set="inMelee"></button></div>`;
    const used = [];
    html.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => used.push(b.dataset.set)));
    return { html, used };
  };
  await startAttack({ actor: harvey, weapon: gun, ticks: { pointBlank: true, inMelee: true } });
  const first = card(false);
  env.hooks.renderChatMessageHTML[0](rangedMessage(harvey, gun), first.html);
  mock.timers.tick(CLICK_DELAY_MS);
  assert.deepEqual(first.used, ["pointBlankRange"]);
  const second = card(true);
  env.hooks.renderChatMessageHTML[0](rangedMessage(harvey, gun), second.html);
  mock.timers.tick(CLICK_DELAY_MS);
  assert.deepEqual(second.used, ["inMelee"]);
  env.hooks.renderChatMessageHTML.length = 0;
  await startAttack({ actor: harvey, weapon: gun, ticks: { noPointBlank: true } });
  const mace = card(true);
  env.hooks.renderChatMessageHTML[0](rangedMessage(harvey, gun), mace.html);
  mock.timers.tick(CLICK_DELAY_MS);
  assert.deepEqual(mace.used, ["pointBlankRange"]);
});

test("startAttack and castSpell: CoC7's methods missing make nothing, with a warning", async () => {
  const { calls, harvey, gun } = setup();
  delete harvey.weaponCheck;
  assert.equal((await startAttack({ actor: harvey, weapon: gun })).started, false);
  assert.equal(await castSpell({ name: "Shrivelling", system: {} }), false);
  assert.equal(calls.warnings.length, 2);
});

/** CoC7's ranged card with Multi. Shots, the target's Shoot and, once a shot is added, the bottom Shoot. */
function multiCard({ multi = false, added = 0 } = {}) {
  const html = document.createElement("div");
  html.innerHTML = `<button data-action="toggleValue" data-set="multipleShots" class="${multi ? "switched-on" : ""}"></button>
    <div class="ranged-targets-option active" data-offset="0"><button data-action="range-initiator-shoot"></button></div>
    ${added ? '<div class="ranged-shots"><button data-action="range-initiator-roll"></button></div>' : ""}`;
  const used = [];
  html.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => used.push(b.dataset.set ?? b.dataset.action)));
  return { html, used };
}

test("startAttack: multi-shot turns on Multi. Shots, adds each shot with the target's Shoot, then presses the bottom Shoot", async () => {
  const { env, harvey, gun } = setup();
  await startAttack({ actor: harvey, weapon: gun, ticks: { shots: 3 } });
  const render = (card, added) => {
    const message = rangedMessage(harvey, gun);
    message.flags.CoC7.load.shots = Array(added).fill({});
    env.hooks.renderChatMessageHTML[0](message, card.html);
    mock.timers.tick(CLICK_DELAY_MS);
    return card.used;
  };
  assert.deepEqual(render(multiCard(), 0), ["multipleShots"]);
  for (const added of [0, 1, 2]) assert.deepEqual(render(multiCard({ multi: true, added }), added), ["range-initiator-shoot"]);
  assert.deepEqual(render(multiCard({ multi: true, added: 3 }), 3), ["range-initiator-roll"]);
  assert.equal(env.hooks.renderChatMessageHTML.length, 0);
});

test("startAttack on a player's client: shots alone are fired there; with a Keeper toggle the whole list goes to the Keeper", async () => {
  const { env, harvey, gun } = setup();
  game.user = game.users[1];
  const emitted = [];
  game.socket = { emit: (channel, message) => emitted.push(message), on() {} };
  game.users.activeGM = game.users[0];
  await startAttack({ actor: harvey, weapon: gun, ticks: { shots: 2 } });
  assert.equal(env.hooks.renderChatMessageHTML.length, 1);
  assert.equal(emitted.length, 0);
  await startAttack({ actor: harvey, weapon: gun, ticks: { shots: 2, aiming: true } });
  assert.deepEqual(emitted.map((m) => [m.type, m.payload.ticks.shots]), [["ticks", 2]]);
  assert.equal(env.hooks.renderChatMessageHTML.length, 1);
});

test("startAttack: the Keeper's NPC or creature attack is rolled at once on CoC7's card (rollboxAutoRollNpc), an investigator's with rollboxAutoRollAttacks; not with them off", async () => {
  const { env, harvey, gun } = setup();
  gun.system.properties = { rngd: false };
  const melee = { flags: { CoC7: { load: { as: "CoC7ChatCombatMelee", participant: 0, attackerUuid: harvey.uuid,
    itemUuid: gun.uuid, dicePool: { rolledDice: [] } } } } };
  const card = () => {
    const html = document.createElement("div");
    html.innerHTML = '<button data-action="attackerRoll" data-skill="s1"></button><button data-action="attackerRoll" data-skill="s2"></button>';
    const used = [];
    html.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => used.push(b.dataset.skill)));
    return { html, used };
  };
  harvey.type = "character";
  await startAttack({ actor: harvey, weapon: gun });
  assert.equal(env.hooks.renderChatMessageHTML, undefined);
  env.values.rollboxAutoRollAttacks = true;
  assert.equal((await startAttack({ actor: harvey, weapon: gun })).rolled, true);
  const own = card();
  env.hooks.renderChatMessageHTML[0](melee, own.html);
  mock.timers.tick(CLICK_DELAY_MS);
  assert.deepEqual(own.used, ["s1"]);
  harvey.type = "npc";
  await startAttack({ actor: harvey, weapon: gun });
  const shown = card();
  env.hooks.renderChatMessageHTML[0](melee, shown.html);
  mock.timers.tick(CLICK_DELAY_MS);
  assert.deepEqual(shown.used, ["s1"]);
  assert.equal(env.hooks.renderChatMessageHTML.length, 0);
  env.values.rollboxAutoRollNpc = false;
  await startAttack({ actor: harvey, weapon: gun });
  assert.equal(env.hooks.renderChatMessageHTML.length, 0);
});

test("startAttack on a player's client: their own Roll my attacks at once decides (on by default), not the Keeper's "
  + "Roll investigators' attacks at once", async () => {
  const { env, harvey, gun } = setup();
  harvey.type = "character";
  game.user = game.users[1];
  game.socket = { emit() {}, on() {} };
  game.users.activeGM = game.users[0];
  assert.equal((await startAttack({ actor: harvey, weapon: gun })).rolled, true, "rolled with the Keeper's setting off");
  env.values.rollboxAutoRollAttacks = true;
  env.values.rollboxRollMyAttacks = false;
  assert.equal((await startAttack({ actor: harvey, weapon: gun })).rolled, false);
});

test("startAttack on a player's client, rolled at once: the Keeper sets the toggles; the player's client presses Roll "
  + "once CoC7's saved card shows them set (bug: a player's copy has no keeper-only block to read them from)", async () => {
  const { env, harvey, gun } = setup();
  env.values.rollboxAutoRollAttacks = true;
  game.user = game.users[1];
  const emitted = [];
  game.socket = { emit: (channel, message) => emitted.push(message), on() {} };
  game.users.activeGM = game.users[0];
  const result = await startAttack({ actor: harvey, weapon: gun, ticks: { aiming: true, pointBlank: true, dice: 1 } });
  assert.equal(result.rolled, true);
  assert.deepEqual(emitted.map((m) => m.type), ["ticks"]);
  // A player's copy of CoC7's ranged card: the keeper-only block (target toggles, dice slider) and Aiming left out.
  const playerCopy = () => {
    const html = document.createElement("div");
    html.innerHTML = '<div class="ranged-targets-option active" data-offset="0"></div>';
    const used = [];
    const roll = document.createElement("button");
    roll.dataset.action = "range-initiator-roll";
    roll.addEventListener("click", () => used.push("roll"));
    html.querySelector(".ranged-targets-option").append(roll);
    return { html, used };
  };
  const card = (aiming, keys, dice) => ({ isAuthor: true, flags: { CoC7: { load: { ...rangedMessage(harvey, gun).flags.CoC7.load,
    aiming, targets: [{ active: true, poolKeys: keys, poolModifier: String(dice) }] } } } });
  const before = playerCopy();
  env.hooks.renderChatMessageHTML[0](card(false, [], 0), before.html);
  mock.timers.tick(CLICK_DELAY_MS);
  assert.deepEqual(before.used, []); // the Keeper's toggles aren't set yet: nothing pressed
  const half = playerCopy();
  env.hooks.renderChatMessageHTML[0](card(true, ["pointBlankRange"], 0), half.html);
  mock.timers.tick(CLICK_DELAY_MS);
  assert.deepEqual(half.used, [], "the bonus die isn't on the card yet");
  const after = playerCopy();
  env.hooks.renderChatMessageHTML[0](card(true, ["pointBlankRange"], 1), after.html);
  mock.timers.tick(CLICK_DELAY_MS);
  assert.deepEqual(after.used, ["roll"]);
  assert.equal(env.hooks.renderChatMessageHTML.length, 0);
});

test("keeperTicks: a player's melee attack gets CoC7's Automatic success only when the Keeper granted it (About to "
  + "attack), whatever the player's client asks", async () => {
  const { env, harvey } = setup();
  const knife = { type: "weapon", id: "knife", name: "Knife", uuid: `${harvey.uuid}.Item.knife`, system: { properties: {} } };
  harvey.testUserPermission = (user) => user === game.users[1];
  globalThis.fromUuidSync = (uuid) => (uuid === harvey.uuid ? harvey : null);
  const payload = { actorUuid: harvey.uuid, weaponId: "knife", ranged: false, ticks: { autoSuccess: true } };
  assert.equal(keeperTicks(payload, game.users[1]), true);
  assert.equal(env.hooks.renderChatMessageHTML?.length ?? 0, 0, "not granted: nothing to set");
  grantAutoHit(harvey.uuid);
  keeperTicks(payload, game.users[1]);
  const html = document.createElement("div");
  html.innerHTML = '<button data-action="toggleValue" data-set="isAutoSuccess"></button>';
  const used = [];
  html.querySelector("button").addEventListener("click", () => used.push("auto"));
  const message = { flags: { CoC7: { load: { as: "CoC7ChatCombatMelee", participant: 0, attackerUuid: harvey.uuid,
    itemUuid: knife.uuid, dicePool: { rolledDice: [] } } } } };
  env.hooks.renderChatMessageHTML[0](message, html);
  mock.timers.tick(CLICK_DELAY_MS);
  assert.deepEqual(used, ["auto"]);
});
