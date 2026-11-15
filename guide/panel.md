# The panel and settings

[← Back to the guide](README.md)

*[Animation: selecting one token, then several, and the panel changing — coming soon]*

## The panel

Select one or more tokens and the Rollbox panel appears in the bottom-left corner, directly on top of Foundry's players list and the same width. Deselect everything and it goes away. It also hides when you change scene.

**One token selected:** a mini sheet with the character's portrait, name, occupation and player, their HP, MP, SAN and Luck, and the eight characteristics. A small button opens the full character sheet. Beside it: **Check**, **Sanity** and **Other**.

**Two or more tokens selected:** a list of names, each with its player (or "NPC · Keeper rolls") and the values that matter for the menu you have open: SAN and Luck normally, SAN in the Sanity menu, STR or SIZ in the Assist menu. The list shows ten names before it scrolls. Beside it: **Check**, **Sanity**, **Other**, **Assist**, and **Opposed** when exactly two are selected.

Click a button to open its menu to the right; the button stays highlighted. Click it again to close the menu. Menus stay open while you change the selection, and update to match.

The numbers on the panel follow the character: when HP or SAN changes, the panel shows it at once.

## Clicking the mini sheet

With one token selected, the mini sheet's eight characteristics, SAN and Luck are buttons. Hovering shows a pointer and a light highlight. A plain click opens the matching menu, and you send from there:

- **A characteristic** (STR … EDU) opens **Check** with only that one ticked. If Check is already open, the tick moves to the one you clicked.
- **SAN** opens **Sanity**.
- **Luck** opens **Other** on its Luck section.

HP and MP aren't clickable, and the list of names (two or more tokens) doesn't change.

### Shortcuts

The values take the same mouse shortcuts as the Call of Cthulhu system's own character sheet, sent through Rollbox's menus. Ctrl means Ctrl, or Cmd on a Mac; Alt means Option on a Mac. Rollbox shows no tooltip for these, so this table is the place to look them up.

| Shortcut | A characteristic (STR … EDU) | SAN | Luck |
| --- | --- | --- | --- |
| Click | Check, only this ticked | Sanity | Other, Luck |
| Shift + click | Sends a Regular check at once (no dice, not Blind, no label) | Sanity | Sends a Regular Luck check at once |
| Ctrl + click | Copies a Regular roll link | Sanity | Copies a Regular Luck link |
| Shift + Ctrl + click | Check, only this ticked, with **Copy link** ready for you to set options and press | Sanity | Other, Luck |
| Alt + click | Nothing | Sanity | Nothing |
| Right click | Starts an opposed roll (below) | Nothing | Nothing |
| Shift + right click | Starts an opposed roll that is made at once | Nothing | Nothing |
| Alt + right click | Adds this to the ticks already in Check, for a [combined check](combined.md) | Nothing | Nothing |
| Shift + Alt + right click | Adds this to the ticks and sends the combined check at once, with the menu's All/Any choice | Nothing | Nothing |
| Ctrl + right click | Nothing | Nothing | Nothing |

"Sends at once" works like the menu's main button: the player gets the request in their chat, and a non-player character is rolled for you. The menu opens to show the result.

**Opposed roll from the sheet:** right-click a characteristic on the first character's mini sheet. A note at the top of the panel says who and what is remembered. Select the other character's token and right-click their characteristic: both tokens are selected and **Opposed** opens with both sides filled in, the first one you clicked as the first side. With **Shift** on the right clicks, the opposed card is made straight away. Press **Escape**, or left-click the panel, to cancel.

## Moving the panel

Drag the panel by its header (the row with the character's name, or "N selected" with several tokens) and put it anywhere on the screen. Pressing on a value and dragging doesn't move it. It stays where you drop it, also after a reload, and stays on screen if the window gets smaller. With the Opposed roll open, drag either character's sheet the same way. A click on the header without moving does nothing, and the button that opens the full sheet stays a button.

On the right half of the screen the buttons and menus open to the left of the panel, so they stay on screen; in the top half they open downwards. If a menu would still run off the edge, the panel slides over until it fits, and slides back when you close the menu.

To put the panel back above the players list, use **Reset position** in the settings (below).

## Who rolls

Every menu ends with the same choices:

- **Request from player** (or **Send to each** with several characters) whispers the request to the player who owns each character. They click it in their chat and roll as usual.
- **Send to chat** posts the request for everyone to see.
- **Non-player characters roll for you.** A character with no player owner is rolled privately for the Keeper straight away, with nothing to click. When only non-player characters are selected, the main button says **Roll for NPC** or **Roll for NPCs**.

The send buttons stay greyed out until everything they need is filled in, and a red line above them says what's missing. After sending, the menu lists who was asked, who was rolled for you, and anything that wasn't sent, with the reason.

## Keeper only

Only the Keeper ever sees Rollbox: no panel, buttons or settings appear for players. What reaches them is the system's ordinary roll request in their chat, exactly as if you had made the link with the system's own "Create link" tool. Everything after that is the Call of Cthulhu system's: the roll, success levels, spending Luck, pushing, Sanity loss and opposed results.

## Settings

Find them under **Game Settings → Configure Settings → Keeper's Rollbox**. Every setting is personal: it changes only your own screen and applies the moment you change it. Where you moved the panel, and whether moving is allowed, are kept for each computer separately.

**Keeper's Rollbox**

- **Show the Rollbox panel:** turn Rollbox off on your screen without disabling the module.
- **Simplified dice UI:** for Keepers who'd rather type dice. The Sanity menu and the improvised weapon's damage show only a line to type into (such as `1D10+2`, or `1D6+DB` for damage); the presets, quick-picks and dice pickers are hidden.

*[Animation: Simplified dice UI off and on — coming soon]*

**Appearance**

- **Theme:** Dark (the default) or Light. Each theme keeps every piece of text easy to read. Switching flips your panel colour to the matching shade: a dark navy becomes a pale navy, and back.
- **Panel colour:** any colour you like for the panel, its buttons and its menus. If a colour would make the text hard to read in your theme, the panel shows a readable shade of it.
- **Panel transparency:** how much of the map shows through, from solid to 70%.
- **Panel size:** from 80% to 150%. The panel grows upward from the players list and never covers it.
- **Allow moving the panel:** on by default; drag the header to move the panel. Untick it to keep the panel fixed above the players list. **Reset position**, the button beside it, puts the panel back above the players list straight away.
- **Menus open to the:** Automatic (towards the middle of the screen), Right or Left. Above the players list, menus always open to the right.

Theme, colour, transparency and size each have a **Reset** button that restores just that setting.

*[Animation: changing the theme, colour and size — coming soon]*
