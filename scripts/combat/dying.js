/** The dying CON roll at each round's end, and the Keeper's Mark dead after a failure. See docs/combat.md. */
import { dotted, isActiveKeeper, isKeeper, sameActor, warn } from "../utils.js";
import { ownCharacter, playerRollboxOn } from "../player/index.js";
import { checkRequest, isCheckOf, makeCheck, ownersOf, rollPrivately, watchCheck } from "../roll-requests/index.js";
import { hasStatus } from "../status/index.js";
import { gameplayOn, runningCombat, turnsOf } from "./encounter.js";
import { showPopup } from "./fight-boxes.js";

const ROLL_WAIT_MS = 600000;

const keyOf = (actor) => dotted(actor?.uuid ?? actor?.id ?? "");

// Each client's own memory of when someone started dying: one loaded mid-fight counts from then.
const since = new Map();
// Only a round going forward ends one.
const lastRound = new Map();
const popups = new Map();
const watches = new Map();

function isDying(actor) {
  return Boolean(actor) && hasStatus(actor, "dying") && !hasStatus(actor, "dead");
}

/** The online player whose own Rollbox character it is, with the Player Rollbox on; else null (the Keeper rolls). */
function playerFor(actor) {
  if (!playerRollboxOn()) return null;
  return (ownersOf(actor) ?? []).find((user) => user?.active === true && user.isGM !== true
    && sameActor(ownCharacter(user), actor)) ?? null;
}

function rollsHere(actor) {
  const player = playerFor(actor);
  if (player) return !isKeeper() && player.id === globalThis.game?.user?.id;
  return isActiveKeeper();
}

// A plain CON check, not CoC7's sheet Dying check, which sets Dead by itself on a failure.
const conRequest = () => checkRequest({ checks: [{ kind: "characteristic", name: "con" }], difficulty: "regular" });

function closePopup(key) {
  popups.get(key)?.close();
  popups.delete(key);
}


async function rollCon(actor) {
  const request = conRequest();
  if (!request) return false;
  if (isKeeper()) return rollPrivately(request, actor);
  const made = await makeCheck(request, actor);
  return made.requested.length > 0;
}

function showRollCon(actor) {
  const key = keyOf(actor);
  closePopup(key);
  const name = actor.name ?? "Someone";
  const popup = showPopup({ kind: "dying", key });
  popups.set(key, popup);
  const draw = (text) => popup.draw({ title: `${name} is dying.`, text,
    sections: [{ buttons: [{ label: "Roll CON", main: true, run: async () => {
      if (await rollCon(actor)) closePopup(key);
      else draw("CoC7 couldn't roll it: roll CON from the sheet.");
    } }] }],
    onDismiss: () => popups.delete(key) });
  draw(isKeeper() ? "Roll CON to stay alive (you roll, privately)." : "Roll CON to stay alive.");
  return popup;
}


function showFailed(actor) {
  const key = `failed:${keyOf(actor)}`;
  const name = actor.name ?? "Someone";
  const popup = showPopup({ kind: "dying", key });
  popup.draw({ title: `${name} failed CON while dying.`,
    sections: [{ buttons: [
      { label: "Mark dead", main: true, run: async () => {
        await markDead(actor);
        popup.close();
      } },
      { label: "Handle it yourself", run: () => popup.close() }
    ] }] });
  return popup;
}

// CoC7 8.15: `toggleCondition` is the sheet's toggle, so it would clear Dead if already set.
async function markDead(actor) {
  if (hasStatus(actor, "dead")) return true;
  if (typeof actor?.toggleCondition !== "function") {
    warn("CoC7's actor.toggleCondition is missing; mark them dead on their sheet.");
    return false;
  }
  try {
    await actor.toggleCondition("dead");
    return true;
  } catch (error) {
    warn(`couldn't mark ${actor.name ?? "the character"} dead.`, error);
    return false;
  }
}

function stopWatch(key) {
  watches.get(key)?.();
  watches.delete(key);
}

/** Watches for the character's next CoC7 CON card, whoever rolls it; a failure brings up Mark dead. Returns a stop. */
function watchCon(actor) {
  const key = keyOf(actor);
  stopWatch(key);
  const forget = () => { if (watches.get(key) === stop) watches.delete(key); };
  const watching = watchCheck(actor, { waitMs: ROLL_WAIT_MS, accepts: (result) => isCheckOf(result, "con"),
    onGiveUp: forget,
    onResult: (result) => {
      forget();
      if (result.isSuccess !== true) showFailed(actor);
    } });
  function stop() {
    watching();
    forget();
  }
  watches.set(key, stop);
  return stop;
}

/**
 * Brings up the CON roll for everyone dying since before the round that just ended.
 * @param {Combat} combat
 * @param {object} changes Foundry's update data
 * @returns {Actor[]} who was due
 */
export function onRoundEnd(combat, changes) {
  if (!changes || !("round" in changes) || !combat?.started) return [];
  const round = Number(combat.round) || 0;
  const before = lastRound.get(combat.id);
  lastRound.set(combat.id, round);
  if (before !== undefined && round <= before) return [];
  const ended = round - 1;
  const due = [];
  for (const combatant of turnsOf(combat)) {
    const actor = combatant?.actor;
    const key = keyOf(actor);
    if (!key) continue;
    if (!isDying(actor)) {
      forget(key);
      continue;
    }
    if (!since.has(key)) since.set(key, ended);
    else if (since.get(key) < ended) due.push(actor);
  }
  if (!gameplayOn()) return [];
  for (const actor of due) {
    if (rollsHere(actor)) showRollCon(actor);
    if (isActiveKeeper()) watchCon(actor);
  }
  return due;
}

function forget(key) {
  since.delete(key);
  closePopup(key);
  stopWatch(key);
}

/**
 * Notes when a character in the encounter starts dying, or forgets one who no longer is.
 * @param {Actor} actor
 * @returns {void}
 */
export function onConditions(actor) {
  const combat = actor ? runningCombat(actor) : null;
  const key = keyOf(actor);
  if (!combat || !key) return;
  if (!isDying(actor)) {
    if (since.has(key) || popups.has(key)) forget(key);
    return;
  }
  if (!since.has(key) && turnsOf(combat).some((combatant) => sameActor(combatant?.actor, actor))) {
    since.set(key, Number(combat.round) || 0);
  }
}

const effectActor = (effect) => (effect?.parent?.documentName === "Item" ? effect.parent.parent : effect?.parent) ?? null;

/**
 * Closes every dying pop-up and watch, as when the encounter ends.
 * @returns {void}
 */
export function resetDying() {
  for (const key of [...popups.keys()]) closePopup(key);
  for (const key of [...watches.keys()]) stopWatch(key);
  since.clear();
  lastRound.clear();
}

/**
 * Registers the hooks that follow rounds and CoC7's conditions. Call at ready.
 * @returns {boolean}
 */
export function registerDying() {
  Hooks.on("updateCombat", onRoundEnd);
  Hooks.on("deleteCombat", resetDying);
  Hooks.on("updateActor", onConditions);
  Hooks.on("updateToken", (token) => onConditions(token?.actor));
  for (const hook of ["createActiveEffect", "deleteActiveEffect"]) Hooks.on(hook, (effect) => onConditions(effectActor(effect)));
  return true;
}
