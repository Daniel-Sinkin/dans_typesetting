// Copy a semantic block tree while letting each plugin reset identity-like payload fields.
import {
  createBlockId,
  isSectionBlock,
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
  if (!isSectionBlock(block) || !isSectionBlock(copied)) {
    return copied;
  }
  return Object.freeze({
    ...copied,
    blocks: Object.freeze(
      block.blocks.map((child) => copyBuilderBlockForInsert(child, registry)),
    ),
  });
}
