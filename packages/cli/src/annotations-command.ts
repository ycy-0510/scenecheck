import { resolveAnnotation, type SceneIR, type Transform } from "@scenecheck/core";
import { loadSceneIRFromProvider } from "./dump.js";

interface AnnotationCliOptions {
  provider?: string;
  id?: string;
  pretty: boolean;
  includeInvisible: boolean;
}

export async function runAnnotationsCommand(commandArgs: readonly string[]): Promise<void> {
  const options = parseArgs(commandArgs);
  const scene = await loadSceneIRFromProvider(options.provider, {
    includeInvisible: options.includeInvisible,
    includeBounds: false,
  });
  const annotations = selectAnnotations(scene, options.id).map((annotation) => {
    const resolved = resolveAnnotation(scene, annotation.id);
    return {
      id: annotation.id,
      type: annotation.type,
      ...(annotation.attachedTo ? { attachedTo: annotation.attachedTo } : {}),
      ...(annotation.label ? { label: annotation.label } : {}),
      ...(annotation.note ? { note: annotation.note } : {}),
      followsAttachment: resolved.followsAttachment,
      worldTransform: compactTransform(resolved.worldTransform),
      ...(annotation.localTransform
        ? { localTransform: compactTransform(annotation.localTransform) }
        : {}),
    };
  });

  const output = {
    total: annotations.length,
    annotations,
  };
  process.stdout.write(`${JSON.stringify(output, null, options.pretty ? 2 : undefined)}\n`);
}

function selectAnnotations(scene: SceneIR, id?: string): NonNullable<SceneIR["annotations"]> {
  const annotations = scene.annotations ?? [];
  if (!id) return annotations;
  const match = annotations.find((annotation) => annotation.id === id);
  if (!match) throw new Error(`SceneCheck annotation not found: "${id}".`);
  return [match];
}

function parseArgs(commandArgs: readonly string[]): AnnotationCliOptions {
  let provider: string | undefined;
  let id: string | undefined;
  let pretty = false;
  let includeInvisible = true;

  for (let index = 0; index < commandArgs.length; index += 1) {
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
    if (arg === "--id") {
      const value = commandArgs[index + 1];
      if (!value || value.startsWith("-")) throw new Error("--id requires an annotation id.");
      id = value;
      index += 1;
      continue;
    }
    if (arg.startsWith("-")) throw new Error(`Unknown annotations option: ${arg}`);
    if (provider) throw new Error(`Unexpected extra argument: ${arg}`);
    provider = arg;
  }

  return {
    ...(provider ? { provider } : {}),
    ...(id ? { id } : {}),
    pretty,
    includeInvisible,
  };
}

function compactTransform(transform: Transform): unknown {
  return {
    position: transform.position,
    rotation: transform.rotation,
    scale: transform.scale,
  };
}
