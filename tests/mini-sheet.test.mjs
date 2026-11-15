import assert from "node:assert/strict";
import { test } from "node:test";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { registerMiniSheet, registerMenu } from "../scripts/mini-sheet/index.js";
import { toHsl } from "../scripts/mini-sheet/theme.js";
import { addStyles, makeActor, makeDom, makeEnv, load } from "./mocks.mjs";

const SCRIPTS = fileURLToPath(new URL("../scripts/", import.meta.url));

/** The hooks main.js always installs; the panel adds its own only on the Keeper's client. */
const WIRING_HOOKS = ["init", "renderSettingsConfig", "ready"];
const PANEL_HOOKS = ["controlToken", "deleteToken", "canvasReady", "canvasTearDown", "renderPlayers", "updateActor"];

/**
 * Foundry's left column with the players list, a canvas with a selection, and animation frames that run
 * only when flush() is called. Then main.js is loaded, as at ready.
 */
async function setup({ isGM = true, values } = {}) {
  const env = makeEnv({ isGM, values });
  makeDom(`<div id="ui-left-column-1"><menu id="scene-controls"></menu><aside id="players"></aside></div>`);
  const frames = new Map(); let next = 1;
  globalThis.requestAnimationFrame = (f) => { frames.set(next, f); return next++; };
  globalThis.cancelAnimationFrame = (id) => frames.delete(id);
  globalThis.canvas = { tokens: { controlled: [] } };
  await load(env);
  const flush = () => { const due = [...frames.values()]; frames.clear(); due.forEach((f) => f()); };
  /** Select these tokens: the controlToken hook fires once per token, as in Foundry. */
  const select = (tokens) => {
    canvas.tokens.controlled = tokens;
    for (const token of tokens) Hooks.call("controlToken", token, true);
    if (!tokens.length) Hooks.call("controlToken", {}, false);
  };
  const panel = () => document.querySelector(".rollbox-panel");
  const visible = () => Boolean(panel()) && !panel().hidden;
  const buttons = () => [...document.querySelectorAll(".rollbox-button")].map((b) => b.textContent);
  const click = (label) => [...document.querySelectorAll(".rollbox-button")]
    .find((b) => b.textContent === label).click();
  const flyout = () => document.querySelector(".rollbox-flyout");
  return { env, frames, flush, select, panel, visible, buttons, click, flyout };
}

/** A token for a CoC7 character: owners are user names (none: an NPC), plus HP, MP and occupation. */
function token(name, { owners = [], occupation = "", san = 50, luck = 40, uuid } = {}) {
  const actor = makeActor({ name, san, sanMax: 99, luck,
    characteristics: { str: 50, con: 60, siz: 65, dex: 70, app: 45, int: 80, pow: 55, edu: 85 } });
  actor.uuid = uuid ?? `Actor.${name}`;
  actor.img = `${name}.webp`;
  actor.owners = owners.map((userName) => ({ name: userName, isGM: false }));
  actor.system.attribs.hp = { value: 9, max: 12 };
  actor.system.attribs.mp = { value: 11, max: 11 };
  actor.system.infos = { occupation };
  actor.sheet = { renders: [], render(force) { this.renders.push(force); } };
  return { actor };
}

const text = (selector) => [...document.querySelectorAll(selector)].map((node) => node.textContent);

test("main.js calls the panel at ready, which installs its hooks on the Keeper's client", async () => {
  const { env } = await setup();
  assert.deepEqual(Object.keys(env.hooks).sort(), [...WIRING_HOOKS, ...PANEL_HOOKS].sort());
  assert.ok(env.reads.includes("rollboxEnabled"));
});

test("player: does nothing, installs no hooks, never reads the setting, draws nothing", async () => {
  const s = await setup({ isGM: false });
  assert.equal(registerMiniSheet(), false);
  assert.deepEqual(Object.keys(s.env.hooks).sort(), [...WIRING_HOOKS].sort());
  assert.deepEqual(s.env.reads, []);
  s.select([token("Harvey")]); s.flush();
  assert.equal(s.panel(), null);
  let saved = 0;
  game.settings.set = () => { saved += 1; };
  s.env.registered.rollboxTheme.onChange("light"); // a player's own theme change flips nothing
  assert.equal(saved, 0);
});

