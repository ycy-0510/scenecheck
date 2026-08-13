import { Group, Scene } from "three";
import { describeThreeObject } from "@scenecheck/three";

export default function createScene(): Scene {
  const scene = new Scene();
  scene.name = "World";

  const tunnel = new Group();
  tunnel.name = "Tunnel";
  describeThreeObject(tunnel, {
    id: "tunnel-01",
    module: "TunnelSegment",
    sockets: [
      {
        id: "emergency-right",
        position: [4, 1.4, -5],
        rotation: [0, 0.70710678, 0, 0.70710678],
        accepts: ["EmergencyExit"],
      },
    ],
  });

  const emergencyExit = new Group();
  emergencyExit.name = "EmergencyExit";
  describeThreeObject(emergencyExit, {
    id: "emergency-exit-template",
    module: "EmergencyExit",
    anchors: [
      {
        id: "mount",
        type: "wall-mount",
        position: [0, 1.4, 0],
      },
      {
        id: "floor",
        position: [0, 0, 0],
      },
    ],
  });

  scene.add(tunnel, emergencyExit);
  return scene;
}
