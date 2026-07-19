// Side-by-side trusted Python source editing and live Matplotlib preview.
import { useEffect, useMemo, useState } from "react";

import type { BuilderBlockEditorProps } from "../builder/plugin";
import { insertSpacesAtSelection } from "./codeListingEditing";
import {
  createPythonPlotBlock,
  pythonPlotExtentMaximum,
  pythonPlotExtentMinimum,
  pythonPlotSourceByteLength,
  pythonPlotSourceMaximumBytes,
  requirePythonPlotBlock,
  type PythonPlotBlock,
} from "./pythonPlotModel";
import { PythonPlotPreview } from "./pythonPlotPreview";

export function PythonPlotEditor({
  block,
  onPreview,
  onCommit,
  onCancel,
}: BuilderBlockEditorProps) {
  const plot = requirePythonPlotBlock(block);
  const [source, setSource] = useState(plot.source);
  const [widthFraction, setWidthFraction] = useState(plot.widthFraction);
  const [pixelWidth, setPixelWidth] = useState(plot.targetPixelWidth);
  const [pixelHeight, setPixelHeight] = useState(plot.targetPixelHeight);
  const valid =
    source.trim().length > 0 &&
    pythonPlotSourceByteLength(source) <= pythonPlotSourceMaximumBytes &&
    Number.isSafeInteger(pixelWidth) &&
    Number.isSafeInteger(pixelHeight) &&
    pixelWidth >= pythonPlotExtentMinimum &&
    pixelWidth <= pythonPlotExtentMaximum &&
    pixelHeight >= pythonPlotExtentMinimum &&
    pixelHeight <= pythonPlotExtentMaximum;
  const draft = useMemo<PythonPlotBlock>(
    () =>
      Object.freeze({
        id: plot.id,
        typeId: plot.typeId,
        source,
        widthFraction,
        targetPixelWidth: pixelWidth,
        targetPixelHeight: pixelHeight,
      }),
    [pixelHeight, pixelWidth, plot.id, plot.typeId, source, widthFraction],
  );

  useEffect(() => {
    if (valid) {
      onPreview(draft);
    }
  }, [draft, onPreview, valid]);

  return (
    <form
      className="block-editor-form python-plot-editor"
      data-testid="python-plot-editor"
      onSubmit={(event) => {
        event.preventDefault();
        if (valid) {
          onCommit(
            createPythonPlotBlock(
              draft.id,
              draft.source,
              draft.widthFraction,
              draft.targetPixelWidth,
              draft.targetPixelHeight,
            ),
          );
        }
      }}
    >
      <p className="editor-note python-plot-editor__trust-note">
        This local capability executes trusted Python with your normal user permissions.
        It is isolated from the document model, but it is not a security sandbox.
      </p>
      <div className="python-plot-editor__workspace">
        <label className="editor-field python-plot-editor__source-field">
          <span>Python source · `np` and `plt` are preloaded</span>
          <textarea
            data-testid="python-plot-source"
            rows={22}
            spellCheck={false}
            value={source}
            onChange={(event) => {
              setSource(event.currentTarget.value);
            }}
            onKeyDown={(event) => {
              if (event.key !== "Tab") {
                return;
              }
              event.preventDefault();
              const textarea = event.currentTarget;
              const insertion = insertSpacesAtSelection(
                textarea.value,
                textarea.selectionStart,
                textarea.selectionEnd,
              );
              setSource(insertion.value);
              globalThis.requestAnimationFrame(() => {
                textarea.setSelectionRange(
                  insertion.selectionStart,
                  insertion.selectionEnd,
                );
              });
            }}
          />
        </label>
        <section className="python-plot-editor__live-preview">
          <header>
            <strong>Live SVG preview</strong>
            <small>
              {pixelWidth} × {pixelHeight} target pixels
            </small>
          </header>
          {valid ? (
            <PythonPlotPreview plot={draft} />
          ) : (
            <p className="editor-error">Source and target dimensions must be valid.</p>
          )}
        </section>
      </div>
      <label className="editor-field">
        <span>Preferred document width · {Math.round(widthFraction * 100)}%</span>
        <input
          type="range"
          min="20"
          max="100"
          value={Math.round(widthFraction * 100)}
          onChange={(event) => {
            setWidthFraction(Number(event.currentTarget.value) / 100);
          }}
        />
      </label>
      <div className="python-plot-editor__dimensions">
        <label className="editor-field">
          <span>Target width · px</span>
          <input
            type="number"
            min={pythonPlotExtentMinimum}
            max={pythonPlotExtentMaximum}
            step="16"
            value={pixelWidth}
            onChange={(event) => {
              setPixelWidth(event.currentTarget.valueAsNumber);
            }}
          />
        </label>
        <label className="editor-field">
          <span>Target height · px</span>
          <input
            type="number"
            min={pythonPlotExtentMinimum}
            max={pythonPlotExtentMaximum}
            step="16"
            value={pixelHeight}
            onChange={(event) => {
              setPixelHeight(event.currentTarget.valueAsNumber);
            }}
          />
        </label>
      </div>
      <div className="editor-actions">
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
        <button className="primary-action" type="submit" disabled={!valid}>
          Save Python plot
        </button>
      </div>
    </form>
  );
}
