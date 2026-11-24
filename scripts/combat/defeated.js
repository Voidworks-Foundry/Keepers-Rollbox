/** Keeps each combatant's own defeated field in step with CoC7's down conditions. See docs/combat.md. */
import { isActiveKeeper, warn } from "../utils.js";
import { gameplayOn, isCombatantOf, runningCombat, turnsOf } from "./encounter.js";

/**
 * Lists CoC7's conditions that put a combatant out of the fight (CoC7 8.15 `STATUS_EFFECTS` keys).
 * @type {readonly string[]}
 */
export const DOWN = Object.freeze(["unconscious", "dying", "dead"]);

// CoC7 8.15 sets a condition as `system.conditions.<key>.value` or as a status icon; either counts.
function hasCondition(actor, key) {
  try {
    if (actor?.system?.conditions?.[key]?.value === true) return true;
    return typeof actor?.statuses?.has === "function" && actor.statuses.has(key);
  } catch {
    return false;
  }
}

const isDown = (actor) => DOWN.some((key) => hasCondition(actor, key));

/**
 * Tells whether a combatant counts as defeated, by Foundry's own `isDefeated`.
 * @param {Combatant} combatant
 * @returns {boolean}
 */
export function isDefeated(combatant) {
  try {
    return Boolean(combatant?.isDefeated ?? combatant?.defeated);
  } catch {
    return false;
  }
}

// Only the combatant's field: Foundry's tracker toggle also sets its defeated status, which is CoC7's Dead condition.
async function markCombatant(combatant) {
  const down = isDown(combatant?.actor);
  if (Boolean(combatant?.defeated) === down || !combatant) return false;
  try {
    await combatant.update({ defeated: down });
    return true;
  } catch (error) {
    warn("couldn't mark a combatant defeated.", error);
    return false;
  }
}

async function syncDefeated(actor, combat = runningCombat(actor)) {
  if (!actor || !combat || !isActiveKeeper() || !gameplayOn()) return 0;
  let count = 0;
  for (const combatant of turnsOf(combat).filter((other) => isCombatantOf(other, actor))) {
    if (await markCombatant(combatant)) count += 1;
  }
  return count;
}

function touchesConditions(changes) {
  const conditions = changes?.system?.conditions;
  if (conditions && DOWN.some((key) => key in conditions)) return true;
  return Object.keys(changes ?? {}).some((key) => DOWN.some((down) => key.startsWith(`system.conditions.${down}`)));
}

function downEffect(effect) {
  try {
    return DOWN.some((key) => effect?.statuses?.has?.(key));
  } catch {
    return false;
  }
}

const effectActor = (effect) => (effect?.parent?.documentName === "Item" ? effect.parent.parent : effect?.parent) ?? null;

function onActorUpdate(actor, changes) {
  if (touchesConditions(changes)) syncDefeated(actor);
}

function onEffect(effect) {
  if (downEffect(effect)) syncDefeated(effectActor(effect));
}

// An unlinked token's character changes through its delta, not updateActor.
function onTokenUpdate(token, changes) {
  const delta = changes?.delta;
  if (delta && (touchesConditions(delta) || "effects" in delta)) syncDefeated(token?.actor);
}

function onCombatantAdded(combatant) {
  if (!isActiveKeeper() || !gameplayOn() || !isDown(combatant?.actor)) return;
  markCombatant(combatant);
}

/**
 * Registers the hooks that follow CoC7's down conditions. Call at ready.
 * @returns {boolean}
 */
export function registerDefeated() {
  Hooks.on("updateActor", onActorUpdate);
  for (const hook of ["createActiveEffect", "deleteActiveEffect", "updateActiveEffect"]) Hooks.on(hook, onEffect);
  Hooks.on("updateToken", onTokenUpdate);
  Hooks.on("createCombatant", onCombatantAdded);
  return true;
}
