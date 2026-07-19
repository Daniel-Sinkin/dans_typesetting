import { describe, expect, it } from "vitest";

import { highlightCode } from "./codeHighlighting";

describe("code-listing syntax highlighting", () => {
  it.each([
    ["cpp", "#include <print>\nint main() { return 42; } // hello"],
    ["cuda", "__global__ void kernel(float* x) { x[threadIdx.x] *= 2.0F; }"],
    ["julia", "function energy(x::Float64)\n    return x^2 # energy\nend"],
    ["raw", "unclassified { text } # remains byte-identical"],
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

  it("recognizes CUDA extensions while raw text remains unclassified", () => {
    const cudaKinds = highlightCode(
      "cuda",
      "__global__ void kernel() { const auto i = threadIdx.x; }",
    )
      .filter((token) => token.kind !== "plain")
      .map((token) => token.kind);
    expect(cudaKinds).toEqual(["keyword", "type", "keyword", "keyword", "type"]);

    expect(highlightCode("raw", "const 42 # text")).toEqual([
      { kind: "plain", text: "const 42 # text" },
    ]);
  });
});
