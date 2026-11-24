import assert from "node:assert/strict";
import { test } from "node:test";
import { otherColumns, registerOtherFlyout, renderOtherFlyout, tabsFor } from "../scripts/flyouts/other/index.js";
import { makeCoC7, makeDom, makeEnv, makeRollActor, resultText } from "./mocks.mjs";

const STATS = { str: 50, con: 60, siz: 65, dex: 55, app: 45, int: 70, pow: 40, edu: 75 };
const handgun = { name: "Firearms (Handgun)", value: 55, cocid: "i.skill.firearms-handgun" };

/** Keeper's client (or a player's) with CoC7, and a DOM for the flyout; registering forgets the last tab used. */
function setup({ isGM = true, values = {} } = {}) {
  const env = makeEnv({ values: { rollboxEnabled: true } });
  registerOtherFlyout();
  if (!isGM) makeEnv({ isGM, values: { rollboxEnabled: true, ...values } });
  const calls = makeCoC7();
  makeDom();
  return { env, calls };
}

const pc = (options = {}) => makeRollActor({ name: "Alice", owners: [game.users[1]], characteristics: STATS,
  luck: 45, san: 60, ...options });

/**
 * The Other flyout drawn for these characters (one opens on Item, two or more on Luck), with helpers to use it like the
 * Keeper. `title()` is the flyout's title the flyout set.
 */
function open(actors, start, context = {}) {
  const body = document.createElement("div");
  document.body.append(body); // jsdom fires change on click only when the input is in the document
  let heading = "";
  const controller = renderOtherFlyout(body, { actors, start, setTitle: (text) => { heading = text; }, ...context });
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
  const tabs = () => all(".rollbox-other-tab").map((n) => [n.textContent, n.disabled, n.getAttribute("aria-selected")]);
  const sendsDisabled = () => all(".rollbox-other-action").every((b) => b.disabled);
  const result = () => resultText(body.querySelector(".rollbox-result"));
  /** The one send button (Send to <name>, Send to each (N), Roll for NPC…). */
  const send = () => body.querySelector(".rollbox-primary").click();
  return { body, all, row, pick, press, type, text, disabled, inPicker, damage, tabs, sendsDisabled, result, controller, send,
    title: () => heading };
}

