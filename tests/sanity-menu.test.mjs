import assert from "node:assert/strict";
import { test } from "node:test";
import { PRESETS, registerSanityMenu, renderSanityMenu } from "../scripts/sanity-menu/index.js";
import { makeCoC7, makeDom, makeEnv, makeRollActor, resultText } from "./mocks.mjs";

/** Keeper's client with CoC7, and a DOM for the flyout. */
function setup(env = {}) {
  const e = makeEnv(env);
  const calls = makeCoC7();
  makeDom();
  return { env: e, calls };
}

const pc = (options = {}) => makeRollActor({ name: "Alice", owners: [game.users[1]], san: 60, sanMax: 99, ...options });
const npc = (options = {}) => makeRollActor({ name: "Guard", type: "npc", owners: [], san: 40, ...options });

/** The Sanity menu drawn for these characters, with helpers to use it like the Keeper. */
function open(actors) {
  const body = document.createElement("div");
  document.body.append(body);
  renderSanityMenu(body, { actors });
  const all = (selector) => [...body.querySelectorAll(selector)];
  const press = (text) => all("button").find((node) => node.textContent === text).click();
  const type = (selector, value) => {
    const input = body.querySelector(selector);
    input.value = value;
    input.dispatchEvent(new document.defaultView.Event("input"));
  };
  const text = (selector) => body.querySelector(selector)?.textContent;
  const actionsDisabled = () => all(".rollbox-sanity-action").every((node) => node.disabled);
  const result = () => resultText(body.querySelector(".rollbox-result"));
  return { body, all, press, type, text, actionsDisabled, result };
}

/** Let send() finish: it awaits ChatMessage.create and CoC7's link handler. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 10));

/** CoC7's Sanity card rendering, so roll-requests' watch for it ends (and its 15 s timer with it). */
function renderSanityCard(env, actor) {
  const html = { querySelector: () => ({ disabled: false, click: () => {} }) };
  (env.hooks.renderChatMessageHTML ?? []).slice()
    .forEach((f) => f({ flags: { CoC7: { load: { as: "CoC7SanCheckCard", actorUuid: actor.uuid } } }, isAuthor: true }, html));
}

test("registerSanityMenu: only on the Keeper's client with the Rollbox switch on", () => {
  makeEnv({ isGM: false });
  assert.equal(registerSanityMenu(), false);
  makeEnv({ values: { rollboxEnabled: false } });
  assert.equal(registerSanityMenu(), false);
  makeEnv({ values: { rollboxEnabled: true } });
  assert.equal(registerSanityMenu(), true);
});

test("one character: current SAN shown; the line starts at 0 / 1D6 with its preset pressed; a preset sets both sides and sends", async () => {
  const { env } = setup();
  const m = open([pc()]);
  assert.equal(m.text(".rollbox-sanity-value"), "SAN 60 / 99");
  const sides = () => [m.body.querySelector(".rollbox-sanity-success").value, m.body.querySelector(".rollbox-sanity-failure").value];
  assert.deepEqual(sides(), ["0", "1D6"]);
  assert.equal(m.all(".rollbox-sanity-preset").length, PRESETS.length);
  assert.equal(m.all('.rollbox-sanity-preset[aria-pressed="true"]').map((n) => n.textContent).join(), "0/1D6");
  m.press("1/1D6");
  assert.deepEqual(sides(), ["1", "1D6"]);
  assert.equal(m.all('.rollbox-sanity-preset[aria-pressed="true"]').map((n) => n.textContent).join(), "1/1D6");
  assert.equal(m.body.querySelector(".rollbox-status").hidden, true); // no summary of what will be sent
  m.press("Request from player"); await settle();
  assert.deepEqual(env.chat[0].whisper, ["p1"]);
  assert.match(env.chat[0].content,
    /@coc7\.sanloss\[sanMin:1,sanMax:1D6,difficulty:1,poolModifier:0,blind:false\]\{Sanity \(1\/1D6\)\}/);
  assert.deepEqual(m.result(), ["Sanity check sent to:", "Alice", "Click Apply on CoC7's card to take the loss."]);
});

