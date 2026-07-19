// Canonical codecs owned by the bibliography plugin.
import type { BuilderBlock, BuilderInlineNode } from "../model/document";
import {
  requireTransportArray,
  requireTransportNumber,
  requireTransportRecord,
  requireTransportString,
  type BlockTransportCodec,
  type InlineTransportCodec,
} from "../transport/documentTransport";
import {
  bibliographyTypeId,
  citationInlineTypeId,
  createBibliographyBlock,
  createBibliographyEntry,
  createCitationInline,
  requireBibliographyBlock,
  requireCitationInline,
  type BibliographyEntryKind,
} from "./bibliographyModel";

function decodeOptionalString(value: unknown, field: string): string | null {
  if (value === null) {
    return null;
  }
  if (typeof value !== "string") {
    throw new Error(`${field} must be a string or null`);
  }
  return value;
}

function decodeKind(value: unknown): BibliographyEntryKind {
  if (
    value !== "article" &&
    value !== "book" &&
    value !== "proceedings" &&
    value !== "thesis" &&
    value !== "web" &&
    value !== "miscellaneous"
  ) {
    throw new Error("Bibliography entry kind is invalid");
  }
  return value;
}

export const bibliographyBlockTransportCodec: BlockTransportCodec = {
  typeId: bibliographyTypeId,
  encode(block) {
    const bibliography = requireBibliographyBlock(block);
    return {
      entries: bibliography.entries.map((entry) => ({
        id: entry.id,
        key: entry.key,
        kind: entry.kind,
        title: entry.title,
        authors: [...entry.authors],
        year: entry.year,
        venue: entry.venue,
        publisher: entry.publisher,
        doi: entry.doi,
        url: entry.url,
      })),
    };
  },
  decode(id, payload): BuilderBlock {
    const data = requireTransportRecord(payload, "Bibliography payload");
    const entries = requireTransportArray(data, "entries", "Bibliography payload").map(
      (value, index) => {
        const context = `Bibliography entry ${String(index)}`;
        const entry = requireTransportRecord(value, context);
        const yearValue = entry.year;
        const year =
          yearValue === null
            ? null
            : requireTransportNumber(entry, "year", context);
        return createBibliographyEntry({
          id: requireTransportString(entry, "id", context),
          key: requireTransportString(entry, "key", context),
          kind: decodeKind(entry.kind),
          title: requireTransportString(entry, "title", context),
          authors: requireTransportArray(entry, "authors", context).map(
            (author, authorIndex) => {
              if (typeof author !== "string") {
                throw new Error(
                  `${context}.authors[${String(authorIndex)}] must be a string`,
                );
              }
              return author;
            },
          ),
          year,
          venue: decodeOptionalString(entry.venue, `${context}.venue`),
          publisher: decodeOptionalString(
            entry.publisher,
            `${context}.publisher`,
          ),
          doi: decodeOptionalString(entry.doi, `${context}.doi`),
          url: decodeOptionalString(entry.url, `${context}.url`),
        });
      },
    );
    return createBibliographyBlock(entries, id);
  },
};

export const citationInlineTransportCodec: InlineTransportCodec = {
  typeId: citationInlineTypeId,
  encode(inline) {
    return { keys: [...requireCitationInline(inline).keys] };
  },
  decode(id, payload): BuilderInlineNode {
    const data = requireTransportRecord(payload, "Citation payload");
    const keys = requireTransportArray(data, "keys", "Citation payload").map(
      (key, index) => {
        if (typeof key !== "string") {
          throw new Error(`Citation payload.keys[${String(index)}] must be a string`);
        }
        return key;
      },
    );
    return createCitationInline(keys, id);
  },
};
