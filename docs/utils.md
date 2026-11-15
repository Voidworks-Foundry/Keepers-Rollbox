# Shared helpers (`scripts/utils.js`)

Constants and small helpers used by several parts. Imports nothing, so any part can import it without a cycle. The first five entries are the same as in `void-coc7-modules`; Rollbox's own helpers follow.

**Status key:** *Confirmed* only when the build guide's Internal API registry or changelog says so.

## Code

### `MODULE_ID`
`"keepers-rollbox"`. Used for settings, log prefixes, form field names and (later) template paths. Never retype it; a test fails if another script writes it as a string. Changing it resets everyone's saved settings.

### `KEEPER`, `PERSONAL`
The two italic scope notes ("Keeper setting, applies to everyone." / "Personal setting, affects only your screen."). Kept here so the parts' `settings.js` files use them without importing `scripts/settings.js`.

### `escapeHtml(text)`
- **How it works:** Replaces `&`, `<`, `>`, `"` and `'` with HTML entities. `null` and `undefined` become an empty string.
- **Connects to:** `roll-requests/` (names in request messages and the Keeper's notes, labels), `assist/` (the Assist card).
- **Could interact poorly with:** text that is already escaped would show its entities. Actor and token names are stored unescaped. **Assumed.**

### `getSetting(key)`
- **How it works:** `game.settings.get(MODULE_ID, key)`.
- **Connects to:** Foundry settings (`ClientSettings#get(namespace, key)`, unchanged in the v14 docs). Throws if the key isn't registered or called before `init` registration; callers run at `ready` or later.
- **Could interact poorly with:** reading world settings before they load (not done). **Assumed.**

### `isKeeper()`
- **How it works:** `game.user?.isGM === true`. False while there is no user yet, so a call that comes too early does nothing instead of throwing.
- **Connects to:** `User#isGM` (v14 docs: "Test whether the User has a GAMEMASTER or ASSISTANT role"). Used by `registerMiniSheet()`; every later hook and element checks it first.
- **Could interact poorly with:** Assistant GMs count as Keepers, so they would see the panel too. **Assumed** (from the v14 docs; not tested with an Assistant).

### Rollbox's own helpers: `COC7_ID`, `element`, `NO_VALUE`, `numberOrNull`, `warn`, `tellKeeper`, `actorKey`, `uniqueActors`
Helpers more than one part needs, written once so every part uses one version.
- **`COC7_ID`:** `"CoC7"`, CoC7's system id and the namespace of its flags and settings. Used by `skill-values/` and `roll-requests/` (`coc7.js`, `resolve.js`, `card-buttons.js`).
- **`element(tag, className, text)`:** a new element with classes and optional text, set with `textContent`, so names typed by anyone never become HTML. Used by every part that draws (mini sheet, menus, shared controls).
- **`NO_VALUE`:** "—", shown for a value the sheet doesn't have. Used by the mini sheet and names card, `shared/menu.js`'s `levels()` and the menus.
- **`numberOrNull(value)`:** a finite number from a stored value; `null`, `undefined`, `""` and anything not a finite number give `null`. Used by `skill-values/`, `roll-requests/` and `mini-sheet/cards.js`.
- **`warn(text, ...details)`:** `console.warn` with the `keepers-rollbox |` prefix, for a problem the Keeper doesn't need on screen (CoC7's API missing, a request refused, a menu that failed to draw); extra details, such as the error caught, are logged after the text. The one way Rollbox logs: used by `roll-requests/`, `mini-sheet/` (the panel, the menu host, the cards), `shared/menu.js` (`runSend`) and the Item menu.
- **`tellKeeper(text)`:** `ui.notifications.warn(text)`, guarded, on this screen only. Used by `roll-requests/`.
- **`actorKey(actor)`:** how a menu tells characters apart: `uuid`, else `id`, else `name`. Used by the Check menu (group Luck pick) and Assist (who is left out or marked).
- **`uniqueActors(actors)`:** each actor once, in order, by `uuid` (else the same object), with empty entries left out. Used by `send()` and the panel's selection, so the panel and the requests count characters the same way (two tokens of one linked actor once).
- **Connects to:** Foundry `ui.notifications` (`tellKeeper`), `document` (`element`). **Could interact poorly with:** nothing known. **Assumed.**

## Hooks, overrides, keybindings
None.

## Tests

`tests/utils.test.mjs`: find the test you need in [TESTS.md, utils.test.mjs](TESTS.md#utilstestmjs) and run only that.
