import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { loadSceneIRFromProvider, resolveProviderPath } from "../src/dump.ts";

const execFileAsync = promisify(execFile);
const fixture = fileURLToPath(new URL("./fixtures/basic-scene.ts", import.meta.url));
const cli = fileURLToPath(new URL("../dist/cli.js", import.meta.url));

test("loads a TypeScript Three.js scene provider into Scene IR", async () => {
  const scene = await loadSceneIRFromProvider(fixture);

  assert.deepEqual(scene.roots, ["Root"]);
  assert.equal(scene.nodes.Root?.children[0], "box");
  assert.deepEqual(scene.nodes.box?.worldTransform.position, [3, 0, 0]);
  assert.deepEqual(scene.nodes.box?.bounds, {
    min: [2, -2, -3],
    max: [4, 2, 3],
  });
});

test("can disable bounds for lower-cost dumps", async () => {
  const scene = await loadSceneIRFromProvider(fixture, { includeBounds: false });

  assert.equal(scene.nodes.Root?.bounds, undefined);
  assert.equal(scene.nodes.box?.bounds, undefined);
});

test("reports a missing explicit provider clearly", async () => {
  await assert.rejects(
    () => resolveProviderPath("does-not-exist.scene.ts", process.cwd()),
    /Scene provider not found/,
  );
});

test("built CLI emits parseable compact Scene IR JSON", async () => {
  const { stdout, stderr } = await execFileAsync(process.execPath, [cli, "dump", fixture]);
  const scene = JSON.parse(stdout) as {
    roots: string[];
    nodes: Record<string, { worldTransform: { position: number[] } }>;
  };

  assert.equal(stderr, "");
  assert.deepEqual(scene.roots, ["Root"]);
  assert.deepEqual(scene.nodes.box?.worldTransform.position, [3, 0, 0]);
});

test("built CLI emits a compact scene summary", async () => {
  const { stdout } = await execFileAsync(process.execPath, [cli, "summary", fixture]);
  const summary = JSON.parse(stdout) as {
    nodeCount: number;
    types: Record<string, number>;
  };

  assert.equal(summary.nodeCount, 2);
  assert.deepEqual(summary.types, { Group: 1, Mesh: 1 });
});

test("built CLI queries a compact single node without dumping matrices or metadata", async () => {
  const { stdout } = await execFileAsync(process.execPath, [
    cli,
    "query",
    fixture,
    "--id",
    "box",
  ]);
  const result = JSON.parse(stdout) as {
    total: number;
    nodes: Array<{
      id: string;
      worldTransform: { position: number[]; matrix?: number[] };
      metadata?: unknown;
    }>;
  };

  assert.equal(result.total, 1);
  assert.equal(result.nodes[0]?.id, "box");
  assert.deepEqual(result.nodes[0]?.worldTransform.position, [3, 0, 0]);
  assert.equal(result.nodes[0]?.worldTransform.matrix, undefined);
  assert.equal(result.nodes[0]?.metadata, undefined);
});

test("query --full exposes the complete SceneNode when needed", async () => {
  const { stdout } = await execFileAsync(process.execPath, [
    cli,
    "query",
    fixture,
    "--id",
    "box",
    "--full",
  ]);
  const result = JSON.parse(stdout) as {
    nodes: Array<{
      worldTransform: { matrix?: number[] };
      metadata?: Record<string, unknown>;
    }>;
  };

  assert.equal(result.nodes[0]?.worldTransform.matrix?.length, 16);
  assert.equal(typeof result.nodes[0]?.metadata?.["three.uuid"], "string");
});

test("query refuses an unfiltered full-scene response", async () => {
  await assert.rejects(
    () => execFileAsync(process.execPath, [cli, "query", fixture]),
    (error: unknown) => {
      const stderr = (error as { stderr?: string }).stderr ?? "";
      return stderr.includes("query requires at least one filter");
    },
  );
});

test("built CLI measures semantic anchor-to-socket distance without bounds", async () => {
  const { stdout } = await execFileAsync(process.execPath, [
    cli,
    "measure",
    "distance",
    fixture,
    "--from",
    "socket:Root#origin",
    "--to",
    "anchor:box#edge",
  ]);
  const result = JSON.parse(stdout) as {
    kind: string;
    distance: number;
    delta: number[];
  };

  assert.equal(result.kind, "distance");
  assert.equal(result.distance, 4);
  assert.deepEqual(result.delta, [4, 0, 0]);
});

test("built CLI measures semantic angular difference", async () => {
  const { stdout } = await execFileAsync(process.execPath, [
    cli,
    "measure",
    "angle",
    fixture,
    "--from",
    "socket:Root#origin",
    "--to",
    "anchor:box#edge",
  ]);
  const result = JSON.parse(stdout) as {
    kind: string;
    degrees: number;
  };

  assert.equal(result.kind, "angle");
  assert.ok(Math.abs(result.degrees - 90) < 1e-10);
});
