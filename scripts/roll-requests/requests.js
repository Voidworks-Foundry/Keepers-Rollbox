/** Request descriptions: what the flyouts ask for, as plain data, checked and tidied. See docs/roll-requests.md. */
import { actorKey, numberOrNull, warn } from "../utils.js";
import { CHARACTERISTICS } from "../skill-values/index.js";
import { DIFFICULTIES, cleanLabel, cleanOption, wholeDice } from "./links.js";

const KINDS = Object.freeze(["characteristic", "attribute", "skill"]);
const ATTRIBUTES = Object.freeze(["lck", "san"]);
const WEAPON_SKILLS = Object.freeze(["main", "alternative"]);
const SAN_TERM = /(?:[1-9]\d*)?D[1-9]\d*|\d+/.source;
// CoC7 8.15 rolls the failure loss's maximum each time the card renders, so a malformed loss breaks the card.
const SAN_LOSS = new RegExp(`^(?:${SAN_TERM})(?:[+-](?:${SAN_TERM}))*$`);
// Longer than any loss in the rulebook; stops pasted junk.
const MAX_LOSS_LENGTH = 20;

const normalDifficulty = (difficulty) => (DIFFICULTIES.includes(difficulty) ? difficulty : "regular");

const normalDice = wholeDice;

function normalCheck(check) {
  if (!check || !KINDS.includes(check.kind)) return null;
  const name = String(check.name ?? "").trim();
  if (!name) return null;
  if (check.kind === "characteristic") {
    const key = name.toLowerCase();
    return CHARACTERISTICS.includes(key) ? { kind: "characteristic", name: key } : null;
  }
  if (check.kind === "attribute") {
    const key = name.toLowerCase();
    return ATTRIBUTES.includes(key) ? { kind: "attribute", name: key } : null;
  }
  return { kind: "skill", name, cocid: check.cocid || null, value: numberOrNull(check.value) };
}

/**
 * Returns a check request, combined when two or more checks are given; a combined check is never blind.
 * @param {{checks: object[], all?: boolean, difficulty?: string, dice?: number, blind?: boolean, label?: string}} options
 * @returns {object|null} null, with a warning, when a check can't be requested
 */
export function checkRequest({ checks = [], all = true, difficulty, dice, blind = false, label } = {}) {
  const list = Array.from(checks ?? []).map(normalCheck);
  if (!list.length || list.includes(null)) {
    warn("checkRequest: every check needs a kind (characteristic, attribute, skill) and a known name.");
    return null;
  }
  const combined = list.length > 1;
  return {
    type: "check",
    checks: list,
    combined,
    all: all !== false,
    difficulty: normalDifficulty(difficulty),
    dice: normalDice(dice),
    blind: combined ? false : blind === true,
    label: cleanLabel(label)
  };
}

/**
 * Returns a typed Sanity loss tidied ("1d4 + 1" → "1D4+1"), or null when it isn't a number or dice formula.
 * @param {string} text
 * @param {string|null} [empty] what an empty field stands for
 * @returns {string|null}
 */
export function sanityLoss(text, empty = null) {
  const loss = String(text ?? "").replace(/\s+/g, "").toUpperCase();
  if (!loss) return empty;
  return loss.length <= MAX_LOSS_LENGTH && SAN_LOSS.test(loss) ? loss : null;
}

/**
 * Returns a Sanity check request, with no blind, difficulty or dice.
 * @param {{success?: string, failure?: string, cause?: string, creature?: string}} options `cause`: the label;
 *   `creature`: CoC7 caps later losses to the same name, so never free text
 * @returns {object|null}
 */
export function sanityRequest({ success = "0", failure = "0", cause, creature } = {}) {
  const request = {
    type: "sanity",
    success: sanityLoss(success, "0"),
    failure: sanityLoss(failure, "0"),
    label: cleanLabel(cause),
    creature: cleanOption(creature)
  };
  if (request.success === null || request.failure === null) {
    warn("sanityRequest: losses must be numbers or dice, such as 1 or 1D6.");
    return null;
  }
  return request;
}

/**
 * Returns a request for a weapon's skill check, sent as a plain skill check labelled with the weapon.
 * @param {{weaponId: string, skill?: "main"|"alternative", difficulty?: string, dice?: number, blind?: boolean}} options
 * @returns {object|null}
 */
export function weaponRequest({ weaponId, skill, difficulty, dice, blind = false } = {}) {
  if (!weaponId) {
    warn("weaponRequest: needs the weapon's item id.");
    return null;
  }
  return { type: "weapon", weaponId: String(weaponId), skill: WEAPON_SKILLS.includes(skill) ? skill : null,
    difficulty: normalDifficulty(difficulty), dice: normalDice(dice), blind: blind === true };
}

/**
 * Returns an improvised weapon request: a skill check labelled with the object, with an optional damage roll.
 * @param {{what: string, skill: string|object, damage?: string, difficulty?: string, dice?: number, blind?: boolean}} options
 * @returns {object|null}
 */
export function improvisedRequest({ what, skill, damage, difficulty, dice, blind = false } = {}) {
  const object = String(what ?? "").trim();
  const check = normalCheck(typeof skill === "string" ? { kind: "skill", name: skill } : { ...skill, kind: "skill" });
  if (!object || !check) {
    warn("improvisedRequest: needs what it is and which skill.");
    return null;
  }
  return { type: "improvised", what: object, skill: check, damage: String(damage ?? "").trim(),
    difficulty: normalDifficulty(difficulty), dice: normalDice(dice), blind: blind === true };
}

/**
 * Returns an opposed roll request of two different characters; one side may be `open`, with no check.
 * @param {{sides: {actor: Actor, check?: object, dice?: number, open?: boolean}[]}} options
 * @returns {object|null}
 */
export function opposedRequest({ sides = [] } = {}) {
  const list = Array.from(sides ?? []).map((side) => (side?.open === true
    ? { actor: side.actor, check: null, dice: 0, open: true }
    : { actor: side?.actor, check: normalCheck(side?.check), dice: normalDice(side?.dice), open: false }));
  const valid = list.length === 2 && list.every((side) => side.actor && (side.open || side.check))
    && list.some((side) => !side.open) && actorKey(list[0].actor) !== actorKey(list[1].actor);
  if (!valid) {
    warn("opposedRequest: needs exactly two different characters, each with a check (one may be left open).");
    return null;
  }
  return { type: "opposed", sides: list };
}
