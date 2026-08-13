import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BoxGeometry,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Scene,
} from "three";
import { resolveAnnotation } from "@scenecheck/core";
import { describeThreeObject } from "@scenecheck/three";
import {
  ThreeDevtoolsController,
  ThreeViewportInteraction,
} from "../dist/index.js";

function makeViewportScene() {
  const scene = new Scene();
  scene.name = "World";

  const box = new Mesh(new BoxGeometry(2, 2, 2), new MeshBasicMaterial());
  box.name = "Box";
  describeThreeObject(box, { id: "box" });
  scene.add(box);

  const camera = new PerspectiveCamera(60, 1, 0.1, 100);
  camera.position.set(0, 0, 5);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);

  const domElement = fakeDomElement();
  const controller = new ThreeDevtoolsController({ scene });
  const viewport = new ThreeViewportInteraction({
    controller,
    camera,
    domElement,
    markerSize: 0.1,
  });

  return { scene, box, camera, domElement, controller, viewport };
}

test("viewport raycast maps a visible surface back to its SceneCheck ID", () => {
  const { controller, viewport } = makeViewportScene();
  const pick = viewport.pickNdc(0, 0);

  assert.equal(pick?.id, "box");
  assert.deepEqual(pick?.point.map(round), [0, 0, 1]);
  assert.deepEqual(pick?.normal.map(round), [0, 0, 1]);
  assert.ok((pick?.distance ?? 0) > 3.9 && (pick?.distance ?? 0) < 4.1);

  viewport.destroy();
  controller.destroy();
});

test("point annotation stores local attachment data and becomes visible in Scene IR", () => {
  const { controller, viewport } = makeViewportScene();
  const pick = viewport.pickNdc(0, 0);
  assert.ok(pick);

  const annotation = viewport.addAnnotationFromPick(pick, "point");

  assert.equal(annotation.id, "point-1");
  assert.equal(annotation.attachedTo, "box");
  assert.deepEqual(annotation.localTransform?.position.map(round), [0, 0, 1]);
  assert.equal(controller.ir.annotations?.[0]?.id, "point-1");
  assert.equal(viewport.markerRoot.children.length, 1);

  viewport.destroy();
  controller.destroy();
});

test("attached annotation follows the object after it moves", () => {
  const { box, controller, viewport } = makeViewportScene();
  const pick = viewport.pickNdc(0, 0);
  assert.ok(pick);
  viewport.addAnnotationFromPick(pick, "point");

  box.position.set(3, 0, 0);
  box.updateMatrix();
  controller.refresh();
  viewport.refreshMarkers();

  const resolved = resolveAnnotation(controller.ir, "point-1");
  assert.deepEqual(resolved.worldTransform.position.map(round), [3, 0, 1]);
  assert.equal(resolved.followsAttachment, true);

  viewport.destroy();
  controller.destroy();
});

test("pose annotation records surface orientation and renders direction helper", () => {
  const { controller, viewport } = makeViewportScene();
  const pick = viewport.pickNdc(0, 0);
  assert.ok(pick);
  const annotation = viewport.addAnnotationFromPick(pick, "pose");

  assert.equal(annotation.id, "pose-1");
  assert.deepEqual(annotation.worldTransform.position.map(round), [0, 0, 1]);
  assert.deepEqual(annotation.worldTransform.rotation.map(round), [0, 0, 0, 1]);
  assert.equal(viewport.markerRoot.children.length, 2);

  viewport.destroy();
  controller.destroy();
});

test("viewport ignores SceneCheck internal helpers when picking", () => {
  const { controller, viewport } = makeViewportScene();
  viewport.setMode("point");
  viewport.refreshMarkers();

  const pick = viewport.pickNdc(0, 0);
  assert.equal(pick?.id, "box");

  viewport.destroy();
  controller.destroy();
});

function fakeDomElement() {
  const listeners = new Map();
  return {
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    removeEventListener(type, listener) {
      if (listeners.get(type) === listener) listeners.delete(type);
    },
    getBoundingClientRect() {
      return {
        left: 0,
        top: 0,
        width: 100,
        height: 100,
        right: 100,
        bottom: 100,
        x: 0,
        y: 0,
        toJSON() {},
      };
    },
    hasPointerListener() {
      return listeners.has("pointerdown");
    },
  };
}

function round(value) {
  const rounded = Math.round(value * 1e8) / 1e8;
  return Object.is(rounded, -0) ? 0 : rounded;
}
