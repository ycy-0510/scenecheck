---
name: scenecheck
description: Use SceneCheck when inspecting, measuring, annotating, assembling, or validating a 3D scene, especially before or after changing Three.js scene geometry, transforms, placement, or spatial relationships. Prefer SceneCheck CLI evidence over temporary debug code or guessing 3D state from screenshots when the CLI can answer the question.
---

# SceneCheck workflow

Use the installed SceneCheck CLI as the source of exact scene-space evidence.

1. Run `scenecheck --help` before using commands you have not seen in the current installed version. Do not assume planned or undocumented subcommands exist.
2. Prefer the smallest command that answers the question. Use `scenecheck summary [provider]` for scene size/type overview, then `scenecheck query [provider]` with `--id`, `--name`, `--type`, `--text`, or `--parent` to retrieve only relevant nodes.
3. Use `scenecheck annotations [provider]` or `scenecheck annotations [provider] --id <id>` to read human-authored 3D markers directly. Do not infer a marker's 3D location or orientation from a screenshot when an annotation exists. An attached annotation's local transform is authoritative and follows its attached object; use its resolved world transform for current scene-space evidence.
4. Use `annotation:<id>` anywhere point/pose references are accepted, including `scenecheck measure distance`, `scenecheck measure angle`, and distance/angle assertions. References may also be node IDs, `anchor:<node-id>#<anchor-id>`, or `socket:<node-id>#<socket-id>`.
5. Use `scenecheck measure aabb --from <node> --to <node>` for cheap broad-phase clearance/intersection evidence, and `scenecheck measure bounds --node <node>` for captured AABB size/center. AABB evidence is not proof of exact mesh collision or exact surface clearance.
6. For module placement, use `scenecheck solve attachment` and change only the module root transform. Do not recompute or rewrite child world coordinates when the module exposes anchors/sockets.
7. A solver result with `safeToApplyTRS: false` or exit code 2 is an exact-matrix placement that ordinary TRS cannot represent safely, usually because of parent scaling/shear. Do not blindly apply the returned decomposed TRS; inspect or restructure the transform hierarchy.
8. When a `scenecheck.config.*` file exists, run `scenecheck validate --json` after spatial changes. `aabb-clearance` and `aabb-intersection` assertions are broad-phase checks only. Treat a non-zero exit code as a failed verification, not as a tool failure to ignore.
9. Use `scenecheck dump [provider]` only when the complete Scene IR is actually needed. It emits compact JSON by default; use `--pretty` only when human readability is useful.
10. Prefer `--no-bounds` or `--exclude-invisible` when the omitted data is irrelevant and a smaller result will reduce tool output.
11. Inspect or measure the relevant scene objects before editing source code when placement, transforms, bounds, alignment, clearance, intersections, or annotations are involved.
12. Treat local-space and world-space transforms as different coordinate systems. Preserve module-local transforms unless the task explicitly requires editing the module itself.
13. Prefer module, anchor, and socket relationships over manually recomputing child world coordinates when those semantics are available.
14. After modifying scene code, rerun the relevant SceneCheck annotation, query, dump, measurement, solve, or validation. Do not claim a spatial fix is correct from source inspection alone when SceneCheck can verify it.
15. Do not add temporary scene instrumentation, debug meshes, or ad-hoc logging when SceneCheck already exposes the required information.
16. Use visual/browser inspection when appearance itself matters, but do not use screenshots as a substitute for exact geometry checks that SceneCheck can perform.
17. If SceneCheck reports a failed assertion, diagnose the semantic cause in source code rather than blindly forcing the runtime transform to match the expected number.
