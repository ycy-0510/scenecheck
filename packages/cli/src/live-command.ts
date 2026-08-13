import {
  DEFAULT_LIVE_PORT,
  DEFAULT_LIVE_URL,
  queryScene,
  resolveAnnotation,
  summarizeScene,
  type SceneNode,
  type SceneQuery,
} from "@scenecheck/core";
import { captureLiveScene, getLiveStatus } from "./live-client.js";
import { runLiveMeasureCommand } from "./live-measure-command.js";
import { startSceneCheckLiveServer } from "./live-server.js";

interface CommonLiveOptions {
  url: string;
  pretty: boolean;
  includeInvisible: boolean;
  includeBounds: boolean;
}

export async function runLiveCommand(commandArgs: readonly string[]): Promise<void> {
  const subcommand = commandArgs[0];
  const rest = commandArgs.slice(1);

  if (subcommand === "serve") {
    await serve(rest);
    return;
  }
  if (subcommand === "status") {
    await status(rest);
    return;
  }
  if (subcommand === "dump") {
    await dump(rest);
    return;
  }
  if (subcommand === "summary") {
    await summary(rest);
    return;
  }
  if (subcommand === "query") {
    await query(rest);
    return;
  }
  if (subcommand === "annotations") {
    await annotations(rest);
    return;
  }
  if (subcommand === "measure") {
    await runLiveMeasureCommand(rest);
    return;
  }

  throw new Error(
    "live requires one of: serve, status, dump, summary, query, annotations, measure.",
  );
}

async function serve(args: readonly string[]): Promise<void> {
  let port = DEFAULT_LIVE_PORT;
  const allowedOrigins: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg) continue;
    if (arg === "--port") {
      const value = requireFlagValue(args, index, arg);
      port = Number(value);
      if (!Number.isInteger(port) || port < 0 || port > 65_535) {
        throw new Error(`--port must be an integer from 0 to 65535. Received: ${value}`);
      }
      index += 1;
      continue;
    }
    if (arg === "--allow-origin") {
      allowedOrigins.push(requireFlagValue(args, index, arg));
      index += 1;
      continue;
    }
    throw new Error(`Unknown live serve option: ${arg}`);
  }

  const live = await startSceneCheckLiveServer({ port, allowedOrigins });
  process.stderr.write(`SceneCheck live bridge listening on ${live.url}\n`);
  process.stderr.write("Connect the browser runtime, then use `scenecheck live summary` or `scenecheck live query`.\n");

  await new Promise<void>((resolve) => {
    const stop = (): void => resolve();
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
  });
  await live.close();
}

async function status(args: readonly string[]): Promise<void> {
  const options = parseCommon(args, { includeBounds: false });
  writeJson(await getLiveStatus(options.url), options.pretty);
}

async function dump(args: readonly string[]): Promise<void> {
  const options = parseCommon(args, { includeBounds: false, boundsFlag: true });
  const scene = await captureLiveScene(options.url, {
    includeInvisible: options.includeInvisible,
    includeBounds: options.includeBounds,
  });
  writeJson(scene, options.pretty);
}

async function summary(args: readonly string[]): Promise<void> {
  const options = parseCommon(args, { includeBounds: false });
  const scene = await captureLiveScene(options.url, {
    includeInvisible: options.includeInvisible,
    includeBounds: false,
  });
  writeJson(summarizeScene(scene), options.pretty);
}

async function query(args: readonly string[]): Promise<void> {
  const options = parseQuery(args);
  const scene = await captureLiveScene(options.url, {
    includeInvisible: options.includeInvisible,
    includeBounds: options.includeBounds,
  });
  const result = queryScene(scene, options.query);
  writeJson(
    options.full
      ? result
      : { ...result, nodes: result.nodes.map(compactNode) },
    options.pretty,
  );
}

