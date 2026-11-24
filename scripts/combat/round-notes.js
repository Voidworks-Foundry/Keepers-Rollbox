/** Each character's notes for the current round, kept in a flag on the actor. See docs/combat.md. */
import { MODULE_ID, warn } from "../utils.js";
import { roundOf, runningCombat, turnsOf } from "./encounter.js";

/**
 * Names the actor flag holding the round's note.
 * @type {string}
 */
export const NOTES_FLAG = "roundNotes";
const NOTE_MARKS = Object.freeze(["aiming", "dived", "acted", "delayed", "fled", "stood"]);

const offMarks = () => ({ ...Object.fromEntries(NOTE_MARKS.map((mark) => [mark, false])), attacks: 0, defended: [] });

/**
 * Returns the character's note, which counts only in its own encounter and round.
 * @param {Actor} actor
 * @returns {object|null}
 */
export function roundNote(actor) {
  const combat = actor ? runningCombat(actor) : null;
  if (!combat || !actor) return null;
  let note;
  try {
    note = actor.getFlag?.(MODULE_ID, NOTES_FLAG);
  } catch {
    return null;
  }
  if (!note || note.combat !== combat.id || note.round !== roundOf(combat)) return null;
  return note;
}

const has = (actor, mark) => roundNote(actor)?.[mark] === true;

// Foundry merges a flag's object on update, so an earlier round's keys must be written off, not left out.
function staleOff(actor) {
  let stored = null;
  try {
    stored = actor.getFlag?.(MODULE_ID, NOTES_FLAG) ?? null;
  } catch {
    stored = null;
  }
  if (!stored || typeof stored !== "object") return {};
  const off = { ...offMarks(), aimCarried: false };
  return Object.fromEntries(Object.keys(off).filter((key) => key in stored).map((key) => [key, off[key]]));
}

// Only the changed keys are written: Foundry merges them, so another client's mark written meanwhile survives.
async function writeNote(actor, combat, changes) {
  const fresh = roundNote(actor) ? {} : staleOff(actor);
  await actor.setFlag(MODULE_ID, NOTES_FLAG, { ...fresh, combat: combat.id, round: roundOf(combat), ...changes });
}

/**
 * Adds a mark to the character's note for the current round.
 * @param {Actor} actor
 * @param {string} mark one of NOTE_MARKS
 * @returns {Promise<boolean>} true when noted; false with no encounter, an unknown mark, or a failed update
 */
export async function markNote(actor, mark) {
  const combat = actor ? runningCombat(actor) : null;
  if (!combat || !actor || !NOTE_MARKS.includes(mark)) return false;
  try {
    await writeNote(actor, combat, { [mark]: true });
    return true;
  } catch (error) {
    warn(`couldn't note "${mark}" for ${actor.name ?? "the character"}.`, error);
    return false;
  }
}

/**
 * Notes that the character aimed.
 * @param {Actor} actor
 * @returns {Promise<boolean>} true when noted
 */
export async function markAiming(actor) {
  return markNote(actor, "aiming");
}

/**
 * Tells whether the character is aiming.
 * @param {Actor} actor
 * @returns {boolean}
 */
export function isAiming(actor) {
  return has(actor, "aiming");
}

/**
 * Notes that the character dived for cover.
 * @param {Actor} actor
 * @returns {Promise<boolean>} true when noted
 */
export async function markDived(actor) {
  return markNote(actor, "dived");
}

/**
 * Tells whether the character dived for cover this round.
 * @param {Actor} actor
 * @returns {boolean}
 */
export function hasDived(actor) {
  return has(actor, "dived");
}

/**
 * Notes that the character used their action.
 * @param {Actor} actor
 * @returns {Promise<boolean>} true when noted
 */
export async function markActed(actor) {
  return markNote(actor, "acted");
}

/**
 * Tells whether the character has acted this round.
 * @param {Actor} actor
 * @returns {boolean}
 */
export function hasActed(actor) {
  return has(actor, "acted");
}

