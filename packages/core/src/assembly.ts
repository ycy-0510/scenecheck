import type { Anchor, Quat, SceneIR, SceneNode, Socket, Transform, Vec3 } from "./index.js";
import {
  decomposeMat4,
  identityMat4,
  invertMat4,
  multiplyMat4,
  transformToMat4,
} from "./matrix.js";

export interface AttachmentRequest {
  moduleId: string;
  anchorId: string;
  targetId: string;
  socketId: string;
}

export interface AttachmentSolution {
  moduleId: string;
  moduleType?: string;
  anchorId: string;
  targetId: string;
  socketId: string;
  acceptedBySocket: boolean;
  desiredLocalTransform: Transform;
  desiredWorldTransform: Transform;
  safeToApplyTRS: boolean;
  diagnostics: {
    localShear: number;
    localReconstructionError: number;
    worldShear: number;
    worldReconstructionError: number;
  };
  delta: {
    localPosition: Vec3;
    localAngleDegrees: number;
  };
}

/**
 * Solve the root transform required to make one module anchor coincide with a target socket.
 * No scene state is mutated. Child transforms are intentionally absent from the result.
 */
export function solveAttachment(
  scene: SceneIR,
  request: AttachmentRequest,
): AttachmentSolution {
  const moduleNode = requireNode(scene, request.moduleId, "module");
  const targetNode = requireNode(scene, request.targetId, "target");
  const anchor = requireAnchor(moduleNode, request.anchorId);
  const socket = requireSocket(targetNode, request.socketId);
  const moduleType = moduleNode.semantics?.module;
  const acceptedBySocket = socketAcceptsModule(socket, moduleType);

  if (!acceptedBySocket) {
    const accepted = socket.accepts?.join(", ") || "<none>";
    throw new Error(
      `Socket "${request.targetId}#${request.socketId}" does not accept module "${moduleType ?? "<unnamed>"}". Accepted modules: ${accepted}.`,
    );
  }

  const targetWorld = transformToMat4(targetNode.worldTransform);
  const socketLocal = transformToMat4(socket.transform);
  const anchorLocal = transformToMat4(anchor.transform);
  const socketWorld = multiplyMat4(targetWorld, socketLocal);
  const desiredWorldMatrix = multiplyMat4(socketWorld, invertMat4(anchorLocal));

  const parentWorld = moduleNode.parentId
    ? transformToMat4(requireNode(scene, moduleNode.parentId, "module parent").worldTransform)
    : identityMat4();
  const desiredLocalMatrix = multiplyMat4(invertMat4(parentWorld), desiredWorldMatrix);

  const local = decomposeMat4(desiredLocalMatrix);
  const world = decomposeMat4(desiredWorldMatrix);
  const currentLocal = moduleNode.localTransform;

  return {
    moduleId: moduleNode.id,
    ...(moduleType ? { moduleType } : {}),
    anchorId: anchor.id,
    targetId: targetNode.id,
    socketId: socket.id,
    acceptedBySocket,
    desiredLocalTransform: local.transform,
    desiredWorldTransform: world.transform,
    safeToApplyTRS: local.representableAsTRS,
    diagnostics: {
      localShear: local.shear,
      localReconstructionError: local.reconstructionError,
      worldShear: world.shear,
      worldReconstructionError: world.reconstructionError,
    },
    delta: {
      localPosition: [
        local.transform.position[0] - currentLocal.position[0],
        local.transform.position[1] - currentLocal.position[1],
        local.transform.position[2] - currentLocal.position[2],
      ],
      localAngleDegrees: quaternionAngleDegrees(
        currentLocal.rotation,
        local.transform.rotation,
      ),
    },
  };
}

function requireNode(
  scene: SceneIR,
  id: string,
  role: string,
): SceneNode {
  const node = scene.nodes[id];
  if (!node) throw new Error(`SceneCheck ${role} node not found: "${id}".`);
  return node;
}

function requireAnchor(node: SceneNode, anchorId: string): Anchor {
  const anchor = node.semantics?.anchors?.find((value) => value.id === anchorId);
  if (!anchor) {
    throw new Error(`SceneCheck anchor "${anchorId}" not found on module "${node.id}".`);
  }
  return anchor;
}

function requireSocket(node: SceneNode, socketId: string): Socket {
  const socket = node.semantics?.sockets?.find((value) => value.id === socketId);
  if (!socket) {
    throw new Error(`SceneCheck socket "${socketId}" not found on target "${node.id}".`);
  }
  return socket;
}

function socketAcceptsModule(socket: Socket, moduleType: string | undefined): boolean {
  if (!socket.accepts?.length) return true;
  if (!moduleType) return false;
  return socket.accepts.includes(moduleType);
}

function quaternionAngleDegrees(a: Quat, b: Quat): number {
  const an = normalizeQuat(a);
  const bn = normalizeQuat(b);
  const dot = Math.abs(
    an[0] * bn[0] + an[1] * bn[1] + an[2] * bn[2] + an[3] * bn[3],
  );
  const radians = 2 * Math.acos(Math.min(1, Math.max(-1, dot)));
  return (radians * 180) / Math.PI;
}

function normalizeQuat(value: Quat): Quat {
  const length = Math.hypot(value[0], value[1], value[2], value[3]);
  if (length === 0) throw new Error("Cannot normalize a zero-length quaternion.");
  return [value[0] / length, value[1] / length, value[2] / length, value[3] / length];
}
