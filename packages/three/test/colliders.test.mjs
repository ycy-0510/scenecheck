import assert from "node:assert/strict";
import { test } from "node:test";
import { Group, Scene } from "three";
import { describeThreeObject, fromThreeScene } from "../dist/index.js";

test("registered box and sphere colliders enter Scene IR as local semantic shapes", () => {
  const scene = new Scene();
  const car = new Group();
  car.position.set(10, 2, -4);
  describeThreeObject(car, {
    id: "car",
    module: "PlayerCar",
    colliders: [
      {
        id: "body",
        type: "box",
        position: [0, 0.6, 0],
        rotation: [0, 0, 0, 1],
        size: [2, 1.2, 4.5],
      },
      {
        id: "bumper-probe",
        type: "sphere",
        position: [0, 0.5, -2.4],
        radius: 0.35,
      },
    ],
  });
  scene.add(car);

  const ir = fromThreeScene(scene);
  const colliders = ir.nodes.car?.semantics?.colliders;
  assert.equal(colliders?.length, 2);
  assert.deepEqual(colliders?.[0], {
    id: "body",
    type: "box",
    transform: {
      position: [0, 0.6, 0],
      rotation: [0, 0, 0, 1],
      scale: [1, 1, 1],
    },
    size: [2, 1.2, 4.5],
  });
  assert.deepEqual(colliders?.[1], {
    id: "bumper-probe",
    type: "sphere",
    transform: {
      position: [0, 0.5, -2.4],
      rotation: [0, 0, 0, 1],
      scale: [1, 1, 1],
    },
    radius: 0.35,
  });

  // Collider poses stay object-local even though the owning object is translated.
  assert.deepEqual(ir.nodes.car?.worldTransform.position, [10, 2, -4]);
  assert.deepEqual(colliders?.[0]?.transform.position, [0, 0.6, 0]);
});

test("collider registration rejects duplicate IDs and invalid dimensions", () => {
  assert.throws(
    () =>
      describeThreeObject(new Group(), {
        colliders: [
          { id: "body", type: "box", size: [1, 1, 1] },
          { id: "body", type: "sphere", radius: 1 },
        ],
      }),
    /duplicate.*collider/i,
  );

  assert.throws(
    () =>
      describeThreeObject(new Group(), {
        colliders: [{ id: "flat", type: "box", size: [1, 0, 1] }],
      }),
    /must all be positive/i,
  );

  assert.throws(
    () =>
      describeThreeObject(new Group(), {
        colliders: [{ id: "bad", type: "sphere", radius: Number.NaN }],
      }),
    /positive finite/i,
  );
});

test("Scene IR gets detached collider arrays instead of exposing mutable userData references", () => {
  const scene = new Scene();
  const object = new Group();
  describeThreeObject(object, {
    id: "object",
    colliders: [{ id: "body", type: "box", size: [1, 2, 3] }],
  });
  scene.add(object);

  const first = fromThreeScene(scene);
  const captured = first.nodes.object?.semantics?.colliders?.[0];
  assert.ok(captured && captured.type === "box");
  captured.size[0] = 99;

  const second = fromThreeScene(scene);
  assert.deepEqual(second.nodes.object?.semantics?.colliders?.[0]?.size, [1, 2, 3]);
});
