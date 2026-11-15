/**
 * Keeps the agents' index true: docs/TESTS.md lists every test file, every part folder has its document, and
 * every path in AGENTS.md's "Find your way" table exists. Reads files only; no Foundry mocks.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const read = (path) => readFileSync(join(ROOT, path), "utf8");

/** The "## Find your way" section of AGENTS.md, up to the next "## " heading. */
function findYourWay() {
  const text = read("AGENTS.md");
  const start = text.indexOf("## Find your way");
  assert.ok(start >= 0, "AGENTS.md has no \"## Find your way\" section");
  const end = text.indexOf("\n## ", start + 1);
  return text.slice(start, end < 0 ? undefined : end);
}

/**
 * Paths the section names: link targets (without their #anchor) and code spans that look like a path. Anything
 * with a placeholder such as <part> is a pattern, not a path, and is left out; so are web links.
 */
function pathsIn(section) {
  const links = [...section.matchAll(/\]\(([^)\s]+)\)/g)].map((m) => m[1].split("#")[0]);
  const spans = [...section.matchAll(/`([^`\s]+)`/g)].map((m) => m[1]).filter((s) => s.includes("/"));
  return [...new Set([...links, ...spans])].filter((p) => p && !p.includes("<") && !/^[a-z]+:/i.test(p));
}

test("docs/TESTS.md has a section for every test file", () => {
  const index = read("docs/TESTS.md");
  const files = readdirSync(join(ROOT, "tests")).filter((f) => f.endsWith(".test.mjs"));
  assert.deepEqual(files.filter((f) => !index.includes(`## ${f}`)), []);
});

test("every part folder under scripts/ has its document in docs/", () => {
  const parts = readdirSync(join(ROOT, "scripts"), { withFileTypes: true }).filter((d) => d.isDirectory());
  assert.deepEqual(parts.map((d) => `docs/${d.name}.md`).filter((p) => !existsSync(join(ROOT, p))), []);
});

test("every path in AGENTS.md's \"Find your way\" table exists", () => {
  const paths = pathsIn(findYourWay());
  assert.ok(paths.length > 10, "the table names its documents");
  assert.deepEqual(paths.filter((p) => !existsSync(join(ROOT, p))), []);
});
