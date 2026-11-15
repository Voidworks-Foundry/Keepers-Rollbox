# Check menu (`scripts/check-menu/`)

The flyout the Keeper's Check button opens, in three sections with space between them: what (tabs, search, list), how (options), send (status line and buttons). Two tabs, Characteristic and Skill, list what the selected characters can roll; ticking one row is a check, ticking two or more is a combined roll; the options set difficulty, bonus or penalty dice, Blind and a label. There is no Attribute tab since 0.1.1 (Void, 2026-11-15): Luck and the Group Luck roll are the Other menu's (`docs/other-menu.md`), Sanity has its own menu, and Idea and Know are INT and EDU checks with a label ("Idea", "Know"). A click on a characteristic on the mini sheet opens the menu with that one ticked, or sends at once (`apply`, below). Request from player (or Send to each, or Roll for NPC), Send to chat and Copy link all go through `roll-requests/`, which builds CoC7's own links and rolls NPCs for the Keeper: the menu builds no request text and rolls nothing itself. Keeper only, with the Rollbox switch on. Files: `index.js`, `check-menu.css`; the shared controls, small DOM helpers (`shared/menu.js`) and generic looks (`shared/shared.css`) are `docs/shared.md`.

**Status key:** *Confirmed* only when the build guide's Internal API registry or changelog says so. Nothing in this part has been tried at the table yet, so everything is **assumed** unless stated otherwise.

## What the Keeper sees

| Part | One character | Two or more |
| --- | --- | --- |
| Characteristic tab | STR … EDU, each with Regular · Hard · Extreme | STR … EDU, no values |
| Under the title | the character's name, muted | the names, muted |
| Skill tab | search box; trained skills highest first, a divider "Untrained · base value", then every other skill A–Z at its base value; a search that matches no listed skill shows "+ Add <typed name>" with its base values ("1 · 0 · 0" for Pilot (Boat)) | search box; every skill A–Z without values, including specialisations any of them has ("Language (Latin)"); "+ Add <typed name>" without values |
| Options (how) | Combined roll All of them / Any one (two or more ticks); Difficulty Regular / Hard / Extreme / Hidden and Dice −2 … +2, with the tall Blind toggle beside both rows (greyed out on a combined roll); Label | |
| Sending | the line above the buttons only in red, while the three buttons are greyed out: "Tick a check to request it." (no summary of what will be sent, Void 2026-11-14); Request from player (highlighted), Send to chat, and Copy link as a small link icon (`aria-label` "Copy link"); then the result: "Check sent to:" with one character per line, "Rolled for you:", "Not sent:" | "Send to each (N)" instead of Request from player. Every character an NPC (no player owner): "Roll for NPC" / "Roll for NPCs" (Void, 2026-11-14) |

No help lines or tooltips: no Hidden hint, no Blind reason, no "not on the sheet" tooltips.

