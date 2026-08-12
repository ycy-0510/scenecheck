import type { Camera, Object3D } from "three";
import {
  ThreeDevtoolsController,
  type ThreeDevtoolsControllerOptions,
} from "./controller.js";
import {
  createThreeDevtoolsPanel,
  type ThreeDevtoolsPanel,
} from "./panel.js";
import {
  ThreeViewportInteraction,
  type ThreeViewportInteractionOptions,
} from "./viewport.js";

export * from "./controller.js";
export * from "./panel.js";
export * from "./viewport.js";

export interface AttachThreeDevtoolsOptions
  extends Omit<ThreeDevtoolsControllerOptions, "scene"> {
  scene: Object3D;
  container?: HTMLElement;
  title?: string;
  /** Provide together with domElement to enable viewport picking/annotation modes. */
  camera?: Camera;
  /** Usually renderer.domElement. Provide together with camera. */
  domElement?: HTMLElement;
  markerSize?: number;
}

export interface AttachedThreeDevtools {
  controller: ThreeDevtoolsController;
  panel: ThreeDevtoolsPanel;
  viewport?: ThreeViewportInteraction;
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

  if ((options.camera && !options.domElement) || (!options.camera && options.domElement)) {
    controller.destroy();
    throw new Error(
      "SceneCheck viewport interaction requires both camera and domElement.",
    );
  }

  let panel: ThreeDevtoolsPanel | undefined;
  let viewport: ThreeViewportInteraction | undefined;
  let destroyed = false;

  function destroy(): void {
    if (destroyed) return;
    destroyed = true;
    viewport?.destroy();
    panel?.destroy();
    controller.destroy();
  }

  if (options.camera && options.domElement) {
    const viewportOptions: ThreeViewportInteractionOptions = {
      controller,
      camera: options.camera,
      domElement: options.domElement,
      ...(options.markerSize !== undefined ? { markerSize: options.markerSize } : {}),
    };
    viewport = new ThreeViewportInteraction(viewportOptions);
  }

  panel = createThreeDevtoolsPanel({
    controller,
    ...(viewport ? { viewport } : {}),
    ...(options.container ? { container: options.container } : {}),
    ...(options.title ? { title: options.title } : {}),
    onClose: destroy,
  });
  viewport?.setOnChange(() => panel?.render());

  return {
    controller,
    panel,
    ...(viewport ? { viewport } : {}),
    element: panel.element,
    destroy,
  };
}
