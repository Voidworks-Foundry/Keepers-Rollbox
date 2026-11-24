/** The panel's hooks, selection and redraw, and the entry points the settings call. See docs/panel.md. */
import { element, glyph, isKeeper, sameActor, tellKeeper, uniqueActors, warn } from "../utils.js";
import { characterSheet, pairSheet, sheetGhost } from "./sheet.js";
import { characterCards, playersList } from "./cards.js";
import { MenuHost, flyoutStart, flyoutWaiting } from "./menu-host.js";
import { forgetSpot, PanelPlace } from "./position.js";
import { howClicked, shortcut } from "./sheet-clicks.js";
import { placeStatusCards } from "./status-cards.js";
import { forwardOnSelect } from "./layer.js";
import { readSetting, resetAppearance, saveScale, stepScale, stylePanel } from "./appearance.js";
import { AutoHide } from "./auto-hide.js";
import { investigators, offersClick, ownCharacter, picking, playerMenu, playerRollboxOn } from "../player/index.js";

import { playerBlock } from "../status/index.js";

export { registerFlyout } from "./menu-host.js";
export { characterSheet, nameLine, ownerText, portrait } from "./sheet.js";
export { meters } from "./cards.js";
export { statusCards } from "./status-cards.js";
export { howClicked, rowShortcut } from "./sheet-clicks.js";
export { DEFAULT_COLOR, DEFAULT_THEME, THEMES } from "./theme.js";
export { DEFAULT_MENU_SIDE, MENU_SIDES } from "./position.js";
export { DEFAULT_PANEL_LAYER, PANEL_LAYERS } from "./layer.js";
export {
  SCALE, TRANSPARENCY, applyColor, applyScale, applyTheme, applyTransparency, followTheme
} from "./appearance.js";
export { AUTO_HIDE } from "./auto-hide.js";

const NO_INVESTIGATOR = "You aren't assigned an investigator. Right-click your name in the Players list "
  + "(bottom left) and select User Configuration, or ask your Keeper for help.";

const PROVIDED = "provided";
const PLAYERS = "players";
const NO_ONE = "no-investigator";
const COMPACT = "compact";

/** The panel's state on this client, all reset by registerPanel. */
function freshState() {
  return {
    panel: null, // built the first time it shows: { root, characterPanel, host, place, alertSlot }
    frame: null,
    shown: [], // the characters the panel shows now; empty while it is hidden
    everyone: false, // the Keeper's panel lists the players' investigators
    cardKey: "", // what the character panel last drew, so a flyout's change redraws it only when needed
    contentProvider: null,
    idleProvider: null,
    autoHide: null,
    active: false, // this client set the panel up: nothing is drawn on one that didn't
    selecting: false, // tokens were selected since the last redraw, so the panel may come forward
    messageClosed: false,
    hooks: null // { api, ids }: the hooks registerPanel installed, taken off by tearDown
  };
}

let state = freshState();

/** Takes off what an earlier registerPanel installed and sets the panel aside, so calling it again is safe. */
function tearDown() {
  const { hooks, panel, frame, autoHide } = state;
  for (const [name, id] of hooks?.ids ?? []) hooks.api.off(name, id);
  if (frame !== null) cancelAnimationFrame(frame);
  autoHide?.stop();
  panel?.place.destroy();
  panel?.root.remove();
  globalThis.removeEventListener?.("resize", onResize);
  globalThis.removeEventListener?.("keydown", onEscape, true);
  state = freshState();
}

function on(name, handler) {
  state.hooks.ids.push([name, Hooks.on(name, handler)]);
}

/**
 * Installs the panel's hooks on the Keeper's client, or a player's with the Player Rollbox on.
 * @returns {boolean} false when the panel does nothing on this client
 */
