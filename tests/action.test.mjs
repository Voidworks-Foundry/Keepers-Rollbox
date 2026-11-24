import assert from "node:assert/strict";
import { test } from "node:test";
import {
  clearPickedOnCombatEnd, combatChanged, encounterChanged, itemChanged, registerActionFlyout, renderActionFlyout,
  sceneChanged
} from "../scripts/flyouts/action/index.js";
import { distanceBetween, weaponsFor } from "../scripts/flyouts/action/weapons.js";
import { maneuverDice } from "../scripts/flyouts/action/maneuver.js";
import { clearTarget, currentTarget, setTypedTarget, targetUpdated, tokenMoved } from "../scripts/flyouts/action/target.js";
import { readCastingTime, spellVerdict } from "../scripts/flyouts/action/casting-time.js";
import { castingMoved, onCastingWindow, onCastingWindowClosed } from "../scripts/flyouts/action/spell-text.js";
import { makeCoC7, makeDom, makeEnv, makeRollActor, resultText } from "./mocks.mjs";

const STATS = { str: 50, con: 60, siz: 65, dex: 55, app: 45, int: 70, pow: 60, edu: 75 };
const BRAWL = { name: "Fighting (Brawl)", value: 50, cocid: "i.skill.fighting-brawl" };
const HANDGUN = { name: "Firearms (Handgun)", value: 40, cocid: "i.skill.firearms-handgun" };

/** Foundry's flags on a mock actor, kept in `actor.flagged`. */
function withFlags(actor) {
  actor.flagged = {};
  actor.getFlag = (scope, key) => actor.flagged[key];
  // Foundry's update merges an object into the object stored there.
  actor.setFlag = async (scope, key, value) => {
    const old = actor.flagged[key];
    const plain = (v) => Boolean(v) && typeof v === "object" && !Array.isArray(v);
    actor.flagged[key] = plain(old) && plain(value) ? { ...old, ...value } : value;
  };
  actor.unsetFlag = async (scope, key) => { delete actor.flagged[key]; };
  return actor;
}

/** A token at (x, y) pixels for this actor; `targets` is the user's Foundry target set. */
function tokenFor(actor, x, y, name = actor.name) {
  const token = { name, actor, center: { x, y }, w: 100, targeted: [] };
  token.setTarget = (on, options) => {
    token.targeted.push([on, options]);
    if (on && options?.releaseOthers) game.user.targets.clear();
    if (on) game.user.targets.add(token);
    else game.user.targets.delete(token);
  };
  return token;
}

/**
 * Keeper's client with CoC7, a scene in feet (100 px a 5 ft square), and Harvey: a knife, a revolver (6 rounds,
 * `ammo` loaded) and a spell. CoC7's weaponCheck, reload and cast are recorded in `calls`.
 */
function setup({ ammo = 4, isGM = true, values = {} } = {}) {
  const env = makeEnv({ isGM, values });
  const calls = makeCoC7();
  calls.weaponChecks = [];
  calls.weaponMethods = [];
  calls.casts = [];
  makeDom();
  game.user.targets = new Set();
  globalThis.canvas = { grid: { size: 100, distance: 5, units: "ft" } };
  globalThis.ui.controls = { activate: (options) => calls.tools = [...(calls.tools ?? []), options.tool] };
  const harvey = withFlags(makeRollActor({ name: "Harvey", characteristics: STATS, skills: [BRAWL, HANDGUN],
    weapons: [{ id: "knife", name: "Switchblade", main: "Fighting (Brawl)" },
      { id: "gun", name: ".38 Revolver", main: "Firearms (Handgun)" }] }));
  harvey.system.attribs.build = { value: 0 };
  harvey.system.attribs.mp = { value: 10, max: 12 };
  const gun = harvey.items.find((i) => i.id === "gun");
  gun.system.properties = { rngd: true };
  gun.system.bullets = 6;
  gun.system.ammo = ammo;
  gun.system.range = { normal: { value: 15, damage: "1D10" } };
  const knife = harvey.items.find((i) => i.id === "knife");
  knife.system.properties = { rngd: false };
  knife.system.range = { normal: { damage: "1D4" } };
  for (const weapon of [gun, knife]) {
    weapon.system.reload = async () => { calls.weaponMethods.push(["reload", weapon.id]); };
    weapon.system.addAmmunition = async () => { calls.weaponMethods.push(["addAmmunition", weapon.id]); };
  }
  harvey.weaponCheck = async (data, fast) => { calls.weaponChecks.push([data, fast]); };
  const cultist = withFlags(makeRollActor({ name: "Cultist", type: "npc", characteristics: STATS, skills: [BRAWL] }));
  cultist.system.attribs.build = { value: 2 };
  harvey.token = null;
  harvey.getActiveTokens = () => [harvey.placed];
  harvey.placed = tokenFor(harvey, 0, 0);
  clearTarget();
  return { env, calls, harvey, cultist, gun, knife };
}

/** The Action flyout for these characters, with helpers to use it like the Keeper. */
function open(actors, start) {
  const body = document.createElement("div");
  document.body.append(body);
  let closed = false;
  renderActionFlyout(body, { actors, start, close: () => { closed = true; } });
  const all = (selector) => [...body.querySelectorAll(selector)];
  const press = (text) => all("button").find((node) => node.textContent === text).click();
  const weapon = (id) => body.querySelector(`.rollbox-action-weapon[data-pick="${id}"]`);
  const text = (selector) => body.querySelector(selector)?.textContent ?? null;
  const result = () => resultText(body.querySelector(".rollbox-result"));
  return { body, all, press, weapon, text, result, closed: () => closed };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 10));

test("registerActionFlyout: only where the panel is (not a player without the Player Rollbox, not with the Rollbox switch off), with its hooks", () => {
  makeEnv({ isGM: false });
  assert.equal(registerActionFlyout(), false);
  const off = makeEnv({ values: { rollboxEnabled: false } });
  assert.equal(registerActionFlyout(), false);
  assert.equal(off.hooks.targetToken, undefined);
  const on = makeEnv({ values: { rollboxEnabled: true } });
  registerActionFlyout();
  assert.equal(on.hooks.targetToken.length, 1);
  assert.equal(on.hooks.deleteCombat.length, 2);
});

test("weaponsFor: unarmed first, melee out of reach (edge to edge, feet converted) greyed, ranged always in reach", () => {
  const { harvey, cultist } = setup();
  const near = weaponsFor(harvey, tokenFor(cultist, 160, 0)); // 3 ft (0.9 m) edge to edge, within the 1 m default
  assert.deepEqual(near.map((e) => [e.weapon.name, e.inReach]),
    [["Unarmed", true], [".38 Revolver", true], ["Switchblade", true]]);
  const far = weaponsFor(harvey, tokenFor(cultist, 400, 0)); // 15 ft = 4.6 m edge to edge, over the 1 m reach
  assert.deepEqual(far.map((e) => [e.weapon.name, e.inReach]),
    [["Unarmed", false], [".38 Revolver", true], ["Switchblade", false]]);
  assert.deepEqual(far[1].ammo, { loaded: 4, capacity: 6 });
  assert.equal(far[2].ammo, null);
});

test("weaponsFor: a melee weapon CoC7 marks ranged (the bullwhip) reaches its own range, 10 ft, not the 1 m reach", () => {
  const { harvey, cultist, knife } = setup();
  knife.name = "Bullwhip";
  knife.system.properties = { rngd: true };
  knife.system.skill.main = { name: "Fighting (Whip)" };
  knife.system.range = { normal: { value: "10/3", damage: "1D3" } };
  const whip = (x) => weaponsFor(harvey, tokenFor(cultist, x, 0)).find((e) => e.weapon === knife);
  assert.equal(whip(230).inReach, true); // 6.5 ft (2 m) edge to edge
  assert.equal(whip(330).inReach, false); // 11.5 ft
  assert.ok(Math.abs(whip(330).reach - 3.048) < 0.001);
});

