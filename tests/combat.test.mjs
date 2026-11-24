import assert from "node:assert/strict";
import { test } from "node:test";
import {
  currentTurn, inCombat, inCombatFor, onCombatGone, onCombatUpdate, onCombatantUpdate, onDelayedTurn, onDelayedTurnChange,
  onTurnChange, registerCombat
} from "../scripts/combat/index.js";
import { buildTurnOrder, rowClicked, turnOrder } from "../scripts/combat/turn-order.js";
import { pickCombatant, pickedCombatant } from "../scripts/combat/turn-pick.js";
import { registerDefeated } from "../scripts/combat/defeated.js";
import { delayTurn, resetTurnControls, restoreDelayed, turnControls } from "../scripts/combat/turn-controls.js";
import {
  attacksMade, clearAiming, clearRoundNotes, defencesUsed, hasActed, isAiming, markActed, markAiming, markAttack,
  markDefended
} from "../scripts/combat/round-notes.js";
import { isFirearm, onPicked, readyForRound } from "../scripts/combat/readied-firearms.js";
import { defenderAnswered, inMeleeWithOthers, isOutnumbered } from "../scripts/combat/situation.js";
import {
  chooseDraw, noticeForPlayer, noticedDraw, postNoticeCard
} from "../scripts/combat/notice-cards.js";
import {
  attackMade, clearFirstBlow, onGunDrawn, onTurn, pendingFirstBlow, placeOnStandby, startFromFirstBlow
} from "../scripts/combat/fight.js";
import { skipsTurn, standingBy } from "../scripts/combat/fight-state.js";
import { fightForPlayer, syncJoinCard } from "../scripts/combat/fight-relay.js";
import { fleeNotice } from "../scripts/combat/flee.js";
import {
  closeFightNotices, closeJoinWindow, closeJoiningCard, openJoinWindow, showFightNotice
} from "../scripts/combat/fight-boxes.js";
import { resetNoticeSizes } from "../scripts/combat/notice-place.js";
import { aboutToAttack, aboutToAttackForPlayer, surprisedBy } from "../scripts/combat/about-to-attack.js";
import { keeperDeciding, resetWaiting } from "../scripts/combat/waiting.js";
import {
  actingChanged, onTargeted, onTokenDeleted, rememberedTarget, resetOwnTarget
} from "../scripts/combat/own-target.js";
import { onConditions, onRoundEnd, resetDying } from "../scripts/combat/dying.js";
import { makeCoC7, makeDom, makeEnv, makeRollActor } from "./mocks.mjs";
import { checkRequest, send } from "../scripts/roll-requests/index.js";

const MODULE = "keepers-rollbox";

/** Foundry's update merges an object into the object stored there; anything else replaces it. */
const plain = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const merged = (old, value) => (plain(old) && plain(value) ? { ...old, ...value } : value);

/** A flag store shaped like Foundry's getFlag / setFlag / unsetFlag, recording each write. */
function withFlags(doc, flags = {}) {
  doc.flags = flags;
  doc.writes = [];
  doc.getFlag = (scope, key) => doc.flags[scope]?.[key];
  doc.setFlag = async (scope, key, value) => {
    (doc.flags[scope] ??= {})[key] = merged(doc.flags[scope][key], value);
    doc.writes.push([key, value]);
  };
  doc.unsetFlag = async (scope, key) => { delete doc.flags[scope]?.[key]; doc.writes.push([key, undefined]); };
  return doc;
}

/** A character for combat: flags, items by id, CoC7's rollInitiative (DEX, + 50 with a gun). */
function fighter(name, { dex = 50, owners = [], weapons = [], picked } = {}) {
  const actor = withFlags(makeRollActor({ name, owners, characteristics: { dex } }));
  for (const w of weapons) actor.items.push({ type: "weapon", id: w.id, name: w.name, system: { properties: w.properties ?? {}, skill: { main: { name: w.skill ?? "" } } } });
  actor.items.get = (id) => actor.items.find((item) => item.id === id);
  if (picked) actor.flags[MODULE] = { pickedWeapon: picked };
  actor.rollInitiative = async (gun) => dex + (gun ? 50 : 0);
  actor.testUserPermission = (user) => owners.includes(user);
  actor.documentName = "Actor";
  return actor;
}

const GUN = { id: "gun", name: ".38 Revolver", properties: { rngd: true } };
const KNIFE = { id: "knife", name: "Knife", properties: {} };

/** A started encounter with these characters, in this turn order; `turn` is the current index. */
function encounter(actors, { turn = 0, round = 1, hidden = [] } = {}) {
  const calls = [];
  const combat = { id: "c1", started: true, round, turn, scene: null, calls };
  combat.turns = actors.map((actor, i) => withFlags({ id: `cb${i}`, actor, token: null, initiative: 50 - i,
    hidden: hidden.includes(actor), parent: combat, delete: async () => calls.push(["deleteCombatant", actor.name]) }));
  // Combatant#update: the initiative and Rollbox's flag; Foundry then re-sorts its turns by initiative.
  for (const combatant of combat.turns) {
    // Like Foundry, the moved combatant keeps the turn unless the `combatTurn` option says where the turn is.
    combatant.update = async (data, options = {}) => {
      calls.push(["update", combatant.actor.name, data.initiative]);
      const current = combat.combatant;
      combatant.initiative = data.initiative;
      const flag = data[`flags.${MODULE}.delayedFrom`];
      if (flag) (combatant.flags[MODULE] ??= {}).delayedFrom = flag;
      combat.turns.sort(foundrySort);
      combat.turn = options.combatTurn ?? combat.turns.indexOf(current);
    };
  }
  Object.defineProperty(combat, "combatant", { get: () => combat.turns[combat.turn] ?? null });
  combat.nextTurn = async () => { calls.push(["nextTurn"]); combat.turn = (combat.turn + 1) % combat.turns.length; };
  combat.nextRound = async () => { calls.push(["nextRound"]); combat.round += 1; combat.turn = 0; };
  combat.delete = async () => calls.push(["deleteCombat"]);
  // Combat#setInitiative: Foundry re-sorts and follows the current combatant; the updateCombatant hook fires.
  combat.setInitiative = async (id, value) => {
    calls.push(["setInitiative", id, value]);
    const current = combat.combatant;
    const combatant = combat.turns.find((c) => c.id === id);
    combatant.initiative = value;
    combat.turns.sort(foundrySort);
    combat.turn = combat.turns.indexOf(current);
    Hooks.callAll("updateCombatant", combatant, { initiative: value });
  };
  // Combat#updateEmbeddedDocuments("Combatant"): each update applied (initiative, flags set or `-=` removed); Foundry
  // then re-sorts and follows the current combatant unless the `combatTurn` option says where the turn is.
  combat.updateEmbeddedDocuments = async (name, updates, options = {}) => {
    const current = combat.combatant;
    for (const { _id, ...data } of updates) {
      const combatant = combat.turns.find((c) => c.id === _id);
      for (const [key, value] of Object.entries(data)) {
        const [scope, flag] = key.startsWith("flags.") ? key.slice(6).split(/\.(.*)/) : [];
        if (!scope) combatant[key] = value;
        else if (flag.startsWith("-=")) delete combatant.flags[scope]?.[flag.slice(2)];
        else (combatant.flags[scope] ??= {})[flag] = value;
      }
    }
    combat.turns.sort(foundrySort);
    combat.turn = options.combatTurn ?? combat.turns.indexOf(current);
  };
  combat.update = async (data) => { calls.push(["updateCombat", data]); Object.assign(combat, data); };
  game.combat = combat;
  trackerFor(combat);
  return combat;
}

// Foundry v14 `Combat#_sortCombatants`: initiative down, ties by id.
function foundrySort(x, y) {
  return (y.initiative - x.initiative) || (x.id > y.id ? 1 : -1);
}

/** Foundry's combat tracker with CoC7's Draw gun button on each row, its onclick doing what CoC7's `_onToggleGun` does. */
function trackerFor(combat) {
  const root = document.createElement("div");
  for (const combatant of combat.turns) {
    const row = document.createElement("li");
    row.className = "combatant";
    row.dataset.combatantId = combatant.id;
    const gun = document.createElement("button");
    gun.dataset.control = "drawGun";
    gun.onclick = async (event) => {
      const c = combat.turns.find((t) => t.id === event.currentTarget.closest(".combatant").dataset.combatantId);
      await c.setFlag("CoC7", "hasGun", !c.getFlag("CoC7", "hasGun"));
      const init = await c.actor.rollInitiative(Boolean(c.getFlag("CoC7", "hasGun")));
      if (!c.getFlag("CoC7", "hasGun") || c.initiative < init) combat.setInitiative(c.id, init);
    };
    row.append(gun);
    root.append(row);
  }
  globalThis.ui = { combat: { element: root }, notifications: { warn() {}, info() {} } };
}

function setup(options) {
  const env = makeEnv(options);
  makeDom();
  globalThis.canvas = undefined;
  resetTurnControls();
  return env;
}

const texts = (root, selector) => [...root.querySelectorAll(selector)].map((node) => node.textContent);

// --- Encounter and turn order ---------------------------------------------------------------------

test("inCombat and currentTurn: nothing without a started encounter; the current combatant's character with one", () => {
  setup();
  assert.equal(inCombat(), false);
  assert.equal(currentTurn(), null);
  const [a, b] = [fighter("Harvey"), fighter("Cultist")];
  encounter([a, b], { turn: 1 });
  assert.equal(inCombat(), true);
  assert.equal(currentTurn().actor, b);
});

test("turnOrder: Foundry's order, never rotated; those before the current turn done", () => {
  setup();
  const actors = ["A", "B", "C", "D"].map((name) => fighter(name));
  const order = turnOrder(encounter(actors, { turn: 2 }));
  assert.deepEqual(order.map((entry) => entry.actor.name), ["A", "B", "C", "D"]);
  assert.deepEqual(order.map((entry) => entry.current), [false, false, true, false]);
  assert.deepEqual(order.map((entry) => entry.done), [true, true, false, false]);
});

test("buildTurnOrder: the full card opens in its own place, rows above and below in their own group cards, End of "
  + "round under the last fighter, the standing-by group under it whatever is selected", () => {
  setup();
  const actors = ["A", "B", "C", "D", "E"].map((name) => fighter(name));
  const [, , , d, e] = actors;
  const combat = encounter(actors, { turn: 1, round: 2 });
  combat.turns[4].flags[MODULE] = { standingBy: "out" };
  const layout = (root) => [...root.children].map((node) => {
    if (node.classList.contains("rollbox-turn-rows")) {
      const names = texts(node, ".rollbox-name").join(",");
      return node.classList.contains("rollbox-turn-standing") ? `standing:${names}` : `rows:${names}`;
    }
    if (node.classList.contains("rollbox-sheet")) return `sheet:${node.querySelector(".rollbox-name").textContent}`;
    if (node.classList.contains("rollbox-turn-round-end")) return node.textContent;
    return null;
  }).filter(Boolean);
  assert.deepEqual(layout(buildTurnOrder({ combat, user: game.user })),
    ["rows:A", "sheet:B", "rows:C,D", "End of round 2", "standing:E"]);
  assert.deepEqual(layout(buildTurnOrder({ combat, user: game.user, focus: [d] })),
    ["rows:A,B,C", "sheet:D", "End of round 2", "standing:E"]);
  const picked = buildTurnOrder({ combat, user: game.user, focus: [e] });
  assert.deepEqual(layout(picked), ["rows:A,B,C,D", "End of round 2", "sheet:E"]);
  assert.ok(picked.querySelector(".rollbox-sheet").classList.contains("rollbox-turn-picked"));
  assert.ok(picked.querySelector(".rollbox-turn-row-card.rollbox-turn-current"), "the current turn's row keeps its red outline");
});

test("buildTurnOrder for the Keeper: round header, the current turn as the outlined sheet, the rest as rows (an NPC's reads \"NPC\"), readied firearm shown", () => {
  setup();
  const [a, b, c] = [fighter("Harvey"), fighter("Cultist"), fighter("Helen")];
  const combat = encounter([a, b, c], { turn: 1, round: 3 });
  combat.turns[2].flags.CoC7 = { hasGun: true };
  const root = buildTurnOrder({ combat, user: game.user });
  assert.equal(root.querySelector(".rollbox-turn-title").textContent, "Combat · Round 3");
  const sheet = root.querySelector(".rollbox-sheet");
  assert.ok(sheet.classList.contains("rollbox-turn-current"));
  assert.equal(sheet.querySelector(".rollbox-name").textContent, "Cultist");
  assert.deepEqual(texts(root, ".rollbox-turn-row-card .rollbox-name"), ["Harvey", "Helen"]);
  assert.equal(root.querySelectorAll(".rollbox-turn-row-card .rollbox-sub")[1].textContent, "NPC · Readied firearm");
  c.flags[MODULE] = { roundNotes: { combat: "c1", round: 3, stood: true } };
  const again = buildTurnOrder({ combat, user: game.user });
  assert.match(again.querySelectorAll(".rollbox-turn-row-card .rollbox-sub")[1].textContent, /Stood their ground/);
});

test("buildTurnOrder for a player: their own character is the sheet in its place, the acting row outlined, hidden combatants left out", () => {
  setup({ isGM: false });
  const [a, b, c] = [fighter("Harvey"), fighter("Cultist"), fighter("Lurker")];
  const combat = encounter([a, b, c], { turn: 1, hidden: [c] });
  const root = buildTurnOrder({ combat, user: game.user, own: a });
  assert.equal(root.querySelector(".rollbox-sheet .rollbox-name").textContent, "Harvey");
  assert.equal(root.querySelector(".rollbox-sheet").classList.contains("rollbox-turn-current"), false);
  assert.deepEqual(texts(root, ".rollbox-turn-row-card .rollbox-name"), ["Cultist"]);
  assert.ok(root.querySelector(".rollbox-turn-row-card").classList.contains("rollbox-turn-current"));
});

// --- Turn controls ---------------------------------------------------------------------------------

