import {
  DEFAULT_LIVE_URL,
  LIVE_PROTOCOL_VERSION,
  parseLiveCaptureRequest,
  parseLivePerformanceRequest,
  type LiveCaptureFailure,
  type LiveCaptureRequest,
  type LiveCaptureSuccess,
  type LivePerformanceFailure,
  type LivePerformanceRequest,
  type LivePerformanceSuccess,
} from "@scenecheck/core";
import type { WebGLRenderer } from "three";
import { ThreeDevtoolsController } from "./controller.js";
import { sampleThreePerformance } from "./performance.js";

export type ThreeLiveBridgeStatus = "connecting" | "connected" | "disconnected" | "error";

export interface ThreeLiveBridgeOptions {
  controller: ThreeDevtoolsController;
  /** Optional. Required only for `scenecheck live performance`. */
  renderer?: WebGLRenderer;
  url?: string;
  onStatusChange?: (status: ThreeLiveBridgeStatus) => void;
}

export interface AttachedThreeLiveBridge {
  readonly url: string;
  readonly status: ThreeLiveBridgeStatus;
  destroy(): void;
}

/**
 * Connect a running browser scene to a loopback SceneCheck live server.
 * Scene and performance work only happens when a corresponding live request arrives.
 */
export function attachThreeLiveBridge(
  options: ThreeLiveBridgeOptions,
): AttachedThreeLiveBridge {
  if (typeof EventSource === "undefined" || typeof fetch === "undefined") {
    throw new Error("attachThreeLiveBridge() requires browser EventSource and fetch APIs.");
  }

  const baseUrl = normalizeBaseUrl(options.url ?? DEFAULT_LIVE_URL);
  const source = new EventSource(`${baseUrl}/runtime/events`);
  let statusValue: ThreeLiveBridgeStatus = "connecting";
  let destroyed = false;

  const setStatus = (status: ThreeLiveBridgeStatus): void => {
    if (statusValue === status) return;
    statusValue = status;
    options.onStatusChange?.(status);
  };

  source.addEventListener("open", () => setStatus("connected"));
  source.addEventListener("error", () => {
    if (!destroyed) setStatus(source.readyState === EventSource.CLOSED ? "disconnected" : "error");
  });
  source.addEventListener("capture", (event) => {
    void handleCaptureEvent(event, options.controller, baseUrl);
  });
  source.addEventListener("performance", (event) => {
    void handlePerformanceEvent(event, options.renderer, baseUrl);
  });

  return {
    url: baseUrl,
    get status() {
      return statusValue;
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      source.close();
      setStatus("disconnected");
    },
  };
}

async function handleCaptureEvent(
  event: Event,
  controller: ThreeDevtoolsController,
  baseUrl: string,
): Promise<void> {
  if (!(event instanceof MessageEvent)) return;

  let request: LiveCaptureRequest;
  try {
    request = parseLiveCaptureRequest(JSON.parse(String(event.data)));
  } catch {
    return;
  }

  let response: LiveCaptureSuccess | LiveCaptureFailure;
  try {
    const scene = controller.capture({
      ...(request.options.includeInvisible !== undefined
        ? { includeInvisible: request.options.includeInvisible }
        : {}),
      ...(request.options.includeBounds !== undefined
        ? { includeBounds: request.options.includeBounds }
        : {}),
    });
    response = {
      protocol: LIVE_PROTOCOL_VERSION,
      requestId: request.requestId,
      ok: true,
      scene,
    };
  } catch (error) {
    response = failure(request.requestId, error);
  }

  await postRuntimeResponse(`${baseUrl}/runtime/respond`, response);
}

async function handlePerformanceEvent(
  event: Event,
  renderer: WebGLRenderer | undefined,
  baseUrl: string,
): Promise<void> {
  if (!(event instanceof MessageEvent)) return;

  let request: LivePerformanceRequest;
  try {
    request = parseLivePerformanceRequest(JSON.parse(String(event.data)));
  } catch {
    return;
  }

  let response: LivePerformanceSuccess | LivePerformanceFailure;
  try {
    if (!renderer) {
      throw new Error(
        "SceneCheck live performance requires renderer in attachThreeLiveBridge({ renderer }).",
      );
    }
    response = {
      protocol: LIVE_PROTOCOL_VERSION,
      requestId: request.requestId,
      ok: true,
      performance: await sampleThreePerformance(renderer, {
        frames: request.options.frames,
      }),
    };
  } catch (error) {
    response = failure(request.requestId, error);
  }

  await postRuntimeResponse(`${baseUrl}/runtime/performance-respond`, response);
}

function failure(
  requestId: string,
  error: unknown,
): LiveCaptureFailure | LivePerformanceFailure {
  return {
    protocol: LIVE_PROTOCOL_VERSION,
    requestId,
    ok: false,
    error: error instanceof Error ? error.message : String(error),
  };
}

async function postRuntimeResponse(url: string, response: unknown): Promise<void> {
  try {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(response),
    });
  } catch {
    // The server may have stopped while work was running. A later request can retry.
  }
}

function normalizeBaseUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`Invalid SceneCheck live URL: ${value}`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("SceneCheck live URL must use http or https.");
  }
  url.pathname = url.pathname.replace(/\/+$/, "");
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}
