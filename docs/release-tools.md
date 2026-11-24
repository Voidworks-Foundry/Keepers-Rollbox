# Release tools (`tools/release-tools.mjs`, `tools/public-docs.mjs`)

Dev tooling, not part of the module: it lives in `tools/`, which never ships. Three commands package the module into a zip, smoke-test that zip the way an installer opens it, and run the release checks, so a release never depends on a hand-made zip. Nothing in it is specific to Rollbox: the id, version and file paths all come from `module.json`, so the `tools/` folder, the `fflate` dev dependency and the three `package.json` scripts can be copied as-is to `void-coc7-modules`.

Run from the project folder (or `npm run <command>` from the module folder):

```
npm --prefix modules/keepers-rollbox run package
npm --prefix modules/keepers-rollbox run smoke
npm --prefix modules/keepers-rollbox run release-check
npm --prefix modules/keepers-rollbox run public-docs
```

`smoke` and `release-check` take an optional zip path after `--`. Without one, `smoke` uses the newest zip in `dist/` and `release-check` first runs `package` and checks the zip it just built. Each prints `keepers-rollbox | <command>: OK. <zip path>` (`package` prints the zip it wrote and how many files) and exits 0, or lists every problem and exits 1.

The zip is made and read with `fflate` (MIT, no dependencies of its own), a dev dependency chosen over PowerShell's `Compress-Archive`: it works the same on every platform and always writes forward slashes inside the zip.

**Status key:** *Confirmed* only when the build guide's Internal API registry or changelog says so.

## Code

### `packageModule(moduleDir)` — `npm run package`
- **How it works:** reads `module.json`, takes the files from `shippedFiles()`, and writes `dist/<id>-v<version>.zip` (overwriting one of the same name) with one top folder named the id, folder entries for every folder, each file's modified time, deflate level 9. Returns `{ zipPath, files }`. Throws if `module.json` has no id or version. A file `module.json` lists that doesn't exist is left out, and the smoke test reports it.
- **Connects to:** `shippedFiles()`, `zipName()`, `fflate.zipSync`. `dist/` is in `.gitignore`.
- **Could interact poorly with:** nothing in Foundry; it runs outside it. A Foundry installer reading the zip: checked only with Windows' own `Expand-Archive` (one `keepers-rollbox` folder). Installing from the zip in Foundry: **Assumed** until the table check.

