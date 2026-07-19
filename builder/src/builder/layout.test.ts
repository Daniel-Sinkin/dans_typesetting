// builder/src/builder/layout.test.ts — verify insertion slots and vertical-flow displacement.
import { describe, expect, it } from "vitest";

import { BuilderPluginRegistry } from "./plugin";
import { BuilderInlinePluginRegistry } from "./inlinePlugin";
import {
  computeDocumentLayout,
  insertionIndexAtSceneY,
  slideGeometry,
} from "./layout";
import { createImagePlugin } from "../plugins/image";
import { mathPlugin } from "../plugins/mathPlugin";
import { opaqueBlockAdapter } from "../plugins/opaque";
import { createParagraphPlugin } from "../plugins/paragraph";
import {
  pageBreakPlugin,
  sectionPlugin,
  titlePagePlugin,
} from "../plugins/documentShell";
import { sectionBodySequenceId } from "../model/document";
import { paddingPlugin } from "../plugins/padding";
import {
  createPaddingBlock,
  paddingContentSequenceId,
} from "../plugins/paddingModel";
import {
  opaqueInlineAdapter,
  textInlinePlugin,
} from "../plugins/text";

const inlineRegistry = new BuilderInlinePluginRegistry(
  [textInlinePlugin],
  opaqueInlineAdapter,
);
const paragraphPlugin = createParagraphPlugin(inlineRegistry);
const imagePlugin = createImagePlugin(inlineRegistry);

const registry = new BuilderPluginRegistry(
  [
    paragraphPlugin,
    imagePlugin,
    mathPlugin,
    pageBreakPlugin,
    sectionPlugin,
    titlePagePlugin,
    paddingPlugin,
    {
      typeId: "test.oversized",
      palette: {
        label: "Oversized",
        description: "Test-only oversized block",
        glyph: "!",
        accentColor: "#f00",
      },
      createDefault: (id: string) => ({ id, typeId: "test.oversized" }),
      measure: () => 4_000,
      renderPreview: () => "oversized",
    },
  ],
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

  it("preserves recursive section ownership while flattening it for visual flow", () => {
    const child = paragraphPlugin.createDefault("child");
    const section = {
      ...sectionPlugin.createDefault("section"),
      childSequences: [{ id: sectionBodySequenceId, blocks: [child] }],
    };
    const layout = computeDocumentLayout([section], registry);

    expect(layout.blocks.map(({ block }) => block.id)).toEqual(["section", "child"]);
    expect(layout.blocks[1]?.parentId).toBe("section");
    expect(layout.blocks[1]?.parentSequenceId).toBe(sectionBodySequenceId);
    expect(layout.blocks[1]?.depth).toBe(1);
    expect(layout.blocks[1]?.bounds.x).toBeGreaterThan(layout.blocks[0]?.bounds.x ?? 0);
  });

  it("places and previews a named child sequence inside Padding", () => {
    const nested = paragraphPlugin.createDefault("nested");
    const padding = createPaddingBlock(
      "padding",
      { topEm: 2, rightEm: 3, bottomEm: 1, leftEm: 4 },
      [nested],
    );
    const after = paragraphPlugin.createDefault("after-padding");
    const base = computeDocumentLayout([padding, after], registry);
    const paddingLayout = base.blocks.find(({ block }) => block.id === "padding");
    const nestedLayout = base.blocks.find(({ block }) => block.id === "nested");
    if (paddingLayout === undefined || nestedLayout === undefined) {
      throw new Error("Padding layout lost its nested block");
    }

    expect(nestedLayout.parentId).toBe("padding");
    expect(nestedLayout.parentSequenceId).toBe(paddingContentSequenceId);
    expect(nestedLayout.bounds.x).toBeGreaterThan(paddingLayout.bounds.x);
    expect(nestedLayout.bounds.y).toBeGreaterThan(paddingLayout.bounds.y);
    expect(
      nestedLayout.bounds.x + nestedLayout.bounds.width,
    ).toBeLessThan(paddingLayout.bounds.x + paddingLayout.bounds.width);

    const preview = computeDocumentLayout([padding, after], registry, {
      parentId: "padding",
      parentSequenceId: paddingContentSequenceId,
      index: 1,
      block: imagePlugin.createDefault("nested-preview"),
    });
    expect(preview.previewBounds).not.toBeNull();
    expect(
      preview.blocks.find(({ block }) => block.id === "after-padding")?.bounds.y,
    ).toBeGreaterThan(
      base.blocks.find(({ block }) => block.id === "after-padding")?.bounds.y ?? 0,
    );
  });

  it("uses page breaks and keeps every ordinary block wholly on one page", () => {
    const blocks = [
      paragraphPlugin.createDefault("before"),
      pageBreakPlugin.createDefault("break"),
      imagePlugin.createDefault("after"),
    ];
    const layout = computeDocumentLayout(blocks, registry, null, {
      mode: "paged",
      pageRange: { start: 1, end: 5 },
    });

    expect(layout.blocks[0]?.pageIndex).toBe(0);
    expect(layout.blocks[1]?.pageIndex).toBe(0);
    expect(layout.blocks[2]?.pageIndex).toBe(1);
    for (const block of layout.blocks) {
      const page = layout.pages[block.pageIndex];
      expect(page).toBeDefined();
      expect(block.bounds.y + block.bounds.height).toBeLessThanOrEqual(
        (page?.contentBounds.y ?? 0) + (page?.contentBounds.height ?? 0),
      );
    }
  });

  it("isolates title pages, limits visible ranges, and marks oversized blocks", () => {
    const breaks = Array.from({ length: 8 }, (_unused, index) =>
      pageBreakPlugin.createDefault(`break-${String(index)}`),
    );
    const layout = computeDocumentLayout(
      [
        titlePagePlugin.createDefault("title"),
        ...breaks,
        { id: "oversized", typeId: "test.oversized" },
      ],
      registry,
      null,
      { mode: "paged", pageRange: { start: 3, end: 20 } },
    );

    expect(layout.pages.filter((page) => page.visible)).toHaveLength(5);
    expect(layout.visiblePageRange).toEqual({ start: 3, end: 7 });
    expect(layout.blocks.find(({ block }) => block.id === "oversized")?.oversized).toBe(
      true,
    );
  });

  it("flows whole blocks through 16:9 slide surfaces", () => {
    const layout = computeDocumentLayout(
      [
        paragraphPlugin.createDefault("first"),
        pageBreakPlugin.createDefault("break"),
        imagePlugin.createDefault("second"),
      ],
      registry,
      null,
      { mode: "slides", pageRange: { start: 2, end: 2 } },
    );

    expect(layout.mode).toBe("slides");
    expect(layout.pages[0]?.bounds).toMatchObject({
      width: slideGeometry.width,
      height: slideGeometry.minimumHeight,
    });
    expect(layout.blocks.find(({ block }) => block.id === "first")?.pageIndex).toBe(0);
    expect(layout.blocks.find(({ block }) => block.id === "second")?.pageIndex).toBe(1);
    expect(layout.visiblePageRange).toEqual({ start: 2, end: 2 });
    expect(layout.pageBounds.width).toBe(slideGeometry.width);
    expect(layout.pageBounds.height).toBe(slideGeometry.minimumHeight);
  });
});
