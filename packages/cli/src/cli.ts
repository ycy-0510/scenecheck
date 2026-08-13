#!/usr/bin/env node

import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { loadSceneIRFromProvider } from "./dump.js";

const execFileAsync = promisify(execFile);
const args = process.argv.slice(2);
const command = args[0];

function help(): void {
  console.log(`SceneCheck\n\nUsage:\n  scenecheck init [--force]\n  scenecheck dump [provider] [--output <file>] [--pretty] [--exclude-invisible] [--no-bounds]\n  scenecheck --help\n\nCommands:\n  init      Install the SceneCheck agent skill in the current repository\n  dump      Load a scene provider and emit Scene IR as JSON\n\nScene providers may export default, createScene, or scene and return either a Three.js Object3D/Scene or Scene IR.\n`);
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

interface DumpCliOptions {
  provider?: string;
  output?: string;
  pretty: boolean;
  includeInvisible: boolean;
  includeBounds: boolean;
}

function parseDumpArgs(commandArgs: readonly string[]): DumpCliOptions {
  const parsed: DumpCliOptions = {
    pretty: false,
    includeInvisible: true,
    includeBounds: true,
  };

  for (let index = 0; index < commandArgs.length; index += 1) {
    const arg = commandArgs[index];
    if (!arg) continue;

    if (arg === "--pretty") {
      parsed.pretty = true;
      continue;
    }
    if (arg === "--exclude-invisible") {
      parsed.includeInvisible = false;
      continue;
    }
    if (arg === "--no-bounds") {
      parsed.includeBounds = false;
      continue;
    }
    if (arg === "--output" || arg === "-o") {
      const value = commandArgs[index + 1];
      if (!value || value.startsWith("-")) {
        throw new Error(`${arg} requires a file path.`);
      }
      parsed.output = value;
      index += 1;
      continue;
    }
    if (arg.startsWith("-")) {
      throw new Error(`Unknown dump option: ${arg}`);
    }
    if (parsed.provider) {
      throw new Error(`Unexpected extra argument: ${arg}`);
    }
    parsed.provider = arg;
  }

  return parsed;
}

async function dump(): Promise<void> {
  const options = parseDumpArgs(args.slice(1));
  const scene = await loadSceneIRFromProvider(options.provider, {
    includeInvisible: options.includeInvisible,
    includeBounds: options.includeBounds,
  });
  const json = JSON.stringify(scene, null, options.pretty ? 2 : undefined);

  if (options.output) {
    const outputPath = resolve(process.cwd(), options.output);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${json}\n`, "utf8");
    console.error(`Wrote Scene IR to ${outputPath}`);
    return;
  }

  process.stdout.write(`${json}\n`);
}

async function main(): Promise<void> {
  try {
    if (command === "init") {
      await init();
    } else if (command === "dump") {
      await dump();
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
