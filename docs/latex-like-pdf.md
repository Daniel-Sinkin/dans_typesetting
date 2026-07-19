# Native LaTeX-like PDF path

The native publication path is a constrained implementation of the project's
own document semantics. It does not invoke LaTeX and it does not parse LaTeX.
The current vertical slice deliberately handles only ordinary, normal-weight
printable-ASCII text inside paragraphs.

```text
.dans_doc
    -> CanonicalDocument
    -> Document
    -> LatexLikeEngine
    -> PagedDocument
    -> PdfSerializer
    -> .pdf
```

The ordinary LaTeX writer remains a sibling projection from the same
`Document`. `document_publish` exercises both paths, producing a `.tex` file
and a direct `.pdf` file from one materialized semantic tree.

## Canonical materialization

The generic canonical parser still treats every plugin payload as opaque JSON.
`DocumentMaterializer` is a separate, strict registry that asks plugin-owned
adapters to construct semantic blocks and inline nodes. Unknown types fail
publication rather than disappearing. Adapter output is checked against the
requested semantic type ID before it enters `Document`.

The first registered materializers are Core Paragraph and Core Text. This is
an output projection: native `Document` currently does not retain browser
authoring IDs, so materializing and then reconstructing canonical JSON is not
an identity round trip. The generic canonical transport remains the lossless
load/save boundary for unavailable plugins.

## Page display list

`PagedDocument` is backend-neutral layout output. It contains pages and
positioned glyph runs; it has no PDF object numbers, streams, xref tables, or
LaTeX commands. Positions use `ScaledPoint`, with 65,536 units per TeX point.
The PDF serializer converts TeX points (72.27 per inch) into PDF points (72 per
inch) only at its boundary.

This separation is intentional. A later graphical development writer can
project the same page display list into its interactive canvas instead of
reverse-engineering a generated PDF. More fragment types, hit-test identities,
and source ranges can extend the layout IR without entering the semantic
document model or the PDF object layer.

## Initial paragraph compositor

`LatexLikeStyle::article_11pt_a4()` mirrors the relevant default article-class
constants:

- A4 media box;
- 360 TeX-point text width;
- Latin Modern Roman 10 at 10.95 TeX points;
- 17 TeX-point first-line paragraph indentation;
- 13.6 TeX-point baseline spacing;
- standard-class header, text-height, and footer geometry;
- the standard class's whole-point margin truncation.

The compositor normalizes source whitespace, validates printable ASCII,
measures glyphs and kerning through Latin Modern's AFM data, constructs
TeX-like interword glue, and chooses line breaks using global dynamic
programming. Non-final lines stretch or shrink spaces to the text boundary;
final lines remain ragged right. Paragraphs advance on one shared baseline
grid and continue on a new page when no baseline remains.

This is intentionally not a complete TeX paragraph algorithm. The first slice
does not yet implement hyphenation, ligatures, fitness classes, adjacent-line
demerits, widow/orphan policy, Unicode shaping, font fallback, styled fonts,
microtype expansion/protrusion, or incremental reflow. Those are compositor
features, not PDF features, and can be added independently.

## PDF serialization

The PDF serializer writes ordinary PDF 1.4 objects:

- a catalog and page tree;
- one content stream per page;
- positioned text-showing operations;
- an embedded Latin Modern Type 1 PFB program;
- AFM-derived width and descriptor data;
- WinAnsi character encoding for the supported ASCII range;
- a `ToUnicode` CMap so text remains selectable and copyable;
- a classic xref table and trailer.

The initial serializer embeds the complete font program rather than subsetting
it. PDF emission has no LaTeX-specific layout protocol: it consumes already
positioned glyph runs and records those placements in page content streams.

### Why the first serializer uses classic PDF 1.4

Two related choices are easy to conflate:

1. the file declares PDF version 1.4;
2. indirect objects are indexed by a classic textual xref table and trailer.

The second choice is what “classic” primarily means. A minimal file is shaped
like this:

```text
%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
...
7 0 obj
<< /Length 3318 >>
stream
BT ... TJ ET
endstream
endobj
xref
0 9
0000000000 65535 f
0000000015 00000 n
...
trailer
<< /Size 9 /Root 1 0 R >>
startxref
125500
%%EOF
```

Every catalog, page-tree, page, font, character map, and content-stream object
is independently numbered. While writing, the serializer records the byte
offset at which each object starts. The fixed-width xref table publishes those
offsets, and `startxref` points a reader to that table. This has a small and
transparent implementation surface: object boundaries and offsets remain
inspectable, corruption is local, and validation failures do not first require
decoding a compressed binary index.

PDF 1.5 introduced xref streams and object streams. An xref stream packs entry
types, offsets, generations, and object-stream indexes into binary fields whose
widths are described by `/W`, and normally compresses them. That representation
can be smaller, but it adds binary packing, compression, and optional
object-stream bookkeeping without changing text placement or rendering.

