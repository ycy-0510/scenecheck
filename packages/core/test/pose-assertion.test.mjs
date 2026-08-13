import assert from "node:assert/strict";
import { test } from "node:test";
import {
  evaluateAssertion,
  freezeAnnotationAsPoseAssertion,
  validateScene,
} from "../dist/index.js";

const identity = {
  position: [0, 0, 0],
  rotation: [0, 0, 0, 1],
  scale: [1, 1, 1],
};

function node(id, position = [0, 0, 0], rotation = [0, 0, 0, 1]) {
  const transform = { position, rotation, scale: [1, 1, 1] };
  return {
    id,
    type: "Object3D",
    children: [],
    localTransform: transform,
    worldTransform: transform,
  };
}

function annotation(id, type, position, rotation = [0, 0, 0, 1]) {
  return {
    id,
    type,
    worldTransform: {
      position,
      rotation,
      scale: [1, 1, 1],
    },
  };
}

function scene(nodes, annotations = []) {
  return {
    version: 1,
    roots: nodes.map((item) => item.id),
    nodes: Object.fromEntries(nodes.map((item) => [item.id, item])),
    ...(annotations.length ? { annotations } : {}),
  };
}

test("freezing an annotation creates a literal pose assertion independent of the marker", () => {
  const source = scene(
    [node("door", [5, 2, -3])],
    [annotation("target", "pose", [5, 2, -3])],
  );

  const frozen = freezeAnnotationAsPoseAssertion(source, "target", {
    target: "door",
    positionTolerance: 0.01,
    rotationToleranceDegrees: 1,
  });

  assert.deepEqual(frozen.position, [5, 2, -3]);
  assert.deepEqual(frozen.rotation, [0, 0, 0, 1]);

  // The runtime annotation is gone, but the generated assertion remains self-contained.
  const withoutAnnotation = scene([node("door", [5, 2, -3])]);
  const result = evaluateAssertion(withoutAnnotation, frozen);
  assert.equal(result.pass, true);
  assert.equal(result.type, "pose");
  assert.deepEqual(result.actual, {
    positionError: 0,
    rotationErrorDegrees: 0,
  });
});

test("frozen pose fails after the target regresses in position and orientation", () => {
  const source = scene(
    [node("door", [0, 0, 0])],
    [annotation("target", "pose", [0, 0, 0])],
  );
  const frozen = freezeAnnotationAsPoseAssertion(source, "target", {
    target: "door",
    positionTolerance: 0.05,
    rotationToleranceDegrees: 2,
  });

  const halfAngle = Math.PI / 8;
  const regressed = scene([
    node(
      "door",
      [0.2, 0, 0],
      [0, Math.sin(halfAngle), 0, Math.cos(halfAngle)],
    ),
  ]);
  const result = evaluateAssertion(regressed, frozen);

  assert.equal(result.pass, false);
  assert.equal(result.unit, "pose");
  assert.ok(Math.abs(result.actual.positionError - 0.2) < 1e-12);
  assert.ok(Math.abs(result.actual.rotationErrorDegrees - 45) < 1e-9);
});

test("quaternion sign does not create a false orientation regression", () => {
  const data = scene([node("camera", [1, 2, 3], [0, 0, 0, -1])]);
  const result = evaluateAssertion(data, {
    id: "camera-pose",
    type: "pose",
    target: "camera",
    position: [1, 2, 3],
    positionTolerance: 0,
    rotation: [0, 0, 0, 1],
    rotationToleranceDegrees: 0,
  });

  assert.equal(result.pass, true);
  assert.equal(result.actual.rotationErrorDegrees, 0);
});

test("point annotations cannot be frozen as orientation constraints", () => {
  const data = scene(
    [node("road")],
    [annotation("point-1", "point", [0, 0, 0])],
  );

  assert.throws(
    () =>
      freezeAnnotationAsPoseAssertion(data, "point-1", {
        target: "road",
        positionTolerance: 0.1,
        rotationToleranceDegrees: 5,
      }),
    /no orientation semantics/i,
  );
});

test("pose assertions reject annotation targets to avoid dynamic-answer references", () => {
  const data = scene(
    [node("road")],
    [annotation("pose-1", "pose", [0, 0, 0])],
  );

  assert.throws(
    () =>
      freezeAnnotationAsPoseAssertion(data, "pose-1", {
        target: "annotation:pose-1",
        positionTolerance: 0.1,
      }),
    /must be a node, anchor, or socket/i,
  );
});

test("pose assertions participate in aggregate validation", () => {
  const data = scene([node("road", [10, 0, 0])]);
  const validation = validateScene(data, [
    {
      id: "road-position",
      type: "pose",
      target: "road",
      position: [10, 0, 0],
      positionTolerance: 0.001,
    },
  ]);

  assert.equal(validation.ok, true);
  assert.equal(validation.passed, 1);
  assert.equal(validation.failed, 0);
});
