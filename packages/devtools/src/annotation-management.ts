import type { Annotation } from "@scenecheck/core";
import {
  readThreeSceneAnnotations,
  setThreeSceneAnnotations,
} from "@scenecheck/three";
import { ThreeDevtoolsController } from "./controller.js";

export interface ThreeAnnotationPatch {
  /** undefined leaves unchanged; null/empty removes the label. */
  label?: string | null;
  /** undefined leaves unchanged; null/empty removes the note. */
  note?: string | null;
}

/** Update human-readable annotation metadata without changing its spatial pose or ID. */
export function updateThreeAnnotation(
  controller: ThreeDevtoolsController,
  id: string,
  patch: ThreeAnnotationPatch,
): Annotation {
  const annotations = [...(readThreeSceneAnnotations(controller.scene) ?? [])];
  const index = annotations.findIndex((annotation) => annotation.id === id);
  if (index < 0) throw new Error(`SceneCheck annotation not found: "${id}".`);

  const current = annotations[index]!;
  const label = patch.label === undefined
    ? current.label
    : normalizeOptionalText(patch.label);
  const note = patch.note === undefined
    ? current.note
    : normalizeOptionalText(patch.note);

  const updated: Annotation = {
    ...current,
    ...(label ? { label } : {}),
    ...(note ? { note } : {}),
  };
  if (!label) delete (updated as { label?: string }).label;
  if (!note) delete (updated as { note?: string }).note;

  annotations[index] = updated;
  setThreeSceneAnnotations(controller.scene, annotations);
  controller.refresh();
  return updated;
}

/** Remove one annotation. Spatial application state is otherwise untouched. */
export function removeThreeAnnotation(
  controller: ThreeDevtoolsController,
  id: string,
): Annotation {
  const annotations = [...(readThreeSceneAnnotations(controller.scene) ?? [])];
  const index = annotations.findIndex((annotation) => annotation.id === id);
  if (index < 0) throw new Error(`SceneCheck annotation not found: "${id}".`);

  const [removed] = annotations.splice(index, 1);
  setThreeSceneAnnotations(controller.scene, annotations);
  controller.refresh();
  return removed!;
}

function normalizeOptionalText(value: string | null): string | undefined {
  if (value === null) return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}
