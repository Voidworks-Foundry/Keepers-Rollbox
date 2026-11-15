import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import * as RR from "../scripts/roll-requests/index.js";
import * as L from "../scripts/roll-requests/links.js";
import { CLICK_DELAY_MS, CLICK_TRIES } from "../scripts/roll-requests/card-buttons.js";
import { makeCoC7, makeEnv, makeRollActor } from "./mocks.mjs";

const STATS = { str: 50, con: 60, siz: 65, dex: 55, app: 45, int: 70, pow: 40, edu: 75 };

// Fake timers: the card clicks' delays run on mock.timers.tick, and the card watch's 15 s timeout never holds the
// file open.
beforeEach(() => mock.timers.enable({ apis: ["setTimeout"] }));
afterEach(() => mock.timers.reset());

/** Keeper's client with CoC7 present. */
function setup(coc7 = {}, env = {}) {
  const e = makeEnv(env);
  const calls = makeCoC7(coc7);
  return { env: e, calls };
}

/** A player character owned by user p1. */
const pc = (options = {}) => makeRollActor({ name: "Alice", type: "character", owners: [game.users[1]],
  characteristics: STATS, luck: 45, san: 60, ...options });
/** An NPC: no player owner. */
const npc = (options = {}) => makeRollActor({ name: "Guard", type: "npc", owners: [], characteristics: STATS,
  luck: 30, san: 40, ...options });

const spot = { name: "Spot Hidden", value: 60, cocid: "i.skill.spot-hidden" };
const listen = { name: "Listen", value: 40, cocid: "i.skill.listen" };

/** A rendered CoC7 card for the watcher: a fake element whose button records a click. */
function renderCard(env, flags, { button = true } = {}) {
  const clicks = [];
  const html = { querySelector: (sel) => (button ? { disabled: false, click: () => clicks.push(sel) } : null) };
  (env.hooks.renderChatMessageHTML ?? []).slice().forEach((f) => f({ flags: { CoC7: { load: flags } }, isAuthor: true }, html));
  return clicks;
}

// --- Link text --------------------------------------------------------------------------------------

test("links: check link with every difficulty, dice, blind and label", () => {
  const link = (difficulty, blind, label) => L.checkLink({ subtype: "skill", name: "Spot Hidden", difficulty, dice: 1, blind, label });
  assert.equal(link("regular", false, ""), "@coc7.check[subtype:skill,name:Spot Hidden,difficulty:1,poolModifier:1,blind:false]");
  assert.equal(link("hard", true, "Look"), "@coc7.check[subtype:skill,name:Spot Hidden,difficulty:2,poolModifier:1,blind]{Look}");
  assert.match(link("extreme", false, ""), /difficulty:3/);
  assert.match(link("hidden", false, ""), /difficulty:-1/);
  assert.match(link("nonsense", false, ""), /difficulty:1/);
});

test("links: no poolModifier without bonus or penalty dice (CoC7 would show \"check(0)\")", () => {
  assert.equal(L.checkLink({ subtype: "skill", name: "Spot Hidden", difficulty: "hard", dice: 0, blind: false }),
    "@coc7.check[subtype:skill,name:Spot Hidden,difficulty:2,blind:false]");
});

