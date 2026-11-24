import assert from "node:assert/strict";
import { test } from "node:test";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  clearPanelContent, onEscape, registerPanel, registerFlyout, resetPosition, setPanelContent
} from "../scripts/panel/index.js";
import { toHsl } from "../scripts/panel/theme.js";
import { boxAt, clampBox, clampSpot, followSidebar, nearestCorner, normalSpot, spotOf } from "../scripts/panel/placement.js";
import { shortcut } from "../scripts/panel/sheet-clicks.js";
import { opposedStart } from "../scripts/flyouts/opposed/index.js";
import { addStyles, makeActor, makeDom, makeEnv, load } from "./mocks.mjs";

const SCRIPTS = fileURLToPath(new URL("../scripts/", import.meta.url));

/** The hooks main.js always installs; the panel adds its own only on the Keeper's client. */
const WIRING_HOOKS = ["init", "renderSettingsConfig", "ready"];
const PANEL_HOOKS = ["controlToken", "deleteToken", "createToken", "canvasReady", "canvasTearDown", "renderPlayers",
  "updateActor", "updateToken", "deleteActor", "createActiveEffect", "updateActiveEffect", "deleteActiveEffect",
  "updateUser"];
/** What the Action flyout and combat add on the Keeper's client with the switch on (each part tests its own). */
const PART_HOOKS = ["targetToken", "deleteCombat", "updateCombat", "createCombat", "createCombatant", "updateCombatant",
  "combatTurnChange", "deleteCombatant", "renderChatMessageHTML", "keepers-rollbox.diveDecision", "createActiveEffect",
  "deleteActiveEffect", "updateItem", "renderApplicationV2", "closeApplicationV2", "updateScene"];
/**
 * Combat's gameplay rules (a fight's turn rule and the defeated marks among them): on the Keeper's client whatever the panel's switch (they
 * follow the Gameplay switch); and
 * with the Player Rollbox on (its default) the being-attacked alert's Keeper side watches CoC7's cards.
 */
const GAMEPLAY_HOOKS = ["updateCombat", "deleteCombat", "updateActor", "renderChatMessageHTML", "createActiveEffect",
  "deleteActiveEffect", "updateActiveEffect", "updateToken", "createCombatant", "updateCombatant", "targetToken",
  "controlToken", "deleteToken"];
const ALERT_HOOKS = ["createChatMessage", "updateChatMessage", "deleteChatMessage"];
/** The setup check on the Keeper's client, panel or not: weapons and actors added are checked. */
const SETUP_HOOKS = ["createItem", "createActor"];

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
  const buttons = () => [...document.querySelectorAll(".rollbox-menu-button")].map((b) => b.textContent);
  const click = (label) => [...document.querySelectorAll(".rollbox-menu-button")]
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
  assert.deepEqual(Object.keys(env.hooks).sort(),
    [...new Set([...WIRING_HOOKS, ...PANEL_HOOKS, ...PART_HOOKS, ...ALERT_HOOKS, ...SETUP_HOOKS])].sort());
  assert.ok(env.reads.includes("rollboxEnabled"));
});

