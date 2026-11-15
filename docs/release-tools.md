# Release tools (`tools/release-tools.mjs`)

Dev tooling, not part of the module: it lives in `tools/`, which never ships. Three commands package the module into a zip, smoke-test that zip the way an installer opens it, and run the release checks, so a release never depends on a hand-made zip. Nothing in it is specific to Rollbox: the id, version and file paths all come from `module.json`, so the `tools/` folder, the `fflate` dev dependency and the three `package.json` scripts can be copied as-is to `void-coc7-modules`.

Run from the project folder (or `npm run <command>` from the module folder):

```
npm --prefix modules/keepers-rollbox run package
npm --prefix modules/keepers-rollbox run smoke
npm --prefix modules/keepers-rollbox run release-check
```

`smoke` and `release-check` take an optional zip path after `--`. Without one, `smoke` uses the newest zip in `dist/` and `release-check` first runs `package` and checks the zip it just built. Each prints `keepers-rollbox | <command>: OK.` and exits 0, or lists every problem and exits 1.

The zip is made and read with `fflate` (MIT, no dependencies of its own), a dev dependency chosen by Void over PowerShell's `Compress-Archive`: it works the same on every platform and always writes forward slashes inside the zip.

**Status key:** *Confirmed* only when the build guide's Internal API registry or changelog says so.

## Code

### `packageModule(moduleDir)` — `npm run package`
- **How it works:** reads `module.json`, takes the files from `shippedFiles()`, and writes `dist/<id>-v<version>.zip` (overwriting one of the same name) with one top folder named the id, folder entries for every folder, each file's modified time, deflate level 9. Throws if `module.json` has no id or version. A file `module.json` lists that doesn't exist is left out, and the smoke test reports it.
- **Connects to:** `shippedFiles()`, `zipName()`, `fflate.zipSync`. `dist/` is in `.gitignore`.
- **Could interact poorly with:** nothing in Foundry; it runs outside it. A Foundry installer reading the zip: checked only with Windows' own `Expand-Archive` (one `keepers-rollbox` folder). Installing from the zip in Foundry: **Assumed** until the table check.

