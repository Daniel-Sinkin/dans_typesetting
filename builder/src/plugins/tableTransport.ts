// Canonical transport codec owned by the semantic rich-table plugin.
import type { BuilderBlock } from "../model/document";
import { decodeOptionalReferenceId } from "../model/referenceId";
import {
  requireTransportArray,
  requireTransportNumber,
  requireTransportRecord,
  requireTransportString,
  type BlockTransportCodec,
} from "../transport/documentTransport";
import {
  createBuilderTableCell,
  createBuilderTableRow,
  createRichTableBlock,
  requireRichTableBlock,
  tableTypeId,
  type TableColumnAlignment,
} from "./tableModel";

function requireAlignment(value: unknown, context: string): TableColumnAlignment {
  if (value !== "left" && value !== "center" && value !== "right") {
    throw new Error(`${context} must be left, center, or right`);
  }
  return value;
}

export const tableTransportCodec: BlockTransportCodec = {
  typeId: tableTypeId,
  encode(block, registry) {
    const table = requireRichTableBlock(block);
    return {
      captionInlines: table.captionInlines.map((inline) =>
        registry.encodeInline(inline),
      ),
      referenceId: table.referenceId,
      headerRowCount: table.headerRowCount,
      columnAlignments: [...table.columnAlignments],
      rows: table.rows.map((row) => ({
        id: row.id,
        cells: row.cells.map((cell) => ({
          id: cell.id,
          inlines: cell.inlines.map((inline) => registry.encodeInline(inline)),
        })),
      })),
    };
  },
  decode(id, payload, registry): BuilderBlock {
    const data = requireTransportRecord(payload, "Table payload");
    const headerRowCount = requireTransportNumber(
      data,
      "headerRowCount",
      "Table payload",
    );
    if (!Number.isInteger(headerRowCount)) {
      throw new Error("Table payload.headerRowCount must be an integer");
    }
    const captionInlines = requireTransportArray(
      data,
      "captionInlines",
      "Table payload",
    ).map((inline, index) =>
      registry.decodeInline(inline, `Table caption inline ${String(index)}`),
    );
    const columnAlignments = requireTransportArray(
      data,
      "columnAlignments",
      "Table payload",
    ).map((alignment, index) =>
      requireAlignment(alignment, `Table column ${String(index)} alignment`),
    );
    const rows = requireTransportArray(data, "rows", "Table payload").map(
      (rowValue, rowIndex) => {
        const row = requireTransportRecord(
          rowValue,
          `Table row ${String(rowIndex)}`,
        );
        return createBuilderTableRow(
          requireTransportString(row, "id", `Table row ${String(rowIndex)}`),
          requireTransportArray(
            row,
            "cells",
            `Table row ${String(rowIndex)}`,
          ).map((cellValue, columnIndex) => {
            const cell = requireTransportRecord(
              cellValue,
              `Table cell ${String(rowIndex)}:${String(columnIndex)}`,
            );
            return createBuilderTableCell(
              requireTransportString(
                cell,
                "id",
                `Table cell ${String(rowIndex)}:${String(columnIndex)}`,
              ),
              requireTransportArray(
                cell,
                "inlines",
                `Table cell ${String(rowIndex)}:${String(columnIndex)}`,
              ).map((inline, inlineIndex) =>
                registry.decodeInline(
                  inline,
                  `Table cell ${String(rowIndex)}:${String(columnIndex)} inline ${String(inlineIndex)}`,
                ),
              ),
            );
          }),
        );
      },
    );
    return createRichTableBlock(
      id,
      captionInlines,
      rows,
      columnAlignments,
      headerRowCount,
      decodeOptionalReferenceId(data.referenceId, "Table payload.referenceId"),
    );
  },
};
