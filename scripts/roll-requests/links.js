/** CoC7's link text, roll strings and Foundry's inline damage roll; pure text. See docs/roll-requests.md. */
import { escapeHtml } from "../utils.js";

/** The difficulties a flyout can ask for. */
export const DIFFICULTIES = Object.freeze(["regular", "hard", "extreme", "hidden"]);

// CoC7 8.15: numbers, never `+` / `++`, which the Sanity card's parseInt throws on; 0 means hidden in roll strings.
const LEVEL = Object.freeze({ regular: 1, hard: 2, extreme: 3, hidden: -1 });

const ROLL_STRING_LEVEL = Object.freeze({ regular: "1", hard: "2", extreme: "3", hidden: "0" });

/** The most bonus or penalty dice CoC7 allows. */
export const MAX_DICE = 2;

// Security: CoC7 puts names and labels into the page as HTML, after Foundry decodes entities; brackets start enrichers.
const UNSAFE_OPTION = /[,:[\]{}<>]/;
const UNSAFE_ROLL_KEY = /[,:[\]{}#&<>]/;
const UNSAFE_LABEL = /[[\]{}<>]/g;

/**
 * Returns CoC7's difficulty number for a flyout difficulty; unknown values are regular.
 * @param {string} difficulty
 * @returns {number}
 */
export const difficultyLevel = (difficulty) => LEVEL[difficulty] ?? LEVEL.regular;

/**
 * Returns whether the text can go inside a link's options.
 * @param {*} text
 * @returns {boolean}
 */
export const isSafeOption = (text) => typeof text === "string" && text.trim() !== "" && !UNSAFE_OPTION.test(text);

/**
 * Returns whether the text can be a key in a combined or opposed roll string.
 * @param {*} text
 * @returns {boolean}
 */
export const isSafeRollKey = (text) => typeof text === "string" && text.trim() !== "" && !UNSAFE_ROLL_KEY.test(text);

const ESCAPED = Object.freeze({ "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'" });

/**
 * Returns the text with unsafe characters removed, spaces collapsed and HTML escaped; cleaning twice changes nothing.
 * @param {*} text
 * @returns {string}
 */
export function cleanLabel(text) {
  const plain = String(text ?? "").replace(/&(?:amp|lt|gt|quot|#39);/g, (entity) => ESCAPED[entity])
    .replace(UNSAFE_LABEL, "").replace(/\s+/g, " ").trim();
  return escapeHtml(plain);
}

/**
 * Returns whole bonus (+) or penalty (−) dice, at most MAX_DICE either way; anything else is 0.
 * @param {*} dice
 * @returns {number}
 */
export function wholeDice(dice) {
  const n = Math.trunc(Number(dice) || 0);
  return Math.max(-MAX_DICE, Math.min(MAX_DICE, n));
}

/**
 * Returns free text, such as a creature's name, with anything that breaks a link's options removed.
 * @param {*} text
 * @returns {string}
 */
export function cleanOption(text) {
  return String(text ?? "").replace(/[,:[\]{}<>]/g, "").replace(/\s+/g, " ").trim();
}

function labelPart(label) {
  const clean = cleanLabel(label);
  return clean ? `{${clean}}` : "";
}
const blindPart = (blind) => (blind ? "blind" : "blind:false");

/**
 * Returns a `@coc7.check[…]{label}` link for one check; `name` must pass `isSafeOption`.
 * @param {{subtype: string, name: string, difficulty: string, dice: number, blind: boolean, label?: string}} check
 * @returns {string}
 */
export function checkLink({ subtype, name, difficulty, dice, blind, label }) {
  const options = [`subtype:${subtype}`, `name:${name}`, `difficulty:${difficultyLevel(difficulty)}`];
  const pool = wholeDice(dice);
  // CoC7 8.15 words the link by whether poolModifier is there at all, so "poolModifier:0" would read "check(0)".
  if (pool) options.push(`poolModifier:${pool}`);
  options.push(blindPart(blind));
  return `@coc7.check[${options.join(",")}]${labelPart(label)}`;
}

/**
 * Returns one roll string, `[actorUuid#]type#key[#±dice]#difficulty`; `key` must pass `isSafeRollKey`.
 * @param {{actorUuid?: string, type: string, key: string, dice: number, difficulty: string}} roll
 * @returns {string}
 */
export function rollString({ actorUuid, type, key, dice, difficulty }) {
  const parts = [type, key];
  if (actorUuid) parts.unshift(actorUuid);
  const pool = wholeDice(dice);
  if (pool) parts.push(pool > 0 ? `+${pool}` : String(pool));
  parts.push(ROLL_STRING_LEVEL[difficulty] ?? ROLL_STRING_LEVEL.regular);
  return parts.join("#");
}

/**
 * Returns a combined check's link; always `blind:false`, since CoC7's combined card is always public.
 * @param {{all: boolean, rolls: string[], label?: string}} combined
 * @returns {string}
 */
export function combinedLink({ all, rolls, label }) {
  const subtype = all ? "combinedall" : "combinedany";
  return `@coc7.check[subtype:${subtype},rolls:${rolls.join("&&")},${blindPart(false)}]${labelPart(label)}`;
}

/**
 * Returns a `@coc7.sanloss[…]{label}` link, at Regular with no dice.
 * @param {{success: string, failure: string, creature?: string, label?: string}} sanity
 * @returns {string}
 */
export function sanityLink({ success, failure, creature, label }) {
  const options = [`sanMin:${success}`, `sanMax:${failure}`];
  const reason = cleanOption(creature);
  if (reason) options.push(`sanReason:${reason}`);
  // CoC7 8.15: without poolModifier the Sanity card ignores the difficulty.
  options.push(`difficulty:${LEVEL.regular}`, "poolModifier:0", blindPart(false));
  return `@coc7.sanloss[${options.join(",")}]${labelPart(label)}`;
}

/**
 * Returns a Foundry inline roll the player clicks to roll damage: `[[/r formula # flavor]]`.
 * @param {string} formula already checked by the caller
 * @param {string} [flavor] cleaned here
 * @returns {string}
 */
export function damageRoll(formula, flavor) {
  const text = escapeHtml(String(flavor ?? "").replace(/[[\]{}<>#]/g, "").replace(/\s+/g, " ").trim());
  return `[[/r ${formula}${text ? ` # ${text}` : ""}]]`;
}
