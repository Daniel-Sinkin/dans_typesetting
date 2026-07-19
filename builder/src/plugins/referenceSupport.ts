import {
  isReferenceInline,
  type BuilderInlineNode,
  type ReferenceInline,
} from "../model/document";

export function requireReference(inline: BuilderInlineNode): ReferenceInline {
  if (!isReferenceInline(inline)) {
    throw new Error(`Reference connector cannot consume ${inline.typeId}`);
  }
  return inline;
}
