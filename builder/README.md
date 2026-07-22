# Graphical document builder

This prototype embeds a semantic document surface inside an Excalidraw note canvas. The surface can
be projected as one vertically growing continuous view, as whole-block A4 pages, or as 16:9 slides. Paragraph,
image, two-panel figure, embedded-drawing, semantic-list, rich-table, bibliography, code-listing,
generic-caption, trusted-Python-plot, compositional-grid,
text-authored math, title-page, table-of-contents, page-break, and section plugins
contribute palette entries, default block construction, vertical measurements, previews, and
optional editors. Generic builder code handles command dispatch, recursive document flow, insertion
previews, animated reflow, copying, transactional detach/delete behaviour, and page projection.
Document previews are rendered below Excalidraw, so sketches and free-form notes can be drawn over
the pages; the small interaction controls are rendered above them. Document blocks are not stored as
Excalidraw elements.

Composite plugins expose stable named child block sequences. Generic builder
machinery handles recursive lookup, validation, copy/move commands, insertion
targets, and controls; the owning plugin adapter supplies measurement and
placement. Padding exposes one inset `content` sequence; Grid exposes one exact
rectangle per arbitrary block-bearing cell, including recursively nested
composites. See
`../docs/nested-block-sequences.md`.

Grid is deliberately separate from rich Table. Grid cells own ordinary block
sequences and expose gap plus whole-boundary layout intent; Table cells own
Inline Sequences and retain header/alignment/CSV semantics. Empty Grid cells
remain visible drag targets, and the live editor changes rows, columns, gaps,
and inactive/single/double boundaries. See `../docs/grid.md`.

`Captioned` is a generic one-child composition block. Its optional string
category joins writer-derived numbering (for example `Figure`), while its rich
caption and optional reference remain independent of the nested plugin. The
sample wraps an uncaptioned Python plot and demonstrates that existing figures
and generated plots share live numbering.

Python-plot editing executes explicitly trusted local source through a bounded
Vite capability and displays the returned SVG through an image boundary. It is
not a sandbox. The editor preloads `np`/`plt`, live-updates source and sizing,
and persists only source plus rendering intent. See
`../docs/python-plots.md`.

The graphical writer may be incomplete by design. A registered block type uses its adapter; an
unknown type is preserved by `DocumentPort` and rendered through one visible opaque-block fallback.
The fallback reads only the common stable ID and type ID and never inspects plugin-owned payload.

The current `MemoryDocumentPort` is deliberately behind a command/snapshot interface. Versioned
`.dans_doc` persistence sits on the other side of that boundary: plugin-owned codecs translate
runtime shapes to canonical payload envelopes, while unknown plugin payloads remain opaque. The
same conformance fixture is normalized exactly by browser and native transport tests.

## Run

```bash
cd builder
npm install
npm run dev
```

Open the displayed local URL, then drag a block from the docked Blocks sidebar into the document.
Drag an existing block by its handle to reorder it or to nest it inside a section; hold Alt while
dragging to copy it. Dropping a moved block outside the document keeps it detached until the
confirmation dialogue either restores or deletes it. Title pages are isolated in paged mode, a
table of contents derives its numbered entries from the live section tree, and explicit page breaks
advance following content. Page/slide range controls project at most five surfaces at once. Slide
mode also exposes a fullscreen-friendly one-slide reader with keyboard navigation; it consumes the
same graphical plugin adapters rather than maintaining a second presentation model.

Paragraph editing is a direct writing surface backed by the ordered inline sequence. Ordinary text
is typed and selected in place, bold/italic formatting uses familiar controls and keyboard
shortcuts, and semantic code, colour, links, cross-references, citations, footnotes, math, and images
are inserted at the caret without dragging cards. Clicking a rich inline pill opens only that
element's focused inspector. Image files can be chosen from the toolbar or pasted directly into the
paragraph; emoji-sized inline images retain text-relative height without acquiring figure numbering
or captions. Unsupported inline nodes remain visible as named read-only pills. Footnotes render
as live superscript markers
with hover/focus previews; their editor composes, adds, removes, and reorders a nested inline
sequence. Markers are derived from current document traversal rather than stored in the payload,
including when a footnote is hosted by a list item. Image editing uses the native file picker and
stores a preview together with the requested width and detected pixel dimensions. Ordinary figures
and listings use the same rich-caption sequence editor as paired figures and tables, including live
styles, code, math, colour, links, and numbered inline extensions. Code listings support C++, CUDA,
Julia, and raw text with rich caption and reference ID independently optional; a transparent
textarea aligned over the syntax-coloured preview makes the rendered surface directly editable,
and Tab inserts four spaces. Display and inline math are plain text editors for
source inside implicit LaTeX math delimiters, with immediate KaTeX preview and
visible parse errors. Numbered display blocks participate in the live equation
series and may publish a reference target; unnumbered blocks cannot. An
`aligned` environment may create several visual rows inside one equation, while
separate numbered equations remain separate blocks. The earlier recursive
structured-math model and codecs remain in the repository for compatibility,
but its graphical tree editor is benched and is not registered in the active
palette. See `../docs/latex-math.md`.

