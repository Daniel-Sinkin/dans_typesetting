// Register structured inline mathematics with the shared Inline Sequence contract.
import { createElement } from "react";

import type { BuilderInlinePlugin } from "../builder/inlinePlugin";
import type { MathInputParserPlugin } from "../math/inputParser";
import type { MathEditorExtension } from "../math/editorExtension";
import {
  createMathInline,
  mathInlineTypeId,
} from "../model/document";
import { createMathSlot, mathExpressionToText } from "../model/math";
import { InlineMathEditor, InlineMathPreview } from "./mathInlineView";
import { requireInlineMath } from "./mathInlineSupport";

export function createInlineMathPlugin(
  inputParser?: MathInputParserPlugin,
  editorExtensions: readonly MathEditorExtension[] = [],
): BuilderInlinePlugin {
  return {
    typeId: mathInlineTypeId,
    palette: {
      label: "Inline math",
      description: "Structured mathematics flowing inside a paragraph",
      glyph: "x²",
      accentColor: "#7950f2",
    },
    createDefault(inlineId) {
      return createMathInline(createMathSlot(), inlineId);
    },
    plainText(inline) {
      return mathExpressionToText(requireInlineMath(inline).expression);
    },
    renderPreview(inline) {
      return createElement(InlineMathPreview, { inline });
    },
    editor: {
      render(props) {
        return createElement(InlineMathEditor, {
          ...props,
          inputParser,
          editorExtensions,
        });
      },
    },
  };
}
