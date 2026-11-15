import assert from "node:assert/strict";
import { test } from "node:test";
import { registerCheckMenu, renderCheckMenu } from "../scripts/check-menu/index.js";
import { makeCoC7, makeDom, makeEnv, makeRollActor, resultText } from "./mocks.mjs";

const STATS = { str: 50, con: 60, siz: 65, dex: 55, app: 45, int: 70, pow: 40, edu: 75 };
const spot = { name: "Spot Hidden", value: 60, cocid: "i.skill.spot-hidden" };
const listen = { name: "Listen", value: 40, cocid: "i.skill.listen" };

/** Keeper's client with CoC7, and a DOM for the flyout. */
function setup(env = {}) {
  const e = makeEnv(env);
  const calls = makeCoC7();
  makeDom();
  return { env: e, calls };
}

const pc = (options = {}) => makeRollActor({ name: "Alice", owners: [game.users[1]], characteristics: STATS,
  luck: 45, san: 60, ...options });
const npc = (options = {}) => makeRollActor({ name: "Guard", type: "npc", owners: [], characteristics: STATS,
  luck: 30, san: 40, ...options });

/** The Check menu drawn for these characters, with helpers to use it like the Keeper. */
function open(actors, start) {
  const body = document.createElement("div");
  document.body.append(body); // jsdom fires a checkbox's change on click only when it is in the document
  const controller = renderCheckMenu(body, { actors, start });
  const all = (selector) => [...body.querySelectorAll(selector)];
  const byText = (selector, text) => all(selector).find((node) => node.textContent === text);
  const row = (name) => all(".rollbox-check-row").find((node) => node.querySelector(".rollbox-check-name").textContent === name);
  const tick = (name) => {
    const box = row(name).querySelector("input");
    box.checked = !box.checked;
    box.dispatchEvent(new document.defaultView.Event("change"));
  };
  const press = (text) => byText("button", text).click();
  const tab = (text) => press(text);
  const type = (selector, value) => {
    const input = body.querySelector(selector);
    input.value = value;
    input.dispatchEvent(new document.defaultView.Event("input"));
  };
  const visibleNames = (tabId) => all(`.rollbox-check-panel[data-tab="${tabId}"] .rollbox-check-row:not([hidden])`)
    .map((node) => node.querySelector(".rollbox-check-name").textContent);
  const text = (selector) => body.querySelector(selector)?.textContent;
  const blind = () => body.querySelector(".rollbox-blind");
  const copyLink = () => body.querySelector(".rollbox-check-link").click();
  const sendsDisabled = () => all(".rollbox-check-action").every((node) => node.disabled);
  const result = () => resultText(body.querySelector(".rollbox-result"));
  const ticked = () => all(".rollbox-check-row input:checked").map((box) => box.closest(".rollbox-check-row")
    .querySelector(".rollbox-check-name").textContent);
  return { body, all, row, tick, press, tab, type, visibleNames, text, blind, copyLink, sendsDisabled, result, ticked,
    controller };
}

