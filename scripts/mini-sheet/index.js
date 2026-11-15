/**
 * Mini sheet: when the Keeper selects tokens, a small panel sits directly on top of Foundry's players list
 * (the latency and FPS card) and shows the selected characters: the mini sheet for one, the names card for
 * two or more (its value columns follow the open menu). Beside it, the buttons that open the Check, Sanity,
 * Item, Opposed and Assist menus (menu-host.js).
 * Keeper only, and only with the personal switch on: players run none of this.
 * Selection changes are gathered into one redraw per animation frame (a box-select fires one hook per
 * token). Where it goes and which hooks say the selection changed: docs/BUILD-GUIDE.md, "The panel and CSS".
 * Its look follows the personal Theme, Panel colour, transparency and size settings (theme.js, mini-sheet.css).
 */
import { MODULE_ID, getSetting, isKeeper, uniqueActors, warn } from "../utils.js";
import { miniSheet, namesCard, sheetGhost } from "./cards.js";
import { MenuHost } from "./menu-host.js";
import { DEFAULT_COLOR, DEFAULT_THEME, flippedColor, hexColor, normalTheme, shownColor } from "./theme.js";

export { registerMenu } from "./menu-host.js";
export { DEFAULT_COLOR, DEFAULT_THEME, THEMES } from "./theme.js";
/** The one-character card, for menus that show it themselves (the Opposed roll shows both sides' sheets). */
export { miniSheet } from "./cards.js";

/** Foundry's players list (build 368: `aside#players` in `#ui-left-column-1`). The panel goes just before it. */
const PLAYERS_ID = "players";

/**
 * Panel transparency in percent (setting `rollboxTransparency`): 0 is solid. It changes only the
 * backgrounds' alpha, through one CSS variable on the panel, never `opacity`, so text stays fully readable.
 */
export const TRANSPARENCY = Object.freeze({ min: 0, max: 70, step: 5, default: 25 });
/** The CSS variable mini-sheet.css builds every background from. */
const OPACITY_VARIABLE = "--rollbox-opacity";

/** The CSS variable mini-sheet.css takes the solid background from; the transparency mix applies to it. */
const COLOR_VARIABLE = "--rollbox-color";
/** On the panel in the Light theme (setting `rollboxTheme`): mini-sheet.css switches to the Light palette. */
const LIGHT_THEME_CLASS = "rollbox-theme-light";

/**
 * Panel size in percent (setting `rollboxScale`). The whole panel, with its buttons, menus and the
 * opposed view, is scaled from its bottom-left corner, so it stays on top of the players list.
 */
export const SCALE = Object.freeze({ min: 80, max: 150, step: 10, default: 100 });
/** The panel's scale as a number (1.2 for 120%); mini-sheet.css keeps the flyout's height on screen with it. */
const SCALE_VARIABLE = "--rollbox-scale";

/** The panel, built the first time something is selected: { root, cardSlot, host, theme, color }. */
let panel = null;
/** The pending animation frame, or null. */
let frame = null;
/** The characters the panel shows now; empty while it is hidden. */
let shown = [];
/** Warn only once when the players list can't be found. */
let warnedNoPlayers = false;
/** What the names card last showed (characters and column values), so a menu's change redraws it only when needed. */
let cardKey = "";

/**
 * ready: install the panel on the Keeper's client when the Rollbox switch is on.
 * Checks the Keeper first, so players run no Rollbox code and never read the setting.
 * @returns {boolean} true when the panel was set up, false when it does nothing on this client.
 */
export function registerMiniSheet() {
  if (!isKeeper() || !getSetting("rollboxEnabled")) return false;
  panel = null; frame = null; shown = []; warnedNoPlayers = false; cardKey = "";
  Hooks.on("controlToken", scheduleRedraw);
  Hooks.on("deleteToken", scheduleRedraw);
  Hooks.on("canvasReady", scheduleRedraw);
  Hooks.on("canvasTearDown", onTearDown);
  Hooks.on("renderPlayers", attach);
  Hooks.on("updateActor", onActorUpdate);
  return true;
}

