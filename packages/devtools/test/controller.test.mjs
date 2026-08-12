import assert from "node:assert/strict";
import { test } from "node:test";
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, Scene } from "three";
import { describeThreeObject, fromThreeScene } from "@scenecheck/three";
import { ThreeDevtoolsController } from "../dist/index.js";

function makeScene() {
  const scene = new Scene();
  scene.name = "World";

  const tunnel = new Group();
  tunnel.name = "Tunnel";
  describeThreeObject(tunnel, { id: "tunnel" });

  const wall = new Mesh(new BoxGeometry(2, 4, 6), new MeshBasicMaterial());
  wall.name = "Wall";
  describeThreeObject(wall, { id: "wall" });
  tunnel.add(wall);

  const hiddenChild = new Group();
  hiddenChild.name = "Hidden Child";
  hiddenChild.visible = false;
  describeThreeObject(hiddenChild, { id: "hidden-child" });
  tunnel.add(hiddenChild);

  const road = new Group();
  road.name = "Road";
  describeThreeObject(road, { id: "road" });

  scene.add(tunnel, road);
  return { scene, tunnel, wall, hiddenChild, road };
}

test("controller maps Scene IR IDs back to live Three.js objects", () => {
  const { scene, tunnel } = makeScene();
  const controller = new ThreeDevtoolsController({ scene });

  assert.equal(controller.ir.nodes.tunnel?.name, "Tunnel");
  controller.select("tunnel");
  assert.equal(controller.selectedObject, tunnel);
  assert.equal(controller.selectedNode?.id, "tunnel");

  controller.destroy();
});

test("runtime helper group is present in Three.js but never enters Scene IR", () => {
  const { scene } = makeScene();
  const controller = new ThreeDevtoolsController({ scene });

  assert.equal(controller.helperRoot.parent, scene);
  assert.equal(
    Object.values(controller.ir.nodes).some((node) => node.name === "SceneCheck DevTools Helpers"),
    false,
  );
  assert.equal(
    Object.values(fromThreeScene(scene).nodes).some(
      (node) => node.name === "SceneCheck DevTools Helpers",
    ),
    false,
  );

  controller.destroy();
});

test("hide is runtime-only and destroy restores the original visibility", () => {
  const { scene, tunnel } = makeScene();
  const controller = new ThreeDevtoolsController({ scene });
  controller.select("tunnel");

  controller.setSelectedHidden(true);
  assert.equal(tunnel.visible, false);
  assert.equal(controller.selectedNode?.metadata?.["three.visible"], false);

  controller.setSelectedHidden(false);
  assert.equal(tunnel.visible, true);

  controller.setSelectedHidden(true);
  controller.destroy();
  assert.equal(tunnel.visible, true);
});

test("isolate hides unrelated objects, preserves hidden descendants, and restores exact state", () => {
  const { scene, tunnel, hiddenChild, road } = makeScene();
  const controller = new ThreeDevtoolsController({ scene });
  controller.select("tunnel");

  controller.isolateSelected();
  assert.equal(controller.isolatedId, "tunnel");
  assert.equal(scene.visible, true);
  assert.equal(tunnel.visible, true);
  assert.equal(hiddenChild.visible, false);
  assert.equal(road.visible, false);

  controller.clearIsolation();
  controller.refresh();
  assert.equal(controller.isolatedId, undefined);
  assert.equal(tunnel.visible, true);
  assert.equal(hiddenChild.visible, false);
  assert.equal(road.visible, true);

  controller.destroy();
});

test("bounds and axes helpers can be toggled without becoming inspectable nodes", () => {
  const { scene } = makeScene();
  const controller = new ThreeDevtoolsController({ scene });
  controller.select("wall");

  controller.setShowBounds(true);
  controller.setShowAxes(true);
  assert.equal(controller.helperRoot.children.length, 2);

  controller.refresh();
  assert.equal(controller.helperRoot.children.length, 2);
  assert.equal(Object.keys(controller.ir.nodes).some((id) => id.includes("SceneCheck")), false);

  controller.setShowBounds(false);
  assert.equal(controller.helperRoot.children.length, 1);
  controller.setShowAxes(false);
  assert.equal(controller.helperRoot.children.length, 0);

  controller.destroy();
});

test("destroy removes helpers and restores visibility after active isolation", () => {
  const { scene, tunnel, road } = makeScene();
  const controller = new ThreeDevtoolsController({ scene });
  const helperRoot = controller.helperRoot;
  controller.select("tunnel");
  controller.isolateSelected();
  controller.setShowAxes(true);

  assert.equal(road.visible, false);
  assert.equal(helperRoot.parent, scene);

  controller.destroy();
  assert.equal(road.visible, true);
  assert.equal(tunnel.visible, true);
  assert.equal(helperRoot.parent, null);
  assert.equal(helperRoot.children.length, 0);
});
