import {
  DEFAULT_LIVE_URL,
  parseRuntimePerformanceSnapshot,
  type LiveCaptureOptions,
  type LivePerformanceOptions,
  type RuntimePerformanceSnapshot,
  type SceneIR,
} from "@scenecheck/core";

export interface LiveServerStatus {
  protocol: number;
  runtimeConnected: boolean;
  pendingCaptures: number;
  pendingPerformance: number;
}

export async function getLiveStatus(
  url = DEFAULT_LIVE_URL,
): Promise<LiveServerStatus> {
  const baseUrl = normalizeBaseUrl(url);
  const response = await fetch(`${baseUrl}/status`);
  const body = await readJsonResponse(response);
  if (!response.ok) throw new Error(errorMessage(body, response.status));
  if (!isRecord(body)) throw new Error("SceneCheck live status response is invalid.");
  if (
    typeof body.protocol !== "number" ||
    typeof body.runtimeConnected !== "boolean" ||
    typeof body.pendingCaptures !== "number" ||
    (body.pendingPerformance !== undefined && typeof body.pendingPerformance !== "number")
  ) {
    throw new Error("SceneCheck live status response is invalid.");
  }
  return {
    protocol: body.protocol,
    runtimeConnected: body.runtimeConnected,
    pendingCaptures: body.pendingCaptures,
    pendingPerformance: body.pendingPerformance ?? 0,
  };
}

export async function captureLiveScene(
  url = DEFAULT_LIVE_URL,
  options: LiveCaptureOptions = {},
): Promise<SceneIR> {
  const baseUrl = normalizeBaseUrl(url);
  const response = await fetch(`${baseUrl}/capture`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(options),
  });
  const body = await readJsonResponse(response);
  if (!response.ok) throw new Error(errorMessage(body, response.status));
  if (!isSceneIRLike(body)) {
    throw new Error("SceneCheck live capture returned invalid Scene IR.");
  }
  return body as unknown as SceneIR;
}

export async function sampleLivePerformance(
  url = DEFAULT_LIVE_URL,
  options: LivePerformanceOptions,
): Promise<RuntimePerformanceSnapshot> {
  const baseUrl = normalizeBaseUrl(url);
  const response = await fetch(`${baseUrl}/performance`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(options),
  });
  const body = await readJsonResponse(response);
  if (!response.ok) throw new Error(errorMessage(body, response.status));
  return parseRuntimePerformanceSnapshot(body);
}

export function normalizeLiveUrl(value: string): string {
  return normalizeBaseUrl(value);
}

async function readJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : undefined;
  } catch {
    throw new Error(`SceneCheck live server returned invalid JSON (HTTP ${response.status}).`);
  }
}

function errorMessage(body: unknown, status: number): string {
  if (isRecord(body) && typeof body.error === "string") return body.error;
  return `SceneCheck live request failed with HTTP ${status}.`;
}

function normalizeBaseUrl(value: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`Invalid SceneCheck live URL: ${value}`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("SceneCheck live URL must use http or https.");
  }
  parsed.search = "";
  parsed.hash = "";
  parsed.pathname = parsed.pathname.replace(/\/+$/, "");
  return parsed.toString().replace(/\/$/, "");
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
