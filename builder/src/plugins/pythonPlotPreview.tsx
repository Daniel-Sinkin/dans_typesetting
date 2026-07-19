// Debounced asynchronous SVG projection behind a non-executable image boundary.
import { useEffect, useMemo, useState } from "react";

import type { PythonPlotBlock } from "./pythonPlotModel";
import { requestPythonPlotSvg } from "./pythonPlotRendering";

interface RenderState {
  readonly key: string;
  readonly source: string | null;
  readonly error: string | null;
}

export function PythonPlotPreview({
  plot,
}: Readonly<{ plot: PythonPlotBlock }>) {
  const renderKey = useMemo(
    () =>
      JSON.stringify([
        plot.source,
        plot.targetPixelWidth,
        plot.targetPixelHeight,
      ]),
    [plot.source, plot.targetPixelHeight, plot.targetPixelWidth],
  );
  const [rendered, setRendered] = useState<RenderState | null>(null);

  useEffect(() => {
    const abortController = new AbortController();
    let objectUrl: string | null = null;
    const timer = globalThis.setTimeout(() => {
      void requestPythonPlotSvg(plot, abortController.signal)
        .then((svg) => {
          if (abortController.signal.aborted) {
            return;
          }
          objectUrl = URL.createObjectURL(
            new Blob([svg], { type: "image/svg+xml" }),
          );
          setRendered({ key: renderKey, source: objectUrl, error: null });
        })
        .catch((reason: unknown) => {
          if (abortController.signal.aborted) {
            return;
          }
          setRendered({
            key: renderKey,
            source: null,
            error:
              reason instanceof Error
                ? reason.message
                : "Could not render Python plot",
          });
        });
    }, 220);
    return () => {
      globalThis.clearTimeout(timer);
      abortController.abort();
      if (objectUrl !== null) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [plot, renderKey]);

  const current = rendered?.key === renderKey ? rendered : null;
  return (
    <div
      className="python-plot-preview"
      data-testid="python-plot-preview"
      style={{ width: `${String(plot.widthFraction * 100)}%` }}
    >
      {current?.error === null && current.source !== null ? (
        <img src={current.source} alt="Generated Python plot" />
      ) : current?.error !== null && current !== null ? (
        <pre className="python-plot-preview__error">{current.error}</pre>
      ) : (
        <div className="python-plot-preview__status">Rendering Python plot…</div>
      )}
    </div>
  );
}
