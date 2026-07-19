// Normalized bibliography records and citation inline data.
import type { BuilderBlock, BuilderInlineNode } from "../model/document";

export const bibliographyTypeId = "dans.bibliography.references";
export const citationInlineTypeId = "dans.bibliography.citation";
export const bibliographyResourceNamespace = "dans.bibliography.entry";
export const citationKeyPattern = /^[A-Za-z][A-Za-z0-9_.:-]*$/u;

export type BibliographyEntryKind =
  | "article"
  | "book"
  | "proceedings"
  | "thesis"
  | "web"
  | "miscellaneous";

export interface BuilderBibliographyEntry {
  readonly id: string;
  readonly key: string;
  readonly kind: BibliographyEntryKind;
  readonly title: string;
  readonly authors: readonly string[];
  readonly year: number | null;
  readonly venue: string | null;
  readonly publisher: string | null;
  readonly doi: string | null;
  readonly url: string | null;
}

export interface BibliographyBlock extends BuilderBlock {
  readonly typeId: typeof bibliographyTypeId;
  readonly entries: readonly BuilderBibliographyEntry[];
}

export interface CitationInline extends BuilderInlineNode {
  readonly typeId: typeof citationInlineTypeId;
  readonly keys: readonly string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOptionalString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function requireSingleLine(value: string, field: string, required: boolean): void {
  if (required && value.length === 0) {
    throw new Error(`${field} must not be empty`);
  }
  if (value.includes("\n") || value.includes("\r")) {
    throw new Error(`${field} must be a single logical line`);
  }
}

function requireLinkValue(value: string | null, field: string): void {
  if (value === null) {
    return;
  }
  requireSingleLine(value, field, false);
  if (/\s|[{}\\]/u.test(value)) {
    throw new Error(
      `${field} must not contain whitespace, control characters, braces, or backslashes`,
    );
  }
}

export function requireCitationKey(value: string, field = "Citation key"): string {
  if (!citationKeyPattern.test(value)) {
    throw new Error(
      `${field} must begin with an ASCII letter and contain only letters, digits, '-', '_', '.', and ':'`,
    );
  }
  return value;
}

export function createBibliographyEntry(
  values: Readonly<{
    id?: string;
    key: string;
    kind: BibliographyEntryKind;
    title: string;
    authors?: readonly string[];
    year?: number | null;
    venue?: string | null;
    publisher?: string | null;
    doi?: string | null;
    url?: string | null;
  }>,
): BuilderBibliographyEntry {
  const id = values.id ?? globalThis.crypto.randomUUID();
  requireCitationKey(values.key, "Bibliography key");
  requireSingleLine(values.title, "Bibliography title", true);
  const authors = values.authors ?? [];
  authors.forEach((author) => {
    requireSingleLine(author, "Bibliography author", true);
  });
  const year = values.year ?? null;
  if (
    year !== null &&
    (!Number.isInteger(year) || year < 0 || year > 65_535)
  ) {
    throw new Error("Bibliography year must be an unsigned 16-bit integer or null");
  }
  const venue = values.venue === undefined || values.venue === null || values.venue.length === 0
    ? null
    : values.venue;
  const publisher =
    values.publisher === undefined ||
    values.publisher === null ||
    values.publisher.length === 0
      ? null
      : values.publisher;
  if (venue !== null) {
    requireSingleLine(venue, "Bibliography venue", false);
  }
  if (publisher !== null) {
    requireSingleLine(publisher, "Bibliography publisher", false);
  }
  const doi = values.doi === undefined || values.doi === null || values.doi.length === 0
    ? null
    : values.doi;
  const url = values.url === undefined || values.url === null || values.url.length === 0
    ? null
    : values.url;
  requireLinkValue(doi, "Bibliography DOI");
  requireLinkValue(url, "Bibliography URL");
  return Object.freeze({
    id,
    key: values.key,
    kind: values.kind,
    title: values.title,
    authors: Object.freeze([...authors]),
    year,
    venue,
    publisher,
    doi,
    url,
  });
}

export function isBibliographyEntry(value: unknown): value is BuilderBibliographyEntry {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.id === "string" &&
    typeof value.key === "string" &&
    citationKeyPattern.test(value.key) &&
    (value.kind === "article" ||
      value.kind === "book" ||
      value.kind === "proceedings" ||
      value.kind === "thesis" ||
      value.kind === "web" ||
      value.kind === "miscellaneous") &&
    typeof value.title === "string" &&
    value.title.length > 0 &&
    !value.title.includes("\n") &&
    !value.title.includes("\r") &&
    Array.isArray(value.authors) &&
    value.authors.every(
      (author) =>
        typeof author === "string" &&
        author.length > 0 &&
        !author.includes("\n") &&
        !author.includes("\r"),
    ) &&
    (value.year === null ||
      (typeof value.year === "number" &&
        Number.isInteger(value.year) &&
        value.year >= 0 &&
        value.year <= 65_535)) &&
    isOptionalString(value.venue) &&
    isOptionalString(value.publisher) &&
    isOptionalString(value.doi) &&
    isOptionalString(value.url)
  );
}

