# AGENTS.md — working on Keeper's Rollbox

Instructions for AI coding agents and for people. This file is the one source of truth. If your AI tool expects a different file name, rename or copy this file to that name.

## What this is

Keeper's Rollbox is a Foundry VTT 14 module for the Call of Cthulhu 7th Edition (CoC7) system, version 8.15 or later. It gives the Keeper a small panel for the selected tokens that sends CoC7's own roll requests and cards (checks, Sanity, Luck and items, opposed rolls, Assist). CoC7 does all the rolling and judging.

## Find your way

**Read only what your row lists; don't read every document or test.** Section names are `##` / `###` headings in that file; each long document starts with a linked contents list. Tests: find them in [docs/TESTS.md](docs/TESTS.md) under the file named, and run only the ones that cover your change.

The menu parts are `check-menu` (Check), `sanity-menu` (Sanity), `other-menu` (Other: its Item and Luck sections), `opposed-roll` (Opposed) and `assist` (Assist); `docs/<part>.md` is that part's document.

| Task | Read | Tests ([docs/TESTS.md](docs/TESTS.md)) |
| --- | --- | --- |
| Fix a bug in a menu | `docs/<part>.md` for that menu; [docs/DESIGN.md](docs/DESIGN.md) that menu's section; [docs/shared.md](docs/shared.md) if it's a shared control (value line, dice picker, Blind, send section, result) | [`<part>.test.mjs`](docs/TESTS.md); [shared.test.mjs](docs/TESTS.md#sharedtestmjs) for shared controls |
| Change a menu's layout or wording | `docs/<part>.md`; [docs/DESIGN.md](docs/DESIGN.md) "How every menu is laid out" and the menu's section (a change to what Rollbox does needs the maintainer's agreement first); [docs/shared.md](docs/shared.md); [docs/DEVELOPING.md](docs/DEVELOPING.md) "The panel and CSS" › "CSS: layers, scoping and variables" | [`<part>.test.mjs`](docs/TESTS.md) |
| Add a menu | [docs/recipes/add-a-menu.md](docs/recipes/add-a-menu.md); [docs/mini-sheet.md](docs/mini-sheet.md) (`registerMenu`); [docs/shared.md](docs/shared.md); [docs/roll-requests.md](docs/roll-requests.md); [docs/DEVELOPING.md](docs/DEVELOPING.md) "The panel and CSS" › "The menu host"; [docs/DESIGN.md](docs/DESIGN.md) "Layout by number of tokens selected" | [mini-sheet.test.mjs](docs/TESTS.md#mini-sheettestmjs) (`menu host`, `1 token: mini`, `2 tokens`, `3 or more`); your new file |
| Add or change a setting | [docs/recipes/add-a-setting.md](docs/recipes/add-a-setting.md); [docs/settings.md](docs/settings.md); the part's document; [docs/DEVELOPING.md](docs/DEVELOPING.md) "Settings" | [settings.test.mjs](docs/TESTS.md#settingstestmjs); the part's file for what the setting changes |
| Change how a roll request or card is built (links, whispers, NPC rolls, Sanity or opposed cards) | [docs/roll-requests.md](docs/roll-requests.md); [docs/DEVELOPING.md](docs/DEVELOPING.md) "CoC7 links and options", "Cards", "Rolling NPCs", "Internal API registry"; [docs/DESIGN.md](docs/DESIGN.md) "Sending and who rolls" | [roll-requests.test.mjs](docs/TESTS.md#roll-requeststestmjs) |
| Skill names, skill lists, base values | [docs/skill-values.md](docs/skill-values.md); [docs/DEVELOPING.md](docs/DEVELOPING.md) "Skills and weapons", "Rules and units" | [skill-values.test.mjs](docs/TESTS.md#skill-valuestestmjs) |
| Weapons and improvised damage, or Luck checks and the Group Luck roll | [docs/other-menu.md](docs/other-menu.md); [docs/roll-requests.md](docs/roll-requests.md); [docs/DEVELOPING.md](docs/DEVELOPING.md) "Skills and weapons" › "A weapon's skill"; [docs/DESIGN.md](docs/DESIGN.md) "Other menu" | [other-menu.test.mjs](docs/TESTS.md#other-menutestmjs); [roll-requests.test.mjs](docs/TESTS.md#roll-requeststestmjs) (`weapon:`, `improvised:`) |
| Opposed rolls | [docs/opposed-roll.md](docs/opposed-roll.md); [docs/DEVELOPING.md](docs/DEVELOPING.md) "Cards" › "Opposed", "Gaps" (7 and 8); [docs/DESIGN.md](docs/DESIGN.md) "Opposed roll (exactly two characters)" | [opposed-roll.test.mjs](docs/TESTS.md#opposed-rolltestmjs); [roll-requests.test.mjs](docs/TESTS.md#roll-requeststestmjs) (`opposed:`) |
| Assist maths (who helps, who rolls, difficulty) | [docs/assist.md](docs/assist.md) (`scripts/assist/split.js`); [docs/DEVELOPING.md](docs/DEVELOPING.md) "Rules and units"; [docs/DESIGN.md](docs/DESIGN.md) "Assist (two or more characters)" | [assist.test.mjs](docs/TESTS.md#assisttestmjs) (`difficultyFor`, `assistChoices`) |
| The panel, theme, colour, size or CSS | [docs/mini-sheet.md](docs/mini-sheet.md); [docs/shared.md](docs/shared.md); [docs/DEVELOPING.md](docs/DEVELOPING.md) "The panel and CSS"; [docs/DESIGN.md](docs/DESIGN.md) "Who sees it and when", "Layout by number of tokens selected" |
| Clicks and shortcuts on the mini sheet's values, the opposed two-step | [docs/mini-sheet.md](docs/mini-sheet.md) "Clicks on the mini sheet's values"; [docs/check-menu.md](docs/check-menu.md) and [docs/other-menu.md](docs/other-menu.md) (`apply`); [docs/opposed-roll.md](docs/opposed-roll.md) (`start`); [docs/DESIGN.md](docs/DESIGN.md) "The mini sheet's values" | [mini-sheet.test.mjs](docs/TESTS.md#mini-sheettestmjs) (`mini sheet values`, `a left click`, `shortcuts, as on`, `right click: no`); [check-menu.test.mjs](docs/TESTS.md#check-menutestmjs) (`started from the mini sheet`) | [mini-sheet.test.mjs](docs/TESTS.md#mini-sheettestmjs); [shared.test.mjs](docs/TESTS.md#sharedtestmjs) |
| Start-up, hooks, Keeper-only checks, helpers | [docs/main.md](docs/main.md); [docs/utils.md](docs/utils.md); [docs/DEVELOPING.md](docs/DEVELOPING.md) "Lifecycle: which hook does what", "Multiplayer" | [mini-sheet.test.mjs](docs/TESTS.md#mini-sheettestmjs) (`main.js calls`, `player: does`); [utils.test.mjs](docs/TESTS.md#utilstestmjs) |
| A new CoC7 or Foundry version | [docs/recipes/new-coc7-version.md](docs/recipes/new-coc7-version.md); [docs/DEVELOPING.md](docs/DEVELOPING.md) "CoC7 integration", "Internal API registry", "Gaps" | `npm test` (all), then the Foundry check in the recipe |
| Release, or the release tools | [docs/recipes/make-a-release.md](docs/recipes/make-a-release.md); [docs/release-tools.md](docs/release-tools.md); [docs/DEVELOPING.md](docs/DEVELOPING.md) "Release checklist" | [release-tools.test.mjs](docs/TESTS.md#release-toolstestmjs) if the tools change; `npm test` and `npm run release-check` for a release |
| User guide or README wording | [guide/README.md](guide/README.md) and the page for the feature; [README.md](README.md) | none; check the links still work |

A task that fits no row: read the part's document for the code you'll change and its entry in [docs/TESTS.md](docs/TESTS.md), and search the contents lists of [docs/DEVELOPING.md](docs/DEVELOPING.md) and [docs/DESIGN.md](docs/DESIGN.md) for the topic.

## Map of the repository

| Path | What it holds |
| --- | --- |
| `module.json` | Foundry's manifest: id `keepers-rollbox`, version, CoC7 relationship, `scripts/main.js`, the CSS files |
| `scripts/main.js` | Wiring only: settings at `init`, each part's `register…()` at `ready` |
| `scripts/settings.js`, `scripts/utils.js` | The settings machinery and its sections; small helpers every part uses (`MODULE_ID`, `isKeeper`, `getSetting`, `warn`, …) |
| `scripts/<part>/` | One folder per part, each with an `index.js` (its public surface) and its CSS: `skill-values` (skills, base values, the only skill-name matching), `roll-requests` (builds and sends CoC7 requests; the only code that talks to CoC7's rolls), `mini-sheet` (the panel, its buttons and the menu host), `check-menu`, `sanity-menu`, `other-menu` (Item and Luck), `opposed-roll`, `assist`, `shared` (controls the menus share) |
| `tests/` | `mocks.mjs` (Foundry and CoC7 mocks, jsdom) and one `<part>.test.mjs` per part; `docs-index.test.mjs` keeps this index and `docs/TESTS.md` true |
| `tools/release-tools.mjs` | `package`, `smoke` and `release-check` |
| `docs/<part>.md` | One document per part: every exported function, hook and override, what it connects to, and what it could clash with |
| `docs/TESTS.md` | Every test, by file, with the command to run one |
| `docs/DESIGN.md` | What the module does and the rules it follows |
| `docs/DEVELOPING.md` | How the code is written, everything known about CoC7 and Foundry, and the Internal API registry. Comments that say "the build guide" or "BUILD-GUIDE" mean this file |
| `docs/recipes/` | Step by step: add a menu, add a setting, support a new CoC7 version, make a release |
| `guide/` | The user guide, one page per feature |

Only `module.json` and `scripts/` ship in the release zip. Everything else is for development.

## Setup and commands

Node.js 24 (what CI uses). From the repository root:

```
npm ci                                                       # install the test tools (jsdom, fflate)
npm test -- --test-name-pattern="<pattern>" tests/<file>.test.mjs   # the tests that cover your change
npm test -- tests/<file>.test.mjs                            # one whole file
npm test                                                     # every test
npm run release-check                                        # builds dist/keepers-rollbox-v<version>.zip and checks it
```

**To test a change:** open [docs/TESTS.md](docs/TESTS.md), find the tests that cover what you changed, and run only those, by pattern or by file, with the command it gives. Don't open the test files to look for tests; they're long. Open a test file only to edit or add a test. Run everything (`npm test` and `npm run release-check`) once, before you finish.

**Try a build in Foundry by hand:** run `npm run release-check`, close Foundry (or return to its setup screen), remove any installed copy of the module folder `Data/modules/keepers-rollbox`, unzip `dist/keepers-rollbox-v<version>.zip` into `Data/modules/` (it holds one `keepers-rollbox` folder), start Foundry and enable Keeper's Rollbox in a CoC7 world. Check the console (F12) for red lines mentioning `keepers-rollbox`, and log in a player too: players must see nothing.

## The rules that matter

1. **Stay in Rollbox's lane.** Never intercept, override or change CoC7's or Foundry's own behaviour (clicks, rolls, cards, dialogs). Rollbox only sends requests through their normal paths: CoC7's roll links, its actor methods and its cards. No dice or success-level code of our own. If CoC7 does something awkward, say so in an issue; don't work around it.
2. **Keeper only.** Nothing runs or draws on players' clients. Every `register…()` and hook checks `isKeeper()` first.
3. **Guard every internal.** Any underscore, protected or undocumented Foundry or CoC7 API is wrapped so an update makes the feature do nothing (one `warn()`), never throw. Record it in the Internal API registry in `docs/DEVELOPING.md`, marked Assumed until it's seen working in Foundry.
4. **No secrets** (passwords, keys, tokens) in any file, commit or command.
5. **Comments say why**, never history (that's the CHANGELOG's). No `console.log` or `debugger` in `scripts/`; log through `warn()`.
6. **Files stay under about 450 lines.** A part that grows past that splits into files in its folder.
7. **One part, one job.** A part imports another part only through its `index.js`. Menus send through `roll-requests/` and never build CoC7 request text; skill names are matched only in `skill-values/`.
8. **Names are permanent.** The module id and every setting key are never renamed (saved settings would reset). Setting keys start with `rollbox`, CSS classes with `rollbox-`, CSS variables with `--rollbox-`.
9. **No new dependencies** (npm packages or Foundry modules such as libWrapper or socketlib) without the maintainer agreeing in an issue first.
10. **Text is plain English**, short, inline (no language files). Every setting has its italic note: "Keeper setting, applies to everyone." or "Personal setting, affects only your screen."

## How to work

1. Find your task in "Find your way" and read what its row lists. For a new feature, check `docs/DESIGN.md` first: a change to what Rollbox does needs the maintainer's agreement in an issue.
2. Change the code, in the part's own folder.
3. Update the part's document (and `docs/DESIGN.md` or `docs/DEVELOPING.md` if what you changed is described there; new CoC7 or Foundry facts go in `docs/DEVELOPING.md`).
4. Add or update one test per changed behaviour, including the "does nothing" paths (a player, the switch off, CoC7's API missing). Tests check our logic, not Foundry's or CoC7's.
5. Test through [docs/TESTS.md](docs/TESTS.md): run only the tests that cover your change, by pattern or file. When they pass, run `npm test` and `npm run release-check` once; both must pass (CI runs them on every pull request).
6. Keep the index true: add, rename or remove your tests' rows in `docs/TESTS.md`; for a new part, also its `docs/<part>.md` and a row (or a mention) in "Find your way". `tests/docs-index.test.mjs` fails when a test file, a part document or a path in the table is missing.
7. Add one plain-words line to the top entry of `CHANGELOG.md` ("Fix: …" or the feature). Don't add a version heading or change `module.json`'s version: the maintainer does that when releasing.
8. Say what you couldn't check in Foundry (anything that relies on how Foundry or CoC7 behave) in the pull request.

## Where to read more

- [docs/DEVELOPING.md](docs/DEVELOPING.md): conventions, CoC7 links and cards, NPC rolls, skills, the panel and CSS, settings, testing, the Internal API registry, the release checklist.
- [docs/DESIGN.md](docs/DESIGN.md): every menu's layout and rules.
- [docs/TESTS.md](docs/TESTS.md): every test and how to run one.
- [docs/recipes/](docs/recipes/): common changes, step by step.
- [CONTRIBUTING.md](CONTRIBUTING.md): issues and pull requests.
