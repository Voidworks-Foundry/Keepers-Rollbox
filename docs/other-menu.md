# Other menu (`scripts/other-menu/`)

The flyout the Keeper's Other button opens, for any selection (Void, 2026-11-15; the Item menu until 0.1.1, in `scripts/item-menu/`). Two sections at the top, like the Check menu's tabs: **Item** (a character's weapons and improvised weapons, one character only) and **Luck** (a Luck check, with the Group Luck roll for two or more). One character opens on Item; two or more open on Luck, with Item greyed out. The flyout's title follows the section: "Item check" or "Luck check". A click on the mini sheet's Luck opens it on Luck, or sends at once (`docs/mini-sheet.md`, "Clicks on the mini sheet's values").

Both sections send through `roll-requests/`, which builds CoC7's own links and rolls NPCs for the Keeper; the menu builds no request text and rolls nothing itself. The Item section sends a weapon as an ordinary skill check labelled with the weapon (never CoC7's weapon link, which starts its attack card and ignores the options); it is for a weapon roll with no token to target, such as shooting a lock, and attacks on tokens stay in CoC7's combat flow. The Luck section sends CoC7's Luck attribute check. Keeper only, with the Rollbox switch on. Files: `index.js` (the menu and its tabs), `item.js` (the Item section), `luck.js` (the Luck section), `other-menu.css`; the shared controls are `docs/shared.md`.

**Status key:** *Confirmed* only when the build guide's Internal API registry or changelog says so. Everything is **assumed** unless stated otherwise. Void's table check of session 16 (2026-11-15) passed for the tabs, the Luck section, the Group Luck roll and the Item section in its new place.

## What the Keeper sees

| Part | What it shows |
| --- | --- |
| Tabs | **Item** and **Luck** at the top (`role="tablist"`). Item is greyed out (disabled) unless exactly one character is selected; no help line or tooltip says why (DESIGN: no help lines) |

### Luck section

| Part | What it shows |
| --- | --- |
| Luck | Each selected character's name and "Luck 55", muted (the list scrolls past about 140px) |
| Group Luck roll | Two or more characters, when at least one has a Luck value: a tick box "Group Luck roll: only the lowest Luck rolls". Ticked: "Bob rolls (Luck 35).", or on a tie "Tied at Luck 35. Who rolls?" with one button per tied character |
| How | Difficulty Regular / Hard / Extreme / Hidden and Dice −2 … +2, with the tall Blind toggle beside both rows; then a Label box ("Label (optional), e.g. is the cab still there?") |
| Sending | the line above the buttons only in red, while the buttons are greyed out: "Pick who rolls for the group."; Request from player (highlighted; "Send to each (N)", or "Roll for NPC(s)" when every character rolling is an NPC), Send to chat, and Copy link as a small link icon (`aria-label` "Copy link"); then the result: "Luck check sent to:", "Rolled for you:" or "Not sent:" |

### Item section (one character)

