/** What state a character is in, and setting Rollbox's own states. See docs/status.md. */
import { MODULE_ID, warn } from "../utils.js";

/** Lists the statuses setRollboxStatus may set; every other status is only read. */
export const ROLLBOX_STATUSES = Object.freeze(["restrained"]);
const ROUND_NOTES = { aiming: () => false, divedForCover: () => false };

/**
 * Sets how Aiming and Dived for cover are read; combat hands this over so status never imports combat.
 * @param {{aiming: (actor: Actor) => boolean, divedForCover: (actor: Actor) => boolean}} readers
 * @returns {void}
 */
export function readRoundNotesWith({ aiming, divedForCover } = {}) {
  if (typeof aiming === "function") ROUND_NOTES.aiming = aiming;
  if (typeof divedForCover === "function") ROUND_NOTES.divedForCover = divedForCover;
}

const FLAG = "statuses";

// Order is getStatuses' order. CoC7 8.15: `coc7` is the condition key in STATUS_EFFECTS.
const STATUSES = Object.freeze([
  { id: "dying", name: "Dying", kind: "serious", coc7: "dying",
    detail: "0 HP with a major wound. A CON roll at the end of each round or they die; a successful First Aid "
      + "stabilises them (p. 121)." },
  { id: "unconscious", name: "Unconscious", kind: "serious", coc7: "unconscious",
    detail: "Can't act or defend. Attacks against them only miss on a fumble (p. 108)." },
  { id: "majorWound", name: "Major wound", kind: "serious", coc7: "criticalWounds",
    detail: "Half max HP or more in one hit. Falls prone; CON roll or unconscious; dying if HP reach 0 (p. 120)." },
  { id: "dead", name: "Dead", kind: "serious", coc7: "dead", detail: "Out of the fight." },
  { id: "prone", name: "Prone", kind: "other", coc7: "prone",
    detail: "Melee attacks against them: 1 bonus die. Firearms against them: 1 penalty die (not at point blank). "
      + "Shooting while prone: 1 bonus die. Stands up by dodging or fighting back, or on their turn (p. 127–128)." },
  { id: "restrained", name: "Restrained", kind: "other",
    detail: "Held after a Restrain maneuver. They stay held until they break free with a maneuver of their own "
      + "(p. 105)." },
  { id: "tempInsanity", name: "Bout of madness", kind: "other", coc7: "tempoInsane",
    detail: "Temporary insanity: the Keeper decides what the character does while it lasts (p. 156)." },
  { id: "indefInsanity", name: "Indefinite insanity", kind: "other", coc7: "indefInsane",
    detail: "Lasting insanity; the Keeper's call (p. 158)." },
  { id: "aiming", name: "Aiming", kind: "rollbox",
    detail: "The next shot gets 1 bonus die. Lost if they move or take damage (p. 113).",
    yours: "Your next shot gets 1 bonus die. Lost if you move or take damage (p. 113)." },
  { id: "divedForCover", name: "Dived for cover", kind: "rollbox",
    detail: "Shooters get 1 penalty die. They lose their next attack and can only dodge until then (p. 113).",
    yours: "Shooters get 1 penalty die. You lose your next attack and can only dodge until then (p. 113)." }
]);

const byId = new Map(STATUSES.map((status) => [status.id, status]));

// CoC7 marks a condition in `system.conditions` or as a status icon (Foundry's `Actor#statuses`); either counts.
function coc7Condition(actor, key) {
  try {
    if (actor.system?.conditions?.[key]?.value === true) return true;
    return typeof actor.statuses?.has === "function" && actor.statuses.has(key);
  } catch {
    return false;
  }
}

function rollboxNote(actor, id) {
  try {
    return actor.flags?.[MODULE_ID]?.[FLAG]?.[id] === true;
  } catch {
    return false;
  }
}

/**
 * Returns whether the character has one status; a failed read counts as not set.
 * @param {Actor} actor
 * @param {string} id a status id from STATUSES
 * @returns {boolean}
 */
export function hasStatus(actor, id) {
  const status = byId.get(id);
  if (!actor || !status) return false;
  if (status.coc7) return coc7Condition(actor, status.coc7);
  if (Object.hasOwn(ROUND_NOTES, id)) {
    try {
      return ROUND_NOTES[id](actor) === true;
    } catch {
      return false;
    }
  }
  return rollboxNote(actor, id);
}

const DOWN = Object.freeze([["dead", "Dead"], ["dying", "Dying"], ["unconscious", "Unconscious"]]);

/**
 * Returns why the character can't act at all (the worst of dead, dying, unconscious), or null.
 * @param {Actor} actor
 * @returns {string|null}
 */
export function downReason(actor) {
  return DOWN.find(([id]) => hasStatus(actor, id))?.[1] ?? null;
}

/**
 * Returns whether something holds the character, so Break free has something to break.
 * @param {Actor} actor
 * @returns {boolean}
 */
export const isHeld = (actor) => hasStatus(actor, "restrained");

/** Holds why a player's menu is greyed during a bout of madness. */
export const BOUT_REASON = "Bout of madness: the Keeper controls you";

/**
 * Returns why a player's whole menu is greyed for their investigator (down, or a bout of madness), or null.
 * @param {Actor} actor
 * @returns {string|null}
 */
export function playerBlock(actor) {
  return downReason(actor) ?? (hasStatus(actor, "tempInsanity") ? BOUT_REASON : null);
}

function readByOwner(actor) {
  try {
    return game.user?.isGM !== true && actor.isOwner === true;
  } catch {
    return false;
  }
}

/**
 * Returns every status the character has, serious ones first.
 * @param {Actor} actor
 * @returns {{id: string, name: string, kind: "serious"|"rollbox"|"other", detail: string}[]} `detail` is hover text
 */
export function getStatuses(actor) {
  if (!actor) return [];
  const yours = readByOwner(actor);
  return STATUSES.filter((status) => hasStatus(actor, status.id)).map(({ id, name, kind, detail, yours: own }) => (
    { id, name, kind, detail: yours && own ? own : detail }));
}

/**
 * Turns one of Rollbox's own states on or off; does nothing unless the user owns the character.
 * @param {Actor} actor
 * @param {"restrained"} id one of ROLLBOX_STATUSES
 * @param {boolean} on
 * @returns {Promise<boolean>} true only when the state changed; a failure warns and returns false
 */
export async function setRollboxStatus(actor, id, on) {
  if (!actor || !ROLLBOX_STATUSES.includes(id)) return false;
  const wanted = on === true;
  if (hasStatus(actor, id) === wanted) return false;
  if (actor.isOwner === false) {
    warn(`can't change ${actor.name ?? "the character"}'s status: you don't own the character.`);
    return false;
  }
  try {
    if (wanted) await actor.setFlag(MODULE_ID, `${FLAG}.${id}`, true);
    else await actor.unsetFlag(MODULE_ID, `${FLAG}.${id}`);
    return true;
  } catch (error) {
    warn(`couldn't change ${actor.name ?? "the character"}'s status "${id}".`, error);
    return false;
  }
}
