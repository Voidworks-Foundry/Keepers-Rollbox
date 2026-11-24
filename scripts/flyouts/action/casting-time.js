const COMBAT_ROUNDS = 6;

const LONG = /\b(minute|hour|day|week|month|year)s?\b/i;
const DOSES = /\b(preparation|apply|applied)\b/i;
// A time with no upper end, e.g. "5+ rounds"; the lookahead keeps "1D6+4" out.
const OPEN = /(\d\s*\+(?!\s*\d))|\bor more\b|\bat least\b|\bminimum\b|\bper\b|\bvariable\b|\bseveral\b|\bmany\b/i;
const DICE = /(\d*)\s*d\s*(\d+)(?:\s*\+\s*(\d+))?/gi;

const cache = new Map();

function worstRounds(text) {
  let rest = String(text ?? "");
  const values = [];
  rest = rest.replace(DICE, (_, count, sides, extra) => {
    values.push((Number(count) || 1) * Number(sides) + (Number(extra) || 0));
    return " ";
  });
  for (const match of rest.matchAll(/\d+/g)) values.push(Number(match[0]));
  return values.length ? Math.max(...values) : null;
}

/**
 * Returns the verdict for a casting-time text; only "in" is listed in combat.
 * @param {string} castingTime CoC7's `system.castingTime`
 * @returns {"in"|"out"|"unknown"}
 */
export function readCastingTime(castingTime) {
  const text = String(castingTime ?? "").trim();
  if (!text) return "unknown";
  if (DOSES.test(text)) return "out";
  if (/instant/i.test(text)) return "in";
  if (LONG.test(text)) return "out";
  if (/round/i.test(text)) {
    if (OPEN.test(text)) return "unknown";
    const worst = worstRounds(text);
    if (worst === null) return "unknown";
    return worst <= COMBAT_ROUNDS ? "in" : "out";
  }
  return "unknown";
}

/**
 * Returns the verdict for a spell item, cached until its casting time changes.
 * @param {Item} spell
 * @returns {"in"|"out"|"unknown"}
 */
export function spellVerdict(spell) {
  const text = String(spell?.system?.castingTime ?? "");
  const key = spell?.uuid ?? spell?.id ?? null;
  if (key === null) return readCastingTime(text);
  const hit = cache.get(key);
  if (hit && hit.text === text) return hit.verdict;
  const verdict = readCastingTime(text);
  cache.set(key, { text, verdict });
  return verdict;
}

/**
 * Returns whether the Spell tab lists a spell during combat.
 * @param {Item} spell
 * @returns {boolean}
 */
export function castableInCombat(spell) {
  return spellVerdict(spell) === "in";
}
