import assert from "node:assert/strict";
import { test } from "node:test";
import { composeMat4, solveAttachment } from "../dist/index.js";

const identity = {
  position: [0, 0, 0],
  rotation: [0, 0, 0, 1],
  scale: [1, 1, 1],
};

function node(id, transform = identity, extra = {}) {
  return {
    id,
    type: "Group",
    children: [],
    localTransform: transform,
    worldTransform: transform,
    ...extra,
  };
}

function semanticScene() {
  return {
    version: 1,
    roots: ["tunnel", "exit"],
    nodes: {
      tunnel: node("tunnel", identity, {
        semantics: {
          module: "TunnelSegment",
          sockets: [
            {
              id: "emergency-right",
              accepts: ["EmergencyExit"],
              transform: {
                position: [4, 1.4, -5],
                rotation: [0, Math.SQRT1_2, 0, Math.SQRT1_2],
                scale: [1, 1, 1],
              },
            },
          ],
        },
      }),
      exit: node("exit", identity, {
        semantics: {
          module: "EmergencyExit",
          anchors: [
            {
              id: "mount",
              transform: {
                position: [0, 1.4, 0],
                rotation: [0, 0, 0, 1],
                scale: [1, 1, 1],
              },
            },
          ],
        },
      }),
    },
  };
}

test("solves one module-root TRS that aligns anchor with socket", () => {
  const solution = solveAttachment(semanticScene(), {
    moduleId: "exit",
    anchorId: "mount",
    targetId: "tunnel",
    socketId: "emergency-right",
  });

  assert.equal(solution.safeToApplyTRS, true);
  assert.equal(solution.acceptedBySocket, true);
  assert.deepEqual(solution.desiredLocalTransform.position.map(round), [4, 1.4, -3.6]);
  assert.ok(Math.abs(solution.delta.localAngleDegrees - 90) < 1e-8);

  const q = solution.desiredLocalTransform.rotation;
  assert.ok(Math.abs(Math.abs(q[1]) - Math.SQRT1_2) < 1e-8);
  assert.ok(Math.abs(Math.abs(q[3]) - Math.SQRT1_2) < 1e-8);
});

test("solves module local transform relative to an existing parent", () => {
  const scene = semanticScene();
  const parentTransform = {
    position: [10, 0, 0],
    rotation: [0, 0, 0, 1],
    scale: [1, 1, 1],
    matrix: composeMat4([10, 0, 0], [0, 0, 0, 1], [1, 1, 1]),
  };
  scene.nodes.parent = node("parent", parentTransform, {
    children: ["exit"],
  });
  scene.nodes.exit = {
    ...scene.nodes.exit,
    parentId: "parent",
  };
  scene.roots = ["tunnel", "parent"];

  const solution = solveAttachment(scene, {
    moduleId: "exit",
    anchorId: "mount",
    targetId: "tunnel",
    socketId: "emergency-right",
  });

  assert.deepEqual(solution.desiredLocalTransform.position.map(round), [-6, 1.4, -3.6]);
  assert.deepEqual(solution.desiredWorldTransform.position.map(round), [4, 1.4, -3.6]);
});

test("rejects incompatible socket module types", () => {
  const scene = semanticScene();
  scene.nodes.exit = {
    ...scene.nodes.exit,
    semantics: {
      ...scene.nodes.exit.semantics,
      module: "FireExtinguisher",
    },
  };

  assert.throws(
    () =>
      solveAttachment(scene, {
        moduleId: "exit",
        anchorId: "mount",
        targetId: "tunnel",
        socketId: "emergency-right",
      }),
    /does not accept module/i,
  );
});

test("reports unsafe TRS when parent transform introduces shear", () => {
  const scene = semanticScene();
  const parentMatrix = composeMat4(
    [0, 0, 0],
    [0, Math.sin(Math.PI / 8), 0, Math.cos(Math.PI / 8)],
    [2, 1, 1],
  );
  const parentTransform = {
    position: [0, 0, 0],
    rotation: [0, Math.sin(Math.PI / 8), 0, Math.cos(Math.PI / 8)],
    scale: [2, 1, 1],
    matrix: parentMatrix,
  };
  scene.nodes.parent = node("parent", parentTransform, { children: ["exit"] });
  scene.nodes.exit = { ...scene.nodes.exit, parentId: "parent" };
  scene.roots = ["tunnel", "parent"];

  const solution = solveAttachment(scene, {
    moduleId: "exit",
    anchorId: "mount",
    targetId: "tunnel",
    socketId: "emergency-right",
  });

  assert.equal(solution.safeToApplyTRS, false);
  assert.ok(solution.diagnostics.localShear > 1e-4);
});

function round(value) {
  return Math.round(value * 1e9) / 1e9;
}
