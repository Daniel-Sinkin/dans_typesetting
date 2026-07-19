# Architecture

## Boundary map

The project has four distinct jobs:

1. The semantic document core owns ordered blocks and structural sections.
2. Plugin modules own concrete block or inline data contracts.
3. Writer connectors translate one plugin contract into one writer contract.
4. Authoring applications edit a versioned transport representation and never
   use a writer's output as semantic storage.

The native LaTeX and Markdown paths currently follow this split. `Document`
knows neither backend nor the concrete paragraph/image/math plugins. Each
writer walks core sections and delegates concrete blocks to registered
adapters. Core Paragraph has a writer-specific inline consumption endpoint,
and paragraph-like hosts share that writer's inline adapter registry.

The browser builder follows the same shape with `DocumentPort`,
`BuilderPluginRegistry`, and `BuilderInlinePluginRegistry`. Excalidraw is a
canvas implementation around the document surface; it is not the document
model and does not own block data.

## Primitive choices

- A document is an ordered sequence of semantic blocks.
- A section is a structural block containing another ordered block sequence.
- A paragraph is a plugin block containing an ordered inline sequence.
- An inline extension is data implementing the Core Paragraph inline contract.
- Page dimensions and measured width/height belong to a layout/writer layer,
  not semantic blocks.
- A reference ID names a semantic target. A graphical authoring ID identifies
  an editable node. They are different concepts even when a future transport
  stores both as strings.

## Compatibility rule

Semantic type IDs are part of the interchange contract. Native and browser
implementations must use the same spelling. The currently aligned IDs include:

| Contract | Type ID |
| --- | --- |
| Paragraph | `dans.core.paragraph` |
| Ordinary text | `dans.core.text` |
| Inline code | `dans.code.inline` |
| Citation | `dans.bibliography.citation` |
| Inline math | `dans.math.inline` |
| Display math | `dans.math.display` |
| Hyperlink | `dans.inline.hyperlink` |
| Semantic reference | `dans.inline.reference` |
| Footnote | `dans.inline.footnote` |
| Figure | `dans.image.figure` |
| Listing | `dans.code.listing` |
| Section | `dans.core.section` |
| Title page | `dans.document.title_page` |
| Table of contents | `dans.document.table_of_contents` |
| Page break | `dans.document.page_break` |
| Embedded Excalidraw drawing | `dans.drawing.excalidraw` |
| Itemized/enumerated list | `dans.list` |
| Rich table | `dans.table` |
| References block | `dans.bibliography.references` |

Adding a plugin is not complete merely because its native class exists. A
complete vertical slice needs semantic data, validation, at least one useful
writer connector, graphical preview/editing or an intentional opaque fallback,
and tests at the boundaries it implements.

## Current intentional constraints

- Text emphasis is a property of an ordinary text leaf. It therefore composes
  with a surrounding colour span but cannot accidentally wrap structured math.
- Hyperlink labels are inline sequences. A target-only link displays its target.
  Nested hyperlinks are forbidden because neither PDF nor browser semantics are
  defensible for links inside links.
- Raw LaTeX is an explicit backend-specific escape hatch. It does not count as
  Markdown, Jupyter, graphical, or future PDF support.
- Code-listing language is a presentation classification with four opinionated
  values, not a compiler/parser contract. Caption and target identity are
  independent, while every listing remains in one writer-owned numbering
  series.
- Inline code is a semantic single-line source leaf, not a Core Text style.
  Multiline source remains a listing, and each writer owns its code syntax.
- Citation keys and normalized bibliography records are semantic data. Visible
  ordinals, BibTeX syntax, and `thebibliography` syntax belong to writers or
  optional source adapters.
- The graphical writer may show an opaque placeholder for unsupported plugins.
  It must preserve their envelope and payload rather than dropping them.

## Canonical transport

The native and browser implementations share a versioned JSON document
envelope. It is the persistence and interchange boundary; generated LaTeX and
graphical preview state are never semantic storage. The contract provides:

- exact encode/decode round trips;
- stable authoring IDs and separate optional reference IDs;
- ordered recursive block and inline sequences;
- plugin-owned payload schemas keyed by semantic type ID;
- preservation of unknown plugin payloads;
- explicit document-model versioning and a schema-version migration seam;
- conformance fixtures consumed by native and browser implementations;
- no LaTeX importer.

