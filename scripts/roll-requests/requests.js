/**
 * Request descriptions: what the Keeper's menus ask for, as plain data, checked and tidied before anything is
 * sent (a check or combined check, a Sanity check, a weapon, an improvised weapon, an opposed roll). Nothing here
 * talks to CoC7 or Foundry; index.js sends what these return.
 */
import { actorKey, numberOrNull, warn } from "../utils.js";
import { CHARACTERISTICS } from "../skill-values/index.js";
import { DIFFICULTIES, MAX_DICE, cleanLabel, cleanOption } from "./links.js";

const KINDS = Object.freeze(["characteristic", "attribute", "skill"]);
/** Attribute keys a menu sends: CoC7's Luck (the Other menu). Sanity checks go through sanityRequest. */
const ATTRIBUTES = Object.freeze(["lck"]);
/** Which of a weapon's two skills a request uses; anything else means "the one CoC7's cards would use". */
const WEAPON_SKILLS = Object.freeze(["main", "alternative"]);
/** One term of a Sanity loss: a whole number, or dice such as D6, 1D6, 2D10 (no zero dice, no zero faces). */
const SAN_TERM = /(?:[1-9]\d*)?D[1-9]\d*|\d+/.source;
/**
 * A Sanity loss: terms joined by + or -, e.g. 1D4+1, 1D6+1D4. CoC7 hands both losses to Foundry's Roll and
 * draws the failure loss's maximum every time the card renders, so a malformed one breaks the card
 * (BUILD-GUIDE "Cards: Sanity").
 */
const SAN_LOSS = new RegExp(`^(?:${SAN_TERM})(?:[+-](?:${SAN_TERM}))*$`);
/** Longer than any loss in the rulebook; stops pasted junk. */
const MAX_LOSS_LENGTH = 20;

const normalDifficulty = (difficulty) => (DIFFICULTIES.includes(difficulty) ? difficulty : "regular");

/** Whole bonus (positive) or penalty (negative) dice, at most two either way (Keeper Rulebook p. 91). */
function normalDice(dice) {
  const n = Math.trunc(Number(dice) || 0);
  return Math.max(-MAX_DICE, Math.min(MAX_DICE, n));
}

/**
 * One check as the menus describe it, checked and tidied. Null when it can't be requested.
 * Characteristic: `name` is CoC7's key (`str` … `edu`). Attribute: `lck`.
 * Skill: `name` as listed (`Spot Hidden`, `Pilot (Boat)`), optional `cocid`, and optional `value`: the
 * value to roll an NPC at when the skill isn't on its sheet (the "+ Add" entry's group base or the
 * Keeper's typed value). Skills in Rollbox's table take their base from the table instead.
 */
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
 * A check, or a combined check when two or more are given (one roll compared with each, Keeper Rulebook
 * p. 92). A combined check is never blind: CoC7's combined card is always public. There is no Pushed
 * option: pushing happens from the Push button on CoC7's result card.
 * @param {{checks: {kind: string, name: string, cocid?: string, value?: number}[], all?: boolean,
 *   difficulty?: "regular"|"hard"|"extreme"|"hidden", dice?: number, blind?: boolean, label?: string}} options
 *   `all`: combined, true for "All of them", false for "Any one". `dice`: +1/+2 bonus, -1/-2 penalty.
 *   `label`: optional text shown to the player instead of CoC7's description.
 * @returns {object|null} the request, or null (with a warning) when a check can't be requested.
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
 * A typed Sanity loss, tidied: spaces removed, upper case ("1d4 + 1" → "1D4+1"). Empty gives `empty`. The one
 * rule for losses: the Sanity menu's value lines and sanityRequest both use it.
 * @param {string} text what the Keeper typed
 * @param {string|null} [empty] what an empty field stands for (null: the field is required)
 * @returns {string|null} the loss, or null when it isn't a number or dice formula.
 */
export function sanityLoss(text, empty = null) {
  const loss = String(text ?? "").replace(/\s+/g, "").toUpperCase();
  if (!loss) return empty;
  return loss.length <= MAX_LOSS_LENGTH && SAN_LOSS.test(loss) ? loss : null;
}

/**
 * A Sanity check (CoC7's Sanity card). No blind (CoC7 can't) and no difficulty or dice.
 * @param {{success?: string, failure?: string, cause?: string, creature?: string}} options
 *   `success` / `failure`: SAN lost on a success / failure ("0", "1D6"). `cause`: shown to the players
 *   instead of the numbers (the link's label only). `creature`: the creature or source by name; CoC7
 *   records it to cap later losses to the same kind, so only for a creature, never free text.
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
 * A weapon's skill check, labelled with the weapon ("Firearms (Handgun) with the .38 Revolver"). Never
 * CoC7's weapon link, which starts its attack card and ignores difficulty, dice and blind (Gap 2).
 * @param {{weaponId: string, skill?: "main"|"alternative", difficulty?: string, dice?: number,
 *   blind?: boolean}} options `skill`: the weapon's main or alternative skill (e.g. a knife's Fighting
 *   (Brawl) or Throw). Left out: the alternative when CoC7 says the weapon uses it, else the main one.
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
 * An improvised weapon: an ordinary skill check labelled with the object, plus a damage roll the player
 * can click when damage is given. Nothing is added to the sheet.
 * @param {{what: string, skill: string|{name: string, cocid?: string, value?: number}, damage?: string,
 *   difficulty?: string, dice?: number, blind?: boolean}} options `damage`: e.g. "1D6+DB"; `DB` and `½DB`
 *   are filled in with each character's damage bonus when sent.
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
 * An opposed roll: exactly two sides, each a character, a check and bonus or penalty dice. No difficulty:
 * the other side's result is the difficulty (Keeper Rulebook p. 92). Can't be pushed (p. 90).
 * @param {{sides: {actor: Actor, check: object, dice?: number}[]}} options
 * @returns {object|null}
 */
export function opposedRequest({ sides = [] } = {}) {
  const list = Array.from(sides ?? []).map((side) => ({ actor: side?.actor, check: normalCheck(side?.check),
    dice: normalDice(side?.dice) }));
  const valid = list.length === 2 && list.every((side) => side.actor && side.check)
    && actorKey(list[0].actor) !== actorKey(list[1].actor);
  if (!valid) {
    warn("opposedRequest: needs exactly two different characters, each with a check.");
    return null;
  }
  return { type: "opposed", sides: list };
}
