export interface SourceLocation {
  /** Project-relative source file when known. Use forward slashes for portable output. */
  file: string;
  /** 1-based source line. */
  line?: number;
  /** 1-based source column. */
  column?: number;
  /** Optional nearby application symbol/component/factory name. */
  symbol?: string;
}

export function normalizeSourceLocation(source: SourceLocation): SourceLocation {
  const file = source.file.trim().replaceAll("\\", "/");
  if (!file) throw new Error("SceneCheck source file cannot be empty.");

  const line = normalizePositiveInteger(source.line, "line");
  const column = normalizePositiveInteger(source.column, "column");
  const symbol = source.symbol?.trim();
  if (source.symbol !== undefined && !symbol) {
    throw new Error("SceneCheck source symbol cannot be empty when provided.");
  }

  return {
    file,
    ...(line !== undefined ? { line } : {}),
    ...(column !== undefined ? { column } : {}),
    ...(symbol ? { symbol } : {}),
  };
}

export function cloneSourceLocation(source: SourceLocation): SourceLocation {
  return {
    file: source.file,
    ...(source.line !== undefined ? { line: source.line } : {}),
    ...(source.column !== undefined ? { column: source.column } : {}),
    ...(source.symbol ? { symbol: source.symbol } : {}),
  };
}

function normalizePositiveInteger(
  value: number | undefined,
  field: "line" | "column",
): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`SceneCheck source ${field} must be a positive integer. Received: ${value}`);
  }
  return value;
}
