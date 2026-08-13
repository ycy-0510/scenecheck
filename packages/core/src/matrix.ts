import type { Mat4, Quat, Transform, Vec3 } from "./index.js";

export interface MatrixDecomposition {
  transform: Transform;
  shear: number;
  reconstructionError: number;
  representableAsTRS: boolean;
}

export function identityMat4(): Mat4 {
  return [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ];
}

export function transformToMat4(transform: Transform): Mat4 {
  if (transform.matrix) return cloneMat4(transform.matrix);
  return composeMat4(transform.position, transform.rotation, transform.scale);
}

export function composeMat4(position: Vec3, rotation: Quat, scale: Vec3): Mat4 {
  const [x, y, z, w] = normalizeQuat(rotation);
  const x2 = x + x;
  const y2 = y + y;
  const z2 = z + z;
  const xx = x * x2;
  const xy = x * y2;
  const xz = x * z2;
  const yy = y * y2;
  const yz = y * z2;
  const zz = z * z2;
  const wx = w * x2;
  const wy = w * y2;
  const wz = w * z2;
  const sx = scale[0];
  const sy = scale[1];
  const sz = scale[2];

  return [
    (1 - (yy + zz)) * sx,
    (xy + wz) * sx,
    (xz - wy) * sx,
    0,
    (xy - wz) * sy,
    (1 - (xx + zz)) * sy,
    (yz + wx) * sy,
    0,
    (xz + wy) * sz,
    (yz - wx) * sz,
    (1 - (xx + yy)) * sz,
    0,
    position[0],
    position[1],
    position[2],
    1,
  ];
}

export function multiplyMat4(a: Mat4, b: Mat4): Mat4 {
  const out = new Array<number>(16).fill(0);
  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      let value = 0;
      for (let k = 0; k < 4; k += 1) {
        value += a[k * 4 + row]! * b[column * 4 + k]!;
      }
      out[column * 4 + row] = value;
    }
  }
  return out as unknown as Mat4;
}

export function invertMat4(matrix: Mat4): Mat4 {
  const a00 = matrix[0];
  const a01 = matrix[1];
  const a02 = matrix[2];
  const a03 = matrix[3];
  const a10 = matrix[4];
  const a11 = matrix[5];
  const a12 = matrix[6];
  const a13 = matrix[7];
  const a20 = matrix[8];
  const a21 = matrix[9];
  const a22 = matrix[10];
  const a23 = matrix[11];
  const a30 = matrix[12];
  const a31 = matrix[13];
  const a32 = matrix[14];
  const a33 = matrix[15];

  const b00 = a00 * a11 - a01 * a10;
  const b01 = a00 * a12 - a02 * a10;
  const b02 = a00 * a13 - a03 * a10;
  const b03 = a01 * a12 - a02 * a11;
  const b04 = a01 * a13 - a03 * a11;
  const b05 = a02 * a13 - a03 * a12;
  const b06 = a20 * a31 - a21 * a30;
  const b07 = a20 * a32 - a22 * a30;
  const b08 = a20 * a33 - a23 * a30;
  const b09 = a21 * a32 - a22 * a31;
  const b10 = a21 * a33 - a23 * a31;
  const b11 = a22 * a33 - a23 * a32;

  let determinant =
    b00 * b11 -
    b01 * b10 +
    b02 * b09 +
    b03 * b08 -
    b04 * b07 +
    b05 * b06;

  if (Math.abs(determinant) < 1e-15) {
    throw new Error("Cannot invert a singular SceneCheck transform matrix.");
  }
  determinant = 1 / determinant;

  return [
    (a11 * b11 - a12 * b10 + a13 * b09) * determinant,
    (a02 * b10 - a01 * b11 - a03 * b09) * determinant,
    (a31 * b05 - a32 * b04 + a33 * b03) * determinant,
    (a22 * b04 - a21 * b05 - a23 * b03) * determinant,
    (a12 * b08 - a10 * b11 - a13 * b07) * determinant,
    (a00 * b11 - a02 * b08 + a03 * b07) * determinant,
    (a32 * b02 - a30 * b05 - a33 * b01) * determinant,
    (a20 * b05 - a22 * b02 + a23 * b01) * determinant,
    (a10 * b10 - a11 * b08 + a13 * b06) * determinant,
    (a01 * b08 - a00 * b10 - a03 * b06) * determinant,
    (a30 * b04 - a31 * b02 + a33 * b00) * determinant,
    (a21 * b02 - a20 * b04 - a23 * b00) * determinant,
    (a11 * b07 - a10 * b09 - a12 * b06) * determinant,
    (a00 * b09 - a01 * b07 + a02 * b06) * determinant,
    (a31 * b01 - a30 * b03 - a32 * b00) * determinant,
    (a20 * b03 - a21 * b01 + a22 * b00) * determinant,
  ];
}

