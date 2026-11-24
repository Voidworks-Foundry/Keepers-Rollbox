import assert from "node:assert/strict";
import { test } from "node:test";
import { registerCheckFlyout, renderCheckFlyout } from "../scripts/flyouts/check/index.js";
import { rowShortcut, shortcut } from "../scripts/panel/sheet-clicks.js";
import { levelsNode } from "../scripts/flyouts/flyout.js";
import { addStyles, makeCoC7, makeDom, makeEnv, makeRollActor, resultText } from "./mocks.mjs";

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

/**
 * The Check flyout drawn for these characters, with helpers to use it like the Keeper. `context` adds to what the
 * menu host passes (selectionChanged, open); the headings it sets are kept in `titles`.
 */
function open(actors, start, context = {}) {
  const body = document.createElement("div");
  document.body.append(body); // jsdom fires a checkbox's change on click only when it is in the document
  const titles = [];
  const controller = renderCheckFlyout(body, { actors, start, setTitle: (text) => titles.push(text), ...context });
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
  const sendsDisabled = () => all(".rollbox-check-action").every((node) => node.disabled);
  const result = () => resultText(body.querySelector(".rollbox-result"));
  const ticked = () => all(".rollbox-check-row input:checked").map((box) => box.closest(".rollbox-check-row")
    .querySelector(".rollbox-check-name").textContent);
  const selectedTab = () => body.querySelector('.rollbox-check-tab[aria-selected="true"]')?.textContent;
  /** A click (or right click) with modifier keys on a row or tile, as the Keeper's mouse does it. */
  const mouse = (node, { right = false, ...keys } = {}) => node.dispatchEvent(new document.defaultView.MouseEvent(
    right ? "contextmenu" : "click", { bubbles: true, cancelable: true, button: right ? 2 : 0, ...keys }));
  return { body, all, row, tick, press, tab, type, visibleNames, text, blind, sendsDisabled, result, ticked,
    controller, titles, selectedTab, mouse };
}

