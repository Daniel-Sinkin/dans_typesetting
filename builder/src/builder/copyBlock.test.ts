import { describe, expect, it } from "vitest";

import { BuilderPluginRegistry } from "./plugin";
import { BuilderInlinePluginRegistry } from "./inlinePlugin";
import { copyBuilderBlockForInsert } from "./copyBlock";
import { imagePlugin } from "../plugins/image";
import { opaqueBlockAdapter } from "../plugins/opaque";
import { sectionPlugin } from "../plugins/documentShell";
import {
  imageTypeId,
  createParagraphText,
  paragraphTypeId,
  sectionTypeId,
  type ImageBlock,
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

const inlineRegistry = new BuilderInlinePluginRegistry(
  [paragraphTextInlinePlugin, footnoteInlinePlugin],
  opaqueInlineAdapter,
);

const registry = new BuilderPluginRegistry(
  [imagePlugin, sectionPlugin, createParagraphPlugin(inlineRegistry)],
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
    const figure: ImageBlock = Object.freeze({
      id: "figure",
      typeId: imageTypeId,
      source: "/figure.png",
      caption: "Original figure",
      referenceId: "fig:original",
      widthFraction: 0.7,
      preferredPixelWidth: 1280,
      preferredPixelHeight: 720,
    });
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
});
