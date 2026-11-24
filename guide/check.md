# Check

[← Back to the guide](README.md)

**For:** the Keeper, and players allowed **Checks** (and **Combined checks**, which works only with Checks).

The **Check** button opens three tabs on the Keeper's panel: **Characteristic · Skill · Sanity**. A player's has two: **Characteristic · Skill** (see [A player's own check](#a-players-own-check)). Luck is in [Other](other.md). Idea and Know are INT and EDU checks (below).

## A check

![A Hard Spot Hidden sent to Helen with Send to Helen; CoC7's roll link in the chat](../media/check-skill.webp)

1. Select the character's token and click **Check**. With nothing selected, the check goes to every investigator.
2. Pick a tab: **Characteristic** (STR, CON, SIZ, DEX, APP, INT, POW, EDU) or **Skill**.
3. Tick the check.
4. Choose the **difficulty** and any **bonus or penalty dice**. Switch on **Blind** if you like.
5. Add a **label** if you want to tell the player why they're rolling.
6. Click the send button: **Send to <player> (<name>)** (one), **Send to each (N)** (several), **Send to all players** (nothing selected), or **Roll for <name>** / **Roll for NPCs**.

### The skill list

With one character, their trained skills come first, highest first, each with its Regular · Hard · Extreme values (full, half, fifth). Under a divider come all the other skills, A to Z, at their base value from the Keeper Rulebook.

Type in the search box to find a skill. If it isn't listed, such as *Pilot (Boat)*, a **+ Add** row appears: click it (or press Enter) to use that skill at its base value.

A skill missing from an NPC's sheet is rolled at its base value, and nothing is added. For a player's character, CoC7 adds the missing skill at its base value before rolling.

### Difficulty, dice, Blind and label

- **Regular, Hard or Extreme:** the full value, half or a fifth.
- **Hidden:** the player rolls without knowing the difficulty; you set it on CoC7's card afterwards.
- **Bonus and penalty dice:** up to two either way. On a normal check, set the difficulty first and use dice as the exception (Keeper Rulebook p. 91–92).
- **Blind:** the result is shown only to you.
- **Label:** shown after the check's name, such as *"Hard Spot Hidden · notice the hidden knife"*.

There's no "pushed" option: a failed roll is pushed from the **Push** button on CoC7's card. Luck and Sanity rolls can't be pushed (p. 84).

### Idea and Know

An Idea roll is an INT roll, and a Know roll an EDU roll (p. 90). Tick **INT** or **EDU** and type *Idea* or *Know* in the **Label** box.

## Group checks

Select everyone who should roll and send the check. Each player gets their own request, and each NPC is rolled for you. With several characters, the Skill tab lists every skill A to Z, without values, and the button reads **Send to each (N)**. With nothing selected the check goes to every player's investigator (**Send to all players**).

For the Group Luck roll, see [Other → Luck](other.md#luck).

## A player's own check

On a player's panel, Check is their own investigator's, with the tabs **Characteristic · Skill** and the title "Make a check" ("Make a combined check" with two or more ticks).

1. Tick the check.
2. Click **Make check**. CoC7 rolls it straight into chat, Regular with no bonus or penalty dice and no window, exactly as a Shift + click on the value on CoC7's sheet does.

**Shift + click** on a characteristic of their sheet (or on a row) rolls it at once the same way. No request is sent, and there is no difficulty, dice, Blind, Hidden or label for players: difficulty and dice are the Keeper's call, and come with the Keeper's requests. For anything special a player uses their character sheet. A combined check posts CoC7's combined card, which waits for the player's roll.

## Combined checks

![Spot Hidden and Listen ticked, the title changes, and the combined check sent to Helen](../media/check-combined.webp)

One roll compared with two or more checks (Keeper Rulebook p. 92).

1. Tick two or more checks. Ticks stay when you switch tabs. The title becomes "Request a combined check" (in the Art Deco theme, which has no title on Check, the send button reads "Combined · …").
2. Choose **All of them** (every check must succeed) or **Any one** (one is enough). The small arrow button beside them unpicks every ticked check, on both tabs, to start again.
3. Send it. The player rolls once, and CoC7 compares the roll with each check.

- **Any one** is the rulebook's way to use the better of two skills, such as Spot Hidden or Listen (p. 203).
- **All of them** is for a task that needs two skills at once.
- A combined check is always one character's roll. With several selected, each gets their own.
- Combined checks can't be blind: CoC7 always shows the card, so Blind is greyed out.
- An NPC rolls once, against their highest value (Any one) or their lowest (All of them).
- A player needs both **Checks** and **Combined checks**. Without Combined checks a player ticks one check at a time: a new tick replaces the old one (Alt + right click too).

## Tiles

![The characteristics as tiles, STR ticked and sent to Helen, and the request in the chat](../media/check-tiles.png)

Set **List style** to **Tiles** and the characteristics show as eight tiles, four to a row (name, value, half · fifth), and the skills as a three-column grid. Click a tile to tick it. The shortcuts work on tiles too.

## Sanity

![The Sanity tab: a preset loss, a creature, and the request sent to Helen](../media/check-sanity.webp)

The **Sanity** tab (the Keeper's only: players have no Sanity tab) asks for a Sanity roll. Each character's current SAN shows under the title; with nothing selected it goes to every investigator.

1. Set the loss. The large line reads **success / failure**, such as **0 / 1D6**.
   - Click a **preset**: 0/1, 0/1D3, 0/1D6, 1/1D4+1, 1/1D6, 1D3/1D10, 1D6/1D20 or 1D10/1D100.
   - Or click either side and type, such as `1D4+1`. Enter or clicking away confirms; empty becomes 0; anything else turns red.
   - Or click **Custom success or failure loss** for a small dice picker.
2. **What caused it** (optional): the player sees this instead of the numbers, as *"Sanity check · seeing the Deep One"*. Empty, they see *"Sanity (0/1D6)"*.
3. **Creature** (optional): the creature's kind, such as *Deep One*. CoC7 remembers which creatures each investigator has seen and caps later losses. Use it only for creatures.
4. Click the send button (**Send to <player> (<name>)**, **Send to each (N)**, **Send to all players**, or **Roll for <name>** / **Roll for NPCs**).

Everything after the request is CoC7's: the roll, the loss (applied when you click **Apply** on its card), the INT roll for temporary insanity, bouts of madness and indefinite insanity. Sanity rolls can't be blind or pushed.

## Shortcuts

![Shift + click sends at once; a right click starts an opposed roll](../media/check-sheet-shortcuts.webp)

The rows and tiles take CoC7's sheet shortcuts. A plain click ticks.

| On a row or tile | Does |
| --- | --- |
| Shift + click | Sends just this check now, Regular, no options |
| Ctrl + Shift + click | Ticks it |
| Right click | Opens [Opposed](opposed.md) with it as the first side. A player not allowed Opposed rolls reads "You can't start an opposed roll." instead |
| Shift + right click | The same, and the opposed card is made as soon as both sides have a check |
| Alt + right click (with or without Ctrl) | Adds it to the ticks |
| Shift + Alt + right click | Adds it and sends the ticks now |

The character sheet's own clicks are in [Shortcuts](shortcuts.md).

## Settings on this page

- **Check opens on** (Rollbox panel section, Menus, personal): Characteristic, Skill or the last tab used.
- **List style** (Rollbox panel section, Menus, personal): List or Tiles.
- **Simplified dice UI** (personal): type the Sanity loss instead of using the presets and the dice picker.
- **Checks** and **Combined checks** (Player Rollbox, Keeper): what players may use. Combined checks gives nothing without Checks.
