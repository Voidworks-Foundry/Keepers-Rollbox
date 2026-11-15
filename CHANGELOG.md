# Changelog

## 0.1.1

First round of table feedback.

- **Move the panel** (setting "Allow moving the panel", on by default): drag it by its card header (the name row, "N selected", or either character's sheet in the Opposed view) anywhere on the screen, and it stays where you drop it, also after a reload or a smaller window. "Reset position" beside the setting, or turning it off, puts it back above the players list.
- **Menus open to the** Right, Left, or Automatic (towards the middle of the screen). In the top half of the screen the buttons and menus line up with the card's top and open downwards; an opened menu that would run off the screen shifts the panel until it fits, and it goes back when the menu closes.
- **Other** replaces the Item button and is there for any selection. Its two sections are **Item** (one character: weapons and improvised weapons, as before) and **Luck** (a Luck check, with the Group Luck roll for two or more: only the lowest Luck rolls, and you pick on a tie). It opens on Item for one character and on Luck for two or more.
- **Check and Opposed have two tabs**, Characteristic and Skill. Luck is in Other, Sanity has its own menu, and Idea and Know are INT and EDU checks: type "Idea" or "Know" in the Label box.
- **Click the mini sheet:** a characteristic opens Check with just that one ticked, SAN opens Sanity and Luck opens Other on Luck. The values take the system sheet's own click shortcuts (Shift to send at once, Ctrl to copy a link, right click for an opposed roll, Alt + right click to add to a combined check), all sent through Rollbox's menus. The guide's panel page lists them.
- **For contributors:** `AGENTS.md` for AI coding agents, with a "Find your way" index of what to read and which tests to run for each kind of task; `CONTRIBUTING.md`; public developer and design documents, recipes and a test index (`docs/TESTS.md`). The README says openly that Rollbox is built with AI.

## 0.1.0

First test release, for Foundry VTT 14 and Call of Cthulhu 7th Edition (CoC7) 8.15.

- **The Keeper's panel.** Select tokens and a small panel appears on top of the players list. One token: a mini sheet (portrait, owner, HP, MP, SAN, Luck and the eight characteristics). Several: a list of names with the values that matter for the open menu. Only the Keeper sees it.
- **Check.** Characteristics, Luck, Sanity, Idea, Know and every skill (trained first with Regular · Hard · Extreme values, then untrained at base value), with search and "+ Add" for unlisted specialisations. Difficulty (Regular, Hard, Extreme, Hidden), up to two bonus or penalty dice, Blind and a label. Request from player, Send to chat or Copy link.
- **Combined checks:** tick two or more checks for one roll, "All of them" or "Any one".
- **Group checks:** Send to each selected character; non-player characters are rolled privately for the Keeper.
- **Group Luck roll:** only the character with the lowest Luck rolls.
- **Sanity:** one-click presets or any loss, a cause the player sees instead of the numbers, and a creature name so CoC7 can cap repeated losses.
- **Item:** a character's weapons as skill checks (for shots at a lock and the like), or an improvised weapon with optional damage (half damage bonus when thrown).
- **Opposed rolls:** two characters, each with their own check and dice; CoC7's opposed card is made and a non-player side is rolled at once.
- **Assist:** several characters combine STR or SIZ against something too heavy for one (Physical Human Limits); Rollbox works out who helps and who rolls for the best chance, and posts a card saying so.
- **Results:** after sending, the menu lists who was asked, who was rolled for you and anything not sent.
- **Settings (all personal):** show or hide the panel; Simplified dice UI (type losses and damage instead of using presets and pickers); Dark or Light theme, Panel colour, transparency and size, each with a Reset button.
- Rollbox only sends CoC7's own roll requests and cards; it never changes a roll, a card or a rule.
