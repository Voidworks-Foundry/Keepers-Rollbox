# Recipe: make a release

Only the maintainer makes releases. Contributors and agents stop once the change is merged; they never tag, push to `main` or create a GitHub release. This page is for the maintainer, and so anyone can see how a release is made.

## 1. Prepare

1. Every change for the release is merged into `main` and CI is green.
2. Choose the version (`0.1.1` for fixes, `0.2.0` for features).
3. `module.json`: set `version`, and put the same version in `download` (`…/releases/download/v<version>/keepers-rollbox-v<version>.zip`) and `manifest`. While releases are pre-releases, `manifest` names the version (`…/releases/download/v<version>/module.json`), because GitHub's `releases/latest` skips pre-releases. From the first full release, `manifest` is `…/releases/latest/download/module.json`.
4. `CHANGELOG.md`: a new `## <version>` heading at the top, holding the lines added since the last release, in plain words.
5. `README.md`: the manifest link under "Install", if it names the version.

## 2. Check

```
npm ci
npm test
npm run release-check
```

`release-check` builds `dist/keepers-rollbox-v<version>.zip` and checks it: one `keepers-rollbox` folder holding only `module.json` and `scripts/`, every file `module.json` and the scripts name present, no `console.log` or `debugger`, and the newest CHANGELOG entry equal to the version. Then go through the rest of the release checklist in [DEVELOPING.md](../DEVELOPING.md), and install that zip in Foundry by hand (AGENTS.md) for a last look as the Keeper and as a player.

## 3. Publish

1. Commit ("Release <version>") and push to `main`.
2. On GitHub, create a release: tag `v<version>` on `main`, title "Keeper's Rollbox <version>", notes with the CHANGELOG entry and the manifest link, assets `dist/keepers-rollbox-v<version>.zip` and `module.json`. Tick "Set as a pre-release" until 1.0.
3. In Foundry: Install Module → Manifest URL, paste the manifest link, and check it installs (or offers the update) with the new version.
