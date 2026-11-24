/** Shared constants and helpers; imports nothing, so any part can import it. See docs/utils.md. */

/** The module's id, the namespace of its settings and flags. */
export const MODULE_ID = "keepers-rollbox";

/** The italic scope note under a Keeper (world) setting. */
export const KEEPER = "Keeper setting, applies to everyone.";
/** The italic scope note under a personal setting. */
export const PERSONAL = "Personal setting, affects only your screen.";

const HTML_ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/**
 * Escapes user-written text for HTML, such as a token's name in a chat message.
 * @param {*} text
 * @returns {string}
 */
export function escapeHtml(text) {
  return String(text ?? "").replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

/**
 * Reads one of this module's settings; Foundry throws for an unregistered key.
 * @param {string} key
 * @returns {*}
 */
export const getSetting = (key) => game.settings.get(MODULE_ID, key);

const declared = new Map();

/**
 * Records a part's planned settings, so option() can answer with their defaults before they are registered.
 * @param {{key: string, scope: string, type: Function, default: *, section: string, label: string,
 *   note: string}[]} list
 * @returns {readonly object[]} the same list, frozen
 */
export function declareSettings(list) {
  for (const setting of list) declared.set(setting.key, setting);
  return Object.freeze([...list]);
}

/**
 * Returns a setting's value, or its declared default while it isn't registered.
 * @param {string} key the setting's key, without the module id
 * @returns {*} undefined when the key is neither registered nor declared
 */
export function option(key) {
  try {
    return game.settings.get(MODULE_ID, key);
  } catch {
    return declared.get(key)?.default;
  }
}

/**
 * Returns the update keys that remove these Rollbox flags (Foundry v14's `ForcedDeletion`, else `-=key`).
 * @param {...string} keys
 * @returns {object}
 */
export function flagsRemoved(...keys) {
  let Deletion = null;
  try {
    Deletion = globalThis.foundry?.data?.operators?.ForcedDeletion ?? null;
  } catch {
    Deletion = null;
  }
  return Object.fromEntries(keys.map((key) => (typeof Deletion === "function"
    ? [`flags.${MODULE_ID}.${key}`, new Deletion()] : [`flags.${MODULE_ID}.-=${key}`, null])));
}

/**
 * Returns whether this is a Keeper's (GM's) client.
 * @returns {boolean} false while there is no user yet
 */
export function isKeeper() {
  return game.user?.isGM === true;
}

/**
 * Returns whether this is the one Keeper's client that carries out Rollbox's gameplay, so two GMs never act twice.
 * @returns {boolean}
 */
export function isActiveKeeper() {
  if (!isKeeper()) return false;
  try {
    const active = game.users?.activeGM;
    return active ? active.isSelf === true || active.id === game.user?.id : true;
  } catch {
    return false;
  }
}

/** CoC7's system id, the namespace of its flags and settings. */
export const COC7_ID = "CoC7";

const FOCUSABLE = new Set(["button", "input", "select", "textarea"]);

/**
 * Creates an element with classes and text (never HTML); a control is left out of the Tab order.
 * @param {string} tag
 * @param {string} [className]
 * @param {string} [text]
 * @returns {HTMLElement}
 */
export function element(tag, className, text) {
  const node = document.createElement(tag);
  if (FOCUSABLE.has(tag)) node.tabIndex = -1;
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Shown for a value the sheet doesn't have. */
export const NO_VALUE = "—";

/**
 * Returns a finite number from a stored value, or null.
 * @param {*} value
 * @returns {number|null}
 */
export function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Logs a problem to the console with the module's prefix, and any details (an error) with it.
 * @param {string} text
 * @param {...*} details
 * @returns {void}
 */
export function warn(text, ...details) {
  console.warn(`${MODULE_ID} | ${text}`, ...details);
}

/**
 * Shows a warning notification on this screen only.
 * @param {string} text
 * @returns {void}
 */
export function tellKeeper(text) {
  globalThis.ui?.notifications?.warn?.(text);
}

/**
 * Returns whether two actors are the same character: the same object, or the same uuid.
 * @param {Actor} a
 * @param {Actor} b
 * @returns {boolean}
 */
export const sameActor = (a, b) => Boolean(a && b) && (a === b || (a.uuid !== undefined && a.uuid === b.uuid));

/**
 * Returns how Rollbox tells characters apart: their uuid, else their id or name.
 * @param {Actor} actor
 * @returns {string|undefined}
 */
export const actorKey = (actor) => actor?.uuid ?? actor?.id ?? actor?.name;

/**
 * Returns each actor once (by uuid, else the same object), in order, without empty entries.
 * @param {Iterable<Actor>} actors
 * @returns {Actor[]}
 */
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

/**
 * Returns a uuid with dots for slashes, so uuids compare: CoC7 stores some with slashes (`Actor/abc`).
 * @param {string} uuid
 * @returns {string}
 */
export const dotted = (uuid) => String(uuid ?? "").replace(/\//g, ".");

/**
 * Returns the character a uuid names, without waiting: an actor, a token's actor, or anything else's actor.
 * @param {string} uuid
 * @returns {Actor|foundry.abstract.Document|null} null for a uuid that names nothing
 */
export function actorFromUuid(uuid) {
  if (!uuid) return null;
  try {
    const found = globalThis.fromUuidSync?.(uuid) ?? null;
    if (!found) return null;
    if (found.documentName === "Actor") return found;
    if (found.documentName === "Token") return found.actor ?? null;
    return found.actor ?? found;
  } catch {
    return null;
  }
}

/**
 * Returns whether this user owns the character, guarded.
 * @param {Actor} actor
 * @param {User} user
 * @returns {boolean}
 */
export function plays(actor, user) {
  try {
    return actor?.testUserPermission?.(user, "OWNER") === true;
  } catch {
    return false;
  }
}

/**
 * Returns a character's items as a list, guarded.
 * @param {Actor} actor
 * @returns {Item[]}
 */
export function itemsOf(actor) {
  try {
    return Array.from(actor?.items ?? []);
  } catch {
    return [];
  }
}

/**
 * Creates a Font Awesome glyph hidden from screen readers, for a button that carries its own words.
 * @param {string} icon
 * @returns {HTMLElement}
 */
export function glyph(icon) {
  const node = element("i", `fa-solid ${icon}`);
  node.setAttribute("aria-hidden", "true");
  return node;
}
