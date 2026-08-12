import assert from "node:assert/strict";
import { test } from "node:test";
import {
  composeMat4,
  decomposeMat4,
  identityMat4,
  invertMat4,
  maxMatrixError,
  multiplyMat4,
} from "../dist/index.js";

const epsilon = 1e-10;

function assertNear(actual, expected, tolerance = epsilon) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
}

function assertMatrixNear(actual, expected, tolerance = epsilon) {
  for (let index = 0; index < 16; index += 1) {
    assertNear(actual[index], expected[index], tolerance);
  }
}

test("compose and decompose preserve ordinary TRS", () => {
  const matrix = composeMat4(
    [4, -2, 7],
    [0, Math.SQRT1_2, 0, Math.SQRT1_2],
    [2, 3, 4],
  );
  const result = decomposeMat4(matrix);

  assert.equal(result.representableAsTRS, true);
  assert.ok(result.shear <= epsilon);
  assert.ok(result.reconstructionError <= epsilon);
  assert.deepEqual(result.transform.position, [4, -2, 7]);
  assert.deepEqual(result.transform.scale, [2, 3, 4]);
  assertMatrixNear(
    composeMat4(
      result.transform.position,
      result.transform.rotation,
      result.transform.scale,
    ),
    matrix,
  );
});

test("matrix multiplied by its inverse returns identity", () => {
  const matrix = composeMat4(
    [3, 5, -4],
    [0.1825741858, 0.3651483717, 0.5477225575, 0.7302967433],
    [2, 1.5, 0.75],
  );

  assertMatrixNear(multiplyMat4(matrix, invertMat4(matrix)), identityMat4(), 1e-9);
  assertMatrixNear(multiplyMat4(invertMat4(matrix), matrix), identityMat4(), 1e-9);
});

test("decomposition identifies shear as unsafe for ordinary Object3D TRS", () => {
  const sheared = [
    1, 0, 0, 0,
    0.5, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ];
  const result = decomposeMat4(sheared);

  assert.equal(result.representableAsTRS, false);
  assert.ok(result.shear > 0.1);
  assert.ok(result.reconstructionError > 0.1);
});

test("matrix reconstruction error reports exact equality and visible mismatch", () => {
  const identity = identityMat4();
  assert.equal(maxMatrixError(identity, identity), 0);

  const changed = [...identity];
  changed[12] = 0.25;
  assert.equal(maxMatrixError(identity, changed), 0.25);
});

test("singular matrices cannot be inverted", () => {
  const singular = composeMat4([0, 0, 0], [0, 0, 0, 1], [1, 0, 1]);
  assert.throws(() => invertMat4(singular), /singular/i);
});
