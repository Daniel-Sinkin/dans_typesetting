# Lossless numeric literals and unary negation

Structured math stores presentation intent, not machine arithmetic. Numeric
leaves therefore preserve their authored spelling and a minus sign is a
recursive operation rather than part of a number token.

## Semantic contract

An integer literal is one or more ASCII digits. A decimal literal has exactly
one decimal point and at least one ASCII digit; `3.`, `.25`, and `003.20` are
all valid and remain distinct spellings. Signs and exponent notation are not
literal syntax. Negative values use a `negated` node whose `body` is any
recursive math expression.

The native API makes the distinction explicit:

```cpp
using M = dans::document::plugins::Math;

auto exact = M::decimal("003.20");
auto negative = M::negate(M::decimal("0.125"));
auto grouped = M::negate(M::add(M::id_a, M::id_b));
```

`M::integer(i64)` remains a convenience for non-negative programmatic values.
It rejects a negative argument so `integer(-3)` cannot create a second,
non-structural spelling for `negate(integer(3))`. The string overload is not
bounded by `i64`, which also keeps large indices lossless.

This is deliberately not a numeric evaluator. The model does not normalize
leading zeroes, compare equivalent spellings, fold signs, or accept locale
decimal separators. Scientific notation can be introduced later as a separate
semantic node or parser policy if thesis pressure justifies it.

## Writer and authoring behavior

The common TeX expression connector copies numeric spellings exactly, so native
LaTeX, Markdown, and the Markdown-composed Jupyter writer share one result.
Negating a binary or comma-separated body adds visible grouping. A negated
right-hand additive subtree is also grouped, preventing output such as
`a + -b` while preserving the stored tree.

The browser model already used string-backed integer and decimal leaves plus a
recursive negation node. Its optional basic-input parser accepts signed values
by parsing `-` as unary structure, and the graphical editor exposes decimal
leaves and negation through the same selection, drag/drop, parking, clipboard,
and typed-input paths as other math nodes.

Canonical and clipboard payloads use:

```json
{
  "kind": "negated",
  "body": {
    "kind": "decimal",
    "value": "003.20"
  }
}
```

The shared fixture carries this form. Exact transport normalization and focused
native publication tests guard both the recursive sign and the literal
spelling.
