# Graphical document builder

This prototype embeds one vertically growing document page inside an Excalidraw note canvas.
Paragraph, image, code-listing, and structured-math plugins contribute palette entries, default block
construction, vertical measurements, previews, and optional editors. Generic builder code handles
command dispatch, document flow, insertion previews, animated reflow, copying, and transactional
detach/delete behaviour. Document previews are rendered below Excalidraw, so sketches and free-form
notes can be drawn over the page; the small interaction controls are rendered above it. Document
blocks are not stored as Excalidraw elements.

The graphical writer may be incomplete by design. A registered block type uses its adapter; an
unknown type is preserved by `DocumentPort` and rendered through one visible opaque-block fallback.
The fallback reads only the common stable ID and type ID and never inspects plugin-owned payload.

The current `MemoryDocumentPort` is deliberately behind a command/snapshot interface. It validates
the interaction before a native or WebAssembly transport connects the existing C++ model; it is not
intended to become an independent permanent document format.

## Run

```bash
cd builder
npm install
npm run dev
```

Open the displayed local URL, then drag Paragraph, Image, Code listing, or Display math from the
docked Blocks sidebar into the page. Drag an existing block by its handle to reorder it; hold Alt
while dragging to copy it. Dropping a moved block outside the document keeps it detached until the
confirmation dialogue either restores or deletes it.

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

This slice intentionally uses one growing page and has no pagination. Multiple movable document
surfaces and cross-page reflow remain later experiments. Native and browser paragraph IDs are now
aligned, but whole-document canonical persistence remains the next architectural gate. See
`../docs/continuation.md` and `../docs/canvas-migration.md` for recovery state and the bespoke-canvas
plan.

## Verify

```bash
npm run check
npm run smoke
```

`check` runs linting, unit tests, strict TypeScript checking, and a production build. `smoke` starts
an isolated Vite/Chrome session, drives the primary interactions through the browser, and writes
screenshots to `test-results/` for visual inspection.
