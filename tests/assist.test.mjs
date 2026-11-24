import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assistCardHtml, assistChoices, assistColumns, assistGroupChanged, renderAssist
} from "../scripts/flyouts/other/assist.js";
import {
  helpersInGroup, joinForPlayer, leaveForPlayer, onRollerCard, standing
} from "../scripts/flyouts/other/assist-group.js";
import { makeCoC7, makeDom, makeEnv, makeRollActor, resultText } from "./mocks.mjs";

/** The rulebook's rafter (Keeper Rulebook p. 88–89): SIZ 150 against five investigators' STR. */
const RAFTER = [["Belinda", 75], ["Harvey", 20], ["Helen", 60], ["Cecil", 40], ["Martin", 45]]
  .map(([name, value]) => ({ name, value }));
const names = (list) => list.map((c) => c.name);

// --- The maths ---------------------------------------------------------------------------------

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

test("assistChoices: equal values keep the character-card order; equal chances go to fewer helpers", () => {
  // Cy 30 and the first of the two 50s help (20 left, Regular); the other 50 rolls.
  assert.deepEqual(names(assistChoices([{ name: "Ann", value: 50 }, { name: "Cy", value: 30 }, { name: "Bea", value: 50 }], 100).helpers),
    ["Cy", "Ann"]);
  assert.deepEqual(names(assistChoices([{ name: "Bea", value: 50 }, { name: "Cy", value: 30 }, { name: "Ann", value: 50 }], 100).helpers),
    ["Cy", "Bea"]);
  // Bea at 100 succeeds for sure with or without Ann's help: nobody helps.
  assert.deepEqual(names(assistChoices([{ name: "Ann", value: 30 }, { name: "Bea", value: 100 }], 45).helpers), []);
});

// --- The flyout ----------------------------------------------------------------------------------

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

/** The Assist flyout drawn for these characters, with helpers to use it like the Keeper. */
function open(actors, { selectionChanged = false, body = null, pickTarget } = {}) {
  const root = body ?? document.createElement("div");
  root.replaceChildren();
  document.body.append(root);
  let closed = false;
  renderAssist(root, { actors, selectionChanged, close: () => { closed = true; }, pickTarget });
  const all = (selector) => [...root.querySelectorAll(selector)];
  const press = (text) => all("button").find((node) => node.textContent === text).click();
  const toggle = (group, stat) => root.querySelector(`[aria-label="${group}"] [data-value="${stat}"]`).click();
  const row = (name) => all(".rollbox-assist-row").find((r) => r.querySelector(".rollbox-assist-name-who").textContent === name);
  const target = (name) => row(name).querySelector(".rollbox-assist-target").click();
  const remove = (name) => row(name).querySelector(".rollbox-assist-remove").click();
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
  return { body: root, all, press, toggle, row, target, remove, type, text, line, caption, outcome, red,
    sendDisabled, closed: () => closed };
}

