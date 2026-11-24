/** A character's weapons for the Attack tab: skill, reach, ammo, picked weapon. See docs/action-flyout.md. */
import { MODULE_ID, numberOrNull, option, warn } from "../../utils.js";
import { findSkillRow, skills } from "../../skill-values/index.js";
import { isManeuverWeapon, unarmedOnSheet, weaponSkills } from "../../roll-requests/index.js";
import { MELEE_REACH_DEFAULT, PICKED_FLAG, edgeDistance } from "../../shared/index.js";

/** Names the picked weapon when it is bare hands and the sheet has no unarmed weapon. */
export const UNARMED = "unarmed";
/** Holds Fighting (Brawl), the skill unarmed and improvised attacks use. */
export const BRAWL = Object.freeze({ name: "Fighting (Brawl)", cocid: "i.skill.fighting-brawl" });

const isRanged = (weapon) => weapon?.system?.properties?.rngd === true;
const FIGHTING = /fighting|brawl/i;
/**
 * Returns whether a weapon reaches like melee; CoC7's bullwhip and mace spray are ranged on a Fighting skill.
 * @param {Item} weapon
 * @returns {boolean}
 */
export const isMelee = (weapon) => !isRanged(weapon) || FIGHTING.test(String(weapon?.system?.skill?.main?.name ?? ""));
/**
 * Returns whether a weapon is a gun: ranged and not thrown.
 * @param {Item} weapon
 * @returns {boolean}
 */
export const isFirearm = (weapon) => isRanged(weapon) && weapon?.system?.properties?.thrown !== true;

// CoC7 keeps weapon ranges in yards, as a number or a quotient ("10/3": ten feet).
const YARD_METRES = 0.9144;
const PLAIN_RANGE = /^\s*(\d+(?:\.\d+)?)\s*(?:\/\s*(\d+(?:\.\d+)?))?\s*$/;

function ammoOf(weapon) {
  const capacity = numberOrNull(weapon?.system?.bullets);
  if (!capacity || capacity <= 0) return null;
  return { loaded: Math.max(0, numberOrNull(weapon.system.ammo) ?? 0), capacity };
}

/**
 * Returns the token a character stands on in this scene: its own token, else the first one placed.
 * @param {Actor} actor
 * @returns {Token|null}
 */