| Part | What it shows |
| --- | --- |
| Weapons | Each weapon on the sheet, A–Z: its name, below it the skill a request for it uses, and that skill's values on the right. A weapon with two skills (a knife that can be thrown: Fighting (Brawl) and Throw) has a row for each, main skill first. A weapon with no skill set is greyed out and reads "no skill set". A skill missing from the sheet shows its base value. No weapons: "No weapons on Alice's sheet." |
| + Improvised weapon | Last row. Picking it shows, in the same section: "What is it?" (e.g. Candlestick); Skill Brawl (Fighting (Brawl), the default) / Throw / Other… (a list of every skill the character can roll, with values); the chosen skill's name and values |
| Damage (optional) | Improvised only, its own section: the caption, a large editable damage line (`docs/shared.md`; "0" is no damage), quick-picks None, 1D3+DB, 1D4+DB, 1D6+DB, 1D8+DB, 1D10+DB (the one matching the line shows pressed), and a full-width "Custom damage" button that opens the compact picker with +DB. With Throw picked, the toggle reads "+½DB", the quick-picks "1D3+½DB" … "1D10+½DB", and a DB already on the line becomes ½DB. Simplified dice UI on: only the damage line, no quick-picks and no Custom damage (Void's table check, 2026-11-14); DB, ½DB or 1/2DB can be typed |
| How | Difficulty Regular / Hard / Extreme / Hidden and Dice −2 … +2, with the tall Blind toggle beside both rows |
| Sending | the line above the buttons only in red, saying what is missing while the buttons are greyed out ("Pick a weapon, or an improvised weapon.", "Type what the improvised weapon is.", "Pick the skill it uses.", "Damage is dice, e.g. 1D6, 1D6+2 or 1D6+DB."); no summary (Void, 2026-11-14); Request from player (highlighted; "Roll for NPC" for a character with no player owner) and Send to chat; then the result: "Item check sent to:" and the character, or "Rolled for you:", or "Not sent:" with the reason |

No help lines or tooltips: no +DB paragraph, no Hidden hint, no "not on the sheet" tooltips.

## Code

### `registerOtherMenu()` (`index.js`, called from `main.js` at `ready`)
- **How it works:** Returns `false` unless `isKeeper()` is true and `rollboxEnabled` is on (the Keeper is checked first, so players never read the setting). Otherwise `registerMenu("other", { title: "Other", render: renderOtherMenu })`. Installs no hooks. The menu host offers the Other button for every selection (`docs/mini-sheet.md`, `menusFor`). The menu id changed from `item` to `other` in 0.1.1; nothing is saved under a menu id, so nothing is lost.
- **Connects to:** `mini-sheet/` (`registerMenu`); `utils.js` (`isKeeper`, `getSetting`).
- **Could interact poorly with:** nothing. **Assumed.**

### `renderOtherMenu(body, { actors, start, setTitle })` and `OtherMenu` (`index.js`)
- **How it works:** The menu host calls it when the menu opens and again when the selection changes while it is open; each call builds a new `OtherMenu` from scratch. Nothing selected draws nothing and returns nothing. Otherwise it returns a controller `{ apply(start) }` the menu host keeps while the menu is open, so a later click on the mini sheet's Luck reaches the open menu instead of redrawing it.
  - **Tabs** (`build`): one button per section (`SECTIONS`: Item "Item check", Luck "Luck check"), `role="tab"` with `aria-selected`; Item is `disabled` unless one character is selected. Opens on `start.section` if given, else Item for one character and Luck for two or more.
  - **`show(id)`:** empties the section's place and draws Item (`renderItem`, `item.js`) or Luck (`LuckSection`, `luck.js`); asking for Item with two or more characters, or for an unknown section, draws Luck. Then `setTitle` (from the menu host's context) sets the flyout's title to the section's title.
  - **`apply({ section, plain, send })`:** a starting state, from a click on the mini sheet: `section` switches to it if it isn't already open (an open Luck section keeps what the Keeper set); `plain` and `send` go to the Luck section's `apply` (below).
