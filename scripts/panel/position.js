/** Where the panel sits, its menu's side, and dragging it by its header. See docs/panel.md. */
import { MODULE_ID, warn } from "../utils.js";
import {
  besideList, boxAt, clampBox, clampSpot, cornerSides, followSidebar, normalSpot, onScreen, samePlace, spotOf
} from "./placement.js";
import { layerInUse, nextFront, zIndexFor } from "./layer.js";

// Foundry v14: `aside#players` in `#ui-left-column-1`.
const PLAYERS_ID = "players";
// Foundry v14: Foundry's UI container (`templates/views/game.hbs`, `position: relative`), the moved panel's parent.
const INTERFACE_ID = "interface";
// Foundry v14: `#ui-right`, wider while expanded.
const SIDEBAR_ID = "sidebar";

/** The choices of the menu's side: key → label. */
export const MENU_SIDES = Object.freeze({ auto: "Automatic", right: "Right", left: "Left" });
/** The menu's default side. */
export const DEFAULT_MENU_SIDE = "auto";

const MENUS_LEFT_CLASS = "rollbox-menus-left";
const GROW_DOWN_CLASS = "rollbox-grow-down";
const MOVABLE_CLASS = "rollbox-movable";
const DRAGGING_CLASS = "rollbox-dragging";

const HANDLE = [".rollbox-character-panel > .rollbox-card > .rollbox-sheet-head",
  ".rollbox-character-panel > .rollbox-card > .rollbox-cards-head"].join(", ");
/** The combat box drags from anywhere on it: a press that doesn't move is still a click. */
const COMBAT_BOX = ".rollbox-character-panel > .rollbox-turn-order";
const NO_DRAG = "input, select, textarea";
/** The menu's extra buttons can reach past the side's box, so both are measured. */
const MENU_PARTS = ".rollbox-side, .rollbox-menu";
// Foundry v14: `.application` (ApplicationV2) and `.window-app` (the older Application).
const WINDOWS = ".application, .window-app";
/** A press that moves less than this (in pixels) is a click, not a drag. */
const DRAG_THRESHOLD = 4;

const FLOATING_STYLES = ["position", "zIndex", "margin", "left", "right", "top", "bottom"];

/** The box around these rects, or null with none. */
function unionOf(rects) {
  if (!rects.length) return null;
  return { left: Math.min(...rects.map((r) => r.left)), right: Math.max(...rects.map((r) => r.right)),
    top: Math.min(...rects.map((r) => r.top)), bottom: Math.max(...rects.map((r) => r.bottom)) };
}

// Foundry v14: `#players-active` and `#players-inactive` are wider than `#players`, so the panel sits beside them.
function listRect(players) {
  const rects = [players, ...Array.from(players.children ?? [])].map((node) => node.getBoundingClientRect())
    .filter((rect) => rect.width > 0 || rect.height > 0);
  return unionOf(rects) ?? players.getBoundingClientRect();
}

/** The box around the panel and its menu parts that are drawn, or null with none. */
function partsBox(root) {
  return unionOf([root, ...root.querySelectorAll(MENU_PARTS)]
    .map((node) => node.getBoundingClientRect()).filter((rect) => rect.width && rect.height));
}

// `--rollbox-scale` is set by appearance.js from Panel size.
const factorOf = (root) => Number(root.style.getPropertyValue("--rollbox-scale")) || 1;

/** How far Foundry's sidebar reaches in from the area's right edge, or null with no sidebar to measure. */
function sidebarReach(area) {
  const sidebar = document.getElementById(SIDEBAR_ID);
  if (!sidebar) return null;
  const rect = sidebar.getBoundingClientRect();
  if (!rect.width) return null;
  return Math.max(0, area.right - rect.left);
}

function boxIn(rect, area) {
  return { left: rect.left - area.left, top: rect.top - area.top, width: rect.width, height: rect.height };
}

