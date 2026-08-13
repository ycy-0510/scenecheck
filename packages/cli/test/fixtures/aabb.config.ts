export default {
  provider: "./aabb-scene.ts",
  assertions: [
    {
      id: "box-clearance",
      type: "aabb-clearance",
      from: "box-a",
      to: "box-b",
      target: 3,
      tolerance: 0.001,
    },
    {
      id: "boxes-separated",
      type: "aabb-intersection",
      a: "box-a",
      b: "box-b",
      expected: false,
    },
  ],
};
