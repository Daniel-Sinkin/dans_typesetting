import { describe, expect, it } from "vitest";

import { copyBuilderBlockForInsert } from "../builder/copyBlock";
import { BuilderInlinePluginRegistry } from "../builder/inlinePlugin";
import { BuilderPluginRegistry } from "../builder/plugin";
import {
  createMathInline,
  createText,
  MemoryDocumentPort,
} from "../model/document";
import { createMathIdentifier } from "../model/math";
import {
  canonicalDocumentFormat,
  canonicalDocumentSchemaVersion,
} from "../transport/documentTransport";
import { projectDocumentTransport } from "../transport/projectTransport";
import { createImagePlugin } from "./image";
import {
  createImageBlock,
  imageTypeId,
  requireImageBlock,
} from "./imageModel";
import { opaqueBlockAdapter } from "./opaque";
import {
  opaqueInlineAdapter,
  textInlinePlugin,
} from "./text";

const inlineRegistry = new BuilderInlinePluginRegistry(
  [textInlinePlugin],
  opaqueInlineAdapter,
);
const imagePlugin = createImagePlugin(inlineRegistry);

function legacyFigureSource(payload: unknown): string {
  return JSON.stringify({
    format: canonicalDocumentFormat,
    schemaVersion: canonicalDocumentSchemaVersion,
    documentVersion: { major: 0, minor: 1, patch: 0 },
    blocks: [{ id: "figure", type: imageTypeId, payload }],
  });
}

describe("semantic rich figures", () => {
  it("round-trips styled and mathematical caption segments exactly", () => {
    const figure = createImageBlock(
      "figure",
      "/figure.svg",
      [
        createText("Spectrum ", "caption-text", "bold"),
        createMathInline(createMathIdentifier("E"), "caption-math"),
      ],
      "fig:spectrum",
      0.64,
      1440,
      900,
    );
    const source = projectDocumentTransport.toString(
      new MemoryDocumentPort([figure]).getSnapshot(),
    );
    const decoded = projectDocumentTransport.fromString(source);

    const decodedBlock = decoded.blocks[0];
    if (decodedBlock === undefined) {
      throw new Error("Rich figure transport did not produce a block");
    }
    expect(requireImageBlock(decodedBlock).captionInlines).toMatchObject([
      { id: "caption-text", text: "Spectrum ", style: "bold" },
      { id: "caption-math", typeId: "dans.math.inline" },
    ]);
    expect(
      projectDocumentTransport.toString(
        new MemoryDocumentPort(decoded.blocks, decoded.metadata).getSnapshot(),
      ),
    ).toBe(source);
  });

  it("normalizes a legacy string caption into one stable Core Text segment", () => {
    const decoded = projectDocumentTransport.fromString(
      legacyFigureSource({
        source: "/legacy.png",
        caption: "Legacy figure",
        referenceId: null,
        widthFraction: 0.5,
        preferredPixelWidth: 800,
        preferredPixelHeight: 600,
      }),
    );
    const block = decoded.blocks[0];
    if (block === undefined) {
      throw new Error("Legacy figure payload did not produce a block");
    }
    const figure = requireImageBlock(block);

    expect(figure.captionInlines).toMatchObject([
      { id: "figure:caption:legacy-text", text: "Legacy figure" },
    ]);
    expect(
      projectDocumentTransport.toString(
        new MemoryDocumentPort(decoded.blocks, decoded.metadata).getSnapshot(),
      ),
    ).toContain('"captionInlines"');
  });

  it("copies caption identity and clears the semantic reference target", () => {
    const registry = new BuilderPluginRegistry(
      [imagePlugin],
      opaqueBlockAdapter,
    );
    const source = createImageBlock(
      "source",
      "/source.png",
      [createText("Caption", "caption")],
      "fig:source",
    );
    const copied = requireImageBlock(
      copyBuilderBlockForInsert(source, registry, "copy"),
    );

    expect(copied.referenceId).toBeNull();
    expect(copied.captionInlines[0]?.id).not.toBe("caption");
    expect(copied.source).toBe(source.source);
  });

  it("rejects empty captions, duplicate inline IDs, and invalid dimensions", () => {
    expect(() => createImageBlock("empty", "/figure.png", [])).toThrow(
      /at least one inline/u,
    );
    expect(() =>
      createImageBlock("duplicate", "/figure.png", [
        createText("A", "same"),
        createText("B", "same"),
      ]),
    ).toThrow(/Duplicate figure caption inline ID/u);
    expect(() =>
      createImageBlock(
        "dimensions",
        "/figure.png",
        [createText("Caption")],
        null,
        0.5,
        0,
        720,
      ),
    ).toThrow(/positive integers/u);
    expect(() =>
      projectDocumentTransport.fromString(
        legacyFigureSource({
          source: "/figure.png",
          caption: "legacy",
          captionInlines: [],
          referenceId: null,
          widthFraction: 0.5,
          preferredPixelWidth: 800,
          preferredPixelHeight: 600,
        }),
      ),
    ).toThrow(/exactly one/u);
  });
});
