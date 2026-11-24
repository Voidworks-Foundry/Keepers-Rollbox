/** Registers every setting and lays out Rollbox's part of Configure Settings. See docs/settings.md. */
import { MODULE_ID, isKeeper } from "./utils.js";
import { refreshPanel } from "./panel/index.js";
// The panel's settings call its own functions when they change, so panel/index.js re-exporting them would make an
// import cycle.
import { APPEARANCE_SETTINGS, PANEL_SETTINGS } from "./panel/settings.js";
import { DICE_SETTINGS } from "./shared/index.js";
import { SETTINGS as CHECK_SETTINGS } from "./flyouts/check/index.js";
import { SETTINGS as PLAYER_SETTINGS, playerRollboxOn } from "./player/index.js";
import {
  DRAW_SETTINGS, FIGHT_SETTINGS, FIREARM_SETTINGS, GAMEPLAY_SETTINGS, NOTICE_PLACE_SETTINGS, NOTICE_SETTINGS,
  TURN_SETTINGS
} from "./combat/index.js";
import { REACH_SETTINGS, SPELL_SETTINGS } from "./flyouts/action/index.js";
import { ATTACK_SETTINGS } from "./roll-requests/index.js";
import { CHECK_NOW, SETTINGS as SETUP_SETTINGS, registerCheckNowMenu } from "./setup/index.js";

/** A part's declared settings as this file's entries, by key, with `extra` merged into each. */
function declared(list, extra = {}) {
  return Object.fromEntries(list.map(({ key, label, section, ...config }) => [key, { name: label, ...config, ...extra }]));
}

// The switch decides at ready whether a player's client builds a panel, so it needs a reload; the features redraw
// each player's menu at once (Foundry runs a world setting's onChange on every client).
const PLAYER_SWITCH = "rollboxPlayerRollbox";
const PLAYER_CONFIGS = Object.fromEntries(Object.entries(declared(PLAYER_SETTINGS)).map(([key, config]) => [key,
  key === PLAYER_SWITCH ? { ...config, requiresReload: true }
    : { ...config, requiresReload: false, onChange: () => refreshPanel() }]));

/** Every setting's data by key, from the parts. */
const CONFIGS = {
  ...PANEL_SETTINGS,
  ...APPEARANCE_SETTINGS,
  ...DICE_SETTINGS,
  ...declared(NOTICE_PLACE_SETTINGS, { requiresReload: false }),
  ...declared(CHECK_SETTINGS, { requiresReload: false }),
  ...declared(SPELL_SETTINGS, { requiresReload: false }),
  ...PLAYER_CONFIGS,
  ...declared([...TURN_SETTINGS, ...ATTACK_SETTINGS], { requiresReload: false }),
  ...declared([...GAMEPLAY_SETTINGS, ...DRAW_SETTINGS, ...FIGHT_SETTINGS, ...FIREARM_SETTINGS, ...NOTICE_SETTINGS,
    ...REACH_SETTINGS], { requiresReload: false }),
  ...declared(SETUP_SETTINGS, { requiresReload: false })
};

// Registered in page order, which is also Foundry's order on the page; the keys never change, only where they show.
const FEATURES = Object.freeze({
  title: "Features",
  note: "Each section below belongs to one feature and is greyed out while that feature is off.",
  keys: ["rollboxEnabled", PLAYER_SWITCH, "rollboxCombatPanel", "rollboxGameplay", "rollboxSetupCheck"]
});

