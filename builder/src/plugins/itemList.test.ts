import { describe, expect, it } from "vitest";

import { createText, MemoryDocumentPort } from "../model/document";
import {
  canonicalDocumentFormat,
  canonicalDocumentSchemaVersion,
} from "../transport/documentTransport";
import { projectDocumentTransport } from "../transport/projectTransport";
import {
  createBuilderListItem,
  itemListTypeId,
  moveListEntry,
  type ItemListBlock,
} from "./itemListModel";

function listBlock(): ItemListBlock {
  return Object.freeze({
    id: "list",
    typeId: itemListTypeId,
    presentation: "enumerated",
    items: Object.freeze([
      createBuilderListItem("item-a", [createText("First", "text-a", "bold")]),
      createBuilderListItem("item-b", [createText("Second", "text-b")]),
    ]),
  });
}

function sourceWithPayload(payload: unknown): string {
  return JSON.stringify({
    format: canonicalDocumentFormat,
    schemaVersion: canonicalDocumentSchemaVersion,
    documentVersion: { major: 0, minor: 1, patch: 0 },
    blocks: [{ id: "list", type: itemListTypeId, payload }],
  });
}

describe("semantic item lists", () => {
  it("round-trips item identity, ordering, presentation, and inline payloads", () => {
    const source = projectDocumentTransport.toString(
      new MemoryDocumentPort([listBlock()]).getSnapshot(),
    );
    const decoded = projectDocumentTransport.fromString(source);
    const restored = decoded.blocks[0] as ItemListBlock;

    expect(
      projectDocumentTransport.toString(
        new MemoryDocumentPort(decoded.blocks, decoded.metadata).getSnapshot(),
      ),
    ).toBe(source);
    expect(restored.presentation).toBe("enumerated");
    expect(restored.items.map(({ id }) => id)).toEqual(["item-a", "item-b"]);
    expect(Object.isFrozen(restored.items[0]?.inlines)).toBe(true);
  });

  it("moves entries immutably and rejects out-of-range moves", () => {
    const source = Object.freeze(["a", "b", "c"]);
    expect(moveListEntry(source, 0, 2)).toEqual(["b", "c", "a"]);
    expect(source).toEqual(["a", "b", "c"]);
    expect(() => moveListEntry(source, 3, 0)).toThrow(/outside/u);
  });

  it("rejects empty, duplicate, and malformed canonical list structures", () => {
    expect(() =>
      projectDocumentTransport.fromString(
        sourceWithPayload({ presentation: "itemized", items: [] }),
      ),
    ).toThrow(/at least one item/u);
    expect(() =>
      projectDocumentTransport.fromString(
        sourceWithPayload({
          presentation: "enumerated",
          items: [
            {
              id: "same",
              inlines: [
                { id: "text-a", type: "dans.core.text", payload: { text: "A", style: "normal" } },
              ],
            },
            {
              id: "same",
              inlines: [
                { id: "text-b", type: "dans.core.text", payload: { text: "B", style: "normal" } },
              ],
            },
          ],
        }),
      ),
    ).toThrow(/Duplicate list item ID/u);
    expect(() =>
      projectDocumentTransport.fromString(
        sourceWithPayload({
          presentation: "description",
          items: [
            {
              id: "item",
              inlines: [
                { id: "text", type: "dans.core.text", payload: { text: "A", style: "normal" } },
              ],
            },
          ],
        }),
      ),
    ).toThrow(/presentation/u);
  });
});
