import assert from "node:assert/strict";
import { get } from "node:http";
import { test } from "node:test";
import { LIVE_PROTOCOL_VERSION } from "@scenecheck/core";
import { sampleLivePerformance } from "../dist/live-client.js";
import { startSceneCheckLiveServer } from "../dist/live-server.js";

const runtimeOrigin = "http://scenecheck-performance.test";
const performance = {
  kind: "runtime-performance" as const,
  frameCadence: {
    source: "requestAnimationFrame" as const,
    samples: 3,
    durationMs: 48,
    minMs: 16,
    averageMs: 16,
    medianMs: 16,
    p95Ms: 16,
    maxMs: 16,
    rafFps: 62.5,
    over16_7Ms: 0,
    over33_3Ms: 0,
  },
  renderer: {
    adapter: "three-webglrenderer" as const,
    infoAutoReset: true,
    frame: 7,
    calls: 12,
    triangles: 6000,
    lines: 0,
    points: 0,
    geometries: 4,
    textures: 2,
    programs: 3,
  },
  gpuTimeMeasured: false as const,
};

test("live server relays an on-demand performance sample independently of scene capture", async () => {
  const live = await startSceneCheckLiveServer({
    port: 0,
    allowedOrigins: [runtimeOrigin],
    performanceTimeoutMs: 2_000,
  });
  const runtime = await connectFakeRuntime(live.url);

  try {
    const samplePromise = sampleLivePerformance(live.url, { frames: 3 });
    const request = await runtime.nextPerformance();
    assert.equal(request.type, "performance");
    assert.equal(request.options.frames, 3);

    const runtimeResponse = await fetch(`${live.url}/runtime/performance-respond`, {
      method: "POST",
      headers: {
        origin: runtimeOrigin,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        protocol: LIVE_PROTOCOL_VERSION,
        requestId: request.requestId,
        ok: true,
        performance,
      }),
    });
    assert.equal(runtimeResponse.status, 202);
    assert.deepEqual(await samplePromise, performance);

    const status = await fetch(`${live.url}/status`).then((response) => response.json());
    assert.equal(status.pendingPerformance, 0);
  } finally {
    runtime.close();
    await live.close();
  }
});

test("browser-originated performance requests are rejected", async () => {
  const live = await startSceneCheckLiveServer({ port: 0 });
  try {
    const response = await fetch(`${live.url}/performance`, {
      method: "POST",
      headers: {
        origin: "http://evil.example",
        "content-type": "application/json",
      },
      body: JSON.stringify({ frames: 1 }),
    });
    assert.equal(response.status, 403);
  } finally {
    await live.close();
  }
});

interface PerformanceEvent {
  type: "performance";
  requestId: string;
  options: { frames: number };
}

async function connectFakeRuntime(url: string): Promise<{
  nextPerformance(): Promise<PerformanceEvent>;
  close(): void;
}> {
  let buffer = "";
  let pendingResolve: ((value: PerformanceEvent) => void) | undefined;
  const queued: PerformanceEvent[] = [];

  const request = get(`${url}/runtime/events`, {
    headers: { origin: runtimeOrigin },
  });
  const response = await new Promise<import("node:http").IncomingMessage>(
    (resolve, reject) => {
      request.once("response", resolve);
      request.once("error", reject);
    },
  );
  assert.equal(response.statusCode, 200);

  response.setEncoding("utf8");
  response.on("data", (chunk: string) => {
    buffer += chunk;
    for (;;) {
      const end = buffer.indexOf("\n\n");
      if (end < 0) break;
      const block = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      if (!block.startsWith("event: performance\n")) continue;
      const dataLine = block.split("\n").find((line) => line.startsWith("data: "));
      if (!dataLine) continue;
      const event = JSON.parse(dataLine.slice(6)) as PerformanceEvent;
      if (pendingResolve) {
        const resolve = pendingResolve;
        pendingResolve = undefined;
        resolve(event);
      } else {
        queued.push(event);
      }
    }
  });

  return {
    nextPerformance() {
      const queuedEvent = queued.shift();
      if (queuedEvent) return Promise.resolve(queuedEvent);
      return new Promise<PerformanceEvent>((resolve) => {
        pendingResolve = resolve;
      });
    },
    close() {
      response.destroy();
      request.destroy();
    },
  };
}
