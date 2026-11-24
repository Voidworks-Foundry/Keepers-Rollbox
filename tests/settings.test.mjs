import assert from "node:assert/strict";
import { test } from "node:test";
import { MODULE_ID } from "../scripts/utils.js";
import { makeDom, makeEnv, load } from "./mocks.mjs";

/** Foundry v14's colour field, enough to see that the colour setting uses it. Set before main.js loads. */
class ColorField { constructor(options) { this.options = options; } }
globalThis.foundry = { data: { fields: { ColorField } } };

/** Values in the form that differ from every default, so a Reset shows. */
const CHANGED = { rollboxTheme: "artDeco", rollboxTransparency: "50", rollboxColor: "#ffffff", rollboxScale: "120" };

/** The settings form, decorated twice: a re-render must not duplicate anything. Hidden settings aren't in it. */
async function renderedForm() {
  const env = makeEnv(); await load(env);
  const keys = Object.keys(env.registered).filter((k) => env.registered[k].config !== false);
  const field = (k) => (env.registered[k].type === Boolean
    ? `<input name="${MODULE_ID}.${k}" type="checkbox" checked>`
    : `<input name="${MODULE_ID}.${k}" type="text" value="${CHANGED[k] ?? env.registered[k].default}">`);
  const window = makeDom(`<form>${keys.map((k) => `<div class="form-group"><label>${k}</label>
     <div class="form-fields">${field(k)}</div><p class="hint">h</p></div>`).join("")}</form>`);
  globalThis.Event = window.Event;
  const dom = { window };
  const root = document.querySelector("form");
  env.hooks.renderSettingsConfig.forEach((f) => f({}, root));
  env.hooks.renderSettingsConfig.forEach((f) => f({}, root));
  const grp = (k) => root.querySelector(`[name="${MODULE_ID}.${k}"]`).closest(".form-group");
  return { env, dom, root, grp };
}

test("registered in page order: the five feature switches first, then their sections; the Keeper's Roll … attacks at once in Gameplay rules", async () => {
  const env = makeEnv(); await load(env);
  const keys = Object.keys(env.registered);
  assert.deepEqual(keys.slice(0, 5), ["rollboxEnabled", "rollboxPlayerRollbox", "rollboxCombatPanel", "rollboxGameplay",
    "rollboxSetupCheck"]);
  const firsts = ["rollboxTheme", "rollboxPlayerActions", "rollboxTurnSelection", "rollboxJoinRange"].map((key) => keys.indexOf(key));
  assert.deepEqual(firsts, [...firsts].sort((a, b) => a - b));
  for (const key of ["rollboxAutoRollNpc", "rollboxAutoRollAttacks"]) assert.ok(keys.indexOf(key) > keys.indexOf("rollboxMeleeReach"));
});

test("every setting's scope, default and reload, in one table (keys are permanent once released)", async () => {
  const env = makeEnv(); await load(env);
  const table = Object.fromEntries(Object.entries(env.registered)
    .map(([key, config]) => [key, [config.scope, config.default, config.requiresReload === true]]));
  assert.deepEqual(table, {
    rollboxEnabled: ["user", true, true], rollboxShowPlayers: ["user", true, false],
    rollboxEscapeClosesFlyout: ["user", true, false],
    rollboxSimplifiedDice: ["user", false, false],
    rollboxTheme: ["user", "foundry", false], rollboxColor: ["user", "#0b0a13", false],
    rollboxTransparency: ["user", 25, false], rollboxScale: ["user", 100, false],
    rollboxNoticeScale: ["user", 100, false], rollboxNoticePlaces: ["user", {}, false], rollboxMovable: ["client", true, false],
    rollboxMenuSide: ["user", "auto", false], rollboxPanelLayer: ["user", "active", false],
    rollboxAutoHide: ["user", false, false], rollboxAutoHideAfter: ["user", 10, false],
    rollboxCardMeters: ["user", ["hp", "mp", "san", "luck"], false], rollboxOffset: ["client", {}, false],
    rollboxCheckOpensOn: ["user", "characteristic", false], rollboxListStyle: ["user", "list", false],
    rollboxSpellTextTab: ["user", "hover", false], rollboxSpellTextCasting: ["user", true, false],
    rollboxPlayerRollbox: ["world", true, true], rollboxPlayerActions: ["world", true, false],
    rollboxPlayerChecks: ["world", true, false], rollboxPlayerCombined: ["world", true, false],
    rollboxPlayerSanity: ["world", true, false], rollboxPlayerLuck: ["world", true, false],
    rollboxPlayerOpposed: ["world", true, false], rollboxPlayerAssist: ["world", true, false],
    rollboxGameplay: ["world", true, false], rollboxNoticeDraw: ["world", true, false],
    rollboxJoinRange: ["world", 60, false],
    rollboxReadiedFirearms: ["world", true, false],
    rollboxBowsReadied: ["world", false, false], rollboxSwitchLosesReadied: ["world", true, false],
    rollboxNoticeRange: ["world", "distance", false], rollboxNoticeDistance: ["world", 20, false],
    rollboxMeleeReach: ["world", 1, false], rollboxCombatPanel: ["user", true, false],
    rollboxTurnSelection: ["user", "select", false], rollboxTurnOrderClick: ["user", "select", false],
    rollboxAutoRollNpc: ["world", true, false], rollboxAutoRollAttacks: ["world", true, false],
    rollboxRollMyAttacks: ["user", true, false],
    rollboxSetupCheck: ["world", true, false]
  });
});

