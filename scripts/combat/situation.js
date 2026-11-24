/** Whether an attack's target is in melee with others or outnumbered, for the target box. See docs/combat.md. */
import { COC7_ID, actorFromUuid, isActiveKeeper, numberOrNull, option } from "../utils.js";
import { MELEE_REACH_DEFAULT, edgeDistance } from "../shared/index.js";
import { gameplayOn, isCombatantOf, runningCombat, turnsOf } from "./encounter.js";
import { defencesUsed, markDefended } from "./round-notes.js";

// CoC7 8.15: the melee card's `flags.CoC7.load.as`, and its defender's participant number.
const MELEE_CARD = "CoC7ChatCombatMelee";
const DEFENDER = 1;

function tokenOfCombatant(combatant) {
  try {
    return combatant?.token?.object ?? null;
  } catch {
    return null;
  }
}

const sameToken = (a, b) => Boolean(a && b) && (a === b || (a.id !== undefined && a.id === b.id));

/**
 * Tells whether a shot's target has another combatant than the shooter within melee reach; false out of combat.
 * @param {Token} target
 * @param {Actor} shooter
 * @returns {boolean}
 */
export function inMeleeWithOthers(target, shooter) {
  const combat = target ? runningCombat([target, shooter]) : null;
  if (!combat || !target || !gameplayOn()) return false;
  const reach = numberOrNull(option("rollboxMeleeReach")) ?? MELEE_REACH_DEFAULT;
  return turnsOf(combat).some((combatant) => {
    if (isCombatantOf(combatant, shooter) || (target.actor && isCombatantOf(combatant, target.actor))) return false;
    const token = tokenOfCombatant(combatant);
    if (!token || sameToken(token, target)) return false;
    const measured = edgeDistance(token, target);
    return Number.isFinite(measured?.metres) && measured.metres <= reach;
  });
}

/**
 * Reads CoC7's Attacks per round field; a missing field or a dice formula counts as 1.
 * @param {Actor} actor
 * @returns {number} 1 or more
 */
export function attacksPerRound(actor) {
  const n = numberOrNull(String(actor?.system?.special?.attacksPerRound ?? "").trim());
  return Number.isInteger(n) && n > 1 ? n : 1;
}

function defencesPerRound(actor) {
  return attacksPerRound(actor);
}

/**
 * Tells whether a melee target has defended this round as often as they may; false out of combat.
 * @param {Actor} target
 * @returns {boolean}
 */
export function isOutnumbered(target) {
  if (!target || !runningCombat(target) || !gameplayOn()) return false;
  return defencesUsed(target) >= defencesPerRound(target);
}

function defenderOf(load) {
  return actorFromUuid(load?.actorUuid ?? load?.targetUuid);
}

/**
 * Notes one defence for the defender of a CoC7 melee card answered with a response. Active GM only.
 * @param {ChatMessage} message
 * @returns {Promise<boolean>} true when a defence was noted
 */
export async function defenderAnswered(message) {
  if (!isActiveKeeper()) return false;
  const load = message?.flags?.[COC7_ID]?.load;
  if (load?.as !== MELEE_CARD || load.participant !== DEFENDER || load.responded !== true || load.isNoResponse) {
    return false;
  }
  const defender = defenderOf(load);
  return defender ? markDefended(defender, message.id) : false;
}
