// Graphical writer adapter for an embedded, referenceable Excalidraw scene.
import type { BuilderBlockPlugin } from "../builder/plugin";
import type { BuilderBlock } from "../model/document";
import { ExcalidrawDrawingEditor } from "./drawingEditor";
import {
  createEmptyExcalidrawScene,
  excalidrawDrawingTypeId,
  requireExcalidrawDrawingBlock,
} from "./drawingModel";
import { DrawingScenePreview } from "./drawingPreview";

export const excalidrawDrawingPlugin: BuilderBlockPlugin = {
  typeId: excalidrawDrawingTypeId,
  numberingSeries: "figure",
  palette: {
    label: "Excalidraw drawing",
    description: "A bounded scene edited directly inside the document",
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
      canvasHeight: 380,
      scene: createEmptyExcalidrawScene(),
    });
  },
  measure(block, availableWidth) {
    const drawing = requireExcalidrawDrawingBlock(block);
    if (availableWidth <= 0) {
      throw new Error("Excalidraw drawing requires positive available width");
    }
    return drawing.canvasHeight + 104;
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
    presentation: "inline",
    title: (block) => `Edit embedded drawing · ${requireExcalidrawDrawingBlock(block).id}`,
    render: (props) => <ExcalidrawDrawingEditor {...props} />,
  },
};
