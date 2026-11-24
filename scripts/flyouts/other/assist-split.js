/** Assist's arithmetic (who helps, who rolls, at which difficulty) and characteristic reads. See docs/assist.md. */
import { characteristics, withLevels } from "../../skill-values/index.js";
import { difficultyFor } from "../../shared/index.js";

// Beyond their value plus this, a character can't try it (Keeper Rulebook p. 88).
const REACH = 100;
const LEVEL = Object.freeze({ regular: "value", hard: "half", extreme: "fifth" });
// Chances this close tie, and a tie goes to fewer helpers; the chance is only an estimate, CoC7 rolls for real.
const EPSILON = 1e-9;

function rollChance(value, difficulty) {
  const target = withLevels(value)[LEVEL[difficulty]];
  return Math.min(Math.max(target, 0), 100) / 100;
}

/**
 * Returns the split of helpers (lowest values first) and rollers with the best chance that one roller succeeds.
 * @param {{value: number}[]} characters in character-card order; other fields are kept; no number value takes no part
 * @param {number} against
 * @returns {{helpers: object[], rollers: object[], left: number, difficulty: "regular"|"hard"|"extreme",
 *   chance: number}|null} null when no split works
 */
export function assistChoices(characters = [], against) {
  const target = Number(against);
  const order = Array.from(characters ?? []).filter((c) => Number.isFinite(c?.value))
    .sort((a, b) => a.value - b.value); // stable, so equal values keep the character-card order
  if (!order.length || !Number.isFinite(target) || target <= 0) return null;
  let best = null;
  let left = target;
  for (let helpers = 0; helpers < order.length; helpers++) {
    if (helpers) left -= order[helpers - 1].value;
    if (left <= 0) break;
    const rollers = order.slice(helpers);
    if (!rollers.every((r) => left <= REACH + r.value)) continue;
    const difficulty = difficultyFor(left);
    const chance = 1 - rollers.reduce((miss, r) => miss * (1 - rollChance(r.value, difficulty)), 1);
    if (!best || chance > best.chance + EPSILON) best = { helpers, left, difficulty, chance };
  }
  if (!best) return null;
  return { helpers: order.slice(0, best.helpers), rollers: order.slice(best.helpers), left: best.left,
    difficulty: best.difficulty, chance: best.chance };
}

/** The characteristics Use and Against can be, in sheet order, keyed by CoC7's key. */
export const STATS = Object.freeze({ str: "STR", con: "CON", siz: "SIZ", dex: "DEX", app: "APP", int: "INT",
  pow: "POW", edu: "EDU" });

/**
 * Returns the actor's characteristic value, or null when its sheet has none.
 * @param {Actor} actor
 * @param {string} key a STATS key
 * @returns {number|null}
 */
export function valueOf(actor, key) {
  const value = characteristics(actor).find((c) => c.key === key)?.value;
  return Number.isFinite(value) ? value : null;
}
