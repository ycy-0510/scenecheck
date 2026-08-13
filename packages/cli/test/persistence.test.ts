import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const cli = fileURLToPath(new URL("../dist/cli.js", import.meta.url));
const config = fileURLToPath(new URL("./fixtures/persistence.config.ts", import.meta.url));

test("validate loads versioned persisted annotations relative to config", async () => {
  const { stdout, stderr } = await execFileAsync(process.execPath, [
    cli,
    "validate",
    "--config",
    config,
    "--json",
  ]);
  const result = JSON.parse(stdout) as {
    ok: boolean;
    passed: number;
    failed: number;
    results: Array<{ id: string; pass: boolean }>;
  };

  assert.equal(stderr, "");
  assert.equal(result.ok, true);
  assert.equal(result.passed, 1);
  assert.equal(result.failed, 0);
  assert.deepEqual(result.results.map((item) => [item.id, item.pass]), [
    ["persisted-target-distance", true],
  ]);
});
