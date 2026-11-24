/** Rules more than one part reads, each stated once: pure data and arithmetic. See docs/shared.md. */
import { numberOrNull } from "../utils.js";

/** The name of Rollbox's flag on a character that holds the weapon picked in the Action flyout. */
export const PICKED_FLAG = "pickedWeapon";
/** The melee reach in metres: the setting's default, and the reach used when it can't be read. */
export const MELEE_REACH_DEFAULT = 1;

const HARD_FROM = 50;
const EXTREME_FROM = 90;
const IMPOSSIBLE_AT = 3;

/**
 * Returns the difficulty for a number to beat: Hard from 50, Extreme from 90.
 * @param {number} value
 * @returns {"regular"|"hard"|"extreme"}
 */
export function difficultyFor(value) {
  if (value >= EXTREME_FROM) return "extreme";
  if (value >= HARD_FROM) return "hard";
  return "regular";
}

/** The fighting maneuvers' goals, in the order the flyouts show them. */
export const MANEUVER_GOALS = Object.freeze([
  { id: "restrain", label: "Restrain" },
  { id: "knockDown", label: "Knock down" },
  { id: "disarm", label: "Disarm" },
  { id: "pushAway", label: "Push away" },
  { id: "breakFree", label: "Break free" },
  { id: "knockOut", label: "Knock out" }
]);

/**
 * Returns a maneuver's Build dice: one penalty die per point of Build the opponent has over the one maneuvering.
 * @param {number|null} ownBuild the one maneuvering
 * @param {number|null} opponentBuild
 * @returns {{dice: number, impossible: boolean, known: boolean}} `dice` 0, −1 or −2 (negative, as on CoC7's
 *   cards); `known` false when a Build is missing
 */
export function maneuverDice(ownBuild, opponentBuild) {
  if (ownBuild === null || ownBuild === undefined || opponentBuild === null || opponentBuild === undefined) {
    return { dice: 0, impossible: false, known: false };
  }
  const over = opponentBuild - ownBuild;
  if (over >= IMPOSSIBLE_AT) return { dice: 0, impossible: true, known: true };
  return { dice: over > 0 ? -over : 0, impossible: false, known: true };
}

/**
 * Reads a character's Build from CoC7's `system.attribs.build.value`.
 * @param {Actor} actor
 * @returns {number|null}
 */
export function buildOf(actor) {
  try {
    return numberOrNull(actor?.system?.attribs?.build?.value);
  } catch {
    return null;
  }
}

const METRES = Object.freeze({
  m: 1, meter: 1, meters: 1, metre: 1, metres: 1,
  ft: 0.3048, feet: 0.3048, foot: 0.3048,
  yd: 0.9144, yard: 0.9144, yards: 0.9144,
  km: 1000, mi: 1609.344
});

/**
 * Returns the metres in one of a scene's units ("ft", "feet", "m", "yd" …).
 * @param {string} units
 * @returns {number|null} null for a unit not in the table
 */
export function metresPerUnit(units) {
  return METRES[String(units ?? "").trim().toLowerCase()] ?? null;
}
