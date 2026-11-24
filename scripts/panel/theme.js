/** The themes, which one can show, and the Panel colour's maths; no DOM. See docs/panel.md. */
import { COC7_ID } from "../utils.js";

/** The themes: value → label. The values are permanent once released. */
export const THEMES = Object.freeze({ foundry: "Foundry", artDeco: "Art Deco", coc7Minimal: "CoC7 minimal" });
/** The theme used for an unknown value. */
export const DEFAULT_THEME = "foundry";

/** The class each theme puts on the panel root; its CSS is scoped under it. */
export const THEME_CLASSES = Object.freeze({
  foundry: "rollbox-theme-foundry",
  artDeco: "rollbox-theme-art-deco",
  coc7Minimal: "rollbox-theme-coc7-minimal"
});

const COC7_THEMES = new Set(["artDeco", "coc7Minimal"]);
const NEEDS_IMAGES = new Set(["artDeco"]);

/** Panel colour's default: Foundry v14's `--color-cool-5`. */
export const DEFAULT_COLOR = "#0b0a13";
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

// WCAG relative luminance limits, so every text colour of each palette, down to its placeholder, has 4.5:1 (AA).
const LUMINANCE = Object.freeze({ dark: { max: 0.05 }, light: { min: 0.57 } });
// Enough steps for one step of 8-bit colour.
const SEARCH_STEPS = 16;

/**
 * Returns a known theme, else the default, so an old saved value ("dark", "light") never breaks the panel.
 * @param {*} theme
 * @returns {string}
 */
export function normalTheme(theme) {
  return Object.hasOwn(THEMES, theme) ? theme : DEFAULT_THEME;
}

const normalScheme = (scheme) => (scheme === "light" ? "light" : "dark");

/**
 * Returns the theme the panel can show: the chosen one, or Foundry when CoC7 or its images aren't there.
 * @param {string} theme the saved theme
 * @param {{system?: string, imagesFound?: boolean}} context
 * @returns {string} a key of THEMES
 */
export function usableTheme(theme, { system, imagesFound = true } = {}) {
  const chosen = normalTheme(theme);
  if (!COC7_THEMES.has(chosen)) return chosen;
  if (system !== COC7_ID) return DEFAULT_THEME;
  if (NEEDS_IMAGES.has(chosen) && !imagesFound) return DEFAULT_THEME;
  return chosen;
}

/**
 * Returns whether this theme is drawn with CoC7's images.
 * @param {string} theme
 * @returns {boolean}
 */
export const usesImages = (theme) => NEEDS_IMAGES.has(theme);

/**
 * Returns the colour as "#rrggbb", from Foundry's `Color` or a string; anything else gives the default.
 * @param {Color|string} value
 * @returns {string}
 */
export function hexColor(value) {
  const text = String(value ?? "");
  return HEX_COLOR.test(text) ? text.toLowerCase() : DEFAULT_COLOR;
}

const channels = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

function luminance(hex) {
  const [r, g, b] = channels(hex).map((value) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Converts "#rrggbb" to HSL.
 * @param {string} hex
 * @returns {number[]} [hue 0–360, saturation 0–100, lightness 0–100]
 */
export function toHsl(hex) {
  const [r, g, b] = channels(hex).map((value) => value / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  const delta = max - min;
  if (!delta) return [0, 0, lightness * 100];
  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  let hue;
  if (max === r) hue = ((g - b) / delta) % 6;
  else if (max === g) hue = (b - r) / delta + 2;
  else hue = (r - g) / delta + 4;
  return [(hue * 60 + 360) % 360, saturation * 100, lightness * 100];
}

function fromHsl([hue, saturation, lightness]) {
  const s = saturation / 100;
  const l = lightness / 100;
  const a = s * Math.min(l, 1 - l);
  const part = (n) => {
    const k = (n + hue / 30) % 12;
    const value = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(value * 255).toString(16).padStart(2, "0");
  };
  return `#${part(0)}${part(8)}${part(4)}`;
}

function readable(hex, scheme) {
  const limit = LUMINANCE[scheme];
  return scheme === "light" ? luminance(hex) >= limit.min : luminance(hex) <= limit.max;
}

// A binary search for the HSL lightness nearest to `lightness` that the palette's text reads well on.
function fitLightness([hue, saturation], lightness, scheme) {
  const candidate = fromHsl([hue, saturation, lightness]);
  if (readable(candidate, scheme)) return candidate;
  let [fits, fails] = scheme === "light" ? [100, lightness] : [0, lightness];
  for (let step = 0; step < SEARCH_STEPS; step++) {
    const middle = (fits + fails) / 2;
    if (readable(fromHsl([hue, saturation, middle]), scheme)) fits = middle;
    else fails = middle;
  }
  return fromHsl([hue, saturation, fits]);
}

/**
 * Returns the colour the Foundry theme shows: the Panel colour, or its lightness mirrored and kept readable.
 * @param {Color|string} color the Panel colour
 * @param {string} scheme Foundry's interface: "dark" or "light"
 * @returns {string} "#rrggbb"
 */
export function shownColor(color, scheme) {
  const hex = hexColor(color);
  const next = normalScheme(scheme);
  if (readable(hex, next)) return hex;
  const [hue, saturation, lightness] = toHsl(hex);
  return fitLightness([hue, saturation], 100 - lightness, next);
}
