# Sanity tab of the Check flyout (`scripts/flyouts/check/sanity.js`)

The Check flyout's third tab (Sanity is a Check tab, with no button of its own), the Keeper's only (players have no Sanity tab; Sanity checks are the Keeper's). It shows each selected character's current SAN in place of the Check flyout's names line, then three sections with space between them: the loss (a large editable line "0 / 1D6", the presets, and a Custom button for the compact picker, [shared.md](shared.md)), the cause, and sending. The cause is two optional fields: "What caused it" (the label the players see) and "Creature" (CoC7's record of creatures already seen). The one send button ("Send to <name>", "Send to each (N)", "Send to all players" with nothing selected, or "Roll for NPC(s)" when every character is an NPC; no Send to chat) goes through `roll-requests/`, which builds CoC7's own Sanity link and makes an NPC's Sanity card for the Keeper: the tab builds no request text and rolls nothing itself. After sending nothing is Rollbox's: CoC7's Sanity card rolls, the loss is applied when the Keeper clicks Apply on the card, and the INT roll, bouts of madness and insanity follow on the same card. The Check flyout's options and send section are hidden while this tab shows; this tab has its own. The Keeper's, with the Rollbox switch on; never a player's (`tabsFor`, [check-flyout.md](check-flyout.md)). With nothing selected it goes to every investigator (`everyone`). Files: `sanity.js`; its look is in `check.css`. User guide: [Check](../guide/check.md).

**Status key:** *Confirmed* only when the build guide's Internal API registry or changelog says so. Everything is **assumed** unless stated otherwise.

## What the Keeper sees

| Part | What it shows |
| --- | --- |
| SAN list | muted, under the title: each selected character's name and "SAN 60 / 99" (or "SAN 60" without a max); a character with no Sanity value shows "— skipped". With nothing selected, the two short lines instead: "No one selected: this goes to every investigator." and "Select tokens to choose who." |
| Loss line | large plain text "0 / 1D6", each side editable (`valueLine`), "success" and "failure" under them; starts at 0 / 1D6. Empty becomes 0; text that isn't a loss turns red, greys out the buttons and the status line says "A loss is a number or dice, e.g. 2, 1D6 or 1D6+1D4." (DB is refused: there is no damage bonus in a loss) |
| Presets | 0/1, 0/1D3, 0/1D6, 1/1D4+1, 1/1D6, 1D3/1D10, 1D6/1D20, 1D10/1D100, two rows of four, under the line; a click fills both sides; the one matching the line is highlighted. Gone with Simplified dice UI on (`hideWhenSimplified`, [shared.md](shared.md)) |
| Custom success or failure loss | full width; opens the compact picker for both sides ("On a success", "On a failure"). Gone with Simplified dice UI on |
| What caused it | optional text, placeholder "What caused it (optional)": shown to the players instead of the numbers, as "Sanity check · …"; empty gives "Sanity (1/1D6)" |
| Creature | optional text, placeholder "Creature, e.g. Ghoul (optional)": CoC7 remembers it and caps later losses to the same kind |
| Sending | the line above the button only in red, when the loss isn't one (no summary); one highlighted button, "Send to <name>" ("Send to each (N)" with several, "Send to all players" with nothing selected, "Roll for NPC(s)" when all are NPCs); then the result: "Sanity check sent to:" with one character per line, "Rolled for you:" (NPCs whose card was made and rolled), "Not sent:" ("Thing: no Sanity value"), then "Click Apply on CoC7's card to take the loss." |

No help lines or tooltips: the cause and creature fields have placeholders only.

There is no Blind option (CoC7's Sanity request can't be blind, BUILD-GUIDE Gap 4), no difficulty and no dice, and no Send to chat or Copy link (Rollbox copies no links; a Ctrl click on SAN opens this tab).

## Code

