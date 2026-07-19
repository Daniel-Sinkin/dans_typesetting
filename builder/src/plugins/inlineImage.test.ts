import { describe, expect, it } from "vitest";

import { copyBuilderInlineForInsert } from "../builder/copyInline";
import { BuilderInlinePluginRegistry } from "../builder/inlinePlugin";
import {
  defaultDocumentMetadata,
  isParagraphBlock,
  paragraphTypeId,
  type ParagraphBlock,
} from "../model/document";
import { projectDocumentTransport } from "../transport/projectTransport";
import { inlineImagePlugin } from "./inlineImage";
import {
  createInlineImage,
  inlineImageTypeId,
  requireInlineImage,
} from "./inlineImageModel";
import { opaqueInlineAdapter } from "./text";

describe("inline-image plugin", () => {
  it("owns a source and text-relative height", () => {
    expect(createInlineImage("assets/emoji.gif", 1.25, "emoji")).toEqual({
      id: "emoji",
      typeId: inlineImageTypeId,
      source: "assets/emoji.gif",
      heightEm: 1.25,
    });
    expect(() => createInlineImage("", 1, "empty-source")).toThrow(/source/u);
    expect(() => createInlineImage("emoji.png", 0, "zero-height")).toThrow(/positive/u);
    expect(() => createInlineImage("emoji.png", Number.NaN, "nan-height")).toThrow(
      /finite/u,
    );
  });

  it("round-trips exactly through canonical transport", () => {
    const paragraph: ParagraphBlock = Object.freeze({
      id: "paragraph",
      typeId: paragraphTypeId,
      inlines: Object.freeze([
        createInlineImage("data:image/gif;base64,R0lGODlhAQABAAAAACw=", 0.9, "emoji"),
      ]),
    });
    const source = projectDocumentTransport.toString({
      revision: 0,
      metadata: defaultDocumentMetadata,
      blocks: Object.freeze([paragraph]),
    });
    const decoded = projectDocumentTransport.fromString(source);

    expect(projectDocumentTransport.toString({ ...decoded, revision: 0 })).toBe(source);
    const decodedParagraph = decoded.blocks[0];
    if (decodedParagraph === undefined || !isParagraphBlock(decodedParagraph)) {
      throw new Error("Decoded inline-image paragraph is missing");
    }
    const decodedImage = decodedParagraph.inlines[0];
    if (decodedImage === undefined) {
      throw new Error("Decoded inline-image node is missing");
    }
    expect(requireInlineImage(decodedImage)).toMatchObject({
      source: "data:image/gif;base64,R0lGODlhAQABAAAAACw=",
      heightEm: 0.9,
    });
  });

  it("copies source and sizing while refreshing identity", () => {
    const registry = new BuilderInlinePluginRegistry(
      [inlineImagePlugin],
      opaqueInlineAdapter,
    );
    const source = createInlineImage("emoji.png", 1.4, "source");

    expect(copyBuilderInlineForInsert(source, registry, "copy")).toEqual({
      ...source,
      id: "copy",
    });
  });

  it("rejects malformed canonical payloads", () => {
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
                id: "emoji",
                type: inlineImageTypeId,
                payload: { source: "emoji.png", heightEm: -1 },
              },
            ],
          },
        },
      ],
    });
    expect(() => projectDocumentTransport.fromString(invalid)).toThrow(/positive/u);
  });
});