test("'note' and 'reset' are not leaked into Foundry's setting config", async () => {
  const env = makeEnv(); await load(env);
  assert.ok(!("note" in env.registered.rollboxEnabled));
  assert.ok(!("reset" in env.registered.rollboxTransparency));
  assert.ok(!("button" in env.registered.rollboxMovable));
  assert.ok(!("format" in env.registered.rollboxAutoHideAfter));
});

test("every setting key starts with rollbox", async () => {
  const env = makeEnv(); await load(env);
  for (const key of Object.keys(env.registered)) assert.match(key, /^rollbox/);
});

test("the feature switches in a box on top, then one box per section with its heading; one scope note per setting, no duplicates on re-render", async () => {
  const { root, grp } = await renderedForm();
  const boxes = [...root.querySelectorAll("[data-coc-section-box]")].map((box) => box.dataset.cocSectionBox);
  assert.deepEqual(boxes, ["features", "panel", "playerRollbox", "turnOrder", "gameplay"]); // Setup check holds only the menu
  assert.equal(root.querySelectorAll("h4[data-coc-section]").length, 5);
  assert.equal(root.querySelectorAll("[data-coc-scope]").length, 41); // every shown setting (not the players' Sanity or Luck)
  const boxOf = (key) => grp(key).closest("[data-coc-section-box]").dataset.cocSectionBox;
  assert.deepEqual(["rollboxEnabled", "rollboxSetupCheck", "rollboxSimplifiedDice", "rollboxRollMyAttacks", "rollboxAutoRollNpc"]
    .map(boxOf), ["features", "features", "panel", "playerRollbox", "gameplay"]);
  const note = grp("rollboxEnabled").querySelector("[data-coc-scope]");
  assert.equal(note.style.fontStyle, "italic");
});

test("a feature switched off greys out its own section's box, display only: nothing saved", async () => {
  const { dom, root } = await renderedForm();
  const saved = [];
  game.settings.set = async (ns, key, value) => { saved.push(key); };
  const box = (id) => root.querySelector(`[data-coc-section-box="${id}"]`).style.opacity;
  const feature = root.querySelector(`[name="${MODULE_ID}.rollboxEnabled"]`);
  feature.checked = false;
  feature.dispatchEvent(new dom.window.Event("change"));
  assert.deepEqual(["features", "panel", "playerRollbox", "gameplay"].map(box), ["", "0.45", "", ""]);
  feature.checked = true;
  feature.dispatchEvent(new dom.window.Event("change"));
  assert.equal(box("panel"), "");
  assert.deepEqual(saved, []);
});

test("L16: a player's page hides the Keeper's own settings (Show the players, the turn order's selection and click)", async () => {
  const env = makeEnv({ isGM: false, values: { rollboxPlayerRollbox: true } });
  await load(env);
  const keys = ["rollboxEnabled", "rollboxTheme", "rollboxShowPlayers", "rollboxTurnSelection", "rollboxTurnOrderClick",
    "rollboxRollMyAttacks"];
  makeDom(`<form>${keys.map((k) => `<div class="form-group"><label>${k}</label><div class="form-fields">
    <input name="${MODULE_ID}.${k}" type="checkbox" checked></div></div>`).join("")}</form>`);
  const root = document.querySelector("form");
  env.hooks.renderSettingsConfig.forEach((f) => f({}, root));
  const hidden = keys.filter((k) => root.querySelector(`[name="${MODULE_ID}.${k}"]`).closest(".form-group").style.display === "none");
  assert.deepEqual(hidden, ["rollboxShowPlayers", "rollboxTurnSelection", "rollboxTurnOrderClick"]);
  assert.equal(root.querySelector('[data-coc-section-box="turnOrder"]'), null); // nothing of it left to show
});

test("Panel colour and Panel transparency are greyed out while a CoC7 theme is chosen (Foundry theme only)", async () => {
  const { dom, root, grp } = await renderedForm(); // the form's Theme reads Art Deco
  const dimmed = () => ["rollboxColor", "rollboxTransparency", "rollboxScale"].filter((k) => grp(k).style.opacity !== "");
  assert.deepEqual(dimmed(), ["rollboxColor", "rollboxTransparency"]);
  const theme = root.querySelector(`[name="${MODULE_ID}.rollboxTheme"]`);
  theme.value = "foundry";
  theme.dispatchEvent(new dom.window.Event("change"));
  assert.deepEqual(dimmed(), []);
});

