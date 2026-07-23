import { describe, expect, it } from "vitest";

import type { BuilderBlock } from "../model/document";
import {
  deletedBlockCacheCapacity,
  rememberDeletedBlocks,
} from "./deletedBlockCache";

function block(id: string, typeId = "test.block"): BuilderBlock {
  return Object.freeze({ id, typeId });
}

describe("recently deleted block cache", () => {
  it("retains only the five most recently deleted blocks", () => {
    const remembered = rememberDeletedBlocks(
      [block("older-1"), block("older-2"), block("older-3"), block("older-4")],
      [block("new-1"), block("new-2")],
    );

    expect(remembered.map(({ id }) => id)).toEqual([
      "new-1",
      "new-2",
      "older-1",
      "older-2",
      "older-3",
    ]);
    expect(remembered).toHaveLength(deletedBlockCacheCapacity);
  });

  it("moves a deleted identity back to the most-recent position", () => {
    const updated = block("repeat", "test.updated");
    const remembered = rememberDeletedBlocks(
      [block("first"), block("repeat"), block("last")],
      [updated],
    );

    expect(remembered.map(({ id }) => id)).toEqual(["repeat", "first", "last"]);
    expect(remembered[0]).toBe(updated);
  });
});
