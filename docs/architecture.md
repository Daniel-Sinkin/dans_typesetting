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
adapters. The standalone Inline Sequence foundation has a writer-specific
consumption endpoint, and paragraphs, captions, cells, and other inline hosts
share that writer's inline adapter registry.

The browser builder follows the same shape with `DocumentPort`,
`BuilderPluginRegistry`, and `BuilderInlinePluginRegistry`. Excalidraw is a
canvas implementation around the document surface; it is not the document
model and does not own block data.

## Primitive choices

- A document is an ordered sequence of semantic blocks.
- A section is a structural block containing another ordered block sequence.
- `InlineSequence` is a standalone ordered-inline foundation.
- Ordinary text is an inline plugin and a paragraph is a semantic block plugin
  containing one `InlineSequence`.
- An inline extension is data implementing the shared `InlineNode` contract.
- Page dimensions and measured width/height belong to a layout/writer layer,
  not semantic blocks.
- A reference ID names a semantic target. A graphical authoring ID identifies
  an editable node. They are different concepts even when a future transport
  stores both as strings.
- A numbered occurrence may omit its optional reference ID. Traversal-derived
  numbering and visible captions do not depend on publishing an anchor.
- One block may publish several numbered occurrences. Display-math lines use
  their own stable occurrence IDs while retaining one owning block and ordered
  mutation boundary.

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
| Text-authored inline LaTeX math | `dans.math.latex.inline` |
| Text-authored display LaTeX math | `dans.math.latex.display` |
| Hyperlink | `dans.inline.hyperlink` |
| Semantic reference | `dans.inline.reference` |
| Footnote | `dans.inline.footnote` |
| Figure | `dans.image.figure` |
| Two-panel figure | `dans.image.figure_pair` |
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
- Text-authored LaTeX math is narrower than raw LaTeX: it stores trusted source
  inside implicit math delimiters, has explicit inline/display contracts, and
  has LaTeX, Markdown/Jupyter, canonical, and graphical adapters. The active
  builder uses this path while retaining structured-math codecs for existing
  documents. See [latex-math.md](latex-math.md).
- Code-listing language is a presentation classification with four opinionated
  values, not a compiler/parser contract. Rich-caption presence and target
  identity are independent, while every listing remains in one writer-owned
  numbering series.
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
- LaTeX is output-only and is never parsed as document input.

The core transport only understands `id`, `type`, and an ordered JSON `payload`.
Browser plugin modules register their own payload codecs. Native plugin
semantic decoders will follow the same ownership rule; native transport already
parses and reproduces the shared fixture without inspecting known or unknown
payloads. This makes the transport a protocol between modules, not a replacement
for their encapsulated runtime data structures.

See [canonical-transport.md](canonical-transport.md) for the normative shape and
current compatibility policy.

See [inline-sequences.md](inline-sequences.md) for the module boundary and the
planned optional authoring-markup producer protocol.

## Rich caption hosts

Captions are plugin-owned Inline Sequences rather than strings or fields on
document core. Ordinary figures, paired figures, tables, and code
listings expose their caption roots to graphical and publication writers. The
host defines whether a caption is required, but it does not know whether a node
is text, math, colour, code, a link, or a future extension.

The graphical sequence editor is shared infrastructure for this consumption
point; it is not part of the table plugin. Host copy hooks recursively refresh
inline identity, and occurrence numbering traverses nested caption content just
as it does paragraph and list content. Plain-text projection is limited to
image alternative text and reference-picker titles. See
[rich-captions.md](rich-captions.md).

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
resolver that renders the opaque scene as a PDF, PNG, or JPEG and then
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
presentation choice. Each stable list item owns an ordered Inline Sequence
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
optional reference ID. Every cell and the caption own Inline Sequences
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

Binary math nodes similarly store a semantic operator enum rather than a glyph
or TeX token. Relations and arrows occupy the low-precedence portion of that
contract; distinct products occupy the multiplicative portion. Atomic symbols
store a registered name shared by native and browser models. The graphical
writer chooses Unicode, while the common TeX connector chooses publication
syntax for both LaTeX and Markdown/Jupyter. See
[math-vocabulary.md](math-vocabulary.md).

Decorated identifiers remain atomic leaves with an explicit presentation
alphabet; the style is not a general wrapper around arbitrary math. Function
application is instead a recursive node with one argument consumption point.
Ordinary and named operators share that structural contract while writers own
italic/upright spelling and delimiter syntax. This preserves graphical
recursive editing without introducing evaluation semantics. See
[math-identifiers-and-functions.md](math-identifiers-and-functions.md).

Semantic math text is a constrained prose leaf rather than a paragraph or raw
TeX escape hatch. An underbrace is a recursive presentation node with ordinary
`body` and `annotation` consumption points. Upright identifiers, text, and
underbraces therefore remain backend-neutral while the TeX connector owns
`\mathrm`, `\text`, escaping, and `\underbrace` syntax. See
[math-annotations.md](math-annotations.md).

Numeric math leaves are source-spelling values rather than machine numbers.
Unsigned integer and decimal strings preserve leading or trailing zeroes and
arbitrary integer size; unary negation is a recursive node rather than a sign
embedded in either literal. Writers may group the node to avoid ambiguous
`a + -b` presentation, but they do not normalize or evaluate it. See
[math-numeric-literals.md](math-numeric-literals.md).

A structured display block owns an ordered sequence of equation-line
occurrences. Line numbering is explicit and independent from optional target
identity; one group therefore contributes zero, one, or many entries to the
writer's equation series. The graphical registry exposes a generic
`numberedOccurrences` endpoint rather than teaching builder core about math,
and plural target descriptors point at those occurrence IDs. See
[math-display-groups.md](math-display-groups.md).

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

A composite block may instead expose several target descriptors while still
consuming one block ordinal. The two-panel figure uses that contract for its
group plus `a`/`b` subordinate targets. Suffixes are writer-derived
presentation, not semantic state. See
[composite-figures.md](composite-figures.md).

## Inline hosts and occurrence numbering

The standalone Inline Sequence foundation defines the ordered inline-node
contract, while host plugins explicitly expose the inline roots they own.
Inline plugins may in turn expose nested inline roots. The graphical writer traverses those roots
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
citations consume them. This keeps citation lookup out of Inline Sequence and
keeps bibliography numbering out of the semantic record. The contract is also
usable for future glossaries, symbol indices, or datasets without adding a
central ever-growing callback interface. See
[bibliography.md](bibliography.md) for the source-adapter and writer policy.

The native Markdown writer uses the same resource pattern for bibliography
entries and a parallel target-descriptor pattern for referenceable blocks.
This lets it derive links and visible numbers without importing plugin
implementation details. See [markdown-writer.md](markdown-writer.md) for the
profile and its explicit degradation policy.

The first Jupyter writer composes a fully configured Markdown writer and adds
only a language-neutral nbformat container. It deliberately emits no kernel
metadata or executable cells for mixed-language thesis listings. See
[jupyter-writer.md](jupyter-writer.md) for the policy boundary.