export function tokenOf(actor) {
  try {
    if (actor?.isToken && actor.token?.object) return actor.token.object;
    return actor?.getActiveTokens?.()?.[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Returns the edge-to-edge distance between two tokens, in the scene's units.
 * @param {Token|null} from
 * @param {Token|null} to
 * @returns {{distance: number, units: string, metres: number|null}|null}
 */
export function distanceBetween(from, to) {
  return from && to ? edgeDistance(from, to) : null;
}

// Only a weapon CoC7 marks ranged has its own reach: its melee card ignores the field, and imported NPC sheets
// often hold a skill value there. A formula ("@STR/5") is worked out as CoC7 does.
function ownReach(weapon) {
  if (!isRanged(weapon) || !isMelee(weapon)) return null;
  const text = String(weapon?.system?.range?.normal?.value ?? "").trim();
  if (!text) return null;
  let yards = null;
  const plain = PLAIN_RANGE.exec(text);
  if (plain) yards = Number(plain[1]) / (plain[2] ? Number(plain[2]) : 1);
  else {
    try {
      const values = weapon.parent?.parsedValues?.() ?? {};
      yards = Number(new globalThis.Roll(text, values).evaluateSync({ strict: false }).total);
    } catch {
      yards = null;
    }
  }
  return Number.isFinite(yards) && yards > 0 ? yards * YARD_METRES : null;
}

function reachOf(weapon) {
  if (!isMelee(weapon)) return null;
  return ownReach(weapon) ?? numberOrNull(option("rollboxMeleeReach")) ?? MELEE_REACH_DEFAULT;
}

/**
 * Returns whether a weapon reaches the target; ranged weapons and an unknown unit always do.
 * @param {Item} weapon
 * @param {{metres: number|null}|null} measured from distanceBetween
 * @returns {boolean}
 */
export function inReach(weapon, measured) {
  const reach = reachOf(weapon);
  if (reach === null || !Number.isFinite(measured?.metres)) return true;
  return measured.metres <= reach;
}

function weaponItems(actor, unarmed) {
  try {
    return Array.from(actor?.items ?? []).filter((item) => item?.type === "weapon" && item !== unarmed
      && !isManeuverWeapon(item))
      .sort((a, b) => String(a.name ?? "").localeCompare(String(b.name ?? "")));
  } catch {
    return [];
  }
}

function skillRow(actor, weapon, rows) {
  try {
    const [{ skill } = {}] = weaponSkills(actor, weapon);
    return skill ? (findSkillRow(rows, skill) ?? { name: skill.name, value: null }) : null;
  } catch (error) {
    warn(`could not read the skill of ${weapon?.name}.`, error);
    return null;
  }
}

/**
 * Returns the weapons the Attack tab lists, unarmed first: the sheet's own, or a stand-in with id UNARMED.
 * @param {Actor} actor
 * @param {Token|null} [target] the targeted token, to grey out melee weapons out of reach
 * @returns {{weapon: Item, inReach: boolean, reach: number|null, ammo: {loaded: number, capacity: number}|null,
 *   unarmed: boolean, skill: {name: string, value: number|null, half?: number, fifth?: number}|null}[]}
 */
export function weaponsFor(actor, target = null) {
  if (!actor) return [];
  const distance = target ? distanceBetween(tokenOf(actor), target) : null;
  const rows = skills(actor);
  const sheetUnarmed = unarmedOnSheet(actor);
  const unarmed = sheetUnarmed ?? { id: UNARMED, name: "Unarmed", type: "weapon",
    system: { properties: { rngd: false }, range: { normal: { damage: "1D3+DB" } } } };
  const brawl = findSkillRow(rows, BRAWL) ?? { name: BRAWL.name, value: null };
  return [
    { weapon: unarmed, unarmed: true, inReach: inReach(unarmed, distance), reach: reachOf(unarmed), ammo: null,
      skill: sheetUnarmed ? (skillRow(actor, sheetUnarmed, rows) ?? brawl) : brawl },
    ...weaponItems(actor, sheetUnarmed).map((weapon) => ({ weapon, unarmed: false, inReach: inReach(weapon, distance),
      reach: reachOf(weapon),
      ammo: ammoOf(weapon), skill: skillRow(actor, weapon, rows) }))
  ];
}

/**
 * Returns the character's picked weapon: an item id, or UNARMED.
 * @param {Actor} actor
 * @returns {string|null}
 */
export function pickedWeapon(actor) {
  try {
    return actor?.getFlag?.(MODULE_ID, PICKED_FLAG) ?? null;
  } catch {
    return null;
  }
}

/**
 * Saves the picked weapon on the character; an unlinked token keeps its own.
 * @param {Actor} actor
 * @param {string} weaponId the item id, or UNARMED
 * @returns {Promise<boolean>} true when saved (or already saved)
 */
export async function setPickedWeapon(actor, weaponId) {
  if (!actor || !weaponId || typeof actor.setFlag !== "function") return false;
  if (pickedWeapon(actor) === weaponId) return true;
  try {
    await actor.setFlag(MODULE_ID, PICKED_FLAG, weaponId);
    return true;
  } catch (error) {
    warn(`couldn't save ${actor.name}'s picked weapon.`, error);
    return false;
  }
}

/**
 * Clears the character's picked weapon.
 * @param {Actor} actor
 * @returns {Promise<boolean>} true when there was one and it was cleared
 */
export async function clearPickedWeapon(actor) {
  if (pickedWeapon(actor) === null || typeof actor?.unsetFlag !== "function") return false;
  try {
    await actor.unsetFlag(MODULE_ID, PICKED_FLAG);
    return true;
  } catch (error) {
    warn(`couldn't clear ${actor?.name}'s picked weapon.`, error);
    return false;
  }
}
