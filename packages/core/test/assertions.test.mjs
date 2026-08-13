import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluateAssertion, validateScene } from "../dist/index.js";

const identity = {
  position: [0, 0, 0],
  rotation: [0, 0, 0, 1],
  scale: [1, 1, 1],
};

const scene = {
  version: 1,
  roots: ["root"],
  nodes: {
    root: {
      id: "root",
      type: "Group",
      children: ["box"],
      localTransform: identity,
      worldTransform: identity,
      semantics: {
        sockets: [
          {
            id: "origin",
            transform: identity,
          },
        ],
      },
    },
    box: {
      id: "box",
      type: "Mesh",
      parentId: "root",
      children: [],
      localTransform: { ...identity, position: [3, 0, 0] },
      worldTransform: { ...identity, position: [3, 0, 0] },
      semantics: {
        anchors: [
          {
            id: "edge",
            transform: {
              ...identity,
              position: [1, 0, 0],
              rotation: [0, Math.SQRT1_2, 0, Math.SQRT1_2],
            },
          },
        ],
      },
    },
  },
};

const from = "socket:root#origin";
const to = "anchor:box#edge";

test("evaluates passing and failing distance assertions", () => {
  const passing = evaluateAssertion(scene, {
    id: "gap-ok",
    type: "distance",
    from,
    to,
    max: 4.1,
  });
  const failing = evaluateAssertion(scene, {
    id: "gap-too-large",
    type: "distance",
    from,
    to,
    max: 3,
  });

  assert.equal(passing.pass, true);
  assert.equal(passing.actual, 4);
  assert.equal(passing.unit, "m");
  assert.equal(failing.pass, false);
});

test("supports target plus tolerance assertions", () => {
  const result = evaluateAssertion(scene, {
    id: "exact-gap",
    type: "distance",
    from,
    to,
    target: 4,
    tolerance: 0.001,
  });

  assert.equal(result.pass, true);
  assert.match(result.expected, /within 0\.001 m of 4 m/);
});

test("evaluates angular tolerance in degrees", () => {
  const passing = evaluateAssertion(scene, {
    id: "orientation",
    type: "angle",
    from,
    to,
    targetDegrees: 90,
    toleranceDegrees: 0.01,
  });

  assert.equal(passing.pass, true);
  assert.ok(Math.abs(passing.actual - 90) < 1e-10);
  assert.equal(passing.unit, "deg");
});

test("aggregates validation results for CI", () => {
  const result = validateScene(scene, [
    {
      id: "distance-pass",
      type: "distance",
      from,
      to,
      max: 5,
    },
    {
      id: "angle-fail",
      type: "angle",
      from,
      to,
      maxDegrees: 45,
    },
  ]);

  assert.equal(result.ok, false);
  assert.equal(result.total, 2);
  assert.equal(result.passed, 1);
  assert.equal(result.failed, 1);
});

test("rejects invalid assertion definitions and duplicate ids", () => {
  assert.throws(
    () =>
      evaluateAssertion(scene, {
        id: "bad",
        type: "distance",
        from,
        to,
        target: 4,
      }),
    /target requires tolerance/i,
  );

  assert.throws(
    () =>
      validateScene(scene, [
        { id: "same", type: "distance", from, to, max: 5 },
        { id: "same", type: "distance", from, to, max: 5 },
      ]),
    /duplicate scenecheck assertion id/i,
  );
});
