# Thesis parity audit

## Corpus

The current editable source is
`/home/daniel/GitHub/tensor-network-cluster/documentation/tex`. Its README names
that tree as the sole editable source and it was current through 2026-07-18.
The audit explicitly excluded `content/peps_structure.tex` and
`figures/peps_structure/` as requested.

The older assembled draft in `/home/daniel/GitHub/tensor-network-cluster/thesis`
is useful for bibliography, appendix, and citation requirements that are not in
the newer documentation tree.

## Observed feature pressure

The counts below are an implementation inventory, not a promise to reproduce
every piece of source syntax.

| Area | Representative evidence | Current implication |
| --- | --- | --- |
| Shell | title/author/date, ToC, lists of figures/tables/listings, page breaks; older draft has abstract and appendices | semantic shell blocks and generators are required |
| Hierarchy | 7 sections, 43 subsections, 57 subsubsections; older draft reaches chapter and paragraph headings | builder needs the same recursive section tree as native |
| Prose | 68 bold, 96 monospace, italics, colour, links | complete the inline family before bulk porting |
| Math | dense inline math, at least 62 display blocks, align/equation/aligned, fractions, roots, scripts, operators, relations and sets | native/browser math AST convergence and extensions are high priority |
| Matrices | 24 `pmatrix`, 5 `bmatrix`, arrays and block matrices | matvec cannot remain a raw-LaTeX-only feature |
| Figures | 84 figures, 89 assets, math/code in captions, ten paired panels | captions must become inline sequences in transport; composite figures are needed |
| Tables | 31 floating tables plus rich tabulars, spans, widths, math, code and footnotes | a plain CSV grid is only an adapter, not the table core |
| Listings | Julia, CUDA and untyped/verbatim; many have no caption | base parity implemented; external-file inclusion and rich captions remain |
| References | 71 labels and 16 refs in current docs; much more in older draft | sections and all numbered blocks need a target registry |
| Footnotes | 31, including links/style/code and table notes | footnote content needs an inline sequence and table anchors |
| Lists | itemize, enumerate, custom labels and older description lists | semantic list/item blocks are required |
| Bibliography | older draft has 80 citations and 28 entries | citations plus BibTeX/JSON sources and a references block are required |

Theorem, definition, lemma, and algorithm environments were not found in the
audited non-PEPS corpus. They remain useful features, but they are lower thesis
parity priorities than tables, lists, footnotes, section references, and CUDA
listings.

The base footnote contract is now implemented in both graphical and LaTeX
writers, including nested styled text and hyperlinks. Table-note anchoring
remains separate parity work.

The first rich-table contract is also implemented in both writers. It covers
rectangular inline-rich cells, headers, alignment, captions, numbering,
references, and an optional CSV adapter. The audited thesis still requires
spans, explicit width policy, composite layouts, and dedicated table-note
placement before table parity is complete.

The structured-math slices now cover arbitrary rectangular grids,
square-bracketed matrices, row vectors, column vectors, stacked fractions,
square/indexed roots, and combined scripts in native LaTeX and the graphical
writer. Every child retains recursive editing and canonical transport. The
audited corpus still needs parentheses matrices, block separators, arrays,
richer operators/relations, and several specialized environments before
mathematical parity is close.

The listing contract now covers C++, CUDA, Julia, and raw source with
independently optional captions and reference targets in native LaTeX and the
graphical writer. Captionless listings retain consistent writer-derived
ordinals. Semantic single-line code leaves inside prose are also complete in
native LaTeX, canonical transport, and the graphical editor. Rich inline
captions and external-file/range inclusion remain separate parity work.

The citation/bibliography base is now implemented in native LaTeX, canonical
transport, and the graphical writer. It covers multi-citations, live numeric
resolution, normalized records, DOI/URL links, a references block, and strict
BibTeX plus bespoke-JSON source adapters. The audited thesis can therefore
represent its existing 80 citation occurrences and 28 normalized entries.
Remaining publication work includes citation styles beyond numeric order,
author/year disambiguation policy, multiple reference lists, and richer BibTeX
field/LaTeX normalization where the conservative adapter currently rejects
input.

## Representative port slices

Porting these slices exercises variety without copying hundreds of paragraphs:

1. `documentation/tex/main.tex` for document shell and top-level ordering.
2. `content/theory.tex`, “Tensors / Numerical Interpretation”, for dense math
   and section references.
3. `content/hpc_fundamentals.tex`, “Measurements and Scaling Laws”, for lists,
   emphasis, aligned equations, figures, and inline math.
4. `content/cuda.tex`, “Integrating CUDA into Julia”, for Julia/CUDA listings,
   inline code, links in footnotes, figures, and lists.
5. `content/implementation_details.tex`, “Batched Operations”, for matrices,
   arrays, coloured math, and multiple figures.
6. `content/implementation_details.tex`, “Correctness verification”, for
   referenced figures/tables and statistical notation.
7. `content/documentation.tex`, “Parameters / Computational Effort”, for rich
   tables and table footnotes.
8. `content/experiments.tex`, “Lower Bound on Runtime / Plots”, for large
   numerical tables, cross-references, footnotes, and paired figures.
9. One citation-heavy subsection from `thesis/chapters/ch02_background.tex`.
10. One short endpoint section from `thesis/chapters/appendix_a_abi.tex`.

## Recommended parity order

1. Canonical versioned transport and cross-language conformance fixtures.
2. Builder section tree and document-shell blocks.
3. Prose styles, inline math, URLs, footnotes, and references.
4. Rich table core, followed by CSV and Python-backed adapters.
5. Continue structured math beyond the implemented rectangular matvec slice.
6. Composite/subfigure support.
7. CUDA/raw/optional-caption listings (implemented base contract).
8. Citations and BibTeX/JSON bibliography (implemented base contract).
9. Markdown and Jupyter writer conformance over the same fixtures.
10. Final pagination and cross-page editing refinements.
