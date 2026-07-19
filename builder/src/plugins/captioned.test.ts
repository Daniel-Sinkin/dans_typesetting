import { describe, expect, it } from "vitest";

import { copyBuilderBlockForInsert } from "../builder/copyBlock";
import { BuilderInlinePluginRegistry } from "../builder/inlinePlugin";
import { BuilderPluginRegistry } from "../builder/plugin";
import { deriveReferenceTargets } from "../builder/referenceTargets";
import { createText, MemoryDocumentPort } from "../model/document";
import { projectDocumentTransport } from "../transport/projectTransport";
import { createCaptionedPlugin } from "./captioned";
import {
  captionedContent,
  createCaptionedBlock,
  requireCaptionedBlock,
} from "./captionedModel";
import { createImagePlugin } from "./image";
import { opaqueBlockAdapter } from "./opaque";
import { pythonPlotPlugin } from "./pythonPlot";
import { createPythonPlotBlock } from "./pythonPlotModel";
import { opaqueInlineAdapter, textInlinePlugin } from "./text";

const inlineRegistry = new BuilderInlinePluginRegistry(
  [textInlinePlugin],
  opaqueInlineAdapter,
);
const captionedPlugin = createCaptionedPlugin(
  inlineRegistry,
  (id) => createPythonPlotBlock(id),
);
const imagePlugin = createImagePlugin(inlineRegistry);
const registry = new BuilderPluginRegistry(
  [captionedPlugin, pythonPlotPlugin, imagePlugin],
  opaqueBlockAdapter,
);

function sampleCaptioned() {
  return createCaptionedBlock(
    "captioned",
    createPythonPlotBlock(
      "plot",
      "figure, axis = plt.subplots()\naxis.plot([0, 1], [1, 0])",
      0.75,
      960,
      540,
    ),
    "Figure",
    [createText("Generated result", "caption-text", "italic")],
    "fig:generated",
  );
}

describe("generic Captioned wrappers", () => {
  it("round-trips its category, rich caption, and nested block exactly", () => {
    const source = projectDocumentTransport.toString(
      new MemoryDocumentPort([
        sampleCaptioned(),
        createCaptionedBlock(
          "unnumbered",
          createPythonPlotBlock("unnumbered-plot"),
          null,
          [],
        ),
      ]).getSnapshot(),
    );
    const decoded = projectDocumentTransport.fromString(source);
    const normalized = projectDocumentTransport.toString(
      new MemoryDocumentPort(decoded.blocks, decoded.metadata).getSnapshot(),
    );
    const decodedCaptioned = decoded.blocks[0];
    if (decodedCaptioned === undefined) {
      throw new Error("Captioned transport lost its first block");
    }

    expect(normalized).toBe(source);
    expect(requireCaptionedBlock(decodedCaptioned)).toMatchObject({
      category: "Figure",
      referenceId: "fig:generated",
      captionInlines: [{ id: "caption-text", style: "italic" }],
    });
    expect(captionedContent(requireCaptionedBlock(decodedCaptioned)).id).toBe(
      "plot",
    );
  });

  it("shares string-keyed numbering with existing Figure plugins", () => {
    const ordinary = Object.freeze({
      ...imagePlugin.createDefault("ordinary"),
      referenceId: "fig:ordinary",
    });
    const targets = deriveReferenceTargets(
      [ordinary, sampleCaptioned()],
      registry,
    );

    expect(targets.get("fig:ordinary")?.displayText).toBe("Figure 1");
    expect(targets.get("fig:generated")?.displayText).toBe("Figure 2");
  });

  it("deep-copies content while clearing reference and inline identities", () => {
    const copied = requireCaptionedBlock(
      copyBuilderBlockForInsert(sampleCaptioned(), registry, "captioned-copy"),
    );

    expect(copied.referenceId).toBeNull();
    expect(copied.captionInlines[0]?.id).not.toBe("caption-text");
    expect(captionedContent(copied).id).not.toBe("plot");
  });

  it("rejects unnumbered references and malformed child cardinality", () => {
    expect(() =>
      createCaptionedBlock(
        "invalid-reference",
        createPythonPlotBlock("plot"),
        null,
        [],
        "fig:invalid",
      ),
    ).toThrow(/unnumbered/u);
    expect(() => createCaptionedBlock(
      "invalid-category",
      createPythonPlotBlock("plot"),
      " Figure",
    )).toThrow(/trimmed/u);

    const valid = sampleCaptioned();
    expect(() => requireCaptionedBlock({
      ...valid,
      childSequences: [{ id: "content", blocks: [] }],
    })).toThrow(/exactly one/u);
  });
});
