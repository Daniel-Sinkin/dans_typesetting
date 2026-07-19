// builder/src/plugins/image.tsx — register rich semantic figures with graphical editing.
import type { BuilderInlinePluginRegistry } from "../builder/inlinePlugin";
import type { BuilderBlockPlugin } from "../builder/plugin";
import { createText } from "../model/document";
import { ImageEditor, ImagePreview } from "./imageEditor";
import {
  createImageBlock,
  imageTypeId,
  requireImageBlock,
} from "./imageModel";
import { copyRichCaption, richCaptionPlainText } from "./richCaption";

export function createImagePlugin(
  inlineRegistry: BuilderInlinePluginRegistry,
): BuilderBlockPlugin {
  return {
    typeId: imageTypeId,
    numberingSeries: "Figure",
    palette: {
      label: "Image",
      description: "A captioned, referenceable figure",
      glyph: "▧",
      accentColor: "#4dabf7",
    },
    createDefault(blockId) {
      return createImageBlock(
        blockId,
        "/sample-domain-decomposition.svg",
        [createText("A new figure caption.")],
      );
    },
    referenceTarget(block) {
      const image = requireImageBlock(block);
      return {
        referenceId: image.referenceId,
        label: "Figure",
        title: richCaptionPlainText(image.captionInlines, inlineRegistry),
      };
    },
    numberedInlineOccurrences(block) {
      return inlineRegistry.numberedOccurrences(
        requireImageBlock(block).captionInlines,
      );
    },
    copyForInsert(block, copiedBlockId) {
      const image = requireImageBlock(block);
      return createImageBlock(
        copiedBlockId,
        image.source,
        copyRichCaption(image.captionInlines, inlineRegistry),
        null,
        image.widthFraction,
        image.preferredPixelWidth,
        image.preferredPixelHeight,
      );
    },
    measure(block, availableWidth) {
      const image = requireImageBlock(block);
      const imageWidth = availableWidth * image.widthFraction;
      const imageHeight =
        imageWidth * (image.preferredPixelHeight / image.preferredPixelWidth);
      return Math.min(420, Math.max(230, imageHeight + 92));
    },
    renderPreview(block, context) {
      return (
        <ImagePreview
          image={requireImageBlock(block)}
          registry={inlineRegistry}
          context={context}
          ordinal={context.ordinal ?? 0}
        />
      );
    },
    editor: {
      title(block) {
        return `Edit image · ${requireImageBlock(block).id}`;
      },
      render(props) {
        return <ImageEditor {...props} inlineRegistry={inlineRegistry} />;
      },
    },
  };
}
