// Pure ordered-inline-sequence operations shared by every graphical inline host.
import type { BuilderInlineNode } from "./document";

function requireExistingIndex(inlines: readonly BuilderInlineNode[], index: number): void {
  if (!Number.isInteger(index) || index < 0 || index >= inlines.length) {
    throw new RangeError(`Inline index ${String(index)} is outside the sequence`);
  }
}

function requireInsertionIndex(inlines: readonly BuilderInlineNode[], index: number): void {
  if (!Number.isInteger(index) || index < 0 || index > inlines.length) {
    throw new RangeError(`Inline insertion index ${String(index)} is outside the sequence`);
  }
}

export function insertInlineNode(
  inlines: readonly BuilderInlineNode[],
  index: number,
  inline: BuilderInlineNode,
): readonly BuilderInlineNode[] {
  requireInsertionIndex(inlines, index);
  if (inlines.some((candidate) => candidate.id === inline.id)) {
    throw new Error(`Duplicate inline ID: ${inline.id}`);
  }
  const nextInlines = [...inlines];
  nextInlines.splice(index, 0, inline);
  return Object.freeze(nextInlines);
}

export function removeInlineNode(
  inlines: readonly BuilderInlineNode[],
  index: number,
): readonly BuilderInlineNode[] {
  requireExistingIndex(inlines, index);
  return Object.freeze(inlines.filter((_inline, candidateIndex) => candidateIndex !== index));
}

// insertionIndex is measured against the original sequence, as it is while the
// dragged node remains visible. Removing the origin shifts later insertion points.
export function moveInlineNode(
  inlines: readonly BuilderInlineNode[],
  fromIndex: number,
  insertionIndex: number,
): readonly BuilderInlineNode[] {
  requireExistingIndex(inlines, fromIndex);
  requireInsertionIndex(inlines, insertionIndex);
  const movedInline = inlines[fromIndex];
  if (movedInline === undefined) {
    throw new RangeError(`Inline index ${String(fromIndex)} is outside the sequence`);
  }
  const remaining = inlines.filter((_inline, index) => index !== fromIndex);
  const adjustedInsertionIndex = insertionIndex > fromIndex
    ? insertionIndex - 1
    : insertionIndex;
  remaining.splice(adjustedInsertionIndex, 0, movedInline);
  return Object.freeze(remaining);
}
