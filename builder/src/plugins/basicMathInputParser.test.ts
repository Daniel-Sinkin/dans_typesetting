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

  it("parses square roots and postfix scripts without turning slash into a fraction", () => {
    const expression = basicMathInputParser.parse("sqrt(x_2^3) / A_{i+1}");

    expect(mathExpressionToText(expression)).toBe("√(x_{2}^{3}) / A_{i + 1}");
    expect(expression.kind).toBe("binary");
    if (expression.kind === "binary") {
      expect(expression.operator).toBe("divide");
      expect(expression.left.kind).toBe("radical");
      expect(expression.right.kind).toBe("script");
    }
  });

  it("accepts a negative script atom and rejects duplicate script directions", () => {
    expect(mathExpressionToText(basicMathInputParser.parse("x_-3"))).toBe("x_{−3}");
    expect(() => basicMathInputParser.parse("x_1_2")).toThrow(/specified twice/u);
    expect(() => basicMathInputParser.parse("x^1^2")).toThrow(/specified twice/u);
  });

  it("reports the source position of malformed or unsupported input", () => {
    expect(() => basicMathInputParser.parse("(1+2]")).toThrow(MathInputParseError);
    expect(() => basicMathInputParser.parse("x@")).toThrow(/character 2/u);
    expect(() => basicMathInputParser.parse("1,")).toThrow(/character 3/u);
  });
});
