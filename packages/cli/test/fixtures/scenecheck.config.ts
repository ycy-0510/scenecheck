export default {
  provider: "./basic-scene.ts",
  assertions: [
    {
      id: "edge-distance",
      type: "distance",
      from: "socket:Root#origin",
      to: "anchor:box#edge",
      target: 4,
      tolerance: 0.001,
    },
    {
      id: "edge-angle",
      type: "angle",
      from: "socket:Root#origin",
      to: "anchor:box#edge",
      targetDegrees: 90,
      toleranceDegrees: 0.001,
    },
  ],
};
