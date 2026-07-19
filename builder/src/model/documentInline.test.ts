import { describe, expect, it } from "vitest";

import {
  createHyperlinkInline,
  createMathInline,
  createText,
  MemoryDocumentPort,
  paragraphTypeId,
  type BuilderInlineNode,
  type ParagraphBlock,
} from "./document";
import { createMathBinary, createMathIdentifier, createMathInteger } from "./math";

function paragraph(inlines: readonly BuilderInlineNode[]): ParagraphBlock {
  return { id: "paragraph", typeId: paragraphTypeId, inlines };
}

describe("paragraph inline transport", () => {
  it("uses the same semantic paragraph IDs and explicit text styles as native C++", () => {
    const text = createText("important", "text", "bold_italic");
    expect(paragraphTypeId).toBe("dans.core.paragraph");
    expect(text).toEqual({
      id: "text",
      typeId: "dans.core.text",
      text: "important",
      style: "bold_italic",
    });
    expect(() => new MemoryDocumentPort([paragraph([text])])).not.toThrow();
  });

  it("validates structured inline mathematics at the document boundary", () => {
    const expression = createMathBinary(
      "equals",
      createMathIdentifier("x"),
      createMathInteger(4),
    );
    const inline = createMathInline(expression, "math");
    expect(() => new MemoryDocumentPort([paragraph([inline])])).not.toThrow();
    expect(inline.typeId).toBe("dans.math.inline");
  });

  it("supports target-only and rich-label hyperlinks but rejects unsafe targets and nesting", () => {
    const targetOnly = createHyperlinkInline("www.example.com", [], "target-only");
    const labelled = createHyperlinkInline(
      "https://example.com/results",
      [createText("results", "label", "bold")],
      "labelled",
    );
    expect(() => new MemoryDocumentPort([paragraph([targetOnly, labelled])])).not.toThrow();

    expect(
      () =>
        new MemoryDocumentPort([
          paragraph([createHyperlinkInline("bad target", [], "bad")]),
        ]),
    ).toThrow(/hyperlink target/iu);
    expect(
      () =>
        new MemoryDocumentPort([
          paragraph([
            createHyperlinkInline(
              "outer.example",
              [createHyperlinkInline("inner.example", [], "inner")],
              "outer",
            ),
          ]),
        ]),
    ).toThrow(/cannot contain another hyperlink/iu);
  });
});
