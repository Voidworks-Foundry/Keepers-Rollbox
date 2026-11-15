/**
 * Working out a request for one character: which skill, characteristic or attribute it means on this sheet, how
 * CoC7 knows it, its value for an NPC roll, a weapon's skill, the damage formula with this character's damage
 * bonus, the label, and the CoC7 link text. Skill matching itself is skill-values'. Reads the actor only.
 */
import { COC7_ID, numberOrNull } from "../utils.js";
import {
  attributes, characteristics, groupBase, isCocid, sameSkill, sheetSkill, tableBaseFor, tableSkill
} from "../skill-values/index.js";
import { checkLink, cleanLabel, combinedLink, isSafeOption, isSafeRollKey, rollString } from "./links.js";

/** Idea and Know are INT and EDU rolls with their own names (Keeper Rulebook p. 90). */
const IDEA_KNOW = Object.freeze({ idea: { characteristic: "int", label: "Idea" }, know: { characteristic: "edu", label: "Know" } });
const ATTRIBUTE_LABELS = Object.freeze({ lck: "Luck", san: "Sanity" });
/** Damage formulas, once the damage bonus is filled in, may hold only dice and arithmetic. */
const DICE_FORMULA = /^[0-9dD+\-*/() ]+$/;
/** How a label or the Keeper's note names a difficulty in front of the check; Regular and Hidden add nothing. */
const DIFFICULTY_WORDS = Object.freeze({ hard: "Hard ", extreme: "Extreme " });

/**
 * A readable name for a CoC ID Rollbox's table doesn't have, so a label never reads "i.skill.…":
 * "i.skill.firearms-handgun" → "Firearms Handgun".
 */
function cocidName(cocid) {
  return String(cocid).replace(/^i\.skill\./, "").split("-").filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1)).join(" ");
}

/**
 * A skill for one character. On the sheet: requested by the sheet's own CoC ID, else its name (CoC7
 * finds a renamed own language only by CoC ID). Missing: by Rollbox's table CoC ID, else the name, with
 * the value an NPC is rolled at: the table's base (Dodge and Language (Own) from this character), else
 * the request's value, else the group base. Without an actor (Copy link) it is the generic request.
 */
function resolveSkill(actor, { name, cocid: givenCocid, value }) {
  // A weapon's stored skill can be a CoC ID instead of a name (`i.skill.throw`, CoC7's compendium weapons).
  const byCocid = isCocid(name);
  const cocid = givenCocid ?? (byCocid ? name : null);
  const entry = tableSkill(byCocid ? "" : name, cocid);
  const item = actor ? sheetSkill(actor, name, cocid ?? entry?.cocid) : null;
  if (item) {
    const ownId = item.flags?.[COC7_ID]?.cocidFlag?.id;
    return { kind: "skill", display: item.name, onSheet: true, key: ownId || item.name, uuid: item.uuid,
      value: numberOrNull(item.system?.value) };
  }
  const base = actor && entry ? tableBaseFor(actor, entry.cocid) : null;
  return { kind: "skill", display: entry?.name ?? (byCocid ? cocidName(name) : name), onSheet: false,
    key: cocid ?? entry?.cocid ?? name, value: base ?? value ?? (byCocid ? null : groupBase(name)) };
}

/** One check for one character: what to call it, how CoC7 knows it, and its value for an NPC roll. */
export function resolveCheck(actor, check) {
  if (check.kind === "characteristic") {
    const row = characteristics(actor).find((c) => c.key === check.name);
    return { kind: "characteristic", display: check.name.toUpperCase(), key: check.name, value: row?.value ?? null };
  }
  if (check.kind === "skill") return resolveSkill(actor, check);
  const value = attributes(actor).find((a) => a.key === check.name)?.value ?? null;
  if (IDEA_KNOW[check.name]) {
    const { characteristic, label } = IDEA_KNOW[check.name];
    return { kind: "characteristic", display: label, key: characteristic, ideaKnow: check.name, value };
  }
  return { kind: "attribute", display: ATTRIBUTE_LABELS[check.name], key: check.name, value };
}

