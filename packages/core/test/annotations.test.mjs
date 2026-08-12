import assert from "node:assert/strict";
import { test } from "node:test";
import {
  measureAngle,
  measureDistance,
  resolveAnnotation,
  resolveSceneReference,
  validateScene,
} from "../dist/index.js";

const identity = {
  position: [0, 0, 0],
  rotation: [0, 0, 0, 1],
  scale: [1, 1, 1],
};

function attachedScene() {
  return {
    version: 1,
    roots: ["road"],
    nodes: {
      road: {
        id: "road",
        type: "Group",
        children: [],
        localTransform: identity,
        worldTransform: {
          position: [10, 0, 0],
          rotation: [0, Math.SQRT1_2, 0, Math.SQRT1_2],
          scale: [1, 1, 1],
        },
      },
    },
    annotations: [
      {
        id: "target-pose",
        type: "pose",
        attachedTo: "road",
        localTransform: {
          position: [0, 0, -2],
          rotation: [0, 0, 0, 1],
          scale: [1, 1, 1],
        },
        // Captured world state may become stale; attached local state must win.
        worldTransform: {
          position: [999, 999, 999],
          rotation: [0, 0, 0, 1],
          scale: [1, 1, 1],
        },
        label: "Tunnel should start here",
      },
    ],
  };
}

test("attached annotation follows its node local coordinate frame", () => {
  const resolved = resolveAnnotation(attachedScene(), "target-pose");

  assert.equal(resolved.followsAttachment, true);
  assert.deepEqual(resolved.worldTransform.position.map(round), [8, 0, 0]);
  assert.ok(Math.abs(resolved.worldTransform.rotation[1] - Math.SQRT1_2) < 1e-8);
});

test("annotation becomes a first-class scene reference for distance and angle", () => {
  const scene = attachedScene();
  const ref = resolveSceneReference(scene, "annotation:target-pose");
  const distance = measureDistance(scene, "road", "annotation:target-pose");
  const angle = measureAngle(scene, "road", "annotation:target-pose");

  assert.equal(ref.kind, "annotation");
  assert.equal(ref.annotationId, "target-pose");
  assert.deepEqual(ref.worldPosition.map(round), [8, 0, 0]);
  assert.equal(distance.distance, 2);
  assert.ok(angle.degrees < 1e-8);
});

test("ordinary assertions can lock geometry against human-authored annotations", () => {
  const result = validateScene(attachedScene(), [
    {
      id: "target-position",
      type: "distance",
      from: "annotation:target-pose",
      to: "node:road",
      target: 2,
      tolerance: 0.001,
    },
    {
      id: "target-orientation",
      type: "angle",
      from: "annotation:target-pose",
      to: "node:road",
      maxDegrees: 0.001,
    },
  ]);

  assert.equal(result.ok, true);
  assert.equal(result.passed, 2);
});

test("missing annotations and missing attachment nodes fail loudly", () => {
  assert.throws(
    () => resolveAnnotation(attachedScene(), "missing"),
    /annotation not found/i,
  );

  const scene = attachedScene();
  scene.annotations[0].attachedTo = "missing-node";
  assert.throws(
    () => resolveAnnotation(scene, "target-pose"),
    /attached to missing node/i,
  );
});

function round(value) {
  return Math.round(value * 1e9) / 1e9;
}
