// Graphical connector for semantic inline source code.
import { createElement } from "react";

import type { BuilderInlinePlugin } from "../builder/inlinePlugin";
import {
  createInlineCode,
  inlineCodeTypeId,
  requireInlineCode,
} from "./inlineCodeModel";
import { InlineCodeEditor, InlineCodePreview } from "./inlineCodeView";

export const inlineCodePlugin: BuilderInlinePlugin = {
  typeId: inlineCodeTypeId,
  palette: {
    label: "Inline code",
    description: "A single semantic source-code fragment",
    glyph: "</>",
    accentColor: "#0b7285",
  },
  createDefault(inlineId) {
    return createInlineCode("code", inlineId);
  },
  plainText(inline) {
    return requireInlineCode(inline).code;
  },
  renderPreview(inline) {
    return createElement(InlineCodePreview, { inline });
  },
  editor: {
    render(props) {
      return createElement(InlineCodeEditor, props);
    },
  },
};

export { createInlineCode, inlineCodeTypeId } from "./inlineCodeModel";
export type { InlineCodeInline } from "./inlineCodeModel";
