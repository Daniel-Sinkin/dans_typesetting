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
  defaultExcalidrawArtboardHeight,
  excalidrawArtboardWidth,
  excalidrawSceneAspectRatio,
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
      artboardHeight: drawing.artboardHeight,
      scene: drawing.scene,
    };
  },
  decode(id, payload): BuilderBlock {
    const data = requireTransportRecord(payload, "Excalidraw drawing payload");
    const scene = normalizeExcalidrawScene(data.scene);
    const migratedArtboardHeight = Math.min(
      1_200,
      Math.max(
        240,
        Math.round(excalidrawArtboardWidth / excalidrawSceneAspectRatio(scene)),
      ),
    );
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
      artboardHeight:
        data.artboardHeight === undefined
          ? (Number.isFinite(migratedArtboardHeight)
              ? migratedArtboardHeight
              : defaultExcalidrawArtboardHeight)
          : requireTransportNumber(
              data,
              "artboardHeight",
              "Excalidraw drawing payload",
            ),
      scene,
    }) satisfies ExcalidrawDrawingBlock;
    validateExcalidrawDrawingBlock(drawing);
    return drawing;
  },
};