test("a move of the target's token redraws the open flyout's reach and distance; another token's move doesn't", () => {
  const { harvey, cultist } = setup();
  const target = tokenFor(cultist, 160, 0);
  target.setTarget(true, { releaseOthers: true });
  const menu = open([harvey]);
  assert.equal(menu.weapon("knife").disabled, false);
  assert.match(menu.text(".rollbox-action-target-facts"), /^3 ft away/);
  target.center = { x: 400, y: 0 };
  tokenMoved({ id: "elsewhere" }, { x: 10 });
  assert.equal(menu.weapon("knife").disabled, false);
  assert.equal(tokenMoved(target, { elevation: 5 }), false);
  tokenMoved(target, { x: 400 });
  assert.equal(menu.weapon("knife").disabled, true);
  assert.match(menu.text(".rollbox-action-target-facts"), /^15 ft away/);
});

test("distanceBetween: edge to edge in the scene's units, never below 0; a unit Rollbox can't convert greys nothing", () => {
  const { harvey, cultist } = setup();
  assert.deepEqual(distanceBetween(harvey.placed, tokenFor(cultist, 300, 0)), { distance: 10, units: "ft", metres: 3.048 });
  assert.equal(distanceBetween(harvey.placed, tokenFor(cultist, 50, 0)).distance, 0);
  canvas.grid.units = "hexes";
  assert.equal(distanceBetween(harvey.placed, tokenFor(cultist, 900, 0)).metres, null);
  assert.ok(weaponsFor(harvey, tokenFor(cultist, 900, 0)).every((e) => e.inReach));
});

test("maneuverDice: a penalty die per point of target Build over the attacker; impossible at three (p. 105)", () => {
  assert.deepEqual(maneuverDice(1, 0), { dice: 0, impossible: false, known: true });
  assert.deepEqual(maneuverDice(0, 2), { dice: -2, impossible: false, known: true });
  assert.equal(maneuverDice(0, 3).impossible, true);
  assert.equal(maneuverDice(null, 2).known, false);
});

test("target box: a typed target releases Foundry's targets and is the target", () => {
  const { harvey, cultist } = setup();
  const token = tokenFor(cultist, 100, 0);
  token.setTarget(true, { releaseOthers: true });
  assert.equal(currentTarget().token, token);
  setTypedTarget("the door");
  assert.deepEqual(currentTarget(), { token: null, text: "the door" });
  assert.equal(game.user.targets.size, 0);
  assert.equal(harvey.name, "Harvey");
});

test("target box: Target a token switches the Keeper to Foundry's target tool, and back after a target", async () => {
  const { env, calls, harvey, cultist } = setup();
  env.values.rollboxEnabled = true;
  registerActionFlyout();
  const flyout = open([harvey]);
  flyout.press("Target a token");
  await settle();
  const token = tokenFor(cultist, 100, 0, "Hooded figure");
  token.setTarget(true, { releaseOthers: true });
  Hooks.call("targetToken", game.user, token, true);
  assert.deepEqual(calls.tools, ["target", "select"]);
  assert.equal(flyout.text(".rollbox-action-target-name"), "Hooded figure");
  assert.equal(flyout.text(".rollbox-action-target-facts"), "0 ft away · Build 2");
});

test("Attack tab: picking a weapon saves it on the character; Attack targets the token and makes CoC7's card; no surprise card", async () => {
  const { env, calls, harvey, cultist, knife } = setup();
  const token = tokenFor(cultist, 100, 0);
  token.setTarget(true, { releaseOthers: true });
  const flyout = open([harvey]);
  flyout.weapon("knife").click();
  assert.equal(harvey.flagged.pickedWeapon, "knife");
  flyout.body.querySelector(".rollbox-action-go").click();
  await settle();
  assert.deepEqual(calls.weaponChecks, [[{ uuid: knife.uuid }, false]]);
  assert.deepEqual(token.targeted.at(-1), [true, { releaseOthers: true }]);
  assert.match(flyout.result()[0], /attack card made for Switchblade/);
  // CoC7's own card carries Surprise: Rollbox posts nothing of its own for an attack.
  assert.deepEqual(env.chat, []);
});

test("Attack tab: a weapon picked with no encounter running brings up the Keeper's weapon-drawn pop-up", async () => {
  const { env, harvey } = setup();
  const flyout = open([harvey]);
  flyout.weapon("gun").click();
  await settle();
  assert.equal(env.chat.length, 0, "no chat card");
  assert.ok(document.querySelector(".rollbox-popup[data-kind='weaponDrawn']"));
  assert.match(flyout.result().join(" "), /above your hotbar/);
  document.querySelector(".rollbox-fight-notices")?.remove();
});

test("Attack tab: the picked weapon clicked again is put away; in combat with CoC7's Draw gun on, holstering or "
  + "switching to a melee weapon asks first with the drop to DEX, and Cancel keeps the gun", async () => {
  const { harvey } = setup();
  harvey.flagged.pickedWeapon = "knife";
  let flyout = open([harvey]);
  flyout.weapon("knife").click();
  await settle();
  assert.equal(harvey.flagged.pickedWeapon, undefined, "out of combat: put away at once");
  assert.equal(flyout.body.querySelector(".rollbox-action-prompt"), null);
  harvey.flagged.pickedWeapon = "gun";
  const combatant = { actor: harvey, initiative: 110, getFlag: (scope, key) => scope === "CoC7" && key === "hasGun" };
  game.combat = { id: "c1", started: true, round: 1, turn: 0, turns: [combatant] };
  flyout = open([harvey]);
  flyout.weapon("gun").click();
  await settle();
  assert.match(flyout.text(".rollbox-action-prompt"), /Holstering .*\(110 → 55\)\. Holster\?/);
  flyout.press("Cancel");
  await settle();
  assert.equal(harvey.flagged.pickedWeapon, "gun");
  flyout.weapon("knife").click();
  await settle();
  assert.match(flyout.text(".rollbox-action-prompt"), /Switching to Switchblade .*Switch\?/);
  flyout.press("Switch");
  await settle();
  assert.equal(harvey.flagged.pickedWeapon, "knife");
  harvey.flagged.pickedWeapon = "gun";
  flyout = open([harvey]);
  flyout.weapon("gun").click();
  await settle();
  flyout.press("Holster");
  await settle();
  assert.equal(harvey.flagged.pickedWeapon, undefined);
  game.combat = undefined;
});

test("Attack tab: the target dived for cover sets Under cover, not a die; the aimed shot ends Aiming", async () => {
  const { harvey, cultist } = setup();
  game.combat = { id: "c1", started: true, round: 2 };
  harvey.flagged.roundNotes = { combat: "c1", round: 2, aiming: true };
  cultist.flagged.roundNotes = { combat: "c1", round: 2, dived: true };
  tokenFor(cultist, 400, 0).setTarget(true, { releaseOthers: true });
  const flyout = open([harvey]);
  const box = flyout.body.querySelector(".rollbox-action-target");
  flyout.weapon("gun").click();
  const after = flyout.body.querySelector(".rollbox-action-target");
  assert.deepEqual([after.dataset.toggles, after.dataset.net], ["cover", "0"]);
  assert.ok(box);
  flyout.body.querySelector(".rollbox-action-go").click();
  await settle();
  assert.equal(harvey.flagged.roundNotes.aiming, false);
  game.combat = undefined;
});

