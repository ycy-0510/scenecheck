import assert from "node:assert/strict";
import { test } from "node:test";
import {
  instrumentSceneCheckSources,
  sceneCheckSourceLocations,
} from "../dist/index.js";

const root = "/workspace/app";

function instrument(code, file = "/workspace/app/src/world.ts") {
  return instrumentSceneCheckSources(code, file, root);
}

test("injects project-relative file, call line/column, and enclosing symbol", () => {
  const code = [
    'import { describeThreeObject } from "@scenecheck/three";',
    "",
    "export function buildTunnel(tunnel) {",
    '  describeThreeObject(tunnel, { id: "tunnel" });',
    "}",
  ].join("\n");

  const result = instrument(code);
  assert.ok(result);
  assert.equal(result.injected.length, 1);
  assert.deepEqual(result.injected[0], {
    file: "src/world.ts",
    line: 4,
    column: 3,
    symbol: "buildTunnel",
  });
  assert.match(
    result.code,
    /describeThreeObject\(tunnel, \{source:\{"file":"src\/world\.ts","line":4,"column":3,"symbol":"buildTunnel"\}, id: "tunnel" \}\)/,
  );
  assert.match(result.map.toString(), /src\/world\.ts/);
});

test("supports aliased named imports and infers variable symbols", () => {
  const code = [
    'import { describeThreeObject as describe } from "@scenecheck/three";',
    'const tunnel = describe(makeTunnel(), { id: "tunnel" });',
  ].join("\n");
  const result = instrument(code);

  assert.ok(result);
  assert.deepEqual(result.injected[0], {
    file: "src/world.ts",
    line: 2,
    column: 16,
    symbol: "tunnel",
  });
});

test("supports namespace imports", () => {
  const code = [
    'import * as SceneCheck from "@scenecheck/three";',
    'SceneCheck.describeThreeObject(car, { id: "car" });',
  ].join("\n");
  const result = instrument(code);

  assert.ok(result);
  assert.equal(result.injected.length, 1);
  assert.match(result.code, /SceneCheck\.describeThreeObject\(car, \{source:/);
});

test("preserves an explicit source field without injecting a second one", () => {
  const code = [
    'import { describeThreeObject } from "@scenecheck/three";',
    'describeThreeObject(car, { source: { file: "manual.ts", line: 1 }, id: "car" });',
  ].join("\n");

  assert.equal(instrument(code), undefined);
});

test("does not instrument same-named functions imported from other modules", () => {
  const code = [
    'import { describeThreeObject } from "other-library";',
    'describeThreeObject(car, { id: "car" });',
  ].join("\n");

  assert.equal(instrument(code), undefined);
});

test("does not guess through indirect descriptors or re-exported wrappers", () => {
  const code = [
    'import { describeThreeObject } from "@scenecheck/three";',
    'const descriptor = { id: "car" };',
    'describeThreeObject(car, descriptor);',
  ].join("\n");

  assert.equal(instrument(code), undefined);
});

test("instruments multiple direct calls independently", () => {
  const code = [
    'import { describeThreeObject } from "@scenecheck/three";',
    'describeThreeObject(a, { id: "a" });',
    'describeThreeObject(b, { id: "b" });',
  ].join("\n");
  const result = instrument(code);

  assert.ok(result);
  assert.equal(result.injected.length, 2);
  assert.deepEqual(result.injected.map((item) => item.line), [2, 3]);
  assert.equal((result.code.match(/source:/g) ?? []).length, 2);
});

test("parses TypeScript/TSX syntax while preserving original code", () => {
  const code = [
    'import { describeThreeObject } from "@scenecheck/three";',
    'type Model = { node: unknown };',
    'function build(model: Model) {',
    '  return describeThreeObject(model.node as any, { id: "node" });',
    '}',
  ].join("\n");
  const result = instrument(code, "/workspace/app/src/world.tsx");

  assert.ok(result);
  assert.match(result.code, /model\.node as any/);
  assert.equal(result.injected[0]?.file, "src/world.tsx");
  assert.equal(result.injected[0]?.symbol, "build");
});

test("skips files outside the project root and node_modules", () => {
  const code = [
    'import { describeThreeObject } from "@scenecheck/three";',
    'describeThreeObject(car, { id: "car" });',
  ].join("\n");

  assert.equal(
    instrumentSceneCheckSources(code, "/workspace/shared/car.ts", root),
    undefined,
  );
  assert.equal(
    instrumentSceneCheckSources(
      code,
      "/workspace/app/node_modules/example/car.ts",
      root,
    ),
    undefined,
  );
});

test("Vite plugin is explicitly dev-server-only", () => {
  const plugin = sceneCheckSourceLocations();
  assert.equal(plugin.name, "scenecheck-source-locations");
  assert.equal(plugin.enforce, "pre");
  assert.equal(plugin.apply, "serve");
});
