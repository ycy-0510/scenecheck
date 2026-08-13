import type { SceneIR } from "./index.js";

export const LIVE_PROTOCOL_VERSION = 1 as const;
export const DEFAULT_LIVE_PORT: number = 37431;
export const DEFAULT_LIVE_URL: string = `http://127.0.0.1:${DEFAULT_LIVE_PORT}`;

export interface LiveCaptureOptions {
  includeInvisible?: boolean;
  includeBounds?: boolean;
}

export interface LiveCaptureRequest {
  protocol: typeof LIVE_PROTOCOL_VERSION;
  requestId: string;
  type: "capture";
  options: LiveCaptureOptions;
}

export interface LiveCaptureSuccess {
  protocol: typeof LIVE_PROTOCOL_VERSION;
  requestId: string;
  ok: true;
  scene: SceneIR;
}

export interface LiveCaptureFailure {
  protocol: typeof LIVE_PROTOCOL_VERSION;
  requestId: string;
  ok: false;
  error: string;
}

export type LiveCaptureResponse = LiveCaptureSuccess | LiveCaptureFailure;

export function parseLiveCaptureRequest(value: unknown): LiveCaptureRequest {
  if (!isRecord(value)) throw new Error("SceneCheck live capture request must be an object.");
  if (value.protocol !== LIVE_PROTOCOL_VERSION) {
    throw new Error(`Unsupported SceneCheck live protocol: ${String(value.protocol)}.`);
  }
  if (value.type !== "capture") {
    throw new Error(`Unsupported SceneCheck live request type: ${String(value.type)}.`);
  }
  const requestId = requireNonEmptyString(value.requestId, "requestId");
  const options = value.options === undefined ? {} : parseCaptureOptions(value.options);
  return {
    protocol: LIVE_PROTOCOL_VERSION,
    requestId,
    type: "capture",
    options,
  };
}

export function parseLiveCaptureResponse(value: unknown): LiveCaptureResponse {
  if (!isRecord(value)) throw new Error("SceneCheck live capture response must be an object.");
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
    throw new Error("SceneCheck live capture response ok must be a boolean.");
  }
  if (!isSceneIRLike(value.scene)) {
    throw new Error("SceneCheck live capture response scene must be Scene IR.");
  }
  return {
    protocol: LIVE_PROTOCOL_VERSION,
    requestId,
    ok: true,
    scene: value.scene as unknown as SceneIR,
  };
}

export function parseLiveCaptureOptions(value: unknown): LiveCaptureOptions {
  return parseCaptureOptions(value);
}

function parseCaptureOptions(value: unknown): LiveCaptureOptions {
  if (!isRecord(value)) throw new Error("SceneCheck live capture options must be an object.");
  const includeInvisible = optionalBoolean(value.includeInvisible, "includeInvisible");
  const includeBounds = optionalBoolean(value.includeBounds, "includeBounds");
  return {
    ...(includeInvisible !== undefined ? { includeInvisible } : {}),
    ...(includeBounds !== undefined ? { includeBounds } : {}),
  };
}

function optionalBoolean(value: unknown, path: string): boolean | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "boolean") {
    throw new Error(`SceneCheck live ${path} must be a boolean.`);
  }
  return value;
}

function requireNonEmptyString(value: unknown, path: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`SceneCheck live ${path} must be a non-empty string.`);
  }
  return value;
}

function isSceneIRLike(value: unknown): boolean {
  return (
    isRecord(value) &&
    value.version === 1 &&
    Array.isArray(value.roots) &&
    isRecord(value.nodes)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
