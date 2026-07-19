// Semantic browser model owned by the ordered/unordered item-list plugin.
import type { BuilderBlock, BuilderInlineNode } from "../model/document";

export const itemListTypeId = "dans.list";
export type ListPresentation = "itemized" | "enumerated";

export interface BuilderListItem {
  readonly id: string;
  readonly inlines: readonly BuilderInlineNode[];
}

export interface ItemListBlock extends BuilderBlock {
  readonly typeId: typeof itemListTypeId;
  readonly presentation: ListPresentation;
  readonly items: readonly BuilderListItem[];
}

export function createBuilderListItem(
  id: string,
  inlines: readonly BuilderInlineNode[],
): BuilderListItem {
  const item = Object.freeze({ id, inlines: Object.freeze([...inlines]) });
  validateBuilderListItem(item);
  return item;
}

export function isItemListBlock(block: BuilderBlock): block is ItemListBlock {
  return (
    block.typeId === itemListTypeId &&
    "presentation" in block &&
    (block.presentation === "itemized" || block.presentation === "enumerated") &&
    "items" in block &&
    Array.isArray(block.items)
  );
}

export function requireItemListBlock(block: BuilderBlock): ItemListBlock {
  if (!isItemListBlock(block)) {
    throw new Error(`Item-list plugin cannot consume ${block.typeId}`);
  }
  validateItemListBlock(block);
  return block;
}

export function validateBuilderListItem(item: BuilderListItem): void {
  if (item.id.length === 0) {
    throw new Error("A list item requires a stable ID");
  }
  if (item.inlines.length === 0) {
    throw new Error("A list item requires at least one inline node");
  }
  const inlineIds = new Set<string>();
  for (const inline of item.inlines) {
    if (inline.id.length === 0 || inline.typeId.length === 0) {
      throw new Error("List-item inline nodes require stable IDs and type IDs");
    }
    if (inlineIds.has(inline.id)) {
      throw new Error(`Duplicate list-item inline ID: ${inline.id}`);
    }
    inlineIds.add(inline.id);
  }
}

export function validateItemListBlock(block: ItemListBlock): void {
  if (block.items.length === 0) {
    throw new Error("An item list requires at least one item");
  }
  const itemIds = new Set<string>();
  for (const item of block.items) {
    validateBuilderListItem(item);
    if (itemIds.has(item.id)) {
      throw new Error(`Duplicate list item ID: ${item.id}`);
    }
    itemIds.add(item.id);
  }
}

export function moveListEntry<T>(
  entries: readonly T[],
  sourceIndex: number,
  targetIndex: number,
): readonly T[] {
  if (
    sourceIndex < 0 ||
    sourceIndex >= entries.length ||
    targetIndex < 0 ||
    targetIndex >= entries.length
  ) {
    throw new RangeError("A list move index is outside the sequence");
  }
  if (sourceIndex === targetIndex) {
    return entries;
  }
  const moved = [...entries];
  const [entry] = moved.splice(sourceIndex, 1);
  if (entry === undefined) {
    throw new Error("The selected list entry disappeared during a move");
  }
  moved.splice(targetIndex, 0, entry);
  return Object.freeze(moved);
}
