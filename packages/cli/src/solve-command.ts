import { solveAttachment, type AttachmentSolution, type Transform } from "@scenecheck/core";
import { loadSceneIRFromProvider } from "./dump.js";

interface SolveAttachmentOptions {
  provider?: string;
  moduleId: string;
  anchorId: string;
  targetId: string;
  socketId: string;
  pretty: boolean;
  full: boolean;
  includeInvisible: boolean;
}

export async function runSolveCommand(commandArgs: readonly string[]): Promise<void> {
  const operation = commandArgs[0];
  if (operation !== "attachment") {
    throw new Error("solve requires an operation: attachment.");
  }

  const options = parseAttachmentArgs(commandArgs.slice(1));
  const scene = await loadSceneIRFromProvider(options.provider, {
    includeInvisible: options.includeInvisible,
    includeBounds: false,
  });
  const solution = solveAttachment(scene, {
    moduleId: options.moduleId,
    anchorId: options.anchorId,
    targetId: options.targetId,
    socketId: options.socketId,
  });

  const output = options.full ? solution : compactSolution(solution);
  process.stdout.write(`${JSON.stringify(output, null, options.pretty ? 2 : undefined)}\n`);

  // An exact matrix solution can exist even when ordinary Object3D TRS cannot represent it.
  // Treat that as an unsafe-to-apply solution rather than silently handing the agent bad TRS.
  if (!solution.safeToApplyTRS) process.exitCode = 2;
}

function parseAttachmentArgs(commandArgs: readonly string[]): SolveAttachmentOptions {
  let provider: string | undefined;
  let moduleId: string | undefined;
  let anchorId: string | undefined;
  let targetId: string | undefined;
  let socketId: string | undefined;
  let pretty = false;
  let full = false;
  let includeInvisible = true;

  for (let index = 0; index < commandArgs.length; index += 1) {
    const arg = commandArgs[index];
    if (!arg) continue;

    if (arg === "--pretty") {
      pretty = true;
      continue;
    }
    if (arg === "--full") {
      full = true;
      continue;
    }
    if (arg === "--exclude-invisible") {
      includeInvisible = false;
      continue;
    }

    const key = attachmentFlagKey(arg);
    if (key) {
      const value = requireFlagValue(commandArgs, index, arg);
      if (key === "moduleId") moduleId = value;
      else if (key === "anchorId") anchorId = value;
      else if (key === "targetId") targetId = value;
      else socketId = value;
      index += 1;
      continue;
    }

    if (arg.startsWith("-")) {
      throw new Error(`Unknown solve attachment option: ${arg}`);
    }
    if (provider) throw new Error(`Unexpected extra argument: ${arg}`);
    provider = arg;
  }

  const missing = [
    ["--module", moduleId],
    ["--anchor", anchorId],
    ["--target", targetId],
    ["--socket", socketId],
  ]
    .filter(([, value]) => !value)
    .map(([flag]) => flag);

  if (missing.length > 0) {
    throw new Error(`solve attachment requires ${missing.join(", ")}.`);
  }

  return {
    ...(provider ? { provider } : {}),
    moduleId: moduleId!,
    anchorId: anchorId!,
    targetId: targetId!,
    socketId: socketId!,
    pretty,
    full,
    includeInvisible,
  };
}

function compactSolution(solution: AttachmentSolution): unknown {
  return {
    moduleId: solution.moduleId,
    ...(solution.moduleType ? { moduleType: solution.moduleType } : {}),
    anchorId: solution.anchorId,
    targetId: solution.targetId,
    socketId: solution.socketId,
    safeToApplyTRS: solution.safeToApplyTRS,
    desiredLocalTransform: compactTransform(solution.desiredLocalTransform),
    desiredWorldTransform: compactTransform(solution.desiredWorldTransform),
    delta: solution.delta,
    diagnostics: solution.diagnostics,
  };
}

function compactTransform(transform: Transform): unknown {
  return {
    position: transform.position,
    rotation: transform.rotation,
    scale: transform.scale,
  };
}

function attachmentFlagKey(
  flag: string,
): "moduleId" | "anchorId" | "targetId" | "socketId" | undefined {
  switch (flag) {
    case "--module":
      return "moduleId";
    case "--anchor":
      return "anchorId";
    case "--target":
      return "targetId";
    case "--socket":
      return "socketId";
    default:
      return undefined;
  }
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
