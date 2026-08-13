import {
  parseRuntimePerformanceSnapshot,
  type RuntimePerformanceSnapshot,
} from "./performance.js";
import { LIVE_PROTOCOL_VERSION } from "./live-protocol.js";

export const DEFAULT_PERFORMANCE_FRAME_SAMPLES = 60;
export const MAX_PERFORMANCE_FRAME_SAMPLES = 600;

export interface LivePerformanceOptions {
  frames: number;
}

export interface LivePerformanceRequest {
  protocol: typeof LIVE_PROTOCOL_VERSION;
  requestId: string;
  type: "performance";
  options: LivePerformanceOptions;
}

export interface LivePerformanceSuccess {
  protocol: typeof LIVE_PROTOCOL_VERSION;
  requestId: string;
  ok: true;
  performance: RuntimePerformanceSnapshot;
}

export interface LivePerformanceFailure {
  protocol: typeof LIVE_PROTOCOL_VERSION;
  requestId: string;
  ok: false;
  error: string;
}

export type LivePerformanceResponse = LivePerformanceSuccess | LivePerformanceFailure;

export function parseLivePerformanceOptions(value: unknown): LivePerformanceOptions {
  if (!isRecord(value)) {
    throw new Error("SceneCheck live performance options must be an object.");
  }
  const frames = value.frames ?? DEFAULT_PERFORMANCE_FRAME_SAMPLES;
  if (
    typeof frames !== "number" ||
    !Number.isInteger(frames) ||
    frames < 1 ||
    frames > MAX_PERFORMANCE_FRAME_SAMPLES
  ) {
    throw new Error(
      `SceneCheck live performance frames must be an integer from 1 to ${MAX_PERFORMANCE_FRAME_SAMPLES}.`,
    );
  }
  return { frames };
}

export function parseLivePerformanceRequest(value: unknown): LivePerformanceRequest {
  if (!isRecord(value)) {
    throw new Error("SceneCheck live performance request must be an object.");
  }
  if (value.protocol !== LIVE_PROTOCOL_VERSION) {
    throw new Error(`Unsupported SceneCheck live protocol: ${String(value.protocol)}.`);
  }
  if (value.type !== "performance") {
    throw new Error(`Unsupported SceneCheck live request type: ${String(value.type)}.`);
  }
  const requestId = requireNonEmptyString(value.requestId, "requestId");
  return {
    protocol: LIVE_PROTOCOL_VERSION,
    requestId,
    type: "performance",
    options: parseLivePerformanceOptions(value.options ?? {}),
  };
}

export function parseLivePerformanceResponse(value: unknown): LivePerformanceResponse {
  if (!isRecord(value)) {
    throw new Error("SceneCheck live performance response must be an object.");
  }
  if (value.protocol !== LIVE_PROTOCOL_VERSION) {
    throw new Error(`Unsupported SceneCheck live protocol: ${String(value.protocol)}.`);
  }
  const requestId = requireNonEmptyString(value.requestId, "requestId");
  if (value.ok === false) {
    return {
      protocol: LIVE_PROTOCOL_VERSION,
      requestId,
      ok: false,
      error: requireNonEmptyString(value.error, "error"),
    };
  }
  if (value.ok !== true) {
    throw new Error("SceneCheck live performance response ok must be a boolean.");
  }
  return {
    protocol: LIVE_PROTOCOL_VERSION,
    requestId,
    ok: true,
    performance: parseRuntimePerformanceSnapshot(value.performance),
  };
}

function requireNonEmptyString(value: unknown, path: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`SceneCheck live ${path} must be a non-empty string.`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
