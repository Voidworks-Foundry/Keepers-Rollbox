# Settings reference

[← Back to the guide](README.md)

**For:** everyone. Every setting Rollbox registers, by section, in the order of the settings screen.

![Rollbox's settings with every section open](../media/settings-screen.png)

Find them in **Game Settings → Configure Settings → Keeper's Rollbox**. Each setting carries its note:

- **Keeper** — *Keeper setting, applies to everyone.* Only the Keeper can change it.
- **Personal** — *Personal setting, affects only your screen.* Kept for your user, on every computer you log in from.
- **Personal, this computer** — the same, but kept per computer (browser).

The page starts with the five **Features**, one switch each. Below them each feature has its own section; while a feature is switched off, its whole section is greyed out (its settings keep their values). A setting that only matters with another sits indented under it. Settings apply at once unless marked "Reload".

## Features

| Setting | Default | Who | Notes |
| --- | --- | --- | --- |
| Rollbox panel | On | Personal | Your Rollbox panel beside the players list. Off: nothing of Rollbox shows on your screen. Reload |
| Player Rollbox | On | Keeper | Players get their own Rollbox panel, with their own investigator and the features ticked in the Player Rollbox section. Reload. A world where it was already switched off keeps that |
| Turn order and turn controls | On | Personal | Combat runs in the panel: the turn order, Delay, Flee, End turn. Off: during combat the panel works as it does out of combat (the selected token's card and its flyouts), and Foundry's combat tracker runs the turns |
| Gameplay rules | On | Keeper | Rollbox's combat rules: the first blow and who joins, About to attack, readied firearms, the weapon-drawn notice, defeated combatants (unconscious, dying or dead) marked (and skipped while Foundry's Skip defeated is on), the dying CON roll at each round's end, each character's own target followed when you act for them, and the melee reach |
| Setup check at login | On | Keeper | A few seconds after you log in, Rollbox looks over weapons and sheets. Answers it is sure of are saved at once (how a firearm reloads, CoC7's Maneuver back on a weapon an interrupted fight back left off); questions wait for your OK |

## Rollbox panel

Greyed out while **Rollbox panel** is off. See [Appearance and themes](appearance.md), [Check](check.md) and [Action](action.md#spell).

| Group | Setting | Default | Who | Notes |
| --- | --- | --- | --- | --- |
| Look | Theme | Foundry | Personal | Foundry, Art Deco or CoC7 minimal. Has a Reset button |
| Look | &nbsp;&nbsp;Panel colour | #0b0a13 (the panel's original dark) | Personal | Foundry theme only: greyed out while a CoC7 theme is chosen. Has a Reset button |
| Look | &nbsp;&nbsp;Panel transparency | 25% | Personal | 0% to 70%, steps of 5. Foundry theme only: greyed out while a CoC7 theme is chosen. Has a Reset button |
| Look | Panel size | 100% | Personal | 80% to 250%, steps of 10. Has a Reset button. The mouse wheel while you drag the panel changes it too |
| Look | Notice cards size | 100% | Personal | 80% to 250%, steps of 10. Has a Reset button. The size of the fight's small cards (Who's joining this fight?, the joining card, the flee notice, A fight has broken out). Saving a new size sets every card back to it; each card can still be dragged by its top line and sized with the mouse wheel while you hold it, and keeps its own place and size |
| Look | Meters on the small cards | HP, MP, SAN and Luck | Personal | One tick per meter: which bars the character cards (three or more selected), the Investigators list and the turn order's cards show. The full character card always shows all four |
| Placement | Allow moving the panel | On | Personal, this computer | With the **Reset position** button |
| Placement | Menu and flyouts open to the | Automatic | Personal | Automatic, Right or Left |
| Placement | Panel layer | Top when active | Personal | Bottom, Top, Top when active, Top when active or selected |
| Placement | Auto-hide the character card | Off | Personal | |
| Placement | &nbsp;&nbsp;Auto-hide after | 10 seconds | Personal | 1 second to 5 minutes |
| Behaviour | Show the players when nothing is selected | On | Personal | The Keeper's panel lists each player's investigator while no token is selected, with Check and Other for all of them. Off: the panel shows only while tokens are selected (or a combat runs). The Keeper's only: not shown to players |
| Behaviour | Escape closes the flyout | On | Personal | Pressing Escape closes an open Rollbox flyout. With no flyout open, Escape does what Foundry does |
| Behaviour | Simplified dice UI | Off | Personal | Type dice into the Sanity loss and the improvised damage instead of the presets and dice picker |
| Menus | Check opens on | Characteristic | Personal | Characteristic, Skill or Last used |
| Menus | List style | List | Personal | List or Tiles |
| Menus | Spell text in the Spell tab | On hover | Personal | Show a spell's full description beside the Action flyout when you hover over it, when you click it (On click), or never (Off) |
| Menus | Show a spell's text while casting | On | Personal | While CoC7's casting window is open for a spell cast from Rollbox, the spell's description and the target's distance show beside it |

Where you dropped the panel is kept too, per computer, but isn't shown on the settings screen; **Reset position** clears it. Where you dropped each kind of notice card, and its own size, are kept per user (not shown either).

## Player Rollbox

Greyed out while **Player Rollbox** is off. See [For players](for-players.md).

| Group | Setting | Default | Who | Notes |
| --- | --- | --- | --- | --- |
| What players can do | Actions (attacks, maneuvers, spells) | On | Keeper | |
| What players can do | Checks | On | Keeper | |
| What players can do | &nbsp;&nbsp;Combined checks | On | Keeper | Only with Checks on: without Checks it gives nothing. Off: a player ticks one check at a time |
| What players can do | Opposed rolls | On | Keeper | |
| What players can do | Assist | On | Keeper | |
| Each player's own | Roll my attacks at once | On | Personal | For players: an attack you make through your Rollbox is rolled at once on CoC7's card. Off: the card waits for you to press its roll |

While the Player Rollbox is off, players don't see Rollbox's settings at all. While it is on, a player sees only the personal settings that do something for them.

There are no Sanity or Luck features on the settings screen: players have no Sanity or Luck tab (Sanity checks and Luck rolls are the Keeper's). Their keys, `rollboxPlayerSanity` and `rollboxPlayerLuck`, stay registered but hidden, and their saved values are kept.

## Turn order and turn controls

Greyed out while **Turn order and turn controls** is off. See [For Keepers](for-keepers.md#the-turn-order-in-the-panel). The Keeper's only: not shown to players.

| Group | Setting | Default | Who | Notes |
| --- | --- | --- | --- | --- |
| Your view | At each new turn | Select the current turn's token | Personal | **Select the current turn's token:** at each new turn Rollbox selects that token on your map, so the panel shows them (a token with vision shows you its view, as clicking it would). **Keep my selection:** Rollbox never changes what you have selected; the panel follows the turn only while nothing is selected |
| Your view | Left click in the turn order | Selects | Personal | Your left click on a turn-order row. **Selects:** act for that character. **Targets:** make them your target. A right click on a character anywhere in Rollbox always targets them. While Rollbox waits for a target, a left click always targets. A player's click always targets |

## Gameplay rules

Greyed out while **Gameplay rules** is off. See [For Keepers](for-keepers.md#running-combat) and [Action](action.md).

| Group | Setting | Default | Who | Notes |
| --- | --- | --- | --- | --- |
| Starting a fight | Join range (ft) | 60 | Keeper | 10 to 200, steps of 5; in feet, edge to edge. When you start combat after a first blow, investigators and Friendly or Hostile tokens this close to a fighter and in sight join it, standing by; at the start of every turn, those who came this close are listed on one joining card for you to add or leave out. Neutral, Secret and hidden tokens never join on their own |
| Starting a fight | Notice when a weapon is drawn | On | Keeper | Out of combat, a real weapon drawn by an investigator or NPC from the Action flyout brings up a pop-up above the hotbar only the Keeper sees: who could notice, each with their result once rolled (Roll to notice with Spot Hidden, Nobody, Everyone, Start combat or Ignore). Never for an unarmed attack or a creature. Off: no weapon-drawn notice |
| Starting a fight | &nbsp;&nbsp;Notice range | Distance | Keeper | Line of sight, or Distance |
| Starting a fight | &nbsp;&nbsp;Notice distance (m) | 20 | Keeper | 10 to 100, steps of 5; in metres, edge to edge (the scene's feet are converted) |
| Firearms | Manage readied firearms | On | Keeper | Sets CoC7's Draw gun at the start of each round for everyone holding a gun |
| Firearms | &nbsp;&nbsp;Bows count as readied firearms | Off | Keeper | |
| Firearms | &nbsp;&nbsp;Switching weapons loses the readied firearm for the round | On | Keeper | |
| Melee | Melee reach (m) | 1 | Keeper | 1 to 10, steps of 0.5; in metres, edge to edge (the scene's feet are converted). Also the distance for firing into melee |
| Rolling | Roll NPC attacks at once | On | Keeper | When you attack with an NPC or creature through Rollbox, Rollbox presses the roll button on CoC7's attack card after setting its toggles, so the attack is rolled at once. Off: the card waits for you to press it. Works whether or not the Gameplay rules are on |
| Rolling | Roll investigators' attacks at once | On | Keeper | When you attack for an investigator through Rollbox, Rollbox presses the roll button on CoC7's attack card once its toggles are set. Off: the card waits for the roll. Players choose for their own attacks (Roll my attacks at once). Works whether or not the Gameplay rules are on |

## Setup check

Greyed out while **Setup check at login** is off. See [For Keepers](for-keepers.md#setup-check).

| Setting | Default | Who | Notes |
| --- | --- | --- | --- |
| Check setup now | (button) | Keeper | **Check now** runs the check at once and opens its window, whatever the switch says |

## Setting keys

For macros and other modules. Keys never change once released.

| Section | Keys |
| --- | --- |
| Features | `rollboxEnabled`, `rollboxPlayerRollbox`, `rollboxCombatPanel`, `rollboxGameplay`, `rollboxSetupCheck` |
| Rollbox panel | `rollboxTheme`, `rollboxColor`, `rollboxTransparency`, `rollboxScale`, `rollboxNoticeScale`, `rollboxCardMeters`, `rollboxNoticePlaces` (hidden), `rollboxMovable`, `rollboxMenuSide`, `rollboxPanelLayer`, `rollboxAutoHide`, `rollboxAutoHideAfter`, `rollboxOffset` (hidden), `rollboxShowPlayers`, `rollboxEscapeClosesFlyout`, `rollboxSimplifiedDice`, `rollboxCheckOpensOn`, `rollboxListStyle`, `rollboxSpellTextTab` (values `hover`, `click`, `off`), `rollboxSpellTextCasting` |
| Player Rollbox | `rollboxPlayerActions`, `rollboxPlayerChecks`, `rollboxPlayerCombined`, `rollboxPlayerSanity` (hidden), `rollboxPlayerLuck` (hidden), `rollboxPlayerOpposed`, `rollboxPlayerAssist`, `rollboxRollMyAttacks` |
| Turn order and turn controls | `rollboxTurnSelection` (values `select`, `keep`), `rollboxTurnOrderClick` (values `select`, `target`) |
| Gameplay rules | `rollboxJoinRange`, `rollboxNoticeDraw`, `rollboxNoticeRange`, `rollboxNoticeDistance`, `rollboxReadiedFirearms`, `rollboxBowsReadied`, `rollboxSwitchLosesReadied`, `rollboxMeleeReach`, `rollboxAutoRollNpc`, `rollboxAutoRollAttacks` |
| Setup check | `rollboxSetupCheckNow` (the Check now button, a settings menu) |