/** One of a weapon's stored skills (`{ id, name }`): the sheet skill with that id, else the stored name. */
function storedSkill(actor, ref) {
  if (!ref) return null;
  const byId = ref.id ? Array.from(actor?.items ?? []).find((item) => item?.id === ref.id && item.type === "skill") : null;
  const name = byId?.name ?? ref.name;
  return name ? { kind: "skill", name, cocid: byId?.flags?.[COC7_ID]?.cocidFlag?.id ?? null, value: null } : null;
}

/**
 * The weapon's skill. `which` "main" or "alternative" picks one; left out, it is the alternative when CoC7
 * says the weapon uses it (automatic, burst, thrown), else the main one. An alternative that isn't set
 * falls back to the main skill, as CoC7's own `skillAlternative` getter does (`models/item/weapon-system.js`).
 * @returns {{kind: "skill", name: string, cocid: string|null, value: null}|null} null when none is set.
 */
function weaponSkill(actor, weapon, which) {
  const skill = weapon?.system?.skill ?? {};
  const alternative = which === "alternative" || (which !== "main" && weapon?.system?.usesAlternativeSkill === true);
  return (alternative ? storedSkill(actor, skill.alternativ) : null) ?? storedSkill(actor, skill.main);
}

/**
 * The skills the Item menu offers for a weapon, one row each: its main and its alternative skill when CoC7
 * says the weapon uses one (a knife that can be thrown: Fighting (Brawl) and Throw) and the two differ;
 * otherwise the one skill a request would use.
 * @returns {{which: "main"|"alternative", skill: object|null}[]} `skill` null when the weapon has none set.
 */
export function weaponSkills(actor, weapon) {
  const main = storedSkill(actor, weapon?.system?.skill?.main);
  const alternative = weapon?.system?.usesAlternativeSkill === true ? storedSkill(actor, weapon.system.skill?.alternativ) : null;
  if (main && alternative && !sameSkill(main, alternative)) {
    return [{ which: "main", skill: main }, { which: "alternative", skill: alternative }];
  }
  return [{ which: alternative ? "alternative" : "main", skill: alternative ?? main }];
}

/** A damage bonus with its sign, as CoC7 adds it (`apps/chat-damage.js`): "+1D4", "-1", "+0". */
function fullBonus(db) {
  const text = String(db ?? "").replace(/\s+/g, "").replace(/^\+/, "") || "0";
  return text.startsWith("-") ? text : `+${text}`;
}

/**
 * Half the damage bonus, for thrown weapons, the way CoC7 halves it (`CoC7Utilities.halfDB`): positive
 * numbers and dice sizes round down, negative numbers round away from zero ("1D4" → "+1D2", "-1" → "-1").
 * Text only; Foundry rolls the result.
 */
function halfBonus(db) {
  return fullBonus(db).replace(/([+-])(\d+)(?:d(\d+))?/gi, (match, sign, count, size) => {
    const half = (n) => (sign === "-" ? Math.ceil(n / 2) : Math.floor(n / 2));
    return size === undefined ? `${sign}${half(Number(count))}` : `${sign}${count}D${half(Number(size))}`;
  });
}

/** A formula without its "+0" / "-0" terms ("1D6+0" → "1D6"), so a zero damage bonus isn't shown; "0" if nothing is left. */
function withoutZeros(formula) {
  return formula.replace(/[+-]0+(?![0-9d])/gi, "") || "0";
}

/**
 * The damage formula with this character's damage bonus in place of `DB` / `½DB`, and no "+0" left in
 * it. Null when it isn't dice.
 */
function damageFormula(damage, actor) {
  if (!damage) return null;
  const db = actor?.system?.attribs?.db?.value;
  const formula = withoutZeros(damage.replace(/\s+/g, "")
    .replace(/\+?(?:½|1\/2)DB/gi, () => halfBonus(db))
    .replace(/\+?DB/gi, () => fullBonus(db)));
  if (!DICE_FORMULA.test(formula) || /DB/i.test(formula)) return null;
  const validate = globalThis.Roll?.validate;
  if (typeof validate === "function" && !validate.call(globalThis.Roll, formula)) return null;
  return formula;
}

