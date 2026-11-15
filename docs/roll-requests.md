# Roll requests (`scripts/roll-requests/`)

The only code that talks to CoC7 about rolls. The Keeper's menus describe what they want as plain data (`checkRequest`, `sanityRequest`, `weaponRequest`, `improvisedRequest`, `opposedRequest`); `send()` turns that into CoC7's own request links, whispered to each character's player owners or posted in chat, or copies the link. Characters with no player owner (NPCs) are rolled at once on the Keeper's side, privately, through CoC7's actor methods. CoC7 rolls, compares, spends Luck, pushes and applies every result; Rollbox writes no dice or success-level code. Keeper only: `send()` does nothing on a player's client. Every CoC7 call is guarded, so a CoC7 change makes a request do nothing (with a warning) instead of throwing. Rollbox never changes how CoC7 handles a click on a link: a Keeper who clicks a request's link with tokens selected rolls it for each selected token, as CoC7 does (Void, 2026-11-14).

Files (menus import from `index.js` only):

| File | Holds |
| --- | --- |
| `index.js` | `send()` and the sending routes (players, NPC Sanity, opposed, Copy link); re-exports the public surface: the request functions, `damageText`, `weaponSkills`, `ownersOf`, `DIFFICULTIES`, `MAX_DICE` |
| `requests.js` | the request descriptions: `checkRequest`, `sanityLoss`, `sanityRequest`, `weaponRequest`, `improvisedRequest`, `opposedRequest` |
| `resolve.js` | one request for one character: `resolveCheck`, a weapon's skills, damage formulas, labels, `planCheck`, `linkForPlan` |
| `coc7.js` | the guarded CoC7 helpers: `coc7LinksReady`, `linkActorClick`, `ownersOf`, `requestText`, `callActor`, `coc7FindsSkill`, `skillsCoC7CantFind` |
| `keeper-rolls.js` | NPC rolls for the Keeper: `rollForKeeper` and its notes |
| `links.js` | link text |
| `card-buttons.js` | clicks a button on a card Rollbox just asked CoC7 for |

Skill-name matching (CoC IDs, the own-language flag, table entries, group bases, the sheet skill) is `skill-values/`'s (`docs/skill-values.md`).

**Status key:** *Confirmed* only when the build guide's Internal API registry or changelog says so. Nothing in this part has been tried at the table yet, so everything is **assumed** unless stated otherwise. CoC7 behaviour below is from the CoC7 8.15 source (`reference/CoC7/`, recovered from its source map) and Foundry build 368's client source.

## What happens for each request

