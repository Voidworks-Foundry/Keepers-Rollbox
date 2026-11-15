import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import { registerOpposedRoll, renderOpposedRoll } from "../scripts/opposed-roll/index.js";
import { makeCoC7, makeDom, makeEnv, makeRollActor, resultText } from "./mocks.mjs";

const STATS = { str: 50, con: 60, siz: 65, dex: 55, app: 45, int: 70, pow: 40, edu: 75 };
const stealth = { name: "Stealth", value: 50, cocid: "i.skill.stealth" };
const spot = { name: "Spot Hidden", value: 60, cocid: "i.skill.spot-hidden" };

/** Keeper's client with CoC7, and a DOM for the view. */
function setup(coc7 = {}) {
  const env = makeEnv();
  const calls = makeCoC7(coc7);
  makeDom();
  game.users[1].name = "Test";
  game.users[1].active = true;
  return { env, calls };
}

const pc = (options = {}) => makeRollActor({ name: "Alice", owners: [game.users[1]], characteristics: STATS,
  luck: 45, san: 60, ...options });
const npc = (options = {}) => makeRollActor({ name: "Guard", type: "npc", owners: [], characteristics: STATS,
  luck: 30, san: 40, ...options });

/** The view drawn for two characters, with helpers to use it like the Keeper. Side 0 and 1 in selection order. */
function open(actors) {
  const stage = document.createElement("div");
  document.body.append(stage);
  const closed = [];
  renderOpposedRoll(stage, { actors, close: () => closed.push(true) });
  const sides = [...stage.querySelectorAll(".rollbox-opposed-side")];
  const within = (i, selector) => [...sides[i].querySelectorAll(selector)];
  const tab = (i, label) => within(i, ".rollbox-opposed-tab").find((b) => b.textContent === label).click();
  const pick = (i, name) => within(i, ".rollbox-opposed-row")
    .find((b) => b.querySelector(".rollbox-opposed-row-name").textContent === name).click();
  const dice = (i, label) => within(i, ".rollbox-segment").find((b) => b.textContent === label).click();
  const press = (text) => [...stage.querySelectorAll("button")].find((b) => b.textContent === text).click();
  const text = (selector) => stage.querySelector(selector)?.textContent;
  const result = () => resultText(stage.querySelector(".rollbox-result"));
  return { stage, sides, within, tab, pick, dice, press, text, result, closed };
}

/** Let send() finish: it awaits CoC7's lookups, which are promises only. */
const settle = () => new Promise(setImmediate);

// Fake timers: the card watch's 15 s timeout (roll-requests) never holds the file open.
beforeEach(() => mock.timers.enable({ apis: ["setTimeout"] }));
afterEach(() => mock.timers.reset());

test("registerOpposedRoll: only on the Keeper's client with the Rollbox switch on", () => {
  makeEnv({ isGM: false });
  assert.equal(registerOpposedRoll(), false);
  makeEnv({ values: { rollboxEnabled: false } });
  assert.equal(registerOpposedRoll(), false);
  makeEnv({ values: { rollboxEnabled: true } });
  assert.equal(registerOpposedRoll(), true);
});

test("skill vs skill: both sheets with the card between; Create waits for both picks; one card, both sides", async () => {
  const { calls } = setup();
  const alice = pc({ skills: [stealth] }); const guard = npc({ skills: [spot] });
  const m = open([alice, guard]);
  assert.deepEqual([...m.stage.children].map((n) => n.className),
    ["rollbox-card rollbox-sheet rollbox-opposed-sheet", "rollbox-card rollbox-opposed-card",
      "rollbox-card rollbox-sheet rollbox-opposed-sheet"]);
  assert.equal(m.text(".rollbox-opposed-tie"), "Pick a check for both sides.");
  m.tab(0, "Skill"); m.pick(0, "Stealth");
  assert.equal(m.text(".rollbox-opposed-primary"), "Create opposed card");
  assert.equal(m.stage.querySelector(".rollbox-opposed-primary").disabled, true);
  assert.equal(m.text(".rollbox-opposed-tie"), "Pick a check for Guard.");
  assert.ok(m.stage.querySelector(".rollbox-opposed-tie").classList.contains("rollbox-status-missing"));
  m.tab(1, "Skill"); m.pick(1, "Spot Hidden");
  assert.equal(m.stage.querySelector(".rollbox-opposed-tie").classList.contains("rollbox-status-missing"), false);
  m.press("Create opposed card"); await settle();
  assert.equal(calls.linkActorClick.length, 1);
  assert.equal(calls.linkActorClick[0].options.rolls,
    "Actor.Alice#skill#i.skill.stealth#1&&Actor.Guard#skill#i.skill.spot-hidden#1");
  assert.equal(m.result()[0], "Opposed card made:");
});

