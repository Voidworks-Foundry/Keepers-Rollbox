# Keeper's Rollbox — developer notes

How Rollbox's code is written, and what was learned about Foundry VTT 14 and the Call of Cthulhu 7th Edition (CoC7) system while building it. This is the project's build guide: when a code comment or a part document says "the build guide" or "BUILD-GUIDE", it means this file. What the module does is in [DESIGN.md](DESIGN.md); how to work on it is in [AGENTS.md](../AGENTS.md).

## Contents

- [How to use these notes](#how-to-use-these-notes): when to read and update these notes; confirmed vs assumed.
- [Environment](#environment): Foundry and CoC7 versions the module is built and checked on.
- [Same standard as void-coc7-modules](#same-standard-as-void-coc7-modules): folder, file and naming conventions every part follows.
- [Project layout](#project-layout): what each folder and file holds; what never ships; how parts share code.
- [Lifecycle: which hook does what](#lifecycle-which-hook-does-what): init, setup, ready, canvasReady; Keeper-only hooks.
- [Changing core behavior](#changing-core-behavior): hooks first, never replace a method; which Foundry and CoC7 APIs may be called.
- [Multiplayer](#multiplayer): Keeper-only code, whispers to owners, NPCs rolled for the Keeper, untrusted names.
- [Performance](#performance): the selection hook and redraws.
- [Rules and units](#rules-and-units): Keeper Rulebook rules the code follows: base skills, opposed, combined, Assist maths.
- [Code style](#code-style): modules, comments, file length, logging through warn(), formatting.
- [Testing](#testing): the test runner, mocks, jsdom, CSS and timer tests, a headless look check, the Foundry check.
- [CoC7 integration](#coc7-integration): how CoC7 was researched, reading its source and compendiums, what it offers a module.
- [CoC7 links and options](#coc7-links-and-options): link syntax and options, who a click rolls for, building links, whispers, v14 chat modes, labels.
- [Cards](#cards): combined, opposed and Sanity cards, Rollbox's Assist card, clicking card buttons from code.
- [Rolling NPCs](#rolling-npcs): how NPC sides are rolled privately for the Keeper.
- [Skills and weapons](#skills-and-weapons): skill-name matching, skills missing from a sheet, a weapon's skill, CoC7 actor and item data paths.
- [The panel and CSS](#the-panel-and-css): where the panel attaches, moving it, the menu host, CSS layers and variables, sizes, theme and colour.
- [Settings](#settings): scopes, sections, slider, drop-down and colour settings, Reset buttons, permanent keys.
- [Gaps](#gaps): things CoC7 can't do as designed, and what was decided for each.
- [Internal API registry](#internal-api-registry): every non-public Foundry or CoC7 API in use, where, and whether it's confirmed.
- [Release checklist](#release-checklist): what must be true before a release.
- [Publishing (the maintainer releases)](#publishing-the-maintainer-releases): how a release is published.

## How to use these notes

- **Before changing code:** read the sections that touch your change, especially the CoC7 sections and the Internal API registry.
- **When you learn something** (a Foundry or CoC7 behaviour, a rule that caused a bug, a new internal API in use): add it to the section for its topic.
- **When these notes and the code disagree:** stop and ask in an issue; don't guess which one is right.
- **(confirmed)** means verified in Foundry. **(assumed)** means inferred from docs or source and not yet tested in play.
- "Void" is the maintainer (Voidworks Studios). "(Void, date)" marks a deliberate choice: don't "fix" it without asking.

## Environment

| Item | Value |
| --- | --- |
| Foundry VTT | v14 (checked on build 368) |
| Game system | Call of Cthulhu 7th Edition, id `CoC7`, v8.15 |
| Module id and title | id `keepers-rollbox`, title "Keeper's Rollbox" |
| Users | One Keeper (GM) and several players; NPCs are owned only by the Keeper |

## Same standard as void-coc7-modules

Rollbox is built the same way as Void's other CoC7 module (`void-coc7-modules`), so the two can be merged into one module later. Keep to these conventions even where they look like more structure than one module needs.

What must match:
- **One folder per part** under `scripts/`, holding `index.js` (the part's `register…()` functions and logic, and its public surface), `settings.js` if the part has settings, any other files the part needs, and its CSS. Nothing about a part lives outside its folder except its test file, its document, and one line each in `main.js` and `settings.js`.
- **`scripts/main.js`** holds wiring only, in the same shape: `Hooks.once("init", …)` registers settings; `Hooks.on("renderSettingsConfig", decorateSettingsConfig)`; `Hooks.once("setup", …)` or `Hooks.once("ready", …)` calls each part's `register…()`.
- **`scripts/settings.js`** is the CoC7 module's file, copied, with its own `SECTIONS` list. Each part's `settings.js` exports its section (or its settings) as plain data: `{ title, master, note?, settings: { key: { name, hint, scope, type, default, note, requiresReload? } } }`. Registration defaults to `requiresReload: true`. The page decoration (headings, italic scope notes, dimming) is the same code.
- **`scripts/utils.js`** starts with the same `MODULE_ID`, `KEEPER`, `PERSONAL`, `escapeHtml()` and `getSetting()`; Rollbox's own shared helpers go after them.
- **Tests:** `tests/mocks.mjs` with `makeEnv()` and `load()` in the same shape (extended with what Rollbox needs), and one `tests/<part>.test.mjs` per part. `package.json` runs `node --test --test-reporter=spec`.
- **Part documents** in `docs/<part>.md`, in one format: a title with the part's path, a short intro, the status key, then `## Code` with one `### \`name()\`` entry per exported function, hook, class and override, and per private function that touches Foundry or CoC7 (other private helpers get no entry; their JSDoc says what they do), each with **How it works**, **Connects to**, **Could interact poorly with**, every interaction marked **Confirmed** or **Assumed**; then `## Hooks, overrides, keybindings` and `## Settings`. A part document says how the part works now; its history is in the CHANGELOG.
- **`CHANGELOG.md`:** `## <version>` headings, newest first, with one plain-words bullet per change ("Fix: …", "Internal: …", or the feature).
- **`module.json`:** the same fields (`id`, `title`, `description`, `version`, `authors` [Void], `compatibility` 14/14, `relationships.systems` CoC7, `esmodules` ["scripts/main.js"]), plus `styles` for Rollbox's CSS.

So a merge stays simple, Rollbox keeps everything namespaced:
- Part folders have specific names (`mini-sheet/`, not `panel/`).
- Setting keys start with `rollbox` (`rollboxEnabled`).
- CSS classes start with `rollbox-`, CSS variables with `--rollbox-`.
- Template paths are built from `MODULE_ID`, never typed out (Rollbox has no templates today).

Merging later means: copy the part folders, add their sections to the CoC7 module's `SECTIONS` and their `register…()` calls to its `main.js`, and move any Rollbox helpers into its `utils.js`. Saved Rollbox settings reset at that point, because the module id changes.

## Project layout

```
keepers-rollbox/          the repository root
  module.json            manifest (id, version, CoC7 relationship, entry point, styles)
  package.json           test and release tooling only; Foundry ignores it, never ships
  CHANGELOG.md
  README.md              the public front page (GitHub); never ships
  AGENTS.md              instructions for AI coding agents and the "Find your way" index; never ships
  CONTRIBUTING.md        how to report a bug or propose a change; never ships
  LICENSE                MIT; never ships
  guide/                 the user guide, one page per feature; never ships
  scripts/
    main.js              entry: wiring only
    utils.js             MODULE_ID, KEEPER, PERSONAL, escapeHtml, getSetting, then Rollbox helpers
    settings.js          the shared settings machinery and SECTIONS
    skill-values/        what a character can roll, base values, and the only skill-name matching (data, no UI)
    roll-requests/       builds CoC7 requests and sends them (whisper, chat, NPC auto-roll); index.js is its public surface
    mini-sheet/          the panel above the players list: mini sheet, names card, buttons, menu host; theme and Appearance settings
    check-menu/          the Check menu
    sanity-menu/         the Sanity menu
    other-menu/          the Other menu: Item (item.js) and Luck (luck.js) sections; index.js draws the section tabs
    opposed-roll/        the opposed roll view and card
    assist/              the Assist menu (several characters' STR or SIZ against one thing), its maths and its chat card
    shared/              controls more than one menu uses (value line, compact dice picker, Blind toggle, status line), the menus' DOM helpers and send section (menu.js) and shared.css; index.js is its public surface; one setting, no hooks
  tests/
    mocks.mjs            Foundry and CoC7 mocks
    <part>.test.mjs      one per part, plus release-tools.test.mjs
  tools/
    release-tools.mjs    package, smoke and release-check (generic: reads everything from module.json); never ships
  dist/                  zips written by the package script; in .gitignore
  docs/
    <part>.md            one per part, plus main.md, settings.md, utils.md, release-tools.md
    DEVELOPING.md        these notes
    TESTS.md             an index of every test, with the command to run one
    DESIGN.md            what the module does and the rules it follows
    recipes/             step-by-step guides for common changes
```

- **A new part gets its own folder.** `main.js` calls its `register…()` from the right hook.
- **Anything two parts share** goes in `utils.js` (small helpers every part may need), in `shared/` (menu controls and their CSS), or stays in the part that owns it and is exported from its `index.js`: menus send through `roll-requests/` and never build CoC7 requests themselves; skill names are matched only by `skill-values/`. A part imports another part's `index.js` only, never the files beside it (`shared/` too: its `index.js` re-exports the controls; only the module's `settings.js` imports a part's `settings.js` directly).
- **No build step.** Files load as native ES modules. Every part builds its DOM in JS with `textContent` (no Handlebars templates); `release-tools` still checks template paths, for `void-coc7-modules`.

## Lifecycle: which hook does what

| Hook | Runs | Put here | Don't put here |
| --- | --- | --- | --- |
| `init` | Once, first | `game.settings.register`, `game.keybindings.register`, CONFIG changes that need no settings | `game.settings.get` for world settings |
| `setup` | Once, before the canvas draws | Read settings; subclass CONFIG classes; install feature hooks | Anything needing `game.users` state or the canvas |
| `ready` | Once, everything loaded | Work needing users, the canvas, the players list, CoC7's APIs | Class swaps (too late) |
| `canvasReady` | Each scene load | Per-scene setup | One-time setup |

Only install a hook when its feature is on, and only on the Keeper's client: players should run no Rollbox code beyond registering settings. Permanent hooks are never removed: the panel's switch needs a reload, so there is nothing to clean up; a temporary hook (watching for a card) removes itself.

## Changing core behavior

Use the least invasive tool that works, in this order, and never replace a core or CoC7 method outright.

1. **A hook** (`Hooks.on(...)`), when Foundry or CoC7 offers one at the right moment.
2. **Subclass the current CONFIG class** (read it at `setup`, extend that value, call `super`).
3. **libWrapper**, only for methods no CONFIG class exposes, and only after the maintainer agrees (it's a dependency).
4. **Never assign over a prototype method.** It silently breaks any other module touching the same method.

**Stay in Rollbox's lane** (Void, 2026-11-14): never intercept, override or change CoC7's or Foundry's own behaviour (clicks, rolls, cards, dialogs). Rollbox only sends requests through their normal paths. If something they do is awkward, write it up in an issue; don't work around it.

### Which APIs we may call

| Kind | Looks like | Rule |
| --- | --- | --- |
| Public | `canvas.tokens.controlled`, `ChatMessage.create` | Use freely |
| Protected | `_onRender`, `_prepareContext` | Call or override only from inside our subclass |
| Internal | Underscore properties, CoC7 classes not meant for modules | Only if nothing public works. Guard against it being missing, and list it in the Internal API registry |
| Undocumented | Anything not in the [v14 API docs](https://foundryvtt.com/api/) or CoC7's source | Don't use |

**Guard every internal read** so a Foundry or CoC7 update degrades to "feature does nothing" (with one `console.warn`) rather than an error.

## Multiplayer

- **Rollbox runs only on the Keeper's client.** Check `game.user.isGM` before installing hooks or drawing anything. `User#isGM` is true for both the Gamemaster and Assistant GM roles (v14 docs), so `isKeeper()` lets Assistant GMs see the panel too. (assumed)
- **Requests to players** are whispered to the owners of each character (users with OWNER permission on the actor, not GMs), or posted publicly when the Keeper picks Send to chat.
- **NPC sides** (no player owner) roll automatically for the Keeper, privately.
- **Hook data from other users is untrusted.** Names go into chat HTML; escape them, never insert raw user-written HTML.

## Performance

| Hot path | How often | Rule |
| --- | --- | --- |
| `controlToken` hook | Every selection change, once per token (a box-select fires it many times) | Don't redraw per call: coalesce to one redraw on the next animation frame |
| Panel render | On selection change and menu actions | Render only the visible part; no work while the panel is hidden |

- Read settings outside hot paths; early-return first (`!game.user.isGM`, switch off, nothing selected).
- No `await` inside `controlToken`; schedule the redraw instead.

## Rules and units

- Rule pages are from the Call of Cthulhu 7th Edition Keeper Rulebook. Cite the page in a comment for any rule implemented.
- **Base skill values** (for skills missing from a sheet) live in one table, `scripts/skill-values/base-skills.js`, citing the Keeper Rulebook skill list (p. 56). Dodge = half DEX; Language (Own) = EDU; both rounded down, as CoC7 does. Checked against CoC7's Skills compendium: no value differs (`docs/skill-values.md`).
- **Trained** = on the sheet and above Rollbox's table value, never `system.adjustments.base` alone (see "Actor and item data").
- **No skill is hidden by era, or at all** (Void, 2026-11-13): games move between eras. Every table skill is always offered, Modern-era ones (Computer Use, Electronics) included. CoC7's per-era skill tags are incomplete (its Dark Ages list lacks Listen; Invictus lacks Dodge), so they are not used.
- **Opposed rolls:** exactly two sides; no difficulty, bonus or penalty dice only (p. 92); can't be pushed (p. 90); tie goes to the higher skill (p. 91). CoC7's opposed card does the comparing.
- **Combined rolls:** one character, one roll, compared with each chosen check; "all" or "any" (p. 92).
- **Assist (Physical Human Limits, p. 88–89, summary p. 407):** plain arithmetic, no Foundry calls (`assist/split.js`): helpers lowest first; what's left must stay above 0 and be at most 100 + each remaining character's value; difficulty from what's left (50+ Hard, 90+ Extreme); the best chance that at least one roller succeeds wins, ties to fewer helpers. The chance (value, half or fifth over 100) is only an estimate for choosing; CoC7 rolls and judges the real rolls.

## Code style

- Native ES modules, `import`/`export`, no globals. The only top-level side effects are in `main.js`.
- `MODULE_ID` from `utils.js` everywhere; never retype the id string.
- Named functions over anonymous blocks, each doing one thing. Files stay under about 450 lines; a part that grows past that is split into files in its folder, with `index.js` re-exporting its public surface.
- A file starts with a short comment saying what the part does for the Keeper; menus end it with "Layout and rules: DESIGN.md, '<section>'".
- JSDoc on exported functions and overrides; say *why* in comments, not what the next line does, and never the session history (that is the CHANGELOG's). Keep a "(Void, date)" only where a reader would otherwise "fix" a deliberate choice.
- Constants, not magic numbers.
- Write each template path whole, in one string: `` `modules/${MODULE_ID}/scripts/<part>/<name>.hbs` ``. The smoke test finds template paths written that way and fails the release if the file isn't in the zip; a path put together from pieces isn't checked.
- Console messages go through `warn(text, ...details)` in `utils.js`, which adds the `keepers-rollbox |` prefix; a caught error goes in as a detail (`warn("the Check menu failed to draw.", error)`). No part calls `console.warn` itself.
- 2-space indent, double quotes, semicolons, lines under about 120 characters.

## Testing

Every change passes the tests before it is merged, then gets checked in Foundry (below) before a release.

- `npm test` (from the module folder) runs Node's built-in test runner (`node --test --test-reporter=spec`). It runs every test even when one fails and names each test.
- Tests use mocks of `game`, `CONFIG`, `Hooks`, `canvas`, `ChatMessage` and the parts of CoC7 we call, in `tests/mocks.mjs` (same `makeEnv()` / `load()` shape as the CoC7 module). DOM tests use `jsdom`; every DOM test makes its page with `makeDom()` (`mocks.mjs`).
- Add tests with every feature or fix, including the "does nothing" paths: switch off, not the Keeper, nothing selected, a token with no actor, CoC7's API missing.
- **Mocks prove our logic, not Foundry's or CoC7's.** Anything relying on how they behave stays marked assumed until checked in play.
- **jsdom and tick boxes:** `input.click()` on a checkbox fires `change` only when the element is in the document. Append a menu's body to `document.body` before clicking.
- **jsdom and CSS:** jsdom does no layout (`offsetHeight` is 0) and its `getComputedStyle` returns the declared value: `var()` and `calc()` are not worked out, shorthands such as `gap` are not split into `rowGap`, and a custom property is read only on the element that declares it. A test of a CSS rule loads the stylesheet (`addStyles` in `mocks.mjs`) and checks the declarations, e.g. that a list's `max-height` and its rows' `height` use the same variable; a test that needs a height stubs `HTMLElement.prototype.offsetHeight`.
- **Timers:** a test file whose code waits on `setTimeout` (the card buttons' click delays and their 15-second watch) uses Node's own fake timers: `mock.timers.enable({ apis: ["setTimeout"] })` in `beforeEach`, `mock.timers.reset()` in `afterEach`, and `mock.timers.tick(ms)` to run them. One `tick` runs only the timers due when it was called, not ones they schedule, so a retry loop needs one `tick` per try. A pending real timer keeps the test file open until it fires (the opposed-roll tests waited 15 s for the watch). Let a send finish with `await new Promise(setImmediate)`: the mocked CoC7 calls are promises only.
- **Looks in a real browser:** a scratch harness can draw the real panel with jsdom and the test mocks, write it out as a static page, and open it in headless Chrome (`chrome --headless=new --allow-file-access-from-files --screenshot` or `--dump-dom` with a script that writes measurements into the title). Load Foundry's own `resources/app/public/css/foundry2.css` and `public/fonts/fontawesome/css/all.min.css` from the install, with `<body class="vtt game theme-dark">`, and the module's stylesheets through `@import url(…) layer(modules)`, so fonts, variables, tick boxes and the cascade layers are Foundry's (without them the mini sheet measured 184px instead of 182px). Input values must be copied into `value` attributes before serialising. Give each Chrome run its own `--user-data-dir` and wait for it (pipe its output), or the screenshot is lost. It never goes in the repo.

**In Foundry (before a release)**

- [ ] Module loads with no red errors in the console (F12)
- [ ] Settings screen: heading, master switch, notes
- [ ] Each changed part, plus a quick pass over the others
- [ ] One player client, to confirm players see nothing and receive requests

## CoC7 integration

Researched from CoC7 **8.15** as installed in Foundry's `Data/systems/CoC7/`. The Foundry side was read from the installed build 368 client source (`%LOCALAPPDATA%\Programs\Foundry Virtual Tabletop\resources\app\client\`), which is more exact for this build than the online docs. Everything here is **(assumed)** unless marked confirmed or listed as confirmed in the registry.

**Reading CoC7's source.** CoC7's `system.js` is one minified bundle, but its last line is a source map that holds all 196 original files. File names below (`apps/link.js`, …) are those original paths under `coc7/`. To recover them into a scratch folder outside the repository:

```
node -e "const fs=require('fs'),p=require('path');const[src,out]=process.argv.slice(1);const m=JSON.parse(Buffer.from(fs.readFileSync(src,'utf8').match(/base64,([A-Za-z0-9+\/=]+)\s*$/)[1],'base64'));m.sources.forEach((f,i)=>{const o=p.join(out,f.replace(/^webpack:\/\/[^\/]*\//,'').replace(/\.\.\//g,''));fs.mkdirSync(p.dirname(o),{recursive:true});fs.writeFileSync(o,m.sourcesContent[i]||'')})" <Foundry data>/systems/CoC7/system.js <scratch-folder>
```

**Reading CoC7's compendiums.** `systems/CoC7/packs/<pack>/` are LevelDB folders; the records sit in the `.ldb` table, Snappy-compressed, so they can't be grepped. A throwaway dependency-free reader (SSTable footer → index block → data blocks, Snappy decoded by hand) written to a scratch folder, never to the repository, reads them. With Foundry closed, `fvtt package unpack` (the Foundry CLI) would do the same but is not installed.

### What CoC7 offers a module

| Entry point | Where | Kind |
| --- | --- | --- |
| Link text `@coc7.check[…]{…}`, `@coc7.sanloss[…]{…}`, `@coc7.item[…]{…}` posted in chat | `apps/link.js` (`CoC7Link.init` registers the enricher) | The format CoC7 documents in its source, uses in its own "Roll Requests" compendium and builds in its Create link tool. Treat as public. |
| `actor.characteristicCheck(key, fastForward, options)`, `actor.attributeCheck(…)`, `actor.skillCheck(name, …)` | `models/actor/document-class.js` | Public methods of CoC7's Actor class |
| `actor.runRoll(options)` (`rollType: "R/MA"`, `threshold`, `characteristic: "idea"/"know"`, `poolModifierIdea` / `poolModifierKnow`, `difficulty` as a number, `isBlind`, `fastForward`; `preventStandby` defaults to true) | `models/actor/document-class.js` | Public method with internal option names; Rollbox uses it for NPC missing skills and combined checks (see "Rolling NPCs"; until 0.1.1 also for an NPC's Idea or Know) |
| `actor.owners` | `models/actor/document-class.js` | Public getter: non-GM users with OWNER permission; empty means an NPC (rolled for the Keeper) |
| `CONFIG.CoC7Link.documentClass` | the `CoC7Link` class | Public class; the statics Rollbox would need start with `_` |
| `game.CoC7.macros.linkMacro(data)` | `hooks/init.js` | Public, but runs once per selected token (see "Cards: opposed") |

Not exported anywhere: the check card (`CoC7Check`), the combined, opposed and Sanity cards, and the roll normaliser. Rollbox reaches them only through links, the actor methods above, or `CoC7Link._onLinkActorClick`.

## CoC7 links and options

### Link syntax

Parsed by `CoC7Link._createLink`, run on click by `CoC7Link._onLinkClick` → `_onLinkActorClick` (`apps/link.js`). Options are `key:value` pairs separated by commas; a bare key (`blind`, `pushing`, `combat`) means true.

| Option | For | Values | Notes |
| --- | --- | --- | --- |
| `subtype` | check | `characteristic`, `attribute`, `skill`, `combinedall`, `combinedany`, `opposed` (also `char`, `charac`, `attrib`, …) | Picks the actor method or card |
| `name` | check, item | characteristic key `str con siz dex app int pow edu`; attribute key `lck san`; skill name as on the sheet (`Fighting (Brawl)`) or CoC ID (`i.skill.spot-hidden`); weapon name | `idea`/`know` are **not** accepted (see Gap 6) |
| `rolls` | combined, opposed | roll strings joined by `&&` (see "Cards") | Not offered in CoC7's dialog, but parsed |
| `difficulty` | check, sanloss | `?` or `-1` hidden; `+` or `2` hard; `++` or `3` extreme; `+++` or `4` critical; anything else (`0`, `1`, empty) regular | `CoC7Utilities.convertDifficulty`. Omitted: CoC7's world setting `defaultCheckDifficulty`. Always send it. **Sanloss takes numbers only**: the Sanity card sets it with `parseInt` and throws "Difficult level is invalid" on `+` / `++` (`CoC7DicePool#difficulty` setter), so CoC7's own changelog example `difficulty:++` fails in 8.15. Rollbox sends numbers everywhere. |
| `poolModifier` | check, sanloss | `-2` … `2` | Penalty or bonus dice; clamped to ±2. CoC7 picks the link's text by whether the option is **present** (`CoC7.LinkCheckDiffModif`, …), so `poolModifier:0` reads "[hard] Spot Hidden check(0)" (seen at the table, 2026-11-13). Check links leave it out with no dice; a missing one rolls as 0 (`CoC7RollNormalize`: `options.poolModifier ?? 0`). Sanity links keep `poolModifier:0`: `CoC7SanCheckCard.create` sets the difficulty only when `poolModifier` is defined. |
| `blind` | check | bare `blind`, or `blind:false` | Parsed for sanloss and item too, but ignored there. Always send `blind` or `blind:false` (see "v14 chat modes"). `blind:false` reaches the actor methods as the string `"false"`, which they read as false (`options.blind === 'false' ? false : !!options.blind`). |
| `pushing` | check | bare | Only changes the link's tooltip and default text ("… check - pushing"). The roll is not marked pushed (Gap 3). |
| `combat` | check | bare | Combined/opposed card in combat mode. Rollbox never sets it. |
| `icon` | all | Font Awesome classes | Optional |
| `sanMin`, `sanMax`, `sanReason` | sanloss | loss on success, loss on failure (number or dice), source name | See "Cards: Sanity" for what `sanReason` does |
| `{label}` | all | the text shown on the link | Without it the tooltip text is shown |

- Old keys `modifier` and `type` still work but log a deprecation warning (until v15). Don't use them.
- Characters that break the syntax: `,` `:` `[` `]` inside option values, `}` inside the label. CoC7 inserts the label into HTML without escaping it (`<span>${name}</span>`), after Foundry has decoded the message's entities, so Rollbox strips `[ ] { } < >` from labels and escapes them with `escapeHtml()`. Option values and roll keys that hold those characters are refused, not altered, so CoC7 never gets a different skill's name.
- Then CoC7's roll dialog (`CoC7RollDialog`) opens, prefilled with the link's difficulty and dice. The player can change difficulty, dice and card type before rolling (Gap 9). Shift-click skips the dialog.
- Hidden difficulty works on the card: the roll is made with difficulty "unknown", and the Keeper sets the difficulty afterwards with Keeper-only buttons on the result card (`roll-result.hbs`).

### Who a click rolls for

- On click, a **Keeper** runs the request once **per selected token** (or for the speaker's actor, or posts the link if neither); Ctrl-click opens the Create link dialog. Rollbox leaves this alone, its own request messages included: it never intercepts or changes CoC7's click handling (Void, 2026-11-14).
- A **player** gets CoC7's actor picker (`CoC7ActorPickerDialog.create`), which picks automatically when they own exactly one character and otherwise preselects their assigned character. The link is not tied to an actor.
- **How the click reaches CoC7 on v14** (Foundry build 368 `applications/ux/text-editor.mjs`, `applications/elements/enriched-content.mjs`): `CoC7Link.init` registers its enricher with an `id` and `onRender`. Foundry wraps such an enricher's result in an `<enriched-content enricher="coc7-enricher">` element, whose `connectedCallback` calls `onRender(element)`; CoC7's `onRenderEnricher` adds a bubbling `click` listener there that calls `_onLinkClick(event)`. (The `document.body` listener in `CoC7Link.init` is only for v12.)

### Creating request links

Build the link text (format above) and post it with `ChatMessage.create`, as CoC7's Create link tool does (`CoC7ContentLinkDialog.createLink` → `CoC7Link.fromDropData` → `_createDocumentLink`, `apps/content-link-dialog.js`). Writing the text ourselves avoids `_createDocumentLink`. Copy link: `game.clipboard.copyPlainText(text)`, as CoC7's dialog does.

```
Characteristic   @coc7.check[subtype:characteristic,name:str,difficulty:+,poolModifier:-1,blind:false]{STR}
Attribute        @coc7.check[subtype:attribute,name:lck,difficulty:1,blind:false]{Luck}
Skill, hidden    @coc7.check[subtype:skill,name:Spot Hidden,difficulty:?,poolModifier:1,blind]{Notice the cultist's hidden knife}
Pushing marker   @coc7.check[subtype:skill,name:Climb,difficulty:1,blind:false,pushing]{Climb}
Sanity           @coc7.sanloss[sanMin:1,sanMax:1D6,sanReason:Ghoul,difficulty:1,poolModifier:0]{The ghoul}
Item             @coc7.item[name:Shotgun]{Shotgun}
Combined, all    @coc7.check[subtype:combinedall,rolls:skill#Spot Hidden#1&&skill#Listen#1]{Spot Hidden and Listen}
Combined, any    @coc7.check[subtype:combinedany,rolls:skill#Spot Hidden#1&&skill#Listen#1]{Spot Hidden or Listen}
Opposed          @coc7.check[subtype:opposed,rolls:Actor.aaa#skill#Stealth#+1&&Scene.s.Token.t.Actor.bbb#skill#Spot Hidden]{Opposed roll}
```

What each runs (`_onLinkActorClick`): characteristic → `actor.characteristicCheck(name, shiftKey, options)`; attribute → `actor.attributeCheck`; skill → `actor.skillCheck`; all three go through `CoC7RollNormalize.trigger` (`apps/roll-normalize.js`) to a `CoC7Check` card (`apps/check.js`). Sanloss → `CoC7SanCheckCard.create(actorUuid, {sanMax, sanMin, sanReason, difficulty, poolModifier})` (blind dropped). Item → `actor.weaponCheck(options, shiftKey)`, which uses only the weapon name and starts CoC7's melee or ranged **attack** card (Gap 2). Combined and opposed: see "Cards".

Rollbox's link options, each a CoC7 behaviour worked around: no `poolModifier` in check links with no dice, but always `poolModifier:0` in Sanity links; numeric difficulties everywhere; always `blind` or `blind:false`; `#1` in every opposed roll string.

### Whispers

CoC7: `CoC7Link#toWhisperMessage(actors)` (`apps/link.js`) creates one `ChatMessage` per actor with `speaker: {alias: game.user.name}`, `whisper: actor.owners.map(u => u.id)` and content `game.i18n.format("CoC7.MessageTargetCheckRequested", {name: actor.name, check: link})` ("Your keeper has requested {name} make a {check} roll."). The "Whisper to selected tokens" button (`CoC7ContentLinkDialog.#onSubmit`) first drops actors without owners: `canvas.tokens.controlled.filter(t => t.actor.owners.length)`. `actor.owners` is every non-GM user with OWNER permission.

Rollbox does the same with public calls: `ChatMessage.create` per character with the owners' ids, and CoC7's own strings via `game.i18n.format` so players see the wording they know. **Never create the message with an empty `whisper` list**: Foundry makes it public. Send to chat is the same without `whisper`. CoC7's own public wording is `CoC7.MessageCheckRequestedWait` ("… roll requested by your Keeper. Wait before clicking!"); Rollbox posts `MessageTargetCheckRequested` publicly instead, one per character, so the table sees whose roll it is.

### v14 chat modes

v14 renamed roll modes: the setting is `core.messageMode` with modes `public`, `gm`, `blind`, `self`, `ic`. `core.rollMode` is now a deprecated shim (until v16) that returns the old names (`publicroll`, `blindroll`, …). CoC7 8.15 builds its mode constants from the new names but reads `core.rollMode` first, so wherever it falls back to "the roller's chat mode" it compares old names with new ones. For a check without `blind`, Foundry's shim still applies the chat mode, but CoC7's blind-card buttons don't appear; the Sanity card's GM or blind whisper never happens. Each first roll also logs one deprecation warning. Rule: Rollbox always sends `blind` or `blind:false`. Rollbox never reads `core.rollMode` or calls `ChatMessage.applyRollMode`; the v14 deprecation warnings in Void's console come from CoC7 (`roll-normalize.js`, `check.js`).

### Labels

- **The Keeper's text** (Void, 2026-11-13): the check as CoC7 names it, " · ", then the text, built in `roll-requests/` (`keeperLabel`) for requests and Copy link alike: "Hard Spot Hidden · notice the knife"; combined "Spot Hidden + Listen · notice the knife". The Sanity menu builds "Sanity check · <cause>" itself, since only it knows whether the cause was typed; with no cause it sends "Sanity (1/1D6)", so players don't see CoC7's own "[regular] SAN loss(0) (1/1D6)" (the "(0)" is the `poolModifier:0` the link must keep). CoC7 puts the label into its request sentence unchanged ("make a Hard Spot Hidden · notice the knife roll").
- Idea and Know are INT and EDU checks with the Keeper's own label ("INT · Idea"; Void, 2026-11-15); a weapon "Firearms (Handgun) with the .38 Revolver"; an improvised weapon "Fighting (Brawl) with Candlestick". Labels stay short because CoC7's link button doesn't wrap.

## Cards

### Combined (all or any)

By link: `subtype:combinedall` or `combinedany` with `rolls`. On click, `CoC7ChatCombinedMessage.createGroupMessage({defaultActor, isCombat, rollRequisites: rolls.split("&&"), type})` (`apps/chat-combined-message.js`). For a player it asks the Keeper's client to create the card through CoC7's socket (`CoC7SystemSocket.requestKeeperAction`), so a Keeper must be logged in. The card shows a Roll button to the owner; one roll is compared with every check (`rollForActor`) and the card shows success or failure for All or Any (`getTemplateData`).

Roll strings (`parseRolls`): `[actorUuid#]type#key[#modifier…]`
- `type`: `characteristic`, `attribute`, `skill` or `item`; `key` as `name` in the link table.
- Modifiers, each after `#`: `+1`/`-2` dice; one digit for difficulty `1`–`4`, where **`0` means hidden** (not `?`); `p` tags the roll "Pushing" and removes its Push button.
- Actor prefix optional: without it, the clicker's actor. All rolls on one combined card must be the same actor.
- No blind: the combined card is always public (Gap 5). Missing skills are added to the sheet (`addActorRoll`, see "Skills the actor doesn't have").
- Several characters: one whispered link per character, each without an actor prefix.

### Opposed

Roll strings as for combined, each with its actor's uuid, joined by `&&`. Created by `CoC7ChatOpposedMessage.createGroupMessage({defaultActor, isCombat, rollRequisites})` (`apps/chat-opposed-message.js`), which always makes a **new** card.

From code, the only route that makes exactly one card:

```js
CONFIG.CoC7Link.documentClass._onLinkActorClick(actorA, {
  check: "check", subtype: "opposed", combat: false,
  rolls: `${actorA.uuid}#skill#Stealth#+1&&${actorB.uuid}#characteristic#pow`
});
```

`actorA` must be a real actor (CoC7 reads `actor.uuid` before parsing). It's an internal (underscore) method, so it's guarded and in the registry. Not `game.CoC7.macros.linkMacro` and not a link the Keeper clicks: the Keeper has tokens selected, so `_onLinkClick` would make one card per token (so an opposed roll can't be copied as a link). Not `actor.runRoll({cardType: "C/OP"})`: it joins any open opposed card under a day old, then throws.

- **Difficulty:** opposed rolls have no difficulty to choose (p. 92), but **always send `#1` (Regular)** in each roll string: without a digit `parseRolls` uses the world's `defaultCheckDifficulty`, which can be "unknown" (hidden).
- **Missing skills:** making the card adds any missing skill to that side's sheet (`addActor` → `getItemOrAdd`, on the Keeper's client, NPCs included; Void accepted this, 2026-11-13); a skill CoC7 can't find stops the card with "Unknown skill", so Rollbox checks first (`coc7FindsSkill`) and tells the Keeper instead.
- **Start rolls:** sides can be removed until the Keeper clicks **Start rolls** (`rollNoPlayers`, Keeper-only). That click locks the card and rolls every side whose owners aren't online: each side gets `playerOwnersOnline` when it is added to the card (non-GM users that are `active` and `actor.canUserModify(user, "update")`), and `rollNoPlayers` rolls every side whose list is empty. The list is taken when the card is made, so a player who logs in afterwards still has their side rolled by Start rolls (seen at the table 2026-11-14 for an offline player). Only then can players roll their side (`rollActor`). Rollbox clicks Start rolls on the Keeper's client (Gap 8, B; "Clicking a card button from code") and tells the Keeper ahead which side it rolls ("Keeper rolls (NPC)", "Keeper rolls (player offline)") from `actor.owners` and `User#active`.
- **Comparing and ties:** `getTemplateData` compares: higher success level wins; equal levels set `isTie` and show "Tie" with no winner outside combat (Gap 7); Advantage buttons only appear in combat. CoC7's house rule `opposedRollTieBreaker` only changes the order of sides on combat cards. So the view shows the Keeper which side has the higher value (p. 91), comparing the two values only; CoC7 still compares the rolls. The card offers no Luck and no Push.
- **Roles: a card always has an attacker and a defender.** The first roll string is CoC7's attacker, the second its defender; `_onLinkActorClick` is called with the first side's actor, and Swap sides only reverses the two. Void asked for cards with both sides at no role; not possible through `_onLinkActorClick` (or any public route): `parseRolls` reads `#a` / `#d` from a roll string, but `addActor` then resets every side to `participant.none` (line 477 of the recovered file); `newGroupMessage` (lines 200–217) makes the last side with no role defender and the rest attacker when the card has exactly two sides. `getTemplateData` sets `allRollsAssigned` only with exactly one attacker, one defender and no side without a role (lines 680–681), and compares only then; otherwise the template shows a disabled "An opposed card needs an attacker and defender" (`CoC7.ErrorOpposedRollsMissingAttackerDefender`) in place of Start rolls (`opposed-roll.hbs` lines 50–51). A one-side card joined later (`joinGroupMessage`, which keeps both at none) would need `runRoll` with `C/OP`, which joins any open card under a day old and then throws, and would still not compare. So Rollbox keeps Swap sides and its Attacker/Defender tags. Outside combat the roles don't change who wins. The card's Keeper-only role button doesn't cycle to none either: clicking the attacker makes it defender (and the other attacker); clicking any other side makes it attacker (lines 253–266).
- **No card:** `send()`'s result names why in `skipped` (a side's skill CoC7 can't find, a name that can't go in a roll string, CoC7's link handler missing or throwing), and the view shows it.

### Sanity

`CoC7SanCheckCard` (`apps/san-check-card.js`, `templates/chat/san-check.hbs`): the player rolls Sanity on the card. On a failure the Keeper first clicks "Perform involuntary action"; the loss is rolled on the card (`rollSanLoss`) and applied only when the Keeper clicks **Apply: N** (`sanLossApplied` → `applySanLoss` → `actor.loseSan`). Both buttons are Keeper-only (`keeper-only-block`, removed for players by `hooks/render-chat-message-html.js`). The INT roll, bouts of madness, indefinite insanity and Cthulhu Mythos all follow on the same card. (Confirmed at the table 2026-11-13: SAN 60 → 54 only after Apply, then CoC7's bout-of-madness and Mythos options, and the creature recorded.)

- `sanReason` is a record per actor (`maxLossToSanReason`): later losses to the same source are capped by what was already lost to it. Use the creature or source name (e.g. "Ghoul"), not free text. The players see the link's `{label}`.
- **Both losses go to Foundry's `Roll`.** `getTemplateData` evaluates `new Roll(sanMax).evaluateSync({ maximize: true })` every time the card is drawn (`maxRollableSanLoss`); the loss is rolled with `new Roll(sanLossFormula)`; on a fumbled Sanity roll the loss is the maximum of `sanMax`. A loss that is only a number is used as that number, not rolled. So a malformed loss breaks the card, not just the roll: Rollbox accepts only whole numbers and `[N]D<faces>` terms joined by `+` or `-` (`sanityLoss`, one rule for the menu and the request).
- **Creature cap:** with `sanReason` set, a creature the character has already lost the maximum to (`actor.maxLossToSanReason(sanReason, sanMax) === 0`) needs no loss roll: the card marks the character immune to it. A rolled loss above the remaining cap is cut to it ("limited loss to creature").
- **A loss of `0`** (e.g. the success side of 0/1D6) needs no loss roll on the card.
- The card's Sanity roll button is `[data-action="rollSanCheck"]` in an `owner-and-keeper-block` (the owner or the Keeper can click it); the message flag is `flags.CoC7.load.as === "CoC7SanCheckCard"` with `actorUuid`. Rollbox clicks it for NPCs (see "Rolling NPCs").
- Blind: the link parses `blind` but doesn't pass it to the card; the card follows the clicker's chat mode, which on v14 never matches ("v14 chat modes"). Gap 4.
- CoC7 never offers Push or Luck on a Sanity roll.

### Rollbox's own card: Assist

Nothing new from CoC7. Each roller gets an ordinary characteristic check (`checkRequest` with `str` or `siz`) through `roll-requests/`, so the links, whispers and NPC rolls are exactly the Check menu's. The Assist card is Rollbox's own public `ChatMessage` (HTML built with `escapeHtml`, `speaker: { alias: <the Keeper's name> }`, no `whisper`), as the request messages are made. Rollbox doesn't read the rolls back (Void, 2026-11-14; reading CoC7 results was researched, not planned: `game.CoC7.messageResults()` reads a card's result, and CoC7 8.15 reports the first roll after a push).

### Clicking a card button from code

CoC7 attaches each card's listeners in its async `renderChatMessageHTML` handler, after awaiting `CoC7Utilities.canModifyActor` (`hooks/render-chat-message-html.js`). A click in the same tick as Rollbox's own render hook lands before the listeners and does nothing. Rollbox waits 250 ms and retries up to eight times (`card-buttons.js`). (Confirmed 2026-11-13 for Start rolls.)

- `clickCardButton` returns a function that ends the watch quietly; Rollbox calls it when `_onLinkActorClick` throws, so the Keeper isn't told 15 seconds later to click a card that never came.

### Rules CoC7 already enforces on its cards

- No Push and no Luck on Sanity rolls; no Luck on Luck rolls; no Luck after a push or on a fumble (`CoC7DicePool#availableButtons`, `apps/dice-pool.js`).
- CoC7 **does** offer Push on a failed Luck roll, which p. 84 forbids. Rollbox can't change CoC7's card; the Keeper refuses at the table.
- The opposed card offers no Luck and no Push.

## Rolling NPCs

On the Keeper's client: `actor.skillCheck(name, true, {difficulty, poolModifier, blind: true})`, or `characteristicCheck(key, true, …)` / `attributeCheck(key, true, …)`. `true` is fastForward (no dialog). `blind: true` puts the card in CoC7's blind mode: whispered to GMs only (`CoC7Check#getChatData`), and the Keeper sees the full result plus reveal and force buttons. NPCs have no player owner, so the roll is made at once. (Confirmed 2026-11-13: a Hard Spot Hidden on two NPCs gave Keeper-only blind cards, no dialog.)

`actor.runRoll({characteristic | attribute | skillName, difficulty, poolModifier, isBlind: true, fastForward: true})` does the same and returns `{result, successLevel, passed, …}`. `difficulty` here is a number (`1`–`4`, `-1` hidden), not `+`. It is the only way to roll Idea or Know (`characteristic: "idea"` or `"know"`) or a raw value (`rollType: "R/MA", threshold: 20`). It throws for opposed, combined and Sanity card types.
- Idea and Know ignore `poolModifier`: their dice are `poolModifierIdea` / `poolModifierKnow` (`normalizeRequest`, which then falls back to the actor's `system.config.idea.bonusDice`). Rollbox doesn't roll them this way since 0.1.1.
- A raw-value card's flavour is "(20%) - Regular difficulty", with no skill name, and `runRoll` passes no custom flavour, so Rollbox whispers the Keeper a note naming the skill.
- A check with 0 dice picks up the skill's, characteristic's or attribute's own `bonusDice` in `normalizeRequest`.

Standby cards: when the Keeper triggers a check on an actor that has a player owner and CoC7's world setting `stanbyGMRolls` (CoC7's spelling) is on (default true), CoC7 posts a card with a Roll button only the owner and the Keeper can use (`roll-standby.hbs`). The actor check methods allow this; `runRoll` prevents it unless given `preventStandby: false`.

Rollbox's NPC rules (`roll-requests/keeper-rolls.js`; settled with Void, 2026-11-13, where CoC7 can't do what DESIGN.md says):
- **Missing skill:** a raw roll (`R/MA`) at Rollbox's base value, nothing added to the sheet (Gap 1, C).
- **Combined check:** one private raw roll at the highest value for "Any one" (p. 203) or the lowest for "All of them", which passes or fails exactly when the combined card would; a note to the Keeper names the checks. CoC7's combined card is always public and adds missing skills, so it isn't used for NPCs.
- **Idea and Know** (history): until 0.1.1 an NPC's Idea or Know was `runRoll({characteristic: "idea"|"know"})`, CoC7's own Idea or Know card (Gap 6, B). Idea and Know are now sent as INT/EDU checks with a label (Void, 2026-11-15), so an NPC gets an ordinary private INT or EDU check.
- **Labels:** CoC7's private NPC card (and the raw `R/MA` card) shows no link label, so Rollbox puts the label in its Keeper note ("Guard: Hard Spot Hidden · notice the knife").
- **Order:** how to roll is decided first, then the Keeper's note is posted and CoC7 is called once, so the note always comes just before CoC7's card.
- **Sanity:** CoC7's Sanity card made on the Keeper's side (`_onLinkActorClick` with `check: "sanloss"`), and Rollbox clicks its Sanity roll (`rollSanCheck`). The card is public (Gap 4).
- **Opposed:** the NPC side is rolled by Start rolls (see "Cards: opposed").

## Skills and weapons

### Skill-name matching is skill-values'

`scripts/skill-values/` is the only code that matches skill names (`comparable`, `isCocid`, `tableSkill`, `groupBase`, `sheetSkill`; for the menus and roll-requests also `findSkillRow`, a skill's row by CoC ID then name, `sameSkill`, whether two references are one skill, `skillKey`, a menu row's key, and `tableBaseFor`, a table skill's base for one actor) and the only reader of `base-skills.js`, so the menus list a skill and `roll-requests/` sends it by one rule. `checkChoices(actor, { sanity })` gives the rows of the Check menu's and the Opposed view's three tabs, so both list the same checks in the same order. Rollbox compares whole names (no accents, lower case, single spaces) and CoC IDs itself; it doesn't call CoC7's `actor.getSkillByName` (which matches the CoC ID or compares only `skillName`, "Handgun", ignoring accents).

The own-language rule: a sheet's own language (CoC7's `system.properties.own`, often renamed "Language (English)") is listed as Language (Own)'s row by the menus, and a request for Language (Own) by its CoC ID (`i.skill.language-own`) finds that item; a request by name doesn't take the flag, because CoC7 finds a renamed own language only by CoC ID.

### Skills the actor doesn't have

CoC7 8.15 does **not** roll a generic 1D100. `actor.skillCheck` calls `actor.getItemOrAdd(name, "skill")` (`models/actor/document-class.js`): it looks on the actor (by name, ignoring accents, or by CoC ID); if the skill isn't there, it looks in world items and then every Item compendium (filtered by era) and **adds the skill to the actor's sheet**, with the notice "This skill {name} has been added at {percent}%". If it finds nothing, nothing happens. The combined and opposed cards do the same (`addActorRoll`, `addActor`). It runs on the clicker's client: the player's for their character, the Keeper's for NPCs. The added value is CoC7's skill item's base, not Rollbox's table.

Rolling a value without adding anything: `actor.runRoll({rollType: "R/MA", threshold: 20, difficulty, poolModifier, isBlind, fastForward: true})` (`CoC7Check#rollManual`). The card shows the actor and "(20%) - Regular difficulty", but no skill name. Keeper side only; there is no link form. See Gap 1.

- **Lookup order** (`getItemOrAdd`): a CoC ID (`i.skill.…`) → the actor's item with that CoC ID, else `game.CoC7.cocid.fromCoCIDBest({cocid})`, used only when it returns exactly one item; a UUID → that item on the actor (`items.get`); a name → `actor.getItemByName`, then world items, then each Item compendium's index (`pack.getIndex()`; CoC7 adds `system.skillName` and the CoC ID flag to the index fields), skipping skills whose `flags.CoC7.cocidFlag.eras` doesn't include the world era.
- **Names compare only the part in brackets.** `getItemByName` and `getSkillByName` compare `system.skillName` ("Handgun" for "Firearms (Handgun)", from `guessNameParts`), without accents or case. A sheet's renamed own language ("Language (English)") isn't found as "Language (Own)" by name, only by CoC ID.
- **If CoC7 finds nothing, a player's click does nothing**: `skillCheck` returns silently. So a request for a typed skill no compendium has (e.g. "Pilot (Boat)": CoC7's compendium has only "Pilot (Any)") is dead. Rollbox checks first with the same lookups and tells the Keeper instead (`docs/roll-requests.md`, `coc7FindsSkill`).
- Requesting a sheet skill by a CoC ID the sheet item doesn't carry would make CoC7 add a duplicate from the compendium; Rollbox requests on-sheet skills by the item's own CoC ID or its name, and NPC rolls by the item's uuid.

### A weapon's skill

Read in CoC7 8.15 (`models/item/weapon-system.js`, `models/actor/document-class.js`, `apps/chat-combat-ranged.js`, `apps/chat-opposed-message.js`, `templates/items/weapon-header.hbs`, `apps/chat-combat-melee.js`).
- **Stored skill:** `system.skill.main` and `system.skill.alternativ` (CoC7's spelling), each `{ name, id }`; `id` is the skill item's id on the actor's sheet. On compendium weapons the `name` can be a CoC ID (`i.skill.throw`, set by CoC7's `coc-id-batch.js`); Rollbox treats a name starting `i.skill.` as a CoC ID, so labels use the skill's name. When CoC7 adds a weapon to an actor through `getItemOrAdd` / `getItemAdding`, it resolves each name to a sheet skill (adding the skill if needed) and stores its id and name. CoC7's own rolls read only the id (`skillMain`, `skillAlternative`, `isSkillSet`).
- **`system.usesAlternativeSkill`** is true when the weapon has the automatic (`auto`), burst (`brst`) or thrown (`thrown`) property, whatever the shot.
- **Which skill CoC7 uses:** its opposed and combined cards take `skill[usesAlternativeSkill ? "alternativ" : "main"].id` and fail with "Unknown skill" when that id is empty. Its ranged attack card uses the alternative only for burst or full-auto fire and the main skill for single shots.
- **Two skills:** CoC7's weapon sheet shows the alternative-skill field only when the weapon is automatic, burst or thrown (`usesAlternateSkill`), and CoC7's own lists of a weapon's skills (`getWeaponSkills`, the melee card) add the alternative only when its id is set. Rollbox offers two rows only when `usesAlternativeSkill` is true and the two stored skills differ; `weaponRequest({ skill: "main" | "alternative" })` picks one. Without `skill`, the cards' rule applies.
- **Fallback:** CoC7's `skillAlternative` getter returns the main skill when the alternative's id is empty, and so does Rollbox's `weaponSkill` (alternative id and name both empty). The opposed and combined cards don't fall back; Rollbox never sends a weapon to them.
- **Weapons are sent as labelled skill checks** (Gap 2, A), never `@coc7.item`.
- **Damage:** an improvised weapon's damage goes in the request as a Foundry inline roll `[[/r formula # flavor]]`. `DB` is the character's damage bonus (`system.attribs.db.value`), and `½DB` half of it, filled in the way CoC7's `CoC7Utilities.halfDB` halves it (thrown weapons add half DB). The Item menu asks for half when the improvised skill is Throw.

### Actor and item data

| Data | Path | Notes |
| --- | --- | --- |
| Actor types | `character`, `npc`, `creature`, `vehicle`, `container` (CoC7 8.15 `system.json` `documentTypes.Actor`) | Rollbox uses character, npc, creature. A creature is `actor.type === "creature"` (Foundry's public `Document#type`); CoC7's stat-block importer makes everything that isn't an NPC a creature. Assist marks newly selected creatures as targets by that type alone; a creature made as an `npc` isn't marked automatically. |
| Characteristics | `system.characteristics.<key>.value` | `str con siz dex app int pow edu`; NPCs may also have `.formula` |
| HP, MP | `system.attribs.hp.value` / `.max`, `system.attribs.mp.value` / `.max` | |
| Luck | `system.attribs.lck.value` | No max |
| Sanity | `system.attribs.san.value`, `.max`, `.dailyLoss`, `.dailyLimit` | |
| Build, DB, MOV | `system.attribs.build.value`, `system.attribs.db.value`, `system.attribs.mov.value` | DB as CoC7 computes it (`dbFromCharacteristics`): the numbers `-2`, `-1`, `0` or text `1D4`, `2D6` …, no `+` sign; CoC7 adds the sign itself (`apps/chat-damage.js`) and halves it for thrown weapons with `CoC7Utilities.halfDB` (not exported) |
| Idea, Know | `system.config.idea.value` (= INT), `system.config.know.value` (= EDU) | Worked out in `prepareBaseData`, not saved. Not read by Rollbox since 0.1.1 |
| Occupation | `system.infos.occupation` (text); characters may also have an `occupation` item (`actor.occupation`) | NPCs also have `system.infos.type` |
| Skills | items with `type === "skill"` | `item.system.value` is the sum of `system.adjustments` (`base`, `personal`, `occupation`, `archetype`, `experiencePackage`, `experience`) unless an Active Effect overrides it |
| Skill base value | `item.system.adjustments.base` (number), from the formula `item.system.base` (e.g. `1/2*@DEX`, `@EDU`, `20`), rounded down (`CoC7Utilities.setMultipleSkillBases`) | Not reliable for "trained": CoC7's actor importer (`apps/actor-importer.js`) stores an NPC's whole skill value as both `system.base` and `adjustments.base`. Rollbox compares `system.value` with its own table instead. |
| Own language | Skill with `system.properties.own` (CoC ID `i.skill.language-own`); sheets often rename it, e.g. "Language (English)" | Rollbox treats it as Language (Own) (see "Skill-name matching") |
| Hard, Extreme | `Math.floor(value / 2)`, `Math.floor(value / 5)` (`CoC7DicePool`, `apps/dice-pool.js`) | Rollbox's `half` and `fifth` match |
| World era | CoC7 world setting `worldEra` (`setup/register-settings.js`, default `standard`; keys in `constants.js` `ERAS`: `standard`, `modern`, `modernPulp`, `pulp`, …) | Never used to hide skills. The compendium's per-skill era tags (`flags.CoC7.cocidFlag.eras`) pick which item CoC7 uses per era and are incomplete. roll-requests reads `worldEra` only to predict whether CoC7's lookup will find a missing skill. |
| Skill name | `item.name` (`Fighting (Brawl)`), split into `system.specialization` and `system.skillName` | See "Skill-name matching" |
| Skill CoC ID | `item.flags.CoC7.cocidFlag.id`, e.g. `i.skill.spot-hidden`, `i.skill.dodge` | Same in every language; prefer it for matching |
| Skill can be pushed | `item.system.properties.push` | False for combat skills |
| Weapons | items with `type === "weapon"` | Skill: `system.skill.main.{id,name}` and `system.skill.alternativ.{id,name}`; `system.usesAlternativeSkill`; getters `system.skillMain`, `system.skillAlternative` return the skill item. Ranged: `system.properties.rngd`. Damage: `system.range.normal.damage`. |
| Player owners | `actor.owners` (non-GM users with OWNER); Foundry's `actor.hasPlayerOwner` | Online: `owners.filter(u => u.active)`. A user's assigned character: `user.character`. |
| Token actors | `token.actor` (a synthetic actor for unlinked tokens, uuid `Scene.….Token.….Actor.…`) | Use `token.actor.uuid` in roll strings |
| `actor.items` | Foundry `Collection` (a `Map`) | Its `[Symbol.iterator]` yields documents, not `[id, doc]` pairs (`common/utils/collection.mjs`, build 368), so `Array.from(actor.items)` is a list of items |

## The panel and CSS

### Selection hook and the panel's place (Foundry v14 build 368)

- **Hook:** `controlToken(token, controlled)`. `PlaceableObject#control` and `#release` (`client/canvas/placeables/placeable-object.mjs`) call `Hooks.callAll("controlToken", …)` once per token, after `canvas.tokens.controlled` is updated. Clicking a token releases the others first (one call each); a box-select fires many. Coalesce to one redraw per frame.
- Scene change: `PlaceablesLayer#_tearDown` clears the selection **without** firing the hook. Also hide on `canvasTearDown` and redraw on `canvasReady` from `canvas.tokens.controlled`. Changing to another layer (walls, lights) releases every token through `releaseAll`, which does fire it.
- **Players list:** `ui.players`, class `foundry.applications.ui.Players` (ApplicationV2, id `players`, tag `aside`, no frame). `templates/ui/players.hbs`: `#players-inactive` (hidden list, grows upward when expanded) then `#players-active`, the visible card (active users, and `#performance-stats` with latency, FPS and the expand button). The hook `renderPlayers(app, element, context, options)` fires on each render; CoC7 uses it to add the world era after `#performance-stats`.
- **Layout:** `templates/views/game.hbs` puts `#players` in `#ui-left-column-1` after `#scene-controls`. That column is 72px wide, a flex column with `justify-content: space-between` and `pointer-events: none`. `#players-active` is 200px wide with `var(--background-color)`, `var(--border-color)`, 8px radius and 6px 8px padding.
- **Attach:** insert the panel as a sibling just before `#players` (`document.getElementById("players").before(panel)`), with `margin-top: auto` (otherwise `space-between` floats it to the middle of the column), `width: var(--rollbox-width)` (200px) and `pointer-events: all`; on `renderPlayers`, put it back if missing. Not inside `#players`: Foundry replaces that element's contents on each render. The column carries Foundry's UI scale, so the panel scales with it.
- **Built:** the panel is 200px wide in the column; its buttons and flyout are absolutely positioned to its right (`left: calc(100% + var(--rollbox-gap))`, bottoms aligned), so the column keeps its width and they overlay the canvas. The column has `pointer-events: none`, so each card, the button column and the flyout set `pointer-events: all`. (Checked by Void in Foundry, 2026-11-13: position, width, look and numbers correct; players see no panel.)
- **Opening a sheet:** CoC7 8.15's actor sheets are ApplicationV2 (`CoC7ModelsActorCharacterSheetV2` and others); `ApplicationV2#render(true)` is treated as `{force: true}` (`client/applications/api/application.mjs`).

### Moving the panel (Foundry v14 build 368)

- **Where a moved panel goes:** Foundry's `#interface` (`templates/views/game.hbs`): the element holding `#ui-left`, `#ui-middle` and `#ui-right`, `position: relative` and stretched to the screen by `body.game` (a fixed flex row). Foundry never draws it again, and the camera dock is placed beside it (`CameraViews#_onRender` puts `#camera-views` before or after `#interface`), so `#interface` shrinks to leave room for it. The panel is appended to it, positioned absolutely, at `z-index: var(--z-index-app)` (30, the UI columns' level; windows are `--z-index-window`, 100, above). Docked, it stays in `#ui-left-column-1` as before.
- **Set the moved panel's position, size and stacking inline**, never only in a stylesheet: Foundry reads a module's `module.json` (and so its `styles` list) only when the world is launched, so a stylesheet added to `styles` isn't loaded after an F5, only after Return to Setup and launching the world again. Session 15's first build kept the floating rules in a new `position.css`; at the table it wasn't loaded, the panel stayed a static flex item in `#interface`, its offsets pushed it off the bottom of the screen, and that spot was saved, so it never came back. Now: inline styles, a check after every placement that the panel's own box is where it was put (else it docks), and a saved spot that is off screen or unreadable is ignored. (confirmed 2026-11-15)
- **UI scale:** the left column carries Foundry's UI scale as a transform (`#ui-left { transform: scale(var(--ui-scale)) }`; `--ui-scale` is set on `body` by `Game#configureUI`). Outside the column the panel multiplies it in itself: `transform: scale(calc(var(--ui-scale, 1) * <Panel size>))` from the anchored corner.
- **The spot** is measured from the corner of the screen quarter the card was dropped in (`{corner, x, y}`), so a resized window keeps the panel near the same edges and a taller card grows away from the edge; it is clamped to the screen when placed, without changing the saved value.
- **Menus mirrored by classes** (`position.css`): `rollbox-menus-left` makes the panel a flex column aligned to its right edge (`align-items: flex-end` overflows on the start side, so the wider Opposed stage runs out to the left) and the side `right: calc(100% + gap)` in `row-reverse`; `rollbox-grow-down` puts the side at `top: 0`. An open menu running off the screen shifts the panel by the overflow of the card, `.rollbox-side` and `.rollbox-stage` boxes together, without saving it.
- **Dragging:** pointer events on the document while a header is pressed (no pointer capture: moving the element into `#interface` would end it), 4px before a press counts as a drag. Images in the cards get `-webkit-user-drag: none`, or Chromium starts its own image drag and cancels the pointer.
- **Foundry's layout, measured from build 368's `foundry2.css`:** `#ui-left` has 16px padding and gaps, `#ui-left-column-1` is 72px (two 32px control columns and an 8px gap), `#ui-left-column-2` (scene navigation) 200px; the sidebar is its tab strip then `#sidebar-content` (`--sidebar-width` 300px), which slides off to the right when collapsed; `#chat-notifications` and, when the sidebar is collapsed, the chat input live in `#ui-right-column-1` beside it; `#hotbar` is centred in `#ui-middle`, 60px tall with a 16px bottom margin.

### The menu host

- **`registerMenu(id, { title, render, layout, staysOpen, columns })`** (`mini-sheet/menu-host.js`): each menu part plugs in from its own `register…()`. `layout: "replace"` draws a menu in the card's place (a stage after the card slot) and hides the card and the button column until it closes; the Opposed view is a row of mini sheet, opposed card, mini sheet that runs over the canvas. `staysOpen: true` keeps a menu open while anything is selected even when its button isn't offered (Assist with one token), and `render` gets `selectionChanged` so a menu can keep its choices over a selection change. `columns` gives the names card's value columns while that menu is open, and `render`'s context gets `cardChanged()` to redraw the card when they change; Sanity shows SAN alone from the host's own table.
- **Opening with a starting state** (Void, 2026-11-15): `host.open(id, start)` opens a menu with a starting state (Check: `{tick, add, plain, send, focus}`; Other: `{section, plain, send}`; Opposed: `{first, picks, create}`). The render's context gets `start` and `setTitle(text)` (Other's title follows its section), and a render may return a controller `{ apply(start) }`: while that menu is open, `open` with a start calls `apply` instead of drawing it again, so the Keeper's other choices stay. A send asked for by a start goes through the menu's own send, so its result line is the menu's.
- **Every control lives inside the open menu** (Void, 2026-11-14): the names card and mini sheet show information only. Exceptions (Void, 2026-11-15): with moving allowed, dragging a card header moves the panel; the one-character mini sheet's characteristics, SAN and Luck are buttons that open their menu with CoC7's sheet shortcuts (`mini-sheet/sheet-clicks.js`; DESIGN.md, "The mini sheet's values"). Rollbox never calls CoC7's sheet handlers for them.
- **Shared controls** (`scripts/shared/`, [shared.md](shared.md)): the value line, the compact dice picker, the Blind toggle, the status line, and `menu.js`'s helpers (tabs and search, how rows, the main button's words, the Send runner and the result). The dice picker writes the formula text the requests take ("1D4+1", "1D6+DB", "1D4+½DB"); each menu passes its own rule for the value line (`sanityLoss`, `damageText`). The dice are matched longest first in its parser, or "1D100" reads as D10 and 0.

### CSS: layers, scoping and variables

- **Cascade layers:** Foundry puts its CSS in layers (`reset, variables, elements, blocks, applications, compatibility, layouts, system, modules, exceptions`) and loads a module's `styles` into the `modules` layer unless `module.json` names another (build 368 server `view.mjs`). So Rollbox's rules beat Foundry's element and application styles and CoC7's `system` styles without `!important`; only the `exceptions` layer beats them.
- **Foundry's own look:** Foundry's players card and scene control buttons use `--color-cool-5-75` (background), `--color-cool-4` (border), `--color-cool-3` (hover border) and `--color-warm-2` (active border) (`foundry2.css`, build 368). Rollbox's dark palette starts from them, with fixed light text colours (`--color-light-1/2/4`), because Foundry's themed text colours turn dark under its light interface theme while Rollbox follows its own Theme setting.
- **Variables on `.rollbox-panel`:** sizes `--rollbox-width` (200px, Foundry's `#players-active`), `--rollbox-gap` (8px), `--rollbox-radius` (8px), `--rollbox-col` (30px, one names-card value column; JS sets only `--rollbox-cols`, the number of columns), `--rollbox-sheet-height` and `--rollbox-button-gap` with `--rollbox-button-height` worked out from them, `--rollbox-row-height` / `--rollbox-row-gap` (lists), `--rollbox-scale` (Panel size), `--rollbox-opacity` (Panel transparency), `--rollbox-color` (Panel colour); and the theme's palette (below). Every menu's CSS uses only these, so redefining them on the panel restyles every menu.
- **`shared.css` order:** loaded right after `mini-sheet.css` and before every menu's file, so it is the base and a menu's own rule of the same weight wins. One rule, `.rollbox-panel [hidden][hidden] { display: none }`, keeps anything hidden hidden: two attribute selectors outweigh any one-class rule under `.rollbox-panel`, so neither the menus nor the panel need `[hidden]` lists (only `.rollbox-panel[hidden]` itself has its own rule). Generic classes from `shared/menu.js` (`rollbox-btn`, `rollbox-segment`, `rollbox-tab`, `rollbox-line`, `rollbox-input`, `rollbox-list`, `rollbox-row`, `rollbox-result` …) carry the shared look; a menu's own class stays only where its CSS or a test selects by it.
- **Flex lists of buttons:** a button with `min-height: 0` in a column flex box with a `max-height` shrinks below its text, and the rows overlap instead of scrolling. Give the rows (and everything between them and the scrolling box) `flex-shrink: 0`.
- **Foundry's radio buttons and tick boxes** are drawn as Font Awesome glyphs in `::before` / `::after`, sized by `--checkbox-size` (`var(--font-size-20)`, 20px), not by the input's box (`appearance: none`). Shrinking the input with `width` / `height` alone leaves the glyph at 20px, overflowing below it; in a scrolling list the last row's glyph made the list scroll. Set `--checkbox-size` on the input too (`shared.css` does for every list row).
- **Chromium features used** (Foundry's Electron): `color-mix()`, `:has()`, `field-sizing: content`, `writing-mode: vertical-rl`, the `inert` attribute.

### Sizes: Panel size, buttons, lists

- **Panel size:** `transform: scale()` with `transform-origin: left bottom` on the panel, not `zoom`: a transform leaves the element's layout box alone, so the panel's place above `#players` doesn't move and the scaled panel grows up and right over the canvas, never over the players list. No transform at 100%. Anything with a `max-height` in `vh` inside the panel must divide it by `--rollbox-scale` to stay on screen (the flyout and the opposed card do).
- **Measuring:** `offsetHeight` is the layout height and ignores `transform`, so the Panel size's `scale()` doesn't change it; it is 0 while the element or an ancestor is `hidden`. Chromium's computed `rowGap` gives a flex column's `gap` in pixels.
- **The request buttons have one fixed height, set in CSS** (Void, 2026-11-14): no script sets `--rollbox-button-height`. In `mini-sheet.css` it is `calc((var(--rollbox-sheet-height) - 2 * var(--rollbox-button-gap)) / 3)`: three buttons and the two gaps equal the one-character mini sheet at 100%, measured once in Chromium with Foundry's own stylesheet and fonts (`--rollbox-sheet-height` 182px; `--rollbox-button-gap` 6px, which the button column's `gap` also uses), so 56.67px. Changing the gap keeps them matched. Measuring in JS didn't hold: with eight names the invisible mini sheet under the names card is as tall as the card, so the buttons grew with it.
- **Lists that must show ten rows** set every row's height to a CSS variable built from the font-size variables and line heights (`calc(6px + 1.25 * (var(--font-size-12) + var(--font-size-10)))`), and `max-height` to ten of them plus the gaps, so it holds at any font size; a fixed pixel `max-height` didn't (Void's table check: 365px scrolled at nine names).
- **The names card is never shorter than the mini sheet:** the card slot is one grid cell holding an invisible copy of the first character's mini sheet (`sheetGhost`) under the names card.

### Appearance: theme, colour, transparency

- **Two themes, two palettes** (Void, 2026-11-14): the personal Theme setting (Dark | Light) toggles `rollbox-theme-light` on the panel, and `mini-sheet.css` redefines every palette variable under it: text, strong and muted text, placeholder, disabled, borders, accent (borders and fills) and accent text, the red warning, Assist's coral target, the Defender blue, the empty tick box, button fill, bar track, the pressed look, and the HP, MP, SAN and Luck bars (`--rollbox-bar-*`, the same in both themes for now). Every part's CSS uses only these variables, never a colour of its own. Every text colour has at least 4.5:1 contrast on the solid background (WCAG AA); disabled text and the empty tick box at least 3:1 on the default colours. Foundry's own interface theme (`body.theme-light`) is ignored: the panel follows Rollbox's.
- **The Panel colour is the tint within the theme:** the panel shows the picked colour itself when the theme's text reads well on it, otherwise its hue and saturation at the nearest HSL lightness that does, judged by WCAG relative luminance (at most 0.05 under Dark, at least 0.57 under Light, from the palettes' placeholders, the weakest text). The setting keeps what was picked (`mini-sheet/theme.js`, `shownColor`).
- **Switching the theme flips the colour:** the Panel colour's HSL lightness is mirrored (L → 100 − L), kept readable as above, hue and saturation kept, and saved to the colour setting with `game.settings.set` from the theme's `onChange` (`flippedColor`). A colour that already suits the new theme is left alone, so the switch is idempotent: a second client of the same Keeper, which also gets the theme's `onChange`, doesn't flip it back. The flip runs on the Keeper's client only.
- **Foundry's own controls:** Foundry colours placeholders and tick boxes from its interface theme through variables (build 368 `foundry2.css`): `--input-placeholder-color` on `input, select, textarea`, and `--checkbox-background-color`, `--checkbox-checked-color`, `--checkbox-disabled-color` (also `--checkbox-checkmark-color`, `--checkbox-size`) on tick boxes and radios, set per theme with `body.theme-light` / `.mixin-theme-light-forms`. Rollbox sets the same variables on its own inputs from its palette (`shared.css`); its `modules` layer beats Foundry's.
- **Transparency:** one variable on the panel, `--rollbox-opacity`; every background is `color-mix(in srgb, <the solid colour> <opacity>, transparent)`, so text keeps full opacity. Foundry's own players card is `--color-cool-5-75` (75% opaque, i.e. 25% see-through); Rollbox's default is 25%, the same look. A light background shows the map through more, so the Light theme lets half as much through for the same setting: `calc(50% + var(--rollbox-opacity) / 2)` as `color-mix`'s percentage (Chromium accepts `calc()` there).
- **Colour and transparency together:** the colour sets `--rollbox-color`, the solid background; the transparency mixes it with `transparent` through `color-mix`.

## Settings

Every setting belongs to a section with a heading and a master switch registered first.

| Scope | Stored | Use for | Note shown |
| --- | --- | --- | --- |
| `world` | On the server, one value for everyone; only the Keeper can change it | Rules that must match for everyone | Keeper setting, applies to everyone. |
| `user` | On the server, per user, follows them to any device | Personal preferences | Personal setting, affects only your screen. |
| `client` | One browser only | Device-specific values | Personal setting, affects only your screen. |

- **Sections:** each has a heading (Foundry core `h4.border`, margin-bottom 0, like CoC7's own settings) and a master switch registered first; the section's other settings dim when it's off. This is `void-coc7-modules`' `settings.js`, copied. A section can be dimmed by another section's switch; its heading goes before its own first setting.
- **Rollbox's sections, two groups:** "Keeper's Rollbox": master `rollboxEnabled` (user scope, Boolean, default true, personal note; `mini-sheet/settings.js`), then `rollboxSimplifiedDice` (Simplified dice UI: user scope, Boolean, default off, personal note, no reload; `shared/settings.js`; also hides the Sanity presets and Item damage quick-picks). "Appearance" (`mini-sheet/settings.js`, its master `rollboxEnabled`): `rollboxTheme` (user scope, String with `choices` dark / light, default dark), `rollboxColor` (user scope, `ColorField`, default `#0b0a13`), `rollboxTransparency` (user scope, Number 0–70 step 5, default 25) and `rollboxScale` (user scope, Number 80–150 step 10, default 100), each personal, no reload, with a Reset button; then `rollboxMovable` (Allow moving the panel: **client** scope, Boolean, default on, with a **Reset position** action button from its `button` data), `rollboxMenuSide` (Menus open to the: user scope, String with `choices` auto / right / left, default auto) and the hidden `rollboxOffset` (client scope, Object, default `{}`: the dropped spot), each personal, no reload. The position settings are client scope because a spot that suits one screen may not suit another. An earlier hidden `rollboxDiceEntry` is no longer registered.
- **Drop-downs (build 368, `applications/settings/config.mjs`):** a setting with `type: String` and `choices: {value: label}` becomes a `StringField` with those choices, which Configure Settings shows as a select. The saved value is the key (`"typed"`), not the label. (assumed)
- **Sliders (build 368, `applications/settings/config.mjs`):** a setting with `type: Number` and `range: {min, max, step}` becomes a `NumberField` with those bounds, which Configure Settings shows as a range slider. `onChange(value)` runs on the client whose value changed (`client-settings.mjs`), so a personal setting can apply at once with `requiresReload: false`. (assumed)
- **Colour settings:** Foundry v14 core registers no colour setting of its own; the way to get its colour picker is a `DataField` as the setting's `type`: `type: new foundry.data.fields.ColorField({nullable: false, initial: "#0b0a13"})`. `ClientSettings#register` accepts a `DataField`, `DataModel` or function as `type` (`client/helpers/client-settings.mjs`); `SettingsConfig` uses that field's own input (`applications/settings/config.mjs`), and `ColorField#_toInput` makes a `<color-picker>` (a text box and a native colour swatch). The value is saved as `"#rrggbb"`; `game.settings.get` and `onChange` give a `Color` (a `Number` subclass whose `toString()` and `css` are `"#rrggbb"`), because the `Setting` document runs `type.initialize(type.clean(value))`. `ColorField` only accepts six-digit `#rrggbb` strings (`isColorString`). Guarded: without `ColorField` the colour setting falls back to a String text box. (assumed)
- **Reset buttons:** a setting whose data has `reset: true` gets a small Reset button beside its field (`settings.js`, `decorateSettingsConfig`), stripped before `game.settings.register` like `note`. It does what core's "Reset Defaults" does for one setting (`SettingsConfig#onResetDefaults`: set `checked` or `value`, fire `change`); nothing is saved until Save Changes. Foundry's `<range-picker>` and `<color-picker>` are `AbstractFormInputElement`s whose `value` setter redraws them and fires bubbling `input` and `change` (`client/applications/elements/form-element.mjs`). This is a difference from `void-coc7-modules`' `settings.js`; it can take the same flag when the two merge. (assumed)
- **Scope note:** every setting's hint ends with its note on its own italic line.
- **Reload:** a setting read once at `setup` needs `requiresReload: true`; one read at the moment it's used doesn't.
- **Action buttons:** a setting whose data has `button: { label, tooltip, onClick }` gets that button beside its field (`addActionButton`); unlike Reset it acts at once. Stripped before `game.settings.register` like `note` and `reset`. Used for Reset position. (confirmed 2026-11-15)
- **Keys and the module id are permanent.** Renaming one throws away everyone's saved values.
- **Text is inline English**, no `lang/` files.
- **v14 API (checked 2026-11-12, docs 14.370):** `game.settings.register(namespace, key, data)` and `game.settings.get(namespace, key)` are unchanged; scopes are `"world"`, `"user"`, `"client"`. `requiresReload` is used in the docs' example but isn't in the typed `SettingConfig` interface; it works on v14 in `void-coc7-modules`. `SettingsConfig` is an ApplicationV2 (through `CategoryBrowser`). (confirmed 2026-11-13: Rollbox's setting registers and shows in v14 build 368's settings, no console errors)

## Gaps

Things the design needs that CoC7 can't do, or does differently, found in the CoC7 research; each was decided with Void (2026-11-13), and DESIGN.md follows the decision.

**Gap 1. Missing skills get added to the sheet.** CoC7 adds the skill from its compendium (see "Skills the actor doesn't have"); the design says request at base value without adding it.
- A. Accept it: request by name; CoC7 adds the skill at its own base value and says so. All CoC7, but sheets change (NPCs collect skills) and CoC7's value can differ from Rollbox's table.
- B. Roll a raw value: `actor.runRoll({rollType: "R/MA", threshold})` at Rollbox's base value. Nothing is added. NPCs: fine (the Keeper rolls them anyway). Players: only through a standby card (needs `stanbyGMRolls` on), and the card shows "(20%)" without the skill name, so Rollbox's own request message has to name it.
- C. B for NPCs, A for player characters. Investigator sheets normally carry the full skill list, so the player case is rare.
- **Decided: C.** The design's "nothing added to the sheet" then holds for NPCs only.

**Gap 2. The item link starts an attack.** `@coc7.item` runs `actor.weaponCheck` → CoC7's melee or ranged attack card (with a "no target, proceed?" prompt unless the world setting `disregardNoTargets` is on) and ignores difficulty, dice and blind. The design keeps attacks out of Rollbox.
- A. Send the weapon's skill (`system.skill.main.name`, or `alternativ` when `usesAlternativeSkill`) as an ordinary skill check labelled with the weapon. Keeps difficulty, dice and blind; same path as the improvised weapon. Damage, if wanted, as a Foundry inline roll `[[/r 1D10]]` in the message, not CoC7's damage card (that needs the attack flow).
- B. Use `@coc7.item` as it is: CoC7's attack card, no difficulty or dice.
- C. Drop the Item menu.
- **Decided: A.**

**Gap 3. "Pushed" can't be requested.** CoC7 pushes from the failed roll's own card: the owner clicks Push, CoC7 re-rolls on the same card, marks it pushed and blocks Luck. The link's `pushing` flag only changes the text; the new roll is an ordinary roll (Luck can be spent, it can be pushed again).
- A. Drop Pushed from the Check menu; the Keeper tells the player to press Push on the failed card.
- B. Keep it as CoC7's Create link tool does: the request reads "… check - pushing", nothing more.
- **Decided: A.**

**Gap 4. Blind Sanity rolls.** The sanloss link ignores `blind`, and the v14 mode mismatch stops the card following the chat mode. There is no public way to create the Sanity card without a dialog.
- A. Drop Blind from the Sanity menu.
- B. Keep the option but disabled, with a note "CoC7 can't do this yet".
- **Decided: A.**

**Gap 5. Combined rolls can't be blind.** The combined card is always public. Hidden difficulty does work (`0`).
- A. Turn Blind off and disable it while two or more checks are ticked.
- B. With Blind on, send separate blind checks instead of one combined roll (no longer one roll, so not a combined roll).
- **Decided: A.**

**Gap 6. Idea and Know can't be requested by link.** `characteristicCheck("idea")` fails; CoC7's Idea and Know cards come only from `runRoll({characteristic: "idea"})` or the player choosing the card type in the roll dialog.
- A. Send an INT or EDU check labelled "Idea" or "Know". Same numbers (p. 90: Idea is an INT roll); the result card says "Intelligence".
- B. Keeper side `runRoll({characteristic: "idea"|"know"})`: the card is titled "Idea Roll". Players only through a standby card.
- **Decided: A for players, B for NPCs** (their automatic roll then gets the right card). **Since 0.1.1 (Void, 2026-11-15): A for everyone.** Idea and Know are sent as INT/EDU checks with a label; the Check menu's Attribute tab and the NPC path B were removed.

**Gap 7. Opposed ties outside combat.** CoC7 shows "Tie" with no winner; p. 91 gives the tie to the higher skill or characteristic, then a stalemate or re-roll.
- A. The Keeper settles ties: both sides' values are on the card ("Stealth (45%)").
- B. Rollbox adds a line after a tie naming the side with the higher value. Compares values, not dice, but needs CoC7's card data (internal) and goes beyond "CoC7 does the comparing".
- C. Switch the card to combat mode so the Keeper gets Advantage buttons on ties; the wording becomes attack wording.
- **Decided: A**, with the Opposed view's tie line naming the higher value before the card is made (from the two values only).

**Gap 8. Rolling NPC sides on cards automatically.** No public call. On the opposed card the Keeper's **Start rolls** also has to happen before players can roll.
- A. The Keeper clicks Start rolls (one click; it rolls the NPC sides).
- B. Rollbox clicks it on the Keeper's client: watch for the card it just asked for (`renderChatMessageHTML`, `flags.CoC7.load.as === "CoC7ChatOpposedMessage"` with both actor uuids), then click `[data-action="rollNoPlayers"]` once its listeners are attached. Internal (relies on CoC7's card HTML), guarded: if the button isn't found, the Keeper is told to click it.
- Either way, Start rolls also rolls for a character whose player is offline.
- **Decided: B, falling back to A.**

**Gap 9. Players can change the request in CoC7's roll dialog.** A link opens CoC7's dialog prefilled; the player can change difficulty, dice and card type, and a player with several characters can pick another one.
- A. Accept it (CoC7's normal behaviour; the card shows what was rolled).
- B. Use standby cards instead of links (Keeper triggers the check, options fixed, player clicks Roll): needs `stanbyGMRolls` on, the card is public unless blind, and it doesn't cover Sanity or combined rolls.
- **Decided: A.**

## Internal API registry

Every non-public Foundry or CoC7 API the module depends on. Recheck each after a Foundry or CoC7 update. Filled in from the CoC7 8.15 and Foundry build 368 source; the "Used in" column is the part (and file) that uses it.

| API | Kind | Used in | What we rely on | Status |
| --- | --- | --- | --- | --- |
| CoC7 link text `@coc7.check`, `@coc7.sanloss`, `@coc7.item` and their options | CoC7 format (documented in its source, not an API) | roll-requests (`links.js`) | Option names as in "Link syntax"; numeric difficulties (`-1`, `1`–`3`; Sanity only accepts numbers); `blind` / `blind:false`; `poolModifier` left out of check links with no dice; `rolls` strings `[uuid#]type#key[#±n]#digit` with `0` = hidden; `{label}` put into the page as HTML; `@coc7.item` not used (Gap 2) | Confirmed 2026-11-13 (Void's console check) for a whispered `@coc7.check` skill request with difficulty: it reached the player owner and Ettore rolled privately. Confirmed 2026-11-14 (table check) for a combined `@coc7.check` link and an `@coc7.sanloss` link reaching the player. Hidden, blind, label and the link without `poolModifier`: Assumed |
| `actor.characteristicCheck` / `attributeCheck` / `skillCheck(key, fastForward, {difficulty, poolModifier, blind})` | CoC7 public method | roll-requests (`keeper-rolls.js`) | `fastForward` skips the dialog; `blind: true` whispers to GMs; `skillCheck` accepts a skill item uuid, CoC ID or name (`getItemOrAdd`) and adds a missing skill | Confirmed 2026-11-13 for `skillCheck` with `fastForward` and `blind: true` (Hard Spot Hidden on two NPCs: Keeper-only blind cards, no dialog). `characteristicCheck`, `attributeCheck` and adding a missing skill: Assumed |
| `actor.runRoll(options)` with `rollType: "R/MA"`, `threshold`, `isBlind`, `fastForward`, `preventStandby` (`characteristic: "idea"/"know"` not used since 0.1.1) | CoC7 public method, internal option names | roll-requests (`keeper-rolls.js`; Gap 1) | Option names, the `"R/MA"` constant, the returned `{result, successLevel, passed}` | Assumed |
| `actor.owners` | CoC7 public getter | roll-requests (`coc7.js` `ownersOf`), read through it by mini-sheet, shared (`requestLabel`, results) and opposed-roll | Non-GM users with OWNER permission; mini-sheet shows their names, or "NPC · Keeper rolls" when there are none; the menus' main button reads "Roll for NPC" when every character has none | Confirmed 2026-11-14 (table check): requests reached each character's player, characters with no player owner were rolled for the Keeper, the mini sheet showed the player |
| `CONFIG.CoC7Link.documentClass._onLinkActorClick(actor, options)` | CoC7 internal (underscore static) | roll-requests (`coc7.js` `linkActorClick()`; the opposed card and the NPC Sanity card) | Signature; `actor` must be non-null; `subtype: "opposed"` with `rolls` makes one new card; `check: "sanloss"` makes the Sanity card | Confirmed 2026-11-13 for the opposed card (Stealth vs Spot Hidden, one card with both sides). Confirmed 2026-11-14 (table check) for the Sanity card (a group Sanity check's NPC cards were made) |
| Card buttons `[data-action="rollNoPlayers"]` (opposed, Keeper-only) and `[data-action="rollSanCheck"]` (Sanity); message flags `flags.CoC7.load.as` (`CoC7ChatOpposedMessage`, `CoC7SanCheckCard`), `.actorUuids` (some with `/`), `.actorUuid` | CoC7 internal (card HTML and flags) | roll-requests (`card-buttons.js`, Gap 8 B) | Button names; clicking runs the roll on the Keeper's client; listeners attached within 250 ms of render | Confirmed 2026-11-13 for Start rolls (`rollNoPlayers`, clicked automatically after the 250 ms delay, rolled both NPC sides). Confirmed 2026-11-14 (table check) for the Sanity card's `rollSanCheck` (a group Sanity check's NPCs rolled automatically) |
| CoC7 data paths in "Actor and item data" (`system.characteristics`, `system.attribs` incl. `hp`, `mp` and `db.value`, `system.infos.occupation`, skill `system.value`, `system.adjustments.base`, `system.properties.own` and `flags.CoC7.cocidFlag.id`, weapon `system.skill.main` / `alternativ` and `system.usesAlternativeSkill`) | CoC7 data model | skill-values, mini-sheet, roll-requests (`resolve.js`), other-menu (`item.js`) | Paths and meanings in 8.15 | Confirmed 2026-11-14 (table check) for `system.characteristics`, `hp`, `mp`, `system.infos.occupation` (the mini sheet), `db.value` (improvised damage, a bonus of 0) and a weapon's `system.skill.main` (the item check). The rest: Assumed |
| CoC7 world settings `worldEra` (read only); `stanbyGMRolls`, `defaultCheckDifficulty` (not read: Rollbox sends every option) | CoC7 setting | roll-requests (`coc7.js`) | `worldEra` key and era keys | Assumed |
| CoC7 string `CoC7.MessageTargetCheckRequested` (`CoC7.MessageCheckRequestedWait` not used) | CoC7 language file | roll-requests (`coc7.js` `requestText`) | Key and `{name}` / `{check}` placeholders; English fallback if the key is gone | Confirmed 2026-11-13 (Void's console check): the whispered request read "Your keeper has requested … make a … roll." |
| `game.CoC7.cocid.fromCoCIDBest({cocid})` | CoC7 public object, internal lookup | roll-requests (`coc7.js` `coc7FindsSkill`) | Returns an array; CoC7 adds a missing skill only when it has exactly one item | Assumed |
| CoC7's skill lookup order in `getItemOrAdd` (world items, then Item compendium indexes with `system.skillName` and `flags.CoC7.cocidFlag.eras`; names compared by the part in brackets) | CoC7 internal behaviour, mirrored read-only | roll-requests (`coc7.js` `coc7FindsSkill`) | Same order and matching as 8.15, so the prediction matches what CoC7 does | Assumed |
| Opposed card's `playerOwnersOnline` (non-GM, `active`, `canUserModify(user, "update")`, taken when the card is made) and `rollNoPlayers` rolling the sides without one; `isTie` with no winner outside combat; the first side made attacker and the second defender (`newGroupMessage`), which the card needs to compare; `User#active` | CoC7 internal behaviour (read only) and Foundry public | opposed-roll (who rolls each side, the tie line, the Attacker/Defender tags) | Start rolls rolls the NPC side and a side whose player is offline; a non-combat tie has no winner; the left-hand side is CoC7's attacker | Confirmed 2026-11-14 (table check): investigator vs NPC, the NPC side rolled by Start rolls, the player rolled their own side from their client, and the card compared the two as p. 90–91 say. Start rolls rolling an offline player's side: seen at the table 2026-11-14. A non-combat tie: Assumed |
| Hook `renderChatMessageHTML(message, html)`; `ChatMessage.getWhisperRecipients("GM")`; `game.clipboard.copyPlainText`; `Roll.validate`; inline roll `[[/r formula # flavor]]` | Foundry public (build 368) | roll-requests | Arguments and behaviour as in build 368's client source; `html` is the message's element, drawn again on each render | Confirmed 2026-11-14 (table check) for `renderChatMessageHTML` (NPC Sanity cards clicked), `Roll.validate` and the inline damage roll (improvised weapon). `getWhisperRecipients` and `copyPlainText`: Assumed |
| `#players`, `#ui-left-column-1`, `#players-active`, `#interface` (the moved panel's parent; `position: relative`, the screen's size beside the camera dock), `--z-index-app`, `--ui-scale` on `body`; CSS variables `--color-cool-3/4/5`, `--color-cool-5-75`, `--color-warm-2`, `--color-light-1/2/4`, `--font-size-10…14`; Configure Settings' `.form-group` / `.form-fields` markup around each setting; `--checkbox-size`, the size of Foundry's radio and tick-box glyphs; `--checkbox-background-color`, `--checkbox-checked-color`, `--checkbox-disabled-color` and `--input-placeholder-color`, the colours Foundry draws them in | Foundry DOM and stylesheet (build 368 templates and `foundry2.css`, not API) | mini-sheet, shared, settings (Reset buttons) | Element ids and the column layout in "The panel and CSS"; the panel goes before `#players` and is put back on `renderPlayers`; the variables exist (the CSS has fallbacks for each); each setting's input sits in a `.form-fields` inside a `.form-group`, where the Reset button is added; radios and tick boxes draw their glyph at `--checkbox-size` in the `--checkbox-*` colours, and placeholders in `--input-placeholder-color`, so the theme's colours set there apply | Confirmed 2026-11-14 (table check) for the panel's place on top of the players list and the settings page's heading, switch and italic note. The rest: Assumed. Confirmed 2026-11-15 (session 15 table check): the panel moved into `#interface` stays where it is dropped, above the canvas and under Foundry's windows, at UI scale and Panel size |
| Hooks `controlToken`, `deleteToken`, `canvasReady`, `canvasTearDown`, `renderPlayers`, `updateActor`; the window's `resize` event and the document's `pointermove` / `pointerup` / `pointercancel` and `keydown` (Escape cancels the opposed two-step); `contextmenu` with `preventDefault()` on Rollbox's own value buttons only; a mouse event's `shiftKey`, `ctrlKey`, `metaKey`, `altKey`; `Token#control({releaseOthers: false})` (selects the opposed two-step's first token again, adding it to the selection); `HTMLElement#focus`; `game.settings.set(…, options)` passing `options` to a client setting's `onChange`; `canvas.tokens.controlled`; `actor.sheet.render(true)`; `actor.img`; Font Awesome 6 classes `fa-dice-d20`, `fa-brain`, `fa-ellipsis`, `fa-right-left`, `fa-people-carry-box`, `fa-crosshairs`, `fa-up-right-from-square`, `fa-link`; `actor.type` (`"creature"`); settings `range`, `onChange`, `choices`, `config: false` and `game.settings.set`; the `inert` attribute, CSS `field-sizing: content` and `writing-mode: vertical-rl` (Chromium in Foundry's Electron); `foundry.data.fields.ColorField` as a setting `type`, `Color#toString`, the `<color-picker>` / `<range-picker>` `value` setters | Foundry public (build 368) and the Font Awesome shipped with it | mini-sheet, assist, settings (Reset buttons) | As in "The panel and CSS"; `render(true)` forces an ApplicationV2 sheet open (`ApplicationV2#render` turns a boolean into `{force}`); `updateActor` fires for a token's own (unlinked) actor too; a `ColorField` setting shows Foundry's colour picker and gives a `Color` whose `toString()` is `"#rrggbb"` (falls back to a String text box without `ColorField`); setting a `<color-picker>` or `<range-picker>`'s `value` redraws it and fires `input` and `change` | Confirmed 2026-11-14 (table check) for `controlToken` and `canvas.tokens.controlled` (the panel follows one, two and three selected tokens). Confirmed 2026-11-15 (table check): `Token#control({releaseOthers: false})` (the opposed two-step ended with both tokens selected), `contextmenu` (no browser menu on the values), `keydown` Escape, the modifier keys of every shortcut. The rest: Assumed |

## Release checklist

Make the zip with the package script, never by hand. `release-check` runs `package` itself first, then does the smoke test on that fresh zip and checks the version, the zip's contents and `console.log` / `debugger` for you (see [release-tools.md](release-tools.md)); the other items are by hand.

```
npm run release-check
```

- [ ] Version in `module.json` matches the newest `CHANGELOG.md` entry
- [ ] `compatibility` and the CoC7 `relationships` entry still correct (CoC7 minimum and verified 8.15)
- [ ] Tests pass
- [ ] Every internal API in use is in the registry
- [ ] The zip from the package script holds one top folder `keepers-rollbox` with `module.json` and `scripts/` — never `tests/`, `docs/`, `media/`, `package.json`, `package-lock.json` or `node_modules/`
- [ ] No `console.log` or `debugger` in `scripts/`
- [ ] The pull request or release notes say what changed, what the Keeper and players see, and what is untested

## Publishing (the maintainer releases)

Releases are made only by the maintainer, from the public repository `https://github.com/Voidworks-Foundry/Keepers-Rollbox`. Step by step: [recipes/make-a-release.md](recipes/make-a-release.md).

1. Run the release checklist above; bump the version in `module.json`, `download` and `manifest` (while releases are pre-releases, `manifest` names the version: `…/releases/download/v<version>/module.json`; at the first full release switch it to `…/releases/latest/download/module.json`), and start the new version's `CHANGELOG.md` entry.
2. Commit and push to `main`; CI runs the tests and the release check.
3. Create the GitHub release: tag `v<version>` on `main`, title "Keeper's Rollbox <version>", notes with the manifest link, assets `dist/keepers-rollbox-v<version>.zip` and `module.json`; tick "Set as a pre-release" until 1.0.
4. Test the manifest link in Foundry (Install Module → Manifest URL).
