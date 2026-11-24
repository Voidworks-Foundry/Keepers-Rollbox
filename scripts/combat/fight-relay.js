/** What players ask of a fight through the Keeper's client, and the player's join card. See docs/combat.md. */
import { actorFromUuid, isKeeper, plays } from "../utils.js";
import { askKeeper, onKeeperRequest } from "../roll-requests/index.js";
import { ownCharacter, playerRollboxOn } from "../player/index.js";
import { combatantFor, gameplayOn, runningCombat, startedCombatant } from "./encounter.js";
import { feetBetween, tokenOf } from "./sight.js";
import { closeJoinCard, showJoinCard } from "./fight-boxes.js";
import { fighterTokens, fightStart, standingBy } from "./fight-state.js";
import { becomeFighter, setStanding } from "./fight-changes.js";
import { fightBegins, spellCastAt } from "./fight.js";
import { fleeNotice } from "./flee.js";
import { delayTurn } from "./delay.js";

/**
 * Answers a player's relayed fight request, only for a character the sender owns. Keeper only.
 * @param {{action: string, actorUuid?: string, targetUuids?: string[], combatantId?: string, on?: boolean,
 *   places?: number}} payload
 * @param {User} user the sender
 * @returns {Promise<*>}
 */
export async function fightForPlayer({ action, actorUuid, targetUuids = [], combatantId, on, places } = {}, user) {
  // Delay belongs to the turn controls, which work with the Gameplay rules off.
  if (action === "delay") {
    const combatant = startedCombatant(combatantId);
    const acting = combatant && plays(combatant.actor, user) && combatant.parent?.combatant === combatant;
    return acting ? delayTurn(combatant.parent, places) : false;
  }
  if (!gameplayOn()) return false;
  if (action === "attack" || action === "spell") {
    const actor = actorFromUuid(actorUuid);
    if (!actor || !plays(actor, user)) return false;
    const targets = Array.from(targetUuids ?? [], actorFromUuid).filter(Boolean);
    return action === "attack" ? fightBegins(actor, targets) : spellCastAt({ actor, targets });
  }
  const combatant = startedCombatant(combatantId);
  if (!combatant || !plays(combatant.actor, user)) return false;
  if (action === "join") return becomeFighter(combatant);
  if (action === "stayOut") return standingBy(combatant) ? setStanding(combatant, { standing: "out" }) : false;
  if (action === "acts") return standingBy(combatant) ? setStanding(combatant, { acts: on === true }) : false;
  if (action === "fled") {
    fleeNotice(combatant.actor?.name ?? combatant.name ?? "", { combatant });
    return true;
  }
  return false;
}

/**
 * Joins, stays out or sets Act this round for a combatant; a player's client asks the Keeper's.
 * @param {"join"|"stayOut"|"acts"} action
 * @param {Combatant} combatant
 * @param {{on?: boolean}} [extra]
 * @returns {Promise<boolean>}
 */
export async function askFight(action, combatant, extra = {}) {
  if (!combatant) return false;
  if (isKeeper()) {
    if (action === "join") return becomeFighter(combatant);
    if (action === "stayOut") return setStanding(combatant, { standing: "out" });
    if (action === "acts") return setStanding(combatant, { acts: extra.on === true });
    return false;
  }
  const reply = await askKeeper("fight", { action, combatantId: combatant.id, ...extra });
  return reply.ok && reply.answer === true;
}

function joinText(combat, own) {
  const start = fightStart(combat);
  const ownToken = tokenOf(own);
  const feet = ownToken ? Math.min(...fighterTokens(combat).map((token) => feetBetween(ownToken, token) ?? Infinity))
    : Infinity;
  const away = Number.isFinite(feet) ? `, ${Math.max(0, Math.round(feet / 5) * 5)} ft from you` : " near you";
  if (!start?.attacker) return `a fight is going on${away}.`;
  const targets = Array.from(start.targets ?? []).filter(Boolean);
  return `${start.attacker} attacks ${targets.length ? targets.join(" and ") : "someone"}${away}.`;
}

/**
 * Shows the player's join card while their investigator stands by unanswered, else closes it.
 * @returns {boolean} whether the card shows
 */
export function syncJoinCard() {
  if (isKeeper()) return false;
  const own = playerRollboxOn() ? ownCharacter(globalThis.game?.user) : null;
  const combat = own ? runningCombat(own) : null;
  const combatant = own && combat ? combatantFor(own, combat) : null;
  if (!combatant || standingBy(combatant) !== "asked") {
    closeJoinCard();
    return false;
  }
  showJoinCard({ key: `${combat.id}:${combatant.id}`, text: joinText(combat, own),
    onJoin: () => askFight("join", combatant), onStay: () => askFight("stayOut", combatant) });
  return true;
}

/**
 * Listens for the relay's "fight" message. Call at ready.
 * @returns {boolean} false for players
 */
export function registerFight() {
  if (!isKeeper()) return false;
  onKeeperRequest("fight", fightForPlayer);
  return true;
}
