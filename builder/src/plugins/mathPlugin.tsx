// builder/src/plugins/mathPlugin.tsx — register structured-math preview and editing.
import type { BuilderBlockPlugin } from "../builder/plugin";
import type { MathInputParserPlugin } from "../math/inputParser";
import { createMathSlot, mathExpressionToText } from "../model/math";
import {
  isMathDisplayBlock,
  mathDisplayTypeId,
  type BuilderBlock,
  type MathDisplayBlock,
} from "../model/document";
import { MathEditor, MathTree } from "./math";

function requireDisplayMath(block: BuilderBlock): MathDisplayBlock {
  if (!isMathDisplayBlock(block)) {
    throw new Error(`Structured-math plugin cannot consume ${block.typeId}`);
  }
  return block;
}

export function createMathPlugin(
  inputParser?: MathInputParserPlugin,
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
        expression: createMathSlot(),
      });
    },
    measure(block) {
      const displayMath = requireDisplayMath(block);
      const depthAllowance = Math.min(
        80,
        mathExpressionToText(displayMath.expression).length * 0.8,
      );
      return 126 + depthAllowance;
    },
    renderPreview(block, context) {
      const displayMath = requireDisplayMath(block);
      return (
        <div className="math-display-content">
          <MathTree expression={displayMath.expression} />
          <span className="math-equation-number">({context.ordinal ?? 0})</span>
        </div>
      );
    },
    editor: {
      title(block) {
        return `Edit structured equation · ${requireDisplayMath(block).id}`;
      },
      render(props) {
        return <MathEditor {...props} inputParser={inputParser} />;
      },
    },
  };
}

export const mathPlugin = createMathPlugin();
