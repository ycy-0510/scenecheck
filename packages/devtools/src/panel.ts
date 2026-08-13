import type { SceneNode, Transform } from "@scenecheck/core";
import type { Object3D } from "three";
import { ThreeDevtoolsController } from "./controller.js";

export interface ThreeDevtoolsPanelOptions {
  controller: ThreeDevtoolsController;
  container?: HTMLElement;
  title?: string;
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
  const container = options.container ?? document.body;
  const root = document.createElement("aside");
  root.dataset.scenecheckDevtools = "true";
  applyPanelStyle(root, options.container === undefined);
  container.append(root);

  let destroyed = false;

  function render(): void {
    if (destroyed) return;
    root.replaceChildren();

    const header = el("div", { display: "flex", alignItems: "center", gap: "8px" });
    const title = el("strong");
    title.textContent = options.title ?? "SceneCheck";
    title.style.flex = "1";
    header.append(title);
    header.append(
      button("Refresh", () => {
        controller.refresh();
        render();
      }),
    );
    header.append(
      button(
        "×",
        () => {
          controller.destroy();
          api.destroy();
        },
        "Close SceneCheck DevTools",
      ),
    );
    root.append(header);

    const body = el("div", {
      display: "grid",
      gridTemplateColumns: "minmax(120px, 0.9fr) minmax(160px, 1.1fr)",
      gap: "8px",
      marginTop: "8px",
      minHeight: "220px",
    });

    const tree = el("div", panelSectionStyle());
    const treeTitle = sectionTitle("Scene");
    tree.append(treeTitle);
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
      empty.textContent = "Select an object from the scene tree.";
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
