// Verify matrix/vector composition over the shared structured-math grid primitive.
import { describe, expect, it } from "vitest";

import {
  createMathInteger,
  createMathSlot,
  mathExpressionAtPath,
  mathExpressionFromString,
  mathExpressionToString,
  mathExpressionToText,
  replaceMathExpressionAtPath,
  validateMathExpression,
  type MathDelimitedExpression,
  type MathGridExpression,
} from "../model/math";
import {
  createEmptyMathMatrix,
  createMathColumnVector,
  createMathMatrix,
  createMathRowVector,
  mathMatVecEditorExtension,
} from "./mathMatVec";

function gridInside(expression: ReturnType<typeof createMathMatrix>): MathGridExpression {
  const delimited = expression as MathDelimitedExpression;
  expect(delimited.kind).toBe("delimited");
  expect(delimited.delimiter).toBe("brackets");
  expect(delimited.body.kind).toBe("grid");
  return delimited.body as MathGridExpression;
}

describe("math matrix/vector extension", () => {
  it("builds square, rectangular, row-vector, and column-vector grids", () => {
    const rectangular = createMathMatrix([
      [createMathInteger(1), createMathInteger(2), createMathInteger(3)],
      [createMathInteger(4), createMathInteger(5), createMathInteger(6)],
    ]);
    const grid = gridInside(rectangular);
    expect([grid.rows, grid.columns, grid.cells.length]).toEqual([2, 3, 6]);
    expect(mathExpressionToText(rectangular)).toBe("[1, 2, 3; 4, 5, 6]");

    expect(gridInside(createMathRowVector([createMathInteger(1), createMathInteger(2)])))
      .toMatchObject({ rows: 1, columns: 2 });
    expect(gridInside(createMathColumnVector([createMathInteger(1), createMathInteger(2)])))
      .toMatchObject({ rows: 2, columns: 1 });
    expect(gridInside(createEmptyMathMatrix(2, 2)).cells.every((cell) => cell.kind === "slot"))
      .toBe(true);
  });

  it("rejects empty and ragged matrix data", () => {
    expect(() => createMathMatrix([])).toThrow(/non-empty row/u);
    expect(() => createMathMatrix([[createMathInteger(1)], []])).toThrow(/same number/u);
    expect(() => createMathRowVector([])).toThrow(/at least one/u);
    expect(() => createEmptyMathMatrix(0, 2)).toThrow(/positive safe-integer/u);
  });

  it("addresses, replaces, validates, and serializes individual cells", () => {
    const matrix = createEmptyMathMatrix(2, 2);
    expect(mathExpressionAtPath(matrix, ["body", "cell:2"])?.kind).toBe("slot");
    const replaced = replaceMathExpressionAtPath(
      matrix,
      ["body", "cell:2"],
      createMathInteger(9),
    );
    expect(mathExpressionToText(replaced)).toBe("[□, □; 9, □]");
    validateMathExpression(replaced);

    const restored = mathExpressionFromString(mathExpressionToString(replaced));
    expect(mathExpressionToText(restored)).toBe(mathExpressionToText(replaced));
    expect(mathExpressionToString(mathExpressionFromString(mathExpressionToString(restored))))
      .toBe(mathExpressionToString(restored));
  });

  it("contributes optional editor palette items without changing the core editor", () => {
    expect(mathMatVecEditorExtension.id).toBe("dans.math.matvec");
    expect(mathMatVecEditorExtension.items.map((item) => item.id)).toEqual([
      "matvec-matrix-2x2",
      "matvec-matrix-2x3",
      "matvec-row-vector",
      "matvec-column-vector",
    ]);
    expect(
      gridInside(
        mathMatVecEditorExtension.items[1]?.create() ?? createMathSlot(),
      ),
    ).toMatchObject({ rows: 2, columns: 3 });
  });
});
