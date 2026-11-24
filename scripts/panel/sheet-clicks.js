/** What a click on a sheet value or a Check row means, mapped from CoC7's sheet shortcuts. See docs/panel.md. */

/**
 * Returns what a click on a sheet value means: the flyout to open with its starting state, or an opposed side.
 * @param {{kind: "characteristic"|"san"|"luck", key?: string}} value
 * @param {{right: boolean, shift: boolean, ctrl: boolean, alt: boolean}} how
 * @returns {{open?: string, start?: object, opposed?: {key: string, create: boolean}}|null} null: does nothing
 */
export function shortcut(value, { right = false, shift = false, ctrl = false, alt = false } = {}) {
  if (value?.kind === "san") return sanShortcut({ right, shift, ctrl, alt });
  if (value?.kind === "luck") return luckShortcut({ right, shift, ctrl, alt });
  if (value?.kind !== "characteristic" || !value.key) return null;
  const tick = `characteristic:${value.key}`;
  if (right) {
    // CoC7 8.15: Alt is read before Ctrl, as on CoC7's sheet and the Check rows (rowShortcut).
    if (alt) return { open: "check", start: shift ? { tick, add: true, send: true } : { tick, add: true } };
    if (ctrl) return null;
    return { opposed: { key: tick, create: shift } };
  }
  if (alt) return null;
  if (shift && !ctrl) return { open: "check", start: { tick, plain: true, send: true } };
  return { open: "check", start: { tick } };
}

function sanShortcut({ right, shift, ctrl, alt }) {
  const tab = { tab: "sanity" };
  if (!right && !alt && shift && !ctrl) return { open: "check", start: { ...tab, plain: true, send: true } };
  return { open: "check", start: tab };
}

function luckShortcut({ right, shift, ctrl, alt }) {
  const luck = { section: "luck" };
  if (right) return ctrl ? null : { open: "other", start: luck };
  if (alt) return null;
  if (shift && !ctrl) return { open: "other", start: { ...luck, plain: true, send: true } };
  return { open: "other", start: luck };
}

/**
 * Returns what a click on one of the Check flyout's rows means; a plain Left click ticks, never rolls.
 * @param {{right: boolean, shift: boolean, ctrl: boolean, alt: boolean}} how
 * @returns {"tick"|"add"|"send"|"copy"|"opposed"|"opposedNow"|"combinedNow"|null} null: does nothing
 */
export function rowShortcut({ right = false, shift = false, ctrl = false, alt = false } = {}) {
  if (right) {
    // CoC7 8.15: Alt is read before Ctrl (its sheet's right click is a combined check whenever Alt is held).
    if (alt) return shift ? "combinedNow" : "add";
    if (ctrl) return null;
    return shift ? "opposedNow" : "opposed";
  }
  if (alt) return null;
  if (ctrl) return shift ? "tick" : "copy";
  return shift ? "send" : "tick";
}

/**
 * Reads a mouse event's modifier keys; Cmd counts as Ctrl, as Foundry treats it on a Mac.
 * @param {MouseEvent} event
 * @param {boolean} right
 * @returns {{right: boolean, shift: boolean, ctrl: boolean, alt: boolean}}
 */
export function howClicked(event, right) {
  return { right, shift: event.shiftKey === true, ctrl: event.ctrlKey === true || event.metaKey === true,
    alt: event.altKey === true };
}