test("Keeper with the switch off: installs no hooks, draws nothing", async () => {
  const s = await setup({ values: { rollboxEnabled: false } });
  assert.equal(registerMiniSheet(), false);
  assert.deepEqual(Object.keys(s.env.hooks).sort(), [...WIRING_HOOKS].sort());
  s.select([token("Harvey")]); s.flush();
  assert.equal(s.panel(), null);
});

test("no user yet: does nothing instead of throwing", async () => {
  const env = makeEnv(); await load(env);
  game.user = undefined;
  assert.equal(registerMiniSheet(), false);
});

test("1 token: mini sheet just before the players list, with Check, Sanity, Item", async () => {
  const s = await setup();
  const harvey = token("Harvey Walters", { owners: ["Player 1"], occupation: "Journalist", san: 62, luck: 55 });
  s.select([harvey]); s.flush();
  assert.equal(s.visible(), true);
  assert.equal(s.panel().nextElementSibling.id, "players");
  assert.deepEqual(text(".rollbox-sheet .rollbox-name"), ["Harvey Walters"]);
  assert.deepEqual(text(".rollbox-sheet .rollbox-sub"), ["Journalist · Player 1"]);
  assert.equal(document.querySelector(".rollbox-portrait").getAttribute("src"), "Harvey Walters.webp");
  assert.deepEqual(text(".rollbox-stat-value"), ["9/12", "11/11", "62", "55"]);
  assert.deepEqual(text(".rollbox-characteristic-value"), ["50", "60", "65", "70", "45", "80", "55", "85"]);
  assert.deepEqual(s.buttons(), ["Check", "Sanity", "Item"]);
});

test("1 token: the sheet button opens the full sheet", async () => {
  const s = await setup();
  const harvey = token("Harvey");
  s.select([harvey]); s.flush();
  document.querySelector(".rollbox-open-sheet").click();
  assert.deepEqual(harvey.actor.sheet.renders, [true]);
});

test("1 NPC: subtitle is \"occupation · NPC\"; the full name is the name's tooltip on both cards", async () => {
  const s = await setup();
  const steward = token("Ettore Bonaventura", { occupation: "Steward" });
  s.select([steward]); s.flush();
  assert.deepEqual(text(".rollbox-sheet .rollbox-sub"), ["Steward · NPC"]);
  assert.equal(document.querySelector(".rollbox-sheet .rollbox-name").title, "Ettore Bonaventura");
  s.select([steward, token("Harvey")]); s.flush();
  assert.equal(document.querySelector(".rollbox-names .rollbox-name").title, "Ettore Bonaventura");
});

test("panel transparency: the saved value sets the background alpha; a change applies at once", async () => {
  const s = await setup({ values: { rollboxTransparency: 30 } });
  s.select([token("Harvey")]); s.flush();
  assert.equal(s.panel().style.getPropertyValue("--rollbox-opacity"), "70%");
  s.env.registered.rollboxTransparency.onChange(0);
  assert.equal(s.panel().style.getPropertyValue("--rollbox-opacity"), "100%");
  assert.equal(s.panel().style.opacity, ""); // never the whole panel's opacity: text stays readable
});

test("panel colour: the saved colour is the panel's background colour; a change applies at once", async () => {
  const s = await setup({ values: { rollboxColor: "#2a3b4c" } });
  s.select([token("Harvey")]); s.flush();
  assert.equal(s.panel().style.getPropertyValue("--rollbox-color"), "#2a3b4c");
  // Foundry's ColorField gives a Color: a Number whose string is "#rrggbb".
  s.env.registered.rollboxColor.onChange({ toString: () => "#401010" });
  assert.equal(s.panel().style.getPropertyValue("--rollbox-color"), "#401010");
  assert.equal(s.panel().style.getPropertyValue("--rollbox-opacity"), "75%"); // transparency still applies
});

test("theme: Light gives the panel the Light palette and shows the colour light; Dark switches back at once", async () => {
  const s = await setup({ values: { rollboxTheme: "light", rollboxColor: "#0b0a13" } });
  addStyles("mini-sheet/mini-sheet.css");
  s.select([token("Harvey")]); s.flush();
  const text = () => document.defaultView.getComputedStyle(s.panel()).getPropertyValue("--rollbox-text").trim();
  const shown = () => toHsl(s.panel().style.getPropertyValue("--rollbox-color"));
  assert.equal(s.panel().classList.contains("rollbox-theme-light"), true);
  assert.equal(text(), "#221e29"); // the Light palette's dark text
  assert.ok(shown()[2] > 80 && Math.abs(shown()[0] - toHsl("#0b0a13")[0]) < 2); // light, with the colour's hue
  game.settings.set = () => {};
  s.env.registered.rollboxTheme.onChange("dark");
  assert.equal(s.panel().classList.contains("rollbox-theme-light"), false);
  assert.equal(text(), "var(--color-light-2, #efe6d8)"); // the Dark palette's light text
});

