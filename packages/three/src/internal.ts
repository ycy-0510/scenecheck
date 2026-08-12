import type { Object3D } from "three";

const INTERNAL_KEY = "scenecheckInternal";

/** Mark runtime-only SceneCheck helper objects so adapters and inspectors ignore them. */
export function markThreeSceneCheckInternal<T extends Object3D>(object: T): T {
  object.userData[INTERNAL_KEY] = true;
  return object;
}

export function isThreeSceneCheckInternal(object: Object3D): boolean {
  return object.userData[INTERNAL_KEY] === true;
}
