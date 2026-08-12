import type { Mat4, Quat, SceneIR, SceneNode, Transform, Vec3 } from "./index.js";

export type SceneReferenceKind = "node" | "anchor" | "socket";

export interface ParsedSceneReference {
  kind: SceneReferenceKind;
  nodeId: string;
  semanticId?: string;
}

export interface ResolvedSceneReference extends ParsedSceneReference {
  reference: string;
  worldPosition: Vec3;
  worldRotation: Quat;
}

export interface DistanceMeasurement {
  kind: "distance";
  from: ResolvedSceneReference;
  to: ResolvedSceneReference;
  delta: Vec3;
  distance: number;
}

export interface AngleMeasurement {
  kind: "angle";
  from: ResolvedSceneReference;
  to: ResolvedSceneReference;
  radians: number;
  degrees: number;
}

/**
 * Reference syntax:
 * - `node-id` or `node:node-id` for an object origin
 * - `anchor:node-id#anchor-id` for a semantic anchor
 * - `socket:node-id#socket-id` for a semantic socket
 *
 * The final `#` separates semantic IDs, so node IDs may themselves contain `#`.
 */
export function parseSceneReference(reference: string): ParsedSceneReference {
  const value = reference.trim();
  if (!value) throw new Error("Scene reference cannot be empty.");

  if (value.startsWith("node:")) {
    return {
      kind: "node",
      nodeId: requireNodeId(value.slice("node:".length), reference),
    };
  }

  if (value.startsWith("anchor:")) {
    return parseSemanticReference("anchor", value.slice("anchor:".length), reference);
  }

  if (value.startsWith("socket:")) {
    return parseSemanticReference("socket", value.slice("socket:".length), reference);
  }

  return { kind: "node", nodeId: value };
}

export function resolveSceneReference(
  scene: SceneIR,
  reference: string,
): ResolvedSceneReference {
  const parsed = parseSceneReference(reference);
  const node = scene.nodes[parsed.nodeId];
  if (!node) {
    throw new Error(`SceneCheck node not found: "${parsed.nodeId}".`);
  }

  if (parsed.kind === "node") {
    return {
      ...parsed,
      reference,
      worldPosition: cloneVec3(node.worldTransform.position),
      worldRotation: normalizeQuat(node.worldTransform.rotation),
    };
  }

  const localTransform = resolveSemanticTransform(node, parsed);
  return {
    ...parsed,
    reference,
    worldPosition: transformLocalPoint(node.worldTransform, localTransform.position),
    worldRotation: normalizeQuat(
      multiplyQuat(node.worldTransform.rotation, localTransform.rotation),
    ),
  };
}

export function measureDistance(
  scene: SceneIR,
  fromReference: string,
  toReference: string,
): DistanceMeasurement {
  const from = resolveSceneReference(scene, fromReference);
  const to = resolveSceneReference(scene, toReference);
  const delta: Vec3 = [
    to.worldPosition[0] - from.worldPosition[0],
    to.worldPosition[1] - from.worldPosition[1],
    to.worldPosition[2] - from.worldPosition[2],
  ];

  return {
    kind: "distance",
    from,
    to,
    delta,
    distance: Math.hypot(delta[0], delta[1], delta[2]),
  };
}

export function measureAngle(
  scene: SceneIR,
  fromReference: string,
  toReference: string,
): AngleMeasurement {
  const from = resolveSceneReference(scene, fromReference);
  const to = resolveSceneReference(scene, toReference);
  const dot = Math.abs(quatDot(from.worldRotation, to.worldRotation));
  const radians = 2 * Math.acos(clamp(dot, -1, 1));

  return {
    kind: "angle",
    from,
    to,
    radians,
    degrees: (radians * 180) / Math.PI,
  };
}

function parseSemanticReference(
  kind: "anchor" | "socket",
  body: string,
  original: string,
): ParsedSceneReference {
  const separator = body.lastIndexOf("#");
  if (separator <= 0 || separator === body.length - 1) {
    throw new Error(
      `Invalid ${kind} reference "${original}". Expected ${kind}:<node-id>#<${kind}-id>.`,
    );
  }

  return {
    kind,
    nodeId: body.slice(0, separator),
    semanticId: body.slice(separator + 1),
  };
}

function requireNodeId(value: string, original: string): string {
  const id = value.trim();
  if (!id) throw new Error(`Invalid node reference "${original}".`);
  return id;
}

function resolveSemanticTransform(
  node: SceneNode,
  reference: ParsedSceneReference,
): Transform {
  const id = reference.semanticId;
  if (!id) throw new Error(`Missing ${reference.kind} id for node "${node.id}".`);

  const values =
    reference.kind === "anchor"
      ? node.semantics?.anchors
      : node.semantics?.sockets;
  const match = values?.find((value) => value.id === id);
  if (!match) {
    throw new Error(
      `SceneCheck ${reference.kind} "${id}" not found on node "${node.id}".`,
    );
  }
  return match.transform;
}

function transformLocalPoint(world: Transform, localPoint: Vec3): Vec3 {
  if (world.matrix) return transformPointByMatrix(world.matrix, localPoint);

  const scaled: Vec3 = [
    localPoint[0] * world.scale[0],
    localPoint[1] * world.scale[1],
    localPoint[2] * world.scale[2],
  ];
  const rotated = rotateVectorByQuat(scaled, world.rotation);
  return [
    world.position[0] + rotated[0],
    world.position[1] + rotated[1],
    world.position[2] + rotated[2],
  ];
}

function transformPointByMatrix(matrix: Mat4, point: Vec3): Vec3 {
  const x = point[0];
  const y = point[1];
  const z = point[2];
  const w = matrix[3] * x + matrix[7] * y + matrix[11] * z + matrix[15];
  const inverseW = w !== 0 && w !== 1 ? 1 / w : 1;

  return [
    (matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12]) * inverseW,
    (matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13]) * inverseW,
    (matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14]) * inverseW,
  ];
}

function multiplyQuat(a: Quat, b: Quat): Quat {
  return [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ];
}

function rotateVectorByQuat(vector: Vec3, rotation: Quat): Vec3 {
  const q = normalizeQuat(rotation);
  const x = vector[0];
  const y = vector[1];
  const z = vector[2];
  const qx = q[0];
  const qy = q[1];
  const qz = q[2];
  const qw = q[3];

  const ix = qw * x + qy * z - qz * y;
  const iy = qw * y + qz * x - qx * z;
  const iz = qw * z + qx * y - qy * x;
  const iw = -qx * x - qy * y - qz * z;

  return [
    ix * qw + iw * -qx + iy * -qz - iz * -qy,
    iy * qw + iw * -qy + iz * -qx - ix * -qz,
    iz * qw + iw * -qz + ix * -qy - iy * -qx,
  ];
}

function normalizeQuat(value: Quat): Quat {
  const length = Math.hypot(value[0], value[1], value[2], value[3]);
  if (length === 0) throw new Error("Cannot normalize a zero-length quaternion.");
  return [value[0] / length, value[1] / length, value[2] / length, value[3] / length];
}

function quatDot(a: Quat, b: Quat): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
}

function cloneVec3(value: Vec3): Vec3 {
  return [value[0], value[1], value[2]];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
