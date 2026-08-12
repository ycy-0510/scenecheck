export interface BrowserFrameCadence {
  /** Timing source. This is browser scheduling cadence, not GPU execution time. */
  source: "requestAnimationFrame";
  samples: number;
  durationMs: number;
  minMs: number;
  averageMs: number;
  medianMs: number;
  p95Ms: number;
  maxMs: number;
  /** 1000 / averageMs. This is an RAF cadence estimate, not a renderer FPS guarantee. */
  rafFps: number;
  over16_7Ms: number;
  over33_3Ms: number;
}

export interface RendererPerformanceCounters {
  adapter: "three-webglrenderer";
  /** Three.js renderer.info.render.frame at snapshot time. */
  frame: number;
  calls: number;
  triangles: number;
  lines: number;
  points: number;
  geometries: number;
  textures: number;
  programs?: number;
}

export interface RuntimePerformanceSnapshot {
  kind: "runtime-performance";
  frameCadence: BrowserFrameCadence;
  renderer: RendererPerformanceCounters;
  /** Explicitly prevents consumers from treating RAF cadence as GPU timing. */
  gpuTimeMeasured: false;
}

export function summarizeFrameIntervals(
  intervals: readonly number[],
): BrowserFrameCadence {
  if (intervals.length === 0) {
    throw new Error("SceneCheck performance sampling requires at least one frame interval.");
  }
  for (const interval of intervals) {
    if (!Number.isFinite(interval) || interval < 0) {
      throw new Error(
        `SceneCheck frame intervals must be finite non-negative numbers. Received: ${interval}`,
      );
    }
  }

  const sorted = [...intervals].sort((a, b) => a - b);
  const durationMs = intervals.reduce((sum, value) => sum + value, 0);
  const averageMs = durationMs / intervals.length;
  const medianMs = percentile(sorted, 0.5);
  const p95Ms = percentile(sorted, 0.95);

  return {
    source: "requestAnimationFrame",
    samples: intervals.length,
    durationMs,
    minMs: sorted[0]!,
    averageMs,
    medianMs,
    p95Ms,
    maxMs: sorted[sorted.length - 1]!,
    rafFps: averageMs > 0 ? 1000 / averageMs : 0,
    over16_7Ms: intervals.filter((value) => value > 16.7).length,
    over33_3Ms: intervals.filter((value) => value > 33.3).length,
  };
}

export function parseRuntimePerformanceSnapshot(
  value: unknown,
): RuntimePerformanceSnapshot {
  if (!isRecord(value) || value.kind !== "runtime-performance") {
    throw new Error("SceneCheck runtime performance snapshot has an invalid kind.");
  }
  if (value.gpuTimeMeasured !== false) {
    throw new Error("SceneCheck runtime performance snapshot must explicitly report gpuTimeMeasured=false.");
  }
  if (!isRecord(value.frameCadence) || value.frameCadence.source !== "requestAnimationFrame") {
    throw new Error("SceneCheck runtime performance snapshot has invalid frame cadence data.");
  }
  if (!isRecord(value.renderer) || value.renderer.adapter !== "three-webglrenderer") {
    throw new Error("SceneCheck runtime performance snapshot has invalid renderer counters.");
  }

  const cadence: BrowserFrameCadence = {
    source: "requestAnimationFrame",
    samples: requireNonNegativeInteger(value.frameCadence.samples, "frameCadence.samples"),
    durationMs: requireNonNegativeNumber(value.frameCadence.durationMs, "frameCadence.durationMs"),
    minMs: requireNonNegativeNumber(value.frameCadence.minMs, "frameCadence.minMs"),
    averageMs: requireNonNegativeNumber(value.frameCadence.averageMs, "frameCadence.averageMs"),
    medianMs: requireNonNegativeNumber(value.frameCadence.medianMs, "frameCadence.medianMs"),
    p95Ms: requireNonNegativeNumber(value.frameCadence.p95Ms, "frameCadence.p95Ms"),
    maxMs: requireNonNegativeNumber(value.frameCadence.maxMs, "frameCadence.maxMs"),
    rafFps: requireNonNegativeNumber(value.frameCadence.rafFps, "frameCadence.rafFps"),
    over16_7Ms: requireNonNegativeInteger(value.frameCadence.over16_7Ms, "frameCadence.over16_7Ms"),
    over33_3Ms: requireNonNegativeInteger(value.frameCadence.over33_3Ms, "frameCadence.over33_3Ms"),
  };
  if (cadence.samples < 1) {
    throw new Error("SceneCheck frameCadence.samples must be at least 1.");
  }

  const renderer: RendererPerformanceCounters = {
    adapter: "three-webglrenderer",
    frame: requireNonNegativeInteger(value.renderer.frame, "renderer.frame"),
    calls: requireNonNegativeInteger(value.renderer.calls, "renderer.calls"),
    triangles: requireNonNegativeInteger(value.renderer.triangles, "renderer.triangles"),
    lines: requireNonNegativeInteger(value.renderer.lines, "renderer.lines"),
    points: requireNonNegativeInteger(value.renderer.points, "renderer.points"),
    geometries: requireNonNegativeInteger(value.renderer.geometries, "renderer.geometries"),
    textures: requireNonNegativeInteger(value.renderer.textures, "renderer.textures"),
    ...(value.renderer.programs !== undefined
      ? { programs: requireNonNegativeInteger(value.renderer.programs, "renderer.programs") }
      : {}),
  };

  return {
    kind: "runtime-performance",
    frameCadence: cadence,
    renderer,
    gpuTimeMeasured: false,
  };
}

function percentile(sorted: readonly number[], fraction: number): number {
  const index = Math.max(
    0,
    Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1),
  );
  return sorted[index]!;
}

function requireNonNegativeNumber(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`SceneCheck ${path} must be a finite non-negative number.`);
  }
  return value;
}

function requireNonNegativeInteger(value: unknown, path: string): number {
  const result = requireNonNegativeNumber(value, path);
  if (!Number.isInteger(result)) {
    throw new Error(`SceneCheck ${path} must be an integer.`);
  }
  return result;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
