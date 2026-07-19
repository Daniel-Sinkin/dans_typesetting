// Render and edit the constrained structured-math presentation tree.
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

import type { BuilderBlockEditorProps } from "../builder/plugin";
import type {
  MathEditorExtension,
  MathEditorPaletteItem,
} from "../math/editorExtension";
import type { MathInputParserPlugin } from "../math/inputParser";
import {
  createMathBinary,
  createMathFraction,
  createMathInteger,
  createMathLeafFromInput,
  createMathParenthesized,
  createMathRadical,
  createMathScript,
  createMathSlot,
  createMathSummation,
  createMathSymbol,
  detachMathExpressionAtPath,
  mathExpressionAtPath,
  mathExpressionHasSlots,
  mathExpressionNeedsParentheses,
  mathExpressionToString,
  mathExpressionToText,
  mathGridBranch,
  mathOperatorSymbol,
  mathPathKey,
  mathSequenceBranch,
  mathSymbolGlyph,
  mathSymbolNames,
  parseMathPath,
  replaceMathExpressionAtPath,
  type MathBinaryBranch,
  type MathBinaryOperator,
  type MathExpression,
  type MathPath,
  type MathSymbolName,
} from "../model/math";
import {
  isMathDisplayBlock,
  type BuilderBlock,
  type MathDisplayBlock,
} from "../model/document";
import { editableReferenceIdError } from "../builder/referenceEditing";

const detachMovementThresholdPx = 7;

function requireDisplayMath(block: BuilderBlock): MathDisplayBlock {
  if (!isMathDisplayBlock(block)) {
    throw new Error(`Structured-math plugin cannot consume ${block.typeId}`);
  }
  return block;
}

interface MathTreeProps {
  readonly expression: MathExpression;
  readonly selectedPathKey?: string | undefined;
  readonly onBeginDrag?:
    | ((
        expression: MathExpression,
        path: MathPath,
        event: ReactPointerEvent<HTMLSpanElement>,
      ) => void)
    | undefined;
  readonly onHoverPath?: ((path: MathPath) => void) | undefined;
  readonly renderSlot?: ((path: MathPath) => ReactNode) | undefined;
  readonly renderNodeEditor?:
    | ((expression: MathExpression, path: MathPath) => ReactNode | null)
    | undefined;
  readonly selectionCandidates?: readonly MathSelectionCandidate[] | undefined;
  readonly onHoverSelection?: ((target: MathSelectionTarget) => void) | undefined;
}

interface MathSelectionTarget {
  readonly kind: "node" | "operator";
  readonly path: MathPath;
}

interface MathSelectionCandidate {
  readonly target: MathSelectionTarget;
  readonly number: number;
  readonly color: string;
  readonly locked: boolean;
}

interface MathSelectionLock {
  readonly target: MathSelectionTarget;
  readonly containingScopePath: MathPath;
}

interface MathSelectionStyle extends CSSProperties {
  readonly "--math-selection-color": string;
}

interface MathContextMenuState {
  readonly target: MathSelectionTarget;
  readonly clientX: number;
  readonly clientY: number;
}

const mathSelectionColors = ["#f59f00", "#1c7ed6", "#9c36b5", "#2b8a3e"] as const;

function mathSelectionKey(target: MathSelectionTarget): string {
  return `${target.kind}:${mathPathKey(target.path)}`;
}

function sameMathSelection(
  left: MathSelectionTarget | null,
  right: MathSelectionTarget,
): boolean {
  return left !== null && mathSelectionKey(left) === mathSelectionKey(right);
}

function selectionStyle(color: string): MathSelectionStyle {
  return { "--math-selection-color": color };
}

function makeSelectionCandidate(
  target: MathSelectionTarget,
  number: number,
  lockedSelection: MathSelectionTarget | null,
): MathSelectionCandidate {
  return {
    target,
    number,
    color: mathSelectionColors[number - 1] ?? mathSelectionColors[0],
    locked: sameMathSelection(lockedSelection, target),
  };
}

function selectionCandidatesForScope(
  expression: MathExpression,
  scopePath: MathPath,
  lockedSelection: MathSelectionTarget | null,
): readonly MathSelectionCandidate[] {
  const whole = makeSelectionCandidate(
    { kind: "node", path: scopePath },
    1,
    lockedSelection,
  );
  switch (expression.kind) {
    case "binary":
      return [
        whole,
        makeSelectionCandidate(
          { kind: "node", path: [...scopePath, "left"] },
          2,
          lockedSelection,
        ),
        makeSelectionCandidate(
          { kind: "operator", path: scopePath },
          3,
          lockedSelection,
        ),
        makeSelectionCandidate(
          { kind: "node", path: [...scopePath, "right"] },
          4,
          lockedSelection,
        ),
      ];
    case "summation":
      return [
        whole,
        makeSelectionCandidate(
          { kind: "node", path: [...scopePath, "lower"] },
          2,
          lockedSelection,
        ),
        makeSelectionCandidate(
          { kind: "node", path: [...scopePath, "upper"] },
          3,
          lockedSelection,
        ),
        makeSelectionCandidate(
          { kind: "node", path: [...scopePath, "body"] },
          4,
          lockedSelection,
        ),
      ];
    case "fraction":
      return [
        whole,
        makeSelectionCandidate(
          { kind: "node", path: [...scopePath, "numerator"] },
          2,
          lockedSelection,
        ),
        makeSelectionCandidate(
          { kind: "node", path: [...scopePath, "denominator"] },
          3,
          lockedSelection,
        ),
      ];
    case "radical":
      return [
        whole,
        makeSelectionCandidate(
          { kind: "node", path: [...scopePath, "body"] },
          2,
          lockedSelection,
        ),
        ...(expression.degree === null
          ? []
          : [
              makeSelectionCandidate(
                { kind: "node", path: [...scopePath, "degree"] },
                3,
                lockedSelection,
              ),
            ]),
      ];
    case "script":
      return [
        whole,
        makeSelectionCandidate(
          { kind: "node", path: [...scopePath, "base"] },
          2,
          lockedSelection,
        ),
        ...(expression.subscript === null
          ? []
          : [
              makeSelectionCandidate(
                { kind: "node", path: [...scopePath, "subscript"] },
                3,
                lockedSelection,
              ),
            ]),
        ...(expression.superscript === null
          ? []
          : [
              makeSelectionCandidate(
                { kind: "node", path: [...scopePath, "superscript"] },
                expression.subscript === null ? 3 : 4,
                lockedSelection,
              ),
            ]),
      ];
    case "parenthesized":
    case "delimited":
      return [
        whole,
        makeSelectionCandidate(
          { kind: "node", path: [...scopePath, "body"] },
          2,
          lockedSelection,
        ),
      ];
    case "negated":
      return [
        whole,
        makeSelectionCandidate(
          { kind: "operator", path: scopePath },
          2,
          lockedSelection,
        ),
        makeSelectionCandidate(
          { kind: "node", path: [...scopePath, "body"] },
          3,
          lockedSelection,
        ),
      ];
    case "comma_sequence":
      return [
        whole,
        ...expression.items.slice(0, 3).map((_, index) =>
          makeSelectionCandidate(
            { kind: "node", path: [...scopePath, mathSequenceBranch(index)] },
            index + 2,
            lockedSelection,
          ),
        ),
      ];
    case "grid":
      return [
        whole,
        ...expression.cells.slice(0, 3).map((_, index) =>
          makeSelectionCandidate(
            { kind: "node", path: [...scopePath, mathGridBranch(index)] },
            index + 2,
            lockedSelection,
          ),
        ),
      ];
    case "slot":
    case "integer":
    case "decimal":
    case "identifier":
    case "symbol":
      return [whole];
  }
}

