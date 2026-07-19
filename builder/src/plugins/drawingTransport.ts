// Canonical transport codec owned by the embedded drawing plugin.
import type { BuilderBlock } from "../model/document";
import {
  requireTransportNumber,
  requireTransportRecord,
  requireTransportString,
  type BlockTransportCodec,
} from "../transport/documentTransport";
import {
  excalidrawDrawingTypeId,
  normalizeExcalidrawScene,
  requireExcalidrawDrawingBlock,
  validateExcalidrawDrawingBlock,
  type ExcalidrawDrawingBlock,
} from "./drawingModel";

function decodeReferenceId(data: Record<string, unknown>): string | null {
  if (data.referenceId === null) {
    return null;
  }
  return requireTransportString(data, "referenceId", "Excalidraw drawing payload");
}

export const excalidrawDrawingTransportCodec: BlockTransportCodec = {
  typeId: excalidrawDrawingTypeId,
  encode(block) {
    const drawing = requireExcalidrawDrawingBlock(block);
    return {
      caption: drawing.caption,
      referenceId: drawing.referenceId,
      widthFraction: drawing.widthFraction,
      canvasHeight: drawing.canvasHeight,
      scene: drawing.scene,
    };
  },
  decode(id, payload): BuilderBlock {
    const data = requireTransportRecord(payload, "Excalidraw drawing payload");
    const drawing = Object.freeze({
      id,
      typeId: excalidrawDrawingTypeId,
      caption: requireTransportString(data, "caption", "Excalidraw drawing payload"),
      referenceId: decodeReferenceId(data),
      widthFraction: requireTransportNumber(
        data,
        "widthFraction",
        "Excalidraw drawing payload",
      ),
      canvasHeight: requireTransportNumber(
        data,
        "canvasHeight",
        "Excalidraw drawing payload",
      ),
      scene: normalizeExcalidrawScene(data.scene),
    }) satisfies ExcalidrawDrawingBlock;
    validateExcalidrawDrawingBlock(drawing);
    return drawing;
  },
};
