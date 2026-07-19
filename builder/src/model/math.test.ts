// builder/src/model/math.test.ts — verify nested equation construction and drag transforms.
import { describe, expect, it } from "vitest";

import {
  createMathBinary,
  createMathCommaSequence,
  createMathDecimal,
  createMathDelimited,
  createMathIdentifier,
  createMathInteger,
  createMathLeafFromInput,
  createMathParenthesized,
  createMathNegated,
  createMathSlot,
  createMathSummation,
  detachMathExpressionAtPath,
  mathExpressionAtPath,
  mathExpressionFromString,
  mathExpressionHasSlots,
  mathExpressionToString,
  mathExpressionToText,
  parseMathPath,
  replaceMathExpressionAtPath,
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
});