test("links: roll strings, combined and Sanity links", () => {
  assert.equal(L.rollString({ type: "skill", key: "Listen", dice: 0, difficulty: "regular" }), "skill#Listen#1");
  assert.equal(L.rollString({ actorUuid: "Actor.a", type: "characteristic", key: "pow", dice: -2, difficulty: "hidden" }),
    "Actor.a#characteristic#pow#-2#0");
  assert.equal(L.rollString({ type: "attribute", key: "lck", dice: 1, difficulty: "hard" }), "attribute#lck#+1#2");
  assert.equal(L.combinedLink({ all: false, rolls: ["skill#A#1", "skill#B#1"], label: "A or B" }),
    "@coc7.check[subtype:combinedany,rolls:skill#A#1&&skill#B#1,blind:false]{A or B}");
  assert.match(L.combinedLink({ all: true, rolls: ["x"] }), /^@coc7\.check\[subtype:combinedall,/);
  assert.equal(L.sanityLink({ success: "1", failure: "1D6", creature: "Ghoul", label: "The ghoul" }),
    "@coc7.sanloss[sanMin:1,sanMax:1D6,sanReason:Ghoul,difficulty:1,poolModifier:0,blind:false]{The ghoul}");
  assert.equal(L.sanityLink({ success: "0", failure: "1" }), "@coc7.sanloss[sanMin:0,sanMax:1,difficulty:1,poolModifier:0,blind:false]");
});

test("links: labels lose characters that break links or HTML, and are escaped", () => {
  assert.equal(L.cleanLabel("Notice <b>the</b> {knife} [[/r 1d6]] & 'run'"), "Notice bthe/b knife /r 1d6 &amp; &#39;run&#39;");
  assert.equal(L.cleanLabel(null), "");
  assert.equal(L.cleanOption("Ghoul, hungry: [old]"), "Ghoul hungry old");
  assert.equal(L.isSafeOption("Firearms (Rifle/Shotgun)"), true);
  assert.equal(L.isSafeOption("Science (Biology, Marine)"), false);
  assert.equal(L.isSafeRollKey("Rock & Roll"), false);
  assert.equal(L.damageRoll("1D6+1D4", "Candle<stick> #1"), "[[/r 1D6+1D4 # Candlestick 1]]");
});

// --- Request descriptions ---------------------------------------------------------------------------

test("checkRequest: defaults, dice limits, no Pushed option", () => {
  setup();
  const r = RR.checkRequest({ checks: [{ kind: "skill", name: "Climb" }], pushed: true });
  assert.deepEqual(r, { type: "check", checks: [{ kind: "skill", name: "Climb", cocid: null, value: null }],
    combined: false, all: true, difficulty: "regular", dice: 0, blind: false, label: "" });
  assert.equal(RR.checkRequest({ checks: [{ kind: "skill", name: "Climb" }], dice: 5 }).dice, 2);
  assert.equal(RR.checkRequest({ checks: [{ kind: "skill", name: "Climb" }], dice: -3 }).dice, -2);
  assert.equal(RR.checkRequest({ checks: [{ kind: "characteristic", name: "STR" }] }).checks[0].name, "str");
  assert.equal(RR.checkRequest({ checks: [{ kind: "skill", name: "Climb" }], difficulty: "hidden" }).difficulty, "hidden");
});

test("checkRequest: combined is never blind; bad checks give null and a warning", () => {
  const { calls } = setup();
  const c = RR.checkRequest({ checks: [{ kind: "skill", ...spot }, { kind: "skill", ...listen }], all: false, blind: true });
  assert.equal(c.combined, true);
  assert.equal(c.all, false);
  assert.equal(c.blind, false);
  assert.equal(RR.checkRequest({ checks: [] }), null);
  assert.equal(RR.checkRequest({ checks: [{ kind: "characteristic", name: "luck" }] }), null);
  assert.equal(RR.checkRequest({ checks: [{ kind: "spell", name: "x" }] }), null);
  assert.equal(calls.warnings.length, 3);
});

test("sanityLoss: numbers and dice are tidied; anything else is refused (the Sanity menu's rule too)", () => {
  assert.equal(RR.sanityLoss(" 1d4 + 1 "), "1D4+1");
  assert.equal(RR.sanityLoss("D6"), "D6");
  assert.equal(RR.sanityLoss("1D6+1D4-1"), "1D6+1D4-1");
  assert.equal(RR.sanityLoss("", "0"), "0");
  assert.equal(RR.sanityLoss(""), null);
  for (const bad of ["1D", "D", "1D6+", "+1", "0D6", "1D0", "1D6*2", "2d6kh1", "1,5", "1D6]", "1".repeat(21)]) {
    assert.equal(RR.sanityLoss(bad), null, bad);
  }
});

test("sanityRequest, weaponRequest, improvisedRequest, opposedRequest: shape and checks", () => {
  setup();
  assert.deepEqual(RR.sanityRequest({ success: " 1 ", failure: "1d6", cause: "The <thing>", creature: "Ghoul, big" }),
    { type: "sanity", success: "1", failure: "1D6", label: "The thing", creature: "Ghoul big" });
  assert.equal(RR.sanityRequest({ failure: "1D6; drop" }), null);
  assert.equal(RR.sanityRequest({ failure: "0D6+" }), null); // the stricter rule the Sanity menu used (session 11)
  assert.equal(RR.sanityRequest({}).failure, "0");
  assert.equal(RR.weaponRequest({}), null);
  assert.equal(RR.weaponRequest({ weaponId: "w1", blind: true }).blind, true);
  assert.equal(RR.improvisedRequest({ skill: "Throw" }), null);
  const imp = RR.improvisedRequest({ what: "Candlestick", skill: { name: "Fighting (Brawl)", kind: "characteristic" }, damage: "1D6+DB" });
  assert.equal(imp.skill.kind, "skill");
  const a = pc(); const b = npc();
  assert.equal(RR.opposedRequest({ sides: [{ actor: a, check: { kind: "skill", name: "Stealth" } }] }), null);
  assert.equal(RR.opposedRequest({ sides: [{ actor: a, check: { kind: "skill", name: "Stealth" } },
    { actor: a, check: { kind: "skill", name: "Spot Hidden" } }] }), null);
  const o = RR.opposedRequest({ sides: [{ actor: a, check: { kind: "skill", name: "Stealth" }, dice: 9 },
    { actor: b, check: { kind: "characteristic", name: "pow" } }] });
  assert.equal(o.sides[0].dice, 2);
});

// --- Sending to players -----------------------------------------------------------------------------

test("whisper: a skill on the sheet goes to the player owners, by the sheet's CoC ID", async () => {
  const { env } = setup();
  const alice = pc({ skills: [spot] });
  const result = await RR.send(RR.checkRequest({ checks: [{ kind: "skill", name: "Spot Hidden" }], difficulty: "hard", dice: 1 }), [alice]);
  assert.equal(env.chat.length, 1);
  assert.deepEqual(env.chat[0].whisper, ["p1"]);
  assert.equal(env.chat[0].content, "Your keeper has requested Alice make a "
    + "@coc7.check[subtype:skill,name:i.skill.spot-hidden,difficulty:2,poolModifier:1,blind:false] roll.");
  assert.deepEqual(result.requested, [alice]);
  assert.deepEqual(alice.calls, []);
});

test("whisper: a sheet skill without a CoC ID goes by its sheet name; a renamed own language by CoC ID", async () => {
  const { env } = setup();
  const alice = pc({ skills: [{ name: "Spot  hidden", value: 50 }, { name: "Language (English)", value: 75, cocid: "i.skill.language-own", own: true }] });
  await RR.send(RR.checkRequest({ checks: [{ kind: "skill", name: "Spot Hidden" }] }), [alice]);
  await RR.send(RR.checkRequest({ checks: [{ kind: "skill", name: "Language (Own)", cocid: "i.skill.language-own" }] }), [alice]);
  assert.match(env.chat[0].content, /name:Spot {2}hidden,/);
  assert.match(env.chat[1].content, /name:i\.skill\.language-own,/);
});

test("chat: posted publicly, one message per character, never whispered", async () => {
  const { env } = setup();
  const alice = pc(); const bob = pc({ name: "Bob", owners: [game.users[2]] });
  await RR.send(RR.checkRequest({ checks: [{ kind: "characteristic", name: "dex" }], blind: true }), [alice, bob], { mode: "chat" });
  assert.equal(env.chat.length, 2);
  assert.ok(env.chat.every((m) => !("whisper" in m)));
  assert.match(env.chat[0].content, /subtype:characteristic,name:dex,difficulty:1,blind\]/);
  assert.match(env.chat[1].content, /requested Bob make/);
});

