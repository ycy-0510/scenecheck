import assert from "node:assert/strict";
import { test } from "node:test";
import {
  parseRuntimePerformanceSnapshot,
  summarizeFrameIntervals,
} from "../dist/index.js";

test("frame cadence summarizes average, percentile, and slow-frame counts", () => {
  const result = summarizeFrameIntervals([8, 10, 16, 20, 40]);

  assert.equal(result.source, "requestAnimationFrame");
  assert.equal(result.samples, 5);
  assert.equal(result.durationMs, 94);
  assert.equal(result.averageMs, 18.8);
  assert.equal(result.medianMs, 16);
  assert.equal(result.p95Ms, 40);
  assert.equal(result.maxMs, 40);
  assert.equal(result.over16_7Ms, 2);
  assert.equal(result.over33_3Ms, 1);
  assert.ok(Math.abs(result.rafFps - 1000 / 18.8) < 1e-9);
});

test("performance snapshots explicitly refuse fake GPU timing claims", () => {
  const value = {
    kind: "runtime-performance",
    frameCadence: {
      source: "requestAnimationFrame",
      samples: 2,
      durationMs: 32,
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
      frame: 10,
      calls: 20,
      triangles: 300,
      lines: 0,
      points: 0,
      geometries: 5,
      textures: 2,
      programs: 3,
    },
    gpuTimeMeasured: false,
  };

  assert.deepEqual(parseRuntimePerformanceSnapshot(value), value);
  assert.throws(
    () => parseRuntimePerformanceSnapshot({ ...value, gpuTimeMeasured: true }),
    /gpuTimeMeasured=false/i,
  );
});

test("frame cadence rejects non-finite input", () => {
  assert.throws(() => summarizeFrameIntervals([]), /at least one/i);
  assert.throws(() => summarizeFrameIntervals([16, Number.POSITIVE_INFINITY]), /finite/i);
});
