import assert from "node:assert/strict";
import { test } from "node:test";
import { sampleThreePerformance } from "../dist/index.js";

function fakeRenderer() {
  return {
    info: {
      autoReset: true,
      memory: { geometries: 17, textures: 9 },
      render: {
        frame: 42,
        calls: 31,
        triangles: 123456,
        lines: 12,
        points: 3,
      },
      programs: [{}, {}, {}],
    },
  };
}

function scheduler(stepMs) {
  let timestamp = 0;
  return (callback) => {
    queueMicrotask(() => {
      timestamp += stepMs;
      callback(timestamp);
    });
    return 1;
  };
}

test("Three performance sampler combines RAF cadence with renderer.info counters", async () => {
  const result = await sampleThreePerformance(fakeRenderer(), {
    frames: 4,
    requestFrame: scheduler(16),
  });

  assert.equal(result.kind, "runtime-performance");
  assert.equal(result.gpuTimeMeasured, false);
  assert.equal(result.frameCadence.samples, 4);
  assert.equal(result.frameCadence.averageMs, 16);
  assert.equal(result.frameCadence.rafFps, 62.5);
  assert.deepEqual(result.renderer, {
    adapter: "three-webglrenderer",
    infoAutoReset: true,
    frame: 42,
    calls: 31,
    triangles: 123456,
    lines: 12,
    points: 3,
    geometries: 17,
    textures: 9,
    programs: 3,
  });
});

test("Three performance sampler enforces a bounded on-demand sample window", async () => {
  await assert.rejects(
    () => sampleThreePerformance(fakeRenderer(), { frames: 0, requestFrame: scheduler(16) }),
    /integer from 1/i,
  );
  await assert.rejects(
    () => sampleThreePerformance(fakeRenderer(), { frames: 601, requestFrame: scheduler(16) }),
    /integer from 1/i,
  );
});