/** Let send() finish: it awaits ChatMessage.create and CoC7's actor methods. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 10));

test("the rafter: Assisting, Rolling and the result line; Send asks the rollers at Regular STR with the label and posts the card",
  async () => {
  const { env } = setup();
  const [belinda, harvey, helen, cecil, martin] = [person("Belinda", 75, { npc: true }), person("Harvey", 20),
    person("Helen", 60), person("Cecil", 40), person("Martin", 45)];
  const m = open([belinda, harvey, helen, cecil, martin]);
  assert.equal(m.sendDisabled(), true); // nothing to beat yet
  assert.match(m.red(), /STR to beat/);
  m.toggle("Against", "siz");
  m.type(".rollbox-assist-against", "150");
  m.type(".rollbox-assist-label", "lift the rafter");
  assert.equal(m.caption(), "STR against SIZ");
  assert.deepEqual(m.outcome(), ["Assisting", "Harvey−20", "Cecil−40", "Martin−45", "Rolling", "HelenSTR 60",
    "BelindaSTR 75", "Regular STR90% one succeeds"]);
  assert.equal(m.red(), "");
  m.press("Send to each (2)"); await settle(); // the rollers: Helen and Belinda
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
  m.press("Send to each (2)"); await settle();
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
test("✕ takes a character out of the assist; with only a target left, nobody takes part", () => {
  setup();
  const m = open([person("Harvey", 20), person("Cecil", 40), person("Ann", 30)]);
  m.type(".rollbox-assist-against", "30");
  m.remove("Harvey");
  assert.equal(m.row("Harvey"), undefined);
  assert.deepEqual(m.outcome(), ["Assisting", "No one", "Rolling", "AnnSTR 30", "CecilSTR 40", "Regular STR58% one succeeds"]);
  m.remove("Ann");
  m.target("Cecil"); // Cecil is now the target: nobody is left to take part
  assert.match(m.red(), /one more/);
  assert.equal(m.sendDisabled(), true);
  m.target("Cecil");
  m.type(".rollbox-assist-against", "400");
  assert.match(m.red(), /too heavy/i);
});

test("nothing selected: Add a character picks one with the target picker; one character against a typed value is enough",
  async () => {
  const { env } = setup();
  const cecil = person("Cecil", 40);
  cecil.system.characteristics.con = { value: 55 };
  let m = open([], { pickTarget: async () => ({ actor: cecil }) });
  assert.match(m.red(), /STR to beat/);
  m.press("Add a character"); await settle();
  m = { ...m, ...open([], { selectionChanged: true, body: m.body, pickTarget: async () => null }) };
  assert.equal(m.row("Cecil").querySelector(".rollbox-assist-name-value").textContent, "40");
  // Fist of Yog-Sothoth: Use CON, typed 57 against STR: a Hard CON check to Cecil.
  m.toggle("Use", "con");
  m.type(".rollbox-assist-against", "57");
  assert.deepEqual(m.outcome(), ["Assisting", "No one", "Rolling", "CecilCON 55", "Hard CON27% one succeeds"]);
  m.press("Send to Cecil"); await settle();
  assert.match(env.chat[0].content, /name:con,difficulty:2/);
});

test("a new selection keeps what was typed; opened afresh it starts empty", () => {
  setup();
  const harvey = person("Harvey", 20); const cecil = person("Cecil", 40);
  let m = open([harvey, cecil]);
  m.type(".rollbox-assist-against", "50");
  m = open([harvey], { selectionChanged: true, body: m.body }); // one deselected
  assert.equal(m.all(".rollbox-assist-add").length, 1);
  m = open([harvey, cecil], { selectionChanged: true, body: m.body }); // shift-click a second token
  assert.equal(m.line(), "50");
  assert.equal(m.sendDisabled(), false);
  m = open([harvey, cecil]); // opened afresh: starts empty
  assert.equal(m.line(), "0");
});

test("assistGroupChanged: redraws only for Rollbox's own group flag, set or removed, not for text that merely holds its name",
  () => {
    setup();
    open([person("Harvey", 20)]);
    assert.equal(assistGroupChanged(null, { flags: { other: { note: "assistGroup" } } }), false);
    assert.equal(assistGroupChanged(null, { flags: { "keepers-rollbox": { assistGroupOld: 1 } } }), false);
    assert.equal(assistGroupChanged(null, { flags: { "keepers-rollbox": { assistGroup: { helpers: [] } } } }), true);
    assert.equal(assistGroupChanged(null, { flags: { "keepers-rollbox": { assistGroup: null } } }), true);
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

// --- A player's Assist: helping another investigator (assist-group.js, player-assist.js) -------------------------

/** Rollbox's flags on a mock actor, and the world's actors found by uuid (Foundry's fromUuidSync). */
function world(actors) {
  for (const actor of actors) {
    actor.flagged = {};
    actor.getFlag = (scope, key) => actor.flagged[key];
    actor.setFlag = async (scope, key, value) => { actor.flagged[key] = value; };
    actor.unsetFlag = async (scope, key) => { delete actor.flagged[key]; };
  }
  game.actors = actors;
  globalThis.fromUuidSync = (uuid) => actors.find((actor) => actor.uuid === uuid) ?? null;
}

