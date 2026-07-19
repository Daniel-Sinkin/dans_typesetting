import { describe, expect, it } from "vitest";

import {
  createMathDisplayLine,
  mathDisplayTypeId,
  type MathDisplayBlock,
} from "../model/document";
import { createMathIdentifier } from "../model/math";
import { createMathPlugin } from "./mathPlugin";

describe("graphical structured display math", () => {
  it("creates one targetless numbered line by default", () => {
    const plugin = createMathPlugin();
    const block = plugin.createDefault("display") as MathDisplayBlock;

    expect(block).toMatchObject({
      id: "display",
      typeId: mathDisplayTypeId,
      alignment: "automatic",
    });
    expect(block.lines).toHaveLength(1);
    expect(block.lines[0]).toMatchObject({ numbered: true, referenceId: null });
    expect(plugin.numberedOccurrences?.(block)).toEqual([
      {
        occurrenceId: block.lines[0]?.id,
        numberingSeries: "Equation",
      },
    ]);
  });

  it("publishes line occurrences independently from optional targets", () => {
    const plugin = createMathPlugin();
    const block: MathDisplayBlock = {
      id: "display",
      typeId: mathDisplayTypeId,
      alignment: "disabled",
      lines: [
        createMathDisplayLine(
          createMathIdentifier("a"),
          true,
          "eq:a",
          "line-a",
        ),
        createMathDisplayLine(
          createMathIdentifier("b"),
          true,
          null,
          "line-b",
        ),
        createMathDisplayLine(
          createMathIdentifier("note"),
          false,
          null,
          "line-note",
        ),
      ],
    };

    expect(plugin.numberedOccurrences?.(block)).toEqual([
      { occurrenceId: "line-a", numberingSeries: "Equation" },
      { occurrenceId: "line-b", numberingSeries: "Equation" },
    ]);
    expect(plugin.referenceTargets?.(block)).toEqual([
      { referenceId: "eq:a", occurrenceId: "line-a", label: "Equation" },
      { referenceId: null, occurrenceId: "line-b", label: "Equation" },
    ]);
  });

  it("copies each line with a fresh occurrence ID and no target", () => {
    const plugin = createMathPlugin();
    const source: MathDisplayBlock = {
      id: "source",
      typeId: mathDisplayTypeId,
      alignment: "automatic",
      lines: [
        createMathDisplayLine(
          createMathIdentifier("x"),
          true,
          "eq:x",
          "source-line",
        ),
      ],
    };

    const copied = plugin.copyForInsert?.(source, "copy") as MathDisplayBlock;

    expect(copied.id).toBe("copy");
    expect(copied.lines[0]?.id).not.toBe("source-line");
    expect(copied.lines[0]?.referenceId).toBeNull();
    expect(copied.lines[0]?.expression).toBe(source.lines[0]?.expression);
  });
});
