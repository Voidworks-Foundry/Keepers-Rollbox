/**
 * The panel's place on screen as plain arithmetic, so it can be tested without a browser: keeping a box on screen,
 * the screen quarter a box is in, a box's offset from that quarter's corner and back, and reading a saved spot.
 * Boxes are `{left, top, width, height}` and areas `{width, height}`, in screen pixels inside Foundry's `#interface`.
 * A spot `{corner, x, y}` is where the Keeper dropped the panel: the corner of the screen quarter it was dropped in
 * (`"top-left"`, `"bottom-right"`…) and the distance from that corner to the same corner of the card. Anchoring to
 * the near corner keeps the panel near the same edges when the window is resized, and lets a taller card grow away
 * from the edge. The DOM side is position.js.
 */

const CORNERS = Object.freeze(["top-left", "top-right", "bottom-left", "bottom-right"]);

/** Within this many pixels, a box is where it was put (rounding in the browser's layout). */
const TOLERANCE = 2;

/**
 * Which side of the screen and which edge a corner is on.
 * @param {string} corner one of "top-left", "top-right", "bottom-left", "bottom-right"
 * @returns {{side: "left"|"right", edge: "top"|"bottom"}}
 */
export function cornerSides(corner) {
  const [edge, side] = (CORNERS.includes(corner) ? corner : "bottom-left").split("-");
  return { side, edge };
}

/**
 * A saved spot, or null when it can't be read: a known corner and two finite numbers, neither below 0 (a spot
 * below 0 is off the screen).
 */
export function normalSpot(value) {
  if (!value || typeof value !== "object" || !CORNERS.includes(value.corner)) return null;
  if (typeof value.x !== "number" || typeof value.y !== "number") return null;
  if (!Number.isFinite(value.x) || !Number.isFinite(value.y) || value.x < 0 || value.y < 0) return null;
  return { corner: value.corner, x: value.x, y: value.y };
}

/** A number kept between min and max; a box larger than the area sits at its start. */
const between = (value, min, max) => Math.max(min, Math.min(value, max));

/**
 * The box moved the least so it is wholly inside the area. A box wider or taller than the area keeps its left or
 * top edge on screen.
 * @param {{left: number, top: number, width: number, height: number}} box
 * @param {{width: number, height: number}} area
 */
export function clampBox(box, area) {
  return {
    ...box,
    left: between(box.left, 0, Math.max(0, area.width - box.width)),
    top: between(box.top, 0, Math.max(0, area.height - box.height))
  };
}

/** Whether the box is wholly inside the area. */
export function onScreen(box, area) {
  return box.left >= -TOLERANCE && box.top >= -TOLERANCE
    && box.left + box.width <= area.width + TOLERANCE && box.top + box.height <= area.height + TOLERANCE;
}

/** Whether two boxes are in the same place (their top-left corners, within the tolerance). */
export function samePlace(a, b) {
  return Math.abs(a.left - b.left) <= TOLERANCE && Math.abs(a.top - b.top) <= TOLERANCE;
}

/** The corner of the screen quarter the box's centre is in. */
export function nearestCorner(box, area) {
  const edge = box.top + box.height / 2 < area.height / 2 ? "top" : "bottom";
  const side = box.left + box.width / 2 < area.width / 2 ? "left" : "right";
  return `${edge}-${side}`;
}

/** The spot of a box: its quarter's corner and its distance from it. */
export function spotOf(box, area) {
  const corner = nearestCorner(box, area);
  const { side, edge } = cornerSides(corner);
  return {
    corner,
    x: side === "left" ? box.left : area.width - box.left - box.width,
    y: edge === "top" ? box.top : area.height - box.top - box.height
  };
}

/** The box of this size at a spot (the reverse of spotOf). */
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
 * The spot moved the least so a box of this size at it stays on screen (after a smaller window, say), still
 * measured from the same corner.
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
