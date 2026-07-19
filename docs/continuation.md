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

## Current verified slice

The semantic item-list slice adds:

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

Implement the browser/canonical reference inline and a derived semantic-target
registry, followed by inline footnotes. Then use the repeated nested-content
lessons from lists and footnotes for the rich table core and its CSV adapter.
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
