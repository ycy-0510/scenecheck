import assert from "node:assert/strict";
import { test } from "node:test";
import { Group, Scene } from "three";
import {
  describeThreeObject,
  fromThreeScene,
  readThreeSceneCheckMetadata,
} from "../dist/index.js";

test("describeThreeObject stores normalized source metadata and adapter exposes it", () => {
  const scene = new Scene();
  const tunnel = new Group();
  describeThreeObject(tunnel, {
    id: "tunnel",
    source: {
      file: "src\\world\\tunnel.ts",
      line: 18,
      column: 3,
      symbol: "buildTunnel",
    },
  });
  scene.add(tunnel);

  assert.deepEqual(readThreeSceneCheckMetadata(tunnel)?.source, {
    file: "src/world/tunnel.ts",
    line: 18,
    column: 3,
    symbol: "buildTunnel",
  });

  const ir = fromThreeScene(scene, { includeBounds: false });
  assert.deepEqual(ir.nodes.tunnel?.source, {
    file: "src/world/tunnel.ts",
    line: 18,
    column: 3,
    symbol: "buildTunnel",
  });
});

test("source metadata is cloned instead of exposing mutable userData", () => {
  const object = new Group();
  describeThreeObject(object, {
    id: "x",
    source: { file: "src/x.ts", line: 2 },
  });

  const first = readThreeSceneCheckMetadata(object);
  assert.ok(first?.source);
  first.source.file = "changed.ts";

  assert.equal(readThreeSceneCheckMetadata(object)?.source?.file, "src/x.ts");
});
