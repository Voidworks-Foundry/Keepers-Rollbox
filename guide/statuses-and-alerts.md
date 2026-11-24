# Statuses and alerts

[← Back to the guide](README.md)

**For:** the Keeper (status cards, the alerts for NPCs and creatures) and players (alerts).

## Status cards

![Two status cards above Helen's sheet, and Restrained's hover box](../media/statuses-status-cards.png)

A character's statuses show as small cards stacked above the character sheet, one per status. They show only when one full sheet shows: one character selected, the current turn in combat, or a player's own character. The two-character sheet, the character cards and the combat rows never show them.

- **Serious** (nearest the sheet): dying, unconscious, major wound, dead.
- **Rollbox's combat states:** aiming, dived for cover.
- **Others:** prone, restrained, bout of madness (CoC7's temporary insanity), indefinite insanity.

Hover a card to see its name and what it means, with the Keeper Rulebook page. A player reads "you" on their own character.

CoC7's conditions, Prone among them, are only read. Aiming and Dived for cover come from Rollbox's round notes and clear at the new round. CoC7 has no Restrained condition, so Restrained is Rollbox's own note on the character: the Keeper sets it with **Set Restrained** after a Restrain maneuver ([Action](action.md#maneuver)). On the Keeper's screen the Restrained card has a small **×**; click it to clear Restrained. Nothing else clears it.

**What a status stops** (the Keeper can always Override; [Action](action.md#the-keepers-limit-and-override)): unconscious, dying or dead greys a player's whole menu and the Keeper's Action for that character; a bout of madness (CoC7's temporary insanity condition) greys the player's whole menu, while the Keeper acts for them as usual; Restrained leaves only Break free. Prone and a major wound only change dice or call for a CON roll; insanity outside a bout blocks nothing.

## What statuses do to an attack

In the [Action](action.md) flyout's target box, the target's statuses and the situation show one per line, with their effect for the picked weapon on the right and the reason on hover:

| Status | Effect |
| --- | --- |
| Prone target | Melee: 1 bonus die. Firearm: 1 penalty die, none at point blank |
| Dived for cover | Firearm: 1 penalty die, ticked as CoC7's **Under cover** |
| Unconscious | Misses only on a fumble |
| The shooter is prone | Firearm: 1 bonus die |
| Point blank (within a fifth of the shooter's DEX in feet, edge to edge) | Firearm: 1 bonus die, as CoC7's **Point blank**. Never for mace spray: Rollbox takes CoC7's tick off |
| Firing into melee (in combat: the target is within melee reach of someone other than the shooter) | Firearm: 1 penalty die, as CoC7's **In melee** |
| Outnumbered (in combat: the target has already dodged or fought back this round, as many times as it attacks per round) | Melee: 1 bonus die, as CoC7's **Outnumbered** |
| Anything else | No effect on the attack |

When something applies, the box adds it up on a last line, "On CoC7's attack card" (at most two dice either way, as CoC7 allows), and Rollbox sets it on CoC7's attack card: the dice on its slider, the rest as CoC7's own toggles. Firing into melee and outnumbered are read only in combat, with **Gameplay rules** on.

CoC7's card already sets range (long and extreme), a target's size (Build), multiple shots and automatic fire itself, so Rollbox leaves those to it. Half cover (**Under cover**, unless they dived) and a fast-moving target stay the Keeper's toggles on CoC7's card.

## "You are being shot at"

![The player is shot at, dives for cover, and Under cover is ticked on CoC7's card](../media/statuses-shot-at.webp)

When a CoC7 attack card with a firearm names a player's character, before the shot is rolled, that player sees a red alert beside their menu:

- **Dive for cover:** CoC7 rolls their Dodge at once. On a success, the character is marked Dived for cover for the round and loses their next attack, and the Keeper's Rollbox ticks **Under cover** on the shooter's card. Diving is their action for the round: their Action flyout greys out, and the Attack tab reads "Dived for cover: no attack this round." The Keeper sees the same line for that character but is never limited.
- **Stand your ground:** nothing changes.

The shooter's Action flyout shows the choice: waiting, dived or stood their ground. The attack is never held for it.

## "You are being attacked"

![A melee attack; the alert; Dodge chosen on CoC7's defender card](../media/statuses-melee.webp)

*(The capture shows the alert from an earlier build, with Maneuver where it now reads Counter, and without No response; the answers now roll at once. It is redone at the recapture.)*

A target the Keeper has decided is **surprised** (About to attack, out of combat) gets no alert: they get no response, and Rollbox answers No response on CoC7's card for them.

When a melee attack names a player's character, once CoC7's defender card is posted, the alert offers **Dodge**, **Fight back**, **Counter** (a counter-maneuver) or **No response**. **One click does it:** Rollbox chooses the answer on CoC7's card and presses CoC7's roll button there, as the player would.

- **Dodge** and **No response:** rolled at once.
- **Fight back:** a button for each melee weapon; picking one rolls with it. **No weapon at all** (no Punch either): Fight back stays clickable and reads "No weapon" on hover. Pressed on the Keeper's alert, it asks "Deep One has no weapon to fight back with. Add Punch to its sheet?": **Add** puts CoC7's Punch on its Fighting (Brawl), or a creature's Fighting, and fights back with it; **Cancel** changes nothing. A player reads "Your sheet has no weapon to fight back with. Ask your Keeper to add a Punch."
- **Counter:** the character's maneuver weapons (the Punch first, already picked; a whip or other weapon with Maneuver on after it), then the goals and the Build dice (one penalty die per point of Build below the attacker; three or more: not possible); picking a goal rolls the weapon's fighting skill on CoC7's card.

Opening one answer's choices closes the other's. If CoC7's card doesn't show the choice in time, the alert says to roll on the card.

**The Keeper gets the same alert** ("Deep One is being attacked") whenever an NPC or creature is the target of a melee attack, in or out of combat, and answers it the same way in one click. Monsters normally fight back rather than dodge (Keeper Rulebook p. 105, ch. 14).

## A maneuver

When someone attempts a maneuver on a character (Rollbox's line in chat: "Cultist of Dagon attempts to knock down (maneuver) Cecil."), the same alert offers **Dodge**, **Fight back**, **Counter** or **No response**:

- **Dodge:** the character's Dodge.
- **Fight back:** a button for each melee weapon (the unarmed weapon first). A weapon that has Maneuver on (a Punch) fights back as a weapon (Rollbox switches its Maneuver off while CoC7 makes the card, and back on at once), so a win reads "landed a blow" with CoC7's own Roll damage, aimed at the loser.
- **Counter:** the maneuver weapons (the Punch first, already picked), then the goals and the Build dice. With no weapon that has Maneuver on, Counter reads "No maneuver weapon" on hover and, pressed, asks the Keeper "Switch Maneuver on for Harvey's Punch?" (or to add a Punch with Maneuver on); a player is told to ask their Keeper. Fight back with no weapon asks to add a Punch, as above.
- **No response:** no opposed card; CoC7 rolls the attacker's maneuver on its own (a success means it works).

The player's answer goes to the Keeper's Rollbox, which makes CoC7's opposed card and presses Start Rolls; once the Keeper's Start Rolls has run, the player's Rollbox rolls their own side on the card, so the answer is one click; the alert reads "CoC7's opposed card is in chat; your side is rolled once the Keeper starts the rolls." **The Keeper gets the same alert** ("Deep One Hybrid is being attacked") for a target no player answers for: an NPC, an investigator whose players are all offline, or anyone while the Player Rollbox is off. A tie goes by the rules (a dodger wins it; against Fight back or Counter the attacker does): Rollbox presses CoC7's Advantage. See [Action → Maneuver](action.md#maneuver).

The alert closes when CoC7's card is answered or the shot rolled, or when the player closes it; a maneuver's alert closes on every other screen once someone answers it, and on every screen once CoC7's opposed card has its result (any outcome, "Both side failed." included, and when the Keeper rolled both sides), or at once after No response. Both failing against a Dodge means nothing happens (Keeper Rulebook p. 408); Luck may be spent on a player's own roll under the optional rule (p. 99), on CoC7's card as CoC7 offers it. If the player's panel isn't showing, the alert opens in its own box, in the player's theme. Rollbox only reads CoC7's cards and presses their buttons.

## Settings on this page

- **Player Rollbox** (a feature switch, Keeper; on by default): the players' alerts need it on. The Keeper's alerts (a maneuver, an NPC or creature attacked in melee) show either way (with it off the Keeper answers every maneuver).
- Status cards have no setting; they follow **Rollbox panel**.

## Shortcuts

None.
