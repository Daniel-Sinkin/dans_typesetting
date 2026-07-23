import type { BuilderBlock } from "../model/document";

export const deletedBlockCacheCapacity = 5;

export function rememberDeletedBlocks(
  current: readonly BuilderBlock[],
  deleted: readonly BuilderBlock[],
): readonly BuilderBlock[] {
  const deletedIds = new Set(deleted.map(({ id }) => id));
  return Object.freeze([
    ...deleted,
    ...current.filter(({ id }) => !deletedIds.has(id)),
  ].slice(0, deletedBlockCacheCapacity));
}