/** Let send() finish: it awaits CoC7's lookups and ChatMessage.create. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 10));

test("registerOtherFlyout: only on the Keeper's client with the Rollbox switch on", () => {
  makeEnv({ isGM: false });
  assert.equal(registerOtherFlyout(), false);
  makeEnv({ values: { rollboxEnabled: false } });
  assert.equal(registerOtherFlyout(), false);
  makeEnv({ values: { rollboxEnabled: true } });
  assert.equal(registerOtherFlyout(), true);
});

test("tabs: Item · Luck · Assist; one character opens on Item, Assist never greyed (it offers Add a character); two or more on Luck with Item greyed out", () => {
  setup();
  let m = open([pc()]);
  assert.deepEqual(m.tabs(), [["Item", false, "true"], ["Luck", false, "false"], ["Assist", false, "false"]]);
  m.press("Assist");
  assert.equal(m.all(".rollbox-assist-add").length, 1);
  m.press("Item");
  assert.equal(m.title(), "Item check");
  m.press("Luck");
  assert.equal(m.title(), "Luck check");
  assert.equal(m.body.querySelector(".rollbox-item-list"), null);
  setup();
  m = open([pc(), pc({ name: "Bob" })]);
  assert.deepEqual(m.tabs(), [["Item", true, "false"], ["Luck", false, "true"], ["Assist", false, "false"]]);
  assert.equal(m.body.querySelector(".rollbox-item-list"), null);
});

test("Assist tab: the Assist flyout inside Other, with its own title and the character cards' Assist column", () => {
  setup();
  const alice = pc(); const bob = pc({ name: "Bob" });
  const m = open([alice, bob]);
  assert.equal(otherColumns([alice, bob]), null); // Luck: the cards' own columns
  m.press("Assist");
  assert.equal(m.title(), "Assist");
  assert.equal(m.all(".rollbox-assist-row").length, 2);
  assert.equal(otherColumns([alice, bob])[0].label, "STR");
});

test("last tab used: Other opens on it again and keeps it while the selection changes, falling back while it can't be used", () => {
  setup();
  const alice = pc(); const bob = pc({ name: "Bob" });
  open([alice, bob]).press("Assist");
  let m = open([alice, bob]); // opened again
  assert.equal(m.title(), "Assist");
  m = open([alice], undefined, { selectionChanged: true }); // Assist with one: it stays, saying what it needs
  assert.equal(m.title(), "Assist");
  m.press("Item");
  assert.equal(m.title(), "Item check");
  m = open([alice, bob], undefined, { selectionChanged: true }); // Item needs one: Luck instead
  assert.equal(m.title(), "Luck check");
  m.press("Item"); // greyed out: nothing changes
  assert.equal(m.title(), "Luck check");
});

test("a player's tabs: Opposed · Assist (no Luck: the Keeper's), each only when the Keeper allows it; none allowed draws nothing", () => {
  setup({ isGM: false, values: { rollboxPlayerRollbox: false } });
  assert.deepEqual(tabsFor(game.user, (feature) => feature !== "assist").map((tab) => tab.label), ["Opposed"]);
  assert.deepEqual(tabsFor(game.user, () => true).map((tab) => tab.label), ["Opposed", "Assist"]);
  const m = open([pc()]); // canUse is false until the player Rollbox is built
  assert.equal(m.controller, undefined);
  assert.equal(m.body.childElementCount, 0);
});

test("a player's Opposed: the opponent is picked by targeting a token; cancelling the target changes nothing", async () => {
  setup({ isGM: false });
  const guard = pc({ name: "Guard", owners: [] });
  let target = null;
  const m = open([pc()], undefined, { allowed: (f) => f === "opposed", pickTarget: async () => target });
  assert.equal(m.title(), "Opposed roll");
  assert.match(m.text(".rollbox-opposed-waiting"), /target/i);
  m.press("Target your opponent"); await settle(); // cancelled
  assert.equal(m.all(".rollbox-opposed-name").length, 1);
  target = { actor: guard };
  m.press("Target your opponent"); await settle();
  assert.deepEqual(m.all(".rollbox-opposed-name").map((n) => n.textContent), ["Alice", "Guard"]);
});

test("a player's Assist: one button, Target who you're helping; their own character can't be helped", async () => {
  setup({ isGM: false });
  game.actors = [];
  const own = pc();
  const m = open([own], undefined, { allowed: (f) => f === "assist", pickTarget: async () => ({ actor: own }) });
  assert.equal(m.all(".rollbox-assist-row").length, 0); // no characters list, number or Use/Against
  m.press("Target who you're helping"); await settle();
  assert.match(m.text(".rollbox-assist-player-note"), /yourself/i);
});

test("Luck: CoC7's Luck check to each with the options and label; an NPC rolled for the Keeper", async () => {
  const { env } = setup();
  const guard = makeRollActor({ name: "Guard", owners: [], characteristics: STATS, luck: 30 });
  const m = open([pc(), guard]);
  assert.deepEqual(m.all(".rollbox-other-luck-row").map((n) => n.textContent), ["AliceLuck 45", "GuardLuck 30"]);
  m.press("Hard"); m.type(".rollbox-other-label", "is the cab there?");
  m.press("Send to each (2)"); await settle();
  assert.match(env.chat[0].content, /subtype:attribute,name:lck,difficulty:2,.*\{Hard Luck · is the cab there\?\}/);
  assert.deepEqual(guard.calls.map((c) => c.slice(0, 2)), [["attributeCheck", "lck"]]);
  assert.deepEqual(m.result(), ["Luck check sent to:", "Alice", "Rolled for you:", "Guard"]);
});

test("Luck for a sheet without Luck (a creature): greyed, \"No Luck on this sheet.\"; with others it is left out", async () => {
  const { env } = setup();
  const deepOne = makeRollActor({ name: "Deep One", type: "creature", owners: [], characteristics: STATS });
  let m = open([deepOne]);
  m.body.querySelector(".rollbox-other-tab[data-section=luck]").click();
  assert.equal(m.sendsDisabled(), true);
  assert.match(m.text(".rollbox-status"), /no luck/i);
  assert.equal(m.text(".rollbox-other-luck-none .rollbox-other-luck-value"), "No Luck");
  m = open([pc(), deepOne]);
  m.send(); await settle();
  assert.equal(env.chat.length, 1);
  assert.deepEqual(deepOne.calls, []);
});

test("group Luck roll: only the lowest Luck is asked; a tie asks the Keeper to pick", async () => {
  const { env } = setup();
  const alice = pc({ luck: 45 }); const bob = pc({ name: "Bob", owners: [game.users[2]], luck: 35 });
  let m = open([alice, bob]);
  m.body.querySelector(".rollbox-other-group input").click();
  m.send(); await settle();
  assert.equal(env.chat.length, 1);
  assert.match(env.chat[0].content, /requested Bob make/);

  const carol = pc({ name: "Carol", luck: 35, uuid: "Actor.Carol" });
  m = open([alice, bob, carol]);
  m.body.querySelector(".rollbox-other-group input").click();
  assert.equal(m.sendsDisabled(), true); // a tie: nobody picked yet
  assert.match(m.text(".rollbox-status"), /who rolls/i);
  m.press("Carol");
  m.send(); await settle();
  assert.match(env.chat[1].content, /requested Carol make/);
  assert.equal(env.chat.length, 2);
});

test("started from the character sheet's Luck: opens on Luck; plain sends a Regular Luck check at once", async () => {
  const { env } = setup();
  const m = open([pc()], { section: "luck" });
  assert.equal(m.title(), "Luck check");
  m.press("Extreme");
  m.controller.apply({ section: "luck", plain: true, send: true }); await settle();
  assert.match(env.chat[0].content, /name:lck,difficulty:1,/);
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
  assert.match(m.text(".rollbox-status"), /weapon/i);
  m.pick(".38 Revolver");
  assert.equal(m.disabled(), false);
  m.press("Hard"); m.press("+1");
  m.body.querySelector(".rollbox-blind").click();
  assert.equal(m.body.querySelector(".rollbox-status").hidden, true); // no summary of what will be sent
  m.send(); await settle();
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
  assert.match(m.text(".rollbox-status"), /improvised/i);
  m.type(".rollbox-item-what", "Candlestick");
  assert.equal(m.text(".rollbox-item-chosen .rollbox-item-values"), "25 · 12 · 5"); // base value, not on the sheet
  m.send(); await settle();
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
  m.send(); await settle();
  assert.deepEqual(env.chat[0].whisper, ["p1"]);
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
  m.send(); await settle();
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
  m.send(); await settle();
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
  m.send(); await settle();
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
    m.send(); await settle();
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
  assert.match(m.text(".rollbox-status"), /skill/i);
  const select = m.body.querySelector(".rollbox-item-other");
  select.value = [...select.options].find((o) => o.textContent.startsWith("Climb")).value;
  select.dispatchEvent(new document.defaultView.Event("change"));
  m.send(); await settle();
  assert.match(env.chat[0].content, /name:i\.skill\.climb,.*\{Climb with Rope\}/);
});

test("a character with no weapons: says so, and offers only the improvised weapon", () => {
  setup();
  const m = open([pc()]);
  assert.match(m.text(".rollbox-item-list .rollbox-item-hint"), /no weapons/i);
  assert.deepEqual(m.all(".rollbox-item-row").map((node) => node.dataset.pick), ["improvised"]);
});

