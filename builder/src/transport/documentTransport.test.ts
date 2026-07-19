import { describe, expect, it, vi } from "vitest";

import {
  createHyperlinkInline,
  createMathInline,
  createParagraphText,
  defaultDocumentMetadata,
  imageTypeId,
  mathDisplayTypeId,
  MemoryDocumentPort,
  paragraphTypeId,
  type BuilderBlock,
  type ImageBlock,
  type MathDisplayBlock,
  type ParagraphBlock,
} from "../model/document";
import {
  createMathBinary,
  createMathIdentifier,
  createMathInteger,
} from "../model/math";
import { createColorSpanInline } from "../plugins/colorSpanModel";
import {
  canonicalDocumentFormat,
  CanonicalDocumentTransport,
  DocumentTransportRegistry,
} from "./documentTransport";
import { projectDocumentTransport } from "./projectTransport";
import conformanceFixture from "../../../fixtures/canonical/current-features.dans.json?raw";

function representativeBlocks(): readonly BuilderBlock[] {
  const expression = createMathBinary(
    "equals",
    createMathIdentifier("E"),
    createMathInteger(4),
  );
  const paragraph: ParagraphBlock = {
    id: "intro",
    typeId: paragraphTypeId,
    inlines: [
      createParagraphText("Styled", "text", "bold_italic"),
      createColorSpanInline(
        { red: 12, green: 34, blue: 56 },
        [createParagraphText(" colour", "colour-text")],
        "colour",
      ),
      createMathInline(expression, "inline-math"),
      createHyperlinkInline(
        "https://example.com/results",
        [createParagraphText(" results", "link-text", "italic")],
        "link",
      ),
      {
        id: "future-inline",
        typeId: "dans.future.inline",
        label: "Future inline",
        opaquePayload: { enabled: true, nested: [1, "two"] },
      },
    ],
  };
  const figure = {
    id: "figure",
    typeId: imageTypeId,
    source: "/figure.png",
    caption: "A figure",
    widthFraction: 0.7,
    preferredPixelWidth: 1280,
    preferredPixelHeight: 720,
  } satisfies ImageBlock;
  const equation = {
    id: "equation",
    typeId: mathDisplayTypeId,
    expression,
  } satisfies MathDisplayBlock;
  return [
    paragraph,
    figure,
    equation,
    {
      id: "future-block",
      typeId: "dans.future.block",
      opaquePayload: { rows: [{ value: 42 }], note: null },
    },
  ];
}

describe("canonical document transport", () => {
  it("round-trips the shared cross-language conformance fixture exactly", () => {
    const decoded = projectDocumentTransport.fromString(conformanceFixture);
    const normalizedFixture = conformanceFixture.endsWith("\n")
      ? conformanceFixture
      : `${conformanceFixture}\n`;
    expect(
      projectDocumentTransport.toString(
        new MemoryDocumentPort(decoded.blocks, decoded.metadata).getSnapshot(),
      ),
    ).toBe(normalizedFixture);
  });

  it("is exactly idempotent after normalization and preserves unknown payloads", () => {
    const port = new MemoryDocumentPort(representativeBlocks());
    const serialized = projectDocumentTransport.toString(port.getSnapshot());
    const decoded = projectDocumentTransport.fromString(serialized);
    const restored = new MemoryDocumentPort(decoded.blocks, decoded.metadata);

    expect(projectDocumentTransport.toString(restored.getSnapshot())).toBe(serialized);
    expect(JSON.parse(serialized)).toMatchObject({
      format: canonicalDocumentFormat,
      schemaVersion: 1,
      documentVersion: { major: 0, minor: 1, patch: 0 },
    });
    expect(decoded.blocks.at(-1)?.opaquePayload).toEqual({
      rows: [{ value: 42 }],
      note: null,
    });
    const decodedParagraph = decoded.blocks[0] as ParagraphBlock;
    expect(decodedParagraph.inlines.at(-1)?.opaquePayload).toEqual({
      enabled: true,
      nested: [1, "two"],
    });
  });

  it("treats unregistered types as opaque without knowing their payload schema", () => {
    const transport = new CanonicalDocumentTransport(
      new DocumentTransportRegistry([], []),
    );
    const source = `${JSON.stringify({
      format: canonicalDocumentFormat,
      schemaVersion: 1,
      documentVersion: { major: 7, minor: 8, patch: 9 },
      blocks: [
        { id: "plugin", type: "third.party.block", payload: { arbitrary: [1, 2, 3] } },
      ],
    })}\n`;
    const decoded = transport.fromString(source);

    expect(decoded.metadata.modelVersion).toEqual({ major: 7, minor: 8, patch: 9 });
    expect(decoded.blocks[0]).toEqual({
      id: "plugin",
      typeId: "third.party.block",
      opaquePayload: { arbitrary: [1, 2, 3] },
    });
    expect(transport.fromString(transport.toString(new MemoryDocumentPort(
      decoded.blocks,
      decoded.metadata,
    ).getSnapshot())).blocks[0]?.opaquePayload).toEqual({ arbitrary: [1, 2, 3] });
  });

  it("rejects malformed envelopes, unsafe plugin payloads, and invalid decoded models", () => {
    expect(() => projectDocumentTransport.fromString("not json")).toThrow(/valid JSON/u);
    expect(() =>
      projectDocumentTransport.fromString(
        '{"format":"dans.typesetting.document","schemaVersion":2}',
      ),
    ).toThrow(/schema version/u);
    expect(() =>
      projectDocumentTransport.toString({
        revision: 0,
        metadata: defaultDocumentMetadata,
        blocks: [
          {
            id: "future",
            typeId: "future",
            opaquePayload: { invalid: Number.NaN },
          },
        ],
      }),
    ).toThrow(/non-finite/u);
    expect(() =>
      projectDocumentTransport.fromString(
        JSON.stringify({
          format: canonicalDocumentFormat,
          schemaVersion: 1,
          documentVersion: { major: 65_536, minor: 0, patch: 0 },
          blocks: [],
        }),
      ),
    ).toThrow(/major/u);
    expect(() =>
      projectDocumentTransport.toString({
        revision: 0,
        metadata: {
          modelVersion: { major: 0, minor: 0, patch: 4_294_967_296 },
        },
        blocks: [],
      }),
    ).toThrow(/patch/u);
  });

  it("loads a complete document through one transactional port notification", () => {
    const firstBlock = representativeBlocks()[0];
    if (firstBlock === undefined) {
      throw new Error("Representative transport fixture must contain a block");
    }
    const port = new MemoryDocumentPort([firstBlock]);
    const listener = vi.fn();
    port.subscribe(listener);
    const decoded = projectDocumentTransport.fromString(
      projectDocumentTransport.toString(
        new MemoryDocumentPort(representativeBlocks()).getSnapshot(),
      ),
    );

    port.dispatch({ kind: "replace_all", ...decoded });

    expect(port.getSnapshot().blocks).toHaveLength(4);
    expect(port.getSnapshot().revision).toBe(1);
    expect(listener).toHaveBeenCalledOnce();
  });
});
