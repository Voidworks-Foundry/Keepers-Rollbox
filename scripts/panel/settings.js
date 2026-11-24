/** The Rollbox panel's settings, as plain data for settings.js. See docs/panel.md. */
import { PERSONAL } from "../utils.js";
import {
  applyAutoHide, applyColor, applyLayer, applyMenuSide, applyMovable, applyScale, refreshPanel, resetPosition, applyTheme,
  applyTransparency, AUTO_HIDE, DEFAULT_COLOR, DEFAULT_MENU_SIDE, DEFAULT_PANEL_LAYER, DEFAULT_THEME, MENU_SIDES,
  PANEL_LAYERS, SCALE, THEMES, TRANSPARENCY
} from "./index.js";
import { METER_CHOICES } from "./cards.js";

/** Auto-hide's time as read beside its slider: "10 s", "1 min", "2 min 30 s". */
function durationText(seconds) {
  const n = Math.max(0, Math.round(Number(seconds) || 0));
  if (n < 60) return `${n} s`;
  const minutes = Math.floor(n / 60);
  const rest = n % 60;
  return rest ? `${minutes} min ${rest} s` : `${minutes} min`;
}

// Foundry v14: `ColorField` (a colour picker in Configure Settings); a plain text setting if it's ever missing.
function colorType() {
  const ColorField = globalThis.foundry?.data?.fields?.ColorField;
  return ColorField ? new ColorField({ nullable: false, initial: DEFAULT_COLOR }) : String;
}

const ALL_METERS = Object.freeze(Object.keys(METER_CHOICES));

// Foundry v14: a `SetField` of a `StringField`, saved as the ticked meter keys; a plain list if it's ever missing.
function meterType() {
  const { SetField, StringField } = globalThis.foundry?.data?.fields ?? {};
  if (!SetField || !StringField) return Array;
  return new SetField(new StringField({ choices: { ...METER_CHOICES } }), { initial: [...ALL_METERS] });
}

// One tick box per meter (Foundry's `createMultiSelectInput`) rather than the set field's default drop-down.
function meterInput(field, config) {
  const create = globalThis.foundry?.applications?.fields?.createMultiSelectInput;
  const options = Object.entries(METER_CHOICES).map(([value, label]) => ({ value, label }));
  const value = Array.from(config?.value ?? ALL_METERS);
  if (typeof create === "function") return create({ ...config, type: "checkboxes", options, value });
  return field.toInput({ ...config, input: undefined, value });
}

/** The panel's switch, Show the players (`keeperOnly`) and Escape, by key. */
export const PANEL_SETTINGS = {
  rollboxEnabled: {
    name: "Rollbox panel",
    hint: "Your Rollbox panel beside the players list. Off: nothing of Rollbox shows on your screen.",
    scope: "user", type: Boolean, default: true, note: PERSONAL
  },
  rollboxShowPlayers: {
    name: "Show the players when nothing is selected",
    hint: "The Keeper's panel lists each player's investigator while no token is selected, with Check and Other for "
      + "all of them. Off: the panel shows only while tokens are selected (or a combat runs).",
    scope: "user", type: Boolean, default: true, note: PERSONAL, keeperOnly: true,
    requiresReload: false,
    onChange: () => refreshPanel()
  },
  rollboxEscapeClosesFlyout: {
    name: "Escape closes the flyout",
    hint: "Pressing Escape closes an open Rollbox flyout. With no flyout open, Escape does what Foundry does.",
    scope: "user", type: Boolean, default: true, note: PERSONAL,
    requiresReload: false
  }
};

