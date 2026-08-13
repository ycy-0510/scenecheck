# Live browser inspection

SceneCheck can inspect the Three.js scene that is currently running in a browser without polling it continuously.

The local bridge is read-only. The Node server binds only to `127.0.0.1`; browser runtime endpoints require an allowed Origin; the protocol does not expose JavaScript evaluation or scene mutation.

## Start the bridge

```bash
scenecheck live serve
```

The default endpoint is `http://127.0.0.1:37431`.

Localhost browser origins are accepted automatically. To connect a different development origin explicitly:

```bash
scenecheck live serve --allow-origin https://dev.example.test
```

## Connect the running Three.js app

Use the same DevTools controller that powers the embedded inspector:

```ts
import {
  attachThreeDevtools,
  attachThreeLiveBridge,
} from "@scenecheck/devtools";

const devtools = attachThreeDevtools({
  scene,
  camera,
  domElement: renderer.domElement,
});

const live = attachThreeLiveBridge({
  controller: devtools.controller,
  renderer, // optional; required only for live performance sampling
});
```

Keep this development-only. Destroy the live client when the development tooling is torn down:

```ts
live.destroy();
devtools.destroy();
```

## Inspect from the CLI

Check that a browser runtime is connected:

```bash
scenecheck live status
```

Prefer compact commands for agent workflows:

```bash
scenecheck live summary
scenecheck live query --name Tunnel_04
scenecheck live query --type Mesh --limit 10
scenecheck live annotations
scenecheck live annotations --id target-pose
```

Measure the current running world directly instead of dumping Scene IR and recomputing values in the agent:

```bash
scenecheck live measure distance --from road-17 --to annotation:target
scenecheck live measure angle --from anchor:road-17#end --to socket:tunnel#entrance
scenecheck live measure aabb --from bridge-02 --to terrain-chunk-12
scenecheck live measure bounds --node emergency-exit-03
```

Distance and angle captures skip bounds. AABB and bounds measurements request them because those operations require them.

Request full Scene IR only when necessary:

```bash
scenecheck live dump
```

Live captures omit bounds by default because bounds can be substantially more expensive than hierarchy/transform capture. Request them explicitly when needed:

```bash
scenecheck live query --id bridge-02 --bounds
scenecheck live dump --bounds
```

## Performance snapshot

When the live bridge is given a Three.js `renderer`, SceneCheck can collect a bounded performance sample on demand:

```bash
scenecheck live performance
scenecheck live performance --frames 120 --pretty
```

The default window is 60 `requestAnimationFrame` intervals and the maximum is 600. No performance sampler runs while no request is active.

The result deliberately separates browser cadence from renderer counters:

```json
{
  "kind": "runtime-performance",
  "frameCadence": {
    "source": "requestAnimationFrame",
    "samples": 60,
    "averageMs": 16.7,
    "p95Ms": 18.2,
    "maxMs": 31.4,
    "rafFps": 59.9
  },
  "renderer": {
    "adapter": "three-webglrenderer",
    "infoAutoReset": true,
    "calls": 87,
    "triangles": 180240,
    "geometries": 52,
    "textures": 21
  },
  "gpuTimeMeasured": false
}
```

`requestAnimationFrame` cadence measures browser/main-thread scheduling cadence. It is **not GPU execution time** and `rafFps` is not a guarantee that the Three.js renderer itself produced that many complete frames. `renderer.info` counters are a snapshot at the end of the sample; when `infoAutoReset` is true they should not be interpreted as a 60-frame aggregate or average.

Hidden tabs are rejected because browsers throttle `requestAnimationFrame`, which would make the result misleading. GPU timer queries are intentionally outside this first performance layer.

## Runtime cost

The browser keeps an idle Server-Sent Events connection to the local bridge. SceneCheck does not traverse the scene or sample frame cadence on a timer. A fresh Scene IR snapshot or performance sample is generated only when a CLI command requests one.

This makes live inspection suitable for development without turning the debugger into a continuous frame-time cost.

## Security boundary

The live protocol exposes read-only scene capture and bounded performance sampling:

- server binds to IPv4 loopback only;
- browser runtime connections use an Origin allowlist;
- browser-originated agent request endpoints are rejected;
- request and response bodies are size-limited;
- captures and performance samples time out instead of remaining pending indefinitely;
- no arbitrary JavaScript evaluation;
- no create/delete/move/material mutation endpoints.

Use provider-based `scenecheck validate` for deterministic CI. Live inspection is for observing the current running world, not replacing reproducible validation.
