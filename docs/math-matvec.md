# Structured math grids and MatVec

## Contract

The core math model owns a rectangular presentation primitive:

- `rows` and `columns` are both positive;
- the row-major cell sequence has exactly `rows * columns` expressions;
- every cell is recursively valid structured mathematics;
- browser authoring slots are allowed while an expression is being edited;
- display-alignment markers are forbidden inside cells;
- the primitive itself has no delimiter or matrix-algebra meaning.

This is intentionally smaller than a general mathematical AST. It is sufficient
for matrices, vectors, small arrays, and future cases/alignment extensions while
remaining straightforward for every writer to implement. The LaTeX connector
lowers it to `matrix`; surrounding delimiter nodes independently provide
brackets. Canonical transport uses `kind: "grid"` with `rows`, `columns`, and a
recursive `cells` array.

## Native authoring extension

Including `plugins/math_matvec.hpp` makes `Math::MatVec` available without
changing the base document or writer registrations:

```cpp
using M = dans::document::plugins::Math;
using MV = M::MatVec;

auto equation = M::equal(
    M::sequence(
        MV::matrix(
            MV::row(M::id_a, M::id_b),
            MV::row(M::id_c, M::id_d)
        ),
        MV::column_vector(M::id_x, M::id_y)
    ),
    MV::column_vector(M::id_r, M::id_s)
);
```

Rows are move-only builder values. `matrix` rejects ragged rows, and the
variadic row/vector helpers accept the same `Math` shortcuts as the rest of the
authoring DSL. A `2 x 3` matrix remains a square-delimited `2 x 3` grid; square
here describes the delimiter glyph, not the shape.

## Graphical authoring extension

`mathMatVecEditorExtension` contributes four drag sources: `2x2`, `2x3`, a
three-component row vector, and a three-component column vector. Each source
creates explicit empty cell slots. Ordinary literals, parsed expressions, or
detached subtrees can be dropped into those slots, and a populated cell can be
selected, locked, copied, parked, replaced, or deleted through the existing
math editor mechanics.

The semantic constructors accept arbitrary positive rectangular dimensions;
the four fixed palette shapes are only the first graphical authoring policy.
A later dimension picker can generate other shapes without changing transport
or writer contracts.

## Deliberate omissions

- no row or column spans;
- no determinant/norm delimiter presets;
- no named matrix environment stored in semantic data;
- no algebraic evaluation, simplification, or dimension inference;
- no per-cell alignment markers;
- no arbitrary graphical dimension picker yet;
- no specialized block-matrix separators.
