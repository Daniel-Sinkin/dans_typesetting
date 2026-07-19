// Edit Grid dimensions, gaps, and whole-boundary styles without editing cell content.
import { useEffect, useState } from "react";

import type { BuilderBlockEditorProps } from "../builder/plugin";
import {
  droppedGridBlockCount,
  maximumGridDimension,
  maximumGridGapEm,
  replaceGridPresentation,
  requireGridBlock,
  resizeGridBlock,
  type GridBlock,
  type GridEdgeStyle,
} from "./gridModel";

const edgeOptions: readonly Readonly<{ value: GridEdgeStyle; label: string }>[] = [
  { value: "none", label: "Inactive guide" },
  { value: "single", label: "Single line" },
  { value: "double", label: "Double line" },
];

function horizontalEdgeLabel(index: number, rows: number): string {
  if (index === 0) {
    return "Top edge";
  }
  if (index === rows) {
    return "Bottom edge";
  }
  return `Rows ${String(index)} / ${String(index + 1)}`;
}

function verticalEdgeLabel(index: number, columns: number): string {
  if (index === 0) {
    return "Left edge";
  }
  if (index === columns) {
    return "Right edge";
  }
  return `Columns ${String(index)} / ${String(index + 1)}`;
}

function parsedDimension(value: string): number | null {
  if (!/^\d+$/u.test(value)) {
    return null;
  }
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function GridEditor({
  block,
  onPreview,
  onCommit,
  onCancel,
}: BuilderBlockEditorProps) {
  const original = requireGridBlock(block);
  const [draft, setDraft] = useState<GridBlock>(original);
  const [rowsInput, setRowsInput] = useState(String(original.rows));
  const [columnsInput, setColumnsInput] = useState(String(original.columns));
  const [dimensionError, setDimensionError] = useState<string | null>(null);

  useEffect(() => {
    if (dimensionError === null) {
      onPreview(draft);
    }
  }, [dimensionError, draft, onPreview]);

  const tryResize = (nextRowsInput: string, nextColumnsInput: string): void => {
    const rows = parsedDimension(nextRowsInput);
    const columns = parsedDimension(nextColumnsInput);
    if (rows === null || columns === null) {
      setDimensionError("Rows and columns must be whole numbers.");
      return;
    }
    try {
      setDraft((current) => resizeGridBlock(current, rows, columns));
      setDimensionError(null);
    } catch (error) {
      setDimensionError(error instanceof Error ? error.message : "Invalid Grid dimensions");
    }
  };

  const droppedBlocks = (() => {
    const rows = parsedDimension(rowsInput);
    const columns = parsedDimension(columnsInput);
    if (rows === null || columns === null) {
      return 0;
    }
    try {
      return droppedGridBlockCount(original, rows, columns);
    } catch {
      return 0;
    }
  })();

  const updateEdges = (
    axis: "horizontal" | "vertical",
    index: number,
    edge: GridEdgeStyle,
  ): void => {
    setDraft((current) => {
      const horizontalEdges = [...current.horizontalEdges];
      const verticalEdges = [...current.verticalEdges];
      if (axis === "horizontal") {
        horizontalEdges[index] = edge;
      } else {
        verticalEdges[index] = edge;
      }
      return replaceGridPresentation(
        current,
        current.gaps,
        horizontalEdges,
        verticalEdges,
      );
    });
  };

  return (
    <form
      className="block-editor-form grid-editor"
      data-testid="grid-editor"
      onSubmit={(event) => {
        event.preventDefault();
        if (dimensionError === null) {
          onCommit(draft);
        }
      }}
    >
      <p className="editor-note">
        Cells contain ordinary document block sequences. Resize and style the Grid here;
        drag blocks into cells directly on the document surface.
      </p>
      <div className="grid-editor__dimensions">
        <label className="editor-field">
          <span>Rows</span>
          <input
            type="number"
            min="1"
            max={maximumGridDimension}
            step="1"
            value={rowsInput}
            onChange={(event) => {
              const value = event.currentTarget.value;
              setRowsInput(value);
              tryResize(value, columnsInput);
            }}
          />
        </label>
        <label className="editor-field">
          <span>Columns</span>
          <input
            type="number"
            min="1"
            max={maximumGridDimension}
            step="1"
            value={columnsInput}
            onChange={(event) => {
              const value = event.currentTarget.value;
              setColumnsInput(value);
              tryResize(rowsInput, value);
            }}
          />
        </label>
        <label className="editor-field">
          <span>Row gap · em</span>
          <input
            type="number"
            min="0"
            max={maximumGridGapEm}
            step="0.25"
            value={draft.gaps.rowEm}
            onChange={(event) => {
              const rowEm = event.currentTarget.valueAsNumber;
              if (Number.isFinite(rowEm)) {
                try {
                  setDraft((current) =>
                    replaceGridPresentation(
                      current,
                      { ...current.gaps, rowEm },
                      current.horizontalEdges,
                      current.verticalEdges,
                    ),
                  );
                } catch {
                  // Keep the last valid live preview while the numeric input is incomplete.
                }
              }
            }}
          />
        </label>
        <label className="editor-field">
          <span>Column gap · em</span>
          <input
            type="number"
            min="0"
            max={maximumGridGapEm}
            step="0.25"
            value={draft.gaps.columnEm}
            onChange={(event) => {
              const columnEm = event.currentTarget.valueAsNumber;
              if (Number.isFinite(columnEm)) {
                try {
                  setDraft((current) =>
                    replaceGridPresentation(
                      current,
                      { ...current.gaps, columnEm },
                      current.horizontalEdges,
                      current.verticalEdges,
                    ),
                  );
                } catch {
                  // Keep the last valid live preview while the numeric input is incomplete.
                }
              }
            }}
          />
        </label>
      </div>
      {dimensionError === null ? null : (
        <p className="editor-error">{dimensionError}</p>
      )}
      {droppedBlocks === 0 ? null : (
        <p className="editor-warning" role="alert">
          Saving this size removes {String(droppedBlocks)} block
          {droppedBlocks === 1 ? "" : "s"} from cells outside the new bounds.
        </p>
      )}
      <div className="grid-editor__edge-groups">
        <fieldset>
          <legend>Horizontal boundaries</legend>
          {draft.horizontalEdges.map((edge, index) => (
            <label className="editor-field" key={`horizontal:${String(index)}`}>
              <span>{horizontalEdgeLabel(index, draft.rows)}</span>
              <select
                value={edge}
                onChange={(event) => {
                  updateEdges("horizontal", index, event.currentTarget.value as GridEdgeStyle);
                }}
              >
                {edgeOptions.map((option) => (
                  <option value={option.value} key={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </fieldset>
        <fieldset>
          <legend>Vertical boundaries</legend>
          {draft.verticalEdges.map((edge, index) => (
            <label className="editor-field" key={`vertical:${String(index)}`}>
              <span>{verticalEdgeLabel(index, draft.columns)}</span>
              <select
                value={edge}
                onChange={(event) => {
                  updateEdges("vertical", index, event.currentTarget.value as GridEdgeStyle);
                }}
              >
                {edgeOptions.map((option) => (
                  <option value={option.value} key={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </fieldset>
      </div>
      <div className="editor-actions">
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
        <button className="primary-action" type="submit" disabled={dimensionError !== null}>
          Save grid
        </button>
      </div>
    </form>
  );
}
