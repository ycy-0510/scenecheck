export default {
  provider: "./annotation-scene.ts",
  assertions: [
    {
      id: "annotation-offset",
      type: "distance",
      from: "node:tunnel",
      to: "annotation:target",
      target: 2,
      tolerance: 0.001,
    },
    {
      id: "annotation-orientation",
      type: "angle",
      from: "node:tunnel",
      to: "annotation:target",
      maxDegrees: 0.001,
    },
  ],
};
