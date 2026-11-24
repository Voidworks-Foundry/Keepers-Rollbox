// Public docs: the module's docs/DEVELOPING.md and docs/DESIGN.md are written from the maintainer's own build guide and
// design folder (docs/design/: the overview, then one file per feature, joined into one document), with the
// maintainer-only parts left out, so the copies never drift.
// Markers in a source, each on a line of its own:
//   <!-- project-only --> … <!-- /project-only -->   left out of the public copy
//   <!-- public-only … -->                          the lines between appear only in the public copy
//   <!-- contents -->                               the public copy's linked list of its `##` sections
//   <!-- about: text -->                            right under a `##` heading: that section's line in the contents
// The public copies also lose the maintainer's history: decision tags, dates and names (`withoutHistory`).
// Run from the module folder: `npm run public-docs` writes the copies; tests/public-docs.test.mjs fails when a copy
// is stale. Where the sources aren't there (the public repository), both do nothing.
// Dev tooling only: it lives in tools/, which never ships.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/** The module folder (this file's parent's parent). */
const MODULE_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
/** The maintainer's documents, two folders up from the module folder; absent in the public repository. */
const SOURCE_DIR = join(MODULE_DIR, "..", "..", "docs");

/** Each public copy and the source it is written from (a file, or a folder joined by `designSource`). */
export const PUBLIC_DOCS = Object.freeze([
  { source: "BUILD-GUIDE.md", copy: "docs/DEVELOPING.md" },
  { source: "design", copy: "docs/DESIGN.md" }
]);

/** The design files joined into the public DESIGN.md, in this order; INDEX.md is for agents and stays out. */
export const DESIGN_FILES = Object.freeze([
  "OVERVIEW.md", "panel.md", "flyouts.md", "check-flyout.md", "other-flyout.md", "opposed-flyout.md", "assist.md",
  "action-flyout.md", "alert-flyout.md", "status.md", "combat-start.md", "combat.md", "player.md", "setup.md",
  "themes.md", "settings.md", "rules.md"
]);

/** The public DESIGN.md's opening, before the overview's first section. */
const DESIGN_INTRO = [
  "# Keeper's Rollbox — design",
  "",
  "Module id `keepers-rollbox`, title \"Keeper's Rollbox\". Foundry VTT 14, Call of Cthulhu 7th Edition (CoC7) system.",
  "",
  "What the module does and the rules it follows. How the code is written is in [DEVELOPING.md](DEVELOPING.md); how to work on it is in [AGENTS.md](../AGENTS.md). The maintainer keeps this design as one file per feature (`design/<feature>.md`); each is one section below, in the same order, and code comments cite them by that name. When this document and the code disagree, ask in an issue before changing either.",
  "",
  "**Contents**",
  "",
  "<!-- contents -->"
];

/**
 * The design folder's files as one source document: the overview's sections first, then each feature file one heading
 * level down; links between the files become links to the feature's section.
 * @param {Record<string, string>} files each file's text, by name
 * @returns {string}
 */
