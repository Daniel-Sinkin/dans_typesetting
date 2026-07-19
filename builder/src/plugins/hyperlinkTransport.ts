// Canonical transport codec owned by the semantic hyperlink extension.
import {
  createHyperlinkInline,
  hyperlinkInlineTypeId,
  type BuilderInlineNode,
} from "../model/document";
import {
  requireTransportArray,
  requireTransportRecord,
  requireTransportString,
  type InlineTransportCodec,
} from "../transport/documentTransport";
import { requireHyperlink } from "./hyperlinkSupport";

export const hyperlinkInlineTransportCodec: InlineTransportCodec = {
  typeId: hyperlinkInlineTypeId,
  encode(inline, registry) {
    const link = requireHyperlink(inline);
    return {
      target: link.target,
      labelInlines: link.labelInlines.map((label) => registry.encodeInline(label)),
    };
  },
  decode(id, payload, registry): BuilderInlineNode {
    const data = requireTransportRecord(payload, "Hyperlink payload");
    const labels = requireTransportArray(
      data,
      "labelInlines",
      "Hyperlink payload",
    ).map((label, index) =>
      registry.decodeInline(label, `Hyperlink label inline ${String(index)}`),
    );
    return createHyperlinkInline(
      requireTransportString(data, "target", "Hyperlink payload"),
      Object.freeze(labels),
      id,
    );
  },
};
