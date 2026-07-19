import { describe, expect, it, vi } from "vitest";

import {
  createHyperlinkInline,
  createMathDisplayLine,
  createMathInline,
  createText,
  createReferenceInline,
  defaultDocumentMetadata,
  mathDisplayTypeId,
  MemoryDocumentPort,
  paragraphTypeId,
  type BuilderBlock,
  type MathDisplayBlock,
  type ParagraphBlock,
} from "../model/document";
import {
  createMathBinary,
  createMathIdentifier,
  createMathInteger,
} from "../model/math";
import { createColorSpanInline } from "../plugins/colorSpanModel";
import { createImageBlock } from "../plugins/imageModel";
import {
  figurePairTypeId,
  requireFigurePairBlock,
} from "../plugins/figurePairModel";
import {
  canonicalDocumentFormat,
  CanonicalDocumentTransport,
  DocumentTransportRegistry,
} from "./documentTransport";
import { projectDocumentTransport } from "./projectTransport";
import conformanceFixture from "../../../fixtures/canonical/current-features.dans_doc?raw";

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
      createText("Styled", "text", "bold_italic"),
      createColorSpanInline(
        { red: 12, green: 34, blue: 56 },
        [createText(" colour", "colour-text")],
        "colour",
      ),
      createMathInline(expression, "inline-math"),
      createHyperlinkInline(
        "https://example.com/results",
        [createText(" results", "link-text", "italic")],
        "link",
      ),
      createReferenceInline("fig:representative", "reference"),
      {
        id: "future-inline",
        typeId: "dans.future.inline",
        label: "Future inline",
        opaquePayload: { enabled: true, nested: [1, "two"] },
      },
    ],
  };
  const figure = createImageBlock(
    "figure",
    "/figure.png",
    [createText("A figure", "figure-caption", "bold")],
    "fig:representative",
    0.7,
  );
  const equation = {
    id: "equation",
    typeId: mathDisplayTypeId,
    alignment: "automatic",
    lines: [
      createMathDisplayLine(
        expression,
        true,
        "eq:representative",
        "equation-line",
      ),
    ],
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
    const pair = decoded.blocks.find((block) => block.typeId === figurePairTypeId);
    if (pair === undefined) {
      throw new Error("The shared fixture lost its figure-pair block");
    }
    expect(requireFigurePairBlock(pair).referenceId).toBeNull();
    expect(requireFigurePairBlock(pair).panels[0].referenceId).toBe(
      "fig:canonical-pair:left",
    );
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

  it("normalizes the legacy one-expression display payload into one numbered line", () => {
    const source = `${JSON.stringify({
      format: canonicalDocumentFormat,
      schemaVersion: 1,
      documentVersion: { major: 0, minor: 1, patch: 0 },
      blocks: [
        {
          id: "legacy-display",
          type: mathDisplayTypeId,
          payload: {
            expression: { kind: "integer", value: "0042" },
            referenceId: "eq:legacy",
          },
        },
      ],
    })}\n`;

    const decoded = projectDocumentTransport.fromString(source);
    const display = decoded.blocks[0] as MathDisplayBlock;
    expect(display.alignment).toBe("automatic");
    expect(display.lines).toEqual([
      expect.objectContaining({
        id: "legacy-display:line:0",
        numbered: true,
        referenceId: "eq:legacy",
      }),
    ]);
    const normalized = JSON.parse(
      projectDocumentTransport.toString(
        new MemoryDocumentPort(decoded.blocks, decoded.metadata).getSnapshot(),
      ),
    ) as { blocks: { payload: Record<string, unknown> }[] };
    expect(normalized.blocks[0]?.payload).toMatchObject({
      alignment: "automatic",
      lines: [
        {
          id: "legacy-display:line:0",
          numbered: true,
          referenceId: "eq:legacy",
        },
      ],
    });
    expect(normalized.blocks[0]?.payload).not.toHaveProperty("expression");
  });

  it("rejects ambiguous or unreferenceable display-line payloads", () => {
    const documentWithPayload = (payload: unknown): string =>
      `${JSON.stringify({
        format: canonicalDocumentFormat,
        schemaVersion: 1,
        documentVersion: { major: 0, minor: 1, patch: 0 },
        blocks: [{ id: "display", type: mathDisplayTypeId, payload }],
      })}\n`;
    const expression = { kind: "integer", value: "1" };

    expect(() =>
      projectDocumentTransport.fromString(
        documentWithPayload({
          expression,
          lines: [],
          referenceId: null,
        }),
      ),
    ).toThrow(/cannot mix ordered lines with legacy expression fields/u);
    expect(() =>
      projectDocumentTransport.fromString(
        documentWithPayload({
          alignment: "automatic",
          lines: [
            {
              id: "line",
              expression,
              numbered: false,
              referenceId: "eq:impossible",
            },
          ],
        }),
      ),
    ).toThrow(/unnumbered display-math line cannot expose a reference ID/u);
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
