# @scenecheck/devtools

A small embedded inspector for a running Three.js scene.

```ts
import { attachThreeDevtools } from "@scenecheck/devtools";

const devtools = attachThreeDevtools({ scene });
```

The panel provides a live scene tree and exact local/world transforms. Select an object to temporarily hide or isolate it, or visualize its world AABB and local axes.

All inspector state is runtime-only. SceneCheck helper objects are excluded from Scene IR, and `devtools.destroy()` restores visibility changed by the inspector and removes its helpers.

For development-only integration with Vite or similar bundlers, load it conditionally so the inspector is not shipped in the production bundle:

```ts
if (import.meta.env.DEV) {
  const { attachThreeDevtools } = await import("@scenecheck/devtools");
  attachThreeDevtools({ scene });
}
```

The inspector intentionally does not edit application source or child transforms. Semantic modules, measurements, assertions, and annotations use the same Scene IR as the CLI.
