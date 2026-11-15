import assert from "node:assert/strict";
import { test } from "node:test";
import { registerItemMenu, renderItemMenu } from "../scripts/item-menu/index.js";
import { makeCoC7, makeDom, makeEnv, makeRollActor, resultText } from "./mocks.mjs";

const STATS = { str: 50, con: 60, siz: 65, dex: 55, app: 45, int: 70, pow: 40, edu: 75 };
const handgun = { name: "Firearms (Handgun)", value: 55, cocid: "i.skill.firearms-handgun" };

/** Keeper's client with CoC7, and a DOM for the flyout. */
function setup() {
  const env = makeEnv();
  const calls = makeCoC7();
  makeDom();
  return { env, calls };
}

const pc = (options = {}) => makeRollActor({ name: "Alice", owners: [game.users[1]], characteristics: STATS,
  luck: 45, san: 60, ...options });

/** The Item menu drawn for these characters, with helpers to use it like the Keeper. */
function open(actors) {
  const body = document.createElement("div");
  document.body.append(body); // jsdom fires change on click only when the input is in the document
  renderItemMenu(body, { actors });
  const all = (selector) => [...body.querySelectorAll(selector)];
  const row = (name) => all(".rollbox-item-row").find((node) => node.querySelector(".rollbox-item-name").textContent === name);
  const pick = (name) => row(name).querySelector("input").click();
  const press = (text) => all("button").find((node) => node.textContent === text).click();
  const type = (selector, value) => {
    const input = body.querySelector(selector);
    input.value = value;
    input.dispatchEvent(new document.defaultView.Event("input"));
  };
  const text = (selector) => body.querySelector(selector)?.textContent;
  const disabled = () => all(".rollbox-item-action").every((b) => b.disabled);
  /** A button of the Custom damage picker, which the Custom damage button opens. */
  const inPicker = (label) => [...body.querySelectorAll(".rollbox-dice button")].find((n) => n.textContent === label).click();
  const damage = () => body.querySelector(".rollbox-item-damage").value;
  return { body, all, row, pick, press, type, text, disabled, inPicker, damage };
}

