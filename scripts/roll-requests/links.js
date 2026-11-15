/**
 * Link text: CoC7's request links (`@coc7.check[…]{…}`, `@coc7.sanloss[…]{…}`), the roll strings its
 * combined and opposed cards read, and Foundry's inline damage roll. Pure text, no Foundry or CoC7 calls,
 * so it runs the same in tests. Formats: docs/BUILD-GUIDE.md, "CoC7 integration", "Link syntax".
 * Every option Rollbox sends is explicit (difficulty, dice, blind), never left to CoC7's defaults or the
 * roller's chat mode.
 */
import { escapeHtml } from "../utils.js";

/** The difficulties a menu can ask for. Hidden: the Keeper sets the difficulty on the result card afterwards. */
export const DIFFICULTIES = Object.freeze(["regular", "hard", "extreme", "hidden"]);

/**
 * CoC7's difficulty numbers (`CoC7DicePool.difficultyLevel`). Links, the actor check methods and `runRoll`
 * all accept them. Numbers, not `+` / `++`: CoC7's Sanity card reads its difficulty with `parseInt` and
 * throws on anything else (`CoC7DicePool#difficulty` setter, `apps/dice-pool.js`, CoC7 8.15).
 */
const LEVEL = Object.freeze({ regular: 1, hard: 2, extreme: 3, hidden: -1 });

/** In combined and opposed roll strings the difficulty is one digit, and 0 means hidden (`parseRolls`). */
const ROLL_STRING_LEVEL = Object.freeze({ regular: "1", hard: "2", extreme: "3", hidden: "0" });

/** Most bonus or penalty dice CoC7 allows (`CoC7DicePool.maxDiceBonus` / `maxDicePenalty`). */
export const MAX_DICE = 2;