async function annotations(args: readonly string[]): Promise<void> {
  let id: string | undefined;
  const remaining: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--id") {
      id = requireFlagValue(args, index, arg);
      index += 1;
    } else if (arg) {
      remaining.push(arg);
    }
  }
  const options = parseCommon(remaining, { includeBounds: false });
  const scene = await captureLiveScene(options.url, {
    includeInvisible: options.includeInvisible,
    includeBounds: false,
  });

  const source = id
    ? [scene.annotations?.find((annotation) => annotation.id === id)].filter(Boolean)
    : [...(scene.annotations ?? [])];
  if (id && source.length === 0) {
    throw new Error(`SceneCheck annotation not found: "${id}".`);
  }

  const resolved = source.map((annotation) => {
    if (!annotation) return undefined;
    const result = resolveAnnotation(scene, annotation.id);
    return {
      id: annotation.id,
      type: annotation.type,
      ...(annotation.label ? { label: annotation.label } : {}),
      ...(annotation.note ? { note: annotation.note } : {}),
      ...(annotation.attachedTo ? { attachedTo: annotation.attachedTo } : {}),
      followsAttachment: result.followsAttachment,
      worldTransform: compactTransform(result.worldTransform),
      ...(annotation.localTransform
        ? { localTransform: compactTransform(annotation.localTransform) }
        : {}),
    };
  }).filter(Boolean);

  writeJson({ total: resolved.length, annotations: resolved }, options.pretty);
}

interface QueryOptions extends CommonLiveOptions {
  query: SceneQuery;
  full: boolean;
}

function parseQuery(args: readonly string[]): QueryOptions {
  const query: SceneQuery = {};
  const commonArgs: string[] = [];
  let full = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg) continue;
    if (arg === "--full") {
      full = true;
      continue;
    }
    if (arg === "--case-sensitive") {
      query.caseSensitive = true;
      continue;
    }
    const key = queryFlagKey(arg);
    if (key) {
      const value = requireFlagValue(args, index, arg);
      if (key === "limit") {
        const limit = Number(value);
        if (!Number.isInteger(limit) || limit < 1) {
          throw new Error(`--limit must be a positive integer. Received: ${value}`);
        }
        query.limit = limit;
      } else {
        query[key] = value;
      }
      index += 1;
      continue;
    }
    commonArgs.push(arg);
  }

  if (!hasQueryFilter(query)) {
    throw new Error(
      "live query requires at least one filter: --id, --name, --type, --text, or --parent.",
    );
  }

  return {
    ...parseCommon(commonArgs, { includeBounds: false, boundsFlag: true }),
    query,
    full,
  };
}

function parseCommon(
  args: readonly string[],
  defaults: { includeBounds: boolean; boundsFlag?: boolean },
): CommonLiveOptions {
  let url = DEFAULT_LIVE_URL;
  let pretty = false;
  let includeInvisible = true;
  let includeBounds = defaults.includeBounds;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg) continue;
    if (arg === "--url") {
      url = requireFlagValue(args, index, arg);
      index += 1;
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
    if (arg === "--bounds" && defaults.boundsFlag) {
      includeBounds = true;
      continue;
    }
    throw new Error(`Unknown live option: ${arg}`);
  }

  return { url, pretty, includeInvisible, includeBounds };
}

function compactNode(node: SceneNode): unknown {
  return {
    id: node.id,
    ...(node.name ? { name: node.name } : {}),
    type: node.type,
    ...(node.parentId ? { parentId: node.parentId } : {}),
    children: node.children,
    localTransform: compactTransform(node.localTransform),
    worldTransform: compactTransform(node.worldTransform),
    ...(node.bounds ? { bounds: node.bounds } : {}),
    ...(node.semantics ? { semantics: node.semantics } : {}),
  };
}

function compactTransform(transform: SceneNode["worldTransform"]): unknown {
  return {
    position: transform.position,
    rotation: transform.rotation,
    scale: transform.scale,
  };
}

function queryFlagKey(
  flag: string,
): "id" | "name" | "type" | "text" | "parentId" | "limit" | undefined {
  switch (flag) {
    case "--id": return "id";
    case "--name": return "name";
    case "--type": return "type";
    case "--text": return "text";
    case "--parent": return "parentId";
    case "--limit": return "limit";
    default: return undefined;
  }
}

function hasQueryFilter(query: SceneQuery): boolean {
  return (
    query.id !== undefined ||
    query.name !== undefined ||
    query.type !== undefined ||
    query.text !== undefined ||
    query.parentId !== undefined
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

function writeJson(value: unknown, pretty: boolean): void {
  process.stdout.write(`${JSON.stringify(value, null, pretty ? 2 : undefined)}\n`);
}
