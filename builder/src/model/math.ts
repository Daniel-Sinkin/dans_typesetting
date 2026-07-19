// builder/src/model/math.ts — model and transform the constrained structured-math tree.

export type MathBinaryOperator =
  | "plus"
  | "minus"
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
  | "product"
  | "center_dot"
  | "times"
  | "divide"
  | "tensor_product";

export type MathIdentifierStyle = "italic" | "upright" | "blackboard" | "calligraphic";
export type MathFunctionDelimiter = "parentheses" | "brackets" | "angle";

const mathIdentifierStyles = ["italic", "upright", "blackboard", "calligraphic"] as const;
const mathFunctionDelimiters = ["parentheses", "brackets", "angle"] as const;

function isMathIdentifierStyle(value: unknown): value is MathIdentifierStyle {
  return (
    typeof value === "string" &&
    (mathIdentifierStyles as readonly string[]).includes(value)
  );
}

function isMathFunctionDelimiter(value: unknown): value is MathFunctionDelimiter {
  return (
    typeof value === "string" &&
    (mathFunctionDelimiters as readonly string[]).includes(value)
  );
}

export const mathSymbolNames = [
  "alpha",
  "beta",
  "gamma",
  "delta",
  "epsilon",
  "zeta",
  "eta",
  "theta",
  "iota",
  "kappa",
  "lambda",
  "mu",
  "nu",
  "xi",
  "omicron",
  "pi",
  "rho",
  "sigma",
  "tau",
  "upsilon",
  "phi",
  "chi",
  "psi",
  "omega",
  "capital_alpha",
  "capital_beta",
  "capital_gamma",
  "capital_delta",
  "capital_epsilon",
  "capital_zeta",
  "capital_eta",
  "capital_theta",
  "capital_iota",
  "capital_kappa",
  "capital_lambda",
  "capital_mu",
  "capital_nu",
  "capital_xi",
  "capital_omicron",
  "capital_pi",
  "capital_rho",
  "capital_sigma",
  "capital_tau",
  "capital_upsilon",
  "capital_phi",
  "capital_chi",
  "capital_psi",
  "capital_omega",
  "nabla",
  "partial",
  "infinity",
  "dots",
  "cdots",
  "dagger",
  "transpose",
  "ell",
  "asterisk",
] as const;

export type MathSymbolName = (typeof mathSymbolNames)[number];
export type MathBinaryBranch = "left" | "right";
export type MathSummationBranch = "lower" | "upper" | "body";
export type MathFractionBranch = "numerator" | "denominator";
export type MathRadicalBranch = "body" | "degree";
export type MathScriptBranch = "base" | "subscript" | "superscript";
export type MathFunctionBranch = "argument";
export type MathUnderbraceBranch = "body" | "annotation";
export type MathSequenceBranch = `item:${number}`;
export type MathGridBranch = `cell:${number}`;
export type MathBranch =
  | MathBinaryBranch
  | MathSummationBranch
  | MathFractionBranch
  | MathRadicalBranch
  | MathScriptBranch
  | MathFunctionBranch
  | MathUnderbraceBranch
  | MathSequenceBranch
  | MathGridBranch;
export type MathPath = readonly MathBranch[];

interface MathNodeBase {
  readonly id: string;
}

export interface MathSlot extends MathNodeBase {
  readonly kind: "slot";
}

export interface MathInteger extends MathNodeBase {
  readonly kind: "integer";
  readonly value: string;
}

export interface MathDecimal extends MathNodeBase {
  readonly kind: "decimal";
  readonly value: string;
}

export interface MathIdentifier extends MathNodeBase {
  readonly kind: "identifier";
  readonly name: string;
  readonly style: MathIdentifierStyle;
}

export interface MathText extends MathNodeBase {
  readonly kind: "text";
  readonly value: string;
}

export interface MathSymbol extends MathNodeBase {
  readonly kind: "symbol";
  readonly name: MathSymbolName;
}

export interface MathFunctionExpression extends MathNodeBase {
  readonly kind: "function";
  readonly name: string;
  readonly namedOperator: boolean;
  readonly delimiter: MathFunctionDelimiter;
  readonly argument: MathExpression;
}

export interface MathUnderbraceExpression extends MathNodeBase {
  readonly kind: "underbrace";
  readonly body: MathExpression;
  readonly annotation: MathExpression;
}

export interface MathBinaryExpression extends MathNodeBase {
  readonly kind: "binary";
  readonly operator: MathBinaryOperator;
  readonly left: MathExpression;
  readonly right: MathExpression;
}

export interface MathSummationExpression extends MathNodeBase {
  readonly kind: "summation";
  readonly lower: MathExpression;
  readonly upper: MathExpression;
  readonly body: MathExpression;
}

export interface MathFractionExpression extends MathNodeBase {
  readonly kind: "fraction";
  readonly numerator: MathExpression;
  readonly denominator: MathExpression;
}

export interface MathRadicalExpression extends MathNodeBase {
  readonly kind: "radical";
  readonly body: MathExpression;
  readonly degree: MathExpression | null;
}

export interface MathScriptExpression extends MathNodeBase {
  readonly kind: "script";
  readonly base: MathExpression;
  readonly subscript: MathExpression | null;
  readonly superscript: MathExpression | null;
}

export interface MathParenthesizedExpression extends MathNodeBase {
  readonly kind: "parenthesized";
  readonly body: MathExpression;
}

export interface MathDelimitedExpression extends MathNodeBase {
  readonly kind: "delimited";
  readonly delimiter: "brackets" | "braces";
  readonly body: MathExpression;
}

export interface MathNegatedExpression extends MathNodeBase {
  readonly kind: "negated";
  readonly body: MathExpression;
}

export interface MathCommaSequence extends MathNodeBase {
  readonly kind: "comma_sequence";
  readonly items: readonly MathExpression[];
}

export interface MathGridExpression extends MathNodeBase {
  readonly kind: "grid";
  readonly rows: number;
  readonly columns: number;
  readonly cells: readonly MathExpression[];
}

export type MathExpression =
  | MathSlot
  | MathInteger
  | MathDecimal
  | MathIdentifier
  | MathText
  | MathSymbol
  | MathFunctionExpression
  | MathUnderbraceExpression
  | MathBinaryExpression
  | MathSummationExpression
  | MathFractionExpression
  | MathRadicalExpression
  | MathScriptExpression
  | MathParenthesizedExpression
  | MathDelimitedExpression
  | MathNegatedExpression
  | MathCommaSequence
  | MathGridExpression;

function createMathNodeId(): string {
  return globalThis.crypto.randomUUID();
}

