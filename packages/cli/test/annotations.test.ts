import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const cli = fileURLToPath(new URL("../dist/cli.js", import.meta.url));
const fixture = fileURLToPath(new URL("./fixtures/annotation-scene.ts", import.meta.url));

test("built CLI lists annotations with resolved attached world transforms", async () => {
  const { stdout, stderr } = await execFileAsync(process.execPath, [
    cli,
    "annotations",
    fixture,
  ]);
  const result = JSON.parse(stdout) as {
    total: number;
    annotations: Array<{
      id: string;
      followsAttachment: boolean;
      worldTransform: { position: number[] };
      localTransform?: { position: number[] };
    }>;
  };

  assert.equal(stderr, "");
  assert.equal(result.total, 1);
  assert.equal(result.annotations[0]?.id, "target");
  assert.equal(result.annotations[0]?.followsAttachment, true);
  assert.deepEqual(result.annotations[0]?.worldTransform.position.map(round), [8, 0, 0]);
  assert.deepEqual(result.annotations[0]?.localTransform?.position, [0, 0, -2]);
});

test("annotations --id returns only the requested marker", async () => {
  const { stdout } = await execFileAsync(process.execPath, [
    cli,
    "annotations",
    fixture,
    "--id",
    "target",
  ]);
  const result = JSON.parse(stdout) as { total: number; annotations: Array<{ id: string }> };

  assert.equal(result.total, 1);
  assert.deepEqual(result.annotations.map((item) => item.id), ["target"]);
});

test("measure can use annotation references directly", async () => {
  const { stdout } = await execFileAsync(process.execPath, [
    cli,
    "measure",
    "distance",
    fixture,
    "--from",
    "tunnel",
    "--to",
    "annotation:target",
  ]);
  const result = JSON.parse(stdout) as { distance: number };

  assert.equal(result.distance, 2);
});

test("missing requested annotation fails clearly", async () => {
  await assert.rejects(
    () =>
      execFileAsync(process.execPath, [
        cli,
        "annotations",
        fixture,
        "--id",
        "missing",
      ]),
    (error: unknown) => {
      const stderr = (error as { stderr?: string }).stderr ?? "";
      return stderr.includes('annotation not found: "missing"');
    },
  );
});

function round(value: number): number {
  return Math.round(value * 1e9) / 1e9;
}
