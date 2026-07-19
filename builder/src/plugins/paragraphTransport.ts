// Canonical transport codecs owned by the Core Paragraph plugin.
import {
  createParagraphText,
  isParagraphBlock,
  isParagraphTextInline,
  paragraphTextInlineTypeId,
  paragraphTypeId,
  type BuilderBlock,
  type BuilderInlineNode,
  type ParagraphTextStyle,
} from "../model/document";
import {
  requireTransportArray,
  requireTransportRecord,
  requireTransportString,
  type BlockTransportCodec,
  type InlineTransportCodec,
} from "../transport/documentTransport";

function requireTextStyle(value: unknown): ParagraphTextStyle {
  if (
    value !== "normal" &&
    value !== "bold" &&
    value !== "italic" &&
    value !== "bold_italic"
  ) {
    throw new Error("Core Text payload.style is invalid");
  }
  return value;
}

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

export const paragraphTextInlineTransportCodec: InlineTransportCodec = {
  typeId: paragraphTextInlineTypeId,
  encode(inline) {
    if (!isParagraphTextInline(inline)) {
      throw new Error(`Core Text codec cannot encode ${inline.typeId}`);
    }
    return { text: inline.text, style: inline.style };
  },
  decode(id, payload): BuilderInlineNode {
    const data = requireTransportRecord(payload, "Core Text payload");
    return createParagraphText(
      requireTransportString(data, "text", "Core Text payload"),
      id,
      requireTextStyle(data.style),
    );
  },
};
