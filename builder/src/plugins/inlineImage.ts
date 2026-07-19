// Register inline images with the graphical Inline Sequence contract.
import { createElement } from "react";

import type { BuilderInlinePlugin } from "../builder/inlinePlugin";
import {
  createInlineImage,
  inlineImageTypeId,
  requireInlineImage,
} from "./inlineImageModel";
import { InlineImageEditor, InlineImagePreview } from "./inlineImageView";

export const inlineImagePlugin: BuilderInlinePlugin = {
  typeId: inlineImageTypeId,
  palette: {
    label: "Inline image",
    description: "An emoji-sized image aligned with surrounding text",
    glyph: "▣",
    accentColor: "#0ca678",
  },
  createDefault(inlineId) {
    return createInlineImage("/sample-domain-decomposition.svg", 1, inlineId);
  },
  plainText(inline) {
    requireInlineImage(inline);
    return "\uFFFC";
  },
  renderPreview(inline) {
    return createElement(InlineImagePreview, {
      inline: requireInlineImage(inline),
    });
  },
  editor: {
    render(props) {
      return createElement(InlineImageEditor, props);
    },
  },
};

export { createInlineImage, inlineImageTypeId } from "./inlineImageModel";
export type { InlineImageNode } from "./inlineImageModel";
