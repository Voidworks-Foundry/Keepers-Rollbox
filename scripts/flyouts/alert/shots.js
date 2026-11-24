/** The shot-at alert, dive decisions and the Keeper's Under cover tick. See docs/alert-flyout.md. */
import { MODULE_ID, element, isActiveKeeper, tellKeeper } from "../../utils.js";
import { NOTES_FLAG, hasDived, markDived, markNote, roundNote } from "../../combat/index.js";
import { callActor, ownersOf, pressCardButton, watchCheck } from "../../roll-requests/index.js";
import { access, actorOf, alertButton, closeAlert, frame, readAttack, sameCharacter, say, whoAttacks } from "./alerts.js";

// CoC7 8.15: the ranged card's Under cover toggle key (`DICE_POOL_REASONS.cover`).
const COVER = "cover";
// Long, because CoC7 may first ask in its roll dialog.
const DODGE_WAIT_MS = 120000;
const RECENT_CARDS = 50;
/** Names the hook called with `(actor, decision)` when a dive decision may have changed. */
export const DIVE_HOOK = `${MODULE_ID}.diveDecision`;

// Falls back to the name "Dodge", which CoC7 finds or adds at its base value.
function dodgeSkill(actor) {
  try {
    const item = Array.from(actor.items ?? []).find((doc) => doc?.type === "skill" && doc.system?.isDodge === true);
    return item?.name ?? "Dodge";
  } catch {
    return "Dodge";
  }
}

// CoC7 gives a skill check's key as the skill item's uuid.
function isDodgeResult(result, actor) {
  if (result?.type !== "skill" || !result.key) return false;
  try {
    const item = globalThis.fromUuidSync?.(result.key) ?? null;
    if (!item) return false;
    return item.system?.isDodge === true || String(item.name ?? "").toLowerCase() === dodgeSkill(actor).toLowerCase();
  } catch {
    return false;
  }
}

/** Waits for this user's next Dodge result for the character; other check cards are passed over. */
function waitForDodge(actor) {
  let cancel = () => {};
  const promise = new Promise((resolve) => {
    const stop = watchCheck(actor, { mine: true, waitMs: DODGE_WAIT_MS, isFor: (uuid) => sameCharacter(uuid, actor),
      accepts: (result) => isDodgeResult(result, actor), onResult: resolve, onGiveUp: () => resolve(null) });
    cancel = () => {
      stop();
      resolve(null);
    };
  });
  return { promise, cancel };
}

async function dive(me, line, buttons) {
  buttons.forEach((node) => { node.disabled = true; });
  say(line, "Rolling Dodge…");
  const waiting = waitForDodge(me);
  if (!(await callActor(me, "skillCheck", dodgeSkill(me), true))) {
    waiting.cancel();
    say(line, "CoC7 couldn't roll Dodge; ask the Keeper.");
    return;
  }
  const result = await waiting.promise;
  if (!result) return say(line, "No Dodge roll came back; ask the Keeper.");
  if (!result.isSuccess) return say(line, "The dive failed: the shot comes as it is.");
  if (!(await markDived(me))) {
    return say(line, "You dived for cover. No encounter is running, so ask the Keeper to tick Under cover.");
  }
  say(line, "You dived for cover: the shooter gets 1 penalty die. You lose your next attack.");
}

/**
 * Returns the shot-at alert, answered before the shot is rolled.
 * @param {object} attack readAttack's shot card
 * @param {Actor} me the player's character
 * @returns {{node: HTMLElement, line: HTMLElement}}
 */
export function shotAlert(attack, me) {
  const { node, line } = frame(attack.id, "You are being shot at", whoAttacks(attack, me, "is shooting at"));
  node.append(element("p", "rollbox-alert-note",
    "Dive for cover: a Dodge roll. On a success the shooter gets 1 penalty die and you lose your next attack."));
  const actions = element("div", "rollbox-alert-actions");
  const diveButton = alertButton("Dive for cover", () => dive(me, line, [diveButton, stand]), "rollbox-primary");
  const stand = alertButton("Stand your ground", () => {
    markNote(me, "stood");
    closeAlert(attack.id, true);
  });
  actions.append(diveButton, stand);
  node.append(actions, line);
  return { node, line };
}

function recentMessages() {
  try {
    return Array.from(game.messages?.contents ?? game.messages ?? []).slice(-RECENT_CARDS).reverse();
  } catch {
    return [];
  }
}

function openShotAt(actor) {
  for (const message of recentMessages()) {
    const attack = readAttack(message);
    if (attack?.kind === "shot" && attack.open && attack.targets.some((uuid) => sameCharacter(uuid, actor))) {
      return attack;
    }
  }
  return null;
}

/**
 * Returns what a character decided about diving for cover this round, read on any client.
 * @param {Actor} actor the target
 * @returns {"pending"|"dived"|"stood"|null}
 */
export function diveDecision(actor) {
  if (!actor) return null;
  try {
    if (hasDived(actor)) return "dived";
    if (roundNote(actor)?.stood === true) return "stood";
    if (!access.playerRollboxOn() || !(ownersOf(actor) ?? []).length) return null;
    return openShotAt(actor) ? "pending" : null;
  } catch {
    return null;
  }
}

function announce(actors) {
  for (const actor of actors) {
    if (actor) Hooks.callAll(DIVE_HOOK, actor, diveDecision(actor));
  }
}

/**
 * Announces a dive decision when an actor's round notes change (updateActor).
 * @param {Actor} actor
 * @param {object} changes
 * @returns {void}
 */
export function onNotesChanged(actor, changes) {
  if (changes?.flags?.[MODULE_ID] && (NOTES_FLAG in changes.flags[MODULE_ID]
    || `-=${NOTES_FLAG}` in changes.flags[MODULE_ID])) announce([actor]);
}

/**
 * Announces the dive decision of each target of a posted, rolled or deleted shot card.
 * @param {ChatMessage} message
 * @returns {void}
 */
export function onShotCard(message) {
  const attack = readAttack(message);
  if (attack?.kind === "shot") announce(attack.targets.map(actorOf));
}

/**
 * Ticks Under cover on the newest open shot at a character just noted as dived; active Keeper only.
 * @param {Actor} actor
 * @param {object} changes
 * @returns {void}
 */
export function onDived(actor, changes) {
  if (changes?.flags?.[MODULE_ID]?.[NOTES_FLAG]?.dived !== true || !isActiveKeeper()) return;
  for (const message of recentMessages()) {
    const attack = readAttack(message);
    if (attack?.kind !== "shot" || !attack.open) continue;
    const offset = attack.targets.findIndex((uuid) => sameCharacter(uuid, actor));
    if (offset < 0) continue;
    if ((attack.load.targets[offset]?.poolKeys ?? []).includes(COVER)) return;
    const done = pressCardButton(attack.id,
      `.ranged-targets-option[data-offset="${offset}"] [data-action="toggleTargetKey"][data-set="${COVER}"]`);
    if (!done) tellKeeper(`Rollbox: ${actor.name} dived for cover; tick Under cover on the shooter's card.`);
    return;
  }
}