export function createMathSlot(id: string = createMathNodeId()): MathSlot {
  return Object.freeze({ id, kind: "slot" });
}

export function createMathInteger(
  value: string | number,
  id: string = createMathNodeId(),
): MathInteger {
  const renderedValue = String(value);
  if (!/^\d+$/u.test(renderedValue)) {
    throw new Error(`Math integers require decimal digits, received '${renderedValue}'`);
  }
  return Object.freeze({ id, kind: "integer", value: renderedValue });
}

export function createMathDecimal(
  value: string,
  id: string = createMathNodeId(),
): MathDecimal {
  const renderedValue = value.trim();
  if (!/^(?:\d+\.\d*|\.\d+)$/u.test(renderedValue)) {
    throw new Error(`Math decimals require digits and one decimal point, received '${value}'`);
  }
  return Object.freeze({ id, kind: "decimal", value: renderedValue });
}

export function createMathIdentifier(
  name: string,
  id: string = createMathNodeId(),
): MathIdentifier {
  return createMathStyledIdentifier(name, "italic", id);
}

export function createMathStyledIdentifier(
  name: string,
  style: MathIdentifierStyle,
  id: string = createMathNodeId(),
): MathIdentifier {
  const renderedName = name.trim();
  if (!/^[A-Za-z][A-Za-z0-9]*$/u.test(renderedName)) {
    throw new Error(`Math identifiers require an ASCII identifier, received '${name}'`);
  }
  if (!isMathIdentifierStyle(style)) {
    throw new Error("Unsupported math identifier style");
  }
  return Object.freeze({ id, kind: "identifier", name: renderedName, style });
}

function isValidMathText(value: string): boolean {
  if (value.length === 0) {
    return false;
  }
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (codePoint !== undefined && (codePoint < 0x20 || codePoint === 0x7f)) {
      return false;
    }
  }
  return true;
}

export function createMathText(
  value: string,
  id: string = createMathNodeId(),
): MathText {
  if (!isValidMathText(value)) {
    throw new Error("Math text must be non-empty and contain no ASCII control characters");
  }
  return Object.freeze({ id, kind: "text", value });
}

const mathematicalAlphabetExceptions: Readonly<
  Record<
    Exclude<MathIdentifierStyle, "italic" | "upright">,
    Readonly<Record<string, number>>
  >
> = Object.freeze({
  blackboard: Object.freeze({
    C: 0x2102,
    H: 0x210d,
    N: 0x2115,
    P: 0x2119,
    Q: 0x211a,
    R: 0x211d,
    Z: 0x2124,
  }),
  calligraphic: Object.freeze({
    B: 0x212c,
    E: 0x2130,
    F: 0x2131,
    H: 0x210b,
    I: 0x2110,
    L: 0x2112,
    M: 0x2133,
    R: 0x211b,
    e: 0x212f,
    g: 0x210a,
    o: 0x2134,
  }),
});

function styledIdentifierCharacter(
  character: string,
  style: Exclude<MathIdentifierStyle, "italic" | "upright">,
): string {
  const exception = mathematicalAlphabetExceptions[style][character];
  if (exception !== undefined) {
    return String.fromCodePoint(exception);
  }
  const codePoint = character.codePointAt(0);
  if (codePoint === undefined) {
    return character;
  }
  if (codePoint >= 0x41 && codePoint <= 0x5a) {
    const base = style === "blackboard" ? 0x1d538 : 0x1d49c;
    return String.fromCodePoint(base + codePoint - 0x41);
  }
  if (codePoint >= 0x61 && codePoint <= 0x7a) {
    const base = style === "blackboard" ? 0x1d552 : 0x1d4b6;
    return String.fromCodePoint(base + codePoint - 0x61);
  }
  if (style === "blackboard" && codePoint >= 0x30 && codePoint <= 0x39) {
    return String.fromCodePoint(0x1d7d8 + codePoint - 0x30);
  }
  return character;
}

export function mathIdentifierText(identifier: MathIdentifier): string {
  const style = identifier.style;
  if (style === "italic" || style === "upright") {
    return identifier.name;
  }
  return Array.from(identifier.name)
    .map((character) => styledIdentifierCharacter(character, style))
    .join("");
}

export function createMathSymbol(
  name: MathSymbolName,
  id: string = createMathNodeId(),
): MathSymbol {
  return Object.freeze({ id, kind: "symbol", name });
}

export function createMathFunction(
  name: string,
  argument: MathExpression = createMathSlot(),
  delimiter: MathFunctionDelimiter = "parentheses",
  namedOperator = false,
  id: string = createMathNodeId(),
): MathFunctionExpression {
  const renderedName = name.trim();
  if (!/^[A-Za-z][A-Za-z0-9]*$/u.test(renderedName)) {
    throw new Error(`Math function names require an ASCII identifier, received '${name}'`);
  }
  if (!isMathFunctionDelimiter(delimiter)) {
    throw new Error("Unsupported math function delimiter");
  }
  return Object.freeze({
    id,
    kind: "function",
    name: renderedName,
    namedOperator,
    delimiter,
    argument,
  });
}

export function createMathNamedOperator(
  name: string,
  argument: MathExpression = createMathSlot(),
  delimiter: MathFunctionDelimiter = "brackets",
  id: string = createMathNodeId(),
): MathFunctionExpression {
  return createMathFunction(name, argument, delimiter, true, id);
}

export function createMathUnderbrace(
  body: MathExpression = createMathSlot(),
  annotation: MathExpression = createMathSlot(),
  id: string = createMathNodeId(),
): MathUnderbraceExpression {
  return Object.freeze({ id, kind: "underbrace", body, annotation });
}

const mathSymbolGlyphs: Readonly<Record<MathSymbolName, string>> = Object.freeze({
  alpha: "α",
  beta: "β",
  gamma: "γ",
  delta: "δ",
  epsilon: "ε",
  zeta: "ζ",
  eta: "η",
  theta: "θ",
  iota: "ι",
  kappa: "κ",
  lambda: "λ",
  mu: "μ",
  nu: "ν",
  xi: "ξ",
  omicron: "ο",
  pi: "π",
  rho: "ρ",
  sigma: "σ",
  tau: "τ",
  upsilon: "υ",
  phi: "φ",
  chi: "χ",
  psi: "ψ",
  omega: "ω",
  capital_alpha: "A",
  capital_beta: "B",
  capital_gamma: "Γ",
  capital_delta: "Δ",
  capital_epsilon: "E",
  capital_zeta: "Z",
  capital_eta: "H",
  capital_theta: "Θ",
  capital_iota: "I",
  capital_kappa: "K",
  capital_lambda: "Λ",
  capital_mu: "M",
  capital_nu: "N",
  capital_xi: "Ξ",
  capital_omicron: "O",
  capital_pi: "Π",
  capital_rho: "P",
  capital_sigma: "Σ",
  capital_tau: "T",
  capital_upsilon: "Υ",
  capital_phi: "Φ",
  capital_chi: "X",
  capital_psi: "Ψ",
  capital_omega: "Ω",
  nabla: "∇",
  partial: "∂",
  infinity: "∞",
  dots: "…",
  cdots: "⋯",
  dagger: "†",
  transpose: "⊤",
  ell: "ℓ",
  asterisk: "∗",
});

