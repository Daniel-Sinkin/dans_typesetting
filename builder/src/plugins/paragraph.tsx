// builder/src/plugins/paragraph.tsx — register paragraph viewing and sequence-text editing.
import type { BuilderInlinePluginRegistry } from "../builder/inlinePlugin";
import type { BuilderBlockPlugin } from "../builder/plugin";
import {
  createParagraphText,
  isParagraphBlock,
  paragraphTypeId,
  type BuilderBlock,
  type ParagraphBlock,
} from "../model/document";
import { ParagraphEditor, ParagraphPreview } from "./paragraphEditor";
import { copyBuilderInlineForInsert } from "../builder/copyInline";

function requireParagraph(block: BuilderBlock): ParagraphBlock {
  if (!isParagraphBlock(block)) {
    throw new Error(`Paragraph plugin cannot consume ${block.typeId}`);
  }
  return block;
}

export function createParagraphPlugin(
  inlineRegistry: BuilderInlinePluginRegistry,
): BuilderBlockPlugin {
  return {
    typeId: paragraphTypeId,
    palette: {
      label: "Paragraph",
      description: "An ordered sequence of inline nodes",
      glyph: "¶",
      accentColor: "#f06595",
    },
    createDefault(blockId) {
      return Object.freeze({
        id: blockId,
        typeId: paragraphTypeId,
        inlines: Object.freeze([
          createParagraphText("A new paragraph. Open its editor to compose inline segments."),
        ]),
      });
    },
    numberedInlineOccurrences(block) {
      return inlineRegistry.numberedOccurrences(requireParagraph(block).inlines);
    },
    copyForInsert(block, copiedBlockId) {
      const paragraph = requireParagraph(block);
      return Object.freeze({
        ...paragraph,
        id: copiedBlockId,
        inlines: Object.freeze(
          paragraph.inlines.map((inline) =>
            copyBuilderInlineForInsert(inline, inlineRegistry),
          ),
        ),
      });
    },
    measure(block, availableWidth) {
      const paragraph = requireParagraph(block);
      const approximateCharactersPerLine = Math.max(24, Math.floor(availableWidth / 10));
      const lineCount = Math.max(
        1,
        Math.ceil(
          paragraph.inlines
            .map((inline) =>
              inlineRegistry.adapterForInline(inline).plainText(inline, inlineRegistry),
            )
            .join("").length / approximateCharactersPerLine,
        ),
      );
      return 60 + lineCount * 28;
    },
    renderPreview(block, context) {
      return (
        <ParagraphPreview
          paragraph={requireParagraph(block)}
          registry={inlineRegistry}
          context={{
            referenceTargets: context.referenceTargets,
            inlineOrdinals: context.inlineOrdinals,
            documentResources: context.documentResources,
          }}
        />
      );
    },
    editor: {
      title(block) {
        return `Edit paragraph · ${requireParagraph(block).id}`;
      },
      render(props) {
        return <ParagraphEditor {...props} inlineRegistry={inlineRegistry} />;
      },
    },
  };
}
