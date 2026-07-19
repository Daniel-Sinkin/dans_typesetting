// Encode and decode the Padding plugin's payload and nested content sequence.
import type { BuilderBlock } from "../model/document";
import {
  requireTransportArray,
  requireTransportNumber,
  requireTransportRecord,
  type BlockTransportCodec,
} from "../transport/documentTransport";
import {
  createPaddingBlock,
  paddingContent,
  paddingTypeId,
  requirePaddingBlock,
  type PaddingInsets,
} from "./paddingModel";

function decodeInsets(payload: unknown): PaddingInsets {
  const insets = requireTransportRecord(payload, "Padding payload.insets");
  return {
    topEm: requireTransportNumber(insets, "topEm", "Padding payload.insets"),
    rightEm: requireTransportNumber(insets, "rightEm", "Padding payload.insets"),
    bottomEm: requireTransportNumber(insets, "bottomEm", "Padding payload.insets"),
    leftEm: requireTransportNumber(insets, "leftEm", "Padding payload.insets"),
  };
}

export const paddingTransportCodec: BlockTransportCodec = {
  typeId: paddingTypeId,
  encode(block, registry) {
    const padding = requirePaddingBlock(block);
    return {
      insets: { ...padding.insets },
      blocks: paddingContent(padding).map((child) => registry.encodeBlock(child)),
    };
  },
  decode(id, payload, registry): BuilderBlock {
    const data = requireTransportRecord(payload, "Padding payload");
    return createPaddingBlock(
      id,
      decodeInsets(data.insets),
      requireTransportArray(data, "blocks", "Padding payload").map((child, index) =>
        registry.decodeBlock(child, `Padding content block ${String(index)}`),
      ),
    );
  },
};
