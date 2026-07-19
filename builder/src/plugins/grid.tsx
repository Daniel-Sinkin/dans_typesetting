// Graphical adapter for equal-column Grid composition and recursive cell flow.
import type { CSSProperties } from "react";

import type {
  BuilderBlockMeasureContext,
  BuilderBlockPlugin,
  BuilderChildSequenceLayout,
  BuilderChildSequencePlacement,
} from "../builder/plugin";
import { GridEditor } from "./gridEditor";
import {
  createGridBlock,
  gridCellSequenceId,
  gridTypeId,
  requireGridBlock,
  type GridBlock,
  type GridEdgeStyle,
} from "./gridModel";

const pixelsPerEm = 16;
const minimumCellWidthPx = 32;
const minimumCellHeightPx = 88;

interface ResolvedGridGeometry {
  readonly height: number;
  readonly placements: readonly Required<BuilderChildSequencePlacement>[];
}

export function resolveGridGeometry(
  grid: GridBlock,
  availableWidth: number,
  context: BuilderBlockMeasureContext,
): ResolvedGridGeometry {
  if (!Number.isFinite(availableWidth) || availableWidth <= 0) {
    throw new Error("Grid layout requires a positive available width");
  }
  const requestedColumnGapPx = grid.gaps.columnEm * pixelsPerEm;
  const columnGapCount = Math.max(0, grid.columns - 1);
  const maximumGapTotal = Math.max(
    0,
    availableWidth - grid.columns * minimumCellWidthPx,
  );
  const columnGapPx =
    columnGapCount === 0
      ? 0
      : Math.min(requestedColumnGapPx, maximumGapTotal / columnGapCount);
  const cellWidth =
    (availableWidth - columnGapPx * columnGapCount) / grid.columns;
  const rowGapPx = grid.gaps.rowEm * pixelsPerEm;
  const rowHeights = Array.from({ length: grid.rows }, (_unused, row) => {
    let height = minimumCellHeightPx;
    for (let column = 0; column < grid.columns; column += 1) {
      height = Math.max(
        height,
        context.measureChildSequence(
          gridCellSequenceId(row, column),
          cellWidth,
        ),
      );
    }
    return height;
  });
  const placements: Required<BuilderChildSequencePlacement>[] = [];
  let offsetY = 0;
  for (let row = 0; row < grid.rows; row += 1) {
    const rowHeight = rowHeights[row];
    if (rowHeight === undefined) {
      throw new Error("Grid layout lost a row height");
    }
    for (let column = 0; column < grid.columns; column += 1) {
      placements.push({
        sequenceId: gridCellSequenceId(row, column),
        offsetX: column * (cellWidth + columnGapPx),
        offsetY,
        width: cellWidth,
        height: rowHeight,
      });
    }
    offsetY += rowHeight;
    if (row + 1 < grid.rows) {
      offsetY += rowGapPx;
    }
  }
  return Object.freeze({ height: Math.max(1, offsetY), placements });
}

function boundaryClass(axis: "horizontal" | "vertical", style: GridEdgeStyle): string {
  return `grid-block-preview__boundary grid-block-preview__boundary--${axis} grid-block-preview__boundary--${style}`;
}

function horizontalBoundaryY(
  row: number,
  rows: number,
  cells: ReadonlyMap<string, BuilderChildSequenceLayout>,
): number | null {
  if (row === 0) {
    return cells.get(gridCellSequenceId(0, 0))?.offsetY ?? null;
  }
  if (row === rows) {
    const previous = cells.get(gridCellSequenceId(rows - 1, 0));
    return previous === undefined ? null : previous.offsetY + previous.height;
  }
  const previous = cells.get(gridCellSequenceId(row - 1, 0));
  const next = cells.get(gridCellSequenceId(row, 0));
  return previous === undefined || next === undefined
    ? null
    : (previous.offsetY + previous.height + next.offsetY) / 2;
}