The version and serialization choices are not synonymous. A PDF 1.7 file may
still use a classic xref table, and ordinary content streams may be
Flate-compressed while retaining classic xref. PDF 1.4 already contains the
text, embedded-font, image XObject, vector path, clipping, transparency,
destination, outline, and hyperlink-annotation primitives required by the
planned document features. A version increase is therefore not currently a
content requirement.

The observed fixture comparison at this stopping point is:

| Property | LuaLaTeX reference | Native output |
| --- | --- | --- |
| Declared version | PDF 1.7 | PDF 1.4 |
| Cross-reference | compressed xref stream | classic textual xref table |
| Font representation | subset CID/CFF font | complete Type 1 PFB font |
| Text encoding | two-byte Identity-H glyph IDs | one-byte WinAnsi ASCII |
| Text mapping | ToUnicode | ToUnicode |
| Metadata | producer, creator, timestamps, file ID | none yet |
| Fixture size | 6,135 bytes | 125,906 bytes |

The xref choice accounts for very little of that size difference. The native
file is larger because it embeds the complete font and leaves streams
uncompressed. Font subsetting and stream compression are independent serializer
improvements; neither requires changing `Document`, the compositor, or
`PagedDocument`.

### Equivalence target

Byte identity with LuaLaTeX is explicitly not a goal. PDF has no canonical byte
encoding: equivalent files may choose different object numbers and ordering,
numeric spellings, stream segmentation, compression levels, subset tags,
metadata, timestamps, and file identifiers. Reproducing LuaTeX's exact choices
would couple the project to incidental serializer behavior without improving
the document.

Native-PDF conformance should instead be evaluated at three boundaries:

- semantic equivalence: extracted text, reading order, links, destinations,
  labels, and other user-visible document behavior;
- layout equivalence: page geometry, line breaking, baselines, glyph placement,
  numbering, and bounded raster differences;
- structural validity: independent PDF parsers accept the object graph, fonts
  are embedded and mapped, and all declared streams and xref entries resolve.

The current fixture has identical extracted text and matching page geometry,
line breaks, baselines, paragraph indentation, and footer position. LuaLaTeX
still applies small per-line `microtype` font expansion and uses the CFF form of
Latin Modern, so the raster output is close rather than identical.

### Deferred work

Correctness remains ahead of compactness or throughput. Continue in small
vertical slices:

1. Extend paragraph fidelity only when a representative document requires it:
   Unicode shaping, font fallback, ligatures, hyphenation, full TeX-style line
   demerits, widow/orphan policy, and microtype-like expansion or protrusion.
2. Extend the backend-neutral page display list for links, images, paths,
   annotations, source identities, and interaction hit regions as their
   semantic plugins enter the direct-PDF path.
3. Project the same page display list into the graphical builder so interactive
   preview and direct publication share pagination rather than approximating
   one another.
4. Subset embedded fonts. This is the largest immediate file-size improvement.
5. Add Flate compression for suitable content, mapping, and font streams while
   retaining the inspectable classic xref path.
6. Add deterministic document metadata, producer information, and file IDs if
   publication workflows need them; keep wall-clock timestamps optional so
   reproducible output remains possible.
7. Introduce xref streams or object streams only if measured size, very large
   object counts, or object-stream support provides a concrete reason. They are
   not a prerequisite for visual fidelity.
8. Keep reference validation structural and semantic: native tests, independent
   PDF parsers, font inspection, text extraction, geometry assertions, and
   selective raster comparisons. Do not turn a LuaLaTeX byte diff into a test.

No native-versus-LaTeX performance benchmark is required during these
correctness slices. Serialization optimizations remain isolated behind
`PdfSerializer` and must not leak PDF mechanics back into semantic blocks or
page layout.

The implementation follows the PDF object, page-tree, content-stream, Type 1
font, and text-operator contracts in the
[Adobe PDF Reference](https://opensource.adobe.com/dc-acrobat-sdk-docs/pdfstandards/pdfreference1.5_v6.pdf).
The comparison geometry is derived from the standard class definitions and the
[LaTeX standard-classes documentation](https://www.latex-project.org/help/documentation/classes.pdf),
not copied coordinates from a reference PDF.

## Running the slice

Build and publish the staged two-paragraph fixture:

```sh
cmake --build build-clang --target latex_like_text_comparison --parallel
```

This creates side-by-side files in the build directory:

- `latex-like-text-reference.pdf`, compiled from the sibling LaTeX export;
- `latex-like-text-native.pdf`, serialized directly from `PagedDocument`.

The native tests separately grow the input through five words, one punctuated
sentence, four wrapping sentences, and two four-sentence paragraphs. The final
comparison currently has the same line breaks, baselines, margins, indentation,
and footer location as the LuaLaTeX reference. LuaLaTeX's configured
`microtype` package still applies small per-line horizontal font expansion that
the native compositor intentionally leaves for a later slice.

To publish another currently supported canonical file directly:

```sh
build-clang/document_publish input.dans_doc output.tex output.pdf
```

The command fails conspicuously if the document contains a block or inline
type without a registered semantic materializer or layout adapter.
