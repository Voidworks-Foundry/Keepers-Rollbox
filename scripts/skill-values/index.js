/**
 * Skill values: what a character can roll, read from the actor and filled in with base values for anything
 * missing from the sheet. Characteristics, attributes (Luck and Sanity), every skill with its Regular,
 * Hard and Extreme values, the rows of the menus' two check tabs, and the lowest Luck for a group Luck roll. The only
 * owner of skill-name matching (by CoC ID, CoC7's own-language flag, name, and an open-ended skill's group); no
 * other part reads base-skills.js. Data and lookups only: no hooks, no UI, nothing written to any actor. Every
 * read is guarded, so a missing field gives an empty value instead of an error. No skill is ever hidden, whatever
 * CoC7's era: games move between eras (Void's decision, 2026-11-13).
 */
import { COC7_ID, numberOrNull } from "../utils.js";
import { BASE_SKILLS, GROUP_BASES } from "./base-skills.js";

/** The eight characteristics in the order of the investigator sheet. */
export const CHARACTERISTICS = Object.freeze(["str", "con", "siz", "dex", "app", "int", "pow", "edu"]);

/** Hard is half the value and Extreme a fifth. */
const HARD_DIVISOR = 2;
const EXTREME_DIVISOR = 5;

/**
 * A value with its Hard (half) and Extreme (fifth) values, rounded down as CoC7 works them out
 * (`apps/dice-pool.js`): 55 → { value: 55, half: 27, fifth: 11 }. The one place Rollbox works them out.
 * @param {number|string|null} value
 * @returns {{value: number|null, half: number|null, fifth: number|null}} all null when the value is unknown.
 */
export function withLevels(value) {
  const v = numberOrNull(value);
  if (v === null) return { value: null, half: null, fifth: null };
  return { value: v, half: Math.floor(v / HARD_DIVISOR), fifth: Math.floor(v / EXTREME_DIVISOR) };
}

// --- Matching skill names ---------------------------------------------------------------------------

