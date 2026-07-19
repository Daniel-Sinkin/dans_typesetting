// Register the item-list semantic contract with the graphical writer.
import type { BuilderInlinePluginRegistry } from "../builder/inlinePlugin";
import type { BuilderBlockPlugin } from "../builder/plugin";
import {
  createBlockId,
  createParagraphText,
  type BuilderBlock,
} from "../model/document";
import { ItemListEditor, ItemListPreview } from "./itemList";
import {
  createBuilderListItem,
  itemListTypeId,
  requireItemListBlock,
} from "./itemListModel";

export function createItemListPlugin(
  inlineRegistry: BuilderInlinePluginRegistry,
): BuilderBlockPlugin {
  return {
    typeId: itemListTypeId,
    palette: {
      label: "Item list",
      description: "A bulleted or numbered sequence of inline-rich items",
      glyph: "≡",
      accentColor: "#0ca678",
    },
    createDefault(blockId): BuilderBlock {
      return Object.freeze({
        id: blockId,
        typeId: itemListTypeId,
        presentation: "itemized",
        items: Object.freeze([
          createBuilderListItem(createBlockId(), [createParagraphText("A new list item.")]),
        ]),
      });
    },
    measure(block, availableWidth) {
      const list = requireItemListBlock(block);
      const charactersPerLine = Math.max(20, Math.floor((availableWidth - 48) / 10));
      const lines = list.items.reduce((total, item) => {
        const textLength = item.inlines
          .map((inline) =>
            inlineRegistry.adapterForInline(inline).plainText(inline, inlineRegistry),
          )
          .join("").length;
        return total + Math.max(1, Math.ceil(textLength / charactersPerLine));
      }, 0);
      return 68 + list.items.length * 10 + lines * 28;
    },
    renderPreview(block) {
      return <ItemListPreview list={requireItemListBlock(block)} registry={inlineRegistry} />;
    },
    editor: {
      title(block) {
        return `Edit semantic list · ${requireItemListBlock(block).id}`;
      },
      render(props) {
        return <ItemListEditor {...props} inlineRegistry={inlineRegistry} />;
      },
    },
  };
}
