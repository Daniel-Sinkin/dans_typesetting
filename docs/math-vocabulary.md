# Structured mathematical vocabulary

The math core is a presentation tree. A binary node means exactly `left`, one
semantic operator, and `right`; it does not imply that the document system can
evaluate, simplify, or type-check the expression.

## Binary contract

The shared native and browser vocabulary now distinguishes:

- additive `plus` and `minus`;
- relation-like equality, inequality, ordering, approximation, similarity,
  membership, right-arrow, and maps-to operations;
- asterisk product, centered-dot product, `times`, slash division, and tensor
  product.

Relations have lower presentation precedence than addition, while arrows are
lower again. Products bind above addition. The renderer only inserts grouping
when the stored tree requires it; chained relations remain an explicitly
authored chain rather than being interpreted as Boolean conjunction.

The C++ DSL exposes descriptive factories such as:

```cpp
using M = dans::document::plugins::Math;

auto derivative = M::approximately_equal(
    M::divide(
        M::sequence(M::id_partial, M::id_E),
        M::sequence(M::id_partial, M::id_theta.subscript(M::id_i))
    ),
    M::tensor_product(M::id_A, M::id_B)
);
```

The shared TeX expression connector owns backend spelling: for example,
`less_equal` becomes `\leq`, `element_of` becomes `\in`, and
`tensor_product` becomes `\otimes`. Native LaTeX and Markdown both consume this
connector; the Jupyter presentation writer consumes the Markdown result.

## Atomic symbols

The browser model now mirrors the native symbol family: lowercase and capital
Greek symbols, nabla, partial, infinity, ordinary and centered ellipses,
dagger, transpose, script ell, and asterisk. Symbols are semantic leaves with a
registered name; Unicode glyphs are graphical presentation and TeX commands
are publication presentation.

This distinction matters for `dots` versus `cdots`, whose vertical placement
is intentionally different, and for `dag`/`dagger`, which normalize to one
dagger atom. Canonical and clipboard payloads store names such as
`"capital_psi"` and `"centered_ellipsis"`, never glyphs or raw LaTeX.

## Basic-input capability

The optional browser parser accepts both concise ASCII and common Unicode:

| Input | Semantic result |
| --- | --- |
| `a != b`, `a ≠ b` | not equal |
| `a <= b`, `a ≤ b` | less than or equal |
| `i in A`, `i ∈ A` | membership |
| `a -> b`, `a → b` | right arrow |
| `a \|-> b`, `a ↦ b` | maps to |
| `a * b` | asterisk product |
| `a cdot b`, `a · b` | centered-dot product |
| `a times b`, `a × b` | times product |
| `a otimes b`, `a ⊗ b` | tensor product |
| `theta`, `Gamma`, `partial`, `dag`, `ell` | semantic symbols |

Greek and special names are reserved by this optional parser for convenient
authoring. The programmatic constructors can still create an ordinary ASCII
identifier with the same letters when that distinction is required.

## Graphical editing and transport

Every new operator is an ordinary two-slot drag source. Every symbol is a leaf
drag source. They therefore inherit selection locking, thresholded detach,
temporary parking, context-menu operations, nested replacement, and typed slot
input from the existing editor.

The math clipboard and canonical payload remain version 1. This is an additive
extension of their existing discriminated vocabulary; old payloads retain
their meaning and newly emitted payloads remain byte-stable under
`to_string(from_string(serialized))` normalization.

Labeled arrows and large products/unions remain separate structures because
they own additional children or presentation state. Decorated identifiers and
ordinary/named function application are documented in
[math-identifiers-and-functions.md](math-identifiers-and-functions.md); they
are likewise not smuggled through the binary enum or symbol names.
Exact integer/decimal spellings and recursive signs are documented in
[math-numeric-literals.md](math-numeric-literals.md).
