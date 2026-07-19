// Canonical transport codec owned by the ordinary-text inline plugin.
import {
  createText,
  isTextInline,
  textInlineTypeId,
  type BuilderInlineNode,
  type TextStyle,
} from "../model/document";
import {
  requireTransportRecord,
  requireTransportString,
  type InlineTransportCodec,
} from "../transport/documentTransport";

function requireTextStyle(value: unknown): TextStyle {
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

export const textInlineTransportCodec: InlineTransportCodec = {
  typeId: textInlineTypeId,
  encode(inline) {
    if (!isTextInline(inline)) {
      throw new Error(`Core Text codec cannot encode ${inline.typeId}`);
    }
    return { text: inline.text, style: inline.style };
  },
  decode(id, payload): BuilderInlineNode {
    const data = requireTransportRecord(payload, "Core Text payload");
    return createText(
      requireTransportString(data, "text", "Core Text payload"),
      id,
      requireTextStyle(data.style),
    );
  },
};