test("jQuery-style arg ignored without error", async () => {
  const { env, root } = await renderedForm();
  env.hooks.renderSettingsConfig.forEach((f) => f({}, [root]));
});

test("Reset buttons: one beside theme, transparency, colour, size and notice cards size, none on the switch, no duplicates on re-render", async () => {
  const { root, grp } = await renderedForm();
  assert.equal(root.querySelectorAll("[data-coc-reset]").length, 5);
  assert.equal(grp("rollboxEnabled").querySelector("[data-coc-reset]"), null);
  for (const key of Object.keys(CHANGED)) {
    const button = grp(key).querySelector(".form-fields [data-coc-reset]");
    assert.equal(button.type, "button"); // never submits the form
  }
});

test("a Reset position button beside Allow moving the panel forgets the panel's spot at once", async () => {
  const { grp } = await renderedForm();
  const saved = [];
  game.settings.set = async (ns, key, value) => { saved.push([key, value]); };
  const button = grp("rollboxMovable").querySelector(".form-fields [data-coc-action]");
  assert.deepEqual([button.type, button.textContent], ["button", "Reset position"]); // never submits the form
  button.click();
  assert.deepEqual(saved, [["rollboxOffset", {}]]);
  assert.equal(grp("rollboxMovable").querySelectorAll("[data-coc-action]").length, 1); // none added on the re-render
});

test("each Reset puts back only its own default, in the form, with a change event", async () => {
  const defaults = { rollboxTheme: "foundry", rollboxTransparency: "25", rollboxColor: "#0b0a13", rollboxScale: "100" };
  for (const key of Object.keys(CHANGED)) {
    const { root, grp } = await renderedForm();
    const changed = [];
    root.addEventListener("change", (event) => changed.push(event.target.name), true);
    grp(key).querySelector("[data-coc-reset]").click();
    const values = Object.fromEntries(Object.keys(CHANGED)
      .map((k) => [k, root.querySelector(`[name="${MODULE_ID}.${k}"]`).value]));
    assert.deepEqual(values, { ...CHANGED, [key]: defaults[key] });
    assert.deepEqual(changed, [`${MODULE_ID}.${key}`]);
  }
});

test("Auto-hide after: its time reads in seconds or minutes beside the slider, following it", async () => {
  const { dom, root, grp } = await renderedForm();
  const input = root.querySelector(`[name="${MODULE_ID}.rollboxAutoHideAfter"]`);
  const text = () => grp("rollboxAutoHideAfter").querySelector("[data-coc-value]").textContent;
  input.value = "150";
  input.dispatchEvent(new dom.window.Event("input"));
  assert.equal(text(), "2 min 30 s");
  input.value = "45";
  input.dispatchEvent(new dom.window.Event("change"));
  assert.equal(text(), "45 s");
});

test("a player's Configure Settings: Rollbox's tab and settings hidden while the Player Rollbox is off, shown when on", async () => {
  for (const on of [false, true]) {
    const env = makeEnv({ isGM: false, values: { rollboxPlayerRollbox: on } });
    globalThis.requestAnimationFrame = (f) => setTimeout(f, 0);
    makeDom(`<nav><button data-tab="${MODULE_ID}"></button></nav><section data-category="${MODULE_ID}">
      <div class="form-group"><label>Theme</label><input name="${MODULE_ID}.rollboxTheme"></div></section>`);
    await load(env);
    env.hooks.renderSettingsConfig.forEach((f) => f({}, document.body));
    const shown = (selector) => document.querySelector(selector).style.display !== "none";
    assert.deepEqual([shown("button"), shown("section"), shown(".form-group")], [on, on, on]);
  }
});

test("Check setup now: Foundry's menu button (drawn first in the tab) moves into the Setup check section, after the feature switches, with its note", async () => {
  const env = makeEnv();
  const menus = {};
  game.settings.registerMenu = (ns, key, data) => { menus[key] = data; };
  globalThis.foundry.applications = { api: { ApplicationV2: class {} } };
  await load(env);
  assert.deepEqual([menus.rollboxSetupCheckNow.label, menus.rollboxSetupCheckNow.restricted], ["Check now", true]);
  makeDom(`<form><div class="form-group"><label>Check setup now</label><div class="form-fields">
    <button data-key="${MODULE_ID}.rollboxSetupCheckNow"></button></div></div>
    <div class="form-group"><label>x</label><div class="form-fields">
    <input name="${MODULE_ID}.rollboxSetupCheck" type="checkbox" checked></div></div></form>`);
  const root = document.querySelector("form");
  env.hooks.renderSettingsConfig.forEach((f) => f({}, root));
  const groups = [...root.querySelectorAll(".form-group")];
  assert.equal(groups[1].querySelector("button").dataset.key, `${MODULE_ID}.rollboxSetupCheckNow`);
  assert.equal(groups[1].closest("[data-coc-section-box]").dataset.cocSectionBox, "setup");
  assert.equal(groups[1].querySelector("[data-coc-scope]").textContent, "Keeper setting, applies to everyone.");
  delete globalThis.foundry.applications;
});
