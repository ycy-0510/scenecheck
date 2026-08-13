import { relative, resolve, sep } from "node:path";
import { parse } from "@babel/parser";
import MagicString from "magic-string";
import type { Plugin, ResolvedConfig } from "vite";

const THREE_MODULE = "@scenecheck/three";
const DESCRIBE_FUNCTION = "describeThreeObject";
const SUPPORTED_EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx", ".mjs", ".mts"]);

export interface SceneCheckViteOptions {
  /** Override the project root used for portable source paths. Defaults to Vite's resolved root. */
  root?: string;
}

export interface InjectedSceneSource {
  file: string;
  line: number;
  column: number;
  symbol?: string;
}

export interface InstrumentSceneCheckResult {
  code: string;
  map: ReturnType<MagicString["generateMap"]>;
  injected: readonly InjectedSceneSource[];
}

interface AstPosition {
  line: number;
  column: number;
}

interface AstLocation {
  start: AstPosition;
}

interface AstNode {
  type: string;
  start?: number | null;
  end?: number | null;
  loc?: AstLocation | null;
  [key: string]: unknown;
}

interface SceneCheckImports {
  named: Set<string>;
  namespaces: Set<string>;
}

/**
 * Vite dev-only instrumentation for `describeThreeObject()` call sites.
 * It injects source metadata into object-literal descriptors while preserving source maps.
 */
export function sceneCheckSourceLocations(
  options: SceneCheckViteOptions = {},
): Plugin {
  let resolvedRoot = resolve(options.root ?? process.cwd());

  return {
    name: "scenecheck-source-locations",
    enforce: "pre",
    apply: "serve",
    configResolved(config: ResolvedConfig) {
      resolvedRoot = resolve(options.root ?? config.root);
    },
    transform(code, id) {
      const result = instrumentSceneCheckSources(code, id, resolvedRoot);
      if (!result) return null;
      return {
        code: result.code,
        map: result.map,
      };
    },
  };
}

/**
 * Pure transform used by the Vite plugin and tests.
 * Only direct named/aliased imports or namespace imports from `@scenecheck/three` are instrumented.
 */
export function instrumentSceneCheckSources(
  code: string,
  id: string,
  projectRoot: string,
): InstrumentSceneCheckResult | undefined {
  const cleanId = stripQuery(id);
  if (!isSupportedSource(cleanId) || isNodeModule(cleanId)) return undefined;

  // Most application modules never mention SceneCheck. Avoid parser work entirely for those files;
  // AST import/call checks below remain the authoritative semantic filter.
  if (!code.includes(THREE_MODULE) || !code.includes(DESCRIBE_FUNCTION)) {
    return undefined;
  }

  const root = resolve(projectRoot);
  const absoluteFile = resolve(cleanId);
  const projectFile = portableProjectPath(root, absoluteFile);
  if (!projectFile) return undefined;

  const ast = parseSource(code, cleanId);
  const program = asNode(ast.program);
  const imports = collectSceneCheckImports(program);
  if (imports.named.size === 0 && imports.namespaces.size === 0) return undefined;

  const magic = new MagicString(code, { filename: projectFile });
  const injected: InjectedSceneSource[] = [];

  walk(program, [], (node, ancestors) => {
    if (node.type !== "CallExpression") return;
    if (!isDescribeThreeObjectCall(node, imports)) return;

    const args = nodeArray(node.arguments);
    const descriptor = args[1];
    if (!descriptor || descriptor.type !== "ObjectExpression") return;
    if (hasSourceProperty(descriptor)) return;
    if (descriptor.start === undefined || descriptor.start === null) return;
    if (!node.loc) return;

    const source: InjectedSceneSource = {
      file: projectFile,
      line: node.loc.start.line,
      column: node.loc.start.column + 1,
      ...inferEnclosingSymbol(ancestors),
    };
    magic.appendLeft(
      descriptor.start + 1,
      `source:${JSON.stringify(source)},`,
    );
    injected.push(source);
  });

  if (injected.length === 0) return undefined;

  return {
    code: magic.toString(),
    map: magic.generateMap({
      source: projectFile,
      includeContent: true,
      hires: true,
    }),
    injected,
  };
}

function parseSource(code: string, id: string): ReturnType<typeof parse> {
  const plugins: Array<
    | "jsx"
    | "typescript"
    | "decorators-legacy"
  > = ["decorators-legacy"];
  if (id.endsWith(".ts") || id.endsWith(".tsx") || id.endsWith(".mts")) {
    plugins.push("typescript");
  }
  if (id.endsWith(".jsx") || id.endsWith(".tsx")) plugins.push("jsx");

  return parse(code, {
    sourceType: "module",
    sourceFilename: id,
    plugins,
  });
}

