// Graphical adapter for generic numbered or unnumbered caption wrappers.
import type { BuilderInlinePluginRegistry } from "../builder/inlinePlugin";
import type { BuilderBlockPlugin } from "../builder/plugin";
import type { BuilderBlock } from "../model/document";
import { CaptionedEditor } from "./captionedEditor";
import {
  captionedContentSequenceId,
  captionedTypeId,
  createCaptionedBlock,
  createCaptionedCopyShell,
  requireCaptionedBlock,
} from "./captionedModel";
import { copyRichCaption, richCaptionPlainText } from "./richCaption";
import { InlineSequencePreview } from "./inlineSequenceView";

const outerInsetPx = 8;
const captionGapPx = 12;
const captionLineHeightPx = 46;

function footerHeight(block: ReturnType<typeof requireCaptionedBlock>): number {
  return block.category === null && block.captionInlines.length === 0
    ? 0
    : captionLineHeightPx;
}
export function createCaptionedPlugin(
  inlineRegistry: BuilderInlinePluginRegistry,
  createDefaultContent: (blockId: string) => BuilderBlock,
): BuilderBlockPlugin {
  return {
    typeId: captionedTypeId,
    palette: {
      label: "Captioned",
      description: "Wrap one block in an optional shared numbering category and rich caption",
      glyph: "№",
      accentColor: "#7950f2",
    },
    createDefault(blockId) {
      return createCaptionedBlock(
        blockId,
        createDefaultContent(`${blockId}:content`),
        "Figure",
        [],
      );
    },
    numberedOccurrences(block) {
      const captioned = requireCaptionedBlock(block);
      return captioned.category === null
        ? []
        : [{ occurrenceId: captioned.id, numberingSeries: captioned.category }];
    },
    numberedInlineOccurrences(block) {
      return inlineRegistry.numberedOccurrences(
        requireCaptionedBlock(block).captionInlines,
      );
    },
    referenceTarget(block) {
      const captioned = requireCaptionedBlock(block);
      if (captioned.category === null) {
        return null;
      }
      const title = richCaptionPlainText(captioned.captionInlines, inlineRegistry);
      return {
        referenceId: captioned.referenceId,
        label: captioned.category,
        title: title.length === 0 ? null : title,
      };
    },
    copyForInsert(block, copiedBlockId) {
      const captioned = requireCaptionedBlock(block);
      return createCaptionedCopyShell(
        copiedBlockId,
        captioned.category,
        copyRichCaption(captioned.captionInlines, inlineRegistry),
      );
    },
    measure(block, availableWidth, context) {
      const captioned = requireCaptionedBlock(block);
      const contentHeight = context.measureChildSequence(
        captionedContentSequenceId,
        availableWidth - 2 * outerInsetPx,
      );
      const footer = footerHeight(captioned);
      return (
        outerInsetPx * 2 +
        contentHeight +
        (footer === 0 ? 0 : captionGapPx + footer)
      );
    },
    layoutChildSequences(block, availableWidth) {
      requireCaptionedBlock(block);
      return [
        {
          sequenceId: captionedContentSequenceId,
          offsetX: outerInsetPx,
          offsetY: outerInsetPx,
          width: availableWidth - 2 * outerInsetPx,
        },
      ];
    },
    renderPreview(block, context) {
      const captioned = requireCaptionedBlock(block);
      if (captioned.category === null && captioned.captionInlines.length === 0) {
        return null;
      }
      return (
        <div className="captioned-block-preview">
          <div className="captioned-block-preview__caption">
            {captioned.category === null ? null : (
              <strong>
                {captioned.category} {String(context.ordinal ?? "?")}
                {captioned.captionInlines.length === 0 ? "" : ":"}
              </strong>
            )}{" "}
            <InlineSequencePreview
              inlines={captioned.captionInlines}
              registry={inlineRegistry}
              context={context}
            />
          </div>
        </div>
      );
    },
    editor: {
      title(block) {
        return `Edit caption wrapper · ${requireCaptionedBlock(block).id}`;
      },
      render(props) {
        return <CaptionedEditor {...props} inlineRegistry={inlineRegistry} />;
      },
    },
  };
}
