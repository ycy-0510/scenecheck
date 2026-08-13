---
name: scenecheck
description: Use SceneCheck when inspecting, measuring, annotating, assembling, validating, or profiling a 3D scene, especially before or after changing Three.js scene geometry, transforms, placement, spatial relationships, or rendering cost. Prefer SceneCheck CLI evidence over temporary debug code or guessing 3D state from screenshots when the CLI can answer the question.
---

# SceneCheck workflow

Use the installed SceneCheck CLI as the source of exact scene-space and runtime evidence.

1. Run `scenecheck --help` before using commands you have not seen in the current installed version. Do not assume planned or undocumented subcommands exist.
2. If the application is running with the SceneCheck live bridge, check `scenecheck live status` first. When `runtimeConnected` is true, prefer `scenecheck live summary`, `scenecheck live query`, `scenecheck live annotations`, `scenecheck live measure`, and `scenecheck live performance` for current runtime evidence. These commands work on demand; do not request `live dump` unless the complete scene is necessary.
3. For deterministic/offline work, or when no live runtime is connected, prefer the smallest provider command that answers the question. Use `scenecheck summary [provider]` for scene size/type overview, then `scenecheck query [provider]` with `--id`, `--name`, `--type`, `--text`, or `--parent` to retrieve only relevant nodes.
4. Use `scenecheck annotations [provider]` / `scenecheck live annotations` or the corresponding `--id <id>` form to read human-authored 3D markers directly. Do not infer a marker's 3D location or orientation from a screenshot when an annotation exists. An attached annotation's local transform is authoritative and follows its attached object; use its resolved world transform for current scene-space evidence.
5. Use `annotation:<id>` anywhere point/pose references are accepted. For a connected runtime use `scenecheck live measure distance|angle`; otherwise use `scenecheck measure distance|angle`. References may also be node IDs, `anchor:<node-id>#<anchor-id>`, or `socket:<node-id>#<socket-id>`.
6. Use `scenecheck live measure aabb|bounds` for the current running world or `scenecheck measure aabb|bounds` for provider scenes. AABB evidence is cheap broad-phase evidence, not proof of exact mesh collision or exact surface clearance. Live distance/angle captures skip bounds; live AABB/bounds requests compute them only when required.
7. For runtime performance questions, use `scenecheck live performance` rather than adding temporary FPS counters. Treat `frameCadence` as browser `requestAnimationFrame` scheduling evidence, not GPU execution time. `rafFps` is not guaranteed renderer FPS. Read `renderer.calls`, `triangles`, `geometries`, `textures`, and related counters as a snapshot; when `renderer.infoAutoReset` is true, do not interpret them as an aggregate or average across the entire sample window. `gpuTimeMeasured: false` means no GPU timing was performed.
8. For module placement, use `scenecheck solve attachment` and change only the module root transform. Do not recompute or rewrite child world coordinates when the module exposes anchors/sockets.
9. A solver result with `safeToApplyTRS: false` or exit code 2 is an exact-matrix placement that ordinary TRS cannot represent safely, usually because of parent scaling/shear. Do not blindly apply the returned decomposed TRS; inspect or restructure the transform hierarchy.
10. When a `scenecheck.config.*` file exists, run `scenecheck validate --json` after spatial changes. Persisted human annotations may be loaded through `annotations: "./scenecheck.annotations.json"`. `aabb-clearance` and `aabb-intersection` assertions are broad-phase checks only. Treat a non-zero exit code as a failed verification, not as a tool failure to ignore.
11. Use `scenecheck dump [provider]` or `scenecheck live dump` only when the complete Scene IR is actually needed. Both emit compact JSON by default; use `--pretty` only when human readability is useful. Live commands do not compute bounds unless explicitly requested or required by an AABB/bounds measurement.
12. Prefer `--no-bounds`, omit live `--bounds`, or use `--exclude-invisible` when the omitted data is irrelevant and a smaller result will reduce tool output and runtime work.
13. Inspect or measure the relevant scene objects before editing source code when placement, transforms, bounds, alignment, clearance, intersections, annotations, or performance are involved.
14. Treat local-space and world-space transforms as different coordinate systems. Preserve module-local transforms unless the task explicitly requires editing the module itself.
15. Prefer module, anchor, and socket relationships over manually recomputing child world coordinates when those semantics are available.
16. After modifying scene code, rerun the relevant SceneCheck annotation, query, dump, measurement, solve, live inspection, performance sample, or validation. Do not claim a spatial or performance fix is correct from source inspection alone when SceneCheck can verify it.
17. Do not add temporary scene instrumentation, debug meshes, FPS counters, or ad-hoc logging when SceneCheck already exposes the required information.
18. Use visual/browser inspection when appearance itself matters, but do not use screenshots as a substitute for exact geometry checks that SceneCheck can perform.
19. If SceneCheck reports a failed assertion, diagnose the semantic cause in source code rather than blindly forcing the runtime transform to match the expected number.
