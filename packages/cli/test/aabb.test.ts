import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const cli = fileURLToPath(new URL("../dist/cli.js", import.meta.url));
const fixture = fileURLToPath(new URL("./fixtures/aabb-scene.ts", import.meta.url));
const config = fileURLToPath(new URL("./fixtures/aabb.config.ts", import.meta.url));

test("built CLI measures AABB clearance and axis gap", async () => {
  const { stdout, stderr } = await execFileAsync(process.execPath, [
    cli,
    "measure",
    "aabb",
    fixture,
    "--from",
    "box-a",
    "--to",
    "box-b",
  ]);
  const result = JSON.parse(stdout) as {
    clearance: number;
    axisGap: number[];
    intersects: boolean;
  };

  assert.equal(stderr, "");
  assert.equal(result.clearance, 3);
  assert.deepEqual(result.axisGap, [3, 0, 0]);
  assert.equal(result.intersects, false);
});

test("built CLI reports bounds size without rendering", async () => {
  const { stdout } = await execFileAsync(process.execPath, [
    cli,
    "measure",
    "bounds",
    fixture,
    "--node",
    "box-a",
  ]);
  const result = JSON.parse(stdout) as {
    size: number[];
    center: number[];
  };

  assert.deepEqual(result.size, [2, 2, 2]);
  assert.deepEqual(result.center, [0, 0, 0]);
});

test("validate computes AABBs automatically when an assertion requires them", async () => {
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
    results: Array<{ type: string; actual: number | boolean }>;
  };

  assert.equal(stderr, "");
  assert.equal(result.ok, true);
  assert.equal(result.passed, 2);
  assert.equal(result.failed, 0);
  assert.deepEqual(result.results.map((item) => item.type), [
    "aabb-clearance",
    "aabb-intersection",
  ]);
  assert.deepEqual(result.results.map((item) => item.actual), [3, false]);
});