export function mathSymbolGlyph(name: MathSymbolName): string {
  return mathSymbolGlyphs[name];
}

const lowercaseGreekSymbolNames = mathSymbolNames.slice(0, 24);

export function mathSymbolNameFromInput(value: string): MathSymbolName | null {
  if ((mathSymbolNames as readonly string[]).includes(value)) {
    return value as MathSymbolName;
  }
  const lowercase = value.toLowerCase();
  const lowercaseIndex = lowercaseGreekSymbolNames.indexOf(
    lowercase as (typeof lowercaseGreekSymbolNames)[number],
  );
  const lowercaseGreek = lowercaseGreekSymbolNames[lowercaseIndex];
  if (lowercaseGreek !== undefined && value[0]?.toUpperCase() === value[0]) {
    return `capital_${lowercaseGreek}` as MathSymbolName;
  }
  switch (value) {
    case "inf":
      return "infinity";
    case "dots":
      return "dots";
    case "cdots":
      return "cdots";
    case "dag":
      return "dagger";
    case "top":
      return "transpose";
    case "ell":
      return "ell";
    default:
      return null;
  }
}

export function createMathLeafFromInput(
  value: string,
): MathInteger | MathDecimal | MathIdentifier | MathSymbol {
  const renderedValue = value.trim();
  if (/^\d+$/u.test(renderedValue)) {
    return createMathInteger(renderedValue);
  }
  if (/^(?:\d+\.\d*|\.\d+)$/u.test(renderedValue)) {
    return createMathDecimal(renderedValue);
  }
  const symbol = mathSymbolNameFromInput(renderedValue);
  if (symbol !== null) {
    return createMathSymbol(symbol);
  }
  if (/^[A-Za-z]+$/u.test(renderedValue)) {
    return createMathIdentifier(renderedValue);
  }
  throw new Error("A math leaf must be an unsigned decimal number, symbol, or ASCII letters");
}

export function createMathBinary(
  operator: MathBinaryOperator,
  left: MathExpression = createMathSlot(),
  right: MathExpression = createMathSlot(),
  id: string = createMathNodeId(),
): MathBinaryExpression {
  return Object.freeze({ id, kind: "binary", operator, left, right });
}

export function createMathSummation(
  lower: MathExpression = createMathSlot(),
  upper: MathExpression = createMathSlot(),
  body: MathExpression = createMathSlot(),
  id: string = createMathNodeId(),
): MathSummationExpression {
  return Object.freeze({ id, kind: "summation", lower, upper, body });
}

export function createMathFraction(
  numerator: MathExpression = createMathSlot(),
  denominator: MathExpression = createMathSlot(),
  id: string = createMathNodeId(),
): MathFractionExpression {
  return Object.freeze({ id, kind: "fraction", numerator, denominator });
}

export function createMathRadical(
  body: MathExpression = createMathSlot(),
  degree: MathExpression | null = null,
  id: string = createMathNodeId(),
): MathRadicalExpression {
  return Object.freeze({ id, kind: "radical", body, degree });
}

export function createMathScript(
  base: MathExpression,
  subscript: MathExpression | null,
  superscript: MathExpression | null,
  id: string = createMathNodeId(),
): MathScriptExpression {
  if (subscript === null && superscript === null) {
    throw new Error("A math script requires a subscript or superscript");
  }
  return Object.freeze({ id, kind: "script", base, subscript, superscript });
}

export function createMathParenthesized(
  body: MathExpression = createMathSlot(),
  id: string = createMathNodeId(),
): MathParenthesizedExpression {
  return Object.freeze({ id, kind: "parenthesized", body });
}

export function createMathDelimited(
  delimiter: MathDelimitedExpression["delimiter"],
  body: MathExpression = createMathSlot(),
  id: string = createMathNodeId(),
): MathDelimitedExpression {
  return Object.freeze({ id, kind: "delimited", delimiter, body });
}

export function createMathNegated(
  body: MathExpression = createMathSlot(),
  id: string = createMathNodeId(),
): MathNegatedExpression {
  return Object.freeze({ id, kind: "negated", body });
}

export function createMathCommaSequence(
  items: readonly MathExpression[],
  id: string = createMathNodeId(),
): MathCommaSequence {
  if (items.length < 2) {
    throw new Error("A comma-separated math sequence requires at least two items");
  }
  return Object.freeze({ id, kind: "comma_sequence", items: Object.freeze([...items]) });
}

export function createMathGrid(
  rows: number,
  columns: number,
  cells?: readonly MathExpression[],
  id: string = createMathNodeId(),
): MathGridExpression {
  const cellCount = rows * columns;
  if (
    !Number.isSafeInteger(rows) ||
    !Number.isSafeInteger(columns) ||
    rows <= 0 ||
    columns <= 0 ||
    !Number.isSafeInteger(cellCount)
  ) {
    throw new Error("A math grid requires positive safe-integer dimensions");
  }
  const ownedCells = cells === undefined
    ? Array.from({ length: cellCount }, () => createMathSlot())
    : [...cells];
  if (ownedCells.length !== cellCount) {
    throw new Error("A math grid requires exactly rows times columns cells");
  }
  return Object.freeze({
    id,
    kind: "grid",
    rows,
    columns,
    cells: Object.freeze(ownedCells),
  });
}

export function mathPathKey(path: MathPath): string {
  return path.length === 0 ? "root" : path.join(".");
}

export function mathSequenceBranch(index: number): MathSequenceBranch {
  if (!Number.isInteger(index) || index < 0) {
    throw new Error("A math sequence branch requires a non-negative integer index");
  }
  return `item:${String(index)}` as MathSequenceBranch;
}

export function mathGridBranch(index: number): MathGridBranch {
  if (!Number.isInteger(index) || index < 0) {
    throw new Error("A math grid branch requires a non-negative integer index");
  }
  return `cell:${String(index)}` as MathGridBranch;
}

