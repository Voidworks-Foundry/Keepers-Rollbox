/**
 * Keeps the agents' index true: docs/TESTS.md lists every test file and each of its patterns runs exactly one test,
 * every part folder has its document, every path in AGENTS.md's "Find your way" table exists, and no document in
 * docs/ carries a decision tag or a date. Reads files only; no Foundry mocks.
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

/** A string literal in a test file's source, as the runner reads it. */
const literal = (text) => (text.startsWith("`") ? text.slice(1, -1) : JSON.parse(text.startsWith("'")
  ? `"${text.slice(1, -1).replace(/\\'/g, "'").replace(/"/g, '\\"')}"` : text));
const STRING = String.raw`"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\`[^\`$]*\``;

/** Every test and group name in a test file: the first argument of test(), it() or describe(), joined parts included. */
function testNames(file) {
  const source = read(`tests/${file}`);
  const call = new RegExp(`(?<![.\\w$])(?:test|it|describe)\\(\\s*((?:${STRING})(?:\\s*\\+\\s*(?:${STRING}))*)\\s*,`, "g");
  return [...source.matchAll(call)].map((m) => [...m[1].matchAll(new RegExp(STRING, "g"))].map((s) => literal(s[0])).join(""));
}

/** Each file's section of docs/TESTS.md, with the patterns in its table. */
function patternsByFile() {
  const index = read("docs/TESTS.md");
  return [...index.matchAll(/^## (\S+\.test\.mjs)\n([\s\S]*?)(?=^## |(?![\s\S]))/gm)]
    .map(([, file, body]) => [file, [...body.matchAll(/^\| `([^`]+)` \|/gm)].map((m) => m[1])]);
}

test("every docs/TESTS.md pattern matches exactly one test (or one group) in its file", () => {
  const wrong = [];
  for (const [file, patterns] of patternsByFile()) {
    const names = testNames(file);
    for (const pattern of patterns) {
      const hits = names.filter((name) => new RegExp(pattern).test(name)).length;
      if (hits !== 1) wrong.push(`${file}: \`${pattern}\` matches ${hits}`);
    }
  }
  assert.deepEqual(wrong, []);
});

test("every part folder under scripts/ has its document in docs/, each flyout folder its <name>-flyout.md", () => {
  const folders = (path) => readdirSync(join(ROOT, path), { withFileTypes: true }).filter((d) => d.isDirectory());
  const docs = [...folders("scripts").map((d) => `docs/${d.name}.md`),
    ...folders("scripts/flyouts").map((d) => `docs/${d.name}-flyout.md`)];
  assert.deepEqual(docs.filter((p) => !existsSync(join(ROOT, p))), []);
});

test("no document in docs/ carries a decision tag or a date (the shipped docs state how things are, not their history)", () => {
  const files = (dir) => readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((d) => (d.isDirectory()
    ? files(`${dir}/${d.name}`) : d.name.endsWith(".md") ? [`${dir}/${d.name}`] : []));
  const dated = files("docs").filter((path) => /\(Void|\b20\d\d-\d\d-\d\d\b/.test(read(path)));
  assert.deepEqual(dated, []);
});

test("every path in AGENTS.md's \"Find your way\" table exists", () => {
  const paths = pathsIn(findYourWay());
  assert.ok(paths.length > 10, "the table names its documents");
  assert.deepEqual(paths.filter((p) => !existsSync(join(ROOT, p))), []);
});
