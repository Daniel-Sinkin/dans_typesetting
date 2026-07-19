// Semantic two-panel figure model owned by the figure-pair extension.
import type { BuilderBlock, BuilderInlineNode } from "../model/document";
import { validateOptionalReferenceId } from "../model/referenceId";

export const figurePairTypeId = "dans.image.figure_pair";

export interface BuilderFigurePanel {
  readonly id: string;
  readonly source: string;
  readonly captionInlines: readonly BuilderInlineNode[];
  readonly referenceId: string | null;
  readonly preferredPixelWidth: number;
  readonly preferredPixelHeight: number;
}

export interface FigurePairBlock extends BuilderBlock {
  readonly typeId: typeof figurePairTypeId;
  readonly panels: readonly [BuilderFigurePanel, BuilderFigurePanel];
  readonly captionInlines: readonly BuilderInlineNode[];
  readonly referenceId: string | null;
  readonly panelWidthFraction: number;
}

export function createFigurePanel(
  id: string,
  source: string,
  captionInlines: readonly BuilderInlineNode[],
  referenceId: string | null = null,
  preferredPixelWidth = 1280,
  preferredPixelHeight = 720,
): BuilderFigurePanel {
  return Object.freeze({
    id,
    source,
    captionInlines: Object.freeze([...captionInlines]),
    referenceId,
    preferredPixelWidth,
    preferredPixelHeight,
  });
}

export function createFigurePairBlock(
  id: string,
  first: BuilderFigurePanel,
  second: BuilderFigurePanel,
  captionInlines: readonly BuilderInlineNode[],
  referenceId: string | null = null,
  panelWidthFraction = 0.48,
): FigurePairBlock {
  const panels: FigurePairBlock["panels"] = Object.freeze([first, second]);
  const block = Object.freeze({
    id,
    typeId: figurePairTypeId,
    panels,
    captionInlines: Object.freeze([...captionInlines]),
    referenceId,
    panelWidthFraction,
  }) satisfies FigurePairBlock;
  validateFigurePairBlock(block);
  return block;
}

export function isFigurePairBlock(block: BuilderBlock): block is FigurePairBlock {
  return (
    block.typeId === figurePairTypeId &&
    "panels" in block &&
    Array.isArray(block.panels) &&
    block.panels.length === 2 &&
    "captionInlines" in block &&
    Array.isArray(block.captionInlines) &&
    "referenceId" in block &&
    (block.referenceId === null || typeof block.referenceId === "string") &&
    "panelWidthFraction" in block &&
    typeof block.panelWidthFraction === "number"
  );
}

export function requireFigurePairBlock(block: BuilderBlock): FigurePairBlock {
  if (!isFigurePairBlock(block)) {
    throw new Error(`Figure-pair plugin cannot consume ${block.typeId}`);
  }
  validateFigurePairBlock(block);
  return block;
}

function validateInlineRoots(
  inlines: readonly BuilderInlineNode[],
  context: string,
  seenInlineIds: Set<string>,
): void {
  if (inlines.length === 0) {
    throw new Error(`${context} requires at least one inline node`);
  }
  for (const inline of inlines) {
    if (inline.id.length === 0 || inline.typeId.length === 0) {
      throw new Error(`${context} inline nodes require stable IDs and type IDs`);
    }
    if (seenInlineIds.has(inline.id)) {
      throw new Error(`Duplicate figure-pair inline ID: ${inline.id}`);
    }
    seenInlineIds.add(inline.id);
  }
}

function validatePanel(
  panel: BuilderFigurePanel,
  context: string,
  seenInlineIds: Set<string>,
): void {
  if (panel.id.length === 0 || panel.source.trim().length === 0) {
    throw new Error(`${context} requires a stable ID and image source`);
  }
  validateOptionalReferenceId(panel.referenceId, `${context} reference ID`);
  if (
    !Number.isSafeInteger(panel.preferredPixelWidth) ||
    !Number.isSafeInteger(panel.preferredPixelHeight) ||
    panel.preferredPixelWidth <= 0 ||
    panel.preferredPixelHeight <= 0
  ) {
    throw new Error(`${context} preferred pixel dimensions must be positive integers`);
  }
  validateInlineRoots(panel.captionInlines, `${context} caption`, seenInlineIds);
}

export function validateFigurePairBlock(block: FigurePairBlock): void {
  if (block.id.length === 0) {
    throw new Error("A figure pair requires a stable ID");
  }
  validateOptionalReferenceId(block.referenceId, "Figure-pair reference ID");
  if (
    !Number.isFinite(block.panelWidthFraction) ||
    block.panelWidthFraction <= 0 ||
    block.panelWidthFraction > 0.5
  ) {
    throw new Error("Figure-pair panelWidthFraction must be in the interval (0, 0.5]");
  }
  if (block.panels[0].id === block.panels[1].id) {
    throw new Error("Figure-pair panels require distinct stable IDs");
  }
  const referenceIds = [
    ...(block.referenceId === null ? [] : [block.referenceId]),
    ...block.panels.flatMap((panel) =>
      panel.referenceId === null ? [] : [panel.referenceId],
    ),
  ];
  if (new Set(referenceIds).size !== referenceIds.length) {
    throw new Error("Figure-pair group and panel reference IDs must be distinct");
  }
  const seenInlineIds = new Set<string>();
  validateInlineRoots(block.captionInlines, "Figure-pair caption", seenInlineIds);
  validatePanel(block.panels[0], "First figure panel", seenInlineIds);
  validatePanel(block.panels[1], "Second figure panel", seenInlineIds);
}
