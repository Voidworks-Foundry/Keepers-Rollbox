// Release tools: package the module into a zip, smoke-test that zip the way an installer opens it, and run the
// release checks, so a release never depends on a hand-made zip. Nothing here is specific to one module: the id,
// version and file paths all come from module.json, so this folder can be copied as-is to another module.
// Run from the module folder's package.json: `npm run package`, `npm run smoke`, `npm run release-check`.
// Dev tooling only: it lives in tools/, which never ships.
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, posix } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Script } from "node:vm";
import { strFromU8, unzipSync, zipSync } from "fflate";

/** Folder (inside the module folder) the package script writes zips to. */
export const DIST_DIR = "dist";

/** Top-level files and folders of a module folder that must never be in a release zip. */
export const NEVER_SHIP = ["tests", "docs", "tools", "media", DIST_DIR, "node_modules", "package.json", "package-lock.json"];

const ZIP_LEVEL = 9;
const SCRIPT_FILE = /\.(?:js|mjs)$/;
const NEVER_SHIP_SET = new Set(NEVER_SHIP);

/** `<id>-v<version>.zip`, the name the package script gives a zip and the smoke test expects. */
export function zipName(id, version) {
  return `${id}-v${version}.zip`;
}

/** Reads and parses `module.json` from a module folder. Throws if it is missing or not JSON. */
export function readManifest(moduleDir) {
  return JSON.parse(readFileSync(join(moduleDir, "module.json"), "utf8"));
}

function listOf(value) {
  return Array.isArray(value) ? value : [];
}

