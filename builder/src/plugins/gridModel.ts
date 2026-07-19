// Backend-neutral equal-column Grid with arbitrary block-bearing cells.
import {
  childBlockSequences,
  createChildBlockSequence,
  type BuilderBlock,
  type BuilderChildBlockSequence,
} from "../model/document";

export const gridTypeId = "dans.layout.grid";
export const maximumGridDimension = 16;
export const maximumGridCellCount = 64;
export const maximumGridGapEm = 16;

export type GridEdgeStyle = "none" | "single" | "double";

export interface GridGaps {
  readonly rowEm: number;
  readonly columnEm: number;
}

export interface GridBlock extends BuilderBlock {
  readonly typeId: typeof gridTypeId;
  readonly rows: number;
  readonly columns: number;
  readonly gaps: GridGaps;
  readonly horizontalEdges: readonly GridEdgeStyle[];
  readonly verticalEdges: readonly GridEdgeStyle[];
  readonly childSequences: readonly BuilderChildBlockSequence[];
}

export interface GridBlockOptions {
  readonly cells?: readonly (readonly BuilderBlock[])[];
  readonly gaps?: GridGaps;
  readonly horizontalEdges?: readonly GridEdgeStyle[];
  readonly verticalEdges?: readonly GridEdgeStyle[];
}

const defaultGridGaps: GridGaps = Object.freeze({ rowEm: 0, columnEm: 0 });

function isGridEdgeStyle(value: unknown): value is GridEdgeStyle {
  return value === "none" || value === "single" || value === "double";
}

function validGap(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= maximumGridGapEm;
}

export function validateGridDimensions(rows: number, columns: number): void {
  if (
    !Number.isSafeInteger(rows) ||
    !Number.isSafeInteger(columns) ||
    rows < 1 ||
    columns < 1 ||
    rows > maximumGridDimension ||
    columns > maximumGridDimension
  ) {
    throw new Error(
      `Grid dimensions must be integers in [1, ${String(maximumGridDimension)}]`,
    );
  }
  if (rows * columns > maximumGridCellCount) {
    throw new Error(
      `A Grid supports at most ${String(maximumGridCellCount)} cells`,
    );
  }
}

export function validateGridGaps(gaps: GridGaps): void {
  if (!validGap(gaps.rowEm) || !validGap(gaps.columnEm)) {
    throw new Error(
      `Grid gaps must be finite em values in [0, ${String(maximumGridGapEm)}]`,
    );
  }
}

export function gridCellSequenceId(row: number, column: number): string {
  if (!Number.isSafeInteger(row) || !Number.isSafeInteger(column) || row < 0 || column < 0) {
    throw new Error("Grid cell coordinates must be non-negative integers");
  }
  return `cell:${String(row)}:${String(column)}`;
}

function emptyEdges(count: number): readonly GridEdgeStyle[] {
  return Object.freeze(
    Array.from({ length: count }, (): GridEdgeStyle => "none"),
  );
}

export function createGridBlock(
  id: string,
  rows: number,
  columns: number,
  options: GridBlockOptions = {},
): GridBlock {
  if (id.length === 0) {
    throw new Error("A Grid block requires a stable ID");
  }
  validateGridDimensions(rows, columns);
  const gaps = options.gaps ?? defaultGridGaps;
  validateGridGaps(gaps);
  const cells = options.cells ?? Array.from({ length: rows * columns }, () => []);
  if (cells.length !== rows * columns) {
    throw new Error("A Grid requires exactly rows times columns cells");
  }
  const horizontalEdges = options.horizontalEdges ?? emptyEdges(rows + 1);
  const verticalEdges = options.verticalEdges ?? emptyEdges(columns + 1);
  if (
    horizontalEdges.length !== rows + 1 ||
    verticalEdges.length !== columns + 1 ||
    !horizontalEdges.every(isGridEdgeStyle) ||
    !verticalEdges.every(isGridEdgeStyle)
  ) {
    throw new Error("Grid boundary arrays must match its dimensions and use valid styles");
  }
  return Object.freeze({
    id,
    typeId: gridTypeId,
    rows,
    columns,
    gaps: Object.freeze({ ...gaps }),
    horizontalEdges: Object.freeze([...horizontalEdges]),
    verticalEdges: Object.freeze([...verticalEdges]),
    childSequences: Object.freeze(
      cells.map((blocks, index) => {
        const row = Math.floor(index / columns);
        const column = index % columns;
        return createChildBlockSequence(gridCellSequenceId(row, column), blocks);
      }),
    ),
  });
}

