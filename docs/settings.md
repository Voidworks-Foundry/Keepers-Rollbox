# Settings code (`scripts/settings.js`)

Shared settings registration and the Configure Settings page decoration. Each part defines its own settings as plain data in its own `settings.js`; this file imports them, registers them and decorates the page, so Foundry still shows every setting on one page. The file is copied from `void-coc7-modules` 1.0.10; its imports and `SECTIONS` differ, and it adds two things the CoC7 module doesn't have yet: the `reset: true` flag and its Reset buttons (`addResetButton`, `resetInput`), and a section whose master is another section's switch (the Appearance group).

**Status key:** *Confirmed* only when the build guide's Internal API registry or changelog says so. The registry has no row for settings registration or the page decoration, so those are **assumed** unless stated.

## Code

### `ROLLBOX_SECTION`, `SECTIONS` and `ALL_SETTINGS` (private constants)
- **What they are:** `SECTIONS` is the order shown on the page, two groups:
  1. `ROLLBOX_SECTION`, "Keeper's Rollbox": the panel's switch `rollboxEnabled` (master, from `mini-sheet/settings.js` `PANEL_SETTINGS`), then `rollboxSimplifiedDice` (Simplified dice UI, from `shared/settings.js` `DICE_SETTINGS`, `docs/shared.md`). Built here, the way `void-coc7-modules` builds its "Combat movement" section, because it spans two parts.
  2. `APPEARANCE_SECTION` (`mini-sheet/settings.js`), "Appearance": `rollboxTheme`, `rollboxColor`, `rollboxTransparency`, `rollboxScale`, `rollboxMovable` (Allow moving the panel, with its Reset position button), `rollboxMenuSide` (Menus open to the), and the hidden `rollboxOffset` (where the panel was dropped). Its `master` is `rollboxEnabled`, which lives in the first section, so they all dim with the panel's switch.

  `ALL_SETTINGS` flattens them into `[key, config]` pairs in that order: `rollboxEnabled`, `rollboxSimplifiedDice`, `rollboxTheme`, `rollboxColor`, `rollboxTransparency`, `rollboxScale`, `rollboxMovable`, `rollboxMenuSide`, `rollboxOffset`. A setting registered hidden (`config: false`, `rollboxOffset`) has no form group, so the heading, note, button and dimming code skip it. The page order can change without touching keys or saved values.
- **Connects to:** `mini-sheet/settings.js`, `shared/settings.js`.
- **Could interact poorly with:** reordering changes the page order and registration order; keys must never be renamed (saved values would reset).

