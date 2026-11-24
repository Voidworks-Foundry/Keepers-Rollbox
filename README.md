# Keeper's Rollbox

**One small panel for the table's rolls: the Keeper's control desk, and each player's shortcut to their own investigator.**

![Keeper's Rollbox: a skill check sent to a player, an opposed roll, a weapon drawn and combat starting, an attack, the turn order and End turn, a spell and an investigator fleeing](media/readme-loop.webp)

Keeper's Rollbox is a panel for Call of Cthulhu in Foundry VTT, for the Keeper **and** the players. The Keeper selects tokens (or none, for every investigator), picks a check, an attack or a spell, and the request is whispered to the right player, ready to click; NPCs are rolled at once. Each player gets a panel of their own investigator (on by default) to make their own checks and take their one action a round. The CoC7 system does all the rolling, comparing, Luck spending, pushing and Sanity loss, through its own links and cards: Rollbox never changes a roll, a card or a rule.

## Features

The same order as the [guide](guide/README.md).

- **[Getting started](guide/getting-started.md):** select tokens and the panel shows their character sheet, or a card each, with Action, Check and Other beside it. With nothing selected the Keeper sees the players' investigators with HP, MP, SAN and Luck bars (you choose which). One send button names who gets the roll. With several selected, a click on a card keeps only that character; a right click on any character in Rollbox makes them your target.
- **[For Keepers](guide/for-keepers.md):** send a roll to all players, to one or to each; NPCs rolled for you; a weapon-drawn pop-up only you see, with Spot Hidden to notice it; About to attack, to decide whether the target of a first attack is surprised; the first blow, then combat from the top of the order; combat run from the panel: a turn order that matches Foundry's tracker and stays put, End turn, Delay with arrows (and Place on standby or Leave out under it), Flee, Remove from standby, one joining card for everyone who comes into range (the fight's cards can be moved and resized), readied firearms; and a setup check at login that asks how a custom gun loads, fixes an unarmed weapon's skill, and lists every gun's reload kind to correct.
- **[For players](guide/for-players.md):** on by default: each player's own investigator, **Make check** straight into chat, one action a round on their turn, helping another character in Assist, with only the features you allow.
- **[Action](guide/action.md):** attack, aim, reload (two rounds, a new magazine or a belt, by how the gun loads), maneuver (the button names the goal; the target answers Dodge, Fight back or Counter, and CoC7's opposed card is filled in and rolled) or cast a spell (in combat only the spells fast enough for a fight, each spell's full text on hover), through CoC7's own attack card (rolled at once), opposed card and Cast, with the target's statuses and the situation (point blank, firing into melee, outnumbered) set on CoC7's card. With two selected, one acts on the other.
- **[Check](guide/check.md):** any characteristic or skill, for one character, several or every investigator, combined checks, and Sanity with one-click losses.
- **[Other](guide/other.md):** item and improvised weapon checks, Luck and the Group Luck roll, and Assist for combined strength (any characteristic, or one character against a fixed value).
- **[Opposed rolls](guide/opposed.md):** from a button or a right click, each side picked with the target picker, several against one with a card each; CoC7's opposed card made for you.
- **[Statuses and alerts](guide/statuses-and-alerts.md):** status cards above the sheet, and "You are being attacked" and "You are being shot at" alerts for players (and for you, when an NPC or creature is attacked in melee or someone attempts a maneuver on one).
- **[Appearance and themes](guide/appearance.md):** three themes (Foundry, Art Deco, CoC7 minimal), colour and transparency (Foundry theme), size up to 250%, menu side and layer.
- **[Shortcuts](guide/shortcuts.md)** and the **[settings reference](guide/settings.md)**.

## Install

> [!CAUTION]
> **A player's panel needs an investigator the player both owns and has assigned.** In Foundry these are two different things, and Foundry lets you assign a character with only Observer, so assigning alone isn't enough:
>
> 1. **Own:** open the investigator's **Ownership** configuration and set the player to **Owner**.
> 2. **Assign:** right-click the player's name in the Players list (bottom left), choose **User Configuration**, and pick the investigator as **Character**.
>
> A player without one sees a message in the panel's place telling them what to do.

In Foundry's setup screen, open **Add-on Modules → Install Module**, search for **Keeper's Rollbox** and click **Install**.

Or paste this manifest link into the **Manifest URL** box at the bottom of the same window and click **Install**:

```
https://raw.githubusercontent.com/Voidworks-Foundry/keepers-rollbox/main/module.json
```

Or download the zip from the **[releases page](https://github.com/Voidworks-Foundry/keepers-rollbox/releases)** and unzip it into your Foundry `Data/modules` folder.

Then enable **Keeper's Rollbox** in your world under **Game Settings → Manage Modules**. Players don't install anything; each gets their panel once their investigator is owned and assigned (above).

To report a problem, open an [issue](https://github.com/Voidworks-Foundry/keepers-rollbox/issues): say what you did, what you expected and what happened, with a screenshot and any red console (F12) lines mentioning `keepers-rollbox`.

## Compatibility

- Foundry VTT version 14 (checked on build 370).
- Call of Cthulhu 7th Edition (CoC7) system, version 8.15 or later (checked on 8.15).
- Rollbox sends CoC7's own roll requests and cards and never changes them, so it works alongside modules that style or extend CoC7's cards.

## Built with AI

Keeper's Rollbox is an AI-developed, human-directed project.

The repository includes an agent scaffold, so you can contribute to Rollbox or change it for your own table with whichever AI tool you like. **[AGENTS.md](AGENTS.md)** holds the base instructions for any agent; if your tool expects a different file name, rename it. The developer notes say how the code is built and what is known about CoC7 and Foundry ([docs/DEVELOPING.md](docs/DEVELOPING.md)), and what the module does and the rules it follows ([docs/DESIGN.md](docs/DESIGN.md)). Step-by-step [recipes](docs/recipes/) cover adding a flyout, adding a setting, supporting a new CoC7 version and making a release. Every change is checked by the tests and the release check before it ships. To contribute, see **[CONTRIBUTING.md](CONTRIBUTING.md)**.

## Credits

- **Call of Cthulhu** is a trademark of Chaosium Inc. Rollbox is an unofficial fan-made tool, not affiliated with or endorsed by Chaosium. It runs on the community [Call of Cthulhu 7th Edition (CoC7) system](https://github.com/Miskatonic-Investigative-Society/CoC7-FoundryVTT) for Foundry VTT, which does every roll, comparison and result: Rollbox only asks it for them.
- **The Art Deco theme** draws CoC7's own sheet images (the page texture, red lines, ribbons and tentacle ornaments) from the CoC7 system installed in your Foundry, at runtime. They aren't copied into Rollbox or covered by its licence; they appear in the Art Deco captures.
- **The map** in the animations and screenshots is the "Gas and coffee" night map by [Lovemaps](https://lovemaps-rpg.com), a third-party battle map that isn't part of Rollbox and isn't covered by its licence. Its terms allow open-source use and product demonstrations; it can't be sold or used to sell a product.

## Licence

MIT, © 2026 Voidworks Studios. See [LICENSE](LICENSE).