/** Characters that break a link's `[key:value,…]` options: CoC7 splits on `,` and `:` and the enricher on brackets. */
const UNSAFE_OPTION = /[,:[\]{}]/;
/** Roll strings also split on `#` and join on `&&`. */
const UNSAFE_ROLL_KEY = /[,:[\]{}#&]/;
/**
 * Removed from labels and flavour text. Braces end the label; brackets would start other enrichers
 * (`[[…]]` inline rolls, `@UUID[…]`); angle brackets because CoC7 puts the label into the page as HTML
 * (`<span>${name}</span>`) after Foundry has decoded the message's entities.
 */
const UNSAFE_LABEL = /[[\]{}<>]/g;

/** CoC7's difficulty number for a menu difficulty; unknown values are regular. */
export const difficultyLevel = (difficulty) => LEVEL[difficulty] ?? LEVEL.regular;

/** True when the text can go inside a link's options. */
export const isSafeOption = (text) => typeof text === "string" && text.trim() !== "" && !UNSAFE_OPTION.test(text);

/** True when the text can be a key in a combined or opposed roll string. */
export const isSafeRollKey = (text) => typeof text === "string" && text.trim() !== "" && !UNSAFE_ROLL_KEY.test(text);

/** Text a link or label can show: unsafe characters removed, spaces collapsed, HTML-escaped. Empty gives "". */
export function cleanLabel(text) {
  const plain = String(text ?? "").replace(UNSAFE_LABEL, "").replace(/\s+/g, " ").trim();
  return escapeHtml(plain);
}

/** Free text for an option value such as a creature's name: anything that breaks the options removed. */
export function cleanOption(text) {
  return String(text ?? "").replace(/[,:[\]{}<>]/g, "").replace(/\s+/g, " ").trim();
}

/** `{label}` when there is one; CoC7 shows its own description of the check otherwise. */
const labelPart = (label) => (label ? `{${label}}` : "");
/** `blind` or `blind:false`, always one of them (BUILD-GUIDE "v14 chat modes"). */
const blindPart = (blind) => (blind ? "blind" : "blind:false");

/**
 * One check: `@coc7.check[subtype:skill,name:Spot Hidden,difficulty:2,poolModifier:1,blind:false]{label}`.
 * `poolModifier` is left out when there are no bonus or penalty dice: CoC7 picks its link text by whether
 * the option is present (`CoC7.LinkCheckDiffModif`), so `poolModifier:0` reads "[hard] Spot Hidden check(0)".
 * CoC7 treats a missing one as 0 when rolling (`CoC7RollNormalize`, `options.poolModifier ?? 0`).
 * @param {{subtype: "characteristic"|"attribute"|"skill", name: string, difficulty: string, dice: number,
 *   blind: boolean, label?: string}} check `name` must pass `isSafeOption`; `label` must be cleaned already.
 * @returns {string}
 */
export function checkLink({ subtype, name, difficulty, dice, blind, label }) {
  const options = [`subtype:${subtype}`, `name:${name}`, `difficulty:${difficultyLevel(difficulty)}`];
  if (dice) options.push(`poolModifier:${dice}`);
  options.push(blindPart(blind));
  return `@coc7.check[${options.join(",")}]${labelPart(label)}`;
}

/**
 * One roll in a combined or opposed card: `[actorUuid#]type#key[#±dice]#difficulty`.
 * Without an actor, CoC7 uses the character of whoever clicks the link.
 * @param {{actorUuid?: string, type: "characteristic"|"attribute"|"skill", key: string, dice: number,
 *   difficulty: string}} roll `key` must pass `isSafeRollKey`.
 * @returns {string}
 */
export function rollString({ actorUuid, type, key, dice, difficulty }) {
  const parts = [type, key];
  if (actorUuid) parts.unshift(actorUuid);
  if (dice) parts.push(dice > 0 ? `+${dice}` : String(dice));
  parts.push(ROLL_STRING_LEVEL[difficulty] ?? ROLL_STRING_LEVEL.regular);
  return parts.join("#");
}

/**
 * A combined check, one roll compared with each check (Keeper Rulebook p. 92):
 * `@coc7.check[subtype:combinedall,rolls:skill#Spot Hidden#1&&skill#Listen#1,blind:false]{label}`.
 * The combined card is always public, so blind is always false (BUILD-GUIDE Gap 5).
 * @param {{all: boolean, rolls: string[], label?: string}} combined
 * @returns {string}
 */
export function combinedLink({ all, rolls, label }) {
  const subtype = all ? "combinedall" : "combinedany";
  return `@coc7.check[subtype:${subtype},rolls:${rolls.join("&&")},${blindPart(false)}]${labelPart(label)}`;
}

/**
 * A Sanity check: `@coc7.sanloss[sanMin:1,sanMax:1D6,sanReason:Ghoul,difficulty:1,poolModifier:0,blind:false]{label}`.
 * Always regular difficulty and no dice (the Sanity menu has neither). CoC7 ignores `blind` here (Gap 4).
 * `poolModifier:0` stays: without it CoC7's Sanity card also ignores the difficulty (`CoC7SanCheckCard.create`).
 * @param {{success: string, failure: string, creature?: string, label?: string}} sanity
 * @returns {string}
 */
export function sanityLink({ success, failure, creature, label }) {
  const options = [`sanMin:${success}`, `sanMax:${failure}`];
  if (creature) options.push(`sanReason:${creature}`);
  options.push(`difficulty:${LEVEL.regular}`, "poolModifier:0", blindPart(false));
  return `@coc7.sanloss[${options.join(",")}]${labelPart(label)}`;
}

/**
 * A Foundry inline roll the player clicks to roll damage: `[[/r 1D6+1D4 # Candlestick]]`.
 * @param {string} formula already checked by the caller to hold only dice characters.
 * @param {string} [flavor] shown with the roll; cleaned here.
 * @returns {string}
 */
export function damageRoll(formula, flavor) {
  const text = escapeHtml(String(flavor ?? "").replace(/[[\]{}<>#]/g, "").replace(/\s+/g, " ").trim());
  return `[[/r ${formula}${text ? ` # ${text}` : ""}]]`;
}
