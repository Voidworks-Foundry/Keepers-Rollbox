/** The arithmetic of placing the panel: boxes, screen corners and saved spots, without the DOM. See docs/panel.md. */

const CORNERS = Object.freeze(["top-left", "top-right", "bottom-left", "bottom-right"]);

// The browser's layout rounds, so within this many pixels a box is where it was put.
const TOLERANCE = 2;

/**
 * Returns which side of the screen and which edge a corner is on; an unknown corner reads as bottom-left.
 * @param {string} corner
 * @returns {{side: "left"|"right", edge: "top"|"bottom"}}
 */
export function cornerSides(corner) {
  const [edge, side] = (CORNERS.includes(corner) ? corner : "bottom-left").split("-");
  return { side, edge };
}

/**
 * Returns a saved spot as a clean copy: a known corner and two finite numbers, neither below 0.
 * @param {*} value
 * @returns {{corner: string, x: number, y: number, reach?: number}|null}
 */
export function normalSpot(value) {
  if (!value || typeof value !== "object" || !CORNERS.includes(value.corner)) return null;
  if (typeof value.x !== "number" || typeof value.y !== "number") return null;
  if (!Number.isFinite(value.x) || !Number.isFinite(value.y) || value.x < 0 || value.y < 0) return null;
  const spot = { corner: value.corner, x: value.x, y: value.y };
  if (Number.isFinite(value.reach) && value.reach >= 0) spot.reach = value.reach;
  return spot;
}

/**
 * Moves a right-side spot by how much further the sidebar reaches now than when it was dropped.
 * @param {{corner: string, x: number, y: number, reach?: number}} spot
 * @param {number|null} reach the sidebar's reach now, or null when it can't be measured
 * @returns {object} the spot, unchanged on the left side or without a reach
 */
export function followSidebar(spot, reach) {
  if (cornerSides(spot.corner).side !== "right" || !Number.isFinite(spot.reach) || !Number.isFinite(reach)) return spot;
  return { ...spot, x: Math.max(0, spot.x + reach - spot.reach) };
}

const between = (value, min, max) => Math.max(min, Math.min(value, max));

/**
 * Returns the box moved the least to be inside the area; a larger box keeps its top-left on screen.
 * @param {{left: number, top: number, width: number, height: number}} box
 * @param {{width: number, height: number}} area
 * @returns {object}
 */
export function clampBox(box, area) {
  return {
    ...box,
    left: between(box.left, 0, Math.max(0, area.width - box.width)),
    top: between(box.top, 0, Math.max(0, area.height - box.height))
  };
}

/**
 * Returns whether the box is wholly inside the area.
 * @param {object} box
 * @param {object} area
 * @returns {boolean}
 */
export function onScreen(box, area) {
  return box.left >= -TOLERANCE && box.top >= -TOLERANCE
    && box.left + box.width <= area.width + TOLERANCE && box.top + box.height <= area.height + TOLERANCE;
}

/**
 * Returns whether two boxes' top-left corners are in the same place.
 * @param {object} a
 * @param {object} b
 * @returns {boolean}
 */
export function samePlace(a, b) {
  return Math.abs(a.left - b.left) <= TOLERANCE && Math.abs(a.top - b.top) <= TOLERANCE;
}

/**
 * Returns the corner of the screen quarter the box's centre is in.
 * @param {object} box
 * @param {object} area
 * @returns {string}
 */
export function nearestCorner(box, area) {
  const edge = box.top + box.height / 2 < area.height / 2 ? "top" : "bottom";
  const side = box.left + box.width / 2 < area.width / 2 ? "left" : "right";
  return `${edge}-${side}`;
}

/**
 * Returns a box's spot: its quarter's corner and its distance from it.
 * @param {object} box
 * @param {object} area
 * @returns {{corner: string, x: number, y: number}}
 */
export function spotOf(box, area) {
  const corner = nearestCorner(box, area);
  const { side, edge } = cornerSides(corner);
  return {
    corner,
    x: side === "left" ? box.left : area.width - box.left - box.width,
    y: edge === "top" ? box.top : area.height - box.top - box.height
  };
}

/**
 * Returns the box of this size at a spot (the reverse of spotOf).
 * @param {object} spot
 * @param {{width: number, height: number}} size
 * @param {object} area
 * @returns {object}
 */
export function boxAt(spot, size, area) {
  const { side, edge } = cornerSides(spot.corner);
  return {
    left: side === "left" ? spot.x : area.width - spot.x - size.width,
    top: edge === "top" ? spot.y : area.height - spot.y - size.height,
    width: size.width,
    height: size.height
  };
}

/**
 * Returns the spot moved the least so a box of this size at it stays on screen, from the same corner.
 * @param {object} spot
 * @param {object} size
 * @param {object} area
 * @returns {object}
 */
export function clampSpot(spot, size, area) {
  const box = clampBox(boxAt(spot, size, area), area);
  const { side, edge } = cornerSides(spot.corner);
  return {
    corner: spot.corner,
    x: side === "left" ? box.left : area.width - box.left - box.width,
    y: edge === "top" ? box.top : area.height - box.top - box.height
  };
}

/**
 * Returns the default place beside Foundry's players list, as far from it as the list is from the bottom.
 * @param {{left: number, right: number, bottom: number}} list the players list's screen rectangle
 * @param {{left: number, bottom: number}} area `#interface`'s screen rectangle
 * @returns {{left: number, bottom: number}}
 */
export function besideList(list, area) {
  const gap = Math.max(0, area.bottom - list.bottom);
  return { left: list.right - area.left + gap, bottom: gap };
}
