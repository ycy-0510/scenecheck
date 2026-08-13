import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const cli = fileURLToPath(new URL("../dist/cli.js", import.meta.url));
const fixture = fileURLToPath(new URL("./fixtures/collider-scene.ts", import.meta.url));

test("built CLI measures exact registered collider relation without bounds", async () => {
  const { stdout, stderr } = await execFileAsync(process.execPath, [
    cli,
    "measure",
    "collider",
    fixture,
    "--from",
    "collider:car#body",
    "--to",
    "collider:gate#post",
  ]);
  const result = JSON.parse(stdout) as {
    status: string;
    pair: string;
    intersects: boolean;
    strictlyOverlaps: boolean;
    touching: boolean;
  };

  assert.equal(stderr, "");
  assert.equal(result.status, "exact");
  assert.equal(result.pair, "box-box");
  assert.equal(result.intersects, true);
  assert.equal(result.strictlyOverlaps, false);
  assert.equal(result.touching, true);
});

test("built CLI reports separated box-sphere collider relation", async () => {
  const { stdout } = await execFileAsync(process.execPath, [
    cli,
    "measure",
    "collider",
    fixture,
    "--from",
    "collider:car#body",
    "--to",
    "collider:sensor#range",
  ]);
  const result = JSON.parse(stdout) as {
    status: string;
    pair: string;
    intersects: boolean;
  };

  assert.equal(result.status, "exact");
  assert.equal(result.pair, "sphere-box");
  assert.equal(result.intersects, false);
});
