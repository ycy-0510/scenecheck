import type { SceneCheckConfig } from "../../src/config.js";

const config: SceneCheckConfig = {
  provider: "./collider-scene.ts",
  assertions: [
    {
      id: "car-touches-gate",
      type: "collider-intersection",
      a: "collider:car#body",
      b: "collider:gate#post",
      expected: true,
    },
    {
      id: "car-does-not-overlap-gate",
      type: "collider-intersection",
      a: "collider:car#body",
      b: "collider:gate#post",
      expected: false,
      strict: true,
    },
    {
      id: "car-away-from-sensor",
      type: "collider-intersection",
      a: "collider:car#body",
      b: "collider:sensor#range",
      expected: false,
    },
  ],
};

export default config;
