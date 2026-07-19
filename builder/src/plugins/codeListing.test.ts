import { describe, expect, it } from "vitest";

import { copyBuilderBlockForInsert } from "../builder/copyBlock";
import { BuilderInlinePluginRegistry } from "../builder/inlinePlugin";
import { BuilderPluginRegistry } from "../builder/plugin";
import { createText } from "../model/document";
import { createCodeListingPlugin } from "./codeListing";
import {
  createCodeListingBlock,
  requireCodeListingBlock,
} from "./codeListingModel";
import { opaqueBlockAdapter } from "./opaque";
import {
  opaqueInlineAdapter,
  textInlinePlugin,
} from "./text";

const inlineRegistry = new BuilderInlinePluginRegistry(
  [textInlinePlugin],
  opaqueInlineAdapter,
);
const listingPlugin = createCodeListingPlugin(inlineRegistry);

describe("semantic rich code listings", () => {
  it("keeps caption presence independent from reference identity", () => {
    const captioned = createCodeListingBlock(
      "captioned",
      "cuda",
      "__global__ void kernel() {}",
      [createText("Kernel", "caption", "italic")],
    );
    const referenced = createCodeListingBlock(
      "referenced",
      "raw",
      "output",
      null,
      "lst:output",
    );

    expect(captioned.referenceId).toBeNull();
    expect(captioned.captionInlines).toHaveLength(1);
    expect(referenced.captionInlines).toBeNull();
    expect(referenced.referenceId).toBe("lst:output");
  });

  it("deep-copies rich captions while clearing reference identity", () => {
    const registry = new BuilderPluginRegistry(
      [listingPlugin],
      opaqueBlockAdapter,
    );
    const source = createCodeListingBlock(
      "source",
      "julia",
      "energy(x) = sum(abs2, x)",
      [createText("Energy", "caption", "bold")],
      "lst:energy",
    );
    const copied = requireCodeListingBlock(
      copyBuilderBlockForInsert(source, registry, "copy"),
    );

    expect(copied.referenceId).toBeNull();
    expect(copied.captionInlines?.[0]?.id).not.toBe("caption");
    expect(copied.code).toBe(source.code);
  });

  it("rejects empty source and malformed optional captions", () => {
    expect(() => createCodeListingBlock("empty", "cpp", "")).toThrow(
      /source code/u,
    );
    expect(() =>
      createCodeListingBlock("caption", "cpp", "int x;", []),
    ).toThrow(/at least one inline/u);
  });
});
