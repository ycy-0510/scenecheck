import type { Annotation, Transform } from "@scenecheck/core";
import {
  isThreeSceneCheckInternal,
  readThreeSceneAnnotations,
  setThreeSceneAnnotations,
} from "@scenecheck/three";
import {
  ArrowHelper,
  type Camera,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Quaternion,
  Raycaster,
  SphereGeometry,
  Vector2,
  Vector3,
  type Intersection,
  type Object3D,
} from "three";
import { ThreeDevtoolsController } from "./controller.js";

export type ThreeViewportMode = "idle" | "select" | "point" | "pose";

export interface ThreeViewportInteractionOptions {
  controller: ThreeDevtoolsController;
  camera: Camera;
  domElement: HTMLElement;
  markerSize?: number;
  onChange?: () => void;
}

export interface ViewportPickResult {
  id: string;
  object: Object3D;
  point: readonly [number, number, number];
  normal: readonly [number, number, number];
  distance: number;
}

/**
 * Optional viewport interaction layer for human selection and 3D annotations.
 * It only consumes pointer events while an explicit mode is active.
 */
export class ThreeViewportInteraction {
  readonly controller: ThreeDevtoolsController;
  readonly camera: Camera;
  readonly domElement: HTMLElement;
  readonly markerRoot: Group;

  private readonly raycaster = new Raycaster();
  private readonly pointer = new Vector2();
  private readonly markerSize: number;
  private modeValue: ThreeViewportMode = "idle";
  private destroyed = false;
  private onChange?: () => void;

  constructor(options: ThreeViewportInteractionOptions) {
    this.controller = options.controller;
    this.camera = options.camera;
    this.domElement = options.domElement;
    this.markerSize = options.markerSize ?? 0.18;
    this.onChange = options.onChange;

    this.markerRoot = new Group();
    this.markerRoot.name = "SceneCheck Annotation Markers";
    this.markerRoot.userData.scenecheckInternal = true;
    this.controller.helperRoot.add(this.markerRoot);

    this.domElement.addEventListener("pointerdown", this.handlePointerDown, true);
    this.refreshMarkers();
  }

  get mode(): ThreeViewportMode {
    return this.modeValue;
  }

  setMode(mode: ThreeViewportMode): void {
    this.assertAlive();
    this.modeValue = mode;
    this.onChange?.();
  }

  setOnChange(callback: (() => void) | undefined): void {
    this.onChange = callback;
  }