| Request | Player character (has a player owner) | NPC (no player owner) |
| --- | --- | --- |
| Check: characteristic, Luck | `@coc7.check` link in a message | `actor.characteristicCheck` / `attributeCheck(key, true, {difficulty, poolModifier, blind: true})` |
| Check: skill on the sheet | link, by the sheet skill's own CoC ID, else its name | `actor.skillCheck(skillItemUuid, true, …)` |
| Check: skill missing from the sheet | link (by Rollbox's CoC ID, else the name), after checking CoC7 can find the skill; CoC7 adds it when rolled | `actor.runRoll({rollType: "R/MA", threshold: base value, …})` and a note to the Keeper naming it; nothing added |
| Idea / Know | an INT / EDU check; the Keeper types "Idea" or "Know" as the label (since 0.1.1) | the INT / EDU check as above |
| Combined check | `combinedall` / `combinedany` link; CoC7's combined card | one private `R/MA` roll at the highest value (Any one) or lowest (All of them), with a note naming the checks (Void, 2026-11-13) |
| Weapon | skill check labelled "Skill with the Weapon" | the skill check as above, and a note to the Keeper naming the weapon |
| Improvised weapon | skill check labelled "Skill with What", plus a damage roll in the message | the skill check, and a note to the Keeper naming the object, with the damage roll |
| Any check with the Keeper's label | the link shows the check, then the label: "Hard Spot Hidden · notice the knife" | the check as above, and a note to the Keeper: "Guard: Hard Spot Hidden · notice the knife" |
| Sanity | `@coc7.sanloss` link | CoC7's Sanity card made on the Keeper's side; Rollbox clicks its Sanity roll (Void, 2026-11-13); the card is public |
| Opposed | one CoC7 opposed card with both sides; Rollbox clicks Start rolls | the same card (Start rolls rolls the NPC side) |

In `chat` mode a player character's request is posted publicly instead of whispered; NPCs are still rolled privately. In `link` mode the link is copied and nothing is sent or rolled.

## Code

### `requests.js`: `checkRequest({ checks, all, difficulty, dice, blind, label })`
- **How it works:** Checks and tidies one check, or a combined check when two or more are given. Each check is `{ kind, name }`: `characteristic` with CoC7's key (`str` … `edu`, case ignored); `attribute` with `lck` (Luck, the Other menu's; Sanity goes through `sanityRequest`, and Idea and Know are INT and EDU checks since 0.1.1, so `san`, `idea` and `know` give null); `skill` with the name as listed, optional `cocid`, and optional `value` (the Check menu's "+ Add" entry's group base or the Keeper's typed value, used for an NPC that lacks the skill). `difficulty` is `regular` (default), `hard`, `extreme` or `hidden`; anything else is regular. `dice` is whole bonus (+) or penalty (−) dice, clamped to ±2 (Keeper Rulebook p. 91). `blind` is forced off on a combined check (CoC7's combined card is always public, Gap 5). `label` is cleaned (`cleanLabel`). There is no Pushed option: a `pushed` field is ignored (pushing happens from CoC7's result card, Gap 3). Returns `{ type: "check", checks, combined, all, difficulty, dice, blind, label }`, or `null` with one `console.warn` when any check is unknown or none is given.
- **Connects to:** `CHARACTERISTICS` from `skill-values/`. Called by the Check menu (`docs/check-menu.md`) and Assist.
- **Could interact poorly with:** nothing outside the module (pure data). **Confirmed** by tests only.

### `requests.js`: `sanityLoss(text, empty)`
- **How it works:** The one rule for a Sanity loss, used by `sanityRequest` and the Sanity menu's value lines, so the two always agree. Spaces removed and upper-cased ("1d4 + 1" → "1D4+1"); empty gives `empty` (`null` when the field is required). A loss is a whole number or dice (`D6`, `1D6`, `2D10`; no zero dice or faces) joined by `+` or `-`, at most 20 characters; anything else gives `null`. CoC7 hands both losses to Foundry's `Roll` and draws the failure loss's maximum every time the card renders, so a malformed loss would break the card (BUILD-GUIDE "Cards: Sanity").
- **Connects to:** `sanityRequest`; `sanity-menu/` (`docs/sanity-menu.md`).
- **Could interact poorly with:** nothing (pure text). **Confirmed** by tests only.

### `requests.js`: `sanityRequest({ success, failure, cause, creature })`
- **How it works:** `success` / `failure` are the SAN lost on a success / failure, checked and tidied by `sanityLoss` (empty is `"0"`); one that isn't a loss gives `null` with a warning. `cause` becomes the link's label as given (shown to players instead of the numbers); the Sanity menu passes "Sanity check · Seeing a ghoul" or its default "Sanity (1/1D6)" (`docs/sanity-menu.md`). `creature` goes to CoC7's `sanReason`, with characters that break link options removed. No blind (CoC7 can't, Gap 4), no difficulty, no dice.
- **Connects to:** the Sanity menu.
- **Could interact poorly with:** CoC7's creature record (`maxLossToSanReason`): the same creature typed two ways counts as two sources. **Assumed.**

### `requests.js`: `weaponRequest({ weaponId, skill, difficulty, dice, blind })`
- **How it works:** Records the weapon's item id, which skill (`skill`: `"main"` or `"alternative"`; anything else is `null`: the skill CoC7's cards would use) and the options. At `send()` the weapon is looked up on each character's sheet and its skill chosen by `weaponSkill(actor, weapon, skill)`. Sent as an ordinary skill check labelled "Firearms (Handgun) with the .38 Revolver" or "Throw with the Knife"; never `@coc7.item`, which starts CoC7's attack card and ignores difficulty, dice and blind (Gap 2). A weapon not on the sheet, or with no skill, skips that character with a notice.
- **Connects to:** the Other menu's Item section (`docs/other-menu.md`); CoC7 weapon data `system.skill.main` / `alternativ` / `usesAlternativeSkill`.
- **Could interact poorly with:** weapons whose skill id points at a deleted skill: the stored name is used, so the skill may be requested as missing. **Assumed.**

