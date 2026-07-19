// Optional plain-text CSV capability for the semantic rich-table plugin.
import type { BuilderInlinePluginRegistry } from "../builder/inlinePlugin";
import { textInlineTypeId } from "../model/document";
import { requireRichTableBlock, type RichTableBlock } from "./tableModel";

export interface TableCsvCapability {
  parse(source: string, maximumRows?: number): readonly (readonly string[])[];
  serialize(
    table: RichTableBlock,
    inlineRegistry: BuilderInlinePluginRegistry,
  ): string;
}

function validateRectangular(
  rows: readonly (readonly string[])[],
): number {
  const firstRow = rows[0];
  if (firstRow === undefined || firstRow.length === 0) {
    throw new Error("CSV table data requires at least one row and column");
  }
  const columnCount = firstRow.length;
  if (rows.some((row) => row.length !== columnCount)) {
    throw new Error("CSV table data must be rectangular");
  }
  return columnCount;
}

export function parseTableCsv(
  source: string,
  maximumRows?: number,
): readonly (readonly string[])[] {
  if (
    maximumRows !== undefined &&
    (!Number.isInteger(maximumRows) || maximumRows < 1)
  ) {
    throw new Error("CSV maximumRows must be a positive integer");
  }
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let closedQuote = false;
  let lastWasRowDelimiter = false;

  const finishRow = (): void => {
    row.push(field);
    field = "";
    rows.push(row);
    row = [];
    closedQuote = false;
    if (maximumRows !== undefined && rows.length > maximumRows) {
      throw new Error("CSV input exceeds the configured row limit");
    }
  };

  for (let index = 0; index < source.length; index += 1) {
    const character = source.charAt(index);
    if (inQuotes) {
      if (character !== '"') {
        field += character;
        continue;
      }
      if (source[index + 1] === '"') {
        field += '"';
        index += 1;
        continue;
      }
      inQuotes = false;
      closedQuote = true;
      continue;
    }

    if (character === '"') {
      if (field.length !== 0 || closedQuote) {
        throw new Error("A quoted CSV field must begin with a quote");
      }
      inQuotes = true;
      lastWasRowDelimiter = false;
    } else if (character === ",") {
      row.push(field);
      field = "";
      closedQuote = false;
      lastWasRowDelimiter = false;
    } else if (character === "\n" || character === "\r") {
      finishRow();
      lastWasRowDelimiter = true;
      if (character === "\r" && source[index + 1] === "\n") {
        index += 1;
      }
    } else {
      if (closedQuote) {
        throw new Error("A closed quoted CSV field must end at a delimiter");
      }
      field += character;
      lastWasRowDelimiter = false;
    }
  }

  if (inQuotes) {
    throw new Error("CSV input ends inside a quoted field");
  }
  if (source.length !== 0 && !lastWasRowDelimiter) {
    finishRow();
  }
  validateRectangular(rows);
  return Object.freeze(
    rows.map((entry) => Object.freeze([...entry])),
  );
}

function appendCsvField(output: string, field: string): string {
  if (!/[",\r\n]/u.test(field)) {
    return output + field;
  }
  return `${output}"${field.replaceAll('"', '""')}"`;
}

export function serializeTableCsv(
  rows: readonly (readonly string[])[],
): string {
  validateRectangular(rows);
  return rows
    .map((row) =>
      row.reduce(
        (line, field, index) =>
          appendCsvField(index === 0 ? line : `${line},`, field),
        "",
      ),
    )
    .join("\n") + "\n";
}

export const tableCsvCapability: TableCsvCapability = {
  parse: parseTableCsv,
  serialize(table, inlineRegistry) {
    const validated = requireRichTableBlock(table);
    return serializeTableCsv(
      validated.rows.map((row) =>
        row.cells.map((cell) => {
          if (
            cell.inlines.some(
              (inline) => inline.typeId !== textInlineTypeId,
            )
          ) {
            throw new Error(
              "CSV export supports only plain Core Text table cells",
            );
          }
          return cell.inlines
            .map((inline) =>
              inlineRegistry.adapterForInline(inline).plainText(inline, inlineRegistry),
            )
            .join("");
        }),
      ),
    );
  },
};
