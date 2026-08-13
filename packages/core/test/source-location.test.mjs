import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeSourceLocation } from "../dist/index.js";

test("source locations normalize portable paths and preserve 1-based coordinates", () => {
  assert.deepEqual(
    normalizeSourceLocation({
      file: " src\\world\\tunnel.ts ",
      line: 42,
      column: 7,
      symbol: " buildTunnel ",
    }),
    {
      file: "src/world/tunnel.ts",
      line: 42,
      column: 7,
      symbol: "buildTunnel",
    },
  );
});

test("source locations reject empty files and invalid source coordinates", () => {
  assert.throws(() => normalizeSourceLocation({ file: "  " }), /file cannot be empty/i);
  assert.throws(
    () => normalizeSourceLocation({ file: "src/a.ts", line: 0 }),
    /line must be a positive integer/i,
  );
  assert.throws(
    () => normalizeSourceLocation({ file: "src/a.ts", column: 1.5 }),
    /column must be a positive integer/i,
  );
});
