# Roadmap

The goal is a tool that is useful in real development, not a demo-only inspector. Each phase should be usable in a real Three.js project before moving to the next one.

## Phase 0 — Foundation

Build the shared data model and repository infrastructure.

- Scene IR: nodes, transforms, bounds, metadata
- Stable object identifiers
- Adapter interface
- Annotation types: point, arrow, pose
- Semantic types: module, anchor, socket
- Measurement and assertion interfaces
- CLI foundation
- `scenecheck init` installs the repo-local agent skill

Exit criteria: the monorepo builds, the CLI runs, and `scenecheck init` can install the SceneCheck skill into another repository.

## Phase 1 — Three.js inspection

Make SceneCheck useful for day-to-day debugging.

- Three.js Scene IR adapter
- Scene tree
- Click-to-select
- Local and world transforms
- Bounds
- Hide, isolate, ghost, wireframe, axes
- Extensible collision-shape visualization

Exit criteria: a developer can inspect a non-trivial Three.js scene without adding temporary debug code.

## Phase 2 — Measurement and annotation

Connect human visual debugging to exact scene-space data.

- Point, arrow, and pose annotations
- Object-attached annotations
- Distance and angle measurement
- Raycasts
- Alignment and clearance checks
- Intersection checks
- Structured CLI output for agent use

Exit criteria: a developer can point at a 3D problem and a coding agent can read its exact object, position, direction, and measurements through the CLI.

## Phase 3 — Semantic assembly

Reduce coordinate mistakes when composing 3D objects.

- Modules / reusable assemblies
- Anchors and sockets
- Deterministic anchor-to-socket attachment
- Root-transform placement instead of rewriting child world transforms
- Basic placement constraints and diagnostics

Exit criteria: a reusable assembly such as a tunnel emergency exit can be instantiated in multiple locations without recomputing its internal object positions.

## Phase 4 — Assertions and CI

Turn fixed 3D bugs into regression tests.

- Declarative assertion format
- CPU-side validation
- Distance, angle, bounds, alignment, clearance, and intersection assertions
- Deterministic scene providers / fixed seeds
- Human-readable and JSON output
- Non-zero exit codes on failure
- GitHub Actions example
- Convert supported annotations into assertions

Exit criteria: intentionally breaking a checked scene relationship reliably fails CI without requiring a GPU.

## Phase 5 — Agent workflow

Make CLI-first agent use efficient and predictable.

- Stable machine-readable command output
- Agent-oriented diagnostics with object IDs and semantic references
- Skill versioning and `scenecheck init --update`
- Commands that expose selection, annotations, measurements, and validation without requiring browser automation
- Documentation for Codex and other skill-capable coding agents

Exit criteria: a coding agent can inspect and verify a 3D change primarily through CLI calls instead of adding temporary instrumentation or repeatedly interpreting screenshots.

## Later

Not part of the MVP:

- Physics adapters such as Rapier and Cannon
- GPU profiling and shader debugging
- Babylon.js, Unity, Godot, Blender, or USD adapters
- 2D / orthographic reference reconstruction
- Remote services
- MCP adapter, if CLI + skills prove insufficient for a specific capability boundary
