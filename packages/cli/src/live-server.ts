import { randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import {
  DEFAULT_LIVE_PORT,
  LIVE_PROTOCOL_VERSION,
  parseLiveCaptureOptions,
  parseLiveCaptureResponse,
  parseLivePerformanceOptions,
  parseLivePerformanceResponse,
  type LiveCaptureRequest,
  type LivePerformanceRequest,
} from "@scenecheck/core";

const MAX_RUNTIME_RESPONSE_BYTES = 64 * 1024 * 1024;
const MAX_AGENT_REQUEST_BYTES = 8 * 1024;
const DEFAULT_CAPTURE_TIMEOUT_MS = 15_000;
const DEFAULT_PERFORMANCE_TIMEOUT_MS = 20_000;

export interface SceneCheckLiveServerOptions {
  port?: number;
  allowedOrigins?: readonly string[];
  captureTimeoutMs?: number;
  performanceTimeoutMs?: number;
}

export interface RunningSceneCheckLiveServer {
  server: Server;
  host: "127.0.0.1";
  port: number;
  url: string;
  close(): Promise<void>;
}

interface PendingRequest {
  response: ServerResponse;
  timeout: NodeJS.Timeout;
}

/** Start the read-only live bridge. It always binds to IPv4 loopback. */
export async function startSceneCheckLiveServer(
  options: SceneCheckLiveServerOptions = {},
): Promise<RunningSceneCheckLiveServer> {
  const port = normalizePort(options.port ?? DEFAULT_LIVE_PORT);
  const allowedOrigins = new Set(options.allowedOrigins ?? []);
  const captureTimeoutMs = normalizeTimeout(
    options.captureTimeoutMs ?? DEFAULT_CAPTURE_TIMEOUT_MS,
  );
  const performanceTimeoutMs = normalizeTimeout(
    options.performanceTimeoutMs ?? DEFAULT_PERFORMANCE_TIMEOUT_MS,
  );

  let runtime: ServerResponse | undefined;
  let runtimePing: NodeJS.Timeout | undefined;
  const pendingCaptures = new Map<string, PendingRequest>();
  const pendingPerformance = new Map<string, PendingRequest>();

  const failPendingMap = (
    pending: Map<string, PendingRequest>,
    message: string,
    status = 503,
  ): void => {
    for (const [requestId, item] of pending) {
      clearTimeout(item.timeout);
      if (!item.response.headersSent) {
        sendJson(item.response, status, { error: message, requestId });
      } else {
        item.response.end();
      }
    }
    pending.clear();
  };

  const failAllPending = (message: string, status = 503): void => {
    failPendingMap(pendingCaptures, message, status);
    failPendingMap(pendingPerformance, message, status);
  };

  const detachRuntime = (response?: ServerResponse): void => {
    if (response && runtime !== response) return;
    if (runtimePing) clearInterval(runtimePing);
    runtimePing = undefined;
    runtime = undefined;
    failAllPending("SceneCheck live runtime disconnected.");
  };

  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");

      if (request.method === "GET" && url.pathname === "/status") {
        sendJson(response, 200, {
          protocol: LIVE_PROTOCOL_VERSION,
          runtimeConnected: runtime !== undefined,
          pendingCaptures: pendingCaptures.size,
          pendingPerformance: pendingPerformance.size,
        });
        return;
      }

      if (request.method === "GET" && url.pathname === "/runtime/events") {
        const origin = validateRuntimeOrigin(request, allowedOrigins);
        if (!origin) {
          sendJson(response, 403, { error: "SceneCheck live runtime origin is not allowed." });
          return;
        }

        if (runtime && runtime !== response) {
          runtime.end();
          detachRuntime(runtime);
        }

        applyRuntimeCors(response, origin);
        response.writeHead(200, {
          "content-type": "text/event-stream",
          "cache-control": "no-cache, no-transform",
          connection: "keep-alive",
          "x-accel-buffering": "no",
        });
        response.write(`event: ready\ndata: ${JSON.stringify({ protocol: LIVE_PROTOCOL_VERSION })}\n\n`);
        runtime = response;
        runtimePing = setInterval(() => {
          if (runtime === response && !response.destroyed) response.write(": ping\n\n");
        }, 20_000);
        runtimePing.unref?.();
        request.on("close", () => detachRuntime(response));
        return;
      }

      if (
        request.method === "OPTIONS" &&
        (url.pathname === "/runtime/respond" ||
          url.pathname === "/runtime/performance-respond")
      ) {
        const origin = validateRuntimeOrigin(request, allowedOrigins);
        if (!origin) {
          response.writeHead(403).end();
          return;
        }
        applyRuntimeCors(response, origin);
        response.writeHead(204, {
          "access-control-allow-methods": "POST, OPTIONS",
          "access-control-allow-headers": "content-type",
          "access-control-max-age": "600",
        });
        response.end();
        return;
      }

      if (request.method === "POST" && url.pathname === "/runtime/respond") {
        const origin = validateRuntimeOrigin(request, allowedOrigins);
        if (!origin) {
          sendJson(response, 403, { error: "SceneCheck live runtime origin is not allowed." });
          return;
        }
        applyRuntimeCors(response, origin);
        const payload = parseLiveCaptureResponse(
          JSON.parse(await readBody(request, MAX_RUNTIME_RESPONSE_BYTES)),
        );
        const item = pendingCaptures.get(payload.requestId);
        if (!item) {
          sendJson(response, 404, { error: "SceneCheck live capture request is no longer pending." });
          return;
        }

        pendingCaptures.delete(payload.requestId);
        clearTimeout(item.timeout);
        if (payload.ok) sendJson(item.response, 200, payload.scene);
        else sendJson(item.response, 502, { error: payload.error });
        sendJson(response, 202, { accepted: true });
        return;
      }

      if (
        request.method === "POST" &&
        url.pathname === "/runtime/performance-respond"
      ) {
        const origin = validateRuntimeOrigin(request, allowedOrigins);
        if (!origin) {
          sendJson(response, 403, { error: "SceneCheck live runtime origin is not allowed." });
          return;
        }
        applyRuntimeCors(response, origin);
        const payload = parseLivePerformanceResponse(
          JSON.parse(await readBody(request, MAX_RUNTIME_RESPONSE_BYTES)),
        );
        const item = pendingPerformance.get(payload.requestId);
        if (!item) {
          sendJson(response, 404, {
            error: "SceneCheck live performance request is no longer pending.",
          });
          return;
        }

        pendingPerformance.delete(payload.requestId);
        clearTimeout(item.timeout);
        if (payload.ok) sendJson(item.response, 200, payload.performance);
        else sendJson(item.response, 502, { error: payload.error });
        sendJson(response, 202, { accepted: true });
        return;
      }

      if (request.method === "POST" && url.pathname === "/capture") {
        if (!validateAgentRequest(request, response, runtime)) return;

        const raw = await readBody(request, MAX_AGENT_REQUEST_BYTES);
        const captureOptions = parseLiveCaptureOptions(raw.trim() ? JSON.parse(raw) : {});
        const requestId = randomUUID();
        const captureRequest: LiveCaptureRequest = {
          protocol: LIVE_PROTOCOL_VERSION,
          requestId,
          type: "capture",
          options: captureOptions,
        };

        pendingCaptures.set(
          requestId,
          makePendingRequest(
            pendingCaptures,
            requestId,
            response,
            captureTimeoutMs,
            "SceneCheck live capture timed out.",
          ),
        );
        runtime!.write(`event: capture\ndata: ${JSON.stringify(captureRequest)}\n\n`);
        return;
      }

      if (request.method === "POST" && url.pathname === "/performance") {
        if (!validateAgentRequest(request, response, runtime)) return;

        const raw = await readBody(request, MAX_AGENT_REQUEST_BYTES);
        const performanceOptions = parseLivePerformanceOptions(
          raw.trim() ? JSON.parse(raw) : {},
        );
        const requestId = randomUUID();
        const performanceRequest: LivePerformanceRequest = {
          protocol: LIVE_PROTOCOL_VERSION,
          requestId,
          type: "performance",
          options: performanceOptions,
        };

        pendingPerformance.set(
          requestId,
          makePendingRequest(
            pendingPerformance,
            requestId,
            response,
            performanceTimeoutMs,
            "SceneCheck live performance sampling timed out.",
          ),
        );
        runtime!.write(
          `event: performance\ndata: ${JSON.stringify(performanceRequest)}\n\n`,
        );
        return;
      }

      sendJson(response, 404, { error: "SceneCheck live endpoint not found." });
    } catch (error) {
      if (!response.headersSent) {
        sendJson(response, 400, {
          error: error instanceof Error ? error.message : String(error),
        });
      } else {
        response.end();
      }
    }
  });

  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error): void => reject(error);
    server.once("error", onError);
    server.listen(port, "127.0.0.1", () => {
      server.off("error", onError);
      resolve();
    });
  });

  const address = server.address() as AddressInfo;
  const actualPort = address.port;

  return {
    server,
    host: "127.0.0.1",
    port: actualPort,
    url: `http://127.0.0.1:${actualPort}`,
    async close() {
      if (runtimePing) clearInterval(runtimePing);
      runtimePing = undefined;
      if (runtime) runtime.end();
      runtime = undefined;
      failAllPending("SceneCheck live server stopped.", 503);
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    },
  };
}

