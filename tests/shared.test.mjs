import assert from "node:assert/strict";
import { test } from "node:test";
import { customDice, dicePicker, setSimplifiedDice } from "../scripts/shared/dice-picker.js";
import { valueLine } from "../scripts/shared/value-line.js";
import { isReloadable, reloadSource } from "../scripts/shared/reload-kind.js";
import { edgeDistance } from "../scripts/shared/distance.js";
import { difficultyFor } from "../scripts/shared/rules.js";
import { makeDom } from "./mocks.mjs";

test("difficultyFor: below 50 Regular, 50+ Hard, 90+ Extreme", () => {
  assert.deepEqual([1, 49, 50, 89, 90, 140].map(difficultyFor), ["regular", "regular", "hard", "hard", "extreme", "extreme"]);
});

/** A value line and its compact picker in a fresh document, with helpers to use them like the Keeper. */
function open({ value = "0", damageBonus = false, check } = {}) {
  makeDom();
  let changes = 0;
  const line = valueLine({ label: "Loss", value, check, onChange: () => changes++ });
  const picker = dicePicker({ label: "Loss", line, damageBonus, onChange: () => changes++ });
  document.body.append(line.element, picker.element);
  const press = (text) => [...picker.element.querySelectorAll("button")].find((b) => b.textContent === text).click();
  const step = (which, label) => picker.element.querySelector(`[aria-label="Loss: ${which}: ${label}"]`).click();
  const type = (text) => {
    line.element.value = text;
    line.element.dispatchEvent(new document.defaultView.Event("input"));
  };
  const key = (name) => line.element.dispatchEvent(new document.defaultView.KeyboardEvent("keydown", { key: name }));
  const pressed = () => [...picker.element.querySelectorAll('[aria-pressed="true"]')].map((b) => b.textContent);
  return { line, picker, press, step, type, key, pressed, changes: () => changes };
}

test("compact picker: each click writes its dice formula into the line", () => {
  const m = open();
  m.press("D6");
  assert.equal(m.line.value, "1D6"); // a die alone is one die
  m.step("number of dice", "more"); m.press("D4"); m.step("flat bonus", "more");
  assert.equal(m.line.value, "2D4+1");
  assert.deepEqual(m.pressed(), ["D4"]);
  m.press("None");
  assert.equal(m.line.value, "0");
  m.step("flat bonus", "more");
  assert.equal(m.line.value, "1"); // a flat loss, as in the 1/1D6 preset
  m.step("number of dice", "more");
  assert.equal(m.line.value, "1D6+1"); // dice from none pick a D6
  assert.ok(m.changes() > 0);

  const damage = open({ damageBonus: true });
  damage.press("D6"); damage.press("+DB");
  assert.equal(damage.line.value, "1D6+DB");
  damage.picker.halfBonus(true);
  damage.press("+½DB"); damage.press("D4"); damage.press("+½DB");
  assert.equal(damage.line.value, "1D4+½DB");
  assert.equal(open().picker.element.querySelector(".rollbox-dice-db"), null); // +DB only for damage
});

test("compact picker: typing in the line moves the picker; text it can't show presses nothing", () => {
  const m = open();
  m.type("2d10+3");
  m.picker.sync();
  assert.deepEqual(m.pressed(), ["D10"]);
  assert.deepEqual([...m.picker.element.querySelectorAll(".rollbox-dice-count")].map((n) => n.textContent), ["2", "3"]);
  m.type("1D6+1D4");
  m.picker.sync();
  assert.deepEqual(m.pressed(), []);
  m.press("D8"); // starts again from nothing
  assert.equal(m.line.value, "1D8");
});

test("value line: Enter or clicking away confirms, tidied; empty becomes 0; refused text is red and has no value", () => {
  const tidy = (text) => text.replace(/\s+/g, "").toUpperCase();
  const m = open({ check: (text) => (/^[0-9D+]+$/.test(tidy(text)) ? tidy(text) : null) });
  m.type("1d6 + 1");
  m.key("Enter");
  assert.equal(m.line.text, "1D6+1");
  m.type("");
  assert.equal(m.line.value, "0"); // empty counts as 0 while typing
  m.line.element.dispatchEvent(new document.defaultView.Event("blur"));
  assert.equal(m.line.text, "0");
  m.type("1d6x");
  assert.equal(m.line.value, null);
  assert.ok(m.line.element.classList.contains("rollbox-value-invalid"));
  m.key("Enter");
  assert.equal(m.line.text, "1d6x"); // kept as typed, still red
  assert.equal(m.line.element.getAttribute("aria-invalid"), "true");
});