/** Places the panel (beside the players list or at a dropped spot), sets its menu's side, and drags it. */
export class PanelPlace {
  /**
   * @param {HTMLElement} root the panel
   * @param {{movable?: boolean, spot?: object, menuSide?: string, layer?: string,
   *   onWheelScale?: (direction: number) => ({from: number, to: number}|null), onScaleDone?: (size: number) => void}}
   *   [saved] the saved settings, and the wheel's size step and save while the panel is held
   */
  constructor(root, { movable = false, spot, menuSide, layer, onWheelScale, onScaleDone } = {}) {
    this.layer = layerInUse(layer);
    this.front = null;
    this.watcher = null;
    this.watched = null;
    this.sidebarWatcher = null;
    this.root = root;
    this.movable = movable === true;
    this.spot = this.movable ? normalSpot(spot) : null;
    this.menuSide = Object.hasOwn(MENU_SIDES, menuSide) ? menuSide : DEFAULT_MENU_SIDE;
    this.press = null;
    this.checked = false; // whether the saved spot has been checked against the screen
    this.warned = new Set();
    this.onMove = (event) => this.move(event);
    this.onRelease = () => this.release();
    this.onWheel = (event) => this.wheel(event);
    this.wheelScale = typeof onWheelScale === "function" ? onWheelScale : null;
    this.scaleDone = typeof onScaleDone === "function" ? onScaleDone : null;
    this.sizeWatcher = null;
    root.addEventListener("pointerdown", (event) => this.pressed(event));
    // Capture, so a press on a button that redraws the panel still brings it to the front.
    root.addEventListener("pointerdown", () => this.toFront(), { capture: true });
    // Foundry v14 gives no new number to its front window, so a press on it wouldn't lift it over the panel: the
    // panel drops to that window's level first (capture on the document runs before Foundry).
    this.doc = root.ownerDocument ?? document;
    this.onBehind = (event) => this.behind(event);
    this.doc.addEventListener("pointerdown", this.onBehind, { capture: true, passive: true });
  }

  /**
   * Stops every listener and size watcher outside the panel itself, so a panel set aside leaves nothing running.
   * @returns {void}
   */
  destroy() {
    this.cancel();
    this.doc.removeEventListener("pointerdown", this.onBehind, { capture: true });
    for (const watcher of [this.watcher, this.sidebarWatcher, this.sizeWatcher]) watcher?.disconnect();
    this.watcher = null;
    this.watched = null;
    this.sidebarWatcher = null;
    this.sizeWatcher = null;
  }

  behind(event) {
    if (this.layer !== "active" || !Number.isFinite(this.front)) return;
    const target = event.target;
    if (!target?.closest || this.root.contains(target)) return;
    const win = target.closest(WINDOWS);
    if (!win) return;
    const level = Number.parseInt(win.style.zIndex || globalThis.getComputedStyle?.(win)?.zIndex, 10);
    if (!Number.isFinite(level) || level > this.front) return;
    this.front = level;
    this.root.style.zIndex = zIndexFor(this.layer, level);
  }

  setLayer(layer) {
    this.layer = layerInUse(layer);
    this.front = null;
    this.place();
  }

  toFront() {
    if (this.layer !== "active" || this.root.style.position !== "absolute") return;
    const front = nextFront();
    if (front === null) return;
    this.front = front;
    this.root.style.zIndex = zIndexFor(this.layer, front);
  }

  warnOnce(text) {
    if (this.warned.has(text)) return;
    this.warned.add(text);
    warn(text);
  }

  setMovable(movable) {
    this.movable = movable === true;
    this.spot = null;
    this.place();
  }

  reset() {
    this.spot = null;
    this.place();
  }

  setMenuSide(menuSide) {
    this.menuSide = Object.hasOwn(MENU_SIDES, menuSide) ? menuSide : DEFAULT_MENU_SIDE;
    this.place();
  }

  /**
   * Puts the panel where it belongs now, kept on screen; a saved spot is left as it is.
   * @returns {boolean} false when it can't show (no players list to sit beside)
   */
  place() {
    this.root.classList.toggle(MOVABLE_CLASS, this.movable);
    if (this.press?.start) return true; // being dragged: the pointer decides
    const area = document.getElementById(INTERFACE_ID);
    if (!area) return this.dock();
    if (!this.spot) return this.dockBeside(area);
    this.float(area);
    if (this.spot) return true;
    return this.dockBeside(area); // the spot was off screen, or the panel didn't land on it
  }

  // Only without `#interface`. Not inside `#players`: Foundry replaces its contents on each render.
  dock() {
    const players = document.getElementById(PLAYERS_ID);
    for (const key of FLOATING_STYLES) this.root.style[key] = "";
    this.mark(false, false);
    if (!players) {
      this.warnOnce("Foundry's players list is missing; the panel can't show.");
      return false;
    }
    if (players.previousElementSibling !== this.root) players.before(this.root);
    return true;
  }

