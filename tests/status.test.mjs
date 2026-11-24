import assert from "node:assert/strict";
import { test } from "node:test";
import { load, makeActor, makeDom, makeEnv } from "./mocks.mjs";
import { getStatuses, setRollboxStatus } from "../scripts/status/index.js";
// Combat hands status its round-note readers when it loads, as main.js loads it in the module.
import "../scripts/combat/index.js";
import { attackDice } from "../scripts/status/effects.js";
import { placeStatusCards, statusCards } from "../scripts/panel/status-cards.js";

const ID = "keepers-rollbox";

/** A running encounter in round 1, which combat's round notes belong to. */
const COMBAT = { id: "c1", started: true, round: 1 };

/**
 * A character with CoC7's conditions on, Rollbox's own notes and this round's notes (aiming, dived), recording what is
 * asked of it.
 */
function character({ conditions = [], statuses = [], notes = {}, round = {}, isOwner = true, coc7 = true } = {}) {
  globalThis.game.combat = COMBAT;
  const actor = {
    name: "Helen", isOwner, calls: [],
    system: { conditions: Object.fromEntries(conditions.map((key) => [key, { value: true }])) },
    statuses: new Set(statuses),
    flags: { [ID]: { statuses: { ...notes }, roundNotes: { combat: COMBAT.id, round: COMBAT.round, ...round } } },
    getFlag(scope, key) { return this.flags[scope]?.[key]; },
    async setFlag(scope, key, value) { this.calls.push(["setFlag", scope, key, value]); },
    async unsetFlag(scope, key) { this.calls.push(["unsetFlag", scope, key]); }
  };
  if (coc7) {
    actor.conditionsSet = async (keys) => { actor.calls.push(["conditionsSet", keys]); };
    actor.conditionsUnset = async (keys) => { actor.calls.push(["conditionsUnset", keys]); };
  }
  return actor;
}

const firearm = { system: { properties: { rngd: true } } };
const knife = { system: { properties: {} } };

test("getStatuses: CoC7's conditions, Foundry's status icons and Rollbox's notes, serious first", () => {
  makeEnv();
  const actor = character({ conditions: ["prone", "criticalWounds"], statuses: ["unconscious"],
    round: { aiming: true } });
  assert.deepEqual(getStatuses(actor).map((s) => [s.id, s.kind]),
    [["unconscious", "serious"], ["majorWound", "serious"], ["prone", "other"], ["aiming", "rollbox"]]);
  assert.match(getStatuses(actor)[3].detail, /they move/);
});

test("getStatuses: a player reads their own Rollbox states as 'you'", () => {
  makeEnv({ isGM: false });
  assert.match(getStatuses(character({ round: { dived: true } }))[0].detail, /You lose your next attack/);
});

test("getStatuses: Aiming and Dived for cover come only from combat's round notes, not a status flag or another round", () => {
  makeEnv();
  assert.deepEqual(getStatuses(character({ notes: { aiming: true, divedForCover: true } })), []);
  const stale = character({ round: { aiming: true, dived: true } });
  stale.flags[ID].roundNotes.round = 0;
  assert.deepEqual(getStatuses(stale), []);
});

test("getStatuses: nothing for no character or one without conditions", () => {
  makeEnv();
  assert.deepEqual(getStatuses(null), []);
  assert.deepEqual(getStatuses({ name: "Box" }), []);
});

test("setRollboxStatus: Restrained is its note; Prone is CoC7's and only read", async () => {
  makeEnv();
  const actor = character({ notes: { restrained: true } });
  assert.equal(await setRollboxStatus(actor, "restrained", false), true);
  assert.equal(await setRollboxStatus(actor, "prone", true), false);
  assert.deepEqual(actor.calls, [["unsetFlag", ID, "statuses.restrained"]]);
});

test("setRollboxStatus does nothing: already so, not Rollbox's, not owned", async () => {
  makeEnv();
  const actor = character({ conditions: ["prone"] });
  assert.equal(await setRollboxStatus(actor, "prone", true), false);
  assert.equal(await setRollboxStatus(actor, "dying", true), false);
  assert.equal(await setRollboxStatus(actor, "divedForCover", true), false);
  assert.equal(await setRollboxStatus(character({ isOwner: false }), "restrained", true), false);
  assert.deepEqual(actor.calls, []);
});

test("attackDice: prone is a bonus die in melee, a penalty die for a gun, none at point blank", () => {
  makeEnv();
  const target = character({ conditions: ["prone", "criticalWounds"] });
  assert.deepEqual(attackDice({ target, weapon: knife }).lines.map((l) => [l.status, l.dice, l.note]), [
    ["majorWound", 0, "no effect on the attack"], ["prone", 1, "easier to hit when down"]]);
  assert.equal(attackDice({ target, weapon: knife }).net, 1);
  assert.equal(attackDice({ target, weapon: firearm }).net, -1);
  assert.equal(attackDice({ target, weapon: firearm, pointBlank: true }).net, 0);
});

