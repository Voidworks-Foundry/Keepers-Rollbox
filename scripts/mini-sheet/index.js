/**
 * Mini sheet: when the Keeper selects tokens, a small panel sits directly on top of Foundry's players list
 * (the latency and FPS card), or wherever the Keeper dragged it when moving is allowed (position.js), and shows the
 * selected characters: the mini sheet for one, the names card for
 * two or more (its value columns follow the open menu). Beside it, the buttons that open the Check, Sanity,
 * Item, Opposed and Assist menus (menu-host.js).
 * Keeper only, and only with the personal switch on: players run none of this.
 * Selection changes are gathered into one redraw per animation frame (a box-select fires one hook per
 * token). Where it goes and which hooks say the selection changed: docs/BUILD-GUIDE.md, "The panel and CSS".
 * Its look follows the personal Theme, Panel colour, transparency and size settings (theme.js, mini-sheet.css).
 * On the one-character mini sheet, a click on a characteristic, SAN or Luck opens that check's menu, with CoC7's
 * sheet shortcuts (sheet-clicks.js).
 */
import { MODULE_ID, actorKey, element, getSetting, isKeeper, tellKeeper, uniqueActors, warn } from "../utils.js";
import { miniSheet, namesCard, sheetGhost } from "./cards.js";
import { MenuHost } from "./menu-host.js";
import { DEFAULT_COLOR, DEFAULT_THEME, flippedColor, hexColor, normalTheme, shownColor } from "./theme.js";
import { forgetSpot, PanelPlace, rescale } from "./position.js";
import { OpposedStep, howClicked, shortcut } from "./sheet-clicks.js";

export { registerMenu } from "./menu-host.js";
export { DEFAULT_COLOR, DEFAULT_THEME, THEMES } from "./theme.js";
export { DEFAULT_MENU_SIDE, MENU_SIDES } from "./position.js";
/** The one-character card, for menus that show it themselves (the Opposed roll shows both sides' sheets). */
export { miniSheet } from "./cards.js";

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
 * opposed view, is scaled from its anchored corner (bottom left when docked), so that corner stays put.
 */
export const SCALE = Object.freeze({ min: 80, max: 150, step: 10, default: 100 });
/** The panel's scale as a number (1.2 for 120%); mini-sheet.css keeps the flyout's height on screen with it. */
const SCALE_VARIABLE = "--rollbox-scale";

/** The panel, built the first time something is selected: { root, cardSlot, host, place, theme, color }. */
let panel = null;
/** The pending animation frame, or null. */
let frame = null;
/** The characters the panel shows now; empty while it is hidden. */
let shown = [];
/** What the names card last showed (characters and column values), so a menu's change redraws it only when needed. */
let cardKey = "";
/** The opposed two-step started by a right click on a characteristic (sheet-clicks.js). */
let step = new OpposedStep();
/** A menu to open once the next redraw has the new selection: { id, start } (the opposed two-step's second click). */
let pendingOpen = null;

/**
 * ready: install the panel on the Keeper's client when the Rollbox switch is on.
 * Checks the Keeper first, so players run no Rollbox code and never read the setting.
 * @returns {boolean} true when the panel was set up, false when it does nothing on this client.
 */
