/**
 * Where the Keeper's panel sits, and moving it by its card header (Void, 2026-11-15). By default, and whenever
 * "Allow moving the panel" is off, it is docked in Foundry's left column just before the players list, exactly as in
 * 0.1.0. With moving allowed, dragging the card header moves it anywhere on screen, and it stays where it is dropped:
 * then it is in Foundry's `#interface` (the element holding Foundry's UI columns, which Foundry never draws again and
 * which shrinks to leave room for the camera dock), positioned from the corner of the screen quarter it was dropped
 * in. Its floating position, size and stacking are set inline here, so they never depend on a stylesheet having
 * loaded; after placing it, Rollbox checks it is where it was put, and docks it otherwise. Classes on the panel say
 * which side the menus open to and whether they grow down (position.css). Only Rollbox's own element moves;
 * Foundry's are never moved or restyled. The arithmetic is placement.js.
 */
import { MODULE_ID, warn } from "../utils.js";
import { boxAt, clampBox, clampSpot, cornerSides, normalSpot, onScreen, samePlace, spotOf } from "./placement.js";

/** Foundry's players list (build 368: `aside#players` in `#ui-left-column-1`): the docked panel goes just before it. */
const PLAYERS_ID = "players";
/** Foundry's UI container (build 368 `templates/views/game.hbs`, `position: relative`): the moved panel's parent. */
const INTERFACE_ID = "interface";

/** "Menus open to the" (setting `rollboxMenuSide`): key → label. */
export const MENU_SIDES = Object.freeze({ auto: "Automatic", right: "Right", left: "Left" });
export const DEFAULT_MENU_SIDE = "auto";

/** On the panel: its menus open to the left of the card, or grow down from the card's top (position.css). */
const MENUS_LEFT_CLASS = "rollbox-menus-left";
const GROW_DOWN_CLASS = "rollbox-grow-down";
/** On the panel while moving is allowed (the header shows a hand), and while it is dragged. */
const MOVABLE_CLASS = "rollbox-movable";
const DRAGGING_CLASS = "rollbox-dragging";

/**
 * What starts a drag: the header row of the card in the card's place (the mini sheet's, or the names card's), and of
 * either side's mini sheet in the Opposed view, which takes the card's place (Void, 2026-11-15).
 */
const HANDLE = [".rollbox-card-slot > .rollbox-card > .rollbox-sheet-head",
  ".rollbox-card-slot > .rollbox-card > .rollbox-names-head", ".rollbox-stage > .rollbox-sheet > .rollbox-sheet-head"].join(", ");
/** The parts that open beside or instead of the card: the buttons with the flyout, and the Opposed view. */
const MENU_PARTS = ".rollbox-side, .rollbox-stage";
/** A press that moves less than this (in pixels) is a click, not a drag. */
const DRAG_THRESHOLD = 4;
/** Foundry's application level (build 368 `--z-index-app`, its UI columns'): the moved panel's stacking level. */
const Z_INDEX = "var(--z-index-app, 30)";

/** The inline styles a moved panel gets, all cleared when it docks. */
const FLOATING_STYLES = ["position", "zIndex", "margin", "left", "right", "top", "bottom"];

/** The panel's size factor (`--rollbox-scale`, set by index.js from Panel size). */
const factorOf = (root) => Number(root.style.getPropertyValue("--rollbox-scale")) || 1;

/** A box `{left, top, width, height}` relative to the area's top-left corner. */
function boxIn(rect, area) {
  return { left: rect.left - area.left, top: rect.top - area.top, width: rect.width, height: rect.height };
}

/** The panel's place: docked or at a dropped spot, which side its menus open to, and dragging it by the header. */
export class PanelPlace {
  /**
   * @param {HTMLElement} root the panel
   * @param {{movable?: boolean, spot?: object, menuSide?: string}} [saved] the settings `rollboxMovable`,
   *   `rollboxOffset` and `rollboxMenuSide`. A spot that can't be read is ignored (docked).
   */
  constructor(root, { movable = false, spot, menuSide } = {}) {
    this.root = root;
    this.movable = movable === true;
    this.spot = this.movable ? normalSpot(spot) : null;
    this.menuSide = Object.hasOwn(MENU_SIDES, menuSide) ? menuSide : DEFAULT_MENU_SIDE;
    this.press = null;
    this.checked = false; // whether the saved spot has been checked against the screen
    this.warned = new Set();
    this.onMove = (event) => this.move(event);
    this.onRelease = () => this.release();
    root.addEventListener("pointerdown", (event) => this.pressed(event));
  }

  /** One warning of each kind per session. */
  warnOnce(text) {
    if (this.warned.has(text)) return;
    this.warned.add(text);
    warn(text);
  }

