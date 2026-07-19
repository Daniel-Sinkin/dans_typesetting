import { describe, expect, it } from "vitest";

import {
  deriveTableOfContentsEntries,
  sectionPlugin,
} from "./documentShell";
import {
  sectionBodySequenceId,
  type SectionBlock,
} from "../model/document";

function section(
  id: string,
  title: string,
  blocks: readonly SectionBlock[] = [],
): SectionBlock {
  return {
    ...(sectionPlugin.createDefault(id) as SectionBlock),
    title,
    childSequences: [
      { id: sectionBodySequenceId, blocks },
    ],
  };
}

describe("document-shell graphical adapters", () => {
  it("derives hierarchical ToC numbering from section ownership", () => {
    const entries = deriveTableOfContentsEntries([
      section("one", "One", [section("one-a", "One A")]),
      section("two", "Two"),
    ]);

    expect(entries.map(({ number, title, depth }) => ({ number, title, depth }))).toEqual([
      { number: "1", title: "One", depth: 0 },
      { number: "1.1", title: "One A", depth: 1 },
      { number: "2", title: "Two", depth: 0 },
    ]);
  });
});
