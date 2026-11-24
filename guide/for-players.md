# For players

[← Back to the guide](README.md)

**For:** players, and the Keeper deciding what to give them.

> [!CAUTION]
> **Your panel needs an investigator you both own and have assigned.** In Foundry these are two different things, and Foundry lets you assign a character with only Observer, so assigning alone isn't enough:
>
> 1. **Own:** the Keeper opens the investigator's **Ownership** configuration and sets you to **Owner**.
> 2. **Assign:** right-click your name in the Players list (bottom left), choose **User Configuration**, and pick the investigator as **Character**.
>
> Without one you see a message in the panel's place telling you what to do ([below](#no-investigator-yet)).

![A player's own panel: Make check opens CoC7's roll dialog and the card arrives; then Other, Opposed, Target your opponent, and auto-hide](../media/players-panel.webp)

Each player gets a Rollbox panel of their own investigator: the **Player Rollbox** is on by default, and the Keeper can turn it off. For players, Rollbox is a shortcut to their own investigator: make their own checks at once, take their one action a round on their turn, start rolls with others (opposed, assist), react when attacked, and see their own state and the turn order.

## No investigator yet

Without an assigned investigator, the player sees this message in the panel's place:

> You aren't assigned an investigator. Right-click your name in the Players list (bottom left) and select User Configuration, or ask your Keeper for help.

Rollbox changes nothing itself. The **×** closes the message until the next reload; the panel appears as soon as an investigator is assigned.

## What the Keeper can allow

In **Configure Settings → Keeper's Rollbox**:

1. The feature switch **Player Rollbox** (on by default). Changing it asks for a reload. A world where the Keeper already turned it off keeps that.
2. In the **Player Rollbox** section, tick the features players may use: **Actions (attacks, maneuvers, spells)**, **Checks**, **Combined checks**, **Opposed rolls** and **Assist**. All are ticked by default. Changes apply at once. **Combined checks** works only with **Checks** on: without Checks it gives nothing.

Players have no Sanity or Luck tab: Sanity checks are the Keeper's, and so is calling for Luck (Keeper Rulebook p. 90); players still roll Luck when the Keeper requests it, and spend Luck on CoC7's card. These switches don't limit the Keeper.

## The player's own panel

- It always shows **your own investigator** (your assigned character, when you own it), whatever you select.
- The menu is **Action · Check · Other**. A button shows only when at least one of its features is allowed, and each flyout shows only the allowed tabs.
  - **Action:** attacks, maneuvers, spells and reloads, for your own investigator, **one action per round**. You can open it and get ready at any time (pick a weapon, look at the target), but in combat the act buttons wait for your turn ("Not your turn: get ready, and act on your turn."). After you act, or dive for cover, each tab's content and its buttons grey out, weapons included ("You've acted this round."); a greyed weapon can still be clicked to pick it for next round. Your attack is rolled at once on CoC7's card (the Keeper can turn this off). Out of combat an attack first waits for the Keeper ("Waiting for the Keeper…"), who decides whether your target saw it coming; nothing is rolled before, and once the Keeper answers your attack is rolled at once. Until the Keeper starts combat (or closes their First blow card), your Action reads **Waiting for the Keeper**: no Attack, Maneuver or Spell, and no picking or changing a weapon; Check and Other still work. Restrained, you can only try to **Break free**; a maneuver on a target out of reach reads **Target out of reach**. Your Spell tab has **Cast** only (Cast hidden is the Keeper's). If you dived for cover this round, the Attack tab also says "Dived for cover: no attack this round." Punching and maneuvering need a Punch on your sheet, and a maneuver needs its Maneuver switched on: if not, the panel says so ("Your sheet has no Punch. Ask your Keeper to add it.", "Your Punch has Maneuver off. Ask your Keeper to switch it on.").
  - **Check:** **Characteristic** and **Skill** (Checks), combined checks (Checks and Combined checks). The title reads "Make a check". Tick a check and click **Make check**: CoC7 rolls it straight into chat, Regular with no bonus or penalty dice and no window, exactly as a Shift + click on the value on CoC7's sheet. **Shift + click** on a characteristic of your sheet rolls it at once too. No request is sent, and there is no difficulty, dice, Blind, Hidden or label: those are the Keeper's call, on the Keeper's requests (for anything special, use your character sheet). Without Combined checks you tick one check at a time: a new tick replaces the old one.
  - **Other:** **Opposed** (**Make opposed card**) and **Assist**: helping another character, an investigator, an NPC or a creature. Click **⌖ Target who you're helping**, then click the character you help on the map (anyone but yourself; the token you had targeted isn't used, and your targets come back after); **Escape** or clicking the button again cancels. You join their group, and the Keeper's Assist shows you with them. While you wait you see who is helping and can **Stop helping**; once the Keeper sends it you see the difficulty, who helps and who rolls. Only the roller rolls, with the **Roll Hard STR** button on your panel (you get no chat request for it); with two rollers, one success is enough. If the Keeper cancels the assist, your panel goes back to **Target who you're helping**.
