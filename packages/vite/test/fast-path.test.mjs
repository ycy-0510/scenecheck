import assert from "node:assert/strict";
import { test } from "node:test";
import { instrumentSceneCheckSources } from "../dist/index.js";

const root = "/workspace/app";
const file = "/workspace/app/src/unrelated.ts";

test("unrelated modules return before syntax parsing", () => {
  // Deliberately invalid TypeScript. If the fast path regresses behind the parser this throws.
  assert.equal(
    instrumentSceneCheckSources("function { definitely-not-valid", file, root),
    undefined,
  );
});

test("mentioning only the package or only the function name still skips parsing", () => {
  assert.equal(
    instrumentSceneCheckSources(
      'const packageName = "@scenecheck/three"; function { invalid',
      file,
      root,
    ),
    undefined,
  );
  assert.equal(
    instrumentSceneCheckSources(
      'const name = "describeThreeObject"; function { invalid',
      file,
      root,
    ),
    undefined,
  );
});
