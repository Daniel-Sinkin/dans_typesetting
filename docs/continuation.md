# Continuation state

This file records recovery information for a fresh development session. Update
it at every milestone rather than relying on conversation history.

## Verified checkpoint before the prose slice

Commit `bfe1471` contains the native LaTeX prototype and the first Excalidraw
graphical builder. It was pushed to `main` after native PDF generation, strict
TypeScript/lint/unit checks, browser smoke interactions, and `npm audit` passed.

## Current in-progress slice

The working tree after that checkpoint adds:

- explicit normal/bold/italic/bold-italic Core Text in native and browser code;
- semantic hyperlinks with rich inline labels and LaTeX/browser connectors;
- graphical viewing and full structured editing for `dans.math.inline`;
- canonical paragraph/text type-ID spelling across native and browser code;
- a directly editable syntax-coloured C++/Julia listing surface;
- native connector tests and additional browser/model tests;
- the thesis parity audit and canvas replacement plan.

The inline-math editor currently reuses the full display-math editor inside the
paragraph editor. This is functionally consistent but space-hungry; a compact
launcher or focused nested dialog is a later usability refinement.

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

Do not start broad writer/plugin expansion until a versioned canonical document
transport and conformance fixture exist. After that, add semantic title, ToC,
page-break and section blocks, then implement continuous/paged builder layout.
