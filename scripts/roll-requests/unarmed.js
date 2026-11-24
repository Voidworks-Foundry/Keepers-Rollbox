/**
 * Unarmed attacks and maneuvers as CoC7 weapon items: reads a sheet, adds or switches only on the Keeper's yes.
 * See docs/roll-requests.md.
 */
import { COC7_ID, itemsOf, warn } from "../utils.js";

/** CoC7's CoC ID of its unarmed weapon. */
export const UNARMED_COCID = "i.weapon.brawl";
const BRAWL_COCID = "i.skill.fighting-brawl";
const UNARMED_NAMES = new Set(["punch", "unarmed", "brawl", "fist", "fists"]);
const CREATURE_UNARMED = "fighting";
const MANEUVER_NAME = /\(mnvr\)/i;
const FIGHTING = /fighting|brawl/i;

const ADDS = Object.freeze({ person: "Punch", creature: "Fighting" });
const GENERIC_MANEUVERS = new Set(["maneuver (brawl)", "maneuver (fighting)"]);

/**
 * Returns "creature" for CoC7's creature type, "person" for investigators and NPCs.
 * @param {Actor} actor
 * @returns {"creature"|"person"|null}
 */
export function actorKind(actor) {
  if (actor?.type === "creature") return "creature";
  return actor?.type === "character" || actor?.type === "npc" ? "person" : null;
}

const cocidOf = (item) => String(item?.flags?.[COC7_ID]?.cocidFlag?.id ?? "");
const isWeapon = (item) => item?.type === "weapon";

/**
 * Returns whether the weapon is a maneuver: Maneuver on, or "(mnvr)" in its name as the rulebook writes it.
 * @param {Item} weapon
 * @returns {boolean}
 */
export function isManeuverWeapon(weapon) {
  return isWeapon(weapon) && (weapon.system?.properties?.mnvr === true || MANEUVER_NAME.test(String(weapon.name ?? "")));
}

function localUnarmedName() {
  try {
    const localized = game.i18n?.localize?.("CoC7.UnarmedWeaponName");
    return localized && localized !== "CoC7.UnarmedWeaponName" ? localized.toLocaleLowerCase() : null;
  } catch {
    return null;
  }
}

const namedManeuver = (item) => MANEUVER_NAME.test(String(item?.name ?? ""))
  || GENERIC_MANEUVERS.has(String(item?.name ?? "").trim().toLocaleLowerCase());

/**
 * Returns the unarmed weapon on the sheet, by CoC ID or name, Maneuver on or off; never one named as a maneuver.
 * @param {Actor} actor
 * @returns {Item|null}
 */
export function unarmedOnSheet(actor) {
  const local = localUnarmedName();
  const creature = actorKind(actor) === "creature";
  return itemsOf(actor).find((item) => {
    if (!isWeapon(item) || namedManeuver(item) || item.system?.properties?.rngd === true) return false;
    if (cocidOf(item) === UNARMED_COCID) return true;
    const name = String(item.name ?? "").trim().toLocaleLowerCase();
    return name === local || UNARMED_NAMES.has(name) || (creature && name === CREATURE_UNARMED);
  }) ?? null;
}

/**
 * Returns the character's maneuver weapons: "(mnvr)" attacks first, then the rest, the generic ones last.
 * @param {Actor} actor
 * @returns {Item[]}
 */
export function maneuverWeapons(actor) {
  const rank = (item) => {
    if (MANEUVER_NAME.test(String(item.name ?? ""))) return 0;
    return GENERIC_MANEUVERS.has(String(item.name ?? "").trim().toLocaleLowerCase()) ? 2 : 1;
  };
  return itemsOf(actor).filter(isManeuverWeapon)
    .sort((a, b) => rank(a) - rank(b) || String(a.name).localeCompare(String(b.name)));
}

/**
 * Returns the weapons to fight back with: the unarmed weapon first, then the other melee weapons A–Z.
 * @param {Actor} actor
 * @returns {Item[]}
 */
export function meleeWeapons(actor) {
  const unarmed = unarmedOnSheet(actor);
  const others = itemsOf(actor).filter((item) => isWeapon(item) && item !== unarmed && !namedManeuver(item)
    && item.system?.properties?.rngd !== true).sort((a, b) => String(a.name).localeCompare(String(b.name)));
  return unarmed ? [unarmed, ...others] : others;
}

const isBrawl = (item) => item?.type === "skill" && (cocidOf(item) === BRAWL_COCID
  || /^(fighting \(brawl\)|brawl)$/i.test(String(item.name ?? "").trim()));

/**
 * Returns the sheet skill a weapon's `system.skill.main.id` points at.
 * @param {Actor} actor
 * @param {Item} weapon
 * @returns {Item|null} null when it doesn't resolve
 */
export function weaponSkillItem(actor, weapon) {
  const id = weapon?.system?.skill?.main?.id;
  if (!id) return null;
  const skill = itemsOf(actor).find((item) => item.id === id);
  return skill?.type === "skill" ? skill : null;
}

/**
 * Returns whether CoC7's `isSkillSet` says the weapon has no skill, so its attack card would have no roll button.
 * @param {Item} weapon
 * @returns {boolean} false when the weapon doesn't say
 */
export function skillUnset(weapon) {
  return weapon?.system?.isSkillSet === false;
}

/**
 * Returns the fighting skill an added weapon links to: a person's Fighting (Brawl), a creature's melee skill.
 * @param {Actor} actor
 * @returns {Item|null}
 */
