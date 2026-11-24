# For Keepers

[← Back to the guide](README.md)

**For:** the Keeper.

This page is the Keeper's side of the table: the players list, the panel with several characters, sending requests, NPCs, and running combat from the panel. For the Keeper, Rollbox is a control desk for the table's rolls: ask for rolls from one investigator, several or all of them, roll for NPCs, set up two-sided rolls, run combat, and see each character's state at a glance.

## Nothing selected: the players list

With no token selected, the panel lists **Investigators**: each player's assigned investigator, with "occupation · player" ("· offline" when that player isn't logged in) and the bars chosen in **Meters on the small cards** (HP, MP, SAN and Luck by default). Click a row to select that investigator's token. A row whose investigator has no token on this scene is greyed out.

**Check** and **Other** then go to every investigator (and **Opposed** opens with both sides to pick): the flyout says "No one selected: this goes to every investigator." and "Select tokens to choose who.", and the button reads **Send to all players**. The Skill tab lists every skill A to Z, without values. Action, Item and the Group Luck roll need a selection.

Turn off **Show the players when nothing is selected** (personal) and the panel hides with nothing selected. During combat the turn order shows instead.

## Several characters at once

Select every character who should roll: drag a box around their tokens, or Shift-click them. With three or more, each gets a character card, and the cards show HP, MP, SAN and Luck as bars (STR or SIZ on Assist; untick any of them in **Meters on the small cards**, Appearance). Ten cards show before the list scrolls. Hover a card and click its **×** to leave that character out (with one selected, the same **×** on the portrait deselects them).

A check sent to several characters goes to each one: every player gets their own request, and every NPC is rolled for you. With several characters the Skill tab lists every skill A to Z, without values. With three or more there is no Action button: an action is one character's, or one acting on another.

With exactly two selected, Action is for the first one acting on the second: see [Action](action.md#two-selected-one-acts-on-the-other).

## Sending requests to players

- One send button: **Send to all players**, **Send to <player> (<name>)** or **Send to each (N)** whispers the request privately to each character's owner, the way CoC7's "Whisper to selected tokens" does. The player clicks it in their chat and CoC7 rolls.
- There is no public request and no copied link: a CoC7 link isn't tied to a character, so anyone could roll it, any number of times. If you want one, use CoC7's own Create link tool.

## NPCs rolled by the Keeper

A character with no player owner is an NPC. When you send a request, Rollbox rolls the NPC's side privately for you at once, with nothing to click. When a player starts a check that involves an NPC (an Assist where an NPC rolls), Rollbox rolls the NPC privately for you at once too. On an opposed card a player starts, Rollbox leaves **Start rolls** to you and tells you so. A skill missing from an NPC's sheet is rolled at its base value, and nothing is added to the sheet. An NPC's Sanity check is the one public NPC roll: Rollbox makes CoC7's Sanity card and rolls it.

## Running combat

### From a drawn weapon to combat

![A weapon is drawn, the Keeper's own notice card with its five buttons, Start combat, and the turn order appears](../media/keepers-notice-to-combat.webp)

When an investigator or an NPC picks a real weapon in the Action flyout and no combat is running, you get a **pop-up** just above the macro bar: "Harvey draws .38 Revolver.", and who could notice. It is yours only: it shows on your screen, even when a player drew the weapon, and players see nothing of it. It never comes up for an unarmed attack (the sheet's Punch) or for a creature (its claws can't be told from a carried weapon), and in combat drawing a weapon brings up nothing. Its buttons:

- **Roll to notice:** a Spot Hidden roll for each one who could see it, its difficulty from the drawer's Stealth. An investigator whose player is online gets it as a roll request, as any check; everyone else (an investigator with no player online, an NPC, a creature) is rolled privately for you at once (at its base value when Spot Hidden isn't on its sheet). Nothing comes to you to click.
- **Nobody notices**, or **Everyone notices** (each investigator in range is whispered that they saw it).
- **Start combat.**
- **Ignore:** closes it, for a weapon picked by mistake.

**The pop-up is the list.** Under "Could notice:" each character has a row with their status: **Waiting** (not rolled yet), then **Noticed** or **Didn't notice** as CoC7's card for their roll comes in. Each row also has **Noticed** · **Didn't notice**: settle it yourself, with or without a roll (a Waiting row too); Noticed counts as a rolled Noticed (the player's line, About to attack), and a roll still out for that row no longer changes it. Read the results there: Rollbox posts nothing else for you (CoC7's own check cards stay, the NPCs' private). Each player whose investigator noticed gets a private line: "You see Harvey draw a weapon." After Roll to notice, Nobody or Everyone, the pop-up says what you chose and keeps **Start combat** · **Ignore** under the list; Ignore and its ✕ close it, rows still waiting or not, and nothing waits for a roll after that.

