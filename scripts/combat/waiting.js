/** Holds players' attacks while the Keeper decides the first blow, through a scene flag. See docs/combat.md. */
import { MODULE_ID, isActiveKeeper, isKeeper, warn } from "../utils.js";
import { viewedCombat } from "./encounter.js";

const WAITING_FLAG = "firstBlow";
// Long enough for an answered attack to reach CoC7 and its First blow card to come up.
const ATTACK_MS = 30000;

// What holds the players, by key: `{ card }` while it is on the page, or `{ until }` a time.
const holds = new Map();
// The mark comes off the scene it went on, even after the Keeper moved to another.
let marked = null;
let writing = Promise.resolve();

function counts(hold) {
  if (hold.card) return hold.card.isConnected === true;
  return Date.now() < hold.until;
}

function holding() {
  for (const [key, hold] of holds) if (!counts(hold)) holds.delete(key);
  return holds.size > 0;
}

function markOf(scene) {
  try {
    return scene?.getFlag?.(MODULE_ID, WAITING_FLAG) ?? null;
  } catch {
    return null;
  }
}

/** Puts the scene's mark on or off to match the holds, one write after another. */
function sync() {
  if (!isKeeper()) return writing;
  writing = writing.then(async () => {
    const on = holding();
    const scene = on ? (marked ?? globalThis.canvas?.scene ?? null) : marked;
    if (!scene) return;
    try {
      if (on && !markOf(scene)) await scene.setFlag(MODULE_ID, WAITING_FLAG, { at: Date.now() });
      if (on) marked = scene;
      if (!on) {
        if (markOf(scene)) await scene.unsetFlag(MODULE_ID, WAITING_FLAG);
        marked = null;
      }
    } catch (error) {
      warn("couldn't mark the scene while the first blow is decided.", error);
    }
  });
  return writing;
}

/**
 * Holds the players while a card is on the page or for a while, or lets go. Keeper only.
 * @param {string} key what holds them, e.g. "about:<attacker>><target>", "firstBlow"
 * @param {{card?: HTMLElement|null, ms?: number}|null} hold null lets go
 * @returns {Promise<void>} once the scene's mark matches
 */
export function holdPlayers(key, hold) {
  if (!isKeeper() || !key) return Promise.resolve();
  if (!hold) holds.delete(key);
  else if (hold.card) holds.set(key, { card: hold.card });
  else holds.set(key, { until: Date.now() + (Number(hold.ms) || ATTACK_MS) });
  if (hold && !hold.card) setTimeout(() => sync(), (Number(hold.ms) || ATTACK_MS) + 50);
  return sync();
}

/**
 * Lets go of every timed hold of an answered attack.
 * @returns {Promise<void>}
 */
export function releaseAttacks() {
  for (const key of [...holds.keys()]) if (holds.get(key).until) holds.delete(key);
  return sync();
}

/**
 * Tells whether this player waits for the Keeper: the viewed scene is marked and no encounter runs.
 * @returns {boolean} always false for a Keeper
 */
export function keeperDeciding() {
  if (isKeeper() || viewedCombat()) return false;
  return Boolean(markOf(globalThis.canvas?.scene));
}

/**
 * Takes off a mark a Keeper's page closed mid-decision left on the viewed scene. Active GM only; call at ready.
 * @returns {Promise<boolean>} true when a mark was taken off
 */
export async function clearLeftoverWait() {
  holds.clear();
  marked = null;
  const scene = globalThis.canvas?.scene ?? null;
  if (!isActiveKeeper() || !markOf(scene)) return false;
  try {
    await scene.unsetFlag(MODULE_ID, WAITING_FLAG);
    return true;
  } catch (error) {
    warn("couldn't clear the first blow's mark on the scene.", error);
    return false;
  }
}

/**
 * Forgets every hold and the marked scene, for the tests.
 * @returns {void}
 */
export function resetWaiting() {
  holds.clear();
  marked = null;
  writing = Promise.resolve();
}
