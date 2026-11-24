/** A player's own check, made by CoC7 on the player's client. See docs/roll-requests.md. */
import { warn } from "../utils.js";
import { isSafeRollKey, rollString, difficultyLevel } from "./links.js";
import { callActor, linkActorClick } from "./coc7.js";

// fastForward true skips CoC7's roll window, as a Shift + click on its sheet does.
function oneCheck(check, plan) {
  const options = { difficulty: difficultyLevel(plan.difficulty), poolModifier: plan.dice };
  if (check.kind === "characteristic") return { method: "characteristicCheck", args: [check.key, true, options] };
  if (check.kind === "attribute") return { method: "attributeCheck", args: [check.key, true, options] };
  return { method: "skillCheck", args: [check.uuid ?? check.key, true, options] };
}

/**
 * Makes a planned check (resolve.js `planCheck`) for the player's own investigator on this client.
 * @param {object} plan
 * @param {Actor} actor
 * @returns {string|null} null when CoC7 was asked; otherwise why not, for the flyout's "Not sent:" line
 */
export function makeOwnCheck(plan, actor) {
  if (plan.combined) {
    const click = linkActorClick();
    if (!click) return "CoC7's combined card can't be reached";
    const rolls = plan.checks.map((check) => (isSafeRollKey(check.key)
      ? rollString({ type: check.kind, key: check.key, dice: plan.dice, difficulty: plan.difficulty }) : null));
    if (rolls.includes(null)) return "a name can't go on CoC7's combined card";
    Promise.resolve()
      .then(() => click(actor, { check: "check", subtype: plan.all ? "combinedall" : "combinedany", rolls: rolls.join("&&") }))
      .catch((error) => warn(`CoC7 couldn't make ${actor?.name ?? "the investigator"}'s combined card.`, error));
    return null;
  }
  const roll = oneCheck(plan.checks[0], plan);
  callActor(actor, roll.method, ...roll.args);
  return null;
}
