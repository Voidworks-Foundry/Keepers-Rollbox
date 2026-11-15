# Keeper's Rollbox — design

Module id `keepers-rollbox`, title "Keeper's Rollbox". Foundry VTT 14, Call of Cthulhu 7th Edition (CoC7) system.

What the module does and the rules it follows. How the code is written is in [DEVELOPING.md](DEVELOPING.md); how to work on it is in [AGENTS.md](../AGENTS.md). Code comments point here by section ("Layout and rules: DESIGN.md, 'Sanity menu'"), so keep the section names. When this document and the code disagree, ask in an issue before changing either. "(Void, date)" marks the maintainer's deliberate choice.

## Contents

- [What it does](#what-it-does): the module in one paragraph.
- [Who sees it and when](#who-sees-it-and-when): Keeper only, when tokens are selected; the personal settings.
- [Layout by number of tokens selected](#layout-by-number-of-tokens-selected): mini sheet or names card, and which buttons, for 1, 2 and 3+ tokens.
- [How every menu is laid out](#how-every-menu-is-laid-out): sections, the red status line, greyed-out Send, the result, value lines and dice picker.
- [The mini sheet's values](#the-mini-sheets-values): clicking a characteristic, SAN or Luck, and CoC7's sheet shortcuts.
- [Check menu](#check-menu): tabs, skill list, combined checks, difficulty, dice, Blind, label, Idea and Know.
- [Sanity menu](#sanity-menu): loss line and presets, cause and creature, sending.
- [Other menu](#other-menu): Item (weapons as skill checks, improvised weapon and damage) and Luck (with the Group Luck roll).
- [Opposed roll (exactly two characters)](#opposed-roll-exactly-two-characters): the opposed view, sides, ties, Swap sides, Start rolls.
- [Assist (two or more characters)](#assist-two-or-more-characters): Use and Against, characters and targets, the worked-out split, the Assist card.
- [Rule notes (checked against the Keeper Rulebook, 2026-11-13)](#rule-notes-checked-against-the-keeper-rulebook-2026-11-13): rules the menus must follow (pushing, dice, Luck, group Luck, Idea and Know).
- [Sending and who rolls](#sending-and-who-rolls): whisper, chat, NPCs rolled for the Keeper; everything after the request is CoC7's.
- [Out of scope](#out-of-scope): combat and everything else Rollbox leaves to CoC7.

## What it does

The Keeper selects one or more tokens, and a small panel appears above Foundry's players list (the card showing latency and FPS). From it the Keeper requests rolls from the selected characters: a check, a Sanity check, an item or weapon check, a Luck check, or an opposed roll. The module only creates requests. CoC7 itself rolls, compares, spends Luck and applies results, the same way as when the Keeper uses CoC7's "Create link" tool. Rollbox is a faster front end for that tool, with the character's numbers in view.

## Who sees it and when

- Keeper only. Players never see the panel.
- It shows whenever the Keeper has one or more tokens selected on the canvas, and hides when none are.
- A personal on/off setting (master switch, "Personal setting, affects only your screen.") turns the whole panel off.
- A personal "Panel transparency" slider (Void, 2026-11-13) sets how see-through the panel, its buttons and its menus are: background only, so text and icons stay fully readable. Range 0% (solid) to 70%, steps of 5%, default 25% (the panel's original look). It applies at once, without a reload.
- A personal **Theme: Dark | Light** setting (Void, 2026-11-14), default Dark: each theme has its own palette (panel, text, muted text, borders, button fill, pressed and selected, accent, the red warning, the coral target, placeholders, disabled buttons), with every text colour at least 4.5:1 on the panel (WCAG AA). Light lets half as much of the map through for the same Panel transparency. Switching the theme flips the Panel colour's lightness, keeping its hue and saturation (a dark navy becomes a light navy-tinted colour, and back); a colour that already suits the new theme stays. It applies at once and has a Reset button.
- A personal "Panel colour" picker (Void, 2026-11-14) sets the background colour of the panel, its buttons and its menus, as the tint within the theme: the Keeper can pick any colour, and the panel shows it darker (Dark) or lighter (Light) only as far as the theme's text needs to stay readable. The transparency applies on top. Default: the panel's original colour. It applies at once.
- A personal "Panel size" slider (Void, 2026-11-14), 80% to 150% in steps of 10%, default 100%, scales the whole panel from its bottom-left corner, so it stays on top of the players list (a moved panel: from the corner nearest it). It applies at once.
- Settings are in two groups: **Keeper's Rollbox** (Show the panel, Simplified dice UI) and **Appearance** (Theme, Panel colour, transparency, size, Allow moving the panel, Menus open to the). Simplified dice UI is a personal on/off toggle (default off): on, the Custom buttons and their compact dice pickers are gone, and the Keeper types into the value lines (the Sanity loss, the improvised damage; e.g. 1D6+2; for damage DB, ½DB and 1/2DB are accepted, e.g. 1D6+DB). The preset rows (Sanity presets, damage quick-picks) are hidden too, so a menu shows only its typed value line. (Void's table check, 2026-11-14)
- Theme, Panel transparency, Panel colour and Panel size each have a Reset button in Configure Settings that restores only that setting's default (applied on Save).
- Position: bottom left, directly on top of the players list, the same width as that card. Menus open to the right.
- Moving the panel (Void, 2026-11-15): a personal **Allow moving the panel** toggle, on by default and kept per screen. On, dragging the card header (the mini sheet's name row, the names card's "N selected" row, or either side's mini sheet in the Opposed view) moves the panel anywhere on the screen, and it stays where it is dropped: after a reload, and kept on screen when the window gets smaller. Nothing moves until it is dragged. **Reset position**, a button beside the toggle, puts it back above the players list at once; so does turning the toggle off. A saved spot that is off the screen or can't be read is ignored and the panel stays above the players list. No corner presets and no snapping.
- **Menus open to the** (personal): Automatic (the default, towards the middle of the screen: to the left on the right half), Right or Left. Above the players list they always open to the right. In the top half of the screen the buttons, flyout and Opposed view line up with the card's top and grow down; in the bottom half, with its bottom. Mirrored is the layout, not the content: the order inside the cards stays (attacker on the left). A menu that opens partly off the screen shifts the panel just far enough to show it, and the panel goes back when the menu closes.

## Layout by number of tokens selected

| Selected | Panel | Buttons beside it |
|---|---|---|
| 1 | Mini sheet: portrait, name, occupation and owner; HP, MP, SAN, Luck; the eight characteristics; a button that opens the full sheet. The characteristics, SAN and Luck can be clicked (see "The mini sheet's values") | Check, Sanity, Other |
| 2 | Names card: each character's name, owner (or "NPC · Keeper rolls") and value columns that follow the open menu: SAN and Luck (no menu, Check, Opposed), SAN alone (Sanity), or one STR or SIZ column (Assist: the Use value for participants, the Against value for targets). Information only, no controls. With 2 or 3 selected it is the same height as the one-character mini sheet, only 4 or more make it taller; it shows ten names before it scrolls (Void, 2026-11-14) | Check, Sanity, Other, Opposed, Assist (the buttons keep their size, so the column reaches above the card) |
| 2, Opposed open | Both mini sheets side by side with the opposed card between them; no buttons | — |
| 3 or more | Names card | Check, Sanity, Other, Assist |

There is no upper limit on how many tokens can be selected.

## The mini sheet's values

With one character selected, the mini sheet's eight characteristics, SAN and Luck are buttons (Void, 2026-11-15). They look as before, with a pointer cursor, a light highlight on hover and a focus ring; HP and MP stay plain, and the names card doesn't change. The mini sheet and names card otherwise show information only (all controls live in the open menu); these values, and dragging the header to move the panel, are the exceptions. Nothing is sent by the sheet itself: a click opens the menu, and any send goes through that menu, with its usual result lines.

The clicks follow CoC7's own sheet shortcuts (its `CoC7.ToolTipSkill`, `ToolTipKeeperSkill`, `ToolTipSanity` and `ToolTipKeeperSanity`), mapped to Rollbox's menus (Void, 2026-11-15). Rollbox never calls CoC7's sheet handlers. Ctrl is Ctrl or Cmd; Alt is Option on a Mac.

| Shortcut | Characteristic (STR … EDU) | SAN | Luck |
| --- | --- | --- | --- |
| Left click | Check, only this ticked (earlier ticks cleared; switches the tick if Check is open) | Sanity | Other, Luck section |
| Shift + Left click | Check, only this ticked, set to Regular with no dice, not Blind and no label, and sent at once as Request from player (NPCs rolled for the Keeper) | Sanity | Other, Luck section, the same plain Luck check sent at once |
| Ctrl + Left click | Check as Shift + Left, but copies the roll link instead ("Link copied.") | Sanity | Other, Luck section, copies a plain Luck link |
| Shift + Ctrl + Left click | Check, only this ticked, with Copy link focused: set options, then copy | Sanity | Other, Luck section |
| Alt + Left click | — | Sanity | — |
| Right click | Starts an opposed roll with this as the first side (see below) | — | — |
| Shift + Right click | As Right click, but the opposed card is made at once when the second side is clicked | — | — |
| Alt + Right click | Check with this added to the current ticks (not cleared), so two or more make a combined roll | — | — |
| Shift + Alt + Right click | Adds this to the current ticks and sends at once, with the menu's All/Any choice and options | — | — |
| Ctrl + Right click | — | — | — |

- Right click never opens the browser's menu on these values.
- **The opposed two-step:** a right click on one character's characteristic remembers it, and a note at the top of the panel reads "Opposed: Harvey · STR. Select the other character and right-click their value." The Keeper selects the other token and right-clicks that character's characteristic: the first token is selected again too, and Opposed opens with both sides picked (first side on the left, the attacker). With Shift on either click the card is made at once. Escape, or a left press anywhere on the panel, cancels it. A click on the canvas doesn't cancel, because the Keeper has to click there to select the second token. A right click on the same character again starts over.
- No tooltip lists the shortcuts (no tooltips, as everywhere in Rollbox); they are in the guide ([panel.md](../guide/panel.md)) and here.
- Dragging the header never starts from these buttons, and a click on them never moves the panel.

## How every menu is laid out

- Each menu is split into sections with clear space between them and no lines or headings: *what* (the check, loss or weapon), *how* (difficulty, dice, Blind, label; the cause fields in Sanity), *send* (the red line when something is missing, the buttons, and the result).
- No help paragraphs or tooltips inside menus; placeholders stay.
- The line just above the buttons appears only in red, saying what is missing ("Type what the improvised weapon is"); there is no summary of what will be sent (Void, 2026-11-14). The send buttons stay greyed out until everything required is filled in (a check ticked, a weapon picked or named, a group-Luck tie settled, a valid loss or damage, both opposed sides picked). Assist's Assisting / Rolling / chance block and the Opposed view's tie line stay: they are worked-out information, not a restatement.
- After Send, the result reads as a heading and one name per line (Void, 2026-11-14): "Sanity check sent to:" (or "… posted in chat for:") with each player's character on its own line; "Rolled for you:" with each NPC the Keeper rolled; "Not sent:" with a short reason per name. The same in every menu ("Check sent to:", "Item check sent to:", "Luck check sent to:", "Assist sent to:", "Opposed card made:").
- The main button ("Request from player", "Create opposed card") is highlighted, the others beside it. When every selected character is an NPC (no player owner, so Rollbox rolls for the Keeper) it reads "Roll for NPC" (one) or "Roll for NPCs" (several) in the Check, Sanity and Other menus (Void, 2026-11-14); Assist's "Send to rollers" stays.
- Blind (Check, Other) is a tall toggle button to the right of the Difficulty and Dice rows, spanning both, with "Blind" written sideways: click on, click off.
- Values that are dice (the Sanity loss, improvised damage) are an editable value line: large plain text, no box, border or outline (a cursor only). Enter or clicking away confirms; empty becomes 0; invalid text turns red and blocks Send. A full-width Custom button opens the compact dice picker under it: number of dice − n +, one row of dice (D3 D4 D6 D8 D10 D12 D20 D100), + flat − n +, None (and +DB for damage). It edits the line; typing in the line moves it.

## Check menu

- Two tabs: Characteristic (STR, CON, SIZ, DEX, APP, INT, POW, EDU) and Skill (Void, 2026-11-15). Sanity has its own menu, Luck and the Group Luck roll are in Other, and Idea and Know are INT and EDU checks. (Until 0.1.1 there was an Attribute tab.)
- *What:* the tabs, a search box and the list. Under the title, the character's name, muted.
- Skill list, one character: every skill. Trained skills (above base value) first, highest first; then a divider; then every untrained skill A–Z at its base value. Each row shows Regular · Hard · Extreme values ("full · half · fifth"). A search box filters the list; when it matches no listed skill, the list shows "+ Add <typed name>" (any skill or specialisation, e.g. Pilot (Boat), at its group's base value).
- Missing skills: any skill not on the character's sheet is shown at its base value (Keeper Rulebook skill list; Dodge = half DEX, Language (Own) = EDU). NPCs are rolled on the Keeper's side at that value, with nothing added to their sheet. For a player character, CoC7 adds the missing skill to the sheet at its base value before rolling; that's rare, because investigator sheets normally list every skill.
- Skill list, two or more characters: every skill A–Z, without values.
- Each row has a tick box. One tick is a normal check. Two or more ticks make a combined roll (Keeper Rulebook p. 92): one roll compared with each ticked check, with "All of them" or "Any one" to choose. A combined roll is always one character's roll; with several characters selected, each gets their own combined roll.
- *How:* difficulty Regular / Hard / Extreme / Hidden (with Hidden, the Keeper sets the difficulty on the result card after the roll) and up to two bonus or two penalty dice, with the Blind toggle beside both rows (greyed out on a combined roll: CoC7 always shows combined cards); then Label (optional text shown to the player after the check's name, e.g. "Hard Spot Hidden · notice the cultist's hidden knife"; combined, "Spot Hidden + Listen · …").
- No Pushed option: pushing happens after a failure, from the Push button on CoC7's result card.
- Idea and Know: tick INT or EDU and type "Idea" or "Know" in the Label box (Void, 2026-11-15). The request reads "INT · Idea"; CoC7's card says Intelligence or Education. Until 0.1.1 they were rows on the Attribute tab, and an NPC got CoC7's own Idea or Know roll.
- *Send:* Request from player (or "Send to each (N)"), Send to chat, and Copy link as a small link icon button; the red line above them only when something is missing.

## Sanity menu

- Shows each selected character's current SAN, muted, under the title.
- *Loss:* a large loss line "0 / 1D6" (loss on a success / on a failure), each side an editable value line; it starts at 0 / 1D6. Under it the common losses as one-click presets: 0/1, 0/1D3, 0/1D6, 1/1D4+1, 1/1D6, 1D3/1D10, 1D6/1D20, 1D10/1D100 (the one matching the line is highlighted). Then one full-width "Custom success or failure loss" button that opens the compact picker for both sides at once (gone with Simplified dice UI on).
- *Cause:* "What caused it" (optional): shown to players instead of the numbers, as "Sanity check · Seeing a ghoul"; it is only the link's label. Empty, the label is "Sanity (1/1D6)". "Creature" (optional): the creature or source by name. CoC7 uses it to cap later losses from the same kind of creature, so only fill it in for a creature, never for free text. Placeholders only.
- *Send:* Request from player (or "Send to each (N)"), Send to chat; the red line above them only when a loss isn't one.
- No Blind: CoC7's Sanity request can't be made blind.
- After sending, nothing is managed by Rollbox. CoC7 runs the Sanity roll, the loss (applied when the Keeper clicks Apply on the card), the INT roll for temporary insanity, bouts of madness, indefinite insanity and its record of creatures already seen.

## Other menu

The Other button (any selection) opens checks that aren't a characteristic, a skill or Sanity (Void, 2026-11-15; until 0.1.1 it was the Item menu, one character only).

- Two sections at the top, like the Check menu's tabs: **Item** and **Luck**. One character opens on Item; two or more open on Luck, with Item greyed out (one character only), and no help line or tooltip saying why. The menu's title follows the section: "Item check" or "Luck check".
- A click on the mini sheet's Luck opens it on Luck (see "The mini sheet's values").

### Item (one character only)

- Lists the character's weapons, each with the skill it uses and that skill's values. A weapon is sent as a normal skill check labelled with the weapon ("Firearms (Handgun) with the .38 Revolver"), not as CoC7's weapon link, because that link starts CoC7's attack card and ignores difficulty, dice and Blind.
- A weapon with two skills (e.g. a knife that can be thrown) gets one row per skill. An automatic, burst or thrown weapon with no alternative skill set uses its main skill, as CoC7 does.
- *What:* the weapon list, last row "+ Improvised weapon": what it is (e.g. Candlestick), which skill (Brawl, the default Fighting (Brawl); Throw; Other…, any other) and the skill's values. It is sent as an ordinary skill check labelled with the object, plus a damage roll button in chat when damage was given. Nothing is added to the character's sheet.
- *Damage (optional),* improvised only: an editable damage line (0, no damage, by default), the quick-picks under it (None, 1D3+DB, 1D4+DB, 1D6+DB, 1D8+DB, 1D10+DB; the line can still be changed after), and a full-width "Custom damage" button that opens the compact picker with +DB (e.g. 1D6+DB, taken from the closest weapon in the rulebook's table). With Throw, the toggle and quick-picks read "+½DB" and add half the damage bonus (thrown weapons add half DB).
- *How:* difficulty and bonus or penalty dice, with the Blind toggle beside them.
- *Send:* Request from player, Send to chat; the red line above them only when something is missing.
- Use: the Keeper asking for a weapon roll when there is no token to target, such as shooting a lock. Attacks on tokens stay in CoC7's combat flow (see Out of scope).

### Luck

- *What:* each selected character's Luck, muted, one per row. With two or more, the **Group Luck roll: only the lowest Luck rolls** toggle (Rule notes): on, the line names who rolls ("Harvey rolls (Luck 45).") and the main button names only them; on a tie, "Tied at Luck 45. Who rolls?" with a button for each tied character, and the send buttons stay greyed out ("Pick who rolls for the group.") until one is picked.
- *How:* difficulty and bonus or penalty dice, with the Blind toggle beside them; then Label (optional), e.g. "is the cab still there?".
- *Send:* Request from player (or "Send to each (N)", or "Roll for NPC(s)"), Send to chat, and Copy link as a small link icon button. Sent as CoC7's Luck check, like any other check.

## Opposed roll (exactly two characters)

- Opened from the Opposed button. Opposed rolls always have exactly two sides.
- Each side picks from the Check menu's two tabs, Characteristic and Skill (Void, 2026-11-15), with the same skill list order and missing skills at base value. The two sides can use different kinds (one a skill, the other a characteristic).
- Each side gets up to two bonus or two penalty dice. No difficulty, because the other side's result is the difficulty (Keeper Rulebook p. 92). Opposed rolls can't be pushed (p. 90).
- Higher success level wins; a tie goes to the higher skill or characteristic; if that's tied too, it's a stalemate or both re-roll (p. 91). CoC7's opposed card does the comparing, but on a tie it only shows "Tie": the Keeper settles it from the values on the card. CoC7 labels the two sides attacker and defender even outside combat; it needs both roles to compare at all, but outside combat they don't change who wins.
- Each side's header: its role tag (Attacker / Defender), its name and the picked check ("STR 40"). The lists keep their full height. Between the two sides, a larger "⇅ Swap sides" button. Footer: the tie line once both sides have a check, then Cancel (back to the names card) and Create opposed card (disabled until both sides have a check). No "Keeper rolls" lines, "VS", rules paragraph or Swap explanation CoC7's card marks its first side (the left-hand character) attacker and the second defender, shown as the tags; melee never uses this card. A card with no roles isn't possible in CoC7 8.15: it gives every two-sided card an attacker and a defender, and compares only then.
- CoC7's card waits until the Keeper's Start rolls button is clicked. Rollbox clicks it on the Keeper's screen straight after creating the card, which rolls the NPC side; if it can't, the Keeper clicks it. Then each player rolls their own side.

## Assist (two or more characters)

Physical Human Limits, Keeper Rulebook p. 88–89 (summary p. 407). Several characters combine STR or SIZ against something too big for any one of them.

- Opened from the **Assist** button, shown when two or more tokens are selected. Every control is inside the menu; the names card beside it only shows each character's value (Layout).
- The menu, top to bottom (Void, 2026-11-14):
  1. **The number to beat**, a large value line with its caption. With targets marked it is their values added together, captioned "STR against Zombie A + Zombie B"; with none, the Keeper types it, captioned "STR against SIZ". Typing a number unmarks any targets.
  2. **Use: STR | SIZ**, what the characters put in (default STR), and **Against: STR | SIZ**, which value of the target(s) counts (default STR; with a typed number it only names what was typed).
  3. **The characters:** every selected character as a toggle button (name, and the value that counts: Use value, or Against value for a target), all included to start, with a narrow target button (a crosshair, just wide enough for its icon; the name takes the rest of the row) on the right. The list shows ten names before it scrolls. Clicking a name leaves that character out (dashed, struck through, not counted at all); clicking again brings them back; a left-out character's target button does nothing. Only the target button marks or unmarks a character as a target (Void, 2026-11-14): a target left out stops counting and is a target again when brought back, and a creature deselected and selected again starts marked again. A target: its row is tinted coral, it takes no part, and **targets' values are added together** (two zombies of STR 80 pushing a door: 160; the Keeper's ruling, the rule only describes investigators combining). CoC7 creatures (actor type `creature`) start marked when selected; the Keeper can unmark them.
  4. **The result:** "Assisting", one line per helper (name and "−20"; "No one" when nobody helps); "Rolling", one line per roller (name and "STR 60"); one line "Regular STR" on the left, "90% one succeeds" on the right. Or, instead, a red line only when something's missing or impossible: "Select at least one more token." (one selected), "Include at least one more character." (nobody left to take part after leaving people out and marking targets), "Type the STR to beat." (the typed text isn't a number), "Target someone, or type the STR to beat." (nothing to beat), "Too heavy even together.". Send stays greyed out meanwhile.
  5. **Label** (optional).
  6. **Send to rollers** and Cancel.
- **Who helps and who rolls is worked out, not picked** (Void, 2026-11-14). Everyone included and not a target takes part (one is enough when there is a target or a typed number). Helpers are taken lowest value first; after each, what's left must stay above 0 and every remaining character must be able to try it (what's left is no more than 100 + their value). Difficulty from what's left: under 50 Regular, 50+ Hard, 90+ Extreme. Of the splits that work, Rollbox uses the one with the best chance that at least one roller succeeds (each roller's chance is their value, half or fifth for the difficulty; ties go to fewer helpers). For the rulebook rafter that's its own answer: Harvey, Cecil and Martin help, Helen and Belinda roll at Regular. No split works: "Too heavy even together". Nobody helping counts as a split: when everyone can try it alone and that gives the best chance, everyone rolls.
- Selecting or deselecting tokens while it's open updates it at once, keeping the toggles, the number, who is left out or marked and the label; a newly selected creature starts marked. With only one selected it stays open with the red line "Select at least one more token." and Send greyed out.
- **Send:** ordinary check requests for the Use characteristic at that difficulty are whispered to the rollers' players ("Hard STR · lift the rafter"; with no label typed, "STR · Assist"); NPC rollers roll privately as usual. No Blind, and no bonus or penalty dice.
- **Assist card:** when it sends, Rollbox posts one public card: "Assist", the label, Use against Against, what's left and its difficulty, who helps, who rolls, and "One success is enough." It names neither the targets nor the number to beat. It does not read the rolls back; the Keeper reads the rollers' cards, as with a group check (Void, 2026-11-14). Select only those putting their body into it, and the targets; someone who can't help (e.g. pinned) is left out in the menu.

## Rule notes (checked against the Keeper Rulebook, 2026-11-13)

Settled by the rules, so the menus must follow them:
- Luck rolls and Sanity rolls can't be pushed (p. 84; glossary p. 388: "Combat, Chase, Sanity, and Luck rolls cannot be pushed"). Rollbox has no Pushed option at all (see Check menu).
- CoC7 still offers Push on a failed Luck roll, which p. 84 forbids. Rollbox can't change CoC7's card; the Keeper refuses that push at the table.
- Opposed rolls can't be pushed (p. 90), and take bonus or penalty dice instead of difficulty (p. 92).
- Bonus and penalty dice are "primarily for use with opposed rolls" (p. 91); on a normal check the Keeper sets difficulty, and adding dice as well "should be the exception rather than the rule" (p. 92). The Check menu keeps both, with difficulty first.
- Spending Luck (optional rule, p. 99) is CoC7's job: not on Luck, Sanity or damage rolls, not after a push, and never to buy off a critical or fumble.
- Using two perception skills (p. 203: "allow the player to make one dice roll using the higher of the investigator's two skills") is a combined roll with "Any one".

Added with Void's approval (2026-11-13):
- Group Luck roll (p. 89-90): "If the Keeper calls for a Group Luck roll, the player whose investigator has the lowest Luck score (among those present in the scene) should make the roll." With two or more tokens selected, the Other menu's Luck section offers "Group Luck roll: only the lowest Luck rolls", which sends the request to that one character (ties: the Keeper picks). The names card shows each character's Luck.
- Idea and Know rolls (p. 90): an Idea roll and a Know roll are INT and EDU rolls with their own names. The Keeper ticks INT or EDU and labels it "Idea" or "Know" (Void, 2026-11-15); the numbers are the same.

## Sending and who rolls

- Request from player: whispers the request to the owner of each character, the way CoC7's "Whisper to selected tokens" does.
- Send to chat: posts the request publicly.
- NPCs (no player owner): the module rolls their side for the Keeper automatically and privately; the Keeper doesn't click anything.
- When the Keeper clicks the link in one of Rollbox's own requests, CoC7 handles it as any link: it rolls once per selected token (Void, 2026-11-14: Rollbox never changes CoC7's click handling).
- Everything after the request is CoC7's: rolling, success levels, spending Luck on a failed roll, pushing, the Sanity flow, the opposed result.

## Out of scope

- Combat. Attacks start when the attacker selects a target and clicks a weapon on their sheet; the target picks Dodge, Fight back, Maneuver or Do nothing; CoC7 resolves it with the right tie rule and offers damage. Rollbox never starts, changes or resolves combat.
- Luck spending, damage, wounds, CON rolls for major wounds and dying, chases, spellcasting, skill development: all handled by CoC7's sheets and cards.
- Players' screens: nothing changes for players.
