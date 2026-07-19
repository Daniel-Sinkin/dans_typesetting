// builder/src/model/math.test.ts — verify nested equation construction and drag transforms.
import { describe, expect, it } from "vitest";

import {
  createMathBinary,
  createMathCommaSequence,
  createMathDecimal,
  createMathDelimited,
  createMathFraction,
  createMathIdentifier,
  createMathInteger,
  createMathLeafFromInput,
  createMathParenthesized,
  createMathNegated,
  createMathRadical,
  createMathScript,
  createMathSlot,
  createMathSummation,
  createMathSymbol,
  detachMathExpressionAtPath,
  mathExpressionAtPath,
  mathExpressionFromTransport,
  mathExpressionFromString,
  mathExpressionHasSlots,
  mathExpressionToString,
  mathExpressionToText,
  mathSymbolGlyph,
  parseMathPath,
  replaceMathExpressionAtPath,
  validateMathExpression,
} from "./math";

function sampleExpression() {
  return createMathBinary(
    "equals",
    createMathBinary(
      "minus",
      createMathBinary(
        "plus",
        createMathInteger(1, "one"),
        createMathInteger(2, "two"),
        "sum",
      ),
      createMathInteger(3, "three"),
      "difference",
    ),
    createMathBinary(
      "times",
      createMathInteger(2, "rhs-two"),
      createMathInteger(4, "four"),
      "product",
    ),
    "equality",
  );
}

