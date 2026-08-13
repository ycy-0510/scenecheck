---
name: scenecheck
description: Use SceneCheck when inspecting, measuring, annotating, assembling, or validating a 3D scene, especially before or after changing Three.js scene geometry, transforms, placement, or spatial relationships. Prefer SceneCheck CLI evidence over temporary debug code or guessing 3D state from screenshots when the CLI can answer the question.
---

# SceneCheck workflow

Use the installed SceneCheck CLI as the source of exact scene-space evidence.

1. Run `scenecheck --help` before using commands you have not seen in the current installed version. Do not assume planned or undocumented subcommands exist.
2. Prefer the smallest command that answers the question. Use `scenecheck summary [provider]` for scene size/type overview, then `scenecheck query [provider]` with `--id`, `--name`, `--type`, `--text`, or `--parent` to retrieve only relevant nodes.
3. Use `scenecheck measure distance` or `scenecheck measure angle` for spatial comparisons instead of manually subtracting coordinates. References may be node IDs, `anchor:<node-id>#<anchor-id>`, or `socket:<node-id>#<socket-id>`.
4. For module placement, use `scenecheck solve attachment` and change only the module root transform. Do not recompute or rewrite child world coordinates when the module exposes anchors/sockets.
5. A solver result with `safeToApplyTRS: false` or exit code 2 is an exact-matrix placement that ordinary TRS cannot represent safely, usually because of parent scaling/shear. Do not blindly apply the returned decomposed TRS; inspect or restructure the transform hierarchy.
6. When a `scenecheck.config.*` file exists, run `scenecheck validate --json` after spatial changes. Treat a non-zero exit code as a failed verification, not as a tool failure to ignore.
7. Use `scenecheck dump [provider]` only when the complete Scene IR is actually needed. It emits compact JSON by default; use `--pretty` only when human readability is useful.
8. Prefer `--no-bounds` or `--exclude-invisible` when the omitted data is irrelevant and a smaller result will reduce tool output.
9. Inspect or measure the relevant scene objects before editing source code when placement, transforms, bounds, alignment, clearance, intersections, or annotations are involved.
10. Treat local-space and world-space transforms as different coordinate systems. Preserve module-local transforms unless the task explicitly requires editing the module itself.
11. Prefer module, anchor, and socket relationships over manually recomputing child world coordinates when those semantics are available.
12. Use human-authored 3D annotations as precise intent. Preserve their object attachment and coordinate frame.
13. After modifying scene code, rerun the relevant SceneCheck query, dump, measurement, solve, or validation. Do not claim a spatial fix is correct from source inspection alone when SceneCheck can verify it.
14. Do not add temporary scene instrumentation, debug meshes, or ad-hoc logging when SceneCheck already exposes the required information.
15. Use visual/browser inspection when appearance itself matters, but do not use screenshots as a substitute for exact geometry checks that SceneCheck can perform.
16. If SceneCheck reports a failed assertion, diagnose the semantic cause in source code rather than blindly forcing the runtime transform to match the expected number.
