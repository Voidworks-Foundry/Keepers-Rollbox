/** Each character's own remembered target, which the Keeper's target follows. See docs/combat.md. */
import { MODULE_ID, isActiveKeeper, isKeeper, sameActor, warn } from "../utils.js";
import { ownCharacter } from "../player/index.js";
import { currentCombatant, gameplayOn, viewedCombat } from "./encounter.js";
import { tokenOf } from "./sight.js";
import { pickedCombatant } from "./turn-pick.js";

const TARGET_FLAG = "ownTarget";

let acting = null;
// True while Rollbox sets the Keeper's targets itself, so the change isn't remembered as the character's own.
let applying = false;
let pending = null;
// Targets still being saved, read before the flag so a look right after doesn't take the old target back.
const saving = new Map();

function sceneToken(id) {
  if (!id) return null;
  try {
    return globalThis.canvas?.tokens?.get?.(id)
      ?? Array.from(globalThis.canvas?.tokens?.placeables ?? []).find((token) => token?.id === id) ?? null;
  } catch {
    return null;
  }
}

function flagOf(token) {
  if (token?.id && saving.has(token.id)) return saving.get(token.id);
  try {
    return token?.document?.getFlag?.(MODULE_ID, TARGET_FLAG) ?? null;
  } catch {
    return null;
  }
}

/**
 * Returns the token this character last targeted, while it is on the viewed scene.
 * @param {Actor} actor
 * @returns {Token|null}
 */
export function rememberedTarget(actor) {
  return sceneToken(flagOf(tokenOf(actor)));
}

async function remember(actor, target) {
  const own = tokenOf(actor);
  if (!own?.document || !target?.id || target.id === own.id || flagOf(own) === target.id) return false;
  saving.set(own.id, target.id);
  try {
    await own.document.setFlag(MODULE_ID, TARGET_FLAG, target.id);
    return true;
  } catch (error) {
    warn(`couldn't remember ${actor?.name ?? "the character"}'s target.`, error);
    return false;
  } finally {
    if (saving.get(own.id) === target.id) saving.delete(own.id);
  }
}

/** The one selected token's character; with none selected in combat, the turn order's pick, else the turn's. */
function keeperActsFor() {
  let controlled = [];
  try {
    controlled = Array.from(globalThis.canvas?.tokens?.controlled ?? []).filter((token) => token?.actor);
  } catch {
    controlled = [];
  }
  if (controlled.length === 1) return controlled[0].actor;
  const combat = viewedCombat();
  if (controlled.length || !combat) return null;
  return pickedCombatant(combat)?.actor ?? currentCombatant(combat)?.actor ?? null;
}

function follow(actor) {
  const target = rememberedTarget(actor);
  let now = [];
  try {
    now = Array.from(globalThis.game?.user?.targets ?? [], (token) => token.id);
  } catch {
    now = [];
  }
  const wanted = target ? [target.id] : [];
  if (now.length === wanted.length && now.every((id) => wanted.includes(id))) return false;
  const layer = globalThis.canvas?.tokens;
  if (typeof layer?.setTargets !== "function") return false;
  applying = true;
  try {
    layer.setTargets(wanted, { mode: "replace" });
    return true;
  } catch (error) {
    warn("couldn't set the Keeper's target.", error);
    return false;
  } finally {
    applying = false;
  }
}

/**
 * Works out who the Keeper acts for; someone new gets their remembered target set as the Keeper's.
 * @returns {boolean} true when the Keeper's targets were set
 */
export function actingChanged() {
  if (!isKeeper()) return false;
  const now = keeperActsFor();
  if (now === acting || (now && acting && sameActor(now, acting))) return false;
  acting = now;
  return now && gameplayOn() ? follow(now) : false;
}

/**
 * Looks again at who the Keeper acts for once the burst of selection changes is over.
 * @returns {void}
 */
export function selectionChanged() {
  if (!isKeeper() || pending) return;
  // Selecting one token releases the others first, so the in-between selection must not count.
  pending = setTimeout(() => {
    pending = null;
    actingChanged();
  }, 0);
}

/**
 * Remembers a new target for the character it was taken for: the Keeper's acting one, or a player's own investigator.
 * @param {User} user whose targets changed
 * @param {Token} token
 * @param {boolean} targeted
 * @returns {Promise<boolean>} true when remembered
 */
export async function onTargeted(user, token, targeted) {
  if (!targeted || !isKeeper() || !gameplayOn() || !user || !token) return false;
  const self = globalThis.game?.user;
  if (user === self || (user.id && user.id === self?.id)) {
    if (applying) return false;
    const who = keeperActsFor();
    return who ? remember(who, token) : false;
  }
  if (user.isGM || !isActiveKeeper()) return false;
  const own = ownCharacter(user);
  return own ? remember(own, token) : false;
}

/**
 * Makes every character remembering a deleted token forget it. Active GM only.
 * @param {TokenDocument} deleted
 * @returns {Promise<number>} how many forgot it
 */
export async function onTokenDeleted(deleted) {
  if (!isActiveKeeper() || !deleted?.id) return 0;
  let count = 0;
  for (const token of Array.from(globalThis.canvas?.tokens?.placeables ?? [])) {
    if (flagOf(token) !== deleted.id) continue;
    try {
      await token.document.unsetFlag(MODULE_ID, TARGET_FLAG);
      count += 1;
    } catch (error) {
      warn("couldn't forget a deleted target.", error);
    }
  }
  return count;
}

function onTurnMoved(_combat, changes) {
  if (changes && ("turn" in changes || "round" in changes)) selectionChanged();
}

/**
 * Registers the hooks that record targets and follow whom the Keeper acts for. Call at ready.
 * @returns {boolean} false for players
 */
export function registerOwnTarget() {
  if (!isKeeper()) return false;
  acting = null;
  Hooks.on("targetToken", onTargeted);
  Hooks.on("controlToken", selectionChanged);
  Hooks.on("updateCombat", onTurnMoved);
  Hooks.on("deleteCombat", selectionChanged);
  Hooks.on("deleteToken", onTokenDeleted);
  return true;
}

/**
 * Forgets whom the Keeper acted for, for the tests.
 * @returns {void}
 */
export function resetOwnTarget() {
  acting = null;
  applying = false;
  clearTimeout(pending);
  pending = null;
  saving.clear();
}
