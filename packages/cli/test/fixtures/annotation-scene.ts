import { Group, Scene } from "three";
import {
  describeThreeObject,
  setThreeSceneAnnotations,
} from "@scenecheck/three";

export default function createScene(): Scene {
  const scene = new Scene();
  scene.name = "World";

  const tunnel = new Group();
  tunnel.position.set(10, 0, 0);
  tunnel.rotation.y = Math.PI / 2;
  describeThreeObject(tunnel, { id: "tunnel" });
  scene.add(tunnel);

  setThreeSceneAnnotations(scene, [
    {
      id: "target",
      type: "pose",
      attachedTo: "tunnel",
      localTransform: {
        position: [0, 0, -2],
        rotation: [0, 0, 0, 1],
        scale: [1, 1, 1],
      },
      worldTransform: {
        position: [999, 999, 999],
        rotation: [0, 0, 0, 1],
        scale: [1, 1, 1],
      },
      label: "Target tunnel pose",
      note: "Created by a human in 3D space",
    },
  ]);

  return scene;
}