export function registerPanel() {
  tearDown();
  if (!game.user) return false;
  if (!(isKeeper() || playerRollboxOn()) || !readSetting("rollboxEnabled", true)) return false;
  state.active = true;
  state.hooks = { api: Hooks, ids: [] };
  resetAppearance();
  on("controlToken", scheduleRedraw);
  on("deleteToken", scheduleRedraw);
  on("createToken", scheduleRedraw);
  on("canvasReady", scheduleRedraw);
  on("canvasTearDown", onTearDown);
  on("renderPlayers", onPlayersRendered);
  on("updateActor", onActorUpdate);
  // An unlinked token's character changes with its token (its actor delta).
  on("updateToken", onTokenUpdate);
  on("deleteActor", scheduleRedraw);
  on("controlToken", noteSelection);
  // CoC7's status icons are active effects: adding or removing one doesn't update the actor.
  for (const hook of ["createActiveEffect", "updateActiveEffect", "deleteActiveEffect"]) {
    on(hook, (effect) => onActorUpdate(effectActor(effect)));
  }
  globalThis.addEventListener?.("resize", onResize);
  globalThis.addEventListener?.("keydown", onEscape, true);
  on("updateUser", onUserUpdate);
  scheduleRedraw();
  return true;
}

/**
 * Closes the open flyout on Escape when the personal setting is on, and stops Foundry acting on the same key.
 * @param {KeyboardEvent} event
 * @returns {boolean} true when it closed a flyout
 */
export function onEscape(event) {
  if (event?.key !== "Escape" || event.repeat || !state.panel?.host?.openId || picking()) return false;
  if (readSetting("rollboxEscapeClosesFlyout", true) === false) return false;
  const target = event.target;
  const typing = target?.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName);
  if (typing && !state.panel.root.contains(target)) return false;
  state.panel.host.close();
  event.preventDefault();
  event.stopImmediatePropagation();
  return true;
}

/** updateUser: a player's own character changed (their panel), or any player's (the Keeper's players list). */
function onUserUpdate(user) {
  if (isKeeper() || (user?.id !== undefined && user.id === game.user?.id)) scheduleRedraw();
}

function onPlayersRendered() {
  if (state.panel) state.panel.place.place();
  if (state.everyone) scheduleRedraw();
}

function playerActors() {
  const actor = ownCharacter(game.user);
  return actor ? [actor] : [];
}

/**
 * Lets another part draw the character panel instead of the panel's own content; null content falls back to it.
 * @param {(actors: Actor[], context: {onValue: Function}) => HTMLElement|null} provider
 * @param {{idleActors?: () => Actor[]}} [options] who the menu acts for with nothing selected
 * @returns {boolean} false for anything that isn't a function
 */
export function setPanelContent(provider, { idleActors } = {}) {
  if (typeof provider !== "function") return false;
  state.contentProvider = provider;
  state.idleProvider = typeof idleActors === "function" ? idleActors : null;
  if (state.panel && !state.panel.root.hidden) drawCard(true);
  scheduleRedraw(); // with nothing selected the panel may now show, acting for the idle characters
  return true;
}

/**
 * Puts the panel's own content back, at once if the panel is showing.
 * @returns {void}
 */
export function clearPanelContent() {
  if (!state.contentProvider) return;
  state.contentProvider = null;
  state.idleProvider = null;
  if (state.panel && !state.panel.root.hidden && state.shown.length) drawCard(true);
  scheduleRedraw();
}

function idleActors() {
  if (!state.contentProvider || !state.idleProvider) return [];
  try {
    return uniqueActors(state.idleProvider() ?? []);
  } catch (error) {
    warn("another part's idle characters failed.", error);
    return [];
  }
}

/** A click on a value of a sheet another part drew; a sheet of someone not selected says who to select. */
function onProvidedValue(event, value, right, actor) {
  if (state.shown.length === 1 && sameActor(state.shown[0], actor)) return onValue(event, value, right, actor);
  tellKeeper(`Rollbox: select ${actor?.name ?? "that character"} to roll for them.`);
}

function providedContent(actors) {
  if (!state.contentProvider) return null;
  try {
    const node = state.contentProvider(actors, { onValue: onProvidedValue });
    return node?.nodeType === 1 ? node : null;
  } catch (error) {
    warn("another part's character panel content failed; showing the character sheet instead.", error);
    return null;
  }
}

// One redraw per animation frame: a box-select fires one controlToken hook per token.
function scheduleRedraw() {
  if (!state.active || state.frame !== null) return;
  state.frame = requestAnimationFrame(redraw);
}