test("link: copies the request to the clipboard; nothing sent, nothing rolled", async () => {
  const { env, calls } = setup();
  const guard = npc();
  const result = await RR.send(RR.checkRequest({ checks: [{ kind: "attribute", name: "lck" }] }), [guard], { mode: "link" });
  assert.equal(result.copied, "@coc7.check[subtype:attribute,name:lck,difficulty:1,blind:false]");
  assert.deepEqual(calls.copied, [result.copied]);
  assert.equal(env.chat.length, 0);
  assert.deepEqual(guard.calls, []);
});

test("link with nobody selected: the generic link, skills by Rollbox's CoC ID", async () => {
  const { calls } = setup();
  await RR.send(RR.checkRequest({ checks: [{ kind: "skill", name: "Climb" }] }), [], { mode: "link" });
  assert.match(calls.copied[0], /name:i\.skill\.climb,/);
});

test("several characters: each player character gets a request, the NPC is rolled; duplicates once", async () => {
  const { env } = setup();
  const alice = pc(); const bob = pc({ name: "Bob", owners: [game.users[2]] }); const guard = npc();
  const result = await RR.send(RR.checkRequest({ checks: [{ kind: "characteristic", name: "pow" }] }), [alice, guard, bob, alice, null]);
  assert.equal(env.chat.length, 2);
  assert.deepEqual(env.chat.map((m) => m.whisper), [["p1"], ["p2"]]);
  assert.deepEqual(result.requested, [alice, bob]);
  assert.deepEqual(result.rolled, [guard]);
  assert.equal(guard.calls.length, 1);
});

test("label: the check's name, then the Keeper's text; HTML in labels and names escaped", async () => {
  const { env } = setup();
  const eve = pc({ name: "Eve <i>the</i> Bold" });
  await RR.send(RR.checkRequest({ checks: [{ kind: "skill", name: "Climb" }], label: "notice <script>the</script> knife" }), [eve]);
  assert.match(env.chat[0].content, /requested Eve &lt;i&gt;the&lt;\/i&gt; Bold make/);
  assert.match(env.chat[0].content, /\]\{Climb · notice scriptthe\/script knife\} roll\.$/);
  await RR.send(RR.checkRequest({ checks: [{ kind: "skill", name: "Spot Hidden" }, { kind: "skill", name: "Listen" }],
    difficulty: "hard", label: "notice the knife" }), [eve]);
  assert.match(env.chat[1].content, /\]\{Hard Spot Hidden \+ Listen · notice the knife\} roll\.$/);
});

test("Idea and Know for a player: an INT or EDU check labelled Idea or Know", async () => {
  const { env } = setup();
  await RR.send(RR.checkRequest({ checks: [{ kind: "attribute", name: "idea" }] }), [pc()]);
  await RR.send(RR.checkRequest({ checks: [{ kind: "attribute", name: "know" }], label: "Recall the cult" }), [pc()]);
  assert.match(env.chat[0].content, /subtype:characteristic,name:int,.*\]\{Idea\} roll/);
  assert.match(env.chat[1].content, /subtype:characteristic,name:edu,.*\]\{Know · Recall the cult\} roll/);
});

test("combined for a player: one combined link, all or any, no actor in the roll strings", async () => {
  const { env } = setup();
  const alice = pc({ skills: [spot, listen] });
  await RR.send(RR.checkRequest({ checks: [{ kind: "skill", name: "Spot Hidden" }, { kind: "skill", name: "Listen" }],
    all: false, difficulty: "hidden", dice: -1 }), [alice]);
  assert.match(env.chat[0].content, new RegExp("@coc7\\.check\\[subtype:combinedany,rolls:"
    + "skill#i\\.skill\\.spot-hidden#-1#0&&skill#i\\.skill\\.listen#-1#0,blind:false\\]\\{Spot Hidden or Listen\\}"));
});

// --- Missing skills ---------------------------------------------------------------------------------

test("missing skill, player: requested by CoC ID after checking CoC7 can find it", async () => {
  const { env, calls } = setup();
  await RR.send(RR.checkRequest({ checks: [{ kind: "skill", name: "Climb" }] }), [pc()]);
  assert.deepEqual(calls.cocid, ["i.skill.climb"]);
  assert.match(env.chat[0].content, /name:i\.skill\.climb,/);
});

