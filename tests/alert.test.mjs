import assert from "node:assert/strict";
import { test } from "node:test";
import { makeCoC7, makeDom, makeEnv } from "./mocks.mjs";
import { DIVE_HOOK, diveDecision, readAttack, registerBeingAttacked, setAlertHost, setPlayerAccess }
  from "../scripts/flyouts/alert/being-attacked.js";
import { registerRelay } from "../scripts/roll-requests/relay.js";

const ID = "keepers-rollbox";
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/** A rolled or unrolled CoC7 dice pool, as its card stores it. */
const pool = (rolled) => ({ rolledDice: [{ rolled }] });

const meleeCard = (id, { targetUuid = "Actor.helen", responded = false, rolled = false } = {}) => ({ id,
  flags: { CoC7: { load: { as: "CoC7ChatCombatMelee", participant: 1, attackerUuid: "Actor.cultist", targetUuid,
    responded, dicePool: pool(rolled) } } } });

const shotCard = (id, { targets = ["Actor.helen"], weaponRolled = false, poolKeys = [] } = {}) => ({ id,
  flags: { CoC7: { load: { as: "CoC7ChatCombatRanged", actorUuid: "Actor.cultist", weaponRolled,
    targets: targets.map((uuid) => ({ uuid, poolKeys })) } } } });

function helen() {
  return { id: "helen", uuid: "Actor.helen", name: "Helen", isOwner: true, calls: [], flags: {},
    items: [{ type: "skill", name: "Dodge", system: { isDodge: true } }],
    system: { attribs: { build: { value: 0 } } },
    async setFlag(...args) { this.calls.push(["setFlag", ...args]); },
    async skillCheck(...args) { this.calls.push(["skillCheck", ...args]); } };
}

/** A player's client with the Player Rollbox on and Helen as their character; `values` their Rollbox settings. */
function playerClient(values) {
  const env = makeEnv({ isGM: false, values });
  makeDom("<div id='interface'></div><div id='chat'></div>");
  const me = helen();
  const cultist = { id: "cultist", uuid: "Actor.cultist", name: "Cultist of Dagon", system: { attribs: { build: { value: 2 } } } };
  globalThis.fromUuidSync = (uuid) => ({ "Actor.cultist": cultist, "Actor.helen": me })[uuid] ?? null;
  setPlayerAccess({ playerRollboxOn: () => true, ownCharacter: () => me });
  setAlertHost(null);
  return { env, me };
}

/** CoC7's card as rendered in the chat log, its buttons recording clicks. */
function renderCard(id, html) {
  const card = document.createElement("li");
  card.dataset.messageId = id;
  card.innerHTML = html;
  const clicks = [];
  card.querySelectorAll("[data-action]").forEach((b) => b.addEventListener("click", () => {
    const offset = b.closest("[data-offset]")?.dataset.offset;
    clicks.push(b.dataset.action + (b.dataset.set ? `:${b.dataset.set}` : "") + (offset ? `@${offset}` : ""));
  }));
  document.getElementById("chat").append(card);
  return clicks;
}

const alertButtons = (alert) => [...alert.querySelectorAll(".rollbox-alert-actions button")].map((b) => b.textContent);

test("registerBeingAttacked does nothing while the Player Rollbox is off", () => {
  const env = makeEnv({ isGM: false });
  setPlayerAccess(null);
  assert.equal(registerBeingAttacked(), false);
  assert.deepEqual(Object.keys(env.hooks), []);
});

test("readAttack: CoC7's defender and ranged cards; anything else is no attack", () => {
  assert.deepEqual(readAttack(meleeCard("m1")).targets, ["Actor.helen"]);
  assert.equal(readAttack(meleeCard("m1", { rolled: true })).open, false);
  assert.equal(readAttack(shotCard("s1", { targets: ["Scene/a/Token/b"] })).targets[0], "Scene.a.Token.b");
  const attackerCard = meleeCard("m2");
  attackerCard.flags.CoC7.load.participant = 0;
  assert.equal(readAttack(attackerCard), null);
  assert.equal(readAttack({ id: "c", flags: { CoC7: { load: { as: "CoC7Check" } } } }), null);
  assert.equal(readAttack({ id: "x", flags: {} }), null);
});