test("main.js: a part that throws at ready is reported, and the parts after it still start", async () => {
  const env = makeEnv();
  makeDom(`<div id="ui-left-column-1"><aside id="players"></aside></div>`);
  globalThis.canvas = { tokens: { controlled: [] } };
  globalThis.requestAnimationFrame = () => 1;
  game.socket = { emit() {}, on() { throw new Error("socket down"); } };
  const warnings = [];
  const original = console.warn;
  console.warn = (text) => warnings.push(text);
  try {
    await load(env);
  } finally {
    console.warn = original;
  }
  assert.ok(warnings.some((text) => /the Keeper relay couldn't start/.test(text)));
  assert.ok(env.hooks.controlToken?.length, "the panel still started");
  delete game.socket;
});

test("player, player Rollbox off: does nothing, installs no hooks or listeners, reads only that switch, draws nothing", async () => {
  const s = await setup({ isGM: false, values: { rollboxPlayerRollbox: false } });
  const listeners = [];
  globalThis.addEventListener = (type) => listeners.push(type);
  assert.equal(registerPanel(), false);
  delete globalThis.addEventListener;
  assert.deepEqual(listeners, []); // no resize listener; with no panel there is nothing to drag
  assert.deepEqual(Object.keys(s.env.hooks).sort(), [...WIRING_HOOKS].sort());
  assert.deepEqual([...new Set(s.env.reads)], ["rollboxPlayerRollbox"]);
  s.select([token("Harvey")]); s.flush();
  assert.equal(s.panel(), null);
  let saved = 0;
  game.settings.set = () => { saved += 1; };
  s.env.registered.rollboxTheme.onChange("light"); // a player's own theme change flips nothing
  assert.equal(saved, 0);
});

test("Keeper with the switch off: no panel hooks (only combat's gameplay rules), draws nothing", async () => {
  const s = await setup({ values: { rollboxEnabled: false } });
  assert.equal(registerPanel(), false);
  assert.deepEqual(Object.keys(s.env.hooks).sort(),
    [...WIRING_HOOKS, ...GAMEPLAY_HOOKS, ...ALERT_HOOKS, ...SETUP_HOOKS].sort());
  s.select([token("Harvey")]); s.flush();
  assert.equal(s.panel(), null);
});

test("no user yet: does nothing instead of throwing", async () => {
  const env = makeEnv(); await load(env);
  game.user = undefined;
  assert.equal(registerPanel(), false);
});

test("1 token: character sheet just before the players list, with Action, Check, Other", async () => {
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
  assert.deepEqual(s.buttons(), ["Action", "Check", "Other"]);
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
  s.select([steward, token("Harvey"), token("Ann")]); s.flush();
  assert.equal(document.querySelector(".rollbox-cards .rollbox-name").title, "Ettore Bonaventura");
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

/** Foundry's interface element (`#interface`) around the left column, with its Dark or Light class. */
const withInterface = (scheme = "dark") => `<div id="interface" class="themed theme-${scheme}"><div id="ui-left-column-1">`
  + `<menu id="scene-controls"></menu><aside id="players"></aside></div></div>`;

/** The theme classes on the panel root. */
const themeClasses = (panel) => [...panel.classList].filter((name) => name.startsWith("rollbox-theme-")).sort();

test("theme: its class on the panel root; older values (dark, light) and unknown values read as Foundry", async () => {
  const s = await setup({ values: { rollboxTheme: "light" } });
  game.system = { id: "CoC7" };
  s.select([token("Harvey")]); s.flush();
  assert.deepEqual(themeClasses(s.panel()), ["rollbox-theme-foundry"]);
  s.env.registered.rollboxTheme.onChange("coc7Minimal");
  assert.deepEqual(themeClasses(s.panel()), ["rollbox-theme-coc7-minimal"]);
  s.env.registered.rollboxTheme.onChange("dark");
  assert.deepEqual(themeClasses(s.panel()), ["rollbox-theme-foundry"]);
  s.env.registered.rollboxTheme.onChange("sepia");
  assert.deepEqual(themeClasses(s.panel()), ["rollbox-theme-foundry"]);
});

test("Foundry theme follows Foundry's interface: Light palette and the colour lightened, live; the colour isn't saved",
  async () => {
  const s = await setup({ values: { rollboxColor: "#0b0a13" }, html: withInterface("light") });
  addStyles("panel/panel.css");
  let saved = 0;
  game.settings.set = () => { saved += 1; };
  s.select([token("Harvey")]); s.flush();
  const text = () => document.defaultView.getComputedStyle(s.panel()).getPropertyValue("--rollbox-text").trim();
  const shown = () => toHsl(s.panel().style.getPropertyValue("--rollbox-color"));
  assert.deepEqual(themeClasses(s.panel()), ["rollbox-theme-foundry", "rollbox-theme-light"]);
  assert.equal(text(), "#221e29"); // the Light palette's dark text
  assert.ok(shown()[2] > 80 && Math.abs(shown()[0] - toHsl("#0b0a13")[0]) < 2); // light, with the colour's hue
  document.getElementById("interface").classList.replace("theme-light", "theme-dark");
  await new Promise((resolve) => setTimeout(resolve, 0)); // the class watcher runs after the change
  assert.deepEqual(themeClasses(s.panel()), ["rollbox-theme-foundry"]);
  assert.equal(text(), "var(--color-light-2, #efe6d8)"); // the Dark palette's light text
  assert.equal(s.panel().style.getPropertyValue("--rollbox-color"), "#0b0a13");
  assert.equal(saved, 0);
});

test("CoC7 themes fall back to Foundry: CoC7 isn't the system, or Art Deco's images are missing (one warning)",
  async () => {
  const s = await setup({ values: { rollboxTheme: "artDeco" } });
  const warnings = [];
  console.warn = (...args) => warnings.push(args.join(" "));
  game.system = { id: "dnd5e" };
  s.select([token("Harvey")]); s.flush();
  assert.deepEqual(themeClasses(s.panel()), ["rollbox-theme-foundry"]);
  game.system = { id: "CoC7" };
  const asked = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    asked.push([url, options?.method]);
    return { ok: !url.endsWith("ribbon-blue.webp") };
  };
  try {
    s.env.registered.rollboxTheme.onChange("artDeco");
    assert.deepEqual(themeClasses(s.panel()), ["rollbox-theme-art-deco"]);
    assert.equal(s.panel().style.getPropertyValue("--rollbox-coc7-page"), 'url("/systems/CoC7/assets/art/page-dark.webp")');
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.ok(asked.length > 0 && asked.every(([url, method]) => url.startsWith("/systems/CoC7/") && method === "HEAD"));
    assert.deepEqual(themeClasses(s.panel()), ["rollbox-theme-foundry"]);
    assert.equal(warnings.filter((w) => w.includes("Art Deco")).length, 1);
    s.env.registered.rollboxTheme.onChange("coc7Minimal"); // needs no images: still shown
    assert.deepEqual(themeClasses(s.panel()), ["rollbox-theme-coc7-minimal"]);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("CoC7 themes: the sheet shows each characteristic's half and fifth, each stat's maximum, MOV, Build and DB",
  async () => {
  const s = await setup();
  const harvey = token("Harvey");
  Object.assign(harvey.actor.system.attribs, { mov: { value: 8 }, build: { value: 1 }, db: { value: "+1D4" } });
  s.select([harvey]); s.flush();
  const str = document.querySelector(".rollbox-characteristic[data-key=str]");
  assert.equal(str.querySelector(".rollbox-characteristic-value").textContent, "50");
  assert.equal(str.querySelector(".rollbox-characteristic-levels").textContent, "2510");
  assert.deepEqual(text(".rollbox-stat-band"), ["12", "11", "99", "99"]);
  assert.deepEqual(text(".rollbox-sheet .rollbox-derived-item"), ["MOV8", "Build1", "DB+1D4"]);
});

test("panel size: scales the whole panel from its bottom-left corner; 100% leaves it untransformed", async () => {
  const s = await setup({ values: { rollboxScale: 120 } });
  s.select([token("Harvey")]); s.flush();
  assert.equal(s.panel().style.transform, "scale(1.2)");
  assert.equal(s.panel().style.transformOrigin, "left bottom");
  s.env.registered.rollboxScale.onChange(100);
  assert.equal(s.panel().style.transform, "");
});

test("2 tokens: one two-character sheet, the player character on top and tan below; Opposed above Action, Check, Other",
  async () => {
  const s = await setup();
  const cultist = token("Cultist", { occupation: "Priest", san: 30, luck: 50 });
  cultist.actor.system.characteristics.str.value = 75;
  s.select([cultist, token("Harvey", { owners: ["Player 1"], san: 62, luck: 55 })]); s.flush();
  assert.equal(document.querySelector(".rollbox-cards"), null);
  assert.equal(document.querySelectorAll(".rollbox-sheet").length, 1);
  assert.deepEqual(text(".rollbox-sheet .rollbox-name"), ["Harvey", "Cultist"]);
  assert.deepEqual(text(".rollbox-sheet .rollbox-sub"), ["Player 1", "Priest · NPC"]);
  // HP, MP, SAN, Luck for both characters, in the same order.
  assert.deepEqual(text(".rollbox-stat-label"), ["HP", "MP", "SAN", "Luck", "HP", "MP", "SAN", "Luck"]);
  assert.deepEqual(text('[data-key="str"] .rollbox-characteristic-value'), ["50", "75"]);
  // Tan: the bottom character's header, stats and eight values; nothing of the top character's.
  assert.deepEqual(text(".rollbox-second .rollbox-name"), ["Cultist"]);
  assert.deepEqual(text(".rollbox-second .rollbox-stat-value"), ["9/12", "11/11", "30", "50"]);
  assert.deepEqual(text(".rollbox-characteristic-value.rollbox-second"), ["75", "60", "65", "70", "45", "80", "55", "85"]);
  assert.deepEqual(s.buttons(), ["Opposed", "Action", "Check", "Other"]);
  s.select([token("Zelda", { owners: ["P2"] }), token("Ada", { owners: ["P1"] })]); s.flush(); // two of a kind: A–Z
  assert.deepEqual(text(".rollbox-sheet .rollbox-name"), ["Ada", "Zelda"]);
});

test("3 or more tokens: character cards, one row each with no upper limit; Opposed (several against one), Check and Other, no Action", async () => {
  const s = await setup();
  s.select(["A", "B", "C", "D", "E", "F"].map((n) => token(n))); s.flush();
  assert.equal(document.querySelectorAll(".rollbox-character-card").length, 6);
  assert.deepEqual(s.buttons(), ["Opposed", "Check", "Other"]);
});

test("character cards: the × on a card deselects that token, and the panel redraws without it", async () => {
  const s = await setup();
  const tokens = ["Ann", "Bob", "Cy"].map((n) => token(n));
  for (const t of tokens) {
    t.release = () => { canvas.tokens.controlled = canvas.tokens.controlled.filter((o) => o !== t); Hooks.call("controlToken", t, false); };
  }
  s.select(tokens); s.flush();
  const cross = document.querySelector('.rollbox-deselect[aria-label="Deselect Bob"]');
  assert.equal(cross.querySelector("img").getAttribute("src"), "Bob.webp"); // the portrait is the button
  cross.click(); s.flush();
  assert.deepEqual(text(".rollbox-sheet .rollbox-name"), ["Ann", "Cy"]); // two left: the two-character sheet
});

test("character cards: a click on a card selects only that character; its × still deselects only that one", async () => {
  const s = await setup();
  const tokens = ["Ann", "Bob", "Cy"].map((n) => token(n));
  const calls = [];
  for (const t of tokens) {
    t.control = ({ releaseOthers }) => { calls.push([t.actor.name, releaseOthers]); canvas.tokens.controlled = [t]; Hooks.call("controlToken", t, true); };
    t.release = () => { canvas.tokens.controlled = canvas.tokens.controlled.filter((o) => o !== t); Hooks.call("controlToken", t, false); };
  }
  s.select(tokens); s.flush();
  document.querySelector('.rollbox-deselect[aria-label="Deselect Ann"]').click(); s.flush();
  assert.deepEqual(calls, []); // the × didn't also pick Ann
  s.select(tokens); s.flush();
  document.querySelectorAll(".rollbox-character-card")[1].click(); s.flush();
  assert.deepEqual(calls, [["Bob", true]]);
  assert.deepEqual(text(".rollbox-sheet .rollbox-name"), ["Bob"]);
});

test("a right click on a character targets their token: a character card, the sheet; a value's right click stays its own", async () => {
  const s = await setup();
  const tokens = ["Ann", "Bob", "Cy"].map((n) => token(n));
  const targeted = [];
  for (const t of tokens) t.setTarget = (on, { releaseOthers }) => targeted.push([t.actor.name, on, releaseOthers]);
  const rightClick = (node) => {
    const event = new s.window.MouseEvent("contextmenu", { bubbles: true, cancelable: true, button: 2 });
    node.dispatchEvent(event);
    return event.defaultPrevented;
  };
  s.select(tokens); s.flush();
  assert.equal(rightClick(document.querySelectorAll(".rollbox-character-card .rollbox-name")[2]), true);
  s.select([tokens[0]]); s.flush();
  rightClick(document.querySelector(".rollbox-sheet .rollbox-sub"));
  rightClick(document.querySelector('.rollbox-sheet button[aria-label="Luck"]'));
  assert.deepEqual(targeted, [["Cy", true, true], ["Ann", true, true]]);
});

test("one selected: the Keeper's sheet portrait is a deselect button; the panel then shows the nothing-selected view", async () => {
  const s = await setup();
  const ann = token("Ann");
  ann.release = () => { canvas.tokens.controlled = []; Hooks.call("controlToken", ann, false); };
  s.select([ann]); s.flush();
  document.querySelector('.rollbox-sheet .rollbox-deselect[aria-label="Deselect Ann"]').click(); s.flush();
  assert.equal(s.visible(), false); // nothing selected and no investigators to list: the panel hides
});

test("Escape closes an open flyout while the setting is on; off, or with no flyout open, Escape is left to Foundry", async () => {
  const s = await setup();
  s.select([token("Harvey")]); s.flush();
  const escape = () => new s.window.KeyboardEvent("keydown", { key: "Escape", cancelable: true });
  assert.equal(onEscape(escape()), false); // nothing open
  s.click("Check");
  s.env.values.rollboxEscapeClosesFlyout = false;
  assert.equal(onEscape(escape()), false);
  assert.equal(s.flyout().hidden, false);
  s.env.values.rollboxEscapeClosesFlyout = true;
  const event = escape();
  assert.equal(onEscape(event), true);
  assert.equal(event.defaultPrevented, true);
  assert.equal(s.flyout().hidden, true);
});

test("two-character sheet: each portrait is a deselect button too", async () => {
  const s = await setup();
  const tokens = ["Ann", "Bob"].map((n) => token(n));
  for (const t of tokens) {
    t.release = () => { canvas.tokens.controlled = canvas.tokens.controlled.filter((o) => o !== t); Hooks.call("controlToken", t, false); };
  }
  s.select(tokens); s.flush();
  document.querySelector('.rollbox-sheet-pair .rollbox-deselect[aria-label="Deselect Bob"]').click(); s.flush();
  assert.deepEqual(text(".rollbox-sheet .rollbox-name"), ["Ann"]);
});

test("setPanelContent: another part's content replaces the character panel's; clearPanelContent puts the sheet back",
  async () => {
    const s = await setup();
    s.select([token("Harvey")]); s.flush();
    let given = null;
    assert.equal(setPanelContent((actors) => {
      given = actors.map((a) => a.name);
      const node = document.createElement("div"); node.className = "test-turn-order"; return node;
    }), true);
    const slot = document.querySelector(".rollbox-character-panel");
    assert.deepEqual([...slot.children].map((n) => n.className), ["test-turn-order"]);
    assert.deepEqual(given, ["Harvey"]);
    assert.deepEqual(s.buttons(), ["Action", "Check", "Other"]); // the menu is the panel's own
    clearPanelContent();
    assert.equal(slot.querySelector(".test-turn-order"), null);
    assert.deepEqual(text(".rollbox-sheet .rollbox-name"), ["Harvey"]);
  });

test("setPanelContent with idleActors: shown with nothing selected, the menu acting for them; its sheet's values open flyouts",
  async () => {
    const s = await setup();
    const harvey = token("Harvey");
    const opened = [];
    registerFlyout("check", { render: (body, { actors }) => { opened.push(actors.map((a) => a.name)); } });
    setPanelContent((actors, { onValue }) => {
      const node = document.createElement("div");
      node.className = "test-turn-order";
      const value = document.createElement("button");
      value.className = "test-value";
      value.addEventListener("click", (event) => onValue(event, { kind: "characteristic", key: "str" }, false,
        harvey.actor));
      node.append(value);
      return node;
    }, { idleActors: () => [harvey.actor] });
    s.flush();
    assert.equal(s.visible(), true);
    assert.ok(document.querySelector(".rollbox-character-panel .test-turn-order"));
    assert.deepEqual(s.buttons(), ["Action", "Check", "Other"]);
    document.querySelector(".test-value").click();
    assert.deepEqual(opened, [["Harvey"]]);
    clearPanelContent();
    s.flush();
    assert.equal(s.visible(), false);
  });

test("request buttons: one constant height from the CSS; no script sets it, whatever is selected", async () => {
  const s = await setup();
  addStyles("panel/panel.css");
  for (const count of [1, 2, 3, 8]) {
    s.select(["A", "B", "C", "D", "E", "F", "G", "H"].slice(0, count).map((n) => token(n))); s.flush();
    assert.equal(s.panel().style.getPropertyValue("--rollbox-button-height"), "");
  }
  const style = (selector) => document.defaultView.getComputedStyle(document.querySelector(selector));
  // Three buttons and two gaps fill the character sheet's height: worked out from the gap the button column uses.
  assert.match(style(".rollbox-panel").getPropertyValue("--rollbox-button-height").trim(),
    /^calc\(.*var\(--rollbox-sheet-height\).*var\(--rollbox-button-gap\).*\)$/);
  assert.equal(style(".rollbox-menu").gap, "var(--rollbox-button-gap)");
  assert.deepEqual([style(".rollbox-menu-button").height, style(".rollbox-menu-button").flexGrow], ["var(--rollbox-button-height)", "0"]);
  const scripts = readdirSync(SCRIPTS, { recursive: true }).filter((file) => file.endsWith(".js"));
  assert.ok(scripts.every((file) => !readFileSync(new URL(file.replaceAll("\\", "/"), pathToFileURL(SCRIPTS)), "utf8")
    .includes("--rollbox-button-height")));
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
  assert.equal(document.querySelectorAll(".rollbox-character-card").length, 4);
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
  s.click("Action");
  assert.equal(s.flyout().hidden, false);
  assert.deepEqual(text(".rollbox-flyout-title"), ["Action"]);
  assert.deepEqual(text('.rollbox-menu-button[aria-pressed="true"]'), ["Action"]);
  s.click("Check");
  assert.deepEqual(text(".rollbox-flyout-title"), ["Request a check"]);
  s.click("Check");
  assert.equal(s.flyout().hidden, true);
  assert.equal(document.querySelectorAll('.rollbox-menu-button[aria-pressed="true"]').length, 0);
});

test("menu host: a registered flyout draws for the selection, again when it changes; closes when nothing is selected",
  async () => {
  const s = await setup();
  const calls = [];
  assert.equal(registerFlyout("other", { title: "Other", render: (body, { actors }) => {
    calls.push(actors.map((a) => a.name)); body.textContent = "weapons";
  } }), true);
  const harvey = token("Harvey");
  s.select([harvey]); s.flush();
  s.click("Other");
  assert.deepEqual(calls, [["Harvey"]]);
  assert.equal(document.querySelector(".rollbox-flyout-body").textContent, "weapons");
  Hooks.call("updateActor", harvey.actor); s.flush(); // same selection: the flyout isn't drawn again
  assert.equal(calls.length, 1);
  s.select([harvey, token("Cultist")]); s.flush(); // two selected: Other is still offered, drawn for both
  assert.deepEqual(calls, [["Harvey"], ["Harvey", "Cultist"]]);
  s.click("Check");
  s.select([]); s.flush();
  assert.equal(s.visible(), false);
  assert.equal(s.flyout().hidden, true);
});

test("registerFlyout: an unknown button, or one without render, is refused", async () => {
  await setup();
  assert.equal(registerFlyout("combat", { render: () => {} }), false);
  assert.equal(registerFlyout("check", {}), false);
});

test("Opposed is a flyout: the menu stays, the flyout opens beside it, the two-character sheet stays; it stays open with three",
  async () => {
  const s = await setup();
  s.select([token("Harvey"), token("Cultist")]); s.flush();
  s.click("Opposed");
  assert.equal(s.flyout().hidden, false);
  assert.equal(s.flyout().dataset.menu, "opposed");
  assert.ok(s.flyout().querySelector(".rollbox-opposed-card"));
  assert.equal(document.querySelector(".rollbox-menu").hidden, false);
  assert.deepEqual(s.buttons(), ["Opposed", "Action", "Check", "Other"]);
  assert.deepEqual(text('.rollbox-menu-button[aria-pressed="true"]'), ["Opposed"]);
  assert.deepEqual(text(".rollbox-character-panel .rollbox-sheet .rollbox-name"), ["Cultist", "Harvey"]);
  s.select([token("A"), token("B"), token("C")]); s.flush(); // three: no Opposed button, but it stays open
  assert.equal(s.flyout().dataset.menu, "opposed");
  assert.equal(s.flyout().hidden, false);
  s.select([]); s.flush();
  assert.equal(s.flyout().hidden, true);
});

test("menu host: a staysOpen menu stays open with one token, and is told when the selection changed", async () => {
  const s = await setup();
  const calls = [];
  registerFlyout("opposed", { staysOpen: true, render: (body, { actors, selectionChanged }) => {
    calls.push([actors.length, selectionChanged]);
  } });
  const harvey = token("Harvey");
  s.select([harvey, token("Cecil")]); s.flush();
  s.click("Opposed");
  s.select([harvey]); s.flush(); // one: no Opposed button, but it stays open
  assert.deepEqual(s.buttons(), ["Action", "Check", "Other"]);
  assert.equal(s.flyout().hidden, false);
  assert.deepEqual(calls, [[2, false], [1, true]]);
  s.select([]); s.flush();
  assert.equal(s.flyout().hidden, true);
});

test("menu host: a flyout is given the host's open, so it can open another flyout with a starting state", async () => {
  const s = await setup();
  const opened = [];
  registerFlyout("check", { render: (body, { open }) => { body.append(Object.assign(document.createElement("button"),
    { className: "test-open", onclick: () => open("opposed", { picks: {} }) })); } });
  registerFlyout("opposed", { staysOpen: true, render: (body, { start }) => { opened.push(start); } });
  s.select([token("Harvey")]); s.flush();
  s.click("Check");
  document.querySelector(".test-open").click();
  assert.equal(s.flyout().dataset.menu, "opposed"); // with one selected: Opposed has no button but stays open
  assert.deepEqual(opened, [{ picks: {} }]);
});

test("character cards: its value columns follow the open flyout (HP, MP, SAN and Luck bars; STR or SIZ with Other on Assist)",
  async () => {
  const s = await setup();
  const zombie = token("Zombie", { san: 0, luck: 0 });
  zombie.actor.type = "creature"; // CoC7's creature: Assist starts it marked as a target
  zombie.actor.system.characteristics.str.value = 80;
  s.select([token("Harvey", { san: 62, luck: 55 }), token("Ann"), zombie]); s.flush();
  const columns = () => text(".rollbox-cards-col");
  const values = () => text(".rollbox-cards-value");
  const bars = [["HP", "MP", "SAN", "Luck"], ["9", "11", "62", "55", "9", "11", "50", "40", "9", "11", "0", "0"]];
  s.click("Check"); // Check, on any tab, keeps the default columns
  assert.deepEqual([columns(), values()], bars);
  assert.equal(document.querySelectorAll(".rollbox-vbar").length, 12);
  s.click("Other");
  document.querySelector('.rollbox-other-tab[data-section="assist"]').click(); // Harvey and Ann take part with their STR; the Zombie is a target, with its STR
  assert.deepEqual([columns(), values()], [["STR"], ["50", "50", "80"]]);
  document.querySelector('[aria-label="Against"] [data-value="siz"]').click(); // the target's SIZ counts now
  assert.deepEqual([columns(), values()], [["STR/SIZ"], ["50", "50", "65"]]);
  s.click("Other"); // closed: the bars again
  assert.deepEqual([columns(), values()], bars);
});

test("rollboxCardMeters: only the ticked meters show on the character cards, redrawn when it changes", async () => {
  const s = await setup({ values: { rollboxCardMeters: ["hp", "luck"] } });
  s.select([token("Harvey"), token("Ann"), token("Zombie")]); s.flush();
  assert.deepEqual(text(".rollbox-cards-col"), ["HP", "Luck"]);
  await game.settings.set("keepers-rollbox", "rollboxCardMeters", ["mp"]); s.flush();
  assert.deepEqual(text(".rollbox-cards-col"), ["MP"]);
});

test("updateActor: a shown character's new values are drawn", async () => {
  const s = await setup();
  const harvey = token("Harvey", { san: 62 });
  s.select([harvey]); s.flush();
  harvey.actor.system.attribs.san.value = 55;
  Hooks.call("updateActor", harvey.actor); s.flush();
  assert.equal(text(".rollbox-stat-san .rollbox-stat-value")[0], "55");
});

test("a shown character also redraws for its token's update and for an effect on one of its items", async () => {
  const s = await setup();
  const harvey = token("Harvey", { san: 62 });
  s.select([harvey]); s.flush();
  harvey.actor.system.attribs.san.value = 55;
  Hooks.call("updateToken", { actor: harvey.actor }); s.flush();
  assert.equal(text(".rollbox-stat-san .rollbox-stat-value")[0], "55");
  harvey.actor.system.attribs.san.value = 50;
  Hooks.call("createActiveEffect", { parent: { documentName: "Item", parent: harvey.actor } }); s.flush();
  assert.equal(text(".rollbox-stat-san .rollbox-stat-value")[0], "50");
});

test("L1: a token update that only moves it (x, y) draws nothing again", async () => {
  const s = await setup();
  const harvey = token("Harvey", { san: 62 });
  s.select([harvey]); s.flush();
  harvey.actor.system.attribs.san.value = 55;
  Hooks.call("updateToken", { actor: harvey.actor }, { _id: "t1", x: 300, y: 200 }); s.flush();
  assert.equal(text(".rollbox-stat-san .rollbox-stat-value")[0], "62");
});

/** Foundry's screen (build 368): #interface, 1600 by 900, holding the left column with the players list. */
const SCREEN = { left: 0, top: 0, right: 1600, bottom: 900, width: 1600, height: 900 };
const INTERFACE = `<div id="interface"><section id="ui-left"><div id="ui-left-column-1"><menu id="scene-controls"></menu>
  <aside id="players"></aside></div></section></div>`;
/** Foundry's players list on SCREEN: 10px above the screen's bottom, 200px wide at the left edge's 16px. */
const PLAYERS = { left: 16, top: 830, right: 216, bottom: 890, width: 200, height: 60 };
/** The character sheet beside the players list: its bottom 10px up, as the list's, and 10px to its right. */
const DOCKED = { left: 226, top: 708, width: 200, height: 182 };
/** The beside place as the panel's inline style says it. */
const BESIDE = { left: "226px", bottom: "10px" };

/**
 * The panel on Foundry's screen, with the layout jsdom doesn't do: #interface is SCREEN and the players list PLAYERS;
 * the 200 by 182 panel is where its inline position puts it in #interface (unless `layoutFails`: then it stays drawn
 * at DOCKED, as when the browser didn't apply its position). Settings are saved as Foundry does for a client
 * setting: at once, calling its onChange; each save is recorded in `saved`.
 */
async function onScreen(values = {}, { layoutFails = false } = {}) {
  const s = await setup({ values, html: INTERFACE });
  document.getElementById("interface").getBoundingClientRect = () => SCREEN;
  document.getElementById("players").getBoundingClientRect = () => PLAYERS;
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
  /** The buttons (56px) and, while a flyout is open, its 320px flyout, 8px beside the card on its flyouts' side. */
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
  const docked = () => s.panel().parentElement?.id === "interface" && s.panel().style.left === BESIDE.left
    && s.panel().style.bottom === BESIDE.bottom && !s.panel().style.top && !s.panel().style.right;
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

test("moving off: beside the players list; dragging the header does nothing", async () => {
  const s = await onScreen({ rollboxMovable: false });
  s.drag(800, -400);
  assert.ok(s.docked());
  assert.deepEqual([s.classes(), s.where(), s.saved], [[], BESIDE, []]);
});

test("moving on (the default): dragging the header moves the panel, kept on screen; it stays where dropped and its spot is saved", async () => {
  const s = await onScreen();
  assert.ok(s.docked()); // nothing moves until it is dragged
  s.pointer(s.panel().querySelector(".rollbox-sheet-head"), "pointerdown", 100, 650);
  s.pointer(document, "pointermove", 800, 300);
  assert.equal(s.panel().parentElement.id, "interface");
  assert.deepEqual(s.where(), { left: "926px", top: "358px" });
  s.pointer(document, "pointermove", 2400, -100); // off the screen: kept on it
  assert.deepEqual(s.where(), { left: "1400px", top: "0px" });
  s.pointer(document, "pointerup", 2400, -100);
  assert.deepEqual(s.where(), { right: "0px", top: "0px" }); // the same place, measured from its quarter's corner
  assert.deepEqual(s.saved, [["rollboxOffset", { corner: "top-right", x: 0, y: 0 }]]);
});

test("dragging: the menu and flyouts switch side as the panel crosses the screen's middle, before it is dropped", async () => {
  const s = await onScreen();
  s.pointer(s.panel().querySelector(".rollbox-sheet-head"), "pointerdown", 100, 650);
  s.pointer(document, "pointermove", 1300, 650);
  assert.ok(s.classes().includes("menus-left"));
  s.pointer(document, "pointermove", 300, 650);
  assert.ok(!s.classes().includes("menus-left"));
  s.pointer(document, "pointerup", 300, 650);
});

test("followSidebar: a right-side spot keeps its distance from the sidebar as it expands and collapses", () => {
  const spot = { corner: "top-right", x: 20, y: 40, reach: 40 };
  assert.deepEqual(followSidebar(spot, 340), { ...spot, x: 320 });
  assert.deepEqual(followSidebar(spot, 40), spot);
  assert.deepEqual(followSidebar({ corner: "top-left", x: 20, y: 40, reach: 40 }, 340).x, 20);
  assert.deepEqual(normalSpot({ corner: "top-right", x: 1, y: 2, reach: 30 }), { corner: "top-right", x: 1, y: 2, reach: 30 });
});

test("a saved spot is used after a reload; turning moving off forgets it and docks the panel", async () => {
  const s = await onScreen({ rollboxMovable: true, rollboxOffset: { corner: "bottom-right", x: 300, y: 120 } });
  assert.deepEqual(s.where(), { right: "300px", bottom: "120px" });
  s.env.registered.rollboxMovable.onChange(false);
  assert.ok(s.docked());
  assert.deepEqual([s.where(), s.saved], [BESIDE, [["rollboxOffset", {}]]]);
});

test("menu and flyouts open to the: Automatic towards the middle; Right or Left as chosen; docked, always right; top half grows down", async () => {
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
    assert.deepEqual(s.where(), BESIDE);
  }
});

test("bug: when the panel doesn't land where it is put (its layout failed), it stays docked instead of vanishing", async () => {
  const s = await onScreen({ rollboxMovable: true }, { layoutFails: true });
  s.drag(800, -400);
  assert.ok(s.docked());
  assert.deepEqual([s.where(), s.saved], [BESIDE, []]);
  const reloaded = await onScreen({ rollboxMovable: true, rollboxOffset: { corner: "top-right", x: 300, y: 100 } },
    { layoutFails: true });
  assert.ok(reloaded.docked());
});

test("Reset position puts the panel back beside the players list at once and forgets its spot; moving stays on", async () => {
  const s = await onScreen({ rollboxOffset: { corner: "bottom-right", x: 300, y: 120 } });
  resetPosition();
  assert.ok(s.docked());
  assert.deepEqual([s.where(), s.classes(), s.saved], [BESIDE, ["movable"], [["rollboxOffset", {}]]]);
});

test("the two-character sheet: the bottom character's header drags the panel too", async () => {
  const s = await onScreen();
  s.select([token("Harvey"), token("Ettore")]); s.flush();
  s.drag(800, -400, s.panel().querySelectorAll(".rollbox-sheet-head")[1]);
  assert.equal(s.panel().parentElement.id, "interface");
  assert.deepEqual(s.saved, [["rollboxOffset", { corner: "top-right", x: 374, y: 308 }]]);
});

test("an open flyout that would run off the screen shifts the panel into view, and it goes back when the flyout closes", async () => {
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
  assert.deepEqual([s.where(), s.saved], [BESIDE, []]);
});

test("the wheel while the panel is held steps Panel size by 10 (from the corner it would be anchored to), the map "
  + "never gets it, and the size is saved on release; the wheel does nothing special otherwise", async () => {
  const s = await onScreen();
  const scale = () => s.panel().style.getPropertyValue("--rollbox-scale");
  const map = [];
  s.window.addEventListener("wheel", () => map.push("zoom"));
  const wheel = (deltaY) => s.panel().dispatchEvent(new s.window.WheelEvent("wheel", { bubbles: true, cancelable: true,
    deltaY }));
  wheel(-100);
  assert.deepEqual([scale(), map], ["1", ["zoom"]]);
  map.length = 0;
  s.pointer(s.panel().querySelector(".rollbox-sheet-head"), "pointerdown", 100, 650);
  s.pointer(document, "pointermove", 1300, 600); // the bottom-right quarter, at left 1400, top 658
  wheel(-100);
  assert.deepEqual([scale(), map], ["1.1", []]);
  assert.deepEqual(s.where(), { left: "1380px", top: "639.8px" }, "its bottom-right corner stays put");
  wheel(100);
  wheel(-100);
  s.pointer(document, "pointerup", 1300, 600);
  assert.deepEqual(s.saved.find(([key]) => key === "rollboxScale"), ["rollboxScale", 110]);
  wheel(-100);
  assert.equal(scale(), "1.1");
});

test("registerPanel again takes off its own hooks first and sets the old panel aside, with its listeners and watchers",
  async () => {
    const watchers = [];
    globalThis.ResizeObserver = class { constructor() { watchers.push(this); } observe() {} disconnect() { this.off = true; } };
    try {
      const s = await setup();
      s.select([token("Harvey")]); s.flush();
      const old = s.panel();
      const counts = () => Object.entries(s.env.hooks).map(([name, list]) => [name, list.length]);
      const before = counts();
      const removed = [];
      const remove = document.removeEventListener.bind(document);
      document.removeEventListener = (type, ...rest) => { removed.push(type); return remove(type, ...rest); };
      assert.equal(registerPanel(), true);
      assert.deepEqual(counts(), before);
      assert.equal(old.isConnected, false);
      assert.ok(removed.includes("pointerdown"));
      assert.ok(watchers.length > 0 && watchers.every((watcher) => watcher.off));
    } finally {
      delete globalThis.ResizeObserver;
    }
  });

test("with its size watched, a redraw doesn't place the panel (no layout read); a size change does", async () => {
  const watchers = [];
  globalThis.ResizeObserver = class { constructor(run) { this.run = run; watchers.push(this); } observe() {} disconnect() {} };
  try {
    const s = await onScreen();
    s.panel().style.left = "1px";
    Hooks.call("updateActor", canvas.tokens.controlled[0].actor); s.flush();
    assert.equal(s.panel().style.left, "1px", "not placed again");
    watchers.forEach((watcher) => watcher.run([]));
    assert.deepEqual(s.where(), BESIDE);
  } finally {
    delete globalThis.ResizeObserver;
  }
});

test("the combat box drags from anywhere on it, a row or a button; a press that doesn't move is still their click, a "
  + "drag's click is swallowed", async () => {
  const s = await onScreen();
  const clicks = [];
  setPanelContent(() => {
    const box = document.createElement("div");
    box.className = "rollbox-turn-order";
    const row = document.createElement("li");
    row.addEventListener("click", () => clicks.push("row"));
    const end = document.createElement("button");
    end.addEventListener("click", () => clicks.push("button"));
    box.append(row, end);
    return box;
  });
  s.flush();
  const part = (selector) => s.panel().querySelector(`.rollbox-turn-order ${selector}`);
  s.pointer(part("li"), "pointerdown", 100, 650);
  s.pointer(document, "pointerup", 100, 650);
  part("li").click();
  assert.ok(s.docked());
  assert.deepEqual(clicks, ["row"]);
  for (const selector of ["li", "button"]) {
    s.drag(300, -200, part(selector));
    part(selector).click(); // the browser's click after the drag
  }
  assert.ok(!s.docked());
  assert.deepEqual(clicks, ["row"]);
  assert.equal(s.saved.length, 2);
  clearPanelContent();
});

/**
 * Every flyout replaced by one that records how it was opened: [id, start] on a fresh draw, [id, "apply", start] when
 * it was already open. Registered after setup(), which registers the real ones.
 */
function recordMenus() {
  const opened = [];
  for (const id of ["check", "other"]) {
    registerFlyout(id, { render: (body, { start }) => {
      opened.push([id, start]);
      return { apply: (next) => opened.push([id, "apply", next]) };
    } });
  }
  // The real Opposed hands the panel its start (registerFlyout's `start`); the stub does the same.
  registerFlyout("opposed", { staysOpen: true, start: opposedStart, render: (body, { actors, start }) => {
    opened.push(["opposed", actors.map((a) => a.name), start]);
  } });
  return opened;
}

/** A click or a right click on a value of the character sheet, with modifier keys. */
function clickValue(s, label, { right = false, ...keys } = {}) {
  const node = s.panel().querySelector(`.rollbox-character-panel button[aria-label="${label}"]`);
  const event = new s.window.MouseEvent(right ? "contextmenu" : "click", { bubbles: true, cancelable: true, button: right ? 2 : 0, ...keys });
  node.dispatchEvent(event);
  return event;
}

test("character sheet values: the characteristics, SAN and Luck are buttons named for what they open; HP, MP and the character cards' values aren't", async () => {
  const s = await setup();
  s.select([token("Harvey")]); s.flush();
  const values = [...document.querySelectorAll(".rollbox-character-panel .rollbox-sheet button[data-value]")];
  const labels = values.map((b) => b.getAttribute("aria-label"));
  assert.deepEqual(labels, ["Sanity", "Luck", "Check STR", "Check CON", "Check SIZ", "Check DEX", "Check APP",
    "Check INT", "Check POW", "Check EDU"]);
  assert.equal(document.querySelector(".rollbox-stat-hp").tagName, "DIV");
  assert.equal(values.some((b) => b.title || b.dataset.tooltip), false); // no tooltips
  s.select([token("Harvey"), token("Cecil"), token("Ann")]); s.flush();
  assert.equal(document.querySelectorAll(".rollbox-cards button[data-value]").length, 0);
});

test("a left click opens the value's flyout, nothing sent: Check with only that characteristic ticked (again switches it), Check's Sanity tab, Other on Luck", async () => {
  const s = await setup();
  s.select([token("Harvey")]); s.flush();
  const opened = recordMenus();
  clickValue(s, "Check STR");
  clickValue(s, "Check INT"); // Check is open: it takes the new tick
  clickValue(s, "Sanity");
  clickValue(s, "Luck");
  assert.deepEqual(opened, [["check", { tick: "characteristic:str" }], ["check", "apply", { tick: "characteristic:int" }],
    ["check", "apply", { tab: "sanity" }], ["other", { section: "luck" }]]);
  assert.deepEqual(s.env.chat, []);
});

test("shortcuts, as on CoC7's sheet: Shift sends now, Ctrl (CoC7's copy a link) opens Check as a click does, Alt+Right adds to the ticks", () => {
  const str = { kind: "characteristic", key: "str" };
  const tick = "characteristic:str";
  assert.deepEqual(shortcut(str, { shift: true }), { open: "check", start: { tick, plain: true, send: true } });
  assert.deepEqual(shortcut(str, { ctrl: true }), { open: "check", start: { tick } });
  assert.deepEqual(shortcut(str, { shift: true, ctrl: true }), { open: "check", start: { tick } });
  assert.deepEqual(shortcut(str, { right: true }), { opposed: { key: tick, create: false } });
  assert.deepEqual(shortcut(str, { right: true, shift: true }), { opposed: { key: tick, create: true } });
  assert.deepEqual(shortcut(str, { right: true, alt: true }), { open: "check", start: { tick, add: true } });
  assert.deepEqual(shortcut(str, { right: true, alt: true, shift: true }),
    { open: "check", start: { tick, add: true, send: true } });
});

test("right click: no browser menu; Opposed opens with that character as the first side, Shift makes the card once both have a check", async () => {
  const s = await setup();
  s.select([token("Harvey")]); s.flush();
  const opened = recordMenus();
  assert.equal(clickValue(s, "Check STR", { right: true }).defaultPrevented, true);
  clickValue(s, "Check POW", { right: true, shiftKey: true }); // open already: the stub, with no controller, is drawn again
  assert.deepEqual(opened, [
    ["opposed", ["Harvey"], { first: "Actor.Harvey", picks: { "Actor.Harvey": "characteristic:str" }, create: false }],
    ["opposed", ["Harvey"], { first: "Actor.Harvey", picks: { "Actor.Harvey": "characteristic:pow" }, create: true }]]);
  assert.equal(document.querySelector(".rollbox-pending"), null); // no two-step note any more
});

test("Shift + Left on a characteristic while Opposed waits for a side goes to Opposed, not to a Check", async () => {
  const s = await setup();
  s.select([token("Harvey")]); s.flush();
  const checks = [];
  registerFlyout("check", { render: (body, { start }) => { checks.push(start); } });
  clickValue(s, "Check STR", { right: true }); // the real Opposed: Harvey's side, the other waiting
  assert.equal(s.flyout().dataset.menu, "opposed");
  clickValue(s, "Check POW", { shiftKey: true });
  assert.deepEqual(checks, []);
  assert.equal(s.flyout().dataset.menu, "opposed");
  s.click("Check"); // Opposed closes: nothing waits now, so Shift + Left is a Check again
  clickValue(s, "Check POW", { shiftKey: true });
  assert.deepEqual(checks.at(-1), { tick: "characteristic:pow", plain: true, send: true });
  assert.deepEqual(s.env.chat, []);
});

test("two-character sheet: a top number is the top character's value, a bottom number the bottom one's", async () => {
  const s = await setup();
  const cultist = token("Cultist"); const harvey = token("Harvey", { owners: ["Player 1"] });
  s.select([cultist, harvey]); s.flush();
  const opened = recordMenus();
  clickValue(s, "Check STR, Cultist", { right: true }); // the bottom row: the NPC's STR
  clickValue(s, "Check POW, Harvey", { right: true }); // the top row: Harvey's POW
  assert.deepEqual(opened.map(([, , start]) => start), [
    { first: "Actor.Cultist", picks: { "Actor.Cultist": "characteristic:str" }, create: false },
    { first: "Actor.Harvey", picks: { "Actor.Harvey": "characteristic:pow" }, create: false }]);
  clickValue(s, "Sanity, Cultist");
  assert.deepEqual(opened.at(-1), ["check", { tab: "sanity" }]);
});

test("no Tab stops: every control in the panel and its flyouts is out of the Tab order", async () => {
  const s = await setup();
  s.select([token("Harvey"), token("Cultist")]); s.flush();
  for (const label of ["Action", "Check", "Other", "Opposed"]) {
    s.click(label);
    const controls = [...s.panel().querySelectorAll("button, input, select, textarea")];
    assert.ok(controls.length > 10);
    assert.deepEqual(controls.filter((node) => node.tabIndex !== -1).map((node) => node.className), [], label);
  }
  s.select(["A", "B", "C"].map((n) => token(n))); s.flush();
  assert.ok([...s.panel().querySelectorAll("button")].every((node) => node.tabIndex === -1));
});

/** Foundry's players list on SCREEN, its top at `top`: it grows upwards as players join, its bottom stays. */
function playersAt(top) {
  document.getElementById("players").getBoundingClientRect = () => ({ ...PLAYERS, top, height: PLAYERS.bottom - top });
}

test("Panel layer Bottom: beside the players list at the UI columns' level, under every window; moved, the same", async () => {
  const s = await onScreen({ rollboxPanelLayer: "bottom" });
  assert.ok(s.docked());
  assert.equal(s.panel().style.zIndex, "var(--z-index-app, 30)");
  s.drag(800, -400);
  assert.equal(s.panel().style.zIndex, "var(--z-index-app, 30)");
});

test("Panel layer Top: beside the players list above every window, not moving as players join; moved, the same "
  + "level; a change applies at once", async () => {
  const s = await onScreen({ rollboxPanelLayer: "top" });
  playersAt(830);
  Hooks.call("renderPlayers"); // Foundry redrew the list
  assert.equal(s.panel().parentElement.id, "interface");
  assert.deepEqual(s.where(), BESIDE);
  assert.equal(s.panel().style.zIndex, "calc(var(--z-index-tooltip, 9999) - 3)");
  assert.deepEqual(s.classes(), ["movable"]); // the menu opens to the right
  playersAt(800); // a player joined: the list grew upwards
  Hooks.call("renderPlayers");
  assert.deepEqual(s.where(), BESIDE);
  s.drag(800, -400);
  assert.equal(s.panel().style.zIndex, "calc(var(--z-index-tooltip, 9999) - 3)");
  resetPosition();
  s.env.registered.rollboxPanelLayer.onChange("bottom");
  assert.ok(s.docked());
});

test("Panel layer Top when active: a press brings it to the front with Foundry's window counter, so a window raised "
  + "later goes above it again; without the counter it works as Bottom", async () => {
  const order = { _maxZ: 120 };
  globalThis.foundry = { applications: { api: { ApplicationV2: order } } };
  try {
    const s = await onScreen({ rollboxPanelLayer: "active" });
    playersAt(830); Hooks.call("renderPlayers");
    assert.equal(s.panel().parentElement.id, "interface");
    assert.equal(s.panel().style.zIndex, "var(--z-index-window, 100)");
    s.pointer(s.panel().querySelector(".rollbox-stat-hp"), "pointerdown", 50, 700);
    assert.deepEqual([s.panel().style.zIndex, order._maxZ], ["121", 121]);
    order._maxZ += 1; // a sheet brought to the front: 122, above the panel
    s.pointer(s.panel(), "pointerdown", 50, 700);
    assert.equal(s.panel().style.zIndex, "123");
  } finally {
    delete globalThis.foundry;
  }
  const without = await onScreen({ rollboxPanelLayer: "active" });
  assert.ok(without.docked());
});

test("Panel layer Top when active: a press on the window that was in front before the panel puts the panel just "
  + "under it (Foundry doesn't give that window a new number)", async () => {
  const order = { _maxZ: 120 };
  globalThis.foundry = { applications: { api: { ApplicationV2: order } } };
  try {
    const s = await onScreen({ rollboxPanelLayer: "active" });
    playersAt(830); Hooks.call("renderPlayers");
    const sheet = document.createElement("div");
    sheet.className = "application";
    sheet.style.zIndex = "120";
    sheet.append(document.createElement("header"));
    document.body.append(sheet);
    s.pointer(s.panel(), "pointerdown", 50, 700);
    assert.equal(s.panel().style.zIndex, "121");
    s.pointer(sheet.firstChild, "pointerdown", 600, 300);
    assert.equal(s.panel().style.zIndex, "120");
    sheet.remove();
  } finally {
    delete globalThis.foundry;
  }
});

test("menu host: the flyout's heading is its open tab's name, following a tab switch; the menu's name without tabs", async () => {
  const s = await setup();
  registerFlyout("other", { render: (body) => {
    const tabs = ["Luck", "Assist"].map((label) => Object.assign(document.createElement("button"),
      { className: "rollbox-other-tab", textContent: label }));
    tabs.forEach((tab, i) => tab.setAttribute("aria-selected", String(i === 0)));
    body.append(...tabs);
  } });
  registerFlyout("check", { render: () => {} });
  s.select([token("Harvey")]); s.flush();
  s.click("Other");
  assert.equal(s.flyout().dataset.heading, "Luck");
  const [luck, assist] = document.querySelectorAll(".rollbox-other-tab");
  luck.setAttribute("aria-selected", "false"); assist.setAttribute("aria-selected", "true");
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(s.flyout().dataset.heading, "Assist");
  s.click("Check");
  assert.equal(s.flyout().dataset.heading, "Check");
});

test("nothing selected: the Keeper's panel lists each player's investigator (the meters of rollboxCardMeters, all four "
  + "by default), with Check and Other for all of them; a row selects its token; the setting turns it off", async () => {
  const s = await setup();
  const helen = token("Helen", { owners: ["Robin"], occupation: "Antiquarian", san: 70, luck: 60 });
  const cecil = token("Cecil", { owners: ["Sam"] });
  const picked = [];
  helen.actor.getActiveTokens = () => [{ control: (options) => picked.push(options) }];
  cecil.actor.getActiveTokens = () => [];
  for (const t of [helen, cecil]) t.actor.testUserPermission = (user, level) => level === "OWNER" && !user.isGM;
  Object.assign(game.users[1], { name: "Robin", active: true, character: helen.actor });
  Object.assign(game.users[2], { name: "Sam", active: false, character: cecil.actor });
  Hooks.call("updateUser", game.users[1]); s.flush();
  assert.equal(s.visible(), true);
  assert.deepEqual(text(".rollbox-players .rollbox-name"), ["Helen", "Cecil"]);
  assert.deepEqual(text(".rollbox-players .rollbox-sub"), ["Antiquarian · Robin", "Sam · offline"]);
  assert.deepEqual(text(".rollbox-players .rollbox-cards-col"), ["HP", "MP", "SAN", "Luck"]);
  assert.equal(document.querySelectorAll(".rollbox-players-row:first-child .rollbox-vbar").length, 4);
  await game.settings.set("keepers-rollbox", "rollboxCardMeters", ["hp", "mp"]); s.flush();
  assert.deepEqual(text(".rollbox-players .rollbox-cards-col"), ["HP", "MP"]);
  assert.deepEqual(text(".rollbox-players .rollbox-cards-value").length, 4);
  await game.settings.set("keepers-rollbox", "rollboxCardMeters", ["hp", "san", "luck"]); s.flush();
  assert.deepEqual(text(".rollbox-players .rollbox-cards-value"), ["9", "70", "60", "9", "50", "40"]);
  assert.ok(document.querySelectorAll(".rollbox-players-row")[1].classList.contains("rollbox-players-away"));
  assert.deepEqual(s.buttons(), ["Opposed", "Check", "Other"]);
  s.click("Check");
  assert.equal(document.querySelector(".rollbox-check-action").textContent, "Send to all players");
  document.querySelector(".rollbox-players-row").click();
  assert.deepEqual(picked, [{ releaseOthers: true }]);
  s.env.values.rollboxShowPlayers = false;
  s.env.registered.rollboxShowPlayers.onChange(false); s.flush();
  assert.equal(s.visible(), false);
});

test("a player with no investigator of their own reads the message in the panel's place, until they close it", async () => {
  const s = await setup({ isGM: false });
  s.flush();
  assert.equal(s.visible(), true);
  assert.equal(text(".rollbox-no-investigator-text")[0], "You aren't assigned an investigator. Right-click your name in "
    + "the Players list (bottom left) and select User Configuration, or ask your Keeper for help.");
  assert.deepEqual(s.buttons(), []);
  document.querySelector(".rollbox-no-investigator-close").click(); s.flush();
  assert.equal(s.visible(), false);
});

test("beside the players list, an open flyout that runs off the screen moves the panel over the list until it closes", async () => {
  const s = await onScreen({ rollboxMovable: false });
  const narrow = { ...SCREEN, right: 700, width: 700 };
  document.getElementById("interface").getBoundingClientRect = () => narrow;
  s.click("Check"); // card's right edge 426, then 8 and 384 more: 118px off a 700px screen
  assert.equal(s.panel().style.left, "108px");
  s.click("Check");
  assert.deepEqual(s.where(), BESIDE);
});

/**
 * A selector for a state (CLAUDE.md, "never highlight one side of a border": selected, highlighted, warning or new): a
 * pseudo-class or ARIA state, or a class naming one. A line on one side of anything else is a neutral divider.
 */
const STATE = /:(hover|focus|focus-visible|focus-within|active|checked)\b|\[aria-(pressed|selected|current|checked)|-(selected|picked|current|active|warning|error|new|highlight|pressed|primary|now|held|greyed|on)\b/;

test("no one-sided border highlight in any Rollbox stylesheet or script, every theme", () => {
  const files = readdirSync(SCRIPTS, { recursive: true }).map((file) => file.replaceAll("\\", "/"));
  const read = (file) => readFileSync(new URL(file, pathToFileURL(SCRIPTS)), "utf8").replace(/\r\n/g, "\n");
  const found = [];
  for (const file of files.filter((name) => name.endsWith(".css"))) {
    const css = read(file).replace(/\/\*[\s\S]*?\*\//g, "");
    for (const [, selector, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const where = `${file}: ${selector.trim()}`;
      for (const declaration of body.split(";")) {
        const [property = "", value = ""] = declaration.split(/:(.*)/s).map((part) => part.trim());
        const sided = /^border-(left|right|top|bottom|inline|block)/.test(property) && !/^(none|0(px)?)$/.test(value);
        const insetSide = property === "box-shadow" && /inset\s+(-?[\d.]+px)\s+(-?[\d.]+px)/.exec(value);
        const offset = insetSide && (parseFloat(insetSide[1]) !== 0 || parseFloat(insetSide[2]) !== 0);
        const mixed = /^border-(width|color|style)$/.test(property) && new Set(value.split(/\s+(?![^(]*\))/)).size > 1;
        if ((sided && STATE.test(selector)) || offset || mixed) found.push(`${where} { ${property}: ${value} }`);
      }
    }
  }
  for (const file of files.filter((name) => name.endsWith(".js"))) {
    if (/border(Left|Right|Top|Bottom|Inline|Block)|border-(left|right|top|bottom|inline|block)/.test(read(file))) found.push(file);
  }
  assert.deepEqual(found, []);
});
