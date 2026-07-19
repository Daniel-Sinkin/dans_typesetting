// Semantic data owned by the inline-code plugin.
import type { BuilderInlineNode } from "../model/document";

export const inlineCodeTypeId = "dans.code.inline";

export interface InlineCodeInline extends BuilderInlineNode {
  readonly typeId: typeof inlineCodeTypeId;
  readonly code: string;
}

function validateInlineCode(code: string): void {
  if (code.includes("\n") || code.includes("\r")) {
    throw new Error("Inline code cannot contain a line break");
  }
}

export function createInlineCode(
  code = "code",
  id: string = globalThis.crypto.randomUUID(),
): InlineCodeInline {
  validateInlineCode(code);
  return Object.freeze({ id, typeId: inlineCodeTypeId, code });
}

export function isInlineCode(inline: BuilderInlineNode): inline is InlineCodeInline {
  return (
    inline.typeId === inlineCodeTypeId &&
    "code" in inline &&
    typeof inline.code === "string" &&
    !inline.code.includes("\n") &&
    !inline.code.includes("\r")
  );
}

export function requireInlineCode(inline: BuilderInlineNode): InlineCodeInline {
  if (!isInlineCode(inline)) {
    throw new Error(`Inline-code plugin cannot consume ${inline.typeId}`);
  }
  return inline;
}
