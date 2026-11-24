/** Readied firearms: presses CoC7's own Draw gun button at round starts and on a holster. See docs/combat.md. */
import {
  COC7_ID, KEEPER, MODULE_ID, declareSettings, isActiveKeeper, option, tellKeeper, warn
} from "../utils.js";
import { PICKED_FLAG } from "../shared/index.js";
import { combatantFor, gameplayOn, roundOf, runningCombat, turnsOf } from "./encounter.js";
import { SKIP_FLAG, standingBy } from "./fight-state.js";
import { passTurn } from "./fight-changes.js";
import { hasActed } from "./round-notes.js";

/**
 * Declares the readied firearms settings.
 * @type {object[]}
 */
export const SETTINGS = declareSettings([
  { key: "rollboxReadiedFirearms", scope: "world", type: Boolean, default: true, section: "gameplay",
    label: "Manage readied firearms",
    hint: "Rollbox sets CoC7's Draw gun at the start of each round for everyone holding a gun, and clears it at once when they pick something else.",
    note: KEEPER },
  { key: "rollboxBowsReadied", scope: "world", type: Boolean, default: false, section: "gameplay",
    label: "Bows count as readied firearms",
    hint: "Off: a bow never shoots at DEX + 50, since an arrow is drawn for every shot.", note: KEEPER },
  { key: "rollboxSwitchLosesReadied", scope: "world", type: Boolean, default: true, section: "gameplay",
    label: "Switching weapons loses the readied firearm for the round",
    hint: "Switching from one gun to another drops it in the turn order for this round; it is readied again next round.",
    note: KEEPER }
]);

// CoC7 8.15: the combatant flag behind Draw gun, and the button its renderCombatTracker adds to each row.
const GUN_FLAG = "hasGun";
const GUN_BUTTON = '[data-control="drawGun"]';
// CoC7 8.15 doesn't await the initiative it sets, and sets none when the gun's isn't higher, so the wait is capped.
const SETTLE_MS = 1500;
// Matched on the weapon's name or its main skill's ("Firearms (Bow)"), also Longbow, Shortbow, Crossbow.
const BOW = /\b(?:long|short|cross)?bows?\b/i;

const managing = () => gameplayOn() && option("rollboxReadiedFirearms") !== false;

function pickedWeaponId(actor) {
  try {
    const picked = actor?.getFlag?.(MODULE_ID, PICKED_FLAG);
    if (typeof picked === "string" && picked) return picked;
    return typeof picked?.id === "string" && picked.id ? picked.id : null;
  } catch {
    return null;
  }
}

/**
 * Returns the weapon item picked in the Action flyout.
 * @param {Actor} actor
 * @returns {Item|null}
 */
export function pickedWeapon(actor) {
  const id = pickedWeaponId(actor);
  if (!id) return null;
  try {
    return actor.items?.get?.(id) ?? Array.from(actor.items ?? []).find((item) => item?.id === id) ?? null;
  } catch {
    return null;
  }
}

/**
 * Tells whether a weapon readies as a firearm: ranged, not thrown, and a bow only with the Bows setting on.
 * @param {Item|null} weapon
 * @returns {boolean}
 */
export function isFirearm(weapon) {
  const properties = weapon?.system?.properties;
  if (weapon?.type !== "weapon" || properties?.rngd !== true || properties?.thrown === true) return false;
  const bow = BOW.test(String(weapon.name ?? "")) || BOW.test(String(weapon.system?.skill?.main?.name ?? ""));
  return !bow || option("rollboxBowsReadied") === true;
}

/**
 * Tells whether CoC7's Draw gun is on for this combatant.
 * @param {Combatant} combatant
 * @returns {boolean}
 */
export function hasGun(combatant) {
  try {
    return combatant?.getFlag?.(COC7_ID, GUN_FLAG) === true;
  } catch {
    return false;
  }
}

function gunButton(combatant) {
  try {
    const root = globalThis.ui?.combat?.element;
    const row = root?.querySelector?.(`.combatant[data-combatant-id="${combatant.id}"]`);
    return row?.querySelector?.(GUN_BUTTON) ?? null;
  } catch {
    return null;
  }
}

