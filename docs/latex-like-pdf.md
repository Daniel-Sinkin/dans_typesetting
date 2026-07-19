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
