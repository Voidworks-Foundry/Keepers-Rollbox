# Opposed roll (`scripts/opposed-roll/`)

What the Keeper's Opposed button opens with exactly two characters selected. The names card and the button column give way to both characters' mini sheets with the opposed card between them. Each side picks one check (Characteristic, Attribute or Skill, with skills missing from the sheet at their base value) and up to two bonus or penalty dice; then Create opposed card makes CoC7's own opposed card through `roll-requests/`, which also clicks its Start rolls so an NPC side is rolled for the Keeper. Each player then rolls their own side on the card. Cancel goes back to the names card; the "⇅ Swap sides" button between the two sides changes which character is CoC7's first side (attacker). The view builds no request text and rolls nothing itself. Keeper only, with the Rollbox switch on. Files: `index.js`, `opposed-roll.css`.

**Status key:** *Confirmed* only when the build guide's Internal API registry or changelog says so. Nothing in this part has been tried at the table yet, so everything is **assumed** unless stated otherwise.

## What the Keeper sees

From left to right, bottoms aligned, starting where the names card was:

| Part | What it shows |
| --- | --- |
| First character's mini sheet | the same card as with one token selected (`miniSheet` from `mini-sheet/`) |
| Opposed card (330px) | "Opposed roll"; a block per side: a header with its role on CoC7's card ("Attacker" for the left-hand side, in the accent colour; "Defender" for the right, in blue), the name and the picked check in a small box ("STR 40", "Stealth 50 +1" with a bonus die; nothing until picked); tabs Characteristic / Attribute / Skill, the list for the open tab (one pick, each row with its value, the same full height as before), a search box on the Skill tab, Dice −2 … +2, and "Not on the sheet: CoC7 adds it at its base value when the card is made." when the pick is missing from that sheet; between the two blocks a larger "⇅ Swap sides" button with a short rule each side; then the footer: the tie line once both sides have a check (until then, in red, "Pick a check for both sides." or "Pick a check for Guard."), Cancel and Create opposed card (highlighted, disabled until both sides have a check); then what happened. No tooltips, no "VS", no rules paragraph |
| Second character's mini sheet | as the first |

The sides start in selection order. CoC7's opposed card marks its first side attacker (crossed swords) and its second defender (shield) (`newGroupMessage`, `apps/chat-opposed-message.js`); the left-hand character is the first side, and Swap sides (Void, 2026-11-14) lets the Keeper choose. Void asked for cards with no roles (2026-11-14); CoC7 8.15 can't make one: it resets each side to no role as it adds it, then makes the first attacker and the second defender, and compares the rolls only when one side is each (with both at none the card shows a disabled "An opposed card needs an attacker and defender" instead of Start rolls). So the tags and Swap stay (BUILD-GUIDE "Cards: opposed"). Outside combat the roles don't change who wins. There is no difficulty (the other side's roll is the difficulty, p. 92) and no Push (p. 90). Sanity isn't offered: a Sanity roll is never opposed. Copy link isn't offered: an opposed link clicked with tokens selected makes one card per token.

## Code

### `registerOpposedRoll()` (`index.js`, called from `main.js` at `ready`)
- **How it works:** Returns `false` unless `isKeeper()` is true and `rollboxEnabled` is on (the Keeper is checked first, so players never read the setting). Otherwise `registerMenu("opposed", { title: "Opposed roll", layout: "replace", render: renderOpposedRoll })`: the menu host draws it in place of the names card and hides the button column (`docs/mini-sheet.md`, `registerMenu`). Installs no hooks.
- **Connects to:** `mini-sheet/` (`registerMenu`); `utils.js` (`isKeeper`, `getSetting`).
- **Could interact poorly with:** nothing. **Assumed.**

