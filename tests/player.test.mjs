import assert from "node:assert/strict";
import { test } from "node:test";
import { canUse, ownCharacter, playerMenu, playerRollboxOn } from "../scripts/player/index.js";
import { pickTarget } from "../scripts/player/targeting.js";
import { makeDom, makeEnv } from "./mocks.mjs";

/** The switches, unregistered (as now): the declared defaults, or `values` as the saved settings. */
const env = ({ isGM = false, values = {} } = {}) => makeEnv({ isGM, values });

test("the player Rollbox is on by default, off with its master switch", () => {
  env();
  assert.equal(playerRollboxOn(), true);
  env({ values: { rollboxPlayerRollbox: false } });
  assert.equal(playerRollboxOn(), false);
});

test("canUse: the Keeper always, even with the master off", () => {
  env({ isGM: true });
  assert.equal(canUse("opposed"), true);
});

test("canUse: a player only with the master and that feature on", () => {
  env({ values: { rollboxPlayerRollbox: false } });
  assert.equal(canUse("checks"), false);
  env({ values: { rollboxPlayerRollbox: true, rollboxPlayerLuck: false } });
  assert.equal(canUse("checks"), true);
  assert.equal(canUse("luck"), false);
});

test("canUse: Luck is the Keeper's, never a player's, whatever its saved tick box says", () => {
  env({ values: { rollboxPlayerRollbox: true, rollboxPlayerLuck: true } });
  assert.equal(canUse("luck"), false);
  env({ isGM: true });
  assert.equal(canUse("luck"), true);
});

test("canUse: an unknown feature is false, for the Keeper too", () => {
  env({ isGM: true });
  assert.equal(canUse("toString"), false);
});

test("playerMenu: Action · Check · Other, each only when one of its features is allowed", () => {
  env({ values: { rollboxPlayerRollbox: true } });
  assert.deepEqual(playerMenu(), ["action", "check", "other"]);
  env({ values: { rollboxPlayerRollbox: true, rollboxPlayerActions: false, rollboxPlayerChecks: false,
    rollboxPlayerCombined: false, rollboxPlayerOpposed: false } });
  assert.deepEqual(playerMenu(), ["other"]); // Assist keeps Other; a player's Check has no Sanity tab
  env({ values: { rollboxPlayerRollbox: true, rollboxPlayerOpposed: false, rollboxPlayerAssist: false } });
  assert.deepEqual(playerMenu(), ["action", "check"]); // Luck alone gives no Other
  env({ values: { rollboxPlayerRollbox: false } });
  assert.deepEqual(playerMenu(), []);
});

test("ownCharacter: the user's assigned character, only when they own it", () => {
  env();
  const owned = { name: "Harvey", testUserPermission: (user, level) => user === game.user && level === "OWNER" };
  assert.equal(ownCharacter({ ...game.user, character: owned }), null); // another object than game.user
  game.user.character = owned;
  assert.equal(ownCharacter(game.user), owned);
  game.user.character = { name: "Lent", testUserPermission: () => false };
  assert.equal(ownCharacter(game.user), null);
});

test("ownCharacter: null for no user, no character, or a character that can't be read", () => {
  env();
  assert.equal(ownCharacter(null), null);
  assert.equal(ownCharacter(game.user), null);
  game.user.character = { testUserPermission: () => { throw new Error("gone"); } };
  assert.equal(ownCharacter(game.user), null);
});

// --- Targeting --------------------------------------------------------------------------------------

/** Foundry's scene controls (recording each switch) and token layer (recording setTargets), with an #interface. */
function targeting({ control = "tokens", tool = "select" } = {}) {
  const e = env();
  makeDom(`<div id="interface"></div>`);
  const calls = { activate: [], setTargets: [] };
  globalThis.ui = { controls: { control: { name: control }, tool: { name: tool },
    activate: async (options) => { calls.activate.push(options); } } };
  globalThis.canvas = { tokens: { setTargets: (ids, options) => calls.setTargets.push([ids, options]) } };
  const prompt = () => document.querySelector("#interface > .rollbox-targeting");
  return { ...e, calls, prompt };
}

