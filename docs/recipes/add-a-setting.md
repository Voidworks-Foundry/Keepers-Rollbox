# Recipe: add a setting

Settings are plain data in each part's `settings.js`; `scripts/settings.js` registers them and decorates Configure Settings (headings, italic notes, dimming, Reset buttons). See [settings.md](../settings.md) and [DEVELOPING.md](../DEVELOPING.md), "Settings".

## 1. Choose

- **Key:** starts with `rollbox` (`rollboxSomething`). It is permanent: renaming it later throws away everyone's saved value, so pick it carefully.
- **Scope:** `"user"` for a personal preference (note `PERSONAL`, "Personal setting, affects only your screen."); `"world"` for something that must be the same for everyone (note `KEEPER`, "Keeper setting, applies to everyone."). Both notes come from `scripts/utils.js`.
- **Type:** `Boolean` (a tick box), `Number` with `range: { min, max, step }` (a slider), `String` with `choices: { value: "Label" }` (a drop-down; the saved value is the key), or a Foundry `DataField` such as `ColorField`.
- **Reload:** settings need a reload by default. If the part reads the value each time it's used, or applies it at once in `onChange`, set `requiresReload: false`.

## 2. Add it

In the part's `settings.js`, add the key to its section's `settings`, in the order it should appear:

```js
rollboxExample: {
  name: "Example",
  hint: "What it does, in one sentence.",
  scope: "user", type: Boolean, default: false, note: PERSONAL,
  requiresReload: false,
  onChange: (value) => applyExample(value)  // only if it applies at once
}
```

Add `reset: true` for a Reset button beside it (for appearance values people experiment with).

If the part has no `settings.js` yet, create one exporting a section `{ title, master, settings }`, with its master switch as the first setting (or another section's switch as `master`), and add the section to `SECTIONS` in `scripts/settings.js`.

## 3. Read it

Use `getSetting("rollboxExample")` from `scripts/utils.js` at the moment you need it, on the Keeper's client only (check `isKeeper()` first). Never read a world setting during `init`.

## 4. Test and document

- `tests/settings.test.mjs`: the registration order test and the per-setting test (scope, type, default, range, reload) list every setting, so add the new one there; a test in the part's own file for what the setting changes.
- `docs/TESTS.md`: rows for any test you added or renamed (pattern and name), under its file.
- The part's document, its `## Settings` section; [settings.md](../settings.md) if the page order changed; DEVELOPING.md's "Rollbox's sections" line; [guide/panel.md](../../guide/panel.md) if Keepers will look for it.
- A line in `CHANGELOG.md`.

## 5. Check

```
npm test -- tests/settings.test.mjs tests/docs-index.test.mjs
npm test
npm run release-check
```

In Foundry: the setting shows under its group's heading with its italic note, dims when the group's switch is off, and does what it says (at once, or after the reload Foundry asks for).
