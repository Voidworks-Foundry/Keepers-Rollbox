/** The panel's look (theme, colour, transparency, size), applied to every element that wears it. See docs/panel.md. */
import { MODULE_ID, getSetting, warn } from "../utils.js";
import { DEFAULT_COLOR, DEFAULT_THEME, hexColor, normalTheme, shownColor, THEME_CLASSES, usableTheme, usesImages }
  from "./theme.js";
import { checkImages, setImageVariables, systemId } from "./themes/coc7.js";
import { rescale } from "./position.js";

/** Panel transparency in percent; 0 is solid. */
export const TRANSPARENCY = Object.freeze({ min: 0, max: 70, step: 5, default: 25 });
const OPACITY_VARIABLE = "--rollbox-opacity";

const COLOR_VARIABLE = "--rollbox-color";
const LIGHT_THEME_CLASS = "rollbox-theme-light";
const INTERFACE_ID = "interface";

/** Panel size in percent. */
export const SCALE = Object.freeze({ min: 80, max: 250, step: 10, default: 100 });
const SCALE_VARIABLE = "--rollbox-scale";

/** Every element wearing the look, each { root, theme, color }. */
const targets = new Set();
/** The panel's own target: the one Panel size applies to. */
let scaled = null;
let imagesCheck = null;
let imagesFound = true;
let schemeWatcher = null;

/**
 * Reads a saved setting, or returns the fallback when it can't be read.
 * @param {string} key
 * @param {*} fallback
 * @returns {*}
 */
export function readSetting(key, fallback) {
  try {
    return getSetting(key);
  } catch {
    return fallback;
  }
}

/**
 * Forgets every element that wears the look, and the images check.
 * @returns {void}
 */
export function resetAppearance() {
  targets.clear();
  scaled = null;
  imagesCheck = null;
  imagesFound = true;
  schemeWatcher?.disconnect();
  schemeWatcher = null;
}

/**
 * Gives the panel's root the saved look and size, and keeps it in step with later changes.
 * @param {HTMLElement} root
 * @returns {void}
 */
export function stylePanel(root) {
  const target = wear(root);
  scaled = target;
  setScale(root, readSetting("rollboxScale", SCALE.default));
}

/**
 * Gives an element outside the panel the panel's look, kept in step with later changes.
 * @param {HTMLElement} root
 * @returns {boolean} false without an element
 */
export function followTheme(root) {
  if (!root?.classList) return false;
  wear(root);
  return true;
}

function wear(root) {
  const target = { root, theme: DEFAULT_THEME, color: DEFAULT_COLOR };
  setOpacity(root, readSetting("rollboxTransparency", TRANSPARENCY.default));
  setTheme(target, readSetting("rollboxTheme", DEFAULT_THEME), readSetting("rollboxColor", DEFAULT_COLOR));
  targets.add(target);
  return target;
}

// Only the backgrounds' alpha changes, never `opacity`, so text stays fully readable.
function setOpacity(root, transparency) {
  const n = Number(transparency);
  const percent = Number.isFinite(n) ? Math.max(TRANSPARENCY.min, Math.min(TRANSPARENCY.max, n)) : TRANSPARENCY.default;
  root.style.setProperty(OPACITY_VARIABLE, `${100 - percent}%`);
}

/**
 * Applies a new Panel transparency at once.
 * @param {number} transparency percent
 * @returns {void}
 */
export function applyTransparency(transparency) {
  for (const target of targets) setOpacity(target.root, transparency);
}

function setTheme(target, theme, color) {
  target.theme = normalTheme(theme);
  target.color = hexColor(color);
  const shown = usableTheme(target.theme, { system: systemId(), imagesFound });
  const { root } = target;
  for (const [key, className] of Object.entries(THEME_CLASSES)) root.classList.toggle(className, key === shown);
  const scheme = foundryScheme();
  root.classList.toggle(LIGHT_THEME_CLASS, shown === "foundry" && scheme === "light");
  root.style.setProperty(COLOR_VARIABLE, shownColor(target.color, scheme));
  if (usesImages(shown)) {
    setImageVariables(root);
    checkImagesOnce();
  }
  watchScheme();
}

function foundryScheme() {
  return document.getElementById(INTERFACE_ID)?.classList.contains("theme-light") ? "light" : "dark";
}

// Foundry v14 has no hook for its Dark or Light switch (the setting, its preview, the browser's scheme), so the
// interface element's class is watched.
function watchScheme() {
  if (schemeWatcher) return;
  const target = document.getElementById(INTERFACE_ID);
  const Observer = document.defaultView?.MutationObserver ?? globalThis.MutationObserver;
  if (!target || typeof Observer !== "function") return;
  schemeWatcher = new Observer(() => {
    for (const each of targets) setTheme(each, each.theme, each.color);
  });
  schemeWatcher.observe(target, { attributes: true, attributeFilter: ["class"] });
}

function checkImagesOnce() {
  if (imagesCheck) return;
  imagesCheck = checkImages().then((found) => {
    if (found) return;
    imagesFound = false;
    warn("CoC7's sheet images weren't found, so the Art Deco theme shows as Foundry.");
    for (const target of targets) setTheme(target, target.theme, target.color);
  }, () => {});
}

/**
 * Applies a new Panel colour at once.
 * @param {Color|string} color "#rrggbb", or Foundry's Color
 * @returns {void}
 */
export function applyColor(color) {
  for (const target of targets) setTheme(target, target.theme, color);
}

/**
 * Applies a new Theme at once; any value not in THEMES shows Foundry.
 * @param {string} theme
 * @returns {void}
 */
export function applyTheme(theme) {
  for (const target of targets) setTheme(target, theme, target.color);
}

function setScale(root, size) {
  const n = Number(size);
  const percent = Number.isFinite(n) ? Math.max(SCALE.min, Math.min(SCALE.max, n)) : SCALE.default;
  root.style.setProperty(SCALE_VARIABLE, String(percent / 100));
  rescale(root);
}

/**
 * Steps Panel size by one step up (1) or down (-1), applied at once but not saved.
 * @param {number} direction
 * @returns {{from: number, to: number}|null} the size before and after in percent; null at a limit or with no panel
 */
export function stepScale(direction) {
  if (!scaled) return null;
  const now = Math.round(Number(scaled.root.style.getPropertyValue(SCALE_VARIABLE)) * 100) || SCALE.default;
  const to = Math.max(SCALE.min, Math.min(SCALE.max, now + Math.sign(Number(direction) || 0) * SCALE.step));
  if (to === now) return null;
  setScale(scaled.root, to);
  return { from: now, to };
}

/**
 * Saves Panel size; a failure is logged and keeps the size until a reload.
 * @param {number} size percent
 * @returns {Promise<void>}
 */
export async function saveScale(size) {
  try {
    await game.settings.set(MODULE_ID, "rollboxScale", size);
  } catch (error) {
    warn("couldn't save the panel's size.", error);
  }
}

/**
 * Applies a new Panel size to the panel at once.
 * @param {number} size percent
 * @returns {boolean} whether there was a panel to change
 */
export function applyScale(size) {
  if (!scaled) return false;
  setScale(scaled.root, size);
  return true;
}
