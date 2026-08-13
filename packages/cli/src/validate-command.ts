import { applyAnnotationDocument, validateScene } from "@scenecheck/core";
import {
  loadAnnotationDocumentFile,
  loadSceneCheckConfig,
  resolveValidationAnnotations,
  resolveValidationProvider,
} from "./config.js";
import { loadSceneIRFromProvider } from "./dump.js";

interface ValidateCliOptions {
  provider?: string;
  config?: string;
  json: boolean;
  pretty: boolean;
  includeInvisible: boolean;
}

export async function runValidateCommand(commandArgs: readonly string[]): Promise<void> {
  const options = parseValidateArgs(commandArgs);
  const loadedConfig = await loadSceneCheckConfig(options.config);
  const provider = resolveValidationProvider(loadedConfig, options.provider);
  const needsBounds = loadedConfig.config.assertions.some(
    (assertion) =>
      assertion.type === "aabb-clearance" || assertion.type === "aabb-intersection",
  );
  let scene = await loadSceneIRFromProvider(provider.provider, {
    cwd: provider.cwd,
    includeInvisible: options.includeInvisible,
    includeBounds: needsBounds,
  });

  const annotationPath = resolveValidationAnnotations(loadedConfig);
  if (annotationPath) {
    scene = applyAnnotationDocument(
      scene,
      await loadAnnotationDocumentFile(annotationPath),
    );
  }

  const result = validateScene(scene, loadedConfig.config.assertions);

  if (options.json) {
    process.stdout.write(`${JSON.stringify(result, null, options.pretty ? 2 : undefined)}\n`);
  } else {
    writeHumanResult(result);
  }

  if (!result.ok) process.exitCode = 1;
}

function parseValidateArgs(commandArgs: readonly string[]): ValidateCliOptions {
  let provider: string | undefined;
  let config: string | undefined;
  let json = false;
  let pretty = false;
  let includeInvisible = true;

  for (let index = 0; index < commandArgs.length; index += 1) {
    const arg = commandArgs[index];
    if (!arg) continue;

    if (arg === "--json") {
      json = true;
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
    if (arg === "--config" || arg === "-c") {
      config = requireFlagValue(commandArgs, index, arg);
      index += 1;
      continue;
    }
    if (arg.startsWith("-")) {
      throw new Error(`Unknown validate option: ${arg}`);
    }
    if (provider) throw new Error(`Unexpected extra argument: ${arg}`);
    provider = arg;
  }

  return {
    ...(provider ? { provider } : {}),
    ...(config ? { config } : {}),
    json,
    pretty,
    includeInvisible,
  };
}

function writeHumanResult(result: ReturnType<typeof validateScene>): void {
  for (const assertion of result.results) {
    const status = assertion.pass ? "PASS" : "FAIL";
    process.stdout.write(`${status} ${assertion.message}\n`);
  }
  process.stdout.write(
    `\nSceneCheck: ${result.passed} passed, ${result.failed} failed, ${result.total} total\n`,
  );
}

function requireFlagValue(
  commandArgs: readonly string[],
  index: number,
  flag: string,
): string {
  const value = commandArgs[index + 1];
  if (!value || value.startsWith("-")) {
    throw new Error(`${flag} requires a file path.`);
  }
  return value;
}
