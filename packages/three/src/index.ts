import type { SceneIR } from "@scenecheck/core";
import type { Object3D } from "three";

export interface ThreeSceneAdapterOptions {
  includeInvisible?: boolean;
}

export function fromThreeScene(
  _root: Object3D,
  _options: ThreeSceneAdapterOptions = {},
): SceneIR {
  throw new Error("Three.js adapter is not implemented yet.");
}
