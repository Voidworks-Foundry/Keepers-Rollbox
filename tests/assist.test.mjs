import assert from "node:assert/strict";
import { test } from "node:test";
import { assistCardHtml, assistChoices, assistColumns, difficultyFor, registerAssist, renderAssist } from "../scripts/assist/index.js";
import { addStyles, makeCoC7, makeDom, makeEnv, makeRollActor, resultText } from "./mocks.mjs";

/** The rulebook's rafter (Keeper Rulebook p. 88–89): SIZ 150 against five investigators' STR. */
const RAFTER = [["Belinda", 75], ["Harvey", 20], ["Helen", 60], ["Cecil", 40], ["Martin", 45]]
  .map(([name, value]) => ({ name, value }));
const names = (list) => list.map((c) => c.name);

// --- The maths ---------------------------------------------------------------------------------

test("difficultyFor: below 50 Regular, 50+ Hard, 90+ Extreme", () => {
  assert.deepEqual([1, 49, 50, 89, 90, 140].map(difficultyFor), ["regular", "regular", "hard", "hard", "extreme", "extreme"]);
});

test("assistChoices: the rulebook rafter: Harvey, Cecil, Martin help; Helen and Belinda roll at Regular, 45 left", () => {
  const choice = assistChoices(RAFTER, 150);
  assert.deepEqual(names(choice.helpers), ["Harvey", "Cecil", "Martin"]);
  assert.deepEqual(names(choice.rollers), ["Helen", "Belinda"]);
  assert.equal(choice.left, 45);
  assert.equal(choice.difficulty, "regular");
  assert.equal(Math.round(choice.chance * 100), 90); // 1 − 0.40 × 0.25
});

test("assistChoices: what's left never goes to 0 or below; with no need to help, nobody helps", () => {
  // Harvey alone would leave 0: not allowed, so both roll against 20 at Regular.
  const choice = assistChoices([{ name: "Harvey", value: 20 }, { name: "Cecil", value: 40 }], 20);
  assert.deepEqual(names(choice.helpers), []);
  assert.deepEqual(names(choice.rollers), ["Harvey", "Cecil"]);
  assert.equal(choice.left, 20);
});

test("assistChoices: too heavy even together, or nothing to beat, gives null", () => {
  assert.equal(assistChoices(RAFTER, 400), null); // even with four helping, 235 is left: more than 100 + 75
  assert.equal(assistChoices(RAFTER, 0), null);
  assert.equal(assistChoices([{ name: "Thing" }], 50), null); // no value: takes no part
});

test("assistChoices: equal values keep the names-card order; equal chances go to fewer helpers", () => {
  // Cy 30 and the first of the two 50s help (20 left, Regular); the other 50 rolls.
  assert.deepEqual(names(assistChoices([{ name: "Ann", value: 50 }, { name: "Cy", value: 30 }, { name: "Bea", value: 50 }], 100).helpers),
    ["Cy", "Ann"]);
  assert.deepEqual(names(assistChoices([{ name: "Bea", value: 50 }, { name: "Cy", value: 30 }, { name: "Ann", value: 50 }], 100).helpers),
    ["Cy", "Bea"]);
  // Bea at 100 succeeds for sure with or without Ann's help: nobody helps.
  assert.deepEqual(names(assistChoices([{ name: "Ann", value: 30 }, { name: "Bea", value: 100 }], 45).helpers), []);
});

// --- The menu ----------------------------------------------------------------------------------

/** Keeper's client with CoC7, and a DOM for the flyout. */
function setup(env = {}) {
  const e = makeEnv(env);
  const calls = makeCoC7();
  makeDom();
  return { env: e, calls };
}

/** A character with this STR and SIZ; a player's (owner Test) unless `npc`; `creature`: CoC7's creature type. */
const person = (name, str, { siz = 60, npc = false, creature = false } = {}) => makeRollActor({ name,
  type: creature ? "creature" : npc ? "npc" : "character", owners: npc || creature ? [] : [game.users[1]],
  characteristics: { str, siz } });

/** The Assist menu drawn for these characters, with helpers to use it like the Keeper. */
function open(actors, { selectionChanged = false, body = null } = {}) {
  const root = body ?? document.createElement("div");
  root.replaceChildren();
  document.body.append(root);
  let closed = false;
  renderAssist(root, { actors, selectionChanged, close: () => { closed = true; } });
  const all = (selector) => [...root.querySelectorAll(selector)];
  const press = (text) => all("button").find((node) => node.textContent === text).click();
  const toggle = (group, stat) => root.querySelector(`[aria-label="${group}"] [data-value="${stat}"]`).click();
  const row = (name) => all(".rollbox-assist-row").find((r) => r.querySelector(".rollbox-assist-name-who").textContent === name);
  const target = (name) => row(name).querySelector(".rollbox-assist-target").click();
  const leaveOut = (name) => row(name).querySelector(".rollbox-assist-name").click();
  const type = (selector, value) => {
    const input = root.querySelector(selector);
    input.value = value;
    input.dispatchEvent(new document.defaultView.Event("input"));
  };
  const text = (selector) => root.querySelector(selector)?.textContent;
  const line = () => root.querySelector(".rollbox-assist-against").value;
  const caption = () => text(".rollbox-value-caption");
  /** The result, one entry per line: "Assisting", "Harvey−20", … "Regular STR90% one succeeds". */
  const outcome = () => all(".rollbox-assist-lists > *").map((node) => node.textContent);
  const red = () => (root.querySelector(".rollbox-assist-missing").hidden ? "" : text(".rollbox-assist-missing"));
  const sendDisabled = () => root.querySelector(".rollbox-assist-primary").disabled;
  return { body: root, all, press, toggle, row, target, leaveOut, type, text, line, caption, outcome, red,
    sendDisabled, closed: () => closed };
}

