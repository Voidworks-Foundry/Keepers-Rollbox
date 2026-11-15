import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import * as U from "../scripts/utils.js";
import { makeEnv } from "./mocks.mjs";

const SCRIPTS = fileURLToPath(new URL("../scripts/", import.meta.url));
const scriptFiles = () => readdirSync(SCRIPTS, { recursive: true }).filter((f) => f.endsWith(".js"));

test("MODULE_ID and scope notes", () => {
  assert.equal(U.MODULE_ID, "keepers-rollbox");
  assert.equal(U.KEEPER, "Keeper setting, applies to everyone.");
  assert.equal(U.PERSONAL, "Personal setting, affects only your screen.");
});

test("escapeHtml: markup, quotes, null", () => {
  assert.equal(U.escapeHtml(`<b>"Tom" & 'Jo'</b>`), "&lt;b&gt;&quot;Tom&quot; &amp; &#39;Jo&#39;&lt;/b&gt;");
  assert.equal(U.escapeHtml(null), "");
  assert.equal(U.escapeHtml(undefined), "");
});

test("isKeeper: GM true, player false", () => {
  makeEnv({ isGM: true }); assert.equal(U.isKeeper(), true);
  makeEnv({ isGM: false }); assert.equal(U.isKeeper(), false);
});

test("no console.log or debugger in scripts/", () => {
  const offenders = scriptFiles().filter((f) => /console\.log|\bdebugger\b/.test(readFileSync(SCRIPTS + f, "utf8")));
  assert.deepEqual(offenders, []);
});

test("only utils.js types the module id as a string in code", () => {
  const offenders = scriptFiles()
    .filter((f) => f !== "utils.js" && /["'`]keepers-rollbox/.test(readFileSync(SCRIPTS + f, "utf8")));
  assert.deepEqual(offenders, []);
});
