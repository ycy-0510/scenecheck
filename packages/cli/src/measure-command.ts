import { measureAngle, measureDistance } from "@scenecheck/core";
import { loadSceneIRFromProvider } from "./dump.js";

interface MeasureCliOptions {
  operation: "distance" | "angle";
  provider?: string;
  from: string;
  to: string;
  pretty: boolean;
  includeInvisible: boolean;
}

export async function runMeasureCommand(commandArgs: readonly string[]): Promise<void> {
  const options = parseMeasureArgs(commandArgs);
  const scene = await loadSceneIRFromProvider(options.provider, {
    includeInvisible: options.includeInvisible,
    includeBounds: false,
  });

  const result =
    options.operation === "distance"
      ? measureDistance(scene, options.from, options.to)
      : measureAngle(scene, options.from, options.to);

  process.stdout.write(`${JSON.stringify(result, null, options.pretty ? 2 : undefined)}\n`);
}

function parseMeasureArgs(commandArgs: readonly string[]): MeasureCliOptions {
  const operation = commandArgs[0];
  if (operation !== "distance" && operation !== "angle") {
    throw new Error("measure requires an operation: distance or angle.");
  }

  let provider: string | undefined;
  let from: string | undefined;
  let to: string | undefined;
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
    if (arg === "--from" || arg === "--to") {
      const value = requireFlagValue(commandArgs, index, arg);
      if (arg === "--from") from = value;
      else to = value;
      index += 1;
      continue;
    }
    if (arg.startsWith("-")) {
      throw new Error(`Unknown measure option: ${arg}`);
    }
    if (provider) throw new Error(`Unexpected extra argument: ${arg}`);
    provider = arg;
  }

  if (!from || !to) {
    throw new Error("measure requires both --from <reference> and --to <reference>.");
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
    throw new Error(`${flag} requires a reference.`);
  }
  return value;
}
