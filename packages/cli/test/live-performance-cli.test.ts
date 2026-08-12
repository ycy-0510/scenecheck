import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const cli = fileURLToPath(new URL("../dist/cli.js", import.meta.url));

const performance = {
  kind: "runtime-performance",
  frameCadence: {
    source: "requestAnimationFrame",
    samples: 5,
    durationMs: 80,
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
    adapter: "three-webglrenderer",
    infoAutoReset: true,
    frame: 99,
    calls: 44,
    triangles: 8888,
    lines: 2,
    points: 1,
    geometries: 12,
    textures: 6,
    programs: 4,
  },
  gpuTimeMeasured: false,
};

test("built CLI requests the configured performance sample window", async () => {
  const requestBodies: unknown[] = [];
  const server = createServer(async (request, response) => {
    if (request.method !== "POST" || request.url !== "/performance") {
      response.writeHead(404).end();
      return;
    }
    let body = "";
    for await (const chunk of request) body += chunk;
    requestBodies.push(JSON.parse(body));
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify(performance));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;
  const url = `http://127.0.0.1:${address.port}`;

  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, [
      cli,
      "live",
      "performance",
      "--frames",
      "5",
      "--url",
      url,
    ]);
    assert.equal(stderr, "");
    assert.deepEqual(JSON.parse(stdout), performance);
    assert.deepEqual(requestBodies, [{ frames: 5 }]);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