### `resolve.js`: `weaponSkill(actor, weapon, which)` and `weaponSkills(actor, weapon)` (`weaponSkills` public)
- **How it works:** A weapon stores `system.skill.main` and `system.skill.alternativ` (CoC7's spelling), each `{ id, name }`; a stored skill is the sheet skill with that id, else the stored name (which can be a CoC ID). `weaponSkill` with `which` `"main"` or `"alternative"` takes that one; without it, the alternative when `system.usesAlternativeSkill` is true (automatic, burst or thrown), else the main skill, as CoC7's opposed and combined cards choose. An alternative that isn't set falls back to the main skill, like CoC7's `skillAlternative` getter (`models/item/weapon-system.js`), so an automatic or thrown weapon with only a main skill still has one. Returns `{ kind: "skill", name, cocid, value: null }`, or null when nothing is set. `weaponSkills` gives the Item menu's rows: `[{ which: "main", skill }, { which: "alternative", skill }]` when the weapon uses an alternative skill and it differs from the main one (skill-values' `sameSkill`: by CoC ID and name, with Rollbox's table linking a name to its CoC ID, so "Throw" and "i.skill.throw" are one skill), otherwise one entry with the skill a request would use. An alternative stored on a weapon without the automatic, burst or thrown property is ignored, as CoC7's own weapon sheet hides it then (`templates/items/weapon-header.hbs`).
- **Connects to:** `weaponRequest` (via `planCheck`), `other-menu/item.js`.
- **Could interact poorly with:** CoC7 changing its weapon data or the getter's fallback. **Assumed** (from the CoC7 8.15 source).

### `requests.js`: `improvisedRequest({ what, skill, damage, difficulty, dice, blind })`
- **How it works:** `skill` is a name or a skill check object. Sent as a skill check labelled "Fighting (Brawl) with Candlestick". When `damage` is given, the character's damage bonus (`system.attribs.db.value`: CoC7 stores `-2`, `-1`, `0`, `1D4`, `2D6` …) replaces `DB`, and half of it replaces `½DB` or `1/2DB` (halved the way CoC7's `CoC7Utilities.halfDB` does: dice sizes and positive numbers round down, negative numbers away from zero). Any "+0" or "-0" term is then left out (`withoutZeros`), so a zero damage bonus, half of a damage bonus of 1, or a typed "1D6+0" reads "1D6". The result must hold only dice and arithmetic and pass Foundry's `Roll.validate`; then it goes in the same message as a Foundry inline roll, `[[/r 1D6+1D4 # Candlestick damage]]`, which the player clicks. Otherwise the request goes without damage: `planCheck` returns a `warning`, and `sendTo` or `copyLink` tells the Keeper (the planning step only reads the actor). For an NPC the damage roll is in the Keeper's note. Nothing is added to the sheet.
- **`damageText(text)`** (`resolve.js`, public): the same check on the formula as the Keeper writes it, before a damage bonus is known (`DB` counted as 0), returning the formula without spaces or null. The Other menu's Item section uses it for its damage line, so the menu and the request follow one rule.
- **Connects to:** the Other menu's Item section (`docs/other-menu.md`); Foundry's inline rolls (`TextEditor._enrichInlineRolls`, deferred `/r` roll).
- **Could interact poorly with:** a damage bonus set to text CoC7 doesn't compute (e.g. `auto` before CoC7 has worked it out): the damage is left out with a notice. Modules that restyle inline rolls. **Assumed.**

