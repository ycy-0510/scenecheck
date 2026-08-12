import type {
  Bounds,
  Mat4,
  SceneIR,
  SceneNode,
  Transform,
} from "@scenecheck/core";
import { Box3, Matrix4, Quaternion, Vector3 } from "three";
import type { BufferGeometry, Object3D } from "three";

export type ThreeIdStrategy = "path" | "uuid";

export interface ThreeIdContext {
  /** Deterministic hierarchy path generated from object names/types. */
  path: string;
  parentId?: string;
}

export interface ThreeSceneAdapterOptions {
  /** Include objects hidden by their own or an ancestor's `visible` flag. Default: true. */
  includeInvisible?: boolean;
  /** Compute world-axis-aligned subtree bounds. Default: true. */
  includeBounds?: boolean;
  /** Default IDs are deterministic hierarchy paths. `uuid` uses Three.js runtime UUIDs instead. */
  idStrategy?: ThreeIdStrategy;
  /** Optional application-specific stable ID resolver. */
  getId?: (object: Object3D, context: ThreeIdContext) => string | undefined;
}

interface BoundsCapableObject extends Object3D {
  geometry?: BufferGeometry;
  boundingBox?: Box3 | null;
  computeBoundingBox?: () => void;
  isInstancedMesh?: boolean;
  isSkinnedMesh?: boolean;
}

const DEFAULT_OPTIONS: Required<
  Pick<ThreeSceneAdapterOptions, "includeInvisible" | "includeBounds" | "idStrategy">
> = {
  includeInvisible: true,
  includeBounds: true,
  idStrategy: "path",
};

export function fromThreeScene(
  root: Object3D,
  options: ThreeSceneAdapterOptions = {},
): SceneIR {
  const config = { ...DEFAULT_OPTIONS, ...options };

  // Keep local and world matrices current before reading transforms or bounds.
  root.updateWorldMatrix(true, true);

  const nodes: Record<string, SceneNode> = {};
  const usedIds = new Set<string>();
  const boundsById = new Map<string, Box3>();
  const parentVisible = ancestorsAreVisible(root.parent);

  const rootId = visit(root, undefined, makePathSegment(root, 0, [root]), parentVisible);

  return {
    version: 1,
    roots: rootId ? [rootId] : [],
    nodes,
  };

  function visit(
    object: Object3D,
    parentId: string | undefined,
    path: string,
    ancestorsVisible: boolean,
  ): string | undefined {
    const effectiveVisible = ancestorsVisible && object.visible;
    if (!config.includeInvisible && !effectiveVisible) {
      return undefined;
    }

    const context: ThreeIdContext = { path, parentId };
    const id = resolveObjectId(object, context, config);
    if (usedIds.has(id)) {
      throw new Error(
        `SceneCheck produced duplicate object id "${id}". Set a unique userData.scenecheckId or provide getId().`,
      );
    }
    usedIds.add(id);

    const childIds: string[] = [];
    for (let index = 0; index < object.children.length; index += 1) {
      const child = object.children[index];
      if (!child) continue;

      const segment = makePathSegment(child, index, object.children);
      const childId = visit(child, id, `${path}/${segment}`, effectiveVisible);
      if (childId) childIds.push(childId);
    }

    let subtreeBounds: Box3 | undefined;
    if (config.includeBounds) {
      subtreeBounds = computeOwnWorldBounds(object);
      for (const childId of childIds) {
        const childBounds = boundsById.get(childId);
        if (!childBounds) continue;
        if (subtreeBounds) subtreeBounds.union(childBounds);
        else subtreeBounds = childBounds.clone();
      }
      if (subtreeBounds && !subtreeBounds.isEmpty()) {
        boundsById.set(id, subtreeBounds);
      } else {
        subtreeBounds = undefined;
      }
    }

    const node: SceneNode = {
      id,
      ...(object.name ? { name: object.name } : {}),
      type: object.type || object.constructor.name || "Object3D",
      ...(parentId ? { parentId } : {}),
      children: childIds,
      localTransform: matrixToTransform(object.matrix),
      worldTransform: matrixToTransform(object.matrixWorld),
      ...(subtreeBounds ? { bounds: boxToBounds(subtreeBounds) } : {}),
      metadata: {
        "three.uuid": object.uuid,
        "three.visible": object.visible,
        "three.effectiveVisible": effectiveVisible,
        "three.renderOrder": object.renderOrder,
        "three.layersMask": object.layers.mask,
      },
    };

    nodes[id] = node;
    return id;
  }
}

