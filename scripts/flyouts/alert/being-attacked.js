/** Registers the being-attacked alerts' hooks for melee, maneuver and shot-at cards. See docs/alert-flyout.md. */
import { isKeeper } from "../../utils.js";
import { surprisedBy } from "../../combat/index.js";
import { access, alerts, answering, closeAlert, dismissed, readAttack, sameCharacter, showAlert } from "./alerts.js";
import { meleeAlert, onKeeperCard } from "./melee.js";
import { onNotice, onOpposedCard } from "./maneuver.js";
import { onDived, onNotesChanged, onShotCard, shotAlert } from "./shots.js";

export { readAttack, setAlertHost, setPlayerAccess } from "./alerts.js";
export { DIVE_HOOK, diveDecision } from "./shots.js";

/** Shows, keeps or closes the player's alert for a CoC7 attack card on their character. */
function onCard(message) {
  const attack = readAttack(message);
  if (!attack) return;
  const me = access.ownCharacter(game.user);
  if (!me || !attack.targets.some((uuid) => sameCharacter(uuid, me))) return;
  if (!attack.open) return closeAlert(attack.id);
  if (alerts.has(attack.id) || dismissed.has(attack.id)) return;
  // A surprised target gets no response, so no alert.
  if (surprisedBy(me, attack.attackerUuid)) return;
  showAlert(attack.id, attack.kind === "melee" ? meleeAlert(attack, me) : shotAlert(attack, me));
}

/**
 * Registers the alert hooks at ready; a player's client needs the Player Rollbox and their own panel on.
 * @returns {boolean} true when registered
 */
export function registerBeingAttacked() {
  const players = access.playerRollboxOn();
  if (!isKeeper() && (!players || !access.panelHere())) return false;
  alerts.clear();
  dismissed.clear();
  answering.clear();
  Hooks.on("createChatMessage", onNotice);
  Hooks.on("updateChatMessage", onNotice);
  Hooks.on("createChatMessage", onOpposedCard);
  Hooks.on("updateChatMessage", onOpposedCard);
  Hooks.on("deleteChatMessage", (message) => closeAlert(message?.id));
  if (isKeeper()) {
    Hooks.on("createChatMessage", onKeeperCard);
    Hooks.on("updateChatMessage", onKeeperCard);
  }
  if (!players) return true;
  Hooks.on("updateActor", onNotesChanged);
  for (const hook of ["createChatMessage", "updateChatMessage", "deleteChatMessage"]) Hooks.on(hook, onShotCard);
  if (isKeeper()) {
    Hooks.on("updateActor", onDived);
    return true;
  }
  Hooks.on("createChatMessage", onCard);
  Hooks.on("updateChatMessage", onCard);
  return true;
}
