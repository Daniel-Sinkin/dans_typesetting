// Canonical transport codec owned by the semantic paragraph plugin.
import {
  isParagraphBlock,
  paragraphTypeId,
  type BuilderBlock,
} from "../model/document";
import {
  requireTransportArray,
  requireTransportRecord,
  type BlockTransportCodec,
} from "../transport/documentTransport";

export const paragraphBlockTransportCodec: BlockTransportCodec = {
  typeId: paragraphTypeId,
  encode(block, registry) {
    if (!isParagraphBlock(block)) {
      throw new Error(`Paragraph codec cannot encode ${block.typeId}`);
    }
    return {
      inlines: block.inlines.map((inline) => registry.encodeInline(inline)),
    };
  },
  decode(id, payload, registry): BuilderBlock {
    const data = requireTransportRecord(payload, "Paragraph payload");
    const inlines = requireTransportArray(data, "inlines", "Paragraph payload").map(
      (inline, index) => registry.decodeInline(inline, `Paragraph inline ${String(index)}`),
    );
    return Object.freeze({ id, typeId: paragraphTypeId, inlines: Object.freeze(inlines) });
  },
};
