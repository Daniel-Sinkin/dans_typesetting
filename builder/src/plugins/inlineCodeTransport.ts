// Canonical transport codec owned by the inline-code plugin.
import type { BuilderInlineNode } from "../model/document";
import {
  requireTransportRecord,
  requireTransportString,
  type InlineTransportCodec,
} from "../transport/documentTransport";
import {
  createInlineCode,
  inlineCodeTypeId,
  requireInlineCode,
} from "./inlineCodeModel";

export const inlineCodeTransportCodec: InlineTransportCodec = {
  typeId: inlineCodeTypeId,
  encode(inline) {
    return { code: requireInlineCode(inline).code };
  },
  decode(id, payload): BuilderInlineNode {
    const data = requireTransportRecord(payload, "Inline-code payload");
    return createInlineCode(
      requireTransportString(data, "code", "Inline-code payload"),
      id,
    );
  },
};
