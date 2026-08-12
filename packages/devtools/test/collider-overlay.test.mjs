import assert from "node:assert/strict";
import { test } from "node:test";
import { Group, Quaternion, Scene, Vector3 } from "three";
import { describeThreeObject, fromThreeScene } from "@scenecheck/three";
import { ThreeColliderOverlay, ThreeDevtoolsController } from "../dist/index.js";

function makeScene() {
  const scene = new Scene();
  const car = new Group();
  car.position.set(10, 2, 3);
  car.rotation.y = Math.PI / 2;
  describeThreeObject(car, {
    id: "car",
    colliders: [
      {
        id: "body",
        type: "box",
        position: [0, 1, 0],
        size: [2, 4, 6],
      },
      {
        id: "probe",
        type: "sphere",
        position: [0, 0, -3],
        radius: 0.5,
      },
    ],
  });
  scene.add(car);
  return { scene, car };
}

test("collider overlay renders registered shapes with owner world transform and local pose", () => {
  const { scene, car } = makeScene();
  const controller = new ThreeDevtoolsController({ scene });
  const overlay = new ThreeColliderOverlay(controller);
  controller.select("car");
  overlay.setEnabled(true);

  assert.equal(overlay.root.children.length, 2);
  const body = overlay.root.children[0];
  const probe = overlay.root.children[1];
  assert.equal(body.name, "SceneCheck Collider body");
  assert.equal(probe.name, "SceneCheck Collider probe");

  const position = new Vector3();
  const rotation = new Quaternion();
  const scale = new Vector3();
  body.matrix.decompose(position, rotation, scale);
  assert.deepEqual(roundVec(position), [10, 3, 3]);
  assert.deepEqual(roundVec(scale), [2, 4, 6]);

  probe.matrix.decompose(position, rotation, scale);
  // Owner yaw=90° rotates local -Z to world -X.
  assert.deepEqual(roundVec(position), [7, 2, 3]);
  assert.deepEqual(roundVec(scale), [0.5, 0.5, 0.5]);

  // Helpers are debug-only and never become Scene IR nodes.
  assert.equal(
    Object.values(fromThreeScene(scene).nodes).some((node) =>
      node.name?.startsWith("SceneCheck Collider"),
    ),
    false,
  );

  overlay.destroy();
  controller.destroy();
  car.position.set(0, 0, 0);
});

test("collider overlay follows selection, can be disabled, and cleans up helpers", () => {
  const { scene } = makeScene();
  const empty = new Group();
  describeThreeObject(empty, { id: "empty" });
  scene.add(empty);

  const controller = new ThreeDevtoolsController({ scene });
  const overlay = new ThreeColliderOverlay(controller);
  controller.select("car");
  overlay.setEnabled(true);
  assert.equal(overlay.root.children.length, 2);

  controller.select("empty");
  overlay.refresh();
  assert.equal(overlay.root.children.length, 0);

  controller.select("car");
  overlay.refresh();
  assert.equal(overlay.root.children.length, 2);
  overlay.setEnabled(false);
  assert.equal(overlay.root.children.length, 0);

  const root = overlay.root;
  overlay.destroy();
  assert.equal(root.parent, null);
  assert.equal(root.children.length, 0);
  controller.destroy();
});

function roundVec(vector) {
  return vector.toArray().map((value) => {
    const rounded = Math.round(value * 1e9) / 1e9;
    return Object.is(rounded, -0) ? 0 : rounded;
  });
}
