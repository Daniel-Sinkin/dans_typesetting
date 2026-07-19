import { describe, expect, it } from "vitest";

import { mathExpressionToText } from "../model/math";
import { basicMathInputParser, MathInputParseError } from "./basicMathInputParser";

describe("basic math input parser plugin", () => {
  it("respects equality, additive, and multiplicative precedence", () => {
    const expression = basicMathInputParser.parse("1+2-3=2*4");

    expect(mathExpressionToText(expression)).toBe("1 + 2 − 3 = 2 × 4");
    expect(expression.kind).toBe("binary");
    if (expression.kind === "binary") {
      expect(expression.operator).toBe("equals");
      expect(expression.right.kind).toBe("binary");
    }
  });

  it("preserves an explicitly negative right-hand term without ambiguous double signs", () => {
    expect(mathExpressionToText(basicMathInputParser.parse("1--3/x"))).toBe(
      "1 − (−3 / x)",
    );
  });

  it("parses signed decimals, division, and every supported grouping delimiter", () => {
    const expression = basicMathInputParser.parse("-56.321 / (a + [B, {c, -3}])");

    expect(mathExpressionToText(expression)).toBe("−56.321 / (a + [B, {c, −3}])");
  });

  it("reports the source position of malformed or unsupported input", () => {
    expect(() => basicMathInputParser.parse("(1+2]")).toThrow(MathInputParseError);
    expect(() => basicMathInputParser.parse("x_1")).toThrow(/character 2/u);
    expect(() => basicMathInputParser.parse("1,")).toThrow(/character 3/u);
  });
});
