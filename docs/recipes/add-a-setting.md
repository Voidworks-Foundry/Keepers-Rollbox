# Recipe: add a setting

Configure Settings opens with the five feature switches (Rollbox panel, Player Rollbox, Turn order and turn controls, Gameplay rules, Setup check at login: `FEATURES` in `scripts/settings.js`), then one section per feature, in that order (`SECTIONS`), each greyed out while its feature is off. A section has no switch of its own. The parts describe their settings as plain data; `scripts/settings.js` registers them in page order and lays out Configure Settings (the boxes, labelled groups, italic notes, greying, Reset and action buttons). See [settings.md](../settings.md) and [DEVELOPING.md](../DEVELOPING.md), "Settings".

## 1. Choose

- **Key:** starts with `rollbox` (`rollboxSomething`). It is permanent: renaming it later throws away everyone's saved value, so pick it carefully.
- **Section and group:** the feature it belongs to, and the labelled group in its section where the Keeper will look for it: Rollbox panel (Look, Placement, Behaviour, Menus), Player Rollbox (What players can do, Each player's own), Turn order and turn controls (Your view), Gameplay rules (Starting a fight, Firearms, Melee, Rolling) or Setup check. A setting that only matters with another goes right after it, in the section's `indent` list. A personal setting that does nothing for a player gets `keeperOnly: true` (hidden on a player's page).
- **Scope:** `"user"` for a personal preference (note `PERSONAL`, "Personal setting, affects only your screen."); `"world"` for something that must be the same for everyone (note `KEEPER`, "Keeper setting, applies to everyone."); `"client"` for something tied to one screen (Allow moving the panel, with note `PERSONAL`). Both notes come from `scripts/utils.js`.
- **Type:** `Boolean` (a tick box), `Number` with `range: { min, max, step }` (a slider), `String` with `choices: { value: "Label" }` (a drop-down; the saved value is the key), or a Foundry `DataField` such as `ColorField`.
- **Reload:** the declared lists and the Player Rollbox's features are read each time they're used, so they register with `requiresReload: false`. Anything else needs a reload unless it is read each time it's used or applied at once in `onChange`; then set `requiresReload: false`.

## 2. Add it

**Most settings** (and any new part): declare it in the part that uses it, with `declareSettings` from `scripts/utils.js`, in the order it should appear:

```js
import { KEEPER, declareSettings, option } from "../utils.js";

export const SETTINGS = declareSettings([
  { key: "rollboxExample", scope: "world", type: Boolean, default: true, section: "gameplay",
    label: "Example", hint: "What it does, in one sentence.", note: KEEPER }
]);
```

`label` becomes Foundry's `name`; `section` (the page section's id, for the reader) and `key` are only for Rollbox. If the part already exports a `SETTINGS` list, add to it; a new part's list goes into `CONFIGS` in `scripts/settings.js` through `declared(…)`. Then add the key to its group in `SECTIONS` (and to `indent` if it hangs under another): a key in no section is never registered. A new feature is a new switch in `FEATURES` and a new `{ id, feature, title, groups }` in `SECTIONS`; ask in an issue first.

**The panel's own and Simplified dice UI:** these are objects keyed by setting in `scripts/panel/settings.js` (`APPEARANCE_SETTINGS`, `PANEL_SETTINGS`) and `scripts/shared/settings.js` (`DICE_SETTINGS`), placed the same way in `SECTIONS`:

```js
rollboxExample: {
  name: "Example",
  hint: "What it does, in one sentence.",
  scope: "user", type: Boolean, default: false, note: PERSONAL,
  requiresReload: false,
  onChange: (value) => applyExample(value)  // only if it applies at once
}
```

Add `reset: true` for a Reset button beside it (for appearance values people experiment with), `button: { label, tooltip, onClick }` for an action button beside it (Reset position), or `format` for the text beside a slider.

## 3. Read it

Read it at the moment you need it, with `option("rollboxExample")` from `scripts/utils.js` (it answers with the declared default if the setting can't be read yet), or `getSetting` for the panel's own settings. Never read a world setting during `init`. A Keeper-only feature checks `isKeeper()` (or `panelHere()` for anything drawn in the panel) before it reads anything, so a player with the Player Rollbox off reads only that switch.

## 4. Test and document

- `tests/settings.test.mjs`: the table of every setting's scope, default and reload lists every key, so add the new one there. A test in the part's own file for what the setting changes, and one for the does-nothing path with it off.
- `docs/TESTS.md`: rows for any test you added or renamed (pattern and name), under its file.
- The part's document, its `## Settings` section; [settings.md](../settings.md) if the page order changed; DEVELOPING.md's "Settings" if a section changed; the user guide's [settings.md](../../guide/settings.md) (every setting, by section) and the guide page of the feature it changes.
- A line in `CHANGELOG.md`.

## 5. Check

```
npm test -- tests/settings.test.mjs tests/docs-index.test.mjs
npm test
npm run release-check
```

In Foundry: the setting shows in its section's box under its group's label with its italic note, greys out with the section when its feature is off, and does what it says (at once, or after the reload Foundry asks for). No Rollbox setting shows on a player's Configure Settings while the Player Rollbox is off.
