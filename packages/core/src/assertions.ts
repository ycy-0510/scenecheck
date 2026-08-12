import { measureAabbRelation } from "./aabb.js";
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

export interface AabbClearanceAssertion {
  id: string;
  type: "aabb-clearance";
  from: string;
  to: string;
  min?: number;
  max?: number;
  target?: number;
  tolerance?: number;
}

export interface AabbIntersectionAssertion {
  id: string;
  type: "aabb-intersection";
  a: string;
  b: string;
  expected: boolean;
  /** When true, touching is not considered an intersection; positive extent on all axes is required. */
  strict?: boolean;
}

export type SceneAssertion =
  | DistanceAssertion
  | AngleAssertion
  | AabbClearanceAssertion
  | AabbIntersectionAssertion;

export interface AssertionResult {
  id: string;
  type: SceneAssertion["type"];
  pass: boolean;
  actual: number | boolean;
  unit: "m" | "deg" | "boolean";
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
    const expected = describeNumericExpectation(assertion, "m");
    const pass = numericRangePasses(measurement.distance, assertion);
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

  if (assertion.type === "angle") {
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

  if (assertion.type === "aabb-clearance") {
    const measurement = measureAabbRelation(scene, assertion.from, assertion.to);
    const expected = describeNumericExpectation(assertion, "m");
    const pass = numericRangePasses(measurement.clearance, assertion);
    return {
      id: assertion.id,
      type: assertion.type,
      pass,
      actual: measurement.clearance,
      unit: "m",
      expected,
      from: assertion.from,
      to: assertion.to,
      message: `${assertion.id}: AABB clearance ${formatNumber(measurement.clearance)} m ${pass ? "passes" : "fails"} ${expected}`,
    };
  }

  const measurement = measureAabbRelation(scene, assertion.a, assertion.b);
  const actual = assertion.strict ? measurement.strictlyOverlaps : measurement.intersects;
  const relation = assertion.strict ? "strict AABB overlap" : "closed AABB intersection";
  const expected = `${relation} must be ${assertion.expected}`;
  const pass = actual === assertion.expected;
  return {
    id: assertion.id,
    type: assertion.type,
    pass,
    actual,
    unit: "boolean",
    expected,
    from: assertion.a,
    to: assertion.b,
    message: `${assertion.id}: ${relation} is ${actual}; ${pass ? "passes" : "fails"} expected ${assertion.expected}`,
  };
}

function validateAssertionDefinition(assertion: SceneAssertion): void {
  if (!assertion.id.trim()) throw new Error("SceneCheck assertion id cannot be empty.");

  if (assertion.type === "distance") {
    requireFromTo(assertion);
    validateNumericAssertion(assertion, "Distance");
    return;
  }
  if (assertion.type === "angle") {
    requireFromTo(assertion);
    validateAngleAssertion(assertion);
    return;
  }
  if (assertion.type === "aabb-clearance") {
    requireFromTo(assertion);
    validateNumericAssertion(assertion, "AABB clearance");
    return;
  }
  if (assertion.type === "aabb-intersection") {
    if (!assertion.a.trim() || !assertion.b.trim()) {
      throw new Error(`Assertion "${assertion.id}" requires non-empty a/b node IDs.`);
    }
    if (typeof assertion.expected !== "boolean") {
      throw new Error(`AABB intersection assertion "${assertion.id}" expected must be boolean.`);
    }
    return;
  }

  const neverAssertion: never = assertion;
  throw new Error(`Unsupported SceneCheck assertion type: ${String(neverAssertion)}`);
}

function requireFromTo(assertion: { id: string; from: string; to: string }): void {
  if (!assertion.from.trim() || !assertion.to.trim()) {
    throw new Error(`Assertion "${assertion.id}" requires non-empty from/to references.`);
  }
}

function validateNumericAssertion(
  assertion: DistanceAssertion | AabbClearanceAssertion,
  label: string,
): void {
  const hasRange = assertion.min !== undefined || assertion.max !== undefined;
  const hasTarget = assertion.target !== undefined;
  if (!hasRange && !hasTarget) {
    throw new Error(
      `${label} assertion "${assertion.id}" requires min, max, or target+tolerance.`,
    );
  }
  if (assertion.target !== undefined && assertion.tolerance === undefined) {
    throw new Error(`${label} assertion "${assertion.id}" target requires tolerance.`);
  }
  if (assertion.tolerance !== undefined && assertion.target === undefined) {
    throw new Error(`${label} assertion "${assertion.id}" tolerance requires target.`);
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
    throw new Error(`${label} assertion "${assertion.id}" min cannot exceed max.`);
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

function numericRangePasses(
  actual: number,
  assertion: DistanceAssertion | AabbClearanceAssertion,
): boolean {
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

function describeNumericExpectation(
  assertion: DistanceAssertion | AabbClearanceAssertion,
  unit: "m",
): string {
  const parts: string[] = [];
  if (assertion.min !== undefined) parts.push(`>= ${formatNumber(assertion.min)} ${unit}`);
  if (assertion.max !== undefined) parts.push(`<= ${formatNumber(assertion.max)} ${unit}`);
  if (assertion.target !== undefined && assertion.tolerance !== undefined) {
    parts.push(
      `within ${formatNumber(assertion.tolerance)} ${unit} of ${formatNumber(assertion.target)} ${unit}`,
    );
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
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
}
