import { describe, expect, it } from "vitest";

import {
  defaultDocumentMetadata,
  isParagraphBlock,
  paragraphTypeId,
  type ParagraphBlock,
} from "../model/document";
import { projectDocumentTransport } from "../transport/projectTransport";
import { latexMathDisplayPlugin } from "./latexMath";
import {
  createLatexMathDisplay,
  createLatexMathInline,
  latexMathDisplayTypeId,
  latexMathInlineTypeId,
  requireLatexMathDisplay,
  requireLatexMathInline,
} from "./latexMathModel";
import { renderLatexMath } from "./latexMathRendering";

function requireArrayItem<T>(values: readonly T[], index: number, context: string): T {
  const value = values[index];
  if (value === undefined) {
    throw new Error(`${context} did not contain item ${String(index)}`);
  }
  return value;
}

describe("source-authored LaTeX mathematics", () => {
  it("owns source inside implicit delimiters and enforces its scoped shape", () => {
    expect(createLatexMathInline(String.raw`E = mc^2`, "inline")).toEqual({
      id: "inline",
      typeId: latexMathInlineTypeId,
      source: String.raw`E = mc^2`,
    });
    expect(
      createLatexMathDisplay(
        String.raw`\sum_{i=1}^{N} i`,
        true,
        "eq:sum",
        "display",
      ),
    ).toEqual({
      id: "display",
      typeId: latexMathDisplayTypeId,
      source: String.raw`\sum_{i=1}^{N} i`,
      numbered: true,
      referenceId: "eq:sum",
    });

    expect(() => createLatexMathInline("   ", "empty")).toThrow(/empty/u);
    expect(() => createLatexMathInline("x\ny", "multiline")).toThrow(/one line/u);
    expect(() => createLatexMathInline("$x$", "delimited")).toThrow(/implicit/u);
    expect(() => createLatexMathDisplay("$$x$$", true, null, "delimited")).toThrow(
      /implicit/u,
    );
    expect(() =>
      createLatexMathDisplay("x", false, "eq:invalid", "unnumbered"),
    ).toThrow(/Unnumbered/u);
  });

  it("round-trips inline and display values exactly through canonical transport", () => {
    const paragraph: ParagraphBlock = Object.freeze({
      id: "paragraph",
      typeId: paragraphTypeId,
      inlines: Object.freeze([
        createLatexMathInline(String.raw`\rho = e^{-\beta H}`, "inline"),
      ]),
    });
    const source = projectDocumentTransport.toString({
      revision: 0,
      metadata: defaultDocumentMetadata,
      blocks: Object.freeze([
        paragraph,
        createLatexMathDisplay(
          String.raw`\mathcal{Z} = \operatorname{Tr}(e^{-\beta H})`,
          true,
          "eq:partition-function",
          "display",
        ),
      ]),
    });
    const decoded = projectDocumentTransport.fromString(source);

    expect(projectDocumentTransport.toString({ ...decoded, revision: 0 })).toBe(source);
    const decodedParagraph = requireArrayItem(decoded.blocks, 0, "Decoded document");
    if (!isParagraphBlock(decodedParagraph)) {
      throw new Error("Decoded paragraph had the wrong semantic type");
    }
    expect(
      requireLatexMathInline(
        requireArrayItem(decodedParagraph.inlines, 0, "Decoded paragraph"),
      ),
    ).toEqual(requireArrayItem(paragraph.inlines, 0, "Source paragraph"));
    expect(
      requireLatexMathDisplay(requireArrayItem(decoded.blocks, 1, "Decoded document")),
    ).toMatchObject({
      numbered: true,
      referenceId: "eq:partition-function",
    });
  });

  it("renders valid source through KaTeX and reports invalid commands", () => {
    const inline = renderLatexMath(String.raw`E = mc^2`, false);
    expect(inline.error).toBeNull();
    expect(inline.html).toContain("katex");
    expect(inline.html).toContain("katex-mathml");

    const invalid = renderLatexMath(String.raw`\definitelyNotAKatexCommand{x}`, true);
    expect(invalid.html).toBeNull();
    expect(invalid.error).toMatch(/undefined control sequence/iu);
  });

  it("numbers only numbered blocks and clears references when copied", () => {
    const numbered = createLatexMathDisplay("x = y", true, "eq:x", "source");
    const unnumbered = createLatexMathDisplay("x = y", false, null, "plain");

    expect(latexMathDisplayPlugin.numberedOccurrences?.(numbered)).toEqual([
      { occurrenceId: "source", numberingSeries: "Equation" },
    ]);
    expect(latexMathDisplayPlugin.numberedOccurrences?.(unnumbered)).toEqual([]);
    const copyForInsert = latexMathDisplayPlugin.copyForInsert;
    if (copyForInsert === undefined) {
      throw new Error("LaTeX display-math plugin does not implement copying");
    }
    expect(requireLatexMathDisplay(copyForInsert(numbered, "copy"))).toEqual({
      id: "copy",
      typeId: latexMathDisplayTypeId,
      source: "x = y",
      numbered: true,
      referenceId: null,
    });
  });
});
