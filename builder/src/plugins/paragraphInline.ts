// Core Paragraph's graphical inline connectors.
import { createElement } from "react";

import type {
  BuilderInlineAdapter,
  BuilderInlinePlugin,
} from "../builder/inlinePlugin";
import {
  createParagraphText,
  paragraphTextInlineTypeId,
} from "../model/document";
import {
  OpaqueInlinePreview,
  ParagraphTextEditor,
  ParagraphTextPreview,
} from "./paragraphInlineView";
import { requireParagraphText } from "./paragraphInlineSupport";

export const paragraphTextInlinePlugin: BuilderInlinePlugin = {
  typeId: paragraphTextInlineTypeId,
  palette: {
    label: "Text",
    description: "An ordinary editable text run",
    glyph: "T",
    accentColor: "#f06595",
  },
  createDefault(inlineId) {
    return createParagraphText("New text segment", inlineId);
  },
  plainText(inline) {
    return requireParagraphText(inline).text;
  },
  renderPreview(inline) {
    return createElement(ParagraphTextPreview, { inline });
  },
  editor: {
    render(props) {
      return createElement(ParagraphTextEditor, props);
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
