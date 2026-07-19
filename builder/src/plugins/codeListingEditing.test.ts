import { describe, expect, it } from "vitest";

import { insertSpacesAtSelection } from "./codeListingEditing";

describe("code-listing source editing", () => {
  it("replaces the current selection with four spaces and places the caret after them", () => {
    expect(insertSpacesAtSelection("abXYZcd", 2, 5)).toEqual({
      value: "ab    cd",
      selectionStart: 6,
      selectionEnd: 6,
    });
  });

  it("rejects selections outside the source text", () => {
    expect(() => insertSpacesAtSelection("abc", 2, 4)).toThrow(/within the source/u);
  });
});
