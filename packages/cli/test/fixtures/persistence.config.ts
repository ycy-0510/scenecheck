export default {
  provider: "./persistence-scene.ts",
  annotations: "./scenecheck.annotations.json",
  assertions: [
    {
      id: "persisted-target-distance",
      type: "distance",
      from: "node:tunnel",
      to: "annotation:target",
      target: 2,
      tolerance: 0.0001,
    },
  ],
};
