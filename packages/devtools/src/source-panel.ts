import type { SourceLocation } from "@scenecheck/core";
import { ThreeDevtoolsController } from "./controller.js";

/** Human-readable portable source reference, e.g. src/world/tunnel.ts:183:5. */
export function formatSourceLocation(source: SourceLocation): string {
  const line = source.line !== undefined ? `:${source.line}` : "";
  const column = source.column !== undefined ? `:${source.column}` : "";
  return `${source.file}${line}${column}`;
}

/**
 * Render source mapping for the currently selected SceneCheck node.
 * Returns undefined when the selected node has no mapped application source.
 */
export function renderSelectedSourcePanel(
  controller: ThreeDevtoolsController,
): HTMLElement | undefined {
  const source = controller.selectedNode?.source;
  if (!source) return undefined;

  const root = document.createElement("section");
  root.dataset.scenecheckSource = "true";
  Object.assign(root.style, {
    marginTop: "8px",
    padding: "7px",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "6px",
    background: "rgba(255,255,255,0.025)",
  });

  const heading = document.createElement("div");
  heading.textContent = "Source";
  Object.assign(heading.style, {
    fontSize: "10px",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    opacity: "0.58",
    marginBottom: "4px",
  });

  const reference = document.createElement("code");
  reference.textContent = formatSourceLocation(source);
  reference.title = formatSourceLocation(source);
  Object.assign(reference.style, {
    display: "block",
    fontSize: "11px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    userSelect: "text",
  });

  root.append(heading, reference);

  if (source.symbol) {
    const symbol = document.createElement("div");
    symbol.textContent = source.symbol;
    Object.assign(symbol.style, {
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
      fontSize: "10px",
      opacity: "0.52",
      marginTop: "3px",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      userSelect: "text",
    });
    symbol.title = source.symbol;
    root.append(symbol);
  }

  return root;
}
