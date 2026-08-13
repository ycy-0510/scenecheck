import assert from "node:assert/strict";
import { test } from "node:test";
import {
  composeMat4,
  measureColliderRelation,
  resolveCollider,
} from "../dist/index.js";

const identity = transform();

function transform({ position = [0, 0, 0], rotation = [0, 0, 0, 1], scale = [1, 1, 1], matrix } = {}) {
  return {
    position,
    rotation,
    scale,
    ...(matrix ? { matrix } : {}),
  };
}

function box(id, size = [2, 2, 2], local = identity) {
  return { id, type: "box", size, transform: local };
}

function sphere(id, radius = 1, local = identity) {
  return { id, type: "sphere", radius, transform: local };
}

function node(id, worldTransform, colliders) {
  return {
    id,
    type: "Object3D",
    children: [],
    localTransform: worldTransform,
    worldTransform,
    semantics: { colliders },
  };
}

function scene(...nodes) {
  return {
    version: 1,
    roots: nodes.map((item) => item.id),
    nodes: Object.fromEntries(nodes.map((item) => [item.id, item])),
  };
}

test("resolveCollider composes node world transform with collider local pose", () => {
  const world = transform({ position: [10, 0, 0] });
  const local = transform({ position: [2, 3, 4] });
  const data = scene(node("car", world, [box("body", [2, 4, 6], local)]));

  const resolved = resolveCollider(data, "collider:car#body");
  assert.deepEqual(resolved.worldMatrix.slice(12, 15), [12, 3, 4]);
});

test("sphere-sphere distinguishes overlap, contact, and separation", () => {
  const a = node("a", transform({ position: [0, 0, 0] }), [sphere("shape", 1)]);

  let data = scene(a, node("b", transform({ position: [1.5, 0, 0] }), [sphere("shape", 1)]));
  assert.deepEqual(
    measureColliderRelation(data, "collider:a#shape", "collider:b#shape"),
    {
      status: "exact",
      pair: "sphere-sphere",
      from: "collider:a#shape",
      to: "collider:b#shape",
      intersects: true,
      strictlyOverlaps: true,
      touching: false,
    },
  );

  data = scene(a, node("b", transform({ position: [2, 0, 0] }), [sphere("shape", 1)]));
  assert.equal(
    measureColliderRelation(data, "collider:a#shape", "collider:b#shape").touching,
    true,
  );

  data = scene(a, node("b", transform({ position: [2.01, 0, 0] }), [sphere("shape", 1)]));
  assert.equal(
    measureColliderRelation(data, "collider:a#shape", "collider:b#shape").intersects,
    false,
  );
});

test("box-box uses oriented SAT and supports non-uniform scale", () => {
  const halfAngle = Math.PI / 8;
  const rotationY45 = [0, Math.sin(halfAngle), 0, Math.cos(halfAngle)];
  const a = node("a", transform({ scale: [2, 1, 0.5] }), [box("shape")]);
  const b = node(
    "b",
    transform({ position: [2.4, 0, 0], rotation: rotationY45, scale: [1, 2, 1] }),
    [box("shape")],
  );
  const exact = measureColliderRelation(
    scene(a, b),
    "collider:a#shape",
    "collider:b#shape",
  );
  assert.equal(exact.status, "exact");
  assert.equal(exact.pair, "box-box");
  assert.equal(exact.intersects, true);

  const separated = measureColliderRelation(
    scene(
      a,
      node(
        "b",
        transform({ position: [10, 0, 0], rotation: rotationY45, scale: [1, 2, 1] }),
        [box("shape")],
      ),
    ),
    "collider:a#shape",
    "collider:b#shape",
  );
  assert.equal(separated.status, "exact");
  assert.equal(separated.intersects, false);
});

test("sphere-box handles external contact exactly", () => {
  const data = scene(
    node("box", transform({ position: [0, 0, 0] }), [box("shape", [2, 2, 2])]),
    node("ball", transform({ position: [2, 0, 0] }), [sphere("shape", 1)]),
  );
  const relation = measureColliderRelation(
    data,
    "collider:ball#shape",
    "collider:box#shape",
  );
  assert.equal(relation.status, "exact");
  assert.equal(relation.pair, "sphere-box");
  assert.equal(relation.intersects, true);
  assert.equal(relation.strictlyOverlaps, false);
  assert.equal(relation.touching, true);
});

test("non-uniform sphere transforms return unsupported instead of ellipsoid approximation", () => {
  const data = scene(
    node("ball", transform({ scale: [2, 1, 1] }), [sphere("shape", 1)]),
    node("box", identity, [box("shape")]),
  );
  const relation = measureColliderRelation(
    data,
    "collider:ball#shape",
    "collider:box#shape",
  );
  assert.equal(relation.status, "unsupported");
  assert.match(relation.reason, /ellipsoid/i);
});

test("sheared box transforms return unsupported rather than an OBB approximation", () => {
  const shearMatrix = [
    1, 0, 0, 0,
    0.5, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ];
  const data = scene(
    node("a", transform({ matrix: shearMatrix }), [box("shape")]),
    node("b", identity, [box("shape")]),
  );
  const relation = measureColliderRelation(
    data,
    "collider:a#shape",
    "collider:b#shape",
  );
  assert.equal(relation.status, "unsupported");
  assert.match(relation.reason, /shear/i);
});

test("collider reference failures are explicit", () => {
  const data = scene(node("car", identity, [box("body")]));
  assert.throws(
    () => resolveCollider(data, "car#body"),
    /collider:<node-id>#<collider-id>/,
  );
  assert.throws(
    () => resolveCollider(data, "collider:car#missing"),
    /collider not found/i,
  );
});

test("composed matrix paths preserve rotation and scale in relation checks", () => {
  const yaw90 = [0, Math.sin(Math.PI / 4), 0, Math.cos(Math.PI / 4)];
  const matrix = composeMat4([0, 0, 0], yaw90, [3, 1, 1]);
  const data = scene(
    node("road", transform({ matrix }), [box("hitbox", [2, 2, 2])]),
    node("probe", transform({ position: [0, 0, -2.5] }), [sphere("shape", 0.6)]),
  );
  const relation = measureColliderRelation(
    data,
    "collider:road#hitbox",
    "collider:probe#shape",
  );
  assert.equal(relation.status, "exact");
  assert.equal(relation.intersects, true);
});
