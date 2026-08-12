import type { SceneIR, SceneNode } from "@scenecheck/core";
import {
  fromThreeScene,
  isThreeSceneCheckInternal,
  markThreeSceneCheckInternal,
  type ThreeSceneAdapterOptions,
} from "@scenecheck/three";
import {
  AxesHelper,
  Box3,
  Box3Helper,
  Group,
  Matrix4,
  type Object3D,
} from "three";

export interface ThreeDevtoolsControllerOptions {
  scene: Object3D;
  adapter?: ThreeSceneAdapterOptions;
  axesSize?: number;
}

export interface ThreeDevtoolsState {
  selectedId?: string;
  isolatedId?: string;
  showBounds: boolean;
  showAxes: boolean;
}

/** Runtime-only inspector state. It never rewrites application source or child transforms. */
export class ThreeDevtoolsController {
  readonly scene: Object3D;
  readonly helperRoot: Group;

  private readonly adapterOptions: ThreeSceneAdapterOptions;
  private readonly axesSize: number;
  private sceneIR: SceneIR;
  private objects = new Map<string, Object3D>();
  private visibilityOriginals = new Map<Object3D, boolean>();
  private isolationSnapshot: Map<Object3D, boolean> | undefined;
  private boundsHelper: Box3Helper | undefined;
  private axesHelper: AxesHelper | undefined;
  private selectedIdValue: string | undefined;
  private isolatedIdValue: string | undefined;
  private showBoundsValue = false;
  private showAxesValue = false;
  private destroyed = false;

  constructor(options: ThreeDevtoolsControllerOptions) {
    this.scene = options.scene;
    this.adapterOptions = options.adapter ?? {};
    this.axesSize = options.axesSize ?? 2;

    this.helperRoot = markThreeSceneCheckInternal(new Group());
    this.helperRoot.name = "SceneCheck DevTools Helpers";
    this.helperRoot.matrixAutoUpdate = false;
    this.scene.add(this.helperRoot);

    this.sceneIR = fromThreeScene(this.scene, this.adapterOptions);
    this.rebuildObjectMap();
    this.syncHelperRootMatrix();
  }

  get state(): ThreeDevtoolsState {
    return {
      ...(this.selectedIdValue ? { selectedId: this.selectedIdValue } : {}),
      ...(this.isolatedIdValue ? { isolatedId: this.isolatedIdValue } : {}),
      showBounds: this.showBoundsValue,
      showAxes: this.showAxesValue,
    };
  }

  get ir(): SceneIR {
    return this.sceneIR;
  }

  get selectedId(): string | undefined {
    return this.selectedIdValue;
  }

  get isolatedId(): string | undefined {
    return this.isolatedIdValue;
  }

  get selectedNode(): SceneNode | undefined {
    return this.selectedIdValue ? this.sceneIR.nodes[this.selectedIdValue] : undefined;
  }

  get selectedObject(): Object3D | undefined {
    return this.selectedIdValue ? this.objects.get(this.selectedIdValue) : undefined;
  }

  refresh(): SceneIR {
    this.assertAlive();
    this.sceneIR = fromThreeScene(this.scene, this.adapterOptions);
    this.rebuildObjectMap();

    if (this.selectedIdValue && !this.sceneIR.nodes[this.selectedIdValue]) {
      this.selectedIdValue = undefined;
      this.clearVisualHelpers();
    }
    if (this.isolatedIdValue && !this.sceneIR.nodes[this.isolatedIdValue]) {
      this.clearIsolation();
    }

    this.refreshVisualHelpers();
    return this.sceneIR;
  }

  select(id: string | undefined): SceneNode | undefined {
    this.assertAlive();
    if (id !== undefined && !this.sceneIR.nodes[id]) {
      throw new Error(`SceneCheck DevTools node not found: "${id}".`);
    }
    this.selectedIdValue = id;
    this.refreshVisualHelpers();
    return id ? this.sceneIR.nodes[id] : undefined;
  }

  setSelectedHidden(hidden: boolean): void {
    const object = this.requireSelectedObject();
    this.clearIsolation();
    this.overrideVisibility(object, !hidden);
    this.refresh();
  }

  isolateSelected(): void {
    const selected = this.requireSelectedObject();
    this.clearIsolation();

    const candidates = this.listInspectableObjects();
    const snapshot = new Map<Object3D, boolean>();
    for (const object of candidates) snapshot.set(object, object.visible);
    this.isolationSnapshot = snapshot;

    const ancestors = new Set<Object3D>();
    let ancestor: Object3D | null = selected;
    while (ancestor) {
      ancestors.add(ancestor);
      ancestor = ancestor.parent;
    }

    const descendants = new Set<Object3D>();
    selected.traverse((object) => {
      if (!isThreeSceneCheckInternal(object)) descendants.add(object);
    });

    for (const object of candidates) {
      this.rememberVisibility(object);
      if (ancestors.has(object)) {
        object.visible = true;
      } else if (descendants.has(object)) {
        object.visible = snapshot.get(object) ?? object.visible;
      } else {
        object.visible = false;
      }
    }

    this.isolatedIdValue = this.selectedIdValue;
    this.refresh();
  }

