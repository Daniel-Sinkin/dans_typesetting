import { describe, expect, it } from "vitest";

import { copyBuilderBlockForInsert } from "../builder/copyBlock";
import { BuilderInlinePluginRegistry } from "../builder/inlinePlugin";
import { BuilderPluginRegistry } from "../builder/plugin";
import { deriveReferenceTargets } from "../builder/referenceTargets";
import {
  createText,
  MemoryDocumentPort,
} from "../model/document";
import { projectDocumentTransport } from "../transport/projectTransport";
import { createFigurePairPlugin } from "./figurePair";
import {
  createFigurePairBlock,
  createFigurePanel,
  requireFigurePairBlock,
} from "./figurePairModel";
import { createImagePlugin } from "./image";
import { opaqueBlockAdapter } from "./opaque";
import {
  opaqueInlineAdapter,
  textInlinePlugin,
} from "./text";

const inlineRegistry = new BuilderInlinePluginRegistry(
  [textInlinePlugin],
  opaqueInlineAdapter,
);
const figurePairPlugin = createFigurePairPlugin(inlineRegistry);
const imagePlugin = createImagePlugin(inlineRegistry);

function samplePair(referenceId: string | null = "fig:pair") {
  return createFigurePairBlock(
    "pair",
    createFigurePanel(
      "left",
      "/left.png",
      [createText("Left", "left-caption")],
      "fig:pair:left",
      1280,
      720,
    ),
    createFigurePanel(
      "right",
      "/right.png",
      [createText("Right", "right-caption", "italic")],
      "fig:pair:right",
      720,
      1280,
    ),
    [createText("Comparison", "pair-caption", "bold")],
    referenceId,
    0.47,
  );
}

describe("semantic figure pairs", () => {
  it("creates new pairs without publishing an implicit group target", () => {
    expect(
      requireFigurePairBlock(figurePairPlugin.createDefault("default-pair"))
        .referenceId,
    ).toBeNull();
  });

  it("round-trips its rich canonical payload exactly", () => {
    const source = projectDocumentTransport.toString(
      new MemoryDocumentPort([samplePair(null)]).getSnapshot(),
    );
    const decoded = projectDocumentTransport.fromString(source);
    const normalized = projectDocumentTransport.toString(
      new MemoryDocumentPort(decoded.blocks, decoded.metadata).getSnapshot(),
    );

    expect(normalized).toBe(source);
    const decodedPair = decoded.blocks[0];
    if (decodedPair === undefined) {
      throw new Error("Decoded figure-pair document lost its only block");
    }
    expect(requireFigurePairBlock(decodedPair).panels[1]).toMatchObject({
      source: "/right.png",
      referenceId: "fig:pair:right",
      preferredPixelWidth: 720,
      preferredPixelHeight: 1280,
    });
    expect(requireFigurePairBlock(decodedPair).referenceId).toBeNull();
  });

  it("publishes a group target and suffixed panel targets on one ordinal", () => {
    const registry = new BuilderPluginRegistry(
      [figurePairPlugin, imagePlugin],
      opaqueBlockAdapter,
    );
    const ordinaryFigure = imagePlugin.createDefault("ordinary");
    const targets = deriveReferenceTargets(
      [
        samplePair(),
        Object.freeze({
          ...ordinaryFigure,
          referenceId: "fig:ordinary",
        }),
      ],
      registry,
    );

    expect(targets.get("fig:pair")?.displayText).toBe("Figure 1");
    expect(targets.get("fig:pair:left")?.displayText).toBe("Figure 1a");
    expect(targets.get("fig:pair:right")?.displayText).toBe("Figure 1b");
    expect(targets.get("fig:ordinary")?.displayText).toBe("Figure 2");
  });

  it("numbers an unreferenced group while preserving optional panel targets", () => {
    const registry = new BuilderPluginRegistry(
      [figurePairPlugin, imagePlugin],
      opaqueBlockAdapter,
    );
    const ordinaryFigure = Object.freeze({
      ...imagePlugin.createDefault("ordinary"),
      referenceId: "fig:ordinary",
    });
    const targets = deriveReferenceTargets(
      [samplePair(null), ordinaryFigure],
      registry,
    );

    expect(targets.has("fig:pair")).toBe(false);
    expect(targets.get("fig:pair:left")?.displayText).toBe("Figure 1a");
    expect(targets.get("fig:pair:right")?.displayText).toBe("Figure 1b");
    expect(targets.get("fig:ordinary")?.displayText).toBe("Figure 2");
  });

  it("copies nested identity while preventing duplicate semantic targets", () => {
    const registry = new BuilderPluginRegistry(
      [figurePairPlugin],
      opaqueBlockAdapter,
    );
    const copied = requireFigurePairBlock(
      copyBuilderBlockForInsert(samplePair(), registry, "copied"),
    );

    expect(copied.referenceId).toBeNull();
    expect(copied.panels.map((panel) => panel.referenceId)).toEqual([null, null]);
    expect(copied.panels.map((panel) => panel.id)).not.toEqual(["left", "right"]);
    expect(copied.captionInlines[0]?.id).not.toBe("pair-caption");
    expect(copied.panels[0].captionInlines[0]?.id).not.toBe("left-caption");
  });

  it("rejects ambiguous or impossible pair payloads", () => {
    expect(() =>
      createFigurePairBlock(
        "wide",
        createFigurePanel("left", "/left.png", [createText("Left")]),
        createFigurePanel("right", "/right.png", [createText("Right")]),
        [createText("Pair")],
        "fig:wide",
        0.51,
      ),
    ).toThrow(/0, 0\.5/u);
    expect(() =>
      createFigurePairBlock(
        "duplicate-target",
        createFigurePanel(
          "left",
          "/left.png",
          [createText("Left")],
          "fig:duplicate",
        ),
        createFigurePanel("right", "/right.png", [createText("Right")]),
        [createText("Pair")],
        "fig:duplicate",
      ),
    ).toThrow(/must be distinct/u);

    const encoded = JSON.parse(
      projectDocumentTransport.toString(
        new MemoryDocumentPort([samplePair()]).getSnapshot(),
      ),
    ) as { blocks: { payload: { panels: unknown[] } }[] };
    encoded.blocks[0]?.payload.panels.pop();
    expect(() =>
      projectDocumentTransport.fromString(JSON.stringify(encoded)),
    ).toThrow(/exactly two panels/u);
  });
});
