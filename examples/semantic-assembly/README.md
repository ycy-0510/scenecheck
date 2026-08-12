# Semantic assembly example

This example shows how Three.js objects expose reusable SceneCheck semantics without changing rendering behavior, then lock the intended relationship into CPU-side validation.

`TunnelSegment` exposes a socket named `emergency-right` that accepts an `EmergencyExit` module. The emergency-exit template exposes local-space `mount` and `floor` anchors.

```ts
import { describeThreeObject } from "@scenecheck/three";

describeThreeObject(emergencyExit, {
  id: "emergency-exit-template",
  module: "EmergencyExit",
  anchors: [
    { id: "mount", position: [0, 1.4, 0] },
    { id: "floor", position: [0, 0, 0] },
  ],
});
```

`scenecheck.config.ts` then asserts that the mount and socket occupy the same position and orientation:

```ts
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
  ],
};
```

From the repository root:

```bash
pnpm install
pnpm build
pnpm --filter scenecheck-example-semantic-assembly dump
pnpm --filter scenecheck-example-semantic-assembly validate
```

Move or rotate the emergency-exit group away from its intended mount and the validation command exits non-zero. No renderer or GPU is required.
