// Semantic builder values for source-authored LaTeX mathematics.
import {
  createBlockId,
  type BuilderBlock,
  type BuilderInlineNode,
} from "../model/document";
import { validateOptionalReferenceId } from "../model/referenceId";

export const latexMathDisplayTypeId = "dans.math.latex.display";
export const latexMathInlineTypeId = "dans.math.latex.inline";

export interface LatexMathInline extends BuilderInlineNode {
  readonly typeId: typeof latexMathInlineTypeId;
  readonly source: string;
}

export interface LatexMathDisplayBlock extends BuilderBlock {
  readonly typeId: typeof latexMathDisplayTypeId;
  readonly source: string;
  readonly numbered: boolean;
  readonly referenceId: string | null;
}

export function latexMathSourceError(source: string, inline: boolean): string | null {
  if (!/[^\t\n\r ]/u.test(source)) {
    return "Math source cannot be empty.";
  }
  if (source.includes("$")) {
    return "Omit $ and $$: the math delimiters are implicit.";
  }
  if (inline && (source.includes("\n") || source.includes("\r"))) {
    return "Inline math must stay on one line.";
  }
  return null;
}

function requireLatexMathSource(source: string, inline: boolean): string {
  const error = latexMathSourceError(source, inline);
  if (error !== null) {
    throw new Error(error);
  }
  return source;
}

export function createLatexMathInline(
  source: string,
  id: string = createBlockId(),
): LatexMathInline {
  return Object.freeze({
    id,
    typeId: latexMathInlineTypeId,
    source: requireLatexMathSource(source, true),
  });
}

export function createLatexMathDisplay(
  source: string,
  numbered = true,
  referenceId: string | null = null,
  id: string = createBlockId(),
): LatexMathDisplayBlock {
  if (!numbered && referenceId !== null) {
    throw new Error("Unnumbered LaTeX math cannot publish a reference target.");
  }
  validateOptionalReferenceId(referenceId, "Equation reference ID");
  return Object.freeze({
    id,
    typeId: latexMathDisplayTypeId,
    source: requireLatexMathSource(source, false),
    numbered,
    referenceId,
  });
}

export function isLatexMathInline(
  inline: BuilderInlineNode,
): inline is LatexMathInline {
  return (
    inline.typeId === latexMathInlineTypeId &&
    "source" in inline &&
    typeof inline.source === "string" &&
    latexMathSourceError(inline.source, true) === null
  );
}

export function isLatexMathDisplay(
  block: BuilderBlock,
): block is LatexMathDisplayBlock {
  if (
    block.typeId !== latexMathDisplayTypeId ||
    !("source" in block) ||
    typeof block.source !== "string" ||
    !("numbered" in block) ||
    typeof block.numbered !== "boolean" ||
    !("referenceId" in block) ||
    (block.referenceId !== null && typeof block.referenceId !== "string")
  ) {
    return false;
  }
  if (
    latexMathSourceError(block.source, false) !== null ||
    (!block.numbered && block.referenceId !== null)
  ) {
    return false;
  }
  try {
    validateOptionalReferenceId(block.referenceId, "Equation reference ID");
    return true;
  } catch {
    return false;
  }
}

export function requireLatexMathInline(inline: BuilderInlineNode): LatexMathInline {
  if (!isLatexMathInline(inline)) {
    throw new Error(`LaTeX inline-math plugin cannot consume ${inline.typeId}`);
  }
  return inline;
}

export function requireLatexMathDisplay(
  block: BuilderBlock,
): LatexMathDisplayBlock {
  if (!isLatexMathDisplay(block)) {
    throw new Error(`LaTeX display-math plugin cannot consume ${block.typeId}`);
  }
  return block;
}
