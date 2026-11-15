# Tests index

Find the tests that cover your change here, then run only those. Don't open the test files to search for tests; open one only to edit or add a test. Generated from the test runner's own names; update it when you add, rename or remove a test (`tests/docs-index.test.mjs` fails if a test file is missing from it).

## Commands

From the repository root. Run one file, or one test (or group) by its pattern:

```
npm test -- tests/<file>.test.mjs
npm test -- --test-name-pattern="<pattern>" tests/<file>.test.mjs
```

- The pattern goes **before** the file. It is a regular expression matched against test names; the patterns below match exactly one test (or one group) in their file, and use `.` for quotes, brackets and other special characters, so they can be pasted as they are.
- Several at once: `--test-name-pattern="<pattern 1>|<pattern 2>"`, or several files.
- If your shell's `npm` won't pass a pattern with spaces, run Node directly (the same thing `npm test` runs): `node --test --test-reporter=spec --test-name-pattern="<pattern>" tests/<file>.test.mjs`
- Everything: `npm test`. Before a pull request: `npm test` and `npm run release-check`.

## How a test is set up (`tests/mocks.mjs`)

| Helper | What it provides |
| --- | --- |
| `makeEnv({ isGM, values, coc7 })` | Fresh Foundry globals for one test: `Hooks` (recorded in `hooks`), `game.user` (Keeper unless `isGM: false`), three users (`gm1`, `p1`, `p2`), `game.settings` (registrations in `registered`; Rollbox values from `values`, CoC7's from `coc7`; reads in `reads`), `CONFIG`, `ChatMessage.create` (messages in `chat`). Silences `console.warn`. Call it first in every test. |
| `makeCoC7({ links, linkActorClick, cocidMatches, worldItems, packIndex })` | CoC7's side of a request on top of `makeEnv()`: the system id, `CONFIG.CoC7Link` and `_onLinkActorClick`, the CoC ID lookup, i18n, clipboard, notifications, whisper recipients, world items and one compendium index. Returns `calls`, everything Rollbox asked of CoC7. `false` / `null` options remove a piece, for the "does nothing" tests. |
| `makeActor({ name, type, characteristics, luck, san, sanMax, idea, know, skills, otherItems, system })` | A CoC7 8.15-shaped actor (characteristics, attributes, skill items with `value`, `base`, `cocid`, `own`). For data-only parts such as `skill-values`. |
| `makeRollActor({ uuid, owners, weapons, db, methods, … })` | A `makeActor` that can be rolled: uuid, player owners, CoC7's check methods (recorded in `actor.calls`), item ids and uuids, weapons and a damage bonus. |
| `makeDom(html)` | A jsdom page as the global `document`; returns its window (for `Event` classes and `getComputedStyle`). |
| `addStyles(...files)` | Loads the module's stylesheets (paths under `scripts/`) into the page, for tests of a CSS rule. |
| `resultText(area)` | A menu's result area as the Keeper reads it: each heading and line, in order. |
| `load(env)` | Imports `main.js` fresh and runs its `init`, `setup` and `ready` hooks, for tests of the whole module's wiring. |

A new test: `makeEnv()` (and `makeCoC7()` for anything that sends), then `makeDom()` for anything drawn; build actors with `makeRollActor()`; call the part's exported function; check `env.chat`, `calls` or the DOM. Existing tests in the same file are the model. One test per behaviour, plus the "does nothing" paths (a player, the switch off, CoC7 missing); see [DEVELOPING.md](DEVELOPING.md), "Testing".

## assist.test.mjs

- Covers: `scripts/assist/`. Part document: [assist.md](assist.md).
- Run all 14: `npm test -- tests/assist.test.mjs`

| Pattern | Test (what it checks) |
| --- | --- |
| `difficultyFor: below 50` | difficultyFor: below 50 Regular, 50+ Hard, 90+ Extreme |
| `assistChoices: the rulebook` | assistChoices: the rulebook rafter: Harvey, Cecil, Martin help; Helen and Belinda roll at Regular, 45 left |
| `assistChoices: what.s left` | assistChoices: what's left never goes to 0 or below; with no need to help, nobody helps |
| `assistChoices: too heavy` | assistChoices: too heavy even together, or nothing to beat, gives null |
| `assistChoices: equal values` | assistChoices: equal values keep the names-card order; equal chances go to fewer helpers |
| `registerAssist: only on` | registerAssist: only on the Keeper's client with the Rollbox switch on |
| `the rafter: Assisting` | the rafter: Assisting, Rolling and the result line; Send asks the rollers at Regular STR with the label and posts the card |
| `Use SIZ: the` | Use SIZ: the characters' SIZ is put in and asked for; with no label the request reads "SIZ · Assist" |
| `targets: a creature` | targets: a creature starts marked; values add up; only the target button (or typing) unmarks one |
| `a left-out character` | a left-out character isn't counted and their target button does nothing; leaving everyone out says so |
| `one token: the` | one token: the red line asks for another and Send is greyed out; a new selection keeps what was typed |
| `the names list` | the names list: ten rows before it scrolls, sized by its row height, not pixels |
| `assistColumns: the Use` | assistColumns: the Use value for participants and the Against value for targets |
| `assistCardHtml: names and` | assistCardHtml: names and the label are escaped; no one helping is said so |

## check-menu.test.mjs

- Covers: `scripts/check-menu/`. Part document: [check-menu.md](check-menu.md).
- Run all 11: `npm test -- tests/check-menu.test.mjs`

| Pattern | Test (what it checks) |
| --- | --- |
| `registerCheckMenu: only on` | registerCheckMenu: only on the Keeper's client with the Rollbox switch on |
| `one character: two` | one character: two tabs (no Attribute), values, trained skills first, a divider, the rest at base value; search filters |
| `one check: greyed` | one check: greyed out with the status line in red until a check is ticked, then no line; Request from player whispers it |
| `combined: ticks persist` | combined: ticks persist across tabs; two ticks offer All / Any and turn Blind off |
| `options: difficulty, dice` | options: difficulty, dice, the Blind toggle and label go into the request; Blind clicks on and off |
| `several characters: skills` | several characters: skills A–Z without values; Send to each (N); players asked, the NPC rolled |
| `main button: .Roll` | main button: "Roll for NPC(s)" when every character is an NPC; with a player character, as before |
| `Add: a search` | + Add: a search that matches no listed skill offers the typed name; a specialisation gets its group base, otherwise a value is asked |
| `Send to chat` | Send to chat posts publicly; Copy link copies and sends nothing |
| `started from the mini sheet: only` | started from the mini sheet: only that characteristic ticked; again while open switches it, keeping the options |
| `started from the mini sheet: add` | started from the mini sheet: add keeps the ticks (combined); plain sends a Regular check at once, or copies its link |

## docs-index.test.mjs

- Covers: this index, [AGENTS.md](../AGENTS.md) "Find your way" and the part documents (reads files only, no mocks).
- Run all 3: `npm test -- tests/docs-index.test.mjs`

| Pattern | Test (what it checks) |
| --- | --- |
| `docs/TESTS.md has` | docs/TESTS.md has a section for every test file |
| `every part folder` | every part folder under scripts/ has its document in docs/ |
| `every path in` | every path in AGENTS.md's "Find your way" table exists |

## mini-sheet.test.mjs

- Covers: `scripts/mini-sheet/` (panel, names card, menu host, appearance, moving the panel, the clickable values and their shortcuts) and `scripts/main.js`. Part document: [mini-sheet.md](mini-sheet.md), [main.md](main.md).
- Run all 42: `npm test -- tests/mini-sheet.test.mjs`

| Pattern | Test (what it checks) |
| --- | --- |
| `main.js calls the` | main.js calls the panel at ready, which installs its hooks on the Keeper's client |
| `player: does nothing` | player: does nothing, installs no hooks or listeners, never reads the setting, draws nothing |
| `Keeper with the` | Keeper with the switch off: installs no hooks, draws nothing |
| `no user yet` | no user yet: does nothing instead of throwing |
| `1 token: mini` | 1 token: mini sheet just before the players list, with Check, Sanity, Other |
| `1 token: the` | 1 token: the sheet button opens the full sheet |
| `1 NPC: subtitle` | 1 NPC: subtitle is "occupation · NPC"; the full name is the name's tooltip on both cards |
| `panel transparency: the` | panel transparency: the saved value sets the background alpha; a change applies at once |
| `panel colour: the` | panel colour: the saved colour is the panel's background colour; a change applies at once |
| `theme: Light gives` | theme: Light gives the panel the Light palette and shows the colour light; Dark switches back at once |
| `theme switch: the` | theme switch: the Panel colour's lightness flips (hue and saturation kept) and is saved; a fitting colour stays |
| `panel size: scales` | panel size: scales the whole panel from its bottom-left corner; 100% leaves it untransformed |
| `2 tokens: names` | 2 tokens: names card with owner or 'NPC · Keeper rolls', SAN and Luck; Check, Sanity, Other, Opposed, Assist |
| `3 or more` | 3 or more tokens: names card, one row each with no upper limit; Check, Sanity, Other and Assist |
| `request buttons: one` | request buttons: one constant height from the CSS; no script sets it, whatever is selected |
| `names card: ten` | names card: ten rows before it scrolls, sized by its row height, not pixels |
| `token without an` | token without an actor is left out; with nothing else selected the panel stays hidden |
| `a box-select.s many` | a box-select's many hooks make one redraw on the next frame |
| `scene change: canvasTearDown` | scene change: canvasTearDown hides at once; canvasReady draws the new selection |
| `menu host: a button` | menu host: a button opens its flyout and is marked; clicking it again closes it |
| `menu host: a registered` | menu host: a registered menu draws for the selection, again when it changes; closes when nothing is selected |
| `registerMenu: an unknown` | registerMenu: an unknown menu or layout, or one without render, is refused |
| `menu host: a replace menu takes` | menu host: a replace menu takes the names card's place and hides the buttons; close brings them back |
| `menu host: a staysOpen` | menu host: a staysOpen menu stays open with one token, and is told when the selection changed |
| `names card: its` | names card: its value columns follow the open menu (SAN and Luck; SAN with Sanity; STR or SIZ with Assist) |
| `menu host: a replace menu that` | menu host: a replace menu that fails to draw closes, so the card and buttons stay |
| `updateActor: a shown` | updateActor: a shown character's new values are drawn |
| `placement maths: clamp` | placement maths: clamp on screen, the quarter's corner, spot round trip, re-clamp in a smaller window, unreadable spots |
| `moving off: docked` | moving off: docked above the players list; dragging the header does nothing |
| `moving on .the` | moving on (the default): dragging the header moves the panel, kept on screen; it stays where dropped and its spot is saved |
| `a saved spot is` | a saved spot is used after a reload; turning moving off forgets it and docks the panel |
| `menus open to` | menus open to the: Automatic towards the middle; Right or Left as chosen; docked, always right; top half grows down |
| `bug: a saved` | bug: a saved spot that is off the screen or can't be read is ignored, and the panel docked |
| `bug: when the` | bug: when the panel doesn't land where it is put (its layout failed), it stays docked instead of vanishing |
| `Reset position puts` | Reset position puts the panel back above the players list at once and forgets its spot; moving stays on |
| `the Opposed view` | the Opposed view: either side's mini sheet header drags the panel |
| `an open menu` | an open menu that would run off the screen shifts the panel into view, and it goes back when the menu closes |
| `a press on` | a press on the open-sheet button, or a click on the header without moving, doesn't move the panel |
| `mini sheet values` | mini sheet values: the characteristics, SAN and Luck are buttons named for what they open; HP, MP and the names card aren't |
| `a left click` | a left click opens the value's menu, nothing sent: Check with only that characteristic ticked (again switches it), Sanity, Other on Luck |
| `shortcuts, as on` | shortcuts, as on CoC7's sheet: Shift sends now, Ctrl copies a link, Shift+Ctrl readies Copy link, Alt+Right adds to the ticks |
| `right click: no` | right click: no browser menu; the opposed two-step selects both and opens Opposed with both picks; Escape cancels |

## opposed-roll.test.mjs

- Covers: `scripts/opposed-roll/`. Part document: [opposed-roll.md](opposed-roll.md).
- Run all 10: `npm test -- tests/opposed-roll.test.mjs`

| Pattern | Test (what it checks) |
| --- | --- |
| `registerOpposedRoll: only on` | registerOpposedRoll: only on the Keeper's client with the Rollbox switch on |
| `skill vs skill` | skill vs skill: both sheets with the card between; Create waits for both picks; one card, both sides |
| `a missing skill` | a missing skill: listed at base value with a note, and shown in the side's header; CoC7 adds it when the card is made |
| `a skill CoC7` | a skill CoC7 can't find: no card, and the view says why |
| `an NPC side` | an NPC side: Start rolls is watched for so it rolls that side, and the result says who rolls |
| `ties: the higher` | ties: the higher value is named for the Keeper; equal values are a stalemate or re-roll |
| `each side picks` | each side picks from two tabs, Characteristic and Skill (no Attribute tab) |
| `started from the` | started from the mini sheet: the first character on the left with both picks; create makes the card at once |
| `Swap sides: the` | Swap sides: the characters change places with their picks and dice, so the other is CoC7's first side |
| `Cancel closes the` | Cancel closes the view; nothing is sent |

## other-menu.test.mjs

- Covers: `scripts/other-menu/` (the Item and Luck sections). Part document: [other-menu.md](other-menu.md).
- Run all 14: `npm test -- tests/other-menu.test.mjs`

| Pattern | Test (what it checks) |
| --- | --- |
| `registerOtherMenu: only on` | registerOtherMenu: only on the Keeper's client with the Rollbox switch on |
| `sections: one character` | sections: one character opens on Item ("Item check"); two or more open on Luck with Item greyed out |
| `Luck: CoC7.s Luck` | Luck: CoC7's Luck check to each with the options and label; an NPC rolled for the Keeper |
| `group Luck roll` | group Luck roll: only the lowest Luck is asked; a tie asks the Keeper to pick |
| `started from the` | started from the mini sheet's Luck: opens on Luck; plain sends a Regular Luck check at once, or copies its link |
| `a weapon: listed` | a weapon: listed with its skill and values; sent as a labelled skill check with the options |
| `improvised weapon without` | improvised weapon without damage: Fighting (Brawl) by default, labelled with the object, no damage roll |
| `improvised weapon with damage` | improvised weapon with damage: picked dice and +DB go in the message, the damage bonus filled in |
| `damage quick-picks fill` | damage quick-picks fill the damage line, which the Keeper can still change |
| `Throw: the damage` | Throw: the damage bonus is halved, on the toggle (+½DB), the quick-picks and the roll |
| `Simplified dice UI` | Simplified dice UI: only the damage line, no quick-picks or Custom damage; typed DB or 1/2DB is accepted |
| `a weapon with` | a weapon with two skills: one row per skill, each sent with its own skill |
| `improvised weapon, Other` | improvised weapon, Other…: nothing can be sent until a skill is picked |
| `a character with` | a character with no weapons: says so, and offers only the improvised weapon |

## release-tools.test.mjs

- Covers: `tools/release-tools.mjs`. Part document: [release-tools.md](release-tools.md).
- Run all 15: `npm test -- tests/release-tools.test.mjs`

| Pattern | Test (what it checks) |
| --- | --- |
| `^package$` | **Group "package"**: all 1 tests below |
| `zips module.json and` | package: zips module.json and scripts/ in one top folder named the id, and nothing that must not ship |
| `^smoke$` | **Group "smoke"**: all 9 tests below |
| `passes on a good zip` | smoke: passes on a good zip |
| `fails on a zip with tests/` | smoke: fails on a zip with tests/ inside |
| `fails on a zip with docs/` | smoke: fails on a zip with docs/ inside |
| `fails when a script module.json` | smoke: fails when a script module.json lists is missing |
| `fails when a script that` | smoke: fails when a script that another imports is missing |
| `fails when a template` | smoke: fails when a template a script uses is missing |
| `fails when the top` | smoke: fails when the top folder is not the module id |
| `fails when module.json.s version doesn.t` | smoke: fails when module.json's version doesn't match the zip name |
| `fails when a script has` | smoke: fails when a script has a syntax error |
| `^release-check$` | **Group "release-check"**: all 5 tests below |
| `passes on a good module` | release-check: passes on a good module and zip |
| `builds a fresh` | release-check: builds a fresh zip first, so an old zip with the same version can't pass |
| `fails on a console.log` | release-check: fails on a console.log or debugger left in scripts/ |
| `fails when the newest` | release-check: fails when the newest changelog entry is not module.json's version |
| `fails when module.json.s version appears` | release-check: fails when module.json's version appears twice in the changelog |

## roll-requests.test.mjs

- Covers: `scripts/roll-requests/` (links, whispers, NPC rolls, cards, guards). Part document: [roll-requests.md](roll-requests.md).
- Run all 50: `npm test -- tests/roll-requests.test.mjs`

| Pattern | Test (what it checks) |
| --- | --- |
| `links: check link` | links: check link with every difficulty, dice, blind and label |
| `links: no poolModifier` | links: no poolModifier without bonus or penalty dice (CoC7 would show "check(0)") |
| `links: roll strings` | links: roll strings, combined and Sanity links |
| `links: labels lose` | links: labels lose characters that break links or HTML, and are escaped |
| `checkRequest: defaults, dice` | checkRequest: defaults, dice limits, no Pushed option |
| `checkRequest: combined is` | checkRequest: combined is never blind; bad checks give null and a warning |
| `sanityLoss: numbers and` | sanityLoss: numbers and dice are tidied; anything else is refused (the Sanity menu's rule too) |
| `sanityRequest, weaponRequest, improvisedRequest` | sanityRequest, weaponRequest, improvisedRequest, opposedRequest: shape and checks |
| `whisper: a skill` | whisper: a skill on the sheet goes to the player owners, by the sheet's CoC ID |
| `whisper: a sheet` | whisper: a sheet skill without a CoC ID goes by its sheet name; a renamed own language by CoC ID |
| `chat: posted publicly` | chat: posted publicly, one message per character, never whispered |
| `link: copies the` | link: copies the request to the clipboard; nothing sent, nothing rolled |
| `link with nobody` | link with nobody selected: the generic link, skills by Rollbox's CoC ID |
| `several characters: each` | several characters: each player character gets a request, the NPC is rolled; duplicates once |
| `label: the check.s` | label: the check's name, then the Keeper's text; HTML in labels and names escaped |
| `combined for a` | combined for a player: one combined link, all or any, no actor in the roll strings |
| `missing skill, player: requested` | missing skill, player: requested by CoC ID after checking CoC7 can find it |
| `missing skill, player: CoC7 can.t` | missing skill, player: CoC7 can't find it, so nothing is sent and the Keeper is told |
| `typed skill, player` | typed skill, player: found by name in world items or a compendium, or refused |
| `missing skill, player: CoC7.s` | missing skill, player: CoC7's lookup gone means the request is sent anyway |
| `a name that` | a name that can't go in a link: the player is skipped with a notice; an NPC still rolls by uuid |
| `NPC characteristic, attribute` | NPC characteristic, attribute and sheet skill: CoC7's checks, no dialog, blind to the Keeper |
| `NPC missing skill` | NPC missing skill: a raw roll at the base value, nothing added, a note to the Keeper |
| `NPC typed skill` | NPC typed skill: the Keeper's value, else the group base; no value at all is skipped |
| `NPC combined: one` | NPC combined: one private roll at the highest (any) or lowest (all) value, named in a note |
| `weapon: the weapon.s` | weapon: the weapon's skill, labelled with the weapon; alternative skill when CoC7 says so |
| `weapon: skill main` | weapon: skill main or alternative picks that skill; weaponSkills lists both only when they differ |
| `weapon: automatic, burst` | weapon: automatic, burst or thrown with no alternative skill set falls back to its main skill |
| `weapon: a skill` | weapon: a skill stored as a CoC ID is labelled with the skill's name |
| `NPC with a` | NPC with a label: the Keeper's note is the label CoC7's card leaves out, with the difficulty, said once, just before the card |
| `weapon: missing from` | weapon: missing from the sheet, or without a skill, is skipped with a notice |
| `improvised: a labelled` | improvised: a labelled skill check plus a damage roll with the damage bonus filled in |
| `improvised: damage that` | improvised: damage that isn't dice is left out with a notice; NPC damage goes to the Keeper |
| `improvised: a zero` | improvised: a zero damage bonus and a typed +0 are left out of the damage |
| `Sanity, player: CoC7.s` | Sanity, player: CoC7's Sanity link; the cause is the label, the creature its record |
| `Sanity, NPC: CoC7.s` | Sanity, NPC: CoC7's Sanity card on the Keeper's side, and Rollbox clicks its roll |
| `Sanity: characters without` | Sanity: characters without a Sanity value are skipped |
| `Sanity: Copy link` | Sanity: Copy link copies the Sanity link |
| `opposed: one CoC7` | opposed: one CoC7 card with both sides, regular difficulty, dice; Start rolls clicked |
| `opposed: the Keeper` | opposed: the Keeper is told when Start rolls can't be clicked |
| `opposed: a missing` | opposed: a missing skill CoC7 can find is left to CoC7; one it can't stops the card |
| `opposed: Copy link` | opposed: Copy link is refused |
| `CoC7 fails to` | CoC7 fails to make the card: the watch for its button stops, and the Keeper isn't told to click it |
| `CoC7.s links missing` | CoC7's links missing, or not the CoC7 system: does nothing, one warning |
| `CoC7.s internal link` | CoC7's internal link handler missing: no opposed card, no NPC Sanity card, one warning each |
| `CoC7.s actor method` | CoC7's actor method or owners missing: that character is skipped, one warning |
| `a CoC7 method` | a CoC7 method that throws: skipped with a warning, never thrown to the menu |
| `player.s client: send` | player's client: send does nothing |
| `never whispered to` | never whispered to nobody: owners without ids are skipped, not posted publicly |
| `unknown mode or` | unknown mode or no request: nothing sent |

## sanity-menu.test.mjs

- Covers: `scripts/sanity-menu/`. Part document: [sanity-menu.md](sanity-menu.md).
- Run all 6: `npm test -- tests/sanity-menu.test.mjs`

| Pattern | Test (what it checks) |
| --- | --- |
| `registerSanityMenu: only on` | registerSanityMenu: only on the Keeper's client with the Rollbox switch on |
| `one character: current` | one character: current SAN shown; the line starts at 0 / 1D6 with its preset pressed; a preset sets both sides and sends |
| `the loss line: typed` | the loss line: typed sides are sent; one that isn't a loss turns red, blocks Send and says why; Custom writes both sides |
| `Simplified dice UI` | Simplified dice UI: only the loss line, no presets or Custom button; a typed loss is sent |
| `What caused it` | What caused it is the label players see, after "Sanity check ·"; Creature goes to CoC7's sanReason |
| `several characters: Send` | several characters: Send to each (N); players asked, the NPC's card made, one without SAN skipped and shown |

## settings.test.mjs

- Covers: `scripts/settings.js` and every part's settings. Part document: [settings.md](settings.md).
- Run all 11: `npm test -- tests/settings.test.mjs`

| Pattern | Test (what it checks) |
| --- | --- |
| `registered in page` | registered in page order: the panel switch and Simplified dice UI, then Appearance (theme, colour, transparency, size, moving, menus' side) |
| `Theme: a personal` | Theme: a personal Dark | Light choice, default Dark, applied at once |
| `each setting: scope,` | each setting: scope, type, default, range, and whether it needs a reload |
| `.note. and .reset.` | 'note' and 'reset' are not leaked into Foundry's setting config |
| `every setting key` | every setting key starts with rollbox |
| `two headings, each` | two headings, each before its group's first setting, and one Personal note per setting, no duplicates on re-render |
| `turning the panel` | turning the panel off dims Simplified dice UI and the whole Appearance group |
| `jQuery-style arg ignored` | jQuery-style arg ignored without error |
| `Reset buttons: one` | Reset buttons: one beside theme, transparency, colour and size, none on the switch, no duplicates on re-render |
| `a Reset position` | a Reset position button beside Allow moving the panel forgets the panel's spot at once |
| `each Reset puts` | each Reset puts back only its own default, in the form, with a change event |

## shared.test.mjs

- Covers: `scripts/shared/` (value line, dice picker, Simplified dice UI). Part document: [shared.md](shared.md).
- Run all 4: `npm test -- tests/shared.test.mjs`

| Pattern | Test (what it checks) |
| --- | --- |
| `compact picker: clicks` | compact picker: clicks write the same formulas as the old picker into the line |
| `compact picker: typing` | compact picker: typing in the line moves the picker; text it can't show presses nothing |
| `value line: Enter` | value line: Enter or clicking away confirms, tidied; empty becomes 0; refused text is red and has no value |
| `Simplified dice UI` | Simplified dice UI: on, the Custom button and its pickers are gone; changing it switches an open menu at once |

## skill-values.test.mjs

- Covers: `scripts/skill-values/`. Part document: [skill-values.md](skill-values.md).
- Run all 27: `npm test -- tests/skill-values.test.mjs`

| Pattern | Test (what it checks) |
| --- | --- |
| `table: names and` | table: names and CoC IDs unique, A–Z, bases are numbers or a characteristic |
| `table: spot checks` | table: spot checks against the Keeper Rulebook list (p. 56) |
| `characteristics: eight in` | characteristics: eight in sheet order with Hard and Extreme |
| `characteristics: missing values` | characteristics: missing values are null; no actor gives an empty list |
| `attributes: Luck, and` | attributes: Luck, and Sanity with its max (no Idea or Know: those are INT and EDU checks) |
| `attributes: missing fields` | attributes: missing fields are null |
| `lowestLuck: the lowest` | lowestLuck: the lowest, all of them on a tie, actors without Luck skipped |
| `skills: trained first` | skills: trained first, highest first, ties A–Z; then untrained A–Z, the divider before the first |
| `skills: a skill` | skills: a skill on the sheet at its base value is untrained but still on the sheet |
| `skills: missing skills` | skills: missing skills appear once, at their base value, not on the sheet |
| `skills: missing Dodge` | skills: missing Dodge is half DEX (rounded down), missing Language (Own) is EDU |
| `skills: Dodge on` | skills: Dodge on the sheet is trained only above half DEX |
| `skills: an own` | skills: an own language renamed on the sheet replaces Language (Own), by CoC ID or by the own flag |
| `skills: a sheet` | skills: a sheet skill matches the table by CoC ID even with another name (translated sheet) |
| `skills: matching by` | skills: matching by name ignores case, accents and spacing |
| `skills: extra sheet` | skills: extra sheet skills are included at their sheet value |
| `skills: an actor` | skills: an actor with no skills gets every table skill at base, none trained |
| `skills: a hand-made` | skills: a hand-made NPC that stores its whole value as base still reads as trained |
| `skills: a duplicate` | skills: a duplicate on the sheet shows once, at the higher value |
| `skills: no skill` | skills: no skill is hidden by CoC7's era, Modern skills included |
| `skills: guards —` | skills: guards — no actor, no system, no items, odd values, non-skill items |
| `groupSkills: every table` | groupSkills: every table skill A–Z with no values |
| `groupSkills: adds the` | groupSkills: adds the selected characters' extra sheet skills once |
| `withLevels: half and` | withLevels: half and fifth rounded down; all null without a value |
| `tableBaseFor: a table` | tableBaseFor: a table skill's base for this actor (Dodge from DEX); null for a CoC ID not in the table |
| `sameSkill: one skill` | sameSkill: one skill by CoC ID, by its table entry, by a CoC ID as its name, or by name |
| `findSkillRow: by CoC` | findSkillRow: by CoC ID first, then by name, as sheetSkill finds it |

## utils.test.mjs

- Covers: `scripts/utils.js`, and every file in `scripts/` (no `console.log`, the module id typed once). Part document: [utils.md](utils.md).
- Run all 5: `npm test -- tests/utils.test.mjs`

| Pattern | Test (what it checks) |
| --- | --- |
| `MODULE_ID and scope` | MODULE_ID and scope notes |
| `escapeHtml: markup, quotes` | escapeHtml: markup, quotes, null |
| `isKeeper: GM true` | isKeeper: GM true, player false |
| `no console.log or` | no console.log or debugger in scripts/ |
| `only utils.js types` | only utils.js types the module id as a string in code |
