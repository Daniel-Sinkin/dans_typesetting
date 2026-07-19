import { describe, expect, it } from "vitest";

import {
  createHyperlinkInline,
  createParagraphText,
  MemoryDocumentPort,
  paragraphTypeId,
  type ParagraphBlock,
} from "../model/document";
import {
  canonicalDocumentFormat,
  canonicalDocumentSchemaVersion,
} from "../transport/documentTransport";
import { projectDocumentTransport } from "../transport/projectTransport";
import {
  createFootnoteInline,
  footnoteInlineTypeId,
  type FootnoteInline,
} from "./footnoteModel";

function paragraph(footnote: FootnoteInline): ParagraphBlock {
  return Object.freeze({
    id: "paragraph",
    typeId: paragraphTypeId,
    inlines: Object.freeze([
      createParagraphText("Statement", "statement"),
      footnote,
    ]),
  });
}

function sourceWithFootnotePayload(payload: unknown): string {
  return JSON.stringify({
    format: canonicalDocumentFormat,
    schemaVersion: canonicalDocumentSchemaVersion,
    documentVersion: { major: 0, minor: 1, patch: 0 },
    blocks: [
      {
        id: "paragraph",
        type: paragraphTypeId,
        payload: {
          inlines: [{ id: "note", type: footnoteInlineTypeId, payload }],
        },
      },
    ],
  });
}

describe("semantic inline footnotes", () => {
  it("round-trips styled, linked nested inline content exactly", () => {
    const note = createFootnoteInline(
      [
        createParagraphText("See ", "note-text", "italic"),
        createHyperlinkInline(
          "https://example.com/source",
          [createParagraphText("source", "source-label", "bold")],
          "source-link",
        ),
      ],
      "note",
    );
    const source = projectDocumentTransport.toString(
      new MemoryDocumentPort([paragraph(note)]).getSnapshot(),
    );
    const decoded = projectDocumentTransport.fromString(source);

    expect(
      projectDocumentTransport.toString(
        new MemoryDocumentPort(decoded.blocks, decoded.metadata).getSnapshot(),
      ),
    ).toBe(source);
  });

  it("rejects empty and directly nested footnotes", () => {
    expect(() => createFootnoteInline([], "empty")).toThrow(/at least one/u);
    const inner = createFootnoteInline(
      [createParagraphText("Inner", "inner-text")],
      "inner",
    );
    expect(() => createFootnoteInline([inner], "outer")).toThrow(/cannot directly contain/u);
  });

  it("rejects malformed canonical payloads at the plugin boundary", () => {
    expect(() =>
      projectDocumentTransport.fromString(sourceWithFootnotePayload({ inlines: [] })),
    ).toThrow(/at least one inline/u);
    expect(() =>
      projectDocumentTransport.fromString(
        sourceWithFootnotePayload({
          inlines: [
            {
              id: "nested",
              type: footnoteInlineTypeId,
              payload: {
                inlines: [
                  {
                    id: "nested-text",
                    type: "dans.core.text",
                    payload: { text: "Nested", style: "normal" },
                  },
                ],
              },
            },
          ],
        }),
      ),
    ).toThrow(/cannot directly contain/u);
  });
});
