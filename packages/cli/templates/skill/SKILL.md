---
name: scenecheck
description: Use SceneCheck when inspecting, measuring, annotating, assembling, or validating a 3D scene, especially before or after changing Three.js scene geometry, transforms, placement, or spatial relationships. Prefer SceneCheck CLI evidence over temporary debug code or guessing 3D state from screenshots when the CLI can answer the question.
---

# SceneCheck workflow

Use the installed SceneCheck CLI as the source of exact scene-space evidence.

1. Run `scenecheck --help` before using commands you have not seen in the current installed version. Do not assume planned or undocumented subcommands exist.
2. When a scene provider is available, use `scenecheck dump [provider]` to obtain the current Scene IR. The command emits compact JSON by default; use `--pretty` only when human readability is useful.
3. Prefer `--no-bounds` or `--exclude-invisible` when the omitted data is irrelevant and a smaller dump will reduce tool output.
4. Inspect or measure the relevant scene objects before editing source code when placement, transforms, bounds, alignment, clearance, intersections, or annotations are involved.
5. Treat local-space and world-space transforms as different coordinate systems. Preserve module-local transforms unless the task explicitly requires editing the module itself.
6. Prefer module, anchor, and socket relationships over manually recomputing child world coordinates when those semantics are available.
7. Use human-authored 3D annotations as precise intent. Preserve their object attachment and coordinate frame.
8. After modifying scene code, rerun the relevant SceneCheck dump, measurement, or validation. Do not claim a spatial fix is correct from source inspection alone when SceneCheck can verify it.
9. Do not add temporary scene instrumentation, debug meshes, or ad-hoc logging when SceneCheck already exposes the required information.
10. Use visual/browser inspection when appearance itself matters, but do not use screenshots as a substitute for exact geometry checks that SceneCheck can perform.
11. If SceneCheck reports a failed assertion, diagnose the semantic cause in source code rather than blindly forcing the runtime transform to match the expected number.
