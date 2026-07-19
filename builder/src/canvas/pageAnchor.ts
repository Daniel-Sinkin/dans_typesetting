// builder/src/canvas/pageAnchor.ts — create the locked canvas anchor for the document page.
import { convertToExcalidrawElements } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { pageGeometry } from "../builder/layout";

export const pageAnchorId = "dans-document-page-anchor";

export type ExcalidrawSceneElement = ReturnType<
  ExcalidrawImperativeAPI["getSceneElements"]
>[number];

export function createPageAnchor(): ExcalidrawSceneElement {
  const elements = convertToExcalidrawElements(
    [
      {
        type: "rectangle",
        id: pageAnchorId,
        x: pageGeometry.x,
        y: pageGeometry.y,
        width: pageGeometry.width,
        height: pageGeometry.minimumHeight,
        strokeColor: "transparent",
        backgroundColor: "transparent",
        fillStyle: "solid",
        strokeWidth: 1,
        strokeStyle: "solid",
        roughness: 0,
        opacity: 0,
        locked: true,
        customData: {
          dansDocumentPage: {
            owner: pageAnchorId,
          },
        },
      },
    ],
    { regenerateIds: false },
  );
  const pageAnchor = elements[0];
  if (pageAnchor === undefined) {
    throw new Error("Excalidraw did not create the document page anchor");
  }
  return pageAnchor;
}
