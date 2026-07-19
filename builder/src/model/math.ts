// builder/src/model/math.ts — model and transform the constrained structured-math tree.

export type MathBinaryOperator = "plus" | "minus" | "equals" | "times" | "divide";
export type MathBinaryBranch = "left" | "right";
export type MathSummationBranch = "lower" | "upper" | "body";
export type MathSequenceBranch = `item:${number}`;
export type MathGridBranch = `cell:${number}`;
export type MathBranch =
  | MathBinaryBranch
  | MathSummationBranch
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
  | MathBinaryExpression
  | MathSummationExpression
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
  const renderedName = name.trim();
  if (!/^[A-Za-z]+$/u.test(renderedName)) {
    throw new Error(`Math identifiers require ASCII letters, received '${name}'`);
  }
  return Object.freeze({ id, kind: "identifier", name: renderedName });
}

export function createMathLeafFromInput(value: string): MathInteger | MathDecimal | MathIdentifier {
  const renderedValue = value.trim();
  if (/^\d+$/u.test(renderedValue)) {
    return createMathInteger(renderedValue);
  }
  if (/^(?:\d+\.\d*|\.\d+)$/u.test(renderedValue)) {
    return createMathDecimal(renderedValue);
  }
  if (/^[A-Za-z]+$/u.test(renderedValue)) {
    return createMathIdentifier(renderedValue);
  }
  throw new Error("A math leaf must be an unsigned decimal number or ASCII letters");
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
    expression.kind === "identifier"
  ) {
    return false;
  }
  if (expression.kind === "summation") {
    return (
      mathExpressionHasSlots(expression.lower) ||
      mathExpressionHasSlots(expression.upper) ||
      mathExpressionHasSlots(expression.body)
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
    case "times":
      return "×";
    case "divide":
      return "/";
  }
}

function mathOperatorPrecedence(operator: MathBinaryOperator): number {
  switch (operator) {
    case "equals":
      return 1;
    case "plus":
    case "minus":
      return 2;
    case "times":
    case "divide":
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
      parentOperator === "equals");
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
    return expression.name;
  }
  if (expression.kind === "summation") {
    return `Σ_{${renderMathExpression(expression.lower, null, null)}}^{${renderMathExpression(expression.upper, null, null)}} ${renderMathExpression(expression.body, null, null)}`;
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
        if (!/^[A-Za-z]+$/u.test(node.name)) {
          throw new Error("Builder math identifiers require ASCII letters");
        }
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
  | Readonly<{ kind: "identifier"; name: string }>
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
      return { kind: "identifier", name: expression.name };
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
    case "identifier":
      return createMathIdentifier(requireStringField(node, "name", "Identifier"));
    case "binary": {
      const operator = requireStringField(node, "operator", "Binary expression");
      if (
        operator !== "plus" &&
        operator !== "minus" &&
        operator !== "equals" &&
        operator !== "times" &&
        operator !== "divide"
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
