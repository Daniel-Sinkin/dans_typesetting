// Generic semantic caption/numbering wrapper around exactly one document block.
import {
  childBlockSequences,
  createChildBlockSequence,
  type BuilderBlock,
  type BuilderChildBlockSequence,
  type BuilderInlineNode,
} from "../model/document";
import { validateOptionalReferenceId } from "../model/referenceId";
import { freezeRichCaption, validateRichCaption } from "./richCaptionModel";

export const captionedTypeId = "dans.layout.captioned";
export const captionedContentSequenceId = "content";

export interface CaptionedBlock extends BuilderBlock {
  readonly typeId: typeof captionedTypeId;
  readonly category: string | null;
  readonly captionInlines: readonly BuilderInlineNode[];
  readonly referenceId: string | null;
  readonly childSequences: readonly BuilderChildBlockSequence[];
}

export function isValidNumberingCategory(category: string): boolean {
  return !(
    category.length === 0 ||
    category.trim() !== category ||
    Array.from(category).some((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint < 0x20 || codePoint === 0x7f;
    })
  );
}

export function validateNumberingCategory(category: string): void {
  if (!isValidNumberingCategory(category)) {
    throw new Error(
      "A numbering category must be non-empty, trimmed, and contain no control characters",
    );
  }
}

function createCaptionedShape(
  id: string,
  content: readonly BuilderBlock[],
  category: string | null,
  captionInlines: readonly BuilderInlineNode[],
  referenceId: string | null,
): CaptionedBlock {
  return Object.freeze({
    id,
    typeId: captionedTypeId,
    category,
    captionInlines: freezeRichCaption(
      captionInlines,
      "Captioned caption",
      false,
    ),
    referenceId,
    childSequences: Object.freeze([
      createChildBlockSequence(captionedContentSequenceId, content),
    ]),
  });
}

export function createCaptionedBlock(
  id: string,
  content: BuilderBlock,
  category: string | null,
  captionInlines: readonly BuilderInlineNode[] = [],
  referenceId: string | null = null,
): CaptionedBlock {
  const block = createCaptionedShape(
    id,
    [content],
    category,
    captionInlines,
    referenceId,
  );
  validateCaptionedBlock(block);
  return block;
}

// Copy infrastructure needs an empty shell before it recursively copies the
// original child. It must never be published directly through DocumentPort.
export function createCaptionedCopyShell(
  id: string,
  category: string | null,
  captionInlines: readonly BuilderInlineNode[],
): CaptionedBlock {
  return createCaptionedShape(id, [], category, captionInlines, null);
}

export function isCaptionedBlock(block: BuilderBlock): block is CaptionedBlock {
  return (
    block.typeId === captionedTypeId &&
    "category" in block &&
    (block.category === null || typeof block.category === "string") &&
    "captionInlines" in block &&
    Array.isArray(block.captionInlines) &&
    "referenceId" in block &&
    (block.referenceId === null || typeof block.referenceId === "string") &&
    childBlockSequences(block).length === 1 &&
    childBlockSequences(block)[0]?.id === captionedContentSequenceId
  );
}

export function requireCaptionedBlock(block: BuilderBlock): CaptionedBlock {
  if (!isCaptionedBlock(block)) {
    throw new Error(`Captioned plugin cannot consume ${block.typeId}`);
  }
  validateCaptionedBlock(block);
  return block;
}

export function captionedContent(block: CaptionedBlock): BuilderBlock {
  const content = block.childSequences[0];
  if (
    content?.id !== captionedContentSequenceId ||
    content.blocks.length !== 1 ||
    content.blocks[0] === undefined
  ) {
    throw new Error("A Captioned block must own exactly one content block");
  }
  return content.blocks[0];
}

export function validateCaptionedBlock(block: CaptionedBlock): void {
  if (block.id.length === 0) {
    throw new Error("A Captioned block requires a stable ID");
  }
  if (block.category !== null) {
    validateNumberingCategory(block.category);
  }
  if (block.category === null && block.referenceId !== null) {
    throw new Error("An unnumbered Captioned block cannot expose a reference ID");
  }
  validateOptionalReferenceId(block.referenceId, "Captioned reference ID");
  validateRichCaption(block.captionInlines, "Captioned caption", false);
  captionedContent(block);
}
