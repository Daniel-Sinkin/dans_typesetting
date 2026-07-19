import { describe, expect, it } from "vitest";

import { createText } from "./document";
import { insertInlineNode, moveInlineNode, removeInlineNode } from "./inlineSequence";

const one = createText("one", "one");
const two = createText("two", "two");
const three = createText("three", "three");

describe("inline-sequence operations", () => {
  it("inserts and removes stable inline nodes", () => {
    const inserted = insertInlineNode([one, three], 1, two);
    expect(inserted.map((inline) => inline.id)).toEqual(["one", "two", "three"]);
    expect(removeInlineNode(inserted, 1).map((inline) => inline.id)).toEqual([
      "one",
      "three",
    ]);
    expect(Object.isFrozen(inserted)).toBe(true);
  });

  it("moves nodes using insertion points from the visible original sequence", () => {
    expect(moveInlineNode([one, two, three], 0, 3).map((inline) => inline.id)).toEqual([
      "two",
      "three",
      "one",
    ]);
    expect(moveInlineNode([one, two, three], 2, 0).map((inline) => inline.id)).toEqual([
      "three",
      "one",
      "two",
    ]);
    expect(moveInlineNode([one, two, three], 1, 2).map((inline) => inline.id)).toEqual([
      "one",
      "two",
      "three",
    ]);
  });

  it("rejects invalid positions and duplicate IDs", () => {
    expect(() => insertInlineNode([one], 2, two)).toThrow(RangeError);
    expect(() => insertInlineNode([one], 1, createText("copy", "one"))).toThrow(
      /Duplicate inline ID/,
    );
    expect(() => removeInlineNode([one], 1)).toThrow(RangeError);
    expect(() => moveInlineNode([one], 0, 2)).toThrow(RangeError);
  });
});
