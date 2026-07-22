/** Pure document-order decisions shared by pointer and keyboard controllers. */
export function adjacentBlockId(
  orderedBlockIds: readonly string[],
  currentBlockId: string,
  direction: -1 | 1,
): string | null {
  const currentIndex = orderedBlockIds.indexOf(currentBlockId);
  if (currentIndex < 0) {
    return null;
  }
  return orderedBlockIds[currentIndex + direction] ?? null;
}

export function blockIdAfterDeletion(
  orderedBlockIds: readonly string[],
  deletedBlockIds: readonly string[],
): string | null {
  const deleted = new Set(deletedBlockIds);
  const deletedIndices = orderedBlockIds
    .map((blockId, index) => (deleted.has(blockId) ? index : -1))
    .filter((index) => index >= 0);
  if (deletedIndices.length === 0) {
    return null;
  }
  const firstDeletedIndex = Math.min(...deletedIndices);
  const lastDeletedIndex = Math.max(...deletedIndices);
  for (let index = lastDeletedIndex + 1; index < orderedBlockIds.length; index += 1) {
    const candidate = orderedBlockIds[index];
    if (candidate !== undefined && !deleted.has(candidate)) {
      return candidate;
    }
  }
  for (let index = firstDeletedIndex - 1; index >= 0; index -= 1) {
    const candidate = orderedBlockIds[index];
    if (candidate !== undefined && !deleted.has(candidate)) {
      return candidate;
    }
  }
  return null;
}
