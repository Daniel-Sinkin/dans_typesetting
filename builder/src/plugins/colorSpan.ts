// Graphical connector for the semantic ColorSpan inline extension.
import { createElement } from "react";

import type { BuilderInlinePlugin } from "../builder/inlinePlugin";
import {
  colorSpanInlineTypeId,
  createColorSpanInline,
  requireColorSpan,
} from "./colorSpanModel";
import { ColorSpanEditor, ColorSpanPreview } from "./colorSpanView";
import { copyBuilderInlineForInsert } from "../builder/copyInline";

export {
  colorSpanInlineTypeId,
  createColorSpanInline,
  isColorSpanInline,
  type BuilderRgbColor,
  type ColorSpanInline,
} from "./colorSpanModel";

export const colorSpanInlinePlugin: BuilderInlinePlugin = {
  typeId: colorSpanInlineTypeId,
  palette: {
    label: "Colour span",
    description: "A semantic RGB wrapper around inline content",
    glyph: "A",
    accentColor: "#2660a8",
  },
  createDefault(inlineId) {
    return createColorSpanInline(undefined, undefined, inlineId);
  },
  nestedInlines(inline) {
    return requireColorSpan(inline).inlines;
  },
  copyForInsert(inline, copiedInlineId, registry) {
    const colorSpan = requireColorSpan(inline);
    return createColorSpanInline(
      colorSpan.color,
      colorSpan.inlines.map((nested) =>
        copyBuilderInlineForInsert(nested, registry),
      ),
      copiedInlineId,
    );
  },
  plainText(inline, registry) {
    const colorSpan = requireColorSpan(inline);
    return colorSpan.inlines
      .map((nestedInline) =>
        registry.adapterForInline(nestedInline).plainText(nestedInline, registry),
      )
      .join("");
  },
  renderPreview(inline, registry, context) {
    return createElement(ColorSpanPreview, { inline, registry, context });
  },
  editor: {
    render(props) {
      return createElement(ColorSpanEditor, props);
    },
  },
};
