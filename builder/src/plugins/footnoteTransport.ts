// Canonical transport codec for inline footnotes and their nested inline sequence.
import type { BuilderInlineNode } from "../model/document";
import {
  requireTransportArray,
  requireTransportRecord,
  type InlineTransportCodec,
} from "../transport/documentTransport";
import {
  createFootnoteInline,
  footnoteInlineTypeId,
  requireFootnote,
} from "./footnoteModel";

export const footnoteInlineTransportCodec: InlineTransportCodec = {
  typeId: footnoteInlineTypeId,
  encode(inline, registry) {
    const footnote = requireFootnote(inline);
    return {
      inlines: footnote.inlines.map((nested) => registry.encodeInline(nested)),
    };
  },
  decode(id, payload, registry): BuilderInlineNode {
    const data = requireTransportRecord(payload, "Footnote payload");
    const inlines = requireTransportArray(data, "inlines", "Footnote payload").map(
      (inline, index) =>
        registry.decodeInline(inline, `Footnote inline ${String(index)}`),
    );
    return createFootnoteInline(inlines, id);
  },
};