### `PRESETS` (`sanity.js`, exported)
- **How it works:** The eight common losses as `{ success, failure }`, in the order [DESIGN.md, "Check flyout"](DESIGN.md#check-flyout) lists them; the presets row is built from it.
- **Connects to:** `SanityTab#lossSection`, `#update`.
- **Could interact poorly with:** nothing.

### `SanityTab` (`sanity.js`, exported)
- **How it works:** `new SanityTab(actors, { everyone }).build()` returns `{ who, parts }`: `who` is the SAN list, `parts` the loss section, the cause section and the send section. `CheckFlyout` (`index.js`) builds it once when the flyout is drawn (the menu host draws the flyout from scratch when it opens and when the selection changes, so the line is back at 0 / 1D6 and the fields empty then) and shows these parts only while the Sanity tab is chosen; switching tabs hides them and keeps what was typed.
  - **SAN list** (`sanList`): `attributes(actor)` from `skill-values/` (the `san` row's `value` and `max`). Read once when drawn. With `everyone` it is the shared `whoLine` (two short lines, class `rollbox-sanity-list`) instead.
  - **Loss line** (`lossSection`): two `valueLine`s (`shared/`) with `roll-requests/`' `sanityLoss` as their rule, so the line and `sanityRequest` follow one rule ([roll-requests.md](roll-requests.md)), captioned "success" and "failure" in a `valueBox`; they start at `START` (0 and 1D6). `losses()` is both lines' values, null while either is refused; then the send buttons are greyed out and the status line shows `LOSS_HINT` in red (the shared `sendSection`'s `ready()`).
  - **Presets** (`choose`) write both lines (`valueLine#set`). `update()` marks the preset whose success and failure equal the lines' values (`aria-pressed`), so typing 1 and 1D6 by hand keeps 1/1D6 highlighted.
  - **Custom:** `customDice` with two `dicePicker`s, one per line; `update()` syncs them, so typing or a preset moves them.
  - `update()` redraws only what depends on the state (pressed preset, the pickers, the main button's words, disabled buttons, the status line), so typing keeps its focus.
  - **`apply({ plain, send })`**, from a SAN click on the character sheet (through `CheckFlyout#apply` with `tab: "sanity"`; the shortcuts are in [check-flyout.md](check-flyout.md)): `plain` sets the loss to 0 / 0 (`PLAIN`) and empties What caused it and Creature; with `plain` and `send` it is a **plain SAN roll** instead, as CoC7's sheet rolls a Shift click on SAN (`sendPlain`): `checkRequest({ checks: [{ kind: "attribute", name: "san" }] })`, CoC7's own SAN attribute check (no Sanity card, no loss), sent as the one button sends. Its result reads "SAN roll sent to:". `send` without `plain` sends the tab's Sanity check as it stands.
- **Connects to:** `skill-values/` (`attributes`); `roll-requests/` (`checkRequest`, `sanityLoss`, `sanityRequest`, `send`); `flyouts/flyout.js` (`button`, `textInput`, `sendLabel`, `runSend`, `sendSection`, `showResult`, `whoLine`); `shared/index.js` (`valueLine`, `captioned`, `valueBox`, `dicePicker`, `customDice`, `hideWhenSimplified`); `utils.js` (`element`, `NO_VALUE`); `CheckFlyout` (`index.js`).
- **Could interact poorly with:** Foundry's global `button` and `input` styles: every rule is scoped under `.rollbox-panel` and Foundry loads module styles into its `modules` cascade layer, after its own (BUILD-GUIDE "The panel and CSS"). **Assumed.** A change to a character's SAN while the flyout is open doesn't redraw the tab (the menu host's rule, so a half-filled flyout isn't lost); the panel's character sheet or character cards do show the new SAN. **Assumed.**

### `defaultCause(success, failure)` (`sanity.js`, private)
- **How it works:** "Sanity (1/1D6)", used as the link's label when "What caused it" is empty. Without a label CoC7 shows its own text, "[regular] SAN loss(0) (1/1D6)": the "(0)" is the `poolModifier:0` the Sanity link must keep (without it CoC7's Sanity card ignores the difficulty, `CoC7SanCheckCard.create`). The player's message then reads "Your keeper has requested Alice make a Sanity (1/1D6) roll."
- **Connects to:** `causeLabel`.
- **Could interact poorly with:** nothing. **Assumed.**

### `causeLabel(cause, { success, failure })` (`sanity.js`, private)
- **How it works:** The link's label. With "What caused it" filled in: "Sanity check · Seeing a ghoul", so players see it's a Sanity check; the loss numbers are never shown. Empty: `defaultCause` ("Sanity (1/1D6)"). The tab sends it as the `cause`, so `roll-requests/` takes it as it is. A plain SAN roll is CoC7's attribute check and gets no label.
- **Connects to:** `SanityTab#request`, `defaultCause`.
- **Could interact poorly with:** nothing. **Assumed.**

### Sending (`SanityTab#request`, `#send`, `#sendPlain`)
- **How it works:** `request()` is `sanityRequest({ success, failure, cause, creature })`, with `cause` from `causeLabel`. It becomes the link's `{label}` (cleaned by `cleanLabel`); "Creature" becomes `sanReason` (cleaned by `cleanOption`). The button → `send(request, actors)` (whispers, or the NPC's card for the Keeper); its words are `sendLabel(actors, { everyone })`. Every character the tab is for is passed (every investigator with `everyone`); `send()` skips one with no Sanity value. The buttons are greyed out while a send runs (`runSend`, no double sends) and while either side of the loss line isn't a loss. The result under the buttons is `showResult` ([flyouts.md](flyouts.md)) with "Sanity check": "Sanity check sent to:" with "Alice (Player 1)", "Bob (Player 2)"; "Rolled for you:" with each NPC whose card was made and rolled; "Not sent:" with "Thing: no Sanity value" (each of `send()`'s skipped reasons); then "Click Apply on CoC7's card to take the loss." when anything went. The tab stays open with its values, so the same request can be sent again.
- **What each request does:** [roll-requests.md](roll-requests.md), "Sanity: `sendSanity`". A player character gets `@coc7.sanloss[sanMin:…,sanMax:…,sanReason:…,difficulty:1,poolModifier:0,blind:false]{label}`; an NPC's Sanity card is made on the Keeper's side and Rollbox clicks its Sanity roll; the card is public.
- **Connects to:** `roll-requests/index.js` (`sanityRequest`, `checkRequest`, `send`).
- **Could interact poorly with:**
  - CoC7's Sanity card: the loss waits for the Keeper's Apply (BUILD-GUIDE "Cards: Sanity"). **Assumed.**
  - CoC7's creature record (`maxLossToSanReason`): the same creature typed two ways ("Ghoul", "ghouls") counts as two sources, and a creature already at its cap gives no loss (the card says the character is immune). **Assumed.**
  - The label goes into CoC7's request sentence ("make a {label} roll"), so a cause written as a sentence reads oddly there; the link itself shows it as typed. **Assumed.**

### Look (`check.css`)
- **How it works:** The Sanity tab's rules (the SAN list, scrolling past about 140px, and the presets, two rows of four) are in `check.css` with the rest of the Check flyout ([check-flyout.md](check-flyout.md)); every class starts `rollbox-sanity-` and every rule is scoped under `.rollbox-panel`. Sections, the loss line, the picker, the status line and the main button's highlight are `shared/shared.css`.
- **Connects to:** `panel/panel.css`, `shared/shared.css`.
- **Could interact poorly with:** Foundry's light interface theme: the tab follows Rollbox's own Theme setting. **Assumed.**

## Hooks, overrides, keybindings
- Hooks: none (`CheckFlyout` builds it; `roll-requests/` watches for an NPC's Sanity card while sending).
- Class overrides: none.
- Keybindings: none. Enter in a loss line confirms it; there is no form, so Enter never sends.

## Settings
None of its own. Shown only while the Rollbox panel switch (`rollboxEnabled`, a personal feature switch in the Features box at the top of the settings page) is on, on the Keeper's panel. `rollboxPlayerSanity` stays registered (hidden from Configure Settings) but gives a player nothing.

## Tests

`tests/sanity-flyout.test.mjs`: find the test you need in [TESTS.md, sanity-flyout.test.mjs](TESTS.md#sanity-flyouttestmjs) and run only that.
