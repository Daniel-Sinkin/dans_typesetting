import { describe, expect, it } from "vitest";

import { BuilderPluginRegistry } from "./plugin";
import { BuilderInlinePluginRegistry } from "./inlinePlugin";
import { deriveReferenceTargets } from "./referenceTargets";
import { createImagePlugin } from "../plugins/image";
import type { ImageBlock } from "../plugins/imageModel";
import { opaqueBlockAdapter } from "../plugins/opaque";
import {
  opaqueInlineAdapter,
  textInlinePlugin,
} from "../plugins/text";
import { sectionPlugin } from "../plugins/documentShell";
import {
  createMathDisplayLine,
  mathDisplayTypeId,
  type BuilderBlock,
  type MathDisplayBlock,
  type SectionBlock,
} from "../model/document";
import { createMathIdentifier } from "../model/math";
import { createMathPlugin } from "../plugins/mathPlugin";

const inlineRegistry = new BuilderInlinePluginRegistry(
  [textInlinePlugin],
  opaqueInlineAdapter,
);
const imagePlugin = createImagePlugin(inlineRegistry);

function image(id: string, referenceId: string): ImageBlock {
  return Object.freeze({
    ...imagePlugin.createDefault(id),
    referenceId,
  }) as ImageBlock;
}

function section(
  id: string,
  referenceId: string,
  blocks: readonly BuilderBlock[] = [],
): SectionBlock {
  return Object.freeze({
    ...sectionPlugin.createDefault(id),
    referenceId,
    blocks: Object.freeze([...blocks]),
  }) as SectionBlock;
}

const registry = new BuilderPluginRegistry(
  [imagePlugin, sectionPlugin],
  opaqueBlockAdapter,
);

describe("semantic reference target index", () => {
  it("derives section paths and figure ordinals from current document order", () => {
    const targets = deriveReferenceTargets(
      [
        section("methods", "sec:methods", [
          image("mesh", "fig:mesh"),
          section("solver", "sec:solver", [image("kernel", "fig:kernel")]),
        ]),
        image("result", "fig:result"),
      ],
      registry,
    );

    expect(targets.get("sec:methods")?.displayText).toBe("Section 1");
    expect(targets.get("sec:solver")?.displayText).toBe("Section 1.1");
    expect(targets.get("fig:mesh")?.displayText).toBe("Figure 1");
    expect(targets.get("fig:kernel")?.displayText).toBe("Figure 2");
    expect(targets.get("fig:result")?.displayText).toBe("Figure 3");
  });

  it("renumbers references after reordering without changing stable IDs", () => {
    const first = image("first", "fig:first");
    const second = image("second", "fig:second");

    const reordered = deriveReferenceTargets([second, first], registry);

    expect(reordered.get("fig:second")?.displayText).toBe("Figure 1");
    expect(reordered.get("fig:first")?.displayText).toBe("Figure 2");
  });

  it("rejects duplicate semantic IDs across independent block plugins", () => {
    expect(() =>
      deriveReferenceTargets(
        [section("section", "shared:id"), image("figure", "shared:id")],
        registry,
      ),
    ).toThrow(/Duplicate semantic reference ID 'shared:id'/u);
  });

  it("derives multiple suffixed targets from one numbered block", () => {
    const pairPlugin = {
      ...imagePlugin,
      typeId: "dans.test.figure_pair",
      referenceTarget: undefined,
      referenceTargets: () => [
        { referenceId: "fig:pair", label: "Figure", title: null },
        {
          referenceId: "fig:pair:left",
          label: "Figure",
          title: "Left panel",
          numberSuffix: "a",
        },
      ],
      createDefault: (id: string) => ({ id, typeId: "dans.test.figure_pair" }),
    };
    const pairRegistry = new BuilderPluginRegistry(
      [pairPlugin],
      opaqueBlockAdapter,
    );

    const targets = deriveReferenceTargets(
      [{ id: "pair", typeId: "dans.test.figure_pair" }],
      pairRegistry,
    );

    expect(targets.get("fig:pair")?.displayText).toBe("Figure 1");
    expect(targets.get("fig:pair:left")?.displayText).toBe("Figure 1a");
  });

  it("numbers targetless equation lines while resolving later line targets", () => {
    const mathPlugin = createMathPlugin();
    const mathRegistry = new BuilderPluginRegistry(
      [mathPlugin],
      opaqueBlockAdapter,
    );
    const display: MathDisplayBlock = {
      id: "display",
      typeId: mathDisplayTypeId,
      alignment: "automatic",
      lines: [
        createMathDisplayLine(
          createMathIdentifier("a"),
          true,
          "eq:first",
          "line-first",
        ),
        createMathDisplayLine(
          createMathIdentifier("b"),
          true,
          null,
          "line-targetless",
        ),
        createMathDisplayLine(
          createMathIdentifier("note"),
          false,
          null,
          "line-unnumbered",
        ),
        createMathDisplayLine(
          createMathIdentifier("c"),
          true,
          "eq:last",
          "line-last",
        ),
      ],
    };

    const targets = deriveReferenceTargets([display], mathRegistry);

    expect(targets.get("eq:first")?.displayText).toBe("Equation 1");
    expect(targets.get("eq:first")?.occurrenceId).toBe("line-first");
    expect(targets.get("eq:last")?.displayText).toBe("Equation 3");
    expect(targets.get("eq:last")?.occurrenceId).toBe("line-last");
  });
});
