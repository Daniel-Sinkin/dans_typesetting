// builder/src/model/document.test.ts — verify document-port command invariants.
import { describe, expect, it, vi } from "vitest";

import {
  createParagraphText,
  MemoryDocumentPort,
  paragraphTypeId,
  replaceBuilderBlockInTree,
  sectionTypeId,
  type BuilderBlock,
  type ParagraphBlock,
  type SectionBlock,
} from "./document";

function paragraph(id: string): ParagraphBlock {
  return {
    id,
    typeId: paragraphTypeId,
    inlines: [createParagraphText(`Paragraph ${id}`, `${id}-text`)],
  };
}

function section(id: string, blocks: readonly BuilderBlock[] = []): SectionBlock {
  return {
    id,
    typeId: sectionTypeId,
    title: `Section ${id}`,
    referenceId: `sec:${id}`,
    blocks,
  };
}

describe("MemoryDocumentPort", () => {
  it("publishes an immutable snapshot after insertion", () => {
    const port = new MemoryDocumentPort([paragraph("one")]);
    const listener = vi.fn();
    port.subscribe(listener);

    port.dispatch({ kind: "insert", index: 1, block: paragraph("two") });

    expect(port.getSnapshot().revision).toBe(1);
    expect(port.getSnapshot().blocks.map((block) => block.id)).toEqual(["one", "two"]);
    expect(Object.isFrozen(port.getSnapshot().blocks)).toBe(true);
    expect(listener).toHaveBeenCalledOnce();
  });

  it("rejects invalid positions and duplicate stable IDs", () => {
    const port = new MemoryDocumentPort([paragraph("one")]);

    expect(() => {
      port.dispatch({ kind: "insert", index: 2, block: paragraph("two") });
    }).toThrow(RangeError);
    expect(() => {
      port.dispatch({ kind: "insert", index: 1, block: paragraph("one") });
    }).toThrow(/Duplicate document block ID/);
  });

  it("moves a stable block relative to the remaining sequence", () => {
    const port = new MemoryDocumentPort([
      paragraph("one"),
      paragraph("two"),
      paragraph("three"),
    ]);

    port.dispatch({ kind: "move", blockId: "one", index: 2 });

    expect(port.getSnapshot().revision).toBe(1);
    expect(port.getSnapshot().blocks.map((block) => block.id)).toEqual([
      "two",
      "three",
      "one",
    ]);
  });

  it("does not publish a no-op move and deletes by stable ID", () => {
    const port = new MemoryDocumentPort([paragraph("one"), paragraph("two")]);
    const listener = vi.fn();
    port.subscribe(listener);

    port.dispatch({ kind: "move", blockId: "one", index: 0 });
    expect(port.getSnapshot().revision).toBe(0);
    expect(listener).not.toHaveBeenCalled();

    port.dispatch({ kind: "delete", blockId: "one" });
    expect(port.getSnapshot().revision).toBe(1);
    expect(port.getSnapshot().blocks.map((block) => block.id)).toEqual(["two"]);
    expect(listener).toHaveBeenCalledOnce();
  });

  it("rejects unknown block handles", () => {
    const port = new MemoryDocumentPort([paragraph("one")]);

    expect(() => {
      port.dispatch({ kind: "move", blockId: "missing", index: 0 });
    }).toThrow(/Unknown document block ID/);
    expect(() => {
      port.dispatch({ kind: "delete", blockId: "missing" });
    }).toThrow(/Unknown document block ID/);
    expect(() => {
      port.dispatch({ kind: "replace", blockId: "missing", block: paragraph("missing") });
    }).toThrow(/Unknown document block ID/);
  });

  it("replaces editable payload while preserving block identity and type", () => {
    const port = new MemoryDocumentPort([paragraph("one")]);
    const replacement = {
      ...paragraph("one"),
      inlines: [createParagraphText("Edited", "edited-text")],
    };

    port.dispatch({ kind: "replace", blockId: "one", block: replacement });

    expect(port.getSnapshot().revision).toBe(1);
    expect(port.getSnapshot().blocks[0]).toMatchObject(replacement);
    expect(() => {
      port.dispatch({
        kind: "replace",
        blockId: "one",
        block: { id: "different", typeId: "unknown" },
      });
    }).toThrow(/preserve its block ID and semantic type/);
  });

  it("preserves an unknown block envelope for a writer fallback", () => {
    const port = new MemoryDocumentPort([
      { id: "future", typeId: "dans.future.block", opaquePayload: { rows: 2 } },
    ]);

    expect(port.getSnapshot().blocks[0]).toMatchObject({
      id: "future",
      typeId: "dans.future.block",
      opaquePayload: { rows: 2 },
    });
  });

  it("edits recursive section sequences without flattening their ownership", () => {
    const port = new MemoryDocumentPort([
      section("outer", [paragraph("inside")]),
      paragraph("after"),
    ]);

    port.dispatch({
      kind: "insert",
      parentId: "outer",
      index: 1,
      block: paragraph("inserted"),
    });
    port.dispatch({
      kind: "move",
      blockId: "after",
      parentId: "outer",
      index: 2,
    });

    const outer = port.getSnapshot().blocks[0];
    expect(outer?.typeId).toBe(sectionTypeId);
    expect((outer as SectionBlock).blocks.map((block) => block.id)).toEqual([
      "inside",
      "inserted",
      "after",
    ]);
    expect(port.getSnapshot().blocks).toHaveLength(1);
  });

  it("rejects recursive duplicate IDs and moving a section into itself", () => {
    expect(() =>
      new MemoryDocumentPort([
        section("outer", [paragraph("duplicate")]),
        paragraph("duplicate"),
      ]),
    ).toThrow(/Duplicate document block ID/u);

    const port = new MemoryDocumentPort([
      section("outer", [section("inner", [paragraph("leaf")])]),
    ]);
    expect(() => {
      port.dispatch({
        kind: "move",
        blockId: "outer",
        parentId: "inner",
        index: 0,
      });
    }).toThrow(/descendants/u);
    expect(() => {
      port.dispatch({
        kind: "move",
        blockId: "outer",
        parentId: "outer",
        index: 0,
      });
    }).toThrow(/inside itself/u);
  });

  it("projects an editor draft into a recursive tree without publishing it", () => {
    const original = section("outer", [paragraph("inside")]);
    const replacement = {
      ...paragraph("inside"),
      inlines: [createParagraphText("Draft preview", "inside-text")],
    } satisfies ParagraphBlock;
    const projected = replaceBuilderBlockInTree([original], "inside", replacement);

    expect((projected[0] as SectionBlock).blocks[0]).toBe(replacement);
    expect((original.blocks[0] as ParagraphBlock).inlines[0]).toMatchObject({
      text: "Paragraph inside",
    });
  });
});
