// In-document Excalidraw editor; drafts reflow without mutating the document port.
import { Excalidraw } from "@excalidraw/excalidraw";
import { useCallback, useEffect, useState } from "react";

import type { BuilderBlockEditorProps } from "../builder/plugin";
import { editableReferenceIdError } from "../builder/referenceEditing";
import {
  requireExcalidrawDrawingBlock,
  type ExcalidrawDrawingBlock,
} from "./drawingModel";
import {
  captureExcalidrawScene,
  exportExcalidrawSceneToSvg,
  restoreExcalidrawScene,
} from "./drawingScene";

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
  referenceTargets,
}: BuilderBlockEditorProps) {
  const [draft, setDraft] = useState<ExcalidrawDrawingBlock>(() =>
    requireExcalidrawDrawingBlock(block),
  );
  const [exportState, setExportState] = useState<
    "idle" | "working" | "empty" | "failed"
  >("idle");
  const initialScene = useState(() => restoreExcalidrawScene(draft.scene))[0];

  const referenceError = editableReferenceIdError(
    draft.referenceId ?? "",
    draft.id,
    referenceTargets,
  );
  const valid = draft.caption.trim().length > 0 && referenceError === null;

  useEffect(() => {
    if (valid) {
      onPreview(draft);
    }
  }, [draft, onPreview, valid]);

  const updateDraft = useCallback(
    (change: Partial<Omit<ExcalidrawDrawingBlock, "id" | "typeId">>) => {
      setDraft((current) => Object.freeze({ ...current, ...change }));
    },
    [],
  );

  const exportSvg = useCallback(async () => {
    setExportState("working");
    try {
      const svg = await exportExcalidrawSceneToSvg(draft.scene);
      if (svg === null) {
        setExportState("empty");
        return;
      }
      downloadText(`${draft.id}.svg`, svg, "image/svg+xml;charset=utf-8");
      setExportState("idle");
    } catch {
      setExportState("failed");
    }
  }, [draft.id, draft.scene]);

  return (
    <div className="drawing-editor" data-testid="excalidraw-drawing-editor">
      <div className="drawing-editor__canvas">
        <Excalidraw
          name={`Drawing ${draft.id}`}
          initialData={{
            elements: initialScene.elements,
            appState: {
              ...initialScene.appState,
              viewBackgroundColor: "#ffffff",
            },
            files: initialScene.files,
            scrollToContent: true,
          }}
          onChange={(elements, appState, files) => {
            const scene = captureExcalidrawScene(elements, appState, files);
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
      <aside className="drawing-editor__settings">
        <header>
          <strong>Embedded scene</strong>
          <small>Changes are drafts until saved.</small>
        </header>
        <label>
          <span>Caption</span>
          <textarea
            value={draft.caption}
            onChange={(event) => {
              updateDraft({ caption: event.target.value });
            }}
          />
        </label>
        {referenceError === null ? null : (
          <small className="editor-error">{referenceError}</small>
        )}
        <label>
          <span>Reference ID</span>
          <input
            value={draft.referenceId ?? ""}
            pattern="[A-Za-z][A-Za-z0-9_.:-]*"
            placeholder="fig:diagram"
            onChange={(event) => {
              updateDraft({
                referenceId: event.target.value.trim().length === 0 ? null : event.target.value,
              });
            }}
          />
        </label>
        <label>
          <span>Width · {Math.round(draft.widthFraction * 100)}%</span>
          <input
            data-testid="drawing-width"
            type="range"
            min="30"
            max="100"
            step="1"
            value={Math.round(draft.widthFraction * 100)}
            onChange={(event) => {
              updateDraft({ widthFraction: Number(event.target.value) / 100 });
            }}
          />
        </label>
        <small>The drawing height follows its content automatically.</small>
        <button
          type="button"
          disabled={exportState === "working"}
          onClick={() => void exportSvg()}
        >
          {exportState === "working" ? "Rendering SVG…" : "Export SVG"}
        </button>
        {exportState === "empty" ? <small>Draw something before exporting.</small> : null}
        {exportState === "failed" ? <small>Could not render this scene as SVG.</small> : null}
        <div className="drawing-editor__actions">
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="primary-action"
            type="button"
            disabled={!valid}
            onClick={() => {
              onCommit(draft);
            }}
          >
            Save drawing
          </button>
        </div>
      </aside>
    </div>
  );
}
