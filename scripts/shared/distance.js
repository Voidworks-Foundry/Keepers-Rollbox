/** The one distance Rollbox measures between two tokens, edge to edge. See docs/shared.md. */
import { metresPerUnit } from "./rules.js";

const FOOT_METRES = 0.3048;

/**
 * Returns where a token (placeable or document) stands, as a canvas point, or null.
 * @param {Token|TokenDocument} token
 * @returns {{x: number, y: number}|null}
 */
export function tokenCentre(token) {
  const document = token?.document ?? (token?.documentName === "Token" ? token : token?.object?.document);
  try {
    // Foundry v14: during a move's animation the document's x/y and Token#center still give the old place.
    const stored = document?._source;
    if (typeof document?.getCenterPoint === "function" && Number.isFinite(stored?.x) && Number.isFinite(stored?.y)) {
      const centre = document.getCenterPoint({ x: stored.x, y: stored.y });
      if (Number.isFinite(centre?.x) && Number.isFinite(centre?.y)) return centre;
    }
  } catch {
  }
  const centre = token?.center ?? token?.object?.center;
  return Number.isFinite(centre?.x) && Number.isFinite(centre?.y) ? centre : null;
}

function widthOf(token, gridSize) {
  const own = Number(token?.w ?? token?.object?.w);
  if (Number.isFinite(own) && own > 0) return own;
  const spaces = Number(token?.document?.width ?? token?.width);
  return Number.isFinite(spaces) && spaces > 0 ? spaces * gridSize : 0;
}

/**
 * Measures the distance between two tokens, edge to edge, each counted as a circle.
 * @param {Token} from
 * @param {Token} to
 * @returns {{distance: number, units: string, metres: number|null}|null} `distance` in the scene's units; `metres`
 *   null for an unknown unit; null when a token or the grid can't be read
 */
export function edgeDistance(from, to) {
  try {
    const grid = globalThis.canvas?.grid;
    const a = tokenCentre(from);
    const b = tokenCentre(to);
    const size = Number(grid?.size);
    const perSpace = Number(grid?.distance);
    if (!a || !b || !(size > 0) || !(perSpace > 0)) return null;
    const pixels = Math.max(0, Math.hypot(b.x - a.x, b.y - a.y) - widthOf(from, size) / 2 - widthOf(to, size) / 2);
    const distance = (pixels / size) * perSpace;
    const units = String(grid.units ?? globalThis.canvas?.scene?.grid?.units ?? "").trim();
    const perUnit = metresPerUnit(units);
    return { distance, units, metres: perUnit === null ? null : distance * perUnit };
  } catch {
    return null;
  }
}

/**
 * Returns a measured distance in feet.
 * @param {{metres: number|null}|null} measured
 * @returns {number|null} null when its unit is unknown
 */
export const feetOf = (measured) => (Number.isFinite(measured?.metres) ? measured.metres / FOOT_METRES : null);

/**
 * Writes a measured distance as text ("4.5 ft", "12 ft"), with one decimal under 10.
 * @param {{distance: number, units: string}|null} measured
 * @returns {string|null}
 */
export function distanceText(measured) {
  if (!Number.isFinite(measured?.distance)) return null;
  const d = measured.distance;
  const shown = d < 10 ? Math.round(d * 10) / 10 : Math.round(d);
  return measured.units ? `${shown} ${measured.units}` : String(shown);
}
