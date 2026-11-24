# Tests index

Find the tests that cover your change here, then run only those. Don't open the test files to search for tests; open one only to edit or add a test. Generated from the test runner's own names; update it when you add, rename or remove a test (`tests/docs-index.test.mjs` fails if a test file is missing from it).

## Commands

From the module folder (the repository root; it holds `package.json`). Run one file, or one test (or group) by its pattern:

```
npm test -- tests/<file>.test.mjs
npm test -- --test-name-pattern="<pattern>" tests/<file>.test.mjs
```

- The pattern goes **before** the file. It is a regular expression matched against test names; the patterns below match exactly one test (or one group) in their file, and use `.` for quotes, brackets and other special characters, so they can be pasted as they are.
- Several at once: `--test-name-pattern="<pattern 1>|<pattern 2>"`, or several files.
- If your shell's `npm` won't pass a pattern with spaces, run Node directly (the same thing `npm test` runs): `node --test --test-force-exit --test-reporter=spec --test-name-pattern="<pattern>" tests/<file>.test.mjs`
- Everything: `npm test`. Before a pull request: `npm test` and `npm run release-check`.

## How a test is set up (`tests/mocks.mjs`)

| Helper | What it provides |
| --- | --- |
| `makeEnv({ isGM, values, coc7 })` | Fresh Foundry globals for one test: `Hooks` (recorded in `hooks`), `game.user` (Keeper unless `isGM: false`), three users (`gm1`, `p1`, `p2`), `game.settings` (registrations in `registered`; Rollbox values from `values`, CoC7's from `coc7`; reads in `reads`), `CONFIG`, `ChatMessage.create` (messages in `chat`). Silences `console.warn`. Call it first in every test. |
| `makeCoC7({ links, linkActorClick, cocidMatches, worldItems, packIndex })` | CoC7's side of a request on top of `makeEnv()`: the system id, `CONFIG.CoC7Link` and `_onLinkActorClick`, the CoC ID lookup, i18n, clipboard, notifications, whisper recipients, world items and one compendium index. Returns `calls`, everything Rollbox asked of CoC7. `false` / `null` options remove a piece, for the "does nothing" tests. |
| `makeActor({ name, type, characteristics, luck, san, sanMax, idea, know, skills, otherItems, system })` | A CoC7 8.15-shaped actor (characteristics, attributes, skill items with `value`, `base`, `cocid`, `own`). For data-only parts such as `skill-values`. |
| `makeRollActor({ uuid, owners, weapons, db, methods, … })` | A `makeActor` that can be rolled: uuid, player owners, CoC7's check methods (recorded in `actor.calls`), item ids and uuids, weapons and a damage bonus. |
| `makeDom(html)` | A jsdom page as the global `document`; returns its window (for `Event` classes and `getComputedStyle`). |
| `addStyles(...files)` | Loads the module's stylesheets (paths under `scripts/`) into the page, for tests of a CSS rule. |
| `resultText(area)` | A flyout's result area as the Keeper reads it: each heading and line, in order. |
| `load(env)` | Imports `main.js` fresh and runs its `init`, `setup` and `ready` hooks, for tests of the whole module's wiring. |

A new test: `makeEnv()` (and `makeCoC7()` for anything that sends), then `makeDom()` for anything drawn; build actors with `makeRollActor()`; call the part's exported function; check `env.chat`, `calls` or the DOM. Existing tests in the same file are the model. One test per behaviour, plus the "does nothing" paths (a player, the switch off, CoC7 missing); see [DEVELOPING.md](DEVELOPING.md), "Testing".

## action-card.test.mjs

- Covers: `scripts/roll-requests/attack.js` (CoC7's attack card: weaponCheck, Aiming, Reloading and the dice slider one per render (Under cover is in `alert.test.mjs` and `action.test.mjs`), Point blank, In melee and mace spray's point blank taken off, multi-shot (Multi. Shots, the target's Shoot per shot, the bottom Shoot; a player's client firing shots alone, the Keeper's with toggles), no weapon making nothing, missing methods). Part document: [roll-requests.md](roll-requests.md).
- Run all 12: `npm test -- tests/action-card.test.mjs`

| Pattern | Test (what it checks) |
| --- | --- |
| `startAttack: CoC7.s weaponCheck` | startAttack: CoC7's weaponCheck with the weapon; then one toggle per render of its card |
| `startAttack: another weapon.s` | startAttack: another weapon's card, or a card already rolled, is left alone |
| `startAttack: no card` | startAttack: no card in time tells the Keeper what to set; no toggles asked sets no watch |
| `startAttack: no weapon` | startAttack: no weapon makes nothing (the Action flyout adds an unarmed weapon only after the Keeper's yes) |
| `startAttack: Point blank` | startAttack: Point blank and In melee ticked on the active target; mace spray's point blank taken off |
| `startAttack and castSpell:` | startAttack and castSpell: CoC7's methods missing make nothing, with a warning |
| `startAttack: multi-shot` | startAttack: multi-shot turns on Multi. Shots, adds each shot with the target's Shoot, then presses the bottom Shoot |
| `startAttack on a player.s client: shots alone` | startAttack on a player's client: shots alone are fired there; with a Keeper toggle the whole list goes to the Keeper |
| `the Keeper.s NPC or creature attack is rolled` | startAttack: the Keeper's NPC or creature attack is rolled at once on CoC7's card (rollboxAutoRollNpc), an investigator's with rollboxAutoRollAttacks; not with them off |
| `rolled at once: the Keeper sets` | startAttack on a player's client, rolled at once: the Keeper sets the toggles; the player's client presses Roll once it sees them set |
| `keeperTicks: a player.s melee attack` | keeperTicks: a player's melee attack gets CoC7's Automatic success only when the Keeper granted it (About to attack), whatever the player's client asks |
| `their own Roll my attacks at once` | startAttack on a player's client: their own Roll my attacks at once decides (on by default), not the Keeper's Roll investigators' attacks at once |

## action.test.mjs

- Covers: `scripts/flyouts/action/` (the Action flyout: target box, Attack, Maneuver, Spell, picked weapon). registerActionFlyout's Keeper and switch gates and hooks; weaponsFor (unarmed first, melee reach edge to edge in feet converted, ranged never greyed, ammo); distanceBetween; maneuverDice (p. 105); the typed target and Foundry's target tool; Attack makes CoC7's card (and no surprise card); out-of-reach melee, Reload and Aim (in combat only); Reload in combat (two rounds, or a new magazine) on its own line; the empty firearm; the reload card; Multi-shot's Fire and Shots lines; the target box's status lines and point blank; the improvised weapon; the maneuver's notice (the Keeper's "Switch Maneuver on for Cecil's Punch?", a Punch with Maneuver on added when there is none, a player told to ask, a creature's own "(mnvr)" attack first); a Punch with Maneuver on still attacking as the unarmed weapon; unarmed with none on the sheet (the prompt adds Punch on the character's Brawl); an unarmed weapon whose skill CoC7 can't find (the Fix prompt); a melee attack waiting for a target; spells (the casting-time reader and its cache, the Spell tab in combat, the first-casting outline, the spell's text on hover, on click and beside CoC7's casting window); two selected (the first acts, the second is the target, Swap); a player preparing off their turn; a spent character greyed (the Keeper's Override, a player's act buttons off); picked weapons cleared at combat end. Part document: [action-flyout.md](action-flyout.md).
- Run all 56: `npm test -- tests/action.test.mjs`

| Pattern | Test (what it checks) |
| --- | --- |
| `registerActionFlyout: only where` | registerActionFlyout: only where the panel is (not a player without the Player Rollbox, not with the Rollbox switch off), with its hooks |
| `weaponsFor: unarmed first,` | weaponsFor: unarmed first, melee out of reach (edge to edge, feet converted) greyed, ranged always in reach |
| `distanceBetween: edge to` | distanceBetween: edge to edge in the scene's units, never below 0; a unit Rollbox can't convert greys nothing |
| `maneuverDice: a penalty` | maneuverDice: a penalty die per point of target Build over the attacker; impossible at three (p. 105) |
| `target box: a` | target box: a typed target releases Foundry's targets and is the target |
| `target box: Target` | target box: Target a token switches the Keeper to Foundry's target tool, and back after a target |
| `Attack tab: picking` | Attack tab: picking a weapon saves it on the character; Attack targets the token and makes CoC7's card; no surprise card |
| `Attack tab: a weapon picked` | Attack tab: a weapon picked with no encounter running brings up the Keeper's weapon-drawn pop-up |
| `Attack tab: the target dived` | Attack tab: the target dived for cover sets Under cover, not a die; the aimed shot ends Aiming |
| `Attack tab: the picked weapon clicked again` | Attack tab: the picked weapon clicked again is put away; in combat with CoC7's Draw gun on, holstering or switching to a melee weapon asks first with the drop to DEX, and Cancel keeps the gun |
| `Attack tab: a melee weapon` | Attack tab: a melee weapon out of reach can't be picked; a gun not full adds Reload beside Attack out of combat, a Reload line of its own in combat, and Aim only in combat |
| `Empty firearm: the` | Empty firearm: the picked row spells out its ammunition; in combat Reload and Load one and fire, out of combat Reload only; Attack is greyed |
| `bug: Reload in` | bug: Reload in combat loads two rounds into a revolver, a new magazine into an automatic, and uses the turn |
| `Improvised weapon: sent` | Improvised weapon: sent as a labelled Fighting (Brawl) check with damage, no attack card |
| `Maneuver tab: a Punch with Maneuver off` | Maneuver tab: a Punch with Maneuver off asks the Keeper to switch it on, then posts the notice; no CoC7 card yet |
| `Maneuver tab: with no Punch` | Maneuver tab: with no Punch the Keeper adds one with Maneuver on; Cancel adds nothing; a player is told to ask |
| `Maneuver tab: a player.s Punch` | Maneuver tab: a player's Punch with Maneuver off: ask the Keeper to switch it on |
| `Maneuver tab: a creature` | Maneuver tab: a creature's own (mnvr) attack is listed first and used at once, with no prompt |
| `bug: a Punch with Maneuver on` | bug: a Punch with Maneuver on is still the unarmed weapon, and attacks with CoC7's attack card |
| `Spell tab: Cast` | Spell tab: Cast runs CoC7's cast; an investigator's first casting asks for Hard POW, then Mark as cast |
| `Spell tab: a player` | Spell tab: a player who casts gets no Mark as cast (the Keeper's fallback), so the first casting's Hard POW stays |
| `Spell tab: a first` | Spell tab: a first-casting Hard POW that CoC7 rolls a success marks the spell as cast by itself; a failure doesn't |
| `Spell tab: an` | Spell tab: an NPC casts with no first-casting roll |
| `Two selected: the` | Two selected: the first acts and the second is the target (the Keeper's Foundry target); Swap switches them |
| `clearPickedOnCombatEnd: every combatant.s` | clearPickedOnCombatEnd: every combatant's picked weapon is forgotten; nothing on a player's client |
| `target box: the` | target box: the target's statuses set while the flyout is open (CoC7's Prone, an active effect) show at once, one line each |
| `target box: one` | target box: one line per status, the net line only when there is an effect to apply |
| `target box: point` | target box: point blank is a fifth of the shooter's DEX in feet, edge to edge: a prone target gives no penalty die |
| `Attack tab: a gun emptied` | Attack tab: a gun emptied outside the flyout (CoC7's sheet or card) greys Attack at once |
| `Reload posts the reload card` | Reload posts the reload card: the character speaks, whispered to the Keepers and the character's players |
| `Multi-shot: a gun` | Multi-shot: a gun with several shots a round offers Single shot · Multi-shot; Multi-shot's Shots row fires that many on CoC7's card |
| `bug: a player` | bug: a player whose character dived for cover this round can't attack; the Keeper only sees the note |
| `a player who has acted` | a player who has acted can't attack by typing an improvised weapon: Attack stays greyed and sends nothing |
| `while the Keeper decides the first blow` | while the Keeper decides the first blow (the scene's firstBlow mark), a player's Action flyout waits: Attack, Maneuver and Spell can't be used and no weapon can be picked, the reason on hover; it unlocks when the mark goes; the Keeper is never locked |
| `a spent character:` | a spent character: each tab's content and act buttons greyed (tabs and warning clear); the Keeper's act button reads Override, ungreyed, on hover; a player's can't be pressed |
| `Spell tab: a redraw` | Spell tab: a redraw while a cast is being sent doesn't let Cast run twice |
| `unarmed with none` | unarmed with none on the sheet: the Keeper's prompt adds CoC7's Punch on the character's Brawl, then attacks |
| `bug: an unarmed weapon` | bug: an unarmed weapon whose skill CoC7 can't find (no roll button on its card) asks to link it first |
| `a player with no` | a player with no unarmed weapon is told to ask their Keeper; a melee attack with no target waits for one |
| `a player in` | a player in combat on someone else's turn can open and prepare (pick a weapon); the act buttons wait for their turn |
| `bug: the open flyout follows` | bug: the open flyout follows the turn: the act buttons come back when the turn does; a character out of the encounter doesn't wait |
| `readCastingTime: instant in;` | readCastingTime: instant in; rounds by their worst case (6 or fewer in); minutes and longer out |
| `readCastingTime: preparation or` | readCastingTime: preparation or apply is hidden in combat; open-ended, empty or unreadable times are unknown |
| `spellVerdict: cached per` | spellVerdict: cached per spell, worked out again when its casting time changes |
| `Spell tab: in` | Spell tab: in combat only spells instantaneous or 6 rounds or fewer; out of combat every spell |
| `Spell tab: a spell not cast` | Spell tab: a spell not cast yet has the red outline and the first-casting tooltip; one cast has neither |
| `spell text On hover` | spell text On hover: hovering a spell shows CoC7's description beside the flyout; leaving hides it |
| `spell text On click` | spell text On click shows and hides it with a click on the row; Off never shows it |
| `CoC7.s casting window` | CoC7's casting window for a cast from Rollbox gets the spell's text and the target's distance beside it (which follows a token's move); others don't |

| `weaponsFor: a melee weapon CoC7` | weaponsFor: a melee weapon CoC7 marks ranged (the bullwhip) reaches its own range, 10 ft, not the 1 m reach |
| `a move of the target.s token` | a move of the target's token redraws the open flyout's reach and distance; another token's move doesn't |
| `Attacks per round: a creature` | Attacks per round: a creature with 3 shows Attacks: 3/3, each attack spends one and the last its action; an investigator shows no count |
| `unconscious, dying or dead` | unconscious, dying or dead: the Keeper's Action is greyed with the reason, Override asks first and lets one action through |
| `Restrained: Attack and Spell` | Restrained: Attack and Spell greyed with the reason, Maneuver offers only Break free; nobody held: Break free greyed "Not held" |
| `a maneuver.s target out of reach` | a maneuver's target out of reach: every goal greyed "Out of reach", the button reads Target out of reach; the Keeper's Override asks first; moving into reach brings the goals back |
| `Cast hidden is the Keeper.s only` | Cast hidden is the Keeper's only: a player's Spell tab shows just Cast |

## alert.test.mjs

- Covers: `scripts/flyouts/alert/` (`being-attacked.js`, `alerts.js`, `choices.js`, `melee.js`, `maneuver.js`, `shots.js`: the being-attacked alerts on a player's client, the maneuver alerts for a player and the Keeper, Dive for cover, the Keeper's Under cover tick). Part document: [alert-flyout.md](alert-flyout.md).
- Run all 18: `npm test -- tests/alert.test.mjs`

| Pattern | Test (what it checks) |
| --- | --- |
| `registerBeingAttacked does nothing` | registerBeingAttacked does nothing while the Player Rollbox is off |
| `readAttack: CoC7.s defender` | readAttack: CoC7's defender and ranged cards; anything else is no attack |
| `melee: Dodge and No response` | melee: Dodge and No response each choose on CoC7's defender card and press its roll button |
| `melee: Fight back picks` | melee: Fight back picks the weapon and Counter the Punch's fighting skill in CoC7's own lists, then roll |
| `melee: no alert` | melee: no alert for someone else's character; the alert closes once answered |
| `a target the Keeper decided is surprised` | a target the Keeper decided is surprised by this attacker (About to attack) gets no alert, melee or shot at |
| `bug: a maneuver.s alert closes` | bug: a maneuver's alert closes once CoC7's opposed card has its result (both failed included), for the player who answered; also when the card was rolled before the notice named it |
| `shot at: Stand` | shot at: Stand your ground closes the alert for that card for good |
| `shot at: Dive` | shot at: Dive for cover rolls CoC7's Dodge and, on a success, notes the dive; another check card is passed over |
| `Keeper: after a` | Keeper: after a dive, Under cover is ticked once on the newest unrolled shot at that character |
| `diveDecision: pending while` | diveDecision: pending while an open shot targets a player's character, then dived or stood from the round notes |
| `the alert.s own box wears` | a player without a Rollbox panel: the alert's own box wears their Theme, as the panel would |
| `maneuver: the target.s player` | maneuver: the target's player gets Dodge · Fight back (one per melee weapon) · Counter (clickable with "No maneuver weapon" on hover without one); an answer goes to the Keeper's client |
| `maneuver: the Keeper answers` | maneuver: the Keeper answers for an NPC target (Dodge makes CoC7's combat opposed card), not for one whose player is online with them assigned; for one whose online owner hasn't them assigned, the Keeper answers. |
| `maneuver: Counter lists` | maneuver: Counter lists the maneuver weapons with the Punch first and picked; No response is sent as none |
| `melee, Keeper: an NPC or creature` | melee, Keeper: an NPC or creature targeted by CoC7's melee card gets the Keeper's alert, answered on CoC7's card; an investigator doesn't |
| `Fight back with no weapon on the sheet` | Fight back with no weapon on the sheet (the Keeper's melee alert for a creature): clickable, "No weapon" on hover; it asks to add the Punch: Cancel changes nothing, Add puts it on the creature's Fighting and fights back with it |
| `a player.s alert with no weapon` | a player's alert with no weapon to fight back or counter with: both clickable, each says to ask the Keeper; nothing is added |

## assist.test.mjs

- Covers: `scripts/flyouts/other/assist.js`, `assist-split.js`, `assist-group.js` (a player's group, the Keeper's side of joining) and `player-assist.js` (a player's view). Part document: [assist.md](assist.md).
- Run all 24: `npm test -- tests/assist.test.mjs`

| Pattern | Test (what it checks) |
| --- | --- |
| `assistChoices: the rulebook` | assistChoices: the rulebook rafter: Harvey, Cecil, Martin help; Helen and Belinda roll at Regular, 45 left |
| `assistChoices: what.s left` | assistChoices: what's left never goes to 0 or below; with no need to help, nobody helps |
| `assistChoices: too heavy` | assistChoices: too heavy even together, or nothing to beat, gives null |
| `assistChoices: equal values` | assistChoices: equal values keep the character-card order; equal chances go to fewer helpers |
| `the rafter: Assisting,` | the rafter: Assisting, Rolling and the result line; Send asks the rollers at Regular STR with the label and posts the card |
| `Use SIZ: the` | Use SIZ: the characters' SIZ is put in and asked for; with no label the request reads "SIZ · Assist" |
| `targets: a creature` | targets: a creature starts marked; values add up; only the target button (or typing) unmarks one |
| `✕ takes a` | ✕ takes a character out of the assist; with only a target left, nobody takes part |
| `nothing selected: Add` | nothing selected: Add a character picks one with the target picker; one character against a typed value is enough |
| `a new selection` | a new selection keeps what was typed; opened afresh it starts empty |
| `assistGroupChanged: redraws only` | assistGroupChanged: redraws only for Rollbox's own group flag, set or removed, not for text that merely holds its name |
| `assistColumns: the Use` | assistColumns: the Use value for participants and the Against value for targets |
| `assistCardHtml: names and` | assistCardHtml: names and the label are escaped; no one helping is said so |
| `joining .the Keeper.s` | joining (the Keeper's side): only the player's own investigator, helping any other character (an NPC too) |
| `a group on an unlinked` | a group on an unlinked token's creature (its flag on the token) is found, so the helper's panel follows it |
| `a relayed check.s helpers` | a relayed check's helpers count only when they stand in each roller's group with the player's own investigator |
| `Stop helping .the Keeper.s side.` | Stop helping (the Keeper's side) is refused with the players' Assist off, as joining is |
| `a waiting group:` | a waiting group: the Keeper's Assist takes in its helpers; Send tells the group what was sent |
| `a player.s view:` | a player's view: waiting with Stop helping; once sent, a helper reads it and the roller rolls at once |

| `one way to roll:` | one way to roll: with the Player Rollbox on, a group's player roller gets no chat request (their panel's Roll); with it off, CoC7's request |
| `whose own Rollbox panel is off` | a group's player roller whose own Rollbox panel is off gets CoC7's chat request, not the panel's Roll |
| `Cancel clears a player-assist group` | Cancel clears a player-assist group (waiting or sent); a new assist for the investigator replaces a sent group |
| `M5: a roller.s Assist roll` | M5: a roller's Assist roll is their rolled check of the group's characteristic; another check or a card not yet rolled doesn't count |
| `a player.s Target who` | a player's Target who you're helping: asks for the next token clicked, not their current target; pressed again, it cancels |
## check-flyout.test.mjs

- Covers: `scripts/flyouts/check/` (`index.js`, `characteristic.js`, `skill.js`) and `scripts/flyouts/flyout.js`. Part documents: [flyouts.md](flyouts.md), [check-flyout.md](check-flyout.md).
- Run all 24: `npm test -- tests/check-flyout.test.mjs`

| Pattern | Test (what it checks) |
| --- | --- |
| `registerCheckFlyout: only on` | registerCheckFlyout: only on the Keeper's client with the Rollbox switch on |
| `one character: Characteristic,` | one character: Characteristic, Skill and Sanity tabs (no Attribute), values, trained skills first, a divider, the rest at base value; search filters |
| `one check: greyed` | one check: greyed out with the status line in red until a check is ticked, then no line; Send to <name> whispers it |
| `combined: ticks persist` | combined: ticks persist across tabs; two ticks offer All / Any and turn Blind off |
| `the clear button beside` | the clear button beside All / Any one unpicks every ticked check, on every tab |
| `options: difficulty, dice,` | options: difficulty, dice, the Blind toggle and label go into the request; Blind clicks on and off |
| `several characters: skills` | several characters: skills A–Z without values; Send to each (N); players asked, the NPC rolled |
| `the one send` | the one send button: "Roll for <name>" for an NPC and "Roll for NPCs" when every character is one, "Send to <player> (<name>)" for one, "Send to each (N)" for several; no Send to chat or Copy link |
| `. Add: a` | + Add: a search that matches no listed skill offers the typed name; a specialisation gets its group base, otherwise a value is asked |
| `nothing selected: the` | nothing selected: the two lines say it goes to every investigator; Send to all players whispers each |
| `a player: Characteristic` | a player: Characteristic and Skill only; Make check has CoC7 roll their own check at once, Regular, no window or request |
| `started from the character sheet: only` | started from the character sheet: only that characteristic ticked; again while open switches it, keeping the options |
| `started from the character sheet: add` | started from the character sheet: add keeps the ticks (combined); plain sends a Regular check at once |
| `a player gets` | a player gets only the tabs the Player Rollbox allows: none while it is off, so nothing is drawn |
| `Check opens on:` | Check opens on: the setting's tab; Last used, the tab chosen last; a new selection keeps the tab it was on |
| `title: .Request a` | title: "Request a combined check" with two or more ticks, "Request a check" with fewer; the send button marked combined too (Art Deco's cue, with no title) |
| `Tiles: eight characteristic` | Tiles: eight characteristic tiles (value, half · fifth) and skill tiles in three columns; a click ticks, the request goes as from the list |
| `row shortcuts: Shift` | row shortcuts: Shift sends just this check as Regular, the ticks and options kept; Ctrl copies its roll link; Alt + Right adds; Shift + Alt + Right sends the ticks |
| `row shortcuts: Right` | row shortcuts: Right opens Opposed with this check as the first character's side (Shift: made at once); without Opposed, a line says so |
| `SAN on the` | SAN on the sheet: Shift + Left sends a plain SAN roll; every other shortcut opens Check on Sanity |
| `Luck on the` | Luck on the sheet: never opposed or combined; its right clicks open Other on Luck; Alt + Left and Ctrl + Right do nothing |
| `a check row` | a check row in the flyout: CoC7's sheet shortcuts, with Left keeping its menu meaning (tick) |
| `row values: read` | row values: read 55 · 27 · 11; the Art Deco theme shows them CoC7's way, 55 (27/11) |
| `bug: a player` | bug: a player without Combined checks ticks one check at a time; a row's right click without Opposed says so |

## combat.test.mjs

- Covers: `scripts/combat/` (the turn order in Foundry's order, never rotated, its layout (the full card in place, End of round, the standing-by group, a pick in place) and the Keeper's and player's layouts; the last fighter's Delay; going on standby any way putting the gun away; each turn control's confirm and effect; Delay's arrows and live preview, moving a combatant and putting them back; Delay and Flee hidden off the selected character's turn, Flee greyed for a Restrained character; the Keeper's Place on standby and Leave out under Delay, Remove from standby; round-note lifetime and Aiming carried once; firearm rules, Draw gun at round start and on a mid-round pick (left until the next round once the combatant's turn has come); firing into melee, outnumbered and the defences counted from CoC7's defender cards; notice range, Roll to notice (Spot Hidden, those who notice told), Everyone notices and Ignore, the weapon-drawn card made by the Keeper's client for a player; a fight: an attack starting it with who stands by, the Keeper's window and Add, standing-by turns skipped and acting (a fighter's controls on that turn, back on standby after it), attacks during a fight, who comes into range on one joining card (Add, Leave out, Add all, Leave all) and who is dropped at a turn start, the player's join card and the relay, the standing-by rows and box, the standing-by list scrolled to a pick and kept across redraws, HP, SAN and Luck bars on the Keeper's rows, the flee notice and Chase; the Keeper's combat panel (the selected full card, blue outline, darker passed turns, someone not in combat with Add to combat), a row's click (acting for someone, a target pick, the turn followed), defeated marks and their skip; registration: the Keeper's gameplay rules with the panel off, a player's turn order). Part document: [combat.md](combat.md).
- Run all 92: `npm test -- tests/combat.test.mjs`

| Pattern | Test (what it checks) |
| --- | --- |
| `inCombat and currentTurn:` | inCombat and currentTurn: nothing without a started encounter; the current combatant's character with one |
| `turnOrder: Foundry.s order` | turnOrder: Foundry's order, never rotated; those before the current turn done |
| `buildTurnOrder: the full card` | buildTurnOrder: the full card opens in its own place, rows above and below in their own group cards, End of round under the last fighter, the standing-by group under it whatever is selected |
| `buildTurnOrder for the` | buildTurnOrder for the Keeper: round header, the current turn as the outlined sheet, the rest as rows (an NPC's reads "NPC"), readied firearm shown |
| `buildTurnOrder for a` | buildTurnOrder for a player: their own character is the sheet in its place, the acting row outlined, hidden combatants left out |
| `turnControls: End turn` | turnControls: End turn asks first (red, Confirm end turn), the second press moves to the next turn |
| `turnControls: Delay asks` | turnControls: Delay asks at once as [←] Confirm delay [→]; → moves one more place (shown live, "Confirm delay (2)"), ← one back; Confirm with no arrow goes to the end |
| `turnControls: Delay and Flee are` | turnControls: Delay and Flee are hidden, not greyed, while the selected character isn't the current turn's |
| `turnControls: a Restrained` | turnControls: a Restrained character's Flee is greyed with "Restrained: break free first" in its hover (no line under the buttons); the Keeper's reads Override on hover and still turns Flee on, a player's can't be pressed |
| `turnControls: the last fighter` | turnControls: the last fighter of the round can press the Keeper's Delay: Place on standby · Leave out take End turn's row, End combat under them, Delay again puts End turn back; a player's Delay is greyed with its reason in the hover |
| `turnControls: Delay pressed puts` | turnControls: Delay pressed puts [←] Confirm delay [→] in End turn's row and Place on standby · Leave out in End combat's; Leave out asks once and keeps them out of the fight; Place on standby ends the turn at once |
| `turnControls: a selected standing-by` | turnControls: a selected standing-by combatant has Act this round · Leave out, Remove from standby and End combat only; Remove from standby makes them a fighter again, at their own place in the order |
| `delayTurn and restoreDelayed:` | delayTurn and restoreDelayed: past everyone goes last; the next round puts their own initiative back |
| `Delay moves one place per press` | Delay moves one place per press, a tie in the way included; landing inside a tie sits exactly there, and the next round puts the tied ones back |
| `delayTurn does nothing` | delayTurn does nothing for the last in the order or past an unrolled initiative |
| `bug: turnControls: Flee asks` | bug: turnControls: Flee asks at once (Confirm flee combat), then notes fled and ends the turn; the Keeper's Flee also removes the combatant |
| `turnControls: End combat` | turnControls: End combat asks, then deletes the encounter |
| `turnControls: a player` | turnControls: a player gets End my turn on their own turn, and nothing on someone else's |
| `round notes: a mark` | round notes: a mark counts in its own round only, needs an encounter, and clearRoundNotes removes it |
| `round notes: a new` | round notes: a new round carries Aiming over once, for the aimed shot; clearAiming ends it, the rest stays |
| `isFirearm: a ranged` | isFirearm: a ranged weapon readies; melee, thrown and bows don't, bows only with their setting |
| `readyForRound: Draw gun` | readyForRound: Draw gun and DEX + 50 for a picked gun, off for a picked knife, untouched without a pick; nothing with the setting off |
| `onPicked: a knife` | onPicked: a knife mid-round un-readies at once; another gun does only while switching loses the readied firearm |
| `postNoticeCard: the Keeper's pop-up` | postNoticeCard: the Keeper's pop-up above the hotbar names who is within 20 m and in sight; nothing in combat, for the unarmed weapon or for a creature |
| `weapon-drawn pop-up: Roll to notice` | weapon-drawn pop-up: Roll to notice asks an investigator with a player online through their player, and rolls one with none online and an NPC privately for the Keeper at once (no request to the Keeper, no standby card, no note); each row waits, then reads its result; a player who noticed is told |
| `weapon-drawn pop-up: the Keeper settles` | weapon-drawn pop-up: the Keeper settles a row by hand (Noticed counts for About to attack, a later roll changes nothing); Ignore closes the list with a row still waiting, and nothing waits after it |
| `weapon-drawn pop-up: Everyone notices` | weapon-drawn pop-up: Everyone notices whispers each investigator in range; Ignore closes it, no combat |
| `weapon-drawn pop-up: shown by` | weapon-drawn pop-up: shown by the Keeper's client for a player (relay), only for their own character; never with Notice when a weapon is drawn off |
| `the first blow: an attack out of combat` | the first blow: an attack out of combat starts no encounter and shows the Keeper's First blow card, once, saying who attacks whom and what to finish (the surprise attack when a target is surprised) |
| `the first blow: Start combat opens` | the first blow: Start combat opens Who's joining this fight? and its Start combat makes the encounter (the two and the picks fight, the rest near stand by, asked when their player can answer), everyone's initiative set, round 1 at the top of the order; the attacker's round-1 turn isn't skipped |
| `the first blow card.s ✕` | the first blow card's ✕ forgets the first blow: nothing starts |
| `Who.s joining this fight.:` | Who's joining this fight?: a Friendly against Hostile fight pre-ticks who joins on their own; Add makes them fighters; a fight with a Neutral pre-ticks nobody |
| `standing by: plain standing by` | standing by: plain standing by is skipped, acts this round stops the order on them; with no fighter left to act, nobody is skipped |
| `Rollbox.s own skip carries` | Rollbox's own skip carries its update option, in a turn update and in nextRound's, and no other round change gets it |
| `a run of standing-by turns is passed in one` | a run of standing-by turns is passed in one turn update, straight to the first who acts; with nobody after them acting, the next round starts and is skipped from its top |
| `inCombatFor: only` | inCombatFor: only a character with a combatant in the running encounter (one who fled is out of combat) |
| `the Keeper.s selected standing-by` | the Keeper's selected standing-by combatant has Act this round in the turn controls; the order then stops on them |
| `a player whose own character isn.t` | a player whose own character isn't in the encounter (fled) keeps their sheet, under the turn order |
| `during a fight: an attacked outsider` | during a fight: an attacked outsider joins as a fighter; a hidden attacker is revealed, added and skipped this round; attacking makes a standing-by combatant a fighter; Gameplay rules off: nothing |
| `at the start of a turn: everyone` | at the start of a turn: everyone who came into range is on one joining card, each with Add and Leave out; Leave out holds for the rest of the fight; a standing-by combatant out of range is dropped |
| `the joining card.s Add all` | the joining card's Add all and Leave all answer everyone still on it at once; shown for two or more |
| `the player's side: the join card` | the player's side: the join card for their own asked investigator, Join and Stay out through the Keeper's client, only for a combatant they own |
| `turn order: standing-by rows compact` | turn order: standing-by rows compact (the name only, greyed, the status on hover); a standing-by player's sheet on top with Standing by, Act this round and Rejoin the fight, Your turn when the order stops on them; their turn has a fighter's controls |
| `turn order: the standing-by list` | turn order: the standing-by list scrolls to a selected row, keeps where the Keeper scrolled it across redraws, and scrolls again for another pick |
| `the player's Rejoin the fight` | the player's Rejoin the fight asks the Keeper's client to make them a fighter (as Join the fight does); on the Keeper's client that makes them a fighter for good, also on their acting turn |
| `turn order: the meters ticked` | turn order: the meters ticked in rollboxCardMeters on every Keeper's row but a standing-by one; none on a player's rows; no initiative number |
| `the flee notice: the Keeper's Flee` | the flee notice: the Keeper's Flee asks whether anyone gives chase; Chase opens CoC7's chase tool, or reminds the Keeper without it |
| `the Keeper's combat panel: the selected` | the Keeper's combat panel: the selected combatant is the full card (blue outline off the current turn), the current turn's row keeps its red box; passed turns are darker; someone not in combat shows above the round with Add to combat, and the turn controls keep only End combat |
| `a click on a row: the Keeper` | a click on a row: the Keeper's left click acts for that combatant (the map's selection released); the current turn's row follows the turn again |
| `a click on a row targets` | a click on a row targets: the right click; a left click while the target tool is picked; a player's left and right click |
| `a click on a row: a turn change` | a click on a row: a turn change follows the turn at once (the pick forgotten, the new turn's token selected) |
| `rollboxTurnOrderClick target:` | rollboxTurnOrderClick target: the Keeper's left click targets, and the right click still targets |
| `rollboxTurnSelection: keep` | rollboxTurnSelection: keep never touches the Keeper's selection at a new turn; the pick still follows the turn |
| `defeated: CoC7 marking` | defeated: CoC7 marking a combatant unconscious, dying or dead sets Foundry's defeated field (nothing else), cleared with it; a defeat the Keeper set by hand stays through other changes; a defeated turn is skipped (only with Foundry's Skip defeated on) |
| `H2: with the Keeper` | H2: with the Keeper viewing another scene, the rules read the running encounter: a standing-by turn is skipped, a defeated combatant marked, a character is in combat and their round note counts; the panel draws no turn order |
| `registerCombat: nothing for` | registerCombat: nothing for a player with the Player Rollbox off; the Keeper's gameplay rules even with the panel off |
| `registerCombat: a player` | registerCombat: a player with the Player Rollbox gets the turn order, none of the Keeper's gameplay rules |
| `a Longbow or a Crossbow by name is a bow` | isFirearm: a Longbow or a Crossbow by name is a bow, so it isn't readied with Bows count as readied firearms off |
| `bug: a gun readied` | bug: a gun readied at the top of a round acts first in that round, not after the old first |
| `without CoC7's Draw gun button` | readyForRound: without CoC7's Draw gun button in the tracker nothing is set and the Keeper is told |
| `a second GM who isn` | registerCombat: a second GM who isn't Foundry's active GM leaves the round change to the active one |
| `when Foundry refuses the move` | delayTurn: when Foundry refuses the move, the row isn't noted Delayed |
| `holstering on his own turn` | holstering on his own turn after firing: Draw gun off at once, the Hybrid now above him acts next, and his turn this round is skipped |
| `holstering after his turn` | holstering after his turn has gone: Draw gun off at once and, now below the current turn, he doesn't act again |
| `bug: a watcher without Spot Hidden` | bug: a watcher without Spot Hidden on the sheet (CoC7's raw roll at the base value, a plain value) is settled |
| `About to attack: a target marked Noticed` | About to attack: a target marked Noticed on the weapon-drawn pop-up for this attacker starts with Saw it coming chosen (the main button); the Keeper can still pick another |
| `bug: About to attack: a notice skill missing` | bug: About to attack: a notice skill missing from the target's sheet (rolled at its base value, CoC7's raw roll with a plain value result) still decides by itself: a success is Saw it coming |
| `the players wait while the Keeper decides` | the players wait while the Keeper decides: About to attack open marks the scene (firstBlow), Ignore takes it off at once; answered, the First blow card keeps it, Start combat takes it off; a player reads it, the Keeper never waits, nor anyone once an encounter runs; the Keeper's requests still reach them |
| `the players wait until the First blow card.s ✕` | the players wait until the First blow card's ✕ |
| `each character.s own target` | each character's own target: the Keeper's targeting is remembered for the one character they act for, a player's for their own investigator; acting for someone else sets the Keeper's target to theirs, or none; untargeting forgets nothing; a deleted target is forgotten |
| `defenderAnswered:` | defenderAnswered: a CoC7 defender card answered with Dodge or Fight back counts once; no response or the attacker's card, never |
| `isOutnumbered:` | isOutnumbered: once the target has defended as often as it attacks per round; never out of combat |
| `inMeleeWithOthers:` | inMeleeWithOthers: a shot's target within melee reach of another combatant, not the shooter, edge to edge |
| `turnOrder: those standing by sit at the back` | turnOrder: those standing by sit at the back, highest DEX first, equal DEX in Foundry's order; their initiative stays as it was |
| `Place on standby turns CoC7.s Draw gun off` | Place on standby turns CoC7's Draw gun off and gives the turn to whoever came after, wherever the lower initiative sorted the one standing by |
| `going on standby any other way` | going on standby any other way (a player's Stay out) puts the gun away too; nothing for another change or with Manage readied firearms off |
| `M3: with two GMs` | M3: with two GMs, Place on standby on the GM who isn't Foundry's active GM presses no Draw gun; the active GM's client puts the gun away once |
| `L4: a player.s attack` | L4: a player's attack and the Keeper's defence noted at the same moment on one character both stay |
| `Draw gun turned on for someone standing by` | Draw gun turned on for someone standing by brings them off standby; a round's start never draws a standing-by combatant's gun |
| `Confirm delay counts only fighters` | Confirm delay counts only fighters, ends the turn as a turn change does (a standing-by turn skipped, the next token selected) |
| `acting from standby: on their turn` | acting from standby: on their turn a fighter's controls with the card greyed; End turn puts them back on standby, Act this round off; Act this round for the next round stays |
| `acting from standby: a confirmed Delay` | acting from standby: a confirmed Delay keeps Act this round, so they act again at the delayed place and are back on standby when it ends |
| `acting from standby: Place on standby` | acting from standby: Place on standby ends that turn back on standby |
| `notice cards: dragged` | notice cards: dragged by the top line and sized with the wheel while held, saved per kind and used by the next one; another kind stays in the stack at Notice cards size; saving Notice cards size forgets each card's own size, places kept |
| `notice cards open in one stack` | notice cards open in one stack just above Foundry's hotbar, stacking upwards with the newest nearest it; Who's joining this fight? opens there too |
| `bug: a notice card dragged` | bug: a notice card dragged and released with no click after it doesn't swallow the next click elsewhere |
| `M13: the encounter deleted` | M13: the encounter deleted closes Who's joining this fight? as its Cancel does and the flee notice; a chase reminder stays |
| `About to attack: out of combat` | About to attack: out of combat the Keeper's pop-up asks first; Surprised asks the bonus, Automatic hit greyed for a ranged attack; the decision marks the target surprised; nothing asked in combat or with the Gameplay rules off; a stored About to attack value is ignored |
| `About to attack: Roll to notice` | About to attack: Roll to notice sends the target's check (rolled privately for the Keeper when no player is online) and waits; a failed roll moves to the surprised step, a success is Saw it coming |
| `About to attack for a player` | About to attack for a player (relay): only for their own character |
| `dying: the Keeper.s Roll CON` | dying: the Keeper's Roll CON for an NPC at the end of the round after they started dying, and each round after; a failure brings Mark dead (CoC7's own Dead toggle) or Handle it yourself; stabilised, it stops |
| `dying: an investigator.s Roll CON` | dying: an investigator's Roll CON is their online player's, on their own client (their own CON check); the Keeper's client shows none |

## comments.test.mjs

- Covers: every file in `scripts/`, against the comment standard (`docs/CODE-COMMENTS.md` §7). Part document: [utils.md](utils.md).
- Run all 4: `npm test -- tests/comments.test.mjs`

| Pattern | Test (what it checks) |
| --- | --- |
| `a file header is at most` | comments: a file header is at most 3 lines |
| `a JSDoc summary` | comments: a JSDoc summary is at most 2 lines before its first @ tag |
| `over a quarter` | comments: lists files whose comment prose is over a quarter of their code (a goal: listed, never failed) |
| `no date, person.s name or build` | comments: no date, person's name or build number in scripts/ |

## docs-index.test.mjs

- Covers: this index (each pattern runs exactly one test), [AGENTS.md](../AGENTS.md) "Find your way" and the part documents (reads files only, no mocks).
- Run all 5: `npm test -- tests/docs-index.test.mjs`

| Pattern | Test (what it checks) |
| --- | --- |
| `docs/TESTS.md has a` | docs/TESTS.md has a section for every test file |
| `every part folder` | every part folder under scripts/ has its document in docs/, each flyout folder its <name>-flyout.md |
| `every path in` | every path in AGENTS.md's "Find your way" table exists |
| `every docs/TESTS.md pattern` | every docs/TESTS.md pattern matches exactly one test (or one group) in its file |
| `no document in docs/` | no document in docs/ carries a decision tag or a date (the shipped docs state how things are, not their history) |

## opposed-flyout.test.mjs

- Covers: `scripts/flyouts/opposed/`. Part document: [opposed-flyout.md](opposed-flyout.md).
- Run all 20: `npm test -- tests/opposed-flyout.test.mjs`

| Pattern | Test (what it checks) |
| --- | --- |
| `registerOpposedRoll: only on` | registerOpposedRoll: only on the Keeper's client with the Rollbox switch on |
| `skill vs skill:` | skill vs skill: the view alone in the flyout, no sheets of its own; Create waits for both picks; one card, both sides |
| `^Create opposed card` | Create opposed card greys out once the card is made, until a pick changes |
| `a missing skill:` | a missing skill: listed at base value with a note, and shown in the side's header; CoC7 adds it when the card is made |
| `a skill CoC7` | a skill CoC7 can't find: no card, and the view says why |
| `an NPC side:` | an NPC side: Start rolls is watched for so it rolls that side, and the result says who rolls |
| `ties: the higher` | ties: the higher value is named for the Keeper; equal values are a stalemate or re-roll |
| `each side picks` | each side picks from two tabs, Characteristic and Skill (no Attribute tab) |
| `started from the` | started from the character sheet: the first character on the left with both picks; create makes the card at once |
| `Swap sides: the` | Swap sides: the characters change places with their picks and dice, so the other is CoC7's first side |
| `Cancel closes the` | Cancel closes the view; nothing is sent |
| `right click with` | right click with one character: that side filled, the other waits in red; Create is greyed out; no one-sided card |
| `^the waiting side` | the waiting side fills from the next character selected; the first stays when it is deselected |
| `opened with the` | opened with the button: a deselected side waits again instead of the view closing |
| `three or more` | three or more selected: the first side fills and the second waits until another character is added |
| `a shift-click on` | a shift-click on another character's value fills the waiting side with that check and makes the card |
| `bug: a player.s` | bug: a player's Opposed opened from a right click offers Target your opponent on the waiting side |
| `nothing selected: each` | nothing selected: each side waits with Pick a target; a picked side shows its name with ✕, which empties it |
| `a player.s Opposed: the opponent` | a player's Opposed: the opponent's side shows only their name (no checks, values or tie line); Make opposed card sends it open for the Keeper |
| `several against one:` | several against one: three selected fill one side; Create opposed cards (3) makes one card each against the opponent |


## other-flyout.test.mjs

- Covers: `scripts/flyouts/other/` (tabs Item, Luck, Assist; a player's Opposed, Assist; the last tab used; Assist has its own file). Part document: [other-flyout.md](other-flyout.md).
- Run all 20: `npm test -- tests/other-flyout.test.mjs`

| Pattern | Test (what it checks) |
| --- | --- |
| `registerOtherFlyout: only on` | registerOtherFlyout: only on the Keeper's client with the Rollbox switch on |
| `tabs: Item ·` | tabs: Item · Luck · Assist; one character opens on Item, Assist never greyed (it offers Add a character); two or more on Luck with Item greyed out |
| `Assist tab: the` | Assist tab: the Assist flyout inside Other, with its own title and the character cards' Assist column |
| `last tab used:` | last tab used: Other opens on it again and keeps it while the selection changes, falling back while it can't be used |
| `a player.s tabs:` | a player's tabs: Opposed · Assist (no Luck: the Keeper's), each only when the Keeper allows it; none allowed draws nothing |
| `a player.s Opposed:` | a player's Opposed: the opponent is picked by targeting a token; cancelling the target changes nothing |
| `a player.s Assist:` | a player's Assist: one button, Target who you're helping; their own character can't be helped |
| `Luck: CoC7.s Luck` | Luck: CoC7's Luck check to each with the options and label; an NPC rolled for the Keeper |
| `Luck for a sheet` | Luck for a sheet without Luck (a creature): greyed, "No Luck on this sheet."; with others it is left out |
| `group Luck roll:` | group Luck roll: only the lowest Luck is asked; a tie asks the Keeper to pick |
| `started from the` | started from the character sheet's Luck: opens on Luck; plain sends a Regular Luck check at once |
| `a weapon: listed` | a weapon: listed with its skill and values; sent as a labelled skill check with the options |
| `improvised weapon without` | improvised weapon without damage: Fighting (Brawl) by default, labelled with the object, no damage roll |
| `improvised weapon with damage` | improvised weapon with damage: picked dice and +DB go in the message, the damage bonus filled in |
| `damage quick-picks fill` | damage quick-picks fill the damage line, which the Keeper can still change |
| `Throw: the damage` | Throw: the damage bonus is halved, on the toggle (+½DB), the quick-picks and the roll |
| `Simplified dice UI:` | Simplified dice UI: only the damage line, no quick-picks or Custom damage; typed DB or 1/2DB is accepted |
| `a weapon with` | a weapon with two skills: one row per skill, each sent with its own skill |
| `improvised weapon, Other…:` | improvised weapon, Other…: nothing can be sent until a skill is picked |
| `a character with` | a character with no weapons: says so, and offers only the improvised weapon |

## panel-layer.test.mjs

- Covers: `scripts/panel/layer.js` (the Panel layer's fourth value, Top when active or selected). Part document: [panel.md](panel.md).
- Run all 4: `npm test -- tests/panel-layer.test.mjs`

| Pattern | Test (what it checks) |
| --- | --- |
| `Panel layer: Top` | Panel layer: Top when active or selected is a fourth choice, stacking as Top when active |
| `Panel layer: without` | Panel layer: without Foundry's window counter, Top when active or selected works as Bottom |
| `Panel layer Top when active or` | Panel layer Top when active or selected: selecting tokens brings the panel forward; an update doesn't |
| `Panel layer Top when active:` | Panel layer Top when active: selecting tokens leaves the panel where it is |

## panel.test.mjs

- Covers: `scripts/panel/` (panel, the players list with nothing selected, the no-investigator message, character sheet for one or two, character cards, their × and a click picking one, a right click targeting a character, no one-sided border highlight in any stylesheet, menu host, appearance, moving the panel, the Panel layer, the clickable values and their shortcuts, Opposed from a right click, no Tab stops) and `scripts/main.js`. Part document: [panel.md](panel.md), [main.md](main.md).
- Run all 73: `npm test -- tests/panel.test.mjs`

| Pattern | Test (what it checks) |
| --- | --- |
| `main.js calls the` | main.js calls the panel at ready, which installs its hooks on the Keeper's client |
| `player, player Rollbox` | player, player Rollbox off: does nothing, installs no hooks or listeners, reads only that switch, draws nothing |
| `Keeper with the` | Keeper with the switch off: no panel hooks (only combat's gameplay rules), draws nothing |
| `no user yet:` | no user yet: does nothing instead of throwing |
| `1 token: character` | 1 token: character sheet just before the players list, with Action, Check, Other |
| `1 token: the` | 1 token: the sheet button opens the full sheet |
| `1 NPC: subtitle` | 1 NPC: subtitle is "occupation · NPC"; the full name is the name's tooltip on both cards |
| `panel transparency: the` | panel transparency: the saved value sets the background alpha; a change applies at once |
| `panel colour: the` | panel colour: the saved colour is the panel's background colour; a change applies at once |
| `theme: its class` | theme: its class on the panel root; older values (dark, light) and unknown values read as Foundry |
| `Foundry theme follows` | Foundry theme follows Foundry's interface: Light palette and the colour lightened, live; the colour isn't saved |
| `CoC7 themes fall` | CoC7 themes fall back to Foundry: CoC7 isn't the system, or Art Deco's images are missing (one warning) |
| `CoC7 themes: the` | CoC7 themes: the sheet shows each characteristic's half and fifth, each stat's maximum, MOV, Build and DB |
| `panel size: scales` | panel size: scales the whole panel from its bottom-left corner; 100% leaves it untransformed |
| `2 tokens: one` | 2 tokens: one two-character sheet, the player character on top and tan below; Opposed above Action, Check, Other |
| `3 or more` | 3 or more tokens: character cards, one row each with no upper limit; Opposed (several against one), Check and Other, no Action |
| `character cards: the ×` | character cards: the × on a card deselects that token, and the panel redraws without it |
| `character cards: a click on a card` | character cards: a click on a card selects only that character; its × still deselects only that one |
| `a right click on a character targets` | a right click on a character targets their token: a character card, the sheet; a value's right click stays its own |
| `setPanelContent: another part.s` | setPanelContent: another part's content replaces the character panel's; clearPanelContent puts the sheet back |
| `setPanelContent with idleActors:` | setPanelContent with idleActors: shown with nothing selected, the menu acting for them; its sheet's values open flyouts |
| `request buttons: one` | request buttons: one constant height from the CSS; no script sets it, whatever is selected |
| `token without an` | token without an actor is left out; with nothing else selected the panel stays hidden |
| `a box-select.s many` | a box-select's many hooks make one redraw on the next frame |
| `scene change: canvasTearDown` | scene change: canvasTearDown hides at once; canvasReady draws the new selection |
| `menu host: a button` | menu host: a button opens its flyout and is marked; clicking it again closes it |
| `menu host: a registered` | menu host: a registered flyout draws for the selection, again when it changes; closes when nothing is selected |
| `registerFlyout: an unknown` | registerFlyout: an unknown button, or one without render, is refused |
| `Opposed is a` | Opposed is a flyout: the menu stays, the flyout opens beside it, the two-character sheet stays; it stays open with three |
| `menu host: a staysOpen` | menu host: a staysOpen menu stays open with one token, and is told when the selection changed |
| `menu host: a flyout` | menu host: a flyout is given the host's open, so it can open another flyout with a starting state |
| `character cards: its` | character cards: its value columns follow the open flyout (HP, MP, SAN and Luck bars; STR or SIZ with Other on Assist) |
| `rollboxCardMeters: only the ticked` | rollboxCardMeters: only the ticked meters show on the character cards, redrawn when it changes |
| `updateActor: a shown` | updateActor: a shown character's new values are drawn |
| `placement maths: clamp` | placement maths: clamp on screen, the quarter's corner, spot round trip, re-clamp in a smaller window, unreadable spots |
| `moving off: beside` | moving off: beside the players list; dragging the header does nothing |
| `moving on .the` | moving on (the default): dragging the header moves the panel, kept on screen; it stays where dropped and its spot is saved |
| `a saved spot is` | a saved spot is used after a reload; turning moving off forgets it and docks the panel |
| `menu and flyouts open` | menu and flyouts open to the: Automatic towards the middle; Right or Left as chosen; docked, always right; top half grows down |
| `bug: a saved` | bug: a saved spot that is off the screen or can't be read is ignored, and the panel docked |
| `bug: when the` | bug: when the panel doesn't land where it is put (its layout failed), it stays docked instead of vanishing |
| `Reset position puts` | Reset position puts the panel back beside the players list at once and forgets its spot; moving stays on |
| `the two-character sheet:` | the two-character sheet: the bottom character's header drags the panel too |
| `an open flyout that would` | an open flyout that would run off the screen shifts the panel into view, and it goes back when the flyout closes |
| `a press on the open-sheet` | a press on the open-sheet button, or a click on the header without moving, doesn't move the panel |
| `the wheel while the panel is held` | the wheel while the panel is held steps Panel size by 10 (from the corner it would be anchored to), the map never gets it, and the size is saved on release; the wheel does nothing special otherwise |
| `registerPanel again takes off` | registerPanel again takes off its own hooks first and sets the old panel aside, with its listeners and watchers |
| `with its size watched, a redraw` | with its size watched, a redraw doesn't place the panel (no layout read); a size change does |
| `the combat box drags` | the combat box drags from anywhere on it, a row or a button; a press that doesn't move is still their click, a drag's click is swallowed |
| `character sheet values:` | character sheet values: the characteristics, SAN and Luck are buttons named for what they open; HP, MP and the character cards' values aren't |
| `a left click` | a left click opens the value's flyout, nothing sent: Check with only that characteristic ticked (again switches it), Check's Sanity tab, Other on Luck |
| `shortcuts, as on` | shortcuts, as on CoC7's sheet: Shift sends now, Ctrl (CoC7's copy a link) opens Check as a click does, Alt+Right adds to the ticks |
| `right click: no` | right click: no browser menu; Opposed opens with that character as the first side, Shift makes the card once both have a check |
| `Escape closes an` | Escape closes an open flyout while the setting is on; off, or with no flyout open, Escape is left to Foundry |
| `Shift . Left` | Shift + Left on a characteristic while Opposed waits for a side goes to Opposed, not to a Check |
| `two-character sheet: a` | two-character sheet: a top number is the top character's value, a bottom number the bottom one's |
| `no Tab stops:` | no Tab stops: every control in the panel and its flyouts is out of the Tab order |
| `Panel layer Bottom:` | Panel layer Bottom: beside the players list at the UI columns' level, under every window; moved, the same |
| `Panel layer Top:` | Panel layer Top: beside the players list above every window, not moving as players join; moved, the same level; a change applies at once |
| `Panel layer Top when active: a press brings` | Panel layer Top when active: a press brings it to the front with Foundry's window counter, so a window raised later goes above it again; without the counter it works as Bottom |
| `Panel layer Top when active: a press on` | Panel layer Top when active: a press on the window that was in front before the panel puts the panel just under it (Foundry doesn't give that window a new number) |
| `the flyout.s heading is its open tab` | menu host: the flyout's heading is its open tab's name, following a tab switch; the menu's name without tabs |
| `one selected: the` | one selected: the Keeper's sheet portrait is a deselect button; the panel then shows the nothing-selected view |
| `two-character sheet: each portrait` | two-character sheet: each portrait is a deselect button too |
| `dragging: the menu` | dragging: the menu and flyouts switch side as the panel crosses the screen's middle, before it is dropped |
| `followSidebar: a right-side` | followSidebar: a right-side spot keeps its distance from the sidebar as it expands and collapses |
| `a part that throws at ready` | main.js: a part that throws at ready is reported, and the parts after it still start |
| `redraws for its token's update` | a shown character also redraws for its token's update and for an effect on one of its items |
| `nothing selected: the Keeper.s panel` | nothing selected: the Keeper's panel lists each player's investigator (the meters of rollboxCardMeters, all four by default), with Check and Other for all of them; a row selects its token; the setting turns it off |
| `a player with no investigator` | a player with no investigator of their own reads the message in the panel's place, until they close it |
| `beside the players list, an open flyout` | beside the players list, an open flyout that runs off the screen moves the panel over the list until it closes |
| `no one-sided border highlight` | no one-sided border highlight in any Rollbox stylesheet or script, every theme (a line on one side of a selector for a state: hover, focus, pressed, selected, current, warning, new…) |
| `L1: a token update` | L1: a token update that only moves it (x, y) draws nothing again |


## player-panel.test.mjs

- Covers: a player's panel (`scripts/panel/index.js` with `scripts/player/`). Part documents: [player.md](player.md), [panel.md](panel.md).
- Run all 11: `npm test -- tests/player-panel.test.mjs`

| Pattern | Test (what it checks) |
| --- | --- |
| `player with the` | player with the player Rollbox on: the panel shows their own character at once, whatever is selected |
| `player.s menu: only` | player's menu: only the buttons with an allowed feature, none hidden in the DOM; Sanity is part of Check |
| `player.s sheet clicks:` | player's sheet clicks: only what the Keeper allows them (Luck needs Luck, not just Other) |
| `player whose assigned` | player whose assigned character changes: the panel follows it |
| `player without a` | player without a character of their own: the no-investigator message instead of a sheet, and no menu |
| `player.s flyouts: registered` | player's flyouts: registered on their client; Check opens with only the tabs their features allow |
| `player.s own Rollbox` | player's own Rollbox switch off: no panel, no flyouts, nothing drawn |
| `a feature changed` | a feature changed by the Keeper redraws the player's menu without a reload |
| `auto-hide: after the` | auto-hide: after the set time without use the sheet drops to the compact card; hovering brings it back |
| `players wait while the Keeper decides a first blow` | players wait while the Keeper decides a first blow: every menu button but Action greyed, "Waiting for the Keeper" on hover, a sheet click opens nothing; back once the scene's mark is off |
| `a player whose investigator is down` | a player whose investigator is down or in a bout of madness: the whole menu greyed with the reason on hover, no flyout opens, a sheet click opens nothing; back once CoC7 clears it |

## player.test.mjs

- Covers: `scripts/player/` (the switches, the player's menu, `ownCharacter`, `pickTarget`). Part document: [player.md](player.md).
- Run all 17: `npm test -- tests/player.test.mjs`

| Pattern | Test (what it checks) |
| --- | --- |
| `the player Rollbox` | the player Rollbox is on by default, off with its master switch |
| `canUse: the Keeper` | canUse: the Keeper always, even with the master off |
| `canUse: a player` | canUse: a player only with the master and that feature on |
| `canUse: Luck is` | canUse: Luck is the Keeper's, never a player's, whatever its saved tick box says |
| `canUse: an unknown` | canUse: an unknown feature is false, for the Keeper too |
| `playerMenu: Action ·` | playerMenu: Action · Check · Other, each only when one of its features is allowed |
| `ownCharacter: the user.s` | ownCharacter: the user's assigned character, only when they own it |
| `ownCharacter: null for` | ownCharacter: null for no user, no character, or a character that can't be read |
| `pickTarget: shows the` | pickTarget: shows the prompt, switches to the Target tool and resolves with the user's target |
| `pickTarget: Cancel resolves` | pickTarget: Cancel resolves null, puts back the targets the player had and the earlier tool |
| `pickTarget: a token` | pickTarget: a token the player has targeted already is used at once, without the prompt |
| `pickTarget: started from` | pickTarget: started from the Target tool, it goes back to Select |
| `pickTarget: a new` | pickTarget: a new pick or the scene closing ends the one waiting with null |
| `pickTarget: Escape cancels` | pickTarget: Escape cancels the pick (and is taken); with restore the targets from before come back after a pick too |
| `pickTarget: a failed` | pickTarget: a failed switch to the Target tool ends the pick with null |
| `pickTarget: without Foundry.s` | pickTarget: without Foundry's scene controls it does nothing and resolves null |
| `bug: Combined checks only` | bug: Combined checks only with Checks: without Checks it gives nothing, not even the Check button |

## public-docs.test.mjs

- Covers: `tools/public-docs.mjs`. Part document: [release-tools.md](release-tools.md).
- Run all 3: `npm test -- tests/public-docs.test.mjs`

| Pattern | Test (what it checks) |
| --- | --- |
| `publicCopy: project-only` | publicCopy: project-only blocks left out, public-only text kept, the contents list made from the kept sections |
| `match their sources` | public docs: DEVELOPING.md and DESIGN.md match their sources (run `npm run public-docs` after changing a source) |
| `designSource: the overview` | designSource: the overview's sections first, each feature one heading level down, links between files to sections |

## release-tools.test.mjs

- Covers: `tools/release-tools.mjs`. Part document: [release-tools.md](release-tools.md).
- Run all 15: `npm test -- tests/release-tools.test.mjs`

| Pattern | Test (what it checks) |
| --- | --- |
| `^package$` | **Group "package"**: all 1 tests below |
| `zips module.json, LICENSE` | package: zips module.json, LICENSE and scripts/ in one top folder named the id, and nothing that must not ship |
| `^smoke$` | **Group "smoke"**: all 9 tests below |
| `passes on a good zip` | smoke: passes on a good zip |
| `fails on a zip with tests/` | smoke: fails on a zip with tests/ inside |
| `fails on a zip with docs/` | smoke: fails on a zip with docs/ inside |
| `fails when a script module.json` | smoke: fails when a script module.json lists is missing |
| `fails when a script that` | smoke: fails when a script that another imports is missing |
| `fails when a template` | smoke: fails when a template a script uses is missing |
| `fails when the top` | smoke: fails when the top folder is not the module id |
| `fails when module.json.s version doesn.t` | smoke: fails when module.json's version doesn't match the zip name |
| `fails when a script has` | smoke: fails when a script has a syntax error |
| `^release-check$` | **Group "release-check"**: all 5 tests below |
| `passes on a good module` | release-check: passes on a good module and zip |
| `builds a fresh` | release-check: builds a fresh zip first, so an old zip with the same version can't pass |
| `fails on a console.log` | release-check: fails on a console.log or debugger left in scripts/ |
| `fails when the newest` | release-check: fails when the newest changelog entry is not module.json's version |
| `fails when module.json.s version appears` | release-check: fails when module.json's version appears twice in the changelog |

## roll-requests.test.mjs

- Covers: `scripts/roll-requests/` (links, whispers, NPC rolls, cards, guards, a player's requests through the Keeper relay, `pressControl`, maneuvers on CoC7's opposed card). Part document: [roll-requests.md](roll-requests.md).
- Run all 65: `npm test -- tests/roll-requests.test.mjs`

| Pattern | Test (what it checks) |
| --- | --- |
| `links: check link` | links: check link with every difficulty, dice, blind and label |
| `links: no poolModifier` | links: no poolModifier without bonus or penalty dice (CoC7 would show "check(0)") |
| `links: roll strings,` | links: roll strings, combined and Sanity links |
| `links: labels lose` | links: labels lose characters that break links or HTML, and are escaped |
| `links: a skill name` | links: a skill name holding < or > can't be a link option or a roll key (CoC7 puts it into the page as HTML) |
| `checkRequest: defaults, dice` | checkRequest: defaults, dice limits, no Pushed option |
| `checkRequest: combined is` | checkRequest: combined is never blind; bad checks give null and a warning |
| `sanityLoss: numbers and` | sanityLoss: numbers and dice are tidied; anything else is refused (the Sanity flyout's rule too) |
| `sanityRequest, weaponRequest, improvisedRequest,` | sanityRequest, weaponRequest, improvisedRequest, opposedRequest: shape and checks |
| `whisper: a skill` | whisper: a skill on the sheet goes to the player owners, by the sheet's CoC ID |
| `whisper: a sheet` | whisper: a sheet skill without a CoC ID goes by its sheet name; a renamed own language by CoC ID |
| `several characters: each` | several characters: each player character gets a request, the NPC is rolled; duplicates once |
| `label: the check.s` | label: the check's name, then the Keeper's text; HTML in labels and names escaped |
| `combined for a` | combined for a player: one combined link, all or any, no actor in the roll strings |
| `missing skill, player: requested` | missing skill, player: requested by CoC ID after checking CoC7 can find it |
| `missing skill, player: CoC7 can.t` | missing skill, player: CoC7 can't find it, so nothing is sent and the Keeper is told |
| `typed skill, player:` | typed skill, player: found by name in world items or a compendium, or refused |
| `missing skill, player: CoC7.s` | missing skill, player: CoC7's lookup gone means the request is sent anyway |
| `a name that` | a name that can't go in a link: the player is skipped with a notice; an NPC still rolls by uuid |
| `NPC characteristic, attribute` | NPC characteristic, attribute and sheet skill: CoC7's checks, no dialog, blind to the Keeper |
| `NPC missing skill:` | NPC missing skill: a raw roll at the base value, nothing added, a note to the Keeper |
| `NPC typed skill:` | NPC typed skill: the Keeper's value, else the group base; no value at all is skipped |
| `NPC combined: one` | NPC combined: one private roll at the highest (any) or lowest (all) value, named in a note |
| `weapon: the weapon.s` | weapon: the weapon's skill, labelled with the weapon; alternative skill when CoC7 says so |
| `weapon: skill main` | weapon: skill main or alternative picks that skill; weaponSkills lists both only when they differ |
| `weapon: automatic, burst` | weapon: automatic, burst or thrown with no alternative skill set falls back to its main skill |
| `weapon: a skill` | weapon: a skill stored as a CoC ID is labelled with the skill's name |
| `NPC with a` | NPC with a label: the Keeper's note is the label CoC7's card leaves out, with the difficulty, said once, just before the card |
| `weapon: missing from` | weapon: missing from the sheet, or without a skill, is skipped with a notice |
| `improvised: a labelled` | improvised: a labelled skill check plus a damage roll with the damage bonus filled in |
| `improvised: damage that` | improvised: damage that isn't dice is left out with a notice; NPC damage goes to the Keeper |
| `improvised: a zero` | improvised: a zero damage bonus and a typed +0 are left out of the damage |
| `Sanity, player: CoC7.s` | Sanity, player: CoC7's Sanity link; the cause is the label, the creature its record |
| `Sanity, NPC: CoC7.s` | Sanity, NPC: CoC7's Sanity card on the Keeper's side, and Rollbox clicks its roll |
| `Sanity: characters without` | Sanity: characters without a Sanity value are skipped |
| `opposed: one CoC7` | opposed: one CoC7 card with both sides, regular difficulty, dice; Start rolls clicked |
| `opposed: the Keeper` | opposed: the Keeper is told when Start rolls can't be clicked |
| `opposed: a missing` | opposed: a missing skill CoC7 can find is left to CoC7; one it can't stops the card |
| `CoC7 fails to` | CoC7 fails to make the card: the watch for its button stops, and the Keeper isn't told to click it |
| `CoC7.s links missing,` | CoC7's links missing, or not the CoC7 system: does nothing, one warning |
| `CoC7.s internal link` | CoC7's internal link handler missing: no opposed card, no NPC Sanity card, one warning each |
| `CoC7.s actor method` | CoC7's actor method or owners missing: that character is skipped, one warning |
| `a CoC7 method` | a CoC7 method that throws: skipped with a warning, never thrown to the flyout |
| `player.s client with` | player's client with the Player Rollbox off: send does nothing |
| `never whispered to` | never whispered to nobody: owners without ids are skipped, not posted publicly |
| `no request: nothing` | no request: nothing sent |
| `player.s client: a check` | player's client: a check for their own character goes out from their client, whispered to them |
| `player.s client: an` | player's client: an opposed roll goes to the Keeper's client; its answer is the player's result |
| `player.s client: with` | player's client: with no Keeper online the player is told and nothing is sent |
| `Keeper.s client: sends` | Keeper's client: sends a player's opposed roll as its own, leaving the NPC's side to the Keeper, and answers; refuses one with none of their characters |
| `the sender is the user Foundry` | Keeper's client: the sender is the user Foundry's server names; a message without one is ignored |
| `pressControl: CoC7.s handler` | pressControl: CoC7's handler still finds the pressed button after an await, as with a person's click |
| `a player.s Assist with their character helping` | Keeper's client: a player's Assist with their character helping and an NPC rolling rolls the NPC privately at once, no link to the Keepers; without them, refused |
| `a forged helper list` | Keeper's client: a player's check for another player's investigator with a forged helper list is refused; sent only when Assist confirms the group |
| `the opponent.s side open makes` | Keeper's client: a player's opposed roll with the opponent's side open makes CoC7's card with their side only, no Start rolls, and tells the GMs; an open card for someone else's side is refused |
| `roles on a player.s opposed card` | roles on a player's opposed card: once the Keeper's side joins, the active Keeper's client presses the joined side's role button until the player is Attacker and the joined side Defender; Start rolls is never pressed |
| `maneuver notice: read only` | maneuver notice: read only when a GM or a player of the attacker wrote it; a player's notice naming an NPC attacker is ignored |
| `maneuver relay: two answers` | maneuver relay: two answers to one notice close together make one card |
| `a relayed request is rebuilt` | Keeper's client: a relayed request is rebuilt by its normaliser; an unknown type or another player's character is refused |
| `maneuverRolls: the attacker` | maneuverRolls: the attacker's maneuver weapon with the Build dice first; Dodge, a fighting weapon or a counter; ties by the rules |
| `maneuver relay: the Keeper` | maneuver relay: the Keeper's client makes CoC7's combat opposed card for the target's player, presses Start Rolls; refuses anyone else |
| `maneuver tie: on a maneuver` | maneuver tie: on a maneuver's card offering Advantage, the active Keeper presses the one the rules give, once |
| `maneuver answers: Counter` | maneuver answers: Counter with the weapon picked; No response rolls the attacker's maneuver skill alone with the Build dice |
| `back on once the card is posted` | fight back with a Maneuver-on Punch: its Maneuver is off while CoC7 makes the card (the Punch as the weapon), back on once the card is posted |
| `CoC7 throwing still switches` | fight back with a Maneuver-on Punch: CoC7 throwing still switches it back on; one left off is switched on by restoreManeuvers |


## sanity-flyout.test.mjs

- Covers: `scripts/flyouts/check/sanity.js` (Check's Sanity tab). Part document: [sanity-flyout.md](sanity-flyout.md).
- Run all 7: `npm test -- tests/sanity-flyout.test.mjs`

| Pattern | Test (what it checks) |
| --- | --- |
| `the Sanity tab:` | the Sanity tab: its SAN list replaces the names line and its own send section replaces the check options; the title says Request a Sanity check |
| `from a SAN` | from a SAN click: plain sends CoC7's plain SAN check (an attribute check, no Sanity card) at once |
| `one character: current` | one character: current SAN shown; the line starts at 0 / 1D6 with its preset pressed; a preset sets both sides and sends |
| `the loss line:` | the loss line: typed sides are sent; one that isn't a loss turns red, blocks Send and says why; Custom writes both sides |
| `Simplified dice UI:` | Simplified dice UI: only the loss line, no presets or Custom button; a typed loss is sent |
| `What caused it` | What caused it is the label players see, after "Sanity check ·"; Creature goes to CoC7's sanReason |
| `several characters: Send` | several characters: Send to each (N); players asked, the NPC's card made, one without SAN skipped and shown |

## settings.test.mjs

- Covers: `scripts/settings.js` and every part's settings (the feature switches on top; the Rollbox panel, Player Rollbox, Turn order and turn controls, Gameplay rules and Setup check sections, with its Check now button). Part document: [settings.md](settings.md).
- Run all 15: `npm test -- tests/settings.test.mjs`

| Pattern | Test (what it checks) |
| --- | --- |
| `registered in page` | registered in page order: the five feature switches first, then their sections; the Keeper's Roll … attacks at once in Gameplay rules |
| `every setting.s scope,` | every setting's scope, default and reload, in one table (keys are permanent once released) |
| `.note. and .reset.` | 'note' and 'reset' are not leaked into Foundry's setting config |
| `every setting key` | every setting key starts with rollbox |
| `the feature switches in a box` | the feature switches in a box on top, then one box per section with its heading; one scope note per setting, no duplicates on re-render |
| `a feature switched off` | a feature switched off greys out its own section's box, display only: nothing saved |
| `L16: a player.s page` | L16: a player's page hides the Keeper's own settings (Show the players, the turn order's selection and click) |
| `Panel colour and` | Panel colour and Panel transparency are greyed out while a CoC7 theme is chosen (Foundry theme only) |
| `jQuery-style arg ignored` | jQuery-style arg ignored without error |
| `Reset buttons: one` | Reset buttons: one beside theme, transparency, colour, size and notice cards size, none on the switch, no duplicates on re-render |
| `a Reset position` | a Reset position button beside Allow moving the panel forgets the panel's spot at once |
| `each Reset puts` | each Reset puts back only its own default, in the form, with a change event |
| `Auto-hide after: its` | Auto-hide after: its time reads in seconds or minutes beside the slider, following it |
| `a player.s Configure` | a player's Configure Settings: Rollbox's tab and settings hidden while the Player Rollbox is off, shown when on |
| `Check setup now:` | Check setup now: Foundry's menu button (drawn first in the tab) moves into the Setup check section, after the feature switches, with its note |

## setup.test.mjs

- Covers: `scripts/setup/` (the setup check: the scan, the notice, the window's steps, Check now, what is added). Part document: [setup.md](setup.md).
- Run all 7: `npm test -- tests/setup.test.mjs`

| Pattern | Test (what it checks) |
| --- | --- |
| `scan: a firearm` | scan: a firearm the table or name rule is sure of is saved in one update per actor; a guess and an unset skill are asked; no Punch or maneuver questions |
| `setup window: the list` | setup window: the list, then one at a time; Save keeps the Keeper's answer on the weapon; Skip asks again only after a reload |
| `Reload kinds: every` | Reload kinds: every firearm with the kind Rollbox reads, a guess marked; a press saves the corrected kind at once |
| `at login: the notice` | at login: the notice only with the setting on and something to set up; Review opens the list |
| `a player.s client: no setup` | a player's client: no setup check hooks and no check now; a firearm added later is checked on its own |
| `left with Maneuver off` | scan: a weapon Rollbox left with Maneuver off (a fight back interrupted) is switched back on in the sheet's one update |
| `a save that fails` | setup window: a save that fails keeps the question and tells the Keeper in the window |

## shared.test.mjs

- Covers: `scripts/shared/` (value line, dice picker, Simplified dice UI, how a firearm reloads, the difficulty a number calls for). Part document: [shared.md](shared.md).
- Run all 8: `npm test -- tests/shared.test.mjs`

| Pattern | Test (what it checks) |
| --- | --- |
| `compact picker: each click` | compact picker: each click writes its dice formula into the line |
| `compact picker: typing` | compact picker: typing in the line moves the picker; text it can't show presses nothing |
| `value line: Enter` | value line: Enter or clicking away confirms, tidied; empty becomes 0; refused text is red and has no value |
| `Simplified dice UI:` | Simplified dice UI: on, the Custom button and its pickers are gone; changing it switches an open flyout at once |
| `reload kind: Rollbox.s flag` | reload kind: Rollbox's flag, then the CoC ID table, then the name rule; a handgun whose name says neither way is a guess |
| `reload kind: only firearms` | reload kind: only firearms with a capacity are reloaded; thrown, fighting and explosive skills never |
| `bug: edgeDistance measures` | bug: edgeDistance measures from where a token was moved to, not where Foundry's move animation has it |
| `difficultyFor: below 50` | difficultyFor: below 50 Regular, 50+ Hard, 90+ Extreme |

## skill-values.test.mjs

- Covers: `scripts/skill-values/`. Part document: [skill-values.md](skill-values.md).
- Run all 27: `npm test -- tests/skill-values.test.mjs`

| Pattern | Test (what it checks) |
| --- | --- |
| `table: names and` | table: names and CoC IDs unique, A–Z, bases are numbers or a characteristic |
| `table: spot checks` | table: spot checks against the Keeper Rulebook list (p. 56) |
| `characteristics: eight in` | characteristics: eight in sheet order with Hard and Extreme |
| `characteristics: missing values` | characteristics: missing values are null; no actor gives an empty list |
| `attributes: Luck, and` | attributes: Luck, and Sanity with its max (no Idea or Know: those are INT and EDU checks) |
| `attributes: missing fields` | attributes: missing fields are null |
| `lowestLuck: the lowest,` | lowestLuck: the lowest, all of them on a tie, actors without Luck skipped |
| `skills: trained first,` | skills: trained first, highest first, ties A–Z; then untrained A–Z, the divider before the first |
| `skills: a skill` | skills: a skill on the sheet at its base value is untrained but still on the sheet |
| `skills: missing skills` | skills: missing skills appear once, at their base value, not on the sheet |
| `skills: missing Dodge` | skills: missing Dodge is half DEX (rounded down), missing Language (Own) is EDU |
| `skills: Dodge on` | skills: Dodge on the sheet is trained only above half DEX |
| `skills: an own` | skills: an own language renamed on the sheet replaces Language (Own), by CoC ID or by the own flag |
| `skills: a sheet` | skills: a sheet skill matches the table by CoC ID even with another name (translated sheet) |
| `skills: matching by` | skills: matching by name ignores case, accents and spacing |
| `skills: extra sheet` | skills: extra sheet skills are included at their sheet value |
| `skills: an actor` | skills: an actor with no skills gets every table skill at base, none trained |
| `skills: a hand-made` | skills: a hand-made NPC that stores its whole value as base still reads as trained |
| `skills: a duplicate` | skills: a duplicate on the sheet shows once, at the higher value |
| `skills: no skill` | skills: no skill is hidden by CoC7's era, Modern skills included |
| `skills: guards —` | skills: guards — no actor, no system, no items, odd values, non-skill items |
| `groupSkills: every table` | groupSkills: every table skill A–Z with no values |
| `groupSkills: adds the` | groupSkills: adds the selected characters' extra sheet skills once |
| `withLevels: half and` | withLevels: half and fifth rounded down; all null without a value |
| `tableBaseFor: a table` | tableBaseFor: a table skill's base for this actor (Dodge from DEX); null for a CoC ID not in the table |
| `sameSkill: one skill` | sameSkill: one skill by CoC ID, by its table entry, by a CoC ID as its name, or by name |
| `findSkillRow: by CoC` | findSkillRow: by CoC ID first, then by name, as sheetSkill finds it |

## status.test.mjs

- Covers: `scripts/status/` (`getStatuses`, `setRollboxStatus`, `attackDice` with its situation lines, `isMaceSpray`) and `scripts/panel/status-cards.js`. Part document: [status.md](status.md).
- Run all 15: `npm test -- tests/status.test.mjs`

| Pattern | Test (what it checks) |
| --- | --- |
| `getStatuses: CoC7.s conditions,` | getStatuses: CoC7's conditions, Foundry's status icons and Rollbox's notes, serious first |
| `getStatuses: a player` | getStatuses: a player reads their own Rollbox states as 'you' |
| `getStatuses: Aiming and` | getStatuses: Aiming and Dived for cover come only from combat's round notes, not a status flag or another round |
| `getStatuses: nothing for` | getStatuses: nothing for no character or one without conditions |
| `setRollboxStatus: Restrained is` | setRollboxStatus: Restrained is its note; Prone is CoC7's and only read |
| `setRollboxStatus does nothing:` | setRollboxStatus does nothing: already so, not Rollbox's, not owned |
| `attackDice: prone is` | attackDice: prone is a bonus die in melee, a penalty die for a gun, none at point blank |
| `attackDice: dived for` | attackDice: dived for cover is CoC7's Under cover toggle, not a die on the slider; a prone shooter for a gun |
| `attackDice: no target,` | attackDice: no target, no lines |
| `attackDice: point blank,` | attackDice: point blank, firing into melee and outnumbered are CoC7's own toggles, counted in the total only |
| `attackDice: mace spray` | attackDice: mace spray never gets point blank: CoC7's own is taken off |
| `statusCards: Rollbox.s own` | statusCards: Rollbox's own on top, serious nearest the sheet, each with its hover text |
| `statusCards: none without` | statusCards: none without statuses; placeStatusCards puts them before the sheet |
| `panel: status cards` | panel: status cards above the sheet for one selected character, none for two; CoC7's icons redraw them |
| `statusCards: the Keeper clears` | statusCards: the Keeper clears Restrained from its card; CoC7's own statuses have no × |

## utils.test.mjs

- Covers: `scripts/utils.js`, and every file in `scripts/` (no `console.log`, the module id typed once). Part document: [utils.md](utils.md).
- Run all 7: `npm test -- tests/utils.test.mjs`

| Pattern | Test (what it checks) |
| --- | --- |
| `MODULE_ID and scope` | MODULE_ID and scope notes |
| `escapeHtml: markup, quotes,` | escapeHtml: markup, quotes, null |
| `isKeeper: GM true,` | isKeeper: GM true, player false |
| `no console.log or` | no console.log or debugger in scripts/ |
| `only utils.js types` | only utils.js types the module id as a string in code |
| `option: a registered` | option: a registered setting's value; an unregistered one's declared default |
| `L3: flagsRemoved` | L3: flagsRemoved uses Foundry v14's ForcedDeletion for each flag; the deprecated -= key only without it |
