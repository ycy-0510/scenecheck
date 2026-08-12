import { BoxGeometry, Mesh, MeshBasicMaterial, Scene } from "three";
import { describeThreeObject } from "@scenecheck/three";

export default function createScene(): Scene {
  const scene = new Scene();
  scene.name = "World";

  const a = new Mesh(new BoxGeometry(2, 2, 2), new MeshBasicMaterial());
  a.position.set(0, 0, 0);
  describeThreeObject(a, { id: "box-a" });

  const b = new Mesh(new BoxGeometry(2, 2, 2), new MeshBasicMaterial());
  b.position.set(5, 1, 0);
  describeThreeObject(b, { id: "box-b" });

  scene.add(a, b);
  return scene;
}