### `renderOpposedRoll(stage, { actors, close })` and `OpposedView` (`index.js`)
- **How it works:** The menu host calls it when the Opposed button is clicked and again when the selection changes to two other characters; each call builds the whole view from scratch (picks and dice start empty). Anything but two characters draws nothing (the host only offers Opposed with two).
  - **Sheets:** `miniSheet(actor)` for each side, from `mini-sheet/`, with the extra class `rollbox-opposed-sheet`.
  - **Lists:** each side's rows are `checkChoices(actor, { sanity: false })` from `skill-values/`, the Check menu's rows without Sanity, under the shared `CHECK_TABS`: STR … EDU; Luck, Idea (INT), Know (EDU); skills trained highest first, the divider "Untrained · base value", then the rest A–Z at base value. Each row is a button showing the name and the value (opposed rolls compare at Regular, so no Hard or Extreme values). A row missing from the sheet has no tooltip (DESIGN: no tooltips inside menus); the side's own note says it once picked. The search box is the shared `filterRows`: it hides skill rows whose name doesn't hold the text (accents and case ignored) and the divider while searching; its text stays when switching tabs.
  - **Picks:** one per side (the picked `checkChoices` row), kept when switching that side's tab; the picked row has `aria-selected="true"`. Each side's check is `{ kind: "characteristic", name: "str" }`, `{ kind: "attribute", name: "lck" | "idea" | "know" }` or `{ kind: "skill", name, cocid }`, as `roll-requests/` takes it.
  - **Dice:** a row of buttons −2, −1, None, +1, +2 per side (Keeper Rulebook p. 91: at most two either way), the shared `segmented` row in a `line("Dice", …)`, labelled "<name>: bonus or penalty dice" for screen readers.
  - **Built before the first redraw:** `build()` makes both sides (`sideBlock`, split into `head`, `tabs`, `search`, `diceRow`), the swap block and the footer, then draws each side's list (`drawList`) and calls `update()` once, so `update()` needs no guards. A tab click draws that side's list and calls `update()`.
  - **Header pick:** `update()` writes the side's pick and dice into its header box ("STR 40", "STR 40 +1"), with an `aria-label` spelling the dice out ("STR 40, 1 bonus die"); hidden until a pick.
  - **Who rolls** (`whoRolls`): from roll-requests' `ownersOf` (CoC7's `actor.owners`): no owner → "Keeper rolls (NPC), by Start rolls"; owners, none online (`User#active`) → "Keeper rolls (player offline), by Start rolls"; otherwise "<players online> rolls on the card". CoC7's Start rolls rolls every side with no player owner online (`rollNoPlayers`, `apps/chat-opposed-message.js`), so the first two are rolled when Rollbox clicks it. It is shown only in the result after Create.
  - **Create:** Create opposed card is disabled until both sides have a pick, and while a card is being made (no double cards). The footer is the shared `sendSection` (`docs/shared.md`), with Cancel marked `data-keep` so it is never greyed out, and the tie line as its status line (`rollbox-opposed-tie`). The card's title uses the flyout title's class (`rollbox-flyout-title`, `mini-sheet.css`).
- **Connects to:** `skill-values/` (`checkChoices`); `mini-sheet/` (`miniSheet`); `roll-requests/` (`opposedRequest`, `send`, `ownersOf`); `shared/` through its `index.js` (`CHECK_TABS`, `filterRows`, `segmented`, `diceChoices`, `diceText`, `line`, `runSend`, `sendSection`, `showResult`); `utils.js` (`NO_VALUE`).
- **Could interact poorly with:** Foundry's global `button` and `input` styles: every rule is scoped under `.rollbox-panel`, in Foundry's `modules` cascade layer (BUILD-GUIDE "The panel and CSS"). **Assumed.** A change to a character while the view is open (e.g. HP lost) doesn't redraw its mini sheet here, because the menu host redraws a menu only when the selection changes; the names card behind it is kept up to date. **Assumed.**

