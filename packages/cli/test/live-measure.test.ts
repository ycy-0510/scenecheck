import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const cli = fileURLToPath(new URL("../dist/cli.js", import.meta.url));

const identityRotation = [0, 0, 0, 1];
const identityScale = [1, 1, 1];
const scene = {
  version: 1,
  roots: ["a", "b"],
  nodes: {
    a: {
      id: "a",
      type: "Mesh",
      children: [],
      localTransform: { position: [0, 0, 0], rotation: identityRotation, scale: identityScale },
      worldTransform: { position: [0, 0, 0], rotation: identityRotation, scale: identityScale },
      bounds: { min: [-1, -1, -1], max: [1, 1, 1] },
    },
    b: {
      id: "b",
      type: "Mesh",
      children: [],
      localTransform: { position: [3, 4, 0], rotation: identityRotation, scale: identityScale },
      worldTransform: { position: [3, 4, 0], rotation: identityRotation, scale: identityScale },
      bounds: { min: [2, 3, -1], max: [4, 5, 1] },
    },
  },
};

test("built CLI measures distance from current live scene without bounds", async () => {
  const captureBodies: unknown[] = [];
  const server = await startCaptureServer(captureBodies);
  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, [
      cli,
      "live",
      "measure",
      "distance",
      "--from",
      "a",
      "--to",
      "b",
      "--url",
      server.url,
    ]);
    assert.equal(stderr, "");
    assert.equal(JSON.parse(stdout).distance, 5);
    assert.deepEqual(captureBodies, [
      { includeInvisible: true, includeBounds: false },
    ]);
  } finally {
    await server.close();
  }
});

test("live AABB measurement requests bounds only when required", async () => {
  const captureBodies: unknown[] = [];
  const server = await startCaptureServer(captureBodies);
  try {
    const { stdout } = await execFileAsync(process.execPath, [
      cli,
      "live",
      "measure",
      "aabb",
      "--from",
      "a",
      "--to",
      "b",
      "--url",
      server.url,
    ]);
    const result = JSON.parse(stdout);
    assert.equal(result.intersects, false);
    assert.equal(result.distance, 1);
    assert.deepEqual(captureBodies, [
      { includeInvisible: true, includeBounds: true },
    ]);
  } finally {
    await server.close();
  }
});

async function startCaptureServer(captureBodies: unknown[]): Promise<{
  url: string;
  close(): Promise<void>;
}> {
  const server = createServer(async (request, response) => {
    if (request.method !== "POST" || request.url !== "/capture") {
      response.writeHead(404).end();
      return;
    }
    let body = "";
    for await (const chunk of request) body += chunk;
    captureBodies.push(JSON.parse(body));
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify(scene));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}
