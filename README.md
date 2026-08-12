# SceneCheck

SceneCheck is a local-first toolkit for inspecting, measuring, annotating, and validating 3D scenes.

It is built around a simple idea: people are fast at spotting visual problems, while software is better at measuring exact geometry. SceneCheck connects both workflows so 3D issues can be found visually, described precisely, and turned into repeatable checks.

## What SceneCheck aims to provide

- A live inspector for 3D scenes
- Precise measurements for transforms, bounds, distances, angles, alignment, clearance, and intersections
- 3D annotations that stay attached to scene objects
- Reusable modules with anchors and sockets instead of fragile hand-written world coordinates
- Declarative scene assertions that can run locally or in CI
- A CLI designed to work well for both developers and coding agents

SceneCheck starts with Three.js, but its core scene representation is intentionally renderer-independent.

## Status

SceneCheck is in early development. The first usable target is Three.js with a local inspector, annotations, semantic assembly, and CPU-side validation.

See [ROADMAP.md](ROADMAP.md) for the implementation plan.

## License

MIT
