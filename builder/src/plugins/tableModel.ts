// Semantic rich-table model owned by the table plugin.
import type { BuilderBlock, BuilderInlineNode } from "../model/document";
import { validateOptionalReferenceId } from "../model/referenceId";

export const tableTypeId = "dans.table";
export type TableColumnAlignment = "left" | "center" | "right";

export interface BuilderTableCell {
  readonly id: string;
  readonly inlines: readonly BuilderInlineNode[];
}

export interface BuilderTableRow {
  readonly id: string;
  readonly cells: readonly BuilderTableCell[];
}

export interface RichTableBlock extends BuilderBlock {
  readonly typeId: typeof tableTypeId;
  readonly captionInlines: readonly BuilderInlineNode[];
  readonly referenceId: string | null;
  readonly headerRowCount: number;
  readonly columnAlignments: readonly TableColumnAlignment[];
  readonly rows: readonly BuilderTableRow[];
}

function validateInlineRoots(
  inlines: readonly BuilderInlineNode[],
  context: string,
  seenInlineIds: Set<string>,
): void {
  if (inlines.length === 0) {
    throw new Error(`${context} requires at least one inline node`);
  }
  for (const inline of inlines) {
    if (inline.id.length === 0 || inline.typeId.length === 0) {
      throw new Error(`${context} inline nodes require stable IDs and type IDs`);
    }
    if (seenInlineIds.has(inline.id)) {
      throw new Error(`Duplicate table inline ID: ${inline.id}`);
    }
    seenInlineIds.add(inline.id);
  }
}

export function createBuilderTableCell(
  id: string,
  inlines: readonly BuilderInlineNode[],
): BuilderTableCell {
  return Object.freeze({ id, inlines: Object.freeze([...inlines]) });
}

export function createBuilderTableRow(
  id: string,
  cells: readonly BuilderTableCell[],
): BuilderTableRow {
  return Object.freeze({ id, cells: Object.freeze([...cells]) });
}

export function createRichTableBlock(
  id: string,
  captionInlines: readonly BuilderInlineNode[],
  rows: readonly BuilderTableRow[],
  columnAlignments: readonly TableColumnAlignment[],
  headerRowCount = 0,
  referenceId: string | null = null,
): RichTableBlock {
  const table = Object.freeze({
    id,
    typeId: tableTypeId,
    captionInlines: Object.freeze([...captionInlines]),
    referenceId,
    headerRowCount,
    columnAlignments: Object.freeze([...columnAlignments]),
    rows: Object.freeze([...rows]),
  }) satisfies RichTableBlock;
  validateRichTableBlock(table);
  return table;
}

export function isRichTableBlock(block: BuilderBlock): block is RichTableBlock {
  return (
    block.typeId === tableTypeId &&
    "captionInlines" in block &&
    Array.isArray(block.captionInlines) &&
    "referenceId" in block &&
    (block.referenceId === null || typeof block.referenceId === "string") &&
    "headerRowCount" in block &&
    typeof block.headerRowCount === "number" &&
    "columnAlignments" in block &&
    Array.isArray(block.columnAlignments) &&
    "rows" in block &&
    Array.isArray(block.rows)
  );
}

export function requireRichTableBlock(block: BuilderBlock): RichTableBlock {
  if (!isRichTableBlock(block)) {
    throw new Error(`Table plugin cannot consume ${block.typeId}`);
  }
  validateRichTableBlock(block);
  return block;
}

export function validateRichTableBlock(table: RichTableBlock): void {
  validateOptionalReferenceId(table.referenceId, "Table reference ID");
  if (table.columnAlignments.length === 0) {
    throw new Error("A semantic table requires at least one column");
  }
  if (
    !Number.isInteger(table.headerRowCount) ||
    table.headerRowCount < 0 ||
    table.headerRowCount > table.rows.length
  ) {
    throw new Error("Table headerRowCount must select existing leading rows");
  }
  const validAlignments: readonly string[] = ["left", "center", "right"];
  for (const alignment of table.columnAlignments) {
    if (!validAlignments.includes(alignment)) {
      throw new Error("A table column alignment is invalid");
    }
  }
  if (table.rows.length === 0) {
    throw new Error("A semantic table requires at least one row");
  }

  const rowIds = new Set<string>();
  const cellIds = new Set<string>();
  const inlineIds = new Set<string>();
  validateInlineRoots(table.captionInlines, "Table caption", inlineIds);
  for (const row of table.rows) {
    if (row.id.length === 0 || rowIds.has(row.id)) {
      throw new Error(`Invalid or duplicate table row ID: ${row.id}`);
    }
    rowIds.add(row.id);
    if (row.cells.length !== table.columnAlignments.length) {
      throw new Error("A semantic table must be rectangular");
    }
    for (const cell of row.cells) {
      if (cell.id.length === 0 || cellIds.has(cell.id)) {
        throw new Error(`Invalid or duplicate table cell ID: ${cell.id}`);
      }
      cellIds.add(cell.id);
      validateInlineRoots(cell.inlines, `Table cell ${cell.id}`, inlineIds);
    }
  }
}
