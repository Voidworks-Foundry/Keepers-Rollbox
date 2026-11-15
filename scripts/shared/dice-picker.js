/**
 * Compact dice picker: the number of dice as − n +, one row of dice (D3 D4 D6 D8 D10 D12 D20 D100), a flat
 * bonus as − n +, and None; for damage, a "+DB" toggle (it reads "+½DB" while the menu asks for half the
 * bonus, for a thrown object). It edits a value line (value-line.js) above it: each click writes the formula
 * into the line ("1D4+1", "1D6+DB"), and typing into the line moves the picker. It only builds text: CoC7 and
 * Foundry roll it. Opened from a full-width Custom button (customDice), one or two pickers at once: the
 * Sanity menu's loss on success and on failure, the Item menu's improvised damage. With the personal
 * "Simplified dice UI" setting on, the Custom button and its pickers are gone, and so are the preset rows the
 * menus mark with hideWhenSimplified: the Keeper types into the line. setSimplifiedDice switches an open menu
 * at once.
 */
import { element, getSetting } from "../utils.js";
import { button } from "./menu.js";

/** The dice the rulebook's losses and weapons use. */
const DICE = Object.freeze([3, 4, 6, 8, 10, 12, 20, 100]);
/** At most nine dice of one kind. */
const MAX_COUNT = 9;
/** The flat bonus's limit: more than any loss or damage in the rulebook. */
const MAX_BONUS = 99;
/** A die picked by "+" with none chosen yet. */
const DEFAULT_DIE = 6;
/** What nothing at all is: a loss of 0, or no damage (the value line's empty). */
export const NO_DICE = "0";
/** The damage bonus as the formula writes it: whole, or half for a thrown object (roll-requests fills both in). */
const BONUS = Object.freeze({ full: "DB", half: "½DB" });
/**
 * A formula the picker can show: "2D6", "1D4+1", "1D6+DB", "1D4+½DB", "3", "DB". The dice are tried longest
 * first, so "1D100" is read as D100, not D10 and a 0.
 */
const PICKER_FORMULA = new RegExp(`^(?:([1-9])D(${[...DICE].sort((a, b) => b - a).join("|")}))?`
  + "(?:([+-]?)(\\d+))?(\\+?½?DB)?$");

/** Marks everything Simplified dice UI hides: the Custom sections and the menus' preset rows. */
const SIMPLIFIED_HIDES = "rollbox-simplified-hides";

/** The Keeper's "Simplified dice UI" setting; off when it can't be read. */
function simplifiedDice() {
  try {
    return getSetting("rollboxSimplifiedDice") === true;
  } catch {
    return false;
  }
}

/**
 * The "Simplified dice UI" setting's onChange: hides or shows the Custom buttons with their pickers, and the
 * preset rows, in every open menu at once. The value lines keep what they hold. Menus drawn later read the
 * setting themselves.
 * @param {boolean} on
 */
export function setSimplifiedDice(on) {
  for (const node of globalThis.document?.querySelectorAll(`.${SIMPLIFIED_HIDES}`) ?? []) node.hidden = on === true;
}

/**
 * Hide this element while "Simplified dice UI" is on: a menu then shows only its typed value line. Used for
 * the Custom sections and the menus' preset rows (Sanity presets, Item damage quick-picks), and follows the
 * setting at once.
 * @param {HTMLElement} node
 * @returns {HTMLElement} the same element
 */
export function hideWhenSimplified(node) {
  node.classList.add(SIMPLIFIED_HIDES);
  node.hidden = simplifiedDice();
  return node;
}

/**
 * A formula read into the picker's parts. `fits` is false when the picker can't show it (e.g. 1D6+1D4, or
 * text that isn't dice): then nothing is pressed, and the next click starts from nothing.
 * @param {string} text tidied formula ("1D6+DB")
 * @param {{damageBonus?: boolean}} [options] whether DB may be in it
 * @returns {{fits: boolean, count: number, die: number|null, bonus: number, db: boolean}}
 */
