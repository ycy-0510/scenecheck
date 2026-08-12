export type Vec3 = readonly [number, number, number];
export type Quat = readonly [number, number, number, number];
export type Mat4 = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

export interface Transform {
  position: Vec3;
  rotation: Quat;
  scale: Vec3;
  /** Exact column-major transform matrix when the source adapter provides one. */
  matrix?: Mat4;
}

export interface Bounds {
  min: Vec3;
  max: Vec3;
}

export interface Anchor {
  id: string;
  transform: Transform;
  type?: string;
}

export interface Socket {
  id: string;
  transform: Transform;
  accepts?: readonly string[];
}

export interface SceneSemantics {
  module?: string;
  anchors?: readonly Anchor[];
  sockets?: readonly Socket[];
}

export interface SceneNode {
  id: string;
  name?: string;
  type: string;
  parentId?: string;
  children: readonly string[];
  localTransform: Transform;
  worldTransform: Transform;
  /** World-axis-aligned bounds for this node and captured descendants. */
  bounds?: Bounds;
  metadata?: Readonly<Record<string, unknown>>;
  semantics?: SceneSemantics;
}

export type AnnotationType = "point" | "arrow" | "pose";

export interface Annotation {
  id: string;
  type: AnnotationType;
  attachedTo?: string;
  worldTransform: Transform;
  localTransform?: Transform;
  label?: string;
  note?: string;
}

export interface SceneIR {
  version: 1;
  roots: readonly string[];
  nodes: Readonly<Record<string, SceneNode>>;
  annotations?: readonly Annotation[];
}

export interface SceneAdapter<TScene = unknown> {
  toSceneIR(scene: TScene): Promise<SceneIR> | SceneIR;
}

export interface SceneQuery {
  /** Exact SceneCheck node ID. */
  id?: string;
  /** Exact node name. Case-insensitive by default. */
  name?: string;
  /** Exact node type. Case-insensitive by default. */
  type?: string;
  /** Exact parent node ID. */
  parentId?: string;
  /** Substring search across ID, name, and type. */
  text?: string;
  /** Maximum number of returned nodes. Default: 20. */
  limit?: number;
  /** Use case-sensitive name/type/text matching. Default: false. */
  caseSensitive?: boolean;
}

export interface SceneQueryResult {
  total: number;
  truncated: boolean;
  nodes: readonly SceneNode[];
}

export interface SceneSummary {
  roots: readonly string[];
  rootCount: number;
  nodeCount: number;
  namedNodeCount: number;
  boundedNodeCount: number;
  types: Readonly<Record<string, number>>;
}

export function queryScene(scene: SceneIR, query: SceneQuery): SceneQueryResult {
  const limit = normalizeLimit(query.limit);
  const nodes = Object.values(scene.nodes).filter((node) => matchesQuery(node, query));
  const total = nodes.length;

  return {
    total,
    truncated: total > limit,
    nodes: nodes.slice(0, limit),
  };
}

export function summarizeScene(scene: SceneIR): SceneSummary {
  const types: Record<string, number> = {};
  let namedNodeCount = 0;
  let boundedNodeCount = 0;

  for (const node of Object.values(scene.nodes)) {
    types[node.type] = (types[node.type] ?? 0) + 1;
    if (node.name) namedNodeCount += 1;
    if (node.bounds) boundedNodeCount += 1;
  }

  return {
    roots: scene.roots,
    rootCount: scene.roots.length,
    nodeCount: Object.keys(scene.nodes).length,
    namedNodeCount,
    boundedNodeCount,
    types: Object.fromEntries(
      Object.entries(types).sort(([a], [b]) => a.localeCompare(b)),
    ),
  };
}

function matchesQuery(node: SceneNode, query: SceneQuery): boolean {
  if (query.id !== undefined && node.id !== query.id) return false;
  if (query.parentId !== undefined && node.parentId !== query.parentId) return false;

  if (
    query.name !== undefined &&
    !equalText(node.name ?? "", query.name, query.caseSensitive === true)
  ) {
    return false;
  }

  if (
    query.type !== undefined &&
    !equalText(node.type, query.type, query.caseSensitive === true)
  ) {
    return false;
  }

  if (query.text !== undefined) {
    const needle = normalizeText(query.text, query.caseSensitive === true);
    const haystacks = [node.id, node.name ?? "", node.type].map((value) =>
      normalizeText(value, query.caseSensitive === true),
    );
    if (!haystacks.some((value) => value.includes(needle))) return false;
  }

  return true;
}

function equalText(actual: string, expected: string, caseSensitive: boolean): boolean {
  return normalizeText(actual, caseSensitive) === normalizeText(expected, caseSensitive);
}

function normalizeText(value: string, caseSensitive: boolean): string {
  return caseSensitive ? value : value.toLocaleLowerCase();
}

function normalizeLimit(limit: number | undefined): number {
  if (limit === undefined) return 20;
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error(`Scene query limit must be a positive integer. Received: ${limit}`);
  }
  return limit;
}

export * from "./measure.js";
export * from "./assertions.js";
export * from "./matrix.js";
export * from "./assembly.js";
export * from "./aabb.js";
