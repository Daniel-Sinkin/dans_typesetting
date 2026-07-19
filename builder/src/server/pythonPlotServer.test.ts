/* @vitest-environment node */
import { describe, expect, it } from "vitest";

import {
  parsePythonPlotRenderRequest,
  renderPythonPlotSvg,
} from "./pythonPlotServer";

describe("local Python plot renderer", () => {
  it("executes trusted NumPy/Matplotlib source and returns SVG", async () => {
    const svg = await renderPythonPlotSvg({
      source: [
        "x = np.linspace(0.0, 1.0, 8)",
        "figure, axis = plt.subplots()",
        "axis.plot(x, x ** 2)",
      ].join("\n"),
      pixelWidth: 640,
      pixelHeight: 360,
    });

    expect(svg).toContain("<svg");
    expect(svg).toContain("width=\"460.8pt\"");
  }, 10_000);

  it("returns renderer diagnostics and terminates runaway source", async () => {
    await expect(
      renderPythonPlotSvg({
        source: "this is not valid Python",
        pixelWidth: 640,
        pixelHeight: 360,
      }),
    ).rejects.toThrow(/SyntaxError/u);
    await expect(
      renderPythonPlotSvg(
        {
          source: "while True:\n    pass",
          pixelWidth: 640,
          pixelHeight: 360,
        },
        { timeoutMs: 100 },
      ),
    ).rejects.toThrow(/exceeded 100 ms/u);
  }, 10_000);

  it("rejects malformed requests before starting Python", () => {
    expect(() =>
      parsePythonPlotRenderRequest({
        source: "plt.plot([])",
        pixelWidth: 32,
        pixelHeight: 360,
      }),
    ).toThrow(/pixelWidth/u);
    expect(() => parsePythonPlotRenderRequest([])).toThrow(/object/u);
  });
});
