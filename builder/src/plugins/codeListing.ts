// Graphical adapter for captioned C++ and Julia code listings.
import { createElement } from "react";

import type { BuilderBlockPlugin } from "../builder/plugin";
import { codeListingTypeId } from "../model/document";
import { requireCodeListing } from "./codeListingSupport";
import { CodeListingEditor, CodeListingPreview } from "./codeListingView";

export const codeListingPlugin: BuilderBlockPlugin = {
  typeId: codeListingTypeId,
  numberingSeries: "listing",
  palette: {
    label: "Code listing",
    description: "A captioned C++ or Julia source-code block",
    glyph: "</>",
    accentColor: "#0b7285",
  },
  createDefault(blockId) {
    return Object.freeze({
      id: blockId,
      typeId: codeListingTypeId,
      language: "cpp",
      code: "int main() {\n    return 0;\n}",
      caption: "A new C++ listing.",
    });
  },
  measure(block) {
    const listing = requireCodeListing(block);
    const lineCount = listing.code.split("\n").length;
    return Math.min(520, Math.max(190, 118 + lineCount * 22));
  },
  renderPreview(block, context) {
    return createElement(CodeListingPreview, {
      listing: requireCodeListing(block),
      context,
    });
  },
  editor: {
    title(block) {
      return `Edit code listing · ${requireCodeListing(block).id}`;
    },
    render(props) {
      return createElement(CodeListingEditor, props);
    },
  },
};
