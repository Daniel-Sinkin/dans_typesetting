// Register text-edited LaTeX inline and display mathematics.
import type { BuilderInlinePlugin } from "../builder/inlinePlugin";
import type { BuilderBlockPlugin } from "../builder/plugin";
import type { BuilderBlock } from "../model/document";
import {
  createLatexMathDisplay,
  createLatexMathInline,
  latexMathDisplayTypeId,
  latexMathInlineTypeId,
  requireLatexMathDisplay,
  requireLatexMathInline,
} from "./latexMathModel";
import {
  InlineLatexMathDisplayEditor,
  LatexMathDisplayEditor,
  LatexMathDisplayPreview,
} from "./latexMathBlockView";
import { LatexMathInlineEditor, LatexMathInlinePreview } from "./latexMathView";

export const latexMathInlinePlugin: BuilderInlinePlugin = {
  typeId: latexMathInlineTypeId,
  palette: {
    label: "Inline math",
    description: "LaTeX math source inside implicit $ delimiters",
    glyph: "x²",
    accentColor: "#7950f2",
  },
  createDefault(inlineId) {
    return createLatexMathInline(String.raw`E = mc^2`, inlineId);
  },
  plainText(inline) {
    return requireLatexMathInline(inline).source;
  },
  renderPreview(inline) {
    return <LatexMathInlinePreview inline={inline} />;
  },
  editor: {
    render(props) {
      return <LatexMathInlineEditor {...props} />;
    },
  },
};

export const latexMathDisplayPlugin: BuilderBlockPlugin = {
  typeId: latexMathDisplayTypeId,
  numberingSeries: "Equation",
  palette: {
    label: "Display math",
    description: "LaTeX math source inside implicit $$ delimiters",
    glyph: "∑",
    accentColor: "#7950f2",
  },
  createDefault(blockId) {
    return createLatexMathDisplay(String.raw`E = mc^2`, true, null, blockId);
  },
  numberedOccurrences(block) {
    const math = requireLatexMathDisplay(block);
    return math.numbered
      ? [{ occurrenceId: math.id, numberingSeries: "Equation" }]
      : [];
  },
  referenceTargets(block) {
    const math = requireLatexMathDisplay(block);
    return math.numbered
      ? [
          {
            referenceId: math.referenceId,
            occurrenceId: math.id,
            label: "Equation",
          },
        ]
      : [];
  },
  copyForInsert(block, copiedBlockId) {
    const math = requireLatexMathDisplay(block);
    return createLatexMathDisplay(math.source, math.numbered, null, copiedBlockId);
  },
  measure(block, availableWidth) {
    const math = requireLatexMathDisplay(block);
    const lineCount = Math.max(1, math.source.split(/\r?\n/u).length);
    const widthPressure = Math.min(80, (math.source.length * 8) / availableWidth * 45);
    return 112 + lineCount * 24 + widthPressure;
  },
  renderPreview(block, context) {
    const math = requireLatexMathDisplay(block);
    return (
      <LatexMathDisplayPreview
        block={math}
        ordinal={context.blockOrdinals.get(math.id)?.ordinal ?? null}
        anchorId={
          math.referenceId === null
            ? undefined
            : context.referenceTargets.get(math.referenceId)?.anchorId
        }
      />
    );
  },
  editor: {
    presentation: "inline",
    title(block: BuilderBlock) {
      return `Edit LaTeX equation · ${requireLatexMathDisplay(block).id}`;
    },
    render(props) {
      return <LatexMathDisplayEditor {...props} />;
    },
    renderInline(props) {
      return <InlineLatexMathDisplayEditor {...props} />;
    },
  },
};
