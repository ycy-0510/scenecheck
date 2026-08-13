# 3D annotations

SceneCheck annotations are human-authored 3D references shared by DevTools, agents, and validation.

Supported annotation types are `point`, `arrow`, and `pose`. Viewport-created annotations store a world transform and, when attached to a SceneCheck object, an object-local transform so the marker follows that object instead of becoming a stale screenshot coordinate.

## Create annotations visually

Attach DevTools with a camera and renderer DOM element:

```ts
const devtools = attachThreeDevtools({
  scene,
  camera,
  domElement: renderer.domElement,
});
```

Use **Point** or **Pose** in the viewport toolbar and click the rendered surface.

The embedded DevTools panel includes an **Annotations** section. Each entry shows the stable `annotation:<id>` reference, annotation type, and attachment. You can edit its label/note or delete it directly. Saving metadata never changes the annotation ID or spatial transform; deleting it also refreshes the viewport marker layer.

Agents can then read the exact marker directly:

```bash
scenecheck live annotations
scenecheck live annotations --id pose-1
scenecheck live measure distance --from annotation:pose-1 --to tunnel-exit
```

## Freeze reviewed intent into a regression assertion

Annotations are useful while debugging, but a permanent CI rule must not keep following a mutable marker. SceneCheck can freeze the marker's currently resolved world pose into literal expected values:

```bash
scenecheck live assertion from-annotation \
  --annotation pose-1 \
  --target socket:tunnel#exit \
  --position-tolerance 0.05 \
  --rotation-tolerance-degrees 2 \
  --pretty
```

Provider/offline form:

```bash
scenecheck assertion from-annotation ./scenecheck.scene.ts \
  --annotation pose-1 \
  --target socket:tunnel#exit \
  --position-tolerance 0.05 \
  --rotation-tolerance-degrees 2
```

The command prints a reviewable assertion object and does not modify source/config automatically:

```json
{
  "id": "pose-1-frozen-pose",
  "type": "pose",
  "target": "socket:tunnel#exit",
  "position": [12.4, 1.8, -6.2],
  "positionTolerance": 0.05,
  "rotation": [0, 0.70710678, 0, 0.70710678],
  "rotationToleranceDegrees": 2
}
```

Add the reviewed object to `scenecheck.config.*`. From then on CI compares the target to those literal world values. The original annotation can move or be deleted and the assertion does not change.

A frozen `pose` assertion accepts only a node, anchor, or socket target; `annotation:<id>` targets are rejected. This prevents a moving annotation from becoming both the expected value and the measured value. Position tolerance is always explicit. Rotation is optional; point annotations cannot be converted into orientation constraints.

## Update human metadata programmatically

Annotation IDs and spatial transforms are stable machine references. Human-readable `label` and `note` can also be edited through the public API without changing that spatial identity:

```ts
import { updateThreeAnnotation } from "@scenecheck/devtools";

updateThreeAnnotation(devtools.controller, "pose-1", {
  label: "Emergency exit target",
  note: "Door should face the tunnel centerline",
});
```

Passing `null` or an empty/whitespace-only string removes the corresponding label or note.

## Delete an annotation programmatically

```ts
import { removeThreeAnnotation } from "@scenecheck/devtools";

removeThreeAnnotation(devtools.controller, "point-3");
devtools.viewport?.refreshMarkers();
```

Deletion updates the runtime annotation metadata and Scene IR. Programmatic callers refresh the marker layer explicitly when a viewport is active; the built-in panel does this automatically.

## Persist annotations

The embedded viewport can export the versioned document `scenecheck.annotations.json`. The same file can later be imported into DevTools or loaded by `scenecheck.config.*`:

```ts
export default {
  provider: "./scenecheck.scene.ts",
  annotations: "./scenecheck.annotations.json",
  assertions: [
    // temporary measurements may reference annotation:<id>;
    // permanent pose assertions should freeze literal expected values.
  ],
};
```

Annotations are intent, not automatically assertions. Freeze only the spatial intent that should remain invariant; choose the target and tolerances explicitly so the resulting CI rule states what must stay true.