/** CoC7's defender card buttons (its four choices) for renderCard. */
const DEFENDER_BUTTONS = '<div data-actor-uuid="Actor.helen"><button data-action="dodge"></button>'
  + '<button data-action="setNoResponse"></button><button data-action="setFightBack"></button>'
  + '<button data-action="setManeuvers"></button></div>';

/** CoC7 redrawing the defender card once a choice is set (`load` its new flags), with its roll button. */
function chosen(env, id, load) {
  const html = document.createElement("div");
  html.innerHTML = '<button data-action="targetRoll"></button>';
  const rolls = [];
  html.querySelector("button").addEventListener("click", () => rolls.push("targetRoll"));
  env.hooks.renderChatMessageHTML.forEach((f) => f({ id, flags: { CoC7: { load } } }, html));
  return rolls;
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test("melee: Dodge and No response each choose on CoC7's defender card and press its roll button", async () => {
  const { env, me } = playerClient();
  me.items[0].id = "dodge";
  game.messages = { get: () => null };
  assert.equal(registerBeingAttacked(), true);
  const clicks = renderCard("m1", DEFENDER_BUTTONS);
  env.hooks.createChatMessage.forEach((f) => f(meleeCard("m1")));
  const alert = document.querySelector(".rollbox-alert");
  assert.match(alert.querySelector(".rollbox-alert-title").textContent, /attacked/);
  assert.deepEqual(alertButtons(alert), ["Dodge", "Fight back", "Counter", "No response"]);
  alert.querySelector(".rollbox-alert-actions button").click();
  await tick();
  assert.deepEqual(clicks, ["dodge"]);
  assert.deepEqual(chosen(env, "m1", { itemUuid: "Actor.helen.Item.knife" }), []);
  const rolled = chosen(env, "m1", { itemUuid: "Actor.helen.Item.dodge" });
  await wait(300);
  assert.deepEqual(rolled, ["targetRoll"]);
  const second = renderCard("m2", DEFENDER_BUTTONS);
  env.hooks.createChatMessage.forEach((f) => f(meleeCard("m2")));
  document.querySelector('.rollbox-alert[data-message-id="m2"] .rollbox-alert-actions button:last-child').click();
  await tick();
  const noResponse = chosen(env, "m2", { isNoResponse: true });
  await wait(300);
  assert.deepEqual([second, noResponse], [["setNoResponse"], ["targetRoll"]]);
});

test("melee: Fight back picks the weapon and Counter the Punch's fighting skill in CoC7's own lists, then roll", async () => {
  const { env, me } = playerClient();
  const brawl = { type: "skill", id: "brawl", name: "Fighting (Brawl)", system: { properties: { fighting: true } } };
  me.items.push(brawl, { type: "weapon", id: "punch", name: "Punch", flags: { CoC7: { cocidFlag: { id: "i.weapon.brawl" } } },
    system: { properties: { mnvr: true }, skill: { main: { id: "brawl" } } } },
  { type: "weapon", id: "knife", name: "Knife", system: { properties: { rngd: false }, skill: { main: { id: "brawl" } } } });
  game.messages = { get: () => null };
  document.getElementById("chat").classList.add("chat-scroll");
  registerBeingAttacked();
  /** A defender card whose Fight back and Maneuver open CoC7's dropdown: one setItem button per entry. */
  const card = (id) => {
    const clicks = renderCard(id, DEFENDER_BUTTONS);
    const copy = document.querySelector(`[data-message-id="${id}"]`);
    for (const [action, entries] of [["setFightBack", ["punch", "knife"]], ["setManeuvers", ["brawl"]]]) {
      copy.querySelector(`[data-action="${action}"]`).addEventListener("click", () => {
        const list = document.createElement("div");
        list.id = `dropdown-${id}`;
        list.innerHTML = entries.map((entry) => `<button data-action="setItem" data-item-id="${entry}"></button>`).join("");
        list.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => clicks.push(`setItem:${b.dataset.itemId}`)));
        document.body.append(list);
      });
    }
    env.hooks.createChatMessage.forEach((f) => f(meleeCard(id)));
    return { clicks, alert: document.querySelector(`.rollbox-alert[data-message-id="${id}"]`) };
  };
  const first = card("m1");
  const [, fightBack, counter] = first.alert.querySelectorAll(".rollbox-alert-actions button");
  fightBack.click();
  const weapons = first.alert.querySelector(".rollbox-alert-weapons");
  assert.deepEqual([...weapons.querySelectorAll("button")].map((b) => b.textContent), ["Punch", "Knife"]);
  counter.click();
  assert.equal(weapons.hidden, true); // one answer's options at a time
  fightBack.click();
  weapons.querySelectorAll("button")[1].click();
  await wait(300);
  assert.deepEqual(first.clicks, ["setFightBack", "setItem:knife"]);
  const rolled = chosen(env, "m1", { itemUuid: "Actor.helen.Item.knife" });
  await wait(300);
  assert.deepEqual(rolled, ["targetRoll"]);
  const second = card("m2");
  second.alert.querySelectorAll(".rollbox-alert-actions button")[2].click();
  const goals = second.alert.querySelector(".rollbox-alert-counter .rollbox-alert-goals");
  assert.equal(goals.querySelector(".rollbox-alert-build").textContent, "Build: 2 penalty dice.");
  goals.querySelector("button").click();
  await wait(300);
  assert.deepEqual(second.clicks, ["setManeuvers", "setItem:brawl"]);
});

