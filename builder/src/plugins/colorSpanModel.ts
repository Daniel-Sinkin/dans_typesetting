// Semantic data helpers for the paragraph colour-span extension.
import {
  createText,
  type BuilderInlineNode,
} from "../model/document";

export const colorSpanInlineTypeId = "dans.inline.color_span";

export interface BuilderRgbColor {
  readonly red: number;
  readonly green: number;
  readonly blue: number;
}

export interface ColorSpanInline extends BuilderInlineNode {
  readonly typeId: typeof colorSpanInlineTypeId;
  readonly color: BuilderRgbColor;
  readonly inlines: readonly BuilderInlineNode[];
}

function isColorChannel(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 255;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isColorSpanInline(inline: BuilderInlineNode): inline is ColorSpanInline {
  if (
    inline.typeId !== colorSpanInlineTypeId ||
    !("color" in inline) ||
    !("inlines" in inline) ||
    !isRecord(inline.color) ||
    !Array.isArray(inline.inlines)
  ) {
    return false;
  }
  const color = inline.color;
  return (
    isColorChannel(color.red) &&
    isColorChannel(color.green) &&
    isColorChannel(color.blue)
  );
}

export function requireColorSpan(inline: BuilderInlineNode): ColorSpanInline {
  if (!isColorSpanInline(inline)) {
    throw new Error(`Color-span plugin cannot consume ${inline.typeId}`);
  }
  return inline;
}

export function colorToCss(color: BuilderRgbColor): string {
  return `rgb(${String(color.red)} ${String(color.green)} ${String(color.blue)})`;
}

export function colorToHex(color: BuilderRgbColor): string {
  const channel = (value: number): string => value.toString(16).padStart(2, "0");
  return `#${channel(color.red)}${channel(color.green)}${channel(color.blue)}`;
}

export function colorFromHex(value: string): BuilderRgbColor {
  if (!/^#[0-9a-f]{6}$/iu.test(value)) {
    throw new Error(`Invalid browser colour value: ${value}`);
  }
  return Object.freeze({
    red: Number.parseInt(value.slice(1, 3), 16),
    green: Number.parseInt(value.slice(3, 5), 16),
    blue: Number.parseInt(value.slice(5, 7), 16),
  });
}

export function createColorSpanInline(
  color: BuilderRgbColor = Object.freeze({ red: 38, green: 96, blue: 168 }),
  inlines: readonly BuilderInlineNode[] = [createText("coloured text")],
  id: string = globalThis.crypto.randomUUID(),
): ColorSpanInline {
  return Object.freeze({
    id,
    typeId: colorSpanInlineTypeId,
    color: Object.freeze({ ...color }),
    inlines: Object.freeze([...inlines]),
  });
}