- **Connects to:** `mini-sheet/` (the menu host's `context`: `actors`, `start`, `setTitle`); `item.js`, `luck.js`; `shared/` (`button`); `utils.js` (`element`).
- **Could interact poorly with:** nothing. **Assumed.**

### `LuckSection` (`luck.js`)
- **How it works:** Built from scratch with the section, for one or more characters. State: difficulty, dice, Blind, label, Group Luck on or off, and the tie pick.
  - **Luck list** (`luckList`): each character's name (with the full name as its `title`, the same as the names card's) and Luck from skill-values' `attributes()`, or "—" without one.
  - **Group Luck roll** (`groupOffered`, `drawGroupLine`, `targets`): Keeper Rulebook pp. 89-90, "the player whose investigator has the lowest Luck score … should make the roll". Offered with two or more characters when at least one has a Luck value (`lowestLuck` from `skill-values/`). Ticked, the request goes only to the lowest-Luck character; on a tie, nothing is sent until the Keeper picks one (by `actorKey`). Characters without a Luck value are left out. Moved here from the Check menu in 0.1.1, where it was offered only while Luck was the one tick.
  - **How:** the shared Difficulty, Dice and Blind rows (`howRows`) and a Label box (`textInput`). `update()` redraws only what depends on them, so typing in the label keeps its focus.
  - **Sending** (`request`, `send`): `checkRequest({ checks: [{ kind: "attribute", name: "lck" }], difficulty, dice, blind, label })`, then `send(request, targets, { mode })` with "whisper" (Request from player), "chat" or "link". The main button's words are `requestLabel(targets)`. The buttons are greyed out while a tie isn't picked, and while a send runs (`runSend`). The result is `showResult` with "Luck check".
  - **`apply({ plain, send })`:** from a click on the mini sheet's Luck: `plain` puts the options back to a Regular check with no dice, not blind and no label (Shift and Ctrl clicks, as CoC7's sheet rolls them); `send` then sends it ("whisper" or "link").
- **What each request does** (player characters, NPCs, Copy link): `docs/roll-requests.md`, "What happens for each request". A Luck check is CoC7's ordinary attribute check, so a player gets CoC7's own Luck roll link and an NPC is rolled for the Keeper.
- **Connects to:** `skill-values/` (`attributes`, `lowestLuck`); `roll-requests/` (`checkRequest`, `send`); `shared/` (`button`, `howRows`, `requestLabel`, `runSend`, `sendSection`, `showResult`, `textInput`); `utils.js` (`NO_VALUE`, `actorKey`, `element`).
- **Could interact poorly with:** nothing beyond `send()`'s own notes. CoC7 offers Luck spending on its own result card; Rollbox doesn't touch it. **Assumed.**

