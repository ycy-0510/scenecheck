import assert from "node:assert/strict";
import { test } from "node:test";
import { measureAabbRelation, measureAabbSize } from "../dist/index.js";

const identity = {
  position: [0, 0, 0],
  rotation: [0, 0, 0, 1],
  scale: [1, 1, 1],
};

function boundedNode(id, min, max) {
  return {
    id,
    type: "Mesh",
    children: [],
    localTransform: identity,
    worldTransform: identity,
    bounds: { min, max },
  };
}

function sceneWith(aBounds, bBounds) {
  return {
    version: 1,
    roots: ["a", "b"],
    nodes: {
      a: boundedNode("a", aBounds[0], aBounds[1]),
      b: boundedNode("b", bBounds[0], bBounds[1]),
    },
  };
}

test("measures Euclidean clearance between separated AABBs", () => {
  const scene = sceneWith(
    [[0, 0, 0], [1, 1, 1]],
    [[4, 5, 1], [6, 7, 2]],
  );
  const result = measureAabbRelation(scene, "a", "b");

  assert.deepEqual(result.axisGap, [3, 4, 0]);
  assert.equal(result.clearance, 5);
  assert.equal(result.intersects, false);
  assert.equal(result.strictlyOverlaps, false);
  assert.equal(result.touches, false);
  assert.equal(result.intersectionExtent, null);
});

test("distinguishes touching from positive-volume overlap", () => {
  const touching = measureAabbRelation(
    sceneWith(
      [[0, 0, 0], [1, 1, 1]],
      [[1, 0.25, 0.25], [2, 0.75, 0.75]],
    ),
    "a",
    "b",
  );
  assert.equal(touching.clearance, 0);
  assert.equal(touching.intersects, true);
  assert.equal(touching.strictlyOverlaps, false);
  assert.equal(touching.touches, true);
  assert.deepEqual(touching.intersectionExtent, [0, 0.5, 0.5]);

  const overlap = measureAabbRelation(
    sceneWith(
      [[0, 0, 0], [2, 2, 2]],
      [[1, 0.5, -1], [3, 1.5, 1]],
    ),
    "a",
    "b",
  );
  assert.equal(overlap.intersects, true);
  assert.equal(overlap.strictlyOverlaps, true);
  assert.equal(overlap.touches, false);
  assert.deepEqual(overlap.intersectionExtent, [1, 1, 1]);
});

test("measures AABB size center and diagonal", () => {
  const scene = {
    version: 1,
    roots: ["box"],
    nodes: {
      box: boundedNode("box", [-1, 2, 3], [3, 6, 15]),
    },
  };
  const result = measureAabbSize(scene, "box");

  assert.deepEqual(result.size, [4, 4, 12]);
  assert.deepEqual(result.center, [1, 4, 9]);
  assert.equal(result.diagonal, 4 * Math.sqrt(11));
});

test("requires captured bounds instead of silently inventing geometry", () => {
  const scene = {
    version: 1,
    roots: ["empty"],
    nodes: {
      empty: {
        id: "empty",
        type: "Group",
        children: [],
        localTransform: identity,
        worldTransform: identity,
      },
    },
  };

  assert.throws(() => measureAabbSize(scene, "empty"), /has no captured AABB/i);
});
