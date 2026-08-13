import type { CollisionShape, Transform } from "@scenecheck/core";
import { markThreeSceneCheckInternal } from "@scenecheck/three";
import {
  BoxGeometry,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
} from "three";
import { ThreeDevtoolsController } from "./controller.js";

/** Runtime-only visualization of explicitly registered collision shapes. */
export class ThreeColliderOverlay {
  readonly controller: ThreeDevtoolsController;
  readonly root: Group;

  private enabledValue = false;
  private destroyed = false;

  constructor(controller: ThreeDevtoolsController) {
    this.controller = controller;
    this.root = markThreeSceneCheckInternal(new Group());
    this.root.name = "SceneCheck Collider Helpers";
    this.root.matrixAutoUpdate = false;
    this.controller.helperRoot.add(this.root);
  }

  get enabled(): boolean {
    return this.enabledValue;
  }

  setEnabled(enabled: boolean): void {
    this.assertAlive();
    this.enabledValue = enabled;
    this.refresh();
  }

  refresh(): void {
    this.assertAlive();
    clearHelpers(this.root);
    if (!this.enabledValue) return;

    const node = this.controller.selectedNode;
    const object = this.controller.selectedObject;
    const colliders = node?.semantics?.colliders;
    if (!node || !object || !colliders?.length) return;

    this.controller.scene.updateWorldMatrix(true, true);
    object.updateWorldMatrix(true, false);
    syncHelperRoot(this.controller);

    for (const collider of colliders) {
      this.root.add(createColliderHelper(object.matrixWorld, collider));
    }
    this.controller.helperRoot.updateMatrixWorld(true);
  }

  destroy(): void {
    if (this.destroyed) return;
    clearHelpers(this.root);
    this.root.removeFromParent();
    this.destroyed = true;
  }

  private assertAlive(): void {
    if (this.destroyed) {
      throw new Error("SceneCheck collider overlay has been destroyed.");
    }
  }
}

function createColliderHelper(
  ownerWorld: Matrix4,
  collider: CollisionShape,
): Mesh {
  const geometry =
    collider.type === "box"
      ? new BoxGeometry(1, 1, 1)
      : new SphereGeometry(1, 16, 10);
  const material = new MeshBasicMaterial({
    wireframe: true,
    transparent: true,
    opacity: 0.85,
    depthTest: false,
    depthWrite: false,
  });
  const helper = markThreeSceneCheckInternal(new Mesh(geometry, material));
  helper.name = `SceneCheck Collider ${collider.id}`;
  helper.matrixAutoUpdate = false;

  const shapeMatrix = transformMatrix(collider.transform);
  const primitiveScale = new Matrix4().makeScale(
    collider.type === "box" ? collider.size[0] : collider.radius,
    collider.type === "box" ? collider.size[1] : collider.radius,
    collider.type === "box" ? collider.size[2] : collider.radius,
  );
  helper.matrix.copy(ownerWorld).multiply(shapeMatrix).multiply(primitiveScale);
  helper.matrixWorldNeedsUpdate = true;
  helper.renderOrder = 9_900;
  return helper;
}

function transformMatrix(transform: Transform): Matrix4 {
  if (transform.matrix) return new Matrix4().fromArray(transform.matrix);
  return new Matrix4().compose(
    new Vector3(...transform.position),
    new Quaternion(...transform.rotation),
    new Vector3(...transform.scale),
  );
}

function syncHelperRoot(controller: ThreeDevtoolsController): void {
  controller.scene.updateWorldMatrix(true, false);
  controller.helperRoot.matrix
    .copy(controller.scene.matrixWorld)
    .invert();
  controller.helperRoot.matrixWorldNeedsUpdate = true;
}

function clearHelpers(root: Group): void {
  for (const child of [...root.children]) {
    if (child instanceof Mesh) {
      child.geometry.dispose();
      if (Array.isArray(child.material)) {
        for (const material of child.material) material.dispose();
      } else {
        child.material.dispose();
      }
    }
    child.removeFromParent();
  }
}
