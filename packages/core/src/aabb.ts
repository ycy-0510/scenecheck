import type { Bounds, SceneIR, SceneNode, Vec3 } from "./index.js";

export interface AabbRelationMeasurement {
  kind: "aabb-relation";
  a: { nodeId: string; bounds: Bounds };
  b: { nodeId: string; bounds: Bounds };
  /** Per-axis empty-space gap. Zero on axes whose intervals touch or overlap. */
  axisGap: Vec3;
  /** Euclidean minimum distance between the two AABBs. */
  clearance: number;
  /** True when the closed AABBs share at least one point, including touching. */
  intersects: boolean;
  /** True only when intersection has positive extent on all three axes. */
  strictlyOverlaps: boolean;
  /** True when closed AABBs intersect but have zero intersection extent on at least one axis. */
  touches: boolean;
  /** Size of the AABB intersection when intersecting; null when separated. */
  intersectionExtent: Vec3 | null;
}

export interface AabbSizeMeasurement {
  kind: "aabb-size";
  nodeId: string;
  bounds: Bounds;
  size: Vec3;
  center: Vec3;
  diagonal: number;
}

export function measureAabbRelation(
  scene: SceneIR,
  aNodeId: string,
  bNodeId: string,
): AabbRelationMeasurement {
  const a = requireBounds(scene, aNodeId);
  const b = requireBounds(scene, bNodeId);
  const axisGap: Vec3 = [
    intervalGap(a.bounds.min[0], a.bounds.max[0], b.bounds.min[0], b.bounds.max[0]),
    intervalGap(a.bounds.min[1], a.bounds.max[1], b.bounds.min[1], b.bounds.max[1]),
    intervalGap(a.bounds.min[2], a.bounds.max[2], b.bounds.min[2], b.bounds.max[2]),
  ];
  const clearance = Math.hypot(axisGap[0], axisGap[1], axisGap[2]);
  const intersects = clearance === 0;
  const intersectionExtent = intersects
    ? ([
        intervalIntersectionExtent(
          a.bounds.min[0],
          a.bounds.max[0],
          b.bounds.min[0],
          b.bounds.max[0],
        ),
        intervalIntersectionExtent(
          a.bounds.min[1],
          a.bounds.max[1],
          b.bounds.min[1],
          b.bounds.max[1],
        ),
        intervalIntersectionExtent(
          a.bounds.min[2],
          a.bounds.max[2],
          b.bounds.min[2],
          b.bounds.max[2],
        ),
      ] satisfies Vec3)
    : null;
  const strictlyOverlaps =
    intersectionExtent !== null && intersectionExtent.every((extent) => extent > 0);

  return {
    kind: "aabb-relation",
    a: { nodeId: a.node.id, bounds: cloneBounds(a.bounds) },
    b: { nodeId: b.node.id, bounds: cloneBounds(b.bounds) },
    axisGap,
    clearance,
    intersects,
    strictlyOverlaps,
    touches: intersects && !strictlyOverlaps,
    intersectionExtent,
  };
}

export function measureAabbSize(scene: SceneIR, nodeId: string): AabbSizeMeasurement {
  const { node, bounds } = requireBounds(scene, nodeId);
  const size: Vec3 = [
    bounds.max[0] - bounds.min[0],
    bounds.max[1] - bounds.min[1],
    bounds.max[2] - bounds.min[2],
  ];
  const center: Vec3 = [
    (bounds.min[0] + bounds.max[0]) / 2,
    (bounds.min[1] + bounds.max[1]) / 2,
    (bounds.min[2] + bounds.max[2]) / 2,
  ];

  return {
    kind: "aabb-size",
    nodeId: node.id,
    bounds: cloneBounds(bounds),
    size,
    center,
    diagonal: Math.hypot(size[0], size[1], size[2]),
  };
}

function requireBounds(
  scene: SceneIR,
  nodeId: string,
): { node: SceneNode; bounds: Bounds } {
  const node = scene.nodes[nodeId];
  if (!node) throw new Error(`SceneCheck node not found: "${nodeId}".`);
  if (!node.bounds) {
    throw new Error(
      `SceneCheck node "${nodeId}" has no captured AABB. Re-run without --no-bounds or provide adapter bounds.`,
    );
  }
  return { node, bounds: node.bounds };
}

function intervalGap(aMin: number, aMax: number, bMin: number, bMax: number): number {
  if (aMax < bMin) return bMin - aMax;
  if (bMax < aMin) return aMin - bMax;
  return 0;
}

function intervalIntersectionExtent(
  aMin: number,
  aMax: number,
  bMin: number,
  bMax: number,
): number {
  return Math.max(0, Math.min(aMax, bMax) - Math.max(aMin, bMin));
}

function cloneBounds(bounds: Bounds): Bounds {
  return {
    min: [bounds.min[0], bounds.min[1], bounds.min[2]],
    max: [bounds.max[0], bounds.max[1], bounds.max[2]],
  };
}
