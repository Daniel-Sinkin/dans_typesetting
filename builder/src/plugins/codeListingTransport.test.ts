import { describe, expect, it } from "vitest";

import {
  codeListingTypeId,
  MemoryDocumentPort,
  type CodeListingBlock,
} from "../model/document";
import {
  canonicalDocumentFormat,
  canonicalDocumentSchemaVersion,
} from "../transport/documentTransport";
import { projectDocumentTransport } from "../transport/projectTransport";

function canonicalSource(payload: unknown): string {
  return JSON.stringify({
    format: canonicalDocumentFormat,
    schemaVersion: canonicalDocumentSchemaVersion,
    documentVersion: { major: 0, minor: 1, patch: 0 },
    blocks: [{ id: "listing", type: codeListingTypeId, payload }],
  });
}

describe("code-listing canonical transport", () => {
  it.each([
    ["cpp", "C++ caption", "lst:cpp"],
    ["cuda", null, "lst:cuda"],
    ["julia", "Julia caption", null],
    ["raw", null, null],
  ] as const)(
    "round-trips %s with independent optional caption/reference metadata",
    (language, caption, referenceId) => {
      const block: CodeListingBlock = Object.freeze({
        id: `listing-${language}`,
        typeId: codeListingTypeId,
        language,
        code: `${language} source`,
        caption,
        referenceId,
      });
      const source = projectDocumentTransport.toString(
        new MemoryDocumentPort([block]).getSnapshot(),
      );
      const decoded = projectDocumentTransport.fromString(source);

      expect(decoded.blocks).toEqual([block]);
      expect(
        projectDocumentTransport.toString(
          new MemoryDocumentPort(decoded.blocks, decoded.metadata).getSnapshot(),
        ),
      ).toBe(source);
    },
  );

  it("accepts an omitted legacy caption as absent", () => {
    const decoded = projectDocumentTransport.fromString(
      canonicalSource({ language: "raw", code: "notes", referenceId: null }),
    );
    expect(decoded.blocks[0]).toMatchObject({ caption: null, language: "raw" });
  });

  it("rejects unknown languages and malformed optional captions", () => {
    expect(() =>
      projectDocumentTransport.fromString(
        canonicalSource({
          language: "python",
          code: "print(1)",
          caption: null,
          referenceId: null,
        }),
      ),
    ).toThrow(/Unsupported code-listing language/u);
    expect(() =>
      projectDocumentTransport.fromString(
        canonicalSource({
          language: "raw",
          code: "notes",
          caption: 42,
          referenceId: null,
        }),
      ),
    ).toThrow(/caption must be a string or null/u);
  });
});
