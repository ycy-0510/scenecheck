# Semantic assembly example

This example shows how Three.js objects expose reusable SceneCheck semantics without changing rendering behavior.

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

From the repository root:

```bash
pnpm install
pnpm build
pnpm --filter scenecheck-example-semantic-assembly dump
```

The resulting Scene IR contains the module, anchors, and sockets alongside the ordinary scene hierarchy. Anchor-to-socket placement is implemented in the next semantic-assembly step rather than by rewriting child world coordinates.
