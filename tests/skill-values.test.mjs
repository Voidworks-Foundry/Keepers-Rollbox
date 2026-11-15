import assert from "node:assert/strict";
import { test } from "node:test";
import { BASE_SKILLS, GROUP_BASES } from "../scripts/skill-values/base-skills.js";
import * as SV from "../scripts/skill-values/index.js";
import { makeActor, makeEnv } from "./mocks.mjs";

const STATS = { str: 50, con: 60, siz: 65, dex: 55, app: 45, int: 70, pow: 40, edu: 75 };
const firstUntrained = (list) => list.findIndex((row) => !row.trained);
const byName = (list, name) => list.find((row) => row.name === name);
const tableCount = () => BASE_SKILLS.length;

// --- The table ---------------------------------------------------------------------------------

test("table: names and CoC IDs unique, A–Z, bases are numbers or a characteristic", () => {
  const names = BASE_SKILLS.map((e) => e.name);
  assert.equal(new Set(names).size, names.length);
  assert.equal(new Set(BASE_SKILLS.map((e) => e.cocid)).size, BASE_SKILLS.length);
  assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b)));
  for (const e of BASE_SKILLS) {
    assert.ok(typeof e.base === "number" || ["dex", "edu"].includes(e.base.characteristic), e.name);
    assert.match(e.cocid, /^i\.skill\.[a-z-]+$/);
  }
});

test("table: spot checks against the Keeper Rulebook list (p. 56)", () => {
  const base = (name) => BASE_SKILLS.find((e) => e.name === name).base;
  assert.equal(base("Spot Hidden"), 25);
  assert.equal(base("First Aid"), 30);
  assert.equal(base("Fighting (Brawl)"), 25);
  assert.equal(base("Firearms (Rifle/Shotgun)"), 25);
  assert.equal(base("Science (Mathematics)"), 10);
  assert.equal(base("Credit Rating"), 0);
  assert.equal(base("Cthulhu Mythos"), 0);
  assert.equal(GROUP_BASES.survival, 10);
  assert.equal(GROUP_BASES.language, 1);
});

// --- Characteristics and attributes --------------------------------------------------------------

test("characteristics: eight in sheet order with Hard and Extreme", () => {
  makeEnv();
  const list = SV.characteristics(makeActor({ characteristics: STATS }));
  assert.deepEqual(list.map((c) => c.label), ["STR", "CON", "SIZ", "DEX", "APP", "INT", "POW", "EDU"]);
  assert.deepEqual(list[3], { key: "dex", label: "DEX", value: 55, half: 27, fifth: 11 });
});

test("characteristics: missing values are null; no actor gives an empty list", () => {
  makeEnv();
  const list = SV.characteristics(makeActor({ characteristics: { str: 40 } }));
  assert.equal(list.length, 8);
  assert.equal(list[0].value, 40);
  assert.deepEqual(list[1], { key: "con", label: "CON", value: null, half: null, fifth: null });
  assert.equal(SV.characteristics(makeActor({ system: {} })).every((c) => c.value === null), true);
  assert.deepEqual(SV.characteristics(null), []);
});

test("attributes: Luck, and Sanity with its max (no Idea or Know: those are INT and EDU checks)", () => {
  makeEnv();
  const list = SV.attributes(makeActor({ characteristics: STATS, luck: 55, san: 48, sanMax: 99, idea: 72, know: 77 }));
  assert.deepEqual(list.map((a) => a.label), ["Luck", "Sanity"]);
  assert.deepEqual(list[0], { key: "lck", label: "Luck", value: 55, half: 27, fifth: 11 });
  assert.equal(list[1].value, 48); assert.equal(list[1].max, 99);
});

test("attributes: missing fields are null", () => {
  makeEnv();
  const list = SV.attributes(makeActor({ characteristics: STATS }));
  assert.equal(list[0].value, null);
  assert.equal(list[1].max, null);
  assert.equal(SV.attributes(makeActor({ system: {} })).every((a) => a.value === null), true);
  assert.deepEqual(SV.attributes(undefined), []);
});

// --- Group Luck ------------------------------------------------------------------------------------

