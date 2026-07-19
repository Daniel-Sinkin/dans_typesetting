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

## Current verified slice

The semantic document-shell and page-projection slice adds:

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

Implement the embedded Excalidraw drawing block as a complete plugin slice:
canonical payload, in-document graphical editing, deterministic asset export,
LaTeX inclusion, and round-trip tests. Keep plugin payload codecs beside their
plugin and extend the shared fixture whenever a new canonical type is
completed.

Current deliberate compromises to reassess later:

- paged development layout treats every block as indivisible, including long
  paragraphs;
- a trailing explicit page break may leave an empty authoring page available
  for insertion;
- nearest-slot selection across nested sections is geometric and will need
  interaction tuning with denser documents;
- title-page isolation is a graphical plugin policy, while the LaTeX connector
  delegates exact page mechanics to LaTeX.