test("missing skill, player: CoC7 can't find it, so nothing is sent and the Keeper is told", async () => {
  const { env, calls } = setup({ cocidMatches: () => 0 });
  const result = await RR.send(RR.checkRequest({ checks: [{ kind: "skill", name: "Listen" }] }), [pc()]);
  assert.equal(env.chat.length, 0);
  assert.equal(calls.notices.length, 1);
  assert.equal(result.skipped.length, 1);
});

test("typed skill, player: found by name in world items or a compendium, or refused", async () => {
  let { env, calls } = setup({ worldItems: [{ type: "skill", name: "Pilot (Boat)", system: { skillName: "Boat" }, flags: {} }] });
  await RR.send(RR.checkRequest({ checks: [{ kind: "skill", name: "Pilot (Boat)", value: 1 }] }), [pc()]);
  assert.match(env.chat[0].content, /name:Pilot \(Boat\),/);

  ({ env, calls } = setup({ packIndex: [{ type: "skill", name: "Pilot (Boat)", system: { skillName: "Boat" } }] }));
  await RR.send(RR.checkRequest({ checks: [{ kind: "skill", name: "Pilot (Boat)" }] }), [pc()]);
  assert.equal(env.chat.length, 1);

  // Tagged for another era only: CoC7 skips it, so Rollbox does too.
  ({ env, calls } = setup({ packIndex: [{ type: "skill", name: "Pilot (Boat)", system: { skillName: "Boat" },
    flags: { CoC7: { cocidFlag: { eras: { pulp: true } } } } }] }));
  await RR.send(RR.checkRequest({ checks: [{ kind: "skill", name: "Pilot (Boat)" }] }), [pc()]);
  assert.equal(env.chat.length, 0);
  assert.equal(calls.notices.length, 1);
});

test("missing skill, player: CoC7's lookup gone means the request is sent anyway", async () => {
  const { env } = setup({ cocidMatches: null });
  await RR.send(RR.checkRequest({ checks: [{ kind: "skill", name: "Climb" }] }), [pc()]);
  assert.equal(env.chat.length, 1);
});

test("a name that can't go in a link: the player is skipped with a notice; an NPC still rolls by uuid", async () => {
  const { env, calls } = setup();
  const odd = { name: "Science (Biology, Marine)", value: 30 };
  const result = await RR.send(RR.checkRequest({ checks: [{ kind: "skill", name: odd.name }] }), [pc({ skills: [odd] })]);
  assert.equal(env.chat.length, 0);
  assert.equal(result.skipped[0].reason, "name can't go in a link");
  assert.equal(calls.notices.length, 1);
  const guard = npc({ skills: [odd] });
  await RR.send(RR.checkRequest({ checks: [{ kind: "skill", name: odd.name }] }), [guard]);
  assert.deepEqual(guard.calls[0].slice(0, 3), ["skillCheck", "Actor.Guard.Item.item0", true]);
});

// --- NPCs: rolled for the Keeper --------------------------------------------------------------------

test("NPC characteristic, attribute and sheet skill: CoC7's checks, no dialog, blind to the Keeper", async () => {
  const { env } = setup();
  const guard = npc({ skills: [spot] });
  await RR.send(RR.checkRequest({ checks: [{ kind: "characteristic", name: "str" }], difficulty: "hard", dice: 1 }), [guard]);
  await RR.send(RR.checkRequest({ checks: [{ kind: "attribute", name: "lck" }], difficulty: "hidden" }), [guard]);
  await RR.send(RR.checkRequest({ checks: [{ kind: "skill", name: "Spot Hidden" }], dice: -2 }), [guard]);
  assert.deepEqual(guard.calls, [
    ["characteristicCheck", "str", true, { difficulty: 2, poolModifier: 1, blind: true }],
    ["attributeCheck", "lck", true, { difficulty: -1, poolModifier: 0, blind: true }],
    ["skillCheck", "Actor.Guard.Item.item0", true, { difficulty: 1, poolModifier: -2, blind: true }]
  ]);
  assert.equal(env.chat.length, 0);
});

test("NPC missing skill: a raw roll at the base value, nothing added, a note to the Keeper", async () => {
  const { env } = setup();
  const guard = npc();
  await RR.send(RR.checkRequest({ checks: [{ kind: "skill", name: "Climb" }] }), [guard]);
  await RR.send(RR.checkRequest({ checks: [{ kind: "skill", name: "Dodge" }], difficulty: "extreme" }), [guard]);
  assert.deepEqual(guard.calls, [
    ["runRoll", { rollType: "R/MA", threshold: 20, difficulty: 1, poolModifier: 0, isBlind: true, fastForward: true }],
    ["runRoll", { rollType: "R/MA", threshold: 27, difficulty: 3, poolModifier: 0, isBlind: true, fastForward: true }]
  ]);
  assert.equal(env.chat.length, 2);
  assert.deepEqual(env.chat[0].whisper, ["gm1"]);
  assert.ok(env.chat[0].content.includes("Climb") && env.chat[0].content.includes("20%"));
});

test("NPC typed skill: the Keeper's value, else the group base; no value at all is skipped", async () => {
  const { calls } = setup();
  const guard = npc();
  await RR.send(RR.checkRequest({ checks: [{ kind: "skill", name: "Pilot (Boat)", value: 40 }] }), [guard]);
  await RR.send(RR.checkRequest({ checks: [{ kind: "skill", name: "Survival (Arctic)" }] }), [guard]);
  const result = await RR.send(RR.checkRequest({ checks: [{ kind: "skill", name: "Basket Weaving" }] }), [guard]);
  assert.deepEqual(guard.calls.map((c) => c[1].threshold), [40, 10]);
  assert.equal(result.skipped[0].reason, "no value to roll at");
  assert.equal(calls.notices.length, 1);
});