/** Ask for one redraw on the next animation frame; further calls before it runs are absorbed. */
function scheduleRedraw() {
  if (frame !== null) return;
  frame = requestAnimationFrame(redraw);
}

/** The selected tokens' characters, once each, in selection order. Tokens without an actor are left out. */
function selectedActors() {
  try {
    return uniqueActors(Array.from(globalThis.canvas?.tokens?.controlled ?? [], (token) => token?.actor));
  } catch {
    return [];
  }
}

/** Draw the panel for the current selection, or hide it when nothing is selected. */
function redraw() {
  frame = null;
  const actors = selectedActors();
  if (!actors.length) return hide();
  panel ??= buildPanel();
  if (!attach()) return hide();
  shown = actors;
  panel.host.update(actors);
  drawCard(true);
  panel.root.hidden = false;
}

/**
 * The card for the shown characters: the mini sheet for one; for two or more the names card, with the value
 * columns of the open menu (menu-host.js), over an invisible mini sheet so it is never shorter than it.
 * Also the menu host's onCardChange: then it draws only when the names card would show something new.
 * @param {boolean} [force] draw even when nothing seems to have changed (a new selection, an actor update)
 */
function drawCard(force = false) {
  if (!panel || !shown.length) return;
  const actors = shown;
  if (actors.length === 1) {
    cardKey = "";
    panel.cardSlot.replaceChildren(miniSheet(actors[0]));
    return;
  }
  const columns = panel.host.columns(actors);
  const key = JSON.stringify([actors.map((a) => a.uuid ?? a.name),
    (columns ?? []).map((col) => [col.label, actors.map((a) => safeValue(col, a))])]);
  if (!force && key === cardKey) return;
  cardKey = key;
  panel.cardSlot.replaceChildren(sheetGhost(actors[0]), namesCard(actors, columns));
}

/** A column's value for the change check; a failing column counts as empty (the card shows a dash). */
function safeValue(column, actor) {
  try {
    return column.value(actor) ?? null;
  } catch {
    return null;
  }
}

function buildPanel() {
  const root = document.createElement("div");
  root.className = "rollbox-panel";
  root.hidden = true;
  const cardSlot = document.createElement("div");
  cardSlot.className = "rollbox-card-slot";
  const side = document.createElement("div");
  side.className = "rollbox-side";
  root.append(cardSlot, side);
  const built = { root, cardSlot, host: new MenuHost(side, cardSlot, () => drawCard()),
    theme: DEFAULT_THEME, color: DEFAULT_COLOR };
  setOpacity(root, readSetting("rollboxTransparency", TRANSPARENCY.default));
  setTheme(built, readSetting("rollboxTheme", DEFAULT_THEME), readSetting("rollboxColor", DEFAULT_COLOR));
  setScale(root, readSetting("rollboxScale", SCALE.default));
  return built;
}

/** A saved appearance setting, or its default when it can't be read. */
function readSetting(key, fallback) {
  try {
    return getSetting(key);
  } catch {
    return fallback;
  }
}

/** Background alpha for a transparency: 25% see-through is 75% opaque. Out-of-range values are clamped. */
function setOpacity(root, transparency) {
  const n = Number(transparency);
  const percent = Number.isFinite(n) ? Math.max(TRANSPARENCY.min, Math.min(TRANSPARENCY.max, n)) : TRANSPARENCY.default;
  root.style.setProperty(OPACITY_VARIABLE, `${100 - percent}%`);
}

/**
 * The transparency setting's onChange: applies the new value at once. Before the panel is built (or on a
 * player's client, which never builds it) there is nothing to change; the panel reads the setting when built.
 * @param {number} transparency percent, 0 (solid) to 70
 */
export function applyTransparency(transparency) {
  if (panel) setOpacity(panel.root, transparency);
}

/**
 * The theme's palette and the Panel colour as its tint: the panel shows the colour with its lightness kept where the
 * theme's text reads well (theme.js `shownColor`); the setting keeps what the Keeper picked.
 */
