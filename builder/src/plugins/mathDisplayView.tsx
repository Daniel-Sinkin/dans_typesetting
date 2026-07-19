// Render ordered display-math lines without owning their numbering policy.
import type { ReactNode } from "react";

import type { BlockOrdinal } from "../builder/numbered";
import type { BuilderReferenceTarget } from "../builder/reference";
import type { MathDisplayBlock, MathDisplayLine } from "../model/document";
import {
  mathExpressionNeedsParentheses,
  type MathExpression,
} from "../model/math";

type MathExpressionRenderer = (expression: MathExpression) => ReactNode;

function EquationBranch({
  expression,
  branch,
  renderExpression,
}: Readonly<{
  expression: MathExpression;
  branch: "left" | "right";
  renderExpression: MathExpressionRenderer;
}>) {
  const parenthesized = mathExpressionNeedsParentheses(
    expression,
    "equals",
    branch,
  );
  return (
    <span className="math-display-line__branch">
      {parenthesized ? <span className="math-parenthesis">(</span> : null}
      {renderExpression(expression)}
      {parenthesized ? <span className="math-parenthesis">)</span> : null}
    </span>
  );
}

function MathDisplayLinePreview({
  line,
  alignment,
  ordinal,
  anchorId,
  renderExpression,
}: Readonly<{
  line: MathDisplayLine;
  alignment: MathDisplayBlock["alignment"];
  ordinal: number | null;
  anchorId?: string | undefined;
  renderExpression: MathExpressionRenderer;
}>) {
  const automaticallyAligned =
    alignment === "automatic" &&
    line.expression.kind === "binary" &&
    line.expression.operator === "equals";
  return (
    <div
      className={`math-display-line${automaticallyAligned ? " math-display-line--aligned" : ""}`}
      data-math-display-line-id={line.id}
      id={anchorId}
    >
      {automaticallyAligned ? (
        <span className="math-display-line__equation">
          <EquationBranch
            expression={line.expression.left}
            branch="left"
            renderExpression={renderExpression}
          />
          <span className="math-display-line__alignment-symbol">=</span>
          <EquationBranch
            expression={line.expression.right}
            branch="right"
            renderExpression={renderExpression}
          />
        </span>
      ) : (
        <span className="math-display-line__equation">
          {renderExpression(line.expression)}
        </span>
      )}
      {line.numbered ? (
        <span className="math-equation-number">({ordinal ?? "?"})</span>
      ) : null}
    </div>
  );
}

export function MathDisplayPreview({
  displayMath,
  blockOrdinals,
  referenceTargets,
  renderExpression,
  publishAnchors = true,
}: Readonly<{
  displayMath: MathDisplayBlock;
  blockOrdinals: ReadonlyMap<string, BlockOrdinal>;
  referenceTargets: ReadonlyMap<string, BuilderReferenceTarget>;
  renderExpression: MathExpressionRenderer;
  publishAnchors?: boolean | undefined;
}>) {
  return (
    <div className="math-display-content">
      {displayMath.lines.map((line) => {
        const target =
          !publishAnchors || line.referenceId === null
            ? null
            : referenceTargets.get(line.referenceId) ?? null;
        return (
          <MathDisplayLinePreview
            key={line.id}
            line={line}
            alignment={displayMath.alignment}
            ordinal={blockOrdinals.get(line.id)?.ordinal ?? null}
            anchorId={target?.anchorId}
            renderExpression={renderExpression}
          />
        );
      })}
    </div>
  );
}
