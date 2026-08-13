import { Group, Scene } from "three";
import { describeThreeObject } from "@scenecheck/three";

export default function createScene(): Scene {
  const scene = new Scene();
  scene.name = "World";

  const tunnel = new Group();
  describeThreeObject(tunnel, {
    id: "tunnel",
    module: "TunnelSegment",
    sockets: [
      {
        id: "emergency-right",
        position: [4, 1.4, -5],
        rotation: [0, Math.SQRT1_2, 0, Math.SQRT1_2],
        accepts: ["EmergencyExit"],
      },
    ],
  });

  const parent = new Group();
  parent.name = "ScaledParent";
  parent.scale.set(2, 1, 1);
  parent.rotation.y = Math.PI / 4;

  const exit = new Group();
  describeThreeObject(exit, {
    id: "exit",
    module: "EmergencyExit",
    anchors: [{ id: "mount", position: [0, 1.4, 0] }],
  });
  parent.add(exit);

  scene.add(tunnel, parent);
  return scene;
}
