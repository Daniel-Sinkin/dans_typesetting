// Canonical transport codec owned by the two-panel figure extension.
import type { BuilderBlock } from "../model/document";
import { decodeOptionalReferenceId } from "../model/referenceId";
import {
  requireTransportArray,
  requireTransportNumber,
  requireTransportRecord,
  requireTransportString,
  type BlockTransportCodec,
  type DocumentTransportRegistry,
} from "../transport/documentTransport";
import {
  createFigurePairBlock,
  createFigurePanel,
  figurePairTypeId,
  requireFigurePairBlock,
  type BuilderFigurePanel,
} from "./figurePairModel";

function encodePanel(
  panel: BuilderFigurePanel,
  registry: DocumentTransportRegistry,
): unknown {
  return {
    id: panel.id,
    source: panel.source,
    captionInlines: panel.captionInlines.map((inline) =>
      registry.encodeInline(inline),
    ),
    referenceId: panel.referenceId,
    preferredPixelWidth: panel.preferredPixelWidth,
    preferredPixelHeight: panel.preferredPixelHeight,
  };
}

function decodePanel(
  value: unknown,
  index: number,
  registry: DocumentTransportRegistry,
): BuilderFigurePanel {
  const context = `Figure-pair panel ${String(index)}`;
  const data = requireTransportRecord(value, context);
  return createFigurePanel(
    requireTransportString(data, "id", context),
    requireTransportString(data, "source", context),
    requireTransportArray(data, "captionInlines", context).map(
      (inline, inlineIndex) =>
        registry.decodeInline(
          inline,
          `${context} caption inline ${String(inlineIndex)}`,
        ),
    ),
    decodeOptionalReferenceId(data.referenceId, `${context}.referenceId`),
    requireTransportNumber(data, "preferredPixelWidth", context),
    requireTransportNumber(data, "preferredPixelHeight", context),
  );
}

export const figurePairTransportCodec: BlockTransportCodec = {
  typeId: figurePairTypeId,
  encode(block, registry) {
    const pair = requireFigurePairBlock(block);
    return {
      panels: pair.panels.map((panel) => encodePanel(panel, registry)),
      captionInlines: pair.captionInlines.map((inline) =>
        registry.encodeInline(inline),
      ),
      referenceId: pair.referenceId,
      panelWidthFraction: pair.panelWidthFraction,
    };
  },
  decode(id, payload, registry): BuilderBlock {
    const data = requireTransportRecord(payload, "Figure-pair payload");
    const encodedPanels = requireTransportArray(
      data,
      "panels",
      "Figure-pair payload",
    );
    if (encodedPanels.length !== 2) {
      throw new Error("Figure-pair payload.panels must contain exactly two panels");
    }
    const first = decodePanel(encodedPanels[0], 0, registry);
    const second = decodePanel(encodedPanels[1], 1, registry);
    return createFigurePairBlock(
      id,
      first,
      second,
      requireTransportArray(
        data,
        "captionInlines",
        "Figure-pair payload",
      ).map((inline, index) =>
        registry.decodeInline(
          inline,
          `Figure-pair caption inline ${String(index)}`,
        ),
      ),
      decodeOptionalReferenceId(
        data.referenceId,
        "Figure-pair payload.referenceId",
      ),
      requireTransportNumber(
        data,
        "panelWidthFraction",
        "Figure-pair payload",
      ),
    );
  },
};
