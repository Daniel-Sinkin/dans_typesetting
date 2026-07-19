# Architecture

## Boundary map

The project has four distinct jobs:

1. The semantic document core owns ordered blocks and structural sections.
2. Plugin modules own concrete block or inline data contracts.
3. Writer connectors translate one plugin contract into one writer contract.
4. Authoring applications edit a versioned transport representation and never
   use a writer's output as semantic storage.

The native LaTeX path currently follows this split. `Document` knows neither
LaTeX nor the concrete paragraph/image/math plugins. `LatexWriter` knows how to
walk the document and delegates concrete blocks to registered adapters. Core
Paragraph has its own inline consumption endpoint, and paragraph-like hosts
share its inline adapter registry.

The browser builder follows the same shape with `DocumentPort`,
`BuilderPluginRegistry`, and `BuilderInlinePluginRegistry`. Excalidraw is a
canvas implementation around the document surface; it is not the document
model and does not own block data.

## Primitive choices

- A document is an ordered sequence of semantic blocks.
- A section is a structural block containing another ordered block sequence.
- A paragraph is a plugin block containing an ordered inline sequence.
- An inline extension is data implementing the Core Paragraph inline contract.
- Page dimensions and measured width/height belong to a layout/writer layer,
  not semantic blocks.
- A reference ID names a semantic target. A graphical authoring ID identifies
  an editable node. They are different concepts even when a future transport
  stores both as strings.

## Compatibility rule

Semantic type IDs are part of the interchange contract. Native and browser
implementations must use the same spelling. The currently aligned IDs include:

| Contract | Type ID |
| --- | --- |
| Paragraph | `dans.core.paragraph` |
| Ordinary text | `dans.core.text` |
| Inline math | `dans.math.inline` |
| Display math | `dans.math.display` |
| Hyperlink | `dans.inline.hyperlink` |
| Figure | `dans.image.figure` |
| Listing | `dans.code.listing` |

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
- The graphical writer may show an opaque placeholder for unsupported plugins.
  It must preserve their envelope and payload rather than dropping them.

## Next architectural gate: canonical transport

The native and browser models still do not share a whole-document persistence
format. Broadly multiplying plugins and writers before fixing that would create
independent, drifting object graphs. The next gate is a versioned canonical
transport with these properties:

- exact encode/decode round trips;
- stable authoring IDs and separate optional reference IDs;
- ordered recursive block and inline sequences;
- plugin-owned payload schemas keyed by semantic type ID;
- preservation of unknown plugin payloads;
- explicit document-model versioning and schema migrations;
- conformance fixtures consumed by native and browser implementations;
- no LaTeX importer.

The transport is a protocol between modules, not a replacement for their
encapsulated runtime data structures.
