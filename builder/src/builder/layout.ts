// builder/src/builder/layout.ts — compute deterministic vertical document flow and insertions.
import type { BuilderPluginRegistry } from "./plugin";
import type { BuilderBlock } from "../model/document";

export interface LayoutBounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export const pageGeometry = Object.freeze({
  x: 0,
  y: 0,
  width: 794,
  minimumHeight: 1123,
  contentInsetX: 76,
  contentInsetTop: 88,
  contentInsetBottom: 92,
  blockGap: 26,
});

export interface BlockLayout {
  readonly block: BuilderBlock;
  readonly bounds: LayoutBounds;
}

export interface InsertionPreview {
  readonly index: number;
  readonly block: BuilderBlock;
}

export interface DocumentLayout {
  readonly pageBounds: LayoutBounds;
  readonly contentBounds: LayoutBounds;
  readonly blocks: readonly BlockLayout[];
  readonly previewBounds: LayoutBounds | null;
}

function measuredBounds(
  block: BuilderBlock,
  y: number,
  registry: BuilderPluginRegistry,
): LayoutBounds {
  const width = pageGeometry.width - 2 * pageGeometry.contentInsetX;
  const plugin = registry.pluginForBlock(block);
  const height = plugin.measure(block, width);
  if (!Number.isFinite(height) || height <= 0) {
    throw new Error(`Builder adapter for ${block.typeId} returned an invalid block height`);
  }
  return { x: pageGeometry.x + pageGeometry.contentInsetX, y, width, height };
}

export function computeDocumentLayout(
  blocks: readonly BuilderBlock[],
  registry: BuilderPluginRegistry,
  preview: InsertionPreview | null = null,
): DocumentLayout {
  if (preview !== null && (preview.index < 0 || preview.index > blocks.length)) {
    throw new RangeError(`Preview index ${String(preview.index)} is outside the document`);
  }

  let cursorY = pageGeometry.y + pageGeometry.contentInsetTop;
  let previewBounds: LayoutBounds | null = null;
  const blockLayouts: BlockLayout[] = [];

  for (let index = 0; index <= blocks.length; index += 1) {
    if (preview !== null && preview.index === index) {
      previewBounds = measuredBounds(preview.block, cursorY, registry);
      cursorY += previewBounds.height + pageGeometry.blockGap;
    }

    const block = blocks[index];
    if (block === undefined) {
      continue;
    }

    const bounds = measuredBounds(block, cursorY, registry);
    blockLayouts.push({ block, bounds });
    cursorY += bounds.height + pageGeometry.blockGap;
  }

  const contentBottom = cursorY - pageGeometry.blockGap + pageGeometry.contentInsetBottom;
  const pageHeight = Math.max(pageGeometry.minimumHeight, contentBottom - pageGeometry.y);
  const pageBounds = {
    x: pageGeometry.x,
    y: pageGeometry.y,
    width: pageGeometry.width,
    height: pageHeight,
  };

  return {
    pageBounds,
    contentBounds: {
      x: pageGeometry.x + pageGeometry.contentInsetX,
      y: pageGeometry.y + pageGeometry.contentInsetTop,
      width: pageGeometry.width - 2 * pageGeometry.contentInsetX,
      height: pageHeight - pageGeometry.contentInsetTop - pageGeometry.contentInsetBottom,
    },
    blocks: blockLayouts,
    previewBounds,
  };
}

export function insertionIndexAtSceneY(sceneY: number, baseLayout: DocumentLayout): number {
  for (const [index, layout] of baseLayout.blocks.entries()) {
    if (sceneY < layout.bounds.y + layout.bounds.height / 2) {
      return index;
    }
  }
  return baseLayout.blocks.length;
}

export function isInsideDocumentColumn(
  sceneX: number,
  sceneY: number,
  layout: DocumentLayout,
): boolean {
  const horizontalTolerance = 32;
  return (
    sceneX >= layout.contentBounds.x - horizontalTolerance &&
    sceneX <= layout.contentBounds.x + layout.contentBounds.width + horizontalTolerance &&
    sceneY >= layout.pageBounds.y &&
    sceneY <= layout.pageBounds.y + layout.pageBounds.height
  );
}
