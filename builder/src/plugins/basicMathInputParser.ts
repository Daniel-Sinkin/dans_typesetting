// A deliberately small expression parser supplied as an optional Math capability.
import type { MathInputParserPlugin } from "../math/inputParser";
import {
  createMathBinary,
  createMathCommaSequence,
  createMathDecimal,
  createMathDelimited,
  createMathFunction,
  createMathIdentifier,
  createMathInteger,
  createMathNegated,
  createMathNamedOperator,
  createMathParenthesized,
  createMathRadical,
  createMathScript,
  createMathSymbol,
  createMathStyledIdentifier,
  mathSymbolNameFromInput,
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
  | "product"
  | "center_dot"
  | "divide"
  | "tensor_product"
  | "equals"
  | "not_equals"
  | "less_than"
  | "less_equals"
  | "greater_than"
  | "greater_equals"
  | "approximately_equals"
  | "similar"
  | "element_of"
  | "right_arrow"
  | "maps_to"
  | "comma"
  | "subscript"
  | "superscript"
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
      return "product";
    case "×":
      return "times";
    case "·":
      return "center_dot";
    case "/":
      return "divide";
    case "=":
      return "equals";
    case "≠":
      return "not_equals";
    case "<":
      return "less_than";
    case "≤":
      return "less_equals";
    case ">":
      return "greater_than";
    case "≥":
      return "greater_equals";
    case "≈":
      return "approximately_equals";
    case "~":
    case "∼":
      return "similar";
    case "∈":
      return "element_of";
    case "→":
      return "right_arrow";
    case "↦":
      return "maps_to";
    case "⊗":
      return "tensor_product";
    case ",":
      return "comma";
    case "_":
      return "subscript";
    case "^":
      return "superscript";
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

const compoundSymbols = [
  ["|->", "maps_to"],
  ["->", "right_arrow"],
  ["!=", "not_equals"],
  ["<=", "less_equals"],
  [">=", "greater_equals"],
  ["~=", "approximately_equals"],
] as const satisfies readonly (readonly [string, TokenKind])[];

const keywordOperators: Readonly<Record<string, TokenKind | undefined>> = Object.freeze({
  cdot: "center_dot",
  in: "element_of",
  mapsTo: "maps_to",
  otimes: "tensor_product",
  sim: "similar",
  times: "times",
  to: "right_arrow",
});

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
    const compoundSymbol = compoundSymbols.find(([symbol]) =>
      remainder.startsWith(symbol),
    );
    if (compoundSymbol !== undefined) {
      const [symbol, kind] = compoundSymbol;
      tokens.push({ kind, text: symbol, offset });
      offset += symbol.length;
      continue;
    }
    const number = /^(?:\d+(?:\.\d*)?|\.\d+)/u.exec(remainder)?.[0];
    if (number !== undefined) {
      tokens.push({ kind: "number", text: number, offset });
      offset += number.length;
      continue;
    }
    const identifier = /^[A-Za-z]+/u.exec(remainder)?.[0];
    if (identifier !== undefined) {
      tokens.push({
        kind: keywordOperators[identifier] ?? "identifier",
        text: identifier,
        offset,
      });
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
    case "product":
      return "product";
    case "center_dot":
      return "center_dot";
    case "divide":
      return "divide";
    case "tensor_product":
      return "tensor_product";
    case "equals":
      return "equals";
    case "not_equals":
      return "not_equals";
    case "less_than":
      return "less_than";
    case "less_equals":
      return "less_equals";
    case "greater_than":
      return "greater_than";
    case "greater_equals":
      return "greater_equals";
    case "approximately_equals":
      return "approximately_equals";
    case "similar":
      return "similar";
    case "element_of":
      return "element_of";
    case "right_arrow":
      return "right_arrow";
    case "maps_to":
      return "maps_to";
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
    const items = [this.#parseArrow()];
    while (this.#current().kind === "comma") {
      this.#advance();
      items.push(this.#parseArrow());
    }
    const firstItem = items[0];
    if (firstItem === undefined) {
      throw new Error("The comma parser did not produce its required first item");
    }
    return items.length === 1 ? firstItem : createMathCommaSequence(items);
  }

  #parseArrow(): MathExpression {
    let expression = this.#parseRelation();
    while (
      this.#current().kind === "right_arrow" ||
      this.#current().kind === "maps_to"
    ) {
      const operator = binaryOperatorFor(this.#advance().kind);
      if (operator === null) {
        throw new Error("An arrow token did not map to a binary operator");
      }
      expression = createMathBinary(operator, expression, this.#parseRelation());
    }
    return expression;
  }

  #parseRelation(): MathExpression {
    let expression = this.#parseAdditive();
    while (
      this.#current().kind === "equals" ||
      this.#current().kind === "not_equals" ||
      this.#current().kind === "less_than" ||
      this.#current().kind === "less_equals" ||
      this.#current().kind === "greater_than" ||
      this.#current().kind === "greater_equals" ||
      this.#current().kind === "approximately_equals" ||
      this.#current().kind === "similar" ||
      this.#current().kind === "element_of"
    ) {
      const operator = binaryOperatorFor(this.#advance().kind);
      if (operator === null) {
        throw new Error("A relation token did not map to a binary operator");
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
    while (
      this.#current().kind === "product" ||
      this.#current().kind === "center_dot" ||
      this.#current().kind === "times" ||
      this.#current().kind === "divide" ||
      this.#current().kind === "tensor_product"
    ) {
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
    return this.#parsePostfix();
  }

  #parsePostfix(): MathExpression {
    let expression = this.#parsePrimary();
    while (
      this.#current().kind === "subscript" ||
      this.#current().kind === "superscript"
    ) {
      const operator = this.#advance();
      const script = this.#parseScriptAtom();
      const base = expression.kind === "script" ? expression.base : expression;
      let subscript = expression.kind === "script" ? expression.subscript : null;
      let superscript = expression.kind === "script" ? expression.superscript : null;
      if (operator.kind === "subscript") {
        if (subscript !== null) {
          throw new MathInputParseError("A subscript was specified twice", operator.offset);
        }
        subscript = script;
      } else {
        if (superscript !== null) {
          throw new MathInputParseError("A superscript was specified twice", operator.offset);
        }
        superscript = script;
      }
      expression = createMathScript(base, subscript, superscript);
    }
    return expression;
  }

  #parseScriptAtom(): MathExpression {
    if (this.#current().kind === "minus") {
      this.#advance();
      return createMathNegated(this.#parseScriptAtom());
    }
    if (this.#current().kind === "open_brace") {
      this.#advance();
      const body = this.#parseCommaSequence();
      this.#consume("close_brace", "'}'");
      return body;
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
      if (
        (token.text === "bb" || token.text === "cal") &&
        this.#current().kind === "open_parenthesis"
      ) {
        this.#advance();
        const identifier = this.#consume("identifier", "an ASCII identifier");
        this.#consume("close_parenthesis", "')'");
        return createMathStyledIdentifier(
          identifier.text,
          token.text === "bb" ? "blackboard" : "calligraphic",
        );
      }
      if (token.text === "op" && this.#current().kind === "open_parenthesis") {
        this.#advance();
        const name = this.#consume("identifier", "an operator name");
        this.#consume("comma", "',' after the operator name");
        const argument = this.#parseCommaSequence();
        this.#consume("close_parenthesis", "')'");
        return createMathNamedOperator(name.text, argument);
      }
      if (token.text === "sqrt" && this.#current().kind === "open_parenthesis") {
        this.#advance();
        const body = this.#parseCommaSequence();
        this.#consume("close_parenthesis", "')'");
        return createMathRadical(body);
      }
      if (
        this.#current().kind === "open_parenthesis" ||
        this.#current().kind === "open_bracket"
      ) {
        const delimiter = this.#advance().kind;
        const argument = this.#parseCommaSequence();
        this.#consume(
          delimiter === "open_parenthesis" ? "close_parenthesis" : "close_bracket",
          delimiter === "open_parenthesis" ? "')'" : "']'",
        );
        return createMathFunction(
          token.text,
          argument,
          delimiter === "open_parenthesis" ? "parentheses" : "brackets",
        );
      }
      const symbol = mathSymbolNameFromInput(token.text);
      if (symbol !== null) {
        return createMathSymbol(symbol);
      }
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
