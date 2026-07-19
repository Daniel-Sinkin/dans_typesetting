// Canonical transport codec for semantic inline cross-references.
import {
  createReferenceInline,
  isReferenceInline,
  referenceInlineTypeId,
  type BuilderInlineNode,
} from "../model/document";
import {
  requireTransportRecord,
  requireTransportString,
  type InlineTransportCodec,
} from "../transport/documentTransport";

export const referenceInlineTransportCodec: InlineTransportCodec = {
  typeId: referenceInlineTypeId,
  encode(inline) {
    if (!isReferenceInline(inline)) {
      throw new Error(`Reference codec cannot encode ${inline.typeId}`);
    }
    return { targetReferenceId: inline.targetReferenceId };
  },
  decode(id, payload): BuilderInlineNode {
    const data = requireTransportRecord(payload, "Reference payload");
    return createReferenceInline(
      requireTransportString(data, "targetReferenceId", "Reference payload"),
      id,
    );
  },
};