test("NPC Idea and Know: CoC7's own Idea and Know rolls, dice in their own option", async () => {
  setup();
  const guard = npc();
  await RR.send(RR.checkRequest({ checks: [{ kind: "attribute", name: "idea" }], dice: 1 }), [guard]);
  await RR.send(RR.checkRequest({ checks: [{ kind: "attribute", name: "know" }], difficulty: "hard" }), [guard]);
  assert.deepEqual(guard.calls, [
    ["runRoll", { characteristic: "idea", difficulty: 1, poolModifierIdea: 1, isBlind: true, fastForward: true }],
    ["runRoll", { characteristic: "know", difficulty: 2, poolModifierKnow: 0, isBlind: true, fastForward: true }]
  ]);
});

test("NPC combined: one private roll at the highest (any) or lowest (all) value, named in a note", async () => {
  const { env } = setup();
  const guard = npc({ skills: [spot] });
  const both = [{ kind: "skill", name: "Spot Hidden" }, { kind: "skill", name: "Listen" }];
  await RR.send(RR.checkRequest({ checks: both, all: false }), [guard]);
  await RR.send(RR.checkRequest({ checks: [...both, { kind: "characteristic", name: "pow" }], all: true, dice: 1 }), [guard]);
  assert.deepEqual(guard.calls.map((c) => [c[1].rollType, c[1].threshold, c[1].poolModifier]), [["R/MA", 60, 0], ["R/MA", 20, 1]]);
  assert.deepEqual(env.chat.map((m) => m.whisper), [["gm1"], ["gm1"]]);
});

// --- Weapons ----------------------------------------------------------------------------------------

test("weapon: the weapon's skill, labelled with the weapon; alternative skill when CoC7 says so", async () => {
  const { env } = setup();
  const handgun = { name: "Firearms (Handgun)", value: 45, cocid: "i.skill.firearms-handgun" };
  const alice = pc({ skills: [handgun], weapons: [
    { id: "w1", name: ".38 Revolver", main: "Firearms (Handgun)" },
    { id: "w2", name: "Knife", main: "Fighting (Brawl)", alt: "Throw", usesAlternativeSkill: true }] });
  await RR.send(RR.weaponRequest({ weaponId: "w1", difficulty: "hard", blind: true }), [alice]);
  await RR.send(RR.weaponRequest({ weaponId: "w2" }), [alice]);
  assert.match(env.chat[0].content, /name:i\.skill\.firearms-handgun,difficulty:2,blind\]\{Firearms \(Handgun\) with the \.38 Revolver\}/);
  assert.match(env.chat[1].content, /name:i\.skill\.throw,.*\{Throw with the Knife\}/);
  assert.ok(env.chat.every((m) => !m.content.includes("@coc7.item")));
});

test("weapon: skill main or alternative picks that skill; weaponSkills lists both only when they differ", async () => {
  const { env } = setup();
  const alice = pc({ weapons: [
    { id: "w1", name: "Knife", main: "Fighting (Brawl)", alt: "Throw", usesAlternativeSkill: true },
    { id: "w2", name: "Rock", main: "Throw", alt: "i.skill.throw", usesAlternativeSkill: true }] });
  await RR.send(RR.weaponRequest({ weaponId: "w1", skill: "main" }), [alice]);
  await RR.send(RR.weaponRequest({ weaponId: "w1", skill: "alternative" }), [alice]);
  assert.match(env.chat[0].content, /\{Fighting \(Brawl\) with the Knife\}/);
  assert.match(env.chat[1].content, /\{Throw with the Knife\}/);
  const [knife, rock] = alice.items.filter((item) => item.type === "weapon");
  assert.deepEqual(RR.weaponSkills(alice, knife).map((c) => [c.which, c.skill.name]),
    [["main", "Fighting (Brawl)"], ["alternative", "Throw"]]);
  assert.equal(RR.weaponSkills(alice, rock).length, 1);
});

test("weapon: automatic, burst or thrown with no alternative skill set falls back to its main skill", async () => {
  const { env } = setup();
  const alice = pc({ weapons: [{ id: "w1", name: "Tommy Gun", main: "Firearms (Rifle/Shotgun)", usesAlternativeSkill: true }] });
  await RR.send(RR.weaponRequest({ weaponId: "w1" }), [alice]);
  assert.match(env.chat[0].content, /\{Firearms \(Rifle\/Shotgun\) with the Tommy Gun\}/);
});

test("weapon: a skill stored as a CoC ID is labelled with the skill's name", async () => {
  const { env } = setup();
  const alice = pc({ weapons: [{ id: "w1", name: "Knife", main: "i.skill.throw" },
    { id: "w2", name: "Odd", main: "i.skill.made-up-skill" }] });
  await RR.send(RR.weaponRequest({ weaponId: "w1" }), [alice]);
  await RR.send(RR.weaponRequest({ weaponId: "w2" }), [alice]);
  assert.match(env.chat[0].content, /name:i\.skill\.throw,.*\{Throw with the Knife\}/);
  assert.match(env.chat[1].content, /\{Made Up Skill with the Odd\}/);
});

