// An uncaptioned image block; numbering belongs to an optional outer container.
import type { BuilderBlock } from "../model/document";

export const contentImageTypeId = "dans.image.content";

export interface ContentImageBlock extends BuilderBlock {
  readonly typeId: typeof contentImageTypeId;
  readonly source: string;
  readonly widthFraction: number;
  readonly preferredPixelWidth: number;
  readonly preferredPixelHeight: number;
}

export function createContentImageBlock(
  id: string,
  source: string,
  widthFraction = 0.72,
  preferredPixelWidth = 1280,
  preferredPixelHeight = 720,
): ContentImageBlock {
  const block = Object.freeze({
    id,
    typeId: contentImageTypeId,
    source,
    widthFraction,
    preferredPixelWidth,
    preferredPixelHeight,
  }) satisfies ContentImageBlock;
  validateContentImageBlock(block);
  return block;
}

export function isContentImageBlock(
  block: BuilderBlock,
): block is ContentImageBlock {
  return (
    block.typeId === contentImageTypeId &&
    "source" in block &&
    typeof block.source === "string" &&
    "widthFraction" in block &&
    typeof block.widthFraction === "number" &&
    "preferredPixelWidth" in block &&
    typeof block.preferredPixelWidth === "number" &&
    "preferredPixelHeight" in block &&
    typeof block.preferredPixelHeight === "number"
  );
}

export function requireContentImageBlock(block: BuilderBlock): ContentImageBlock {
  if (!isContentImageBlock(block)) {
    throw new Error(`Content-image plugin cannot consume ${block.typeId}`);
  }
  validateContentImageBlock(block);
  return block;
}

export function validateContentImageBlock(block: ContentImageBlock): void {
  if (block.id.length === 0 || block.source.trim().length === 0) {
    throw new Error("An image requires a stable ID and image source");
  }
  if (
    !Number.isFinite(block.widthFraction) ||
    block.widthFraction <= 0 ||
    block.widthFraction > 1
  ) {
    throw new Error("Image widthFraction must be in the interval (0, 1]");
  }
  if (
    !Number.isSafeInteger(block.preferredPixelWidth) ||
    !Number.isSafeInteger(block.preferredPixelHeight) ||
    block.preferredPixelWidth <= 0 ||
    block.preferredPixelHeight <= 0
  ) {
    throw new Error("Preferred image pixel dimensions must be positive integers");
  }
}
