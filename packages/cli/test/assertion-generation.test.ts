import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const cli = fileURLToPath(new URL("../dist/cli.js", import.meta.url));
const provider = fileURLToPath(new URL("./fixtures/annotation-scene.ts", import.meta.url));

test("built CLI freezes resolved provider annotation world pose into literal assertion", async () => {
  const { stdout, stderr } = await execFileAsync(process.execPath, [
    cli,
    "assertion",
    "from-annotation",
    provider,
    "--annotation",
    "target",
    "--target",
    "tunnel",
    "--position-tolerance",
    "0.05",
    "--rotation-tolerance-degrees",
    "2",
  ]);
  const result = JSON.parse(stdout) as {
    id: string;
    type: string;
    target: string;
    position: number[];
    positionTolerance: number;
    rotation: number[];
    rotationToleranceDegrees: number;
  };

  assert.equal(stderr, "");
  assert.equal(result.id, "target-frozen-pose");
  assert.equal(result.type, "pose");
  assert.equal(result.target, "tunnel");
  assert.deepEqual(result.position.map(round), [8, 0, 0]);
  assert.equal(result.positionTolerance, 0.05);
  assert.deepEqual(result.rotation.map(round), [0, round(Math.SQRT1_2), 0, round(Math.SQRT1_2)]);
  assert.equal(result.rotationToleranceDegrees, 2);
});

test("built CLI can freeze only position when orientation is irrelevant", async () => {
  const { stdout } = await execFileAsync(process.execPath, [
    cli,
    "assertion",
    "from-annotation",
    provider,
    "--annotation",
    "annotation:target",
    "--target",
    "tunnel",
    "--position-tolerance",
    "0.1",
    "--id",
    "tunnel-target-position",
  ]);
  const result = JSON.parse(stdout) as Record<string, unknown>;

  assert.equal(result.id, "tunnel-target-position");
  assert.equal(result.type, "pose");
  assert.equal(result.positionTolerance, 0.1);
  assert.equal("rotation" in result, false);
  assert.equal("rotationToleranceDegrees" in result, false);
});

test("live assertion generation freezes current marker without requesting bounds", async () => {
  const captureBodies: unknown[] = [];
  const server = await startCaptureServer(captureBodies);
  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, [
      cli,
      "live",
      "assertion",
      "from-annotation",
      "--annotation",
      "target",
      "--target",
      "door",
      "--position-tolerance",
      "0.02",
      "--rotation-tolerance-degrees",
      "1",
      "--url",
      server.url,
    ]);
    const result = JSON.parse(stdout) as {
      type: string;
      position: number[];
      rotation: number[];
    };

    assert.equal(stderr, "");
    assert.equal(result.type, "pose");
    assert.deepEqual(result.position, [1, 2, 3]);
    assert.deepEqual(result.rotation, [0, 0, 0, 1]);
    assert.deepEqual(captureBodies, [
      { includeInvisible: true, includeBounds: false },
    ]);
  } finally {
    await server.close();
  }
});

async function startCaptureServer(captureBodies: unknown[]): Promise<{
  url: string;
  close(): Promise<void>;
}> {
  const scene = {
    version: 1,
    roots: ["door"],
    nodes: {
      door: {
        id: "door",
        type: "Object3D",
        children: [],
        localTransform: {
          position: [0, 0, 0],
          rotation: [0, 0, 0, 1],
          scale: [1, 1, 1],
        },
        worldTransform: {
          position: [0, 0, 0],
          rotation: [0, 0, 0, 1],
          scale: [1, 1, 1],
        },
      },
    },
    annotations: [
      {
        id: "target",
        type: "pose",
        worldTransform: {
          position: [1, 2, 3],
          rotation: [0, 0, 0, 1],
          scale: [1, 1, 1],
        },
      },
    ],
  };

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

function round(value: number): number {
  const result = Math.round(value * 1e9) / 1e9;
  return Object.is(result, -0) ? 0 : result;
}
