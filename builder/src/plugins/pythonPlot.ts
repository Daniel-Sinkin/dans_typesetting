// Register trusted Python/Matplotlib plots as backend-neutral source blocks.
import { createElement } from "react";

import type { BuilderBlockPlugin } from "../builder/plugin";
import { PythonPlotEditor } from "./pythonPlotEditor";
import {
  createPythonPlotBlock,
  pythonPlotTypeId,
  requirePythonPlotBlock,
} from "./pythonPlotModel";
import { PythonPlotPreview } from "./pythonPlotPreview";

export const pythonPlotPlugin: BuilderBlockPlugin = {
  typeId: pythonPlotTypeId,
  palette: {
    label: "Python plot",
    description: "Trusted Python/Matplotlib source with a live SVG preview",
    glyph: "⌁",
    accentColor: "#1971c2",
  },
  createDefault(blockId) {
    return createPythonPlotBlock(blockId);
  },
  copyForInsert(block, copiedBlockId) {
    const plot = requirePythonPlotBlock(block);
    return createPythonPlotBlock(
      copiedBlockId,
      plot.source,
      plot.widthFraction,
      plot.targetPixelWidth,
      plot.targetPixelHeight,
    );
  },
  measure(block, availableWidth) {
    const plot = requirePythonPlotBlock(block);
    const imageWidth = availableWidth * plot.widthFraction;
    const imageHeight =
      imageWidth * (plot.targetPixelHeight / plot.targetPixelWidth);
    return Math.min(680, Math.max(180, imageHeight + 24));
  },
  renderPreview(block) {
    return createElement(PythonPlotPreview, {
      plot: requirePythonPlotBlock(block),
    });
  },
  editor: {
    title(block) {
      return `Edit Python plot · ${requirePythonPlotBlock(block).id}`;
    },
    render(props) {
      return createElement(PythonPlotEditor, props);
    },
  },
};
