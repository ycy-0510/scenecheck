import assert from "node:assert/strict";
import { test } from "node:test";
import { formatSourceLocation } from "../dist/index.js";

test("formats portable source references with available coordinates", () => {
  assert.equal(
    formatSourceLocation({
      file: "src/world/tunnel.ts",
      line: 183,
      column: 5,
      symbol: "buildTunnel",
    }),
    "src/world/tunnel.ts:183:5",
  );
  assert.equal(
    formatSourceLocation({ file: "src/world/tunnel.ts", line: 183 }),
    "src/world/tunnel.ts:183",
  );
  assert.equal(
    formatSourceLocation({ file: "src/world/tunnel.ts" }),
    "src/world/tunnel.ts",
  );
});
