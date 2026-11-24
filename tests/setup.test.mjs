import assert from "node:assert/strict";
import { test } from "node:test";
import { scanSetup, setupActors } from "../scripts/setup/scan.js";
import { checkAtLogin, checkNow, closeWindow, itemAdded, registerSetupCheck } from "../scripts/setup/index.js";
import { makeCoC7, makeDom, makeEnv, makeRollActor } from "./mocks.mjs";

const BRAWL = { name: "Fighting (Brawl)", value: 40, cocid: "i.skill.fighting-brawl" };

let worlds = 0;

/**
 * A sheet with Foundry's flags, embedded updates and item creation, recorded in `actor.log`. Each world's sheets have
 * their own uuids: a question skipped stays skipped until the page is reloaded.
 */
function sheet(name, type, { skills = [BRAWL], items = [] } = {}) {
  const actor = makeRollActor({ name, type, skills, uuid: `Actor.${name.replace(/\s+/g, "")}${worlds}` });
  actor.log = { updates: [], created: [] };
  actor.flagged = {};
  actor.getFlag = (scope, key) => actor.flagged[key];
  actor.setFlag = async (scope, key, value) => { actor.flagged[key] = value; };
  actor.updateEmbeddedDocuments = async (type, updates) => { actor.log.updates.push(updates); };
  actor.createEmbeddedDocuments = async (type, data) => data.map((d, i) => {
    actor.log.created.push(d);
    const item = { ...d, id: `new${actor.log.created.length}${i}` };
    actor.items.push(item);
    return item;
  });
  actor.sheet = { render: () => { actor.log.opened = true; } };
  actor.items.push(...items);
  return actor;
}

/** A firearm item: skill as written, capacity, and Rollbox's flag through getFlag. */
function firearm(id, name, skill, cocid) {
  const item = { type: "weapon", id, name, flags: cocid ? { CoC7: { cocidFlag: { id: cocid } } } : {},
    system: { bullets: 6, skill: { main: { name: skill } }, properties: { rngd: true } } };
  item.getFlag = (scope, key) => item.flags[scope]?.[key];
  item.setFlag = async (scope, key, value) => { item.flags[scope] = { ...item.flags[scope], [key]: value }; };
  return item;
}

/** Whether the step's Open sheet opened the Cultist's sheet. */
const cultistOpened = () => game.actors[1].log.opened === true;

/** The demo's kind of world: an investigator with a revolver and a custom gun, an NPC with Punch, a creature. */
function world({ values = {} } = {}) {
  worlds += 1;
  const env = makeEnv({ values });
  makeCoC7();
  makeDom();
  const colt = firearm("colt", "Grandpa's Colt", "Firearms (Handgun)");
  const revolver = firearm("rev", ".41 Revolver", "Firearms (Handgun)", "i.weapon.41-revolver");
  const cecil = sheet("Cecil", "character", { items: [revolver, colt] });
  const punch = { type: "weapon", id: "punch", name: "Punch", flags: { CoC7: { cocidFlag: { id: "i.weapon.brawl" } } },
    system: { skill: { main: { id: "", name: "i.skill.brawl" } }, properties: {}, isSkillSet: false } };
  const cultist = sheet("Cultist", "npc", { items: [punch] });
  const deepOne = sheet("Deep One", "creature");
  game.actors = [cecil, cultist, deepOne];
  globalThis.canvas = { scene: { tokens: [] } };
  game.CoC7.cocid.fromCoCIDBest = async () => [];
  return { env, cecil, cultist, deepOne, colt, revolver, punch };
}

test("scan: a firearm the table or name rule is sure of is saved in one update per actor; a guess and an unset skill are asked; no Punch or maneuver questions", async () => {
  const { cecil, cultist, deepOne } = world();
  const { issues, saved } = await scanSetup(setupActors());
  assert.equal(saved, 1);
  assert.deepEqual(cecil.log.updates, [[{ _id: "rev", "flags.keepers-rollbox.reloadKind": "rounds" }]]);
  assert.deepEqual(issues.map((issue) => [issue.actor.name, issue.type]), [["Cecil", "reload"], ["Cultist", "skill"]]);
  assert.equal([cultist, deepOne].every((actor) => !actor.log.updates.length && !actor.log.created.length), true);
});

