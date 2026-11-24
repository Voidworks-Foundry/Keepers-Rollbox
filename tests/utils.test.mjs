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

/**
 * People named in the project's documents (the maintainer and the players who test at his table). Characters from
 * the demo world (Cecil, Helen, …) are not people and may appear in examples.
 */
test("only utils.js types the module id as a string in code", () => {
  const offenders = scriptFiles()
    .filter((f) => f !== "utils.js" && /["'`]keepers-rollbox/.test(readFileSync(SCRIPTS + f, "utf8")));
  assert.deepEqual(offenders, []);
});

test("option: a registered setting's value; an unregistered one's declared default", () => {
  const env = makeEnv({ values: { rollboxEnabled: false } });
  env.registered.rollboxEnabled = { default: true };
  U.declareSettings([{ key: "rollboxTestPlanned", scope: "user", type: Number, default: 3, section: "test",
    label: "Planned", note: U.PERSONAL }]);
  assert.equal(U.option("rollboxEnabled"), false);
  assert.equal(U.option("rollboxTestPlanned"), 3);
  assert.equal(U.option("rollboxNeverDeclared"), undefined);
});

test("L3: flagsRemoved uses Foundry v14's ForcedDeletion for each flag; the deprecated -= key only without it", () => {
  class ForcedDeletion {}
  const before = globalThis.foundry;
  globalThis.foundry = { data: { operators: { ForcedDeletion } } };
  try {
    const removed = U.flagsRemoved("standingBy", "actsRound");
    assert.deepEqual(Object.keys(removed), ["flags.keepers-rollbox.standingBy", "flags.keepers-rollbox.actsRound"]);
    assert.ok(Object.values(removed).every((value) => value instanceof ForcedDeletion));
    globalThis.foundry = undefined;
    assert.deepEqual(U.flagsRemoved("maneuverOff"), { "flags.keepers-rollbox.-=maneuverOff": null });
  } finally {
    globalThis.foundry = before;
  }
});