function setTheme(target, theme, color) {
  target.theme = normalTheme(theme);
  target.color = hexColor(color);
  target.root.classList.toggle(LIGHT_THEME_CLASS, target.theme === "light");
  target.root.style.setProperty(COLOR_VARIABLE, shownColor(target.color, target.theme));
}

/**
 * The colour setting's onChange: applies the new colour at once (nothing to change before the panel is built).
 * @param {Color|string} color "#rrggbb", or Foundry's Color
 */
export function applyColor(color) {
  if (panel) setTheme(panel, panel.theme, color);
}

/**
 * The theme setting's onChange (Void, 2026-11-14): the palette switches at once, and the Panel colour's lightness
 * flips to suit the new theme, keeping its hue and saturation (theme.js `flippedColor`). The flipped colour is saved
 * to the colour setting, so Configure Settings shows it and the Keeper can pick any colour from there; that
 * setting's own onChange then redraws. A colour that already suits the new theme is left alone. Keeper only.
 * @param {string} theme "dark" or "light"
 */
export function applyTheme(theme) {
  if (!isKeeper()) return;
  const color = hexColor(readSetting("rollboxColor", DEFAULT_COLOR));
  const flipped = flippedColor(color, theme);
  if (panel) setTheme(panel, theme, flipped);
  if (flipped !== color) saveColor(flipped);
}

/** Save the Panel colour; a failure leaves the setting as it was (the panel shows the flipped colour until reload). */
async function saveColor(hex) {
  try {
    await game.settings.set(MODULE_ID, "rollboxColor", hex); // called at once; a throw or a refusal lands below
  } catch (error) {
    warn("couldn't save the Panel colour for the new theme.", error);
  }
}

/**
 * Scale the panel from its bottom-left corner. `transform` leaves the panel's place in the column alone, so
 * it grows up and to the right, over the canvas, and never over the players list. At 100% there is no
 * transform at all, so the default panel is exactly as before. Out-of-range values are clamped.
 */
function setScale(root, size) {
  const n = Number(size);
  const percent = Number.isFinite(n) ? Math.max(SCALE.min, Math.min(SCALE.max, n)) : SCALE.default;
  const factor = percent / 100;
  root.style.setProperty(SCALE_VARIABLE, String(factor));
  root.style.transformOrigin = factor === 1 ? "" : "left bottom";
  root.style.transform = factor === 1 ? "" : `scale(${factor})`;
}

/**
 * The size setting's onChange: applies the new size at once (nothing to change before the panel is built).
 * @param {number} size percent, 80 to 150
 */
export function applyScale(size) {
  if (panel) setScale(panel.root, size);
}

/**
 * Put the panel just before the players list, the same column. Also the renderPlayers hook, in case
 * Foundry rebuilt the column. Not inside #players: Foundry replaces that element's contents on each render.
 * @returns {boolean} false when there is no panel yet or no players list to sit on.
 */
function attach() {
  if (!panel) return false;
  const players = document.getElementById(PLAYERS_ID);
  if (!players) {
    if (!warnedNoPlayers) warn("Foundry's players list is missing; the panel can't show.");
    warnedNoPlayers = true;
    return false;
  }
  if (players.previousElementSibling !== panel.root) players.before(panel.root);
  return true;
}

/** Nothing selected: hide the panel and close any open menu. */
function hide() {
  shown = [];
  if (!panel) return;
  panel.root.hidden = true;
  panel.host.close();
}

/** canvasTearDown: Foundry clears the selection without the controlToken hook, so hide at once. */
function onTearDown() {
  if (frame !== null) cancelAnimationFrame(frame);
  frame = null;
  hide();
}

/** updateActor: a shown character changed (HP, SAN after a loss…), so draw the card again. */
function onActorUpdate(actor) {
  if (shown.some((other) => other === actor || (actor?.uuid && other.uuid === actor.uuid))) scheduleRedraw();
}