export function parseMathPath(path: string): MathPath | null {
  if (path === "root") {
    return [];
  }
  const branches = path.split(".");
  const isMathBranch = (branch: string): branch is MathBranch =>
    branch === "left" ||
    branch === "right" ||
    branch === "lower" ||
    branch === "upper" ||
    branch === "body" ||
    branch === "numerator" ||
    branch === "denominator" ||
    branch === "degree" ||
    branch === "base" ||
    branch === "subscript" ||
    branch === "superscript" ||
    branch === "argument" ||
    branch === "annotation" ||
    /^item:(?:0|[1-9]\d*)$/u.test(branch) ||
    /^cell:(?:0|[1-9]\d*)$/u.test(branch);
  if (!branches.every(isMathBranch)) {
    return null;
  }
  return branches;
}

function mathChildAtBranch(
  expression: MathExpression,
  branch: MathBranch,
): MathExpression | null {
  if (expression.kind === "binary") {
    if (branch === "left") {
      return expression.left;
    }
    return branch === "right" ? expression.right : null;
  }
  if (expression.kind === "summation") {
    switch (branch) {
      case "lower":
        return expression.lower;
      case "upper":
        return expression.upper;
      case "body":
        return expression.body;
      case "left":
      case "right":
      default:
        return null;
    }
  }
  if (expression.kind === "fraction") {
    if (branch === "numerator") {
      return expression.numerator;
    }
    return branch === "denominator" ? expression.denominator : null;
  }
  if (expression.kind === "radical") {
    if (branch === "body") {
      return expression.body;
    }
    return branch === "degree" ? expression.degree : null;
  }
  if (expression.kind === "script") {
    if (branch === "base") {
      return expression.base;
    }
    if (branch === "subscript") {
      return expression.subscript;
    }
    return branch === "superscript" ? expression.superscript : null;
  }
  if (expression.kind === "function") {
    return branch === "argument" ? expression.argument : null;
  }
  if (expression.kind === "underbrace") {
    if (branch === "body") {
      return expression.body;
    }
    return branch === "annotation" ? expression.annotation : null;
  }
  if (expression.kind === "parenthesized") {
    return branch === "body" ? expression.body : null;
  }
  if (expression.kind === "delimited" || expression.kind === "negated") {
    return branch === "body" ? expression.body : null;
  }
  if (expression.kind === "comma_sequence" && branch.startsWith("item:")) {
    const index = Number.parseInt(branch.slice("item:".length), 10);
    return expression.items[index] ?? null;
  }
  if (expression.kind === "grid" && branch.startsWith("cell:")) {
    const index = Number.parseInt(branch.slice("cell:".length), 10);
    return expression.cells[index] ?? null;
  }
  return null;
}

export function mathExpressionAtPath(
  expression: MathExpression,
  path: MathPath,
): MathExpression | null {
  let currentExpression = expression;
  for (const branch of path) {
    const child = mathChildAtBranch(currentExpression, branch);
    if (child === null) {
      return null;
    }
    currentExpression = child;
  }
  return currentExpression;
}

export function replaceMathExpressionAtPath(
  expression: MathExpression,
  path: MathPath,
  replacement: MathExpression,
): MathExpression {
  const branch = path[0];
  if (branch === undefined) {
    return replacement;
  }
  const remainingPath = path.slice(1);
  if (expression.kind === "binary" && (branch === "left" || branch === "right")) {
    return branch === "left"
      ? createMathBinary(
        expression.operator,
        replaceMathExpressionAtPath(expression.left, remainingPath, replacement),
        expression.right,
        expression.id,
      )
      : createMathBinary(
        expression.operator,
        expression.left,
        replaceMathExpressionAtPath(expression.right, remainingPath, replacement),
        expression.id,
      );
  }
  if (
    expression.kind === "summation" &&
    (branch === "lower" || branch === "upper" || branch === "body")
  ) {
    return createMathSummation(
      branch === "lower"
        ? replaceMathExpressionAtPath(expression.lower, remainingPath, replacement)
        : expression.lower,
      branch === "upper"
        ? replaceMathExpressionAtPath(expression.upper, remainingPath, replacement)
        : expression.upper,
      branch === "body"
        ? replaceMathExpressionAtPath(expression.body, remainingPath, replacement)
        : expression.body,
      expression.id,
    );
  }
  if (
    expression.kind === "fraction" &&
    (branch === "numerator" || branch === "denominator")
  ) {
    return createMathFraction(
      branch === "numerator"
        ? replaceMathExpressionAtPath(expression.numerator, remainingPath, replacement)
        : expression.numerator,
      branch === "denominator"
        ? replaceMathExpressionAtPath(expression.denominator, remainingPath, replacement)
        : expression.denominator,
      expression.id,
    );
  }
  if (expression.kind === "radical" && (branch === "body" || branch === "degree")) {
    if (branch === "degree" && expression.degree === null) {
      throw new Error(`Math path '${mathPathKey(path)}' does not exist`);
    }
    return createMathRadical(
      branch === "body"
        ? replaceMathExpressionAtPath(expression.body, remainingPath, replacement)
        : expression.body,
      branch === "degree" && expression.degree !== null
        ? replaceMathExpressionAtPath(expression.degree, remainingPath, replacement)
        : expression.degree,
      expression.id,
    );
  }
  if (
    expression.kind === "script" &&
    (branch === "base" || branch === "subscript" || branch === "superscript")
  ) {
    if (branch === "subscript" && expression.subscript === null) {
      throw new Error(`Math path '${mathPathKey(path)}' does not exist`);
    }
    if (branch === "superscript" && expression.superscript === null) {
      throw new Error(`Math path '${mathPathKey(path)}' does not exist`);
    }
    return createMathScript(
      branch === "base"
        ? replaceMathExpressionAtPath(expression.base, remainingPath, replacement)
        : expression.base,
      branch === "subscript" && expression.subscript !== null
        ? replaceMathExpressionAtPath(expression.subscript, remainingPath, replacement)
        : expression.subscript,
      branch === "superscript" && expression.superscript !== null
        ? replaceMathExpressionAtPath(expression.superscript, remainingPath, replacement)
        : expression.superscript,
      expression.id,
    );
  }
  if (expression.kind === "function" && branch === "argument") {
    return createMathFunction(
      expression.name,
      replaceMathExpressionAtPath(expression.argument, remainingPath, replacement),
      expression.delimiter,
      expression.namedOperator,
      expression.id,
    );
  }
  if (
    expression.kind === "underbrace" &&
    (branch === "body" || branch === "annotation")
  ) {
    return createMathUnderbrace(
      branch === "body"
        ? replaceMathExpressionAtPath(expression.body, remainingPath, replacement)
        : expression.body,
      branch === "annotation"
        ? replaceMathExpressionAtPath(expression.annotation, remainingPath, replacement)
        : expression.annotation,
      expression.id,
    );
  }
  if (expression.kind === "parenthesized" && branch === "body") {
    return createMathParenthesized(
      replaceMathExpressionAtPath(expression.body, remainingPath, replacement),
      expression.id,
    );
  }
  if (expression.kind === "delimited" && branch === "body") {
    return createMathDelimited(
      expression.delimiter,
      replaceMathExpressionAtPath(expression.body, remainingPath, replacement),
      expression.id,
    );
  }
  if (expression.kind === "negated" && branch === "body") {
    return createMathNegated(
      replaceMathExpressionAtPath(expression.body, remainingPath, replacement),
      expression.id,
    );
  }
  if (expression.kind === "comma_sequence" && branch.startsWith("item:")) {
    const index = Number.parseInt(branch.slice("item:".length), 10);
    if (expression.items[index] === undefined) {
      throw new Error(`Math path '${mathPathKey(path)}' does not exist`);
    }
    return createMathCommaSequence(
      expression.items.map((item, itemIndex) =>
        itemIndex === index
          ? replaceMathExpressionAtPath(item, remainingPath, replacement)
          : item,
      ),
      expression.id,
    );
  }
  if (expression.kind === "grid" && branch.startsWith("cell:")) {
    const index = Number.parseInt(branch.slice("cell:".length), 10);
    if (expression.cells[index] === undefined) {
      throw new Error(`Math path '${mathPathKey(path)}' does not exist`);
    }
    return createMathGrid(
      expression.rows,
      expression.columns,
      expression.cells.map((cell, cellIndex) =>
        cellIndex === index
          ? replaceMathExpressionAtPath(cell, remainingPath, replacement)
          : cell,
      ),
      expression.id,
    );
  }
  throw new Error(`Math path '${mathPathKey(path)}' does not exist`);
}

