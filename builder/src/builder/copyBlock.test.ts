import { describe, expect, it } from "vitest";

import { BuilderPluginRegistry } from "./plugin";
import { copyBuilderBlockForInsert } from "./copyBlock";
import { imagePlugin } from "../plugins/image";
import { opaqueBlockAdapter } from "../plugins/opaque";
import { sectionPlugin } from "../plugins/documentShell";
import {
  imageTypeId,
  sectionTypeId,
  type ImageBlock,
  type SectionBlock,
} from "../model/document";

const registry = new BuilderPluginRegistry(
  [imagePlugin, sectionPlugin],
  opaqueBlockAdapter,
);

describe("plugin-aware block copies", () => {
  it("gives copied trees fresh block IDs and clears semantic target IDs", () => {
    const figure: ImageBlock = Object.freeze({
      id: "figure",
      typeId: imageTypeId,
      source: "/figure.png",
      caption: "Original figure",
      referenceId: "fig:original",
      widthFraction: 0.7,
      preferredPixelWidth: 1280,
      preferredPixelHeight: 720,
    });
    const source: SectionBlock = Object.freeze({
      id: "section",
      typeId: sectionTypeId,
      title: "Original section",
      referenceId: "sec:original",
      blocks: Object.freeze([figure]),
    });

    const copied = copyBuilderBlockForInsert(source, registry, "section-copy");

    expect(copied).toMatchObject({ id: "section-copy", referenceId: null });
    const copiedSection = copied as SectionBlock;
    expect(copiedSection.blocks[0]).toMatchObject({ referenceId: null });
    expect(copiedSection.blocks[0]?.id).not.toBe(figure.id);
  });
});
