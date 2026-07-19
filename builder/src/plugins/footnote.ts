// Register inline footnotes with Core Paragraph's extensible contract.
import { createElement } from "react";

import type { BuilderInlinePlugin } from "../builder/inlinePlugin";
import {
  createFootnoteInline,
  footnoteInlineTypeId,
  requireFootnote,
} from "./footnoteModel";
import { FootnoteEditor, FootnotePreview } from "./footnoteView";
import { copyBuilderInlineForInsert } from "../builder/copyInline";

export const footnoteInlinePlugin: BuilderInlinePlugin = {
  typeId: footnoteInlineTypeId,
  numberingSeries: "footnote",
  palette: {
    label: "Footnote",
    description: "A numbered note containing an inline sequence",
    glyph: "¹",
    accentColor: "#9c36b5",
  },
  createDefault(inlineId) {
    return createFootnoteInline(undefined, inlineId);
  },
  nestedInlines(inline) {
    return requireFootnote(inline).inlines;
  },
  copyForInsert(inline, copiedInlineId, registry) {
    return createFootnoteInline(
      requireFootnote(inline).inlines.map((nested) =>
        copyBuilderInlineForInsert(nested, registry),
      ),
      copiedInlineId,
    );
  },
  plainText(inline, registry) {
    return requireFootnote(inline).inlines
      .map((nested) => registry.adapterForInline(nested).plainText(nested, registry))
      .join("");
  },
  renderPreview(inline, registry, context) {
    return createElement(FootnotePreview, { inline, registry, context });
  },
  editor: {
    render(props) {
      return createElement(FootnoteEditor, props);
    },
  },
};
