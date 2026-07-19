// Local-only Vite capability for rendering trusted Python/Matplotlib source.
import { spawn } from "node:child_process";
import type { IncomingMessage, ServerResponse } from "node:http";
import { resolve } from "node:path";

import type { Plugin, PreviewServer, ViteDevServer } from "vite";

import {
  pythonPlotExtentMaximum,
  pythonPlotExtentMinimum,
  pythonPlotRenderEndpoint,
  pythonPlotSourceByteLength,
  pythonPlotSourceMaximumBytes,
} from "../plugins/pythonPlotModel";

// JSON can expand a valid source byte sixfold when it escapes control bytes.
export const pythonPlotRequestLimit = 640 * 1024;
export const pythonPlotOutputLimit = 6 * 1024 * 1024;
export const pythonPlotErrorLimit = 64 * 1024;
export const pythonPlotTimeoutMs = 8_000;

export interface PythonPlotRenderRequest {
  readonly source: string;
  readonly pixelWidth: number;
  readonly pixelHeight: number;
}

interface PythonPlotRenderOptions {
  readonly pythonExecutable?: string;
  readonly rendererPath?: string;
  readonly signal?: AbortSignal;
  readonly timeoutMs?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requirePixelExtent(value: unknown, field: string): number {
  if (
    !Number.isSafeInteger(value) ||
    typeof value !== "number" ||
    value < pythonPlotExtentMinimum ||
    value > pythonPlotExtentMaximum
  ) {
    throw new Error(
      `${field} must be an integer in [${String(pythonPlotExtentMinimum)}, ${String(pythonPlotExtentMaximum)}]`,
    );
  }
  return value;
}

export function parsePythonPlotRenderRequest(
  value: unknown,
): PythonPlotRenderRequest {
  if (!isRecord(value)) {
    throw new Error("Plot render request must be an object");
  }
  if (
    typeof value.source !== "string" ||
    value.source.trim().length === 0 ||
    pythonPlotSourceByteLength(value.source) > pythonPlotSourceMaximumBytes
  ) {
    throw new Error(
      `Plot source must contain between 1 and ${String(pythonPlotSourceMaximumBytes)} UTF-8 bytes`,
    );
  }
  return Object.freeze({
    source: value.source,
    pixelWidth: requirePixelExtent(value.pixelWidth, "pixelWidth"),
    pixelHeight: requirePixelExtent(value.pixelHeight, "pixelHeight"),
  });
}

export function renderPythonPlotSvg(
  request: PythonPlotRenderRequest,
  options: PythonPlotRenderOptions = {},
): Promise<string> {
  const validated = parsePythonPlotRenderRequest(request);
  const rendererPath =
    options.rendererPath ??
    resolve(import.meta.dirname, "../../scripts/render_python_plot.py");
  const pythonExecutable = options.pythonExecutable ?? "python3";
  const timeoutMs = options.timeoutMs ?? pythonPlotTimeoutMs;

  return new Promise((resolveRender, rejectRender) => {
    const child = spawn(pythonExecutable, [rendererPath], {
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    const output: Buffer[] = [];
    const diagnostics: Buffer[] = [];
    let outputBytes = 0;
    let diagnosticBytes = 0;
    let forcedError: Error | null = null;
    let settled = false;

    const rejectOnce = (error: Error): void => {
      if (!settled) {
        settled = true;
        rejectRender(error);
      }
    };
    const timer = globalThis.setTimeout(() => {
      forcedError = new Error(
        `Python plot rendering exceeded ${String(timeoutMs)} ms`,
      );
      child.kill("SIGKILL");
    }, timeoutMs);

    const abort = (): void => {
      forcedError = new Error("Python plot rendering was cancelled");
      child.kill("SIGKILL");
    };
    options.signal?.addEventListener("abort", abort, { once: true });

    child.stdout.on("data", (chunk: Buffer) => {
      outputBytes += chunk.length;
      if (outputBytes > pythonPlotOutputLimit) {
        forcedError = new Error("Python plot SVG exceeded the output-size limit");
        child.kill("SIGKILL");
        return;
      }
      output.push(chunk);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      const remaining = pythonPlotErrorLimit - diagnosticBytes;
      if (remaining <= 0) {
        return;
      }
      const retained = chunk.subarray(0, remaining);
      diagnosticBytes += retained.length;
      diagnostics.push(retained);
    });
    child.on("error", (error) => {
      globalThis.clearTimeout(timer);
      options.signal?.removeEventListener("abort", abort);
      rejectOnce(error);
    });
    child.on("close", (code, signal) => {
      globalThis.clearTimeout(timer);
      options.signal?.removeEventListener("abort", abort);
      if (settled) {
        return;
      }
      if (forcedError !== null) {
        rejectOnce(forcedError);
        return;
      }
      if (code !== 0) {
        const diagnostic = Buffer.concat(diagnostics).toString("utf8").trim();
        rejectOnce(
          new Error(
            diagnostic.length > 0
              ? diagnostic
              : `Python plot renderer exited with ${code === null ? signal ?? "no status" : String(code)}`,
          ),
        );
        return;
      }
      const svg = Buffer.concat(output).toString("utf8");
      if (!svg.includes("<svg")) {
        rejectOnce(new Error("Python plot renderer did not return SVG"));
        return;
      }
      settled = true;
      resolveRender(svg);
    });
    child.stdin.on("error", (error) => {
      if ((error as NodeJS.ErrnoException).code !== "EPIPE") {
        forcedError = error;
        child.kill("SIGKILL");
      }
    });
    child.stdin.end(JSON.stringify(validated));
  });
}

function readRequestBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolveBody, rejectBody) => {
    const chunks: Buffer[] = [];
    let bytes = 0;
    request.on("data", (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > pythonPlotRequestLimit) {
        rejectBody(new Error("Plot render request exceeded the request-size limit"));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      resolveBody(Buffer.concat(chunks).toString("utf8"));
    });
    request.on("error", rejectBody);
  });
}

function writeJsonError(
  response: ServerResponse,
  statusCode: number,
  error: unknown,
): void {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(
    JSON.stringify({
      error: error instanceof Error ? error.message : "Unknown plot-rendering error",
    }),
  );
}

async function handlePythonPlotRender(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    writeJsonError(response, 405, new Error("Python plot rendering requires POST"));
    return;
  }
  const abortController = new AbortController();
  request.once("aborted", () => {
    abortController.abort();
  });
  try {
    const body = await readRequestBody(request);
    const parsed = JSON.parse(body) as unknown;
    const svg = await renderPythonPlotSvg(parsePythonPlotRenderRequest(parsed), {
      signal: abortController.signal,
    });
    response.statusCode = 200;
    response.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
    response.setHeader("Cache-Control", "no-store");
    response.end(svg);
  } catch (error) {
    if (!response.headersSent) {
      writeJsonError(response, 422, error);
    }
  }
}

function registerMiddleware(server: ViteDevServer | PreviewServer): void {
  server.middlewares.use(pythonPlotRenderEndpoint, (request, response) => {
    void handlePythonPlotRender(request, response);
  });
}

export function pythonPlotRendererPlugin(): Plugin {
  return {
    name: "dans-python-plot-renderer",
    configureServer(server) {
      registerMiddleware(server);
    },
    configurePreviewServer(server) {
      registerMiddleware(server);
    },
  };
}