test("lowestLuck: the lowest, all of them on a tie, actors without Luck skipped", () => {
  makeEnv();
  const a = makeActor({ name: "A", luck: 60 });
  const b = makeActor({ name: "B", luck: 35 });
  const c = makeActor({ name: "C", luck: 35 });
  const d = makeActor({ name: "D", system: {} });
  assert.deepEqual(SV.lowestLuck([a, b]), [b]);
  assert.deepEqual(SV.lowestLuck([a, b, c, d, null]), [b, c]);
  assert.deepEqual(SV.lowestLuck([d]), []);
  assert.deepEqual(SV.lowestLuck([]), []);
  assert.deepEqual(SV.lowestLuck(undefined), []);
  assert.deepEqual(SV.lowestLuck([b, makeActor({ luck: 0 })]).map((x) => x.system.attribs.lck.value), [0]); // 0 isn't missing
});

// --- Skills ----------------------------------------------------------------------------------------

function investigator() {
  return makeActor({
    name: "Investigator",
    characteristics: STATS,
    skills: [
      { name: "Spot Hidden", value: 60, base: 25, cocid: "i.skill.spot-hidden" },
      { name: "Library Use", value: 70, base: 20, cocid: "i.skill.library-use" },
      { name: "Listen", value: 60, base: 20, cocid: "i.skill.listen" },
      { name: "Climb", value: 20, base: 20, cocid: "i.skill.climb" }, // on sheet, at base: untrained
      { name: "Dodge", value: 27, base: 27, cocid: "i.skill.dodge" }
    ]
  });
}

test("skills: trained first, highest first, ties A–Z; then untrained A–Z, the divider before the first", () => {
  makeEnv();
  const list = SV.skills(investigator());
  assert.deepEqual(list.slice(0, 3).map((r) => r.name), ["Library Use", "Listen", "Spot Hidden"]);
  assert.equal(firstUntrained(list), 3);
  assert.equal(list.slice(3).some((r) => r.trained), false);
  const untrained = list.slice(3).map((r) => r.name);
  assert.deepEqual(untrained, [...untrained].sort((a, b) => a.localeCompare(b)));
  assert.equal(untrained[0], "Accounting");
});

test("skills: a skill on the sheet at its base value is untrained but still on the sheet", () => {
  makeEnv();
  const climb = byName(SV.skills(investigator()), "Climb");
  assert.equal(climb.trained, false);
  assert.equal(climb.onSheet, true);
});

test("skills: missing skills appear once, at their base value, not on the sheet", () => {
  makeEnv();
  const list = SV.skills(investigator());
  const firstAid = byName(list, "First Aid");
  assert.deepEqual(firstAid, {
    name: "First Aid", value: 30, half: 15, fifth: 6, base: 30, trained: false, onSheet: false, cocid: "i.skill.first-aid"
  });
  assert.equal(byName(list, "Fighting (Brawl)").value, 25);
  assert.equal(list.filter((r) => r.name === "Spot Hidden").length, 1);
  assert.equal(list.length, tableCount());
});

test("skills: missing Dodge is half DEX (rounded down), missing Language (Own) is EDU", () => {
  makeEnv();
  const list = SV.skills(makeActor({ characteristics: { ...STATS, dex: 55 } }));
  assert.equal(byName(list, "Dodge").value, 27);
  assert.equal(byName(list, "Dodge").onSheet, false);
  assert.equal(byName(list, "Language (Own)").value, 75);
  assert.equal(byName(list, "Language (Own)").half, 37);
});

test("skills: Dodge on the sheet is trained only above half DEX", () => {
  makeEnv();
  const at = SV.skills(makeActor({ characteristics: STATS, skills: [{ name: "Dodge", value: 27, cocid: "i.skill.dodge" }] }));
  assert.equal(byName(at, "Dodge").trained, false);
  const above = SV.skills(makeActor({ characteristics: STATS, skills: [{ name: "Dodge", value: 40, cocid: "i.skill.dodge" }] }));
  assert.equal(byName(above, "Dodge").trained, true);
  assert.equal(above[0].name, "Dodge");
});

test("skills: an own language renamed on the sheet replaces Language (Own), by CoC ID or by the own flag", () => {
  makeEnv();
  const byId = SV.skills(makeActor({ characteristics: STATS,
    skills: [{ name: "Language (English)", value: 75, cocid: "i.skill.language-own" }] }));
  assert.equal(byName(byId, "Language (Own)"), undefined);
  assert.equal(byName(byId, "Language (English)").trained, false); // at EDU: untrained
  const byFlag = SV.skills(makeActor({ characteristics: STATS,
    skills: [{ name: "Language (French)", value: 80, base: 1, own: true }] }));
  assert.equal(byName(byFlag, "Language (Own)"), undefined);
  assert.equal(byName(byFlag, "Language (French)").base, 75);
  assert.equal(byName(byFlag, "Language (French)").trained, true);
});

