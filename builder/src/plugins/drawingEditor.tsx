// Fixed-artboard Excalidraw editing and separately invoked document settings.
import {
  CaptureUpdateAction,
  Excalidraw,
  convertToExcalidrawElements,
  zoomToFitBounds,
} from "@excalidraw/excalidraw";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { BuilderBlockEditorProps } from "../builder/plugin";
import { editableReferenceIdError } from "../builder/referenceEditing";
import {
  excalidrawArtboardWidth,
  maximumExcalidrawArtboardHeight,
  minimumExcalidrawArtboardHeight,
  requireExcalidrawDrawingBlock,
  type ExcalidrawDrawingBlock,
} from "./drawingModel";
import {
  captureExcalidrawScene,
  exportExcalidrawSceneToSvg,
  restoreExcalidrawScene,
} from "./drawingScene";

const artboardGuideId = "dans-builder-drawing-artboard-guide";
const cameraInsets = Object.freeze({
  top: 12,
  right: 20,
  bottom: 72,
  left: 272,
});

interface LockedCamera {
  readonly scrollX: number;
  readonly scrollY: number;
  readonly zoom: ReturnType<ExcalidrawImperativeAPI["getAppState"]>["zoom"];
}

function editorHeightForWidth(width: number, artboardHeight: number): number {
  const widthZoom = Math.min(
    1,
    Math.max(
      0.1,
      (width - cameraInsets.left - cameraInsets.right) / excalidrawArtboardWidth,
    ),
  );
  return Math.min(
    Math.max(320, globalThis.innerHeight - 150),
    Math.ceil(
      cameraInsets.top + artboardHeight * widthZoom + cameraInsets.bottom,
    ),
  );
}

function createArtboardGuide(height: number): ExcalidrawElement {
  const [guide] = convertToExcalidrawElements(
    [
      {
        id: artboardGuideId,
        type: "rectangle",
        x: 0,
        y: 0,
        width: excalidrawArtboardWidth,
        height,
        strokeColor: "#4c6ef5",
        backgroundColor: "#ffffff",
        fillStyle: "solid",
        strokeStyle: "dashed",
        roughness: 0,
        opacity: 38,
        locked: true,
      },
    ],
    { regenerateIds: false },
  );
  if (guide === undefined) {
    throw new Error("Could not create the drawing artboard guide");
  }
  return guide;
}

function downloadText(filename: string, text: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  globalThis.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);
}