export function isGridBlock(block: BuilderBlock): block is GridBlock {
  return (
    block.typeId === gridTypeId &&
    "rows" in block &&
    typeof block.rows === "number" &&
    "columns" in block &&
    typeof block.columns === "number" &&
    "gaps" in block &&
    typeof block.gaps === "object" &&
    block.gaps !== null &&
    "rowEm" in block.gaps &&
    typeof block.gaps.rowEm === "number" &&
    "columnEm" in block.gaps &&
    typeof block.gaps.columnEm === "number" &&
    "horizontalEdges" in block &&
    Array.isArray(block.horizontalEdges) &&
    "verticalEdges" in block &&
    Array.isArray(block.verticalEdges)
  );
}

export function requireGridBlock(block: BuilderBlock): GridBlock {
  if (!isGridBlock(block)) {
    throw new Error(`Grid plugin cannot consume ${block.typeId}`);
  }
  validateGridBlock(block);
  return block;
}

export function validateGridBlock(grid: GridBlock): void {
  if (grid.id.length === 0) {
    throw new Error("A Grid block requires a stable ID");
  }
  validateGridDimensions(grid.rows, grid.columns);
  validateGridGaps(grid.gaps);
  if (
    grid.horizontalEdges.length !== grid.rows + 1 ||
    grid.verticalEdges.length !== grid.columns + 1 ||
    !grid.horizontalEdges.every(isGridEdgeStyle) ||
    !grid.verticalEdges.every(isGridEdgeStyle)
  ) {
    throw new Error("Grid boundary arrays must match its dimensions and use valid styles");
  }
  const sequences = childBlockSequences(grid);
  if (sequences.length !== grid.rows * grid.columns) {
    throw new Error("A Grid requires exactly rows times columns child sequences");
  }
  for (let row = 0; row < grid.rows; row += 1) {
    for (let column = 0; column < grid.columns; column += 1) {
      const index = row * grid.columns + column;
      if (sequences[index]?.id !== gridCellSequenceId(row, column)) {
        throw new Error("Grid cells must use derived row-major endpoint IDs");
      }
    }
  }
}

export function gridCell(
  grid: GridBlock,
  row: number,
  column: number,
): readonly BuilderBlock[] {
  if (
    !Number.isSafeInteger(row) ||
    !Number.isSafeInteger(column) ||
    row < 0 ||
    column < 0 ||
    row >= grid.rows ||
    column >= grid.columns
  ) {
    throw new RangeError("Grid cell coordinates are out of range");
  }
  const sequence = grid.childSequences[row * grid.columns + column];
  if (sequence?.id !== gridCellSequenceId(row, column)) {
    throw new Error("Grid cell topology is malformed");
  }
  return sequence.blocks;
}

export function gridCells(grid: GridBlock): readonly (readonly BuilderBlock[])[] {
  validateGridBlock(grid);
  return grid.childSequences.map(({ blocks }) => blocks);
}

function resizedEdges(
  current: readonly GridEdgeStyle[],
  oldSize: number,
  newSize: number,
): readonly GridEdgeStyle[] {
  const result = Array.from(
    { length: newSize + 1 },
    (): GridEdgeStyle => "none",
  );
  result[0] = current[0] ?? "none";
  result[newSize] = current[oldSize] ?? "none";
  for (let index = 1; index < Math.min(oldSize, newSize); index += 1) {
    result[index] = current[index] ?? "none";
  }
  return result;
}

export function resizeGridBlock(
  grid: GridBlock,
  rows: number,
  columns: number,
): GridBlock {
  validateGridBlock(grid);
  validateGridDimensions(rows, columns);
  const cells = Array.from(
    { length: rows * columns },
    (): readonly BuilderBlock[] => [],
  );
  for (let row = 0; row < Math.min(grid.rows, rows); row += 1) {
    for (let column = 0; column < Math.min(grid.columns, columns); column += 1) {
      cells[row * columns + column] = gridCell(grid, row, column);
    }
  }
  return createGridBlock(grid.id, rows, columns, {
    cells,
    gaps: grid.gaps,
    horizontalEdges: resizedEdges(grid.horizontalEdges, grid.rows, rows),
    verticalEdges: resizedEdges(grid.verticalEdges, grid.columns, columns),
  });
}

export function replaceGridPresentation(
  grid: GridBlock,
  gaps: GridGaps,
  horizontalEdges: readonly GridEdgeStyle[],
  verticalEdges: readonly GridEdgeStyle[],
): GridBlock {
  return createGridBlock(grid.id, grid.rows, grid.columns, {
    cells: gridCells(grid),
    gaps,
    horizontalEdges,
    verticalEdges,
  });
}

export function droppedGridBlockCount(
  grid: GridBlock,
  rows: number,
  columns: number,
): number {
  validateGridDimensions(rows, columns);
  let count = 0;
  for (let row = 0; row < grid.rows; row += 1) {
    for (let column = 0; column < grid.columns; column += 1) {
      if (row >= rows || column >= columns) {
        count += gridCell(grid, row, column).length;
      }
    }
  }
  return count;
}