test("attackDice: point blank, firing into melee and outnumbered are CoC7's own toggles, counted in the total only", () => {
  makeEnv();
  const target = character();
  const shot = attackDice({ target, weapon: firearm, pointBlank: true, intoMelee: true });
  assert.deepEqual(shot.lines.map((l) => [l.status, l.dice, l.toggle]), [["pointBlank", 1, "pointBlank"], ["intoMelee", -1, "inMelee"]]);
  assert.deepEqual([shot.net, shot.total, shot.toggles], [0, 0, ["pointBlank", "inMelee"]]);
  const blow = attackDice({ target, weapon: knife, outnumbered: true });
  assert.deepEqual([blow.total, blow.toggles], [1, ["outnumbered"]]);
  assert.deepEqual(attackDice({ target, weapon: knife, pointBlank: true, intoMelee: true }).lines, []);
});

test("attackDice: mace spray never gets point blank: CoC7's own is taken off", () => {
  makeEnv();
  const mace = { name: "Mace Spray*", system: { properties: { rngd: true } } };
  const result = attackDice({ target: character(), weapon: mace, pointBlank: true });
  assert.deepEqual(result.lines.map((l) => [l.status, l.dice, l.toggle]), [["pointBlank", 0, "noPointBlank"]]);
  assert.equal(result.total, 0);
});

test("attackDice: dived for cover is CoC7's Under cover toggle, not a die on the slider; a prone shooter for a gun", () => {
  makeEnv();
  const target = character({ conditions: ["unconscious"], round: { dived: true } });
  const result = attackDice({ attacker: character({ conditions: ["prone"] }), target, weapon: firearm });
  assert.deepEqual(result.lines.map((l) => [l.status, l.dice, l.toggle]),
    [["unconscious", 0, undefined], ["divedForCover", -1, "cover"], ["prone", 1, undefined]]);
  assert.equal(result.net, 1);
  assert.deepEqual(result.toggles, ["cover"]);
});

test("attackDice: no target, no lines", () => {
  makeEnv();
  assert.deepEqual(attackDice({ attacker: character(), target: null, weapon: firearm }),
    { lines: [], net: 0, total: 0, toggles: [] });
});

test("statusCards: Rollbox's own on top, serious nearest the sheet, each with its hover text", () => {
  makeEnv(); makeDom();
  const stack = statusCards(character({ conditions: ["prone", "criticalWounds"], round: { aiming: true } }));
  const cards = [...stack.querySelectorAll(".rollbox-status-card")];
  assert.deepEqual(cards.map((c) => c.dataset.status), ["aiming", "prone", "majorWound"]);
  assert.ok(cards[0].classList.contains("rollbox-status-rollbox"));
  assert.ok(cards[2].classList.contains("rollbox-status-serious"));
  assert.equal(cards[2].querySelector(".rollbox-status-tip b").textContent, "Major wound");
});

test("statusCards: none without statuses; placeStatusCards puts them before the sheet", () => {
  makeEnv(); makeDom();
  assert.equal(statusCards(character()), null);
  const panel = document.createElement("div");
  panel.append(document.createElement("section"));
  assert.equal(placeStatusCards(panel, character()), false);
  assert.equal(placeStatusCards(panel, character({ conditions: ["dead"] })), true);
  assert.ok(panel.firstChild.classList.contains("rollbox-status-cards"));
});

test("panel: status cards above the sheet for one selected character, none for two; CoC7's icons redraw them",
  async () => {
    const env = makeEnv();
    makeDom(`<div id="ui-left-column-1"><aside id="players"></aside></div>`);
    const frames = [];
    globalThis.requestAnimationFrame = (f) => frames.push(f);
    globalThis.cancelAnimationFrame = () => {};
    globalThis.canvas = { tokens: { controlled: [] } };
    await load(env);
    const flush = () => frames.splice(0).forEach((f) => f());
    const harvey = Object.assign(makeActor({ name: "Harvey" }), { uuid: "Actor.Harvey", statuses: new Set(["prone"]) });
    const helen = Object.assign(makeActor({ name: "Helen" }), { uuid: "Actor.Helen" });
    const select = (...actors) => {
      canvas.tokens.controlled = actors.map((actor) => ({ actor }));
      Hooks.call("controlToken", canvas.tokens.controlled[0], true);
      flush();
    };
    const shown = () => [...document.querySelectorAll(".rollbox-character-panel .rollbox-status-card")]
      .map((card) => card.dataset.status);
    select(harvey);
    assert.deepEqual(shown(), ["prone"]);
    harvey.statuses.add("unconscious");
    Hooks.call("createActiveEffect", { parent: harvey });
    flush();
    assert.deepEqual(shown(), ["prone", "unconscious"]);
    select(harvey, helen);
    assert.deepEqual(shown(), []);
  });

test("statusCards: the Keeper clears Restrained from its card; CoC7's own statuses have no ×", async () => {
  makeEnv(); makeDom();
  const actor = character({ conditions: ["prone"], notes: { restrained: true } });
  const stack = statusCards(actor);
  assert.equal(stack.querySelector('[data-status="prone"] .rollbox-status-clear'), null);
  stack.querySelector('[data-status="restrained"] .rollbox-status-clear').click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(actor.calls, [["unsetFlag", ID, "statuses.restrained"]]);
});
