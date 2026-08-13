import type {
  BoxCollisionShape,
  CollisionShape,
  SphereCollisionShape,
} from "./collision.js";
import type { Mat4, SceneIR, SceneNode, Vec3 } from "./index.js";
import { multiplyMat4, transformToMat4 } from "./matrix.js";

export interface ColliderRelationOptions {
  /** Numerical tolerance used for orthogonality/contact tests. Default: 1e-8. */
  tolerance?: number;
}

export type ColliderPairType = "box-box" | "sphere-sphere" | "sphere-box";

export interface ResolvedCollider {
  reference: string;
  nodeId: string;
  colliderId: string;
  node: SceneNode;
  shape: CollisionShape;
  /** Exact world matrix for the collider's local primitive before size/radius is applied. */
  worldMatrix: Mat4;
}

export interface ExactColliderRelation {
  status: "exact";
  pair: ColliderPairType;
  from: string;
  to: string;
  intersects: boolean;
  /** True only when the interiors overlap; contact-only cases are false. */
  strictlyOverlaps: boolean;
  /** True when the shapes intersect but only at their boundary within tolerance. */
  touching: boolean;
}

export interface UnsupportedColliderRelation {
  status: "unsupported";
  pair: ColliderPairType;
  from: string;
  to: string;
  reason: string;
}

export type ColliderRelation = ExactColliderRelation | UnsupportedColliderRelation;

interface WorldBox {
  center: Vec3;
  axes: readonly [Vec3, Vec3, Vec3];
  halfExtents: Vec3;
}

interface WorldSphere {
  center: Vec3;
  radius: number;
}

interface UnsupportedShape {
  reason: string;
}

/**
 * Resolve `collider:<node-id>#<collider-id>` to its declared shape and exact world matrix.
 */
export function resolveCollider(scene: SceneIR, reference: string): ResolvedCollider {
  const parsed = parseColliderReference(reference);
  const node = scene.nodes[parsed.nodeId];
  if (!node) {
    throw new Error(`SceneCheck collider node not found: "${parsed.nodeId}".`);
  }

  const shape = node.semantics?.colliders?.find((item) => item.id === parsed.colliderId);
  if (!shape) {
    throw new Error(
      `SceneCheck collider not found: "${parsed.colliderId}" on node "${parsed.nodeId}".`,
    );
  }

  return {
    reference,
    nodeId: parsed.nodeId,
    colliderId: parsed.colliderId,
    node,
    shape,
    worldMatrix: multiplyMat4(
      transformToMat4(node.worldTransform),
      transformToMat4(shape.transform),
    ),
  };
}

/**
 * Exact CPU intersection test for registered box/sphere colliders when their composed transforms
 * preserve the primitive class. Boxes support rotation + non-uniform scale. Spheres require
 * uniform scale. Sheared primitives return `unsupported` rather than an approximation.
 */
export function measureColliderRelation(
  scene: SceneIR,
  from: string,
  to: string,
  options: ColliderRelationOptions = {},
): ColliderRelation {
  const tolerance = normalizeTolerance(options.tolerance);
  const a = resolveCollider(scene, from);
  const b = resolveCollider(scene, to);
  const pair = pairType(a.shape, b.shape);

  if (a.shape.type === "box" && b.shape.type === "box") {
    const boxA = worldBox(a, a.shape, tolerance);
    if (isUnsupported(boxA)) return unsupported(pair, from, to, `from: ${boxA.reason}`);
    const boxB = worldBox(b, b.shape, tolerance);
    if (isUnsupported(boxB)) return unsupported(pair, from, to, `to: ${boxB.reason}`);
    return boxBoxRelation(boxA, boxB, from, to, tolerance);
  }

  if (a.shape.type === "sphere" && b.shape.type === "sphere") {
    const sphereA = worldSphere(a, a.shape, tolerance);
    if (isUnsupported(sphereA)) return unsupported(pair, from, to, `from: ${sphereA.reason}`);
    const sphereB = worldSphere(b, b.shape, tolerance);
    if (isUnsupported(sphereB)) return unsupported(pair, from, to, `to: ${sphereB.reason}`);
    return sphereSphereRelation(sphereA, sphereB, from, to, tolerance);
  }

  if (a.shape.type === "sphere" && b.shape.type === "box") {
    const sphere = worldSphere(a, a.shape, tolerance);
    if (isUnsupported(sphere)) return unsupported(pair, from, to, `from: ${sphere.reason}`);
    const box = worldBox(b, b.shape, tolerance);
    if (isUnsupported(box)) return unsupported(pair, from, to, `to: ${box.reason}`);
    return sphereBoxRelation(sphere, box, from, to, tolerance);
  }

  if (a.shape.type === "box" && b.shape.type === "sphere") {
    const box = worldBox(a, a.shape, tolerance);
    if (isUnsupported(box)) return unsupported(pair, from, to, `from: ${box.reason}`);
    const sphere = worldSphere(b, b.shape, tolerance);
    if (isUnsupported(sphere)) return unsupported(pair, from, to, `to: ${sphere.reason}`);
    return sphereBoxRelation(sphere, box, from, to, tolerance);
  }

  throw new Error(
    `Unsupported SceneCheck collider pair: ${String(a.shape.type)} / ${String(b.shape.type)}.`,
  );
}