There is no Pushed option (pushing happens from the Push button on CoC7's result card, BUILD-GUIDE Gap 3).

## Code

### `registerCheckMenu()` (`index.js`, called from `main.js` at `ready`)
- **How it works:** Returns `false` unless `isKeeper()` is true and `rollboxEnabled` is on (the Keeper is checked first, so players never read the setting). Otherwise `registerMenu("check", { title: "Request a check", render: renderCheckMenu })`. Installs no hooks.
- **Connects to:** `mini-sheet/` (`registerMenu`); `utils.js` (`isKeeper`, `getSetting`).
- **Could interact poorly with:** nothing. **Assumed.**

### `renderCheckMenu(body, { actors, start })` and `CheckMenu` (`index.js`)
- **How it works:** The menu host calls it when the menu opens and again when the selection changes while it is open; each call builds a new `CheckMenu` from scratch (ticks and options start empty), then applies `start` if given (below). Nothing selected draws nothing and returns nothing; otherwise it returns a controller `{ apply(start) }` the menu host keeps while the menu is open, so another click on the mini sheet reaches the open menu instead of redrawing it.
  - **Sections:** a muted line with the names (`rollbox-menu-who`), then `rollbox-section` blocks for what (tabs and lists), how (options) and send; the spacing is `shared/shared.css`.
  - **Lists:** `checkChoices(actor)` from `skill-values/` (`docs/skill-values.md`), the same rows the Opposed view lists: with one character its characteristic and skill rows with values; with several, `checkChoices(null)`'s characteristic rows without values and `groupSkills(actors)` for the skills. The tabs are `shared/menu.js`' `CHECK_TABS`. Rows are `<label>` with a tick box (`listPanel` for Characteristic, `skillPanel` for Skill); values only for one character. The divider goes before the first untrained skill. The search box is the shared `filterRows`: it hides rows whose name doesn't contain the text (accents and case ignored) and the divider while searching; when no listed row is left, the "+ Add" row shows (below).
  - **Ticks** are kept in a `Map` in the order ticked, keyed by kind and name, so they survive switching tabs. Each holds the check as `roll-requests/` takes it: `{ kind: "characteristic", name: "str" }` or `{ kind: "skill", name, cocid, value? }`.
  - **Options:** the combined all/any row (`segmented`), the shared Difficulty, Dice and Blind rows (`howRows`, `docs/shared.md`) and a Label text box. `update()` redraws only what depends on them (pressed buttons, Blind's state, the status line and the send buttons), so typing in the label or the search box keeps its focus.
  - **Blind** is disabled and shown off while two or more checks are ticked (CoC7's combined card is always public, Gap 5); the Keeper's choice comes back if they untick down to one. Its `on` goes into the request's `blind` option, as the tick box did.
  - **Status line** (the shared `sendSection`'s, `ready()`): only in red, while nothing is ticked ("Tick a check to request it."), with the buttons greyed out; hidden otherwise.
- **Connects to:** `skill-values/` (`checkChoices`, `groupSkills`, `findSkillRow`, `skillKey`, `groupBase`, `withLevels`, `comparable` for whether the search holds any text), `roll-requests/` (`checkRequest`, `send`), `shared/` through its `index.js` (`CHECK_TABS`, `filterRows`, `howRows`, `requestLabel`, `runSend`, `sendSection`, `showResult`).
- **Could interact poorly with:** Foundry's global `button` and `input` styles: every rule is scoped under `.rollbox-panel` and Foundry loads module styles into its `modules` cascade layer, after its own (BUILD-GUIDE "The panel and CSS"). **Assumed.** An update to a character while the menu is open (e.g. a skill improved) doesn't redraw the menu, so its values are those of when it was drawn (the menu host's rule, so a half-filled menu isn't lost). **Assumed.**

### Sending (`CheckMenu#request`, `#send`, `#showResult`)
- **How it works:** `request()` is `checkRequest({ checks, all, difficulty, dice, blind, label })`; Blind is sent only with one check. The Label goes after the check's name in the link, "Hard Spot Hidden · notice the knife" or "Spot Hidden + Listen · notice the knife", in requests and Copy link alike; `roll-requests/` does that (`docs/roll-requests.md`, "Labels"), so the menu passes the text as typed. The request goes to every selected character (the group Luck roll is the Other menu's since 0.1.1). The buttons are greyed out while nothing is ticked, and while a send is running (`runSend`, no double sends). The main button's words are `requestLabel(actors)`: "Request from player", "Send to each (N)", or "Roll for NPC" / "Roll for NPCs" when every target is an NPC. Request from player → `send(request, actors, { mode: "whisper" })`; Send to chat → `"chat"`; Copy link → `"link"` (the first character's link). The result under the buttons is shared/menu.js's `showResult` (`docs/shared.md`): a heading and one name per line: "Check sent to:" (or "Check posted in chat for:") with "Alice (Player 1)", "Bob (Player 2)" on their own lines; "Rolled for you:" with "Guard"; "Not sent:" with "Carl: CoC7 can't find Pilot (Boat)"; "Link copied."; or "CoC7's roll links aren't available; nothing was sent." The menu stays open with its ticks, so the same request can be sent again.
- **What each request does** (player characters, NPCs, combined, missing skills): `docs/roll-requests.md`, "What happens for each request".
- **Connects to:** `roll-requests/index.js` `send()`.
- **Could interact poorly with:** nothing beyond `send()`'s own notes. **Assumed.**

### A starting state from the mini sheet (`CheckMenu#apply`)
- **How it works:** `apply({ tick, add, plain, send, focus })`, from a click on a characteristic on the mini sheet (`docs/mini-sheet.md`, "Clicks on the mini sheet's values"); through `renderCheckMenu`'s `start` when the menu opens, or the controller when it is already open. `tick` is a Characteristic row's key ("characteristic:str"). Unless `add`, every other tick is cleared first (a left click: only that one ticked; again while open switches it, keeping the options); with `add` (Alt + right click) it is added to the ticks, so two or more make a combined roll. The Characteristic tab is shown. `plain` puts the options back to a Regular check with no dice, not blind and no label, as CoC7's sheet rolls a Shift or Ctrl click; `send` then sends it ("whisper" as Request from player, or "link" to copy it); `focus: "link"` puts the keyboard focus on Copy link without copying (Shift + Ctrl click: "ready for Copy link"). A key that isn't a Characteristic row ticks nothing.
- **Connects to:** `mini-sheet/` (the menu host's `open(id, start)` and controller); `#send`.
- **Could interact poorly with:** nothing. **Assumed.** Void's table check (session 16, 2026-11-15) passed every shortcut.

### `otherSkill(text, known)` (not exported) and "+ Add" (`CheckMenu#filter`, `#addOther`, `#addOtherWithValue`, `#addExtra`)
- **How it works:** When the search matches no listed skill, the list's first row is "+ Add <typed name>" (a button), with the base values for one character when a group base is known (skill-values' `withLevels`). Clicking it, or Enter in the search, does what Add did, then empties the search so the whole list shows again:
  1. A name the Skill tab already lists (skill-values' `findSkillRow`: accents, case and spaces ignored): that row is ticked (only reachable by Enter, since a listed name matches the search).
  2. Otherwise a specialisation of an open-ended skill (skill-values' `groupBase`: Art/Craft 5, Language 1, Lore 1, Pilot 1, Science 1, Survival 10; Keeper Rulebook p. 56): added as a ticked row under the list showing "base 1", sent as `{ kind: "skill", name, value }`.
  3. Otherwise the Keeper is asked "No base value known for X. Value to roll an NPC at:" (0–100), and the skill is added at that value; a value out of range says so in red.
  The value is used only for an NPC that lacks the skill (rolled privately at it). A player character's request goes by name: CoC7 adds the skill to the sheet if it can find it, and if it can't, `send()` skips that character and tells the Keeper.
- **Connects to:** `skill-values/` (`groupBase`, `findSkillRow`, `skillKey`, `withLevels`); `roll-requests/` (the check's `value`).
- **Could interact poorly with:** a typed name holding `, : [ ] { } # &` can't go in a CoC7 link; `send()` skips it with a notice. **Assumed.**

### `check-menu.css`
- **How it works:** Listed in `module.json` `styles` after `shared/shared.css`, which gives the buttons, tabs, rows of buttons, lists with tick boxes (`rollbox-list`, `rollbox-row`), text boxes, labelled lines (labels 50px), hints, the divider, sections, the Blind toggle, the status line, the action buttons and the result line. This file keeps what only the Check menu has: the tab row and 12px tabs, the "+ Add" row, the row's name and values, the 56px value box for a typed skill, 2px side padding for the option buttons so "Extreme" fits beside the Blind toggle, the italic hint and the red error line. Every rule is scoped under `.rollbox-panel` and uses the panel's colour variables. The lists scroll past about 230px; the flyout itself scrolls past 70% of the window height. Its tick boxes draw their glyph at 14px (`--checkbox-size`, shared.css), so the lists don't scroll a few pixels early.
- **Connects to:** `mini-sheet/mini-sheet.css`, `shared/shared.css`.
- **Could interact poorly with:** Foundry's light interface theme: the menu follows Rollbox's own Theme setting, not Foundry's (`docs/mini-sheet.md`). Foundry no longer sizing its tick-box glyph with `--checkbox-size`: the lists would scroll a little early again. **Assumed** until Void's look check.

## Hooks, overrides, keybindings
- Hooks: none (the menu host calls `render`).
- Class overrides: none.
- Keybindings: none. Enter in the search adds the typed skill while "+ Add" shows; there is no form, so Enter never submits anything else.

## Settings
None of its own. Shown only while the Rollbox switch (`rollboxEnabled`) is on.

## Tests

`tests/check-menu.test.mjs`: find the test you need in [TESTS.md, check-menu.test.mjs](TESTS.md#check-menutestmjs) and run only that.
