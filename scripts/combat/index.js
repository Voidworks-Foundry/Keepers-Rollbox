/**
 * Wires combat: the gameplay rules on the Keeper's client and the turn order wherever a panel is; the part's entry point.
 * See docs/combat.md.
 */
import { MODULE_ID, isActiveKeeper, isKeeper, warn } from "../utils.js";
import { clearPanelContent, refreshPanel, setPanelContent, setPlayerHold } from "../panel/index.js";
import { panelHere, playerRollboxOn } from "../player/index.js";
import {
  combatantFor, currentCombatant, gameplayOn, roundOf, runningCombat, turnsOf, viewedCombat
} from "./encounter.js";
import { readiedHooks } from "./readied-firearms.js";
import { clearRoundNotes, hasDived, isAiming } from "./round-notes.js";
import { readRoundNotesWith } from "../status/index.js";
import { combatPanelOn, selectsTurn, setTurnOrderRedraw, turnOrderContent } from "./turn-order.js";
import { followTurn, pickedCombatant } from "./turn-pick.js";
import { DELAY_FLAG, resetTurnControls, restoreDelayed } from "./turn-controls.js";
import { registerNoticeCards } from "./notice-cards.js";
import { registerAboutToAttack } from "./about-to-attack.js";
import { onGunDrawn, onStandingBy, onTurn } from "./fight.js";
import { ENDS_TURN, skipsTurn } from "./fight-state.js";
import { registerFight, syncJoinCard } from "./fight-relay.js";
import { defenderAnswered } from "./situation.js";
import { registerDefeated } from "./defeated.js";
import { cancelJoinWindow, closeJoiningCard, closeNoticesOf } from "./fight-boxes.js";
import { clearLeftoverWait, keeperDeciding } from "./waiting.js";
import { registerOwnTarget } from "./own-target.js";
import { registerDying } from "./dying.js";

// Status can't import combat (combat imports status), so it is handed the round-note readers at load.
readRoundNotesWith({ aiming: isAiming, divedForCover: hasDived });

export { SETTINGS as GAMEPLAY_SETTINGS } from "./encounter.js";
export {
  NOTES_FLAG, attacksMade, clearAiming, hasActed, hasDived, isAiming, markActed, markAiming, markAttack, markDived,
  markNote, roundNote
} from "./round-notes.js";
export { postNoticeCard } from "./notice-cards.js";
export { drawnGun, isFirearm as readiesAsFirearm } from "./readied-firearms.js";
export { aboutToAttack, asksFirst, clearSurprise, surpriseOf, surprisedBy } from "./about-to-attack.js";
export { SETTINGS as FIGHT_SETTINGS } from "./fight-state.js";
export { attackMade, spellCastAt } from "./fight.js";
export { attacksPerRound, inMeleeWithOthers, isOutnumbered } from "./situation.js";
export { keeperDeciding } from "./waiting.js";
export { SETTINGS as TURN_SETTINGS } from "./turn-order.js";
export { SETTINGS as FIREARM_SETTINGS } from "./readied-firearms.js";
export { DRAW_SETTINGS, SETTINGS as NOTICE_SETTINGS } from "./notice-cards.js";
export { SETTINGS as NOTICE_PLACE_SETTINGS } from "./notice-place.js";

/**
 * Tells whether an encounter is running for these characters, or any when none are given.
 * @param {Actor|Actor[]} [concerned]
 * @returns {boolean}
 */
export function inCombat(concerned = null) {
  return runningCombat(concerned) !== null;
}

/**
 * Tells whether the character has a combatant in the encounter running for them.
 * @param {Actor} actor
 * @returns {boolean}
 */
export function inCombatFor(actor) {
  const combat = actor ? runningCombat(actor) : null;
  return combat !== null && combatantFor(actor, combat) !== null;
}

/**
 * Returns whose turn it is in the encounter running for this character, else in the one the panel draws.
 * @param {Actor} [actor]
 * @returns {{actor: Actor, token: TokenDocument|null}|null} the current combatant's character and token; null out of
 *   combat or before a turn
 */
export function currentTurn(actor = null) {
  const combatant = currentCombatant(actor ? runningCombat(actor) : viewedCombat());
  if (!combatant?.actor) return null;
  return { actor: combatant.actor, token: combatant.token ?? null };
}

