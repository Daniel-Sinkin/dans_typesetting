# Prioritized thesis-parity slices

This is the actionable follow-up audit of
`/home/daniel/GitHub/tensor-network-cluster/documentation/tex`. Every
`peps_structure.tex` was excluded. It supplements the broad inventory in
[thesis-parity.md](thesis-parity.md) with small vertical slices that can be
implemented and verified independently.

The corpus contains 84 figures and 89 assets, 31 table floats plus 7 standalone
tabulars, 22 `lstlisting` plus 8 `verbatim` blocks, 24 `pmatrix`, 5 `bmatrix`,
5 arrays, 14 align/equation groups, and 12 lists.

## Completed first slice

**Optional figure and figure-pair targets** are implemented. Forty-six figures
have captions without labels and four of five figure pairs have no group label.
Ordinary figures and pair groups now keep their writer-owned numbering while
omitting anchors for absent targets; panel-only references reuse the pair
ordinal. Native LaTeX/Markdown/Jupyter, graphical editing, canonical transport,
the shared fixture, and mixed-numbering tests cover the contract.

## Remaining ranked work

1. **Lossless native numeric literals and unary negation.** The browser already
   owns decimal and negation nodes, while native math does not. Preserve literal
   spelling, including leading zeroes. Representative source:
   `content/implementation_details.tex`, “Using QR subspace projection to
   simplify SVD”, which contains negative-decimal matrices.
2. **Multiline display groups with numbering independent of labels.** Model
   ordered lines as `{expression, numbered, referenceId?}` plus a constrained
   alignment policy. Normalize the existing single-expression browser payload.
   Representative source: `content/documentation.tex`, “Local E/O” and “minSR”.
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
6. **Header-only table column spans.** Constrain the first span contract to
   header cells, validate row coverage, and provide merge/split commands. The
   corpus contains 12 `\multicolumn` and 13 `\cmidrule` uses.
7. **Table-aware footnote placement.** Reuse semantic footnotes, but let the
   LaTeX table connector place cell markers and hoist note bodies after the
   tabular.
8. **Remaining operator vocabulary.** Add definition equality, left arrow,
   much-less/much-greater, equivalence, union, and bitwise AND/OR through the
   existing binary-node contract.
9. **Math decorations and delimiters.** Add constrained underline/tilde nodes
   and absolute-value/norm delimiters, followed by the small missing symbol
   family.
10. **Large operators and labelled arrows.** Generalize summation only after its
    child contract is clear; add labelled arrows separately because their label
    is a recursive annotation child.
11. **Structural polish.** Rich list labels, block-bearing list items, generated
    lists of figures/tables/listings, rich section titles, then table width and
    wrapping policy.

External listing inclusion is not a current corpus priority: all audited
listings are embedded. Likewise, the audited non-PEPS material does not justify
theorem/lemma/definition or algorithm plugins yet. Those remain general product
ideas rather than blockers for migrating this thesis.

## Source issue kept strict

The source currently reuses the labels `fig:gemm_wrapper`,
`fig:sampling-batched-layout`, `fig:rb-cl-aligned`, `fig:gpu-envs-L16`, and
`fig:dlopen-sketch`. This is source cleanup, not a reason to weaken the document
target registry: duplicate semantic target IDs must remain errors.
