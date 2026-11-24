/** DOM helpers and the Send flow every flyout but the alert uses; text only, never HTML. See docs/flyouts.md. */
import { NO_VALUE, element, sameActor, warn } from "../utils.js";
import { comparable } from "../skill-values/index.js";
import { DIFFICULTIES, MAX_DICE, ownersOf } from "../roll-requests/index.js";
import { blindToggle, button, glyphButton, statusLine, withBlind } from "../shared/index.js";

/** Display names of the difficulties, keyed by roll-requests' DIFFICULTIES. */
export const DIFFICULTY_LABELS = Object.freeze({ regular: "Regular", hard: "Hard", extreme: "Extreme", hidden: "Hidden" });

export { button, glyphButton };

/**
 * Returns a text box with a placeholder and an aria-label, and no visible label.
 * @param {string} className
 * @param {string} placeholder
 * @param {string} ariaLabel
 * @returns {HTMLInputElement}
 */
export function textInput(className, placeholder, ariaLabel) {
  const node = element("input", `rollbox-input ${className}`.trim());
  node.type = "text";
  node.placeholder = placeholder;
  node.setAttribute("aria-label", ariaLabel);
  return node;
}

/** Tabs of the Check flyout and of each Opposed side; their rows come from skill-values' checkChoices(). */
export const CHECK_TABS = Object.freeze([
  { id: "characteristic", label: "Characteristic" },
  { id: "skill", label: "Skill" }
]);

/**
 * Builds a tab bar with one role="tab" button per tab; `select(id)` sets aria-selected on the open one.
 * @param {{id: string, label: string}[]} tabs
 * @param {{className: string, tabClass: string, key?: string, onPick: (id: string) => void,
 *   disabled?: (id: string) => boolean}} options `key` is the dataset key holding each tab's id
 * @returns {{element: HTMLElement, buttons: HTMLButtonElement[], select: (id: string) => void}}
 */
export function tabBar(tabs, { className, tabClass, key = "tab", onPick, disabled = () => false }) {
  const bar = element("div", className);
  bar.setAttribute("role", "tablist");
  const buttons = tabs.map(({ id, label }) => {
    const node = button(`rollbox-btn rollbox-tab ${tabClass}`, label, () => onPick(id));
    node.dataset[key] = id;
    node.setAttribute("role", "tab");
    node.disabled = disabled(id) === true;
    return node;
  });
  bar.append(...buttons);
  const select = (id) => {
    for (const node of buttons) node.setAttribute("aria-selected", String(node.dataset[key] === id));
  };
  return { element: bar, buttons, select };
}

/**
 * Returns the skill search box, calling `onInput` on each keystroke.
 * @param {{className?: string, label?: string, value?: string, onInput: (text: string) => void}} options
 * @returns {HTMLInputElement}
 */
export function searchBox({ className = "", label = "Search skills", value = "", onInput }) {
  const node = element("input", `rollbox-input ${className}`.trim());
  node.type = "search";
  node.placeholder = "Search skills";
  node.setAttribute("aria-label", label);
  node.value = value;
  node.addEventListener("input", () => onInput(node.value));
  return node;
}

/**
 * Hides each row whose name doesn't hold the text (accents and case ignored), and the divider while searching.
 * @param {{node: HTMLElement, name: string}[]} rows
 * @param {string} text
 * @param {HTMLElement|null} [divider]
 * @returns {number} how many rows still show
 */
export function filterRows(rows, text, divider = null) {
  const wanted = comparable(text);
  let shown = 0;
  for (const { node, name } of rows) {
    node.hidden = Boolean(wanted) && !comparable(name).includes(wanted);
    if (!node.hidden) shown += 1;
  }
  if (divider) divider.hidden = Boolean(wanted);
  return shown;
}

/**
 * Returns the Regular, Hard and Extreme values as one text, or NO_VALUE without a value.
 * @param {{value: number|null, half?: number, fifth?: number}|null} row
 * @returns {string}
 */
export function levels(row) {
  return row?.value === null || row?.value === undefined ? NO_VALUE : `${row.value} · ${row.half} · ${row.fifth}`;
}

/**
 * Returns levels() as separate spans, so a theme can restyle the separators with CSS alone.
 * @param {{value: number|null, half?: number, fifth?: number}|null} row
 * @returns {Node[]} the spans, or one NO_VALUE text node without a value
 */
export function levelParts(row) {
  if (row?.value === null || row?.value === undefined) return [document.createTextNode(NO_VALUE)];
  const separator = () => element("span", "rollbox-level-sep", " · ");
  return [element("span", "rollbox-level", String(row.value)), separator(),
    element("span", "rollbox-level rollbox-level-half", String(row.half)), separator(),
    element("span", "rollbox-level rollbox-level-fifth", String(row.fifth))];
}

/**
 * Returns a span with this class holding levelParts(row).
 * @param {string} className
 * @param {{value: number|null, half?: number, fifth?: number}|null} row
 * @returns {HTMLElement}
 */
export function levelsNode(className, row) {
  const node = element("span", className);
  node.append(...levelParts(row));
  return node;
}