test("theme switch: the Panel colour's lightness flips (hue and saturation kept) and is saved; a fitting colour stays", async () => {
  const s = await setup({ values: { rollboxColor: "#1a2440" } });
  const saved = [];
  game.settings.set = (namespace, key, value) => { saved.push([namespace, key, value]); s.env.values[key] = value; };
  s.select([token("Harvey")]); s.flush();
  const [hue, saturation, lightness] = toHsl("#1a2440");
  s.env.registered.rollboxTheme.onChange("light");
  const [, key, light] = saved[0];
  assert.equal(key, "rollboxColor");
  const flipped = toHsl(light);
  assert.ok(Math.abs(flipped[0] - hue) < 2 && Math.abs(flipped[1] - saturation) < 3);
  assert.ok(Math.abs(flipped[2] - (100 - lightness)) < 1); // L → 100 − L, readable as it is
  assert.equal(s.panel().style.getPropertyValue("--rollbox-color"), light);
  s.env.registered.rollboxTheme.onChange("dark");
  assert.ok(Math.abs(toHsl(saved[1][2])[2] - lightness) < 1); // and back
  s.env.registered.rollboxTheme.onChange("dark"); // already dark enough: left alone
  assert.equal(saved.length, 2);
});

test("panel size: scales the whole panel from its bottom-left corner; 100% leaves it untransformed", async () => {
  const s = await setup({ values: { rollboxScale: 120 } });
  s.select([token("Harvey")]); s.flush();
  assert.equal(s.panel().style.transform, "scale(1.2)");
  assert.equal(s.panel().style.transformOrigin, "left bottom");
  s.env.registered.rollboxScale.onChange(100);
  assert.equal(s.panel().style.transform, "");
});

test("2 tokens: names card with owner or 'NPC · Keeper rolls', SAN and Luck; Check, Sanity, Opposed, Assist", async () => {
  const s = await setup();
  s.select([token("Harvey", { owners: ["Player 1"], san: 62, luck: 55 }), token("Cultist", { san: 30, luck: 50 })]);
  s.flush();
  assert.equal(document.querySelector(".rollbox-sheet"), null);
  assert.deepEqual(text(".rollbox-names .rollbox-name"), ["Harvey", "Cultist"]);
  assert.deepEqual(text(".rollbox-names .rollbox-sub"), ["Player 1", "NPC · Keeper rolls"]);
  assert.deepEqual(text(".rollbox-names-san"), ["62", "30"]);
  assert.deepEqual(text(".rollbox-names-luck"), ["55", "50"]);
  assert.deepEqual(s.buttons(), ["Check", "Sanity", "Opposed", "Assist"]);
});

test("3 or more tokens: names card, one row each with no upper limit; Check, Sanity and Assist", async () => {
  const s = await setup();
  s.select(["A", "B", "C", "D", "E", "F"].map((n) => token(n))); s.flush();
  assert.equal(document.querySelectorAll(".rollbox-names-row").length, 6);
  assert.deepEqual(s.buttons(), ["Check", "Sanity", "Assist"]);
});

test("request buttons: one constant height from the CSS; no script sets it, whatever is selected", async () => {
  const s = await setup();
  addStyles("mini-sheet/mini-sheet.css");
  for (const count of [1, 2, 3, 8]) {
    s.select(["A", "B", "C", "D", "E", "F", "G", "H"].slice(0, count).map((n) => token(n))); s.flush();
    assert.equal(s.panel().style.getPropertyValue("--rollbox-button-height"), "");
  }
  const style = (selector) => document.defaultView.getComputedStyle(document.querySelector(selector));
  // Three buttons and two gaps fill the mini sheet's height: worked out from the gap the button column uses.
  assert.match(style(".rollbox-panel").getPropertyValue("--rollbox-button-height").trim(),
    /^calc\(.*var\(--rollbox-sheet-height\).*var\(--rollbox-button-gap\).*\)$/);
  assert.equal(style(".rollbox-buttons").gap, "var(--rollbox-button-gap)");
  assert.deepEqual([style(".rollbox-button").height, style(".rollbox-button").flexGrow], ["var(--rollbox-button-height)", "0"]);
  const scripts = readdirSync(SCRIPTS, { recursive: true }).filter((file) => file.endsWith(".js"));
  assert.ok(scripts.every((file) => !readFileSync(new URL(file.replaceAll("\\", "/"), pathToFileURL(SCRIPTS)), "utf8")
    .includes("--rollbox-button-height")));
});

