import { describe, expect, it } from "vitest";

import { MemoryDocumentPort, paragraphTypeId, type ParagraphBlock } from "../model/document";
import { projectDocumentTransport } from "../transport/projectTransport";
import {
  bibliographyTypeId,
  citationInlineTypeId,
  createBibliographyBlock,
  createBibliographyEntry,
  createCitationInline,
} from "./bibliographyModel";

function sampleEntries(): readonly [
  ReturnType<typeof createBibliographyEntry>,
  ReturnType<typeof createBibliographyEntry>,
] {
  return Object.freeze([
    createBibliographyEntry({
      id: "entry-verstraete",
      key: "Verstraete2008",
      kind: "article",
      title: "Matrix product states, projected entangled pair states",
      authors: ["Frank Verstraete", "Valentin Murg"],
      year: 2008,
      venue: "Advances in Physics",
      doi: "10.1080/14789940801912366",
      url: "https://example.com/paper",
    }),
    createBibliographyEntry({
      id: "entry-orus",
      key: "Orus2014",
      kind: "miscellaneous",
      title: "A practical introduction to tensor networks",
      authors: ["Román Orús"],
      year: 2014,
    }),
  ]);
}

describe("bibliography and citation plugins", () => {
  it("owns normalized records and rejects ambiguous identities", () => {
    const entries = sampleEntries();
    expect(entries[0]).toMatchObject({ kind: "article", year: 2008 });
    expect(Object.isFrozen(entries[0].authors)).toBe(true);
    expect(() =>
      createBibliographyBlock([entries[0], { ...entries[1], key: entries[0].key }]),
    ).toThrow(/Duplicate bibliography key/u);
    expect(() => createCitationInline(["Orus2014", "Orus2014"])).toThrow(/repeat/u);
    expect(() => createBibliographyEntry({ key: "3bad", kind: "book", title: "Bad" })).toThrow(
      /begin with an ASCII letter/u,
    );
  });

  it("round-trips records and multi-citations exactly through canonical transport", () => {
    const paragraph: ParagraphBlock = Object.freeze({
      id: "paragraph",
      typeId: paragraphTypeId,
      inlines: Object.freeze([
        createCitationInline(["Verstraete2008", "Orus2014"], "citation"),
      ]),
    });
    const source = projectDocumentTransport.toString(
      new MemoryDocumentPort([
        paragraph,
        createBibliographyBlock(sampleEntries(), "bibliography"),
      ]).getSnapshot(),
    );
    const decoded = projectDocumentTransport.fromString(source);

    expect(
      projectDocumentTransport.toString(
        new MemoryDocumentPort(decoded.blocks, decoded.metadata).getSnapshot(),
      ),
    ).toBe(source);
    expect(decoded.blocks[0]).toMatchObject({
      inlines: [{ id: "citation", typeId: citationInlineTypeId }],
    });
    expect(decoded.blocks[1]).toMatchObject({
      id: "bibliography",
      typeId: bibliographyTypeId,
      entries: [{ key: "Verstraete2008" }, { key: "Orus2014" }],
    });
  });

  it("rejects malformed canonical citation and bibliography payloads", () => {
    const envelope = (block: unknown): string =>
      JSON.stringify({
        format: "dans.typesetting.document",
        schemaVersion: 1,
        documentVersion: { major: 0, minor: 1, patch: 0 },
        blocks: [block],
      });
    expect(() =>
      projectDocumentTransport.fromString(
        envelope({
          id: "paragraph",
          type: paragraphTypeId,
          payload: {
            inlines: [
              { id: "citation", type: citationInlineTypeId, payload: { keys: [] } },
            ],
          },
        }),
      ),
    ).toThrow(/at least one key/u);
    expect(() =>
      projectDocumentTransport.fromString(
        envelope({
          id: "bibliography",
          type: bibliographyTypeId,
          payload: {
            entries: [{
              id: "entry",
              key: "key",
              title: "Missing kind",
              authors: [],
              year: null,
              venue: null,
              publisher: null,
              doi: null,
              url: null,
            }],
          },
        }),
      ),
    ).toThrow(/kind/u);
  });
});