### `requests.js`: `opposedRequest({ sides })`
- **How it works:** Exactly two sides, each `{ actor, check, dice }`, with two different characters (`actorKey`: by uuid, else id or name); otherwise `null` with a warning. Dice clamped to ±2. No difficulty: the other side's result is the difficulty (p. 92); can't be pushed (p. 90).
- **Connects to:** the Opposed roll view (`docs/opposed-roll.md`).
- **Could interact poorly with:** nothing (pure data).

### `index.js`: `send(request, actors, { mode })`
- **How it works:**
  1. Does nothing unless this user is the Keeper (`isKeeper()`), and nothing (one `console.warn`, `unavailable: true`) unless the system is CoC7 and `CONFIG.CoC7Link.documentClass` is registered.
  2. `mode`: `whisper` (default, "Request from player"), `chat` ("Send to chat") or `link` ("Copy link"); anything else does nothing with a warning.
  3. Opposed requests go to `sendOpposed` (below). Otherwise each actor is handled once (duplicates and tokens without an actor dropped). In `link` mode only the first actor is used (for weapons and per-sheet skill names), or none.
  4. Per character: `actor.owners` (CoC7's getter: non-GM users with OWNER). Unreadable: skipped with a warning. Non-empty: a request to the players. Empty: an NPC, rolled for the Keeper.
  5. A failure for one character is caught, warned and recorded; the others still go.
- **Returns:** `{ requested, rolled, skipped: [{ actor, reason }], copied, unavailable }` for the menus to show. `actor` is null only for an opposed card that couldn't be made at all.
- **Connects to:** `ChatMessage.create`; `game.clipboard.copyPlainText`; `ui.notifications`; CoC7's actor methods and link handler. Every menu sends through it.
- **Could interact poorly with:**
  - Foundry: a message with an empty `whisper` list is public, so Rollbox never creates one: a player character whose owners have no ids is skipped. **Assumed** (Foundry behaviour, BUILD-GUIDE "Whispers").
  - CoC7's roll dialog lets the player change difficulty, dice and card type when clicking a request (Gap 9, accepted). **Assumed.**
  - A player who owns several characters picks one in CoC7's actor picker; the link isn't tied to the character. **Assumed.**
  - Chat-log modules that rewrite message content before render. **Assumed.**

### Player characters: `requestFromPlayers`, `postRequest` (`index.js`), `requestText` (`coc7.js`), `resolveCheck`, `planCheck`, `linkForPlan` (`resolve.js`)
- **How it works:** First, for any skill missing from the sheet, `coc7FindsSkill` (below); if CoC7 can't find it, the character is skipped and the Keeper told, because CoC7 would do nothing when the player clicked. Then the link (`linkForPlan`); a name that can't go in a link (holds `, : [ ] { } # &`) skips the character with a notice. The message is CoC7's own wording, `CoC7.MessageTargetCheckRequested` ("Your keeper has requested {name} make a {check} roll."), with the actor's name escaped, or the same sentence in English if the key is gone. Speaker alias: the Keeper's user name, as CoC7's Create link tool does. `whisper`: the owners' ids. `chat`: the same message without `whisper`, one per character. The message carries no Rollbox flag.
- **A skill given as a CoC ID** (a weapon's stored skill can be `i.skill.throw`, as on CoC7's compendium weapons): `resolveSkill` treats the name as the CoC ID, so the label reads the skill's name from Rollbox's table ("Throw with the Knife"), or the sheet skill's name, never "i.skill.throw". A CoC ID the table doesn't have is shown as its words ("i.skill.made-up-skill" → "Made Up Skill") and has no base value for an NPC.
- **Skill keys:** on the sheet, the sheet item's own CoC ID, else its sheet name. A sheet skill's name alone isn't always enough: CoC7's `getItemByName` compares only the part in brackets ("Handgun"), and a renamed own language ("Language (English)") matches "Language (Own)" only by CoC ID. A table CoC ID on a sheet skill that lacks one would make CoC7 add a duplicate, so it is never used for on-sheet skills. Missing: Rollbox's table CoC ID (CoC7 finds it in its compendium), else the name. The sheet skill is found by skill-values' `sheetSkill` (by CoC ID; the own-language flag only when Language (Own) is asked for by its CoC ID; then by name), the table entry by `tableSkill`, and an open-ended skill's base by `groupBase`.
- **Labels:** with the Keeper's label (`keeperLabel`, Void's decision 2026-11-13), the check as CoC7 names it goes in front, joined by " · ", so the player still sees what to roll: "Hard Spot Hidden · notice the knife" (Hard and Extreme are named; Regular and Hidden add nothing), "INT · Idea" (Idea and Know are INT and EDU checks with the Keeper's label since 0.1.1), and for a combined check the names joined by " + ": "Spot Hidden + Listen · notice the knife". The names are this character's (a renamed own language reads "Language (English)"). Requests and Copy link alike. Without the Keeper's label: for a combined check "A and B" / "A or B"; for weapons and improvised weapons the labels above (they already name the check); otherwise none, so CoC7 shows its own description ("Hard Spot Hidden check (+1)"). CoC7's request sentence around the link is unchanged.
- **Connects to:** `links.js`; CoC7 string `CoC7.MessageTargetCheckRequested`; `game.i18n.has` / `format`.
- **Could interact poorly with:** CoC7 renaming its string key: the English fallback is used. **Assumed.**

### `keeper-rolls.js`: `rollForKeeper`, `oneRoll`, `combinedRoll`, `rawRoll`, `keeperNote`; `callActor` (`coc7.js`)
- **Label note:** CoC7's private card names only the check, so an NPC roll's label would be lost (an improvised "Candlestick" without damage would leave nothing naming it). When the request has the Keeper's own label, or is a weapon or improvised weapon, the Keeper's note starts with "<NPC>: <label>". Every such label already names the check, so the note doesn't repeat it: "Guard: Hard Spot Hidden · notice the knife", "Guard: Hard Fighting (Brawl) with Candlestick". Hard and Extreme are named (the Keeper's label has them already; a weapon's gets them in the note, planCheck's `note`); Regular and Hidden add nothing. Labels Rollbox makes up for checks ("A and B" on a combined check) don't get the line: the combined note already says them. A request with no label sends no extra note.
- **How it works:** Rolled at once on the Keeper's client, `fastForward` true (no dialog) and blind (CoC7 whispers the card to GMs, `CoC7Check#getChatData`). Characteristics, Luck and sheet skills use CoC7's actor checks; sheet skills by the item's uuid, which CoC7's `getItemOrAdd` resolves exactly. (CoC7's own Idea and Know rolls, `runRoll({characteristic: "idea"|"know"})`, were used until 0.1.1; Idea and Know are now INT and EDU checks.) A skill missing from the sheet is a raw `runRoll` (`rollType: "R/MA"`) at Rollbox's base value: the table's (skill-values' `tableBaseFor`: Dodge and Language (Own) from this NPC), else the request's `value`, else the group base (skill-values' `groupBase`); none skips the NPC with a notice. CoC7's raw-value card shows only "(20%)", so a note whispered to the Keepers (`ChatMessage.getWhisperRecipients("GM")`, speaker "Keeper's Rollbox") names the skill first. A combined check is one raw roll at the highest value for Any one (p. 203: "one dice roll using the higher of the investigator's two skills") or the lowest for All of them, which passes or fails exactly when CoC7's combined card would; the note names every check and the value used (Void's decision, 2026-11-13, because CoC7's combined card is always public and adds missing skills). **Decided first, then rolled once:** `oneRoll` or `combinedRoll` returns the CoC7 call to make (`{ method, args }`, `rawRoll` for an `R/MA` roll) and adds the note lines, or null when there is no value to roll at. `rollForKeeper(plan, actor)` then posts the Keeper's note, always just before CoC7's card, and makes the one call through `callActor` (missing or throwing: a warning). It returns null when rolled, or the reason it wasn't ("no value to roll at", "CoC7 couldn't roll it"), which `send()` records under "Not sent:"; the note has already gone in the second case.
- **Connects to:** `resolve.js` (the planned check); CoC7 `actor.characteristicCheck`, `attributeCheck`, `skillCheck`, `runRoll`.
- **Could interact poorly with:**
  - A combined raw roll and CoC7's fumble rule: a fumble depends on the value (96–100 under 50), so "Any one" judged at the highest value can miss a fumble the lower skill would have had on the combined card. Pass or fail is the same. **Assumed.**
  - CoC7's skill `bonusDice` default: with 0 dice requested, CoC7 uses the skill's own bonus dice (`normalizeRequest`). The raw roll has no skill, so it doesn't. **Assumed.**
  - The blind card follows Foundry v14's `applyRollMode`; CoC7's source says blind checks reach GMs only. **Assumed.**

