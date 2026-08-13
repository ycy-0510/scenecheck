import type { Object3D } from "three";
import {
  ThreeDevtoolsController,
  type ThreeDevtoolsControllerOptions,
} from "./controller.js";
import {
  createThreeDevtoolsPanel,
  type ThreeDevtoolsPanel,
} from "./panel.js";

export * from "./controller.js";
export * from "./panel.js";

export interface AttachThreeDevtoolsOptions
  extends Omit<ThreeDevtoolsControllerOptions, "scene"> {
  scene: Object3D;
  container?: HTMLElement;
  title?: string;
}

export interface AttachedThreeDevtools {
  controller: ThreeDevtoolsController;
  panel: ThreeDevtoolsPanel;
  element: HTMLElement;
  destroy(): void;
}

/** Attach a runtime-only SceneCheck inspector to an existing Three.js scene. */
export function attachThreeDevtools(
  options: AttachThreeDevtoolsOptions,
): AttachedThreeDevtools {
  if (typeof document === "undefined") {
    throw new Error("attachThreeDevtools() requires a browser DOM.");
  }

  const controller = new ThreeDevtoolsController({
    scene: options.scene,
    ...(options.adapter ? { adapter: options.adapter } : {}),
    ...(options.axesSize !== undefined ? { axesSize: options.axesSize } : {}),
  });
  const panel = createThreeDevtoolsPanel({
    controller,
    ...(options.container ? { container: options.container } : {}),
    ...(options.title ? { title: options.title } : {}),
  });

  let destroyed = false;
  return {
    controller,
    panel,
    element: panel.element,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      panel.destroy();
      controller.destroy();
    },
  };
}