The two-panel figure extension owns two horizontal image panels, three rich inline captions, one
group target, and optional `a`/`b` panel targets. Its editor selects each image independently and
updates the shared panel width immediately. It is intentionally separate from an ordinary figure;
general layouts now use the independent Grid contract, while this specialized
pair retains panel-specific `a`/`b` references and one shared figure ordinal.

The optional MatVec editor extension contributes square and rectangular matrix plus row/column
vector templates. They lower to the base math model's rectangular grid and delimiter primitives,
so every cell accepts the same typed input and recursive drag/drop operations as any other math
subtree. Existing matrices still render and serialize if the optional palette contribution is not
registered.

The base math palette also exposes semantic inequalities, membership, arrows, distinct product
operators, Greek letters, and common physics/calculus symbols. The optional input parser accepts
ASCII spellings such as `i in A`, `a <= b`, `a otimes b`, `theta`, and `partial`; canonical data
stores the operation or symbol name rather than the displayed glyph.

Decorated identifiers and function applications use the same recursive math
tree. The palette exposes upright/blackboard/calligraphic placeholder leaves,
single-line annotation text, an underbrace, and ordinary/named function
templates. The optional parser accepts `bb(R)`, `cal(H)`, `rm(cores)`,
`text("FMA width")`, `underbrace(x, text("label"))`, `f(x)`, `f[x]`, and
`op(spectrum, cal(H))`; canonical payloads store
the ASCII name, presentation style, delimiter, and recursive argument rather
than the Unicode preview or TeX spelling.

Sections, images, paired-figure groups/panels, drawings, display equations, and listings may publish stable
semantic target IDs. The graphical writer derives their visible numbers from
current document order; reference segments therefore update immediately after
reordering. Duplicate IDs are rejected, unresolved references are shown in red,
and plugin-aware Alt-drag copies clear target identity rather than creating an
ambiguous duplicate.

Plugin-aware copies also recursively refresh inline IDs. This matters for
numbered inline occurrences such as footnotes: duplicating a paragraph or list
creates a distinct note occurrence while preserving its content.

An Excalidraw drawing is a semantic figure block rather than part of the surrounding note canvas.
Choose Edit to open a focused modal containing the second Excalidraw instance. Caption, reference
ID, and percentage width remain editable; displayed height is derived automatically from the scene's
visible bounds. Cancel discards the draft and Save commits one replacement transaction. The scene
preview is rendered through an isolated SVG image boundary, and Export SVG renders the same scene
for an external writer.

Itemized and enumerated lists are one semantic plugin. Every stable item owns the same ordered
inline sequence as a paragraph, so existing text-style, colour, hyperlink, and mathematics plugins
compose without list-specific cases. Its editor live-previews the whole list and supports switching
presentation, adding/removing/reordering items, adding/removing/reordering segments, and invoking
each registered segment's own payload editor. Explicit move controls are used for this first list
slice; pointer-drag gestures can replace them without changing the semantic commands.

Rich tables are numbered, referenceable blocks with stable rectangular rows and cells. Captions and
cells own ordinary inline sequences, so existing styles, links, math, references, and footnotes
compose through the same registry. The editor live-previews the table, edits a selected cell or
caption sequence, changes alignment/header role, and adds/removes/reorders structure. CSV is an
optional registered capability: it adds bounded file import and plain-text export controls without
changing the table contract. Structured-cell CSV export fails visibly instead of flattening math or
footnotes.

The references block owns normalized bibliography records while citation inline segments own only
stable keys. The graphical writer derives numeric citation links from document order, so reordering
records updates every preview immediately and unresolved keys stay visible. The full record editor
supports add/remove/reorder operations. BibTeX and bespoke JSON are optional registered source
capabilities; when present they add strict import/export controls without changing the semantic
block or canonical document payload.

Unknown document blocks remain in the flow as opaque labelled previews. Their Edit action logs a
stable handle to the browser console, demonstrating that preview and editing support are independent.
Ordinary Excalidraw tools remain available for panning, zooming, sketching, and free-form notes.

Paged and slide projection never split a semantic block: a block that does not fit moves to the next surface,
and one taller than an entire content area becomes a visible warning placeholder. This is an
authoring policy, not a semantic property of the block. Cross-page dragging works through the same
recursive insertion slots as continuous mode. Save and Load use the canonical document format;
native decoding of those plugin payloads remains a separate connector task. Multiple movable
document surfaces remain a later experiment. See `../docs/continuation.md` and
`../docs/canvas-migration.md` for recovery state and the bespoke-canvas plan. See also
`../docs/slide-development-writer.md` for the 16:9 and presentation policies.

## Verify

```bash
npm run check
npm run smoke
```

`check` runs linting, unit tests, strict TypeScript checking, and a production build. `smoke` starts
an isolated Vite/Chrome session, drives the primary interactions through the browser, and writes
screenshots to `test-results/` for visual inspection.
