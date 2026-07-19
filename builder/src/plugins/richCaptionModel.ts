// Validate plugin-owned captions that consume the shared Inline Sequence contract.
import type { BuilderInlineNode } from "../model/document";

export function freezeRichCaption(
  inlines: readonly BuilderInlineNode[],
  context: string,
): readonly BuilderInlineNode[] {
  validateRichCaption(inlines, context);
  return Object.freeze([...inlines]);
}

export function validateRichCaption(
  inlines: readonly BuilderInlineNode[],
  context: string,
): void {
  if (inlines.length === 0) {
    throw new Error(`${context} requires at least one inline node`);
  }
  const inlineIds = new Set<string>();
  for (const inline of inlines) {
    if (inline.id.length === 0 || inline.typeId.length === 0) {
      throw new Error(`${context} inline nodes require stable IDs and type IDs`);
    }
    if (inlineIds.has(inline.id)) {
      throw new Error(`Duplicate ${context.toLowerCase()} inline ID: ${inline.id}`);
    }
    inlineIds.add(inline.id);
  }
}
