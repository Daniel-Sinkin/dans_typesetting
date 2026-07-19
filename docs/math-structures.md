# Fractions, radicals, and scripts

Structured math remains a backend-independent presentation tree. Fractions,
radicals, and scripts are recursive nodes, not raw LaTeX fragments and not an
algebra evaluator.

The native authoring API exposes complete values:

```cpp
using M = dans::document::plugins::Math;

auto expression = M::equal(
    M::fraction(
        M::id_x.subscript(M::id_i).superscript(M::id_2),
        M::square_root(M::add(M::id_1, M::id_y))
    ),
    M::nth_root(M::id_3, M::id_z)
);
```

`fraction` owns a numerator and denominator. A radical owns a radicand and an
optional degree; `square_root` omits the degree and `nth_root` supplies it. A
script owns one base and at least one of subscript or superscript. Native
validation recursively validates every owned expression. The LaTeX connector
lowers these nodes to `\frac`, `\sqrt`, and ordinary grouped scripts.

The browser model has the same semantic branches, with explicit authoring
slots where the graphical editor still needs input. Its palette supplies a
fraction, square root, indexed root, subscript, superscript, and combined-script
template. Every branch uses the shared math paths and therefore automatically
supports:

- pointer replacement and thresholded detach;
- temporary parking and deletion by dropping outside a target;
- numbered nested-selection scopes and right-click operations;
- typed slot replacement;
- versioned clipboard and canonical document transport.

The optional basic input parser accepts `sqrt(expression)` and postfix scripts
such as `x_2`, `x^2`, and `A_{i+1}^2`. Braces after `_` or `^` group the script
input but do not become visible delimiters. `/` deliberately remains the
binary slash-division operator; a stacked fraction is chosen explicitly from
the palette or constructed through `fraction`.

The clipboard envelope remains version 1 because expression kinds are an
extensible part of the existing structured-math payload. Node IDs are editor
identity and are regenerated when parsing; canonical serialization omits them,
so `to_string(from_string(to_string(expression)))` is byte-stable.

Typed indexed-root syntax, continued fractions, radical style policy, and
mathematical evaluation remain independent extensions rather than options on
these three core presentation nodes. Ordinary and named function calls are
documented in
[math-identifiers-and-functions.md](math-identifiers-and-functions.md); the
relation, product, and symbol vocabulary is documented separately in
[math-vocabulary.md](math-vocabulary.md), and constrained semantic annotation
nodes are documented in [math-annotations.md](math-annotations.md).