function diceParts(text, { damageBonus = false } = {}) {
  const formula = String(text ?? "").replace(/\s+/g, "").toUpperCase();
  const nothing = { fits: true, count: 0, die: null, bonus: 0, db: false };
  if (!formula || formula === NO_DICE) return nothing;
  const match = formula.match(PICKER_FORMULA);
  const bonus = match?.[4] ? Number(`${match[3] === "-" ? "-" : ""}${match[4]}`) : 0;
  const fits = match && (match[1] || match[4] || match[5]) && (!match[5] || damageBonus) && Math.abs(bonus) <= MAX_BONUS
    && !(match[3] === "" && match[1] && match[4]); // "1D45" isn't 1D4 and 5
  if (!fits) return { ...nothing, fits: false };
  return { fits: true, count: match[1] ? Number(match[1]) : 0, die: match[2] ? Number(match[2]) : null, bonus,
    db: Boolean(match[5]) };
}

/**
 * The formula for the picker's parts: "2D4+1", "1D6+DB", "1D4+½DB" (`half`), "3"; nothing at all is "0".
 * @param {{count: number, die: number|null, bonus: number, db: boolean}} parts
 * @param {{half?: boolean}} [options]
 */
function diceFormula({ count, die, bonus, db }, { half = false } = {}) {
  let formula = count > 0 && die ? `${count}D${die}` : "";
  if (bonus) formula += bonus > 0 && formula ? `+${bonus}` : String(bonus);
  if (db) formula += `${formula ? "+" : ""}${half ? BONUS.half : BONUS.full}`;
  return formula || NO_DICE;
}

/**
 * A formula with its damage bonus made whole or half ("1D6+DB" ↔ "1D6+½DB"), for when the Item menu's skill
 * changes to or from Throw. Text the picker can't show is left alone.
 * @param {string} text
 * @param {boolean} half
 */
export function withHalfBonus(text, half) {
  const parts = diceParts(text, { damageBonus: true });
  return parts.fits && parts.db ? diceFormula(parts, { half }) : text;
}

/** A − n + stepper. */
function stepper(label, onStep) {
  const root = element("div", "rollbox-dice-stepper");
  root.setAttribute("role", "group");
  root.setAttribute("aria-label", label);
  const down = button("rollbox-btn rollbox-dice-step", "−", () => onStep(-1));
  down.setAttribute("aria-label", `${label}: fewer`);
  const shown = element("span", "rollbox-dice-count", "0");
  shown.setAttribute("aria-live", "polite");
  const up = button("rollbox-btn rollbox-dice-step", "+", () => onStep(1));
  up.setAttribute("aria-label", `${label}: more`);
  root.append(down, shown, up);
  return { root, shown };
}

/**
 * A compact dice picker for one value line.
 * @param {object} options
 * @param {string} options.label what it is for, e.g. "On a success" (shown and read out).
 * @param {{text: string, set: (text: string) => void}} options.line the value line it edits.
 * @param {boolean} [options.damageBonus] offer the "+DB" toggle (damage only).
 * @param {() => void} [options.onChange] after every click (the line has changed).
 * @returns {{element: HTMLElement, sync: () => void, halfBonus: (on: boolean) => void}} `sync()` shows what
 *   the line holds now (call it after the Keeper types or a preset is set). `halfBonus(true)` makes the toggle
 *   read "+½DB" and write half the bonus.
 */
