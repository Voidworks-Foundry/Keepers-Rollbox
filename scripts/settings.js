/** Settings: registration, plus section headings and scope notes in Configure Settings. */
import { MODULE_ID } from "./utils.js";
import { APPEARANCE_SECTION, PANEL_SETTINGS } from "./mini-sheet/settings.js";
import { DICE_SETTINGS } from "./shared/settings.js";

/** The panel's switch, then the shared Simplified dice UI setting: built here because it spans two parts. */
const ROLLBOX_SECTION = {
  title: "Keeper's Rollbox",
  master: "rollboxEnabled",
  settings: { ...PANEL_SETTINGS, ...DICE_SETTINGS }
};

/**
 * Registered in this order, which is also the order shown in Configure Settings.
 * In each section the master switch comes first, then the options it controls. A section can instead name
 * another section's switch as its master (Appearance uses the panel's): then all its options dim with it.
 * A section's optional note is shown under its heading, for things that live outside this screen.
 */
const SECTIONS = [ROLLBOX_SECTION, APPEARANCE_SECTION];

const ALL_SETTINGS = SECTIONS.flatMap((section) => Object.entries(section.settings));

/** How faded a section's options look while its master switch is off. */
const DIMMED_OPACITY = "0.45";

/**
 * init: register every setting. It requires a reload unless its own data says otherwise.
 * `note`, `reset` and `button` are ours (the scope note, the Reset button and an action button), so they aren't
 * passed to Foundry.
 */
export function registerSettings() {
  for (const [key, { note, reset, button, ...config }] of ALL_SETTINGS) {
    game.settings.register(MODULE_ID, key, { config: true, requiresReload: true, ...config });
  }
}

/**
 * renderSettingsConfig hook: adds scope notes, section headings, Reset buttons for settings marked
 * `reset: true`, a setting's own action `button`, and dims options when a section is off.
 */
export function decorateSettingsConfig(app, html) {
  if (!(html instanceof HTMLElement)) return;
  const input = (key) => html.querySelector(`[name="${MODULE_ID}.${key}"]`);
  const formGroup = (key) => input(key)?.closest(".form-group");

  for (const [key, { note }] of ALL_SETTINGS) addScopeNote(formGroup(key), note);
  for (const [key, { reset, default: value }] of ALL_SETTINGS) if (reset) addResetButton(input(key), value);
  for (const [key, { button }] of ALL_SETTINGS) if (button) addActionButton(input(key), button);
  for (const section of SECTIONS) addSection(html, section, formGroup);
}

/**
 * A small "Reset" button beside one setting's field. It puts only that setting's default into the form,
 * the way Foundry's own "Reset Defaults" does for every setting: nothing is saved until Save Changes.
 */
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

/**
 * A setting's own action button beside its field, e.g. "Reset position" beside "Allow moving the panel". Unlike
 * Reset, it acts at once (it isn't a form value, so there is nothing to save).
 * @param {HTMLElement} input the setting's field
 * @param {{label: string, tooltip: string, onClick: () => void}} button
 */
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

/**
 * Put a default into a form field, as Foundry's SettingsConfig "Reset Defaults" does (build 368): set
 * `checked` or `value`, then a `change` event. Foundry's own range and colour pickers redraw and announce
 * the change themselves when their `value` is set.
 */
function resetInput(input, value) {
  if (input.type === "checkbox") input.checked = value;
  else input.value = value;
  input.dispatchEvent(new Event("change"));
}

/** Italic "Keeper setting..." / "Personal setting..." line under a setting's hint. */
function addScopeNote(group, note) {
  const hint = group?.querySelector(".hint");
  if (!hint || hint.querySelector("[data-coc-scope]")) return; // already added on an earlier render
  const line = document.createElement("span");
  line.dataset.cocScope = "";
  line.style.display = "block";
  line.style.fontStyle = "italic";
  line.textContent = note;
  hint.append(line);
}

/**
 * Heading above a section's first setting, styled like CoC7's own settings (Foundry core h4.border), plus
 * its note. The section's master may be its own first setting or another section's switch.
 */
function addSection(html, { title, master, settings, note }, formGroup) {
  const firstKey = Object.keys(settings)[0];
  const first = formGroup(firstKey);
  if (!first || html.querySelector(`[data-coc-section="${firstKey}"]`)) return; // already added on an earlier render

  const heading = document.createElement("h4");
  heading.classList.add("border");
  heading.style.marginBottom = "0";
  heading.dataset.cocSection = firstKey;
  heading.textContent = title;
  first.before(heading);

  if (note) {
    const line = document.createElement("p");
    line.classList.add("hint"); // Foundry's own muted hint style
    line.style.fontStyle = "italic";
    line.style.margin = "0.25rem 0 0.5rem";
    line.textContent = note;
    first.before(line);
  }

  // Dim the section's options while its master switch is unchecked.
  const masterInput = html.querySelector(`[name="${MODULE_ID}.${master}"]`);
  const children = Object.keys(settings).filter((key) => key !== master);
  const dimChildren = () => {
    for (const key of children) {
      const group = formGroup(key);
      if (group) group.style.opacity = masterInput?.checked === false ? DIMMED_OPACITY : "";
    }
  };
  masterInput?.addEventListener("change", dimChildren);
  dimChildren();
}