test("joining (the Keeper's side): only the player's own investigator, helping any other character (an NPC too)", async () => {
  const { env } = setup();
  env.values.rollboxPlayerRollbox = true;
  env.values.rollboxPlayerAssist = true;
  const helen = person("Helen", 60); const cecil = person("Cecil", 40); const ghoul = person("Ghoul", 70, { npc: true });
  world([helen, cecil, ghoul]);
  const player = { id: "p1", isGM: false, character: cecil };
  cecil.testUserPermission = () => true;
  assert.equal(await joinForPlayer({ helpedUuid: helen.uuid, helperUuid: helen.uuid }, player), false); // not their own
  assert.equal(await joinForPlayer({ helpedUuid: cecil.uuid, helperUuid: cecil.uuid }, player), false); // themselves
  assert.equal(await joinForPlayer({ helpedUuid: ghoul.uuid, helperUuid: cecil.uuid }, player), true);
  assert.deepEqual(ghoul.flagged.assistGroup, { helpers: [cecil.uuid], sent: null });
  assert.equal(await joinForPlayer({ helpedUuid: helen.uuid, helperUuid: cecil.uuid }, player), true);
  assert.deepEqual(helen.flagged.assistGroup, { helpers: [cecil.uuid], sent: null });
  await leaveForPlayer({}, player); // Stop helping
  assert.equal(helen.flagged.assistGroup, undefined);
});

test("a relayed check's helpers count only when they stand in each roller's group with the player's own investigator", () => {
  setup();
  const helen = person("Helen", 60); const cecil = person("Cecil", 40); const martin = person("Martin", 45);
  world([helen, cecil, martin]);
  const player = { id: "p1", isGM: false, character: cecil };
  cecil.testUserPermission = () => true;
  helen.flagged.assistGroup = { helpers: [cecil.uuid], sent: null };
  assert.equal(helpersInGroup([helen], [cecil], player), true);
  assert.equal(helpersInGroup([martin], [cecil], player), false); // no group: a forged list
  assert.equal(helpersInGroup([helen], [cecil, martin], player), false); // Martin isn't in it
  helen.flagged.assistGroup = { helpers: [martin.uuid], sent: null };
  assert.equal(helpersInGroup([helen], [martin], player), false); // the player's investigator isn't in it
});

test("Stop helping (the Keeper's side) is refused with the players' Assist off, as joining is", async () => {
  const { env } = setup();
  env.values.rollboxPlayerRollbox = true;
  env.values.rollboxPlayerAssist = false;
  const helen = person("Helen", 60); const cecil = person("Cecil", 40);
  world([helen, cecil]);
  const player = { id: "p1", isGM: false, character: cecil };
  cecil.testUserPermission = () => true;
  helen.flagged.assistGroup = { helpers: [cecil.uuid], sent: null };
  assert.equal(await leaveForPlayer({}, player), false);
  assert.deepEqual(helen.flagged.assistGroup, { helpers: [cecil.uuid], sent: null });
});

test("a group on an unlinked token's creature (its flag on the token) is found, so the helper's panel follows it", () => {
  setup();
  const cecil = person("Cecil", 40); const deepOne = person("Deep One", 90, { creature: true });
  world([cecil, deepOne]);
  game.actors = [cecil]; // the creature is only on the scene, as an unlinked token
  game.scenes = [{ tokens: [{ actorLink: false, actor: deepOne }] }];
  deepOne.flagged.assistGroup = { helpers: [cecil.uuid], sent: null };
  assert.equal(standing(cecil)?.helped, deepOne);
  delete game.scenes;
});

