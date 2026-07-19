# Prioritized thesis-parity slices

This is the actionable follow-up audit of
`/home/daniel/GitHub/tensor-network-cluster/documentation/tex`. Every
`peps_structure.tex` was excluded. It supplements the broad inventory in
[thesis-parity.md](thesis-parity.md) with small vertical slices that can be
implemented and verified independently.

The corpus contains 84 figures and 89 assets, 31 table floats plus 7 standalone
tabulars, 22 `lstlisting` plus 8 `verbatim` blocks, 24 `pmatrix`, 5 `bmatrix`,
5 arrays, 14 align/equation groups, and 12 lists.

## Completed slices

**Optional figure and figure-pair targets** are implemented. Forty-six figures
have captions without labels and four of five figure pairs have no group label.
Ordinary figures and pair groups now keep their writer-owned numbering while
omitting anchors for absent targets; panel-only references reuse the pair
ordinal. Native LaTeX/Markdown/Jupyter, graphical editing, canonical transport,
the shared fixture, and mixed-numbering tests cover the contract.

**Lossless native numeric literals and unary negation** are implemented.
Integer and decimal leaves preserve exact source spelling without a machine
integer/floating-point conversion, while signs are recursive math nodes.
Native LaTeX, Markdown, and Jupyter share unambiguous TeX lowering; the existing
browser parser/editor contract, canonical fixture, and focused malformed and
idempotence tests cover the same vocabulary.

**Multiline structured display groups** are implemented. A group owns ordered
lines with independent numbering and optional target identity, plus constrained
automatic/disabled alignment. Targetless numbered lines advance later
references, unnumbered lines cannot publish targets, and the legacy graphical
single-expression payload normalizes losslessly. Native LaTeX,
Markdown/Jupyter, the graphical preview/editor, canonical fixture, and browser
interaction tests cover the contract. See
[math-display-groups.md](math-display-groups.md).

## Remaining ranked work

1. **Native document decoding and export command.** The graphical
   builder persists plugin envelopes, but native transport cannot yet turn
   known payloads into runtime `DocumentBlock` objects. Add a plugin-owned
   decoder registry and a strict `.dans_doc -> .tex/.pdf` exporter;
   unsupported types must fail rather than disappear. This is the largest
   current end-to-end thesis blocker.
2. **Managed publication assets.** Browser-selected images are data URLs while
   native graphics connectors accept filesystem assets. Define a project bundle
   and resolver for PNG/JPEG/PDF/SVG plus rendered Excalidraw output so saved
   graphical documents remain publishable.
3. **Recursive math colour.** There are 139 `\textcolor` and 73 grouped
   `\color` uses. Add one RGB-owned unary math node rather than leaking paragraph
   colour or raw LaTeX into an expression. Representative source:
   `content/hpc_fundamentals.tex`, “Memory Representations”.
4. **Caption-optional semantic tables.** Six table floats are captionless and
   seven tabulars are standalone. Make caption and numbering policy explicit
   rather than manufacturing `Table N`. Representative source:
   `content/documentation.tex`, “Parameters”.
5. **Round-matrix and bare-array authoring.** Reuse grid plus delimiter nodes
   for `pmatrix`; then add optional per-column alignment for the five arrays.
6. **Block-bearing and custom-labelled lists.** Nine custom-labelled items,
   three display equations inside items, and two nested CUDA listings cannot be
   represented by the current inline-only item contract. Extend list items with
   an ordered block sequence without weakening ordinary inline-only authoring.
7. **Header-only table column spans.** Constrain the first span contract to
   header cells, validate row coverage, and provide merge/split commands. The
   corpus contains 12 `\multicolumn` and 13 `\cmidrule` uses.
8. **Table-aware footnote placement.** Reuse semantic footnotes, but let the
   LaTeX table connector place cell markers and hoist note bodies after the
   tabular.
9. **Remaining operator vocabulary.** Add definition equality, left arrow,
   much-less/much-greater, equivalence, union, and bitwise AND/OR through the
   existing binary-node contract.
10. **Math decorations and delimiters.** Add constrained underline/tilde nodes
   and absolute-value/norm delimiters, followed by the small missing symbol
   family.
11. **Large operators and labelled arrows.** Generalize summation only after its
    child contract is clear; add labelled arrows separately because their label
    is a recursive annotation child.
12. **Thesis shell and heading policy.** Add chapters, paragraph headings,
    unnumbered headings, abstract/appendix transitions, rich math/code heading
    content, generated lists of figures/tables/listings, and a richer title
    block, then table width and wrapping policy.

External listing inclusion is not a current corpus priority: all audited
listings are embedded. Likewise, the audited non-PEPS material does not justify
theorem/lemma/definition or algorithm plugins yet. Those remain general product
ideas rather than blockers for migrating this thesis.

## Source issue kept strict

The source currently reuses the labels `fig:gemm_wrapper`,
`fig:sampling-batched-layout`, `fig:rb-cl-aligned`, `fig:gpu-envs-L16`, and
`fig:dlopen-sketch`. This is source cleanup, not a reason to weaken the document
target registry: duplicate semantic target IDs must remain errors.