function resolveObjectId(
  object: Object3D,
  context: ThreeIdContext,
  options: ThreeSceneAdapterOptions & typeof DEFAULT_OPTIONS,
): string {
  const resolved = options.getId?.(object, context);
  if (resolved?.trim()) return resolved.trim();

  const semanticId = (object.userData as Record<string, unknown>).scenecheckId;
  if (typeof semanticId === "string" && semanticId.trim()) {
    return semanticId.trim();
  }

  return options.idStrategy === "uuid" ? object.uuid : context.path;
}

function makePathSegment(
  object: Object3D,
  index: number,
  siblings: readonly Object3D[],
): string {
  const label = object.name.trim() || object.type || object.constructor.name || "Object3D";
  let occurrence = 1;

  for (let siblingIndex = 0; siblingIndex < index; siblingIndex += 1) {
    const sibling = siblings[siblingIndex];
    if (!sibling) continue;
    const siblingLabel =
      sibling.name.trim() || sibling.type || sibling.constructor.name || "Object3D";
    if (siblingLabel === label) occurrence += 1;
  }

  const encoded = encodeURIComponent(label);
  return occurrence === 1 ? encoded : `${encoded}#${occurrence}`;
}

function ancestorsAreVisible(parent: Object3D | null): boolean {
  let current = parent;
  while (current) {
    if (!current.visible) return false;
    current = current.parent;
  }
  return true;
}

function matrixToTransform(matrix: Matrix4): Transform {
  const position = new Vector3();
  const rotation = new Quaternion();
  const scale = new Vector3();
  matrix.decompose(position, rotation, scale);

  return {
    position: [position.x, position.y, position.z],
    rotation: [rotation.x, rotation.y, rotation.z, rotation.w],
    scale: [scale.x, scale.y, scale.z],
    matrix: matrixToArray(matrix),
  };
}

function matrixToArray(matrix: Matrix4): Mat4 {
  const e = matrix.elements;
  return [
    e[0],
    e[1],
    e[2],
    e[3],
    e[4],
    e[5],
    e[6],
    e[7],
    e[8],
    e[9],
    e[10],
    e[11],
    e[12],
    e[13],
    e[14],
    e[15],
  ];
}

function computeOwnWorldBounds(object: Object3D): Box3 | undefined {
  const candidate = object as BoundsCapableObject;

  // InstancedMesh and SkinnedMesh own their object-level bounding boxes.
  if (
    (candidate.isInstancedMesh || candidate.isSkinnedMesh) &&
    typeof candidate.computeBoundingBox === "function"
  ) {
    candidate.computeBoundingBox();
    if (candidate.boundingBox && !candidate.boundingBox.isEmpty()) {
      return candidate.boundingBox.clone().applyMatrix4(object.matrixWorld);
    }
  }

  const geometry = candidate.geometry;
  if (!geometry) return undefined;

  if (!geometry.boundingBox) {
    geometry.computeBoundingBox();
  }
  if (!geometry.boundingBox || geometry.boundingBox.isEmpty()) return undefined;

  return geometry.boundingBox.clone().applyMatrix4(object.matrixWorld);
}

function boxToBounds(box: Box3): Bounds {
  return {
    min: [box.min.x, box.min.y, box.min.z],
    max: [box.max.x, box.max.y, box.max.z],
  };
}
