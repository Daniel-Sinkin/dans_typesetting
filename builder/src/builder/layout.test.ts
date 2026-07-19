// builder/src/builder/layout.test.ts — verify insertion slots and vertical-flow displacement.
import { describe, expect, it } from "vitest";

import { BuilderPluginRegistry } from "./plugin";
import { BuilderInlinePluginRegistry } from "./inlinePlugin";
import { computeDocumentLayout, insertionIndexAtSceneY } from "./layout";
import { imagePlugin } from "../plugins/image";
import { mathPlugin } from "../plugins/mathPlugin";
import { opaqueBlockAdapter } from "../plugins/opaque";
import { createParagraphPlugin } from "../plugins/paragraph";
import {
  opaqueInlineAdapter,
  paragraphTextInlinePlugin,
} from "../plugins/paragraphInline";

const inlineRegistry = new BuilderInlinePluginRegistry(
  [paragraphTextInlinePlugin],
  opaqueInlineAdapter,
);
const paragraphPlugin = createParagraphPlugin(inlineRegistry);

const registry = new BuilderPluginRegistry(
  [paragraphPlugin, imagePlugin, mathPlugin],
  opaqueBlockAdapter,
);

describe("document flow", () => {
  it("opens a preview slot and moves all following blocks", () => {
    const first = paragraphPlugin.createDefault("first");
    const second = paragraphPlugin.createDefault("second");
    const previewBlock = imagePlugin.createDefault("preview");
    const base = computeDocumentLayout([first, second], registry);
    const preview = computeDocumentLayout([first, second], registry, {
      index: 1,
      block: previewBlock,
    });

    expect(preview.previewBounds).not.toBeNull();
    expect(preview.blocks[0]?.bounds.y).toBe(base.blocks[0]?.bounds.y);
    expect(preview.blocks[1]?.bounds.y).toBeGreaterThan(base.blocks[1]?.bounds.y ?? 0);
  });

  it("selects insertion positions using block midpoints", () => {
    const blocks = [
      paragraphPlugin.createDefault("first"),
      imagePlugin.createDefault("second"),
    ];
    const layout = computeDocumentLayout(blocks, registry);
    const first = layout.blocks[0];
    const second = layout.blocks[1];
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    if (first === undefined || second === undefined) {
      return;
    }

    expect(insertionIndexAtSceneY(first.bounds.y - 1, layout)).toBe(0);
    expect(insertionIndexAtSceneY(first.bounds.y + first.bounds.height, layout)).toBe(1);
    expect(insertionIndexAtSceneY(second.bounds.y + second.bounds.height, layout)).toBe(2);
  });

  it("lays out unknown block types through the opaque fallback adapter", () => {
    const unknownBlock = { id: "unknown", typeId: "dans.future.table" };
    const layout = computeDocumentLayout([unknownBlock], registry);

    expect(registry.pluginForBlock(unknownBlock)).toBe(opaqueBlockAdapter);
    expect(layout.blocks[0]?.bounds.height).toBe(132);
  });
});
