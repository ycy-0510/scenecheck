import { BoxGeometry, Group, Mesh, MeshBasicMaterial } from "three";

export default function createScene(): Group {
  const root = new Group();
  root.name = "Root";

  const box = new Mesh(new BoxGeometry(2, 4, 6), new MeshBasicMaterial());
  box.name = "Box";
  box.position.set(3, 0, 0);
  box.userData.scenecheckId = "box";
  root.add(box);

  return root;
}
