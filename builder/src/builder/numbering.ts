// Derive visible ordinals from current traversal order without plugin-local counters.
import type { BuilderBlock } from "../model/document";

export interface BlockOrdinal {
  readonly numberingSeries: string | null;
  readonly ordinal: number | null;
}

export function deriveBlockOrdinals(
  blocks: readonly BuilderBlock[],
  seriesForBlock: (block: BuilderBlock) => string | null,
): ReadonlyMap<string, BlockOrdinal> {
  const nextOrdinalBySeries = new Map<string, number>();
  const result = new Map<string, BlockOrdinal>();
  for (const block of blocks) {
    const numberingSeries = seriesForBlock(block);
    if (numberingSeries === null) {
      result.set(block.id, { numberingSeries: null, ordinal: null });
      continue;
    }
    if (numberingSeries.length === 0) {
      throw new Error("A block numbering series cannot be empty");
    }
    const ordinal = (nextOrdinalBySeries.get(numberingSeries) ?? 0) + 1;
    nextOrdinalBySeries.set(numberingSeries, ordinal);
    result.set(block.id, { numberingSeries, ordinal });
  }
  return result;
}
