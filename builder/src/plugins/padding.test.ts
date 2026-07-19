import { describe, expect, it } from "vitest";

import {
  createText,
  MemoryDocumentPort,
  paragraphTypeId,
  type BuilderBlock,
} from "../model/document";
import { projectDocumentTransport } from "../transport/projectTransport";
import {
  createPaddingBlock,
  paddingContent,
  requirePaddingBlock,
} from "./paddingModel";

function paragraph(id: string): BuilderBlock {
  return Object.freeze({
    id,
    typeId: paragraphTypeId,
    inlines: Object.freeze([createText(`Nested ${id}`, `${id}:text`)]),
  });
}

describe("semantic Padding", () => {
  it("round-trips nested content and em insets exactly", () => {
    const source = projectDocumentTransport.toString(
      new MemoryDocumentPort([
        createPaddingBlock(
          "padding",
          { topEm: 1.25, rightEm: 2, bottomEm: 3.5, leftEm: 4 },
          [paragraph("inside")],
        ),
      ]).getSnapshot(),
    );
    const decoded = projectDocumentTransport.fromString(source);
    const normalized = projectDocumentTransport.toString(
      new MemoryDocumentPort(decoded.blocks, decoded.metadata).getSnapshot(),
    );
    const block = decoded.blocks[0];
    if (block === undefined) {
      throw new Error("Padding transport lost its block");
    }
    const padding = requirePaddingBlock(block);

    expect(normalized).toBe(source);
    expect(padding.insets).toEqual({
      topEm: 1.25,
      rightEm: 2,
      bottomEm: 3.5,
      leftEm: 4,
    });
    expect(paddingContent(padding).map(({ id }) => id)).toEqual(["inside"]);
  });

  it("rejects negative, non-finite, and malformed nested payloads", () => {
    expect(() =>
      createPaddingBlock(
        "negative",
        { topEm: -1, rightEm: 0, bottomEm: 0, leftEm: 0 },
      ),
    ).toThrow(/finite non-negative/u);
    expect(() =>
      createPaddingBlock(
        "infinite",
        { topEm: 0, rightEm: Number.POSITIVE_INFINITY, bottomEm: 0, leftEm: 0 },
      ),
    ).toThrow(/finite non-negative/u);

    const encoded = JSON.parse(
      projectDocumentTransport.toString(
        new MemoryDocumentPort([
          createPaddingBlock(
            "padding",
            { topEm: 1, rightEm: 1, bottomEm: 1, leftEm: 1 },
          ),
        ]).getSnapshot(),
      ),
    ) as { blocks: { payload: { blocks: unknown } }[] };
    const encodedBlock = encoded.blocks[0];
    if (encodedBlock === undefined) {
      throw new Error("Padding test fixture lost its encoded block");
    }
    encodedBlock.payload.blocks = "not-an-array";
    expect(() =>
      projectDocumentTransport.fromString(JSON.stringify(encoded)),
    ).toThrow(/must be an array/u);
  });
});
