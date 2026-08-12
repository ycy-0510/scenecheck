import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { loadSceneIRFromProvider, resolveProviderPath } from "../src/dump.ts";

const fixture = fileURLToPath(new URL("./fixtures/basic-scene.ts", import.meta.url));

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