export function decomposeMat4(
  matrix: Mat4,
  tolerance = 1e-8,
): MatrixDecomposition {
  const position: Vec3 = [matrix[12], matrix[13], matrix[14]];
  const column0: Vec3 = [matrix[0], matrix[1], matrix[2]];
  const column1: Vec3 = [matrix[4], matrix[5], matrix[6]];
  const column2: Vec3 = [matrix[8], matrix[9], matrix[10]];

  let sx = length3(column0);
  const sy = length3(column1);
  const sz = length3(column2);
  if (sx === 0 || sy === 0 || sz === 0) {
    throw new Error("Cannot decompose a SceneCheck transform with zero scale.");
  }

  const determinant3 =
    matrix[0] * (matrix[5] * matrix[10] - matrix[9] * matrix[6]) -
    matrix[4] * (matrix[1] * matrix[10] - matrix[9] * matrix[2]) +
    matrix[8] * (matrix[1] * matrix[6] - matrix[5] * matrix[2]);
  if (determinant3 < 0) sx = -sx;

  const axisX = scale3(column0, 1 / sx);
  const axisY = scale3(column1, 1 / sy);
  const axisZ = scale3(column2, 1 / sz);
  const shear = Math.max(
    Math.abs(dot3(axisX, axisY)),
    Math.abs(dot3(axisX, axisZ)),
    Math.abs(dot3(axisY, axisZ)),
  );

  const rotation = quatFromRotationColumns(axisX, axisY, axisZ);
  const transform: Transform = {
    position,
    rotation,
    scale: [sx, sy, sz],
    matrix: cloneMat4(matrix),
  };
  const reconstructed = composeMat4(position, rotation, transform.scale);
  const reconstructionError = maxMatrixError(matrix, reconstructed);

  return {
    transform,
    shear,
    reconstructionError,
    representableAsTRS: shear <= tolerance && reconstructionError <= tolerance,
  };
}

export function maxMatrixError(a: Mat4, b: Mat4): number {
  let maximum = 0;
  for (let index = 0; index < 16; index += 1) {
    maximum = Math.max(maximum, Math.abs(a[index] - b[index]));
  }
  return maximum;
}

function quatFromRotationColumns(xAxis: Vec3, yAxis: Vec3, zAxis: Vec3): Quat {
  const m11 = xAxis[0];
  const m21 = xAxis[1];
  const m31 = xAxis[2];
  const m12 = yAxis[0];
  const m22 = yAxis[1];
  const m32 = yAxis[2];
  const m13 = zAxis[0];
  const m23 = zAxis[1];
  const m33 = zAxis[2];
  const trace = m11 + m22 + m33;

  let x: number;
  let y: number;
  let z: number;
  let w: number;

  if (trace > 0) {
    const s = 0.5 / Math.sqrt(trace + 1);
    w = 0.25 / s;
    x = (m32 - m23) * s;
    y = (m13 - m31) * s;
    z = (m21 - m12) * s;
  } else if (m11 > m22 && m11 > m33) {
    const s = 2 * Math.sqrt(1 + m11 - m22 - m33);
    w = (m32 - m23) / s;
    x = 0.25 * s;
    y = (m12 + m21) / s;
    z = (m13 + m31) / s;
  } else if (m22 > m33) {
    const s = 2 * Math.sqrt(1 + m22 - m11 - m33);
    w = (m13 - m31) / s;
    x = (m12 + m21) / s;
    y = 0.25 * s;
    z = (m23 + m32) / s;
  } else {
    const s = 2 * Math.sqrt(1 + m33 - m11 - m22);
    w = (m21 - m12) / s;
    x = (m13 + m31) / s;
    y = (m23 + m32) / s;
    z = 0.25 * s;
  }

  return normalizeQuat([x, y, z, w]);
}

function normalizeQuat(value: Quat): Quat {
  const length = Math.hypot(value[0], value[1], value[2], value[3]);
  if (length === 0) throw new Error("Cannot normalize a zero-length quaternion.");
  return [value[0] / length, value[1] / length, value[2] / length, value[3] / length];
}

function length3(value: Vec3): number {
  return Math.hypot(value[0], value[1], value[2]);
}

function dot3(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function scale3(value: Vec3, scalar: number): Vec3 {
  return [value[0] * scalar, value[1] * scalar, value[2] * scalar];
}

function cloneMat4(value: Mat4): Mat4 {
  return [...value] as unknown as Mat4;
}
