import assert from "node:assert/strict";
import { test } from "node:test";
import { Group, Scene } from "three";
import {
  describeThreeObject,
  fromThreeScene,
  setThreeSceneAnnotations,
} from "../dist/index.js";

const identity = {
  position: [0, 0, 0],
  rotation: [0, 0, 0, 1],
  scale: [1, 1, 1],
};

test("Three.js adapter carries pure annotation metadata without adding scene children", () => {
  const scene = new Scene();
  scene.name = "World";

  const tunnel = new Group();
  describeThreeObject(tunnel, { id: "tunnel" });
  scene.add(tunnel);
  const originalChildren = scene.children.length;

  setThreeSceneAnnotations(scene, [
    {
      id: "problem-a",
      type: "point",
      attachedTo: "tunnel",
      localTransform: {
        ...identity,
        position: [1, 2, 3],
      },
      worldTransform: identity,
      label: "This corner is wrong",
    },
  ]);

  assert.equal(scene.children.length, originalChildren);

  const ir = fromThreeScene(scene);
  assert.equal(ir.annotations?.length, 1);
  assert.equal(ir.annotations?.[0]?.id, "problem-a");
  assert.equal(ir.annotations?.[0]?.attachedTo, "tunnel");
  assert.deepEqual(ir.annotations?.[0]?.localTransform?.position, [1, 2, 3]);
});

test("adapter rejects annotations attached to missing SceneCheck nodes", () => {
  const scene = new Scene();
  scene.name = "World";
  setThreeSceneAnnotations(scene, [
    {
      id: "orphan",
      type: "point",
      attachedTo: "does-not-exist",
      localTransform: identity,
      worldTransform: identity,
    },
  ]);

  assert.throws(() => fromThreeScene(scene), /attached to missing node/i);
});

test("Three annotation metadata rejects duplicate IDs", () => {
  const scene = new Scene();

  assert.throws(
    () =>
      setThreeSceneAnnotations(scene, [
        { id: "same", type: "point", worldTransform: identity },
        { id: "same", type: "pose", worldTransform: identity },
      ]),
    /duplicate scenecheck annotation id/i,
  );
});
