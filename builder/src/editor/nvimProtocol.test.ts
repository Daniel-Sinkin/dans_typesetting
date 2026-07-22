import { describe, expect, it } from "vitest";

import {
  parseNvimClientMessage,
  parseNvimServerMessage,
} from "./nvimProtocol";

describe("Neovim bridge protocol", () => {
  it("accepts a bounded source session and terminal input", () => {
    expect(
      parseNvimClientMessage({
        type: "start",
        source: "int main() {}",
        fileName: "listing.cpp",
        columns: 100,
        rows: 32,
      }),
    ).toEqual({
      type: "start",
      source: "int main() {}",
      fileName: "listing.cpp",
      columns: 100,
      rows: 32,
    });
    expect(parseNvimClientMessage({ type: "input", data: "ihello\u001b" })).toEqual({
      type: "input",
      data: "ihello\u001b",
    });
  });

  it("rejects paths and unreasonable terminal dimensions", () => {
    expect(() =>
      parseNvimClientMessage({
        type: "start",
        source: "text",
        fileName: "../outside.md",
        columns: 80,
        rows: 24,
      }),
    ).toThrow(/basename/u);
    expect(() =>
      parseNvimClientMessage({ type: "resize", columns: 2, rows: 24 }),
    ).toThrow(/columns/u);
  });

  it("decodes write and exit notifications", () => {
    expect(parseNvimServerMessage({ type: "write", source: "updated" })).toEqual({
      type: "write",
      source: "updated",
    });
    expect(
      parseNvimServerMessage({ type: "exit", exitCode: 0, signal: null }),
    ).toEqual({ type: "exit", exitCode: 0, signal: null });
  });
});