/**
 * Returns the dice in words, or "" with none.
 * @param {number} dice positive for bonus, negative for penalty
 * @returns {string}
 */
export function diceText(dice) {
  if (!dice) return "";
  const n = Math.abs(dice);
  return `${n} ${dice > 0 ? "bonus" : "penalty"} ${n === 1 ? "die" : "dice"}`;
}

/**
 * Returns the [value, label] choices from −MAX_DICE to +MAX_DICE.
 * @returns {[string, string][]}
 */
export function diceChoices() {
  const choices = [];
  for (let n = -MAX_DICE; n <= MAX_DICE; n++) choices.push([String(n), n === 0 ? "None" : (n > 0 ? `+${n}` : `−${-n}`)]);
  return choices;
}

/**
 * Builds a row of buttons where one is pressed; `sync()` marks the pressed one.
 * @param {{choices: [string, string][], get: () => string, set: (value: string) => void, label?: string}} options
 *   `choices` are [value, label] pairs; `label` names the group for screen readers
 * @returns {{element: HTMLElement, buttons: HTMLButtonElement[], sync: () => void}}
 */
export function segmented({ choices, get, set, label }) {
  const group = element("div", "rollbox-segmented");
  group.setAttribute("role", "group");
  if (label) group.setAttribute("aria-label", label);
  const buttons = choices.map(([value, text]) => {
    const node = button("rollbox-btn rollbox-segment", text, () => set(value));
    node.dataset.value = value;
    return node;
  });
  group.append(...buttons);
  const sync = () => {
    const now = get();
    for (const node of buttons) node.setAttribute("aria-pressed", String(node.dataset.value === now));
  };
  return { element: group, buttons, sync };
}

/**
 * Returns a labelled row: the label, then its controls.
 * @param {string} label
 * @param {...Node} children
 * @returns {HTMLElement}
 */
export function line(label, ...children) {
  const row = element("div", "rollbox-line");
  row.append(element("span", "rollbox-line-label", label), ...children);
  return row;
}

const DICE_LABEL = "± Dice";
const DICE_TIP = "Bonus (+) or penalty (−) dice";

/**
 * Returns the bonus and penalty dice row around a dice control, its label carrying the hover text.
 * @param {...Node} children
 * @returns {HTMLElement}
 */
export function diceLine(...children) {
  const row = line(DICE_LABEL, ...children);
  row.querySelector(".rollbox-line-label").title = DICE_TIP;
  return row;
}

/**
 * Builds the Difficulty and dice rows with the Blind toggle beside them; mutates `state` on each click.
 * @param {{difficulty: string, dice: number, blind: boolean}} state
 * @param {() => void} onChange
 * @param {{own?: boolean}} [options] `own`: a player's own check, which has no rows (an empty, hidden element)
 * @returns {{element: HTMLElement, sync: () => void, blind: {on: boolean, disabled: boolean}}}
 */
export function howRows(state, onChange, { own = false } = {}) {
  const difficulty = segmented({ choices: DIFFICULTIES.map((d) => [d, DIFFICULTY_LABELS[d]]),
    get: () => state.difficulty, set: (value) => { state.difficulty = value; onChange(); } });
  const dice = segmented({ choices: diceChoices(), get: () => String(state.dice),
    set: (value) => { state.dice = Number(value); onChange(); } });
  const blind = blindToggle({ onChange: (on) => { state.blind = on; onChange(); } });
  const rows = [line("Difficulty", difficulty.element), diceLine(dice.element)];
  return {
    element: own ? ownHow() : withBlind(rows, blind),
    blind,
    sync: () => { difficulty.sync(); dice.sync(); }
  };
}

// An empty, hidden placeholder keeps the flyouts' layout code the same for a player's own check.
function ownHow() {
  const root = element("div", "rollbox-how");
  root.hidden = true;
  return root;
}

/**
 * Runs one Send: ignores a second click while it runs, never throws, and redraws before and after.
 * @param {{sending: boolean, update: () => void}} menu mutated: `sending` is set while it runs
 * @param {() => Promise<object>} work
 * @param {(result: object|null) => void} show gets null when `work` threw
 * @returns {Promise<void>}
 */
export async function runSend(menu, work, show) {
  if (menu.sending) return;
  menu.sending = true;
  menu.update();
  let result = null;
  try {
    result = await work();
  } catch (error) {
    warn("a request failed.", error);
  }
  menu.sending = false;
  show(result);
  menu.update();
}

/**
 * Returns the send button's words, naming who the request goes to; the words never change who that is.
 * @param {Actor[]} actors
 * @param {{everyone?: boolean}} [options] `everyone`: nothing is selected, so the actors are every investigator
 * @returns {string}
 */
export function sendLabel(actors, { everyone = false } = {}) {
  if (everyone) return "Send to all players";
  const list = Array.from(actors ?? []);
  if (list.length > 1) {
    return list.every((actor) => ownersOf(actor)?.length === 0) ? "Roll for NPCs" : `Send to each (${list.length})`;
  }
  const name = list[0]?.name ?? "player";
  const owners = list.length ? ownersOf(list[0]) : null;
  if (owners?.length === 0) return `Roll for ${name}`;
  const assigned = assignedPlayer(list[0]);
  const players = (assigned ? [assigned] : owners ?? []).map((user) => user?.name).filter(Boolean);
  return players.length ? `Send to ${players.join(", ")} (${name})` : `Send to ${name}`;
}

