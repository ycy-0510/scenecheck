import type { Annotation, SceneIR, Transform } from "./index.js";
import { validateAnnotations } from "./annotations.js";

export const ANNOTATION_DOCUMENT_FORMAT = "scenecheck.annotations" as const;

export interface AnnotationDocument {
  format: typeof ANNOTATION_DOCUMENT_FORMAT;
  version: 1;
  annotations: readonly Annotation[];
}

export type AnnotationDocumentMergeMode = "merge" | "replace";

/** Create a validated, detached annotation document suitable for persistence. */
export function createAnnotationDocument(
  annotations: readonly Annotation[],
): AnnotationDocument {
  return parseAnnotationDocument({
    format: ANNOTATION_DOCUMENT_FORMAT,
    version: 1,
    annotations,
  });
}

/** Parse and validate untrusted JSON-compatible annotation document data. */
export function parseAnnotationDocument(value: unknown): AnnotationDocument {
  if (!isRecord(value)) {
    throw new Error("SceneCheck annotation document must be an object.");
  }
  if (value.format !== ANNOTATION_DOCUMENT_FORMAT) {
    throw new Error(
      `SceneCheck annotation document format must be "${ANNOTATION_DOCUMENT_FORMAT}".`,
    );
  }
  if (value.version !== 1) {
    throw new Error(`Unsupported SceneCheck annotation document version: ${String(value.version)}.`);
  }
  if (!Array.isArray(value.annotations)) {
    throw new Error("SceneCheck annotation document must contain an annotations array.");
  }

  const ids = new Set<string>();
  const annotations = value.annotations.map((item, index) => {
    const annotation = parseAnnotation(item, index);
    if (ids.has(annotation.id)) {
      throw new Error(`Duplicate SceneCheck annotation id: "${annotation.id}".`);
    }
    ids.add(annotation.id);
    return annotation;
  });

  return {
    format: ANNOTATION_DOCUMENT_FORMAT,
    version: 1,
    annotations,
  };
}

export function parseAnnotationDocumentJson(text: string): AnnotationDocument {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid SceneCheck annotation JSON: ${message}`);
  }
  return parseAnnotationDocument(value);
}

export function serializeAnnotationDocument(
  annotations: readonly Annotation[],
  pretty = true,
): string {
  return `${JSON.stringify(createAnnotationDocument(annotations), null, pretty ? 2 : undefined)}\n`;
}

/** Merge persisted annotations into a scene and validate their live node attachments. */
export function applyAnnotationDocument(
  scene: SceneIR,
  document: AnnotationDocument | unknown,
  mode: AnnotationDocumentMergeMode = "merge",
): SceneIR {
  const parsed = parseAnnotationDocument(document);
  const annotations =
    mode === "replace"
      ? parsed.annotations
      : [...(scene.annotations ?? []), ...parsed.annotations];
  const next: SceneIR = {
    ...scene,
    annotations,
  };
  validateAnnotations(next);
  return next;
}

function parseAnnotation(value: unknown, index: number): Annotation {
  const path = `annotations[${index}]`;
  if (!isRecord(value)) {
    throw new Error(`SceneCheck ${path} must be an object.`);
  }

  const id = requireNonEmptyString(value.id, `${path}.id`);
  if (value.type !== "point" && value.type !== "arrow" && value.type !== "pose") {
    throw new Error(`SceneCheck ${path}.type must be point, arrow, or pose.`);
  }
  const worldTransform = parseTransform(value.worldTransform, `${path}.worldTransform`);

  return {
    id,
    type: value.type,
    ...(value.attachedTo !== undefined
      ? { attachedTo: requireNonEmptyString(value.attachedTo, `${path}.attachedTo`) }
      : {}),
    worldTransform,
    ...(value.localTransform !== undefined
      ? { localTransform: parseTransform(value.localTransform, `${path}.localTransform`) }
      : {}),
    ...(value.label !== undefined
      ? { label: requireString(value.label, `${path}.label`) }
      : {}),
    ...(value.note !== undefined
      ? { note: requireString(value.note, `${path}.note`) }
      : {}),
  };
}

function parseTransform(value: unknown, path: string): Transform {
  if (!isRecord(value)) throw new Error(`SceneCheck ${path} must be an object.`);

  return {
    position: parseNumberTuple(value.position, 3, `${path}.position`),
    rotation: parseNumberTuple(value.rotation, 4, `${path}.rotation`),
    scale: parseNumberTuple(value.scale, 3, `${path}.scale`),
    ...(value.matrix !== undefined
      ? { matrix: parseNumberTuple(value.matrix, 16, `${path}.matrix`) }
      : {}),
  } as Transform;
}

function parseNumberTuple(
  value: unknown,
  length: number,
  path: string,
): readonly number[] {
  if (!Array.isArray(value) || value.length !== length) {
    throw new Error(`SceneCheck ${path} must contain exactly ${length} numbers.`);
  }
  const result = value.map((item) => {
    if (typeof item !== "number" || !Number.isFinite(item)) {
      throw new Error(`SceneCheck ${path} must contain only finite numbers.`);
    }
    return item;
  });
  return result;
}

function requireNonEmptyString(value: unknown, path: string): string {
  const result = requireString(value, path).trim();
  if (!result) throw new Error(`SceneCheck ${path} cannot be empty.`);
  return result;
}

function requireString(value: unknown, path: string): string {
  if (typeof value !== "string") throw new Error(`SceneCheck ${path} must be a string.`);
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
