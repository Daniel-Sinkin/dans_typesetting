import { describe, expect, it } from "vitest";

import { copyBuilderBlockForInsert } from "../builder/copyBlock";
import {
  computeDocumentLayout,
  insertionTargetAtScenePoint,
} from "../builder/layout";
import { BuilderInlinePluginRegistry } from "../builder/inlinePlugin";
import { BuilderPluginRegistry } from "../builder/plugin";
import {
  createText,
  MemoryDocumentPort,
  paragraphTypeId,
  type BuilderBlock,
} from "../model/document";
import { projectDocumentTransport } from "../transport/projectTransport";
import { opaqueBlockAdapter } from "./opaque";
import { createParagraphPlugin } from "./paragraph";
import { paddingPlugin } from "./padding";
import { createPaddingBlock } from "./paddingModel";
import { opaqueInlineAdapter, textInlinePlugin } from "./text";
import { gridPlugin, resolveGridGeometry } from "./grid";
import {
  createGridBlock,
  droppedGridBlockCount,
  gridCell,
  gridCellSequenceId,
  maximumGridCellCount,
  requireGridBlock,
  resizeGridBlock,
} from "./gridModel";

function paragraph(id: string, text = id): BuilderBlock {
  return Object.freeze({
    id,
    typeId: paragraphTypeId,
    inlines: Object.freeze([createText(text, `${id}:text`)]),
  });
}

const inlineRegistry = new BuilderInlinePluginRegistry(
  [textInlinePlugin],
  opaqueInlineAdapter,
);
const registry = new BuilderPluginRegistry(
  [createParagraphPlugin(inlineRegistry), paddingPlugin, gridPlugin],
  opaqueBlockAdapter,
);

