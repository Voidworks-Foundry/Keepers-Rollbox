# Entry point (`scripts/main.js`)

The module's only entry point (`esmodules` in `module.json`). It holds wiring only: no feature logic. Settings register during `init`; the Keeper's panel and its menus start at `ready`, because they need the users, the canvas and the players list.

**Status key:** *Confirmed* only when the build guide's Internal API registry or changelog says so. Lifecycle ordering here follows the build guide's Lifecycle table, which doesn't mark individual rows as confirmed, so those are **assumed** unless stated.

## Code

### `Hooks.once("init", …)`
- **How it works:** Calls `registerSettings()`. Settings must register at `init`.
- **Connects to:** `settings.js`.
- **Could interact poorly with:** nothing known. Reading world settings here would fail (not loaded yet), so none is read.

### `Hooks.on("renderSettingsConfig", decorateSettingsConfig)`
- **How it works:** Each time the settings page renders, adds the scope note, the section heading and dimming.
- **Connects to:** `settings.js` (`decorateSettingsConfig`).
- **Could interact poorly with:** other modules that restyle or reshuffle the settings page; Foundry changing the form markup (`.form-group`, `.hint`) or passing an `html` that isn't an `HTMLElement` (the function then does nothing). In v14 `SettingsConfig` is an ApplicationV2 (through `CategoryBrowser`), per the v14 API docs; the hook's exact arguments weren't on the pages read. The same hook and handler work in `void-coc7-modules` 1.0.10 on v14. **Assumed** for Rollbox until Void sees the heading.

### `Hooks.once("ready", …)`
- **How it works:** Calls `registerMiniSheet()`, then `registerCheckMenu()`, `registerSanityMenu()`, `registerOtherMenu()`, `registerOpposedRoll()` and `registerAssist()`; each does nothing unless this user is the Keeper and the Rollbox switch is on. The panel registers first, so the menus have a host to plug into. `roll-requests/` installs nothing at `ready`: it works only when a menu sends.
- **Connects to:** `mini-sheet/index.js`, `check-menu/index.js`, `sanity-menu/index.js`, `other-menu/index.js`, `opposed-roll/index.js`, `assist/index.js`.
- **Could interact poorly with:** nothing itself; the parts' interactions are in `docs/mini-sheet.md`, `docs/check-menu.md`, `docs/sanity-menu.md`, `docs/other-menu.md`, `docs/opposed-roll.md` and `docs/assist.md`. **Assumed.**

## Hooks, overrides, keybindings
- Hooks: `init` (once), `renderSettingsConfig`, `ready` (once).
- Class overrides: none.
- Keybindings: none.

## Tests

`tests/mini-sheet.test.mjs` (the tests named `main.js calls…`, `player: does nothing…` and `Keeper with the switch off…`): find the test you need in [TESTS.md, mini-sheet.test.mjs](TESTS.md#mini-sheettestmjs) and run only that.
