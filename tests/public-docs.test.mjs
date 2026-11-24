import assert from "node:assert/strict";
import { test } from "node:test";
import { designSource, publicCopy, publicDocs } from "../tools/public-docs.mjs";

test("publicCopy: project-only blocks left out, public-only text kept, the contents list made from the kept sections", () => {
  const source = [
    "# Guide", "<!-- public-only", "Public intro.", "-->", "<!-- contents -->",
    "## Setup (npm)", "<!-- about: the commands -->", "Run it.",
    "<!-- project-only -->", "## Changelog", "Private.", "<!-- /project-only -->"
  ].join("\r\n");
  const copy = publicCopy(source).split("\n").slice(1).join("\n");
  assert.equal(copy, "# Guide\nPublic intro.\n- [Setup (npm)](#setup-npm): the commands\n## Setup (npm)\nRun it.\n");
  assert.throws(() => publicCopy("<!-- project-only -->\nnever closed"));
});

test("public docs: DEVELOPING.md and DESIGN.md match their sources (run `npm run public-docs` after changing a source)", (t) => {
  const docs = publicDocs();
  if (!docs) return t.skip("the source documents aren't in this repository");
  assert.deepEqual(docs.filter((doc) => doc.stale).map((doc) => doc.copy), []);
});

test("designSource: the overview's sections first, each feature one heading level down, links between files to sections", () => {
  const text = designSource({
    "OVERVIEW.md": "# Rollbox\n## Features\n- [Panel](panel.md)",
    "panel.md": "# Panel\n## Summary\nSee [the overview](OVERVIEW.md#names) and `modules/keepers-rollbox/docs/panel.md`."
  });
  assert.match(text, /\n## Features\n- \[Panel\]\(#panel\)/);
  assert.match(text, /\n## Panel\n### Summary\nSee \[the overview\]\(#keepers-rollbox--design\) and `panel\.md`\./);
  assert.doesNotMatch(text, /^# Rollbox$/m);
});
