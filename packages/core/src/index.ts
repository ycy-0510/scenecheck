export type Vec3 = readonly [number, number, number];
export type Quat = readonly [number, number, number, number];

export interface Transform {
  position: Vec3;
  rotation: Quat;
  scale: Vec3;
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
