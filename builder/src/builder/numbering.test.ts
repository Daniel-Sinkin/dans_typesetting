import { describe, expect, it } from "vitest";

import {
  createParagraphText,
  paragraphTypeId,
  type BuilderBlock,
  type ParagraphBlock,
} from "../model/document";
import { BuilderInlinePluginRegistry } from "./inlinePlugin";
import { BuilderPluginRegistry } from "./plugin";
import { deriveBlockOrdinals, deriveInlineOrdinals } from "./numbering";
import { createColorSpanInline, colorSpanInlinePlugin } from "../plugins/colorSpan";
import { footnoteInlinePlugin } from "../plugins/footnote";
import { createFootnoteInline } from "../plugins/footnoteModel";
import { createItemListPlugin } from "../plugins/itemListPlugin";
import { createBuilderListItem, itemListTypeId } from "../plugins/itemListModel";
import { opaqueBlockAdapter } from "../plugins/opaque";
import { createParagraphPlugin } from "../plugins/paragraph";
import {
  opaqueInlineAdapter,
  paragraphTextInlinePlugin,
} from "../plugins/paragraphInline";

const blocks = [
  { id: "figure-a", typeId: "figure" },
  { id: "paragraph", typeId: "paragraph" },
  { id: "equation-a", typeId: "equation" },
  { id: "figure-b", typeId: "figure" },
  { id: "equation-b", typeId: "equation" },
] satisfies readonly BuilderBlock[];

describe("writer-derived block numbering", () => {
  it("maintains independent ordinal series in traversal order", () => {
    const ordinals = deriveBlockOrdinals(blocks, (block) =>
      block.typeId === "paragraph" ? null : block.typeId,
    );

    expect(ordinals.get("figure-a")?.ordinal).toBe(1);
    expect(ordinals.get("figure-b")?.ordinal).toBe(2);
    expect(ordinals.get("equation-a")?.ordinal).toBe(1);
    expect(ordinals.get("equation-b")?.ordinal).toBe(2);
    expect(ordinals.get("paragraph")?.ordinal).toBeNull();
  });

  it("renumbers immediately when traversal order changes", () => {
    const reversedFigures = [blocks[3], blocks[0]].filter(
      (block): block is BuilderBlock => block !== undefined,
    );
    const ordinals = deriveBlockOrdinals(reversedFigures, () => "figure");

    expect(ordinals.get("figure-b")?.ordinal).toBe(1);
    expect(ordinals.get("figure-a")?.ordinal).toBe(2);
  });
});

describe("writer-derived inline numbering", () => {
  it("numbers nested occurrences across independent paragraph-like block plugins", () => {
    const inlineRegistry = new BuilderInlinePluginRegistry(
      [paragraphTextInlinePlugin, colorSpanInlinePlugin, footnoteInlinePlugin],
      opaqueInlineAdapter,
    );
    const registry = new BuilderPluginRegistry(
      [createParagraphPlugin(inlineRegistry), createItemListPlugin(inlineRegistry)],
      opaqueBlockAdapter,
    );
    const first = createFootnoteInline(
      [createParagraphText("First note", "first-note-text")],
      "first-note",
    );
    const second = createFootnoteInline(
      [createParagraphText("Second note", "second-note-text")],
      "second-note",
    );
    const paragraph: ParagraphBlock = {
      id: "paragraph-with-note",
      typeId: paragraphTypeId,
      inlines: [
        createParagraphText("Nested", "paragraph-text"),
        createColorSpanInline(undefined, [first], "colour-wrapper"),
      ],
    };
    const list = {
      id: "list-with-note",
      typeId: itemListTypeId,
      presentation: "itemized",
      items: [createBuilderListItem("item", [second])],
    } as const;

    const ordinals = deriveInlineOrdinals([paragraph, list], registry);

    expect(ordinals.get(first.id)).toEqual({
      numberingSeries: "footnote",
      ordinal: 1,
    });
    expect(ordinals.get(second.id)).toEqual({
      numberingSeries: "footnote",
      ordinal: 2,
    });
  });
});
