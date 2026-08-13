import { measureAngle, measureDistance } from "./measure.js";
import type { SceneIR } from "./index.js";

export interface DistanceAssertion {
  id: string;
  type: "distance";
  from: string;
  to: string;
  min?: number;
  max?: number;
  target?: number;
  tolerance?: number;
}

export interface AngleAssertion {
  id: string;
  type: "angle";
  from: string;
  to: string;
  minDegrees?: number;
  maxDegrees?: number;
  targetDegrees?: number;
  toleranceDegrees?: number;
}

export type SceneAssertion = DistanceAssertion | AngleAssertion;

export interface AssertionResult {
  id: string;
  type: SceneAssertion["type"];
  pass: boolean;
  actual: number;
  unit: "m" | "deg";
  expected: string;
  from: string;
  to: string;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  total: number;
  passed: number;
  failed: number;
  results: readonly AssertionResult[];
}

export function validateScene(
  scene: SceneIR,
  assertions: readonly SceneAssertion[],
): ValidationResult {
  const ids = new Set<string>();
  const results = assertions.map((assertion) => {
    validateAssertionDefinition(assertion);
    if (ids.has(assertion.id)) {
      throw new Error(`Duplicate SceneCheck assertion id: "${assertion.id}".`);
    }
    ids.add(assertion.id);
    return evaluateAssertion(scene, assertion);
  });
  const passed = results.filter((result) => result.pass).length;
  const failed = results.length - passed;

  return {
    ok: failed === 0,
    total: results.length,
    passed,
    failed,
    results,
  };
}

export function evaluateAssertion(
  scene: SceneIR,
  assertion: SceneAssertion,
): AssertionResult {
  validateAssertionDefinition(assertion);

  if (assertion.type === "distance") {
    const measurement = measureDistance(scene, assertion.from, assertion.to);
    const expected = describeDistanceExpectation(assertion);
    const pass = distancePasses(measurement.distance, assertion);
    return {
      id: assertion.id,
      type: assertion.type,
      pass,
      actual: measurement.distance,
      unit: "m",
      expected,
      from: assertion.from,
      to: assertion.to,
      message: `${assertion.id}: distance ${formatNumber(measurement.distance)} m ${pass ? "passes" : "fails"} ${expected}`,
    };
  }

  const measurement = measureAngle(scene, assertion.from, assertion.to);
  const expected = describeAngleExpectation(assertion);
  const pass = anglePasses(measurement.degrees, assertion);
  return {
    id: assertion.id,
    type: assertion.type,
    pass,
    actual: measurement.degrees,
    unit: "deg",
    expected,
    from: assertion.from,
    to: assertion.to,
    message: `${assertion.id}: angle ${formatNumber(measurement.degrees)}° ${pass ? "passes" : "fails"} ${expected}`,
  };
}

function validateAssertionDefinition(assertion: SceneAssertion): void {
  if (!assertion.id.trim()) throw new Error("SceneCheck assertion id cannot be empty.");
  if (!assertion.from.trim() || !assertion.to.trim()) {
    throw new Error(`Assertion "${assertion.id}" requires non-empty from/to references.`);
  }

  if (assertion.type === "distance") {
    validateDistanceAssertion(assertion);
    return;
  }
  if (assertion.type === "angle") {
    validateAngleAssertion(assertion);
    return;
  }

  const neverAssertion: never = assertion;
  throw new Error(`Unsupported SceneCheck assertion type: ${String(neverAssertion)}`);
}

function validateDistanceAssertion(assertion: DistanceAssertion): void {
  const hasRange = assertion.min !== undefined || assertion.max !== undefined;
  const hasTarget = assertion.target !== undefined;
  if (!hasRange && !hasTarget) {
    throw new Error(
      `Distance assertion "${assertion.id}" requires min, max, or target+tolerance.`,
    );
  }
  if (assertion.target !== undefined && assertion.tolerance === undefined) {
    throw new Error(`Distance assertion "${assertion.id}" target requires tolerance.`);
  }
  if (assertion.tolerance !== undefined && assertion.target === undefined) {
    throw new Error(`Distance assertion "${assertion.id}" tolerance requires target.`);
  }
  validateNonNegative(assertion.min, "min", assertion.id);
  validateNonNegative(assertion.max, "max", assertion.id);
  validateNonNegative(assertion.target, "target", assertion.id);
  validateNonNegative(assertion.tolerance, "tolerance", assertion.id);
  if (
    assertion.min !== undefined &&
    assertion.max !== undefined &&
    assertion.min > assertion.max
  ) {
    throw new Error(`Distance assertion "${assertion.id}" min cannot exceed max.`);
  }
}