test("skills: a sheet skill matches the table by CoC ID even with another name (translated sheet)", () => {
  makeEnv();
  const list = SV.skills(makeActor({ characteristics: STATS,
    skills: [{ name: "Trouver Objet Caché", value: 50, base: 25, cocid: "i.skill.spot-hidden" }] }));
  assert.equal(byName(list, "Spot Hidden"), undefined);
  assert.equal(byName(list, "Trouver Objet Caché").trained, true);
  assert.equal(list.length, tableCount());
});

test("skills: matching by name ignores case, accents and spacing", () => {
  makeEnv();
  const list = SV.skills(makeActor({ characteristics: STATS, skills: [{ name: "spot  hídden", value: 40 }] }));
  assert.equal(byName(list, "Spot Hidden"), undefined);
  const row = byName(list, "spot  hídden");
  assert.equal(row.base, 25);
  assert.equal(row.trained, true);
});

test("skills: extra sheet skills are included at their sheet value", () => {
  makeEnv();
  const list = SV.skills(makeActor({
    characteristics: STATS,
    skills: [
      { name: "Language (Latin)", value: 30, base: 1, cocid: "i.skill.language-latin" },
      { name: "Survival (Arctic)", value: 10, base: 10 },
      { name: "Pilot (Aircraft)", value: 41, base: 41 }, // whole value stored as base: group base still applies
      { name: "Gambling", value: 10, base: 10, cocid: "i.skill.gambling" }, // CoC7-only skill, at its base
      { name: "Sense Ghosts", value: 35, base: 0 } // homebrew
    ]
  }));
  assert.deepEqual(list.slice(0, 3).map((r) => [r.name, r.value]),
    [["Pilot (Aircraft)", 41], ["Sense Ghosts", 35], ["Language (Latin)", 30]]);
  assert.equal(firstUntrained(list), 3);
  assert.equal(byName(list, "Language (Latin)").base, 1);
  assert.equal(byName(list, "Survival (Arctic)").trained, false);
  assert.equal(byName(list, "Gambling").trained, false);
  assert.equal(byName(list, "Gambling").onSheet, true);
  assert.equal(list.length, tableCount() + 5);
});

test("skills: an actor with no skills gets every table skill at base, none trained", () => {
  makeEnv();
  const list = SV.skills(makeActor({ characteristics: STATS }));
  assert.equal(list.length, tableCount());
  assert.equal(firstUntrained(list), 0);
  assert.equal(list.every((r) => !r.onSheet && !r.trained && r.value === r.base), true);
});

test("skills: a hand-made NPC that stores its whole value as base still reads as trained", () => {
  makeEnv();
  // CoC7's actor importer writes the skill's value into system.adjustments.base.
  const npc = makeActor({ type: "npc", characteristics: STATS,
    skills: [{ name: "Spot Hidden", value: 55, base: 55, cocid: "i.skill.spot-hidden" }] });
  const row = byName(SV.skills(npc), "Spot Hidden");
  assert.equal(row.base, 25);
  assert.equal(row.trained, true);
});

test("skills: a duplicate on the sheet shows once, at the higher value", () => {
  makeEnv();
  const list = SV.skills(makeActor({ characteristics: STATS,
    skills: [{ name: "Listen", value: 30 }, { name: "Listen", value: 50 }] }));
  assert.equal(list.filter((r) => r.name === "Listen").length, 1);
  assert.equal(byName(list, "Listen").value, 50);
});

test("skills: no skill is hidden by CoC7's era, Modern skills included", () => {
  for (const worldEra of ["standard", "darkAges", "gasLight", "modern"]) {
    makeEnv({ coc7: { worldEra } });
    const list = SV.skills(makeActor({ characteristics: STATS }));
    assert.equal(list.length, tableCount(), worldEra);
    assert.equal(byName(list, "Computer Use").value, 5);
    assert.equal(byName(list, "Electronics").value, 1);
    assert.equal(byName(list, "Firearms (Machine Gun)").value, 10);
  }
  makeEnv({ coc7: { worldEra: "darkAges" } });
  assert.equal(SV.groupSkills().length, tableCount());
});

