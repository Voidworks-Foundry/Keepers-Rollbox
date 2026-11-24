# Opposed rolls

[← Back to the guide](README.md)

**For:** the Keeper, and players allowed **Opposed rolls**.

Two characters pit a skill or characteristic against each other: Stealth against Spot Hidden, STR against STR. Rollbox makes CoC7's opposed card with both sides filled in.

![A right click on STR, the waiting side, the opponent shift-clicked in, and CoC7's opposed card](../media/opposed-right-click.webp)

## From the button

1. Select two tokens and click **Opposed** (above Action, Check and Other). The flyout opens beside the menu; the panel shows both characters on one character sheet. With nothing selected, Opposed is there too: both sides wait, each with **⌖ Pick a target**.
2. For each side, pick a characteristic or a skill from its two tabs. The sides can use different kinds.
3. Give either side up to two bonus or penalty dice (**± Dice**).
4. Click **Create opposed card** (on a player's panel, **Make opposed card**).

## From a right click

1. Right-click a characteristic on the character sheet (or a row in Check). Opposed opens with that character as the first side.
2. The other side reads, in red, "Opposed roll started. Select another character." until someone fills it:
   - the other of two selected;
   - the next character you add to the selection;
   - or Shift + click on another character's characteristic, which fills the side and makes the card at once.
3. Pick the checks and click **Create opposed card**.

The first side stays even if you deselect its character. Started this way with three or more selected, the first side fills and the second waits. **Shift + right click** makes the card as soon as both sides have a check.

## The waiting side

A side with no character waits, in red, and **Create opposed card** stays greyed out. Fill it by selecting a token, or click **⌖ Pick a target** in its header and target the token (Foundry's Target tool comes up). A filled side shows its name with a **✕**: click it to empty that side again. The flyout stays open while anything is selected. **Cancel** closes it.

## Several against one

Three investigators sneaking past one guard: select the three and click **Opposed**. They all go on one side with the same check (each listed with its ✕; **⌖ Add a character** adds more), and you pick the guard with **⌖ Pick a target** on the other side. **Create opposed cards (3)** makes one CoC7 opposed card for each of them against the guard, as Send to each does for checks.

For a player the waiting line reads "Opposed roll started. Target your opponent.", with a **Target your opponent** button: they pick the opponent by targeting their token. This is the same whether they opened Opposed from Other or with a right click on their sheet or a Check row. A player not allowed Opposed rolls gets "You can't start an opposed roll." from a Check row's right click.

**A player picks only their own check.** Their sides read **You** and **Opponent**, and the opponent's side shows just the name and "Your Keeper picks what <name> rolls.": no skills, values or tie line. **Make opposed card** makes CoC7's card with the player's side only, and the Keeper finishes it (below).

## After you create it

CoC7's card waits for the Keeper's **Start rolls**. When the Keeper made the card, Rollbox clicks it for you, which rolls an NPC side at once. When a player made it, the card holds only the player's side, and the Keeper gets a whispered note under it saying how to finish it on CoC7's own card:

1. Open the opponent's sheet (locked) and right-click the check they roll. CoC7's roll dialog opens with **Opposed roll card**; click **Roll**. CoC7 adds that side to the newest open opposed card, the player's.
2. Rollbox sets the roles for you: the player's side becomes **Attacker** and the opponent's **Defender**, and CoC7 shows **Start rolls**.
3. Press **Start rolls** when you're ready. Rollbox never presses it for you here.

Each player then rolls their own side from the card.

## Who wins, and ties

The higher level of success wins: critical, extreme, hard, regular, failure (Keeper Rulebook p. 90–91). On a tie, the higher skill or characteristic wins. If that is tied too, it is a stalemate or both roll again.

CoC7's card only says "Tie", so the flyout's tie line shows, before you create the card, which side would win a tie.

## Attacker and defender

CoC7's card marks its first side attacker and its second defender, even outside combat. **⇅ Swap sides** changes which is which. Outside combat it doesn't change who wins.

## Good to know

- No difficulty: the other side's roll is the difficulty (p. 92).
- Opposed rolls can't be pushed (p. 90).
- If a side's skill isn't on that character's sheet, CoC7 adds it at its base value when the card is made.
- SAN and Luck are never sides of an opposed roll.

## Settings on this page

- **Opposed rolls** (Player Rollbox, Keeper): whether players get Opposed in their Other.

## Shortcuts

| Click | Does |
| --- | --- |
| Right click a characteristic on the sheet, or a Check row | Opens Opposed with it as the first side |
| Shift + right click | The same, and the card is made as soon as both sides have a check |
| Shift + click another character's characteristic | Fills the waiting side and makes the card |

All shortcuts: [Shortcuts](shortcuts.md).
