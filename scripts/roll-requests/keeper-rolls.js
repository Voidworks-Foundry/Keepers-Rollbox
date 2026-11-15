/**
 * NPC rolls: a character with no player owner is rolled at once on the Keeper's side, privately, through CoC7's
 * actor methods, with no dialog (BUILD-GUIDE "Rolling NPCs"). How to roll it is decided first, then it is rolled
 * once, with the Keeper's note (a label CoC7's private card drops, a skill rolled at its base value, a combined
 * check's values) always just before CoC7's card.
 */
import { escapeHtml, tellKeeper } from "../utils.js";
import { damageRoll, difficultyLevel } from "./links.js";
import { callActor } from "./coc7.js";

/** CoC7's "raw value" roll type (`CoC7RollNormalize.ROLL_TYPE.MANUAL`): rolls a number, adds nothing to the sheet. */
const MANUAL_ROLL = "R/MA";

/** The Keepers' user ids, for Rollbox's private notes. */
function keeperIds() {
  const users = ChatMessage.getWhisperRecipients?.("GM") ?? Array.from(game.users ?? []).filter((u) => u.isGM);
  return Array.from(users).map((u) => u.id).filter(Boolean);
}

/** A note only the Keepers see, e.g. naming a skill rolled at its base value. Never public. */
async function keeperNote(lines) {
  const whisper = keeperIds();
  if (!lines.length || !whisper.length) return;
  const content = lines.map((line) => `<p>${line}</p>`).join("");
  await ChatMessage.create({ speaker: { alias: "Keeper's Rollbox" }, whisper, content });
}

/** CoC7's raw roll at a value (`R/MA`): one private roll against it, with nothing added to the sheet. */
function rawRoll(threshold, plan) {
  return { method: "runRoll", args: [{ rollType: MANUAL_ROLL, threshold, difficulty: difficultyLevel(plan.difficulty),
    poolModifier: plan.dice, isBlind: true, fastForward: true }] };
}

/** How to roll one NPC check: the CoC7 actor method and its arguments. Null when there is no value to roll at. */
function oneRoll(actor, check, plan, notes) {
  const difficulty = difficultyLevel(plan.difficulty);
  const options = { difficulty, poolModifier: plan.dice, blind: true };
  if (check.ideaKnow) {
    // CoC7's own Idea or Know card; its dice option has its own name (`CoC7RollNormalize.normalizeRequest`).
    const dice = check.ideaKnow === "idea" ? { poolModifierIdea: plan.dice } : { poolModifierKnow: plan.dice };
    return { method: "runRoll", args: [{ characteristic: check.ideaKnow, difficulty, ...dice, isBlind: true, fastForward: true }] };
  }
  if (check.kind === "characteristic") return { method: "characteristicCheck", args: [check.key, true, options] };
  if (check.kind === "attribute") return { method: "attributeCheck", args: [check.key, true, options] };
  if (check.onSheet) return { method: "skillCheck", args: [check.uuid ?? check.key, true, options] };
  // Not on the sheet: a raw roll at Rollbox's base value, so nothing is added (Gap 1, C). CoC7's card
  // shows only the percentage, so the Keeper's note names the skill.
  if (check.value === null || check.value === undefined) return null;
  notes.push(`<strong>${escapeHtml(actor.name)}</strong>: ${escapeHtml(check.display)} isn't on the sheet; `
    + `rolled at its base value, ${check.value}%.`);
  return rawRoll(check.value, plan);
}

/**
 * An NPC's combined check as one private raw roll (Void's decision): against the highest value for "Any one"
 * (p. 203: "one dice roll using the higher of the investigator's two skills") or the lowest for "All of them",
 * which passes or fails exactly when CoC7's combined card would. CoC7 rolls and judges it.
 */
function combinedRoll(actor, plan, notes) {
  const values = plan.checks.map((check) => check.value);
  if (values.some((v) => v === null || v === undefined)) return null;
  const threshold = plan.all ? Math.min(...values) : Math.max(...values);
  const named = plan.checks.map((c) => `${escapeHtml(c.display)} ${c.value}%${c.kind === "skill" && !c.onSheet ? " (base)" : ""}`);
  notes.push(`<strong>${escapeHtml(actor.name)}</strong>: ${named.join(plan.all ? " and " : " or ")}; `
    + `one roll against ${threshold}% (${plan.all ? "all of them: the lowest" : "any one: the highest"}).`);
  return rawRoll(threshold, plan);
}

/**
 * Roll one NPC's planned check (resolve.js `planCheck`) for the Keeper. The note for a labelled roll is the label
 * with its difficulty ("Guard: Hard Spot Hidden · notice the knife"), since CoC7's private card names only the
 * check.
 * @returns {Promise<string|null>} null when rolled; otherwise why not, for the menu's "Not sent:" line.
 */
export async function rollForKeeper(plan, actor) {
  const notes = plan.note ? [`<strong>${escapeHtml(actor.name)}</strong>: ${plan.note}`] : [];
  const roll = plan.combined ? combinedRoll(actor, plan, notes) : oneRoll(actor, plan.checks[0], plan, notes);
  if (!roll) {
    tellKeeper(`Rollbox: no value to roll ${actor.name} at for ${plan.checks.map((c) => c.display).join(", ")}.`);
    return "no value to roll at";
  }
  if (plan.damage) notes.push(`<strong>${escapeHtml(actor.name)}</strong>: damage ${damageRoll(plan.damage.formula, plan.damage.flavor)}`);
  await keeperNote(notes);
  return (await callActor(actor, roll.method, ...roll.args)) ? null : "CoC7 couldn't roll it";
}
