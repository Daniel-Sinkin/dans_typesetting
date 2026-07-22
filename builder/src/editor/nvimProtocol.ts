// Typed messages for the localhost-only Neovim terminal bridge.
export const nvimWebSocketPath = "/api/nvim/session";
export const nvimSourceMaximumCharacters = 2_000_000;

export interface NvimStartMessage {
  readonly type: "start";
  readonly source: string;
  readonly fileName: string;
  readonly columns: number;
  readonly rows: number;
}

export interface NvimInputMessage {
  readonly type: "input";
  readonly data: string;
}

export interface NvimResizeMessage {
  readonly type: "resize";
  readonly columns: number;
  readonly rows: number;
}

export interface NvimTerminateMessage {
  readonly type: "terminate";
}

export type NvimClientMessage =
  | NvimStartMessage
  | NvimInputMessage
  | NvimResizeMessage
  | NvimTerminateMessage;

export type NvimServerMessage =
  | Readonly<{ type: "ready"; fileName: string }>
  | Readonly<{ type: "data"; data: string }>
  | Readonly<{ type: "write"; source: string }>
  | Readonly<{ type: "exit"; exitCode: number; signal: number | null }>
  | Readonly<{ type: "error"; message: string }>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function terminalDimension(value: unknown, name: string, minimum: number, maximum: number): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < minimum ||
    value > maximum
  ) {
    throw new Error(`${name} must be an integer in [${String(minimum)}, ${String(maximum)}]`);
  }
  return value;
}

function terminalSize(value: Record<string, unknown>): Readonly<{ columns: number; rows: number }> {
  return {
    columns: terminalDimension(value.columns, "columns", 20, 400),
    rows: terminalDimension(value.rows, "rows", 5, 200),
  };
}

function requireFileName(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^[a-z0-9][a-z0-9._-]{0,120}$/iu.test(value)
  ) {
    throw new Error("fileName must be a short portable basename");
  }
  return value;
}

export function parseNvimClientMessage(value: unknown): NvimClientMessage {
  if (!isRecord(value) || typeof value.type !== "string") {
    throw new Error("Neovim bridge messages must be typed objects");
  }
  if (value.type === "start") {
    if (
      typeof value.source !== "string" ||
      value.source.length > nvimSourceMaximumCharacters
    ) {
      throw new Error("Neovim source is missing or too large");
    }
    return {
      type: "start",
      source: value.source,
      fileName: requireFileName(value.fileName),
      ...terminalSize(value),
    };
  }
  if (value.type === "input") {
    if (typeof value.data !== "string" || value.data.length > 65_536) {
      throw new Error("Neovim input is missing or too large");
    }
    return { type: "input", data: value.data };
  }
  if (value.type === "resize") {
    return { type: "resize", ...terminalSize(value) };
  }
  if (value.type === "terminate") {
    return { type: "terminate" };
  }
  throw new Error(`Unknown Neovim bridge message: ${value.type}`);
}

export function parseNvimServerMessage(value: unknown): NvimServerMessage {
  if (!isRecord(value) || typeof value.type !== "string") {
    throw new Error("Neovim server messages must be typed objects");
  }
  if (value.type === "ready" && typeof value.fileName === "string") {
    return { type: "ready", fileName: value.fileName };
  }
  if (
    (value.type === "data" || value.type === "write") &&
    typeof value.source !== "string" &&
    typeof value.data !== "string"
  ) {
    throw new Error(`Neovim ${value.type} message is malformed`);
  }
  if (value.type === "data" && typeof value.data === "string") {
    return { type: "data", data: value.data };
  }
  if (value.type === "write" && typeof value.source === "string") {
    return { type: "write", source: value.source };
  }
  if (
    value.type === "exit" &&
    typeof value.exitCode === "number" &&
    (value.signal === null || typeof value.signal === "number")
  ) {
    return { type: "exit", exitCode: value.exitCode, signal: value.signal };
  }
  if (value.type === "error" && typeof value.message === "string") {
    return { type: "error", message: value.message };
  }
  throw new Error(`Malformed Neovim server message: ${value.type}`);
}
