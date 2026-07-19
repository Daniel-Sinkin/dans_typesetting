// Runtime shape guard shared by inline-math descriptor and React views.
import {
  isMathInline,
  type BuilderInlineNode,
  type MathInline,
} from "../model/document";

export function requireInlineMath(inline: BuilderInlineNode): MathInline {
  if (!isMathInline(inline)) {
    throw new Error(`Inline-math plugin cannot consume ${inline.typeId}`);
  }
  return inline;
}
