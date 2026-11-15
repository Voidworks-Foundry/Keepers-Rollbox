/**
 * The panel's two themes and its colour: Dark (light text) and Light (dark text), each with its own palette in
 * mini-sheet.css, and the Panel colour as the tint within the theme. Pure colour maths, no DOM: the colour the panel
 * shows (its lightness kept where the theme's text reads well) and the colour a theme switch turns it into (its
 * lightness mirrored, hue and saturation kept). Layout and rules: DESIGN.md, "Who sees it and when".
 */

/** The themes (setting `rollboxTheme`): value → label. */
export const THEMES = Object.freeze({ dark: "Dark", light: "Light" });
export const DEFAULT_THEME = "dark";

/**
 * Panel colour (setting `rollboxColor`): the default is the panel's original background, Foundry's
 * `--color-cool-5` (build 368 `foundry2.css`).
 */
export const DEFAULT_COLOR = "#0b0a13";
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

/**
 * How light the shown colour may be, as WCAG relative luminance (0 black, 1 white), so every text colour of the
 * theme, down to its placeholder (mini-sheet.css `--rollbox-placeholder`: #b8aa9b on Dark, #575160 on Light), has at
 * least 4.5:1 contrast (WCAG AA) on the solid colour. Disabled buttons are exempt (WCAG 1.4.3).
 */
const LUMINANCE = Object.freeze({ dark: { max: 0.05 }, light: { min: 0.57 } });
/** Steps of the search for the lightness that just fits: enough for one step of 8-bit colour. */
const SEARCH_STEPS = 16;

/** A known theme, else the default. */
export function normalTheme(theme) {
  return Object.hasOwn(THEMES, theme) ? theme : DEFAULT_THEME;
}

/**
 * The colour as "#rrggbb". Foundry's ColorField gives a `Color` (a Number whose string is "#rrggbb"); a String
 * setting gives the text. Anything else gives the default.
 */
export function hexColor(value) {
  const text = String(value ?? "");
  return HEX_COLOR.test(text) ? text.toLowerCase() : DEFAULT_COLOR;
}

/** "#rrggbb" → [r, g, b], 0–255. */
const channels = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/** WCAG relative luminance of "#rrggbb", 0 (black) to 1 (white). */
function luminance(hex) {
  const [r, g, b] = channels(hex).map((value) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** "#rrggbb" → [hue 0–360, saturation 0–100, lightness 0–100] (HSL). */
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

/** [hue, saturation, lightness] (HSL) → "#rrggbb". */
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

/** Whether the theme's text reads well on this solid colour. */
function readable(hex, theme) {
  const limit = LUMINANCE[theme];
  return theme === "light" ? luminance(hex) >= limit.min : luminance(hex) <= limit.max;
}

/**
 * The colour with the same hue and saturation and the lightness nearest to `lightness` that the theme's text reads
 * well on: darker for Dark, lighter for Light (a binary search on the HSL lightness).
 */
function fitLightness([hue, saturation], lightness, theme) {
  const candidate = fromHsl([hue, saturation, lightness]);
  if (readable(candidate, theme)) return candidate;
  let [fits, fails] = theme === "light" ? [100, lightness] : [0, lightness];
  for (let step = 0; step < SEARCH_STEPS; step++) {
    const middle = (fits + fails) / 2;
    if (readable(fromHsl([hue, saturation, middle]), theme)) fits = middle;
    else fails = middle;
  }
  return fromHsl([hue, saturation, fits]);
}

/**
 * The colour the panel shows for the Panel colour in this theme: the colour itself when the theme's text reads well
 * on it, otherwise its hue and saturation at the nearest lightness that does. The setting keeps what the Keeper
 * picked.
 * @param {Color|string} color the Panel colour
 * @param {string} theme "dark" or "light"
 * @returns {string} "#rrggbb"
 */
export function shownColor(color, theme) {
  const hex = hexColor(color);
  const next = normalTheme(theme);
  if (readable(hex, next)) return hex;
  const [hue, saturation, lightness] = toHsl(hex);
  return fitLightness([hue, saturation], lightness, next);
}

/**
 * The Panel colour after switching to this theme (Void, 2026-11-14): its lightness mirrored (L → 100 − L in HSL,
 * so a dark navy becomes a light navy-tinted colour and back), kept where the new theme's text reads well, with its
 * hue and saturation unchanged. A colour the new theme's text already reads well on is kept as it is, so a switch
 * seen twice (two screens of one Keeper) never flips it back.
 * @param {Color|string} color the Panel colour
 * @param {string} theme the theme switched to
 * @returns {string} "#rrggbb"
 */
export function flippedColor(color, theme) {
  const hex = hexColor(color);
  const next = normalTheme(theme);
  if (readable(hex, next)) return hex;
  const [hue, saturation, lightness] = toHsl(hex);
  return fitLightness([hue, saturation], 100 - lightness, next);
}