test("Attack tab: a melee weapon out of reach can't be picked; a gun not full adds Reload beside Attack out of combat, a Reload line of its own in combat, and Aim only in combat", async () => {
  const { calls, harvey, cultist } = setup();
  tokenFor(cultist, 400, 0).setTarget(true, { releaseOthers: true });
  const flyout = open([harvey]);
  assert.equal(flyout.weapon("knife").disabled, true);
  assert.match(flyout.weapon("knife").textContent, /Out of reach/);
  flyout.weapon("gun").click();
  assert.deepEqual(flyout.all(".rollbox-actions > button").map((b) => b.textContent), ["Attack", "Reload", "Cancel"]);
  flyout.body.querySelector(".rollbox-action-reload").click(); // out of combat: a full reload, no turn used
  await settle();
  assert.deepEqual(calls.weaponMethods, [["reload", "gun"]]);
  assert.equal(harvey.flagged.roundNotes, undefined);
  game.combat = { id: "c1", started: true, round: 1, turns: [{ actor: harvey }] };
  const inCombat = open([harvey]);
  assert.deepEqual(inCombat.all(".rollbox-actions:not(.rollbox-action-reload-line) > button").map((b) => b.textContent),
    ["Attack", "Aim", "Cancel"]);
  assert.deepEqual(inCombat.all(".rollbox-action-reload-line > button > span:first-child").map((b) => b.textContent),
    ["Reload 2 rounds", "Load one and fire"]);
  game.combat = undefined;
});

test("Empty firearm: the picked row spells out its ammunition; in combat Reload and Load one and fire, out of combat Reload only; Attack is greyed", async () => {
  const { calls, harvey } = setup({ ammo: 0 });
  harvey.flagged.pickedWeapon = "gun";
  const outside = open([harvey]);
  assert.equal(outside.body.querySelector(".rollbox-action-load-one"), null);
  assert.equal(outside.body.querySelector(".rollbox-action-reload").disabled, false);
  game.combat = { id: "c1", started: true, round: 1, turns: [{ actor: harvey }] };
  const flyout = open([harvey]);
  assert.ok(flyout.all(".rollbox-action-weapon-detail").some((n) => n.textContent.includes("Ammunition 0/6")));
  assert.equal(flyout.body.querySelector(".rollbox-action-go").disabled, true);
  flyout.body.querySelector(".rollbox-action-load-one").click();
  await settle();
  assert.deepEqual(calls.weaponMethods, [["addAmmunition", "gun"]]);
  assert.equal(calls.weaponChecks.length, 1);
  // The attack spent the action: the Keeper is asked before a second one.
  flyout.body.querySelector(".rollbox-action-reload").click();
  await settle();
  assert.equal(calls.weaponMethods.length, 1);
  assert.match(flyout.text(".rollbox-action-override-prompt"), /Harvey has already acted this round\. Override\?/);
  flyout.body.querySelector(".rollbox-action-override-prompt .rollbox-action-prompt-yes").click();
  await settle();
  assert.deepEqual(calls.weaponMethods.slice(1), [["addAmmunition", "gun"], ["addAmmunition", "gun"]]);
  game.combat = undefined;
});

test("bug: Reload in combat loads two rounds into a revolver, a new magazine into an automatic, and uses the turn", async () => {
  const { calls, harvey, gun } = setup({ ammo: 2 });
  harvey.flagged.pickedWeapon = "gun";
  game.combat = { id: "c1", started: true, round: 1, turns: [{ actor: harvey }] };
  const revolver = open([harvey]);
  assert.match(revolver.text(".rollbox-action-reload"), /^Reload 2 rounds/);
  revolver.body.querySelector(".rollbox-action-reload").click();
  await settle();
  assert.deepEqual(calls.weaponMethods, [["addAmmunition", "gun"], ["addAmmunition", "gun"]]);
  assert.equal(harvey.flagged.roundNotes.acted, true);
  assert.match(revolver.text(".rollbox-result-line"), /Loaded two rounds/);
  gun.name = ".45 Automatic";
  gun.system.ammo = 0;
  calls.weaponMethods.length = 0;
  const automatic = open([harvey]);
  assert.match(automatic.text(".rollbox-action-reload"), /New magazine/);
  automatic.body.querySelector(".rollbox-action-reload").click();
  automatic.body.querySelector(".rollbox-action-override-prompt .rollbox-action-prompt-yes").click();
  await settle();
  assert.deepEqual(calls.weaponMethods, [["reload", "gun"]]);
  game.combat = undefined;
});

test("Improvised weapon: sent as a labelled Fighting (Brawl) check with damage, no attack card", async () => {
  const { env, calls, harvey } = setup();
  harvey.owners = [game.users[1]];
  const flyout = open([harvey]);
  flyout.weapon("improvised").click();
  const what = flyout.body.querySelector(".rollbox-action-what");
  what.value = "Candlestick";
  what.dispatchEvent(new document.defaultView.Event("input"));
  const damage = flyout.body.querySelector(".rollbox-action-damage");
  damage.value = "1D4+DB";
  damage.dispatchEvent(new document.defaultView.Event("input"));
  flyout.body.querySelector(".rollbox-action-go").click();
  await settle();
  assert.equal(calls.weaponChecks.length, 0);
  assert.match(env.chat[0].content, /Fighting \(Brawl\) with Candlestick/);
});

/** CoC7's Punch in its compendium, and the actor's sheet taking what Rollbox adds (recorded in `calls.added`). */
function coc7Punch(actor, calls) {
  calls.added = [];
  game.CoC7.cocid.fromCoCIDBest = async () => [{ uuid: "Compendium.CoC7.items.Item.punch" }];
  globalThis.fromUuid = async () => ({ type: "weapon", toObject: () => ({ _id: "src", name: "Punch", type: "weapon",
    flags: { CoC7: { cocidFlag: { id: "i.weapon.brawl" } } },
    system: { skill: { main: { id: "", name: "i.skill.brawl" } }, properties: { mnvr: false },
      range: { normal: { damage: "1D3" } } } }) });
  actor.createEmbeddedDocuments = async (type, data) => data.map((d, i) => {
    calls.added.push(d);
    const item = { ...d, id: `added${i}`, uuid: `${actor.uuid}.Item.added${i}` };
    actor.items.push(item);
    return item;
  });
}

/** Harvey's own Punch: CoC7's unarmed weapon on Fighting (Brawl), its Maneuver off. */
function punchFor(actor) {
  const punch = { type: "weapon", id: "punch", name: "Punch", uuid: `${actor.uuid}.Item.punch`,
    flags: { CoC7: { cocidFlag: { id: "i.weapon.brawl" } } },
    system: { skill: { main: { id: "", name: "Fighting (Brawl)" } }, properties: { mnvr: false, rngd: false },
      range: { normal: { damage: "1D3" } } } };
  punch.update = async (changes) => { punch.updates = [...(punch.updates ?? []), changes];
    if (changes["system.properties.mnvr"] !== undefined) punch.system.properties.mnvr = changes["system.properties.mnvr"]; };
  actor.items.push(punch);
  return punch;
}

const noticeFlag = (message) => message.flags["keepers-rollbox"].maneuver;

test("Maneuver tab: a Punch with Maneuver off asks the Keeper to switch it on, then posts the notice; no CoC7 card yet", async () => {
  const { env, calls, harvey, cultist } = setup();
  const punch = punchFor(harvey);
  cultist.system.attribs.build.value = 1;
  tokenFor(cultist, 100, 0).setTarget(true, { releaseOthers: true });
  const flyout = open([harvey], { tab: "maneuver" });
  flyout.press("Attempt to restrain"); // the button names the goal
  assert.equal(flyout.text(".rollbox-action-prompt"),
    "Harvey has no maneuver weapon.Switch Maneuver on for Harvey's Punch?Switch onCancel");
  flyout.press("Switch on");
  await settle();
  assert.deepEqual(punch.updates, [{ "system.properties.mnvr": true }]); // CoC7's own toggle's change
  const [notice] = env.chat;
  assert.match(notice.content, /Harvey attempts to restrain \(maneuver\) Cultist\./);
  assert.deepEqual(noticeFlag(notice), { attacker: harvey.uuid, target: cultist.uuid, weapon: "punch", goal: "restrain",
    answer: null, defence: null, card: null });
  assert.equal(calls.weaponChecks.length, 0); // CoC7's opposed card comes once the target answers
  // Restrain (the first goal): the Keeper can then set Restrained on the target, Rollbox's own note.
  flyout.press("Set Restrained: Cultist");
  await settle();
  assert.equal(cultist.flagged["statuses.restrained"], true);
  cultist.system.attribs.build.value = 3;
  const big = open([harvey], { tab: "maneuver" });
  assert.equal(big.all("button").find((b) => b.textContent === "Attempt to restrain").disabled, true);
});

