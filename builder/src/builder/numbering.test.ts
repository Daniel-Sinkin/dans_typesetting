import { describe, expect, it } from "vitest";

import type { BuilderBlock } from "../model/document";
import { deriveBlockOrdinals } from "./numbering";

const blocks = [
  { id: "figure-a", typeId: "figure" },
  { id: "paragraph", typeId: "paragraph" },
  { id: "equation-a", typeId: "equation" },
  { id: "figure-b", typeId: "figure" },
  { id: "equation-b", typeId: "equation" },
] satisfies readonly BuilderBlock[];

describe("writer-derived block numbering", () => {
  it("maintains independent ordinal series in traversal order", () => {
    const ordinals = deriveBlockOrdinals(blocks, (block) =>
      block.typeId === "paragraph" ? null : block.typeId,
    );

    expect(ordinals.get("figure-a")?.ordinal).toBe(1);
    expect(ordinals.get("figure-b")?.ordinal).toBe(2);
    expect(ordinals.get("equation-a")?.ordinal).toBe(1);
    expect(ordinals.get("equation-b")?.ordinal).toBe(2);
    expect(ordinals.get("paragraph")?.ordinal).toBeNull();
  });

  it("renumbers immediately when traversal order changes", () => {
    const reversedFigures = [blocks[3], blocks[0]].filter(
      (block): block is BuilderBlock => block !== undefined,
    );
    const ordinals = deriveBlockOrdinals(reversedFigures, () => "figure");

    expect(ordinals.get("figure-b")?.ordinal).toBe(1);
    expect(ordinals.get("figure-a")?.ordinal).toBe(2);
  });
});
