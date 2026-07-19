# Continuation state

This file records recovery information for a fresh development session. Update
it at every milestone rather than relying on conversation history.

## Verified checkpoints

Commit `bfe1471` contains the native LaTeX prototype and the first Excalidraw
graphical builder. It was pushed to `main` after native PDF generation, strict
TypeScript/lint/unit checks, browser smoke interactions, and `npm audit` passed.

Commit `255ac74` completes the prose slice: styled text, semantic hyperlinks,
inline structured math editing, and direct syntax-coloured listing editing.

Commit `5ffef61` adds the canonical, versioned transport boundary shared by the
native and graphical implementations.

Commit `a249217` adds the semantic document shell, recursive sections, and
continuous/paged whole-block projection.

Commit `17fd196` adds bounded inline Excalidraw drawing blocks.

Commit `5d9a837` adds itemized/enumerated semantic lists.

Commit `6411db5` adds semantic document references and writer-derived target
numbering.

Commit `6bd1dfa` adds semantic inline footnotes and generic inline occurrence
numbering.

Commit `39e89eb` adds semantic rich tables and the optional plain-text CSV
capability.

Commit `9cdd1df` adds the structured rectangular math-grid primitive and MatVec
authoring extension.

Commit `bdf0fdf` completes semantic code listings across native, canonical,
graphical, browser-smoke, and PDF paths.

Commit `ab2c589` adds structured fractions, radicals, and scripts across native
and graphical math composition.

## Current verified slice

The semantic inline-code slice adds:

- `dans.code.inline` as an independent Core Paragraph extension rather than a
  prose style or raw-LaTeX escape;
- a single-line validated native model and escaped `\texttt{...}` LaTeX
  connector;
- a draggable graphical segment with distinct preview and live payload editor;
- plugin-owned canonical transport, shared-fixture coverage, and exact
  encode/decode normalization;
- malformed-payload tests, dual-compiler native coverage, and real-browser
  preview/edit/commit coverage.

Multiline source remains `dans.code.listing`; an empty inline-code value is
allowed as transient authoring data.

The preceding structured-math composition slice adds native and graphical
fractions, square/indexed radicals, and subscript/superscript nodes with parser,
clipboard, canonical transport, nested editor, browser smoke, and compiled-PDF
coverage. See `math-structures.md`.

The preceding semantic code-listing completion slice adds:

- C++, CUDA, Julia, and raw language hints across native, canonical, graphical,
  and LaTeX representations;
- independent optional captions and stable reference IDs;
- writer-consistent numbering for captionless snippets through an explicit
  LaTeX counter step and a live graphical header;
- CUDA-aware dependency-free browser highlighting and unclassified raw mode;
- direct syntax-coloured source editing with four-space Tab behavior preserved;
- backward-compatible canonical decoding for payloads without a caption;
- all four metadata combinations in native/transport tests, real browser edit
  coverage, canonical fixtures, and compiled-PDF sample coverage.

The language field is intentionally only a presentation hint. It is not a
promise that the source parses, compiles, or belongs to a complete language
grammar. See `code-listings.md` for the normative contract.

The preceding structured-math grid and MatVec slice adds:

- a rectangular, recursively nested core math-grid primitive in native and
  browser models;
- `Math::MatVec` as a separate native authoring module that composes grids and
  square delimiters into matrices, row vectors, and column vectors;
- a registered graphical editor extension contributing square, rectangular,
  row-vector, and column-vector drag sources;
- ordinary cell-level selection, typed insertion, drag/drop, detach, parking,
  and clipboard behavior through existing math mechanics;
- canonical recursive grid transport plus exact round-trip coverage;
- LaTeX `matrix` lowering, a referenced native sample equation, compiled PDF
  coverage, malformed-shape tests, and real browser pointer interaction.

The semantic constructor accepts arbitrary positive rectangular dimensions.
The first graphical palette exposes fixed `2x2`, `2x3`, `1x3`, and `3x1`
templates; an arbitrary dimension picker is future authoring policy.

