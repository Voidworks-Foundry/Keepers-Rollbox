# Skill values (`scripts/skill-values/`)

The lists the Keeper's menus show for a character: the eight characteristics, the attributes (Luck, Sanity, Idea, Know), every skill with its Regular, Hard and Extreme values, the rows of the menus' three tabs, and the lowest Luck for a group Luck roll. Skills missing from a sheet are filled in at their base value from one table. It is also the only owner of skill-name matching: every other part that matches a skill name, finds a skill on a sheet or needs a base value calls it, and no other part imports `base-skills.js`. No skill is ever hidden, whatever CoC7's era, because games move between eras (Void's decision, 2026-11-13). Data and lookups only: no hooks, no UI, nothing written to any actor, so it runs the same for every user, but only the Keeper's menus call it. Files: `index.js`, `base-skills.js` (the table).

**Status key:** *Confirmed* only when the build guide's Internal API registry or changelog says so. Nothing in this part is confirmed yet, so everything is **assumed** unless stated otherwise.

## Code

### `withLevels(value)`
- **How it works:** A value with its Hard (half) and Extreme (fifth) values, rounded down as CoC7 works them out (`apps/dice-pool.js`): 55 → `{ value: 55, half: 27, fifth: 11 }`; a missing or non-numeric value gives all three `null`. The one place Rollbox works out Hard and Extreme.
- **Connects to:** `characteristics`, `attributes`, `skills` (every row's `half` and `fifth`); the Check menu's "+ Add" row; `assist/split.js` (each roller's chance at the difficulty).
- **Could interact poorly with:** nothing (arithmetic). **Confirmed** by tests only.

### `characteristics(actor)`
- **How it works:** Returns the eight characteristics in sheet order (STR, CON, SIZ, DEX, APP, INT, POW, EDU), each `{ key, label, value, half, fifth }`. `key` is CoC7's (`str`…`edu`), `label` the upper-case abbreviation. A missing or non-numeric value gives `null` for all three numbers. No actor gives `[]`.
- **Connects to:** `actor.system.characteristics.<key>.value`. Called by the mini sheet, `checkChoices`, roll-requests and Assist.
- **Could interact poorly with:** a CoC7 update that moves the characteristics: the values show as empty, no error. **Assumed** (data paths from the CoC7 8.15 source).

### `attributes(actor)`
- **How it works:** Returns Luck (`lck`), Sanity (`san`, with `max`), Idea (`idea`, `characteristic: "int"`) and Know (`know`, `characteristic: "edu"`), each with `value`, `half`, `fifth`. Idea and Know read CoC7's `system.config.idea.value` / `system.config.know.value` and fall back to INT and EDU (Keeper Rulebook p. 90: an Idea roll is an INT roll, a Know roll an EDU roll). Missing values are `null`. No actor gives `[]`.
- **Connects to:** `actor.system.attribs.lck.value`, `attribs.san.value` / `.max`, `system.config.idea` / `.know` (CoC7 works these out in `prepareBaseData`; they equal INT and EDU in 8.15). The `characteristic` field tells the Check menu which characteristic to send for a player character (DESIGN.md, "Idea (INT) and Know (EDU)").
- **Could interact poorly with:** Pulp rules or modules that change Idea or Know through `system.config`: Rollbox shows CoC7's value, which is what CoC7's own Idea roll uses. **Assumed.**

### `lowestLuck(actors)`
- **How it works:** From any list of actors, returns those with the lowest Luck; several when tied (the Keeper picks, DESIGN.md "Group Luck roll"). Actors with no Luck value (null, empty, not a number) are left out; Luck 0 counts. Empty or missing input gives `[]`. Keeper Rulebook pp. 89-90.
- **Connects to:** `actor.system.attribs.lck.value`. Used by the Check menu's group Luck option.
- **Could interact poorly with:** vehicles or containers among the selected tokens: they have no Luck and are skipped. **Assumed.**

### `skills(actor)`
- **How it works:**
  1. Reads every item with `type === "skill"` and a name from `actor.items` (a read that throws counts as no items).
  2. Matches each to the table: by CoC ID (`flags.CoC7.cocidFlag.id`) first, which is the same in every language; then a skill with CoC7's `system.properties.own` flag counts as Language (Own) (sheets rename it, e.g. "Language (English)"); then by name, ignoring case, accents and extra spaces (`comparable`), as CoC7's `getSkillByName` does.
  3. Each sheet skill keeps its sheet name and value (`system.value`, which includes Active Effects). Its **base** is Rollbox's: the table's value if matched; otherwise the rulebook's base for its group (`groupBase`: "Language (Latin)" → 1, "Survival (Arctic)" → 10); otherwise the sheet's `system.adjustments.base`; otherwise 0.
  4. **Trained** = on the sheet and above that base. Not `adjustments.base` alone: CoC7's actor importer stores an NPC's whole skill value as its base (`apps/actor-importer.js`), so a hand-made NPC would read as untrained everywhere.
  5. Every table skill the sheet doesn't have is added at its base value, `onSheet: false`. Dodge = half DEX and Language (Own) = EDU, rounded down as CoC7 does; with no DEX or EDU they are 0.
  6. Two sheet skills with the same name show once, at the higher value.
  7. Order: trained skills highest first (equal values A–Z), then every untrained skill A–Z. The menu's divider goes before the first entry whose `trained` is false.
- **Each entry:** `{ name, value, half, fifth, base, trained, onSheet, cocid }`. Half and fifth are rounded down, as CoC7 works out Hard and Extreme (`apps/dice-pool.js`). `cocid` is the sheet's, else the table's, else `null`. No actor gives `[]`.
- **Connects to:** `base-skills.js`; `actor.items`. Does not read CoC7's era. Used by `checkChoices` (the Check menu and the Opposed view), the Item menu (a weapon's skill value) and roll-requests (a missing skill's base). A request for an `onSheet: false` skill: an NPC is rolled at `value`; for a player character CoC7 adds the skill (`docs/roll-requests.md`).
- **Could interact poorly with:**
  - Sheets in another language: matched by CoC ID, so the sheet's own names show. Skills without a CoC ID only match English names. **Assumed.**
  - Hand-made or imported NPCs whose homebrew skills (not in the table, no known group) store their whole value as base: they read as untrained and sort A–Z, at their correct value. **Assumed**, check at the table.
  - Historical eras: every rulebook skill is offered as a missing skill, including ones that don't fit the era (Firearms (Machine Gun) in Dark Ages). They do no harm; the Keeper doesn't pick them.
  - Skills CoC7 has but the rulebook list doesn't (other eras: Gambling, Rope Use, Drive Carriage …): shown only when on a sheet, at the sheet's value and base. **Assumed.**
  - CoC7 skills with `system.value` changed by an Active Effect: Rollbox shows the effective value, which is what CoC7 rolls. **Assumed.**

### `groupSkills(actors = [])`
- **How it works:** Every table skill A–Z as `{ name, cocid }`, no values, for when two or more characters are selected. When the selected actors are passed, skills on their sheets that the table doesn't have ("Language (Latin)") are added once. Called without actors it is the table alone.
- **Connects to:** the same matching as `skills()`. Used by the Check menu with several characters.
- **Could interact poorly with:** nothing outside the module. **Assumed.**

### `checkChoices(actor, { sanity })`
- **How it works:** What one character can roll, as the rows of the three tabs the Check menu and each Opposed side show, so both list the same checks in the same order with the same values: `{ characteristic, attribute, skill }`, each a list of `{ key, name, check, value, half, fifth, trained, onSheet }`. Characteristic: STR … EDU in sheet order. Attribute: Luck, Sanity, Idea (INT), Know (EDU) (p. 90); `sanity: false` leaves Sanity out (the Opposed view: Sanity is never opposed). Skill: `skills(actor)` in its order (trained first, then the rest A–Z at base value). `key` is unique within a menu (`characteristic:str`, `attribute:lck`, `skill:spot hidden`, `skillKey`); `check` is what roll-requests' `checkRequest` and `opposedRequest` take (`{ kind, name }`, plus `cocid` for a skill). Characteristic and attribute rows are `trained` and `onSheet`, so a menu draws its "Untrained · base value" divider only in the Skill tab. With no actor (`null`), the characteristic and attribute rows have no values and there are no skills: the Check menu with several characters uses those and `groupSkills`. Each menu draws its own row element (tick boxes or buttons) from the rows.
- **Connects to:** `characteristics`, `attributes`, `skills`. Used by `check-menu/` and `opposed-roll/`; `shared/menu.js` `CHECK_TABS` names the tabs.
- **Could interact poorly with:** nothing outside the module (data only). **Confirmed** by tests only (the Check menu's and Opposed view's list tests).

### Skill-name matching: `comparable`, `isCocid`, `tableSkill`, `groupBase`, `sheetSkill`, `findSkillRow`, `sameSkill`, `skillKey`, `tableBaseFor`
The only place Rollbox matches skill names; roll-requests, the Check menu, the Item menu and `shared/menu.js` import these, so a skill the menus list as "on the sheet" is always requested as on the sheet, and a menu shows the values of the skill a request will send.
- **`comparable(name)`:** accents removed (NFD, combining marks dropped), lower case, spaces collapsed and trimmed: how CoC7 compares skill names, plus single spaces. Also the menus' search and Rollbox's row keys.
- **`isCocid(text)`:** true for a CoC ID (`i.skill.…`), which CoC7 accepts wherever it takes a skill's name (a weapon's stored skill can be one).
- **`tableSkill(name, cocid)`:** Rollbox's table entry, by CoC ID first, then by name; null when neither matches.
- **`groupBase(name)`:** the rulebook base for an open-ended skill's specialisation from its group (p. 56): "Pilot (Boat)" → 1, "Survival (Arctic)" → 10; null without a specialisation in brackets or for a group the rulebook doesn't list. `skills()` uses it for sheet skills the table doesn't have; roll-requests for an NPC's missing specialisation; the Check menu's "+ Add" for its value.
- **`sheetSkill(actor, name, cocid)`:** the skill item on the sheet for a requested skill: by CoC ID; then, **only when Language (Own) is asked for by its CoC ID** (`i.skill.language-own`), the item with CoC7's own-language flag (`system.properties.own`); then by name. This is the exact own-language rule roll-requests always used: CoC7 finds a renamed own language ("Language (English)") only by its CoC ID, so a request for "Language (Own)" by name doesn't take the flagged item. (The other direction, `tableEntryFor` inside `skills()`, uses the flag for any sheet skill, so the menus list a renamed own language as Language (Own)'s row.)
- **`findSkillRow(rows, { name, cocid })`:** the row for a skill among `skills()` or `groupSkills()` rows (anything with `name` and `cocid`): by CoC ID first (a `name` that is a CoC ID counts as one), then by name, the order `sheetSkill` uses. The Item menu finds a weapon's or the improvised weapon's skill with it, the Check menu's "+ Add" a typed name among the listed skills.
- **`sameSkill(a, b)`:** true when two skill references (`{ name, cocid }`) mean one skill: the same CoC ID, the same table entry (`tableSkill` links a name to its CoC ID) or the same name; a name that is a CoC ID counts as that CoC ID. roll-requests' `weaponSkills` uses it to tell a weapon's two skills apart ("Throw" and `i.skill.throw` are one), the Item menu to tell a thrown improvised weapon.
- **`skillKey(name)`:** the menus' key for a skill row, `skill:` and the `comparable` name; `checkChoices` and the Check menu's typed skills use it, so a typed skill and a listed one share a key.
- **`tableBaseFor(actor, cocid)`:** Rollbox's base value for a table skill for this actor (Dodge half its DEX, Language (Own) its EDU), the value `skills()` gives it when missing, without building every row; null for a CoC ID the table doesn't have. roll-requests rolls an NPC's missing skill at it.
- **Connects to:** `base-skills.js` (`BASE_SKILLS`, `GROUP_BASES`); CoC7 data `flags.CoC7.cocidFlag.id`, `system.properties.own`.
- **Could interact poorly with:** CoC7 changing how it compares names (the part in brackets, `guessNameParts`): Rollbox compares whole names, so a sheet skill named only by its specialisation isn't matched by the full name. **Assumed.**

### `CHARACTERISTICS` (exported constant)
The eight CoC7 characteristic keys in sheet order.

### `base-skills.js`: `BASE_SKILLS`, `GROUP_BASES`, `HALF_DEX`, `EDU` (read by `index.js` only)
- **`BASE_SKILLS`:** 78 skills, A–Z, each `{ name, base, cocid }` plus `uncommon: true` (rulebook T) or `modern: true` (Ω). The two tags are information only; nothing filters on them. `base` is a number, or `HALF_DEX` / `EDU` (`{ characteristic, divisor }`). Source: Keeper Rulebook Chapter 4, the skill list on p. 56, with the specialisations on pp. 59 (Art and Craft), 64 (Fighting, Firearms) and 73-75 (Science). Every skill on that list with a fixed name is in it, including the uncommon ones.
- **`GROUP_BASES`:** skills the rulebook splits into specialisations the player names freely (p. 56, G): Art/Craft 5, Language (Other) 1, Lore 1, Pilot 1, Science 1, Survival 10. Their base applies to any specialisation found on a sheet. They are **not** offered as missing skills, because a request needs a named specialisation. Fighting and Firearms have no group base (the rulebook says "varies").
- **Names** are CoC7's (`Art/Craft (Acting)`, `Firearms (Handgun)`), because requests go to CoC7 by name.

### Checked against CoC7's Skills compendium (`packs/en-skills`, CoC7 8.15, 2026-11-13)
Read from `reference/CoC7/packs/en-skills` (103 skill items) and compared by CoC ID with a script:
- **All 78 table skills exist in CoC7 with the same name, CoC ID and base value.** Including Science (Mathematics) 10, Firearms (Artillery) 1, Computer Use 5 and Electronics 1.
- **Dodge and Language (Own):** CoC7's formulas are `1/2*@DEX` and `@EDU`; Rollbox's `HALF_DEX` and `EDU` give the same numbers (CoC7 rounds formula bases down, `CoC7Utilities.setMultipleSkillBases`).
- **Naming differences from the rulebook**, where Rollbox follows CoC7: the rulebook's "Art and Craft" is CoC7's "Art/Craft"; "Artillery" (its own uncommon skill on pp. 56 and 59) is CoC7's "Firearms (Artillery)"; "Language (Other)" is CoC7's "Language (Any)".
- **In CoC7 only, not offered as missing skills** (25): the "(Any)" placeholders (Art/Craft, Fighting, Firearms, Language, Lore, Pilot, Science, Survival); ten named languages (Czech, Dutch, English, German, Polish, Russian, Swahili, Yoruba, Zulu at 1; covered by the Language group base when on a sheet); skills from other eras or settings: Civics 10, Empire 25 (Invictus), Drive Carriage 20, Drive Horse / Oxen 20, Drive Wagon / Coach 20, Gambling 10, Rope Use 5, Trap 10. None of these is on the Keeper Rulebook list.
- No value differs.

## Hooks, overrides, keybindings
- Hooks: none.
- Class overrides: none.
- Keybindings: none.

## Settings
None.