test("the loss line: typed sides are sent; one that isn't a loss turns red, blocks Send and says why; Custom writes both sides", async () => {
  const { env } = setup();
  const m = open([pc()]);
  m.type(".rollbox-sanity-failure", "2d6x");
  assert.equal(m.actionsDisabled(), true);
  assert.ok(m.body.querySelector(".rollbox-sanity-failure").classList.contains("rollbox-value-invalid"));
  assert.equal(m.text(".rollbox-status"), "A loss is a number or dice, e.g. 2, 1D6 or 1D6+1D4.");
  m.type(".rollbox-sanity-failure", "");
  assert.equal(m.actionsDisabled(), false); // empty is 0
  m.press("Custom success or failure loss");
  const failure = m.body.querySelector('.rollbox-dice[aria-label="On a failure"]');
  [...failure.querySelectorAll("button")].find((node) => node.textContent === "D4").click();
  failure.querySelector('[aria-label="On a failure: flat bonus: more"]').click();
  assert.equal(m.body.querySelector(".rollbox-sanity-failure").value, "1D4+1");
  assert.equal(m.all('.rollbox-sanity-preset[aria-pressed="true"]').length, 0); // 0/1D4+1 isn't a preset
  m.press("Send to chat"); await settle();
  assert.equal("whisper" in env.chat[0], false);
  assert.match(env.chat[0].content, /sanMin:0,sanMax:1D4\+1,/);
});

test("Simplified dice UI: only the loss line, no presets or Custom button; a typed loss is sent", async () => {
  const { env } = setup({ values: { rollboxSimplifiedDice: true } });
  const m = open([pc()]);
  assert.equal(m.body.querySelector(".rollbox-dice-custom").hidden, true);
  assert.equal(m.body.querySelector(".rollbox-sanity-presets").hidden, true);
  m.type(".rollbox-sanity-success", "1");
  m.type(".rollbox-sanity-failure", "2d6");
  m.press("Send to chat"); await settle();
  assert.match(env.chat[0].content, /sanMin:1,sanMax:2D6,/);
});

test("What caused it is the label players see, after \"Sanity check ·\"; Creature goes to CoC7's sanReason", async () => {
  const { env } = setup();
  const m = open([pc()]);
  m.press("0/1D6");
  m.type(".rollbox-sanity-cause", "The thing in the cellar");
  m.type(".rollbox-sanity-creature", "Ghoul");
  m.press("Request from player"); await settle();
  assert.match(env.chat[0].content, /sanReason:Ghoul,.*\]\{Sanity check · The thing in the cellar\}/);
});

test("several characters: Send to each (N); players asked, the NPC's card made, one without SAN skipped and shown", async () => {
  const { env, calls } = setup();
  const alice = pc();
  const bob = pc({ name: "Bob", owners: [game.users[2]], san: 45, sanMax: undefined });
  const guard = npc();
  const thing = npc({ name: "Thing", system: { characteristics: {}, attribs: { san: {} } } });
  const m = open([alice, bob, guard, thing]);
  assert.deepEqual(m.all(".rollbox-sanity-value").map((n) => n.textContent),
    ["SAN 60 / 99", "SAN 45", "SAN 40", "— skipped"]);
  m.press("1D3/1D10");
  m.press("Send to each (4)"); await settle();
  renderSanityCard(env, guard);
  assert.deepEqual(env.chat.map((c) => c.whisper), [["p1"], ["p2"]]);
  assert.equal(calls.linkActorClick[0].actor, guard);
  assert.deepEqual(m.result(), ["Sanity check sent to:", "Alice", "Bob", "Rolled for you:", "Guard", "Not sent:",
    "Thing: no Sanity value", "Click Apply on CoC7's card to take the loss."]);
});
