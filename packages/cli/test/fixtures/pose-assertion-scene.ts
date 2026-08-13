import { Group, Scene } from "three";
import { describeThreeObject } from "@scenecheck/three";

export default function createScene(): Scene {
  const scene = new Scene();
  const door = new Group();
  door.position.set(5, 2, -3);
  door.rotation.y = Math.PI / 2;
  describeThreeObject(door, { id: "door" });
  scene.add(door);
  return scene;
}
