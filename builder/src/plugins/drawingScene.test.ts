import { describe, expect, it } from "vitest";

import {
  createEmptyExcalidrawScene,
  excalidrawSceneAspectRatio,
  normalizeExcalidrawScene,
} from "./drawingModel";

describe("Excalidraw scene sizing", () => {
  it("uses a stable widescreen size for a new empty drawing", () => {
    expect(excalidrawSceneAspectRatio(createEmptyExcalidrawScene())).toBe(16 / 9);
  });

  it("derives the preview aspect ratio from visible scene bounds", () => {
    const ratio = excalidrawSceneAspectRatio(
      normalizeExcalidrawScene({
        type: "excalidraw",
        version: 2,
        source: "test",
        elements: [
          { x: 40, y: 50, width: 230, height: 120, angle: 0 },
          { x: 400, y: 55, width: 120, height: 110, angle: 0 },
          { x: 0, y: 0, width: 900, height: 900, angle: 0, isDeleted: true },
        ],
        appState: {},
        files: {},
      }),
    );

    expect(ratio).toBeGreaterThan(3);
    expect(ratio).toBeLessThan(4);
  });
});
