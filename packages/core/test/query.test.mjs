import assert from "node:assert/strict";
import { test } from "node:test";
import { queryScene, summarizeScene } from "../dist/index.js";

const transform = {
  position: [0, 0, 0],
  rotation: [0, 0, 0, 1],
  scale: [1, 1, 1],
};

const scene = {
  version: 1,
  roots: ["World"],
  nodes: {
    World: {
      id: "World",
      name: "World",
      type: "Group",
      children: ["road-main", "Tunnel"],
      localTransform: transform,
      worldTransform: transform,
    },
    "road-main": {
      id: "road-main",
      name: "Main Road",
      type: "Mesh",
      parentId: "World",
      children: [],
      localTransform: transform,
      worldTransform: transform,
      bounds: { min: [-5, 0, -20], max: [5, 1, 20] },
    },
    Tunnel: {
      id: "Tunnel",
      name: "Emergency Tunnel",
      type: "Group",
      parentId: "World",
      children: [],
      localTransform: transform,
      worldTransform: transform,
    },
  },
};

test("queries nodes by exact id", () => {
  const result = queryScene(scene, { id: "road-main" });
  assert.equal(result.total, 1);
  assert.equal(result.nodes[0]?.name, "Main Road");
});

test("queries names and types case-insensitively", () => {
  assert.equal(queryScene(scene, { name: "main road" }).total, 1);
  assert.equal(queryScene(scene, { type: "mesh" }).total, 1);
});

test("supports substring search and result limits", () => {
  const result = queryScene(scene, { text: "o", limit: 2 });
  assert.equal(result.total, 3);
  assert.equal(result.nodes.length, 2);
  assert.equal(result.truncated, true);
});

test("summarizes a scene without returning every node", () => {
  assert.deepEqual(summarizeScene(scene), {
    roots: ["World"],
    rootCount: 1,
    nodeCount: 3,
    namedNodeCount: 3,
    boundedNodeCount: 1,
    types: {
      Group: 2,
      Mesh: 1,
    },
  });
});
