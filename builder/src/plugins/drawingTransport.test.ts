import { describe, expect, it } from "vitest";

import { MemoryDocumentPort } from "../model/document";
import {
  canonicalDocumentFormat,
  canonicalDocumentSchemaVersion,
} from "../transport/documentTransport";
import { projectDocumentTransport } from "../transport/projectTransport";
import {
  createEmptyExcalidrawScene,
  excalidrawDrawingTypeId,
  type ExcalidrawDrawingBlock,
} from "./drawingModel";

function drawingBlock(): ExcalidrawDrawingBlock {
  return Object.freeze({
    id: "drawing",
    typeId: excalidrawDrawingTypeId,
    caption: "A semantic drawing.",
    referenceId: "fig:drawing",
    widthFraction: 0.82,
    canvasHeight: 420,
    scene: createEmptyExcalidrawScene(),
  });
}

function sourceWithPayload(payload: unknown): string {
  return JSON.stringify({
    format: canonicalDocumentFormat,
    schemaVersion: canonicalDocumentSchemaVersion,
    documentVersion: { major: 0, minor: 1, patch: 0 },
    blocks: [{ id: "drawing", type: excalidrawDrawingTypeId, payload }],
  });
}

describe("embedded Excalidraw drawing transport", () => {
  it("round-trips the plugin-owned scene without flattening it into canvas state", () => {
    const source = projectDocumentTransport.toString(
      new MemoryDocumentPort([drawingBlock()]).getSnapshot(),
    );
    const decoded = projectDocumentTransport.fromString(source);
    const restored = decoded.blocks[0] as ExcalidrawDrawingBlock;

    expect(
      projectDocumentTransport.toString(
        new MemoryDocumentPort(decoded.blocks, decoded.metadata).getSnapshot(),
      ),
    ).toBe(source);
    expect(restored.scene).toEqual(createEmptyExcalidrawScene());
    expect(Object.isFrozen(restored.scene.elements)).toBe(true);
    expect(restored.referenceId).toBe("fig:drawing");
  });

  it("rejects malformed scenes, dimensions, and reference IDs at the plugin codec", () => {
    const validPayload = {
      caption: "Drawing",
      referenceId: null,
      widthFraction: 1,
      canvasHeight: 380,
      scene: createEmptyExcalidrawScene(),
    };
    expect(() =>
      projectDocumentTransport.fromString(
        sourceWithPayload({ ...validPayload, canvasHeight: 721 }),
      ),
    ).toThrow(/canvasHeight/u);
    expect(() =>
      projectDocumentTransport.fromString(
        sourceWithPayload({ ...validPayload, referenceId: "not a reference" }),
      ),
    ).toThrow(/reference ID/u);
    expect(() =>
      projectDocumentTransport.fromString(
        sourceWithPayload({
          ...validPayload,
          scene: { ...createEmptyExcalidrawScene(), elements: "not an array" },
        }),
      ),
    ).toThrow(/scene/u);
  });
});
