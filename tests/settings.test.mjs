import assert from "node:assert/strict";
import { test } from "node:test";
import { MODULE_ID } from "../scripts/utils.js";
import { makeDom, makeEnv, load } from "./mocks.mjs";

/** Foundry v14's colour field, enough to see that the colour setting uses it. Set before main.js loads. */
class ColorField { constructor(options) { this.options = options; } }
globalThis.foundry = { data: { fields: { ColorField } } };

/** Values in the form that differ from every default, so a Reset shows. */
const CHANGED = { rollboxTheme: "light", rollboxTransparency: "50", rollboxColor: "#ffffff", rollboxScale: "120" };

/** The settings form, decorated twice: a re-render must not duplicate anything. */
async function renderedForm() {
  const env = makeEnv(); await load(env);
  const keys = Object.keys(env.registered);
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

test("registered in page order: the panel switch and Simplified dice UI, then Appearance (theme, colour, transparency, size)", async () => {
  const env = makeEnv(); await load(env);
  assert.deepEqual(Object.keys(env.registered),
    ["rollboxEnabled", "rollboxSimplifiedDice", "rollboxTheme", "rollboxColor", "rollboxTransparency", "rollboxScale"]);
});

test("Theme: a personal Dark | Light choice, default Dark, applied at once", async () => {
  const env = makeEnv(); await load(env);
  const { scope, type, choices, default: value, requiresReload, onChange } = env.registered.rollboxTheme;
  assert.deepEqual({ scope, type: type.name, choices, value, requiresReload, live: typeof onChange === "function" },
    { scope: "user", type: "String", choices: { dark: "Dark", light: "Light" }, value: "dark", requiresReload: false, live: true });
});

test("each setting: scope, type, default, range, and whether it needs a reload", async () => {
  const env = makeEnv(); await load(env);
  const shape = (key) => {
    const { scope, type, default: value, range, requiresReload, config, onChange } = env.registered[key];
    return { scope, type: type instanceof ColorField ? "ColorField" : type.name, value, range, requiresReload, config,
      live: typeof onChange === "function" };
  };
  const personal = { scope: "user", config: true };
  assert.deepEqual(shape("rollboxEnabled"),
    { ...personal, type: "Boolean", value: true, range: undefined, requiresReload: true, live: false });
  assert.deepEqual(shape("rollboxSimplifiedDice"),
    { ...personal, type: "Boolean", value: false, range: undefined, requiresReload: false, live: true });
  assert.deepEqual(shape("rollboxColor"),
    { ...personal, type: "ColorField", value: "#0b0a13", range: undefined, requiresReload: false, live: true });
  assert.deepEqual(shape("rollboxTransparency"),
    { ...personal, type: "Number", value: 25, range: { min: 0, max: 70, step: 5 }, requiresReload: false, live: true });
  assert.deepEqual(shape("rollboxScale"),
    { ...personal, type: "Number", value: 100, range: { min: 80, max: 150, step: 10 }, requiresReload: false, live: true });
});

test("'note' and 'reset' are not leaked into Foundry's setting config", async () => {
  const env = makeEnv(); await load(env);
  assert.ok(!("note" in env.registered.rollboxEnabled));
  assert.ok(!("reset" in env.registered.rollboxTransparency));
});

test("every setting key starts with rollbox", async () => {
  const env = makeEnv(); await load(env);
  for (const key of Object.keys(env.registered)) assert.match(key, /^rollbox/);
});

test("two headings, each before its group's first setting, and one Personal note per setting, no duplicates on re-render", async () => {
  const { root, grp } = await renderedForm();
  const heads = [...root.querySelectorAll("h4.border")].map((h) => h.textContent);
  assert.deepEqual(heads, ["Keeper's Rollbox", "Appearance"]);
  assert.equal(root.querySelectorAll("[data-coc-scope]").length, 6);
  const note = grp("rollboxEnabled").querySelector("[data-coc-scope]");
  assert.equal(note.textContent, "Personal setting, affects only your screen.");
  assert.equal(note.style.fontStyle, "italic");
  // Each heading sits directly before its group's first setting.
  assert.equal(grp("rollboxEnabled").previousElementSibling.textContent, "Keeper's Rollbox");
  assert.equal(grp("rollboxTheme").previousElementSibling.textContent, "Appearance");
});

test("turning the panel off dims Simplified dice UI and the whole Appearance group", async () => {
  const { dom, root, grp } = await renderedForm();
  const master = root.querySelector(`[name="${MODULE_ID}.rollboxEnabled"]`);
  master.checked = false;
  master.dispatchEvent(new dom.window.Event("change"));
  const dimmed = ["rollboxEnabled", "rollboxSimplifiedDice", "rollboxTheme", "rollboxColor", "rollboxTransparency", "rollboxScale"]
    .filter((k) => grp(k).style.opacity !== "");
  assert.deepEqual(dimmed, ["rollboxSimplifiedDice", "rollboxTheme", "rollboxColor", "rollboxTransparency", "rollboxScale"]);
});

test("jQuery-style arg ignored without error", async () => {
  const { env, root } = await renderedForm();
  env.hooks.renderSettingsConfig.forEach((f) => f({}, [root]));
});

test("Reset buttons: one beside theme, transparency, colour and size, none on the switch, no duplicates on re-render", async () => {
  const { root, grp } = await renderedForm();
  assert.equal(root.querySelectorAll("[data-coc-reset]").length, 4);
  assert.equal(grp("rollboxEnabled").querySelector("[data-coc-reset]"), null);
  for (const key of Object.keys(CHANGED)) {
    const button = grp(key).querySelector(".form-fields [data-coc-reset]");
    assert.equal(button.type, "button"); // never submits the form
  }
});

test("each Reset puts back only its own default, in the form, with a change event", async () => {
  const defaults = { rollboxTheme: "dark", rollboxTransparency: "25", rollboxColor: "#0b0a13", rollboxScale: "100" };
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
