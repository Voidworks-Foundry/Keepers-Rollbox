# AGENTS.md — working on Keeper's Rollbox

Instructions for AI coding agents and for people. This file is the one source of truth. If your AI tool expects a different file name, rename or copy this file to that name.

## What this is

Keeper's Rollbox is a Foundry VTT 14 module (checked on build 370) for the Call of Cthulhu 7th Edition (CoC7) system, version 8.15. It gives the Keeper a small panel beside the players list for the selected tokens (with nothing selected, the players' investigators), with a menu of three flyouts: Action (attacks, maneuvers and spells through CoC7's own attack cards and Cast), Check (characteristics, skills, combined checks, Sanity) and Other (items, Luck, Assist), plus Opposed rolls with two selected. It sends CoC7's own roll requests and cards; CoC7 does all the rolling and judging. It also shows the turn order in combat, status cards, and a Player Rollbox on each player's screen (on by default; the Keeper can turn it off) for their own investigator.

## Find your way

**Read only what your row lists; don't read every document or test.** Section names are `##` / `###` headings in that file; each long document starts with a linked contents list. Tests: find them in [docs/TESTS.md](docs/TESTS.md) under the file named, and run only the ones that cover your change.

The flyouts live under `scripts/flyouts/`, one folder per flyout and one file per tab: `scripts/flyouts/action/` (Action: `attack.js`, `maneuver.js`, `prompt.js`, `spell.js` with `casting-time.js` and `spell-text.js`, the target box `target.js`, `weapons.js`), `scripts/flyouts/check/` (Check: `characteristic.js`, `skill.js`, and `sanity.js`, the Sanity tab), `scripts/flyouts/other/` (Other: `item.js`, `luck.js`, and `assist.js`, the Assist tab, with `assist-group.js` and `player-assist.js` for a player's Assist), `scripts/flyouts/opposed/` (Opposed) and `scripts/flyouts/alert/` (the being-attacked alert). Their documents are [docs/action-flyout.md](docs/action-flyout.md), [docs/check-flyout.md](docs/check-flyout.md), [docs/sanity-flyout.md](docs/sanity-flyout.md), [docs/other-flyout.md](docs/other-flyout.md), [docs/assist.md](docs/assist.md), [docs/opposed-flyout.md](docs/opposed-flyout.md) and [docs/alert-flyout.md](docs/alert-flyout.md); helpers every flyout uses are in [docs/flyouts.md](docs/flyouts.md). `scripts/combat/` (combat in the panel), `scripts/status/` (status effects), `scripts/player/` (the Player Rollbox) and `scripts/setup/` (the Keeper's setup check) have [docs/combat.md](docs/combat.md), [docs/status.md](docs/status.md), [docs/player.md](docs/player.md) and [docs/setup.md](docs/setup.md). For any other part, `docs/<part>.md` is its document.

| Task | Read | Tests ([docs/TESTS.md](docs/TESTS.md)) |
| --- | --- | --- |
| Fix a bug in a flyout | `docs/<part>.md` for that flyout; [docs/DESIGN.md](docs/DESIGN.md) that flyout's section; [docs/shared.md](docs/shared.md) if it's a shared control (value line, dice picker, Blind, send section, result) | [`<part>.test.mjs`](docs/TESTS.md) (Check's Sanity tab: [sanity-flyout.test.mjs](docs/TESTS.md#sanity-flyouttestmjs)); [shared.test.mjs](docs/TESTS.md#sharedtestmjs) for shared controls |
| Change a flyout's layout or wording | `docs/<part>.md`; [docs/DESIGN.md](docs/DESIGN.md) "Flyouts" and the flyout's section (a change to what Rollbox does needs the maintainer's agreement first); [docs/shared.md](docs/shared.md); [docs/DEVELOPING.md](docs/DEVELOPING.md) "The panel and CSS" › "CSS: layers, scoping and variables" | [`<part>.test.mjs`](docs/TESTS.md) |
| Add a flyout | [docs/recipes/add-a-flyout.md](docs/recipes/add-a-flyout.md); [docs/panel.md](docs/panel.md) (`registerFlyout`); [docs/shared.md](docs/shared.md); [docs/roll-requests.md](docs/roll-requests.md); [docs/DEVELOPING.md](docs/DEVELOPING.md) "The panel and CSS" › "The menu host"; [docs/DESIGN.md](docs/DESIGN.md) "Panel" | [panel.test.mjs](docs/TESTS.md#paneltestmjs) (`menu host`, `1 token: character`, `2 tokens`, `3 or more`, `Opposed is a`); your new file |
| Add or change a setting | [docs/recipes/add-a-setting.md](docs/recipes/add-a-setting.md); [docs/settings.md](docs/settings.md); the part's document; [docs/DEVELOPING.md](docs/DEVELOPING.md) "Settings" | [settings.test.mjs](docs/TESTS.md#settingstestmjs); the part's file for what the setting changes |
| Change how a roll request or card is built (links, whispers, NPC rolls, Sanity or opposed cards) | [docs/roll-requests.md](docs/roll-requests.md); [docs/DEVELOPING.md](docs/DEVELOPING.md) "CoC7 links and options", "Cards", "Rolling NPCs", "Internal API registry"; [docs/DESIGN.md](docs/DESIGN.md) "Flyouts" › "Sending and who rolls" | [roll-requests.test.mjs](docs/TESTS.md#roll-requeststestmjs) |
| Skill names, skill lists, base values | [docs/skill-values.md](docs/skill-values.md); [docs/DEVELOPING.md](docs/DEVELOPING.md) "Skills and weapons", "Rules and units" | [skill-values.test.mjs](docs/TESTS.md#skill-valuestestmjs) |
| Weapons and improvised damage, or Luck checks and the Group Luck roll | [docs/other-flyout.md](docs/other-flyout.md); [docs/roll-requests.md](docs/roll-requests.md); [docs/DEVELOPING.md](docs/DEVELOPING.md) "Skills and weapons" › "A weapon's skill"; [docs/DESIGN.md](docs/DESIGN.md) "Other flyout" | [other-flyout.test.mjs](docs/TESTS.md#other-flyouttestmjs); [roll-requests.test.mjs](docs/TESTS.md#roll-requeststestmjs) (`weapon:`, `improvised:`) |
| Opposed rolls | [docs/opposed-flyout.md](docs/opposed-flyout.md); [docs/DEVELOPING.md](docs/DEVELOPING.md) "Cards" › "Opposed", "Gaps" (7 and 8); [docs/DESIGN.md](docs/DESIGN.md) "Opposed roll" | [opposed-flyout.test.mjs](docs/TESTS.md#opposed-flyouttestmjs); [roll-requests.test.mjs](docs/TESTS.md#roll-requeststestmjs) (`opposed:`) |
| Assist maths (who helps, who rolls, difficulty) | [docs/assist.md](docs/assist.md) (`scripts/flyouts/other/assist-split.js`); [docs/DEVELOPING.md](docs/DEVELOPING.md) "Rules and units"; [docs/DESIGN.md](docs/DESIGN.md) "Assist" | [assist.test.mjs](docs/TESTS.md#assisttestmjs) (`difficultyFor`, `assistChoices`) |
| The panel, theme, colour, size, layer, auto-hide or CSS | [docs/panel.md](docs/panel.md); [docs/shared.md](docs/shared.md); [docs/DEVELOPING.md](docs/DEVELOPING.md) "The panel and CSS"; [docs/DESIGN.md](docs/DESIGN.md) "Panel", "Themes", "Settings" | [panel.test.mjs](docs/TESTS.md#paneltestmjs) (`Panel layer` for the layer); [panel-layer.test.mjs](docs/TESTS.md#panel-layertestmjs) (Top when active or selected); [shared.test.mjs](docs/TESTS.md#sharedtestmjs) |
| Clicks and shortcuts on the character sheet's values, Opposed from a right click | [docs/panel.md](docs/panel.md) "Clicks on the character sheet's values"; [docs/check-flyout.md](docs/check-flyout.md) and [docs/other-flyout.md](docs/other-flyout.md) (`apply`); [docs/opposed-flyout.md](docs/opposed-flyout.md) (`start`); [docs/DESIGN.md](docs/DESIGN.md) "Panel" › "The character sheet's values" | [panel.test.mjs](docs/TESTS.md#paneltestmjs) (`character sheet values`, `a left click`, `shortcuts, as on`, `right click: no`, `Shift . Left on`, `two-character sheet: a`); [check-flyout.test.mjs](docs/TESTS.md#check-flyouttestmjs) (`started from the character sheet`) |
| Start-up, hooks, Keeper-only checks, helpers | [docs/main.md](docs/main.md); [docs/utils.md](docs/utils.md); [docs/DEVELOPING.md](docs/DEVELOPING.md) "Lifecycle: which hook does what", "Multiplayer" | [panel.test.mjs](docs/TESTS.md#paneltestmjs) (`main.js calls`, `player, player Rollbox`); [utils.test.mjs](docs/TESTS.md#utilstestmjs) |
| Combat, status effects, the Player Rollbox, the Action flyout, the flyout alert | That part's document ([docs/combat.md](docs/combat.md), [docs/status.md](docs/status.md), [docs/player.md](docs/player.md), [docs/action-flyout.md](docs/action-flyout.md), [docs/alert-flyout.md](docs/alert-flyout.md)); [docs/panel.md](docs/panel.md) (`setPanelContent`, `statusCards`); [docs/utils.md](docs/utils.md) (`option`, `declareSettings`); [docs/settings.md](docs/settings.md); [docs/DEVELOPING.md](docs/DEVELOPING.md) "Combat, statuses and players" | [combat.test.mjs](docs/TESTS.md#combattestmjs), [status.test.mjs](docs/TESTS.md#statustestmjs), [player.test.mjs](docs/TESTS.md#playertestmjs), [player-panel.test.mjs](docs/TESTS.md#player-paneltestmjs), [action.test.mjs](docs/TESTS.md#actiontestmjs), [action-card.test.mjs](docs/TESTS.md#action-cardtestmjs), [alert.test.mjs](docs/TESTS.md#alerttestmjs); [panel.test.mjs](docs/TESTS.md#paneltestmjs) (`setPanelContent`) |
| A new CoC7 or Foundry version | [docs/recipes/new-coc7-version.md](docs/recipes/new-coc7-version.md); [docs/DEVELOPING.md](docs/DEVELOPING.md) "CoC7 integration", "Internal API registry", "Gaps" | `npm test` (all), then the Foundry check in the recipe |
| Release, or the release tools | [docs/recipes/make-a-release.md](docs/recipes/make-a-release.md); [docs/release-tools.md](docs/release-tools.md); [docs/DEVELOPING.md](docs/DEVELOPING.md) "Release checklist" | [release-tools.test.mjs](docs/TESTS.md#release-toolstestmjs) if the tools change; `npm test` and `npm run release-check` for a release |
| User guide or README wording | [guide/README.md](guide/README.md) (the guide's index) and the page for the feature: [getting-started.md](guide/getting-started.md), [for-keepers.md](guide/for-keepers.md), [for-players.md](guide/for-players.md), [action.md](guide/action.md), [check.md](guide/check.md), [other.md](guide/other.md), [opposed.md](guide/opposed.md), [statuses-and-alerts.md](guide/statuses-and-alerts.md), [shortcuts.md](guide/shortcuts.md), [appearance.md](guide/appearance.md), [settings.md](guide/settings.md); [README.md](README.md). What the module does is in [docs/DESIGN.md](docs/DESIGN.md) | none; check the links and picture names still work (the pictures are in the media folder, which isn't in git) |
| The e2e check in Foundry, or the README and guide captures | [docs/DEVELOPING.md](docs/DEVELOPING.md) "Testing" › "The e2e check (development repository)", "Captures". Both tools live in the maintainer's development project, not in this repository | the e2e check itself |

A task that fits no row: read the part's document for the code you'll change and its entry in [docs/TESTS.md](docs/TESTS.md), and search the contents lists of [docs/DEVELOPING.md](docs/DEVELOPING.md) and [docs/DESIGN.md](docs/DESIGN.md) for the topic.

## Map of the repository

| Path | What it holds |
| --- | --- |
| `module.json` | Foundry's manifest: id `keepers-rollbox`, version, Foundry 14 and CoC7 8.15 compatibility, `scripts/main.js`, the CSS files, `"socket": true` |
| `scripts/main.js` | Wiring only: settings at `init`, each part's `register…()` at `ready` |
| `scripts/settings.js`, `scripts/utils.js` | The settings machinery: the feature switches on top and their sections; small helpers every part uses (`MODULE_ID`, `isKeeper`, `getSetting`, `option`, `declareSettings`, `element`, `warn`, …) |
| `scripts/<part>/` | One folder per part, each with an `index.js` (its public surface) and its CSS: `skill-values` (skills, base values, the only skill-name matching), `roll-requests` (builds and sends CoC7 requests, CoC7's attack cards and Cast, the Keeper relay for players' clients; the only code that talks to CoC7's rolls), `panel` (the panel, its character sheet and cards, the menu host, moving, layer, themes, auto-hide), `flyouts` (one folder per flyout: `action`, `check` with `sanity.js`, `other` with `assist.js`, `opposed`, `alert`; `flyout.js` their shared helpers, `improvised.js` the improvised weapon Item and Attack share), `combat` (turn order, turn controls, readied firearms, round notes, notice and surprise cards), `status` (status effects), `player` (the Player Rollbox and targeting), `shared` (controls the flyouts share) |
| `tests/` | `mocks.mjs` (Foundry and CoC7 mocks, jsdom) and the `*.test.mjs` files, one or more per part; `docs-index.test.mjs` keeps this index and `docs/TESTS.md` true |
| `tools/release-tools.mjs` | `package`, `smoke` and `release-check` |
| `.github/workflows/ci.yml` | CI: `npm ci`, `npm test`, `npm run release-check` on every push and pull request |
| `docs/<part>.md` | One document per part: every exported function, hook and override, what it connects to, and what it could clash with |
| `docs/TESTS.md` | Every test, by file, with the command to run one |
| `docs/DESIGN.md` | What the module does and the rules it follows |
| `docs/DEVELOPING.md` | Setup, how the code is written, testing (unit tests and the e2e check), everything known about CoC7 and Foundry, and the Internal API registry. Comments that say "the build guide" or "BUILD-GUIDE" mean this file |
| `docs/recipes/` | Step by step: add a flyout, add a setting, support a new CoC7 version, make a release |
| `guide/` | The user guide: `README.md` is its index, then one page per task or feature |
| `media/` | The README's and guide's animations and stills, stored with Git LFS (`.gitattributes`); without Git LFS a clone has only pointer files there |

Only `module.json` and `scripts/` ship in the release zip. Everything else is for development.

## Setup and commands

Node.js 26 (what CI uses). From the repository root:

```
npm ci                                                       # install the test tools (jsdom, fflate)
npm test -- --test-name-pattern="<pattern>" tests/<file>.test.mjs   # the tests that cover your change
npm test -- tests/<file>.test.mjs                            # one whole file
npm test                                                     # every test
npm run release-check                                        # builds dist/keepers-rollbox-v<version>.zip and checks it
```

**To test a change:** open [docs/TESTS.md](docs/TESTS.md), find the tests that cover what you changed, and run only those, by pattern or by file, with the command it gives. Don't open the test files to look for tests; they're long. Open a test file only to edit or add a test. Run everything (`npm test` and `npm run release-check`) once, before you finish.

**Try a build in Foundry by hand:** run `npm run release-check`, close Foundry (or return to its setup screen), remove any installed copy of the module folder `Data/modules/keepers-rollbox`, unzip `dist/keepers-rollbox-v<version>.zip` into `Data/modules/` (it holds one `keepers-rollbox` folder), start Foundry and enable Keeper's Rollbox in a CoC7 world. Check the console (F12) for red lines mentioning `keepers-rollbox`, and log in a player too: with the Player Rollbox off, players must see nothing; with it on, only their own investigator. Foundry reads `module.json` only when a world launches, so after adding or renaming a script or stylesheet, relaunch the world (F5 isn't enough).

The maintainer also runs an end-to-end check in a live Foundry and makes the guide's captures with tools kept in the development project, outside this repository ([docs/DEVELOPING.md](docs/DEVELOPING.md), "Testing" and "Captures").

## The rules that matter

1. **Stay in Rollbox's lane.** Never intercept, override or change CoC7's or Foundry's own behaviour (clicks, rolls, cards, dialogs). Rollbox only sends requests through their normal paths: CoC7's roll links, its actor methods and its cards. No dice or success-level code of our own. Rollbox may set a toggle or option CoC7 already offers in its own UI, the way a player or the Keeper could click it (Draw gun in the combat tracker, Aiming or Under cover on CoC7's attack card), but never changes how CoC7 works; each such use is listed in `docs/DESIGN.md` and guarded in the registry. If CoC7 does something awkward, say so in an issue; don't work around it.
2. **Keeper first.** Nothing runs or draws on players' clients unless the Keeper turns on the Player Rollbox, and then only what its ticked features allow, for the player's own character. Every `register…()` and hook checks `isKeeper()` (or `panelHere()` in `scripts/player/`) first.
3. **Guard every internal.** Any underscore, protected or undocumented Foundry or CoC7 API is wrapped so an update makes the feature do nothing (one `warn()`), never throw. Record it in the Internal API registry in `docs/DEVELOPING.md`, marked Assumed until it's seen working in Foundry.
4. **No secrets** (passwords, keys, tokens) in any file, commit or command.
5. **Comments are short and say why.** A file header of at most 3 lines (what the file does, and its part document); JSDoc on every export, a one-sentence summary of at most 2 lines with `@param` and `@returns`; inline `//` only where the code would surprise a reader (a CoC7 or Foundry quirk, an order, a race, a security check), at most 2 lines; comment lines at most a quarter of a file's code lines (`tests/comments.test.mjs`). No history (dates, names, build ids, "was Y"): it lives in git and the CHANGELOG; what a feature does lives in [docs/DESIGN.md](docs/DESIGN.md). No commented-out code. No `console.log` or `debugger` in `scripts/`; log through `warn()`.
6. **Files stay under about 450 lines.** A part that grows past that splits into files in its folder.
7. **One part, one job.** A part imports another part only through its `index.js` (the one deliberate exception is in `docs/DEVELOPING.md`, "Project layout"). Flyouts send through `roll-requests/` and never build CoC7 request text; skill names are matched only in `skill-values/`.
8. **Names are permanent.** The module id and every setting key are never renamed (saved settings would reset). Setting keys start with `rollbox`, CSS classes with `rollbox-`, CSS variables with `--rollbox-`.
9. **No new dependencies** (npm packages or Foundry modules such as libWrapper or socketlib) without the maintainer agreeing in an issue first.
10. **Text is plain English**, short, inline (no language files). Every setting is in a section with a heading and a master switch, and has its italic note: "Keeper setting, applies to everyone." or "Personal setting, affects only your screen."

## How to work

1. Find your task in "Find your way" and read what its row lists. For a new feature, check `docs/DESIGN.md` first: a change to what Rollbox does needs the maintainer's agreement in an issue.
2. Change the code, in the part's own folder.
3. Update the part's document (and `docs/DESIGN.md` or `docs/DEVELOPING.md` if what you changed is described there; new CoC7 or Foundry facts go in `docs/DEVELOPING.md`). If the Keeper or players see the change, update its page in `guide/` too.
4. Add or update one test per changed behaviour, including the "does nothing" paths (a player, the switch off, CoC7's API missing). Tests check our logic, not Foundry's or CoC7's.
5. Test through [docs/TESTS.md](docs/TESTS.md): run only the tests that cover your change, by pattern or file. When they pass, run `npm test` and `npm run release-check` once; both must pass (CI runs them on every push and pull request).
6. Keep the index true: add, rename or remove your tests' rows in `docs/TESTS.md`; for a new part, also its `docs/<part>.md` and a row (or a mention) in "Find your way". `tests/docs-index.test.mjs` fails when a test file has no section in `docs/TESTS.md`, a part has no document, or a path in "Find your way" is missing.
7. Add one plain-words line to the top entry of `CHANGELOG.md` ("Fix: …" or the feature). Don't add a version heading or change `module.json`'s version: the maintainer does that when releasing.
8. Say what you couldn't check in Foundry (anything that relies on how Foundry or CoC7 behave) in the pull request.

## Where to read more

- [docs/DEVELOPING.md](docs/DEVELOPING.md): setup, conventions, testing and the e2e check, CoC7 links and cards, NPC rolls, skills, combat and players, the panel and CSS, settings, the Internal API registry, captures, the release checklist.
- [docs/DESIGN.md](docs/DESIGN.md): every flyout's layout and rules.
- [docs/TESTS.md](docs/TESTS.md): every test and how to run one.
- [docs/recipes/](docs/recipes/): common changes, step by step.
- [guide/README.md](guide/README.md): the user guide, as the Keeper and players read it.
- [CONTRIBUTING.md](CONTRIBUTING.md): issues and pull requests.
