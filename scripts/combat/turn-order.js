/**
 * The turn order drawn in the character panel during combat, built with textContent only so names never become HTML.
 * See docs/combat.md.
 */
import { PERSONAL, declareSettings, element, option, sameActor, warn } from "../utils.js";
import { characterSheet, meters, nameLine, ownerText, portrait, statusCards } from "../panel/index.js";
import { ownCharacter } from "../player/index.js";
import { currentCombatant, isCombatantOf, roundOf, turnsOf, viewedCombat } from "./encounter.js";
import { hasGun } from "./readied-firearms.js";
import { noteMarks } from "./round-notes.js";
import { actsButton, delayPreview, rejoinButton, turnControls } from "./turn-controls.js";
import { actsNextRound, actsThisRound, standingBy } from "./fight-state.js";
import { addFighters } from "./fight-changes.js";
import { isDefeated } from "./defeated.js";
import { selectionChanged } from "./own-target.js";
import { pickCombatant, pickedCombatant } from "./turn-pick.js";
import { targetOnly, tokenFor } from "../shared/index.js";

/**
 * Declares the Turn order and turn controls switch and the Keeper's selection and click settings.
 * @type {object[]}
 */
export const SETTINGS = declareSettings([
  { key: "rollboxCombatPanel", scope: "user", type: Boolean, default: true, section: "turnOrder",
    label: "Turn order and turn controls",
    hint: "Combat runs in the panel: the turn order, Delay, Flee, End turn. Off: during combat the panel works as it "
      + "does out of combat (the selected token's card and its flyouts), and Foundry's combat tracker runs the turns.",
    note: PERSONAL, onChange: () => redrawPanel?.() },
  { key: "rollboxTurnSelection", scope: "user", type: String, default: "select", section: "turnOrder",
    label: "At each new turn",
    choices: { select: "Select the current turn's token", keep: "Keep my selection" },
    hint: "Select: Rollbox selects the token whose turn it is, so the panel shows them (a token with vision shows you "
      + "its view, as clicking it would). Keep: Rollbox never changes what you have selected; the panel follows the "
      + "turn only while nothing is selected.",
    note: PERSONAL, keeperOnly: true },
  { key: "rollboxTurnOrderClick", scope: "user", type: String, default: "select", section: "turnOrder",
    label: "Left click in the turn order",
    choices: { select: "Selects", target: "Targets" },
    hint: "The Keeper's left click on a turn-order row. Select: act for that character. Target: make them your "
      + "Foundry target. A right click on a character anywhere in Rollbox always targets them. While Rollbox waits for "
      + "a target, a left click always targets. A player's click always targets.",
    note: PERSONAL, keeperOnly: true }
]);

/**
 * Tells whether the Keeper's map selection follows the turn.
 * @returns {boolean}
 */
export const selectsTurn = () => option("rollboxTurnSelection") !== "keep";

/**
 * Tells whether the panel shows the turn order during combat.
 * @returns {boolean}
 */
export const combatPanelOn = () => option("rollboxCombatPanel") !== false;

const NOTE_TEXT = Object.freeze({
  aiming: "Aiming", dived: "Dived for cover", acted: "Acted", delayed: "Delayed", fled: "Fled",
  stood: "Stood their ground"
});
const READIED_TEXT = "Readied firearm";
const CURRENT_CLASS = "rollbox-turn-current";
const PICKED_CLASS = "rollbox-turn-picked";
const DONE_CLASS = "rollbox-turn-done";
const STANDBY_CLASS = "rollbox-turn-standby";
const COMPACT_CLASS = "rollbox-turn-compact";
const STANDING_LIST = "rollbox-turn-standing-list";

function standingText(combatant) {
  if (!standingBy(combatant)) return "";
  if (actsThisRound(combatant, combatant.parent)) return "Standing by · acts this round";
  return actsNextRound(combatant, combatant.parent) ? "Standing by · acts next round" : "Standing by";
}