function cleanPath(path) {
  return typeof path === "string" ? path.replace(/^\.?\//, "") : "";
}

/**
 * The paths module.json points at, grouped by what Foundry does with them.
 * `files` must each be a file; `packs` are folders (compendium databases).
 */
export function manifestPaths(manifest) {
  const files = [
    ...listOf(manifest.esmodules).map((path) => ({ path: cleanPath(path), field: "esmodules" })),
    ...listOf(manifest.scripts).map((path) => ({ path: cleanPath(path), field: "scripts" })),
    ...listOf(manifest.styles).map((path) => ({ path: cleanPath(path), field: "styles" })),
    ...listOf(manifest.languages).map((lang) => ({ path: cleanPath(lang?.path), field: "languages" })),
  ].filter((entry) => entry.path);
  const packs = listOf(manifest.packs).map((pack) => cleanPath(pack?.path)).filter(Boolean);
  return { files, packs };
}

function isNeverShip(relPath) {
  const segments = relPath.split("/");
  return NEVER_SHIP_SET.has(segments[0]) || segments.some((s) => s.startsWith(".") || s === "node_modules");
}

function walkFiles(dir, rel, out) {
  for (const name of readdirSync(dir).sort()) {
    const relPath = `${rel}/${name}`;
    if (isNeverShip(relPath)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walkFiles(full, relPath, out);
    else out.push(relPath);
  }
}

/** Top-level files every release ships when the module folder has them: the licence travels with each copy. */
export const ALWAYS_SHIP = ["LICENSE"];

/**
 * The files a release ships, relative to the module folder: `module.json`, the licence (ALWAYS_SHIP), plus every
 * top-level file or folder that a module.json path lies in (for this module, `scripts/`). Anything in NEVER_SHIP and
 * dot-files are left out.
 */
export function shippedFiles(moduleDir, manifest) {
  const { files, packs } = manifestPaths(manifest);
  const roots = new Set([...files.map((f) => f.path), ...packs].map((path) => path.split("/")[0]));
  const out = ["module.json", ...ALWAYS_SHIP.filter((name) => existsSync(join(moduleDir, name)))];
  for (const root of [...roots].sort()) {
    if (root === "module.json" || ALWAYS_SHIP.includes(root) || isNeverShip(root)) continue;
    const full = join(moduleDir, root);
    if (!existsSync(full)) continue; // the smoke test reports the missing path
    if (statSync(full).isDirectory()) walkFiles(full, root, out);
    else out.push(root);
  }
  return out;
}

/**
 * Writes `dist/<id>-v<version>.zip` in the module folder: one top folder named the module id, holding
 * the shipped files with their modified times. Returns the zip's path and the files it holds.
 */
export function packageModule(moduleDir) {
  const manifest = readManifest(moduleDir);
  const { id, version } = manifest;
  if (typeof id !== "string" || !id || typeof version !== "string" || !version) {
    throw new Error("module.json needs an id and a version");
  }
  const files = shippedFiles(moduleDir, manifest);
  // A nested tree makes fflate write a folder entry for each folder, as zips made by hand do.
  const tree = {};
  for (const relPath of files) {
    const parts = [id, ...relPath.split("/")];
    let node = tree;
    for (const folder of parts.slice(0, -1)) node = node[folder] ??= {};
    const full = join(moduleDir, ...relPath.split("/"));
    node[parts.at(-1)] = [readFileSync(full), { mtime: statSync(full).mtime }];
  }
  const zipPath = join(moduleDir, DIST_DIR, zipName(id, version));
  mkdirSync(dirname(zipPath), { recursive: true });
  writeFileSync(zipPath, zipSync(tree, { level: ZIP_LEVEL }));
  return { zipPath, files };
}

/** The most recently written `.zip` in a folder, or null when there is none. */
export function newestZip(distDir) {
  if (!existsSync(distDir)) return null;
  const zips = readdirSync(distDir)
    .filter((name) => name.toLowerCase().endsWith(".zip"))
    .map((name) => ({ path: join(distDir, name), mtime: statSync(join(distDir, name)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  return zips[0]?.path ?? null;
}

/**
 * Source split into lines with comments blanked out (line numbers kept), so a comment that mentions
 * `console.log` or an old import isn't taken for code. A text scan, not a parser: a string holding `/*`
 * or ` //` can hide code from it.
 */
export function codeLines(source) {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, " "));
  return noBlocks.split("\n").map((line) => line.replace(/(^|\s)\/\/.*$/, "$1"));
}

const IMPORT_FROM = /^\s*(?:import|export)\s[^;"'`]*?\bfrom\s*(["'])([^"'\n]+)\1/gm;
const IMPORT_BARE = /^\s*import\s*(["'])([^"'\n]+)\1/gm;
const IMPORT_DYNAMIC = /\bimport\s*\(\s*(["'])([^"'\n]+)\1\s*\)/g;
const CSS_IMPORT = /@import\s+(?:url\(\s*)?(["']?)([^"')\s;]+)\1/g;
const CSS_URL = /url\(\s*(["']?)([^"')\s]+)\1\s*\)/g;
// A template path written whole in one string: modules/<id>/… or modules/${SOME_CONSTANT}/….
const TEMPLATE_PATH = /modules\/(?:\$\{\s*[\w$.]+\s*\}|([\w.-]+))\/([^"'`\s)]+?\.(?:hbs|handlebars|html))(?=["'`])/g;

function matchesOf(pattern, text, group) {
  return [...text.matchAll(pattern)].map((m) => m[group]);
}

/** Specifiers a script imports: static `import … from`, `export … from`, bare `import "x"` and `import("x")`. */
export function scriptImports(source) {
  const code = codeLines(source).join("\n");
  return [...matchesOf(IMPORT_FROM, code, 2), ...matchesOf(IMPORT_BARE, code, 2), ...matchesOf(IMPORT_DYNAMIC, code, 2)];
}

/** Files a stylesheet loads: `@import` and `url(…)`. */
export function styleImports(source) {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "");
  return [...new Set([...matchesOf(CSS_IMPORT, code, 2), ...matchesOf(CSS_URL, code, 2)])];
}

/** Template paths in a script that belong to module `id`, relative to the module folder. */
export function templatePaths(source, id) {
  const code = codeLines(source).join("\n");
  return [...code.matchAll(TEMPLATE_PATH)].filter((m) => !m[1] || m[1] === id).map((m) => m[2]);
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Resolves an import or url() from file `fromPath` (relative to the module folder) to a path in the module
 * folder, or null when it points outside the module (a URL, `data:`, another package, a bare npm name),
 * which the zip can't vouch for. In CSS a plain `name.png` is relative; in a script it is a bare name.
 */
export function resolveRef(fromPath, spec, id, { plainIsRelative = false } = {}) {
  const path = spec.split(/[?#]/)[0];
  if (!path || /^[a-z][a-z0-9+.-]*:/i.test(path) || path.startsWith("//")) return null;
  const own = new RegExp(`^/?modules/${escapeRegExp(id)}/`);
  if (own.test(path)) return posix.normalize(path.replace(own, ""));
  const relative = path.startsWith("./") || path.startsWith("../") || (plainIsRelative && !path.startsWith("/"));
  if (!relative) return null;
  const resolved = posix.normalize(posix.join(posix.dirname(fromPath), path));
  return resolved.startsWith("../") ? null : resolved;
}

/** First line of a syntax error for `source` run as an ES module (`module`) or a classic script, or null. */
export function syntaxError(source, kind) {
  if (kind === "script") {
    try {
      new Script(source);
      return null;
    } catch (error) {
      return `${error.name}: ${error.message}`;
    }
  }
  const result = spawnSync(process.execPath, ["--input-type=module", "--check"], { input: source, encoding: "utf8" });
  if (result.status === 0) return null;
  const lines = (result.stderr ?? "").split(/\r?\n/);
  const where = lines.find((line) => /^\[stdin\]:\d+/.test(line))?.replace("[stdin]", "line") ?? "";
  const what = lines.find((line) => /Error/.test(line)) ?? "syntax check failed";
  return [where, what.trim()].filter(Boolean).join(": ");
}

/**
 * Opens a release zip the way an installer does and lists every problem found (empty when it passes):
 * one top folder named exactly the module id; module.json valid, its id and version matching the zip name;
 * every file module.json lists, every file those import and every template path present; every script
 * passing a syntax check; nothing from NEVER_SHIP inside.
 */
export function smokeTest(zipPath) {
  const problems = [];
  let entries;
  try {
    entries = unzipSync(readFileSync(zipPath));
  } catch (error) {
    return { problems: [`Can't open ${zipPath}: ${error.message}`] };
  }
  const names = Object.keys(entries);
  for (const name of names) {
    if (name.includes("\\") || name.startsWith("/") || name.split("/").includes("..")) {
      problems.push(`Unsafe path in the zip: ${name}`);
    }
  }
  const tops = [...new Set(names.map((name) => name.split("/")[0]))];
  if (tops.length !== 1 || !names.some((name) => name.includes("/"))) {
    problems.push(`The zip must hold one top folder; it holds: ${tops.join(", ") || "nothing"}`);
    return { problems };
  }
  const top = tops[0];
  const files = new Map(
    names.filter((name) => !name.endsWith("/") && name.length > top.length + 1)
      .map((name) => [name.slice(top.length + 1), entries[name]]),
  );

  let manifest;
  try {
    manifest = JSON.parse(strFromU8(files.get("module.json") ?? new Uint8Array()));
  } catch (error) {
    problems.push(files.has("module.json") ? `module.json is not valid JSON: ${error.message}` : `${top}/module.json is missing`);
    return { problems };
  }
  for (const key of ["id", "title", "version"]) {
    if (typeof manifest[key] !== "string" || !manifest[key].trim()) problems.push(`module.json has no "${key}"`);
  }
  if (manifest.id !== top) problems.push(`The top folder "${top}" is not the module id "${manifest.id}"`);
  const expected = zipName(manifest.id, manifest.version);
  if (basename(zipPath) !== expected) {
    problems.push(`The zip is named ${basename(zipPath)}, but module.json (version ${manifest.version}) makes it ${expected}`);
  }

  // One line per never-ship folder, not per file inside it.
  const neverShip = new Set([...files.keys()].filter(isNeverShip).map((path) => {
    const first = path.split("/")[0];
    return NEVER_SHIP_SET.has(first) && path.includes("/") ? `${first}/` : path;
  }));
  for (const path of neverShip) problems.push(`Must not ship: ${top}/${path}`);

  problems.push(...checkReferences(files, manifest));
  return { problems, manifest, top, files: [...files.keys()] };
}

/** Listed files, imports and templates present, and scripts parse; paths relative to the top folder. */
function checkReferences(files, manifest) {
  const problems = [];
  const { files: listed, packs } = manifestPaths(manifest);
  const classicScripts = new Set(listed.filter((f) => f.field === "scripts").map((f) => f.path));
  const queue = [];
  for (const { path, field } of listed) {
    if (!files.has(path)) problems.push(`module.json lists ${path} (${field}), but it is not in the zip`);
    else if (field !== "languages") queue.push(path);
  }
  for (const pack of packs) {
    if (![...files.keys()].some((path) => path.startsWith(`${pack}/`))) {
      problems.push(`module.json lists the pack ${pack}, but it is not in the zip`);
    }
  }

  const seen = new Set(queue);
  while (queue.length) {
    const from = queue.shift();
    const source = strFromU8(files.get(from));
    const isStyle = from.endsWith(".css");
    const refs = isStyle ? styleImports(source) : scriptImports(source);
    for (const spec of refs) {
      const target = resolveRef(from, spec, manifest.id, { plainIsRelative: isStyle });
      if (target === null) continue;
      if (!files.has(target)) problems.push(`${from} imports ${spec}, but ${target} is not in the zip`);
      else if (!seen.has(target)) {
        seen.add(target);
        if (SCRIPT_FILE.test(target) || target.endsWith(".css")) queue.push(target);
      }
    }
  }

  for (const [path, data] of files) {
    if (!SCRIPT_FILE.test(path)) continue;
    const source = strFromU8(data);
    for (const template of templatePaths(source, manifest.id)) {
      if (!files.has(template)) problems.push(`${path} uses the template ${template}, but it is not in the zip`);
    }
    const error = syntaxError(source, classicScripts.has(path) ? "script" : "module");
    if (error) problems.push(`${path} fails the syntax check: ${error}`);
  }
  return problems;
}

/** Every `console.log` and `debugger` left in the shipped scripts on disk, as `path:line: what`. */
export function debugLeftovers(moduleDir, manifest) {
  const problems = [];
  for (const path of shippedFiles(moduleDir, manifest).filter((p) => SCRIPT_FILE.test(p))) {
    const lines = codeLines(readFileSync(join(moduleDir, ...path.split("/")), "utf8"));
    lines.forEach((line, index) => {
      if (/\bconsole\s*\.\s*log\s*\(/.test(line)) problems.push(`${path}:${index + 1}: console.log left in`);
      if (/\bdebugger\b/.test(line)) problems.push(`${path}:${index + 1}: debugger left in`);
    });
  }
  return problems;
}

/** The newest `## <version>` entry of CHANGELOG.md must be `version`, and that version must appear once. */
export function changelogProblems(moduleDir, version) {
  const path = join(moduleDir, "CHANGELOG.md");
  if (!existsSync(path)) return ["CHANGELOG.md is missing"];
  const versions = [...readFileSync(path, "utf8").matchAll(/^##\s+\[?v?([^\s\]]+)/gm)].map((m) => m[1]);
  if (!versions.length) return ["CHANGELOG.md has no \"## <version>\" entry"];
  const problems = [];
  if (versions[0] !== version) {
    problems.push(`The newest CHANGELOG.md entry is ${versions[0]}, but module.json's version is ${version}`);
  }
  const count = versions.filter((v) => v === version).length;
  if (count > 1) problems.push(`CHANGELOG.md has ${count} entries for ${version}; it should have one`);
  return problems;
}

/**
 * The smoke test on `zipPath`, plus: no `console.log` or `debugger` in the shipped scripts, and the newest
 * CHANGELOG.md entry is module.json's version, appearing once. Without `zipPath` it packages the module first
 * and checks that zip, so an old zip with the same version can never pass for the current files.
 */
export function releaseCheck(moduleDir, zipPath = packageModule(moduleDir).zipPath) {
  const problems = [...smokeTest(zipPath).problems];
  const manifest = readManifest(moduleDir);
  problems.push(...debugLeftovers(moduleDir, manifest), ...changelogProblems(moduleDir, manifest.version));
  return { problems, zipPath };
}

function report(prefix, label, problems, okLine) {
  if (!problems.length) {
    process.stdout.write(`${prefix} ${label}: OK. ${okLine}\n`);
    return 0;
  }
  process.stderr.write(`${prefix} ${label}: FAILED, ${problems.length} problem(s):\n`);
  for (const problem of problems) process.stderr.write(`  - ${problem}\n`);
  return 1;
}

/** Command line: `node tools/release-tools.mjs package | smoke [zip] | release-check [zip]`. */
export function main(args, moduleDir = fileURLToPath(new URL("..", import.meta.url))) {
  const [command, zipArg] = args;
  let prefix = "release-tools |";
  try {
    prefix = `${readManifest(moduleDir).id} |`;
  } catch {
    // keep the generic prefix; the command reports the broken module.json
  }
  try {
    if (command === "package") {
      const { zipPath, files } = packageModule(moduleDir);
      process.stdout.write(`${prefix} package: wrote ${zipPath} (${files.length} files)\n`);
      return 0;
    }
    if (command === "smoke") {
      const distZip = zipArg ?? newestZip(join(moduleDir, DIST_DIR));
      if (!distZip) return report(prefix, "smoke", [`No zip in ${DIST_DIR}/; run the package script first`]);
      return report(prefix, "smoke", smokeTest(distZip).problems, distZip);
    }
    if (command === "release-check") {
      // A zip named on the command line is checked as it is; otherwise a fresh one is built first.
      const { problems, zipPath } = zipArg ? releaseCheck(moduleDir, zipArg) : releaseCheck(moduleDir);
      return report(prefix, "release-check", problems, zipPath);
    }
  } catch (error) {
    process.stderr.write(`${prefix} ${command}: ${error.message}\n`);
    return 1;
  }
  process.stderr.write(`${prefix} usage: node tools/release-tools.mjs package | smoke [zip] | release-check [zip]\n`);
  return 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main(process.argv.slice(2));
}
