// A deliberately small expression parser supplied as an optional Math capability.
import type { MathInputParserPlugin } from "../math/inputParser";
import {
  createMathBinary,
  createMathCommaSequence,
  createMathDecimal,
  createMathDelimited,
  createMathIdentifier,
  createMathInteger,
  createMathNegated,
  createMathParenthesized,
  validateMathExpression,
  type MathBinaryOperator,
  type MathExpression,
} from "../model/math";

type TokenKind =
  | "number"
  | "identifier"
  | "plus"
  | "minus"
  | "times"
  | "divide"
  | "equals"
  | "comma"
  | "open_parenthesis"
  | "close_parenthesis"
  | "open_bracket"
  | "close_bracket"
  | "open_brace"
  | "close_brace"
  | "end";

interface Token {
  readonly kind: TokenKind;
  readonly text: string;
  readonly offset: number;
}

export class MathInputParseError extends Error {
  readonly offset: number;

  constructor(message: string, offset: number) {
    super(`${message} at character ${String(offset + 1)}`);
    this.name = "MathInputParseError";
    this.offset = offset;
  }
}

function symbolTokenKind(symbol: string): TokenKind | null {
  switch (symbol) {
    case "+":
      return "plus";
    case "-":
      return "minus";
    case "*":
      return "times";
    case "/":
      return "divide";
    case "=":
      return "equals";
    case ",":
      return "comma";
    case "(":
      return "open_parenthesis";
    case ")":
      return "close_parenthesis";
    case "[":
      return "open_bracket";
    case "]":
      return "close_bracket";
    case "{":
      return "open_brace";
    case "}":
      return "close_brace";
    default:
      return null;
  }
}

function tokenize(source: string): readonly Token[] {
  const tokens: Token[] = [];
  let offset = 0;
  while (offset < source.length) {
    const character = source[offset];
    if (character === undefined) {
      break;
    }
    if (/\s/u.test(character)) {
      offset += 1;
      continue;
    }

    const remainder = source.slice(offset);
    const number = /^(?:\d+(?:\.\d*)?|\.\d+)/u.exec(remainder)?.[0];
    if (number !== undefined) {
      tokens.push({ kind: "number", text: number, offset });
      offset += number.length;
      continue;
    }
    const identifier = /^[A-Za-z]+/u.exec(remainder)?.[0];
    if (identifier !== undefined) {
      tokens.push({ kind: "identifier", text: identifier, offset });
      offset += identifier.length;
      continue;
    }
    const symbolKind = symbolTokenKind(character);
    if (symbolKind !== null) {
      tokens.push({ kind: symbolKind, text: character, offset });
      offset += 1;
      continue;
    }
    throw new MathInputParseError(`Unsupported math input '${character}'`, offset);
  }
  tokens.push({ kind: "end", text: "", offset: source.length });
  return Object.freeze(tokens);
}

function binaryOperatorFor(kind: TokenKind): MathBinaryOperator | null {
  switch (kind) {
    case "plus":
      return "plus";
    case "minus":
      return "minus";
    case "times":
      return "times";
    case "divide":
      return "divide";
    case "equals":
      return "equals";
    default:
      return null;
  }
}

class BasicMathParser {
  readonly #tokens: readonly Token[];
  #index = 0;

  constructor(source: string) {
    this.#tokens = tokenize(source);
  }

  parse(): MathExpression {
    if (this.#current().kind === "end") {
      throw new MathInputParseError("A math expression cannot be empty", 0);
    }
    const expression = this.#parseCommaSequence();
    const trailing = this.#current();
    if (trailing.kind !== "end") {
      throw new MathInputParseError(`Unexpected '${trailing.text}'`, trailing.offset);
    }
    validateMathExpression(expression);
    return expression;
  }

  #current(): Token {
    const token = this.#tokens[this.#index];
    if (token === undefined) {
      throw new Error("The math tokenizer omitted its terminal token");
    }
    return token;
  }

  #advance(): Token {
    const token = this.#current();
    this.#index += 1;
    return token;
  }

  #consume(kind: TokenKind, description: string): Token {
    const token = this.#current();
    if (token.kind !== kind) {
      throw new MathInputParseError(`Expected ${description}`, token.offset);
    }
    return this.#advance();
  }

  #parseCommaSequence(): MathExpression {
    const items = [this.#parseEquality()];
    while (this.#current().kind === "comma") {
      this.#advance();
      items.push(this.#parseEquality());
    }
    const firstItem = items[0];
    if (firstItem === undefined) {
      throw new Error("The comma parser did not produce its required first item");
    }
    return items.length === 1 ? firstItem : createMathCommaSequence(items);
  }

  #parseEquality(): MathExpression {
    let expression = this.#parseAdditive();
    while (this.#current().kind === "equals") {
      const operator = binaryOperatorFor(this.#advance().kind);
      if (operator === null) {
        throw new Error("The equality token did not map to a binary operator");
      }
      expression = createMathBinary(operator, expression, this.#parseAdditive());
    }
    return expression;
  }

  #parseAdditive(): MathExpression {
    let expression = this.#parseMultiplicative();
    while (this.#current().kind === "plus" || this.#current().kind === "minus") {
      const operator = binaryOperatorFor(this.#advance().kind);
      if (operator === null) {
        throw new Error("An additive token did not map to a binary operator");
      }
      expression = createMathBinary(operator, expression, this.#parseMultiplicative());
    }
    return expression;
  }

  #parseMultiplicative(): MathExpression {
    let expression = this.#parseUnary();
    while (this.#current().kind === "times" || this.#current().kind === "divide") {
      const operator = binaryOperatorFor(this.#advance().kind);
      if (operator === null) {
        throw new Error("A multiplicative token did not map to a binary operator");
      }
      expression = createMathBinary(operator, expression, this.#parseUnary());
    }
    return expression;
  }

  #parseUnary(): MathExpression {
    if (this.#current().kind === "minus") {
      this.#advance();
      return createMathNegated(this.#parseUnary());
    }
    return this.#parsePrimary();
  }

  #parsePrimary(): MathExpression {
    const token = this.#current();
    if (token.kind === "number") {
      this.#advance();
      return token.text.includes(".")
        ? createMathDecimal(token.text)
        : createMathInteger(token.text);
    }
    if (token.kind === "identifier") {
      this.#advance();
      return createMathIdentifier(token.text);
    }
    if (token.kind === "open_parenthesis") {
      this.#advance();
      const body = this.#parseCommaSequence();
      this.#consume("close_parenthesis", "')'");
      return createMathParenthesized(body);
    }
    if (token.kind === "open_bracket") {
      this.#advance();
      const body = this.#parseCommaSequence();
      this.#consume("close_bracket", "']'");
      return createMathDelimited("brackets", body);
    }
    if (token.kind === "open_brace") {
      this.#advance();
      const body = this.#parseCommaSequence();
      this.#consume("close_brace", "'}'");
      return createMathDelimited("braces", body);
    }
    throw new MathInputParseError("Expected a number, identifier, or grouped expression", token.offset);
  }
}

export const basicMathInputParser: MathInputParserPlugin = Object.freeze({
  typeId: "dans.math.input.basic-expression",
  label: "Basic expression parser",
  parse(source: string) {
    return new BasicMathParser(source).parse();
  },
});
