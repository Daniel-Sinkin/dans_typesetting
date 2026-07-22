// Asynchronously project an Excalidraw scene through the plugin's safe SVG boundary.
import { useEffect, useState } from "react";

import type { ExcalidrawScenePayload } from "./drawingModel";
import { exportExcalidrawSceneToSvg } from "./drawingScene";

export function DrawingScenePreview({
  scene,
  artboardHeight,
}: {
  readonly scene: ExcalidrawScenePayload;
  readonly artboardHeight: number;
}) {
  const [rendered, setRendered] = useState<{
    readonly scene: ExcalidrawScenePayload;
    readonly source: string | null;
    readonly error: string | null;
  } | null>(null);

  useEffect(() => {
    let disposed = false;
    let objectUrl: string | null = null;
    const timer = globalThis.setTimeout(() => {
      void exportExcalidrawSceneToSvg(scene, artboardHeight)
        .then((svg) => {
          if (disposed) {
            return;
          }
          objectUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
          setRendered({ scene, source: objectUrl, error: null });
        })
        .catch((reason: unknown) => {
          if (!disposed) {
            setRendered({
              scene,
              source: null,
              error: reason instanceof Error ? reason.message : "Could not render drawing",
            });
          }
        });
    }, 80);
    return () => {
      disposed = true;
      globalThis.clearTimeout(timer);
      if (objectUrl !== null) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [artboardHeight, scene]);

  const source = rendered?.scene === scene ? rendered.source : null;
  const error = rendered?.scene === scene ? rendered.error : null;
  if (error !== null) {
    return <div className="drawing-preview-status drawing-preview-status--error">{error}</div>;
  }
  if (source === null) {
    return <div className="drawing-preview-status">Rendering fixed artboard…</div>;
  }
  return <img src={source} alt="Rendered Excalidraw scene" />;
}
