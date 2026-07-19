// Copy a semantic block tree while letting each plugin reset identity-like payload fields.
import {
  childBlockSequences,
  createBlockId,
  type BuilderBlock,
} from "../model/document";
import type { BuilderPluginRegistry } from "./plugin";

export function copyBuilderBlockForInsert(
  block: BuilderBlock,
  registry: BuilderPluginRegistry,
  copiedBlockId: string = createBlockId(),
): BuilderBlock {
  const adapter = registry.pluginForBlock(block);
  const copied =
    adapter.copyForInsert?.(block, copiedBlockId) ??
    Object.freeze({ ...block, id: copiedBlockId });
  if (copied.id !== copiedBlockId || copied.typeId !== block.typeId) {
    throw new Error("A block copy adapter must preserve type and use the requested new ID");
  }
  const originalSequences = childBlockSequences(block);
  if (originalSequences.length === 0) {
    return copied;
  }
  const copiedSequences = childBlockSequences(copied);
  if (
    copiedSequences.length !== originalSequences.length ||
    originalSequences.some(
      (sequence) =>
        !copiedSequences.some((candidate) => candidate.id === sequence.id),
    )
  ) {
    throw new Error("A nested-block copy adapter must preserve child sequence endpoints");
  }
  return Object.freeze({
    ...copied,
    childSequences: Object.freeze(
      originalSequences.map((sequence) =>
        Object.freeze({
          ...sequence,
          blocks: Object.freeze(
            sequence.blocks.map((child) =>
              copyBuilderBlockForInsert(child, registry),
            ),
          ),
        }),
      ),
    ),
  });
}