### `shippedFiles(moduleDir, manifest)`
- **How it works:** `module.json`, plus every top-level file or folder that a path in `module.json` lies in (`esmodules`, `scripts`, `styles`, `languages[].path`, `packs[].path`); for Rollbox that is `scripts/` only. Skips `NEVER_SHIP` (`tests`, `docs`, `tools`, `media` (the README's clips), `dist`, `node_modules`, `package.json`, `package-lock.json`), any `node_modules` folder and every dot-file or dot-folder, at any depth.
- **Connects to:** `packageModule()`, `debugLeftovers()`.
- **Could interact poorly with:** a file the module needs that lives in a top-level folder no `module.json` path points into (for example a `templates/` folder used only from code) would be left out. Rollbox keeps templates inside each part's folder under `scripts/`, so this doesn't arise; the smoke test would catch a template path written whole.

### `smokeTest(zipPath)` — `npm run smoke`
- **How it works:** opens the zip with `fflate.unzipSync` and returns every problem found:
  - no entry with a backslash, a leading `/` or `..`;
  - exactly one top folder, and it is the `id` in its `module.json`;
  - `module.json` is valid JSON with `id`, `title` and `version`, and the zip is named `<id>-v<version>.zip`;
  - nothing from `NEVER_SHIP`, no `node_modules`, no dot-files (one line per folder, not per file);
  - every file `module.json` lists is in the zip (packs: at least one file in the folder);
  - every file the `esmodules`, `scripts` and `styles` import, followed through each imported file, is in the zip (scripts: `import … from`, `export … from`, `import "x"`, `import("x")`; CSS: `@import`, `url()`);
  - every template path in a script is in the zip (`templatePaths()`);
  - every `.js` / `.mjs` file passes a syntax check (`syntaxError()`).
- **Connects to:** `checkReferences()` (inside the file), `resolveRef()`, `scriptImports()`, `styleImports()`, `templatePaths()`, `syntaxError()`.
- **Could interact poorly with:** imports are found with a text scan, not a parser (see `codeLines()`). Paths that point outside the module (`/systems/CoC7/…`, URLs, `data:`, bare package names) can't be checked from the zip and are skipped.

### `releaseCheck(moduleDir, zipPath?)` — `npm run release-check`
- **How it works:** Without `zipPath` it runs `packageModule()` first and checks that fresh zip, so an old zip can't pass for the current files; with one (`release-check -- <zip>`) it checks that zip as it is. Then `smokeTest()` on the zip, plus `debugLeftovers()` and `changelogProblems()` on the module folder.
- **Connects to:** the build guide's Release checklist, which it automates in part (version, zip contents, `console.log` / `debugger`). The rest of the checklist (compatibility, tests, registry, report) is still done by hand.
- **Could interact poorly with:** a zip named on the command line is checked as it is, so one packaged before the last change to `scripts/` passes if its version is unchanged.

### `debugLeftovers(moduleDir, manifest)`
- **How it works:** every `.js` / `.mjs` file in `shippedFiles()` (Rollbox: `scripts/`), comments blanked by `codeLines()`; reports `path:line: console.log left in` for `console.log(` and `path:line: debugger left in` for the word `debugger`.
- **Connects to:** CLAUDE.md's rule "No `console.log` or `debugger` left in `scripts/`".
- **Could interact poorly with:** the word `debugger` inside a string would be reported (no such string in Rollbox).

### `changelogProblems(moduleDir, version)`
- **How it works:** reads the `## <version>` headings of `CHANGELOG.md` in order (`## 0.1.0`, `## v0.1.0` and `## [0.1.0]` all count; `###` doesn't). The first must be `version`, and `version` must appear once.
- **Connects to:** the CHANGELOG format in the build guide ("`## <version>` headings, newest first").

### `newestZip(distDir)`
The `.zip` in `distDir` with the latest modified time, or null.

### `manifestPaths(manifest)`, `zipName(id, version)`, `readManifest(moduleDir)`
The paths `module.json` lists (files with the field they came from, and pack folders, leading `./` or `/` removed); `<id>-v<version>.zip`; `module.json` parsed.

### `scriptImports(source)`, `styleImports(source)`, `resolveRef(fromPath, spec, id, { plainIsRelative })`
- **How it works:** `scriptImports` finds import specifiers in code lines that start with `import` or `export`, plus `import("…")` anywhere. `styleImports` finds `@import` and `url()` targets. `resolveRef` turns a specifier into a path inside the module folder: `./` and `../` relative to the importing file, `modules/<id>/…` or `/modules/<id>/…` from the module root; in CSS a plain `name.png` is relative too. Anything else, or anything that resolves above the module folder, is `null` (not checked).
- **Could interact poorly with:** an import statement that doesn't start its line (two statements on one line) is missed. Rollbox writes one import per line.

### `templatePaths(source, id)`
- **How it works:** finds template paths written whole in one string, `modules/<id>/….hbs` or `modules/${ANY_CONSTANT}/….hbs` (also `.handlebars`, `.html`); paths naming another module's id are skipped.
- **Could interact poorly with:** a template path put together from pieces (`` `${DIR}/menu.hbs` ``) isn't seen and isn't checked. Write each template path whole: `` `modules/${MODULE_ID}/scripts/<part>/<name>.hbs` `` (build guide, Code style).

### `syntaxError(source, kind)`
- **How it works:** ES modules (everything except files listed under `module.json`'s `scripts`) go through `node --input-type=module --check` on stdin, one process per file; classic scripts are compiled with `vm.Script` without running. Returns `line N: SyntaxError: …` or null.
- **Could interact poorly with:** Node's parser is newer than some browsers'. A syntax Node accepts and an older browser doesn't would pass; Foundry v14's Electron is recent, so **Assumed** fine.

### `codeLines(source)`
Source split into lines with `/* */` comments blanked (line numbers kept) and `//` comments removed when the `//` starts a line or follows a space. A text scan: a string holding `/*` or ` //` can hide code from it.

### `main(args, moduleDir?)`
The command line: `package`, `smoke [zip]`, `release-check [zip]`. The module folder defaults to the folder above `tools/`. Messages start with `<id> |` from `module.json` (`release-tools |` if it can't be read). Returns the exit code; run directly, it sets `process.exitCode`.

## Hooks, overrides, keybindings
None. Runs in Node, never in Foundry.

## Settings
None.

## Tests
`tests/release-tools.test.mjs` builds a small made-up module (`test-module` 1.2.3) in a temp folder, with `tests/`, `docs/`, `tools/`, `package.json`, `package-lock.json` and `node_modules/` beside `scripts/`, and checks: the package leaves all of those out; smoke passes on the packaged zip and fails on `tests/` or `docs/` inside, a missing listed script, a missing imported script, a missing template, a wrong top folder, a zip name not matching the version, and a syntax error; release-check passes on the good module, builds a fresh zip first (a syntax error added after an earlier package is caught), and fails on a `console.log` or `debugger` in `scripts/`, on a newest changelog entry that isn't the version, and on the version appearing twice.