test("pickTarget: shows the prompt, switches to the Target tool and resolves with the user's target", async () => {
  const t = targeting();
  const picked = pickTarget({ prompt: "Select your target" });
  assert.equal(t.prompt().querySelector(".rollbox-targeting-prompt").textContent, "Select your target");
  assert.deepEqual(t.calls.activate, [{ control: "tokens", tool: "target" }]);
  const enemy = { name: "Cultist" };
  Hooks.call("targetToken", game.users[2], { name: "Other's" }, true); // another user's target
  Hooks.call("targetToken", game.user, { name: "Released" }, false); // a released target
  Hooks.call("targetToken", game.user, enemy, true);
  assert.equal(await picked, enemy);
  assert.equal(t.prompt(), null);
  assert.deepEqual(t.calls.activate.at(-1), { control: "tokens", tool: "select" }); // back to the tool before
  assert.deepEqual(t.calls.setTargets, []); // the target stays for CoC7
  assert.deepEqual(t.hooks.targetToken, []);
});

test("pickTarget: Cancel resolves null, puts back the targets the player had and the earlier tool", async () => {
  const t = targeting({ control: "measure", tool: "rect" });
  game.user.targets = new Set([{ id: "t1", name: "Cultist" }, { id: "t2", name: "Ghoul" }]);
  const picked = pickTarget({ useCurrent: false });
  t.prompt().querySelector(".rollbox-targeting-cancel").click();
  assert.equal(await picked, null);
  assert.equal(t.prompt(), null);
  assert.deepEqual(t.calls.setTargets, [[["t1", "t2"], { mode: "replace" }]]);
  assert.deepEqual(t.calls.activate.at(-1), { control: "measure", tool: "rect" });
});

test("pickTarget: a token the player has targeted already is used at once, without the prompt", async () => {
  const t = targeting();
  const cultist = { id: "t1", name: "Cultist" };
  game.user.targets = new Set([cultist]);
  assert.equal(await pickTarget(), cultist);
  assert.equal(t.prompt(), null);
  assert.deepEqual(t.calls.activate, []);
});

test("pickTarget: started from the Target tool, it goes back to Select", async () => {
  const t = targeting({ tool: "target" });
  const picked = pickTarget();
  Hooks.call("targetToken", game.user, { name: "Cultist" }, true);
  await picked;
  assert.deepEqual(t.calls.activate.at(-1), { control: "tokens", tool: "select" });
});

test("pickTarget: a new pick or the scene closing ends the one waiting with null", async () => {
  const t = targeting();
  const first = pickTarget();
  const second = pickTarget();
  assert.equal(await first, null);
  assert.equal(document.querySelectorAll(".rollbox-targeting").length, 1);
  Hooks.call("canvasTearDown");
  assert.equal(await second, null);
  assert.equal(t.prompt(), null);
});

test("pickTarget: a failed switch to the Target tool ends the pick with null", async () => {
  const t = targeting();
  ui.controls.activate = async () => { throw new Error("no such tool"); };
  assert.equal(await pickTarget(), null);
  assert.equal(t.prompt(), null);
});

test("pickTarget: without Foundry's scene controls it does nothing and resolves null", async () => {
  targeting();
  delete globalThis.ui.controls;
  assert.equal(await pickTarget(), null);
  assert.equal(document.querySelector(".rollbox-targeting"), null);
});

test("bug: Combined checks only with Checks: without Checks it gives nothing, not even the Check button", () => {
  env({ values: { rollboxPlayerRollbox: true, rollboxPlayerChecks: false, rollboxPlayerSanity: false } });
  assert.equal(canUse("combined"), false);
  assert.equal(playerMenu().includes("check"), false);
});

test("pickTarget: Escape cancels the pick (and is taken); with restore the targets from before come back after a pick too", async () => {
  const t = targeting();
  const win = document.defaultView;
  globalThis.addEventListener = win.addEventListener.bind(win);
  globalThis.removeEventListener = win.removeEventListener.bind(win);
  try {
    game.user.targets = new Set([{ id: "t1", name: "Cultist" }]);
    const escaped = pickTarget({ useCurrent: false });
    const key = new win.KeyboardEvent("keydown", { key: "Escape", cancelable: true });
    win.dispatchEvent(key);
    assert.equal(await escaped, null);
    assert.equal(key.defaultPrevented, true);
    assert.deepEqual(t.calls.setTargets, [[["t1"], { mode: "replace" }]]);
    const helped = { id: "t2", name: "Helen" };
    const picked = pickTarget({ useCurrent: false, restore: true });
    Hooks.call("targetToken", game.user, helped, true);
    assert.equal(await picked, helped);
    assert.deepEqual(t.calls.setTargets.at(-1), [["t1"], { mode: "replace" }]);
    const after = new win.KeyboardEvent("keydown", { key: "Escape", cancelable: true });
    win.dispatchEvent(after);
    assert.equal(after.defaultPrevented, false); // no pick waiting: Escape isn't Rollbox's
  } finally {
    delete globalThis.addEventListener;
    delete globalThis.removeEventListener;
  }
});