function validateAgentRequest(
  request: IncomingMessage,
  response: ServerResponse,
  runtime: ServerResponse | undefined,
): boolean {
  // Browser-originated callers are intentionally rejected. Agent CLI requests have no Origin.
  if (request.headers.origin !== undefined) {
    sendJson(response, 403, { error: "Browser-originated live requests are not allowed." });
    return false;
  }
  if (!runtime || runtime.destroyed) {
    sendJson(response, 503, { error: "No SceneCheck browser runtime is connected." });
    return false;
  }
  return true;
}

function makePendingRequest(
  pending: Map<string, PendingRequest>,
  requestId: string,
  response: ServerResponse,
  timeoutMs: number,
  timeoutMessage: string,
): PendingRequest {
  const timeout = setTimeout(() => {
    const item = pending.get(requestId);
    if (!item) return;
    pending.delete(requestId);
    sendJson(item.response, 504, { error: timeoutMessage });
  }, timeoutMs);
  timeout.unref?.();
  return { response, timeout };
}

function validateRuntimeOrigin(
  request: IncomingMessage,
  allowedOrigins: ReadonlySet<string>,
): string | undefined {
  const origin = request.headers.origin;
  if (!origin) return undefined;
  if (allowedOrigins.has(origin)) return origin;

  try {
    const parsed = new URL(origin);
    if (
      (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1" || parsed.hostname === "[::1]")
    ) {
      return origin;
    }
  } catch {
    // Invalid origin is not allowed.
  }
  return undefined;
}

function applyRuntimeCors(response: ServerResponse, origin: string): void {
  response.setHeader("access-control-allow-origin", origin);
  response.setHeader("vary", "Origin");
}

async function readBody(request: IncomingMessage, limit: number): Promise<string> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += buffer.byteLength;
    if (bytes > limit) throw new Error("SceneCheck live request body is too large.");
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  if (response.destroyed || response.writableEnded) return;
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(`${JSON.stringify(body)}\n`);
}

function normalizePort(value: number): number {
  if (!Number.isInteger(value) || value < 0 || value > 65_535) {
    throw new Error(`SceneCheck live port must be an integer from 0 to 65535. Received: ${value}`);
  }
  return value;
}

function normalizeTimeout(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`SceneCheck live timeout must be positive. Received: ${value}`);
  }
  return value;
}