const SECTIONS = Object.freeze([
  { id: "panel", feature: "rollboxEnabled", title: "Rollbox panel", groups: [
    ["Look", ["rollboxTheme", "rollboxColor", "rollboxTransparency", "rollboxScale", "rollboxNoticeScale",
      "rollboxCardMeters", "rollboxNoticePlaces"]],
    ["Placement", ["rollboxMovable", "rollboxMenuSide", "rollboxPanelLayer", "rollboxAutoHide", "rollboxAutoHideAfter",
      "rollboxOffset"]],
    ["Behaviour", ["rollboxShowPlayers", "rollboxEscapeClosesFlyout", "rollboxSimplifiedDice"]],
    ["Menus", ["rollboxCheckOpensOn", "rollboxListStyle", "rollboxSpellTextTab", "rollboxSpellTextCasting"]]
  ], indent: ["rollboxColor", "rollboxTransparency", "rollboxAutoHideAfter"] },
  { id: "playerRollbox", feature: PLAYER_SWITCH, title: "Player Rollbox", groups: [
    ["What players can do", ["rollboxPlayerActions", "rollboxPlayerChecks", "rollboxPlayerCombined",
      "rollboxPlayerSanity", "rollboxPlayerLuck", "rollboxPlayerOpposed", "rollboxPlayerAssist"]],
    ["Each player's own", ["rollboxRollMyAttacks"]]
  ], indent: ["rollboxPlayerCombined"] },
  { id: "turnOrder", feature: "rollboxCombatPanel", title: "Turn order and turn controls", groups: [
    ["Your view", ["rollboxTurnSelection", "rollboxTurnOrderClick"]]
  ] },
  { id: "gameplay", feature: "rollboxGameplay", title: "Gameplay rules", groups: [
    ["Starting a fight", ["rollboxJoinRange", "rollboxNoticeDraw", "rollboxNoticeRange", "rollboxNoticeDistance"]],
    ["Firearms", ["rollboxReadiedFirearms", "rollboxBowsReadied", "rollboxSwitchLosesReadied"]],
    ["Melee", ["rollboxMeleeReach"]],
    ["Rolling", ["rollboxAutoRollNpc", "rollboxAutoRollAttacks"]]
  ], indent: ["rollboxNoticeRange", "rollboxNoticeDistance", "rollboxBowsReadied", "rollboxSwitchLosesReadied"] },
  // The setup check has no setting of its own besides its switch: its section holds the Check now button.
  { id: "setup", feature: "rollboxSetupCheck", title: "Setup check", groups: [], menus: [CHECK_NOW.key] }
].map((section) => Object.freeze(section)));

const PAGE_ORDER = [...FEATURES.keys, ...SECTIONS.flatMap((section) => section.groups.flatMap(([, keys]) => keys))];

const ALL_SETTINGS = PAGE_ORDER.map((key) => [key, CONFIGS[key]]);

/** How faded a section (or a setting) looks while its feature is off; display only. */
const DIMMED_OPACITY = "0.45";
const THEME_KEY = "rollboxTheme";
const FOUNDRY_THEME = "foundry";

/**
 * Registers every setting; each requires a reload unless its own data says otherwise.
 * @returns {void}
 */
export function registerSettings() {
  // `note`, `reset`, `button`, `format`, `foundryOnly` and `keeperOnly` are Rollbox's own, not Foundry's.
  for (const [key, { note, reset, button, format, foundryOnly, keeperOnly, ...config }] of ALL_SETTINGS) {
    game.settings.register(MODULE_ID, key, { config: true, requiresReload: true, ...config });
  }
  registerCheckNowMenu();
}

/**
 * Adds the scope notes and buttons to Rollbox's settings and lays them out in boxes (renderSettingsConfig).
 * @param {SettingsConfig} app
 * @param {HTMLElement} html
 * @returns {void}
 */
export function decorateSettingsConfig(app, html) {
  if (!(html instanceof HTMLElement)) return;
  if (!isKeeper() && !playerRollboxOn()) return hideFromPlayer(html);
  const input = (key) => html.querySelector(`[name="${MODULE_ID}.${key}"]`);
  const formGroup = (key) => input(key)?.closest(".form-group")
    ?? html.querySelector(`[data-key="${MODULE_ID}.${key}"]`)?.closest(".form-group");

  if (!isKeeper()) hideKeeperOnly(ALL_SETTINGS.filter(([, { keeperOnly }]) => keeperOnly).map(([key]) => key), formGroup);
  for (const [key, { note }] of ALL_SETTINGS) addScopeNote(formGroup(key), note);
  addScopeNote(formGroup(CHECK_NOW.key), CHECK_NOW.note);
  for (const [key, { reset, default: value }] of ALL_SETTINGS) if (reset) addResetButton(input(key), value);
  for (const [key, { button }] of ALL_SETTINGS) if (button) addActionButton(input(key), button);
  for (const [key, { format }] of ALL_SETTINGS) if (typeof format === "function") addValueText(input(key), format);
  let last = addFeatures(html, formGroup);
  for (const section of SECTIONS) last = addSection(html, section, formGroup, last) ?? last;
  dimForTheme(html, ALL_SETTINGS.filter(([, { foundryOnly }]) => foundryOnly).map(([key]) => key), formGroup);
}

const shown = (group) => Boolean(group) && group.dataset.cocKeeperOnly !== "true";

