# Structured display groups

`dans.math.display` is an ordered group of displayed equation lines. It is not
one equation that happens to wrap visually: each line is an independent
semantic occurrence and may receive its own writer-derived equation number.

## Contract

A group contains at least one line and one constrained alignment policy:

```text
Display {
    alignment: automatic | disabled
    lines: [
        {
            id: stable authoring occurrence ID
            expression: structured Math tree
            numbered: boolean
            referenceId: optional semantic target ID
        }, ...
    ]
}
```

Line IDs are globally unique within a graphical document. They identify
numbered occurrences during traversal and are deliberately separate from the
optional semantic target ID. Copying a display gives every line a fresh
occurrence ID and clears all target IDs.

Numbering does not depend on target publication:

- a numbered line without a target still advances the equation series;
- a numbered line with a target can be referenced by that derived number;
- an unnumbered line does not advance the series;
- an unnumbered line cannot publish a target, because `Equation ?` is not a
  defensible reference contract.

The native `Math::Display(Math)` constructor creates a numbered line.
`add_equation` appends a numbered line with an optional `ReferenceId`, while
`add_unnumbered` is the explicit opt-out. `DisplayLineOptions` exposes the same
policy for programmatic construction.

## Alignment

`automatic` aligns a multiline group at top-level equality operators. The
graphical development writer mirrors this by placing top-level equals signs on
one visual axis. `disabled` centers each line without an inferred alignment
point.

The native model additionally permits one explicit binary-operator alignment
point per line. Every line in that group must either use an explicit point or
use none, and explicit points are rejected when alignment is disabled. The
graphical expression model does not yet expose explicit operator markers; this
is an intentional, documented parity gap rather than raw LaTeX leakage.

## Writer lowering

- LaTeX uses `equation` for one numbered line and `\[...\]` for one
  unnumbered line. Multiline groups use `align`/`align*` or `gather`/`gather*`;
  unnumbered lines inside a numbered group receive `\notag`.
- Markdown emits one portable `$$` block per line. It writes `*Equation N*`
  only for numbered lines and retains anchors only for named targets. Jupyter
  preserves that Markdown output exactly in its presentation cell.
- The graphical writer renders all lines in order, derives every visible
  number from the whole current document, and anchors named lines internally
  rather than assigning one ambiguous target to the outer block.

Markdown cannot promise publication-quality cross-line alignment, so it
preserves semantics and numbering without pretending to emulate LaTeX layout.

## Graphical editing and transport

The display editor provides a live group preview, line selection, add/remove,
up/down permutation, per-line numbered and target controls, and the existing
recursive expression editor for the selected line. New lines begin as numbered
empty slots. At least one line must remain.

Canonical payloads always emit `alignment` and `lines`. The earlier payload
shape `{expression, referenceId}` is still accepted and normalizes to one
automatic, numbered line with the deterministic occurrence ID
`<block-id>:line:0`. Mixing legacy and ordered fields is rejected, as are empty
line arrays and targets on unnumbered lines. The shared fixture exercises a
targeted line, a targetless numbered line, and an unnumbered line.

Focused native and browser tests cover mixed numbering, later reference
numbers, legacy normalization, malformed payloads, copied identities, Markdown
and Jupyter preservation, LaTeX `\notag`, and graphical browser interaction.