function selectionTargetFromElement(element: Element): MathSelectionTarget | null {
  const selection = element.closest<HTMLElement>("[data-math-selection-kind]");
  if (selection === null) {
    return null;
  }
  const kind = selection.dataset.mathSelectionKind;
  const path = parseMathPath(selection.dataset.mathSelectionPath ?? "");
  if ((kind !== "node" && kind !== "operator") || path === null) {
    return null;
  }
  return { kind, path };
}

interface MathNodeProps extends MathTreeProps {
  readonly path: MathPath;
  readonly parentOperator: MathBinaryOperator | null;
  readonly parentBranch: MathBinaryBranch | null;
}

function MathNode({
  expression,
  path,
  selectedPathKey,
  onBeginDrag,
  onHoverPath,
  renderSlot,
  renderNodeEditor,
  selectionCandidates,
  onHoverSelection,
  parentOperator,
  parentBranch,
}: MathNodeProps) {
  const currentPathKey = mathPathKey(path);
  const nodeSelection: MathSelectionTarget = { kind: "node", path };
  const nodeCandidate = selectionCandidates?.find(
    (candidate) => mathSelectionKey(candidate.target) === mathSelectionKey(nodeSelection),
  );
  const classes = [
    "math-node",
    `math-node--${expression.kind}`,
    selectedPathKey === currentPathKey ? "math-node--selected" : "",
    onBeginDrag === undefined || expression.kind === "slot" ? "" : "math-node--draggable",
    nodeCandidate === undefined ? "" : "math-node--selection-candidate",
    nodeCandidate?.locked === true ? "math-node--selection-locked" : "",
  ]
    .filter((className) => className.length > 0)
    .join(" ");

  const sharedProps = {
    className: classes,
    "data-math-path": currentPathKey,
    ...(nodeCandidate === undefined
      ? {}
      : {
          "data-math-selection-kind": "node",
          "data-math-selection-path": currentPathKey,
        }),
    style:
      nodeCandidate === undefined
        ? undefined
        : selectionStyle(nodeCandidate.color),
    onPointerMove: (event: ReactPointerEvent<HTMLSpanElement>) => {
      event.stopPropagation();
      onHoverPath?.(path);
      if (nodeCandidate !== undefined) {
        onHoverSelection?.(nodeCandidate.target);
      }
    },
    onPointerDown: (event: ReactPointerEvent<HTMLSpanElement>) => {
      if (expression.kind === "slot" || onBeginDrag === undefined) {
        return;
      }
      event.stopPropagation();
      onBeginDrag(expression, path, event);
    },
  };

  const replacementEditor = renderNodeEditor?.(expression, path) ?? null;
  if (replacementEditor !== null) {
    return (
      <span {...sharedProps}>
        {nodeCandidate === undefined ? null : (
          <span className="math-selection-badge">
            {nodeCandidate.number}{nodeCandidate.locked ? " 🔒" : ""}
          </span>
        )}
        {replacementEditor}
      </span>
    );
  }

  const selectionBadge =
    nodeCandidate === undefined ? null : (
      <span className="math-selection-badge">
        {nodeCandidate.number}{nodeCandidate.locked ? " 🔒" : ""}
      </span>
    );

  if (expression.kind === "slot") {
    return (
      <span {...sharedProps} aria-label="Empty math slot">
        {selectionBadge}
        {renderSlot?.(path) ?? <span className="math-slot-label">drop here</span>}
      </span>
    );
  }
  if (expression.kind === "integer" || expression.kind === "decimal") {
    return <span {...sharedProps}>{selectionBadge}{expression.value}</span>;
  }
  if (expression.kind === "identifier") {
    return <span {...sharedProps}>{selectionBadge}{expression.name}</span>;
  }
  if (expression.kind === "symbol") {
    return (
      <span {...sharedProps} className={`${sharedProps.className} math-symbol`}>
        {selectionBadge}
        {mathSymbolGlyph(expression.name)}
      </span>
    );
  }
  if (expression.kind === "summation") {
    return (
      <span {...sharedProps}>
        {selectionBadge}
        <span className="math-summation-limits">
          <span className="math-summation-upper">
            <MathNode
              expression={expression.upper}
              path={[...path, "upper"]}
              parentOperator={null}
              parentBranch={null}
              selectedPathKey={selectedPathKey}
              onBeginDrag={onBeginDrag}
              onHoverPath={onHoverPath}
              renderSlot={renderSlot}
              renderNodeEditor={renderNodeEditor}
              selectionCandidates={selectionCandidates}
              onHoverSelection={onHoverSelection}
            />
          </span>
          <span className="math-summation-symbol">∑</span>
          <span className="math-summation-lower">
            <MathNode
              expression={expression.lower}
              path={[...path, "lower"]}
              parentOperator={null}
              parentBranch={null}
              selectedPathKey={selectedPathKey}
              onBeginDrag={onBeginDrag}
              onHoverPath={onHoverPath}
              renderSlot={renderSlot}
              renderNodeEditor={renderNodeEditor}
              selectionCandidates={selectionCandidates}
              onHoverSelection={onHoverSelection}
            />
          </span>
        </span>
        <span className="math-summation-body">
          <MathNode
            expression={expression.body}
            path={[...path, "body"]}
            parentOperator={null}
            parentBranch={null}
            selectedPathKey={selectedPathKey}
            onBeginDrag={onBeginDrag}
            onHoverPath={onHoverPath}
            renderSlot={renderSlot}
            renderNodeEditor={renderNodeEditor}
            selectionCandidates={selectionCandidates}
            onHoverSelection={onHoverSelection}
          />
        </span>
      </span>
    );
  }
  if (expression.kind === "fraction") {
    return (
      <span {...sharedProps}>
        {selectionBadge}
        <span className="math-fraction">
          <span className="math-fraction__numerator">
            <MathNode
              expression={expression.numerator}
              path={[...path, "numerator"]}
              parentOperator={null}
              parentBranch={null}
              selectedPathKey={selectedPathKey}
              onBeginDrag={onBeginDrag}
              onHoverPath={onHoverPath}
              renderSlot={renderSlot}
              renderNodeEditor={renderNodeEditor}
              selectionCandidates={selectionCandidates}
              onHoverSelection={onHoverSelection}
            />
          </span>
          <span className="math-fraction__denominator">
            <MathNode
              expression={expression.denominator}
              path={[...path, "denominator"]}
              parentOperator={null}
              parentBranch={null}
              selectedPathKey={selectedPathKey}
              onBeginDrag={onBeginDrag}
              onHoverPath={onHoverPath}
              renderSlot={renderSlot}
              renderNodeEditor={renderNodeEditor}
              selectionCandidates={selectionCandidates}
              onHoverSelection={onHoverSelection}
            />
          </span>
        </span>
      </span>
    );
  }
  if (expression.kind === "radical") {
    return (
      <span {...sharedProps}>
        {selectionBadge}
        <span className="math-radical">
          {expression.degree === null ? null : (
            <span className="math-radical__degree">
              <MathNode
                expression={expression.degree}
                path={[...path, "degree"]}
                parentOperator={null}
                parentBranch={null}
                selectedPathKey={selectedPathKey}
                onBeginDrag={onBeginDrag}
                onHoverPath={onHoverPath}
                renderSlot={renderSlot}
                renderNodeEditor={renderNodeEditor}
                selectionCandidates={selectionCandidates}
                onHoverSelection={onHoverSelection}
              />
            </span>
          )}
          <span className="math-radical__symbol">√</span>
          <span className="math-radical__body">
            <MathNode
              expression={expression.body}
              path={[...path, "body"]}
              parentOperator={null}
              parentBranch={null}
              selectedPathKey={selectedPathKey}
              onBeginDrag={onBeginDrag}
              onHoverPath={onHoverPath}
              renderSlot={renderSlot}
              renderNodeEditor={renderNodeEditor}
              selectionCandidates={selectionCandidates}
              onHoverSelection={onHoverSelection}
            />
          </span>
        </span>
      </span>
    );
  }
  if (expression.kind === "script") {
    return (
      <span {...sharedProps}>
        {selectionBadge}
        <span className="math-script__base">
          <MathNode
            expression={expression.base}
            path={[...path, "base"]}
            parentOperator={null}
            parentBranch={null}
            selectedPathKey={selectedPathKey}
            onBeginDrag={onBeginDrag}
            onHoverPath={onHoverPath}
            renderSlot={renderSlot}
            renderNodeEditor={renderNodeEditor}
            selectionCandidates={selectionCandidates}
            onHoverSelection={onHoverSelection}
          />
        </span>
        {expression.subscript === null ? null : (
          <span className="math-script__subscript">
            <MathNode
              expression={expression.subscript}
              path={[...path, "subscript"]}
              parentOperator={null}
              parentBranch={null}
              selectedPathKey={selectedPathKey}
              onBeginDrag={onBeginDrag}
              onHoverPath={onHoverPath}
              renderSlot={renderSlot}
              renderNodeEditor={renderNodeEditor}
              selectionCandidates={selectionCandidates}
              onHoverSelection={onHoverSelection}
            />
          </span>
        )}
        {expression.superscript === null ? null : (
          <span className="math-script__superscript">
            <MathNode
              expression={expression.superscript}
              path={[...path, "superscript"]}
              parentOperator={null}
              parentBranch={null}
              selectedPathKey={selectedPathKey}
              onBeginDrag={onBeginDrag}
              onHoverPath={onHoverPath}
              renderSlot={renderSlot}
              renderNodeEditor={renderNodeEditor}
              selectionCandidates={selectionCandidates}
              onHoverSelection={onHoverSelection}
            />
          </span>
        )}
      </span>
    );
  }
  if (expression.kind === "parenthesized") {
    return (
      <span {...sharedProps}>
        {selectionBadge}
        <span className="math-parenthesis">(</span>
        <MathNode
          expression={expression.body}
          path={[...path, "body"]}
          parentOperator={null}
          parentBranch={null}
          selectedPathKey={selectedPathKey}
          onBeginDrag={onBeginDrag}
          onHoverPath={onHoverPath}
          renderSlot={renderSlot}
          renderNodeEditor={renderNodeEditor}
          selectionCandidates={selectionCandidates}
          onHoverSelection={onHoverSelection}
        />
        <span className="math-parenthesis">)</span>
      </span>
    );
  }
  if (expression.kind === "delimited") {
    const [open, close] = expression.delimiter === "brackets" ? ["[", "]"] : ["{", "}"];
    return (
      <span {...sharedProps}>
        {selectionBadge}
        <span className="math-parenthesis math-parenthesis--open">{open}</span>
        <MathNode
          expression={expression.body}
          path={[...path, "body"]}
          parentOperator={null}
          parentBranch={null}
          selectedPathKey={selectedPathKey}
          onBeginDrag={onBeginDrag}
          onHoverPath={onHoverPath}
          renderSlot={renderSlot}
          renderNodeEditor={renderNodeEditor}
          selectionCandidates={selectionCandidates}
          onHoverSelection={onHoverSelection}
        />
        <span className="math-parenthesis math-parenthesis--close">{close}</span>
      </span>
    );
  }
  if (expression.kind === "negated") {
    const needsOuterParentheses = mathExpressionNeedsParentheses(
      expression,
      parentOperator,
      parentBranch,
    );
    return (
      <span {...sharedProps}>
        {selectionBadge}
        {needsOuterParentheses ? <span className="math-parenthesis">(</span> : null}
        <MathOperatorNode
          symbol="−"
          path={path}
          selectionCandidates={selectionCandidates}
          onHoverSelection={onHoverSelection}
        />
        {expression.body.kind === "binary" || expression.body.kind === "comma_sequence" ? (
          <span className="math-parenthesis">(</span>
        ) : null}
        <MathNode
          expression={expression.body}
          path={[...path, "body"]}
          parentOperator={null}
          parentBranch={null}
          selectedPathKey={selectedPathKey}
          onBeginDrag={onBeginDrag}
          onHoverPath={onHoverPath}
          renderSlot={renderSlot}
          renderNodeEditor={renderNodeEditor}
          selectionCandidates={selectionCandidates}
          onHoverSelection={onHoverSelection}
        />
        {expression.body.kind === "binary" || expression.body.kind === "comma_sequence" ? (
          <span className="math-parenthesis">)</span>
        ) : null}
        {needsOuterParentheses ? <span className="math-parenthesis">)</span> : null}
      </span>
    );
  }
  if (expression.kind === "comma_sequence") {
    return (
      <span {...sharedProps}>
        {selectionBadge}
        {expression.items.map((item, index) => (
          <span key={item.id}>
            {index === 0 ? null : <span className="math-comma">,</span>}
            <MathNode
              expression={item}
              path={[...path, mathSequenceBranch(index)]}
              parentOperator={null}
              parentBranch={null}
              selectedPathKey={selectedPathKey}
              onBeginDrag={onBeginDrag}
              onHoverPath={onHoverPath}
              renderSlot={renderSlot}
              renderNodeEditor={renderNodeEditor}
              selectionCandidates={selectionCandidates}
              onHoverSelection={onHoverSelection}
            />
          </span>
        ))}
      </span>
    );
  }
  if (expression.kind === "grid") {
    return (
      <span {...sharedProps}>
        {selectionBadge}
        <span
          className="math-grid"
          style={{
            gridTemplateColumns: `repeat(${String(expression.columns)}, minmax(2.4em, auto))`,
          }}
        >
          {expression.cells.map((cell, index) => (
            <span className="math-grid__cell" key={cell.id}>
              <MathNode
                expression={cell}
                path={[...path, mathGridBranch(index)]}
                parentOperator={null}
                parentBranch={null}
                selectedPathKey={selectedPathKey}
                onBeginDrag={onBeginDrag}
                onHoverPath={onHoverPath}
                renderSlot={renderSlot}
                renderNodeEditor={renderNodeEditor}
                selectionCandidates={selectionCandidates}
                onHoverSelection={onHoverSelection}
              />
            </span>
          ))}
        </span>
      </span>
    );
  }

  const needsParentheses = mathExpressionNeedsParentheses(
    expression,
    parentOperator,
    parentBranch,
  );
  return (
    <span {...sharedProps}>
      {selectionBadge}
      {needsParentheses ? <span className="math-parenthesis">(</span> : null}
      <MathNode
        expression={expression.left}
        path={[...path, "left"]}
        parentOperator={expression.operator}
        parentBranch="left"
        selectedPathKey={selectedPathKey}
        onBeginDrag={onBeginDrag}
        onHoverPath={onHoverPath}
        renderSlot={renderSlot}
        renderNodeEditor={renderNodeEditor}
        selectionCandidates={selectionCandidates}
        onHoverSelection={onHoverSelection}
      />
      <MathOperatorNode
        symbol={mathOperatorSymbol(expression.operator)}
        path={path}
        selectionCandidates={selectionCandidates}
        onHoverSelection={onHoverSelection}
      />
      <MathNode
        expression={expression.right}
        path={[...path, "right"]}
        parentOperator={expression.operator}
        parentBranch="right"
        selectedPathKey={selectedPathKey}
        onBeginDrag={onBeginDrag}
        onHoverPath={onHoverPath}
        renderSlot={renderSlot}
        renderNodeEditor={renderNodeEditor}
        selectionCandidates={selectionCandidates}
        onHoverSelection={onHoverSelection}
      />
      {needsParentheses ? <span className="math-parenthesis">)</span> : null}
    </span>
  );
}

