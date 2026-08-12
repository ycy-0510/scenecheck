import {
  DEFAULT_LIVE_URL,
  measureAabbRelation,
  measureAabbSize,
  measureAngle,
  measureDistance,
} from "@scenecheck/core";
import { captureLiveScene } from "./live-client.js";

type MeasureOperation = "distance" | "angle" | "aabb" | "bounds";

interface LiveMeasureOptions {
  operation: MeasureOperation;
  url: string;
  from?: string;
  to?: string;
  node?: string;
  pretty: boolean;
  includeInvisible: boolean;
}

export async function runLiveMeasureCommand(args: readonly string[]): Promise<void> {
  const options = parseLiveMeasureArgs(args);
  const needsBounds = options.operation === "aabb" || options.operation === "bounds";
  const scene = await captureLiveScene(options.url, {
    includeInvisible: options.includeInvisible,
    includeBounds: needsBounds,
  });

  let result: unknown;
  if (options.operation === "distance") {
    result = measureDistance(scene, options.from!, options.to!);
  } else if (options.operation === "angle") {
    result = measureAngle(scene, options.from!, options.to!);
  } else if (options.operation === "aabb") {
    result = measureAabbRelation(scene, options.from!, options.to!);
  } else {
    result = measureAabbSize(scene, options.node!);
  }

  process.stdout.write(`${JSON.stringify(result, null, options.pretty ? 2 : undefined)}\n`);
}

function parseLiveMeasureArgs(args: readonly string[]): LiveMeasureOptions {
  const operation = args[0];
  if (
    operation !== "distance" &&
    operation !== "angle" &&
    operation !== "aabb" &&
    operation !== "bounds"
  ) {
    throw new Error(
      "live measure requires an operation: distance, angle, aabb, or bounds.",
    );
  }

  let url = DEFAULT_LIVE_URL;
  let from: string | undefined;
  let to: string | undefined;
  let node: string | undefined;
  let pretty = false;
  let includeInvisible = true;

  for (let index = 1; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg) continue;
    if (arg === "--url") {
      url = requireValue(args, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--pretty") {
      pretty = true;
      continue;
    }
    if (arg === "--exclude-invisible") {
      includeInvisible = false;
      continue;
    }
    if (arg === "--from" || arg === "--to" || arg === "--node") {
      const value = requireValue(args, index, arg);
      if (arg === "--from") from = value;
      else if (arg === "--to") to = value;
      else node = value;
      index += 1;
      continue;
    }
    throw new Error(`Unknown live measure option: ${arg}`);
  }

  if (operation === "bounds") {
    if (!node) throw new Error("live measure bounds requires --node <node-id>.");
    return { operation, url, node, pretty, includeInvisible };
  }

  if (!from || !to) {
    const kind = operation === "aabb" ? "node IDs" : "references";
    throw new Error(
      `live measure ${operation} requires both --from and --to ${kind}.`,
    );
  }

  return { operation, url, from, to, pretty, includeInvisible };
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
