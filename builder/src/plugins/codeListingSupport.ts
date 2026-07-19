// Shared semantic checks for the graphical code-listing connector.
import type { BuilderBlock } from "../model/document";
import {
  isCodeListingBlock,
  validateCodeListingBlock,
  type CodeListingBlock,
  type CodeListingLanguage,
} from "./codeListingModel";

export function requireCodeListing(block: BuilderBlock): CodeListingBlock {
  if (!isCodeListingBlock(block)) {
    throw new Error(`Code-listing plugin cannot consume ${block.typeId}`);
  }
  validateCodeListingBlock(block);
  return block;
}

export function codeListingLanguageLabel(language: CodeListingLanguage): string {
  switch (language) {
    case "cpp":
      return "C++";
    case "cuda":
      return "CUDA";
    case "julia":
      return "Julia";
    case "raw":
      return "Raw text";
  }
}
