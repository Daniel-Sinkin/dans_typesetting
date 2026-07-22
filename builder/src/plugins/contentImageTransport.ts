import type { BuilderBlock } from "../model/document";
import {
  requireTransportNumber,
  requireTransportRecord,
  requireTransportString,
  type BlockTransportCodec,
} from "../transport/documentTransport";
import {
  contentImageTypeId,
  createContentImageBlock,
  requireContentImageBlock,
} from "./contentImageModel";

export const contentImageTransportCodec: BlockTransportCodec = {
  typeId: contentImageTypeId,
  encode(block) {
    const image = requireContentImageBlock(block);
    return {
      source: image.source,
      widthFraction: image.widthFraction,
      preferredPixelWidth: image.preferredPixelWidth,
      preferredPixelHeight: image.preferredPixelHeight,
    };
  },
  decode(id, payload): BuilderBlock {
    const data = requireTransportRecord(payload, "Image payload");
    return createContentImageBlock(
      id,
      requireTransportString(data, "source", "Image payload"),
      requireTransportNumber(data, "widthFraction", "Image payload"),
      requireTransportNumber(data, "preferredPixelWidth", "Image payload"),
      requireTransportNumber(data, "preferredPixelHeight", "Image payload"),
    );
  },
};
