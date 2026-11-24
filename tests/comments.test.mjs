// The code comment standard (docs/CODE-COMMENTS.md §7), checked on every file in scripts/.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";

const SCRIPTS = new URL("../scripts/", import.meta.url);
const PEOPLE = ["Void", "Voidworks", "Jared"];
const MAX_HEADER = 3;
const MAX_SUMMARY = 2;
const MAX_RATIO = 0.25;

const files = (pattern) => readdirSync(SCRIPTS, { recursive: true })
  .map((f) => String(f).replaceAll("\\", "/")).filter((f) => pattern.test(f)).sort();
const read = (f) => readFileSync(new URL(f, SCRIPTS), "utf8").replace(/\r\n?/g, "\n");

/**
 * Splits a script into its comments and, per line, whether it holds code.
 * @param {string} text
 * @returns {{comments: {kind: "line"|"block", start: number, lines: string[]}[], codeLines: Set<number>}}
 */
export function scan(text) {
  const comments = [];
  const codeLines = new Set();
  let line = 0;
  let last = "";
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    const next = text[i + 1];
    if (c === "\n") { line += 1; continue; }
    if (/\s/.test(c)) continue;
    if (c === "/" && next === "/") {
      const end = text.indexOf("\n", i);
      const stop = end < 0 ? text.length : end;
      comments.push({ kind: "line", start: line, lines: [text.slice(i + 2, stop)] });
      i = stop - 1;
      continue;
    }
    if (c === "/" && next === "*") {
      const end = text.indexOf("*/", i + 2);
      const stop = end < 0 ? text.length : end + 2;
      const body = text.slice(i, stop);
      comments.push({ kind: "block", start: line, lines: body.split("\n") });
      line += body.split("\n").length - 1;
      i = stop - 1;
      continue;
    }
    codeLines.add(line);
    if (c === "\"" || c === "'" || c === "`") {
      let j = i + 1;
      let depth = 0;
      for (; j < text.length; j += 1) {
        const d = text[j];
        if (d === "\\") { j += 1; continue; }
        if (d === "\n") { line += 1; codeLines.add(line); }
        if (c === "`" && d === "$" && text[j + 1] === "{") { depth += 1; j += 1; continue; }
        if (c === "`" && depth && d === "}") { depth -= 1; continue; }
        if (d === c && !depth) break;
      }
      i = j;
      last = "x";
      continue;
    }
    if (c === "/" && (last === "" || /[(,=:[!&|?{};+\-*%<>~^]/.test(last) || /\b(return|typeof|in|of)$/.test(text.slice(Math.max(0, i - 8), i).trimEnd()))) {
      let j = i + 1;
      let inClass = false;
      for (; j < text.length && text[j] !== "\n"; j += 1) {
        const d = text[j];
        if (d === "\\") { j += 1; continue; }
        if (d === "[") inClass = true;
        else if (d === "]") inClass = false;
        else if (d === "/" && !inClass) break;
      }
      i = j;
      last = "x";
      continue;
    }
    last = c;
  }
  return { comments, codeLines };
}

/** A block comment's text lines, without its opening, closing and bare `*` lines. */
const textLines = (comment) => comment.lines
  .map((l) => l.replace(/^\s*\/\*\*?/, "").replace(/\*\/\s*$/, "").replace(/^\s*\*\s?/, "").trim())
  .filter(Boolean);

/** Lines that hold comment text; with `prose`, JSDoc tag lines (`@param`, `@returns`…) left out. */
function commentLines(comments, { prose = false } = {}) {
  const lines = new Set();
  for (const comment of comments) {
    comment.lines.forEach((text, k) => {
      if (prose && /^\s*(\/\*\*?)?\s*\*?\s*@/.test(text)) return;
      if (/[\p{L}\p{N}]/u.test(text)) lines.add(comment.start + k);
    });
  }
  return lines;
}

const SOURCES = files(/\.js$/);

test("comments: a file header is at most 3 lines", () => {
  const offenders = SOURCES.flatMap((f) => {
    const { comments, codeLines } = scan(read(f));
    const first = comments[0];
    if (!first || first.kind !== "block" || [...codeLines].some((l) => l < first.start)) return [];
    const length = textLines(first).length;
    return length > MAX_HEADER ? [`${f}: ${length} lines`] : [];
  });
  assert.deepEqual(offenders, []);
});

test("comments: a JSDoc summary is at most 2 lines before its first @ tag", () => {
  const offenders = SOURCES.flatMap((f) => {
    const { comments, codeLines } = scan(read(f));
    return comments.filter((c, k) => c.lines[0].trimStart().startsWith("/**")
      && !(k === 0 && ![...codeLines].some((l) => l < c.start)))
      .flatMap((c) => {
        const lines = textLines(c);
        const tag = lines.findIndex((l) => l.startsWith("@"));
        const summary = tag < 0 ? lines.length : tag;
        return summary > MAX_SUMMARY ? [`${f}:${c.start + 1}: ${summary} lines`] : [];
      });
  });
  assert.deepEqual(offenders, []);
});

// The quarter is a goal (CODE-COMMENTS.md §6): files over it are listed, never failed. JSDoc tag lines aren't
// prose, so the quarter counts the rest.
test("comments: lists files whose comment prose is over a quarter of their code", (t) => {
  const over = SOURCES.flatMap((f) => {
    const { comments, codeLines } = scan(read(f));
    const ratio = commentLines(comments, { prose: true }).size / Math.max(1, codeLines.size);
    return ratio > MAX_RATIO ? [`${f}: ${Math.round(ratio * 100)}%`] : [];
  });
  t.diagnostic(over.length ? `over a quarter: ${over.join(", ")}` : "no file over a quarter");
});

test("comments: no date, person's name or build number in scripts/", () => {
  const names = new RegExp(`\\b(${PEOPLE.join("|")})\\b`);
  const date = /\b(19|20)\d\d-\d\d(-\d\d)?\b/;
  const build = /\b(0\.\d+\.\d+[a-z]?|[Ss]ession \d+[a-z]?|[Bb]uild 0\.\d+)\b/;
  const offenders = files(/\.(js|css)$/).flatMap((f) => {
    const text = read(f);
    const lines = text.split("\n");
    const inComments = f.endsWith(".js") ? commentLines(scan(text).comments) : null;
    return lines.map((line, i) => ({ line, i }))
      .filter(({ line, i }) => names.test(line) || date.test(line)
        || (build.test(line) && (!inComments || inComments.has(i))))
      .map(({ line, i }) => `${f}:${i + 1}: ${line.trim()}`);
  });
  assert.deepEqual(offenders, []);
});
