import { describe, expect, it } from "vitest";

import { adjacentBlockId, blockIdAfterDeletion } from "./blockNavigation";

describe("keyboard block navigation", () => {
  const ids = ["title", "paragraph", "image", "table"];

  it("selects adjacent blocks without wrapping", () => {
    expect(adjacentBlockId(ids, "paragraph", -1)).toBe("title");
    expect(adjacentBlockId(ids, "paragraph", 1)).toBe("image");
    expect(adjacentBlockId(ids, "title", -1)).toBeNull();
    expect(adjacentBlockId(ids, "table", 1)).toBeNull();
  });

  it("prefers the next surviving block after deletion", () => {
    expect(blockIdAfterDeletion(ids, ["paragraph"])).toBe("image");
    expect(blockIdAfterDeletion(ids, ["paragraph", "image"])).toBe("table");
    expect(blockIdAfterDeletion(ids, ["table"])).toBe("image");
    expect(blockIdAfterDeletion(ids, ids)).toBeNull();
  });
});
