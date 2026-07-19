// Graphical adapter for semantic source-code listings.
import { createElement } from "react";

import type { BuilderBlockPlugin } from "../builder/plugin";
import { codeListingTypeId } from "../model/document";
import {
  codeListingLanguageLabel,
  requireCodeListing,
} from "./codeListingSupport";
import { CodeListingEditor, CodeListingPreview } from "./codeListingView";

export const codeListingPlugin: BuilderBlockPlugin = {
  typeId: codeListingTypeId,
  numberingSeries: "listing",
  palette: {
    label: "Code listing",
    description: "C++, CUDA, Julia, or unclassified source text",
    glyph: "</>",
    accentColor: "#0b7285",
  },
  createDefault(blockId) {
    return Object.freeze({
      id: blockId,
      typeId: codeListingTypeId,
      language: "cpp",
      code: "int main() {\n    return 0;\n}",
      caption: null,
      referenceId: null,
    });
  },
  referenceTarget(block) {
    const listing = requireCodeListing(block);
    return {
      referenceId: listing.referenceId,
      label: "Listing",
      title: listing.caption ?? codeListingLanguageLabel(listing.language),
    };
  },
  copyForInsert(block, copiedBlockId) {
    return Object.freeze({
      ...requireCodeListing(block),
      id: copiedBlockId,
      referenceId: null,
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
