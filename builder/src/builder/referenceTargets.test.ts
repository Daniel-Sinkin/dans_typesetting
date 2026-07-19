import { describe, expect, it } from "vitest";

import { BuilderPluginRegistry } from "./plugin";
import { deriveReferenceTargets } from "./referenceTargets";
import { imagePlugin } from "../plugins/image";
import { opaqueBlockAdapter } from "../plugins/opaque";
import { sectionPlugin } from "../plugins/documentShell";
import type { BuilderBlock, ImageBlock, SectionBlock } from "../model/document";

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
});
