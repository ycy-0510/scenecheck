import {
  DEFAULT_LIVE_URL,
  DEFAULT_PERFORMANCE_FRAME_SAMPLES,
  MAX_PERFORMANCE_FRAME_SAMPLES,
} from "@scenecheck/core";
import { sampleLivePerformance } from "./live-client.js";

export async function runLivePerformanceCommand(
  args: readonly string[],
): Promise<void> {
  let url = DEFAULT_LIVE_URL;
  let frames = DEFAULT_PERFORMANCE_FRAME_SAMPLES;
  let pretty = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg) continue;
    if (arg === "--url") {
      url = requireValue(args, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--frames") {
      const raw = requireValue(args, index, arg);
      frames = Number(raw);
      if (
        !Number.isInteger(frames) ||
        frames < 1 ||
        frames > MAX_PERFORMANCE_FRAME_SAMPLES
      ) {
        throw new Error(
          `--frames must be an integer from 1 to ${MAX_PERFORMANCE_FRAME_SAMPLES}. Received: ${raw}`,
        );
      }
      index += 1;
      continue;
    }
    if (arg === "--pretty") {
      pretty = true;
      continue;
    }
    throw new Error(`Unknown live performance option: ${arg}`);
  }

  const result = await sampleLivePerformance(url, { frames });
  process.stdout.write(`${JSON.stringify(result, null, pretty ? 2 : undefined)}\n`);
}

function requireValue(
  args: readonly string[],
  index: number,
  flag: string,
): string {
  const value = args[index + 1];
  if (!value || value.startsWith("-")) throw new Error(`${flag} requires a value.`);
  return value;
}
