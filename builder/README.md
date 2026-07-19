# Graphical document builder

This prototype embeds a semantic document surface inside an Excalidraw note canvas. The surface can
be projected either as one vertically growing continuous view or as whole-block pages. Paragraph,
image, code-listing, structured-math, title-page, table-of-contents, page-break, and section plugins
contribute palette entries, default block construction, vertical measurements, previews, and
optional editors. Generic builder code handles command dispatch, recursive document flow, insertion
previews, animated reflow, copying, transactional detach/delete behaviour, and page projection.
Document previews are rendered below Excalidraw, so sketches and free-form notes can be drawn over
the pages; the small interaction controls are rendered above them. Document blocks are not stored as
Excalidraw elements.

The graphical writer may be incomplete by design. A registered block type uses its adapter; an
unknown type is preserved by `DocumentPort` and rendered through one visible opaque-block fallback.
The fallback reads only the common stable ID and type ID and never inspects plugin-owned payload.

The current `MemoryDocumentPort` is deliberately behind a command/snapshot interface. Versioned
`.dans.json` persistence sits on the other side of that boundary: plugin-owned codecs translate
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
advance following content. The page-range controls project at most five pages at once.

Paragraph editing preserves the ordered inline sequence, supports drag-reordering, and renders a
live composed preview. Normal/bold/italic/bold-italic text, semantic RGB colour spans, hyperlinks,
and structured inline math are editable while unsupported inline nodes remain visible as named
read-only chips. Image editing uses the native file picker and stores a preview together with the
requested width and detected pixel dimensions. Code listings are limited to C++ and Julia; a
transparent textarea aligned over the syntax-coloured preview makes the rendered surface directly
editable, and Tab inserts four spaces. Display and inline math share the nested expression editor:
drag literals, operators, or a structured summation into empty slots; replace, parenthesize, park,
copy, or detach a subtree. An independently registered basic input-parser capability can lower typed
grouping, arithmetic, comma sequences, signed numbers, and identifiers into the same structured
tree. Selection locks retain the bounds of the containing scope, making nested expressions
addressable without flattening their structure.

Unknown document blocks remain in the flow as opaque labelled previews. Their Edit action logs a
stable handle to the browser console, demonstrating that preview and editing support are independent.
Ordinary Excalidraw tools remain available for panning, zooming, sketching, and free-form notes.

Paged projection never splits a semantic block: a block that does not fit moves to the next page,
and one taller than an entire content area becomes a visible warning placeholder. This is an
authoring policy, not a semantic property of the block. Cross-page dragging works through the same
recursive insertion slots as continuous mode. Save and Load use the canonical document format;
native materialization of those plugin payloads remains a separate connector task. Multiple movable
document surfaces remain a later experiment. See `../docs/continuation.md` and
`../docs/canvas-migration.md` for recovery state and the bespoke-canvas plan.

## Verify

```bash
npm run check
npm run smoke
```

`check` runs linting, unit tests, strict TypeScript checking, and a production build. `smoke` starts
an isolated Vite/Chrome session, drives the primary interactions through the browser, and writes
screenshots to `test-results/` for visual inspection.
