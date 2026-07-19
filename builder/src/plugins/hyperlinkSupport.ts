// Runtime shape and browser-target helpers for semantic hyperlinks.
import {
  isHyperlinkInline,
  type BuilderInlineNode,
  type HyperlinkInline,
} from "../model/document";

export function requireHyperlink(inline: BuilderInlineNode): HyperlinkInline {
  if (!isHyperlinkInline(inline)) {
    throw new Error(`Hyperlink plugin cannot consume ${inline.typeId}`);
  }
  return inline;
}

export function browserHyperlinkTarget(target: string): string {
  return /^[a-z][a-z0-9+.-]*:/iu.test(target) ? target : `https://${target}`;
}