  dockBeside(area) {
    const players = document.getElementById(PLAYERS_ID);
    if (!players) return this.dock();
    this.watch(players);
    const box = area.getBoundingClientRect();
    const { left, bottom } = besideList(listRect(players), box);
    if (this.root.parentElement !== area) area.append(this.root);
    const style = this.root.style;
    style.position = "absolute";
    style.zIndex = zIndexFor(this.layer, this.front);
    style.margin = "0";
    style.left = `${left}px`;
    style.right = "";
    style.top = "";
    style.bottom = `${bottom}px`;
    this.mark(false, false);
    scaleTransform(this.root, "left bottom");
    this.shiftIntoView(box, left, bottom);
    return true;
  }

  // An open flyout that runs off screen moves the docked panel just enough; the next placing puts it back.
  shiftIntoView(box, left, bottom) {
    if (this.root.hidden) return;
    const parts = partsBox(this.root);
    if (!parts) return;
    const right = parts.right - box.left;
    const top = parts.top - box.top;
    const dx = Math.min(0, box.width - right);
    const dy = top < 0 ? -top : 0;
    if (!dx && !dy) return;
    this.root.style.left = `${Math.max(0, left + dx)}px`;
    this.root.style.bottom = `${Math.max(0, bottom - dy)}px`;
  }

  /**
   * Places the panel again whenever it or a part changes size; ResizeObserver runs after layout and before paint.
   * @param {HTMLElement[]} nodes
   * @returns {boolean} false without ResizeObserver (then each redraw places the panel)
   */
  watchSize(nodes) {
    if (this.sizeWatcher || typeof globalThis.ResizeObserver !== "function") return false;
    this.sizeWatcher = new ResizeObserver(() => {
      if (!this.root.hidden) this.place();
    });
    for (const node of nodes) if (node) this.sizeWatcher.observe(node);
    return true;
  }

  redrawn() {
    if (!this.sizeWatcher) this.place();
  }

  /** Whether the panel is already placed and watched, so a redraw needn't read layout to place it. */
  inPlace() {
    return Boolean(this.sizeWatcher) && this.root.isConnected && this.root.style.position === "absolute";
  }

  watchSidebar() {
    if (this.sidebarWatcher || typeof globalThis.ResizeObserver !== "function") return;
    const sidebar = document.getElementById(SIDEBAR_ID);
    if (!sidebar) return;
    this.sidebarWatcher = new ResizeObserver(() => {
      if (this.spot && cornerSides(this.spot.corner).side === "right" && !this.root.hidden) this.place();
    });
    this.sidebarWatcher.observe(sidebar);
  }

  watch(players) {
    if (this.watched === players || typeof globalThis.ResizeObserver !== "function") return;
    this.watcher?.disconnect();
    this.watcher = new ResizeObserver(() => {
      if (!this.spot && !this.root.hidden) this.place();
    });
    this.watcher.observe(players);
    this.watched = players;
  }

  // A spot off screen at the first draw, or one the panel doesn't land on (its layout failed), docks it for the
  // session with one warning.
  float(area) {
    const box = area.getBoundingClientRect();
    const screen = { width: box.width, height: box.height };
    const rect = this.root.getBoundingClientRect();
    const size = { width: rect.width, height: rect.height };
    const reach = sidebarReach(box);
    // A spot saved without the sidebar's reach counts from where the sidebar is now.
    if (cornerSides(this.spot.corner).side === "right" && !Number.isFinite(this.spot.reach) && reach !== null) {
      this.spot = { ...this.spot, reach };
    }
    this.watchSidebar();
    const wanted = followSidebar(this.spot, reach);
    if (size.width && !this.checked) {
      this.checked = true;
      if (!onScreen(boxAt(wanted, size, screen), screen)) {
        this.spot = null;
        this.warnOnce("the panel's saved position is off the screen; it is back beside the players list.");
        return;
      }
    }
    let spot = clampSpot(wanted, size, screen);
    this.setSpot(spot, area);
    if (!size.width) return; // not drawn yet (hidden): checked once it shows
    spot = this.inView(spot, size, screen, box, area);
    if (!samePlace(boxIn(this.root.getBoundingClientRect(), box), boxAt(spot, size, screen))) {
      this.spot = null;
      this.warnOnce("the panel didn't land where it was put; it is back beside the players list.");
    }
  }

