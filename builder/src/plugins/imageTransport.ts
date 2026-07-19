// Canonical transport codec owned by the semantic figure plugin.
import { createText, type BuilderBlock } from "../model/document";
import { decodeOptionalReferenceId } from "../model/referenceId";
import {
  requireTransportArray,
  requireTransportNumber,
  requireTransportRecord,
  requireTransportString,
  type BlockTransportCodec,
  type DocumentTransportRegistry,
} from "../transport/documentTransport";
import {
  createImageBlock,
  imageTypeId,
  requireImageBlock,
} from "./imageModel";

function decodeCaption(
  blockId: string,
  data: Readonly<Record<string, unknown>>,
  registry: DocumentTransportRegistry,
) {
  const hasRichCaption = "captionInlines" in data;
  const hasLegacyCaption = "caption" in data;
  if (hasRichCaption === hasLegacyCaption) {
    throw new Error(
      "Figure payload requires exactly one of captionInlines or legacy caption",
    );
  }
  if (hasRichCaption) {
    return requireTransportArray(
      data,
      "captionInlines",
      "Figure payload",
    ).map((inline, index) =>
      registry.decodeInline(inline, `Figure caption inline ${String(index)}`),
    );
  }
  const caption = requireTransportString(data, "caption", "Figure payload");
  if (caption.trim().length === 0) {
    throw new Error("Legacy figure payload.caption must not be empty");
  }
  return [createText(caption, `${blockId}:caption:legacy-text`)];
}

export const imageBlockTransportCodec: BlockTransportCodec = {
  typeId: imageTypeId,
  encode(block, registry) {
    const image = requireImageBlock(block);
    return {
      source: image.source,
      captionInlines: image.captionInlines.map((inline) =>
        registry.encodeInline(inline),
      ),
      referenceId: image.referenceId,
      widthFraction: image.widthFraction,
      preferredPixelWidth: image.preferredPixelWidth,
      preferredPixelHeight: image.preferredPixelHeight,
    };
  },
  decode(id, payload, registry): BuilderBlock {
    const data = requireTransportRecord(payload, "Figure payload");
    return createImageBlock(
      id,
      requireTransportString(data, "source", "Figure payload"),
      decodeCaption(id, data, registry),
      decodeOptionalReferenceId(data.referenceId, "Figure payload.referenceId"),
      requireTransportNumber(data, "widthFraction", "Figure payload"),
      requireTransportNumber(data, "preferredPixelWidth", "Figure payload"),
      requireTransportNumber(data, "preferredPixelHeight", "Figure payload"),
    );
  },
};
