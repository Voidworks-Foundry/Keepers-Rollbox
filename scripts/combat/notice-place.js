/** Places the fight's notice cards above the hotbar, and lets each kind be dragged and sized. See docs/combat.md. */
import { MODULE_ID, PERSONAL, declareSettings, option, warn } from "../utils.js";

const NOTICE_SCALE = Object.freeze({ min: 80, max: 250, step: 10, default: 100 });
// Foundry v14: the macro bar's id.
const HOTBAR_ID = "hotbar";
const GAP = 8;
// Pixels a press must move before it is a drag rather than a click.
const DRAG_THRESHOLD = 4;
const NO_DRAG = "button, input, select, textarea, a";
const SWALLOW_MS = 250;
const PLACED_CLASS = "rollbox-notice-placed";
const DRAGGING_CLASS = "rollbox-notice-dragging";
const STACK_CLASS = "rollbox-fight-notices";

/**
 * Declares the Notice cards size setting and the hidden store of each card's place.
 * @type {object[]}
 */
export const SETTINGS = declareSettings([
  { key: "rollboxNoticeScale", scope: "user", type: Number, default: NOTICE_SCALE.default, section: "panel",
    label: "Notice cards size",
    hint: "Size of the fight's small cards (Who's joining this fight?, the joining card, the flee notice, A fight has "
      + "broken out). Saving a new size sets every card to it. Each card can also be dragged by its top line and "
      + "sized with the mouse wheel while you hold it; it keeps its own place and size.",
    range: { min: NOTICE_SCALE.min, max: NOTICE_SCALE.max, step: NOTICE_SCALE.step }, note: PERSONAL, reset: true,
    onChange: (value) => resetNoticeSizes(value) },
  { key: "rollboxNoticePlaces", scope: "user", type: Object, default: {}, section: "panel",
    label: "Notice card places", config: false, note: PERSONAL }
]);

const shown = new Map();

function clampScale(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(NOTICE_SCALE.min, Math.min(NOTICE_SCALE.max, Math.round(n))) : NOTICE_SCALE.default;
}

function savedPlaces() {
  const places = option("rollboxNoticePlaces");
  return places && typeof places === "object" ? places : {};
}

function savedFor(kind) {
  const entry = savedPlaces()[kind] ?? {};
  const place = Number.isFinite(entry.x) && Number.isFinite(entry.y) ? { x: entry.x, y: entry.y } : null;
  const scale = clampScale(Number.isFinite(entry.scale) ? entry.scale : option("rollboxNoticeScale"));
  return { place, scale };
}

async function save(kind, { x, y, scale }) {
  try {
    const places = { ...savedPlaces(), [kind]: { x: Math.round(x), y: Math.round(y), scale } };
    await game.settings.set(MODULE_ID, "rollboxNoticePlaces", places);
  } catch (error) {
    warn("couldn't save the notice card's place.", error);
  }
}

const host = () => document.getElementById("interface") ?? document.body;

function screen() {
  const view = document.defaultView ?? globalThis;
  return { width: view.innerWidth || 0, height: view.innerHeight || 0 };
}

function onScreen({ x, y }, width, height) {
  const { width: w, height: h } = screen();
  return { x: Math.max(0, Math.min(Math.max(0, w - width), x)), y: Math.max(0, Math.min(Math.max(0, h - height), y)) };
}

function drawnSize(card, scale) {
  return { width: (card.offsetWidth || 0) * (scale / 100), height: (card.offsetHeight || 0) * (scale / 100) };
}

function putAt(card, spot, scale) {
  if (card.parentElement !== host()) host().append(card);
  card.classList.add(PLACED_CLASS);
  card.style.zoom = "";
  card.style.transformOrigin = "top left";
  card.style.transform = scale === 100 ? "none" : `scale(${scale / 100})`;
  const { width, height } = drawnSize(card, scale);
  const at = onScreen(spot, width, height);
  card.style.left = `${at.x}px`;
  card.style.top = `${at.y}px`;
  return at;
}

function aboveHotbar() {
  const bar = document.getElementById(HOTBAR_ID)?.getBoundingClientRect?.();
  const { width: w, height: h } = screen();
  const usable = bar && (bar.width > 0 || bar.height > 0);
  return { middle: usable ? bar.left + bar.width / 2 : w / 2, bottom: (usable ? bar.top : h - 60) - GAP };
}

// Foundry's hotbar moves with the window's size, so this runs as each card joins and on every resize.
function placeStack(stack) {
  const { middle, bottom } = aboveHotbar();
  stack.style.left = `${Math.round(middle)}px`;
  stack.style.bottom = `${Math.max(0, Math.round(screen().height - bottom))}px`;
}

let resizing = false;

/**
 * Returns the stack above the hotbar, made when the first card opens there.
 * @returns {HTMLElement}
 */