let redrawPanel;


function dexOf(combatant) {
  const value = Number(combatant?.actor?.system?.characteristics?.dex?.value);
  return Number.isFinite(value) ? value : -Infinity;
}

/**
 * Lists the encounter's characters in Foundry's order, never rotated, with those standing by last by DEX.
 * @param {Combat|null} combat
 * @returns {{actor: Actor, token: TokenDocument|null, current: boolean, done: boolean, standing: boolean,
 *   combatant: Combatant}[]} `done`: their turn has passed this round; `standing`: in the standing-by group
 */
export function turnOrder(combat) {
  const turns = turnsOf(combat);
  const current = currentCombatant(combat);
  const index = turns.indexOf(current);
  const listed = turns.filter((combatant) => combatant.actor);
  const back = (combatant) => standingBy(combatant) !== null;
  const standing = listed.filter(back)
    .sort((a, b) => (dexOf(b) - dexOf(a)) || (turns.indexOf(a) - turns.indexOf(b)));
  return [...listed.filter((combatant) => !back(combatant)), ...standing]
    .map((combatant) => ({ actor: combatant.actor, token: combatant.token ?? null, current: combatant === current,
      done: index > 0 && turns.indexOf(combatant) < index, standing: back(combatant), combatant }));
}

function previewDelay(fighters, places) {
  const from = fighters.findIndex((entry) => entry.current);
  if (!places || from < 0) return fighters;
  const rest = fighters.filter((_, i) => i !== from);
  const to = Math.min(rest.length, from + places);
  return [...rest.slice(0, to), fighters[from], ...rest.slice(to)];
}

function visibleTo(entry, user) {
  return user?.isGM === true || entry.combatant?.hidden !== true;
}

function rowSub(entry, { currentText = false } = {}) {
  const owner = ownerText(entry.actor);
  const parts = currentText && entry.current ? [owner, "current turn"] : [owner];
  if (hasGun(entry.combatant)) parts.push(READIED_TEXT);
  if (isDefeated(entry.combatant)) parts.push("Defeated");
  parts.push(...noteMarks(entry.actor).map((mark) => NOTE_TEXT[mark]));
  return parts.filter(Boolean).join(" · ");
}

function turnRow(entry, { onClick, picked: isPicked = false, currentText = false, bars = false } = {}) {
  const row = element("li", "rollbox-character-card rollbox-turn-row-card");
  if (entry.combatant?.id) row.dataset.combatant = entry.combatant.id;
  if (entry.current) row.classList.add(CURRENT_CLASS);
  else if (isPicked) row.classList.add(PICKED_CLASS);
  if (entry.done) row.classList.add(DONE_CLASS);
  const standing = standingText(entry.combatant);
  if (standing) {

    row.classList.add(STANDBY_CLASS, COMPACT_CLASS);
    const rest = rowSub(entry, { currentText });
    const name = nameLine(entry.actor);
    name.title = [entry.actor.name ?? "", standing, rest].filter(Boolean).join(" · ");
    row.append(name);
  } else {
    const who = element("div", "rollbox-who");
    const sub = element("div", "rollbox-sub");
    sub.append(rowSub(entry, { currentText }));
    who.append(nameLine(entry.actor), sub);
    row.append(portrait(entry.actor, "rollbox-portrait-small"), who, ...(bars ? [meters(entry.actor)] : []));
  }
  if (typeof onClick === "function") {
    row.tabIndex = 0;
    row.addEventListener("click", () => onClick(entry));
    row.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      onClick(entry, { right: true });
    });
    row.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      onClick(entry);
    });
  }
  return row;
}

