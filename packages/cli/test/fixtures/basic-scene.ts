import { BoxGeometry, Group, Mesh, MeshBasicMaterial } from "three";
import { describeThreeObject } from "@scenecheck/three";

export default function createScene(): Group {
  const root = new Group();
  root.name = "Root";
  describeThreeObject(root, {
    sockets: [{ id: "origin" }],
  });

  const box = new Mesh(new BoxGeometry(2, 4, 6), new MeshBasicMaterial());
  box.name = "Box";
  box.position.set(3, 0, 0);
  describeThreeObject(box, {
    id: "box",
    anchors: [
      {
        id: "edge",
        position: [1, 0, 0],
        rotation: [0, Math.SQRT1_2, 0, Math.SQRT1_2],
      },
    ],
  });
  root.add(box);

  return root;
}
