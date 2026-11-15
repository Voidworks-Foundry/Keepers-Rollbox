# Keeper's Rollbox

**Easily send the right roll to the right investigator, from a small new Rollbox panel.**

Keeper's Rollbox is for Keepers who like to take an active hand in their players' rolls. Select a token, pick the check, and the request lands in that player's chat, ready to click. New players never have to hunt through their sheet or the menus for the right skill, and you keep the game moving.

Rollbox is a front end for Call of Cthulhu's own roll requests. It builds the same links and cards as the system's "Create link" tool, and the CoC7 system does all the rolling, comparing, Luck spending, pushing and Sanity loss exactly as it always does. Rollbox never changes a roll, a card or a rule.

*[Animation: a tour of every major feature in one loop — coming soon]*

## Features

- **[The panel and settings](guide/panel.md):** select tokens and a mini sheet or a list of names appears above the players list, with a button for each kind of roll. Click a characteristic, SAN or Luck on the mini sheet to open its menu, with the system sheet's own click shortcuts. Only the Keeper sees it. Settings for Simplified dice UI, a Dark or Light theme, panel colour, transparency and size.
- **[Check](guide/check.md):** any characteristic or skill, with difficulty, bonus or penalty dice, Blind and a label. Idea and Know are INT and EDU checks with a label.
- **[Combined checks](guide/combined.md):** one roll against two or more checks, all of them or any one.
- **[Group checks](guide/group.md):** the same check for everyone selected, and the Group Luck roll (in Other).
- **[Sanity](guide/sanity.md):** one-click losses or any loss you type, with a cause the player sees instead of the numbers.
- **[Other](guide/other.md):** Item, a character's weapons as skill checks or an improvised weapon with damage; and Luck, a Luck check for one or more characters.
- **[Opposed rolls](guide/opposed.md):** two characters, their own checks, CoC7's opposed card made for you.
- **[Assist](guide/assist.md):** several characters combine STR or SIZ against something too heavy for one, with the best split worked out.

## Documentation

The full guide, one page per feature: **[guide](guide/README.md)**.

## Install

In Foundry's setup screen, open **Add-on Modules → Install Module**, search for **Keeper's Rollbox** and click **Install**.

Alternatively, paste this manifest link into the **Manifest URL** box at the bottom of the same window and click **Install**:

```
https://github.com/Voidworks-Foundry/keepers-rollbox/releases/download/v0.1.1/module.json
```

Or download the zip from the **[releases page](https://github.com/Voidworks-Foundry/keepers-rollbox/releases)** and unzip it into your Foundry `Data/modules` folder.

Then enable **Keeper's Rollbox** in your world under **Game Settings → Manage Modules**. Players don't need to do anything.

To report a problem, open an [issue](https://github.com/Voidworks-Foundry/keepers-rollbox/issues): say what you did, what you expected and what happened, with a screenshot and any red console (F12) lines mentioning `keepers-rollbox`.

## Compatibility

- Foundry VTT version 14.
- Call of Cthulhu 7th Edition (CoC7) system, version 8.15 or later.
- Rollbox sends CoC7's own roll requests and cards and never changes a roll, a card or a rule, so it works alongside modules that style or extend CoC7's cards.

## Built with AI

Keeper's Rollbox is an AI-developed, human-directed project.

The repository includes an agent scaffold, so you can contribute to Rollbox or customise it for your own needs with whichever AI tool you like. **[AGENTS.md](AGENTS.md)** holds the base instructions for any agent or model you choose; if your tool expects a different file name, rename it. The developer notes cover how the code is built and what's known about CoC7 and Foundry ([docs/DEVELOPING.md](docs/DEVELOPING.md)), and what every menu does and the rules it follows ([docs/DESIGN.md](docs/DESIGN.md)). Step-by-step [recipes](docs/recipes/) walk through adding a menu, adding a setting, supporting a new CoC7 version and making a release. Every change is checked by the tests and the release check before it ships. To contribute, see **[CONTRIBUTING.md](CONTRIBUTING.md)**.

## Licence

MIT, © 2026 Voidworks Studios. See [LICENSE](LICENSE).
