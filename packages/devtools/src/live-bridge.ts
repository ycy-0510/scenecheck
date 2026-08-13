import {
  DEFAULT_LIVE_URL,
  LIVE_PROTOCOL_VERSION,
  parseLiveCaptureRequest,
  type LiveCaptureFailure,
  type LiveCaptureRequest,
  type LiveCaptureSuccess,
} from "@scenecheck/core";
import { ThreeDevtoolsController } from "./controller.js";

export type ThreeLiveBridgeStatus = "connecting" | "connected" | "disconnected" | "error";

export interface ThreeLiveBridgeOptions {
  controller: ThreeDevtoolsController;
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
 * The scene is only traversed when a capture event arrives.
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
    response = {
      protocol: LIVE_PROTOCOL_VERSION,
      requestId: request.requestId,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  try {
    await fetch(`${baseUrl}/runtime/respond`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(response),
    });
  } catch {
    // The server may have stopped while capture was running. A later request can retry.
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