/** Let send() finish: it awaits CoC7's lookups and ChatMessage.create. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 10));

test("registerCheckMenu: only on the Keeper's client with the Rollbox switch on", () => {
  makeEnv({ isGM: false });
  assert.equal(registerCheckMenu(), false);
  makeEnv({ values: { rollboxEnabled: false } });
  assert.equal(registerCheckMenu(), false);
  const env = makeEnv({ values: { rollboxEnabled: true } });
  assert.equal(registerCheckMenu(), true);
  assert.deepEqual(env.reads, ["rollboxEnabled"]);
});

test("one character: two tabs (no Attribute), values, trained skills first, a divider, the rest at base value; search filters", () => {
  setup();
  const m = open([pc({ skills: [spot, { name: "Climb", value: 20, cocid: "i.skill.climb" }] })]);
  assert.deepEqual(m.all(".rollbox-check-tab").map((n) => n.textContent), ["Characteristic", "Skill"]);
  assert.equal(m.row("STR").querySelector(".rollbox-check-values").textContent, "50 · 25 · 10");
  assert.equal(m.row("Luck"), undefined);
  const skillList = m.all('.rollbox-check-panel[data-tab="skill"] .rollbox-check-list > :not(.rollbox-check-add)');
  assert.equal(skillList[0].textContent.startsWith("Spot Hidden"), true);
  assert.ok(skillList[1].classList.contains("rollbox-check-divider"));
  assert.equal(m.row("Climb").querySelector(".rollbox-check-values").textContent, "20 · 10 · 4");
  assert.equal(m.row("Dodge").querySelector(".rollbox-check-values").textContent, "27 · 13 · 5"); // half DEX
  m.type(".rollbox-check-search", "spot");
  assert.deepEqual(m.visibleNames("skill"), ["Spot Hidden"]);
});

test("one check: greyed out with the status line in red until a check is ticked, then no line; Request from player whispers it", async () => {
  const { env } = setup();
  const alice = pc({ skills: [spot] });
  const m = open([alice]);
  assert.equal(m.sendsDisabled(), true);
  assert.equal(m.text(".rollbox-status"), "Tick a check to request it.");
  assert.ok(m.body.querySelector(".rollbox-status").classList.contains("rollbox-status-missing"));
  m.tick("Spot Hidden");
  assert.equal(m.sendsDisabled(), false);
  assert.equal(m.body.querySelector(".rollbox-status").hidden, true); // no summary of what will be sent
  m.press("Request from player");
  await settle();
  assert.equal(env.chat.length, 1);
  assert.deepEqual(env.chat[0].whisper, ["p1"]);
  assert.match(env.chat[0].content, /@coc7\.check\[subtype:skill,name:i\.skill\.spot-hidden,difficulty:1,blind:false\]/);
  assert.deepEqual(m.result(), ["Check sent to:", "Alice"]);
});

test("combined: ticks persist across tabs; two ticks offer All / Any and turn Blind off", async () => {
  const { env } = setup();
  const m = open([pc({ skills: [spot, listen] })]);
  m.tab("Skill"); m.tick("Spot Hidden");
  m.blind().click(); // blind while one check
  m.tab("Characteristic"); m.tick("POW");
  assert.equal(m.body.querySelector(".rollbox-check-combined").hidden, false);
  assert.equal(m.blind().disabled, true);
  assert.equal(m.blind().getAttribute("aria-pressed"), "false");
  m.press("Request from player"); await settle();
  assert.match(env.chat[0].content, /subtype:combinedall,rolls:skill#i\.skill\.spot-hidden#1&&characteristic#pow#1,blind:false\]/);
  m.press("Any one");
  m.press("Request from player"); await settle();
  assert.match(env.chat[1].content, /subtype:combinedany,/);
});

test("options: difficulty, dice, the Blind toggle and label go into the request; Blind clicks on and off", async () => {
  const { env } = setup();
  const m = open([pc({ skills: [spot] })]);
  m.tick("Spot Hidden");
  m.press("Extreme"); m.press("−2");
  m.blind().click();
  assert.equal(m.blind().getAttribute("aria-pressed"), "true");
  m.type(".rollbox-check-label-input", "notice the knife");
  m.press("Request from player"); await settle();
  assert.match(env.chat[0].content, /difficulty:3,poolModifier:-2,blind\]\{Extreme Spot Hidden · notice the knife\}/);
  m.press("Hard"); m.press("+1");
  m.press("Request from player"); await settle();
  assert.match(env.chat[1].content, /difficulty:2,poolModifier:1,blind\]/);
  m.blind().click();
  m.press("Request from player"); await settle();
  assert.match(env.chat[2].content, /blind:false\]/);
});

test("several characters: skills A–Z without values; Send to each (N); players asked, the NPC rolled", async () => {
  const { env } = setup();
  const alice = pc({ skills: [{ name: "Language (Latin)", value: 30 }] });
  const bob = pc({ name: "Bob", owners: [game.users[2]] });
  const guard = npc();
  const m = open([alice, bob, guard]);
  assert.equal(m.body.querySelector(".rollbox-check-values"), null);
  assert.equal(m.body.querySelector(".rollbox-check-divider"), null);
  const names = m.visibleNames("skill");
  assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b)));
  assert.ok(names.includes("Language (Latin)")); // a specialisation one of them has
  m.tick("DEX");
  m.press("Send to each (3)"); await settle();
  assert.deepEqual(env.chat.map((c) => c.whisper), [["p1"], ["p2"]]);
  assert.equal(guard.calls[0][0], "characteristicCheck");
  assert.deepEqual(m.result(), ["Check sent to:", "Alice", "Bob", "Rolled for you:", "Guard"]);
});

test("main button: \"Roll for NPC(s)\" when every character is an NPC; with a player character, as before", async () => {
  setup();
  const words = (actors) => open(actors).body.querySelector(".rollbox-primary").textContent;
  assert.equal(words([npc()]), "Roll for NPC");
  assert.equal(words([npc(), npc({ name: "Thug", uuid: "Actor.Thug" })]), "Roll for NPCs");
  assert.equal(words([pc()]), "Request from player");
  assert.equal(words([pc(), npc()]), "Send to each (2)");
});

test("+ Add: a search that matches no listed skill offers the typed name; a specialisation gets its group base, otherwise a value is asked", async () => {
  setup();
  const guard = npc();
  const m = open([guard]);
  const addRow = () => m.body.querySelector(".rollbox-check-add");
  m.type(".rollbox-check-search", "spot");
  assert.equal(addRow().hidden, true); // Spot Hidden is listed
  const other = (name) => { m.type(".rollbox-check-search", name); addRow().click(); };
  m.type(".rollbox-check-search", "Pilot (Boat)");
  assert.equal(addRow().hidden, false);
  assert.equal(addRow().textContent, "+ Add Pilot (Boat)1 · 0 · 0");
  addRow().click();
  assert.equal(m.body.querySelector(".rollbox-check-search").value, ""); // the whole list is back
  assert.equal(m.row("Pilot (Boat)").querySelector(".rollbox-check-values").textContent, "base 1");
  m.press("Roll for NPC"); await settle();
  assert.equal(guard.calls[0][1].threshold, 1);
  m.tick("Pilot (Boat)");
  other("Basket Weaving");
  const ask = m.body.querySelector(".rollbox-check-ask");
  assert.equal(ask.hidden, false);
  ask.querySelector("input").value = "35";
  ask.querySelector("button").click();
  m.press("Roll for NPC"); await settle();
  assert.equal(guard.calls[1][1].threshold, 35);
});

test("Send to chat posts publicly; Copy link copies and sends nothing", async () => {
  const { env, calls } = setup();
  const m = open([pc()]);
  m.tick("INT"); m.type(".rollbox-check-label-input", "Idea");
  m.press("Send to chat"); await settle();
  assert.equal("whisper" in env.chat[0], false);
  assert.match(env.chat[0].content, /name:int,.*\{INT · Idea\}/);
  m.copyLink(); await settle();
  assert.equal(calls.copied.length, 1);
  assert.equal(env.chat.length, 1);
  assert.deepEqual(m.result(), ["Link copied."]);
});

test("started from the mini sheet: only that characteristic ticked; again while open switches it, keeping the options", () => {
  setup();
  const m = open([pc({ skills: [spot] })], { tick: "characteristic:str" });
  assert.deepEqual(m.ticked(), ["STR"]);
  m.tab("Skill"); m.tick("Spot Hidden"); m.press("Hard");
  m.controller.apply({ tick: "characteristic:int" });
  assert.deepEqual(m.ticked(), ["INT"]);
  assert.equal(m.body.querySelector(".rollbox-check-panel[data-tab=\"characteristic\"]").hidden, false);
  assert.equal(m.all("[aria-pressed=\"true\"]").some((b) => b.textContent === "Hard"), true);
});

test("started from the mini sheet: add keeps the ticks (combined); plain sends a Regular check at once, or copies its link", async () => {
  const { env, calls } = setup();
  const m = open([pc()], { tick: "characteristic:str" });
  m.press("Hard"); m.type(".rollbox-check-label-input", "lift it");
  m.controller.apply({ tick: "characteristic:con", add: true });
  assert.deepEqual(m.ticked(), ["STR", "CON"]);
  m.controller.apply({ tick: "characteristic:dex", plain: true, send: "whisper" }); await settle();
  assert.deepEqual(m.ticked(), ["DEX"]);
  assert.match(env.chat[0].content, /name:dex,difficulty:1,/);
  assert.doesNotMatch(env.chat[0].content, /lift it/);
  m.controller.apply({ tick: "characteristic:app", plain: true, send: "link" }); await settle();
  assert.match(calls.copied[0], /name:app,difficulty:1/);
  assert.deepEqual(m.result(), ["Link copied."]);
});
