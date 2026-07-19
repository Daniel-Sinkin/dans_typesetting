// Canonical transport for generic captions and their single nested content block.
import type { BuilderBlock } from "../model/document";
import { decodeOptionalReferenceId } from "../model/referenceId";
import {
  requireTransportArray,
  requireTransportRecord,
  type BlockTransportCodec,
} from "../transport/documentTransport";
import {
  captionedContent,
  captionedTypeId,
  createCaptionedBlock,
  requireCaptionedBlock,
} from "./captionedModel";

function decodeCategory(value: unknown): string | null {
  if (value === null || typeof value === "string") {
    return value;
  }
  throw new Error("Captioned payload.category must be a string or null");
}

export const captionedTransportCodec: BlockTransportCodec = {
  typeId: captionedTypeId,
  encode(block, registry) {
    const captioned = requireCaptionedBlock(block);
    return {
      category: captioned.category,
      captionInlines: captioned.captionInlines.map((inline) =>
        registry.encodeInline(inline),
      ),
      referenceId: captioned.referenceId,
      content: registry.encodeBlock(captionedContent(captioned)),
    };
  },
  decode(id, payload, registry): BuilderBlock {
    const data = requireTransportRecord(payload, "Captioned payload");
    const caption = requireTransportArray(
      data,
      "captionInlines",
      "Captioned payload",
    ).map((inline, index) =>
      registry.decodeInline(inline, `Captioned caption inline ${String(index)}`),
    );
    if (!("content" in data)) {
      throw new Error("Captioned payload.content is required");
    }
    return createCaptionedBlock(
      id,
      registry.decodeBlock(data.content, "Captioned content"),
      decodeCategory(data.category),
      caption,
      decodeOptionalReferenceId(
        data.referenceId,
        "Captioned payload.referenceId",
      ),
    );
  },
};
