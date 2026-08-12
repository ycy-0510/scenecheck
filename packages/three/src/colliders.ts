import type {
  CollisionShape,
  Quat,
  Transform,
  Vec3,
} from "@scenecheck/core";

export interface ThreeColliderTransformInput {
  position?: Vec3;
  rotation?: Quat;
  scale?: Vec3;
}

export interface ThreeBoxColliderInput extends ThreeColliderTransformInput {
  id: string;
  type: "box";
  size: Vec3;
}

export interface ThreeSphereColliderInput extends ThreeColliderTransformInput {
  id: string;
  type: "sphere";
  radius: number;
}

export type ThreeColliderInput = ThreeBoxColliderInput | ThreeSphereColliderInput;

export function normalizeThreeColliders(
  inputs: readonly ThreeColliderInput[] | undefined,
): readonly CollisionShape[] | undefined {
  if (!inputs?.length) return undefined;
  const shapes = inputs.map(normalizeCollider);
  const ids = new Set<string>();
  for (const shape of shapes) {
    if (ids.has(shape.id)) {
      throw new Error(`Duplicate SceneCheck collider id: "${shape.id}".`);
    }
    ids.add(shape.id);
  }
  return shapes;
}

export function cloneCollisionShapes(
  shapes: readonly CollisionShape[] | undefined,
): readonly CollisionShape[] | undefined {
  if (!shapes) return undefined;
  return shapes.map((shape) =>
    shape.type === "box"
      ? {
          ...shape,
          transform: cloneTransform(shape.transform),
          size: cloneVec3(shape.size),
        }
      : {
          ...shape,
          transform: cloneTransform(shape.transform),
        },
  );
}

function normalizeCollider(input: ThreeColliderInput): CollisionShape {
  const id = input.id.trim();
  if (!id) throw new Error("SceneCheck collider id cannot be empty.");
  const transform = normalizeTransform(input);

  if (input.type === "box") {
    assertFinite(input.size, `SceneCheck box collider "${id}" size`);
    if (input.size.some((component) => component <= 0)) {
      throw new Error(
        `SceneCheck box collider "${id}" size components must all be positive.`,
      );
    }
    return { id, type: "box", transform, size: cloneVec3(input.size) };
  }

  if (!Number.isFinite(input.radius) || input.radius <= 0) {
    throw new Error(
      `SceneCheck sphere collider "${id}" radius must be a positive finite number.`,
    );
  }
  return { id, type: "sphere", transform, radius: input.radius };
}

function normalizeTransform(input: ThreeColliderTransformInput): Transform {
  const position = input.position ?? [0, 0, 0];
  const rotation = input.rotation ?? [0, 0, 0, 1];
  const scale = input.scale ?? [1, 1, 1];
  assertFinite(position, "SceneCheck collider position");
  assertFinite(rotation, "SceneCheck collider rotation");
  assertFinite(scale, "SceneCheck collider scale");
  return {
    position: cloneVec3(position),
    rotation: cloneQuat(rotation),
    scale: cloneVec3(scale),
  };
}

function cloneTransform(transform: Transform): Transform {
  return {
    position: cloneVec3(transform.position),
    rotation: cloneQuat(transform.rotation),
    scale: cloneVec3(transform.scale),
    ...(transform.matrix
      ? { matrix: [...transform.matrix] as Transform["matrix"] }
      : {}),
  };
}

function assertFinite(value: readonly number[], label: string): void {
  if (value.some((component) => !Number.isFinite(component))) {
    throw new Error(`${label} must contain only finite numbers.`);
  }
}

function cloneVec3(value: Vec3): Vec3 {
  return [value[0], value[1], value[2]];
}

function cloneQuat(value: Quat): Quat {
  return [value[0], value[1], value[2], value[3]];
}