function MathOperatorNode({
  symbol,
  path,
  selectionCandidates,
  onHoverSelection,
}: Readonly<{
  symbol: string;
  path: MathPath;
  selectionCandidates?: readonly MathSelectionCandidate[] | undefined;
  onHoverSelection?: ((target: MathSelectionTarget) => void) | undefined;
}>) {
  const target: MathSelectionTarget = { kind: "operator", path };
  const candidate = selectionCandidates?.find(
    (selection) => mathSelectionKey(selection.target) === mathSelectionKey(target),
  );
  return (
    <span
      className={[
        "math-operator",
        candidate === undefined ? "" : "math-node--selection-candidate",
        candidate?.locked === true ? "math-node--selection-locked" : "",
      ]
        .filter((className) => className.length > 0)
        .join(" ")}
      {...(candidate === undefined
        ? {}
        : {
            "data-math-selection-kind": "operator",
            "data-math-selection-path": mathPathKey(path),
          })}
      style={
        candidate === undefined
          ? undefined
          : selectionStyle(candidate.color)
      }
      onPointerMove={(event) => {
        if (candidate !== undefined) {
          event.stopPropagation();
          onHoverSelection?.(candidate.target);
        }
      }}
    >
      {candidate === undefined ? null : (
        <span className="math-selection-badge">
          {candidate.number}{candidate.locked ? " 🔒" : ""}
        </span>
      )}
      {symbol}
    </span>
  );
}

