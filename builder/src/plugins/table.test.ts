import { describe, expect, it } from "vitest";

import { BuilderInlinePluginRegistry } from "../builder/inlinePlugin";
import { BuilderPluginRegistry } from "../builder/plugin";
import { deriveReferenceTargets } from "../builder/referenceTargets";
import {
  createMathInline,
  createParagraphText,
  MemoryDocumentPort,
} from "../model/document";
import { createMathInteger } from "../model/math";
import { projectDocumentTransport } from "../transport/projectTransport";
import { opaqueInlineAdapter, paragraphTextInlinePlugin } from "./paragraphInline";
import { opaqueBlockAdapter } from "./opaque";
import {
  parseTableCsv,
  serializeTableCsv,
  tableCsvCapability,
} from "./tableCsv";
import {
  createBuilderTableCell,
  createBuilderTableRow,
  createRichTableBlock,
} from "./tableModel";
import { createTablePlugin } from "./tablePlugin";

const inlineRegistry = new BuilderInlinePluginRegistry(
  [paragraphTextInlinePlugin],
  opaqueInlineAdapter,
);

function sampleTable() {
  return createRichTableBlock(
    "table",
    [createParagraphText("Runtime", "caption")],
    [
      createBuilderTableRow("header", [
        createBuilderTableCell("header-name", [
          createParagraphText("Name", "header-name-text"),
        ]),
        createBuilderTableCell("header-value", [
          createParagraphText("Value", "header-value-text"),
        ]),
      ]),
      createBuilderTableRow("data", [
        createBuilderTableCell("data-name", [
          createParagraphText("CUDA, C++", "data-name-text"),
        ]),
        createBuilderTableCell("data-value", [
          createParagraphText("1.25", "data-value-text"),
        ]),
      ]),
    ],
    ["left", "right"],
    1,
    "tab:runtime",
  );
}

describe("semantic tables and CSV extension", () => {
  it("parses quoted CSV and normalizes without changing cell data", () => {
    const parsed = parseTableCsv(
      'name,value\r\n"CUDA, C++","a ""quote"""\r\nline,"embedded\nnewline"\r\n',
    );

    expect(parsed).toEqual([
      ["name", "value"],
      ["CUDA, C++", 'a "quote"'],
      ["line", "embedded\nnewline"],
    ]);
    expect(parseTableCsv(serializeTableCsv(parsed))).toEqual(parsed);
  });

  it("enforces row bounds, rectangular data, and quote boundaries", () => {
    expect(() => parseTableCsv("a\nb\n", 1)).toThrow(/row limit/u);
    expect(() => parseTableCsv("a,b\n1\n")).toThrow(/rectangular/u);
    expect(() => parseTableCsv('"unfinished')).toThrow(/quoted field/u);
    expect(() => parseTableCsv('"closed"tail')).toThrow(/delimiter/u);
  });

  it("round-trips the canonical rich-table payload exactly", () => {
    const source = projectDocumentTransport.toString(
      new MemoryDocumentPort([sampleTable()]).getSnapshot(),
    );
    const decoded = projectDocumentTransport.fromString(source);
    const normalized = projectDocumentTransport.toString(
      new MemoryDocumentPort(decoded.blocks, decoded.metadata).getSnapshot(),
    );

    expect(normalized).toBe(source);
  });

  it("publishes writer-owned table numbering through its stable target", () => {
    const tablePlugin = createTablePlugin(inlineRegistry);
    const registry = new BuilderPluginRegistry([tablePlugin], opaqueBlockAdapter);
    const second = Object.freeze({
      ...sampleTable(),
      id: "table-two",
      referenceId: "tab:second",
    });
    const targets = deriveReferenceTargets([sampleTable(), second], registry);

    expect(targets.get("tab:runtime")?.displayText).toBe("Table 1");
    expect(targets.get("tab:second")?.displayText).toBe("Table 2");
  });

  it("exports the plain-text subset and rejects structured cell loss", () => {
    const table = sampleTable();
    expect(tableCsvCapability.serialize(table, inlineRegistry)).toBe(
      'Name,Value\n"CUDA, C++",1.25\n',
    );
    const structured = createRichTableBlock(
      "structured",
      [createParagraphText("Math", "math-caption")],
      [
        createBuilderTableRow("math-row", [
          createBuilderTableCell("math-cell", [
            createMathInline(createMathInteger(4), "math-inline"),
          ]),
        ]),
      ],
      ["center"],
    );
    expect(() => tableCsvCapability.serialize(structured, inlineRegistry)).toThrow(
      /only plain Core Text/u,
    );
  });

  it("rejects malformed semantic tables at their plugin boundary", () => {
    expect(() =>
      createRichTableBlock(
        "ragged",
        [createParagraphText("Caption", "caption-ragged")],
        [
          createBuilderTableRow("row-a", [
            createBuilderTableCell("cell-a", [
              createParagraphText("A", "cell-a-text"),
            ]),
          ]),
          createBuilderTableRow("row-b", [
            createBuilderTableCell("cell-b", [
              createParagraphText("B", "cell-b-text"),
            ]),
            createBuilderTableCell("cell-c", [
              createParagraphText("C", "cell-c-text"),
            ]),
          ]),
        ],
        ["left"],
      ),
    ).toThrow(/rectangular/u);
  });
});
