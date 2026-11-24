# Getting started

[← Back to the guide](README.md)

**For:** Keepers and players. Players get a panel of their own investigator by default.

![Selecting one investigator, then two, then three, and the panel changing; with nothing selected, the players list with HP, SAN and Luck bars](../media/getting-started-panel.webp)

## The core ideas

- **Rollbox is a tool for the Keeper and the players.** For the Keeper it is a control desk for the table's rolls: ask for rolls, roll for NPCs, set up two-sided rolls and run combat. For each player it is a shortcut to their own investigator: make their own checks and take their one action a round ([For players](for-players.md)). The Player Rollbox is on by default; the Keeper can turn it off.
- **CoC7 does all the rolling.** Rollbox builds the same roll links and cards as the Call of Cthulhu (CoC7) system's own "Create link" tool. CoC7 rolls, compares, spends Luck, pushes and applies Sanity loss, exactly as it always does. Rollbox never changes a roll, a card or a rule.
- **It is highly customizable, on both sides of the table.** The Keeper decides what players may use and which combat rules run. Everyone sets their own look. Every option is in the [settings reference](settings.md).

## The panel

The panel sits in the bottom-left corner, beside Foundry's players list. Select one or more tokens and it shows those characters. With nothing selected, the Keeper's panel lists the players' investigators (see below).

The panel has two parts:

- the **character panel** on the left, which never changes width;
- the **menu** beside it: **Action**, **Check** and **Other**. A button opens its **flyout** beside the menu. Click it again to close it.

What the character panel shows depends on how many tokens you select:

| Selected | Character panel | Menu |
| --- | --- | --- |
| None (Keeper) | **Investigators**: one row per player's assigned investigator, with portrait, name, "occupation · player" ("· offline" when that player isn't logged in) and HP, MP, SAN and Luck as bars (choose them in **Meters on the small cards**). Click a row to select that investigator's token; a row whose investigator has no token on this scene is greyed. | Check, Other: they go to every investigator |
| One | A **character sheet**: portrait, name, occupation and player; HP, MP, SAN and Luck; the eight characteristics; a button that opens the full sheet. | Action, Check, Other |
| Two | One character sheet for both. The first character is at the top, the second at the bottom in tan. Both show HP, MP, SAN and Luck in the same order, and each characteristic shows the top character's value over the bottom one's. A player's character is on top, a non-player character below. Hover a portrait and it turns into **×**: click it to deselect that token. | **Opposed** on top, then Action, Check, Other |
| Three or more | A **character card** for each: portrait, name, "occupation · player" (or "NPC") and HP, MP, SAN and Luck as bars (choose them in **Meters on the small cards**). Hover a card and its portrait turns into **×**: click it to deselect that token (the others stay). Click anywhere else on a card to select only that character. | Check, Other |

Check and Other never move. **Action** shows with one or two selected: with two, the first acts and the second is the target ([Action](action.md)). Flyouts stay open while you change the selection, and update to match. Turn off **Show the players when nothing is selected** and the Keeper's panel hides with nothing selected instead (in combat it shows the turn order). The numbers follow the character: when HP or SAN changes, the panel shows it at once.

## The menu

- **[Action](action.md):** attack, maneuver or cast a spell, through CoC7's own attack card, opposed card and Cast.
- **[Check](check.md):** characteristic and skill checks, combined checks and Sanity.
- **[Other](other.md):** an item or weapon check, Luck (and the Group Luck roll) and Assist.
- **[Opposed](opposed.md):** with two selected, or from a right click on a characteristic.

## Who rolls

Every flyout ends with one send button, named for who it goes to:

- **Send to all players** (nothing selected), **Send to <player> (<name>)** (one) or **Send to each (N)** (several) whispers the request privately to the player who owns each character. They click it in their chat and roll as usual.
- **Non-player characters roll for you.** A character with no player owner is rolled privately for the Keeper at once, with nothing to click, when the Keeper sends the request. When a player starts one, the NPC's side is the Keeper's to roll ([For Keepers](for-keepers.md#npcs-rolled-by-the-keeper)). With only NPCs selected, the button reads **Roll for NPC** or **Roll for NPCs**.
- On a player's panel the buttons make the player's own roll: **Make check**, **Make opposed card**; in Assist they help another character ([For players](for-players.md)).

There is no public request and no copied link: a CoC7 link isn't tied to a character, so anyone could roll it. If you want one, use CoC7's own Create link tool.

The send button stays greyed out until everything is filled in, and a red line above it says what is missing. After sending, the flyout lists who was asked, who was rolled for you, and what wasn't sent, with the reason.

## Clicking the character sheet

On the character sheet, the eight characteristics, SAN and Luck are buttons. With two characters, each number is that character's.

1. Click a **characteristic** to open Check with just that one ticked.
2. Click **SAN** to open Check on its Sanity tab.
3. Click **Luck** to open Other on its Luck tab.

Shift, Ctrl, Alt and right clicks work as on CoC7's own sheet: Shift + click sends a plain check at once, a right click starts an opposed roll. They are all in [Shortcuts](shortcuts.md).

## Moving the panel

Drag the panel by its header (the name row, or "N selected" with three or more) and drop it anywhere. It stays there, also after a reload. **Reset position**, beside **Allow moving the panel** in the settings, puts it back beside the players list.

Rollbox takes no keys but one: **Tab** never stops on the panel, and **Escape** closes an open Rollbox flyout (turn that off with **Escape closes the flyout**); with no flyout open, Escape does what Foundry does with it.

## A player without an investigator

A player's panel needs an investigator the player both **owns** and has **assigned** as their character. Ownership is set on the actor (its Ownership configuration, Owner); the assignment in **User Configuration** (right-click the player's name in the Players list, then the Character field). Without an assigned investigator, the player sees this message in the panel's place:

> You aren't assigned an investigator. Right-click your name in the Players list (bottom left) and select User Configuration, or ask your Keeper for help.

Rollbox changes nothing itself. The **×** closes the message until the next reload, and the panel appears as soon as an investigator is assigned. Both steps are in [For players](for-players.md).

## Where the settings are

**Game Settings → Configure Settings → Keeper's Rollbox**. The page starts with the five feature switches (Rollbox panel, Player Rollbox, Turn order and turn controls, Gameplay rules, Setup check at login); below, each feature has its own section, greyed out while the feature is off. Each setting says whether it is a Keeper setting (it applies to everyone) or a personal one (only your screen). See the [settings reference](settings.md).

## Settings on this page

- **Rollbox panel** (a feature switch, personal): turns Rollbox off on your screen without disabling the module.
- **Show the players when nothing is selected** (personal, Keeper's panel): the investigators list.
- **Allow moving the panel** and **Reset position** (personal, this computer).
- The look of the panel: see [Appearance and themes](appearance.md).
