import type { Annotation, SceneIR, Transform } from "./index.js";
import {
  decomposeMat4,
  multiplyMat4,
  transformToMat4,
} from "./matrix.js";

export interface ResolvedAnnotation {
  annotation: Annotation;
  worldTransform: Transform;
  followsAttachment: boolean;
}

export function getAnnotation(scene: SceneIR, id: string): Annotation {
  const annotation = scene.annotations?.find((item) => item.id === id);
  if (!annotation) throw new Error(`SceneCheck annotation not found: "${id}".`);
  return annotation;
}

export function resolveAnnotation(
  scene: SceneIR,
  id: string,
): ResolvedAnnotation {
  const annotation = getAnnotation(scene, id);

  if (annotation.attachedTo && annotation.localTransform) {
    const node = scene.nodes[annotation.attachedTo];
    if (!node) {
      throw new Error(
        `SceneCheck annotation "${id}" is attached to missing node "${annotation.attachedTo}".`,
      );
    }
    const matrix = multiplyMat4(
      transformToMat4(node.worldTransform),
      transformToMat4(annotation.localTransform),
    );
    const worldTransform = decomposeMat4(matrix).transform;
    return {
      annotation,
      worldTransform,
      followsAttachment: true,
    };
  }

  return {
    annotation,
    worldTransform: cloneTransform(annotation.worldTransform),
    followsAttachment: false,
  };
}

export function validateAnnotations(scene: SceneIR): void {
  const ids = new Set<string>();
  for (const annotation of scene.annotations ?? []) {
    if (!annotation.id.trim()) throw new Error("SceneCheck annotation id cannot be empty.");
    if (ids.has(annotation.id)) {
      throw new Error(`Duplicate SceneCheck annotation id: "${annotation.id}".`);
    }
    ids.add(annotation.id);

    if (
      annotation.attachedTo &&
      annotation.localTransform &&
      !scene.nodes[annotation.attachedTo]
    ) {
      throw new Error(
        `SceneCheck annotation "${annotation.id}" is attached to missing node "${annotation.attachedTo}".`,
      );
    }
  }
}

function cloneTransform(transform: Transform): Transform {
  return {
    position: [...transform.position] as Transform["position"],
    rotation: [...transform.rotation] as Transform["rotation"],
    scale: [...transform.scale] as Transform["scale"],
    ...(transform.matrix
      ? { matrix: [...transform.matrix] as Transform["matrix"] }
      : {}),
  };
}
