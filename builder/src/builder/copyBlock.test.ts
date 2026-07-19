import { describe, expect, it } from "vitest";

import { BuilderPluginRegistry } from "./plugin";
import { BuilderInlinePluginRegistry } from "./inlinePlugin";
import { copyBuilderBlockForInsert } from "./copyBlock";
import { createImagePlugin } from "../plugins/image";
import { createImageBlock, type ImageBlock } from "../plugins/imageModel";
import { opaqueBlockAdapter } from "../plugins/opaque";
import { sectionPlugin } from "../plugins/documentShell";
import {
  createParagraphText,
  paragraphTypeId,
  sectionTypeId,
  type SectionBlock,
  type ParagraphBlock,
} from "../model/document";
import { footnoteInlinePlugin } from "../plugins/footnote";
import { createFootnoteInline, type FootnoteInline } from "../plugins/footnoteModel";
import { createParagraphPlugin } from "../plugins/paragraph";
import {
  opaqueInlineAdapter,
  paragraphTextInlinePlugin,
} from "../plugins/paragraphInline";
import {
  createBuilderTableCell,
  createBuilderTableRow,
  createRichTableBlock,
  type RichTableBlock,
} from "../plugins/tableModel";
import { createTablePlugin } from "../plugins/tablePlugin";

const inlineRegistry = new BuilderInlinePluginRegistry(
  [paragraphTextInlinePlugin, footnoteInlinePlugin],
  opaqueInlineAdapter,
);
const imagePlugin = createImagePlugin(inlineRegistry);

const registry = new BuilderPluginRegistry(
  [
    imagePlugin,
    sectionPlugin,
    createParagraphPlugin(inlineRegistry),
    createTablePlugin(inlineRegistry),
  ],
  opaqueBlockAdapter,
);

describe("plugin-aware block copies", () => {
  it("copies unknown envelopes without inspecting or losing opaque payload", () => {
    const payload = { nested: { value: 42 } };
    const copied = copyBuilderBlockForInsert(
      {
        id: "unknown",
        typeId: "dans.future.block",
        opaquePayload: payload,
      },
      registry,
      "unknown-copy",
    );

    expect(copied).toEqual({
      id: "unknown-copy",
      typeId: "dans.future.block",
      opaquePayload: payload,
    });
    expect(copied.opaquePayload).toBe(payload);
  });

  it("gives copied trees fresh block IDs and clears semantic target IDs", () => {
    const figure: ImageBlock = createImageBlock(
      "figure",
      "/figure.png",
      [createParagraphText("Original figure", "figure-caption")],
      "fig:original",
      0.7,
    );
    const source: SectionBlock = Object.freeze({
      id: "section",
      typeId: sectionTypeId,
      title: "Original section",
      referenceId: "sec:original",
      blocks: Object.freeze([figure]),
    });

    const copied = copyBuilderBlockForInsert(source, registry, "section-copy");

    expect(copied).toMatchObject({ id: "section-copy", referenceId: null });
    const copiedSection = copied as SectionBlock;
    expect(copiedSection.blocks[0]).toMatchObject({ referenceId: null });
    expect(copiedSection.blocks[0]?.id).not.toBe(figure.id);
    const copiedFigure = copiedSection.blocks[0] as ImageBlock;
    expect(copiedFigure.captionInlines[0]?.id).not.toBe("figure-caption");
  });

  it("refreshes nested inline IDs through paragraph and footnote copy hooks", () => {
    const note = createFootnoteInline(
      [createParagraphText("Note", "note-text")],
      "note",
    );
    const paragraph: ParagraphBlock = Object.freeze({
      id: "paragraph",
      typeId: paragraphTypeId,
      inlines: Object.freeze([
        createParagraphText("Statement", "statement"),
        note,
      ]),
    });

    const copied = copyBuilderBlockForInsert(
      paragraph,
      registry,
      "paragraph-copy",
    ) as ParagraphBlock;
    const copiedNote = copied.inlines[1] as FootnoteInline;

    expect(copied.inlines.map(({ id }) => id)).not.toEqual(
      paragraph.inlines.map(({ id }) => id),
    );
    expect(copiedNote.inlines[0]?.id).not.toBe(note.inlines[0]?.id);
  });

  it("copies rich table structure while clearing target and nested identity", () => {
    const source = createRichTableBlock(
      "table",
      [createParagraphText("Caption", "caption")],
      [
        createBuilderTableRow("row", [
          createBuilderTableCell("cell", [
            createParagraphText("Value", "value"),
          ]),
        ]),
      ],
      ["left"],
      0,
      "tab:source",
    );

    const copied = copyBuilderBlockForInsert(
      source,
      registry,
      "table-copy",
    ) as RichTableBlock;

    expect(copied.referenceId).toBeNull();
    expect(copied.rows[0]?.id).not.toBe(source.rows[0]?.id);
    expect(copied.rows[0]?.cells[0]?.id).not.toBe(
      source.rows[0]?.cells[0]?.id,
    );
    expect(copied.rows[0]?.cells[0]?.inlines[0]?.id).not.toBe(
      source.rows[0]?.cells[0]?.inlines[0]?.id,
    );
  });
});
