# Recipe: add a menu

A new button beside the Keeper's panel that opens a menu and sends a request. Read [AGENTS.md](../../AGENTS.md) first; the Sanity menu (`scripts/sanity-menu/`, [sanity-menu.md](../sanity-menu.md)) is the smallest example to copy from.

## 1. Agree what it does

A new menu changes what Rollbox does, so open an issue first and agree the design with the maintainer. Then write its section in [DESIGN.md](../DESIGN.md): what it shows, which selections offer it, what it sends, and which CoC7 link or card does the work. If CoC7 can't do it through its normal paths, the menu doesn't get built (Rollbox stays in its lane).

## 2. Make the part

Create `scripts/<name>-menu/index.js`. It starts with a short comment saying what the menu does for the Keeper, ending "Layout and rules: DESIGN.md, '<section>'". It exports a `register…()` function and a render function:

```js
import { getSetting, isKeeper } from "../utils.js";
import { registerMenu } from "../mini-sheet/index.js";
import { send } from "../roll-requests/index.js";
import { button, runSend, sendSection, showResult } from "../shared/index.js";

export function registerExampleMenu() {
  if (!isKeeper() || !getSetting("rollboxEnabled")) return false; // the Keeper first: players never read the setting
  return registerMenu("example", { title: "Example", render: renderExampleMenu });
}

export function renderExampleMenu(body, { actors = [] } = {}) {
  if (!actors.length) return;
  // Build everything from scratch: the host calls this again when the selection changes.
}
```

- Import other parts only through their `index.js`. Build the DOM with `element()` and `textContent`, never raw HTML.
- Use the shared controls in `scripts/shared/` ([shared.md](../shared.md)): `sendSection` for the red status line, the buttons and the result; `runSend` for the click; `showResult` for "… sent to:".
- Send only through `roll-requests/` (`checkRequest`, `sanityRequest`, … then `send(request, actors, { mode })`, [roll-requests.md](../roll-requests.md)). If you need a request it can't make, add it there, with its tests; a menu never builds CoC7 link text itself.
- Skills come from `skill-values/` (`checkChoices`, `findSkillRow`, …); never match skill names yourself.

## 3. Give it a button

In `scripts/mini-sheet/menu-host.js`:
- add the id to `MENUS` with its `label`, `title` and a Font Awesome 6 `icon` (Foundry ships Font Awesome 6);
- add it to `menusFor(count)` for the selections that offer it, in button order, as DESIGN.md's "Layout by number of tokens selected" says;
- add the id to `registerMenu`'s JSDoc.

Options for `registerMenu` (`layout: "replace"`, `staysOpen`, `columns`) are described in [DEVELOPING.md](../DEVELOPING.md), "The menu host".

## 4. Wire it and style it

- `scripts/main.js`: import `register…()` and call it in the `ready` hook, after `registerMiniSheet()`.
- `scripts/<name>-menu/<name>-menu.css`: every rule under `.rollbox-panel`, classes `rollbox-…`, colours and sizes only from the panel's `--rollbox-…` variables (both themes then work).
- `module.json`: add the CSS file to `styles`, after `scripts/shared/shared.css`.

## 5. Test and document

- `tests/<name>-menu.test.mjs`, using `makeEnv`, `makeCoC7`, `makeDom` and `makeRollActor` from `tests/mocks.mjs`: one test that `register…()` does nothing for a player or with the switch off, and one per behaviour (what is sent for a given choice; the buttons greyed out while something is missing).
- `tests/mini-sheet.test.mjs`: the tests that list the buttons for one, two and three tokens need the new button.
- `docs/TESTS.md`: a section for the new test file (its part, the command, one row per test with its pattern), and rows for any tests you added or renamed in `mini-sheet.test.mjs`.
- `AGENTS.md`, "Find your way": add the new part to the list of menu parts (and a row if it needs its own).
- `docs/<name>-menu.md` in the format of the other part documents, ending with its "Tests" line; a line in [main.md](../main.md); the registry in DEVELOPING.md if you used anything internal.
- `guide/<name>.md` for Keepers, linked from `guide/README.md` and the README's feature list.
- A line in `CHANGELOG.md`.

## 6. Check

```
npm test -- tests/<name>-menu.test.mjs
npm test -- tests/docs-index.test.mjs
npm test
npm run release-check
```

`release-check` fails if the CSS or a script the menu imports isn't in the zip. Then try it in Foundry (AGENTS.md, "Try a build in Foundry by hand"), as the Keeper and as a player.
