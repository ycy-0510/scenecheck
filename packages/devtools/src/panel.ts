import type { Transform } from "@scenecheck/core";
import type { Object3D } from "three";
import { renderAnnotationManagementPanel } from "./annotation-panel.js";
import type { ThreeColliderOverlay } from "./collider-overlay.js";
import { ThreeDevtoolsController } from "./controller.js";
import type {
  ThreeViewportInteraction,
  ThreeViewportMode,
} from "./viewport.js";

export interface ThreeDevtoolsPanelOptions {
  controller: ThreeDevtoolsController;
  colliders?: ThreeColliderOverlay;
  viewport?: ThreeViewportInteraction;
  container?: HTMLElement;
  title?: string;
  onClose?: () => void;
}

export interface ThreeDevtoolsPanel {
  element: HTMLElement;
  render(): void;
  destroy(): void;
}

export function createThreeDevtoolsPanel(
  options: ThreeDevtoolsPanelOptions,
): ThreeDevtoolsPanel {
  const controller = options.controller;
  const colliders = options.colliders;
  const viewport = options.viewport;
  const container = options.container ?? document.body;
  const root = document.createElement("aside");
  root.dataset.scenecheckDevtools = "true";
  applyPanelStyle(root, options.container === undefined);
  container.append(root);

  let destroyed = false;
  let notice: { text: string; error: boolean } | undefined;

  function render(): void {
    if (destroyed) return;
    colliders?.refresh();
    root.replaceChildren();

    const header = el("div", { display: "flex", alignItems: "center", gap: "8px" });
    const title = el("strong");
    title.textContent = options.title ?? "SceneCheck";
    title.style.flex = "1";
    header.append(title);
    header.append(
      button("Refresh", () => {
        controller.refresh();
        viewport?.refreshMarkers();
        render();
      }),
    );
    header.append(
      button(
        "×",
        () => {
          if (options.onClose) options.onClose();
          else {
            viewport?.destroy();
            colliders?.destroy();
            controller.destroy();
            api.destroy();
          }
        },
        "Close SceneCheck DevTools",
      ),
    );
    root.append(header);

    if (viewport) root.append(renderViewportToolbar(viewport));
    root.append(
      renderAnnotationManagementPanel({
        controller,
        ...(viewport ? { viewport } : {}),
        onChange: render,
      }),
    );
    if (notice) {
      const status = el("div", {
        marginTop: "6px",
        padding: "5px 7px",
        borderRadius: "5px",
        fontSize: "11px",
        background: notice.error
          ? "rgba(255,90,90,0.14)"
          : "rgba(120,220,160,0.12)",
      });
      status.textContent = notice.text;
      root.append(status);
    }

    const body = el("div", {
      display: "grid",
      gridTemplateColumns: "minmax(120px, 0.9fr) minmax(160px, 1.1fr)",
      gap: "8px",
      marginTop: "8px",
      minHeight: "220px",
    });

    const tree = el("div", panelSectionStyle());
    tree.append(sectionTitle("Scene"));
    const treeBody = el("div", { maxHeight: "460px", overflow: "auto" });
    for (const rootId of controller.ir.roots) {
      treeBody.append(renderTreeNode(rootId, 0));
    }
    tree.append(treeBody);

    const inspector = el("div", panelSectionStyle());
    inspector.append(sectionTitle("Inspector"));
    renderInspector(inspector);

    body.append(tree, inspector);
    root.append(body);
  }

  function renderViewportToolbar(interaction: ThreeViewportInteraction): HTMLElement {
    const toolbar = el("div", {
      display: "flex",
      flexWrap: "wrap",
      alignItems: "center",
      gap: "6px",
      marginTop: "8px",
      paddingTop: "8px",
      borderTop: "1px solid rgba(255,255,255,0.1)",
    });
    const label = el("span", { opacity: "0.65", fontSize: "11px", marginRight: "2px" });
    label.textContent = "Viewport";
    toolbar.append(label);

    const modes: ReadonlyArray<readonly [string, ThreeViewportMode]> = [
      ["Off", "idle"],
      ["Pick", "select"],
      ["Point", "point"],
      ["Pose", "pose"],
    ];
    for (const [name, mode] of modes) {
      toolbar.append(
        toggleButton(name, interaction.mode === mode, () => {
          interaction.setMode(mode);
          render();
        }),
      );
    }

    toolbar.append(
      button("Export annotations", () => {
        downloadAnnotationJson(interaction.exportAnnotationJson());
        notice = { text: "Exported scenecheck.annotations.json", error: false };
        render();
      }),
    );
    toolbar.append(
      button("Import annotations", () => {
        chooseAnnotationFile(interaction);
      }),
    );

    const count = controller.ir.annotations?.length ?? 0;
    const status = el("span", { opacity: "0.58", fontSize: "11px", marginLeft: "4px" });
    status.textContent = `${count} annotation${count === 1 ? "" : "s"}`;
    toolbar.append(status);
    return toolbar;
  }

  function chooseAnnotationFile(interaction: ThreeViewportInteraction): void {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.addEventListener(
      "change",
      async () => {
        const file = input.files?.[0];
        if (!file) return;
        try {
          interaction.importAnnotationJson(await file.text(), "replace");
          notice = {
            text: `Imported ${controller.ir.annotations?.length ?? 0} annotations from ${file.name}`,
            error: false,
          };
        } catch (error) {
          notice = {
            text: error instanceof Error ? error.message : String(error),
            error: true,
          };
        }
        render();
      },
      { once: true },
    );
    input.click();
  }

  function renderTreeNode(id: string, depth: number): HTMLElement {
    const node = controller.ir.nodes[id];
    const wrapper = document.createElement("div");
    if (!node) return wrapper;

    const row = document.createElement("button");
    row.type = "button";
    row.style.display = "block";
    row.style.width = "100%";
    row.style.border = "0";
    row.style.background =
      controller.selectedId === id ? "rgba(255,255,255,0.14)" : "transparent";
    row.style.color = "inherit";
    row.style.textAlign = "left";
    row.style.padding = `4px 6px 4px ${6 + depth * 12}px`;
    row.style.cursor = "pointer";
    row.style.borderRadius = "4px";
    row.title = id;
    row.textContent = `${node.name || node.id} · ${node.type}`;
    row.addEventListener("click", () => {
      controller.select(id);
      render();
    });
    wrapper.append(row);

    for (const childId of node.children) {
      wrapper.append(renderTreeNode(childId, depth + 1));
    }
    return wrapper;
  }

  function renderInspector(inspector: HTMLElement): void {
    const node = controller.selectedNode;
    const object = controller.selectedObject;
    if (!node || !object) {
      const empty = el("p", { opacity: "0.7", margin: "8px 0" });
      empty.textContent = "Select an object from the scene tree or use Viewport → Pick.";
      inspector.append(empty);
      return;
    }

    const heading = document.createElement("div");
    heading.style.fontWeight = "600";
    heading.style.margin = "6px 0";
    heading.textContent = node.name || node.id;
    inspector.append(heading);

    inspector.append(kv("ID", node.id));
    inspector.append(kv("Type", node.type));
    if (node.semantics?.module) inspector.append(kv("Module", node.semantics.module));
    inspector.append(kv("Visible", String(object.visible)));
    inspector.append(transformBlock("Local", node.localTransform));
    inspector.append(transformBlock("World", node.worldTransform));

    if (node.bounds) {
      inspector.append(kv("Bounds min", formatVec(node.bounds.min)));
      inspector.append(kv("Bounds max", formatVec(node.bounds.max)));
    }

    if (node.semantics?.anchors?.length) {
      inspector.append(
        kv("Anchors", node.semantics.anchors.map((item) => item.id).join(", ")),
      );
    }
    if (node.semantics?.sockets?.length) {
      inspector.append(
        kv("Sockets", node.semantics.sockets.map((item) => item.id).join(", ")),
      );
    }
    if (node.semantics?.colliders?.length) {
      inspector.append(
        kv(
          "Colliders",
          node.semantics.colliders
            .map((item) => `${item.id} · ${item.type}`)
            .join(", "),
        ),
      );
    }

    const actions = el("div", {
      display: "flex",
      flexWrap: "wrap",
      gap: "6px",
      marginTop: "10px",
    });
    actions.append(
      button(object.visible ? "Hide" : "Show", () => {
        controller.setSelectedHidden(object.visible);
        render();
      }),
    );

    if (controller.isolatedId === node.id) {
      actions.append(
        button("Clear isolate", () => {
          controller.clearIsolation();
          controller.refresh();
          render();
        }),
      );
    } else {
      actions.append(
        button("Isolate", () => {
          controller.isolateSelected();
          render();
        }),
      );
    }

    actions.append(
      toggleButton("Ghost", controller.state.ghost, (enabled) => {
        controller.setGhost(enabled);
        render();
      }),
    );
    actions.append(
      toggleButton("Wireframe", controller.state.wireframe, (enabled) => {
        controller.setWireframe(enabled);
        render();
      }),
    );
    actions.append(
      toggleButton("Bounds", controller.state.showBounds, (enabled) => {
        controller.setShowBounds(enabled);
        render();
      }),
    );
    actions.append(
      toggleButton("Axes", controller.state.showAxes, (enabled) => {
        controller.setShowAxes(enabled);
        render();
      }),
    );
    if (colliders) {
      actions.append(
        toggleButton("Colliders", colliders.enabled, (enabled) => {
          colliders.setEnabled(enabled);
          render();
        }),
      );
    }
    inspector.append(actions);
  }

  const api: ThreeDevtoolsPanel = {
    element: root,
    render,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      root.remove();
    },
  };

  render();
  return api;
}

