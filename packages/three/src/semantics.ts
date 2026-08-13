import type {
  Anchor,
  Quat,
  SceneSemantics,
  Socket,
  Transform,
  Vec3,
} from "@scenecheck/core";
import type { Object3D } from "three";

export interface ThreeSemanticTransformInput {
  position?: Vec3;
  rotation?: Quat;
  scale?: Vec3;
}

export interface ThreeAnchorInput extends ThreeSemanticTransformInput {
  id: string;
  type?: string;
}

export interface ThreeSocketInput extends ThreeSemanticTransformInput {
  id: string;
  accepts?: readonly string[];
}

export interface ThreeSceneCheckDescriptor {
  /** Stable SceneCheck node ID. */
  id?: string;
  /** Reusable module/prefab identity for this object subtree. */
  module?: string;
  /** Local-space semantic anchors attached to this object. */
  anchors?: readonly ThreeAnchorInput[];
  /** Local-space semantic sockets exposed by this object. */
  sockets?: readonly ThreeSocketInput[];
}

export interface StoredThreeSceneCheckMetadata {
  id?: string;
  semantics?: SceneSemantics;
}

const USER_DATA_KEY = "scenecheck";

/**
 * Attach stable SceneCheck semantics to a Three.js Object3D without changing its render behavior.
 * Anchor and socket transforms are local to the described object.
 */
export function describeThreeObject<T extends Object3D>(
  object: T,
  descriptor: ThreeSceneCheckDescriptor,
): T {
  const metadata = normalizeDescriptor(descriptor);
  object.userData[USER_DATA_KEY] = metadata;
  return object;
}

export function readThreeSceneCheckMetadata(
  object: Object3D,
): StoredThreeSceneCheckMetadata | undefined {
  const raw = object.userData[USER_DATA_KEY];
  if (!isRecord(raw)) return undefined;

  const id = typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : undefined;
  const semantics = isSceneSemantics(raw.semantics) ? cloneSceneSemantics(raw.semantics) : undefined;

  if (!id && !semantics) return undefined;
  return {
    ...(id ? { id } : {}),
    ...(semantics ? { semantics } : {}),
  };
}

function normalizeDescriptor(
  descriptor: ThreeSceneCheckDescriptor,
): StoredThreeSceneCheckMetadata {
  const id = descriptor.id?.trim();
  if (descriptor.id !== undefined && !id) {
    throw new Error("SceneCheck object id cannot be empty.");
  }

  const moduleName = descriptor.module?.trim();
  if (descriptor.module !== undefined && !moduleName) {
    throw new Error("SceneCheck module name cannot be empty.");
  }

  const anchors = descriptor.anchors?.map(normalizeAnchor);
  const sockets = descriptor.sockets?.map(normalizeSocket);
  assertUniqueIds(anchors ?? [], "anchor");
  assertUniqueIds(sockets ?? [], "socket");

  const semantics: SceneSemantics | undefined =
    moduleName || anchors?.length || sockets?.length
      ? {
          ...(moduleName ? { module: moduleName } : {}),
          ...(anchors?.length ? { anchors } : {}),
          ...(sockets?.length ? { sockets } : {}),
        }
      : undefined;

  return {
    ...(id ? { id } : {}),
    ...(semantics ? { semantics } : {}),
  };
}

function normalizeAnchor(input: ThreeAnchorInput): Anchor {
  const id = requireSemanticId(input.id, "anchor");
  const type = input.type?.trim();
  if (input.type !== undefined && !type) {
    throw new Error(`SceneCheck anchor "${id}" type cannot be empty.`);
  }

  return {
    id,
    transform: normalizeTransform(input),
    ...(type ? { type } : {}),
  };
}

function normalizeSocket(input: ThreeSocketInput): Socket {
  const id = requireSemanticId(input.id, "socket");
  const accepts = input.accepts?.map((value) => value.trim());
  if (accepts?.some((value) => value.length === 0)) {
    throw new Error(`SceneCheck socket "${id}" accepts cannot contain empty values.`);
  }

  return {
    id,
    transform: normalizeTransform(input),
    ...(accepts?.length ? { accepts } : {}),
  };
}

function normalizeTransform(input: ThreeSemanticTransformInput): Transform {
  return {
    position: cloneVec3(input.position ?? [0, 0, 0]),
    rotation: cloneQuat(input.rotation ?? [0, 0, 0, 1]),
    scale: cloneVec3(input.scale ?? [1, 1, 1]),
  };
}

function cloneSceneSemantics(semantics: SceneSemantics): SceneSemantics {
  return {
    ...(semantics.module ? { module: semantics.module } : {}),
    ...(semantics.anchors
      ? {
          anchors: semantics.anchors.map((anchor) => ({
            ...anchor,
            transform: cloneTransform(anchor.transform),
          })),
        }
      : {}),
    ...(semantics.sockets
      ? {
          sockets: semantics.sockets.map((socket) => ({
            ...socket,
            transform: cloneTransform(socket.transform),
            ...(socket.accepts ? { accepts: [...socket.accepts] } : {}),
          })),
        }
      : {}),
  };
}

function cloneTransform(transform: Transform): Transform {
  return {
    position: cloneVec3(transform.position),
    rotation: cloneQuat(transform.rotation),
    scale: cloneVec3(transform.scale),
    ...(transform.matrix ? { matrix: [...transform.matrix] as Transform["matrix"] } : {}),
  };
}

function isSceneSemantics(value: unknown): value is SceneSemantics {
  if (!isRecord(value)) return false;
  if (value.module !== undefined && typeof value.module !== "string") return false;
  if (value.anchors !== undefined && !Array.isArray(value.anchors)) return false;
  if (value.sockets !== undefined && !Array.isArray(value.sockets)) return false;
  return true;
}

function requireSemanticId(value: string, kind: "anchor" | "socket"): string {
  const id = value.trim();
  if (!id) throw new Error(`SceneCheck ${kind} id cannot be empty.`);
  return id;
}

function assertUniqueIds(
  values: readonly { id: string }[],
  kind: "anchor" | "socket",
): void {
  const ids = new Set<string>();
  for (const value of values) {
    if (ids.has(value.id)) {
      throw new Error(`Duplicate SceneCheck ${kind} id: "${value.id}".`);
    }
    ids.add(value.id);
  }
}

function cloneVec3(value: Vec3): Vec3 {
  return [value[0], value[1], value[2]];
}

function cloneQuat(value: Quat): Quat {
  return [value[0], value[1], value[2], value[3]];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
