/** Who can see whom on the board and how far apart they are; what can't be read counts as in sight. See docs/combat.md. */
import { warn } from "../utils.js";
import { edgeDistance, feetOf, tokenCentre } from "../shared/index.js";

/**
 * Returns a token's centre where it was last moved to.
 * @param {Token} token
 * @returns {{x: number, y: number}|null}
 */
export function centreOf(token) {
  const centre = tokenCentre(token);
  return centre ? { x: centre.x, y: centre.y } : null;
}

/**
 * Measures two tokens edge to edge in metres; an unknown unit counts as metres.
 * @param {Token} a
 * @param {Token} b
 * @returns {number|null}
 */
export function metresBetween(a, b) {
  const measured = edgeDistance(a, b);
  if (!measured) return null;
  return Number.isFinite(measured.metres) ? measured.metres : measured.distance;
}

/**
 * Measures two tokens edge to edge in feet; an unknown unit counts as feet.
 * @param {Token} a
 * @param {Token} b
 * @returns {number|null}
 */
export function feetBetween(a, b) {
  const measured = edgeDistance(a, b);
  if (!measured) return null;
  return feetOf(measured) ?? measured.distance;
}

/**
 * Tells whether a sight-blocking wall (closed doors included) stands between two points; false when it can't be asked.
 * @param {{x: number, y: number}} a
 * @param {{x: number, y: number}} b
 * @returns {boolean}
 */
export function wallBetween(a, b) {
  const backend = globalThis.CONFIG?.Canvas?.polygonBackends?.sight;
  if (typeof backend?.testCollision !== "function") return false;
  try {
    return Boolean(backend.testCollision(a, b, { type: "sight", mode: "any" }));
  } catch (error) {
    warn("couldn't test walls for sight; counting everyone in range as in sight.", error);
    return false;
  }
}

/**
 * Tells whether no sight-blocking wall stands between two tokens' centres.
 * @param {Token} a
 * @param {Token} b
 * @returns {boolean}
 */
export function inSight(a, b) {
  const from = centreOf(a);
  const to = centreOf(b);
  return Boolean(from && to) && !wallBetween(from, to);
}

/**
 * Returns the character's token on the viewed scene, the first if several.
 * @param {Actor} actor
 * @returns {Token|null}
 */
export function tokenOf(actor) {
  const own = actor?.token?.object ?? null;
  if (own) return own;
  try {
    return actor?.getActiveTokens?.()[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Returns the character's token on a scene the Keeper may not be viewing: its placeable when drawn, else its document.
 * @param {Actor} actor
 * @param {Scene|null} scene null for the viewed scene
 * @returns {Token|TokenDocument|null}
 */
export function tokenOn(actor, scene) {
  if (!scene || globalThis.canvas?.scene?.id === scene.id) return tokenOf(actor);
  try {
    const own = actor?.token;
    const doc = own ? (own.parent === scene ? own : null)
      : (actor?.getDependentTokens?.({ scenes: scene }) ?? [])[0] ?? null;
    return doc ? doc.object ?? doc : null;
  } catch {
    return null;
  }
}