test("a missing skill: listed at base value with a note, and shown in the side's header; CoC7 adds it when the card is made", async () => {
  const { calls } = setup();
  const m = open([pc({ skills: [stealth] }), npc()]);
  m.tab(0, "Skill"); m.pick(0, "Stealth");
  m.tab(1, "Skill"); m.pick(1, "Listen");
  assert.equal(m.within(1, ".rollbox-opposed-hint")[0].hidden, false);
  assert.equal(m.within(1, ".rollbox-opposed-pick")[0].textContent, "Listen 20");
  m.press("Create opposed card"); await settle();
  assert.match(calls.linkActorClick[0].options.rolls, /&&Actor\.Guard#skill#i\.skill\.listen#1$/);
});

test("a skill CoC7 can't find: no card, and the view says why", async () => {
  const { calls } = setup({ cocidMatches: () => 0 });
  const m = open([pc({ skills: [stealth] }), npc()]);
  m.tab(0, "Skill"); m.pick(0, "Stealth");
  m.tab(1, "Skill"); m.pick(1, "Listen");
  m.press("Create opposed card"); await settle();
  assert.equal(calls.linkActorClick.length, 0);
  assert.deepEqual(m.result(), ["Not sent:", "Guard: CoC7 can't find Listen"]);
});

test("an NPC side: Start rolls is watched for so it rolls that side, and the result says who rolls", async () => {
  const { env } = setup();
  const m = open([pc(), npc()]);
  m.pick(0, "DEX"); m.pick(1, "DEX");
  m.press("Create opposed card"); await settle();
  assert.equal(env.hooks.renderChatMessageHTML.length, 1);
  assert.deepEqual(m.result(), ["Opposed card made:", "Alice: Test rolls on the card",
    "Guard: Keeper rolls (NPC), by Start rolls"]);
});

test("ties: the higher value is named for the Keeper; equal values are a stalemate or re-roll", () => {
  setup();
  const m = open([pc({ skills: [stealth] }), npc({ skills: [spot] })]);
  m.tab(0, "Skill"); m.pick(0, "Stealth");
  m.tab(1, "Skill"); m.pick(1, "Spot Hidden");
  assert.match(m.text(".rollbox-opposed-tie"), /Guard wins/);
  m.tab(0, "Characteristic"); m.pick(0, "STR");
  m.tab(1, "Characteristic"); m.pick(1, "STR");
  assert.match(m.text(".rollbox-opposed-tie"), /stalemate/);
});

test("each side picks from two tabs, Characteristic and Skill (no Attribute tab)", () => {
  setup();
  const m = open([pc(), npc()]);
  assert.deepEqual(m.within(0, ".rollbox-opposed-tab").map((n) => n.textContent), ["Characteristic", "Skill"]);
});

test("started from the mini sheet: the first character on the left with both picks; create makes the card at once", async () => {
  const { calls } = setup();
  const alice = pc(); const guard = npc();
  const stage = document.createElement("div");
  document.body.append(stage);
  renderOpposedRoll(stage, { actors: [alice, guard], start: { first: guard.uuid,
    picks: { [guard.uuid]: "characteristic:pow", [alice.uuid]: "characteristic:str" }, create: true } });
  await settle();
  assert.equal(stage.querySelector(".rollbox-opposed-side .rollbox-opposed-name").textContent, "Guard");
  assert.equal(calls.linkActorClick[0].options.rolls, "Actor.Guard#characteristic#pow#1&&Actor.Alice#characteristic#str#1");
});

test("Swap sides: the characters change places with their picks and dice, so the other is CoC7's first side", async () => {
  const { calls } = setup();
  const m = open([pc({ skills: [stealth] }), npc({ skills: [spot] })]);
  m.tab(0, "Skill"); m.pick(0, "Stealth"); m.dice(0, "+1");
  m.tab(1, "Skill"); m.pick(1, "Spot Hidden");
  m.press("⇅ Swap sides");
  const sides = [...m.stage.querySelectorAll(".rollbox-opposed-side")];
  assert.deepEqual(sides.map((s) => s.querySelector(".rollbox-opposed-role").textContent + " " +
    s.querySelector(".rollbox-opposed-name").textContent), ["Attacker Guard", "Defender Alice"]);
  assert.ok(m.stage.querySelector(".rollbox-opposed-sheet").textContent.includes("Guard")); // left-hand sheet
  assert.equal(sides[1].querySelector('.rollbox-opposed-row[aria-selected="true"]').dataset.key, "skill:stealth");
  m.press("Create opposed card"); await settle();
  assert.equal(calls.linkActorClick[0].actor.name, "Guard");
  assert.equal(calls.linkActorClick[0].options.rolls,
    "Actor.Guard#skill#i.skill.spot-hidden#1&&Actor.Alice#skill#i.skill.stealth#+1#1");
});

test("Cancel closes the view; nothing is sent", async () => {
  const { calls } = setup();
  const m = open([pc(), npc()]);
  m.press("Cancel");
  assert.deepEqual(m.closed, [true]);
  assert.equal(calls.linkActorClick.length, 0);
});
