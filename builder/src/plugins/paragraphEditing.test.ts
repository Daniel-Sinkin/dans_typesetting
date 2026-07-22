import { describe, expect, it } from "vitest";

import { createText, type BuilderInlineNode } from "../model/document";
import { createInlineCode } from "./inlineCode";
import {
  paragraphAtomIdAttribute,
  paragraphTextIdAttribute,
  paragraphTextStyleAttribute,
  readParagraphComposerInlines,
} from "./paragraphEditing";

function composer(source: string): HTMLDivElement {
  const root = document.createElement("div");
  root.innerHTML = source;
  return root;
}

describe("paragraph writing surface", () => {
  it("reads direct browser text edits and selection formatting as semantic text runs", () => {
    const root = composer(
      `<span ${paragraphTextIdAttribute}="original" ${paragraphTextStyleAttribute}="normal">` +
        `Direct <strong>bold <em>and italic</em></strong> text` +
        `</span>`,
    );

    expect(readParagraphComposerInlines(root, [createText("Old", "original")])).toMatchObject([
      { id: "original", text: "Direct ", style: "normal" },
      { text: "bold ", style: "bold" },
      { text: "and italic", style: "bold_italic" },
      { text: " text", style: "normal" },
    ]);
  });

  it("keeps atomic inline payloads in their exact position without reading chip labels", () => {
    const code = createInlineCode("cudaDeviceSynchronize()", "code");
    const current: readonly BuilderInlineNode[] = [
      createText("Before ", "before"),
      code,
      createText(" after", "after", "italic"),
    ];
    const root = composer(
      `<span ${paragraphTextIdAttribute}="before">Before edited </span>` +
        `<span ${paragraphAtomIdAttribute}="code">Inline code: ignored label</span>` +
        `<span ${paragraphTextIdAttribute}="after" ${paragraphTextStyleAttribute}="italic"> after</span>`,
    );

    const result = readParagraphComposerInlines(root, current);
    expect(result).toMatchObject([
      { id: "before", text: "Before edited ", style: "normal" },
      { id: "code", code: "cudaDeviceSynchronize()" },
      { id: "after", text: " after", style: "italic" },
    ]);
    expect(result[1]).toBe(code);
  });

  it("normalizes browser block breaks and removes atoms deleted from the surface", () => {
    const root = composer("<div>First line</div><div>Second line</div>");
    const result = readParagraphComposerInlines(root, [
      createText("old", "old"),
      createInlineCode("removed", "removed"),
    ]);

    expect(result).toHaveLength(2);
    expect(result.map((inline) => ("text" in inline ? inline.text : ""))).toEqual([
      "First line\n",
      "Second line",
    ]);
    expect(result.some(({ id }) => id === "removed")).toBe(false);
  });

  it("keeps an ID stable while the browser mutates a newly typed text node", () => {
    const root = composer("New");
    const first = readParagraphComposerInlines(root, []);
    const textNode = root.firstChild;
    if (!(textNode instanceof Text)) {
      throw new Error("The composer did not create a browser text node");
    }
    textNode.appendData(" text");
    const second = readParagraphComposerInlines(root, first);

    expect(second).toMatchObject([{ id: first[0]?.id, text: "New text" }]);
  });
});