function rowsCard(entries, rowOptions = () => ({}), { standing = false, title = "" } = {}) {
  if (!entries.length) return [];
  const card = element("section", "rollbox-card rollbox-cards rollbox-turn-rows");
  card.setAttribute("aria-label", standing ? "Standing by" : "Turn order");
  if (standing) card.classList.add("rollbox-turn-standing");
  if (title) {
    card.classList.add("rollbox-turn-standing-first");
    card.append(element("div", "rollbox-turn-standing-title", title));
  }
  const list = element("ol", "rollbox-cards-list");
  if (standing) list.classList.add(STANDING_LIST);
  list.append(...entries.map((entry) => turnRow(entry, rowOptions(entry))));
  card.append(list);
  return [card];
}

// The panel is drawn anew on every change: without this a redraw would jump each list back to its top.
const standingScroll = { tops: [], shown: null };

function scrollIntoList(list, row) {
  const box = list.getBoundingClientRect();
  const own = row.getBoundingClientRect();
  if (own.top < box.top) list.scrollTop -= box.top - own.top;
  else if (own.bottom > box.bottom) list.scrollTop += own.bottom - box.bottom;
}

// Runs on the next tick, since scrolling needs the list's layout; a row is brought into view only when it changes.
function followStanding(root) {
  const lists = [...root.querySelectorAll(`.${STANDING_LIST}`)];
  if (!lists.length) {
    standingScroll.shown = null;
    return;
  }
  setTimeout(() => {
    if (!lists[0].isConnected) return;
    lists.forEach((list, index) => {
      list.scrollTop = standingScroll.tops[index] ?? 0;
      list.addEventListener("scroll", () => {
        standingScroll.tops[index] = list.scrollTop;
      });
    });
    const find = (name) => lists.map((list) => list.querySelector(`.${name}`)).find(Boolean) ?? null;
    const row = find(PICKED_CLASS) ?? find(CURRENT_CLASS);
    const id = row?.dataset.combatant ?? null;
    if (row && id !== standingScroll.shown) scrollIntoList(row.closest(`.${STANDING_LIST}`), row);
    standingScroll.shown = id;
  }, 0);
}

function groupNodes(entries, sheetFor, sheet, rowOptions, { standing = false } = {}) {
  const nodes = [];
  let run = [];
  let titled = !standing;
  const flush = () => {
    nodes.push(...rowsCard(run, rowOptions, { standing, title: titled || !run.length ? "" : "Standing by" }));
    if (run.length) titled = true;
    run = [];
  };
  for (const entry of entries) {
    if (!sheetFor(entry)) {
      run.push(entry);
      continue;
    }
    if (!titled && !run.length) {
      nodes.push(element("div", "rollbox-turn-standing-title rollbox-turn-standing-heading", "Standing by"));
      titled = true;
    }
    flush();
    nodes.push(...sheet(entry));
  }
  flush();
  return nodes;
}

function fullSheet(entry, onValue, { note = true, picked: isPicked = false } = {}) {
  const nodes = [];
  const statuses = statusCards(entry.actor);
  if (statuses?.nodeType === 1) nodes.push(statuses);
  const sheet = typeof onValue === "function"
    ? characterSheet(entry.actor, { onValue: (event, value, right) => onValue(event, value, right, entry.actor) })
    : characterSheet(entry.actor);
  sheet.classList.add("rollbox-turn-sheet");
  if (entry.current) sheet.classList.add(CURRENT_CLASS);
  else if (isPicked) sheet.classList.add(PICKED_CLASS);
  const standing = standingText(entry.combatant);
  if (standing) {
    sheet.classList.add(STANDBY_CLASS);
    if (note) {
      const line = element("section", "rollbox-card rollbox-turn-standby-note");
      line.append(element("span", "rollbox-turn-standby-text", standing));
      nodes.push(line);
    }
  }
  nodes.push(sheet);
  return nodes;
}