test("names card: ten rows before it scrolls, sized by its row height, not pixels", async () => {
  const s = await setup();
  addStyles("mini-sheet/mini-sheet.css");
  s.select(["A", "B", "C"].map((n) => token(n))); s.flush();
  const style = (selector) => document.defaultView.getComputedStyle(document.querySelector(selector));
  assert.notEqual(style(".rollbox-names-list").getPropertyValue("--rollbox-row-height"), "");
  assert.equal(style(".rollbox-names-list").maxHeight, "calc(10 * var(--rollbox-row-height) + 9 * var(--rollbox-row-gap))");
  assert.equal(style(".rollbox-names-row").height, "var(--rollbox-row-height)");
});

test("token without an actor is left out; with nothing else selected the panel stays hidden", async () => {
  const s = await setup();
  s.select([{ actor: null }]); s.flush();
  assert.equal(s.visible(), false);
  s.select([{ actor: null }, token("Harvey")]); s.flush();
  assert.deepEqual(text(".rollbox-sheet .rollbox-name"), ["Harvey"]);
});

test("a box-select's many hooks make one redraw on the next frame", async () => {
  const s = await setup();
  s.select(["A", "B", "C", "D"].map((n) => token(n)));
  assert.equal(s.frames.size, 1);
  assert.equal(s.panel(), null); // nothing drawn until the frame runs
  s.flush();
  assert.equal(document.querySelectorAll(".rollbox-names-row").length, 4);
});

test("scene change: canvasTearDown hides at once; canvasReady draws the new selection", async () => {
  const s = await setup();
  s.select([token("Harvey")]); s.flush();
  Hooks.call("canvasTearDown");
  assert.equal(s.visible(), false);
  canvas.tokens.controlled = [token("Ellen")];
  Hooks.call("canvasReady"); s.flush();
  assert.deepEqual(text(".rollbox-sheet .rollbox-name"), ["Ellen"]);
});

test("menu host: a button opens its flyout and is marked; clicking it again closes it", async () => {
  const s = await setup();
  s.select([token("Harvey")]); s.flush();
  assert.equal(s.flyout().hidden, true);
  s.click("Sanity");
  assert.equal(s.flyout().hidden, false);
  assert.deepEqual(text(".rollbox-flyout-title"), ["Sanity check"]);
  assert.deepEqual(text('.rollbox-button[aria-pressed="true"]'), ["Sanity"]);
  s.click("Check");
  assert.deepEqual(text(".rollbox-flyout-title"), ["Request a check"]);
  s.click("Check");
  assert.equal(s.flyout().hidden, true);
  assert.equal(document.querySelectorAll('.rollbox-button[aria-pressed="true"]').length, 0);
});

test("menu host: a registered menu draws for the selection; closes when its button goes or nothing is selected",
  async () => {
  const s = await setup();
  const calls = [];
  assert.equal(registerMenu("item", { title: "Item", render: (body, { actors }) => {
    calls.push(actors.map((a) => a.name)); body.textContent = "weapons";
  } }), true);
  const harvey = token("Harvey");
  s.select([harvey]); s.flush();
  s.click("Item");
  assert.deepEqual(calls, [["Harvey"]]);
  assert.equal(document.querySelector(".rollbox-flyout-body").textContent, "weapons");
  Hooks.call("updateActor", harvey.actor); s.flush(); // same selection: the menu isn't drawn again
  assert.equal(calls.length, 1);
  s.select([harvey, token("Cultist")]); s.flush(); // two selected: no Item button
  assert.equal(s.flyout().hidden, true);
  s.click("Check");
  s.select([]); s.flush();
  assert.equal(s.visible(), false);
  assert.equal(s.flyout().hidden, true);
});

test("registerMenu: an unknown menu or layout, or one without render, is refused", async () => {
  await setup();
  assert.equal(registerMenu("combat", { render: () => {} }), false);
  assert.equal(registerMenu("check", {}), false);
  assert.equal(registerMenu("check", { render: () => {}, layout: "popup" }), false);
});