describe("structured math", () => {
  it("renders the deliberately constrained nested binary expression", () => {
    expect(mathExpressionToText(sampleExpression())).toBe("1 + 2 − 3 = 2 × 4");
    expect(mathExpressionAtPath(sampleExpression(), ["left", "left"])?.id).toBe("sum");
  });

  it("builds an equality by replacing slots", () => {
    const rootSlot = createMathSlot("root-slot");
    const equality = createMathBinary(
      "equals",
      createMathSlot("left-slot"),
      createMathSlot("right-slot"),
      "equality",
    );
    const withEquality = replaceMathExpressionAtPath(rootSlot, [], equality);
    const withLeft = replaceMathExpressionAtPath(
      withEquality,
      ["left"],
      createMathInteger(1, "one"),
    );
    const completed = replaceMathExpressionAtPath(
      withLeft,
      ["right"],
      createMathInteger(2, "two"),
    );

    expect(mathExpressionToText(completed)).toBe("1 = 2");
    expect(mathExpressionHasSlots(completed)).toBe(false);
  });

  it("detaches a nested subtree and leaves an explicit drop slot", () => {
    const detached = detachMathExpressionAtPath(sampleExpression(), ["left", "left"]);

    expect(detached.detached.id).toBe("sum");
    expect(mathExpressionToText(detached.expression)).toBe("□ − 3 = 2 × 4");
    expect(mathExpressionHasSlots(detached.expression)).toBe(true);
  });

  it("parses only explicit structural branch names", () => {
    expect(parseMathPath("root")).toEqual([]);
    expect(parseMathPath("left.right.left")).toEqual(["left", "right", "left"]);
    expect(parseMathPath("left.body.upper")).toEqual(["left", "body", "upper"]);
    expect(parseMathPath("body.item:12.right")).toEqual(["body", "item:12", "right"]);
    expect(parseMathPath("body.cell:12.right")).toEqual(["body", "cell:12", "right"]);
    expect(parseMathPath("numerator.base.subscript")).toEqual([
      "numerator",
      "base",
      "subscript",
    ]);
    expect(parseMathPath("degree.body.denominator")).toEqual([
      "degree",
      "body",
      "denominator",
    ]);
    expect(parseMathPath("item:-1")).toBeNull();
    expect(parseMathPath("left.argument")).toBeNull();
  });

  it("accepts unsigned decimals and ASCII identifiers as direct leaf input", () => {
    expect(createMathLeafFromInput("12").kind).toBe("integer");
    expect(createMathLeafFromInput(".25").kind).toBe("decimal");
    expect(createMathLeafFromInput("CUDA").kind).toBe("identifier");
    expect(() => createMathLeafFromInput("x_1")).toThrow(/unsigned decimal/u);
  });

  it("round-trips nested summations through the versioned clipboard format", () => {
    const summation = createMathSummation(
      createMathBinary("equals", createMathIdentifier("i"), createMathInteger(1)),
      createMathIdentifier("N"),
      createMathParenthesized(sampleExpression()),
      "sum-root",
    );
    const restored = mathExpressionFromString(mathExpressionToString(summation));

    expect(mathExpressionToText(restored)).toBe(mathExpressionToText(summation));
    expect(restored.id).not.toBe("sum-root");
    expect(() =>
      mathExpressionFromString(
        '{"format":"dans.math.expression","version":2,"expression":{"kind":"slot"}}',
      ),
    ).toThrow(/format or version/u);
  });

  it("round-trips parsed grouping, unary negation, division, and comma sequences", () => {
    const grouped = createMathDelimited(
      "braces",
      createMathCommaSequence([
        createMathBinary("divide", createMathIdentifier("A"), createMathInteger(4)),
        createMathNegated(createMathDecimal("56.321")),
      ]),
    );
    const restored = mathExpressionFromString(mathExpressionToString(grouped));

    expect(mathExpressionToText(restored)).toBe("{A / 4, −56.321}");
  });

  it("round-trips semantic relations and atomic physics symbols", () => {
    const expression = createMathBinary(
      "right_arrow",
      createMathBinary(
        "less_equals",
        createMathSymbol("partial"),
        createMathSymbol("infinity"),
      ),
      createMathBinary(
        "tensor_product",
        createMathSymbol("capital_psi"),
        createMathSymbol("dagger"),
      ),
    );
    const serialized = mathExpressionToString(expression);
    const restored = mathExpressionFromString(serialized);

    expect(mathExpressionToString(restored)).toBe(serialized);
    expect(mathExpressionToText(restored)).toBe("∂ ≤ ∞ → Ψ ⊗ †");
    expect(mathSymbolGlyph("centered_ellipsis")).toBe("⋯");
  });

  it("replaces and detaches every slot of fractions, radicals, and scripts", () => {
    const expression = createMathFraction(
      createMathRadical(createMathIdentifier("x"), createMathInteger(3)),
      createMathScript(
        createMathIdentifier("A"),
        createMathInteger(4),
        createMathInteger(2),
      ),
    );
    expect(mathExpressionAtPath(expression, ["numerator", "degree"])?.kind).toBe("integer");
    expect(mathExpressionAtPath(expression, ["denominator", "subscript"])?.kind).toBe(
      "integer",
    );

    const detached = detachMathExpressionAtPath(expression, ["denominator", "superscript"]);
    expect(mathExpressionToText(detached.detached)).toBe("2");
    expect(mathExpressionToText(detached.expression)).toBe("(root(3, x)) / (A_{4}^{□})");
    expect(mathExpressionHasSlots(detached.expression)).toBe(true);

    const repaired = replaceMathExpressionAtPath(
      detached.expression,
      ["denominator", "superscript"],
      createMathInteger(5),
    );
    expect(mathExpressionToText(repaired)).toBe("(root(3, x)) / (A_{4}^{5})");
  });

  it("canonically round-trips nested fractions, roots, and combined scripts", () => {
    const expression = createMathFraction(
      createMathRadical(
        createMathScript(createMathIdentifier("x"), createMathInteger(1), createMathInteger(2)),
      ),
      createMathRadical(createMathIdentifier("y"), createMathInteger(3)),
    );
    const serialized = mathExpressionToString(expression);
    const restored = mathExpressionFromString(serialized);

    expect(mathExpressionToString(restored)).toBe(serialized);
    expect(mathExpressionToText(restored)).toBe("(√(x_{1}^{2})) / (root(3, y))");
    validateMathExpression(restored);
  });

  it("rejects script nodes without scripts and duplicate node ownership", () => {
    expect(() => createMathScript(createMathIdentifier("x"), null, null)).toThrow(
      /requires a subscript or superscript/u,
    );
    const shared = createMathInteger(1);
    expect(() => {
      validateMathExpression(createMathFraction(shared, shared));
    }).toThrow(
      /unique/u,
    );
    expect(() =>
      mathExpressionFromTransport({ kind: "symbol", name: "raw_latex" }),
    ).toThrow(/Unsupported serialized math symbol/u);
    expect(() =>
      mathExpressionFromTransport({
        kind: "binary",
        operator: "iff",
        left: { kind: "integer", value: "1" },
        right: { kind: "integer", value: "1" },
      }),
    ).toThrow(/Unsupported serialized binary operator/u);
  });
});