test("melee: no alert for someone else's character; the alert closes once answered", () => {
  const { env } = playerClient();
  registerBeingAttacked();
  env.hooks.createChatMessage.forEach((f) => f(meleeCard("m1", { targetUuid: "Actor.harvey" })));
  assert.equal(document.querySelector(".rollbox-alert"), null);
  env.hooks.createChatMessage.forEach((f) => f(meleeCard("m2")));
  env.hooks.updateChatMessage.forEach((f) => f(meleeCard("m2", { responded: true })));
  assert.equal(document.querySelector(".rollbox-alert"), null);
});

test("shot at: Stand your ground closes the alert for that card for good", () => {
  const { env } = playerClient();
  registerBeingAttacked();
  env.hooks.createChatMessage.forEach((f) => f(shotCard("s1")));
  const alert = document.querySelector(".rollbox-alert");
  assert.match(alert.querySelector(".rollbox-alert-title").textContent, /shot at/);
  assert.deepEqual(alertButtons(alert), ["Dive for cover", "Stand your ground"]);
  alert.querySelectorAll(".rollbox-alert-actions button")[1].click();
  env.hooks.updateChatMessage.forEach((f) => f(shotCard("s1")));
  assert.equal(document.querySelector(".rollbox-alert"), null);
});

test("shot at: Dive for cover rolls CoC7's Dodge and, on a success, notes the dive; another check card is passed over", async () => {
  const { env, me } = playerClient();
  game.combat = { id: "c1", started: true, round: 1 };
  const items = { "Actor.helen.Item.dodge": { name: "Dodge", system: { isDodge: true } },
    "Actor.helen.Item.spot": { name: "Spot Hidden", system: {} } };
  globalThis.fromUuidSync = (uuid) => items[uuid] ?? null;
  game.CoC7 = { messageResults: async (message) => [{ isRolled: true, isSuccess: true, type: "skill",
    key: message.id === "d1" ? "Actor.helen.Item.dodge" : "Actor.helen.Item.spot" }] };
  registerBeingAttacked();
  env.hooks.createChatMessage.forEach((f) => f(shotCard("s1")));
  document.querySelector(".rollbox-alert-actions button").click();
  await tick();
  assert.deepEqual(me.calls[0], ["skillCheck", "Dodge", true]);
  const card = (id) => ({ id, isAuthor: true, flags: { CoC7: { load: { as: "CoC7Check", actorUuid: "Actor.helen" } } } });
  env.hooks.createChatMessage.forEach((f) => f(card("x1")));
  await tick(); await tick();
  assert.equal(me.calls.length, 1);
  const dodgeCard = card("d1");
  env.hooks.createChatMessage.forEach((f) => f(dodgeCard));
  await tick(); await tick();
  assert.deepEqual(me.calls[1].slice(0, 3), ["setFlag", ID, "roundNotes"]);
  assert.deepEqual([me.calls[1][3].dived, me.calls.length], [true, 2]); // no status flag besides
  assert.match(document.querySelector(".rollbox-alert-line").textContent, /You dived for cover/);
  delete globalThis.fromUuidSync;
});