/** Let send() finish: it awaits CoC7's lookups and ChatMessage.create. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 10));

test("registerItemMenu: only on the Keeper's client with the Rollbox switch on; draws only for one character", () => {
  makeEnv({ isGM: false });
  assert.equal(registerItemMenu(), false);
  makeEnv({ values: { rollboxEnabled: false } });
  assert.equal(registerItemMenu(), false);
  makeEnv({ values: { rollboxEnabled: true } });
  assert.equal(registerItemMenu(), true);
  setup();
  const m = open([pc(), pc({ name: "Bob" })]);
  assert.equal(m.body.children.length, 0);
});

test("a weapon: listed with its skill and values; sent as a labelled skill check with the options", async () => {
  const { env } = setup();
  const alice = pc({ skills: [handgun], weapons: [
    { id: "w1", name: ".38 Revolver", main: { id: "item0", name: "Firearms (Handgun)" } },
    { id: "w2", name: "Club", main: "" }] });
  const m = open([alice]);
  const revolver = m.row(".38 Revolver");
  assert.equal(revolver.querySelector(".rollbox-item-skill").textContent, "Firearms (Handgun)");
  assert.equal(revolver.querySelector(".rollbox-item-values").textContent, "55 · 27 · 11");
  assert.equal(m.row("Club").querySelector("input").disabled, true); // no skill set on its sheet
  assert.equal(m.disabled(), true); // greyed out until a weapon is picked, with the status line saying so
  assert.equal(m.text(".rollbox-status"), "Pick a weapon, or an improvised weapon.");
  m.pick(".38 Revolver");
  assert.equal(m.disabled(), false);
  m.press("Hard"); m.press("+1");
  m.body.querySelector(".rollbox-blind").click();
  assert.equal(m.body.querySelector(".rollbox-status").hidden, true); // no summary of what will be sent
  m.press("Request from player"); await settle();
  assert.deepEqual(env.chat[0].whisper, ["p1"]);
  assert.match(env.chat[0].content,
    /name:i\.skill\.firearms-handgun,difficulty:2,poolModifier:1,blind\]\{Firearms \(Handgun\) with the \.38 Revolver\}/);
  assert.deepEqual(resultText(m.body.querySelector(".rollbox-result")), ["Item check sent to:", "Alice"]);
});

test("improvised weapon without damage: Fighting (Brawl) by default, labelled with the object, no damage roll", async () => {
  const { env } = setup();
  const m = open([pc()]);
  m.pick("+ Improvised weapon");
  assert.equal(m.disabled(), true); // what it is not typed yet
  assert.equal(m.text(".rollbox-status"), "Type what the improvised weapon is.");
  m.type(".rollbox-item-what", "Candlestick");
  assert.equal(m.text(".rollbox-item-chosen .rollbox-item-values"), "25 · 12 · 5"); // base value, not on the sheet
  m.press("Request from player"); await settle();
  assert.match(env.chat[0].content, /name:i\.skill\.fighting-brawl,difficulty:1,blind:false\]\{Fighting \(Brawl\) with Candlestick\} roll\.$/);
});

test("improvised weapon with damage: picked dice and +DB go in the message, the damage bonus filled in", async () => {
  const { env } = setup();
  const m = open([pc({ db: "1D4" })]);
  m.pick("+ Improvised weapon");
  m.type(".rollbox-item-what", "Candlestick");
  m.type(".rollbox-item-damage", "1D6]]");
  assert.equal(m.disabled(), true); // not a damage roll
  assert.match(m.text(".rollbox-status"), /^Damage is dice/);
  m.press("Custom damage");
  m.inPicker("D6"); m.inPicker("+DB");
  assert.equal(m.disabled(), false);
  m.press("Send to chat"); await settle();
  assert.equal("whisper" in env.chat[0], false);
  assert.match(env.chat[0].content, /\{Fighting \(Brawl\) with Candlestick\} roll\.<br>Damage: \[\[\/r 1D6\+1D4 # Candlestick damage\]\]$/);
});

test("damage quick-picks fill the damage line, which the Keeper can still change", async () => {
  const { env } = setup();
  const m = open([pc({ db: "1D4" })]);
  m.pick("+ Improvised weapon");
  m.type(".rollbox-item-what", "Candlestick");
  assert.deepEqual(m.all(".rollbox-item-quick button").map((n) => n.textContent),
    ["None", "1D3+DB", "1D4+DB", "1D6+DB", "1D8+DB", "1D10+DB"]);
  m.press("1D6+DB");
  assert.equal(m.damage(), "1D6+DB");
  m.press("Custom damage");
  m.inPicker("D8");
  m.press("Send to chat"); await settle();
  assert.match(env.chat[0].content, /\[\[\/r 1D8\+1D4 # Candlestick damage\]\]$/);
});

test("Throw: the damage bonus is halved, on the toggle (+½DB), the quick-picks and the roll", async () => {
  const { env } = setup();
  const m = open([pc({ db: "1D4" })]);
  m.pick("+ Improvised weapon");
  m.type(".rollbox-item-what", "Rock");
  m.press("1D6+DB");
  m.press("Throw");
  assert.equal(m.damage(), "1D6+½DB"); // the line's damage bonus is halved too
  assert.equal(m.text(".rollbox-dice-db"), "+½DB");
  m.press("1D4+½DB");
  assert.equal(m.damage(), "1D4+½DB");
  m.press("Send to chat"); await settle();
  assert.match(env.chat[0].content, /\{Throw with Rock\} roll\.<br>Damage: \[\[\/r 1D4\+1D2 # Rock damage\]\]$/);
});

test("Simplified dice UI: only the damage line, no quick-picks or Custom damage; typed DB or 1/2DB is accepted", async () => {
  const { env } = setup();
  env.values.rollboxSimplifiedDice = true;
  const m = open([pc({ db: "1D4" })]);
  m.pick("+ Improvised weapon");
  m.type(".rollbox-item-what", "Rock");
  assert.equal(m.body.querySelector(".rollbox-dice-custom").hidden, true);
  assert.equal(m.body.querySelector(".rollbox-item-quick").hidden, true);
  m.press("Throw");
  m.type(".rollbox-item-damage", "1d6+db");
  assert.equal(m.disabled(), false);
  m.type(".rollbox-item-damage", "1d6+1/2db");
  m.press("Send to chat"); await settle();
  assert.match(env.chat[0].content, /\[\[\/r 1D6\+1D2 # Rock damage\]\]$/);
});

test("a weapon with two skills: one row per skill, each sent with its own skill", async () => {
  const { env } = setup();
  const alice = pc({ weapons: [{ id: "w1", name: "Knife", main: "Fighting (Brawl)", alt: "Throw", usesAlternativeSkill: true }] });
  const m = open([alice]);
  const knives = m.all(".rollbox-item-row").filter((node) => node.querySelector(".rollbox-item-name").textContent === "Knife");
  assert.deepEqual(knives.map((node) => node.querySelector(".rollbox-item-skill").textContent), ["Fighting (Brawl)", "Throw"]);
  for (const node of knives) {
    node.querySelector("input").click();
    m.press("Request from player"); await settle();
  }
  assert.match(env.chat[0].content, /\{Fighting \(Brawl\) with the Knife\}/);
  assert.match(env.chat[1].content, /\{Throw with the Knife\}/);
});

test("improvised weapon, Other…: nothing can be sent until a skill is picked", async () => {
  const { env } = setup();
  const m = open([pc()]);
  m.pick("+ Improvised weapon");
  m.type(".rollbox-item-what", "Rope");
  m.press("Other…");
  assert.equal(m.disabled(), true);
  assert.equal(m.text(".rollbox-status"), "Pick the skill it uses.");
  const select = m.body.querySelector(".rollbox-item-other");
  select.value = [...select.options].find((o) => o.textContent.startsWith("Climb")).value;
  select.dispatchEvent(new document.defaultView.Event("change"));
  m.press("Request from player"); await settle();
  assert.match(env.chat[0].content, /name:i\.skill\.climb,.*\{Climb with Rope\}/);
});

test("a character with no weapons: says so, and offers only the improvised weapon", () => {
  setup();
  const m = open([pc()]);
  assert.equal(m.text(".rollbox-item-list .rollbox-item-hint"), "No weapons on Alice's sheet.");
  assert.deepEqual(m.all(".rollbox-item-row").map((node) => node.dataset.pick), ["improvised"]);
});