/**
 * Asks for a redraw of the panel; does nothing on a client without a panel.
 * @returns {void}
 */
export function refreshPanel() {
  scheduleRedraw();
}

// Action keeps its own lock while players are held, so a player's attack waiting for the Keeper stays in view.
const HOLD_KEEPS = Object.freeze(["action"]);
let playerHold = () => null;

/**
 * Sets what holds a player's whole menu but Action, e.g. the Keeper deciding a first blow.
 * @param {() => string|null} hold returns the reason shown, or null
 * @returns {void}
 */
export function setPlayerHold(hold) {
  playerHold = typeof hold === "function" ? hold : () => null;
}

function selectedActors() {
  if (!isKeeper()) return playerActors();
  try {
    return uniqueActors(Array.from(globalThis.canvas?.tokens?.controlled ?? [], (token) => token?.actor));
  } catch {
    return [];
  }
}

function showsPlayers() {
  return isKeeper() && readSetting("rollboxShowPlayers", true) !== false;
}

function redraw() {
  state.frame = null;
  const selected = selectedActors();
  let actors = selected.length ? selected : idleActors();
  if (!actors.length && !state.contentProvider && showsPlayers()) actors = investigators().map((entry) => entry.actor);
  const listing = !selected.length && !state.contentProvider && actors.length > 0;
  const noInvestigator = !isKeeper() && !actors.length && !state.messageClosed;
  if (!actors.length && !state.contentProvider && !listing && !noInvestigator) return hide();
  state.panel ??= buildPanel();
  if (!attach()) return hide();
  const changed = listing !== state.everyone || actors.length !== state.shown.length
    || actors.some((actor, i) => !sameActor(actor, state.shown[i]));
  state.shown = actors;
  state.everyone = listing;
  if (changed) state.autoHide.wake(); // a new selection shows the full card
  const block = isKeeper() ? null : playerBlock(actors[0]);
  const held = isKeeper() || block ? null : playerHold();
  state.panel.host.update(actors, isKeeper() ? undefined : playerMenu(),
    { everyone: listing, greyed: block ?? held, keep: held ? HOLD_KEEPS : [] });
  if (!drawCard(true)) return hide();
  state.panel.root.hidden = false;
  state.panel.place.redrawn(); // a new size places it again (watched): a floating panel is kept on screen
  if (state.selecting) bringForward();
}

/**
 * Draws the character panel for the shown characters; also the menu host's onCardChange.
 * @param {boolean} [force] draw even when nothing seems to have changed
 * @returns {boolean} false when there is nothing to draw
 */
function drawCard(force = false) {
  if (!state.panel) return false;
  const actors = state.shown;
  if (state.contentProvider) {
    if (!force && state.cardKey === PROVIDED) return true;
    const provided = providedContent(actors);
    if (provided) {
      state.cardKey = PROVIDED;
      state.panel.characterPanel.replaceChildren(provided);
      return true;
    }
    force = true;
  }
  if (state.everyone) {
    if (!force && state.cardKey === PLAYERS) return true;
    state.cardKey = PLAYERS;
    state.panel.characterPanel.replaceChildren(playersList(investigators(), { onPick: selectToken, onScene: hasToken }));
    return true;
  }
  if (!actors.length) {
    if (isKeeper() || state.messageClosed) return false;
    if (!force && state.cardKey === NO_ONE) return true;
    state.cardKey = NO_ONE;
    state.panel.characterPanel.replaceChildren(noInvestigatorCard());
    return true;
  }
  if (actors.length <= 2 && state.autoHide.compact) {
    if (!force && state.cardKey === COMPACT) return true;
    state.cardKey = COMPACT;
    state.panel.characterPanel.replaceChildren(characterCards(actors, null));
    return true;
  }
  if (actors.length <= 2) {
    if (!force && state.cardKey === "") return true;
    state.cardKey = "";
    state.panel.characterPanel.replaceChildren(actors.length === 1
      ? characterSheet(actors[0], { onValue: (event, value, right) => onValue(event, value, right, actors[0]),
        onDeselect: isKeeper() ? deselect : undefined })
      : pairSheet(actors, { onValue, onDeselect: deselect }));
    if (actors.length === 1) placeStatusCards(state.panel.characterPanel, actors[0]);
    return true;
  }
  const columns = state.panel.host.columns(actors);
  const key = JSON.stringify([actors.map((a) => a.uuid ?? a.name),
    (columns ?? []).map((col) => [col.label, actors.map((a) => safeValue(col, a))])]);
  if (!force && key === state.cardKey) return true;
  state.cardKey = key;
  const cards = characterCards(actors, columns, { onDeselect: deselect, onPick: selectOnly });
  // The invisible sheet behind the cards keeps them at least as tall as the one-character sheet.
  state.panel.characterPanel.replaceChildren(sheetGhost(actors[0]), cards);
  return true;
}

