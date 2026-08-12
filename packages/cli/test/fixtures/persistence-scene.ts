import { Group, Scene } from "three";
import { describeThreeObject } from "@scenecheck/three";

export default function createScene(): Scene {
  const scene = new Scene();
  scene.name = "World";

  const tunnel = new Group();
  tunnel.position.set(5, 0, 0);
  describeThreeObject(tunnel, { id: "tunnel" });
  scene.add(tunnel);

  return scene;
}