The core transport only understands `id`, `type`, and an ordered JSON `payload`.
Browser plugin modules register their own payload codecs. Native plugin
materializers will follow the same ownership rule; the native transport already
parses and reproduces the shared fixture without inspecting known or unknown
payloads. This makes the transport a protocol between modules, not a replacement
for their encapsulated runtime data structures.

See [canonical-transport.md](canonical-transport.md) for the normative shape and
current compatibility policy.

## Semantic document shell and page policy

Title pages, tables of contents, and explicit page breaks are ordinary plugin
blocks. They are neither fields on `Document` nor special preamble state. A
section remains a core structural block because its nested sequence is the
format primitive that makes heading hierarchy, numbering, references, and ToC
traversal unambiguous.

The LaTeX connector lowers those contracts to `titlepage`,
`\tableofcontents`, `\clearpage`, and labelled section commands. The graphical
writer applies plugin-declared page policies while measuring a recursive flow:

- continuous mode keeps one growing authoring surface;
- paged mode projects a selected range of at most five pages;
- semantic blocks are indivisible in this development writer;
- an oversized block is represented by a warning instead of silently
  overflowing;
- section children retain their owner and insertion sequence rather than being
  flattened in the document model.

Page dimensions and policies remain writer concerns. Other writers may ignore
preferred sizes or implement fragmentable paragraphs without changing the
semantic contracts.

## Embedded drawing boundary

An Excalidraw drawing is an ordinary, referenceable semantic block. Its plugin
owns a bounded scene, caption, reference ID, preferred width, and development
canvas height. The graphical connector mounts an isolated Excalidraw instance
inside the document page and publishes immutable scene drafts through the same
transactional editor contract as every other block.

The LaTeX connector does not know how Excalidraw renders. It receives an asset
resolver that materializes the opaque scene as a PDF, PNG, or JPEG and then
lowers that asset to an ordinary numbered figure. The resolved cache path is
writer-owned state and never enters the semantic document. The example build
uses a committed SVG converted to PDF as a deterministic stand-in; the browser
editor can export the live scene to SVG.

Excalidraw's scene schema is deliberately contained inside this one plugin. It
may require a plugin-payload migration when Excalidraw changes, but it does not
version or contaminate the document core. The free-form scene surrounding the
document is still application state and is not copied into drawing blocks.

## Semantic list boundary

`dans.list` is one semantic plugin with an explicit itemized/enumerated
presentation choice. Each stable list item owns an ordered Core Paragraph
inline sequence. Consequently text styles, colour, links, and mathematics work
inside lists through existing inline adapters; the list plugin and its writers
do not acquire knowledge of those concrete extensions.

The graphical editor can add, remove, and reorder both items and inline
segments while preserving opaque extensions. The LaTeX connector injects the
same inline renderer used by paragraphs and captions, and only contributes the
`itemize`/`enumerate` structure. This is the intended pattern for plugin-owned
repeated nested data: the document core still sees one opaque block.

## Rich table and CSV boundaries

`dans.table` owns a rectangular sequence of stable rows and cells, a leading
header-row count, per-column semantic alignment, an inline-rich caption, and an
optional reference ID. Every cell and the caption own Core Paragraph inline
sequences. The table plugin can therefore host text styles, mathematics,
references, and footnote occurrences without depending on those concrete
extensions. It stores neither a visible table number nor physical column
widths.

The graphical connector provides structural row/column operations, column
alignment, selected-cell and caption sequence editing, live target numbering,
and plugin-aware deep copies. The LaTeX connector contributes `table`,
`tabular`, and `booktabs` structure while delegating all inline content to the
shared renderer.

CSV is a separate optional capability rather than a table payload format. A
builder assembled without it still previews and edits complete semantic tables;
registering it reveals import/export controls. Import creates Core Text cells,
may mark the first row as a header, and is capped at 30 rows in this authoring
UI. Export is deliberately a plain-text subset and rejects math, footnotes, or
other structured cell nodes instead of silently destroying them. Both native
and browser parsers handle quoted commas, escaped quotes, embedded newlines,
CRLF, and rectangularity checks.

## Structured-math grid and MatVec boundary

