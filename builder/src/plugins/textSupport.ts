// Shared semantic checks for the ordinary-text inline plugin.
import {
  isTextInline,
  type BuilderInlineNode,
  type TextInline,
} from "../model/document";

export function requireText(inline: BuilderInlineNode): TextInline {
  if (!isTextInline(inline)) {
    throw new Error(`Core-text plugin cannot consume ${inline.typeId}`);
  }
  return inline;
}
