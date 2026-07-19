// Canonical transport for trusted Python source and deterministic render intent.
import type { BuilderBlock } from "../model/document";
import {
  requireTransportNumber,
  requireTransportRecord,
  requireTransportString,
  type BlockTransportCodec,
} from "../transport/documentTransport";
import {
  createPythonPlotBlock,
  pythonPlotTypeId,
  requirePythonPlotBlock,
} from "./pythonPlotModel";

export const pythonPlotTransportCodec: BlockTransportCodec = {
  typeId: pythonPlotTypeId,
  encode(block) {
    const plot = requirePythonPlotBlock(block);
    return {
      source: plot.source,
      widthFraction: plot.widthFraction,
      targetPixelWidth: plot.targetPixelWidth,
      targetPixelHeight: plot.targetPixelHeight,
    };
  },
  decode(id, payload): BuilderBlock {
    const data = requireTransportRecord(payload, "Python plot payload");
    return createPythonPlotBlock(
      id,
      requireTransportString(data, "source", "Python plot payload"),
      requireTransportNumber(data, "widthFraction", "Python plot payload"),
      requireTransportNumber(data, "targetPixelWidth", "Python plot payload"),
      requireTransportNumber(data, "targetPixelHeight", "Python plot payload"),
    );
  },
};
