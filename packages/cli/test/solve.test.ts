import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const cli = fileURLToPath(new URL("../dist/cli.js", import.meta.url));
const fixture = fileURLToPath(new URL("./fixtures/assembly-scene.ts", import.meta.url));
const shearFixture = fileURLToPath(
  new URL("./fixtures/assembly-shear-scene.ts", import.meta.url),
);

const solveArgs = [
  "solve",
  "attachment",
  fixture,
  "--module",
  "exit",
  "--anchor",
  "mount",
  "--target",
  "tunnel",
  "--socket",
  "emergency-right",
];

test("built CLI solves one root transform without returning matrix noise by default", async () => {
  const { stdout, stderr } = await execFileAsync(process.execPath, [cli, ...solveArgs]);
  const result = JSON.parse(stdout) as {
    safeToApplyTRS: boolean;
    desiredLocalTransform: {
      position: number[];
      rotation: number[];
      matrix?: number[];
    };
    delta: { localPosition: number[]; localAngleDegrees: number };
  };

  assert.equal(stderr, "");
  assert.equal(result.safeToApplyTRS, true);
  assert.deepEqual(result.desiredLocalTransform.position.map(round), [4, 0, -5]);
  assert.equal(result.desiredLocalTransform.matrix, undefined);
  assert.deepEqual(result.delta.localPosition.map(round), [4, 0, -5]);
  assert.ok(Math.abs(result.delta.localAngleDegrees - 90) < 1e-8);
});

test("solve attachment --full includes exact matrix solution", async () => {
  const { stdout } = await execFileAsync(process.execPath, [
    cli,
    ...solveArgs,
    "--full",
  ]);
  const result = JSON.parse(stdout) as {
    desiredLocalTransform: { matrix?: number[] };
    desiredWorldTransform: { matrix?: number[] };
  };

  assert.equal(result.desiredLocalTransform.matrix?.length, 16);
  assert.equal(result.desiredWorldTransform.matrix?.length, 16);
});

test("unsafe shear solution is returned with exit code 2 instead of being silently applied", async () => {
  await assert.rejects(
    () =>
      execFileAsync(process.execPath, [
        cli,
        "solve",
        "attachment",
        shearFixture,
        "--module",
        "exit",
        "--anchor",
        "mount",
        "--target",
        "tunnel",
        "--socket",
        "emergency-right",
      ]),
    (error: unknown) => {
      const failure = error as { code?: number; stdout?: string; stderr?: string };
      const result = JSON.parse(failure.stdout ?? "{}") as {
        safeToApplyTRS?: boolean;
        diagnostics?: { localShear?: number };
      };

      assert.equal(failure.code, 2);
      assert.equal(failure.stderr, "");
      assert.equal(result.safeToApplyTRS, false);
      assert.ok((result.diagnostics?.localShear ?? 0) > 1e-4);
      return true;
    },
  );
});

test("solver requires named module anchor target and socket", async () => {
  await assert.rejects(
    () => execFileAsync(process.execPath, [cli, "solve", "attachment", fixture]),
    (error: unknown) => {
      const stderr = (error as { stderr?: string }).stderr ?? "";
      return stderr.includes("requires --module, --anchor, --target, --socket");
    },
  );
});

function round(value: number): number {
  return Math.round(value * 1e9) / 1e9;
}
