# Entry point (`scripts/main.js`)

The module's only entry point (`esmodules` in `module.json`). It holds wiring only: no feature logic. Settings register during `init`; the Keeper relay, the panel, its flyouts, combat, the being-attacked alert and the setup check start at `ready`, because they need the users, the canvas and the players list. Each part decides there whether it runs on this client (the Keeper's, or a player's with the Player Rollbox on); `main.js` itself checks nothing.

**Status key:** *Confirmed* only when the [Internal API registry](DEVELOPING.md#internal-api-registry) says so. Lifecycle ordering here follows [DEVELOPING.md, "Lifecycle: which hook does what"](DEVELOPING.md#lifecycle-which-hook-does-what), which doesn't mark individual rows as confirmed, so those are **assumed** unless stated.

## Code

### `Hooks.once("init", …)`
- **How it works:** Calls `registerSettings()` (which also registers the Setup check section's Check now menu). Settings must register at `init`.
- **Connects to:** `settings.js` ([settings.md](settings.md)).
- **Could interact poorly with:** nothing known. Reading world settings here would fail (not loaded yet), so none is read.

### `Hooks.on("renderSettingsConfig", decorateSettingsConfig)`
- **How it works:** Each time the settings page renders, lays out Rollbox's part of it: the scope notes, the feature switches in a box on top, each section in its own box, greyed while its feature is off.
- **Connects to:** `settings.js` (`decorateSettingsConfig`; on a player's client with the Player Rollbox off it hides Rollbox's settings instead).
- **Could interact poorly with:** other modules that restyle or reshuffle the settings page; Foundry changing the form markup (`.form-group`, `.hint`) or passing an `html` that isn't an `HTMLElement` (the function then does nothing). In v14 `SettingsConfig` is an ApplicationV2 (through `CategoryBrowser`), per the v14 API docs; the hook's exact arguments weren't on the pages read. The same hook and handler work in `void-coc7-modules` 1.0.10 on v14. **Assumed** for Rollbox until the heading is seen at the table.

### `Hooks.once("ready", …)`
- **How it works:** Starts each part through `start(name, register)`, which calls it inside `try`: a part that throws is reported with one `warn` ("<name> couldn't start.") and counts as not started (`false`), so the parts after it still start. In order: `registerKeeperRelay()` (Rollbox's socket: the Keeper's client always, a player's with the Player Rollbox on), `registerAssistGroups()` (`flyouts/other`: on the Keeper's client, the relay types `assistJoin` and `assistLeave` for players joining an assist group, and the rollers' cards that clear a sent group, even with the Keeper's panel off; [assist.md](assist.md)), `registerPanel()`, then `registerActionFlyout()`, `registerCheckFlyout()`, `registerOtherFlyout()`, `registerOpposedRoll()`, `registerCombat()`, then, when the panel was set up, `setAlertHost(alertSlot)` (also through `start`) (a player's alert goes beside their menu), `registerBeingAttacked()`, and `registerSetupCheck()` (`setup/`: the Keeper's client only, panel or not; its check runs a few seconds later, [setup.md](setup.md)). The panel and the flyouts run where `player/` `panelHere()` says: the Keeper's client with the Rollbox switch on, or a player's with the Player Rollbox and their own switch on. Combat's gameplay rules run on the Keeper's client whatever the panel switch, its turn order where a panel is; it comes after the panel because it draws into it (`setPanelContent`). The being-attacked alert runs only with the Player Rollbox switch on, and on a player's client only with their own panel switch on (there it watches CoC7's attack cards; on the Keeper's it ticks Under cover after a dive). Sanity is a tab of Check and Assist a tab of Other, so neither registers on its own.
- **Connects to:** `utils.js` (`warn`); `roll-requests/index.js`, `panel/index.js`, `flyouts/action/index.js`, `flyouts/check/index.js`, `flyouts/other/index.js`, `flyouts/opposed/index.js`, `combat/index.js`, `flyouts/alert/index.js`, `setup/index.js`.
- **Could interact poorly with:** nothing itself; the parts' interactions are in [roll-requests.md](roll-requests.md), [panel.md](panel.md), [action-flyout.md](action-flyout.md), [check-flyout.md](check-flyout.md), [other-flyout.md](other-flyout.md), [opposed-flyout.md](opposed-flyout.md), [combat.md](combat.md), [alert-flyout.md](alert-flyout.md) and [setup.md](setup.md). **Assumed.**

## Hooks, overrides, keybindings
- Hooks: `init` (once), `renderSettingsConfig`, `ready` (once).
- Class overrides: none.
- Keybindings: none.

## Tests

`tests/panel.test.mjs` (the tests named `main.js calls…`, `main.js: a part that throws…`, `player, player Rollbox off…` and `Keeper with the switch off…`): find the test you need in [TESTS.md, panel.test.mjs](TESTS.md#paneltestmjs) and run only that.
