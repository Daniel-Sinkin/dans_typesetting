// Shared semantic checks for the graphical code-listing connector.
import {
  isCodeListingBlock,
  type BuilderBlock,
  type CodeListingBlock,
  type CodeListingLanguage,
} from "../model/document";

export function requireCodeListing(block: BuilderBlock): CodeListingBlock {
  if (!isCodeListingBlock(block)) {
    throw new Error(`Code-listing plugin cannot consume ${block.typeId}`);
  }
  return block;
}

export function codeListingLanguageLabel(language: CodeListingLanguage): string {
  switch (language) {
    case "cpp":
      return "C++";
    case "julia":
      return "Julia";
  }
}