// A tracker on a closed sidebar tab may not be drawn yet, so it is drawn first.
async function findGunButton(combatant) {
  const shown = gunButton(combatant);
  if (shown || typeof globalThis.ui?.combat?.render !== "function") return shown;
  try {
    await ui.combat.render({ force: true });
  } catch (error) {
    warn("couldn't draw Foundry's combat tracker to find CoC7's Draw gun.", error);
  }
  return gunButton(combatant);
}

function initiativeSettled(combatant) {
  let hookId = null;
  let timer = null;
  let done = () => {};
  const promise = new Promise((resolve) => {
    done = () => {
      Hooks.off("updateCombatant", hookId);
      clearTimeout(timer);
      resolve();
    };
  });
  timer = setTimeout(() => done(), SETTLE_MS);
  hookId = Hooks.on("updateCombatant", (doc, changes) => {
    if (doc?.id === combatant.id && changes && "initiative" in changes) done();
  });
  return { promise, cancel: () => done() };
}

/** Presses Draw gun unless already as asked; one press per combatant and direction at a time. */
function setDrawGun(combatant, on) {
  const key = `${combatant?.id}:${on}`;
  if (!pressing.has(key)) pressing.set(key, pressDrawGun(combatant, on).finally(() => pressing.delete(key)));
  return pressing.get(key);
}

// Place on standby and going on standby both put the gun away; two presses of the toggle would turn it back on.
const pressing = new Map();

// CoC7 8.15 `_onToggleGun` is the button's onclick; called with a click carrying the button, so it can be awaited.
async function pressDrawGun(combatant, on) {
  if (!combatant || hasGun(combatant) === on) return false;
  const name = combatant.actor?.name ?? combatant.name ?? "a combatant";
  const node = await findGunButton(combatant);
  const press = node?.onclick;
  const view = node?.ownerDocument?.defaultView;
  if (typeof press !== "function" || !view) {
    warn("CoC7's Draw gun button isn't in the combat tracker; left as it is.");
    tellKeeper(`Rollbox: turn CoC7's Draw gun ${on ? "on" : "off"} for ${name} in the combat tracker.`);
    return false;
  }
  const settled = initiativeSettled(combatant);
  try {
    const event = new view.MouseEvent("click", { bubbles: true, cancelable: true, view });
    Object.defineProperty(event, "currentTarget", { value: node });
    await press.call(node, event);
    await settled.promise;
    return hasGun(combatant) === on;
  } catch (error) {
    settled.cancel();
    warn(`CoC7's Draw gun failed for ${name}.`, error);
    return false;
  }
}

/**
 * Turns CoC7's Draw gun off through its own button. Active GM only, with readied firearms managed.
 * @param {Combatant} combatant
 * @returns {Promise<boolean>} true when Draw gun was turned off
 */
export async function holsterGun(combatant) {
  // Draw gun is a toggle: with two GMs, a press on each client would turn it back on.
  if (!isActiveKeeper() || !managing()) return false;
  // Not checked for the flag first: a press already putting it away is waited for (setDrawGun).
  return setDrawGun(combatant, false);
}

/**
 * Tells whether a combatant update turned CoC7's Draw gun on.
 * @param {object} changes the updateCombatant hook's changes
 * @returns {boolean}
 */
export function gunDrawn(changes) {
  return changes?.flags?.[COC7_ID]?.[GUN_FLAG] === true;
}

// So a pick mid-round can tell a switch from the same gun.
const lastPicked = new Map();

/**
 * Sets Draw gun at a round's start to match each combatant's picked weapon; no pick is left to the Keeper.
 * @param {Combat} combat
 * @returns {Promise<number>} how many combatants changed
 */
export async function readyForRound(combat) {
  if (!isActiveKeeper() || !managing()) return 0;
  lastPicked.clear();
  const top = combat?.turn === 0;
  const round = combat?.round;
  let changed = 0;
  for (const combatant of turnsOf(combat)) {
    const id = pickedWeaponId(combatant.actor);
    if (!id) continue;
    lastPicked.set(combatant.id, id);
    const gun = isFirearm(pickedWeapon(combatant.actor));
    // Drawing a gun would bring someone standing by off standby.
    if (gun && standingBy(combatant)) continue;
    if (await setDrawGun(combatant, gun)) changed += 1;
  }
  // Foundry v14 keeps the turn on its combatant through CoC7's re-sort, so a shooter now on top would wait a round.
  if (changed && top && combat.round === round && combat.turn !== 0) {
    try {
      await combat.update({ turn: 0 });
    } catch (error) {
      warn("couldn't start the round at the top of the new order.", error);
    }
  }
  return changed;
}