  // Shifts the panel so an open flyout shows, without changing the saved spot.
  inView(spot, size, screen, box, area) {
    const parts = partsBox(this.root);
    if (!parts) return spot;
    const left = parts.left - box.left;
    const top = parts.top - box.top;
    const right = parts.right - box.left;
    const bottom = parts.bottom - box.top;
    const dx = left < 0 ? -left : Math.min(0, screen.width - right);
    const dy = top < 0 ? -top : Math.min(0, screen.height - bottom);
    if (!dx && !dy) return spot;
    const { side, edge } = cornerSides(spot.corner);
    const shifted = clampSpot({ corner: spot.corner, x: spot.x + (side === "left" ? dx : -dx),
      y: spot.y + (edge === "top" ? dy : -dy) }, size, screen);
    this.setSpot(shifted, area);
    return shifted;
  }

  // The flyouts' classes stay as they are while dragging, so they don't flip under the pointer.
  setSpot(spot, area, dragging = false) {
    const { side, edge } = cornerSides(spot.corner);
    const style = this.root.style;
    if (this.root.parentElement !== area) area.append(this.root);
    style.position = "absolute";
    style.zIndex = zIndexFor(this.layer, this.front);
    style.margin = "0";
    style.left = side === "left" ? `${spot.x}px` : "";
    style.right = side === "right" ? `${spot.x}px` : "";
    style.top = edge === "top" ? `${spot.y}px` : "";
    style.bottom = edge === "bottom" ? `${spot.y}px` : "";
    if (dragging) scaleTransform(this.root, `${side} ${edge}`);
    else this.mark(side === "right", edge === "top", `${side} ${edge}`);
  }

  /** Sets the flyouts' side and direction, and the Panel size's transform from the anchored corner. */
  mark(rightHalf, topHalf, origin) {
    const left = origin ? (this.menuSide === "auto" ? rightHalf : this.menuSide === "left") : false;
    this.root.classList.toggle(MENUS_LEFT_CLASS, left);
    this.root.classList.toggle(GROW_DOWN_CLASS, topHalf);
    scaleTransform(this.root, origin);
  }

  pressed(event) {
    if (!this.movable || event.button !== 0 || this.press) return;
    if (!this.dragsFrom(event.target)) return;
    this.press = { x: event.clientX, y: event.clientY, start: null, box: null, screen: null, scaled: null };
    document.addEventListener("pointermove", this.onMove);
    document.addEventListener("pointerup", this.onRelease);
    document.addEventListener("pointercancel", this.onRelease);
    // Ahead of Foundry's own wheel handler (on the window, bubbling), so the map never zooms while the panel is held.
    this.root.ownerDocument?.defaultView?.addEventListener("wheel", this.onWheel, { capture: true, passive: false });
  }

