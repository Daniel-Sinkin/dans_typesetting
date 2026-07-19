// Optional BibTeX and bespoke-JSON adapters for normalized bibliography data.
import {
  createBibliographyEntry,
  type BibliographyEntryKind,
  type BuilderBibliographyEntry,
} from "./bibliographyModel";

export const bibliographyJsonFormat = "dans.typesetting.bibliography";
export const bibliographyJsonSchemaVersion = 1;

export interface BibliographySourceCapability {
  parseBibtex(source: string): readonly BuilderBibliographyEntry[];
  serializeBibtex(entries: readonly BuilderBibliographyEntry[]): string;
  parseJson(source: string): readonly BuilderBibliographyEntry[];
  serializeJson(entries: readonly BuilderBibliographyEntry[]): string;
}

function requireRecord(value: unknown, context: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${context} must be an object`);
  }
  return value as Record<string, unknown>;
}

function requireString(record: Record<string, unknown>, field: string, context: string): string {
  const value = record[field];
  if (typeof value !== "string") {
    throw new Error(`${context}.${field} must be a string`);
  }
  return value;
}

function optionalString(
  record: Record<string, unknown>,
  field: string,
  context: string,
): string | null {
  const value = record[field];
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== "string") {
    throw new Error(`${context}.${field} must be a string or null`);
  }
  return value;
}

function requireKind(value: unknown, context: string): BibliographyEntryKind {
  if (
    value !== "article" &&
    value !== "book" &&
    value !== "proceedings" &&
    value !== "thesis" &&
    value !== "web" &&
    value !== "miscellaneous"
  ) {
    throw new Error(`${context}.kind is invalid`);
  }
  return value;
}

export function parseBibliographyJson(
  source: string,
): readonly BuilderBibliographyEntry[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source) as unknown;
  } catch {
    throw new Error("Bibliography JSON must be valid JSON");
  }
  const root = requireRecord(parsed, "Bibliography JSON");
  if (
    root.format !== bibliographyJsonFormat ||
    root.schemaVersion !== bibliographyJsonSchemaVersion
  ) {
    throw new Error("Unsupported bibliography JSON format or schema version");
  }
  if (!Array.isArray(root.entries)) {
    throw new Error("Bibliography JSON.entries must be an array");
  }
  const entries = root.entries.map((value, index) => {
      const context = `Bibliography JSON entry ${String(index)}`;
      const entry = requireRecord(value, context);
      if (!Array.isArray(entry.authors) || entry.authors.some((author) => typeof author !== "string")) {
        throw new Error(`${context}.authors must be an array of strings`);
      }
      const authors = entry.authors.map((author) => {
        if (typeof author !== "string") {
          throw new Error(`${context}.authors must be an array of strings`);
        }
        return author;
      });
      const year = entry.year;
      if (year !== null && year !== undefined && typeof year !== "number") {
        throw new Error(`${context}.year must be a number or null`);
      }
      return createBibliographyEntry({
        key: requireString(entry, "key", context),
        kind: requireKind(entry.kind, context),
        title: requireString(entry, "title", context),
        authors,
        year: year ?? null,
        venue: optionalString(entry, "venue", context),
        publisher: optionalString(entry, "publisher", context),
        doi: optionalString(entry, "doi", context),
        url: optionalString(entry, "url", context),
      });
    });
  const keys = new Set<string>();
  for (const entry of entries) {
    if (keys.has(entry.key)) {
      throw new Error(`Duplicate bibliography key '${entry.key}'`);
    }
    keys.add(entry.key);
  }
  return Object.freeze(entries);
}

export function serializeBibliographyJson(
  entries: readonly BuilderBibliographyEntry[],
): string {
  const root = {
    format: bibliographyJsonFormat,
    schemaVersion: bibliographyJsonSchemaVersion,
    entries: entries.map((entry) => ({
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
  return `${JSON.stringify(root, null, 2)}\n`;
}

class BibtexParser {
  readonly #source: string;
  #position = 0;

  public constructor(source: string) {
    this.#source = source;
  }

  public parse(): readonly BuilderBibliographyEntry[] {
    const entries: BuilderBibliographyEntry[] = [];
    const keys = new Set<string>();
    this.#skipSpace();
    while (!this.#atEnd()) {
      this.#expect("@");
      const rawKind = this.#identifier().toLowerCase();
      this.#skipSpace();
      const opening = this.#take();
      if (opening !== "{" && opening !== "(") {
        this.#fail("Expected '{' or '(' after an entry type");
      }
      const closing = opening === "{" ? "}" : ")";
      if (rawKind === "comment") {
        this.#skipBalanced(opening, closing);
        this.#skipSpace();
        continue;
      }
      if (rawKind === "string" || rawKind === "preamble") {
        this.#fail("BibTeX string macros and preambles are not supported");
      }

      this.#skipSpace();
      const keyStart = this.#position;
      while (!this.#atEnd() && this.#peek() !== "," && this.#peek() !== closing) {
        this.#position += 1;
      }
      const key = this.#source.slice(keyStart, this.#position).trim();
      if (this.#peek() !== ",") {
        this.#fail("A BibTeX entry requires a key followed by fields");
      }
      this.#position += 1;
      const fields = new Map<string, string>();
      this.#skipSpace();
      while (this.#peek() !== closing) {
        const field = this.#identifier().toLowerCase();
        this.#skipSpace();
        this.#expect("=");
        this.#skipSpace();
        const value = this.#value(closing);
        this.#skipSpace();
        if (this.#peek() === "#") {
          this.#fail("BibTeX value concatenation is not supported");
        }
        if (fields.has(field)) {
          this.#fail(`Duplicate BibTeX field '${field}'`);
        }
        fields.set(field, value);
        this.#skipSpace();
        if (this.#peek() === ",") {
          this.#position += 1;
          this.#skipSpace();
          if (this.#peek() === closing) {
            break;
          }
        } else if (this.#peek() !== closing) {
          this.#fail("Expected ',' or the end of a BibTeX entry");
        }
      }
      this.#expect(closing);
      const entry = this.#lowerEntry(rawKind, key, fields);
      if (keys.has(entry.key)) {
        this.#fail(`Duplicate bibliography key '${entry.key}'`);
      }
      keys.add(entry.key);
      entries.push(entry);
      this.#skipSpace();
    }
    return Object.freeze(entries);
  }

  #lowerEntry(
    rawKind: string,
    key: string,
    fields: ReadonlyMap<string, string>,
  ): BuilderBibliographyEntry {
    const kind = this.#kind(rawKind);
    const title = fields.get("title");
    if (title === undefined) {
      this.#fail(`BibTeX entry '${key}' requires a title field`);
    }
    const textFields = [...fields.values()];
    if (textFields.some((value) => value.includes("\\"))) {
      this.#fail(
        "LaTeX commands inside BibTeX values are not supported; import normalized UTF-8 text",
      );
    }
    const yearSource = fields.get("year");
    const year = yearSource === undefined ? null : Number(yearSource);
    if (yearSource !== undefined && !/^\d+$/u.test(yearSource)) {
      this.#fail(`BibTeX entry '${key}' has a non-numeric year`);
    }
    return createBibliographyEntry({
      key,
      kind,
      title: this.#stripGrouping(title),
      authors: (fields.get("author") ?? "")
        .split(/\s+and\s+/iu)
        .map((author) => this.#stripGrouping(author.trim()))
        .filter((author) => author.length > 0),
      year,
      venue: this.#optionalGroupedField(
        fields.get("journal") ??
          fields.get("booktitle") ??
          fields.get("school") ??
          fields.get("howpublished"),
      ),
      publisher: this.#optionalGroupedField(
        fields.get("publisher") ?? fields.get("institution"),
      ),
      doi: this.#optionalGroupedField(fields.get("doi")),
      url: this.#optionalGroupedField(fields.get("url")),
    });
  }

  #kind(value: string): BibliographyEntryKind {
    switch (value) {
      case "article":
        return "article";
      case "book":
      case "inbook":
        return "book";
      case "inproceedings":
      case "conference":
        return "proceedings";
      case "phdthesis":
      case "mastersthesis":
        return "thesis";
      case "online":
      case "www":
        return "web";
      case "misc":
        return "miscellaneous";
      default:
        this.#fail(`Unsupported BibTeX entry type '${value}'`);
    }
  }

  #value(closing: string): string {
    if (this.#peek() === "{") {
      return this.#bracedValue();
    }
    if (this.#peek() === '"') {
      return this.#quotedValue();
    }
    const start = this.#position;
    while (!this.#atEnd() && this.#peek() !== "," && this.#peek() !== closing) {
      if (this.#peek() === "#") {
        this.#fail("BibTeX value concatenation is not supported");
      }
      this.#position += 1;
    }
    const result = this.#source.slice(start, this.#position).trim();
    if (result.length === 0) {
      this.#fail("BibTeX field values must not be empty");
    }
    if (!/^\d+$/u.test(result)) {
      this.#fail(
        "Bare BibTeX string macros are not supported; use a braced or quoted UTF-8 value",
      );
    }
    return result;
  }

  #bracedValue(): string {
    this.#expect("{");
    let depth = 1;
    let result = "";
    while (!this.#atEnd()) {
      const character = this.#take();
      if (character === "{") {
        depth += 1;
        result += character;
      } else if (character === "}") {
        depth -= 1;
        if (depth === 0) {
          return result;
        }
        result += character;
      } else {
        result += character;
      }
    }
    this.#fail("Unterminated braced BibTeX value");
  }

  #quotedValue(): string {
    this.#expect('"');
    let result = "";
    let braceDepth = 0;
    while (!this.#atEnd()) {
      const character = this.#take();
      if (character === "{") {
        braceDepth += 1;
      } else if (character === "}") {
        braceDepth -= 1;
        if (braceDepth < 0) {
          this.#fail("Unbalanced brace in quoted BibTeX value");
        }
      } else if (character === '"' && braceDepth === 0) {
        return result;
      }
      result += character;
    }
    this.#fail("Unterminated quoted BibTeX value");
  }

  #stripGrouping(value: string): string {
    return value.replaceAll("{", "").replaceAll("}", "");
  }

  #optionalGroupedField(value: string | undefined): string | null {
    return value === undefined ? null : this.#stripGrouping(value);
  }

  #skipBalanced(opening: string, closing: string): void {
    let depth = 1;
    while (!this.#atEnd()) {
      const character = this.#take();
      if (character === opening) {
        depth += 1;
      } else if (character === closing) {
        depth -= 1;
        if (depth === 0) {
          return;
        }
      }
    }
    this.#fail("Unterminated BibTeX comment");
  }

  #identifier(): string {
    this.#skipSpace();
    const start = this.#position;
    while (!this.#atEnd() && /[A-Za-z0-9_-]/u.test(this.#peek())) {
      this.#position += 1;
    }
    if (start === this.#position) {
      this.#fail("Expected a BibTeX identifier");
    }
    return this.#source.slice(start, this.#position);
  }

  #skipSpace(): void {
    while (!this.#atEnd()) {
      if (/\s/u.test(this.#peek())) {
        this.#position += 1;
      } else if (this.#peek() === "%") {
        while (!this.#atEnd() && this.#peek() !== "\n") {
          this.#position += 1;
        }
      } else {
        return;
      }
    }
  }

  #expect(expected: string): void {
    if (this.#take() !== expected) {
      this.#fail(`Expected '${expected}'`);
    }
  }

  #peek(): string {
    return this.#source.charAt(this.#position);
  }

  #take(): string {
    if (this.#atEnd()) {
      this.#fail("Unexpected end of BibTeX input");
    }
    const result = this.#source.charAt(this.#position);
    this.#position += 1;
    return result;
  }

  #atEnd(): boolean {
    return this.#position >= this.#source.length;
  }

  #fail(message: string): never {
    throw new Error(`Invalid BibTeX at byte ${String(this.#position)}: ${message}`);
  }
}

export function parseBibliographyBibtex(
  source: string,
): readonly BuilderBibliographyEntry[] {
  return new BibtexParser(source).parse();
}

function bibtexKind(kind: BibliographyEntryKind): string {
  switch (kind) {
    case "article":
      return "article";
    case "book":
      return "book";
    case "proceedings":
      return "inproceedings";
    case "thesis":
      return "phdthesis";
    case "web":
      return "online";
    case "miscellaneous":
      return "misc";
  }
}

function bibtexValue(value: string, context: string): string {
  if (/[{}\\\r\n]/u.test(value)) {
    throw new Error(`${context} contains braces, backslashes, or line breaks not supported by the BibTeX projection`);
  }
  return `{${value}}`;
}

export function serializeBibliographyBibtex(
  entries: readonly BuilderBibliographyEntry[],
): string {
  return entries
    .map((entry) => {
      const fields: [string, string][] = [];
      if (entry.authors.length > 0) {
        fields.push(["author", entry.authors.join(" and ")]);
      }
      fields.push(["title", entry.title]);
      if (entry.year !== null) {
        fields.push(["year", String(entry.year)]);
      }
      if (entry.venue !== null) {
        fields.push([
          entry.kind === "article"
            ? "journal"
            : entry.kind === "proceedings"
              ? "booktitle"
              : entry.kind === "thesis"
                ? "school"
                : "howpublished",
          entry.venue,
        ]);
      }
      if (entry.publisher !== null) {
        fields.push(["publisher", entry.publisher]);
      }
      if (entry.doi !== null) {
        fields.push(["doi", entry.doi]);
      }
      if (entry.url !== null) {
        fields.push(["url", entry.url]);
      }
      const body = fields
        .map(
          ([field, value]) =>
            `  ${field} = ${bibtexValue(value, `${entry.key}.${field}`)}`,
        )
        .join(",\n");
      return `@${bibtexKind(entry.kind)}{${entry.key},\n${body}\n}`;
    })
    .join("\n\n") + (entries.length === 0 ? "" : "\n");
}

export const bibliographySourceCapability: BibliographySourceCapability = {
  parseBibtex: parseBibliographyBibtex,
  serializeBibtex: serializeBibliographyBibtex,
  parseJson: parseBibliographyJson,
  serializeJson: serializeBibliographyJson,
};
