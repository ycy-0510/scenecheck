import { resolveAnnotation } from "./annotations.js";
import {
  parseSceneReference,
  resolveSceneReference,
} from "./measure.js";
import type { Quat, SceneIR, Vec3 } from "./index.js";

export interface PoseAssertion {
  id: string;
  type: "pose";
  /** Node, anchor, or socket whose current world pose is checked. Annotation targets are rejected. */
  target: string;
  /** Frozen expected world position. */
  position: Vec3;
  positionTolerance: number;
  /** Optional frozen expected world orientation. */
  rotation?: Quat;
  rotationToleranceDegrees?: number;
}

export interface PoseAssertionActual {
  positionError: number;
  rotationErrorDegrees?: number;
}

export interface PoseAssertionEvaluation {
  pass: boolean;
  actual: PoseAssertionActual;
  expected: string;
}

export interface FreezeAnnotationPoseOptions {
  target: string;
  positionTolerance: number;
  /** Include the annotation orientation and require this angular tolerance. */
  rotationToleranceDegrees?: number;
  assertionId?: string;
}

/**
 * Freeze the annotation's currently resolved world pose into a literal assertion.
 * The returned assertion does not depend on the annotation after creation.
 */
export function freezeAnnotationAsPoseAssertion(
  scene: SceneIR,
  annotationId: string,
  options: FreezeAnnotationPoseOptions,
): PoseAssertion {
  const annotation = scene.annotations?.find((item) => item.id === annotationId);
  if (!annotation) {
    throw new Error(`SceneCheck annotation not found: "${annotationId}".`);
  }

  validateTargetReference(options.target);
  // Resolve now so generation fails immediately on a misspelled node/anchor/socket.
  resolveSceneReference(scene, options.target);
  validateNonNegativeFinite(
    options.positionTolerance,
    "positionTolerance",
    annotationId,
  );

  if (options.rotationToleranceDegrees !== undefined) {
    if (annotation.type === "point") {
      throw new Error(
        `Point annotation "${annotationId}" has no orientation semantics. Use a pose/arrow annotation or omit rotation tolerance.`,
      );
    }
    validateRotationTolerance(options.rotationToleranceDegrees, annotationId);
  }

  const resolved = resolveAnnotation(scene, annotationId);
  const assertionId = options.assertionId?.trim() || `${annotationId}-frozen-pose`;
  const result: PoseAssertion = {
    id: assertionId,
    type: "pose",
    target: options.target,
    position: cloneVec3(resolved.worldTransform.position),
    positionTolerance: options.positionTolerance,
  };

  if (options.rotationToleranceDegrees !== undefined) {
    result.rotation = normalizeQuat(resolved.worldTransform.rotation);
    result.rotationToleranceDegrees = options.rotationToleranceDegrees;
  }
  return result;
}

export function validatePoseAssertionDefinition(assertion: PoseAssertion): void {
  if (!assertion.id.trim()) throw new Error("SceneCheck assertion id cannot be empty.");
  validateTargetReference(assertion.target);
  validateVec3(assertion.position, "position", assertion.id);
  validateNonNegativeFinite(
    assertion.positionTolerance,
    "positionTolerance",
    assertion.id,
  );

  const hasRotation = assertion.rotation !== undefined;
  const hasTolerance = assertion.rotationToleranceDegrees !== undefined;
  if (hasRotation !== hasTolerance) {
    throw new Error(
      `Pose assertion "${assertion.id}" rotation and rotationToleranceDegrees must be provided together.`,
    );
  }
  if (assertion.rotation) {
    validateQuat(assertion.rotation, assertion.id);
    validateRotationTolerance(assertion.rotationToleranceDegrees!, assertion.id);
  }
}

export function evaluatePoseAssertion(
  scene: SceneIR,
  assertion: PoseAssertion,
): PoseAssertionEvaluation {
  validatePoseAssertionDefinition(assertion);
  const current = resolveSceneReference(scene, assertion.target);
  const positionError = distance3(current.worldPosition, assertion.position);
  let rotationErrorDegrees: number | undefined;

  if (assertion.rotation) {
    rotationErrorDegrees = quaternionAngleDegrees(
      current.worldRotation,
      assertion.rotation,
    );
  }

  const pass =
    positionError <= assertion.positionTolerance &&
    (rotationErrorDegrees === undefined ||
      rotationErrorDegrees <= assertion.rotationToleranceDegrees!);

  const actual: PoseAssertionActual = {
    positionError,
    ...(rotationErrorDegrees !== undefined ? { rotationErrorDegrees } : {}),
  };

  const position = `position within ${formatNumber(assertion.positionTolerance)} m of ${formatVec3(assertion.position)}`;
  const rotation = assertion.rotation
    ? ` and rotation within ${formatNumber(assertion.rotationToleranceDegrees!)}° of ${formatQuat(assertion.rotation)}`
    : "";

  return {
    pass,
    actual,
    expected: `${position}${rotation}`,
  };
}

function validateTargetReference(reference: string): void {
  const parsed = parseSceneReference(reference);
  if (parsed.kind === "annotation") {
    throw new Error(
      "Pose assertion target must be a node, anchor, or socket, not an annotation. Frozen expected pose belongs in the assertion literal.",
    );
  }
}

function validateVec3(value: Vec3, field: string, id: string): void {
  if (value.length !== 3 || !value.every(Number.isFinite)) {
    throw new Error(
      `Pose assertion "${id}" ${field} must contain three finite numbers.`,
    );
  }
}

function validateQuat(value: Quat, id: string): void {
  if (value.length !== 4 || !value.every(Number.isFinite)) {
    throw new Error(
      `Pose assertion "${id}" rotation must contain four finite numbers.`,
    );
  }
  const length = Math.hypot(value[0], value[1], value[2], value[3]);
  if (length === 0) {
    throw new Error(`Pose assertion "${id}" rotation cannot be a zero quaternion.`);
  }
}

function validateNonNegativeFinite(
  value: number,
  field: string,
  id: string,
): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(
      `Pose assertion "${id}" ${field} must be a finite non-negative number.`,
    );
  }
}

function validateRotationTolerance(value: number, id: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 180) {
    throw new Error(
      `Pose assertion "${id}" rotationToleranceDegrees must be between 0 and 180 degrees.`,
    );
  }
}

function quaternionAngleDegrees(a: Quat, b: Quat): number {
  const qa = normalizeQuat(a);
  const qb = normalizeQuat(b);
  const dot = Math.abs(
    qa[0] * qb[0] + qa[1] * qb[1] + qa[2] * qb[2] + qa[3] * qb[3],
  );
  return (2 * Math.acos(clamp(dot, -1, 1)) * 180) / Math.PI;
}

function normalizeQuat(value: Quat): Quat {
  const length = Math.hypot(value[0], value[1], value[2], value[3]);
  if (!Number.isFinite(length) || length === 0) {
    throw new Error("Cannot normalize an invalid or zero-length quaternion.");
  }
  return [
    value[0] / length,
    value[1] / length,
    value[2] / length,
    value[3] / length,
  ];
}

function distance3(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function cloneVec3(value: Vec3): Vec3 {
  return [value[0], value[1], value[2]];
}

function formatVec3(value: Vec3): string {
  return `(${value.map(formatNumber).join(", ")})`;
}

function formatQuat(value: Quat): string {
  return `(${value.map(formatNumber).join(", ")})`;
}

function formatNumber(value: number): string {
  if (Object.is(value, -0)) return "0";
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
