// Canonical transport for Grid presentation intent and recursive cell blocks.
import type { BuilderBlock } from "../model/document";
import {
  requireTransportArray,
  requireTransportNumber,
  requireTransportRecord,
  type BlockTransportCodec,
} from "../transport/documentTransport";
import {
  createGridBlock,
  gridCells,
  gridTypeId,
  requireGridBlock,
  type GridEdgeStyle,
} from "./gridModel";

function decodeEdge(value: unknown, context: string): GridEdgeStyle {
  if (value === "none" || value === "single" || value === "double") {
    return value;
  }
  throw new Error(`${context} must be none, single, or double`);
}

export const gridTransportCodec: BlockTransportCodec = {
  typeId: gridTypeId,
  encode(block, registry) {
    const grid = requireGridBlock(block);
    return {
      rows: grid.rows,
      columns: grid.columns,
      gaps: { ...grid.gaps },
      horizontalEdges: [...grid.horizontalEdges],
      verticalEdges: [...grid.verticalEdges],
      cells: gridCells(grid).map((cell) => ({
        blocks: cell.map((child) => registry.encodeBlock(child)),
      })),
    };
  },
  decode(id, payload, registry): BuilderBlock {
    const data = requireTransportRecord(payload, "Grid payload");
    const gaps = requireTransportRecord(data.gaps, "Grid payload.gaps");
    const cells = requireTransportArray(data, "cells", "Grid payload").map(
      (cell, cellIndex) => {
        const encodedCell = requireTransportRecord(
          cell,
          `Grid payload cell ${String(cellIndex)}`,
        );
        return requireTransportArray(
          encodedCell,
          "blocks",
          `Grid payload cell ${String(cellIndex)}`,
        ).map((child, childIndex) =>
          registry.decodeBlock(
            child,
            `Grid cell ${String(cellIndex)} block ${String(childIndex)}`,
          ),
        );
      },
    );
    return createGridBlock(
      id,
      requireTransportNumber(data, "rows", "Grid payload"),
      requireTransportNumber(data, "columns", "Grid payload"),
      {
        gaps: {
          rowEm: requireTransportNumber(gaps, "rowEm", "Grid payload.gaps"),
          columnEm: requireTransportNumber(
            gaps,
            "columnEm",
            "Grid payload.gaps",
          ),
        },
        horizontalEdges: requireTransportArray(
          data,
          "horizontalEdges",
          "Grid payload",
        ).map((edge, index) =>
          decodeEdge(edge, `Grid horizontal edge ${String(index)}`),
        ),
        verticalEdges: requireTransportArray(
          data,
          "verticalEdges",
          "Grid payload",
        ).map((edge, index) =>
          decodeEdge(edge, `Grid vertical edge ${String(index)}`),
        ),
        cells,
      },
    );
  },
};