export function ExcalidrawDrawingEditor({
  block,
  onPreview,
  onCommit,
  onCancel,
}: BuilderBlockEditorProps) {
  const [draft, setDraft] = useState<ExcalidrawDrawingBlock>(() =>
    requireExcalidrawDrawingBlock(block),
  );
  const canvasRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const cameraRef = useRef<LockedCamera | null>(null);
  const fitFrameRef = useRef<number | null>(null);
  const [editorHeight, setEditorHeight] = useState(() =>
    editorHeightForWidth(
      Math.min(1_440, Math.max(320, globalThis.innerWidth - 32)),
      draft.artboardHeight,
    ),
  );
  const [initialScene] = useState(() => {
    const restored = restoreExcalidrawScene(draft.scene);
    return {
      elements: [createArtboardGuide(draft.artboardHeight), ...restored.elements],
      appState: restored.appState,
      files: restored.files,
    };
  });

  useEffect(() => {
    onPreview(draft);
  }, [draft, onPreview]);

  const fitArtboard = useCallback((): void => {
    const api = apiRef.current;
    if (api === null) {
      return;
    }
    const canvas = canvasRef.current;
    if (canvas === null) {
      return;
    }
    cameraRef.current = null;
    const appState = api.getAppState();
    const fitted = zoomToFitBounds({
      bounds: [0, 0, excalidrawArtboardWidth, draft.artboardHeight],
      appState,
      canvasOffsets: cameraInsets,
      fitToViewport: true,
      viewportZoomFactor: 1,
      minZoom: 0.1,
      maxZoom: 1,
    });
    const zoom = fitted.appState.zoom;
    const scrollX =
      (canvas.clientWidth - cameraInsets.right) / zoom.value -
      excalidrawArtboardWidth;
    const scrollY = cameraInsets.top / zoom.value;
    canvas.dataset.artboardViewportLeft = String(scrollX * zoom.value);
    canvas.dataset.artboardViewportRight = String(
      (scrollX + excalidrawArtboardWidth) * zoom.value,
    );
    canvas.dataset.artboardViewportTop = String(scrollY * zoom.value);
    canvas.dataset.artboardViewportBottom = String(
      (scrollY + draft.artboardHeight) * zoom.value,
    );
    api.updateScene({
      appState: { scrollX, scrollY, zoom },
      captureUpdate: CaptureUpdateAction.NEVER,
    });
    if (fitFrameRef.current !== null) {
      cancelAnimationFrame(fitFrameRef.current);
    }
    fitFrameRef.current = requestAnimationFrame(() => {
      fitFrameRef.current = null;
      const nextAppState = api.getAppState();
      cameraRef.current = {
        scrollX: nextAppState.scrollX,
        scrollY: nextAppState.scrollY,
        zoom: nextAppState.zoom,
      };
    });
  }, [draft.artboardHeight]);

  const installApi = useCallback(
    (api: ExcalidrawImperativeAPI): void => {
      apiRef.current = api;
      requestAnimationFrame(fitArtboard);
    },
    [fitArtboard],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) {
      return;
    }
    const observer = new ResizeObserver(([entry]) => {
      if (entry === undefined) {
        return;
      }
      setEditorHeight((current) => {
        const next = editorHeightForWidth(entry.contentRect.width, draft.artboardHeight);
        return current === next ? current : next;
      });
      fitArtboard();
    });
    observer.observe(canvas);
    return () => {
      observer.disconnect();
      if (fitFrameRef.current !== null) {
        cancelAnimationFrame(fitFrameRef.current);
      }
    };
  }, [draft.artboardHeight, fitArtboard]);

  return (
    <div
      className="drawing-editor"
      data-testid="excalidraw-drawing-editor"
      style={{ height: editorHeight }}
    >
      <div
        ref={canvasRef}
        className="drawing-editor__canvas"
        onWheelCapture={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        onPointerDownCapture={(event) => {
          if (event.button === 1) {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
      >
        <Excalidraw
          name={`Drawing ${draft.id}`}
          initialData={{
            elements: initialScene.elements,
            appState: {
              ...initialScene.appState,
              viewBackgroundColor: "#eef1f5",
            },
            files: initialScene.files,
            scrollToContent: false,
          }}
          excalidrawAPI={installApi}
          onScrollChange={(scrollX, scrollY, zoom) => {
            const locked = cameraRef.current;
            const api = apiRef.current;
            if (
              locked === null ||
              api === null ||
              locked.scrollX === scrollX &&
                locked.scrollY === scrollY &&
                locked.zoom.value === zoom.value
            ) {
              return;
            }
            api.updateScene({
              appState: {
                scrollX: locked.scrollX,
                scrollY: locked.scrollY,
                zoom: locked.zoom,
              },
              captureUpdate: CaptureUpdateAction.NEVER,
            });
          }}
          onChange={(elements, appState, files) => {
            const scene = captureExcalidrawScene(
              elements.filter(({ id }) => id !== artboardGuideId),
              appState,
              files,
            );
            setDraft((current) =>
              JSON.stringify(current.scene) === JSON.stringify(scene)
                ? current
                : Object.freeze({ ...current, scene }),
            );
          }}
          autoFocus
          handleKeyboardGlobally={false}
          UIOptions={{
            canvasActions: {
              changeViewBackgroundColor: false,
              clearCanvas: false,
              loadScene: false,
              saveToActiveFile: false,
              saveAsImage: false,
              export: false,
              toggleTheme: false,
            },
            tools: { image: true },
          }}
        />
      </div>
      <div className="drawing-editor__actions">
        <button type="button" onClick={onCancel}>Cancel</button>
        <button
          className="primary-action"
          type="button"
          onClick={() => {
            onCommit(draft);
          }}
        >
          Save drawing
        </button>
      </div>
    </div>
  );
}

export function ExcalidrawDrawingSettingsEditor({
  block,
  onPreview,
  onCommit,
  onCancel,
  referenceTargets,
}: BuilderBlockEditorProps) {
  const drawing = requireExcalidrawDrawingBlock(block);
  const [caption, setCaption] = useState(drawing.caption);
  const [referenceId, setReferenceId] = useState(drawing.referenceId ?? "");
  const [widthPercent, setWidthPercent] = useState(drawing.widthFraction * 100);
  const [artboardHeight, setArtboardHeight] = useState(drawing.artboardHeight);
  const [exportState, setExportState] = useState<"idle" | "working" | "failed">("idle");
  const referenceError = editableReferenceIdError(
    referenceId,
    drawing.id,
    referenceTargets,
  );
  const valid =
    caption.trim().length > 0 &&
    referenceError === null &&
    Number.isFinite(widthPercent) &&
    widthPercent >= 20 &&
    widthPercent <= 100 &&
    Number.isFinite(artboardHeight) &&
    artboardHeight >= minimumExcalidrawArtboardHeight &&
    artboardHeight <= maximumExcalidrawArtboardHeight;
  const draft = useMemo<ExcalidrawDrawingBlock>(
    () => Object.freeze({
      ...drawing,
      caption,
      referenceId: referenceId.trim().length === 0 ? null : referenceId,
      widthFraction: widthPercent / 100,
      artboardHeight,
    }),
    [artboardHeight, caption, drawing, referenceId, widthPercent],
  );

  useEffect(() => {
    if (valid) {
      onPreview(draft);
    }
  }, [draft, onPreview, valid]);

  const exportSvg = async (): Promise<void> => {
    setExportState("working");
    try {
      const svg = await exportExcalidrawSceneToSvg(draft.scene, draft.artboardHeight);
      downloadText(`${draft.id}.svg`, svg, "image/svg+xml;charset=utf-8");
      setExportState("idle");
    } catch {
      setExportState("failed");
    }
  };

  return (
    <form
      className="block-editor-form drawing-settings-editor"
      data-testid="drawing-settings-editor"
      onSubmit={(event) => {
        event.preventDefault();
        if (valid) {
          onCommit(draft);
        }
      }}
    >
      <label className="editor-field">
        <span>Caption</span>
        <textarea
          value={caption}
          onChange={(event) => {
            setCaption(event.target.value);
          }}
        />
      </label>
      {referenceError === null ? null : <p className="editor-error">{referenceError}</p>}
      <label className="editor-field">
        <span>Reference ID · optional</span>
        <input
          value={referenceId}
          pattern="[A-Za-z][A-Za-z0-9_.:-]*"
          placeholder="fig:diagram"
          onChange={(event) => {
            setReferenceId(event.target.value);
          }}
        />
      </label>
      <div className="drawing-settings-editor__dimensions">
        <label className="editor-field">
          <span>Document width (%)</span>
          <input
            data-testid="drawing-width"
            type="number"
            min="20"
            max="100"
            step="1"
            value={widthPercent}
            onChange={(event) => {
              setWidthPercent(Number(event.target.value));
            }}
          />
        </label>
        <label className="editor-field">
          <span>Artboard height ({String(excalidrawArtboardWidth)}-unit width)</span>
          <input
            data-testid="drawing-height"
            type="number"
            min={minimumExcalidrawArtboardHeight}
            max={maximumExcalidrawArtboardHeight}
            step="10"
            value={artboardHeight}
            onChange={(event) => {
              setArtboardHeight(Number(event.target.value));
            }}
          />
        </label>
      </div>
      <small>
        The artboard is fixed while drawing. At 100%, its width is exactly the document content width.
      </small>
      <button
        type="button"
        disabled={exportState === "working" || !valid}
        onClick={() => void exportSvg()}
      >
        {exportState === "working" ? "Rendering SVG…" : "Export SVG"}
      </button>
      {exportState === "failed" ? <small>Could not render this scene as SVG.</small> : null}
      <div className="editor-actions">
        <button type="button" onClick={onCancel}>Cancel</button>
        <button className="primary-action" type="submit" disabled={!valid}>Save settings</button>
      </div>
    </form>
  );
}
