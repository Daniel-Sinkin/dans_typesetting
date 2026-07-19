// Canonical transport codec owned by the inline-image plugin.
import type { BuilderInlineNode } from "../model/document";
import {
  requireTransportNumber,
  requireTransportRecord,
  requireTransportString,
  type InlineTransportCodec,
} from "../transport/documentTransport";
import {
  createInlineImage,
  inlineImageTypeId,
  requireInlineImage,
} from "./inlineImageModel";

export const inlineImageTransportCodec: InlineTransportCodec = {
  typeId: inlineImageTypeId,
  encode(inline) {
    const image = requireInlineImage(inline);
    return { source: image.source, heightEm: image.heightEm };
  },
  decode(id, payload): BuilderInlineNode {
    const data = requireTransportRecord(payload, "Inline-image payload");
    return createInlineImage(
      requireTransportString(data, "source", "Inline-image payload"),
      requireTransportNumber(data, "heightEm", "Inline-image payload"),
      id,
    );
  },
};
