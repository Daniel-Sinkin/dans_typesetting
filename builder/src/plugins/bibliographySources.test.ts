import { describe, expect, it } from "vitest";

import {
  createBibliographyEntry,
  type BuilderBibliographyEntry,
} from "./bibliographyModel";
import {
  parseBibliographyBibtex,
  parseBibliographyJson,
  serializeBibliographyBibtex,
  serializeBibliographyJson,
} from "./bibliographySources";

function semanticProjection(entry: BuilderBibliographyEntry) {
  return {
    key: entry.key,
    kind: entry.kind,
    title: entry.title,
    authors: entry.authors,
    year: entry.year,
    venue: entry.venue,
    publisher: entry.publisher,
    doi: entry.doi,
    url: entry.url,
  };
}

function sampleEntries(): readonly BuilderBibliographyEntry[] {
  return Object.freeze([
    createBibliographyEntry({
      key: "Verstraete2008",
      kind: "article",
      title: "Matrix product states and projected entangled pair states",
      authors: ["Frank Verstraete", "Valentin Murg", "J. Ignacio Cirac"],
      year: 2008,
      venue: "Advances in Physics",
      publisher: "Taylor & Francis",
      doi: "10.1080/14789940801912366",
      url: "https://example.com/paper",
    }),
    createBibliographyEntry({
      key: "CudaGuide",
      kind: "web",
      title: "CUDA C++ Programming Guide",
      authors: ["NVIDIA"],
      year: 2026,
      venue: "NVIDIA documentation",
      url: "https://docs.nvidia.com/cuda/cuda-c-programming-guide/",
    }),
  ]);
}

describe("bibliography source adapters", () => {
  it("round-trips bespoke JSON without leaking editor-local IDs", () => {
    const entries = sampleEntries();
    const serialized = serializeBibliographyJson(entries);
    const restored = parseBibliographyJson(serialized);

    expect(restored.map(semanticProjection)).toEqual(entries.map(semanticProjection));
    const first = entries.at(0);
    if (first === undefined) {
      throw new Error("The bibliography source fixture must not be empty");
    }
    expect(serialized).not.toContain(first.id);
    expect(JSON.parse(serialized)).toMatchObject({
      format: "dans.typesetting.bibliography",
      schemaVersion: 1,
    });
  });

  it("round-trips the supported BibTeX projection semantically", () => {
    const entries = sampleEntries();
    const serialized = serializeBibliographyBibtex(entries);
    const restored = parseBibliographyBibtex(serialized);

    expect(restored.map(semanticProjection)).toEqual(entries.map(semanticProjection));
    expect(serialized).toContain("@article{Verstraete2008");
    expect(serialized).toContain("@online{CudaGuide");
  });

  it("parses comments, quoted values, nested grouping, and CRLF", () => {
    const restored = parseBibliographyBibtex(
      "% exported elsewhere\r\n@article{Grouped,\r\n" +
        '  author = "Ada Lovelace and Grace Hopper",\r\n' +
        "  title = {A {GPU} Result},\r\n" +
        '  journal = "Journal of {HPC}",\r\n' +
        "  year = 2025\r\n}\r\n",
    );

    expect(restored[0]).toMatchObject({
      key: "Grouped",
      title: "A GPU Result",
      authors: ["Ada Lovelace", "Grace Hopper"],
      venue: "Journal of HPC",
      year: 2025,
    });
  });

  it("fails loudly for unsupported or lossy BibTeX constructs", () => {
    expect(() => parseBibliographyBibtex("@string{journal = {Physics}}"))
      .toThrow(/macros/u);
    expect(() => parseBibliographyBibtex("@article{A, title={A} # {B}}"))
      .toThrow(/concatenation/u);
    expect(() => parseBibliographyBibtex("@software{A, title={Code}}"))
      .toThrow(/Unsupported BibTeX entry type/u);
    expect(() => parseBibliographyBibtex("@article{A, title=titleMacro}"))
      .toThrow(/string macros/u);
    expect(() => parseBibliographyBibtex("@article{A, title={\\LaTeX}}"))
      .toThrow(/normalized UTF-8/u);
    expect(() => serializeBibliographyBibtex([
      createBibliographyEntry({ key: "A", kind: "article", title: "A {group}" }),
    ])).toThrow(/not supported/u);
    expect(() => parseBibliographyJson('{"format":"wrong","schemaVersion":1,"entries":[]}'))
      .toThrow(/Unsupported bibliography JSON/u);
    expect(() => parseBibliographyBibtex(
      "@article{Same,title={One}}\n@book{Same,title={Two}}",
    )).toThrow(/Duplicate bibliography key/u);
    const duplicateJson = serializeBibliographyJson([
      createBibliographyEntry({ key: "Same", kind: "article", title: "One" }),
      createBibliographyEntry({ key: "Same", kind: "book", title: "Two" }),
    ]);
    expect(() => parseBibliographyJson(duplicateJson)).toThrow(/Duplicate bibliography key/u);
  });
});
