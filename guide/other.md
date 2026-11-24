# Other

[← Back to the guide](README.md)

**For:** the Keeper, and players allowed **Opposed rolls** or **Assist**.

The **Other** button holds the checks that aren't a characteristic, a skill or Sanity.

- The Keeper's tabs: **Item · Luck · Assist**.
- A player's tabs: **Opposed · Assist**, each only when the Keeper allows it. Players have no Luck tab: the Keeper calls for Luck rolls (Keeper Rulebook p. 90).

Other opens on the tab you used last. **Item** needs exactly one character and is greyed out otherwise (nothing selected included); while it can't be used, Other shows Luck. **Assist** is never greyed out: with fewer than two characters it offers **⌖ Add a character**. With nothing selected, the Keeper's Other opens on Luck, for every investigator. The title follows the tab: "Item check", "Luck check", "Assist", "Opposed roll".

## Item

![Cecil's revolver requested as an item check, then Luck sent to Cecil](../media/other-item-luck.webp)

For a weapon roll with no token to target: target practice, a shot at a lock, a thrown knife, a candlestick snatched up. Attacks on tokens belong in [Action](action.md).

1. Select **one** character, click **Other** and pick **Item**.
2. Their weapons are listed with the skill each uses and its Regular · Hard · Extreme values. A weapon with two skills, such as a knife that can be thrown, has a row for each.
3. Pick one, set the difficulty, dice and Blind, and send it (**Send to <player> (<name>)**, or **Roll for <name>**).

The player gets a skill check labelled with the weapon: *"Firearms (Handgun) with the .38 Revolver"*.

### Improvised weapon

1. Pick **+ Improvised weapon** and type what it is, such as *Candlestick*.
2. Choose the skill: **Brawl** (the default), **Throw**, or **Other…** for any skill.
3. Add **damage** if you like: a quick-pick from **1D3+DB** to **1D10+DB**, type it on the damage line, or open **Custom damage** for the dice picker. With **Throw**, the damage bonus is halved (**+½DB**).
4. Send it. The player gets the check plus a damage button in chat.

Nothing is added to the character's sheet. The improvised weapon works the same way in Action's Attack tab.

## Luck

A Luck check for the selected characters: is the cab still there, does the torch have batteries?

1. Select one or more characters, click **Other** and pick **Luck**. Each character's Luck is listed. With nothing selected, every investigator rolls their own Luck (no Group Luck roll).
2. Choose the difficulty and any bonus or penalty dice, and switch on **Blind** if you like.
3. Add a **label** if you like.
4. Click the send button: **Send to <player> (<name>)**, **Send to each (N)**, **Send to all players** (nothing selected), or **Roll for <name>** / **Roll for NPCs**.

A character whose sheet has no Luck (most creatures) reads **No Luck**, greyed, and is left out of the roll; with only such characters selected, the send button is greyed out with "No Luck on this sheet.".

Clicking **Luck** on the character sheet opens this tab too. Luck rolls can't be pushed (Keeper Rulebook p. 84); CoC7 still offers Push on a failed Luck roll, so refuse it at the table.

### Group Luck roll

When something bad could happen to one of the group, the character with the lowest Luck rolls for everyone (Keeper Rulebook p. 89–90).

1. Select the group, click **Other** and pick **Luck**.
2. Turn on **Group Luck roll: only the lowest Luck rolls**. Rollbox names who rolls, and sends the roll to them alone.
3. If two or more are tied, it asks **Who rolls?**: pick one. The send button stays greyed out until you do.

## Assist

![Helen and Cecil on the Assist tab, 100 to beat, Send to each (2), and the Assist card](../media/other-assist.webp)

For when several characters put their strength or weight together: lifting a fallen pole, holding a door shut. It follows the rulebook's **Physical Human Limits** (p. 88–89): no one can try a check against a value more than 100 above their own. Helpers take their own value off what's left, and the rest roll. It also does one character against a fixed value, which then sets the difficulty (p. 83): Fist of Yog-Sothoth's STR against Cecil's CON, a door's strength.

1. Select everyone involved, click **Other** and pick **Assist**. With fewer than two in, **⌖ Add a character** picks one by targeting their token.
2. Type **the number to beat**, or mark targets (step 4).
3. **Use:** what the characters put in, and **Against:** which of the targets' values counts: each any of the eight characteristics, as tiles (STR and SIZ for lifting and holding).
4. Check the list of characters:
   - Click the **crosshair** on the left to mark a target. Creatures start as targets. Several targets add together.
   - Click the **✕** on the right to take that character out of the assist.
5. Read the result: who is **Assisting**, who is **Rolling**, the difficulty, and the chance that at least one roller succeeds.
6. Add a **label** if you like, and click the send button, named for the rollers (**Send to <player> (<name>)**, **Send to each (N)**, or **Roll for <name>** / **Roll for NPCs**).

**Who helps and who rolls is worked out for you.** Helpers are taken lowest value first, and of the splits that work Rollbox uses the one with the best chance that someone succeeds. The difficulty comes from what's left: under 50 Regular, 50 or more Hard, 90 or more Extreme. If no split works, it says "Too heavy even together."

Each roller's player gets an ordinary STR (or SIZ) check at that difficulty, labelled *"STR · lift the fallen pole"* (or *"STR · Assist"*). NPC rollers roll privately for you. A public **Assist** card tells the table who helps, who rolls, and that one success is enough. Read the rollers' cards to see how it went.

Assist has no Blind and no bonus or penalty dice. Adding targets' values together is a Keeper's ruling; the rule only describes investigators working together.

## A player's Other

A player's Other has **Opposed** and **Assist**, for their own investigator. Players roll Luck when you request it, and spend Luck on their rolls on CoC7's card as before.

- **Opposed** ends with **Make opposed card**.
- **Assist** is helping another character, an investigator, an NPC or a creature (helping someone hang on at a cliff edge): **⌖ Target who you're helping**, and their investigator joins that character's group, which you see in your Assist when you select that character. They see who is with them and can **Stop helping** until you send it. Once you send it, they see the difficulty, who helps and who rolls; only the roller rolls, from their panel's **Roll Hard STR** button (a roller whose player has no Rollbox panel gets CoC7's request in chat instead). **Cancel** in your Assist for that character clears their group, and sending a new assist for them replaces it.

Players can't select other tokens, so:

- On **Opposed**, **Target your opponent** picks the other side by targeting their token. See [Opposed rolls](opposed.md).
- On **Assist**, **Target who you're helping** picks the character they help: the next token they click (anyone but their own investigator), not one they had targeted; Escape or the button again cancels.

See [For players](for-players.md#picking-a-target).

## Settings on this page

- **Simplified dice UI** (personal): type the improvised damage instead of the quick-picks and dice picker (for example `1D6+DB`; `½DB` and `1/2DB` work too).
- **Opposed rolls** and **Assist** (Player Rollbox, Keeper): what players may use.

## Shortcuts

On the character sheet's **Luck**: Shift + click sends a plain Luck check at once. See [Shortcuts](shortcuts.md).