describe("semantic Grid", () => {
  it("round-trips recursive cells, gaps, and boundary styles exactly", () => {
    const nested = createGridBlock("nested", 1, 1, {
      cells: [[paragraph("nested-text")]],
      gaps: { rowEm: 0, columnEm: 0 },
      horizontalEdges: ["double", "single"],
      verticalEdges: ["single", "double"],
    });
    const source = projectDocumentTransport.toString(
      new MemoryDocumentPort([
        createGridBlock("grid", 2, 2, {
          cells: [
            [paragraph("upper-left")],
            [],
            [createPaddingBlock("padding", { topEm: 1, rightEm: 2, bottomEm: 3, leftEm: 4 })],
            [nested],
          ],
          gaps: { rowEm: 1.25, columnEm: 2.5 },
          horizontalEdges: ["single", "double", "single"],
          verticalEdges: ["single", "none", "double"],
        }),
      ]).getSnapshot(),
    );
    const decoded = projectDocumentTransport.fromString(source);
    const normalized = projectDocumentTransport.toString(
      new MemoryDocumentPort(decoded.blocks, decoded.metadata).getSnapshot(),
    );
    const block = decoded.blocks[0];
    if (block === undefined) {
      throw new Error("Grid transport lost its block");
    }
    const grid = requireGridBlock(block);

    expect(normalized).toBe(source);
    expect(grid.gaps).toEqual({ rowEm: 1.25, columnEm: 2.5 });
    expect(grid.horizontalEdges).toEqual(["single", "double", "single"]);
    expect(grid.verticalEdges).toEqual(["single", "none", "double"]);
    expect(grid.childSequences.map(({ id }) => id)).toEqual([
      "cell:0:0",
      "cell:0:1",
      "cell:1:0",
      "cell:1:1",
    ]);
    expect(gridCell(grid, 1, 1)[0]?.id).toBe("nested");
  });

  it("rejects malformed dimensions, cells, gaps, edges, and transport payloads", () => {
    expect(() => createGridBlock("zero", 0, 1)).toThrow(/dimensions/u);
    expect(() => createGridBlock("too-many", 9, 8)).toThrow(
      new RegExp(String(maximumGridCellCount), "u"),
    );
    expect(() =>
      createGridBlock("cells", 1, 2, { cells: [[]] }),
    ).toThrow(/rows times columns/u);
    expect(() =>
      createGridBlock("gap", 1, 1, { gaps: { rowEm: -1, columnEm: 0 } }),
    ).toThrow(/gaps/u);
    expect(() =>
      createGridBlock("edges", 1, 1, { horizontalEdges: ["single"] }),
    ).toThrow(/boundary arrays/u);

    const encoded = JSON.parse(
      projectDocumentTransport.toString(
        new MemoryDocumentPort([createGridBlock("grid", 1, 1)]).getSnapshot(),
      ),
    ) as { blocks: { payload: { verticalEdges: unknown[] } }[] };
    const encodedGrid = encoded.blocks[0];
    if (encodedGrid === undefined) {
      throw new Error("Grid test fixture lost its encoded block");
    }
    encodedGrid.payload.verticalEdges[0] = "triple";
    expect(() => projectDocumentTransport.fromString(JSON.stringify(encoded))).toThrow(
      /none, single, or double/u,
    );
  });

  it("resizes by coordinate, preserves outer edges, and reports discarded blocks", () => {
    const grid = createGridBlock("grid", 2, 2, {
      cells: [
        [paragraph("a")],
        [paragraph("b")],
        [paragraph("c")],
        [paragraph("d")],
      ],
      horizontalEdges: ["single", "double", "single"],
      verticalEdges: ["double", "single", "double"],
    });
    expect(droppedGridBlockCount(grid, 1, 1)).toBe(3);

    const smaller = resizeGridBlock(grid, 1, 1);
    expect(gridCell(smaller, 0, 0)[0]?.id).toBe("a");
    expect(smaller.horizontalEdges).toEqual(["single", "single"]);
    expect(smaller.verticalEdges).toEqual(["double", "double"]);

    const larger = resizeGridBlock(grid, 3, 3);
    expect(gridCell(larger, 1, 1)[0]?.id).toBe("d");
    expect(gridCell(larger, 2, 2)).toEqual([]);
    expect(larger.horizontalEdges).toEqual(["single", "double", "none", "single"]);
    expect(larger.verticalEdges).toEqual(["double", "single", "none", "double"]);
  });

  it("deep-copies recursive cells while preserving endpoint topology", () => {
    const source = createGridBlock("grid", 1, 2, {
      cells: [[paragraph("left")], [createGridBlock("nested", 1, 1)]],
    });
    const copied = requireGridBlock(
      copyBuilderBlockForInsert(source, registry, "grid-copy"),
    );

    expect(copied.id).toBe("grid-copy");
    expect(copied.childSequences.map(({ id }) => id)).toEqual(
      source.childSequences.map(({ id }) => id),
    );
    expect(gridCell(copied, 0, 0)[0]?.id).not.toBe("left");
    expect(gridCell(copied, 0, 1)[0]?.id).not.toBe("nested");
  });

  it("allocates exact empty-cell rectangles and targets the innermost hovered cell", () => {
    const nested = createGridBlock("nested", 1, 2);
    const outer = createGridBlock("outer", 1, 1, { cells: [[nested]] });
    const layout = computeDocumentLayout([outer], registry);
    expect(layout.childSequenceLayouts).toHaveLength(3);
    const nestedRight = layout.childSequenceLayouts.find(
      ({ parentId, sequenceId }) =>
        parentId === "nested" && sequenceId === gridCellSequenceId(0, 1),
    );
    if (nestedRight === undefined) {
      throw new Error("Nested Grid did not allocate its right cell");
    }
    expect(nestedRight.bounds.height).toBe(88);
    expect(
      insertionTargetAtScenePoint(
        nestedRight.bounds.x + nestedRight.bounds.width / 2,
        nestedRight.bounds.y + nestedRight.bounds.height / 2,
        layout,
      ),
    ).toEqual({
      parentId: "nested",
      parentSequenceId: gridCellSequenceId(0, 1),
      index: 0,
    });
  });

  it("scales oversized column gaps before violating the minimum cell width", () => {
    const grid = createGridBlock("grid", 1, 2, {
      gaps: { rowEm: 0, columnEm: 16 },
    });
    const geometry = resolveGridGeometry(grid, 80, {
      documentBlocks: [grid],
      sectionDepth: 0,
      measureChildSequence: () => 0,
    });

    expect(geometry.placements[0]?.width).toBe(32);
    expect(geometry.placements[1]?.offsetX).toBe(48);
    expect(geometry.height).toBe(88);
  });
});
