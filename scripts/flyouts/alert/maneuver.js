/** The maneuver alert, answered through Rollbox's maneuver notice. See docs/alert-flyout.md. */
import { COC7_ID, element, isActiveKeeper, isKeeper } from "../../utils.js";
import { clearSurprise, surpriseOf } from "../../combat/index.js";
import {
  answerManeuver, counterWeapons, meleeWeapons, noticeText, ownersOf, readManeuverNotice, rollOwnSide
} from "../../roll-requests/index.js";
import {
  access, actorOf, alerts, answeredSurprise, answering, closeAlert, controlList, dismissed, frame, sameCharacter, say,
  showAlert
} from "./alerts.js";
import { fightAndCounter } from "./choices.js";

// CoC7 8.15: the opposed card's `flags.CoC7.load.as`.
const OPPOSED_CARD = "CoC7ChatOpposedMessage";

// Only a player with the target as their own Rollbox character sees the alert; an owner without it assigned
// gets none, so the Keeper answers then or nobody would.
function keeperAnswers(notice, target) {
  if (!access.playerRollboxOn()) return true;
  return !(ownersOf(target) ?? []).some((user) => user?.active === true
    && sameCharacter(notice.target, access.ownCharacter(user)));
}

function maneuverAlert(notice, me, keeper) {
  const attacker = actorOf(notice.attacker);
  const title = keeper ? `${me.name ?? "The target"} is being attacked` : "You are being attacked";
  const { node, line } = frame(notice.id, title, noticeText(attacker, notice.goal, me));
  node.classList.add("rollbox-alert-maneuver");
  const { controls, control } = controlList();
  const answer = async (choice, words) => {
    controls.forEach((each) => { each.disabled = true; });
    answering.add(notice.id);
    const unopposed = choice.answer === "none";
    say(line, unopposed ? `${words}: CoC7 rolls the maneuver…` : `${words}: making CoC7's opposed card…`);
    // A player's own row on CoC7's card is pressed once the Keeper's Start Rolls has run.
    const stopRolling = keeper || unopposed ? () => {} : rollOwnSide(me, attacker);
    const done = await answerManeuver(notice.id, choice);
    if (!done?.ok) {
      stopRolling();
      answering.delete(notice.id);
      controls.forEach((each) => { each.disabled = each.dataset.off === "true"; });
      say(line, `No card: ${done?.reason ?? "the Keeper's Rollbox didn't answer"}.`);
      return;
    }
    // No response: CoC7 has already rolled the maneuver alone, so nothing is left to answer or roll.
    if (unopposed) {
      answering.delete(notice.id);
      closeAlert(notice.id);
      return;
    }
    say(line, keeper ? `${words}: CoC7's opposed card is in chat, Start Rolls pressed.`
      : `${words}: CoC7's opposed card is in chat; your side is rolled once the Keeper starts the rolls.`);
  };

  const fightWith = (weapon) => answer({ answer: "fight", weaponId: weapon.id }, `Fight back with ${weapon.name}`);
  const { fightButton, counterButton, weapons, counter, open } = fightAndCounter({ node, line, me, attacker, keeper,
    control, fightWeapons: meleeWeapons(me), fightWith, counterWeapons: counterWeapons(me),
    canCounter: (weapon) => Boolean(weapon),
    onGoal: (goal, weapon) => answer({ answer: "counter", weaponId: weapon?.id ?? null },
      `Counter (${goal.label}, ${weapon?.name ?? "maneuver"})`) });
  const actions = element("div", "rollbox-alert-actions");
  actions.append(control("Dodge", () => { open(null); answer({ answer: "dodge" }, "Dodge"); }), fightButton,
    counterButton, control("No response", () => { open(null); answer({ answer: "none" }, "No response"); }));
  node.append(actions, weapons, counter, line);
  return { node, line };
}

/** Returns whether every side of CoC7's opposed card is rolled, whatever the outcome. */
async function opposedDone(message) {
  if (message?.flags?.[COC7_ID]?.load?.as !== OPPOSED_CARD) return false;
  try {
    const results = [].concat((await game.CoC7?.messageResults?.(message)) ?? []);
    return results.length >= 2 && results.every((result) => result?.isRolled === true);
  } catch {
    return false;
  }
}

async function closeWhenDone(noticeId, card) {
  if (!alerts.has(noticeId) || !(await opposedDone(card))) return;
  answering.delete(noticeId);
  closeAlert(noticeId);
}

/**
 * Closes the alert of the maneuver an opposed card was made for, once the card has its result.
 * @param {ChatMessage} message
 * @returns {void}
 */
export function onOpposedCard(message) {
  if (message?.flags?.[COC7_ID]?.load?.as !== OPPOSED_CARD || !message.id) return;
  for (const id of [...alerts.keys()]) {
    if (readManeuverNotice(game.messages?.get?.(id) ?? null)?.card === message.id) closeWhenDone(id, message);
  }
}

/**
 * Shows a maneuver notice's alert to whoever answers it, or closes it once answered.
 * @param {ChatMessage} message
 * @returns {void}
 */
export function onNotice(message) {
  const notice = readManeuverNotice(message);
  if (!notice) return;
  if (notice.answer) {
    if (!answering.has(notice.id)) closeAlert(notice.id);
    // Start Rolls can roll both sides before the notice names its card.
    else if (notice.card) closeWhenDone(notice.id, game.messages?.get?.(notice.card) ?? null);
    return;
  }
  if (alerts.has(notice.id) || dismissed.has(notice.id)) return;
  const target = actorOf(notice.target);
  if (!target) return;
  // A surprised target gets no alert; the active Keeper answers No response once.
  const surprise = surpriseOf(target, notice.attacker);
  if (surprise) {
    if (isActiveKeeper() && !answeredSurprise.has(notice.id)) {
      answeredSurprise.add(notice.id);
      answerManeuver(notice.id, { answer: "none", bonus: surprise.bonus === "die" ? 1 : 0 })
        .then(() => clearSurprise(target));
    }
    return;
  }
  let keeper = false;
  if (isKeeper()) {
    if (!keeperAnswers(notice, target)) return;
    keeper = true;
  } else {
    const me = access.ownCharacter(game.user);
    if (!me || !sameCharacter(notice.target, me)) return;
  }
  showAlert(notice.id, maneuverAlert(notice, target, keeper));
}