### `registerSettings()` (called from `main.js` at `init`)
- **How it works:** For each setting registers `game.settings.register(MODULE_ID, key, { config: true, requiresReload: true, ...config })` with the `note`, `reset` and `button` fields removed (all three are Rollbox's own, for the page decoration). A setting can turn off `requiresReload` in its own data (every Appearance setting and Simplified dice UI do). A setting's `type` may be a Foundry `DataField` instance (`rollboxColor` uses `ColorField`), which Foundry v14 accepts and shows with that field's own input. Any other field in the data, such as `range` or `onChange`, goes to Foundry unchanged.
- **Connects to:** `game.settings` (`ClientSettings#register(namespace, key, data)`; v14 docs list scopes `"world"`, `"user"`, `"client"`), `utils.js`.
- **Could interact poorly with:** nothing known. Registered keys and scopes are permanent. `requiresReload` appears in the v14 docs' register example but not in the typed `SettingConfig` interface; it works in `void-coc7-modules` on v14. **Assumed.**

### `decorateSettingsConfig(app, html)` (the `renderSettingsConfig` hook handler)
- **How it works:** Returns unless `html` is an `HTMLElement`. For every setting adds its italic scope note; for every setting whose data has `reset: true` adds a Reset button; for every setting with a `button` adds that action button; for every section adds the heading and note and the dimming. Repeated renders don't duplicate anything, because existing elements are detected (`data-coc-scope`, `data-coc-reset`, `data-coc-action`, `data-coc-section`).
- **Connects to:** the settings form DOM (`[name="<MODULE_ID>.<key>"]`, `.form-group`, `.hint`), Foundry's `h4.border` and `.hint` styles.
- **Could interact poorly with:**
  - A Foundry update that changes the form markup (the decoration would silently not appear); other modules that reorder form groups. **Assumed.**
  - `void-coc7-modules`, which runs the same code on the same page with the same `data-coc-*` markers. Each looks only inside its own settings' form groups and its own master keys, so neither skips the other's notes or headings. **Assumed** (reasoned from the code).

### `addScopeNote(group, note)` (private)
- **How it works:** Appends an italic block-level span with the note inside the setting's `.hint`, once.
- **Could interact poorly with:** settings with no hint element get no note. **Assumed.**

### `addResetButton(input, value)` (private)
- **How it works:** Adds a small `<button type="button" data-coc-reset>Reset</button>` (with a tooltip) at the end of the setting's `.form-fields` (or beside the input if there is none), once. Driven by `reset: true` in the setting's data, so the CoC7 module can use the same flag after a merge. Rollbox marks Theme, Panel transparency, Panel colour and Panel size. `type="button"`, so a click never submits the form.
- **Connects to:** `resetInput`; the setting's own `default` in its data.
- **Could interact poorly with:** Foundry's form markup changing (no `.form-group`: no button). **Assumed.** `void-coc7-modules` running the same code on the same page: each looks only inside its own settings' form groups. **Assumed.**

### `addActionButton(input, { label, tooltip, onClick })` (private)
- **How it works:** A setting's own action, from `button: { label, tooltip, onClick }` in its data: a `<button type="button" data-coc-action>` with that label and tooltip at the end of the setting's `.form-fields`, once. Unlike Reset it acts at once when clicked (there is no form value to save). Rollbox uses it for **Reset position** beside Allow moving the panel (`resetPosition()`, `docs/mini-sheet.md`). Not in `void-coc7-modules`' copy; it can take the same flag after a merge.
- **Connects to:** the setting's `button` data.
- **Could interact poorly with:** Foundry's form markup changing (no `.form-group`: no button). **Assumed.** Confirmed at the table 2026-11-15 (session 15): the button showed beside the tick box and put the panel back at once.

### `resetInput(input, value)` (private)
- **How it works:** Puts the default into the form field only, the way Foundry's own "Reset Defaults" button does (build 368 `SettingsConfig#onResetDefaults`): `checked` for a checkbox, otherwise `value`, then a `change` event. Foundry's `<range-picker>` and `<color-picker>` redraw and fire their own `input` and `change` events when their `value` is set (`AbstractFormInputElement`). Nothing is saved until the Keeper presses Save Changes, which then calls the setting's `onChange` as usual. Other settings' fields are untouched.
- **Connects to:** Foundry's form elements (build 368 `client/applications/elements/form-element.mjs`).
- **Could interact poorly with:** nothing known. **Assumed** until the table check.

### `addSection(html, { title, master, settings, note }, formGroup)` (private)
- **How it works:** Inserts an `h4.border` heading (margin-bottom 0) before the section's first setting's form group (marked `data-coc-section` with that key), then the section note if any, and wires the master checkbox's `change` event to dim the section's other settings to `DIMMED_OPACITY` (0.45) while it is unchecked. The master is usually the section's own first setting; a section may name another section's switch instead, and then every one of its settings dims. While "Show the Rollbox panel" is off, Simplified dice UI and the whole Appearance group (Theme, Panel colour, Panel transparency, Panel size) dim.
- **Connects to:** the section data; the master input.
- **Could interact poorly with:** the master being unchecked is only a visual dimming; the parts also check the master themselves. **Assumed.**

## Hooks, overrides, keybindings
- Hooks: none registered here (`main.js` wires `renderSettingsConfig` to `decorateSettingsConfig`).
- Class overrides: none.
- Keybindings: none.

## Tests

`tests/settings.test.mjs`: find the test you need in [TESTS.md, settings.test.mjs](TESTS.md#settingstestmjs) and run only that.