/** The Keeper's "Simplified dice UI" setting, as game.settings gives it; undefined: no setting (off). */
function simplified(value) {
  globalThis.game = value === undefined ? undefined : { settings: { get: () => value } };
}

test("Simplified dice UI: on, the Custom button and its pickers are gone; changing it switches an open flyout at once", () => {
  simplified(true);
  try {
    const m = open({ value: "1D4+1" });
    const custom = customDice({ label: "Custom damage", pickers: [m.picker] });
    document.body.append(custom.element);
    assert.equal(custom.element.hidden, true);
    setSimplifiedDice(false);
    assert.equal(custom.element.hidden, false);
    assert.equal(custom.open, false);
    custom.button.click();
    assert.equal(custom.open, true);
    assert.deepEqual(m.pressed(), ["D4"]);
    setSimplifiedDice(true);
    assert.equal(custom.element.hidden, true);
    assert.equal(m.line.text, "1D4+1"); // the line keeps what it holds
  } finally {
    simplified(undefined);
  }
});

/** A firearm as CoC7 keeps it: its skill as written, capacity, properties and CoC ID; Rollbox's flag when given. */
function gun(name, skill, { cocid, flag, auto = false, brst = false, bullets = 6 } = {}) {
  return { type: "weapon", name, flags: { ...(cocid ? { CoC7: { cocidFlag: { id: cocid } } } : {}),
    ...(flag ? { "keepers-rollbox": { reloadKind: flag } } : {}) },
  system: { bullets, skill: { main: { name: skill } }, properties: { rngd: true, auto, brst } } };
}

test("reload kind: Rollbox's flag, then the CoC ID table, then the name rule; a handgun whose name says neither way is a guess", () => {
  const read = (weapon) => Object.values(reloadSource(weapon)).join(" ");
  assert.equal(read(gun("Custom", "Firearms (Handgun)", { flag: "belt", cocid: "i.weapon.45-revolver" })), "belt flag");
  // The table knows the Lewis gun takes a pan magazine, though its skill is Machine Gun.
  assert.equal(read(gun("Mark I Lewis Gun", "i.skill.firearms-machine-gun", { cocid: "i.weapon.mark-i-lewis-gun" })),
    "magazine cocid");
  assert.equal(read(gun(".38 Revolver", "Handgun")), "rounds rule");
  assert.equal(read(gun("Luger", "Firearms (Handgun)")), "magazine rule");
  assert.equal(read(gun("Grandpa's Colt", "Firearms (Handgun)")), "magazine guess");
  assert.equal(read(gun("Big MG", "Firearms (Machine Gun)")), "belt rule");
  assert.equal(read(gun("Tommy", "Firearms (Submachine Gun)")), "magazine rule");
  assert.equal(read(gun("Hunting rifle", "Firearms (Rifle/Shotgun)", { brst: true })), "magazine rule");
  assert.equal(read(gun("Hunting rifle", "Firearms (Rifle/Shotgun)")), "rounds rule");
  assert.equal(read(gun("Ray", "Firearms (Lightning Gun)")), "rounds guess");
});

test("reload kind: only firearms with a capacity are reloaded; thrown, fighting and explosive skills never", () => {
  assert.equal(isReloadable(gun("Revolver", "Firearms (Handgun)")), true);
  assert.equal(isReloadable(gun("Shuriken", "i.skill.throw")), false);
  assert.equal(isReloadable(gun("Knife", "Fighting (Throw)")), false);
  assert.equal(isReloadable(gun("Flamethrower", "i.skill.firearms-flamethrower")), true);
  assert.equal(isReloadable(gun("Mace Spray", "i.skill.fighting-brawl")), false);
  assert.equal(isReloadable(gun("Gun", "Firearms (.38 revolver)", { bullets: 0 })), false);
});

test("bug: edgeDistance measures from where a token was moved to, not where Foundry's move animation has it", () => {
  globalThis.canvas = { grid: { size: 100, distance: 5, units: "ft" }, scene: { grid: { units: "ft" } } };
  // During the animation the document's x (and Token#center) still give the old place; _source has the new one.
  const token = (from, to) => {
    const document = { _source: { x: to, y: 0 }, x: from, y: 0,
      getCenterPoint: ({ x = document.x, y = document.y } = {}) => ({ x: x + 50, y: y + 50 }) };
    return { document, w: 100, center: { x: from + 50, y: 50 } };
  };
  const mover = token(0, 300);
  const still = token(500, 500);
  assert.equal(edgeDistance(mover, still).distance, 5); // 200 px centre to centre, less two half-widths: 1 space
  assert.equal(edgeDistance({ center: { x: 50, y: 50 }, w: 100 }, { center: { x: 550, y: 50 }, w: 100 }).distance, 20);
  delete globalThis.canvas;
});
