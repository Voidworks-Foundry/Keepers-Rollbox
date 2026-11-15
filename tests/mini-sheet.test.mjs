import assert from "node:assert/strict";
import { test } from "node:test";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { miniSheet, registerMiniSheet, registerMenu, resetPosition } from "../scripts/mini-sheet/index.js";
import { toHsl } from "../scripts/mini-sheet/theme.js";
import { boxAt, clampBox, clampSpot, nearestCorner, normalSpot, spotOf } from "../scripts/mini-sheet/placement.js";
import { shortcut } from "../scripts/mini-sheet/sheet-clicks.js";
import { addStyles, makeActor, makeDom, makeEnv, load } from "./mocks.mjs";

const SCRIPTS = fileURLToPath(new URL("../scripts/", import.meta.url));

/** The hooks main.js always installs; the panel adds its own only on the Keeper's client. */
const WIRING_HOOKS = ["init", "renderSettingsConfig", "ready"];
const PANEL_HOOKS = ["controlToken", "deleteToken", "canvasReady", "canvasTearDown", "renderPlayers", "updateActor"];

/**
 * Foundry's left column with the players list, a canvas with a selection, and animation frames that run
 * only when flush() is called. Then main.js is loaded, as at ready.
 */
async function setup({ isGM = true, values, html } = {}) {
  const env = makeEnv({ isGM, values });
  const window = makeDom(html ?? `<div id="ui-left-column-1"><menu id="scene-controls"></menu><aside id="players"></aside></div>`);
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
  return { env, window, frames, flush, select, panel, visible, buttons, click, flyout };
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

test("player: does nothing, installs no hooks or listeners, never reads the setting, draws nothing", async () => {
  const s = await setup({ isGM: false });
  const listeners = [];
  globalThis.addEventListener = (type) => listeners.push(type);
  assert.equal(registerMiniSheet(), false);
  delete globalThis.addEventListener;
  assert.deepEqual(listeners, []); // no resize listener; with no panel there is nothing to drag
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

test("1 token: mini sheet just before the players list, with Check, Sanity, Other", async () => {
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
  assert.deepEqual(s.buttons(), ["Check", "Sanity", "Other"]);
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

test("2 tokens: names card with owner or 'NPC · Keeper rolls', SAN and Luck; Check, Sanity, Other, Opposed, Assist", async () => {
  const s = await setup();
  s.select([token("Harvey", { owners: ["Player 1"], san: 62, luck: 55 }), token("Cultist", { san: 30, luck: 50 })]);
  s.flush();
  assert.equal(document.querySelector(".rollbox-sheet"), null);
  assert.deepEqual(text(".rollbox-names .rollbox-name"), ["Harvey", "Cultist"]);
  assert.deepEqual(text(".rollbox-names .rollbox-sub"), ["Player 1", "NPC · Keeper rolls"]);
  assert.deepEqual(text(".rollbox-names-san"), ["62", "30"]);
  assert.deepEqual(text(".rollbox-names-luck"), ["55", "50"]);
  assert.deepEqual(s.buttons(), ["Check", "Sanity", "Other", "Opposed", "Assist"]);
});

test("3 or more tokens: names card, one row each with no upper limit; Check, Sanity, Other and Assist", async () => {
  const s = await setup();
  s.select(["A", "B", "C", "D", "E", "F"].map((n) => token(n))); s.flush();
  assert.equal(document.querySelectorAll(".rollbox-names-row").length, 6);
  assert.deepEqual(s.buttons(), ["Check", "Sanity", "Other", "Assist"]);
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

test("menu host: a registered menu draws for the selection, again when it changes; closes when nothing is selected",
  async () => {
  const s = await setup();
  const calls = [];
  assert.equal(registerMenu("other", { title: "Other", render: (body, { actors }) => {
    calls.push(actors.map((a) => a.name)); body.textContent = "weapons";
  } }), true);
  const harvey = token("Harvey");
  s.select([harvey]); s.flush();
  s.click("Other");
  assert.deepEqual(calls, [["Harvey"]]);
  assert.equal(document.querySelector(".rollbox-flyout-body").textContent, "weapons");
  Hooks.call("updateActor", harvey.actor); s.flush(); // same selection: the menu isn't drawn again
  assert.equal(calls.length, 1);
  s.select([harvey, token("Cultist")]); s.flush(); // two selected: Other is still offered, drawn for both
  assert.deepEqual(calls, [["Harvey"], ["Harvey", "Cultist"]]);
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
  assert.deepEqual(s.buttons(), ["Check", "Sanity", "Other", "Assist"]);
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
  assert.deepEqual(s.buttons(), ["Check", "Sanity", "Other"]);
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

/** Foundry's screen (build 368): #interface, 1600 by 900, holding the left column with the players list. */
const SCREEN = { left: 0, top: 0, right: 1600, bottom: 900, width: 1600, height: 900 };
const INTERFACE = `<div id="interface"><section id="ui-left"><div id="ui-left-column-1"><menu id="scene-controls"></menu>
  <aside id="players"></aside></div></section></div>`;
/** The docked mini sheet, just above the players list. */
const DOCKED = { left: 16, top: 640, width: 200, height: 182 };

/**
 * The panel on Foundry's screen, with the layout jsdom doesn't do: #interface is SCREEN; the 200 by 182 panel is at
 * DOCKED in the left column, and where its inline position puts it in #interface (unless `layoutFails`: then it stays
 * drawn where it was, as when the browser didn't apply its position). Settings are saved as Foundry does for a client
 * setting: at once, calling its onChange; each save is recorded in `saved`.
 */
async function onScreen(values = {}, { layoutFails = false } = {}) {
  const s = await setup({ values, html: INTERFACE });
  document.getElementById("interface").getBoundingClientRect = () => SCREEN;
  const saved = [];
  game.settings.set = async (ns, key, value) => {
    saved.push([key, value]);
    s.env.registered[key].onChange?.(value);
  };
  const box = (panel) => {
    const st = panel.style;
    if (layoutFails || panel.parentElement?.id !== "interface") return DOCKED;
    const left = st.left ? parseFloat(st.left) : SCREEN.width - parseFloat(st.right) - DOCKED.width;
    const top = st.top ? parseFloat(st.top) : SCREEN.height - parseFloat(st.bottom) - DOCKED.height;
    return { ...DOCKED, left, top };
  };
  /** The buttons (56px) and, while a menu is open, its 320px flyout, 8px beside the card on its menus' side. */
  const sideBox = (panel) => {
    const b = box(panel);
    const width = panel.querySelector(".rollbox-flyout").hidden ? 56 : 384;
    const left = panel.classList.contains("rollbox-menus-left") ? b.left - 8 - width : b.left + b.width + 8;
    return { left, top: b.top, width, height: b.height, right: left + width, bottom: b.top + b.height };
  };
  globalThis.HTMLElement.prototype.getBoundingClientRect = function () {
    if (this.classList.contains("rollbox-side")) return sideBox(this.closest(".rollbox-panel"));
    if (!this.classList.contains("rollbox-panel")) return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
    const b = box(this);
    return { ...b, right: b.left + b.width, bottom: b.top + b.height };
  };
  s.select([token("Harvey")]); s.flush();
  const classes = () => ["menus-left", "grow-down", "movable"].filter((name) => s.panel().classList.contains(`rollbox-${name}`));
  const where = () => Object.fromEntries(["left", "right", "top", "bottom"]
    .filter((key) => s.panel().style[key]).map((key) => [key, s.panel().style[key]]));
  const docked = () => s.panel().nextElementSibling === document.getElementById("players");
  const pointer = (target, type, x, y) => target.dispatchEvent(new s.window.MouseEvent(type, { bubbles: true, button: 0,
    clientX: x, clientY: y }));
  /** Press a header (the card's) at (100, 650) and drag by (dx, dy), in steps, then let go. */
  const drag = (dx, dy, head = s.panel().querySelector(".rollbox-sheet-head")) => {
    pointer(head, "pointerdown", 100, 650);
    pointer(document, "pointermove", 100 + dx / 2, 650 + dy / 2);
    pointer(document, "pointermove", 100 + dx, 650 + dy);
    pointer(document, "pointerup", 100 + dx, 650 + dy);
  };
  return { ...s, saved, classes, where, docked, pointer, drag };
}

test("placement maths: clamp on screen, the quarter's corner, spot round trip, re-clamp in a smaller window, unreadable spots", () => {
  const area = { width: 1600, height: 900 };
  const box = (left, top) => ({ left, top, width: 200, height: 180 });
  assert.deepEqual(clampBox(box(-50, 850), area), box(0, 720));
  assert.deepEqual(clampBox(box(1500, -10), area), box(1400, 0));
  assert.deepEqual([box(100, 100), box(1300, 100), box(100, 700), box(1300, 700)].map((b) => nearestCorner(b, area)),
    ["top-left", "top-right", "bottom-left", "bottom-right"]);
  for (const b of [box(300, 250), box(1100, 250), box(300, 600), box(1100, 600)]) {
    assert.deepEqual(boxAt(spotOf(b, area), { width: 200, height: 180 }, area), b); // dropped where it was: no snapping
  }
  assert.deepEqual(spotOf(box(1300, 100), area), { corner: "top-right", x: 100, y: 100 });
  // Dropped 1000px from the left; the window then shrinks to 800 wide: shown at its right edge instead.
  assert.deepEqual(clampSpot({ corner: "bottom-left", x: 1000, y: 40 }, { width: 200, height: 180 }, { width: 800, height: 900 }),
    { corner: "bottom-left", x: 600, y: 40 });
  assert.deepEqual([null, {}, "x", { corner: "middle", x: 1, y: 1 }, { corner: "top-left", x: "1", y: 1 },
    { corner: "top-left", x: -5, y: 1 }, { corner: "top-left", x: NaN, y: 1 }].map(normalSpot), Array(7).fill(null));
});

test("moving off: docked above the players list; dragging the header does nothing", async () => {
  const s = await onScreen({ rollboxMovable: false });
  s.drag(800, -400);
  assert.ok(s.docked());
  assert.deepEqual([s.classes(), s.where(), s.saved], [[], {}, []]);
});

test("moving on (the default): dragging the header moves the panel, kept on screen; it stays where dropped and its spot is saved", async () => {
  const s = await onScreen();
  assert.ok(s.docked()); // nothing moves until it is dragged
  s.pointer(s.panel().querySelector(".rollbox-sheet-head"), "pointerdown", 100, 650);
  s.pointer(document, "pointermove", 800, 300);
  assert.equal(s.panel().parentElement.id, "interface");
  assert.deepEqual(s.where(), { left: "716px", top: "290px" });
  s.pointer(document, "pointermove", 2400, -100); // off the screen: kept on it
  assert.deepEqual(s.where(), { left: "1400px", top: "0px" });
  s.pointer(document, "pointerup", 2400, -100);
  assert.deepEqual(s.where(), { right: "0px", top: "0px" }); // the same place, measured from its quarter's corner
  assert.deepEqual(s.saved, [["rollboxOffset", { corner: "top-right", x: 0, y: 0 }]]);
});

test("a saved spot is used after a reload; turning moving off forgets it and docks the panel", async () => {
  const s = await onScreen({ rollboxMovable: true, rollboxOffset: { corner: "bottom-right", x: 300, y: 120 } });
  assert.deepEqual(s.where(), { right: "300px", bottom: "120px" });
  s.env.registered.rollboxMovable.onChange(false);
  assert.ok(s.docked());
  assert.deepEqual([s.where(), s.saved], [{}, [["rollboxOffset", {}]]]);
});

test("menus open to the: Automatic towards the middle; Right or Left as chosen; docked, always right; top half grows down", async () => {
  const at = async (corner, menuSide) => (await onScreen({ rollboxMovable: true, rollboxMenuSide: menuSide,
    rollboxOffset: { corner, x: 300, y: 100 } })).classes().filter((name) => name !== "movable");
  assert.deepEqual(await at("top-right", "auto"), ["menus-left", "grow-down"]);
  assert.deepEqual(await at("bottom-left", "auto"), []);
  assert.deepEqual(await at("bottom-right", "right"), []);
  assert.deepEqual(await at("top-left", "left"), ["menus-left", "grow-down"]);
  const s = await onScreen({ rollboxMovable: true, rollboxMenuSide: "left" });
  assert.deepEqual(s.classes(), ["movable"]); // docked at the screen's left edge
  s.env.registered.rollboxMenuSide.onChange("auto");
});

test("bug: a saved spot that is off the screen or can't be read is ignored, and the panel docked", async () => {
  for (const spot of [{ corner: "top-right", x: 5000, y: 10 }, { corner: "bottom-left", x: 10, y: 2000 },
    { x: -200, y: 30 }, "top-right"]) {
    const s = await onScreen({ rollboxMovable: true, rollboxOffset: spot });
    assert.ok(s.docked(), JSON.stringify(spot));
    assert.deepEqual(s.where(), {});
  }
});

test("bug: when the panel doesn't land where it is put (its layout failed), it stays docked instead of vanishing", async () => {
  const s = await onScreen({ rollboxMovable: true }, { layoutFails: true });
  s.drag(800, -400);
  assert.ok(s.docked());
  assert.deepEqual([s.where(), s.saved], [{}, []]);
  const reloaded = await onScreen({ rollboxMovable: true, rollboxOffset: { corner: "top-right", x: 300, y: 100 } },
    { layoutFails: true });
  assert.ok(reloaded.docked());
});

test("Reset position puts the panel back above the players list at once and forgets its spot; moving stays on", async () => {
  const s = await onScreen({ rollboxOffset: { corner: "bottom-right", x: 300, y: 120 } });
  resetPosition();
  assert.ok(s.docked());
  assert.deepEqual([s.where(), s.classes(), s.saved], [{}, ["movable"], [["rollboxOffset", {}]]]);
});

test("the Opposed view: either side's mini sheet header drags the panel", async () => {
  registerMenu("opposed", { layout: "replace",
    render: (stage, { actors }) => stage.append(...actors.map((actor) => miniSheet(actor))) });
  const s = await onScreen();
  s.select([token("Harvey"), token("Ettore")]); s.flush();
  s.click("Opposed");
  s.drag(800, -400, s.panel().querySelectorAll(".rollbox-stage .rollbox-sheet-head")[1]);
  assert.equal(s.panel().parentElement.id, "interface");
  assert.deepEqual(s.saved, [["rollboxOffset", { corner: "top-right", x: 584, y: 240 }]]);
});

test("an open menu that would run off the screen shifts the panel into view, and it goes back when the menu closes", async () => {
  const s = await onScreen({ rollboxMenuSide: "right", rollboxOffset: { corner: "top-right", x: 100, y: 20 } });
  assert.deepEqual(s.where(), { right: "100px", top: "20px" }); // the buttons alone: 1500 + 8 + 56 fits
  s.click("Check"); // card's right edge 1500, then 8 and 384 more: 292px off the screen
  assert.deepEqual(s.where(), { right: "392px", top: "20px" });
  s.click("Check");
  assert.deepEqual([s.where(), s.saved], [{ right: "100px", top: "20px" }, []]);
});

test("a press on the open-sheet button, or a click on the header without moving, doesn't move the panel", async () => {
  const s = await onScreen({ rollboxMovable: true });
  s.pointer(s.panel().querySelector(".rollbox-open-sheet"), "pointerdown", 190, 660);
  s.pointer(document, "pointermove", 900, 200);
  s.pointer(document, "pointerup", 900, 200);
  s.drag(2, 1);
  assert.ok(s.docked());
  assert.deepEqual([s.where(), s.saved], [{}, []]);
});

/**
 * Every menu replaced by one that records how it was opened: [id, start] on a fresh draw, [id, "apply", start] when
 * it was already open. Registered after setup(), which registers the real ones.
 */
function recordMenus() {
  const opened = [];
  for (const id of ["check", "sanity", "other"]) {
    registerMenu(id, { render: (body, { start }) => {
      opened.push([id, start]);
      return { apply: (next) => opened.push([id, "apply", next]) };
    } });
  }
  registerMenu("opposed", { layout: "replace", render: (stage, { actors, start }) => {
    opened.push(["opposed", actors.map((a) => a.name), start]);
  } });
  return opened;
}

/** A click or a right click on a value of the mini sheet, with modifier keys. */
function clickValue(s, label, { right = false, ...keys } = {}) {
  const node = s.panel().querySelector(`.rollbox-card-slot button[aria-label="${label}"]`);
  const event = new s.window.MouseEvent(right ? "contextmenu" : "click", { bubbles: true, cancelable: true, button: right ? 2 : 0, ...keys });
  node.dispatchEvent(event);
  return event;
}

test("mini sheet values: the characteristics, SAN and Luck are buttons named for what they open; HP, MP and the names card aren't", async () => {
  const s = await setup();
  s.select([token("Harvey")]); s.flush();
  const values = [...document.querySelectorAll(".rollbox-card-slot .rollbox-sheet button[data-value]")];
  const labels = values.map((b) => b.getAttribute("aria-label"));
  assert.deepEqual(labels, ["Sanity", "Luck", "Check STR", "Check CON", "Check SIZ", "Check DEX", "Check APP",
    "Check INT", "Check POW", "Check EDU"]);
  assert.equal(document.querySelector(".rollbox-stat-hp").tagName, "DIV");
  assert.equal(values.some((b) => b.title || b.dataset.tooltip), false); // no tooltips
  s.select([token("Harvey"), token("Cecil")]); s.flush();
  assert.equal(document.querySelectorAll(".rollbox-names button").length, 0);
});

test("a left click opens the value's menu, nothing sent: Check with only that characteristic ticked (again switches it), Sanity, Other on Luck", async () => {
  const s = await setup();
  s.select([token("Harvey")]); s.flush();
  const opened = recordMenus();
  clickValue(s, "Check STR");
  clickValue(s, "Check INT"); // Check is open: it takes the new tick
  clickValue(s, "Sanity");
  clickValue(s, "Luck");
  assert.deepEqual(opened, [["check", { tick: "characteristic:str" }], ["check", "apply", { tick: "characteristic:int" }],
    ["sanity", undefined], ["other", { section: "luck" }]]);
  assert.deepEqual(s.env.chat, []);
});

test("shortcuts, as on CoC7's sheet: Shift sends now, Ctrl copies a link, Shift+Ctrl readies Copy link, Alt+Right adds to the ticks", () => {
  const str = { kind: "characteristic", key: "str" };
  const tick = "characteristic:str";
  assert.deepEqual(shortcut(str, { shift: true }), { open: "check", start: { tick, plain: true, send: "whisper" } });
  assert.deepEqual(shortcut(str, { ctrl: true }), { open: "check", start: { tick, plain: true, send: "link" } });
  assert.deepEqual(shortcut(str, { shift: true, ctrl: true }), { open: "check", start: { tick, focus: "link" } });
  assert.deepEqual(shortcut(str, { right: true }), { opposed: { key: tick, create: false } });
  assert.deepEqual(shortcut(str, { right: true, shift: true }), { opposed: { key: tick, create: true } });
  assert.deepEqual(shortcut(str, { right: true, alt: true }), { open: "check", start: { tick, add: true } });
  assert.deepEqual(shortcut(str, { right: true, alt: true, shift: true }),
    { open: "check", start: { tick, add: true, send: "whisper" } });
  for (const how of [{}, { shift: true }, { ctrl: true }, { shift: true, ctrl: true }, { alt: true }]) {
    assert.deepEqual(shortcut({ kind: "san" }, how), { open: "sanity" });
  }
  assert.deepEqual(shortcut({ kind: "luck" }, { shift: true }),
    { open: "other", start: { section: "luck", plain: true, send: "whisper" } });
  assert.deepEqual(shortcut({ kind: "luck" }, { ctrl: true }),
    { open: "other", start: { section: "luck", plain: true, send: "link" } });
  assert.deepEqual([shortcut({ kind: "san" }, { right: true }), shortcut({ kind: "luck" }, { right: true })], [null, null]);
});

test("right click: no browser menu; the opposed two-step selects both and opens Opposed with both picks; Escape cancels", async () => {
  const s = await setup();
  const harvey = token("Harvey"); const cecil = token("Cecil");
  for (const t of [harvey, cecil]) {
    t.control = () => { canvas.tokens.controlled = [...canvas.tokens.controlled, t]; Hooks.call("controlToken", t, true); };
  }
  s.select([harvey]); s.flush();
  const opened = recordMenus();
  const note = () => document.querySelector(".rollbox-pending");
  assert.equal(clickValue(s, "Check STR", { right: true }).defaultPrevented, true);
  assert.equal(note().hidden, false);
  assert.match(note().textContent, /^Opposed: Harvey · STR\./);
  s.window.document.dispatchEvent(new s.window.KeyboardEvent("keydown", { key: "Escape" }));
  assert.equal(note().hidden, true);
  clickValue(s, "Check STR", { right: true });
  s.select([cecil]); s.flush();
  clickValue(s, "Check POW", { right: true, shiftKey: true }); s.flush();
  assert.deepEqual(opened, [["opposed", ["Cecil", "Harvey"], { first: "Actor.Harvey",
    picks: { "Actor.Harvey": "characteristic:str", "Actor.Cecil": "characteristic:pow" }, create: true }]]);
  assert.equal(note().hidden, true);
});
