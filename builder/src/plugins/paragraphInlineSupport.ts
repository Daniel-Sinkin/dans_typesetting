// Shared semantic checks for Core Paragraph inline connectors.
import {
  isParagraphTextInline,
  type BuilderInlineNode,
  type ParagraphTextInline,
} from "../model/document";

export function requireParagraphText(inline: BuilderInlineNode): ParagraphTextInline {
  if (!isParagraphTextInline(inline)) {
    throw new Error(`Core-text plugin cannot consume ${inline.typeId}`);
  }
  return inline;
}
