// Canonical transport codec owned by the paragraph colour-span extension.
import type { BuilderInlineNode } from "../model/document";
import {
  requireTransportArray,
  requireTransportNumber,
  requireTransportRecord,
  type InlineTransportCodec,
} from "../transport/documentTransport";
import {
  colorSpanInlineTypeId,
  createColorSpanInline,
  requireColorSpan,
  type BuilderRgbColor,
} from "./colorSpanModel";

function requireChannel(data: Record<string, unknown>, field: string): number {
  const value = requireTransportNumber(data, field, "Colour-span color");
  if (!Number.isInteger(value) || value < 0 || value > 255) {
    throw new Error(`Colour-span color.${field} must be an integer from 0 to 255`);
  }
  return value;
}

export const colorSpanInlineTransportCodec: InlineTransportCodec = {
  typeId: colorSpanInlineTypeId,
  encode(inline, registry) {
    const colorSpan = requireColorSpan(inline);
    return {
      color: { ...colorSpan.color },
      inlines: colorSpan.inlines.map((nested) => registry.encodeInline(nested)),
    };
  },
  decode(id, payload, registry): BuilderInlineNode {
    const data = requireTransportRecord(payload, "Colour-span payload");
    const color = requireTransportRecord(data.color, "Colour-span color");
    const decodedColor: BuilderRgbColor = Object.freeze({
      red: requireChannel(color, "red"),
      green: requireChannel(color, "green"),
      blue: requireChannel(color, "blue"),
    });
    const inlines = requireTransportArray(data, "inlines", "Colour-span payload").map(
      (nested, index) =>
        registry.decodeInline(nested, `Colour-span inline ${String(index)}`),
    );
    return createColorSpanInline(decodedColor, Object.freeze(inlines), id);
  },
};