test("setup window: the list, then one at a time; Save keeps the Keeper's answer on the weapon; Skip asks again only after a reload", async () => {
  const { cecil, colt } = world();
  const root = await checkNow();
  assert.match(root.textContent, /2 things to set up on 2 sheets. Only you see this./);
  const press = (text) => [...root.querySelectorAll("button")].find((b) => b.textContent === text).click();
  press("Review one at a time");
  assert.match(root.textContent, /1 of 2.*How does Grandpa's Colt load?/);
  press("2 rounds at a time");
  press("Save and next");
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(colt.flags["keepers-rollbox"].reloadKind, "rounds");
  assert.match(root.textContent, /2 of 2.*Punch has no skill set/);
  press("Open sheet");
  assert.equal(cultistOpened(root), true);
  press("Skip");
  assert.equal(root.dataset.view, "done");
  assert.match(root.textContent, /CecilInvestigatorDone/);
  press("Close");
  assert.equal(root.isConnected, false);
  const again = await scanSetup(setupActors());
  assert.deepEqual(again.issues.map((issue) => issue.type), []);
  assert.equal(cecil.log.created.length, 0);
});

test("Reload kinds: every firearm with the kind Rollbox reads, a guess marked; a press saves the corrected kind at once", async () => {
  const { colt, revolver } = world();
  const root = await checkNow();
  [...root.querySelectorAll("button")].find((b) => b.textContent === "Reload kinds").click();
  assert.equal(root.dataset.view, "kinds");
  const rows = [...root.querySelectorAll(".rollbox-setup-kindrow")];
  const picked = (row) => row.querySelector("[aria-checked=true]")?.dataset.kind;
  assert.deepEqual(rows.map((row) => [row.querySelector("b").textContent, picked(row)]),
    [[".41 Revolver", "rounds"], ["Grandpa's Colt", "magazine"]]);
  assert.match(rows[1].textContent, /a guess/);
  rows[0].querySelector("[data-kind=magazine]").click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(revolver.flags["keepers-rollbox"].reloadKind, "magazine");
  assert.equal(root.querySelector(".rollbox-setup-kindrow [aria-checked=true]").dataset.kind, "magazine");
  assert.equal(colt.flags["keepers-rollbox"]?.reloadKind, undefined);
  [...root.querySelectorAll("button")].find((b) => b.textContent === "Back").click();
  assert.equal(root.dataset.view, "list");
  closeWindow();
});

test("at login: the notice only with the setting on and something to set up; Review opens the list", async () => {
  world({ values: { rollboxSetupCheck: false } });
  assert.equal(await checkAtLogin(), null);
  assert.equal(document.querySelector(".rollbox-setup-notice"), null);
  world();
  await checkAtLogin();
  const notice = document.querySelector(".rollbox-setup-notice");
  assert.equal(notice.textContent.startsWith("Rollbox: 2 things to set up on 2 sheets."), true);
  [...notice.querySelectorAll("button")].find((b) => b.textContent === "Review").click();
  assert.equal(document.querySelector(".rollbox-setup-notice"), null);
  assert.equal(document.querySelector(".rollbox-setup").dataset.view, "list");
  closeWindow();
});

test("a player's client: no setup check hooks and no check now; a firearm added later is checked on its own", async () => {
  makeEnv({ isGM: false });
  assert.equal(registerSetupCheck(), false);
  assert.equal(await checkNow(), null);
  const { cecil, colt } = world();
  itemAdded({ ...colt, parent: cecil, type: "weapon" });
  itemAdded({ type: "weapon", name: "Punch", parent: cecil, system: { properties: {} } }); // not a firearm: no check
  await new Promise((resolve) => setTimeout(resolve, 1600));
  // The gun's own question only, not the sheet's others (they wait for the next full check).
  assert.match(document.querySelector(".rollbox-setup-notice").textContent, /^Rollbox: 1 thing to set up on 1 sheet\./);
});

test("scan: a weapon Rollbox left with Maneuver off (a fight back interrupted) is switched back on in the sheet's one update", async () => {
  const { cultist, deepOne } = world();
  const claw = { type: "weapon", id: "claw", name: "Claw", flags: { "keepers-rollbox": { maneuverOff: true } },
    system: { skill: { main: { id: "", name: "Fighting (Brawl)" } }, properties: { mnvr: false } } };
  deepOne.items.push(claw);
  await scanSetup([cultist, deepOne]);
  assert.deepEqual(deepOne.log.updates, [[{ _id: "claw", "system.properties.mnvr": true, "flags.keepers-rollbox.-=maneuverOff": null }]]);
  assert.deepEqual(cultist.log.updates, []);
});

test("setup window: a save that fails keeps the question and tells the Keeper in the window", async () => {
  const { colt } = world();
  colt.setFlag = async () => { throw new Error("no permission"); };
  const root = await checkNow();
  const press = (text) => [...root.querySelectorAll("button")].find((b) => b.textContent === text).click();
  press("Review one at a time");
  press("Save and next");
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(root.dataset.view, "step");
  assert.equal(root.querySelector(".rollbox-setup-step span").textContent, "1 of 2");
  assert.equal(root.querySelector(".rollbox-setup-error")?.getAttribute("role"), "alert");
  closeWindow();
});
