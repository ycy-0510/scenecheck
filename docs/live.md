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

Request full Scene IR only when necessary:

```bash
scenecheck live dump
```

Live captures omit bounds by default because bounds can be substantially more expensive than hierarchy/transform capture. Request them explicitly when needed:

```bash
scenecheck live query --id bridge-02 --bounds
scenecheck live dump --bounds
```

## Runtime cost

The browser keeps an idle Server-Sent Events connection to the local bridge. SceneCheck does not traverse the scene on a timer. A fresh Scene IR snapshot is generated only when a CLI command requests one.

This makes live inspection suitable for development without turning the debugger into a continuous frame-time cost.

## Security boundary

The first live protocol intentionally exposes only scene capture:

- server binds to IPv4 loopback only;
- browser runtime connections use an Origin allowlist;
- browser-originated `/capture` requests are rejected;
- request and response bodies are size-limited;
- captures time out instead of remaining pending indefinitely;
- no arbitrary JavaScript evaluation;
- no create/delete/move/material mutation endpoints.

Use provider-based `scenecheck validate` for deterministic CI. Live inspection is for observing the current running world, not replacing reproducible validation.
