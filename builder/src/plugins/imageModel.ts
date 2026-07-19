// Define the graphical semantic contract for ordinary figure images.
import type { BuilderBlock, BuilderInlineNode } from "../model/document";
import { validateOptionalReferenceId } from "../model/referenceId";
import { freezeRichCaption, validateRichCaption } from "./richCaptionModel";

export const imageTypeId = "dans.image.figure";

export interface ImageBlock extends BuilderBlock {
  readonly typeId: typeof imageTypeId;
  readonly source: string;
  readonly captionInlines: readonly BuilderInlineNode[];
  readonly referenceId: string | null;
  readonly widthFraction: number;
  readonly preferredPixelWidth: number;
  readonly preferredPixelHeight: number;
}

export function createImageBlock(
  id: string,
  source: string,
  captionInlines: readonly BuilderInlineNode[],
  referenceId: string | null = null,
  widthFraction = 0.72,
  preferredPixelWidth = 1280,
  preferredPixelHeight = 720,
): ImageBlock {
  const block = Object.freeze({
    id,
    typeId: imageTypeId,
    source,
    captionInlines: freezeRichCaption(captionInlines, "Figure caption"),
    referenceId,
    widthFraction,
    preferredPixelWidth,
    preferredPixelHeight,
  }) satisfies ImageBlock;
  validateImageBlock(block);
  return block;
}

export function isImageBlock(block: BuilderBlock): block is ImageBlock {
  return (
    block.typeId === imageTypeId &&
    "source" in block &&
    typeof block.source === "string" &&
    "captionInlines" in block &&
    Array.isArray(block.captionInlines) &&
    "referenceId" in block &&
    (block.referenceId === null || typeof block.referenceId === "string") &&
    "widthFraction" in block &&
    typeof block.widthFraction === "number" &&
    "preferredPixelWidth" in block &&
    typeof block.preferredPixelWidth === "number" &&
    "preferredPixelHeight" in block &&
    typeof block.preferredPixelHeight === "number"
  );
}

export function requireImageBlock(block: BuilderBlock): ImageBlock {
  if (!isImageBlock(block)) {
    throw new Error(`Image plugin cannot consume ${block.typeId}`);
  }
  validateImageBlock(block);
  return block;
}

export function validateImageBlock(block: ImageBlock): void {
  if (block.id.length === 0 || block.source.trim().length === 0) {
    throw new Error("A figure requires a stable ID and image source");
  }
  validateRichCaption(block.captionInlines, "Figure caption");
  validateOptionalReferenceId(block.referenceId, "Figure reference ID");
  if (
    !Number.isFinite(block.widthFraction) ||
    block.widthFraction <= 0 ||
    block.widthFraction > 1
  ) {
    throw new Error("Figure widthFraction must be in the interval (0, 1]");
  }
  if (
    !Number.isSafeInteger(block.preferredPixelWidth) ||
    !Number.isSafeInteger(block.preferredPixelHeight) ||
    block.preferredPixelWidth <= 0 ||
    block.preferredPixelHeight <= 0
  ) {
    throw new Error("Preferred figure pixel dimensions must be positive integers");
  }
}