- **Unconscious, dying, dead or in a bout of madness:** your whole menu is greyed, the reason on hover ("Unconscious", "Dying", "Dead", "Bout of madness: the Keeper controls you"). While dying you still get your own **Roll CON** pop-up at the end of each round ("Cecil is dying. Roll CON to stay alive."): your own CoC7 CON check.
- Clicks on your character sheet do only what is allowed: SAN and Luck do nothing for a player. A right click on a Check row without Opposed rolls reads "You can't start an opposed roll."
- Your own checks are made on your own screen. Anything CoC7 needs a Keeper for (an opposed card, an NPC's roll, another player's character, the Keeper's toggles on your attack card) is done by the Keeper's Rollbox. An NPC's side of what you start is the Keeper's to roll, so it may wait for them. If no Keeper is logged in, you are told and nothing is sent.

## Picking a target

You can't select other characters' tokens, so you pick an opponent, a helper or a target by **targeting** them.

- **Already targeted? It is used.** A token you have targeted already is used without asking.
- With no target, Rollbox shows **Select your target** with **Cancel**, and switches you to Foundry's Target tool. The first token you target is picked, and your tool goes back to what it was.
- **Cancel** puts back the targets you had before.
- **Your target is remembered for your investigator:** the Keeper sees it, and when they act for your character their target becomes yours. Your own targets are never changed by anyone else.

In Opposed, **Target your opponent** picks the other side of an opposed roll, whether you opened it from Other or with a right click on your sheet or a Check row. You pick only your own check: what your opponent rolls is your Keeper's choice, and they add it to the card. In Assist, **Target who you're helping** picks the next investigator you click.

## A fight nearby

When a fight breaks out near your investigator (within 60 ft and in sight), you get a card: "A fight has broken out: the Deep One Hybrid attacks Cecil, 40 ft from you." **Join the fight** puts you in it. **Stay out** keeps you **standing by**: you are at the back of the turn order, greyed, and your turn is skipped. Your panel says "Combat in progress" with **Act this round**: press it to take your turn this round (or next round, if your place has passed) to role-play, move a little or make a check, then **End my turn**. Attacking, being attacked, a maneuver or a spell at a target makes you a fighter.

You can drag that card by its top line, and turn the mouse wheel while holding it to resize it; it keeps its place and size for you. **Notice cards size** (Appearance) sets it back to one size.

## Turn controls on your turn

During combat your panel shows the turn order, with your own character as the full sheet in its place; whoever has had their turn this round is a little darker. If your character isn't in the combat (they fled, or never joined), their card stays under the turn order, "Not in combat", and their actions work as out of combat (Reload is one full reload). Your act buttons come back by themselves when your turn does. A click or a right click on someone in the turn order makes them your target, as clicking their token with the Target tool does (also while Rollbox waits for you to target someone); so does a right click on your own character's card. On your turn the controls are **Delay**, **Flee** and **End my turn**, each asking once ("Confirm …") before it acts; Delay's ← and → choose how far down the order you go (none: to the end), shown in the turn order before you confirm. Someone standing by shows as a small greyed name; with more than five standing by, that group scrolls. See [For Keepers](for-keepers.md#turn-controls).

## Being attacked

When a CoC7 attack card names your character, or someone attempts a maneuver on them, a red alert opens beside your menu: "You are being attacked" (Dodge, Fight back, Counter or No response; one click rolls it) or "You are being shot at". With no weapon to fight back with, Fight back tells you to ask your Keeper to add a Punch. The alert closes once CoC7's card has the result. See [Statuses and alerts](statuses-and-alerts.md).

## Auto-hide

Turn on **Auto-hide the character card** (Appearance) and, after the time in **Auto-hide after** without using the panel, your full character sheet drops to the compact card. Hover over the panel to bring it back.

## Turning Rollbox off

The feature switch **Rollbox panel** turns Rollbox off completely on your own screen. If you're asked to roll for an Assist with it off, CoC7's chat request comes to you instead of the panel's Roll button.

## Your own look

Players get their own personal settings: Theme, Panel colour, transparency, size, Allow moving the panel and Reset position, menu side, Panel layer and auto-hide. See [Appearance and themes](appearance.md).

## Settings on this page

- **Player Rollbox** (Keeper settings): the feature switch (on by default) and, in its section, the five features.
- Personal: **Rollbox panel**, **Roll my attacks at once**, **Auto-hide the character card**, **Auto-hide after**, **Panel size** (also the mouse wheel while you drag your panel), **Notice cards size**, **Meters on the small cards**.

All are in the [settings reference](settings.md).

## Shortcuts

The same clicks as the Keeper's sheet, limited to what you're allowed. See [Shortcuts](shortcuts.md).