// `display: none`, which Foundry's search doesn't undo.
function hideKeeperOnly(keys, formGroup) {
  for (const key of keys) {
    const group = formGroup(key);
    if (!group) continue;
    group.dataset.cocKeeperOnly = "true";
    group.style.display = "none";
  }
}

function makeBox(id, title, aside, { accent = false } = {}) {
  const box = document.createElement("div");
  box.dataset.cocSectionBox = id;
  box.style.border = `1px solid var(${accent ? "--color-border-highlight" : "--color-border-light-tertiary"}, #7a7971)`;
  box.style.borderRadius = "8px";
  box.style.padding = "0.25rem 0.75rem 0.5rem";
  box.style.margin = "0 0 0.75rem";
  const heading = document.createElement("h4");
  heading.classList.add("border");
  heading.dataset.cocSection = id;
  heading.style.marginBottom = "0";
  heading.style.display = "flex";
  heading.style.justifyContent = "space-between";
  heading.style.alignItems = "baseline";
  heading.style.gap = "0.5rem";
  heading.append(document.createTextNode(title));
  if (aside) {
    const line = document.createElement("span");
    line.dataset.cocSectionAside = "";
    // Foundry's and the system's heading styles (a display font, small capitals) would make the line unreadable.
    line.style.font = "normal var(--font-size-11, 11px) var(--font-body, sans-serif)";
    line.style.fontVariant = "normal";
    line.style.textTransform = "none";
    line.style.letterSpacing = "normal";
    line.style.textIndent = "0";
    line.style.textAlign = "right";
    line.style.color = "var(--color-text-secondary, inherit)";
    line.textContent = aside;
    heading.append(line);
  }
  box.append(heading);
  return box;
}

// Returns null when none of the switches is shown: the sections then follow each other from where the first one is.
function addFeatures(html, formGroup) {
  const existing = html.querySelector('[data-coc-section-box="features"]');
  if (existing) return existing;
  const groups = FEATURES.keys.map(formGroup).filter(shown);
  if (!groups.length) return null;
  const box = makeBox("features", FEATURES.title, FEATURES.note, { accent: true });
  firstRollboxGroup(html)?.before(box);
  box.append(...groups);
  return box;
}

// A menu is drawn before the settings, so the first form group may not be Rollbox's.
function firstRollboxGroup(html) {
  return html.querySelector(`[name^="${MODULE_ID}."], [data-key^="${MODULE_ID}."]`)?.closest(".form-group") ?? null;
}

function sectionScope({ groups, menus = [] }) {
  const scopes = new Set([...groups.flatMap(([, keys]) => keys).map((key) => CONFIGS[key]?.scope),
    ...menus.map(() => "world")].filter(Boolean).map((scope) => (scope === "world" ? "Keeper" : "Personal")));
  return scopes.size === 1 ? [...scopes][0] : "Mixed";
}

// The box greys out while the feature's tick box is off in the form, before Save; nothing is saved or disabled.
function addSection(html, section, formGroup, after) {
  const { id, feature, title, groups, indent = [], menus = [] } = section;
  const existing = html.querySelector(`[data-coc-section-box="${id}"]`);
  if (existing) return existing;
  const parts = groups.map(([label, keys]) => [label, keys.map(formGroup).filter(shown)])
    .filter(([, nodes]) => nodes.length);
  const menuNodes = menus.map(formGroup).filter(shown);
  if (!parts.length && !menuNodes.length) return null;
  const featureName = CONFIGS[feature]?.name ?? "";
  const box = makeBox(id, title, `${sectionScope(section)} · follows ${featureName}`);
  const anchor = after ?? firstRollboxGroup(html);
  if (after) after.after(box);
  else anchor?.before(box);
  for (const [label, nodes] of parts) {
    const line = document.createElement("p");
    line.dataset.cocGroup = "";
    line.style.margin = "0.5rem 0 0";
    line.style.fontSize = "var(--font-size-11, 11px)";
    line.style.fontWeight = "bold";
    line.style.letterSpacing = "0.05em";
    line.style.textTransform = "uppercase";
    line.style.color = "var(--color-text-accent, inherit)";
    line.textContent = label;
    box.append(line, ...nodes);
  }
  box.append(...menuNodes);
  for (const key of indent) {
    const group = formGroup(key);
    if (group) group.style.paddingLeft = "1.5rem";
  }
  const switchInput = html.querySelector(`[name="${MODULE_ID}.${feature}"]`);
  const dim = () => {
    const off = switchInput?.checked === false;
    box.dataset.cocSectionDimmed = String(off);
    box.style.opacity = off ? DIMMED_OPACITY : "";
  };
  switchInput?.addEventListener("change", dim);
  dim();
  return box;
}

