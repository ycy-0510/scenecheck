import {
  measureAabbRelation,
  measureAabbSize,
  measureAngle,
  measureDistance,
} from "@scenecheck/core";
import { loadSceneIRFromProvider } from "./dump.js";

type MeasureOperation = "distance" | "angle" | "aabb" | "bounds";

interface MeasureCliOptions {
  operation: MeasureOperation;
  provider?: string;
  from?: string;
  to?: string;
  node?: string;
  pretty: boolean;
  includeInvisible: boolean;
}

export async function runMeasureCommand(commandArgs: readonly string[]): Promise<void> {
  const options = parseMeasureArgs(commandArgs);
  const needsBounds = options.operation === "aabb" || options.operation === "bounds";
  const scene = await loadSceneIRFromProvider(options.provider, {
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

function parseMeasureArgs(commandArgs: readonly string[]): MeasureCliOptions {
  const operation = commandArgs[0];
  if (
    operation !== "distance" &&
    operation !== "angle" &&
    operation !== "aabb" &&
    operation !== "bounds"
  ) {
    throw new Error("measure requires an operation: distance, angle, aabb, or bounds.");
  }

  let provider: string | undefined;
  let from: string | undefined;
  let to: string | undefined;
  let node: string | undefined;
  let pretty = false;
  let includeInvisible = true;

  for (let index = 1; index < commandArgs.length; index += 1) {
    const arg = commandArgs[index];
    if (!arg) continue;

    if (arg === "--pretty") {
      pretty = true;
      continue;
    }
    if (arg === "--exclude-invisible") {
      includeInvisible = false;
      continue;
    }
    if (arg === "--from" || arg === "--to" || arg === "--node") {
      const value = requireFlagValue(commandArgs, index, arg);
      if (arg === "--from") from = value;
      else if (arg === "--to") to = value;
      else node = value;
      index += 1;
      continue;
    }
    if (arg.startsWith("-")) {
      throw new Error(`Unknown measure option: ${arg}`);
    }
    if (provider) throw new Error(`Unexpected extra argument: ${arg}`);
    provider = arg;
  }

  if (operation === "bounds") {
    if (!node) throw new Error("measure bounds requires --node <node-id>.");
    return {
      operation,
      ...(provider ? { provider } : {}),
      node,
      pretty,
      includeInvisible,
    };
  }

  if (!from || !to) {
    const kind = operation === "aabb" ? "node IDs" : "references";
    throw new Error(`measure ${operation} requires both --from and --to ${kind}.`);
  }

  return {
    operation,
    ...(provider ? { provider } : {}),
    from,
    to,
    pretty,
    includeInvisible,
  };
}

function requireFlagValue(
  commandArgs: readonly string[],
  index: number,
  flag: string,
): string {
  const value = commandArgs[index + 1];
  if (!value || value.startsWith("-")) {
    throw new Error(`${flag} requires a value.`);
  }
  return value;
}
