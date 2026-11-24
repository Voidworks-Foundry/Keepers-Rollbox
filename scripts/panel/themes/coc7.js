/** CoC7's images for the Art Deco theme, read from the installed system at runtime. See docs/panel.md. */
import { COC7_ID } from "../../utils.js";

// CoC7 8.15: CSS variable → the image's path inside CoC7's `assets/`.
const COC7_IMAGES = Object.freeze({
  "--rollbox-coc7-page": "assets/art/page-dark.webp",
  "--rollbox-coc7-line-red": "assets/images/sheet-v3/line-red.webp",
  "--rollbox-coc7-ornament-top": "assets/images/sheet-v3/ornament-top.webp",
  "--rollbox-coc7-ornament-green": "assets/images/sheet-v3/line-ornament-green.webp",
  "--rollbox-coc7-tentacles": "assets/images/sheet-v3/tentacles.webp",
  "--rollbox-coc7-ribbon-red": "assets/images/sheet-v3/ribbon-red.webp",
  "--rollbox-coc7-ribbon-green": "assets/images/sheet-v3/ribbon-green.webp",
  "--rollbox-coc7-ribbon-yellow": "assets/images/sheet-v3/ribbon-yellow.webp",
  "--rollbox-coc7-ribbon-blue": "assets/images/sheet-v3/ribbon-blue.webp"
});

/**
 * Returns the active game system's id.
 * @returns {string|undefined} undefined before the game has one
 */
export const systemId = () => globalThis.game?.system?.id;

// Foundry's route prefix when the server has one (`foundry.utils.getRoute`); a plain root path without it.
function systemUrl(path) {
  const relative = `systems/${COC7_ID}/${path}`;
  try {
    const route = globalThis.foundry?.utils?.getRoute?.(relative);
    if (typeof route === "string" && route) return route;
  } catch {
    // Fall through to the plain path.
  }
  return `/${relative}`;
}

/**
 * Puts each CoC7 image's URL on the element as its CSS variable.
 * @param {HTMLElement} root
 * @returns {void}
 */
export function setImageVariables(root) {
  for (const [name, path] of Object.entries(COC7_IMAGES)) root.style.setProperty(name, `url("${systemUrl(path)}")`);
}

/**
 * Checks every image with a HEAD request; a failure counts as missing, and without `fetch` all count as there.
 * @returns {Promise<boolean>}
 */
export async function checkImages() {
  if (typeof globalThis.fetch !== "function") return true;
  const found = await Promise.all(Object.values(COC7_IMAGES).map(async (path) => {
    try {
      const response = await globalThis.fetch(systemUrl(path), { method: "HEAD" });
      return response?.ok === true;
    } catch {
      return false;
    }
  }));
  return found.every(Boolean);
}
