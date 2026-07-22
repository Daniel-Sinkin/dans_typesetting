// Register a bare image block independently from figure/caption semantics.
import type { BuilderBlockPlugin } from "../builder/plugin";
import { ContentImageEditor, ContentImagePreview } from "./contentImageEditor";
import {
  contentImageTypeId,
  createContentImageBlock,
  requireContentImageBlock,
} from "./contentImageModel";

export const contentImagePlugin: BuilderBlockPlugin = {
  typeId: contentImageTypeId,
  palette: {
    label: "Image",
    description: "An unnumbered image with automatic aspect ratio",
    glyph: "▧",
    accentColor: "#4dabf7",
  },
  createDefault(blockId) {
    return createContentImageBlock(blockId, "/sample-domain-decomposition.svg");
  },
  copyForInsert(block, copiedBlockId) {
    const image = requireContentImageBlock(block);
    return createContentImageBlock(
      copiedBlockId,
      image.source,
      image.widthFraction,
      image.preferredPixelWidth,
      image.preferredPixelHeight,
    );
  },
  measure(block, availableWidth) {
    const image = requireContentImageBlock(block);
    const renderedWidth = availableWidth * image.widthFraction;
    const renderedHeight =
      renderedWidth * (image.preferredPixelHeight / image.preferredPixelWidth);
    return Math.min(420, Math.max(210, renderedHeight + 28));
  },
  renderPreview(block) {
    return <ContentImagePreview image={requireContentImageBlock(block)} />;
  },
  editor: {
    title(block) {
      return `Edit image · ${requireContentImageBlock(block).id}`;
    },
    render(props) {
      return <ContentImageEditor {...props} />;
    },
  },
};
