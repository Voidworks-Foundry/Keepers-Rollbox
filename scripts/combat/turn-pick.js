import { turnsOf, viewedCombat } from "./encounter.js";

let picked = null;

/**
 * Returns the Keeper's pick in the turn order while still in it.
 * @param {Combat|null} [combat]
 * @returns {Combatant|null}
 */
export function pickedCombatant(combat = viewedCombat()) {
  if (!picked || !combat || picked.combat !== combat.id) return null;
  return turnsOf(combat).find((combatant) => combatant.id === picked.combatant) ?? null;
}

/**
 * Sets whom the Keeper's panel acts for; null follows the turn.
 * @param {Combatant|null} combatant
 * @param {Combat|null} [combat]
 * @returns {void}
 */
export function pickCombatant(combatant, combat = viewedCombat()) {
  picked = combatant && combat ? { combat: combat.id, combatant: combatant.id } : null;
}

/**
 * Forgets the pick, so the panel follows the current turn.
 * @returns {void}
 */
export function followTurn() {
  picked = null;
}
