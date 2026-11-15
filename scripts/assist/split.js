/**
 * Assist's maths, Physical Human Limits (Keeper Rulebook p. 88–89, summary p. 407): who helps, who rolls, and at
 * which difficulty. Plain arithmetic, no Foundry or CoC7 calls; the chances are only for choosing the split and
 * showing the Keeper, while CoC7 rolls and judges the real rolls. Hard and Extreme values come from skill-values'
 * withLevels, which is plain arithmetic too.
 */
import { withLevels } from "../skill-values/index.js";

/**
 * A character can only try it when what's left is no more than 100 above their own value (p. 88: beyond
 * that, it's impossible for them).
 */
const REACH = 100;
/** Difficulty from what's left, as from an opposing value (p. 88): 50+ Hard, 90+ Extreme, below Regular. */
const HARD_FROM = 50;
const EXTREME_FROM = 90;
/** Which of withLevels' values each difficulty rolls against: the value, half or a fifth. */
const LEVEL = Object.freeze({ regular: "value", hard: "half", extreme: "fifth" });
/** Chances closer than this count as equal, so the split with fewer helpers wins the tie. */
const EPSILON = 1e-9;

/**
 * The difficulty for what's left (p. 88): below 50 Regular, 50 or more Hard, 90 or more Extreme.
 * @param {number} left
 * @returns {"regular"|"hard"|"extreme"}
 */
export function difficultyFor(left) {
  if (left >= EXTREME_FROM) return "extreme";
  if (left >= HARD_FROM) return "hard";
  return "regular";
}

/**
 * One roller's chance at this difficulty: their value, half or fifth (rounded down), out of 100. Only used to
 * pick the split and to show the Keeper; CoC7 rolls and judges the real roll.
 */
function rollChance(value, difficulty) {
  const target = withLevels(value)[LEVEL[difficulty]];
  return Math.min(Math.max(target, 0), 100) / 100;
}

/**
 * Who helps and who rolls. Helpers are taken lowest value first (equal values keep the order given, the
 * names card's); each takes their value off. After each, what's left must stay above 0 and every remaining
 * character must be able to try it (what's left no more than 100 + their value); everyone left rolls at the
 * difficulty for what's left. Of the splits that work (none helping counts, when everyone can try it alone),
 * the one with the best chance that at least one roller succeeds is used; ties go to fewer helpers. At least
 * one character always rolls.
 * Rulebook rafter (p. 88–89): 150 against Harvey 20, Cecil 40, Martin 45, Helen 60, Belinda 75 → Harvey,
 * Cecil and Martin help, Helen and Belinda roll at Regular (45 left), 90% that one succeeds.
 * @param {{value: number}[]} characters in names-card order; any other fields are kept (e.g. name, actor).
 *   One without a number value takes no part.
 * @param {number} against what they are up against (the object's SIZ, the creature's STR)
 * @returns {{helpers: object[], rollers: object[], left: number, difficulty: "regular"|"hard"|"extreme",
 *   chance: number}|null} Null when no split works ("too heavy").
 */
export function assistChoices(characters = [], against) {
  const target = Number(against);
  const order = Array.from(characters ?? []).filter((c) => Number.isFinite(c?.value))
    .sort((a, b) => a.value - b.value); // stable: equal values keep the names-card order
  if (!order.length || !Number.isFinite(target) || target <= 0) return null;
  let best = null;
  let left = target;
  for (let helpers = 0; helpers < order.length; helpers++) {
    if (helpers) left -= order[helpers - 1].value;
    if (left <= 0) break; // what's left must stay above 0; more helpers only take more off
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
