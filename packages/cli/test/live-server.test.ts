import assert from "node:assert/strict";
import { get } from "node:http";
import { test } from "node:test";
import { LIVE_PROTOCOL_VERSION } from "@scenecheck/core";
import { captureLiveScene, getLiveStatus } from "../dist/live-client.js";
import { startSceneCheckLiveServer } from "../dist/live-server.js";

const runtimeOrigin = "http://scenecheck.test";

const scene = {
  version: 1 as const,
  roots: ["world"],
  nodes: {
    world: {
      id: "world",
      type: "Scene",
      children: [],
      localTransform: {
        position: [0, 0, 0] as const,
        rotation: [0, 0, 0, 1] as const,
        scale: [1, 1, 1] as const,
      },
      worldTransform: {
        position: [0, 0, 0] as const,
        rotation: [0, 0, 0, 1] as const,
        scale: [1, 1, 1] as const,
      },
    },
  },
};

test("live server captures only when an agent requests current Scene IR", async () => {
  const live = await startSceneCheckLiveServer({
    port: 0,
    allowedOrigins: [runtimeOrigin],
    captureTimeoutMs: 2_000,
  });
  const runtime = await connectFakeRuntime(live.url);

  try {
    const status = await getLiveStatus(live.url);
    assert.equal(status.runtimeConnected, true);
    assert.equal(status.pendingCaptures, 0);

    const capturePromise = captureLiveScene(live.url, {
      includeInvisible: true,
      includeBounds: false,
    });
    const request = await runtime.nextCapture();
    assert.equal(request.type, "capture");
    assert.equal(request.options.includeBounds, false);
    assert.equal(request.options.includeInvisible, true);

    const runtimeResponse = await fetch(`${live.url}/runtime/respond`, {
      method: "POST",
      headers: {
        origin: runtimeOrigin,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        protocol: LIVE_PROTOCOL_VERSION,
        requestId: request.requestId,
        ok: true,
        scene,
      }),
    });
    assert.equal(runtimeResponse.status, 202);

    assert.deepEqual(await capturePromise, scene);

    const browserCapture = await fetch(`${live.url}/capture`, {
      method: "POST",
      headers: {
        origin: "http://evil.example",
        "content-type": "application/json",
      },
      body: "{}",
    });
    assert.equal(browserCapture.status, 403);
  } finally {
    runtime.close();
    await live.close();
  }
});

test("runtime event endpoint rejects origins outside the allowlist", async () => {
  const live = await startSceneCheckLiveServer({
    port: 0,
    allowedOrigins: [runtimeOrigin],
  });
  try {
    const response = await fetch(`${live.url}/runtime/events`, {
      headers: { origin: "https://evil.example" },
    });
    assert.equal(response.status, 403);
  } finally {
    await live.close();
  }
});

interface CaptureEvent {
  type: "capture";
  requestId: string;
  options: { includeInvisible?: boolean; includeBounds?: boolean };
}

async function connectFakeRuntime(url: string): Promise<{
  nextCapture(): Promise<CaptureEvent>;
  close(): void;
}> {
  let buffer = "";
  let pendingResolve: ((value: CaptureEvent) => void) | undefined;
  const queued: CaptureEvent[] = [];

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
      if (!block.startsWith("event: capture\n")) continue;
      const dataLine = block.split("\n").find((line) => line.startsWith("data: "));
      if (!dataLine) continue;
      const event = JSON.parse(dataLine.slice(6)) as CaptureEvent;
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
    nextCapture() {
      const queuedEvent = queued.shift();
      if (queuedEvent) return Promise.resolve(queuedEvent);
      return new Promise<CaptureEvent>((resolve) => {
        pendingResolve = resolve;
      });
    },
    close() {
      response.destroy();
      request.destroy();
    },
  };
}
