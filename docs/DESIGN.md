<!-- Written by tools/public-docs.mjs from the maintainer's source document: change that, not this file. -->
# Keeper's Rollbox — design

Module id `keepers-rollbox`, title "Keeper's Rollbox". Foundry VTT 14, Call of Cthulhu 7th Edition (CoC7) system.

What the module does and the rules it follows. How the code is written is in [DEVELOPING.md](DEVELOPING.md); how to work on it is in [AGENTS.md](../AGENTS.md). The maintainer keeps this design as one file per feature (`design/<feature>.md`); each is one section below, in the same order, and code comments cite them by that name. When this document and the code disagree, ask in an issue before changing either.

**Contents**

- [What Rollbox is](#what-rollbox-is)
- [What Rollbox is not](#what-rollbox-is-not)
- [The lane rule](#the-lane-rule)
- [The two sides](#the-two-sides)
- [Names](#names)
- [Features](#features)
- [Sending and who rolls](#sending-and-who-rolls)
- [Out of scope](#out-of-scope)
- [Decisions](#decisions)
- [Panel](#panel)
- [Flyouts](#flyouts)
- [Check flyout](#check-flyout)
- [Other flyout](#other-flyout)
- [Opposed roll](#opposed-roll)
- [Assist](#assist)
- [Action flyout](#action-flyout)
- [Alert flyout: being attacked](#alert-flyout-being-attacked)
- [Status effects](#status-effects)
- [How a fight starts](#how-a-fight-starts)
- [Combat](#combat)
- [Player Rollbox](#player-rollbox)
- [Setup check](#setup-check)
- [Themes](#themes)
- [Settings page](#settings-page)
- [Game rules](#game-rules)

Keeper's Rollbox (module id `keepers-rollbox`) is a Foundry VTT module for the Call of Cthulhu 7th Edition system (CoC7). It puts a small panel beside Foundry's players list from which the Keeper asks for rolls, rolls for NPCs, sets up two-sided rolls and runs combat, with each character's numbers in view. Players can have a panel of their own investigator.

## What Rollbox is

Rollbox is a faster front end for CoC7. A click on the panel does what a Keeper or a player could do by hand with CoC7's own tools: write a roll link with CoC7's **Create link** tool, whisper it to a character's owner, open an opposed card, press a button on one of CoC7's chat cards.

- With nothing selected, the Keeper's panel lists each player's investigator, and a check or a Luck roll goes to all of them.
- With tokens selected, the panel shows those characters, and its requests go to them: a check, a Sanity check, an item or weapon check, a Luck check, an opposed roll, an assisted effort, an attack, a maneuver or a spell.
- In combat, the panel shows the turn order and the controls for the current turn.

## What Rollbox is not

Rollbox never rolls dice, compares results or applies them. CoC7 rolls, sets success levels, spends Luck, pushes, runs the Sanity flow, settles opposed rolls, offers damage and applies it. Foundry's combat tracker moves the turns. Rollbox only creates requests and presses CoC7's own controls.

## The lane rule

Rollbox stays in its lane:
- It builds requests with CoC7's own roll links and chat cards, and lets CoC7 roll, compare and apply results.
- It never intercepts, overrides or changes how CoC7 or Foundry behave (clicks, rolls, cards, dialogs), and never adds rules inside CoC7's cards.
- It may set a toggle or option that CoC7 already offers in its own interface (Draw gun in the combat tracker, Aiming or Under cover on CoC7's attack card, the Attacker and Defender buttons on an opposed card), the way a player could click it. Each such use is listed in the feature it belongs to.
- It changes Foundry's behaviour only with hooks, or by extending a `CONFIG` class and calling `super`; it never replaces a core or CoC7 method.
- Every internal Foundry or CoC7 interface it uses is guarded, so an update makes the feature do nothing instead of breaking.

## The two sides

### The Keeper

Rollbox is the Keeper's control desk for the table's rolls:
- ask for rolls from one investigator, several, all, or anyone;
- roll for NPCs, privately and without clicking;
- set up two-sided rolls: opposed rolls, assisted efforts, attacks and maneuvers;
- run combat: the turn order, the turn controls, readied guns, who notices a drawn weapon;
- see each character's state at a glance, without opening a sheet or typing a link.

### Players

Each player can have a panel of their own investigator while the Keeper keeps the **Player Rollbox** on. A player's panel is a shortcut to their own character:
- make their own checks at once, with no request and no link;
- take their one action a round on their turn (attack, maneuver, cast, reload);
- start rolls involving others (opposed, assist), through the Keeper's client where CoC7 needs a Keeper;
- answer an attack (dodge, fight back, dive for cover);
- see their own state and the turn order.

A player sees only their own investigator, only the features the Keeper allows, and never the Keeper's choices (who notices a weapon, Start combat). With the Player Rollbox off, nothing changes on a player's screen. See [player.md](#player-rollbox).

## Names

These names are used in every document, in code comments and, where they fit, in the code.

| Name | What it is | In the code |
| --- | --- | --- |
| **Panel** | Everything Rollbox shows on screen. | `scripts/panel/`, `.rollbox-panel` |
| **Character panel** | The left part of the panel; it never changes width. Holds the character sheet or the character cards. | `.rollbox-character-panel` |
| **Character sheet** | A view with a character's characteristics, HP and other stats: one character, or two together (top and bottom). | `characterSheet`, `.rollbox-sheet` |
| **Character card** | A plain card for one character (portrait, name, owner, a value or two). Three or more selected: one each; also the compact card auto-hide drops the sheet to. | `characterCards`, `.rollbox-character-card` |
| **Menu** | The panel's buttons: Action, Check, Other, and the extra Opposed button on top with any selection but exactly one. | `MenuHost`, `.rollbox-menu`, `.rollbox-menu-button` |
| **Flyout** | What opens beside the menu when a button is pressed. | `registerFlyout`, `.rollbox-flyout`, `scripts/flyouts/<name>/` |
| **Flyout tabs** | The choices at the top of a flyout (Characteristic · Skill · Sanity; Item · Luck · Opposed · Assist; Attack · Maneuver · Spell). | `.rollbox-check-tab`, `.rollbox-other-tab` |
| **Chat card** | A message in Foundry's chat: CoC7's roll and opposed cards, Rollbox's Assist card. | |

## Features

Each feature has its own file, written in the same order: Summary, How it works, Settings, Rules, Limits and known gaps, Decisions.

- **[Panel](#panel)**: the small window beside the players list. The character panel shows the selected characters (the players' investigators with nothing selected, a character sheet for one or two, character cards for three or more); the menu beside it opens the flyouts. Its look, size, place and layer are personal settings.
- **[Flyouts](#flyouts)**: what every flyout shares: one layout (what, how, send), difficulty and dice, the value lines and dice picker, the one send button and its result, and who rolls.
- **[Check flyout](#check-flyout)**: characteristic and skill checks, single or combined, and the Keeper's Sanity checks. A skill missing from a sheet is offered at its base value.
- **[Other flyout](#other-flyout)**: Item (a weapon or improvised weapon roll), Luck (with the Group Luck roll), and the Opposed and Assist tabs.
- **[Opposed roll](#opposed-roll)**: two sides, one against one or several against one, made as CoC7's own opposed card.
- **[Assist](#assist)**: several characters putting a characteristic together against something too big for one (Physical Human Limits), with one public Assist card.
- **[Action flyout](#action-flyout)**: Attack, Maneuver and Spell, each through CoC7's own attack card, opposed card or casting, with one action a round in combat.
- **[Alert flyout](#alert-flyout-being-attacked)**: the defender's choices when a character is attacked (dodge, fight back, counter, dive for cover), answered in one click.
- **[Status effects](#status-effects)**: the status cards above the character sheet and each status's effect on an attack.
- **[How a fight starts](#how-a-fight-starts)**: a weapon drawn and who notices, About to attack and surprise, the first blow, and who joins the fight.
- **[Combat](#combat)**: the turn order and turn controls, Delay, Flee, standing by, readied firearms, round notes, defeated and dying.
- **[Player Rollbox](#player-rollbox)**: each player's own panel, what the Keeper lets players do, and requests made through the Keeper's client.
- **[Setup check](#setup-check)**: the Keeper's check of the world's sheets for what Rollbox can't work out alone.
- **[Themes](#themes)**: Foundry, Art Deco and CoC7 minimal.
- **[Settings page](#settings-page)**: every setting, as the settings page shows them.
- **[Game rules](#game-rules)**: the game rules used across features, with Keeper Rulebook pages.

## Sending and who rolls

- The one send button ("Send to all players", "Send to <name>", "Send to each (N)") whispers the request to the owners of each character, the way CoC7's **Whisper to selected tokens** does. There is no public request and no copied link.
- NPCs (no player owner): when the Keeper sends, Rollbox has CoC7 roll their side for the Keeper, privately, without a click ("Roll for <name>", "Roll for NPCs").
- A player's own check is made on their own client at once, as a Shift + click on their sheet would, never as a request to themselves.
- Everything after the request is CoC7's. Details: [flyouts.md](#flyouts).

## Out of scope

- Resolving combat. Rollbox starts attacks, maneuvers and spells only through CoC7's own attack card, opposed card and Cast, and moves turns only through Foundry's combat. CoC7 rolls, settles ties and offers damage.
- Luck spending, damage, wounds, CON rolls for major wounds, chases and skill development: CoC7's sheets and cards handle them. Rollbox brings up the dying CON roll at each round's end, and CoC7 rolls it; First Aid and stabilising stay CoC7's.
- Players' screens while the Keeper keeps the Player Rollbox off.

## Decisions

- **A module of its own.** Rollbox is separate from the `void-coc7-modules` module but follows its structure and naming (`rollbox` setting keys, `rollbox-` CSS classes), so the two can be merged later.
- **CoC7 does the rolling.** Requests are CoC7's own roll links and chat cards; Rollbox has no dice or success-level code, so results always match what CoC7 would do by hand.
- **Stay in the lane.** Rollbox never intercepts or changes CoC7's or Foundry's clicks, rolls, cards or dialogs. It may set a toggle CoC7 already offers in its own interface, as a player could; anything awkward in CoC7 is written up, not worked around.
- **No Pushed option.** Pushing happens from CoC7's card after a failed roll, as CoC7 offers it.
- **CoC7's roll dialog stays as it is.** A player who clicks a request can change its options in CoC7's dialog; that is CoC7's normal behaviour and Rollbox accepts it.
- **NPCs roll for the Keeper.** An NPC's side of anything the Keeper sends is rolled privately at once, without a click. An NPC check a player starts is rolled privately on the active Keeper's client, never sent as a link to the Keepers.
- **One Keeper acts.** The relay for players' requests, the gameplay rules and the alert's Keeper side run on Foundry's active GM only, so a world with several Keepers never acts twice.
- **All controls live in the open flyout.** The character sheet and cards show information and open flyouts as shortcuts; every choice is made inside the flyout.
- **One distance.** Every distance Rollbox measures is edge to edge, in the scene's units, from where a token stands after a move (Keeper Rulebook p. 127; see [action-flyout](#action-flyout)).
- **Permanent names.** The module id `keepers-rollbox`, every setting key, flag, relay message type, hook (`keepers-rollbox.diveDecision`) and the socket channel `module.keepers-rollbox` are permanent once released: renaming one resets everyone's saved values.
- **No one-sided borders.** No state (selected, highlighted, warning, new) is shown by a coloured or thicker stripe on one side of an element; a full border, a fill, the text colour or brightening is used instead. A unit test checks the stylesheets.
- **Mouse first.** No Rollbox control is a Tab stop and no key but Escape is handled, except the clickable turn-order rows ([panel](#panel)).
- **English only.** Labels and notices are written in the code, not read from a language file; translation is a future idea.
- **One source for the public design.** The module's published `docs/DESIGN.md` is generated from these files, so the two never drift.

## Panel

### Summary

The panel is Rollbox's small window beside Foundry's players list: the character panel on the left shows the selected characters, and the menu beside it opens the flyouts. The Keeper has one unless they turn it off; each player has one while the Keeper turns on the Player Rollbox, showing only their own investigator. Its look, size, place and layer are personal settings that apply at once.

### How it works

#### Who sees it and when

- **The Keeper's panel** shows whenever tokens are selected on the canvas.
- With nothing selected it lists the players' investigators (the players list), while **Show the players when nothing is selected** (`rollboxShowPlayers`) is on. Off, the panel hides with nothing selected.
- During combat with nothing selected, the character panel shows the turn order instead (see [combat](#combat)).
- With no investigator assigned to any player and nothing selected, the Keeper's panel hides.
- **A player's panel** (Player Rollbox on, see [player](#player-rollbox)) shows only their own investigator, with the menu buttons the Keeper allows.
- **Rollbox panel** (`rollboxEnabled`), the first feature switch at the top of the settings page, turns the panel and its flyouts off on that screen. It takes effect after a reload. The being-attacked alert (in Rollbox's own box above the players list), the setup check and the players' assist relay keep running with it off.

A player who has no investigator of their own sees one message in the panel's place, exactly:

> You aren't assigned an investigator. Right-click your name in the Players list (bottom left) and select User Configuration, or ask your Keeper for help.

Rollbox changes nothing itself. A × closes the message until the next load, and the panel appears as soon as an investigator is assigned. While the message shows, the menu beside it offers the player's allowed buttons as usual. The player must both **own** the actor and have it **assigned** as their character in Foundry's User Configuration.

#### Layout by number of tokens selected

The panel is the character panel on the left and the menu beside it; a flyout opens beside the menu.

- The character panel is always 200px wide at 100% Panel size, in every state. Highlights are drawn inside a card, never as an outer border that shifts things.
- **Check** and **Other** are in the menu for every selection and never move.
- **Action** sits above them with one or two selected. It is hidden, not greyed, with nothing selected or three or more: one action is one character's, or one character's acting on another.
- The menu buttons have one fixed height set in the stylesheet: three buttons and their gaps equal the one-character sheet (182px at 100%), so Action, Check and Other fill the character panel's bottom. They never stretch with a taller card.
- The extra button, **Opposed**, goes on top of them and reaches above the card. It shows with any selection except exactly one character (a right click on a characteristic starts an opposed roll then).
- Sanity is a tab of Check and Assist a tab of Other, so neither has a button.
- There is no upper limit on how many tokens can be selected.

| Selected | Character panel | Menu, top to bottom |
|---|---|---|
| 0 (Keeper) | The players list | Opposed, Check, Other. Check and Other go to every investigator ("Send to all players"); Opposed picks both sides |
| 1 | The character sheet | Action, Check, Other |
| 2 | The two-character sheet | Opposed, Action, Check, Other. Action: the first selected acts and the second is the target, with Swap ([action flyout](#action-flyout)) |
| 3 or more | The character cards | Opposed (several against one, the opponent picked), Check, Other |

With two selected and Opposed open, the two-character sheet stays and the Opposed flyout opens beside the menu, which stays too.

#### The players list (nothing selected)

- Headed "Investigators", one row per player's assigned investigator: portrait, name, "occupation · player", and "offline" while that player isn't logged in.
- Each row shows the meters ticked in **Meters on the small cards** as vertical bars (HP, MP, SAN and Luck by default), each heading centred over its bar.
- A click on a row selects that investigator's token. A row whose investigator has no token on the viewed scene is greyed and does nothing.
- There is no list of NPCs: in combat the turn order shows them.

#### The character sheet (one selected)

- Portrait, name, occupation and owner; HP, MP, SAN and Luck; the eight characteristics; a button that opens the full CoC7 sheet.
- The characteristics, SAN and Luck are buttons (see [The character sheet's values](#the-character-sheets-values)).
- On the Keeper's panel, hovering the header turns the portrait into a round ×; clicking it deselects the character, and the panel shows the nothing-selected view. Same look in every theme.
- Status cards stack above the sheet when the character has a status (see [status](#status-effects)).

#### The two-character sheet (two selected)

- Top: the first character's header (portrait, name, occupation · owner, open-sheet button), then HP/MP and SAN/Luck.
- Middle: one set of characteristics; each tile shows the top character's value over the bottom character's, with a thin line between.
- Bottom: the second character's HP/MP and SAN/Luck (in the same order as the top's), then their header.
- The top character's name and values are in the normal text colour, the bottom character's in tan.
- A player character goes on top and an NPC at the bottom; two of a kind are ordered A–Z by name.
- Hovering a header turns its portrait into a × in a circle the portrait's size; clicking it deselects that character.
- Every value of a character lights up on hover, HP and MP included (they open nothing). A click on a top number is the top character's value, on a bottom number the bottom character's, with the same shortcuts as the one-character sheet.

#### The character cards (three or more selected)

- One card each: portrait, name, "occupation · owner" (or "NPC" for a character with no player owner), and value columns.
- The value columns follow the open flyout: by default the meters ticked in **Meters on the small cards** as vertical bars; on Other's Assist tab one STR or SIZ column instead (see [assist](#assist)).
- Names run up to the first value column, which fits three digits, and are cut with "…" only there.
- Hovering a card turns its portrait into a × in a circle (every theme). Clicking it deselects that token only; the cards and an open flyout update.
- A click anywhere else on a card selects only that character, releasing the rest.
- With three selected the cards are as tall as the one-character sheet; more make them taller. They are sized by rows, so ten names show before the list scrolls, at any Panel size and font.

#### Meters

HP, MP, SAN and Luck are drawn as vertical bars wherever the panel shows rows: the players list, the character cards, the compact card and the Keeper's turn-order rows.

- A bar is a bordered column that drains from the top, the number inside it.
- HP and MP drain against their maximum, SAN against starting SAN (POW), Luck out of 99.
- Bars are 17.6px wide in every theme. On the one-character sheet (Foundry theme) the HP, MP, SAN and Luck lines are 2.6px thick.
- The turn order's rows use thinner bars, about 12px with a smaller number (14px in Art Deco; see [themes](#themes) and [combat](#combat)).
- **Meters on the small cards** (`rollboxCardMeters`) picks which of the four show on those rows. The full character sheet always shows all four.

#### A right click targets

A right click on a character anywhere in Rollbox that shows one makes that character's token the user's only Foundry target, as a click with Foundry's Target tool does. It works for the Keeper and players, and the browser's own menu stays away.

- It works on the character sheet (each header and the HP/MP · SAN/Luck lines), the character cards, the players list, the turn order's rows and full card, the Who's joining window and the joining card, Opposed's sides and Assist's rows.
- A value's own right click (an opposed roll from a characteristic) keeps its own meaning.
- It is not on lines that only list names (a flyout's "for" line, a player's Assist lists) or the setup check's window.

#### The character sheet's values

On the character sheet, the eight characteristics, SAN and Luck are buttons (on the two-character sheet, each character's own numbers). They look like plain values with a pointer cursor, a light highlight on hover and a focus ring. HP and MP stay plain, and the character cards have no such buttons.

Nothing is sent by the sheet itself: a click opens a flyout, and any send goes through that flyout, with its usual result lines. The clicks follow CoC7's own sheet shortcuts (its `CoC7.ToolTipSkill`, `ToolTipKeeperSkill`, `ToolTipSanity` and `ToolTipKeeperSanity`), mapped to Rollbox's flyouts. Rollbox never calls CoC7's sheet handlers. Ctrl is Ctrl or Cmd; Alt is Option on a Mac.

| Shortcut | Characteristic (STR … EDU) | SAN | Luck |
| --- | --- | --- | --- |
| Left click | Check, only this ticked (earlier ticks cleared; switches the tick if Check is open) | Check, Sanity tab | Other, Luck tab |
| Shift + Left click | Check, only this ticked, Regular with no dice, not Blind, no label, sent at once (NPCs rolled for the Keeper; a player's own check made at once). While an opposed roll waits for a side, it fills that side instead and the card is made at once | A plain SAN roll sent at once: CoC7's own SAN check, as its sheet's Shift click (no Sanity card, no loss) | Other, Luck tab, a plain Luck check sent at once |
| Ctrl + Left click | As Left click (CoC7's copy-a-link shortcut; Rollbox copies no links) | Check, Sanity tab | Other, Luck tab |
| Shift + Ctrl + Left click | As Left click | Check, Sanity tab | Other, Luck tab |
| Alt + Left click | Nothing | Check, Sanity tab | Nothing |
| Right click | Opposed opens with this character as the first side | Check, Sanity tab | Other, Luck tab |
| Shift + Right click | As Right click; the opposed card is made as soon as both sides have a check | Check, Sanity tab | Other, Luck tab |
| Alt + Right click | Check with this joined to the current ticks (not cleared), so two or more make a combined roll | Check, Sanity tab | Other, Luck tab |
| Shift + Alt + Right click | Joins the current ticks and sends at once, with the flyout's All/Any choice and options | Check, Sanity tab | Other, Luck tab |
| Ctrl + Right click | Nothing | Check, Sanity tab | Nothing |

- Alt is read before Ctrl on a right click, as on CoC7's sheet: Ctrl + Alt + Right click works as Alt + Right click, on the sheet and on the Check flyout's rows.
- A right click never opens the browser's menu on these values.
- SAN and Luck are never sides of an opposed roll or part of a combined one: their opposed and combined shortcuts open their own place (Check's Sanity tab; Other on Luck).
- How the opposed roll fills its waiting side, for the Keeper and for a player, is in [opposed flyout](#opposed-roll).
- No tooltip lists the shortcuts; they are in the user guide's Shortcuts page and here.
- Dragging the header never starts from these buttons, and a click on them never moves the panel.

#### Information only

The character panel shows information; every control lives in the open flyout. The exceptions are:

- the character sheet's values (above);
- dragging a card header to move the panel;
- the × on a portrait, which deselects;
- a click on a character card or a players-list row, which selects that character;
- a right click on a character, which targets them.

#### Position

- **Beside the players list** (the default, Keeper and players alike): the panel's bottom edge is as far from the screen's bottom as the players list's, and the gap between the list and the panel is that same distance. It does not move up as players join. The menu and flyouts open to the right there.
- The panel floats in Foundry's interface layer at the Panel layer's level, not inside Foundry's left column.

**Moving the panel.** With **Allow moving the panel** (`rollboxMovable`) on, dragging a card header moves the panel anywhere on the screen. The header is a character sheet's name row, either one on the two-character sheet, or the character cards' "N selected" row; during combat the whole turn-order box drags too ([combat](#combat)).

- It stays where it is dropped, after a reload too, and is kept on screen when the window gets smaller.
- A press that moves less than a few pixels is a click; a real drag never also presses what is under the pointer.
- While it is dragged, the menu and flyouts switch side as soon as the panel crosses the screen's middle.
- Dropped on the right half, the panel keeps its distance from Foundry's sidebar: it moves out when the sidebar expands and back when it collapses. Overlapping the chat is fine.
- **Reset position**, a button beside the toggle in Configure Settings, puts it back beside the players list at once; so does turning the toggle off.
- A saved spot that is off the screen or can't be read is ignored, and the panel stays beside the players list.
- There are no corner presets and no snapping.

**Which side the menu opens on.** **Menu and flyouts open to the** (`rollboxMenuSide`) is Automatic, Right or Left.

- Automatic opens towards the middle of the screen: to the left on the right half.
- Beside the players list they always open to the right.
- In the top half of the screen the menu and flyout line up with the character panel's top and grow down; Action, Check and Other stay level with its top and the extra button reaches above it. In the bottom half they line up with its bottom.
- Mirroring changes the layout, not the content: the order inside the cards stays.
- A flyout that opens partly off the screen shifts the panel just far enough to show it; the panel goes back when the flyout closes. The saved spot doesn't change.

#### Size

- **Panel size** (`rollboxScale`) scales the whole panel, its buttons and its flyouts, from 80% to 250%.
- Beside the players list it scales from the bottom-left corner, so it stays beside the list; a moved panel scales from the corner nearest it.
- **The mouse wheel while the panel is held** for a drag (Keeper and players) steps Panel size by 10% (up: bigger) within 80–250%, from the corner the panel would be anchored to if dropped there. It is saved when the drag ends, and Foundry's map doesn't zoom meanwhile.
- Without a press, the wheel scrolls and zooms as usual.

#### Layer

**Panel layer** (`rollboxPanelLayer`) decides whether Foundry's windows (sheets, journals, roll dialogs) cover the panel:

- **Bottom**: windows always cover the panel (the level of Foundry's left column).
- **Top**: the panel stays above every Foundry window, but below tooltips, notifications, right-click menus and modal dialogs.
- **Top when active** (the default): like a Foundry window. Clicking anywhere on the panel brings it to the front, and bringing another window forward puts that one in front.
- **Top when active or selected**: as Top when active, and the panel also comes forward whenever the Keeper selects tokens.

It applies beside the players list and moved alike; the flyouts follow it, and a change applies at once. Top when active takes its number from Foundry's own window order; if that isn't available it works as Bottom.

#### Look

- **Panel transparency** (`rollboxTransparency`) sets how see-through the panel, its buttons and its flyouts are. Only the background: text and icons stay fully readable.
- **Panel colour** (`rollboxColor`) sets the background colour of the panel, its buttons and its flyouts. Any colour can be picked; the panel shows it darker or lighter only as far as the text needs to stay readable. Under Foundry's Light interface a dark colour shows as its light shade (lightness mirrored, tint kept) without changing the setting. Transparency applies on top.
- Both are **Foundry theme only**: the CoC7 themes draw CoC7's own solid look. In Configure Settings both are greyed out while a CoC7 theme is chosen, and their hints say "Foundry theme only."
- **Theme** (`rollboxTheme`) picks Foundry, Art Deco or CoC7 minimal; the palettes and how each theme looks are in [themes](#themes).
- Theme, Panel colour, Panel transparency and Panel size each have a **Reset** button in Configure Settings that puts back only that setting's default, applied on Save.

#### Auto-hide

With **Auto-hide the character card** (`rollboxAutoHide`) on, after **Auto-hide after** (`rollboxAutoHideAfter`) without using the panel, the full character sheet (one or two characters) drops to the compact card: the one a character gets when several are selected. Hovering over the panel, pressing it or a new selection brings the full sheet back and starts the wait again. It works for the Keeper and players; there is no minimize button.

#### Keys

Rollbox takes no keys from the page. The panel's and flyouts' buttons, values and boxes are out of the Tab order, and Rollbox handles no keyboard events except typing in its own text boxes and one key:

- **Escape** closes an open Rollbox flyout while **Escape closes the flyout** (`rollboxEscapeClosesFlyout`) is on.
- Only while a flyout is open: with none open, or the setting off, Escape is Foundry's (closing windows, releasing tokens, its main menu).
- The Escape that closes a flyout does nothing else.
- A text box in another window keeps its own Escape, and while a target pick's prompt shows, Escape cancels the pick instead.

The combat turn order's clickable rows are the one exception to the Tab rule (see Limits).

#### A player's menu

A player's menu shows only the buttons the Keeper allows ([player](#player-rollbox)). While their investigator is unconscious, dying, dead or in a bout of madness, the whole menu is greyed with the reason on hover ([status](#status-effects)).

#### Redrawing

The panel redraws once per change, gathered to the next animation frame, so a box-select of many tokens is one redraw. Nothing runs while a token is dragged. The panel is placed again only when its size, or its menu's or flyout's, changes. A menu button loses its pressed border at once when its flyout closes, and the panel leaves no hooks or listeners behind when it closes.

### Settings

The panel's own settings, all personal ("Personal setting, affects only your screen."), in the **Rollbox panel** section of the settings page ([settings](#settings-page)).

| Setting | Key | Scope | Default | What it does |
|---|---|---|---|---|
| **Rollbox panel** | `rollboxEnabled` | personal | on | The feature switch: your Rollbox panel. Off, your panel and flyouts are gone; the being-attacked alert, the setup check and the assist relay keep running. Needs a reload. |
| **Theme** | `rollboxTheme` | personal | `foundry` | Foundry, Art Deco (`artDeco`) or CoC7 minimal (`coc7Minimal`); see [themes](#themes). Reset button. |
| **Panel colour** | `rollboxColor` | personal | `#0b0a13` | Background colour of the panel, buttons and flyouts. Foundry theme only. Reset button. |
| **Panel transparency** | `rollboxTransparency` | personal | 25 | 0–70%, steps of 5. How see-through the backgrounds are. Foundry theme only. Reset button. |
| **Panel size** | `rollboxScale` | personal | 100 | 80–250%, steps of 10. Size of the panel, buttons and flyouts. Reset button. |
| **Meters on the small cards** | `rollboxCardMeters` | personal | HP, MP, SAN, Luck | One tick box per meter (`hp`, `mp`, `san`, `luck`) for the character cards, the compact card, the players list and the turn order's rows. |
| **Allow moving the panel** | `rollboxMovable` | personal (per screen) | on | Drag the header to move the panel. **Reset position** button beside it. |
| **Menu and flyouts open to the** | `rollboxMenuSide` | personal | `auto` | Automatic, Right (`right`) or Left (`left`). |
| **Panel layer** | `rollboxPanelLayer` | personal | `active` | Bottom (`bottom`), Top (`top`), Top when active (`active`), Top when active or selected (`activeOrSelected`). |
| **Auto-hide the character card** | `rollboxAutoHide` | personal | off | Drop the full sheet to the compact card after a while unused. |
| **Auto-hide after** | `rollboxAutoHideAfter` | personal | 10 | 1 to 300 seconds; the time shows beside the slider ("10 s", "2 min 30 s"). |
| **Show the players when nothing is selected** | `rollboxShowPlayers` | personal | on | The Keeper's players list with nothing selected. Hidden on a player's settings page. |
| **Escape closes the flyout** | `rollboxEscapeClosesFlyout` | personal | on | Escape closes an open flyout. |
| (not shown) | `rollboxOffset` | personal (per screen) | `{}` | Where the panel is dropped: `{corner, x, y}`, plus `reach` on the right half (how far the sidebar reaches in at the drop). Empty while beside the players list. |

The same section also holds **Notice cards size** and the hidden Notice card places (`rollboxNoticePlaces`) ([combat](#combat)), **Simplified dice UI** ([flyouts](#flyouts)), **Check opens on** and **List style** ([check flyout](#check-flyout)), and the spell-text settings ([action flyout](#action-flyout)).

Every setting except the feature switch applies at once, without a reload.

### Rules

- SAN's bar drains against starting SAN, which is POW (Keeper Rulebook p. 34).
- Luck's bar is out of 99.

### Limits and known gaps

- Combat's turn-order rows that take a click are Tab stops and act on Enter or Space; every other Rollbox control is out of the Tab order.
- Top when active relies on an internal Foundry counter (`ApplicationV2._maxZ`); without it the panel works as Bottom, with one warning.
- The menu buttons match the one-character sheet's height exactly only with Foundry's own fonts; another font size leaves them their fixed size.
- Beside the players list the panel follows the list's size and the window, not modules that move or collapse Foundry's whole left column.
- A character assigned to a player who doesn't own it isn't in the players list, so "Send to all players" leaves it out.
- There is no list of NPCs with nothing selected outside combat.

### Decisions

- **The players list with nothing selected.** The Keeper's panel lists the players' investigators so the Keeper can call for a check from everyone without selecting tokens; a personal setting turns it off.
- **Action only with one or two selected.** One action is one character's, or one character's acting on another, so the button is hidden, not greyed, otherwise.
- **Opposed with any selection but one.** With nothing selected both sides are picked; with three or more several act against one. With exactly one, a right click on a characteristic starts it.
- **Sanity and Assist are tabs**, of Check and Other, so the menu stays at three fixed buttons plus one extra.
- **Fixed menu buttons.** The buttons have one size set in the stylesheet, never measured, so they don't grow or shrink with the cards; three match the one-character sheet and the extra reaches above it.
- **The character panel never changes width**, and highlights sit inside a card, so nothing shifts as the selection changes.
- **Two selected share one sheet**, player character on top, NPC below, the bottom one in tan, so the two are compared at a glance.
- **Information only.** Every control lives in the open flyout; the character panel shows information, with the few exceptions listed above.
- **The sheet's values follow CoC7's shortcuts** so the Keeper's habits from CoC7's sheet carry over; nothing is sent from the sheet itself, and no tooltip lists them.
- **Ctrl shortcuts open the flyout as a plain click** because Rollbox copies no links.
- **Beside the players list**, at a fixed distance from the screen's bottom, so the panel doesn't move as players join.
- **The panel floats in Foundry's interface layer**, not inside the left column, because Foundry's left column is always under its windows and the Panel layer could not work there.
- **Moving is per screen** (client scope) because a spot that suits one monitor may not suit another. No corner presets and no snapping.
- **The side switches live while dragging**, so the drop looks as the drag showed.
- **A right-side panel follows the sidebar**, keeping its distance; overlapping the chat is accepted.
- **Panel colour and transparency are Foundry theme only** because the CoC7 themes draw CoC7's own solid look.
- **Meters are chosen per user** for the small cards and rows; the full sheet always shows all four.
- **A right click on a character targets them** everywhere in Rollbox, for the Keeper and players.
- **No keys taken.** No Tab stops in the panel or flyouts, and only Escape, while a flyout is open and the setting is on.
- **Auto-hide drops to the compact card** rather than hiding the panel or offering a minimize button.
- **One redraw per frame**, so selecting many tokens or a busy fight stays light.
- Permanent names: `rollboxPanelLayer` value `activeOrSelected`; `rollboxAutoHide`, `rollboxAutoHideAfter`, `rollboxShowPlayers`, `rollboxEscapeClosesFlyout`, `rollboxCardMeters`; `rollboxOffset`'s `reach` field.

## Flyouts

### Summary

A flyout is what opens beside the menu when a menu button is pressed: Action, Check, Other or Opposed. Every flyout shares one layout (what, how, send), one send button that names who the request goes to, and one result list after sending. Rollbox only builds requests: CoC7's own links and cards do the rolling, and everything after the request is CoC7's.

### How it works

#### Opening and closing

- A menu button opens its flyout beside the menu and shows as pressed; pressing it again closes it, and pressing another switches.
- The menu stays visible whatever is open.
- Flyouts have no close button of their own: the menu button and Escape close them (see [panel](#panel)).
- A flyout stays open while its button is offered for the selection, and is drawn again for the new characters when the selection changes. Opposed stays open while anything is selected.
- A click on the character sheet's values opens a flyout with a starting state (see [panel](#panel)).
- Each flyout's own content is in its file: [action flyout](#action-flyout), [check flyout](#check-flyout), [other flyout](#other-flyout), [assist](#assist), [opposed flyout](#opposed-roll).

#### Layout

Each flyout is split into sections with clear space between them, and no lines or headings:

1. **What**: the check, the loss or the weapon.
2. **How**: difficulty, dice, Blind and label (the cause fields in the Sanity tab).
3. **Send**: the red status line when something is missing, the buttons, and the result.

- Under the flyout's title, a "for" line names the characters. With nothing selected it reads "No one selected: this goes to every investigator." and "Select tokens to choose who."
- There are no help paragraphs or tooltips inside flyouts; text boxes keep their placeholders. The one hover text is on the "± Dice" label: "Bonus (+) or penalty (−) dice".
- Regular, Hard and Extreme values read "60 · 30 · 12" (the Art Deco theme shows CoC7's "60 (30/12)"; see [themes](#themes)).

#### Difficulty, dice and Blind

- **Difficulty**: Regular, Hard, Extreme and Hidden, one pressed.
- **± Dice**: up to two bonus or two penalty dice, from −2 to +2, None in the middle.
- **Blind** (Check, Other): a tall toggle button to the right of the Difficulty and Dice rows, spanning both, with "Blind" written sideways. Click on, click off. It is greyed out where the flyout can't send blind.
- A player's own check has none of these rows: it is made Regular with no dice (see [Sending and who rolls](#sending-and-who-rolls)).

#### The status line and greyed buttons

- The line just above the buttons appears only in red, saying what is missing ("Type what the improvised weapon is"). There is no summary of what will be sent.
- The send buttons stay greyed out until everything required is filled in: a check ticked, a weapon picked or named, a group-Luck tie settled, a valid loss or damage, both opposed sides picked.
- A Cancel button is never greyed out.
- Worked-out information that isn't a restatement stays: Assist's Assisting / Rolling / chance block and the Opposed view's tie line.

#### The one send button

Each flyout has one send button, and its words say who the request goes to:

| Who | Button |
|---|---|
| Nothing selected (Keeper) | **Send to all players** (every investigator) |
| One player character | **Send to <player> (<character>)**: the player the character is assigned to, or every player owner when nobody has it assigned |
| One NPC (no player owner) | **Roll for <NPC>** |
| Several | **Send to each (N)** |
| Several, all NPCs | **Roll for NPCs** |

- The Keeper can act for anyone in the turn order, so the button always names who it goes to.
- Each is a private whisper with CoC7's roll link, or a private roll for an NPC.
- There is **no Send to chat** and **no Copy link**, and no public announcement.
- Assist names its rollers the same way; Opposed's button reads "Create opposed card".
- A player's buttons make their own check: "Make check", "Make opposed card", and in Assist a roller's "Roll Hard STR" (see [player](#player-rollbox)).

#### The result

After Send, the result reads as a heading and one name per line:

- "Check sent to:" (or "Sanity check sent to:", "Item check sent to:", "Luck check sent to:", "Assist sent to:"), then each player's character with their players, one per line. Opposed reads "Opposed card made:".
- "Rolled for you:", then each NPC the Keeper's client rolled.
- "Not sent:", then each name with a short reason.
- Then the flyout's own notes ("Assist card posted.").
- A player's own check reads "CoC7's check, in chat:" with their investigator.
- If nothing could be sent the line says so: "Nothing was sent.", "CoC7's roll links aren't available; nothing was sent." or "Something went wrong; see the console (F12)."

#### Labels

When the Keeper's text becomes a link's label, the check goes in front and the Keeper's text after it: "Sanity check · Seeing a ghoul", "Hard Spot Hidden · notice the knife". CoC7's own request sentence stays as it is. For an NPC rolled privately, the Keeper's note reads "<NPC>: <label>" with Hard or Extreme in front ("Guard: Hard Spot Hidden · notice the knife"), because CoC7's private card names only the check.

#### Value lines and the dice picker

Values that are dice (the Sanity loss, improvised damage) are an editable value line:

- Large plain text with no box, border or outline around it, a cursor only.
- Enter or clicking away confirms; empty becomes 0; valid text is written back tidied ("1d6" becomes "1D6").
- Invalid text turns red and blocks Send.

A full-width **Custom** button opens the compact dice picker under the line; a second click closes it:

- Number of dice as − n + (up to 9), one row of dice (D3 D4 D6 D8 D10 D12 D20 D100), a flat bonus as − n + (up to 99), and None.
- For damage a **+DB** toggle, which reads **+½DB** when the flyout asks for half the damage bonus (a thrown object).
- The picker edits the line, and typing in the line moves the picker. A line the picker can't show (1D6+1D4) shows nothing pressed.
- The picker builds text only: CoC7 and Foundry roll it.

**Simplified dice UI** (`rollboxSimplifiedDice`) on removes the Custom buttons and their pickers, and the preset rows too (the Sanity presets, the damage quick-picks), so a flyout shows only its typed value line. The Keeper types the dice (1D6+2); for damage `DB`, `½DB` and `1/2DB` are accepted (1D6+DB). Changing it switches an open flyout at once, keeping what the lines hold.

#### The improvised weapon

Other's Item tab and Action's Attack tab share the improvised weapon. Its skill is **Brawl** (Fighting (Brawl), the default), **Throw**, or **Other…**: any skill the character can roll, listed with its value, trained first. It is sent as an ordinary skill check labelled with the object, because CoC7 has no weapon for it. Details: [other flyout](#other-flyout) and [action flyout](#action-flyout).

#### Sending and who rolls

**Player characters.** The send button whispers the request, a CoC7 roll link, to the player owners of each character, the way CoC7's "Whisper to selected tokens" does. There is no public request and no copied link. Every option is written into the link (difficulty, dice, blind), never left to CoC7's defaults or the roller's chat mode.

**NPCs** (no player owner). When the Keeper sends, Rollbox rolls the NPC's side for the Keeper at once and privately, through CoC7's own actor checks ("Roll for <name>", "Roll for NPCs"); the Keeper clicks nothing.

- The Keeper's private note (a label, a skill rolled at its base value, a combined check's values) always comes just before CoC7's card.
- An NPC's Sanity check is the one NPC roll that isn't private: Rollbox makes CoC7's Sanity card on the Keeper's side and presses its roll, and the card is public. A character with no SAN value is skipped (see [check flyout](#check-flyout)).
- A maneuver's NPC side is rolled by CoC7's Start Rolls, which Rollbox presses once the target answers, whoever started it (see [action flyout](#action-flyout)).
- An attack's defence is the Keeper's, on CoC7's defender card.

**What a player starts.** When a player starts something that needs an NPC's check, the active Keeper's client rolls that NPC privately at once, as when the Keeper sends. An opposed roll a player starts leaves its Start rolls on CoC7's card to the Keeper, who is told; the card names each side. How a player's requests reach the Keeper's client is in [player](#player-rollbox).

**A player's own check** ("Make check") is made on their own client at once: CoC7's own check with its window skipped, as a Shift + click on its sheet does. It is Regular with no bonus or penalty dice and its card is posted in the table's roll mode. It is never a request to themselves, and Rollbox offers no way to open CoC7's modifier window: for anything special, players use their character sheet.

**Clicking a request's link.** When the Keeper clicks the link in one of Rollbox's own requests, CoC7 handles it as any link: it rolls once per selected token. A player who clicks a request gets CoC7's roll window and may change its options there; that is CoC7's normal behaviour.

**After the request.** Everything after the request is CoC7's: rolling, success levels, spending Luck on a failed roll, pushing, the Sanity flow and the opposed result.

### Settings

| Setting | Key | Scope | Default | What it does |
|---|---|---|---|---|
| **Simplified dice UI** | `rollboxSimplifiedDice` | personal | off | Type dice into the value lines instead of using the Custom buttons and pickers; the preset rows are hidden too. In the Rollbox panel section's Behaviour group. |

Each flyout's own settings are in its file.

### Rules

- Bonus and penalty dice: at most two either way (Keeper Rulebook p. 91).
- Difficulty levels Regular, Hard and Extreme; Hidden is CoC7's own option, passed through as it is.
- Rollbox applies no rule to a result: CoC7 rolls, compares and applies every one.

### Limits and known gaps

- A CoC7 link names no character: a Keeper who clicks one of Rollbox's requests rolls it for every selected token, as CoC7 does.
- A player who clicks a request can change its options in CoC7's roll window.
- The improvised weapon has no CoC7 weapon item, so its damage is a separate roll in the message.

### Decisions

- **Build on CoC7's own links and cards; no dice code of Rollbox's own.** CoC7 already rolls, compares and applies results, and Rollbox stays in its lane.
- **One send button, private.** Each request is whispered to the character's players, or rolled privately for an NPC. A public link isn't tied to a character, so anyone could roll it any number of times; a Keeper who wants one uses CoC7's own Create link tool.
- **The send button names who it goes to**, because the Keeper can act for anyone in the turn order.
- **NPC sides roll automatically and privately for the Keeper**, so the Keeper never clicks a request meant for an NPC.
- **A player's NPC check is rolled on the active Keeper's client at once**, never sent as a link to the Keepers: a CoC7 link names no character, so the Keeper's click would roll whichever token is selected.
- **A player's opposed card leaves Start rolls to the Keeper**, who sees both sides on CoC7's card.
- **A player's own check rolls at once, Regular with no dice.** Difficulty and dice are the Keeper's call, on the Keeper's requests; for anything special the player uses their sheet.
- **Rollbox never changes how CoC7 handles a click on a link.** CoC7's roll dialog letting players change options is accepted as CoC7's normal behaviour.
- **No summary above the send buttons.** The status line shows only what is missing, in red, and the buttons stay greyed until the request is complete.
- **The result is a heading and one name per line**, the same in every flyout, so it reads at a glance.
- **Three sections with space, no labels or lines**, and no help text or tooltips, so each flyout stays short.
- **Labels put the check first**, then the Keeper's text, so the player sees what to roll before why.
- **Dice are picked from a compact picker or typed into the line**, never through a separate dialog. Simplified dice UI shows only the typed line, presets included, for a Keeper who prefers typing.
- **Flyouts have no close button of their own**: the menu button and Escape close them.

## Check flyout

### Summary

The Check flyout asks characters for characteristic and skill checks, single or combined, and for Sanity checks. The Keeper picks the checks, the difficulty, bonus or penalty dice, Blind and a label, and sends one request per character; CoC7 rolls, compares and applies everything. A player's Check makes their own investigator's check at once, straight into chat.

### How it works

#### Tabs and title

- Three tabs for the Keeper: **Characteristic · Skill · Sanity**. Sanity is a tab of Check; there is no Sanity button of its own ([Sanity](#sanity) below).
- Luck and the Group Luck roll are in the [Other flyout](#other-flyout). Idea and Know are INT and EDU checks with a label ([Idea and Know](#idea-and-know)).
- The flyout opens on the tab set by **Check opens on** (`rollboxCheckOpensOn`): Characteristic, Skill, or the last tab used. It keeps the chosen tab while the selection changes.
- The title reads "Request a check", "Request a combined check" with two or more ticks, and "Request a Sanity check" on the Sanity tab. In the Art Deco theme there is no title: the tabs sit in the ornament's dip and a combined check shows "Combined · …" on its send button ([themes](#themes)).
- The flyout has three sections with space between them: what (tabs, search, list), how (options), and send.

#### Who it is for

- Under the title, the selected characters' names, muted.
- With nothing selected, the request goes to every player's investigator. The names line becomes two short lines: "No one selected: this goes to every investigator." and "Select tokens to choose who."

#### The lists

- **Characteristic tab:** STR to EDU. With one character each row shows Regular · Hard · Extreme ("full · half · fifth"); with several, or nothing selected, the names only.
- **Skill tab, one character:** every skill. Trained skills (above their base value) come first, highest first; then a divider "Untrained · base value"; then every other skill A–Z at its base value, with its three values.
- **Skill tab, several characters:** every skill A–Z without values, plus any specialisation one of them has on their sheet ("Language (Latin)").
- **Search:** a search box filters the skill list. When nothing listed matches, the list offers "+ Add <typed name>": any skill or specialisation, such as "Pilot (Boat)". Clicking it, or pressing Enter, adds it as a ticked row under the list:
  - a name the list already has ticks that row;
  - a specialisation of an open-ended skill (Art/Craft, Language, Lore, Pilot, Science, Survival) is requested at its group's base value;
  - anything else asks "No base value known for X. Value to roll an NPC at:" (0 to 100). That value is used only for an NPC that lacks the skill.
- **Missing skills:** a skill not on a character's sheet is shown and requested at its base value from Rollbox's skill table (Keeper Rulebook skill list, p. 56; Dodge is half DEX, Language (Own) is EDU). The table is in `skill-values.md`.
- **Open-ended skills** (Pilot, Survival, Language (Other), Lore, Art/Craft, Science) are rows only when the character has a specialisation on the sheet; any other specialisation comes through "+ Add".
- **No era filter:** all 78 skills in the table are always offered. Skills that only other eras have show when they are on a sheet.
- **List style** (`rollboxListStyle`): List shows rows with tick boxes. Tiles shows the characteristics as eight tiles, four to a row (name, value large, "half · fifth"), and the skills as a three-column grid; a click ticks a tile. The flyout keeps its width either way.

#### Ticks and combined checks

- One tick is a normal check. Two or more ticks make a combined roll (Keeper Rulebook p. 92): one roll compared with each ticked check, with **All of them** (the default) or **Any one**.
- A small clear button (a refresh arrow, "Unpick every check") sits beside All / Any one and unticks every check on every tab.
- Ticks are kept while switching between the Characteristic and Skill tabs, so a combined check can mix both.
- A combined roll is always one character's roll. With several characters selected, each gets their own combined roll.

#### Options

- **Difficulty:** Regular, Hard, Extreme or Hidden. With Hidden, the Keeper sets the difficulty on CoC7's result card after the roll.
- **± Dice:** up to two bonus or two penalty dice (Keeper Rulebook p. 91).
- **Blind:** a tall toggle beside both rows. It is greyed out on a combined roll, because CoC7's combined card is always public.
- **Label:** optional text shown to the player after the check's name: "Hard Spot Hidden · notice the cultist's hidden knife"; for a combined check, "Spot Hidden + Listen · …". Hard and Extreme are named in front; Regular and Hidden add nothing.
- There is no Pushed option. Pushing happens after a failure, from the Push button on CoC7's result card.

#### Idea and Know

Tick INT or EDU and type "Idea" or "Know" in the Label box. The request reads "INT · Idea"; CoC7's card says Intelligence or Education.

#### Row and tile shortcuts

The rows and tiles take CoC7's sheet shortcuts one for one, except that a plain left click keeps its menu meaning (tick). Ctrl is Ctrl or Cmd; Alt is Option on a Mac.

| Click | What it does |
| --- | --- |
| Left | tick or untick |
| Shift + Left | send just this check at once, as a plain Regular check (the ticks and options stay) |
| Ctrl + Left | copy this check's CoC7 roll link (the flyout's difficulty, dice, Blind and label) to the clipboard, with a short "Link copied" notice; the Keeper's only, nothing ticked or sent |
| Ctrl + Shift + Left | tick or untick |
| Alt + Right | add it to the ticks |
| Shift + Alt + Right | add it and send the ticks at once |
| Right | open [Opposed](#opposed-roll) with this check on the first side (one or two characters selected) |
| Shift + Right | the same, and make the opposed card as soon as both sides have a check |

A right click with any selection other than one or two characters (nothing selected, or three or more) opens nothing, and the result area says "Opposed can't be opened for this selection." A player who is not allowed Opposed rolls gets "You can't start an opposed roll." on a right click, and nothing opens. Clicks on the character sheet's own values (a characteristic, SAN, Luck) are described in [panel](#panel).

#### Sending

- One send button. Its words name who it goes to: "Send to all players" (nothing selected), "Send to <player> (<character>)", "Send to each (N)", "Roll for <character>" for one NPC, or "Roll for NPCs" when every character is an NPC.
- While nothing is ticked the button is greyed out and the line above it says, in red, "Tick a check to request it." Otherwise the line is hidden.
- After sending, the result shows a heading and one name per line: "Check sent to:", "Rolled for you:" and "Not sent:" with the reason. The flyout stays open with its ticks, so the same request can be sent again.
- **A player character** gets CoC7's own roll link, whispered to the character's players with CoC7's own sentence ("Your keeper has requested Alice make a … roll."). A combined check is CoC7's combined card. A missing skill goes by name or CoC ID, and CoC7 adds it to the sheet at its base value when the player rolls; this is rare, because investigator sheets list every skill.
- **A skill CoC7 can't find**, or a name that can't go in a CoC7 link (it holds `, : [ ] { } # & < >`), is not sent to that character; the Keeper sees why under "Not sent:".
- **An NPC** (no player owner) is rolled at once on the Keeper's side, privately, through CoC7's own actor checks, with no window. A missing skill is a raw roll at its base value, and nothing goes on the NPC's sheet. A Keeper's note names the check when CoC7's card can't: a missing skill, a label ("Guard: Hard Spot Hidden · notice the knife"), or a combined check. The note always comes just before CoC7's card.
- **An NPC's combined check** is one private roll at the highest of the ticked values (Any one) or the lowest (All of them), which passes or fails exactly as CoC7's combined card would. The Keeper's note names every check and the value used.

#### A player's Check

- With the Player Rollbox on and the **Checks** feature allowed, a player's Check shows their own investigator only, with the tabs **Characteristic · Skill**. Players have no Sanity tab: Sanity checks are the Keeper's.
- The title is "Make a check" ("Make a combined check" with two or more ticks). There is no Difficulty, ± Dice, Blind or Label: difficulty and dice are the Keeper's call, and come with the Keeper's requests. A player who wants something special uses CoC7's character sheet.
- **Make check** rolls straight into chat with no window: CoC7 makes the check on the player's own client, Regular with no bonus or penalty dice, as a Shift + click on the value on CoC7's sheet does, and posts its card in the table's roll mode. It is not a request, and nothing is whispered.
- A combined check posts CoC7's combined card, which waits for the player's roll.
- Without the **Combined checks** feature a player ticks one check at a time: a new tick takes the place of the last.
- Shift + click on a row makes that check at once. On the player's panel, a click on a characteristic opens Check with it ticked, and Shift + click rolls it at once ([player](#player-rollbox)).

#### Sanity

The Sanity tab is the Keeper's only. On it, a SAN list takes the place of the names line, and Check's options and send section are hidden; the tab has its own three sections: the loss, the cause, and sending.

##### SAN list

Each selected character's name and current SAN, muted ("SAN 60 / 99"). A character with no SAN value reads "— skipped" and is left out when sending. With nothing selected, the two short lines instead.

##### Loss

- A large loss line, "0 / 1D6": SAN lost on a success, then on a failure. Each side is plain text to click and type into; Enter or clicking away confirms it.
- It starts at 0 / 1D6. An empty side becomes 0. A loss is a whole number or dice joined by + or − ("2", "1D6", "1D6+1D4"); anything else turns red, greys out the send button, and the line above it says "A loss is a number or dice, e.g. 2, 1D6 or 1D6+1D4."
- Under the line, eight presets fill both sides in one click: 0/1, 0/1D3, 0/1D6, 1/1D4+1, 1/1D6, 1D3/1D10, 1D6/1D20, 1D10/1D100. The one matching the line is highlighted.
- One full-width **Custom success or failure loss** button opens the compact dice picker for both sides: the number of dice (− n +, up to 9), one row of dice (D3, D4, D6, D8, D10, D12, D20, D100), a flat bonus (− n +) and None. A mix the picker can't show, such as 1D6+1D4, is typed into the line.
- With **Simplified dice UI** (`rollboxSimplifiedDice`) on, the presets, the Custom button and the picker are hidden and the Keeper types into the line.

##### Cause

- **What caused it** (optional) is the link's label, shown to the players instead of the numbers: "Sanity check · Seeing a ghoul". Left empty, the label is "Sanity (1/1D6)".
- **Creature** (optional) names the creature or source. CoC7 uses it to cap later losses from the same kind of creature, so it is filled in only for a creature, never for free text.
- Both fields have placeholders only: no help lines or tooltips.

##### Sending a Sanity check

- The same one send button as Check. The red line shows only when a loss isn't one.
- A player character gets CoC7's own Sanity link, whispered to their players.
- An NPC's Sanity card is made on the Keeper's side and Rollbox clicks its Sanity roll. It is the one NPC roll that is public: CoC7 can't make an NPC's Sanity card private, and only that card runs the loss, the INT roll, insanity and the creature record. An NPC at SAN 0 gets CoC7's "permanently insane" card, which has no roll button.
- The result lists "Sanity check sent to:", "Rolled for you:" and "Not sent:" ("Thing: no Sanity value"), then "Click Apply on CoC7's card to take the loss."
- After sending, nothing is Rollbox's. CoC7 runs the Sanity roll, the loss (applied when the Keeper clicks Apply on the card), the INT roll for temporary insanity, bouts of madness, indefinite insanity and its record of creatures already seen.
- A Shift + click on SAN on the character sheet sends a plain SAN roll instead: CoC7's SAN check, with no loss and no Sanity card ("SAN roll sent to:"; see [panel](#panel)).

### Settings

| Setting | Key | Scope | Default | What it does |
| --- | --- | --- | --- | --- |
| **Check opens on** | `rollboxCheckOpensOn` | personal | Characteristic | The tab Check opens on: Characteristic, Skill or Last used. |
| **List style** | `rollboxListStyle` | personal | List | Characteristics and skills as a list of rows, or as tiles to click. |
| **Simplified dice UI** | `rollboxSimplifiedDice` | personal | off | Hides the Sanity presets, the Custom button and the dice picker; the loss is typed. Applies at once to an open flyout. |
| **Checks** (Player Rollbox) | `rollboxPlayerChecks` | world | on | Players get Check with the Characteristic and Skill tabs. |
| **Combined checks** (Player Rollbox) | `rollboxPlayerCombined` | world | on | Players may tick two or more checks; needs Checks. Off: one tick at a time. |
| Sanity (Player Rollbox, hidden) | `rollboxPlayerSanity` | world | on | Registered but not shown on the settings page; gives a player nothing. |

The Keeper's Check exists only while the **Rollbox panel** switch (`rollboxEnabled`) is on. The Player Rollbox settings are described in [player](#player-rollbox).

### Rules

- Combined rolls: one roll compared with each check; All of them or Any one (Keeper Rulebook p. 92). For an NPC, Any one uses the higher value: "one dice roll using the higher of the investigator's two skills" (Keeper Rulebook p. 203).
- Bonus and penalty dice: at most two either way (Keeper Rulebook p. 91).
- Idea is an INT roll and Know is an EDU roll (Keeper Rulebook p. 90).
- Skill base values come from the Keeper Rulebook's skill list (p. 56), with the specialisations on pp. 59, 64 and 73–75. Dodge is half DEX; Language (Own) is EDU; an open-ended skill's specialisation takes its group's base (Art/Craft 5, Language 1, Lore 1, Pilot 1, Science 1, Survival 10).
- Difficulty and bonus or penalty dice are set by the Keeper from the circumstances, so a player's own check is Regular with no dice.
- Pushing, Luck spending, Sanity loss and insanity follow CoC7's own cards.

### Limits and known gaps

- CoC7's roll dialog lets a player change the difficulty, dice and card type when they click a request. This is CoC7's normal behaviour and is accepted.
- Ticks and options start empty when the selection changes while the flyout is open; only the tab is kept.
- A change to a character while the flyout is open (a skill improved, SAN lost) doesn't redraw it; the values shown are those of when it opened.
- An NPC's combined roll judged at the highest value can miss a fumble the lower skill would have had on CoC7's combined card. Pass or fail is the same.
- An NPC's Sanity card is public: players see it.
- CoC7's creature record treats the same creature typed two ways ("Ghoul", "ghouls") as two sources.
- A label goes into CoC7's request sentence ("make a … roll"), so a cause written as a sentence reads oddly there.
- CoC7's era tags are incomplete: in a world whose era list lacks a skill (Dark Ages lacks Listen), CoC7 can't find it for a player character, and Rollbox says so instead of sending.

### Decisions

- **Combined checks come from ticking.** Ticking two or more checks makes a combined roll; there is no Combined button.
- **Missing skills at base value.** A skill missing from a sheet is offered and requested at its base value, with no "custom value"; only a typed skill with no known base asks for a value, used for NPCs only.
- **Who adds a missing skill.** An NPC is rolled privately at the base value with nothing written to its sheet; for a player character CoC7 adds the skill when the player rolls, as it does for its own links.
- **Refuse what CoC7 can't find.** A request to a player for a skill CoC7 can't find is not sent, and the Keeper is told, because CoC7 would silently do nothing on the player's click.
- **No era filter.** Every skill in the table is always offered, because games move between eras.
- **Open-ended skills only with a specialisation.** A request needs a named specialisation, so the groups appear only through a sheet's specialisation or "+ Add".
- **Label field.** The Keeper's label goes after the check's name, action first ("Hard Spot Hidden · notice the knife"), so the player sees what to roll; CoC7's request sentence stays as it is.
- **Idea and Know are INT and EDU checks with a label.** There is no Attribute tab: Luck is in Other, Sanity is a tab of Check.
- **No Pushed option.** Pushing happens after a failure, from CoC7's own result card.
- **No Blind on combined rolls or Sanity checks.** CoC7's combined and Sanity cards can't be made blind.
- **NPC combined check as one private roll.** CoC7's combined card is always public, so an NPC rolls once at the highest (Any one) or lowest (All of them) value, with a note to the Keeper naming the checks.
- **NPC Sanity is public.** Rollbox makes CoC7's Sanity card on the Keeper's side and clicks its roll. CoC7 can't make an NPC's Sanity card private, and only that card runs the loss, the INT roll, insanity and the creature record. A character with no SAN value is skipped.
- **What caused it is only the label.** A separate optional Creature field feeds CoC7's creature record, so free text never caps a later loss.
- **Sanity is a tab of Check.** Sanity is a check like the others, so it has no button of its own.
- **Dice are picked or typed.** A loss comes from a preset, from the compact picker that the Custom button opens, or is typed into the value line. **Simplified dice UI** hides the presets, the Custom button and the picker for a Keeper who prefers typing.
- **One send button.** There is no Send to chat and no Copy link button: a CoC7 link isn't tied to a character, so an open link anyone can roll has little use in play.
- **Ctrl + click on a row copies its link**, as CoC7's sheet shortcut does, for the Keeper to paste into a journal or a handout. The link is the one a request would send: this check with the flyout's options.
- **Only what is missing.** The line above the send button shows only in red, saying what is missing; there is no summary of what will be sent.
- **A player makes their own check at once.** Make check rolls straight into chat through CoC7's own check with its window skipped, because difficulty and dice are the Keeper's call and come with the Keeper's requests.
- **No Sanity tab for players.** Sanity checks are the Keeper's call.
- **Combined checks need Checks.** A player's Combined checks feature gives nothing without Checks.

## Other flyout

### Summary

The Other flyout holds the checks that aren't a characteristic, a skill or Sanity. The Keeper's has three tabs: Item (a weapon roll for one character), Luck (with the Group Luck roll) and Assist. A player's has Opposed and Assist, each only when the Keeper allows it.

### How it works

#### Tabs

- The Other button is in the menu for any selection, nothing selected included.
- **The Keeper's tabs:** **Item · Luck · Assist**. Assist is described in [assist](#assist).
- **A player's tabs:** **Opposed · Assist**, each only when the Player Rollbox allows that feature. A player picks the opponent, or who they help, by targeting tokens. See [Opposed](#opposed-roll) and [assist](#assist).
- **Players have no Luck tab.** The Keeper calls for Luck rolls; players roll Luck when the Keeper requests it, and spend Luck on their rolls through CoC7's own card.
- **Item** needs exactly one character selected. With two or more, or nothing selected, it is greyed out. No other tab is ever greyed out; Assist with fewer than two characters offers **⌖ Add a character**.
- **Which tab opens:** the last tab used. While Item can't be used, Other shows Luck, and it returns to Item once Item can be used again. With no tab chosen yet, one character opens on Item, and two or more, or nothing selected, on Luck.
- Other keeps its tab while the selection changes.
- The title follows the tab: "Item check", "Luck check", "Assist" or "Opposed roll". In the Art Deco theme the tabs sit in the ornament's dip with no title ([themes](#themes)).
- A click on the character sheet's Luck opens Other on Luck ([panel](#panel)).

#### Item

Item is for a weapon roll with no token to target, such as shooting a lock. Attacks on tokens are the [Action flyout](#action-flyout)'s, in CoC7's combat flow.

##### Weapons

- The character's weapons, A–Z: each weapon's name, the skill a request for it uses, and that skill's Regular · Hard · Extreme values. A skill missing from the sheet shows its base value.
- A weapon with two skills (a knife that can be thrown: Fighting (Brawl) and Throw) has one row per skill, main skill first.
- An automatic, burst or thrown weapon with no alternative skill set uses its main skill, as CoC7 does.
- A weapon with no skill set is greyed out and reads "no skill set".
- With no weapons: "No weapons on <name>'s sheet."
- A weapon is sent as an ordinary skill check labelled with the weapon: "Firearms (Handgun) with the .38 Revolver". It is never CoC7's weapon link, which starts CoC7's attack card and ignores difficulty, dice and Blind.

##### Improvised weapon

- The last row is **+ Improvised weapon**. Picking it shows:
  - "What is it?" (required), such as Candlestick;
  - the skill: **Brawl** (Fighting (Brawl), the default), **Throw**, or **Other…**, a list of every skill the character can roll, with values;
  - the chosen skill's name and values (its base value when missing from the sheet).
- It is sent as an ordinary skill check labelled with the object: "Fighting (Brawl) with Candlestick", as typed. Nothing goes on the character's sheet.
- The skill choices and the Other… list are shared with the Action flyout's improvised attack.

##### Damage

- Improvised weapons only, optional, in a section of its own.
- An editable damage line, starting at "0" (no damage).
- Quick-picks under it: None, 1D3+DB, 1D4+DB, 1D6+DB, 1D8+DB, 1D10+DB. A click writes the line, which can be changed after; the matching one shows pressed.
- A full-width **Custom damage** button opens the compact dice picker with a +DB toggle (for example 1D6+DB, taken from the closest weapon in the rulebook's table).
- With Throw picked, the toggle reads "+½DB", the quick-picks read "1D3+½DB" to "1D10+½DB", and a DB already on the line becomes ½DB: thrown weapons add half the damage bonus.
- With **Simplified dice UI** (`rollboxSimplifiedDice`) on, only the damage line shows; DB, ½DB or 1/2DB can be typed.
- When sent, the character's damage bonus is filled in for DB or ½DB, and the damage goes in the same chat message as a roll button the player clicks. For an NPC, the damage roll is in the Keeper's note.

##### Options and sending

- Difficulty (Regular, Hard, Extreme, Hidden) and ± Dice, with the Blind toggle beside them. There is no Label field: the weapon or object is the label.
- One send button: "Send to <player> (<character>)", or "Roll for <character>" for an NPC.
- While something required is missing, the button is greyed out and the line above it says what, in red: "Pick a weapon, or an improvised weapon.", "Type what the improvised weapon is.", "Pick the skill it uses." or "Damage is dice, e.g. 1D6, 1D6+2 or 1D6+DB."
- The result reads "Item check sent to:", "Rolled for you:" or "Not sent:" with the reason. A player character gets CoC7's skill check link; an NPC is rolled privately for the Keeper, with a note naming the weapon or object ([check flyout](#check-flyout)).

#### Luck

##### Who rolls

- Each selected character's name and Luck, muted, one per row.
- With nothing selected, the two short lines instead ("No one selected: this goes to every investigator." and "Select tokens to choose who."): every investigator rolls their own, and there is no Group Luck roll.
- **A sheet without Luck** (most creatures, such as the compendium Deep One) reads "No Luck", greyed, and is left out of the roll. With no one left, the send button is greyed out with the red line "No Luck on this sheet.", so a Shift + click on that sheet's Luck sends nothing.

##### Group Luck roll

- With two or more selected, and at least one with a Luck value, a toggle: **Group Luck roll: only the lowest Luck rolls**.
- On, the line names who rolls ("Harvey rolls (Luck 45).") and the send button names only them. Characters without Luck are left out.
- On a tie: "Tied at Luck 45. Who rolls?" with a button for each tied character. The send button stays greyed out ("Pick who rolls for the group.") until one is picked.

##### Options and sending

- Difficulty and ± Dice, with the Blind toggle beside them; then **Label** (optional), such as "is the cab still there?".
- One send button, as Check's: "Send to all players", "Send to <player> (<character>)", "Send to each (N)", "Roll for <character>" or "Roll for NPCs".
- It is sent as CoC7's Luck check, like any other check: a player character gets CoC7's Luck roll link, an NPC is rolled privately for the Keeper. The result reads "Luck check sent to:", "Rolled for you:" or "Not sent:".
- A Shift + click on the character sheet's Luck sends a plain Luck check (Regular, no dice, not blind, no label) at once.

### Settings

| Setting | Key | Scope | Default | What it does |
| --- | --- | --- | --- | --- |
| **Simplified dice UI** | `rollboxSimplifiedDice` | personal | off | Hides the damage quick-picks, Custom damage and the dice picker; damage is typed. Applies at once to an open flyout. |
| **Opposed rolls** (Player Rollbox) | `rollboxPlayerOpposed` | world | on | Players get the Opposed tab ([Opposed](#opposed-roll)). |
| **Assist** (Player Rollbox) | `rollboxPlayerAssist` | world | on | Players get the Assist tab ([assist](#assist)). |
| Luck (Player Rollbox, hidden) | `rollboxPlayerLuck` | world | on | Registered but not shown on the settings page; gives a player nothing. |

The Keeper's Other exists only while the **Rollbox panel** switch (`rollboxEnabled`) is on. The Player Rollbox settings are described in [player](#player-rollbox).

### Rules

- The Keeper calls for Luck rolls (Keeper Rulebook p. 90).
- Group Luck roll: "the player whose investigator has the lowest Luck score … should make the roll" (Keeper Rulebook pp. 89–90). On a tie the Keeper picks who rolls.
- Bonus and penalty dice: at most two either way (Keeper Rulebook p. 91).
- Thrown weapons add half the damage bonus (the rulebook's weapons table, as CoC7's own thrown weapons do).
- A weapon's skill: the alternative skill for an automatic, burst or thrown weapon, else the main skill, as CoC7 chooses.

### Limits and known gaps

- Item's weapon rows don't start an attack: a weapon roll here never reaches CoC7's attack card, damage or ammunition. Attacks on tokens are the Action flyout's.
- A damage bonus CoC7 hasn't worked out (stored as text) can't be filled in: the improvised request goes without damage and the Keeper is told.
- A change to a character while the flyout is open (a new weapon, a skill improved) doesn't redraw it; the request reads the sheet when it is sent.
- CoC7's roll dialog lets a player change the difficulty, dice and card type when they click a request (CoC7's normal behaviour, accepted).
- The Other… skill list is drawn by the operating system and may ignore the dark colours.

### Decisions

- **Other holds the non-characteristic checks.** Item and Luck sit in one flyout for any selection; Sanity is a tab of [Check](#check-flyout) and Assist a tab of Other, so the menu stays short.
- **Item only with exactly one character.** A weapon list belongs to one sheet; every other tab works for any selection, nothing selected included.
- **Weapons as labelled skill checks.** CoC7's weapon link starts its attack card and ignores difficulty, dice and Blind, so Item sends the weapon's skill with the weapon as the label.
- **Improvised weapon as a labelled skill check.** It reads "Fighting (Brawl) with Candlestick", with an optional damage roll, and nothing goes on the sheet.
- **Damage quick-picks with +DB, half for Throw.** 1D3+DB to 1D10+DB cover the rulebook's common improvised weapons; a thrown object adds half the damage bonus.
- **Simplified dice UI hides the presets too.** With it on, only the typed value line shows: no quick-picks, no Custom button, no picker.
- **Group Luck roll in the Luck tab.** With two or more selected, the lowest Luck rolls for the group; on a tie the Keeper picks.
- **No Luck for players.** The Keeper calls for Luck rolls; the player feature's saved value is kept but not shown.
- **A sheet without Luck is left out.** Its row reads "No Luck" and a request with no one left is greyed with "No Luck on this sheet.", instead of letting CoC7 fail with "Roll threshold has not been set".
- **Last tab used.** Other opens on the tab chosen last and keeps it while the selection changes; a greyed Item falls back to Luck and comes back when it can be used.
- **One send button.** As in every flyout: no Send to chat, no Copy link, and the line above the button only in red for what is missing.

## Opposed roll

### Summary

The Opposed roll flyout sets up a two-sided roll (one character against another, or several against one) and makes CoC7's own opposed card with both sides, their checks and their dice filled in. CoC7 rolls and compares the sides on its card; Rollbox presses CoC7's Start rolls for the Keeper so NPC sides roll at once. A player can start an opposed roll against a target, and the Keeper finishes the opponent's side on CoC7's card.

### How it works

#### Opening it

The Keeper opens Opposed in any of these ways:

- the **Opposed** button on the menu, offered with two characters selected, with three or more, and with nothing selected (never with exactly one; see [panel](#panel));
- a right click on a characteristic of the character sheet, with any selection;
- a right click on a row of the Check flyout, with one or two characters selected (the first selected character takes the top side with that check); with any other selection the Check flyout reads "Opposed can't be opened for this selection."

Opposed is a flyout beside the menu, like the others. The menu stays, and the character panel shows the characters (the two-character sheet with two selected); the flyout has no character sheets of its own. It stays open while anything is selected, and closes when everything is deselected or with its own **Cancel**.

#### The two sides

Every opposed card has exactly two sides. Each side is a block with:

- a header: its role tag (**Attacker** for the top block, **Defender** for the bottom one), the character's name with a **✕** that empties the side, and the picked check ("STR 40", "Stealth 50 +1" with a bonus die);
- the Check flyout's two tabs, **Characteristic** and **Skill**, with the same skill order (trained skills highest first, then "Untrained · base value" and the rest A–Z), a search box on the Skill tab (its text stays when switching tabs and across redraws), and each row's value at Regular only;
- a **± Dice** row: −2, −1, None, +1, +2 (bonus or penalty dice).

The two sides can use different kinds of check: one a skill, the other a characteristic. Sanity and Luck are never offered. A skill missing from a sheet is offered at its base value, and once picked the side reads "Not on the sheet: CoC7 adds it at its base value when the card is made." Each side's list scrolls past about 120px.

Between the two blocks a larger **⇅ Swap sides** button reverses them, each keeping its character, check, dice and search text. The top block is always CoC7's first side, the attacker.

A right click on a side's name targets that character's token, as everywhere in Rollbox.

#### Filling the sides

The sides start in selection order:

- two selected: one on each side;
- one selected: it fills the top side and the bottom side waits;
- nothing selected: both sides wait;
- three or more selected: all of them go on the top side (several against one, below) and the opponent waits.

A side waiting for its character reads in red "Pick who rolls this side." (or, when the other side is filled, "Opposed roll started. Select another character.") and has **⌖ Pick a target** in its header. Pick a target turns on Rollbox's target picker (Foundry's Target tool): the next token targeted fills the side. A waiting side also fills from the next character who joins the selection.

The sides survive a selection change: a swap and the picks are kept. A side whose character is deselected empties again and waits, unless it is the side the roll started from or a character placed there with the picker. Two other characters selected after opening from the Opposed button replace both sides.

#### Starting from a character's value

A right click on a characteristic of the character sheet opens Opposed with that character as the top side (attacker), the check already picked:

- with exactly two selected, the other character fills the bottom side;
- otherwise the bottom side waits, in red: "Opposed roll started. Select another character.";
- a Shift + Left click on another character's characteristic fills the waiting side with that check and makes the card at once.

The starting side stays even if its character is deselected. A Shift + Right click makes the card at once when both sides are ready; with only one character it opens Opposed with that side picked, and the card is made when the second side is shift-clicked. CoC7 can't finish a one-sided card made this way, so Rollbox never makes one. There is no note above the panel and nothing to cancel but Opposed's own Cancel.

SAN and Luck are never sides of an opposed roll: their opposed shortcuts on the sheet open Check's Sanity tab or Other's Luck tab instead (see [panel](#panel)).

#### Several against one

One side can hold several characters, all with the same check, against one character on the other side (three investigators sneaking past one guard). With three or more selected they fill the top side; the Keeper picks the opponent with Pick a target.

- The side lists each character with its ✕; **⌖ Add a character** adds more with the picker. With one left it becomes an ordinary side.
- It picks from every characteristic and skill without values, as the Check flyout does for several characters.
- It has no tie line (there is no one value to compare).
- **Create opposed cards (N)** makes one CoC7 opposed card per character against the one opponent, with the same check and dice for each.

#### The footer and making the card

The footer has a status line, then **Cancel** and **Create opposed card**.

- Until both sides have a check, the status line says what is missing, in red: "Pick a check for both sides.", "Pick a check for Guard." or "Pick a check for the group." While a side waits for its character, the waiting line says it and the status line stays empty.
- Once both sides have a check, the status line shows the **tie line**: "On a Tie: Guard wins, higher value (Spot Hidden 60 vs Stealth 50, p. 91)." or "On a Tie: equal values (50), so a stalemate or both re-roll (p. 91)." It compares the two values only, as advice for the Keeper.
- Create opposed card is greyed out until both sides have a check, while the card is being made, and after it is made until a side's character, check or dice change, so one click makes one card.

Create makes CoC7's opposed card with both sides at Regular difficulty and presses CoC7's **Start rolls** on the Keeper's screen at once. Start rolls rolls every side with no player online: the NPC, or a character whose player is offline. Each player then rolls their own side on the card. If Rollbox can't press Start rolls, the Keeper is told to.

The result under the buttons reads "Opposed card made:" ("Opposed cards made:" for several), one line per side saying who rolls: "Alice: Test rolls on the card", "Guard: Keeper rolls (NPC), by Start rolls", "Keeper rolls (player offline), by Start rolls". Cancel then reads Close and the view stays open, so the tie line is at hand. When no card is made, "Not sent:" gives each reason, for example "Guard: CoC7 can't find Pilot (Boat)".

#### Missing skills on the card

When a side's skill is missing from its sheet, CoC7 adds it to that sheet at its base value as it makes the card, for NPCs too. Rollbox first checks that CoC7 can find the skill; if CoC7 can't, nothing is made and the Keeper is told why, instead of CoC7 failing with "Unknown skill".

#### Roles on CoC7's card

CoC7 marks the first side attacker and the second defender on every opposed card, even outside combat, and compares the rolls only when one side is each. Outside combat the roles don't change who wins. The Attacker and Defender tags show those roles, and Swap sides lets the Keeper choose who is first. Rollbox never makes combat opposed cards from this flyout; melee never uses it.

#### A player's Opposed

A player opens Opposed from their Other flyout's **Opposed** tab, from a right click on their own sheet's characteristic, or from a Check row's right click, when the Keeper allows it (**Opposed rolls**). Without it, a Check row's right click reads "You can't start an opposed roll."

- The player picks **only their own check and their opponent**. Their own side is labelled **You** and has no ✕; the opponent's side is labelled **Opponent**.
- The opponent's side, while empty, reads "Opposed roll started. Target your opponent." with a **Target your opponent** button. A token the player has already targeted is used without asking, unless its character is already a side; otherwise the next token they target fills it.
- The opponent's side then shows only the name with its ✕ and "Your Keeper picks what <name> rolls.": no lists, values or dice, so an NPC's sheet is never shown. There is no tie line and no Swap sides.
- **Make opposed card** goes to the Keeper's Rollbox (CoC7 needs a Keeper for opposed cards; the Keeper must be online).

The Keeper's client makes CoC7's opposed card **partly filled**: the player's side only, nothing rolled, Start rolls not pressed. A note whispered to the Keepers says how to finish it on CoC7's own card: right-click the opponent's check on their locked sheet and roll it as CoC7's **Opposed roll card**, which joins the newest open opposed card, then press **Start rolls**. The player's result adds "Your Keeper adds <name>'s side and starts the rolls."

Once the Keeper's side joins, the active Keeper's client presses CoC7's own role button on the joined side (the click the Keeper would make) until the player's side is **Attacker** and the joined side **Defender**, so CoC7 offers Start rolls at once. Rollbox never presses Start rolls on these cards; the Keeper does.

### Settings

The flyout has no settings of its own. It shows only while the user's own **Rollbox panel** switch (`rollboxEnabled`, personal) is on, and on a player's screen only with the **Player Rollbox** on; see [settings](#settings-page).

| Setting | Key | Scope | Default | What it does |
| --- | --- | --- | --- | --- |
| **Opposed rolls** (Player Rollbox, What players can do) | `rollboxPlayerOpposed` | world | on | Gives players the Opposed tab in their Other flyout and the right-click opposed shortcuts. |

### Rules

- Higher success level wins; on equal levels the higher skill or characteristic wins; if those are equal too, it is a stalemate or both re-roll (Keeper Rulebook p. 91). CoC7's card compares the levels; the tie line states the rest.
- No difficulty: the other side's result is the difficulty (Keeper Rulebook p. 92). Rollbox sends each side as Regular so CoC7 doesn't fall back on its world default.
- Each side takes at most two bonus or two penalty dice (Keeper Rulebook p. 91); bonus and penalty dice are "primarily for use with opposed rolls" (p. 91).
- Opposed rolls can't be pushed (Keeper Rulebook p. 90).

### Limits and known gaps

- On a tie CoC7's card shows only "Tie"; the Keeper settles it from the values on the card, helped by the tie line.
- CoC7 8.15 can't make an opposed card without roles, so the Attacker and Defender tags stay even outside combat.
- A card a player started waits for the Keeper's side: the Keeper's next CoC7 opposed roll from a sheet joins the newest open opposed card, so another open card made after it takes that roll instead.
- A Keeper's page reloaded before the side joins leaves the roles on a player's card to the Keeper's own clicks; after four presses without success Rollbox stops and tells the Keeper to set them.
- The view redraws on a selection change only; a change to a character while it is open (HP lost) shows on the character panel.
- A player can change options in CoC7's roll dialog when rolling their side; that is CoC7's normal behaviour.

### Decisions

- **Exactly two sides per card, Cancel and Create only.** CoC7's opposed card compares one attacker with one defender; several against one makes one card per character.
- **The Opposed button shows with two, with three or more, and with nothing selected, never with exactly one.** Several against one and an empty start need a way in; one character opens Opposed from its sheet instead.
- **With three or more selected, the several go on the top (attacker) side.** The opponent is the single character picked afterwards.
- **Each side picks from the Characteristic and Skill tabs only.** Sanity is never opposed, Luck lives in Other, and Idea and Know are INT and EDU checks.
- **CoC7 puts a missing skill on the sheet at base value, NPCs too, after Rollbox checks CoC7 can find it.** This keeps the card working through CoC7's own path; a skill CoC7 can't find is refused with a reason rather than a CoC7 error.
- **Rollbox presses Start rolls for the Keeper's own cards.** NPC sides roll at once and privately through CoC7, and players roll their own sides.
- **Ties are the Keeper's, from the card; the tie line stays as advice.** CoC7 shows only "Tie"; the line states the rulebook's tie rule (p. 91) and compares values, never success levels.
- **The Attacker and Defender tags and Swap sides stay.** Cards with no roles aren't possible in CoC7 8.15, so the Keeper chooses who is first; there is no hint calling roles cosmetic.
- **No "Keeper rolls" lines, "VS", rules paragraph or Swap explanation in the view.** The view stays short; who rolls is shown in the result after the card is made.
- **Opposed opens from a right click with one side waiting, with no two-step and nothing to cancel.** The waiting side fills from a selection, a shift-click or the picker, and Opposed's own Cancel closes it.
- **Each empty side has a target picker.** The Keeper can fill a side without changing the selection.
- **A player's Opposed picks only their own check and the opponent.** A player never sees an NPC's sheet or values; the Keeper picks and rolls the opponent's check on CoC7's card.
- **Rollbox sets the roles on a player's card when the Keeper's side joins, but never presses Start rolls there.** Setting roles is the click CoC7 offers the Keeper; starting the rolls stays the Keeper's call.
- **An opposed roll a player starts leaves Start rolls to the Keeper.** The Keeper is told when the card has an NPC side.

## Assist

### Summary

Assist covers Physical Human Limits: several characters put a characteristic together against something too big for any one of them, such as a rafter to lift, a door to hold shut or a creature to brace against. Rollbox works out who helps and who rolls and at what difficulty, sends the rollers an ordinary characteristic check, and posts one public Assist card. Players can join an assist by targeting the character they help; the Keeper sets the rest.

### How it works

#### Where it lives

Assist is the **Assist** tab of the Other flyout; it has no button of its own. The Keeper's tab is never greyed out, whatever the selection. Every control is inside the flyout: while Assist is open, the character cards beside it only show each character's value (the Use value, or the Against value for a target).

#### The Keeper's tab, top to bottom

1. **The number to beat**: a large value line with its caption. With targets marked, it is their Against values summed, captioned "STR against Zombie A + Zombie B". With no target, the Keeper types it, captioned "STR against SIZ" (Use against Against). It takes a whole number from 0 to 999; other text turns red. Typing a number unmarks every target; unmarking the last target brings the typed number back.
2. **Use** and **Against**: each the eight characteristic tiles (the Check flyout's Tiles style). Use is what the characters put in (STR to start); Against is which value of the targets counts (STR to start). With a typed number, Against only names the typed value.
3. **The characters**: one row per character, all included to start: every selected character, then any picked with Add a character, then the helpers who joined a selected character's group (see [a player's Assist](#a-players-assist)). Each row has:
   - a narrow **target button** on the left (a crosshair, just wide enough for its icon), which marks or unmarks the character as a target;
   - the name and the value that counts;
   - a **✕** on the right, which takes the character out of the assist (the row goes until the flyout opens afresh or the picker adds them again).

   The list shows ten names before it scrolls, sized by rows so ten fit at any Panel size and font. With fewer than two characters in, a last row **⌖ Add a character** picks one with Rollbox's target picker (the next token targeted joins). A right click on a row targets that character's token, as everywhere in Rollbox.
4. **The result**: "Assisting", one line per helper (name and "−20"; "No one" when nobody helps); "Rolling", one line per roller (name and "STR 60"); then one line with "Regular STR" on the left and "90% one succeeds" on the right.
5. **Label** (optional), placeholder "Label (optional), e.g. lift the rafter".
6. The **send button**, named for the rollers ("Send to <players> (<name>)", "Send to each (N)", "Roll for <name>" / "Roll for NPCs"; "Send" while something is missing), and **Cancel**.

When something is missing or impossible, one red line takes the result's place and Send is greyed out:

| Red line | When |
| --- | --- |
| "Type the STR to beat." | The typed text isn't a whole number 0–999. |
| "Target someone, or type the STR to beat." | No target counts and the typed number is 0. |
| "Include at least one more character." | Nobody is left to take part after taking people out and marking targets. |
| "Add a character who takes part." | Nobody is in the assist at all. |
| "Too heavy even together." | No split works. |

The characteristic named in these lines is the Against one.

#### Targets

Only the target button marks or unmarks a target (and typing a number unmarks them all). A target's row is tinted coral, it takes no part, and the targets' Against values are summed into the number to beat: two zombies of STR 80 pushing a door make 160.

CoC7 creatures (actor type `creature`) start marked as targets when selected; the Keeper can unmark them. A creature deselected and selected again starts marked again. A character without the Against value isn't marked and its target button is greyed out; a marked target without the Against value stops counting until Against is switched back. A character without the Use value shows "—" and takes no part.

One character against a typed value works too: that character rolls, and the value sets the difficulty. For example, against the Fist of Yog-Sothoth, Cecil uses CON against a typed STR of 57: a Hard CON check.

#### Who helps and who rolls

Who helps and who rolls is worked out, not picked. Everyone in the assist and not a target takes part; one is enough when there is a target or a typed number.

1. Characters are sorted lowest value first.
2. For each number of helpers, from none up to all but one, the helpers (lowest first) each take their value off the number to beat.
3. A split works only when what's left stays above 0 and every remaining character can try it: what's left is no more than 100 + their value.
4. The difficulty comes from what's left: under 50 Regular, 50 or more Hard, 90 or more Extreme.
5. Of the splits that work, Rollbox uses the one with the best chance that at least one roller succeeds (each roller's chance is their value, half or fifth for the difficulty). Ties go to fewer helpers.

Nobody helping counts as a split: when everyone can try it alone and that gives the best chance, everyone rolls ("Assisting: No one"). No split works: "Too heavy even together."

The rulebook's rafter (150 against Harvey 20, Cecil 40, Martin 45, Helen 60, Belinda 75): Harvey, Cecil and Martin help, Helen and Belinda roll at Regular with 45 left, a 90% chance that one succeeds. The chance is an estimate for choosing the split: it ignores criticals, fumbles and the 01. CoC7 rolls and judges every real roll.

#### While it's open

Selecting or deselecting tokens updates the tab at once, keeping Use and Against, the typed number, who is taken out or marked, and the label. A newly selected creature starts marked.

#### Sending and the Assist card

Send asks each roller for an ordinary check of the Use characteristic at the worked-out difficulty:

- a roller with a player gets CoC7's request, whispered: "Hard STR · lift the rafter", or "STR · Assist" with no label typed;
- an NPC roller is rolled privately for the Keeper, as for any check;
- a roller who rolls from their own Rollbox panel (below) gets no chat request.

There is no Blind and there are no bonus or penalty dice: the difficulty is worked out.

When at least one roller is asked or rolled, Rollbox posts one public **Assist card**, as the sending user: "Assist", the label, "STR against SIZ: 45 left, Regular STR.", "Helping: Harvey, Cecil, Martin." (or "no one"), "Rolling: Helen, Belinda." and "One success is enough." It names neither the targets nor the number to beat, so a creature's STR stays the Keeper's. A roller who couldn't be asked isn't named on it.

The card doesn't read the rolls back: the Keeper reads the rollers' cards, as with any group check. The result under the buttons lists "Assist sent to:", "Rolled for you:", "Not sent:" with reasons, "Rolls from their Rollbox panel: <names>." and "Assist card posted."

Select only those putting their body into it, and the targets. Someone who can't help (pinned, say) is taken out with their ✕.

#### A player's Assist

A player's Other flyout has the **Assist** tab when the Keeper allows it (**Assist**). A player helps **any other character**: an investigator, an NPC or a creature. Only their own character is refused: "You can't help yourself: target who you're helping."

The player's tab, by stage:

- **Nothing yet:** "Help another character. Target who you're helping; the Keeper sets what you're up against." and one button, **⌖ Target who you're helping**. Pressed, the next token the player clicks is who they help: their current target isn't used, Rollbox turns Foundry's Target tool on for them and puts their targets back afterwards. A click on someone in Rollbox's turn order counts too. **Escape**, or pressing the button again, cancels.
- **Helping, waiting for the Keeper:** "Helping Cecil · Waiting for the Keeper", who is with them and their values ("Helen (you) STR 60"), "The Keeper sets what you're up against and who rolls.", and **Stop helping**. The investigator being helped sees "Being helped" and the helpers, without Stop.
- **Sent, a helper:** the difficulty and label, "Assisting" and "Rolling" with their values, "One success is enough", and "Cecil rolls. Nothing for you to do."
- **Sent, a roller:** the same with **Roll Hard STR**, which makes their own check at once on their client, as Make check does. It reads "Rolled" once their card is in. With two rollers, one success is enough.

A player has no number to beat, no Use or Against and no character list. Joining puts their investigator in the helped character's **group**, which the Keeper's Assist lists with that character. A player can't write another character's data, so joining and leaving go through the Keeper's client, which checks that the Player Rollbox and its Assist feature are on and that the helper is the player's own investigator.

**One way to roll each.** When the Keeper sends an assist that takes in a players' group, a roller whose player has the Player Rollbox, its Assist feature and their own Rollbox panel on gets only the panel's Roll button, no chat request. Any other roller gets CoC7's chat request.

**When the group ends.** A group is cleared:

- once every roller has rolled (their rolled check of the group's characteristic; another check, or CoC7's card not yet rolled, doesn't count);
- when the Keeper presses **Cancel** in the Assist for that character;
- when the Keeper sends a new assist for that character that leaves the group out (one that takes it in takes the place of the sent one).

There is no timer. Closing the flyout any other way keeps the group. Cleared, the helpers' panels go back to "Target who you're helping".

### Settings

Assist has no settings of its own; it follows the Other flyout and the user's own **Rollbox panel** switch (`rollboxEnabled`).

| Setting | Key | Scope | Default | What it does |
| --- | --- | --- | --- | --- |
| **Assist** (Player Rollbox, What players can do) | `rollboxPlayerAssist` | world | on | Gives players the Assist tab in their Other flyout; the Keeper's client checks it again when a player joins or leaves a group. |

#### Flags and relay messages

| Flag | On | What it holds |
| --- | --- | --- |
| `flags.keepers-rollbox.assistGroup` | the helped character (an unlinked token's own character) | The players' group: `helpers` (actor uuids) and `sent` (null, or the sent assist: Use, difficulty, label, helpers, rollers, who has rolled, when). Written only by the Keeper's client. |

| Relay message type | What it carries |
| --- | --- |
| `assistJoin` | A player's request to join a character's group (the helped and the helper). |
| `assistLeave` | A player's request to leave every waiting group. |

### Rules

- Physical Human Limits: Keeper Rulebook p. 88–89 (summary p. 407). Helpers take their value off what is to be beaten; what's left must stay within reach of the rollers (no more than 100 + their value).
- A characteristic against a fixed value sets the difficulty from that value (Keeper Rulebook p. 83, 88): under 50 Regular, 50 or more Hard, 90 or more Extreme.
- Physical Human Limits describes only STR and SIZ; Rollbox offers any characteristic for Use and Against.
- Summing several targets' values is the Keeper's ruling: the rule only describes investigators combining.

### Limits and known gaps

- The chance shown is an estimate (no criticals, fumbles or 01); CoC7 judges every real roll.
- Rollbox doesn't read the rolls back onto the Assist card; the Keeper reads the rollers' cards.
- A player can change the difficulty in CoC7's roll dialog when clicking a request; that is CoC7's normal behaviour.
- A sent group whose roller never rolls stays until the Keeper presses Cancel or sends a new assist for that character.
- A roller whose player is offline has no chat request to come back to; they roll from their panel when they log in.
- A roller who uses both the panel's Roll button and a chat request makes two cards; the group counts the first.
- Creature sheets made by other modules with another actor type aren't marked automatically; the Keeper marks them.
- Two tokens of one linked actor count as one character, so two linked "Zombie" tokens give one target; unlinked tokens are separate.
- Redrawing while the Keeper types in the label loses the focus, not the text.

### Decisions

- **Assist is a tab of Other, never greyed out, with no button of its own.** It works from any selection, with Add a character filling it when fewer than two are in.
- **Who helps and who rolls is worked out, not picked.** Rollbox takes the split with the best chance that one roller succeeds, so the Keeper doesn't do the arithmetic at the table.
- **A split with nobody helping is allowed.** When everyone can try it alone and that gives the best chance, everyone rolls.
- **Use and Against are tiles of all eight characteristics.** The rule names STR and SIZ, but other contests (CON against a grip) use the same arithmetic.
- **Targets' values are summed.** It is the Keeper's ruling for several creatures, as the rule only describes investigators combining.
- **Only the target button marks a target; the ✕ takes a character out.** One control per job keeps a stray click from changing the maths.
- **CoC7 creatures start marked as targets.** They are usually what is being pushed against; the Keeper can unmark them.
- **Requests keep a short label; with none typed they read "STR · Assist".** CoC7's link button doesn't wrap, and players see it is an assist.
- **No Blind and no bonus or penalty dice.** The difficulty is the worked-out result of the rule.
- **The Assist card names who helps and who rolls, but neither the targets nor the number to beat, and doesn't read the rolls back.** The opponent's values stay the Keeper's, and CoC7's own cards show the results.
- **A player's Assist helps any other character, never their own.** Nothing in the rules limits who can be helped (an investigator hanging on at a cliff edge, an NPC, a creature).
- **A player picks who they help with the next token they click.** Their existing target isn't used, and their targets are put back after.
- **Joining and leaving go through the Keeper's client.** A player can't write another character's data.
- **One way to roll each.** A roller with the Player Rollbox panel gets only its Roll button, so nobody gets two ways to roll the same check.
- **A group is cleared when every roller has rolled, by the Keeper's Cancel, or by a new assist, with no timer.** The group lasts exactly as long as the assist it belongs to.
- **A player's relayed check with helpers is trusted only when the helpers stand in the rollers' Assist group with the player's own investigator, or the rollers have no player.** A forged helper list can't make another player's investigator roll.

## Action flyout

### Summary

The Action flyout is where a character attacks, maneuvers or casts a spell. It has three flyout tabs, **Attack · Maneuver · Spell**, each with a target box on top. Every action goes through CoC7's own paths (its attack card, its opposed card, its spell casting): Rollbox fills in the request and presses CoC7's own controls, and CoC7 rolls, compares and applies every result.

### How it works

#### Opening the flyout and who acts

- The **Action** button sits in the menu (Action · Check · Other). It shows with one or two characters selected; with nothing selected or with three or more there is no Action button.
- With one selected, the Keeper acts for that character.
- With two selected, the first acts and the second is the target. The flyout shows "Acting <name>" and **⇅ Swap** above the target box. The second character becomes the Keeper's Foundry target, which CoC7's card reads; **Swap** switches who acts and who is the target. In this case the target box has no Change or ×.
- A player (with the Player Rollbox on and **Actions** allowed) acts only for their own investigator. See [player](#player-rollbox).

#### In combat or out of combat

"In combat" means the acting character is in the running encounter. A character outside it (one who fled, or never joined) acts as out of combat: one full Reload, no Aim, nothing waiting for a turn.

The open flyout follows the encounter. It redraws at every turn change and when someone joins or leaves, so a player's act buttons come back when their turn does.

#### Actions per round

- Each character has one action a round: an attack, Aim, a reload, a maneuver or a spell.
- **Attacks per round** (Keeper Rulebook p. 102 and ch. 14) count for NPCs and creatures only, from CoC7's Attacks per round field on their sheet (`system.special.attacksPerRound`). A dice formula counts as 1 until the Keeper rolls it. Investigators have one.
- In combat, with more than one attack a round, the Attack tab shows a small **"Attacks: 2/3"** (left / per round). With one there is no line.
- Each attack or maneuver spends one attack, and the last spends the action. A spell, a reload, Aim or any other action spends the action at once.
- The rules don't say whether a monster can attack and cast in one turn; the Keeper's Override decides.

#### Limits and the Keeper's Override

Every greyed control gives its reason on hover.

**A player:**
- After acting, each tab's content and its act buttons grey out, weapon rows included, with "You've acted this round." The tabs, that line and the last result stay clear. A greyed weapon row can be clicked to pick it for next round.
- A player can open everything at any time and prepare (pick a weapon, set up a check). In combat the act buttons wait for their turn: "Not your turn: get ready, and act on your turn."
- After diving for cover this round, the Attack tab is greyed: "Dived for cover: no attack this round." Maneuver and Spell stay open.
- While the Keeper decides a first blow (About to attack, or the First blow card), the whole flyout greys, every act button and weapon row reads "Waiting for the Keeper" and no weapon can be picked. See [combat](#combat).
- A player never gets an Override.

**Which limit shows:** only one limit line shows at a time, the first that applies in this order: waiting for the Keeper, down (unconscious, dying, dead), bout of madness, acted, restrained, dived for cover, waiting for one's turn.

**The Keeper** is limited too, with an Override:
- Once the acting character's action is spent, the Attack, Maneuver and Spell tabs' contents and act buttons are greyed, and the line reads "<name> acted this round."
- Hovering an act button brightens it and it reads **Override**. Pressing it asks "Deep One has already acted this round. Override?" **Confirm · Cancel**. Confirm lets that one action through; the next press asks again.
- The same Override covers every limit the Keeper may override (down, restrained, out of reach, acted), each with its own question ("<reason>. Override?").
- After a dive for cover the Keeper sees only the line, and nothing is greyed.

#### What a character can do

Keeper Rulebook p. 105, 108, 120–121, 156.

| State | A player | The Keeper |
| --- | --- | --- |
| **Unconscious, dying or dead** (CoC7's own conditions) | The whole menu (Action, Check, Other) greyed, the reason on hover ("Unconscious", "Dying", "Dead"); a click on their sheet opens nothing | Action greyed with Override ("Deep One is unconscious."); Check and Other stay open (a Sanity roll on waking, anything the Keeper rules) |
| **Bout of madness** (CoC7's `tempoInsane`) | The whole menu greyed: "Bout of madness: the Keeper controls you" | Acts for them as usual |
| **Restrained** (Rollbox's own status) | Attack and Spell greyed: "Restrained: you can only try to break free". In Maneuver only **Break free** is live, and the goal moves to it | The same, with Override |
| **Not held** | **Break free** greyed: "Not held: nothing to break free from" | The same, with Override |
| **A maneuver out of reach** | Every goal greyed ("Out of reach") and the button reads **Target out of reach** | The same, with Override |

- Temporary or indefinite insanity outside a bout, Prone and Major wound block nothing.
- Reach for a maneuver is measured as for Attack's melee weapons: edge to edge, the maneuver weapon's own reach if it has one (a whip's), else **Melee reach**. A token move updates it at once. Break free has no target, so reach doesn't apply to it.
- Flee, also greyed while Restrained, belongs to the turn controls: see [combat](#combat).
- The player's whole-menu greying is drawn by the panel: see [panel](#panel).

#### The target box

- **Target a token** switches to Foundry's target tool; the select tool comes back after the click. A player's existing Foundry target is used as it is (see [player](#player-rollbox)).
- A text box takes a typed target, such as "the table". A typed target is an object: CoC7's card has no target, and CoC7 may ask whether to proceed.
- A token target shows its name, its distance (edge to edge, in the scene's units) and its Build (on the Spell tab, its POW), with **Change** and **×**.
- Under it, one line per status of the target and per situation Rollbox reads from the board (point blank, firing into melee, outnumbered, a prone shooter): the name on the left, its effect for the picked weapon on the right ("Prone · Effect: 1 penalty die", "Indefinite insanity · Effect: none"), the reason on hover. The effects are in [status](#status-effects).
- A single net line ("On CoC7's attack card · 1 penalty die") shows only when there is an effect to apply. Rollbox sets those dice on CoC7's attack card: its dice slider, or CoC7's own toggle where the card has one.
- A firearm aimed at a player's character shows their dive decision: "Waiting: <name> may dive for cover", "<name> dived for cover: Under cover goes on CoC7's card" or "<name> stands their ground". The attack is never held for it.

#### Distances

One measure everywhere Rollbox shows or compares a distance (the target box, melee reach, point blank, firing into melee, the notice distance in [combat](#combat)):

- **Edge to edge:** the centre-to-centre distance less each token's half-width (gridless scenes; tokens count as circles as wide as the token), never below 0, shown in the scene's own units.
- The rulebook leaves measuring to the table (Keeper Rulebook p. 127), so this is the table's choice.
- The **Melee reach** and **Notice distance** settings are in metres and say so; the scene's feet are converted. Weapon ranges stay in yards, as on CoC7's sheets.
- CoC7's attack card shows its own distance, centre to centre, so the two can differ by the tokens' half-widths. Rollbox leaves CoC7's alone.
- **Distances follow token moves.** When the acting character's token or the target's is moved (on the drop, not during the drag), the open flyout redraws what depends on distance: the "N ft away" line, melee reach greying, point blank, firing into melee, and the distance beside CoC7's casting window. CoC7's chat cards keep the distance they show when made.

#### Attack tab: the weapon list

- **Unarmed** first, always; then the sheet's weapons A–Z, with the skill CoC7's card uses and its values, range (a gun) or damage, and ammo ("4/6", red when empty). Maneuver weapons other than the Punch are listed under Maneuver.
- **Reach:** a melee weapon farther than its reach is greyed, with "Out of reach" on its second line (hover: "Out of reach (more than 1 m)"). Reach is the **Melee reach** setting (default 1 m, edge to edge) for fists, knives and touch weapons. Unarmed counts as melee.
- A melee weapon with a range of its own reaches that far instead: a weapon on a Fighting skill that CoC7 marks Ranged, as its compendiums carry the bullwhip (10 ft) and mace spray (6 ft). Its range is read in yards as CoC7 does ("10/3", "@STR/5"). CoC7 makes its ranged card for these two.
- A weapon CoC7 doesn't mark Ranged has its range field ignored, as CoC7's melee card does (imported NPC sheets often hold a skill value there).
- **The picked weapon's row** has a full border and a slightly lighter background in every theme, and spells out its details with labels: Skill with its values; Damage and Range; Attacks per round and Ammunition ("Ammunition 0/8"). A part CoC7 leaves empty is left out.
- **+ Improvised weapon** last: a labelled skill check, as the Other flyout's Item tab (see [other flyout](#other-flyout)).

#### Attack tab: picking and putting away a weapon

- The picked weapon is saved on the character (flag `pickedWeapon`) and is free to switch; after acting the line reads "Switched to X for next round." It is cleared when combat ends.
- The picked weapon clicked again is put away (nothing picked).
- In a running encounter, with CoC7's Draw gun on and a firearm picked, putting the gun away or switching to a weapon with no readied bonus asks first: "Holstering puts <name> back to their DEX in the turn order (<from> → <to>). Holster?" or "Switching to <weapon> puts … Switch?" Cancel changes nothing. The turn-order drop itself is in [combat](#combat).
- With no encounter running, picking a real weapon of an investigator or NPC is a weapon drawn: the Keeper's weapon-drawn pop-up comes up above the hotbar (see [combat](#combat)). The Keeper's line says "Drawn out of combat: the weapon-drawn notice is above your hotbar."; a player sees nothing of it. Never for the unarmed weapon or a creature. In combat drawing brings up nothing.

#### Attack tab: making the attack

- **Attack** makes CoC7's own attack card (CoC7's `actor.weaponCheck`, the same call as its sheet). Rollbox rolls no dice of its own.
- A melee attack needs a target (a token or a typed one), so Rollbox's Attack always makes CoC7's melee attack card.
- **Rolled at once:** on the client that makes the card, after setting the card's toggles, Rollbox presses CoC7's own roll button (melee `attackerRoll`, ranged the target's roll):
  - an NPC's or creature's attack by the Keeper, with **Roll NPC attacks at once**;
  - an investigator's attack by the Keeper, with **Roll investigators' attacks at once**;
  - a player's own attack, with their personal **Roll my attacks at once**.
- A multi-shot needs no roll press: CoC7's bottom Shoot already rolls every shot.
- A player's toggles are Keeper-only on CoC7's card, so the Keeper's client sets them and the player's Rollbox presses Roll once it sees them set on the card. It gives up quietly after 15 seconds; the player can press Roll.
- CoC7's Keeper-only **Automatic Success** on its melee card is a toggle, not a result.
- If a toggle can't be set within 15 seconds, the Keeper is told what is left: "Rollbox: set Aiming, … on CoC7's attack card before Roll."
- **No encounter running, a token target:** the Keeper's **About to attack** pop-up comes first (see [combat](#combat)). Meanwhile the flyout says "About to attack: answer the pop-up above the hotbar." (a player's: "Waiting for the Keeper…") and nothing is rolled. Surprised adds "Cecil is surprised: automatic hit, no response." (or one bonus die); Ignore reads "Ignored: this attack starts no combat." The attack is then the first blow.
- The result line reads "CoC7's attack card made for Switchblade: press Roll on it." or "…: rolled at once."; a failure reads "No attack card: <reason>."

#### Attack tab: unarmed and unlinked weapons

- **No unarmed weapon on the sheet:** the Keeper's prompt "Cecil has no unarmed attack. Add **Punch** to Cecil's sheet?" **Add · Cancel**. Add puts a copy of CoC7's own Punch (CoC ID `i.weapon.brawl`) on the sheet, linked to the character's Fighting (Brawl) as CoC7 links a weapon it adds itself, and carries on with the attack. The Punch stays on the sheet. Cancel changes nothing.
- A creature's copy is named **Fighting**, on the skill its attacks use; the prompt asks which when Rollbox can't tell.
- A player is told "Your sheet has no Punch. Ask your Keeper to add it." Rollbox never puts an item on a sheet without asking.
- A Punch with Maneuver switched on counts as the unarmed weapon: it serves Attack and Maneuver both.
- **An unlinked skill:** an unarmed or maneuver weapon whose skill CoC7 can't find on the sheet would get a CoC7 card with no roll button. The Keeper gets "Punch has no skill on Cecil's sheet, so CoC7's card can't roll. Link it to Fighting (Brawl)?" **Fix · Cancel**.

#### Attack tab: Aim, reloading and multi-shot

**Aim** (in combat only, for a gun): uses the turn; the next shot, next round, gets CoC7's Aiming, which ends once that shot is made. Out of combat there is no Aim, because there are no rounds.

**Reload buttons:**
- Out of combat a gun that isn't full (empty included) shows **Reload** beside Attack: one full reload (CoC7's own `reload()`). It doesn't spend the action.
- In combat a gun that isn't full gets a **Reload line** of its own under the Attack line, with what each costs under its name:

| Button | Gun | What happens |
| --- | --- | --- |
| **Reload 2 rounds** ("Reload 1 round" when only one fits) | Revolver, rifle, shotgun | Two rounds (CoC7's `addAmmunition()` twice, as two clicks on the ammo on its sheet). Uses your turn |
| **New magazine** | Magazine weapon | A new clip or magazine (CoC7's `reload()`). Uses your turn |
| **New belt** | Machine gun | CoC7's `reload()`. Takes 2 turns (the Keeper's to keep) |
| **Load one and fire** | Any gun not full | One round, then the attack with Reloading ticked ("1 penalty die") |

- There is no full reload of a revolver in one round.
- Reload stays live while Attack is greyed for an empty gun.

**How a weapon loads** (CoC7 keeps no field for it), in order:
1. Rollbox's flag on the weapon, `reloadKind` (`magazine` | `rounds` | `belt`).
2. The weapon's CoC ID in Rollbox's table of every firearm in CoC7's and the Keeper items' compendiums, set from the rulebook's weapon tables (a Lewis gun or BAR takes a magazine though its skill is Machine Gun; a Garand an en-bloc clip).
3. The name rule: a Machine Gun skill takes a belt; a submachine gun, assault rifle, burst or full auto a magazine; a handgun a magazine unless named Revolver, Derringer or Flintlock; rifles and shotguns two rounds.
4. Anything left unclear (a custom gun whose name says neither way) is asked in the [setup check](#setup-check).

A kind the table or the name rule is sure of is saved on the weapon the first time Rollbox reloads it, or at the setup check. There is no per-weapon control in the panel.

**The reload card:** every reload through Rollbox (Reload, New magazine, New belt, the round of Load one and fire) posts Rollbox's own card, "Cecil reloads his .38 Revolver (6/6).", with the rounds loaded and the capacity. It is spoken by the character and whispered to the Keepers and the character's players; the Keeper can share it from chat. "His" or "her" comes from the sheet's Sex field, else "their".

**Multi-shot:** a gun CoC7 lets fire more than once a round (its attacks per round, at most, above one: CoC7's Multi. Shots) gets **Fire: Single shot · Multi-shot**.
- Multi-shot adds **Shots 1 · 2 · 3…** up to that number, starting at the most the gun can fire with the rounds loaded; those beyond the rounds loaded are greyed.
- Attack makes CoC7's ranged card, Rollbox sets its toggles as usual, turns on CoC7's **Multi. Shots**, presses the target's **Shoot** once per shot (each press only puts one shot on the card) and then the card's bottom **Shoot**. CoC7 rolls every shot at once, with its own penalty die on each, and spends the rounds.
- One shot is a single shot.
- A player's multi-shot is fired by their own client (CoC7 gives the card's owner those buttons), or by the Keeper's when Keeper-only toggles must be set first, so every shot comes after them.

#### CoC7 toggles Rollbox sets

On the attacker's card Rollbox sets Keeper-only controls CoC7 offers, one per card redraw, the way the Keeper would click them. For a player's attack the Keeper's Rollbox sets them.

| Toggle | When |
| --- | --- |
| Aiming | The shot after Aim |
| Reloading | Load one and fire |
| Under cover | The target dived for cover |
| Point blank | Within a fifth of the shooter's DEX in feet, edge to edge, and CoC7 didn't tick it |
| Point blank off | A mace spray (CoC ID `i.weapon.mace-spray`, or named "mace spray"): Rollbox takes CoC7's own Point blank tick off, because mace spray never gets it (p. 406) |
| In melee | Firing into melee: the target is within melee reach of another combatant who isn't the shooter |
| Outnumbered | Melee: the target has dodged or fought back this round as often as it attacks per round (counted from CoC7's answered defender cards) |
| Automatic success | Melee, a surprised target with the Keeper's automatic hit (see [combat](#combat)) |
| The dice slider | The net bonus or penalty dice from the target box, within CoC7's two either way |

- CoC7 ticks its own Point blank when it makes the ranged card, measuring centre to centre (DEX / 15 yards). Rollbox measures edge to edge and ticks it only when CoC7 didn't, so it never undoes CoC7's tick (except for mace spray).
- CoC7's card sets range difficulty, the target's size (Build −2 or less, 4 or more), multiple handgun shots and automatic fire itself, so Rollbox doesn't.
- Half concealed and a fast-moving target stay the Keeper's call, on CoC7's own toggles.
- The automatic toggles follow the **Gameplay rules** switch.

#### Maneuver tab

A maneuver runs on **CoC7's own opposed card in combat mode** ("Attack Maneuver"), the card CoC7 runs a maneuver on, driven step by step:

1. **Pick:** the goal (six buttons in two rows of three: Restrain, Knock down, Disarm, Push away, Break free, Knock out), the maneuver weapon (a row each when there are several) and a token target. The weapon's skill and values show ("Punch · Fighting (Brawl) 45 · 22 · 9"), and with a token the Build line ("0 vs 2 · 2 penalty dice", or "Impossible: the target is 3 or more Build bigger").
2. **Attempt:** the button names the goal (**Attempt to restrain**, Attempt to knock down, to disarm, to push away, to break free, to knock out). Rollbox posts its **notice** in chat, public, spoken by the attacker: "Cecil attempts to push away (maneuver) Deep One Hybrid." ("break free from" for Break free). With no encounter running, the Keeper's About to attack comes first, as for Attack.
3. **The target answers** on the being-attacked alert: **Dodge · Fight back · Counter · No response**. Their player answers on their screen; the Keeper answers for a target no player answers for. See [alert flyout](#alert-flyout-being-attacked).
4. **No response:** no opposed card. CoC7 rolls the attacker's maneuver skill alone, with the Build dice, on its own check card. A success means the maneuver works.
5. **The card:** the Keeper's client makes CoC7's opposed card through CoC7's own call, both sides filled in with CoC7's roll format. The attacker's side is the maneuver weapon (CoC7 reads its Maneuver switch, so a win reads "Cecil maneuver was successful.") with the **Build penalty dice**. The defender's side is their Dodge, the melee weapon they fight back with, or their own maneuver weapon for a Counter (with their own Build dice). CoC7 makes the first side attacker and the second defender.
6. **Start Rolls:** Rollbox presses CoC7's **Start Rolls**. CoC7 rolls at once every side with no player online. A player who answered has their own row's Roll dice pressed by their Rollbox, so the answer is one click. An attacker whose player is online rolls their own row on CoC7's card.
7. **Ties:** when CoC7 offers Advantage: Attacker / Advantage: Defender (a tie with a success), Rollbox presses the one the rules give: after a Dodge, the defender; after Fight back or Counter, the attacker.
8. CoC7 compares and prints the ending ("<name> maneuver was successful.", "<name> dodged!", "<name> landed a blow.", "Both side failed.").

A player's answer and a player's Start Rolls go through the Keeper's client, because CoC7's Start Rolls and Advantage are Keeper-only.

**Build dice** (Keeper Rulebook p. 105): one penalty die per point of Build the target has over the attacker; impossible at three or more. CoC7 shows Build on the card but never applies it, so Rollbox puts the dice on the attacker's row.

**Fight back with a Maneuver-on weapon:** when the defender fights back with a weapon that has Maneuver on (a Punch), it goes on CoC7's card as the weapon. Rollbox switches the weapon's Maneuver off (CoC7's own toggle) just before making the card and back on as soon as the card exists. CoC7 reads Maneuver once, when it adds the row, so the card treats the Punch as an ordinary weapon: a win reads "<name> landed a blow." with **CoC7's own Roll damage**, which makes CoC7's damage card with the loser as the target, as for a knife. Rollbox never presses Roll damage.
- The switch back is always made, also on an error. While the switch is off Rollbox notes it in a flag on the weapon (`maneuverOff`); any weapon left noted is switched back on when the Keeper's world loads and at the setup check.

**The maneuver weapon** is a weapon with CoC7's Maneuver switched on, in this order: a creature's own "(mnvr)" attacks, then the **Punch with Maneuver on** (a creature's Fighting), then any Maneuver (Brawl) or Maneuver (Fighting) item on the sheet (never deleted; it works as a maneuver weapon).
- With none, the Keeper's prompt reads "Switch Maneuver on for Cecil's Punch?" **Switch on · Cancel** (the same change as CoC7's Maneuver toggle on the weapon sheet; it stays on), or with no Punch at all "Add **Punch** to Cecil's sheet? Its Maneuver is switched on." **Add · Cancel**.
- A player is told "Your Punch has Maneuver off. Ask your Keeper to switch it on." (or "Your sheet has no Punch. Ask your Keeper to add it.").
- A Punch with Maneuver on is the unarmed weapon for Attack too, where CoC7's melee attack card ignores the switch.

**After the maneuver:**
- A maneuver is the character's action for the round, like an attack or a reload.
- The goal's effect is the Keeper's to apply.
- After a Restrain the Keeper gets **Set Restrained: <target>** under the result, to press when CoC7's card shows the maneuver succeeded. It then reads "<target>: Restrained", greyed. See [status](#status-effects).

#### Spell tab

- The caster's MP ("MP 10/12") and each spell A–Z, with its casting time and costs as written ("1 round · MP 5 · SAN 1D6"). A spell with no CoC7 cost list reads "Costs aren't automatic: take them by hand."
- **Cast** and **Cast hidden** are CoC7's own (`item.system.cast`): CoC7 asks its own questions, takes the costs and posts its card. Cast hidden is the Keeper's only, also when acting for an investigator; a player's Spell tab shows just **Cast**, as Blind is the Keeper's on checks.
- After a cast with a token target, **Opposed POW with target** sends an opposed card, POW against POW. Spell targets are optional.
- Rollbox works out no magic-point or range cost and blocks nothing.

**Spells in combat:** in combat the tab lists only spells **instantaneous or cast in 6 rounds or fewer** (worst case), CoC7's Combat spells first. Out of combat every spell shows. The list is read step by step from CoC7's casting-time field, never the description:

| Casting time | In combat |
| --- | --- |
| Empty | Unknown: hidden |
| "preparation" or "apply" (casting makes doses the character carries as an item: Powder of Ibn-Ghazi, Dust of Suleiman) | Hidden |
| "instant" | Shown |
| Minutes, hours, days, weeks, months, years | Hidden |
| "round": the worst case of every number (a range's top; dice as count × sides + extra: 1D3 = 3, 1D6+4 = 10) | Shown at 6 or fewer, hidden above |
| Open-ended ("5+ rounds") or anything else | Unknown: hidden |

- There is no "Casting time unknown" group. CoC7's Combat tick doesn't override the reader.
- The verdict is kept per spell and read again when its casting time changes.
- To try a hidden spell in a fight, cast it from the character sheet.
- With no spells: "No spells on Alice's sheet."; in combat with none fast enough: "No spell on the sheet can be cast in a fight (6 rounds or fewer)."

**First casting:**
- A spell an investigator hasn't cast yet has a red outline and the tooltip "First casting: Hard POW check needed".
- After CoC7's cast, Rollbox requests a Hard POW check (Keeper Rulebook ch. 9; NPCs never roll it).
- When CoC7's card for that check comes back a success, Rollbox marks the spell as cast itself (flag `castSpells`), reading CoC7's result as Dive for cover does. A failure leaves it uncast. Rollbox stops watching after 10 minutes.
- **Mark <spell> as cast** stays for the Keeper as a fallback. A player never gets it.

**Spell text:**
- **Spell text in the Spell tab**: the spell's full CoC7 description, never cut, in a box beside the flyout, on hover, on click, or off.
- **Show a spell's text while casting**: while CoC7's casting window is open for a spell cast from Rollbox, Rollbox's own box beside it shows the description and the target's distance ("Target: <name>, 6 ft away"). CoC7's window isn't changed, and the box closes with it.
- A cast from CoC7's own sheet gets no box, because CoC7's window doesn't say which spell it is for.

### Settings

| Setting | Key | Scope | Default | What it does |
| --- | --- | --- | --- | --- |
| **Melee reach (m)** | `rollboxMeleeReach` | world | 1 | How close, in metres edge to edge, a target must be for a melee weapon (1 to 10, step 0.5). Also the distance for firing into melee. Gameplay rules section, Melee group |
| **Roll NPC attacks at once** | `rollboxAutoRollNpc` | world | on | Rollbox presses the roll button on CoC7's attack card for an NPC's or creature's attack the Keeper makes. Gameplay rules section, Rolling group |
| **Roll investigators' attacks at once** | `rollboxAutoRollAttacks` | world | on | The same for an investigator's attack the Keeper makes. Gameplay rules section, Rolling group |
| **Roll my attacks at once** | `rollboxRollMyAttacks` | personal | on | A player's own attacks through their Rollbox are rolled at once. Player Rollbox section, Each player's own group |
| **Spell text in the Spell tab** | `rollboxSpellTextTab` | personal | On hover | On hover · On click · Off. Rollbox panel section, Menus group |
| **Show a spell's text while casting** | `rollboxSpellTextCasting` | personal | on | The spell's text and the target's distance beside CoC7's casting window. Rollbox panel section, Menus group |
| **Actions (attacks, maneuvers, spells)** | `rollboxPlayerActions` | world | on | Whether players get the Action flyout. Player Rollbox section; see [player](#player-rollbox) |

#### Flags

| Flag | On | What it holds |
| --- | --- | --- |
| `pickedWeapon` | Character (a token's own actor for an unlinked token) | The picked weapon's item id, or `"unarmed"`. Cleared when combat ends |
| `castSpells` | Character | Item ids of spells the investigator has cast (no more first-casting roll) |
| `reloadKind` | Firearm item | `magazine` · `rounds` · `belt` |
| `maneuverOff` | Weapon item | Set while Rollbox has switched the weapon's Maneuver off for a fight back |
| `maneuver` | Chat message (the maneuver notice) | Attacker, target, weapon, goal, the answer, the defence weapon and CoC7's card id |

The relay message type `maneuver` carries a player's answer to the Keeper's client.

### Rules

- Attacks per round: NPCs and creatures from their sheet; investigators one (Keeper Rulebook p. 102, ch. 14).
- Fighting maneuvers: Build penalty dice, impossible at three or more Build bigger; the goals (p. 105).
- Ties on a maneuver: a dodger wins a tie; fighting back or countering, ties go to the attacker.
- Point blank: a fifth of the shooter's DEX in feet, one bonus die (p. 113, summary p. 409); never for mace spray (p. 406).
- Firing into melee: one penalty die (p. 113). Outnumbered: one bonus die once the target has used its defences this round (p. 108).
- Aiming: the next shot gets one bonus die (p. 113).
- Reloading: two rounds a round into a revolver, rifle or shotgun; a new magazine uses the turn; Load one and fire with one penalty die (p. 113, summary p. 410).
- Measuring distance is left to the table (p. 127).
- What a down, mad or restrained character can do (p. 105, 108, 120–121, 156).
- First casting of a spell: a Hard POW check (ch. 9).

### Limits and known gaps

- The weapon-drawn and About to attack pop-ups, the first blow and the turn order are combat's: see [combat](#combat).
- CoC7 asks "proceed without a target?" for a typed (object) target unless its own world setting says otherwise.
- CoC7's attack card shows its own centre-to-centre distance, which can differ from Rollbox's edge-to-edge one.
- CoC7 posts its attack cards with no speaker, so they show the user's name (the Keeper's for an NPC), whether started from Rollbox or from CoC7's sheet. CoC7's attack cards are silent, whether CoC7's own button or Rollbox presses it.
- CoC7 offers **Roll damage** after a won maneuver with a weapon. A maneuver does no damage, so the Keeper closes the card; Rollbox doesn't press it.
- No response's check card is CoC7's plain skill check: it doesn't name the maneuver.
- A belt takes two rounds; Rollbox reloads it at once and leaves the second round to the Keeper.
- Thrown weapons and bows are ranged in CoC7, so Rollbox treats them as firearms for point blank and firing into melee.
- A casting time written in other words or another language reads as unknown and is hidden in combat.

### Decisions

- **The Keeper is limited too, with an Override.** Once an action is spent the tabs grey for the Keeper as for a player, and one Override button lets a single action through, so the Keeper is reminded but never blocked.
- **One action per round for a player, act buttons waiting for their turn.** A player can open and prepare everything at any time, so their turn goes quickly.
- **Diving for cover takes only the next attack.** The Attack tab greys after a dive; Maneuver and Spell stay open.
- **Two selected means one acts on the other.** The first acts and the second is the target, with Swap; three or more have no Action, because an action is one character's.
- **Rollbox rolls no attack dice.** Attack makes CoC7's own card and presses its roll button at most, as a person would.
- **Attacks are rolled at once by default.** NPC, investigator and each player's own attacks have their own switch, so each table chooses.
- **Nothing goes on a sheet without the Keeper's yes.** A missing Punch, Fighting, maneuver switch or skill link is asked for, names exactly what changes, and stays on the sheet once there; a player is told to ask their Keeper.
- **One unarmed weapon for Attack and Maneuver.** A Punch with Maneuver on is both, so a sheet needs no separate maneuver item.
- **Maneuvers run on CoC7's own opposed card.** It is the card CoC7 runs a maneuver on, so CoC7 compares and words the result; Rollbox only fills in the sides, the Build dice, Start Rolls and the tie's Advantage.
- **Maneuver dice are penalty only.** The rules give a bigger attacker nothing.
- **Fight back with a Punch goes on the card as a weapon.** Switching Maneuver off while CoC7 makes the card lets CoC7's own Roll damage target the loser; the switch is always put back.
- **A maneuver notice counts only from a GM or a player of the attacker.** Anyone can post a chat message, so this stops a forged notice.
- **Melee attacks need a target, and Rollbox always makes CoC7's melee card for them.**
- **Melee reach defaults to 1 m, edge to edge.** Unarmed counts as melee; a melee weapon CoC7 marks Ranged (a whip, mace spray) reaches its own range.
- **One distance measure everywhere: edge to edge, in the scene's units.** The rulebook leaves measuring to the table, and it follows token moves.
- **Point blank is ticked only when CoC7 didn't, and never for mace spray.** CoC7 measures centre to centre; Rollbox fills the gap without undoing CoC7.
- **Rollbox sets only the toggles CoC7 doesn't set itself.** Range, size, multiple handgun shots and automatic fire are CoC7's; half concealed and a fast-moving target stay the Keeper's call.
- **Reloading follows the rulebook.** Out of combat one full reload; in combat two rounds, a new magazine or a belt, using the turn; Load one and fire.
- **How a gun loads comes from a flag, a CoC ID table and a name rule, then the setup check.** CoC7 keeps no field for it, and the panel has no per-weapon control.
- **Every reload posts a whispered reload card.** The Keeper and the character's players see the rounds loaded.
- **Multi-shot uses CoC7's own Multi. Shots and Shoot buttons.** CoC7 rolls and spends every shot.
- **In combat, only spells of 6 rounds or fewer.** The casting time is read step by step; anything unclear or open-ended is hidden in combat, with no "unknown" group.
- **First casting marks itself.** Rollbox marks the spell cast when CoC7's Hard POW card comes back a success; **Mark as cast** is the Keeper's only fallback, so a player can't skip the roll.
- **Cast hidden is the Keeper's only**, as Blind is on checks.
- **A spell's text shows beside the flyout and beside CoC7's casting window**, only for a cast started from Rollbox, and Rollbox works out no cost.
- **The picked weapon clicked again is put away; a drawn gun asks first.** Holstering or switching in a fight can cost the readied-firearm place, so the player is warned.

## Alert flyout: being attacked

### Summary

When a character is attacked, whoever answers for them sees a red alert flyout with the defender's choices, each answered in one click. A player sees it for their own investigator; the Keeper sees it for NPCs and creatures, and for any target no player answers for. Rollbox only reads CoC7's cards and presses their own buttons, as the player or the Keeper could.

### How it works

#### Who sees it

- **A player** sees the alert when a CoC7 attack card, or Rollbox's maneuver notice, names their own investigator as the target. It needs the Player Rollbox on and the player's own Rollbox switch on. The alert comes with the Player Rollbox: it has no player feature switch of its own.
- **The Keeper** sees the melee alert whenever an NPC or creature is the target of CoC7's melee attack card, in or out of combat: "Deep One is being attacked".
- **The Keeper** sees the maneuver alert for a target no player answers for: an NPC, an investigator whose players are all offline, an investigator whose online owner doesn't have them assigned, or any target while the Player Rollbox is off: "Deep One Hybrid is being attacked".
- Each Keeper sees the Keeper's alerts; the first answer wins.
- The alert sits beside the menu in the panel. Without a panel showing, it appears in Rollbox's own box above Foundry's players list, in the user's Theme.
- A target the Keeper ruled **surprised** (About to attack, see [combat](#combat)) gets no alert at all. The active Keeper's Rollbox answers **No response** for them (with one bonus die on a maneuver when the Keeper picked it). With Automatic hit CoC7 makes no defender card, so nothing is pressed.

#### Melee

Once CoC7's defender card is posted: **"You are being attacked"**, a × that closes it, "Cultist of Dagon attacks Helen.", and **Dodge · Fight back · Counter · No response** in one row. Counter is a counter-maneuver; No response is CoC7's own.

Each answer presses CoC7's own choice on the defender card and then CoC7's roll button there, as the player would:
- **Dodge** and **No response** roll at once. Dodge is greyed without a Dodge skill, as on CoC7's card.
- **Fight back** lists the melee weapons CoC7's own Fight back lists (melee weapons whose skill is on the sheet, the unarmed weapon first). A pick chooses it in CoC7's list and rolls.
- **Counter** lists the maneuver weapons (the Punch or Fighting (Brawl) first and picked by default, a whip or other weapon with Maneuver on after it; the list shows with two or more), then the six goals with the Build line. A goal chooses the weapon's fighting skill in CoC7's Maneuver list and rolls. Another Fighting specialization may serve: the Keeper's call (Keeper Rulebook p. 105).
- **The Build line:** one penalty die per point of Build the defender is below the attacker ("Build: 1 penalty die.", "Build: no penalty dice."). Three or more below: "Build: they are 3 or more bigger; a maneuver can't move them.", and the goals are greyed. An unknown Build reads "Build: unknown, the Keeper decides the dice."
- The goal is the Keeper's to apply; Rollbox doesn't send it.
- Opening one answer's options closes the other's.
- An answer greys the buttons ("Dodge: rolling on CoC7's card…"). If CoC7's card doesn't show the choice within 15 seconds, the line says to roll on CoC7's card and the buttons come back.

The Keeper's melee alert for an NPC or creature works the same way, titled "<name> is being attacked". Monsters normally fight back rather than dodge (Keeper Rulebook p. 105, ch. 14).

#### Maneuver

Once Rollbox's maneuver notice is posted (see [action flyout](#action-flyout)): the same title and the same four answers, with the notice's sentence under it ("Cultist of Dagon attempts to restrain (maneuver) Helen.").

- **Dodge** answers with the defender's Dodge.
- **Fight back** opens one button per melee weapon (the unarmed weapon first, then the rest A–Z). A weapon with Maneuver on goes on CoC7's card as the weapon, its Maneuver switched off while CoC7 makes the card, so a win reads as a blow with CoC7's Roll damage.
- **Counter** opens the maneuver weapons (the Punch first and picked) and the goals with the Build line; the goals are greyed when the Build makes a maneuver impossible.
- **No response** lets CoC7 roll the attacker's maneuver alone, on its own check card.

The answer makes CoC7's opposed card, always through the Keeper's client. On a player's screen the alert reads "Dodge: CoC7's opposed card is in chat; your side is rolled once the Keeper starts the rolls.", and once Start Rolls has run the player's Rollbox presses their own row's roll. The Keeper's alert reads "CoC7's opposed card is in chat, Start Rolls pressed." A refusal ("No card: <why>.") puts the buttons back.

#### Shot at

Before the shot is rolled: **"You are being shot at"**, a ×, "Cultist of Dagon is shooting at Helen.", "Dive for cover: a Dodge roll. On a success the shooter gets 1 penalty die and you lose your next attack.", and **Dive for cover** (highlighted) · **Stand your ground**.

- **Dive for cover:** CoC7 rolls the character's Dodge at once (one click). On a success the character is marked **Dived for cover** in combat's round notes, loses their next attack, and the Keeper's Rollbox ticks **Under cover** on the shooter's card (a toggle CoC7 offers the Keeper only).
- With no encounter running nothing can be noted, and the line asks the player to have the Keeper tick Under cover.
- The line then reads "You dived for cover: the shooter gets 1 penalty die. You lose your next attack.", "The dive failed: the shot comes as it is.", or asks the Keeper when no Dodge roll came back.
- **Stand your ground** notes it (round-note field `stood`) and closes the alert.
- The shooter's Action flyout shows the decision (waiting, dived, stood their ground) and doesn't hold the attack for it. Other parts hear of it through the hook `keepers-rollbox.diveDecision`.

#### Nothing to fight back or counter with

- **Fight back** with no weapon to list stays clickable, with "No weapon" on hover.
- **Counter** with no maneuver weapon stays clickable, with "No maneuver weapon" on hover. On the melee alert, which counters with CoC7's list of fighting skills, this happens only when CoC7 has no fighting skill to list.
- A press brings the Action flyout's own question into the alert, for the Keeper:
  - Fight back: "Deep One has no weapon to fight back with. Add **Punch** to its sheet?" (a creature's **Fighting**). **Add** puts CoC7's Punch on the character's Fighting (Brawl), or a creature's Fighting, and fights back with it.
  - An unarmed weapon whose skill CoC7 can't find: "Link it to Fighting (Brawl)?" **Fix**.
  - Counter: "Switch Maneuver on for Cecil's Punch?" or "Add **Punch** to …'s sheet? Its Maneuver is switched on." The goals then open with that weapon.
  - **Cancel** changes nothing.
- For a player: "Your sheet has no weapon to fight back with. Ask your Keeper to add a Punch." (Counter: "Your Punch has Maneuver off. Ask your Keeper to switch it on.", or the add line).
- Nothing goes on a sheet unless the Keeper presses Add, Fix or Switch on.

#### When the alert closes

- **Melee:** when CoC7's defender card is answered.
- **Maneuver:** the one who answered keeps the alert, to read where to roll. It closes on every client as soon as CoC7's opposed card has its result (every side rolled, any outcome, both failed included, and also when the Keeper's Start Rolls rolled both sides at once). It closes on every other screen as soon as the notice is answered. **No response** closes it at once.
- **Shot at:** when the shot is rolled, or on Stand your ground.
- Always: on its ×, and when the card or notice is deleted. An alert closed with × isn't drawn again for that card.

### Settings

None of its own. The alert follows the **Player Rollbox** switch (`rollboxPlayerRollbox`) and, on a player's client, their own Rollbox switch (`rollboxEnabled`). With the Player Rollbox off, the Keeper answers every maneuver.

#### Flags

| Flag | On | What it holds |
| --- | --- | --- |
| `roundNotes.stood` | Character (combat's round notes) | The character stood their ground against a shot this round |
| `roundNotes.dived` | Character (combat's round notes) | The character dived for cover this round (see [status](#status-effects)) |

The hook `keepers-rollbox.diveDecision` is called with `(actor, decision)`: `"dived"`, `"stood"`, `"pending"` or null. The maneuver notice's flag and the relay type `maneuver` are in [action flyout](#action-flyout).

### Rules

- Monsters normally fight back rather than dodge (Keeper Rulebook p. 105, ch. 14).
- Ties: a dodger wins a tie; fighting back, ties go to the attacker.
- Both sides failing against a Dodge means nothing happens (p. 408; CoC7's "Both side failed.").
- Counter-maneuver Build dice: one penalty die per point of Build below the attacker; impossible at three or more (p. 105).
- Dive for cover: a Dodge roll; on a success the shooter gets one penalty die and the diver loses their next attack (p. 113).
- Luck may be spent on a player's own combat roll under the optional rule (p. 99), on CoC7's card as CoC7 offers it; Rollbox adds nothing.

### Limits and known gaps

- CoC7's Fight back and Maneuver lists open beside the card's copy in the chat log. With the chat log not drawn, the line says to choose on CoC7's card.
- A player who reloads their page while a maneuver notice waits doesn't see its alert again; the Keeper can answer from theirs only if the player is offline.
- Two Keepers answering the same notice in the same instant could both pass.
- CoC7 shows two dodge messages for a dodge (its defender card and its "dodged!" card); both are CoC7's and Rollbox removes nothing.
- A creature with no fighting skill at all gets a weapon CoC7 can't list; the line says to answer on CoC7's card.
- A second Dodge rolled by the same player during a dive's wait would be read as the dive's.

### Decisions

- **One click answers an attack.** Each answer presses CoC7's own choice and then its roll button, as the player would.
- **The alert comes with the Player Rollbox.** It has no feature switch of its own.
- **The Keeper answers NPCs and creatures in melee, in and out of combat,** on the same alert, so the Keeper doesn't hunt for CoC7's defender card.
- **The Keeper answers a maneuver for any target no player can.** That includes an investigator whose online owner doesn't have them assigned, because otherwise nobody would answer and CoC7's card would never be made.
- **The melee alert's answers are Dodge · Fight back · Counter · No response.** Counter stays as it is while CoC7 has a fighting skill to counter with.
- **Fight back and Counter with nothing on the sheet stay clickable and ask.** The Keeper gets the Action flyout's own Add or Switch on question; a player is told to ask their Keeper.
- **A maneuver's alert closes once CoC7 has the result,** on every client and whatever the outcome; No response closes it at once.
- **Dive for cover is decided before the shot, and the shot is never held for it.**
- **A surprised target gets no alert and makes no response.** The Keeper's About to attack decision stands.
- **What the Keeper's Rollbox does by itself happens on Foundry's active Keeper only.** Ticking Under cover after a dive and answering for a surprised target happen once, however many Keepers are online.

## Status effects

### Summary

Rollbox shows the state a character is in as small status cards above the character sheet, and shows each status's effect on an attack in the Action flyout's target box. It reads CoC7's own conditions and only sets the states its own actions cause: Aiming, Dived for cover and Restrained.

### How it works

#### The status cards

- A character's statuses show as small cards stacked above the character sheet, one card per status.
- They show only when one full character sheet shows: one character selected, the full card in the Keeper's combat panel, or a player's own character on their panel.
- In combat the cards follow the full card: the current turn's, unless the Keeper selected another combatant, whose card is then the full one. See [combat](#combat).
- Never on the two-character sheet, the character cards or the turn order's rows. The sheet itself doesn't change size or place.
- Top to bottom: Rollbox's own states, then the others, then the serious ones nearest the sheet.
- Hovering a card shows its name in bold and what it means, with the Keeper Rulebook page, and no "set by" line. A player looking at their own character reads "you" in Aiming and Dived for cover.
- The cards are drawn by the panel: see [panel](#panel).

#### The statuses

| Status | Kind (colour) | Where it comes from | Hover text says |
| --- | --- | --- | --- |
| Dying | serious | CoC7's condition | 0 HP with a major wound; a CON roll at the end of each round or they die; First Aid stabilises (p. 121) |
| Unconscious | serious | CoC7's condition | Can't act or defend; attacks only miss on a fumble (p. 108) |
| Major wound | serious | CoC7's condition (`criticalWounds`) | Half max HP or more in one hit (p. 120) |
| Dead | serious | CoC7's condition | Out of the fight |
| Prone | other | CoC7's condition | Melee 1 bonus die against them; firearms 1 penalty die (not at point blank); shooting while prone 1 bonus die (p. 127–128) |
| Restrained | other | Rollbox's note on the character | Held until they break free with a maneuver of their own (p. 105) |
| Bout of madness | other | CoC7's condition `tempoInsane` | Temporary insanity: the Keeper decides what the character does (p. 156) |
| Indefinite insanity | other | CoC7's condition `indefInsane` | Lasting insanity; the Keeper's call (p. 158) |
| Aiming | Rollbox (marked "Rollbox") | Combat's round notes | The next shot gets 1 bonus die; lost if they move or take damage (p. 113) |
| Dived for cover | Rollbox (marked "Rollbox") | Combat's round notes | Shooters get 1 penalty die; they lose their next attack (p. 113) |

The three colours: serious (dying, unconscious, major wound, dead), Rollbox's combat states (aiming, dived for cover), and others.

#### What Rollbox reads and what it sets

- **CoC7's conditions are only read**, from the sheet or from CoC7's status icons on the token. Prone is CoC7's own condition and only read.
- **Aiming** and **Dived for cover** live only in combat's round notes, their one source: the status cards and the attack dice both read them. They are cleared at the new round; Aiming also ends once the aimed shot is made. Out of an encounter neither can be on. See [combat](#combat).
- **Restrained** is Rollbox's own note on the character, because CoC7 has no Restrained condition.

#### Restrained

- The Keeper sets it with **Set Restrained: <target>** in the Action flyout's Maneuver tab, after a Restrain maneuver, when CoC7's card shows it succeeded. See [action flyout](#action-flyout).
- The Keeper clears it with the small **×** on its status card. CoC7's statuses have no ×.
- Nothing else clears it: it stays until the Keeper presses the ×.
- While Restrained a character can only try to break free: Attack and Spell are greyed, Maneuver offers only Break free, and Flee is greyed. See [action flyout](#action-flyout) and [combat](#combat).

#### Statuses that limit a player

While their investigator is unconscious, dying, dead or in a bout of madness, a player's whole menu (Action, Check, Other) is greyed, with the reason on hover. The Keeper's limits and Override are in [action flyout](#action-flyout).

#### Effect on an attack

In the Action flyout's target box, the target's statuses show one line each, with their effect on this attack for the picked weapon:

| Line | Melee weapon | Firearm |
| --- | --- | --- |
| Target prone | 1 bonus die | 1 penalty die; none at point blank |
| Target dived for cover | No effect | 1 penalty die, ticked as CoC7's Under cover |
| Target unconscious | Misses only on a fumble | Misses only on a fumble |
| Attacker prone ("You are prone") | — | 1 bonus die |
| Any other status | Effect: none | Effect: none |

Then the situation lines, when they apply:

| Line | Weapon | Effect | On CoC7's card |
| --- | --- | --- | --- |
| Point blank | Firearm | 1 bonus die (never for mace spray) | CoC7's Point blank |
| Firing into melee | Firearm | 1 penalty die | CoC7's In melee |
| Outnumbered | Melee | 1 bonus die | CoC7's Outnumbered |

- The net dice show only when there is an effect, and Rollbox sets them on CoC7's attack card (its slider, or CoC7's own toggle).
- The dice stay within CoC7's two bonus or two penalty dice, and a die set by a toggle is never counted twice.
- With no weapon picked (or on the Spell tab) the lines give only their notes.

### Settings

None.

#### Flags

| Flag | On | What it holds |
| --- | --- | --- |
| `statuses.restrained` | Character | `true` while Rollbox's Restrained is on |

Aiming and Dived for cover are combat's round notes (`roundNotes`): see [combat](#combat).

### Rules

- Prone: melee 1 bonus die, firearms 1 penalty die except at point blank, shooting while prone 1 bonus die (Keeper Rulebook p. 127–128).
- Unconscious: can't defend, so an attack misses only on a fumble (p. 108).
- Dive for cover: the shooter gets 1 penalty die (p. 113).
- Aiming: the next shot gets 1 bonus die (p. 113).
- Point blank: 1 bonus die (p. 113); never for mace spray (p. 406).
- Firing into melee: 1 penalty die (p. 113).
- Outnumbered: 1 bonus die once the target has used its defences this round (p. 108).
- Restrain, Break free (p. 105). Major wound (p. 120), dying (p. 121), bout of madness (p. 156), indefinite insanity (p. 158).

### Limits and known gaps

- Restrained never clears by itself; the Keeper presses its ×.
- A module that uses the same status ids as CoC7 (`prone`, `dead`) shows as CoC7's status.
- A CoC7 update that renames a condition key hides that status.
- Thrown weapons and bows are ranged in CoC7, so they count as firearms here.

### Decisions

- **CoC7's conditions are only read; Rollbox sets only what its own actions cause.** Rollbox stays in its lane and never edits CoC7's conditions.
- **Aiming and Dived for cover have one source, combat's round notes.** The status cards and the attack dice read the same place, so they always agree.
- **Restrained is set by the Keeper after a Restrain maneuver and cleared from its status card.** CoC7 has no Restrained condition and the maneuver's effect is the Keeper's to apply.
- **Prone is CoC7's and only read.**
- **CoC7's `tempoInsane` reads Bout of madness**, the name CoC7 itself uses for it.
- **Status cards show only on one full character sheet.** The two-character sheet, the character cards and the turn order's rows stay compact.
- **The hover text has no "set by" line,** and speaks to the player ("you") on their own character.

## How a fight starts

### Summary

Rollbox follows the rulebook's way into combat: a weapon drawn may be noticed, an attack out of combat asks the Keeper whether the target saw it coming, and the first blow plays out on CoC7's cards before any round starts. The Keeper then presses Start combat, picks who joins, and everyone near the fight comes in standing by. Once a fight runs, see [combat](#combat).

### How it works

#### The flow at a glance

1. A character draws a real weapon out of combat: the Keeper's **weapon-drawn** pop-up asks who notices.
2. A character attacks out of combat: the Keeper's **About to attack** pop-up asks whether the target sees it coming.
3. The attack plays out on CoC7's cards as the **first blow**; the Keeper gets the **First blow** card with Start combat.
4. **Who's joining this fight?** lets the Keeper pick the fighters; everyone else near stands by.
5. Round 1 starts at the top of the order. At each turn start, newcomers in range go on the Keeper's **joining card**.

All of these are the Keeper's pop-ups above the hotbar, made by the Keeper's client; a player's client asks the Keeper's through the relay. Their placement is in [combat](#combat). Everything here runs only with **Gameplay rules** (`rollboxGameplay`) on.

#### The weapon-drawn notice

Out of combat, with **Notice when a weapon is drawn** (`rollboxNoticeDraw`) on, a weapon picked in Rollbox's Action flyout brings up a pop-up only the Keeper sees. Players see nothing of it.

- **Only a real weapon drawn by an investigator or an NPC.** Never the sheet's unarmed weapon (CoC7's `i.weapon.brawl`, or a melee weapon named Punch, Unarmed, Brawl, Fist or Fists), and never a creature, whose claws and bite can't be told from a carried weapon.
- In combat, drawing brings up nothing.
- The pop-up reads "Harvey draws .38 Revolver." and lists **"Could notice:"**, one row per character in range: in sight (walls and closed doors block; lighting doesn't count), and with **Notice range** on Distance, within **Notice distance** metres, edge to edge.
- Buttons: **Roll to notice** · **Nobody notices** · **Everyone notices**, then **Start combat** · **Ignore**.

**Roll to notice** sends one Spot Hidden (the only notice skill here) at the difficulty the drawer's Stealth sets:

- Each investigator with a player online gets it as a request to their players, like any check.
- Everyone else (an investigator with no player online, an NPC, a creature) is rolled **privately for the Keeper at once** through CoC7's `runRoll`, at base value when Spot Hidden isn't on the sheet (CoC7's raw roll). `runRoll` rolls without a card waiting for a Roll press, so a player-owned character gets no standby card. There is no request card for the Keeper anywhere in this flow: a request whispered to the Keeper names no character, so the Keeper's click would roll for whichever token is selected.

**The pop-up is the list.** Each row reads **Waiting** (asked, not rolled), then **Noticed** or **Didn't notice**, read from CoC7's card as each result comes in.

- **The Keeper settles a row by hand:** each row has **Noticed · Didn't notice** (the row's current state greyed), with or without a roll, a Waiting row included. A hand-set row counts as a rolled one, and a roll that comes in later doesn't change it.
- CoC7's check cards stay (NPCs' private). Each player whose investigator noticed gets a private line: "You see <name> draw a weapon." Rollbox posts no summary for the Keeper: the list is the summary.
- **Everyone notices** marks every row Noticed and whispers the line to every investigator in range. **Nobody notices** marks every row Didn't notice.
- After a choice the pop-up says what the Keeper chose and keeps **Start combat · Ignore** under the list. Ignore, Start combat and the ✕ close it, rows waiting or not; once it is closed, nothing waits for a roll.
- **Start combat** starts an encounter with the drawer and everyone who could notice, initiative through CoC7, round 1 at the top.
- **Linked to About to attack:** a character marked Noticed for that drawer, out of combat, starts the drawer's About to attack on them with **Saw it coming** already chosen. This lives in the Keeper's client's memory for ten minutes; nothing is saved.

#### About to attack

Out of combat, an attack from the Action flyout (Attack, Maneuver, an improvised weapon; the Keeper's for any character, or a player's) on a target token first brings up the Keeper's pop-up:

> **Deep One is about to attack Cecil**
> Out of combat. Does Cecil see it coming?

- **Roll to notice** ("Cecil rolls", or "you roll, privately" for a target no player online plays): **Spot Hidden · Listen · Psychology**. A normal check request at the difficulty the attacker's Stealth sets: to the player when a player online plays the target, otherwise rolled privately for the Keeper at once through CoC7's `runRoll` (no standby card for a player-owned character).
- **Or decide:** **Surprised · Saw it coming · Ignore.**
- **While the roll is out** the pop-up reads "Waiting for Cecil's Spot Hidden…" with the three decisions available. The result decides on its own as soon as CoC7's card has it (private, blind or revealed): a failure is Surprised, a success is Saw it coming. A target without the skill on the sheet rolls at base value (CoC7's raw roll), which also decides.
- If the weapon-drawn list marks the target Noticed for this attacker, the pop-up opens with "Cecil saw Harvey draw a weapon: Saw it coming is chosen." and Saw it coming as its main button. Every button works, so the Keeper can change it.

**Surprised** ("Cecil is surprised", "Cecil failed Spot Hidden: surprised, no response.") asks how:

| Choice | What happens |
|---|---|
| **Automatic hit** | CoC7's own Automatic success toggle on its melee card: a success unless a fumble, straight to CoC7's damage card, no defender card. CoC7's ranged card, its opposed card (a maneuver) and a skill check (an improvised weapon) have no such toggle, so it is greyed there with the reason in its hover. |
| **One bonus die** | One more bonus die on CoC7's card (for a maneuver, the unopposed check's dice). |

The surprised target gets **no alert** and no response: on CoC7's melee defender card and on Rollbox's maneuver notice, the active Keeper's Rollbox answers **No response**, as the Keeper could click. A player's Automatic hit is set on CoC7's card by the Keeper's client from its own record of the decision, never from what the player's client asks.

- **Saw it coming:** the attack goes ahead normally and the target gets their being-attacked alert ([alert-flyout](#alert-flyout-being-attacked)).
- **Ignore** (and the pop-up's ✕): the attack goes ahead as a normal attack and starts no combat: no First blow card.
- After Surprised or Saw it coming, the [first blow](#the-first-blow) follows.

**A player's attack waits** ("Waiting for the Keeper…" in their Action flyout) until the Keeper answers, up to ten minutes; with no answer nothing is sent. Once the Keeper has answered (Ignore included), the player's Rollbox reads the Keeper's toggles (Automatic hit, a bonus die) from CoC7's saved card (`flags.CoC7.load`), because CoC7 leaves its keeper-only block out of a player's copy of the card, and the waiting attack is rolled at once as the attack-rolling settings say for that attacker ([action-flyout](#action-flyout)). Damage stays CoC7's.

About to attack has **no setting of its own**: it runs whenever the Gameplay rules are on.

#### Players wait while the Keeper decides

From the moment About to attack opens until the Keeper presses Start combat or closes the First blow card (or answers Ignore), **every player's own actions in Rollbox are locked**:

- **Action** stays open with its own lock: **"Waiting for the Keeper"** on its line and in each greyed control's hover. No Attack, Maneuver or Spell, and no picking or changing a weapon, so a player goes into combat with the weapon they had (none if none is out; it matters for Draw gun at round 1). A player's attack waiting for the Keeper's answer stays in view there.
- **Every other menu button** (Check, Other with Item, Luck and Assist, and anything else a player can press to roll or act) is greyed with "Waiting for the Keeper" in its hover; an open flyout closes, and a click on the sheet's values opens nothing. Opposed opens from those, so it is locked too.
- **The Keeper's requests still reach players** and are rolled as usual: a check the Keeper sends is CoC7's link in chat, which Rollbox doesn't touch.
- The Keeper is never locked and can change anyone's picked weapon.
- Rollbox's scene flag `firstBlow` on the viewed scene tells every client. It counts for nothing once an encounter runs, and the active Keeper's client clears one left by a page closed mid-way.

#### The first blow

An attack from the Action flyout on a target with **no encounter running starts no combat round** (Keeper Rulebook p. 106–110, Striking the First Blow).

- It plays out fully on CoC7's cards: the target's Dodge, Fight back or none, the rolls, the damage.
- The Keeper gets one card above the hotbar that says what is waited on, with **Start combat** and the ✕ under it: "**First blow:** Cecil attacks Deep One. Finish the surprise attack on CoC7's cards, then start combat." It names the first blow's attackers and targets; it reads "the attack" in place of "the surprise attack" when no target is surprised (the Keeper chose Saw it coming). The card drags by its line.
- The Action flyout says "First blow: finish the attack, then press Start combat on your card." (a player's: "First blow: the Keeper starts combat once the attack is done.").
- Further attacks before Start combat join the same first blow: one card, its line naming everyone.
- The ✕ forgets the first blow: no combat.
- **Start combat** opens [Who's joining this fight?](#whos-joining-this-fight) with the attacker and the target in. With nobody else near, the fight begins at once. With an encounter already running (one the Keeper started in Foundry's tracker), the first blow's people join it.
- **The first blow isn't the attacker's round-1 action** (the rulebook's example, p. 110): they get their normal turn, not greyed as spent.
- CoC7 and Foundry never start a combat on an attack; Rollbox does, on the Keeper's word. There is no Start combat button for selected tokens (the weapon-drawn pop-up's Start combat is the other way in).

#### Who's joining this fight?

The Keeper's window from the First blow card's Start combat:

- "Cecil attacks the Deep One. Tick who joins; the rest stand by in the turn order."
- **In the fight:** the attacker and the targets, ticked and fixed.
- **Investigators** and **NPCs:** every token with a character within the join range of anyone in the fight, in sight or not, hidden or not, nearest first, each with its distance and tags ("asks their player", "hidden", "out of sight", an NPC's disposition).
- **Pre-ticked:** when everyone in the fight is on a side (an investigator, Friendly or Hostile), everyone in range and in sight who would join on their own. A fight involving a Neutral or Secret token pre-ticks nobody. An investigator whose player will be asked is never pre-ticked: the player decides, and the Keeper can tick them.
- **Start combat** works with nobody ticked. **Cancel** (or ✕) brings the First blow card back.
- A right click on a person's line targets their token.

**Start combat** then:

1. reveals the attacker's token if hidden (as the Keeper's own toggle);
2. makes the encounter on the attacker's scene, using an unstarted encounter the Keeper built there if there is one;
3. puts the attacker, the targets and the ticked ones in as fighters, and everyone else near who joins on their own **standing by**;
4. rolls everyone's initiative through CoC7 (Draw gun's DEX + 50 kept);
5. begins round 1 **at the top of the order** (turn 0), never mid-order; a standing-by top is skipped to the first fighter, and readied guns are drawn with the turn put back on the new top.

#### Standing by

Investigators and tokens Foundry marks **Friendly** or **Hostile** within the **join range** (`rollboxJoinRange`, edge to edge) and **in sight** (no sight-blocking wall between; lighting and darkness ignored) of a fighter come in **standing by** when the fight starts.

- **Neutral, Secret and hidden** tokens never join on their own; there is no bystander list. A hidden token joins by attacking.
- Standing by means in the encounter but skipped; how it shows and how someone acts from it is in [combat](#combat).
- **Becoming a fighter:** attacking, being attacked, a maneuver, or casting a spell at a target.

#### The players' join card

A player whose own investigator comes in standing by (Player Rollbox on, player logged in) gets:

> A fight has broken out: the Deep One Hybrid attacks Cecil, 40 ft from you.
> **Stay out** · **Join the fight**

- **Join the fight** makes them a fighter. **Stay out** keeps them standing by (and puts their gun away).
- An attack on a fellow investigator works the same.
- An investigator with no player to ask stands by for the Keeper's list.
- Like every fight notice it has a full amber border, never a stripe on one side.

#### During the fight

- **Anyone attacked who isn't in it** joins as a fighter.
- **A surprise attack from hiding:** a token not in the running encounter that attacks joins at once, **revealed** if hidden (as the Keeper's own toggle). Its attack is its action this round: its turn this round is skipped and it acts in the DEX order from the next. The first blow out of combat doesn't count so.
- A player's relayed attack joins the fight running for those characters, whatever scene the Keeper views, and never starts a second one.

**At the start of every turn** of a fight Rollbox started (only while the Keeper views the fight's scene, because distances and sight are read on the board):

- **Standing-by combatants** who left the range or sight of every fighter are dropped; coming back applies the rule again. Stay out holds while they stay in range.
- **Newcomers:** everyone (investigator, Friendly or Hostile) who came within the join range and in sight of a fighter goes on **one joining card** for the Keeper:
  - "Coming into range:", each name ("Helen (in sight of the Deep One)", "; asks their player" when their player gets the join card).
  - **Add:** an investigator whose player can answer comes in standing by and gets the join card; the rest fight. Initiative through CoC7.
  - **Leave out:** holds for the rest of this fight; Rollbox never asks about them again, in range or not. Add to combat in the turn order lets them back in.
  - **Add all** and **Leave all** for everyone on the card, shown with two or more listed.
- Nobody comes in until the Keeper presses Add. The card is one card, brought up to date at each turn start; its ✕ closes it and those not answered are listed again next turn while in range. It closes when the encounter ends.
- Someone who joins counts from the next turn, so a crowd near the fight doesn't pull in its neighbours at once.
- **An encounter the Keeper built in Foundry's tracker is left as built:** no one joins or is dropped at turn starts (standing-by and defeated skips apply).

#### Initiative

Everyone Rollbox puts in an encounter gets initiative through CoC7's own initiative call (DEX, or DEX + 50 with CoC7's Draw gun on), so no "—" stays in the turn order. CoC7's optional initiative rule posts its own "Initiative roll" cards (a DEX check for each combatant); with CoC7's basic rule, initiative is DEX with no card. That is CoC7's rule and its own call.

### Settings

| Setting | Key | Scope | Default | What it does |
|---|---|---|---|---|
| **Join range (ft)** | `rollboxJoinRange` | world | 60 | How close (feet, edge to edge, 10–200) to a fighter, and in sight, someone must be to join a fight standing by or be listed on the joining card. |
| **Notice when a weapon is drawn** | `rollboxNoticeDraw` | world | on | Out of combat, a real weapon drawn by an investigator or NPC brings up the Keeper's weapon-drawn pop-up. |
| **Notice range** | `rollboxNoticeRange` | world | `distance` | Who may notice a weapon being drawn: `sight` (Line of sight, anyone in sight) or `distance` (in sight and within Notice distance). |
| **Notice distance (m)** | `rollboxNoticeDistance` | world | 20 | With Notice range on Distance: how far, in metres edge to edge (10–100), someone can be and notice. |

All four sit in the Gameplay rules section's "Starting a fight" group and follow **Gameplay rules** (`rollboxGameplay`, see [combat](#combat)). The weapon-drawn notice keeps its own setting, **Notice when a weapon is drawn**, the only notice setting; About to attack has none, and the key `rollboxAboutToAttack` is not registered, and a value a world holds under it is ignored.

#### Flags

| Flag | On | What it holds |
|---|---|---|
| `firstBlow` | scene | `{ at }`: the Keeper is deciding About to attack or the first blow; players' Action flyouts wait. |
| `surprised` | actor | `{ attacker, at, bonus }`: the target is surprised by this attacker (counts for ten minutes). |
| `fight` | encounter | `{ attacker, targets }` names, for the join card's sentence; marks an encounter Rollbox started. |
| `leftOut` | encounter | Token ids the Keeper left out for the rest of the fight. |
| `standingBy` | combatant | `asked` or `out`. |
| `skipRound` | combatant | The round a surprise attacker from hiding is skipped. |
| `notice` (relay message) | — | A player's weapon pick, carried to the Keeper's client for the weapon-drawn pop-up. |
| `aboutToAttack` (relay message) | — | A player's attack out of combat, carried to the Keeper's client for About to attack. |
| `fight` (relay message) | — | A player's attack or spell in or into a fight, and their join card answers. |

### Rules

- **Striking the First Blow** (Keeper Rulebook p. 106–110): the first blow out of combat plays out before rounds begin; the attacker's round-1 turn is theirs (the example on p. 110).
- **Surprise** (Keeper Rulebook p. 106 and p. 408): a target may notice an attack coming (Spot Hidden, Listen or Psychology against the attacker's Stealth). A surprised target can't respond; the attacker gets an automatic hit (melee) or a bonus die.
- **Noticing a drawn weapon:** Spot Hidden at the difficulty the drawer's Stealth sets.
- **Initiative:** DEX, DEX + 50 with a readied firearm (CoC7's rule; see [combat](#combat)).

### Limits and known gaps

- Only attacks and weapon picks made in Rollbox's Action flyout start any of this; an attack from CoC7's own sheet starts nothing.
- The weapon-drawn list reads a watcher's next Spot Hidden: a watcher who rolls Spot Hidden for something else first has that roll read as the notice.
- A notice roll the player never makes keeps About to attack waiting up to ten minutes; the Keeper can decide meanwhile.
- While the Keeper decides, Rollbox can't stop a player rolling from CoC7's own character sheet or chat links: the lock covers only Rollbox's own buttons (lane rule).
- The players' wait mark sits on the scene the Keeper views when the wait begins; players on another scene don't see it.
- Who joins at a turn start waits until the Keeper views the fight's scene; nobody is dropped or listed meanwhile.
- An encounter started by another module, without Rollbox's `fight` flag, gets no one joining or dropped at turn starts.
- With two tokens of one linked character on the scene, the first is used.

### Decisions

- **The first blow starts no round; the Keeper starts combat.** The rulebook plays the first blow out before rounds begin, and only the Keeper decides a fight has started.
- **The first blow isn't the attacker's round-1 action.** The rulebook's example gives the attacker their normal turn.
- **Round 1 starts at the top of the order.** Nobody loses a turn to where the attack happens to fall.
- **About to attack is the Keeper's question, with no setting of its own.** Surprise is a Keeper's call; it comes whenever the Gameplay rules are on. There is no surprise chat card.
- **The notice roll decides by itself.** A failure is Surprised, a success Saw it coming; the Keeper can decide by hand at any time.
- **Automatic hit and One bonus die are CoC7's own toggles.** Automatic hit is greyed where CoC7 has no automatic success (ranged, maneuver, improvised).
- **A surprised target gets no alert; Rollbox answers No response for them.** A surprised character can't respond.
- **Characters no player online plays are rolled privately for the Keeper at once.** A request whispered to the Keeper names no character, so a click on it would roll for the selected token. The roll goes through CoC7's `runRoll`, so a player-owned character gets no standby card.
- **Players wait while the Keeper decides, with no weapon change** (all of Rollbox's player actions). Everyone enters combat with the weapon they had, which matters for Draw gun at round 1, and nobody acts before the Keeper has settled how the fight starts. The Keeper's own requests still go through.
- **The First blow card says what to do**. A card with only Start combat didn't tell the Keeper what it was waiting for.
- **A player's Automatic hit comes from the Keeper's own record.** A player's client can't grant itself an automatic hit.
- **The weapon-drawn notice is the Keeper's pop-up, for real weapons only.** Unarmed attacks and creatures' natural weapons are never "drawn"; players see nothing of it.
- **The weapon-drawn pop-up is the list.** Each watcher's status in one place, settled by roll or by hand; no summary lines in chat.
- **Noticing a drawn weapon feeds About to attack.** Someone who saw the weapon drawn saw the attack coming.
- **Standing by, not a bystander list.** Those near a fight on a side join standing by; Neutral, Secret and hidden tokens never join on their own.
- **Investigators whose player is asked aren't pre-ticked.** The player answers the join card.
- **Nobody joins mid-fight until the Keeper presses Add.** The joining card collects everyone in range at each turn start; Leave out holds for the whole fight.
- **Automatic joining and dropping only in fights Rollbox started.** An encounter the Keeper built is left as built.
- **Who's in is checked once per turn start.** Someone who joins counts from the next turn, so no chain pulls a crowd in at once.
- **A surprise attacker from hiding is revealed and skips this round.** Its attack is its action.
- **Initiative is always CoC7's.** Rollbox never leaves a combatant without one, and never computes one itself.
- **Any spell cast at a target makes both fighters.** Rollbox can't tell a healing spell from a curse.

## Combat

### Summary

While Foundry runs an encounter, the character panel becomes the fight's control centre: everyone in Foundry's turn order, the acting character's full card in its place, and turn controls (Delay, Flee, End turn, End combat) under it. Rollbox keeps the fight's bookkeeping (round notes, delayed turns, standing by, readied firearms, defeated marks, the dying CON roll) and leaves every roll, card and initiative to CoC7. How a fight begins and who joins it is in [combat-start](#how-a-fight-starts).

### How it works

#### The turn order

During an encounter the panel shows a **"Combat · Round N"** card, then everyone in turn order.

- **The order stays put.** It is Foundry's turn order, exactly as the combat tracker has it, top to bottom, and it never rotates.
- Whoever's turn it is opens as the **full card in their own place**, unless the Keeper has selected another combatant: then that combatant's full card opens in its place and the current turn stays a row with its red outline. Those who acted this round sit above it, a little darker; those yet to act sit below.
- **End of round N** sits under the last fighter.
- **Standing by** is its own group under that line, headed "Standing by", greyed, highest DEX first (equal DEX in Foundry's order). See [Standing by](#standing-by).
- A new round starts at the top again. A Delay, a holstered gun or someone joining re-sorts the order, as initiative does.
- A turn change is **one redraw**: the old card closes to a row and the next row opens; nothing else moves.

Every row shows the portrait, the name, the owner or "NPC", "Readied firearm" when CoC7's Draw gun is on, "Defeated", and this round's notes (Aiming, Dived for cover, Stood their ground, Acted, Delayed, Fled). No turn-order card shows an initiative number in any theme: the order says who goes when, DEX is on the card, and Foundry's tracker shows the number.

#### The Keeper's view

- Everyone is a **collapsed card** (a row) except one full card: the character sheet with its status cards above it. The full card is the Keeper's selected combatant; with nobody selected, the current turn's.
- The current turn has a **red outline** inside its edge (so the panel never changes width), whether it is the full card or a row ("NPC · current turn").
- The Keeper's rows show the meters ticked in **Meters on the small cards** (`rollboxCardMeters`, see [panel](#panel)) as thin vertical bars. A standing-by row has none.
- **Selection follows the turn.** At every turn change Rollbox forgets the Keeper's pick in the order. With **At each new turn** (`rollboxTurnSelection`) on **Select the current turn's token**, the current turn's token is selected on the Keeper's map, as a click on it would (a token with vision shows its view). This happens in the turn change's own hook, before the panel draws, so the panel draws the new turn once.
- A turn Rollbox skips at once selects nothing; the skip's own turn change does. The update that starts the encounter selects nothing, so the attack that started the fight keeps its flyout.
- On **Keep my selection**, Rollbox never changes the Keeper's selection; the panel follows the turn only while nothing is selected.
- **Nothing selected:** the turn order stays visible. The Keeper's menu acts for the combatant picked in the order, else the current turn's character. The full sheet's values can be clicked as on the panel's own sheet.

#### Acting for anyone and targeting from the order

- **Left click** on a row (with **Left click in the turn order**, `rollboxTurnOrderClick`, on **Selects**): selects that combatant. Their full card opens in its own place with a **blue outline** and no label, and the Keeper's Action, Check and Other act for them, for example to force a check at some event. The current turn's row keeps its red outline.
- A click on the current turn's row goes back to following the turn. Selecting a token on the map works the same.
- The send button names who a request goes to ("Send to <player> (Cecil)", "Roll for Deep One"); see [flyouts](#flyouts).
- **Right click** on a row or the full card always makes that combatant the user's Foundry target (releasing other targets), for the Keeper and players.
- While a target picker waits (Foundry's Target tool on: the Action flyout's Target a token, Opposed's and Assist's Pick a target and Add a character, a player's Target who you're helping), a left click targets too.
- With the setting on **Targets**, the Keeper's left click targets. A player's left click on a row always targets.
- Foundry's combat tracker is never changed.
- **Dragging:** with Allow moving the panel on, a press anywhere on the turn order (round line, a row, the full card, the turn controls; not a text box) that moves drags the panel. A press that doesn't move is a click; a drag never selects or presses anything.

#### Someone not in the fight

- **Keeper:** a selected token whose character isn't in the encounter shows its full card **above** the "Combat · Round N" line, "Not in combat" above it and a small **Add to combat ↓** below. Add to combat makes them a fighter, with initiative through CoC7. Checks and actions work for them as usual. The turn controls then show only End combat.
- **Player:** their own character outside the encounter (fled, or never joined) keeps its full card with "Not in combat", **under** the round box, the order and the controls.
- A character outside the encounter counts as out of combat for the Action flyout ([action-flyout](#action-flyout)).

#### The player's view

- A player's own character is always the full sheet, in its place in the order. The others are rows, and the acting row is outlined. A player sees no meters on others' rows and never sees hidden combatants, as in Foundry's tracker.
- Their standing-by box is described under [Standing by](#standing-by).

#### Turn controls

Under the turn order:

| Row | Keeper | Player |
|---|---|---|
| 1 | Delay · Flee (toggles) | Delay · Flee |
| 2 | End turn | End my turn |
| 3 | End combat | — |

- Every turn button sits on one line, all the same height. The buttons follow Panel transparency on the Keeper's and the player's panel.
- **Each asks once.** The first press turns the button red: Confirm end turn, Confirm delay, Confirm flee combat, Confirm leave out or Confirm end combat. A second press confirms. Pressing the toggle again takes the question back. A new turn resets the controls.
- **Who they act for:** Delay, Flee, Place on standby and Leave out act on the character the panel acts for (the Keeper's full card in the order; a player's own). Delaying and fleeing use one's own turn, so with a selected character whose turn it isn't, Delay and Flee are **hidden**. End turn always ends the current turn, whoever is selected.
- **Who may press:** the Keeper always; a player only when they own the current turn's character.
- **End turn** moves Foundry to the next turn.
- **End combat** deletes the encounter. Rollbox's confirm takes the place of Foundry's own End Combat dialog.
- A greyed button's reason is always in its hover, never in a line under the buttons, so the controls keep their height from turn to turn.

#### Delay

- **Pressing Delay asks at once.** End turn's row becomes **[←] Confirm delay [→]** (narrow arrows, Confirm delay filling the row). For the Keeper, **Place on standby · Leave out** take End combat's row. Delay pressed again, a confirm, or a new turn puts End turn and End combat back.
- **Confirm with no arrow** moves the character to the end of this round's order.
- Each **→** moves them one more place down, shown live in the turn order; the button reads "Confirm delay (2)". **←** moves them back up. They can pass at most the fighters yet to act this round; those standing by sit at the back and don't count.
- **One place per press, ties included.** Each → or ← moves them exactly one place in the order, whoever is next. Landing between two people tied on initiative (Foundry orders a tie by its own ids, so no initiative of the delayed one alone can sit between them): the delayed one gets an initiative a third of a point below the tie, and those of the tie still after them two thirds of a point below it (less when the next initiative down is closer), so the order shows exactly where the arrows put it. A player's Delay that lands inside a tie is made by the Keeper's client, since a player can't move other combatants.
- **Confirm delay ends their turn at once.** They are deselected; the next actor becomes current and is selected (with At each new turn on Select) and has the normal controls.
- The move counts for this round only. At the next round everyone delayed, and everyone moved aside within a tie, goes back to their own initiative.
- **The last fighter of the round** has nobody to delay behind. The Keeper's Delay can be pressed: no arrows; **Place on standby · Leave out** take End turn's row and End combat stays under them. A player's Delay is greyed, with "Nobody comes after you this round: nobody to delay behind" in its hover.

#### Flee

- **Pressing Flee asks at once:** End turn turns red and reads Confirm flee combat. Flee pressed again takes it back.
- Confirmed, it notes **Fled** and moves to the next turn.
- The Keeper's Flee also removes the combatant from the encounter and brings up the [flee notice](#the-flee-notice). A player's Flee leaves a Fled note on their row (players can't remove combatants) and asks the Keeper's client for the flee notice.
- **Restrained:** a character with Rollbox's Restrained status ([status](#status-effects)) can't flee until they break free. Flee is greyed with "Restrained: break free first" in its hover. The Keeper's reads **Override** on hover and turns Flee on as usual (its confirm is the ask); a player's can't be pressed.

#### The flee notice

When someone flees, the Keeper gets "<name> flees. Does anyone give chase?":

- **Let them go:** a player's fled combatant who is in the encounter leaves it.
- **Chase:** Let them go, then CoC7's chase tool opens: a new world Chase item named "<name> flees", on CoC7's own sheet, as Items › Create Item › Chase does. Without CoC7's chase item, a reminder: "Chase: set it up in CoC7's chase tool (Items › Create Item › Chase). Speed rolls: CON for everyone in it."

#### Standing by

Someone standing by is in the encounter but skipped at their turn. They come in standing by when a fight starts or when the Keeper adds them (see [combat-start](#how-a-fight-starts)).

- **In the order:** everyone standing by sits at the back of the turn order, highest DEX first, equal DEX in Foundry's order, whatever their initiative. Rollbox only draws them there: their initiative stays as CoC7 set it, so Remove from standby puts them back in their place.
- **Rows:** a standing-by row is **compact**: the name only, half a card's height, greyed, with "Standing by", "Standing by · acts this round" or "Standing by · acts next round" as its hover. Their full card is greyed with that line above it.
- The standing-by group shows at most **five** rows and scrolls past that, its heading staying put, in every theme. The Keeper's selected row, else the acting one, is scrolled into view when it changes; the list keeps its scroll position across redraws. When a full card splits the group, each run of rows scrolls on its own.
- **Skipped:** plain Standing by is skipped at their slot.
- **Act this round** stops the order on them for one turn. Pressed while their place is yet to come this round, it counts for this round; after it has passed, for the next round.
- **Acting from standby:** their card stays greyed at the back of the order. When the order reaches them they have the normal controls (Delay · Flee, End turn, End combat, and for the Keeper Place on standby · Leave out under Delay) and every action a fighter has.
- When that turn ends (End turn, Flee, Place on standby, or a skip past them) they are back on standby with Act this round off. The active Keeper's client clears it at the next turn start.
- A confirmed **Delay** on that turn keeps Act this round for the delayed place: they act there with the same controls, card greyed, and are back on standby when that turn ends.
- **Becoming a fighter:** attacking, being attacked, a maneuver, or casting a spell at a target makes them a fighter for good. Any spell counts, because Rollbox can't tell a healing spell from a curse.

**The Keeper's controls for a selected standing-by combatant:**

- **Act this round · Leave out** on one row, **Remove from standby** under it, and **End combat**. Never Delay, Flee or End turn.
- **Remove from standby** makes them a fighter again at their own initiative place.
- Standing-by NPCs follow the players' rule: the Keeper clicks their row and presses Act this round, and the order stops on them.

**Placing someone on standby (Keeper, with Delay pressed):**

- **Place on standby** keeps the selected combatant in the order, greyed and skipped, at its back. It ends their turn at once: the next actor becomes current and is selected, with the normal controls.
- **Leave out** (asks once, Confirm leave out) takes them out of the encounter for the rest of this fight. Rollbox never asks about them again; Add to combat brings them back.
- **Going on standby puts the weapon away**, whichever way they go (Place on standby, or a player's Stay out): CoC7's Draw gun is turned off if it is on, with Manage readied firearms on.
- **Draw gun turned on** for someone standing by (the Keeper in the tracker, or Rollbox) makes them a fighter, in the order at CoC7's initiative (DEX + 50). A place already passed this round is theirs next round.
- A round's start never draws a standing-by combatant's gun.

**The player's standing-by box.** A player whose own investigator stands by sees their sheet at the top, greyed, with a box:

| State | Box | Buttons |
|---|---|---|
| Skipped | "Standing by" / "Your turn is skipped." | Act this round · Rejoin the fight |
| Act this round on | "Standing by" / "You act on your turn this round." (or "next round") | Act this round · Rejoin the fight |
| The order stops on them | "Your turn" / "Back on standby after this turn." | Rejoin the fight, with a fighter's turn controls |

- The buttons sit on one row, the turn buttons' height. Rejoin the fight wears the accent border.
- **Rejoin the fight**, any time they stand by (also on their acting turn), makes them a fighter for good at their initiative place, the same path as Join the fight on the join card and the Keeper's Remove from standby. The Keeper's client makes the change.

#### Readied firearms

A readied firearm shoots at DEX + 50. CoC7 offers this as **Draw gun** in Foundry's combat tracker; Rollbox presses that button for the Keeper, the click the Keeper would make, so CoC7 sets its own flag and initiative. This is the named exception to the lane rule (see [OVERVIEW](#keepers-rollbox--design)).

With **Manage readied firearms** (`rollboxReadiedFirearms`) on:

- **At the start of each round**, everyone whose picked weapon is a firearm gets Draw gun (DEX + 50); everyone whose picked weapon isn't loses it. Once CoC7 has set the new initiatives, the round's turn goes back to the top of the new order, so a gun readied at the round's start acts in its readied place that round.
- **A gun picked during a round** is used at the character's normal DEX that round and is readied from the next round. Draw gun is pressed at the next round change.
- **A pick once one's turn has come** (acting or already acted) changes nothing until the next round: a new initiative would re-sort them past people who haven't acted, and Foundry, keeping the turn on them, would skip those people.
- **Another firearm** mid-round drops Draw gun for the round only with **Switching weapons loses the readied firearm for the round** (`rollboxSwitchLosesReadied`) on, and only before their turn has come.
- **Bows** count only with **Bows count as readied firearms** (`rollboxBowsReadied`), because an arrow is drawn for every shot.
- Characters who never picked a weapon are left to the Keeper.
- When the tracker shows no Draw gun button, the Keeper is told to click it.

**Holstering a drawn gun.** In the Action flyout a click on the weapon already picked puts it away ([action-flyout](#action-flyout)). In combat, with Draw gun on, putting the firearm away or switching to a weapon with no readied bonus (melee, unarmed, improvised) asks first:

- "Holstering puts <name> back to their DEX in the turn order (95 → 45). Holster?" **Holster** · **Cancel**
- "Switching to <weapon> puts … Switch?" **Switch** · **Cancel**

On yes, Draw gun goes off at once through CoC7's own button and the order is redrawn with them at their DEX: the one exception to the order staying put. If they have acted this round, they don't act again. If not, they act at the new place; on their own turn the turn passes to whoever the drop put above them. Cancel keeps the firearm. Firearm to firearm asks nothing, and nothing is asked out of combat or for anything but a drawn firearm.

#### Round notes

- One note per character per round: **Aiming**, **Dived for cover**, **Stood their ground**, **Acted**, **Delayed**, **Fled**. They show on the turn-order rows.
- Notes clear when the round changes. An Aiming carries into the next round once, for the aimed shot.
- The note also counts the round's attacks and the CoC7 defender cards a character answered (`defended`), which the Action flyout reads for attacks per round and Outnumbered ([action-flyout](#action-flyout)).
- Aiming and Dived for cover exist only in combat's round notes; the status cards read them ([status](#status-effects)). Dived for cover comes from the being-attacked alert ([alert-flyout](#alert-flyout-being-attacked)).

#### Defeated

- When CoC7 marks a combatant's character **unconscious, dying or dead**, Rollbox sets the combatant's own **defeated** field in Foundry's tracker, and clears it when CoC7 clears the condition.
- Rollbox never uses the tracker toggle's "dead" status: in CoC7 that status is the Dead condition, so pressing it for someone unconscious would kill them.
- A defeat the Keeper toggles by hand stays until a condition changes. Someone already down who joins an encounter is marked at once.
- Their turns are skipped **only while Foundry's own Skip defeated option** (in its combat tracker settings) is on: Foundry's next turn passes them, and so does Rollbox's skip. With it off they keep their turns, marked. Rollbox never changes Foundry's option.

#### Dying: the CON roll

At the end of each round, everyone CoC7 marks Dying rolls CON to stay alive, from the end of the round after they started dying. Someone already dying when the encounter starts rolls at the end of round 1.

- A pop-up above the hotbar: **"Cecil is dying. Roll CON to stay alive."** with **Roll CON**.
- **Who rolls:** a player online whose own investigator it is (with the Player Rollbox on) gets the pop-up and rolls their own CoC7 CON check, Regular, when they press it. It is the one thing their greyed menu allows. Everyone else (an NPC, a creature, an investigator whose player is offline) is the Keeper's pop-up, rolled privately.
- **A failed roll** tells the Keeper: "Cecil failed CON while dying." **Mark dead** sets CoC7's own Dead condition (the toggle on CoC7's sheet, as the Keeper would click it); **Handle it yourself** closes it and changes nothing.
- It stops once CoC7 stops marking them dying (stabilised, or dead).
- First Aid and stabilising are CoC7's and the Keeper's.

#### Each character's own target

Foundry's targets belong to the user, not the character. Rollbox remembers each character's own target so the Keeper can switch between characters without retargeting.

- Whoever a character last targeted (by the Keeper acting for them, or by their player) is kept on the character's token (`ownTarget`) until they target someone else.
- Untargeting forgets nothing, because Foundry also untargets by itself when a user views another scene or logs off. A remembered target whose token is deleted is forgotten.
- **The Keeper's target follows it.** When the Keeper acts for one character (selects their token, picks them in the turn order, or the turn moves to them), Rollbox sets the Keeper's Foundry target to that character's remembered target, or none. Two or more selected change nothing.
- A player's targeting is recorded for their own investigator by the active Keeper's client, from Foundry's shared targeting. Nobody changes a player's own targets.
- In and out of combat; off with the Gameplay rules.

#### Notice cards and pop-ups

The fight's small cards (Who's joining this fight?, the joining card, the First blow card, the flee notice, the chase reminder, the players' "A fight has broken out", About to attack, the weapon-drawn list, the dying pop-ups) share one placement.

- Each opens by default **just above Foundry's hotbar**, never over it. Several stack upwards, the newest nearest the hotbar, none covering another.
- They sit above Rollbox's own panel and flyouts (under Foundry's tooltips), so an open flyout never hides a question.
- Every card has a full border (amber for fight notices, blue for the chase reminder), never a stripe on one side.
- **Moving and sizing:** each card drags by its top line and sizes with the mouse wheel while held (10 % steps, 80–250 %). It keeps its own place and size per user and per kind of card, independent of the panel, and opens there next time.
- **Notice cards size** (`rollboxNoticeScale`, with a Reset button) saved sets every card back to that size; places are kept.

#### The Gameplay rules switch

**Gameplay rules** (`rollboxGameplay`) is a feature switch for Rollbox's combat rules: readied firearms and Draw gun, the weapon-drawn notice, About to attack and the first blow, who is in the fight and standing by, defeated marks and skips, the dying roll, each character's own target, and the melee reach. Off, none of them run.

- The **round-start clean-up** (round notes cleared, delayed characters put back) is bookkeeping, not a rule, and runs whatever the switch says.
- Both run on the **active Keeper's client** (Foundry's active GM), so a second GM logged in never does them twice, and they run even with the Keeper's panel hidden.
- **One turn start after the other:** each turn or round change waits for the one before. At a new round: the round's clean-up, delayed characters put back, readied guns; then who is in the fight and one skipped turn. Rollbox's own skip comes back as the next turn start. Run together, a skip on its way could move the turn past a shooter just readied at the top.
- **Any scene:** the rules read the encounter running for the characters concerned, whatever scene the Keeper views. An encounter on another scene than the characters' is never theirs. Only what the panel draws (the turn order, acting for the turn with nothing selected, the turn's token selected) follows the viewed scene.
- Draw gun is pressed in the Keeper's combat tracker. With two GMs, only the active one presses Draw gun or clears everyone's picked weapons when combat ends (see [action-flyout](#action-flyout)).

#### The Turn order and turn controls switch

**Turn order and turn controls** (`rollboxCombatPanel`) is a personal feature switch. Off, the panel never shows the turn order, its cards or the turn controls: during combat it works as out of combat (the selected token's card and its flyouts; with nothing selected, the players list), and Foundry's combat tracker runs the turns. The gameplay rules, round notes and the player's join card run as usual, and the Action flyout waits for the character's turn. The turn order is drawn in the panel, so it also follows the panel's own switch.

#### Performance

- Rollbox's work per turn change is a few milliseconds of script with no long task, measured in fights of 10, 25 and 50 combatants.
- The panel redraws once per change, batched to the next frame, however many hooks fire for it.
- A run of skipped turns (a large standing-by crowd) passes in one update, one turn start and one redraw.
- Nothing runs during a token drag, and no hook or listener is left behind after a fight.

### Settings

| Setting | Key | Scope | Default | What it does |
|---|---|---|---|---|
| **Gameplay rules** | `rollboxGameplay` | world | on | Feature switch for Rollbox's combat rules. Off: none of them run. |
| **Turn order and turn controls** | `rollboxCombatPanel` | personal | on | Feature switch: combat runs in the panel. Off: the panel works as out of combat and Foundry's tracker runs the turns. |
| **At each new turn** | `rollboxTurnSelection` | personal (Keeper only) | `select` | `select`: select the current turn's token. `keep`: never change the Keeper's selection. |
| **Left click in the turn order** | `rollboxTurnOrderClick` | personal (Keeper only) | `select` | The Keeper's left click on a row: `select` (Selects: act for them) or `target` (Targets). |
| **Manage readied firearms** | `rollboxReadiedFirearms` | world | on | Rollbox sets CoC7's Draw gun at each round's start for everyone holding a gun and clears it when they pick something else. |
| **Bows count as readied firearms** | `rollboxBowsReadied` | world | off | Off: a bow never shoots at DEX + 50. |
| **Switching weapons loses the readied firearm for the round** | `rollboxSwitchLosesReadied` | world | on | Switching from one gun to another drops it in the order for this round. |
| **Notice cards size** | `rollboxNoticeScale` | personal | 100 | Size of the fight's small cards, 80–250 %, with a Reset button. Saving sets every card to it. |
| Notice card places (not shown) | `rollboxNoticePlaces` | personal | `{}` | Each kind of card's own place and size. |

The two Keeper-only personal settings are hidden on a player's settings page. The Gameplay rules section also holds the settings of [combat-start](#how-a-fight-starts) and, from the Action flyout, Melee reach and the Roll attacks at once settings ([action-flyout](#action-flyout)).

#### Flags

| Flag | On | What it holds |
|---|---|---|
| `delayedFrom` | combatant | `{ round, initiative, nudged? }`: the initiative before a Delay, put back at the next round; `nudged`: moved a fraction down within a tie so a Delay could land before it (not delayed itself). |
| `standingBy` | combatant | `asked` (their player hasn't answered the join card) or `out`. |
| `actsRound` | combatant | The round a standing-by combatant acts in (Act this round). |
| `skipRound` | combatant | A round whose turn is skipped (an attack outside the order, or a holster after acting). |
| `fight` | encounter | `{ attacker, targets }` names: an encounter Rollbox started from a first blow. |
| `leftOut` | encounter | Token ids the Keeper left out for the rest of the fight. |
| `roundNotes` | actor | This round's note: `combat`, `round`, `aiming`, `aimCarried`, `dived`, `stood`, `acted`, `attacks`, `delayed`, `fled`, `defended`. |
| `ownTarget` | token | The token id this character last targeted. |
| `fight` (relay message) | — | A player's attack, spell, join, stay out, Act this round or flee, carried to the Keeper's client. |

### Rules

- **Delay and flee use the character's turn** (Keeper Rulebook): Delay and Flee show only on the character's own turn.
- **Fleeing** (Keeper Rulebook p. 409): on their turn, with an escape route and not held, a character may use their action to flee close combat. Whether there is a way out is the Keeper's call.
- **Escaping Close Combat:** a held (Restrained) character can't flee until they break free.
- **Readied firearms** (Keeper Rulebook p. 112): a readied firearm may shoot at DEX + 50. **p. 127:** the + 50 applies only if the firearm is used before any movement. **p. 123** (optional rule): a gun drawn during combat is readied at the start of a round. **p. 125** (example): a gun picked during a round shoots at normal DEX that round and is readied from the next.
- **Dying** (Keeper Rulebook p. 120–121): a dying character rolls CON at the end of each round to stay alive. Rollbox uses a plain CoC7 CON check, Regular.
- **Initiative** is CoC7's: DEX, or DEX + 50 with Draw gun. CoC7's optional initiative rule posts its own "Initiative roll" cards; with the basic rule there is no card.

### Limits and known gaps

- Rollbox sees only attacks made from its own Action flyout; an attack made from CoC7's sheet starts nothing and makes no one a fighter.
- A player can't remove combatants, so their Flee is a note until the Keeper answers the flee notice.
- A Delay landing inside a tie shows the tied ones after it with an initiative a fraction lower (49.67 and 49.33 for a tie on 50) in Foundry's tracker until the next round.
- With the Keeper viewing another scene, Draw gun can't be pressed (it lives in the Keeper's tracker), and the Keeper is told to set it. Who joins at a turn start waits until the Keeper views the fight's scene.
- If CoC7's tracker shows no Draw gun button, the Keeper is told to click it.
- Holstering under CoC7's optional initiative rule rolls DEX again and posts the roll, as CoC7's own button does.
- A client loaded mid-fight counts the dying from the round it loaded in, so its first CON roll may come a round late.
- A Keeper who also uses CoC7's own Dying check on the sheet rolls twice.
- Chase support is CoC7's chase tool only; CoC7 offers no call to start a chase with participants.
- With no Keeper online, a player's request (Rejoin, Act this round, Stay out, flee notice) gets no answer and nothing changes.
- A theme module restyling Rollbox's rows to another height leaves the five-row standing-by list the wrong height.

### Decisions

- **The turn order is Foundry's and never rotates.** The acting card opens in its own place and nothing else moves, so the Keeper always finds everyone in the same place.
- **No initiative number on the cards.** The order says who goes when, DEX is on the card, and Foundry's tracker shows the number.
- **Selection follows the turn, in the turn change's own hook.** The panel draws the new turn once instead of flashing the old layout; Keep my selection is there for Keepers who manage their own selection.
- **Left click selects, right click targets.** A right click always targets anywhere in Rollbox; the Keeper can swap the left click to target.
- **Delay is arrows with a live preview, no number box; one place per press** (after the table test). Passing a whole tie as one step moved a character two or three places per press. A tie is split by moving those after the landing spot a fraction down for this round.
- **Confirm delay and Place on standby end the turn at once.** The next actor is current and selected straight away.
- **Delay and Flee are hidden off the selected character's turn, not greyed.** Both use the character's own turn.
- **A greyed button's reason lives only in its hover.** The controls keep the same height from turn to turn.
- **Every turn control asks once.** A red Confirm button prevents a stray click ending a turn or a fight; Flee and Delay ask at once so a press is never mistaken for nothing happening.
- **End combat deletes the encounter directly.** Rollbox's confirm stands in for Foundry's End Combat dialog.
- **Place on standby and Leave out sit under Delay.** They are the other ways of not acting on a turn.
- **Standing by is drawn at the back of the order by DEX.** Only the drawing changes; initiative stays CoC7's, so Remove from standby restores the place.
- **Acting from standby gives the full controls for one turn, then standby again.** Act this round never ends a turn; a confirmed Delay keeps it for the delayed place.
- **Rejoin the fight is always offered to a standing-by player.** It uses the same path as Join the fight.
- **Going on standby puts the gun away, and drawing a gun ends standby.** A readied weapon means the character is fighting.
- **Draw gun is pressed through CoC7's own tracker button.** CoC7 keeps its own flag and initiative.
- **A gun picked mid-round waits for the next round.** A new initiative mid-round would re-sort past people who haven't acted and Foundry would skip them. Holstering is the one exception, because it lowers the character in the order.
- **Defeated uses the combatant's own field, and skips only with Foundry's Skip defeated on.** Foundry's tracker toggle sets CoC7's Dead condition, and Foundry's option is the Keeper's to choose.
- **The dying roll is a plain CON check, and death is the Keeper's call.** CoC7's sheet Dying check sets Dead by itself; Mark dead is a Keeper's button.
- **Each character remembers its own target, and the Keeper's target follows.** Foundry keeps targets per user, which breaks when one Keeper plays many characters.
- **Gameplay rules follow their own switch, not the panel's.** The round-start clean-up runs whatever the switch says, because it is bookkeeping.
- **Only the active GM runs the rules.** A second GM never writes or rolls twice; Draw gun in particular is a toggle that a second press would undo.
- **Turn starts run one after the other.** Readying guns and skipping turns at the same time would move the turn past a readied shooter.
- **The rules read the characters' encounter on any scene; the panel follows the viewed scene.** The Keeper can look elsewhere without the fight stopping.
- **Turn order and turn controls is a personal switch.** A Keeper who prefers Foundry's tracker keeps every rule without the panel's turn order.
- **Notice cards open above the hotbar and remember where each kind is dragged to.** Questions never cover the map's controls or each other.

## Player Rollbox

### Summary

The Player Rollbox gives each player a Rollbox panel of their own investigator: their own checks at once, their one action a round, opposed rolls and assists, their state and the turn order. The Keeper turns it on or off for the world and decides which features players get. Anything CoC7 lets only a Keeper do is done for the player by the Keeper's Rollbox, through CoC7's normal paths.

### How it works

#### Turning it on

- The Keeper's feature switch **Player Rollbox** (`rollboxPlayerRollbox`) decides whether players get a panel. It is on by default, because Rollbox is a tool for both sides of the table. Changing it asks for a reload.
- Below it, the Keeper ticks what players can do: **Actions**, **Checks**, **Combined checks**, **Opposed rolls** and **Assist**, all ticked by default. A change applies at once, without a reload.
- **Combined checks** only matter with **Checks** on; without Checks they give nothing, and the setting's note says so. Off, a player ticks one check at a time.
- The Keeper is never limited by these switches.
- With the Player Rollbox off, nothing of Rollbox shows for players: no panel, and Rollbox's tab is hidden from their Configure Settings.

#### What a player sees

- **Only their own investigator**, all the time, whatever they select: the character assigned to them in Foundry's User Configuration, when they own it. With none, the panel shows a message in its place: "You aren't assigned an investigator. Right-click your name in the Players list (bottom left) and select User Configuration, or ask your Keeper for help."
- **The menu Action · Check · Other**, each button only when at least one of its features is ticked, and inside each flyout only the allowed tabs:
  - **Action**: attacks, maneuvers and spells ([action-flyout](#action-flyout)).
  - **Check**: Characteristic · Skill, with **Make check**; combined checks with Combined checks on ([check-flyout](#check-flyout)).
  - **Other**: Opposed (**Make opposed card**) and Assist (**Target who you're helping**) ([opposed-flyout](#opposed-roll), [assist](#assist)).
- **No Sanity tab and no Luck tab.** Sanity checks are the Keeper's, and the Keeper calls for Luck rolls. Clicks on SAN or Luck on the player's character sheet do nothing; other clicks on the sheet do only what the player's features allow.
- **Their own checks are made at once** on their own client, with no window, never as a request to themselves ([check-flyout](#check-flyout)). Shift + click on a characteristic on the player's panel rolls it at once.
- **Everything opens at any time.** In combat the act buttons wait for the player's turn ([action-flyout](#action-flyout)). While the Keeper decides how a fight starts (About to attack and the First blow card), every button but Action is greyed with "Waiting for the Keeper" and Action keeps its own lock ([combat-start](#how-a-fight-starts)).
- **In combat** the panel shows the turn order, with the player's own character as the full card; a click on someone's row makes them the player's target ([combat](#combat)).
- **Being attacked:** the player's alert shows beside their menu ([alert-flyout](#alert-flyout-being-attacked)). Alerts come with the Player Rollbox; they have no switch of their own.

#### Each player's own settings

Each player has their own personal settings, the same as the Keeper's: the **Rollbox panel** switch, Theme, Panel colour, Panel size, Reset position, auto-hide, and **Roll my attacks at once**. A player's own **Rollbox panel** switch off turns Rollbox off completely on their screen. An Assist roller who turned it off gets CoC7's chat request instead of a Roll button on a panel they can't see.

On a player's settings page Foundry shows only personal settings, and Rollbox also hides the Keeper's own (Show the players when nothing is selected, At each new turn, Left click in the turn order). A section with nothing left for the player isn't drawn.

#### Picking someone by targeting

Players can't select other characters' tokens, so they pick an opponent, a helper or a target by targeting.

- **Already targeted = use it.** A token the player has targeted already is used without asking.
- With no target, Rollbox shows "Select your target" with **Cancel** and switches the player to Foundry's own Target tool. The first token they target is picked, and the tool goes back to the one in use before.
- **Cancel** (or Escape while the prompt shows) puts back the targets they had before.
- The target stays targeted, which is what CoC7's attack cards read.
- Some picks always ask, even with a target: the Action flyout's Change, Opposed when that character is already a side, and Assist's **Target who you're helping**. That last pick only says who, so the player's targets from before are put back once the token is picked.

#### Requests through the Keeper's Rollbox

A player's Rollbox sends what it can from the player's own client: a request or roll for their own character. Anything CoC7 needs a Keeper for goes to the Keeper's Rollbox, which does it as if the Keeper had sent it from their own panel, through CoC7's normal paths:

- an opposed card (its Start rolls is the Keeper's);
- an NPC's roll: rolled privately on the Keeper's client at once, never a link whispered to the Keepers;
- a request for another player's character (whispered by the Keeper's client);
- CoC7's Keeper-only toggles on the player's attack card (Aiming, Reloading, Under cover, Point blank, In melee, Outnumbered, the dice, and Automatic success on a melee card);
- the fight's notices and cards that only the Keeper's client may make ([combat](#combat)).

The messages travel over Foundry's own module socket (channel `module.keepers-rollbox`); no other module is needed.

- **Only Foundry's active GM answers**, so a table with two Keepers does it once.
- **With no Keeper online** the player is told "Rollbox: the Keeper needs to be online for this." and nothing happens. With no answer within 20 seconds the player is told the Keeper's Rollbox didn't answer.
- **Who sent a message** is the user id Foundry's server adds to it, never one written in the message, so a player can't speak for someone else. Answers are taken only from a GM.
- **The Keeper's side checks every request:** the Player Rollbox must be on, the request must be one a Rollbox flyout makes, and it must be for the sender's own characters. An opposed roll needs one side to be theirs. A check with helpers (Assist) for someone else's character is sent only when the rollers have no player, or when every named helper stands in each roller's Assist group together with the player's own investigator.

#### A player's opposed roll

A player picks only their own check and their opponent; the Keeper picks the opponent's check and finishes the roll on CoC7's own card. The details are in [opposed-flyout](#opposed-roll); a player's Assist is in [assist](#assist).

### Settings

| Setting | Key | Scope | Default | What it does |
| --- | --- | --- | --- | --- |
| **Player Rollbox** | `rollboxPlayerRollbox` | world | on | Feature switch: players get their own panel. Asks for a reload. |
| **Actions (attacks, maneuvers, spells)** | `rollboxPlayerActions` | world | on | Players get the Action button. |
| **Checks** | `rollboxPlayerChecks` | world | on | Players get the Check button (Characteristic · Skill). |
| **Combined checks** | `rollboxPlayerCombined` | world | on | Players may tick two or more checks; only with Checks on. Shown indented under Checks. |
| **Opposed rolls** | `rollboxPlayerOpposed` | world | on | Players get Other's Opposed tab. |
| **Assist** | `rollboxPlayerAssist` | world | on | Players get Other's Assist tab. |
| (not shown) | `rollboxPlayerSanity` | world | on | Kept registered; read by nothing. Players never get Sanity. |
| (not shown) | `rollboxPlayerLuck` | world | on | Kept registered; read by nothing. Players never get Luck. |
| **Roll my attacks at once** | `rollboxRollMyAttacks` | personal | on | In the "Each player's own" group: a player's own attacks are rolled as soon as CoC7's card is ready ([action-flyout](#action-flyout)). |

The section is greyed out while the Player Rollbox switch is off (display only).

#### Flags

| Name | On | What it holds |
| --- | --- | --- |
| `module.keepers-rollbox` | Foundry's socket | Rollbox's relay channel. |
| `send` | relay message type | A player's request (check, Sanity, weapon, opposed) for the Keeper's client to send. |
| `ticks` | relay message type | The Keeper-only toggles to set on a player's attack card. |
| `maneuver` | relay message type | A player's answer to a maneuver ([action-flyout](#action-flyout)). |
| `fight` | relay message type | A player's turn and fight actions ([combat](#combat)). |
| `notice` | relay message type | The fight notices a player's action calls for ([combat](#combat)). |
| `aboutToAttack` | relay message type | A player's attack out of combat waiting for the Keeper ([combat](#combat)). |
| `assistJoin`, `assistLeave` | relay message type | A player joining or leaving an Assist group ([assist](#assist)). |
| `answer` | relay message type | The Keeper's client's reply to a player. |

### Rules

- Luck rolls are called for by the Keeper (Keeper Rulebook p. 90), so players have no Luck tab.

### Limits and known gaps

- A player who plays two characters sees only the one assigned to them.
- A character assigned to a player who doesn't own it (Foundry allows Observer) gives no panel character: the player sees the no-investigator message.
- Anything relayed needs a Keeper logged in.
- Whether another player's Rollbox panel is on is read from that user's saved setting on the Keeper's client; if Foundry stops sending it, every player counts as having their panel on.

### Decisions

- **Players get a Rollbox too, on by default.** Rollbox is the player's shortcut to their own investigator; a world where the Keeper switched it off keeps that choice.
- **Only their own investigator.** A player's panel never shows other characters or the Keeper's choices, whatever they select.
- **Sanity and Luck are the Keeper's.** Players have no Sanity or Luck tab; those two features' saved values are kept but never shown or read, because setting keys are permanent.
- **Combined checks belong to Checks.** Combined checks are a way of making checks, so without Checks they give nothing.
- **Only the master switch needs a reload.** A player's client decides at load whether to build a panel; the features are read each time and apply at once.
- **The Keeper's Rollbox does what CoC7 reserves for a Keeper,** through Foundry's own module socket and CoC7's normal paths, with no extra module. Only the active GM answers, so it happens once.
- **An NPC a player involves is rolled privately on the Keeper's client at once.** A CoC7 link whispered to the Keepers would roll for whatever token the Keeper has selected.
- **An opposed card a player starts leaves Start rolls to the Keeper.** The Keeper decides the other side and when to roll.
- **The relay trusts only what Foundry vouches for.** The sender is the id Foundry's server adds; a player's request is checked against their own characters and, for Assist, the actual Assist group.
- **Already targeted = use it; Cancel puts the targets back.** Picking by targeting is the only way a player can name another token, and it never leaves stray targets behind.
- **Alerts come with the Player Rollbox.** The being-attacked alert has no feature switch of its own.

## Setup check

### Summary

The setup check looks over the world's sheets for the few things Rollbox can't work out alone: how each firearm reloads, and an unarmed or maneuver weapon whose skill CoC7 can't find. What Rollbox is sure of it saves by itself; everything else becomes a question the Keeper answers one at a time. It is the Keeper's alone: players never see it.

### How it works

#### When it runs

- **At login:** a few seconds after the world loads (about 4 seconds after Foundry is ready, never during Foundry's own startup), on the active Keeper's client only, so two Keepers logged in are never both asked. Only while **Setup check at login** (`rollboxSetupCheck`) is on.
- **When a firearm or character appears:** a firearm put on a sheet is checked for its own question only; a new investigator, NPC or creature is checked for all of its questions. The check waits a moment (about 1.5 seconds) so a batch of new items makes one notice. Active Keeper only, and only with the switch on.
- **On demand:** **Check now**, in the Setup check section of the settings, runs the check on the client of the Keeper who presses it, whatever the switch says.

Weapons Rollbox adds to a sheet itself (a Punch, a maneuver weapon) are not firearms, so adding one never raises a notice in the middle of a fight. A token on another scene is checked when Rollbox first uses its weapon (see [action-flyout](#action-flyout)).

#### What it looks at

Every world investigator, NPC and creature, any other world actor carrying a firearm, and the current scene's unlinked tokens (each holds its own copy of the sheet). The check is a loop over data Foundry already holds; nothing is read from compendiums. On a world of 66 sheets it takes about 1 ms.

For each sheet:

- **Each firearm's reload kind** (magazine, two rounds at a time, or belt). Rollbox reads its own note on the weapon first, then the weapon's CoC ID in its table, then a rule on the weapon's name. A kind the table or a sure name rule gives is saved on the weapon as Rollbox's flag, one update per sheet, so it is worked out only once. A kind the name rule can only guess becomes a question.
- **An unarmed or maneuver weapon whose skill CoC7 can't find.** CoC7's attack card can't roll without it, so this becomes a question: link the weapon to the character's fighting skill.
- **A weapon whose Maneuver an interrupted fight back left off** (flag `maneuverOff`): CoC7's Maneuver is switched back on and the flag cleared, in the same update, without asking.

A missing Punch or maneuver weapon is not asked here: the Action flyout asks when one is used.

#### What the Keeper sees

Nothing, when everything is fine. Otherwise:

1. **The notice**, at the top of the screen under Foundry's notifications: "**Rollbox:** 5 things to set up on 4 sheets." with **Review** and a ✕.
2. **The list** (Review): "Only you see this. Answers Rollbox was sure of are already saved; these questions wait for your OK." Then one row per character or monster, with its portrait, name, type ("token on this scene" for an unlinked token), the number of things, and **Open sheet** (CoC7's own sheet, to fix it by hand). Buttons: **Later**, **Reload kinds** and **Review one at a time**.
3. **One question at a time**: "2 of 5" with a dot per question, the character's row with Open sheet, then the question, with **Back** and **Skip**:
   - "How does <weapon> load?": **Magazine**, **2 rounds at a time** or **Belt**, the guess picked to start, then **Save and next**.
   - "<weapon> has no skill set": links it to the character's fighting skill, **Fix and next**.
   - On the last question the button reads "… and finish".
4. **Done**: each sheet marked Done, Skipped or Not yet, then "Setup looks good. New weapons and characters are checked when they're added." with **Reload kinds** and **Close**. Check now with nothing to set up opens Done straight away: "Nothing to set up. …".

#### Reload kinds

A button in the list and in Done. It lists every firearm on the sheets the check looks at: the weapon, whose it is, and **Magazine · 2 rounds · Belt** with the kind Rollbox currently reads picked ("a guess" beside the owner when only the name rule guessed). A press saves that kind on the weapon at once, to correct one saved wrongly. **Back** returns to the view it opened from.

#### Saving

- Sure answers (reload kinds from the CoC ID table or a sure name rule, Maneuver back on) are saved by the scan itself. The setting's hint and the list's line say so.
- Every question changes nothing until the Keeper presses its button.
- A save that fails stays on its question and the window says so: "Couldn't save this on <weapon>. Try again, or open the sheet to set it by hand."
- **Skip** is remembered until the page is reloaded; the question comes back after that.

The notice and the window are Rollbox's own boxes in Foundry's interface and wear the Keeper's panel theme ([themes](#themes)).

### Settings

| Setting | Key | Scope | Default | What it does |
| --- | --- | --- | --- | --- |
| **Setup check at login** | `rollboxSetupCheck` | world | on | The feature switch at the top of the settings page. On: the check runs at login and whenever a firearm or character is created. |
| **Check now** (menu button "Check setup now") | `rollboxSetupCheckNow` | world menu, Keeper only | — | Runs the check at once and opens the window, whatever the switch says. The only entry in the Setup check section. |

#### Flags

| Flag | On | What it holds |
| --- | --- | --- |
| `reloadKind` | a firearm item | `magazine`, `rounds` or `belt`: how it reloads in combat. |
| `maneuverOff` | a weapon item | Set while Rollbox has CoC7's Maneuver switched off for a fight back; the setup check switches Maneuver back on and clears it. |

### Rules

- Reloading firearms, Keeper Rulebook p. 113: one round loads two shells into a handgun, rifle or shotgun; one round changes a clip or magazine; two rounds change a machine gun's belt. CoC7 keeps no field saying which, so Rollbox decides by its flag, the CoC ID table and the name rule. How reloading works in a fight is in [action-flyout](#action-flyout).

### Limits and known gaps

- Only the current scene's unlinked tokens are checked; a token on another scene is checked when Rollbox first uses its weapon.
- Importing many actors at once gives one notice for all of them.
- A sheet's other questions wait for the next full check when only a new firearm on it is checked.
- Skip lasts only until the page is reloaded.

### Decisions

- **The Keeper's only.** The setup check is about how sheets are built, which is the Keeper's work; players never see it.
- **Sure answers are saved; questions wait for the Keeper's OK.** Saving what Rollbox is certain of avoids asking the same thing every login; anything it would only guess is changed only by the Keeper's button.
- **No Punch or maneuver questions at login.** The Action flyout asks when one is used, so a login isn't filled with questions about weapons that may never be needed.
- **A Reload kinds list.** A kind saved wrongly can be corrected in one press, without opening the weapon.
- **A quick scan of loaded data only.** Nothing is read from compendiums, so the check costs about a millisecond and can run at every login.

## Themes

### Summary

Rollbox has three themes, three skins over the same panel: **Foundry** (the default), **Art Deco** and **CoC7 minimal**. Each user picks their own with the personal **Theme** setting; players' panels take the same themes. Only the look changes: the menus, flyouts, buttons, places and clicks are the same in every theme.

### How it works

#### What a theme covers

Every part of the panel is themed: the character sheet and two-character sheet, the character cards and players list, the menu, the flyouts and their tabs, the flyout alerts (in a player's panel or in Rollbox's own box), the status cards, the turn order and turn controls, and Opposed. Rollbox's other boxes wear the user's theme too: the setup check's notice and window, the fight's notice cards and the spell's casting box. Chat cards stay CoC7's.

Sizes may grow where a theme needs it (a taller character card, bigger numbers, wider ribbons and flyouts), but the character panel stays 200 px wide and every menu button keeps its box and place.

#### Foundry

The default. It follows Foundry's own interface: its Dark palette, or its Light palette while Foundry's interface is Light. It follows a change at once, including Foundry's preview while its settings window is open and a change of the browser's own scheme. Nothing is saved when Foundry's interface changes.

- **Panel colour** is its tint. Any colour can be picked; the panel shows it darker or lighter only as far as the palette's text needs to stay readable.
- **Under Light**, a dark Panel colour shows as its light shade: lightness mirrored, tint kept. The setting keeps the user's pick, so switching Foundry back to Dark shows it again.
- **Panel transparency** lets the map show through the backgrounds only; text and icons stay fully opaque. Light lets half as much through for the same setting.
- **Contrast:** each palette (panel, text, muted text, borders, button fill, pressed and selected, accent, the red warning, the coral target, placeholders) keeps every text colour at least 4.5:1 on the panel (WCAG AA), on the default colour and on any colour the Panel colour can show. Disabled text and an empty tick box are at least 3:1.

#### Art Deco

CoC7's decorated character sheet.

- **Character card:** CoC7's dark page texture; CoC7's red worn line along its top and bottom; the token in a gold ring; the name in red, every character name about 10% under CoC7's size so it fits. Characteristics as CoC7's: the label in the display font over a light box with the value and its half and fifth. HP · MP · SAN · Luck as CoC7's blocks with the coloured band, the white tentacles and the maximum. The players list and the character cards end in the green tentacle line.
- **Menu:** CoC7's tab ribbons (red Action, green Check, ochre Other, blue Opposed), coming out sideways from behind the card and the turn order. Each is long enough that its label ends before the forked tail. Closed ribbons are dimmed; the open or hovered one brightens and slides out a little.
- **Flyouts:** Action, Check and Other (the Keeper's and players') start with their tabs, sitting in the dip under the art-deco zigzag's peak, with no window bar, heading or name line. The send button names who it goes to, and a combined check reads "Combined · …" on it. The ornament is drawn larger there so the Check flyout's three tabs fit in the dip.
- **Opposed and the alert** keep CoC7's green window bar with the title, and the zigzag with the heading under its peak (OPPOSED ROLL for Opposed). Opposed's tabs stay in each side's box.
- **Inside flyouts:** rows show values CoC7's way, 55 (27/11); tabs in the display font, the open one pale yellow with a glow; the main button CoC7 red; the green tentacle line along the bottom. Field labels share one style: the display font in capitals, in CoC7's label red.
- **Status cards** on CoC7's page with the red worn line.
- **Turn order:** the header as the green bar; the rows above and below the full card each in one textured group card, rows as faint cells, 3px apart, with meters 14px wide and 3px apart; the current turn outlined all round (the full card, or its row on a player's screen). The standing-by group has the tentacle line flipped along its top, and its **Standing by** title in white, centred under the green line, never on it. The turn controls end in the tentacle line.

#### CoC7 minimal

CoC7's compact sheet.

- Flat dark grey, a small radius, no textures.
- The black bar across the top of the character card (the name in it, the token over its left edge) and of the flyout (its title).
- HP, MP, SAN and Luck as label and value pairs; characteristics with the grey label strip and the ◈ marker, the big red value with its half and fifth; MOV · BUILD · DB along the bottom.
- Flat dark menu buttons, the open one dark red with a brighter icon; tabs dark red when open; rows with a cream rule underneath and red values. Field labels share one style.
- Turn order: black bar header, rows grouped as in Art Deco, the current turn outlined red all round (the full card, or its row on a player's screen).

In CoC7 minimal the turn order's rows sit 5px apart with their meters 1px apart, so a name such as "Deep One Hybrid" fits beside four meters.

#### CoC7's own files, at runtime

- The two CoC7 themes use CoC7's images from the installed system (`systems/CoC7/assets/…`) and CoC7's sheet fonts: a table's custom sheet font first, then Modesto Condensed and Lusitana. Nothing of CoC7's or Chaosium's is copied into Rollbox.
- CoC7's colours are restated from its dark sheet, because CoC7 keeps them inside its own windows.
- If CoC7 isn't the game system, either CoC7 theme shows as Foundry. Art Deco checks once that CoC7's images are there; if one is missing it shows as Foundry until the page is reloaded, with one console warning.
- The CoC7 themes draw CoC7's own solid look, turn controls included, so **Panel colour** and **Panel transparency** don't apply to them. Configure Settings greys both out while a CoC7 theme is chosen ("Foundry theme only.").

#### Style rules, all themes

- A selected, active or highlighted state is never a coloured stripe along one edge. It shows as a fill, a text or icon colour, brightness, or the element moving. A unit test fails on any one-sided border highlight in Rollbox's stylesheets and scripts (neutral row dividers are listed and allowed).
- The current turn is outlined all the way round.

### Settings

| Setting | Key | Scope | Default | What it does |
| --- | --- | --- | --- | --- |
| **Theme** | `rollboxTheme` | personal | Foundry (`foundry`) | Foundry, Art Deco (`artDeco`) or CoC7 minimal (`coc7Minimal`). Applies at once; has a Reset button. Any other saved value reads as Foundry. |
| **Panel colour** | `rollboxColor` | personal | `#0b0a13` (Foundry's own panel colour) | The Foundry theme's tint. Foundry theme only (greyed out otherwise). Applies at once; has a Reset button. |
| **Panel transparency** | `rollboxTransparency` | personal | 25% | 0% (solid) to 70%, steps of 5%: how much of the map shows through the backgrounds. Foundry theme only (greyed out otherwise). Applies at once; has a Reset button. |

All three sit in the **Look** group of the Rollbox panel section, Panel colour and Panel transparency indented under Theme. Each Reset button restores only its own setting's default, applied on Save.

### Rules

None.

### Limits and known gaps

- Art Deco's characteristic labels use CoC7's own label red, about 2.9:1 on the dark page, under WCAG's 4.5:1; they are large display-font labels, and smaller red text uses lighter reds.
- With a high transparency, what shows through from the map also affects how readable the text is.
- If Foundry stops marking its interface as Light or Dark, the Foundry theme stays Dark.
- A server that refuses the image check, or a CoC7 update that moves its sheet images, makes Art Deco show as Foundry.

### Decisions

- **Three themes over one panel.** Only the look changes, so a user can switch theme without relearning anything.
- **Foundry follows Foundry's Dark or Light.** The default fits whatever interface the user has chosen, without a setting of its own.
- **Panel colour and transparency are for the Foundry theme only.** The CoC7 themes copy CoC7's sheets, whose colours and solid pages are CoC7's.
- **The Panel colour is shown readable, never saved changed.** The panel darkens, lightens or mirrors the colour as far as its text needs, but the setting keeps what the user picked.
- **CoC7's files are used, never copied.** Images and fonts come from the installed system, so CoC7's and Chaosium's art stays theirs; a missing file falls back to the Foundry theme.
- **The ribbons are CoC7's tab images,** turned sideways, long enough for their labels, in CoC7's colours.
- **Action, Check and Other start with their tabs in Art Deco.** The tabs sit in the ornament's dip; the send button carries who it goes to and the combined-check cue.
- **Opposed keeps its title in Art Deco.** Its tabs belong to each side, so the flyout keeps its window bar and the OPPOSED ROLL heading.
- **No ✕ in a flyout's window bar.** Flyouts close the way they do in every theme; no theme adds a close button.
- **One label style within each theme.** Field labels look the same across every flyout.
- **The theme values are permanent:** `foundry`, `artDeco`, `coc7Minimal`. Any other saved value reads as Foundry, so a saved setting never breaks the panel.
- **No one-sided highlight.** A state is shown with a full outline, a fill, colour or brightness, never a stripe on one edge.

## Settings page

Every Rollbox setting, in the order the Configure Settings page shows them: the five feature switches in a box on top, then one section per feature, each in small labelled groups. The code is `scripts/settings.js` (the page) and each part's own settings data; the part document is `settings.md`.

### All settings

**Scope:** *world* is a Keeper setting that applies to everyone ("Keeper setting, applies to everyone."); *personal* is one user's own ("Personal setting, affects only your screen."); *personal, per screen* is kept per browser (Foundry's client scope). An indented setting (↳) only matters with the one above it.

**Shown to players:** world settings never show on a player's page. Personal settings show while the Player Rollbox is on, except the Keeper's own (marked "No, Keeper's own"). While the Player Rollbox is off, nothing of Rollbox shows on a player's page.

| Setting | Key | Scope | Default | What it does | Shown to players? |
|---|---|---|---|---|---|
| **Features** | | | | | |
| **Rollbox panel** | `rollboxEnabled` | personal | on | Your Rollbox panel beside the players list. Off: your panel and its flyouts are gone; the being-attacked alert, the setup check and the assist relay keep running. Needs a reload. | Yes |
| **Player Rollbox** | `rollboxPlayerRollbox` | world | on | Players get their own Rollbox panel with their own investigator and the features ticked in the Player Rollbox section. Needs a reload. See [player](#player-rollbox). | No |
| **Turn order and turn controls** | `rollboxCombatPanel` | personal | on | Combat runs in the panel: the turn order, Delay, Flee, End turn. Off: during combat the panel works as out of combat and Foundry's combat tracker runs the turns. See [combat](#combat). | Yes |
| **Gameplay rules** | `rollboxGameplay` | world | on | Rollbox's combat rules: an attack starting a fight and who joins, readied firearms, the weapon-drawn card, defeated combatants skipped, the melee reach. Off: none of them run. | No |
| **Setup check at login** | `rollboxSetupCheck` | world | on | Looks over weapons and sheets a few seconds after the Keeper logs in; sure answers are saved at once, questions wait for the Keeper's OK. See [setup](#setup-check). | No |
| **Rollbox panel · Look** | | | | | |
| **Theme** | `rollboxTheme` | personal | Foundry | How the panel looks: **Foundry** (`foundry`, Dark or Light as Foundry's interface is set), **Art Deco** (`artDeco`), **CoC7 minimal** (`coc7Minimal`). Reset button. See [themes](#themes). | Yes |
| ↳ **Panel colour** | `rollboxColor` | personal | `#0b0a13` | Foundry theme only. Background colour of the panel, its buttons and flyouts, shown darker or lighter where the text needs it. Reset button. | Yes |
| ↳ **Panel transparency** | `rollboxTransparency` | personal | 25% | Foundry theme only. How see-through the panel's backgrounds are, 0%–70% in steps of 5%; text stays fully readable. Reset button. | Yes |
| **Panel size** | `rollboxScale` | personal | 100% | Size of the panel, its buttons and flyouts, 80%–250% in steps of 10%. Reset button. | Yes |
| **Notice cards size** | `rollboxNoticeScale` | personal | 100% | Size of the fight's small cards above the hotbar, 80%–250% in steps of 10%. Saving a new size sets every card to it (places kept). Reset button. | Yes |
| **Meters on the small cards** | `rollboxCardMeters` | personal | HP, MP, SAN, Luck | One tick box per meter: which bars the character cards (several selected, or the compact card), the players list and the turn order's rows show. The full character card always shows all four. | Yes |
| **Rollbox panel · Placement** | | | | | |
| **Allow moving the panel** | `rollboxMovable` | personal, per screen | on | Drag the panel by its header anywhere on the screen; it stays where dropped. **Reset position** beside it puts the panel back beside the players list at once; so does turning this off. See [panel](#panel). | Yes |
| **Menu and flyouts open to the** | `rollboxMenuSide` | personal | Automatic | Automatic (`auto`, towards the middle of the screen), Right (`right`) or Left (`left`). Beside the players list they always open to the right. | Yes |
| **Panel layer** | `rollboxPanelLayer` | personal | Top when active | Whether Foundry's windows cover the panel: Bottom (`bottom`), Top (`top`), Top when active (`active`), Top when active or selected (`activeOrSelected`). | Yes |
| **Auto-hide the character card** | `rollboxAutoHide` | personal | off | After a while without using the panel, the full character card drops to the compact card; hovering brings it back. | Yes |
| ↳ **Auto-hide after** | `rollboxAutoHideAfter` | personal | 10 s | How long before the card drops: 1 second to 5 minutes, in seconds; the time reads beside the slider ("2 min 30 s"). | Yes |
| **Rollbox panel · Behaviour** | | | | | |
| **Show the players when nothing is selected** | `rollboxShowPlayers` | personal | on | The Keeper's panel lists each player's investigator while no token is selected. Off: the panel shows only while tokens are selected or a combat runs. | No, Keeper's own |
| **Escape closes the flyout** | `rollboxEscapeClosesFlyout` | personal | on | Escape closes an open Rollbox flyout; with none open, Escape does what Foundry does. | Yes |
| **Simplified dice UI** | `rollboxSimplifiedDice` | personal | off | Type dice into the Sanity loss and the improvised damage (e.g. `1D6+2`, `1D6+DB`; `½DB` and `1/2DB` work too) instead of the dice pickers; the preset rows are hidden too. See [flyouts](#flyouts). | Yes |
| **Rollbox panel · Menus** | | | | | |
| **Check opens on** | `rollboxCheckOpensOn` | personal | Characteristic | The Check flyout's first tab: Characteristic (`characteristic`), Skill (`skill`) or Last used (`last`). See [check flyout](#check-flyout). | Yes |
| **List style** | `rollboxListStyle` | personal | List | Characteristics and skills in the flyouts as a list (`list`) or tiles (`tiles`). | Yes |
| **Spell text in the Spell tab** | `rollboxSpellTextTab` | personal | On hover | A spell's full description beside the Action flyout on hover (`hover`), on click (`click`) or never (`off`). See [action flyout](#action-flyout). | Yes |
| **Show a spell's text while casting** | `rollboxSpellTextCasting` | personal | on | While CoC7's casting window is open for a spell cast from Rollbox, the spell's description and the target's distance show beside it. | Yes |
| **Player Rollbox · What players can do** | | | | | |
| **Actions (attacks, maneuvers, spells)** | `rollboxPlayerActions` | world | on | Players get the Action menu. | No |
| **Checks** | `rollboxPlayerChecks` | world | on | Players can make their own checks. | No |
| ↳ **Combined checks** | `rollboxPlayerCombined` | world | on | Only with Checks on. Off: a player ticks one check at a time. | No |
| **Opposed rolls** | `rollboxPlayerOpposed` | world | on | Players can make an opposed card against their target. | No |
| **Assist** | `rollboxPlayerAssist` | world | on | Players can help another character in an assist. | No |
| **Player Rollbox · Each player's own** | | | | | |
| **Roll my attacks at once** | `rollboxRollMyAttacks` | personal | on | For players: Rollbox presses the roll button on CoC7's attack card once its toggles are set. Off: the card waits. | Yes |
| **Turn order and turn controls · Your view** | | | | | |
| **At each new turn** | `rollboxTurnSelection` | personal | Select the current turn's token | Select (`select`): Rollbox selects the token whose turn it is. Keep my selection (`keep`): Rollbox never changes the selection; the panel follows the turn only while nothing is selected. | No, Keeper's own |
| **Left click in the turn order** | `rollboxTurnOrderClick` | personal | Selects | The Keeper's left click on a turn-order row: Selects (`select`) or Targets (`target`). A right click always targets; a player's click always targets. | No, Keeper's own |
| **Gameplay rules · Starting a fight** | | | | | |
| **Join range (ft)** | `rollboxJoinRange` | world | 60 | 10–200 ft in steps of 5. Investigators and Friendly or Hostile tokens this close to a fighter (edge to edge) and in sight join when combat starts, or are offered at each turn start. See [combat](#combat). | No |
| **Notice when a weapon is drawn** | `rollboxNoticeDraw` | world | on | Out of combat, a real weapon drawn by an investigator or NPC from the Action flyout brings up the Keeper's weapon-drawn pop-up. | No |
| ↳ **Notice range** | `rollboxNoticeRange` | world | Distance | Who may notice: anyone in sight (`sight`), or only those within Notice distance and in sight (`distance`). | No |
| ↳ **Notice distance (m)** | `rollboxNoticeDistance` | world | 20 | 10–100 m in steps of 5, edge to edge; the scene's feet are converted. | No |
| **Gameplay rules · Firearms** | | | | | |
| **Manage readied firearms** | `rollboxReadiedFirearms` | world | on | Rollbox presses CoC7's Draw gun at each round's start for everyone holding a gun, and clears it when they pick something else. | No |
| ↳ **Bows count as readied firearms** | `rollboxBowsReadied` | world | off | Off: a bow never shoots at DEX + 50. | No |
| ↳ **Switching weapons loses the readied firearm for the round** | `rollboxSwitchLosesReadied` | world | on | Switching from one gun to another drops the character in the turn order for this round; readied again next round. | No |
| **Gameplay rules · Melee** | | | | | |
| **Melee reach (m)** | `rollboxMeleeReach` | world | 1 | 1–10 m in steps of 0.5, edge to edge: how close a melee target must be, and how close someone must be to a shot's target for firing into melee. | No |
| **Gameplay rules · Rolling** | | | | | |
| **Roll NPC attacks at once** | `rollboxAutoRollNpc` | world | on | The Keeper's NPC or creature attack through Rollbox: Rollbox presses the roll button on CoC7's attack card after setting its toggles. | No |
| **Roll investigators' attacks at once** | `rollboxAutoRollAttacks` | world | on | The same for an investigator's attack the Keeper makes. Each player's own attacks follow **Roll my attacks at once**. | No |
| **Setup check** | | | | | |
| **Check setup now** (button **Check now**) | `rollboxSetupCheckNow` | world menu, Keeper only | | Runs the setup check at once, whatever the switch says. A settings menu, restricted to the Keeper. | No |

#### Hidden keys

Registered with `config: false`, so they never show on the page:

| Key | Scope | Holds | Why it stays |
|---|---|---|---|
| `rollboxOffset` | personal, per screen | The spot the panel is dropped at: `{corner, x, y}` (a right-side spot may also hold `reach`), `{}` while beside the players list. | Written by dragging; there is no field for it. |
| `rollboxNoticePlaces` | personal | Each notice card's own place and size, per kind of card. | Written by dragging and the wheel on a card. |
| `rollboxPlayerSanity` | world | The Player Rollbox's Sanity feature. Read by nothing: players have no Sanity tab. | Setting keys are permanent; registered, a world keeps its saved value. |
| `rollboxPlayerLuck` | world | The Player Rollbox's Luck feature. Read by nothing: the Keeper calls for Luck rolls. | Same as above. |

The key `rollboxAboutToAttack` is unused and must not be reused; About to attack follows Gameplay rules.

### How the page works

#### Features on top
The five feature switches sit in one box at the top, with a full border in Foundry's highlight colour and the note "Each section below belongs to one feature and is greyed out while that feature is off." Each switch is an ordinary setting; no section has a switch of its own.

#### Sections
Each feature has a box below, its heading naming who its settings are for (**Personal**, **Keeper** or **Mixed**, from the settings' scopes; a menu counts as Keeper) and the feature it follows ("Personal · follows Rollbox panel"). Inside, settings sit in small labelled groups (capitals, Foundry's accent colour), and a setting that only matters with another is indented under it.

#### Greying
- A section's box greys out (opacity 0.45) while its feature's tick box is unticked in the form, following the tick box before Save. It is display only: nothing is disabled and no saved value changes; each part reads its own switch when it runs.
- **Panel colour** and **Panel transparency** grey out the same way while **Theme** is anything but Foundry, following the field before Save. Their hints start "Foundry theme only." The two greyings add up.

#### Notes, buttons and values
- Every setting has an italic note under its hint: "Keeper setting, applies to everyone." or "Personal setting, affects only your screen."
- **Reset** buttons on Theme, Panel colour, Panel transparency, Panel size and Notice cards size put only that setting's default into the form, as Foundry's Reset Defaults does; Save Changes applies it.
- **Reset position** beside Allow moving the panel acts at once (it is not a form value).
- Auto-hide after reads its value as text beside the slider.

#### Reloads
Only **Rollbox panel** and **Player Rollbox** ask for a reload: each decides at start-up whether a panel is built at all. Every other setting applies at once or is read when it is used. A change to a Player Rollbox feature redraws each player's menu.

#### A player's page
- With the Player Rollbox on, a player sees only personal settings (Foundry shows world settings to the Keeper only), minus the Keeper's own: **Show the players when nothing is selected**, **At each new turn** and **Left click in the turn order**. A group or section with nothing left is not drawn.
- With the Player Rollbox off, Rollbox's tab and every Rollbox setting are hidden from players, because their personal settings do nothing without a panel.

### Decisions

- **Features on top, sections follow them.** The five primary features' switches head the page and each section greys out while its feature is off; this keeps one switch per feature instead of a master switch per section.
- **Greying is display only.** A greyed section keeps its values and stays editable, so turning a feature back on restores the Keeper's choices exactly.
- **Setting keys are permanent.** A key is never renamed or dropped, because that resets every world's saved value; the page order and groups can change freely without touching keys.
- **Unused keys stay registered, hidden.** `rollboxPlayerSanity` and `rollboxPlayerLuck` stay registered so a world's saved value is kept, though players have no Sanity or Luck tab.
- **The two Roll … attacks at once settings live in Gameplay rules.** They are Keeper settings that act on everyone's attacks, so they sit in that section rather than under anyone's personal panel switch; they don't follow the Gameplay rules switch, whose greying of them is display only. Each player has **Roll my attacks at once** for their own.
- **The Keeper's own personal settings are hidden from players.** They do nothing on a player's panel, so showing them would only confuse.
- **Moving the panel is per screen.** **Allow moving the panel** and the spot it is dropped at are kept per browser, because a spot that suits one monitor may not suit another.
- **Panel colour and transparency are Foundry theme only.** The CoC7 themes draw CoC7's own solid look, so the two settings are greyed out with them.
- **Only the two panel switches reload.** Everything else applies at once, so the Keeper can tune the panel while playing.

## Game rules

### Summary

The Call of Cthulhu 7th edition rules Rollbox follows, with their Keeper Rulebook pages and the feature files that use them. Rollbox only builds requests and presses CoC7's own controls: CoC7 rolls, compares and applies every result, so these rules decide what Rollbox offers, which toggles it sets and which choices it leaves to the Keeper. Page numbers are the Keeper Rulebook's; "summary p. 40x" is the rules summary at the back of the book.

### Checks and difficulty

| Rule | Page | Used in |
|---|---|---|
| A check has three levels: Regular (the full value), Hard (half) and Extreme (a fifth), rounded down as CoC7 works them out. | | [check flyout](#check-flyout), [assist](#assist) |
| A number to beat sets the difficulty: below 50 Regular, 50 or more Hard, 90 or more Extreme. | p. 88 | [assist](#assist), [combat](#combat) (the notice rolls against Stealth) |
| One character against a typed value: one side rolls, and the value sets the difficulty. | p. 83, 88 | [assist](#assist) |
| Difficulty and bonus or penalty dice are the Keeper's call, set from the circumstances. A player's own check is Regular with no dice; anything special comes with the Keeper's request. | | [check flyout](#check-flyout), [player](#player-rollbox) |
| An Idea roll is an INT roll and a Know roll an EDU roll, each with its own name. The Keeper ticks INT or EDU and labels it "Idea" or "Know". | p. 90 | [check flyout](#check-flyout) |

### Pushing

| Rule | Page | Used in |
|---|---|---|
| Luck and Sanity rolls can't be pushed. The glossary: "Combat, Chase, Sanity, and Luck rolls cannot be pushed". | p. 84; glossary p. 388 | [check flyout](#check-flyout), [other flyout](#other-flyout) |
| Opposed rolls can't be pushed. | p. 90 | [opposed flyout](#opposed-roll) |

Rollbox has no Pushed option anywhere: a push happens after a failure, from the Push button on CoC7's result card. CoC7 offers Push on a failed Luck roll too, which p. 84 forbids; Rollbox can't change CoC7's card, so the Keeper refuses that push at the table.

### Bonus and penalty dice

| Rule | Page | Used in |
|---|---|---|
| At most two bonus or two penalty dice on a roll. | p. 91 | [check flyout](#check-flyout), [opposed flyout](#opposed-roll) |
| Bonus and penalty dice are "primarily for use with opposed rolls". | p. 91 | [opposed flyout](#opposed-roll) |
| On a normal check the Keeper sets the difficulty; adding dice as well "should be the exception rather than the rule". The Check flyout offers both, difficulty first. | p. 92 | [check flyout](#check-flyout) |

### Combined rolls

| Rule | Page | Used in |
|---|---|---|
| A combined roll is one roll compared with each of several checks: "All of them" must succeed, or "Any one". Two or more ticks in the Check flyout make one. | p. 92 | [check flyout](#check-flyout) |
| Using two perception skills: "allow the player to make one dice roll using the higher of the investigator's two skills". That is a combined roll with "Any one". | p. 203 | [check flyout](#check-flyout) |
| An NPC's combined check is one private roll at the highest value (Any one) or the lowest (All of them), which passes or fails exactly as the combined card would. | p. 203 | [check flyout](#check-flyout) |

### Opposed rolls

| Rule | Page | Used in |
|---|---|---|
| No difficulty: the other side's result is the difficulty. Each side gets up to two bonus or two penalty dice instead. | p. 92 | [opposed flyout](#opposed-roll) |
| The higher success level wins. A tie goes to the higher skill or characteristic; tied again, a stalemate or both re-roll. | p. 91 | [opposed flyout](#opposed-roll) |

CoC7's opposed card shows only "Tie" on equal success levels, so the Opposed flyout writes a tie line naming the side with the higher value. It is advice for the Keeper, who settles the tie.

### Luck

| Rule | Page | Used in |
|---|---|---|
| The Keeper calls for Luck rolls, so players have no Luck tab; they roll Luck when the Keeper requests it. | p. 90 | [other flyout](#other-flyout), [player](#player-rollbox) |
| Group Luck roll: "If the Keeper calls for a Group Luck roll, the player whose investigator has the lowest Luck score (among those present in the scene) should make the roll." With two or more selected, the Luck tab offers it and sends the request to that one character; on a tie the Keeper picks. | p. 89–90 | [other flyout](#other-flyout) |
| Spending Luck (optional rule) is CoC7's job, on its own card: not on Luck, Sanity or damage rolls, not after a push, and never to buy off a critical or fumble. A player may spend Luck on their own combat roll the same way. | p. 99 | [check flyout](#check-flyout), [alert flyout](#alert-flyout-being-attacked) |

### Sanity

| Rule | Page | Used in |
|---|---|---|
| Starting SAN is POW; the SAN bar is drawn against it. | p. 34 | [panel](#panel) |
| Sanity rolls can't be pushed (see Pushing). | p. 84 | [check flyout](#check-flyout) |
| A bout of madness: the Keeper decides what the character does while it lasts. | p. 156 | [status](#status-effects), [action flyout](#action-flyout) |
| Indefinite insanity is lasting; what it means is the Keeper's call. | p. 158 | [status](#status-effects) |

### Physical Human Limits (Assist)

| Rule | Page | Used in |
|---|---|---|
| Several characters combine STR or SIZ against something too big for any one of them. | p. 88–89; summary p. 407 | [assist](#assist) |
| A character can try it only when what is left is no more than 100 above their own value. | p. 88 | [assist](#assist) |
| The rulebook's example: a rafter of 150 against 20, 40, 45, 60 and 75. The three lowest help and the other two roll at Regular against the 45 left. | p. 88–89 | [assist](#assist) |

The rule covers only STR and SIZ, and describes investigators combining. Using other characteristics and adding several targets' values together are the Keeper's ruling, which Rollbox offers.

### Skill base values

A skill missing from a character's sheet is offered and requested at its base value, from one table in `scripts/skill-values/base-skills.js` (part document `skill-values.md`):

- **Source:** Keeper Rulebook chapter 4, the skill list on p. 56, with the specialisation lists on p. 59 (Art and Craft), p. 64 (Fighting, Firearms) and p. 73–75 (Science). The table holds the 78 skills with a fixed name.
- **Worked out from a characteristic:** Dodge is half DEX (p. 63); Language (Own) is EDU (p. 67).
- **Open specialisations** take their group's base: Art/Craft 5 (p. 59), Language (Other) 1 (p. 66), Lore 1 (p. 68), Pilot 1 (p. 71), Science 1 (p. 73), Survival 10 (p. 77). Fighting and Firearms have no group base: it "varies" (p. 64).
- **Era:** uncommon (T) and Modern-era (Ω) skills are tagged for information only. Every skill is offered whatever the era.
- **Names follow CoC7:** the rulebook's "Art and Craft" is "Art/Craft", "Artillery" is "Firearms (Artillery)", and "Language (Other)" is "Language (Any)". No value differs from the rulebook.

Used in: [check flyout](#check-flyout), [opposed flyout](#opposed-roll), [assist](#assist), [action flyout](#action-flyout), [combat](#combat) (Stealth for the notice rolls).

### Combat: starting a fight

| Rule | Page | Used in |
|---|---|---|
| Striking the first blow: an attack out of combat starts no combat round; it plays out first, then combat begins. | p. 106–110 | [combat](#combat) |
| The first blow isn't the attacker's action in round 1: they get their normal turn (the rulebook's example). | p. 110 | [combat](#combat) |
| Surprise: the target may notice the attacker with Spot Hidden, Listen or Psychology, against the attacker's Stealth. A surprised target gets no response; the attack hits automatically or gets one bonus die. | p. 106; p. 408 | [combat](#combat) |
| Noticing a weapon being drawn is a perception roll (Spot Hidden) against the drawer's Stealth. | ch. 10 | [combat](#combat) |

### Combat: turns and actions

| Rule | Page | Used in |
|---|---|---|
| Investigators have one attack per round. NPCs and creatures have their sheet's Attacks per round; a dice formula counts as 1 until the Keeper rolls it. | p. 102; ch. 14 | [action flyout](#action-flyout) |
| A character may delay and act later in the round. Delaying uses one's turn. | p. 106 | [combat](#combat) |
| Fleeing close combat: on their turn, with an escape route and not held, a character may use their action to flee. Whether there is a way out is the Keeper's call. | p. 409 | [combat](#combat) |
| A restrained character can't flee until they break free (Escaping Close Combat). | | [combat](#combat), [action flyout](#action-flyout) |

The rules don't say whether a monster can attack and cast a spell in one turn: the Keeper's Override decides.

### Combat: melee, dodging and fighting back

| Rule | Page | Used in |
|---|---|---|
| Unarmed attacks and improvised weapons use Fighting (Brawl); a creature uses its own Fighting. | p. 104; p. 105–106; p. 392 | [action flyout](#action-flyout) |
| A thrown object adds half the damage bonus (weapons table). | | [other flyout](#other-flyout) |
| Monsters normally fight back rather than dodge. | p. 105; ch. 14 | [alert flyout](#alert-flyout-being-attacked) |
| On a tie with a success, a dodger wins; when fighting back, the attacker wins. | | [action flyout](#action-flyout), [alert flyout](#alert-flyout-being-attacked) |
| Both sides failing against a Dodge: nothing happens. | p. 408 | [alert flyout](#alert-flyout-being-attacked) |
| Outnumbered: once a character has dodged or fought back this round, later attackers get one bonus die. A creature with several attacks a round can defend that many times first. | p. 108 | [action flyout](#action-flyout), [status](#status-effects) |
| Prone: melee attacks against them get one bonus die; firearms against them one penalty die (none at point blank); shooting while prone one bonus die. They stand by dodging, fighting back or on their turn. | p. 127–128 | [status](#status-effects) |
| Combat distances are narrative; measuring is left to the table. Rollbox measures edge to edge. | p. 127 | [action flyout](#action-flyout), [combat](#combat) |

### Combat: fighting maneuvers

| Rule | Page | Used in |
|---|---|---|
| The goals: Restrain, Knock down, Disarm, Push away, Break free, Knock out. | p. 105 | [action flyout](#action-flyout) |
| Build dice: one penalty die per point of Build the opponent has over the one maneuvering; three or more points, the maneuver is impossible. A bigger character gets no bonus die. | p. 105 | [action flyout](#action-flyout), [alert flyout](#alert-flyout-being-attacked) |
| Restrained: held until they break free with a maneuver of their own. | p. 105 | [status](#status-effects), [action flyout](#action-flyout) |
| A counter-maneuver may use another Fighting specialization: the Keeper's call. | p. 105 | [alert flyout](#alert-flyout-being-attacked) |
| A monster's stat block marks its maneuver attacks "(mnvr)". | ch. 14 | [action flyout](#action-flyout) |

### Combat: firearms

| Rule | Page | Used in |
|---|---|---|
| A readied firearm shoots at DEX + 50 in the turn order. | p. 112 | [combat](#combat) |
| The + 50 counts only if the firearm is used before any movement; holstering it or switching to a weapon with no readied bonus puts the character back to DEX. | p. 127 | [combat](#combat), [action flyout](#action-flyout) |
| A gun drawn during a round is used at normal DEX that round and is readied from the next round. | p. 123 (optional rule); p. 125 (example) | [combat](#combat) |
| Aiming takes a round; the next shot, in the next round, gets one bonus die. Aiming is lost if the character moves or takes damage. | p. 113 | [action flyout](#action-flyout), [status](#status-effects) |
| Point blank: within a fifth of the shooter's DEX in feet (DEX 60 → 12 ft), one bonus die. | p. 113; summary p. 409 | [action flyout](#action-flyout) |
| Mace spray never gets point blank. | p. 406 | [action flyout](#action-flyout) |
| Firing into melee: one penalty die. | p. 113 | [action flyout](#action-flyout) |
| Diving for cover: the shooter gets one penalty die; the character loses their next attack and can only dodge until then. | p. 113 | [alert flyout](#alert-flyout-being-attacked), [status](#status-effects) |
| Reloading in combat: one round loads two shells into any handgun, rifle or shotgun, or changes a clip or magazine; a machine gun's belt takes two rounds. Out of combat a reload is one full reload. | p. 113; summary p. 410 | [action flyout](#action-flyout), [setup](#setup-check) |
| Loading one round and firing in the same round: the shot has one penalty die (CoC7's Reloading toggle). | p. 113; summary p. 410 | [action flyout](#action-flyout) |
| How each firearm loads comes from the rulebook's weapon tables (a Lewis gun or BAR takes a magazine, a Garand an en-bloc clip). | weapon tables | [action flyout](#action-flyout), [setup](#setup-check) |

Range and the target's Build on a ranged attack are CoC7's: its card sets them itself.

### Wounds and dying

| Rule | Page | Used in |
|---|---|---|
| Major wound: half max HP or more in one hit. The character falls prone, makes a CON roll or falls unconscious, and is dying if HP reach 0. | p. 120 | [status](#status-effects) |
| Dying: a CON roll at the end of each round from the round after; one failure and they die. A successful First Aid stabilises them. | p. 120–121 | [combat](#combat), [status](#status-effects) |
| Unconscious: can't act or defend; an attack against them misses only on a fumble. | p. 108 | [status](#status-effects), [action flyout](#action-flyout) |

The dying roll Rollbox brings up is a plain CoC7 CON check, so the death stays the Keeper's call (**Mark dead**). First Aid and stabilising are CoC7's and the Keeper's.

### Spells

| Rule | Page | Used in |
|---|---|---|
| An investigator's first casting of a spell asks for a Hard POW check (Casting Spells). NPCs and monsters never roll it. | ch. 9 | [action flyout](#action-flyout) |

### Decisions

- **Rules are followed, never computed.** Rollbox reads the rulebook to decide what to offer and which of CoC7's toggles to set; CoC7 rolls and judges, so Rollbox carries no dice or success-level code.
- **No Pushed option.** Pushing happens from CoC7's card after a failure, and the rulebook forbids pushing Luck, Sanity, opposed and combat rolls.
- **Difficulty first, dice second on checks.** The rulebook treats dice on a normal check as the exception, so the Check flyout keeps both but leads with difficulty; opposed rolls have dice only.
- **The Keeper settles opposed ties.** CoC7's card shows only "Tie"; Rollbox states the rulebook's tie rule beside it as advice and never decides.
- **Luck belongs to the Keeper.** Players have no Luck tab, because the Keeper calls for Luck rolls; spending Luck stays on CoC7's card.
- **Group Luck sends one request.** Only the character with the lowest Luck rolls, and the Keeper picks on a tie.
- **Idea and Know are INT and EDU with a label.** The numbers are the same, so a separate row adds nothing.
- **Assist goes beyond STR and SIZ.** Physical Human Limits covers only those two; other characteristics and adding several targets together are offered as the Keeper's ruling.
- **One base-value table.** Every missing skill comes from the p. 56 list, and every skill is offered whatever the era, because games move between eras.
- **Distances are edge to edge.** The rulebook leaves measuring to the table, and edge to edge reads true for tokens of any size on gridless scenes.
- **Maneuver dice are penalty only.** The rules give a bigger attacker nothing.
- **Death is the Keeper's call.** The dying roll is a plain CON check, and a failure offers **Mark dead** rather than setting it.
