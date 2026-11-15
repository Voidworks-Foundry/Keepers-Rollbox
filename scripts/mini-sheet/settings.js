/**
 * The Rollbox panel's settings, as plain data for settings.js: the panel's switch (first in the "Keeper's
 * Rollbox" section, which settings.js builds because the shared Simplified dice UI setting joins it), and the
 * Appearance section (theme, colour, transparency, size, moving the panel, the menus' side), which apply at once and
 * dim while the switch is off; the first four have a Reset button. Moving the panel and where it was dropped are per
 * screen (client scope): a spot that suits one monitor may not suit another.
 */
import { PERSONAL } from "../utils.js";
import {
  applyColor, applyMenuSide, applyMovable, applyScale, resetPosition, applyTheme, applyTransparency, DEFAULT_COLOR,
  DEFAULT_MENU_SIDE, DEFAULT_THEME, MENU_SIDES, SCALE, THEMES, TRANSPARENCY
} from "./index.js";

/**
 * Foundry v14's colour field (`foundry.data.fields.ColorField`, shown as a colour picker in Configure
 * Settings), not nullable, so it always holds a colour. A plain text setting if it's ever missing.
 */
function colorType() {
  const ColorField = globalThis.foundry?.data?.fields?.ColorField;
  return ColorField ? new ColorField({ nullable: false, initial: DEFAULT_COLOR }) : String;
}

/** The panel's switch: the "Keeper's Rollbox" section's master, so it also dims the Appearance section. */
export const PANEL_SETTINGS = {
  rollboxEnabled: {
    name: "Show the Rollbox panel",
    hint: "When you select tokens, a small panel above the players list lets you request rolls from those characters. Only you see it.",
    scope: "user", type: Boolean, default: true, note: PERSONAL
  }
};

/** Their own group: theme, colour, transparency, size, moving, the menus' side; the panel's switch dims them. */
export const APPEARANCE_SECTION = {
  title: "Appearance",
  master: "rollboxEnabled",
  settings: {
    rollboxTheme: {
      name: "Theme",
      hint: "Dark or Light: the panel's text, buttons and highlights, each tuned to stay readable. Switching it also turns the Panel colour light or dark, keeping its tint.",
      scope: "user", type: String, choices: { ...THEMES },
      default: DEFAULT_THEME, note: PERSONAL, reset: true,
      requiresReload: false,
      onChange: (value) => applyTheme(value)
    },
    rollboxColor: {
      name: "Panel colour",
      hint: "Background colour of the panel, its buttons and its menus, within the theme: it is shown darker or lighter where the theme's text needs it.",
      scope: "user", type: colorType(),
      default: DEFAULT_COLOR, note: PERSONAL, reset: true,
      requiresReload: false,
      onChange: (value) => applyColor(value)
    },
    rollboxTransparency: {
      name: "Panel transparency",
      hint: "How see-through the panel, its buttons and its menus are. Text stays fully readable.",
      scope: "user", type: Number,
      range: { min: TRANSPARENCY.min, max: TRANSPARENCY.max, step: TRANSPARENCY.step },
      default: TRANSPARENCY.default, note: PERSONAL, reset: true,
      // Read each time the panel is drawn, and applied at once when changed: no reload.
      requiresReload: false,
      onChange: (value) => applyTransparency(value)
    },
    rollboxScale: {
      name: "Panel size",
      hint: "Size of the panel, its buttons and its menus.",
      scope: "user", type: Number,
      range: { min: SCALE.min, max: SCALE.max, step: SCALE.step },
      default: SCALE.default, note: PERSONAL, reset: true,
      requiresReload: false,
      onChange: (value) => applyScale(value)
    },
    rollboxMovable: {
      name: "Allow moving the panel",
      hint: "Drag the panel by its header (the name row) to put it anywhere on the screen; it stays where you drop it. "
        + "Reset position, or turning this off, puts it back above the players list.",
      scope: "client", type: Boolean, default: true, note: PERSONAL,
      button: { label: "Reset position", tooltip: "Put the panel back above the players list now.",
        onClick: () => resetPosition() },
      requiresReload: false,
      onChange: (value) => applyMovable(value)
    },
    rollboxMenuSide: {
      name: "Menus open to the",
      hint: "Which side of the panel the buttons and menus open on. Automatic: towards the middle of the screen. Above "
        + "the players list they always open to the right.",
      scope: "user", type: String, choices: { ...MENU_SIDES },
      default: DEFAULT_MENU_SIDE, note: PERSONAL,
      requiresReload: false,
      onChange: (value) => applyMenuSide(value)
    },
    // Where the panel was dropped: {corner, x, y}, from the corner of the screen quarter it was dropped in, in
    // pixels; {} when it is docked. Not shown.
    rollboxOffset: {
      name: "Panel offset",
      scope: "client", type: Object, default: {}, note: PERSONAL, config: false,
      requiresReload: false
    }
  }
};
