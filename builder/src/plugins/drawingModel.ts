// Semantic payload owned by the embedded Excalidraw drawing plugin.
import type { BuilderBlock } from "../model/document";
import { validateOptionalReferenceId } from "../model/referenceId";

export const excalidrawDrawingTypeId = "dans.drawing.excalidraw";

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
  readonly scene: ExcalidrawScenePayload;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const drawingExportPadding = 16;
const emptyDrawingAspectRatio = 16 / 9;

function finiteNumber(record: Readonly<Record<string, unknown>>, key: string): number | null {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function excalidrawSceneAspectRatio(scene: ExcalidrawScenePayload): number {
  let minimumX = Number.POSITIVE_INFINITY;
  let minimumY = Number.POSITIVE_INFINITY;
  let maximumX = Number.NEGATIVE_INFINITY;
  let maximumY = Number.NEGATIVE_INFINITY;
  for (const value of scene.elements) {
    if (!isRecord(value) || value.isDeleted === true) {
      continue;
    }
    const x = finiteNumber(value, "x");
    const y = finiteNumber(value, "y");
    const width = finiteNumber(value, "width");
    const height = finiteNumber(value, "height");
    if (x === null || y === null || width === null || height === null) {
      continue;
    }
    const angle = finiteNumber(value, "angle") ?? 0;
    const rotatedWidth =
      Math.abs(width * Math.cos(angle)) + Math.abs(height * Math.sin(angle));
    const rotatedHeight =
      Math.abs(width * Math.sin(angle)) + Math.abs(height * Math.cos(angle));
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    minimumX = Math.min(minimumX, centerX - rotatedWidth / 2);
    maximumX = Math.max(maximumX, centerX + rotatedWidth / 2);
    minimumY = Math.min(minimumY, centerY - rotatedHeight / 2);
    maximumY = Math.max(maximumY, centerY + rotatedHeight / 2);
  }
  if (![minimumX, minimumY, maximumX, maximumY].every(Number.isFinite)) {
    return emptyDrawingAspectRatio;
  }
  const contentWidth = maximumX - minimumX + drawingExportPadding * 2;
  const contentHeight = maximumY - minimumY + drawingExportPadding * 2;
  return contentWidth > 0 && contentHeight > 0
    ? contentWidth / contentHeight
    : emptyDrawingAspectRatio;
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
  validateOptionalReferenceId(block.referenceId, "Excalidraw drawing reference ID");
  if (
    !Number.isFinite(block.widthFraction) ||
    block.widthFraction <= 0 ||
    block.widthFraction > 1
  ) {
    throw new Error("Excalidraw drawing widthFraction must be in (0, 1]");
  }
  normalizeExcalidrawScene(block.scene);
}