Structured mathematics is a presentation tree, not an evaluation AST. Its core
now includes one rectangular `grid` primitive whose cells are ordinary recursive
math expressions. A grid records row and column counts but no brackets, physical
cell dimensions, matrix algebra semantics, or backend syntax. Writers therefore
have one small two-dimensional layout contract to implement.

`Math::MatVec` is an optional native authoring extension that composes this grid
with square delimiters. It supplies rectangular matrices plus row- and
column-vector helpers without adding a matrix-specific expression kind. The
browser equivalent contributes optional palette constructors to the math editor;
the base preview, drag/drop, selection, parking, clipboard, and canonical codecs
only consume the resulting delimiter and grid primitives. Removing the editor
extension hides those constructors but does not make an existing matrix document
unreadable.

Grid cells reject display-alignment points because a LaTeX `&` inside a matrix
cell would collide with the grid's own column separator. Row/column spans,
determinants, cases, and matrix evaluation remain separate future extensions.
See [math-matvec.md](math-matvec.md) for the concrete contract.

Fractions, radicals, and scripts use the same recursive contract. A fraction
owns numerator and denominator expressions, a radical owns its radicand and an
optional degree, and a script owns a base plus at least one script. These are
presentation nodes rather than evaluable arithmetic. The browser editor exposes
each child through ordinary math paths, so selection, drag/drop, parking,
clipboard transport, and canonical persistence require no structure-specific
mutation channel. See [math-structures.md](math-structures.md) for the native and
graphical authoring contract.

## Semantic target index

Referenceable block plugins expose a small descriptor containing an optional
stable target ID, semantic label, and optional title. They do not own visible
counters. The graphical writer walks the current section tree once and derives
section paths plus plugin-declared numbering-series ordinals. Consequently an
inline `dans.inline.reference` stores only its stable target ID while rendering
live text such as `Section 1.2`, `Figure 3`, `Equation 4`, or `Listing 2`.

The derived index rejects duplicate target IDs across independent plugins.
Plugin-aware Alt-drag copies clear target IDs while preserving every other
payload field, including recursively copied section children, so a copy cannot
silently create an ambiguous reference. Unknown and unresolved references stay
visible rather than being discarded. LaTeX retains its independent `\label`
and `\autoref` lowering over the same semantic IDs.

## Inline hosts and occurrence numbering

Core Paragraph defines the ordered inline-node contract, while paragraph-like
plugins explicitly expose the inline roots they host. Inline plugins may in
turn expose nested inline roots. The graphical writer traverses those roots
without learning concrete payload shapes and derives independent ordinal
series from current document order. Reordering a block, list item, wrapper, or
inline node therefore updates visible markers without mutating semantic data.

`dans.inline.footnote` is the first consumer of this contract. It owns a
non-empty ordered inline sequence, declares the `footnote` occurrence series,
and stores neither a marker nor a counter. Its graphical connector supplies a
live superscript/popover and a nested sequence editor; its LaTeX connector
delegates the note body to the shared inline renderer and contributes only the
`\footnote{...}` boundary. Directly nested footnotes are forbidden. Copy hooks
recursively refresh authoring IDs so Alt-drag duplication cannot create two
numbered occurrences with the same identity.

This same writer-owned traversal is intended for future citation occurrences
and specialized table-note policies. It is separate from semantic target numbering: figures and
equations have stable reference IDs, while a footnote is identified by where
its inline occurrence appears.

## Namespaced document resources

Some plugin data is neither a referenceable block target nor an inline
occurrence. Block adapters may therefore publish immutable resources under a
semantic namespace. The graphical writer derives one document-wide index,
assigns ordinals in traversal order, and rejects duplicate namespace/key
pairs. Consumers receive the completed index through their render/editor
context; generic builder code never interprets the resource value.

Bibliography entries currently publish `dans.bibliography.entry` resources and
citations consume them. This keeps citation lookup out of Core Paragraph and
keeps bibliography numbering out of the semantic record. The contract is also
usable for future glossaries, symbol indices, or datasets without adding a
central ever-growing callback interface. See
[bibliography.md](bibliography.md) for the source-adapter and writer policy.

The native Markdown writer uses the same resource pattern for bibliography
entries and a parallel target-descriptor pattern for referenceable blocks.
This lets it derive links and visible numbers without importing plugin
implementation details. See [markdown-writer.md](markdown-writer.md) for the
profile and its explicit degradation policy.
