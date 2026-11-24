/** What a character can roll, with base values for skills missing from the sheet. See docs/skill-values.md. */
import { COC7_ID, numberOrNull } from "../utils.js";
import { BASE_SKILLS, GROUP_BASES } from "./base-skills.js";

/** The eight CoC7 characteristic keys, in the order of the investigator sheet. */
export const CHARACTERISTICS = Object.freeze(["str", "con", "siz", "dex", "app", "int", "pow", "edu"]);

const HARD_DIVISOR = 2;
const EXTREME_DIVISOR = 5;

/**
 * Returns a value with its Hard (half) and Extreme (fifth) values, rounded down as CoC7's dice pool does.
 * @param {number|string|null} value
 * @returns {{value: number|null, half: number|null, fifth: number|null}} all null when the value is unknown
 */
export function withLevels(value) {
  const v = numberOrNull(value);
  if (v === null) return { value: null, half: null, fifth: null };
  return { value: v, half: Math.floor(v / HARD_DIVISOR), fifth: Math.floor(v / EXTREME_DIVISOR) };
}

/**
 * Makes a skill name comparable the way CoC7 compares them (no accents, lower case), with single spaces.
 * @param {string} name
 * @returns {string}
 */
export function comparable(name) {
  return String(name ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Tells whether the text is a skill CoC ID (`i.skill.throw`), which CoC7 accepts wherever it takes a skill's name.
 * @param {string} text
 * @returns {boolean}
 */
export const isCocid = (text) => /^i\.skill\./.test(String(text ?? ""));

function characteristicValue(actor, key) {
  return numberOrNull(actor?.system?.characteristics?.[key]?.value);
}

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
 * Returns Rollbox's base-value table entry for a skill, by CoC ID, then by name.
 * @param {string} name
 * @param {string|null} [cocid]
 * @returns {{name: string, cocid: string, base: number|object}|null}
 */
export function tableSkill(name, cocid) {
  return (cocid ? TABLE_BY_COCID.get(cocid) : null) ?? TABLE_BY_NAME.get(comparable(name)) ?? null;
}

/**
 * Returns a table skill's base value for this actor, as skills() gives it, without building every row.
 * @param {Actor|null} actor
 * @param {string} cocid the table skill's CoC ID
 * @returns {number|null} null for a CoC ID the table doesn't have
 */
export function tableBaseFor(actor, cocid) {
  const entry = cocid ? TABLE_BY_COCID.get(cocid) : null;
  return entry ? tableBase(entry, actor) : null;
}

function skillKeys({ name, cocid } = {}) {
  const byCocid = isCocid(name); // a weapon's stored skill can have a CoC ID as its name
  const entry = byCocid ? tableSkill("", name) : tableSkill(name, cocid);
  return [cocid, entry?.cocid, byCocid ? name : comparable(name)].filter(Boolean);
}

/**
 * Tells whether two skill references mean the same skill: the same CoC ID, table entry or name.
 * @param {{name: string, cocid?: string|null}} a
 * @param {{name: string, cocid?: string|null}} b
 * @returns {boolean}
 */
export function sameSkill(a, b) {
  const keys = skillKeys(b);
  return skillKeys(a).some((key) => keys.includes(key));
}

/**
 * Finds a skill's row by CoC ID, then by name: sheetSkill()'s order, so a flyout shows the skill a request sends.
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

/**
 * Returns the flyouts' key for a skill row, unique within a flyout ("skill:spot hidden").
 * @param {string} name
 * @returns {string}
 */
export const skillKey = (name) => `skill:${comparable(name)}`;

/**
 * Returns the rulebook base for a freely named specialisation from its group ("Pilot (Boat)" → 1).
 * @param {string} name
 * @returns {number|null} null without a specialisation, or for a group the rulebook doesn't list
 */
export function groupBase(name) {
  const [group, rest] = comparable(name).split(" (");
  return rest && group in GROUP_BASES ? GROUP_BASES[group] : null;
}

function sheetSkills(actor) {
  try {
    return Array.from(actor?.items ?? []).filter((item) => item?.type === "skill" && item.name);
  } catch {
    return [];
  }
}

const itemCocid = (item) => item?.flags?.[COC7_ID]?.cocidFlag?.id ?? null;

// A sheet's own language is often renamed ("Language (English)") but keeps CoC7's `own` property.
function tableEntryFor(item) {
  const cocid = itemCocid(item);
  if (cocid && TABLE_BY_COCID.has(cocid)) return TABLE_BY_COCID.get(cocid);
  if (item.system?.properties?.own === true) return OWN_LANGUAGE;
  return TABLE_BY_NAME.get(comparable(item.name));
}

/**
 * Finds the skill item on the sheet for a requested skill: by CoC ID, then own-language flag, then by name.
 * @param {Actor} actor
 * @param {string} name
 * @param {string|null} [cocid]
 * @returns {Item|null}
 */
export function sheetSkill(actor, name, cocid) {
  const items = sheetSkills(actor);
  return items.find((item) => cocid && itemCocid(item) === cocid)
    // CoC7 8.15 finds a renamed own language only by its CoC ID, so a request by name mustn't match the flag.
    ?? items.find((item) => cocid === OWN_LANGUAGE_ID && item.system?.properties?.own === true)
    ?? items.find((item) => comparable(item.name) === comparable(name))
    ?? null;
}

// The sheet's own base is the last resort: CoC7's importer stores an NPC's whole value there.
function extraBase(item) {
  return groupBase(item.name) ?? numberOrNull(item.system?.adjustments?.base) ?? 0;
}

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

const byName = (a, b) => a.name.localeCompare(b.name);
const byValueThenName = (a, b) => (b.value - a.value) || byName(a, b);

/**
 * Returns the eight characteristics in sheet order, with Hard and Extreme values.
 * @param {Actor} actor
 * @returns {{key: string, label: string, value: number|null, half: number|null, fifth: number|null}[]} empty
 *   without an actor
 */
export function characteristics(actor) {
  if (!actor) return [];
  return CHARACTERISTICS.map((key) => ({ key, label: key.toUpperCase(), ...withLevels(characteristicValue(actor, key)) }));
}

/**
 * Returns Luck and Sanity (with its max), with Hard and Extreme values.
 * @param {Actor} actor
 * @returns {{key: string, label: string, value: number|null, half: number|null, fifth: number|null,
 *   max?: number|null}[]} empty without an actor
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
 * Returns the actors with the lowest Luck, several when tied; actors without a Luck value are left out.
 * @param {Iterable<Actor>} actors
 * @returns {Actor[]} empty when no actor has a Luck value
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
 * Returns every skill for one character: trained highest first, then untrained A–Z, missing ones at base value.
 * @param {Actor} actor
 * @returns {{name: string, value: number, half: number, fifth: number, base: number, trained: boolean,
 *   onSheet: boolean, cocid: string|null}[]} empty without an actor
 */
export function skills(actor) {
  if (!actor) return [];
  const rows = new Map(); // normalized name → row; a duplicate on the sheet keeps the higher value
  const covered = new Set();

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
 * Returns the rows of the check tabs for one character: characteristics in sheet order, then skills().
 * @param {Actor|null} actor null gives characteristic rows without values and no skills
 * @returns {{characteristic: object[], skill: object[]}} rows `{key, name, check, value, half, fifth, trained,
 *   onSheet}`; `check` is what roll-requests' checkRequest and opposedRequest take
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
 * Returns every table skill A–Z without values, plus any skill on the given sheets the table lacks.
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
