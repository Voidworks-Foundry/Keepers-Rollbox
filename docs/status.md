# Status effects (`scripts/status/`)

What state a character is in (CoC7's conditions plus Rollbox's own combat states), for the status cards above the character sheet (`panel/status-cards.js`, [panel.md](panel.md)) and the Action flyout's target box (`flyouts/action/target.js`, [action-flyout.md](action-flyout.md)), and what those states, and the situation Rollbox reads from the board (point blank, firing into melee, an outnumbered target), do to an attack. CoC7's conditions (`system.conditions`: dying, unconscious, major wound, dead, prone, temporary and indefinite insanity) are only read. Aiming and Dived for cover are combat's round notes (`combat/round-notes.js`, read through `combat/index.js`; [combat.md](combat.md)), their one source: read here, set and cleared by combat. Rollbox's own setter (`setRollboxStatus`) covers only Restrained, its own note on the character, since CoC7 has no Restrained condition: the Keeper sets it after a Restrain maneuver (the Maneuver tab's Set Restrained) and clears it with the × on its status card. Prone is CoC7's own condition and only read. Files: `index.js` (the part's public surface), `statuses.js` (the statuses, reading and setting them), `effects.js` (their effect on an attack), `status.css` (the status cards' look).

User guide: [Statuses and alerts](../guide/statuses-and-alerts.md).

**Status key:** *Confirmed* only when the [Internal API registry](DEVELOPING.md#internal-api-registry) says so; everything here is **assumed** unless stated. No `register…()` and no hooks: it is called by the panel (`statusCards`, `placeStatusCards`), combat's turn order (`statusCards`) and the Action flyout's target box (`attackDice`); the Action flyout and the panel's menu host also read `downReason`, `isHeld`, `playerBlock`, `BOUT_REASON`, `hasStatus` and `setRollboxStatus`, and combat reads `hasStatus`. `status.css` is listed in `module.json` `styles`.

## Code

### `index.js`
- **How it works:** The part's public surface: re-exports `statuses.js` (`BOUT_REASON`, `ROLLBOX_STATUSES`, `downReason`, `getStatuses`, `hasStatus`, `isHeld`, `playerBlock`, `readRoundNotesWith`, `setRollboxStatus`) and `effects.js` (`attackDice` only; `isMaceSpray` stays inside `effects.js`). Other parts import status only from here; `effects.js` reads `statuses.js` directly, so the part has no import cycle.
- **Connects to:** every part that reads a status. **Could interact poorly with:** nothing. **Assumed.**

### `readRoundNotesWith({ aiming, divedForCover })` (`statuses.js`)
- **How it works:** Combat hands over its round-note readers (`isAiming`, `hasDived`) when `combat/index.js` loads, so status reads Aiming and Dived for cover without importing combat (combat imports status for `hasStatus`). Until then both read false.
- **Connects to:** `combat/index.js`. **Could interact poorly with:** nothing. **Assumed.**

### `ROLLBOX_STATUSES`, private `STATUSES` (`statuses.js`)
- **How it works:** The ten statuses in the order `getStatuses` returns them, serious first: Dying, Unconscious, Major wound, Dead (serious); Prone, Restrained, Bout of madness (CoC7's `tempoInsane`, id `tempInsanity`; the name CoC7 itself uses), Indefinite insanity (other); Aiming, Dived for cover (Rollbox's own). Each has `id`, `name`, `kind`, the hover text `detail` from the status boards (Keeper Rulebook pages in it), `coc7` (CoC7's condition key: `dying`, `unconscious`, `criticalWounds`, `dead`, `prone`, `tempoInsane`, `indefInsane`) for CoC7's, and for Aiming and Dived for cover `yours`, the same text written to the player ("you"). `ROLLBOX_STATUSES` (`restrained` only) are the ones `setRollboxStatus` may set; the status cards give these a Keeper's ×.
- **Connects to:** `getStatuses`, `hasStatus`; CoC7's `STATUS_EFFECTS` keys (8.15); `panel/status-cards.js` `STATUS_ICONS` (one icon per id) and its clear button (`ROLLBOX_STATUSES`).
- **Could interact poorly with:** a CoC7 update that renames a condition key: that status never shows. **Assumed.**

### `hasStatus(actor, id)` (`statuses.js`)
- **Round notes:** Aiming and Dived for cover read combat's round notes (`isAiming`, `hasDived`, handed over by `combat/index.js` through `readRoundNotesWith`): this round's note only, in a running encounter. Out of an encounter neither can be on.
- **How it works:** CoC7's statuses (`coc7Condition`): `actor.system.conditions[key].value === true`, or Foundry's `actor.statuses` (the set Foundry fills from active effects, which CoC7's status icons are) has the key. Aiming and Dived for cover: combat's round notes (above). Restrained: Rollbox's note, `actor.flags["keepers-rollbox"].statuses.restrained === true` (`rollboxNote`). Every read is guarded: a throw reads as "not set". An unknown id or no actor is `false`.
- **Connects to:** CoC7's `system.conditions` (read only); Foundry's `Actor#statuses`; `combat/index.js` (`isAiming`, `hasDived`, handed over through `readRoundNotesWith`); Rollbox's flag; the Maneuver tab's Set Restrained button (`hasStatus(target, "restrained")`).
- **Could interact poorly with:** modules that add their own status effects with the same ids as CoC7's (`prone`, `dead`): they show as CoC7's. **Assumed.**

### `downReason(actor)`, `isHeld(actor)`, `playerBlock(actor)`, `BOUT_REASON` (`statuses.js`)
- **How it works**: `downReason` → "Dead", "Dying" or "Unconscious" (CoC7's own conditions through `hasStatus`, the worst one) or `null`. `isHeld` → whether something holds the character so Break free has something to break: Rollbox's Restrained today. `playerBlock` → why a player's whole menu is greyed: `downReason`, else `BOUT_REASON` ("Bout of madness: the Keeper controls you") while CoC7's `tempoInsane` is on (the condition CoC7 itself names Bout of madness and sets for a bout's duration), else `null`. Indefinite insanity, Prone and Major wound block nothing.
- **Connects to:** the Action flyout (`limit`, `goalBlock`), the panel's menu host (`playerBlock`), combat's `dying.js` (`hasStatus`).
- **Could interact poorly with:** nothing known. **Assumed.**

### `getStatuses(actor)` (`statuses.js`)
- **How it works:** → `[{ id, name, kind: "serious" | "rollbox" | "other", detail }]`, every status the character has, in `STATUSES` order (serious first). `detail` is the hover text; a player looking at their own character (not the Keeper, `actor.isOwner`; `readByOwner`) gets the "you" text for Aiming and Dived for cover. Empty for no character.
- **Connects to:** `panel/status-cards.js` (the panel's and the turn order's cards); `effects.js`; the Action flyout's target box (`flyouts/action/target.js`).
- **Could interact poorly with:** nothing known. **Assumed.**

### `setRollboxStatus(actor, id, on)` (`statuses.js`)
- **How it works:** → `Promise<boolean>`, for `id` in `ROLLBOX_STATUSES` (`restrained`). Aiming and Dived for cover aren't set here: they are combat's round notes (`combat/round-notes.js`), their one source. False and nothing written when the state already is as asked, for any other id, or when the user doesn't own the character (`actor.isOwner === false`, one warning). Restrained is Rollbox's note: `actor.setFlag("keepers-rollbox", "statuses.<id>", true)` / `unsetFlag`. A throw is one warning and false. True when the state was changed.
- **Connects to:** Foundry's `Document#setFlag` / `unsetFlag`. Called by the Maneuver tab's **Set Restrained** (on, [action-flyout.md](action-flyout.md)) and the Restrained status card's × (off, `panel/status-cards.js`), both on the Keeper's client.
- **Could interact poorly with:** nothing clears Restrained on its own: it stays until the Keeper presses the ×. **Assumed.**

### `attackDice({ attacker, target, weapon, pointBlank, intoMelee, outnumbered })` (`effects.js`, re-exported from `index.js`); private `isMaceSpray(weapon)`, `MACE_COCID`, `MACE_NAME`, `weaponKind`, `targetLine`
- **How it works:** → `{ lines: [{ status, name, kind, dice, note, effect?, toggle? }], net, total, toggles }`; `name` and `kind` are what the target box shows (the status's name and kind, or `"situation"`), `note` its hover reason, `effect` a text effect in place of dice. One line per status of the target (`getStatuses`), for the picked weapon: a firearm is a weapon with CoC7's `system.properties.rngd`, any other weapon is melee, no weapon (none picked, or a spell) gives only notes. Prone: melee +1 ("easier to hit when down"), firearm −1 ("smaller target for a gun"), 0 at point blank (`pointBlank: true`, "no penalty at point blank"), no weapon a note with both. Dived for cover: firearm −1 with `toggle: "cover"` (CoC7's Under cover on its ranged card, for the caller to tick instead of adding a die), otherwise "no effect on the attack". Unconscious: 0, effect "misses only on a fumble". Every other status: 0, "no effect on the attack". A prone attacker with a firearm adds +1 ("You are prone", "shooting while prone"). Situation lines (kind `situation`), with a target: **Point blank** for a firearm with `pointBlank` (+1, `toggle: "pointBlank"`, CoC7's Point blank); for mace spray (`isMaceSpray`: CoC ID `i.weapon.mace-spray` in `flags.CoC7.cocidFlag.id`, or a name matching "mace spray") 0, "never for mace spray" (p. 406), `toggle: "noPointBlank"`, and prone keeps its penalty; **Firing into melee** for a firearm with `intoMelee` (−1, `toggle: "inMelee"`); **Outnumbered** for a melee weapon with `outnumbered` (+1, `toggle: "outnumbered"`). `toggles` lists the CoC7 toggles to set; `net` is the sum of the lines without a toggle, kept within CoC7's two bonus or two penalty dice (roll-requests' `MAX_DICE`; a toggled die is CoC7's, so never counted twice): the dice for the card's slider. `total` is every line's dice within the same limits: what the card will show. Range difficulty, the target's Build size dice, multiple shots and automatic fire are left to CoC7's card, which sets them itself. Rules: Keeper Rulebook p. 108, 113, 127–128, 406.
- **Connects to:** `getStatuses`, `hasStatus`; roll-requests' `MAX_DICE`; the Action flyout's target box (`flyouts/action/target.js`), which works out `pointBlank` (a fifth of the attacker's DEX in feet, edge to edge), `intoMelee` and `outnumbered` (combat's `situation.js`), shows the lines and has the dice and toggles set on CoC7's attack card; CoC7's CoC ID flag (registry).
- **Could interact poorly with:** Thrown weapons and bows are ranged in CoC7, so they count as firearms here. **Assumed.**

## Hooks, overrides, keybindings
- None.

## Settings
None.

## Tests
`tests/status.test.mjs` ([TESTS.md, status.test.mjs](TESTS.md#statustestmjs)): reading CoC7's conditions, Foundry's status icons, Rollbox's notes and combat's round notes (Aiming and Dived for cover only from there, and only this round's); the "you" text; nothing for no character; setting Rollbox's Restrained note (Prone only read); the does-nothing paths of `setRollboxStatus`; `attackDice` for melee, firearm, point blank, a dive, a prone shooter, unconscious and no target, and its situation lines (point blank and mace spray, firing into melee, outnumbered); the status cards' order, colours and hover text; the panel's cards for one character, none for two, and their redraw on a CoC7 status icon; the Keeper's × that clears Restrained (none on CoC7's statuses).
