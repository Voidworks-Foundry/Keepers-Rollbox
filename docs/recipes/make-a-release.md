# Recipe: make a release

Only the maintainer makes releases. Contributors and agents stop once the change is merged; they never tag, push to `main` or create a GitHub release. This page is for the maintainer, and so anyone can see how a release is made.

## 1. Prepare

1. Every change for the release is merged into `main` and CI is green.
2. Choose the version: the last number up for fixes only (`0.1.2` → `0.1.3`), the middle one for features (`0.1.2` → `0.2.0`).
3. `module.json`: set `version`, and put the same version in `download` (`…/releases/download/v<version>/keepers-rollbox-v<version>.zip`). `manifest` stays `https://raw.githubusercontent.com/Voidworks-Foundry/keepers-rollbox/main/module.json`: every installed copy checks `main`'s `module.json` for updates, so its version changes only at a release, and the push and the GitHub release (with its zip) are made together.
4. `CHANGELOG.md`: a new `## <version>` heading at the top, holding the lines contributors added since the last release, in plain words. `release-check` fails unless the newest heading is the version in `module.json`, and appears once.
5. `README.md`: the manifest link under "Install" is the raw `module.json` on `main`; it doesn't change.

## 2. Check

```
npm ci
npm test
npm run release-check
```

`release-check` builds `dist/keepers-rollbox-v<version>.zip` and checks it ([release-tools.md](../release-tools.md)): one `keepers-rollbox` folder holding only `module.json` and `scripts/`, every file `module.json` and the scripts name present, every script passing a syntax check, no `console.log` or `debugger`, and the newest CHANGELOG entry equal to the version. Then go through the rest of the release checklist in [DEVELOPING.md](../DEVELOPING.md), and install that zip in Foundry by hand (AGENTS.md) for a last look as the Keeper and as a player.

## 3. Publish

1. Commit ("Release <version>") and push to `main`; CI (`.github/workflows/ci.yml`) runs `npm ci`, `npm test` and `npm run release-check` again.
2. Straight after the push (installed copies now see the new version on `main` and look for its zip), create the release on GitHub: tag `v<version>` on `main`, title "Keeper's Rollbox <version>", notes with the CHANGELOG entry and the manifest link, assets `dist/keepers-rollbox-v<version>.zip` and `module.json`. Tick "Set as a pre-release" until 1.0.
3. In Foundry: Install Module → Manifest URL, paste the manifest link, and check it installs (or offers the update) with the new version.
