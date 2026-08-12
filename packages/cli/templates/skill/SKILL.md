---
name: scenecheck
description: Use SceneCheck when inspecting, measuring, annotating, assembling, or validating a 3D scene, especially before or after changing Three.js scene geometry, transforms, placement, or spatial relationships. Prefer SceneCheck CLI evidence over temporary debug code or guessing 3D state from screenshots when the CLI can answer the question.
---

# SceneCheck workflow

Use the installed SceneCheck CLI as the source of exact scene-space evidence.

1. Run `scenecheck --help` before using commands you have not seen in the current installed version. Do not assume planned or undocumented subcommands exist.
2. Prefer machine-readable output such as `--json` when the command advertises it.
3. Inspect or measure the relevant scene objects before editing source code when placement, transforms, bounds, alignment, clearance, intersections, or annotations are involved.
4. Treat local-space and world-space transforms as different coordinate systems. Preserve module-local transforms unless the task explicitly requires editing the module itself.
5. Prefer module, anchor, and socket relationships over manually recomputing child world coordinates when those semantics are available.
6. Use human-authored 3D annotations as precise intent. Preserve their object attachment and coordinate frame.
7. After modifying scene code, rerun the relevant SceneCheck measurements or validations. Do not claim a spatial fix is correct from source inspection alone when SceneCheck can verify it.
8. Do not add temporary scene instrumentation, debug meshes, or ad-hoc logging when SceneCheck already exposes the required information.
9. Use visual/browser inspection when appearance itself matters, but do not use screenshots as a substitute for exact geometry checks that SceneCheck can perform.
10. If SceneCheck reports a failed assertion, diagnose the semantic cause in source code rather than blindly forcing the runtime transform to match the expected number.