function noInvestigatorCard() {
  const card = element("section", "rollbox-card rollbox-no-investigator");
  card.setAttribute("aria-label", "No investigator assigned");
  const close = element("button", "rollbox-no-investigator-close");
  close.type = "button";
  close.setAttribute("aria-label", "Close");
  close.append(glyph("fa-xmark"));
  close.addEventListener("click", () => {
    state.messageClosed = true;
    scheduleRedraw();
  });
  card.append(element("p", "rollbox-no-investigator-text", NO_INVESTIGATOR), close);
  return card;
}

function hasToken(actor) {
  return tokensOf(actor).length > 0;
}

function tokensOf(actor) {
  try {
    return Array.from(actor?.getActiveTokens?.() ?? []);
  } catch {
    return [];
  }
}

function selectToken(actor) {
  const token = tokensOf(actor)[0];
  if (!token) return;
  try {
    token.control({ releaseOthers: true });
  } catch (error) {
    warn(`couldn't select ${actor?.name ?? "the investigator"}'s token.`, error);
  }
}

/**
 * Applies auto-hide's changed settings at once; does nothing before the panel is built.
 * @returns {void}
 */
export function applyAutoHide() {
  state.autoHide?.wake();
}

/**
 * Returns where the being-attacked alert goes on the panel, beside its menu.
 * @returns {HTMLElement|null} null while the panel isn't showing
 */
export function alertSlot() {
  return state.panel && !state.panel.root.hidden ? state.panel.alertSlot : null;
}

function deselect(actor) {
  const tokens = Array.from(globalThis.canvas?.tokens?.controlled ?? []).filter((token) => token?.actor === actor
    || (actor?.uuid && token?.actor?.uuid === actor.uuid));
  for (const token of tokens) {
    try {
      token.release();
    } catch (error) {
      warn(`couldn't deselect ${actor?.name ?? "the character"}'s token.`, error);
    }
  }
  scheduleRedraw();
}

function selectOnly(actor) {
  const mine = Array.from(globalThis.canvas?.tokens?.controlled ?? []).filter((token) => sameActor(token?.actor, actor));
  const [first, ...rest] = mine.length ? mine : tokensOf(actor).slice(0, 1);
  if (!first) return;
  try {
    first.control({ releaseOthers: true });
    for (const token of rest) token.control({ releaseOthers: false });
  } catch (error) {
    warn(`couldn't select ${actor?.name ?? "the character"}'s token.`, error);
  }
  scheduleRedraw();
}

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
  const characterPanel = document.createElement("div");
  characterPanel.className = "rollbox-character-panel";
  const side = document.createElement("div");
  side.className = "rollbox-side";
  root.append(characterPanel, side);
  const place = new PanelPlace(root, { movable: readSetting("rollboxMovable", false),
    spot: readSetting("rollboxOffset", undefined), menuSide: readSetting("rollboxMenuSide", undefined),
    layer: readSetting("rollboxPanelLayer", undefined), onWheelScale: stepScale, onScaleDone: saveScale });
  const built = { root, characterPanel, host: new MenuHost(side, () => { drawCard(); keepInView(); }), place,
    alertSlot: element("div", "rollbox-alert-slot") };
  side.append(built.alertSlot);
  place.watchSize([root, side, built.host.buttons, built.host.flyout]);
  state.autoHide = new AutoHide({ redraw: () => { drawCard(true); keepInView(); },
    visible: () => Boolean(state.panel && !state.panel.root.hidden) });
  state.autoHide.watch(root);
  stylePanel(root);
  return built;
}