test("skills: guards — no actor, no system, no items, odd values, non-skill items", () => {
  makeEnv();
  assert.deepEqual(SV.skills(null), []);
  const bare = SV.skills({ name: "Bare" });
  assert.equal(bare.length, tableCount());
  assert.equal(byName(bare, "Dodge").value, 0);
  assert.equal(byName(bare, "Language (Own)").value, 0);
  const odd = SV.skills(makeActor({
    characteristics: { dex: "60" },
    skills: [{ name: "Listen", value: "45" }, { name: "Swim", value: undefined }],
    otherItems: [{ type: "weapon", name: ".38 Revolver" }, { type: "skill" }, null]
  }));
  assert.equal(byName(odd, "Dodge").value, 30);
  assert.equal(byName(odd, "Listen").value, 45);
  assert.equal(byName(odd, "Swim").value, 0);
  assert.equal(byName(odd, ".38 Revolver"), undefined);
  const throwing = { get items() { throw new Error("broken"); } };
  assert.equal(SV.skills(throwing).length, tableCount());
});

// --- Group list -------------------------------------------------------------------------------------

test("groupSkills: every table skill A–Z with no values", () => {
  makeEnv();
  const list = SV.groupSkills();
  assert.equal(list.length, tableCount());
  assert.deepEqual(Object.keys(list[0]), ["name", "cocid"]);
  const names = list.map((r) => r.name);
  assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b)));
});

test("groupSkills: adds the selected characters' extra sheet skills once", () => {
  makeEnv();
  const a = makeActor({ skills: [{ name: "Language (Latin)", value: 30 }, { name: "Spot Hidden", value: 60 }] });
  const b = makeActor({ skills: [{ name: "Language (Latin)", value: 10 }, { name: "Language (English)", value: 70, own: true }] });
  const list = SV.groupSkills([a, b]);
  assert.equal(list.length, tableCount() + 1);
  assert.equal(list.filter((r) => r.name === "Language (Latin)").length, 1);
  assert.equal(list.find((r) => r.name === "Language (English)"), undefined);
  assert.deepEqual(SV.groupSkills([null, { name: "No items" }]).length, tableCount());
});

// --- Lookups other parts use -------------------------------------------------------------------------

test("withLevels: half and fifth rounded down; all null without a value", () => {
  assert.deepEqual(SV.withLevels(55), { value: 55, half: 27, fifth: 11 });
  assert.deepEqual(SV.withLevels("x"), { value: null, half: null, fifth: null });
});

test("tableBaseFor: a table skill's base for this actor (Dodge from DEX); null for a CoC ID not in the table", () => {
  makeEnv();
  const actor = makeActor({ characteristics: STATS });
  assert.equal(SV.tableBaseFor(actor, "i.skill.dodge"), 27);
  assert.equal(SV.tableBaseFor(actor, "i.skill.spot-hidden"), 25);
  assert.equal(SV.tableBaseFor(actor, "i.skill.basket-weaving"), null);
});

test("sameSkill: one skill by CoC ID, by its table entry, by a CoC ID as its name, or by name", () => {
  assert.equal(SV.sameSkill({ name: "Throw", cocid: null }, { name: "i.skill.throw" }), true);
  assert.equal(SV.sameSkill({ name: "Lancer", cocid: "i.skill.throw" }, { name: "Throw" }), true);
  assert.equal(SV.sameSkill({ name: "THROW " }, { name: "throw" }), true);
  assert.equal(SV.sameSkill({ name: "Fighting (Brawl)" }, { name: "Throw", cocid: "i.skill.throw" }), false);
});

test("findSkillRow: by CoC ID first, then by name, as sheetSkill finds it", () => {
  // A renamed sheet skill holding Throw's CoC ID wins over a row named Throw.
  const rows = [{ name: "Throw", cocid: "i.skill.custom" }, { name: "Lancer", cocid: "i.skill.throw" }];
  assert.equal(SV.findSkillRow(rows, { name: "Throw", cocid: "i.skill.throw" }).name, "Lancer");
  assert.equal(SV.findSkillRow(rows, { name: "i.skill.throw" }).name, "Lancer");
  assert.equal(SV.findSkillRow(rows, { name: "throw" }).name, "Throw");
  assert.equal(SV.findSkillRow(rows, { name: "Climb" }), null);
});
