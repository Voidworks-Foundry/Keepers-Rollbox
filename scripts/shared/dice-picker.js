/** The compact dice picker, its Custom button and the Simplified dice UI switch. See docs/shared.md. */
import { element, getSetting } from "../utils.js";
import { button } from "./button.js";

const DICE = Object.freeze([3, 4, 6, 8, 10, 12, 20, 100]);
const MAX_COUNT = 9;
// More than any loss or damage in the rulebook.
const MAX_BONUS = 99;
const DEFAULT_DIE = 6;
/** The formula for nothing at all: a loss of 0, or no damage. */
export const NO_DICE = "0";
const BONUS = Object.freeze({ full: "DB", half: "½DB" });
// Dice tried longest first, so "1D100" reads as D100, not D10 and a 0.
const PICKER_FORMULA = new RegExp(`^(?:([1-9])D(${[...DICE].sort((a, b) => b - a).join("|")}))?`
  + "(?:([+-]?)(\\d+))?(\\+?½?DB)?$");

const SIMPLIFIED_HIDES = "rollbox-simplified-hides";

/** Reads the Simplified dice UI setting; off when it can't be read. */
function simplifiedDice() {
  try {
    return getSetting("rollboxSimplifiedDice") === true;
  } catch {
    return false;
  }
}

/**
 * Hides or shows every element marked by hideWhenSimplified in the document: the setting's onChange.
 * @param {boolean} on
 * @returns {void}
 */
export function setSimplifiedDice(on) {
  for (const node of globalThis.document?.querySelectorAll(`.${SIMPLIFIED_HIDES}`) ?? []) node.hidden = on === true;
}

/**
 * Marks an element to be hidden while Simplified dice UI is on, and hides it now if it is.
 * @param {HTMLElement} node
 * @returns {HTMLElement} the same element
 */
export function hideWhenSimplified(node) {
  node.classList.add(SIMPLIFIED_HIDES);
  node.hidden = simplifiedDice();
  return node;
}

/**
 * Reads a formula into the picker's parts; `fits` is false when the picker can't show it.
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
 * Writes the picker's parts as a formula; nothing at all is NO_DICE.
 * @param {{count: number, die: number|null, bonus: number, db: boolean}} parts
 * @param {{half?: boolean}} [options]
 * @returns {string}
 */
function diceFormula({ count, die, bonus, db }, { half = false } = {}) {
  let formula = count > 0 && die ? `${count}D${die}` : "";
  if (bonus) formula += bonus > 0 && formula ? `+${bonus}` : String(bonus);
  if (db) formula += `${formula ? "+" : ""}${half ? BONUS.half : BONUS.full}`;
  return formula || NO_DICE;
}

/**
 * Returns the formula with its damage bonus made whole or half ("1D6+DB" ↔ "1D6+½DB").
 * @param {string} text
 * @param {boolean} half
 * @returns {string} the text unchanged when the picker can't read it
 */
export function withHalfBonus(text, half) {
  const parts = diceParts(text, { damageBonus: true });
  return parts.fits && parts.db ? diceFormula(parts, { half }) : text;
}

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
 * Returns a compact dice picker that edits one value line.
 * @param {object} options
 * @param {string} options.label shown and read out
 * @param {{text: string, set: (text: string) => void}} options.line the value line it edits
 * @param {boolean} [options.damageBonus] offers the +DB toggle
 * @param {() => void} [options.onChange] after every click
 * @returns {{element: HTMLElement, sync: () => void, halfBonus: (on: boolean) => void}} call `sync()` after the
 *   line changes elsewhere; `halfBonus` doesn't call onChange
 */
export function dicePicker({ label, line, damageBonus = false, onChange = () => {} } = {}) {
  let half = false;
  const parts = () => diceParts(line.text, { damageBonus });
  // From text the picker can't show, a click starts from nothing.
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

  const count = stepper(`${label}: number of dice`, (step) => change((p) => {
    const n = Math.max(0, Math.min(MAX_COUNT, (p.die ? p.count : 0) + step));
    return { count: n, die: n ? (p.die ?? DEFAULT_DIE) : null };
  }));
  const diceRow = element("div", "rollbox-dice-row");
  diceRow.append(count.root);
  const dieButtons = DICE.map((faces) => {
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
 * Returns a full-width button that opens and closes its pickers; hidden while Simplified dice UI is on.
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
