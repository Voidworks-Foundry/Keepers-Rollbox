# Keeper's Rollbox

**Easily send the right roll to the right investigator, from a small new Rollbox panel.**

Keeper's Rollbox is for Keepers who like to take an active hand in their players' rolls. Select a token, pick the check, and the request lands in that player's chat, ready to click. New players never have to hunt through their sheet or the menus for the right skill, and you keep the game moving.

Rollbox is a front end for Call of Cthulhu's own roll requests. It builds the same links and cards as the system's "Create link" tool, and the CoC7 system does all the rolling, comparing, Luck spending, pushing and Sanity loss exactly as it always does. Rollbox never changes a roll, a card or a rule.

*[Animation: a tour of every major feature in one loop — coming soon]*

## Features

- **[The panel and settings](guide/panel.md):** select tokens and a mini sheet or a list of names appears above the players list, with a button for each kind of roll. Only the Keeper sees it. Settings for Simplified dice UI, a Dark or Light theme, panel colour, transparency and size.
- **[Check](guide/check.md):** any characteristic, attribute or skill, with difficulty, bonus or penalty dice, Blind and a label. Includes Idea and Know.
- **[Combined checks](guide/combined.md):** one roll against two or more checks, all of them or any one.
- **[Group checks](guide/group.md):** the same check for everyone selected, and the group Luck roll.
- **[Sanity](guide/sanity.md):** one-click losses or any loss you type, with a cause the player sees instead of the numbers.
- **[Item](guide/item.md):** a character's weapons as skill checks, or an improvised weapon with damage.
- **[Opposed rolls](guide/opposed.md):** two characters, their own checks, CoC7's opposed card made for you.
- **[Assist](guide/assist.md):** several characters combine STR or SIZ against something too heavy for one, with the best split worked out.

## Documentation

The full guide, one page per feature: **[guide](guide/README.md)**.

## Install

In Foundry's setup screen, open **Add-on Modules → Install Module**, search for **Keeper's Rollbox** and click **Install**.

Alternatively, paste this manifest link into the **Manifest URL** box at the bottom of the same window and click **Install**:

```
https://github.com/Voidworks-Foundry/keepers-rollbox/releases/download/v0.1.0/module.json
```

Or download the zip from the **[releases page](https://github.com/Voidworks-Foundry/keepers-rollbox/releases)** and unzip it into your Foundry `Data/modules` folder.

Then enable **Keeper's Rollbox** in your world under **Game Settings → Manage Modules**. Players don't need to do anything.

To report a problem, open an [issue](https://github.com/Voidworks-Foundry/keepers-rollbox/issues): say what you did, what you expected and what happened, with a screenshot and any red console (F12) lines mentioning `keepers-rollbox`.

## Compatibility

- Foundry VTT version 14.
- Call of Cthulhu 7th Edition (CoC7) system, version 8.15 or later.
- Rollbox sends CoC7's own roll requests and cards and never changes a roll, a card or a rule, so it works alongside modules that style or extend CoC7's cards.

## Licence

MIT, © 2026 Voidworks Studios. See [LICENSE](LICENSE).