/** The panel's look and placement settings, by key. */
export const APPEARANCE_SETTINGS = {
  rollboxTheme: {
    name: "Theme",
    hint: "How the panel looks; the menus and buttons stay the same. Foundry: Foundry's own look, Dark or Light as "
      + "Foundry's interface is set. Art Deco: CoC7's decorated character sheet. CoC7 minimal: CoC7's compact dark "
      + "sheet. The two CoC7 looks use CoC7's own images and fonts, and show as Foundry without them.",
    scope: "user", type: String, choices: { ...THEMES },
    default: DEFAULT_THEME, note: PERSONAL, reset: true,
    requiresReload: false,
    onChange: (value) => applyTheme(value)
  },
  rollboxColor: {
    name: "Panel colour",
    hint: "Foundry theme only. Background colour of the panel, its buttons and its flyouts: it is shown darker "
      + "or lighter where the text needs it, and lightened when Foundry's interface is Light. The CoC7 themes use "
      + "CoC7's own colours.",
    scope: "user", type: colorType(),
    default: DEFAULT_COLOR, note: PERSONAL, reset: true, foundryOnly: true,
    requiresReload: false,
    onChange: (value) => applyColor(value)
  },
  rollboxTransparency: {
    name: "Panel transparency",
    hint: "Foundry theme only. How see-through the panel, its buttons and its flyouts are. Text stays fully "
      + "readable. The CoC7 themes are solid.",
    scope: "user", type: Number,
    range: { min: TRANSPARENCY.min, max: TRANSPARENCY.max, step: TRANSPARENCY.step },
    default: TRANSPARENCY.default, note: PERSONAL, reset: true, foundryOnly: true,
    requiresReload: false,
    onChange: (value) => applyTransparency(value)
  },
  rollboxScale: {
    name: "Panel size",
    hint: "Size of the panel, its buttons and its flyouts.",
    scope: "user", type: Number,
    range: { min: SCALE.min, max: SCALE.max, step: SCALE.step },
    default: SCALE.default, note: PERSONAL, reset: true,
    requiresReload: false,
    onChange: (value) => applyScale(value)
  },
  rollboxMovable: {
    name: "Allow moving the panel",
    hint: "Drag the panel by its header (the name row) to put it anywhere on the screen; it stays where you drop it. "
      + "Reset position, or turning this off, puts it back beside the players list.",
    scope: "client", type: Boolean, default: true, note: PERSONAL,
    button: { label: "Reset position", tooltip: "Put the panel back beside the players list now.",
      onClick: () => resetPosition() },
    requiresReload: false,
    onChange: (value) => applyMovable(value)
  },
  rollboxMenuSide: {
    name: "Menu and flyouts open to the",
    hint: "Which side of the panel the menu and flyouts open on. Automatic: towards the middle of the screen. Beside "
      + "the players list they always open to the right.",
    scope: "user", type: String, choices: { ...MENU_SIDES },
    default: DEFAULT_MENU_SIDE, note: PERSONAL,
    requiresReload: false,
    onChange: (value) => applyMenuSide(value)
  },
  rollboxPanelLayer: {
    name: "Panel layer",
    hint: "Whether Foundry's windows (sheets, journals, roll dialogs) cover the panel. Bottom: windows always cover "
      + "it. Top: the panel stays above every window (tooltips, notifications, right-click menus and pop-up questions "
      + "stay above it). Top when active: like a window, clicking the panel brings it to the front, and clicking a "
      + "window brings that one forward."
      + " Top when active or selected: the same, and the panel also comes to the front whenever you select tokens.",
    scope: "user", type: String, choices: { ...PANEL_LAYERS },
    default: DEFAULT_PANEL_LAYER, note: PERSONAL,
    requiresReload: false,
    onChange: (value) => applyLayer(value)
  },
  rollboxAutoHide: {
    name: "Auto-hide the character card",
    hint: "After a while without using the panel, the full character card drops to the compact card, the one a "
      + "character gets when several are selected. Hovering over the panel brings the full card back.",
    scope: "user", type: Boolean, default: false, note: PERSONAL,
    requiresReload: false,
    onChange: () => applyAutoHide()
  },
  rollboxAutoHideAfter: {
    name: "Auto-hide after",
    hint: "How long without using the panel before the card drops to the compact card: 1 second to 5 minutes.",
    scope: "user", type: Number,
    range: { min: AUTO_HIDE.min, max: AUTO_HIDE.max, step: AUTO_HIDE.step },
    default: AUTO_HIDE.default, note: PERSONAL, format: durationText,
    requiresReload: false,
    onChange: () => applyAutoHide()
  },
  rollboxCardMeters: {
    name: "Meters on the small cards",
    hint: "Which bars the small character cards show: the cards when several characters are selected, and each "
      + "combatant's row in the turn order. The full character card always shows all four.",
    scope: "user", type: meterType(), input: meterInput,
    default: [...ALL_METERS], note: PERSONAL,
    requiresReload: false,
    onChange: () => refreshPanel()
  },
  // Where the panel was dropped: {corner, x, y}, or {} when it is docked. Not shown.
  rollboxOffset: {
    name: "Panel offset",
    scope: "client", type: Object, default: {}, note: PERSONAL, config: false,
    requiresReload: false
  }
};
