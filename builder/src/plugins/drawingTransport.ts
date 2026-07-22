// Canonical transport codec owned by the embedded drawing plugin.
import type { BuilderBlock } from "../model/document";
import {
  requireTransportNumber,
  requireTransportRecord,
  requireTransportString,
  type BlockTransportCodec,
} from "../transport/documentTransport";
import { decodeOptionalReferenceId } from "../model/referenceId";
import {
  excalidrawDrawingTypeId,
  normalizeExcalidrawScene,
  requireExcalidrawDrawingBlock,
  validateExcalidrawDrawingBlock,
  type ExcalidrawDrawingBlock,
} from "./drawingModel";

export const excalidrawDrawingTransportCodec: BlockTransportCodec = {
  typeId: excalidrawDrawingTypeId,
  encode(block) {
    const drawing = requireExcalidrawDrawingBlock(block);
    return {
      caption: drawing.caption,
      referenceId: drawing.referenceId,
      widthFraction: drawing.widthFraction,
      scene: drawing.scene,
    };
  },
  decode(id, payload): BuilderBlock {
    const data = requireTransportRecord(payload, "Excalidraw drawing payload");
    const drawing = Object.freeze({
      id,
      typeId: excalidrawDrawingTypeId,
      caption: requireTransportString(data, "caption", "Excalidraw drawing payload"),
      referenceId: decodeOptionalReferenceId(
        data.referenceId,
        "Excalidraw drawing reference ID",
      ),
      widthFraction: requireTransportNumber(
        data,
        "widthFraction",
        "Excalidraw drawing payload",
      ),
      scene: normalizeExcalidrawScene(data.scene),
    }) satisfies ExcalidrawDrawingBlock;
    validateExcalidrawDrawingBlock(drawing);
    return drawing;
  },
};