test("NPC with a label: the Keeper's note is the label CoC7's card leaves out, with the difficulty, said once, just before the card", async () => {
  const { env } = setup();
  const guard = npc({ skills: [spot] });
  const order = [];
  const create = ChatMessage.create;
  ChatMessage.create = (data) => { order.push("note"); return create(data); };
  guard.skillCheck = guard.runRoll = async () => { order.push("card"); };
  await RR.send(RR.checkRequest({ checks: [{ kind: "skill", name: "Spot Hidden" }], difficulty: "hard",
    label: "notice the knife" }), [guard]);
  await RR.send(RR.improvisedRequest({ what: "Candlestick", skill: "Fighting (Brawl)", difficulty: "hard" }), [guard]);
  assert.deepEqual(env.chat.map((m) => m.whisper), [["gm1"], ["gm1"]]);
  assert.equal(env.chat[0].content, "<p><strong>Guard</strong>: Hard Spot Hidden · notice the knife</p>");
  assert.match(env.chat[1].content, /^<p><strong>Guard<\/strong>: Hard Fighting \(Brawl\) with Candlestick<\/p>/);

  assert.deepEqual(order, ["note", "card", "note", "card"]);
});

test("weapon: missing from the sheet, or without a skill, is skipped with a notice", async () => {
  const { env, calls } = setup();
  const alice = pc({ weapons: [{ id: "w3", name: "Club", main: "" }] });
  const r1 = await RR.send(RR.weaponRequest({ weaponId: "nope" }), [alice]);
  const r2 = await RR.send(RR.weaponRequest({ weaponId: "w3" }), [alice]);
  assert.equal(env.chat.length, 0);
  assert.equal(r1.skipped.length + r2.skipped.length, 2);
  assert.equal(calls.notices.length, 2);
});