function verticalBoundaryX(
  column: number,
  columns: number,
  cells: ReadonlyMap<string, BuilderChildSequenceLayout>,
): number | null {
  if (column === 0) {
    return cells.get(gridCellSequenceId(0, 0))?.offsetX ?? null;
  }
  if (column === columns) {
    const previous = cells.get(gridCellSequenceId(0, columns - 1));
    return previous === undefined ? null : previous.offsetX + previous.width;
  }
  const previous = cells.get(gridCellSequenceId(0, column - 1));
  const next = cells.get(gridCellSequenceId(0, column));
  return previous === undefined || next === undefined
    ? null
    : (previous.offsetX + previous.width + next.offsetX) / 2;
}

function boundaryStyle(
  axis: "horizontal" | "vertical",
  position: number,
  spanStart: number,
  spanLength: number,
): CSSProperties {
  return axis === "horizontal"
    ? { left: spanStart, top: position, width: spanLength }
    : { left: position, top: spanStart, height: spanLength };
}

export const gridPlugin: BuilderBlockPlugin = {
  typeId: gridTypeId,
  palette: {
    label: "Grid",
    description: "Compose arbitrary document blocks in equal-width cells",
    glyph: "▦",
    accentColor: "#1098ad",
  },
  createDefault(blockId) {
    return createGridBlock(blockId, 1, 2, {
      gaps: { rowEm: 1, columnEm: 1 },
    });
  },
  copyForInsert(block, copiedBlockId) {
    const grid = requireGridBlock(block);
    return createGridBlock(copiedBlockId, grid.rows, grid.columns, {
      gaps: grid.gaps,
      horizontalEdges: grid.horizontalEdges,
      verticalEdges: grid.verticalEdges,
    });
  },
  measure(block, availableWidth, context) {
    return resolveGridGeometry(
      requireGridBlock(block),
      availableWidth,
      context,
    ).height;
  },
  layoutChildSequences(block, availableWidth, context) {
    return resolveGridGeometry(
      requireGridBlock(block),
      availableWidth,
      context,
    ).placements;
  },
  renderPreview(block, context) {
    const grid = requireGridBlock(block);
    const cells = new Map(
      context.childSequenceLayouts.map((layout) => [layout.sequenceId, layout]),
    );
    const allCells = [...cells.values()];
    if (allCells.length !== grid.rows * grid.columns) {
      return <div className="grid-block-preview">Grid layout unavailable</div>;
    }
    const minimumX = Math.min(...allCells.map(({ offsetX }) => offsetX));
    const maximumX = Math.max(
      ...allCells.map(({ offsetX, width }) => offsetX + width),
    );
    const minimumY = Math.min(...allCells.map(({ offsetY }) => offsetY));
    const maximumY = Math.max(
      ...allCells.map(({ offsetY, height }) => offsetY + height),
    );
    return (
      <div
        className="grid-block-preview"
        data-testid="grid-preview"
        aria-label={`${String(grid.rows)} by ${String(grid.columns)} layout grid`}
      >
        {allCells.map((cell) => (
          <div
            className="grid-block-preview__cell"
            data-grid-cell={cell.sequenceId}
            key={cell.sequenceId}
            style={{
              left: cell.offsetX,
              top: cell.offsetY,
              width: cell.width,
              height: cell.height,
            }}
          >
            <span>{cell.sequenceId.replaceAll(":", " · ")}</span>
          </div>
        ))}
        {grid.horizontalEdges.map((edge, row) => {
          const y = horizontalBoundaryY(row, grid.rows, cells);
          return y === null ? null : (
            <div
              className={boundaryClass("horizontal", edge)}
              data-grid-horizontal-edge={row}
              key={`horizontal:${String(row)}`}
              style={boundaryStyle(
                "horizontal",
                y,
                minimumX,
                maximumX - minimumX,
              )}
            />
          );
        })}
        {grid.verticalEdges.map((edge, column) => {
          const x = verticalBoundaryX(column, grid.columns, cells);
          return x === null ? null : (
            <div
              className={boundaryClass("vertical", edge)}
              data-grid-vertical-edge={column}
              key={`vertical:${String(column)}`}
              style={boundaryStyle(
                "vertical",
                x,
                minimumY,
                maximumY - minimumY,
              )}
            />
          );
        })}
      </div>
    );
  },
  editor: {
    title(block) {
      return `Edit grid · ${requireGridBlock(block).id}`;
    },
    render(props) {
      return <GridEditor {...props} />;
    },
  },
};