test("menu host: a replace menu takes the names card's place and hides the buttons; close brings them back",
  async () => {
  const s = await setup();
  let close = null;
  registerMenu("opposed", { layout: "replace", render: (stage, context) => {
    close = context.close; stage.textContent = context.actors.map((a) => a.name).join(" vs ");
  } });
  const stage = () => document.querySelector(".rollbox-stage");
  s.select([token("Harvey"), token("Cultist")]); s.flush();
  s.click("Opposed");
  assert.equal(document.querySelector(".rollbox-card-slot").hidden, true);
  assert.equal(document.querySelector(".rollbox-buttons").hidden, true);
  assert.equal(s.flyout().hidden, true);
  assert.equal(stage().hidden, false);
  assert.equal(stage().textContent, "Harvey vs Cultist");
  close();
  assert.equal(stage().hidden, true);
  assert.equal(document.querySelector(".rollbox-card-slot").hidden, false);
  assert.deepEqual(text(".rollbox-names .rollbox-name"), ["Harvey", "Cultist"]);
  assert.equal(document.querySelector(".rollbox-buttons").hidden, false);
  s.click("Opposed");
  s.select([token("A"), token("B"), token("C")]); s.flush(); // three: no Opposed button, so it closes
  assert.equal(stage().hidden, true);
  assert.deepEqual(s.buttons(), ["Check", "Sanity", "Assist"]);
});

test("menu host: a staysOpen menu stays open with one token, and is told when the selection changed", async () => {
  const s = await setup();
  const calls = [];
  registerMenu("assist", { staysOpen: true, render: (body, { actors, selectionChanged }) => {
    calls.push([actors.length, selectionChanged]);
  } });
  const harvey = token("Harvey");
  s.select([harvey, token("Cecil")]); s.flush();
  s.click("Assist");
  s.select([harvey]); s.flush(); // one: no Assist button, but it stays open
  assert.deepEqual(s.buttons(), ["Check", "Sanity", "Item"]);
  assert.equal(s.flyout().hidden, false);
  assert.deepEqual(calls, [[2, false], [1, true]]);
  s.select([]); s.flush();
  assert.equal(s.flyout().hidden, true);
});

test("names card: its value columns follow the open menu (SAN and Luck; SAN with Sanity; STR or SIZ with Assist)",
  async () => {
  const s = await setup();
  const zombie = token("Zombie", { san: 0, luck: 0 });
  zombie.actor.type = "creature"; // CoC7's creature: Assist starts it marked as a target
  zombie.actor.system.characteristics.str.value = 80;
  s.select([token("Harvey", { san: 62, luck: 55 }), zombie]); s.flush();
  const columns = () => text(".rollbox-names-col");
  const values = () => text(".rollbox-names-value");
  s.click("Sanity");
  assert.deepEqual([columns(), values()], [["SAN"], ["62", "0"]]);
  s.click("Assist"); // Harvey takes part with his STR; the Zombie is a target, with its STR
  assert.deepEqual([columns(), values()], [["STR"], ["50", "80"]]);
  document.querySelector('[aria-label="Against"] [data-value="siz"]').click(); // the target's SIZ counts now
  assert.deepEqual([columns(), values()], [["STR/SIZ"], ["50", "65"]]);
  s.click("Assist"); // closed: SAN and Luck again
  assert.deepEqual([columns(), values()], [["SAN", "Luck"], ["62", "55", "0", "0"]]);
});

test("menu host: a replace menu that fails to draw closes, so the card and buttons stay", async () => {
  const s = await setup();
  registerMenu("opposed", { layout: "replace", render: () => { throw new Error("broken"); } });
  s.select([token("Harvey"), token("Cultist")]); s.flush();
  s.click("Opposed");
  assert.equal(document.querySelector(".rollbox-card-slot").hidden, false);
  assert.equal(document.querySelector(".rollbox-buttons").hidden, false);
  assert.equal(document.querySelectorAll('.rollbox-button[aria-pressed="true"]').length, 0);
});

test("updateActor: a shown character's new values are drawn", async () => {
  const s = await setup();
  const harvey = token("Harvey", { san: 62 });
  s.select([harvey]); s.flush();
  harvey.actor.system.attribs.san.value = 55;
  Hooks.call("updateActor", harvey.actor); s.flush();
  assert.equal(text(".rollbox-stat-san .rollbox-stat-value")[0], "55");
});