export interface DetachedMathExpression {
  readonly expression: MathExpression;
  readonly detached: MathExpression;
}

export function detachMathExpressionAtPath(
  expression: MathExpression,
  path: MathPath,
): DetachedMathExpression {
  const detached = mathExpressionAtPath(expression, path);
  if (detached === null) {
    throw new Error(`Math path '${mathPathKey(path)}' does not exist`);
  }
  return {
    expression: replaceMathExpressionAtPath(expression, path, createMathSlot()),
    detached,
  };
}

export function mathExpressionHasSlots(expression: MathExpression): boolean {
  if (expression.kind === "slot") {
    return true;
  }
  if (
    expression.kind === "integer" ||
    expression.kind === "decimal" ||
    expression.kind === "identifier" ||
    expression.kind === "text" ||
    expression.kind === "symbol"
  ) {
    return false;
  }
  if (expression.kind === "function") {
    return mathExpressionHasSlots(expression.argument);
  }
  if (expression.kind === "underbrace") {
    return (
      mathExpressionHasSlots(expression.body) ||
      mathExpressionHasSlots(expression.annotation)
    );
  }
  if (expression.kind === "summation") {
    return (
      mathExpressionHasSlots(expression.lower) ||
      mathExpressionHasSlots(expression.upper) ||
      mathExpressionHasSlots(expression.body)
    );
  }
  if (expression.kind === "fraction") {
    return (
      mathExpressionHasSlots(expression.numerator) ||
      mathExpressionHasSlots(expression.denominator)
    );
  }
  if (expression.kind === "radical") {
    return (
      mathExpressionHasSlots(expression.body) ||
      (expression.degree !== null && mathExpressionHasSlots(expression.degree))
    );
  }
  if (expression.kind === "script") {
    return (
      mathExpressionHasSlots(expression.base) ||
      (expression.subscript !== null && mathExpressionHasSlots(expression.subscript)) ||
      (expression.superscript !== null && mathExpressionHasSlots(expression.superscript))
    );
  }
  if (expression.kind === "parenthesized") {
    return mathExpressionHasSlots(expression.body);
  }
  if (expression.kind === "delimited" || expression.kind === "negated") {
    return mathExpressionHasSlots(expression.body);
  }
  if (expression.kind === "comma_sequence") {
    return expression.items.some(mathExpressionHasSlots);
  }
  if (expression.kind === "grid") {
    return expression.cells.some(mathExpressionHasSlots);
  }
  return mathExpressionHasSlots(expression.left) || mathExpressionHasSlots(expression.right);
}

export function mathOperatorSymbol(operator: MathBinaryOperator): string {
  switch (operator) {
    case "plus":
      return "+";
    case "minus":
      return "−";
    case "equals":
      return "=";
    case "not_equals":
      return "≠";
    case "less_than":
      return "<";
    case "less_equals":
      return "≤";
    case "greater_than":
      return ">";
    case "greater_equals":
      return "≥";
    case "approximately_equals":
      return "≈";
    case "similar":
      return "∼";
    case "element_of":
      return "∈";
    case "right_arrow":
      return "→";
    case "maps_to":
      return "↦";
    case "product":
      return "*";
    case "center_dot":
      return "·";
    case "times":
      return "×";
    case "divide":
      return "/";
    case "tensor_product":
      return "⊗";
  }
}

function mathOperatorPrecedence(operator: MathBinaryOperator): number {
  switch (operator) {
    case "right_arrow":
    case "maps_to":
      return 0;
    case "equals":
    case "not_equals":
    case "less_than":
    case "less_equals":
    case "greater_than":
    case "greater_equals":
    case "approximately_equals":
    case "similar":
    case "element_of":
      return 1;
    case "plus":
    case "minus":
      return 2;
    case "times":
    case "divide":
    case "product":
    case "center_dot":
    case "tensor_product":
      return 3;
  }
}

function mathExpressionPrecedence(expression: MathExpression): number {
  return expression.kind === "binary" ? mathOperatorPrecedence(expression.operator) : 4;
}

function mathExpressionStartsWithNegation(expression: MathExpression): boolean {
  if (expression.kind === "negated") {
    return true;
  }
  if (expression.kind === "binary") {
    return mathExpressionStartsWithNegation(expression.left);
  }
  if (expression.kind === "comma_sequence") {
    const firstItem = expression.items[0];
    return firstItem === undefined ? false : mathExpressionStartsWithNegation(firstItem);
  }
  return false;
}

