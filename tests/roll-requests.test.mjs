import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import * as RR from "../scripts/roll-requests/index.js";
import * as L from "../scripts/roll-requests/links.js";
import { CLICK_DELAY_MS, CLICK_TRIES, pressControl } from "../scripts/roll-requests/card-buttons.js";
import { makeCoC7, makeDom, makeEnv, makeRollActor } from "./mocks.mjs";

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

/** A rendered CoC7 card for the watcher: a fake element whose button records a click (a dispatched click event). */
function renderCard(env, flags, { button = true } = {}) {
  const clicks = [];
  const view = { MouseEvent: class { constructor(type) { this.type = type; } }, Event: class {} };
  const fake = (sel) => ({ disabled: false, ownerDocument: { defaultView: view },
    dispatchEvent: (event) => { if (event.type === "click" && event.currentTarget) clicks.push(sel); } });
  const html = { querySelector: (sel) => (button ? fake(sel) : null) };
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

test("links: a skill name holding < or > can't be a link option or a roll key (CoC7 puts it into the page as HTML)", () => {
  assert.deepEqual(["Spot <img src=x onerror=alert(1)>", "a>b"].map(L.isSafeOption), [false, false]);
  assert.deepEqual(["Spot <img>", "a>b"].map(L.isSafeRollKey), [false, false]);
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

test("sanityLoss: numbers and dice are tidied; anything else is refused (the Sanity flyout's rule too)", () => {
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
  assert.equal(RR.sanityRequest({ failure: "0D6+" }), null); // the stricter rule the Sanity flyout used (session 11)
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

// --- Opposed ----------------------------------------------------------------------------------------

test("opposed: one CoC7 card with both sides, regular difficulty, dice; Start rolls clicked", async () => {
  const { env, calls } = setup();
  const alice = pc({ skills: [{ name: "Stealth", value: 50, cocid: "i.skill.stealth" }] });
  const guard = npc({ skills: [spot] });
  const request = RR.opposedRequest({ sides: [
    { actor: alice, check: { kind: "skill", name: "Stealth" }, dice: 1 },
    { actor: guard, check: { kind: "skill", name: "Spot Hidden" } }] });
  const result = await RR.send(request, []);
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

test("opposed: the Keeper is told when Start rolls can't be clicked", async () => {
  const { env, calls } = setup();
  const alice = pc(); const guard = npc();
  await RR.send(RR.opposedRequest({ sides: [
    { actor: alice, check: { kind: "characteristic", name: "int" } },
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

test("a CoC7 method that throws: skipped with a warning, never thrown to the flyout", async () => {
  const { calls } = setup();
  const guard = npc();
  guard.characteristicCheck = async () => { throw new Error("boom"); };
  const result = await RR.send(RR.checkRequest({ checks: [{ kind: "characteristic", name: "str" }] }), [guard]);
  assert.equal(result.skipped.length, 1);
  assert.equal(calls.warnings.length, 1);
});

test("player's client with the Player Rollbox off: send does nothing", async () => {
  const env = makeEnv({ isGM: false, values: { rollboxPlayerRollbox: false } });
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

test("no request: nothing sent", async () => {
  const { env } = setup();
  await RR.send(null, [pc()]);
  assert.equal(env.chat.length, 0);
});

// --- A player's requests (Player Rollbox on) and the Keeper relay --------------------------------------------------

/** Foundry's module socket: what each client emits, and the listener each registers. */
function socketFor() {
  const sent = [];
  const listeners = [];
  game.socket = { emit: (channel, data) => sent.push([channel, data]), on: (channel, f) => listeners.push([channel, f]) };
  game.users.get = (id) => game.users.find((user) => user.id === id);
  return { sent, listeners, deliver: (data, sender) => listeners.forEach(([, f]) => f(data, sender)) };
}

test("player's client: a check for their own character goes out from their client, whispered to them", async () => {
  const env = makeEnv({ isGM: false, values: { rollboxPlayerRollbox: true } });
  makeCoC7();
  const socket = socketFor();
  const alice = pc();
  const result = await RR.send(RR.checkRequest({ checks: [{ kind: "characteristic", name: "str" }] }), [alice]);
  assert.deepEqual(result.requested, [alice]);
  assert.deepEqual(env.chat[0].whisper, ["p1"]);
  assert.deepEqual(socket.sent, []);
});

test("player's client: an opposed roll goes to the Keeper's client; its answer is the player's result", async () => {
  makeEnv({ isGM: false, values: { rollboxPlayerRollbox: true } });
  makeCoC7();
  const socket = socketFor();
  game.users.activeGM = game.users[0];
  RR.registerKeeperRelay();
  const alice = pc(); const guard = npc();
  globalThis.fromUuidSync = (uuid) => [alice, guard].find((a) => a.uuid === uuid) ?? null;
  const request = RR.opposedRequest({ sides: [{ actor: alice, check: { kind: "characteristic", name: "str" } },
    { actor: guard, check: { kind: "characteristic", name: "str" } }] });
  const pending = RR.send(request, []);
  await Promise.resolve();
  const [[channel, message]] = socket.sent;
  assert.equal(channel, "module.keepers-rollbox");
  assert.deepEqual([message.type, message.userId, message.payload.request.sides.map((side) => side.actorUuid)],
    ["send", "p1", ["Actor.Alice", "Actor.Guard"]]);
  socket.deliver({ type: "answer", id: message.id, to: "p1",
    answer: { requested: ["Actor.Alice", "Actor.Guard"], rolled: [], skipped: [], copied: null, unavailable: false } }, "gm1");
  assert.deepEqual((await pending).requested, [alice, guard]);
});

test("player's client: with no Keeper online the player is told and nothing is sent", async () => {
  const env = makeEnv({ isGM: false, values: { rollboxPlayerRollbox: true } });
  makeCoC7();
  const socket = socketFor();
  const told = [];
  globalThis.ui = { notifications: { warn: (text) => told.push(text) } };
  game.users.activeGM = null;
  const result = await RR.send(RR.checkRequest({ checks: [{ kind: "characteristic", name: "str" }] }), [npc()]);
  assert.deepEqual([result.requested, socket.sent, env.chat.length], [[], [], 0]);
  assert.match(told[0], /Keeper needs to be online/);
  assert.equal(result.skipped[0].reason, "no Keeper online");
});

test("Keeper's client: sends a player's opposed roll as its own, leaving the NPC's side to the Keeper, and answers; refuses one with none of their characters", async () => {
  const { calls, env } = setup({}, { values: { rollboxPlayerRollbox: true } });
  const socket = socketFor();
  game.users.activeGM = game.users[0];
  assert.equal(RR.registerKeeperRelay(), true);
  const alice = pc(); const guard = npc();
  globalThis.fromUuidSync = (uuid) => [alice, guard].find((a) => a.uuid === uuid) ?? null;
  const side = (actor) => ({ actorUuid: actor.uuid, check: { kind: "characteristic", name: "str" }, dice: 0 });
  socket.deliver({ type: "send", id: "p1-1", userId: "p1",
    payload: { request: { type: "opposed", sides: [side(alice), side(guard)] }, actorUuids: [] } }, "p1");
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
  assert.equal(calls.linkActorClick.length, 1);
  // A player started it: the Keeper rolls the NPC's side, so Start rolls isn't pressed for them (the one render hook
  // is the maneuver tie watch, there from the start).
  assert.equal(env.hooks.renderChatMessageHTML?.length ?? 0, 1);
  assert.match(calls.notices.at(-1), /Roll the NPC's side on CoC7's card/);
  const answer = socket.sent.find(([, data]) => data.type === "answer")[1];
  assert.deepEqual([answer.to, answer.answer.requested], ["p1", ["Actor.Alice", "Actor.Guard"]]);
  socket.deliver({ type: "send", id: "p2-1", userId: "p2",
    payload: { request: { type: "opposed", sides: [side(alice), side(guard)] }, actorUuids: [] } }, "p2");
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
  assert.equal(calls.linkActorClick.length, 1);
  assert.equal(socket.sent.filter(([, data]) => data.type === "answer").at(-1)[1].answer, null);
});

test("Keeper's client: a player's opposed roll with the opponent's side open makes CoC7's card with their side only, no Start rolls, and tells the GMs; an open card for someone else's side is refused", async () => {
  const { calls, env } = setup({}, { values: { rollboxPlayerRollbox: true } });
  const socket = socketFor();
  game.users.activeGM = game.users[0];
  RR.registerKeeperRelay();
  const alice = pc(); const guard = npc();
  globalThis.fromUuidSync = (uuid) => [alice, guard].find((a) => a.uuid === uuid) ?? null;
  const mine = { actorUuid: alice.uuid, check: { kind: "characteristic", name: "str" }, dice: 0 };
  const open = { actorUuid: guard.uuid, open: true };
  socket.deliver({ type: "send", id: "p1-1", userId: "p1", payload: { request: { type: "opposed", sides: [mine, open] } } }, "p1");
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
  assert.deepEqual(calls.linkActorClick.map((call) => call.options.rolls), ["Actor.Alice#characteristic#str#1"]);
  // The maneuver tie watch and the roles watch (setRolesWhenJoined); no Start rolls watch.
  assert.equal(env.hooks.renderChatMessageHTML?.length ?? 0, 2);
  const note = env.chat.at(-1);
  assert.deepEqual(note.whisper, ["gm1"]);
  assert.match(note.content, /Add Guard&#39;s side/);
  socket.deliver({ type: "send", id: "p1-2", userId: "p1", payload: { request: { type: "opposed",
    sides: [{ ...mine, actorUuid: guard.uuid }, { actorUuid: alice.uuid, open: true }] } } }, "p1");
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
  assert.equal(calls.linkActorClick.length, 1);
});

test("roles on a player's opposed card: once the Keeper's side joins, the active Keeper's client presses the joined "
  + "side's role button until the player is Attacker and the joined side Defender; Start rolls is never pressed",
async () => {
  const { env } = setup({}, { values: { rollboxPlayerRollbox: true } });
  const socket = socketFor();
  game.users.activeGM = game.users[0];
  RR.registerKeeperRelay();
  const alice = pc(); const guard = npc();
  globalThis.fromUuidSync = (uuid) => [alice, guard].find((a) => a.uuid === uuid) ?? null;
  socket.deliver({ type: "send", id: "p1-1", userId: "p1", payload: { request: { type: "opposed", sides: [
    { actorUuid: alice.uuid, check: { kind: "characteristic", name: "str" }, dice: 0 },
    { actorUuid: guard.uuid, open: true }] } } }, "p1");
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
  const watch = env.hooks.renderChatMessageHTML.at(-1);
  makeDom();
  const pressed = [];
  const render = (rolls) => {
    const html = document.createElement("div");
    for (const [uuid, roll] of Object.entries(rolls)) {
      const portrait = document.createElement("div");
      portrait.className = "actor-portrait";
      portrait.dataset.actorUuid = uuid;
      for (const action of ["participant", "rollNoPlayers"]) {
        const button = document.createElement("button");
        button.dataset.action = action;
        button.addEventListener("click", () => pressed.push([action, roll.name]));
        portrait.append(button);
      }
      html.append(portrait);
    }
    // CoC7 saves the sides under their uuids with "/" for "."; the portraits carry the dotted uuid.
    const saved = Object.fromEntries(Object.entries(rolls).map(([uuid, roll]) => [uuid.replace(/\./g, "/"), roll]));
    watch({ id: "card1", timestamp: Date.now(), flags: { CoC7: { load: { as: "CoC7ChatOpposedMessage", cardOpen: true,
      isRolling: false, actorRolls: saved } } } }, html);
  };
  const wait = () => mock.timers.tick(CLICK_DELAY_MS);
  render({ [alice.uuid]: { name: "Alice", participant: "" } });
  wait();
  assert.deepEqual(pressed, [], "the player's side alone: nothing to set");
  render({ [alice.uuid]: { name: "Alice", participant: "" }, [guard.uuid]: { name: "Guard", participant: "" } });
  wait();
  render({ [alice.uuid]: { name: "Alice", participant: "" }, [guard.uuid]: { name: "Guard", participant: "A" } });
  wait();
  render({ [alice.uuid]: { name: "Alice", participant: "A" }, [guard.uuid]: { name: "Guard", participant: "D" } });
  wait();
  assert.deepEqual(pressed, [["participant", "Guard"], ["participant", "Guard"]]);
  assert.match(env.chat.at(-1).content, /Rollbox then makes Alice the attacker and Guard the defender/);
});

test("Keeper's client: the sender is the user Foundry's server names; a message without one is ignored", async () => {
  const { calls } = setup({}, { values: { rollboxPlayerRollbox: true } });
  const socket = socketFor();
  game.users.activeGM = game.users[0];
  RR.registerKeeperRelay();
  const alice = pc(); const guard = npc();
  globalThis.fromUuidSync = (uuid) => [alice, guard].find((a) => a.uuid === uuid) ?? null;
  const side = (actor) => ({ actorUuid: actor.uuid, check: { kind: "characteristic", name: "str" }, dice: 0 });
  const payload = { request: { type: "opposed", sides: [side(alice), side(guard)] }, actorUuids: [] };
  socket.deliver({ type: "send", id: "p2-1", userId: "p1", payload }, "p2");
  socket.deliver({ type: "send", id: "p1-0", userId: "p1", payload });
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
  assert.equal(calls.linkActorClick.length, 0);
  socket.deliver({ type: "send", id: "p1-1", payload }, "p1");
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
  assert.equal(calls.linkActorClick.length, 1);
});

test("pressControl: CoC7's handler still finds the pressed button after an await, as with a person's click", async () => {
  makeEnv();
  makeDom("<button data-set='aiming'></button>");
  const node = document.querySelector("button");
  const seen = [];
  node.addEventListener("click", async (event) => { await Promise.resolve(); seen.push(event.currentTarget?.dataset.set); });
  node.click();
  assert.equal(pressControl(node), true);
  await Promise.resolve(); await Promise.resolve();
  assert.deepEqual(seen, [undefined, "aiming"]);
});

test("Keeper's client: a player's Assist with their character helping and an NPC rolling rolls the NPC privately at once, no link to the Keepers; without them, refused", async () => {
  const { env } = setup({}, { values: { rollboxPlayerRollbox: true } });
  const socket = socketFor();
  game.users.activeGM = game.users[0];
  RR.registerKeeperRelay();
  const alice = pc(); const guard = npc();
  globalThis.fromUuidSync = (uuid) => [alice, guard].find((a) => a.uuid === uuid) ?? null;
  const request = RR.checkRequest({ checks: [{ kind: "characteristic", name: "str" }], label: "Assist" });
  const answers = () => socket.sent.filter(([, data]) => data.type === "answer").map(([, data]) => data.answer);
  socket.deliver({ type: "send", id: "p1-1", userId: "p1",
    payload: { request, actorUuids: [guard.uuid], mode: "whisper", involvedUuids: [alice.uuid] } }, "p1");
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
  socket.deliver({ type: "send", id: "p1-2", userId: "p1", payload: { request, actorUuids: [guard.uuid] } }, "p1");
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
  assert.deepEqual(answers().map((answer) => answer?.rolled ?? null), [[guard.uuid], null]);
  assert.deepEqual(answers()[0].requested, []);
  assert.equal(guard.calls.length, 1);
  assert.ok(env.chat.every((message) => !/@coc7/.test(message.content)));
});

test("Keeper's client: a player's check for another player's investigator with a forged helper list is refused; sent only when Assist confirms the group", async () => {
  const { env } = setup({}, { values: { rollboxPlayerRollbox: true } });
  const socket = socketFor();
  game.users.activeGM = game.users[0];
  RR.registerKeeperRelay();
  const alice = pc(); const bob = pc({ name: "Bob", owners: [game.users[2]] });
  globalThis.fromUuidSync = (uuid) => [alice, bob].find((a) => a.uuid === uuid) ?? null;
  const request = RR.checkRequest({ checks: [{ kind: "characteristic", name: "str" }], label: "Assist" });
  const ask = (id) => socket.deliver({ type: "send", id, userId: "p1",
    payload: { request, actorUuids: [bob.uuid], involvedUuids: [alice.uuid] } }, "p1");
  const seen = [];
  RR.registerHelperCheck((rollers, helpers, user) => { seen.push([rollers, helpers, user?.id]); return false; });
  ask("p1-1");
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
  RR.registerHelperCheck(() => true);
  ask("p1-2");
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
  RR.registerHelperCheck(null);
  const answers = Object.fromEntries(socket.sent.filter(([, data]) => data.type === "answer")
    .map(([, data]) => [data.id, data.answer?.requested ?? null]));
  assert.deepEqual(answers, { "p1-1": null, "p1-2": [bob.uuid] });
  assert.deepEqual(seen, [[[bob], [alice], "p1"]]);
  assert.equal(env.chat.length, 1);
});

test("maneuver notice: read only when a GM or a player of the attacker wrote it; a player's notice naming an NPC attacker is ignored", () => {
  setup();
  const { alice, guard } = fighters();
  globalThis.fromUuidSync = (uuid) => [alice, guard].find((a) => a.uuid === uuid) ?? null;
  const notice = (attacker, author) => ({ id: "n1", author, flags: { "keepers-rollbox": { maneuver: { attacker,
    target: alice.uuid, weapon: "gpunch", goal: "restrain", answer: null, card: null } } } });
  const player = game.users[1];
  assert.equal(RR.readManeuverNotice(notice(guard.uuid, player)), null);
  assert.equal(RR.readManeuverNotice(notice(guard.uuid, null)), null);
  assert.equal(RR.readManeuverNotice(notice(guard.uuid, { isGM: true }))?.attacker, guard.uuid);
  assert.equal(RR.readManeuverNotice(notice(alice.uuid, player))?.attacker, alice.uuid);
});

test("maneuver relay: two answers to one notice close together make one card", async () => {
  const { calls } = fightBackSetup();
  const answers = await Promise.all([RR.answerManeuver("n1", { answer: "dodge" }), RR.answerManeuver("n1", { answer: "dodge" })]);
  assert.deepEqual(answers.map((answer) => answer.ok), [true, false]);
  assert.equal(calls.linkActorClick.length, 1);
});

test("Keeper's client: a relayed request is rebuilt by its normaliser; an unknown type or another player's character is refused", async () => {
  const { env } = setup({}, { values: { rollboxPlayerRollbox: true } });
  const socket = socketFor();
  game.users.activeGM = game.users[0];
  RR.registerKeeperRelay();
  const alice = pc(); const bob = pc({ name: "Bob", owners: [game.users[2]] });
  globalThis.fromUuidSync = (uuid) => [alice, bob].find((a) => a.uuid === uuid) ?? null;
  const ask = (id, request, actors) => socket.deliver({ type: "send", id, userId: "p1",
    payload: { request, actorUuids: actors.map((a) => a.uuid) } }, "p1");
  ask("p1-1", { type: "check", checks: [{ kind: "characteristic", name: "str" }], dice: "1]{<b>x</b>", label: "<img src=x onerror=alert(1)>Spot" }, [alice]);
  ask("p1-2", { type: "shout", checks: [] }, [alice]);
  ask("p1-3", { type: "check", checks: [{ kind: "characteristic", name: "str" }] }, [alice, bob]);
  for (let i = 0; i < 30; i += 1) await Promise.resolve();
  assert.equal(env.chat.length, 1);
  assert.doesNotMatch(env.chat[0].content, /poolModifier|<img|<b>/);
  const answers = Object.fromEntries(socket.sent.filter(([, data]) => data.type === "answer")
    .map(([, data]) => [data.id, data.answer?.requested ?? null]));
  assert.deepEqual(answers, { "p1-1": [alice.uuid], "p1-2": null, "p1-3": null });
});

// --- Maneuvers on CoC7's opposed card --------------------------------------------------------------

const BRAWL = { name: "Fighting (Brawl)", value: 50 };
const DODGE = { name: "Dodge", value: 30 };

/** Alice (Build 0, her Punch with Maneuver on) and a Guard (Build 1: a Punch with Maneuver on, a knife, Dodge). */
function fighters() {
  const alice = pc({ skills: [BRAWL], weapons: [{ id: "punch", name: "Punch", main: "Fighting (Brawl)" }] });
  const guard = npc({ skills: [BRAWL, DODGE], weapons: [{ id: "gpunch", name: "Punch", main: "Fighting (Brawl)" },
    { id: "knife", name: "Knife", main: "Fighting (Brawl)" }] });
  guard.items.find((i) => i.name === "Dodge").system.isDodge = true;
  for (const [actor, build] of [[alice, 0], [guard, 1]]) {
    actor.system.attribs.build = { value: build };
    for (const weapon of actor.items.filter((i) => i.type === "weapon")) weapon.system.properties = { mnvr: weapon.name === "Punch" };
  }
  return { alice, guard, weapon: alice.items.find((i) => i.id === "punch") };
}

test("maneuverRolls: the attacker's maneuver weapon with the Build dice first; Dodge, a fighting weapon or a counter; ties by the rules", () => {
  setup();
  const { alice, guard, weapon } = fighters();
  const rolls = (answer, defence = null) => RR.maneuverRolls({ attacker: alice, weapon, target: guard, answer, defence });
  assert.deepEqual(rolls("dodge"), { rolls: ["Actor.Alice#item#Punch#-1#1", "Actor.Guard#skill#Dodge#1"], advantage: "D" });
  assert.deepEqual(rolls("fight", guard.items.find((i) => i.id === "knife")).rolls[1], "Actor.Guard#item#Knife#1");
  // A Punch with Maneuver on fights back as the weapon (its Maneuver is off while CoC7 makes the card); as its skill
  // only when it couldn't be switched off, else CoC7 would call the win a maneuver.
  const gpunch = guard.items.find((i) => i.id === "gpunch");
  assert.deepEqual(rolls("fight", gpunch), { rolls: ["Actor.Alice#item#Punch#-1#1", "Actor.Guard#item#Punch#1"], advantage: "A" });
  assert.equal(RR.maneuverRolls({ attacker: alice, weapon, target: guard, answer: "fight", defence: gpunch, fightAsSkill: true })
    .rolls[1], "Actor.Guard#skill#Fighting (Brawl)#1");
  assert.deepEqual(rolls("counter").rolls[1], "Actor.Guard#item#Punch#1"); // the bigger one: no Build dice
  guard.system.attribs.build.value = 3;
  assert.match(rolls("dodge").error, /too big/);
});

test("maneuver relay: the Keeper's client makes CoC7's combat opposed card for the target's player, presses Start Rolls; refuses anyone else", async () => {
  const { calls, env } = setup({}, { values: { rollboxPlayerRollbox: true } });
  const socket = socketFor();
  game.users.activeGM = game.users[0];
  RR.registerKeeperRelay();
  const { alice, guard } = fighters();
  globalThis.fromUuidSync = (uuid) => [alice, guard].find((a) => a.uuid === uuid) ?? null;
  // Guard attempts a maneuver on Alice, whose player (p1) answers.
  guard.items.find((i) => i.id === "gpunch").system.properties.mnvr = true;
  const notice = { id: "n1", updates: [], author: { isGM: true }, flags: { "keepers-rollbox": { maneuver: { attacker: guard.uuid, target: alice.uuid,
    weapon: "gpunch", goal: "pushAway", answer: null, card: null } } } };
  notice.update = async (changes) => { notice.updates.push(changes); };
  game.messages = { get: (id) => (id === "n1" ? notice : null), contents: [notice] };
  const ask = (sender) => socket.deliver({ type: "maneuver", id: `${sender}-1`, userId: sender,
    payload: { noticeId: "n1", answer: "dodge" } }, sender);
  ask("p2");
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
  assert.equal(calls.linkActorClick.length, 0);
  ask("p1");
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
  assert.deepEqual(calls.linkActorClick[0].options.rolls, "Actor.Guard#item#Punch#1&&Actor.Alice#skill#Dodge#1");
  assert.equal(calls.linkActorClick[0].options.combat, true);
  const clicks = renderCard(env, { as: "CoC7ChatOpposedMessage", actorUuids: [guard.uuid, alice.uuid] });
  mock.timers.tick(CLICK_DELAY_MS);
  assert.deepEqual(clicks, ['[data-action="rollNoPlayers"]']);
});

test("maneuver tie: on a maneuver's card offering Advantage, the active Keeper presses the one the rules give, once", () => {
  const { env } = setup({}, { values: { rollboxPlayerRollbox: true } });
  game.users.activeGM = game.users[0];
  RR.registerKeeperRelay();
  const notice = { id: "n1", author: { isGM: true }, flags: { "keepers-rollbox": { maneuver: { attacker: "Actor.A", target: "Actor.B",
    weapon: "w", goal: "restrain", answer: "dodge", card: "c1" } } } };
  game.messages = { contents: [notice] };
  const pressed = [];
  const view = { MouseEvent: class { constructor(type) { this.type = type; } }, Event: class {} };
  const button = (value) => ({ disabled: false, classList: { contains: () => false }, ownerDocument: { defaultView: view },
    dispatchEvent: (event) => { if (event.currentTarget) pressed.push(value); } });
  const html = { querySelectorAll: () => [button("A"), button("D")],
    querySelector: (sel) => button(sel.match(/data-value="(\w)"/)?.[1]) };
  const card = { id: "c1", flags: { CoC7: { load: { as: "CoC7ChatOpposedMessage", isCombat: true, cardOpen: true } } } };
  env.hooks.renderChatMessageHTML.forEach((f) => f(card, html));
  env.hooks.renderChatMessageHTML.forEach((f) => f(card, html));
  mock.timers.tick(CLICK_DELAY_MS);
  assert.deepEqual(pressed, ["D"]); // Dodge: the defender wins the tie
});

test("maneuver answers: Counter with the weapon picked; No response rolls the attacker's maneuver skill alone with the Build dice", async () => {
  setup();
  const { alice, guard, weapon } = fighters();
  const whip = { type: "weapon", id: "whip", name: "Whip", uuid: `${guard.uuid}.Item.whip`,
    system: { properties: { mnvr: true }, skill: { main: { id: "", name: "Fighting (Brawl)" } } } };
  guard.items.push(whip);
  assert.equal(RR.maneuverRolls({ attacker: alice, weapon, target: guard, answer: "counter", defence: whip }).rolls[1],
    "Actor.Guard#item#Whip#1");
  assert.deepEqual(RR.counterWeapons(guard).map((w) => w.name), ["Punch", "Whip"]);
  const brawl = alice.items.find((i) => i.name === "Fighting (Brawl)");
  weapon.system.skill.main.id = brawl.id;
  globalThis.fromUuidSync = (uuid) => [alice, guard].find((a) => a.uuid === uuid) ?? null;
  const notice = { id: "n1", updates: [], author: { isGM: true }, flags: { "keepers-rollbox": { maneuver: { attacker: alice.uuid,
    target: guard.uuid, weapon: "punch", goal: "restrain", answer: null, card: null } } } };
  notice.update = async (changes) => { notice.updates.push(changes); };
  game.messages = { get: () => notice, contents: [notice] };
  assert.deepEqual(await RR.answerManeuver("n1", { answer: "none" }), { ok: true });
  assert.deepEqual(alice.calls, [["skillCheck", "Fighting (Brawl)", true, { poolModifier: -1 }]]);
  assert.deepEqual(notice.updates, [{ "flags.keepers-rollbox.maneuver.answer": "none" }]);
});


/** A Guard whose Maneuver-on Punch records its updates, and the notice of Alice's maneuver on him. */
function fightBackSetup() {
  const { env, calls } = setup({}, { values: { rollboxPlayerRollbox: true } });
  const { alice, guard } = fighters();
  const gpunch = guard.items.find((i) => i.id === "gpunch");
  gpunch.updates = [];
  gpunch.update = async (changes) => {
    gpunch.updates.push(changes);
    gpunch.system.properties.mnvr = changes["system.properties.mnvr"];
  };
  globalThis.fromUuidSync = (uuid) => [alice, guard].find((a) => a.uuid === uuid) ?? null;
  const notice = { id: "n1", updates: [], author: { isGM: true }, flags: { "keepers-rollbox": { maneuver: { attacker: alice.uuid,
    target: guard.uuid, weapon: "punch", goal: "restrain", answer: null, card: null } } } };
  notice.update = async (changes) => { notice.updates.push(changes); };
  game.messages = { get: () => notice, contents: [notice] };
  return { env, calls, alice, guard, gpunch };
}

const OFF = { "system.properties.mnvr": false, "flags.keepers-rollbox.maneuverOff": true };
const ON = { "system.properties.mnvr": true, "flags.keepers-rollbox.-=maneuverOff": null };

test("fight back with a Maneuver-on Punch: its Maneuver is off while CoC7 makes the card (the Punch as the weapon), back on once the card is posted", async () => {
  const { env, calls, alice, guard, gpunch } = fightBackSetup();
  let mnvrAtClick = null;
  CONFIG.CoC7Link.documentClass._onLinkActorClick = async (actor, options) => {
    mnvrAtClick = gpunch.system.properties.mnvr;
    calls.linkActorClick.push({ actor, options });
  };
  const answered = RR.answerManeuver("n1", { answer: "fight", weaponId: "gpunch" });
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
  assert.equal(mnvrAtClick, false);
  assert.equal(calls.linkActorClick[0].options.rolls, "Actor.Alice#item#Punch#-1#1&&Actor.Guard#item#Punch#1");
  assert.deepEqual(gpunch.updates, [OFF]); // still off until CoC7's card is posted
  env.hooks.createChatMessage.forEach((f) => f({ id: "c1", flags: { CoC7: { load: { as: "CoC7ChatOpposedMessage",
    isCombat: true, actorUuids: [alice.uuid, guard.uuid] } } } }));
  assert.deepEqual(await answered, { ok: true });
  assert.deepEqual(gpunch.updates, [OFF, ON]);
  for (const hook of ["createChatMessage", "renderChatMessageHTML"]) env.hooks[hook] = [];
});

test("fight back with a Maneuver-on Punch: CoC7 throwing still switches it back on; one left off is switched on by restoreManeuvers", async () => {
  const { env, guard, gpunch } = fightBackSetup();
  CONFIG.CoC7Link.documentClass._onLinkActorClick = async () => { throw new Error("forced"); };
  const result = await RR.answerManeuver("n1", { answer: "fight", weaponId: "gpunch" });
  assert.equal(result.ok, false);
  assert.deepEqual(gpunch.updates, [OFF, ON]);
  // Left off (the page closed in between): its sheet gets one update switching it back on; other sheets none.
  gpunch.flags = { "keepers-rollbox": { maneuverOff: true } };
  const batches = [];
  guard.updateEmbeddedDocuments = async (type, updates) => { batches.push([type, updates]); };
  assert.equal(await RR.restoreManeuvers([guard, fighters().alice]), 1);
  assert.deepEqual(batches, [["Item", [{ _id: "gpunch", ...ON }]]]);
  for (const hook of ["createChatMessage", "renderChatMessageHTML"]) env.hooks[hook] = [];
});
