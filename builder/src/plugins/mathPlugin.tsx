// builder/src/plugins/mathPlugin.tsx — register structured-math preview and editing.
import type { BuilderBlockPlugin } from "../builder/plugin";
import type { MathEditorExtension } from "../math/editorExtension";
import type { MathInputParserPlugin } from "../math/inputParser";
import {
  createMathSlot,
  mathExpressionToText,
} from "../model/math";
import {
  createBlockId,
  createMathDisplayLine,
  isMathDisplayBlock,
  mathDisplayTypeId,
  type BuilderBlock,
  type MathDisplayBlock,
} from "../model/document";
import { MathEditor, MathTree } from "./math";
import { MathDisplayPreview } from "./mathDisplayView";

function requireDisplayMath(block: BuilderBlock): MathDisplayBlock {
  if (!isMathDisplayBlock(block)) {
    throw new Error(`Structured-math plugin cannot consume ${block.typeId}`);
  }
  return block;
}

export function createMathPlugin(
  inputParser?: MathInputParserPlugin,
  editorExtensions: readonly MathEditorExtension[] = [],
): BuilderBlockPlugin {
  return {
    typeId: mathDisplayTypeId,
    numberingSeries: "equation",
    palette: {
      label: "Display math",
      description: "A structured, recursively nested equation",
      glyph: "∑",
      accentColor: "#7950f2",
    },
    createDefault(blockId) {
      return Object.freeze({
        id: blockId,
        typeId: mathDisplayTypeId,
        alignment: "automatic",
        lines: Object.freeze([
          createMathDisplayLine(
            createMathSlot(),
            true,
            null,
            createBlockId(),
          ),
        ]),
      });
    },
    numberedOccurrences(block) {
      const displayMath = requireDisplayMath(block);
      return displayMath.lines
        .filter((line) => line.numbered)
        .map((line) => ({
          occurrenceId: line.id,
          numberingSeries: "equation",
        }));
    },
    referenceTargets(block) {
      return requireDisplayMath(block).lines
        .filter((line) => line.numbered)
        .map((line) => ({
          referenceId: line.referenceId,
          occurrenceId: line.id,
          label: "Equation",
        }));
    },
    copyForInsert(block, copiedBlockId) {
      const displayMath = requireDisplayMath(block);
      return Object.freeze({
        ...displayMath,
        id: copiedBlockId,
        lines: Object.freeze(
          displayMath.lines.map((line) =>
            createMathDisplayLine(
              line.expression,
              line.numbered,
              null,
              createBlockId(),
            ),
          ),
        ),
      });
    },
    measure(block) {
      const displayMath = requireDisplayMath(block);
      const depthAllowance = Math.min(
        80,
        Math.max(
          ...displayMath.lines.map(
            (line) => mathExpressionToText(line.expression).length * 0.8,
          ),
        ),
      );
      return Math.max(126, 46 + displayMath.lines.length * 66 + depthAllowance);
    },
    renderPreview(block, context) {
      const displayMath = requireDisplayMath(block);
      return (
        <MathDisplayPreview
          displayMath={displayMath}
          blockOrdinals={context.blockOrdinals}
          referenceTargets={context.referenceTargets}
          renderExpression={(expression) => <MathTree expression={expression} />}
        />
      );
    },
    editor: {
      title(block) {
        return `Edit structured equation · ${requireDisplayMath(block).id}`;
      },
      render(props) {
        return (
          <MathEditor
            {...props}
            inputParser={inputParser}
            editorExtensions={editorExtensions}
          />
        );
      },
    },
  };
}

export const mathPlugin = createMathPlugin();
