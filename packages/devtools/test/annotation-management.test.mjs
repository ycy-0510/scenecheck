import assert from "node:assert/strict";
import { test } from "node:test";
import { Group, Scene } from "three";
import {
  describeThreeObject,
  readThreeSceneAnnotations,
  setThreeSceneAnnotations,
} from "@scenecheck/three";
import {
  removeThreeAnnotation,
  ThreeDevtoolsController,
  updateThreeAnnotation,
} from "../dist/index.js";

function makeController() {
  const scene = new Scene();
  const tunnel = new Group();
  describeThreeObject(tunnel, { id: "tunnel" });
  scene.add(tunnel);
  setThreeSceneAnnotations(scene, [
    {
      id: "target",
      type: "pose",
      attachedTo: "tunnel",
      localTransform: {
        position: [1, 2, 3],
        rotation: [0, 0, 0, 1],
        scale: [1, 1, 1],
      },
      worldTransform: {
        position: [1, 2, 3],
        rotation: [0, 0, 0, 1],
        scale: [1, 1, 1],
      },
      label: "Old label",
      note: "Old note",
    },
  ]);
  return { scene, controller: new ThreeDevtoolsController({ scene }) };
}

test("annotation metadata can change without changing spatial identity", () => {
  const { scene, controller } = makeController();
  const before = controller.ir.annotations?.[0];

  const updated = updateThreeAnnotation(controller, "target", {
    label: " Exit target ",
    note: " Align the door here ",
  });

  assert.equal(updated.label, "Exit target");
  assert.equal(updated.note, "Align the door here");
  assert.deepEqual(updated.localTransform, before?.localTransform);
  assert.deepEqual(updated.worldTransform, before?.worldTransform);
  assert.equal(controller.ir.annotations?.[0]?.label, "Exit target");
  assert.equal(readThreeSceneAnnotations(scene)?.[0]?.note, "Align the door here");

  controller.destroy();
});

test("empty annotation label/note removes human metadata", () => {
  const { controller } = makeController();
  const updated = updateThreeAnnotation(controller, "target", {
    label: "   ",
    note: null,
  });

  assert.equal(updated.label, undefined);
  assert.equal(updated.note, undefined);
  controller.destroy();
});

test("annotations can be deleted cleanly from runtime metadata and Scene IR", () => {
  const { scene, controller } = makeController();
  const removed = removeThreeAnnotation(controller, "target");

  assert.equal(removed.id, "target");
  assert.deepEqual(readThreeSceneAnnotations(scene), []);
  assert.deepEqual(controller.ir.annotations, undefined);
  controller.destroy();
});

test("annotation update/delete fail clearly for unknown IDs", () => {
  const { controller } = makeController();
  assert.throws(
    () => updateThreeAnnotation(controller, "missing", { label: "x" }),
    /annotation not found/i,
  );
  assert.throws(
    () => removeThreeAnnotation(controller, "missing"),
    /annotation not found/i,
  );
  controller.destroy();
});
