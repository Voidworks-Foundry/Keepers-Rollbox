import assert from "node:assert/strict";
import { test } from "node:test";
import { registerFlyout } from "../scripts/panel/index.js";
import { makeActor, makeDom, makeEnv, load } from "./mocks.mjs";

/** A CoC7 character the panel can draw; `owner` is the user who owns it. */
function character(name, owner) {
  const actor = makeActor({ name, san: 50, sanMax: 99, luck: 40,
    characteristics: { str: 50, con: 60, siz: 65, dex: 70, app: 45, int: 80, pow: 55, edu: 85 } });
  actor.uuid = `Actor.${name}`;
  actor.owners = [];
  actor.system.attribs.hp = { value: 9, max: 12 };
  actor.system.attribs.mp = { value: 11, max: 11 };
  actor.system.infos = { occupation: "" };
  actor.testUserPermission = (user, level) => user === owner && level === "OWNER";
  return actor;
}

/**
 * A player's client with the players list, a canvas and animation frames run by flush(); `values` are the saved
 * settings (the player Rollbox on unless they say otherwise), `own` the name of the player's assigned character.
 */
async function setup({ values = {}, own = "Harvey" } = {}) {
  const env = makeEnv({ isGM: false, values: { rollboxPlayerRollbox: true, ...values } });
  const window = makeDom(`<div id="ui-left-column-1"><aside id="players"></aside></div>`);
  const frames = new Map(); let next = 1;
  globalThis.requestAnimationFrame = (f) => { frames.set(next, f); return next++; };
  globalThis.cancelAnimationFrame = (id) => frames.delete(id);
  globalThis.canvas = { tokens: { controlled: [] } };
  if (own) game.user.character = character(own, game.user);
  await load(env);
  const flush = () => { const due = [...frames.values()]; frames.clear(); due.forEach((f) => f()); };
  const panel = () => document.querySelector(".rollbox-panel");
  const names = () => [...document.querySelectorAll(".rollbox-character-panel .rollbox-name")].map((n) => n.textContent);
  const menu = () => [...document.querySelectorAll(".rollbox-menu-button")].filter((b) => !b.hidden)
    .map((b) => b.dataset.menu);
  return { env, window, flush, panel, names, menu };
}

test("player with the player Rollbox on: the panel shows their own character at once, whatever is selected", async () => {
  const s = await setup();
  s.flush();
  assert.equal(s.panel().hidden, false);
  assert.deepEqual(s.names(), ["Harvey"]);
  canvas.tokens.controlled = [{ actor: character("Cultist", game.users[0]) }];
  Hooks.call("controlToken", canvas.tokens.controlled[0], true); s.flush();
  assert.deepEqual(s.names(), ["Harvey"]);
});

test("player's menu: only the buttons with an allowed feature, none hidden in the DOM; Sanity is part of Check", async () => {
  const s = await setup();
  s.flush();
  assert.deepEqual(s.menu(), ["action", "check", "other"]);
  const t = await setup({ values: { rollboxPlayerActions: false, rollboxPlayerLuck: false, rollboxPlayerOpposed: false,
    rollboxPlayerAssist: false } });
  t.flush();
  assert.deepEqual(t.menu(), ["check"]);
  assert.equal(document.querySelectorAll(".rollbox-menu-button").length, 1); // the host draws only the player's ids
});