export function registerMiniSheet() {
  if (!isKeeper() || !getSetting("rollboxEnabled")) return false;
  panel = null; frame = null; shown = []; cardKey = ""; step = new OpposedStep(); pendingOpen = null;
  Hooks.on("controlToken", scheduleRedraw);
  Hooks.on("deleteToken", scheduleRedraw);
  Hooks.on("canvasReady", scheduleRedraw);
  Hooks.on("canvasTearDown", onTearDown);
  Hooks.on("renderPlayers", attach);
  Hooks.on("updateActor", onActorUpdate);
  globalThis.addEventListener?.("resize", onResize);
  globalThis.document?.addEventListener("keydown", onKey);
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
  panel.place.place(); // now that it has its size: a floating panel is kept on screen
  if (pendingOpen) openPending();
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
    const actor = actors[0];
    panel.cardSlot.replaceChildren(miniSheet(actor, { onValue: (event, value, right) => onValue(event, value, right, actor) }));
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
  const note = element("div", "rollbox-pending");
  note.hidden = true;
  note.setAttribute("aria-live", "polite");
  root.append(note, cardSlot, side);
  // A left click anywhere on the panel cancels the opposed two-step (a value's own click then does its work).
  root.addEventListener("pointerdown", (event) => {
    if (event.button === 0 && step.cancel()) drawNote();
  });
  const place = new PanelPlace(root, { movable: readSetting("rollboxMovable", false),
    spot: readSetting("rollboxOffset", undefined), menuSide: readSetting("rollboxMenuSide", undefined) });
  const built = { root, cardSlot, note, host: new MenuHost(side, cardSlot, () => { drawCard(); keepInView(); }), place,
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
 * Scale the panel from its anchored corner. `transform` leaves the panel's place alone, so docked it grows up and
 * to the right, over the canvas, and never over the players list; at 100% there is no transform at all, so the
 * default panel is exactly as before (position.js, `scaleTransform`). Out-of-range values are clamped.
 */
function setScale(root, size) {
  const n = Number(size);
  const percent = Number.isFinite(n) ? Math.max(SCALE.min, Math.min(SCALE.max, n)) : SCALE.default;
  root.style.setProperty(SCALE_VARIABLE, String(percent / 100));
  rescale(root);
}

/**
 * The size setting's onChange: applies the new size at once (nothing to change before the panel is built).
 * @param {number} size percent, 80 to 150
 */
export function applyScale(size) {
  if (panel) setScale(panel.root, size);
}

/**
 * Put the panel in its place (position.js): docked just before the players list, or floating in a corner. Also the
 * renderPlayers hook, in case Foundry rebuilt the column.
 * @returns {boolean} false when there is no panel yet or no players list to dock on.
 */
function attach() {
  return panel ? panel.place.place() : false;
}

/** The window's resize: a moved panel is kept on screen (its saved spot is left as it is). */
function onResize() {
  keepInView();
}

/**
 * A menu opened, closed or changed size, or the window was resized: a moved panel is placed again, so it stays on
 * screen and an open menu is shifted into view (position.js). The panel's place is only read until it is built.
 */
function keepInView() {
  if (panel && !panel.root.hidden) panel.place.place();
}

/**
 * "Allow moving the panel" changed. Off: the dropped spot is forgotten and the panel goes back above the players list
 * (also before the panel is built, so it isn't used on the next reload). On: it stays docked until dragged.
 * @param {boolean} movable
 */
export function applyMovable(movable) {
  if (!isKeeper()) return;
  if (panel) panel.place.setMovable(movable);
  if (!movable) forgetSpot();
}

/**
 * The "Reset position" button beside "Allow moving the panel": the dropped spot is forgotten and the panel goes back
 * above the players list at once (also before the panel is built, so it isn't used on the next reload). Keeper only.
 */
export function resetPosition() {
  if (!isKeeper()) return;
  if (panel) panel.place.reset();
  forgetSpot();
}

/**
 * "Menus open to the" changed: applied at once (nothing to change before the panel is built).
 * @param {string} side "auto", "right" or "left"
 */
export function applyMenuSide(side) {
  if (panel) panel.place.setMenuSide(side);
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
  step.cancel();
  pendingOpen = null;
  drawNote();
  hide();
}

// --- Clicks on the mini sheet's values (sheet-clicks.js; Void, 2026-11-15) ---

/**
 * A click on a characteristic, SAN or Luck: open that menu with its starting state (a send included), or take a
 * step of the opposed two-step. Nothing is sent from here; the menu that opens sends.
 */
function onValue(event, value, right, actor) {
  const action = shortcut(value, howClicked(event, right));
  if (!action || !panel) return;
  if (action.opposed) {
    opposedClick(actor, action.opposed);
    return;
  }
  panel.host.open(action.open, action.start);
}

/**
 * A right click on a characteristic: the first remembers the side (the note says so); the second, on another
 * character's (that token selected), selects the first character's token too and opens the Opposed roll with both
 * sides picked, or makes the card at once with Shift.
 */
function opposedClick(actor, opposed) {
  const token = Array.from(globalThis.canvas?.tokens?.controlled ?? []).find((t) => t?.actor === actor) ?? null;
  const both = step.click(actor, token, opposed);
  drawNote();
  if (!both) return;
  const { first, second, create } = both;
  pendingOpen = { id: "opposed", start: { first: actorKey(first.actor),
    picks: { [actorKey(first.actor)]: first.key, [actorKey(second.actor)]: second.key }, create } };
  try {
    first.token.control({ releaseOthers: false }); // Foundry's controlToken hook redraws the panel with both
  } catch (error) {
    pendingOpen = null;
    warn("couldn't select the first character's token for the opposed roll.", error);
    tellKeeper(`Rollbox couldn't select ${first.actor?.name ?? "the first character"}'s token. Select both and use Opposed.`);
    return;
  }
  scheduleRedraw();
}

/** The Opposed roll, opened once the redraw shows both characters. */
function openPending() {
  const { id, start } = pendingOpen;
  pendingOpen = null;
  if (!panel.host.open(id, start)) tellKeeper("Select both characters and use Opposed.");
}

/** The opposed two-step's note above the card, or nothing. */
function drawNote() {
  if (!panel) return;
  panel.note.textContent = step.note;
  panel.note.hidden = !step.note;
}

/** Escape cancels the opposed two-step. */
function onKey(event) {
  if (event.key === "Escape" && step.cancel()) drawNote();
}

/** updateActor: a shown character changed (HP, SAN after a loss…), so draw the card again. */
function onActorUpdate(actor) {
  if (shown.some((other) => other === actor || (actor?.uuid && other.uuid === actor.uuid))) scheduleRedraw();
}
