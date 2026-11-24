/** Private rolls on the Keeper's client for NPCs, with the Keeper's note before CoC7's card. See docs/roll-requests.md. */
import { escapeHtml, tellKeeper } from "../utils.js";
import { cleanLabel, damageRoll, difficultyLevel } from "./links.js";
import { callActor } from "./coc7.js";

// CoC7 8.15: `CoC7RollNormalize.ROLL_TYPE.MANUAL`, a roll against a number that adds nothing to the sheet.
const MANUAL_ROLL = "R/MA";

function keeperIds() {
  const users = ChatMessage.getWhisperRecipients?.("GM") ?? Array.from(game.users ?? []).filter((u) => u.isGM);
  return Array.from(users).map((u) => u.id).filter(Boolean);
}

async function keeperNote(lines) {
  const whisper = keeperIds();
  // An empty whisper list would make the note public.
  if (!lines.length || !whisper.length) return;
  const content = lines.map((line) => `<p>${line}</p>`).join("");
  await ChatMessage.create({ speaker: { alias: "Keeper's Rollbox" }, whisper, content });
}

function rawRoll(threshold, plan) {
  return { method: "runRoll", args: [{ rollType: MANUAL_ROLL, threshold, difficulty: difficultyLevel(plan.difficulty),
    poolModifier: plan.dice, isBlind: true, fastForward: true }] };
}

const RUN_ROLL_TYPES = Object.freeze({ characteristic: "R/CH", attribute: "R/AT", skill: "R/SK" });

/** Returns the CoC7 actor call for one check, or null when there is no value to roll at. */
function oneRoll(actor, check, plan, notes, owned = false) {
  const difficulty = difficultyLevel(plan.difficulty);
  // CoC7 8.15: from a GM's client its checks post a standby card for a player-owned character (`stanbyGMRolls`);
  // runRoll with preventStandby rolls at once.
  if (owned && (check.kind !== "skill" || check.onSheet)) {
    const target = check.kind === "skill" ? { itemUuid: check.uuid } : { [check.kind]: check.key };
    return { method: "runRoll", args: [{ rollType: RUN_ROLL_TYPES[check.kind], ...target, difficulty,
      poolModifier: plan.dice, isBlind: true, fastForward: true, preventStandby: true }] };
  }
  const options = { difficulty, poolModifier: plan.dice, blind: true };
  if (check.kind === "characteristic") return { method: "characteristicCheck", args: [check.key, true, options] };
  if (check.kind === "attribute") return { method: "attributeCheck", args: [check.key, true, options] };
  if (check.onSheet) return { method: "skillCheck", args: [check.uuid ?? check.key, true, options] };
  // Not on the sheet: a raw roll, so nothing is added; CoC7's card shows only the percentage, so the note names it.
  if (check.value === null || check.value === undefined) return null;
  notes.push(`<strong>${escapeHtml(actor.name)}</strong>: ${escapeHtml(check.display)} isn't on the sheet; `
    + `rolled at its base value, ${check.value}%.`);
  return rawRoll(check.value, plan);
}

// One raw roll at the highest value (Any one, p. 203) or the lowest (All of them) passes exactly when CoC7's card would.
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
 * Rolls one character's planned check (resolve.js `planCheck`) privately for the Keeper, at once.
 * @param {object} plan
 * @param {Actor} actor
 * @param {{quiet?: boolean, owned?: boolean}} [options] `quiet`: no note; `owned`: the character has a player owner
 * @returns {Promise<string|null>} null when rolled; otherwise why not
 */
export async function rollForKeeper(plan, actor, { quiet = false, owned = false } = {}) {
  const notes = plan.note ? [`<strong>${escapeHtml(actor.name)}</strong>: ${cleanLabel(plan.note)}`] : [];
  const roll = plan.combined ? combinedRoll(actor, plan, notes) : oneRoll(actor, plan.checks[0], plan, notes, owned);
  if (!roll) {
    tellKeeper(`Rollbox: no value to roll ${actor.name} at for ${plan.checks.map((c) => c.display).join(", ")}.`);
    return "no value to roll at";
  }
  if (plan.damage) notes.push(`<strong>${escapeHtml(actor.name)}</strong>: damage ${damageRoll(plan.damage.formula, plan.damage.flavor)}`);
  if (!quiet) await keeperNote(notes);
  return (await callActor(actor, roll.method, ...roll.args)) ? null : "CoC7 couldn't roll it";
}