The preceding rich-table and optional-CSV slice adds:

- `dans.table` with stable rectangular rows/cells, inline-rich caption and cell
  content, header role, column alignment, and optional target identity;
- native semantic data plus a `booktabs` LaTeX connector using the shared inline
  renderer;
- independent native/browser CSV adapters with quoted-field support,
  normalization tests, file seams, rectangularity validation, and bounded
  graphical import;
- graphical live preview, selected-cell/caption sequence editing, structural
  row/column operations, alignment, numbering, reference targets, and optional
  CSV controls;
- explicit rejection of lossy structured-cell CSV export;
- plugin-aware deep copying, occurrence traversal, canonical fixture coverage,
  real browser file import/export interaction, native tests, and compiled PDF
  coverage.

The semantic table does not encode page widths or a 30-row limit. Those are
respectively writer and graphical CSV-import policies.

The preceding semantic inline-footnote slice adds:

- `dans.inline.footnote` as a non-empty nested Core Paragraph inline host;
- generic plugin-declared nested-inline traversal and writer-owned occurrence
  numbering, shared by paragraphs and semantic list items;
- live graphical superscript markers, hover/focus note previews, and nested
  segment add/remove/reorder/payload editing;
- canonical recursive payload transport and exact round-trip coverage;
- native semantic data plus a LaTeX adapter that delegates note bodies to the
  shared inline renderer;
- plugin-aware deep copies that refresh nested inline identity;
- malformed-content, numbering, browser interaction, native connector, and PDF
  build coverage.

Footnotes deliberately store no visible number. Direct nesting is rejected;
more general containment policies between independent inline extensions remain
a future capability-contract problem rather than a footnote-specific core
special case.

The semantic target/reference slice adds:

- `dans.inline.reference` in the canonical browser contract, matching the
  native reference plugin;
- plugin-exposed target descriptors for sections, images, drawings, display
  equations, and listings;
- live writer-derived `Section 1.2`, `Figure 3`, `Equation 4`, and `Listing 2`
  labels with stable clickable anchors;
- duplicate-target validation and an editor target picker with unresolved
  references remaining visibly diagnosable;
- optional target IDs in figure/equation/listing codecs with backward-compatible
  decoding of earlier payloads;
- plugin-aware recursive copies that clear target identity while preserving
  authoring content;
- canonical fixture, target-index, copy, browser interaction, native transport,
  and PDF build coverage.

The preceding semantic item-list slice adds:

- `dans.list` with explicit itemized/enumerated presentation;
- stable ordered items, each owning the Core Paragraph inline contract;
- native semantic classes and a LaTeX connector using the shared inline
  renderer rather than learning concrete text/math/link types;
- canonical plugin codecs with item/inline identity and round-trip validation;
- graphical preview plus live presentation, item, segment, and payload editing;
- immutable reorder helpers, malformed-payload tests, native adapter tests, and
  a real browser interaction covering composition and commit;
- representative native/browser sample content and cross-language fixture data.

The preceding embedded Excalidraw drawing slice adds:

- `dans.drawing.excalidraw` as an ordinary referenceable semantic block;
- a plugin-owned, validated and canonically round-trippable scene payload;
- a real isolated Excalidraw editor mounted directly inside the document page;
- transactional draft preview, live width/height reflow, cancel restoration,
  scene editing, image-file preservation, and explicit SVG export;
- safe asynchronous SVG previews that cannot publish a stale scene;
- a native semantic plugin and a LaTeX adapter with an injected asset resolver;
- PDF/PNG/JPEG path validation shared with the ordinary image connector;
- a deterministic SVG-to-PDF example asset and generated-PDF coverage;
- unit, transport, native, and browser interaction tests.

The preceding semantic document-shell and page-projection slice adds:

- ordinary title-page, table-of-contents, and page-break plugin blocks;
- referenceable structural sections with recursive ordered child sequences;
- native LaTeX connectors for all shell contracts;
- canonical browser codecs and a cross-language fixture containing nested
  section content;