export function createBibliographyBlock(
  entries: readonly BuilderBibliographyEntry[] = [],
  id: string = globalThis.crypto.randomUUID(),
): BibliographyBlock {
  const keys = new Set<string>();
  const entryIds = new Set<string>();
  for (const entry of entries) {
    if (!isBibliographyEntry(entry)) {
      throw new Error("A bibliography block received an invalid entry");
    }
    if (keys.has(entry.key)) {
      throw new Error(`Duplicate bibliography key '${entry.key}'`);
    }
    if (entryIds.has(entry.id)) {
      throw new Error(`Duplicate bibliography entry ID '${entry.id}'`);
    }
    keys.add(entry.key);
    entryIds.add(entry.id);
  }
  return Object.freeze({
    id,
    typeId: bibliographyTypeId,
    entries: Object.freeze([...entries]),
  });
}

export function isBibliographyBlock(block: BuilderBlock): block is BibliographyBlock {
  return (
    block.typeId === bibliographyTypeId &&
    "entries" in block &&
    Array.isArray(block.entries) &&
    block.entries.every(isBibliographyEntry)
  );
}

export function requireBibliographyBlock(block: BuilderBlock): BibliographyBlock {
  if (!isBibliographyBlock(block)) {
    throw new Error(`Bibliography plugin cannot consume ${block.typeId}`);
  }
  createBibliographyBlock(block.entries, block.id);
  return block;
}

export function createCitationInline(
  keys: readonly string[],
  id: string = globalThis.crypto.randomUUID(),
): CitationInline {
  if (keys.length === 0) {
    throw new Error("A citation requires at least one key");
  }
  const unique = new Set<string>();
  keys.forEach((key, index) => {
    requireCitationKey(key, `Citation key ${String(index + 1)}`);
    if (unique.has(key)) {
      throw new Error(`A citation must not repeat key '${key}'`);
    }
    unique.add(key);
  });
  return Object.freeze({
    id,
    typeId: citationInlineTypeId,
    keys: Object.freeze([...keys]),
  });
}

export function isCitationInline(inline: BuilderInlineNode): inline is CitationInline {
  return (
    inline.typeId === citationInlineTypeId &&
    "keys" in inline &&
    Array.isArray(inline.keys) &&
    inline.keys.length > 0 &&
    inline.keys.every(
      (key, index, keys) =>
        typeof key === "string" &&
        citationKeyPattern.test(key) &&
        keys.indexOf(key) === index,
    )
  );
}

export function requireCitationInline(inline: BuilderInlineNode): CitationInline {
  if (!isCitationInline(inline)) {
    throw new Error(`Citation plugin cannot consume ${inline.typeId}`);
  }
  return inline;
}
