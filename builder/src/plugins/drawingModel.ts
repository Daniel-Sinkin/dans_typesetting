// Semantic payload owned by the embedded Excalidraw drawing plugin.
import type { BuilderBlock } from "../model/document";

export const excalidrawDrawingTypeId = "dans.drawing.excalidraw";
export const drawingCanvasHeight = Object.freeze({ minimum: 240, maximum: 720 });

export interface ExcalidrawScenePayload {
  readonly type: string;
  readonly version: number;
  readonly source: string;
  readonly elements: readonly unknown[];
  readonly appState: Readonly<Record<string, unknown>>;
  readonly files: Readonly<Record<string, unknown>>;
}

export interface ExcalidrawDrawingBlock extends BuilderBlock {
  readonly typeId: typeof excalidrawDrawingTypeId;
  readonly caption: string;
  readonly referenceId: string | null;
  readonly widthFraction: number;
  readonly canvasHeight: number;
  readonly scene: ExcalidrawScenePayload;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepFreezeJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return Object.freeze(value.map(deepFreezeJson));
  }
  if (isRecord(value)) {
    return Object.freeze(
      Object.fromEntries(
        Object.entries(value).map(([key, item]) => [key, deepFreezeJson(item)]),
      ),
    );
  }
  return value;
}

export function normalizeExcalidrawScene(value: unknown): ExcalidrawScenePayload {
  if (!isRecord(value)) {
    throw new Error("An Excalidraw scene must be an object");
  }
  const { type, version, source, elements, appState, files } = value;
  if (
    typeof type !== "string" ||
    !Number.isSafeInteger(version) ||
    typeof source !== "string" ||
    !Array.isArray(elements) ||
    !isRecord(appState) ||
    !isRecord(files)
  ) {
    throw new Error("An Excalidraw scene has an invalid canonical shape");
  }
  return deepFreezeJson({ type, version, source, elements, appState, files }) as
    ExcalidrawScenePayload;
}

export function createEmptyExcalidrawScene(): ExcalidrawScenePayload {
  return normalizeExcalidrawScene({
    type: "excalidraw",
    version: 2,
    source: "dans.typesetting",
    elements: [],
    appState: { viewBackgroundColor: "#ffffff" },
    files: {},
  });
}

export function isExcalidrawDrawingBlock(
  block: BuilderBlock,
): block is ExcalidrawDrawingBlock {
  return (
    block.typeId === excalidrawDrawingTypeId &&
    "caption" in block &&
    typeof block.caption === "string" &&
    "referenceId" in block &&
    (block.referenceId === null || typeof block.referenceId === "string") &&
    "widthFraction" in block &&
    typeof block.widthFraction === "number" &&
    "canvasHeight" in block &&
    typeof block.canvasHeight === "number" &&
    "scene" in block
  );
}

export function requireExcalidrawDrawingBlock(
  block: BuilderBlock,
): ExcalidrawDrawingBlock {
  if (!isExcalidrawDrawingBlock(block)) {
    throw new Error(`Excalidraw drawing plugin cannot consume ${block.typeId}`);
  }
  validateExcalidrawDrawingBlock(block);
  return block;
}

export function validateExcalidrawDrawingBlock(block: ExcalidrawDrawingBlock): void {
  if (block.caption.trim().length === 0) {
    throw new Error("An Excalidraw drawing requires a caption");
  }
  if (block.referenceId !== null && !/^[A-Za-z][A-Za-z0-9_.:-]*$/u.test(block.referenceId)) {
    throw new Error("An Excalidraw drawing reference ID is invalid");
  }
  if (block.widthFraction <= 0 || block.widthFraction > 1) {
    throw new Error("Excalidraw drawing widthFraction must be in (0, 1]");
  }
  if (
    !Number.isSafeInteger(block.canvasHeight) ||
    block.canvasHeight < drawingCanvasHeight.minimum ||
    block.canvasHeight > drawingCanvasHeight.maximum
  ) {
    throw new Error(
      `Excalidraw drawing canvasHeight must be an integer in [${String(drawingCanvasHeight.minimum)}, ${String(drawingCanvasHeight.maximum)}]`,
    );
  }
  normalizeExcalidrawScene(block.scene);
}
