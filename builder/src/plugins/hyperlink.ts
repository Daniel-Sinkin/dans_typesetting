// Register semantic hyperlinks with the Core Paragraph graphical contract.
import { createElement } from "react";

import type { BuilderInlinePlugin } from "../builder/inlinePlugin";
import {
  createHyperlinkInline,
  createParagraphText,
  hyperlinkInlineTypeId,
} from "../model/document";
import { HyperlinkEditor, HyperlinkPreview } from "./hyperlinkView";
import { requireHyperlink } from "./hyperlinkSupport";
import { copyBuilderInlineForInsert } from "../builder/copyInline";

export const hyperlinkInlinePlugin: BuilderInlinePlugin = {
  typeId: hyperlinkInlineTypeId,
  palette: {
    label: "Hyperlink",
    description: "A clickable target with an optional semantic inline label",
    glyph: "↗",
    accentColor: "#1971c2",
  },
  createDefault(inlineId) {
    return createHyperlinkInline(
      "https://example.com",
      [createParagraphText("Example link")],
      inlineId,
    );
  },
  nestedInlines(inline) {
    return requireHyperlink(inline).labelInlines;
  },
  copyForInsert(inline, copiedInlineId, registry) {
    const link = requireHyperlink(inline);
    return createHyperlinkInline(
      link.target,
      link.labelInlines.map((label) =>
        copyBuilderInlineForInsert(label, registry),
      ),
      copiedInlineId,
    );
  },
  plainText(inline, registry) {
    const link = requireHyperlink(inline);
    if (link.labelInlines.length === 0) {
      return link.target;
    }
    return link.labelInlines
      .map((labelInline) =>
        registry.adapterForInline(labelInline).plainText(labelInline, registry),
      )
      .join("");
  },
  renderPreview(inline, registry, context) {
    return createElement(HyperlinkPreview, { inline, registry, context });
  },
  editor: {
    render(props) {
      return createElement(HyperlinkEditor, props);
    },
  },
};