### `shippedFiles(moduleDir, manifest)`
- **How it works:** `module.json`, the top-level files in `ALWAYS_SHIP` that the module folder has (`LICENSE`: the licence travels with every copy), plus every top-level file or folder that a path in `module.json` lies in (`esmodules`, `scripts`, `styles`, `languages[].path`, `packs[].path`); for Rollbox that is `scripts/` only, so `guide/`, `README.md`, `CHANGELOG.md` and the other repository files never ship. Skips `NEVER_SHIP` (`tests`, `docs`, `tools`, `media` (the README's clips), `dist`, `node_modules`, `package.json`, `package-lock.json`), any `node_modules` folder and every dot-file or dot-folder, at any depth.
- **Connects to:** `packageModule()`, `debugLeftovers()`.
- **Could interact poorly with:** a file the module needs that lives in a top-level folder no `module.json` path points into (for example a `templates/` folder used only from code) would be left out. Rollbox keeps templates inside each part's folder under `scripts/`, so this doesn't arise; the smoke test would catch a template path written whole.

### `smokeTest(zipPath)` — `npm run smoke`
- **How it works:** opens the zip with `fflate.unzipSync` and returns `{ problems, manifest, top, files }` (only `{ problems }` when it stops early: a zip it can't open, no single top folder, or no readable `module.json`), `problems` listing every problem found:
  - no entry with a backslash, a leading `/` or `..`;
  - exactly one top folder, and it is the `id` in its `module.json`;
  - `module.json` is valid JSON with `id`, `title` and `version`, and the zip is named `<id>-v<version>.zip`;
  - nothing from `NEVER_SHIP`, no `node_modules`, no dot-files (one line per folder, not per file);
  - every file `module.json` lists is in the zip (packs: at least one file in the folder);
  - every file the `esmodules`, `scripts` and `styles` import, followed through each imported file, is in the zip (scripts: `import … from`, `export … from`, `import "x"`, `import("x")`; CSS: `@import`, `url()`);
  - every template path in a script is in the zip (`templatePaths()`);
  - every `.js` / `.mjs` file passes a syntax check (`syntaxError()`).
- **Connects to:** `checkReferences()` (inside the file), `resolveRef()`, `scriptImports()`, `styleImports()`, `templatePaths()`, `syntaxError()`.
- **Could interact poorly with:** imports are found with a text scan, not a parser (see `codeLines()`). Paths that point outside the module (`/systems/CoC7/…`, URLs, `data:`, bare package names) can't be checked from the zip and are skipped. Only `NEVER_SHIP` names and dot-files are refused, so a hand-made zip holding another repository folder such as `guide/` would pass; the package script never puts one in.

### `releaseCheck(moduleDir, zipPath?)` — `npm run release-check`
- **How it works:** Without `zipPath` it runs `packageModule()` first and checks that fresh zip, so an old zip can't pass for the current files; with one (`release-check -- <zip>`) it checks that zip as it is. Then `smokeTest()` on the zip, plus `debugLeftovers()` and `changelogProblems()` on the module folder. Returns `{ problems, zipPath }`.
- **Connects to:** the build guide's Release checklist, which it automates in part (version, zip contents, `console.log` / `debugger`). The rest of the checklist (compatibility, tests, registry, report) is still done by hand.
- **Could interact poorly with:** a zip named on the command line is checked as it is, so one packaged before the last change to `scripts/` passes if its version is unchanged.

### `debugLeftovers(moduleDir, manifest)`
- **How it works:** every `.js` / `.mjs` file in `shippedFiles()` (Rollbox: `scripts/`), comments blanked by `codeLines()`; reports `path:line: console.log left in` for `console.log(` and `path:line: debugger left in` for the word `debugger`.
- **Connects to:** AGENTS.md's rule: no `console.log` or `debugger` in `scripts/`.
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

### `DIST_DIR`, `NEVER_SHIP`
`DIST_DIR` is `"dist"`, the folder inside the module folder that `packageModule()` writes zips to and `smoke` looks in. `NEVER_SHIP` is the top-level files and folders of a module folder that are never in a release zip: `tests`, `docs`, `tools`, `media`, `dist`, `node_modules`, `package.json`, `package-lock.json`. `shippedFiles()` skips them and `smokeTest()` reports any that are inside a zip.

### `ALWAYS_SHIP`
`["LICENSE"]`: top-level files every release ships when the module folder has them, whatever `module.json` lists; `shippedFiles()` puts them right after `module.json` and doesn't add them twice.

### `main(args, moduleDir?)`
The command line: `package`, `smoke [zip]`, `release-check [zip]`. The module folder defaults to the folder above `tools/`. Messages start with `<id> |` from `module.json` (`release-tools |` if it can't be read). Returns the exit code; run directly, it sets `process.exitCode`.

## Public docs (`tools/public-docs.mjs`) — `npm run public-docs`

The module's `docs/DEVELOPING.md` and `docs/DESIGN.md` are written from the maintainer's build guide and design folder (`docs/BUILD-GUIDE.md` and `docs/design/` two folders above the module), with the maintainer-only parts left out, so a copy never drifts from its source. Dev tooling: it lives in `tools/`, which never ships.

### Markers
Each on a line of its own in a source:
- `<!-- project-only -->` … `<!-- /project-only -->`: left out of the public copy.
- `<!-- public-only` … `-->`: the lines between appear only in the public copy (in the source they are inside a comment).
- `<!-- contents -->`: replaced by the public copy's linked list of its `##` sections.
- `<!-- about: text -->`, right under a `##` heading: that section's line in the contents (dropped from the copy itself).

### `PUBLIC_DOCS`, `GENERATED_NOTE`, `anchorOf(heading)`
`PUBLIC_DOCS` pairs each source with its copy (`BUILD-GUIDE.md` → `docs/DEVELOPING.md`, the `design` folder → `docs/DESIGN.md`). `GENERATED_NOTE` is the first line of every copy, an HTML comment saying the file is written from its source and to change that instead. `anchorOf` gives GitHub's anchor for a heading (lower case, punctuation dropped, spaces as hyphens), for the contents links.

### `DESIGN_FILES`, `designSource(files)`
`DESIGN_FILES` lists the design files joined into the public `docs/DESIGN.md`, in order: `OVERVIEW.md`, then one file per feature (`INDEX.md`, for agents, stays out). `designSource` takes each file's text by name and returns one source document: a fixed opening (title, what the document is, `<!-- contents -->`), the overview's sections without its title, then each feature file one heading level down (its `#` title a `##` section). Links between the files (`combat.md`, `combat.md#delay`) become links to that file's section, and `modules/keepers-rollbox/docs/` paths lose that prefix (the part documents sit beside the copy). The result then goes through `publicCopy` like any source.

### `publicCopy(source)`
- **How it works:** pure text in, text out. Reads the source line by line (CRLF or LF), keeping lines outside `project-only` blocks and the lines inside `public-only` comments; a `/project-only` without its start, or a block never closed, throws. Then builds the contents from the kept `##` headings (each with its `about:` text when there is one), puts it where `<!-- contents -->` stands, drops the `about:` lines, collapses three or more line breaks to two, and returns `GENERATED_NOTE` plus the text with LF line ends and one final line break.
- **Connects to:** `publicDocs()`.
- **Could interact poorly with:** a marker written inside a code block is still read as a marker. Anchors follow GitHub's rule for plain headings; a heading repeated in one document gets GitHub's `-1` suffix, which the contents link doesn't add. **Assumed.**

### `publicDocs(moduleDir?, sourceDir?)`
- **How it works:** for each of `PUBLIC_DOCS`, the copy as it should be (`publicCopy` of the source) and whether the file on disk matches it, line ends ignored: `[{ copy, path, text, stale }]`. Null when any source isn't there (the public repository, which has only the copies).
- **Connects to:** `main()` (the CLI) and `tests/public-docs.test.mjs`, which fails while a copy is stale.

### `main()`
The command line (`npm run public-docs`): writes each stale copy and prints `public-docs: <copy> written` or `already up to date`; without the sources it says so and writes nothing. Runs only when the file is run directly.

## Hooks, overrides, keybindings
None. Runs in Node, never in Foundry.

## Settings
None.

## Tests
`tests/release-tools.test.mjs` builds a small made-up module (`test-module` 1.2.3) in a temp folder, with `tests/`, `docs/`, `tools/`, `package.json`, `package-lock.json` and `node_modules/` beside `scripts/`, and checks: the package ships `module.json`, `LICENSE` and `scripts/` in one top folder and leaves all of those out; smoke passes on the packaged zip and fails on `tests/` or `docs/` inside, a missing listed script, a missing imported script, a missing template, a wrong top folder, a zip name not matching the version, and a syntax error; release-check passes on the good module, builds a fresh zip first (a syntax error added after an earlier package is caught), and fails on a `console.log` or `debugger` in `scripts/`, on a newest changelog entry that isn't the version, and on the version appearing twice. Find the test you need in [TESTS.md, release-tools.test.mjs](TESTS.md#release-toolstestmjs) and run only that.

`tests/public-docs.test.mjs`: `publicCopy` on a small source (project-only left out, public-only kept, the contents list), `designSource` on two small files (the overview first, a feature one heading level down, links between files to sections), and that `docs/DEVELOPING.md` and `docs/DESIGN.md` match their sources (skipped where the sources aren't there).