/**
 * A damage formula as the Keeper writes it, before any character's damage bonus is known ("1D6+DB",
 * "1D4+½DB", "1D6+1D4"), checked by the same rule as when it is sent. For the Item menu's damage line.
 * @param {string} text
 * @returns {string|null} the formula with spaces removed, or null when it isn't a damage roll.
 */
export function damageText(text) {
  const formula = String(text ?? "").replace(/\s+/g, "");
  return formula && damageFormula(formula, null) ? formula : null;
}

/**
 * The label when the Keeper typed one: the check as CoC7 names it, then the Keeper's text, so the player
 * still sees what to roll. "Hard Spot Hidden · notice the knife"; combined, "Spot
 * Hidden + Listen · notice the knife". `text` is cleaned already.
 */
function keeperLabel(checks, difficulty, text) {
  const names = cleanLabel(checks.map((c) => c.display).join(" + "));
  return `${DIFFICULTY_WORDS[difficulty] ?? ""}${names} · ${text}`;
}

/**
 * What a check-type request (check, weapon, improvised) means for one character: the resolved checks,
 * the label, the damage, and `note`: what the Keeper's note says for an NPC, whose private CoC7 card drops
 * the label. `{ error }` when it can't be sent to this character; `warning` when it goes without something
 * (a damage formula Foundry can't roll), for the sender to tell the Keeper.
 */
export function planCheck(request, actor) {
  const base = { difficulty: request.difficulty, dice: request.dice, blind: request.blind };
  if (request.type === "check") {
    const checks = request.checks.map((check) => resolveCheck(actor, check));
    const joiner = request.all ? " and " : " or ";
    const label = request.label ? keeperLabel(checks, request.difficulty, request.label)
      : (request.combined ? cleanLabel(checks.map((c) => c.display).join(joiner)) : (checks[0].ideaKnow ? checks[0].display : ""));
    // Only a label with the Keeper's own text goes in an NPC's note; the made-up ones are already on CoC7's card.
    return { ...base, checks, combined: request.combined, all: request.all, label, note: request.label ? label : null };
  }
  // Weapon labels name the check already ("Fighting (Brawl) with Candlestick"); the note adds the difficulty.
  const withDifficulty = (label) => ({ label, note: `${DIFFICULTY_WORDS[request.difficulty] ?? ""}${label}` });
  if (request.type === "weapon") {
    const weapon = Array.from(actor?.items ?? []).find((item) => item?.id === request.weaponId && item.type === "weapon");
    if (!weapon) return { error: `${actor?.name ?? "Copy link"}: that weapon isn't on the sheet.` };
    const skill = weaponSkill(actor, weapon, request.skill ?? undefined);
    if (!skill) return { error: `${actor.name}: the ${weapon.name} has no skill set on its sheet.` };
    const check = resolveCheck(actor, skill);
    return { ...base, checks: [check], combined: false, ...withDifficulty(cleanLabel(`${check.display} with the ${weapon.name}`)) };
  }
  const check = resolveCheck(actor, request.skill);
  const damage = damageFormula(request.damage, actor);
  const plan = { ...base, checks: [check], combined: false, ...withDifficulty(cleanLabel(`${check.display} with ${request.what}`)) };
  if (damage) return { ...plan, damage: { formula: damage, flavor: `${request.what} damage` } };
  if (!request.damage) return plan;
  return { ...plan, warning: `"${request.damage}" isn't a damage roll Foundry can make; the request goes without it.` };
}

/** The link text for a planned check or combined check. Null when a name can't go in a link. */
export function linkForPlan(plan) {
  if (plan.combined) {
    const rolls = plan.checks.map((check) => (isSafeRollKey(check.key)
      ? rollString({ type: check.kind, key: check.key, dice: plan.dice, difficulty: plan.difficulty }) : null));
    return rolls.includes(null) ? null : combinedLink({ all: plan.all, rolls, label: plan.label });
  }
  const [check] = plan.checks;
  if (!isSafeOption(check.key)) return null;
  return checkLink({ subtype: check.kind, name: check.key, difficulty: plan.difficulty, dice: plan.dice,
    blind: plan.blind, label: plan.label });
}