Someone marked **Noticed** stays ready: if the one who drew then attacks them out of combat, **About to attack** opens with **Saw it coming** already chosen (its main button, and a line saying why); you can still pick another answer.

**Notice when a weapon is drawn** (Gameplay) is on by default; turn it off and no weapon-drawn pop-up comes up.

### About to attack: surprise

Out of combat, any attack from the Action flyout (yours for an NPC or creature, or a player's) first brings up a second pop-up above the macro bar, before anything is rolled: **"Deep One is about to attack Cecil"**. Does the target see it coming (Keeper Rulebook, Striking the First Blow)?

- **Roll to notice:** **Spot Hidden**, **Listen** or **Psychology**, a normal roll request to the target's player when they are online, or rolled privately for you at once otherwise (its difficulty from the attacker's Stealth). The pop-up waits ("Waiting for Cecil's Spot Hidden…") and the result decides by itself as soon as CoC7's card has it (private, blind or revealed; also a creature or NPC rolled at its base value because the skill isn't on its sheet): a failure means surprised, a success saw it coming. You can still decide yourself while it waits.
- **Surprised:** the target gets **no response** (no alert; Rollbox answers No response on CoC7's card for them). Pick the rulebook's bonus: **Automatic hit** (CoC7's own Automatic success on its melee card: a hit unless a fumble; a gun's card, a maneuver and an improvised weapon have none, so it is greyed there) or **One bonus die**.
- **Saw it coming:** the attack goes ahead as usual, and the target gets their alert (Dodge, Fight back, Counter, No response).
- **Ignore** (or the pop-up's ✕): the attack goes ahead as usual and starts no combat.

A player's attack waits ("Waiting for the Keeper…" in their Action flyout) until you answer; then it is rolled at once, whatever you answered (Ignore included), as **Roll my attacks at once**, **Roll investigators' attacks at once** or **Roll NPC attacks at once** says for that attacker. Then the First blow card (below). From the moment About to attack opens until you press Start combat or close the First blow card, **every player's Action waits**: "Waiting for the Keeper", no Attack, Maneuver or Spell and no picking or changing a weapon, so they go into combat with the weapon they had. Check and Other stay open; you are never locked. It comes up whenever the **Gameplay rules** are on; it has no switch of its own. It is separate from the weapon-drawn pop-up, which is about who in the room notices a weapon coming out.

Who could notice follows the **Notice range** setting: anyone in sight, or only those within the **Notice distance** and in sight. Walls and closed doors block sight.

### How a fight starts

An attack from the Action flyout (Attack, Maneuver or an improvised weapon) on a token with no combat running is **the first blow** (Keeper Rulebook, Striking the First Blow): no combat round starts yet. The attack plays out on CoC7's cards as usual (the target's Dodge or Fight back, the rolls, the damage), and you get a card above the macro bar with just **Start combat** and its ✕. Another attack before you press it joins the same first blow; the card's ✕ forgets it (no combat).

**Start combat** opens **Who's joining this fight?** with the attacker and the target already in. Its **Start combat** makes the combat, rolls everyone's initiative through CoC7 (a readied gun's DEX + 50 included) and starts round 1 **at the top of the order**. The attacker gets their normal turn in round 1: the first blow isn't their action. Cancel brings the First blow card back. There is no Start combat button for selected tokens: a fight starts with an attack (the weapon-drawn card's Start combat stays).

- **Who's joining this fight?** The window lists everyone within the join range (in sight or not, hidden or not), with their distance. In a fight between Friendly and Hostile, everyone in range and in sight is ticked; with a Neutral or Secret token in the fight, nobody is. **Start combat** makes the ticked ones fighters with the two. An investigator whose player is asked (below) isn't ticked: the player decides, and you can still tick them.
- **Standing by:** everyone else who joins on their own (investigators and **Friendly** or **Hostile** tokens within the **Join range**, 60 ft, edge to edge, and in sight of a fighter: no wall blocking sight between) goes into the turn order **standing by**: at their DEX place, greyed, "Standing by". Their turn is skipped. **Neutral**, **Secret** and hidden tokens are never added on their own.
- **The players' join card:** a player whose investigator stands by (with the Player Rollbox on) gets "A fight has broken out: the Deep One Hybrid attacks Cecil, 40 ft from you." with **Stay out** or **Join the fight**.
- **Where the fight's cards open:** each of these cards (First blow, Who's joining this fight?, the joining card, the flee notice, the chase reminder) opens just above the macro bar, never over it; several stack upwards, the newest nearest the bar. Each can be dragged by its top line, and the mouse wheel while you hold it makes it bigger or smaller; each kind of card then keeps its own place and size for you. **Notice cards size** (Appearance) sets every card back to one size.
- **Becoming a fighter:** attacking, being attacked, a maneuver, or casting a spell at a target clears Standing by.
- **Acting while standing by:** the player's **Act this round** stops the turn order on them: they role-play, move a little or make a check, then End turn. It counts for one round (the next, if their place this round has passed). For an NPC standing by (or an investigator with no player to ask), click their row in the turn order: the turn controls then have **Act this round** in End turn's place.
- **During the fight:** anyone attacked who isn't in combat joins it. At the start of every turn, everyone (an investigator, Friendly or Hostile) who came within range and in sight of a fighter is listed on **one joining card**: "Coming into range:", then each name ("Helen (in sight of the Deep One)") with **Add** and **Leave out**, and with two or more listed, **Leave all** and **Add all** under them. Add brings them in (an investigator whose player is asked stands by and gets the join card; the rest fight). Leave out keeps them out for the rest of this fight: Rollbox never asks about them again. Nobody comes in until you press Add; close the card and those not answered are listed again at the next turn while they are in range. Someone standing by who walks out of range leaves the combat.
- **An attack from hiding:** a token that isn't in the combat and attacks is added at once and revealed if hidden; its attack is its action this round, and it acts in the DEX order from the next.
- **Initiative:** everyone Rollbox adds gets CoC7's initiative (DEX, or DEX + 50 with Draw gun). With CoC7's optional initiative rule, CoC7 posts an "Initiative roll" card for each one.
- A combat you build yourself in Foundry's combat tracker is left as you built it: nobody is added or dropped at the start of a turn.

### The turn order in the panel

While Foundry runs an encounter, the character panel shows **Combat · Round N**, then everyone in turn order: the same order as Foundry's combat tracker, top to bottom, and it stays put. Whoever's turn it is opens as the full card **in their own place**; those who have acted this round are dimmed above it. **End of round N** sits under the last fighter, and everyone standing by is always their own group under it.

- Everyone is a small card: portrait, name, player or "NPC", "Readied firearm", "Defeated", this round's notes (Aiming, Dived for cover, Stood their ground, Acted, Delayed, Fled), the bars chosen in **Meters on the small cards** (thinner than on the character cards). No initiative number: the order shows who goes when (Foundry's combat tracker still shows it). Everyone standing by sits in the **Standing by** group under End of round, highest DEX first, as a **compact** card: the name only, half height, greyed (hover it for "Standing by" or "Standing by · acts this round"). Their initiative isn't changed, so Remove from standby puts them back in their place. Whoever has had their turn this round is a little darker.
- The selected character shows their full character sheet, with their status cards above it, in their own place in the order (or in the Standing by group). The current turn keeps its red outline, full or small.
- **Selection follows the turn:** at every turn change your menu goes back to acting for the current turn's character. With the setting **At each new turn** (Turn order and turn controls section, personal) on **Select the current turn's token** (the default), Rollbox also selects that token on your map, so the panel shows them; selecting a token with vision shows you that token's view, as clicking it would. On **Keep my selection**, Rollbox never changes what you have selected, and the panel follows the turn only while nothing is selected.
- **Act for anyone:** click (left click) someone in the turn order. Their full card gets a blue outline, and Action, Check and Other act for them, for example to force a check at some event. The send button names who it goes to: **Send to <player> (Cecil)** (the player the character is assigned to; with nobody assigned, every player who owns them), or **Roll for Deep One** for an NPC. Click the current turn's card to go back; selecting a token on the map works too.
- **Someone not in the fight:** select their token. Their card shows above the round line, "Not in combat", with **Add to combat ↓** under it (adds them, with CoC7's initiative). Checks and actions work for them as usual; the turn controls keep only **End combat**.
- **Target from the turn order:** right click someone in the turn order (a row or the full card) to make them your target; a right click on a character anywhere in Rollbox does the same. While Rollbox waits for a target (Target a token, Pick a target, Add a character), a left click targets too. The setting **Left click in the turn order** (Turn order and turn controls section, personal) decides only the left click: **Selects** (act for them) or **Targets**; the right click always targets.
- **Move the combat box:** with **Allow moving the panel** on, drag it from anywhere on it (the round line, a card, a row, a button). A click without moving still selects or presses.
- **Turn order and turn controls** (a feature switch, personal, on): turn it off to run combat in Foundry's own combat tracker; the panel then works as it does out of combat.
- **More than five standing by:** the Standing by group shows five and scrolls for the rest; its title stays put. A selected or acting character in it is scrolled into view, and the list stays where you scrolled it.
- **Defeated:** someone CoC7 marks unconscious, dying or dead is marked defeated in Foundry's combat tracker, until CoC7 clears it. Their turns are skipped only while Foundry's own **Skip defeated** is on (the combat tracker's settings, off by default); off, they keep their turns, marked Defeated.
- With nothing selected, the turn order stays, and your menu acts for the one you clicked in the turn order, or whoever's turn it is. The sheet's values can be clicked as usual.

### Turn controls

![End turn and its confirm; Delay with the counter](../media/keepers-turn-controls.webp)

*(The capture shows Delay's number box from an earlier build; Delay now has an arrow either side of its confirm, with Place on standby and Leave out in End combat's row. It is redone at the recapture.)*

Under the turn order: **Delay** and **Flee**, then **End turn** and **End combat**. Each asks once: the button turns red and reads "Confirm end turn" (or "Confirm delay", "Confirm flee combat", "Confirm leave out", "Confirm end combat"). Press it again to confirm. Delay and Flee act on the **selected** character (the full card in the turn order). Delaying and fleeing use one's turn, so with someone selected whose turn it isn't, Delay and Flee aren't shown.

- **End turn** moves Foundry's combat to the next turn.
- **Delay** turns End turn into **[←] Confirm delay [→]**, and End combat's row into **Place on standby** · **Leave out** (press Delay again and End turn and End combat come back). Confirm with no arrow pressed moves the character to the end of this round's order. Each **→** moves them one more place down, past the next fighter (the turn order shows where they will go, and the button reads "Confirm delay (2)"); **←** moves them back up. Confirm delay **ends their turn**: the next character acts and is selected. For this round only: next round they are back in their usual place. **The last fighter of the round** has nobody to wait for: Delay then shows **Place on standby** · **Leave out** where End turn was, with End combat under them (press Delay again for End turn).
- **Place on standby** (with Delay pressed) **ends their turn**: they turn grey, go to the back of the order and are skipped; the next character acts and is selected. It also puts their gun away: CoC7's **Draw gun** is turned off for them. Turning **Draw gun** on for someone standing by (in Foundry's combat tracker) brings them back into the fight at their new initiative; if that place has already passed this round, they act next round. **Leave out** takes them out of the turn order for the rest of this fight; select their token and press **Add to combat ↓** to bring them back.
- **Someone standing by:** select them and the controls offer only **Act this round** · **Leave out**, **Remove from standby** and **End combat**. Remove makes them a fighter again, at their own place in the order. When the order stops on them (Act this round), they get the normal controls for that turn and are back on standby after it.
- **Flee** asks at once (End turn turns red: "Confirm flee combat"; press Flee again to take it back). Confirmed, it notes Fled, moves on and removes the character from the encounter. By the rules (p. 409) a character with an escape route who isn't held may use their action to flee; whether there is a way out is yours to say. A character you marked **Restrained** can't flee until they break free (a maneuver on their turn): Flee is greyed, and its hover says "Restrained: break free first"; hover it and it reads **Override**, press it to flee anyway. Whenever someone flees (your Flee or a player's), you get a notice: "Helen flees. Does anyone give chase?" **Let them go** (a player's fled character then leaves the encounter) or **Chase**, which opens CoC7's chase tool (a new Chase item, as Items › Create Item › Chase does; add the participants there).
- **End combat** ends the encounter, in place of Foundry's own End Combat dialog.

### Readied firearms

![A gun-holder's initiative jumps at the start of the round](../media/keepers-readied-firearm.webp)

At the start of each round, everyone whose picked weapon is a firearm gets CoC7's **Draw gun** (DEX + 50), the same toggle as on CoC7's combat tracker. Everyone whose picked weapon isn't a gun loses it. Whoever moves to the top of the order this way acts first in that round.

A gun picked during a round is used at normal DEX that round, and is readied (DEX + 50) from the start of the next. Someone standing by never gets Draw gun at the start of a round: their weapon is put away until they rejoin.

- Picking a weapon that isn't a gun clears it at once, unless that character's turn has already come this round: then the change waits for the next round, so nobody after them loses their turn.
- Picking another gun clears it for the round, while **Switching weapons loses the readied firearm for the round** is on.
- Bows count only with **Bows count as readied firearms**.
- Characters who never picked a weapon are left to you.

### Dying

Someone dying (CoC7's Dying: 0 HP with a major wound; Keeper Rulebook p. 120–121) rolls CON at the end of the next round and every round after. Rollbox brings the roll by itself: at the end of each round, from the end of the round after they started dying, a pop-up **"Cecil is dying. Roll CON to stay alive."** with **Roll CON** goes to the investigator's player (their own CoC7 CON check, Regular; the one thing their greyed menu still allows), or to you for an NPC, a creature or an investigator whose player is offline (rolled privately). Someone already dying when the fight starts rolls at the end of round 1. A failed roll brings you **"Cecil failed CON while dying."** with **Mark dead** (sets CoC7's own Dead, as its sheet's toggle does) or **Handle it yourself** (closes it; nothing changed). It stops once CoC7 no longer marks them dying (stabilised: First Aid stays yours and CoC7's). Don't also press CoC7's own Dying check on the sheet: it would roll a second time, and CoC7's own check marks Dead by itself on a failure. Off with the Gameplay rules.

### Round notes

Each character gets one note per round (Aiming, Dived for cover, Stood their ground, Acted, Delayed, Fled). They show on the turn-order rows and clear when the round changes. Aiming lasts into the next round, for the aimed shot.

## Setup check

CoC7 attacks only with weapon items, and says nothing about how a gun reloads. So a few seconds after you log in, Rollbox looks over every sheet in the world and on the current scene (it takes about a millisecond) and, if anything needs setting up, shows a notice at the top: "**Rollbox:** 5 things to set up on 4 sheets." **Review** opens the list: each character or monster with the number of things, and **Open sheet** to fix it by hand. **Review one at a time** then asks one thing at a time:

- **How does a gun load?** Magazine, 2 rounds at a time, or Belt, for a custom gun Rollbox can't tell from its name or skill. Every gun Rollbox can tell is saved without asking.
- **An unarmed weapon with no skill set:** CoC7's attack card can't roll without it. **Fix** links it to the character's Fighting (Brawl).

A missing Punch or maneuver attack isn't asked here: the Action flyout asks you when one is used.

Each question has **Back**, **Skip** (asked again next time) and **Open sheet**; **Later** closes the window. The **Done** view lists each sheet as Done or Skipped. **Reload kinds** (in the list and in Done) lists every gun on the sheets with how it reloads (Magazine, 2 rounds or Belt; "a guess" when Rollbox only guessed from the name): press another kind to correct one, and it is saved at once. Answers Rollbox is sure of (how a gun it can tell reloads) are saved at once; nothing else on a sheet changes unless you press a button, and a save that fails says so in the window. A gun added to a sheet, or a new character, is checked as soon as it is added. Players never see any of it.

Turn it off with the feature switch **Setup check at login**; **Check now** (in the **Setup check** section of the settings) runs it any time.

## Settings on this page

- **Show the players when nothing is selected** (Rollbox panel section, personal): the players list.

The feature switch **Gameplay rules** and its section (Keeper settings, they apply to everyone):

- **Gameplay rules:** the feature switch for all of them. Off, none of the rules below run (the first blow and who joins, About to attack, readied firearms, the weapon-drawn notice, the melee reach). The round's bookkeeping still runs: round notes clear and delayed characters go back to their place at each new round.
- **Notice when a weapon is drawn:** the weapon-drawn pop-up above.
- **Join range (ft):** how close (edge to edge) to a fighter, and in sight, someone must be to join a fight (60 ft).
- **Manage readied firearms**, **Bows count as readied firearms**, **Switching weapons loses the readied firearm for the round**.
- **Notice range** and **Notice distance (m)** (in metres, edge to edge between tokens; the scene's feet are converted).
- **Melee reach (m)**: see [Action](action.md#settings-on-this-page); it is also the distance for firing into melee.
- **Roll NPC attacks at once** and **Roll investigators' attacks at once**: see [Action](action.md); they work whether or not the rules are on.

**Setup check at login** and, in the **Setup check** section, **Check now** (above).

The gameplay rules run on your screen even with your panel hidden. The turn order and its controls are drawn in the panel, so they follow **Rollbox panel**.

## Shortcuts

None of their own. See [Shortcuts](shortcuts.md) for the sheet and flyout clicks.
