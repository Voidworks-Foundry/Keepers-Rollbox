/**
 * Clicks on the one-character mini sheet's values (Void, 2026-11-15): each characteristic, SAN and Luck is a button
 * that opens the matching menu, with the same mouse shortcuts as CoC7's own character sheet (its tooltip
 * `CoC7.ToolTipSkill` and the Keeper's and Sanity variants), mapped to Rollbox's menus and request paths. Nothing is
 * sent from here: every send goes through the menu that opens, so its send and result lines are the menu's own.
 * CoC7's sheet handlers are never called. The opposed two-step (right click one character's value, then another's)
 * is remembered here. Keeper only: the panel exists only on the Keeper's client.
 */

/** "STR" for "str". */
const label = (key) => String(key).toUpperCase();

/**
 * What a click on a value means, as CoC7's sheet maps its shortcuts (DESIGN.md, "The mini sheet's values").
 * Ctrl is Ctrl or Cmd (Foundry treats Cmd on a Mac as Ctrl); Alt is Option on a Mac.
 * @param {{kind: "characteristic"|"san"|"luck", key?: string}} value what was clicked
 * @param {{right: boolean, shift: boolean, ctrl: boolean, alt: boolean}} how
 * @returns {{open?: string, start?: object, opposed?: {key: string, create: boolean}}|null} the menu to open with its
 *   starting state, or the opposed two-step's step; null when the shortcut does nothing on this value.
 */
export function shortcut(value, { right = false, shift = false, ctrl = false, alt = false } = {}) {
  if (value?.kind === "san") return right ? null : { open: "sanity" };
  if (value?.kind === "luck") {
    if (right || alt) return null;
    const luck = { section: "luck" };
    if (shift && ctrl) return { open: "other", start: luck };
    if (shift) return { open: "other", start: { ...luck, plain: true, send: "whisper" } };
    if (ctrl) return { open: "other", start: { ...luck, plain: true, send: "link" } };
    return { open: "other", start: luck };
  }
  if (value?.kind !== "characteristic" || !value.key) return null;
  const tick = `characteristic:${value.key}`;
  if (right) {
    if (alt) return { open: "check", start: shift ? { tick, add: true, send: "whisper" } : { tick, add: true } };
    if (ctrl) return null;
    return { opposed: { key: tick, create: shift } };
  }
  if (alt) return null;
  if (shift && ctrl) return { open: "check", start: { tick, focus: "link" } };
  if (shift) return { open: "check", start: { tick, plain: true, send: "whisper" } };
  if (ctrl) return { open: "check", start: { tick, plain: true, send: "link" } };
  return { open: "check", start: { tick } };
}

/** The modifier keys of a mouse event, as `shortcut` takes them. */
export function howClicked(event, right) {
  return { right, shift: event.shiftKey === true, ctrl: event.ctrlKey === true || event.metaKey === true,
    alt: event.altKey === true };
}

/**
 * The opposed two-step: the first right click on a characteristic remembers that character and check; a right
 * click on another character's characteristic (that token selected) completes it. Escape, or a left click on the
 * panel, cancels it.
 */
export class OpposedStep {
  constructor() {
    this.first = null;
  }

  /** The note the panel shows while a first side is remembered, or "". */
  get note() {
    if (!this.first) return "";
    return `Opposed: ${this.first.actor?.name ?? "?"} · ${this.first.name}. Select the other character and right-click their value.`;
  }

  /**
   * One right click on a characteristic.
   * @param {Actor} actor whose mini sheet was clicked
   * @param {object} token that character's token on the canvas (to select it again with the second one)
   * @param {{key: string, create: boolean}} step from `shortcut`
   * @returns {{first: object, second: object, create: boolean}|null} both sides once the second is clicked;
   *   null after the first (or a new first for the same character).
   */
  click(actor, token, { key, create }) {
    const side = { actor, token, key, name: label(key.split(":")[1] ?? key), create };
    if (!this.first || sameActor(this.first.actor, actor)) {
      this.first = side;
      return null;
    }
    const first = this.first;
    this.first = null;
    return { first, second: side, create: Boolean(first.create || create) };
  }

  cancel() {
    const had = Boolean(this.first);
    this.first = null;
    return had;
  }
}

function sameActor(a, b) {
  return a === b || (Boolean(a?.uuid) && a?.uuid === b?.uuid);
}
