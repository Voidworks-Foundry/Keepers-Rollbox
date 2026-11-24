# Action

[← Back to the guide](README.md)

**For:** the Keeper, and players allowed **Actions**.

The **Action** button opens three tabs: **Attack · Maneuver · Spell**. Each starts with the target box. Rollbox makes CoC7's own attack card, opposed card (for a maneuver) or Cast; CoC7 rolls, compares and offers damage.

The Keeper's Action shows with one or two characters selected; with nothing selected or three or more it is hidden.

### The Keeper's limit and Override

The Keeper is limited like the players, with an override: once a character's action is spent, the Attack, Maneuver and Spell tabs' contents and act buttons are greyed. Hovering **Attack** (or any act button) brightens it and reads **Override**, and pressing it asks "Deep One has already acted this round. Override?" **Confirm** lets that one action through; **Cancel** changes nothing.

The same Override serves every limit, each with its reason on hover and its own question:

- **Unconscious, dying or dead** (CoC7's own conditions; Keeper Rulebook p. 120–121): the character's whole Action is greyed ("Belinda is unconscious. Override?"). Check and Other stay open, for a Sanity roll on waking or anything else you rule.
- **Restrained** (Rollbox's own status): Attack and Spell are greyed ("Restrained: you can only try to break free"), and in Maneuver only **Break free** is live (it is picked for you).
- **A maneuver out of reach:** see [Maneuver](#maneuver).

**Attacks per round:** an NPC or creature with more than one attack a round (CoC7's **Attacks per round** on its sheet: a ghoul 3, a dark young 5) shows a small **Attacks: 3/3** (left / per round) on the Attack tab in combat. Each attack or maneuver spends one, at any target; the last spends its action. A spell, a reload or Aim spends the action at once. With one attack a round, nothing is shown. Investigators have one action.

**NPC attacks are rolled at once:** when you attack with an NPC or creature, Rollbox sets CoC7's toggles on its attack card and presses its roll button (setting **Roll NPC attacks at once**, on by default). **So are investigators' attacks:** an attack you make for an investigator is rolled at once on CoC7's card, once its toggles are set (setting **Roll investigators' attacks at once**, on by default); each player decides for their own attacks with their personal **Roll my attacks at once** (on by default). CoC7's **Automatic Success** on its melee card is a toggle for you, not a result.

### Two selected: one acts on the other

With two selected, the first one acts and the second is the target. The flyout shows **Acting** and the acting character's name, with **⇅ Swap** to switch them. The target is made your Foundry target (CoC7's card reads it), so the target box has no Change or ×.

### A player's one action per round

A player acts only for their own investigator, **one action per round**: an attack, Aim, a reload, a maneuver or a spell. They can open everything at any time and get ready (pick a weapon, look at the target), but in combat the act buttons wait for their turn: "Not your turn: get ready, and act on your turn." Once they have acted, or dived for cover, each tab's content and its act buttons grey out, weapon rows included, and the flyout reads "You've acted this round." (a player has no Override); a greyed weapon can still be clicked to pick it for next round.

- **Waiting for the Keeper:** while the Keeper decides a first blow (from About to attack until they press Start combat or close the First blow card), every player's Action reads "Waiting for the Keeper": no Attack, Maneuver or Spell, and no picking or changing a weapon, so they go into combat with the weapon they had. Check and Other stay open. Once the Keeper has answered About to attack, a player's waiting attack (a gun's too) is rolled at once, as **Roll my attacks at once** says.
- **Restrained:** only Break free, in Maneuver.
- **Unconscious, dying, dead, or in a bout of madness** (CoC7's Bout of madness condition): the player's whole menu is greyed (Action, Check and Other), the reason on hover ("Unconscious", "Dying", "Dead", "Bout of madness: the Keeper controls you"). A dying investigator's player still gets their own **Roll CON** at each round's end ([For Keepers](for-keepers.md#dying)).

## The target box

At the top of every tab:

- **Target a token** switches to Foundry's Target tool; the select tool comes back after you pick.
- **Type a target** for an object, such as a door or a lock. CoC7's card then has no target, and CoC7 may ask whether to go on.
- A targeted token shows its name, its distance edge to edge in the scene's units ("6 ft away") and its Build (POW on Spell), with **Change** and **×**. CoC7's own attack card measures centre to centre, so its distance can be a little larger.
- Under it, one line per **status** and per **situation** Rollbox reads from the board (point blank, firing into melee, outnumbered): the name on the left (serious ones in red, Rollbox's own in blue), its effect for the picked weapon on the right ("Effect: 1 penalty die", "Effect: none"); hover a line for the reason. When something applies, a last line reads "On CoC7's attack card" with the total, and Rollbox sets it on CoC7's attack card. See [Statuses and alerts](statuses-and-alerts.md#what-statuses-do-to-an-attack).
- When a gun is aimed at a player's character, the box shows their choice: waiting, dived for cover (Under cover goes on CoC7's card) or stood their ground. The attack is never held for it.

A player who has already targeted a token uses it as is. See [For players](for-players.md#picking-a-target).

**Each character remembers its own target:** whoever a character last targeted (you acting for them, or their player) is kept for them until they target someone else. When you act for a character (select their token, click them in the turn order, or the turn moves to them), your Foundry target becomes that character's, or none. A player's own targets are never changed. In and out of combat; off with the Gameplay rules. A target whose token is deleted is forgotten.

## Attack

![Targeting a prone cultist, picking the revolver, and CoC7's attack card with the dice set](../media/action-attack.webp)

1. Target a token, or type a target.
2. Pick a weapon. **Unarmed** is always first, then the character's weapons A to Z with their skill values, range or damage, and ammunition. A melee weapon beyond its reach (edge to edge) is greyed out and reads "Out of reach". Move a token and the distance and reach follow at once.
3. Click **Attack**. Rollbox makes CoC7's own attack card; it never rolls it.

The picked weapon's row is outlined in the accent colour and spells out its details: the skill and its values, the damage and range, the attacks per round and the ammunition ("Skill Handgun 40 · 20 · 8", "Damage 1D10 · Range 15 yd", "Attacks per round 1 (max 3) · Ammunition 6/6").

The picked weapon is kept on the character. You can switch freely; after acting, the flyout says "Switched to X for next round". It is cleared when combat ends. Click the weapon already picked to put it away: nothing is picked.

**Putting a drawn gun away in combat.** A readied gun acts at DEX + 50 (CoC7's **Draw gun**), but only for shooting it (Keeper Rulebook p. 112 and p. 127). So in combat, putting it away (clicking it again) or switching from it to a weapon with no readied bonus (a melee weapon, unarmed, an improvised weapon) asks first: "Holstering puts Cecil back to their DEX in the turn order (95 → 45). Holster?" (**Holster** · **Cancel**), or "Switching to Punch puts Cecil … Switch?" (**Switch** · **Cancel**). On yes, Draw gun goes off at once and the turn order is redrawn with them at their DEX: the one exception to the order staying put. If they have already acted this round they don't act again; if not, they act at their new place (on their own turn, the turn goes to whoever is now above them first). Cancel keeps the gun. Switching from one gun to another asks nothing. Out of combat, or for anything but a drawn gun, there is no question.

A character who dived for cover this round can't attack: the Attack tab reads "Dived for cover: no attack this round." For a player its buttons are greyed out until the next round; the Keeper only sees the line. See [Statuses and alerts](statuses-and-alerts.md#you-are-being-shot-at).

A melee attack needs a target: target a token, or type one. Rollbox then always makes CoC7's melee attack card.

**Unarmed with none on the sheet.** CoC7 attacks only with weapon items, so a sheet needs an unarmed weapon. Picking **Unarmed** and clicking **Attack** for a character who has none, the Keeper is asked: "Cecil has no unarmed attack. Add **Punch** to Cecil's sheet?" **Add** puts CoC7's own Punch on the sheet, on the character's own Fighting (Brawl), and goes on with the attack; it stays on the sheet. **Cancel** changes nothing. A creature gets **Fighting**, on the skill its attacks use (a skill list asks when Rollbox can't tell). A player is told instead: "Your sheet has no Punch. Ask your Keeper to add it." An unarmed weapon whose skill CoC7 can't find on the sheet (its card would have no roll button) gets the same kind of question: "Link it to Fighting (Brawl)?" **Fix**. The [setup check](for-keepers.md#setup-check) offers all of these before play.

With no combat running, picking a real weapon is a weapon drawn: the Keeper gets a pop-up (a player sees nothing of it; never for an unarmed attack or a creature). An attack on a token with no combat running first asks the Keeper whether the target sees it coming (**About to attack**: the flyout says "Waiting for the Keeper…" to a player until the Keeper answers; a surprised target gets no response and the attacker an automatic hit or one bonus die), then it is **the first blow**: it plays out on CoC7's cards, then the Keeper starts combat from the top of the order (see [For Keepers](for-keepers.md#about-to-attack-surprise)). In combat drawing a weapon brings up nothing. See [For Keepers](for-keepers.md#from-a-drawn-weapon-to-combat).

### Aim

In combat a gun adds **Aim**. Aiming uses the turn; the next shot, next round, gets CoC7's **Aiming** tick (one bonus die). Aiming ends once that shot is made. Out of combat there is no Aim: there are no rounds.

### Reloading

![An empty revolver: Attack greyed out, Load one and fire, then Reload](../media/action-empty-gun.webp)

*(The capture shows the reload buttons from an earlier build: an empty-gun box above Attack. It is redone at the recapture.)*

**Out of combat**, a gun that isn't full (empty too) adds **Reload** beside Attack: CoC7's own full reload. There are no rounds out of combat.

**In combat**, a gun that isn't full (not only an empty one) gets a **Reload line** of its own under Attack:

- **Reload 2 rounds** for a revolver, rifle or shotgun ("Reload 1 round" when only one more fits), **New magazine** for an automatic, submachine gun or assault rifle, **New belt** for a machine gun ("Takes 2 turns": keep to that yourself). Each uses the turn, as the rulebook says (p. 113).
- **Load one and fire:** one round goes in and the gun fires at once, with a penalty die; Rollbox ticks **Reloading** on CoC7's card.

An empty gun greys out Attack ("Empty: reload, or load one and fire."); Reload stays live.

**The reload card.** Every reload through Rollbox posts a short card in chat, spoken by the character: "Cecil reloads his .38 Revolver (6/6)." (the rounds now loaded and how many it holds). It is whispered to the Keepers and the character's player; the Keeper can show it to everyone from chat. Rollbox says "his" or "her" when the sheet's Sex field says so, otherwise "their".

**How Rollbox knows how a gun loads.** CoC7 doesn't say, so Rollbox decides once per weapon and remembers it on the weapon: every firearm in CoC7's and the Keeper items' compendiums is in Rollbox's own table (a Luger takes a magazine, a Lewis gun a pan magazine, a Vickers a belt); any other gun goes by its skill and name (a handgun takes a magazine unless its name says revolver, derringer or flintlock; rifles and shotguns load two rounds; a machine gun a belt). A custom gun whose name says neither way is asked in the [setup check](for-keepers.md#setup-check).

### Multi-shot

A gun that CoC7 lets fire more than once a round (a revolver's "Attacks per round 1 (max 3)") adds **Fire: Single shot · Multi-shot**. Pick **Multi-shot** and a **Shots** row shows: 1 · 2 · 3, up to the gun's most per round, the most it can fire now picked (numbers beyond the rounds loaded are greyed). **Attack** then fires them all on CoC7's ranged card: Rollbox turns on CoC7's **Multi. Shots**, presses the target's Shoot once per shot and then the card's bottom **Shoot**, so every shot rolls at once. CoC7 puts its own penalty die on each shot, spends the rounds and offers Roll damage for the hits.

### Improvised weapon

**+ Improvised weapon** at the bottom of the list: type what it is and pick the skill. It is sent as a labelled skill check, as in [Other → Item](other.md#item).

## Maneuver

![A maneuver against a bigger NPC, with Build dice, Attempt to knock down, and CoC7's opposed card](../media/action-maneuver.webp)

*(The capture shows the maneuver from an earlier build: a Response row, and CoC7's opposed card before Rollbox filled it in. It is redone at the recapture.)*

A maneuver runs on CoC7's own **opposed card in combat mode** ("Attack Maneuver"), the card CoC7 uses for maneuvers. Rollbox drives it in this order:

1. Target a token.
2. Pick the **goal**, in two rows of three: Restrain, Knock down, Disarm, Push away, Break free or Knock out. **Break free** is greyed unless the character is held ("Not held: nothing to break free from"); a Restrained character has only Break free. **Out of reach:** with the target beyond melee reach (edge to edge; the maneuver weapon's own reach, such as a whip's), every goal but Break free is greyed ("Out of reach") and the button reads **Target out of reach**. Moving a token updates it at once. The Keeper can Override.
3. With several maneuver weapons (a creature), pick one.
4. Read the **Build dice**: one penalty die for each point of Build the target has over the attacker (Keeper Rulebook p. 105). Three or more points: not possible. Rollbox puts them on CoC7's card.
5. Click the button, which names the goal: **Attempt to restrain**, **Attempt to knock down**, **Attempt to disarm**, **Attempt to push away**, **Attempt to break free** or **Attempt to knock out**. Rollbox posts a line in chat, spoken by the attacker: "Cecil attempts to push away (maneuver) Deep One Hybrid." A maneuver is the character's action for the round.
6. The target answers on the being-attacked alert: **Dodge**, **Fight back** (a button for each melee weapon), **Counter** (their own maneuver weapon, the Punch first, then the goal; without one it reads "No maneuver weapon" and asks the Keeper to switch Maneuver on or add a Punch) or **No response** (CoC7 then rolls the maneuver alone). A player answers on their own screen; the Keeper answers for an NPC, for an investigator whose player is offline, and for everyone while the Player Rollbox is off. See [Statuses and alerts](statuses-and-alerts.md#a-maneuver).
7. Rollbox makes CoC7's opposed card with both sides filled in (the attacker's maneuver weapon with the Build dice; the defender's Dodge, weapon or maneuver weapon) and presses CoC7's **Start Rolls**: NPCs roll at once; a player who answered has their row rolled by their Rollbox; an attacker whose player is online rolls their own row.
8. On a tie where both succeed, CoC7 offers the Keeper **Advantage: Attacker** or **Advantage: Defender**; Rollbox presses the one the rules give: a dodger wins the tie; against Fight back or Counter the attacker does.

CoC7 says who won: "Cecil maneuver was successful.", "Deep One Hybrid dodged!", "Deep One Hybrid landed a blow." (fought back), or "Both side failed." (CoC7's wording). After a won maneuver CoC7 offers **Roll damage** on its card: a maneuver does no damage, so close the card instead. A defender who fights back with a weapon that has Maneuver on (a Punch) fights back with the weapon itself: Rollbox switches its Maneuver off while CoC7 makes the card and back on at once, so CoC7 treats it as an ordinary weapon. A win reads "landed a blow" with CoC7's own **Roll damage**: press it for CoC7's damage card, aimed at the loser.

**The maneuver weapon** is a weapon with CoC7's **Maneuver** switched on (the weapon sheet's header), as the rulebook writes "Seize (mnvr)" in a monster's stat block: the **Punch with Maneuver on** for investigators and NPCs (a creature's own "(mnvr)" attacks first, or its Fighting). The Punch stays the unarmed weapon for **Attack**, where CoC7's attack card ignores the switch. When the Punch has Maneuver off, the Keeper is asked once: "Switch Maneuver on for Cecil's Punch?" (**Switch on** · **Cancel**). With no Punch at all: "Add **Punch** to Cecil's sheet? Its Maneuver is switched on." A player reads "Your Punch has Maneuver off. Ask your Keeper to switch it on." (or "Your sheet has no Punch. Ask your Keeper to add it."). A **Maneuver (Brawl)** added by the last version stays on the sheet and still works.

What the goal does once it succeeds is the Keeper's to apply. After a **Restrain**, the Keeper gets **Set Restrained: <target>** under the result: press it when CoC7's card shows the maneuver succeeded. The target then shows a Restrained status card; the × on that card clears it. See [Statuses and alerts](statuses-and-alerts.md#status-cards).

## Spell

![Casting a spell, the first-casting POW request, marked as cast](../media/action-spell.webp)

1. Pick a spell. Each shows its MP, casting time and costs as written. **In combat** only the spells cast instantly or in 6 rounds or fewer are listed (the worst case of the casting time: 1D3 rounds counts as 3), combat spells first; slower ones, spells whose casting makes doses to apply later (Powder of Ibn-Ghazi, Dust of Suleiman) and times Rollbox can't read clearly ("5+ rounds") are hidden until combat ends. To try one in a fight anyway, cast it from the character sheet. Out of combat every spell shows.
2. Hover over a spell to read its full description beside the flyout (or click it, or never: the **Spell text in the Spell tab** setting).
3. Click **Cast** or **Cast hidden** (CoC7's hidden cast; the Keeper's only, also when acting for an investigator: a player's Spell tab has just Cast): CoC7's own Cast, with its Spell Costs dialog. While that window is open, Rollbox's own box beside it shows the spell's description and the target's distance (**Show a spell's text while casting**). Rollbox works out no costs and blocks nothing: the text is the spell's, as written. A target is never required.
4. A spell the investigator hasn't cast yet has a **red outline** ("First casting: Hard POW check needed" on hover). The first casting asks for a Hard POW check after CoC7's cast. When CoC7's card comes back a success, Rollbox marks the spell as cast. **Mark as cast** stays for the Keeper, in case.
5. After a cast, **Opposed POW with target** makes CoC7's opposed POW card.

## Settings on this page

- **Spell text in the Spell tab** and **Show a spell's text while casting** (Spells, personal): see [Settings](settings.md#spells).
- **Melee reach (m)** (Gameplay, Keeper): how close a target must be for a melee weapon, in metres edge to edge (the scene's feet are converted). Also how close someone must be to a shot's target for **firing into melee**. Default 1 m. A melee weapon with a range of its own (CoC7's bullwhip, 10 ft; mace spray, 6 ft) reaches that far instead.
- **Gameplay rules** and the notice settings: see [For Keepers](for-keepers.md#settings-on-this-page).
- **Actions** (Player Rollbox, Keeper): whether players get this flyout.

## Shortcuts

None of its own. Foundry's **T** key targets the token under the mouse, as always.