function validateAngleAssertion(assertion: AngleAssertion): void {
  const hasRange = assertion.minDegrees !== undefined || assertion.maxDegrees !== undefined;
  const hasTarget = assertion.targetDegrees !== undefined;
  if (!hasRange && !hasTarget) {
    throw new Error(
      `Angle assertion "${assertion.id}" requires minDegrees, maxDegrees, or targetDegrees+toleranceDegrees.`,
    );
  }
  if (assertion.targetDegrees !== undefined && assertion.toleranceDegrees === undefined) {
    throw new Error(`Angle assertion "${assertion.id}" targetDegrees requires toleranceDegrees.`);
  }
  if (assertion.toleranceDegrees !== undefined && assertion.targetDegrees === undefined) {
    throw new Error(`Angle assertion "${assertion.id}" toleranceDegrees requires targetDegrees.`);
  }
  validateAngle(assertion.minDegrees, "minDegrees", assertion.id);
  validateAngle(assertion.maxDegrees, "maxDegrees", assertion.id);
  validateAngle(assertion.targetDegrees, "targetDegrees", assertion.id);
  validateNonNegative(assertion.toleranceDegrees, "toleranceDegrees", assertion.id);
  if (
    assertion.minDegrees !== undefined &&
    assertion.maxDegrees !== undefined &&
    assertion.minDegrees > assertion.maxDegrees
  ) {
    throw new Error(`Angle assertion "${assertion.id}" minDegrees cannot exceed maxDegrees.`);
  }
}

function distancePasses(actual: number, assertion: DistanceAssertion): boolean {
  if (assertion.min !== undefined && actual < assertion.min) return false;
  if (assertion.max !== undefined && actual > assertion.max) return false;
  if (
    assertion.target !== undefined &&
    assertion.tolerance !== undefined &&
    Math.abs(actual - assertion.target) > assertion.tolerance
  ) {
    return false;
  }
  return true;
}

function anglePasses(actual: number, assertion: AngleAssertion): boolean {
  if (assertion.minDegrees !== undefined && actual < assertion.minDegrees) return false;
  if (assertion.maxDegrees !== undefined && actual > assertion.maxDegrees) return false;
  if (
    assertion.targetDegrees !== undefined &&
    assertion.toleranceDegrees !== undefined &&
    Math.abs(actual - assertion.targetDegrees) > assertion.toleranceDegrees
  ) {
    return false;
  }
  return true;
}

function describeDistanceExpectation(assertion: DistanceAssertion): string {
  const parts: string[] = [];
  if (assertion.min !== undefined) parts.push(`>= ${formatNumber(assertion.min)} m`);
  if (assertion.max !== undefined) parts.push(`<= ${formatNumber(assertion.max)} m`);
  if (assertion.target !== undefined && assertion.tolerance !== undefined) {
    parts.push(`within ${formatNumber(assertion.tolerance)} m of ${formatNumber(assertion.target)} m`);
  }
  return parts.join(" and ");
}

function describeAngleExpectation(assertion: AngleAssertion): string {
  const parts: string[] = [];
  if (assertion.minDegrees !== undefined) {
    parts.push(`>= ${formatNumber(assertion.minDegrees)}°`);
  }
  if (assertion.maxDegrees !== undefined) {
    parts.push(`<= ${formatNumber(assertion.maxDegrees)}°`);
  }
  if (
    assertion.targetDegrees !== undefined &&
    assertion.toleranceDegrees !== undefined
  ) {
    parts.push(
      `within ${formatNumber(assertion.toleranceDegrees)}° of ${formatNumber(assertion.targetDegrees)}°`,
    );
  }
  return parts.join(" and ");
}

function validateNonNegative(
  value: number | undefined,
  field: string,
  assertionId: string,
): void {
  if (value === undefined) return;
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Assertion "${assertionId}" ${field} must be a finite non-negative number.`);
  }
}

function validateAngle(
  value: number | undefined,
  field: string,
  assertionId: string,
): void {
  if (value === undefined) return;
  if (!Number.isFinite(value) || value < 0 || value > 180) {
    throw new Error(`Assertion "${assertionId}" ${field} must be between 0 and 180 degrees.`);
  }
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
}
