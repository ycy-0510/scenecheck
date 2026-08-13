import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const cli = fileURLToPath(new URL("../dist/cli.js", import.meta.url));
const config = fileURLToPath(new URL("./fixtures/collider.config.ts", import.meta.url));

test("validate runs exact collider assertions without requiring visual bounds", async () => {
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
    results: Array<{
      type: string;
      actual: boolean | string;
      unit: string;
    }>;
  };

  assert.equal(stderr, "");
  assert.equal(result.ok, true);
  assert.equal(result.passed, 3);
  assert.equal(result.failed, 0);
  assert.deepEqual(
    result.results.map((item) => item.type),
    ["collider-intersection", "collider-intersection", "collider-intersection"],
  );
  assert.deepEqual(result.results.map((item) => item.actual), [true, false, false]);
  assert.deepEqual(result.results.map((item) => item.unit), [
    "boolean",
    "boolean",
    "boolean",
  ]);
});