export function dicePicker({ label, line, damageBonus = false, onChange = () => {} } = {}) {
  let half = false;
  const parts = () => diceParts(line.text, { damageBonus });
  /** Write a change into the line; from text the picker can't show, it starts from nothing. */
  const change = (next) => {
    const now = parts();
    const base = now.fits ? now : { count: 0, die: null, bonus: 0, db: false };
    line.set(diceFormula({ ...base, ...next(base) }, { half }));
    sync();
    onChange();
  };

  const root = element("div", "rollbox-dice");
  root.setAttribute("role", "group");
  root.setAttribute("aria-label", label);
  const head = element("div", "rollbox-dice-label", label);

  // Number of dice: "+" from none picks a D6; "−" to none leaves only the flat bonus.
  const count = stepper(`${label}: number of dice`, (step) => change((p) => {
    const n = Math.max(0, Math.min(MAX_COUNT, (p.die ? p.count : 0) + step));
    return { count: n, die: n ? (p.die ?? DEFAULT_DIE) : null };
  }));
  const diceRow = element("div", "rollbox-dice-row");
  diceRow.append(count.root);
  const dieButtons = DICE.map((faces) => {
    // A die with no number of dice yet is one die.
    const node = button("rollbox-btn rollbox-dice-button", `D${faces}`,
      () => change((p) => ({ die: faces, count: p.count || 1 })));
    node.dataset.die = String(faces);
    return node;
  });
  diceRow.append(...dieButtons);

  const flatRow = element("div", "rollbox-dice-row");
  const flat = stepper(`${label}: flat bonus`, (step) => change((p) => ({
    bonus: Math.max(0, Math.min(MAX_BONUS, p.bonus + step))
  })));
  flatRow.append(element("span", "rollbox-dice-plus", "+ flat"), flat.root);
  let dbButton = null;
  if (damageBonus) {
    dbButton = button("rollbox-btn rollbox-dice-button rollbox-dice-db", `+${BONUS.full}`,
      () => change((p) => ({ db: !p.db })));
    flatRow.append(dbButton);
  }
  const noneButton = button("rollbox-btn rollbox-dice-button rollbox-dice-none", "None",
    () => change(() => ({ count: 0, die: null, bonus: 0, db: false })));
  flatRow.append(noneButton);
  root.append(head, diceRow, flatRow);

  function sync() {
    const p = parts();
    const shows = p.fits && p.count > 0 && p.die;
    count.shown.textContent = String(shows ? p.count : 0);
    flat.shown.textContent = String(p.fits ? p.bonus : 0);
    for (const node of dieButtons) node.setAttribute("aria-pressed", String(Boolean(shows) && p.die === Number(node.dataset.die)));
    if (dbButton) {
      dbButton.textContent = `+${half ? BONUS.half : BONUS.full}`;
      dbButton.setAttribute("aria-pressed", String(p.fits && p.db));
    }
    noneButton.setAttribute("aria-pressed", String(p.fits && !p.count && !p.bonus && !p.db));
  }

  sync();
  return {
    element: root,
    sync,
    halfBonus(on) {
      half = Boolean(on);
      sync();
    }
  };
}

/**
 * A full-width Custom button ("Custom damage") that opens its pickers under it, and closes them on a second
 * click. Hidden, with its pickers, while "Simplified dice UI" is on (hideWhenSimplified).
 * @param {{label: string, pickers: {element: HTMLElement, sync: () => void}[]}} options
 * @returns {{element: HTMLElement, button: HTMLButtonElement, readonly open: boolean, sync: () => void}}
 */
export function customDice({ label, pickers = [] } = {}) {
  const root = element("div", "rollbox-dice-custom");
  const panel = element("div", "rollbox-dice-panel");
  panel.hidden = true;
  panel.append(...pickers.map((picker) => picker.element));
  const toggle = button("rollbox-btn rollbox-dice-toggle", label, () => {
    panel.hidden = !panel.hidden;
    toggle.setAttribute("aria-expanded", String(!panel.hidden));
    if (!panel.hidden) pickers.forEach((picker) => picker.sync());
  });
  toggle.setAttribute("aria-expanded", "false");
  root.append(toggle, panel);
  hideWhenSimplified(root);
  return {
    element: root,
    button: toggle,
    get open() {
      return !panel.hidden;
    },
    sync: () => pickers.forEach((picker) => picker.sync())
  };
}
