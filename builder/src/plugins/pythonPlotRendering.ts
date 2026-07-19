// Browser-side client for the local trusted-Python rendering capability.
import {
  pythonPlotRenderEndpoint,
  type PythonPlotBlock,
} from "./pythonPlotModel";

interface ErrorPayload {
  readonly error?: unknown;
}

export async function requestPythonPlotSvg(
  plot: PythonPlotBlock,
  signal?: AbortSignal,
): Promise<string> {
  const request: RequestInit = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      source: plot.source,
      pixelWidth: plot.targetPixelWidth,
      pixelHeight: plot.targetPixelHeight,
    }),
  };
  if (signal !== undefined) {
    request.signal = signal;
  }
  const response = await fetch(pythonPlotRenderEndpoint, request);
  const body = await response.text();
  if (!response.ok) {
    let message = body;
    try {
      const parsed = JSON.parse(body) as ErrorPayload;
      if (typeof parsed.error === "string") {
        message = parsed.error;
      }
    } catch {
      // A non-JSON diagnostic is still useful verbatim.
    }
    throw new Error(message.length === 0 ? "Could not render Python plot" : message);
  }
  if (!body.includes("<svg")) {
    throw new Error("Python plot endpoint returned a non-SVG response");
  }
  return body;
}
