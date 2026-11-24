/** A fight's state, read only, on every client; the changes are fight-changes.js's. See docs/combat.md. */
import { KEEPER, MODULE_ID, declareSettings, option, sameActor } from "../utils.js";
import { ownCharacter, playerRollboxOn } from "../player/index.js";
import { combatantFor, currentCombatant, roundOf, runningCombat, turnsOf } from "./encounter.js";
import { feetBetween, inSight } from "./sight.js";
import { isDefeated } from "./defeated.js";

/**
 * Declares the Join range setting.
 * @type {object[]}
 */
export const SETTINGS = declareSettings([
  { key: "rollboxJoinRange", scope: "world", type: Number, range: { min: 10, max: 200, step: 5 }, default: 60,
    section: "gameplay", label: "Join range (ft)",
    hint: "When you start combat after a first blow, investigators and Friendly or Hostile tokens this close to a fighter (in "
      + "feet, edge to edge) and in sight join it, standing by; at the start of every turn, those who came this close "
      + "are listed on one card for you to add or leave out. Neutral, Secret and hidden tokens never join on their own.",
    note: KEEPER }
]);

/**
 * Names the combatant flag set while standing by: "asked" or "out".
 * @type {string}
 */
export const STANDBY_FLAG = "standingBy";
/**
 * Names the combatant flag holding the round a standing-by combatant acts in.
 * @type {string}
 */
export const ACTS_FLAG = "actsRound";
/**
 * Names the combatant flag holding a round whose turn is skipped.
 * @type {string}
 */
export const SKIP_FLAG = "skipRound";
/**
 * Names the encounter flag `{ attacker, targets }` that marks a fight Rollbox started.
 * @type {string}
 */
export const FIGHT_FLAG = "fight";
/**
 * Names the encounter flag holding the token ids left out of the fight.
 * @type {string}
 */
export const LEFT_OUT_FLAG = "leftOut";
const DISPOSITIONS = Object.freeze({ secret: -2, hostile: -1, neutral: 0, friendly: 1 });
const JOIN_RANGE_DEFAULT = 60;
/**
 * Names the update option that puts the turn back after adding someone, so the update isn't a new turn.
 * @type {string}
 */
export const KEEP_TURN = "rollboxKeepTurn";
/**
 * Names the update option for a turn Place on standby ended, which counts as taken even in round 1.
 * @type {string}
 */
export const ENDS_TURN = "rollboxEndsTurn";
/**
 * Names the update option for Rollbox's own skip past standing-by turns, which is no turn start for who is in.
 * @type {string}
 */
export const OWN_STEP = "rollboxOwnStep";

/**
 * Reads a Rollbox flag on an encounter or combatant.
 * @param {Document} doc
 * @param {string} key
 * @returns {*} null if unset
 */
export const flagOf = (doc, key) => {
  try {
    return doc?.getFlag?.(MODULE_ID, key) ?? null;
  } catch {
    return null;
  }
};

/**
 * Tells whether and how a combatant stands by.
 * @param {Combatant} combatant
 * @returns {"asked"|"out"|null} null for a fighter
 */
export function standingBy(combatant) {
  const value = flagOf(combatant, STANDBY_FLAG);
  return value === "asked" || value === "out" ? value : null;
}

/**
 * Tells whether a standing-by combatant acts this round.
 * @param {Combatant} combatant
 * @param {Combat} [combat]
 * @returns {boolean}
 */
export function actsThisRound(combatant, combat = combatant?.parent ?? runningCombat()) {
  return standingBy(combatant) !== null && flagOf(combatant, ACTS_FLAG) === roundOf(combat);
}

/**
 * Tells whether a standing-by combatant is taking their Act this round turn now.
 * @param {Combatant} combatant
 * @param {Combat} [combat]
 * @returns {boolean}
 */
export function actingNow(combatant, combat = combatant?.parent ?? runningCombat()) {
  return Boolean(combat?.started) && actsThisRound(combatant, combat) && currentCombatant(combat) === combatant;
}

/**
 * Tells whether Rollbox started this encounter, and so manages who is in it.
 * @param {Combat} combat
 * @returns {boolean}
 */
export const isFight = (combat) => Boolean(flagOf(combat, FIGHT_FLAG));

/**
 * Returns the fight's `{ attacker, targets }` names.
 * @param {Combat} combat
 * @returns {{attacker: string, targets: string[]}|null}
 */
export const fightStart = (combat) => flagOf(combat, FIGHT_FLAG);

/**
 * Returns the join range in feet.
 * @returns {number}
 */
export function joinRange() {
  const value = Number(option("rollboxJoinRange"));
  return Number.isFinite(value) && value > 0 ? value : JOIN_RANGE_DEFAULT;
}

/**
 * Tells whether the actor is an investigator (CoC7's `character` type).
 * @param {Actor} actor
 * @returns {boolean}
 */