export function mathExpressionNeedsParentheses(
  expression: MathExpression,
  parentOperator: MathBinaryOperator | null,
  branch: MathBinaryBranch | null,
): boolean {
  if (parentOperator === null) {
    return false;
  }
  if (
    branch === "right" &&
    (parentOperator === "plus" || parentOperator === "minus") &&
    mathExpressionStartsWithNegation(expression)
  ) {
    return true;
  }
  if (expression.kind === "negated") {
    return branch === "right" && (parentOperator === "plus" || parentOperator === "minus");
  }
  if (expression.kind !== "binary") {
    return false;
  }
  const precedence = mathExpressionPrecedence(expression);
  const parentPrecedence = mathOperatorPrecedence(parentOperator);
  const samePrecedenceNeedsGrouping =
    branch === "right" &&
    (expression.operator !== parentOperator ||
      parentOperator === "minus" ||
      parentOperator === "divide" ||
      mathOperatorPrecedence(parentOperator) <= 1);
  return (
    precedence < parentPrecedence ||
    (precedence === parentPrecedence && samePrecedenceNeedsGrouping)
  );
}

function renderMathExpression(
  expression: MathExpression,
  parentOperator: MathBinaryOperator | null,
  branch: MathBinaryBranch | null,
): string {
  if (expression.kind === "slot") {
    return "□";
  }
  if (expression.kind === "integer") {
    return expression.value;
  }
  if (expression.kind === "decimal") {
    return expression.value;
  }
  if (expression.kind === "identifier") {
    return mathIdentifierText(expression);
  }
  if (expression.kind === "text") {
    return expression.value;
  }
  if (expression.kind === "symbol") {
    return mathSymbolGlyph(expression.name);
  }
  if (expression.kind === "function") {
    const delimiters: Readonly<Record<MathFunctionDelimiter, readonly [string, string]>> = {
      parentheses: ["(", ")"],
      brackets: ["[", "]"],
      angle: ["⟨", "⟩"],
    };
    const [open, close] = delimiters[expression.delimiter];
    return `${expression.name}${open}${renderMathExpression(expression.argument, null, null)}${close}`;
  }
  if (expression.kind === "underbrace") {
    return `underbrace(${renderMathExpression(expression.body, null, null)}, ${renderMathExpression(expression.annotation, null, null)})`;
  }
  if (expression.kind === "summation") {
    return `Σ_{${renderMathExpression(expression.lower, null, null)}}^{${renderMathExpression(expression.upper, null, null)}} ${renderMathExpression(expression.body, null, null)}`;
  }
  if (expression.kind === "fraction") {
    return `(${renderMathExpression(expression.numerator, null, null)}) / (${renderMathExpression(expression.denominator, null, null)})`;
  }
  if (expression.kind === "radical") {
    const body = renderMathExpression(expression.body, null, null);
    return expression.degree === null
      ? `√(${body})`
      : `root(${renderMathExpression(expression.degree, null, null)}, ${body})`;
  }
  if (expression.kind === "script") {
    const base = renderMathExpression(expression.base, null, null);
    const subscript = expression.subscript === null
      ? ""
      : `_{${renderMathExpression(expression.subscript, null, null)}}`;
    const superscript = expression.superscript === null
      ? ""
      : `^{${renderMathExpression(expression.superscript, null, null)}}`;
    return `${base}${subscript}${superscript}`;
  }
  if (expression.kind === "parenthesized") {
    return `(${renderMathExpression(expression.body, null, null)})`;
  }
  if (expression.kind === "delimited") {
    const [open, close] = expression.delimiter === "brackets" ? ["[", "]"] : ["{", "}"];
    return `${open}${renderMathExpression(expression.body, null, null)}${close}`;
  }
  if (expression.kind === "negated") {
    const renderedBody = renderMathExpression(expression.body, null, null);
    const renderedNegation = expression.body.kind === "binary" || expression.body.kind === "comma_sequence"
      ? `−(${renderedBody})`
      : `−${renderedBody}`;
    return mathExpressionNeedsParentheses(expression, parentOperator, branch)
      ? `(${renderedNegation})`
      : renderedNegation;
  }
  if (expression.kind === "comma_sequence") {
    return expression.items
      .map((item) => renderMathExpression(item, null, null))
      .join(", ");
  }
  if (expression.kind === "grid") {
    const renderedRows = Array.from({ length: expression.rows }, (_, row) =>
      expression.cells
        .slice(row * expression.columns, (row + 1) * expression.columns)
        .map((cell) => renderMathExpression(cell, null, null))
        .join(", "),
    );
    return renderedRows.join("; ");
  }

  const rendered = `${renderMathExpression(expression.left, expression.operator, "left")} ${mathOperatorSymbol(expression.operator)} ${renderMathExpression(expression.right, expression.operator, "right")}`;
  if (parentOperator === null) {
    return rendered;
  }

  return mathExpressionNeedsParentheses(expression, parentOperator, branch)
    ? `(${rendered})`
    : rendered;
}

export function mathExpressionToText(expression: MathExpression): string {
  return renderMathExpression(expression, null, null);
}

export function validateMathExpression(expression: MathExpression): void {
  const visitedIds = new Set<string>();
  let nodeCount = 0;

  const visit = (node: MathExpression, depth: number): void => {
    nodeCount += 1;
    if (nodeCount > 256 || depth > 32) {
      throw new Error("A builder math expression is too large or deeply nested");
    }
    if (node.id.length === 0 || visitedIds.has(node.id)) {
      throw new Error("Builder math nodes require unique, non-empty IDs");
    }
    visitedIds.add(node.id);

    switch (node.kind) {
      case "slot":
        return;
      case "integer":
        if (!/^\d+$/u.test(node.value)) {
          throw new Error("Builder math integers require decimal digits");
        }
        return;
      case "decimal":
        if (!/^(?:\d+\.\d*|\.\d+)$/u.test(node.value)) {
          throw new Error("Builder math decimals require digits and one decimal point");
        }
        return;
      case "identifier":
        if (!/^[A-Za-z][A-Za-z0-9]*$/u.test(node.name)) {
          throw new Error("Builder math identifiers require an ASCII identifier");
        }
        if (!isMathIdentifierStyle(node.style)) {
          throw new Error("Builder math identifiers require a supported presentation style");
        }
        return;
      case "text":
        if (!isValidMathText(node.value)) {
          throw new Error(
            "Builder math text must be non-empty and contain no ASCII control characters",
          );
        }
        return;
      case "symbol":
        if (!(mathSymbolNames as readonly string[]).includes(node.name)) {
          throw new Error("Builder math symbols require a registered semantic name");
        }
        return;
      case "function":
        if (!/^[A-Za-z][A-Za-z0-9]*$/u.test(node.name)) {
          throw new Error("Builder math function names require an ASCII identifier");
        }
        if (!isMathFunctionDelimiter(node.delimiter)) {
          throw new Error("Builder math functions require a supported delimiter");
        }
        visit(node.argument, depth + 1);
        return;
      case "underbrace":
        visit(node.body, depth + 1);
        visit(node.annotation, depth + 1);
        return;
      case "binary":
        visit(node.left, depth + 1);
        visit(node.right, depth + 1);
        return;
      case "summation":
        visit(node.lower, depth + 1);
        visit(node.upper, depth + 1);
        visit(node.body, depth + 1);
        return;
      case "fraction":
        visit(node.numerator, depth + 1);
        visit(node.denominator, depth + 1);
        return;
      case "radical":
        visit(node.body, depth + 1);
        if (node.degree !== null) {
          visit(node.degree, depth + 1);
        }
        return;
      case "script":
        if (node.subscript === null && node.superscript === null) {
          throw new Error("Builder math scripts require a subscript or superscript");
        }
        visit(node.base, depth + 1);
        if (node.subscript !== null) {
          visit(node.subscript, depth + 1);
        }
        if (node.superscript !== null) {
          visit(node.superscript, depth + 1);
        }
        return;
      case "parenthesized":
      case "delimited":
      case "negated":
        visit(node.body, depth + 1);
        return;
      case "comma_sequence":
        if (node.items.length < 2) {
          throw new Error("Builder comma-separated math sequences require two items");
        }
        node.items.forEach((item) => {
          visit(item, depth + 1);
        });
        return;
      case "grid":
        if (
          !Number.isSafeInteger(node.rows) ||
          !Number.isSafeInteger(node.columns) ||
          !Number.isSafeInteger(node.rows * node.columns) ||
          node.rows <= 0 ||
          node.columns <= 0 ||
          node.cells.length !== node.rows * node.columns
        ) {
          throw new Error("Builder math grids require positive rectangular dimensions");
        }
        node.cells.forEach((cell) => {
          visit(cell, depth + 1);
        });
        return;
    }
  };

  visit(expression, 0);
}