/** Whom the Keeper's panel acts for with nothing selected: the turn order's pick, else the current turn's. */
function idleActors() {
  if (!isKeeper()) return [];
  const actor = pickedCombatant()?.actor ?? currentTurn()?.actor;
  return actor ? [actor] : [];
}

let providing = false;

// Once the turn order shows, every later change is one redraw on the next frame, however many hooks fire.
function showCombat() {
  if (!isKeeper()) syncJoinCard();
  if (!viewedCombat() || !combatPanelOn()) {
    providing = false;
    clearPanelContent();
  } else if (providing) {
    refreshPanel();
  } else {
    providing = setPanelContent(turnOrderContent, { idleActors });
  }
}

// Both move the turn order, so each waits for the last; guns go last so the round starts at the top they leave.
async function turnWork(combat, changes, options) {
  if ("round" in changes) {
    await clearRoundNotes(combat, { carryAiming: true });
    await restoreDelayed(combat);
  }
  await readiedHooks.updateCombat(combat, changes);
  await onTurn(combat, changes, options);
}

let turnQueue = Promise.resolve();

/**
 * Queues a turn or round change's work after the one before. Active GM only.
 * @param {Combat} combat
 * @param {object} changes
 * @param {object} [options]
 * @returns {Promise<void>|undefined} the queue, for tests
 */
export function onCombatUpdate(combat, changes, options = {}) {
  if (!isActiveKeeper() || !changes || !("turn" in changes || "round" in changes)) return undefined;
  return queueTurnWork(combat, changes, options);
}

// Run together, a skip on its way would move the turn past a shooter just readied at the top.
function queueTurnWork(combat, changes, options) {
  turnQueue = turnQueue.then(() => turnWork(combat, changes, options))
    .catch((error) => warn("a turn start's work failed.", error));
  return turnQueue;
}

// Foundry v14 gives a confirmed Delay's turn through the combatant update, with no updateCombat.
function delayed(combatant, changes) {
  const saved = changes?.flags?.[MODULE_ID]?.[DELAY_FLAG];
  const combat = combatant?.parent ?? null;
  return Boolean(saved) && typeof saved === "object" && saved.nudged !== true && combat?.started === true
    && saved.round === roundOf(combat);
}

/**
 * Queues a confirmed Delay as a turn start, and handles Draw gun and standby changes. Active GM only.
 * @param {Combatant} combatant
 * @param {object} changes
 * @returns {Promise<*>|undefined}
 */
export function onCombatantUpdate(combatant, changes) {
  if (!isActiveKeeper() || !changes) return undefined;
  if (delayed(combatant, changes)) return queueTurnWork(combatant.parent, { turn: combatant.parent.turn }, {});
  return Promise.all([onGunDrawn(combatant, changes), onStandingBy(combatant, changes)])
    .then(([drawn, holstered]) => drawn || holstered);
}

/**
 * Clears the notes and closes the Keeper's boxes about an encounter that ended, so none writes to it.
 * @param {Combat} combat
 * @returns {void}
 */
export function onCombatGone(combat) {
  readiedHooks.deleteCombat();
  closeJoiningCard();
  cancelJoinWindow();
  closeNoticesOf("flee");
  if (isActiveKeeper()) clearRoundNotes(combat);
}

function onPickChanged(actor, changes) {
  if (isActiveKeeper()) readiedHooks.updateActor(actor, changes);
}

function willSkip(combat) {
  const combatant = currentCombatant(combat);
  if (!combatant || !gameplayOn() || !skipsTurn(combatant, combat)) return false;
  return !turnsOf(combat).every((other) => skipsTurn(other, combat));
}

// Done in the turn change's own hook, before the panel's next frame, so the panel draws the new turn once.
function selectCurrentToken(combat) {
  if (combat !== viewedCombat()) return false;
  try {
    const token = currentCombatant(combat)?.token?.object ?? null;
    if (token) token.control({ releaseOthers: true });
    else globalThis.canvas?.tokens?.releaseAll?.();
    return true;
  } catch (error) {
    warn("couldn't select the current turn's token.", error);
    return false;
  }
}

/**
 * Makes the Keeper's panel follow a new turn, and selects its token with At each new turn on Select.
 * @param {Combat} combat
 * @param {object} changes
 * @param {object} [options]
 * @returns {boolean} true when the turn's token was selected
 */