test("Keeper: after a dive, Under cover is ticked once on the newest unrolled shot at that character", () => {
  const env = makeEnv({ isGM: true });
  makeDom("<div id='chat'></div>");
  game.users.activeGM = game.users[0];
  const me = helen();
  globalThis.fromUuidSync = () => null;
  setPlayerAccess({ playerRollboxOn: () => true, ownCharacter: () => null });
  game.messages = [shotCard("old", { targets: ["Actor.helen"] }), shotCard("s1", { targets: ["Actor.x", "Actor.helen"] }),
    shotCard("done", { weaponRolled: true })];
  assert.equal(registerBeingAttacked(), true);
  const option = (offset) => `<div class="ranged-targets-option" data-offset="${offset}">`
    + '<button data-action="toggleTargetKey" data-set="cover"></button></div>';
  const clicks = renderCard("s1", option(0) + option(1));
  const dived = { flags: { [ID]: { roundNotes: { combat: "c1", round: 1, dived: true } } } };
  env.hooks.updateActor.forEach((f) => f(me, dived));
  assert.deepEqual(clicks, ["toggleTargetKey:cover@1"]);
  game.messages = [shotCard("s1", { targets: ["Actor.x", "Actor.helen"], poolKeys: ["cover"] })];
  env.hooks.updateActor.forEach((f) => f(me, dived));
  assert.equal(clicks.length, 1);
});

test("diveDecision: pending while an open shot targets a player's character, then dived or stood from the round notes", () => {
  const env = makeEnv({ isGM: true });
  makeDom("<div id='chat'></div>");
  const me = helen();
  me.owners = [{ id: "p1", isGM: false }];
  me.getFlag = (scope, key) => me.flags[scope]?.[key];
  game.combat = { id: "c1", started: true, round: 1 };
  globalThis.fromUuidSync = (uuid) => (uuid === "Actor.helen" ? me : null);
  setPlayerAccess({ playerRollboxOn: () => true, ownCharacter: () => null });
  game.messages = [];
  assert.equal(diveDecision(me), null);
  game.messages = [shotCard("s1")];
  assert.equal(diveDecision(me), "pending");
  me.flags[ID] = { roundNotes: { combat: "c1", round: 1, stood: true } };
  assert.equal(diveDecision(me), "stood");
  me.flags[ID] = { roundNotes: { combat: "c1", round: 1, dived: true } };
  assert.equal(diveDecision(me), "dived");
  registerBeingAttacked();
  const heard = [];
  Hooks.on(DIVE_HOOK, (actor, decision) => heard.push([actor.name, decision]));
  env.hooks.createChatMessage.forEach((f) => f(shotCard("s2")));
  assert.deepEqual(heard, [["Helen", "dived"]]);
});

test("a player without a Rollbox panel: the alert's own box wears their Theme, as the panel would", () => {
  const { env } = playerClient({ rollboxTheme: "coc7Minimal" });
  game.system = { id: "CoC7" };
  registerBeingAttacked();
  env.hooks.createChatMessage.forEach((f) => f(shotCard("s9")));
  const host = document.querySelector(".rollbox-alert-host");
  assert.equal(host.classList.contains("rollbox-theme-coc7-minimal"), true);
});

/** Rollbox's maneuver notice: Cultist attempts to restrain `target`; `answer` once answered. */
const notice = (id, { target = "Actor.helen", answer = null } = {}) => {
  const message = { id, author: { isGM: true }, flags: { [ID]: { maneuver: { attacker: "Actor.cultist", target, weapon: "seize",
    goal: "restrain", answer, card: null } } }, updates: [] };
  message.update = async (changes) => { message.updates.push(changes); };
  return message;
};

/** Helen's two melee weapons: her Punch (Maneuver off) and a knife. */
function armHelen(me) {
  me.items.push({ type: "weapon", id: "punch", name: "Punch", flags: { CoC7: { cocidFlag: { id: "i.weapon.brawl" } } },
    system: { properties: { mnvr: false } } },
  { type: "weapon", id: "knife", name: "Knife", system: { properties: { rngd: false } } });
}

