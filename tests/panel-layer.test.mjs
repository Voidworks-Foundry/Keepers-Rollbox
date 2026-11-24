import assert from "node:assert/strict";
import { test } from "node:test";
import { load, makeActor, makeDom, makeEnv } from "./mocks.mjs";
import { PANEL_LAYERS, forwardOnSelect, layerInUse } from "../scripts/panel/layer.js";

const SCREEN = { left: 0, top: 0, right: 1600, bottom: 900, width: 1600, height: 900 };
const PANEL = { width: 200, height: 182 };

/** The Keeper's screen with the panel floating on the players list, and Foundry's window counter at 120. */
async function keeperScreen(layer) {
  const env = makeEnv({ values: { rollboxPanelLayer: layer } });
  makeDom(`<div id="interface"><section id="ui-left"><div id="ui-left-column-1"><aside id="players"></aside></div>
    </section></div>`);
  const order = { _maxZ: 120 };
  globalThis.foundry = { applications: { api: { ApplicationV2: order } } };
  const frames = [];
  globalThis.requestAnimationFrame = (f) => frames.push(f);
  globalThis.cancelAnimationFrame = () => {};
  globalThis.canvas = { tokens: { controlled: [] } };
  document.getElementById("interface").getBoundingClientRect = () => SCREEN;
  document.getElementById("players").getBoundingClientRect = () => ({ left: 16, top: 830, right: 216, bottom: 900,
    width: 200, height: 70 });
  // jsdom has no layout: the floating panel is where its inline left and bottom put it.
  globalThis.HTMLElement.prototype.getBoundingClientRect = function () {
    if (!this.classList.contains("rollbox-panel")) return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
    const left = parseFloat(this.style.left) || 0;
    const top = SCREEN.height - (parseFloat(this.style.bottom) || 0) - PANEL.height;
    return { left, top, right: left + PANEL.width, bottom: top + PANEL.height, ...PANEL };
  };
  await load(env);
  const flush = () => frames.splice(0).forEach((f) => f());
  const actor = makeActor({ name: "Harvey", characteristics: { str: 50 } });
  actor.uuid = "Actor.Harvey";
  const select = () => {
    canvas.tokens.controlled = [{ actor }];
    Hooks.call("controlToken", canvas.tokens.controlled[0], true);
    flush();
  };
  const z = () => document.querySelector(".rollbox-panel").style.zIndex;
  return { env, order, flush, select, actor, z };
}

test("Panel layer: Top when active or selected is a fourth choice, stacking as Top when active", () => {
  makeEnv();
  globalThis.foundry = { applications: { api: { ApplicationV2: { _maxZ: 120 } } } };
  try {
    assert.equal(PANEL_LAYERS.activeOrSelected, "Top when active or selected");
    assert.equal(layerInUse("activeOrSelected"), "active");
    assert.equal(forwardOnSelect("activeOrSelected"), true);
    assert.equal(forwardOnSelect("active"), false);
  } finally {
    delete globalThis.foundry;
  }
});

test("Panel layer: without Foundry's window counter, Top when active or selected works as Bottom", () => {
  makeEnv();
  assert.equal(layerInUse("activeOrSelected"), "bottom");
  assert.equal(forwardOnSelect("activeOrSelected"), false);
});

test("Panel layer Top when active or selected: selecting tokens brings the panel forward; an update doesn't",
  async () => {
    try {
      const s = await keeperScreen("activeOrSelected");
      s.select();
      assert.deepEqual([s.z(), s.order._maxZ], ["121", 121]);
      Hooks.call("updateActor", s.actor);
      s.flush();
      assert.equal(s.z(), "121");
      s.select();
      assert.equal(s.z(), "122");
    } finally {
      delete globalThis.foundry;
    }
  });

test("Panel layer Top when active: selecting tokens leaves the panel where it is", async () => {
  try {
    const s = await keeperScreen("active");
    s.select();
    assert.deepEqual([s.z(), s.order._maxZ], ["var(--z-index-window, 100)", 120]);
  } finally {
    delete globalThis.foundry;
  }
});