export function onTurnChange(combat, changes, options = {}) {
  if (!isKeeper() || !changes || !("turn" in changes || "round" in changes)) return false;
  if (options?.rollboxKeepTurn || combat !== viewedCombat()) return false;
  const turns = turnsOf(combat);
  const ended = options?.[ENDS_TURN] || followsSkip;
  followsSkip = false;
  delayedTurn = false;
  // Not while nobody has had a turn yet, so the attack that started the fight keeps its flyout.
  if (!ended && roundOf(combat) <= 1 && turns.slice(0, Math.max(0, turns.indexOf(currentCombatant(combat))))
    .every((combatant) => skipsTurn(combatant, combat))) return false;
  return followNewTurn(combat);
}

// A turn that ended reached a skipped one: the skip's own turn change follows the turn, even in round 1.
let followsSkip = false;

function followNewTurn(combat) {
  followTurn();
  if (!selectsTurn()) return false;
  if (willSkip(combat)) {
    followsSkip = true;
    return false;
  }
  return selectCurrentToken(combat);
}

/**
 * Makes the Keeper's panel follow the turn a confirmed Delay gives; the selection waits for combatTurnChange.
 * @param {Combatant} combatant
 * @param {object} changes
 * @returns {boolean} true when the next turn's token will be selected
 */
export function onDelayedTurn(combatant, changes) {
  if (!isKeeper() || !delayed(combatant, changes)) return false;
  followTurn();
  delayedTurn = selectsTurn();
  return delayedTurn;
}

// Foundry v14 re-sorts and moves the turn only after updateCombatant, then fires combatTurnChange.
let delayedTurn = false;

/**
 * Selects the token of the turn a confirmed Delay gave, once Foundry has re-sorted the order.
 * @param {Combat} combat
 * @returns {boolean} true when the turn's token was selected
 */
export function onDelayedTurnChange(combat) {
  if (!delayedTurn) return false;
  delayedTurn = false;
  return followNewTurn(combat);
}

function onTokenSelected(_token, controlled) {
  if (controlled) followTurn();
}

function onCombatDeleted() {
  followTurn();
  resetTurnControls();
  showCombat();
}

function onActorChanged(actor) {
  const combat = viewedCombat();
  if (combat && combatantFor(actor, combat)) showCombat();
}

// Installed on every Keeper's client whatever the panel's switch; each handler acts only on the active GM's.
function registerGameplay() {
  Hooks.on("updateCombat", onCombatUpdate);
  Hooks.on("deleteCombat", onCombatGone);
  Hooks.on("updateActor", onPickChanged);
  Hooks.on("updateCombatant", onCombatantUpdate);
  Hooks.on("updateChatMessage", defenderAnswered);
  registerNoticeCards();
  registerAboutToAttack();
  registerFight();
  registerDefeated();
  registerOwnTarget();
  clearLeftoverWait();
}

function registerTurnOrder() {
  setTurnOrderRedraw(showCombat);
  if (isKeeper()) {
    Hooks.on("updateCombat", onTurnChange);
    Hooks.on("updateCombatant", onDelayedTurn);
    Hooks.on("combatTurnChange", onDelayedTurnChange);
    Hooks.on("controlToken", onTokenSelected);
  }
  for (const hook of ["updateCombat", "createCombat", "createCombatant", "updateCombatant", "deleteCombatant",
    "canvasReady"]) Hooks.on(hook, showCombat);
  Hooks.on("deleteCombat", onCombatDeleted);
  Hooks.on("updateActor", onActorChanged);
  showCombat();
}

/**
 * Registers the gameplay rules on the Keeper's client and the turn order wherever a panel is. Call at ready.
 * @returns {boolean} true when anything was registered; false for a player with the Player Rollbox off
 */
export function registerCombat() {
  const keeper = isKeeper();
  if (!keeper && !playerRollboxOn()) return false;
  if (keeper) registerGameplay();
  if (keeper || panelHere()) registerDying();
  if (panelHere()) registerTurnOrder();
  if (!keeper && panelHere()) holdWhileDeciding();
  return true;
}

const WAITING_TEXT = "Waiting for the Keeper";

/**
 * Greys a player's menu, Action aside, while the Keeper decides a first blow; redraws when the scene's mark changes.
 * @returns {void}
 */
export function holdWhileDeciding() {
  setPlayerHold(() => (keeperDeciding() ? WAITING_TEXT : null));
  Hooks.on("updateScene", (_scene, changes) => {
    if (changes?.flags && MODULE_ID in changes.flags) refreshPanel();
  });
}