/** Returns the non-GM user whose assigned character is this actor, or null. */
function assignedPlayer(actor) {
  try {
    return Array.from(globalThis.game?.users ?? []).find((user) => user && !user.isGM && sameActor(user.character, actor))
      ?? null;
  } catch {
    return null;
  }
}

/**
 * Returns the line under a flyout's title naming who it is for, or the every-investigator note.
 * @param {Actor[]} actors
 * @param {{everyone?: boolean, className?: string}} [options]
 * @returns {HTMLElement}
 */
export function whoLine(actors, { everyone = false, className = "rollbox-flyout-who" } = {}) {
  if (everyone) {
    const note = element("div", `${className} rollbox-everyone-note`);
    note.append(element("p", "", "No one selected: this goes to every investigator."),
      element("p", "", "Select tokens to choose who."));
    return note;
  }
  const who = element("p", className, Array.from(actors ?? []).map((actor) => actor?.name ?? "").join(", "));
  who.title = who.textContent;
  return who;
}

/**
 * Returns a send result with nothing sent, in the shape roll-requests' send returns.
 * @returns {{requested: Actor[], rolled: Actor[], skipped: {actor: Actor|null, reason: string}[], unavailable: boolean}}
 */
export const noneSent = () => ({ requested: [], rolled: [], skipped: [], unavailable: false });

/**
 * Returns the key a flyout row's `data-actor` holds: the character's uuid, else its name.
 * @param {Actor} actor
 * @returns {string}
 */
export const actorTag = (actor) => actor?.uuid ?? actor?.name ?? "";

/** showResult's words for a player's own check, which CoC7 has already rolled or carded in chat. */
export const OWN_RESULT = Object.freeze({ heading: "CoC7's check, in chat:", name: (actor) => actor?.name ?? "?" });

function resultArea() {
  const node = element("div", "rollbox-result");
  node.setAttribute("aria-live", "polite");
  return node;
}

/**
 * Builds a flyout's send section; `ready()` greys the buttons while something is missing or a send runs.
 * @param {HTMLButtonElement[]} buttons one with `data-keep` is never greyed out
 * @param {{statusClass?: string, status?: object}} [options] `status`: a statusLine shown elsewhere, left out here
 * @returns {{element: HTMLElement, status: object, result: HTMLElement,
 *   ready: (missing: string|null, sending: boolean) => void}}
 */
export function sendSection(buttons, { statusClass = "", status = null } = {}) {
  const line = status ?? statusLine(statusClass);
  const row = element("div", "rollbox-actions");
  row.append(...buttons);
  const result = resultArea();
  const root = element("div", "rollbox-section");
  root.append(...(status ? [] : [line.element]), row, result);
  return {
    element: root,
    status: line,
    result,
    ready(missing, sending) {
      for (const node of buttons) if (!("keep" in node.dataset)) node.disabled = Boolean(missing) || sending;
      if (missing) line.missing(missing);
      else line.clear();
    }
  };
}

function resultGroup(heading, lines) {
  const group = element("div", "rollbox-result-group");
  group.append(element("div", "rollbox-result-heading", heading), ...lines.map((text) => element("div", "rollbox-result-line", text)));
  return group;
}

/** Returns the character's name with its player owners in brackets. */
function askedName(actor) {
  const players = (ownersOf(actor) ?? []).map((user) => user.name).filter(Boolean);
  return players.length ? `${actor?.name ?? "?"} (${players.join(", ")})` : (actor?.name ?? "?");
}

/**
 * Draws what send() did into the result area: a heading per group, one name per line, then `notes`.
 * @param {HTMLElement} area
 * @param {object|null} result send()'s result, or null when it threw
 * @param {{what?: string, heading?: string, name?: (actor: Actor) => string, notes?: string[]}} [words]
 *   `heading` and `name` replace the sent-to group's heading and lines
 * @returns {void}
 */
export function showResult(area, result, { what = "Request", heading, name, notes = [] } = {}) {
  const say = (text) => area.replaceChildren(element("div", "rollbox-result-line", text));
  if (!result) return say("Something went wrong; see the console (F12).");
  if (result.unavailable) return say("CoC7's roll links aren't available; nothing was sent.");
  const groups = [];
  if (result.requested.length) {
    groups.push(resultGroup(heading ?? `${what} sent to:`, result.requested.map(name ?? askedName)));
  }
  if (result.rolled.length) groups.push(resultGroup("Rolled for you:", result.rolled.map((actor) => actor?.name ?? "?")));
  if (result.skipped.length) {
    groups.push(resultGroup("Not sent:", result.skipped.map(({ actor, reason }) => (actor ? `${actor.name}: ${reason}` : reason))));
  }
  if (!groups.length && !notes.length) return say("Nothing was sent.");
  area.replaceChildren(...groups, ...notes.map((text) => element("div", "rollbox-result-line", text)));
}
