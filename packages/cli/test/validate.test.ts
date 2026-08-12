import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { dirname } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const cli = fileURLToPath(new URL("../dist/cli.js", import.meta.url));
const passingConfig = fileURLToPath(
  new URL("./fixtures/scenecheck.config.ts", import.meta.url),
);
const failingConfig = fileURLToPath(
  new URL("./fixtures/scenecheck.fail.config.json", import.meta.url),
);

test("validate loads a TypeScript config and returns structured passing results", async () => {
  const { stdout, stderr } = await execFileAsync(process.execPath, [
    cli,
    "validate",
    "--config",
    passingConfig,
    "--json",
  ]);
  const result = JSON.parse(stdout) as {
    ok: boolean;
    total: number;
    passed: number;
    failed: number;
  };

  assert.equal(stderr, "");
  assert.deepEqual(result, {
    ...result,
    ok: true,
    total: 2,
    passed: 2,
    failed: 0,
  });
});

test("validate discovers scenecheck.config.ts and resolves provider paths relative to it", async () => {
  const { stdout } = await execFileAsync(
    process.execPath,
    [cli, "validate", "--json"],
    { cwd: dirname(passingConfig) },
  );
  const result = JSON.parse(stdout) as { ok: boolean };
  assert.equal(result.ok, true);
});

test("validate exits non-zero and still emits JSON when an assertion fails", async () => {
  await assert.rejects(
    () =>
      execFileAsync(process.execPath, [
        cli,
        "validate",
        "--config",
        failingConfig,
        "--json",
      ]),
    (error: unknown) => {
      const failure = error as { code?: number; stdout?: string; stderr?: string };
      const result = JSON.parse(failure.stdout ?? "{}") as {
        ok?: boolean;
        failed?: number;
        results?: Array<{ id: string; pass: boolean }>;
      };

      assert.equal(failure.code, 1);
      assert.equal(failure.stderr, "");
      assert.equal(result.ok, false);
      assert.equal(result.failed, 1);
      assert.deepEqual(result.results?.[0], {
        ...result.results?.[0],
        id: "edge-too-far",
        pass: false,
      });
      return true;
    },
  );
});

test("human validation output is concise and CI-readable", async () => {
  await assert.rejects(
    () =>
      execFileAsync(process.execPath, [
        cli,
        "validate",
        "--config",
        failingConfig,
      ]),
    (error: unknown) => {
      const stdout = (error as { stdout?: string }).stdout ?? "";
      assert.match(stdout, /^FAIL edge-too-far:/m);
      assert.match(stdout, /SceneCheck: 0 passed, 1 failed, 1 total/);
      return true;
    },
  );
});