### Sanity: `sendSanity` (`index.js`)
- **How it works:** A character with no Sanity value (`system.attribs.san.value` empty) is skipped. Player characters get the `@coc7.sanloss` link (in a request message, as above). NPCs: `clickCardButton` starts watching (and stops quietly if CoC7 then fails to make the card), then `CONFIG.CoC7Link.documentClass._onLinkActorClick(actor, {check: "sanloss", sanMin, sanMax, sanReason, difficulty: 1, poolModifier: 0})` makes CoC7's Sanity card on the Keeper's side, and Rollbox clicks its `rollSanCheck` button (Void's decision, 2026-11-13). The Keeper clicks the rest of the card (involuntary action, loss, Apply) as usual.
- **Connects to:** CoC7 `_onLinkActorClick` (internal, through `linkActorClick`) → `CoC7SanCheckCard.create`; `card-buttons.js`.
- **Could interact poorly with:** the card can't be private (Gap 4): players see an NPC's Sanity card. An NPC at SAN 0 gets CoC7's "permanently insane" card with no roll button, so the Keeper is told to click it. **Assumed.**

### Opposed: `sendOpposed`, `opposedRoll` (`index.js`)
- **How it works:** `link` mode is refused with a notice (clicking an opposed link with tokens selected makes one card per token). Each side's check is resolved like a check; a key that can't go in a roll string stops it with a notice. For any skill missing from a side's sheet, `coc7FindsSkill` runs first: CoC7 adds missing skills when it makes the card (`addActor` → `getItemOrAdd`, on the Keeper's client, for NPCs too: Void accepted this, 2026-11-13), and a skill CoC7 can't find would fail with "Unknown skill", so Rollbox stops and tells the Keeper instead. Then `clickCardButton` starts watching (stopped quietly if CoC7 throws, so the Keeper isn't told to click a card that never came) and `_onLinkActorClick(sideA, {check: "check", subtype: "opposed", combat: false, rolls})` makes one new card with both sides (`uuid#type#key[#±dice]#1`). Idea and Know become INT and EDU sides. Difficulty is always sent as Regular (`#1`): without it CoC7 uses its world default, which can be "unknown" (`parseRolls`). When the card renders, Rollbox clicks Start rolls (`rollNoPlayers`); if it can't, the Keeper is told to. When no card is made, `result.skipped` says why (for the Opposed roll view): `{ actor: <that side>, reason: "CoC7 can't find Pilot (Boat)" }` or `"… can't go on CoC7's opposed card"`, or `{ actor: null, reason: "CoC7's opposed card can't be reached" | "CoC7 couldn't make the opposed card" }`. `link` mode records nothing (no menu offers it).
- **Start rolls** rolls every side whose owners aren't online: the NPC, and also a character whose player is offline. Only after it can players roll their own side.
- **Connects to:** CoC7 `_onLinkActorClick` → `CoC7ChatOpposedMessage.createGroupMessage`; `card-buttons.js`.
- **Could interact poorly with:** CoC7 makes the first side attacker and the second defender, and a card can't be made without those roles: CoC7 8.15 compares the two rolls only when one side is each (BUILD-GUIDE "Cards: opposed"). Outside combat the roles don't change who wins. On a tie CoC7 shows "Tie"; the Keeper settles it from the values on the card (Gap 7). **Assumed.**