test("maneuver: the target's player gets Dodge · Fight back (one per melee weapon) · Counter (clickable with \"No maneuver weapon\" on hover without one); an answer goes to the Keeper's client", async () => {
  const { env, me } = playerClient();
  armHelen(me);
  me.uuid = "Actor.helen";
  const asked = [];
  const listeners = [];
  game.users.activeGM = game.users[0];
  game.users.get = (id) => game.users.find((user) => user.id === id);
  game.socket = { on: (channel, f) => listeners.push(f), emit: (channel, data) => {
    asked.push(data);
    listeners.forEach((f) => f({ type: "answer", id: data.id, to: "p1", answer: { ok: true } }, "gm1"));
  } };
  registerRelay();
  registerBeingAttacked();
  env.hooks.createChatMessage.forEach((f) => f(notice("n1", { target: "Actor.harvey" })));
  assert.equal(document.querySelector(".rollbox-alert"), null);
  env.hooks.createChatMessage.forEach((f) => f(notice("n2")));
  const alert = document.querySelector(".rollbox-alert");
  assert.equal(alert.querySelector(".rollbox-alert-sub").textContent, "Cultist of Dagon attempts to restrain (maneuver) Helen.");
  assert.deepEqual(alertButtons(alert), ["Dodge", "Fight back", "Counter", "No response"]);
  const [, fightBack, counter] = alert.querySelectorAll(".rollbox-alert-actions button");
  assert.deepEqual([counter.disabled, counter.title], [false, "No maneuver weapon"]);
  fightBack.click();
  const weapons = [...alert.querySelectorAll(".rollbox-alert-weapons button")];
  assert.deepEqual(weapons.map((b) => b.textContent), ["Punch", "Knife"]);
  weapons[1].click();
  await tick(); await tick();
  assert.deepEqual([asked[0].type, asked[0].payload], ["maneuver", { noticeId: "n2", answer: "fight", weaponId: "knife" }]);
  assert.match(alert.querySelector(".rollbox-alert-line").textContent, /your side is rolled/);
  env.hooks.updateChatMessage.forEach((f) => f(notice("n2", { answer: "fight" })));
  assert.ok(alert.isConnected); // the one who answered keeps it, to read where to roll
  // CoC7's opposed card after Start Rolls: the player's own row's Roll dice is pressed for them.
  const html = document.createElement("div");
  html.innerHTML = '<button data-action="rollActor" data-actor-uuid="Actor/cultist"></button>'
    + '<button data-action="rollActor" data-actor-uuid="Actor/helen"></button>';
  const rolled = [];
  html.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => rolled.push(b.dataset.actorUuid)));
  me.uuid = "Actor.helen";
  env.hooks.renderChatMessageHTML.forEach((f) => f({ id: "op1", flags: { CoC7: { load: {
    as: "CoC7ChatOpposedMessage", isCombat: true, actorUuids: ["Actor/cultist", "Actor/helen"] } } } }, html));
  await new Promise((resolve) => setTimeout(resolve, 300));
  assert.deepEqual(rolled, ["Actor/helen"]);
});

test("maneuver: Counter lists the maneuver weapons with the Punch first and picked; No response is sent as none", async () => {
  const { env, me } = playerClient();
  me.items.push({ type: "weapon", id: "whip", name: "Bullwhip", system: { properties: { mnvr: true } } },
    { type: "weapon", id: "punch", name: "Punch", flags: { CoC7: { cocidFlag: { id: "i.weapon.brawl" } } },
      system: { properties: { mnvr: true } } });
  const asked = [];
  game.users.activeGM = game.users[0];
  game.socket = { on: () => {}, emit: (channel, data) => asked.push(data.payload) };
  registerBeingAttacked();
  env.hooks.createChatMessage.forEach((f) => f(notice("n3")));
  const alert = document.querySelector(".rollbox-alert");
  alert.querySelectorAll(".rollbox-alert-actions button")[2].click();
  const row = [...alert.querySelectorAll(".rollbox-alert-counter-weapons button")];
  assert.deepEqual(row.map((b) => [b.textContent, b.classList.contains("rollbox-alert-picked")]),
    [["Punch", true], ["Bullwhip", false]]);
  row[1].click();
  alert.querySelector(".rollbox-alert-counter .rollbox-alert-goals button").click();
  await tick();
  assert.deepEqual(asked[0], { noticeId: "n3", answer: "counter", weaponId: "whip" });
  env.hooks.createChatMessage.forEach((f) => f(notice("n4")));
  document.querySelector('.rollbox-alert[data-message-id="n4"] .rollbox-alert-actions button:last-child').click();
  await tick();
  assert.deepEqual(asked[1], { noticeId: "n4", answer: "none", weaponId: null });
});

