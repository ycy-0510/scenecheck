import type { Annotation, Transform } from "@scenecheck/core";
import type { Object3D } from "three";

const ANNOTATIONS_KEY = "scenecheckAnnotations";

/** Store pure SceneCheck annotation metadata on a scene root without adding render objects. */
export function setThreeSceneAnnotations<T extends Object3D>(
  root: T,
  annotations: readonly Annotation[],
): T {
  assertUniqueAnnotationIds(annotations);
  root.userData[ANNOTATIONS_KEY] = annotations.map(cloneAnnotation);
  return root;
}

export function readThreeSceneAnnotations(root: Object3D): readonly Annotation[] | undefined {
  const raw = root.userData[ANNOTATIONS_KEY];
  if (!Array.isArray(raw)) return undefined;
  const annotations = raw.filter(isAnnotationLike).map(cloneAnnotation);
  assertUniqueAnnotationIds(annotations);
  return annotations;
}

function cloneAnnotation(annotation: Annotation): Annotation {
  return {
    id: annotation.id,
    type: annotation.type,
    ...(annotation.attachedTo ? { attachedTo: annotation.attachedTo } : {}),
    worldTransform: cloneTransform(annotation.worldTransform),
    ...(annotation.localTransform
      ? { localTransform: cloneTransform(annotation.localTransform) }
      : {}),
    ...(annotation.label ? { label: annotation.label } : {}),
    ...(annotation.note ? { note: annotation.note } : {}),
  };
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

function isAnnotationLike(value: unknown): value is Annotation {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    (value.type === "point" || value.type === "arrow" || value.type === "pose") &&
    isRecord(value.worldTransform)
  );
}

function assertUniqueAnnotationIds(annotations: readonly Annotation[]): void {
  const ids = new Set<string>();
  for (const annotation of annotations) {
    if (!annotation.id.trim()) throw new Error("SceneCheck annotation id cannot be empty.");
    if (ids.has(annotation.id)) {
      throw new Error(`Duplicate SceneCheck annotation id: "${annotation.id}".`);
    }
    ids.add(annotation.id);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
