# Markdown writer

## Profile

The Markdown writer is an authoritative connector-driven export path over the
semantic document model. It emits a deliberately named profile rather than
claiming that one portable Markdown standard covers thesis documents:

- CommonMark prose, headings, links, images, lists, and fenced code;
- GFM pipe tables;
- TeX mathematics inside `$...$` and `$$...$$` delimiters;
- reference-style footnotes using `[^n]` plus document-end definitions;
- constrained raw HTML for stable anchors, colour spans, and print page-break
  hints.

The output is accepted by Pandoc's default Markdown reader. Consumers that do
not enable math, reference-footnote, or raw-HTML extensions still retain
visible source instead of receiving silently omitted semantic content.

## Registration boundary

`MarkdownWriter` knows only the core `Section` tree. Every plugin block is
lowered by a separately registered `MarkdownBlockAdapter`, and every Core
Paragraph inline node is lowered by a separately registered inline adapter.
Missing adapters fail before or during serialization with the exact unsupported
type ID.

Block adapters may publish two small prepass descriptors:

- numbered targets give the writer a label, numbering series, and optional
  stable `ReferenceId`;
- namespaced resources give the writer a namespace/key pair.

The writer derives section paths, figure/table/listing/equation ordinals,
anchors, bibliography ordinals, and duplicate diagnostics from those
descriptors. It never switches on concrete plugin type IDs. References and
citations consume the completed index through the Markdown output context.

## Supported semantic contracts

| Contract | Markdown lowering |
| --- | --- |
| Section | explicit stable anchor plus `#` through `######` |
| Title page | document heading, author, and date |
| Table of contents | nested links derived from the section tree |
| Page break | constrained HTML print-break hint |
| Core text | escaped text plus `*`, `**`, or `***` emphasis |
| Hyperlink | native Markdown link with a collision-safe destination |
| Inline code | backtick fence longer than every source backtick run |
| Colour span | constrained `<span style="color: #RRGGBB">` |
| Footnote | numbered reference plus a document-end rich definition |
| Inline image | native Markdown image |
| Figure | native image, writer-derived number, caption, and anchor |
| Two-panel figure | two-column image table, rich panel/group captions, and suffixed targets |
| Item list | itemized or automatically numbered Markdown list |
| Table | GFM pipe table with alignment, caption, number, and anchor |
| Code listing | collision-safe fenced block, language, caption, and anchor |
| Inline/display math | shared TeX-expression lowering inside math delimiters |
| Semantic reference | live link such as `Section 1.2` or `Figure 3` |
| Citation | linked numeric occurrence resolved by bibliography key |
| Bibliography | normalized ordered records with DOI/URL links |

Raw LaTeX blocks and inline nodes intentionally have no Markdown adapter. They
are backend-specific escape hatches, so silently copying their source into a
Markdown document would falsely claim writer compatibility. Embedded
Excalidraw drawings also remain unsupported until the Markdown connector gets
an explicit scene-to-asset resolver equivalent to the LaTeX boundary.

## Explicit degradation policy

Markdown does not carry several layout contracts uniformly. The first writer
therefore makes these choices explicit:

- figure relative width, preferred pixel extent, and inline-image em height are
  ignored; source asset identity and captions are preserved;
- a two-panel figure retains its side-by-side relation through a GFM table, but
  Markdown viewers may ignore the requested per-panel width and pixel hints;
- every line of a grouped display-math block is emitted as its own display, so
  independent anchors and equation numbers survive but cross-line automatic
  alignment does not;
- an explicit page break is an HTML print hint and may be ignored by a viewer;
- GFM permits at most one header row, so a table with more than one semantic
  header row is rejected instead of flattened;
- a headerless semantic table receives an empty GFM header row because pipe
  table syntax requires one.

These are connector policies, not mutations or limitations of the semantic
plugins. A future writer may honor the same hints differently.

## Verification

`native_markdown_test` constructs one representative document containing every
supported contract, writes `build-*/native-markdown-test.md`, checks escaping,
numbering, anchors, code fences, citations, and references, and exercises
duplicate/unresolved/missing-adapter failures. The emitted fixture is also
converted with Pandoc during manual release verification.