export function noticeStack() {
  let stack = document.querySelector(`.${STACK_CLASS}`);
  if (!stack) {
    stack = document.createElement("div");
    stack.className = STACK_CLASS;
    host().append(stack);
  }
  placeStack(stack);
  if (!resizing) {
    resizing = true;
    (document.defaultView ?? globalThis).addEventListener?.("resize", () => {
      const open = document.querySelector(`.${STACK_CLASS}`);
      if (open) placeStack(open);
    });
  }
  return stack;
}

// A placed card scales with `transform`; a stacked one with `zoom`, so the stack lays it out at its drawn size.
function apply(card, kind) {
  const { place, scale } = savedFor(kind);
  if (place) return putAt(card, place, scale);
  card.classList.remove(PLACED_CLASS);
  card.style.left = "";
  card.style.top = "";
  card.style.transform = "";
  card.style.transformOrigin = "";
  card.style.zoom = scale === 100 ? "" : String(scale / 100);
  const stack = noticeStack();
  if (card.parentElement !== stack) stack.append(card);
  return null;
}

/**
 * Makes a notice card draggable and sizeable, drawn at its kind's saved place and size. Call once it is in the page.
 * @param {HTMLElement} card
 * @param {string} kind the kind that keeps its own place and size, e.g. "joining"
 * @param {{handle?: HTMLElement|null}} [options] the part a press drags from; default the whole card
 * @returns {HTMLElement} the card
 */
export function placeNotice(card, kind, { handle = null } = {}) {
  if (!card || !kind) return card;
  try {
    shown.set(card, kind);
    apply(card, kind);
    const grip = handle ?? card;
    grip.classList.add("rollbox-notice-handle");
    grip.addEventListener("pointerdown", (event) => pressed(event, card, kind));
  } catch (error) {
    warn("couldn't place the notice card.", error);
  }
  return card;
}

// The wheel is the held card's, captured so Foundry's map never zooms meanwhile.
function pressed(event, card, kind) {
  if (event.button !== 0 || event.target?.closest?.(NO_DRAG)) return;
  const { scale } = savedFor(kind);
  const press = { x: event.clientX, y: event.clientY, moved: false, scale, from: null, changed: false };
  const view = card.ownerDocument?.defaultView ?? globalThis;
  const lift = () => {
    if (press.from) return;
    const rect = card.getBoundingClientRect();
    press.from = putAt(card, { x: rect.left, y: rect.top }, press.scale);
    card.classList.add(DRAGGING_CLASS);
  };
  const move = (moving) => {
    const dx = moving.clientX - press.x;
    const dy = moving.clientY - press.y;
    if (!press.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    press.moved = true;
    press.changed = true;
    lift();
    press.at = putAt(card, { x: press.from.x + dx, y: press.from.y + dy }, press.scale);
  };
  const wheel = (turning) => {
    turning.preventDefault();
    turning.stopImmediatePropagation();
    if (!turning.deltaY) return;
    const to = clampScale(press.scale + (turning.deltaY < 0 ? 1 : -1) * NOTICE_SCALE.step);
    if (to === press.scale) return;
    lift();
    press.scale = to;
    press.changed = true;
    // The top left corner stays where it is; the pointer's moves go on from there.
    press.at = putAt(card, press.at ?? press.from, to);
  };
  const release = () => {
    view.removeEventListener("pointermove", move);
    view.removeEventListener("pointerup", release);
    view.removeEventListener("pointercancel", release);
    view.removeEventListener("wheel", wheel, { capture: true });
    card.classList.remove(DRAGGING_CLASS);
    if (!press.changed) return;
    // A drag ends with a click on what is under the pointer, swallowed once; it expires, so a drag released with
    // no click never eats the next real one.
    if (press.moved) {
      const swallow = (click) => click.stopPropagation();
      view.addEventListener("click", swallow, { capture: true, once: true });
      setTimeout(() => view.removeEventListener("click", swallow, { capture: true }), SWALLOW_MS);
    }
    const at = press.at ?? press.from;
    if (at) save(kind, { x: at.x, y: at.y, scale: press.scale });
  };
  view.addEventListener("pointermove", move);
  view.addEventListener("pointerup", release);
  view.addEventListener("pointercancel", release);
  view.addEventListener("wheel", wheel, { capture: true, passive: false });
}

/**
 * Forgets a closed card.
 * @param {HTMLElement} card
 * @returns {void}
 */
export function forgetNotice(card) {
  shown.delete(card);
}

/**
 * Forgets every card's own size and redraws the open cards at the setting's; places stay.
 * @param {number} value
 * @returns {Promise<number>} the value
 */
export async function resetNoticeSizes(value) {
  const places = savedPlaces();
  const kept = Object.fromEntries(Object.entries(places).map(([kind, { scale, ...place }]) => [kind, place]));
  try {
    if (Object.values(places).some((entry) => "scale" in (entry ?? {}))) {
      await game.settings.set(MODULE_ID, "rollboxNoticePlaces", kept);
    }
  } catch (error) {
    warn("couldn't reset the notice cards' sizes.", error);
  }
  for (const [card, kind] of shown) {
    if (!card.isConnected) shown.delete(card);
    else apply(card, kind);
  }
  return value;
}
