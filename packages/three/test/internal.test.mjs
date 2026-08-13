import assert from "node:assert/strict";
import { test } from "node:test";
import { Group, Scene } from "three";
import {
  fromThreeScene,
  isThreeSceneCheckInternal,
  markThreeSceneCheckInternal,
} from "../dist/index.js";

test("runtime SceneCheck helpers are omitted with their entire subtree", () => {
  const scene = new Scene();
  scene.name = "World";

  const appObject = new Group();
  appObject.name = "Application Object";
  scene.add(appObject);

  const helperRoot = markThreeSceneCheckInternal(new Group());
  helperRoot.name = "SceneCheck Helpers";
  const helperChild = new Group();
  helperChild.name = "Bounds Helper";
  helperRoot.add(helperChild);
  scene.add(helperRoot);

  assert.equal(isThreeSceneCheckInternal(helperRoot), true);
  assert.equal(scene.children.length, 2);

  const ir = fromThreeScene(scene);
  assert.ok(ir.nodes["World/Application%20Object"]);
  assert.equal(ir.nodes["World/SceneCheck%20Helpers"], undefined);
  assert.equal(ir.nodes["World/SceneCheck%20Helpers/Bounds%20Helper"], undefined);
  assert.deepEqual(ir.nodes.World?.children, ["World/Application%20Object"]);
});