// Greyed on the group, the section's greying on its box, so the two add up and neither undoes the other.
function dimForTheme(html, keys, formGroup) {
  const theme = html.querySelector(`[name="${MODULE_ID}.${THEME_KEY}"]`);
  if (!theme || !keys.length) return;
  const dim = () => {
    const other = theme.value !== FOUNDRY_THEME;
    for (const key of keys) {
      const group = formGroup(key);
      if (!group) continue;
      group.dataset.cocThemeDimmed = String(other);
      group.style.opacity = other ? DIMMED_OPACITY : "";
    }
  };
  theme.addEventListener("change", dim);
  dim();
}

// Foundry v14's search sets `hidden` only on single settings, so an inline `display: none` keeps the tab gone.
function hideFromPlayer(html) {
  for (const node of html.querySelectorAll(`[data-tab="${MODULE_ID}"], [data-category="${MODULE_ID}"]`)) {
    node.style.display = "none";
  }
  for (const node of html.querySelectorAll(`[name^="${MODULE_ID}."]`)) {
    const group = node.closest(".form-group");
    if (group) group.style.display = "none";
  }
}

// Only into the form, as Foundry's "Reset Defaults" does: nothing is saved until Save Changes.
function addResetButton(input, value) {
  const group = input?.closest(".form-group");
  if (!group || group.querySelector("[data-coc-reset]")) return; // already added on an earlier render
  const button = document.createElement("button");
  button.type = "button"; // not a submit button: a click must not save the form
  button.dataset.cocReset = "";
  button.dataset.tooltip = "Put back this setting's default. Save Changes applies it.";
  button.style.flex = "none";
  button.style.width = "auto";
  button.style.padding = "0 0.5rem";
  button.textContent = "Reset";
  button.addEventListener("click", () => resetInput(input, value));
  (input.closest(".form-fields") ?? input.parentElement).append(button);
}

// Acts at once: it isn't a form value, so there is nothing to save.
function addActionButton(input, { label, tooltip, onClick }) {
  const group = input?.closest(".form-group");
  if (!group || group.querySelector("[data-coc-action]")) return; // already added on an earlier render
  const button = document.createElement("button");
  button.type = "button"; // not a submit button: a click must not save the form
  button.dataset.cocAction = "";
  button.dataset.tooltip = tooltip;
  button.style.flex = "none";
  button.style.width = "auto";
  button.style.padding = "0 0.5rem";
  button.textContent = label;
  button.addEventListener("click", () => onClick());
  (input.closest(".form-fields") ?? input.parentElement).append(button);
}

function addValueText(input, format) {
  const group = input?.closest(".form-group");
  if (!group || group.querySelector("[data-coc-value]")) return; // already added on an earlier render
  const text = document.createElement("span");
  text.dataset.cocValue = "";
  text.style.flex = "none";
  text.style.minWidth = "6em";
  const show = () => {
    try {
      text.textContent = format(Number(input.value));
    } catch {
      text.textContent = "";
    }
  };
  for (const type of ["input", "change"]) input.addEventListener(type, show);
  show();
  (input.closest(".form-fields") ?? input.parentElement).append(text);
}

// Foundry v14: as SettingsConfig's "Reset Defaults" does, `checked` or `value` then a `change` event; its range and
// colour pickers redraw themselves when their `value` is set.
function resetInput(input, value) {
  if (input.type === "checkbox") input.checked = value;
  else input.value = value;
  input.dispatchEvent(new Event("change"));
}

// A setting without a hint has no hint paragraph in Foundry's form, so one is made with Foundry's own hint class.
function addScopeNote(group, note) {
  if (!group || !note) return;
  let hint = group.querySelector(".hint");
  if (!hint) {
    hint = document.createElement("p");
    hint.classList.add("hint");
    group.append(hint);
  }
  if (hint.querySelector("[data-coc-scope]")) return; // already added on an earlier render
  const line = document.createElement("span");
  line.dataset.cocScope = "";
  line.style.display = "block";
  line.style.fontStyle = "italic";
  line.textContent = note;
  hint.append(line);
}
