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
    rafFps: averageMs > 0 ? 1000 / averageMs : Number.POSITIVE_INFINITY,
    over16_7Ms: intervals.filter((value) => value > 16.7).length,
    over33_3Ms: intervals.filter((value) => value > 33.3).length,
  };
}

function percentile(sorted: readonly number[], fraction: number): number {
  const index = Math.max(
    0,
    Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1),
  );
  return sorted[index]!;
}