test("a waiting group: the Keeper's Assist takes in its helpers; Send tells the group what was sent", async () => {
  setup();
  const helen = person("Helen", 60); const cecil = person("Cecil", 40);
  world([helen, cecil]);
  helen.flagged.assistGroup = { helpers: [cecil.uuid], sent: null };
  const m = open([helen]);
  assert.ok(m.row("Cecil"));
  m.type(".rollbox-assist-against", "90");
  m.press("Send to Helen"); await settle();
  const { sent } = helen.flagged.assistGroup;
  assert.deepEqual([sent.difficulty, sent.helpers.map((h) => h.name), sent.rollers.map((r) => r.name)],
    ["hard", ["Cecil"], ["Helen"]]);
});

test("one way to roll: with the Player Rollbox on, a group's player roller gets no chat request (their panel's Roll); with it off, CoC7's request", async () => {
  const { env } = setup();
  const helen = person("Helen", 60); const cecil = person("Cecil", 40);
  world([helen, cecil]);
  helen.flagged.assistGroup = { helpers: [cecil.uuid], sent: null };
  env.values.rollboxPlayerRollbox = true;
  env.values.rollboxPlayerAssist = true;
  const m = open([helen]);
  m.type(".rollbox-assist-against", "90");
  m.press("Send to Helen"); await settle();
  assert.equal(env.chat.filter((message) => /requested Helen/.test(message.content)).length, 0);
  assert.equal(helen.flagged.assistGroup.sent.rollers[0].name, "Helen");
  assert.ok(resultText(m.body.querySelector(".rollbox-result")).includes("Rolls from their Rollbox panel: Helen."));
  env.values.rollboxPlayerRollbox = false;
  helen.flagged.assistGroup = { helpers: [cecil.uuid], sent: null };
  const off = open([helen]);
  off.type(".rollbox-assist-against", "90");
  off.press("Send to Helen"); await settle();
  assert.equal(env.chat.filter((message) => /requested Helen/.test(message.content)).length, 1);
});

test("a group's player roller whose own Rollbox panel is off gets CoC7's chat request, not the panel's Roll", async () => {
  const { env } = setup();
  const helen = person("Helen", 60); const cecil = person("Cecil", 40);
  world([helen, cecil]);
  helen.flagged.assistGroup = { helpers: [cecil.uuid], sent: null };
  env.values.rollboxPlayerRollbox = true;
  env.values.rollboxPlayerAssist = true;
  const owner = game.users[1];
  game.settings.storage = new Map([["world", { getSetting: (key, user) => (key === "keepers-rollbox.rollboxEnabled"
    && user === owner.id ? { value: false } : undefined) }]]);
  const m = open([helen]);
  m.type(".rollbox-assist-against", "90");
  m.press("Send to Helen"); await settle();
  delete game.settings.storage;
  assert.equal(env.chat.filter((message) => /requested Helen/.test(message.content)).length, 1);
});

test("Cancel clears a player-assist group (waiting or sent); a new assist for the investigator replaces a sent group", async () => {
  setup();
  const helen = person("Helen", 60); const cecil = person("Cecil", 40); const martin = person("Martin", 45);
  world([helen, cecil, martin]);
  helen.flagged.assistGroup = { helpers: [cecil.uuid], sent: { use: "str", difficulty: "hard", label: "", rolled: [],
    helpers: [], rollers: [{ uuid: helen.uuid, name: "Helen", value: 60 }] } };
  const m = open([helen]);
  m.press("Cancel"); await settle();
  assert.equal(helen.flagged.assistGroup, undefined);
  assert.equal(m.closed(), true);
  helen.flagged.assistGroup = { helpers: [cecil.uuid], sent: { use: "str", difficulty: "hard", label: "", rolled: [],
    helpers: [], rollers: [{ uuid: helen.uuid, name: "Helen", value: 60 }] } };
  const again = open([helen, martin]);
  again.type(".rollbox-assist-against", "90");
  again.all("button").find((b) => b.classList.contains("rollbox-assist-primary")).click(); await settle();
  const { sent } = helen.flagged.assistGroup;
  assert.ok([...sent.helpers, ...sent.rollers].some((entry) => entry.name === "Martin"), JSON.stringify(sent));
});

