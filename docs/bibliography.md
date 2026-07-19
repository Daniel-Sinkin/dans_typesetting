# Citations and normalized bibliographies

## Semantic contract

The bibliography plugin owns two independent semantic types:

- `dans.bibliography.citation` is an inline leaf containing one or more ordered
  citation keys;
- `dans.bibliography.references` is a block containing an ordered sequence of
  normalized reference records.

A key begins with an ASCII letter and may then contain ASCII letters, digits,
`-`, `_`, `.`, and `:`. Keys are semantic identities, while browser entry IDs
are authoring identities. A citation cannot be empty or repeat a key, and a
bibliography block cannot repeat a key or entry ID.

Each normalized record contains a key, one opinionated kind, a non-empty title,
an ordered author list, and optional year, venue, publisher, DOI, and URL. The
supported kinds are article, book, proceedings paper, thesis, web, and
miscellaneous. Empty optional strings normalize to absence. The model does not
store BibTeX field spelling, LaTeX commands, visible citation numbers, or a
rendered reference string.

## Writer-owned resource index

Bibliography entries demonstrate a second generic traversal contract alongside
reference targets and inline occurrences. A block plugin may publish
namespaced resources. The graphical writer traverses the current block tree,
assigns each resource an ordinal in its namespace, and rejects duplicate
namespace/key pairs. Citation preview code consumes the resulting index; the
paragraph plugin, document core, and bibliography editor do not know how the
ordinal was produced.

Reordering entries therefore changes `[1, 2]` to `[2, 1]` immediately without
mutating either citation. Missing keys remain visible as diagnostics. The
current authoring policy expects one bibliography block in a publication even
though the generic resource index can combine resources from multiple blocks.
An authoritative multi-bibliography policy needs a corresponding LaTeX
connector design before multiple reference lists should be used in a thesis.

The LaTeX connector lowers citations to `\cite{...}` and normalized records to
`thebibliography`/`\bibitem`, with escaped selectable text and working DOI/URL
links. No `.bib` file is needed in that path, and no LaTeX or BibTeX importer is
part of the document core.

## Source adapters

BibTeX and bespoke JSON are optional adapters over normalized records. A
builder assembled without them can still create, edit, preview, serialize, and
export the semantic bibliography. Registering the source capability adds load
and store controls to the editor. Import validates a complete source and then
replaces the current entry sequence; the graphical import is capped at 1000
records to avoid an accidental authoring-surface explosion.

The bespoke JSON projection is UTF-8 JSON with no browser-local IDs:

```json
{
  "format": "dans.typesetting.bibliography",
  "schemaVersion": 1,
  "entries": [
    {
      "key": "Verstraete2008",
      "kind": "article",
      "title": "Matrix product states and projected entangled pair states",
      "authors": ["Frank Verstraete", "Valentin Murg"],
      "year": 2008,
      "venue": "Advances in Physics",
      "publisher": null,
      "doi": "10.1080/14789940801912366",
      "url": null
    }
  ]
}
```

The native and browser BibTeX adapters support `article`, `book`, `inbook`,
`inproceedings`, `conference`, `phdthesis`, `mastersthesis`, `online`, `www`,
and `misc`, including braced/quoted values, nested grouping braces, `%`
comments, and CRLF. They deliberately reject string declarations, bare string
macro references, preambles, value concatenation, unsupported entry kinds,
non-numeric years, and LaTeX commands inside values. Export likewise rejects
braces, backslashes, and line breaks
that cannot be represented by the conservative projection. These failures are
intentional: silently flattening a rich BibTeX database would make the
normalized document look more trustworthy than it is.

## Graphical authoring

The bibliography editor provides a live numbered reference preview, complete
record fields, add/remove/reorder operations, and optional BibTeX/JSON file
controls. Citation segments are added and moved through the ordinary paragraph
inline sequence. Their payload editor accepts comma-separated keys and exposes
the live resource list as choices. The canonical document fixture covers both
types, while independent adapter tests compare semantic projections so
regenerated browser IDs do not masquerade as bibliography data.
