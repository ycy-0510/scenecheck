# Registered colliders

SceneCheck keeps explicit collision geometry separate from visual bounds.

- `node.bounds` is a world-axis-aligned broad-phase bound derived from rendered geometry.
- `node.semantics.colliders` is collision geometry explicitly registered by the application.

Do not treat an AABB result as proof that registered colliders intersect.

## Register colliders in Three.js

```ts
import { describeThreeObject } from "@scenecheck/three";

describeThreeObject(car, {
  id: "car",
  colliders: [
    {
      id: "body",
      type: "box",
      size: [1.9, 1.4, 4.4],
      position: [0, 0.7, 0],
    },
    {
      id: "sensor",
      type: "sphere",
      radius: 0.5,
      position: [0, 0.7, -2.4],
    },
  ],
});
```

Collider transforms are local to the owning SceneCheck node. Box `size` is the full local X/Y/Z size; sphere `radius` is local.

## Visualize registered colliders

`attachThreeDevtools()` returns a runtime-only collider overlay handle:

```ts
const devtools = attachThreeDevtools({
  scene,
  camera,
  domElement: renderer.domElement,
});

devtools.colliders.setEnabled(true);
```

The built-in Inspector uses the same overlay. When a selected node declares colliders, it lists each collider ID and type and exposes a `Colliders` toggle alongside Ghost, Wireframe, Bounds, and Axes.

The toggle is sticky across selection changes. With it enabled, selecting another node refreshes the helper geometry for that node; selecting a node with no registered colliders shows no collider helpers while keeping the mode enabled.

Helpers are SceneCheck-internal, do not enter Scene IR, and are disposed during DevTools teardown.

## Measure exact relations

Provider/offline scene:

```bash
scenecheck measure collider ./scenecheck.scene.ts \
  --from collider:car#body \
  --to collider:tunnel#wall
```

Current running browser scene:

```bash
scenecheck live measure collider \
  --from collider:car#body \
  --to collider:tunnel#wall
```

Successful exact output includes:

```json
{
  "status": "exact",
  "pair": "box-box",
  "intersects": false,
  "strictlyOverlaps": false,
  "touching": false
}
```

Exact collider measurements are CPU-side and do not require visual bounds or a GPU.

### Supported exact geometry

- box ↔ box: oriented separating-axis test;
- sphere ↔ sphere: center/radius test;
- sphere ↔ box: closest point on oriented box.

Boxes support rotation and non-uniform scale as long as the composed transform remains orthogonal. Spheres require uniform scale so they remain spheres.

If a composed transform contains shear, a degenerate axis, or turns a sphere into an ellipsoid, SceneCheck returns:

```json
{
  "status": "unsupported",
  "reason": "..."
}
```

This is intentional. SceneCheck does not silently approximate an exact collider query with an AABB.

## CI assertions

Use `collider-intersection` in `scenecheck.config.ts`:

```ts
export default {
  provider: "./scenecheck.scene.ts",
  assertions: [
    {
      id: "car-must-not-hit-tunnel-wall",
      type: "collider-intersection",
      a: "collider:car#body",
      b: "collider:tunnel#wall",
      expected: false,
    },
  ],
};
```

Boundary contact counts as an intersection by default. Set `strict: true` when contact is acceptable and only positive interior overlap should count:

```ts
{
  id: "touching-is-allowed",
  type: "collider-intersection",
  a: "collider:module-a#body",
  b: "collider:module-b#body",
  expected: false,
  strict: true,
}
```

An unsupported exact collider relation fails a `collider-intersection` assertion with `actual: "unsupported"` and the reason. CI therefore cannot pass by silently weakening an exact collision requirement.
