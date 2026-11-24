# Recipe: add a flyout

A new button in the panel's menu that opens a flyout and sends a request. Read [AGENTS.md](../../AGENTS.md) first. The flyouts live in `scripts/flyouts/<name>/`, one folder per flyout and one file per tab; the Opposed roll (`scripts/flyouts/opposed/index.js`, [opposed-flyout.md](../opposed-flyout.md)) is a one-file flyout to copy from, and the Other flyout (`scripts/flyouts/other/`, [other-flyout.md](../other-flyout.md)) shows one with tabs. A new tab of an existing flyout (as Sanity is a tab of Check and Assist a tab of Other) needs no button: add a file to that flyout's folder instead, and follow steps 1, 2, 5 and 6.

## 1. Agree what it does

A new flyout changes what Rollbox does, so open an issue first and agree the design with the maintainer. Then write its section in [DESIGN.md](../DESIGN.md): what it shows, which selections offer it, whether players get it (Player Rollbox), what it sends, and which CoC7 link, method or card does the work. If CoC7 can't do it through its normal paths, the flyout doesn't get built (Rollbox stays in its lane).

## 2. Make the part

Create `scripts/flyouts/<name>/index.js` (one more file per tab beside it, as `flyouts/check/` has `characteristic.js`, `skill.js` and `sanity.js`). It starts with a short comment saying what the flyout does, ending "Layout and rules: design/<name>-flyout.md". It exports a `register…()` function and a render function:

```js
import { element } from "../../utils.js";
import { registerFlyout } from "../../panel/index.js";
import { canUse, panelHere } from "../../player/index.js";
import { checkRequest, send } from "../../roll-requests/index.js";
import { button, runSend, sendSection, showResult } from "../flyout.js";

/** ready: plug the flyout into the panel (the Keeper's, or a player's with the Player Rollbox on). */
export function registerExampleFlyout() {
  if (!panelHere()) return false; // no panel on this client: players with the Player Rollbox off read nothing else
  return registerFlyout("example", { title: "Example", render: renderExampleFlyout });
}

/** The menu host's render: builds the whole flyout for the selected characters. */
export function renderExampleFlyout(body, { actors = [], start, close, open, setTitle, selectionChanged } = {}) {
  if (!actors.length || !canUse("example")) return;
  // Build everything from scratch: the host calls this again when the selection changes.
}
```

- `registerFlyout(id, { title, render, staysOpen, columns })` refuses an id the menu host doesn't know (step 3). `staysOpen` keeps the flyout open while anything is selected, even when its button isn't offered (Opposed); `columns` sets the character cards' value columns while it is open (Other on Assist). The render gets the selected `actors`, a `start` state when it was opened from a click on the sheet or from another flyout, and `close`, `open(id, state)`, `setTitle(text)` and `cardChanged()`. A render that returns an object with `apply(start)` takes a new starting state while it is already open. See [panel.md](../panel.md) (`registerFlyout`) and [DEVELOPING.md](../DEVELOPING.md), "The panel and CSS" › "The menu host".
- Import other parts only through their `index.js`. Build the DOM with `element()` and `textContent`, never raw HTML.
- Use the flyout helpers in `scripts/flyouts/flyout.js` ([flyouts.md](../flyouts.md)): `sendSection` for the red status line, the buttons and the result; `runSend` for the click; `requestLabel` for the main button's words; `showResult` for "… sent to:". The value line, dice picker and status line come from `scripts/shared/index.js` ([shared.md](../shared.md)).
- Send only through `roll-requests/` (`checkRequest`, `sanityRequest`, `opposedRequest`, … then `send(request, actors, { mode })`; attacks, reloads and spells through `startAttack`, `reloadWeapon`, `castSpell`; [roll-requests.md](../roll-requests.md)). If you need a request it can't make, add it there, with its tests; a flyout never builds CoC7 link text itself. On a player's client `send()` routes what needs a GM through the Keeper's client by itself.
- Skills come from `skill-values/` (`checkChoices`, `findSkillRow`, …); never match skill names yourself.
- A setting of its own (a default, a Gameplay rule): [add-a-setting.md](add-a-setting.md).

## 3. Give it a button

In `scripts/panel/menu-host.js`:
- add the id to `MENUS` with its `label`, `title` and a Font Awesome 6 `icon` (Foundry ships Font Awesome 6);
- add it to `FIXED` (the buttons every selection has, at the bottom) or to `extrasFor(count)` (the extra buttons above them for some selections), in button order, as [DESIGN.md's "Panel" section](../DESIGN.md#panel) says.

If players get it, in `scripts/player/index.js`: a feature in `PLAYER_FEATURES` with its key in `FEATURE_KEYS` and its tick box in `SETTINGS` (the key starts `rollboxPlayer`, and is permanent), the id in `PLAYER_MENU` (the player's menu, in order) and in `MENU_FEATURES` with the features that offer it. Check `canUse("<feature>")` in the render for what a player may do. See [player.md](../player.md).

## 4. Wire it and style it

- `scripts/main.js`: import `register…()` and call it in the `ready` hook, after `registerPanel()` and before `registerCombat()`.
- `scripts/flyouts/<name>/<name>.css`: every rule under `.rollbox-panel`, classes `rollbox-…`, colours and sizes only from the panel's `--rollbox-…` variables, so the three themes and the Panel colour restyle it ([DEVELOPING.md](../DEVELOPING.md), "CSS: layers, scoping and variables"). If a CoC7 theme needs its own look for the flyout, add it in `scripts/panel/themes/art-deco.css` and `coc7-minimal.css`.
- `module.json`: add the CSS file to `styles`, after `scripts/shared/shared.css` and before the theme files (`scripts/panel/themes/…`), which stay last.

## 5. Test and document

- `tests/<name>-flyout.test.mjs`, using `makeEnv`, `makeCoC7`, `makeDom` and `makeRollActor` from `tests/mocks.mjs`: one test that `register…()` does nothing without a panel (a player with the Player Rollbox off, the switch off), and one per behaviour (what is sent for a given choice; the buttons greyed out while something is missing; what a player is allowed).
- `tests/panel.test.mjs`: the tests that list the buttons for one, two and three tokens need the new button; `tests/player.test.mjs` and `tests/player-panel.test.mjs` if players get it; `tests/settings.test.mjs` if you added a setting.
- `docs/TESTS.md`: a section for the new test file (its part, the command, one row per test with its pattern), and rows for any tests you added or renamed in other files.
- `docs/<name>-flyout.md` (the docs index test expects that name for each folder under `scripts/flyouts/`) in the format of the other part documents, ending with its "Tests" line; a line in [flyouts.md](../flyouts.md)'s table and in [main.md](../main.md); the registry in DEVELOPING.md if you used anything internal.
- `AGENTS.md`, "Find your way": add the new flyout to the list of flyouts (and a row if it needs its own).
- The user guide: a page `guide/<name>.md` (in the style of [action.md](../../guide/action.md)), linked from [guide/README.md](../../guide/README.md) and [for-keepers.md](../../guide/for-keepers.md) (and [for-players.md](../../guide/for-players.md) if players get it), and the README's feature list; its shortcuts in [shortcuts.md](../../guide/shortcuts.md) and its settings in [settings.md](../../guide/settings.md), if it has any.
- A line in `CHANGELOG.md`.

## 6. Check

```
npm test -- tests/<name>-flyout.test.mjs
npm test -- tests/docs-index.test.mjs
npm test
npm run release-check
```

`release-check` fails if the CSS or a script the flyout imports isn't in the zip. Then try it in Foundry (AGENTS.md, "Try a build in Foundry by hand"), as the Keeper and as a player, in each theme.