  /**
   * "Allow moving the panel" switched. Off: the dropped spot is forgotten and the panel goes back above the players
   * list. On: it stays docked until it is dragged.
   */
  setMovable(movable) {
    this.movable = movable === true;
    this.spot = null;
    this.place();
  }

  /** Reset position: back above the players list; moving stays as it is. */
  reset() {
    this.spot = null;
    this.place();
  }

  /** "Menus open to the" changed. */
  setMenuSide(menuSide) {
    this.menuSide = Object.hasOwn(MENU_SIDES, menuSide) ? menuSide : DEFAULT_MENU_SIDE;
    this.place();
  }

  /**
   * Put the panel where it belongs now. Also the renderPlayers hook's work (in case Foundry rebuilt the column) and
   * the window's resize: a moved panel is kept on screen, its saved spot left as it is.
   * @returns {boolean} false when it can't show (docked, with no players list to sit on).
   */
  place() {
    this.root.classList.toggle(MOVABLE_CLASS, this.movable);
    if (this.press?.start) return true; // being dragged: the pointer decides
    const area = document.getElementById(INTERFACE_ID);
    if (!this.spot || !area) return this.dock();
    this.float(area);
    if (this.spot) return true;
    return this.dock(); // the spot was off screen, or the panel didn't land on it
  }

  /** Docked in the left column, just before `#players`. Not inside it: Foundry replaces its contents on each render. */
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

  /**
   * At the saved spot in `#interface`, moved only as far as it takes to stay on screen (a smaller window). A spot
   * off screen when the panel is first drawn is ignored, and so is a spot the panel doesn't land on (its layout
   * failed): both dock it for the rest of the session, with one warning.
   */
  float(area) {
    const box = area.getBoundingClientRect();
    const screen = { width: box.width, height: box.height };
    const rect = this.root.getBoundingClientRect();
    const size = { width: rect.width, height: rect.height };
    if (size.width && !this.checked) {
      this.checked = true;
      if (!onScreen(boxAt(this.spot, size, screen), screen)) {
        this.spot = null;
        this.warnOnce("the panel's saved position is off the screen; it is back above the players list.");
        return;
      }
    }
    let spot = clampSpot(this.spot, size, screen);
    this.setSpot(spot, area);
    if (!size.width) return; // not drawn yet (hidden): checked once it shows
    spot = this.inView(spot, size, screen, box, area);
    if (!samePlace(boxIn(this.root.getBoundingClientRect(), box), boxAt(spot, size, screen))) {
      this.spot = null;
      this.warnOnce("the panel didn't land where it was put; it is back above the players list.");
    }
  }

  /**
   * An open menu kept in view (Void, 2026-11-15): if the buttons, the flyout or the Opposed view run off the screen,
   * the panel is shifted just far enough for them to show, the card staying on screen. Only while they would: the
   * saved spot isn't changed, so the panel goes back when the menu closes.
   * @returns {object} the spot the panel is shown at
   */
  inView(spot, size, screen, box, area) {
    const parts = [this.root, ...this.root.querySelectorAll(MENU_PARTS)]
      .map((node) => node.getBoundingClientRect()).filter((rect) => rect.width && rect.height);
    const left = Math.min(...parts.map((r) => r.left)) - box.left;
    const top = Math.min(...parts.map((r) => r.top)) - box.top;
    const right = Math.max(...parts.map((r) => r.right)) - box.left;
    const bottom = Math.max(...parts.map((r) => r.bottom)) - box.top;
    const dx = left < 0 ? -left : Math.min(0, screen.width - right);
    const dy = top < 0 ? -top : Math.min(0, screen.height - bottom);
    if (!dx && !dy) return spot;
    const { side, edge } = cornerSides(spot.corner);
    const shifted = clampSpot({ corner: spot.corner, x: spot.x + (side === "left" ? dx : -dx),
      y: spot.y + (edge === "top" ? dy : -dy) }, size, screen);
    this.setSpot(shifted, area);
    return shifted;
  }

  /**
   * In `#interface` at a spot: position, stacking, scale from that corner, and the menus' classes (kept as they are
   * while dragging, so the menus don't flip under the pointer).
   */
  setSpot(spot, area, dragging = false) {
    const { side, edge } = cornerSides(spot.corner);
    const style = this.root.style;
    if (this.root.parentElement !== area) area.append(this.root);
    style.position = "absolute";
    style.zIndex = Z_INDEX;
    style.margin = "0";
    style.left = side === "left" ? `${spot.x}px` : "";
    style.right = side === "right" ? `${spot.x}px` : "";
    style.top = edge === "top" ? `${spot.y}px` : "";
    style.bottom = edge === "bottom" ? `${spot.y}px` : "";
    if (dragging) scaleTransform(this.root, `${side} ${edge}`);
    else this.mark(side === "right", edge === "top", `${side} ${edge}`);
  }