### `missingText(sides)` (`index.js`)
- **How it works:** While Create opposed card is greyed out, the footer's line (the shared `sendSection`'s `ready()`) says what is missing, in red: "Pick a check for both sides." or "Pick a check for <name>." Once both sides have a check, the line becomes the tie line (`tieText`, written with the status line's `note()`). Every menu's send buttons stay greyed out until everything required is filled in, with the missing item named (Void, 2026-11-14).
- **Connects to:** `update()`; the shared status-line style (`docs/shared.md`).
- **Could interact poorly with:** nothing (pure text). **Confirmed** by tests only.

### `tieText(sides)` (`index.js`)
- **How it works:** Keeper Rulebook p. 91: on equal success levels the higher skill or characteristic wins, and if those are equal too it's a stalemate or both re-roll. CoC7's opposed card shows only "Tie" outside combat (BUILD-GUIDE Gap 7), so the view shows, in the footer above the buttons (the shared `statusLine`, `note()`: plain, not red; it is worked-out information, not a summary of what will be sent), "On a Tie: Guard wins, higher value (Spot Hidden 60 vs Stealth 50, p. 91)." or "On a Tie: equal values (50), so a stalemate or both re-roll (p. 91)." It compares the two values only, never dice or success levels: CoC7 still does all the comparing on its card. Empty when a value is unknown.
- **Connects to:** the picks' values from `skill-values/`.
- **Could interact poorly with:** a player character's missing skill is shown at Rollbox's base value; CoC7 adds it from its compendium at CoC7's base, which matched Rollbox's table for every skill (`docs/skill-values.md`). **Assumed.** CoC7's house rule `opposedRollTieBreaker` only changes the order of combat cards, not this. **Assumed.**

### Creating the card (`OpposedView#request`, `#create`, `#showResult`)
- **How it works:** `request()` is `opposedRequest({ sides: [{ actor, check, dice }, …] })`. Create → `send(request, [], { mode: "whisper" })`; `send()` makes one CoC7 opposed card with both sides at Regular difficulty, clicks Start rolls on the Keeper's screen, and checks first that CoC7 can find any skill missing from a sheet (CoC7 adds it to that sheet when it makes the card, NPCs too: Void's decision, 2026-11-13). `docs/roll-requests.md`, "Opposed". The result line then shows:
  - a card made (`showResult` with its own heading and lines, `docs/shared.md`): "Opposed card made:", then one line per side, "Alice: Test rolls on the card" and "Guard: Keeper rolls (NPC), by Start rolls". Cancel now reads Close; the view stays open so the tie line is at hand.
  - no card: "Not sent:" with each of `send()`'s `skipped` reasons, e.g. "Guard: CoC7 can't find Pilot (Boat)" (also shown by `send()` as a notification), or the reason alone for the whole card, in the accent colour (`rollbox-opposed-warning`); or "CoC7's roll links aren't available; nothing was sent."
- **Connects to:** `roll-requests/index.js` `send()` and `sendOpposed`.
- **Could interact poorly with:** nothing beyond `send()`'s own notes (CoC7 needs one side attacker and the other defender, which it sets itself; if Start rolls can't be clicked the Keeper is told to click it). **Assumed.**

### Cancel
- **How it works:** Calls the host's `close()`: the view goes, and the names card and the buttons come back. Nothing is sent. Selecting anything other than two characters closes it too (the host's rule).
- **Connects to:** `mini-sheet/menu-host.js`.
- **Could interact poorly with:** nothing. **Assumed.**

### Swap sides (`OpposedView#swapBlock`, `#swap`)
- **How it works:** A larger "⇅ Swap sides" button between the two sides. Reverses the two sides, each keeping its tab, pick, dice and search text, and draws the whole view again: the sheets change places, the left-hand side reads "Attacker", and Create opposed card sends the new left-hand character as CoC7's first side (its roll string first, and the actor `_onLinkActorClick` is called with). Disabled while a card is being made. Nothing is sent. A result line from an earlier card is cleared; Close stays Close.
- **Connects to:** `roll-requests/` `sendOpposed` (side order).
- **Could interact poorly with:** a selection change while the view is open redraws it in selection order again (the menu host's rule), so a swap is lost then. **Assumed.** In combat CoC7's attacker and defender matter, but Rollbox never makes combat cards (`combat: false`). **Assumed.**

### `opposed-roll.css`
- **How it works:** Listed in `module.json` `styles` after `shared/shared.css`, which gives the tabs, dice buttons, Cancel and Create buttons, the search box, the divider, the hint, the Dice line and the result line their look; the view's DOM helpers are `shared/menu.js`'s. This file keeps what only the Opposed roll has. Uses the panel's colour variables from `mini-sheet.css`; every class starts `rollbox-opposed-` and every rule is scoped under `.rollbox-panel`. The opposed card is 330px wide and scrolls past 75% of the window height, divided by the Panel size (`--rollbox-scale`) so it stays on screen at 150%; each side's list scrolls past about 120px. The Defender tag is the theme's blue (`--rollbox-defender`), the Attacker tag the accent colour; the Swap button is 13px with 16px side padding. Nothing inside the card, a side or a list may shrink (`flex-shrink: 0`): the rows are buttons with `min-height: 0`, and in a column flex box that hits its max-height they would shrink below their text and overlap. The whole row (about 750px with both sheets) lies over the canvas to the right of the left column.
- **Connects to:** `mini-sheet/mini-sheet.css` (`.rollbox-card`, `.rollbox-stage`).
- **Could interact poorly with:** a small window or a large UI scale: the row is wider than the flyout menus. **Assumed.** Foundry's light interface theme: the view follows Rollbox's own Theme setting, not Foundry's. **Assumed.**

## Hooks, overrides, keybindings
- Hooks: none (the menu host calls `render`; `send()` watches for the card).
- Class overrides: none.
- Keybindings: none.

## Settings
None of its own. Shown only while the Rollbox switch (`rollboxEnabled`) is on.
