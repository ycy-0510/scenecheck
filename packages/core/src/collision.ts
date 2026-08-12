import type { Transform, Vec3 } from "./index.js";

export interface CollisionShapeBase {
  /** Stable ID within the owning SceneNode. */
  id: string;
  /** Shape pose in the owning SceneNode's local coordinate system. */
  transform: Transform;
}

export interface BoxCollisionShape extends CollisionShapeBase {
  type: "box";
  /** Full local box size along X/Y/Z. All components must be positive. */
  size: Vec3;
}

export interface SphereCollisionShape extends CollisionShapeBase {
  type: "sphere";
  /** Local sphere radius. Must be positive. */
  radius: number;
}

export type CollisionShape = BoxCollisionShape | SphereCollisionShape;
