/**
 * Menu helpers every menu uses (Check, Sanity, Other, Opposed, Assist): buttons, a row of buttons where one is
 * pressed, the check tabs and their skill search, the Difficulty / Dice / Blind rows, the "60 · 30 · 12" values,
 * the main send button's words, and the Send flow with its result lines. Built with textContent only, so names typed by anyone never become HTML. Their look is shared.css's
 * generic classes (`rollbox-btn`, `rollbox-segment`, `rollbox-line`, `rollbox-input`, …).
 */
import { NO_VALUE, element, warn } from "../utils.js";
import { comparable } from "../skill-values/index.js";
import { DIFFICULTIES, MAX_DICE, ownersOf } from "../roll-requests/index.js";
import { blindToggle, withBlind } from "./blind-toggle.js";
import { statusLine } from "./status-line.js";

/** How the menus name a difficulty. */
export const DIFFICULTY_LABELS = Object.freeze({ regular: "Regular", hard: "Hard", extreme: "Extreme", hidden: "Hidden" });

/** A button that never submits anything. */
export function button(className, text, onClick) {
  const node = element("button", className, text);
  node.type = "button";
  node.addEventListener("click", onClick);
  return node;
}

/** A text box with a placeholder (no label of its own: placeholders only, DESIGN "How every menu is laid out"). */
export function textInput(className, placeholder, ariaLabel) {
  const node = element("input", `rollbox-input ${className}`.trim());
  node.type = "text";
  node.placeholder = placeholder;
  node.setAttribute("aria-label", ariaLabel);
  return node;
}

/**
 * The two tabs of the Check menu and of each Opposed side; their rows are skill-values' checkChoices(). No Attribute
 * tab (Void, 2026-11-15): Luck is the Other menu's, Sanity has its own, Idea and Know are INT and EDU checks.
 */
export const CHECK_TABS = Object.freeze([
  { id: "characteristic", label: "Characteristic" },
  { id: "skill", label: "Skill" }
]);

/**
 * The skill search of the Check menu and the Opposed view: hides each row whose name doesn't hold the text
 * (accents and case ignored, as CoC7 compares names), and the "Untrained \u00b7 base value" divider while searching.
 * @param {{node: HTMLElement, name: string}[]} rows
 * @param {string} text what the Keeper typed
 * @param {HTMLElement|null} [divider]
 * @returns {number} how many rows still show.
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

/** "60 · 30 · 12", the Regular, Hard and Extreme values; a dash when there is no value. */
export function levels(row) {
  return row?.value === null || row?.value === undefined ? NO_VALUE : `${row.value} · ${row.half} · ${row.fifth}`;
}

/** "1 bonus die", "2 penalty dice", or "" with none. */
export function diceText(dice) {
  if (!dice) return "";
  const n = Math.abs(dice);
  return `${n} ${dice > 0 ? "bonus" : "penalty"} ${n === 1 ? "die" : "dice"}`;
}

/** Bonus and penalty dice, at most two either way (Keeper Rulebook p. 91): [value, label] from −2 to +2. */
export function diceChoices() {
  const choices = [];
  for (let n = -MAX_DICE; n <= MAX_DICE; n++) choices.push([String(n), n === 0 ? "None" : (n > 0 ? `+${n}` : `−${-n}`)]);
  return choices;
}

/**
 * A row of buttons where one is pressed (difficulty, dice, Use / Against …).
 * @param {object} options
 * @param {[string, string][]} options.choices [value, label] pairs.
 * @param {() => string} options.get the current value.
 * @param {(value: string) => void} options.set store a new value; the menu redraws itself after it.
 * @param {string} [options.label] what the row is, read out (e.g. "Alice: bonus or penalty dice").
 * @returns {{element: HTMLElement, buttons: HTMLButtonElement[], sync: () => void}} `sync()` marks the pressed one.
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

/** A labelled row: "Difficulty" then its control. */
export function line(label, ...children) {
  const row = element("div", "rollbox-line");
  row.append(element("span", "rollbox-line-label", label), ...children);
  return row;
}

/**
 * The "how" rows of the Check and Item menus: Difficulty and Dice (up to two bonus or penalty dice, p. 91),
 * with the tall Blind toggle beside them. Reads and writes `state.difficulty`, `state.dice` and `state.blind`.
 * @param {{difficulty: string, dice: number, blind: boolean}} state
 * @param {() => void} onChange after every click; the menu redraws.
 * @returns {{element: HTMLElement, sync: () => void, blind: {on: boolean, disabled: boolean}}} `sync()` marks
 *   the pressed buttons; `blind` is the toggle, which a menu can turn off and disable (a combined check).
 */
