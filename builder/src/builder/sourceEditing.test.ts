import { describe, expect, it } from "vitest";

import { sourceBufferFileName } from "./sourceEditing";

describe("source-buffer filenames", () => {
  it("preserves ordinary IDs and sanitizes transport-defined IDs", () => {
    expect(sourceBufferFileName("sample-code", "cpp")).toBe("sample-code.cpp");
    expect(sourceBufferFileName("§ odd/path", "md")).toBe("odd-path.md");
    expect(sourceBufferFileName("§", "txt")).toBe("block.txt");
  });

  it("bounds long IDs", () => {
    expect(sourceBufferFileName("x".repeat(300), "cu").length).toBe(99);
  });
});
