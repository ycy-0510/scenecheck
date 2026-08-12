import { access, readFile } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { SceneAssertion } from "@scenecheck/core";

const DEFAULT_CONFIG_FILES = [
  "scenecheck.config.ts",
  "scenecheck.config.mts",
  "scenecheck.config.js",
  "scenecheck.config.mjs",
  "scenecheck.config.json",
] as const;

export interface SceneCheckConfig {
  provider?: string;
  assertions: readonly SceneAssertion[];
}

export interface LoadedSceneCheckConfig {
  path: string;
  directory: string;
  config: SceneCheckConfig;
}

export async function loadSceneCheckConfig(
  input?: string,
  cwd = process.cwd(),
): Promise<LoadedSceneCheckConfig> {
  const path = await resolveConfigPath(input, cwd);
  const raw = await loadConfigModule(path);
  const config = normalizeConfig(raw, path);

  return {
    path,
    directory: dirname(path),
    config,
  };
}

export async function resolveConfigPath(
  input?: string,
  cwd = process.cwd(),
): Promise<string> {
  if (input) {
    const path = resolve(cwd, input);
    try {
      await access(path);
      return path;
    } catch {
      throw new Error(`SceneCheck config not found: ${path}`);
    }
  }

  for (const filename of DEFAULT_CONFIG_FILES) {
    const path = resolve(cwd, filename);
    try {
      await access(path);
      return path;
    } catch {
      // Try the next conventional config name.
    }
  }

  throw new Error(
    `No SceneCheck config found. Pass --config <file> or create one of: ${DEFAULT_CONFIG_FILES.join(", ")}`,
  );
}

export function resolveValidationProvider(
  loaded: LoadedSceneCheckConfig,
  providerOverride?: string,
  cwd = process.cwd(),
): { provider?: string; cwd: string } {
  if (providerOverride) {
    return { provider: resolve(cwd, providerOverride), cwd };
  }
  if (loaded.config.provider) {
    return {
      provider: resolve(loaded.directory, loaded.config.provider),
      cwd: loaded.directory,
    };
  }
  return { cwd: loaded.directory };
}

async function loadConfigModule(path: string): Promise<unknown> {
  if (extname(path).toLowerCase() === ".json") {
    return JSON.parse(await readFile(path, "utf8"));
  }

  const loaded = (await import(pathToFileURL(path).href)) as Record<string, unknown>;
  return loaded.default ?? loaded.config;
}

function normalizeConfig(value: unknown, path: string): SceneCheckConfig {
  if (!isRecord(value)) {
    throw new Error(`SceneCheck config ${path} must export an object.`);
  }
  if (value.provider !== undefined && typeof value.provider !== "string") {
    throw new Error(`SceneCheck config ${path} provider must be a string.`);
  }
  if (!Array.isArray(value.assertions)) {
    throw new Error(`SceneCheck config ${path} must contain an assertions array.`);
  }

  return {
    ...(typeof value.provider === "string" ? { provider: value.provider } : {}),
    assertions: value.assertions as SceneAssertion[],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