test("player's sheet clicks: only what the Keeper allows them (Luck needs Luck, not just Other)", async () => {
  const s = await setup({ values: { rollboxPlayerLuck: false, rollboxPlayerSanity: false } });
  s.flush();
  const opened = [];
  for (const id of ["check", "other"]) registerFlyout(id, { render: () => { opened.push(id); } });
  for (const label of ["Luck", "Sanity", "Check STR"]) {
    s.panel().querySelector(`.rollbox-character-panel button[aria-label="${label}"]`)
      .dispatchEvent(new s.window.MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
  }
  assert.deepEqual(opened, ["check"]);
});

test("player whose assigned character changes: the panel follows it", async () => {
  const s = await setup();
  s.flush();
  game.user.character = character("Ann", game.user);
  Hooks.call("updateUser", { id: "p2" }); s.flush(); // another user's change
  assert.deepEqual(s.names(), ["Harvey"]);
  Hooks.call("updateUser", game.user); s.flush();
  assert.deepEqual(s.names(), ["Ann"]);
});

test("player without a character of their own: the no-investigator message instead of a sheet, and no menu", async () => {
  const s = await setup({ own: null });
  s.flush();
  const shown = () => [document.querySelector(".rollbox-no-investigator") !== null,
    document.querySelector(".rollbox-sheet") !== null, document.querySelectorAll(".rollbox-menu-button").length];
  assert.deepEqual(shown(), [true, false, 0]);
  game.user.character = character("Ann", game.users[2]); // assigned, but not theirs
  Hooks.call("updateUser", game.user); s.flush();
  assert.deepEqual(shown(), [true, false, 0]);
});

test("player's flyouts: registered on their client; Check opens with only the tabs their features allow", async () => {
  const s = await setup({ values: { rollboxPlayerSanity: false, rollboxPlayerActions: false } });
  s.flush();
  document.querySelector('.rollbox-menu-button[data-menu="check"]').click();
  const tabs = [...document.querySelectorAll(".rollbox-flyout .rollbox-check-tab")].map((t) => t.dataset.tab);
  assert.deepEqual(tabs, ["characteristic", "skill"]);
});

test("player's own Rollbox switch off: no panel, no flyouts, nothing drawn", async () => {
  const s = await setup({ values: { rollboxEnabled: false } });
  s.flush();
  assert.equal(s.panel(), null);
  assert.equal(document.querySelector("[class*='rollbox-']"), null);
});

test("a feature changed by the Keeper redraws the player's menu without a reload", async () => {
  const values = { rollboxPlayerRollbox: true };
  const s = await setup({ values });
  s.flush();
  assert.deepEqual(s.menu(), ["action", "check", "other"]);
  const before = game.settings.get;
  game.settings.get = (ns, key) => (key === "rollboxPlayerActions" ? false : before(ns, key));
  s.env.registered.rollboxPlayerActions.onChange(false);
  s.flush();
  assert.deepEqual(s.menu(), ["check", "other"]);
  assert.equal(document.querySelector(".rollbox-menu").style.getPropertyValue("--rollbox-buttons"), "2");
  assert.ok(document.querySelector(".rollbox-menu").classList.contains("rollbox-menu-fill"));
});

test("auto-hide: after the set time without use the sheet drops to the compact card; hovering brings it back", async () => {
  const s = await setup({ values: { rollboxAutoHide: true, rollboxAutoHideAfter: 1 } });
  const timers = [];
  const real = globalThis.setTimeout;
  globalThis.setTimeout = (f, ms) => { timers.push([f, ms]); return timers.length; };
  try {
    s.flush();
    assert.ok(document.querySelector(".rollbox-character-panel .rollbox-sheet"));
    const [run, ms] = timers.at(-1);
    assert.equal(ms, 1000);
    run();
    assert.equal(document.querySelector(".rollbox-character-panel .rollbox-sheet"), null);
    assert.ok(document.querySelector(".rollbox-character-panel .rollbox-cards"));
    s.panel().dispatchEvent(new s.window.Event("pointerenter"));
    assert.ok(document.querySelector(".rollbox-character-panel .rollbox-sheet"));
  } finally {
    globalThis.setTimeout = real;
  }
});

test("players wait while the Keeper decides a first blow: every menu button but Action greyed, \"Waiting for the "
  + "Keeper\" on hover, a sheet click opens nothing; back once the scene's mark is off", async () => {
  const s = await setup();
  const opened = [];
  for (const id of ["action", "check", "other"]) registerFlyout(id, { render: () => { opened.push(id); } });
  const flags = {};
  canvas.scene = { getFlag: (scope, key) => flags[key] ?? null };
  flags.firstBlow = { at: 1 };
  Hooks.call("updateScene", canvas.scene, { flags: { "keepers-rollbox": { firstBlow: { at: 1 } } } }); s.flush();
  const buttons = () => Object.fromEntries([...document.querySelectorAll(".rollbox-menu-button")]
    .map((b) => [b.dataset.menu, b.disabled ? b.title : "on"]));
  assert.deepEqual(buttons(), { action: "on", check: "Waiting for the Keeper", other: "Waiting for the Keeper" });
  s.panel().querySelector('.rollbox-character-panel button[aria-label="Check STR"]')
    .dispatchEvent(new s.window.MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
  assert.deepEqual(opened, []);
  delete flags.firstBlow;
  Hooks.call("updateScene", canvas.scene, { flags: { "keepers-rollbox": { "-=firstBlow": null } } }); s.flush();
  assert.deepEqual(buttons(), { action: "on", check: "on", other: "on" });
});

test("a player whose investigator is down or in a bout of madness: the whole menu greyed with the reason on hover, "
  + "no flyout opens, a sheet click opens nothing; back once CoC7 clears it", async () => {
  const s = await setup();
  const harvey = game.user.character;
  const opened = [];
  for (const id of ["action", "check", "other"]) registerFlyout(id, { render: () => { opened.push(id); } });
  harvey.system.conditions = { dying: { value: true } };
  s.flush();
  const buttons = () => [...document.querySelectorAll(".rollbox-menu-button")];
  assert.deepEqual(buttons().map((b) => [b.disabled, b.title]), [[true, "Dying"], [true, "Dying"], [true, "Dying"]]);
  s.panel().querySelector('.rollbox-character-panel button[aria-label="Check STR"]')
    .dispatchEvent(new s.window.MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
  assert.deepEqual(opened, []);
  harvey.system.conditions = { tempoInsane: { value: true } };
  Hooks.call("updateActor", harvey, { system: { conditions: {} } }); s.flush();
  assert.match(buttons()[0].title, /bout of madness/i);
  harvey.system.conditions = {};
  Hooks.call("updateActor", harvey, { system: { conditions: {} } }); s.flush();
  assert.ok(buttons().every((b) => !b.disabled));
});