test("improvised: a labelled skill check plus a damage roll with the damage bonus filled in", async () => {
  const { env } = setup();
  await RR.send(RR.improvisedRequest({ what: "Candlestick", skill: "Fighting (Brawl)", damage: "1D6 + DB" }), [pc({ db: "1D4" })]);
  await RR.send(RR.improvisedRequest({ what: "Rock", skill: "Throw", damage: "1D4+½DB" }), [pc({ db: "1D4" })]);
  await RR.send(RR.improvisedRequest({ what: "Chair", skill: "Fighting (Brawl)", damage: "1D8+DB" }), [pc({ db: -1 })]);
  await RR.send(RR.improvisedRequest({ what: "Pebble", skill: "Throw", damage: "1D2+1/2DB" }), [pc({ db: -2 })]);
  assert.match(env.chat[0].content, /\{Fighting \(Brawl\) with Candlestick\} roll\.<br>Damage: \[\[\/r 1D6\+1D4 # Candlestick damage\]\]$/);
  assert.match(env.chat[1].content, /\[\[\/r 1D4\+1D2 # Rock damage\]\]$/);
  assert.match(env.chat[2].content, /\[\[\/r 1D8-1 # Chair damage\]\]$/);
  assert.match(env.chat[3].content, /\[\[\/r 1D2-1 # Pebble damage\]\]$/);
});

test("improvised: damage that isn't dice is left out with a notice; NPC damage goes to the Keeper", async () => {
  const { env, calls } = setup();
  await RR.send(RR.improvisedRequest({ what: "Lamp", skill: "Throw", damage: "1D6]] @UUID[x]" }), [pc()]);
  assert.doesNotMatch(env.chat[0].content, /Damage/);
  assert.equal(calls.notices.length, 1);
  const guard = npc({ db: 0 });
  await RR.send(RR.improvisedRequest({ what: "Bottle", skill: "Fighting (Brawl)", damage: "1D3+DB" }), [guard]);
  assert.deepEqual(env.chat[1].whisper, ["gm1"]);
  assert.match(env.chat[1].content, /damage \[\[\/r 1D3 # Bottle damage\]\]/);
  assert.equal(guard.calls[0][1].threshold, 25);
});

test("improvised: a zero damage bonus and a typed +0 are left out of the damage", async () => {
  const { env } = setup();
  await RR.send(RR.improvisedRequest({ what: "Vase", skill: "Fighting (Brawl)", damage: "1D6+DB" }), [pc({ db: 0 })]);
  await RR.send(RR.improvisedRequest({ what: "Cup", skill: "Throw", damage: "1D4+½DB" }), [pc({ db: 1 })]);
  await RR.send(RR.improvisedRequest({ what: "Book", skill: "Throw", damage: "1D3+0" }), [pc()]);
  assert.match(env.chat[0].content, /\[\[\/r 1D6 # Vase damage\]\]$/);
  assert.match(env.chat[1].content, /\[\[\/r 1D4 # Cup damage\]\]$/);
  assert.match(env.chat[2].content, /\[\[\/r 1D3 # Book damage\]\]$/);
});

// --- Sanity -----------------------------------------------------------------------------------------

test("Sanity, player: CoC7's Sanity link; the cause is the label, the creature its record", async () => {
  const { env } = setup();
  await RR.send(RR.sanityRequest({ success: "1", failure: "1D6", cause: "The thing in the cellar", creature: "Ghoul" }), [pc()]);
  assert.deepEqual(env.chat[0].whisper, ["p1"]);
  assert.match(env.chat[0].content,
    /@coc7\.sanloss\[sanMin:1,sanMax:1D6,sanReason:Ghoul,difficulty:1,poolModifier:0,blind:false\]\{The thing in the cellar\}/);
});

test("Sanity, NPC: CoC7's Sanity card on the Keeper's side, and Rollbox clicks its roll", async () => {
  const { env, calls } = setup();
  const guard = npc();
  const result = await RR.send(RR.sanityRequest({ success: "0", failure: "1D3", creature: "Ghoul" }), [guard]);
  assert.deepEqual(calls.linkActorClick[0].options,
    { check: "sanloss", sanMin: "0", sanMax: "1D3", sanReason: "Ghoul", difficulty: 1, poolModifier: 0 });
  assert.deepEqual(result.rolled, [guard]);
  const clicks = renderCard(env, { as: "CoC7SanCheckCard", actorUuid: guard.uuid });
  mock.timers.tick(CLICK_DELAY_MS);
  assert.deepEqual(clicks, ['[data-action="rollSanCheck"]']);
  assert.equal(env.chat.length, 0);
});

test("Sanity: characters without a Sanity value are skipped", async () => {
  const { env } = setup();
  const thing = pc({ system: { characteristics: {}, attribs: { san: {} } } });
  const result = await RR.send(RR.sanityRequest({ failure: "1" }), [thing]);
  assert.equal(env.chat.length, 0);
  assert.equal(result.skipped[0].reason, "no Sanity value");
});

test("Sanity: Copy link copies the Sanity link", async () => {
  const { calls } = setup();
  await RR.send(RR.sanityRequest({ success: "0", failure: "1D4" }), [], { mode: "link" });
  assert.equal(calls.copied[0], "@coc7.sanloss[sanMin:0,sanMax:1D4,difficulty:1,poolModifier:0,blind:false]");
});

// --- Opposed ----------------------------------------------------------------------------------------

test("opposed: one CoC7 card with both sides, regular difficulty, dice; Start rolls clicked", async () => {
  const { env, calls } = setup();
  const alice = pc({ skills: [{ name: "Stealth", value: 50, cocid: "i.skill.stealth" }] });
  const guard = npc({ skills: [spot] });
  const request = RR.opposedRequest({ sides: [
    { actor: alice, check: { kind: "skill", name: "Stealth" }, dice: 1 },
    { actor: guard, check: { kind: "skill", name: "Spot Hidden" } }] });
  const result = await RR.send(request, [], { mode: "whisper" });
  assert.equal(calls.linkActorClick.length, 1);
  assert.equal(calls.linkActorClick[0].actor, alice);
  assert.deepEqual(calls.linkActorClick[0].options, { check: "check", subtype: "opposed", combat: false,
    rolls: "Actor.Alice#skill#i.skill.stealth#+1#1&&Actor.Guard#skill#i.skill.spot-hidden#1" });
  assert.deepEqual(result.requested, [alice, guard]);
  // Another card first: not ours.
  const other = renderCard(env, { as: "CoC7ChatOpposedMessage", actorUuids: ["Actor/Someone", "Actor/Guard"] });
  const clicks = renderCard(env, { as: "CoC7ChatOpposedMessage", actorUuids: ["Actor/Alice", "Actor/Guard"] });
  mock.timers.tick(CLICK_DELAY_MS);
  assert.deepEqual(other, []);
  assert.deepEqual(clicks, ['[data-action="rollNoPlayers"]']);
  assert.deepEqual(env.hooks.renderChatMessageHTML, []);
});

test("opposed: Idea becomes an INT side; the Keeper is told when Start rolls can't be clicked", async () => {
  const { env, calls } = setup();
  const alice = pc(); const guard = npc();
  await RR.send(RR.opposedRequest({ sides: [
    { actor: alice, check: { kind: "attribute", name: "idea" } },
    { actor: guard, check: { kind: "characteristic", name: "pow" }, dice: -1 }] }));
  assert.equal(calls.linkActorClick[0].options.rolls, "Actor.Alice#characteristic#int#1&&Actor.Guard#characteristic#pow#-1#1");
  renderCard(env, { as: "CoC7ChatOpposedMessage", actorUuids: ["Actor.Alice", "Actor.Guard"] }, { button: false });
  for (let i = 0; i < CLICK_TRIES; i++) mock.timers.tick(CLICK_DELAY_MS); // each try schedules the next
  assert.deepEqual(calls.notices, ["Rollbox: click Start rolls on the opposed card."]);
});

test("opposed: a missing skill CoC7 can find is left to CoC7; one it can't stops the card", async () => {
  let { env, calls } = setup();
  const alice = pc(); const guard = npc();
  await RR.send(RR.opposedRequest({ sides: [{ actor: alice, check: { kind: "skill", name: "Stealth" } },
    { actor: guard, check: { kind: "skill", name: "Listen" } }] }));
  assert.equal(calls.linkActorClick.length, 1);
  assert.match(calls.linkActorClick[0].options.rolls, /Actor\.Guard#skill#i\.skill\.listen#1$/);
  renderCard(env, { as: "CoC7ChatOpposedMessage", actorUuids: ["Actor.Alice", "Actor.Guard"] });

  ({ env, calls } = setup());
  const result = await RR.send(RR.opposedRequest({ sides: [{ actor: pc(), check: { kind: "skill", name: "Stealth" } },
    { actor: npc(), check: { kind: "skill", name: "Pilot (Boat)", value: 1 } }] }));
  assert.equal(calls.linkActorClick.length, 0);
  assert.equal(calls.notices.length, 1);
  assert.equal(env.hooks.renderChatMessageHTML, undefined);
  assert.deepEqual(result.skipped.map((s) => [s.actor.name, s.reason]), [["Guard", "CoC7 can't find Pilot (Boat)"]]);
});

test("opposed: Copy link is refused", async () => {
  const { calls } = setup();
  const request = RR.opposedRequest({ sides: [{ actor: pc(), check: { kind: "characteristic", name: "str" } },
    { actor: npc(), check: { kind: "characteristic", name: "str" } }] });
  await RR.send(request, [], { mode: "link" });
  assert.equal(calls.linkActorClick.length, 0);
  assert.deepEqual(calls.copied, []);
  assert.equal(calls.notices.length, 1);
});

test("CoC7 fails to make the card: the watch for its button stops, and the Keeper isn't told to click it", async () => {
  const { env, calls } = setup();
  CONFIG.CoC7Link.documentClass._onLinkActorClick = async () => { throw new Error("boom"); };
  const result = await RR.send(RR.opposedRequest({ sides: [{ actor: pc(), check: { kind: "characteristic", name: "str" } },
    { actor: npc(), check: { kind: "characteristic", name: "str" } }] }));
  assert.deepEqual(result.skipped.map((s) => s.reason), ["CoC7 couldn't make the opposed card"]);
  assert.deepEqual(env.hooks.renderChatMessageHTML, []);
  assert.deepEqual(calls.notices, []);
});

// --- Guards: CoC7 missing, players, bad input --------------------------------------------------------

test("CoC7's links missing, or not the CoC7 system: does nothing, one warning", async () => {
  const { env, calls } = setup({ links: false });
  const guard = npc();
  const result = await RR.send(RR.checkRequest({ checks: [{ kind: "characteristic", name: "str" }] }), [pc(), guard]);
  assert.equal(result.unavailable, true);
  assert.equal(env.chat.length, 0);
  assert.deepEqual(guard.calls, []);
  assert.equal(calls.warnings.length, 1);
  assert.match(calls.warnings[0], /^keepers-rollbox \| /);
  game.system = { id: "dnd5e" };
  CONFIG.CoC7Link = { documentClass: class {} };
  await RR.send(RR.sanityRequest({ failure: "1" }), [pc()]);
  assert.equal(env.chat.length, 0);
  assert.equal(calls.warnings.length, 2);
});


test("CoC7's internal link handler missing: no opposed card, no NPC Sanity card, one warning each", async () => {
  const { env, calls } = setup({ linkActorClick: false });
  await RR.send(RR.opposedRequest({ sides: [{ actor: pc(), check: { kind: "characteristic", name: "str" } },
    { actor: npc(), check: { kind: "characteristic", name: "str" } }] }));
  assert.equal(calls.warnings.length, 1);
  const result = await RR.send(RR.sanityRequest({ failure: "1" }), [npc()]);
  assert.equal(calls.warnings.length, 2);
  assert.equal(result.skipped.length, 1);
  assert.equal(env.hooks.renderChatMessageHTML, undefined);
});

test("CoC7's actor method or owners missing: that character is skipped, one warning", async () => {
  const { env, calls } = setup();
  const guard = npc({ methods: false });
  const result = await RR.send(RR.checkRequest({ checks: [{ kind: "characteristic", name: "str" }] }), [guard]);
  assert.equal(result.skipped.length, 1);
  assert.equal(calls.warnings.length, 1);
  const odd = pc(); delete odd.owners;
  const r2 = await RR.send(RR.checkRequest({ checks: [{ kind: "characteristic", name: "str" }] }), [odd]);
  assert.equal(r2.skipped[0].reason, "player owners unknown");
  assert.equal(calls.warnings.length, 2);
  assert.equal(env.chat.length, 0);
});

test("a CoC7 method that throws: skipped with a warning, never thrown to the menu", async () => {
  const { calls } = setup();
  const guard = npc();
  guard.characteristicCheck = async () => { throw new Error("boom"); };
  const result = await RR.send(RR.checkRequest({ checks: [{ kind: "characteristic", name: "str" }] }), [guard]);
  assert.equal(result.skipped.length, 1);
  assert.equal(calls.warnings.length, 1);
});

test("player's client: send does nothing", async () => {
  const env = makeEnv({ isGM: false });
  const calls = makeCoC7();
  const result = await RR.send(RR.checkRequest({ checks: [{ kind: "characteristic", name: "str" }] }), [pc()]);
  assert.deepEqual(result.requested, []);
  assert.equal(env.chat.length, 0);
  assert.equal(calls.warnings.length, 0);
});

test("never whispered to nobody: owners without ids are skipped, not posted publicly", async () => {
  const { env } = setup();
  const ghost = pc({ owners: [{ isGM: false }] });
  const result = await RR.send(RR.checkRequest({ checks: [{ kind: "characteristic", name: "str" }] }), [ghost]);
  assert.equal(env.chat.length, 0);
  assert.equal(result.skipped[0].reason, "no player to whisper to");
});

test("unknown mode or no request: nothing sent", async () => {
  const { env, calls } = setup();
  await RR.send(RR.checkRequest({ checks: [{ kind: "characteristic", name: "str" }] }), [pc()], { mode: "shout" });
  await RR.send(null, [pc()]);
  assert.equal(env.chat.length, 0);
  assert.equal(calls.warnings.length, 1);
});