function downloadAnnotationJson(text: string): void {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "scenecheck.annotations.json";
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function transformBlock(label: string, transform: Transform): HTMLElement {
  const block = el("div", {
    borderTop: "1px solid rgba(255,255,255,0.08)",
    marginTop: "7px",
    paddingTop: "6px",
  });
  const title = document.createElement("div");
  title.style.fontSize = "11px";
  title.style.opacity = "0.72";
  title.textContent = `${label} transform`;
  block.append(title);
  block.append(kv("Position", formatVec(transform.position)));
  block.append(kv("Rotation", formatQuat(transform.rotation)));
  block.append(kv("Scale", formatVec(transform.scale)));
  return block;
}

function kv(key: string, value: string): HTMLElement {
  const row = el("div", {
    display: "grid",
    gridTemplateColumns: "72px minmax(0, 1fr)",
    gap: "6px",
    padding: "2px 0",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: "11px",
  });
  const keyEl = document.createElement("span");
  keyEl.style.opacity = "0.62";
  keyEl.textContent = key;
  const valueEl = document.createElement("span");
  valueEl.style.wordBreak = "break-all";
  valueEl.textContent = value;
  row.append(keyEl, valueEl);
  return row;
}

function sectionTitle(text: string): HTMLElement {
  const title = document.createElement("div");
  title.style.fontSize = "11px";
  title.style.textTransform = "uppercase";
  title.style.letterSpacing = "0.08em";
  title.style.opacity = "0.65";
  title.style.marginBottom = "5px";
  title.textContent = text;
  return title;
}

function button(label: string, onClick: () => void, title?: string): HTMLButtonElement {
  const result = document.createElement("button");
  result.type = "button";
  result.textContent = label;
  if (title) result.title = title;
  Object.assign(result.style, {
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(255,255,255,0.07)",
    color: "inherit",
    borderRadius: "5px",
    padding: "4px 7px",
    cursor: "pointer",
    fontSize: "11px",
  });
  result.addEventListener("click", onClick);
  return result;
}

function toggleButton(
  label: string,
  active: boolean,
  onChange: (active: boolean) => void,
): HTMLButtonElement {
  const result = button(`${active ? "✓ " : ""}${label}`, () => onChange(!active));
  if (active) result.style.background = "rgba(255,255,255,0.18)";
  return result;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  styles: Partial<CSSStyleDeclaration> = {},
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  Object.assign(element.style, styles);
  return element;
}

function panelSectionStyle(): Partial<CSSStyleDeclaration> {
  return {
    minWidth: "0",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "6px",
    padding: "7px",
    overflow: "hidden",
  };
}

function applyPanelStyle(root: HTMLElement, floating: boolean): void {
  Object.assign(root.style, {
    boxSizing: "border-box",
    width: "min(680px, calc(100vw - 24px))",
    maxHeight: "calc(100vh - 24px)",
    overflow: "auto",
    background: "rgba(20,20,22,0.94)",
    color: "rgba(255,255,255,0.92)",
    border: "1px solid rgba(255,255,255,0.14)",
    borderRadius: "8px",
    padding: "9px",
    fontFamily: "system-ui, sans-serif",
    fontSize: "12px",
    lineHeight: "1.35",
    zIndex: "2147483647",
    pointerEvents: "auto",
    boxShadow: "0 8px 30px rgba(0,0,0,0.35)",
  });
  if (floating) {
    root.style.position = "fixed";
    root.style.top = "12px";
    root.style.right = "12px";
  }
}

function formatVec(value: readonly number[]): string {
  return `(${value.map(formatNumber).join(", ")})`;
}

function formatQuat(value: readonly number[]): string {
  return `(${value.map(formatNumber).join(", ")})`;
}

function formatNumber(value: number): string {
  if (Object.is(value, -0)) return "0";
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
}

export function selectedThreeObject(
  controller: ThreeDevtoolsController,
): Object3D | undefined {
  return controller.selectedObject;
}