export function MathTree(props: MathTreeProps) {
  return <MathNode {...props} path={[]} parentOperator={null} parentBranch={null} />;
}

const numberPalette = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"].map(
  (value): MathEditorPaletteItem => ({
    id: `integer-${value}`,
    label: value,
    description: "Integer",
    create: () => createMathInteger(value),
  }),
);

const symbolPalette = mathSymbolNames.map(
  (symbol: MathSymbolName): MathEditorPaletteItem => ({
    id: `symbol-${symbol}`,
    label: mathSymbolGlyph(symbol),
    description: symbol.replaceAll("_", " "),
    create: () => createMathSymbol(symbol),
  }),
);

const operatorPalette = (
  [
    ["plus", "Addition"],
    ["minus", "Subtraction"],
    ["equals", "Equality"],
    ["not_equals", "Not equal"],
    ["less_than", "Less than"],
    ["less_equals", "Less than or equal"],
    ["greater_than", "Greater than"],
    ["greater_equals", "Greater than or equal"],
    ["approximately_equals", "Approximately equal"],
    ["similar", "Similar"],
    ["element_of", "Set membership"],
    ["right_arrow", "Right arrow"],
    ["maps_to", "Maps to"],
    ["product", "Asterisk product"],
    ["center_dot", "Centered-dot product"],
    ["times", "Multiplication"],
    ["divide", "Division"],
    ["tensor_product", "Tensor product"],
  ] as const satisfies readonly (readonly [MathBinaryOperator, string])[]
).map(
  ([operator, description]): MathEditorPaletteItem => ({
    id: `operator-${operator}`,
    label: mathOperatorSymbol(operator),
    description,
    create: () => createMathBinary(operator),
  }),
);

const structurePalette: readonly MathEditorPaletteItem[] = [
  {
    id: "structure-summation",
    label: "∑",
    description: "Summation with lower, upper, and body slots",
    create: () => createMathSummation(),
  },
  {
    id: "structure-fraction",
    label: "a⁄b",
    description: "Stacked fraction with numerator and denominator slots",
    create: () => createMathFraction(),
  },
  {
    id: "structure-square-root",
    label: "√x",
    description: "Square root with a radicand slot",
    create: () => createMathRadical(),
  },
  {
    id: "structure-indexed-root",
    label: "ⁿ√x",
    description: "Indexed root with degree and radicand slots",
    create: () => createMathRadical(createMathSlot(), createMathSlot()),
  },
  {
    id: "structure-subscript",
    label: "xᵢ",
    description: "Base with a subscript",
    create: () => createMathScript(createMathSlot(), createMathSlot(), null),
  },
  {
    id: "structure-superscript",
    label: "xⁿ",
    description: "Base with a superscript",
    create: () => createMathScript(createMathSlot(), null, createMathSlot()),
  },
  {
    id: "structure-scripts",
    label: "xᵢⁿ",
    description: "Base with both subscript and superscript",
    create: () => createMathScript(createMathSlot(), createMathSlot(), createMathSlot()),
  },
];