export const isInvestigator = (actor) => actor?.type === "character";

function dispositionOf(token) {
  const value = Number(token?.document?.disposition ?? token?.disposition);
  return Number.isFinite(value) ? value : DISPOSITIONS.neutral;
}

/**
 * Names a token's disposition, e.g. "Hostile".
 * @param {Token} token
 * @returns {string}
 */
export function dispositionText(token) {
  const value = dispositionOf(token);
  return Object.entries(DISPOSITIONS).find(([, n]) => n === value)?.[0]?.replace(/^./, (c) => c.toUpperCase())
    ?? "Neutral";
}

/**
 * Tells whether a token is hidden from players.
 * @param {Token|TokenDocument} token
 * @returns {boolean}
 */
export const hiddenToken = (token) => (token?.document ?? token)?.hidden === true;

/**
 * Tells whether a token joins a fight on its own: not hidden, and on a side.
 * @param {Token} token
 * @returns {boolean}
 */
export function joinsOnItsOwn(token) {
  if (!token?.actor || hiddenToken(token)) return false;
  if (isInvestigator(token.actor)) return true;
  const disposition = dispositionOf(token);
  return disposition === DISPOSITIONS.friendly || disposition === DISPOSITIONS.hostile;
}

/**
 * Tells whether a token is an investigator, Friendly or Hostile, hidden or not.
 * @param {Token} token
 * @returns {boolean}
 */
export const onASide = (token) => isInvestigator(token?.actor)
  || [DISPOSITIONS.friendly, DISPOSITIONS.hostile].includes(dispositionOf(token));

/**
 * Finds the first of `others` within join range and in sight.
 * @param {Token} token
 * @param {Token[]} others
 * @returns {Token|null}
 */
export function nearOf(token, others) {
  const range = joinRange();
  return others.find((other) => other && other !== token && other.id !== token.id
    && (feetBetween(token, other) ?? Infinity) <= range && inSight(token, other)) ?? null;
}

/**
 * Returns the tokens drawn on the viewed scene that have a character.
 * @returns {Token[]}
 */
export function sceneTokens() {
  try {
    return Array.from(globalThis.canvas?.tokens?.placeables ?? []).filter((token) => token?.actor);
  } catch {
    return [];
  }
}

/**
 * Returns a combatant's token on the canvas.
 * @param {Combatant} combatant
 * @returns {Token|null}
 */
export const placeableOf = (combatant) => combatant?.token?.object ?? null;

/**
 * Finds the combatant for a token, else for its character.
 * @param {Combat|null} combat
 * @param {Token} token
 * @returns {Combatant|null}
 */
export function combatantOfToken(combat, token) {
  if (!combat) return null;
  return turnsOf(combat).find((combatant) => combatant.tokenId === token.id)
    ?? (token.actor ? combatantFor(token.actor, combat) : null);
}

/**
 * Returns the drawn tokens of everyone not standing by.
 * @param {Combat} combat
 * @returns {Token[]}
 */
export function fighterTokens(combat) {
  return turnsOf(combat).filter((combatant) => !standingBy(combatant)).map(placeableOf).filter(Boolean);
}

/**
 * Finds the active player whose own investigator this is, with the Player Rollbox on.
 * @param {Actor} actor
 * @returns {User|null}
 */
export function askablePlayer(actor) {
  if (!isInvestigator(actor) || !playerRollboxOn()) return null;
  try {
    return Array.from(globalThis.game?.users ?? []).find((user) => user && !user.isGM && user.active
      && sameActor(ownCharacter(user), actor)) ?? null;
  } catch {
    return null;
  }
}

function skipDefeatedOn(combat = runningCombat()) {
  try {
    return combat?.settings?.skipDefeated === true;
  } catch {
    return false;
  }
}

/**
 * Tells whether a combatant's turn is skipped this round.
 * @param {Combatant} combatant
 * @param {Combat} combat
 * @returns {boolean}
 */
export function skipsTurn(combatant, combat) {
  if (isDefeated(combatant) && skipDefeatedOn(combat)) return true;
  const round = roundOf(combat);
  if (flagOf(combatant, SKIP_FLAG) === round) return true;
  return standingBy(combatant) !== null && flagOf(combatant, ACTS_FLAG) !== round;
}

/**
 * Tells whether a standing-by combatant acts next round.
 * @param {Combatant} combatant
 * @param {Combat} [combat]
 * @returns {boolean}
 */
export function actsNextRound(combatant, combat = combatant?.parent ?? runningCombat()) {
  return standingBy(combatant) !== null && flagOf(combatant, ACTS_FLAG) === roundOf(combat) + 1;
}

/**
 * Returns the token ids left out of this fight.
 * @param {Combat} combat
 * @returns {Set<string>}
 */
export const leftOutOf = (combat) => new Set(Array.from(flagOf(combat, LEFT_OUT_FLAG) ?? []));
