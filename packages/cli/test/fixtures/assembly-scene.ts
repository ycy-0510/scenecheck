import { Group, Scene } from "three";
import { describeThreeObject } from "@scenecheck/three";

export default function createScene(): Scene {
  const scene = new Scene();
  scene.name = "World";

  const tunnel = new Group();
  tunnel.name = "Tunnel";
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

  const exit = new Group();
  exit.name = "EmergencyExit";
  describeThreeObject(exit, {
    id: "exit",
    module: "EmergencyExit",
    anchors: [
      {
        id: "mount",
        position: [0, 1.4, 0],
      },
    ],
  });

  scene.add(tunnel, exit);
  return scene;
}