function parseColliderReference(reference: string): { nodeId: string; colliderId: string } {
  if (!reference.startsWith("collider:")) {
    throw new Error(
      `Collider reference must use collider:<node-id>#<collider-id>. Received: "${reference}".`,
    );
  }
  const body = reference.slice("collider:".length);
  const separator = body.lastIndexOf("#");
  if (separator <= 0 || separator === body.length - 1) {
    throw new Error(
      `Collider reference must use collider:<node-id>#<collider-id>. Received: "${reference}".`,
    );
  }
  return {
    nodeId: body.slice(0, separator),
    colliderId: body.slice(separator + 1),
  };
}

function worldBox(
  collider: ResolvedCollider,
  shape: BoxCollisionShape,
  tolerance: number,
): WorldBox | UnsupportedShape {
  const basis = orthogonalBasis(collider.worldMatrix, tolerance);
  if (isUnsupported(basis)) return basis;

  return {
    center: translation(collider.worldMatrix),
    axes: basis.axes,
    halfExtents: [
      (basis.scales[0] * shape.size[0]) / 2,
      (basis.scales[1] * shape.size[1]) / 2,
      (basis.scales[2] * shape.size[2]) / 2,
    ],
  };
}

function worldSphere(
  collider: ResolvedCollider,
  shape: SphereCollisionShape,
  tolerance: number,
): WorldSphere | UnsupportedShape {
  const basis = orthogonalBasis(collider.worldMatrix, tolerance);
  if (isUnsupported(basis)) return basis;

  const maximum = Math.max(...basis.scales);
  const minimum = Math.min(...basis.scales);
  const uniformTolerance = tolerance * Math.max(1, maximum);
  if (maximum - minimum > uniformTolerance) {
    return {
      reason:
        "sphere becomes an ellipsoid under non-uniform scale; exact sphere relation is unsupported",
    };
  }

  return {
    center: translation(collider.worldMatrix),
    radius:
      shape.radius *
      ((basis.scales[0] + basis.scales[1] + basis.scales[2]) / 3),
  };
}

function orthogonalBasis(
  matrix: Mat4,
  tolerance: number,
):
  | { axes: readonly [Vec3, Vec3, Vec3]; scales: Vec3 }
  | UnsupportedShape {
  if (!matrix.every(Number.isFinite)) {
    return { reason: "collider world transform contains non-finite values" };
  }
  if (
    Math.abs(matrix[3]) > tolerance ||
    Math.abs(matrix[7]) > tolerance ||
    Math.abs(matrix[11]) > tolerance ||
    Math.abs(matrix[15] - 1) > tolerance
  ) {
    return { reason: "collider transform is not affine" };
  }

  const columns: readonly [Vec3, Vec3, Vec3] = [
    [matrix[0], matrix[1], matrix[2]],
    [matrix[4], matrix[5], matrix[6]],
    [matrix[8], matrix[9], matrix[10]],
  ];
  const scales: Vec3 = [length3(columns[0]), length3(columns[1]), length3(columns[2])];
  if (scales.some((value) => value <= tolerance)) {
    return { reason: "collider transform has a degenerate zero-scale axis" };
  }

  const axes: readonly [Vec3, Vec3, Vec3] = [
    scale3(columns[0], 1 / scales[0]),
    scale3(columns[1], 1 / scales[1]),
    scale3(columns[2], 1 / scales[2]),
  ];
  const shear = Math.max(
    Math.abs(dot3(axes[0], axes[1])),
    Math.abs(dot3(axes[0], axes[2])),
    Math.abs(dot3(axes[1], axes[2])),
  );
  if (shear > tolerance) {
    return {
      reason: `collider transform contains shear (normalized axis dot=${formatNumber(shear)})`,
    };
  }

  return { axes, scales };
}

