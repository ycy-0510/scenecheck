#!/usr/bin/env node

import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
  queryScene,
  summarizeScene,
  type SceneQuery,
} from "@scenecheck/core";
import { loadSceneIRFromProvider } from "./dump.js";

const execFileAsync = promisify(execFile);
const args = process.argv.slice(2);
const command = args[0];

function help(): void {
  console.log(`SceneCheck\n\nUsage:\n  scenecheck init [--force]\n  scenecheck dump [provider] [--output <file>] [--pretty] [--exclude-invisible] [--no-bounds]\n  scenecheck summary [provider] [--pretty] [--exclude-invisible]\n  scenecheck query [provider] (--id <id> | --name <name> | --type <type> | --text <text> | --parent <id>) [--limit <n>] [--pretty]\n  scenecheck --help\n\nCommands:\n  init      Install the SceneCheck agent skill in the current repository\n  dump      Load a scene provider and emit complete Scene IR as JSON\n  summary   Emit a compact scene summary without returning every node\n  query     Return only scene nodes matching precise filters\n\nScene providers may export default, createScene, or scene and return either a Three.js Object3D/Scene or Scene IR.\n`);
}

async function findProjectRoot(): Promise<string> {
  try {
    const { stdout } = await execFileAsync("git", ["rev-parse", "--show-toplevel"], {
      cwd: process.cwd(),
    });
    const root = stdout.trim();
    return root.length > 0 ? root : process.cwd();
  } catch {
    return process.cwd();
  }
}

async function init(): Promise<void> {
  const force = args.includes("--force");
  const projectRoot = await findProjectRoot();
  const target = resolve(projectRoot, ".agents/skills/scenecheck/SKILL.md");
  const here = dirname(fileURLToPath(import.meta.url));
  const template = resolve(here, "../templates/skill/SKILL.md");

  let existing: string | undefined;
  try {
    existing = await readFile(target, "utf8");
  } catch {
    // File does not exist yet.
  }

  if (existing !== undefined && !force) {
    console.error(`SceneCheck skill already exists at ${target}. Use --force to replace it.`);
    process.exitCode = 1;
    return;
  }

  const content = await readFile(template, "utf8");
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content, "utf8");
  console.log(`Installed SceneCheck skill at ${target}`);
}

interface SceneLoadCliOptions {
  provider?: string;
  pretty: boolean;
  includeInvisible: boolean;
  includeBounds: boolean;
}

interface DumpCliOptions extends SceneLoadCliOptions {
  output?: string;
}

function parseDumpArgs(commandArgs: readonly string[]): DumpCliOptions {
  const parsed: DumpCliOptions = defaultSceneLoadOptions();

  for (let index = 0; index < commandArgs.length; index += 1) {
    const arg = commandArgs[index];
    if (!arg) continue;

    if (applyCommonSceneFlag(parsed, arg)) continue;

    if (arg === "--output" || arg === "-o") {
      parsed.output = requireFlagValue(commandArgs, index, arg);
      index += 1;
      continue;
    }

    if (arg.startsWith("-")) {
      throw new Error(`Unknown dump option: ${arg}`);
    }
    setProvider(parsed, arg);
  }

  return parsed;
}

