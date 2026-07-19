// Semantic inline footnote payload; visible numbering belongs to each writer.
import {
  createBlockId,
  createText,
  type BuilderInlineNode,
} from "../model/document";

export const footnoteInlineTypeId = "dans.inline.footnote";

export interface FootnoteInline extends BuilderInlineNode {
  readonly typeId: typeof footnoteInlineTypeId;
  readonly inlines: readonly BuilderInlineNode[];
}

export function isFootnoteInline(
  inline: BuilderInlineNode,
): inline is FootnoteInline {
  return (
    inline.typeId === footnoteInlineTypeId &&
    "inlines" in inline &&
    Array.isArray(inline.inlines)
  );
}

export function validateFootnoteInline(footnote: FootnoteInline): void {
  if (footnote.inlines.length === 0) {
    throw new Error("A footnote requires at least one inline node");
  }
  const ids = new Set<string>();
  for (const inline of footnote.inlines) {
    if (inline.id.length === 0 || inline.typeId.length === 0) {
      throw new Error("Footnote inline nodes require stable IDs and type IDs");
    }
    if (ids.has(inline.id)) {
      throw new Error(`Duplicate footnote inline ID: ${inline.id}`);
    }
    if (inline.typeId === footnoteInlineTypeId) {
      throw new Error("A footnote cannot directly contain another footnote");
    }
    ids.add(inline.id);
  }
}

export function createFootnoteInline(
  inlines: readonly BuilderInlineNode[] = [
    createText("A new footnote."),
  ],
  id: string = createBlockId(),
): FootnoteInline {
  const footnote = Object.freeze({
    id,
    typeId: footnoteInlineTypeId,
    inlines: Object.freeze([...inlines]),
  }) satisfies FootnoteInline;
  validateFootnoteInline(footnote);
  return footnote;
}

export function requireFootnote(inline: BuilderInlineNode): FootnoteInline {
  if (!isFootnoteInline(inline)) {
    throw new Error(`Footnote connector cannot consume ${inline.typeId}`);
  }
  validateFootnoteInline(inline);
  return inline;
}
