// Derive labels and numbers from current traversal order; plugins only expose targets.
import {
  flattenBuilderBlocks,
  isSectionBlock,
  type BuilderBlock,
} from "../model/document";
import { requireReferenceId } from "../model/referenceId";
import { deriveBlockOrdinals } from "./numbering";
import type { BuilderPluginRegistry } from "./plugin";
import {
  referenceAnchorId,
  type BuilderReferenceTarget,
  type BuilderReferenceTargetDescriptor,
} from "./reference";

function hasReferenceId(
  descriptor: BuilderReferenceTargetDescriptor | null,
): descriptor is BuilderReferenceTargetDescriptor & { readonly referenceId: string } {
  return descriptor?.referenceId !== null && descriptor?.referenceId !== undefined;
}

function deriveSectionNumbers(
  blocks: readonly BuilderBlock[],
): ReadonlyMap<string, string> {
  const result = new Map<string, string>();
  const counters = [0, 0, 0, 0, 0];
  const visit = (sequence: readonly BuilderBlock[], depth: number): void => {
    for (const block of sequence) {
      if (!isSectionBlock(block)) {
        continue;
      }
      counters[depth] = (counters[depth] ?? 0) + 1;
      counters.fill(0, depth + 1);
      result.set(block.id, counters.slice(0, depth + 1).join("."));
      visit(block.blocks, depth + 1);
    }
  };
  visit(blocks, 0);
  return result;
}

export function deriveReferenceTargets(
  blocks: readonly BuilderBlock[],
  registry: BuilderPluginRegistry,
): ReadonlyMap<string, BuilderReferenceTarget> {
  const flattened = flattenBuilderBlocks(blocks);
  const ordinals = deriveBlockOrdinals(
    flattened,
    (block) => registry.pluginForBlock(block).numberingSeries ?? null,
  );
  const sectionNumbers = deriveSectionNumbers(blocks);
  const result = new Map<string, BuilderReferenceTarget>();

  for (const block of flattened) {
    const adapter = registry.pluginForBlock(block);
    const descriptor = adapter.referenceTarget?.(block) ?? null;
    if (!hasReferenceId(descriptor)) {
      continue;
    }
    const referenceId = requireReferenceId(
      descriptor.referenceId,
      `${descriptor.label} reference ID`,
    );
    const previous = result.get(referenceId);
    if (previous !== undefined) {
      throw new Error(
        `Duplicate semantic reference ID '${referenceId}' on blocks ${previous.blockId} and ${block.id}`,
      );
    }
    const ordinal = ordinals.get(block.id)?.ordinal ?? null;
    const number = isSectionBlock(block)
      ? sectionNumbers.get(block.id) ?? "?"
      : ordinal === null
        ? "?"
        : String(ordinal);
    result.set(referenceId, {
      referenceId,
      blockId: block.id,
      typeId: block.typeId,
      label: descriptor.label,
      number,
      title: descriptor.title ?? null,
      displayText: `${descriptor.label} ${number}`,
      anchorId: referenceAnchorId(referenceId),
    });
  }

  return result;
}
