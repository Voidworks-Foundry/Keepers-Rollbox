// Release tools (tools/release-tools.mjs): package, smoke test and release check, on a small made-up module
// written to a temp folder, so the tests don't depend on Rollbox's own files.
import { after, describe, test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { strToU8, unzipSync, zipSync } from "fflate";
import { packageModule, releaseCheck, smokeTest } from "../tools/release-tools.mjs";

const ID = "test-module";
const VERSION = "1.2.3";
const temp = mkdtempSync(join(tmpdir(), "release-tools-"));
after(() => rmSync(temp, { recursive: true, force: true }));

const GOOD_FILES = {
  "module.json": JSON.stringify({
    id: ID, title: "Test", version: VERSION,
    esmodules: ["scripts/main.js"], styles: ["scripts/part/part.css"],
  }),
  "scripts/main.js": 'import { TEMPLATE } from "./part/index.js";\n// a comment may say console.log or debugger\nexport { TEMPLATE };\n',
  "scripts/part/index.js": "const MODULE_ID = \"test-module\";\nexport const TEMPLATE = `modules/${MODULE_ID}/scripts/part/part.hbs`;\n",
  "scripts/part/part.hbs": "<div>{{name}}</div>\n",
  "scripts/part/part.css": ".test-part { color: red; }\n",
  "CHANGELOG.md": `# Changelog\n\n## ${VERSION}\n\n- New.\n\n## 1.2.2\n\n- Old.\n`,
  "tests/part.test.mjs": "export {};\n",
  "docs/part.md": "# part\n",
  "tools/x.mjs": "export {};\n",
  "media/clip.webp": "RIFF",
  "README.md": "# Test\n",
  "package.json": "{}",
  "package-lock.json": "{}",
  "node_modules/dep/index.js": "export {};\n",
};

let fixtureCount = 0;

/** Writes a module folder from GOOD_FILES with `changes` applied (null deletes a file); returns its path. */
function makeModule(changes = {}) {
  const dir = join(temp, `module-${++fixtureCount}`);
  for (const [path, content] of Object.entries({ ...GOOD_FILES, ...changes })) {
    if (content === null) continue;
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), content);
  }
  return dir;
}

/** Packages a good module, then rewrites its zip with `edit(entries)` applied; returns the new zip's path. */
function editedZip(edit, name) {
  const { zipPath } = packageModule(makeModule());
  const entries = unzipSync(readFileSync(zipPath));
  edit(entries);
  const out = join(temp, `zip-${++fixtureCount}`, name ?? basename(zipPath));
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, zipSync(entries));
  return out;
}

function assertProblem(problems, pattern) {
  assert.ok(problems.some((p) => pattern.test(p)), `expected a problem matching ${pattern}, got: ${JSON.stringify(problems)}`);
}

describe("package", () => {
  test("zips module.json and scripts/ in one top folder named the id, and nothing that must not ship", () => {
    const { zipPath } = packageModule(makeModule());
    assert.equal(basename(zipPath), `${ID}-v${VERSION}.zip`);
    const names = Object.keys(unzipSync(readFileSync(zipPath))).filter((n) => !n.endsWith("/"));
    assert.deepEqual(names.sort(), [
      `${ID}/module.json`, `${ID}/scripts/main.js`, `${ID}/scripts/part/index.js`,
      `${ID}/scripts/part/part.css`, `${ID}/scripts/part/part.hbs`,
    ]);
  });
});

describe("smoke", () => {
  test("passes on a good zip", () => {
    const { zipPath } = packageModule(makeModule());
    assert.deepEqual(smokeTest(zipPath).problems, []);
  });

  test("fails on a zip with tests/ inside", () => {
    const zip = editedZip((e) => { e[`${ID}/tests/part.test.mjs`] = strToU8("export {};"); });
    assertProblem(smokeTest(zip).problems, /Must not ship: test-module\/tests\//);
  });

  test("fails on a zip with docs/ inside", () => {
    const zip = editedZip((e) => { e[`${ID}/docs/part.md`] = strToU8("# part"); });
    assertProblem(smokeTest(zip).problems, /Must not ship: test-module\/docs\//);
  });

  test("fails when a script module.json lists is missing", () => {
    const zip = editedZip((e) => { delete e[`${ID}/scripts/main.js`]; });
    assertProblem(smokeTest(zip).problems, /lists scripts\/main\.js \(esmodules\)/);
  });

  test("fails when a script that another imports is missing", () => {
    const zip = editedZip((e) => { delete e[`${ID}/scripts/part/index.js`]; });
    assertProblem(smokeTest(zip).problems, /scripts\/main\.js imports \.\/part\/index\.js/);
  });

  test("fails when a template a script uses is missing", () => {
    const zip = editedZip((e) => { delete e[`${ID}/scripts/part/part.hbs`]; });
    assertProblem(smokeTest(zip).problems, /uses the template scripts\/part\/part\.hbs/);
  });

  test("fails when the top folder is not the module id", () => {
    const zip = editedZip((e) => {
      for (const name of Object.keys(e)) {
        e[name.replace(`${ID}/`, "wrong-name/")] = e[name];
        delete e[name];
      }
    });
    assertProblem(smokeTest(zip).problems, /top folder "wrong-name" is not the module id/);
  });

  test("fails when module.json's version doesn't match the zip name", () => {
    const zip = editedZip(() => {}, `${ID}-v9.9.9.zip`);
    assertProblem(smokeTest(zip).problems, /makes it test-module-v1\.2\.3\.zip/);
  });

  test("fails when a script has a syntax error", () => {
    const zip = editedZip((e) => { e[`${ID}/scripts/part/index.js`] = strToU8("export const x = ;\n"); });
    assertProblem(smokeTest(zip).problems, /scripts\/part\/index\.js fails the syntax check/);
  });
});

describe("release-check", () => {
  test("passes on a good module and zip", () => {
    assert.deepEqual(releaseCheck(makeModule()).problems, []);
  });

  test("builds a fresh zip first, so an old zip with the same version can't pass", () => {
    const dir = makeModule();
    packageModule(dir);
    writeFileSync(join(dir, "scripts/part/index.js"), "export const x = ;\n");
    assertProblem(releaseCheck(dir).problems, /scripts\/part\/index\.js fails the syntax check/);
  });

  test("fails on a console.log or debugger left in scripts/", () => {
    const dir = makeModule({
      "scripts/part/index.js": 'export const x = 1;\nconsole.log("here");\n  debugger;\n',
    });
    const { problems } = releaseCheck(dir);
    assertProblem(problems, /scripts\/part\/index\.js:2: console\.log/);
    assertProblem(problems, /scripts\/part\/index\.js:3: debugger/);
  });

  test("fails when the newest changelog entry is not module.json's version", () => {
    const dir = makeModule({ "CHANGELOG.md": "# Changelog\n\n## 1.2.4\n\n## 1.2.3\n" });
    assertProblem(releaseCheck(dir).problems, /newest CHANGELOG\.md entry is 1\.2\.4/);
  });

  test("fails when module.json's version appears twice in the changelog", () => {
    const dir = makeModule({ "CHANGELOG.md": `# Changelog\n\n## ${VERSION}\n\n## ${VERSION}\n` });
    assertProblem(releaseCheck(dir).problems, /2 entries for 1\.2\.3/);
  });
});