function standingBox(entry, combat, onChange) {
  const box = element("section", "rollbox-card rollbox-turn-standby-box");
  const buttons = element("div", "rollbox-turn-row rollbox-turn-standby-buttons");
  if (entry.current) {
    box.append(element("b", "rollbox-turn-standby-title", "Your turn"),
      element("span", "rollbox-turn-standby-line", "Back on standby after this turn."));
  } else {
    const next = actsNextRound(entry.combatant, combat);
    const acts = next || actsThisRound(entry.combatant, combat);
    box.append(element("b", "rollbox-turn-standby-title", "Standing by"),
      element("span", "rollbox-turn-standby-line",
        acts ? `You act on your turn ${next ? "next" : "this"} round.` : "Your turn is skipped."));
    buttons.append(actsButton(entry.combatant, combat, onChange));
  }
  buttons.append(rejoinButton(entry.combatant, onChange));
  box.append(buttons);
  return box;
}

function outsideCards(actors, onValue, onAdd) {
  const entries = actors.map((actor) => ({ actor, token: null, current: false, done: false, combatant: null }));
  const nodes = [element("div", "rollbox-turn-outside-label", "Not in combat")];
  nodes.push(...fullSheet(entries[0], onValue), ...rowsCard(entries.slice(1)));
  const add = element("button", "rollbox-turn-add", "Add to combat ↓");
  add.type = "button";
  add.addEventListener("click", async () => {
    add.disabled = true;
    await onAdd?.(actors);
  });
  nodes.push(add);
  return nodes;
}

/**
 * Builds the turn order for this user, with the turn controls under it.
 * @param {{combat: Combat|null, user: User, own?: Actor|null, focus?: Actor[], onChange?: () => void,
 *   onValue?: (event: Event, value: object, right: boolean, actor: Actor) => void,
 *   onRow?: (entry: object) => void, onAdd?: (actors: Actor[]) => void}} context `own`: the player's character;
 *   `focus`: whom the Keeper's panel acts for, the first in the encounter drawn as the full card
 * @returns {HTMLElement|null} null with no running encounter or no one to show
 */
export function buildTurnOrder({ combat, user, own = null, focus = [], onChange, onValue, onRow, onAdd } = {}) {
  if (!combat?.started) return null;
  const order = turnOrder(combat).filter((entry) => visibleTo(entry, user));
  if (!order.length) return null;
  const root = element("div", "rollbox-turn-order");
  const keeper = user?.isGM === true;
  const header = element("section", "rollbox-card rollbox-turn-header");
  header.append(element("span", "rollbox-turn-title", `Combat · Round ${roundOf(combat)}`));

  const focused = keeper ? Array.from(focus ?? []).filter(Boolean) : [];
  const inOrder = (actor) => order.some((entry) => isCombatantOf(entry.combatant, actor));
  const outside = focused.filter((actor) => !inOrder(actor));
  if (outside.length) root.append(...outsideCards(outside, onValue, onAdd));
  root.append(header);

  const mine = keeper ? null : order.find((entry) => Boolean(own) && isCombatantOf(entry.combatant, own)) ?? null;
  // A player standing by: their sheet and the box on top, their own row in the order.
  if (mine && standingBy(mine.combatant)) {
    root.prepend(...fullSheet(mine, onValue, { note: false }), standingBox(mine, combat, onChange));
  }
  const chosen = order.filter((entry) => focused.some((actor) => isCombatantOf(entry.combatant, actor)));
  // The Keeper's full card: the first selected combatant; with nobody selected at all, the current turn's.
  const full = keeper ? chosen[0] ?? (focused.length ? null : order.find((entry) => entry.current) ?? null) : null;
  const sheetFor = keeper ? (entry) => entry === full : (entry) => entry === mine && !standingBy(entry.combatant);
  // The meters on the Keeper's rows only: a player's own character is never a full row (it is their sheet, or a
  // standing-by name), and they see no one else's.
  const rowOptions = (entry) => ({ onClick: onRow, picked: chosen.includes(entry), currentText: keeper, bars: keeper });
  // Delay's arrows show the acting character's new place live, while the controls act for them.
  const fighters = order.filter((entry) => !entry.standing);
  const shown = !keeper || !full || full.current ? previewDelay(fighters, delayPreview(combat)) : fighters;
  const sheet = (entry) => fullSheet(entry, onValue, { picked: keeper });
  root.append(...groupNodes(shown, sheetFor, sheet, rowOptions),
    element("div", "rollbox-turn-round-end", `End of round ${roundOf(combat)}`),
    ...groupNodes(order.filter((entry) => entry.standing), sheetFor, sheet, rowOptions, { standing: true }));
  const controls = turnControls({ combat, user, onChange, outside: keeper && !full,
    selected: keeper ? full?.combatant ?? null : null });
  if (controls) root.append(controls);
  // A player whose character isn't in the encounter (fled, or never joined) keeps their own sheet under the order.
  if (!keeper && own && !mine) {
    const self = { actor: own, token: null, current: false, done: false, combatant: null };
    root.append(element("div", "rollbox-turn-outside-label", "Not in combat"), ...fullSheet(self, onValue));
  }
  followStanding(root);
  return root;
}