/** Let send() finish: it awaits ChatMessage.create and CoC7's actor methods. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 10));

test("registerAssist: only on the Keeper's client with the Rollbox switch on", () => {
  makeEnv({ isGM: false });
  assert.equal(registerAssist(), false);
  makeEnv({ values: { rollboxEnabled: false } });
  assert.equal(registerAssist(), false);
  makeEnv({ values: { rollboxEnabled: true } });
  assert.equal(registerAssist(), true);
});

test("the rafter: Assisting, Rolling and the result line; Send asks the rollers at Regular STR with the label and posts the card",
  async () => {
  const { env } = setup();
  const [belinda, harvey, helen, cecil, martin] = [person("Belinda", 75, { npc: true }), person("Harvey", 20),
    person("Helen", 60), person("Cecil", 40), person("Martin", 45)];
  const m = open([belinda, harvey, helen, cecil, martin]);
  assert.equal(m.sendDisabled(), true); // nothing to beat yet
  assert.equal(m.red(), "Target someone, or type the STR to beat.");
  m.toggle("Against", "siz");
  m.type(".rollbox-assist-against", "150");
  m.type(".rollbox-assist-label", "lift the rafter");
  assert.equal(m.caption(), "STR against SIZ");
  assert.deepEqual(m.outcome(), ["Assisting", "Harvey−20", "Cecil−40", "Martin−45", "Rolling", "HelenSTR 60",
    "BelindaSTR 75", "Regular STR90% one succeeds"]);
  assert.equal(m.red(), "");
  m.press("Send to rollers"); await settle();
  // Helen's request is whispered to her player; Belinda, an NPC, is rolled privately for the Keeper.
  assert.deepEqual(env.chat[0].whisper, ["p1"]);
  assert.match(env.chat[0].content, /requested Helen make a .*@coc7\.check\[subtype:characteristic,name:str,difficulty:1,blind:false\]\{STR · lift the rafter\}/);
  assert.equal(belinda.calls[0][0], "characteristicCheck");
  assert.deepEqual(harvey.calls, []);
  const card = env.chat.at(-1);
  assert.equal("whisper" in card, false);
  assert.match(card.content, /Assist<.*lift the rafter.*STR against SIZ: 45 left, <b>Regular STR<\/b>.*Helping: Harvey, Cecil, Martin\..*Rolling: Helen, Belinda\..*One success is enough\./);
  assert.deepEqual(resultText(m.body.querySelector(".rollbox-result")),
    ["Assist sent to:", "Helen", "Rolled for you:", "Belinda", "Assist card posted."]);
});

test("Use SIZ: the characters' SIZ is put in and asked for; with no label the request reads \"SIZ · Assist\"", async () => {
  const { env } = setup();
  const m = open([person("Ann", 30, { siz: 80 }), person("Bea", 40, { siz: 50 })]);
  m.toggle("Use", "siz");
  m.type(".rollbox-assist-against", "20");
  assert.deepEqual(m.outcome(), ["Assisting", "No one", "Rolling", "BeaSIZ 50", "AnnSIZ 80", "Regular SIZ90% one succeeds"]);
  m.press("Send to rollers"); await settle();
  assert.match(env.chat[0].content, /name:siz,difficulty:1.*\{SIZ · Assist\}/);
});

test("targets: a creature starts marked; values add up; only the target button (or typing) unmarks one",
  () => {
  setup();
  const harvey = person("Harvey", 50); const cecil = person("Cecil", 60); const ghoul = person("Ghoul", 70, { npc: true });
  const [a, b] = [person("Zombie A", 80, { creature: true }), person("Zombie B", 80, { creature: true })];
  let m = open([harvey, a, cecil, ghoul, b]);
  // Both zombies start marked (creatures); the Ghoul, an NPC, takes part.
  assert.equal(m.line(), "160");
  assert.equal(m.caption(), "STR against Zombie A + Zombie B");
  assert.deepEqual(m.outcome(), ["Assisting", "Harvey−50", "Cecil−60", "Rolling", "GhoulSTR 70", "Hard STR35% one succeeds"]);
  m.target("Zombie B"); // unmark one
  assert.equal(m.line(), "80");
  assert.equal(m.row("Zombie B").classList.contains("rollbox-assist-is-target"), false);
  m.target("Zombie B"); // and mark it again
  assert.equal(m.line(), "160");
  // Leaving a target out doesn't unmark it (Void, 2026-11-14): it stops counting, and counts again when back.
  m.leaveOut("Zombie B");
  assert.equal(m.line(), "80");
  m.leaveOut("Zombie B");
  assert.equal(m.line(), "160");
  // A creature deselected and selected again starts marked again, even after it was unmarked.
  m.target("Zombie B");
  m = open([harvey, a, cecil, ghoul], { selectionChanged: true, body: m.body });
  m = open([harvey, a, cecil, ghoul, b], { selectionChanged: true, body: m.body });
  assert.equal(m.line(), "160");
  m.type(".rollbox-assist-against", "45"); // typing a number unmarks every target
  assert.equal(m.all(".rollbox-assist-is-target").length, 0);
  assert.equal(m.caption(), "STR against STR");
  m.target("Zombie A");
  assert.equal(m.line(), "80");
  m.target("Zombie A"); // no target left: the typed number again
  assert.equal(m.line(), "45");
});
test("a left-out character isn't counted and their target button does nothing; leaving everyone out says so", () => {
  setup();
  const m = open([person("Harvey", 20), person("Cecil", 40)]);
  m.type(".rollbox-assist-against", "30");
  m.leaveOut("Harvey");
  assert.equal(m.row("Harvey").classList.contains("rollbox-assist-out"), true);
  assert.deepEqual(m.outcome(), ["Assisting", "No one", "Rolling", "CecilSTR 40", "Regular STR40% one succeeds"]);
  m.target("Harvey");
  assert.equal(m.all(".rollbox-assist-is-target").length, 0);
  m.target("Cecil"); // Cecil is now the target: nobody is left to take part
  assert.equal(m.red(), "Include at least one more character.");
  assert.equal(m.sendDisabled(), true);
  m.leaveOut("Harvey"); // back in, against Cecil's 40
  assert.equal(m.line(), "40");
  assert.equal(m.red(), "");
  m.target("Cecil");
  m.type(".rollbox-assist-against", "400");
  assert.equal(m.red(), "Too heavy even together.");
  assert.equal(m.sendDisabled(), true);
});

test("one token: the red line asks for another and Send is greyed out; a new selection keeps what was typed", () => {
  setup();
  const harvey = person("Harvey", 20); const cecil = person("Cecil", 40);
  let m = open([harvey]);
  m.type(".rollbox-assist-against", "50");
  assert.equal(m.red(), "Select at least one more token.");
  assert.equal(m.sendDisabled(), true);
  m = open([harvey, cecil], { selectionChanged: true, body: m.body }); // shift-click a second token
  assert.equal(m.line(), "50");
  assert.equal(m.sendDisabled(), false);
  m = open([harvey, cecil]); // opened afresh: starts empty
  assert.equal(m.line(), "0");
});

test("the names list: ten rows before it scrolls, sized by its row height, not pixels", () => {
  setup();
  addStyles("mini-sheet/mini-sheet.css", "shared/shared.css", "assist/assist.css");
  const panel = document.createElement("div");
  panel.className = "rollbox-panel";
  document.body.append(panel);
  const m = open([person("Harvey", 20), person("Cecil", 40)], { body: panel });
  const style = (node) => document.defaultView.getComputedStyle(node);
  const list = style(m.body.querySelector(".rollbox-assist-names"));
  assert.notEqual(list.getPropertyValue("--rollbox-row-height"), "");
  assert.equal(list.maxHeight, "calc(10 * var(--rollbox-row-height) + 9 * var(--rollbox-row-gap))");
  assert.equal(style(m.row("Harvey")).height, "var(--rollbox-row-height)");
});

test("assistColumns: the Use value for participants and the Against value for targets", () => {
  setup();
  const zombie = person("Zombie", 80, { siz: 65, creature: true });
  const harvey = person("Harvey", 50, { siz: 70 });
  const m = open([harvey, zombie]);
  let [col] = assistColumns([harvey, zombie]);
  assert.deepEqual([col.label, col.value(harvey), col.value(zombie)], ["STR", 50, 80]);
  m.toggle("Against", "siz");
  [col] = assistColumns([harvey, zombie]);
  assert.deepEqual([col.label, col.value(harvey), col.value(zombie)], ["STR/SIZ", 50, 65]);
});

test("assistCardHtml: names and the label are escaped; no one helping is said so", () => {
  const html = assistCardHtml({ use: "siz", against: "str", label: "<b>hold</b>", left: 60, difficulty: "hard",
    helpers: [], rollers: ["A&B"] });
  assert.match(html, /&lt;b&gt;hold&lt;\/b&gt;/);
  assert.match(html, /SIZ against STR: 60 left, <b>Hard SIZ<\/b>/);
  assert.match(html, /Helping: no one\..*Rolling: A&amp;B\./);
});
