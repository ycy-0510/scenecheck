import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const cli = fileURLToPath(new URL("../dist/cli.js", import.meta.url));
const config = fileURLToPath(new URL("./fixtures/pose-assertion.config.ts", import.meta.url));
const positionTolerance = 0.001;
const rotationToleranceDegrees = 0.001;

test("validate accepts a reviewed frozen pose assertion in config", async () => {
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
      unit: string;
      actual: {
        positionError: number;
        rotationErrorDegrees: number;
      };
    }>;
  };

  assert.equal(stderr, "");
  assert.equal(result.ok, true);
  assert.equal(result.passed, 1);
  assert.equal(result.failed, 0);
  assert.equal(result.results[0]?.type, "pose");
  assert.equal(result.results[0]?.unit, "pose");
  assert.ok(
    (result.results[0]?.actual.positionError ?? Number.POSITIVE_INFINITY) <=
      positionTolerance,
  );
  assert.ok(
    (result.results[0]?.actual.rotationErrorDegrees ?? Number.POSITIVE_INFINITY) <=
      rotationToleranceDegrees,
  );
});
