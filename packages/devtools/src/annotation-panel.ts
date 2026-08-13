import type { Annotation } from "@scenecheck/core";
import {
  removeThreeAnnotation,
  updateThreeAnnotation,
} from "./annotation-management.js";
import { ThreeDevtoolsController } from "./controller.js";
import type { ThreeViewportInteraction } from "./viewport.js";

export interface AnnotationManagementPanelOptions {
  controller: ThreeDevtoolsController;
  viewport?: ThreeViewportInteraction;
  onChange?: () => void;
}

/**
 * Render human-authored annotation metadata controls.
 * Mutations delegate to the same annotation-management API used programmatically.
 */
export function renderAnnotationManagementPanel(
  options: AnnotationManagementPanelOptions,
): HTMLElement {
  const root = document.createElement("section");
  Object.assign(root.style, {
    marginTop: "8px",
    paddingTop: "8px",
    borderTop: "1px solid rgba(255,255,255,0.1)",
  });

  const header = document.createElement("div");
  Object.assign(header.style, {
    display: "flex",
    alignItems: "baseline",
    gap: "7px",
    marginBottom: "6px",
  });

  const title = document.createElement("strong");
  title.textContent = "Annotations";
  title.style.fontSize = "11px";
  title.style.textTransform = "uppercase";
  title.style.letterSpacing = "0.08em";
  title.style.opacity = "0.7";

  const annotations = [...(options.controller.ir.annotations ?? [])];
  const count = document.createElement("span");
  count.textContent = String(annotations.length);
  count.style.fontSize = "11px";
  count.style.opacity = "0.5";
  header.append(title, count);
  root.append(header);

  if (annotations.length === 0) {
    const empty = document.createElement("div");
    empty.textContent = options.viewport
      ? "Use Viewport → Point or Pose to add a 3D annotation."
      : "No annotations in the current scene.";
    Object.assign(empty.style, {
      fontSize: "11px",
      opacity: "0.58",
      padding: "3px 0",
    });
    root.append(empty);
    return root;
  }

  const list = document.createElement("div");
  Object.assign(list.style, {
    display: "grid",
    gap: "6px",
    maxHeight: "250px",
    overflow: "auto",
  });

  for (const annotation of annotations) {
    list.append(renderAnnotationCard(annotation, options));
  }
  root.append(list);
  return root;
}

function renderAnnotationCard(
  annotation: Annotation,
  options: AnnotationManagementPanelOptions,
): HTMLElement {
  const card = document.createElement("form");
  Object.assign(card.style, {
    display: "grid",
    gap: "5px",
    padding: "7px",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "6px",
    background: "rgba(255,255,255,0.025)",
  });

  const identity = document.createElement("div");
  Object.assign(identity.style, {
    display: "flex",
    alignItems: "baseline",
    gap: "6px",
    minWidth: "0",
  });

  const reference = document.createElement("code");
  reference.textContent = `annotation:${annotation.id}`;
  Object.assign(reference.style, {
    flex: "1",
    minWidth: "0",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontSize: "11px",
  });
  reference.title = `annotation:${annotation.id}`;

  const kind = document.createElement("span");
  kind.textContent = annotation.type;
  Object.assign(kind.style, {
    fontSize: "10px",
    opacity: "0.55",
    whiteSpace: "nowrap",
  });
  identity.append(reference, kind);
  card.append(identity);

  if (annotation.attachedTo) {
    const attachment = document.createElement("div");
    attachment.textContent = `attached to ${annotation.attachedTo}`;
    Object.assign(attachment.style, {
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
      fontSize: "10px",
      opacity: "0.5",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    });
    attachment.title = annotation.attachedTo;
    card.append(attachment);
  }

  const labelInput = textInput("Label", annotation.label ?? "");
  const noteInput = document.createElement("textarea");
  noteInput.value = annotation.note ?? "";
  noteInput.placeholder = "Note";
  noteInput.rows = 2;
  applyInputStyle(noteInput);
  noteInput.style.resize = "vertical";
  card.append(labelInput, noteInput);

  const actions = document.createElement("div");
  Object.assign(actions.style, {
    display: "flex",
    gap: "5px",
    justifyContent: "flex-end",
  });

  const save = actionButton("Save");
  save.type = "submit";
  const remove = actionButton("Delete");
  remove.type = "button";
  remove.title = `Delete annotation:${annotation.id}`;
  actions.append(save, remove);
  card.append(actions);

  card.addEventListener("submit", (event) => {
    event.preventDefault();
    updateThreeAnnotation(options.controller, annotation.id, {
      label: labelInput.value,
      note: noteInput.value,
    });
    refreshAfterMutation(options);
  });

  remove.addEventListener("click", () => {
    removeThreeAnnotation(options.controller, annotation.id);
    refreshAfterMutation(options);
  });

  return card;
}

function refreshAfterMutation(options: AnnotationManagementPanelOptions): void {
  options.viewport?.refreshMarkers();
  options.onChange?.();
}

function textInput(placeholder: string, value: string): HTMLInputElement {
  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = placeholder;
  input.value = value;
  applyInputStyle(input);
  return input;
}

function applyInputStyle(element: HTMLInputElement | HTMLTextAreaElement): void {
  Object.assign(element.style, {
    boxSizing: "border-box",
    width: "100%",
    border: "1px solid rgba(255,255,255,0.14)",
    borderRadius: "4px",
    padding: "5px 6px",
    background: "rgba(0,0,0,0.18)",
    color: "inherit",
    font: "inherit",
    fontSize: "11px",
    outline: "none",
  });
}

function actionButton(label: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.textContent = label;
  Object.assign(button.style, {
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(255,255,255,0.07)",
    color: "inherit",
    borderRadius: "5px",
    padding: "4px 7px",
    cursor: "pointer",
    fontSize: "11px",
  });
  return button;
}
