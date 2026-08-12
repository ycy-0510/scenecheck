import assert from "node:assert/strict";
import { test } from "node:test";
import {
  measureAngle,
  measureDistance,
  parseSceneReference,
  resolveSceneReference,
} from "../dist/index.js";

const identity = {
  position: [0, 0, 0],
  rotation: [0, 0, 0, 1],
  scale: [1, 1, 1],
};

function node(id, position, extra = {}) {
  return {
    id,
    type: "Group",
    children: [],
    localTransform: { ...identity, position },
    worldTransform: { ...identity, position },
    ...extra,
  };
}

test("parses node, anchor, and socket references using the final hash separator", () => {
  assert.deepEqual(parseSceneReference("road-main"), {
    kind: "node",
    nodeId: "road-main",
  });
  assert.deepEqual(parseSceneReference("anchor:World/Barrier#2#end"), {
    kind: "anchor",
    nodeId: "World/Barrier#2",
    semanticId: "end",
  });
  assert.deepEqual(parseSceneReference("socket:tunnel#emergency-right"), {
    kind: "socket",
    nodeId: "tunnel",
    semanticId: "emergency-right",
  });
});

test("measures Euclidean distance between node origins", () => {
  const scene = {
    version: 1,
    roots: ["a", "b"],
    nodes: {
      a: node("a", [1, 2, 3]),
      b: node("b", [4, 6, 3]),
    },
  };

  const result = measureDistance(scene, "a", "b");
  assert.deepEqual(result.delta, [3, 4, 0]);
  assert.equal(result.distance, 5);
});

test("resolves anchor positions through the exact node world matrix", () => {
  const scene = {
    version: 1,
    roots: ["tunnel"],
    nodes: {
      tunnel: node("tunnel", [10, 0, 0], {
        worldTransform: {
          position: [10, 0, 0],
          rotation: [0, Math.SQRT1_2, 0, Math.SQRT1_2],
          scale: [2, 1, 1],
          matrix: [
            0, 0, -2, 0,
            0, 1, 0, 0,
            1, 0, 0, 0,
            10, 0, 0, 1,
          ],
        },
        semantics: {
          anchors: [
            {
              id: "edge",
              transform: {
                position: [1, 0, 0],
                rotation: [0, 0, 0, 1],
                scale: [1, 1, 1],
              },
            },
          ],
        },
      }),
    },
  };

  const resolved = resolveSceneReference(scene, "anchor:tunnel#edge");
  assert.deepEqual(resolved.worldPosition, [10, 0, -2]);
});

test("measures quaternion angular difference in degrees and radians", () => {
  const scene = {
    version: 1,
    roots: ["a", "b"],
    nodes: {
      a: node("a", [0, 0, 0]),
      b: node("b", [0, 0, 0], {
        worldTransform: {
          ...identity,
          rotation: [0, Math.SQRT1_2, 0, Math.SQRT1_2],
        },
      }),
    },
  };

  const result = measureAngle(scene, "a", "b");
  assert.ok(Math.abs(result.degrees - 90) < 1e-10);
  assert.ok(Math.abs(result.radians - Math.PI / 2) < 1e-10);
});

test("reports missing semantic references clearly", () => {
  const scene = {
    version: 1,
    roots: ["tunnel"],
    nodes: { tunnel: node("tunnel", [0, 0, 0]) },
  };

  assert.throws(
    () => resolveSceneReference(scene, "socket:tunnel#missing"),
    /socket "missing" not found on node "tunnel"/i,
  );
});
