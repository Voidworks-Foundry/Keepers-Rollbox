import assert from "node:assert/strict";
import { test } from "node:test";
import { customDice, dicePicker, setSimplifiedDice } from "../scripts/shared/dice-picker.js";
import { valueLine } from "../scripts/shared/value-line.js";
import { makeDom } from "./mocks.mjs";

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

test("compact picker: clicks write the same formulas as the old picker into the line", () => {
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

test("Simplified dice UI: on, the Custom button and its pickers are gone; changing it switches an open menu at once", () => {
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
