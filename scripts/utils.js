/** Shared constants and helpers. */

export const MODULE_ID = "keepers-rollbox";

/** The italic scope notes under each setting. Here so the parts can use them without importing settings.js. */
export const KEEPER = "Keeper setting, applies to everyone.";
export const PERSONAL = "Personal setting, affects only your screen.";

const HTML_ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/** Make user-written text safe to put in HTML, such as a token's name in a chat message. */
export function escapeHtml(text) {
  return String(text ?? "").replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

/** Read one of this module's settings. */
export const getSetting = (key) => game.settings.get(MODULE_ID, key);

/** True only on the Keeper's (GM's) client. Rollbox draws nothing and installs no hooks for players. */
export function isKeeper() {
  return game.user?.isGM === true;
}

// --- Rollbox's own helpers, used by several parts ---------------------------------------------------

/** CoC7's system id, the namespace of its flags and settings. */
export const COC7_ID = "CoC7";

/** Small element helper: tag with classes and optional text. Text only, so names never become HTML. */
export function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Shown for a value the sheet doesn't have. */
export const NO_VALUE = "—";

/** A finite number from a stored value, or null. */
export function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** A problem for the console (F12), with the module's prefix; extra details (an error) are logged with it. */
export function warn(text, ...details) {
  console.warn(`${MODULE_ID} | ${text}`, ...details);
}

/** A problem the Keeper should know about, on their screen only. */
export function tellKeeper(text) {
  globalThis.ui?.notifications?.warn?.(text);
}

/** How Rollbox tells characters apart: their uuid, else their id or name. */
export const actorKey = (actor) => actor?.uuid ?? actor?.id ?? actor?.name;

/** Each actor once (by uuid, else the same object), in order; empty entries (a token without an actor) left out. */
export function uniqueActors(actors) {
  const seen = new Set();
  return Array.from(actors ?? []).filter((actor) => {
    if (!actor) return false;
    const key = actor.uuid ?? actor;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
