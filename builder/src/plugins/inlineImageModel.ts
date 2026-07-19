// Semantic data for emoji-sized images inside the shared Inline Sequence.
import { createBlockId, type BuilderInlineNode } from "../model/document";

export const inlineImageTypeId = "dans.image.inline";

export interface InlineImageNode extends BuilderInlineNode {
  readonly typeId: typeof inlineImageTypeId;
  readonly source: string;
  readonly heightEm: number;
}

export function createInlineImage(
  source: string,
  heightEm = 1,
  id: string = createBlockId(),
): InlineImageNode {
  const inline = Object.freeze({ id, typeId: inlineImageTypeId, source, heightEm });
  validateInlineImage(inline);
  return inline;
}

export function isInlineImage(inline: BuilderInlineNode): inline is InlineImageNode {
  return (
    inline.typeId === inlineImageTypeId &&
    "source" in inline &&
    typeof inline.source === "string" &&
    "heightEm" in inline &&
    typeof inline.heightEm === "number"
  );
}

export function requireInlineImage(inline: BuilderInlineNode): InlineImageNode {
  if (!isInlineImage(inline)) {
    throw new Error(`Inline-image plugin cannot consume ${inline.typeId}`);
  }
  validateInlineImage(inline);
  return inline;
}

export function validateInlineImage(inline: InlineImageNode): void {
  if (inline.id.length === 0 || inline.source.trim().length === 0) {
    throw new Error("An inline image requires a stable ID and non-empty source");
  }
  if (!Number.isFinite(inline.heightEm) || inline.heightEm <= 0) {
    throw new Error("Inline-image heightEm must be finite and positive");
  }
}