function sphereSphereRelation(
  a: WorldSphere,
  b: WorldSphere,
  from: string,
  to: string,
  tolerance: number,
): ExactColliderRelation {
  const distance = length3(sub3(b.center, a.center));
  const radius = a.radius + b.radius;
  const intersects = distance <= radius + tolerance;
  const strictlyOverlaps = distance < radius - tolerance;
  return exact("sphere-sphere", from, to, intersects, strictlyOverlaps);
}

function sphereBoxRelation(
  sphere: WorldSphere,
  box: WorldBox,
  from: string,
  to: string,
  tolerance: number,
): ExactColliderRelation {
  const delta = sub3(sphere.center, box.center);
  let closest = box.center;

  for (let index = 0; index < 3; index += 1) {
    const axis = box.axes[index]!;
    const extent = box.halfExtents[index]!;
    const projected = clamp(dot3(delta, axis), -extent, extent);
    closest = add3(closest, scale3(axis, projected));
  }

  const distance = length3(sub3(sphere.center, closest));
  const intersects = distance <= sphere.radius + tolerance;
  const strictlyOverlaps = distance < sphere.radius - tolerance;
  return exact("sphere-box", from, to, intersects, strictlyOverlaps);
}

function boxBoxRelation(
  a: WorldBox,
  b: WorldBox,
  from: string,
  to: string,
  tolerance: number,
): ExactColliderRelation {
  const axes: Vec3[] = [...a.axes, ...b.axes];
  for (const axisA of a.axes) {
    for (const axisB of b.axes) {
      const cross = cross3(axisA, axisB);
      const length = length3(cross);
      if (length > tolerance) axes.push(scale3(cross, 1 / length));
    }
  }

  const delta = sub3(b.center, a.center);
  let minimumOverlap = Number.POSITIVE_INFINITY;
  for (const axis of axes) {
    const distance = Math.abs(dot3(delta, axis));
    const radiusA = projectionRadius(a, axis);
    const radiusB = projectionRadius(b, axis);
    const overlap = radiusA + radiusB - distance;
    if (overlap < -tolerance) {
      return exact("box-box", from, to, false, false);
    }
    minimumOverlap = Math.min(minimumOverlap, overlap);
  }

  return exact(
    "box-box",
    from,
    to,
    true,
    minimumOverlap > tolerance,
  );
}

function projectionRadius(box: WorldBox, axis: Vec3): number {
  return (
    box.halfExtents[0] * Math.abs(dot3(box.axes[0], axis)) +
    box.halfExtents[1] * Math.abs(dot3(box.axes[1], axis)) +
    box.halfExtents[2] * Math.abs(dot3(box.axes[2], axis))
  );
}

function pairType(a: CollisionShape, b: CollisionShape): ColliderPairType {
  if (a.type === "box" && b.type === "box") return "box-box";
  if (a.type === "sphere" && b.type === "sphere") return "sphere-sphere";
  return "sphere-box";
}

function exact(
  pair: ColliderPairType,
  from: string,
  to: string,
  intersects: boolean,
  strictlyOverlaps: boolean,
): ExactColliderRelation {
  return {
    status: "exact",
    pair,
    from,
    to,
    intersects,
    strictlyOverlaps,
    touching: intersects && !strictlyOverlaps,
  };
}

function unsupported(
  pair: ColliderPairType,
  from: string,
  to: string,
  reason: string,
): UnsupportedColliderRelation {
  return { status: "unsupported", pair, from, to, reason };
}

function isUnsupported<T extends object>(
  value: T | UnsupportedShape,
): value is UnsupportedShape {
  return "reason" in value;
}

function normalizeTolerance(value: number | undefined): number {
  if (value === undefined) return 1e-8;
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Collider relation tolerance must be finite and non-negative. Received: ${value}`);
  }
  return value;
}

function translation(matrix: Mat4): Vec3 {
  return [matrix[12], matrix[13], matrix[14]];
}

function add3(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function sub3(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function scale3(value: Vec3, scalar: number): Vec3 {
  return [value[0] * scalar, value[1] * scalar, value[2] * scalar];
}

function dot3(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross3(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function length3(value: Vec3): number {
  return Math.hypot(value[0], value[1], value[2]);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function formatNumber(value: number): string {
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(9).replace(/0+$/, "").replace(/\.$/, "");
}
