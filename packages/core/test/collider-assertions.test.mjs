import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluateAssertion, validateScene } from "../dist/index.js";

const identity = {
  position: [0, 0, 0],
  rotation: [0, 0, 0, 1],
  scale: [1, 1, 1],
};

function node(id, position, collider, scale = [1, 1, 1]) {
  const worldTransform = { ...identity, position, scale };
  return {
    id,
    type: "Object3D",
    children: [],
    localTransform: worldTransform,
    worldTransform,
    semantics: { colliders: [collider] },
  };
}

function scene(...nodes) {
  return {
    version: 1,
    roots: nodes.map((item) => item.id),
    nodes: Object.fromEntries(nodes.map((item) => [item.id, item])),
  };
}

const box = {
  id: "shape",
  type: "box",
  size: [2, 2, 2],
  transform: identity,
};

const sphere = {
  id: "shape",
  type: "sphere",
  radius: 1,
  transform: identity,
};

test("collider-intersection assertion distinguishes contact from strict overlap", () => {
  const data = scene(
    node("a", [0, 0, 0], box),
    node("b", [2, 0, 0], box),
  );

  const closed = evaluateAssertion(data, {
    id: "contact-counts",
    type: "collider-intersection",
    a: "collider:a#shape",
    b: "collider:b#shape",
    expected: true,
  });
  const strict = evaluateAssertion(data, {
    id: "contact-is-not-overlap",
    type: "collider-intersection",
    a: "collider:a#shape",
    b: "collider:b#shape",
    expected: false,
    strict: true,
  });

  assert.equal(closed.pass, true);
  assert.equal(closed.actual, true);
  assert.equal(closed.unit, "boolean");
  assert.equal(strict.pass, true);
  assert.equal(strict.actual, false);
});

test("unsupported exact collider geometry becomes an explicit failed assertion", () => {
  const data = scene(
    node("ball", [0, 0, 0], sphere, [2, 1, 1]),
    node("wall", [10, 0, 0], box),
  );

  const result = evaluateAssertion(data, {
    id: "no-hit",
    type: "collider-intersection",
    a: "collider:ball#shape",
    b: "collider:wall#shape",
    expected: false,
  });

  assert.equal(result.pass, false);
  assert.equal(result.actual, "unsupported");
  assert.equal(result.unit, "status");
  assert.match(result.message, /ellipsoid/i);
});

test("collider assertions participate in aggregate CI validation", () => {
  const data = scene(
    node("a", [0, 0, 0], box),
    node("b", [4, 0, 0], box),
  );
  const result = validateScene(data, [
    {
      id: "separate",
      type: "collider-intersection",
      a: "collider:a#shape",
      b: "collider:b#shape",
      expected: false,
    },
  ]);

  assert.equal(result.ok, true);
  assert.equal(result.passed, 1);
  assert.equal(result.failed, 0);
});

test("collider assertions require collider references", () => {
  const data = scene(node("a", [0, 0, 0], box));
  assert.throws(
    () =>
      evaluateAssertion(data, {
        id: "bad-ref",
        type: "collider-intersection",
        a: "a",
        b: "collider:a#shape",
        expected: true,
      }),
    /collider:<node-id>#<collider-id>/i,
  );
});
