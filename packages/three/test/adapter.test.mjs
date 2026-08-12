import assert from "node:assert/strict";
import test from "node:test";
import {
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  Scene,
} from "three";
import { fromThreeScene } from "../dist/index.js";

function makeMesh(name = "Mesh") {
  const mesh = new Mesh(new BoxGeometry(2, 4, 6), new MeshBasicMaterial());
  mesh.name = name;
  return mesh;
}

test("exports a deterministic hierarchy with local and world transforms", () => {
  const scene = new Scene();
  scene.name = "World";

  const tunnel = new Group();
  tunnel.name = "Tunnel";
  tunnel.position.set(10, 0, 0);

  const exit = makeMesh("Exit");
  exit.position.set(2, 3, 4);

  tunnel.add(exit);
  scene.add(tunnel);

  const ir = fromThreeScene(scene);

  assert.deepEqual(ir.roots, ["World"]);
  assert.equal(ir.nodes["World/Tunnel"]?.parentId, "World");
  assert.equal(ir.nodes["World/Tunnel/Exit"]?.parentId, "World/Tunnel");
  assert.deepEqual(ir.nodes["World/Tunnel/Exit"]?.localTransform.position, [2, 3, 4]);
  assert.deepEqual(ir.nodes["World/Tunnel/Exit"]?.worldTransform.position, [12, 3, 4]);
  assert.equal(ir.nodes["World/Tunnel/Exit"]?.worldTransform.matrix?.length, 16);
});

test("uses semantic IDs when userData.scenecheckId is present", () => {
  const scene = new Scene();
  scene.name = "World";

  const exit = makeMesh("Exit");
  exit.userData.scenecheckId = "emergency-exit-a";
  scene.add(exit);

  const ir = fromThreeScene(scene);

  assert.ok(ir.nodes["emergency-exit-a"]);
  assert.deepEqual(ir.nodes.World?.children, ["emergency-exit-a"]);
});

test("disambiguates duplicate sibling names without using runtime UUIDs", () => {
  const firstScene = new Scene();
  firstScene.name = "World";
  firstScene.add(makeMesh("Barrier"), makeMesh("Barrier"));

  const secondScene = new Scene();
  secondScene.name = "World";
  secondScene.add(makeMesh("Barrier"), makeMesh("Barrier"));

  const first = fromThreeScene(firstScene);
  const second = fromThreeScene(secondScene);

  assert.deepEqual(Object.keys(first.nodes), Object.keys(second.nodes));
  assert.ok(first.nodes["World/Barrier"]);
  assert.ok(first.nodes["World/Barrier#2"]);
});

test("can omit invisible subtrees", () => {
  const scene = new Scene();
  scene.name = "World";

  const hidden = new Group();
  hidden.name = "Hidden";
  hidden.visible = false;
  hidden.add(makeMesh("StillVisibleFlag"));
  scene.add(hidden);

  const all = fromThreeScene(scene);
  const visibleOnly = fromThreeScene(scene, { includeInvisible: false });

  assert.ok(all.nodes["World/Hidden/StillVisibleFlag"]);
  assert.equal(visibleOnly.nodes["World/Hidden"], undefined);
  assert.equal(visibleOnly.nodes["World/Hidden/StillVisibleFlag"], undefined);
});

test("computes world-axis-aligned subtree bounds without a renderer", () => {
  const scene = new Scene();
  scene.name = "World";

  const box = makeMesh("Box");
  box.position.set(3, 0, 0);
  scene.add(box);

  const ir = fromThreeScene(scene);

  assert.deepEqual(ir.nodes["World/Box"]?.bounds, {
    min: [2, -2, -3],
    max: [4, 2, 3],
  });
  assert.deepEqual(ir.nodes.World?.bounds, {
    min: [2, -2, -3],
    max: [4, 2, 3],
  });
});

test("throws on duplicate semantic IDs instead of silently corrupting references", () => {
  const scene = new Scene();
  scene.name = "World";

  const a = makeMesh("A");
  const b = makeMesh("B");
  a.userData.scenecheckId = "same-id";
  b.userData.scenecheckId = "same-id";
  scene.add(a, b);

  assert.throws(() => fromThreeScene(scene), /duplicate object id/i);
});