type MathDragSource = "palette" | "tree" | "parking";

interface MathDrag {
  readonly source: MathDragSource;
  readonly expression: MathExpression;
  readonly pointerId: number;
  readonly clientX: number;
  readonly clientY: number;
}

interface PendingMathDrag {
  readonly source: "tree" | "parking";
  readonly expression: MathExpression;
  readonly originPath: MathPath | null;
  readonly pointerId: number;
  readonly startClientX: number;
  readonly startClientY: number;
}

interface MathEditorProps extends BuilderBlockEditorProps {
  readonly inputParser?: MathInputParserPlugin | undefined;
  readonly editorExtensions?: readonly MathEditorExtension[] | undefined;
}

interface MathExpressionEditorProps {
  readonly expression: MathExpression;
  readonly inputParser?: MathInputParserPlugin | undefined;
  readonly editorExtensions?: readonly MathEditorExtension[] | undefined;
  readonly saveLabel?: string | undefined;
  readonly canCommit?: boolean | undefined;
  readonly onCommit: (expression: MathExpression) => void;
  readonly onCancel: () => void;
}

export function MathExpressionEditor({
  expression,
  inputParser,
  editorExtensions = [],
  saveLabel = "Save equation",
  canCommit = true,
  onCommit,
  onCancel,
}: MathExpressionEditorProps) {
  const [draft, setDraft] = useState(expression);
  const [drag, setDrag] = useState<MathDrag | null>(null);
  const [pendingDrag, setPendingDrag] = useState<PendingMathDrag | null>(null);
  const [selectedPath, setSelectedPath] = useState<MathPath>([]);
  const [dropPath, setDropPath] = useState<MathPath | null>(null);
  const [parkedExpressions, setParkedExpressions] = useState<readonly MathExpression[]>([]);
  const [parkingTargeted, setParkingTargeted] = useState(false);
  const [editingNodePath, setEditingNodePath] = useState<MathPath | null>(null);
  const [slotInput, setSlotInput] = useState("");
  const [slotInputError, setSlotInputError] = useState<string | null>(null);
  const [equationActive, setEquationActive] = useState(false);
  const [selectionScopePath, setSelectionScopePath] = useState<MathPath>([]);
  const [hoveredSelection, setHoveredSelection] = useState<MathSelectionTarget | null>(null);
  const [selectionLock, setSelectionLock] = useState<MathSelectionLock | null>(null);
  const [contextMenu, setContextMenu] = useState<MathContextMenuState | null>(null);
  const [clipboardStatus, setClipboardStatus] = useState<string | null>(null);
  const dragRef = useRef<MathDrag | null>(null);
  const pendingDragRef = useRef<PendingMathDrag | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const parkingRef = useRef<HTMLDivElement>(null);

  const updateSelectedPath = useCallback((path: MathPath): void => {
    setSelectedPath(path);
  }, []);

  const pathAtClientPoint = useCallback((clientX: number, clientY: number): MathPath | null => {
    const canvas = canvasRef.current;
    const pointedElement = document.elementFromPoint(clientX, clientY);
    if (canvas === null || !(pointedElement instanceof Element)) {
      return null;
    }
    const mathNode = pointedElement.closest<HTMLElement>("[data-math-path]");
    if (mathNode === null || !canvas.contains(mathNode)) {
      return null;
    }
    return parseMathPath(mathNode.dataset.mathPath ?? "");
  }, []);

  const pointIsInParking = useCallback((clientX: number, clientY: number): boolean => {
    const parking = parkingRef.current;
    const pointedElement = document.elementFromPoint(clientX, clientY);
    return (
      parking !== null &&
      pointedElement instanceof Element &&
      pointedElement.closest("[data-math-parking]") === parking
    );
  }, []);

  const clearPointerTracking = useCallback((): void => {
    dragRef.current = null;
    pendingDragRef.current = null;
    setDrag(null);
    setPendingDrag(null);
    setDropPath(null);
    setParkingTargeted(false);
  }, []);

  const activatePendingDrag = useCallback(
    (intent: PendingMathDrag, clientX: number, clientY: number): MathDrag => {
      if (intent.source === "tree") {
        const originPath = intent.originPath;
        if (originPath === null) {
          throw new Error("A tree drag requires an expression path");
        }
        setDraft((currentDraft) =>
          detachMathExpressionAtPath(currentDraft, originPath).expression,
        );
        setSelectionLock(null);
        setHoveredSelection(null);
        setSelectionScopePath([]);
      } else {
        setParkedExpressions((currentExpressions) =>
          Object.freeze(
            currentExpressions.filter(
              (expression) => expression.id !== intent.expression.id,
            ),
          ),
        );
      }
      const activeDrag: MathDrag = {
        source: intent.source,
        expression: intent.expression,
        pointerId: intent.pointerId,
        clientX,
        clientY,
      };
      pendingDragRef.current = null;
      dragRef.current = activeDrag;
      setPendingDrag(null);
      setDrag(activeDrag);
      setEditingNodePath(null);
      setSlotInputError(null);
      return activeDrag;
    },
    [setDraft],
  );

  const updateDropTarget = useCallback(
    (clientX: number, clientY: number): void => {
      if (pointIsInParking(clientX, clientY)) {
        setParkingTargeted(true);
        setDropPath(null);
        return;
      }
      setParkingTargeted(false);
      setDropPath(pathAtClientPoint(clientX, clientY));
    },
    [pathAtClientPoint, pointIsInParking],
  );

  const isTrackingPointer = drag !== null || pendingDrag !== null;
  useEffect(() => {
    if (!isTrackingPointer) {
      return;
    }

    const handlePointerMove = (event: PointerEvent): void => {
      const intent = pendingDragRef.current;
      if (intent?.pointerId === event.pointerId) {
        const distance = Math.hypot(
          event.clientX - intent.startClientX,
          event.clientY - intent.startClientY,
        );
        if (distance < detachMovementThresholdPx) {
          return;
        }
        event.preventDefault();
        activatePendingDrag(intent, event.clientX, event.clientY);
        updateDropTarget(event.clientX, event.clientY);
        return;
      }

      const activeDrag = dragRef.current;
      if (activeDrag?.pointerId !== event.pointerId) {
        return;
      }
      event.preventDefault();
      const movedDrag = {
        ...activeDrag,
        clientX: event.clientX,
        clientY: event.clientY,
      };
      dragRef.current = movedDrag;
      setDrag(movedDrag);
      updateDropTarget(event.clientX, event.clientY);
    };

    const handlePointerUp = (event: PointerEvent): void => {
      const intent = pendingDragRef.current;
      if (intent?.pointerId === event.pointerId) {
        pendingDragRef.current = null;
        setPendingDrag(null);
        return;
      }

      const activeDrag = dragRef.current;
      if (activeDrag?.pointerId !== event.pointerId) {
        return;
      }
      event.preventDefault();
      if (pointIsInParking(event.clientX, event.clientY)) {
        setParkedExpressions((currentExpressions) =>
          Object.freeze([...currentExpressions, activeDrag.expression]),
        );
        clearPointerTracking();
        return;
      }
      const targetPath = pathAtClientPoint(event.clientX, event.clientY);
      if (targetPath !== null) {
        setDraft((currentDraft) =>
          replaceMathExpressionAtPath(currentDraft, targetPath, activeDrag.expression),
        );
        updateSelectedPath(targetPath);
      }
      // No target deliberately means deletion: the expression was already detached.
      clearPointerTracking();
    };

    const handlePointerCancel = (event: PointerEvent): void => {
      if (
        pendingDragRef.current?.pointerId === event.pointerId ||
        dragRef.current?.pointerId === event.pointerId
      ) {
        clearPointerTracking();
      }
    };

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") {
        return;
      }
      if (pendingDragRef.current !== null || dragRef.current !== null) {
        event.stopPropagation();
        clearPointerTracking();
      }
    };

    window.addEventListener("pointermove", handlePointerMove, {
      capture: true,
      passive: false,
    });
    window.addEventListener("pointerup", handlePointerUp, { passive: false });
    window.addEventListener("pointercancel", handlePointerCancel);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove, true);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerCancel);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    activatePendingDrag,
    clearPointerTracking,
    isTrackingPointer,
    pathAtClientPoint,
    pointIsInParking,
    updateDropTarget,
    updateSelectedPath,
  ]);

  const beginPaletteDrag = (
    item: MathEditorPaletteItem,
    event: ReactPointerEvent<HTMLButtonElement>,
  ): void => {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const nextDrag: MathDrag = {
      source: "palette",
      expression: item.create(),
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
    };
    dragRef.current = nextDrag;
    setDrag(nextDrag);
    setEditingNodePath(null);
    setSlotInputError(null);
  };

  const beginTreeDragIntent = (
    expression: MathExpression,
    path: MathPath,
    event: ReactPointerEvent<HTMLSpanElement>,
  ): void => {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    updateSelectedPath(path);
    const intent: PendingMathDrag = {
      source: "tree",
      expression,
      originPath: path,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
    };
    pendingDragRef.current = intent;
    setPendingDrag(intent);
  };

  const beginParkingDragIntent = (
    expression: MathExpression,
    event: ReactPointerEvent<HTMLButtonElement>,
  ): void => {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const intent: PendingMathDrag = {
      source: "parking",
      expression,
      originPath: null,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
    };
    pendingDragRef.current = intent;
    setPendingDrag(intent);
  };

  const beginNodeInput = (path: MathPath): void => {
    updateSelectedPath(path);
    setEditingNodePath(path);
    setSlotInput("");
    setSlotInputError(null);
  };

  const cancelNodeInput = (): void => {
    setEditingNodePath(null);
    setSlotInput("");
    setSlotInputError(null);
  };

  const commitSlotInput = (path: MathPath): boolean => {
    try {
      const replacement = inputParser?.parse(slotInput) ?? createMathLeafFromInput(slotInput);
      setDraft((currentDraft) =>
        replaceMathExpressionAtPath(currentDraft, path, replacement),
      );
      updateSelectedPath(path);
      cancelNodeInput();
      return true;
    } catch (reason: unknown) {
      setSlotInputError(
        reason instanceof Error ? reason.message : "The math expression is invalid",
      );
      return false;
    }
  };

  const releaseSelectionLock = useCallback((): void => {
    setSelectionLock(null);
    setHoveredSelection(null);
    setSelectionScopePath([]);
  }, []);

  const scopeExpression = mathExpressionAtPath(draft, selectionScopePath) ?? draft;
  const selectionCandidates = useMemo(
    () =>
      equationActive && drag === null
        ? selectionCandidatesForScope(
            scopeExpression,
            selectionScopePath,
            selectionLock?.target ?? null,
          )
        : [],
    [
      drag,
      equationActive,
      selectionLock,
      scopeExpression,
      selectionScopePath,
    ],
  );

  const nodeElementForPath = useCallback(
    (path: MathPath): HTMLElement | null => {
      const canvas = canvasRef.current;
      if (canvas === null) {
        return null;
      }
      return (
        [...canvas.querySelectorAll<HTMLElement>("[data-math-path]")].find(
          (element) => element.dataset.mathPath === mathPathKey(path),
        ) ?? null
      );
    },
    [],
  );

  useEffect(() => {
    const handleSelectionKey = (event: KeyboardEvent): void => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (event.code === "Space" && selectionLock !== null) {
        event.preventDefault();
        releaseSelectionLock();
        return;
      }
      if (!equationActive || contextMenu !== null || !/^[1-4]$/u.test(event.key)) {
        return;
      }
      const candidate = selectionCandidates[Number(event.key) - 1];
      if (candidate === undefined) {
        return;
      }
      event.preventDefault();
      setSelectionLock({
        target: candidate.target,
        containingScopePath: selectionScopePath,
      });
      setHoveredSelection(candidate.target);
      setSelectedPath(candidate.target.path);
      if (candidate.target.kind === "node") {
        const expression = mathExpressionAtPath(draft, candidate.target.path);
        if (
          expression?.kind === "binary" ||
          expression?.kind === "summation" ||
          expression?.kind === "fraction" ||
          expression?.kind === "radical" ||
          expression?.kind === "script" ||
          expression?.kind === "parenthesized" ||
          expression?.kind === "delimited" ||
          expression?.kind === "negated" ||
          expression?.kind === "comma_sequence" ||
          expression?.kind === "grid"
        ) {
          setSelectionScopePath(candidate.target.path);
        }
      }
    };
    window.addEventListener("keydown", handleSelectionKey);
    return () => {
      window.removeEventListener("keydown", handleSelectionKey);
    };
  }, [
    contextMenu,
    draft,
    equationActive,
    selectionLock,
    selectionScopePath,
    releaseSelectionLock,
    selectionCandidates,
  ]);

  useEffect(() => {
    if (contextMenu === null) {
      return;
    }
    const closeMenu = (event: PointerEvent): void => {
      if (
        !(event.target instanceof Element) ||
        event.target.closest(".math-radial-menu") === null
      ) {
        setContextMenu(null);
      }
    };
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        setContextMenu(null);
      }
    };
    window.addEventListener("pointerdown", closeMenu);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("pointerdown", closeMenu);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [contextMenu]);

  const handleCanvasPointerMove = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (!(event.target instanceof Element)) {
      return;
    }
    const canvas = canvasRef.current;
    const mathNode = event.target.closest<HTMLElement>("[data-math-path]");
    if (canvas === null || mathNode === null || !canvas.contains(mathNode)) {
      setEquationActive(false);
      setHoveredSelection(null);
      if (selectionLock !== null && contextMenu === null) {
        releaseSelectionLock();
      }
      return;
    }
    setEquationActive(true);

    const pointedSelection = selectionTargetFromElement(event.target);
    if (pointedSelection !== null) {
      setHoveredSelection(pointedSelection);
      setSelectedPath(pointedSelection.path);
    }

    if (selectionLock !== null && contextMenu === null) {
      const containingScopeElement = nodeElementForPath(selectionLock.containingScopePath);
      if (containingScopeElement !== null) {
        const bounds = containingScopeElement.getBoundingClientRect();
        const insideLockedScope =
          event.clientX >= bounds.left &&
          event.clientX <= bounds.right &&
          event.clientY >= bounds.top &&
          event.clientY <= bounds.bottom;
        if (!insideLockedScope) {
          releaseSelectionLock();
        }
      }
    }
  };

  const handleCanvasContextMenu = (event: ReactMouseEvent<HTMLDivElement>): void => {
    if (!(event.target instanceof Element)) {
      return;
    }
    const canvas = canvasRef.current;
    const mathNode = event.target.closest<HTMLElement>("[data-math-path]");
    if (canvas === null || mathNode === null || !canvas.contains(mathNode)) {
      return;
    }
    const fallbackPath = parseMathPath(mathNode.dataset.mathPath ?? "");
    const target =
      selectionTargetFromElement(event.target) ??
      hoveredSelection ??
      (fallbackPath === null ? null : { kind: "node", path: fallbackPath } as const);
    if (target === null) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    setSelectedPath(target.path);
    setHoveredSelection(target);
    setContextMenu({ target, clientX: event.clientX, clientY: event.clientY });
  };

  const contextExpression =
    contextMenu === null ? null : mathExpressionAtPath(draft, contextMenu.target.path);

  const deleteContextExpression = (): void => {
    if (contextMenu === null || contextExpression === null) {
      return;
    }
    setDraft(replaceMathExpressionAtPath(draft, contextMenu.target.path, createMathSlot()));
    setContextMenu(null);
    releaseSelectionLock();
  };

  const parenthesizeContextExpression = (): void => {
    if (contextMenu === null || contextExpression === null) {
      return;
    }
    setDraft(
      replaceMathExpressionAtPath(
        draft,
        contextMenu.target.path,
        createMathParenthesized(contextExpression),
      ),
    );
    setContextMenu(null);
    releaseSelectionLock();
  };

  const parkContextExpression = (): void => {
    if (contextMenu === null || contextExpression === null) {
      return;
    }
    const detached = detachMathExpressionAtPath(draft, contextMenu.target.path);
    setDraft(detached.expression);
    setParkedExpressions((currentExpressions) =>
      Object.freeze([...currentExpressions, detached.detached]),
    );
    setContextMenu(null);
    releaseSelectionLock();
  };

  const copyContextExpression = (): void => {
    if (contextExpression === null) {
      return;
    }
    const serialized = mathExpressionToString(contextExpression);
    setContextMenu(null);
    void (async () => {
      try {
        await globalThis.navigator.clipboard.writeText(serialized);
        setClipboardStatus("Copied a versioned math expression to the clipboard.");
      } catch {
        setClipboardStatus("The browser denied clipboard access.");
      }
    })();
  };

  const insertAtContextExpression = (): void => {
    if (contextMenu === null) {
      return;
    }
    const path = contextMenu.target.path;
    setContextMenu(null);
    releaseSelectionLock();
    beginNodeInput(path);
  };

  const selectedExpression = mathExpressionAtPath(draft, selectedPath);
  const selectedPathKey =
    drag === null || dropPath === null ? undefined : mathPathKey(dropPath);

  const renderNodeInput = (_expression: MathExpression, path: MathPath): ReactNode | null => {
    const pathKey = mathPathKey(path);
    if (editingNodePath !== null && mathPathKey(editingNodePath) === pathKey) {
      return (
        <input
          autoFocus
          className="math-slot-input"
          data-math-slot-input={pathKey}
          value={slotInput}
          aria-label={`Value for math slot ${pathKey}`}
          placeholder={inputParser === undefined ? "1.25 or x" : "-3*(a + B), 4.2"}
          onPointerDown={(event) => {
            event.stopPropagation();
          }}
          onChange={(event) => {
            setSlotInput(event.target.value);
            setSlotInputError(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commitSlotInput(path);
            } else if (event.key === "Escape") {
              event.preventDefault();
              cancelNodeInput();
            }
          }}
          onBlur={() => {
            if (slotInput.trim().length === 0) {
              cancelNodeInput();
            } else {
              commitSlotInput(path);
            }
          }}
        />
      );
    }
    return null;
  };

  const renderEditableSlot = (path: MathPath): ReactNode => {
    return (
      <button
        className="math-slot-action"
        type="button"
        onPointerDown={(event) => {
          event.stopPropagation();
        }}
        onClick={(event) => {
          event.stopPropagation();
          beginNodeInput(path);
        }}
      >
        drop here
      </button>
    );
  };

  return (
    <div className="math-editor">
      <aside className="math-palette" aria-label="Math building blocks">
        <section>
          <h3>Structures</h3>
          <div className="math-palette-grid math-palette-grid--operators">
            {structurePalette.map((item) => (
              <button
                data-math-palette={item.id}
                key={item.id}
                type="button"
                title={item.description}
                onPointerDown={(event) => {
                  beginPaletteDrag(item, event);
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </section>
        {editorExtensions.map((extension) => (
          <section data-math-editor-extension={extension.id} key={extension.id}>
            <h3>{extension.label}</h3>
            <div className="math-palette-grid math-palette-grid--structures">
              {extension.items.map((item) => (
                <button
                  data-math-palette={item.id}
                  key={item.id}
                  type="button"
                  title={item.description}
                  onPointerDown={(event) => {
                    beginPaletteDrag(item, event);
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </section>
        ))}
        <section>
          <h3>Binary operators</h3>
          <div className="math-palette-grid math-palette-grid--operators">
            {operatorPalette.map((item) => (
              <button
                data-math-palette={item.id}
                key={item.id}
                type="button"
                title={item.description}
                onPointerDown={(event) => {
                  beginPaletteDrag(item, event);
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </section>
        <section>
          <h3>Symbols</h3>
          <div className="math-palette-grid math-palette-grid--symbols">
            {symbolPalette.map((item) => (
              <button
                data-math-palette={item.id}
                key={item.id}
                type="button"
                title={item.description}
                onPointerDown={(event) => {
                  beginPaletteDrag(item, event);
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </section>
        <section>
          <h3>Integers</h3>
          <div className="math-palette-grid">
            {numberPalette.map((item) => (
              <button
                data-math-palette={item.id}
                key={item.id}
                type="button"
                title={item.description}
                onPointerDown={(event) => {
                  beginPaletteDrag(item, event);
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </section>
        <p>
          Drag structures onto a node to replace it. Click a node to type
          {inputParser === undefined
            ? " a decimal number or ASCII identifier."
            : ` an expression through ${inputParser.label}.`}
        </p>
      </aside>

      <section className="math-editor-workspace">
        <div className="math-editor-status">
          <span>Selected · {mathPathKey(selectedPath)}</span>
          <code>
            {selectedExpression === null
              ? "no selection"
              : mathExpressionToText(selectedExpression)}
          </code>
        </div>
        <div
          ref={canvasRef}
          className="math-editor-canvas"
          data-testid="math-editor-canvas"
          onPointerMoveCapture={handleCanvasPointerMove}
          onContextMenu={handleCanvasContextMenu}
          onPointerLeave={() => {
            if (dragRef.current === null && pendingDragRef.current === null) {
              setEquationActive(false);
              setHoveredSelection(null);
              if (contextMenu === null) {
                releaseSelectionLock();
              }
            }
          }}
        >
          <MathTree
            expression={draft}
            selectedPathKey={selectedPathKey}
            onBeginDrag={beginTreeDragIntent}
            onHoverPath={drag === null ? updateSelectedPath : undefined}
            onHoverSelection={(target) => {
              setHoveredSelection(target);
              setSelectedPath(target.path);
            }}
            renderSlot={renderEditableSlot}
            renderNodeEditor={renderNodeInput}
            selectionCandidates={selectionCandidates}
          />
        </div>
        {slotInputError === null ? null : (
          <p className="math-slot-error">{slotInputError}</p>
        )}
        {clipboardStatus === null ? null : (
          <p className="math-clipboard-status">{clipboardStatus}</p>
        )}
        <p className="math-editor-note">
          {mathExpressionHasSlots(draft)
            ? "Empty slots are explicit incomplete authoring state; click one or drag into it."
            : "The expression has no empty slots."}
        </p>

        <section
          ref={parkingRef}
          className={`math-parking ${parkingTargeted ? "math-parking--targeted" : ""}`}
          data-math-parking="true"
          aria-label="Temporary expression parking"
        >
          <header>
            <div>
              <strong>Temporary parking</strong>
              <small>Fragments here are not part of the saved equation.</small>
            </div>
            <span>{parkedExpressions.length}</span>
          </header>
          <div className="math-parking__items">
            {parkedExpressions.length === 0 ? (
              <div className="math-parking__empty">Drop a detached fragment here to keep it.</div>
            ) : (
              parkedExpressions.map((expression) => (
                <div
                  className="math-parking__item"
                  data-math-parking-id={expression.id}
                  key={expression.id}
                >
                  <button
                    className="math-parking__grip"
                    type="button"
                    aria-label="Move parked expression"
                    onPointerDown={(event) => {
                      beginParkingDragIntent(expression, event);
                    }}
                  >
                    ⠿
                  </button>
                  <MathTree expression={expression} />
                  <button
                    className="math-parking__remove"
                    type="button"
                    onClick={() => {
                      setParkedExpressions((currentExpressions) =>
                        Object.freeze(
                          currentExpressions.filter(
                            (candidate) => candidate.id !== expression.id,
                          ),
                        ),
                      );
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

        <div className="editor-actions">
          <button
            type="button"
            disabled={isTrackingPointer || !canCommit}
            onClick={() => {
              setDraft(expression);
              onCancel();
            }}
          >
            Cancel
          </button>
          <button
            className="primary-action"
            type="button"
            disabled={isTrackingPointer}
            onClick={() => {
              onCommit(draft);
            }}
          >
            {saveLabel}
          </button>
        </div>
      </section>

      {drag === null ? null : (
        <div
          className="math-drag-ghost"
          style={{ left: drag.clientX + 14, top: drag.clientY + 14 }}
        >
          <span>{drag.source === "palette" ? "Insert" : "Detached"}</span>
          <strong>{mathExpressionToText(drag.expression)}</strong>
        </div>
      )}

      {contextMenu === null || contextExpression === null ? null : (
        <div
          className="math-radial-menu"
          data-testid="math-radial-menu"
          role="menu"
          aria-label="Math selection actions"
          style={{ left: contextMenu.clientX, top: contextMenu.clientY }}
        >
          <div className="math-radial-menu__center">
            <strong>{contextMenu.target.kind === "operator" ? "Operator" : "Expression"}</strong>
            <small>{mathPathKey(contextMenu.target.path)}</small>
          </div>
          <button type="button" role="menuitem" onClick={deleteContextExpression}>
            Delete
          </button>
          <button type="button" role="menuitem" onClick={parenthesizeContextExpression}>
            Parentheses
          </button>
          <button type="button" role="menuitem" onClick={parkContextExpression}>
            To temp
          </button>
          <button type="button" role="menuitem" onClick={copyContextExpression}>
            Copy
          </button>
          <button type="button" role="menuitem" onClick={insertAtContextExpression}>
            Insert
          </button>
          {contextMenu.target.kind === "operator" ? (
            <p>Structural operator: actions apply to its containing binary expression.</p>
          ) : null}
        </div>
      )}
    </div>
  );
}

export function MathEditor({
  block,
  onCommit,
  onCancel,
  inputParser,
  editorExtensions,
  referenceTargets,
}: MathEditorProps) {
  const displayMath = requireDisplayMath(block);
  const [referenceId, setReferenceId] = useState(displayMath.referenceId ?? "");
  const referenceError = editableReferenceIdError(
    referenceId,
    displayMath.id,
    referenceTargets,
  );
  return (
    <div className="math-block-editor">
      <label className="editor-field math-block-editor__reference">
        <span>Equation reference ID · optional</span>
        <input
          value={referenceId}
          pattern="[A-Za-z][A-Za-z0-9_.:-]*"
          placeholder="eq:energy"
          onChange={(event) => {
            setReferenceId(event.target.value);
          }}
        />
      </label>
      {referenceError === null ? null : (
        <p className="editor-error math-block-editor__reference-error">
          {referenceError}
        </p>
      )}
      <MathExpressionEditor
        expression={displayMath.expression}
        inputParser={inputParser}
        editorExtensions={editorExtensions}
        canCommit={referenceError === null}
        onCancel={onCancel}
        onCommit={(expression) => {
          onCommit(
            Object.freeze({
              ...displayMath,
              expression,
              referenceId: referenceId.length === 0 ? null : referenceId,
            }),
          );
        }}
      />
    </div>
  );
}