async function dump(): Promise<void> {
  const options = parseDumpArgs(args.slice(1));
  const scene = await loadSceneIRFromProvider(options.provider, {
    includeInvisible: options.includeInvisible,
    includeBounds: options.includeBounds,
  });
  const json = stringifyJson(scene, options.pretty);

  if (options.output) {
    const outputPath = resolve(process.cwd(), options.output);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${json}\n`, "utf8");
    console.error(`Wrote Scene IR to ${outputPath}`);
    return;
  }

  process.stdout.write(`${json}\n`);
}

function parseSummaryArgs(commandArgs: readonly string[]): SceneLoadCliOptions {
  const parsed = defaultSceneLoadOptions();

  for (const arg of commandArgs) {
    if (applyCommonSceneFlag(parsed, arg)) continue;
    if (arg.startsWith("-")) throw new Error(`Unknown summary option: ${arg}`);
    setProvider(parsed, arg);
  }

  return parsed;
}

async function summary(): Promise<void> {
  const options = parseSummaryArgs(args.slice(1));
  const scene = await loadSceneIRFromProvider(options.provider, {
    includeInvisible: options.includeInvisible,
    includeBounds: options.includeBounds,
  });
  writeJson(summarizeScene(scene), options.pretty);
}

interface QueryCliOptions extends SceneLoadCliOptions {
  query: SceneQuery;
}

function parseQueryArgs(commandArgs: readonly string[]): QueryCliOptions {
  const parsed: QueryCliOptions = {
    ...defaultSceneLoadOptions(),
    query: {},
  };

  for (let index = 0; index < commandArgs.length; index += 1) {
    const arg = commandArgs[index];
    if (!arg) continue;

    if (applyCommonSceneFlag(parsed, arg)) continue;

    if (arg === "--case-sensitive") {
      parsed.query.caseSensitive = true;
      continue;
    }

    const queryKey = queryFlagKey(arg);
    if (queryKey) {
      const value = requireFlagValue(commandArgs, index, arg);
      if (queryKey === "limit") {
        const limit = Number(value);
        if (!Number.isInteger(limit) || limit < 1) {
          throw new Error(`--limit must be a positive integer. Received: ${value}`);
        }
        parsed.query.limit = limit;
      } else {
        parsed.query[queryKey] = value;
      }
      index += 1;
      continue;
    }

    if (arg.startsWith("-")) {
      throw new Error(`Unknown query option: ${arg}`);
    }
    setProvider(parsed, arg);
  }

  if (!hasQueryFilter(parsed.query)) {
    throw new Error(
      "query requires at least one filter: --id, --name, --type, --text, or --parent.",
    );
  }

  return parsed;
}

async function query(): Promise<void> {
  const options = parseQueryArgs(args.slice(1));
  const scene = await loadSceneIRFromProvider(options.provider, {
    includeInvisible: options.includeInvisible,
    includeBounds: options.includeBounds,
  });
  writeJson(queryScene(scene, options.query), options.pretty);
}

function defaultSceneLoadOptions(): SceneLoadCliOptions {
  return {
    pretty: false,
    includeInvisible: true,
    includeBounds: true,
  };
}

function applyCommonSceneFlag(options: SceneLoadCliOptions, arg: string): boolean {
  if (arg === "--pretty") {
    options.pretty = true;
    return true;
  }
  if (arg === "--exclude-invisible") {
    options.includeInvisible = false;
    return true;
  }
  if (arg === "--no-bounds") {
    options.includeBounds = false;
    return true;
  }
  return false;
}

function setProvider(options: SceneLoadCliOptions, provider: string): void {
  if (options.provider) {
    throw new Error(`Unexpected extra argument: ${provider}`);
  }
  options.provider = provider;
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

function queryFlagKey(
  flag: string,
): "id" | "name" | "type" | "text" | "parentId" | "limit" | undefined {
  switch (flag) {
    case "--id":
      return "id";
    case "--name":
      return "name";
    case "--type":
      return "type";
    case "--text":
      return "text";
    case "--parent":
      return "parentId";
    case "--limit":
      return "limit";
    default:
      return undefined;
  }
}

function hasQueryFilter(queryOptions: SceneQuery): boolean {
  return (
    queryOptions.id !== undefined ||
    queryOptions.name !== undefined ||
    queryOptions.type !== undefined ||
    queryOptions.text !== undefined ||
    queryOptions.parentId !== undefined
  );
}

function stringifyJson(value: unknown, pretty: boolean): string {
  return JSON.stringify(value, null, pretty ? 2 : undefined);
}

function writeJson(value: unknown, pretty: boolean): void {
  process.stdout.write(`${stringifyJson(value, pretty)}\n`);
}

async function main(): Promise<void> {
  try {
    if (command === "init") {
      await init();
    } else if (command === "dump") {
      await dump();
    } else if (command === "summary") {
      await summary();
    } else if (command === "query") {
      await query();
    } else if (command === undefined || command === "--help" || command === "-h") {
      help();
    } else {
      console.error(`Unknown command: ${command}\n`);
      help();
      process.exitCode = 1;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`SceneCheck: ${message}`);
    process.exitCode = 1;
  }
}

await main();
