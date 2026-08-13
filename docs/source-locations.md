# Runtime source locations

SceneCheck can associate a runtime `SceneNode` with the application source call site that registered it. This is debugger metadata only: it does not change object transforms, rendering, or application logic.

A mapped node contains a first-class `source` field in Scene IR:

```json
{
  "id": "tunnel-04",
  "type": "Group",
  "source": {
    "file": "src/world/tunnel.ts",
    "line": 183,
    "column": 5,
    "symbol": "buildTunnel"
  }
}
```

`line` and `column` are 1-based. File paths are normalized to project-relative forward-slash paths when the Vite integration creates them.

## Inspect source from DevTools

Select a mapped object in the scene tree or with **Viewport → Pick**. The embedded DevTools panel shows a **Source** block above the annotation controls:

```text
Source
src/world/tunnel.ts:183:5
buildTunnel
```

The file reference and symbol are selectable text. Selection changes use the existing panel render lifecycle, so the source block always follows the currently selected SceneCheck node and disappears when the selected node has no mapped source.

## Inspect source from an agent

Full Scene IR already contains `node.source`. When an agent needs the source for one precise node, prefer a targeted full query rather than dumping the whole scene:

```bash
scenecheck query ./scenecheck.scene.ts --id tunnel-04 --full
scenecheck live query --id tunnel-04 --full
```

Read the returned node's `source.file`, optional `source.line` / `source.column`, and optional `source.symbol`. Compact query output intentionally remains smaller; request `--full` only when the full node metadata, including source mapping, is useful.

Do not infer a source file for a node that has no `source` field.

## Automatic Vite development mapping

Install the development integration and add it to the Vite config:

```ts
import { defineConfig } from "vite";
import { sceneCheckSourceLocations } from "@scenecheck/vite";

export default defineConfig({
  plugins: [sceneCheckSourceLocations()],
});
```

The plugin is explicitly `apply: "serve"`, so automatic call-site metadata is injected only by the Vite development server, not into production builds.

Application code stays unchanged:

```ts
import { describeThreeObject } from "@scenecheck/three";

describeThreeObject(tunnel, {
  id: "tunnel-04",
  module: "road-tunnel",
});
```

During Vite development the descriptor receives source metadata for the `describeThreeObject(...)` call site before the module is executed. SceneCheck then carries that metadata through the Three.js adapter into Scene IR.

### Instrumented forms

The initial integration supports direct calls using:

```ts
import { describeThreeObject } from "@scenecheck/three";
import { describeThreeObject as describe } from "@scenecheck/three";
import * as SceneCheck from "@scenecheck/three";
```

and object-literal descriptors:

```ts
describeThreeObject(object, { id: "object" });
SceneCheck.describeThreeObject(object, { id: "object" });
```

It intentionally does not guess through indirect descriptors or arbitrary wrappers:

```ts
const descriptor = { id: "object" };
describeThreeObject(object, descriptor); // not auto-instrumented
```

This keeps the transform deterministic and avoids pretending a wrapper location is the application's semantic registration location.

### Files that are skipped

Automatic instrumentation skips:

- files outside the resolved Vite project root;
- `node_modules`;
- unsupported source extensions;
- modules that do not even mention both `@scenecheck/three` and `describeThreeObject`;
- same-named functions imported from another package;
- descriptors that already contain an explicit `source` field.

The cheap text gate runs before AST parsing for unrelated modules. The AST import/call checks remain the authoritative semantic filter for candidate modules.

## Manual source metadata

Non-Vite applications, wrappers, factories, or generated integrations can provide the same contract manually:

```ts
describeThreeObject(tunnel, {
  id: "tunnel-04",
  source: {
    file: "src/world/tunnel.ts",
    line: 183,
    column: 5,
    symbol: "buildTunnel",
  },
});
```

Manual source metadata is normalized and preserved. The Vite plugin never overwrites an explicit `source` property.

## Exact meaning of the location

The automatic location points to the `describeThreeObject(...)` registration call. It does not claim to be the line containing `new Mesh(...)`, asset creation, or the original model source. The optional `symbol` is the nearest identifiable variable/function/method context and is best-effort debugger context.

This is deliberate: the registration call is the point where the runtime object acquires its stable SceneCheck identity and semantics, so it is a reliable place for a human or coding agent to begin source inspection.