function turnHasCome(combat, combatant) {
  const index = turnsOf(combat).findIndex((c) => c === combatant || c.id === combatant.id);
  const turn = Number(combat?.turn);
  return index !== -1 && Number.isInteger(turn) && index <= turn;
}

/**
 * Holsters a drawn gun when a pick mid-round has no readied bonus, or drops it on a switch to another firearm.
 * @param {Actor} actor
 * @returns {Promise<boolean>} true when Draw gun was cleared
 */
export async function onPicked(actor) {
  if (!isActiveKeeper() || !managing()) return false;
  const combat = runningCombat(actor);
  const combatant = combatantFor(actor, combat);
  if (!combatant) return false;
  const id = pickedWeaponId(actor);
  const before = lastPicked.get(combatant.id);
  lastPicked.set(combatant.id, id);
  if (!hasGun(combatant)) return false;
  if (!id || !isFirearm(pickedWeapon(actor))) return holsterInFight(combat, combatant);
  // A new initiative now would re-sort them past people who haven't acted.
  if (turnHasCome(combat, combatant)) return false;
  const switched = before !== id;
  return switched && option("rollboxSwitchLosesReadied") !== false ? setDrawGun(combatant, false) : false;
}

// Someone who acted is skipped if the drop puts their place still to come; on their turn it passes to whoever is now above.
async function holsterInFight(combat, combatant) {
  const turns = turnsOf(combat);
  const index = turns.findIndex((c) => c === combatant || c.id === combatant.id);
  const turn = Number(combat?.turn);
  const theirTurn = Boolean(combat?.started) && index === turn;
  const next = theirTurn ? turns[index + 1] ?? null : null;
  const acted = (index !== -1 && index < turn) || (theirTurn && hasActed(combatant.actor));
  if (!(await setDrawGun(combatant, false))) return false;
  const after = turnsOf(combat);
  const place = after.findIndex((c) => c === combatant || c.id === combatant.id);
  const passes = theirTurn && next && after.indexOf(next) !== -1 && after.indexOf(next) < place;
  if (acted && (passes || place > Number(combat?.turn))) {
    try {
      await combatant.setFlag(MODULE_ID, SKIP_FLAG, roundOf(combat));
    } catch (error) {
      warn("couldn't keep a holstered combatant from acting again.", error);
    }
  }
  if (passes) await passTurn(combat, next);
  return true;
}

/**
 * Returns the initiative a holster would take a drawn gun from and to, for the Action flyout's warning.
 * @param {Actor} actor
 * @returns {{from: number, to: number}|null} null when there is nothing to warn about
 */
export function drawnGun(actor) {
  if (!managing()) return null;
  const combatant = combatantFor(actor, runningCombat(actor));
  if (!combatant || !hasGun(combatant) || !isFirearm(pickedWeapon(actor))) return null;
  const dex = Number(actor?.system?.characteristics?.dex?.value);
  const from = Number(combatant.initiative);
  return Number.isFinite(dex) && Number.isFinite(from) ? { from, to: dex } : null;
}

function pickChanged(changes) {
  const flags = changes?.flags?.[MODULE_ID];
  if (!flags) return false;
  return PICKED_FLAG in flags || `-=${PICKED_FLAG}` in flags;
}

/**
 * Holds the hook handlers registerCombat installs on the Keeper's client.
 * @type {{updateCombat: Function, updateActor: Function, deleteCombat: Function}}
 */
export const readiedHooks = Object.freeze({
  updateCombat(combat, changes) {
    if (!changes || !("round" in changes) || roundOf(combat) < 1) return Promise.resolve(0);
    return readyForRound(combat);
  },
  updateActor(actor, changes) {
    if (pickChanged(changes)) onPicked(actor);
  },
  deleteCombat() {
    lastPicked.clear();
  }
});
