// Register semantic rich tables with the graphical writer.
import type { BuilderInlinePluginRegistry } from "../builder/inlinePlugin";
import { copyBuilderInlineForInsert } from "../builder/copyInline";
import type { BuilderBlockPlugin } from "../builder/plugin";
import {
  createBlockId,
  createParagraphText,
  type BuilderBlock,
} from "../model/document";
import type { TableCsvCapability } from "./tableCsv";
import {
  createBuilderTableCell,
  createBuilderTableRow,
  createRichTableBlock,
  requireRichTableBlock,
  tableTypeId,
} from "./tableModel";
import { TableEditor, TablePreview } from "./tableView";

export function createTablePlugin(
  inlineRegistry: BuilderInlinePluginRegistry,
  csvCapability?: TableCsvCapability,
): BuilderBlockPlugin {
  return {
    typeId: tableTypeId,
    numberingSeries: "table",
    palette: {
      label: "Table",
      description: "A numbered rectangular grid of inline-rich cells",
      glyph: "▦",
      accentColor: "#e67700",
    },
    createDefault(blockId): BuilderBlock {
      return createRichTableBlock(
        blockId,
        [createParagraphText("A new table caption.")],
        [
          createBuilderTableRow(createBlockId(), [
            createBuilderTableCell(createBlockId(), [createParagraphText("Column A")]),
            createBuilderTableCell(createBlockId(), [createParagraphText("Column B")]),
          ]),
          createBuilderTableRow(createBlockId(), [
            createBuilderTableCell(createBlockId(), [createParagraphText("Value A")]),
            createBuilderTableCell(createBlockId(), [createParagraphText("Value B")]),
          ]),
        ],
        ["left", "left"],
        1,
      );
    },
    referenceTarget(block) {
      const table = requireRichTableBlock(block);
      return {
        referenceId: table.referenceId,
        label: "Table",
        title: table.captionInlines
          .map((inline) =>
            inlineRegistry.adapterForInline(inline).plainText(inline, inlineRegistry),
          )
          .join(""),
      };
    },
    numberedInlineOccurrences(block) {
      const table = requireRichTableBlock(block);
      return inlineRegistry.numberedOccurrences([
        ...table.captionInlines,
        ...table.rows.flatMap((row) => row.cells.flatMap((cell) => cell.inlines)),
      ]);
    },
    copyForInsert(block, copiedBlockId) {
      const table = requireRichTableBlock(block);
      return createRichTableBlock(
        copiedBlockId,
        table.captionInlines.map((inline) =>
          copyBuilderInlineForInsert(inline, inlineRegistry),
        ),
        table.rows.map((row) =>
          createBuilderTableRow(
            createBlockId(),
            row.cells.map((cell) =>
              createBuilderTableCell(
                createBlockId(),
                cell.inlines.map((inline) =>
                  copyBuilderInlineForInsert(inline, inlineRegistry),
                ),
              ),
            ),
          ),
        ),
        table.columnAlignments,
        table.headerRowCount,
        null,
      );
    },
    measure(block, availableWidth) {
      const table = requireRichTableBlock(block);
      const charactersPerCell = Math.max(
        8,
        Math.floor(availableWidth / table.columnAlignments.length / 9),
      );
      const rowLines = table.rows.reduce(
        (total, row) =>
          total +
          Math.max(
            1,
            ...row.cells.map((cell) => {
              const length = cell.inlines
                .map((inline) =>
                  inlineRegistry
                    .adapterForInline(inline)
                    .plainText(inline, inlineRegistry),
                )
                .join("").length;
              return Math.ceil(length / charactersPerCell);
            }),
          ),
        0,
      );
      return Math.min(720, 100 + table.rows.length * 18 + rowLines * 26);
    },
    renderPreview(block, context) {
      return (
        <TablePreview
          table={requireRichTableBlock(block)}
          registry={inlineRegistry}
          context={{
            referenceTargets: context.referenceTargets,
            inlineOrdinals: context.inlineOrdinals,
            documentResources: context.documentResources,
          }}
          ordinal={context.ordinal ?? 0}
        />
      );
    },
    editor: {
      title(block) {
        return `Edit semantic table · ${requireRichTableBlock(block).id}`;
      },
      render(props) {
        return (
          <TableEditor
            {...props}
            inlineRegistry={inlineRegistry}
            csvCapability={csvCapability}
          />
        );
      },
    },
  };
}
