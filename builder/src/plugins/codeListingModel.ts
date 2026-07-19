// Define the graphical semantic contract for source-code listings.
import type { BuilderBlock, BuilderInlineNode } from "../model/document";
import { validateOptionalReferenceId } from "../model/referenceId";
import { freezeRichCaption, validateRichCaption } from "./richCaptionModel";

export const codeListingTypeId = "dans.code.listing";
export type CodeListingLanguage = "cpp" | "cuda" | "julia" | "raw";

export interface CodeListingBlock extends BuilderBlock {
  readonly typeId: typeof codeListingTypeId;
  readonly language: CodeListingLanguage;
  readonly code: string;
  readonly captionInlines: readonly BuilderInlineNode[] | null;
  readonly referenceId: string | null;
}

export function createCodeListingBlock(
  id: string,
  language: CodeListingLanguage,
  code: string,
  captionInlines: readonly BuilderInlineNode[] | null = null,
  referenceId: string | null = null,
): CodeListingBlock {
  const block = Object.freeze({
    id,
    typeId: codeListingTypeId,
    language,
    code,
    captionInlines:
      captionInlines === null
        ? null
        : freezeRichCaption(captionInlines, "Code-listing caption"),
    referenceId,
  }) satisfies CodeListingBlock;
  validateCodeListingBlock(block);
  return block;
}

export function isCodeListingBlock(block: BuilderBlock): block is CodeListingBlock {
  return (
    block.typeId === codeListingTypeId &&
    "language" in block &&
    (block.language === "cpp" ||
      block.language === "cuda" ||
      block.language === "julia" ||
      block.language === "raw") &&
    "code" in block &&
    typeof block.code === "string" &&
    "captionInlines" in block &&
    (block.captionInlines === null || Array.isArray(block.captionInlines)) &&
    "referenceId" in block &&
    (block.referenceId === null || typeof block.referenceId === "string")
  );
}

export function requireCodeListingBlock(block: BuilderBlock): CodeListingBlock {
  if (!isCodeListingBlock(block)) {
    throw new Error(`Code-listing plugin cannot consume ${block.typeId}`);
  }
  validateCodeListingBlock(block);
  return block;
}

export function validateCodeListingBlock(block: CodeListingBlock): void {
  if (block.id.length === 0 || block.code.length === 0) {
    throw new Error("A code listing requires a stable ID and source code");
  }
  if (block.captionInlines !== null) {
    validateRichCaption(block.captionInlines, "Code-listing caption");
  }
  validateOptionalReferenceId(block.referenceId, "Listing reference ID");
}
