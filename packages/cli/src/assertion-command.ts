import {
  DEFAULT_LIVE_URL,
  freezeAnnotationAsPoseAssertion,
  type SceneIR,
} from "@scenecheck/core";
import { loadSceneIRFromProvider } from "./dump.js";
import { captureLiveScene } from "./live-client.js";

interface FreezeAnnotationOptions {
  annotationId: string;
  target: string;
  positionTolerance: number;
  rotationToleranceDegrees?: number;
  assertionId?: string;
  pretty: boolean;
}

interface ProviderFreezeAnnotationOptions extends FreezeAnnotationOptions {
  provider?: string;
}

interface LiveFreezeAnnotationOptions extends FreezeAnnotationOptions {
  url: string;
}

export async function runAssertionCommand(args: readonly string[]): Promise<void> {
  const subcommand = args[0];
  if (subcommand !== "from-annotation") {
    throw new Error("assertion requires subcommand: from-annotation.");
  }

  const options = parseProviderOptions(args.slice(1));
  const scene = await loadSceneIRFromProvider(options.provider, {
    includeInvisible: true,
    includeBounds: false,
  });
  writeFrozenAssertion(scene, options);
}

export async function runLiveAssertionCommand(args: readonly string[]): Promise<void> {
  const subcommand = args[0];
  if (subcommand !== "from-annotation") {
    throw new Error("live assertion requires subcommand: from-annotation.");
  }

  const options = parseLiveOptions(args.slice(1));
  const scene = await captureLiveScene(options.url, {
    includeInvisible: true,
    includeBounds: false,
  });
  writeFrozenAssertion(scene, options);
}

function writeFrozenAssertion(
  scene: SceneIR,
  options: FreezeAnnotationOptions,
): void {
  const assertion = freezeAnnotationAsPoseAssertion(scene, options.annotationId, {
    target: options.target,
    positionTolerance: options.positionTolerance,
    ...(options.rotationToleranceDegrees !== undefined
      ? { rotationToleranceDegrees: options.rotationToleranceDegrees }
      : {}),
    ...(options.assertionId ? { assertionId: options.assertionId } : {}),
  });
  process.stdout.write(`${JSON.stringify(assertion, null, options.pretty ? 2 : undefined)}\n`);
}

function parseProviderOptions(args: readonly string[]): ProviderFreezeAnnotationOptions {
  let provider: string | undefined;
  const commonArgs: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg) continue;
    if (isCommonFlag(arg)) {
      commonArgs.push(arg);
      const value = args[index + 1];
      if (arg !== "--pretty") {
        if (!value || value.startsWith("-")) throw new Error(`${arg} requires a value.`);
        commonArgs.push(value);
        index += 1;
      }
      continue;
    }
    if (arg.startsWith("-")) throw new Error(`Unknown assertion option: ${arg}`);
    if (provider) throw new Error(`Unexpected extra argument: ${arg}`);
    provider = arg;
  }

  return {
    ...parseCommonOptions(commonArgs),
    ...(provider ? { provider } : {}),
  };
}

function parseLiveOptions(args: readonly string[]): LiveFreezeAnnotationOptions {
  let url = DEFAULT_LIVE_URL;
  const commonArgs: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg) continue;
    if (arg === "--url") {
      url = requireFlagValue(args, index, arg);
      index += 1;
      continue;
    }
    if (isCommonFlag(arg)) {
      commonArgs.push(arg);
      if (arg !== "--pretty") {
        commonArgs.push(requireFlagValue(args, index, arg));
        index += 1;
      }
      continue;
    }
    throw new Error(`Unknown live assertion option: ${arg}`);
  }

  return { ...parseCommonOptions(commonArgs), url };
}

function parseCommonOptions(args: readonly string[]): FreezeAnnotationOptions {
  let annotationId: string | undefined;
  let target: string | undefined;
  let positionTolerance: number | undefined;
  let rotationToleranceDegrees: number | undefined;
  let assertionId: string | undefined;
  let pretty = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg) continue;
    if (arg === "--pretty") {
      pretty = true;
      continue;
    }

    const value = requireFlagValue(args, index, arg);
    if (arg === "--annotation") {
      annotationId = value.startsWith("annotation:")
        ? value.slice("annotation:".length)
        : value;
    } else if (arg === "--target") {
      target = value;
    } else if (arg === "--position-tolerance") {
      positionTolerance = parseNonNegativeNumber(value, arg);
    } else if (arg === "--rotation-tolerance-degrees") {
      rotationToleranceDegrees = parseRangeNumber(value, arg, 0, 180);
    } else if (arg === "--id") {
      assertionId = value;
    } else {
      throw new Error(`Unknown assertion option: ${arg}`);
    }
    index += 1;
  }

  if (!annotationId) {
    throw new Error("assertion from-annotation requires --annotation <id>.");
  }
  if (!target) {
    throw new Error("assertion from-annotation requires --target <node|anchor|socket>.");
  }
  if (positionTolerance === undefined) {
    throw new Error(
      "assertion from-annotation requires --position-tolerance <non-negative number>.",
    );
  }

  return {
    annotationId,
    target,
    positionTolerance,
    ...(rotationToleranceDegrees !== undefined ? { rotationToleranceDegrees } : {}),
    ...(assertionId ? { assertionId } : {}),
    pretty,
  };
}

function isCommonFlag(arg: string): boolean {
  return (
    arg === "--annotation" ||
    arg === "--target" ||
    arg === "--position-tolerance" ||
    arg === "--rotation-tolerance-degrees" ||
    arg === "--id" ||
    arg === "--pretty"
  );
}

function requireFlagValue(
  args: readonly string[],
  index: number,
  flag: string,
): string {
  const value = args[index + 1];
  if (!value || value.startsWith("-")) throw new Error(`${flag} requires a value.`);
  return value;
}

function parseNonNegativeNumber(value: string, flag: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${flag} must be a finite non-negative number. Received: ${value}`);
  }
  return parsed;
}

function parseRangeNumber(
  value: string,
  flag: string,
  minimum: number,
  maximum: number,
): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${flag} must be between ${minimum} and ${maximum}. Received: ${value}`);
  }
  return parsed;
}
