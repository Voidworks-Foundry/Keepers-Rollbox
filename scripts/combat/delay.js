/** Delay: moving the acting character later in this round's order, and putting everyone back next round. See docs/combat.md. */
import { MODULE_ID, flagsRemoved, isKeeper, warn } from "../utils.js";
import { askKeeper } from "../roll-requests/index.js";
import { currentCombatant, turnsOf } from "./encounter.js";
import { markNote } from "./round-notes.js";
import { standingBy } from "./fight-state.js";

/**
 * Names the combatant flag `{ round, initiative, nudged? }` holding the initiative before a Delay moved it this round;
 * `nudged`: a tied combatant moved aside so a Delay could land before it.
 * @type {string}
 */
export const DELAY_FLAG = "delayedFrom";

// Those standing by sit at the back and are skipped, so they aren't delayed past.
function fightersAfter(combat) {
  const turns = turnsOf(combat);
  const index = turns.indexOf(currentCombatant(combat));
  return index < 0 ? [] : turns.slice(index + 1).filter((combatant) => !standingBy(combatant));
}

/**
 * Returns how many fighters come after the acting one this round: the most places Delay can move.
 * @param {Combat|null} combat
 * @returns {number}
 */
export function delayRoom(combat) {
  return fightersAfter(combat).length;
}

function initiativeOf(combatant) {
  const value = Number(combatant?.initiative);
  return combatant?.initiative === null || combatant?.initiative === undefined || !Number.isFinite(value) ? null : value;
}

/**
 * Moves the acting character `places` fighters later this round, which ends their turn; their initiative is kept.
 * @param {Combat} combat
 * @param {number} places how many fighters to delay past, at least 1 (more than there are: to the end)
 * @returns {Promise<boolean>} true when moved; false with no one after them, an unrolled initiative, or a failure
 */
export async function delayTurn(combat, places = 1) {
  const turns = turnsOf(combat);
  const combatant = currentCombatant(combat);
  const index = turns.indexOf(combatant);
  const after = fightersAfter(combat);
  if (index < 0 || after.length < 1) return false;
  const waitFor = after[Math.max(1, Math.min(after.length, Math.trunc(Number(places)) || 1)) - 1];
  const past = initiativeOf(waitFor);
  if (past === null) {
    warn("couldn't delay: the initiative it would move past isn't rolled.");
    return false;
  }
  const rest = turns.slice(turns.indexOf(waitFor) + 1).filter((other) => other !== combatant);
  // Foundry v14 sorts a tie by id, so landing inside one moves the tied ones after the landing spot a little down.
  const tied = rest.filter((other) => initiativeOf(other) === past);
  const next = rest.map(initiativeOf).find((value) => value !== null && value < past) ?? null;
  const gap = next === null ? 1 : past - next;
  // Inside a tie the moves stay under one point, so the tracker's numbers barely change.
  const step = Math.min(1, gap) / 3;
  const initiative = tied.length ? past - step : (next === null ? past - 1 : past - gap / 2);
  if (tied.length && !isKeeper()) return askDelay(combatant, places);
  try {
    const own = ownInitiative(combatant, combat);
    const flag = `flags.${MODULE_ID}.${DELAY_FLAG}`;
    const moves = [{ _id: combatant.id, initiative, [flag]: { round: combat.round, initiative: own } },
      ...tied.map((other) => ({ _id: other.id, initiative: past - 2 * step,
        [flag]: { round: combat.round, initiative: ownInitiative(other, combat), nudged: true } }))];
    // Foundry v14 follows a moved combatant; `combatTurn` keeps the turn in place so the next person acts.
    if (tied.length) await combat.updateEmbeddedDocuments("Combatant", moves, { combatTurn: index });
    else await combatant.update(moves[0], { combatTurn: index });
    // Noted only once the move is made, so a failed move never reads Delayed.
    await markNote(combatant.actor, "delayed");
    return true;
  } catch (error) {
    warn("couldn't delay the turn.", error);
    return false;
  }
}

// The initiative before any move this round, a Delay or a tie moved aside, so the next round puts it back.
function ownInitiative(combatant, combat) {
  const saved = combatant.getFlag?.(MODULE_ID, DELAY_FLAG);
  return saved && saved.round === combat.round ? saved.initiative : combatant.initiative;
}

/**
 * Puts back the own initiative of everyone delayed in an earlier round. Keeper only: players can't update others.
 * @param {Combat} combat
 * @returns {Promise<number>} how many were put back
 */
export async function restoreDelayed(combat) {
  const updates = turnsOf(combat).flatMap((combatant) => {
    const saved = combatant.getFlag(MODULE_ID, DELAY_FLAG);
    if (!saved || saved.round === combat?.round) return [];
    return [{ _id: combatant.id, initiative: saved.initiative ?? null, ...flagsRemoved(DELAY_FLAG) }];
  });
  if (!updates.length) return 0;
  // At the top of the round the first in the order acts, whoever that is once they are back in place; later in
  // the round Foundry keeps the current turn's combatant.
  const options = combat.turn === 0 ? { combatTurn: 0 } : {};
  try {
    await combat.updateEmbeddedDocuments("Combatant", updates, options);
    return updates.length;
  } catch (error) {
    warn("couldn't put the delayed combatants back in their places.", error);
    return 0;
  }
}

// Players can't move other combatants, so a Delay that lands inside a tie is made by the Keeper's client.
async function askDelay(combatant, places) {
  const reply = await askKeeper("fight", { action: "delay", combatantId: combatant.id, places });
  return reply.ok && reply.answer === true;
}
