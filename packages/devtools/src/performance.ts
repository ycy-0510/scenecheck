import {
  MAX_PERFORMANCE_FRAME_SAMPLES,
  summarizeFrameIntervals,
  type RuntimePerformanceSnapshot,
} from "@scenecheck/core";
import type { WebGLRenderer } from "three";

export interface ThreePerformanceSampleOptions {
  frames?: number;
  /** Test/custom scheduler hook. Browser code normally leaves this undefined. */
  requestFrame?: (callback: FrameRequestCallback) => number;
}

/**
 * Sample browser RAF cadence on demand and snapshot Three.js renderer.info counters.
 * RAF cadence is main-thread/browser scheduling evidence, not GPU execution time.
 */
export async function sampleThreePerformance(
  renderer: WebGLRenderer,
  options: ThreePerformanceSampleOptions = {},
): Promise<RuntimePerformanceSnapshot> {
  const frames = normalizeFrames(options.frames ?? 60);
  if (
    typeof document !== "undefined" &&
    document.visibilityState === "hidden" &&
    options.requestFrame === undefined
  ) {
    throw new Error(
      "SceneCheck performance sampling requires a visible browser page because hidden tabs throttle requestAnimationFrame.",
    );
  }

  const requestFrame = options.requestFrame ?? globalThis.requestAnimationFrame?.bind(globalThis);
  if (!requestFrame) {
    throw new Error("SceneCheck performance sampling requires requestAnimationFrame.");
  }

  const intervals = await collectFrameIntervals(frames, requestFrame);
  const info = renderer.info as RendererInfoLike;
  const programs = Array.isArray(info.programs) ? info.programs.length : undefined;

  return {
    kind: "runtime-performance",
    frameCadence: summarizeFrameIntervals(intervals),
    renderer: {
      adapter: "three-webglrenderer",
      infoAutoReset: info.autoReset === true,
      frame: finiteNonNegativeInteger(info.render?.frame),
      calls: finiteNonNegativeInteger(info.render?.calls),
      triangles: finiteNonNegativeInteger(info.render?.triangles),
      lines: finiteNonNegativeInteger(info.render?.lines),
      points: finiteNonNegativeInteger(info.render?.points),
      geometries: finiteNonNegativeInteger(info.memory?.geometries),
      textures: finiteNonNegativeInteger(info.memory?.textures),
      ...(programs !== undefined ? { programs } : {}),
    },
    gpuTimeMeasured: false,
  };
}

async function collectFrameIntervals(
  samples: number,
  requestFrame: (callback: FrameRequestCallback) => number,
): Promise<number[]> {
  return new Promise<number[]>((resolve) => {
    const intervals: number[] = [];
    let previous: number | undefined;

    const tick: FrameRequestCallback = (timestamp) => {
      if (previous !== undefined) {
        intervals.push(Math.max(0, timestamp - previous));
        if (intervals.length >= samples) {
          resolve(intervals);
          return;
        }
      }
      previous = timestamp;
      requestFrame(tick);
    };

    requestFrame(tick);
  });
}

function normalizeFrames(value: number): number {
  if (
    !Number.isInteger(value) ||
    value < 1 ||
    value > MAX_PERFORMANCE_FRAME_SAMPLES
  ) {
    throw new Error(
      `SceneCheck performance frames must be an integer from 1 to ${MAX_PERFORMANCE_FRAME_SAMPLES}.`,
    );
  }
  return value;
}

function finiteNonNegativeInteger(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : 0;
}

interface RendererInfoLike {
  autoReset?: boolean;
  memory?: {
    geometries?: number;
    textures?: number;
  };
  render?: {
    frame?: number;
    calls?: number;
    triangles?: number;
    lines?: number;
    points?: number;
  };
  programs?: readonly unknown[] | null;
}
