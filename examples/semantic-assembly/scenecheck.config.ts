export default {
  provider: "./scenecheck.scene.ts",
  assertions: [
    {
      id: "emergency-exit-mounted",
      type: "distance",
      from: "socket:tunnel-01#emergency-right",
      to: "anchor:emergency-exit-template#mount",
      max: 0.001,
    },
    {
      id: "emergency-exit-facing",
      type: "angle",
      from: "socket:tunnel-01#emergency-right",
      to: "anchor:emergency-exit-template#mount",
      maxDegrees: 0.01,
    },
  ],
};
