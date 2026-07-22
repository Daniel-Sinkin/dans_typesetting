// Register semantic source-code listings with the graphical writer.
import { createElement } from "react";

import type { BuilderInlinePluginRegistry } from "../builder/inlinePlugin";
import type { BuilderBlockPlugin } from "../builder/plugin";
import { sourceBufferFileName } from "../builder/sourceEditing";
import {
  codeListingTypeId,
  createCodeListingBlock,
} from "./codeListingModel";
import {
  codeListingLanguageLabel,
  requireCodeListing,
} from "./codeListingSupport";
import {
  CodeListingEditor,
  CodeListingPreview,
  InlineCodeListingEditor,
} from "./codeListingView";
import { copyRichCaption, richCaptionPlainText } from "./richCaption";

export function createCodeListingPlugin(
  inlineRegistry: BuilderInlinePluginRegistry,
): BuilderBlockPlugin {
  return {
    typeId: codeListingTypeId,
    numberingSeries: "Listing",
    palette: {
      label: "Code listing",
      description: "C++, CUDA, Julia, or unclassified source text",
      glyph: "</>",
      accentColor: "#0b7285",
    },
    createDefault(blockId) {
      return createCodeListingBlock(
        blockId,
        "cpp",
        "int main() {\n    return 0;\n}",
      );
    },
    referenceTarget(block) {
      const listing = requireCodeListing(block);
      return {
        referenceId: listing.referenceId,
        label: "Listing",
        title:
          listing.captionInlines === null
            ? codeListingLanguageLabel(listing.language)
            : richCaptionPlainText(listing.captionInlines, inlineRegistry),
      };
    },
    numberedInlineOccurrences(block) {
      const caption = requireCodeListing(block).captionInlines;
      return caption === null
        ? []
        : inlineRegistry.numberedOccurrences(caption);
    },
    copyForInsert(block, copiedBlockId) {
      const listing = requireCodeListing(block);
      return createCodeListingBlock(
        copiedBlockId,
        listing.language,
        listing.code,
        listing.captionInlines === null
          ? null
          : copyRichCaption(listing.captionInlines, inlineRegistry),
      );
    },
    measure(block) {
      const listing = requireCodeListing(block);
      const lineCount = listing.code.split("\n").length;
      return Math.min(520, Math.max(190, 118 + lineCount * 22));
    },
    renderPreview(block, context) {
      return createElement(CodeListingPreview, {
        listing: requireCodeListing(block),
        registry: inlineRegistry,
        context,
      });
    },
    editor: {
      presentation: "inline",
      sourceEditor: {
        preloadOnContextMenu: true,
        preloadOnSelection: true,
        presentation: "dialog",
        fileName(block) {
          const listing = requireCodeListing(block);
          const extension = {
            cpp: "cpp",
            cuda: "cu",
            julia: "jl",
            raw: "txt",
          }[listing.language];
          return sourceBufferFileName(listing.id, extension);
        },
        source(block) {
          return requireCodeListing(block).code;
        },
        applySource(block, source) {
          const listing = requireCodeListing(block);
          return createCodeListingBlock(
            listing.id,
            listing.language,
            source.replace(/(?:\r?\n)+$/u, ""),
            listing.captionInlines,
            listing.referenceId,
          );
        },
      },
      title(block) {
        return `Edit code listing · ${requireCodeListing(block).id}`;
      },
      renderInline(props) {
        return createElement(InlineCodeListingEditor, {
          ...props,
          inlineRegistry,
        });
      },
      render(props) {
        return createElement(CodeListingEditor, {
          ...props,
          inlineRegistry,
        });
      },
    },
  };
}
