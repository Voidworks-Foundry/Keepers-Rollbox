# Shared helpers (`scripts/utils.js`)

Constants and small helpers used by several parts. Imports nothing, so any part can import it without a cycle. The first five entries are the same as in `void-coc7-modules`; Rollbox's own helpers follow.

**Status key:** *Confirmed* only when the [Internal API registry](DEVELOPING.md#internal-api-registry) says so.

## Code

### `MODULE_ID`
`"keepers-rollbox"`. Used for settings, flags, the socket, log prefixes, form field names and template paths (Rollbox has no templates today). Never retype it; a test fails if another script writes it as a string. Changing it resets everyone's saved settings.

### `KEEPER`, `PERSONAL`
The two italic scope notes ("Keeper setting, applies to everyone." / "Personal setting, affects only your screen."). Kept here so the parts' `settings.js` files use them without importing `scripts/settings.js`.

### `escapeHtml(text)`
- **How it works:** Replaces `&`, `<`, `>`, `"` and `'` with HTML entities. `null` and `undefined` become an empty string.
- **Connects to:** `roll-requests/` (names in request messages and the Keeper's notes, labels), `flyouts/other/assist.js` (the Assist card), `combat/notice-cards.js` (the notice cards).
- **Could interact poorly with:** text that is already escaped would show its entities. Actor and token names are stored unescaped. **Assumed.**

### `getSetting(key)`
- **How it works:** `game.settings.get(MODULE_ID, key)`.
- **Connects to:** Foundry settings (`ClientSettings#get(namespace, key)`, unchanged in the v14 docs). Throws if the key isn't registered or called before `init` registration; callers run at `ready` or later, and the panel and shared controls read through a `try` that falls back to the default.
- **Could interact poorly with:** reading world settings before they load (not done). **Assumed.**

### `declareSettings(list)`, `option(key)`
- **How it works:** `declareSettings(list)` records a part's planned settings (`{ key, scope, type, default, section, label, note }`, plus `hint`, `choices` or `range` as Foundry takes them) and returns the list frozen; parts export it as `SETTINGS` for `settings.js` to register once they go live. `option(key)` returns the setting's value through `game.settings.get`, or, when Foundry throws because it isn't registered, its declared default (`undefined` when it is neither registered nor declared). A part can so read its setting even when it runs before `settings.js` has registered it (a test, or a load-order surprise).
- **Connects to:** the `SETTINGS` lists in `flyouts/check/index.js`, `player/index.js`, `combat/encounter.js`, `combat/readied-firearms.js`, `combat/notice-cards.js`, `flyouts/action/attack.js`; `settings.js` registers them all ([settings.md](settings.md)). `option()` is how those parts, and the flyouts and roll-requests that read them, get the values.
- **Could interact poorly with:** nothing: it uses only Foundry's public `game.settings.get`. **Confirmed** by tests only.

### `isKeeper()`
- **How it works:** `game.user?.isGM === true`. False while there is no user yet, so a call that comes too early does nothing instead of throwing.
- **Connects to:** `User#isGM` (v14 docs: "Test whether the User has a GAMEMASTER or ASSISTANT role"). Used by every part that decides whether it runs on this client: the panel, the flyouts, combat, the alert, roll-requests (Keeper or relay), `settings.js` and `player/`. A player's client runs Rollbox only with the Player Rollbox on (`player/` `panelHere()`, [player.md](player.md)).
- **Could interact poorly with:** Assistant GMs count as Keepers, so they would see the panel too. **Assumed** (from the v14 docs; not tested with an Assistant).

### `isActiveKeeper()`
- **How it works:** True only on the one Keeper's client that carries out Rollbox's gameplay: `isKeeper()` first, then Foundry's `game.users.activeGM` is this user (`isSelf`, or the same id); with no active GM known, any Keeper. A throw reads as false. So two GMs logged in never do the same write or roll twice.
- **Connects to:** Foundry's `game.users.activeGM` (public). Used by combat's gameplay hooks (round change, encounter end, mid-round pick, [combat.md](combat.md)), the Keeper relay's answering side ([roll-requests.md](roll-requests.md)) and the alert's Under cover after a dive ([alert-flyout.md](alert-flyout.md)).
- **Could interact poorly with:** an Assistant GM who is Foundry's active GM carries out the gameplay. **Assumed.**

### `flagsRemoved(...keys)`
- **How it works:** the update keys that remove these Rollbox flags, for an update that also changes other fields: `{ "flags.keepers-rollbox.<key>": new ForcedDeletion() }` with Foundry v14's `foundry.data.operators.ForcedDeletion` (what `unsetFlag` sends). Where Foundry has no such operator (the unit tests), the older `{ "flags.keepers-rollbox.-=<key>": null }`, which v14 still reads but deprecates until v16.
- **Connects to:** Foundry's `foundry.data.operators` (public). Used by combat (`fight-changes.js`: standing by cleared), roll-requests (`maneuver.js`: Maneuver back on) and setup (`scan.js`: Maneuver back on).
- **Could interact poorly with:** a module reading Rollbox's update data for a `-=` key: it sees the key with a `ForcedDeletion` value instead. **Assumed**; seen in e2e.

### Rollbox's own helpers: `COC7_ID`, `element`, `NO_VALUE`, `numberOrNull`, `warn`, `tellKeeper`, `sameActor`, `actorKey`, `uniqueActors`
Helpers more than one part needs, written once so every part uses one version.
- **`COC7_ID`:** `"CoC7"`, CoC7's system id and the namespace of its flags and settings. Used by `skill-values/`, `roll-requests/`, `combat/readied-firearms.js`, the Action flyout's spells, the alert and `panel/themes/coc7.js` (CoC7's image paths).
- **`element(tag, className, text)`:** a new element with classes and optional text, set with `textContent`, so names typed by anyone never become HTML. Used by every part that draws (character sheet, flyouts, shared controls). A button, input, select or text area it makes gets `tabIndex = -1`: Rollbox takes no keys from the page, so Tab never stops on the panel; a click still focuses a text box, which takes typing.
- **`NO_VALUE`:** "—", shown for a value the sheet doesn't have. Used by the character sheet and character cards, `flyouts/flyout.js`'s `levels()` and the flyouts.
- **`numberOrNull(value)`:** a finite number from a stored value; `null`, `undefined`, `""` and anything not a finite number give `null`. Used by `skill-values/`, `roll-requests/`, `panel/sheet.js`, the Action flyout and the alert.
- **`warn(text, ...details)`:** `console.warn` with the `keepers-rollbox |` prefix, for a problem the Keeper doesn't need on screen (CoC7's API missing, a request refused, a flyout that failed to draw); extra details, such as the error caught, are logged after the text. The one way Rollbox logs: every part uses it.
- **`tellKeeper(text)`:** `ui.notifications.warn(text)`, guarded, on this screen only (a player's own screen when it runs on their client). Used by `roll-requests/`, the panel (Opposed couldn't open, "select <name> to roll for them"), `combat/notice-cards.js` and the alert.
- **`sameActor(a, b)`:** whether two actors are the same character: the same object, or the same `uuid` (a token's actor made again). False when either is missing. Used by the panel (a shown character's update, the menu host's selection change).
- **`actorKey(actor)`:** how a flyout tells characters apart: `uuid`, else `id`, else `name`. Used by the Check, Opposed and Other flyouts (the group Luck pick, Assist's left-out and marked characters) and `roll-requests/requests.js`.
- **`uniqueActors(actors)`:** each actor once, in order, by `uuid` (else the same object), with empty entries left out. Used by `send()`, the panel's selection, Assist and `combat/notice-cards.js`, so they all count characters the same way (two tokens of one linked actor once).
- **Connects to:** Foundry `ui.notifications` (`tellKeeper`), `document` (`element`). **Could interact poorly with:** nothing known. **Assumed.**

### Characters and uuids: `dotted`, `actorFromUuid`, `plays`, `itemsOf`, `glyph`
Written once so every part reads them the same way.
- **`dotted(uuid)`:** the uuid with dots for slashes (`Actor/abc` → `Actor.abc`), so uuids compare: CoC7 stores some with slashes. Used wherever a card's or a flag's uuid is compared (roll-requests' card buttons and maneuvers, the alert, combat's notices, dying and About to attack, Assist).
- **`actorFromUuid(uuid)`:** the character a uuid names, without waiting (Foundry's `fromUuidSync`, guarded): an actor itself, a token's actor (null for a token without one), the actor of anything else that has one (an item's owner), or else the document found itself; null for nothing, a falsy uuid or a lookup that throws. Used by the relay, maneuvers, combat's relays, notices, situation and About to attack, the alert and Assist.
- **`plays(actor, user)`:** whether the user owns the character by Foundry's permission (`Document#testUserPermission(user, "OWNER")`, guarded). The combat relays (`fight.js`, `fight-relay.js`, `notice-cards.js`, `about-to-attack.js`), roll-requests (`attack.js`, the attack toggles' relay `keeperTicks`) and End turn (`turn-controls.js`, with the Keeper always allowed). Who plays a character by CoC7's owners is roll-requests' `playsFor`.
- **`itemsOf(actor)`:** the character's items as a list, guarded (empty for none). roll-requests' `unarmed.js` and `maneuver.js`.
- **`glyph(icon)`:** a Font Awesome glyph (`<i class="fa-solid <icon>" aria-hidden="true">`) for a button whose words are its label or text. The panel's buttons (`panel/index.js`, `menu-host.js`, `sheet.js`, `status-cards.js`), shared's `glyphButton` and the player's Assist view.
- **Connects to:** Foundry's `fromUuidSync` and `Document#testUserPermission` (public). **Could interact poorly with:** nothing known. **Assumed.**

## Hooks, overrides, keybindings
None.

## Tests

`tests/utils.test.mjs`: find the test you need in [TESTS.md, utils.test.mjs](TESTS.md#utilstestmjs) and run only that.
