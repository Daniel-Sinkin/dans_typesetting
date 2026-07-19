import { describe, expect, it } from "vitest";

import {
  defaultDocumentMetadata,
  paragraphTypeId,
  type ParagraphBlock,
} from "../model/document";
import { projectDocumentTransport } from "../transport/projectTransport";
import {
  createInlineCode,
  inlineCodeTypeId,
  requireInlineCode,
} from "./inlineCodeModel";

describe("inline-code plugin", () => {
  it("owns a single semantic source line", () => {
    const inline = createInlineCode("std::span<const float>", "inline-code");
    expect(inline).toEqual({
      id: "inline-code",
      typeId: inlineCodeTypeId,
      code: "std::span<const float>",
    });
    expect(() => createInlineCode("first\nsecond", "bad-code")).toThrow(/line break/u);
    expect(() =>
      requireInlineCode(
        Object.freeze({ id: "bad-code", typeId: inlineCodeTypeId, code: "a\rb" }),
      ),
    ).toThrow(/cannot consume/u);
  });

  it("round-trips exactly through canonical transport", () => {
    const paragraph: ParagraphBlock = Object.freeze({
      id: "paragraph",
      typeId: paragraphTypeId,
      inlines: Object.freeze([createInlineCode("kernel<<<1, 32>>>()", "code")]),
    });
    const serialized = projectDocumentTransport.toString({
      revision: 0,
      metadata: defaultDocumentMetadata,
      blocks: Object.freeze([paragraph]),
    });
    const decoded = projectDocumentTransport.fromString(serialized);
    expect(projectDocumentTransport.toString({ ...decoded, revision: 0 })).toBe(serialized);
  });

  it("rejects multiline canonical payloads", () => {
    const invalid = JSON.stringify({
      format: "dans.typesetting.document",
      schemaVersion: 1,
      documentVersion: { major: 0, minor: 1, patch: 0 },
      blocks: [
        {
          id: "paragraph",
          type: paragraphTypeId,
          payload: {
            inlines: [
              {
                id: "code",
                type: inlineCodeTypeId,
                payload: { code: "first\nsecond" },
              },
            ],
          },
        },
      ],
    });
    expect(() => projectDocumentTransport.fromString(invalid)).toThrow(/line break/u);
  });
});
