// Copy inline extension data through plugin hooks while refreshing authoring IDs.
import {
  createBlockId,
  type BuilderInlineNode,
} from "../model/document";
import type { BuilderInlinePluginRegistry } from "./inlinePlugin";

export function copyBuilderInlineForInsert(
  inline: BuilderInlineNode,
  registry: BuilderInlinePluginRegistry,
  copiedInlineId: string = createBlockId(),
): BuilderInlineNode {
  const adapter = registry.adapterForInline(inline);
  const copied =
    adapter.copyForInsert?.(inline, copiedInlineId, registry) ??
    Object.freeze({ ...inline, id: copiedInlineId });
  if (copied.id !== copiedInlineId || copied.typeId !== inline.typeId) {
    throw new Error("An inline copy adapter must preserve type and use the requested new ID");
  }
  return copied;
}
