// Register ordinary text with the graphical Inline Sequence contract.
import { createElement } from "react";

import type {
  BuilderInlineAdapter,
  BuilderInlinePlugin,
} from "../builder/inlinePlugin";
import {
  createText,
  textInlineTypeId,
} from "../model/document";
import {
  OpaqueInlinePreview,
  TextEditor,
  TextPreview,
} from "./textView";
import { requireText } from "./textSupport";

export const textInlinePlugin: BuilderInlinePlugin = {
  typeId: textInlineTypeId,
  palette: {
    label: "Text",
    description: "An ordinary editable text run",
    glyph: "T",
    accentColor: "#f06595",
  },
  createDefault(inlineId) {
    return createText("New text segment", inlineId);
  },
  plainText(inline) {
    return requireText(inline).text;
  },
  renderPreview(inline) {
    return createElement(TextPreview, { inline });
  },
  editor: {
    render(props) {
      return createElement(TextEditor, props);
    },
  },
};

export const opaqueInlineAdapter: BuilderInlineAdapter = {
  palette: {
    label: "Unsupported inline",
    description: "Preserved by the document port but not editable here",
    glyph: "?",
    accentColor: "#7950f2",
  },
  plainText(inline) {
    return inline.label ?? `[${inline.typeId}]`;
  },
  renderPreview(inline) {
    return createElement(OpaqueInlinePreview, { inline });
  },
};