  clearIsolation(): void {
    if (!this.isolationSnapshot) {
      this.isolatedIdValue = undefined;
      return;
    }

    for (const [object, visible] of this.isolationSnapshot) {
      object.visible = visible;
    }
    this.isolationSnapshot = undefined;
    this.isolatedIdValue = undefined;
  }

  setShowBounds(enabled: boolean): void {
    this.assertAlive();
    this.showBoundsValue = enabled;
    this.refreshVisualHelpers();
  }

  setShowAxes(enabled: boolean): void {
    this.assertAlive();
    this.showAxesValue = enabled;
    this.refreshVisualHelpers();
  }

  destroy(): void {
    if (this.destroyed) return;

    this.clearIsolation();
    for (const [object, visible] of this.visibilityOriginals) {
      object.visible = visible;
    }
    this.visibilityOriginals.clear();
    this.clearVisualHelpers();
    this.helperRoot.removeFromParent();
    this.destroyed = true;
  }

  private rebuildObjectMap(): void {
    const byUuid = new Map<string, Object3D>();
    this.scene.traverse((object) => {
      if (!isThreeSceneCheckInternal(object)) byUuid.set(object.uuid, object);
    });

    const next = new Map<string, Object3D>();
    for (const [id, node] of Object.entries(this.sceneIR.nodes)) {
      const uuid = node.metadata?.["three.uuid"];
      if (typeof uuid !== "string") continue;
      const object = byUuid.get(uuid);
      if (object) next.set(id, object);
    }
    this.objects = next;
  }

  private listInspectableObjects(): Object3D[] {
    const objects: Object3D[] = [];
    this.scene.traverse((object) => {
      if (!isThreeSceneCheckInternal(object)) objects.push(object);
    });
    return objects;
  }

  private requireSelectedObject(): Object3D {
    this.assertAlive();
    const object = this.selectedObject;
    if (!object || !this.selectedIdValue) {
      throw new Error("SceneCheck DevTools has no selected object.");
    }
    return object;
  }

  private overrideVisibility(object: Object3D, visible: boolean): void {
    this.rememberVisibility(object);
    object.visible = visible;
  }

  private rememberVisibility(object: Object3D): void {
    if (!this.visibilityOriginals.has(object)) {
      this.visibilityOriginals.set(object, object.visible);
    }
  }

  private refreshVisualHelpers(): void {
    this.clearVisualHelpers();
    const object = this.selectedObject;
    if (!object) return;

    this.scene.updateWorldMatrix(true, true);
    this.syncHelperRootMatrix();

    if (this.showBoundsValue) {
      const box = new Box3().setFromObject(object, true);
      if (!box.isEmpty()) {
        this.boundsHelper = markThreeSceneCheckInternal(new Box3Helper(box));
        this.boundsHelper.name = "SceneCheck Selected Bounds";
        this.helperRoot.add(this.boundsHelper);
      }
    }

    if (this.showAxesValue) {
      const axes = markThreeSceneCheckInternal(new AxesHelper(this.axesSize));
      axes.name = "SceneCheck Selected Axes";
      axes.matrixAutoUpdate = false;
      axes.matrix.copy(object.matrixWorld);
      axes.matrixWorldNeedsUpdate = true;
      this.axesHelper = axes;
      this.helperRoot.add(axes);
    }

    this.helperRoot.updateMatrixWorld(true);
  }

  private syncHelperRootMatrix(): void {
    this.scene.updateWorldMatrix(true, false);
    const inverseSceneWorld = new Matrix4().copy(this.scene.matrixWorld).invert();
    this.helperRoot.matrix.copy(inverseSceneWorld);
    this.helperRoot.matrixWorldNeedsUpdate = true;
  }

  private clearVisualHelpers(): void {
    if (this.boundsHelper) {
      this.boundsHelper.removeFromParent();
      this.boundsHelper.geometry.dispose();
      this.boundsHelper.material.dispose();
      this.boundsHelper = undefined;
    }
    if (this.axesHelper) {
      this.axesHelper.removeFromParent();
      this.axesHelper.geometry.dispose();
      const material = this.axesHelper.material;
      if (Array.isArray(material)) material.forEach((item) => item.dispose());
      else material.dispose();
      this.axesHelper = undefined;
    }
  }

  private assertAlive(): void {
    if (this.destroyed) throw new Error("SceneCheck DevTools controller has been destroyed.");
  }
}