/**
 * Notes an attack or maneuver; the last of the character's attacks per round also spends their action.
 * @param {Actor} actor
 * @param {number} [perRound] the character's attacks per round
 * @returns {Promise<boolean>} true when noted
 */
export async function markAttack(actor, perRound = 1) {
  const combat = actor ? runningCombat(actor) : null;
  if (!combat || !actor) return false;
  const attacks = attacksMade(actor) + 1;
  const most = Math.max(1, Math.trunc(Number(perRound) || 1));
  try {
    await writeNote(actor, combat, attacks >= most ? { attacks, acted: true } : { attacks });
    return true;
  } catch (error) {
    warn(`couldn't note ${actor.name ?? "the character"}'s attack.`, error);
    return false;
  }
}

/**
 * Counts the attacks the character has made this round.
 * @param {Actor} actor
 * @returns {number}
 */
export function attacksMade(actor) {
  const made = Math.trunc(Number(roundNote(actor)?.attacks));
  return made > 0 ? made : 0;
}

/**
 * Ends the character's Aiming once the aimed shot is made; the rest of the note stays.
 * @param {Actor} actor
 * @returns {Promise<boolean>} false when they weren't aiming or it couldn't be saved
 */
export async function clearAiming(actor) {
  const note = roundNote(actor);
  if (note?.aiming !== true) return false;
  try {
    await actor.setFlag(MODULE_ID, NOTES_FLAG, { aiming: false, aimCarried: false });
    return true;
  } catch (error) {
    warn(`couldn't end ${actor.name ?? "the character"}'s Aiming.`, error);
    return false;
  }
}

/**
 * Notes a defence the character made on a CoC7 defender card; each card counts once.
 * @param {Actor} actor
 * @param {string} messageId the defender card's chat message
 * @returns {Promise<boolean>} true when noted; false when already counted, with no encounter, or a failed update
 */
export async function markDefended(actor, messageId) {
  const combat = actor ? runningCombat(actor) : null;
  if (!combat || !actor || !messageId) return false;
  const used = Array.isArray(roundNote(actor)?.defended) ? roundNote(actor).defended : [];
  if (used.includes(messageId)) return false;
  try {
    // Only the active GM's client notes defences, so the list read here is never stale.
    await writeNote(actor, combat, { defended: [...used, messageId] });
    return true;
  } catch (error) {
    warn(`couldn't note ${actor.name ?? "the character"}'s defence.`, error);
    return false;
  }
}

/**
 * Counts the character's defences this round.
 * @param {Actor} actor
 * @returns {number}
 */
export function defencesUsed(actor) {
  const used = roundNote(actor)?.defended;
  return Array.isArray(used) ? used.length : 0;
}

/**
 * Lists the marks the character has this round, in a fixed order.
 * @param {Actor} actor
 * @returns {string[]}
 */
export function noteMarks(actor) {
  const note = roundNote(actor);
  return note ? NOTE_MARKS.filter((mark) => note[mark] === true) : [];
}

/**
 * Clears every combatant's note; `carryAiming` carries last round's Aiming over once. Active GM only.
 * @param {Combat} combat
 * @param {{carryAiming?: boolean}} [options]
 * @returns {Promise<number>} how many notes were cleared
 */
export async function clearRoundNotes(combat, { carryAiming = false } = {}) {
  let cleared = 0;
  const round = roundOf(combat);
  for (const combatant of turnsOf(combat)) {
    const actor = combatant.actor;
    try {
      const note = actor?.getFlag?.(MODULE_ID, NOTES_FLAG);
      if (!note) continue;
      if (carryAiming && note.aiming === true && note.aimCarried !== true && note.combat === combat?.id
        && note.round === round - 1) {
        await actor.setFlag(MODULE_ID, NOTES_FLAG, { ...offMarks(), combat: combat.id, round, aiming: true,
          aimCarried: true });
      } else {
        await actor.unsetFlag(MODULE_ID, NOTES_FLAG);
      }
      cleared += 1;
    } catch (error) {
      warn(`couldn't clear ${actor?.name ?? "a character"}'s round note.`, error);
    }
  }
  return cleared;
}
