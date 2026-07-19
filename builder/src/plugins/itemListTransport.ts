// Canonical transport codec owned by the semantic item-list plugin.
import type { BuilderBlock } from "../model/document";
import {
  requireTransportArray,
  requireTransportRecord,
  requireTransportString,
  type BlockTransportCodec,
} from "../transport/documentTransport";
import {
  createBuilderListItem,
  itemListTypeId,
  requireItemListBlock,
  validateItemListBlock,
  type ItemListBlock,
  type ListPresentation,
} from "./itemListModel";

function requirePresentation(value: unknown): ListPresentation {
  if (value !== "itemized" && value !== "enumerated") {
    throw new Error("Item-list payload.presentation is invalid");
  }
  return value;
}

export const itemListTransportCodec: BlockTransportCodec = {
  typeId: itemListTypeId,
  encode(block, registry) {
    const list = requireItemListBlock(block);
    return {
      presentation: list.presentation,
      items: list.items.map((item) => ({
        id: item.id,
        inlines: item.inlines.map((inline) => registry.encodeInline(inline)),
      })),
    };
  },
  decode(id, payload, registry): BuilderBlock {
    const data = requireTransportRecord(payload, "Item-list payload");
    const items = requireTransportArray(data, "items", "Item-list payload").map(
      (value, index) => {
        const item = requireTransportRecord(value, `Item-list item ${String(index)}`);
        return createBuilderListItem(
          requireTransportString(item, "id", `Item-list item ${String(index)}`),
          requireTransportArray(item, "inlines", `Item-list item ${String(index)}`).map(
            (inline, inlineIndex) =>
              registry.decodeInline(
                inline,
                `Item-list item ${String(index)} inline ${String(inlineIndex)}`,
              ),
          ),
        );
      },
    );
    const list = Object.freeze({
      id,
      typeId: itemListTypeId,
      presentation: requirePresentation(data.presentation),
      items: Object.freeze(items),
    }) satisfies ItemListBlock;
    validateItemListBlock(list);
    return list;
  },
};