export function fightingSkill(actor) {
  const items = itemsOf(actor);
  if (actorKind(actor) !== "creature") return items.find(isBrawl) ?? null;
  for (const weapon of items.filter((item) => isWeapon(item) && item.system?.properties?.rngd !== true)) {
    const skill = weaponSkillItem(actor, weapon);
    if (skill && FIGHTING.test(String(skill.name ?? ""))) return skill;
  }
  return items.find((item) => item.type === "skill" && /^fighting(\s*\(fighting\))?$/i.test(String(item.name ?? "").trim()))
    ?? items.find(isBrawl) ?? null;
}

/**
 * Returns the character's fighting skills, A–Z.
 * @param {Actor} actor
 * @returns {Item[]}
 */
export function fightingSkills(actor) {
  return itemsOf(actor).filter((item) => item.type === "skill" && FIGHTING.test(String(item.name ?? "")))
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

/**
 * Returns what the sheet lacks for attacks and maneuvers, and what Rollbox would add or switch on.
 * @param {Actor} actor
 * @returns {{kind: "person"|"creature"|null, punch: string|null, maneuver: {switchOn: Item|null}|null,
 *   skill: Item|null}} `punch` null when the sheet has an unarmed weapon; `maneuver` null when it has a maneuver weapon
 */
export function missingAttacks(actor) {
  const kind = actorKind(actor);
  if (!kind) return { kind, punch: null, maneuver: null, skill: null };
  const unarmed = unarmedOnSheet(actor);
  return { kind, punch: unarmed ? null : ADDS[kind],
    maneuver: maneuverWeapons(actor).length ? null : { switchOn: unarmed }, skill: fightingSkill(actor) };
}

async function coc7Punch() {
  const cocid = game.CoC7?.cocid;
  if (typeof cocid?.fromCoCIDBest !== "function" || typeof globalThis.fromUuid !== "function") {
    warn("CoC7's game.CoC7.cocid.fromCoCIDBest is missing; Rollbox's unarmed weapon is made from scratch.");
    return null;
  }
  try {
    const [found] = await cocid.fromCoCIDBest({ cocid: UNARMED_COCID });
    const source = found?.uuid ? await fromUuid(found.uuid) : null;
    return source?.type === "weapon" && typeof source.toObject === "function" ? source.toObject() : null;
  } catch (error) {
    warn("couldn't find CoC7's unarmed weapon.", error);
    return null;
  }
}

async function addBrawl(actor) {
  if (typeof actor?.getItemOrAdd !== "function") return null;
  try {
    const skill = await actor.getItemOrAdd(BRAWL_COCID, "skill");
    return skill?.type === "skill" ? skill : null;
  } catch (error) {
    warn(`CoC7 couldn't add Fighting (Brawl) to ${actor.name ?? "the character"}'s sheet.`, error);
    return null;
  }
}

function attackData(base, { name, skill, maneuver }) {
  const data = foundryClone(base ?? { name, type: "weapon", system: { range: { normal: { damage: "1D3" } } } });
  delete data._id;
  data.name = name;
  data.system ??= {};
  data.system.skill = { main: { id: skill?.id ?? "", name: skill?.name ?? "" }, alternativ: { id: "", name: "" } };
  if (maneuver) data.system.properties = { ...(data.system.properties ?? {}), mnvr: true };
  return data;
}

function foundryClone(data) {
  return JSON.parse(JSON.stringify(data));
}

/**
 * Adds a copy of CoC7's unarmed weapon to the sheet, linked to `skill`, with Maneuver on when `maneuver`.
 * @param {Actor} actor
 * @param {{punch?: boolean, maneuver?: boolean, skill?: Item|null}} what `punch` or `maneuver` adds it
 * @returns {Promise<Item[]>} what was added (empty when nothing could be)
 */
export async function addAttacks(actor, { punch = false, maneuver = false, skill = null } = {}) {
  const kind = actorKind(actor);
  if (!kind || (!punch && !maneuver) || typeof actor?.createEmbeddedDocuments !== "function") return [];
  const linked = skill ?? fightingSkill(actor) ?? (kind === "person" ? await addBrawl(actor) : null);
  const data = [attackData(await coc7Punch(), { name: ADDS[kind], skill: linked, maneuver })];
  try {
    return Array.from(await actor.createEmbeddedDocuments("Item", data) ?? []);
  } catch (error) {
    warn(`couldn't add ${data.map((d) => d.name).join(" and ")} to ${actor.name ?? "the character"}'s sheet.`, error);
    return [];
  }
}

/**
 * Switches Maneuver on for a weapon, the same update CoC7's own toggle on the weapon sheet makes.
 * @param {Item} weapon
 * @returns {Promise<boolean>} true when it is on
 */
export async function switchManeuverOn(weapon) {
  if (!isWeapon(weapon)) return false;
  if (weapon.system?.properties?.mnvr === true) return true;
  try {
    await weapon.update({ "system.properties.mnvr": true });
    return true;
  } catch (error) {
    warn(`couldn't switch Maneuver on for ${weapon.name ?? "the weapon"}.`, error);
    return false;
  }
}

/**
 * Links a weapon to a skill on its sheet (`system.skill.main`), as CoC7 does for a weapon it adds.
 * @param {Item} weapon
 * @param {Item} skill
 * @returns {Promise<boolean>} true when saved
 */
export async function setWeaponSkill(weapon, skill) {
  if (!skill?.id || !weapon) return false;
  try {
    await weapon.update({ "system.skill.main.id": skill.id, "system.skill.main.name": skill.name });
    return true;
  } catch (error) {
    warn(`couldn't set ${weapon.name ?? "the weapon"}'s skill.`, error);
    return false;
  }
}
