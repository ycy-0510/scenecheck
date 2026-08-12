import { access } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { SceneIR } from "@scenecheck/core";
import { fromThreeScene, type ThreeSceneAdapterOptions } from "@scenecheck/three";
import { tsImport } from "tsx/esm/api";

const DEFAULT_PROVIDER_FILES = [
  "scenecheck.scene.ts",
  "scenecheck.scene.mts",
  "scenecheck.scene.js",
  "scenecheck.scene.mjs",
  "scenecheck.scene.cts",
  "scenecheck.scene.cjs",
] as const;

export interface LoadSceneOptions extends ThreeSceneAdapterOptions {
  cwd?: string;
}

export async function resolveProviderPath(
  input?: string,
  cwd = process.cwd(),
): Promise<string> {
  if (input) {
    const path = resolve(cwd, input);
    await assertReadable(path, `Scene provider not found: ${path}`);
    return path;
  }

  for (const candidate of DEFAULT_PROVIDER_FILES) {
    const path = resolve(cwd, candidate);
    try {
      await access(path);
      return path;
    } catch {
      // Try the next conventional provider name.
    }
  }

  throw new Error(
    `No scene provider found. Pass a provider path or create one of: ${DEFAULT_PROVIDER_FILES.join(", ")}`,
  );
}

export async function loadSceneIRFromProvider(
  providerInput?: string,
  options: LoadSceneOptions = {},
): Promise<SceneIR> {
  const cwd = options.cwd ?? process.cwd();
  const providerPath = await resolveProviderPath(providerInput, cwd);
  const moduleUrl = pathToFileURL(providerPath).href;
  const loaded = (await tsImport(moduleUrl, import.meta.url)) as Record<string, unknown>;
  const provider = loaded.default ?? loaded.createScene ?? loaded.scene;

  if (provider === undefined) {
    throw new Error(
      `Scene provider ${providerPath} must export default, createScene, or scene.`,
    );
  }

  const value = typeof provider === "function" ? await provider() : provider;

  if (isSceneIR(value)) {
    return value;
  }

  if (isThreeObject3D(value)) {
    const { cwd: _cwd, ...adapterOptions } = options;
    return fromThreeScene(value as Parameters<typeof fromThreeScene>[0], adapterOptions);
  }

  throw new Error(
    `Scene provider ${providerPath} returned an unsupported value. Return a Three.js Object3D/Scene or a SceneIR object.`,
  );
}

function isSceneIR(value: unknown): value is SceneIR {
  if (!isRecord(value)) return false;
  return (
    value.version === 1 &&
    Array.isArray(value.roots) &&
    isRecord(value.nodes)
  );
}

function isThreeObject3D(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return value.isObject3D === true && typeof value.updateWorldMatrix === "function";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function assertReadable(path: string, message: string): Promise<void> {
  try {
    await access(path);
  } catch {
    throw new Error(message);
  }
}