function targeting() {
  try {
    return globalThis.ui?.controls?.tool?.name === "target";
  } catch {
    return false;
  }
}

function targetEntry(entry) {
  return targetOnly(entry.combatant?.token?.object ?? tokenFor(entry.actor));
}

function releaseSelection() {
  try {
    globalThis.canvas?.tokens?.releaseAll?.();
  } catch (error) {
    warn("couldn't release the selected tokens.", error);
  }
}

function keeperClick(right) {
  if (right || targeting()) return "target";
  return option("rollboxTurnOrderClick") === "target" ? "target" : "select";
}

/**
 * Targets or, for the Keeper's left click, selects the combatant of a clicked row.
 * @param {object} entry the row's turn-order entry
 * @param {User} user
 * @param {Combat} combat
 * @param {{right?: boolean}} [how] `right`: a right click
 * @returns {"target"|"pick"|null}
 */
export function rowClicked(entry, user, combat = viewedCombat(), { right = false } = {}) {
  if (user?.isGM !== true) return targetEntry(entry) ? "target" : null;
  if (keeperClick(right) === "target") return targetEntry(entry) ? "target" : null;
  if (!combat) return null;
  releaseSelection();
  pickCombatant(entry.current ? null : entry.combatant, combat);
  selectionChanged(); // the Keeper now acts for the pick: their remembered target follows (own-target.js)
  redrawPanel?.();
  return "pick";
}

async function addOutside(actors, combat) {
  let tokens = [];
  try {
    tokens = Array.from(globalThis.canvas?.tokens?.controlled ?? [])
      .filter((token) => actors.some((actor) => sameActor(token?.actor, actor)));
  } catch {
    tokens = [];
  }
  if (tokens.length) await addFighters(combat, tokens);
  redrawPanel?.();
}

/**
 * Draws the panel's content while combat runs: the whole turn order, the full card for whom the panel acts for.
 * @param {Actor[]} actors the characters the panel acts for
 * @param {{onValue?: Function}} [context] the panel's handler for clicks on a sheet's values
 * @returns {HTMLElement|null} the turn order, or null to let the panel draw its own content
 */
export function turnOrderContent(actors, { onValue } = {}) {
  const combat = viewedCombat();
  const user = globalThis.game?.user ?? null;
  if (!combat || !user) return null;
  const own = user.isGM ? null : ownCharacter(user);
  return buildTurnOrder({ combat, user, own, focus: actors, onChange: redrawPanel, onValue,
    onRow: (entry, how) => rowClicked(entry, user, combat, how), onAdd: (list) => addOutside(list, combat) });
}

/**
 * Sets how the turn order redraws the panel when its controls change.
 * @param {() => void} redraw
 * @returns {void}
 */
export function setTurnOrderRedraw(redraw) {
  redrawPanel = typeof redraw === "function" ? redraw : undefined;
}