interface SerializedMathEnvelope {
  readonly format: "dans.math.expression";
  readonly version: 1;
  readonly expression: SerializedMathExpression;
}

type SerializedMathExpression =
  | Readonly<{ kind: "slot" }>
  | Readonly<{ kind: "integer"; value: string }>
  | Readonly<{ kind: "decimal"; value: string }>
  | Readonly<{
      kind: "identifier";
      name: string;
      style?: Exclude<MathIdentifierStyle, "italic">;
    }>
  | Readonly<{ kind: "text"; value: string }>
  | Readonly<{ kind: "symbol"; name: MathSymbolName }>
  | Readonly<{
      kind: "function";
      name: string;
      namedOperator: boolean;
      delimiter: MathFunctionDelimiter;
      argument: SerializedMathExpression;
    }>
  | Readonly<{
      kind: "underbrace";
      body: SerializedMathExpression;
      annotation: SerializedMathExpression;
    }>
  | Readonly<{
      kind: "binary";
      operator: MathBinaryOperator;
      left: SerializedMathExpression;
      right: SerializedMathExpression;
    }>
  | Readonly<{
      kind: "summation";
      lower: SerializedMathExpression;
      upper: SerializedMathExpression;
      body: SerializedMathExpression;
    }>
  | Readonly<{
      kind: "fraction";
      numerator: SerializedMathExpression;
      denominator: SerializedMathExpression;
    }>
  | Readonly<{
      kind: "radical";
      body: SerializedMathExpression;
      degree: SerializedMathExpression | null;
    }>
  | Readonly<{
      kind: "script";
      base: SerializedMathExpression;
      subscript: SerializedMathExpression | null;
      superscript: SerializedMathExpression | null;
    }>
  | Readonly<{ kind: "parenthesized"; body: SerializedMathExpression }>
  | Readonly<{
      kind: "delimited";
      delimiter: MathDelimitedExpression["delimiter"];
      body: SerializedMathExpression;
    }>
  | Readonly<{ kind: "negated"; body: SerializedMathExpression }>
  | Readonly<{
      kind: "comma_sequence";
      items: readonly SerializedMathExpression[];
    }>
  | Readonly<{
      kind: "grid";
      rows: number;
      columns: number;
      cells: readonly SerializedMathExpression[];
    }>;

function serializeMathNode(expression: MathExpression): SerializedMathExpression {
  switch (expression.kind) {
    case "slot":
      return { kind: "slot" };
    case "integer":
      return { kind: "integer", value: expression.value };
    case "decimal":
      return { kind: "decimal", value: expression.value };
    case "identifier":
      return expression.style === "italic"
        ? { kind: "identifier", name: expression.name }
        : { kind: "identifier", name: expression.name, style: expression.style };
    case "text":
      return { kind: "text", value: expression.value };
    case "symbol":
      return { kind: "symbol", name: expression.name };
    case "function":
      return {
        kind: "function",
        name: expression.name,
        namedOperator: expression.namedOperator,
        delimiter: expression.delimiter,
        argument: serializeMathNode(expression.argument),
      };
    case "underbrace":
      return {
        kind: "underbrace",
        body: serializeMathNode(expression.body),
        annotation: serializeMathNode(expression.annotation),
      };
    case "binary":
      return {
        kind: "binary",
        operator: expression.operator,
        left: serializeMathNode(expression.left),
        right: serializeMathNode(expression.right),
      };
    case "summation":
      return {
        kind: "summation",
        lower: serializeMathNode(expression.lower),
        upper: serializeMathNode(expression.upper),
        body: serializeMathNode(expression.body),
      };
    case "fraction":
      return {
        kind: "fraction",
        numerator: serializeMathNode(expression.numerator),
        denominator: serializeMathNode(expression.denominator),
      };
    case "radical":
      return {
        kind: "radical",
        body: serializeMathNode(expression.body),
        degree: expression.degree === null ? null : serializeMathNode(expression.degree),
      };
    case "script":
      return {
        kind: "script",
        base: serializeMathNode(expression.base),
        subscript:
          expression.subscript === null ? null : serializeMathNode(expression.subscript),
        superscript:
          expression.superscript === null ? null : serializeMathNode(expression.superscript),
      };
    case "parenthesized":
      return { kind: "parenthesized", body: serializeMathNode(expression.body) };
    case "delimited":
      return {
        kind: "delimited",
        delimiter: expression.delimiter,
        body: serializeMathNode(expression.body),
      };
    case "negated":
      return { kind: "negated", body: serializeMathNode(expression.body) };
    case "comma_sequence":
      return {
        kind: "comma_sequence",
        items: expression.items.map(serializeMathNode),
      };
    case "grid":
      return {
        kind: "grid",
        rows: expression.rows,
        columns: expression.columns,
        cells: expression.cells.map(serializeMathNode),
      };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireObject(value: unknown, context: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`${context} must be an object`);
  }
  return value;
}