### `renderItem(body, actors)` and `ItemMenu` (`item.js`)
- **How it works:** The Other menu draws it in its Item section when that section is shown; each call builds a new `ItemMenu` from scratch (nothing picked, options at their defaults). It draws only for exactly one character: the Other menu greys the Item tab out otherwise, and anything else draws nothing. Unchanged from the Item menu of 0.1.0 apart from its place (the file was `item-menu/index.js`).
  - **Weapons** (`weaponsOf`): the actor's items with `type === "weapon"`, A–Z. Each weapon's rows come from `roll-requests/`' `weaponSkills(actor, weapon)`: its main and alternative skill when CoC7's `system.usesAlternativeSkill` is true (automatic, burst or thrown weapons) and the two skills differ, otherwise the one skill a request would use (`weaponSkill`: the alternative when the weapon uses one and it is set, else the main skill). Each row sends `weaponRequest({ weaponId, skill: "main" | "alternative" })`, so the skill shown is exactly the one requested. Skills are found on the sheet by the stored item id, else by the stored name. Values come from `skills(actor)` (`skill-values/`), found with skill-values' `findSkillRow`: by CoC ID first, then by name, the order roll-requests finds the sheet skill in, so the row shows the skill a request will send (a weapon's stored skill name can be a CoC ID such as `i.skill.throw`, as in CoC7's compendium weapons). A row with no skill (nothing set at all) is greyed out, because `send()` would skip it. An automatic, burst or thrown weapon with no alternative skill set shows its main skill (CoC7's `skillAlternative` fallback).
  - **Picking:** one radio group (named per menu, so two drawn menus never share it) for the weapon rows and the improvised row. Each row's value is `<weapon id>#main` or `#alternative`.
  - **Improvised weapon:** "What is it?" is required. The skill is Fighting (Brawl) by default, or Throw (`IMPROVISED_SKILLS`, the only place their CoC IDs are written), found in `skills(actor)` with `findSkillRow` so a sheet skill shows its own value and a missing one its base value; "Other…" is a list of every row of `skills(actor)` (trained first, then A–Z), and nothing is sent until one is picked.
  - **Damage** (`damageBlock`): a `valueLine` (`shared/`, starting "0") whose rule is `tidyDice` then `damageText` from `roll-requests/`, with "0" meaning no damage; a `dicePicker` with `damageBonus: true` on that line, inside `customDice` ("Custom damage"). A line `damageText` refuses turns red and keeps the buttons disabled. `request()` passes "0" as no damage ("") and anything else as typed: `roll-requests/` fills in `DB` and `½DB` from the character's damage bonus when it sends. The section shows only for the improvised weapon.
  - **Quick-picks** (`quickFormula`, Void's choice): None and five dice under the line; a click writes "0" or "1D6+DB" into the line, which the Keeper can still change (typing, or Custom damage). The button matching the line shows pressed.
  - **Half DB for Throw** (`thrown`): when the improvised skill is Throw (skill-values' `sameSkill` with Throw's entry: by CoC ID `i.skill.throw`, or a skill named Throw picked in Other…), `update()` calls the picker's `halfBonus(true)` (toggle "+½DB", writes `½DB`), the quick-picks read "1D3+½DB" and so on, and a DB already on the line becomes ½DB (`withHalfBonus`). Thrown weapons add half the damage bonus in the rulebook's weapons table, as CoC7's own thrown weapons do (`CoC7Utilities.halfDB`). Switching back to Brawl gives the whole bonus again.
  - **Options:** the shared Difficulty, Dice and Blind rows (`howRows`, `docs/shared.md`); Blind's `on` goes into the request's `blind` option. `update()` redraws only what depends on them (pressed buttons, the improvised fields and damage, the status line and the send buttons), so typing keeps focus.
  - **Status line** (the shared `sendSection`'s, `ready()`): while something required is missing (a weapon picked, the improvised one named and its skill picked, damage that is dice), the buttons are greyed out and the line says what, in red; once all is there it is hidden (Void, 2026-11-14: no summary). The quick-picks row is marked with `hideWhenSimplified` (`docs/shared.md`).
  - **No Label field, no Copy link:** the label is the weapon's or object's ("Firearms (Handgun) with the .38 Revolver", "Fighting (Brawl) with Candlestick", from `roll-requests/`), and the design names only Request from player and Send to chat.
- **Connects to:** `skill-values/` (`skills`, `findSkillRow`, `sameSkill`); `roll-requests/` (`weaponRequest`, `improvisedRequest`, `weaponSkills`, `damageText`, `send`); `shared/` through its `index.js` (`valueLine`, `tidyDice`, `dicePicker`, `customDice`, `withHalfBonus`, `NO_DICE`, `howRows`, `segmented`, `requestLabel`, `runSend`, `sendSection`, `showResult`); `utils.js` (`warn` when a weapon's skill can't be read); CoC7 weapon data `system.skill.main` / `alternativ` and `system.usesAlternativeSkill` (read by `weaponSkill`).
- **Could interact poorly with:**
  - CoC7's choice of a weapon's skill: `usesAlternativeSkill` is true for any weapon with the automatic, burst or thrown property. Such a weapon with two different skills gets two rows, so the Keeper picks (a single shot from a submachine gun: its main row). An alternative skill stored on a weapon without one of those properties is ignored, as CoC7's sheets hide it then (`weapon-header.hbs`). **Assumed** (from the CoC7 8.15 source).
  - Foundry's global `button`, `input` and `select` styles: every rule is scoped under `.rollbox-panel` and Foundry loads module styles into its `modules` cascade layer, after its own (BUILD-GUIDE "The panel and CSS"). **Assumed.**
  - An update to the character while the menu is open (a weapon added, a skill improved) doesn't redraw it, so it shows the sheet as it was when drawn (the menu host's rule). The request itself reads the sheet when it is sent. **Assumed.**

### Sending from the Item section (`ItemMenu#request`, `#send`, `#showResult`)
- **How it works:** `request()` is `weaponRequest({ weaponId, skill, difficulty, dice, blind })` for a weapon row (`skill` "main" or "alternative", from the row), or `improvisedRequest({ what, skill: { name, cocid }, damage, difficulty, dice, blind })`; null while the pick is incomplete: a Send then sends nothing and the status line says what is missing. The buttons are greyed out while a send runs (`runSend`, no double sends) and while the damage isn't dice. The main button's words are `requestLabel([actor])`: "Request from player", or "Roll for NPC" when the character has no player owner. Request from player → `send(request, [actor], { mode: "whisper" })`; Send to chat → `"chat"`. The result under the buttons is shared/menu.js's `showResult` (`docs/shared.md`): a heading and one name per line: "Item check sent to:" with "Alice (Player 1)" (or "Item check posted in chat for:"), "Rolled for you:" with "Guard", or "Not sent:" with "Alice: …" and the reason. The menu stays open with its choices, so the same request can be sent again.
- **What each request does** (player character, NPC, damage roll, missing skill): `docs/roll-requests.md`, "What happens for each request".
- **Connects to:** `roll-requests/index.js` `send()`.
- **Could interact poorly with:** nothing beyond `send()`'s own notes. **Assumed.**

### Helpers: `shared/`
- **How it works:** The skill lookups are skill-values' (`findSkillRow`, `sameSkill`, `docs/skill-values.md`). The small DOM helpers (`button`, `segmented`, `line`), `levels` ("60 · 30 · 12", or "—"), the how rows and the Send runner and result are `shared/menu.js`'s (`docs/shared.md`), and `element` is `utils.js`'s, the same ones every menu uses.
- **Connects to:** nothing outside the part.
- **Could interact poorly with:** nothing. **Assumed.**

### `other-menu.css`
- **How it works:** Listed in `module.json` `styles` after `shared/shared.css` (it was `item-menu/item-menu.css`), which gives the buttons, rows of buttons, the weapon list and its rows (`rollbox-list`, `rollbox-row`), text boxes and the "Other…" drop-down, labelled lines, hints, sections, the damage line, the picker, the Blind toggle, the status line, the action buttons and the result line. This file keeps what only the Other menu has: the section tabs (12px, like the Check menu's), the Luck list (muted, 11px, scrolling past about 140px), the Group Luck line and its italic hint, the Copy link icon; and for the Item section (the greyed-out weapon row with no skill, the weapon's name and skill, the quick-picks' size, the chosen skill line), every rule scoped under `.rollbox-panel`. The weapon list scrolls past about 230px (about six rows: the improvised row and five weapons). Its radios draw at 14px (`--checkbox-size`, set in `shared.css` for every list row): Foundry draws radios and tick boxes as Font Awesome glyphs in `::before` / `::after`, sized by that variable (20px in `foundry2.css`), not by the input's box, so with a 14px box a 20px glyph would hang below the last row and make the list scroll. The six quick-picks use 10px type and no side padding so "1D10+½DB" fits; the option rows' labels are 50px with 2px button padding so "Extreme" fits beside the Blind toggle. A weapon row with a disabled radio is drawn in the theme's disabled colour (`--rollbox-disabled`, readable rather than faded), found with `:has()` (supported by the Chromium in Foundry's desktop app).
- **Connects to:** `mini-sheet/mini-sheet.css`.
- **Could interact poorly with:** Foundry's radio and tick-box drawing: if a Foundry update stops using `--checkbox-size`, the glyphs could overflow again (the list would scroll a little, nothing breaks). **Assumed** until Void's look check. Foundry's light interface theme: the menu follows Rollbox's own Theme setting, not Foundry's. The "Other…" list's options are drawn by the operating system and may ignore the dark colours. **Assumed.**

## Hooks, overrides, keybindings
- Hooks: none (the menu host calls `render`).
- Class overrides: none.
- Keybindings: none.

## Settings
None of its own. Shown only while the Rollbox switch (`rollboxEnabled`) is on.

## Tests

`tests/other-menu.test.mjs`: find the test you need in [TESTS.md, other-menu.test.mjs](TESTS.md#other-menutestmjs) and run only that.