  // Lifted, the panel scales from the corner it would be anchored to if dropped here, so that corner stays put.
  wheel(event) {
    const press = this.press;
    if (!press) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!event.deltaY || !this.wheelScale) return;
    const step = this.wheelScale(event.deltaY < 0 ? 1 : -1);
    if (!step || !(step.from > 0)) return;
    press.scaled = step.to;
    if (!press.start) {
      this.place();
      return;
    }
    const ratio = step.to / step.from;
    const { side, edge } = cornerSides(spotOf(press.box, press.screen).corner);
    const width = press.box.width * ratio;
    const height = press.box.height * ratio;
    const dLeft = side === "right" ? press.box.width - width : 0;
    const dTop = edge === "bottom" ? press.box.height - height : 0;
    press.start = { ...press.start, left: press.start.left + dLeft, top: press.start.top + dTop, width, height };
    press.box = clampBox({ ...press.box, left: press.box.left + dLeft, top: press.box.top + dTop, width, height },
      press.screen);
    this.setSpot({ corner: "top-left", x: press.box.left, y: press.box.top }, press.area, true);
  }

  dragsFrom(target) {
    const handle = target?.closest?.(HANDLE);
    if (handle) return this.root.contains(handle) && !target.closest("button");
    const box = target?.closest?.(COMBAT_BOX);
    return Boolean(box) && this.root.contains(box) && !target.closest(NO_DRAG);
  }

  move(event) {
    const press = this.press;
    if (!press) return;
    const dx = event.clientX - press.x;
    const dy = event.clientY - press.y;
    if (!press.start) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      if (!this.lift()) return;
    }
    press.box = clampBox({ ...press.start, left: press.start.left + dx, top: press.start.top + dy }, press.screen);
    this.setSpot({ corner: "top-left", x: press.box.left, y: press.box.top }, press.area, true);
    this.dragSide(press.box, press.screen);
  }

  dragSide(box, screen) {
    const rightHalf = box.left + box.width / 2 >= screen.width / 2;
    const left = this.menuSide === "auto" ? rightHalf : this.menuSide === "left";
    this.root.classList.toggle(MENUS_LEFT_CLASS, left);
  }

  // A panel that doesn't land where it is lifted goes back beside the players list, so it can't vanish.
  lift() {
    const area = document.getElementById(INTERFACE_ID);
    if (!area) return this.cancel();
    const box = area.getBoundingClientRect();
    const start = boxIn(this.root.getBoundingClientRect(), box);
    const screen = { width: box.width, height: box.height };
    this.setSpot({ corner: "top-left", x: start.left, y: start.top }, area, true);
    if (!samePlace(boxIn(this.root.getBoundingClientRect(), box), start)) {
      this.warnOnce("the panel couldn't be moved here; it stays beside the players list.");
      this.spot = null;
      this.dockBeside(area);
      return this.cancel();
    }
    this.root.classList.add(DRAGGING_CLASS);
    Object.assign(this.press, { start, box: start, screen, area });
    return true;
  }

  /** Stops listening to the pointer; returns false, for lift(). */
  cancel() {
    this.press = null;
    document.removeEventListener("pointermove", this.onMove);
    document.removeEventListener("pointerup", this.onRelease);
    document.removeEventListener("pointercancel", this.onRelease);
    this.root.ownerDocument?.defaultView?.removeEventListener("wheel", this.onWheel, { capture: true });
    return false;
  }

  release() {
    const press = this.press;
    this.cancel();
    if (press?.scaled) this.scaleDone?.(press.scaled);
    if (!press?.start) {
      if (press?.scaled) swallowClick(); // the press only scaled: it doesn't also click what was under it
      return;
    }
    swallowClick();
    this.root.classList.remove(DRAGGING_CLASS);
    const spot = spotOf(press.box, press.screen);
    this.spot = { corner: spot.corner, x: Math.round(spot.x), y: Math.round(spot.y) };
    const reach = sidebarReach(press.area.getBoundingClientRect());
    if (cornerSides(spot.corner).side === "right" && reach !== null) this.spot.reach = Math.round(reach);
    this.checked = true;
    this.place();
    if (this.spot) saveSpot(this.spot);
  }
}

// The browser still sends a click to what was pressed after a drag: swallowed, so a drag never presses anything.
function swallowClick() {
  const swallow = (event) => {
    event.stopPropagation();
    event.preventDefault();
  };
  document.addEventListener("click", swallow, { capture: true, once: true });
  setTimeout(() => document.removeEventListener("click", swallow, { capture: true }), 0);
}

/**
 * Sets the Panel size's transform (with Foundry's UI scale when floating) from the anchored corner.
 * @param {HTMLElement} root the panel, with `--rollbox-scale` set
 * @param {string} [origin] "left top" and so on when floating; none in the fallback dock
 * @returns {void}
 */
export function scaleTransform(root, origin) {
  const factor = factorOf(root);
  const floating = Boolean(origin);
  root.dataset.rollboxOrigin = origin ?? "";
  if (floating) {
    root.style.transformOrigin = origin;
    root.style.transform = `scale(calc(var(--ui-scale, 1) * ${factor}))`;
    return;
  }
  root.style.transformOrigin = factor === 1 ? "" : "left bottom";
  root.style.transform = factor === 1 ? "" : `scale(${factor})`;
}

/**
 * Sets the transform again after a size change, from the same corner.
 * @param {HTMLElement} root
 * @returns {void}
 */
export function rescale(root) {
  scaleTransform(root, root.dataset.rollboxOrigin || undefined);
}

async function saveSpot(spot) {
  try {
    await game.settings.set(MODULE_ID, "rollboxOffset", spot);
  } catch (error) {
    warn("couldn't save the panel's position.", error);
  }
}

/**
 * Saves an empty spot, so the panel docks beside the players list; a failure is logged.
 * @returns {Promise<void>}
 */
export async function forgetSpot() {
  try {
    await game.settings.set(MODULE_ID, "rollboxOffset", {});
  } catch (error) {
    warn("couldn't reset the panel's position.", error);
  }
}
