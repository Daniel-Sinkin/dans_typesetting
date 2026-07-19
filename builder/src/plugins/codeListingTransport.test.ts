import { describe, expect, it } from "vitest";

import { createText, MemoryDocumentPort } from "../model/document";
import {
  canonicalDocumentFormat,
  canonicalDocumentSchemaVersion,
} from "../transport/documentTransport";
import { projectDocumentTransport } from "../transport/projectTransport";
import {
  codeListingTypeId,
  createCodeListingBlock,
  requireCodeListingBlock,
} from "./codeListingModel";

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
    "round-trips %s with independent rich caption/reference metadata",
    (language, caption, referenceId) => {
      const block = createCodeListingBlock(
        `listing-${language}`,
        language,
        `${language} source`,
        caption === null
          ? null
          : [
              createText(
                caption,
                `listing-${language}-caption`,
                "bold_italic",
              ),
            ],
        referenceId,
      );
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

  it("normalizes omitted and string-based legacy captions", () => {
    const omitted = projectDocumentTransport.fromString(
      canonicalSource({ language: "raw", code: "notes", referenceId: null }),
    );
    const omittedBlock = omitted.blocks[0];
    if (omittedBlock === undefined) {
      throw new Error("Legacy listing payload did not produce a block");
    }
    expect(requireCodeListingBlock(omittedBlock)).toMatchObject({
      captionInlines: null,
      language: "raw",
    });

    const stringCaption = projectDocumentTransport.fromString(
      canonicalSource({
        language: "cpp",
        code: "int value;",
        caption: "Legacy caption",
        referenceId: null,
      }),
    );
    const stringCaptionBlock = stringCaption.blocks[0];
    if (stringCaptionBlock === undefined) {
      throw new Error("Legacy listing caption did not produce a block");
    }
    expect(
      requireCodeListingBlock(stringCaptionBlock).captionInlines,
    ).toMatchObject([{ text: "Legacy caption", style: "normal" }]);
    expect(
      projectDocumentTransport.toString(
        new MemoryDocumentPort(
          stringCaption.blocks,
          stringCaption.metadata,
        ).getSnapshot(),
      ),
    ).toContain('"captionInlines"');
  });

  it("rejects unknown languages and ambiguous or malformed captions", () => {
    expect(() =>
      projectDocumentTransport.fromString(
        canonicalSource({
          language: "python",
          code: "print(1)",
          captionInlines: null,
          referenceId: null,
        }),
      ),
    ).toThrow(/Unsupported code-listing language/u);
    expect(() =>
      projectDocumentTransport.fromString(
        canonicalSource({
          language: "raw",
          code: "notes",
          caption: "legacy",
          captionInlines: [],
          referenceId: null,
        }),
      ),
    ).toThrow(/exactly one/u);
    expect(() =>
      projectDocumentTransport.fromString(
        canonicalSource({
          language: "raw",
          code: "notes",
          captionInlines: 42,
          referenceId: null,
        }),
      ),
    ).toThrow(/must be an array/u);
  });
});
