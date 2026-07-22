import { describe, expect, it } from "vitest";

import { MemoryDocumentPort } from "../model/document";
import { projectDocumentTransport } from "../transport/projectTransport";
import {
  createContentImageBlock,
  requireContentImageBlock,
} from "./contentImageModel";

describe("unnumbered content images", () => {
  it("round-trips source, width, and detected dimensions", () => {
    const image = createContentImageBlock("image", "/image.svg", 0.6, 900, 500);
    const source = projectDocumentTransport.toString(
      new MemoryDocumentPort([image]).getSnapshot(),
    );
    const decoded = projectDocumentTransport.fromString(source).blocks[0];
    if (decoded === undefined) {
      throw new Error("Image transport did not produce a block");
    }

    expect(requireContentImageBlock(decoded)).toEqual(image);
  });

  it("rejects invalid width and dimensions", () => {
    expect(() => createContentImageBlock("image", "/image.svg", 0)).toThrow(
      /interval/u,
    );
    expect(() =>
      createContentImageBlock("image", "/image.svg", 0.5, 0, 500),
    ).toThrow(/positive integers/u);
  });
});