  /**
   * The menus' side and direction, and the Panel size's transform. Docked, the menus open to the right (the panel
   * is at the screen's left edge) and the panel is scaled from its bottom-left corner, with no transform at 100%, so
   * it is exactly as before; Foundry's UI scale comes from the column. Moved, it is scaled by both from its anchored
   * corner, so that corner stays put. "Automatic" opens the menus towards the middle of the screen.
   * @param {boolean} rightHalf the panel is on the right half of the screen
   * @param {boolean} topHalf the panel is on the top half (its menus line up with the card's top and grow down)
   * @param {string} [origin] the anchored corner, e.g. "right top"; none when docked
   */
  mark(rightHalf, topHalf, origin) {
    const left = origin ? (this.menuSide === "auto" ? rightHalf : this.menuSide === "left") : false;
    this.root.classList.toggle(MENUS_LEFT_CLASS, left);
    this.root.classList.toggle(GROW_DOWN_CLASS, topHalf);
    scaleTransform(this.root, origin);
  }

  /** pointerdown on the panel: with moving allowed, the main button on the card header, never on the open-sheet button. */
  pressed(event) {
    if (!this.movable || event.button !== 0 || this.press) return;
    const target = event.target;
    const handle = target?.closest?.(HANDLE);
    if (!handle || !this.root.contains(handle) || target.closest("button")) return;
    this.press = { x: event.clientX, y: event.clientY, start: null, box: null, screen: null };
    document.addEventListener("pointermove", this.onMove);
    document.addEventListener("pointerup", this.onRelease);
    document.addEventListener("pointercancel", this.onRelease);
  }

  /** pointermove while pressed: past the threshold the panel follows the pointer, kept on screen. */
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
  }

  /**
   * The drag starts: the panel moves into `#interface` exactly where it is on screen. If it doesn't land there (its
   * layout failed), the drag is called off and the panel stays docked, so it can't vanish.
   */
  lift() {
    const area = document.getElementById(INTERFACE_ID);
    if (!area) return this.cancel();
    const box = area.getBoundingClientRect();
    const start = boxIn(this.root.getBoundingClientRect(), box);
    const screen = { width: box.width, height: box.height };
    this.setSpot({ corner: "top-left", x: start.left, y: start.top }, area, true);
    if (!samePlace(boxIn(this.root.getBoundingClientRect(), box), start)) {
      this.warnOnce("the panel couldn't be moved here; it stays above the players list.");
      this.spot = null;
      this.dock();
      return this.cancel();
    }
    this.root.classList.add(DRAGGING_CLASS);
    Object.assign(this.press, { start, box: start, screen, area });
    return true;
  }

  /** Stop listening to the pointer. Returns false, for lift(). */
  cancel() {
    this.press = null;
    document.removeEventListener("pointermove", this.onMove);
    document.removeEventListener("pointerup", this.onRelease);
    document.removeEventListener("pointercancel", this.onRelease);
    return false;
  }

  /**
   * pointerup (or cancel): a press without movement was a click and changes nothing. After a drag the panel stays
   * where it was dropped: its spot is measured from the corner of the quarter it is in (it doesn't move), so the
   * menus' side and direction follow, and it is saved, so it is there after a reload.
   */
  release() {
    const press = this.press;
    this.cancel();
    if (!press?.start) return;
    this.root.classList.remove(DRAGGING_CLASS);
    const spot = spotOf(press.box, press.screen);
    this.spot = { corner: spot.corner, x: Math.round(spot.x), y: Math.round(spot.y) };
    this.checked = true;
    this.place();
    if (this.spot) saveSpot(this.spot);
  }
}

/**
 * The Panel size's transform (Foundry's UI scale too when moved), from the anchored corner.
 * @param {HTMLElement} root the panel, with `--rollbox-scale` set
 * @param {string} [origin] "left top" and so on when moved; none when docked
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

/** The Panel size changed: the transform again, from the same corner. */
export function rescale(root) {
  scaleTransform(root, root.dataset.rollboxOrigin || undefined);
}

/** Save a dropped spot; a failure keeps the panel where it is until a reload. */
async function saveSpot(spot) {
  try {
    await game.settings.set(MODULE_ID, "rollboxOffset", spot);
  } catch (error) {
    warn("couldn't save the panel's position.", error);
  }
}

/** Forget the dropped spot (moving was turned off); a failure is logged. */
export async function forgetSpot() {
  try {
    await game.settings.set(MODULE_ID, "rollboxOffset", {});
  } catch (error) {
    warn("couldn't reset the panel's position.", error);
  }
}
