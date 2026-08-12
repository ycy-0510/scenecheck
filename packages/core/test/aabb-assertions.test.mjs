import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluateAssertion, validateScene } from "../dist/index.js";

const identity = {
  position: [0, 0, 0],
  rotation: [0, 0, 0, 1],
  scale: [1, 1, 1],
};

function node(id, min, max) {
  return {
    id,
    type: "Mesh",
    children: [],
    localTransform: identity,
    worldTransform: identity,
    bounds: { min, max },
  };
}

const scene = {
  version: 1,
  roots: ["car", "wall", "sign"],
  nodes: {
    car: node("car", [0, 0, 0], [2, 1, 4]),
    wall: node("wall", [3, 0, 0], [4, 2, 4]),
    sign: node("sign", [1.5, 0.5, 1], [2.5, 1.5, 2]),
  },
};

test("AABB clearance assertions use minimum box-to-box distance", () => {
  const passing = evaluateAssertion(scene, {
    id: "wall-clearance",
    type: "aabb-clearance",
    from: "car",
    to: "wall",
    min: 0.9,
    max: 1.1,
  });

  assert.equal(passing.pass, true);
  assert.equal(passing.actual, 1);
  assert.equal(passing.unit, "m");
  assert.match(passing.message, /AABB clearance 1 m/);
});

test("AABB intersection assertions distinguish closed intersection and strict overlap", () => {
  const strictOverlap = evaluateAssertion(scene, {
    id: "sign-overlap",
    type: "aabb-intersection",
    a: "car",
    b: "sign",
    expected: true,
    strict: true,
  });
  const separated = evaluateAssertion(scene, {
    id: "wall-not-intersecting",
    type: "aabb-intersection",
    a: "car",
    b: "wall",
    expected: false,
  });

  assert.equal(strictOverlap.pass, true);
  assert.equal(strictOverlap.actual, true);
  assert.equal(separated.pass, true);
  assert.equal(separated.actual, false);
});

test("AABB assertion failures aggregate into normal validation results", () => {
  const result = validateScene(scene, [
    {
      id: "clearance-too-small",
      type: "aabb-clearance",
      from: "car",
      to: "wall",
      min: 2,
    },
    {
      id: "unexpected-sign-overlap",
      type: "aabb-intersection",
      a: "car",
      b: "sign",
      expected: false,
      strict: true,
    },
  ]);

  assert.equal(result.ok, false);
  assert.equal(result.failed, 2);
  assert.equal(result.results[0]?.actual, 1);
  assert.equal(result.results[1]?.actual, true);
});