/** A skill name made comparable the way CoC7 compares them: no accents, lower case; plus single spaces. */
export function comparable(name) {
  return String(name ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase().replace(/\s+/g, " ").trim();
}

/** True for a CoC ID (`i.skill.throw`), which CoC7 accepts wherever it takes a skill's name. */
export const isCocid = (text) => /^i\.skill\./.test(String(text ?? ""));

/** The value of one characteristic, or null. */
function characteristicValue(actor, key) {
  return numberOrNull(actor?.system?.characteristics?.[key]?.value);
}

/** A table entry's base value for this actor (Dodge and Language (Own) come from DEX and EDU). */
function tableBase(entry, actor) {
  if (typeof entry.base === "number") return entry.base;
  const value = characteristicValue(actor, entry.base.characteristic) ?? 0;
  return Math.floor(value / entry.base.divisor);
}

const TABLE_BY_COCID = new Map(BASE_SKILLS.map((entry) => [entry.cocid, entry]));
const TABLE_BY_NAME = new Map(BASE_SKILLS.map((entry) => [comparable(entry.name), entry]));
const OWN_LANGUAGE_ID = "i.skill.language-own";
const OWN_LANGUAGE = TABLE_BY_COCID.get(OWN_LANGUAGE_ID);

/**
 * Rollbox's table entry (Keeper Rulebook skill list, p. 56) for a skill: by CoC ID, then by name.
 * @param {string} name
 * @param {string|null} [cocid]
 * @returns {{name: string, cocid: string, base: number|object}|null}
 */
export function tableSkill(name, cocid) {
  return (cocid ? TABLE_BY_COCID.get(cocid) : null) ?? TABLE_BY_NAME.get(comparable(name)) ?? null;
}

/**
 * Rollbox's base value for a table skill, for this actor, without building every row: Dodge is half its DEX and
 * Language (Own) its EDU (p. 56). The same value skills() gives a skill missing from the sheet.
 * @param {Actor|null} actor
 * @param {string} cocid the table skill's CoC ID
 * @returns {number|null} null for a CoC ID the table doesn't have.
 */
export function tableBaseFor(actor, cocid) {
  const entry = cocid ? TABLE_BY_COCID.get(cocid) : null;
  return entry ? tableBase(entry, actor) : null;
}

/** The keys a skill reference ({ name, cocid }) is known by: its CoC ID, its table entry's, and its name. */
function skillKeys({ name, cocid } = {}) {
  const byCocid = isCocid(name); // a weapon's stored skill can be a CoC ID as its name (`i.skill.throw`)
  const entry = byCocid ? tableSkill("", name) : tableSkill(name, cocid);
  return [cocid, entry?.cocid, byCocid ? name : comparable(name)].filter(Boolean);
}

/**
 * True when two skill references (`{ name, cocid }`) mean the same skill: the same CoC ID, the same table entry, or
 * the same name. A skill can be stored by sheet id (with its CoC ID), by name, or by a CoC ID as its name.
 * @param {{name: string, cocid?: string|null}} a
 * @param {{name: string, cocid?: string|null}} b
 */
export function sameSkill(a, b) {
  const keys = skillKeys(b);
  return skillKeys(a).some((key) => keys.includes(key));
}

/**
 * The row for a skill among skills() or groupSkills() rows (anything with `name` and `cocid`): by CoC ID first, then
 * by name, the order sheetSkill() uses, so a menu shows the skill a request will send. A name that is a CoC ID is
 * looked up as one.
 * @param {{name: string, cocid?: string|null}[]} rows
 * @param {{name: string, cocid?: string|null}} skill
 * @returns {object|null}
 */
export function findSkillRow(rows, { name, cocid } = {}) {
  const list = Array.from(rows ?? []);
  const id = cocid || (isCocid(name) ? name : null);
  return (id ? list.find((row) => row.cocid === id) : null)
    ?? list.find((row) => comparable(row.name) === comparable(name)) ?? null;
}

/** The menus' key for a skill row, unique within a menu: "skill:spot hidden". */
export const skillKey = (name) => `skill:${comparable(name)}`;

/**
 * The rulebook base for an open-ended skill's specialisation, from its group (p. 56): "Pilot (Boat)" → 1,
 * "Language (Latin)" → 1. Null for a name without a specialisation, or a group the rulebook doesn't list.
 */
export function groupBase(name) {
  const [group, rest] = comparable(name).split(" (");
  return rest && group in GROUP_BASES ? GROUP_BASES[group] : null;
}

/** The skill items on an actor's sheet. Foundry's Collection iterates its documents. */
function sheetSkills(actor) {
  try {
    return Array.from(actor?.items ?? []).filter((item) => item?.type === "skill" && item.name);
  } catch {
    return [];
  }
}

/** A sheet skill's own CoC ID, or null. */
const itemCocid = (item) => item?.flags?.[COC7_ID]?.cocidFlag?.id ?? null;

/**
 * The table entry a sheet skill stands for: by CoC ID first (same in every language), then by name.
 * A sheet's own language is often renamed ("Language (English)") but keeps CoC7's `own` property.
 */
function tableEntryFor(item) {
  const cocid = itemCocid(item);
  if (cocid && TABLE_BY_COCID.has(cocid)) return TABLE_BY_COCID.get(cocid);
  if (item.system?.properties?.own === true) return OWN_LANGUAGE;
  return TABLE_BY_NAME.get(comparable(item.name));
}

/**
 * The skill item on the actor's sheet for a requested skill: by CoC ID, then (only when Language (Own) is asked
 * for by its CoC ID) the item with CoC7's own-language flag, then by name. CoC7 finds a renamed own language
 * ("Language (English)") only by its CoC ID, so a request for it by name doesn't match the flag.
 * @param {Actor} actor
 * @param {string} name
 * @param {string|null} [cocid]
 * @returns {Item|null}
 */
export function sheetSkill(actor, name, cocid) {
  const items = sheetSkills(actor);
  return items.find((item) => cocid && itemCocid(item) === cocid)
    ?? items.find((item) => cocid === OWN_LANGUAGE_ID && item.system?.properties?.own === true)
    ?? items.find((item) => comparable(item.name) === comparable(name))
    ?? null;
}

/**
 * Rollbox's base value for a sheet skill that isn't in the table: the rulebook's base for its
 * group ("Language (Latin)" → 1, "Survival (Arctic)" → 10), otherwise the sheet's own base.
 * The sheet's base can hold a hand-made NPC's whole value (CoC7's importer does that), which then
 * reads as untrained; it is only the last resort.
 */
function extraBase(item) {
  return groupBase(item.name) ?? numberOrNull(item.system?.adjustments?.base) ?? 0;
}

/** One skill row for the menus. */
function skillEntry({ name, value, base, onSheet, cocid }) {
  const levels = withLevels(value);
  return {
    name,
    value: levels.value,
    half: levels.half,
    fifth: levels.fifth,
    base,
    trained: onSheet && levels.value > base,
    onSheet,
    cocid: cocid ?? null
  };
}

/** A–Z by name. */
const byName = (a, b) => a.name.localeCompare(b.name);
/** Highest value first; equal values A–Z. */
const byValueThenName = (a, b) => (b.value - a.value) || byName(a, b);

/**
 * The eight characteristics, in sheet order.
 * @param {Actor} actor
 * @returns {{key: string, label: string, value: number|null, half: number|null, fifth: number|null}[]}
 *   Empty when there is no actor; values are null when the sheet has none.
 */
export function characteristics(actor) {
  if (!actor) return [];
  return CHARACTERISTICS.map((key) => ({ key, label: key.toUpperCase(), ...withLevels(characteristicValue(actor, key)) }));
}

/**
 * Luck and Sanity (Sanity with its max). Idea and Know are asked for as INT and EDU checks with a label.
 * @param {Actor} actor
 * @returns {{key: string, label: string, value: number|null, half: number|null, fifth: number|null,
 *   max?: number|null}[]} Empty when there is no actor.
 */
export function attributes(actor) {
  if (!actor) return [];
  const attribs = actor.system?.attribs;
  return [
    { key: "lck", label: "Luck", ...withLevels(attribs?.lck?.value) },
    { key: "san", label: "Sanity", ...withLevels(attribs?.san?.value), max: numberOrNull(attribs?.san?.max) }
  ];
}

/**
 * The character(s) with the lowest Luck, for a group Luck roll (Keeper Rulebook pp. 89-90: "the
 * player whose investigator has the lowest Luck score ... should make the roll"). More than one when
 * tied: the Keeper picks. Actors without a Luck value are left out.
 * @param {Iterable<Actor>} actors
 * @returns {Actor[]} Empty when no actor has a Luck value.
 */
export function lowestLuck(actors) {
  const withLuck = Array.from(actors ?? [])
    .map((actor) => ({ actor, luck: numberOrNull(actor?.system?.attribs?.lck?.value) }))
    .filter(({ luck }) => luck !== null);
  if (!withLuck.length) return [];
  const lowest = Math.min(...withLuck.map(({ luck }) => luck));
  return withLuck.filter(({ luck }) => luck === lowest).map(({ actor }) => actor);
}

/**
 * Every skill for one character. Trained skills (on the sheet and above Rollbox's base value) come
 * first, highest first; then every untrained skill A–Z, including skills missing from the sheet at
 * their base value (Dodge = half DEX, Language (Own) = EDU). Skills on the sheet that aren't in the
 * table (specialisations, homebrew) are included at their sheet value. The divider goes before the
 * first entry whose `trained` is false.
 * @param {Actor} actor
 * @returns {{name: string, value: number, half: number, fifth: number, base: number, trained: boolean,
 *   onSheet: boolean, cocid: string|null}[]} Empty when there is no actor.
 */
export function skills(actor) {
  if (!actor) return [];
  const rows = new Map(); // normalized name → row; a duplicate on the sheet keeps the higher value
  const covered = new Set(); // table entries the sheet already has

  for (const item of sheetSkills(actor)) {
    const entry = tableEntryFor(item);
    if (entry) covered.add(entry);
    const row = skillEntry({
      name: item.name,
      value: numberOrNull(item.system?.value) ?? 0,
      base: entry ? tableBase(entry, actor) : extraBase(item),
      onSheet: true,
      cocid: itemCocid(item) ?? entry?.cocid
    });
    const key = comparable(item.name);
    if (!rows.has(key) || rows.get(key).value < row.value) rows.set(key, row);
  }

  for (const entry of BASE_SKILLS) {
    if (covered.has(entry) || rows.has(comparable(entry.name))) continue;
    const base = tableBase(entry, actor);
    rows.set(comparable(entry.name), skillEntry({ name: entry.name, value: base, base, onSheet: false, cocid: entry.cocid }));
  }

  const all = [...rows.values()];
  return [
    ...all.filter((row) => row.trained).sort(byValueThenName),
    ...all.filter((row) => !row.trained).sort(byName)
  ];
}

/**
 * What one character can roll, as the rows of the Check menu's and the Opposed view's two tabs, so both list
 * the same checks in the same order with the same values. Characteristics in sheet order; every skill as
 * `skills()` orders them (trained first, then the rest A–Z at base value). Luck is the Other menu's, Sanity has its
 * own menu, and Idea and Know are INT and EDU checks with a label (Void, 2026-11-15).
 * @param {Actor|null} actor null: the characteristic rows without values, and no skills.
 * @returns {{characteristic: object[], skill: object[]}} each row
 *   `{key, name, check, value, half, fifth, trained, onSheet}`: `key` is unique within the menu
 *   ("characteristic:str", "skill:spot hidden"); `check` is what roll-requests' checkRequest and opposedRequest take.
 */
export function checkChoices(actor) {
  const chars = characteristics(actor);
  const valued = (row) => ({ value: row?.value ?? null, half: row?.half ?? null, fifth: row?.fifth ?? null });
  return {
    characteristic: CHARACTERISTICS.map((key) => ({ key: `characteristic:${key}`, name: key.toUpperCase(),
      check: { kind: "characteristic", name: key }, ...valued(chars.find((c) => c.key === key)),
      trained: true, onSheet: true })),
    skill: skills(actor).map((row) => ({ key: skillKey(row.name), name: row.name,
      check: { kind: "skill", name: row.name, cocid: row.cocid ?? null }, value: row.value, half: row.half,
      fifth: row.fifth, trained: row.trained, onSheet: row.onSheet }))
  };
}

/**
 * Every skill A–Z without values, for when several characters are selected. The table's skills,
 * plus (when actors are given) any skill on their sheets that the table doesn't have.
 * @param {Iterable<Actor>} [actors]
 * @returns {{name: string, cocid: string|null}[]}
 */
export function groupSkills(actors = []) {
  const names = new Map(BASE_SKILLS.map((entry) => [comparable(entry.name), { name: entry.name, cocid: entry.cocid }]));
  for (const actor of Array.from(actors ?? [])) {
    for (const item of sheetSkills(actor)) {
      const key = comparable(item.name);
      if (tableEntryFor(item) || names.has(key)) continue;
      names.set(key, { name: item.name, cocid: itemCocid(item) });
    }
  }
  return [...names.values()].sort(byName);
}