test("maneuver: the Keeper answers for an NPC target (Dodge makes CoC7's combat opposed card), not for one whose player is "
  + "online with them assigned; for one whose online owner hasn't them assigned, the Keeper answers", async () => {
  const env = makeEnv({ isGM: true });
  makeDom("<div id='interface'></div><div id='chat'></div>");
  const calls = makeCoC7();
  let assigned = true;
  setPlayerAccess({ playerRollboxOn: () => true, ownCharacter: (user) => (assigned && user?.id === "p1" ? me : null) });
  setAlertHost(null);
  const me = helen();
  me.owners = [{ id: "p1", isGM: false, active: true }];
  const punch = { type: "weapon", id: "seize", name: "Seize (mnvr)", system: { properties: { mnvr: true } } };
  const cultist = { id: "cultist", uuid: "Actor.cultist", name: "Cultist of Dagon", items: [punch], owners: [],
    system: { attribs: { build: { value: 0 } } } };
  const deepOne = { ...helen(), uuid: "Actor.deep", name: "Deep One", owners: [] };
  globalThis.fromUuidSync = (uuid) => ({ "Actor.cultist": cultist, "Actor.helen": me, "Actor.deep": deepOne })[uuid] ?? null;
  registerBeingAttacked();
  env.hooks.createChatMessage.forEach((f) => f(notice("n1")));
  assert.equal(document.querySelector(".rollbox-alert"), null); // Helen's player answers
  assigned = false;
  env.hooks.createChatMessage.forEach((f) => f(notice("n0")));
  assert.equal(document.querySelector(".rollbox-alert .rollbox-alert-title").textContent, "Helen is being attacked");
  document.querySelector(".rollbox-alert").remove();
  const message = notice("n2", { target: "Actor.deep" });
  game.messages = { get: (id) => (id === "n2" ? message : null), contents: [message] };
  env.hooks.createChatMessage.forEach((f) => f(message));
  const alert = document.querySelector(".rollbox-alert");
  assert.equal(alert.querySelector(".rollbox-alert-title").textContent, "Deep One is being attacked");
  alert.querySelector(".rollbox-alert-actions button").click();
  await tick(); await tick();
  assert.deepEqual(message.updates[0], { [`flags.${ID}.maneuver.answer`]: "dodge", [`flags.${ID}.maneuver.defence`]: null });
  assert.deepEqual(calls.linkActorClick[0].options, { check: "check", subtype: "opposed", combat: true,
    rolls: "Actor.cultist#item#Seize (mnvr)#1&&Actor.deep#skill#Dodge#1" });
  for (const hook of ["createChatMessage", "renderChatMessageHTML"]) env.hooks[hook] = []; // the card watches
});