const press = (root, selector) => root.querySelector(selector).click();
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * A turn start as the Keeper's turn queue runs it: onTurn, then again for each turn Rollbox's own skip moved to (the
 * mock's nextTurn fires no hook).
 */
async function turnStart(combat, changes) {
  let moved = await onTurn(combat, changes);
  while (moved) moved = await onTurn(combat, { turn: combat.turn }, { rollboxOwnStep: true });
}

test("turnControls: End turn asks first (red, Confirm end turn), the second press moves to the next turn", async () => {
  setup();
  const combat = encounter([fighter("A"), fighter("B")]);
  const root = document.createElement("div");
  root.append(turnControls({ combat, user: game.user }));
  press(root, ".rollbox-turn-end");
  const asking = root.querySelector(".rollbox-turn-end");
  assert.match(asking.textContent, /^Confirm/);
  assert.ok(asking.classList.contains("rollbox-confirm"));
  assert.deepEqual(combat.calls, []);
  asking.click();
  await settle();
  assert.deepEqual(combat.calls, [["nextTurn"]]);
});

test("turnControls: Delay asks at once as [←] Confirm delay [→]; → moves one more place (shown live, \"Confirm delay "
  + "(2)\"), ← one back; Confirm with no arrow goes to the end", async () => {
  setup();
  const [a, b, c, d] = [fighter("A"), fighter("B"), fighter("C"), fighter("D")];
  const combat = encounter([a, b, c, d]);
  const draw = () => buildTurnOrder({ combat, user: game.user, onChange: () => { root = draw(); } });
  let root = draw();
  press(root, ".rollbox-turn-delay");
  assert.equal(root.querySelector(".rollbox-turn-end").textContent, "Confirm delay");
  assert.ok(root.querySelector(".rollbox-turn-up").disabled);
  for (let i = 0; i < 4; i += 1) press(root, ".rollbox-turn-down");
  assert.equal(root.querySelector(".rollbox-turn-end").textContent, "Confirm delay (3)"); // three people after A
  assert.ok(root.querySelector(".rollbox-turn-down").disabled);
  press(root, ".rollbox-turn-up");
  assert.equal(root.querySelector(".rollbox-turn-end").textContent, "Confirm delay (2)");
  assert.deepEqual(texts(root, ".rollbox-turn-row-card .rollbox-name, .rollbox-sheet .rollbox-name"), ["B", "C", "A", "D"]);
  press(root, ".rollbox-turn-end");
  await settle();
  assert.deepEqual(combat.turns.map((t) => t.actor.name), ["B", "C", "A", "D"]);
  assert.equal(combat.combatant.actor.name, "B"); // the next person acts now
  assert.deepEqual(combat.turns[2].flags[MODULE].delayedFrom, { round: 1, initiative: 50 });
  assert.equal(a.flags[MODULE].roundNotes.delayed, true);
  assert.equal(combat.calls.some(([call]) => call === "nextTurn"), false);
  resetTurnControls();
  const other = document.createElement("div");
  other.append(turnControls({ combat, user: game.user }));
  press(other, ".rollbox-turn-delay");
  press(other, ".rollbox-turn-end");
  await settle();
  assert.equal(combat.turns.at(-1).actor.name, "B"); // no arrow: to the end
});

test("turnControls: Delay and Flee are hidden, not greyed, while the selected character isn't the current turn's",
  () => {
  setup();
  const combat = encounter([fighter("A"), fighter("B")]);
  const off = turnControls({ combat, user: game.user, selected: combat.turns[1] });
  assert.deepEqual(texts(off, "button"), ["End turn", "End combat"]);
  assert.equal(off.querySelector(".rollbox-turn-note"), null);
  const on = turnControls({ combat, user: game.user, selected: combat.turns[0] });
  assert.deepEqual(texts(on, "button"), ["Delay", "Flee", "End turn", "End combat"]);
});

test("turnControls: a Restrained character's Flee is greyed with \"Restrained: break free first\" in its hover (no line "
  + "under the buttons); the Keeper's reads Override on hover and still turns Flee on, a player's can't be pressed", () => {
  setup();
  const held = fighter("A", { owners: [game.users?.[1]].filter(Boolean) });
  held.flags[MODULE] = { statuses: { restrained: true } };
  const combat = encounter([held, fighter("B")]);
  const root = document.createElement("div");
  root.append(turnControls({ combat, user: game.user }));
  const flee = root.querySelector(".rollbox-turn-flee");
  assert.ok(flee.classList.contains("rollbox-turn-held") && !flee.disabled);
  assert.match(flee.title, /restrained/i);
  assert.equal(root.querySelector(".rollbox-turn-note"), null);
  flee.dispatchEvent(new flee.ownerDocument.defaultView.MouseEvent("mouseenter"));
  assert.equal(flee.textContent, "Override");
  flee.click();
  assert.match(root.querySelector(".rollbox-turn-end").textContent, /confirm.*flee/i);
  resetTurnControls();
  const player = { isGM: false };
  held.testUserPermission = (user) => user === player;
  const theirs = turnControls({ combat, user: player });
  assert.ok(theirs.querySelector(".rollbox-turn-flee").disabled);
  assert.match(theirs.querySelector(".rollbox-turn-flee").title, /restrained/i);
});

test("turnControls: the last fighter of the round can press the Keeper's Delay: Place on standby · Leave out take End "
  + "turn's row, End combat under them, Delay again puts End turn back; a player's Delay is greyed with its reason "
  + "in the hover", () => {
  setup();
  const last = fighter("B", { owners: [game.users?.[1]].filter(Boolean) });
  const combat = encounter([fighter("A"), last], { turn: 1 });
  const rows = (root) => [...root.querySelectorAll(".rollbox-turn-row, .rollbox-turn-controls > button")]
    .map((row) => (row.tagName === "BUTTON" ? [row] : [...row.querySelectorAll("button")]).map((b) => b.textContent));
  const root = turnControls({ combat, user: game.user, onChange: () => {} });
  assert.equal(root.querySelector(".rollbox-turn-delay").disabled, false);
  press(root, ".rollbox-turn-delay");
  const delayed = turnControls({ combat, user: game.user, onChange: () => {} });
  assert.deepEqual(rows(delayed), [["Delay", "Flee"], ["Place on standby", "Leave out"], ["End combat"]]);
  press(delayed, ".rollbox-turn-delay");
  assert.deepEqual(rows(turnControls({ combat, user: game.user, onChange: () => {} })),
    [["Delay", "Flee"], ["End turn"], ["End combat"]]);
  resetTurnControls();
  const player = { isGM: false };
  last.testUserPermission = (user) => user === player;
  const delay = turnControls({ combat, user: player }).querySelector(".rollbox-turn-delay");
  assert.ok(delay.disabled);
  assert.match(delay.title, /nobody to delay behind/);
});

test("turnControls: Delay pressed puts [←] Confirm delay [→] in End turn's row and Place on standby · Leave out in "
  + "End combat's; Leave out asks once and keeps them out of the fight; Place on standby ends the turn at once", async () => {
  setup();
  const [a, b, c] = [fighter("A"), fighter("B"), fighter("C")];
  const combat = withFlags(encounter([a, b, c]));
  const [first] = combat.turns;
  first.update = async (changes) => applyChanges(first, changes);
  first.tokenId = "t0";
  let root = null;
  const draw = () => { root = turnControls({ combat, user: game.user, onChange: draw }); };
  draw();
  assert.equal(root.querySelector(".rollbox-turn-standby-button, .rollbox-turn-leave-out"), null);
  press(root, ".rollbox-turn-delay");
  assert.deepEqual(texts(root, "button"),
    ["Delay", "Flee", "←", "Confirm delay", "→", "Place on standby", "Leave out"]);
  press(root, ".rollbox-turn-leave-out");
  assert.match(root.querySelector(".rollbox-turn-leave-out").textContent, /confirm/i);
  assert.ok(root.querySelector(".rollbox-turn-delay-row"), "Delay stays on while Leave out asks");
  press(root, ".rollbox-turn-delay");
  assert.equal(root.querySelector(".rollbox-turn-standby-button, .rollbox-turn-leave-out"), null);
  assert.deepEqual(texts(root, "button"), ["Delay", "Flee", "End turn", "End combat"]);
  press(root, ".rollbox-turn-delay");
  press(root, ".rollbox-turn-standby-button");
  await settle();
  assert.equal(standingBy(first), "out");
  assert.deepEqual(combat.calls.at(-1), ["updateCombat", { turn: 1 }], "the turn passed to B at once");
  delete first.flags[MODULE].standingBy;
  combat.turn = 0;
  draw();
  press(root, ".rollbox-turn-delay");
  press(root, ".rollbox-turn-leave-out");
  press(root, ".rollbox-turn-leave-out");
  await settle();
  assert.deepEqual(combat.calls.at(-1), ["deleteCombatant", "A"]);
  assert.deepEqual(combat.flags[MODULE].leftOut, ["t0"]);
});

test("turnControls: a selected standing-by combatant has Act this round · Leave out, Remove from standby and End "
  + "combat only; Remove from standby makes them a fighter again, at their own place in the order", async () => {
  setup();
  const combat = encounter([fighter("A"), fighter("B"), fighter("C")]);
  const second = combat.turns[1];
  second.update = async (changes) => applyChanges(second, changes);
  second.flags[MODULE] = { standingBy: "out" };
  const root = turnControls({ combat, user: game.user, selected: second, onChange: () => {} });
  assert.deepEqual(texts(root, "button"), ["Act this round", "Leave out", "Remove from standby", "End combat"]);
  press(root, ".rollbox-turn-remove-standby");
  await settle();
  assert.equal(standingBy(second), null);
  assert.deepEqual(combat.turns.map((t) => t.actor.name), ["A", "B", "C"]);
  const fighting = turnControls({ combat, user: game.user, selected: second });
  assert.deepEqual(texts(fighting, "button"), ["End turn", "End combat"]);
});

test("delayTurn and restoreDelayed: past everyone goes last; the next round puts their own initiative back", async () => {
  setup();
  const [a, b, c] = [fighter("A"), fighter("B"), fighter("C")];
  const combat = encounter([a, b, c]);
  assert.equal(await delayTurn(combat, 9), true);
  assert.deepEqual(combat.turns.map((t) => t.actor.name), ["B", "C", "A"]);
  assert.equal(await restoreDelayed(combat), 0); // same round: stays
  combat.round = 2;
  assert.equal(await restoreDelayed(combat), 1);
  assert.deepEqual(combat.turns.map((t) => t.actor.name), ["A", "B", "C"]);
  assert.equal(combat.turns[0].flags[MODULE].delayedFrom, undefined);
});

test("Delay moves one place per press, a tie in the way included; landing inside a tie sits exactly there, and the "
  + "next round puts the tied ones back", async () => {
  setup();
  const tied = () => {
    const combat = encounter(["A", "B", "C", "D", "E"].map((name) => fighter(name)));
    for (const [i, value] of [[1, 49], [2, 49], [3, 49], [4, 47]]) combat.turns[i].initiative = value; // B, C, D tie
    return combat;
  };
  let combat = tied();
  const draw = () => buildTurnOrder({ combat, user: game.user, onChange: () => { root = draw(); } });
  let root = draw();
  press(root, ".rollbox-turn-delay");
  for (const places of [1, 2, 3]) {
    press(root, ".rollbox-turn-down");
    assert.equal(root.querySelector(".rollbox-turn-end").textContent, `Confirm delay (${places})`);
  }
  press(root, ".rollbox-turn-up");
  assert.equal(root.querySelector(".rollbox-turn-end").textContent, "Confirm delay (2)");
  resetTurnControls();
  assert.equal(await delayTurn(combat, 3), true);
  assert.deepEqual(combat.turns.map((t) => t.actor.name), ["B", "C", "D", "A", "E"]);
  combat = tied();
  assert.equal(await delayTurn(combat, 1), true);
  assert.deepEqual(combat.turns.map((t) => t.actor.name), ["B", "A", "C", "D", "E"]);
  assert.equal(combat.combatant.actor.name, "B");
  combat.round = 2;
  await restoreDelayed(combat);
  assert.deepEqual(combat.turns.map((t) => [t.actor.name, t.initiative]), [["A", 50], ["B", 49], ["C", 49], ["D", 49], ["E", 47]]);
});

test("L4: a player's attack and the Keeper's defence noted at the same moment on one character both stay", async () => {
  setup();
  const helen = fighter("Helen");
  encounter([helen]);
  await markActed(helen);
  // Both writes read the note before either lands, as two clients do.
  const store = helen.setFlag;
  const waiting = [];
  helen.setFlag = (...args) => new Promise((resolve) => waiting.push(() => store(...args).then(resolve)));
  const both = Promise.all([markAttack(helen, 2), markDefended(helen, "m1")]);
  await settle();
  for (const write of waiting) await write();
  await both;
  assert.equal(attacksMade(helen), 1);
  assert.equal(defencesUsed(helen), 1);
  assert.equal(hasActed(helen), true);
});

test("delayTurn does nothing for the last in the order or past an unrolled initiative", async () => {
  setup();
  const [a, b] = [fighter("A"), fighter("B")];
  const combat = encounter([a, b], { turn: 1 });
  assert.equal(await delayTurn(combat, 1), false);
  combat.turn = 0;
  combat.turns[1].initiative = null;
  assert.equal(await delayTurn(combat, 1), false);
  assert.deepEqual(combat.calls, []);
});

test("bug: turnControls: Flee asks at once (Confirm flee combat), then notes fled and ends the turn; the Keeper's Flee also removes the combatant", async () => {
  setup();
  const [a, b, c] = [fighter("A"), fighter("B"), fighter("C")];
  const combat = encounter([a, b, c], { turn: 1 });
  const root = document.createElement("div");
  root.append(turnControls({ combat, user: game.user }));
  press(root, ".rollbox-turn-flee");
  assert.match(root.querySelector(".rollbox-turn-end").textContent, /confirm.*flee/i);
  press(root, ".rollbox-turn-flee");
  assert.equal(root.querySelector(".rollbox-turn-end").textContent, "End turn");
  press(root, ".rollbox-turn-flee");
  press(root, ".rollbox-turn-end");
  await settle();
  assert.equal(b.flags[MODULE].roundNotes.fled, true);
  assert.deepEqual(combat.calls, [["nextTurn"], ["deleteCombatant", "B"]]);
});

test("turnControls: End combat asks, then deletes the encounter", async () => {
  setup();
  const combat = encounter([fighter("A")]);
  const root = document.createElement("div");
  root.append(turnControls({ combat, user: game.user }));
  press(root, ".rollbox-turn-end-combat");
  assert.match(root.querySelector(".rollbox-turn-end-combat").textContent, /confirm/i);
  press(root, ".rollbox-turn-end-combat");
  await settle();
  assert.deepEqual(combat.calls, [["deleteCombat"]]);
});

test("turnControls: a player gets End my turn on their own turn, and nothing on someone else's", () => {
  setup({ isGM: false });
  const mine = fighter("Harvey", { owners: [game.user] });
  const combat = encounter([fighter("Cultist"), mine]);
  assert.equal(turnControls({ combat, user: game.user }), null);
  combat.turn = 1;
  const controls = turnControls({ combat, user: game.user });
  assert.equal(controls.querySelector(".rollbox-turn-end").textContent, "End my turn");
  assert.equal(controls.querySelector(".rollbox-turn-end-combat"), null);
});

// --- Round notes -----------------------------------------------------------------------------------

test("round notes: a mark counts in its own round only, needs an encounter, and clearRoundNotes removes it", async () => {
  setup();
  const a = fighter("A");
  assert.equal(await markAiming(a), false);
  const combat = encounter([a]);
  assert.equal(await markAiming(a), true);
  assert.equal(await markActed(a), true);
  assert.equal(isAiming(a), true);
  assert.equal(hasActed(a), true);
  combat.round = 2;
  assert.equal(isAiming(a), false);
  assert.equal(await clearRoundNotes(combat), 1);
  assert.equal(a.flags[MODULE].roundNotes, undefined);
});

test("round notes: a new round carries Aiming over once, for the aimed shot; clearAiming ends it, the rest stays", async () => {
  setup();
  const a = fighter("A");
  const combat = encounter([a]);
  await markAiming(a);
  await markActed(a);
  combat.round = 2;
  await clearRoundNotes(combat, { carryAiming: true });
  assert.deepEqual([isAiming(a), hasActed(a)], [true, false]);
  await markActed(a);
  assert.equal(await clearAiming(a), true);
  assert.deepEqual([isAiming(a), hasActed(a)], [false, true]);
  await markAiming(a);
  combat.round = 3;
  await clearRoundNotes(combat, { carryAiming: true });
  assert.equal(isAiming(a), true); // aimed again in round 2
  combat.round = 4;
  await clearRoundNotes(combat, { carryAiming: true });
  assert.equal(isAiming(a), false); // carried once only
});

// --- Readied firearms --------------------------------------------------------------------------------

test("isFirearm: a ranged weapon readies; melee, thrown and bows don't, bows only with their setting", () => {
  const env = setup();
  const weapon = (name, properties, skill = "") => ({ type: "weapon", name, system: { properties, skill: { main: { name: skill } } } });
  assert.equal(isFirearm(weapon(".38 Revolver", { rngd: true })), true);
  assert.equal(isFirearm(weapon("Knife", {})), false);
  assert.equal(isFirearm(weapon("Throwing knife", { rngd: true, thrown: true })), false);
  const bow = weapon("Hunting gear", { rngd: true }, "Firearms (Bow)");
  assert.equal(isFirearm(bow), false);
  env.registered.rollboxBowsReadied = { default: false };
  env.values.rollboxBowsReadied = true;
  assert.equal(isFirearm(bow), true);
});

test("readyForRound: Draw gun and DEX + 50 for a picked gun, off for a picked knife, untouched without a pick; nothing with the setting off", async () => {
  const env = setup();
  const shooter = fighter("Harvey", { dex: 60, weapons: [GUN], picked: "gun" });
  const stabber = fighter("Cultist", { dex: 40, weapons: [KNIFE], picked: "knife" });
  const idle = fighter("Helen", { dex: 70 });
  const combat = encounter([shooter, stabber, idle]);
  combat.turns[1].flags.CoC7 = { hasGun: true };
  combat.turns[2].flags.CoC7 = { hasGun: true };
  const [gun, knife, untouched] = [...combat.turns];
  assert.equal(await readyForRound(combat), 2);
  assert.equal(gun.flags.CoC7.hasGun, true);
  assert.equal(gun.initiative, 110);
  assert.equal(knife.flags.CoC7.hasGun, false);
  assert.equal(knife.initiative, 40);
  assert.equal(untouched.flags.CoC7.hasGun, true);
  env.registered.rollboxReadiedFirearms = { default: true };
  env.values.rollboxReadiedFirearms = false;
  gun.flags.CoC7.hasGun = false;
  assert.equal(await readyForRound(combat), 0);
});

test("bug: a gun readied at the top of a round acts first in that round, not after the old first", async () => {
  setup();
  const first = fighter("Helen", { dex: 70 });
  const shooter = fighter("Cecil", { dex: 60, weapons: [GUN], picked: "gun" });
  const combat = encounter([first, shooter], { turn: 0, round: 2 });
  await readyForRound(combat);
  assert.equal(combat.combatant.actor, shooter);
});

test("readyForRound: without CoC7's Draw gun button in the tracker nothing is set and the Keeper is told", async () => {
  setup();
  const shooter = fighter("Cecil", { dex: 60, weapons: [GUN], picked: "gun" });
  const combat = encounter([shooter]);
  const told = [];
  globalThis.ui = { combat: { element: document.createElement("div") }, notifications: { warn: (text) => told.push(text) } };
  assert.equal(await readyForRound(combat), 0);
  assert.equal(combat.turns[0].getFlag("CoC7", "hasGun"), undefined);
  assert.match(told[0], /Draw gun on for Cecil/);
});

test("onPicked: a knife mid-round un-readies at once; another gun does only while switching loses the readied firearm", async () => {
  const env = setup();
  const OTHER = { id: "rifle", name: "Rifle", properties: { rngd: true } };
  const actor = fighter("Harvey", { weapons: [GUN, KNIFE, OTHER], picked: "gun" });
  const combat = encounter([fighter("Helen"), actor]);
  combat.turns[0].initiative = 200; // Helen acts first, so Harvey's turn hasn't come
  await readyForRound(combat);
  actor.flags[MODULE].pickedWeapon = "rifle";
  env.registered.rollboxSwitchLosesReadied = { default: true };
  env.values.rollboxSwitchLosesReadied = false;
  const harvey = () => combat.turns.find((c) => c.actor === actor);
  assert.equal(await onPicked(actor), false);
  assert.equal(harvey().flags.CoC7.hasGun, true);
  actor.flags[MODULE].pickedWeapon = "gun";
  env.values.rollboxSwitchLosesReadied = true;
  assert.equal(await onPicked(actor), true);
  assert.equal(harvey().flags.CoC7.hasGun, false);
  await readyForRound(combat);
  actor.flags[MODULE].pickedWeapon = "knife";
  assert.equal(await onPicked(actor), true);
  assert.equal(harvey().flags.CoC7.hasGun, false);
  actor.flags[MODULE].pickedWeapon = "gun";
  await readyForRound(combat);
  delete actor.flags[MODULE].pickedWeapon;
  assert.equal(await onPicked(actor), true);
  assert.equal(harvey().flags.CoC7.hasGun, false);
});

test("holstering on his own turn after firing: Draw gun off at once, the Hybrid now above him acts next, and his "
  + "turn this round is skipped", async () => {
  setup();
  const cecil = fighter("Cecil", { dex: 60, weapons: [GUN, KNIFE], picked: "gun" });
  const hybrid = fighter("Hybrid", { dex: 70 });
  const combat = encounter([hybrid, cecil], { round: 2 });
  combat.turns[0].initiative = 65; // above Cecil's DEX 60, below his readied 110
  await readyForRound(combat);
  assert.equal(combat.combatant.actor, cecil); // readied: Cecil acts first, then the Hybrid
  await markActed(cecil); // he fires
  cecil.flags[MODULE].pickedWeapon = "knife";
  assert.equal(await onPicked(cecil), true);
  assert.equal(combat.turns.find((c) => c.actor === cecil).flags.CoC7.hasGun, false);
  assert.equal(combat.combatant.actor, hybrid);
  assert.equal(skipsTurn(combat.turns.find((c) => c.actor === cecil), combat), true);
});

test("holstering after his turn has gone: Draw gun off at once and, now below the current turn, he doesn't act again",
  async () => {
    setup();
    const cecil = fighter("Cecil", { dex: 40, weapons: [GUN, KNIFE], picked: "gun" });
    const others = ["Hybrid", "Cultist"].map((name) => fighter(name, { dex: 60 }));
    const combat = encounter([cecil, ...others], { round: 2 });
    await readyForRound(combat);
    combat.turns.find((c) => c.actor === others[0]).initiative = 70;
    combat.turn = 1; // Cecil (90) has had his turn; the Hybrid acts
    cecil.flags[MODULE].pickedWeapon = null;
    assert.equal(await onPicked(cecil), true);
    assert.deepEqual(combat.turns.map((c) => c.actor.name), ["Hybrid", "Cultist", "Cecil"]);
    assert.equal(combat.combatant.actor.name, "Hybrid");
    assert.equal(skipsTurn(combat.turns[2], combat), true);
  });

// --- Notice cards ------------------------------------------------------------------------------------

/** A canvas in metres with tokens at x positions; a wall stands at x = `wallAt` (sight blocked across it). */
function canvasWith(placed, { wallAt = Infinity } = {}) {
  const placeables = placed.map(([actor, x], i) => ({ id: `t${i}`, actor, center: { x, y: 0 },
    document: { actorId: actor.id, hidden: false } }));
  for (const token of placeables) token.actor.getActiveTokens = () => [token];
  globalThis.canvas = { scene: { id: "s1", grid: { units: "m" } }, tokens: { placeables },
    grid: { units: "m", size: 1, distance: 1 } };
  globalThis.CONFIG.Canvas = { polygonBackends: { sight: {
    testCollision: (a, b) => Math.min(a.x, b.x) < wallAt && Math.max(a.x, b.x) > wallAt } } };
  return placeables;
}

/** The weapon-drawn pop-up showing, or null. */
const drawnPopup = () => document.querySelector(".rollbox-popup[data-kind='weaponDrawn']");
/** Press a button on the weapon-drawn pop-up by its words. */
async function pressDrawn(words) {
  [...drawnPopup().querySelectorAll("button")].find((node) => node.textContent === words).click();
  await settle();
}

test("postNoticeCard: the Keeper's pop-up above the hotbar names who is within 20 m and in sight; nothing in combat, "
  + "for the unarmed weapon or for a creature", async () => {
  setup();
  closeFightNotices();
  makeCoC7();
  const [drawer, near, far, walled] = ["Harvey", "Helen", "Faraway", "Behind"].map((name) => fighter(name, { weapons: [GUN] }));
  canvasWith([[drawer, 0], [near, 15], [far, 40], [walled, -10]], { wallAt: -5 });
  const shown = await postNoticeCard({ actor: drawer, weapon: drawer.items.find((item) => item.id === "gun") });
  assert.deepEqual(shown.data.watchers.map((w) => w.name), ["Helen"]);
  assert.ok(drawnPopup().closest(".rollbox-fight-notices"), "in the stack above the hotbar");
  assert.match(drawnPopup().textContent, /Harvey draws .38 Revolver./);
  assert.deepEqual(texts(drawnPopup(), ".rollbox-popup-name"), ["Helen"]);
  closeFightNotices();
  const punch = { type: "weapon", id: "punch", name: "Punch", flags: { CoC7: { cocidFlag: { id: "i.weapon.brawl" } } },
    system: { properties: {} } };
  assert.equal(await postNoticeCard({ actor: drawer, weapon: punch }), null, "the unarmed weapon");
  drawer.type = "creature";
  assert.equal(await postNoticeCard({ actor: drawer, weapon: drawer.items[0] }), null, "a creature");
  drawer.type = "character";
  encounter([drawer]);
  assert.equal(await postNoticeCard({ actor: drawer, weapon: drawer.items[0] }), null, "in combat");
  assert.equal(drawnPopup(), null);
});

/** CoC7's check card for this character: its hook as CoC7 would fire it, with this rolled result. */
async function cardFor(hooks, actor, result) {
  game.CoC7.messageResults = async () => [{ isRolled: true, ...result }];
  for (const hook of [...(hooks.createChatMessage ?? [])]) {
    await hook({ flags: { CoC7: { load: { as: "CoC7Check", actorUuid: actor.uuid } } } });
  }
}

test("weapon-drawn pop-up: Roll to notice asks an investigator with a player online through their player, and rolls "
  + "one with none online and an NPC privately for the Keeper at once (no request to the Keeper, no standby card, no "
  + "note); each row waits, then reads its result, and a player who noticed is told; Start combat and Ignore stay",
async () => {
  const { hooks } = setup();
  closeFightNotices();
  makeCoC7();
  const env = { chat: [] };
  globalThis.ChatMessage.create = (data) => env.chat.push(data);
  game.users[1].active = true;
  const drawer = fighter("Harvey", { weapons: [KNIFE] });
  const helen = fighter("Helen", { owners: [game.users[1]] });
  const martin = fighter("Martin", { owners: [game.users[2]] });
  const guard = fighter("Guard");
  guard.type = "npc";
  canvasWith([[drawer, 0], [helen, 5], [martin, 6], [guard, 7]]);
  const spotHidden = { name: "Spot Hidden", flags: { CoC7: { cocidFlag: { id: "i.skill.spot-hidden" } } } };
  globalThis.fromUuidSync = (uuid) => [helen, martin, guard].find((a) => a.uuid === uuid)
    ?? (uuid === "item:spot" ? spotHidden : null);
  drawer.items.find((item) => item.id === "knife").type = "weapon";
  await postNoticeCard({ actor: drawer, weapon: drawer.items.find((item) => item.id === "knife") });
  await pressDrawn("Roll to notice");
  assert.deepEqual(env.chat.map((c) => [c.whisper, /subtype:skill,name:i.skill.spot-hidden/.test(c.content)]),
    [[["p1"], true]], "only Helen's player gets a request; no note for Martin or the Guard");
  assert.equal(martin.calls.length, 1, "Martin rolled privately");
  assert.equal(martin.calls[0][0], "runRoll", "through runRoll: CoC7's skillCheck would post a standby card");
  assert.equal(guard.calls.length, 1, "the Guard rolled privately");
  assert.deepEqual(texts(drawnPopup(), ".rollbox-popup-status"), ["Waiting", "Waiting", "Waiting"]);
  assert.deepEqual(texts(drawnPopup(), ".rollbox-popup-buttons button"), ["Start combat", "Ignore"]);
  await cardFor(hooks, helen, { isSuccess: true, type: "skill", key: "item:spot" });
  await cardFor(hooks, guard, { isSuccess: false, type: "skill", key: "item:spot" });
  assert.deepEqual(texts(drawnPopup(), ".rollbox-popup-status"), ["Noticed", "Waiting", "Didn't notice"]);
  assert.equal(env.chat.length, 2);
  assert.deepEqual(env.chat[1].whisper, ["p1"]);
  assert.match(env.chat[1].content, /You see Harvey draw a weapon./);
  await pressDrawn("Ignore");
  assert.equal(drawnPopup(), null);
  closeFightNotices();
});

test("bug: a watcher without Spot Hidden on the sheet (CoC7's raw roll at the base value, a plain value) is settled",
  async () => {
    const { hooks } = setup();
    closeFightNotices();
    makeCoC7();
    globalThis.ChatMessage.create = () => {};
    const drawer = fighter("Cecil", { weapons: [KNIFE] });
    const deepOne = fighter("Deep One");
    deepOne.type = "creature";
    canvasWith([[drawer, 0], [deepOne, 5]]);
    globalThis.fromUuidSync = (uuid) => (uuid === deepOne.uuid ? deepOne : null);
    drawer.items.find((item) => item.id === "knife").type = "weapon";
    await postNoticeCard({ actor: drawer, weapon: drawer.items.find((item) => item.id === "knife") });
    await pressDrawn("Roll to notice");
    await cardFor(hooks, deepOne, { isSuccess: true, type: "value" });
    assert.deepEqual(texts(drawnPopup(), ".rollbox-popup-status"), ["Noticed"]);
    closeFightNotices();
  });

test("weapon-drawn pop-up: the Keeper settles a row by hand (Noticed counts for About to attack, a later roll changes "
  + "nothing); Ignore closes the list with a row still waiting, and nothing waits after it", async () => {
  const { hooks } = setup();
  closeFightNotices();
  makeCoC7();
  const env = { chat: [] };
  globalThis.ChatMessage.create = (data) => env.chat.push(data);
  const drawer = fighter("Harvey", { weapons: [KNIFE] });
  const [helen, guard] = [fighter("Helen", { owners: [game.users[1]] }), fighter("Guard")];
  guard.type = "npc";
  canvasWith([[drawer, 0], [helen, 5], [guard, 7]]);
  globalThis.fromUuidSync = (uuid) => [drawer, helen, guard].find((a) => a.uuid === uuid) ?? null;
  drawer.items.find((item) => item.id === "knife").type = "weapon";
  await postNoticeCard({ actor: drawer, weapon: drawer.items.find((item) => item.id === "knife") });
  const before = (hooks.createChatMessage ?? []).length;
  await pressDrawn("Roll to notice");
  const row = (name) => [...drawnPopup().querySelectorAll(".rollbox-popup-row")]
    .find((node) => node.querySelector(".rollbox-popup-name").textContent === name);
  const press = async (name, words) => {
    [...row(name).querySelectorAll("button")].find((node) => node.textContent === words).click();
    await settle();
  };
  assert.deepEqual(texts(row("Helen"), "button"), ["Noticed", "Didn't notice"]);
  await press("Helen", "Noticed");
  assert.deepEqual(texts(drawnPopup(), ".rollbox-popup-status"), ["Noticed", "Waiting"]);
  assert.equal(row("Helen").querySelector("button").disabled, true, "Noticed greyed: the row's state already");
  assert.match(env.chat.at(-1).content, /You see Harvey draw a weapon./);
  await cardFor(hooks, helen, { isSuccess: false, type: "value" });
  assert.equal(texts(drawnPopup(), ".rollbox-popup-status")[0], "Noticed", "a later roll changes nothing");
  assert.equal(noticedDraw(helen, drawer.uuid), true, "counts for About to attack");
  await pressDrawn("Ignore");
  assert.equal(drawnPopup(), null, "closed with the Guard still waiting");
  assert.equal((hooks.createChatMessage ?? []).length, before, "no watch left on CoC7's cards");
  await cardFor(hooks, guard, { isSuccess: true, type: "value" });
  assert.equal(noticedDraw(guard, drawer.uuid), false, "nothing waits after it closed");
  closeFightNotices();
});

test("weapon-drawn pop-up: Everyone notices whispers each investigator in range; Ignore closes it, no combat", async () => {
  setup();
  makeCoC7();
  const env = { chat: [] };
  globalThis.ChatMessage.create = (data) => env.chat.push(data);
  const helen = fighter("Helen", { owners: [game.users[1]] });
  const guard = fighter("Guard");
  globalThis.fromUuidSync = (uuid) => [helen, guard].find((a) => a.uuid === uuid) ?? null;
  const data = { kind: "draw", title: "Harvey draws a knife.", actor: { uuid: "x", name: "Harvey" },
    watchers: [{ uuid: helen.uuid, name: "Helen" }, { uuid: guard.uuid, name: "Guard" }], stealth: 40,
    decided: null, started: false };
  assert.equal(await chooseDraw({ ...data }, "everyone"), true);
  assert.deepEqual(env.chat.map((c) => [c.whisper, /You see Harvey draw a weapon/.test(c.content)]), [[["p1"], true]]);
  const ignored = { ...data };
  assert.equal(await chooseDraw(ignored, "ignore"), true);
  assert.deepEqual([ignored.decided, ignored.started], ["ignore", false]);
  assert.equal(await chooseDraw(ignored, "combat"), false, "nothing after Ignore");
});

test("weapon-drawn pop-up: shown by the Keeper's client for a player (relay), only for their own character; never "
  + "with Notice when a weapon is drawn off", async () => {
  const env = setup();
  closeFightNotices();
  makeCoC7();
  const drawer = fighter("Harvey", { weapons: [GUN] });
  drawer.items.get = (id) => drawer.items.find((item) => item.id === id);
  drawer.testUserPermission = (user) => user === game.users[1];
  canvasWith([[drawer, 0]]);
  globalThis.fromUuidSync = (uuid) => (uuid === drawer.uuid ? drawer : null);
  assert.equal(await noticeForPlayer({ kind: "draw", actorUuid: drawer.uuid, weaponId: "gun" }, game.users[2]), false);
  assert.equal(await noticeForPlayer({ kind: "draw", actorUuid: drawer.uuid, weaponId: "gun" }, game.users[1]), true);
  assert.ok(drawnPopup());
  closeFightNotices();
  env.values.rollboxNoticeDraw = false;
  assert.equal(await postNoticeCard({ actor: drawer, weapon: drawer.items.get("gun") }), null);
  assert.equal(drawnPopup(), null);
});

// --- How a fight starts and who joins (fight.js) ----------------------------------------------------------

/** Apply Foundry-style update keys to a document's Rollbox flags ("flags.keepers-rollbox.x", "-=x" removes). */
function applyChanges(doc, changes) {
  for (const [key, value] of Object.entries(changes)) {
    const prefix = `flags.${MODULE}.`;
    if (key === `flags.${MODULE}`) Object.assign(doc.flags[MODULE] ??= {}, value);
    else if (key.startsWith(prefix)) {
      const rest = key.slice(prefix.length);
      if (rest.startsWith("-=")) delete doc.flags[MODULE]?.[rest.slice(2)];
      else (doc.flags[MODULE] ??= {})[rest] = value;
    } else doc[key] = value;
  }
}

/**
 * A board in feet: tokens at x positions (y 0), each with a disposition (1 Friendly, -1 Hostile, 0 Neutral) and
 * hidden or not; a wall at x = `wallAt` blocks sight across it.
 */
function board(placed, { wallAt = Infinity } = {}) {
  const placeables = placed.map(({ actor, x, disposition = 1, hidden = false }, i) => {
    const token = { id: `t${i}`, name: actor.name, actor, center: { x, y: 0 } };
    token.document = { actorId: actor.id ?? `a${i}`, hidden, disposition,
      update: async (data) => Object.assign(token.document, data) };
    actor.getActiveTokens = () => [token];
    return token;
  });
  globalThis.canvas = { scene: { id: "s1" }, tokens: { placeables }, grid: { units: "ft", size: 1, distance: 1 } };
  globalThis.CONFIG.Canvas = { polygonBackends: { sight: {
    testCollision: (a, b) => Math.min(a.x, b.x) < wallAt && Math.max(a.x, b.x) > wallAt } } };
  return placeables;
}

/** Foundry's Combat for a fight: combatants made from tokens, CoC7's rollInitiative (DEX), turns sorted by it. */
function fightCombat() {
  const combat = withFlags({ id: "f1", started: false, round: 0, turn: 0, turns: [], calls: [], scene: { id: "s1" } });
  combat.combatants = { get: (id) => combat.turns.find((c) => c.id === id) };
  const sort = () => combat.turns.sort((x, y) => (y.initiative ?? -1) - (x.initiative ?? -1));
  let made = 0;
  combat.createEmbeddedDocuments = async (type, list) => list.map((data) => {
    const token = canvas.tokens.placeables.find((t) => t.id === data.tokenId);
    const combatant = withFlags({ id: `cb${made++}`, tokenId: data.tokenId, token: { object: token }, actor: token.actor,
      name: token.name, hidden: data.hidden, initiative: null, parent: combat }, structuredClone(data.flags ?? {}));
    combatant.update = async (changes) => applyChanges(combatant, changes);
    combatant.delete = async () => { combat.turns.splice(combat.turns.indexOf(combatant), 1); };
    combat.turns.push(combatant);
    return combatant;
  });
  combat.rollInitiative = async (ids) => {
    combat.calls.push(["rollInitiative", ids.length]);
    for (const id of ids) {
      const combatant = combat.combatants.get(id);
      combatant.initiative = await combatant.actor.rollInitiative(false);
    }
    sort();
  };
  combat.startCombat = async () => { combat.started = true; combat.round = 1; combat.turn = 0; };
  combat.nextTurn = async () => {
    combat.calls.push(["nextTurn", combat.combatant.name]);
    if (combat.turn + 1 >= combat.turns.length) { combat.round += 1; combat.turn = 0; } else combat.turn += 1;
  };
  combat.update = async (changes) => applyChanges(combat, changes);
  combat.nextRound = async () => { combat.calls.push(["nextRound"]); combat.round += 1; combat.turn = 0; };
  combat.deleteEmbeddedDocuments = async (type, ids) => {
    combat.turns = combat.turns.filter((c) => !ids.includes(c.id));
  };
  Object.defineProperty(combat, "combatant", { get: () => combat.turns[combat.turn] ?? null });
  globalThis.Combat = { create: async (data) => { Object.assign(combat.flags, data.flags ?? {}); game.combat = combat; return combat; } };
  return combat;
}

const flagsOf = (combat) => Object.fromEntries(combat.turns.map((c) => [c.name, c.flags[MODULE]?.standingBy ?? "fights"]));

/**
 * A first blow, then the Keeper's Start combat on its card and on Who's joining this fight? (when it opens) with nobody
 * else picked: the attacker and the target fight, everyone near stands by.
 */
async function fightStarted(attack) {
  clearFirstBlow();
  assert.equal(await attackMade(attack), "firstBlow");
  await startFromFirstBlow();
  const win = document.querySelector(".rollbox-fight-window");
  for (const box of win?.querySelectorAll("input:not(:disabled)") ?? []) {
    box.checked = false;
    box.dispatchEvent(new document.defaultView.Event("change"));
  }
  win?.querySelector(".rollbox-fight-add").click();
  await settle();
}

/** Cecil attacks the Hybrid out of combat, with six others about (an NPC, a hidden one, one far, one behind a wall). */
async function firstBlowScene() {
  setup();
  const [cecil, hybrid, helen, martin, cat, lurker, far, walled] = [["Cecil", 40], ["Hybrid", 80], ["Helen", 70],
    ["Martin", 30], ["Cat", 20], ["Lurker", 10], ["Far", 50], ["Walled", 60]].map(([name, dex]) => fighter(name, { dex }));
  cat.type = "npc";
  lurker.type = "npc";
  helen.testUserPermission = (user) => user === game.users[1];
  game.users[1].active = true;
  game.users[1].character = helen;
  board([{ actor: cecil, x: 0 }, { actor: hybrid, x: 5, disposition: -1 }, { actor: helen, x: 40 },
    { actor: martin, x: -50 }, { actor: cat, x: 10, disposition: 0 }, { actor: lurker, x: 15, disposition: -1, hidden: true },
    { actor: far, x: 200 }, { actor: walled, x: -60 }], { wallAt: -55 });
  const combat = fightCombat();
  clearFirstBlow();
  return { combat, cecil, hybrid, first: await attackMade({ actor: cecil, targets: [hybrid] }) };
}

test("the first blow: an attack out of combat starts no encounter and shows the Keeper's First blow card, once, "
  + "saying who attacks whom and what to finish (the surprise attack when a target is surprised)", async () => {
  const { combat, cecil, hybrid, first } = await firstBlowScene();
  assert.equal(first, "firstBlow");
  assert.deepEqual([combat.started, combat.turns.length, document.querySelector(".rollbox-fight-window")],
    [false, 0, null], "no encounter and no window yet");
  const card = document.querySelector(".rollbox-fight-notice[data-kind='firstBlow']");
  assert.deepEqual([...card.querySelectorAll("button")].map((node) => node.textContent), ["Start combat", "✕"]);
  const line = () => card.querySelector(".rollbox-fight-notice-text").textContent;
  assert.match(line(), /Cecil attacks Hybrid.*the attack/);
  assert.doesNotMatch(line(), /surprise/);
  await cecil.setFlag(MODULE, "surprised", { attacker: hybrid.uuid, at: Date.now() });
  assert.equal(await attackMade({ actor: hybrid, targets: [cecil] }), "firstBlow", "a second attack before Start combat");
  assert.equal(document.querySelectorAll(".rollbox-fight-notice[data-kind='firstBlow']").length, 1);
  assert.match(line(), /Cecil and Hybrid attack Hybrid and Cecil.*the surprise attack/);
});

test("the first blow: Start combat opens Who's joining this fight? and its Start combat makes the encounter (the two "
  + "and the picks fight, the rest near stand by, asked when their player can answer), everyone's initiative set, "
  + "round 1 at the top of the order; the attacker's round-1 turn isn't skipped", async () => {
  const { combat } = await firstBlowScene();
  const card = document.querySelector(".rollbox-fight-notice[data-kind='firstBlow']");
  [...card.querySelectorAll("button")].find((node) => node.textContent === "Start combat").click();
  await settle();
  const win = document.querySelector(".rollbox-fight-window");
  assert.equal(win.querySelector(".rollbox-fight-add").textContent, "Start combat");
  win.querySelector(".rollbox-fight-add").click();
  await settle();
  assert.equal(pendingFirstBlow(), null);
  assert.deepEqual(flagsOf(combat), { Hybrid: "fights", Helen: "asked", Cecil: "fights", Martin: "fights" });
  assert.equal(combat.flags[MODULE].fight.attacker, "Cecil");
  assert.ok(combat.turns.every((c) => Number.isFinite(c.initiative)), "no one left without initiative");
  assert.deepEqual([combat.started, combat.round, combat.turn, combat.combatant.name], [true, 1, 0, "Hybrid"],
    "round 1 at the top of the order");
  const own = combat.turns.find((c) => c.name === "Cecil");
  assert.equal(skipsTurn(own, combat), false, "the first blow isn't Cecil's round-1 action");
  await turnStart(combat, { round: 1, turn: 0 });
  assert.deepEqual([combat.round, combat.combatant.name], [1, "Hybrid"]);
});

test("the first blow card's ✕ forgets the first blow: nothing starts", async () => {
  setup();
  const [cecil, hybrid] = ["Cecil", "Hybrid"].map((name) => fighter(name));
  board([{ actor: cecil, x: 0 }, { actor: hybrid, x: 5, disposition: -1 }]);
  const combat = fightCombat();
  clearFirstBlow();
  await attackMade({ actor: cecil, targets: [hybrid] });
  document.querySelector(".rollbox-fight-notice[data-kind='firstBlow'] .rollbox-fight-dismiss").click();
  assert.equal(pendingFirstBlow(), null);
  assert.equal(await startFromFirstBlow(), false);
  assert.equal(combat.started, false);
});

test("Who's joining this fight?: a Friendly against Hostile fight pre-ticks who joins on their own; Add makes them "
  + "fighters; a fight with a Neutral pre-ticks nobody", async () => {
  setup();
  const [cecil, hybrid, martin, cat] = ["Cecil", "Hybrid", "Martin", "Cat"].map((name) => fighter(name));
  cat.type = "npc";
  board([{ actor: cecil, x: 0 }, { actor: hybrid, x: 5, disposition: -1 }, { actor: martin, x: 20 },
    { actor: cat, x: 10, disposition: 0 }]);
  let combat = fightCombat();
  clearFirstBlow();
  await attackMade({ actor: cecil, targets: [hybrid] });
  await startFromFirstBlow();
  const win = document.querySelector(".rollbox-fight-window");
  const ticked = [...win.querySelectorAll(".rollbox-fight-row")].filter((row) => row.dataset.token)
    .map((row) => [row.querySelector("b").textContent, row.querySelector("input").checked]);
  assert.deepEqual(ticked, [["Martin", true], ["Cat", false]]);
  win.querySelector(".rollbox-fight-add").click();
  await settle();
  assert.deepEqual([flagsOf(combat).Martin, flagsOf(combat).Cat], ["fights", undefined]);
  assert.equal(document.querySelector(".rollbox-fight-window"), null);
  setup();
  board([{ actor: cecil, x: 0 }, { actor: cat, x: 5, disposition: 0 }, { actor: martin, x: 20 }]);
  combat = fightCombat();
  clearFirstBlow();
  await attackMade({ actor: cecil, targets: [cat] });
  await startFromFirstBlow();
  assert.equal(document.querySelectorAll(".rollbox-fight-window input:checked:not(:disabled)").length, 0);
});

test("standing by: plain standing by is skipped, acts this round stops the order on them; with no fighter left to "
  + "act, nobody is skipped", async () => {
  setup();
  const [a, b, c] = [fighter("A"), fighter("B"), fighter("C")];
  board([{ actor: a, x: 0 }, { actor: b, x: 5 }, { actor: c, x: 10 }]);
  const combat = encounter([a, b, c]);
  combat.turns[1].flags[MODULE] = { standingBy: "out" };
  combat.turns[2].flags[MODULE] = { standingBy: "out", actsRound: 1 };
  combat.turn = 1;
  await onTurn(combat, { turn: 1 });
  assert.equal(combat.combatant.actor, c);
  assert.deepEqual(combat.calls, [["updateCombat", { turn: 2 }]]);
  combat.turns[0].flags[MODULE] = { standingBy: "out" };
  combat.turns[2].flags[MODULE] = { standingBy: "out" };
  await onTurn(combat, { turn: 2 });
  assert.equal(combat.calls.length, 1);
});

test("Rollbox's own skip carries its update option, in a turn update and in nextRound's, and no other round change "
  + "gets it", async () => {
  setup();
  const [a, b, c] = [fighter("A"), fighter("B"), fighter("C")];
  board([{ actor: a, x: 0 }, { actor: b, x: 5 }, { actor: c, x: 10 }]);
  const combat = encounter([a, b, c], { turn: 1 });
  combat.turns[1].flags[MODULE] = { standingBy: "out" };
  const seen = [];
  combat.update = async (data, options = {}) => {
    seen.push(options.rollboxOwnStep === true);
    Object.assign(combat, data);
  };
  // Foundry v14's Combat#nextRound: its options go through the combatRound hook before the update.
  combat.nextRound = async () => {
    const data = { round: combat.round + 1, turn: 0 };
    const options = { direction: 1 };
    Hooks.callAll("combatRound", combat, data, options);
    await combat.update(data, options);
  };
  assert.equal(await onTurn(combat, { turn: 1 }), true);
  combat.turns[2].flags[MODULE] = { standingBy: "out" };
  assert.equal(await onTurn(combat, { turn: 2 }), true);
  assert.equal(combat.round, 2);
  await combat.nextRound();
  assert.deepEqual(seen, [true, true, false]);
});

test("a run of standing-by turns is passed in one turn update, straight to the first who acts; with nobody after "
  + "them acting, the next round starts and is skipped from its top", async () => {
  const env = setup();
  const [a, b, c, d] = [fighter("A"), fighter("B"), fighter("C"), fighter("D")];
  board([{ actor: a, x: 0 }, { actor: b, x: 5 }, { actor: c, x: 10 }, { actor: d, x: 15 }]);
  const combat = encounter([a, b, c, d]);
  combat.turns[0].flags[MODULE] = { standingBy: "out" };
  combat.turns[1].flags[MODULE] = { standingBy: "out" };
  combat.update = async (data, options) => {
    combat.calls.push(["updateCombat", data]);
    Object.assign(combat, data);
    for (const hook of env.hooks.updateCombat ?? []) hook(combat, data, options);
  };
  registerCombat();
  await onCombatUpdate(combat, { round: 1, turn: 0 });
  for (let i = 0; i < 5; i += 1) await settle();
  assert.deepEqual(combat.calls.filter(([call]) => call === "updateCombat"), [["updateCombat", { turn: 2 }]]);
  assert.equal(combat.combatant.actor, c);
  combat.turns[2].flags[MODULE] = { standingBy: "out" };
  combat.turns[3].flags[MODULE] = { standingBy: "out" };
  combat.turns[0].flags[MODULE] = {};
  await turnStart(combat, { turn: 2 });
  assert.deepEqual([combat.round, combat.combatant.actor], [2, a], "the next round, at A, the first who acts");
});

test("inCombatFor: only a character with a combatant in the running encounter (one who fled is out of combat)", () => {
  setup();
  const [a, b] = [fighter("A"), fighter("B")];
  encounter([a]);
  assert.equal(inCombatFor(a), true);
  assert.equal(inCombatFor(b), false);
});

test("the Keeper's selected standing-by combatant has Act this round in the turn controls; the order then stops on them", async () => {
  setup();
  const [a, b] = [fighter("A"), fighter("B", { owners: [] })];
  const combat = encounter([a, b]);
  combat.turns[1].flags[MODULE] = { standingBy: "out" };
  combat.turns[1].update = async (changes) => applyChanges(combat.turns[1], changes);
  const root = buildTurnOrder({ combat, user: game.user, focus: [b] });
  const toggle = root.querySelector(".rollbox-turn-controls .rollbox-turn-acts");
  assert.equal(toggle.getAttribute("aria-pressed"), "false");
  toggle.click();
  await settle();
  assert.equal(combat.turns[1].flags[MODULE].actsRound, 1);
  combat.turn = 1;
  assert.equal(await onTurn(combat, { turn: 1 }), false);
});

test("a player whose own character isn't in the encounter (fled) keeps their sheet, under the turn order", () => {
  setup({ isGM: false });
  const [a, b, own] = [fighter("A"), fighter("B"), fighter("Cecil")];
  const combat = encounter([a, b]);
  const root = buildTurnOrder({ combat, user: game.user, own });
  const kids = [...root.children];
  const header = kids.findIndex((node) => node.classList.contains("rollbox-turn-header"));
  const sheet = kids.findIndex((node) => node.classList.contains("rollbox-turn-sheet"));
  assert.ok(header >= 0 && sheet > header, "the order above, the sheet under it");
  assert.match(root.textContent, /Not in combat/);
  assert.match(kids[sheet].textContent, /Cecil/);
});

test("during a fight: an attacked outsider joins as a fighter; a hidden attacker is revealed, added and skipped this "
  + "round; attacking makes a standing-by combatant a fighter; Gameplay rules off: nothing", async () => {
  setup();
  const [cecil, hybrid, helen, lurker, cultist] = ["Cecil", "Hybrid", "Helen", "Lurker", "Cultist"].map((n) => fighter(n));
  const [, , , lurkerToken] = board([{ actor: cecil, x: 0 }, { actor: hybrid, x: 5, disposition: -1 },
    { actor: helen, x: 10 }, { actor: lurker, x: 300, disposition: -1, hidden: true }, { actor: cultist, x: 400 }]);
  const combat = fightCombat();
  await fightStarted({ actor: cecil, targets: [hybrid] });
  assert.equal(flagsOf(combat).Helen, "out");
  assert.equal(await attackMade({ actor: helen, targets: [cultist] }), "joined");
  assert.equal(flagsOf(combat).Helen, "fights");
  assert.equal(flagsOf(combat).Cultist, "fights");
  await attackMade({ actor: lurker, targets: [cecil] });
  assert.equal(lurkerToken.document.hidden, false);
  assert.equal(combat.turns.find((c) => c.name === "Lurker").flags[MODULE].skipRound, 1);
  setup({ values: { rollboxGameplay: false } });
  game.combat = null;
  assert.equal(await attackMade({ actor: cecil, targets: [hybrid] }), false);
});

test("at the start of a turn: everyone who came into range is on one joining card, each with Add and Leave out; Leave "
  + "out holds for the rest of the fight; a standing-by combatant out of range is dropped", async () => {
  setup();
  const [cecil, hybrid, martin, belinda, jessie, cat] = ["Cecil", "Hybrid", "Martin", "Belinda", "Jessie", "Cat"]
    .map((n) => fighter(n));
  const tokens = board([{ actor: cecil, x: 0 }, { actor: hybrid, x: 5, disposition: -1 }, { actor: martin, x: 30 },
    { actor: belinda, x: 500 }, { actor: jessie, x: 600 }, { actor: cat, x: 700, disposition: -1 }]);
  const combat = fightCombat();
  await fightStarted({ actor: cecil, targets: [hybrid] });
  assert.equal(flagsOf(combat).Martin, "out");
  tokens[2].center.x = 300; // Martin walks away
  for (const [i, x] of [[3, 20], [4, 25], [5, 30]]) tokens[i].center.x = x; // three walk in
  await onTurn(combat, { turn: 1 });
  assert.deepEqual(Object.keys(flagsOf(combat)).sort(), ["Cecil", "Hybrid"]);
  const cards = document.querySelectorAll(".rollbox-fight-notice[data-kind='joining']");
  assert.equal(cards.length, 1);
  const rowOf = (name) => [...cards[0].querySelectorAll(".rollbox-fight-joining-row")]
    .find((row) => row.querySelector("b").textContent === name);
  assert.deepEqual(texts(cards[0], ".rollbox-fight-joining-row b"), ["Belinda", "Jessie", "Cat"]);
  rowOf("Belinda").querySelector(".rollbox-fight-add-one").click();
  rowOf("Jessie").querySelector(".rollbox-fight-leave-out").click();
  await settle();
  assert.equal(flagsOf(combat).Belinda, "fights");
  assert.deepEqual(combat.flags[MODULE].leftOut, ["t4"]);
  tokens[4].center.x = 400; // Jessie walks out and back in: still left out
  await onTurn(combat, { turn: 0 });
  tokens[4].center.x = 25;
  await onTurn(combat, { turn: 1 });
  assert.deepEqual(texts(document, ".rollbox-fight-joining-row b"), ["Cat"]);
  assert.equal(document.querySelectorAll(".rollbox-fight-notice[data-kind='joining']").length, 1);
});

test("the joining card's Add all and Leave all answer everyone still on it at once; shown for two or more", async () => {
  setup();
  closeJoiningCard(); // the last test's card, still in its own page
  const names = ["Cecil", "Hybrid", "Belinda", "Jessie", "Cat", "Dog", "Eve"];
  const [cecil, hybrid, ...rest] = names.map((n) => fighter(n));
  const tokens = board([{ actor: cecil, x: 0 }, { actor: hybrid, x: 5, disposition: -1 },
    ...rest.map((actor, i) => ({ actor, x: 500 + 100 * i, disposition: -1 }))]);
  const combat = fightCombat();
  await fightStarted({ actor: cecil, targets: [hybrid] });
  const card = () => document.querySelector(".rollbox-fight-notice[data-kind='joining']");
  for (const [i, x] of [[2, 20], [3, 25], [4, 30]]) tokens[i].center.x = x; // Belinda, Jessie, Cat walk in
  await onTurn(combat, { turn: 1 });
  card().querySelector(".rollbox-fight-add-one").click(); // Belinda alone
  await settle();
  assert.equal(card().querySelector(".rollbox-fight-joining-all").hidden, false);
  const before = combat.calls.filter(([call]) => call === "rollInitiative").length;
  card().querySelector(".rollbox-fight-add-all").click();
  await settle();
  assert.equal(card(), null);
  assert.deepEqual(["Belinda", "Jessie", "Cat"].map((n) => flagsOf(combat)[n]), ["fights", "fights", "fights"]);
  assert.deepEqual(combat.calls.filter(([call]) => call === "rollInitiative").slice(before), [["rollInitiative", 2]]);
  tokens[5].center.x = 35; // Dog alone: no Add all
  await onTurn(combat, { turn: 0 });
  assert.equal(card().querySelector(".rollbox-fight-joining-all").hidden, true);
  tokens[6].center.x = 40; // and Eve
  await onTurn(combat, { turn: 1 });
  card().querySelector(".rollbox-fight-leave-all").click();
  await settle();
  assert.equal(card(), null);
  assert.deepEqual(combat.flags[MODULE].leftOut, ["t5", "t6"]);
});

test("the player's side: the join card for their own asked investigator, Join and Stay out through the Keeper's "
  + "client, only for a combatant they own", async () => {
  setup();
  const [cecil, hybrid, helen] = ["Cecil", "Hybrid", "Helen"].map((n) => fighter(n));
  helen.testUserPermission = (user) => user === game.users[1];
  board([{ actor: cecil, x: 0 }, { actor: hybrid, x: 5, disposition: -1 }, { actor: helen, x: 40 }]);
  game.users[1].active = true;
  game.users[1].character = helen;
  const combat = fightCombat();
  await fightStarted({ actor: cecil, targets: [hybrid] });
  const own = combat.turns.find((c) => c.name === "Helen");
  assert.equal(await fightForPlayer({ action: "join", combatantId: own.id }, game.users[2]), false);
  assert.equal(await fightForPlayer({ action: "stayOut", combatantId: own.id }, game.users[1]), true);
  assert.equal(standingBy(own), "out");
  assert.equal(await fightForPlayer({ action: "acts", combatantId: own.id, on: true }, game.users[1]), true);
  assert.equal(own.flags[MODULE].actsRound, 1);
  own.flags[MODULE].standingBy = "asked";
  game.user = game.users[1];
  assert.equal(syncJoinCard(), true);
  assert.match(document.querySelector(".rollbox-fight-join").textContent,
    /A fight has broken out: Cecil attacks Hybrid, 35 ft from you\./);
  own.flags[MODULE].standingBy = "out";
  assert.equal(syncJoinCard(), false);
  assert.equal(document.querySelector(".rollbox-fight-join"), null);
});

test("turn order: standing-by rows compact (the name only, greyed, the status on hover); a standing-by player's sheet on top with "
  + "Standing by, Act this round and Rejoin the fight, Your turn when the order stops on them; their turn has a fighter's "
  + "controls", () => {
  setup();
  const [helen, hybrid] = [fighter("Helen", { owners: [] }), fighter("Hybrid")];
  helen.testUserPermission = (user) => user === game.users[1];
  const combat = encounter([hybrid, helen]);
  combat.turns[1].flags[MODULE] = { standingBy: "out" };
  let root = buildTurnOrder({ combat, user: game.user });
  const compact = root.querySelector(".rollbox-turn-row-card.rollbox-turn-compact");
  assert.equal(compact.textContent, "Helen");
  assert.match(compact.querySelector(".rollbox-name").title, /Helen · Standing by/);
  root = buildTurnOrder({ combat, user: game.users[1], own: helen });
  assert.match(root.firstElementChild.className, /rollbox-turn-standby/);
  assert.match(root.querySelector(".rollbox-turn-standby-box").textContent, /^Standing byYour turn is skipped\./);
  assert.deepEqual(texts(root, ".rollbox-turn-standby-box button"), ["Act this round", "Rejoin the fight"]);
  combat.turns[1].flags[MODULE].actsRound = 1;
  root = buildTurnOrder({ combat, user: game.users[1], own: helen });
  assert.match(root.querySelector(".rollbox-turn-standby-box").textContent, /You act on your turn this round\./);
  combat.turn = 1;
  root = buildTurnOrder({ combat, user: game.users[1], own: helen });
  assert.match(root.querySelector(".rollbox-turn-standby-box").textContent, /^Your turnBack on standby after this turn\./);
  assert.deepEqual(texts(root, ".rollbox-turn-standby-box button"), ["Rejoin the fight"]);
  assert.deepEqual(texts(root, ".rollbox-turn-controls button"), ["Delay", "Flee", "End my turn"]);
});

test("the player's Rejoin the fight asks the Keeper's client to make them a fighter (as Join the fight does); on the "
  + "Keeper's client that makes them a fighter for good, also on their acting turn", async (t) => {
  setup();
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const [helen, hybrid] = [fighter("Helen", { owners: [] }), fighter("Hybrid")];
  helen.testUserPermission = (user) => user === game.users[1];
  const combat = encounter([hybrid, helen]);
  const own = combat.turns[1];
  own.update = async (changes) => applyChanges(own, changes);
  own.flags[MODULE] = { standingBy: "out", actsRound: 1 };
  combat.turn = 1;
  const sent = [];
  game.users.activeGM = game.users[0];
  game.socket = { on: () => {}, emit: (channel, message) => sent.push(message) };
  game.user = game.users[1];
  const root = buildTurnOrder({ combat, user: game.users[1], own: helen });
  press(root, ".rollbox-turn-rejoin");
  assert.deepEqual(sent.map(({ type, payload }) => [type, payload]), [["fight", { action: "join", combatantId: own.id }]]);
  t.mock.timers.tick(60000);
  game.user = game.users[0];
  combat.combatants = { get: (id) => combat.turns.find((c) => c.id === id) };
  assert.equal(await fightForPlayer({ action: "join", combatantId: own.id }, game.users[1]), true);
  assert.deepEqual([standingBy(own), own.flags[MODULE].actsRound], [null, undefined]);
});

test("turn order: the standing-by list scrolls to a selected row, keeps where the Keeper scrolled it across redraws, and "
  + "scrolls again for another pick", async () => {
  setup();
  const actors = ["A", "B", "C", "D", "E", "F", "G", "H"].map((name) => fighter(name));
  const combat = encounter(actors);
  for (const combatant of combat.turns.slice(1)) combatant.flags[MODULE] = { standingBy: "out" };
  // Geometry jsdom lacks: the list shows 100px, each row 20px tall in its order, moved by the list's scroll.
  const draw = (picked) => {
    const root = buildTurnOrder({ combat, user: game.user, focus: [actors[0], picked] });
    document.body.replaceChildren(root);
    const list = root.querySelector(".rollbox-turn-standing-list");
    let top = 0;
    Object.defineProperty(list, "scrollTop", { get: () => top, set: (value) => { top = value; } });
    list.getBoundingClientRect = () => ({ top: 0, bottom: 100 });
    [...list.children].forEach((row, i) => {
      row.getBoundingClientRect = () => ({ top: i * 20 - top, bottom: i * 20 + 20 - top });
    });
    return list;
  };
  const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
  let list = draw(actors[7]);
  await tick();
  assert.equal(list.scrollTop, 40, "H, the seventh row, brought into view");
  list.scrollTop = 0;
  list.dispatchEvent(new list.ownerDocument.defaultView.Event("scroll"));
  list = draw(actors[7]);
  await tick();
  assert.equal(list.scrollTop, 0, "a redraw keeps where the Keeper scrolled, without pulling back to the same pick");
  list = draw(actors[6]);
  await tick();
  assert.equal(list.scrollTop, 20, "another pick is brought into view");
  document.body.replaceChildren();
});

test("turn order: the meters ticked in rollboxCardMeters on every Keeper's row but a standing-by one; none on a "
  + "player's rows; no initiative number", () => {
  const env = setup();
  const [a, helen, c, d] = [fighter("A"), fighter("Helen"), fighter("C"), fighter("D")];
  const combat = encounter([a, helen, c, d]);
  combat.turns[3].flags[MODULE] = { standingBy: "out" };
  const bars = (root) => [...root.querySelectorAll(".rollbox-turn-row-card")]
    .map((row) => [row.querySelector(".rollbox-name").textContent, row.querySelectorAll(".rollbox-vbar").length]);
  assert.deepEqual(bars(buildTurnOrder({ combat, user: game.user })), [["Helen", 4], ["C", 4], ["D", 0]]);
  env.values.rollboxCardMeters = ["hp", "luck"];
  const root = buildTurnOrder({ combat, user: game.user });
  assert.deepEqual(bars(root), [["Helen", 2], ["C", 2], ["D", 0]]);
  assert.equal(root.querySelector(".rollbox-turn-initiative"), null);
  delete env.values.rollboxCardMeters;
  combat.turns[1].flags[MODULE] = { standingBy: "out" };
  combat.turns[3].flags[MODULE] = {};
  assert.deepEqual(bars(buildTurnOrder({ combat, user: game.users[1], own: helen })),
    [["A", 0], ["C", 0], ["D", 0], ["Helen", 0]]); // Helen stands by: at the back
});

test("the flee notice: the Keeper's Flee asks whether anyone gives chase; Chase opens CoC7's chase tool, or reminds "
  + "the Keeper without it", async () => {
  setup();
  const [a, b] = [fighter("A"), fighter("B")];
  const combat = encounter([a, b]);
  const root = document.createElement("div");
  root.append(turnControls({ combat, user: game.user }));
  press(root, ".rollbox-turn-flee");
  press(root, ".rollbox-turn-end");
  await settle();
  const notice = document.querySelector(".rollbox-fight-notice[data-kind='flee']");
  assert.match(notice.textContent, /A flees\. Does anyone give chase\?/);
  const made = [];
  game.documentTypes = { Item: ["weapon", "chase"] };
  globalThis.Item = { create: async (data) => { made.push(data); return { sheet: { render: () => made.push("open") } }; } };
  [...notice.querySelectorAll("button")].find((node) => node.textContent === "Chase").click();
  await settle();
  assert.deepEqual(made, [{ name: "A flees", type: "chase" }, "open"]);
  game.documentTypes = { Item: ["weapon"] };
  fleeNotice("B");
  [...document.querySelectorAll(".rollbox-fight-notice[data-kind='flee'] button")].find((n) => n.textContent === "Chase").click();
  await settle();
  assert.match(document.querySelector(".rollbox-fight-notice[data-kind='chase']").textContent, /CoC7's chase tool/);
});

// --- The Keeper's combat panel and defeated combatants -------------------------------------------------

test("the Keeper's combat panel: the selected combatant is the full card (blue outline off the current turn), the "
  + "current turn's row keeps its red box; passed turns are darker; someone not in combat shows above the round with "
  + "Add to combat, and the turn controls keep only End combat", () => {
  setup();
  const [a, b, c, d] = ["A", "B", "C", "D"].map((name) => fighter(name));
  const combat = encounter([a, b, c], { turn: 1 });
  let root = buildTurnOrder({ combat, user: game.user, focus: [b] });
  let sheet = root.querySelector(".rollbox-sheet");
  assert.equal(sheet.querySelector(".rollbox-name").textContent, "B");
  assert.ok(sheet.classList.contains("rollbox-turn-current"));
  assert.deepEqual(texts(root, ".rollbox-turn-done .rollbox-name"), ["A"]);
  root = buildTurnOrder({ combat, user: game.user, focus: [c] });
  sheet = root.querySelector(".rollbox-sheet");
  assert.equal(sheet.querySelector(".rollbox-name").textContent, "C");
  assert.ok(sheet.classList.contains("rollbox-turn-picked") && !sheet.classList.contains("rollbox-turn-current"));
  const current = root.querySelector(".rollbox-turn-row-card.rollbox-turn-current");
  assert.match(current.querySelector(".rollbox-sub").textContent, /current turn/);
  assert.deepEqual(texts(root, ".rollbox-turn-controls button"), ["End turn", "End combat"]);
  const added = [];
  root = buildTurnOrder({ combat, user: game.user, focus: [d], onAdd: (list) => added.push(...list) });
  assert.equal(root.firstElementChild.textContent, "Not in combat");
  assert.equal(root.querySelector(".rollbox-sheet .rollbox-name").textContent, "D");
  const kids = [...root.children];
  assert.ok(kids.indexOf(root.querySelector(".rollbox-turn-add")) < kids.indexOf(root.querySelector(".rollbox-turn-header")),
    "Add to combat sits above the round line");
  assert.deepEqual(texts(root, ".rollbox-turn-controls button"), ["End combat"]);
  root.querySelector(".rollbox-turn-add").click();
  assert.deepEqual(added, [d]);
});

/** A two-row turn order (A, B) whose tokens record targeting and selection, and count the map's releases. */
function rowClicks() {
  const env = setup({ values: { rollboxEnabled: true } });
  const combat = encounter([fighter("A"), fighter("B")]);
  const seen = { targeted: [], selected: [], released: 0 };
  for (const combatant of combat.turns) {
    combatant.token = { object: {
      setTarget: (on, { releaseOthers }) => seen.targeted.push([combatant.actor.name, on, releaseOthers]),
      control: ({ releaseOthers }) => seen.selected.push([combatant.actor.name, releaseOthers])
    } };
  }
  globalThis.canvas = { tokens: { controlled: [], placeables: [], releaseAll: () => { seen.released += 1; } } };
  return { env, combat, seen, order: turnOrder(combat) };
}

test("a click on a row: the Keeper's left click acts for that combatant (the map's selection released); the current "
  + "turn's row follows the turn again", () => {
  const { combat, seen, order } = rowClicks();
  assert.equal(rowClicked(order[1], game.user, combat), "pick");
  assert.equal(pickedCombatant(combat).actor.name, "B");
  assert.equal(seen.released, 1);
  rowClicked(order[0], game.user, combat);
  assert.equal(pickedCombatant(combat), null);
});

test("a click on a row targets: the right click; a left click while the target tool is picked; a player's left and "
  + "right click", () => {
  const { combat, seen, order } = rowClicks();
  const targeted = seen.targeted;
  ui.controls = { tool: { name: "target" } };
  assert.equal(rowClicked(order[1], game.user, combat), "target");
  assert.equal(rowClicked(order[0], game.users[1], combat), "target");
  assert.deepEqual(targeted, [["B", true, true], ["A", true, true]]);
  ui.controls = { tool: { name: "select" } };
  assert.equal(rowClicked(order[1], game.users[1], combat), "target");
  assert.equal(rowClicked(order[1], game.users[1], combat, { right: true }), "target");
  assert.equal(rowClicked(order[0], game.user, combat, { right: true }), "target");
  assert.equal(pickedCombatant(combat), null);
  assert.deepEqual(targeted.slice(2), [["B", true, true], ["B", true, true], ["A", true, true]]);
});

test("a click on a row: a turn change follows the turn at once (the pick forgotten, the new turn's token selected)", async () => {
  const { env, combat, seen } = rowClicks();
  registerCombat();
  pickCombatant(combat.turns[1], combat);
  combat.turn = 1;
  for (const hook of env.hooks.updateCombat) await hook(combat, { turn: 1 }, {});
  assert.equal(pickedCombatant(combat), null);
  assert.deepEqual(seen.selected, [["B", true]], "selected in the turn change's own hook, before the panel's next frame");
});

test("rollboxTurnOrderClick target: the Keeper's left click targets, and the right click still targets", () => {
  setup({ values: { rollboxEnabled: true, rollboxTurnOrderClick: "target" } });
  const [a, b] = [fighter("A"), fighter("B")];
  const combat = encounter([a, b]);
  const targeted = [];
  for (const combatant of combat.turns) {
    combatant.token = { object: { setTarget: () => targeted.push(combatant.actor.name) } };
  }
  globalThis.canvas = { tokens: { controlled: [], placeables: [], releaseAll: () => {} } };
  ui.controls = { tool: { name: "select" } };
  const order = turnOrder(combat);
  assert.equal(rowClicked(order[1], game.user, combat), "target");
  assert.equal(rowClicked(order[1], game.user, combat, { right: true }), "target");
  assert.equal(pickedCombatant(combat), null);
  assert.deepEqual(targeted, ["B", "B"]);
});

test("rollboxTurnSelection: keep never touches the Keeper's selection at a new turn; the pick still follows the turn", async () => {
  setup({ values: { rollboxEnabled: true, rollboxTurnSelection: "keep" } });
  const [a, b] = [fighter("A"), fighter("B")];
  const combat = encounter([a, b]);
  let touched = 0;
  for (const combatant of combat.turns) combatant.token = { object: { control: () => { touched += 1; } } };
  globalThis.canvas = { tokens: { controlled: [], placeables: [], releaseAll: () => { touched += 1; } } };
  pickCombatant(combat.turns[0], combat);
  combat.turn = 1;
  assert.equal(onTurnChange(combat, { turn: 1 }), false);
  assert.equal(pickedCombatant(combat), null);
  await new Promise((resolve) => setTimeout(resolve, 200));
  assert.equal(touched, 0);
});

test("defeated: CoC7 marking a combatant unconscious, dying or dead sets Foundry's defeated field (nothing else), "
  + "cleared with it; a defeat the Keeper set by hand stays through other changes; a defeated turn is skipped", async () => {
  const env = setup();
  const [a, b, c] = [fighter("A"), fighter("B"), fighter("C")];
  const combat = encounter([a, b, c]);
  combat.settings = { skipDefeated: true };
  for (const combatant of combat.turns) {
    combatant.update = async (data) => { combat.calls.push(["update", combatant.actor.name, data]); Object.assign(combatant, data); };
  }
  registerDefeated();
  const fire = async (hook, ...args) => { for (const handler of env.hooks[hook]) await handler(...args); };
  b.system.conditions = { unconscious: { value: true } };
  await fire("updateActor", b, { system: { conditions: { unconscious: { value: true } } } });
  assert.deepEqual(combat.calls, [["update", "B", { defeated: true }]]);
  combat.turn = 1;
  await onTurn(combat, { turn: 1 });
  assert.equal(combat.combatant.actor, c);
  // Foundry's Skip defeated off: the defeated turn is kept (still marked).
  combat.settings.skipDefeated = false;
  combat.turn = 1;
  assert.equal(await onTurn(combat, { turn: 1 }), false);
  assert.equal(combat.combatant.actor, b);
  b.system.conditions.unconscious.value = false;
  await fire("updateActor", b, { "system.conditions.unconscious.value": false });
  assert.equal(combat.turns[1].defeated, false);
  combat.turns[0].defeated = true;
  await fire("updateActor", a, { system: { attribs: { hp: { value: 3 } } } });
  assert.equal(combat.turns[0].defeated, true);
  c.statuses = new Set(["dead"]);
  await fire("createActiveEffect", { parent: c, statuses: new Set(["dead"]) });
  assert.equal(combat.turns[2].defeated, true);
});

test("H2: with the Keeper viewing another scene, the rules read the running encounter: a standing-by turn is skipped, "
  + "a defeated combatant marked, a character is in combat and their round note counts; the panel draws no turn order",
async () => {
  const env = setup();
  const [a, b, c] = [fighter("A"), fighter("B"), fighter("C")];
  const combat = encounter([a, b, c]);
  combat.scene = { id: "s1" };
  combat.combatants = { get: (id) => combat.turns.find((t) => t.id === id) };
  combat.turns[1].flags[MODULE] = { standingBy: "out" };
  for (const combatant of combat.turns) combatant.update = async (data) => Object.assign(combatant, data);
  // The Keeper views scene s2: Foundry's viewed combat is none there, the fight runs in game.combats.
  game.combat = null;
  game.combats = [combat];
  globalThis.canvas = { scene: { id: "s2" }, tokens: { controlled: [], placeables: [] } };
  registerDefeated();
  combat.turn = 1;
  assert.equal(await onTurn(combat, { turn: 1 }), true);
  assert.equal(combat.combatant.actor, c);
  c.system.conditions = { dying: { value: true } };
  for (const handler of env.hooks.updateActor) await handler(c, { system: { conditions: { dying: { value: true } } } });
  assert.equal(combat.turns[2].defeated, true);
  assert.equal(inCombatFor(a), true);
  assert.equal(await markActed(a), true);
  assert.equal(hasActed(a), true);
  assert.equal(inCombat(), true);
  assert.equal(currentTurn(), null, "the panel draws the viewed scene's encounter only");
  game.combats = [];
});

// --- Registration --------------------------------------------------------------------------------------

test("registerCombat: nothing for a player with the Player Rollbox off; the Keeper's gameplay rules even with the panel off", () => {
  let env = setup({ isGM: false, values: { rollboxPlayerRollbox: false } });
  assert.equal(registerCombat(), false);
  assert.deepEqual(Object.keys(env.hooks), []);
  env = setup({ values: { rollboxEnabled: false } });
  assert.equal(registerCombat(), true);
  assert.deepEqual(Object.keys(env.hooks).sort(),
    ["controlToken", "createActiveEffect", "createCombatant", "deleteActiveEffect", "deleteCombat", "deleteToken",
      "targetToken", "updateActiveEffect", "updateActor", "updateChatMessage", "updateCombat", "updateCombatant",
      "updateToken"]); // no turn order
  env = setup({ values: { rollboxEnabled: true } });
  assert.equal(registerCombat(), true);
  for (const hook of ["createCombatant", "canvasReady"]) assert.ok(env.hooks[hook]?.length, hook);
});

test("registerCombat: a second GM who isn't Foundry's active GM leaves the round change to the active one", async () => {
  const env = setup({ values: { rollboxEnabled: false } });
  const actor = fighter("Harvey");
  actor.flags[MODULE] = { roundNotes: { combat: "c1", round: 1, acted: true } };
  const combat = encounter([actor], { round: 2 });
  registerCombat();
  game.users.activeGM = { id: "gm2", isSelf: false };
  for (const hook of env.hooks.updateCombat) await hook(combat, { round: 2 });
  assert.deepEqual(actor.writes, []);
  game.users.activeGM = game.users[0];
  for (const hook of env.hooks.updateCombat) await hook(combat, { round: 2 });
  assert.deepEqual(actor.writes, [["roundNotes", undefined]]);
});

test("delayTurn: when Foundry refuses the move, the row isn't noted Delayed", async () => {
  setup();
  const [a, b] = [fighter("A"), fighter("B")];
  const combat = encounter([a, b]);
  combat.turns[0].update = async () => { throw new Error("refused"); };
  assert.equal(await delayTurn(combat, 1), false);
  assert.deepEqual(a.writes, []);
});

test("registerCombat: a player with the Player Rollbox gets the turn order, none of the Keeper's gameplay rules", () => {
  const env = setup({ isGM: false, values: { rollboxPlayerRollbox: true, rollboxEnabled: true } });
  assert.equal(registerCombat(), true);
  assert.ok(env.hooks.createCombatant?.length);
  assert.equal(env.hooks.renderChatMessageHTML, undefined);
});

test("isFirearm: a Longbow or a Crossbow by name is a bow, so it isn't readied with Bows count as readied firearms off", () => {
  setup();
  const weapon = (name) => ({ type: "weapon", name, system: { properties: { rngd: true }, skill: { main: { name: "" } } } });
  assert.deepEqual(["Longbow", "Crossbow", "Bow and arrows", "Elbow gun"].map((name) => isFirearm(weapon(name))),
    [false, false, false, true]);
});

// --- What the board says about an attack (situation.js) ----------------------------------------------

test("defenderAnswered: a CoC7 defender card answered with Dodge or Fight back counts once; no response or the attacker's card, never", async () => {
  setup();
  const helen = fighter("Helen");
  encounter([helen]);
  globalThis.fromUuidSync = (uuid) => (uuid === helen.uuid ? helen : null);
  game.users.activeGM = game.user;
  const card = (id, load) => ({ id, flags: { CoC7: { load: { as: "CoC7ChatCombatMelee", participant: 1, responded: true,
    isNoResponse: false, actorUuid: helen.uuid, ...load } } } });
  assert.equal(await defenderAnswered(card("m1")), true);
  assert.equal(await defenderAnswered(card("m1")), false);
  assert.equal(await defenderAnswered(card("m2", { isNoResponse: true })), false);
  assert.equal(await defenderAnswered(card("m3", { participant: 0 })), false);
  assert.equal(await defenderAnswered(card("m4", { responded: false })), false);
  assert.deepEqual(helen.flags[MODULE].roundNotes.defended, ["m1"]);
});

test("isOutnumbered: once the target has defended as often as it attacks per round; never out of combat", async () => {
  setup();
  const cultist = fighter("Cultist");
  const hybrid = fighter("Hybrid");
  hybrid.system.special = { attacksPerRound: "2" };
  const combat = encounter([cultist, hybrid]);
  assert.equal(isOutnumbered(cultist), false);
  for (const actor of [cultist, hybrid]) actor.flags[MODULE] = { roundNotes: { combat: "c1", round: 1, defended: ["m1"] } };
  assert.deepEqual([isOutnumbered(cultist), isOutnumbered(hybrid)], [true, false]);
  combat.started = false;
  assert.equal(isOutnumbered(cultist), false);
});

test("inMeleeWithOthers: a shot's target within melee reach of another combatant, not the shooter, edge to edge", () => {
  setup();
  const [shooter, target, friend] = ["Cecil", "Hybrid", "Helen"].map((name) => fighter(name));
  const combat = encounter([shooter, target, friend]);
  globalThis.canvas = { grid: { size: 100, distance: 5, units: "ft" } };
  const place = (combatant, x) => { combatant.token = { object: { id: combatant.id, w: 100, center: { x, y: 0 }, actor: combatant.actor } }; };
  const [a, b, c] = combat.turns;
  place(a, 0); place(b, 1000); place(c, 1150); // the Hybrid and Helen 2.5 ft apart edge to edge (0.8 m)
  assert.equal(inMeleeWithOthers(b.token.object, shooter), true);
  place(c, 1200); // 5 ft (1.5 m): out of the 1 m reach
  assert.equal(inMeleeWithOthers(b.token.object, shooter), false);
  place(a, 1100); place(c, 3000); // only the shooter is close
  assert.equal(inMeleeWithOthers(b.token.object, shooter), false);
});

// --- Standing by at the back; Delay and Place on standby ending the turn ----------------------------------------

test("turnOrder: those standing by sit at the back, highest DEX first, equal DEX in Foundry's order; their "
  + "initiative stays as it was", () => {
  setup();
  const actors = [["A", 50], ["B", 40], ["C", 60], ["D", 40], ["E", 30]].map(([name, dex]) => fighter(name, { dex }));
  const combat = encounter(actors, { turn: 4 });
  for (const i of [0, 1, 2, 3]) combat.turns[i].flags[MODULE] = { standingBy: "out" };
  assert.deepEqual(turnOrder(combat).map((entry) => entry.actor.name), ["E", "C", "A", "B", "D"]);
  assert.deepEqual(combat.turns.map((t) => t.initiative), [50, 49, 48, 47, 46]);
});

test("Place on standby turns CoC7's Draw gun off and gives the turn to whoever came after, wherever the lower "
  + "initiative sorted the one standing by", async () => {
  setup();
  const combat = encounter([fighter("Cecil", { dex: 30 }), fighter("B", { dex: 50 }), fighter("C", { dex: 40 })]);
  const cecil = combat.turns[0];
  cecil.update = async (changes) => applyChanges(cecil, changes);
  cecil.flags.CoC7 = { hasGun: true };
  const root = turnControls({ combat, user: game.user, onChange: () => {} });
  press(root, ".rollbox-turn-delay");
  const again = turnControls({ combat, user: game.user, onChange: () => {} });
  press(again, ".rollbox-turn-standby-button");
  for (let i = 0; i < 5; i += 1) await settle();
  assert.equal(standingBy(cecil), "out");
  assert.equal(cecil.flags.CoC7.hasGun, false);
  assert.deepEqual(combat.turns.map((t) => t.actor.name), ["B", "C", "Cecil"]);
  assert.equal(combat.combatant.actor.name, "B", "B acts now; the drop didn't end the round");
});

test("M3: with two GMs, Place on standby on the GM who isn't Foundry's active GM presses no Draw gun; the active GM's "
  + "client puts the gun away once", async () => {
  setup();
  const combat = encounter([fighter("Cecil"), fighter("B")], { turn: 1 });
  const cecil = combat.turns[0];
  cecil.update = async (changes) => applyChanges(cecil, changes);
  cecil.flags.CoC7 = { hasGun: true };
  game.users.activeGM = { id: "gm2", isSelf: false };
  assert.equal(await placeOnStandby(cecil, true), true);
  assert.equal(standingBy(cecil), "out");
  assert.equal(cecil.flags.CoC7.hasGun, true, "the second GM's client left Draw gun alone");
  game.users.activeGM = game.users[0];
  assert.equal(await onCombatantUpdate(cecil, { flags: { [MODULE]: { standingBy: "out" } } }), true);
  assert.equal(cecil.flags.CoC7.hasGun, false);
});

test("going on standby any other way (a player's Stay out) puts the gun away too; nothing for another change or with "
  + "Manage readied firearms off", async () => {
  const env = setup();
  const combat = encounter([fighter("Cecil"), fighter("B")]);
  const cecil = combat.turns[0];
  cecil.update = async (changes) => applyChanges(cecil, changes);
  cecil.flags.CoC7 = { hasGun: true };
  assert.equal(await onCombatantUpdate(cecil, { initiative: 40 }), false);
  cecil.flags[MODULE] = { standingBy: "out" };
  env.values.rollboxReadiedFirearms = false;
  assert.equal(await onCombatantUpdate(cecil, { flags: { [MODULE]: { standingBy: "out" } } }), false);
  assert.equal(cecil.flags.CoC7.hasGun, true);
  delete env.values.rollboxReadiedFirearms;
  assert.equal(await onCombatantUpdate(cecil, { flags: { [MODULE]: { standingBy: "out" } } }), true);
  assert.equal(cecil.flags.CoC7.hasGun, false);
});

test("Draw gun turned on for someone standing by brings them off standby; a round's start never draws a standing-by "
  + "combatant's gun", async () => {
  setup();
  const combat = encounter([fighter("A"), fighter("Harvey", { dex: 60, weapons: [GUN], picked: "gun" })]);
  const harvey = combat.turns[1];
  harvey.update = async (changes) => applyChanges(harvey, changes);
  harvey.flags[MODULE] = { standingBy: "out" };
  assert.equal(await readyForRound(combat), 0);
  assert.notEqual(harvey.getFlag("CoC7", "hasGun"), true);
  assert.equal(await onGunDrawn(harvey, { flags: { CoC7: { hasGun: false } } }), false);
  assert.equal(await onGunDrawn(harvey, { flags: { CoC7: { hasGun: true } } }), true);
  assert.equal(standingBy(harvey), null);
});

test("Confirm delay counts only fighters, ends the turn as a turn change does (a standing-by turn skipped, the next "
  + "token selected)", async () => {
  setup({ values: { rollboxEnabled: true } });
  const [a, b, c] = [fighter("A"), fighter("B"), fighter("C")];
  const combat = encounter([a, b, c]);
  combat.turns[1].flags[MODULE] = { standingBy: "out" };
  let selected = null;
  for (const combatant of combat.turns) combatant.token = { object: { control: () => { selected = combatant.actor.name; } } };
  globalThis.canvas = { tokens: { controlled: [], placeables: [], releaseAll: () => {} } };
  const delayed = combat.turns[0];
  assert.equal(await delayTurn(combat, 1), true);
  assert.deepEqual(combat.turns.map((t) => t.actor.name), ["B", "C", "A"], "past C, the only fighter after A");
  const changes = { flags: { [MODULE]: { delayedFrom: { round: 1, initiative: 50 } } } };
  assert.equal(onDelayedTurn(delayed, changes), true);
  assert.equal(onDelayedTurnChange(combat), false, "B, skipped at once, isn't selected");
  await onCombatantUpdate(delayed, changes);
  assert.equal(combat.combatant.actor, c, "B stands by: skipped");
  assert.equal(onTurnChange(combat, { turn: combat.turn }, { direction: 1 }), true, "the skip's turn change follows, in round 1 too");
  assert.equal(selected, "C");
  assert.equal(onDelayedTurn(delayed, { flags: { [MODULE]: { "-=delayedFrom": null } } }), false);
});

test("acting from standby: on their turn a fighter's controls with the card greyed; End turn puts them back on "
  + "standby, Act this round off; Act this round for the next round stays", async () => {
  setup();
  const [a, b, c] = [fighter("A"), fighter("B"), fighter("C")];
  board([{ actor: a, x: 0 }, { actor: b, x: 5 }, { actor: c, x: 10 }]);
  const combat = encounter([a, b, c]);
  for (const combatant of combat.turns) combatant.update = async (changes) => applyChanges(combatant, changes);
  const [first, , third] = combat.turns;
  first.flags[MODULE] = { standingBy: "out", actsRound: 1 };
  third.flags[MODULE] = { standingBy: "out", actsRound: 2 };
  const root = buildTurnOrder({ combat, user: game.user });
  assert.match(root.querySelector(".rollbox-turn-sheet").className, /rollbox-turn-standby/);
  assert.deepEqual(texts(root, ".rollbox-turn-controls button"), ["Delay", "Flee", "End turn", "End combat"]);
  await combat.nextTurn();
  await turnStart(combat, { turn: 1 });
  assert.deepEqual([standingBy(first), first.flags[MODULE].actsRound], ["out", undefined]);
  assert.equal(third.flags[MODULE].actsRound, 2);
  const after = turnControls({ combat, user: game.user, selected: first });
  assert.deepEqual(texts(after, "button"), ["Act this round", "Leave out", "Remove from standby", "End combat"]);
});

test("acting from standby: a confirmed Delay keeps Act this round, so they act again at the delayed place and are "
  + "back on standby when it ends", async () => {
  setup();
  const combat = encounter([fighter("A"), fighter("B"), fighter("C")]);
  const first = combat.turns[0];
  const move = first.update;
  first.update = async (changes, options) => {
    applyChanges(first, Object.fromEntries(Object.entries(changes).filter(([key]) => key !== "initiative")));
    await move(changes, options);
  };
  first.flags[MODULE] = { standingBy: "out", actsRound: 1 };
  assert.equal(await delayTurn(combat, 1), true);
  assert.deepEqual(combat.turns.map((t) => t.actor.name), ["B", "A", "C"]);
  await turnStart(combat, { turn: 0 });
  assert.deepEqual([standingBy(first), first.flags[MODULE].actsRound], ["out", 1], "the delayed place is still to come");
  await combat.nextTurn();
  await turnStart(combat, { turn: 1 });
  assert.equal(combat.combatant, first, "the order stops on them at the delayed place");
  assert.deepEqual(texts(turnControls({ combat, user: game.user }), "button"), ["Delay", "Flee", "End turn", "End combat"]);
  await combat.nextTurn();
  await turnStart(combat, { turn: 2 });
  assert.deepEqual([standingBy(first), first.flags[MODULE].actsRound], ["out", undefined]);
});

test("acting from standby: Place on standby ends that turn back on standby", async () => {
  setup();
  const again = encounter([fighter("D"), fighter("E")]);
  const acting = again.turns[0];
  acting.update = async (changes) => applyChanges(acting, changes);
  acting.flags[MODULE] = { standingBy: "asked", actsRound: 1 };
  again.update = async (data) => again.calls.push(["updateCombat", data]);
  assert.equal(await placeOnStandby(acting, true), true);
  assert.deepEqual([standingBy(acting), acting.flags[MODULE].actsRound], ["asked", undefined]);
  assert.deepEqual(again.calls.at(-1), ["updateCombat", { turn: 1 }]);
});

// --- Notice cards: their own place and size ------------------------------------------------------------------

test("notice cards: dragged by the top line and sized with the wheel while held, saved per kind and used by the "
  + "next one; another kind stays in the stack at Notice cards size; saving Notice cards size forgets each card's own "
  + "size, places kept", async () => {
  const env = setup();
  closeFightNotices();
  const view = document.defaultView;
  const flee = showFightNotice({ lead: "Helen flees.", kind: "flee" });
  const line = flee.querySelector(".rollbox-fight-notice-text");
  const pointer = (type, x, y, target = view) => target.dispatchEvent(new view.MouseEvent(type,
    { bubbles: true, button: 0, clientX: x, clientY: y }));
  pointer("pointerdown", 100, 100, line);
  pointer("pointermove", 160, 140);
  const wheel = new view.WheelEvent("wheel", { deltaY: -100, cancelable: true });
  view.dispatchEvent(wheel);
  assert.ok(wheel.defaultPrevented, "the wheel is the card's while held");
  pointer("pointerup", 160, 140);
  await settle();
  const saved = env.values.rollboxNoticePlaces.flee;
  assert.equal(saved.scale, 110);
  assert.ok(flee.classList.contains("rollbox-notice-placed"));
  assert.equal(flee.style.transform, "scale(1.1)");
  closeFightNotices();
  const next = showFightNotice({ lead: "Harvey flees.", kind: "flee" });
  assert.deepEqual([next.style.left, next.style.top, next.style.transform], [`${saved.x}px`, `${saved.y}px`, "scale(1.1)"]);
  env.values.rollboxNoticeScale = 130;
  const chase = showFightNotice({ lead: "Chase:", kind: "chase" });
  assert.ok(chase.closest(".rollbox-fight-notices"), "the chase reminder in the stack");
  assert.equal(chase.style.zoom, "1.3");
  await resetNoticeSizes(130);
  assert.deepEqual(env.values.rollboxNoticePlaces.flee, { x: saved.x, y: saved.y });
  assert.equal(next.style.transform, "scale(1.3)");
  assert.equal(next.style.left, `${saved.x}px`);
  closeFightNotices();
});

test("notice cards open in one stack just above Foundry's hotbar, stacking upwards with the newest nearest it; "
  + "Who's joining this fight? opens there too", () => {
  setup();
  closeFightNotices();
  const bar = document.createElement("div");
  bar.id = "hotbar";
  bar.getBoundingClientRect = () => ({ left: 400, top: 700, width: 200, height: 50 });
  document.body.append(bar);
  const first = showFightNotice({ lead: "Helen flees.", kind: "flee" });
  const second = showFightNotice({ lead: "Chase:", kind: "chase" });
  const win = openJoinWindow({ attacker: { name: "Cecil" }, targets: [{ name: "Hybrid" }], rows: [] });
  const stack = first.parentElement;
  assert.ok(stack.classList.contains("rollbox-fight-notices"));
  assert.deepEqual([...stack.children], [first, second, win], "the newest last: nearest the hotbar");
  assert.deepEqual([stack.style.left, stack.style.bottom],
    ["500px", `${document.defaultView.innerHeight - 692}px`], "centred on the hotbar, 8 px above it");
  bar.remove();
  closeJoinWindow();
  closeFightNotices();
});

test("M13: the encounter deleted closes Who's joining this fight? as its Cancel does and the flee notice; a chase "
  + "reminder stays", () => {
  setup();
  closeFightNotices();
  let cancelled = 0;
  openJoinWindow({ attacker: { name: "Cecil" }, targets: [{ name: "Hybrid" }], rows: [], start: true,
    onCancel: () => { cancelled += 1; } });
  showFightNotice({ lead: "Helen flees.", kind: "flee" });
  showFightNotice({ lead: "Chase:", kind: "chase" });
  onCombatGone(encounter([fighter("A")]));
  assert.equal(document.querySelector(".rollbox-fight-window"), null);
  assert.equal(cancelled, 1);
  assert.deepEqual([...document.querySelectorAll(".rollbox-fight-notice")].map((n) => n.dataset.kind), ["chase"]);
  closeFightNotices();
});

test("bug: a notice card dragged and released with no click after it doesn't swallow the next click elsewhere", async () => {
  setup();
  closeFightNotices();
  const view = document.defaultView;
  const card = showFightNotice({ lead: "Helen flees.", kind: "flee" });
  const pointer = (type, x, y, target = view) => target.dispatchEvent(new view.MouseEvent(type,
    { bubbles: true, button: 0, clientX: x, clientY: y }));
  pointer("pointerdown", 100, 100, card.querySelector(".rollbox-fight-notice-text"));
  pointer("pointermove", 160, 140);
  pointer("pointerup", 160, 140);
  await new Promise((resolve) => setTimeout(resolve, 300));
  const other = document.createElement("button");
  document.body.append(other);
  let clicked = false;
  other.addEventListener("click", () => { clicked = true; });
  other.click();
  assert.equal(clicked, true);
  other.remove();
  closeFightNotices();
});

// --- About to attack (about-to-attack.js) ------------------------------------------------------------------

/** About to attack's pop-up showing, or null. */
const aboutPopup = () => document.querySelector(".rollbox-popup[data-kind='aboutToAttack']");
/** The pop-up's buttons, by their words: { words: button }. */
const aboutButtons = () => Object.fromEntries([...aboutPopup().querySelectorAll("button:not(.rollbox-fight-dismiss)")]
  .map((node) => [node.textContent, node]));

test("About to attack: out of combat the Keeper's pop-up asks first (Roll to notice: Spot Hidden · Listen · "
  + "Psychology; Surprised · Saw it coming · Ignore); Surprised asks the bonus, Automatic hit greyed for a ranged "
  + "attack; the decision marks the target surprised; nothing asked in combat or with the Gameplay rules off; a stored About to attack value is ignored", async () => {
  const env = setup();
  closeFightNotices();
  const [deepOne, cecil] = [fighter("Deep One"), fighter("Cecil")];
  canvasWith([[deepOne, 0], [cecil, 2]]);
  const asked = aboutToAttack({ actor: deepOne, target: cecil, kind: "ranged" });
  await settle();
  assert.match(aboutPopup().textContent, /Deep One is about to attack Cecil/);
  assert.deepEqual(Object.keys(aboutButtons()), ["Spot Hidden", "Listen", "Psychology", "Surprised", "Saw it coming",
    "Ignore"]);
  aboutButtons().Surprised.click();
  await settle();
  assert.match(aboutPopup().textContent, /Cecil is surprised/);
  assert.equal(aboutButtons()["Automatic hit"].disabled, true, "no automatic success on CoC7's ranged card");
  aboutButtons()["One bonus die"].click();
  assert.deepEqual(await asked, { how: "surprised", bonus: "die" });
  assert.equal(aboutPopup(), null);
  assert.equal(surprisedBy(cecil, deepOne.uuid), true);
  assert.equal(surprisedBy(cecil, "Actor.Someone"), false);
  encounter([deepOne, cecil]);
  assert.equal(await aboutToAttack({ actor: deepOne, target: cecil }), null, "in combat");
  game.combat = null;
  env.values.rollboxAboutToAttack = false;
  assert.ok(await Promise.race([aboutToAttack({ actor: deepOne, target: cecil }).then(() => "answered"),
    settle().then(() => "asked")]) === "asked" && aboutPopup(), "a stored About to attack value is ignored");
  aboutButtons().Ignore.click();
  await settle();
  env.values.rollboxGameplay = false;
  assert.equal(await aboutToAttack({ actor: deepOne, target: cecil }), null, "the Gameplay rules off");
});

test("About to attack: a target marked Noticed on the weapon-drawn pop-up for this attacker starts with Saw it coming "
  + "chosen (the main button); the Keeper can still pick another", async () => {
  setup();
  closeFightNotices();
  makeCoC7();
  globalThis.ChatMessage.create = () => {};
  const [harvey, helen, cultist] = [fighter("Harvey", { weapons: [GUN] }), fighter("Helen"), fighter("Cultist")];
  canvasWith([[harvey, 0], [helen, 2], [cultist, 30]]);
  globalThis.fromUuidSync = (uuid) => [harvey, helen, cultist].find((a) => a.uuid === uuid) ?? null;
  await postNoticeCard({ actor: harvey, weapon: harvey.items.get("gun") });
  await pressDrawn("Everyone notices");
  closeFightNotices();
  const asked = aboutToAttack({ actor: harvey, target: helen, kind: "ranged" });
  await settle();
  assert.equal(aboutButtons()["Saw it coming"].classList.contains("rollbox-primary"), true);
  aboutButtons().Surprised.click();
  await settle();
  aboutButtons()["One bonus die"].click();
  assert.deepEqual(await asked, { how: "surprised", bonus: "die" });
  const other = aboutToAttack({ actor: harvey, target: cultist, kind: "ranged" });
  await settle();
  assert.equal(aboutButtons()["Saw it coming"].classList.contains("rollbox-primary"), false, "the Cultist was out of range");
  aboutButtons().Ignore.click();
  await other;
});

test("About to attack: Roll to notice sends the target's check (rolled privately for the Keeper when no player is "
  + "online) and waits; a failed roll moves to the surprised step, "
  + "a success is Saw it coming", async () => {
  const { hooks } = setup();
  closeFightNotices();
  makeCoC7();
  const env = { chat: [] };
  globalThis.ChatMessage.create = (data) => env.chat.push(data);
  const deepOne = fighter("Deep One");
  const cecil = fighter("Cecil", { owners: [game.users[1]] });
  game.users[1].active = true;
  canvasWith([[deepOne, 0], [cecil, 2]]);
  const listen = { name: "Listen", flags: { CoC7: { cocidFlag: { id: "i.skill.listen" } } } };
  globalThis.fromUuidSync = (uuid) => (uuid === "item:listen" ? listen : null);
  const card = { flags: { CoC7: { load: { as: "CoC7Check", actorUuid: cecil.uuid } } } };
  const rolled = async (isSuccess) => {
    game.CoC7.messageResults = async () => [{ isRolled: true, isSuccess, type: "skill", key: "item:listen" }];
    for (const hook of [...(hooks.createChatMessage ?? [])]) await hook(card);
    await settle();
  };
  let asked = aboutToAttack({ actor: deepOne, target: cecil, kind: "melee" });
  await settle();
  aboutButtons().Listen.click();
  await settle();
  assert.match(env.chat[0].content, /name:i\.skill\.listen/);
  assert.match(aboutPopup().textContent, /Waiting for Cecil's Listen…/);
  assert.deepEqual(Object.keys(aboutButtons()), ["Surprised", "Saw it coming", "Ignore"]);
  await rolled(false);
  assert.match(aboutPopup().textContent, /Cecil failed Listen: surprised, no response\./);
  assert.equal(aboutButtons()["Automatic hit"].disabled, false, "CoC7's melee card has Automatic success");
  aboutButtons()["Automatic hit"].click();
  assert.deepEqual(await asked, { how: "surprised", bonus: "auto" });
  game.users[1].active = false;
  const requests = env.chat.length;
  asked = aboutToAttack({ actor: deepOne, target: cecil, kind: "melee" });
  await settle();
  aboutButtons().Listen.click();
  await settle();
  assert.ok(!env.chat.slice(requests).some((c) => /i\.skill\.listen/.test(c.content)),
    "no player online: no request for the Keeper to click (it would roll the selected token)");
  assert.equal(cecil.calls.at(-1)?.[0], "runRoll", "rolled privately for the Keeper at once");
  await rolled(true);
  assert.deepEqual(await asked, { how: "seen", bonus: null });
  assert.equal(surprisedBy(cecil, deepOne.uuid), false, "saw it coming clears the mark");
});

test("About to attack for a player (relay): only for their own character", async () => {
  setup();
  closeFightNotices();
  const [cecil, cultist] = [fighter("Cecil"), fighter("Cultist")];
  cecil.testUserPermission = (user) => user === game.users[1];
  canvasWith([[cecil, 0], [cultist, 2]]);
  globalThis.fromUuidSync = (uuid) => [cecil, cultist].find((a) => a.uuid === uuid) ?? null;
  assert.equal(await aboutToAttackForPlayer({ actorUuid: cecil.uuid, targetUuid: cultist.uuid }, game.users[2]), null);
  const asked = aboutToAttackForPlayer({ actorUuid: cecil.uuid, targetUuid: cultist.uuid, kind: "melee" }, game.users[1]);
  await settle();
  aboutButtons()["Saw it coming"].click();
  assert.deepEqual(await asked, { how: "seen", bonus: null });
});

test("bug: About to attack: a notice skill missing from the target's sheet (rolled at its base value, CoC7's raw roll "
  + "with a plain value result) still decides by itself: a success is Saw it coming", async () => {
  const { hooks } = setup();
  closeFightNotices();
  makeCoC7();
  globalThis.ChatMessage.create = () => {};
  const [cecil, deepOne] = [fighter("Cecil"), fighter("Deep One")];
  deepOne.type = "creature";
  canvasWith([[cecil, 0], [deepOne, 2]]);
  globalThis.fromUuidSync = () => null;
  const asked = aboutToAttack({ actor: cecil, target: deepOne, kind: "ranged" });
  await settle();
  aboutButtons()["Spot Hidden"].click();
  await settle();
  game.CoC7.messageResults = async () => [{ isRolled: true, isSuccess: true, type: "value", threshold: 25 }];
  const card = { flags: { CoC7: { load: { as: "CoC7Check", actorUuid: deepOne.uuid } } } };
  for (const hook of [...(hooks.updateChatMessage ?? [])]) await hook(card);
  assert.deepEqual(await asked, { how: "seen", bonus: null });
  assert.equal(aboutPopup(), null);
});

// --- The players wait while the Keeper decides the first blow (waiting.js) ------------------------------------

/** The viewed scene with Rollbox's flags (Foundry's setFlag / unsetFlag on the Scene). */
const flaggedScene = () => withFlags(canvas.scene);
/** Every write queued on the scene has run. */
const written = async () => { for (let i = 0; i < 5; i += 1) await settle(); };

test("the players wait while the Keeper decides: About to attack open marks the scene (firstBlow), Ignore takes it off "
  + "at once; answered, the First blow card keeps it, Start combat takes it off; a player reads it, the Keeper never waits, nor "
  + "anyone once an encounter runs; the Keeper's requests still reach them", async () => {
  setup();
  resetWaiting();
  closeFightNotices();
  const [cecil, hybrid] = [fighter("Cecil"), fighter("Hybrid")];
  board([{ actor: cecil, x: 0 }, { actor: hybrid, x: 5, disposition: -1 }]);
  const scene = flaggedScene();
  fightCombat();
  clearFirstBlow();
  const ignored = aboutToAttack({ actor: cecil, target: hybrid, kind: "melee" });
  await written();
  assert.ok(scene.flags[MODULE].firstBlow?.at, "marked while About to attack is open");
  aboutButtons().Ignore.click();
  await ignored;
  await written();
  assert.equal(scene.flags[MODULE].firstBlow, undefined, "Ignore starts no first blow: no wait");
  scene.writes.length = 0;
  const asked = aboutToAttack({ actor: cecil, target: hybrid, kind: "melee" });
  await written();
  aboutButtons()["Saw it coming"].click();
  await asked;
  await written();
  assert.ok(scene.flags[MODULE].firstBlow, "still marked while the attack goes on to the First blow card");
  await attackMade({ actor: cecil, targets: [hybrid] });
  await written();
  const marks = scene.writes.length;
  assert.equal(keeperDeciding(), false, "the Keeper never waits");
  game.user = game.users[1];
  assert.equal(keeperDeciding(), true, "a player waits");
  game.user = game.users[0];
  makeCoC7();
  const helen = makeRollActor({ name: "Helen", owners: [game.users[1]], characteristics: { str: 50 } });
  const sent = await send(checkRequest({ checks: [{ kind: "characteristic", name: "str" }] }), [helen]);
  assert.deepEqual(sent.requested, [helen], "the Keeper's request still reaches the waiting player");
  await startFromFirstBlow();
  await written();
  assert.equal(scene.flags[MODULE].firstBlow, undefined, "Start combat ends the wait");
  assert.equal(marks, 1, "one mark, kept from About to attack to the First blow card");
  scene.flags[MODULE].firstBlow = { at: 1 };
  game.user = game.users[1];
  encounter([cecil, hybrid]);
  assert.equal(keeperDeciding(), false, "nobody waits once an encounter runs");
  game.user = game.users[0];
  resetWaiting();
});

test("the players wait until the First blow card's ✕", async () => {
  setup();
  resetWaiting();
  closeFightNotices();
  const [cecil, hybrid] = [fighter("Cecil"), fighter("Hybrid")];
  board([{ actor: cecil, x: 0 }, { actor: hybrid, x: 5, disposition: -1 }]);
  const scene = flaggedScene();
  fightCombat();
  clearFirstBlow();
  await attackMade({ actor: cecil, targets: [hybrid] });
  await written();
  assert.ok(scene.flags[MODULE].firstBlow);
  document.querySelector(".rollbox-fight-notice[data-kind='firstBlow'] .rollbox-fight-dismiss").click();
  await written();
  assert.equal(scene.flags[MODULE].firstBlow, undefined);
  resetWaiting();
});

// --- Each character's own target (own-target.js) ------------------------------------------------------------

/** Tokens on the board with a document flag store, Foundry's targets for the Keeper and TokenLayer#setTargets. */
function targetBoard(actors) {
  const placed = board(actors.map((actor, i) => ({ actor, x: i * 10 })));
  for (const token of placed) {
    withFlags(token.document);
    token.document.setFlag = async (scope, key, value) => { (token.document.flags[scope] ??= {})[key] = value; };
  }
  canvas.tokens.controlled = [];
  canvas.tokens.get = (id) => placed.find((token) => token.id === id) ?? null;
  game.user.targets = new Set();
  canvas.tokens.setTargets = (ids) => {
    game.user.targets = new Set(placed.filter((token) => ids.includes(token.id)));
  };
  return placed;
}

test("each character's own target: the Keeper's targeting is remembered for the one character they act for, a "
  + "player's for their own investigator; acting for someone else sets the Keeper's target to theirs, or none; "
  + "untargeting forgets nothing; a deleted target is forgotten", async () => {
  setup();
  resetOwnTarget();
  const [cecil, deepOne, cultist] = [fighter("Cecil"), fighter("Deep One"), fighter("Cultist")];
  const [cecilToken, deepToken, cultistToken] = targetBoard([cecil, deepOne, cultist]);
  game.users[1].character = cecil;
  cecil.testUserPermission = (user) => user === game.users[1];
  game.users.activeGM = game.users[0];
  await onTargeted(game.users[1], deepToken, true);
  assert.equal(rememberedTarget(cecil), deepToken, "the player's targeting, for Cecil");
  canvas.tokens.controlled = [cultistToken];
  actingChanged();
  assert.deepEqual([...game.user.targets], [], "the Cultist remembers no one: the Keeper's target is cleared");
  await onTargeted(game.user, cecilToken, true);
  assert.equal(rememberedTarget(cultist), cecilToken, "the Keeper's targeting, for the Cultist they act for");
  await onTargeted(game.user, cecilToken, false);
  assert.equal(rememberedTarget(cultist), cecilToken, "untargeting forgets nothing");
  canvas.tokens.controlled = [cecilToken];
  actingChanged();
  assert.deepEqual([...game.user.targets], [deepToken], "acting for Cecil, the Keeper targets the Deep One");
  canvas.tokens.controlled = [cecilToken, cultistToken];
  await onTargeted(game.user, cultistToken, true);
  assert.equal(rememberedTarget(cecil), deepToken, "two selected: nobody's target is changed");
  await onTokenDeleted(deepToken.document.id ? deepToken.document : { id: deepToken.id });
  assert.equal(rememberedTarget(cecil), null, "the deleted Deep One is forgotten");
  resetOwnTarget();
});

// --- Dying: the CON roll at each round's end, and Mark dead ---------------------------------------------------------

/** CoC7's CON check card for this character, with its rolled result read through game.CoC7.messageResults. */
function conCard(actor, isSuccess) {
  const message = { id: `con-${isSuccess}`, flags: { CoC7: { load: { as: "CoC7Check", actorUuid: actor.uuid } } } };
  game.CoC7 = { ...game.CoC7, messageResults: async (m) => (m === message
    ? [{ isRolled: true, type: "characteristic", key: "con", isSuccess }] : []) };
  return message;
}

test("dying: the Keeper's Roll CON for an NPC at the end of the round after they started dying, and each round after; "
  + "a failure brings Mark dead (CoC7's own Dead toggle) or Handle it yourself; stabilised, it stops", async () => {
  const env = makeEnv({ isGM: true });
  makeDom("<div id='interface'></div>");
  resetDying();
  const cultist = fighter("Cultist");
  cultist.type = "npc";
  const toggled = [];
  cultist.toggleCondition = async (key) => { toggled.push(key); };
  const combat = encounter([cultist], { round: 1 });
  cultist.system.conditions = { dying: { value: true } };
  onConditions(cultist);
  const popup = () => document.querySelector(".rollbox-popup[data-kind=dying]");
  combat.round = 2;
  assert.deepEqual(onRoundEnd(combat, { round: 2 }), [], "not at the end of the round they started dying in");
  combat.round = 3;
  assert.deepEqual(onRoundEnd(combat, { round: 3 }), [cultist]);
  assert.match(popup().textContent, /Cultist is dying\..*Roll CON/);
  [...popup().querySelectorAll("button")].find((b) => b.textContent === "Roll CON").click();
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.deepEqual([cultist.calls.at(-1)[0], cultist.calls.at(-1)[1].characteristic, cultist.calls.at(-1)[1].isBlind],
    ["runRoll", "con", true], "rolled privately for the Keeper");
  assert.equal(popup(), null);
  const failed = conCard(cultist, false);
  for (const f of env.hooks.createChatMessage ?? []) await f(failed);
  assert.match(popup().textContent, /Cultist failed CON while dying\./);
  [...popup().querySelectorAll("button")].find((b) => b.textContent === "Mark dead").click();
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.deepEqual(toggled, ["dead"]);
  cultist.system.conditions = {};
  combat.round = 4;
  assert.deepEqual(onRoundEnd(combat, { round: 4 }), [], "stabilised: no more rolls");
  resetDying();
  game.combat = undefined;
});

test("dying: an investigator's Roll CON is their online player's, on their own client (their own CON check); the "
  + "Keeper's client shows none", async () => {
  for (const isGM of [true, false]) {
    makeEnv({ isGM, values: { rollboxPlayerRollbox: true } });
    makeDom("<div id='interface'></div>");
    resetDying();
    const player = game.users[1];
    player.active = true;
    const cecil = fighter("Cecil", { owners: [player] });
    cecil.type = "character";
    player.character = cecil;
    const combat = encounter([cecil], { round: 1 });
    cecil.system.conditions = { dying: { value: true } };
    onConditions(cecil);
    combat.round = 2;
    onRoundEnd(combat, { round: 2 });
    combat.round = 3;
    onRoundEnd(combat, { round: 3 });
    assert.equal(Boolean(document.querySelector(".rollbox-popup[data-kind=dying]")), !isGM, isGM ? "Keeper" : "player");
    resetDying();
    game.combat = undefined;
  }
});
