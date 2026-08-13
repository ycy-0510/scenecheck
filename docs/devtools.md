# Embedded Three.js DevTools

SceneCheck includes a lightweight inspector that can run inside an existing Three.js page during development.

It is intentionally framework-free. The inspector reads the same Scene IR that the CLI, measurements, annotations, and validation layers use.

## Attach it

Keep DevTools development-only so it does not ship in a production bundle accidentally:

```ts
if (import.meta.env.DEV) {
  const { attachThreeDevtools } = await import("@scenecheck/devtools");

  const devtools = attachThreeDevtools({
    scene,
    camera,
    domElement: renderer.domElement,
  });
}
```

Passing `camera` and `domElement` is optional. Without them, the scene tree and inspector still work; viewport Pick/Point/Pose modes are simply omitted.

The controller can also be used without the DOM panel:

```ts
import { ThreeDevtoolsController } from "@scenecheck/devtools";

const controller = new ThreeDevtoolsController({ scene });
controller.select("Tunnel_04");
controller.setShowBounds(true);
```

## Human inspection tools

For the selected object the panel can temporarily:

- Hide / Show
- Isolate / Clear isolate
- Ghost
- Wireframe
- show world AABB
- show local axes
- show explicitly registered collision shapes

These are runtime-only debug states. SceneCheck does not rewrite application source or child transforms to produce the view, and teardown restores the application state it temporarily changed.

Ghost and Wireframe clone selected-subtree materials instead of mutating shared material instances. If the application replaces a material while an overlay is active, SceneCheck does not overwrite that application change during teardown.

## Registered collision shapes

A visual bounding box is not necessarily a hitbox. SceneCheck therefore keeps explicit collision semantics separate from captured AABB bounds.

Register application/physics collision shapes on the owning object:

```ts
import { describeThreeObject } from "@scenecheck/three";

describeThreeObject(car, {
  id: "player-car",
  colliders: [
    {
      id: "body",
      type: "box",
      position: [0, 0.6, 0],
      size: [2, 1.2, 4.5],
    },
    {
      id: "front-probe",
      type: "sphere",
      position: [0, 0.5, -2.4],
      radius: 0.35,
    },
  ],
});
```

Collider transforms are local to the owning SceneCheck node. Box `size` is the full local X/Y/Z size; sphere `radius` must be positive. The first collider layer supports box and sphere shapes only.

The inspector's **Colliders** toggle renders oriented runtime helpers using the owning object's current world transform plus each collider's local pose. The helpers themselves are SceneCheck-internal and never enter Scene IR.

Agents see the exact same data through ordinary compact queries:

```bash
scenecheck query scenecheck.scene.ts --id player-car
scenecheck live query --id player-car
```

Look at `semantics.colliders`. Do not infer collision geometry from `bounds` when registered colliders exist. AABB commands remain broad-phase spatial evidence only.

## Viewport interaction

With `camera` and `domElement`, the panel exposes explicit modes:

- **Off** — SceneCheck does not intercept viewport pointer input.
- **Pick** — click rendered geometry to select its SceneCheck node.
- **Point** — click a surface to create a point annotation.
- **Pose** — click a surface to create a pose whose forward direction follows the transformed surface normal.

Point/Pose annotations store exact scene-space data and, when attached to an object, preserve an object-local transform so they follow that object later.

## Annotation persistence

Annotations can be exported from the panel as `scenecheck.annotations.json` and imported again later. The same versioned document can be referenced from `scenecheck.config.*` for CI validation:

```ts
export default {
  provider: "./scenecheck.scene.ts",
  annotations: "./scenecheck.annotations.json",
  assertions: [
    // ...
  ],
};
```

This lets a human identify a 3D location once and reuse that exact intent in agent measurements and regression checks.

## Cleanup

Keep the returned handle and destroy the tools when the development UI is no longer needed:

```ts
devtools.destroy();
```

Destroying removes SceneCheck helpers, viewport listeners, annotation/collider markers, and temporary visual overrides.
