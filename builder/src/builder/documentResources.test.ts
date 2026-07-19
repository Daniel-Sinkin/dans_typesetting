import { describe, expect, it } from "vitest";

import { sectionTypeId, type BuilderBlock, type SectionBlock } from "../model/document";
import {
  bibliographyResourceNamespace,
  createBibliographyBlock,
  createBibliographyEntry,
} from "../plugins/bibliographyModel";
import { createBibliographyPlugin } from "../plugins/bibliography";
import { opaqueBlockAdapter } from "../plugins/opaque";
import { deriveDocumentResources, resourcesInNamespace } from "./documentResources";
import { BuilderPluginRegistry } from "./plugin";

function bibliography(id: string, key: string, title: string) {
  return createBibliographyBlock(
    [createBibliographyEntry({ id: `${id}-entry`, key, kind: "article", title })],
    id,
  );
}

describe("document resources", () => {
  const registry = new BuilderPluginRegistry(
    [createBibliographyPlugin()],
    opaqueBlockAdapter,
  );

  it("derives stable per-namespace ordinals through nested block order", () => {
    const nested: SectionBlock = Object.freeze({
      id: "section",
      typeId: sectionTypeId,
      title: "Nested",
      referenceId: null,
      blocks: Object.freeze([bibliography("nested-bib", "nested", "Nested paper")]),
    });
    const index = deriveDocumentResources(
      [bibliography("first-bib", "first", "First paper"), nested],
      registry,
    );
    const resources = resourcesInNamespace(index, bibliographyResourceNamespace);

    expect([...resources.keys()]).toEqual(["first", "nested"]);
    expect(resources.get("first")).toMatchObject({
      blockId: "first-bib",
      ordinal: 1,
    });
    expect(resources.get("nested")).toMatchObject({
      blockId: "nested-bib",
      ordinal: 2,
    });
    expect(resources.get("nested")?.anchorId).toContain("nested");
  });

  it("rejects duplicate namespaced keys across independently authored blocks", () => {
    const blocks: readonly BuilderBlock[] = [
      bibliography("first-bib", "same", "First"),
      bibliography("second-bib", "same", "Second"),
    ];
    expect(() => deriveDocumentResources(blocks, registry)).toThrow(
      /Duplicate document resource.*same.*first-bib.*second-bib/u,
    );
  });
});