function requireStringField(
  value: Record<string, unknown>,
  field: string,
  context: string,
): string {
  const fieldValue = value[field];
  if (typeof fieldValue !== "string") {
    throw new Error(`${context}.${field} must be a string`);
  }
  return fieldValue;
}

function requireNumberField(
  value: Record<string, unknown>,
  field: string,
  context: string,
): number {
  const fieldValue = value[field];
  if (typeof fieldValue !== "number") {
    throw new Error(`${context}.${field} must be a number`);
  }
  return fieldValue;
}

function requireBooleanField(
  value: Record<string, unknown>,
  field: string,
  context: string,
): boolean {
  const fieldValue = value[field];
  if (typeof fieldValue !== "boolean") {
    throw new Error(`${context}.${field} must be a boolean`);
  }
  return fieldValue;
}

function parseSerializedMathSymbolName(name: string): MathSymbolName {
  if ((mathSymbolNames as readonly string[]).includes(name)) {
    return name as MathSymbolName;
  }
  switch (name) {
    case "ellipsis":
      return "dots";
    case "centered_ellipsis":
      return "cdots";
    case "script_ell":
      return "ell";
    default:
      throw new Error(`Unsupported serialized math symbol: ${name}`);
  }
}

function parseSerializedMathNode(value: unknown): MathExpression {
  const node = requireObject(value, "Serialized math node");
  const kind = requireStringField(node, "kind", "Serialized math node");
  switch (kind) {
    case "slot":
      return createMathSlot();
    case "integer":
      return createMathInteger(requireStringField(node, "value", "Integer"));
    case "decimal":
      return createMathDecimal(requireStringField(node, "value", "Decimal"));
    case "identifier": {
      const name = requireStringField(node, "name", "Identifier");
      const style = node.style ?? "italic";
      if (!isMathIdentifierStyle(style)) {
        throw new Error("Unsupported serialized math identifier style");
      }
      return createMathStyledIdentifier(name, style);
    }
    case "text":
      return createMathText(requireStringField(node, "value", "Math text"));
    case "symbol": {
      const name = requireStringField(node, "name", "Symbol");
      return createMathSymbol(parseSerializedMathSymbolName(name));
    }
    case "function": {
      const delimiter = requireStringField(node, "delimiter", "Function");
      if (!isMathFunctionDelimiter(delimiter)) {
        throw new Error(`Unsupported serialized math function delimiter: ${delimiter}`);
      }
      return createMathFunction(
        requireStringField(node, "name", "Function"),
        parseSerializedMathNode(node.argument),
        delimiter,
        requireBooleanField(node, "namedOperator", "Function"),
      );
    }
    case "underbrace":
      return createMathUnderbrace(
        parseSerializedMathNode(node.body),
        parseSerializedMathNode(node.annotation),
      );
    case "binary": {
      const operator = requireStringField(node, "operator", "Binary expression");
      if (
        operator !== "plus" &&
        operator !== "minus" &&
        operator !== "equals" &&
        operator !== "not_equals" &&
        operator !== "less_than" &&
        operator !== "less_equals" &&
        operator !== "greater_than" &&
        operator !== "greater_equals" &&
        operator !== "approximately_equals" &&
        operator !== "similar" &&
        operator !== "element_of" &&
        operator !== "right_arrow" &&
        operator !== "maps_to" &&
        operator !== "product" &&
        operator !== "center_dot" &&
        operator !== "times" &&
        operator !== "divide" &&
        operator !== "tensor_product"
      ) {
        throw new Error(`Unsupported serialized binary operator: ${operator}`);
      }
      return createMathBinary(
        operator,
        parseSerializedMathNode(node.left),
        parseSerializedMathNode(node.right),
      );
    }
    case "summation":
      return createMathSummation(
        parseSerializedMathNode(node.lower),
        parseSerializedMathNode(node.upper),
        parseSerializedMathNode(node.body),
      );
    case "fraction":
      return createMathFraction(
        parseSerializedMathNode(node.numerator),
        parseSerializedMathNode(node.denominator),
      );
    case "radical":
      return createMathRadical(
        parseSerializedMathNode(node.body),
        node.degree === null ? null : parseSerializedMathNode(node.degree),
      );
    case "script":
      return createMathScript(
        parseSerializedMathNode(node.base),
        node.subscript === null ? null : parseSerializedMathNode(node.subscript),
        node.superscript === null ? null : parseSerializedMathNode(node.superscript),
      );
    case "parenthesized":
      return createMathParenthesized(parseSerializedMathNode(node.body));
    case "delimited": {
      const delimiter = requireStringField(node, "delimiter", "Delimited expression");
      if (delimiter !== "brackets" && delimiter !== "braces") {
        throw new Error(`Unsupported serialized math delimiter: ${delimiter}`);
      }
      return createMathDelimited(delimiter, parseSerializedMathNode(node.body));
    }
    case "negated":
      return createMathNegated(parseSerializedMathNode(node.body));
    case "comma_sequence": {
      if (!Array.isArray(node.items)) {
        throw new Error("Comma-separated expression.items must be an array");
      }
      return createMathCommaSequence(node.items.map(parseSerializedMathNode));
    }
    case "grid": {
      if (!Array.isArray(node.cells)) {
        throw new Error("Grid expression.cells must be an array");
      }
      return createMathGrid(
        requireNumberField(node, "rows", "Grid expression"),
        requireNumberField(node, "columns", "Grid expression"),
        node.cells.map(parseSerializedMathNode),
      );
    }
    default:
      throw new Error(`Unsupported serialized math node kind: ${kind}`);
  }
}

export function mathExpressionToTransport(
  expression: MathExpression,
): SerializedMathExpression {
  validateMathExpression(expression);
  return serializeMathNode(expression);
}

export function mathExpressionFromTransport(value: unknown): MathExpression {
  const expression = parseSerializedMathNode(value);
  validateMathExpression(expression);
  return expression;
}

export function mathExpressionToString(expression: MathExpression): string {
  const envelope: SerializedMathEnvelope = {
    format: "dans.math.expression",
    version: 1,
    expression: mathExpressionToTransport(expression),
  };
  return JSON.stringify(envelope);
}

export function mathExpressionFromString(source: string): MathExpression {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source) as unknown;
  } catch {
    throw new Error("Serialized math must be valid JSON");
  }
  const envelope = requireObject(parsed, "Serialized math envelope");
  if (envelope.format !== "dans.math.expression" || envelope.version !== 1) {
    throw new Error("Unsupported serialized math format or version");
  }
  return mathExpressionFromTransport(envelope.expression);
}
