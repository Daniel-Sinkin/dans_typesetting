// Canonical transport codec owned by the figure plugin.
import {
  imageTypeId,
  isImageBlock,
  type BuilderBlock,
} from "../model/document";
import {
  requireTransportNumber,
  requireTransportRecord,
  requireTransportString,
  type BlockTransportCodec,
} from "../transport/documentTransport";

export const imageBlockTransportCodec: BlockTransportCodec = {
  typeId: imageTypeId,
  encode(block) {
    if (!isImageBlock(block)) {
      throw new Error(`Figure codec cannot encode ${block.typeId}`);
    }
    return {
      source: block.source,
      caption: block.caption,
      widthFraction: block.widthFraction,
      preferredPixelWidth: block.preferredPixelWidth,
      preferredPixelHeight: block.preferredPixelHeight,
    };
  },
  decode(id, payload): BuilderBlock {
    const data = requireTransportRecord(payload, "Figure payload");
    return Object.freeze({
      id,
      typeId: imageTypeId,
      source: requireTransportString(data, "source", "Figure payload"),
      caption: requireTransportString(data, "caption", "Figure payload"),
      widthFraction: requireTransportNumber(data, "widthFraction", "Figure payload"),
      preferredPixelWidth: requireTransportNumber(
        data,
        "preferredPixelWidth",
        "Figure payload",
      ),
      preferredPixelHeight: requireTransportNumber(
        data,
        "preferredPixelHeight",
        "Figure payload",
      ),
    });
  },
};
