import { describe, expect, it } from "vitest";

import {
  createHyperlinkInline,
  createReferenceInline,
  createText,
  isHyperlinkInline,
  isReferenceInline,
  isTextInline,
} from "../model/document";
import {
  createFootnoteInline,
  footnoteInlineTypeId,
  requireFootnote,
} from "./footnoteModel";
import { inlineCodeTypeId } from "./inlineCodeModel";
import { latexMathInlineTypeId } from "./latexMathModel";
import {
  expandParagraphAuthoringShortcuts,
  paragraphInlinesToSource,
  parseParagraphSource,
} from "./paragraphSource";

describe("keyboard-first paragraph source", () => {
  it("parses formatted links, LaTeX, code, references, notes, and citations", () => {
    const parsed = parseParagraphSource(
      "A **bold** [**Wikipedia**](www.en.wikipedia.org/) $x \\leftarrow x^{2n+1}$ `code` §reference§sec:intro§ §footnote§A note§ §citation§orus2014§",
    );

    expect(parsed.converted).toBe(true);
    expect(parsed.inlines.some((inline) => inline.typeId === latexMathInlineTypeId)).toBe(true);
    expect(parsed.inlines.some((inline) => inline.typeId === inlineCodeTypeId)).toBe(true);
    expect(parsed.inlines.some((inline) => inline.typeId === footnoteInlineTypeId)).toBe(true);
    expect(parsed.inlines.some(isReferenceInline)).toBe(true);
    const link = parsed.inlines.find(isHyperlinkInline);
    expect(link?.target).toBe("www.en.wikipedia.org/");
    expect(link?.labelInlines).toHaveLength(1);
    expect(link?.labelInlines[0]).toMatchObject({ text: "Wikipedia", style: "bold" });
  });

  it("accepts the proposed percent shortcuts as a compatibility spelling", () => {
    const parsed = parseParagraphSource(
      "%$x = 2^{2n + 1}$% %hyperlink%Wikipedia%www.en.wikipedia.org/%",
    );

    expect(parsed.inlines.some((inline) => inline.typeId === latexMathInlineTypeId)).toBe(true);
    expect(parsed.inlines.find(isHyperlinkInline)?.target).toBe(
      "www.en.wikipedia.org/",
    );
  });

  it("uses section signs as an explicit math escape when desired", () => {
    const parsed = parseParagraphSource("§$x = 2^{2n + 1}$§");

    expect(parsed.inlines).toHaveLength(1);
    expect(parsed.inlines[0]?.typeId).toBe(latexMathInlineTypeId);
  });

  it("round-trips the editable semantic subset through source mode", () => {
    const original = [
      createText("Styled", "styled", "bold_italic"),
      createText(" ", "space"),
      createHyperlinkInline(
        "https://example.com",
        [createText("link", "label", "italic")],
        "link",
      ),
      createText(" ", "space-2"),
      createReferenceInline("sec:intro", "reference"),
      createFootnoteInline([createText("note")], "note"),
    ];

    const reparsed = parseParagraphSource(paragraphInlinesToSource(original)).inlines;
    expect(reparsed.filter(isTextInline).map(({ text, style }) => ({ text, style }))).toEqual([
      { text: "Styled", style: "bold_italic" },
      { text: " ", style: "normal" },
      { text: " ", style: "normal" },
    ]);
    expect(reparsed.find(isHyperlinkInline)?.labelInlines[0]).toMatchObject({
      text: "link",
      style: "italic",
    });
    expect(reparsed.some(isReferenceInline)).toBe(true);
    expect(reparsed.some((inline) => inline.typeId === footnoteInlineTypeId)).toBe(true);
  });

  it("preserves nested formatting and commands inside footnotes", () => {
    const original = createFootnoteInline([
      createText("See "),
      createReferenceInline("sec:nested"),
      createText(" literally § and $5", undefined, "italic"),
    ]);

    const reparsed = parseParagraphSource(
      paragraphInlinesToSource([original]),
    ).inlines[0];

    expect(reparsed?.typeId).toBe(footnoteInlineTypeId);
    if (reparsed === undefined) {
      throw new Error("Footnote source did not produce a footnote");
    }
    const footnote = requireFootnote(reparsed);
    expect(footnote.inlines.some(isReferenceInline)).toBe(true);
    expect(footnote.inlines.filter(isTextInline).map(({ text }) => text).join(""))
      .toBe("See  literally § and $5");
    expect(footnote.inlines.at(-1)).toMatchObject({ style: "italic" });
  });

  it("escapes source punctuation that belongs to ordinary text", () => {
    const text = "Cost $5 and $6; write *literally*, `not code`, and §reference§no§.";
    const source = paragraphInlinesToSource([createText(text)]);
    const reparsed = parseParagraphSource(source);

    expect(reparsed.inlines).toHaveLength(1);
    expect(reparsed.inlines[0]).toMatchObject({ text, style: "normal" });
  });

  it("converts only completed shortcuts from normal Write-mode text", () => {
    const expanded = expandParagraphAuthoringShortcuts([
      createText("before $x^2$ after"),
      createText(" $unfinished", undefined, "bold"),
    ]);

    expect(expanded.converted).toBe(true);
    expect(expanded.inlines.some((inline) => inline.typeId === latexMathInlineTypeId)).toBe(true);
    expect(expanded.inlines.at(-1)).toMatchObject({
      text: " $unfinished",
      style: "bold",
    });
  });
});