/** Let send() finish: it awaits CoC7's lookups and ChatMessage.create. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 10));

test("registerCheckFlyout: only on the Keeper's client with the Rollbox switch on", () => {
  makeEnv({ isGM: false });
  assert.equal(registerCheckFlyout(), false);
  makeEnv({ values: { rollboxEnabled: false } });
  assert.equal(registerCheckFlyout(), false);
  const env = makeEnv({ values: { rollboxEnabled: true } });
  assert.equal(registerCheckFlyout(), true);
  assert.deepEqual(env.reads, ["rollboxEnabled"]);
});

test("one character: Characteristic, Skill and Sanity tabs (no Attribute), values, trained skills first, a divider, the rest at base value; search filters", () => {
  setup();
  const m = open([pc({ skills: [spot, { name: "Climb", value: 20, cocid: "i.skill.climb" }] })]);
  assert.deepEqual(m.all(".rollbox-check-tab").map((n) => n.textContent), ["Characteristic", "Skill", "Sanity"]);
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

test("one check: greyed out with the status line in red until a check is ticked, then no line; Send to <name> whispers it", async () => {
  const { env } = setup();
  const alice = pc({ skills: [spot] });
  const m = open([alice]);
  assert.equal(m.sendsDisabled(), true);
  assert.match(m.text(".rollbox-status"), /tick/i);
  assert.ok(m.body.querySelector(".rollbox-status").classList.contains("rollbox-status-missing"));
  m.tick("Spot Hidden");
  assert.equal(m.sendsDisabled(), false);
  assert.equal(m.body.querySelector(".rollbox-status").hidden, true); // no summary of what will be sent
  m.press("Send to Alice");
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
  m.press("Send to Alice"); await settle();
  assert.match(env.chat[0].content, /subtype:combinedall,rolls:skill#i\.skill\.spot-hidden#1&&characteristic#pow#1,blind:false\]/);
  m.press("Any one");
  m.press("Send to Alice"); await settle();
  assert.match(env.chat[1].content, /subtype:combinedany,/);
});

test("the clear button beside All / Any one unpicks every ticked check, on every tab", () => {
  setup();
  const m = open([pc({ skills: [spot, listen] })]);
  m.tab("Skill"); m.tick("Spot Hidden"); m.tick("Listen");
  m.tab("Characteristic"); m.tick("POW");
  m.body.querySelector(".rollbox-check-combined .rollbox-check-clear").click();
  assert.equal(m.body.querySelector(".rollbox-check-combined").hidden, true);
  assert.equal(m.body.querySelectorAll("input[type=checkbox]:checked").length, 0);
  assert.equal(m.sendsDisabled(), true);
});

test("options: difficulty, dice, the Blind toggle and label go into the request; Blind clicks on and off", async () => {
  const { env } = setup();
  const m = open([pc({ skills: [spot] })]);
  m.tick("Spot Hidden");
  m.press("Extreme"); m.press("−2");
  m.blind().click();
  assert.equal(m.blind().getAttribute("aria-pressed"), "true");
  m.type(".rollbox-check-label-input", "notice the knife");
  m.press("Send to Alice"); await settle();
  assert.match(env.chat[0].content, /difficulty:3,poolModifier:-2,blind\]\{Extreme Spot Hidden · notice the knife\}/);
  m.press("Hard"); m.press("+1");
  m.press("Send to Alice"); await settle();
  assert.match(env.chat[1].content, /difficulty:2,poolModifier:1,blind\]/);
  m.blind().click();
  m.press("Send to Alice"); await settle();
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

test("the one send button: \"Roll for <name>\" for an NPC and \"Roll for NPCs\" when every character is one, \"Send to <player> (<name>)\" for one, \"Send to each (N)\" for several; no Send to chat or Copy link", async () => {
  setup();
  const words = (actors) => open(actors).body.querySelector(".rollbox-primary").textContent;
  assert.equal(words([npc()]), "Roll for Guard");
  assert.equal(words([npc(), npc({ name: "Thug", uuid: "Actor.Thug" })]), "Roll for NPCs");
  assert.equal(words([pc()]), "Send to Alice");
  game.users[1].name = "Robin";
  assert.equal(words([pc()]), "Send to Robin (Alice)");
  // Several player owners: only the one the character is assigned to is named; nobody assigned, every owner.
  game.users[2].name = "Kim";
  const shared = pc({ owners: [game.users[1], game.users[2]] });
  assert.equal(words([shared]), "Send to Robin, Kim (Alice)");
  game.users[2].character = shared;
  assert.equal(words([shared]), "Send to Kim (Alice)");
  delete game.users[2].character;
  delete game.users[2].name;
  delete game.users[1].name;
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
  m.press("Roll for Guard"); await settle();
  assert.equal(guard.calls[0][1].threshold, 1);
  m.tick("Pilot (Boat)");
  other("Basket Weaving");
  const ask = m.body.querySelector(".rollbox-check-ask");
  assert.equal(ask.hidden, false);
  ask.querySelector("input").value = "35";
  ask.querySelector("button").click();
  m.press("Roll for Guard"); await settle();
  assert.equal(guard.calls[1][1].threshold, 35);
});

test("nothing selected: the two lines say it goes to every investigator; Send to all players whispers each", async () => {
  const { env } = setup();
  const m = open([pc(), pc({ name: "Bob", owners: [game.users[2]] })], undefined, { everyone: true });
  assert.deepEqual(m.all(".rollbox-flyout-who.rollbox-everyone-note p").map((p) => p.textContent),
    ["No one selected: this goes to every investigator.", "Select tokens to choose who."]);
  m.tick("INT");
  m.press("Send to all players"); await settle();
  assert.deepEqual(env.chat.map((c) => c.whisper), [["p1"], ["p2"]]);
});

test("a player: Characteristic and Skill only; Make check has CoC7 roll their own check at once, Regular, no window or request",
  async () => {
  const { env } = setup({ isGM: false, values: { rollboxPlayerRollbox: true } });
  const alice = pc();
  const m = open([alice]);
  assert.deepEqual(m.all(".rollbox-check-tab").map((t) => t.textContent), ["Characteristic", "Skill"]);
  assert.equal(m.blind(), null);
  assert.equal(m.body.querySelector(".rollbox-check-label-input"), null);
  assert.equal(m.all("button").some((b) => b.textContent === "Hard"), false); // difficulty and dice are the Keeper's
  m.tick("STR");
  assert.equal(m.titles.at(-1), "Make a check");
  m.press("Make check"); await settle();
  assert.deepEqual(alice.calls, [["characteristicCheck", "str", true, { difficulty: 1, poolModifier: 0 }]]);
  assert.deepEqual(env.chat, []);
});

test("started from the character sheet: only that characteristic ticked; again while open switches it, keeping the options", () => {
  setup();
  const m = open([pc({ skills: [spot] })], { tick: "characteristic:str" });
  assert.deepEqual(m.ticked(), ["STR"]);
  m.tab("Skill"); m.tick("Spot Hidden"); m.press("Hard");
  m.controller.apply({ tick: "characteristic:int" });
  assert.deepEqual(m.ticked(), ["INT"]);
  assert.equal(m.body.querySelector(".rollbox-check-panel[data-tab=\"characteristic\"]").hidden, false);
  assert.equal(m.all("[aria-pressed=\"true\"]").some((b) => b.textContent === "Hard"), true);
});

test("started from the character sheet: add keeps the ticks (combined); plain sends a Regular check at once", async () => {
  const { env } = setup();
  const m = open([pc()], { tick: "characteristic:str" });
  m.press("Hard"); m.type(".rollbox-check-label-input", "lift it");
  m.controller.apply({ tick: "characteristic:con", add: true });
  assert.deepEqual(m.ticked(), ["STR", "CON"]);
  m.controller.apply({ tick: "characteristic:dex", plain: true, send: true }); await settle();
  assert.deepEqual(m.ticked(), ["DEX"]);
  assert.match(env.chat[0].content, /name:dex,difficulty:1,/);
  assert.doesNotMatch(env.chat[0].content, /lift it/);
});

test("a player gets only the tabs the Player Rollbox allows: none while it is off, so nothing is drawn", () => {
  makeEnv({ isGM: false, values: { rollboxPlayerRollbox: false } });
  makeCoC7();
  makeDom();
  const body = document.createElement("div");
  assert.equal(renderCheckFlyout(body, { actors: [pc()] }), undefined);
  assert.equal(body.childElementCount, 0);
});

test("Check opens on: the setting's tab; Last used, the tab chosen last; a new selection keeps the tab it was on", () => {
  setup({ values: { rollboxCheckOpensOn: "skill" } });
  assert.equal(open([pc()]).selectedTab(), "Skill");
  setup({ values: { rollboxCheckOpensOn: "last" } });
  open([pc()]).tab("Sanity");
  assert.equal(open([pc()]).selectedTab(), "Sanity");
  setup({ values: { rollboxCheckOpensOn: "characteristic" } });
  open([pc()]).tab("Skill");
  assert.equal(open([pc(), npc()], undefined, { selectionChanged: true }).selectedTab(), "Skill");
  assert.equal(open([pc()]).selectedTab(), "Characteristic");
});

test("title: \"Request a combined check\" with two or more ticks, \"Request a check\" with fewer; the send button "
  + "marked combined too (Art Deco's cue, with no title)", () => {
  setup();
  const m = open([pc()]);
  const marked = () => m.body.querySelector(".rollbox-check-action").hasAttribute("data-combined");
  m.tick("STR");
  assert.equal(marked(), false);
  m.tick("POW");
  assert.match(m.titles.at(-1), /combined/i);
  assert.equal(marked(), true);
  m.tick("POW");
  assert.equal(m.titles.at(-1), "Request a check");
  assert.equal(marked(), false);
});

test("Tiles: eight characteristic tiles (value, half · fifth) and skill tiles in three columns; a click ticks, the request goes as from the list", async () => {
  const { env } = setup({ values: { rollboxListStyle: "tiles" } });
  const m = open([pc({ skills: [spot] })]);
  const tiles = (tab) => m.all(`.rollbox-check-panel[data-tab="${tab}"] .rollbox-check-tile`);
  assert.equal(tiles("characteristic").length, 8);
  assert.ok(m.body.querySelector(".rollbox-check-tiles-characteristic"));
  assert.deepEqual([...tiles("characteristic")[0].children].map((n) => n.textContent), ["STR", "50", "25 · 10"]);
  assert.equal(m.body.querySelector("label.rollbox-check-row"), null);
  assert.ok(m.body.querySelector(".rollbox-check-tiles-skill"));
  const spotTile = tiles("skill").find((n) => n.title === "Spot Hidden");
  spotTile.click();
  assert.equal(spotTile.getAttribute("aria-pressed"), "true");
  m.press("Send to Alice"); await settle();
  assert.match(env.chat[0].content, /name:i\.skill\.spot-hidden,difficulty:1/);
  spotTile.click();
  assert.equal(spotTile.getAttribute("aria-pressed"), "false");
  assert.equal(m.sendsDisabled(), true);
});

test("row shortcuts: Shift sends just this check as Regular, the ticks and options kept; Ctrl copies its roll link; Alt + Right adds; Shift + Alt + Right sends the ticks", async () => {
  const { env, calls } = setup();
  const m = open([pc({ skills: [spot, listen] })]);
  m.tick("STR"); m.press("Hard");
  m.mouse(m.row("Spot Hidden"), { shiftKey: true }); await settle();
  assert.match(env.chat[0].content, /name:i\.skill\.spot-hidden,difficulty:1,blind:false\]/);
  assert.deepEqual(m.ticked(), ["STR"]);
  m.mouse(m.row("Listen"), { ctrlKey: true }); await settle();
  assert.equal(env.chat.length, 1);
  assert.deepEqual(m.ticked(), ["STR"]);
  assert.match(calls.copied[0], /^@coc7\.check\[subtype:skill,name:i\.skill\.listen,difficulty:2,blind:false\]/);
  m.mouse(m.row("Listen"), { right: true, altKey: true });
  assert.deepEqual(m.ticked(), ["STR", "Listen"]);
  m.mouse(m.row("Spot Hidden"), { right: true, altKey: true, shiftKey: true }); await settle();
  assert.match(env.chat[1].content, /subtype:combinedall,rolls:characteristic#str#2&&skill#i\.skill\.listen#2&&skill#i\.skill\.spot-hidden#2/);
});

test("row shortcuts: Right opens Opposed with this check as the first character's side (Shift: made at once); without Opposed, a line says so", () => {
  setup();
  const alice = pc({ skills: [spot] });
  const guard = npc();
  const asked = [];
  const m = open([alice, guard], undefined, { open: (id, start) => { asked.push([id, start]); return true; } });
  m.mouse(m.row("Spot Hidden"), { right: true });
  m.mouse(m.row("DEX"), { right: true, shiftKey: true });
  assert.deepEqual(asked, [
    ["opposed", { first: alice.uuid, picks: { [alice.uuid]: "skill:spot hidden" }, create: false }],
    ["opposed", { first: alice.uuid, picks: { [alice.uuid]: "characteristic:dex" }, create: true }]
  ]);
  assert.deepEqual(m.ticked(), []);
  const lone = open([alice]);
  lone.mouse(lone.row("STR"), { right: true });
  assert.deepEqual(lone.result(), ["Opposed can't be opened for this selection."]);
});

const SAN = { kind: "san" };
const LUCK = { kind: "luck" };

test("SAN on the sheet: Shift + Left sends a plain SAN roll; every other shortcut opens Check on Sanity", () => {
  const tab = { tab: "sanity" };
  assert.deepEqual(shortcut(SAN, { shift: true }), { open: "check", start: { ...tab, plain: true, send: true } });
  const others = [{}, { ctrl: true }, { alt: true }, { shift: true, alt: true }, { shift: true, ctrl: true }, { ctrl: true, alt: true },
    { right: true }, { right: true, shift: true }, { right: true, alt: true }, { right: true, shift: true, alt: true }];
  for (const how of others) assert.deepEqual(shortcut(SAN, how), { open: "check", start: tab }, JSON.stringify(how));
});

test("Luck on the sheet: never opposed or combined; its right clicks open Other on Luck; Alt + Left and Ctrl + Right do nothing", () => {
  const luck = { section: "luck" };
  assert.deepEqual(shortcut(LUCK, { shift: true }), { open: "other", start: { ...luck, plain: true, send: true } });
  for (const how of [{}, { ctrl: true }, { shift: true, ctrl: true }, { right: true }, { right: true, shift: true }, { right: true, alt: true },
    { right: true, shift: true, alt: true }]) {
    assert.deepEqual(shortcut(LUCK, how), { open: "other", start: luck }, JSON.stringify(how));
  }
  assert.equal(shortcut(LUCK, { alt: true }), null);
  assert.equal(shortcut(LUCK, { right: true, ctrl: true }), null);
});

test("a check row in the flyout: CoC7's sheet shortcuts, with Left keeping its menu meaning (tick)", () => {
  const cases = [
    [{}, "tick"], [{ shift: true }, "send"], [{ ctrl: true }, "copy"], [{ ctrl: true, shift: true }, "tick"],
    [{ alt: true }, null], [{ right: true }, "opposed"], [{ right: true, shift: true }, "opposedNow"],
    [{ right: true, alt: true }, "add"], [{ right: true, alt: true, shift: true }, "combinedNow"],
    [{ right: true, ctrl: true }, null], [{ right: true, ctrl: true, alt: true }, "add"]
  ];
  for (const [how, action] of cases) assert.equal(rowShortcut(how), action, JSON.stringify(how));
});

test("row values: read 55 · 27 · 11; the Art Deco theme shows them CoC7's way, 55 (27/11)", () => {
  makeEnv();
  const window = makeDom(`<div class="rollbox-panel rollbox-theme-art-deco"></div>`);
  addStyles("panel/themes/art-deco.css");
  const node = levelsNode("rollbox-check-values", { value: 55, half: 27, fifth: 11 });
  document.querySelector(".rollbox-panel").append(node);
  assert.equal(node.textContent, "55 · 27 · 11");
  const style = (selector) => window.getComputedStyle(node.querySelector(selector));
  assert.equal(style(".rollbox-level-sep").display, "none");
  assert.deepEqual([...node.querySelectorAll(".rollbox-level")].map((n) => n.textContent), ["55", "27", "11"]);
  assert.equal(levelsNode("x", { value: null }).textContent, "—");
});

test("bug: a player without Combined checks ticks one check at a time; a row's right click without Opposed says so", () => {
  makeEnv({ isGM: false, values: { rollboxPlayerRollbox: true, rollboxPlayerCombined: false,
    rollboxPlayerOpposed: false } });
  makeCoC7();
  makeDom();
  const asked = [];
  const m = open([pc()], undefined, { open: (id) => { asked.push(id); return true; } });
  m.tick("STR");
  m.tick("DEX");
  assert.deepEqual(m.ticked(), ["DEX"]);
  m.mouse(m.row("CON"), { right: true });
  assert.deepEqual(asked, []);
  assert.deepEqual(m.result(), ["You can't start an opposed roll."]);
});
