// Optional matrix/vector authoring extension built entirely from core math primitives.
import type { MathEditorExtension } from "../math/editorExtension";
import {
  createMathDelimited,
  createMathGrid,
  type MathExpression,
} from "../model/math";

function bracketGrid(
  rows: number,
  columns: number,
  cells?: readonly MathExpression[],
): MathExpression {
  return createMathDelimited("brackets", createMathGrid(rows, columns, cells));
}

export function createMathMatrix(
  rows: readonly (readonly MathExpression[])[],
): MathExpression {
  const firstRow = rows[0];
  if (firstRow === undefined || firstRow.length === 0) {
    throw new Error("A matrix requires at least one non-empty row");
  }
  const columns = firstRow.length;
  if (!rows.every((row) => row.length === columns)) {
    throw new Error("Every matrix row must have the same number of cells");
  }
  return bracketGrid(rows.length, columns, rows.flat());
}

export function createEmptyMathMatrix(rows: number, columns: number): MathExpression {
  return bracketGrid(rows, columns);
}

export function createMathRowVector(
  cells: readonly MathExpression[],
): MathExpression {
  if (cells.length === 0) {
    throw new Error("A row vector requires at least one cell");
  }
  return bracketGrid(1, cells.length, cells);
}

export function createMathColumnVector(
  cells: readonly MathExpression[],
): MathExpression {
  if (cells.length === 0) {
    throw new Error("A column vector requires at least one cell");
  }
  return bracketGrid(cells.length, 1, cells);
}

export const mathMatVecEditorExtension: MathEditorExtension = Object.freeze({
  id: "dans.math.matvec",
  label: "Matrices and vectors",
  items: Object.freeze([
    Object.freeze({
      id: "matvec-matrix-2x2",
      label: "2×2",
      description: "Square two-by-two matrix",
      create: () => createEmptyMathMatrix(2, 2),
    }),
    Object.freeze({
      id: "matvec-matrix-2x3",
      label: "2×3",
      description: "Rectangular two-by-three matrix",
      create: () => createEmptyMathMatrix(2, 3),
    }),
    Object.freeze({
      id: "matvec-row-vector",
      label: "[···]",
      description: "Three-component row vector",
      create: () => createEmptyMathMatrix(1, 3),
    }),
    Object.freeze({
      id: "matvec-column-vector",
      label: "[⋮]",
      description: "Three-component column vector",
      create: () => createEmptyMathMatrix(3, 1),
    }),
  ]),
});
