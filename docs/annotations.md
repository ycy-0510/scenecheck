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

Agents can then read the exact marker directly:

```bash
scenecheck live annotations
scenecheck live annotations --id pose-1
scenecheck live measure distance --from annotation:pose-1 --to tunnel-exit
```

## Update human metadata

Annotation IDs and spatial transforms are stable machine references. Human-readable `label` and `note` can be edited without changing that spatial identity:

```ts
import { updateThreeAnnotation } from "@scenecheck/devtools";

updateThreeAnnotation(devtools.controller, "pose-1", {
  label: "Emergency exit target",
  note: "Door should face the tunnel centerline",
});
```

Passing `null` or an empty/whitespace-only string removes the corresponding label or note.

## Delete an annotation

```ts
import { removeThreeAnnotation } from "@scenecheck/devtools";

removeThreeAnnotation(devtools.controller, "point-3");
devtools.viewport?.refreshMarkers();
```

Deletion updates the runtime annotation metadata and Scene IR. If the visual viewport marker layer is active, refresh it after a programmatic change.

## Persist annotations

The embedded viewport can export the versioned document `scenecheck.annotations.json`. The same file can later be imported into DevTools or loaded by `scenecheck.config.*`:

```ts
export default {
  provider: "./scenecheck.scene.ts",
  annotations: "./scenecheck.annotations.json",
  assertions: [
    // references may use annotation:<id>
  ],
};
```

Annotations are intent, not automatically assertions. If a marker follows the same object being tested, a distance-to-self constraint would be meaningless; choose a stable reference or explicit expected pose when turning human intent into regression protection.
