/** The panel's z-index among Foundry's windows (the Panel layer setting). See docs/panel.md. */
import { warn } from "../utils.js";

/** The Panel layer choices: key → label. */
export const PANEL_LAYERS = Object.freeze({ bottom: "Bottom", top: "Top", active: "Top when active",
  activeOrSelected: "Top when active or selected" });
/** The Panel layer's default key. */
export const DEFAULT_PANEL_LAYER = "active";

// Foundry v14: the UI columns' level, under every window.
const BOTTOM_Z = "var(--z-index-app, 30)";
// Foundry v14: just under the tooltips and the tour overlays (tooltip − 2 and − 1), so above every window.
const TOP_Z = "calc(var(--z-index-tooltip, 9999) - 3)";
const WINDOW_Z = "var(--z-index-window, 100)";
// Foundry v14: where `Application#bringToFront` caps its counter.
const MAX_Z = 99999;

let warned = false;

function normalLayer(layer) {
  return Object.hasOwn(PANEL_LAYERS, layer) ? layer : DEFAULT_PANEL_LAYER;
}

// Foundry v14: `ApplicationV2._maxZ` is an internal counter of window levels; guarded, one warning when missing.
function windowOrder() {
  try {
    const app = globalThis.foundry?.applications?.api?.ApplicationV2;
    if (app && Number.isFinite(app._maxZ)) return app;
  } catch {
    // reading it threw: treated as missing
  }
  if (!warned) {
    warned = true;
    warn("Foundry's window order isn't available; \"Top when active\" works as \"Bottom\".");
  }
  return null;
}

/**
 * Returns how a layer stacks: "or selected" as "active", and "active" as "bottom" without Foundry's window counter.
 * @param {string} layer the setting's value
 * @returns {"bottom"|"top"|"active"}
 */
export function layerInUse(layer) {
  const chosen = normalLayer(layer) === "activeOrSelected" ? "active" : normalLayer(layer);
  if (chosen === "active" && !windowOrder()) return "bottom";
  return chosen;
}

/**
 * Returns whether a new selection brings the panel forward.
 * @param {string} layer the setting's value
 * @returns {boolean}
 */
export function forwardOnSelect(layer) {
  return normalLayer(layer) === "activeOrSelected" && layerInUse(layer) === "active";
}

/**
 * Returns the panel's `z-index` for a layer as `layerInUse` gives it.
 * @param {string} layer
 * @param {number|null} [front] the number the panel took on its last press
 * @returns {string}
 */
export function zIndexFor(layer, front = null) {
  if (layer === "top") return TOP_Z;
  if (layer === "active") return Number.isFinite(front) ? String(front) : WINDOW_Z;
  return BOTTOM_Z;
}

/**
 * Takes the next number from Foundry's window counter, as a window brought to the front does.
 * @returns {number|null} the panel's new level, or null without the counter
 */
export function nextFront() {
  const app = windowOrder();
  if (!app) return null;
  try {
    app._maxZ = Math.min(app._maxZ + 1, MAX_Z);
    return app._maxZ;
  } catch (error) {
    warn("couldn't bring the panel to the front.", error);
    return null;
  }
}