// Already placed and watched, it is left alone, so a redraw reads no layout before it draws.
function attach() {
  if (!state.panel) return false;
  return state.panel.place.inPlace() || state.panel.place.place();
}

function onResize() {
  keepInView();
}

function keepInView() {
  if (state.panel && !state.panel.root.hidden) state.panel.place.place();
}

/**
 * Applies "Allow moving the panel"; off also forgets the dropped spot, even before the panel is built.
 * @param {boolean} movable
 * @returns {void}
 */
export function applyMovable(movable) {
  if (!(isKeeper() || playerRollboxOn())) return;
  if (state.panel) state.panel.place.setMovable(movable);
  if (!movable) forgetSpot();
}

/**
 * Forgets the dropped spot and puts the panel back beside the players list, even before the panel is built.
 * @returns {void}
 */
export function resetPosition() {
  if (!(isKeeper() || playerRollboxOn())) return;
  if (state.panel) state.panel.place.reset();
  forgetSpot();
}

/**
 * Applies the menu's side at once; does nothing before the panel is built.
 * @param {string} side "auto", "right" or "left"
 * @returns {void}
 */
export function applyMenuSide(side) {
  if (state.panel) state.panel.place.setMenuSide(side);
}

/**
 * Applies the Panel layer at once; does nothing before the panel is built.
 * @param {string} layer "bottom", "top", "active" or "activeOrSelected"
 * @returns {void}
 */
export function applyLayer(layer) {
  if (state.panel) state.panel.place.setLayer(layer);
}

function hide() {
  state.shown = [];
  state.everyone = false;
  state.autoHide?.stop();
  if (!state.panel) return;
  state.panel.root.hidden = true;
  state.panel.host.close();
}

// Foundry clears the selection on canvasTearDown without the controlToken hook.
function onTearDown() {
  if (state.frame !== null) cancelAnimationFrame(state.frame);
  state.frame = null;
  hide();
}

/** Opens the flyout a click on a sheet value asks for; the flyout that opens does any sending. */
function onValue(event, value, right, actor) {
  const how = howClicked(event, right);
  const action = fillsWaitingSide(value, how) ?? shortcut(value, how);
  if (!action || !state.panel || state.panel.host.greyed) return;
  if (!offersClick(action)) return; // a player only what the Keeper allows them (player/)
  if (action.opposed) {
    openOpposed(actor, action.opposed);
    return;
  }
  state.panel.host.open(action.open, action.start);
}

/** Shift + Left on a characteristic while the Opposed roll has a side waiting: fills that side. */
function fillsWaitingSide(value, { right, shift, ctrl, alt }) {
  if (right || !shift || ctrl || alt || value?.kind !== "characteristic" || !value.key) return null;
  if (!flyoutWaiting("opposed")) return null;
  return { opposed: { key: `characteristic:${value.key}`, create: true, first: false } };
}

function openOpposed(actor, { key, create = false, first = true }) {
  if (state.panel.host.open("opposed", flyoutStart("opposed", actor, key, { create, first }))) return;
  tellKeeper("Rollbox couldn't open the Opposed roll for this selection.");
}

function noteSelection(token, controlled) {
  if (controlled) state.selecting = true;
}

function bringForward() {
  state.selecting = false;
  if (forwardOnSelect(readSetting("rollboxPanelLayer", undefined))) state.panel.place.toFront();
}

function onActorUpdate(actor) {
  if (state.shown.some((other) => sameActor(other, actor))) scheduleRedraw();
}

/** A token update with only these keys is a move: nothing the panel draws depends on where a token stands. */
const MOVE_KEYS = Object.freeze(["_id", "x", "y"]);

function onTokenUpdate(token, changes) {
  const keys = Object.keys(changes ?? {});
  if (keys.length && keys.every((key) => MOVE_KEYS.includes(key))) return;
  onActorUpdate(token?.actor);
}

/** The character an active effect belongs to: its parent, or its item's owner. */
function effectActor(effect) {
  const parent = effect?.parent;
  return parent?.documentName === "Item" ? parent.parent ?? null : parent ?? null;
}
