#!/usr/bin/env node

import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const args = process.argv.slice(2);
const command = args[0];

function help(): void {
  console.log(`SceneCheck\n\nUsage:\n  scenecheck init [--force]\n  scenecheck --help\n\nCommands:\n  init      Install the SceneCheck agent skill in the current repository\n`);
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

if (command === "init") {
  await init();
} else if (command === undefined || command === "--help" || command === "-h") {
  help();
} else {
  console.error(`Unknown command: ${command}\n`);
  help();
  process.exitCode = 1;
}