### Copy link: `copyLink` (`index.js`)
- **How it works:** Builds the same link (for the first selected character, or the generic link with Rollbox's CoC IDs when none), adds the damage roll for an improvised weapon, copies it with `game.clipboard.copyPlainText` and shows "request link copied". Nothing is sent or rolled, NPCs included. Missing clipboard helper: a warning, nothing copied.
- **Connects to:** Foundry `ClipboardHelper#copyPlainText` (build 368).
- **Could interact poorly with:** browsers that refuse clipboard access; Foundry falls back to `execCommand("copy")`. **Assumed.**

### `coc7.js`: `coc7FindsSkill(key)` and `skillsCoC7CantFind(checks)`
- **How it works:** Read-only prediction of whether CoC7's `getItemOrAdd` will find a skill that isn't on the sheet. A CoC ID (`i.skill.…`): `game.CoC7.cocid.fromCoCIDBest({cocid})` must return exactly one item (CoC7 requires one). A name: the world's items, then every Item compendium's index (`pack.getIndex()`), matching CoC7's way (the exact name, or the part in brackets compared without accents or case, `guessNameParts`), skipping skills tagged only for other eras (`flags.CoC7.cocidFlag.eras` against CoC7's `worldEra`). Returns null when CoC7's CoC ID lookup is missing or anything throws (the request then goes, and CoC7 decides).
- **Connects to:** `game.CoC7.cocid` (CoC7 public object, internal lookup), `game.items`, `game.packs`, CoC7 world setting `worldEra`.
- **Could interact poorly with:** CoC7 changing how it searches: the prediction could say "found" when CoC7 then finds nothing (the player's click does nothing, as before) or the reverse (the Keeper is told to add the skill). CoC7's era tags are incomplete: a world in an era whose list lacks a skill (Dark Ages lacks Listen) makes CoC7 miss it, and Rollbox says so. **Assumed.**

### `coc7.js`: `ownersOf(actor)` (public)
- **How it works:** CoC7's `actor.owners` (non-GM users with OWNER), with any GM filtered out again; `null` when the getter is missing, isn't a list or throws. `send()` skips a character with `null` and rolls a character with none for the Keeper. Public so the mini sheet shows the same owners, or "NPC · Keeper rolls", as the requests use, and the menus word their main button ("Roll for NPC" when every character has none).
- **Connects to:** CoC7's `actor.owners`; `mini-sheet/cards.js` (`ownerText`); `shared/menu.js` (`requestLabel`, `showResult`); the Opposed view.
- **Could interact poorly with:** nothing beyond `send()`'s notes above. **Assumed.**

### `links.js`: `checkLink`, `combinedLink`, `sanityLink`, `rollString`, `damageRoll`, `cleanLabel`, `cleanOption`, `isSafeOption`, `isSafeRollKey`, `difficultyLevel`, `DIFFICULTIES`, `MAX_DICE` (the last two re-exported by `index.js`)
- **How it works:** Pure text.
  - Difficulty is always a number in links and actor calls: Regular 1, Hard 2, Extreme 3, Hidden −1 (`CoC7DicePool.difficultyLevel`). Not `+` / `++`: the Sanity card reads its difficulty with `parseInt` and throws on them (`CoC7DicePool#difficulty` setter). In combined and opposed roll strings difficulty is one digit and **0 means hidden** (`parseRolls`).
  - Every check link carries `difficulty` and `blind` or `blind:false` (CoC7 reads the string `"false"` as false, `actor.skillCheck`), never left to the roller's chat mode (BUILD-GUIDE "v14 chat modes"). `poolModifier` only when there are bonus or penalty dice: CoC7 picks the link's text by whether the option is there, so `poolModifier:0` read "[hard] Spot Hidden check(0)"; a missing one rolls as 0 (`CoC7RollNormalize`, `options.poolModifier ?? 0`).
  - Combined links carry `blind:false`; Sanity links `difficulty:1,poolModifier:0,blind:false` (CoC7 ignores `blind` there). `sanityLink` takes the Sanity request itself (`success`, `failure`, `creature`, `label`), for the players' message and Copy link alike. The Sanity link keeps `poolModifier:0`: `CoC7SanCheckCard.create` sets the difficulty only when `poolModifier` is defined.
  - Labels (`cleanLabel`): `[ ] { } < >` removed, spaces collapsed, HTML-escaped. Foundry decodes the message's entities before CoC7's enricher reads the label and puts it into the page as HTML (`<span>${name}</span>`), so angle brackets must be gone, not just escaped; brackets would start other enrichers.
  - Option values must pass `isSafeOption` (no `, : [ ] { }`); roll keys `isSafeRollKey` (also no `#` `&`). Names that don't are refused, not altered, so CoC7 never gets a different skill's name.
  - `damageRoll(formula, flavor)`: `[[/r formula # flavor]]`, flavor cleaned and escaped.
- **Connects to:** CoC7's enricher (`CoC7Link._createLink`) and click handler (`_onLinkActorClick`); `escapeHtml` from `utils.js`.
- **Could interact poorly with:** CoC7 changing its link syntax: links show as plain text. **Assumed.**

### `card-buttons.js`: `clickCardButton({ as, actorUuids, action, fallback })`
- **How it works:** Called just before Rollbox asks CoC7 for a card. Installs a `renderChatMessageHTML` hook that waits for the next message whose `flags.CoC7.load.as` is `as`, whose actor uuids (`flags.CoC7.load.actorUuids`, or `actorUuid`; CoC7 stores some with `/`) include every expected uuid, and which this user authored. Then it removes the hook and, after `CLICK_DELAY_MS` (250 ms), clicks the card's `[data-action=action]` button, retrying up to `CLICK_TRIES` (8) times. The delay is needed because CoC7 attaches the card's listeners in its own async render handler, after awaiting the actors (`hooks/render-chat-message-html.js`). If the button never appears, or no card renders within `WATCH_TIMEOUT_MS` (15 s), the Keeper gets `fallback` as a notification ("click Start rolls on the opposed card"). Without `Hooks.on` / `Hooks.off` the Keeper is told at once. Returns a function that stops the watch without a notice: `sendOpposed` and `sendSanity` call it when CoC7 throws instead of making the card, so the Keeper isn't told 15 seconds later to click a card that never came.
- **Connects to:** Foundry hook `renderChatMessageHTML(message, html)` (v14, `client/documents/chat-message.mjs`); CoC7 card flags and buttons `rollNoPlayers` (opposed card, Keeper-only) and `rollSanCheck` (Sanity card).
- **Could interact poorly with:** a slow client where CoC7 binds its listeners after 250 ms: the click lands before them and does nothing; the button stays on the card for the Keeper to click (no notice in that case). Two Rollbox requests for the same actors before the first card renders: both watches take the first card, and the second card's button is left for the Keeper (no notice). Modules that re-render chat messages: the watch ends on the first render. **Assumed.**

### `coc7.js`: `linkActorClick()`, `coc7LinksReady()`
- **How it works:** CoC7's internal link handler, `CONFIG.CoC7Link.documentClass._onLinkActorClick`, bound to its class, or null when it has gone. It makes a card for one given actor: the NPC Sanity card (`sendSanity`) and the opposed card (`sendOpposed`); a null skips them with a warning.
- `coc7LinksReady()` is true when the system is CoC7 and `CONFIG.CoC7Link.documentClass` is registered; `send()` sends nothing without it.
- **Connects to:** CoC7 `CoC7Link._onLinkActorClick` (internal, in the build guide's Internal API registry).
- **Could interact poorly with:** CoC7 renaming or removing it: no NPC Sanity card and no opposed card, with a warning. **Assumed.**

## Hooks, overrides, keybindings
- Hooks: `renderChatMessageHTML`, from `card-buttons.js` only: installed only while waiting for a card Rollbox asked for (opposed, NPC Sanity) and removed after one card or 15 seconds. Only ever on the Keeper's client, because `send()` checks `isKeeper()` first. Nothing is installed at `ready`.
- Class overrides: none.
- Keybindings: none.

## Settings
None. Reads CoC7's world setting `worldEra` (read only, to predict CoC7's skill lookup).

## Tests

`tests/roll-requests.test.mjs`: find the test you need in [TESTS.md, roll-requests.test.mjs](TESTS.md#roll-requeststestmjs) and run only that.
