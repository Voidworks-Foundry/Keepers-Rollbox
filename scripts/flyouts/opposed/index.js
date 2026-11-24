/** The Opposed flyout's registration and its open roll. See docs/opposed-flyout.md. */
import { actorKey } from "../../utils.js";
import { registerFlyout } from "../../panel/index.js";
import { panelHere, pickTarget as askTarget } from "../../player/index.js";
import { freshSides, refreshSides } from "./sides.js";
import { OpposedView } from "./view.js";

// Module state: the sides outlive each redraw for a new selection; `view` is the one drawn last.
let carried = null;

/**
 * Registers the Opposed flyout, which stays open while anything is selected; does nothing without a panel.
 * @returns {boolean} true when registered
 */
export function registerOpposedRoll() {
  if (!panelHere()) return false;
  carried = null;
  return registerFlyout("opposed", { title: "Opposed roll", render: renderOpposedRoll, staysOpen: true,
    start: opposedStart, waiting: opposedWaiting });
}

/**
 * Draws the Opposed view: fresh sides when opened, the carried sides refreshed when only the selection changed.
 * @param {HTMLElement} stage
 * @param {{actors: Actor[], everyone?: boolean, close?: () => void, selectionChanged?: boolean,
 *   start?: {first?: string, picks?: Object<string, string>, create?: boolean}, targeting?: boolean,
 *   pickTarget?: (options: {prompt: string}) => Promise<Token|null>}} context `targeting`: a player's flyout
 * @returns {{apply: (start: object) => void}}
 */
export function renderOpposedRoll(stage, { actors = [], everyone = false, close = () => {}, selectionChanged = false,
  start, targeting = game.user?.isGM !== true, pickTarget = askTarget } = {}) {
  const selected = everyone ? [] : Array.from(actors ?? []).filter(Boolean);
  if (selectionChanged && carried) refreshSides(carried, selected);
  else carried = { sides: freshSides(selected, start), actors: [...selected], view: null };
  const own = targeting ? selected[0] ?? null : null;
  const view = new OpposedView(stage, carried, close, { targeting, pickTarget, own });
  carried.view = view;
  view.build();
  if (start?.create) view.create();
  return { apply: (next) => view.apply(next) };
}

/**
 * Tells whether the Opposed view is in the page with a side waiting for its character.
 * @returns {boolean}
 */
export function opposedWaiting() {
  const view = carried?.view;
  return Boolean(view?.stage?.isConnected) && carried.sides.some((side) => !side.actor);
}

/**
 * Returns the starting state for an opposed roll begun from a character's value.
 * @param {Actor} actor
 * @param {string} key the check's row key, e.g. "characteristic:str"
 * @param {{create?: boolean, first?: boolean}} [options] `first: false` fills a waiting side instead of starting
 * @returns {{first?: string, picks: Object<string, string>, create: boolean}}
 */
export function opposedStart(actor, key, { create = false, first = true } = {}) {
  const id = actorKey(actor);
  return { ...(first ? { first: id } : {}), picks: { [id]: key }, create: Boolean(create) };
}
