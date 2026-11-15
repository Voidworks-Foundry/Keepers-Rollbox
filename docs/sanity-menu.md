# Sanity menu (`scripts/sanity-menu/`)

The flyout the Keeper's Sanity button opens. It shows each selected character's current SAN, then three sections with space between them: the loss (a large editable line "0 / 1D6", the presets, and a Custom button for the compact picker, `docs/shared.md`), the cause, and sending. The cause is two optional fields: "What caused it" (the label the players see) and "Creature" (CoC7's record of creatures already seen). Request from player (or Send to each, or Roll for NPC(s) when every character is an NPC) and Send to chat go through `roll-requests/`, which builds CoC7's own Sanity link and makes an NPC's Sanity card for the Keeper: the menu builds no request text and rolls nothing itself. After sending nothing is Rollbox's: CoC7's Sanity card rolls, the loss is applied when the Keeper clicks Apply on the card, and the INT roll, bouts of madness and insanity follow on the same card. Keeper only, with the Rollbox switch on. Files: `index.js`, `sanity-menu.css`.

**Status key:** *Confirmed* only when the build guide's Internal API registry or changelog says so. Nothing in this part has been tried at the table yet, so everything is **assumed** unless stated otherwise.

## What the Keeper sees

| Part | What it shows |
| --- | --- |
| SAN list | muted, under the title: each selected character's name and "SAN 60 / 99" (or "SAN 60" without a max); a character with no Sanity value shows "— skipped" |
| Loss line | large plain text "0 / 1D6", each side editable (`valueLine`), "success" and "failure" under them; starts at 0 / 1D6 (DESIGN.md). Empty becomes 0; text that isn't a loss turns red, greys out the buttons and the status line says "A loss is a number or dice, e.g. 2, 1D6 or 1D6+1D4." (DB is refused: there is no damage bonus in a loss) |
| Presets | 0/1, 0/1D3, 0/1D6, 1/1D4+1, 1/1D6, 1D3/1D10, 1D6/1D20, 1D10/1D100, two rows of four, under the line; a click fills both sides; the one matching the line is highlighted. Gone with Simplified dice UI on (Void's table check: `hideWhenSimplified`, `docs/shared.md`) |
| Custom success or failure loss | full width; opens the compact picker for both sides ("On a success", "On a failure"). Gone with Simplified dice UI on |
| What caused it | optional text, placeholder only: shown to the players instead of the numbers, as "Sanity check · …"; empty gives "Sanity (1/1D6)" |
| Creature | optional text, placeholder "Creature, e.g. Ghoul (optional)": CoC7 remembers it and caps later losses to the same kind |
| Sending | the line above the buttons only in red, when the loss isn't one (no summary, Void 2026-11-14); Request from player (highlighted; "Send to each (N)" with several), Send to chat; then the result: "Sanity check sent to:" with one character per line, "Rolled for you:" (NPCs whose card was made and rolled), "Not sent:" ("Thing: no Sanity value"), then "Click Apply on CoC7's card to take the loss." |

No help lines or tooltips: the cause and creature fields have placeholders only.

There is no Blind option (CoC7's Sanity request can't be blind, BUILD-GUIDE Gap 4), no difficulty and no dice, and no Copy link (not in the design).

## Code

### `registerSanityMenu()` (`index.js`, called from `main.js` at `ready`)
- **How it works:** Returns `false` unless `isKeeper()` is true and `rollboxEnabled` is on (the Keeper is checked first, so players never read the setting). Otherwise `registerMenu("sanity", { title: "Sanity check", render: renderSanityMenu })`. Installs no hooks.
- **Connects to:** `mini-sheet/` (`registerMenu`); `utils.js` (`isKeeper`, `getSetting`).
- **Could interact poorly with:** nothing. **Assumed.**

### `renderSanityMenu(body, { actors })` and `SanityMenu` (`index.js`)
- **How it works:** The menu host calls it when the menu opens and again when the selection changes while it is open; each call builds a new `SanityMenu` from scratch (the line back at 0 / 1D6, the fields empty). Nothing selected draws nothing.
  - **SAN list:** `attributes(actor)` from `skill-values/` (the `san` row's `value` and `max`). Read once when drawn.
  - **Loss line:** two `valueLine`s (`shared/`) with `roll-requests/`' `sanityLoss` as their rule, in a `valueBox` with captions; they start at `START` (0 and 1D6). `losses()` is both lines' values; while either is refused, the send buttons are disabled and the status line shows `LOSS_HINT` in red (the shared `sendSection`'s `ready()`).
  - **Presets** (`PRESETS`) write both lines (`valueLine#set`). `update()` marks the preset whose success and failure equal the lines' values (`aria-pressed`), so typing 1 and 1D6 by hand keeps 1/1D6 highlighted.
  - **Custom:** `customDice` with two `dicePicker`s, one per line; `update()` syncs them, so typing or a preset moves them.
  - `update()` redraws only what depends on the state (pressed preset, the pickers, the button text, disabled buttons, the status line), so typing keeps its focus.
- **Connects to:** `skill-values/` (`attributes`), `roll-requests/` (`sanityLoss`, `sanityRequest`, `send`), `shared/` through its `index.js` (`valueLine`, `captioned`, `valueBox`, `dicePicker`, `customDice`, `hideWhenSimplified`, `button`, `textInput`, `requestLabel`, `runSend`, `sendSection`, `showResult`, and `shared.css`'s generic button, text box and result rules); `utils.js` (`element`, `NO_VALUE`).
- **Could interact poorly with:** Foundry's global `button` and `input` styles: every rule is scoped under `.rollbox-panel` and Foundry loads module styles into its `modules` cascade layer, after its own (BUILD-GUIDE "The panel and CSS"). **Assumed.** A change to a character's SAN while the menu is open doesn't redraw the menu (the menu host's rule, so a half-filled menu isn't lost); the panel's mini sheet or names card does show the new SAN. **Assumed.**

### `sanityLoss` (`roll-requests/`)
The loss rule the loss line uses is `roll-requests/`' `sanityLoss` (`docs/roll-requests.md`), so the line and `sanityRequest` follow one rule.

### `defaultCause(success, failure)` (`index.js`)
- **How it works:** "Sanity (1/1D6)", used as the link's label when "What caused it" is empty. Without a label CoC7 shows its own text, "[regular] SAN loss(0) (1/1D6)": the "(0)" is the `poolModifier:0` the Sanity link must keep (without it CoC7's Sanity card ignores the difficulty, `CoC7SanCheckCard.create`). The player's message then reads "Your keeper has requested Alice make a Sanity (1/1D6) roll." The menu sends it as the `cause`, so `roll-requests/` is unchanged.
- **Connects to:** `causeLabel`.
- **Could interact poorly with:** nothing. **Assumed** (the label's look in chat not yet seen).

### `causeLabel(cause, { success, failure })` (`index.js`)
- **How it works:** The link's label. With "What caused it" filled in: "Sanity check · Seeing a ghoul", so players see it's a Sanity check (Void, 2026-11-13); the loss numbers are never shown. Empty: `defaultCause` ("Sanity (1/1D6)"). The menu sends it as the `cause`, so `roll-requests/` takes it as it is. Applies to every request the menu sends (the Sanity menu has no Copy link).
- **Connects to:** `SanityMenu#request`, `defaultCause`.
- **Could interact poorly with:** nothing. **Assumed.**

### Sending (`SanityMenu#request`, `#send`, `#showResult`)
- **How it works:** `request()` is `sanityRequest({ success, failure, cause, creature })`, with `cause` from `causeLabel`. It becomes the link's `{label}` (cleaned by `cleanLabel`); "Creature" becomes `sanReason` (cleaned by `cleanOption`). Request from player → `send(request, actors, { mode: "whisper" })`; Send to chat → `"chat"`. Every selected character is passed; `send()` skips one with no Sanity value. The buttons are greyed out while a send runs (`runSend`, no double sends) and while either side of the loss line isn't a loss. The result under the buttons is shared/menu.js's `showResult` (`docs/shared.md`): a heading and one name per line: "Sanity check sent to:" (or "posted in chat for:") with "Alice (Player 1)", "Bob (Player 2)"; "Rolled for you:" with each NPC whose card was made and rolled; "Not sent:" with "Thing: no Sanity value" (each of `send()`'s skipped reasons); then "Click Apply on CoC7's card to take the loss." when anything went. The menu stays open with its values, so the same request can be sent again.
- **What each request does:** `docs/roll-requests.md`, "Sanity: `sendSanity`". A player character gets `@coc7.sanloss[sanMin:…,sanMax:…,sanReason:…,difficulty:1,poolModifier:0,blind:false]{label}`; an NPC's Sanity card is made on the Keeper's side and Rollbox clicks its Sanity roll; the card is public (Void, 2026-11-13).
- **Connects to:** `roll-requests/index.js` `sanityRequest()`, `send()`.
- **Could interact poorly with:**
  - CoC7's Sanity card: the loss waits for the Keeper's Apply (BUILD-GUIDE "Cards: Sanity"). **Assumed** until Void's table check.
  - CoC7's creature record (`maxLossToSanReason`): the same creature typed two ways ("Ghoul", "ghouls") counts as two sources, and a creature already at its cap gives no loss (the card says the character is immune). **Assumed.**
  - The label goes into CoC7's request sentence ("make a {label} roll"), so a cause written as a sentence reads oddly there; the link itself shows it as typed. **Assumed.**

### `sanity-menu.css`
- **How it works:** Listed in `module.json` `styles`. Uses the panel's colour variables from `mini-sheet.css` (so it follows the "Panel transparency" setting); every class starts `rollbox-sanity-` and every rule is scoped under `.rollbox-panel`. Same look as the Check menu, with its own class names so the part stands alone. Sections, the loss line, the picker, the status line and the main button's highlight are `shared/shared.css`. The SAN list scrolls past about 140px; the flyout itself scrolls past 70% of the window height.
- **Connects to:** `mini-sheet/mini-sheet.css`.
- **Could interact poorly with:** Foundry's light interface theme: the menu stays dark like the panel. **Assumed.**

## Hooks, overrides, keybindings
- Hooks: none (the menu host calls `render`; `roll-requests/` watches for an NPC's Sanity card while sending).
- Class overrides: none.
- Keybindings: none. Enter in a loss line confirms it; there is no form, so Enter never sends.

## Settings
None of its own. Shown only while the Rollbox switch (`rollboxEnabled`) is on.
