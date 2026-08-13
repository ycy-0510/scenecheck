import type { SceneCheckConfig } from "../../src/config.js";

const q = Math.SQRT1_2;

const config: SceneCheckConfig = {
  provider: "./pose-assertion-scene.ts",
  assertions: [
    {
      id: "door-frozen-pose",
      type: "pose",
      target: "door",
      position: [5, 2, -3],
      positionTolerance: 0.001,
      rotation: [0, q, 0, q],
      rotationToleranceDegrees: 0.001,
    },
  ],
};

export default config;
