# Basic Three.js example

This example exposes a small deterministic Three.js scene through a SceneCheck scene provider.

From the repository root:

```bash
pnpm install
pnpm build
pnpm --filter scenecheck-example-basic-three dump
```

Or invoke the CLI directly:

```bash
node packages/cli/dist/cli.js dump examples/basic-three/scenecheck.scene.ts --pretty
```

The command prints Scene IR JSON containing the hierarchy, transforms, visibility metadata, and CPU-computed bounds.