test("M5: a roller's Assist roll is their rolled check of the group's characteristic; another check or a card not yet "
  + "rolled doesn't count", async () => {
  setup();
  const helen = person("Helen", 60); const cecil = person("Cecil", 40);
  world([helen, cecil]);
  helen.flagged.assistGroup = { helpers: [cecil.uuid], sent: { use: "str", difficulty: "hard", label: "", rolled: [],
    helpers: [], rollers: [{ uuid: helen.uuid, name: "Helen", value: 60 }] } };
  const results = { spot: [{ isRolled: true, type: "skill", key: "Actor.helen.Item.spot" }],
    standby: [{ isRolled: false, type: "characteristic", key: "str" }],
    str: [{ isRolled: true, type: "characteristic", key: "str" }] };
  game.CoC7 = { ...game.CoC7, messageResults: async (message) => results[message.id] };
  const card = (id) => ({ id, flags: { CoC7: { load: { as: "CoC7Check", actorUuid: helen.uuid } } } });
  await onRollerCard(card("spot"));
  await onRollerCard(card("standby"));
  assert.ok(helen.flagged.assistGroup);
  await onRollerCard(card("str"));
  assert.equal(helen.flagged.assistGroup, undefined);
});

test("a player's view: waiting with Stop helping; once sent, a helper reads it and the roller rolls at once", async () => {
  setup({ isGM: false });
  const helen = person("Helen", 60); const cecil = person("Cecil", 40);
  world([helen, cecil]);
  helen.flagged.assistGroup = { helpers: [cecil.uuid], sent: null };
  const body = document.createElement("div");
  document.body.append(body);
  renderAssist(body, { actors: [cecil], targeting: true, pickTarget: async () => null });
  assert.equal(body.querySelector(".rollbox-assist-player-title").textContent, "Helping Helen");
  assert.ok([...body.querySelectorAll("button")].some((b) => b.textContent === "Stop helping"));
  helen.flagged.assistGroup.sent = { use: "str", difficulty: "hard", label: "", rolled: [],
    helpers: [{ uuid: cecil.uuid, name: "Cecil", value: 40 }], rollers: [{ uuid: helen.uuid, name: "Helen", value: 60 }] };
  renderAssist(body, { actors: [cecil], targeting: true });
  assert.match(body.textContent, /Hard STR.*Cecil \(you\)−40.*Helen rolls\. Nothing for you to do\./);
  renderAssist(body, { actors: [helen], targeting: true });
  [...body.querySelectorAll("button")].find((b) => b.textContent === "Roll Hard STR").click(); await settle();
  assert.deepEqual(helen.calls[0].slice(0, 3), ["characteristicCheck", "str", true]);
});

test("a player's Target who you're helping: asks for the next token clicked, not their current target; pressed again, it cancels", async () => {
  setup({ isGM: false });
  const helen = person("Helen", 60); const cecil = person("Cecil", 40);
  world([helen, cecil]);
  globalThis.ui = { controls: { control: { name: "tokens" }, tool: { name: "select" }, activate: async () => {} } };
  globalThis.canvas = { tokens: { setTargets: () => {} } };
  game.user.targets = new Set([{ id: "t9", actor: helen }]);
  const body = document.createElement("div");
  document.body.append(body);
  renderAssist(body, { actors: [cecil], targeting: true });
  const go = body.querySelector(".rollbox-assist-help");
  go.click();
  await settle();
  assert.ok(document.querySelector(".rollbox-targeting"), "asks, though Helen is targeted already");
  assert.equal(go.getAttribute("aria-pressed"), "true");
  go.click();
  await settle();
  assert.equal(document.querySelector(".rollbox-targeting"), null);
  assert.equal(helen.flagged.assistGroup, undefined);
  assert.equal(body.querySelector(".rollbox-assist-help").getAttribute("aria-pressed"), "false");
});