- continuous and paged graphical projections;
- live ToC numbering derived from the section tree;
- whole-block page flow, isolated title pages, explicit page breaks, a
  five-page projection cap, and oversized-block warnings;
- recursive insert, move, copy, replace, and delete operations without
  flattening section ownership.

The preceding canonical-transport slice provides:

- schema-versioned `.dans.json` whole-document persistence;
- plugin-owned block and inline codecs in the browser;
- stable document metadata and transactional full-document replacement;
- unknown block and inline payload preservation;
- Save/Load controls and a browser smoke import path;
- a strict native ordered-JSON and canonical-envelope implementation;
- one shared fixture that normalizes exactly in both implementations.

The native transport still preserves plugin payloads opaquely. Native
plugin-specific materialization into runtime `DocumentBlock` instances is not
yet implemented; this is deliberately a separate adapter concern.

## Verification commands

```sh
cmake -S . -B build-clang -DCMAKE_BUILD_TYPE=Debug
cmake --build build-clang --parallel
ctest --test-dir build-clang --output-on-failure

cd builder
npm run check
npm run smoke
npm audit --audit-level=low
```

The production build currently emits an expected large-chunk warning because
Excalidraw is bundled eagerly. This is not a correctness failure; adapter
isolation and lazy loading are the intended remedies.

## Next work

Begin the citation/bibliography contract.
Keep the completed table, listing, inline, and structured-math contracts stable
while adding those independent capabilities. Structured fractions, square and
indexed roots, and sub/superscripts now have native LaTeX, graphical editing,
typed-parser, clipboard, canonical-fixture, and browser-smoke coverage.
Keep plugin payload codecs beside their plugin and extend the shared fixture
whenever a new canonical type is completed.

Current deliberate compromises to reassess later:

- paged development layout treats every block as indivisible, including long
  paragraphs;
- a trailing explicit page break may leave an empty authoring page available
  for insertion;
- nearest-slot selection across nested sections is geometric and will need
  interaction tuning with denser documents;
- title-page isolation is a graphical plugin policy, while the LaTeX connector
  delegates exact page mechanics to LaTeX.
- a drawing scene currently follows Excalidraw's plugin-private schema and will
  need a payload migration if that upstream schema changes incompatibly;
- the native sample resolves a deterministic pre-rendered asset; production
  native export still needs an Excalidraw scene materializer process;
- nested Excalidraw instances materially increase the eager browser bundle, so
  editor lazy-loading belongs in a later shell/performance slice.
- list editing currently uses explicit move buttons rather than pointer drag;
  the semantic command and identity boundaries are complete, but the gesture
  should converge with the rest of the builder after interaction tuning.
- footnote nested-segment editing currently uses explicit move buttons; the
  surrounding paragraph sequence still uses pointer dragging.
- direct footnote nesting is rejected, but a future generic containment policy
  should decide whether another wrapper may indirectly contain a footnote.
- the first table model is deliberately rectangular: row/column spans,
  composite cells, explicit widths, and repeating headers are not implemented;
- the graphical table editor exposes zero/one header rows even though the model
  and LaTeX connector support any leading header-row count;
- CSV export accepts only Core Text cells because CSV cannot preserve semantic
  inline structure; import replaces the grid but retains caption and target;
- generic footnotes can occur in table cells, but publication-quality LaTeX
  table-note placement needs a dedicated extension instead of relying on plain
  `\footnote` inside `tabular`;
- table row/column and nested-segment movement currently uses explicit controls
  rather than drag gestures.
- MatVec intentionally lowers to a core grid plus delimiter instead of adding a
  matrix-specific expression kind; the graphical extension currently exposes
  four fixed templates and no arbitrary dimension picker.
- grid cells reject explicit display-alignment points because those would
  collide with writer-owned matrix column separators.
- every listing participates in numbering even when its caption is absent; the
  graphical header exposes that number while LaTeX keeps it visually hidden.
- graphical listing captions are still plain strings even though native
  captions consume the Core Paragraph inline contract.
