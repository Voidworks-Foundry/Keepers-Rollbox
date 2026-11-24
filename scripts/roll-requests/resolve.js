/**
 * Works out a request for one character: its checks, label, damage and link; reads the actor only.
 * See docs/roll-requests.md.
 */
import { COC7_ID, numberOrNull } from "../utils.js";
import {
  attributes, characteristics, groupBase, isCocid, sameSkill, sheetSkill, tableBaseFor, tableSkill
} from "../skill-values/index.js";
import { checkLink, cleanLabel, combinedLink, isSafeOption, isSafeRollKey, rollString } from "./links.js";

const ATTRIBUTE_LABELS = Object.freeze({ lck: "Luck", san: "SAN" });
const DICE_FORMULA = /^[0-9dD+\-*/() ]+$/;
const DIFFICULTY_WORDS = Object.freeze({ hard: "Hard ", extreme: "Extreme " });

// "i.skill.firearms-handgun" → "Firearms Handgun", so a label never shows a CoC ID.
function cocidName(cocid) {
  return String(cocid).replace(/^i\.skill\./, "").split("-").filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1)).join(" ");
}

function resolveSkill(actor, { name, cocid: givenCocid, value }) {
  // A weapon's stored skill can be a CoC ID instead of a name (`i.skill.throw`, CoC7's compendium weapons).
  const byCocid = isCocid(name);
  const cocid = givenCocid ?? (byCocid ? name : null);
  const entry = tableSkill(byCocid ? "" : name, cocid);
  const item = actor ? sheetSkill(actor, name, cocid ?? entry?.cocid) : null;
  if (item) {
    // CoC7 finds a renamed own language only by CoC ID; a table CoC ID would make it add a duplicate.
    const ownId = item.flags?.[COC7_ID]?.cocidFlag?.id;
    return { kind: "skill", display: item.name, onSheet: true, key: ownId || item.name, uuid: item.uuid,
      value: numberOrNull(item.system?.value) };
  }
  const base = actor && entry ? tableBaseFor(actor, entry.cocid) : null;
  return { kind: "skill", display: entry?.name ?? (byCocid ? cocidName(name) : name), onSheet: false,
    key: cocid ?? entry?.cocid ?? name, value: base ?? value ?? (byCocid ? null : groupBase(name)) };
}

/**
 * Returns one check for one character: its name, CoC7's key and its value for an NPC roll.
 * @param {Actor|null} actor
 * @param {object} check a check from requests.js
 * @returns {object}
 */
export function resolveCheck(actor, check) {
  if (check.kind === "characteristic") {
    const row = characteristics(actor).find((c) => c.key === check.name);
    return { kind: "characteristic", display: check.name.toUpperCase(), key: check.name, value: row?.value ?? null };
  }
  if (check.kind === "skill") return resolveSkill(actor, check);
  const value = attributes(actor).find((a) => a.key === check.name)?.value ?? null;
  return { kind: "attribute", display: ATTRIBUTE_LABELS[check.name], key: check.name, value };
}

function storedSkill(actor, ref) {
  if (!ref) return null;
  const byId = ref.id ? Array.from(actor?.items ?? []).find((item) => item?.id === ref.id && item.type === "skill") : null;
  const name = byId?.name ?? ref.name;
  return name ? { kind: "skill", name, cocid: byId?.flags?.[COC7_ID]?.cocidFlag?.id ?? null, value: null } : null;
}

// An alternative that isn't set falls back to the main skill, as CoC7 8.15's `skillAlternative` getter does.
function weaponSkill(actor, weapon, which) {
  const skill = weapon?.system?.skill ?? {};
  const alternative = which === "alternative" || (which !== "main" && weapon?.system?.usesAlternativeSkill === true);
  return (alternative ? storedSkill(actor, skill.alternativ) : null) ?? storedSkill(actor, skill.main);
}

/**
 * Returns the weapon's skills a flyout lists: main and alternative when CoC7 says it uses both and they differ.
 * @param {Actor} actor
 * @param {Item} weapon
 * @returns {{which: "main"|"alternative", skill: object|null}[]} `skill` null when none is set
 */
export function weaponSkills(actor, weapon) {
  const main = storedSkill(actor, weapon?.system?.skill?.main);
  const alternative = weapon?.system?.usesAlternativeSkill === true ? storedSkill(actor, weapon.system.skill?.alternativ) : null;
  if (main && alternative && !sameSkill(main, alternative)) {
    return [{ which: "main", skill: main }, { which: "alternative", skill: alternative }];
  }
  return [{ which: alternative ? "alternative" : "main", skill: alternative ?? main }];
}

function fullBonus(db) {
  const text = String(db ?? "").replace(/\s+/g, "").replace(/^\+/, "") || "0";
  return text.startsWith("-") ? text : `+${text}`;
}

// Halves as CoC7 8.15's `CoC7Utilities.halfDB`: positive numbers and dice sizes down, negatives away from zero.
function halfBonus(db) {
  return fullBonus(db).replace(/([+-])(\d+)(?:d(\d+))?/gi, (match, sign, count, size) => {
    const half = (n) => (sign === "-" ? Math.ceil(n / 2) : Math.floor(n / 2));
    return size === undefined ? `${sign}${half(Number(count))}` : `${sign}${count}D${half(Number(size))}`;
  });
}

function withoutZeros(formula) {
  return formula.replace(/[+-]0+(?![0-9d])/gi, "") || "0";
}

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
 * Returns a damage formula as the Keeper typed it ("1D6+DB"), checked by the rule used when it is sent.
 * @param {string} text
 * @returns {string|null} without spaces, or null when it isn't a damage roll
 */
export function damageText(text) {
  const formula = String(text ?? "").replace(/\s+/g, "");
  return formula && damageFormula(formula, null) ? formula : null;
}

function keeperLabel(checks, difficulty, text) {
  const names = cleanLabel(checks.map((c) => c.display).join(" + "));
  return `${DIFFICULTY_WORDS[difficulty] ?? ""}${names} · ${cleanLabel(text)}`;
}

/**
 * Returns what a check, weapon or improvised request means for one character, with the NPC note.
 * @param {object} request
 * @param {Actor} actor
 * @returns {object} `{ error }` when it can't go to this character; `warning` when it goes without its damage
 */
export function planCheck(request, actor) {
  const base = { difficulty: request.difficulty, dice: request.dice, blind: request.blind };
  if (request.type === "check") {
    const checks = request.checks.map((check) => resolveCheck(actor, check));
    const joiner = request.all ? " and " : " or ";
    const label = request.label ? keeperLabel(checks, request.difficulty, request.label)
      : (request.combined ? cleanLabel(checks.map((c) => c.display).join(joiner)) : "");
    // Only a label with the Keeper's own text goes in an NPC's note; the made-up ones are already on CoC7's card.
    return { ...base, checks, combined: request.combined, all: request.all, label, note: request.label ? label : null };
  }
  // Weapon labels name the check already ("Fighting (Brawl) with Candlestick"); the note adds the difficulty.
  const withDifficulty = (label) => ({ label, note: `${DIFFICULTY_WORDS[request.difficulty] ?? ""}${label}` });
  if (request.type === "weapon") {
    const weapon = Array.from(actor?.items ?? []).find((item) => item?.id === request.weaponId && item.type === "weapon");
    if (!weapon) return { error: `${actor?.name ?? "The character"}: that weapon isn't on the sheet.` };
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

/**
 * Returns the link text for a planned check or combined check.
 * @param {object} plan
 * @returns {string|null} null when a name can't go in a link
 */
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