  pickClientPoint(clientX: number, clientY: number): ViewportPickResult | undefined {
    this.assertAlive();
    const rect = this.domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return undefined;

    const x = ((clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((clientY - rect.top) / rect.height) * 2 + 1;
    return this.pickNdc(x, y);
  }

  pickNdc(x: number, y: number): ViewportPickResult | undefined {
    this.assertAlive();
    this.controller.scene.updateWorldMatrix(true, true);
    this.camera.updateWorldMatrix(true, false);
    this.pointer.set(x, y);
    this.raycaster.setFromCamera(this.pointer, this.camera);

    const intersections = this.raycaster.intersectObject(this.controller.scene, true);
    for (const intersection of intersections) {
      if (isInternalHierarchy(intersection.object)) continue;
      if (!isEffectivelyVisible(intersection.object)) continue;

      const id = findSceneCheckId(this.controller, intersection.object);
      if (!id) continue;

      const normal = worldNormal(intersection);
      return {
        id,
        object: intersection.object,
        point: [intersection.point.x, intersection.point.y, intersection.point.z],
        normal: [normal.x, normal.y, normal.z],
        distance: intersection.distance,
      };
    }
    return undefined;
  }

  addAnnotationFromPick(
    pick: ViewportPickResult,
    type: "point" | "pose",
  ): Annotation {
    this.assertAlive();
    const targetObject = this.controller.selectedId === pick.id
      ? this.controller.selectedObject ?? pick.object
      : objectForId(this.controller, pick.id) ?? pick.object;
    targetObject.updateWorldMatrix(true, false);

    const worldPosition = new Vector3(...pick.point);
    const normal = new Vector3(...pick.normal).normalize();
    const worldRotation = new Quaternion().setFromUnitVectors(
      new Vector3(0, 0, 1),
      normal.lengthSq() > 0 ? normal : new Vector3(0, 1, 0),
    );
    const worldMatrix = new Matrix4().compose(
      worldPosition,
      worldRotation,
      new Vector3(1, 1, 1),
    );
    const localMatrix = new Matrix4()
      .copy(targetObject.matrixWorld)
      .invert()
      .multiply(worldMatrix);

    const annotation: Annotation = {
      id: nextAnnotationId(this.controller.scene, type),
      type,
      attachedTo: pick.id,
      localTransform: matrixToTransform(localMatrix),
      worldTransform: matrixToTransform(worldMatrix),
      label: type === "pose" ? "Target pose" : "Point",
    };

    const existing = readThreeSceneAnnotations(this.controller.scene) ?? [];
    setThreeSceneAnnotations(this.controller.scene, [...existing, annotation]);
    this.controller.refresh();
    this.refreshMarkers();
    this.onChange?.();
    return annotation;
  }

  refreshMarkers(): void {
    this.assertAlive();
    clearObjectChildren(this.markerRoot);

    for (const annotation of this.controller.ir.annotations ?? []) {
      const world = resolveAnnotationWorldTransform(this.controller, annotation);
      const point = new Vector3(...world.position);
      const rotation = new Quaternion(...world.rotation);

      const sphere = new Mesh(
        new SphereGeometry(this.markerSize, 10, 8),
        new MeshBasicMaterial({ depthTest: false }),
      );
      sphere.name = `SceneCheck Annotation ${annotation.id}`;
      sphere.userData.scenecheckInternal = true;
      sphere.position.copy(point);
      sphere.renderOrder = 10_000;
      this.markerRoot.add(sphere);

      if (annotation.type === "pose" || annotation.type === "arrow") {
        const direction = new Vector3(0, 0, 1).applyQuaternion(rotation).normalize();
        const arrow = new ArrowHelper(
          direction,
          point,
          this.markerSize * 5,
        );
        arrow.name = `SceneCheck Annotation Direction ${annotation.id}`;
        arrow.userData.scenecheckInternal = true;
        arrow.renderOrder = 10_001;
        this.markerRoot.add(arrow);
      }
    }
  }

  destroy(): void {
    if (this.destroyed) return;
    this.domElement.removeEventListener("pointerdown", this.handlePointerDown, true);
    clearObjectChildren(this.markerRoot);
    this.markerRoot.removeFromParent();
    this.destroyed = true;
  }

  private readonly handlePointerDown = (event: PointerEvent): void => {
    if (this.destroyed || this.modeValue === "idle") return;

    event.preventDefault();
    event.stopPropagation();

    const pick = this.pickClientPoint(event.clientX, event.clientY);
    if (!pick) return;

    if (this.modeValue === "select") {
      this.controller.select(pick.id);
      this.onChange?.();
      return;
    }

    this.controller.select(pick.id);
    this.addAnnotationFromPick(pick, this.modeValue);
  };

  private assertAlive(): void {
    if (this.destroyed) {
      throw new Error("SceneCheck viewport interaction has been destroyed.");
    }
  }
}

function findSceneCheckId(
  controller: ThreeDevtoolsController,
  object: Object3D,
): string | undefined {
  let current: Object3D | null = object;
  while (current) {
    const uuid = current.uuid;
    for (const [id, node] of Object.entries(controller.ir.nodes)) {
      if (node.metadata?.["three.uuid"] === uuid) return id;
    }
    current = current.parent;
  }
  return undefined;
}

function objectForId(
  controller: ThreeDevtoolsController,
  id: string,
): Object3D | undefined {
  const currentSelected = controller.selectedId;
  controller.select(id);
  const object = controller.selectedObject;
  controller.select(currentSelected);
  return object;
}

function isInternalHierarchy(object: Object3D): boolean {
  let current: Object3D | null = object;
  while (current) {
    if (isThreeSceneCheckInternal(current)) return true;
    current = current.parent;
  }
  return false;
}

function isEffectivelyVisible(object: Object3D): boolean {
  let current: Object3D | null = object;
  while (current) {
    if (!current.visible) return false;
    current = current.parent;
  }
  return true;
}

function worldNormal(intersection: Intersection<Object3D>): Vector3 {
  if (!intersection.face) return new Vector3(0, 1, 0);
  return intersection.face.normal
    .clone()
    .transformDirection(intersection.object.matrixWorld)
    .normalize();
}

function nextAnnotationId(root: Object3D, type: "point" | "pose"): string {
  const existing = new Set(
    (readThreeSceneAnnotations(root) ?? []).map((annotation) => annotation.id),
  );
  const prefix = type === "pose" ? "pose" : "point";
  let index = 1;
  while (existing.has(`${prefix}-${index}`)) index += 1;
  return `${prefix}-${index}`;
}

function matrixToTransform(matrix: Matrix4): Transform {
  const position = new Vector3();
  const rotation = new Quaternion();
  const scale = new Vector3();
  matrix.decompose(position, rotation, scale);
  return {
    position: [position.x, position.y, position.z],
    rotation: [rotation.x, rotation.y, rotation.z, rotation.w],
    scale: [scale.x, scale.y, scale.z],
    matrix: matrix.elements.slice() as Transform["matrix"],
  };
}

function resolveAnnotationWorldTransform(
  controller: ThreeDevtoolsController,
  annotation: Annotation,
): Transform {
  if (annotation.attachedTo && annotation.localTransform) {
    const node = controller.ir.nodes[annotation.attachedTo];
    if (node) {
      const object = objectForId(controller, annotation.attachedTo);
      if (object) {
        object.updateWorldMatrix(true, false);
        const local = new Matrix4().fromArray(
          annotation.localTransform.matrix ?? transformToArray(annotation.localTransform),
        );
        return matrixToTransform(new Matrix4().multiplyMatrices(object.matrixWorld, local));
      }
    }
  }
  return annotation.worldTransform;
}

function transformToArray(transform: Transform): number[] {
  return new Matrix4()
    .compose(
      new Vector3(...transform.position),
      new Quaternion(...transform.rotation),
      new Vector3(...transform.scale),
    )
    .toArray();
}

function clearObjectChildren(root: Group): void {
  for (const child of [...root.children]) {
    child.traverse((object) => {
      const candidate = object as Object3D & {
        geometry?: { dispose?: () => void };
        material?: { dispose?: () => void } | Array<{ dispose?: () => void }>;
      };
      candidate.geometry?.dispose?.();
      if (Array.isArray(candidate.material)) {
        for (const material of candidate.material) material.dispose?.();
      } else {
        candidate.material?.dispose?.();
      }
    });
    child.removeFromParent();
  }
}