export function howRows(state, onChange) {
  const difficulty = segmented({ choices: DIFFICULTIES.map((d) => [d, DIFFICULTY_LABELS[d]]),
    get: () => state.difficulty, set: (value) => { state.difficulty = value; onChange(); } });
  const dice = segmented({ choices: diceChoices(), get: () => String(state.dice),
    set: (value) => { state.dice = Number(value); onChange(); } });
  const blind = blindToggle({ onChange: (on) => { state.blind = on; onChange(); } });
  return {
    element: withBlind([line("Difficulty", difficulty.element), line("Dice", dice.element)], blind),
    blind,
    sync: () => { difficulty.sync(); dice.sync(); }
  };
}

/**
 * One Send: blocks a second click while it runs, never throws, and redraws the menu before and after.
 * @param {{sending: boolean, update: () => void}} menu
 * @param {() => Promise<object>} work sends the request; its result goes to `show`.
 * @param {(result: object|null) => void} show draws the result (null when `work` threw).
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
 * The main send button's words (Check, Sanity, Item). "Roll for NPC" / "Roll for NPCs" when every character is an
 * NPC (no player owner, so Rollbox rolls them for the Keeper; Void, 2026-11-14); otherwise "Request from player",
 * or "Send to each (N)" for several.
 * @param {Actor[]} actors who the request goes to
 */
export function requestLabel(actors) {
  const list = Array.from(actors ?? []);
  if (list.length && list.every((actor) => ownersOf(actor)?.length === 0)) {
    return list.length > 1 ? "Roll for NPCs" : "Roll for NPC";
  }
  return list.length > 1 ? `Send to each (${list.length})` : "Request from player";
}

/** The result area under a menu's buttons. */
function resultArea() {
  const node = element("div", "rollbox-result");
  node.setAttribute("aria-live", "polite");
  return node;
}

/**
 * The send section at the foot of every menu: the status line, the menu's buttons in a row, and the result area
 * under them. `ready()` greys the buttons out while something is missing (said in red on the status line) or a send
 * runs, and hides the line otherwise (Void, 2026-11-14: greyed out until complete, no summary).
 * @param {HTMLButtonElement[]} buttons in order; one with a `data-keep` attribute is never greyed out (Cancel).
 * @param {object} [options]
 * @param {string} [options.statusClass] the status line's own class (the Opposed roll's tie line).
 * @param {object} [options.status] a statusLine() the menu shows elsewhere (Assist's, under its result); the section
 *   then holds only the buttons and the result.
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

/** One block of the result: a heading, then one line each. */
function resultGroup(heading, lines) {
  const group = element("div", "rollbox-result-group");
  group.append(element("div", "rollbox-result-heading", heading), ...lines.map((text) => element("div", "rollbox-result-line", text)));
  return group;
}

/** A character asked by whisper, with their players: "Alice (Test)". */
function askedName(actor, mode) {
  const players = mode === "whisper" ? (ownersOf(actor) ?? []).map((user) => user.name).filter(Boolean) : [];
  return players.length ? `${actor?.name ?? "?"} (${players.join(", ")})` : (actor?.name ?? "?");
}

/**
 * What send() did, as a heading and one name per line (Void, 2026-11-14): "Sanity check sent to:" (or "posted
 * in chat for:") with each player's character; "Rolled for you:" with each NPC rolled for the Keeper; "Not
 * sent:" with each name and a short reason. Then the menu's own notes ("Assist card posted.").
 * @param {HTMLElement} area the menu's result area
 * @param {object|null} result send()'s result, or null when it threw.
 * @param {object} words
 * @param {string} [words.what] what was sent, for the heading: "Sanity check" → "Sanity check sent to:".
 * @param {"whisper"|"chat"|"link"} [words.mode]
 * @param {string} [words.heading] the first heading instead ("Opposed card made:").
 * @param {(actor: Actor) => string} [words.name] each sent-to line instead of the name (and players).
 * @param {string[]} [words.notes] lines after the groups.
 */
export function showResult(area, result, { what = "Request", mode = "whisper", heading, name, notes = [] } = {}) {
  const say = (text) => area.replaceChildren(element("div", "rollbox-result-line", text));
  if (!result) return say("Something went wrong; see the console (F12).");
  if (result.unavailable) return say("CoC7's roll links aren't available; nothing was sent.");
  if (mode === "link") return say(result.copied ? "Link copied." : "Nothing was copied.");
  const groups = [];
  if (result.requested.length) {
    groups.push(resultGroup(heading ?? `${what} ${mode === "chat" ? "posted in chat for" : "sent to"}:`,
      result.requested.map(name ?? ((actor) => askedName(actor, mode)))));
  }
  if (result.rolled.length) groups.push(resultGroup("Rolled for you:", result.rolled.map((actor) => actor?.name ?? "?")));
  if (result.skipped.length) {
    groups.push(resultGroup("Not sent:", result.skipped.map(({ actor, reason }) => (actor ? `${actor.name}: ${reason}` : reason))));
  }
  if (!groups.length) return say("Nothing was sent.");
  area.replaceChildren(...groups, ...notes.map((text) => element("div", "rollbox-result-line", text)));
}
