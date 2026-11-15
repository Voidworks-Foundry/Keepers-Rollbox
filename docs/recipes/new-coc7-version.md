# Recipe: support a new CoC7 version

Rollbox talks to CoC7 only through its roll links, a few actor methods and its cards, but some of what it relies on is internal. After a CoC7 (or Foundry) update, recheck those before marking the new version as supported. Everything to recheck is listed in [DEVELOPING.md](../DEVELOPING.md), "Internal API registry".

## 1. Read what changed

- CoC7's release notes and changelog for every version since the one in `module.json` (`relationships.systems`, `verified`).
- Recover the new version's source from its `system.js` source map (DEVELOPING.md, "Reading CoC7's source"), into a scratch folder outside the repository. Do the same for the old version and compare the files the registry and "CoC7 integration" name: `apps/link.js`, `apps/roll-normalize.js`, `apps/check.js`, `apps/chat-combined-message.js`, `apps/chat-opposed-message.js`, `apps/san-check-card.js`, `apps/dice-pool.js`, `models/actor/document-class.js`, `models/item/weapon-system.js`, `hooks/render-chat-message-html.js`, and the `CoC7.MessageTargetCheckRequested` string in the English language file.

## 2. Go through the registry, row by row

For each row: does the API still exist, with the same name, arguments and behaviour?
- **Unchanged:** leave it.
- **Changed:** fix the guarded code in the part named in "Used in", update the row and set its status back to **Assumed** until it's seen working in Foundry.
- **Gone:** the guard should already make the feature do nothing with one warning. Find the public replacement, or open an issue saying what no longer works.

Also reread "Link syntax", "v14 chat modes" and the "Gaps": a newer CoC7 may now do something it couldn't (blind Sanity cards, opposed cards without roles), which would be a design change to agree first.

## 3. Test

```
npm test
npm run release-check
```

The tests use mocks, so they prove Rollbox's logic, not CoC7's: they pass even if CoC7 changed. The real check is in Foundry, with the new CoC7 version installed: the module loads with no red console lines; then, as the Keeper with one player logged in: a check (with Hidden difficulty and a label), a combined check, a group check with an NPC selected, a Sanity check for a player and an NPC, a weapon and an improvised weapon with damage, an opposed roll (player against NPC) and an Assist. Mark each registry row you saw working **Confirmed** with the date and what was seen.

## 4. Record it

- `module.json`: the CoC7 relationship's `verified` (and `minimum`, if older versions no longer work).
- `README.md`, "Compatibility".
- DEVELOPING.md: "Environment" and anything new learned, in its topic's section.
- `CHANGELOG.md`: "Compatibility: works with CoC7 <version>." and any fixes.

A Foundry update is the same procedure with Foundry's client source (`resources/app/client/` in the install) and the Foundry rows of the registry; `module.json`'s `compatibility` holds the Foundry versions.