test("Maneuver tab: with no Punch the Keeper adds one with Maneuver on; Cancel adds nothing; a player is told to ask", async () => {
  const { env, calls, harvey, cultist } = setup();
  coc7Punch(harvey, calls);
  tokenFor(cultist, 100, 0).setTarget(true, { releaseOthers: true });
  const flyout = open([harvey], { tab: "maneuver" });
  flyout.press("Attempt to restrain");
  flyout.press("Cancel");
  await settle();
  assert.deepEqual([calls.added.length, env.chat.length], [0, 0]);
  game.user.isGM = false;
  const player = open([harvey], { tab: "maneuver" });
  assert.match(player.body.textContent, /Your sheet has no Punch\. Ask your Keeper to add it\./);
  game.user.isGM = true;
  const keeper = open([harvey], { tab: "maneuver" });
  keeper.press("Attempt to restrain");
  assert.match(keeper.text(".rollbox-action-prompt"), /Add Punch to Harvey's sheet\?Its Maneuver is switched on\./);
  keeper.press("Add");
  await settle();
  assert.equal(calls.added.length, 1);
  assert.equal(calls.added[0].system.properties.mnvr, true);
  assert.equal(calls.added[0].flags.CoC7.cocidFlag.id, "i.weapon.brawl"); // still CoC7's unarmed weapon
  assert.equal(noticeFlag(env.chat[0]).weapon, "added0");
});

test("Maneuver tab: a player's Punch with Maneuver off: ask the Keeper to switch it on", () => {
  const { harvey, cultist } = setup({ isGM: false });
  punchFor(harvey);
  tokenFor(cultist, 100, 0).setTarget(true, { releaseOthers: true });
  const player = open([harvey], { tab: "maneuver" });
  assert.match(player.body.textContent, /Your Punch has Maneuver off\. Ask your Keeper to switch it on\./);
});

test("Maneuver tab: a creature's own (mnvr) attack is listed first and used at once, with no prompt", async () => {
  const { env, cultist, harvey } = setup();
  cultist.type = "creature";
  const seize = { type: "weapon", id: "seize", name: "Seize (mnvr)", uuid: `${cultist.uuid}.Item.seize`, flags: {},
    system: { skill: { main: { id: "", name: "Fighting (Brawl)" } }, properties: { mnvr: true } } };
  const generic = { ...seize, id: "gen", name: "Maneuver (Fighting)", uuid: `${cultist.uuid}.Item.gen` };
  cultist.items.push(generic, seize);
  tokenFor(harvey, 100, 0).setTarget(true, { releaseOthers: true });
  const flyout = open([cultist], { tab: "maneuver" });
  assert.deepEqual(flyout.all(".rollbox-action-maneuvers .rollbox-action-weapon-name").map((n) => n.textContent),
    ["Seize (mnvr)", "Maneuver (Fighting)"]);
  flyout.press("Attempt to restrain");
  await settle();
  assert.equal(noticeFlag(env.chat[0]).weapon, "seize");
});

test("bug: a Punch with Maneuver on is still the unarmed weapon, and attacks with CoC7's attack card", async () => {
  const { calls, harvey, cultist } = setup();
  const punch = punchFor(harvey);
  punch.system.properties.mnvr = true;
  tokenFor(cultist, 100, 0).setTarget(true, { releaseOthers: true });
  const flyout = open([harvey]);
  flyout.weapon("punch").click();
  flyout.body.querySelector(".rollbox-action-go").click();
  await settle();
  assert.deepEqual(calls.weaponChecks, [[{ uuid: punch.uuid }, false]]);
});

test("Spell tab: Cast runs CoC7's cast; an investigator's first casting asks for Hard POW, then Mark as cast", async () => {
  const { env, calls, harvey } = setup();
  harvey.owners = [game.users[1]];
  harvey.items.push({ type: "spell", id: "shrivel", name: "Shrivelling", system: { castingTime: "1 round",
    costs: { magicPoints: "5", sanity: "1D6" }, costList: [], type: { combat: true },
    cast: async (hidden) => { calls.casts.push(hidden); } } });
  const flyout = open([harvey], { tab: "spell" });
  assert.equal(flyout.text(".rollbox-action-mp"), "MP 10/12");
  flyout.press("Cast hidden");
  await settle();
  assert.deepEqual(calls.casts, [true]);
  assert.match(env.chat[0].content, /First casting: Shrivelling/);
  flyout.press("Mark Shrivelling as cast");
  await settle();
  assert.deepEqual(harvey.flagged.castSpells, ["shrivel"]);
});

test("Spell tab: a player who casts gets no Mark as cast (the Keeper's fallback), so the first casting's Hard POW stays", async () => {
  const { calls, harvey } = setup({ isGM: false, values: { rollboxPlayerRollbox: true, rollboxPlayerActions: true } });
  harvey.owners = [game.users[1]];
  harvey.items.push({ type: "spell", id: "shrivel", name: "Shrivelling", system: { castingTime: "1 round",
    costs: { magicPoints: "5", sanity: "1D6" }, costList: [], type: { combat: true },
    cast: async (hidden) => { calls.casts.push(hidden); } } });
  const flyout = open([harvey], { tab: "spell" });
  flyout.press("Cast");
  await settle();
  assert.deepEqual(calls.casts, [false]);
  assert.equal(document.querySelector(".rollbox-action-mark-cast"), null);
});

test("Spell tab: a first-casting Hard POW that CoC7 rolls a success marks the spell as cast by itself; a failure doesn't", async () => {
  const { env, harvey } = setup();
  harvey.owners = [game.users[1]];
  harvey.uuid = "Actor.harvey";
  harvey.items.push({ type: "spell", id: "shrivel", name: "Shrivelling", system: { costs: {}, costList: [],
    cast: async () => {} } });
  let success = false;
  game.CoC7.messageResults = async () => [{ isRolled: true, isSuccess: success, type: "characteristic", key: "pow" }];
  const card = { id: "r1", flags: { CoC7: { load: { as: "CoC7Check", actorUuid: "Actor/harvey" } } } };
  const flyout = open([harvey], { tab: "spell" });
  flyout.press("Cast");
  await settle();
  env.hooks.createChatMessage.forEach((f) => f(card));
  await settle();
  assert.equal(harvey.flagged.castSpells, undefined); // failed: still not cast, and no longer watched
  flyout.press("Cast");
  await settle();
  success = true;
  env.hooks.createChatMessage.forEach((f) => f(card));
  await settle();
  assert.deepEqual(harvey.flagged.castSpells, ["shrivel"]);
});

test("Spell tab: an NPC casts with no first-casting roll", async () => {
  const { env, calls, cultist } = setup();
  cultist.items.push({ type: "spell", id: "s", name: "Dominate", system: { costs: {}, costList: [],
    cast: async (hidden) => { calls.casts.push(hidden); } } });
  const flyout = open([cultist], { tab: "spell" });
  flyout.press("Cast");
  await settle();
  assert.deepEqual(calls.casts, [false]);
  assert.equal(env.chat.length, 0);
});

test("Two selected: the first acts and the second is the target (the Keeper's Foundry target); Swap switches them", () => {
  const { harvey, cultist } = setup();
  cultist.getActiveTokens = () => [tokenFor(cultist, 100, 0)];
  const flyout = open([harvey, cultist]);
  assert.equal(flyout.text(".rollbox-action-acting-name"), "Harvey");
  assert.equal(flyout.text(".rollbox-action-target-name"), "Cultist");
  assert.ok(flyout.weapon("gun"));
  flyout.press("⇅ Swap");
  assert.equal(flyout.text(".rollbox-action-acting-name"), "Cultist");
  assert.equal(flyout.text(".rollbox-action-target-name"), "Harvey");
  assert.equal(flyout.weapon("gun"), null);
});

test("clearPickedOnCombatEnd: every combatant's picked weapon is forgotten; nothing on a player's client", async () => {
  const { harvey, cultist } = setup();
  harvey.flagged.pickedWeapon = "gun";
  const combat = { combatants: [{ actor: harvey }, { actor: cultist }, { actor: null }] };
  assert.equal(await clearPickedOnCombatEnd(combat), 1);
  assert.equal(harvey.flagged.pickedWeapon, undefined);
  game.user = game.users[1];
  harvey.flagged.pickedWeapon = "gun";
  assert.equal(await clearPickedOnCombatEnd(combat), 0);
});

test("target box: the target's statuses set while the flyout is open (CoC7's Prone, an active effect) show at once, one line each", () => {
  const { harvey, cultist } = setup();
  tokenFor(cultist, 100, 0).setTarget(true, { releaseOthers: true });
  const menu = open([harvey]);
  assert.equal(menu.all(".rollbox-action-effect").length, 0);
  cultist.statuses = new Set(["prone"]);
  targetUpdated({ documentName: "ActiveEffect", parent: cultist });
  assert.deepEqual(menu.all(".rollbox-action-effect").map((row) => row.textContent), ["ProneEffect: none"]);
});

test("target box: one line per status, the net line only when there is an effect to apply", () => {
  const { harvey, cultist } = setup();
  cultist.statuses = new Set(["prone"]);
  cultist.system.conditions = { indefInsane: { value: true } };
  tokenFor(cultist, 120, 0).setTarget(true, { releaseOthers: true });
  const menu = open([harvey]);
  menu.weapon("knife").click();
  assert.deepEqual(menu.all(".rollbox-action-effect").map((row) => row.textContent),
    ["ProneEffect: 1 bonus die", "Indefinite insanityEffect: none", "On CoC7's attack card1 bonus die"]);
  cultist.statuses = new Set();
  targetUpdated(cultist);
  assert.deepEqual(menu.all(".rollbox-action-effect").map((row) => row.textContent), ["Indefinite insanityEffect: none"]);
});

test("target box: point blank is a fifth of the shooter's DEX in feet, edge to edge: a prone target gives no penalty die", () => {
  const { harvey, cultist } = setup();
  cultist.statuses = new Set(["prone"]);
  const near = tokenFor(cultist, 300, 0); // 10 ft edge to edge; Harvey's DEX 55 gives 11 ft
  near.setTarget(true, { releaseOthers: true });
  const menu = open([harvey]);
  menu.weapon("gun").click();
  assert.equal(menu.body.querySelector(".rollbox-action-target").dataset.toggles, "pointBlank");
  assert.match(menu.body.querySelector('[data-status="prone"]').title, /no penalty at point blank/);
  tokenFor(cultist, 400, 0).setTarget(true, { releaseOthers: true });
  const far = open([harvey]);
  far.weapon("gun").click();
  assert.equal(far.body.querySelector(".rollbox-action-target").dataset.toggles, "");
  assert.match(far.body.querySelector('[data-status="prone"]').title, /smaller target/);
});

test("Attack tab: a gun emptied outside the flyout (CoC7's sheet or card) greys Attack at once", () => {
  const { harvey, gun } = setup();
  const menu = open([harvey]);
  menu.weapon("gun").click();
  assert.equal(menu.body.querySelector(".rollbox-action-go").disabled, false);
  gun.system.ammo = 0;
  itemChanged({ parent: harvey });
  assert.equal(menu.body.querySelector(".rollbox-action-go").disabled, true);
  assert.equal(menu.body.querySelector(".rollbox-action-reload").disabled, false);
});

test("Reload posts the reload card: the character speaks, whispered to the Keepers and the character's players", async () => {
  const { env, harvey, gun } = setup({ ammo: 2 });
  harvey.owners = [game.users[1]];
  harvey.system.infos = { sex: "Male" };
  gun.system.reload = async () => { gun.system.ammo = 6; };
  ChatMessage.getSpeaker = ({ actor }) => ({ actor: actor.name });
  harvey.flagged.pickedWeapon = "gun";
  open([harvey]).body.querySelector(".rollbox-action-reload").click();
  await settle();
  const [card] = env.chat;
  assert.match(card.content, /Harvey reloads his \.38 Revolver \(6\/6\)\./);
  assert.deepEqual(card.whisper, ["gm1", "p1"]);
  assert.deepEqual(card.speaker, { actor: "Harvey" });
});

test("Multi-shot: a gun with several shots a round offers Single shot · Multi-shot; Multi-shot's Shots row fires that many on CoC7's card", async () => {
  const { env, harvey, gun } = setup({ ammo: 2 });
  gun.system.usesPerRound = { normal: "1", max: "3" };
  harvey.flagged.pickedWeapon = "gun";
  const flyout = open([harvey]);
  assert.equal(flyout.body.querySelector(".rollbox-action-shots"), null);
  flyout.press("Multi-shot");
  const shots = flyout.all(".rollbox-action-shots button");
  assert.deepEqual(shots.map((b) => [b.textContent, b.disabled, b.getAttribute("aria-pressed")]),
    [["1", false, "false"], ["2", false, "true"], ["3", true, "false"]]);
  flyout.body.querySelector(".rollbox-action-go").click();
  await settle();
  assert.match(flyout.result().join(" "), /Rollbox fires 2 shots/);
  assert.equal(env.hooks.renderChatMessageHTML.length, 1);
  gun.system.usesPerRound = { normal: "1", max: "1" };
  assert.equal(open([harvey]).body.querySelector(".rollbox-action-fire"), null);
});

test("bug: a player whose character dived for cover this round can't attack; the Keeper only sees the note", () => {
  const { harvey, cultist } = setup({ isGM: false, values: { rollboxPlayerRollbox: true } });
  game.combat = { id: "c1", started: true, round: 2 };
  harvey.flagged.roundNotes = { combat: "c1", round: 2, dived: true };
  tokenFor(cultist, 100, 0).setTarget(true, { releaseOthers: true });
  const flyout = open([harvey]);
  flyout.weapon("knife").click();
  assert.match(flyout.text(".rollbox-action-warning"), /dived for cover/i);
  assert.equal(flyout.body.querySelector(".rollbox-action-go").disabled, true);
  globalThis.game.user.isGM = true;
  const keeper = open([harvey]);
  keeper.weapon("knife").click();
  assert.equal(keeper.body.querySelector(".rollbox-action-go").disabled, false);
  game.combat = undefined;
});

test("a player who has acted can't attack by typing an improvised weapon: Attack stays greyed and sends nothing", async () => {
  const { env, calls, harvey } = setup({ isGM: false, values: { rollboxPlayerRollbox: true } });
  game.combat = { id: "c1", started: true, round: 2 };
  harvey.flagged.roundNotes = { combat: "c1", round: 2, acted: true };
  const flyout = open([harvey]);
  flyout.weapon("improvised").click();
  const what = flyout.body.querySelector(".rollbox-action-what");
  what.value = "Candlestick";
  what.dispatchEvent(new document.defaultView.Event("input"));
  const go = flyout.body.querySelector(".rollbox-action-go");
  assert.equal(go.disabled, true);
  go.disabled = false;
  go.click();
  flyout.weapon("knife").click();
  const attack = flyout.body.querySelector(".rollbox-action-go");
  attack.disabled = false;
  attack.click();
  await settle();
  assert.deepEqual([env.chat.length, calls.weaponChecks.length], [0, 0]);
  game.combat = undefined;
});

test("a spent character: each tab's content and act buttons greyed (tabs and warning clear); the Keeper's act button "
  + "reads Override, ungreyed, on hover; a player's can't be pressed", () => {
  for (const isGM of [true, false]) {
    const { harvey } = setup({ isGM, values: { rollboxPlayerRollbox: true } });
    game.combat = { id: "c1", started: true, round: 2 };
    harvey.flagged.roundNotes = { combat: "c1", round: 2, acted: true };
    for (const tab of ["attack", "maneuver", "spell"]) {
      const flyout = open([harvey], { tab });
      const acts = flyout.all(".rollbox-action-go, .rollbox-action-cast");
      assert.ok(flyout.all(".rollbox-action-greyed").length > 0, `${tab}: content greyed`);
      assert.ok(acts.every((node) => node.classList.contains("rollbox-action-greyed-button")
        && !node.closest(".rollbox-action-greyed")), `${tab}: act buttons greyed on their own`);
      assert.equal(flyout.body.querySelector(".rollbox-action-tabs, .rollbox-action-warning")
        .closest(".rollbox-action-greyed"), null);
      for (const node of acts) assert.equal(node.classList.contains("rollbox-action-override"), isGM);
      if (!isGM) assert.ok(acts.every((node) => node.disabled), `${tab}: a player's act buttons off`);
    }
  }
  game.combat = undefined;
});

test("Spell tab: a redraw while a cast is being sent doesn't let Cast run twice", async () => {
  const { calls, harvey } = setup();
  let finish;
  harvey.items.push({ type: "spell", id: "shrivel", name: "Shrivelling", system: { castingTime: "1 round",
    costs: {}, costList: [], type: { combat: true },
    cast: (hidden) => new Promise((resolve) => { calls.casts.push(hidden); finish = resolve; }) } });
  harvey.flagged.castSpells = ["shrivel"];
  const flyout = open([harvey], { tab: "spell" });
  flyout.press("Cast");
  itemChanged({ parent: harvey });
  const again = flyout.all("button").find((node) => node.textContent === "Cast");
  assert.equal(again.disabled, true);
  again.disabled = false;
  again.click();
  finish();
  await settle();
  assert.deepEqual(calls.casts, [false]);
});

test("unarmed with none on the sheet: the Keeper's prompt adds CoC7's Punch on the character's Brawl, then attacks", async () => {
  const { calls, cultist, harvey } = setup();
  coc7Punch(cultist, calls);
  cultist.weaponCheck = async (data) => { calls.weaponChecks.push(data); };
  tokenFor(harvey, 100, 0).setTarget(true, { releaseOthers: true });
  const flyout = open([cultist]);
  flyout.weapon("unarmed").click();
  flyout.body.querySelector(".rollbox-action-go").click();
  assert.match(flyout.text(".rollbox-action-prompt"), /no unarmed attack.*Add Punch/);
  assert.equal(calls.weaponChecks.length, 0);
  flyout.press("Add");
  await settle();
  assert.equal(calls.added[0].name, "Punch");
  const brawl = cultist.items.find((item) => item.name === "Fighting (Brawl)");
  assert.deepEqual(calls.added[0].system.skill.main, { id: brawl.id, name: "Fighting (Brawl)" });
  assert.deepEqual(calls.weaponChecks, [{ uuid: `${cultist.uuid}.Item.added0` }]);
});

test("bug: an unarmed weapon whose skill CoC7 can't find (no roll button on its card) asks to link it first", async () => {
  const { calls, cultist, harvey } = setup();
  const updates = [];
  const punch = { type: "weapon", id: "punch", name: "Punch", uuid: `${cultist.uuid}.Item.punch`,
    flags: { CoC7: { cocidFlag: { id: "i.weapon.brawl" } } },
    system: { skill: { main: { id: "", name: "i.skill.brawl" } }, properties: {}, isSkillSet: false },
    update: async (data) => { updates.push(data); punch.system.isSkillSet = true; } };
  cultist.items.push(punch);
  cultist.weaponCheck = async (data) => { calls.weaponChecks.push(data); };
  tokenFor(harvey, 100, 0).setTarget(true, { releaseOthers: true });
  const flyout = open([cultist]);
  flyout.weapon("punch").click();
  flyout.body.querySelector(".rollbox-action-go").click();
  assert.match(flyout.text(".rollbox-action-prompt"), /Punch has no skill on Cultist's sheet.*Link it to Fighting \(Brawl\)\?/);
  flyout.press("Fix");
  await settle();
  const brawl = cultist.items.find((item) => item.name === "Fighting (Brawl)");
  assert.deepEqual(updates, [{ "system.skill.main.id": brawl.id, "system.skill.main.name": "Fighting (Brawl)" }]);
  assert.deepEqual(calls.weaponChecks, [{ uuid: punch.uuid }]);
});

test("a player with no unarmed weapon is told to ask their Keeper; a melee attack with no target waits for one", () => {
  const { harvey, cultist } = setup({ isGM: false, values: { rollboxPlayerRollbox: true } });
  const flyout = open([harvey]);
  flyout.weapon("unarmed").click();
  assert.match(flyout.body.textContent, /Your sheet has no Punch\. Ask your Keeper to add it\./);
  assert.equal(flyout.body.querySelector(".rollbox-action-go").disabled, true);
  flyout.weapon("knife").click();
  assert.match(flyout.body.textContent, /A melee attack needs a target/);
  tokenFor(cultist, 100, 0).setTarget(true, { releaseOthers: true });
  assert.equal(open([harvey]).body.querySelector(".rollbox-action-go").disabled, false);
});

test("a player in combat on someone else's turn can open and prepare (pick a weapon); the act buttons wait for their turn", () => {
  const { harvey, cultist } = setup({ isGM: false, values: { rollboxPlayerRollbox: true } });
  game.combat = { id: "c1", started: true, round: 1, turns: [{ actor: harvey }, { actor: cultist }],
    combatant: { actor: cultist } };
  tokenFor(cultist, 100, 0).setTarget(true, { releaseOthers: true });
  const flyout = open([harvey]);
  flyout.weapon("knife").click();
  assert.equal(harvey.flagged.pickedWeapon, "knife");
  assert.match(flyout.text(".rollbox-action-warning"), /not your turn/i);
  assert.equal(flyout.body.querySelector(".rollbox-action-go").disabled, true);
  game.combat = undefined;
});

test("bug: the open flyout follows the turn: the act buttons come back when the turn does; a character out of the encounter doesn't wait", () => {
  const { harvey, cultist } = setup({ isGM: false, values: { rollboxPlayerRollbox: true } });
  game.combat = { id: "c1", started: true, round: 1, turns: [{ actor: harvey }, { actor: cultist }],
    combatant: { actor: cultist } };
  tokenFor(cultist, 100, 0).setTarget(true, { releaseOthers: true });
  const flyout = open([harvey]);
  flyout.weapon("knife").click();
  assert.equal(flyout.body.querySelector(".rollbox-action-go").disabled, true);
  game.combat.combatant = { actor: harvey };
  assert.equal(combatChanged(game.combat, { name: "renamed" }), false);
  assert.equal(combatChanged(game.combat, { turn: 0 }), true);
  assert.equal(flyout.body.querySelector(".rollbox-action-go").disabled, false);
  game.combat.turns = [{ actor: cultist }];
  game.combat.combatant = { actor: cultist };
  encounterChanged();
  assert.equal(flyout.text(".rollbox-action-warning"), null);
  assert.equal(flyout.body.querySelector(".rollbox-action-go").disabled, false);
  game.combat = undefined;
});

test("while the Keeper decides the first blow (the scene's firstBlow mark), a player's Action flyout waits: Attack, "
  + "Maneuver and Spell can't be used and no weapon can be picked, the reason on hover; it unlocks when the mark goes; "
  + "the Keeper is never locked", () => {
  const { harvey, cultist } = setup({ isGM: false, values: { rollboxPlayerRollbox: true } });
  const flags = { firstBlow: { at: 1 } };
  globalThis.canvas.scene = { getFlag: (scope, key) => flags[key] };
  tokenFor(cultist, 100, 0).setTarget(true, { releaseOthers: true });
  const flyout = open([harvey]);
  assert.match(flyout.text(".rollbox-action-warning"), /waiting/i);
  const go = flyout.body.querySelector(".rollbox-action-go");
  assert.equal(go.disabled, true);
  assert.match(go.title, /waiting/i);
  assert.ok(flyout.all(".rollbox-action-weapon").every((row) => row.disabled), "no weapon can be picked");
  flyout.body.querySelector(".rollbox-action-tabs [data-tab=maneuver]").click();
  assert.equal(flyout.body.querySelector(".rollbox-action-go").disabled, true, "Maneuver");
  delete flags.firstBlow;
  assert.equal(sceneChanged(canvas.scene, { flags: { "keepers-rollbox": { "-=firstBlow": null } } }), true);
  assert.equal(flyout.text(".rollbox-action-warning"), null, "unlocked when the mark goes");
  flags.firstBlow = { at: 1 };
  game.user = game.users[0];
  const keeper = open([harvey]);
  assert.equal(keeper.text(".rollbox-action-warning"), null, "the Keeper is never locked");
  assert.equal(keeper.weapon("knife").disabled, false);
  delete globalThis.canvas.scene;
});

// --- Spells: the casting-time reader, the Spell tab in combat, first casting, the spell's text -----------------

test("readCastingTime: instant in; rounds by their worst case (6 or fewer in); minutes and longer out", () => {
  assert.deepEqual(["Instantaneous", "1 round", "1D3 rounds", "1 or 2 rounds", "5 rounds",
    "3 rounds before it begins to take effect"].map(readCastingTime), ["in", "in", "in", "in", "in", "in"]);
  assert.deepEqual(["1D6 + 4 rounds", "7 rounds", "5 minutes per magic point", "1 hour",
    "1 minute plus 1 round per participant who donates magic points", "Many days"].map(readCastingTime),
  ["out", "out", "out", "out", "out", "out"]);
});

test("readCastingTime: preparation or apply is hidden in combat; open-ended, empty or unreadable times are unknown", () => {
  assert.equal(readCastingTime("2 days per dose, 1 round to apply"), "out");
  assert.equal(readCastingTime("1 round to apply 1 dose"), "out");
  assert.deepEqual(["5+ rounds", "5 rounds or more", "", "a while"].map(readCastingTime),
    ["unknown", "unknown", "unknown", "unknown"]);
});

test("spellVerdict: cached per spell, worked out again when its casting time changes", () => {
  const spell = { uuid: "Item.cache-test", system: { castingTime: "1 round" } };
  assert.equal(spellVerdict(spell), "in");
  spell.system.castingTime = "1 hour";
  assert.equal(spellVerdict(spell), "out");
});

/** Harvey's spells: one fast, one slow, one unreadable; Shrivelling already cast. */
function spellbook(harvey, calls) {
  const spell = (id, name, castingTime) => ({ type: "spell", id, name, system: { castingTime, costs: {}, costList: [],
    description: { value: `<p>${name}'s text.</p>` }, cast: async (hidden) => { calls.casts.push(hidden); } } });
  harvey.items.push(spell("shrivel", "Shrivelling", "Instantaneous"), spell("contact", "Contact Ghoul", "1D6 + 4 rounds"),
    spell("mind", "Mind Transfer", "5+ rounds"));
  harvey.flagged.castSpells = ["shrivel"];
}

const spellNames = (flyout) => flyout.all(".rollbox-action-spell-row .rollbox-action-weapon-name").map((n) => n.textContent);

test("Spell tab: in combat only spells instantaneous or 6 rounds or fewer; out of combat every spell", () => {
  const { calls, harvey } = setup();
  spellbook(harvey, calls);
  assert.deepEqual(spellNames(open([harvey], { tab: "spell" })), ["Contact Ghoul", "Mind Transfer", "Shrivelling"]);
  game.combat = { id: "c1", started: true, round: 1, turns: [{ actor: harvey }] };
  assert.deepEqual(spellNames(open([harvey], { tab: "spell" })), ["Shrivelling"]);
  game.combat = undefined;
});

test("Spell tab: a spell not cast yet has the red outline and the first-casting tooltip; one cast has neither", () => {
  const { calls, harvey } = setup();
  spellbook(harvey, calls);
  const flyout = open([harvey], { tab: "spell" });
  const row = (id) => flyout.body.querySelector(`[data-spell="${id}"]`);
  assert.equal(row("contact").classList.contains("rollbox-action-first-casting"), true);
  assert.match(row("contact").title, /hard pow/i);
  assert.equal(row("shrivel").classList.contains("rollbox-action-first-casting"), false);
  assert.equal(flyout.text(".rollbox-action-not-cast"), null);
});

/** The Action flyout inside a flyout element in a panel row, as the menu host draws it. */
function inFlyout(actors) {
  const side = document.createElement("div");
  const flyout = document.createElement("section");
  flyout.className = "rollbox-flyout";
  side.append(flyout);
  document.body.append(side);
  const opened = open(actors, { tab: "spell" });
  flyout.append(opened.body);
  return { ...opened, side, flyout };
}

test("spell text On hover: hovering a spell shows CoC7's description beside the flyout; leaving hides it", async () => {
  const { calls, harvey } = setup();
  spellbook(harvey, calls);
  const m = inFlyout([harvey]);
  const row = m.body.querySelector("[data-spell=\"contact\"]");
  row.dispatchEvent(new document.defaultView.Event("mouseenter"));
  await settle();
  const box = m.side.querySelector(".rollbox-spell-text");
  assert.equal(box.previousElementSibling, m.flyout);
  assert.match(box.textContent, /Contact Ghoul's text\./);
  row.dispatchEvent(new document.defaultView.Event("mouseleave"));
  assert.equal(m.side.querySelector(".rollbox-spell-text"), null);
});

test("spell text On click shows and hides it with a click on the row; Off never shows it", async () => {
  const { calls, harvey, env } = setup();
  spellbook(harvey, calls);
  env.values.rollboxSpellTextTab = "click";
  env.registered.rollboxSpellTextTab = { default: "hover" };
  let m = inFlyout([harvey]);
  let row = m.body.querySelector("[data-spell=\"contact\"]");
  row.dispatchEvent(new document.defaultView.Event("mouseenter")); await settle();
  assert.equal(m.side.querySelector(".rollbox-spell-text"), null);
  row.click(); await settle();
  assert.ok(m.side.querySelector(".rollbox-spell-text"));
  row.click(); await settle();
  assert.equal(m.side.querySelector(".rollbox-spell-text"), null);
  env.values.rollboxSpellTextTab = "off";
  m = inFlyout([harvey]);
  row = m.body.querySelector("[data-spell=\"contact\"]");
  row.dispatchEvent(new document.defaultView.Event("mouseenter")); row.click(); await settle();
  assert.equal(m.side.querySelector(".rollbox-spell-text"), null);
});

test("CoC7's casting window for a cast from Rollbox gets the spell's text and the target's distance beside it; others don't",
  async () => {
  const { calls, harvey, cultist } = setup();
  spellbook(harvey, calls);
  const target = tokenFor(cultist, 300, 0);
  game.user.targets.add(target);
  const flyout = open([harvey], { tab: "spell" });
  const castWindow = () => {
    const node = document.createElement("form");
    node.className = "coc7 dialog spell-variables";
    document.body.append(node);
    return { id: `w${Math.random()}`, element: node };
  };
  const other = castWindow();
  await onCastingWindow(other); // no cast from Rollbox yet
  assert.equal(document.querySelector(".rollbox-spell-cast-host .rollbox-spell-text"), null);
  // CoC7's cast opens its window while it runs.
  const app = castWindow();
  harvey.items.find((item) => item.id === "contact").system.cast = () => onCastingWindow(app);
  [...flyout.body.querySelectorAll("[data-spell=\"contact\"] button")].find((b) => b.textContent === "Cast").click();
  await settle();
  const box = document.querySelector(".rollbox-spell-cast-host .rollbox-spell-text");
  assert.match(box.textContent, /Contact Ghoul · rules.*Contact Ghoul's text\..*Target: Cultist, 10 ft away/);
  target.center = { x: 500, y: 0 };
  castingMoved(target, { x: 500 });
  assert.match(box.textContent, /Target: Cultist, 20 ft away/);
  onCastingWindowClosed(app);
  assert.equal(document.querySelector(".rollbox-spell-cast-host .rollbox-spell-text"), null);
});

test("Attacks per round: a creature with 3 shows Attacks: 3/3, each attack spends one and the last its action; an investigator shows no count", async () => {
  const { calls, harvey } = setup();
  harvey.flagged.pickedWeapon = "gun";
  game.combat = { id: "c1", started: true, round: 1, turns: [{ actor: harvey }] };
  assert.equal(open([harvey]).text(".rollbox-action-attacks"), null);
  harvey.type = "creature";
  harvey.system.special = { attacksPerRound: "3" };
  const flyout = open([harvey]);
  assert.equal(flyout.text(".rollbox-action-attacks"), "Attacks: 3/3");
  flyout.body.querySelector(".rollbox-action-go").click();
  await settle();
  assert.deepEqual([harvey.flagged.roundNotes.attacks, harvey.flagged.roundNotes.acted === true], [1, false]);
  assert.equal(open([harvey]).text(".rollbox-action-attacks"), "Attacks: 2/3");
  for (let i = 0; i < 2; i += 1) {
    open([harvey]).body.querySelector(".rollbox-action-go").click();
    await settle();
  }
  assert.deepEqual([harvey.flagged.roundNotes.attacks, harvey.flagged.roundNotes.acted, calls.weaponChecks.length],
    [3, true, 3]);
  assert.equal(open([harvey]).text(".rollbox-action-attacks"), "Attacks: 0/3");
  game.combat = undefined;
});

// --- What a character can do: down, held, out of reach, Cast hidden ------------------------------------------------

/** A spell Harvey has cast before, so no first-casting roll is asked. */
function giveSpell(harvey, calls) {
  harvey.items.push({ type: "spell", id: "shrivel", name: "Shrivelling", system: { castingTime: "1 round", costs: {},
    costList: [], type: { combat: true }, cast: async (hidden) => { calls.casts.push(hidden); } } });
  harvey.flagged.castSpells = ["shrivel"];
}

test("unconscious, dying or dead: the Keeper's Action is greyed with the reason, Override asks first and lets one "
  + "action through", async () => {
  const { calls, harvey, cultist } = setup();
  giveSpell(harvey, calls);
  harvey.system.conditions = { unconscious: { value: true } };
  tokenFor(cultist, 100, 0).setTarget(true, { releaseOthers: true });
  const flyout = open([harvey], { tab: "spell" });
  assert.match(flyout.text(".rollbox-action-warning"), /unconscious/);
  const cast = flyout.body.querySelector(".rollbox-action-cast");
  assert.ok(cast.classList.contains("rollbox-action-override") && cast.title, "Override, the reason on hover");
  cast.click();
  await settle();
  assert.deepEqual(calls.casts, [], "asked first");
  assert.match(flyout.text(".rollbox-action-override-prompt"), /Harvey is unconscious\. Override\?/);
  flyout.body.querySelector(".rollbox-action-override-prompt .rollbox-action-prompt-yes").click();
  await settle();
  assert.deepEqual(calls.casts, [false]);
  harvey.system.conditions = { dying: { value: true }, unconscious: { value: true } };
  assert.match(open([harvey]).text(".rollbox-action-warning"), /dying/);
});

test("Restrained: Attack and Spell greyed with the reason, Maneuver offers only Break free; nobody held: Break free "
  + "greyed \"Not held\"", () => {
  const { harvey, cultist } = setup({ isGM: false, values: { rollboxPlayerRollbox: true } });
  tokenFor(cultist, 100, 0).setTarget(true, { releaseOthers: true });
  harvey.flags = { "keepers-rollbox": { statuses: { restrained: true } } };
  const attack = open([harvey]);
  assert.match(attack.text(".rollbox-action-warning"), /restrained/i);
  assert.deepEqual([attack.body.querySelector(".rollbox-action-go").disabled,
    attack.body.querySelector(".rollbox-action-go").title], [true, "Restrained: you can only try to break free"]);
  const maneuver = open([harvey], { tab: "maneuver" });
  const live = maneuver.all(".rollbox-action-goals .rollbox-segment").filter((node) => !node.disabled);
  assert.deepEqual(live.map((node) => node.dataset.value), ["breakFree"]);
  assert.equal(maneuver.body.querySelector(".rollbox-action-goals [aria-pressed=true]").dataset.value, "breakFree");
  harvey.flags = {};
  const free = open([harvey], { tab: "maneuver" });
  const breakFree = free.body.querySelector(".rollbox-action-goals [data-value=breakFree]");
  assert.equal(breakFree.disabled, true);
  assert.match(breakFree.title, /not held/i);
});

test("a maneuver's target out of reach: every goal greyed \"Out of reach\", the button reads Target out of reach; "
  + "the Keeper's Override asks first; moving into reach brings the goals back", async () => {
  const { harvey, cultist } = setup();
  const target = tokenFor(cultist, 400, 0); // 15 ft edge to edge, over the 1 m reach
  target.setTarget(true, { releaseOthers: true });
  const flyout = open([harvey], { tab: "maneuver" });
  const goals = flyout.all(".rollbox-action-goals .rollbox-segment").filter((node) => node.dataset.value !== "breakFree");
  assert.ok(goals.every((node) => node.title === "Out of reach"), "every goal but Break free");
  const go = flyout.body.querySelector(".rollbox-action-go");
  assert.match(go.textContent, /out of reach/i);
  go.click();
  assert.match(flyout.text(".rollbox-action-override-prompt"), /Cultist is out of reach\. Override\?/);
  target.center = { x: 160, y: 0 };
  tokenMoved(target.document ?? target, { x: 160 });
  const near = open([harvey], { tab: "maneuver" });
  assert.equal(near.body.querySelector(".rollbox-action-goals [data-value=restrain]").title, "");
  assert.match(near.text(".rollbox-action-go"), /^Attempt to/);
});

test("Cast hidden is the Keeper's only: a player's Spell tab shows just Cast", () => {
  for (const isGM of [true, false]) {
    const { calls, harvey } = setup({ isGM, values: { rollboxPlayerRollbox: true } });
    giveSpell(harvey, calls);
    const flyout = open([harvey], { tab: "spell" });
    assert.equal(flyout.all(".rollbox-action-cast-hidden").length, isGM ? 1 : 0);
    assert.equal(flyout.all(".rollbox-action-cast").length, 1);
  }
});
