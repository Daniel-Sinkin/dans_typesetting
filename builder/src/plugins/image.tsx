// builder/src/plugins/image.tsx — register real image preview and file-backed editing.
import type { BuilderBlockPlugin } from "../builder/plugin";
import {
  imageTypeId,
  isImageBlock,
  type BuilderBlock,
  type ImageBlock,
} from "../model/document";
import { ImageEditor } from "./imageEditor";

function requireImage(block: BuilderBlock): ImageBlock {
  if (!isImageBlock(block)) {
    throw new Error(`Image plugin cannot consume ${block.typeId}`);
  }
  return block;
}

export const imagePlugin: BuilderBlockPlugin = {
  typeId: imageTypeId,
  numberingSeries: "figure",
  palette: {
    label: "Image",
    description: "A captioned, referenceable figure",
    glyph: "▧",
    accentColor: "#4dabf7",
  },
  createDefault(blockId) {
    return Object.freeze({
      id: blockId,
      typeId: imageTypeId,
      source: "/sample-domain-decomposition.svg",
      caption: "A new figure caption.",
      widthFraction: 0.72,
      preferredPixelWidth: 1280,
      preferredPixelHeight: 720,
    });
  },
  measure(block, availableWidth) {
    const image = requireImage(block);
    const imageWidth = availableWidth * image.widthFraction;
    const imageHeight = imageWidth * (image.preferredPixelHeight / image.preferredPixelWidth);
    return Math.min(420, Math.max(230, imageHeight + 92));
  },
  renderPreview(block, context) {
    const image = requireImage(block);
    const ordinal = context.ordinal ?? 0;
    return (
      <figure className="image-content">
        <img
          src={image.source}
          alt={image.caption}
          style={{ width: `${String(image.widthFraction * 100)}%` }}
        />
        <figcaption>
          <strong>Figure {ordinal}:</strong> {image.caption}
        </figcaption>
      </figure>
    );
  },
  editor: {
    title(block) {
      return `Edit image · ${requireImage(block).id}`;
    },
    render(props) {
      return <ImageEditor {...props} />;
    },
  },
};