export function designSource(files) {
  const titles = new Map();
  for (const name of DESIGN_FILES) {
    const title = /^# (.+)$/m.exec(files[name] ?? "")?.[1]?.trim();
    if (title) titles.set(name, title);
  }
  titles.set("OVERVIEW.md", DESIGN_INTRO[0].slice(2));
  const relink = (text) => text.replace(/\]\(([a-z-]+\.md|OVERVIEW\.md)(#[^)]*)?\)/gi, (whole, name) => {
    const title = titles.get(name);
    return title ? `](#${anchorOf(title)})` : whole;
  });
  const parts = DESIGN_FILES.map((name) => {
    const lines = String(files[name] ?? "").replace(/\r\n?/g, "\n").split("\n");
    if (name === "OVERVIEW.md") return lines.filter((line) => !/^# /.test(line)).join("\n");
    return lines.map((line) => (/^#{1,5} /.test(line) ? `#${line}` : line)).join("\n");
  });
  // The part documents sit beside the public copy, in the module's docs folder.
  return relink([DESIGN_INTRO.join("\n"), ...parts].join("\n\n")).replaceAll("modules/keepers-rollbox/docs/", "");
}

/** A source's text: the file, or the design folder joined into one document. */
function sourceText(sourceDir, source) {
  if (source !== "design") return readFileSync(join(sourceDir, source), "utf8");
  const dir = join(sourceDir, source);
  return designSource(Object.fromEntries(DESIGN_FILES.map((name) => [name, readFileSync(join(dir, name), "utf8")])));
}

/** The first line of every public copy. */
export const GENERATED_NOTE = "<!-- Written by tools/public-docs.mjs from the maintainer's source document: change that, not this file. -->";

const PROJECT_START = /^<!--\s*project-only\s*-->$/;
const PROJECT_END = /^<!--\s*\/project-only\s*-->$/;
const PUBLIC_START = /^<!--\s*public-only\s*$/;
const COMMENT_END = /^-->$/;
const CONTENTS = /^<!--\s*contents\s*-->$/;
const ABOUT = /^<!--\s*about:\s*(.*?)\s*-->$/;

/** GitHub's anchor for a heading: lower case, punctuation dropped, spaces as hyphens. */
export function anchorOf(heading) {
  return heading.trim().toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, "").replace(/\s/g, "-");
}

/**
 * The public copy of a source document (pure text in, text out).
 * @param {string} source the source's text
 * @returns {string} the public copy, with GENERATED_NOTE first and LF line ends
 * @throws {Error} on a marker that is opened and never closed
 */
export function publicCopy(source) {
  const lines = String(source).replace(/\r\n?/g, "\n").split("\n");
  const kept = [];
  let mode = "both";
  for (const [index, line] of lines.entries()) {
    const bare = line.trim();
    if (mode === "project") {
      if (PROJECT_END.test(bare)) mode = "both";
      continue;
    }
    if (mode === "public") {
      if (COMMENT_END.test(bare)) mode = "both";
      else kept.push(line);
      continue;
    }
    if (PROJECT_START.test(bare)) mode = "project";
    else if (PUBLIC_START.test(bare)) mode = "public";
    else if (PROJECT_END.test(bare)) throw new Error(`line ${index + 1}: /project-only without project-only`);
    else kept.push(line);
  }
  if (mode !== "both") throw new Error(`a ${mode}-only block is never closed`);
  const sections = [];
  for (const [index, line] of kept.entries()) {
    const heading = /^## (.+)$/.exec(line);
    if (!heading) continue;
    const about = ABOUT.exec(kept[index + 1]?.trim() ?? "");
    sections.push({ title: heading[1].trim(), about: about?.[1] ?? "" });
  }
  const contents = sections.map(({ title, about }) => `- [${title}](#${anchorOf(title)})${about ? `: ${about}` : ""}`);
  const out = kept.flatMap((line) => {
    if (CONTENTS.test(line.trim())) return contents;
    return ABOUT.test(line.trim()) ? [] : [line];
  });
  const text = withoutHistory(out.join("\n"));
  return `${GENERATED_NOTE}\n${text.replace(/\n{3,}/g, "\n\n").replace(/\n*$/, "\n")}`;
}

/** A date as the maintainer's notes write it, and a run of them ("2026-11-15 and 2026-11-17"). */
const DATE = String.raw`20\d\d-\d\d-\d\d`;
const DATES = String.raw`${DATE}(?:(?:,| and) ${DATE})*`;
/** A decision tag: "Void, 2026-11-15", "Void 2026-11-15", "Void's decision, 2026-11-13". */
const TAG = String.raw`Void(?:'s (?:decision|choice|words))?,? ${DATES}`;

/**
 * Who decided what and when, in the order applied: tags first (keeping the reason that follows one), then dated
 * checks, then any name left. The public copy states how things are; the history stays in the maintainer's source.
 */
const HISTORY = Object.freeze([
  [new RegExp(String.raw` ?\(${TAG}\)`, "g"), ""],
  [new RegExp(String.raw`\(${TAG}[:;,] *`, "g"), "("],
  [new RegExp(String.raw`[;,] *${TAG}\)`, "g"), ")"],
  [new RegExp(String.raw`([;,]) *${TAG}[:;,] *`, "g"), "$1 "],
  [new RegExp(String.raw`(confirmed|checked|seen at the table),? ${DATES}`, "gi"), "$1"],
  [new RegExp(String.raw` ?\(${DATES}\)`, "g"), ""],
  [new RegExp(String.raw`,? ${DATES}`, "g"), ""],
  [/Void to confirm at the table/g, "to be confirmed at the table"],
  [/for Void's approval|for Void to approve/g, "awaiting the maintainer's approval"],
  [/(^|[.!?|] +)Void's (console|table|look) check/gm, "$1A $2 check"],
  [/Void's (console|table|look) check/g, "a $1 check"],
  [/(^|[.!?|] +)Void\b/gm, "$1The maintainer"],
  [/\bVoid's\b/g, "the maintainer's"],
  [/\bVoid\b/g, "the maintainer"]
]);

/**
 * A public copy's text without the maintainer's history: decision tags, dates and names.
 * @param {string} text
 * @returns {string}
 */
export function withoutHistory(text) {
  return HISTORY.reduce((out, [pattern, replacement]) => out.replace(pattern, replacement), text);
}

/**
 * Each public copy as it should be, and whether the file on disk matches it (line ends ignored).
 * @param {string} [moduleDir]
 * @param {string} [sourceDir]
 * @returns {{copy: string, path: string, text: string, stale: boolean}[]|null} null when the sources aren't there
 */
export function publicDocs(moduleDir = MODULE_DIR, sourceDir = SOURCE_DIR) {
  if (!PUBLIC_DOCS.every(({ source }) => existsSync(join(sourceDir, source)))) return null;
  return PUBLIC_DOCS.map(({ source, copy }) => {
    const text = publicCopy(sourceText(sourceDir, source));
    const path = join(moduleDir, copy);
    const now = existsSync(path) ? readFileSync(path, "utf8").replace(/\r\n?/g, "\n") : null;
    return { copy, path, text, stale: now !== text };
  });
}

/** CLI: write the stale copies. */
function main() {
  const docs = publicDocs();
  if (!docs) {
    console.log("public-docs: the source documents aren't here (the public repository); nothing to write.");
    return;
  }
  for (const doc of docs) {
    if (doc.stale) writeFileSync(doc.path, doc.text);
    console.log(`public-docs: ${doc.copy} ${doc.stale ? "written" : "already up to date"}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
