import { describe, expect, it } from "vitest";

import { highlightCode } from "./codeHighlighting";

describe("code-listing syntax highlighting", () => {
  it.each([
    ["cpp", "#include <print>\nint main() { return 42; } // hello"],
    ["julia", "function energy(x::Float64)\n    return x^2 # energy\nend"],
  ] as const)("preserves every source byte for %s", (language, source) => {
    expect(highlightCode(language, source).map((token) => token.text).join("")).toBe(source);
  });

  it("recognizes representative C++ and Julia syntax classes", () => {
    const cppKinds = highlightCode("cpp", '#include <print>\nconstexpr double x = 3.2;')
      .filter((token) => token.kind !== "plain")
      .map((token) => token.kind);
    expect(cppKinds).toEqual(["preprocessor", "keyword", "type", "number"]);

    const juliaKinds = highlightCode("julia", 'function f(x::Float64)\n "ok" # note\nend')
      .filter((token) => token.kind !== "plain")
      .map((token) => token.kind);
    expect(juliaKinds).toEqual(["keyword", "type", "string", "comment", "keyword"]);
  });
});