test("melee, Keeper: an NPC or creature targeted by CoC7's melee card gets the Keeper's alert, answered on CoC7's card; an investigator doesn't", async () => {
  const env = makeEnv({ isGM: true });
  makeDom("<div id='interface'></div><div id='chat'></div>");
  setPlayerAccess({ playerRollboxOn: () => false, ownCharacter: () => null });
  setAlertHost(null);
  const me = helen();
  me.type = "character";
  const deepOne = { ...helen(), id: "deep", uuid: "Actor.deep", name: "Deep One", type: "creature" };
  deepOne.items[0].id = "dodge";
  const cultist = { id: "cultist", uuid: "Actor.cultist", name: "Cultist of Dagon", system: { attribs: { build: { value: 0 } } } };
  globalThis.fromUuidSync = (uuid) => ({ "Actor.cultist": cultist, "Actor.helen": me, "Actor.deep": deepOne })[uuid] ?? null;
  game.messages = { get: () => null };
  assert.equal(registerBeingAttacked(), true);
  env.hooks.createChatMessage.forEach((f) => f(meleeCard("m1")));
  assert.equal(document.querySelector(".rollbox-alert"), null); // Helen's player answers her own
  const clicks = renderCard("m2", DEFENDER_BUTTONS);
  env.hooks.createChatMessage.forEach((f) => f(meleeCard("m2", { targetUuid: "Actor.deep" })));
  const alert = document.querySelector(".rollbox-alert");
  assert.equal(alert.querySelector(".rollbox-alert-title").textContent, "Deep One is being attacked");
  assert.deepEqual(alertButtons(alert), ["Dodge", "Fight back", "Counter", "No response"]);
  alert.querySelector(".rollbox-alert-actions button").click();
  await tick();
  assert.deepEqual(clicks, ["dodge"]);
  const rolled = chosen(env, "m2", { itemUuid: "Actor.deep.Item.dodge" });
  await wait(300);
  assert.deepEqual(rolled, ["targetRoll"]);
  env.hooks.updateChatMessage.forEach((f) => f(meleeCard("m2", { targetUuid: "Actor.deep", responded: true })));
  assert.equal(document.querySelector(".rollbox-alert"), null);
});

test("a target the Keeper decided is surprised by this attacker (About to attack) gets no alert, melee or shot at", () => {
  const { env, me } = playerClient();
  me.getFlag = (scope, key) => (key === "surprised" ? { attacker: "Actor.cultist", at: Date.now(), bonus: "die" } : undefined);
  registerBeingAttacked();
  env.hooks.createChatMessage.forEach((f) => f(meleeCard("s1")));
  env.hooks.createChatMessage.forEach((f) => f(shotCard("s2")));
  assert.equal(document.querySelector(".rollbox-alert"), null);
});

test("bug: a maneuver's alert closes once CoC7's opposed card has its result (both failed included), for the player "
  + "who answered; also when the card was rolled before the notice named it", async () => {
  const { env, me } = playerClient();
  armHelen(me);
  const listeners = [];
  game.users.activeGM = game.users[0];
  game.users.get = (id) => game.users.find((user) => user.id === id);
  game.socket = { on: (channel, f) => listeners.push(f), emit: (channel, data) => {
    listeners.forEach((f) => f({ type: "answer", id: data.id, to: "p1", answer: { ok: true } }, "gm1"));
  } };
  const messages = new Map();
  game.messages = { get: (id) => messages.get(id) ?? null, contents: [] };
  let rolled = [false, false];
  game.CoC7 = { messageResults: async () => rolled.map((isRolled) => ({ isRolled, isSuccess: false })) };
  registerRelay();
  registerBeingAttacked();
  const fire = async (hook, message) => {
    for (const f of [...(env.hooks[hook] ?? [])]) await f(message);
    await tick(); await tick();
  };
  const opposed = (id) => ({ id, flags: { CoC7: { load: { as: "CoC7ChatOpposedMessage", isCombat: true } } } });
  const answered = (id, card) => {
    const message = notice(id, { answer: "dodge" });
    message.flags[ID].maneuver.card = card;
    messages.set(id, message);
    return message;
  };
  const alertOf = (id) => document.querySelector(`.rollbox-alert[data-message-id="${id}"]`);
  await fire("createChatMessage", notice("n1"));
  alertOf("n1").querySelector(".rollbox-alert-actions button").click(); // Dodge
  await tick(); await tick();
  messages.set("op1", opposed("op1"));
  await fire("updateChatMessage", answered("n1", "op1"));
  assert.ok(alertOf("n1"), "kept while CoC7's card waits for its rolls");
  await fire("updateChatMessage", opposed("op1"));
  assert.ok(alertOf("n1"), "one side rolled is no result");
  rolled = [true, true];
  await fire("updateChatMessage", opposed("op1"));
  assert.equal(alertOf("n1"), null, "both sides rolled (both failed): closed");
  await fire("createChatMessage", notice("n2"));
  alertOf("n2").querySelector(".rollbox-alert-actions button").click();
  await tick(); await tick();
  messages.set("op2", opposed("op2"));
  await fire("updateChatMessage", answered("n2", "op2"));
  assert.equal(alertOf("n2"), null, "rolled before the notice named it: closed when it does");
});

