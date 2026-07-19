// Isolate Excalidraw's scene schema and export implementation behind plugin helpers.
import {
  convertToExcalidrawElements,
  exportToSvg,
  getNonDeletedElements,
  restore,
  serializeAsJSON,
} from "@excalidraw/excalidraw";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { AppState, BinaryFiles } from "@excalidraw/excalidraw/types";

import {
  normalizeExcalidrawScene,
  type ExcalidrawScenePayload,
} from "./drawingModel";

export function captureExcalidrawScene(
  elements: readonly ExcalidrawElement[],
  appState: AppState,
  files: BinaryFiles,
): ExcalidrawScenePayload {
  return normalizeExcalidrawScene(
    JSON.parse(serializeAsJSON(elements, appState, files, "local")) as unknown,
  );
}

export function restoreExcalidrawScene(scene: ExcalidrawScenePayload) {
  return restore(scene as Parameters<typeof restore>[0], null, null);
}

export function createSampleExcalidrawScene(): ExcalidrawScenePayload {
  const elements = convertToExcalidrawElements(
    [
      {
        type: "rectangle",
        x: 40,
        y: 50,
        width: 230,
        height: 120,
        strokeColor: "#4263eb",
        backgroundColor: "#dbe4ff",
        fillStyle: "solid",
        roundness: { type: 3 },
      },
      {
        type: "text",
        x: 79,
        y: 90,
        width: 152,
        height: 40,
        text: "Editable drawing",
        fontSize: 24,
        strokeColor: "#1c3f94",
        textAlign: "center",
      },
      {
        type: "arrow",
        x: 270,
        y: 110,
        points: [
          [0, 0],
          [130, 0],
        ],
        strokeColor: "#4263eb",
        endArrowhead: "arrow",
      },
      {
        type: "ellipse",
        x: 400,
        y: 55,
        width: 120,
        height: 110,
        strokeColor: "#e8590c",
        backgroundColor: "#fff4e6",
        fillStyle: "solid",
      },
    ],
    { regenerateIds: true },
  );
  const serialized = serializeAsJSON(
    elements,
    { viewBackgroundColor: "#ffffff" },
    {},
    "local",
  );
  return normalizeExcalidrawScene(JSON.parse(serialized) as unknown);
}

export async function exportExcalidrawSceneToSvg(
  scene: ExcalidrawScenePayload,
): Promise<string | null> {
  const restored = restoreExcalidrawScene(scene);
  const elements = getNonDeletedElements(restored.elements);
  if (elements.length === 0) {
    return null;
  }
  // Excalidraw's published declaration references its private @excalidraw/utils
  // alias. TypeScript resolves the public return type, while typed ESLint marks
  // the call as an error type; constrain the one upstream boundary explicitly.
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
  const svg: SVGSVGElement = await exportToSvg({
    elements,
    appState: {
      exportBackground: true,
      exportWithDarkMode: false,
      viewBackgroundColor: restored.appState.viewBackgroundColor,
    },
    files: restored.files,
    exportPadding: 16,
    renderEmbeddables: false,
    skipInliningFonts: true,
  });
  return new XMLSerializer().serializeToString(svg);
}
