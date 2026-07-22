// Graphical writer adapter for an embedded, referenceable Excalidraw scene.
import type { BuilderBlockPlugin } from "../builder/plugin";
import type { BuilderBlock } from "../model/document";
import { ExcalidrawDrawingEditor } from "./drawingEditor";
import {
  createEmptyExcalidrawScene,
  excalidrawSceneAspectRatio,
  excalidrawDrawingTypeId,
  requireExcalidrawDrawingBlock,
} from "./drawingModel";
import { DrawingScenePreview } from "./drawingPreview";

export const excalidrawDrawingPlugin: BuilderBlockPlugin = {
  typeId: excalidrawDrawingTypeId,
  numberingSeries: "Figure",
  palette: {
    label: "Excalidraw drawing",
    description: "A scene edited in a focused popup window",
    glyph: "✎",
    accentColor: "#f08c00",
  },
  createDefault(blockId): BuilderBlock {
    return Object.freeze({
      id: blockId,
      typeId: excalidrawDrawingTypeId,
      caption: "An embedded drawing.",
      referenceId: null,
      widthFraction: 1,
      scene: createEmptyExcalidrawScene(),
    });
  },
  referenceTarget(block) {
    const drawing = requireExcalidrawDrawingBlock(block);
    return {
      referenceId: drawing.referenceId,
      label: "Figure",
      title: drawing.caption,
    };
  },
  copyForInsert(block, copiedBlockId) {
    return Object.freeze({
      ...requireExcalidrawDrawingBlock(block),
      id: copiedBlockId,
      referenceId: null,
    });
  },
  measure(block, availableWidth) {
    const drawing = requireExcalidrawDrawingBlock(block);
    if (availableWidth <= 0) {
      throw new Error("Excalidraw drawing requires positive available width");
    }
    const renderedWidth = availableWidth * drawing.widthFraction;
    const renderedHeight = renderedWidth / excalidrawSceneAspectRatio(drawing.scene);
    return Math.max(224, renderedHeight + 104);
  },
  renderPreview(block, context) {
    const drawing = requireExcalidrawDrawingBlock(block);
    return (
      <figure className="drawing-content">
        <div
          className="drawing-content__scene"
          style={{ width: `${String(drawing.widthFraction * 100)}%` }}
        >
          <DrawingScenePreview scene={drawing.scene} />
        </div>
        <figcaption>
          <strong>Figure {String(context.ordinal ?? "?")}:</strong> {drawing.caption}
        </figcaption>
      </figure>
    );
  },
  editor: {
    title: (block) => `Edit embedded drawing · ${requireExcalidrawDrawingBlock(block).id}`,
    render: (props) => <ExcalidrawDrawingEditor {...props} />,
  },
};
