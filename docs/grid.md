# Grid layout

## Semantic contract

`dans.layout.grid` is the general block-composition primitive for equal-width
rows and columns. It is intentionally not a data table. A Grid stores:

- integral row and column counts in `[1, 16]`, with at most 64 cells;
- row and column gaps as finite author-intent values in `[0, 16]` em;
- one whole-width horizontal boundary at every row boundary;
- one whole-height vertical boundary at every column boundary;
- one ordered child `BlockSequence` per row-major cell.

Boundary styles are `none`, `single`, and `double`. `none` is semantic absence;
the development writer still draws it as a faint guide so empty cells remain
visible while authoring. Cell endpoint IDs are derived as
`cell:<row>:<column>` and are not separately persisted.

Cells may contain any number of ordinary blocks, including Padding, Captioned,
another Grid, or an otherwise opaque plugin with a registered writer adapter.
This is recursive exclusive ownership, so the result remains a tree rather
than an implicitly shared graph. Row/column spans are deliberately absent from
the first contract.

## Grid is not Table

`dans.table` remains a separate data-oriented plugin whose cells contain
`InlineSequence` values. It owns headers, column alignment, CSV capabilities,
large rectangular datasets, and future accessibility or page-spanning policy.
Grid owns layout composition of arbitrary document blocks. Both plugins solve
some similar width and boundary problems, but neither inherits the other's
semantics.

This separation permits a two-panel visual composition to use Grid while a
numerical results table stays compact and structurally tabular. Padding can be
placed inside a Grid cell when content needs inset from a configured boundary;
Grid itself does not acquire cell-padding policy.

## Writer policies

The LaTeX connector lowers Grid to a standard `tabular` whose equal column
widths are computed from the current `\linewidth`, requested inter-column
gaps, and active rule widths. Each cell is a top-aligned minipage and delegates
its child sequence back to the configured LaTeX writer. The minipage locally
converts ordinary figure/table float environments into non-floating caption
contexts, allowing existing block adapters to remain composable inside cells.
Nested Grid and Padding output is therefore ordinary connector delegation, not
a type switch in Grid.

Portable Markdown has no faithful arbitrary block-grid primitive. Its adapter
emits an explicit layout-loss comment and delegates every cell in deterministic
row-major order. No semantic child is discarded. Jupyter composes that exact
Markdown projection in its one presentation cell.

The graphical writer resolves equal column widths and row heights, reserving a
minimum 32-pixel cell width and 88-pixel empty-cell height. Excessive column
gaps are reduced before violating that minimum. Every named child sequence is
given an exact allocated rectangle. Generic drag targeting chooses the
smallest containing rectangle, so empty cells and recursively nested cells are
unambiguous insertion endpoints. The Grid adapter renders only cell guides,
configured boundaries, and labels; ordinary nested block previews and controls
remain generic builder output.

## Canonical transport

The browser codec persists dimensions, gaps, horizontal and vertical boundary
arrays, and a row-major `cells` array containing ordinary encoded block
envelopes. Derived cell endpoint IDs and all measured geometry are omitted.
Decode reconstructs the topology and rejects mismatched cell/edge counts,
invalid styles, excessive dimensions, and malformed recursive block data.

Resizing preserves overlapping cells by coordinate and keeps the previous
outer boundary styles on the new outer extent. Shrinking reports how many
blocks would be discarded before Save. Plugin-aware copying creates an empty
shell with identical endpoints and presentation intent, after which generic
tree copying gives every nested block a fresh authoring ID.

## Deliberate omissions

- unequal column tracks or explicit row heights;
- row/column spans and per-cell edge segments;
- automatic page fragmentation inside a Grid;
- Grid-specific captioning or numbering;
- Grid-specific CSV or accessibility semantics.

Captioned may wrap a Grid, or individual Grid cells may contain Captioned
children. More elaborate tracks or spans should be added only when a concrete
document requires them and every active writer can state a defensible policy.