test("Fight back with no weapon on the sheet (the Keeper's melee alert for a creature): clickable, \"No weapon\" on hover; "
  + "it asks to add the Punch: Cancel changes nothing, Add puts it on the creature's Fighting and fights back with it", async () => {
  const env = makeEnv({ isGM: true });
  makeDom("<div id='interface'></div><div id='chat' class='chat-scroll'></div>");
  setPlayerAccess({ playerRollboxOn: () => false, ownCharacter: () => null });
  setAlertHost(null);
  const fighting = { type: "skill", id: "fighting", name: "Fighting", system: { properties: { fighting: true } } };
  const created = [];
  const deepOne = { ...helen(), id: "deep", uuid: "Actor.deep", name: "Deep One", type: "creature" };
  deepOne.items = [{ type: "skill", id: "dodge", name: "Dodge", system: { isDodge: true } }, fighting];
  deepOne.createEmbeddedDocuments = async (type, data) => {
    const items = data.map((each, i) => ({ ...each, id: `new${i}` }));
    created.push(...items);
    deepOne.items.push(...items);
    return items;
  };
  const cultist = { id: "cultist", uuid: "Actor.cultist", name: "Cultist of Dagon", system: { attribs: { build: { value: 0 } } } };
  globalThis.fromUuidSync = (uuid) => ({ "Actor.cultist": cultist, "Actor.deep": deepOne })[uuid] ?? null;
  game.messages = { get: () => null };
  registerBeingAttacked();
  const clicks = renderCard("m1", DEFENDER_BUTTONS);
  document.querySelector('[data-action="setFightBack"]').addEventListener("click", () => {
    const list = document.createElement("div");
    list.id = "dropdown-m1";
    list.innerHTML = deepOne.items.filter((item) => item.type === "weapon")
      .map((item) => `<button data-action="setItem" data-item-id="${item.id}"></button>`).join("");
    list.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => clicks.push(`setItem:${b.dataset.itemId}`)));
    document.body.append(list);
  });
  env.hooks.createChatMessage.forEach((f) => f(meleeCard("m1", { targetUuid: "Actor.deep" })));
  const alert = document.querySelector(".rollbox-alert");
  const fightBack = alert.querySelectorAll(".rollbox-alert-actions button")[1];
  assert.deepEqual([fightBack.disabled, fightBack.title], [false, "No weapon"]);
  fightBack.click();
  assert.ok(alert.querySelector(".rollbox-alert-prompt"), "the Keeper is asked");
  alert.querySelector(".rollbox-action-prompt-no").click();
  assert.deepEqual([alert.querySelector(".rollbox-alert-prompt"), created.length], [null, 0], "Cancel changes nothing");
  fightBack.click();
  alert.querySelector(".rollbox-action-prompt-yes").click();
  await wait(400);
  assert.deepEqual(created.map((item) => [item.name, item.system.skill.main.id]), [["Fighting", "fighting"]]);
  assert.deepEqual(clicks, ["setFightBack", "setItem:new0"]);
});

test("a player's alert with no weapon to fight back or counter with: both clickable, each says to ask the Keeper; "
  + "nothing is added", () => {
  const { env, me } = playerClient();
  me.createEmbeddedDocuments = async () => assert.fail("nothing may be added for a player");
  registerBeingAttacked();
  env.hooks.createChatMessage.forEach((f) => f(notice("n1")));
  const alert = document.querySelector(".rollbox-alert");
  const [, fightBack, counter] = alert.querySelectorAll(".rollbox-alert-actions button");
  assert.deepEqual([fightBack.disabled, fightBack.title, counter.title], [false, "No weapon", "No maneuver weapon"]);
  fightBack.click();
  assert.match(alert.querySelector(".rollbox-alert-line").textContent, /Ask your Keeper/);
  counter.click();
  assert.match(alert.querySelector(".rollbox-alert-line").textContent, /Ask your Keeper/);
  assert.equal(alert.querySelector(".rollbox-alert-prompt"), null);
});
