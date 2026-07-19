// Derive visible ordinals from current traversal order without plugin-local counters.
import { flattenBuilderBlocks, type BuilderBlock } from "../model/document";
import type { BuilderPluginRegistry } from "./plugin";
import type { InlineOrdinal } from "./numbered";

export interface BlockOrdinal {
  readonly numberingSeries: string | null;
  readonly ordinal: number | null;
}

export function deriveInlineOrdinals(
  blocks: readonly BuilderBlock[],
  registry: BuilderPluginRegistry,
): ReadonlyMap<string, InlineOrdinal> {
  const result = new Map<string, InlineOrdinal>();
  const nextOrdinalBySeries = new Map<string, number>();
  for (const block of flattenBuilderBlocks(blocks)) {
    const adapter = registry.pluginForBlock(block);
    for (const occurrence of adapter.numberedInlineOccurrences?.(block) ?? []) {
      if (result.has(occurrence.inlineId)) {
        throw new Error(`Duplicate numbered inline occurrence: ${occurrence.inlineId}`);
      }
      const ordinal =
        (nextOrdinalBySeries.get(occurrence.numberingSeries) ?? 0) + 1;
      nextOrdinalBySeries.set(occurrence.numberingSeries, ordinal);
      result.set(occurrence.inlineId, {
        numberingSeries: occurrence.numberingSeries,
        ordinal,
      });
    }
  }
  return result;
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
