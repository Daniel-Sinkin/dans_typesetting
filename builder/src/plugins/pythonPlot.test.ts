import { afterEach, describe, expect, it, vi } from "vitest";

import { MemoryDocumentPort } from "../model/document";
import { projectDocumentTransport } from "../transport/projectTransport";
import {
  createPythonPlotBlock,
  requirePythonPlotBlock,
} from "./pythonPlotModel";
import { requestPythonPlotSvg } from "./pythonPlotRendering";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("trusted Python plot blocks", () => {
  it("round-trips source and deterministic rendering intent exactly", () => {
    const block = createPythonPlotBlock(
      "plot",
      "figure, axis = plt.subplots()\naxis.plot([1], [2])\n",
      0.625,
      1440,
      900,
    );
    const source = projectDocumentTransport.toString(
      new MemoryDocumentPort([block]).getSnapshot(),
    );
    const decoded = projectDocumentTransport.fromString(source);
    const normalized = projectDocumentTransport.toString(
      new MemoryDocumentPort(decoded.blocks, decoded.metadata).getSnapshot(),
    );
    const decodedPlot = decoded.blocks[0];
    if (decodedPlot === undefined) {
      throw new Error("Python plot transport lost its block");
    }

    expect(normalized).toBe(source);
    expect(requirePythonPlotBlock(decodedPlot)).toEqual(block);
  });

  it("rejects empty source, invalid width, and unsafe target dimensions", () => {
    expect(() => createPythonPlotBlock("empty", "  \n")).toThrow(/source/u);
    expect(() =>
      createPythonPlotBlock("utf8-limit", "é".repeat(50_001)),
    ).toThrow(/UTF-8 bytes/u);
    expect(() => createPythonPlotBlock("wide", "plt.plot([])", 1.1)).toThrow(
      /widthFraction/u,
    );
    expect(() =>
      createPythonPlotBlock("huge", "plt.plot([])", 1, 8192, 720),
    ).toThrow(/dimensions/u);
  });

  it("requests SVG through the local image boundary and preserves diagnostics", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response("<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>", {
          status: 200,
          headers: { "Content-Type": "image/svg+xml" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Python syntax exploded" }), {
          status: 422,
          headers: { "Content-Type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const plot = createPythonPlotBlock("plot", "plt.plot([1], [2])", 0.5, 640, 360);

    await expect(requestPythonPlotSvg(plot)).resolves.toContain("<svg");
    const request = fetchMock.mock.calls[0]?.[1];
    if (typeof request?.body !== "string") {
      throw new Error("Python plot request did not contain a JSON string body");
    }
    expect(JSON.parse(request.body)).toEqual({
      source: plot.source,
      pixelWidth: 640,
      pixelHeight: 360,
    });
    await expect(requestPythonPlotSvg(plot)).rejects.toThrow(
      "Python syntax exploded",
    );
  });
});