function collectSceneCheckImports(program: AstNode): SceneCheckImports {
  const named = new Set<string>();
  const namespaces = new Set<string>();
  const body = nodeArray(program.body);

  for (const statement of body) {
    if (statement.type !== "ImportDeclaration") continue;
    const source = asNode(statement.source);
    if (source.type !== "StringLiteral" || source.value !== THREE_MODULE) continue;

    for (const specifier of nodeArray(statement.specifiers)) {
      const local = asNode(specifier.local);
      if (local.type !== "Identifier" || typeof local.name !== "string") continue;

      if (specifier.type === "ImportNamespaceSpecifier") {
        namespaces.add(local.name);
        continue;
      }
      if (specifier.type !== "ImportSpecifier") continue;

      const imported = asNode(specifier.imported);
      const importedName =
        imported.type === "Identifier" || imported.type === "StringLiteral"
          ? imported.name ?? imported.value
          : undefined;
      if (importedName === DESCRIBE_FUNCTION) named.add(local.name);
    }
  }

  return { named, namespaces };
}

function isDescribeThreeObjectCall(
  call: AstNode,
  imports: SceneCheckImports,
): boolean {
  const callee = asNode(call.callee);
  if (callee.type === "Identifier" && typeof callee.name === "string") {
    return imports.named.has(callee.name);
  }

  if (callee.type !== "MemberExpression" || callee.computed === true) return false;
  const object = asNode(callee.object);
  const property = asNode(callee.property);
  return (
    object.type === "Identifier" &&
    typeof object.name === "string" &&
    imports.namespaces.has(object.name) &&
    property.type === "Identifier" &&
    property.name === DESCRIBE_FUNCTION
  );
}

function hasSourceProperty(object: AstNode): boolean {
  return nodeArray(object.properties).some((property) => {
    if (
      property.type !== "ObjectProperty" &&
      property.type !== "ObjectMethod"
    ) {
      return false;
    }
    const key = asNode(property.key);
    return (
      (key.type === "Identifier" && key.name === "source") ||
      (key.type === "StringLiteral" && key.value === "source")
    );
  });
}

function inferEnclosingSymbol(ancestors: readonly AstNode[]): { symbol?: string } {
  for (let index = ancestors.length - 1; index >= 0; index -= 1) {
    const node = ancestors[index]!;
    if (node.type === "VariableDeclarator") {
      const id = asNode(node.id);
      if (id.type === "Identifier" && typeof id.name === "string") {
        return { symbol: id.name };
      }
    }
    if (
      node.type === "FunctionDeclaration" ||
      node.type === "FunctionExpression"
    ) {
      const id = asNode(node.id);
      if (id.type === "Identifier" && typeof id.name === "string") {
        return { symbol: id.name };
      }
    }
    if (
      node.type === "ObjectMethod" ||
      node.type === "ClassMethod" ||
      node.type === "ClassPrivateMethod"
    ) {
      const key = asNode(node.key);
      const name = propertyName(key);
      if (name) return { symbol: name };
    }
  }
  return {};
}

function propertyName(node: AstNode): string | undefined {
  if (node.type === "Identifier" && typeof node.name === "string") return node.name;
  if (node.type === "StringLiteral" && typeof node.value === "string") return node.value;
  if (node.type === "PrivateName") {
    const id = asNode(node.id);
    if (id.type === "Identifier" && typeof id.name === "string") return `#${id.name}`;
  }
  return undefined;
}

function walk(
  node: AstNode,
  ancestors: readonly AstNode[],
  callback: (node: AstNode, ancestors: readonly AstNode[]) => void,
): void {
  callback(node, ancestors);
  const nextAncestors = [...ancestors, node];

  for (const [key, value] of Object.entries(node)) {
    if (
      key === "loc" ||
      key === "start" ||
      key === "end" ||
      key === "extra" ||
      key === "errors"
    ) {
      continue;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        if (isNode(item)) walk(item, nextAncestors, callback);
      }
    } else if (isNode(value)) {
      walk(value, nextAncestors, callback);
    }
  }
}

function nodeArray(value: unknown): AstNode[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isNode);
}

function asNode(value: unknown): AstNode {
  return isNode(value) ? value : { type: "Unknown" };
}

function isNode(value: unknown): value is AstNode {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    typeof (value as { type?: unknown }).type === "string"
  );
}

function portableProjectPath(root: string, absoluteFile: string): string | undefined {
  const path = relative(root, absoluteFile);
  if (!path || path === ".." || path.startsWith(`..${sep}`)) return undefined;
  return path.split(sep).join("/");
}

function stripQuery(id: string): string {
  const queryIndex = id.indexOf("?");
  return queryIndex === -1 ? id : id.slice(0, queryIndex);
}

function isSupportedSource(id: string): boolean {
  const dot = id.lastIndexOf(".");
  return dot >= 0 && SUPPORTED_EXTENSIONS.has(id.slice(dot).toLowerCase());
}

function isNodeModule(id: string): boolean {
  return id.split(/[\\/]/u).includes("node_modules");
}

export default sceneCheckSourceLocations;
