# Canvas migration plan

## Goal

Replace Excalidraw incrementally without coupling document semantics to a new
canvas implementation. The target remains a portable infinite workspace where
notes and drawings sit above one or more embedded document surfaces.

Keeping the interaction layer in TypeScript is the pragmatic default for web,
desktop wrappers, and phones. Native C++ can later provide layout, parsing, or
writer logic through a process boundary or WebAssembly; it should not force the
touch/pointer UI into a platform-specific rendering stack prematurely.

## Required canvas contract

Introduce a `CanvasPort` owned by the application shell. The document builder
should consume only these capabilities:

- world/screen coordinate transforms;
- pan and zoom state;
- pointer capture and hit testing;
- ordered scene elements and layer groups;
- selection, move, resize, duplicate, delete, group, and ungroup commands;
- undo/redo transactions;
- clipboard serialization;
- freehand, rectangle, ellipse, arrow, image, and text primitives;
- an embedded-surface primitive with an explicit z-order;
- export of a bounded scene region to SVG and raster output;
- persistence independent of React component state.

The existing document remains an embedded surface below sketch elements. Block
dragging is handled by the document interaction layer; sketch hit testing wins
only for visible sketch elements above it.

## Staged replacement

1. **Isolation:** wrap all direct Excalidraw calls behind `CanvasPort` and an
   `ExcalidrawCanvasAdapter`. Add interaction conformance tests.
2. **Scene model:** create a small versioned scene format and command reducer.
   Keep Excalidraw rendering it through the adapter initially.
3. **Viewport:** implement bespoke pan/zoom, coordinate transforms, pointer
   capture, and a debug grid with no drawing tools.
4. **Selection:** add spatial indexing, hit testing, selection boxes, move,
   resize, delete, duplicate, undo, and clipboard.
5. **Drawing:** add freehand paths and basic shapes, then text and arrows.
6. **Embedding:** render document surfaces and Excalidraw blocks as first-class
   scene elements; verify layer ordering and clipped editing.
7. **Export:** deterministic SVG first, then raster thumbnails. Reuse the SVG
   path for LaTeX/PDF inclusion of an Excalidraw block.
8. **Cutover:** run both adapters against the same recorded interaction suite,
   migrate persisted scenes, then remove the Excalidraw dependency.

## Rendering choice

SVG is the best first bespoke backend: inspectable output, native text and link
support, simple clipping, and direct reuse for document export. Canvas 2D can be
added for freehand performance and WebGL/WebGPU only if profiling demonstrates
a real need. The semantic scene should not expose any of those APIs.

## Main risks to test early

- pointer/touch behavior under nested zoomed document surfaces;
- text measurement and editor overlays;
- selection precedence between sketches and document blocks;
- clipboard and undo transaction boundaries across embedded surfaces;
- large-scene hit testing on mobile;
- stable export of fonts, images, and clipped embedded blocks.
